import { getGameDetails } from './game-details.js';

const statusEl = document.getElementById('status');
const onlineIndicatorEl = document.getElementById('onlineIndicator');
const logEl = document.getElementById('log');
const lobbyViewEl = document.getElementById('lobbyView');
const roomViewEl = document.getElementById('roomView');
const roomListEl = document.getElementById('roomList');
const roomMount = document.getElementById('roomMount');
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
    decrypto: { symbol: '⌁', title: '谍报风云', subtitle: '封存电报，在真实桌面上破译', english: 'DECRYPTO', players: '3–8 人', time: '30 分钟', tone: 'blue', description: '页面保管密钥与通信，双方在线下自由讨论、误导并破译频道。' },
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
let currentGameClient = null;
let preparingGameType = null;
let preparingGameClient = null;
let activeGameArtStyle = null;
let activeBggComponentDialog = null;
let activeCreateRoomGame = null;
let createRoomRequestPending = false;
let createRoomDialogReturnFocus = null;
let isConnected = false;
let gameList = [];
let selectedGameFilter = 'all';
const GROUP_PRESENTATION = {
    'social-assist': { name: '社交推理与流程辅助', description: '身份、沟通与自动流程' },
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
    xiangqi: '/assets/covers/xiangqi.webp',
    jungle: '/assets/covers/jungle.webp',
    junqi: '/assets/covers/junqi.webp',
    aeroplane: '/assets/covers/aeroplane.webp',
    gobang: '/assets/covers/gobang.webp',
    checkers: '/assets/covers/checkers-v2.webp',
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
let pendingUrlRoom = new URLSearchParams(location.search).get('room');

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
        updateProfileAvatar();
        send({ type: 'setName', name: myName });
        if (sessionToken) send({ type: 'resumeSession', sessionToken });
        else if (pendingUrlRoom) { send({ type: 'joinRoom', roomId: pendingUrlRoom }); pendingUrlRoom = null; }
    };
    ws.onmessage = async event => { try { await handleMessage(JSON.parse(event.data)); } catch (error) { console.error(error); addLog(`消息处理失败：${error.message}`, 'error'); } };
    ws.onclose = () => { isConnected = false; if (createRoomRequestPending) { setCreateRoomRequestPending(false); createRoomFormError.textContent = '连接已断开，房间尚未创建，请等待重连后重试。'; } setConnectionStatus('连接断开', 'is-disconnected'); addLog('连接已断开，正在重连...', 'error'); setTimeout(connect, 3000); };
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
            sessionToken = sessionToken || sessionStorage.getItem(sessionStorageKey) || '';
            if (data.room) { setCreateRoomRequestPending(false); closeCreateRoomDialog(true); setRoom(data); currentRoom = data.room; if (data.room.status === 'waiting') enterWaitingRoom(); }
            else if (currentRoomId) { currentRoomId = null; currentRoom = null; updateInviteLink(); returnToLobby(); }
            if (!data.room && pendingUrlRoom) { send({ type: 'joinRoom', roomId: pendingUrlRoom }); pendingUrlRoom = null; }
            addLog(data.room ? `已恢复房间 ${data.roomId}` : '会话已恢复', 'system');
            break;
        case 'resumeFailed':
            sessionStorage.removeItem(sessionStorageKey);
            sessionToken = '';
            addLog(data.message || '会话已过期', 'error');
            if (pendingUrlRoom) { send({ type: 'joinRoom', roomId: pendingUrlRoom }); pendingUrlRoom = null; }
            break;
        case 'gameList': renderGameList(data.games); break;
        case 'roomList': renderRoomList(data.rooms); break;
        case 'playerCount': playerCountEl.textContent = `在线 ${data.count}`; break;
        case 'roomCreated':
            setCreateRoomRequestPending(false);
            closeCreateRoomDialog(true);
            setRoom(data);
            addLog(`${data.room?.roomName || '房间'}（${data.roomId}）创建成功`, 'system');
            enterWaitingRoom();
            break;
        case 'joinSuccess': setRoom(data); addLog(`成功加入房间 ${data.roomId}`, 'system'); enterWaitingRoom(); break;
        case 'roomConfigured':
            currentRoom = data.room || currentRoom;
            pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || pendingRoomPlayerCount);
            pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || pendingEncryptorMode;
            updateInviteLink();
            renderWaitingRoomPanel();
            addLog(data.message || '房间人数已确认，现已公开', 'system');
            break;
        case 'playerJoined': currentRoom = data.room || currentRoom; addLog(`${data.player.name} 加入了房间`, 'info'); renderWaitingRoomPanel(); break;
        case 'playerLeft': currentRoom = data.room || currentRoom; addLog('有玩家离开了房间', 'info'); renderWaitingRoomPanel(); break;
        case 'playerRenamed': currentRoom = data.room || currentRoom; renderWaitingRoomPanel(); break;
        case 'playerReconnected': currentRoom = data.room || currentRoom; renderWaitingRoomPanel(); break;
        case 'chat': addLog(`${data.player.id === myId ? '我' : data.player.name}: ${data.message}`, 'chat'); break;
        case 'gameStarted': if (currentRoom) currentRoom.status = 'playing'; await showGameMessage(data); break;
        case 'gameState': case 'gameEnded': await showGameMessage(data); if (data.type === 'gameEnded' && data.winner) { const winnerNames = data.winner.winners?.map(winner => winner.name).join('、') || data.winner.name; addLog(`${winnerNames} 获胜`, 'system'); } break;
        case 'error':
            // Let the active game clear any pending-action lock and render the
            // authoritative state returned with a rejected action.
            if (createRoomRequestPending) {
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
function setRoom(data) { myId = data.playerId || myId; currentRoomId = data.roomId; currentRoom = data.room; const allowed = currentRoom?.allowedPlayerCounts || []; pendingRoomPlayerCount = Number(currentRoom?.targetPlayers || (allowed.includes(9) ? 9 : allowed[0]) || 9); pendingEncryptorMode = currentRoom?.gameOptions?.encryptorMode || 'rotation'; roomPageGame.textContent = currentRoom.roomName || currentRoom.gameName || currentRoom.gameType; roomPageCode.textContent = `${currentRoom.gameName || currentRoom.gameType} · 房间 ${currentRoom.id}`; updateInviteLink(); }
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
    return { ...presentation, art: presentation.art || GAME_COVERS[game.type] || BGG_ART[game.type] || null };
}
function renderGameCard(game, index) {
    const meta = getGamePresentation(game);
    const modeLabel = PLAY_MODE_LABELS[game.playMode] || '在线桌游';
    const artStyle = meta.art ? ` style="--card-art: url('${escapeHtml(meta.art)}')"` : '';
    return `<article class="game-card tone-${meta.tone} ${meta.art ? 'has-cover-art' : ''} ${index === 0 ? 'is-featured' : ''}" data-game-type="${escapeHtml(game.type)}" tabindex="0" role="button" aria-label="查看${escapeHtml(meta.title || game.name)}规则并创建房间"><div class="game-card-art"${artStyle} aria-hidden="true"><span class="art-orbit"></span><span class="game-symbol">${meta.symbol}</span><span class="game-card-index">${String(index + 1).padStart(2, '0')}</span><span class="game-art-label">${escapeHtml(meta.english)}</span></div><div class="game-card-body"><div class="game-card-title"><div><h3>${escapeHtml(meta.title || game.name)}</h3><p>${escapeHtml(meta.subtitle || meta.description)}</p></div><span class="game-card-arrow" aria-hidden="true">↗</span></div><div class="game-card-meta"><span>${escapeHtml(meta.players || `${game.minPlayers}–${game.maxPlayers} 人`)}</span><i></i><span>${escapeHtml(meta.time || '实时')}</span></div><span class="game-mode-badge mode-${escapeHtml(game.playMode || 'online')}">${escapeHtml(modeLabel)}</span></div></article>`;
}
function renderGameList(games) {
    gameList = [...(games || [])];
    if (!gameList.length) gameList = [{ type: 'loveletter', name: '情书', minPlayers: 2, maxPlayers: 4 }];
    gameList = gameList.map(game => ({ ...game, group: game.group || 'tabletop', groupName: game.groupName || GROUP_PRESENTATION[game.group || 'tabletop']?.name || '卡牌与策略桌游' })).sort((a, b) => (a.groupOrder || 99) - (b.groupOrder || 99) || (a.sortOrder || 999) - (b.sortOrder || 999) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
    gameTypeSelect.innerHTML = gameList.map(game => `<option value="${escapeHtml(game.type)}">${escapeHtml(game.name)}</option>`).join('');
    let cardIndex = 0;
    const groupedGames = gameList.reduce((groups, game) => { const key = game.group || 'tabletop'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(game); return groups; }, new Map());
    gamePickerEl.innerHTML = [...groupedGames.entries()].map(([groupId, groupGames]) => { const group = GROUP_PRESENTATION[groupId] || { name: groupGames[0]?.groupName || groupId, description: '' }; const cards = groupGames.map(game => renderGameCard(game, cardIndex++)).join(''); return `<section class="game-group" data-game-group="${escapeHtml(groupId)}"><header class="game-group-header"><div><span class="eyebrow">GAME COLLECTION</span><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p></div><span class="game-group-count">${groupGames.length} 款</span></header><div class="game-catalog">${cards}</div></section>`; }).join('');
    gamePickerEl.querySelectorAll('[data-game-type]').forEach(card => {
        card.addEventListener('click', event => {
            if (event.target.closest('a,button,input,select')) return;
            openCreateRoomDialog(card.dataset.gameType, card);
        });
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCreateRoomDialog(card.dataset.gameType, card); }
        });
    });
    gameCountEl.textContent = String(gameList.length);
    applyGameFilter();
    selectGame(gameTypeSelect.value || gameList[0].type, false);
}
function selectGame(type, announce = true) { if (!Array.from(gameTypeSelect.options).some(option => option.value === type)) return; gameTypeSelect.value = type; if (announce) addLog(`${GAME_PRESENTATION[type]?.title || type} 已选中`, 'system'); }
function renderRoomList(rooms) {
    roomCountLabel.textContent = `${rooms?.length || 0} 张桌`;
    if (!rooms || rooms.length === 0) { roomListEl.innerHTML = `<div class="empty-state"><span>○</span><p>还没有公开房间</p><small>创建一张桌，邀请朋友加入</small></div>`; return; }
    roomListEl.innerHTML = rooms.map(room => { const meta = GAME_PRESENTATION[room.gameType] || { symbol: '◇', tone: 'default' }; const canJoin = room.status !== 'playing' && room.status !== 'ended' && !isInRoom(room.id); return `<article class="room-item room-tone-${meta.tone}"><span class="room-mini-symbol">${meta.symbol}</span><div class="room-info"><strong>${escapeHtml(room.roomName || room.gameName || room.gameType)}</strong><span>${escapeHtml(room.gameName || room.gameType)} · ${escapeHtml(room.id)} · ${room.playerCount}/${room.maxPlayers} 人</span></div>${canJoin ? `<button class="join-button" data-room-id="${escapeHtml(room.id)}" type="button">加入 <span>→</span></button>` : `<span class="room-state">${isInRoom(room.id) ? '已加入' : roomStatusText(room.status)}</span>`}</article>`; }).join('');
}
function renderWaitingRoomPanel() {
    if (!currentRoom || !currentRoomId || currentRoom.status === 'playing') { currentRoomPanel.style.display = 'none'; return; }
    const players = currentRoom.players || [];
    const minPlayers = currentRoom.minPlayers || 2;
    const isHost = currentRoom.hostId === myId;
    const needsConfiguration = Boolean(currentRoom.configurationRequired && !currentRoom.configurationConfirmed);
    const targetPlayers = Number(currentRoom.targetPlayers || currentRoom.maxPlayers || minPlayers);
    const canStart = isHost && !needsConfiguration && currentRoom.status === 'waiting' && (currentRoom.targetPlayers ? players.length === targetPlayers : players.length >= minPlayers);
    const meta = GAME_PRESENTATION[currentRoom.gameType] || {};
    currentRoomPanel.style.display = 'block';
    const fixedPlayerCount = Boolean(currentRoom.targetPlayers);
    const playerProgress = fixedPlayerCount
        ? (players.length === targetPlayers ? '玩家已到齐' : `还差 ${Math.max(0, targetPlayers - players.length)} 人`)
        : (players.length >= minPlayers ? `已满足开局人数，还有 ${Math.max(0, targetPlayers - players.length)} 个空位` : `至少还需 ${Math.max(0, minPlayers - players.length)} 人`);
    const roomSummary = needsConfiguration ? '待房主确认设置 · 房间尚未公开' : `${roomStatusText(currentRoom.status)} · ${players.length}/${targetPlayers} 人，${playerProgress}`;
    currentRoomInfo.innerHTML = `<div class="waiting-game-mark tone-${meta.tone || 'default'}">${meta.symbol || '◇'}</div><div><strong>${escapeHtml(currentRoom.roomName || currentRoom.gameName || currentRoom.gameType)}</strong><span>${escapeHtml(currentRoom.gameName || currentRoom.gameType)} · 房间 ${escapeHtml(currentRoom.id)}${currentRoom.isPublic === false ? ' · 仅邀请' : ''}</span></div><small>${roomSummary}</small>`;
    const modeOptions = [{ value: 'fixed_vote', title: '固定投票', copy: '各队开局投票，选出本局固定加密员' }, { value: 'rotation', title: '轮流', copy: '队员按座位依次担任加密员' }, { value: 'random', title: '每轮随机', copy: '每轮重新抽选，同一人不会连续两轮' }];
    const isEncryptorSetup = needsConfiguration && (currentRoom.allowedEncryptorModes || []).length > 0;
    const configuration = needsConfiguration ? (isEncryptorSetup ? `<section class="room-configuration room-mode-configuration"><small>ROOM SETUP</small><strong>选择加密员产生方式</strong><p>确认后房间才会公开，本局不可修改。</p><div>${modeOptions.filter(option => currentRoom.allowedEncryptorModes.includes(option.value)).map(option => `<button class="room-count-option room-mode-option ${option.value === pendingEncryptorMode ? 'is-selected' : ''}" data-encryptor-mode="${option.value}" type="button" ${isHost ? '' : 'disabled'}><b>${option.title}</b><span>${option.copy}</span></button>`).join('')}</div>${isHost ? '<button class="room-config-confirm" data-confirm-room-configuration type="button">确认规则并公开房间 <span>→</span></button>' : '<em>等待房主确认…</em>'}</section>` : `<section class="room-configuration"><small>ROOM SETUP</small><strong>确定本局人数</strong><p>确认后房间才会出现在公开列表，人数将不可修改。</p><div>${(currentRoom.allowedPlayerCounts || [9, 12]).map(count => `<button class="room-count-option ${Number(count) === pendingRoomPlayerCount ? 'is-selected' : ''}" data-room-player-count="${count}" type="button" ${isHost ? '' : 'disabled'}><b>${count}</b><span>人局</span></button>`).join('')}</div>${isHost ? '<button class="room-config-confirm" data-confirm-room-configuration type="button">确认人数并公开房间 <span>→</span></button>' : '<em>等待房主确认…</em>'}</section>`) : '';
    currentRoomPlayers.innerHTML = configuration + players.map((player, index) => `<div class="waiting-player ${player.id === currentRoom.hostId ? 'is-host' : ''}"><span class="waiting-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span><strong>${escapeHtml(player.name)}${player.id === myId ? ' · 我' : ''}</strong><small>${player.id === currentRoom.hostId ? '房主' : '已入座'}</small></span><b>${String(index + 1).padStart(2, '0')}</b></div>`).join('');
    const showStart = isHost && !needsConfiguration;
    [lobbyStartGameBtn, startGameBtn].forEach(button => {
        button.style.display = showStart ? 'inline-flex' : 'none';
        button.disabled = !canStart;
        button.innerHTML = canStart ? '开始游戏 <span>→</span>' : `至少还需 ${Math.max(0, (fixedPlayerCount ? targetPlayers : minPlayers) - players.length)} 人入座`;
    });
    document.querySelector('.catalog-column')?.classList.toggle('is-muted', Boolean(currentRoomId));
}
function enterWaitingRoom() { document.body.classList.remove('is-game-view'); lobbyViewEl.style.display = 'grid'; roomViewEl.style.display = 'none'; roomMount.innerHTML = ''; destroyGameClient(); renderWaitingRoomPanel(); }
function openGameView() { document.body.classList.add('is-game-view'); lobbyViewEl.style.display = 'none'; roomViewEl.style.display = 'block'; currentRoomPanel.style.display = 'none'; roomMount.innerHTML = ''; gameMount.style.display = 'block'; startGameBtn.style.display = 'none'; }
function returnToLobby() { document.body.classList.remove('is-game-view'); lobbyViewEl.style.display = 'grid'; roomViewEl.style.display = 'none'; roomMount.innerHTML = ''; destroyGameClient(); currentRoomPanel.style.display = 'none'; document.querySelector('.catalog-column')?.classList.remove('is-muted'); }
async function showGameMessage(data) { const type = data.gameType || currentRoom?.gameType; try { openGameView(); await prepareGameClient(type); currentGameClient?.handleMessage(data); } catch (error) { addLog(`游戏界面加载失败：${error.message}`, 'error'); returnToLobby(); currentRoomPanel.style.display = 'block'; currentRoomInfo.insertAdjacentHTML('beforeend', `<div class="load-error">${escapeHtml(error.message)}</div>`); } }
async function prepareGameClient(gameType) {
    if (!gameType) throw new Error('缺少游戏类型');
    if (currentGameClient?.gameType === gameType) return;
    if (preparingGameClient && preparingGameType === gameType) return preparingGameClient;
    preparingGameType = gameType;
    preparingGameClient = (async () => {
        destroyGameClient();
        const clientPath = gameType === 'chess' ? '/games/chess/lobby-client.js' : `/games/${gameType}/client.js`;
        const module = await import(`${clientPath}?v=${Date.now()}`);
        if (typeof module.createGameClient !== 'function') throw new Error(`${gameType} 没有导出 createGameClient`);
        currentGameClient = module.createGameClient({ mount: gameMount, send, addLog, leaveRoom });
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
function destroyGameClient() { currentGameClient?.destroy?.(); currentGameClient = null; activeGameArtStyle?.remove(); activeGameArtStyle = null; activeBggComponentDialog?.remove(); activeBggComponentDialog = null; gameMount.removeAttribute('data-bgg-art'); gameMount.removeAttribute('data-bgg-component'); gameMount.style.removeProperty('--bgg-background-art'); gameMount.style.removeProperty('--bgg-detail-art'); gameMount.innerHTML = ''; }

function defaultRoomName(gameTitle) {
    const hostName = (nameInput?.value || myName || '房主').trim() || '房主';
    return [...`${hostName}的${gameTitle}房间`].slice(0, 24).join('');
}

function choiceMarkup(name, options, selectedValue) {
    return options.map(option => `<label><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${String(option.value) === String(selectedValue) ? 'checked' : ''} required><span><b>${escapeHtml(option.title)}</b>${option.copy ? `<small>${escapeHtml(option.copy)}</small>` : ''}</span></label>`).join('');
}

function renderCreateRoomSettings(game) {
    const meta = getGamePresentation(game);
    createRoomForm?.reset();
    createRoomName.value = defaultRoomName(meta.title || game.name);
    createRoomForm.querySelector('input[name="isPublic"][value="true"]').checked = true;
    createRoomFormError.textContent = '';

    const isFixedCountGame = Number(game.minPlayers) === Number(game.maxPlayers);
    const usesSpecialPlayerCount = game.type === 'werewolf';
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

    if (game.type === 'werewolf') {
        createRoomSpecialSettings.innerHTML = `
            <fieldset class="room-setting-field"><legend class="room-special-heading"><span>狼人杀规则</span><em>SPECIAL RULES</em></legend><div class="room-setting-options">${choiceMarkup('playerCount', [
                { value: 9, title: '9 人局', copy: '3 狼 · 4 神 · 2 民' },
                { value: 12, title: '12 人局', copy: '4 狼 · 4 神 · 4 民' },
            ], 9)}</div><small>这是固定开局人数，必须全部到齐才能开始。</small></fieldset>
            <div class="room-setting-field room-toggle-row"><div class="room-toggle-copy"><b>启用警长流程</b><small>包含上警、竞选发言、投票、PK 与警徽移交。</small></div><label class="room-switch"><input type="checkbox" name="sheriffEnabled" checked><span aria-hidden="true"></span></label></div>
            <fieldset class="room-setting-field"><legend>狼人胜利条件</legend><div class="room-setting-options">${choiceMarkup('winCondition', [
                { value: 'edge', title: '屠边', copy: '村民或神职任一方全部出局时狼人获胜。' },
                { value: 'parity', title: '人数追平', copy: '存活狼人数不少于存活好人数时狼人获胜。' },
            ], 'edge')}</div></fieldset>`;
    } else if (game.type === 'decrypto') {
        createRoomSpecialSettings.innerHTML = `
            <fieldset class="room-setting-field"><legend class="room-special-heading"><span>加密员产生方式</span><em>SPECIAL RULES</em></legend><div class="room-setting-options">${choiceMarkup('encryptorMode', [
                { value: 'fixed_vote', title: '固定投票', copy: '各队开局秘密投票，选出整局固定加密员。' },
                { value: 'rotation', title: '轮流担任', copy: '队员按照座位顺序依次担任加密员。' },
                { value: 'random', title: '每轮随机', copy: '每轮重新抽选，避免同一人连续担任。' },
            ], 'rotation')}</div></fieldset>`;
    } else {
        createRoomSpecialSettings.innerHTML = '';
    }
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
    if (meta.art) createRoomRuleHero.style.setProperty('--dialog-art', `url("${meta.art}")`);
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
    if (activeCreateRoomGame.type === 'werewolf') {
        gameOptions.playerCount = Number(formData.get('playerCount'));
        gameOptions.sheriffEnabled = formData.get('sheriffEnabled') === 'on';
        gameOptions.winCondition = formData.get('winCondition') === 'parity' ? 'parity' : 'edge';
    } else if (activeCreateRoomGame.type === 'decrypto') {
        gameOptions.encryptorMode = String(formData.get('encryptorMode') || 'rotation');
    }

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
function leaveRoom() { if (!currentRoomId) return; send({ type: 'leaveRoom' }); currentRoomId = null; currentRoom = null; pendingRoomPlayerCount = 9; pendingEncryptorMode = 'rotation'; updateInviteLink(); returnToLobby(); addLog('已离开房间', 'system'); }
function createRoom(payload) { if (currentRoomId) return addLog('请先离开当前房间', 'error'); if (!isConnected || ws?.readyState !== WebSocket.OPEN) return addLog('未连接到服务器', 'error'); setCreateRoomRequestPending(true); send({ type: 'createRoom', ...payload }); addLog(`正在创建 ${payload.roomName || GAME_PRESENTATION[payload.gameType]?.title || payload.gameType}…`, 'system'); }
function startGame() { if (!currentRoomId || !currentRoom) return; const target = Number(currentRoom.targetPlayers || 0); const count = currentRoom.players?.length || 0; if (currentRoom.configurationRequired && !currentRoom.configurationConfirmed) return addLog('请先确认房间设置', 'error'); if (target && count !== target) return addLog(`需要 ${target} 名玩家全部到齐（当前 ${count}/${target}）`, 'error'); send({ type: 'startGame' }); }
function sendChat() { const message = chatInput.value.trim(); if (!message) return; if (!isConnected) return addLog('未连接到服务器', 'error'); send({ type: 'chat', message }); chatInput.value = ''; }
function setName() { const name = nameInput.value.trim(); if (!name) return; myName = name; localStorage.setItem('jsgames.playerName', name); updateProfileAvatar(); if (isConnected) send({ type: 'setName', name }); addLog(`已改名为 ${name}`, 'system'); }
function send(payload) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); }
function addLog(message, type = 'chat') { const placeholder = logEl.querySelector('.log-placeholder'); placeholder?.remove(); const div = document.createElement('div'); div.className = `log-entry log-${type}`; div.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${escapeHtml(message)}</span>`; logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight; }
function updateProfileAvatar() { profileAvatar.textContent = (nameInput.value || myName || '玩').slice(0, 1); }
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
}
function isInRoom(roomId) { return currentRoomId === roomId; }
function roomStatusText(status) { return status === 'playing' ? '游戏中' : status === 'ended' ? '已结束' : '等待中'; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

leaveRoomBtn?.addEventListener('click', leaveRoom); startGameBtn?.addEventListener('click', startGame); lobbyStartGameBtn?.addEventListener('click', startGame); lobbyLeaveRoomBtn?.addEventListener('click', leaveRoom); sendChatBtn?.addEventListener('click', sendChat); setNameBtn?.addEventListener('click', setName); joinCodeBtn?.addEventListener('click', joinByCode); roomCodeInput?.addEventListener('keydown', event => { if (event.key === 'Enter') joinByCode(); }); roomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (button) joinRoom(button.dataset.roomId); }); chatInput?.addEventListener('keydown', event => { if (event.key === 'Enter') sendChat(); }); nameInput?.addEventListener('keydown', event => { if (event.key === 'Enter') setName(); }); nameInput?.addEventListener('input', updateProfileAvatar);
createRoomNextBtn?.addEventListener('click', showCreateRoomSettings);
createRoomBackBtn?.addEventListener('click', showCreateRoomRules);
createRoomCancelBtn?.addEventListener('click', () => closeCreateRoomDialog());
createRoomDialogClose?.addEventListener('click', () => closeCreateRoomDialog());
createRoomForm?.addEventListener('submit', submitCreateRoom);
createRoomDialog?.addEventListener('click', event => { if (event.target === createRoomDialog) closeCreateRoomDialog(); });
document.addEventListener('keydown', event => {
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
}
gameFilterEl?.addEventListener('change', () => { selectedGameFilter = gameFilterEl.value; applyGameFilter(); });
document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-invite]'); if (!copy) return; const invite = document.getElementById('ipDisplay'); const text = invite?.dataset.inviteUrl || invite?.textContent || ''; if (!text || text.includes('先创建')) return addLog('请先创建或加入房间', 'error'); try { await navigator.clipboard.writeText(text); addLog('邀请链接已复制', 'system'); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制'; }, 1400); } catch { addLog('复制失败，请手动复制邀请链接', 'error'); } });
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
nameInput.value = myName; updateProfileAvatar(); updateInviteLink(); connect();
