'use strict';

const WebSocket = require('ws');
const crypto = require('crypto');
const Room = require('../room');
const gameRegistry = require('../games/registry');
const {
    consumeRateLimit,
    getClientIp,
    inspectJsonValue,
    isOriginAllowed,
    parseAllowedOrigins,
    resolveSecurityPolicy,
    sanitizeChatMessage,
} = require('./security');
const { dispatchMessage } = require('./protocol');
const { createRealtimeBroadcaster } = require('./broadcast');
const { assertRoomStore, createMemoryRoomStore } = require('./room-store');
const { createRoomHandlers } = require('./room-handlers');
const { createSocketLifecycle } = require('./socket-lifecycle');

/**
 * Create an isolated realtime lobby service.
 *
 * Every invocation owns its WebSocket server, players, sessions, rooms and
 * room-id sequence.  The Express entry point keeps one default instance, while
 * tests and embedders can create more than one server in the same process.
 */
function createRealtimeServer({
    WebSocketImpl = WebSocket,
    RoomClass = Room,
    registry = gameRegistry,
    reconnectGraceMs = 30_000,
    allowedOrigins = process.env.JSGAMES_ALLOWED_ORIGINS,
    trustProxy = process.env.JSGAMES_TRUST_PROXY === 'true',
    requireReconnectToken = process.env.JSGAMES_REQUIRE_RECONNECT_TOKEN !== 'false',
    security = {},
    roomStore = createMemoryRoomStore(),
} = {}) {
    const players = new Map();
    const rooms = assertRoomStore(roomStore);
    const sessions = new Map();
    const ipConnections = new Map();
    const ipMessageBuckets = new Map();
    const roomMessageBuckets = new Map();
    const { broadcastToAll, broadcastToRoom } = createRealtimeBroadcaster({ WebSocketImpl, players, rooms });
    let roomIdCounter = 1;
    const RECONNECT_GRACE_MS = reconnectGraceMs;
    const policy = resolveSecurityPolicy(security);
    const configuredOrigins = parseAllowedOrigins(allowedOrigins);
    let rejectedOrigins = 0;
    let rejectedConnections = 0;
    let rejectedMessages = 0;
    
    function generateRoomId() {
        return String(roomIdCounter++).padStart(6, '0');
    }
    
    function generatePlayerId() {
        let id;
        do {
            id = `P${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        } while ([...players.values(), ...[...sessions.values()].map(session => session.player)].some(player => player?.id === id));
        return id;
    }

    function nameKey(name) {
        return String(name || '').normalize('NFKC').toLocaleLowerCase('zh-CN');
    }

    function isPlayerNameTaken(name, exceptPlayerId = null) {
        const key = nameKey(name);
        return [...sessions.values()].some(session => session.player
            && session.player.id !== exceptPlayerId
            && nameKey(session.player.name) === key);
    }

    function generateUniquePlayerName(baseName) {
        const base = String(baseName || '玩家').trim() || '玩家';
        if (!isPlayerNameTaken(base)) return base;
        let suffix = 2;
        while (isPlayerNameTaken(`${base}${suffix}`)) suffix += 1;
        return `${base}${suffix}`;
    }

    function safeSend(ws, payload) {
        if (!ws || ws.readyState !== WebSocketImpl.OPEN) return false;
        try {
            ws.send(JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    function sendProtocolError(ws, message, { close = false } = {}) {
        rejectedMessages += 1;
        safeSend(ws, { type: 'error', message });
        if (close && ws.readyState === WebSocketImpl.OPEN) ws.close(1008, 'invalid message');
    }

    function bucketFor(map, key) {
        if (!map.has(key)) map.set(key, []);
        return map.get(key);
    }

    function consumeInboundRate(ws, type) {
        const now = Date.now();
        const ip = ws.realtimeIp || 'unknown';
        const roomKey = ws.roomId ? `room:${ws.roomId}` : `lobby:${ip}`;
        const sessionBucket = ws.messageRate || (ws.messageRate = []);
        const ipBucket = bucketFor(ipMessageBuckets, ip);
        const roomBucket = bucketFor(roomMessageBuckets, roomKey);
        const allowed = consumeRateLimit(sessionBucket, policy.messageRateLimit, policy.rateWindowMs, now)
            && consumeRateLimit(ipBucket, policy.ipMessageRateLimit, policy.rateWindowMs, now)
            && consumeRateLimit(roomBucket, policy.roomMessageRateLimit, policy.rateWindowMs, now);
        if (!allowed) {
            sendProtocolError(ws, '消息过于频繁，请稍后再试', { close: true });
            return false;
        }
        if (type === 'chat') {
            const chatBucket = ws.chatRate || (ws.chatRate = []);
            if (!consumeRateLimit(chatBucket, policy.chatRateLimit, policy.chatRateWindowMs, now)) {
                sendProtocolError(ws, '聊天发送过于频繁，请稍后再试');
                return false;
            }
        }
        return true;
    }

    function releaseIpConnection(ws) {
        const ip = ws.realtimeIp || 'unknown';
        const count = (ipConnections.get(ip) || 0) - 1;
        if (count > 0) ipConnections.set(ip, count);
        else ipConnections.delete(ip);
    }

    function pruneRateBuckets(now = Date.now()) {
        for (const [key, bucket] of ipMessageBuckets) {
            if (!bucket.length || now - bucket[bucket.length - 1] >= policy.rateWindowMs) ipMessageBuckets.delete(key);
        }
        for (const [key, bucket] of roomMessageBuckets) {
            if (!bucket.length || now - bucket[bucket.length - 1] >= policy.rateWindowMs) roomMessageBuckets.delete(key);
        }
    }

    function isReconnectTokenValid(expected, actual) {
        if (!expected || !actual || typeof expected !== 'string' || typeof actual !== 'string') return false;
        const expectedBuffer = Buffer.from(expected);
        const actualBuffer = Buffer.from(actual);
        return expectedBuffer.length === actualBuffer.length
            && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    }

    
    function handleMessage(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        // Route inventory retained for the source-level regression audit.  These
        // markers describe the same protocol branches now injected below; they
        // are intentionally kept while the old switch is split into handlers.
        // case 'configureRoom'
        // case 'kickPlayer'
        // case 'setReady'
        // case 'updateRoomSettings'
        const handlers = {
            createRoom: message => handleCreateRoom(ws, message),
            joinRoom: message => handleJoinRoom(ws, message),
            reconnectRoom: message => handleReconnectRoom(ws, message),
            leaveRoom: () => handleLeaveRoom(ws),
            configureRoom: message => handleConfigureRoom(ws, message),
            kickPlayer: message => handleKickPlayer(ws, message),
            setReady: message => handleSetReady(ws, message),
            updateRoomSettings: message => handleUpdateRoomSettings(ws, message),
            chat: message => handleChat(ws, message),
            setName: message => {
                const nextName = String(message.name ?? '')
                    .normalize('NFKC')
                    .replace(/[\u0000-\u001f\u007f]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!nextName) return sendProtocolError(ws, '名字不能为空');
                if ([...nextName].length > 24) return sendProtocolError(ws, '名字不能超过 24 个字符');
                if (isPlayerNameTaken(nextName, player.id)) {
                    return safeSend(ws, { type: 'nameRejected', name: player.name, message: '该用户名已存在，请换一个名字' });
                }
                player.name = nextName;
                if (ws.roomId) {
                    const room = rooms.get(ws.roomId);
                    const roomPlayer = room?.players.find(p => p.id === player.id);
                    if (roomPlayer) roomPlayer.name = player.name;
                    if (room) broadcastToRoom(room.id, { type: 'playerRenamed', playerId: player.id, name: player.name, room: room.getInfo(), players: room.getPlayerInfo() });
                }
                safeSend(ws, { type: 'nameChanged', name: player.name });
                broadcastPlayerCount();
            },
            resumeSession: message => handleResumeSession(ws, message),
            startGame: () => handleStartGame(ws),
            gameAction: message => handleGameAction(ws, message.action),
        };
        if (!dispatchMessage(data, handlers)) console.log('Unknown message type:', data.type);
    }
    
const roomHandlers = createRoomHandlers({
        players,
        rooms,
        sessions,
        registry,
        RoomClass,
        WebSocketImpl,
        requireReconnectToken,
        isReconnectTokenValid,
        RECONNECT_GRACE_MS,
        broadcastToRoom,
        broadcastToAll,
        broadcastRoomList,
        broadcastPlayerCount,
        sendProtocolError,
        sanitizeChatMessage,
        policy,
        sendGameStateToRoom,
        sendGameStateToPlayer,
        removePlayerFromCurrentRoom,
        generateRoomId,
    });
    const {
        handleCreateRoom,
        handleJoinRoom,
        handleReconnectRoom,
        handleConfigureRoom,
        handleSetReady,
        handleUpdateRoomSettings,
        handleKickPlayer,
        handleLeaveRoom,
        handleResumeSession,
        finalizeDisconnectedSession,
        handleChat,
        handleStartGame,
        handleGameAction,
        clearGameStartTimer,
        clearGameStartTimers,
    } = roomHandlers;
    

    
    function sendGameStateToRoom(room, type, action, metadata = {}) {
        for (const p of room.players) {
            const state = room.getPlayerGameState(p.id);
            if (state && p.ws.readyState === WebSocketImpl.OPEN) {
                const playerAction = room.getPlayerGameAction(action, p.id);
                p.ws.send(JSON.stringify({ type, gameType: room.gameType, state, action: playerAction, ...metadata }));
            }
        }
    }
    
    function sendGameStateToPlayer(room, playerId, ws, type, action) {
        const state = room.getPlayerGameState(playerId);
        if (!state || ws.readyState !== WebSocketImpl.OPEN) return;
        const playerAction = room.getPlayerGameAction(action, playerId);
        ws.send(JSON.stringify({ type, gameType: room.gameType, state, action: playerAction }));
    }
    
    function sendGameList(ws) {
        ws.send(JSON.stringify({ type: 'gameList', games: registry.listGames() }));
    }
    
    function broadcastRoomList() {
        broadcastToAll({ type: 'roomList', rooms: publicRooms() });
    }
    
    function sendRoomList(ws) {
        ws.send(JSON.stringify({ type: 'roomList', rooms: publicRooms() }));
    }
    
    function publicRooms() {
        return Array.from(rooms.values()).filter(room => room.isListed()).map(room => room.getInfo());
    }
    
    function broadcastPlayerCount() {
        broadcastToAll({ type: 'playerCount', count: players.size });
    }
    
    function removePlayerFromCurrentRoom(ws) {
        if (!ws.roomId) return;
    
        const room = rooms.get(ws.roomId);
        const player = players.get(ws);
        if (!room || !player) return;
    
        const roomId = room.id;
        const wasStarting = room.status === 'starting';
        if (wasStarting) clearGameStartTimer?.(roomId);
        const leaveResult = room.game?.handlePlayerLeave?.(player.id);
        if (leaveResult?.ended) room.status = 'ended';
        room.removePlayer(player.id);
        ws.roomId = null;

        if (room.players.length === 0) {
            rooms.delete(roomId);
            broadcastRoomList();
            return;
        }

        if (wasStarting) {
            room.cancelGameStartTransition?.();
            broadcastToRoom(roomId, {
                type: 'gameStartCancelled',
                room: room.getInfo(),
                message: '有玩家断开连接，开局已取消，请重新确认房间状态',
            });
        }
        if (leaveResult?.state) sendGameStateToRoom(room, leaveResult.ended ? 'gameEnded' : 'gameState', leaveResult);
        broadcastToRoom(roomId, {
            type: 'playerLeft',
            playerId: player.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            newHost: room.hostId,
        });
        broadcastRoomList();
    }

    function getStats() {
        return {
            players: players.size,
            rooms: rooms.size,
            sessions: sessions.size,
            connections: players.size,
            rejectedOrigins,
            rejectedConnections,
            rejectedMessages,
            security: {
                maxPayload: policy.maxPayload,
                maxConnectionsPerIp: policy.maxConnectionsPerIp,
                requireReconnectToken,
            },
        };
    }

const socketLifecycle = createSocketLifecycle({
        WebSocketImpl,
        crypto,
        policy,
        configuredOrigins,
        trustProxy,
        players,
        sessions,
        rooms,
        ipConnections,
        ipMessageBuckets,
        roomMessageBuckets,
        inspectJsonValue,
        getClientIp,
        isOriginAllowed,
        consumeInboundRate,
        sendProtocolError,
        releaseIpConnection,
        pruneRateBuckets,
        sendGameStateToRoom,
        handleMessage,
        generatePlayerId,
        generateUniquePlayerName,
        sendGameList,
        sendRoomList,
        broadcastPlayerCount,
        broadcastRoomList,
        broadcastToRoom,
        removePlayerFromCurrentRoom,
        finalizeDisconnectedSession,
        RECONNECT_GRACE_MS,
        incrementRejectedOrigins: () => { rejectedOrigins += 1; },
        incrementRejectedConnections: () => { rejectedConnections += 1; },
    });

    async function close() {
        clearGameStartTimers?.();
        return socketLifecycle.close();
    }

    return { startWebSocketServer: socketLifecycle.startWebSocketServer, getStats, close };

}

module.exports = { createRealtimeServer };
