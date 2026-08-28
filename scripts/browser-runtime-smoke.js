#!/usr/bin/env node

/**
 * Repeatable browser-level smoke test for the modular game clients.
 *
 * The script starts an in-process HTTP/WebSocket server, launches a temporary
 * headless Firefox WebDriver BiDi session, imports every client module, then
 * runs a two-tab room lifecycle smoke test and renders the shared visual
 * fixture at the supported desktop/mobile sizes. It intentionally does not
 * replace real-player acceptance; it catches failed imports, uncaught browser
 * exceptions and the most important viewport fit regressions before a release.
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

async function runLobbyLifecycle(bidi, hostContext, httpPort) {
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
        await evaluate(bidi, guestContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, guestContext, `document.querySelector('#roomView')?.style.display === 'none' && document.querySelector('#lobbyView')?.style.display === 'grid'`, '成员离开房间');
        await evaluate(bidi, hostContext, `document.querySelector('#leaveRoomBtn')?.click(); true`);
        await waitForCondition(bidi, hostContext, `document.querySelector('#roomView')?.style.display === 'none' && document.querySelector('#lobbyView')?.style.display === 'grid'`, '房主清理房间');
    } finally {
        try { await bidi.command('browsingContext.close', { context: guestContext }); } catch {}
    }
    return { roomId };
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
    app.startWebSocketServer(server);
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

        const lifecycle = await runLobbyLifecycle(bidi, context, httpPort);
        console.log(`lobby lifecycle: PASS (${lifecycle.roomId})`);

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
