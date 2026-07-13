const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const roomListEl = document.getElementById('roomList');
const currentRoomEl = document.getElementById('currentRoom');
const roomInfoEl = document.getElementById('roomInfo');
const nameInput = document.getElementById('nameInput');
const setNameBtn = document.getElementById('setNameBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const gameTypeSelect = document.getElementById('gameTypeSelect');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const startGameBtn = document.getElementById('startGameBtn');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const playerCountEl = document.getElementById('playerCount');
const gameMount = document.getElementById('gameMount');

let ws = null;
let myName = '\u73a9\u5bb6' + Math.random().toString(36).substr(2, 4);
let myId = null;
let currentRoomId = null;
let currentRoom = null;
let currentGameClient = null;
let isConnected = false;

function connect() {
    statusEl.textContent = '\u8fde\u63a5\u4e2d...';
    statusEl.style.background = '#1a1a3e';

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
        isConnected = true;
        statusEl.textContent = '\u5df2\u8fde\u63a5';
        statusEl.style.background = '#1b5e20';
        addLog('\u8fde\u63a5\u6210\u529f', 'system');
        nameInput.value = myName;
        ws.send(JSON.stringify({ type: 'setName', name: myName }));
    };

    ws.onmessage = async (event) => {
        try {
            await handleMessage(JSON.parse(event.data));
        } catch (e) {
            console.log('Failed to parse message:', e);
        }
    };

    ws.onclose = () => {
        isConnected = false;
        statusEl.textContent = '\u8fde\u63a5\u65ad\u5f00';
        statusEl.style.background = '#b71c1c';
        addLog('\u8fde\u63a5\u5df2\u65ad\u5f00', 'error');
        setTimeout(connect, 3000);
    };

    ws.onerror = () => addLog('\u8fde\u63a5\u51fa\u9519', 'error');
}

async function handleMessage(data) {
    switch (data.type) {
        case 'gameList':
            renderGameList(data.games);
            break;
        case 'roomList':
            renderRoomList(data.rooms);
            break;
        case 'playerCount':
            playerCountEl.textContent = `\u5728\u7ebf: ${data.count}`;
            break;
        case 'roomCreated':
            myId = data.playerId;
            currentRoomId = data.roomId;
            currentRoom = data.room;
            addLog(`\u623f\u95f4 ${data.roomId} \u521b\u5efa\u6210\u529f`, 'system');
            updateCurrentRoom(data.room);
            await prepareGameClient(data.room.gameType);
            break;
        case 'joinSuccess':
            myId = data.playerId;
            currentRoomId = data.roomId;
            currentRoom = data.room;
            addLog(`\u6210\u529f\u52a0\u5165\u623f\u95f4 ${data.roomId}`, 'system');
            updateCurrentRoom(data.room);
            await prepareGameClient(data.room.gameType);
            break;
        case 'playerJoined':
            addLog(`${data.player.name} \u52a0\u5165\u4e86\u623f\u95f4`, 'info');
            currentRoom = data.room || currentRoom;
            updateCurrentRoom(currentRoom || { players: data.players || [] });
            break;
        case 'playerLeft':
            addLog('\u6709\u73a9\u5bb6\u79bb\u5f00\u4e86\u623f\u95f4', 'info');
            currentRoom = data.room || currentRoom;
            updateCurrentRoom(currentRoom || { players: data.players || [] });
            break;
        case 'chat':
            addLog(`${data.player.id === myId ? '\u6211' : data.player.name}: ${data.message}`, 'chat');
            break;
        case 'gameStarted':
        case 'gameState':
        case 'gameEnded':
            await prepareGameClient(data.gameType || currentRoom?.gameType);
            currentGameClient?.handleMessage(data);
            if (data.type === 'gameEnded' && data.winner) {
                addLog(`${data.winner.name} \u83b7\u80dc`, 'system');
            }
            break;
        case 'error':
            addLog(data.message, 'error');
            break;
        default:
            console.log('Unknown message:', data);
    }
}

