'use strict';

const {
    assert,
    test,
    fs,
    Room,
    LoveLetter,
    LoveLetterEngine,
    Coup,
    Chess,
    Xiangqi,
    Jungle,
    Gobang,
    Checkers,
    Monopoly,
    MonopolyDeal,
    MonopolyDealEngine,
    GuessNumber,
    Aeroplane,
    Junqi,
    TakeFive,
    TakeFiveEngine,
    Splendor,
    SplendorEngine,
    Hanabi,
    HanabiEngine,
    Kingdomino,
    KingdominoEngine,
    Acquire,
    AcquireEngine,
    Citadels,
    CitadelsEngine,
    Witchtown,
    WitchtownEngine,
    LasVegas,
    LasVegasEngine,
    Avalon,
    AvalonEngine,
    Scout,
    ScoutEngine,
    Decrypto,
    DecryptoEngine,
    Manila,
    ManilaEngine,
    ModernArt,
    ModernArtEngine,
    CamelUp,
    CamelUpEngine,
    MagicalAthlete,
    MagicalAthleteEngine,
    Werewolf,
    WerewolfEngine,
    registry,
    GROUP_DEFINITIONS,
    GAME_GROUPS,
    players,
    readFrontendSource,
    readWitchtownClient,
    confirmAvalonRoles,
    confirmDecryptoKeys,
    confirmWitchtownDossiers,
    passWitchtownConfessions,
    confirmedWerewolfNightAction,
    chessEngine,
    maAthlete,
    maDraft,
    maRaceSelect,
    maResolvePrompts,
    maAutoPlay
} = require("../support/regression.helper");

