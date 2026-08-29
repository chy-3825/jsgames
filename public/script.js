import { getGameDetails } from './game-details.js';
import { escapeHtml } from './games/common/html.js';
import { getGameClientPath as getManifestClientPath, getGameStyleHrefs } from './games/common/game-manifest.js';
import { GAME_PRESENTATION, GROUP_PRESENTATION, PLAY_MODE_LABELS, GAME_COVERS, GAME_COVER_THUMBS, BGG_ART, SELF_STYLED_GAME_ART, BGG_BACKGROUND_ART, BGG_COMPONENT_ART, BGG_COMPONENT_LABELS } from './lobby/catalog-data.js';
import { createGameLoader } from './lobby/game-loader.js';
import { createLobbyTransport } from './lobby/transport.js';
import { createCatalogView } from './lobby/catalog-view.js';
import { createLobbyArtwork } from './lobby/artwork.js';
import { createRoomDialogController } from './lobby/room-dialog.js';
import { createWaitingRoomScene } from './lobby/waiting-room-scene.js';
import { createGameEntryTransition } from './lobby/game-entry-transition.js';
import { createStudyControls } from './lobby/study-controls.js';

const ASSET_VERSION = '20260829-architecture-1';
window.__JSGAMES_ASSET_VERSION__ = ASSET_VERSION;

const statusEl = document.getElementById('status');
const onlineIndicatorEl = document.getElementById('onlineIndicator');
const logEl = document.getElementById('log');
const lobbyViewEl = document.getElementById('lobbyView');
const roomViewEl = document.getElementById('roomView');
const roomListEl = document.getElementById('roomList');
const mobileRoomListEl = document.getElementById('mobileRoomList');
const mobileRoomCountLabel = document.getElementById('mobileRoomCountLabel');
const openMobileRoomsBtn = document.getElementById('openMobileRoomsBtn');
const mobileRoomsDrawer = document.getElementById('mobileRoomsDrawer');
const roomMount = document.getElementById('roomMount');
const roomFeedbackEl = document.getElementById('roomFeedback');
const roomConnectionStateEl = document.getElementById('roomConnectionState');
const nameInput = document.getElementById('nameInput');
const setNameBtn = document.getElementById('setNameBtn');
const gameTypeSelect = document.getElementById('gameTypeSelect');
const gamePickerEl = document.getElementById('gamePicker');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const startGameBtn = document.getElementById('startGameBtn');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const playerCountEl = document.getElementById('playerCount');
const gameMount = document.getElementById('gameMount');
const currentRoomPanel = document.getElementById('currentRoomPanel');
const lobbyStartGameBtn = document.getElementById('lobbyStartGameBtn');
const lobbyLeaveRoomBtn = document.getElementById('lobbyLeaveRoomBtn');
const profileAvatar = document.getElementById('profileAvatar');
const roomCountLabel = document.getElementById('roomCountLabel');
const roomPageGame = document.getElementById('roomPageGame');
const roomPageCode = document.getElementById('roomPageCode');
const roomPageIdentity = document.getElementById('roomPageIdentity');
const gameCountEl = document.getElementById('gameCount');
const gameFilterEl = document.getElementById('gameFilter');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinCodeBtn = document.getElementById('joinCodeBtn');
const createRoomDialog = document.getElementById('createRoomDialog');
const createRoomDialogClose = document.getElementById('createRoomDialogClose');
const createRoomRuleHero = document.getElementById('createRoomRuleHero');
const createRoomRuleSymbol = document.getElementById('createRoomRuleSymbol');
const createRoomRuleEnglish = document.getElementById('createRoomRuleEnglish');
const createRoomDialogTitle = document.getElementById('createRoomDialogTitle');
const createRoomRuleOverview = document.getElementById('createRoomRuleOverview');
const createRoomRulePlayers = document.getElementById('createRoomRulePlayers');
const createRoomRuleTime = document.getElementById('createRoomRuleTime');
const createRoomRuleMode = document.getElementById('createRoomRuleMode');
const createRoomRuleList = document.getElementById('createRoomRuleList');
const createRoomRuleNote = document.getElementById('createRoomRuleNote');
const createRoomNextBtn = document.getElementById('createRoomNextBtn');
const createRoomForm = document.getElementById('createRoomForm');
const createRoomName = document.getElementById('createRoomName');
const createRoomCapacityField = document.getElementById('createRoomCapacityField');
const createRoomCapacityOptions = document.getElementById('createRoomCapacityOptions');
const createRoomSpecialSettings = document.getElementById('createRoomSpecialSettings');
const createRoomFormError = document.getElementById('createRoomFormError');
const createRoomBackBtn = document.getElementById('createRoomBackBtn');
const createRoomCancelBtn = document.getElementById('createRoomCancelBtn');
const createRoomConfirmBtn = document.getElementById('createRoomConfirmBtn');
const lobbyEntryEl = document.getElementById('lobbyEntry');
const entryStartBtn = document.getElementById('entryStartBtn');
const entryJoinBtn = document.getElementById('entryJoinBtn');
const entryNameInput = document.getElementById('entryNameInput');
const entryAvatar = document.getElementById('entryAvatar');
const entryConnectionStatus = document.getElementById('entryConnectionStatus');
const appHeaderEl = document.getElementById('appHeader');
const brandLinks = Array.from(document.querySelectorAll('a.brand'));
const joinLobbyViewEl = document.getElementById('joinLobbyView');
const joinLobbyBackBtn = document.getElementById('joinLobbyBackBtn');
const joinLobbyStartBtn = document.getElementById('joinLobbyStartBtn');
const joinLobbyFooterStartBtn = document.getElementById('joinLobbyFooterStartBtn');
const joinLobbyOnlineIndicator = document.getElementById('joinLobbyOnlineIndicator');
const joinLobbyPlayerCountEl = document.getElementById('joinLobbyPlayerCount');
const joinLobbyConnectionStatus = document.getElementById('joinLobbyConnectionStatus');
const joinLobbyCodeForm = document.getElementById('joinLobbyCodeForm');
const joinLobbyCodeInput = document.getElementById('joinLobbyCodeInput');
const joinLobbyCodeBtn = document.getElementById('joinLobbyCodeBtn');
const joinLobbyCodeError = document.getElementById('joinLobbyCodeError');
const reconnectForm = document.getElementById('reconnectForm');
const reconnectPlayerIdInput = document.getElementById('reconnectPlayerIdInput');
const reconnectBtn = document.getElementById('reconnectBtn');
const reconnectError = document.getElementById('reconnectError');
const joinLobbyRoomListEl = document.getElementById('joinLobbyRoomList');
const joinLobbyRoomCountEl = document.getElementById('joinLobbyRoomCount');
const joinLobbyGameFilterEl = document.getElementById('joinLobbyGameFilter');

