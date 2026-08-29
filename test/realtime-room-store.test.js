'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { assertRoomStore, createMemoryRoomStore } = require('../server/realtime/room-store');
const { createRealtimeServer } = require('../server/realtime/create-realtime-server');

test('memory room store implements the realtime room contract without leaking Map internals', () => {
    const store = createMemoryRoomStore();
    assert.equal(store.size, 0);
    assert.equal(store.set('room-1', { id: 'room-1' }), store);
    assert.deepEqual(store.get('room-1'), { id: 'room-1' });
    assert.deepEqual([...store.values()], [{ id: 'room-1' }]);
    assert.equal(store.delete('room-1'), true);
    assert.equal(store.size, 0);
    assertRoomStore(store);
});

test('room store validation rejects adapters that cannot report bounded size', () => {
    assert.throws(() => assertRoomStore({ get() {}, set() {}, delete() {}, values() {}, clear() {} }), /roomStore\.size/);
    assert.throws(() => assertRoomStore({}), /roomStore must implement/);
});

test('realtime server accepts an injected room store and clears it on shutdown', async () => {
    const store = createMemoryRoomStore();
    const realtime = createRealtimeServer({ roomStore: store });
    store.set('test-room', { id: 'test-room' });
    assert.equal(realtime.getStats().rooms, 1);
    await realtime.close();
    assert.equal(store.size, 0);
});
