#!/usr/bin/env node

/**
 * Repeatable browser-level smoke test for the modular game clients.
 *
 * The script starts an in-process HTTP/WebSocket server, launches a temporary
 * headless Firefox WebDriver BiDi session, imports every client module, then
 * runs two-tab public/private room, transport-drop reconnect and lifecycle
 * smoke tests, then renders the shared visual fixture at the supported
 * desktop/mobile sizes. It intentionally
 * does not replace real-player acceptance; it catches failed imports, uncaught
 * browser exceptions and the most important viewport fit regressions before a
 * release.
 */

'use strict';

const http = require('http');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const games = [
    'acquire', 'aeroplane', 'avalon', 'camelup', 'checkers', 'citadels',
    'coup', 'decrypto', 'gobang', 'guessnumber', 'hanabi', 'jungle',
    'kingdomino', 'lasvegas', 'loveletter', 'magicalathlete', 'manila',
    'modernart', 'monopolydeal', 'scout', 'splendor', 'takefive', 'werewolf',
    'witchtown',
];
const sizes = [[1280, 900], [390, 844], [667, 375], [844, 390]];
const clientPaths = [
    ...games.map(game => `/games/${game}/client.js`),
    '/games/monopoly/client.js',
    '/games/chess/lobby-client.js',
    '/games/junqi/client.js',
    '/games/xiangqi/client.js',
];

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findFreePort() {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    probe.close();
    await once(probe, 'close');
    return port;
}

async function waitForPort(port, timeout = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        try {
            await new Promise((resolve, reject) => {
                const socket = net.connect({ host: '127.0.0.1', port });
                socket.once('connect', () => { socket.destroy(); resolve(); });
                socket.once('error', error => { socket.destroy(); reject(error); });
            });
            return;
        } catch {
            await wait(80);
        }
    }
    throw new Error(`Firefox WebDriver BiDi 在 ${timeout}ms 内未监听 ${port}`);
}

class BidiSession {
    constructor(socket) {
        this.socket = socket;
        this.requestId = 0;
        this.pending = new Map();
        socket.on('message', raw => {
            const message = JSON.parse(raw);
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) pending.reject(message);
            else pending.resolve(message.result);
        });
    }

    command(method, params = {}) {
        const id = ++this.requestId;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async close(context) {
        try { if (context) await this.command('browsingContext.close', { context }); } catch {}
        try { await this.command('session.end'); } catch {}
        this.socket.close();
    }
}

async function connectBidi(port) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });
    const bidi = new BidiSession(socket);
    await bidi.command('session.new', { capabilities: { alwaysMatch: {} } });
    return bidi;
}

async function evaluate(bidi, context, expression) {
    const response = await bidi.command('script.evaluate', {
        target: { context },
        expression,
        awaitPromise: true,
        resultOwnership: 'none',
    });
    return response.result?.value;
}

async function waitForCondition(bidi, context, expression, label, timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (await evaluate(bidi, context, expression)) return;
        await wait(100);
    }
    throw new Error(`${label} 在 ${timeout}ms 内未完成`);
}

