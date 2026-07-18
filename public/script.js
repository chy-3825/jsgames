const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const lobbyViewEl = document.getElementById('lobbyView');
const roomViewEl = document.getElementById('roomView');
const roomListEl = document.getElementById('roomList');
const roomMount = document.getElementById('roomMount');
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
const currentRoomPanel = document.getElementById('currentRoomPanel');
const currentRoomInfo = document.getElementById('currentRoomInfo');
const currentRoomPlayers = document.getElementById('currentRoomPlayers');
const lobbyStartGameBtn = document.getElementById('lobbyStartGameBtn');
const lobbyLeaveRoomBtn = document.getElementById('lobbyLeaveRoomBtn');

window.addEventListener('error', event => {
    showFatalError(event.error || event.message || '未知错误');
});

window.addEventListener('unhandledrejection', event => {
    showFatalError(event.reason || '未知 Promise 错误');
});

function showFatalError(error) {
    const message = error?.message || String(error);
    console.error(error);
    document.body.classList.remove('is-game-view');
    const box = document.getElementById('fatalErrorBox') || document.createElement('div');
    box.id = 'fatalErrorBox';
    box.className = 'panel fatal-error-box';
    box.innerHTML = `<strong>页面出错了</strong><span>${escapeHtml(message)}</span>`;
    document.getElementById('app')?.prepend(box);
}

let ws = null;
let myName = '玩家' + Math.random().toString(36).slice(2, 6);
let myId = null;
let currentRoomId = null;
let currentRoom = null;
let currentGameClient = null;
let isConnected = false;

