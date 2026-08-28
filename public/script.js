import { getGameDetails } from './game-details.js';
import { escapeHtml } from './games/common/html.js';
import { getGameClientPath as getManifestClientPath, getGameStyleHrefs, getGameStylePaths as getManifestStylePaths } from './games/common/game-manifest.js';

const ASSET_VERSION = '20260827-werewolf-results-1';
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
const currentRoomInfo = document.getElementById('currentRoomInfo');
const currentRoomPlayers = document.getElementById('currentRoomPlayers');
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

const GAME_PRESENTATION = {
    loveletter: { symbol: '✉', title: '情书', subtitle: '读心、试探与最后一张牌', english: 'LOVE LETTER', players: '2–4 人', time: '15 分钟', tone: 'rose', description: '把你的心意安全送到公主手中。' },
    coup: { symbol: '♜', title: '政变', subtitle: '谎言、质疑与权力游戏', english: 'COUP', players: '2–6 人', time: '20 分钟', tone: 'violet', description: '藏好你的身份，掌控这场权力游戏。' },
    monopoly: { symbol: '⌂', title: '环城大富翁', subtitle: '置业、收租与环城冒险', english: 'MONOPOLY', players: '2–8 人', time: '30 分钟', tone: 'green', description: '买下城市最好的街区，成为最后赢家。' },
    monopolydeal: { symbol: '◈', title: '大富翁纸牌', subtitle: '成套、交易与一击突破', english: 'DEAL CARDS', players: '2–5 人', time: '20 分钟', tone: 'teal', description: '用三套地产和一次漂亮交易结束比赛。' },
    guessnumber: { symbol: 'A B', title: '猜数字', subtitle: '推理四位数字与隐藏答案', english: 'BULLS & COWS', players: '单人', time: '10 分钟', tone: 'blue', description: '每一次猜测，都让答案更接近真相。' },
    chess: { symbol: '♞', title: '国际象棋', subtitle: '将军、策略与八方棋盘', english: 'CHESS', players: '2 人', time: '30 分钟', tone: 'wood', description: '在八乘八的棋盘上，寻找唯一的将杀。' },
    xiangqi: { symbol: '將', title: '中国象棋', subtitle: '楚河汉界与炮火突围', english: 'XIANGQI', players: '2 人', time: '25 分钟', tone: 'vermilion', description: '车马炮在楚河汉界之间展开攻防。' },
    jungle: { symbol: '象', title: '斗兽棋', subtitle: '过河、陷阱与猛兽博弈', english: 'JUNGLE', players: '2 人', time: '20 分钟', tone: 'forest', description: '穿越河流，利用地形占领对手兽穴。' },
    gobang: { symbol: '五', title: '五子棋', subtitle: '连珠、攻防与黑白落子', english: 'GOMOKU', players: '2 人', time: '20 分钟', tone: 'wood', description: '不设禁手，先在棋盘上连成五子。' },
    checkers: { symbol: '✦', title: '跳棋', subtitle: '六角星、连续跳跃与目标角', english: 'CHINESE CHECKERS', players: '2–6 人', time: '30 分钟', tone: 'teal', description: '把十枚棋子跳进对角目标角。' },
    aeroplane: { symbol: '✈', title: '飞行棋', subtitle: '起飞、跳跃与空中突袭', english: 'AEROPLANE CHESS', players: '2–4 人', time: '20 分钟', tone: 'blue', description: '掷出六点，带四架飞机飞回终点。' },
    junqi: { symbol: '軍', title: '军棋', subtitle: '暗棋、军阶与夺旗', english: 'DARK CHESS', players: '2 人', time: '30 分钟', tone: 'forest', description: '隐藏你的军力，拆除地雷，夺下对方军旗。' },
    takefive: { symbol: '牛', title: '牛头王', subtitle: '同时出牌与风险排队', english: 'TAKE FIVE', players: '2–10 人', time: '25 分钟', tone: 'gold', description: '猜对手的节奏，别成为第六张牌。' },
    hanabi: { symbol: '✹', title: '花火', subtitle: '合作、提示与记忆', english: 'HANABI', players: '2–5 人', time: '25 分钟', tone: 'indigo', description: '看见队友的牌，一起点亮夜空。' },
    splendor: { symbol: '◆', title: '璀璨宝石', subtitle: '宝石、贵族与永久折扣', english: 'SPLENDOR', players: '2–4 人', time: '30 分钟', tone: 'gem', description: '建立你的宝石商会，赢得贵族青睐。' },
    kingdomino: { symbol: '♛', title: '多米诺王国', subtitle: '领地、王冠与拼图王国', english: 'KINGDOMINO', players: '2–4 人', time: '25 分钟', tone: 'kingdom', description: '把最好的领地拼进你的王国。' },
    acquire: { symbol: '♜', title: '并购', subtitle: '60 周年城市视觉 · 经典并购规则', english: 'ACQUIRE', players: '2–6 人', time: '45 分钟', tone: 'acquire', description: '布局酒店集团，在并购浪潮中积累财富。' },
    citadels: { symbol: '城', title: '富饶之城', subtitle: '选角、建城与暗杀', english: 'CITADELS', players: '2–7 人', time: '45 分钟', tone: 'gold', description: '秘密选择角色，建成最辉煌的城市。' },
    witchtown: { symbol: '巫', title: '猎巫镇', subtitle: '身份、卡牌与昼夜审判', english: 'WITCH TOWN', players: '4–12 人', time: '35 分钟', tone: 'rose', description: '抽牌、指控并在夜色中保护镇民。' },
    lasvegas: { symbol: '$', title: '拉斯维加斯', subtitle: '骰子、赌场与多数争夺', english: 'LAS VEGAS', players: '2–5 人', time: '30 分钟', tone: 'teal', description: '把骰子押在最值得争夺的赌场。' },
    avalon: { symbol: '⚔', title: '阿瓦隆', subtitle: '封存身份，在真实圆桌前自由推理', english: 'AVALON', players: '5–10 人', time: '35 分钟', tone: 'violet', description: '页面保管秘密与规则，玩家在线下自由讨论、组队、投票并完成远征。' },
    scout: { symbol: '★', title: '马戏星探', subtitle: '手牌顺序与马戏表演', english: 'SCOUT', players: '2–5 人', time: '20 分钟', tone: 'rose', description: '不能重排的手牌，也能拼出最强演出。' },
    decrypto: { symbol: '⌁', title: '谍报风云', subtitle: '公共语音推演，逐轮破译密码', english: 'DECRYPTO', players: '3–8 人', time: '30 分钟', tone: 'blue', description: '页面保管关键词、密码和判定，双方可在同桌或公共语音中完整游玩。' },
    manila: { symbol: '⚓', title: '马尼拉', subtitle: '货船、股份与港口投机', english: 'MANILA', players: '3–5 人', time: '60 分钟', tone: 'gold', description: '押注哪艘货船抵达港口，成为最富有的商人。' },
    modernart: { symbol: '▧', title: '现代艺术', subtitle: '竞价、炒作与艺术市场', english: 'MODERN ART', players: '3–5 人', time: '45 分钟', tone: 'rose', description: '买下潜力艺术家，再把热度变成财富。' },
    camelup: { symbol: '🐪', title: '狂野骆驼', subtitle: '骆驼赛跑与赔率下注', english: 'CAMEL UP', players: '3–8 人', time: '35 分钟', tone: 'sand', description: '猜谁会冲线，别让叠在一起的骆驼骗过你。' },
    magicalathlete: { symbol: '⚡', title: '胡闹运动会', subtitle: '魔法运动员与四场竞速', english: 'MAGICAL ATHLETE', players: '2–6 人', time: '15 分钟', tone: 'violet', description: '选一个有怪招的运动员，跑完四场荒诞比赛。' },
    werewolf: { symbol: '狼', title: '狼人杀 · 夜幕助手', subtitle: '无需主持人，也能沉浸地完成整局游戏', english: 'WEREWOLF NIGHT', players: '9 / 12 人', time: '30–60 分钟', tone: 'violet', description: '选择 9 人或 12 人局。玩家到齐后，夜幕助手将依次引导身份、夜间行动、发言与投票。' },
};