let myName = '玩家' + Math.random().toString(36).slice(2, 6);
let myId = null;
let currentRoomId = null;
let currentRoom = null;
let pendingRoomPlayerCount = 9;
let pendingEncryptorMode = 'rotation';
let pendingRoomSettings = {};
let currentGameClient = null;
let preparingGameType = null;
let preparingGameClient = null;
let gameEntryTransitionPromise = null;
let activeCreateRoomGame = null;
let createRoomRequestPending = false;
let isConnected = false;
let gameList = [];
let selectedGameFilter = 'all';
let selectedJoinRoomFilter = 'all';
let publicRooms = [];
let joinLobbyJoinPending = false;
let reconnectRequestPending = false;
let reconnectRoomId = null;
let sessionResumePending = false;
let entryExitTimer = null;
let entryReturnTimer = null;
let waitingRoomScene = null;
let roomFeedbackTimer = null;
let roomFeedbackHideTimer = null;

// Session identity is intentionally scoped to this browser tab.  A second
// tab must not silently take over the first tab's player seat.
const sessionStorageKey = 'jsgames.sessionToken';
let sessionToken = sessionStorage.getItem(sessionStorageKey) || '';
let pendingUrlRoom = /^\d{6}$/.test(new URLSearchParams(location.search).get('room') || '')
    ? new URLSearchParams(location.search).get('room')
    : null;
sessionResumePending = Boolean(sessionToken);

const lobbyArtwork = createLobbyArtwork({
    containers: { gamePickerEl, roomListEl, mobileRoomListEl, joinLobbyRoomListEl },
    lobbyView: lobbyViewEl,
    gameMount,
    bggBackgroundArt: BGG_BACKGROUND_ART,
    bggComponentArt: BGG_COMPONENT_ART,
    bggComponentLabels: BGG_COMPONENT_LABELS,
    selfStyledGameArt: SELF_STYLED_GAME_ART,
    escapeHtml,
});
const {
    refreshLazyCoverArt,
    revealGameCard,
    refreshGameCardReveal,
    applyGameArtwork,
    applyBggComponentArt,
    destroyGameArtwork,
} = lobbyArtwork;

function isBenignResizeObserverError(error) {
    const message = error?.message || String(error || '');
    return message.includes('ResizeObserver loop completed with undelivered notifications')
        || message.includes('ResizeObserver loop limit exceeded');
}

function showFatalError(error) {
    const box = document.getElementById('fatalErrorBox');
    if (!box) return;
    box.style.display = 'grid';
    box.innerHTML = `<strong>页面遇到一点问题</strong><span>${escapeHtml(error?.message || String(error))}</span><button type="button" data-dismiss-fatal>知道了</button>`;
}

window.addEventListener('error', event => {
    const error = event.error || event.message;
    if (isBenignResizeObserverError(error)) return;
    showFatalError(error || '未知错误');
});
window.addEventListener('unhandledrejection', event => showFatalError(event.reason || '未知 Promise 错误'));

function showRoomFeedback(message, tone = 'warning') {
    if (!roomFeedbackEl) return;
    window.clearTimeout(roomFeedbackTimer);
    window.clearTimeout(roomFeedbackHideTimer);
    roomFeedbackEl.hidden = false;
    roomFeedbackEl.className = `room-feedback is-${tone}`;
    roomFeedbackEl.textContent = message;
    requestAnimationFrame(() => roomFeedbackEl.classList.add('is-visible'));
    roomFeedbackTimer = window.setTimeout(() => {
        roomFeedbackEl.classList.remove('is-visible');
        roomFeedbackHideTimer = window.setTimeout(() => { roomFeedbackEl.hidden = true; }, 220);
    }, 1800);
}

function setRoomConnectionState(connectionState, message = '') {
    if (!roomConnectionStateEl) return;
    const disconnected = Array.isArray(connectionState?.disconnected) ? connectionState.disconnected : [];
    if (!connectionState?.paused && !disconnected.length) {
        roomConnectionStateEl.hidden = true;
        roomConnectionStateEl.className = 'room-connection-state';
        roomConnectionStateEl.textContent = '';
        return;
    }
    const names = disconnected.map(player => player.name || player.id).filter(Boolean);
    roomConnectionStateEl.hidden = false;
    roomConnectionStateEl.className = 'room-connection-state is-paused';
    roomConnectionStateEl.textContent = message || `游戏已暂停 · 等待 ${names.join('、') || '断线玩家'} 重连`;
}