function connect() {
    statusEl.textContent = '连接中...';
    statusEl.style.background = '#1a1a3e';

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
        isConnected = true;
        statusEl.textContent = '已连接';
        statusEl.style.background = '#1b5e20';
        addLog('连接成功', 'system');
        nameInput.value = myName;
        send({ type: 'setName', name: myName });
    };

    ws.onmessage = async event => {
        try {
            await handleMessage(JSON.parse(event.data));
        } catch (error) {
            console.log('Failed to handle message:', error);
        }
    };

    ws.onclose = () => {
        isConnected = false;
        statusEl.textContent = '连接断开';
        statusEl.style.background = '#b71c1c';
        addLog('连接已断开，正在重连...', 'error');
        setTimeout(connect, 3000);
    };

    ws.onerror = () => addLog('连接出错', 'error');
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
            playerCountEl.textContent = `在线: ${data.count}`;
            break;
        case 'roomCreated':
            myId = data.playerId;
            currentRoomId = data.roomId;
            currentRoom = data.room;
            addLog(`房间 ${data.roomId} 创建成功`, 'system');
            enterWaitingRoom();
            break;
        case 'joinSuccess':
            myId = data.playerId;
            currentRoomId = data.roomId;
            currentRoom = data.room;
            addLog(`成功加入房间 ${data.roomId}`, 'system');
            enterWaitingRoom();
            break;
        case 'playerJoined':
            addLog(`${data.player.name} 加入了房间`, 'info');
            currentRoom = data.room || currentRoom;
            renderWaitingRoomPanel();
            break;
        case 'playerLeft':
            addLog('有玩家离开了房间', 'info');
            currentRoom = data.room || currentRoom;
            renderWaitingRoomPanel();
            break;
        case 'chat':
            addLog(`${data.player.id === myId ? '我' : data.player.name}: ${data.message}`, 'chat');
            break;
        case 'gameStarted':
            if (currentRoom) currentRoom.status = 'playing';
            await showGameMessage(data);
            break;
        case 'gameState':
        case 'gameEnded':
            await showGameMessage(data);
            if (data.type === 'gameEnded' && data.winner) {
                if (currentRoom) currentRoom.status = 'ended';
                addLog(`${data.winner.name} 获胜`, 'system');
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
        gameTypeSelect.innerHTML = '<option value="loveletter">情书</option>';
        return;
    }
    gameTypeSelect.innerHTML = games
        .map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`)
        .join('');
}

function renderRoomList(rooms) {
    if (!rooms || rooms.length === 0) {
        roomListEl.innerHTML = '<div class="empty">暂无房间</div>';
        return;
    }

    roomListEl.innerHTML = rooms.map(room => `
        <div class="room-item">
            <div class="info">
                <span class="room-name">房间 ${escapeHtml(room.id)}</span>
                <span class="room-detail">
                    ${escapeHtml(room.gameName || room.gameType)} -
                    ${room.playerCount}/${room.maxPlayers} 人 -
                    ${roomStatusText(room.status)}
                </span>
            </div>
            ${room.status !== 'playing' && room.status !== 'ended' && !isInRoom(room.id)
                ? `<button class="join-btn" data-room-id="${escapeHtml(room.id)}">加入</button>`
                : `<span class="room-state">${isInRoom(room.id) ? '已加入' : '不可加入'}</span>`}
        </div>
    `).join('');
}

function enterWaitingRoom() {
    document.body.classList.remove('is-game-view');
    lobbyViewEl.style.display = 'block';
    roomViewEl.style.display = 'none';
    roomMount.innerHTML = '';
    destroyGameClient();
    renderWaitingRoomPanel();
}

function renderWaitingRoomPanel() {
    if (!currentRoom || !currentRoomId || currentRoom.status === 'playing') {
        currentRoomPanel.style.display = 'none';
        return;
    }

    const players = currentRoom.players || [];
    const minPlayers = currentRoom.minPlayers || 2;
    const canStart = currentRoom.hostId === myId && currentRoom.status === 'waiting' && players.length >= minPlayers;

    currentRoomPanel.style.display = 'block';
    currentRoomInfo.innerHTML = `
        <div><span class="highlight">${escapeHtml(currentRoom.gameName || currentRoom.gameType)}</span> 房间 ${escapeHtml(currentRoom.id)}</div>
        <div>${roomStatusText(currentRoom.status)} - ${players.length}/${currentRoom.maxPlayers} 人，至少 ${minPlayers} 人可开始</div>
    `;
    currentRoomPlayers.innerHTML = players.map(player => `
        <div class="game-room-player ${player.id === currentRoom.hostId ? 'is-host' : ''}">
            <span>${player.id === currentRoom.hostId ? '[房主] ' : ''}${escapeHtml(player.name)}${player.id === myId ? ' (我)' : ''}</span>
        </div>
    `).join('');
    lobbyStartGameBtn.style.display = canStart ? 'inline-block' : 'none';
    createRoomBtn.disabled = Boolean(currentRoomId);
    gameTypeSelect.disabled = Boolean(currentRoomId);
}

function openGameView() {
    document.body.classList.add('is-game-view');
    lobbyViewEl.style.display = 'none';
    roomViewEl.style.display = 'block';
    currentRoomPanel.style.display = 'none';
    roomMount.innerHTML = '';
    gameMount.style.display = 'block';
    startGameBtn.style.display = 'none';
}

function returnToLobby() {
    document.body.classList.remove('is-game-view');
    lobbyViewEl.style.display = 'block';
    roomViewEl.style.display = 'none';
    currentRoomPanel.style.display = 'none';
    roomMount.innerHTML = '';
    destroyGameClient();
    createRoomBtn.disabled = false;
    gameTypeSelect.disabled = false;
}

async function showGameMessage(data) {
    const gameType = data.gameType || currentRoom?.gameType;
    try {
        await prepareGameClient(gameType);
        openGameView();
        currentGameClient?.handleMessage(data);
    } catch (error) {
        console.error('Failed to open game client:', error);
        addLog(`游戏界面加载失败：${error.message}`, 'error');
        showGameError(error);
    }
}

async function prepareGameClient(gameType) {
    if (!gameType) throw new Error('缺少游戏类型');
    if (currentGameClient?.gameType === gameType) return;
    destroyGameClient();
    const module = await import(`/games/${gameType}/client.js?v=${Date.now()}`);
    if (typeof module.createGameClient !== 'function') {
        throw new Error(`${gameType} 没有导出 createGameClient`);
    }
    currentGameClient = module.createGameClient({
        mount: gameMount,
        send,
        addLog,
    });
}

function showGameError(error) {
    document.body.classList.remove('is-game-view');
    lobbyViewEl.style.display = 'block';
    roomViewEl.style.display = 'none';
    currentRoomPanel.style.display = 'block';
    renderWaitingRoomPanel();
    const message = error?.message || String(error);
    currentRoomInfo.insertAdjacentHTML('beforeend', `<div class="load-error">游戏界面加载失败：${escapeHtml(message)}</div>`);
}

function destroyGameClient() {
    currentGameClient?.destroy?.();
    currentGameClient = null;
    gameMount.innerHTML = '';
    gameMount.style.display = 'none';
}

function joinRoom(roomId) {
    if (!isConnected) return addLog('未连接到服务器', 'error');
    if (currentRoomId) return addLog('请先离开当前房间', 'error');
    send({ type: 'joinRoom', roomId });
}

function leaveRoom() {
    if (!currentRoomId) return;
    send({ type: 'leaveRoom' });
    currentRoomId = null;
    currentRoom = null;
    returnToLobby();
    addLog('已离开房间', 'system');
}

function createRoom() {
    if (!isConnected) return addLog('未连接到服务器', 'error');
    if (currentRoomId) return addLog('请先离开当前房间', 'error');
    const gameType = gameTypeSelect.value;
    send({ type: 'createRoom', gameType });
    addLog(`正在创建 ${gameType} 房间`, 'system');
}

function startGame() {
    if (!currentRoomId) return;
    send({ type: 'startGame' });
}

function sendChat() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!isConnected) return addLog('未连接到服务器', 'error');
    send({ type: 'chat', message });
    chatInput.value = '';
}

function setName() {
    const name = nameInput.value.trim();
    if (!name) return;
    myName = name;
    if (isConnected) send({ type: 'setName', name });
    addLog(`已改名为 ${name}`, 'system');
}

function send(payload) {
    ws?.send(JSON.stringify(payload));
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

function roomStatusText(status) {
    if (status === 'playing') return '游戏中';
    if (status === 'ended') return '已结束';
    return '等待中';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

createRoomBtn.addEventListener('click', createRoom);
leaveRoomBtn.addEventListener('click', leaveRoom);
startGameBtn.addEventListener('click', startGame);
lobbyStartGameBtn.addEventListener('click', startGame);
lobbyLeaveRoomBtn.addEventListener('click', leaveRoom);
sendChatBtn.addEventListener('click', sendChat);
setNameBtn.addEventListener('click', setName);
roomListEl.addEventListener('click', event => {
    const button = event.target.closest('[data-room-id]');
    if (button) joinRoom(button.dataset.roomId);
});
chatInput.addEventListener('keydown', event => { if (event.key === 'Enter') sendChat(); });
nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') setName(); });

nameInput.value = myName;
connect();

const inviteUrl = location.origin;
const ipDisplayEl = document.getElementById('ipDisplay');
ipDisplayEl.textContent = inviteUrl;
ipDisplayEl.title = '点击复制邀请链接';
ipDisplayEl.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(inviteUrl);
        addLog('邀请链接已复制', 'system');
    } catch (error) {
        addLog('复制失败，请手动复制邀请链接', 'error');
    }
});