async function runLobbyLifecycle(bidi, hostContext, httpPort, wss) {
    const click = selector => evaluate(bidi, hostContext, `document.querySelector(${JSON.stringify(selector)})?.click(); true`);
    await waitForCondition(
        bidi,
        hostContext,
        `document.querySelector('#entryConnectionStatus')?.textContent.includes('已连接')`,
        '房主大厅连接',
    );
    await click('#entryStartBtn');
    await waitForCondition(
        bidi,
        hostContext,
        `document.querySelector('#lobbyView')?.style.display === 'grid' && Boolean(document.querySelector('#gamePicker [data-game-type="gobang"]'))`,
        '房主游戏目录',
    );
    await click('#gamePicker [data-game-type="gobang"]');
    await waitForCondition(bidi, hostContext, `document.querySelector('#createRoomDialog')?.hidden === false`, '创建房间规则页');
    await click('#createRoomNextBtn');
    await waitForCondition(bidi, hostContext, `document.querySelector('#createRoomDialog')?.classList.contains('is-settings')`, '创建房间设置页');
    await evaluate(bidi, hostContext, `(() => {
        const input = document.querySelector('#createRoomName');
        if (input) input.value = '浏览器生命周期验收';
        document.querySelector('#createRoomForm')?.requestSubmit();
        return true;
    })()`);
    await waitForCondition(
        bidi,
        hostContext,
        `document.querySelector('#roomView')?.style.display === 'block' && Boolean(document.querySelector('#roomMount .pregame-room[data-game-type="gobang"]'))`,
        '房主等待房间',
    );
    const roomId = await evaluate(
        bidi,
        hostContext,
        `document.querySelector('#roomPageCode')?.textContent.match(/\\b\\d{6}\\b/)?.[0] || ''`,
    );
    if (!/^\d{6}$/.test(roomId)) throw new Error('房主等待房间没有可用房间号');

    const { context: guestContext } = await bidi.command('browsingContext.create', { type: 'tab' });
    await bidi.command('browsingContext.navigate', { context: guestContext, url: `http://127.0.0.1:${httpPort}/` });
    try {
        await waitForCondition(
            bidi,
            guestContext,
            `document.querySelector('#entryConnectionStatus')?.textContent.includes('已连接')`,
            '成员大厅连接',
        );
        await evaluate(bidi, guestContext, `document.querySelector('#entryJoinBtn')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('#joinLobbyView')?.style.display === 'block'`, '找房大厅');
        await waitForCondition(
            bidi,
            guestContext,
            `document.querySelector('#joinLobbyRoomList')?.textContent.includes(${JSON.stringify(roomId)})`,
            '成员看到公开房间',
        );
        await evaluate(bidi, guestContext, `(() => {
            const input = document.querySelector('#joinLobbyCodeInput');
            if (input) {
                input.value = ${JSON.stringify(roomId)};
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            document.querySelector('#joinLobbyCodeForm')?.requestSubmit();
            return true;
        })()`);
        await waitForCondition(
            bidi,
            guestContext,
            `document.querySelector('#roomView')?.style.display === 'block' && Boolean(document.querySelector('#roomMount .pregame-room[data-game-type="gobang"]'))`,
            '成员等待房间',
        );
        const occupiedSeats = `document.querySelectorAll('#roomMount .pregame-seat.is-occupied').length >= 2`;
        await waitForCondition(bidi, hostContext, occupiedSeats, '房主看到成员入座');
        await waitForCondition(bidi, guestContext, occupiedSeats, '成员看到自己入座');
        await waitForCondition(bidi, guestContext, `Boolean(document.querySelector('[data-toggle-ready]'))`, '成员准备按钮');
        await evaluate(bidi, guestContext, `document.querySelector('[data-toggle-ready]')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('[data-toggle-ready]')?.textContent.includes('准备') && !document.querySelector('[data-toggle-ready]')?.classList.contains('is-ready')`, '成员取消准备');
        await evaluate(bidi, guestContext, `document.querySelector('[data-toggle-ready]')?.click(); true`);
        await waitForCondition(bidi, hostContext, `document.querySelectorAll('.pregame-player-row.is-ready').length >= 2`, '房主看到成员准备');
        try {
            await waitForCondition(bidi, hostContext, `Boolean(document.querySelector('[data-start-game][data-start-state="ready"]'))`, '房主可开局', 20000);
        } catch (error) {
            const snapshot = context => evaluate(bidi, context, `JSON.stringify({
                room: document.querySelector('#roomMount .pregame-room')?.dataset.gameType || '',
                roomDisplay: document.querySelector('#roomView')?.style.display || '',
                seats: document.querySelectorAll('#roomMount .pregame-seat.is-occupied').length,
                readyRows: document.querySelectorAll('.pregame-player-row.is-ready').length,
                readyButton: document.querySelector('[data-toggle-ready]')?.textContent || '',
                startState: document.querySelector('[data-start-game]')?.dataset.startState || '',
                preload: document.querySelector('.pregame-resource-state')?.textContent || '',
                guidance: document.querySelector('.pregame-start-guidance')?.textContent || '',
            })`);
            const hostState = await snapshot(hostContext);
            const guestState = await snapshot(guestContext);
            throw new Error(`${error.message}; host=${hostState}; guest=${guestState}`);
        }
        await evaluate(bidi, hostContext, `document.querySelector('[data-start-game]')?.click(); true`);
        const gameVisible = `document.querySelector('#roomMount')?.style.display === 'none' && document.querySelector('#gameMount')?.style.display === 'block' && document.querySelector('#gameMount')?.dataset.gameType === 'gobang' && Boolean(document.querySelector('#gameMount')?.firstElementChild)`;
        await waitForCondition(bidi, hostContext, gameVisible, '房主游戏界面', 20000);
        await waitForCondition(bidi, guestContext, gameVisible, '成员游戏界面', 20000);
        const fatal = `document.querySelector('#fatalErrorBox')?.style.display !== 'none'`;
        if (await evaluate(bidi, hostContext, fatal) || await evaluate(bidi, guestContext, fatal)) throw new Error('多人房间生命周期出现前端致命错误');
        const guestPlayerId = await evaluate(bidi, guestContext, `document.querySelector('#roomPageIdentity')?.textContent.replace(/^玩家 ID\\s*/, '') || ''`);
        if (!guestPlayerId) throw new Error('成员游戏界面没有显示玩家 ID');
        await evaluate(bidi, hostContext, `document.querySelector('#gameMount .gobang-cell:not([disabled])')?.click(); true`);
        const occupiedBoard = `document.querySelectorAll('#gameMount .gobang-cell.is-occupied').length >= 1`;
        await waitForCondition(bidi, hostContext, occupiedBoard, '房主核心落子');
        await waitForCondition(bidi, guestContext, occupiedBoard, '成员收到核心落子');

        // Terminate the newest socket in this room to model a real transport
        // drop. The guest tab is created after the host, so its socket is the
        // newest room client; the browser must reconnect with its session token
        // and the room must pause until that same seat returns.
        const roomClients = [...(wss?.clients || [])].filter(client => client.roomId === roomId && client.readyState === WebSocket.OPEN);
        if (roomClients.length !== 2) throw new Error(`断线重连前应有 2 个房间连接，实际 ${roomClients.length}`);
        roomClients.at(-1).terminate();
        await waitForCondition(
            bidi,
            hostContext,
            `document.querySelector('#roomConnectionState')?.hidden === false && document.querySelector('#roomConnectionState')?.textContent.includes('暂停')`,
            '网络断线后房间暂停',
            10000,
        );
        await waitForCondition(
            bidi,
            guestContext,
            `${gameVisible} && document.querySelector('#roomPageIdentity')?.textContent.endsWith(${JSON.stringify(guestPlayerId)}) && document.querySelector('#roomConnectionState')?.hidden === true`,
            '网络断线后成员自动重连恢复',
            20000,
        );
        await waitForCondition(bidi, hostContext, `document.querySelector('#roomConnectionState')?.hidden === true`, '网络断线后房间恢复', 20000);
        console.log(`transport reconnect: PASS (${guestPlayerId})`);

        await bidi.command('browsingContext.navigate', { context: guestContext, url: `http://127.0.0.1:${httpPort}/` });
        await waitForCondition(
            bidi,
            guestContext,
            `document.querySelector('#gameMount')?.style.display === 'block' && document.querySelector('#gameMount')?.dataset.gameType === 'gobang' && document.querySelector('#roomPageIdentity')?.textContent.endsWith(${JSON.stringify(guestPlayerId)})`,
            '成员刷新后恢复原座位和对局',
            20000,
        );
        await waitForCondition(bidi, hostContext, `document.querySelector('#roomConnectionState')?.hidden === true`, '房主看到房间恢复', 20000);
        await evaluate(bidi, guestContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('#roomView')?.style.display === 'none' && document.querySelector('#lobbyView')?.style.display === 'grid'`, '成员离开房间');
        const releasedGameMount = `document.querySelector('#gameMount')?.style.display === 'none' && document.querySelector('#gameMount')?.innerHTML === '' && !document.querySelector('#gameMount')?.dataset.gameType`;
        await waitForCondition(bidi, guestContext, releasedGameMount, '成员释放游戏资源');
        await evaluate(bidi, hostContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, hostContext, `document.querySelector('#roomView')?.style.display === 'none' && document.querySelector('#lobbyView')?.style.display === 'grid'`, '房主清理房间');
        await waitForCondition(bidi, hostContext, releasedGameMount, '房主释放游戏资源');

        // A second short flow verifies that an invite-only room stays out of
        // the public catalog while remaining joinable with its six-digit code.
        await click('#gamePicker [data-game-type="gobang"]');
        await waitForCondition(bidi, hostContext, `document.querySelector('#createRoomDialog')?.hidden === false`, '私密房间规则页');
        await click('#createRoomNextBtn');
        await waitForCondition(bidi, hostContext, `document.querySelector('#createRoomDialog')?.classList.contains('is-settings')`, '私密房间设置页');
        await evaluate(bidi, hostContext, `(() => {
            const name = document.querySelector('#createRoomName');
            const privateChoice = document.querySelector('#createRoomForm input[name="isPublic"][value="false"]');
            if (name) name.value = '浏览器私密房间验收';
            if (privateChoice) privateChoice.checked = true;
            document.querySelector('#createRoomForm')?.requestSubmit();
            return true;
        })()`);
        await waitForCondition(
            bidi,
            hostContext,
            `document.querySelector('#roomView')?.style.display === 'block' && Boolean(document.querySelector('#roomMount .pregame-room[data-game-type="gobang"]'))`,
            '私密房间等待页',
        );
        const privateRoomId = await evaluate(
            bidi,
            hostContext,
            `document.querySelector('#roomPageCode')?.textContent.match(/\\b\\d{6}\\b/)?.[0] || ''`,
        );
        if (!/^\d{6}$/.test(privateRoomId)) throw new Error('私密房间没有可用房间号');
        await bidi.command('browsingContext.navigate', { context: guestContext, url: `http://127.0.0.1:${httpPort}/` });
        await waitForCondition(bidi, guestContext, `document.querySelector('#entryConnectionStatus')?.textContent.includes('已连接')`, '私密房间成员大厅连接');
        await evaluate(bidi, guestContext, `document.querySelector('#entryJoinBtn')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('#joinLobbyView')?.style.display === 'block'`, '私密房间找房大厅');
        await wait(500);
        const appearsPublicly = await evaluate(bidi, guestContext, `document.querySelector('#joinLobbyRoomList')?.textContent.includes(${JSON.stringify(privateRoomId)})`);
        if (appearsPublicly) throw new Error(`私密房间 ${privateRoomId} 出现在公开房间列表`);
        await evaluate(bidi, guestContext, `(() => {
            const input = document.querySelector('#joinLobbyCodeInput');
            if (input) {
                input.value = ${JSON.stringify(privateRoomId)};
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            document.querySelector('#joinLobbyCodeForm')?.requestSubmit();
            return true;
        })()`);
        await waitForCondition(
            bidi,
            guestContext,
            `document.querySelector('#roomView')?.style.display === 'block' && Boolean(document.querySelector('#roomMount .pregame-room[data-game-type="gobang"]'))`,
            '私密房间按房间号加入',
        );
        await evaluate(bidi, guestContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('#roomView')?.style.display === 'none'`, '私密房间成员离开');
        await evaluate(bidi, hostContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, hostContext, `document.querySelector('#roomView')?.style.display === 'none'`, '私密房间房主清理');
    } finally {
        try { await bidi.command('browsingContext.close', { context: guestContext }); } catch {}
    }
    return { roomId };
}

async function runPrivacyAndInputChecks(bidi, context, httpPort) {
    const evaluateJson = expression => evaluate(bidi, context, `JSON.stringify(${expression})`).then(raw => {
        try { return JSON.parse(raw || 'null'); } catch { return null; }
    });
    const identityFixtures = [
        { game: 'werewolf', hold: '[data-role-hold]', secret: '[data-role-secret]', scope: '.social-role-focus' },
        { game: 'avalon', hold: '[data-role-hold]', secret: '[data-role-secret]', scope: '.social-role-focus' },
        { game: 'witchtown', hold: '[data-dossier-hold]', secret: '[data-dossier-secret]', scope: '.witchtown-dossier-stack' },
        { game: 'coup', hold: '[data-identity-hold]', secret: '[data-private-identity]', scope: '.cp-private' },
    ];
    const readIdentity = fixture => evaluateJson(`(() => {
        const hold = document.querySelector(${JSON.stringify(fixture.hold)});
        const scope = hold?.closest(${JSON.stringify(fixture.scope)});
        const secrets = [...document.querySelectorAll(${JSON.stringify(fixture.secret)})];
        return {
            holdCount: document.querySelectorAll(${JSON.stringify(fixture.hold)}).length,
            holdVisible: Boolean(hold && getComputedStyle(hold).display !== 'none' && hold.getBoundingClientRect().width > 0 && hold.getBoundingClientRect().height > 0),
            pressed: hold?.getAttribute('aria-pressed') || '',
            secretCount: secrets.length,
            secretHidden: secrets.length > 0 && secrets.every(element => element.getAttribute('aria-hidden') === 'true'),
            secretScope: Boolean(scope),
            scopeCount: document.querySelectorAll(${JSON.stringify(fixture.scope)}).length,
        };
    })()`);
    const requireIdentity = (fixture, state, label) => {
        if (!state || state.holdCount !== 1 || !state.holdVisible || state.secretCount < 1 || !state.secretHidden || !state.secretScope || state.scopeCount !== 1 || state.pressed !== 'false') {
            throw new Error(`${fixture.game} ${label} 身份隔离失败：${JSON.stringify(state)}`);
        }
    };
    const readHanabi = () => evaluateJson(`(() => {
        const own = [...document.querySelectorAll('.hb-my-hand .hb-hidden-card')];
        const teammates = [...document.querySelectorAll('.hb-teammates .hb-public-card')];
        const publicFronts = teammates.filter(card => !card.classList.contains('hb-public-card-back'));
        return {
            ownCount: own.length,
            ownBacks: own.length > 0 && own.every(card => card.querySelector('.hb-card-back') && !card.querySelector('.hb-public-card')),
            ownReadable: own.length > 0 && own.every(card => card.getAttribute('aria-disabled') === 'false' && card.type === 'button'),
            publicFronts: publicFronts.length,
            leakedOwnFront: own.some(card => card.querySelector('.hb-public-card:not(.hb-public-card-back)')),
        };
    })()`);
    const interactIdentity = fixture => evaluateJson(`(() => {
        const hold = document.querySelector(${JSON.stringify(fixture.hold)});
        const secretSelector = ${JSON.stringify(fixture.secret)};
        const state = () => ({
            pressed: hold?.getAttribute('aria-pressed') || '',
            hidden: [...document.querySelectorAll(secretSelector)].every(element => element.getAttribute('aria-hidden') === 'true'),
        });
        const before = state();
        hold?.focus();
        hold?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        const keyDown = state();
        hold?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        const keyUp = state();
        if (hold) hold.setPointerCapture = () => {};
        hold?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerDown = state();
        document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerUp = state();
        if (hold) hold.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const blurBefore = state();
        window.dispatchEvent(new Event('blur'));
        const blurAfter = state();
        return { before, keyDown, keyUp, pointerDown, pointerUp, blurBefore, blurAfter };
    })()`);
    for (const fixture of identityFixtures) {
        await bidi.command('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 } });
        await bidi.command('browsingContext.navigate', { context, url: `http://127.0.0.1:${httpPort}/__game_shell_visual_test.html?game=${fixture.game}` });
        await waitForCondition(bidi, context, `document.documentElement.dataset.shellTest === 'passed'`, `${fixture.game} 隐私视图`, 15000);
        const initial = await readIdentity(fixture);
        requireIdentity(fixture, initial, '初始');
        const interaction = await interactIdentity(fixture);
        const keyRevealed = interaction.keyDown.pressed === 'true' && interaction.keyDown.hidden === false;
        const keyResealed = interaction.keyUp.pressed === 'false' && interaction.keyUp.hidden === true;
        const pointerRevealed = interaction.pointerDown.pressed === 'true' && interaction.pointerDown.hidden === false;
        const pointerResealed = interaction.pointerUp.pressed === 'false' && interaction.pointerUp.hidden === true;
        const blurResealed = interaction.blurBefore.pressed === 'true' && interaction.blurAfter.pressed === 'false' && interaction.blurAfter.hidden === true;
        if (!keyRevealed || !keyResealed || !pointerRevealed || !pointerResealed || !blurResealed) {
            throw new Error(`${fixture.game} 键盘/触屏身份收束失败：${JSON.stringify(interaction)}`);
        }
        console.log(`privacy/input: ${fixture.game} · hidden → keyboard/touch reveal → reseal`);
    }

    await bidi.command('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 } });
    await bidi.command('browsingContext.navigate', { context, url: `http://127.0.0.1:${httpPort}/__game_shell_visual_test.html?game=hanabi` });
    await waitForCondition(bidi, context, `document.documentElement.dataset.shellTest === 'passed'`, '花火隐私视图', 15000);
    const hanabi = await readHanabi();
    if (!hanabi || hanabi.ownCount !== 4 || !hanabi.ownBacks || !hanabi.ownReadable || hanabi.publicFronts < 1 || hanabi.leakedOwnFront) {
        throw new Error(`hanabi 牌面隔离失败：${JSON.stringify(hanabi)}`);
    }
    console.log('privacy/input: hanabi · own hand backs/private knowledge and teammate fronts separated');

    await bidi.command('browsingContext.navigate', { context, url: `http://127.0.0.1:${httpPort}/__game_shell_visual_test.html?game=decrypto&decryptoState=code` });
    await waitForCondition(bidi, context, `document.documentElement.dataset.shellTest === 'passed'`, '谍报风云隐私视图', 15000);
    const decrypto = await evaluateJson(`(() => {
        const code = document.querySelector('[data-secret-code]');
        const codeHold = document.querySelector('[data-code-hold]');
        const keywords = document.querySelector('[data-role="keywords"]');
        const keywordsCover = document.querySelector('[data-secret-toggle="keywords"]');
        return {
            codeCount: document.querySelectorAll('[data-secret-code]').length,
            codeHidden: Boolean(code && !code.classList.contains('is-revealed')),
            codeHoldVisible: Boolean(codeHold && getComputedStyle(codeHold).display !== 'none' && codeHold.getBoundingClientRect().width > 0),
            keywordsHidden: Boolean(keywords && !keywords.classList.contains('is-revealed')),
            keywordsCover: Boolean(keywordsCover && keywordsCover.getAttribute('aria-pressed') === 'false'),
        };
    })()`);
    if (!decrypto || decrypto.codeCount !== 1 || !decrypto.codeHidden || !decrypto.codeHoldVisible || !decrypto.keywordsHidden || !decrypto.keywordsCover) {
        throw new Error(`decrypto 初始隐私隔离失败：${JSON.stringify(decrypto)}`);
    }
    const decryptoInteraction = await evaluateJson(`(() => {
        const hold = document.querySelector('[data-code-hold]');
        const code = document.querySelector('[data-secret-code]');
        const keywords = document.querySelector('[data-role="keywords"]');
        const keywordCover = () => document.querySelector('[data-secret-toggle="keywords"]');
        const state = () => ({ codeVisible: Boolean(code?.classList.contains('is-revealed')), keywordsVisible: Boolean(keywords?.classList.contains('is-revealed')) });
        const before = state();
        hold?.focus();
        hold?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        const keyDown = state();
        hold?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        const keyUp = state();
        if (hold) hold.setPointerCapture = () => {};
        hold?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 51, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerDown = state();
        hold?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 51, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerUp = state();
        keywordCover()?.click();
        const keywordsClick = state();
        window.dispatchEvent(new Event('blur'));
        const blur = state();
        return { before, keyDown, keyUp, pointerDown, pointerUp, keywordsClick, blur };
    })()`);
    const decryptoInputPassed = decryptoInteraction
        && !decryptoInteraction.before.codeVisible
        && decryptoInteraction.keyDown.codeVisible
        && !decryptoInteraction.keyUp.codeVisible
        && decryptoInteraction.pointerDown.codeVisible
        && !decryptoInteraction.pointerUp.codeVisible
        && decryptoInteraction.keywordsClick.keywordsVisible
        && !decryptoInteraction.blur.codeVisible
        && !decryptoInteraction.blur.keywordsVisible;
    if (!decryptoInputPassed) throw new Error(`decrypto 键盘/触屏/失焦收束失败：${JSON.stringify(decryptoInteraction)}`);
    console.log('privacy/input: decrypto · keyword vault/code hidden and resealed on keyboard, touch, blur');
}

async function readFixture(bidi, context) {
    const raw = await evaluate(bidi, context, `JSON.stringify({
        metric: document.querySelector('#shellTestMetrics')?.textContent || '',
        status: document.documentElement.dataset.shellTest || '',
        errors: window.__shellTestRuntimeErrors || [],
    })`);
    try { return JSON.parse(raw); } catch { return { metric: String(raw || ''), status: '', errors: [] }; }
}

async function run() {
    const app = require(path.join(root, 'app'));
    const server = http.createServer(app);
    const wss = app.startWebSocketServer(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const httpPort = server.address().port;
    const bidiPort = await findFreePort();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jsgames-browser-runtime-'));
    const firefox = spawn(process.env.FIREFOX_BIN || 'firefox', [
        '--headless', '--no-remote', '--profile', profile,
        '--remote-debugging-port', String(bidiPort), 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let bidi;
    let context;
    const failures = [];
    const fixtureFailures = [];
    try {
        const firefoxError = new Promise((_, reject) => {
            firefox.once('error', reject);
            firefox.once('exit', (code, signal) => {
                if (code !== null && code !== 0) reject(new Error(`Firefox 提前退出（code=${code}, signal=${signal || 'none'}）`));
            });
        });
        // Promise.race settles on the port probe in the normal case; keep a
        // rejection handler on the other branch so a later browser shutdown
        // cannot become an unhandled rejection.
        firefoxError.catch(() => {});
        await Promise.race([waitForPort(bidiPort), firefoxError]);
        bidi = await connectBidi(bidiPort);
        ({ context } = await bidi.command('browsingContext.create', { type: 'tab' }));
        await bidi.command('browsingContext.navigate', { context, url: `http://127.0.0.1:${httpPort}/` });

        const importResult = await evaluate(bidi, context, `(async () => JSON.stringify(await Promise.all(${JSON.stringify(clientPaths)}.map(async path => {
            try { await import(path + '?browser-runtime-smoke=20260828'); return { path, ok: true }; }
            catch (error) { return { path, ok: false, error: error.message }; }
        }))))()`);
        const imports = JSON.parse(importResult || '[]');
        imports.filter(item => !item.ok).forEach(item => failures.push(`module ${item.path}: ${item.error}`));
        console.log(`browser imports: ${imports.filter(item => item.ok).length}/${imports.length}`);

        const lifecycle = await runLobbyLifecycle(bidi, context, httpPort, wss);
        console.log(`lobby lifecycle: PASS (${lifecycle.roomId})`);

        await runPrivacyAndInputChecks(bidi, context, httpPort);

        for (const game of games) for (const [width, height] of sizes) {
            await bidi.command('browsingContext.setViewport', { context, viewport: { width, height } });
            await bidi.command('browsingContext.navigate', {
                context,
                url: `http://127.0.0.1:${httpPort}/__game_shell_visual_test.html?game=${game}`,
            });
            let result = { metric: '', status: '', errors: [] };
            for (let attempt = 0; attempt < 70; attempt += 1) {
                await wait(80);
                result = await readFixture(bidi, context);
                if (result.status) break;
            }
            if (result.status !== 'passed' || result.errors.length) {
                const failure = `${game} ${width}x${height}: ${result.metric || 'fixture timeout'}${result.errors.length ? `; ${result.errors.join('; ')}` : ''}`;
                failures.push(failure);
                fixtureFailures.push(failure);
            }
        }
        const total = games.length * sizes.length;
        console.log(`visual fixture: ${total - fixtureFailures.length}/${total}`);
        if (failures.length) {
            console.error(failures.map(item => `- ${item}`).join('\n'));
            process.exitCode = 1;
        } else {
            console.log('browser runtime smoke: PASS');
        }
    } finally {
        if (bidi) await bidi.close(context);
        firefox.kill('SIGTERM');
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    }
}

run().catch(error => {
    console.error(`browser runtime smoke: ERROR · ${error.message}`);
    process.exitCode = 1;
});