async function handleMessage(data) {
    switch (data.type) {
        case 'session':
            if (!sessionToken && data.sessionToken) sessionToken = data.sessionToken;
            if (sessionToken) sessionStorage.setItem(sessionStorageKey, sessionToken);
            if (data.playerId) myId = data.playerId;
            break;
        case 'resumeSuccess':
            sessionResumePending = false;
            sessionToken = sessionToken || sessionStorage.getItem(sessionStorageKey) || '';
            if (data.room) {
                setCreateRoomRequestPending(false);
                closeCreateRoomDialog(true);
                setRoom(data);
                currentRoom = data.room;
                if (data.room.status === 'waiting') enterWaitingRoom();
            } else if (currentRoomId) {
                currentRoomId = null;
                currentRoom = null;
                updateInviteLink();
                returnToLobby();
            }
            addLog(data.room ? `已恢复房间 ${data.roomId}` : '会话已恢复', 'system');
            break;
        case 'resumeFailed':
            sessionResumePending = false;
            sessionStorage.removeItem(sessionStorageKey);
            sessionToken = '';
            addLog(data.message || '会话已过期', 'error');
            break;
        case 'gameList':
            renderGameList(data.games);
            break;
        case 'roomList':
            renderRoomList(data.rooms);
            break;
        case 'playerCount':
            playerCountEl.textContent = `在线 ${data.count}`;
            if (joinLobbyPlayerCountEl) joinLobbyPlayerCountEl.textContent = playerCountEl.textContent;
            break;
        case 'roomCreated':
            setCreateRoomRequestPending(false);
            closeCreateRoomDialog(true);
            setRoom(data);
            addLog(`${data.room?.roomName || '房间'}（${data.roomId}）创建成功`, 'system');
            enterWaitingRoom();
            break;
        case 'reconnectRequired':
            setJoinLobbyPending(false);
            reconnectRoomId = data.roomId;
            reconnectForm.hidden = false;
            reconnectError.textContent = '';
            joinLobbyCodeError.textContent = '';
            addLog(data.message || '请输入断线玩家 ID 进行重连', 'info');
            requestAnimationFrame(() => reconnectPlayerIdInput?.focus());
            break;
        case 'reconnectSuccess':
            reconnectRequestPending = false;
            reconnectRoomId = null;
            if (reconnectBtn) { reconnectBtn.disabled = false; reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
            reconnectForm.hidden = true;
            setRoom(data);
            currentRoom = data.room || currentRoom;
            setRoomConnectionState(currentRoom?.connectionState, '已恢复原来的座位，正在回到对局…');
            addLog(`已恢复 ${data.playerName || data.playerId} 的座位`, 'system');
            break;
        case 'reconnectFailed':
            reconnectRequestPending = false;
            if (reconnectBtn) { reconnectBtn.disabled = false; reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
            if (reconnectError) reconnectError.textContent = data.message || '重连失败，请检查房间号和玩家 ID。';
            addLog(data.message || '重连失败', 'error');
            break;
        case 'joinSuccess':
            setJoinLobbyPending(false);
            pendingUrlRoom = null;
            setRoom(data);
            addLog(`成功加入房间 ${data.roomId}`, 'system');
            enterWaitingRoom();
            break;
        case 'roomConfigured':
            currentRoom = data.room || currentRoom;
            pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || pendingRoomPlayerCount);
            pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || pendingEncryptorMode;
            pendingRoomSettings = getRoomSettingValues(currentRoom);
            updateInviteLink();
            renderWaitingRoomPanel();
            addLog(data.message || '房间人数已确认，现已公开', 'system');
            break;
        case 'playerJoined':
            currentRoom = data.room || currentRoom;
            addLog(`${data.player.name} 加入了房间`, 'info');
            renderWaitingRoomPanel();
            break;
        case 'playerLeft':
            currentRoom = data.room || currentRoom;
            addLog(data.message || '有玩家离开了房间', 'info');
            renderWaitingRoomPanel();
            break;
        case 'playerReady':
            currentRoom = data.room || currentRoom;
            addLog(data.message || '准备状态已更新', 'info');
            renderWaitingRoomPanel();
            break;
        case 'roomSettingsUpdated':
            currentRoom = data.room || currentRoom;
            pendingRoomSettings = getRoomSettingValues(currentRoom);
            pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || pendingRoomPlayerCount);
            pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || pendingEncryptorMode;
            addLog(data.message || '房间设置已更新', 'system');
            renderWaitingRoomPanel();
            break;
        case 'playerKicked':
            currentRoomId = null;
            currentRoom = null;
            pendingRoomSettings = {};
            updateInviteLink();
            returnToLobby();
            showRoomFeedback(data.message || '你已被房主移出房间', 'warning');
            addLog(data.message || '你已被房主移出房间', 'error');
            break;
        case 'playerRenamed':
            currentRoom = data.room || currentRoom;
            renderWaitingRoomPanel();
            break;
        case 'playerDisconnected':
            currentRoom = data.room || currentRoom;
            setRoomConnectionState(data.room?.connectionState, `${data.player?.name || '玩家'} 已断开连接`);
            addLog(data.message || `${data.player?.name || '玩家'} 已断线`, 'error');
            renderWaitingRoomPanel();
            break;
        case 'playerReconnected':
            currentRoom = data.room || currentRoom;
            setRoomConnectionState(data.connectionState || currentRoom?.connectionState, data.message);
            addLog(data.message || `${data.player?.name || '玩家'} 已重连`, 'system');
            if (currentRoom?.status === 'waiting') renderWaitingRoomPanel();
            break;
        case 'roomPaused':
            currentRoom = data.room || currentRoom;
            setRoomConnectionState(data.connectionState || currentRoom?.connectionState, data.message);
            addLog(data.message || '游戏已暂停，等待断线玩家重连', 'error');
            break;
        case 'roomResumed':
            currentRoom = data.room || currentRoom;
            setRoomConnectionState(data.connectionState || currentRoom?.connectionState);
            addLog(data.message || '玩家已重连，游戏恢复', 'system');
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
            setRoomConnectionState(data.state?.roomConnection || currentRoom?.connectionState);
            await showGameMessage(data);
            if (data.type === 'gameEnded' && data.winner) {
                const winnerNames = data.winner.winners?.map(winner => winner.name).join('、') || data.winner.name;
                addLog(`${winnerNames} 获胜`, 'system');
            }
            break;
        case 'error':
            // Active games receive authoritative rejected-action state so they
            // can clear pending controls and render the server snapshot.
            if (joinLobbyJoinPending) {
                setJoinLobbyPending(false, data.message || '无法加入该房间，请核对房间号。');
                addLog(data.message || '加入房间失败', 'error');
            } else if (createRoomRequestPending) {
                setCreateRoomRequestPending(false);
                createRoomFormError.textContent = data.message || '房间创建失败，请检查设置后重试';
                createRoomDialog?.classList.add('is-settings');
                addLog(data.message || '房间创建失败', 'error');
            } else if (currentGameClient?.handleMessage) currentGameClient.handleMessage(data);
            else addLog(data.message, 'error');
            break;
        default:
            break;
    }
}

function setRoom(data) {
    myId = data.playerId || myId;
    currentRoomId = data.roomId;
    currentRoom = data.room;
    const allowed = currentRoom?.allowedPlayerCounts || [];
    pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || (allowed.includes(9) ? 9 : allowed[0]) || 9);
    pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || 'rotation';
    pendingRoomSettings = getRoomSettingValues(currentRoom);
    if (currentRoom) {
        roomPageGame.textContent = currentRoom.roomName || currentRoom.gameName || currentRoom.gameType;
        roomPageCode.textContent = `${currentRoom.gameName || currentRoom.gameType} · 房间 ${currentRoom.id}`;
    }
    roomPageIdentity.textContent = myId ? `玩家 ID ${myId}` : '访客 ID';
    setRoomConnectionState(currentRoom?.connectionState);
    updateInviteLink();
}

function connect() {
    setConnectionStatus('连接中', 'is-connecting');
    transport.connect();
}

