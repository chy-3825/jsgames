'use strict';

// This is deliberately a small Map-shaped seam.  The default store is
// process-local and ephemeral; a durable/multi-instance adapter must implement
// the same operations with atomic writes and an explicit snapshot/version
// policy before it is enabled in production.

const REQUIRED_METHODS = ['get', 'set', 'delete', 'values', 'clear'];

function createMemoryRoomStore() {
    const rooms = new Map();
    return {
        get: rooms.get.bind(rooms),
        set(key, value) {
            rooms.set(key, value);
            return this;
        },
        delete: rooms.delete.bind(rooms),
        values: rooms.values.bind(rooms),
        clear: rooms.clear.bind(rooms),
        get size() { return rooms.size; },
    };
}

function assertRoomStore(store) {
    if (!store || REQUIRED_METHODS.some(method => typeof store[method] !== 'function')) {
        throw new TypeError(`roomStore must implement ${REQUIRED_METHODS.join(', ')}`);
    }
    if (!Number.isInteger(store.size) || store.size < 0) {
        throw new TypeError('roomStore.size must be a non-negative integer');
    }
    return store;
}

module.exports = { assertRoomStore, createMemoryRoomStore };
