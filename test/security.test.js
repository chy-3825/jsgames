'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const WebSocket = require('ws');

const app = require('../app');
const { createRealtimeServer } = require('../server/realtime/create-realtime-server');
const {
    consumeRateLimit,
    inspectJsonValue,
    isOriginAllowed,
    resolveSecurityPolicy,
    sanitizeChatMessage,
} = require('../server/realtime/security');

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

function closeHttp(server) {
    return new Promise(resolve => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
    });
}

function waitForClose(socket, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('等待 WebSocket 关闭超时')), timeout);
        socket.once('close', (code, reason) => {
            clearTimeout(timer);
            resolve({ code, reason: reason.toString() });
        });
        socket.once('error', () => {});
    });
}

function openClient(url, options) {
    const socket = new WebSocket(url, options);
    const messages = [];
    const waiters = [];
    socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return; }
        const index = waiters.findIndex(waiter => waiter.predicate(message));
        if (index < 0) messages.push(message);
        else {
            const waiter = waiters.splice(index, 1)[0];
            clearTimeout(waiter.timer);
            waiter.resolve(message);
        }
    });
    socket.waitFor = (predicate, timeout = 2000) => {
        const index = messages.findIndex(predicate);
        if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = {
                predicate,
                resolve,
                timer: setTimeout(() => {
                    const pending = waiters.indexOf(waiter);
                    if (pending >= 0) waiters.splice(pending, 1);
                    reject(new Error('等待 WebSocket 消息超时'));
                }, timeout),
            };
            waiters.push(waiter);
        });
    };
    socket.sendJson = payload => socket.send(JSON.stringify(payload));
    socket.closeCleanly = () => new Promise(resolve => {
        if (socket.readyState === WebSocket.CLOSED) return resolve();
        const timer = setTimeout(() => { socket.terminate(); resolve(); }, 1000);
        socket.once('close', () => { clearTimeout(timer); resolve(); });
        socket.close();
    });
    return new Promise((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

test('security policy bounds JSON shape, chat text and rate buckets', () => {
    const policy = resolveSecurityPolicy({ maxMessageDepth: 3, maxMessageKeys: 16, maxChatLength: 16 });
    assert.equal(inspectJsonValue({ a: { b: { c: 1 } } }, policy), true);
    assert.equal(inspectJsonValue({ a: { b: { c: { d: 1 } } } }, policy), false);
    assert.equal(inspectJsonValue(Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`key${index}`, index])), policy), false);
    assert.deepEqual(sanitizeChatMessage('  <b>hi</b>\u0000  ', 20), { ok: true, value: '<b>hi</b>' });
    assert.equal(sanitizeChatMessage('123456', 5).ok, false);
    const bucket = [];
    assert.equal(consumeRateLimit(bucket, 2, 1000, 100), true);
    assert.equal(consumeRateLimit(bucket, 2, 1000, 101), true);
    assert.equal(consumeRateLimit(bucket, 2, 1000, 102), false);
    assert.equal(consumeRateLimit(bucket, 2, 1000, 1101), true);
});

test('WebSocket rejects an unapproved Origin before creating a player', async t => {
    const realtime = createRealtimeServer({ allowedOrigins: ['https://table.example'] });
    const server = http.createServer();
    realtime.startWebSocketServer(server);
    await listen(server);
    t.after(async () => {
        await realtime.close();
        await closeHttp(server);
    });

    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}`, { origin: 'https://evil.example' });
    const error = await new Promise(resolve => socket.once('error', resolve));
    assert.match(error.message, /403/);
    assert.equal(realtime.getStats().players, 0);
    assert.equal(realtime.getStats().rejectedOrigins, 1);
    socket.terminate();
});

test('WebSocket maxPayload closes an oversized frame', async t => {
    const realtime = createRealtimeServer({ security: { maxPayload: 1024 } });
    const server = http.createServer();
    realtime.startWebSocketServer(server);
    await listen(server);
    t.after(async () => {
        await realtime.close();
        await closeHttp(server);
    });

    const socket = await openClient(`ws://127.0.0.1:${server.address().port}`);
    await socket.waitFor(message => message.type === 'session');
    const closed = waitForClose(socket);
    socket.send('x'.repeat(4096));
    const result = await closed;
    assert.ok([1006, 1009].includes(result.code));
    assert.equal(realtime.getStats().players, 0);
});