let ws = null;
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
const gameModulePromises = new Map();
const gamePreloadStates = new Map();
let waitingRoomResizeFrame = null;
let waitingSeatVisualRoomId = null;
let waitingSeatVisualSnapshot = new Map();
const waitingSeatExtinguishTimers = new Map();
const waitingSeatIgniteUntil = new Map();
const waitingSeatIgniteTimers = new Map();
let gameEntryTransitionPromise = null;
let activeGameEntryTransition = null;
let gameEntryTransitionToken = 0;
let activeGameArtStyle = null;
let activeBggComponentDialog = null;
let activeCreateRoomGame = null;
let createRoomRequestPending = false;
let createRoomDialogReturnFocus = null;
let isConnected = false;
let gameList = [];
let selectedGameFilter = 'all';
let selectedJoinRoomFilter = 'all';
let publicRooms = [];
let joinLobbyJoinPending = false;
let reconnectRequestPending = false;
let reconnectRoomId = null;
let sessionResumePending = false;
let coverArtObserver = null;
let gameCardRevealObserver = null;
const coverArtPromises = new Map();
let entryExitTimer = null;
let entryReturnTimer = null;
const GROUP_PRESENTATION = {
    'social-assist': { name: '社交推理与流程辅助', description: '身份、沟通与自动流程' },
    codebreaking: { name: '解密类', description: '密码、线索与逻辑破译' },
    board: { name: '棋类与棋盘游戏', description: '棋盘对弈与路线竞赛' },
    tabletop: { name: '卡牌与策略桌游', description: '卡牌、经营、竞价与策略' },
};
const PLAY_MODE_LABELS = {
    online: '完整线上',
    hybrid: '线上+队伍讨论',
    'host-assist': '主持辅助',
    'auto-assist': '自动流程辅助',
    solo: '单人游戏',
};
const GAME_COVERS = {
    werewolf: '/assets/covers/werewolf-v5.webp',
    avalon: '/assets/covers/avalon-v4.webp',
    decrypto: '/assets/covers/decrypto-v2.webp',
    witchtown: '/assets/covers/witchtown.webp',
    chess: '/assets/covers/chess-v6.webp',
    xiangqi: '/assets/covers/xiangqi-v3.webp',
    jungle: '/assets/covers/jungle.webp',
    junqi: '/assets/covers/junqi-v10.webp',
    aeroplane: '/assets/covers/aeroplane.webp',
    gobang: '/assets/covers/gobang.webp',
    checkers: '/assets/covers/checkers-v10.webp',
    monopoly: '/assets/covers/monopoly.webp',
    loveletter: '/assets/covers/loveletter.webp',
    coup: '/assets/covers/coup.webp',
    guessnumber: '/assets/covers/guessnumber.webp',
    monopolydeal: '/assets/covers/monopolydeal.webp',
    takefive: '/assets/covers/takefive-v3.webp',
    hanabi: '/assets/covers/hanabi.webp',
    splendor: '/assets/covers/splendor.webp',
    kingdomino: '/assets/covers/kingdomino.webp',
    acquire: '/assets/covers/acquire.webp',
    citadels: '/assets/covers/citadels.webp',
    lasvegas: '/assets/covers/lasvegas.webp',
    scout: '/assets/covers/scout.webp',
    manila: '/assets/covers/manila.webp',
    modernart: '/assets/covers/modernart.webp',
    camelup: '/assets/covers/camelup.webp',
    magicalathlete: '/assets/covers/magicalathlete-v3.webp',
};
const GAME_COVER_THUMBS = Object.fromEntries(Object.entries(GAME_COVERS).map(([type, source]) => [type, source.replace('/assets/covers/', '/assets/covers/thumbs/')]));
const BGG_ART = {
    loveletter: '/assets/bgg/loveletter/cover.jpg',
    coup: '/assets/bgg/coup/cover.jpg',
    monopolydeal: '/assets/bgg/monopolydeal/cover.jpg',
    monopoly: '/assets/bgg/monopoly/cover.jpg',
    takefive: '/assets/bgg/takefive/cover.jpg',
    hanabi: '/assets/bgg/hanabi/cover.jpg',
    splendor: '/assets/bgg/splendor/original-cover.jpg',
    kingdomino: '/assets/bgg/kingdomino/cover.png',
    acquire: '/assets/bgg/acquire/cover.jpg',
    citadels: '/assets/bgg/citadels/cover.jpg',
    lasvegas: '/assets/bgg/lasvegas/cover.jpg',
    avalon: '/assets/bgg/avalon/cover.jpg',
    scout: '/assets/bgg/scout/cover.png',
    decrypto: '/assets/bgg/decrypto/cover.jpg',
    manila: '/assets/bgg/manila/cover.jpg',
    modernart: '/assets/bgg/modernart/cover.png',
    camelup: '/assets/bgg/camelup/cover.jpg',
    magicalathlete: '/assets/bgg/magicalathlete/cover.png',
};
const SELF_STYLED_GAME_ART = new Set(['loveletter', 'coup', 'monopolydeal', 'takefive', 'hanabi', 'splendor', 'kingdomino', 'acquire', 'citadels', 'witchtown', 'lasvegas', 'scout', 'decrypto', 'manila', 'modernart', 'camelup', 'magicalathlete']);
// 组件/牌面合照只供游戏自己按组件类型使用，不能默认铺成游戏背景。
const BGG_BACKGROUND_ART = { ...BGG_ART };
const BGG_COMPONENT_ART = {
    loveletter: '/assets/bgg/loveletter/detail.jpg',
    coup: '/assets/bgg/coup/modern-roles.jpg',
    citadels: '/assets/bgg/citadels/detail.jpg',
    lasvegas: '/assets/bgg/lasvegas/detail.jpg',
    avalon: '/assets/bgg/avalon/detail.jpg',
    scout: '/assets/bgg/scout/detail.jpg',
    decrypto: '/assets/bgg/decrypto/detail.png',
    manila: '/assets/bgg/manila/detail.jpg',
    modernart: '/assets/bgg/modernart/detail.jpg',
    camelup: '/assets/bgg/camelup/detail.jpg',
    magicalathlete: '/assets/bgg/magicalathlete/detail.png',
};
// 仅覆盖此前确认有 BGG 组件/牌面资源的游戏；图片作为真实 <img> 牌面视觉，实时规则数据仍由各游戏客户端渲染。
const BGG_COMPONENT_LABELS = {
    loveletter: '角色牌裁切参考',
    coup: '真实角色牌面与插画',
    citadels: '角色牌参考',
    lasvegas: '赌场与筹码参考',
    avalon: '身份牌与任务组件参考',
    scout: '数字牌与筹码参考',
    decrypto: '密码板与提示组件参考',
    manila: '港口与货船组件参考',
    modernart: '艺术牌与拍卖组件参考',
    camelup: '赛道与下注组件参考',
    magicalathlete: '运动员能力牌参考',
};
// 会话属于“当前标签页”，不能放在 localStorage：同源的第二个窗口不应接管第一个窗口的玩家身份。
const sessionStorageKey = 'jsgames.sessionToken';
let sessionToken = sessionStorage.getItem(sessionStorageKey) || '';
let pendingUrlRoom = /^\d{6}$/.test(new URLSearchParams(location.search).get('room') || '') ? new URLSearchParams(location.search).get('room') : null;
sessionResumePending = Boolean(sessionToken);

function isBenignResizeObserverError(error) {
  const message = error?.message || String(error || '');
  return message.includes('ResizeObserver loop completed with undelivered notifications')
    || message.includes('ResizeObserver loop limit exceeded');
}

window.addEventListener('error', event => {
  const error = event.error || event.message;
  if (isBenignResizeObserverError(error)) return;
  showFatalError(error || '未知错误');
});
window.addEventListener('unhandledrejection', event => showFatalError(event.reason || '未知 Promise 错误'));