const transport = createLobbyTransport({
    getUrl: () => {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${location.host}`;
    },
    onOpen: () => {
        isConnected = true;
        setConnectionStatus('已连接', 'is-connected');
        addLog('连接成功', 'system');
        const savedName = localStorage.getItem('jsgames.playerName');
        if (savedName) myName = savedName;
        nameInput.value = myName;
        entryNameInput.value = myName;
        updateProfileAvatar();
        send({ type: 'setName', name: myName });
        sessionResumePending = Boolean(sessionToken);
        if (sessionToken) send({ type: 'resumeSession', sessionToken });
    },
    onMessage: handleMessage,
    onClose: () => {
        isConnected = false;
        sessionResumePending = Boolean(sessionToken);
        if (joinLobbyJoinPending) setJoinLobbyPending(false, '连接已断开，正在重连，请稍后再试。');
        if (createRoomRequestPending) {
            setCreateRoomRequestPending(false);
            createRoomFormError.textContent = '连接已断开，房间尚未创建，请等待重连后重试。';
        }
        setConnectionStatus('连接断开', 'is-disconnected');
        addLog('连接已断开，正在重连...', 'error');
        window.setTimeout(connect, 3000);
    },
    onError: () => addLog('连接出错', 'error'),
    onMessageError: error => {
        console.error(error);
        addLog(`消息处理失败：${error.message}`, 'error');
    },
});

const gameLoader = createGameLoader({
    assetVersion: ASSET_VERSION,
    getClientPath: getManifestClientPath,
    getStyleHrefs: getGameStyleHrefs,
    onStateChange: () => {
        if (document.body.classList.contains('is-waiting-room-view')) waitingRoomScene?.render();
    },
});
const { load: loadGameModule, preload: preloadGameClient, getState: getGamePreloadState } = gameLoader;
const catalogView = createCatalogView({
    elements: {
        gameTypeSelect, gamePickerEl, gameCountEl, joinLobbyGameFilterEl,
        roomListEl, mobileRoomListEl, mobileRoomCountLabel, roomCountLabel,
        joinLobbyRoomListEl, joinLobbyRoomCountEl,
    },
    escapeHtml,
    gamePresentation: GAME_PRESENTATION,
    groupPresentation: GROUP_PRESENTATION,
    playModeLabels: PLAY_MODE_LABELS,
    gameCoverThumbs: GAME_COVER_THUMBS,
    bggArt: BGG_ART,
    getGameList: () => gameList,
    setGameList: value => { gameList = value; },
    getSelectedGameFilter: () => selectedGameFilter,
    setSelectedGameFilter: value => { selectedGameFilter = value; },
    getSelectedJoinRoomFilter: () => selectedJoinRoomFilter,
    setSelectedJoinRoomFilter: value => { selectedJoinRoomFilter = value; },
    getPublicRooms: () => publicRooms,
    setPublicRooms: value => { publicRooms = value; },
    isInRoom,
    roomStatusText,
    addLog,
    openCreateRoomDialog,
    refreshLazyCoverArt,
    refreshGameCardReveal,
});
const { getGamePresentation, renderGameCard, renderGameList, selectGame, roomListMarkup, renderRoomList, renderJoinLobbyRooms, applyGameFilter, gameMatchesFilter } = catalogView;

const roomDialog = createRoomDialogController({
    elements: {
        dialog: createRoomDialog,
        dialogClose: createRoomDialogClose,
        ruleHero: createRoomRuleHero,
        ruleSymbol: createRoomRuleSymbol,
        ruleEnglish: createRoomRuleEnglish,
        dialogTitle: createRoomDialogTitle,
        ruleOverview: createRoomRuleOverview,
        rulePlayers: createRoomRulePlayers,
        ruleTime: createRoomRuleTime,
        ruleMode: createRoomRuleMode,
        ruleList: createRoomRuleList,
        ruleNote: createRoomRuleNote,
        nextButton: createRoomNextBtn,
        form: createRoomForm,
        nameInput: createRoomName,
        capacityField: createRoomCapacityField,
        capacityOptions: createRoomCapacityOptions,
        specialSettings: createRoomSpecialSettings,
        formError: createRoomFormError,
        backButton: createRoomBackBtn,
        cancelButton: createRoomCancelBtn,
        confirmButton: createRoomConfirmBtn,
    },
    getCurrentRoomId: () => currentRoomId,
    getCurrentRoom: () => currentRoom,
    getActiveGame: () => activeCreateRoomGame,
    setActiveGame: value => { activeCreateRoomGame = value; },
    getRequestPending: () => createRoomRequestPending,
    setRequestPending: value => { createRoomRequestPending = Boolean(value); },
    getGameList: () => gameList,
    getMyName: () => myName,
    getGamePresentation,
    getGameDetails,
    playModeLabels: PLAY_MODE_LABELS,
    getGameCovers: () => GAME_COVERS,
    isConnected: () => isConnected,
    isTransportOpen: () => transport.isOpen(),
    addLog,
    selectGame,
    createRoom: payload => createRoom(payload),
    escapeHtml,
});

const {
    getRoomSettingDefinitions,
    getRoomSettingValues,
    renderSharedRoomSettings,
    collectRoomSettingValues,
} = roomDialog;

function openCreateRoomDialog(gameType, returnFocusElement = null) {
    roomDialog.open(gameType, returnFocusElement);
}

function showCreateRoomSettings() {
    roomDialog.showSettings();
}

function showCreateRoomRules() {
    roomDialog.showRules();
}

function closeCreateRoomDialog(force = false) {
    roomDialog.close(force);
}

function setCreateRoomRequestPending(pending) {
    roomDialog.setPending(pending);
}

function submitCreateRoom(event) {
    roomDialog.submit(event);
}

waitingRoomScene = createWaitingRoomScene({
    mount: roomMount,
    currentRoomPanel,
    startGameBtn,
    lobbyStartGameBtn,
    getRoom: () => currentRoom,
    getRoomId: () => currentRoomId,
    getPlayerId: () => myId,
    getPendingRoomSettings: () => pendingRoomSettings,
    getGamePresentation: type => GAME_PRESENTATION[type],
    getGameCovers: () => GAME_COVERS,
    getBggArt: () => BGG_ART,
    getGamePreloadState,
    getRoomSettingDefinitions,
    getRoomSettingValues,
    renderSharedRoomSettings,
    escapeHtml,
});

const gameEntryTransition = createGameEntryTransition({
    roomMount,
    getRoomId: () => currentRoomId,
    waitingSeatVisualSlot,
    getGameArt: type => GAME_COVERS[type] || BGG_ART[type] || '',
    openGameView: () => openGameView(),
});

function getWaitingRoomState() {
    return waitingRoomScene?.getState() || null;
}

function waitingSeatVisualSlot(seatIndex, capacity) {
    return waitingRoomScene?.getSeatVisualSlot(seatIndex, capacity) ?? (seatIndex % Math.max(1, capacity));
}

function renderWaitingRoomScene() {
    waitingRoomScene?.render();
}

function renderWaitingRoomPanel() {
    waitingRoomScene?.renderPanel();
}

function getGameClientPath(gameType) {
    return getManifestClientPath(gameType);
}

function getGameStylePaths(gameType) {
    return getGameStyleHrefs(gameType).map(href => href.split('?')[0]);
}

function preloadGameStyles(gameType) {
    gameLoader.preloadStyles(gameType);
}

function enterWaitingRoom() {
    cancelGameEntryTransition();
    closeLobbyEntry();
    joinLobbyViewEl.hidden = true;
    joinLobbyViewEl.style.display = 'none';
    appHeaderEl.style.display = 'none';
    document.body.classList.remove('is-game-view');
    document.body.classList.add('is-waiting-room-view');
    lobbyViewEl.style.display = 'none';
    roomViewEl.style.display = 'block';
    roomMount.style.display = 'block';
    gameMount.style.display = 'none';
    destroyGameClient();
    renderWaitingRoomPanel();
    if (currentRoom?.gameType) {
        preloadGameClient(currentRoom.gameType).catch(error => addLog(`资源预加载失败：${error.message}`, 'error'));
    }
}

function openGameView() {
    closeLobbyEntry();
    joinLobbyViewEl.hidden = true;
    joinLobbyViewEl.style.display = 'none';
    appHeaderEl.style.display = 'none';
    document.body.classList.remove('is-waiting-room-view');
    document.body.classList.add('is-game-view');
    lobbyViewEl.style.display = 'none';
    roomViewEl.style.display = 'block';
    currentRoomPanel.style.display = 'none';
    roomMount.style.display = 'none';
    gameMount.style.display = 'block';
    startGameBtn.style.display = 'none';
    window.dispatchEvent(new Event('resize'));
}

function cancelGameEntryTransition() {
    gameEntryTransition.cancel();
    gameEntryTransitionPromise = null;
}

function buildGameEntryGroups(roomElement) {
    return gameEntryTransition.buildGroups(roomElement);
}

function playGameEntryTransition(gameType) {
    return gameEntryTransition.play(gameType);
}

async function startGameEntry(type, data) {
    await loadGameModule(type);
    await prepareGameClient(type);
    currentGameClient?.handleMessage(data);
    updateStudyControls(data.state);
    await playGameEntryTransition(type);
}

function returnToLobby() {
    cancelGameEntryTransition();
    waitingRoomScene?.reset();
    setRoomConnectionState(null);
    document.body.classList.remove('is-game-view', 'is-waiting-room-view');
    joinLobbyViewEl.hidden = true;
    joinLobbyViewEl.style.display = 'none';
    appHeaderEl.style.display = 'grid';
    lobbyViewEl.style.display = 'grid';
    roomViewEl.style.display = 'none';
    roomMount.style.display = 'block';
    roomMount.innerHTML = '';
    gameMount.style.display = 'none';
    destroyGameClient();
    currentRoomPanel.style.display = 'none';
    document.querySelector('.catalog-column')?.classList.remove('is-muted');
    requestAnimationFrame(refreshGameCardReveal);
}

async function showGameMessage(data) {
    const type = data.gameType || currentRoom?.gameType;
    const isInitialGameStart = data.type === 'gameStarted' && document.body.classList.contains('is-waiting-room-view');
    try {
        if (isInitialGameStart || gameEntryTransitionPromise) {
            if (!gameEntryTransitionPromise) gameEntryTransitionPromise = startGameEntry(type, data);
            const pendingTransition = gameEntryTransitionPromise;
            await pendingTransition;
            if (gameEntryTransitionPromise === pendingTransition) gameEntryTransitionPromise = null;
            if (!isInitialGameStart) currentGameClient?.handleMessage(data);
            updateStudyControls(data.state);
            return;
        }
        await loadGameModule(type);
        openGameView();
        await prepareGameClient(type);
        currentGameClient?.handleMessage(data);
        updateStudyControls(data.state);
    } catch (error) {
        addLog(`游戏界面加载失败：${error.message}`, 'error');
        if (currentRoom?.status === 'waiting') enterWaitingRoom();
        else returnToLobby();
    }
}

async function prepareGameClient(gameType) {
    if (!gameType) throw new Error('缺少游戏类型');
    if (currentGameClient?.gameType === gameType) return;
    if (preparingGameClient && preparingGameType === gameType) return preparingGameClient;
    preparingGameType = gameType;
    preparingGameClient = (async () => {
        destroyGameClient();
        const module = await loadGameModule(gameType);
        if (typeof module.createGameClient !== 'function') throw new Error(`${gameType} 没有导出 createGameClient`);
        gameMount.dataset.gameType = gameType;
        currentGameClient = module.createGameClient({ mount: gameMount, send, addLog });
        installStudyControls();
        applyGameArtwork(gameType);
        applyBggComponentArt(gameType);
    })();
    try {
        await preparingGameClient;
    } finally {
        preparingGameClient = null;
        preparingGameType = null;
    }
}

let studyControlsEl = null;
const studyControls = createStudyControls({
    gameMount,
    getGameType: () => currentRoom?.gameType || '',
});

function installStudyControls() { studyControlsEl = studyControls.install(); }
function updateStudyControls(state) { studyControls.update(state); }
function currentGameStudySeatIndex() { return studyControls.getSeatIndex(); }
function currentGameStudySeatCount() { return studyControls.getSeatCount(); }
function refreshStudyControlSelection() { studyControls.refreshSelection(); }
function destroyGameClient() { currentGameClient?.destroy?.(); currentGameClient = null; destroyGameArtwork(); gameMount.removeAttribute('data-game-type'); gameMount.innerHTML = ''; }

function joinRoom(roomId) { const normalized = String(roomId || '').trim(); if (!/^\d{6}$/.test(normalized)) return addLog('请输入6位房间号', 'error'); if (!isConnected) return addLog('未连接到服务器', 'error'); if (currentRoomId) return addLog('请先离开当前房间', 'error'); send({ type: 'joinRoom', roomId: normalized }); }
function joinByCode() { joinRoom(roomCodeInput?.value || ''); }
function setJoinLobbyPending(pending, error = '') {
    joinLobbyJoinPending = Boolean(pending);
    if (joinLobbyCodeBtn) {
        joinLobbyCodeBtn.disabled = joinLobbyJoinPending;
        joinLobbyCodeBtn.innerHTML = joinLobbyJoinPending ? '正在进入…' : '进入房间 <span>→</span>';
    }
    if (joinLobbyCodeError) joinLobbyCodeError.textContent = error;
}
function resetReconnectForm() {
    reconnectRequestPending = false;
    reconnectRoomId = null;
    if (reconnectForm) reconnectForm.hidden = true;
    if (reconnectPlayerIdInput) reconnectPlayerIdInput.value = '';
    if (reconnectError) reconnectError.textContent = '';
    if (reconnectBtn) { reconnectBtn.disabled = false; reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
}
function reconnectRoom() {
    const roomId = String(reconnectRoomId || joinLobbyCodeInput?.value || '').trim();
    const playerId = String(reconnectPlayerIdInput?.value || '').trim().toUpperCase();
    if (!/^\d{6}$/.test(roomId)) return setReconnectError('请输入完整的 6 位房间号。');
    if (!playerId) return setReconnectError('请输入断线前显示的玩家 ID。');
    if (!isConnected) return setReconnectError('尚未连接到服务器，请稍候再试。');
    if (sessionResumePending) return setReconnectError('正在恢复上次会话，请稍候再试。');
    if (currentRoomId) return setReconnectError('请先离开当前房间。');
    reconnectRequestPending = true;
    if (reconnectBtn) { reconnectBtn.disabled = true; reconnectBtn.textContent = '正在恢复…'; }
    if (reconnectError) reconnectError.textContent = '';
    send({ type: 'reconnectRoom', roomId, playerId, sessionToken });
}
function setReconnectError(message) {
    reconnectRequestPending = false;
    if (reconnectBtn) { reconnectBtn.disabled = false; reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
    if (reconnectError) reconnectError.textContent = message;
}
function syncEntryIdentity() {
    const name = entryNameInput.value.trim() || myName;
    myName = name;
    entryNameInput.value = name;
    nameInput.value = name;
    localStorage.setItem('jsgames.playerName', name);
    updateProfileAvatar();
    if (isConnected) send({ type: 'setName', name });
}
function closeLobbyEntry({ animate = false } = {}) {
    if (entryExitTimer) clearTimeout(entryExitTimer);
    if (entryReturnTimer) clearTimeout(entryReturnTimer);
    entryReturnTimer = null;
    document.body.classList.remove('is-entry-view', 'is-entry-static');
    document.body.classList.remove('is-entry-returning');
    if (animate && !lobbyEntryEl.hidden) {
        lobbyEntryEl.classList.add('is-exiting');
        entryExitTimer = setTimeout(() => {
            lobbyEntryEl.hidden = true;
            lobbyEntryEl.setAttribute('aria-hidden', 'true');
            lobbyEntryEl.classList.remove('is-exiting');
            entryExitTimer = null;
        }, 300);
        return;
    }
    lobbyEntryEl.hidden = true;
    lobbyEntryEl.setAttribute('aria-hidden', 'true');
    lobbyEntryEl.classList.remove('is-exiting');
}
function showEntryGateway({ replayAnimation = false, animateReturn = false } = {}) {
    if (entryExitTimer) clearTimeout(entryExitTimer);
    if (entryReturnTimer) clearTimeout(entryReturnTimer);
    entryExitTimer = null;
    entryReturnTimer = null;
    lobbyEntryEl.classList.remove('is-exiting');
    joinLobbyViewEl.hidden = true;
    joinLobbyViewEl.style.display = 'none';
    appHeaderEl.style.display = 'none';
    lobbyViewEl.style.display = 'none';
    roomViewEl.style.display = 'none';
    lobbyEntryEl.hidden = false;
    lobbyEntryEl.setAttribute('aria-hidden', 'false');
    document.body.classList.toggle('is-entry-static', !replayAnimation);
    document.body.classList.add('is-entry-view');
    document.body.classList.remove('is-entry-returning');
    if (animateReturn && !replayAnimation) {
        document.body.classList.add('is-entry-returning');
        entryReturnTimer = setTimeout(() => {
            document.body.classList.remove('is-entry-returning');
            entryReturnTimer = null;
        }, 560);
    }
}
function returnHomeFromBrand(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.replaceState(null, '', location.pathname);
    showEntryGateway({ replayAnimation: false, animateReturn: true });
}
function enterGameCatalog() {
    syncEntryIdentity();
    closeLobbyEntry({ animate: true });
    joinLobbyViewEl.hidden = true;
    joinLobbyViewEl.style.display = 'none';
    appHeaderEl.style.display = 'grid';
    lobbyViewEl.style.display = 'grid';
    requestAnimationFrame(() => {
        refreshGameCardReveal();
        const firstCard = document.querySelector('#gamePicker [data-game-type]:not([hidden])');
        const bounds = firstCard?.getBoundingClientRect();
        if (bounds && bounds.bottom > 0 && bounds.top < window.innerHeight) {
            revealGameCard(firstCard, 0);
            firstCard.focus({ preventScroll: true });
        }
    });
}
function showJoinLobby({ focusCode = true } = {}) {
    syncEntryIdentity();
    resetReconnectForm();
    closeLobbyEntry({ animate: true });
    document.body.classList.remove('is-game-view', 'is-waiting-room-view');
    joinLobbyViewEl.hidden = false;
    joinLobbyViewEl.style.display = 'block';
    appHeaderEl.style.display = 'none';
    lobbyViewEl.style.display = 'none';
    roomViewEl.style.display = 'none';
    renderJoinLobbyRooms();
    if (focusCode) requestAnimationFrame(() => joinLobbyCodeInput?.focus());
}
function joinFromJoinLobby(event) {
    event?.preventDefault();
    const roomId = String(joinLobbyCodeInput?.value || '').trim();
    if (!/^\d{6}$/.test(roomId)) return setJoinLobbyPending(false, '请输入完整的 6 位房间号。');
    if (!isConnected) return setJoinLobbyPending(false, '尚未连接到服务器，请稍候再试。');
    if (sessionResumePending) return setJoinLobbyPending(false, '正在恢复上次会话，请稍候再试。');
    if (currentRoomId) return setJoinLobbyPending(false, '请先离开当前房间。');
    resetReconnectForm();
    syncEntryIdentity();
    setJoinLobbyPending(true);
    send({ type: 'joinRoom', roomId });
}
function joinPublicRoom(roomId) {
    const normalized = String(roomId || '').trim();
    if (!/^\d{6}$/.test(normalized)) return setJoinLobbyPending(false, '房间号格式不正确。');
    if (!isConnected) return setJoinLobbyPending(false, '尚未连接到服务器，请稍候再试。');
    if (sessionResumePending) return setJoinLobbyPending(false, '正在恢复上次会话，请稍候再试。');
    if (currentRoomId) return setJoinLobbyPending(false, '请先离开当前房间。');
    syncEntryIdentity();
    joinLobbyCodeInput.value = normalized;
    setJoinLobbyPending(true);
    send({ type: 'joinRoom', roomId: normalized });
}
function leaveRoom() { if (!currentRoomId) return; send({ type: 'leaveRoom' }); currentRoomId = null; currentRoom = null; pendingRoomPlayerCount = 9; pendingEncryptorMode = 'rotation'; pendingRoomSettings = {}; updateInviteLink(); returnToLobby(); addLog('已离开房间', 'system'); }
function createRoom(payload) { if (currentRoomId) return addLog('请先离开当前房间', 'error'); if (!isConnected || !transport.isOpen()) return addLog('未连接到服务器', 'error'); setCreateRoomRequestPending(true); send({ type: 'createRoom', ...payload }); addLog(`正在创建 ${payload.roomName || GAME_PRESENTATION[payload.gameType]?.title || payload.gameType}…`, 'system'); }
function handleWaitingStartAction() {
    const waiting = getWaitingRoomState();
    if (!waiting) return;
    if (!waiting.isHost) return showRoomFeedback('等待房主开启游戏', 'info');
    if (waiting.needsConfiguration) return showRoomFeedback('请先完成房间设置', 'warning');
    const requiredPlayers = waiting.fixedPlayerCount ? waiting.targetPlayers : waiting.minPlayers;
    const missing = Math.max(0, requiredPlayers - waiting.players.length);
    if (missing > 0) return showRoomFeedback(`房间人数不够，还差 ${missing} 人`, 'warning');
    if (!waiting.allPlayersReady) return showRoomFeedback(`请等待所有成员准备（${waiting.readyCount}/${waiting.memberPlayers.length}）`, 'warning');
    if (waiting.preload.status === 'error') return showRoomFeedback('游戏资源加载失败，请先重新加载', 'warning');
    if (waiting.preload.status !== 'ready') return showRoomFeedback('游戏资源仍在准备，请稍候', 'info');
    startGame();
}
function startGame() {
    if (!currentRoomId || !currentRoom) return;
    const target = Number(currentRoom.targetPlayers || 0);
    const count = currentRoom.players?.length || 0;
    if (currentRoom.configurationRequired && !currentRoom.configurationConfirmed) { showRoomFeedback('请先完成房间设置', 'warning'); return addLog('请先确认房间设置', 'error'); }
    if (target && count !== target) { showRoomFeedback(`房间人数不够，还差 ${Math.max(0, target - count)} 人`, 'warning'); return addLog(`需要 ${target} 名玩家全部到齐（当前 ${count}/${target}）`, 'error'); }
    if (!target && count < Number(currentRoom.minPlayers || 0)) { showRoomFeedback(`房间人数不够，还差 ${Math.max(0, Number(currentRoom.minPlayers || 0) - count)} 人`, 'warning'); return addLog('房间人数不足，无法开始游戏', 'error'); }
    const connectedPlayers = (currentRoom.players || []).filter(player => player.isOnline !== false && player.id !== currentRoom.hostId);
    const readyCount = connectedPlayers.filter(player => player.ready === true).length;
    if (currentRoom.readyCheckEnabled && readyCount < connectedPlayers.length) { showRoomFeedback(`请等待所有成员准备（${readyCount}/${connectedPlayers.length}）`, 'warning'); return addLog('请等待所有成员准备', 'error'); }
    send({ type: 'startGame' });
}
function sendChat() { const message = chatInput.value.trim(); if (!message) return; if (!isConnected) return addLog('未连接到服务器', 'error'); send({ type: 'chat', message }); chatInput.value = ''; }
function setName() { const name = nameInput.value.trim(); if (!name) return; myName = name; entryNameInput.value = name; localStorage.setItem('jsgames.playerName', name); updateProfileAvatar(); if (isConnected) send({ type: 'setName', name }); addLog(`已改名为 ${name}`, 'system'); }
function send(payload) { transport.send(payload); }
function addLog(message, type = 'chat') { const placeholder = logEl.querySelector('.log-placeholder'); placeholder?.remove(); const div = document.createElement('div'); div.className = `log-entry log-${type}`; div.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${escapeHtml(message)}</span>`; logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight; }
function updateProfileAvatar() { const name = entryNameInput?.value || nameInput.value || myName || '玩'; profileAvatar.textContent = name.slice(0, 1); if (entryAvatar) entryAvatar.textContent = name.slice(0, 1); }
function updateInviteLink() {
    const invite = document.getElementById('ipDisplay');
    if (!invite) return;
    const awaitingConfiguration = Boolean(currentRoomId && currentRoom?.configurationRequired && !currentRoom.configurationConfirmed);
    const url = currentRoomId && !awaitingConfiguration ? `${location.origin}${location.pathname}?room=${encodeURIComponent(currentRoomId)}` : '';
    invite.textContent = awaitingConfiguration ? '确认房间设置后生成邀请链接' : url || '先创建或加入房间';
    invite.dataset.inviteUrl = url;
}
function setConnectionStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = `connection-status ${className}`;
    onlineIndicatorEl?.classList.remove('is-connecting', 'is-connected', 'is-disconnected');
    onlineIndicatorEl?.classList.add(className);
    if (joinLobbyConnectionStatus) { joinLobbyConnectionStatus.textContent = text; joinLobbyConnectionStatus.className = `connection-status ${className}`; }
    joinLobbyOnlineIndicator?.classList.remove('is-connecting', 'is-connected', 'is-disconnected');
    joinLobbyOnlineIndicator?.classList.add(className);
    if (joinLobbyPlayerCountEl && playerCountEl) joinLobbyPlayerCountEl.textContent = playerCountEl.textContent;
    if (entryConnectionStatus) { entryConnectionStatus.className = `entry-connection ${className}`; entryConnectionStatus.innerHTML = `<i></i>${text}`; }
}
function isInRoom(roomId) { return currentRoomId === roomId; }
function roomStatusText(status) { return status === 'playing' ? '游戏中' : status === 'ended' ? '已结束' : '等待中'; }
function openMobileRooms() { if (!mobileRoomsDrawer) return; mobileRoomsDrawer.hidden = false; mobileRoomsDrawer.setAttribute('aria-hidden', 'false'); document.body.classList.add('has-mobile-drawer'); mobileRoomsDrawer.querySelector('section [data-close-mobile-rooms]')?.focus(); }
function closeMobileRooms() { if (!mobileRoomsDrawer || mobileRoomsDrawer.hidden) return; mobileRoomsDrawer.hidden = true; mobileRoomsDrawer.setAttribute('aria-hidden', 'true'); document.body.classList.remove('has-mobile-drawer'); openMobileRoomsBtn?.focus(); }

entryStartBtn?.addEventListener('click', enterGameCatalog);
entryJoinBtn?.addEventListener('click', () => showJoinLobby());
brandLinks.forEach(link => link.addEventListener('click', returnHomeFromBrand));
joinLobbyBackBtn?.addEventListener('click', () => showEntryGateway({ replayAnimation: false, animateReturn: true }));
joinLobbyStartBtn?.addEventListener('click', enterGameCatalog);
joinLobbyFooterStartBtn?.addEventListener('click', enterGameCatalog);
joinLobbyCodeForm?.addEventListener('submit', joinFromJoinLobby);
joinLobbyCodeInput?.addEventListener('input', () => { joinLobbyCodeInput.value = joinLobbyCodeInput.value.replace(/\D/g, '').slice(0, 6); if (joinLobbyCodeError) joinLobbyCodeError.textContent = ''; });
reconnectBtn?.addEventListener('click', reconnectRoom);
reconnectPlayerIdInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); reconnectRoom(); } });
joinLobbyGameFilterEl?.addEventListener('change', () => { selectedJoinRoomFilter = joinLobbyGameFilterEl.value; renderJoinLobbyRooms(); });
entryNameInput?.addEventListener('input', updateProfileAvatar);
leaveRoomBtn?.addEventListener('click', leaveRoom); startGameBtn?.addEventListener('click', startGame); lobbyStartGameBtn?.addEventListener('click', startGame); lobbyLeaveRoomBtn?.addEventListener('click', leaveRoom); sendChatBtn?.addEventListener('click', sendChat); setNameBtn?.addEventListener('click', setName); joinCodeBtn?.addEventListener('click', joinByCode); roomCodeInput?.addEventListener('keydown', event => { if (event.key === 'Enter') joinByCode(); }); roomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (button) joinRoom(button.dataset.roomId); }); chatInput?.addEventListener('keydown', event => { if (event.key === 'Enter') sendChat(); }); nameInput?.addEventListener('keydown', event => { if (event.key === 'Enter') setName(); }); nameInput?.addEventListener('input', updateProfileAvatar);
joinLobbyRoomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (button) joinPublicRoom(button.dataset.roomId); });
openMobileRoomsBtn?.addEventListener('click', openMobileRooms);
mobileRoomsDrawer?.addEventListener('click', event => { if (event.target.closest('[data-close-mobile-rooms]')) closeMobileRooms(); });
mobileRoomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (!button) return; closeMobileRooms(); joinRoom(button.dataset.roomId); });
gameMount?.addEventListener('click', event => {
    if (!studyControlsEl || studyControlsEl.hidden || !currentRoom?.studyMode) return;
    const button = event.target.closest('[data-study-switch]');
    const seatIndex = Number(currentGameStudySeatIndex());
    const seatCount = Number(currentGameStudySeatCount());
    if ((!button && !event.target.closest('[data-study-place-type]') && !event.target.closest('[data-study-reset], [data-study-clear], [data-study-remove], [data-study-confirm]')) || !Number.isInteger(seatIndex) || !seatCount) return;
    const placeType = event.target.closest('[data-study-place-type]')?.dataset.studyPlaceType;
    if (placeType) {
        studyControlsEl.dataset.studyPlacementType = placeType;
        studyControlsEl.dataset.studyRemoveMode = '';
        currentGameClient?.setStudyPlacement?.({ type: placeType, remove: false });
        refreshStudyControlSelection();
        return;
    }
    const setupAction = event.target.closest('[data-study-reset], [data-study-clear], [data-study-remove], [data-study-confirm]');
    if (setupAction) {
        if (setupAction.hasAttribute('data-study-reset')) { currentGameClient?.setStudyPlacement?.(null); send({ type: 'gameAction', action: { kind: 'studySetup', op: 'reset' } }); }
        else if (setupAction.hasAttribute('data-study-clear')) { currentGameClient?.setStudyPlacement?.(null); send({ type: 'gameAction', action: { kind: 'studySetup', op: 'clear' } }); }
        else if (setupAction.hasAttribute('data-study-remove')) { const remove = studyControlsEl.dataset.studyRemoveMode !== 'true'; studyControlsEl.dataset.studyRemoveMode = remove ? 'true' : ''; studyControlsEl.dataset.studyPlacementType = ''; currentGameClient?.setStudyPlacement?.(remove ? { remove: true } : null); refreshStudyControlSelection(); }
        else { currentGameClient?.setStudyPlacement?.(null); send({ type: 'gameAction', action: { kind: 'studyConfirmSetup' } }); }
        return;
    }
    currentGameClient?.setStudyPlacement?.(null);
    studyControlsEl.dataset.studyPlacementType = '';
    studyControlsEl.dataset.studyRemoveMode = '';
    refreshStudyControlSelection();
    send({ type: 'gameAction', action: { kind: 'studySwitchSeat', seatIndex: (seatIndex + 1) % seatCount } });
});
gameMount?.addEventListener('click', event => {
    if (!studyControlsEl || studyControlsEl.hidden || studyControlsEl.dataset.studyPhase !== 'setup' || event.target.closest('.study-controls')) return;
    const square = event.target.closest('[data-x][data-y], [data-board-square]');
    if (!square) return;
    const x = Number(square.dataset.x); const y = Number(square.dataset.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    const remove = studyControlsEl.dataset.studyRemoveMode === 'true';
    const type = studyControlsEl.dataset.studyPlacementType;
    if (!remove && !type) return;
    event.preventDefault();
    event.stopPropagation();
    if (remove) send({ type: 'gameAction', action: { kind: 'studySetup', op: 'remove', x, y } });
    else send({ type: 'gameAction', action: { kind: 'studySetup', op: 'place', x, y, pieceType: type, color: gameMount.dataset.studySide } });
    currentGameClient?.setStudyPlacement?.(null);
    studyControlsEl.dataset.studyPlacementType = '';
    studyControlsEl.dataset.studyRemoveMode = '';
}, true);
roomMount?.addEventListener('click', async event => {
    if (event.target.closest('[data-start-game]')) { handleWaitingStartAction(); return; }
    if (event.target.closest('[data-toggle-ready]')) {
        const player = currentRoom?.players?.find(item => item.id === myId);
        send({ type: 'setReady', ready: player?.ready !== true });
        return;
    }
    const kick = event.target.closest('[data-kick-player]');
    if (kick) {
        const target = currentRoom?.players?.find(player => player.id === kick.dataset.kickPlayer);
        if (target && window.confirm(`确定将 ${target.name} 移出房间吗？`)) send({ type: 'kickPlayer', playerId: target.id });
        return;
    }
    if (event.target.closest('[data-confirm-room-configuration]')) {
        const settings = collectRoomSettingValues(roomMount, currentRoom);
        pendingRoomSettings = { ...pendingRoomSettings, ...settings };
        send({ type: 'configureRoom', settings });
        return;
    }
    if (event.target.closest('[data-save-room-settings]')) {
        const settings = collectRoomSettingValues(roomMount, currentRoom);
        pendingRoomSettings = { ...pendingRoomSettings, ...settings };
        send({ type: 'updateRoomSettings', settings });
        return;
    }
    if (event.target.closest('[data-retry-preload]')) { preloadGameClient(currentRoom?.gameType, true).catch(error => addLog(`资源预加载失败：${error.message}`, 'error')); return; }
    if (event.target.closest('[data-copy-room-code]')) {
        try { await navigator.clipboard.writeText(currentRoomId); addLog(`房间号 ${currentRoomId} 已复制`, 'system'); }
        catch { addLog(`房间号：${currentRoomId}`, 'system'); }
    }
});
roomMount?.addEventListener('change', event => {
    const input = event.target.closest('[data-room-setting-input]');
    if (!input) return;
    const key = input.dataset.roomSettingKey;
    pendingRoomSettings[key] = input.type === 'checkbox' ? input.checked : input.value;
    if (key === 'playerCount') pendingRoomPlayerCount = Number(input.value);
    if (key === 'encryptorMode') pendingEncryptorMode = input.value;
});
window.addEventListener('resize', () => {
    waitingRoomScene.scheduleRender();
});
createRoomNextBtn?.addEventListener('click', showCreateRoomSettings);
createRoomBackBtn?.addEventListener('click', showCreateRoomRules);
createRoomCancelBtn?.addEventListener('click', () => closeCreateRoomDialog());
createRoomDialogClose?.addEventListener('click', () => closeCreateRoomDialog());
createRoomForm?.addEventListener('submit', submitCreateRoom);
createRoomDialog?.addEventListener('click', event => { if (event.target === createRoomDialog) closeCreateRoomDialog(); });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileRoomsDrawer && !mobileRoomsDrawer.hidden) { event.preventDefault(); closeMobileRooms(); return; }
    if (!createRoomDialog || createRoomDialog.hidden) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeCreateRoomDialog();
        return;
    }
    if (event.key !== 'Tab') return;
    const activeStep = createRoomDialog.classList.contains('is-settings') ? createRoomForm : createRoomDialog.querySelector('.game-rules-step');
    const focusable = [createRoomDialogClose, ...activeStep.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && !element.closest('[hidden]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
currentRoomPanel?.addEventListener('click', event => {
    const option = event.target.closest('[data-room-player-count]');
    if (option) { pendingRoomPlayerCount = Number(option.dataset.roomPlayerCount); renderWaitingRoomPanel(); return; }
    const mode = event.target.closest('[data-encryptor-mode]');
    if (mode) { pendingEncryptorMode = mode.dataset.encryptorMode; renderWaitingRoomPanel(); return; }
    if (event.target.closest('[data-confirm-room-configuration]')) send(currentRoom?.gameType === 'decrypto' ? { type: 'configureRoom', encryptorMode: pendingEncryptorMode } : { type: 'configureRoom', playerCount: pendingRoomPlayerCount });
});
gameFilterEl?.addEventListener('change', () => { selectedGameFilter = gameFilterEl.value; applyGameFilter(); });
document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-invite]'); if (!copy) return; const invite = document.getElementById('ipDisplay'); const text = invite?.dataset.inviteUrl || invite?.textContent || ''; if (!text || text.includes('先创建')) return addLog('请先创建或加入房间', 'error'); try { await navigator.clipboard.writeText(text); addLog('邀请链接已复制', 'system'); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制'; }, 1400); } catch { addLog('复制失败，请手动复制邀请链接', 'error'); } });
document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-player-id]'); if (!copy) return; if (!myId) return addLog('玩家 ID 尚未生成', 'error'); try { await navigator.clipboard.writeText(myId); showRoomFeedback(`玩家 ID ${myId} 已复制`, 'info'); } catch { addLog(`玩家 ID：${myId}`, 'system'); } });
document.addEventListener('click', event => { if (event.target.closest('[data-dismiss-fatal]')) document.getElementById('fatalErrorBox')?.style.setProperty('display', 'none'); });


const savedName = localStorage.getItem('jsgames.playerName');
if (savedName) myName = savedName;
nameInput.value = myName; entryNameInput.value = myName; updateProfileAvatar(); updateInviteLink();
if (pendingUrlRoom) { showJoinLobby({ focusCode: false }); joinLobbyCodeInput.value = pendingUrlRoom; }
connect();
