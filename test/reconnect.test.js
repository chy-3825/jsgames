const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const WebSocket = require('ws');

const app = require('../app');

function waitForServer(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
}

function closeServer(server) {
    return new Promise(resolve => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
    });
}

function openClient(url) {
    const socket = new WebSocket(url);
    const messages = [];
    const waiters = [];
    let closed = false;

    socket.waitFor = (predicate, timeout = 2000) => {
        const queuedIndex = messages.findIndex(predicate);
        if (queuedIndex >= 0) return Promise.resolve(messages.splice(queuedIndex, 1)[0]);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const index = waiters.findIndex(waiter => waiter.resolve === resolve);
                if (index >= 0) waiters.splice(index, 1);
                reject(new Error('等待 WebSocket 消息超时'));
            }, timeout);
            waiters.push({ predicate, resolve: value => { clearTimeout(timer); resolve(value); }, reject });
        });
    };
    socket.sendJson = payload => socket.send(JSON.stringify(payload));
    socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return; }
        const waiterIndex = waiters.findIndex(waiter => waiter.predicate(message));
        if (waiterIndex >= 0) {
            const waiter = waiters.splice(waiterIndex, 1)[0];
            waiter.resolve(message);
        } else messages.push(message);
    });
    socket.on('close', () => { closed = true; });
    socket.cleanup = () => {
        if (closed) return;
        socket.terminate();
    };
    return new Promise((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

test('断线玩家可按房间号和玩家 ID 恢复原座位，在线 ID 会被拒绝', async t => {
    const server = http.createServer(app);
    const wss = app.startWebSocketServer(server);
    await waitForServer(server);
    const url = `ws://127.0.0.1:${server.address().port}`;
    const clients = [];
    t.after(async () => {
        clients.forEach(client => client.cleanup());
        await new Promise(resolve => wss.close(() => resolve()));
        await closeServer(server);
    });

    const host = await openClient(url);
    clients.push(host);
    const hostSession = await host.waitFor(message => message.type === 'session');
    host.sendJson({ type: 'createRoom', gameType: 'loveletter', roomName: '重连测试房', isPublic: false });
    const created = await host.waitFor(message => message.type === 'roomCreated');

    const guest = await openClient(url);
    clients.push(guest);
    await guest.waitFor(message => message.type === 'session');
    guest.sendJson({ type: 'joinRoom', roomId: created.roomId });
    const joined = await guest.waitFor(message => message.type === 'joinSuccess');
    assert.equal(created.room.players.length, 1);
    assert.equal(joined.room.players.length, 2);

    assert.equal(joined.room.players.find(player => player.id === joined.playerId).ready, true);
    host.sendJson({ type: 'setReady', ready: false });
    const hostReadyError = await host.waitFor(message => message.type === 'error');
    assert.match(hostReadyError.message, /房主无需准备/);
    guest.sendJson({ type: 'setReady', ready: false });
    const unready = await host.waitFor(message => message.type === 'playerReady' && message.player.id === joined.playerId);
    assert.equal(unready.player.ready, false);
    host.sendJson({ type: 'startGame' });
    const blocked = await host.waitFor(message => message.type === 'error');
    assert.match(blocked.message, /所有成员准备/);
    guest.sendJson({ type: 'setReady', ready: true });
    const ready = await host.waitFor(message => message.type === 'playerReady' && message.player.id === joined.playerId);
    assert.equal(ready.player.ready, true);
    host.sendJson({ type: 'startGame' });
    await host.waitFor(message => message.type === 'gameStarted');
    await guest.waitFor(message => message.type === 'gameStarted');

    host.terminate();
    const paused = await guest.waitFor(message => message.type === 'roomPaused');
    assert.equal(paused.player.id, hostSession.playerId);
    assert.equal(paused.connectionState.paused, true);
    assert.equal(paused.connectionState.disconnected[0].id, hostSession.playerId);

    guest.sendJson({ type: 'gameAction', action: { kind: 'invalidWhilePaused' } });
    const pauseBlocked = await guest.waitFor(message => message.type === 'error' && message.message.includes('游戏暂时暂停'));
    assert.match(pauseBlocked.message, /等待重连/);

    const reconnecting = await openClient(url);
    clients.push(reconnecting);
    await reconnecting.waitFor(message => message.type === 'session');
    reconnecting.sendJson({ type: 'joinRoom', roomId: created.roomId });
    const required = await reconnecting.waitFor(message => message.type === 'reconnectRequired');
    assert.equal(required.roomId, created.roomId);
    reconnecting.sendJson({ type: 'reconnectRoom', roomId: created.roomId, playerId: hostSession.playerId });
    const restored = await reconnecting.waitFor(message => message.type === 'reconnectSuccess');
    assert.equal(restored.playerId, hostSession.playerId);
    assert.equal(restored.room.players.find(player => player.id === hostSession.playerId).seatIndex, 0);
    const resumed = await guest.waitFor(message => message.type === 'roomResumed');
    assert.equal(resumed.connectionState.paused, false);
    const restoredState = await reconnecting.waitFor(message => message.type === 'gameState');
    assert.equal(restoredState.state.roomConnection.paused, false);

    const duplicate = await openClient(url);
    clients.push(duplicate);
    await duplicate.waitFor(message => message.type === 'session');
    duplicate.sendJson({ type: 'reconnectRoom', roomId: created.roomId, playerId: joined.playerId });
    const duplicateResult = await duplicate.waitFor(message => message.type === 'reconnectFailed');
    assert.match(duplicateResult.message, /正在进行游戏/);
});
