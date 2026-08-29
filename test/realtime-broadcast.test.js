'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRealtimeBroadcaster } = require('../server/realtime/broadcast');

const WebSocketImpl = { OPEN: 1 };

function socket() {
    return { readyState: WebSocketImpl.OPEN, sent: [], send(value) { this.sent.push(JSON.parse(value)); } };
}

test('realtime broadcaster sends JSON payloads to open lobby sockets', () => {
    const first = socket();
    const closed = { readyState: 0, sent: [], send() { throw new Error('closed socket must not receive'); } };
    const players = new Map([[first, {}], [closed, {}]]);
    const rooms = new Map();
    const { broadcastToAll } = createRealtimeBroadcaster({ WebSocketImpl, players, rooms });
    broadcastToAll({ type: 'playerCount', count: 1 });
    assert.deepEqual(first.sent, [{ type: 'playerCount', count: 1 }]);
    assert.deepEqual(closed.sent, []);
});

test('realtime broadcaster targets only members of the requested room', () => {
    const first = socket();
    const second = socket();
    const outsider = socket();
    const room = { players: [{ ws: first }, { ws: second }] };
    const { broadcastToRoom } = createRealtimeBroadcaster({
        WebSocketImpl,
        players: new Map([[first, {}], [second, {}], [outsider, {}]]),
        rooms: new Map([['room-1', room]]),
    });
    broadcastToRoom('room-1', { type: 'roomReady' });
    assert.equal(first.sent.length, 1);
    assert.equal(second.sent.length, 1);
    assert.equal(outsider.sent.length, 0);
});
