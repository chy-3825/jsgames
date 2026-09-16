const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');

test('开局转场按在线人数匹配大厅火焰波数', () => {
    const room = new Room('default-timeline-room', 'host', '房主', 'gobang', {}, { readyCheckEnabled: true });
    room.addPlayer({ id: 'host', name: '房主', connected: true });
    room.addPlayer({ id: 'guest', name: '成员', connected: true });
    const transition = room.beginGameStart();

    assert.equal(Room.DEFAULT_GAME_ENTRY_DURATION_MS, 2800);
    assert.equal(Room.gameEntryDurationForPlayerCount(2), 1960);
    assert.equal(Room.gameEntryDurationForPlayerCount(4), 1960);
    assert.equal(Room.gameEntryDurationForPlayerCount(5), 2380);
    assert.equal(Room.gameEntryDurationForPlayerCount(8), 2800);
    assert.equal(Room.gameEntryDurationForPlayerCount(12), 2800);
    assert.equal(transition.entryTransition.durationMs, 1960);
    assert.equal(
        transition.entryTransition.gameVisibleAt - transition.entryTransition.entryStartsAt,
        1960,
    );
});

test('Room开局转场由服务端建立绝对截止时间并可被取消', () => {
    const room = new Room('timeline-room', 'host', '房主', 'gobang', {}, { readyCheckEnabled: true });
    room.addPlayer({ id: 'host', name: '房主', connected: true });
    room.addPlayer({ id: 'guest', name: '成员', connected: true });
    const transition = room.beginGameStart({ durationMs: 1200, transitionId: 'timeline-1' });
    assert.equal(transition.success, true);
    assert.equal(room.status, 'starting');
    assert.equal(room.getInfo().entryTransition.transitionId, 'timeline-1');
    assert.equal(room.getInfo().entryTransition.gameVisibleAt - transition.entryTransition.entryStartsAt, 1200);
    assert.equal(room.beginGameStart().success, false);
    assert.equal(room.cancelGameStartTransition(), true);
    assert.equal(room.status, 'waiting');
    assert.equal(room.getInfo().entryTransition, null);
});

test('客户端传输按顺序消费共享开局快照', async () => {
    const { createLobbyTransport } = await import('../public/lobby/transport.js');
    class FakeWebSocket {
        static OPEN = 1;
        constructor(url) { this.url = url; this.readyState = FakeWebSocket.OPEN; }
        send() {}
        emit(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    }
    const seen = [];
    const transport = createLobbyTransport({
        getUrl: () => 'ws://test',
        WebSocketImpl: FakeWebSocket,
        onMessage: async data => {
            seen.push(`${data.type}:start`);
            await new Promise(resolve => setTimeout(resolve, data.type === 'gameStarting' ? 8 : 0));
            seen.push(`${data.type}:end`);
        },
    });
    const socket = transport.connect();
    socket.emit({ type: 'gameStarting' });
    socket.emit({ type: 'gameStarted' });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(seen, ['gameStarting:start', 'gameStarting:end', 'gameStarted:start', 'gameStarted:end']);
});
