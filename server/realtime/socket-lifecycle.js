'use strict';

/** Own the WebSocket server, heartbeat and process-level cleanup lifecycle. */
function createSocketLifecycle({
    WebSocketImpl, crypto, policy, configuredOrigins, trustProxy,
    players, sessions, rooms, ipConnections,
    ipMessageBuckets, roomMessageBuckets,
    inspectJsonValue, getClientIp, isOriginAllowed, consumeInboundRate,
    sendProtocolError, releaseIpConnection, pruneRateBuckets,
    sendGameStateToRoom, handleMessage, generatePlayerId, generateUniquePlayerName, sendGameList,
    sendRoomList, broadcastPlayerCount, broadcastRoomList, broadcastToRoom,
    removePlayerFromCurrentRoom, finalizeDisconnectedSession,
    RECONNECT_GRACE_MS, incrementRejectedOrigins, incrementRejectedConnections,
}) {
    let systemTick = null;
    let heartbeatTick = null;
    let wss = null;
    function startWebSocketServer(server) {
        if (wss) return wss;
        wss = new WebSocketImpl.Server({
            server,
            maxPayload: policy.maxPayload,
            verifyClient: (info, done) => {
                const origin = info?.origin || info?.req?.headers?.origin || '';
                if (!isOriginAllowed(origin, info?.req, configuredOrigins)) {
                    incrementRejectedOrigins();
                    done(false, 403, 'Origin not allowed');
                    return;
                }
                const ip = getClientIp(info?.req, { trustProxy });
                if ((ipConnections.get(ip) || 0) >= policy.maxConnectionsPerIp) {
                    incrementRejectedConnections();
                    done(false, 429, 'Too many connections');
                    return;
                }
                done(true);
            },
        });
        const activeWss = wss;
        wss.once('close', () => {
            if (systemTick) clearInterval(systemTick);
            systemTick = null;
            if (heartbeatTick) clearInterval(heartbeatTick);
            heartbeatTick = null;
            if (wss === activeWss) wss = null;
        });
        systemTick = setInterval(() => {
            pruneRateBuckets();
            for (const room of rooms.values()) {
                const result = room.handleSystemTick?.();
                if (result?.state) sendGameStateToRoom(room, result.ended ? 'gameEnded' : 'gameState', result);
            }
        }, 1000);
        systemTick.unref?.();
        heartbeatTick = setInterval(() => {
            for (const client of activeWss.clients) {
                if (client.isAlive === false) {
                    client.terminate();
                    continue;
                }
                client.isAlive = false;
                client.ping?.();
            }
        }, policy.heartbeatIntervalMs);
        heartbeatTick.unref?.();
        wss.on('connection', (ws, request) => {
        ws.isAlive = true;
        ws.realtimeIp = getClientIp(request, { trustProxy });
        ipConnections.set(ws.realtimeIp, (ipConnections.get(ws.realtimeIp) || 0) + 1);
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('error', error => {
            if (error?.code !== 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') console.warn(`WebSocket error: ${error.message}`);
        });
        const playerId = generatePlayerId();
        const sessionToken = crypto.randomBytes(24).toString('hex');
        const player = { id: playerId, name: generateUniquePlayerName('Player' + playerId.substr(1, 4)), sessionToken, roomId: null, reconnectTimer: null };
        players.set(ws, player);
        sessions.set(sessionToken, { player, ws, roomId: null });

        console.log(`Player ${players.get(ws).name} connected`);
        ws.send(JSON.stringify({ type: 'session', sessionToken, playerId, playerName: player.name }));
        sendGameList(ws);
        sendRoomList(ws);
        broadcastPlayerCount();

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (!inspectJsonValue(data, policy) || !data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string' || data.type.length > 64) {
                    if (consumeInboundRate(ws)) sendProtocolError(ws, '消息格式无效', { close: true });
                    return;
                }
                if (!consumeInboundRate(ws, data.type)) return;
                handleMessage(ws, data);
            } catch {
                if (consumeInboundRate(ws)) sendProtocolError(ws, '消息格式无效', { close: true });
            }
        });

        ws.on('close', () => {
            const player = players.get(ws);
            if (!player) return;

            releaseIpConnection(ws);

            console.log(`Player ${player.name} disconnected`);
            players.delete(ws);
            const activeSession = sessions.get(player.sessionToken);
            if (activeSession && activeSession.ws && activeSession.ws !== ws) {
                return;
            }
            if (ws.intentionalLeave) {
                sessions.delete(player.sessionToken);
                removePlayerFromCurrentRoom(ws);
            } else {
                const session = sessions.get(player.sessionToken);
                if (session) {
                    session.ws = null;
                    session.roomId = ws.roomId || session.roomId;
                    session.player.reconnectTimer = setTimeout(() => finalizeDisconnectedSession(player.sessionToken), RECONNECT_GRACE_MS);
                    session.player.reconnectTimer.unref?.();
                    const room = session.roomId ? rooms.get(session.roomId) : null;
                    const connectionResult = room?.markPlayerDisconnected(player.id);
                    if (room && connectionResult?.success) {
                        const message = `${player.name} 已断线，游戏暂时暂停，等待重连`;
                        if (room.status === 'playing') {
                            broadcastToRoom(room.id, {
                                type: 'roomPaused',
                                player: { id: player.id, name: player.name },
                                room: room.getInfo(),
                                connectionState: room.getConnectionState(),
                                message,
                            });
                        } else {
                            broadcastToRoom(room.id, {
                                type: 'playerDisconnected',
                                player: { id: player.id, name: player.name },
                                room: room.getInfo(),
                            });
                        }
                    }
                } else removePlayerFromCurrentRoom(ws);
            }
            broadcastPlayerCount();
            broadcastRoomList();
        });
        });
        console.log('WebSocket server attached to HTTP server');
        return wss;
    }

    async function close() {
        const active = wss;
        if (systemTick) clearInterval(systemTick);
        systemTick = null;
        if (heartbeatTick) clearInterval(heartbeatTick);
        heartbeatTick = null;
        if (!active) {
            for (const session of sessions.values()) clearTimeout(session.player?.reconnectTimer);
            players.clear();
            rooms.clear();
            sessions.clear();
            ipConnections.clear();
            ipMessageBuckets.clear();
            roomMessageBuckets.clear();
            return;
        }
        for (const client of active.clients || []) {
            try { client.close(1001, 'server shutting down'); } catch {}
            try { client.terminate(); } catch {}
        }
        await new Promise(resolve => {
            try {
                active.close(() => resolve());
            } catch {
                resolve();
            }
        });
        for (const session of sessions.values()) clearTimeout(session.player?.reconnectTimer);
        players.clear();
        rooms.clear();
        sessions.clear();
        ipConnections.clear();
        ipMessageBuckets.clear();
        roomMessageBuckets.clear();
        if (wss === active) wss = null;
    }
    return { startWebSocketServer, close };
}

module.exports = { createSocketLifecycle };
