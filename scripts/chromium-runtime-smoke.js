#!/usr/bin/env node

/**
 * Optional Chromium companion to browser-runtime-smoke.js.
 *
 * Firefox remains the default browser gate because it is available in the
 * repository's CI image. This companion uses Chromium's local DevTools
 * Protocol and covers the same first-party module imports, representative
 * mobile/desktop fixtures, and privacy/input checks when a Chromium binary is
 * supplied through CHROMIUM_BIN or CHROME_BIN.
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
const sizes = [[1280, 900], [390, 844], [844, 390]];
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

function browserCandidates() {
    return [
        process.env.CHROMIUM_BIN,
        process.env.CHROME_BIN,
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
    ].filter(Boolean);
}

function findBrowser() {
    return browserCandidates().find(candidate => {
        try { return fs.statSync(candidate).isFile() && (fs.accessSync(candidate, fs.constants.X_OK), true); } catch { return false; }
    });
}

function httpJson(port, resourcePath) {
    return new Promise((resolve, reject) => {
        const request = http.get(`http://127.0.0.1:${port}${resourcePath}`, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
            });
        });
        request.setTimeout(1000, () => request.destroy(new Error('Chromium DevTools HTTP timeout')));
        request.on('error', reject);
    });
}

class CdpSession {
    constructor(socket) {
        this.socket = socket;
        this.requestId = 0;
        this.pending = new Map();
        socket.on('message', raw => {
            const message = JSON.parse(raw.toString());
            if (!message.id) return;
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message || 'Chromium DevTools command failed'));
            else pending.resolve(message.result);
        });
        socket.on('close', () => {
            for (const pending of this.pending.values()) pending.reject(new Error('Chromium DevTools socket closed'));
            this.pending.clear();
        });
    }

    command(method, params = {}) {
        const id = ++this.requestId;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Chromium page evaluation failed');
        return result?.result?.value;
    }

    async close() {
        try { await this.command('Browser.close'); } catch {}
        try { this.socket.close(); } catch {}
    }
}

async function connectPage(debugPort) {
    let page;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const targets = await httpJson(debugPort, '/json/list');
            page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
            if (page) break;
        } catch {}
        await wait(100);
    }
    if (!page) throw new Error('Chromium 页面未出现在 DevTools 目标列表');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });
    const session = new CdpSession(socket);
    await session.command('Runtime.enable');
    await session.command('Page.enable');
    return session;
}

async function waitForCondition(cdp, expression, label, timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (await cdp.evaluate(expression)) return;
        await wait(100);
    }
    throw new Error(`${label} 在 ${timeout}ms 内未完成`);
}

async function navigate(cdp, url) {
    await cdp.command('Page.navigate', { url });
    await waitForCondition(cdp, `document.readyState === 'complete'`, 'Chromium 页面加载', 10000);
}

async function runImports(cdp) {
    const raw = await cdp.evaluate(`(async () => JSON.stringify(await Promise.all(${JSON.stringify(clientPaths)}.map(async path => {
        try { await import(path + '?chromium-runtime-smoke=20260828'); return { path, ok: true }; }
        catch (error) { return { path, ok: false, error: error.message }; }
    }))))()`);
    const imports = JSON.parse(raw || '[]');
    const failures = imports.filter(item => !item.ok);
    if (failures.length) throw new Error(`Chromium 模块导入失败：${failures.map(item => `${item.path}: ${item.error}`).join('; ')}`);
    console.log(`chromium imports: ${imports.length}/${imports.length}`);
}

async function runIdentityFixture(cdp, baseUrl, fixture) {
    await navigate(cdp, `${baseUrl}/__game_shell_visual_test.html?game=${fixture.game}`);
    await waitForCondition(cdp, `document.documentElement.dataset.shellTest === 'passed'`, `${fixture.game} Chromium 视图`, 15000);
    const result = await cdp.evaluate(`(() => {
        const hold = document.querySelector(${JSON.stringify(fixture.hold)});
        const scope = hold?.closest(${JSON.stringify(fixture.scope)});
        const secretSelector = ${JSON.stringify(fixture.secret)};
        const secrets = [...document.querySelectorAll(secretSelector)];
        const state = () => ({ pressed: hold?.getAttribute('aria-pressed') || '', hidden: secrets.every(element => element.getAttribute('aria-hidden') === 'true') });
        const initial = { hold: Boolean(hold && scope), visible: Boolean(hold && getComputedStyle(hold).display !== 'none' && hold.getBoundingClientRect().width > 0), hidden: secrets.length > 0 && secrets.every(element => element.getAttribute('aria-hidden') === 'true') };
        hold?.focus();
        hold?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        const keyDown = state();
        hold?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        const keyUp = state();
        if (hold) hold.setPointerCapture = () => {};
        hold?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 81, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerDown = state();
        document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 81, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerUp = state();
        hold?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 82, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        window.dispatchEvent(new Event('blur'));
        const blur = state();
        return { initial, keyDown, keyUp, pointerDown, pointerUp, blur, errors: window.__shellTestRuntimeErrors || [] };
    })()`);
    const passed = result?.initial?.hold && result.initial.visible && result.initial.hidden
        && result.keyDown.pressed === 'true' && !result.keyDown.hidden
        && result.keyUp.pressed === 'false' && result.keyUp.hidden
        && result.pointerDown.pressed === 'true' && !result.pointerDown.hidden
        && result.pointerUp.pressed === 'false' && result.pointerUp.hidden
        && result.blur.pressed === 'false' && result.blur.hidden && !result.errors.length;
    if (!passed) throw new Error(`Chromium ${fixture.game} 隐私/输入检查失败：${JSON.stringify(result)}`);
    console.log(`chromium privacy/input: ${fixture.game} · keyboard/touch/blur reseal`);
}

async function runHanabiAndDecrypto(cdp, baseUrl) {
    await navigate(cdp, `${baseUrl}/__game_shell_visual_test.html?game=hanabi`);
    await waitForCondition(cdp, `document.documentElement.dataset.shellTest === 'passed'`, '花火 Chromium 视图', 15000);
    const hanabi = await cdp.evaluate(`(() => {
        const own = [...document.querySelectorAll('.hb-my-hand .hb-hidden-card')];
        const teammates = [...document.querySelectorAll('.hb-teammates .hb-public-card')];
        return { own: own.length, ownBacks: own.every(card => card.querySelector('.hb-card-back') && !card.querySelector('.hb-public-card')), ownButtons: own.every(card => card.type === 'button'), publicFronts: teammates.filter(card => !card.classList.contains('hb-public-card-back')).length, errors: window.__shellTestRuntimeErrors || [] };
    })()`);
    if (!hanabi || hanabi.own !== 4 || !hanabi.ownBacks || !hanabi.ownButtons || hanabi.publicFronts < 1 || hanabi.errors.length) throw new Error(`Chromium 花火隐私检查失败：${JSON.stringify(hanabi)}`);
    console.log('chromium privacy/input: hanabi · own backs and teammate fronts separated');

    await navigate(cdp, `${baseUrl}/__game_shell_visual_test.html?game=decrypto&decryptoState=code`);
    await waitForCondition(cdp, `document.documentElement.dataset.shellTest === 'passed'`, '谍报风云 Chromium 视图', 15000);
    const decrypto = await cdp.evaluate(`(() => {
        const hold = document.querySelector('[data-code-hold]');
        const code = document.querySelector('[data-secret-code]');
        const keywords = document.querySelector('[data-role="keywords"]');
        const keywordCover = () => document.querySelector('[data-secret-toggle="keywords"]');
        const state = () => ({ code: code?.classList.contains('is-revealed') || false, keywords: keywords?.classList.contains('is-revealed') || false });
        const initial = state();
        hold?.focus();
        hold?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        const keyDown = state();
        hold?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        const keyUp = state();
        if (hold) hold.setPointerCapture = () => {};
        hold?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerDown = state();
        hold?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
        const pointerUp = state();
        keywordCover()?.click();
        const keywordOpen = state();
        window.dispatchEvent(new Event('blur'));
        const blur = state();
        return { initial, keyDown, keyUp, pointerDown, pointerUp, keywordOpen, blur, errors: window.__shellTestRuntimeErrors || [] };
    })()`);
    const passed = decrypto?.initial && !decrypto.initial.code && !decrypto.initial.keywords
        && decrypto.keyDown.code && !decrypto.keyUp.code && decrypto.pointerDown.code && !decrypto.pointerUp.code
        && decrypto.keywordOpen.keywords && !decrypto.blur.code && !decrypto.blur.keywords && !decrypto.errors.length;
    if (!passed) throw new Error(`Chromium 谍报风云隐私/输入检查失败：${JSON.stringify(decrypto)}`);
    console.log('chromium privacy/input: decrypto · keyword vault/code reseal');
}

async function runVisualMatrix(cdp, baseUrl) {
    let passed = 0;
    const total = games.length * sizes.length;
    for (const game of games) for (const [width, height] of sizes) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < height });
        await navigate(cdp, `${baseUrl}/__game_shell_visual_test.html?game=${game}`);
        await waitForCondition(cdp, `document.documentElement.dataset.shellTest === 'passed'`, `Chromium ${game} ${width}x${height}`, 15000);
        const errors = await cdp.evaluate('window.__shellTestRuntimeErrors || []');
        if (errors.length) throw new Error(`Chromium ${game} ${width}x${height} 运行时错误：${errors.join('; ')}`);
        passed += 1;
    }
    console.log(`chromium visual fixture: ${passed}/${total}`);
}

async function closeServer(server, wss) {
    try { await new Promise(resolve => wss?.close(() => resolve())); } catch {}
    if (server.listening) await new Promise(resolve => server.close(() => resolve()));
}

async function run() {
    const browser = findBrowser();
    if (!browser) {
        console.error('chromium runtime smoke: Chromium not found; set CHROMIUM_BIN or CHROME_BIN to run this optional gate');
        process.exitCode = 2;
        return;
    }
    const app = require(path.join(root, 'app'));
    const server = http.createServer(app);
    const wss = app.startWebSocketServer(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const httpPort = server.address().port;
    const debugPort = await findFreePort();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jsgames-chromium-runtime-'));
    const chrome = spawn(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, `http://127.0.0.1:${httpPort}/`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    let cdp;
    try {
        cdp = await connectPage(debugPort);
        const baseUrl = `http://127.0.0.1:${httpPort}`;
        await waitForCondition(cdp, `document.querySelector('#entryConnectionStatus')?.textContent.includes('已连接')`, 'Chromium 大厅连接', 15000);
        await runImports(cdp);
        await runIdentityFixture(cdp, baseUrl, { game: 'werewolf', hold: '[data-role-hold]', secret: '[data-role-secret]', scope: '.social-role-focus' });
        await runIdentityFixture(cdp, baseUrl, { game: 'avalon', hold: '[data-role-hold]', secret: '[data-role-secret]', scope: '.social-role-focus' });
        await runIdentityFixture(cdp, baseUrl, { game: 'witchtown', hold: '[data-dossier-hold]', secret: '[data-dossier-secret]', scope: '.witchtown-dossier-stack' });
        await runIdentityFixture(cdp, baseUrl, { game: 'coup', hold: '[data-identity-hold]', secret: '[data-private-identity]', scope: '.cp-private' });
        await runHanabiAndDecrypto(cdp, baseUrl);
        await runVisualMatrix(cdp, baseUrl);
        console.log('chromium runtime smoke: PASS');
    } finally {
        await cdp?.close();
        chrome.kill('SIGTERM');
        await closeServer(server, wss);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    }
}

run().catch(error => {
    console.error(`chromium runtime smoke: ERROR · ${error.message}`);
    process.exitCode = 1;
});
