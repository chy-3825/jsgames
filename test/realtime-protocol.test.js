'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchMessage, normalizeMessage } = require('../server/realtime/protocol');

test('realtime protocol normalizes legacy card actions without mutating input', () => {
    const input = { type: 'playCard', cardIndex: 2, targetId: 'P2', guess: '7' };
    const normalized = normalizeMessage(input);
    assert.deepEqual(normalized, {
        type: 'gameAction',
        action: { kind: 'playCard', cardIndex: 2, targetId: 'P2', guess: '7' },
    });
    assert.deepEqual(input, { type: 'playCard', cardIndex: 2, targetId: 'P2', guess: '7' });
});

test('realtime protocol dispatches only known handlers', () => {
    const received = [];
    const handled = dispatchMessage({ type: 'gameAction', action: { kind: 'move' } }, {
        gameAction: message => received.push(message),
    });
    assert.equal(handled, true);
    assert.deepEqual(received, [{ type: 'gameAction', action: { kind: 'move' } }]);
    assert.equal(dispatchMessage({ type: 'unknown' }, {}), false);
    assert.equal(dispatchMessage(null, {}), false);
});
