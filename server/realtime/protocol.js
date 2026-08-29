'use strict';

// The realtime server owns authentication and room state; this module only
// normalises the wire shape and dispatches a message to an injected handler.
// Keeping this boundary pure makes protocol changes testable without sockets.

const LEGACY_GAME_ACTIONS = Object.freeze({
    discardCard: 'discardCard',
    playCard: 'playCard',
});

function normalizeMessage(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string') return null;
    if (LEGACY_GAME_ACTIONS[data.type]) {
        return {
            type: 'gameAction',
            action: {
                kind: LEGACY_GAME_ACTIONS[data.type],
                cardIndex: data.cardIndex,
                targetId: data.targetId,
                guess: data.guess,
            },
        };
    }
    return data;
}

function dispatchMessage(data, handlers = {}) {
    const message = normalizeMessage(data);
    if (!message) return false;
    const handler = handlers[message.type];
    if (typeof handler !== 'function') return false;
    handler(message);
    return true;
}

module.exports = { dispatchMessage, normalizeMessage };