test('WebSocket rejects a connection burst after the per-IP limit', async t => {
    const realtime = createRealtimeServer({ security: { maxConnectionsPerIp: 1 } });
    const server = http.createServer();
    realtime.startWebSocketServer(server);
    await listen(server);
    const first = await openClient(`ws://127.0.0.1:${server.address().port}`);
    t.after(async () => {
        await first.closeCleanly();
        await realtime.close();
        await closeHttp(server);
    });
    await first.waitFor(message => message.type === 'session');
    const second = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    const error = await new Promise(resolve => second.once('error', resolve));
    assert.match(error.message, /429/);
    assert.equal(realtime.getStats().rejectedConnections, 1);
    second.terminate();
});

test('WebSocket closes a deeply nested or malformed JSON message', async t => {
    const realtime = createRealtimeServer({ security: { maxMessageDepth: 3 } });
    const server = http.createServer();
    realtime.startWebSocketServer(server);
    await listen(server);
    const socket = await openClient(`ws://127.0.0.1:${server.address().port}`);
    t.after(async () => {
        await socket.closeCleanly();
        await realtime.close();
        await closeHttp(server);
    });
    await socket.waitFor(message => message.type === 'session');
    const deeplyNested = { type: 'chat', message: { a: { b: { c: { d: 1 } } } } };
    const closed = waitForClose(socket);
    socket.send(JSON.stringify(deeplyNested));
    const result = await closed;
    assert.equal(result.code, 1008);
    assert.equal(realtime.getStats().rejectedMessages, 1);
});

test('chat input is normalized and chat flooding is rejected', async t => {
    const realtime = createRealtimeServer({ security: { chatRateLimit: 2, chatRateWindowMs: 10_000 } });
    const server = http.createServer();
    realtime.startWebSocketServer(server);
    await listen(server);
    const clients = [];
    t.after(async () => {
        await Promise.all(clients.map(client => client.closeCleanly()));
        await realtime.close();
        await closeHttp(server);
    });

    const sender = await openClient(`ws://127.0.0.1:${server.address().port}`);
    const observer = await openClient(`ws://127.0.0.1:${server.address().port}`);
    clients.push(sender, observer);
    await Promise.all([
        sender.waitFor(message => message.type === 'session'),
        observer.waitFor(message => message.type === 'session'),
    ]);
    sender.sendJson({ type: 'chat', message: '  <script>alert(1)</script>\u0000  ' });
    const chat = await observer.waitFor(message => message.type === 'chat');
    assert.equal(chat.message, '<script>alert(1)</script>');
    sender.sendJson({ type: 'chat', message: 'second' });
    await observer.waitFor(message => message.type === 'chat' && message.message === 'second');
    sender.sendJson({ type: 'chat', message: 'third' });
    const rejected = await sender.waitFor(message => message.type === 'error');
    assert.match(rejected.message, /频繁/);
});

test('HTTP health endpoint exposes service state and baseline security headers', async t => {
    const server = http.createServer(app);
    app.startWebSocketServer(server);
    await listen(server);
    t.after(async () => {
        await app.closeWebSocketServer();
        await closeHttp(server);
    });
    const response = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.address().port}/healthz`, result => {
            let body = '';
            result.setEncoding('utf8');
            result.on('data', chunk => { body += chunk; });
            result.on('end', () => resolve({ result, body }));
        }).on('error', reject);
    });
    assert.equal(response.result.statusCode, 200);
    assert.equal(response.result.headers['x-powered-by'], undefined);
    assert.equal(response.result.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.result.headers['x-frame-options'], 'SAMEORIGIN');
    assert.match(response.result.headers['content-security-policy'], /default-src 'self'/);
    assert.equal(response.result.headers['cache-control'], 'no-store');
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'jsgames');
    assert.equal(body.realtime.players, 0);
});

test('same-origin policy accepts the HTTP request origin and rejects a foreign one', () => {
    const request = { headers: { host: 'table.example', 'x-forwarded-proto': 'https' }, socket: {} };
    assert.equal(isOriginAllowed('https://table.example', request), true);
    assert.equal(isOriginAllowed('https://evil.example', request), false);
});
