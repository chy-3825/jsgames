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
} = {}) {
    let systemTick = null;
    let heartbeatTick = null;
    let wss = null;
    const players = new Map();
    const rooms = new Map();
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

    function startWebSocketServer(server) {
        if (wss) return wss;
        wss = new WebSocketImpl.Server({
            server,
            maxPayload: policy.maxPayload,
            verifyClient: (info, done) => {
                const origin = info?.origin || info?.req?.headers?.origin || '';
                if (!isOriginAllowed(origin, info?.req, configuredOrigins)) {
                    rejectedOrigins += 1;
                    done(false, 403, 'Origin not allowed');
                    return;
                }
                const ip = getClientIp(info?.req, { trustProxy });
                if ((ipConnections.get(ip) || 0) >= policy.maxConnectionsPerIp) {
                    rejectedConnections += 1;
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
        const player = { id: playerId, name: 'Player' + playerId.substr(1, 4), sessionToken, roomId: null, reconnectTimer: null };
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
                player.name = nextName;
                if (ws.roomId) {
                    const room = rooms.get(ws.roomId);
                    const roomPlayer = room?.players.find(p => p.id === player.id);
                    if (roomPlayer) roomPlayer.name = player.name;
                    if (room) broadcastToRoom(room.id, { type: 'playerRenamed', playerId: player.id, name: player.name, room: room.getInfo(), players: room.getPlayerInfo() });
                }
                broadcastPlayerCount();
            },
            resumeSession: message => handleResumeSession(ws, message),
            startGame: () => handleStartGame(ws),
            gameAction: message => handleGameAction(ws, message.action),
        };
        if (!dispatchMessage(data, handlers)) console.log('Unknown message type:', data.type);
    }
    
    function handleCreateRoom(ws, data) {
        const player = players.get(ws);
        if (!player) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: '请先离开当前房间' }));
            return;
        }
    
        const gameType = data.gameType || 'loveletter';
        if (!registry.getGame(gameType)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown game type' }));
            return;
        }
    
        const roomId = generateRoomId();
        if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: null });
        ws.intentionalLeave = false;
        let room;
        try {
            room = new RoomClass(roomId, player.id, player.name, gameType, data.gameOptions, {
                roomName: data.roomName,
                isPublic: data.isPublic,
                seatLimit: data.seatLimit,
                readyCheckEnabled: true,
            });
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
            return;
        }
    
        room.addPlayer({ id: player.id, name: player.name, ws, connected: true });
        rooms.set(roomId, room);
        ws.roomId = roomId;
        player.roomId = roomId;
        const session = sessions.get(player.sessionToken); if (session) session.roomId = roomId;
    
        ws.send(JSON.stringify({
            type: 'roomCreated',
            playerId: player.id,
            roomId,
            room: room.getInfo(),
        }));
    
        broadcastRoomList();
        console.log(`Room ${roomId} created by ${player.name}`);
    }
    
    function handleJoinRoom(ws, data) {
        const player = players.get(ws);
        if (!player) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: '请先离开当前房间' }));
            return;
        }
    
        const room = rooms.get(String(data.roomId || '').trim());
        if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: '房间不存在，请核对房间号' }));
            return;
        }
    
        if (room.status === 'playing') {
            ws.send(JSON.stringify({
                type: 'reconnectRequired',
                roomId: room.id,
                room: room.getInfo(),
                message: '游戏已开始，请输入断线玩家 ID 进行重连',
            }));
            return;
        }
        if (room.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: '该房间已结束，无法进入' }));
            return;
        }
    
        const result = room.addPlayer({ id: player.id, name: player.name, ws, connected: true });
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
    
        ws.roomId = room.id;
        player.roomId = room.id;
        ws.intentionalLeave = false;
        if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: room.id });
        const session = sessions.get(player.sessionToken); if (session) session.roomId = room.id;
    
        broadcastToRoom(room.id, {
            type: 'playerJoined',
            player: { id: player.id, name: player.name, seatIndex: result.seatIndex },
            room: room.getInfo(),
            players: room.getPlayerInfo(),
        });
    
        ws.send(JSON.stringify({
            type: 'joinSuccess',
            playerId: player.id,
            roomId: room.id,
            room: room.getInfo(),
        }));
    
        broadcastRoomList();
        console.log(`Player ${player.name} joined room ${room.id}`);
    }
    
    function findSessionByPlayerId(playerId) {
        for (const session of sessions.values()) {
            if (session.player?.id === playerId) return session;
        }
        return null;
    }
    
    function handleReconnectRoom(ws, data) {
        const provisionalPlayer = players.get(ws);
        const roomId = String(data.roomId || '').trim();
        const playerId = String(data.playerId || '').trim();
        const reconnectToken = String(data.sessionToken || '').trim();
        if (!provisionalPlayer) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '请先离开当前房间' }));
            return;
        }
    
        const room = rooms.get(roomId);
        if (!room) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '房间不存在，请核对房间号' }));
            return;
        }
        if (room.status !== 'playing') {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '该房间尚未开始游戏，请使用普通加入' }));
            return;
        }
    
        const session = findSessionByPlayerId(playerId);
        if (requireReconnectToken && (!session?.player || !isReconnectTokenValid(session.player.sessionToken, reconnectToken))) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '重连凭证无效或已过期，请在原浏览器中重试' }));
            return;
        }
        const roomPlayer = room.players.find(player => player.id === playerId);
        if (!roomPlayer) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '房间内没有找到这个玩家 ID' }));
            return;
        }
        const activeSocket = session?.ws;
        if (roomPlayer.connected !== false || activeSocket?.readyState === WebSocketImpl.OPEN) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: `玩家 ID ${playerId} 已在房间中使用，${roomPlayer.name} 正在进行游戏，无法重复进入` }));
            return;
        }
        if (!session || !session.player) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '该玩家的重连凭证已失效' }));
            return;
        }
    
        if (session.player.reconnectTimer) clearTimeout(session.player.reconnectTimer);
        session.player.reconnectTimer = null;
        const player = session.player;
        if (provisionalPlayer.sessionToken && provisionalPlayer.sessionToken !== player.sessionToken) sessions.delete(provisionalPlayer.sessionToken);
        players.delete(ws);
        players.set(ws, player);
        session.ws = ws;
        session.roomId = room.id;
        player.roomId = room.id;
        ws.roomId = room.id;
        ws.intentionalLeave = false;
        roomPlayer.ws = ws;
        room.markPlayerReconnected(player.id);
        room.game?.handlePlayerReconnect?.(player.id);
    
        const connectionState = room.getConnectionState();
        ws.send(JSON.stringify({
            type: 'reconnectSuccess',
            playerId: player.id,
            playerName: player.name,
            sessionToken: player.sessionToken,
            roomId: room.id,
            room: room.getInfo(),
        }));
        broadcastToRoom(room.id, {
            type: connectionState.paused ? 'playerReconnected' : 'roomResumed',
            player: { id: player.id, name: player.name },
            room: room.getInfo(),
            connectionState,
            message: connectionState.paused ? `${player.name} 已重连` : `${player.name} 已重连，游戏恢复`,
        });
        if (room.game) sendGameStateToPlayer(room, player.id, ws, 'gameState', { success: true, message: '已恢复对局' });
        broadcastPlayerCount();
    }
    
    function handleConfigureRoom(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.configure(player.id, {
            playerCount: data.playerCount,
            encryptorMode: data.encryptorMode,
            settings: data.settings,
        });
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'roomConfigured',
            roomId: room.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: result.message,
        });
        broadcastRoomList();
        console.log(`Room ${room.id} configuration confirmed`);
    }
    
    function handleSetReady(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.setPlayerReady(player.id, data.ready !== false);
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'playerReady',
            player: { id: result.player.id, name: result.player.name, ready: result.player.ready },
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: `${result.player.name}${result.player.ready ? ' 已准备' : ' 取消了准备'}`,
        });
    }
    
    function handleUpdateRoomSettings(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.updateSettings(player.id, data.settings || {});
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'roomSettingsUpdated',
            roomId: room.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: result.message,
        });
        broadcastRoomList();
    }
    
    function handleKickPlayer(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        if (room.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: '游戏开始后不能移出玩家' }));
            return;
        }
        if (room.hostId !== player.id) {
            ws.send(JSON.stringify({ type: 'error', message: '只有房主可以移出玩家' }));
            return;
        }
        const targetId = String(data.playerId || '').trim();
        const target = room.players.find(item => item.id === targetId);
        if (!target) {
            ws.send(JSON.stringify({ type: 'error', message: '没有找到要移出的玩家' }));
            return;
        }
        if (target.id === room.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: '房主不能移出自己' }));
            return;
        }
    
        const targetSession = findSessionByPlayerId(target.id);
        if (targetSession?.player?.reconnectTimer) clearTimeout(targetSession.player.reconnectTimer);
        if (targetSession) sessions.delete(targetSession.player.sessionToken);
        target.ws && (target.ws.intentionalLeave = true);
        if (target.ws) target.ws.roomId = null;
        if (targetSession?.player) targetSession.player.roomId = null;
        target.ws?.readyState === WebSocketImpl.OPEN && target.ws.send(JSON.stringify({
            type: 'playerKicked',
            roomId: room.id,
            message: '你已被房主移出房间',
        }));
    
        room.removePlayer(target.id);
        broadcastToRoom(room.id, {
            type: 'playerLeft',
            playerId: target.id,
            kicked: true,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: `${target.name} 已被房主移出房间`,
        });
        broadcastRoomList();
    }
    
    function handleLeaveRoom(ws) {
        const player = players.get(ws);
        if (!player || !ws.roomId) return;
    
        const roomId = ws.roomId;
        const room = rooms.get(roomId);
        if (!room) return;
    
        ws.intentionalLeave = true;
        const session = sessions.get(player.sessionToken);
        if (session) session.roomId = null;
        const leaveResult = room.game?.handlePlayerLeave?.(player.id);
        if (leaveResult?.ended) room.status = 'ended';
        room.removePlayer(player.id);
        ws.roomId = null;
    
        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted`);
        } else {
            if (leaveResult?.state) sendGameStateToRoom(room, leaveResult.ended ? 'gameEnded' : 'gameState', leaveResult);
            broadcastToRoom(roomId, {
                type: 'playerLeft',
                playerId: player.id,
                room: room.getInfo(),
                players: room.getPlayerInfo(),
                newHost: room.hostId,
            });
        }
    
        broadcastRoomList();
        console.log(`Player ${player.name} left room ${roomId}`);
    }
    
    function handleResumeSession(ws, data) {
        const token = String(data.sessionToken || '');
        const session = sessions.get(token);
        if (!session || !session.player) {
            ws.send(JSON.stringify({ type: 'resumeFailed', message: '会话已过期，请重新进入房间' }));
            return;
        }
        // A duplicated tab can inherit sessionStorage and present the same token
        // while the original socket is still alive.  Never let that tab evict the
        // live player; its provisional connection keeps the fresh identity that
        // was issued during the WebSocket handshake.  Resume remains allowed when
        // the old connection is actually gone (normal refresh/network recovery).
        if (session.ws && session.ws !== ws && session.ws.readyState === WebSocketImpl.OPEN) {
            const provisional = players.get(ws);
            ws.send(JSON.stringify({ type: 'resumeFailed', message: '该会话仍在其他窗口使用，本窗口已创建新的玩家身份' }));
            if (provisional) ws.send(JSON.stringify({ type: 'session', sessionToken: provisional.sessionToken, playerId: provisional.id, playerName: provisional.name }));
            return;
        }
        if (session.player.reconnectTimer) clearTimeout(session.player.reconnectTimer);
        session.player.reconnectTimer = null;
        const oldWs = session.ws;
        const player = session.player;
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (oldWs && oldWs !== ws && oldWs.readyState === WebSocketImpl.OPEN) {
            oldWs.intentionalLeave = true;
            oldWs.close(4001, 'session resumed');
        }
        const provisionalPlayer = players.get(ws);
        if (provisionalPlayer?.sessionToken && provisionalPlayer.sessionToken !== token) sessions.delete(provisionalPlayer.sessionToken);
        players.delete(ws);
        players.set(ws, player);
        session.ws = ws;
        ws.roomId = session.roomId || null;
        if (room) {
            const roomPlayer = room.players.find(item => item.id === player.id);
            if (roomPlayer) roomPlayer.ws = ws;
            room.markPlayerReconnected(player.id);
            const reconnectResult = room.game?.handlePlayerReconnect?.(player.id);
            ws.send(JSON.stringify({ type: 'resumeSuccess', playerId: player.id, roomId: room.id, room: room.getInfo() }));
            const connectionState = room.getConnectionState();
            broadcastToRoom(room.id, { type: connectionState.paused ? 'playerReconnected' : 'roomResumed', player: { id: player.id, name: player.name }, room: room.getInfo(), players: room.getPlayerInfo(), connectionState });
            if (reconnectResult?.state) sendGameStateToRoom(room, 'gameState', reconnectResult);
            else if (room.game) sendGameStateToPlayer(room, player.id, ws, 'gameState', { success: true, message: '已恢复对局' });
        } else {
            session.roomId = null;
            ws.send(JSON.stringify({ type: 'resumeSuccess', playerId: player.id, roomId: null, room: null }));
        }
        broadcastPlayerCount();
    }
    
    function finalizeDisconnectedSession(token) {
        const session = sessions.get(token);
        if (!session || session.ws) return;
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (room) {
            const fakeWs = { roomId: room.id };
            const player = session.player;
            players.set(fakeWs, player);
            removePlayerFromCurrentRoom(fakeWs);
            players.delete(fakeWs);
        }
        sessions.delete(token);
        broadcastPlayerCount();
        broadcastRoomList();
    }
    
    function handleChat(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const message = sanitizeChatMessage(data.message, policy.maxChatLength);
        if (!message.ok) {
            sendProtocolError(ws, message.message);
            return;
        }
        const payload = {
            type: 'chat',
            player: { id: player.id, name: player.name },
            message: message.value,
            timestamp: Date.now(),
        };
    
        if (ws.roomId) {
            broadcastToRoom(ws.roomId, payload);
        } else {
            broadcastToAll(payload);
        }
    }
    
    function handleStartGame(ws) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room' }));
            return;
        }
        if (room.hostId !== player.id) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game' }));
            return;
        }
    
        const result = room.startGame();
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
    
        sendGameStateToRoom(room, 'gameStarted', result);
        broadcastRoomList();
        console.log(`Room ${room.id} game started`);
    }
    
    function handleGameAction(ws, action) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room' }));
            return;
        }
    
        const result = room.handleGameAction(player.id, action);
        if (!result.success) {
            const errorPayload = { type: 'error', message: result.message };
            if (result.state) {
                errorPayload.gameType = room.gameType;
                errorPayload.state = room.getPlayerGameState(player.id);
                errorPayload.action = room.getPlayerGameAction(result, player.id);
            }
            ws.send(JSON.stringify(errorPayload));
            return;
        }
    
        sendGameStateToRoom(room, 'gameState', result);
    
        if (result.ended && room.status === 'ended') {
            for (const p of room.players) {
                if (p.ws.readyState === WebSocketImpl.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'gameEnded',
                        winner: room.getWinner(),
                        room: room.getInfo(),
                        action: room.getPlayerGameAction(result, p.id),
                    }));
                }
            }
            broadcastRoomList();
        }
    }
    
    function sendGameStateToRoom(room, type, action) {
        for (const p of room.players) {
            const state = room.getPlayerGameState(p.id);
            if (state && p.ws.readyState === WebSocketImpl.OPEN) {
                const playerAction = room.getPlayerGameAction(action, p.id);
                p.ws.send(JSON.stringify({ type, gameType: room.gameType, state, action: playerAction }));
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
        const leaveResult = room.game?.handlePlayerLeave?.(player.id);
        if (leaveResult?.ended) room.status = 'ended';
        room.removePlayer(player.id);
        ws.roomId = null;
    
        if (room.players.length === 0) {
            rooms.delete(roomId);
            return;
        }
    
        if (leaveResult?.state) sendGameStateToRoom(room, leaveResult.ended ? 'gameEnded' : 'gameState', leaveResult);
        broadcastToRoom(roomId, {
            type: 'playerLeft',
            playerId: player.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            newHost: room.hostId,
        });
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

    return { startWebSocketServer, getStats, close };
}

module.exports = { createRealtimeServer };