function showFatalError(error) {
    const box = document.getElementById('fatalErrorBox');
    if (!box) return;
    box.style.display = 'grid';
    box.innerHTML = `<strong>页面遇到一点问题</strong><span>${escapeHtml(error?.message || String(error))}</span><button type="button" data-dismiss-fatal>知道了</button>`;
}
let roomFeedbackTimer = null;
let roomFeedbackHideTimer = null;
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
function connect() {
    setConnectionStatus('连接中', 'is-connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    ws.onopen = () => {
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
    };
    ws.onmessage = async event => { try { await handleMessage(JSON.parse(event.data)); } catch (error) { console.error(error); addLog(`消息处理失败：${error.message}`, 'error'); } };
    ws.onclose = () => { isConnected = false; sessionResumePending = Boolean(sessionToken); if (joinLobbyJoinPending) setJoinLobbyPending(false, '连接已断开，正在重连，请稍后再试。'); if (createRoomRequestPending) { setCreateRoomRequestPending(false); createRoomFormError.textContent = '连接已断开，房间尚未创建，请等待重连后重试。'; } setConnectionStatus('连接断开', 'is-disconnected'); addLog('连接已断开，正在重连...', 'error'); setTimeout(connect, 3000); };
    ws.onerror = () => addLog('连接出错', 'error');
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
            if (data.room) { setCreateRoomRequestPending(false); closeCreateRoomDialog(true); setRoom(data); currentRoom = data.room; if (data.room.status === 'waiting') enterWaitingRoom(); }
            else if (currentRoomId) { currentRoomId = null; currentRoom = null; updateInviteLink(); returnToLobby(); }
            addLog(data.room ? `已恢复房间 ${data.roomId}` : '会话已恢复', 'system');
            break;
        case 'resumeFailed':
            sessionResumePending = false;
            sessionStorage.removeItem(sessionStorageKey);
            sessionToken = '';
            addLog(data.message || '会话已过期', 'error');
            break;
        case 'gameList': renderGameList(data.games); break;
        case 'roomList': renderRoomList(data.rooms); break;
        case 'playerCount': playerCountEl.textContent = `在线 ${data.count}`; if (joinLobbyPlayerCountEl) joinLobbyPlayerCountEl.textContent = playerCountEl.textContent; break;
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
        case 'joinSuccess': setJoinLobbyPending(false); pendingUrlRoom = null; setRoom(data); addLog(`成功加入房间 ${data.roomId}`, 'system'); enterWaitingRoom(); break;
        case 'roomConfigured':
            currentRoom = data.room || currentRoom;
            pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || pendingRoomPlayerCount);
            pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || pendingEncryptorMode;
            pendingRoomSettings = getRoomSettingValues(currentRoom);
            updateInviteLink();
            renderWaitingRoomPanel();
            addLog(data.message || '房间人数已确认，现已公开', 'system');
            break;
        case 'playerJoined': currentRoom = data.room || currentRoom; addLog(`${data.player.name} 加入了房间`, 'info'); renderWaitingRoomPanel(); break;
        case 'playerLeft': currentRoom = data.room || currentRoom; addLog(data.message || '有玩家离开了房间', 'info'); renderWaitingRoomPanel(); break;
        case 'playerReady': currentRoom = data.room || currentRoom; addLog(data.message || '准备状态已更新', 'info'); renderWaitingRoomPanel(); break;
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
        case 'playerRenamed': currentRoom = data.room || currentRoom; renderWaitingRoomPanel(); break;
        case 'playerDisconnected': currentRoom = data.room || currentRoom; setRoomConnectionState(data.room?.connectionState, `${data.player?.name || '玩家'} 已断开连接`); addLog(data.message || `${data.player?.name || '玩家'} 已断线`, 'error'); renderWaitingRoomPanel(); break;
        case 'playerReconnected': currentRoom = data.room || currentRoom; setRoomConnectionState(data.connectionState || currentRoom?.connectionState, data.message); addLog(data.message || `${data.player?.name || '玩家'} 已重连`, 'system'); if (currentRoom?.status === 'waiting') renderWaitingRoomPanel(); break;
        case 'roomPaused': currentRoom = data.room || currentRoom; setRoomConnectionState(data.connectionState || currentRoom?.connectionState, data.message); addLog(data.message || '游戏已暂停，等待断线玩家重连', 'error'); break;
        case 'roomResumed': currentRoom = data.room || currentRoom; setRoomConnectionState(data.connectionState || currentRoom?.connectionState); addLog(data.message || '玩家已重连，游戏恢复', 'system'); break;
        case 'chat': addLog(`${data.player.id === myId ? '我' : data.player.name}: ${data.message}`, 'chat'); break;
        case 'gameStarted': if (currentRoom) currentRoom.status = 'playing'; await showGameMessage(data); break;
        case 'gameState': case 'gameEnded': setRoomConnectionState(data.state?.roomConnection || currentRoom?.connectionState); await showGameMessage(data); if (data.type === 'gameEnded' && data.winner) { const winnerNames = data.winner.winners?.map(winner => winner.name).join('、') || data.winner.name; addLog(`${winnerNames} 获胜`, 'system'); } break;
        case 'error':
            // Let the active game clear any pending-action lock and render the
            // authoritative state returned with a rejected action.
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
        default: break;
    }
}
function setRoom(data) { myId = data.playerId || myId; currentRoomId = data.roomId; currentRoom = data.room; const allowed = currentRoom?.allowedPlayerCounts || []; pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || (allowed.includes(9) ? 9 : allowed[0]) || 9); pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || 'rotation'; pendingRoomSettings = getRoomSettingValues(currentRoom); roomPageGame.textContent = currentRoom.roomName || currentRoom.gameName || currentRoom.gameType; roomPageCode.textContent = `${currentRoom.gameName || currentRoom.gameType} · 房间 ${currentRoom.id}`; roomPageIdentity.textContent = myId ? `玩家 ID ${myId}` : '访客 ID'; setRoomConnectionState(currentRoom?.connectionState); updateInviteLink(); }
function getGamePresentation(game) {
    const presentation = GAME_PRESENTATION[game.type] || {
        symbol: '◇',
        title: game.name,
        subtitle: '在线桌游',
        english: game.type.toUpperCase(),
        players: `${game.minPlayers}–${game.maxPlayers} 人`,
        time: '—',
        tone: 'default',
        description: '和朋友一起开始一局游戏。',
    };
    return { ...presentation, art: presentation.art || GAME_COVER_THUMBS[game.type] || BGG_ART[game.type] || null };
}
function renderGameCard(game, index) {
    const meta = getGamePresentation(game);
    const modeLabel = PLAY_MODE_LABELS[game.playMode] || '在线桌游';
    const artAttribute = meta.art ? ` data-card-art="${escapeHtml(meta.art)}"` : '';
    return `<article class="game-card tone-${meta.tone} ${meta.art ? 'has-cover-art' : ''} ${index === 0 ? 'is-featured' : ''}" data-game-type="${escapeHtml(game.type)}" tabindex="0" role="button" aria-label="查看${escapeHtml(meta.title || game.name)}规则并创建房间"><div class="game-card-art"${artAttribute} aria-hidden="true"><span class="art-orbit"></span><span class="game-symbol">${meta.symbol}</span><span class="game-card-index">${String(index + 1).padStart(2, '0')}</span><span class="game-art-label">${escapeHtml(meta.english)}</span></div><div class="game-card-body"><div class="game-card-title"><div><h3>${escapeHtml(meta.title || game.name)}</h3><p>${escapeHtml(meta.subtitle || meta.description)}</p></div><span class="game-card-arrow" aria-hidden="true">↗</span></div><div class="game-card-meta"><span>${escapeHtml(meta.players || `${game.minPlayers}–${game.maxPlayers} 人`)}</span><i></i><span>${escapeHtml(meta.time || '实时')}</span></div><span class="game-mode-badge mode-${escapeHtml(game.playMode || 'online')}">${escapeHtml(modeLabel)}</span></div></article>`;
}
function loadCoverArt(source) {
    if (coverArtPromises.has(source)) return coverArtPromises.get(source);
    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        let settled = false;
        const reveal = async () => {
            if (settled) return;
            settled = true;
            try { if (typeof image.decode === 'function') await image.decode(); } catch { /* 已完成下载，仍允许显示 */ }
            resolve(source);
        };
        image.addEventListener('load', reveal, { once: true });
        image.addEventListener('error', () => { if (!settled) { settled = true; reject(new Error('封面加载失败')); } }, { once: true });
        image.src = source;
        if (image.complete && image.naturalWidth) reveal();
    });
    coverArtPromises.set(source, promise);
    return promise;
}
function hydrateCoverArt(element) {
    const source = element?.dataset.cardArt;
    if (!source || element.dataset.cardArtLoaded === 'true' || element.dataset.cardArtLoading === 'true') return;
    const variable = element.dataset.cardArtVariable === 'room' ? '--room-art' : '--card-art';
    element.dataset.cardArtLoading = 'true';
    element.classList.add('is-art-loading');
    loadCoverArt(source).then(() => {
        if (!element.isConnected) return;
        element.style.setProperty(variable, `url(${JSON.stringify(source)})`);
        element.dataset.cardArtLoaded = 'true';
        element.dataset.cardArtLoading = 'false';
        requestAnimationFrame(() => element.classList.add('is-art-ready'));
    }).catch(() => {
        if (!element.isConnected) return;
        element.dataset.cardArtLoading = 'false';
        element.dataset.cardArtError = 'true';
        element.classList.add('is-art-error');
    });
}
function refreshLazyCoverArt() {
    coverArtObserver?.disconnect();
    const elements = [gamePickerEl, roomListEl, mobileRoomListEl, joinLobbyRoomListEl]
        .filter(Boolean)
        .flatMap(container => Array.from(container.querySelectorAll('[data-card-art]')));
    if (typeof IntersectionObserver === 'undefined') {
        elements.forEach(hydrateCoverArt);
        return;
    }
    coverArtObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        hydrateCoverArt(entry.target);
        coverArtObserver.unobserve(entry.target);
    }), { rootMargin: '560px 0px' });
    elements.forEach(element => coverArtObserver.observe(element));
}
function prefersReducedLobbyMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
function completeGameCardReveal(card) {
    if (!card) return;
    card.classList.remove('is-reveal-pending', 'is-revealing');
    card.style.removeProperty('--card-reveal-delay');
    card.dataset.cardRevealed = 'true';
}
function revealGameCard(card, order = 0) {
    if (!card?.classList.contains('is-reveal-pending')) return;
    gameCardRevealObserver?.unobserve(card);
    if (prefersReducedLobbyMotion()) {
        completeGameCardReveal(card);
        return;
    }
    const delay = Math.min(Math.max(0, order) * 55, 110);
    card.style.setProperty('--card-reveal-delay', String(delay) + 'ms');
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        card.removeEventListener('animationend', handleAnimationEnd);
        completeGameCardReveal(card);
    };
    const handleAnimationEnd = event => {
        if (event.target === card && event.animationName === 'gameCardReveal') finish();
    };
    card.addEventListener('animationend', handleAnimationEnd);
    requestAnimationFrame(() => {
        if (!card.isConnected) return finish();
        card.classList.add('is-revealing');
    });
    setTimeout(finish, 760 + delay);
}
function refreshGameCardReveal() {
    gameCardRevealObserver?.disconnect();
    if (document.body.classList.contains('is-entry-view') || lobbyViewEl?.style.display === 'none') return;
    const cards = Array.from(gamePickerEl?.querySelectorAll('.game-card.is-reveal-pending') || [])
        .filter(card => !card.hidden && !card.closest('[data-game-group]')?.hidden);
    if (!cards.length) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedLobbyMotion()) {
        cards.forEach(completeGameCardReveal);
        return;
    }
    gameCardRevealObserver = new IntersectionObserver(entries => {
        entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
            .forEach((entry, index) => revealGameCard(entry.target, index % 3));
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
    cards.forEach(card => gameCardRevealObserver.observe(card));
}
function renderGameList(games) {
    gameList = [...(games || [])];
    if (!gameList.length) gameList = [{ type: 'loveletter', name: '情书', minPlayers: 2, maxPlayers: 4 }];
    gameList = gameList.map(game => ({ ...game, group: game.group || 'tabletop', groupName: game.groupName || GROUP_PRESENTATION[game.group || 'tabletop']?.name || '卡牌与策略桌游' })).sort((a, b) => (a.groupOrder || 99) - (b.groupOrder || 99) || (a.sortOrder || 999) - (b.sortOrder || 999) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
    gameTypeSelect.innerHTML = gameList.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('');
    if (joinLobbyGameFilterEl) {
        const filterStillExists = selectedJoinRoomFilter === 'all' || gameList.some(game => game.type === selectedJoinRoomFilter);
        selectedJoinRoomFilter = filterStillExists ? selectedJoinRoomFilter : 'all';
        joinLobbyGameFilterEl.innerHTML = `<option value="all">全部游戏</option>${gameList.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('')}`;
        joinLobbyGameFilterEl.value = selectedJoinRoomFilter;
    }
    let cardIndex = 0;
    const groupedGames = gameList.reduce((groups, game) => { const key = game.group || 'tabletop'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(game); return groups; }, new Map());
    gamePickerEl.innerHTML = [...groupedGames.entries()].map(([groupId, groupGames]) => { const group = GROUP_PRESENTATION[groupId] || { name: groupGames[0]?.groupName || groupId, description: '' }; const cards = groupGames.map(game => renderGameCard(game, cardIndex++)).join(''); return `<section class="game-group" data-game-group="${escapeHtml(groupId)}"><header class="game-group-header"><div><span class="eyebrow">GAME COLLECTION</span><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p></div><span class="game-group-count">${groupGames.length} 款</span></header><div class="game-catalog">${cards}</div></section>`; }).join('');
    gamePickerEl.querySelectorAll('[data-game-type]').forEach(card => {
        card.classList.add('is-reveal-pending');
        card.addEventListener('click', event => {
            if (event.target.closest('a,button,input,select')) return;
            openCreateRoomDialog(card.dataset.gameType, card);
        });
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCreateRoomDialog(card.dataset.gameType, card); }
        });
    });
    refreshLazyCoverArt();
    gameCountEl.textContent = String(gameList.length);
    applyGameFilter();
    selectGame(gameTypeSelect.value || gameList[0].type, false);
}
function selectGame(type, announce = true) { if (!Array.from(gameTypeSelect.options).some(option => option.value === type)) return; gameTypeSelect.value = type; if (announce) addLog(`${GAME_PRESENTATION[type]?.title || type} 已选中`, 'system'); }
function roomListMarkup(rooms, emptyTitle = '还没有公开房间', emptyDescription = '创建一张桌，邀请朋友加入') {
    if (!rooms || rooms.length === 0) return `<div class="empty-state"><span>○</span><p>${escapeHtml(emptyTitle)}</p><small>${escapeHtml(emptyDescription)}</small></div>`;
    return rooms.map(room => {
        const meta = GAME_PRESENTATION[room.gameType] || { symbol: '◇', tone: 'default' };
        const presentation = getGamePresentation({ type: room.gameType, name: room.gameName, minPlayers: room.minPlayers, maxPlayers: room.maxPlayers });
        const artAttribute = presentation.art ? ` data-card-art="${escapeHtml(presentation.art)}" data-card-art-variable="room"` : '';
        const host = room.players?.find(player => player.id === room.hostId)?.name || '房主';
        const canJoin = room.status !== 'playing' && room.status !== 'ended' && !isInRoom(room.id);
        return `<article class="room-item room-tone-${meta.tone}" data-game-type="${escapeHtml(room.gameType)}"><span class="room-item-art"${artAttribute}><span class="room-mini-symbol">${meta.symbol}</span></span><div class="room-info"><strong>${escapeHtml(room.roomName || room.gameName || room.gameType)}</strong><span>${escapeHtml(room.gameName || room.gameType)} · ${escapeHtml(room.id)} · ${room.playerCount}/${room.maxPlayers} 人</span><small>房主 ${escapeHtml(host)}</small></div><div class="room-item-action">${canJoin ? `<button class="join-button" data-room-id="${escapeHtml(room.id)}" type="button">加入 <span>→</span></button>` : `<span class="room-state">${isInRoom(room.id) ? '已加入' : roomStatusText(room.status)}</span>`}</div></article>`;
    }).join('');
}
function renderRoomList(rooms) {
    const count = rooms?.length || 0;
    publicRooms = [...(rooms || [])];
    roomCountLabel.textContent = `${count} 张桌`;
    if (mobileRoomCountLabel) mobileRoomCountLabel.textContent = count ? `${count} 个公开房间可查看` : '暂时没有公开房间';
    const markup = roomListMarkup(rooms);
    roomListEl.innerHTML = markup;
    if (mobileRoomListEl) mobileRoomListEl.innerHTML = markup;
    refreshLazyCoverArt();
    renderJoinLobbyRooms();
}
function renderJoinLobbyRooms() {
    if (!joinLobbyRoomListEl) return;
    const rooms = selectedJoinRoomFilter === 'all' ? publicRooms : publicRooms.filter(room => room.gameType === selectedJoinRoomFilter);
    const emptyTitle = publicRooms.length ? '没有匹配的公开房间' : '还没有公开房间';
    const emptyDescription = publicRooms.length ? '换一个游戏筛选，或者输入房间号直达朋友的牌桌' : '创建一张桌，邀请朋友加入';
    joinLobbyRoomListEl.innerHTML = roomListMarkup(rooms, emptyTitle, emptyDescription);
    if (joinLobbyRoomCountEl) joinLobbyRoomCountEl.textContent = String(rooms.length);
    refreshLazyCoverArt();
}
function getWaitingRoomState() {
    if (!currentRoom || !currentRoomId || currentRoom.status !== 'waiting') return null;
    const players = currentRoom.players || [];
    const minPlayers = currentRoom.minPlayers || 2;
    const isHost = currentRoom.hostId === myId;
    const currentPlayer = players.find(player => player.id === myId) || null;
    const needsConfiguration = Boolean(currentRoom.configurationRequired && !currentRoom.configurationConfirmed);
    const targetPlayers = Number(currentRoom.targetPlayers || currentRoom.maxPlayers || minPlayers);
    const fixedPlayerCount = Boolean(currentRoom.targetPlayers);
    const connectedPlayers = players.filter(player => player.isOnline !== false);
    const memberPlayers = connectedPlayers.filter(player => player.id !== currentRoom.hostId);
    const readyCount = memberPlayers.filter(player => player.ready === true).length;
    const allPlayersReady = readyCount === memberPlayers.length;
    const playerProgress = fixedPlayerCount
        ? (players.length === targetPlayers ? '玩家已到齐' : `还差 ${Math.max(0, targetPlayers - players.length)} 人`)
        : (players.length >= minPlayers ? `已满足开局人数，还有 ${Math.max(0, targetPlayers - players.length)} 个空位` : `至少还需 ${Math.max(0, minPlayers - players.length)} 人`);
    const preload = gamePreloadStates.get(currentRoom.gameType) || { status: 'idle' };
    const playerCountReady = currentRoom.targetPlayers ? players.length === targetPlayers : players.length >= minPlayers;
    return { players, minPlayers, isHost, currentPlayer, needsConfiguration, targetPlayers, fixedPlayerCount, playerProgress, preload, connectedPlayers, memberPlayers, readyCount, allPlayersReady, playerCountReady, canStart: isHost && !needsConfiguration && playerCountReady && allPlayersReady && preload.status === 'ready' };
}
function waitingRoomConfigurationMarkup(waiting) {
    if (!waiting.needsConfiguration) return '';
    // 兼容旧验收文案：9 / 12 人选项现在由服务器的 roomSettings 元数据提供。
    const values = getRoomSettingValues(currentRoom, pendingRoomSettings);
    return `<section class="room-configuration room-settings-configuration"><small>ROOM SETUP</small><strong>确认本局游戏设置</strong><p>确认后房间才会公开；之后仍可由房主在房间内调整。</p><div class="pregame-room-setting-fields">${renderSharedRoomSettings(currentRoom, values, 'waiting', !waiting.isHost)}</div>${waiting.isHost ? '<button class="room-config-confirm" data-confirm-room-configuration type="button">确认设置并公开房间 <span>→</span></button>' : '<em>等待房主确认…</em>'}</section>`;
}
function waitingRoomToolsMarkup(waiting) {
    const me = waiting.currentPlayer;
    const playerRows = waiting.players.map(player => `<div class="pregame-player-row ${player.ready ? 'is-ready' : ''} ${player.isOnline === false ? 'is-offline' : ''}"><span class="pregame-player-state" aria-hidden="true"></span><span class="pregame-player-name"><strong>${escapeHtml(player.name)}</strong><small>${player.isHost ? '房主' : player.ready ? '已准备' : '等待准备'}${player.isOnline === false ? ' · 已断线' : ''}</small></span>${waiting.isHost && player.id !== myId ? `<button type="button" class="pregame-kick-button" data-kick-player="${escapeHtml(player.id)}">移出</button>` : ''}</div>`).join('');
    const settings = getRoomSettingDefinitions(currentRoom).length
        ? `<section class="pregame-inline-settings"><header><span>GAME SETTINGS</span><strong>游戏设置</strong><small>${waiting.isHost ? '房主修改后，成员需要重新准备' : '当前设置由房主管理'}</small></header><div class="pregame-room-setting-fields">${renderSharedRoomSettings(currentRoom, getRoomSettingValues(currentRoom, pendingRoomSettings), 'waiting', !waiting.isHost)}</div>${waiting.isHost ? '<button type="button" class="pregame-settings-save" data-save-room-settings>保存房间设置 <span>→</span></button>' : ''}</section>`
        : '';
    const readyPanel = waiting.isHost
        ? '<section class="pregame-ready-panel is-host"><div><strong>房主可以开局</strong><small>房主无需准备；等待成员准备完成后即可点击桌面魔法阵。</small></div></section>'
        : `<section class="pregame-ready-panel"><div><strong>${me?.ready ? '你已准备' : '准备好了吗？'}</strong><small>${waiting.allPlayersReady ? '所有成员均已准备' : `${waiting.readyCount}/${waiting.memberPlayers.length} 名成员已准备`}</small></div><button type="button" class="pregame-ready-button ${me?.ready ? 'is-ready' : ''}" data-toggle-ready>${me?.ready ? '取消准备' : '准备'}</button></section>`;
    return `<details class="pregame-room-tools" open><summary><span>ROOM CONTROL</span><strong>房间管理</strong><em>${waiting.readyCount}/${waiting.memberPlayers.length} 名成员已准备</em></summary><div class="pregame-tools-body">${readyPanel}<section class="pregame-player-list"><header><span>PLAYERS</span><strong>房间成员</strong></header>${playerRows}</section>${settings}</div></details>`;
}
function waitingRoomStartPresentation(waiting) {
    const count = waiting.players.length;
    const requiredPlayers = waiting.fixedPlayerCount ? waiting.targetPlayers : waiting.minPlayers;
    const missing = Math.max(0, requiredPlayers - count);
    let state = 'locked';
    let label = '尚未达到开局人数';
    let detail = missing > 0 ? `还差 ${missing} 人` : '';
    if (waiting.needsConfiguration) {
        state = 'setup';
        label = '请先完成房间设置';
        detail = waiting.isHost ? '确认规则后即可继续' : '等待房主确认规则';
    } else if (missing > 0) {
        state = 'locked';
    } else if (waiting.preload.status === 'error') {
        state = 'error';
        label = '游戏资源准备失败，请重新加载';
        detail = '资源准备失败';
    } else if (waiting.preload.status !== 'ready') {
        state = 'loading';
        label = '正在准备游戏资源';
        detail = '资源完成后即可开始';
    } else if (!waiting.allPlayersReady) {
        state = 'locked';
        label = '请等待所有成员准备';
        detail = `${waiting.readyCount}/${waiting.memberPlayers.length} 已准备`;
    } else if (waiting.isHost) {
        state = 'ready';
        label = '可以开始游戏了，请点击桌面魔法阵';
        detail = '点击魔法阵开始游戏';
    } else {
        state = 'waiting-host';
        label = '请等待房主开始游戏';
        detail = '房主可以点击魔法阵开始游戏';
    }
    return { state, label, detail };
}
function waitingRoomMagicMarkup(waiting) {
    const { state, label, detail } = waitingRoomStartPresentation(waiting);
    const circle = '<svg class="pregame-magic-svg" viewBox="0 0 220 220" preserveAspectRatio="none" aria-hidden="true"><circle class="pregame-magic-outer" cx="110" cy="110" r="91"></circle><circle class="pregame-magic-inner" cx="110" cy="110" r="79"></circle><path class="pregame-magic-triangle" d="M110 29 L181 153 L39 153 Z"></path><path class="pregame-magic-triangle" d="M110 191 L39 67 L181 67 Z"></path><circle class="pregame-magic-node" cx="110" cy="29" r="5"></circle><circle class="pregame-magic-node" cx="181" cy="153" r="5"></circle><circle class="pregame-magic-node" cx="39" cy="153" r="5"></circle><circle class="pregame-magic-node" cx="110" cy="191" r="5"></circle><circle class="pregame-magic-node" cx="39" cy="67" r="5"></circle><circle class="pregame-magic-node" cx="181" cy="67" r="5"></circle></svg>';
    const interactive = waiting.isHost;
    const trigger = interactive
        ? `<button class="pregame-magic-trigger" data-start-game data-start-state="${state}" type="button" aria-disabled="${state === 'ready' ? 'false' : 'true'}" aria-label="${escapeHtml(label)}，${escapeHtml(detail)}">${circle}</button>`
        : `<div class="pregame-magic-static" role="img" aria-label="${escapeHtml(label)}，${escapeHtml(detail)}">${circle}</div>`;
    return `<div class="pregame-magic-control is-${state}">${trigger}</div>`;
}
function waitingRoomStartGuidanceMarkup(waiting) {
    const { state, label } = waitingRoomStartPresentation(waiting);
    const requiredPlayers = waiting.fixedPlayerCount ? waiting.targetPlayers : waiting.minPlayers;
    const playerCountReady = waiting.players.length >= requiredPlayers && !waiting.needsConfiguration && waiting.allPlayersReady;
    return `<p class="pregame-start-guidance is-${state} ${playerCountReady ? 'has-player-count' : ''}" role="status">${escapeHtml(label)}</p>`;
}
const waitingSeatVisualOrderCache = new Map();
function waitingSeatVisualOrder(capacity) {
    if (waitingSeatVisualOrderCache.has(capacity)) return waitingSeatVisualOrderCache.get(capacity);
    const order = [0];
    const used = new Set(order);
    const regionForSlot = slot => Math.min(3, Math.floor(slot * 4 / capacity));
    const circularDistance = (left, right) => {
        const delta = Math.abs(left - right);
        return Math.min(delta, capacity - delta);
    };
    // Every arrival is placed from the current distribution instead of a
    // capacity-specific order. Candidate positions are scored by the gaps
    // they would leave around the whole ring; region and arrival direction
    // only break ties after the geometry is already balanced.
    while (order.length < capacity) {
        const previous = order[order.length - 1];
        const previousPrevious = order[order.length - 2];
        const previousPreviousRegion = previousPrevious == null ? -1 : regionForSlot(previousPrevious);
        const candidates = Array.from({ length: capacity }, (_, slot) => slot).filter(slot => !used.has(slot));
        const scoredCandidates = candidates.map(slot => {
            const occupied = [...order, slot].sort((left, right) => left - right);
            const gaps = occupied.map((current, index) => (occupied[(index + 1) % occupied.length] - current + capacity) % capacity);
            return {
                slot,
                nearestDistance: Math.min(...order.map(item => circularDistance(slot, item))),
                largestGap: Math.max(...gaps),
                gapImbalance: gaps.reduce((total, gap) => total + gap * gap, 0),
                regionLoad: order.filter(item => regionForSlot(item) === regionForSlot(slot)).length,
                previousDistance: circularDistance(slot, previous),
                repeatsPreviousPreviousRegion: Number(regionForSlot(slot) === previousPreviousRegion),
            };
        });
        scoredCandidates.sort((left, right) =>
            right.nearestDistance - left.nearestDistance
            || left.largestGap - right.largestGap
            || left.gapImbalance - right.gapImbalance
            || left.regionLoad - right.regionLoad
            || right.previousDistance - left.previousDistance
            || left.repeatsPreviousPreviousRegion - right.repeatsPreviousPreviousRegion
            || left.slot - right.slot
        );
        const candidate = scoredCandidates[0].slot;
        used.add(candidate);
        order.push(candidate);
    }
    waitingSeatVisualOrderCache.set(capacity, order);
    return order;
}
function waitingSeatVisualSlot(seatIndex, capacity) {
    const order = waitingSeatVisualOrder(capacity);
    const slot = order.indexOf(seatIndex);
    return slot >= 0 ? slot : seatIndex % capacity;
}
function waitingSeatStyle(seatIndex, capacity, mySeatIndex) {
    const seatSlot = waitingSeatVisualSlot(seatIndex, capacity);
    const mySlot = waitingSeatVisualSlot(mySeatIndex, capacity);
    // The viewer is always the six-o'clock anchor. Every other seat rotates by
    // the same slot offset, so each client receives its own table orientation.
    const visualSlot = seatIndex === mySeatIndex ? 0 : (seatSlot - mySlot + capacity) % capacity;
    const angle = Math.PI / 2 + (Math.PI * 2 * visualSlot / capacity);
    const compact = window.matchMedia?.('(max-width: 760px)').matches;
    // Keep the same angular ring on every client, but leave enough edge room
    // for the flame/name block at tablet widths and for 9–12 seat layouts.
    const x = 50 + Math.cos(angle) * (compact ? 34 : 38);
    const y = 50 + Math.sin(angle) * (compact ? 35 : 35);
    const flameDelay = (seatIndex * 137) % 900;
    return `--seat-x:${x.toFixed(2)}%;--seat-y:${y.toFixed(2)}%;--flame-delay:-${flameDelay}ms`;
}
function renderWaitingRoomScene() {
    const waiting = getWaitingRoomState();
    if (!waiting || !document.body.classList.contains('is-waiting-room-view')) {
        waitingSeatVisualRoomId = null;
        waitingSeatVisualSnapshot = new Map();
        waitingSeatExtinguishTimers.forEach(timer => clearTimeout(timer));
        waitingSeatExtinguishTimers.clear();
        waitingSeatIgniteUntil.clear();
        waitingSeatIgniteTimers.forEach(timer => clearTimeout(timer));
        waitingSeatIgniteTimers.clear();
        return;
    }
    if (waitingSeatVisualRoomId !== currentRoomId) {
        waitingSeatVisualRoomId = currentRoomId;
        waitingSeatVisualSnapshot = new Map();
        waitingSeatExtinguishTimers.forEach(timer => clearTimeout(timer));
        waitingSeatExtinguishTimers.clear();
        waitingSeatIgniteUntil.clear();
        waitingSeatIgniteTimers.forEach(timer => clearTimeout(timer));
        waitingSeatIgniteTimers.clear();
    }
    const meta = GAME_PRESENTATION[currentRoom.gameType] || { symbol: '◇', tone: 'default', title: currentRoom.gameName };
    const capacity = Math.max(1, waiting.targetPlayers);
    const playerBySeat = new Map();
    waiting.players.forEach((player, fallbackIndex) => {
        let seatIndex = Number(player.seatIndex);
        if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= capacity || playerBySeat.has(seatIndex)) {
            seatIndex = fallbackIndex;
            while (seatIndex < capacity && playerBySeat.has(seatIndex)) seatIndex += 1;
        }
        if (seatIndex < capacity) playerBySeat.set(seatIndex, player);
    });
    const previousSeats = waitingSeatVisualSnapshot;
    const nextSeats = new Map();
    const myPlayer = waiting.players.find(player => player.id === myId);
    const mySeatIndex = [...playerBySeat.entries()].find(([, player]) => player.id === myPlayer?.id)?.[0] ?? 0;
    const presetLayout = ['werewolf', 'avalon'].includes(currentRoom.gameType);
    const seats = Array.from({ length: capacity }, (_, seatIndex) => {
        const player = playerBySeat.get(seatIndex);
        const previous = previousSeats.get(seatIndex);
        const leaving = !player && previous?.player;
        const visualPlayer = player || (leaving ? previous.player : null);
        const occupied = Boolean(visualPlayer);
        const playerChanged = Boolean(player && player.id !== previous?.player?.id);
        const becameReady = Boolean(
            player
            && player.id !== currentRoom.hostId
            && player.ready === true
            && previous?.player?.id === player.id
            && previous.player.ready !== true,
        );
        if (playerChanged || becameReady) {
            const roomIdAtIgnite = currentRoomId;
            waitingSeatIgniteUntil.set(seatIndex, Date.now() + 840);
            clearTimeout(waitingSeatIgniteTimers.get(seatIndex));
            waitingSeatIgniteTimers.set(seatIndex, window.setTimeout(() => {
                waitingSeatIgniteTimers.delete(seatIndex);
                waitingSeatIgniteUntil.delete(seatIndex);
                if (currentRoomId === roomIdAtIgnite && currentRoom?.players?.some(item => Number(item.seatIndex) === seatIndex)) renderWaitingRoomScene();
            }, 850));
        }
        const isIgniting = Boolean(player && ((waitingSeatIgniteUntil.get(seatIndex) || 0) > Date.now()));
        const isExtinguishing = Boolean(leaving);
        const seatLabel = isExtinguishing ? '已离开' : visualPlayer?.id === currentRoom.hostId ? '房主' : visualPlayer?.id === myId ? '我的位置' : occupied ? '已入座' : '等待玩家';
        const readyLabel = occupied && !isExtinguishing && visualPlayer.id !== currentRoom.hostId ? (visualPlayer.isOnline === false ? '已断线' : visualPlayer.ready ? '已准备' : '未准备') : '';
        const seatName = occupied ? escapeHtml(visualPlayer.name) : `${seatIndex + 1} 号空位`;
        const seatAriaLabel = occupied ? `${escapeHtml(visualPlayer.name)}，${seatLabel}${readyLabel ? `，${readyLabel}` : ''}` : `${seatIndex + 1} 号空位，等待玩家`;
        if (player) nextSeats.set(seatIndex, { player });
        else {
            waitingSeatIgniteUntil.delete(seatIndex);
            clearTimeout(waitingSeatIgniteTimers.get(seatIndex));
            waitingSeatIgniteTimers.delete(seatIndex);
        }
        if (isExtinguishing && !waitingSeatExtinguishTimers.has(seatIndex)) {
            const roomIdAtRender = currentRoomId;
            const timer = window.setTimeout(() => {
                waitingSeatExtinguishTimers.delete(seatIndex);
                const currentPlayer = currentRoom?.players?.some(item => Number(item.seatIndex) === seatIndex);
                if (currentRoomId === roomIdAtRender && !currentPlayer) renderWaitingRoomScene();
            }, 720);
            waitingSeatExtinguishTimers.set(seatIndex, timer);
        }
        const seatClasses = [
            'pregame-seat', occupied ? 'is-occupied' : 'is-empty',
            visualPlayer?.id === myId ? 'is-me' : '',
            visualPlayer?.id === currentRoom.hostId ? 'is-host' : '',
            visualPlayer && visualPlayer.id !== currentRoom.hostId && visualPlayer.ready !== true ? 'is-not-ready' : '',
            isIgniting ? 'is-igniting' : '',
            isExtinguishing ? 'is-extinguishing' : '',
        ].filter(Boolean).join(' ');
        return `<article class="${seatClasses}" style="${waitingSeatStyle(seatIndex, capacity, mySeatIndex)}" data-seat-index="${seatIndex}" aria-label="${seatAriaLabel}"><span class="pregame-chair" aria-hidden="true"></span><span class="pregame-seat-fire" aria-hidden="true"><i class="pregame-fire-glow"></i><i class="pregame-fire-flame"></i><i class="pregame-fire-core"></i></span><span class="pregame-seat-copy"><strong>${seatName}</strong><small>${seatLabel}${readyLabel ? ` · ${readyLabel}` : ''}</small></span><b>${String(seatIndex + 1).padStart(2, '0')}</b></article>`;
    }).join('');
    waitingSeatVisualSnapshot = nextSeats;
    const preloadLabel = waiting.preload.status === 'ready' ? '游戏资源已准备' : waiting.preload.status === 'error' ? '资源准备失败' : '正在准备游戏资源';
    const preloadAction = waiting.preload.status === 'error' ? '<button class="pregame-retry" data-retry-preload type="button">重新加载</button>' : `<i class="pregame-load-dot ${waiting.preload.status === 'ready' ? 'is-ready' : ''}"></i>`;
    const tableAction = waitingRoomMagicMarkup(waiting);
    const startGuidance = waitingRoomStartGuidanceMarkup(waiting);
    const art = GAME_COVERS[currentRoom.gameType] || BGG_ART[currentRoom.gameType] || '';
    const roomSettingsMarkup = waitingRoomConfigurationMarkup(waiting) || waitingRoomToolsMarkup(waiting);
    roomMount.innerHTML = `<section class="pregame-room tone-${meta.tone || 'default'} ${presetLayout ? 'is-preset-layout' : ''}" data-game-type="${escapeHtml(currentRoom.gameType)}" style="--pregame-art:url('${escapeHtml(art)}')"><div class="pregame-backdrop" aria-hidden="true"></div><header class="pregame-room-meta"><div><span>${meta.english || currentRoom.gameType.toUpperCase()}</span><h1>${escapeHtml(currentRoom.roomName || meta.title || currentRoom.gameName)}</h1></div><div><span>${currentRoom.isPublic === false ? '仅凭邀请' : '公开房间'}</span><strong>${escapeHtml(currentRoom.id)}</strong></div></header><main class="pregame-stage" data-seat-count="${capacity}"><div class="pregame-table" aria-label="${escapeHtml(meta.title || currentRoom.gameName)}等待牌桌"><div class="pregame-table-action">${tableAction}</div></div><div class="pregame-seats">${seats}</div></main>${startGuidance}<footer class="pregame-room-footer"><div class="pregame-resource-state">${preloadAction}<span>${preloadLabel}<small>${waiting.preload.status === 'ready' ? '开局后无需再次下载核心界面' : waiting.preload.error || '只加载当前这款游戏'}</small></span></div><div><span>${waiting.players.length} / ${waiting.targetPlayers} 已入座</span><button type="button" data-copy-room-code>复制房间号</button></div></footer>${roomSettingsMarkup}</section>`;
}
function renderWaitingRoomPanel() {
    currentRoomPanel.style.display = 'none';
    startGameBtn.style.display = 'none';
    lobbyStartGameBtn.style.display = 'none';
    renderWaitingRoomScene();
}
function getGameClientPath(gameType) { return getManifestClientPath(gameType); }
function getGameStylePaths(gameType) { return getManifestStylePaths(gameType); }
function preloadGameStyles(gameType) {
    getGameStyleHrefs(gameType).forEach(href => {
        if (document.head.querySelector(`link[data-game-preload="${gameType}"][href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = href;
        link.dataset.gamePreload = gameType;
        document.head.appendChild(link);
    });
}
function loadGameModule(gameType) {
    if (!gameModulePromises.has(gameType)) gameModulePromises.set(gameType, import(`${getGameClientPath(gameType)}?v=${ASSET_VERSION}`));
    return gameModulePromises.get(gameType);
}
function preloadGameClient(gameType, force = false) {
    const existing = gamePreloadStates.get(gameType);
    if (!force && (existing?.status === 'ready' || existing?.status === 'loading')) return existing.promise || Promise.resolve();
    if (force) gameModulePromises.delete(gameType);
    preloadGameStyles(gameType);
    const state = { status: 'loading', error: '', promise: null };
    gamePreloadStates.set(gameType, state);
    renderWaitingRoomScene();
    state.promise = loadGameModule(gameType).then(module => {
        if (typeof module.createGameClient !== 'function') throw new Error(`${gameType} 没有导出 createGameClient`);
        state.status = 'ready';
        renderWaitingRoomScene();
        return module;
    }).catch(error => {
        state.status = 'error';
        state.error = error?.message || '加载失败';
        gameModulePromises.delete(gameType);
        renderWaitingRoomScene();
        throw error;
    });
    return state.promise;
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
    preloadGameClient(currentRoom.gameType).catch(error => addLog(`资源预加载失败：${error.message}`, 'error'));
}
function openGameView() { closeLobbyEntry(); joinLobbyViewEl.hidden = true; joinLobbyViewEl.style.display = 'none'; appHeaderEl.style.display = 'none'; document.body.classList.remove('is-waiting-room-view'); document.body.classList.add('is-game-view'); lobbyViewEl.style.display = 'none'; roomViewEl.style.display = 'block'; currentRoomPanel.style.display = 'none'; roomMount.style.display = 'none'; gameMount.style.display = 'block'; startGameBtn.style.display = 'none'; window.dispatchEvent(new Event('resize')); }
function cancelGameEntryTransition() {
    gameEntryTransitionToken += 1;
    activeGameEntryTransition?.remove();
    activeGameEntryTransition = null;
    gameEntryTransitionPromise = null;
}
function waitForGameEntry(milliseconds) { return new Promise(resolve => window.setTimeout(resolve, milliseconds)); }
function isGameEntryCurrent(token, roomId) { return token === gameEntryTransitionToken && currentRoomId === roomId; }
function buildGameEntryGroups(roomElement) {
    const stage = roomElement?.querySelector('.pregame-stage');
    const capacity = Math.max(1, Number(stage?.dataset.seatCount) || 1);
    const visualSlotForSeat = index => waitingSeatVisualSlot(index, capacity);
    const mySeatIndex = Number(roomElement?.querySelector('.pregame-seat.is-me')?.dataset.seatIndex) || 0;
    const myVisualSlot = visualSlotForSeat(mySeatIndex);
    const occupied = Array.from(roomElement?.querySelectorAll('.pregame-seat.is-occupied') || [])
        .map(seat => ({ seat, index: Number(seat.dataset.seatIndex) }))
        .filter(item => Number.isInteger(item.index));
    const relativeSeat = index => (visualSlotForSeat(index) - myVisualSlot + capacity) % capacity;
    const ordered = occupied.sort((left, right) => relativeSeat(left.index) - relativeSeat(right.index));
    if (ordered.length === 1) return [[ordered[0].seat], [ordered[0].seat]];
    if (ordered.length === 2) return ordered.map(item => [item.seat]);
    const remaining = [...ordered];
    const pairs = [];
    while (remaining.length) {
        const first = remaining.shift();
        if (!remaining.length) { pairs.push([first.seat]); break; }
        let partnerPosition = 0;
        let bestDistance = -1;
        remaining.forEach((candidate, position) => {
            const delta = (visualSlotForSeat(candidate.index) - visualSlotForSeat(first.index) + capacity) % capacity;
            const circularDistance = Math.min(delta, capacity - delta);
            if (circularDistance > bestDistance) { bestDistance = circularDistance; partnerPosition = position; }
        });
        pairs.push([first.seat, remaining.splice(partnerPosition, 1)[0].seat]);
    }
    const groupCount = Math.min(4, pairs.length);
    return Array.from({ length: groupCount }, () => []).map((group, index) => {
        for (let pairIndex = index; pairIndex < pairs.length; pairIndex += groupCount) group.push(...pairs[pairIndex]);
        return group;
    });
}
function createGameEntryTransition(gameType) {
    const transition = document.createElement('div');
    transition.className = 'game-entry-transition';
    transition.setAttribute('aria-hidden', 'true');
    const art = GAME_COVERS[gameType] || BGG_ART[gameType] || '';
    if (art) transition.style.setProperty('--entry-art', `url("${art}")`);
    transition.innerHTML = `<div class="game-entry-burst" aria-hidden="true"><i class="game-entry-burst-ring is-wide"></i><i class="game-entry-burst-ring is-tight"></i></div><div class="game-entry-streams" aria-hidden="true"></div><div class="game-entry-portal" aria-hidden="true"><div class="game-entry-portal-plane"><i class="game-entry-portal-ring is-outer"></i><i class="game-entry-portal-ring is-middle"></i><i class="game-entry-portal-ring is-inner"></i><span class="game-entry-portal-well"></span><b>✦</b></div><span class="game-entry-portal-column"></span></div>`;
    return transition;
}
function prepareGameEntryStreams(transition, roomElement, targetX, targetY) {
    const streamMount = transition.querySelector('.game-entry-streams');
    Array.from(roomElement.querySelectorAll('.pregame-seat.is-occupied .pregame-seat-fire')).forEach((fire, index) => {
        const rect = fire.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height * .72;
        const deltaX = targetX - startX;
        const deltaY = targetY - startY;
        const stream = document.createElement('i');
        stream.style.setProperty('--stream-x', `${startX}px`);
        stream.style.setProperty('--stream-y', `${startY}px`);
        stream.style.setProperty('--stream-length', `${Math.hypot(deltaX, deltaY)}px`);
        stream.style.setProperty('--stream-angle', `${Math.atan2(deltaY, deltaX)}rad`);
        stream.style.setProperty('--stream-delay', `${(index % 4) * 24}ms`);
        streamMount.appendChild(stream);
    });
}
async function playGameEntryTransition(gameType) {
    const roomIdAtStart = currentRoomId;
    const token = ++gameEntryTransitionToken;
    const roomElement = roomMount.querySelector('.pregame-room');
    if (!roomElement || !isGameEntryCurrent(token, roomIdAtStart)) { if (isGameEntryCurrent(token, roomIdAtStart)) openGameView(); return; }
    const transition = createGameEntryTransition(gameType);
    const tableRect = roomElement.querySelector('.pregame-table')?.getBoundingClientRect();
    const portalX = tableRect ? tableRect.left + tableRect.width / 2 : window.innerWidth / 2;
    const portalY = tableRect ? tableRect.top + tableRect.height / 2 : window.innerHeight / 2;
    transition.style.setProperty('--entry-core-x', `${portalX}px`);
    transition.style.setProperty('--entry-core-y', `${portalY}px`);
    prepareGameEntryStreams(transition, roomElement, portalX, portalY);
    activeGameEntryTransition = transition;
    document.body.appendChild(transition);
    roomElement.classList.add('is-entry-transitioning');
    try {
        const groups = buildGameEntryGroups(roomElement);
        const flashWaves = groups;
        const lastFlashWaveBySeat = new Map();
        flashWaves.forEach((group, groupIndex) => group.forEach(seat => lastFlashWaveBySeat.set(seat, groupIndex)));
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) {
            await Promise.all(flashWaves.map(async (group, groupIndex) => {
                await waitForGameEntry(groupIndex * 420);
                if (!isGameEntryCurrent(token, roomIdAtStart)) return;
                group.forEach(seat => seat.classList.add('is-entry-flash'));
                await waitForGameEntry(250);
                if (!isGameEntryCurrent(token, roomIdAtStart)) return;
                group.forEach(seat => {
                    seat.classList.remove('is-entry-flash');
                    if (lastFlashWaveBySeat.get(seat) === groupIndex) seat.classList.add('is-entry-fading');
                });
            }));
        }
        if (!isGameEntryCurrent(token, roomIdAtStart)) return;
        await waitForGameEntry(320);
        if (!isGameEntryCurrent(token, roomIdAtStart)) return;
        if (!reducedMotion) {
            transition.classList.add('is-gathering');
            await waitForGameEntry(680);
            if (!isGameEntryCurrent(token, roomIdAtStart)) return;
            transition.classList.remove('is-gathering');
        }
        transition.classList.add('is-bursting');
        if (!reducedMotion) await waitForGameEntry(280);
        if (!isGameEntryCurrent(token, roomIdAtStart)) return;
        openGameView();
        await waitForGameEntry(reducedMotion ? 120 : 560);
    } finally {
        roomElement.classList.remove('is-entry-transitioning');
        if (activeGameEntryTransition === transition) {
            activeGameEntryTransition = null;
            transition.remove();
        }
    }
}
async function startGameEntry(type, data) { await loadGameModule(type); await prepareGameClient(type); currentGameClient?.handleMessage(data); updateStudyControls(data.state); await playGameEntryTransition(type); }
function returnToLobby() { cancelGameEntryTransition(); setRoomConnectionState(null); document.body.classList.remove('is-game-view', 'is-waiting-room-view'); joinLobbyViewEl.hidden = true; joinLobbyViewEl.style.display = 'none'; appHeaderEl.style.display = 'grid'; lobbyViewEl.style.display = 'grid'; roomViewEl.style.display = 'none'; roomMount.style.display = 'block'; roomMount.innerHTML = ''; gameMount.style.display = 'none'; destroyGameClient(); currentRoomPanel.style.display = 'none'; document.querySelector('.catalog-column')?.classList.remove('is-muted'); requestAnimationFrame(refreshGameCardReveal); }
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
        if (currentRoom?.status === 'waiting') enterWaitingRoom(); else returnToLobby();
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
const STUDY_SIDE_LABELS = {
    chess: { white: '白方', black: '黑方' },
    xiangqi: { red: '红方', black: '黑方' },
    jungle: { red: '红方', blue: '蓝方' },
    junqi: { red: '红方', blue: '蓝方' },
    gobang: { black: '黑方', white: '白方' },
    checkers: { red: '红方', blue: '蓝方', green: '绿方', yellow: '黄方', purple: '紫方', orange: '橙方' },
};
const STUDY_PIECE_TYPES = {
    chess: [['p', '兵'], ['n', '马'], ['b', '象'], ['r', '车'], ['q', '后'], ['k', '王']],
    xiangqi: {
        red: [['s', '兵'], ['r', '車'], ['h', '馬'], ['e', '相'], ['a', '仕'], ['c', '炮'], ['k', '帥']],
        black: [['s', '卒'], ['r', '車'], ['h', '馬'], ['e', '象'], ['a', '士'], ['c', '砲'], ['k', '將']],
    },
    jungle: [['r', '鼠'], ['c', '猫'], ['d', '狗'], ['w', '狼'], ['l', '豹'], ['t', '虎'], ['j', '狮'], ['e', '象']],
};
function studySideLabel(gameType, color, fallback = '当前阵营') {
    return STUDY_SIDE_LABELS[gameType]?.[color] || fallback || (color ? `${color}方` : '当前阵营');
}
function studyPieceTypes(gameType, color) {
    const types = STUDY_PIECE_TYPES[gameType];
    if (gameType === 'xiangqi') return types?.[color] || types?.red || [];
    return types || [];
}
function installStudyControls() {
    studyControlsEl?.remove();
    studyControlsEl = document.createElement('section');
    studyControlsEl.className = 'study-controls';
    studyControlsEl.hidden = true;
    studyControlsEl.setAttribute('aria-label', '棋谱模式控制');
    studyControlsEl.innerHTML = '<span class="study-controls-kicker">STUDY TABLE</span><strong data-study-label>棋谱模式</strong><small data-study-detail></small><div class="study-controls-actions"><button type="button" data-study-switch>切换到下一方</button><button type="button" data-study-reset hidden>标准开局</button><button type="button" data-study-clear hidden>清空局面</button><button type="button" data-study-remove hidden>删除棋子</button><button type="button" data-study-confirm hidden>完成摆棋</button></div><div class="study-piece-tray" data-study-piece-tray hidden></div>';
    gameMount.appendChild(studyControlsEl);
}
function updateStudyControls(state) {
    if (!studyControlsEl) return;
    const active = Boolean(state?.studyMode);
    studyControlsEl.hidden = !active;
    gameMount.dataset.studySide = active ? String(state.myColor || '') : '';
    if (!active) return;
    const seats = Array.isArray(state.studySeatNames) ? state.studySeatNames : [];
    const index = Number(state.studySeatIndex || 0);
    const current = seats[index] || { name: state.myColor || '当前阵营' };
    const next = seats[(index + 1) % Math.max(1, seats.length)] || current;
    const currentSide = studySideLabel(currentRoom?.gameType, current.color || state.myColor, current.name);
    const nextSide = studySideLabel(currentRoom?.gameType, next.color, next.name);
    const turnSeat = seats.find(seat => seat.id === state.currentTurn || seat.color === state.turn);
    const turnSide = studySideLabel(currentRoom?.gameType, turnSeat?.color, turnSeat?.name || state.currentTurnName || '当前回合');
    const label = studyControlsEl.querySelector('[data-study-label]');
    const detail = studyControlsEl.querySelector('[data-study-detail]');
    const button = studyControlsEl.querySelector('[data-study-switch]');
    const reset = studyControlsEl.querySelector('[data-study-reset]');
    const clear = studyControlsEl.querySelector('[data-study-clear]');
    const remove = studyControlsEl.querySelector('[data-study-remove]');
    const confirm = studyControlsEl.querySelector('[data-study-confirm]');
    const tray = studyControlsEl.querySelector('[data-study-piece-tray]');
    studyControlsEl.dataset.studySeatIndex = String(index);
    studyControlsEl.dataset.studySeatCount = String(seats.length);
    studyControlsEl.dataset.studyPhase = String(state.studyPhase || 'play');
    if (label) label.textContent = `当前：${currentSide}`;
    const setup = state.studyPhase === 'setup';
    const nativeSetup = state.phase === 'setup';
    if (detail) detail.textContent = nativeSetup ? `先完成${currentSide}布阵，再切换另一方` : setup ? `点击棋盘移动或摆放${currentSide}棋子` : state.myIsCurrentTurn ? `当前${currentSide}可以行动` : `等待${turnSide}；可切换后继续推演`;
    if (button) button.textContent = `切换到${nextSide}`;
    if (reset) reset.hidden = !setup || nativeSetup;
    if (clear) clear.hidden = !setup || nativeSetup;
    if (remove) remove.hidden = !setup || nativeSetup;
    if (confirm) confirm.hidden = !setup || nativeSetup;
    if (tray) {
        const types = studyPieceTypes(currentRoom?.gameType, current.color || state.myColor);
        tray.hidden = !setup || nativeSetup || !types.length;
        tray.innerHTML = types.map(([type, name]) => `<button type="button" data-study-place-type="${type}" class="${studyControlsEl.dataset.studyPlacementType === type ? 'is-selected' : ''}">${name}</button>`).join('');
    }
}
function currentGameStudySeatIndex() { return studyControlsEl?.dataset.studySeatIndex || ''; }
function currentGameStudySeatCount() { return studyControlsEl?.dataset.studySeatCount || ''; }
function refreshStudyControlSelection() {
    studyControlsEl?.querySelectorAll('[data-study-place-type]').forEach(button => button.classList.toggle('is-selected', button.dataset.studyPlaceType === studyControlsEl.dataset.studyPlacementType));
    const remove = studyControlsEl?.querySelector('[data-study-remove]');
    remove?.classList.toggle('is-selected', studyControlsEl.dataset.studyRemoveMode === 'true');
}
function applyGameArtwork(gameType) {
    activeGameArtStyle?.remove();
    activeGameArtStyle = null;
    gameMount.removeAttribute('data-bgg-art');
    gameMount.style.removeProperty('--bgg-background-art');
    gameMount.style.removeProperty('--bgg-detail-art');
    if (SELF_STYLED_GAME_ART.has(gameType)) return;
    const background = BGG_BACKGROUND_ART[gameType];
    if (!background || !gameMount.firstElementChild) return;
    gameMount.dataset.bggArt = gameType;
    gameMount.style.setProperty('--bgg-background-art', `url("${background}")`);
    activeGameArtStyle = document.createElement('style');
    activeGameArtStyle.textContent = `#gameMount[data-bgg-art="${gameType}"] > :first-child { background-image: linear-gradient(135deg, rgba(13, 24, 30, .88), rgba(13, 24, 30, .76)), var(--bgg-background-art) !important; background-position: center; background-size: cover; }`;
    document.head.appendChild(activeGameArtStyle);
}
function applyBggComponentArt(gameType) {
    const root = gameMount.firstElementChild;
    const source = BGG_COMPONENT_ART[gameType];
    if (!root || !source) return;
    if (SELF_STYLED_GAME_ART.has(gameType)) return;
    const label = BGG_COMPONENT_LABELS[gameType] || '组件图参考';
    gameMount.dataset.bggComponent = gameType;
    root.classList.add('has-bgg-component-art');
    const strip = document.createElement('button');
    strip.type = 'button';
    strip.className = 'bgg-component-strip';
    strip.setAttribute('aria-label', `打开${label}`);
    strip.innerHTML = `<img src="${source}" alt=""><span>BGG 组件图<small>${escapeHtml(label)}</small></span><b>↗</b>`;
    strip.addEventListener('click', () => openBggComponentDialog(source, label));
    root.appendChild(strip);
}
function openBggComponentDialog(source, label) {
    activeBggComponentDialog?.remove();
    const dialog = document.createElement('div');
    dialog.className = 'bgg-art-dialog';
    dialog.innerHTML = `<div class="bgg-art-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}"><button type="button" class="bgg-art-dialog-close" aria-label="关闭">×</button><span>${escapeHtml(label)}</span><img src="${source}" alt="${escapeHtml(label)}"><small>BGG 组件参考图 · 牌面按游戏类型使用</small></div>`;
    const close = () => { dialog.remove(); if (activeBggComponentDialog === dialog) activeBggComponentDialog = null; };
    dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('.bgg-art-dialog-close')) close(); });
    document.body.appendChild(dialog);
    activeBggComponentDialog = dialog;
}
function destroyGameClient() { currentGameClient?.destroy?.(); currentGameClient = null; activeGameArtStyle?.remove(); activeGameArtStyle = null; activeBggComponentDialog?.remove(); activeBggComponentDialog = null; gameMount.removeAttribute('data-game-type'); gameMount.removeAttribute('data-bgg-art'); gameMount.removeAttribute('data-bgg-component'); gameMount.style.removeProperty('--bgg-background-art'); gameMount.style.removeProperty('--bgg-detail-art'); gameMount.innerHTML = ''; }

function defaultRoomName(gameTitle) {
    const hostName = (nameInput?.value || myName || '房主').trim() || '房主';
    return [...`${hostName}的${gameTitle}房间`].slice(0, 24).join('');
}

function choiceMarkup(name, options, selectedValue, inputAttributes = '') {
    return options.map(option => `<label><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${String(option.value) === String(selectedValue) ? 'checked' : ''} required${inputAttributes}><span><b>${escapeHtml(option.title)}</b>${option.copy ? `<small>${escapeHtml(option.copy)}</small>` : ''}</span></label>`).join('');
}

function getRoomSettingDefinitions(source = currentRoom) {
    return Array.isArray(source?.roomSettings) ? source.roomSettings : [];
}

function getRoomSettingValues(source = currentRoom, overrides = {}) {
    const options = source?.gameOptions || {};
    return getRoomSettingDefinitions(source).reduce((values, definition) => {
        if (overrides[definition.key] !== undefined) values[definition.key] = overrides[definition.key];
        else if (options[definition.key] !== undefined) values[definition.key] = options[definition.key];
        else values[definition.key] = definition.defaultValue;
        return values;
    }, {});
}

function renderSharedRoomSettings(source, values = {}, context = 'create', disabled = false) {
    const definitions = getRoomSettingDefinitions(source);
    return definitions.map((definition, index) => {
        const key = escapeHtml(definition.key);
        const inputName = escapeHtml(context === 'create' ? definition.key : `room-setting-${definition.key}`);
        const value = values[definition.key] !== undefined ? values[definition.key] : definition.defaultValue;
        const disabledAttribute = disabled ? ' disabled' : '';
        const inputAttributes = ` data-room-setting-input data-room-setting-key="${key}"${disabledAttribute}`;
        const legacyFieldAttribute = definition.key === 'playerCount'
            ? ' data-room-player-count'
            : definition.key === 'encryptorMode'
                ? ' data-encryptor-mode'
                : '';
        if (definition.kind === 'toggle') {
            return `<div class="room-setting-field room-toggle-row" data-room-setting="${key}"><div class="room-toggle-copy"><b>${escapeHtml(definition.label)}</b>${definition.description ? `<small>${escapeHtml(definition.description)}</small>` : ''}</div><label class="room-switch"><input type="checkbox" name="${inputName}"${value === true ? ' checked' : ''}${inputAttributes}><span aria-hidden="true"></span></label></div>`;
        }
        const headingClass = context === 'create' && index === 0 ? ' class="room-special-heading"' : '';
        const heading = `<legend${headingClass}><span>${escapeHtml(definition.label)}</span>${context === 'create' && index === 0 ? '<em>SPECIAL RULES</em>' : ''}</legend>`;
        return `<fieldset class="room-setting-field" data-room-setting="${key}"${legacyFieldAttribute}>${heading}<div class="room-setting-options">${choiceMarkup(inputName, definition.options || [], value, inputAttributes)}</div>${definition.description ? `<small>${escapeHtml(definition.description)}</small>` : ''}</fieldset>`;
    }).join('');
}

function collectRoomSettingValues(root, source = currentRoom) {
    const values = {};
    getRoomSettingDefinitions(source).forEach(definition => {
        const input = root?.querySelector(`[data-room-setting-key="${definition.key}"]:checked`) || root?.querySelector(`[data-room-setting-key="${definition.key}"]`);
        if (!input) return;
        values[definition.key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    return values;
}

function renderCreateRoomSettings(game) {
    const meta = getGamePresentation(game);
    createRoomForm?.reset();
    createRoomName.value = defaultRoomName(meta.title || game.name);
    createRoomForm.querySelector('input[name="isPublic"][value="true"]').checked = true;
    createRoomFormError.textContent = '';

    const isFixedCountGame = Number(game.minPlayers) === Number(game.maxPlayers);
    const usesSpecialPlayerCount = getRoomSettingDefinitions(game).some(definition => definition.key === 'playerCount' && definition.requiredBeforeJoin);
    const syncStudyCapacity = () => {
        const selectedMode = createRoomSpecialSettings.querySelector('[data-room-setting-key="gameMode"]:checked')?.value;
        createRoomCapacityField.hidden = isFixedCountGame || usesSpecialPlayerCount || selectedMode === 'study';
    };
    createRoomCapacityField.hidden = isFixedCountGame || usesSpecialPlayerCount;
    if (!createRoomCapacityField.hidden) {
        const limits = [];
        for (let count = Number(game.minPlayers); count <= Number(game.maxPlayers); count += 1) {
            limits.push({ value: count, title: `${count} 人` });
        }
        createRoomCapacityOptions.innerHTML = choiceMarkup('seatLimit', limits, game.maxPlayers);
    } else {
        createRoomCapacityOptions.innerHTML = '';
    }

    createRoomSpecialSettings.innerHTML = renderSharedRoomSettings(game, getRoomSettingValues(game), 'create');
    createRoomSpecialSettings.onchange = syncStudyCapacity;
    syncStudyCapacity();
}

function openCreateRoomDialog(gameType, returnFocusElement = null) {
    if (currentRoomId) return addLog('请先离开当前房间', 'error');
    const game = gameList.find(item => item.type === gameType);
    if (!game || !createRoomDialog) return addLog('没有找到该游戏', 'error');
    activeCreateRoomGame = game;
    createRoomDialogReturnFocus = returnFocusElement || document.activeElement;
    selectGame(game.type, false);

    const meta = getGamePresentation(game);
    const details = getGameDetails(game.type);
    createRoomRuleSymbol.textContent = meta.symbol || '◇';
    createRoomRuleEnglish.textContent = meta.english || game.type.toUpperCase();
    createRoomDialogTitle.textContent = meta.title || game.name;
    createRoomRuleOverview.textContent = details.overview;
    createRoomRulePlayers.textContent = meta.players || `${game.minPlayers}–${game.maxPlayers} 人`;
    createRoomRuleTime.textContent = meta.time || '实时';
    createRoomRuleMode.textContent = PLAY_MODE_LABELS[game.playMode] || '在线桌游';
    createRoomRuleList.innerHTML = details.rules.map(([title, copy], index) => `<article class="create-room-rule-item"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`).join('');
    createRoomRuleNote.textContent = details.note;
    const dialogArt = GAME_COVERS[game.type] || meta.art;
    if (dialogArt) createRoomRuleHero.style.setProperty('--dialog-art', `url("${dialogArt}")`);
    else createRoomRuleHero.style.removeProperty('--dialog-art');
    renderCreateRoomSettings(game);

    createRoomDialog.querySelector('.game-rules-step').inert = false;
    createRoomForm.inert = true;
    createRoomDialog.classList.remove('is-settings');
    createRoomDialog.hidden = false;
    createRoomDialog.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-create-dialog');
    requestAnimationFrame(() => {
        createRoomDialog.classList.add('is-open');
        createRoomDialogClose.focus();
    });
}

function showCreateRoomSettings() {
    if (!activeCreateRoomGame || createRoomRequestPending) return;
    createRoomDialog.querySelector('.game-rules-step').inert = true;
    createRoomForm.inert = false;
    createRoomDialog.classList.add('is-settings');
    createRoomForm.scrollTop = 0;
    setTimeout(() => createRoomName.focus(), 180);
}

function showCreateRoomRules() {
    if (createRoomRequestPending) return;
    createRoomDialog.querySelector('.game-rules-step').inert = false;
    createRoomForm.inert = true;
    createRoomDialog.classList.remove('is-settings');
    setTimeout(() => createRoomNextBtn.focus(), 180);
}

function closeCreateRoomDialog(force = false) {
    if (!createRoomDialog || (createRoomRequestPending && !force) || createRoomDialog.hidden) return;
    createRoomDialog.classList.remove('is-open');
    createRoomDialog.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-create-dialog');
    const returnFocus = createRoomDialogReturnFocus;
    setTimeout(() => {
        if (createRoomDialog.classList.contains('is-open')) return;
        createRoomDialog.hidden = true;
        createRoomDialog.classList.remove('is-settings');
        activeCreateRoomGame = null;
        if (!force && returnFocus?.isConnected) returnFocus.focus();
    }, 230);
}

function setCreateRoomRequestPending(pending) {
    createRoomRequestPending = Boolean(pending);
    if (createRoomConfirmBtn) {
        createRoomConfirmBtn.disabled = createRoomRequestPending;
        createRoomConfirmBtn.innerHTML = createRoomRequestPending ? '正在创建…' : '确定创建 <span>→</span>';
    }
    if (createRoomBackBtn) createRoomBackBtn.disabled = createRoomRequestPending;
    if (createRoomCancelBtn) createRoomCancelBtn.disabled = createRoomRequestPending;
    if (createRoomDialogClose) createRoomDialogClose.disabled = createRoomRequestPending;
}

function submitCreateRoom(event) {
    event.preventDefault();
    if (!activeCreateRoomGame || createRoomRequestPending) return;
    if (!isConnected || ws?.readyState !== WebSocket.OPEN) {
        createRoomFormError.textContent = '当前尚未连接到服务器，请稍后重试。';
        return;
    }
    const formData = new FormData(createRoomForm);
    const roomName = String(formData.get('roomName') || '').replace(/\s+/g, ' ').trim();
    if (!roomName) {
        createRoomFormError.textContent = '请输入房间名称。';
        createRoomName.focus();
        return;
    }
    if ([...roomName].length > 24) {
        createRoomFormError.textContent = '房间名称不能超过 24 个字符。';
        createRoomName.focus();
        return;
    }

    const gameOptions = {};
    // gameOptions.encryptorMode and future room options are all collected from
    // the same metadata definition used by the in-room editor.
    getRoomSettingDefinitions(activeCreateRoomGame).forEach(definition => {
        const value = formData.get(definition.key);
        if (value === null) return;
        gameOptions[definition.key] = definition.kind === 'toggle' ? formData.get(definition.key) === 'on' : value;
    });

    const seatLimitValue = formData.get('seatLimit');
    createRoomFormError.textContent = '';
    createRoom({
        gameType: activeCreateRoomGame.type,
        roomName,
        isPublic: formData.get('isPublic') !== 'false',
        ...(seatLimitValue ? { seatLimit: Number(seatLimitValue) } : {}),
        ...(Object.keys(gameOptions).length ? { gameOptions } : {}),
    });
}

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
    send({ type: 'reconnectRoom', roomId, playerId });
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
function createRoom(payload) { if (currentRoomId) return addLog('请先离开当前房间', 'error'); if (!isConnected || ws?.readyState !== WebSocket.OPEN) return addLog('未连接到服务器', 'error'); setCreateRoomRequestPending(true); send({ type: 'createRoom', ...payload }); addLog(`正在创建 ${payload.roomName || GAME_PRESENTATION[payload.gameType]?.title || payload.gameType}…`, 'system'); }
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
function send(payload) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); }
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
    if (!document.body.classList.contains('is-waiting-room-view')) return;
    if (waitingRoomResizeFrame) cancelAnimationFrame(waitingRoomResizeFrame);
    waitingRoomResizeFrame = requestAnimationFrame(() => { waitingRoomResizeFrame = null; renderWaitingRoomScene(); });
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
function applyGameFilter() {
    gamePickerEl?.querySelectorAll('[data-game-group]').forEach(group => {
        let visibleCount = 0;
        group.querySelectorAll('[data-game-type]').forEach(card => { const game = gameList.find(item => item.type === card.dataset.gameType); const visible = gameMatchesFilter(game); card.hidden = !visible; if (visible) visibleCount += 1; });
        group.hidden = visibleCount === 0;
    });
    refreshGameCardReveal();
}
gameFilterEl?.addEventListener('change', () => { selectedGameFilter = gameFilterEl.value; applyGameFilter(); });
document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-invite]'); if (!copy) return; const invite = document.getElementById('ipDisplay'); const text = invite?.dataset.inviteUrl || invite?.textContent || ''; if (!text || text.includes('先创建')) return addLog('请先创建或加入房间', 'error'); try { await navigator.clipboard.writeText(text); addLog('邀请链接已复制', 'system'); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制'; }, 1400); } catch { addLog('复制失败，请手动复制邀请链接', 'error'); } });
document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-player-id]'); if (!copy) return; if (!myId) return addLog('玩家 ID 尚未生成', 'error'); try { await navigator.clipboard.writeText(myId); showRoomFeedback(`玩家 ID ${myId} 已复制`, 'info'); } catch { addLog(`玩家 ID：${myId}`, 'system'); } });
document.addEventListener('click', event => { if (event.target.closest('[data-dismiss-fatal]')) document.getElementById('fatalErrorBox')?.style.setProperty('display', 'none'); });

function gameMatchesFilter(game) {
    if (!game || selectedGameFilter === 'all') return true;
    const min = Number(game.minPlayers || 0); const max = Number(game.maxPlayers || 0);
    if (selectedGameFilter === 'two') return min <= 2 && max >= 2;
    if (selectedGameFilter === 'small') return min <= 4 && max >= 2;
    if (selectedGameFilter === 'large') return max >= 5;
    return true;
}

const savedName = localStorage.getItem('jsgames.playerName');
if (savedName) myName = savedName;
nameInput.value = myName; entryNameInput.value = myName; updateProfileAvatar(); updateInviteLink();
if (pendingUrlRoom) { showJoinLobby({ focusCode: false }); joinLobbyCodeInput.value = pendingUrlRoom; }
connect();