function readGameStyles(game) {
    const splitStyles = {
        acquire: ['style.css', 'board.css', 'rail.css', 'scenes.css'],
        avalon: ['style.css', 'scenes.css'],
        citadels: ['style.css', 'roles.css', 'interactions.css', 'responsive.css', 'scenes.css'],
        coup: ['style.css', 'private.css', 'scenes.css', 'responsive.css'],
        hanabi: ['style.css', 'table.css', 'actions.css', 'responsive.css', 'scenes.css', 'responsive-scenes.css'],
        lasvegas: ['style.css', 'board.css', 'responsive.css', 'scenes.css'],
        monopolydeal: ['style.css', 'choice.css', 'assets.css', 'interactions.css', 'scenes.css', 'responsive-scenes.css', 'responsive.css', 'table.css', 'records.css', 'stage.css', 'seats.css'],
        splendor: ['style.css', 'table.css', 'scenes.css', 'responsive.css'],
        witchtown: ['style.css', 'table.css', 'dossier.css', 'scenes.css', 'responsive.css'],
    };
    const files = (splitStyles[game] || ['style.css']).map(file => `public/games/${game}/${file}`);
    return files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

function readLobbyStyles() {
    return ['public/style.css', 'public/lobby/game-shell.css', 'public/lobby/utilities.css', 'public/lobby/responsive.css', 'public/lobby/waiting-room.css', 'public/lobby/room-info.css']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

test('lobby registry exposes every in-scope game and new presentation target', () => {
    const ids = new Set(registry.listGames().map(game => game.type));
    for (const id of ['loveletter', 'coup', 'guessnumber', 'monopoly', 'monopolydeal', 'aeroplane', 'gobang', 'checkers', 'takefive', 'hanabi', 'splendor', 'kingdomino', 'acquire', 'citadels', 'witchtown', 'lasvegas', 'avalon', 'scout', 'decrypto', 'manila', 'modernart', 'camelup', 'magicalathlete', 'werewolf']) assert.equal(ids.has(id), true, `${id} 未注册`);
});

test('BGG assets are used according to each game component type', () => {
    const readGameClient = readFrontendSource;
    const acquireClient = readGameClient('acquire');
    const citadelsClient = readGameClient('citadels');
    const lasVegasClient = readGameClient('lasvegas');
    const avalonClient = readGameClient('avalon');
    const scoutClient = readGameClient('scout');
    const decryptoClient = readGameClient('decrypto');
    const manilaClient = readGameClient('manila');
    const modernArtClient = readGameClient('modernart');
    const camelUpClient = readGameClient('camelup');
    const magicalAthleteClient = readGameClient('magicalathlete');
    assert.equal(fs.existsSync('public/assets/bgg/citadels/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/lasvegas/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/avalon/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/scout/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/decrypto/detail.png'), true);
    assert.equal(fs.existsSync('public/assets/bgg/manila/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/modernart/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/camelup/detail.jpg'), true);
    assert.equal(fs.existsSync('public/assets/bgg/magicalathlete/detail.png'), true);
    assert.doesNotMatch(acquireClient, /acquire\/detail\.jpg/, '并购不应继续混用 2008 版组件照');
    assert.match(acquireClient, /acquire-component-guide/);
    assert.match(acquireClient, /acquire-hq/);
    assert.match(citadelsClient, /citadels\/detail\.jpg/);
    assert.match(lasVegasClient, /lasvegas\/detail\.jpg/);
    assert.match(avalonClient, /avalon\/detail\.jpg/);
    assert.match(scoutClient, /scout\/detail\.jpg/);
    assert.match(decryptoClient, /decrypto\/detail\.png/);
    assert.match(manilaClient, /manila\/detail\.jpg/);
    assert.match(modernArtClient, /modernart\/detail\.jpg/);
    assert.match(camelUpClient, /camelup\/detail\.jpg/);
    assert.match(magicalAthleteClient, /magicalathlete\/detail\.png/);
    assert.match(citadelsClient, /role-art-\$\{meta\.rank\}/);
});

test('lobby registry classifies every registered game into one primary group', () => {
    const games = registry.listGames();
    const lobbyClient = ['public/script.js', 'public/lobby/catalog-data.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.equal(games.length, 28, '服务器应注册 28 个联机项目');
    assert.deepEqual(Object.values(GROUP_DEFINITIONS).map(({ id, name, order }) => ({ id, name, order })), [
        { id: 'social-assist', name: '社交推理', order: 1 },
        { id: 'codebreaking', name: '解谜与破译', order: 2 },
        { id: 'board', name: '棋盘对弈', order: 3 },
        { id: 'tabletop', name: '卡牌与策略', order: 4 },
    ]);
    assert.deepEqual(games.reduce((counts, game) => { counts[game.group] = (counts[game.group] || 0) + 1; return counts; }, {}), { 'social-assist': 3, codebreaking: 2, board: 8, tabletop: 15 });
    for (const game of games) {
        assert.ok(game.groupName, `${game.type} 缺少分组名称`);
        assert.ok(game.groupOrder >= 1, `${game.type} 缺少分组排序`);
        assert.ok(game.sortOrder >= 1, `${game.type} 缺少组内排序`);
        assert.ok(['online', 'hybrid', 'host-assist', 'auto-assist', 'solo'].includes(game.playMode), `${game.type} 使用了未知游戏模式`);
    }
    assert.deepEqual(GAME_GROUPS.werewolf, { group: 'social-assist', playMode: 'auto-assist', sortOrder: 1 });
    assert.deepEqual(GAME_GROUPS.decrypto, { group: 'codebreaking', playMode: 'online', sortOrder: 1 });
    assert.deepEqual(GAME_GROUPS.guessnumber, { group: 'codebreaking', playMode: 'solo', sortOrder: 2 });
    assert.match(lobbyClient, /codebreaking: \{ name: '解谜与破译', description: '密码、线索与逻辑推理' \}/);
});

test('registry-backed games can start and expose player state', () => {
    for (const [module, ids] of [[LoveLetter, ['a', 'b']], [Coup, ['a', 'b']], [Chess, ['a', 'b']], [Xiangqi, ['a', 'b']], [Jungle, ['a', 'b']], [Gobang, ['a', 'b']], [Checkers, ['a', 'b']], [Monopoly, ['a', 'b']], [MonopolyDeal, ['a', 'b']], [Aeroplane, ['a', 'b']], [Junqi, ['a', 'b']], [TakeFive, ['a', 'b']], [Splendor, ['a', 'b']], [Hanabi, ['a', 'b']], [Kingdomino, ['a', 'b']], [Acquire, ['a', 'b']], [Citadels, ['a', 'b']], [Witchtown, ['a', 'b', 'c', 'd']], [GuessNumber, ['a']], [LasVegas, ['a', 'b']], [Avalon, ['a', 'b', 'c', 'd', 'e']], [Scout, ['a', 'b', 'c']], [Decrypto, ['a', 'b', 'c', 'd']], [Manila, ['a', 'b', 'c']], [ModernArt, ['a', 'b', 'c']], [CamelUp, ['a', 'b', 'c']], [MagicalAthlete, ['a', 'b']], [Werewolf, ['a']]]) {
        const session = module.create('room', players(ids));
        assert.equal(session.start().success, true);
        assert.equal(session.getPlayerState(ids[0]).myId, ids[0]);
    }
});

test('Room creation accepts validated common properties and hides invite-only rooms from the public list', () => {
    const room = new Room('named-room', 'host', '阿明', 'loveletter', {}, {
        roomName: '  周末 情书局  ',
        isPublic: false,
        seatLimit: 3,
    });
    const info = room.getInfo();
    assert.equal(info.roomName, '周末 情书局');
    assert.equal(info.isPublic, false);
    assert.equal(info.minPlayers, 2);
    assert.equal(info.maxPlayers, 3);
    assert.equal(info.configurationConfirmed, true);
    assert.equal(room.isListed(), false);

    assert.throws(() => new Room('too-small', 'host', '房主', 'loveletter', {}, { seatLimit: 1 }), /人数上限/);
    assert.throws(() => new Room('too-large', 'host', '房主', 'loveletter', {}, { seatLimit: 5 }), /人数上限/);
    assert.throws(() => new Room('long-name', 'host', '房主', 'loveletter', {}, { roomName: '这是一段明显超过二十四个字符限制而且不应该被服务端接受的房间名称' }), /24 个字符/);
});

test('Waiting rooms keep server-assigned seats stable and reuse a vacated seat', () => {
    const room = new Room('stable-seats', 'host', '房主', 'loveletter');
    assert.equal(room.addPlayer({ id: 'host', name: '房主' }).seatIndex, 0);
    assert.equal(room.addPlayer({ id: 'guest-a', name: '甲' }).seatIndex, 1);
    assert.equal(room.addPlayer({ id: 'guest-b', name: '乙' }).seatIndex, 2);
    assert.deepEqual(room.getPlayerInfo().map(player => player.seatIndex), [0, 1, 2]);

    room.removePlayer('guest-a');
    assert.equal(room.addPlayer({ id: 'guest-c', name: '丙' }).seatIndex, 1);
    assert.deepEqual(room.getPlayerInfo().map(player => [player.id, player.seatIndex]), [
        ['host', 0],
        ['guest-c', 1],
        ['guest-b', 2],
    ]);
});

test('Waiting rooms expose authoritative readiness and shared in-room settings', () => {
    const room = new Room('ready-settings', 'host', '房主', 'loveletter', {}, { readyCheckEnabled: true });
    room.addPlayer({ id: 'host', name: '房主' });
    room.addPlayer({ id: 'guest', name: '成员' });
    assert.deepEqual(room.getInfo().players.map(player => [player.id, player.ready]), [['host', true], ['guest', true]]);
    assert.equal(room.setPlayerReady('host', false).success, false);
    assert.equal(room.setPlayerReady('guest', false).readyCount, 0);
    assert.match(room.startGame().message, /所有成员准备/);
    assert.equal(room.setPlayerReady('guest', true).readyCount, 1);
    assert.equal(room.startGame().success, true);

    const werewolf = new Room('shared-settings', 'host', '房主', 'werewolf', {
        playerCount: 9,
        sheriffEnabled: true,
        winCondition: 'edge',
    }, { readyCheckEnabled: true });
    const info = werewolf.getInfo();
    assert.deepEqual(info.roomSettings.map(setting => setting.key), ['playerCount', 'sheriffEnabled', 'winCondition', 'witchSelfSave']);
    assert.equal(werewolf.updateSettings('guest', { winCondition: 'parity' }).success, false);
    assert.equal(werewolf.updateSettings('host', { sheriffEnabled: false, winCondition: 'parity', witchSelfSave: 'never' }).success, true);
    assert.equal(werewolf.getInfo().gameOptions.sheriffEnabled, false);
    assert.equal(werewolf.getInfo().gameOptions.winCondition, 'parity');
    assert.equal(werewolf.getInfo().gameOptions.witchSelfSave, 'never');
});

test('Special games can be fully configured before the room is published', () => {
    const werewolf = new Room('werewolf-ready', 'host', '房主', 'werewolf', {
        playerCount: 12,
        sheriffEnabled: false,
        winCondition: 'parity',
    }, { roomName: '十二人月夜', isPublic: true });
    assert.equal(werewolf.configurationConfirmed, true);
    assert.equal(werewolf.targetPlayers, 12);
    assert.equal(werewolf.isListed(), true);
    assert.deepEqual(werewolf.getInfo().gameOptions, { playerCount: 12, sheriffEnabled: false, winCondition: 'parity' });

    const decrypto = new Room('decrypto-ready', 'host', '房主', 'decrypto', {
        encryptorMode: 'random',
    }, { roomName: '随机电报局', seatLimit: 6 });
    assert.equal(decrypto.configurationConfirmed, true);
    assert.equal(decrypto.maxPlayers, 6);
    assert.equal(decrypto.getInfo().gameOptions.encryptorMode, 'random');
    assert.equal(decrypto.isListed(), true);
});

test('Waiting room exposes host moderation, member readiness, and metadata-driven settings', () => {
    const appServer = ['app.js', 'server/realtime/create-realtime-server.js', 'server/realtime/room-handlers.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const room = fs.readFileSync('server/room.js', 'utf8');
    const lobby = ['public/script.js', 'public/lobby/catalog-data.js', 'public/lobby/catalog-view.js', 'public/lobby/artwork.js', 'public/lobby/room-dialog.js', 'public/lobby/waiting-room-scene.js', 'public/lobby/event-bindings.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const werewolf = fs.readFileSync('server/games/werewolf/index.js', 'utf8');
    const decrypto = fs.readFileSync('server/games/decrypto/index.js', 'utf8');
    assert.match(appServer, /case 'kickPlayer'/);
    assert.match(appServer, /case 'setReady'/);
    assert.match(appServer, /case 'updateRoomSettings'/);
    assert.match(appServer, /只有房主可以移出玩家/);
    assert.match(room, /setPlayerReady/);
    assert.match(room, /updateSettings/);
    assert.match(room, /readyCheckEnabled/);
    assert.match(lobby, /data-kick-player/);
    assert.match(lobby, /data-toggle-ready/);
    assert.match(lobby, /data-save-room-settings/);
    assert.match(lobby, /is-not-ready/);
    assert.match(lobby, /const becameReady = Boolean/);
    assert.match(lobby, /playerChanged \|\| becameReady/);
    assert.match(lobby, /等待其他玩家准备/);
    assert.match(room, /player\.id === this\.hostId\) return \{ success: false, message: '房主无需准备'/);
    assert.match(lobby, /function renderSharedRoomSettings/);
    assert.match(lobby, /type: 'updateRoomSettings'/);
    assert.match(werewolf, /roomSettings/);
    assert.match(decrypto, /roomSettings/);
});

test('Lobby uses a two-step rule and settings dialog before sending room creation', () => {
    const appServer = ['app.js', 'server/realtime/create-realtime-server.js', 'server/realtime/room-handlers.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const lobby = ['public/script.js', 'public/lobby/catalog-view.js', 'public/lobby/room-dialog.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const details = fs.readFileSync('public/game-details.js', 'utf8');
    assert.match(lobby, /openCreateRoomDialog\(card\.dataset\.gameType/);
    assert.match(lobby, /function showCreateRoomSettings/);
    assert.match(lobby, /function submitCreateRoom/);
    assert.match(lobby, /roomName,/);
    assert.match(lobby, /gameOptions[\s\S]*encryptorMode/);
    assert.match(page, /id="createRoomRuleList"/);
    assert.match(page, /id="createRoomSpecialSettings"/);
    assert.match(details, /export const GAME_DETAILS/);
    assert.match(appServer, /roomName: data\.roomName/);
    assert.match(appServer, /seatLimit: data\.seatLimit/);
});

test('Lobby enters a themed pregame room, preloads one game, and exposes mobile open tables', () => {
    const lobby = ['public/script.js', 'public/lobby/catalog-data.js', 'public/lobby/catalog-view.js', 'public/lobby/artwork.js', 'public/lobby/room-dialog.js', 'public/lobby/waiting-room-scene.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const loader = fs.readFileSync('public/lobby/game-loader.js', 'utf8');
    const catalog = fs.readFileSync('public/lobby/catalog-data.js', 'utf8');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = readLobbyStyles();
    const serviceTemplate = fs.readFileSync('deploy/jsgames.service.example', 'utf8');
    const nginxTemplate = fs.readFileSync('deploy/nginx-jsgames.conf.example', 'utf8');
    const deployGuide = fs.readFileSync('deploy/README.md', 'utf8');
    assert.match(lobby, /is-waiting-room-view/);
    assert.match(lobby, /data-seat-index/);
    assert.match(lobby, /data-start-game/);
    assert.match(lobby, /function waitingRoomMagicMarkup/);
    assert.match(lobby, /function waitingRoomStartGuidanceMarkup/);
    assert.match(lobby, /function handleWaitingStartAction/);
    assert.match(lobby, /aria-disabled=/, '人数不足的魔法阵应保留点击反馈能力');
    assert.doesNotMatch(lobby, /pregame-table-mark/, '等待房间中心不应再插入游戏图标');
    assert.match(page, /id="roomFeedback"[^>]*role="status"/, '人数不足应使用站内状态浮窗');
    assert.match(lobby, /等待房主开始游戏/);
    assert.match(lobby, /未达到开始游戏所需人数/);
    assert.match(lobby, /所有成员已准备/);
    assert.doesNotMatch(lobby, /魔法阵已充能/);
    assert.match(loader, /function preload\(/);
    assert.match(loader, /modulePromises/);
    assert.match(lobby, /function refreshLazyCoverArt/);
    assert.match(lobby, /function loadCoverArt/);
    assert.match(lobby, /function refreshGameCardReveal/);
    assert.match(lobby, /is-reveal-pending/);
    assert.match(lobby, /is-art-ready/);
    assert.match(lobby, /IntersectionObserver/);
    assert.match(lobby, /data-card-art/);
    assert.match(lobby, /GAME_COVER_THUMBS/);
    assert.match(lobby, /rootMargin: '560px 0px'/);
    assert.match(lobby, /rootMargin: '0px 0px -24px 0px'/);
    assert.doesNotMatch(lobby, /function startLobbyEntrance/);
    assert.doesNotMatch(lobby, /style="--card-art/);
    assert.match(lobby, /ASSET_VERSION/);
    assert.doesNotMatch(lobby, /import\([^\n]*Date\.now/);
    assert.match(page, /id="openMobileRoomsBtn"/);
    assert.match(page, /id="mobileRoomsDrawer"/);
    assert.match(styles, /\.pregame-magic-svg/);
    assert.match(styles, /\.pregame-magic-control\.is-ready/);
    assert.match(lobby, /preserveAspectRatio="none"/, '魔法阵应按圆桌椭圆比例投影');
    assert.match(lobby, /M110 29 L181 153 L39 153 Z/);
    assert.match(lobby, /M110 191 L39 67 L181 67 Z/);
    assert.doesNotMatch(lobby, /pregame-magic-core/, '六芒星中心不应再显示白色核心点');
    assert.match(styles, /\.pregame-magic-trigger,[\s\S]*?width: 70%; height: 70%/, '魔法阵应占圆桌宽高的七成');
    assert.match(styles, /\.pregame-table-action \{ position: absolute;[^}]*inset: 0;/, '魔法阵交互层应与圆桌同中心');
    assert.doesNotMatch(styles, /perspective\(620px\) rotateX\(63deg\)/, '魔法阵不应再使用独立于圆桌的投影');
    assert.match(styles, /\.pregame-start-guidance[^}]*margin: -27px auto 7px[^}]*padding: 0[^}]*font: 500 12px[^}]*text-align: right/, '开局提示应与右下角房间操作的右边缘对齐');
    assert.match(styles, /\.pregame-start-guidance\.has-player-count[^}]*text-shadow:/, '达到开局人数后提示文字应发光');
    assert.match(styles, /\.pregame-start-guidance\.is-ready\.has-player-count[^}]*text-shadow:/, '房主可开局提示应使用更强的发光');
    assert.doesNotMatch(styles, /\.pregame-magic-status/, '魔法阵右侧不应重复显示人数状态');
    assert.match(styles, /\.room-feedback/);
    assert.doesNotMatch(styles, /\.pregame-start\s*\{/, '等待房间不应保留旧的方框开始按钮');
    assert.match(styles, /\.game-card\.has-cover-art \.game-card-art[^}]*var\(--card-art,/);
    assert.match(styles, /@keyframes entryBackgroundIn/);
    assert.match(styles, /@keyframes entryForegroundIn/);
    assert.match(styles, /@keyframes entryRouteIn/);
    assert.match(styles, /@keyframes gameCardReveal/);
    assert.doesNotMatch(styles, /body\.is-lobby-entering \.join-lobby/);
    assert.match(styles, /@keyframes coverArtReveal/);
    assert.match(styles, /@keyframes coverArtShimmer/);
    assert.match(serviceTemplate, /Restart=on-failure/);
    assert.match(serviceTemplate, /Environment=PORT=3000/);
    assert.match(nginxTemplate, /proxy_set_header Upgrade \$http_upgrade/);
    assert.match(nginxTemplate, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
    assert.match(deployGuide, /systemd/);
    assert.match(deployGuide, /WebSocket/);
    const coverBlock = catalog.match(/const GAME_COVERS = \{([\s\S]*?)\n\};/)?.[1] || '';
    const coverNames = [...coverBlock.matchAll(/:\s*'\/assets\/covers\/([^']+)'/g)].map(match => match[1]);
    assert.equal(coverNames.length, 28);
    const highResolutionNames = new Set(fs.readdirSync('public/assets/covers').filter(file => file.endsWith('.webp')));
    const thumbnailNames = new Set(fs.readdirSync('public/assets/covers/thumbs').filter(file => file.endsWith('.webp')));
    assert.deepEqual([...highResolutionNames].sort(), [...coverNames].sort(), '高清封面目录只能保留注册表现行版本');
    assert.deepEqual([...thumbnailNames].sort(), [...coverNames].sort(), '缩略图目录必须与高清封面一一对应');

    for (const file of fs.readdirSync('public/games', { withFileTypes: true })) {
        if (!file.isDirectory()) continue;
        const clientPath = `public/games/${file.name}/client.js`;
        if (!fs.existsSync(clientPath)) continue;
        const client = fs.readFileSync(clientPath, 'utf8');
        assert.doesNotMatch(client, /(?:style|link|choiceLink)\.href[^\n]*Date\.now/, `${clientPath} 不应为样式每次生成新缓存键`);
    }
});

test('The shared game shell owns navigation and mobile viewport behavior', () => {
    const lobby = ['public/script.js', 'public/lobby/catalog-data.js', 'public/lobby/catalog-view.js', 'public/lobby/artwork.js', 'public/lobby/room-dialog.js', 'public/lobby/waiting-room-scene.js', 'public/lobby/game-entry-transition.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = readLobbyStyles();
    const gameDirectories = fs.readdirSync('public/games', { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'common');

    assert.equal(gameDirectories.filter(entry => fs.existsSync(`public/games/${entry.name}/client.js`)).length, 28);
    assert.equal((page.match(/id="leaveRoomBtn"/g) || []).length, 1, '游戏视图只能有一个大厅返回入口');
    assert.match(page, /aria-label="离开本局并回到大厅"/);
    assert.match(page, /id="roomInfoBtn"[\s\S]*aria-controls="roomInfoDialog"/, '共享顶栏应只提供一个房间信息入口');
    assert.match(page, /id="roomInfoDialog"[\s\S]*id="roomInfoName"[\s\S]*id="roomInfoCode"[\s\S]*data-copy-player-id/, '房间名、房间号和玩家 ID 应收进房间信息弹层');
    assert.doesNotMatch(page, /id="roomPageCode"|id="roomPageIdentity"/, '共享顶栏不应常驻显示房间号或玩家 ID');
    assert.match(lobby, /roomPageGame\.textContent = currentRoom\.gameName/, '共享顶栏只应显示当前游戏名');
    assert.match(lobby, /createRoomInfoController[\s\S]*trapRoomInfoFocus/, '房间信息入口应使用可访问弹层并限定焦点');
    assert.match(styles, /\.room-info-overlay/);
    assert.match(lobby, /gameMount\.dataset\.gameType = gameType/);
    assert.match(lobby, /createGameClient\(\{ mount: gameMount, send, addLog \}\)/);
    assert.doesNotMatch(lobby, /createGameClient\(\{ mount: gameMount, send, addLog, leaveRoom \}\)/);
    assert.match(styles, /--game-shell-bar-height:\s*48px/);
    assert.match(styles, /padding-top:\s*var\(--game-shell-offset\)/);
    assert.match(styles, /\.game-mobile-action-dock/);
    assert.match(styles, /\.game-mobile-drawer/);
    assert.match(styles, /\.game-mobile-scroll-strip/);
    assert.match(styles, /\.game-board-viewport/);
    assert.match(lobby, /pregame-seat-fire[\s\S]*pregame-seat-copy/, '等待房间席位应由火焰和名字组成');
    assert.match(lobby, /is-igniting/);
    assert.match(lobby, /is-extinguishing/);
    assert.match(lobby, /waitingSeatVisualOrder/);
    assert.match(lobby, /visualSlotForSeat/);
    assert.match(lobby, /nearestDistance/, '新席位应优先最大化与所有已入座玩家的最近距离');
    assert.match(lobby, /largestGap/, '新席位应缩小落座后仍然存在的最大空白弧');
    assert.match(lobby, /gapImbalance/, '新席位应让整圈间隙尽量均匀');
    assert.match(lobby, /regionLoad/, '同等间距下应优先选择人数较少的区域');
    assert.match(lobby, /previousDistance/, '同等平衡度下应偏向上一个玩家的对侧');
    assert.match(lobby, /repeatsPreviousPreviousRegion/, '同等平衡度下应避开上上个玩家所在区域');
    assert.doesNotMatch(lobby, /anchorIndex|regionCount/, '席位顺序不应写死四区锚点');
    assert.match(lobby, /waitingSeatIgniteUntil/, '资源预加载重渲染不应吞掉点火动画');
    assert.match(lobby, /waitingSeatIgniteTimers/, '点火结束后应恢复常驻火焰动画');
    assert.match(styles, /\.pregame-seat-fire/);
    assert.match(styles, /pregame-blue-flame-v1\.webp/);
    assert.match(styles, /\.pregame-seat\.is-me \{ border:\s*0; background:\s*transparent; box-shadow:\s*none/, '自己的席位不应恢复背景框');
    assert.match(styles, /--flame-hue:\s*160deg/, '自己的火焰应使用红色色相');
    assert.match(styles, /@keyframes pregameFireLiving/);
    assert.match(styles, /@keyframes pregameIgniteBase/);
    assert.match(styles, /clip-path:\s*inset\(92% 0 0\)/, '火焰应从底部逐层显现，而不是整张素材缩放');
    assert.match(styles, /@keyframes pregameFireFlame/);
    assert.match(styles, /@keyframes pregameSeatExtinguish/);
    assert.match(lobby, /buildGameEntryGroups/);
    assert.match(lobby, /playGameEntryTransition/);
    assert.match(lobby, /function waitingSeatVisualSlot/);
    assert.match(lobby, /seatIndex === mySeatIndex \? 0/, '当前玩家必须强制成为六点钟视觉锚点');
    assert.match(lobby, /Math\.cos\(angle\) \* \(compact \? 34 : 38\)/, '席位横向环距应为窄屏预留边界空间');
    assert.match(lobby, /Math\.sin\(angle\) \* \(compact \? 35 : 35\)/, '席位纵向环距应保持统一的相对旋转');
    assert.match(lobby, /let seatIndex = Number\(player\.seatIndex\)/, '席位编号应统一按数值解析，避免字符串编号导致视觉错位');
    assert.match(lobby, /playerBySeat\.entries\(\)\].find/, '当前玩家的旋转锚点应取实际映射后的席位');
    assert.match(styles, /\.pregame-seat\.is-me \{ --seat-x: 50% !important; --seat-y: 89% !important; \}/, '自己的红色火焰应固定在圆桌正下方');
    assert.match(lobby, /order\.indexOf\(seatIndex\)/, '席位视觉顺序应反向映射为座位到视觉槽位');
    assert.match(lobby, /ordered\.length === 1/, '单人游戏应保留两个顺序波次兜底');
    assert.match(lobby, /ordered\.length === 2/);
    assert.match(lobby, /ordered\.map\(item => \[item\.seat\]\)/, '两名玩家必须拆成两个单人势力组');
    assert.match(lobby, /const flashWaves = groups;/, '每个空间分组只应播放一次');
    assert.doesNotMatch(lobby, /\[\.\.\.groups, \.\.\.groups\]/, '不应把整轮势力分组重复播放');
    assert.match(lobby, /prepare(?:GameEntry)?Streams/);
    assert.match(lobby, /is-gathering/);
    assert.match(lobby, /is-entry-flash/);
    assert.match(lobby, /is-entry-fading/);
    assert.match(styles, /\.game-entry-transition/);
    assert.match(styles, /\.game-entry-portal-plane/);
    assert.match(styles, /\.pregame-table[^}]*perspective\(900px\) rotateX\(3deg\)/, '等待房间应保留 3D 圆桌质感');
    assert.match(styles, /\.game-entry-portal-ring\.is-outer/);
    assert.match(styles, /perspective\(620px\) rotateX\(68deg\)/, '开局法阵应保留原有桌面透视');
    assert.match(lobby, /is-bursting/);
    assert.match(styles, /\.game-entry-burst::after/);
    assert.match(styles, /@keyframes gameEntryWhiteBurst/, '开局应使用全屏白光完成场景切换');
    assert.match(styles, /@keyframes gameEntryBurstCore/);
    assert.match(styles, /@keyframes gameEntryStreamGather/);
    assert.match(styles, /@keyframes gameEntryPortalBurst/);
    assert.doesNotMatch(styles, /\.game-entry-core\b/, '不应退回正对屏幕的旧核心图标');
    assert.doesNotMatch(lobby, /game-entry-shatter|game-entry-shard/);
    assert.doesNotMatch(styles, /gameEntryShardBreak/);
    assert.match(styles, /@keyframes pregameEntryFlashFire/);
    assert.match(styles, /prefers-reduced-motion:\s*reduce/);
    assert.doesNotMatch(styles, /100vh/);

    const clientPaths = gameDirectories
        .map(entry => `public/games/${entry.name}/client.js`)
        .concat(['public/games/chess/lobby-client.js', 'public/games/common/grid-client.js']);
    for (const clientPath of clientPaths) {
        const client = fs.readFileSync(clientPath, 'utf8');
        assert.doesNotMatch(client, /data-ui=["']leave["']|data-action=["']leave-room["']|\bleaveRoom\b/, `${clientPath} 不应再拥有离房入口`);
    }

    const gameStylePaths = fs.readdirSync('public/games', { withFileTypes: true }).flatMap(entry => {
        if (!entry.isDirectory()) return [];
        return fs.readdirSync(`public/games/${entry.name}`)
            .filter(file => file.endsWith('.css'))
            .map(file => `public/games/${entry.name}/${file}`);
    });
    for (const stylePath of gameStylePaths) {
        const gameStyle = fs.readFileSync(stylePath, 'utf8');
        assert.doesNotMatch(gameStyle, /100vh/, `${stylePath} 应使用动态视口单位`);
        assert.doesNotMatch(gameStyle, /touch-action\s*:\s*none/, `${stylePath} 不应吞掉普通页面手势`);
    }
});

test('Mobile blocker games default to usable boards and expose controlled Monopoly inspection', () => {
    const junqiClient = readFrontendSource('junqi');
    const junqiStyle = fs.readFileSync('public/games/junqi/style.css', 'utf8');
    const xiangqiClient = readFrontendSource('xiangqi');
    const xiangqiStyle = fs.readFileSync('public/games/xiangqi/style.css', 'utf8');
    const chessClient = readFrontendSource('chess');
    const chessStyle = fs.readFileSync('public/games/chess/chess3d.css', 'utf8');
    const chessBridge = fs.readFileSync('public/games/chess/lobby-client.js', 'utf8');
    const chessFrame = fs.readFileSync('public/games/chess/room-frame.html', 'utf8');
    const monopolyClient = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
        .map(file => fs.readFileSync(`public/games/monopoly/${file}`, 'utf8')).join('\n');
    const monopolyStyle = fs.readFileSync('public/games/monopoly/style.css', 'utf8');

    for (const [name, client] of [['军棋', junqiClient], ['中国象棋', xiangqiClient], ['国际象棋', chessClient]]) {
        assert.match(client, /\(max-width: 760px\), \(pointer: coarse\)/, `${name} 应识别手机或粗指针设备`);
        assert.match(client, /explicitViewModeStorageKey/, `${name} 应区分首次默认值与用户主动选择`);
        assert.match(client, /setViewMode\(viewMode, false\)/, `${name} 首次应用移动默认值时不应伪装成用户偏好`);
    }

    assert.doesNotMatch(junqiStyle, /min-width:\s*660px|\.junqi3d-footer\s*\{[^}]*min-width:\s*660px/s);
    assert.doesNotMatch(xiangqiStyle, /min-width:\s*640px|width:\s*620px|\.xiangqi3d-footer\s*\{[^}]*min-width:\s*640px/s);
    assert.match(junqiStyle, /\.junqi3d-setup-tray\s*\{[\s\S]*?overflow-x:\s*auto/);
    assert.match(junqiStyle, /\.junqi3d-setup\s*\{[\s\S]*?position:\s*fixed/);
    assert.match(xiangqiStyle, /\.xiangqi3d-viewport\.is-2d \.xiangqi2d-board/);
    assert.match(chessStyle, /height:\s*100dvh/);
    assert.match(chessBridge, /min-height:0/);
    assert.doesNotMatch(chessBridge, /min-height:620px/);
    assert.match(chessFrame, /--game-shell-offset:\s*0px/);

    assert.match(monopolyClient, /class="mono-mobile-navigator"/);
    assert.match(monopolyClient, /data-ui="previousTile"/);
    assert.match(monopolyClient, /data-role="mobileTileSelect"/);
    assert.match(monopolyClient, /data-ui="followPosition"/);
    assert.match(monopolyClient, /function renderMobileNavigator/);
    assert.match(monopolyStyle, /\.mono-mobile-navigator\s*\{\s*display:\s*none/);
    assert.match(monopolyStyle, /\.mono-mobile-route-controls\s*\{[\s\S]*?grid-template-columns:\s*44px/);
    assert.match(monopolyStyle, /\.mono-command\s*\{[^}]*position:\s*sticky/s);
});

test('Remaining board games keep their core turn controls inside short landscape viewports', () => {
    const games = ['jungle', 'aeroplane', 'gobang', 'checkers'];
    const manifest = fs.readFileSync('public/games/common/game-manifest.js', 'utf8');
    for (const game of games) {
        const client = readFrontendSource(game);
        const styles = readGameStyles(game);
        assert.match(client, /getGameStyleHrefs\(/, `${game} 应从统一资源清单加载样式`);
        assert.match(client, /loadStyles\(/, `${game} 应使用公共样式加载器`);
        assert.match(client, /createClientScope\(/, `${game} 应使用公共生命周期`);
        assert.match(client, /createModalController\(/, `${game} 应使用公共规则弹层`);
        assert.match(client, /from ['"]\.\.\/common\/html\.js['"]/, `${game} 应使用公共 HTML 转义`);
        assert.doesNotMatch(client, /document\.head\.appendChild/, `${game} 不应自行追加样式标签`);
        assert.match(manifest, new RegExp(`\\b${game}:\\s*freezeAssets`), `${game} 应登记在统一资源清单`);
        assert.match(styles, /orientation:\s*landscape/, `${game} 应提供短边横屏布局`);
        assert.match(styles, /max-height:\s*520px/, `${game} 应按可用高度而不是只按宽度适配`);
        assert.match(styles, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/, `${game} 横屏根场景应扣除统一顶栏`);
        assert.match(styles, /overflow:\s*hidden/, `${game} 横屏核心场景不应依赖页面上下滚动`);
        assert.match(styles, /inset:\s*var\(--game-shell-offset/, `${game} 的短屏规则层不应藏到统一顶栏后面`);
        assert.doesNotMatch(styles, /touch-action\s*:\s*none/, `${game} 不应吞掉浏览器手势`);
    }

    const jungleStyle = fs.readFileSync('public/games/jungle/style.css', 'utf8');
    const aeroplaneStyle = fs.readFileSync('public/games/aeroplane/style.css', 'utf8');
    const gobangStyle = fs.readFileSync('public/games/gobang/style.css', 'utf8');
    const checkersStyle = fs.readFileSync('public/games/checkers/style.css', 'utf8');
    const visualFixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(jungleStyle, /\*\s*7\s*\/\s*9/, '斗兽棋横屏棋盘应保持 7:9 比例');
    assert.match(aeroplaneStyle, /grid-template-columns:\s*clamp\(82px/, '飞行棋横屏应并排放置骰子与棋盘');
    assert.match(gobangStyle, /100svh[^;]*-\s*35px/, '五子棋横屏棋盘应由短边高度控制');
    assert.match(checkersStyle, /\.8660254/, '跳棋横屏应按六角棋盘比例由高度反推宽度');
    assert.match(visualFixture, /function fixtureState/);
    assert.match(visualFixture, /const coreFits/);
    for (const game of games) assert.match(visualFixture, new RegExp(`gameType === '${game}'`));
});

test('Hand and response games keep the active decision inside short mobile viewports', () => {
    const games = ['loveletter', 'coup', 'monopolydeal', 'hanabi'];
    const expectedAssetVersion = { loveletter: '20260830-loveletter-flow-3', coup: '20260827-settlement-scenes-1', monopolydeal: '20260827-settlement-scenes-1', hanabi: '20260827-hanabi-a11y-1' };
    const manifest = fs.readFileSync('public/games/common/game-manifest.js', 'utf8');
    for (const game of games) {
        const client = fs.readFileSync(`public/games/${game}/client.js`, 'utf8');
        const styles = readGameStyles(game);
        if (['loveletter', 'coup', 'hanabi', 'monopolydeal'].includes(game)) {
            assert.match(client, /getGameStyleHrefs\(/, `${game} 应从统一资源清单加载样式`);
            assert.match(client, /loadStyles\(/, `${game} 应使用公共样式加载器`);
            assert.match(client, /createClientScope\(/, `${game} 应使用公共生命周期`);
            assert.match(manifest, new RegExp(`\\b${game}:\\s*freezeAssets`), `${game} 应登记在统一资源清单`);
        } else {
            assert.match(client, new RegExp(expectedAssetVersion[game]), `${game} 应加载当前资源版本`);
        }
        assert.match(styles, /orientation:\s*landscape/, `${game} 应提供短边横屏布局`);
        assert.match(styles, /max-height:\s*520px/, `${game} 应按短边高度切换横屏操作台`);
        assert.match(styles, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/, `${game} 横屏根场景应扣除统一顶栏`);
        assert.match(styles, /overflow:\s*hidden/, `${game} 横屏当前决策不应依赖页面滚动`);
        assert.match(styles, /inset:\s*var\(--game-shell-offset/, `${game} 的规则或演出层不应盖住统一顶栏`);
    }

    const coupClient = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
        .map(file => fs.readFileSync(`public/games/coup/${file}`, 'utf8')).join('\n');
    const coupStyle = readGameStyles('coup');
    const dealStyle = readGameStyles('monopolydeal');
    const dealChoiceStyle = fs.readFileSync('public/games/monopolydeal/choice.css', 'utf8');
    const hanabiClient = fs.readFileSync('public/games/hanabi/client.js', 'utf8');
    const hanabiRender = fs.readFileSync('public/games/hanabi/render.js', 'utf8');
    const hanabiStyle = readGameStyles('hanabi');
    const visualFixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');

    assert.match(coupClient, /is-challenge-decision/);
    assert.match(coupClient, /is-influence-decision/);
    assert.match(coupClient, /is-exchange-decision/);
    assert.match(coupStyle, /\.cp-app\.is-challenge-decision \.cp-command\s*\{\s*display:\s*none/);
    assert.match(dealStyle, /grid-template-areas:\s*"hand action"/);
    const dealTemplate = fs.readFileSync('public/games/monopolydeal/template.js', 'utf8');
    assert.match(dealTemplate, /deal-command[\s\S]*deal-command-inner[\s\S]*deal-hand[\s\S]*deal-action-console/);
    assert.match(dealChoiceStyle, /orientation:\s*landscape/);
    assert.match(dealChoiceStyle, /inset:\s*var\(--game-shell-offset/);
    assert.match(hanabiRender, /is-clue-targeting/);
    assert.match(hanabiStyle, /\.hb-app\.is-clue-targeting \.hb-my-hand\s*\{\s*display:\s*none/);
    assert.match(visualFixture, /20260827-hidden-role-focus-1/);
    assert.match(visualFixture, /window\.__shellTestState/);
    for (const game of games) {
        assert.match(visualFixture, new RegExp(`gameType === '${game}'`));
        assert.match(visualFixture, new RegExp(`${game}: \\[`, 'm'));
    }
});

test('Hidden-information games keep private decisions inside short landscape viewports', () => {
    const games = ['werewolf', 'avalon', 'decrypto', 'witchtown'];
    const expectedAssetVersion = {
        werewolf: '20260919-werewolf-art-2',
        avalon: '20260829-avalon-role-privacy-1',
        decrypto: '20260827-online-notebook-1',
        witchtown: '20260827-hold-identity-2'
    };
    const gameManifest = fs.readFileSync('public/games/common/game-manifest.js', 'utf8');
    for (const game of games) {
        const client = readFrontendSource(game);
        const styles = readGameStyles(game);
        const assetSource = `${gameManifest}\n${client}`;
        assert.match(assetSource, new RegExp(expectedAssetVersion[game]), `${game} 应加载当前资源版本`);
        assert.match(styles, /orientation:\s*landscape/, `${game} 应提供短边横屏布局`);
        assert.match(styles, /max-height:\s*520px/, `${game} 应按短边高度切换横屏操作台`);
        assert.match(styles, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/, `${game} 横屏根场景应扣除统一顶栏`);
        assert.match(styles, /overflow:\s*hidden/, `${game} 横屏核心场景不应依赖页面上下滚动`);
        assert.match(styles, /inset:\s*var\(--game-shell-offset/, `${game} 的规则或演出层不应藏到统一顶栏后面`);
    }

    const werewolfClient = readFrontendSource('werewolf');
    const avalonClient = readFrontendSource('avalon');
    const decryptoClient = readFrontendSource('decrypto');
    const witchtownClient = readWitchtownClient();
    assert.match(werewolfClient, /dataset\.phase/);
    assert.match(avalonClient, /is-my-action/);
    assert.match(decryptoClient, /dataset\.phase/);
    assert.match(witchtownClient, /dataset\.phase/);

    const visualFixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(visualFixture, /20260827-hidden-role-focus-1/);
    for (const game of games) assert.match(visualFixture, new RegExp(`gameType === '${game}'`));
});

test('Permanent departures do not leave hidden-information games waiting for an offline player', () => {
    const avalon = new AvalonEngine('avalon-leave-flow', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(avalon.start().success, true);
    assert.equal(avalon.handlePlayerLeave('a').success, true);
    for (const id of ['b', 'c', 'd', 'e']) assert.equal(avalon.handleAction(id, { kind: 'confirmRole' }).success, true);
    assert.equal(avalon.phase, 'team', '离开身份确认阶段的玩家不能阻塞进入组队');
    assert.equal(avalon.handlePlayerLeave('b').success, true);
    assert.equal(avalon.players[avalon.leaderIndex].id, 'c', '离开的队长应交给下一位在线玩家');
    assert.equal(avalon.handleAction('c', { kind: 'proposeTeam', playerIds: ['c', 'd'] }).success, true);
    assert.equal(avalon.handlePlayerLeave('e').success, true);
    for (const id of ['c', 'd']) assert.equal(avalon.handleAction(id, { kind: 'castVote', approve: true }).success, true);
    assert.equal(avalon.phase, 'team', '离开的投票者应自动按拒绝票补齐并继续轮换');

    const mission = new AvalonEngine('avalon-leave-mission', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    mission.start();
    for (const player of mission.players) mission.handleAction(player.id, { kind: 'confirmRole' });
    mission.handleAction('a', { kind: 'proposeTeam', playerIds: ['a', 'b'] });
    for (const id of ['a', 'b', 'c', 'd', 'e']) mission.handleAction(id, { kind: 'castVote', approve: true });
    assert.equal(mission.phase, 'mission');
    assert.equal(mission.handlePlayerLeave('b').success, true);
    assert.equal(mission.handleAction('a', { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(mission.phase, 'team', '离开的任务队员应自动按成功牌补齐');

    const decrypto = new DecryptoEngine('decrypto-leave-flow', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(decrypto.start().success, true);
    assert.equal(decrypto.handlePlayerLeave('d').success, true);
    for (const id of ['a', 'b', 'c']) assert.equal(decrypto.handleAction(id, { kind: 'confirmKey' }).success, true);
    assert.equal(decrypto.phase, 'clue', '离开密钥核对阶段的玩家不能阻塞第一轮通信');
    assert.equal(decrypto.handlePlayerLeave('a').success, true);
    assert.equal(decrypto.currentTurn.encryptorId, 'c', '离开的加密员应移交给同队在线成员');
    assert.equal(decrypto.handleAction('c', { kind: 'submitClue', clues: ['山', '河', '云'] }).success, true);
    assert.equal(decrypto.handleAction('b', { kind: 'submitClue', clues: ['火', '石', '风'] }).success, true);
    assert.equal(decrypto.round, 2, '离开加密员和另一队非加密员后，系统应自动完成无人可操作的猜码阶段');
    assert.equal(decrypto.phase, 'clue');

    const guessing = new DecryptoEngine('decrypto-leave-guessing', players(['a', 'b', 'c', 'd']), () => 0);
    guessing.start();
    for (const id of ['a', 'b', 'c', 'd']) guessing.handleAction(id, { kind: 'confirmKey' });
    guessing.handleAction('a', { kind: 'submitClue', clues: ['山', '河', '云'] });
    guessing.handleAction('b', { kind: 'submitClue', clues: ['火', '石', '风'] });
    assert.equal(guessing.phase, 'guessing');
    assert.equal(guessing.handlePlayerLeave('c').success, true);
    assert.equal(guessing.activeTeam, 1, '当前队最后一名猜码成员离开后应自动提交默认答案');
    assert.equal(guessing.handlePlayerLeave('d').success, true);
    assert.equal(guessing.round, 2);
    assert.equal(guessing.phase, 'clue');

    const fixed = new DecryptoEngine('decrypto-fixed-leave-flow', players(['a', 'b', 'c', 'd']), () => 0, { encryptorMode: 'fixed_vote' });
    fixed.start();
    fixed.handlePlayerLeave('d');
    for (const id of ['a', 'b', 'c']) fixed.handleAction(id, { kind: 'confirmKey' });
    assert.equal(fixed.phase, 'encryptor_vote');
    for (const [id, candidate] of [['a', 'a'], ['b', 'b'], ['c', 'c']]) fixed.handleAction(id, { kind: 'voteEncryptor', playerId: candidate });
    assert.equal(fixed.phase, 'clue', '固定加密员投票应自动忽略离场席位');
});

test('Lobby starts from a concise choose-or-join gateway', () => {
    const app = ['app.js', 'server/realtime/create-realtime-server.js', 'server/realtime/room-handlers.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const lobby = ['public/script.js', 'public/lobby/catalog-view.js'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = readLobbyStyles();
    assert.match(page, /<body class="is-entry-view">/);
    assert.match(page, /id="lobbyEntry"/);
    assert.match(page, /id="entryStartBtn"[^>]*>[\s\S]*?开始游戏/);
    assert.match(page, /id="entryJoinBtn"[^>]*>[\s\S]*?加入房间/);
    assert.match(page, /id="joinLobbyView"[^>]*hidden/);
    assert.match(page, /id="joinLobbyCodeInput"/);
    assert.match(page, /输入房间号/);
    assert.match(page, /id="joinLobbyRoomList"/);
    assert.match(page, /id="joinLobbyGameFilter"/);
    assert.match(page, /data-auth-slot/);
    assert.match(page, /玩家昵称/);
    assert.doesNotMatch(page, /账号系统接入|宣传语征集|RECONNECT TEST/);
    assert.match(lobby, /function enterGameCatalog/);
    assert.match(lobby, /function showJoinLobby/);
    assert.match(lobby, /function returnHomeFromBrand/);
    assert.match(lobby, /history\.replaceState\(null, '', location\.pathname\)/);
    assert.match(lobby, /showEntryGateway\(\{ replayAnimation: false, animateReturn: true \}\)/);
    assert.match(lobby, /function joinFromJoinLobby/);
    assert.match(lobby, /pendingUrlInviteToken/);
    assert.match(lobby, /params\.set\('invite', currentRoom\.inviteToken\)/);
    assert.match(lobby, /inviteToken = pendingUrlRoom === roomId \? pendingUrlInviteToken : ''/);
    assert.match(lobby, /function renderJoinLobbyRooms/);
    assert.match(lobby, /if \(pendingUrlRoom\) \{ showJoinLobby\(\{ focusCode: false \}\); joinLobbyCodeInput\.value = pendingUrlRoom; \}/);
    assert.doesNotMatch(lobby, /if \(pendingUrlRoom\) \{ send\(\{ type: 'joinRoom'/, '邀请链接也应先进入找房大厅并让玩家确认加入');
    assert.match(app, /房间不存在，请核对房间号/);
    assert.match(styles, /\.lobby-entry \{ position: fixed/);
    assert.match(styles, /\.is-entry-static \.entry-intro/);
    assert.match(styles, /\.is-entry-returning \.lobby-entry/);
    assert.match(styles, /\.entry-identity \{/);
    assert.match(styles, /\.join-lobby-view \{/);
    assert.match(styles, /\.join-room-list \{/);
});

test('The four newest games can each run from setup to a deterministic end state', () => {
    const manila = new ManilaEngine('manila-full', players(['a', 'b', 'c']), () => 0.99); manila.start(); let guard = 0;
    while (manila.status === 'playing' && guard++ < 300) { if (manila.phase === 'auction') { const current = manila.players[manila.auction.currentIndex]; manila.handleAction(current.id, { kind: 'pass' }); } else if (manila.phase === 'master') manila.handleAction(manila.harborMasterId, { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] }); else if (manila.phase === 'placement') { const current = manila.players[manila.placementTurnIndex]; manila.handleAction(current.id, { kind: 'passPlacement' }); } else if (manila.phase === 'sailing') manila.handleAction(manila.harborMasterId, { kind: 'sailBoats', order: manila.movementPlan.rolls.map(item => item.boatId) }); }
    assert.equal(manila.status, 'ended');
    const art = new ModernArtEngine('modernart-full', players(['a', 'b', 'c']), () => 0); art.start(); guard = 0;
    while (art.status === 'playing' && guard++ < 1000) {
        if (art.phase === 'auction') {
            const seller = art.players[art.currentSellerIndex];
            const cardIndex = seller.hand.findIndex((card, index) => card.auctionType !== 'double' || seller.hand.some((other, otherIndex) => otherIndex !== index && other.artistId === card.artistId && other.auctionType !== 'double'));
            const chosenIndex = cardIndex < 0 ? 0 : cardIndex; const chosen = seller.hand[chosenIndex]; const action = { kind: 'startAuction', cardIndex: chosenIndex };
            if (chosen.auctionType === 'double') { const secondIndex = seller.hand.findIndex((other, index) => index !== chosenIndex && other.artistId === chosen.artistId && other.auctionType !== 'double'); if (secondIndex >= 0) action.secondCardIndex = secondIndex; }
            if (chosen.auctionType === 'fixed') action.amount = 1;
            art.handleAction(seller.id, action);
        } else if (art.phase === 'bidding') {
            const current = art.players[art.auction.currentBidderIndex];
            let amount;
            if (art.auction.type === 'fixed') amount = current.id === art.auction.sellerId ? 0 : art.auction.fixedPrice;
            else if (art.auction.type === 'sealed') amount = 1;
            else amount = art.auction.highestBid === 0 ? 1 : 0;
            art.handleAction(current.id, { kind: 'bid', amount });
        }
    }
    assert.equal(art.status, 'ended');
    const camel = new CamelUpEngine('camel-full', players(['a', 'b', 'c']), () => 0); camel.start(); guard = 0;
    while (camel.status === 'playing' && guard++ < 300) camel.handleAction(camel.players[camel.turnPlayerIndex].id, { kind: 'rollDie' });
    assert.equal(camel.status, 'ended');
    const athlete = new MagicalAthleteEngine('athlete-full', players(['a', 'b']), () => .99); athlete.start();
    maAutoPlay(athlete);
    assert.equal(athlete.status, 'ended');
});

test('Social deduction games share a prominent responsive identity focus and Avalon uses local role art', () => {
    const common = fs.readFileSync('public/games/common/hidden-role-focus.css', 'utf8');
    const avalonClient = readFrontendSource('avalon');
    const avalonStyle = readGameStyles('avalon');
    const werewolfClient = readFrontendSource('werewolf');
    const werewolfStyle = fs.readFileSync('public/games/werewolf/style.css', 'utf8');
    const witchtownClient = readWitchtownClient();
    const witchtownStyle = ['public/games/witchtown/style.css', 'public/games/witchtown/table.css', 'public/games/witchtown/dossier.css', 'public/games/witchtown/scenes.css', 'public/games/witchtown/responsive.css']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const sources = fs.readFileSync('public/assets/bgg/SOURCES.md', 'utf8');
    const roles = ['loyal', 'merlin', 'percival', 'minion', 'assassin', 'morgana', 'mordred', 'oberon'];

    assert.match(common, /\.social-role-focus/);
    assert.match(common, /\.social-role-focus-art/);
    for (const client of [avalonClient, werewolfClient, witchtownClient]) {
        assert.match(client, /hidden-role-focus\.css/);
        assert.match(client, /social-role-focus/);
    }
    for (const role of roles) {
        const entry = avalonClient.match(new RegExp(`${role}: \\{[^\\n]+image: '([^']+)'`));
        assert.ok(entry, `${role} 应配置角色卡面`);
        const file = `public/assets/games/avalon/roles/${entry[1]}`;
        const bytes = fs.readFileSync(file);
        const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const isWebp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
        assert.ok(isPng || isWebp, `${role} 应为本地 PNG 或 WebP`);
        assert.ok(bytes.length > 50_000, `${role} 角色裁图不应是空壳资源`);
    }
    assert.match(avalonClient, /roleArtPreloads/);
    assert.match(avalonClient, /av-role-art social-role-focus-art/);
    assert.match(avalonClient, /<aside class="av-role-column"><section class="av-role social-role-focus" data-role="role"><\/section><\/aside>/);
    assert.match(avalonStyle, /\.av-role-art\s*\{/);
    assert.match(werewolfStyle, /\.ww-role\s*\{[\s\S]*?min-height:\s*360px/);
    assert.match(witchtownStyle, /\.witchtown-hall\s*\{[\s\S]*?min-height:\s*220px/);
    assert.match(witchtownStyle, /\.witchtown-role-panel\s*\{\s*display:\s*block;\s*grid-column:\s*2/);
    assert.match(sources, /1453098/);
    assert.match(sources, /1453075/);
});

test('Social identity-card games require hold-to-reveal while Coup keeps its online hand visible', () => {
    const clients = {
        werewolf: readFrontendSource('werewolf'),
        avalon: readFrontendSource('avalon'),
        witchtown: readWitchtownClient(),
    };
    const styles = {
        werewolf: fs.readFileSync('public/games/werewolf/style.css', 'utf8'),
        avalon: readGameStyles('avalon'),
        witchtown: ['public/games/witchtown/style.css', 'public/games/witchtown/table.css', 'public/games/witchtown/dossier.css', 'public/games/witchtown/scenes.css', 'public/games/witchtown/responsive.css']
            .map(file => fs.readFileSync(file, 'utf8')).join('\n'),
    };
    assert.match(clients.werewolf, /data-role-hold/);
    assert.match(clients.avalon, /data-role-hold/);
    assert.match(clients.witchtown, /data-dossier-hold/);
    for (const [game, client] of Object.entries(clients)) {
        assert.match(client, /pointerdown/, `${game} 缺少按住开始事件`);
        assert.match(client, /pointerup/, `${game} 缺少松手封存事件`);
        assert.match(client, /pointercancel/, `${game} 缺少触屏取消封存事件`);
        assert.match(client, /keyup/, `${game} 缺少键盘松开封存事件`);
        assert.match(client, /visibilitychange/, `${game} 切到后台时不会封存身份`);
        assert.match(client, /blur/, `${game} 窗口失焦时不会封存身份`);
    }
    assert.match(clients.witchtown, /镇议会角色从开局起始终公开，不属于密封档案/);
    const coup = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
        .map(file => fs.readFileSync(`public/games/coup/${file}`, 'utf8')).join('\n');
    assert.doesNotMatch(coup, /data-identity-hold/);
    assert.doesNotMatch(coup, /privateIdentityVisible/);
    assert.match(coup, /lossIndex: !card\.revealed && ready \? index : undefined/);
    assert.match(coup, /exchangeIndex: optionIndex/);
    assert.match(styles.werewolf, /\.ww-role-secret\s*\{[\s\S]*?transition:\s*none/);
    assert.match(styles.avalon, /\.av-role-secret\s*\{[\s\S]*?transition:\s*none/);
    assert.match(styles.witchtown, /\.witchtown-dossier\s*\{[\s\S]*?transition:\s*none/);
});

test('Study mode creates a one-person research table and switches the controlled perspective', () => {
    const studyTypes = ['chess', 'xiangqi', 'jungle', 'junqi', 'gobang', 'checkers'];
    const expectedNextSide = { chess: '黑方', xiangqi: '黑方', jungle: '蓝方', junqi: '蓝方', gobang: '白方', checkers: '蓝方' };
    for (const type of studyTypes) {
        const metadata = registry.getGame(type).metadata;
        assert.equal(metadata.studyMode, true, `${type} should advertise study mode`);
        const room = new Room(`study-${type}`, 'host', '研究者', type, { gameMode: 'study' });
        assert.equal(room.addPlayer({ id: 'host', name: '研究者' }).success, true);
        assert.equal(room.getInfo().studyMode, true);
        assert.equal(room.getInfo().minPlayers, 1);
        const started = room.startGame();
        assert.equal(started.success, true);
        assert.equal(started.state.studyMode, true);
        const first = room.getPlayerGameState('host');
        assert.equal(first.studyMode, true);
        assert.equal(first.studySeatIndex, 0);
        const switched = room.handleGameAction('host', { kind: 'studySwitchSeat', seatIndex: 1 });
        assert.equal(switched.success, true);
        assert.equal(switched.message, `已切换到${expectedNextSide[type]}`);
        const second = room.getPlayerGameState('host');
        assert.equal(second.studySeatIndex, 1);
        assert.notEqual(second.myColor, first.myColor);
        if (type !== 'junqi') assert.equal(room.handleGameAction('host', { kind: 'studyConfirmSetup' }).success, true);
    }
    const shell = ['public/script.js', 'public/lobby/study-controls.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(shell, /切换到下一方/);
    assert.match(shell, /STUDY_SIDE_LABELS/);
    assert.match(shell, /red: \[\['s', '兵'\].*black: \[\['s', '卒'/s);
    const xiangqiClient = readFrontendSource('xiangqi');
    assert.match(xiangqiClient, /const RED_LABELS = \{ k: '帥', a: '仕', e: '相'/);
    assert.match(xiangqiClient, /piece\.color === 'red' \? RED_LABELS\[piece\.type\] : LABELS\[piece\.type\]/);
    assert.match(xiangqiClient, /if \(piece\.color === 'black'\) face\.rotateZ\(Math\.PI\)/);
});

test('Study mode is reversible and normal match rooms still use real seats', () => {
    const room = new Room('study-toggle', 'host', '研究者', 'gobang');
    assert.equal(room.getInfo().roomSettings[0].options[1].title, '棋谱模式');
    room.addPlayer({ id: 'host', name: '研究者' });
    assert.equal(room.updateSettings('host', { gameMode: 'study' }).success, true);
    assert.equal(room.addPlayer({ id: 'guest', name: '对手' }).success, false);
    assert.equal(room.updateSettings('host', { gameMode: 'match' }).success, true);
    assert.equal(room.getInfo().studyMode, false);
    assert.equal(room.addPlayer({ id: 'guest', name: '对手' }).success, true);
    assert.equal(room.startGame().success, true);
    const state = room.getPlayerGameState('host');
    assert.equal(state.studyMode, undefined);
    assert.equal(state.players.length, 2);
    assert.equal(state.currentTurn, 'host');
});

test('Study mode excludes aeroplane and monopoly and keeps normal board rooms unchanged', () => {
    for (const type of ['aeroplane', 'monopoly']) {
        const metadata = registry.getGame(type).metadata;
        assert.notEqual(metadata.studyMode, true);
        const room = new Room(`normal-${type}`, 'host', '房主', type, { gameMode: 'study' });
        assert.equal(room.getInfo().studyMode, false);
        assert.equal(room.getInfo().minPlayers, metadata.minPlayers);
    }
});

test('Study setup accepts a custom public position before confirming the next turn', () => {
    const room = new Room('study-setup', 'host', '研究者', 'gobang', { gameMode: 'study' });
    room.addPlayer({ id: 'host', name: '研究者' });
    assert.equal(room.startGame().success, true);
    assert.equal(room.getPlayerGameState('host').studyPhase, 'setup');
    assert.equal(room.handleGameAction('host', { kind: 'place', x: 7, y: 7 }).success, true);
    assert.equal(room.handleGameAction('host', { kind: 'studySwitchSeat', seatIndex: 1 }).success, true);
    assert.equal(room.handleGameAction('host', { kind: 'place', x: 8, y: 8 }).success, true);
    assert.equal(room.handleGameAction('host', { kind: 'studyConfirmSetup' }).success, true);
    const state = room.getPlayerGameState('host');
    assert.equal(state.studyPhase, 'play');
    assert.equal(state.pieces.length, 2);
    assert.equal(state.turn, 'white');
});
