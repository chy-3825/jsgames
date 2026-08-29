'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const WebSocket = require('ws');

const { createRealtimeServer } = require('../server/realtime/create-realtime-server');

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

function openClient(port) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
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

test('realtime server factories keep rooms, sessions, IDs, and ticks isolated', async t => {
    const first = createRealtimeServer({ reconnectGraceMs: 20 });
    const second = createRealtimeServer({ reconnectGraceMs: 20 });
    const firstHttp = http.createServer();
    const secondHttp = http.createServer();
    const firstWss = first.startWebSocketServer(firstHttp);
    const secondWss = second.startWebSocketServer(secondHttp);
    await Promise.all([listen(firstHttp), listen(secondHttp)]);
    const clients = [];
    t.after(async () => {
        await Promise.all(clients.map(client => client.closeCleanly()));
        await Promise.all([first.close(), second.close()]);
        await Promise.all([closeHttp(firstHttp), closeHttp(secondHttp)]);
        // Direct WebSocket close is intentionally safe as well; this also
        // documents the returned handles used by existing integrations.
        if (firstWss.readyState === WebSocket.CLOSED) assert.equal(first.getStats().rooms, 0);
        if (secondWss.readyState === WebSocket.CLOSED) assert.equal(second.getStats().rooms, 0);
    });

    const [left, right] = await Promise.all([
        openClient(firstHttp.address().port),
        openClient(secondHttp.address().port),
    ]);
    clients.push(left, right);
    await Promise.all([
        left.waitFor(message => message.type === 'session'),
        right.waitFor(message => message.type === 'session'),
    ]);
    left.sendJson({ type: 'createRoom', gameType: 'loveletter', roomName: '左侧房间', isPublic: false });
    right.sendJson({ type: 'createRoom', gameType: 'loveletter', roomName: '右侧房间', isPublic: false });
    const [leftRoom, rightRoom] = await Promise.all([
        left.waitFor(message => message.type === 'roomCreated'),
        right.waitFor(message => message.type === 'roomCreated'),
    ]);

    assert.equal(leftRoom.roomId, '000001');
    assert.equal(rightRoom.roomId, '000001');
    assert.equal(first.getStats().rooms, 1);
    assert.equal(second.getStats().rooms, 1);
    assert.equal(first.getStats().players, 1);
    assert.equal(second.getStats().players, 1);
    assert.equal(leftRoom.room.roomName, '左侧房间');
    assert.equal(rightRoom.room.roomName, '右侧房间');
});

