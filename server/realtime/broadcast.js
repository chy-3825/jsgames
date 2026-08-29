'use strict';

/**
 * Transport-only broadcast helpers.  Room and session policy stays in the
 * realtime service; this module knows only how to fan out an already-built
 * payload to the current sockets.
 */
function createRealtimeBroadcaster({ WebSocketImpl, players, rooms }) {
    function encode(payload) {
        return JSON.stringify(payload);
    }

    function broadcastToAll(payload) {
        const message = encode(payload);
        players.forEach((_, client) => {
            if (client?.readyState === WebSocketImpl.OPEN) client.send(message);
        });
    }

    function broadcastToRoom(roomId, payload) {
        const room = rooms.get(roomId);
        if (!room) return;
        const message = encode(payload);
        room.players.forEach(({ ws }) => {
            if (ws?.readyState === WebSocketImpl.OPEN) ws.send(message);
        });
    }

    return { broadcastToAll, broadcastToRoom };
}

module.exports = { createRealtimeBroadcaster };
