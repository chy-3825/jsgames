const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { networkInterfaces } = require('os');

const Room = require('./server/room');
const gameRegistry = require('./server/games/registry');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

let wss = null;
const players = new Map();
const rooms = new Map();
let roomIdCounter = 1;

function generateRoomId() {
    return String(roomIdCounter++).padStart(6, '0');
}

function startWebSocketServer(server) {
    if (wss) return wss;
    wss = new WebSocket.Server({ server });
    wss.on('connection', (ws) => {
    const playerId = 'p' + Date.now() + Math.random().toString(36).substr(2, 4);
    players.set(ws, { id: playerId, name: 'Player' + playerId.substr(1, 4) });

    console.log(`Player ${players.get(ws).name} connected`);
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
        removePlayerFromCurrentRoom(ws);
        players.delete(ws);
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
        case 'chat':
            handleChat(ws, data);
            break;
        case 'setName':
            player.name = data.name || player.name;
            broadcastPlayerCount();
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

    const gameType = data.gameType || 'loveletter';
    if (!gameRegistry.getGame(gameType)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown game type' }));
        return;
    }

    const roomId = generateRoomId();
    let room;
    try {
        room = new Room(roomId, player.id, player.name, gameType);
    } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
        return;
    }

    room.addPlayer({ id: player.id, name: player.name, ws });
    rooms.set(roomId, room);
    ws.roomId = roomId;

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

    const room = rooms.get(data.roomId);
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

function handleLeaveRoom(ws) {
    const player = players.get(ws);
    if (!player || !ws.roomId) return;

    const roomId = ws.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.removePlayer(player.id);
    ws.roomId = null;

    if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted`);
    } else {
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
        ws.send(JSON.stringify({ type: 'error', message: result.message }));
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

function sendGameList(ws) {
    ws.send(JSON.stringify({ type: 'gameList', games: gameRegistry.listGames() }));
}

function broadcastRoomList() {
    broadcastToAll({ type: 'roomList', rooms: Array.from(rooms.values()).map(room => room.getInfo()) });
}

function sendRoomList(ws) {
    ws.send(JSON.stringify({ type: 'roomList', rooms: Array.from(rooms.values()).map(room => room.getInfo()) }));
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
    room.removePlayer(player.id);
    ws.roomId = null;

    if (room.players.length === 0) {
        rooms.delete(roomId);
        return;
    }

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






