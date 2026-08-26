const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { networkInterfaces } = require('os');
const crypto = require('crypto');

const Room = require('./server/room');
const gameRegistry = require('./server/games/registry');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));

let wss = null;
const players = new Map();
const rooms = new Map();
const sessions = new Map();
let roomIdCounter = 1;
const RECONNECT_GRACE_MS = 30_000;

function generateRoomId() {
    return String(roomIdCounter++).padStart(6, '0');
}

function startWebSocketServer(server) {
    if (wss) return wss;
    wss = new WebSocket.Server({ server });
    const systemTick = setInterval(() => {
        for (const room of rooms.values()) {
            const result = room.handleSystemTick?.();
            if (result?.state) sendGameStateToRoom(room, result.ended ? 'gameEnded' : 'gameState', result);
        }
    }, 1000);
    systemTick.unref?.();
    wss.on('connection', (ws) => {
    const playerId = 'p' + Date.now() + Math.random().toString(36).substr(2, 4);
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
            handleMessage(ws, JSON.parse(message.toString()));
        } catch (e) {
            console.log('Failed to parse message:', e.message);
        }
    });

    ws.on('close', () => {
        const player = players.get(ws);
        if (!player) return;

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
                const room = session.roomId ? rooms.get(session.roomId) : null;
                const disconnectResult = room?.game?.handlePlayerDisconnect?.(player.id);
                if (room && disconnectResult?.state) sendGameStateToRoom(room, 'gameState', disconnectResult);
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

    switch (data.type) {
        case 'createRoom':
            handleCreateRoom(ws, data);
            break;
        case 'joinRoom':
            handleJoinRoom(ws, data);
            break;
        case 'leaveRoom':
            handleLeaveRoom(ws);
            break;
        case 'configureRoom':
            handleConfigureRoom(ws, data);
            break;
        case 'chat':
            handleChat(ws, data);
            break;
        case 'setName':
            player.name = data.name || player.name;
            if (ws.roomId) {
                const room = rooms.get(ws.roomId);
                const roomPlayer = room?.players.find(p => p.id === player.id);
                if (roomPlayer) roomPlayer.name = player.name;
                if (room) broadcastToRoom(room.id, { type: 'playerRenamed', playerId: player.id, name: player.name, room: room.getInfo(), players: room.getPlayerInfo() });
            }
            broadcastPlayerCount();
            break;
        case 'resumeSession':
            handleResumeSession(ws, data);
            break;
        case 'startGame':
            handleStartGame(ws);
            break;
        case 'gameAction':
            handleGameAction(ws, data.action);
            break;
        case 'discardCard':
        case 'playCard':
            handleGameAction(ws, {
                kind: data.type,
                cardIndex: data.cardIndex,
                targetId: data.targetId,
                guess: data.guess,
            });
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleCreateRoom(ws, data) {
    const player = players.get(ws);
    if (!player) return;
    if (ws.roomId) {
        ws.send(JSON.stringify({ type: 'error', message: '请先离开当前房间' }));
        return;
    }

    const gameType = data.gameType || 'loveletter';
    if (!gameRegistry.getGame(gameType)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown game type' }));
        return;
    }

    const roomId = generateRoomId();
    if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: null });
    ws.intentionalLeave = false;
    let room;
    try {
        room = new Room(roomId, player.id, player.name, gameType, data.gameOptions, {
            roomName: data.roomName,
            isPublic: data.isPublic,
            seatLimit: data.seatLimit,
        });
    } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
        return;
    }

    room.addPlayer({ id: player.id, name: player.name, ws });
    rooms.set(roomId, room);
    ws.roomId = roomId;
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
        ws.send(JSON.stringify({ type: 'error', message: 'Room does not exist' }));
        return;
    }

    const result = room.addPlayer({ id: player.id, name: player.name, ws });
    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.message }));
        return;
    }

    ws.roomId = room.id;
    ws.intentionalLeave = false;
    if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: room.id });
    const session = sessions.get(player.sessionToken); if (session) session.roomId = room.id;

    broadcastToRoom(room.id, {
        type: 'playerJoined',
        player: { id: player.id, name: player.name },
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

function handleConfigureRoom(ws, data) {
    const player = players.get(ws);
    const room = ws.roomId ? rooms.get(ws.roomId) : null;
    if (!player || !room) {
        ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
        return;
    }
    const result = room.configure(player.id, { playerCount: data.playerCount, encryptorMode: data.encryptorMode });
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
    if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
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
    if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
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
        const reconnectResult = room.game?.handlePlayerReconnect?.(player.id);
        ws.send(JSON.stringify({ type: 'resumeSuccess', playerId: player.id, roomId: room.id, room: room.getInfo() }));
        broadcastToRoom(room.id, { type: 'playerReconnected', player: { id: player.id, name: player.name }, room: room.getInfo(), players: room.getPlayerInfo() });
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

    const payload = {
        type: 'chat',
        player: { id: player.id, name: player.name },
        message: data.message,
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
            if (p.ws.readyState === WebSocket.OPEN) {
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
        if (state && p.ws.readyState === WebSocket.OPEN) {
            const playerAction = room.getPlayerGameAction(action, p.id);
            p.ws.send(JSON.stringify({ type, gameType: room.gameType, state, action: playerAction }));
        }
    }
}

function sendGameStateToPlayer(room, playerId, ws, type, action) {
    const state = room.getPlayerGameState(playerId);
    if (!state || ws.readyState !== WebSocket.OPEN) return;
    const playerAction = room.getPlayerGameAction(action, playerId);
    ws.send(JSON.stringify({ type, gameType: room.gameType, state, action: playerAction }));
}

function sendGameList(ws) {
    ws.send(JSON.stringify({ type: 'gameList', games: gameRegistry.listGames() }));
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

function broadcastToAll(data) {
    const message = JSON.stringify(data);
    players.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

function broadcastToRoom(roomId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    const message = JSON.stringify(data);
    room.players.forEach(({ ws }) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
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

function isUsableLanIp(name, address) {
    const lowerName = name.toLowerCase();
    if (
        lowerName.includes('vmware') ||
        lowerName.includes('virtual') ||
        lowerName.includes('loopback') ||
        lowerName.includes('bluetooth') ||
        lowerName.includes('meta')
    ) {
        return false;
    }
    if (address.startsWith('198.18.') || address.startsWith('169.254.')) {
        return false;
    }
    return (
        address.startsWith('192.168.') ||
        address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
}

function getLanIp() {
    const nets = networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                candidates.push({ name, address: net.address });
            }
        }
    }

    const preferred = candidates.find(({ name, address }) => isUsableLanIp(name, address));
    return preferred?.address || candidates[0]?.address || '127.0.0.1';
}

app.get('/api/ip', (req, res) => {
    res.json({ ip: getLanIp() });
});

app.startWebSocketServer = startWebSocketServer;
module.exports = app;

console.log('Lobby is ready');