function renderGameList(games) {
    if (!games || games.length === 0) {
        gameTypeSelect.innerHTML = '<option value="loveletter">\u60c5\u4e66</option>';
        return;
    }
    gameTypeSelect.innerHTML = games
        .map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`)
        .join('');
}

function renderRoomList(rooms) {
    if (!rooms || rooms.length === 0) {
        roomListEl.innerHTML = '<div class="empty">\u6682\u65e0\u623f\u95f4</div>';
        return;
    }

    roomListEl.innerHTML = rooms.map(room => `
        <div class="room-item">
            <div class="info">
                <span class="room-name">\u623f\u95f4 ${escapeHtml(room.id)}</span>
                <span class="room-detail">
                    ${escapeHtml(room.gameName || room.gameType)} -
                    ${room.playerCount}/${room.maxPlayers} \u4eba -
                    ${room.status === 'playing' ? '\u6e38\u620f\u4e2d' : '\u7b49\u5f85\u4e2d'}
                </span>
            </div>
            ${room.status !== 'playing' && !isInRoom(room.id)
                ? `<button class="join-btn" data-room-id="${escapeHtml(room.id)}">\u52a0\u5165</button>`
                : `<span class="room-state">${isInRoom(room.id) ? '\u5df2\u52a0\u5165' : '\u6e38\u620f\u4e2d'}</span>`}
        </div>
    `).join('');
}

function updateCurrentRoom(room) {
    if (!room) return;
    currentRoomEl.style.display = 'block';
    const players = room.players || [];
    roomInfoEl.innerHTML = `
        <div>\u73a9\u5bb6\u5217\u8868:</div>
        ${players.map(p => `<div class="player-row">${p.isHost ? '[\u623f\u4e3b] ' : ''}${escapeHtml(p.name)}${p.id === myId ? ' (\u6211)' : ''}</div>`).join('')}
        <div class="room-summary">${escapeHtml(room.gameName || room.gameType)} - \u5171 ${players.length} \u4eba</div>
    `;

    const canStart = room.hostId === myId && room.status === 'waiting' && players.length >= (room.minPlayers || 2);
    startGameBtn.style.display = canStart ? 'inline-block' : 'none';
}

async function prepareGameClient(gameType) {
    if (!gameType || currentGameClient?.gameType === gameType) return;
    const module = await import(`/games/${gameType}/client.js?v=${Date.now()}`);
    currentGameClient?.destroy?.();
    currentGameClient = module.createGameClient({
        mount: gameMount,
        send: payload => ws.send(JSON.stringify(payload)),
        addLog,
    });
    gameMount.style.display = 'block';
}

function joinRoom(roomId) {
    if (!isConnected) return addLog('\u672a\u8fde\u63a5\u5230\u670d\u52a1\u5668', 'error');
    if (currentRoomId) return addLog('\u8bf7\u5148\u79bb\u5f00\u5f53\u524d\u623f\u95f4', 'error');
    ws.send(JSON.stringify({ type: 'joinRoom', roomId }));
}

function leaveRoom() {
    if (!currentRoomId) return;
    ws.send(JSON.stringify({ type: 'leaveRoom' }));
    currentRoomId = null;
    currentRoom = null;
    currentRoomEl.style.display = 'none';
    startGameBtn.style.display = 'none';
    currentGameClient?.destroy?.();
    currentGameClient = null;
    gameMount.innerHTML = '';
    gameMount.style.display = 'none';
    addLog('\u5df2\u79bb\u5f00\u623f\u95f4', 'system');
}

function createRoom() {
    if (!isConnected) return addLog('\u672a\u8fde\u63a5\u5230\u670d\u52a1\u5668', 'error');
    if (currentRoomId) return addLog('\u8bf7\u5148\u79bb\u5f00\u5f53\u524d\u623f\u95f4', 'error');
    const gameType = gameTypeSelect.value;
    ws.send(JSON.stringify({ type: 'createRoom', gameType }));
    addLog(`\u6b63\u5728\u521b\u5efa ${gameType} \u623f\u95f4`, 'system');
}

function startGame() {
    if (!currentRoomId) return;
    ws.send(JSON.stringify({ type: 'startGame' }));
}

function sendChat() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!isConnected) return addLog('\u672a\u8fde\u63a5\u5230\u670d\u52a1\u5668', 'error');
    ws.send(JSON.stringify({ type: 'chat', message }));
    chatInput.value = '';
}

function setName() {
    const name = nameInput.value.trim();
    if (!name) return;
    myName = name;
    if (isConnected) ws.send(JSON.stringify({ type: 'setName', name }));
    addLog(`\u5df2\u6539\u540d\u4e3a ${name}`, 'system');
}

function addLog(msg, type = 'chat') {
    const div = document.createElement('div');
    div.className = 'msg-' + type;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

function isInRoom(roomId) {
    return currentRoomId === roomId;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }[char]));
}

createRoomBtn.addEventListener('click', createRoom);
leaveRoomBtn.addEventListener('click', leaveRoom);
startGameBtn.addEventListener('click', startGame);
sendChatBtn.addEventListener('click', sendChat);
setNameBtn.addEventListener('click', setName);
roomListEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-room-id]');
    if (button) joinRoom(button.dataset.roomId);
});
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') setName(); });

nameInput.value = myName;
connect();

fetch('/api/ip')
    .then(res => res.json())
    .then(data => {
        document.getElementById('ipDisplay').textContent = `${location.protocol}//${data.ip}${location.port ? ':' + location.port : ''}`;
    })
    .catch(() => {
        document.getElementById('ipDisplay').textContent = '\u8bf7\u67e5\u770b\u7ec8\u7aef\u663e\u793a\u7684 IP';
    });


