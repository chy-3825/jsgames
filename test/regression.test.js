const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const Room = require('../server/room');
const LoveLetter = require('../server/games/loveletter');
const LoveLetterEngine = require('../server/games/loveletter/engine');
const Coup = require('../server/games/coup');
const Chess = require('../server/games/chess');
const Xiangqi = require('../server/games/xiangqi');
const Jungle = require('../server/games/jungle');
const Gobang = require('../server/games/gobang');
const Checkers = require('../server/games/checkers');
const Monopoly = require('../server/games/monopoly');
const MonopolyDeal = require('../server/games/monopolydeal');
const MonopolyDealEngine = require('../server/games/monopolydeal/engine');
const GuessNumber = require('../server/games/guessnumber');
const Aeroplane = require('../server/games/aeroplane');
const Junqi = require('../server/games/junqi');
const TakeFive = require('../server/games/takefive');
const TakeFiveEngine = require('../server/games/takefive/engine');
const Splendor = require('../server/games/splendor');
const SplendorEngine = require('../server/games/splendor/engine');
const Hanabi = require('../server/games/hanabi');
const HanabiEngine = require('../server/games/hanabi/engine');
const Kingdomino = require('../server/games/kingdomino');
const KingdominoEngine = require('../server/games/kingdomino/engine');
const Acquire = require('../server/games/acquire');
const AcquireEngine = require('../server/games/acquire/engine');
const Citadels = require('../server/games/citadels');
const CitadelsEngine = require('../server/games/citadels/engine');
const Witchtown = require('../server/games/witchtown');
const WitchtownEngine = require('../server/games/witchtown/engine');
const LasVegas = require('../server/games/lasvegas');
const LasVegasEngine = require('../server/games/lasvegas/engine');
const Avalon = require('../server/games/avalon');
const AvalonEngine = require('../server/games/avalon/engine');
const Scout = require('../server/games/scout');
const ScoutEngine = require('../server/games/scout/engine');
const Decrypto = require('../server/games/decrypto');
const DecryptoEngine = require('../server/games/decrypto/engine');
const Manila = require('../server/games/manila');
const ManilaEngine = require('../server/games/manila/engine');
const ModernArt = require('../server/games/modernart');
const ModernArtEngine = require('../server/games/modernart/engine');
const CamelUp = require('../server/games/camelup');
const CamelUpEngine = require('../server/games/camelup/engine');
const MagicalAthlete = require('../server/games/magicalathlete');
const MagicalAthleteEngine = require('../server/games/magicalathlete/engine');
const Werewolf = require('../server/games/werewolf');
const WerewolfEngine = require('../server/games/werewolf/engine');
const registry = require('../server/games/registry');
const { GAME_GROUPS } = require('../server/games/groups');

const players = ids => ids.map(id => ({ id, name: id }));
const confirmAvalonRoles = game => {
    if (game.phase !== 'roleReveal') return;
    for (const player of game.players) assert.equal(game.handleAction(player.id, { kind: 'confirmRole' }).success, true);
    assert.equal(game.phase, 'team');
};
const confirmDecryptoKeys = game => {
    if (game.phase !== 'keycheck') return;
    for (const player of game.players) if (!game.keyConfirmed[player.id]) assert.equal(game.handleAction(player.id, { kind: 'confirmKey' }).success, true);
    assert.equal(game.phase, 'clue');
};
const confirmWitchtownDossiers = session => {
    const game = session.engine;
    if (game.phase !== 'dossier_review') return;
    for (const player of game._alive()) if (!game.dossierReview.confirmations[player.id]) assert.equal(session.handleAction(player.id, { kind: 'confirmDossier' }).success, true);
};
const passWitchtownConfessions = session => {
    const game = session.engine;
    for (const player of game._alive().filter(item => !game.nightActions.confessions[item.id])) assert.equal(session.handleAction(player.id, { kind: 'passConfession' }).success, true);
};
const confirmedWerewolfNightAction = (game, playerId, action) => {
    const staged = game.handleAction(playerId, { ...action, kind: 'stageNightAction' });
    if (!staged.success) return staged;
    const confirmed = game.handleAction(playerId, { kind: 'confirmNightAction' });
    if (!confirmed.success) return confirmed;
    if (game.getPlayerState(playerId).nightConfirmation?.stage === 'result') return game.handleAction(playerId, { kind: 'confirmSeerResult' });
    return confirmed;
};
const chessEngine = () => {
    const session = Chess.create('rules', players(['white', 'black']));
    assert.equal(session.start().success, true);
    return session.engine;
};

// --- Magical Athlete test helpers (official 2025 rules) ---
const maAthlete = (game, index, id) => { const racer = game.racers[index]; racer.athleteId = id; racer.copiedPowers = []; return racer; };
const maDraft = (game) => {
    let guard = 0;
    while (game.phase === 'draft' && guard++ < 300) {
        const player = game.players[game.currentTurnIndex];
        const result = game.handleAction(player.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id });
        assert.equal(result.success, true);
    }
};
const maRaceSelect = (game) => {
    let guard = 0;
    while (game.phase === 'race_select' && guard++ < 300) {
        const player = game.players[game.currentTurnIndex];
        const picks = game.raceSelections[player.id] || [];
        const card = player.team.find(item => !player.usedAthletes.includes(item.id) && !picks.includes(item.id));
        assert.ok(card, 'race selection card exists');
        const result = game.handleAction(player.id, { kind: 'selectRaceAthlete', athleteId: card.id });
        assert.equal(result.success, true);
    }
};
const maResolvePrompts = (game) => {
    let guard = 0;
    while (game.pending && guard++ < 40) {
        const prompt = game.pending;
        let result;
        if (prompt.kind === 'eggPick') result = game.handleAction(prompt.playerId, { kind: 'eggPick', athleteId: prompt.pool[0] });
        else if (prompt.kind === 'twinPick') result = game.handleAction(prompt.playerId, { kind: 'twinPick', athleteId: prompt.options[0] });
        else if (prompt.kind === 'predict') { const target = game.racers.find(racer => racer.id !== prompt.racerId); result = game.handleAction(prompt.playerId, { kind: 'predict', targetRacerId: target.id }); }
        else if (prompt.kind === 'copycatPick') result = game.handleAction(prompt.playerId, { kind: 'decide', targetRacerId: prompt.options[0] });
        else if (prompt.kind === 'genius') result = game.handleAction(prompt.playerId, { kind: 'genius', guess: 3 });
        else if (prompt.kind === 'magician' || prompt.kind === 'dicemongerReroll') result = game.handleAction(prompt.playerId, { kind: 'decide', reroll: false });
        else result = game.handleAction(prompt.playerId, { kind: 'decide', use: false });
        assert.equal(result.success, true, `${prompt.kind} resolves`);
    }
};
const maAutoPlay = (game, maxSteps = 4000) => {
    let guard = 0;
    while (game.status === 'playing' && guard++ < maxSteps) {
        if (game.pendingAcknowledgements?.length) { const acknowledgement = game.pendingAcknowledgements[0]; const result = game.handleAction(acknowledgement.playerId, { kind: 'acknowledgeElimination', acknowledgementId: acknowledgement.id }); assert.equal(result.success, true); }
        else if (game.phase === 'draft') { const player = game.players[game.currentTurnIndex]; const result = game.handleAction(player.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }); assert.equal(result.success, true); }
        else if (game.phase === 'race_select') { const player = game.players[game.currentTurnIndex]; const picks = game.raceSelections[player.id] || []; const card = player.team.find(item => !player.usedAthletes.includes(item.id) && !picks.includes(item.id)); const result = game.handleAction(player.id, { kind: 'selectRaceAthlete', athleteId: card.id }); assert.equal(result.success, true); }
        else if (game.pending) maResolvePrompts(game);
        else { const player = game.players[game.currentTurnIndex]; const racer = game.racers.find(item => item.playerId === player.id && item.finishOrder == null && !item.eliminated && !item.turnDoneThisRound); const result = game.handleAction(player.id, { kind: 'roll', athleteId: racer.athleteId }); assert.equal(result.success, true); }
    }
    return guard;
};

test('lobby registry exposes every in-scope game and new presentation target', () => {
    const ids = new Set(registry.listGames().map(game => game.type));
    for (const id of ['loveletter', 'coup', 'guessnumber', 'monopoly', 'monopolydeal', 'aeroplane', 'gobang', 'checkers', 'takefive', 'hanabi', 'splendor', 'kingdomino', 'acquire', 'citadels', 'witchtown', 'lasvegas', 'avalon', 'scout', 'decrypto', 'manila', 'modernart', 'camelup', 'magicalathlete', 'werewolf']) assert.equal(ids.has(id), true, `${id} 未注册`);
});

test('BGG assets are used according to each game component type', () => {
    const acquireClient = fs.readFileSync('public/games/acquire/client.js', 'utf8');
    const citadelsClient = fs.readFileSync('public/games/citadels/client.js', 'utf8');
    const lasVegasClient = fs.readFileSync('public/games/lasvegas/client.js', 'utf8');
    const avalonClient = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    const scoutClient = fs.readFileSync('public/games/scout/client.js', 'utf8');
    const decryptoClient = fs.readFileSync('public/games/decrypto/client.js', 'utf8');
    const manilaClient = fs.readFileSync('public/games/manila/client.js', 'utf8');
    const modernArtClient = fs.readFileSync('public/games/modernart/client.js', 'utf8');
    const camelUpClient = fs.readFileSync('public/games/camelup/client.js', 'utf8');
    const magicalAthleteClient = fs.readFileSync('public/games/magicalathlete/client.js', 'utf8');
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
    assert.match(citadelsClient, /role-art-\$\{state\.currentRoleRank\}/);
});

test('lobby registry classifies every registered game into one primary group', () => {
    const games = registry.listGames();
    assert.equal(games.length, 28, '服务器应注册 28 个联机项目');
    assert.deepEqual(games.reduce((counts, game) => { counts[game.group] = (counts[game.group] || 0) + 1; return counts; }, {}), { 'social-assist': 4, board: 8, tabletop: 16 });
    for (const game of games) {
        assert.ok(game.groupName, `${game.type} 缺少分组名称`);
        assert.ok(game.groupOrder >= 1, `${game.type} 缺少分组排序`);
        assert.ok(game.sortOrder >= 1, `${game.type} 缺少组内排序`);
        assert.ok(['online', 'hybrid', 'host-assist', 'auto-assist', 'solo'].includes(game.playMode), `${game.type} 使用了未知游戏模式`);
    }
    assert.deepEqual(GAME_GROUPS.werewolf, { group: 'social-assist', playMode: 'auto-assist', sortOrder: 1 });
});

test('registry-backed games can start and expose player state', () => {
    for (const [module, ids] of [[LoveLetter, ['a', 'b']], [Coup, ['a', 'b']], [Chess, ['a', 'b']], [Xiangqi, ['a', 'b']], [Jungle, ['a', 'b']], [Gobang, ['a', 'b']], [Checkers, ['a', 'b']], [Monopoly, ['a', 'b']], [MonopolyDeal, ['a', 'b']], [Aeroplane, ['a', 'b']], [Junqi, ['a', 'b']], [TakeFive, ['a', 'b']], [Splendor, ['a', 'b']], [Hanabi, ['a', 'b']], [Kingdomino, ['a', 'b']], [Acquire, ['a', 'b']], [Citadels, ['a', 'b']], [Witchtown, ['a', 'b', 'c', 'd']], [GuessNumber, ['a']], [LasVegas, ['a', 'b']], [Avalon, ['a', 'b', 'c', 'd', 'e']], [Scout, ['a', 'b', 'c']], [Decrypto, ['a', 'b', 'c', 'd']], [Manila, ['a', 'b', 'c']], [ModernArt, ['a', 'b', 'c']], [CamelUp, ['a', 'b', 'c']], [MagicalAthlete, ['a', 'b']], [Werewolf, ['a']]]) {
        const session = module.create('room', players(ids));
        assert.equal(session.start().success, true);
        assert.equal(session.getPlayerState(ids[0]).myId, ids[0]);
    }
});

test('Werewolf allows one tester to switch across all nine private seats', () => {
    const game = new WerewolfEngine('werewolf-solo', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.seats.length, 9);
    assert.equal(game.getPlayerState('host').testMode, true);
    const roles = new Set();
    for (let seat = 1; seat <= 9; seat += 1) {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat }).success, true);
        const state = game.getPlayerState('host');
        assert.equal(state.activeSeat, seat);
        roles.add(state.myRole);
    }
    assert.deepEqual([...roles].sort(), ['guard', 'hunter', 'seer', 'villager', 'witch', 'werewolf'].sort());
});

test('Werewolf solo test mode can confirm all nine roles with one action', () => {
    const game = new WerewolfEngine('werewolf-confirm-all', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.getPlayerState('host').seats.every(seat => seat.role), true);
    assert.equal(game.handleAction('host', { kind: 'confirmAllRoles' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().phaseProgress.completed, 0);
    assert.equal(game.seats.every(seat => game.roleConfirmedSeats[seat.number]), true);

    const multiplayer = new WerewolfEngine('werewolf-confirm-all-restricted', players(['a', 'b']), 'a', () => 0);
    assert.equal(multiplayer.start().success, true);
    assert.equal(multiplayer.getPlayerState('a').seats.every(seat => !seat.role), true);
    assert.equal(multiplayer.handleAction('a', { kind: 'confirmAllRoles' }).success, false);
    assert.equal(multiplayer.phase, 'roleReveal');
});

test('Werewolf gives no player phase authority and assigns every seat to exactly one device', () => {
    const game = new WerewolfEngine('werewolf-no-host', players(['a', 'b']), 'a', () => 0);
    game.start();
    assert.equal(game.handleAction('b', { kind: 'nextPhase' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'confirmRole' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'switchSeat', seat: 1 }).success, false, '不能接管其他真实玩家的座位');
    for (let seat = 3; seat <= 9; seat += 1) {
        const controllerId = game._seat(seat).controllerId;
        assert.equal(game.handleAction(controllerId, { kind: 'switchSeat', seat }).success, true);
        assert.equal(game.handleAction(controllerId, { kind: 'confirmRole' }).success, true);
    }
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().hostId, undefined);
    assert.equal(game.getPlayerState('a').isHost, undefined);
});

test('Werewolf keeps seat-switch acknowledgements private during the night', () => {
    const game = new WerewolfEngine('werewolf-switch-privacy', players(['a', 'b']), 'a', () => 0);
    assert.equal(game.start().success, true);
    game.phase = 'nightWolf';

    const result = game.handleAction('a', { kind: 'switchSeat', seat: 3 });
    assert.equal(result.success, true);
    assert.match(game.getPlayerAction(result, 'a').message, /3 号测试席位/);
    assert.equal(game.getPlayerState('a').activeSeat, 3);
    assert.equal(game.getPlayerState('b').activeSeat, 2);
    const observerAction = game.getPlayerAction(result, 'b');
    assert.equal(observerAction.message, '');
    assert.equal(observerAction.privateFor, undefined);
});

test('Werewolf rooms stay private until the host locks a 9 or 12 player board and require every seat filled', () => {
    for (const targetPlayers of [9, 12]) {
        const room = new Room(`werewolf-room-${targetPlayers}`, 'host', '房主', 'werewolf', { sheriffEnabled: true });
        assert.equal(room.addPlayer({ id: 'host', name: '房主' }).success, true);
        assert.equal(room.getInfo().configurationConfirmed, false);
        assert.equal(room.isListed(), false);
        assert.equal(room.addPlayer({ id: 'early', name: '提前加入' }).success, false);
        assert.match(room.startGame().message, /确认房间人数/);
        assert.equal(room.configure('guest', { playerCount: targetPlayers }).success, false);
        assert.equal(room.configure('host', { playerCount: 10 }).success, false);
        assert.equal(room.configure('host', { playerCount: targetPlayers }).success, true);

        const info = room.getInfo();
        assert.equal(info.configurationConfirmed, true);
        assert.equal(info.targetPlayers, targetPlayers);
        assert.equal(info.minPlayers, targetPlayers);
        assert.equal(info.maxPlayers, targetPlayers);
        assert.equal(room.isListed(), true);
        for (let index = 2; index < targetPlayers; index += 1) {
            assert.equal(room.addPlayer({ id: `p${index}`, name: `玩家${index}` }).success, true);
        }
        assert.match(room.startGame().message, new RegExp(`当前 ${targetPlayers - 1}/${targetPlayers}`));
        assert.equal(room.addPlayer({ id: `p${targetPlayers}`, name: `玩家${targetPlayers}` }).success, true);
        assert.equal(room.startGame().success, true);
        assert.equal(room.game.engine.seats.length, targetPlayers);
        assert.equal(room.game.engine.seats.filter(seat => seat.role === 'werewolf').length, targetPlayers === 12 ? 4 : 3);
        assert.equal(room.game.engine.seats.filter(seat => seat.role === 'villager').length, targetPlayers === 12 ? 4 : 2);
        assert.equal(new Set(room.game.engine.seats.map(seat => seat.controllerId)).size, targetPlayers);
    }
});

test('Decrypto rooms let the host lock one of three encryptor selection modes', () => {
    for (const encryptorMode of ['fixed_vote', 'rotation', 'random']) {
        const room = new Room(`decrypto-room-${encryptorMode}`, 'host', '房主', 'decrypto');
        assert.equal(room.addPlayer({ id: 'host', name: '房主' }).success, true);
        assert.deepEqual(room.getInfo().allowedEncryptorModes, ['fixed_vote', 'rotation', 'random']);
        assert.equal(room.configurationConfirmed, false);
        assert.equal(room.isListed(), false);
        assert.equal(room.configure('guest', { encryptorMode }).success, false);
        assert.equal(room.configure('host', { encryptorMode: 'invalid' }).success, false);
        assert.equal(room.configure('host', { encryptorMode }).success, true);
        assert.equal(room.getInfo().gameOptions.encryptorMode, encryptorMode);
        assert.equal(room.isListed(), true);
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
    assert.deepEqual(info.roomSettings.map(setting => setting.key), ['playerCount', 'sheriffEnabled', 'winCondition']);
    assert.equal(werewolf.updateSettings('guest', { winCondition: 'parity' }).success, false);
    assert.equal(werewolf.updateSettings('host', { sheriffEnabled: false, winCondition: 'parity' }).success, true);
    assert.equal(werewolf.getInfo().gameOptions.sheriffEnabled, false);
    assert.equal(werewolf.getInfo().gameOptions.winCondition, 'parity');
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

test('Werewolf night skills require confirmation and Seer acknowledges the revealed faction', () => {
    const game = new WerewolfEngine('werewolf-night-confirmations', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.handleAction('host', { kind: 'confirmAllRoles' }).success, true);
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const guardSeat = seatFor('guard');
    const seerSeat = seatFor('seer');
    const witchSeat = seatFor('witch');
    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);

    game.handleAction('host', { kind: 'switchSeat', seat: guardSeat });
    assert.equal(game.handleAction('host', { kind: 'nightAction', targetSeat: seerSeat }).success, false, '旧的单步动作不能绕过确认轮次');
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: seerSeat }).success, true);
    assert.equal(game.night.guard, undefined, '暂存选择时不能提前写入守护结果');
    assert.deepEqual(game.getPlayerState('host').nightConfirmation, { stage: 'confirm', role: 'guard', targetSeat: seerSeat, choice: null, canConfirm: true, canCancel: true });
    assert.equal(game.handleAction('host', { kind: 'cancelNightAction' }).success, true);
    assert.equal(game.getPlayerState('host').nightConfirmation, null);
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: seerSeat }).success, true);
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.night.guard, seerSeat);
    assert.equal(game.phase, 'nightWolf');

    for (const wolfSeat of wolfSeats) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: guardSeat }).success, true);
        assert.equal(game.night.wolfVotes?.[wolfSeat], undefined, '确认前不能计入狼队票型');
        assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    }
    assert.equal(game.night.wolf, guardSeat);
    assert.equal(game.phase, 'nightSeer');

    game.handleAction('host', { kind: 'switchSeat', seat: seerSeat });
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: wolfSeats[0] }).success, true);
    assert.equal(game.night.seer, undefined);
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.phase, 'nightSeer', '显示查验身份时必须停留在预言家阶段');
    assert.equal(game.getPlayerState('host').nightConfirmation.stage, 'result');
    assert.equal(game.getPlayerState('host').seerResult.faction, 'wolf');
    assert.equal(game.handleAction('host', { kind: 'confirmSeerResult' }).success, true);
    assert.equal(game.phase, 'nightWitch');

    game.handleAction('host', { kind: 'switchSeat', seat: witchSeat });
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', choice: 'pass' }).success, true);
    assert.equal(game.night.witchActed, undefined, '女巫确认前不能提前结算');
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.night.witchActed, true);
    assert.notEqual(game.phase, 'nightWitch');
});

test('Werewolf confirms every seat and automatically runs the first full day-night cycle', () => {
    const game = new WerewolfEngine('werewolf-night', players(['host']), 'host', () => 0);
    game.start();
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);
    const goodTarget = game.seats.find(seat => seat.role === 'villager').number;
    const dissentTarget = seatFor('seer');

    assert.equal(game.handleAction('host', { kind: 'nextPhase' }).success, false);
    for (let seat = 1; seat <= 9; seat += 1) {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat }).success, true);
        assert.equal(game.getPlayerState('host').canConfirmRole, true);
        assert.equal(game.handleAction('host', { kind: 'confirmRole' }).success, true);
        if (seat === 1) {
            assert.equal(game.handleAction('host', { kind: 'confirmRole' }).success, false);
            assert.equal(game.getPublicState().phaseProgress.completed, 1);
        }
        if (seat < 9) assert.equal(game.phase, 'roleReveal');
    }
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.day, 1);
    assert.equal(game.getPublicState().nextPhaseName, '狼人请睁眼');
    assert.deepEqual(game.getPublicState().phaseProgress, { completed: 0, total: 1, label: '夜幕之中' });
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('guard') });
    assert.equal(game.getPlayerState('host').skillState.available, true);
    assert.equal(game.getPlayerState('host').legalTargetSeats.length, 9);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: seatFor('seer') }).success, true);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.getPublicState().phaseInstruction, '狼人请睁眼，共同决定今夜的袭击目标。其他玩家请保持安静。');
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: goodTarget }).success, false);
    for (const [index, wolfSeat] of wolfSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        if (index === 0) assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: wolfSeats[1] }).success, false);
        const voteTarget = index === wolfSeats.length - 1 ? dissentTarget : goodTarget;
        const vote = confirmedWerewolfNightAction(game, 'host', { targetSeat: voteTarget });
        assert.equal(vote.success, true);
        assert.equal(game.getPlayerState('host').wolfVote.myTarget, voteTarget);
        if (index === 0) assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: dissentTarget }).success, false);
        if (index < wolfSeats.length - 1) {
            assert.equal(game.night.wolfResolved, undefined);
            assert.equal(game.phase, 'nightWolf');
        }
    }
    assert.equal(game.night.wolfResolved, true);
    assert.equal(game.night.wolf, goodTarget);
    assert.equal(game.phase, 'nightSeer');
    for (const wolfSeat of wolfSeats) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        assert.equal(game.getPlayerState('host').wolfVote.resultTarget, goodTarget);
        assert.equal(game.getPlayerState('host').wolfVote.noKill, false);
    }
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('seer') });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: seatFor('werewolf') }).success, true);
    assert.equal(game.phase, 'nightWitch');
    assert.equal(game.getPlayerState('host').seerResult.faction, 'wolf');
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('witch') });
    assert.equal(game.getPlayerState('host').wolfSeat, goodTarget);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'save', targetSeat: goodTarget }).success, true);
    assert.equal(game.phase, 'day');
    assert.equal(game.seats.find(seat => seat.number === goodTarget).alive, true);

    const aliveSeats = game.seats.filter(seat => seat.alive).map(seat => seat.number);
    for (const [index, seat] of aliveSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        assert.equal(game.handleAction('host', { kind: 'confirmDay' }).success, true);
        if (index < aliveSeats.length - 1) assert.equal(game.phase, 'day');
    }
    assert.equal(game.phase, 'vote');
    assert.equal(game.handleAction('host', { kind: 'resolveVote' }).success, false);
    for (const [index, seat] of aliveSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: goodTarget }).success, true);
        if (index < aliveSeats.length - 1) assert.equal(game.phase, 'vote');
    }
    assert.equal(game.seats.find(seat => seat.number === goodTarget).alive, false);
    assert.equal(game.phase, 'deathResolution');
    assert.equal(game.getPublicState().phaseName, '离场时刻');
    game.handleAction('host', { kind: 'switchSeat', seat: goodTarget });
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPlayerState('host').canStartLastWords, true);
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.day, 2);
});

test('Werewolf retries a tied wolf attack once, then treats a second tie as no kill', () => {
    const game = new WerewolfEngine('werewolf-wolf-tie', players(['host']), 'host', () => 0);
    game.start();
    for (let seat = 1; seat <= 9; seat += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        game.handleAction('host', { kind: 'confirmRole' });
    }
    const guardSeat = game.seats.find(seat => seat.role === 'guard').number;
    game.handleAction('host', { kind: 'switchSeat', seat: guardSeat });
    confirmedWerewolfNightAction(game, 'host', { targetSeat: guardSeat });
    assert.equal(game.phase, 'nightWolf');

    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);
    const goodTargets = game.seats.filter(seat => seat.role !== 'werewolf').slice(0, wolfSeats.length).map(seat => seat.number);
    const castTiedRound = () => wolfSeats.map((wolfSeat, index) => {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat }).success, true);
        return confirmedWerewolfNightAction(game, 'host', { targetSeat: goodTargets[index] });
    });

    assert.equal(castTiedRound().every(result => result.success), true);
    assert.equal(game.night.wolfVoteRound, 2);
    assert.deepEqual(game.night.wolfVotes, {});
    assert.deepEqual(game.night.wolfTieTargets.sort((left, right) => left - right), goodTargets.slice().sort((left, right) => left - right));
    assert.equal(game.night.wolfResolved, undefined);

    assert.equal(castTiedRound().every(result => result.success), true);
    assert.equal(game.night.wolfVoteRound, 2);
    assert.equal(game.night.wolfResolved, true);
    assert.equal(game.night.wolf, null);
    assert.equal(game.getPlayerState('host').wolfVote.noKill, true);
    assert.equal(game.getPlayerState('host').wolfVote.resultTarget, null);
    assert.equal(game.phase, 'nightSeer');
});

test('Werewolf hides wolf-vote messages and state from non-wolves and dead wolves', () => {
    const game = new WerewolfEngine('werewolf-wolf-privacy', players(['wolf-user', 'good-user']), 'wolf-user', () => 0);
    game.start();
    const wolfSeat = game.seats.find(seat => seat.role === 'werewolf');
    const goodSeat = game.seats.find(seat => seat.role !== 'werewolf' && seat.controllerId !== wolfSeat.controllerId);
    const wolfUser = wolfSeat.controllerId;
    const goodUser = goodSeat.controllerId;
    game.activeSeat[wolfUser] = wolfSeat.number;
    game.activeSeat[goodUser] = goodSeat.number;
    game.phase = 'nightWolf';
    const action = confirmedWerewolfNightAction(game, wolfUser, { targetSeat: goodSeat.number });
    assert.equal(action.success, true);
    assert.match(game.getPlayerAction(action, wolfUser).message, /袭击选择已藏入夜色/);
    assert.equal(game.getPlayerAction(action, goodUser).message, '');
    assert.equal(game.getPlayerState(goodUser).wolfVote, null);
    assert.deepEqual(game.getPlayerState(goodUser).phaseProgress, { completed: 0, total: 1, label: '夜幕之中' });
    assert.equal(game.getPlayerState(wolfUser).phaseProgress.total, 3);
    wolfSeat.alive = false;
    assert.equal(game.getPlayerState(wolfUser).wolfVote, null);
});

test('Werewolf keeps the fixed night order when a hidden role is dead', () => {
    const game = new WerewolfEngine('werewolf-dead-night-role', players(['host']), 'host', () => 0);
    game.start();
    const guard = game.seats.find(seat => seat.role === 'guard');
    const seer = game.seats.find(seat => seat.role === 'seer');
    guard.alive = false;
    seer.alive = false;
    for (let seat = 1; seat <= 9; seat += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        game.handleAction('host', { kind: 'confirmRole' });
    }
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().nextPhaseName, '狼人请睁眼');
    game.handleAction('host', { kind: 'switchSeat', seat: guard.number });
    assert.equal(game.getPlayerState('host').canConfirmDeadRole, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeadRole' }).success, true);
    assert.equal(game.phase, 'nightWolf');
    const wolves = game.seats.filter(seat => seat.alive && seat.role === 'werewolf');
    const target = game.seats.find(seat => seat.alive && seat.role !== 'werewolf').number;
    for (const wolf of wolves) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
        confirmedWerewolfNightAction(game, 'host', { targetSeat: target });
    }
    assert.equal(game.phase, 'nightSeer');
    game.handleAction('host', { kind: 'switchSeat', seat: seer.number });
    assert.equal(game.getPlayerState('host').canConfirmDeadRole, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeadRole' }).success, true);
    assert.equal(game.phase, 'nightWitch');
});

test('Werewolf uses the same private death resolution for ordinary, hunter, and poisoned-hunter deaths', () => {
    const ordinary = new WerewolfEngine('werewolf-ordinary-death', players(['host']), 'host', () => 0);
    ordinary.start();
    const villager = ordinary.seats.find(seat => seat.role === 'villager');
    ordinary.phase = 'vote';
    ordinary.day = 1;
    let ordinaryVote;
    for (const seat of ordinary.seats) {
        ordinary.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        ordinaryVote = ordinary.handleAction('host', { kind: 'vote', targetSeat: villager.number });
        assert.equal(ordinaryVote.success, true);
    }
    const ordinaryPublic = ordinary.getPublicState();
    assert.equal(ordinary.phase, 'deathResolution');
    assert.equal(ordinaryPublic.phaseName, '离场时刻');
    assert.equal(ordinaryPublic.pendingHunter, undefined);
    assert.doesNotMatch(JSON.stringify(ordinaryPublic), /猎人/);
    assert.doesNotMatch(ordinaryVote.message, /猎人|技能/);
    ordinary.handleAction('host', { kind: 'switchSeat', seat: villager.number });
    const ordinaryPrivate = ordinary.getPlayerState('host');
    assert.equal(ordinaryPrivate.canConfirmDeathResolution, true);
    assert.equal(ordinaryPrivate.hunterAction, null);
    assert.deepEqual(ordinaryPrivate.eliminationNotice, { day: 1, seat: villager.number, source: 'day' });
    assert.equal(ordinaryPublic.eliminationNotice, undefined, '个人出局提示不能进入公开状态');
    assert.equal(ordinary.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(ordinary.phase, 'lastWords', '出局私密结算后自动进入遗言');
    assert.equal(ordinary.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(ordinary.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(ordinary.phase, 'nightGuard', '普通玩家完成遗言后不会卡住');

    const game = new WerewolfEngine('werewolf-hunter', players(['host']), 'host', () => 0);
    game.start();
    const hunter = game.seats.find(seat => seat.role === 'hunter');
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    game.phase = 'vote';
    game.day = 1;
    let hunterVote;
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        hunterVote = game.handleAction('host', { kind: 'vote', targetSeat: hunter.number });
        assert.equal(hunterVote.success, true);
    }
    assert.equal(game.phase, 'deathResolution');
    assert.equal(hunter.alive, false);
    const hunterPublic = game.getPublicState();
    assert.deepEqual(
        { phase: hunterPublic.phase, phaseName: hunterPublic.phaseName, nextPhaseName: hunterPublic.nextPhaseName, phaseProgress: hunterPublic.phaseProgress, phaseInstruction: hunterPublic.phaseInstruction },
        { phase: ordinaryPublic.phase, phaseName: ordinaryPublic.phaseName, nextPhaseName: ordinaryPublic.nextPhaseName, phaseProgress: ordinaryPublic.phaseProgress, phaseInstruction: ordinaryPublic.phaseInstruction },
        '猎人与普通玩家出局的公开阶段信息必须一致',
    );
    assert.doesNotMatch(JSON.stringify(hunterPublic), /猎人/);
    assert.doesNotMatch(hunterVote.message, /猎人|技能/);
    const bystander = game.seats.find(seat => seat.number !== hunter.number);
    game.handleAction('host', { kind: 'switchSeat', seat: bystander.number });
    assert.equal(game.getPlayerState('host').hunterAction, null);
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, false);
    assert.equal(game.getPlayerState('host').eliminationNotice, null);
    game.handleAction('host', { kind: 'switchSeat', seat: hunter.number });
    assert.equal(game.getPlayerState('host').hunterAction.available, true);
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, false);
    assert.equal(game.handleAction('host', { kind: 'hunterAction', choice: 'shoot', targetSeat: wolf.number }).success, true);
    assert.equal(wolf.alive, false);
    assert.equal(game.phase, 'deathResolution');
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    for (const seatNumber of [hunter.number, wolf.number]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
        assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    }
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.day, 2);

    const poisoned = new WerewolfEngine('werewolf-poisoned-hunter', players(['host']), 'host', () => 0);
    poisoned.start();
    const poisonedHunter = poisoned.seats.find(seat => seat.role === 'hunter');
    const witch = poisoned.seats.find(seat => seat.role === 'witch');
    poisoned.phase = 'nightWitch';
    poisoned.day = 1;
    poisoned.night = {};
    poisoned.handleAction('host', { kind: 'switchSeat', seat: witch.number });
    assert.equal(confirmedWerewolfNightAction(poisoned, 'host', { choice: 'poison', targetSeat: poisonedHunter.number }).success, true);
    assert.equal(poisonedHunter.alive, false);
    assert.equal(poisoned.pendingHunter, null);
    assert.equal(poisoned.phase, 'deathResolution');
    poisoned.handleAction('host', { kind: 'switchSeat', seat: poisonedHunter.number });
    assert.equal(poisoned.getPlayerState('host').hunterAction, null);
    assert.equal(poisoned.getPlayerState('host').canConfirmDeathResolution, true);
    assert.deepEqual(poisoned.getPlayerState('host').eliminationNotice, { day: 1, seat: poisonedHunter.number, source: 'night' });
    assert.equal(poisoned.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(poisoned.phase, 'lastWords');
    assert.equal(poisoned.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(poisoned.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(poisoned.phase, 'day');
});

test('Werewolf announces night deaths, times ordered speeches, and retains complete public vote history', () => {
    let now = 1_700_000_000_000;
    const game = new WerewolfEngine('werewolf-day-flow', players(['host']), 'host', () => 0, () => now);
    game.start();
    const firstVictim = game.seats.find(seat => seat.role === 'villager');
    const secondVictim = game.seats.find(seat => seat.role === 'villager' && seat.number !== firstVictim.number);
    const witch = game.seats.find(seat => seat.role === 'witch');
    game.day = 1;
    game.phase = 'nightWitch';
    game.night = { wolf: firstVictim.number };
    game.handleAction('host', { kind: 'switchSeat', seat: witch.number });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);

    let publicState = game.getPublicState();
    assert.equal(game.phase, 'deathResolution');
    assert.deepEqual(publicState.announcement.deaths, [firstVictim.number]);
    assert.equal(publicState.announcement.peaceful, false);
    assert.match(publicState.announcement.text, new RegExp(`${firstVictim.number} 号倒牌`));
    assert.deepEqual(publicState.announcementHistory.map(item => item.day), [1]);

    game.handleAction('host', { kind: 'switchSeat', seat: firstVictim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    publicState = game.getPublicState();
    assert.deepEqual(publicState.lastWordsFlow.order, [firstVictim.number]);
    assert.equal(publicState.lastWordsFlow.currentSeat, firstVictim.number);
    assert.equal(publicState.lastWordsFlow.status, 'waiting');
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    publicState = game.getPublicState();
    assert.equal(publicState.lastWordsFlow.deadlineAt, now + 60_000);
    assert.equal(publicState.lastWordsFlow.remainingSeconds, 60);
    now += 59_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPublicState().lastWordsFlow.remainingSeconds, 1);
    now += 1_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.phase, 'day');

    publicState = game.getPublicState();
    const aliveSeats = game.seats.filter(seat => seat.alive).map(seat => seat.number).sort((left, right) => left - right);
    assert.equal(publicState.speechFlow.startSeat, aliveSeats[0]);
    assert.equal(publicState.speechFlow.direction, 'clockwise');
    assert.deepEqual(publicState.speechFlow.order, aliveSeats);
    assert.equal(new Set(publicState.speechFlow.order).size, aliveSeats.length);
    game.handleAction('host', { kind: 'switchSeat', seat: aliveSeats[1] });
    assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, false, '不能跳过系统指定的当前发言者');
    game.handleAction('host', { kind: 'switchSeat', seat: aliveSeats[0] });
    assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, true);
    const firstSpeechDeadline = now + 90_000;
    assert.equal(game.getPublicState().speechFlow.deadlineAt, firstSpeechDeadline);
    now += 10_000;
    assert.equal(game.handlePlayerDisconnect('host').success, true);
    assert.equal(game.getPublicState().speechFlow.remainingSeconds, 80);
    now += 300_000;
    assert.equal(game.getPublicState().speechFlow.remainingSeconds, 80, '断线暂停期间倒计时应冻结');
    assert.equal(game.handlePlayerReconnect('host').success, true);
    assert.equal(game.getPublicState().speechFlow.deadlineAt, firstSpeechDeadline + 300_000);
    now += 80_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.getPublicState().speechFlow.currentSeat, aliveSeats[1]);
    for (const [index, seatNumber] of publicState.speechFlow.order.slice(1).entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.getPlayerState('host').canStartSpeech, true);
        assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, true);
        assert.equal(game.getPublicState().speechFlow.deadlineAt, now + 90_000);
        if (index === 0) now += 90_000;
        assert.equal(game.handleAction('host', { kind: 'finishSpeech' }).success, true);
    }
    assert.equal(game.phase, 'vote');

    const voters = game.seats.filter(seat => seat.alive).map(seat => seat.number);
    for (const seatNumber of voters) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: secondVictim.number }).success, true);
    }
    publicState = game.getPublicState();
    assert.equal(publicState.lastVoteResult.day, 1);
    assert.equal(publicState.lastVoteResult.exiledSeat, secondVictim.number);
    assert.equal(publicState.lastVoteResult.tied, false);
    assert.equal(publicState.lastVoteResult.ballots.length, voters.length);
    assert.deepEqual(publicState.lastVoteResult.ballots.map(ballot => ballot.voterSeat), voters);
    assert.equal(publicState.lastVoteResult.counts[secondVictim.number], voters.length);
    assert.equal(publicState.voteHistory.length, 1);

    game.handleAction('host', { kind: 'switchSeat', seat: secondVictim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().voteHistory[0].exiledSeat, secondVictim.number, '进入下一夜后完整票型仍保留');
});

test('Werewolf wraps counterclockwise speech order and records a tied public ballot', () => {
    const game = new WerewolfEngine('werewolf-day-order-tie', players(['host']), 'host', () => 0);
    game.start();
    game.day = 1;
    game.random = () => 0.75;
    game._beginDaySpeech();
    assert.equal(game.getPublicState().speechFlow.startSeat, 7);
    assert.equal(game.getPublicState().speechFlow.directionName, '逆时针');
    assert.deepEqual(game.getPublicState().speechFlow.order, [7, 6, 5, 4, 3, 2, 1, 9, 8]);

    game.phase = 'vote';
    game.votes = {};
    game.seats.find(seat => seat.number === 9).alive = false;
    const targets = [1, 2, 3];
    for (let seatNumber = 1; seatNumber <= 8; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        const targetSeat = seatNumber <= 4 ? targets[0] : seatNumber <= 8 ? targets[1] : targets[2];
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat }).success, true);
    }
    const result = game.getPublicState().lastVoteResult;
    assert.equal(result.tied, true);
    assert.equal(result.exiledSeat, null);
    assert.deepEqual(result.topSeats, [1, 2]);
    assert.deepEqual(result.counts, { 1: 4, 2: 4 });
    assert.equal(result.ballots.length, 8);
    assert.equal(game.phase, 'vote');
    for (let seatNumber = 1; seatNumber <= 8; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: seatNumber % 2 ? 1 : 2 }).success, true);
    }
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().lastVoteResult.tied, true);
    assert.equal(game.getPublicState().voteHistory.length, 2);
});

test('Werewolf runs a private first-day sheriff election and applies the 1.5 vote weight', () => {
    const game = new WerewolfEngine('werewolf-sheriff-election', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    game.day = 1;
    game._beginDayAgenda();
    assert.equal(game.phase, 'sheriffSignup');
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 2 ? 'run' : 'skip' }).success, true);
        if (seatNumber < 9) assert.deepEqual(game.getPublicState().sheriff.candidates, [], '报名结束前不能公开候选人');
    }
    assert.equal(game.phase, 'sheriffCampaign');
    assert.deepEqual(game.getPublicState().sheriff.candidates, [1, 2]);
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' }).success, true);
    }
    assert.equal(game.phase, 'sheriffVote');
    for (let seatNumber = 3; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat: 1 }).success, true);
    }
    assert.equal(game.phase, 'day');
    assert.equal(game.sheriff.holderSeat, 1);
    assert.equal(game.getPublicState().seats.find(seat => seat.number === 1).isSheriff, true);

    game.phase = 'vote';
    game.votes = {};
    const ordinaryTargets = [3, 4, 5, 6, 7, 8, 9, 1];
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        const targetSeat = seatNumber === 1 ? 2 : ordinaryTargets[seatNumber - 2];
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat }).success, true);
    }
    assert.equal(game.getPublicState().lastVoteResult.exiledSeat, 2);
    assert.equal(game.getPublicState().lastVoteResult.counts[2], 1.5);
    assert.equal(game.getPublicState().lastVoteResult.ballots.find(ballot => ballot.voterSeat === 1).weight, 1.5);
});

test('Werewolf sheriff runoff ends without a sheriff after a second tie', () => {
    const game = new WerewolfEngine('werewolf-sheriff-runoff', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start(); game.day = 1; game._beginDayAgenda();
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 2 ? 'run' : 'skip' });
    }
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' });
    }
    const castTie = () => {
        for (let seatNumber = 3; seatNumber <= 9; seatNumber += 1) {
            game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
            const targetSeat = seatNumber <= 5 ? 1 : seatNumber <= 8 ? 2 : null;
            assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat }).success, true);
        }
    };
    castTie();
    assert.equal(game.phase, 'sheriffRunoffSpeech');
    assert.deepEqual(game.sheriff.runoffCandidates, [1, 2]);
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffRunoffSpeech' }).success, true);
    }
    assert.equal(game.phase, 'sheriffRunoffVote');
    castTie();
    assert.equal(game.phase, 'day');
    assert.equal(game.sheriff.holderSeat, null);
    assert.equal(game.sheriff.status, 'none');
    assert.equal(game.getPublicState().sheriff.results.length, 2);
});

test('Werewolf privately transfers or tears the badge when the sheriff dies', () => {
    const game = new WerewolfEngine('werewolf-sheriff-badge', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    const sheriff = game.seats.find(seat => seat.role === 'villager');
    const receiver = game.seats.find(seat => seat.number !== sheriff.number);
    game.sheriff.status = 'elected';
    game.sheriff.holderSeat = sheriff.number;
    game.phase = 'vote'; game.day = 1;
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        game.handleAction('host', { kind: 'vote', targetSeat: sheriff.number });
    }
    assert.equal(game.phase, 'deathResolution');
    game.handleAction('host', { kind: 'switchSeat', seat: sheriff.number });
    const privateState = game.getPlayerState('host');
    assert.equal(privateState.canConfirmDeathResolution, false);
    assert.equal(privateState.sheriffBadgeAction.available, true);
    assert.equal(game.handleAction('host', { kind: 'sheriffBadgeAction', choice: 'transfer', targetSeat: receiver.number }).success, true);
    assert.equal(game.sheriff.holderSeat, receiver.number);
    assert.equal(game.getPublicState().seats.find(seat => seat.number === receiver.number).isSheriff, true);
});

test('Werewolf does not deadlock when an isolated sheriff is auto-torn with no receiver', () => {
    const game = new WerewolfEngine('werewolf-sheriff-autotear', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    const sheriff = game.seats.find(seat => seat.role === 'villager');
    game.seats.forEach(seat => { seat.alive = seat.number === sheriff.number; });
    game.sheriff.status = 'elected';
    game.sheriff.holderSeat = sheriff.number;
    sheriff.alive = false;
    game._beginDeathResolution([sheriff.number], 'night');
    assert.equal(game.status, 'ended');
    assert.equal(game.phase, 'ended');
    assert.equal(game.pendingBadge, null);
});

test('Werewolf stores typed last words and server ticks timed turns', () => {
    let now = 1_700_000_000_000;
    const game = new WerewolfEngine('werewolf-tick-text', players(['host']), 'host', () => 0, () => now);
    game.start();
    const dead = game.seats.find(seat => seat.role === 'villager');
    dead.alive = false;
    game.phase = 'lastWords';
    game.lastWordsFlow = { day: 1, after: 'night', order: [dead.number], currentIndex: 0, completedSeats: {}, turn: null, durationSeconds: 60 };
    game.handleAction('host', { kind: 'switchSeat', seat: dead.number });
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    now += 60_000;
    assert.equal(game.handleSystemTick().success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.lastWordsHistory[0].text, '');

    game.phase = 'lastWords';
    game.lastWordsFlow = { day: 1, after: 'night', order: [dead.number], currentIndex: 0, completedSeats: {}, turn: null, durationSeconds: 60 };
    game.handleAction('host', { kind: 'startLastWords' });
    assert.equal(game.handleAction('host', { kind: 'finishLastWords', text: '我昨晚查验了 3 号。' }).success, true);
    assert.equal(game.lastWordsHistory.at(-1).text, '我昨晚查验了 3 号。');
});

test('Werewolf session uses the nine-player edge win condition', () => {
    const session = Werewolf.create('werewolf-edge-condition', players(['host']), 'host');
    session.start();
    const game = session.engine;
    const wolves = game.seats.filter(seat => seat.role === 'werewolf');
    const villager = game.seats.find(seat => seat.role === 'villager');
    const gods = game.seats.filter(seat => !['werewolf', 'villager'].includes(seat.role)).slice(0, 2);
    game.seats.forEach(seat => { seat.alive = wolves.includes(seat) || seat === villager || gods.includes(seat); });
    game._checkWinner();
    assert.equal(game.status, 'playing', '仍有平民和神职时不应按人数相等提前判狼胜');
    villager.alive = false;
    game._checkWinner();
    assert.equal(game.winner.faction, 'wolf');
});

test('Werewolf pauses on a transient disconnect and resumes the same controller safely', () => {
    const game = new WerewolfEngine('werewolf-offline', players(['a', 'b']), 'a', () => 0);
    game.start();
    assert.equal(game.handlePlayerDisconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, true);
    assert.ok(game.getPublicState().offlineSeats.length > 0);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, false);
    assert.equal(game.phase, 'roleReveal');
    assert.equal(game.handlePlayerReconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.deepEqual(game.getPublicState().offlineSeats, []);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, true);
});

test('Werewolf permanently leaving controller hands its seats to online devices', () => {
    const game = new WerewolfEngine('werewolf-controller-takeover', players(['a', 'b', 'c']), 'a', () => 0);
    game.start();
    const abandonedSeats = game.seats.filter(seat => seat.controllerId === 'b').map(seat => seat.number);
    assert.ok(abandonedSeats.length > 0);
    game.handlePlayerDisconnect('b');
    assert.equal(game.getPublicState().flowPaused, true);
    assert.equal(game.handlePlayerLeave('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.deepEqual(game.getPublicState().offlineSeats, []);
    assert.ok(game.seats.every(seat => seat.controllerId !== 'b'));
    assert.ok(abandonedSeats.every(number => ['a', 'c'].includes(game._seat(number).controllerId)));
    const adoptedSeat = game._seat(abandonedSeats[0]);
    assert.equal(game.handleAction(adoptedSeat.controllerId, { kind: 'switchSeat', seat: adoptedSeat.number }).success, true);
    assert.equal(game.handleAction(adoptedSeat.controllerId, { kind: 'confirmRole' }).success, true);
});

test('Werewolf assigns orphaned seats when another paused controller reconnects', () => {
    const game = new WerewolfEngine('werewolf-delayed-takeover', players(['a', 'b']), 'a', () => 0);
    game.start();
    game.handlePlayerDisconnect('a');
    game.handlePlayerDisconnect('b');
    assert.equal(game.handlePlayerLeave('a').success, true);
    assert.equal(game.getPublicState().flowPaused, true);
    assert.equal(game.handlePlayerReconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.ok(game.seats.every(seat => seat.controllerId === 'b'));
});

test('Werewolf WebSocket lifecycle wires transient disconnect and resume hooks', () => {
    const appSource = fs.readFileSync('app.js', 'utf8');
    const session = Werewolf.create('werewolf-reconnect-adapter', players(['a', 'b']), 'a');
    assert.equal(session.start().success, true);
    assert.equal(typeof session.handlePlayerDisconnect, 'function');
    assert.equal(typeof session.handlePlayerReconnect, 'function');
    assert.match(appSource, /markPlayerDisconnected\(player\.id\)/);
    assert.match(appSource, /handlePlayerReconnect\?\.\(player\.id\)/);
    session.handlePlayerDisconnect('b');
    assert.equal(session.getPlayerState('a').flowPaused, true);
    session.handlePlayerReconnect('b');
    assert.equal(session.getPlayerState('a').flowPaused, false);
});

test('Werewolf client uses player-facing copy, matching role art, and disposes click listeners', () => {
    const client = fs.readFileSync('public/games/werewolf/client.js', 'utf8');
    const style = fs.readFileSync('public/games/werewolf/style.css', 'utf8');
    assert.match(client, /werewolf: \{ name: '狼人', image: 'langr\.png'/);
    assert.match(client, /hunter: \{ name: '猎人', image: 'lr\.png'/);
    assert.match(client, /guard: \{ name: '守卫', image: 'sw\.png'/);
    assert.match(client, /new AbortController\(\)/);
    assert.match(client, /controller\.abort\(\)/);
    assert.match(client, /天黑请闭眼/);
    assert.match(client, /天亮了/);
    assert.match(client, /maybePlayTransition/);
    assert.match(client, /speechSynthesis/);
    assert.match(client, /transitionGlyphs/);
    assert.match(client, /showPersonalElimination/);
    assert.match(client, /您已出局/);
    assert.match(client, /showTransition\('day', next\.announcement, newPersonalElimination \? showPersonalElimination : null\)/);
    assert.doesNotMatch(client, /ww-transition-card|skipTransition/);
    assert.match(client, /confirmAllRolesForTest/);
    assert.match(client, /pendingSeats\.forEach/);
    assert.match(client, /testRoleBySeat/);
    assert.match(client, /state\.testMode \? '测试席位' : '玩家席位'/);
    assert.match(client, /\$\('seatTools'\)\?\.classList\.toggle\('is-hidden', !state\.testMode\)/);
    assert.match(client, /你的秘密界面/);
    assert.match(client, /游戏纪事/);
    assert.doesNotMatch(client, /玩家设备视角|选择可控制的座位|私密出局结算|系统记录|自动流程助手/);
    assert.match(client, /stageNightAction/);
    assert.match(client, /confirmNightAction/);
    assert.match(client, /confirmSeerResult/);
    assert.match(style, /\.ww-transition\.is-peaceful \.ww-transition-result/);
    assert.match(style, /\.ww-transition\.is-danger \.ww-transition-result \{[\s\S]*font: 600 clamp\(38px, 8vw, 78px\)/);
    assert.match(style, /\.ww-transition-title,\s*\.ww-transition-result \{[\s\S]*grid-area: 1 \/ 1;/);
    assert.match(style, /\.ww-transition-shard::after/);
    assert.match(style, /\.ww-elimination\.is-shattering \.ww-elimination-fragments i/);
    assert.match(style, /@keyframes wwEliminationFragment/);
    assert.match(client, /data-stage-night-choice="save"/);
    assert.match(client, /data-stage-night-choice="pass"/);
    assert.doesNotMatch(client, /data-open-skill="witch-(?:save|pass)"/);
    assert.doesNotMatch(client, /\$\('\[data-role=/, '角色查询辅助函数不能接收完整 CSS 选择器');
    assert.match(client, /data-role="targetModal"/);
    assert.match(client, /data-role="currentPhase"/);
    assert.match(client, /data-role="nextPhase"/);
    assert.match(client, /data-role="phaseProgress"/);
    assert.match(client, /data-role-hold/);
    assert.match(client, /data-role-secret/);
    assert.match(client, /setRoleIdentityVisible\(true\)/);
    assert.match(client, /addEventListener\('pointerdown'/);
    assert.match(client, /addEventListener\('pointermove'/);
    assert.match(client, /addEventListener\('pointerout'/);
    assert.match(client, /addEventListener\('pointercancel'/);
    assert.match(client, /addEventListener\('keyup'/);
    assert.match(client, /addEventListener\('blur'/);
    assert.match(client, /document\.hidden/);
    assert.match(client, /event\.key !== ' ' && event\.key !== 'Enter'/);
    assert.match(client, /data-action="confirmRole"/);
    assert.match(client, /data-action="confirmDeadRole"/);
    assert.match(client, /data-action="confirmDeathResolution"/);
    assert.match(client, /data-action="confirmDay"/);
    assert.match(client, /<small>此刻<\/small>/);
    assert.match(client, /<small>接下来<\/small>/);
    assert.match(client, /行动完成后继续/);
    assert.match(client, /data-open-skill="guard"/);
    assert.match(client, /data-open-skill="wolf"/);
    assert.match(client, /data-open-skill="hunter-shoot"/);
    assert.match(client, /phase === 'deathResolution'/);
    assert.doesNotMatch(client, /phase === 'hunter'/);
    assert.match(client, /选择袭击目标/);
    assert.match(client, /state\.wolfVote/);
    assert.match(client, /data-modal-target/);
    assert.match(client, /确定选择/);
    assert.doesNotMatch(client, /data-night-target/, '夜间技能不应继续直接铺开目标按钮');
    assert.match(client, /无需主持人/);
    assert.doesNotMatch(client, /主持人推进|主持人操作/);
    assert.doesNotMatch(client, /data-action="nextPhase"/);
    assert.doesNotMatch(client, /data-action="resolveVote"/);
    assert.doesNotMatch(client, /state\.isHost/);
});

test('Werewolf lobby requires host room configuration before listing and starting', () => {
    const appServer = fs.readFileSync('app.js', 'utf8');
    const room = fs.readFileSync('server/room.js', 'utf8');
    const lobby = fs.readFileSync('public/script.js', 'utf8');
    assert.match(appServer, /case 'configureRoom'/);
    assert.match(appServer, /filter\(room => room\.isListed\(\)\)/);
    assert.match(room, /playerCounts/);
    assert.match(room, /configurationConfirmed/);
    assert.match(room, /this\.targetPlayers && connectedPlayers\.length !== this\.targetPlayers/);
    assert.match(lobby, /data-room-player-count/);
    assert.match(lobby, /data-confirm-room-configuration/);
    assert.match(lobby, /type: 'configureRoom'/);
    assert.match(lobby, /9 \/ 12 人/);
});

test('Waiting room exposes host moderation, member readiness, and metadata-driven settings', () => {
    const appServer = fs.readFileSync('app.js', 'utf8');
    const room = fs.readFileSync('server/room.js', 'utf8');
    const lobby = fs.readFileSync('public/script.js', 'utf8');
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
    assert.match(lobby, /房主无需准备/);
    assert.match(room, /player\.id === this\.hostId\) return \{ success: false, message: '房主无需准备'/);
    assert.match(lobby, /function renderSharedRoomSettings/);
    assert.match(lobby, /type: 'updateRoomSettings'/);
    assert.match(werewolf, /roomSettings/);
    assert.match(decrypto, /roomSettings/);
});

test('Lobby uses a two-step rule and settings dialog before sending room creation', () => {
    const appServer = fs.readFileSync('app.js', 'utf8');
    const lobby = fs.readFileSync('public/script.js', 'utf8');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const details = fs.readFileSync('public/game-details.js', 'utf8');
    assert.match(lobby, /openCreateRoomDialog\(card\.dataset\.gameType/);
    assert.match(lobby, /function showCreateRoomSettings/);
    assert.match(lobby, /function submitCreateRoom/);
    assert.match(lobby, /roomName,/);
    assert.match(lobby, /gameOptions\.encryptorMode/);
    assert.match(page, /id="createRoomRuleList"/);
    assert.match(page, /id="createRoomSpecialSettings"/);
    assert.match(details, /export const GAME_DETAILS/);
    assert.match(appServer, /roomName: data\.roomName/);
    assert.match(appServer, /seatLimit: data\.seatLimit/);
});

test('Lobby enters a themed pregame room, preloads one game, and exposes mobile open tables', () => {
    const lobby = fs.readFileSync('public/script.js', 'utf8');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = fs.readFileSync('public/style.css', 'utf8');
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
    assert.match(lobby, /尚未达到开局人数/);
    assert.match(lobby, /可以开始游戏了，请点击桌面魔法阵/);
    assert.doesNotMatch(lobby, /魔法阵已充能/);
    assert.match(lobby, /function preloadGameClient/);
    assert.match(lobby, /gameModulePromises/);
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
    const coverBlock = lobby.match(/const GAME_COVERS = \{([\s\S]*?)\n\};/)?.[1] || '';
    const coverNames = [...coverBlock.matchAll(/:\s*'\/assets\/covers\/([^']+)'/g)].map(match => match[1]);
    assert.equal(coverNames.length, 28);
    const thumbnailNames = new Set(fs.readdirSync('public/assets/covers/thumbs').filter(file => file.endsWith('.webp')));
    assert.equal(coverNames.every(name => thumbnailNames.has(name)), true, '注册游戏都应有对应大厅缩略图');
    for (const name of coverNames) assert.equal(thumbnailNames.has(name), true, `${name} 缺少大厅缩略图`);

    for (const file of fs.readdirSync('public/games', { withFileTypes: true })) {
        if (!file.isDirectory()) continue;
        const clientPath = `public/games/${file.name}/client.js`;
        if (!fs.existsSync(clientPath)) continue;
        const client = fs.readFileSync(clientPath, 'utf8');
        assert.doesNotMatch(client, /(?:style|link|choiceLink)\.href[^\n]*Date\.now/, `${clientPath} 不应为样式每次生成新缓存键`);
    }
});

test('The shared game shell owns navigation and mobile viewport behavior', () => {
    const lobby = fs.readFileSync('public/script.js', 'utf8');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = fs.readFileSync('public/style.css', 'utf8');
    const gameDirectories = fs.readdirSync('public/games', { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'common');

    assert.equal(gameDirectories.filter(entry => fs.existsSync(`public/games/${entry.name}/client.js`)).length, 28);
    assert.equal((page.match(/id="leaveRoomBtn"/g) || []).length, 1, '游戏视图只能有一个大厅返回入口');
    assert.match(page, /aria-label="离开本局并回到大厅"/);
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
    assert.match(lobby, /prepareGameEntryStreams/);
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
    const junqiClient = fs.readFileSync('public/games/junqi/client.js', 'utf8');
    const junqiStyle = fs.readFileSync('public/games/junqi/style.css', 'utf8');
    const xiangqiClient = fs.readFileSync('public/games/xiangqi/client.js', 'utf8');
    const xiangqiStyle = fs.readFileSync('public/games/xiangqi/style.css', 'utf8');
    const chessClient = fs.readFileSync('public/games/chess/client.js', 'utf8');
    const chessStyle = fs.readFileSync('public/games/chess/chess3d.css', 'utf8');
    const chessBridge = fs.readFileSync('public/games/chess/lobby-client.js', 'utf8');
    const chessFrame = fs.readFileSync('public/games/chess/room-frame.html', 'utf8');
    const monopolyClient = fs.readFileSync('public/games/monopoly/client.js', 'utf8');
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
    for (const game of games) {
        const client = fs.readFileSync(`public/games/${game}/client.js`, 'utf8');
        const styles = fs.readFileSync(`public/games/${game}/style.css`, 'utf8');
        assert.match(client, /20260826-mobile-games-3/, `${game} 应加载第三批资源版本`);
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
    const visualFixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');
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
    for (const game of games) {
        const client = fs.readFileSync(`public/games/${game}/client.js`, 'utf8');
        const styles = fs.readFileSync(`public/games/${game}/style.css`, 'utf8');
        assert.match(client, /20260826-mobile-games-4/, `${game} 应加载第四批资源版本`);
        assert.match(styles, /orientation:\s*landscape/, `${game} 应提供短边横屏布局`);
        assert.match(styles, /max-height:\s*520px/, `${game} 应按短边高度切换横屏操作台`);
        assert.match(styles, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/, `${game} 横屏根场景应扣除统一顶栏`);
        assert.match(styles, /overflow:\s*hidden/, `${game} 横屏当前决策不应依赖页面滚动`);
        assert.match(styles, /inset:\s*var\(--game-shell-offset/, `${game} 的规则或演出层不应盖住统一顶栏`);
    }

    const coupClient = fs.readFileSync('public/games/coup/client.js', 'utf8');
    const coupStyle = fs.readFileSync('public/games/coup/style.css', 'utf8');
    const dealStyle = fs.readFileSync('public/games/monopolydeal/style.css', 'utf8');
    const dealChoiceStyle = fs.readFileSync('public/games/monopolydeal/choice.css', 'utf8');
    const hanabiClient = fs.readFileSync('public/games/hanabi/client.js', 'utf8');
    const hanabiStyle = fs.readFileSync('public/games/hanabi/style.css', 'utf8');
    const visualFixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

    assert.match(coupClient, /is-challenge-decision/);
    assert.match(coupClient, /is-influence-decision/);
    assert.match(coupClient, /is-exchange-decision/);
    assert.match(coupStyle, /\.cp-app\.is-challenge-decision \.cp-command\s*\{\s*display:\s*none/);
    assert.match(dealStyle, /\.deal-hand\s*\{\s*order:\s*1/);
    assert.match(dealStyle, /\.deal-command\s*\{\s*order:\s*2/);
    assert.match(dealChoiceStyle, /orientation:\s*landscape/);
    assert.match(dealChoiceStyle, /inset:\s*var\(--game-shell-offset/);
    assert.match(hanabiClient, /is-clue-targeting/);
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
        werewolf: '20260827-hidden-role-focus-1',
        avalon: '20260827-hidden-role-focus-1',
        decrypto: '20260826-mobile-games-5',
        witchtown: '20260827-hidden-role-focus-1'
    };
    for (const game of games) {
        const client = fs.readFileSync(`public/games/${game}/client.js`, 'utf8');
        const styles = fs.readFileSync(`public/games/${game}/style.css`, 'utf8');
        assert.match(client, new RegExp(expectedAssetVersion[game]), `${game} 应加载当前资源版本`);
        assert.match(styles, /orientation:\s*landscape/, `${game} 应提供短边横屏布局`);
        assert.match(styles, /max-height:\s*520px/, `${game} 应按短边高度切换横屏操作台`);
        assert.match(styles, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/, `${game} 横屏根场景应扣除统一顶栏`);
        assert.match(styles, /overflow:\s*hidden/, `${game} 横屏核心场景不应依赖页面上下滚动`);
        assert.match(styles, /inset:\s*var\(--game-shell-offset/, `${game} 的规则或演出层不应藏到统一顶栏后面`);
    }

    const werewolfClient = fs.readFileSync('public/games/werewolf/client.js', 'utf8');
    const avalonClient = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    const decryptoClient = fs.readFileSync('public/games/decrypto/client.js', 'utf8');
    const witchtownClient = fs.readFileSync('public/games/witchtown/client.js', 'utf8');
    assert.match(werewolfClient, /dataset\.phase/);
    assert.match(avalonClient, /is-my-action/);
    assert.match(decryptoClient, /dataset\.phase/);
    assert.match(witchtownClient, /dataset\.phase/);

    const visualFixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');
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

test('Lobby starts from an explicit play-or-join gateway with a future account slot', () => {
    const app = fs.readFileSync('app.js', 'utf8');
    const lobby = fs.readFileSync('public/script.js', 'utf8');
    const page = fs.readFileSync('public/index.html', 'utf8');
    const styles = fs.readFileSync('public/style.css', 'utf8');
    assert.match(page, /<body class="is-entry-view">/);
    assert.match(page, /id="lobbyEntry"/);
    assert.match(page, /id="entryStartBtn"[^>]*>[\s\S]*?开始游戏/);
    assert.match(page, /id="entryJoinBtn"[^>]*>[\s\S]*?加入房间/);
    assert.match(page, /id="joinLobbyView"[^>]*hidden/);
    assert.match(page, /id="joinLobbyCodeInput"/);
    assert.match(page, /使用房间号进入游戏/);
    assert.match(page, /id="joinLobbyRoomList"/);
    assert.match(page, /id="joinLobbyGameFilter"/);
    assert.match(page, /data-auth-slot/);
    assert.match(page, /账号、密码与个人资料将在此处接入/);
    assert.match(lobby, /function enterGameCatalog/);
    assert.match(lobby, /function showJoinLobby/);
    assert.match(lobby, /function returnHomeFromBrand/);
    assert.match(lobby, /history\.replaceState\(null, '', location\.pathname\)/);
    assert.match(lobby, /showEntryGateway\(\{ replayAnimation: false, animateReturn: true \}\)/);
    assert.match(lobby, /function joinFromJoinLobby/);
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

test('Manila protects private shares and enforces the harbor master boat plan', () => {
    const game = new ManilaEngine('manila', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.getPlayerState('a').myShares.length, 2);
    assert.deepEqual(game.getPublicState().players.map(player => player.sharesCount), [2, 2, 2]);
    for (const id of ['a', 'b']) assert.equal(game.handleAction(id, { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'master');
    assert.equal(game.handleAction('a', { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] }).success, true);
    assert.equal(game.phase, 'placement');
});

test('Manila formalizes share purchase, player-count placement rounds, and voyage settlement', () => {
    const game = new ManilaEngine('manila-rules', players(['a', 'b', 'c']), () => 0);
    game.start();
    assert.equal(game.players.every(player => player.shares.length === 2), true);
    assert.equal(game.players[0].accomplices, 4);
    for (const id of ['a', 'b']) assert.equal(game.handleAction(id, { kind: 'pass' }).success, true);
    const master = game.harborMasterId;
    assert.equal(game.handleAction(master, { kind: 'skipShare' }).success, true);
    assert.equal(game.handleAction(master, { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] }).success, true);
    assert.equal(game.placementRounds, 4);
    assert.equal(game.locations.jade.length, 0);
    let guard = 0;
    while (game.phase !== 'auction' && guard++ < 100) {
        if (game.phase === 'placement') { const current = game.players[game.placementTurnIndex]; assert.equal(game.handleAction(current.id, { kind: 'passPlacement' }).success, true); }
        else if (game.phase === 'sailing') assert.equal(game.handleAction(game.harborMasterId, { kind: 'sailBoats', order: game.movementPlan.rolls.map(item => item.boatId) }).success, true);
    }
    assert.equal(game.phase, 'auction');
    assert.equal(game.market.人参 >= 0, true);
});

test('Manila only allows loaded-ware placements and pays loaded cargo profits on arrival', () => {
    const game = new ManilaEngine('manila-payout', players(['a', 'b', 'c', 'd']), () => 0);
    game.start(); game.handleAction('a', { kind: 'pass' }); game.handleAction('b', { kind: 'pass' }); game.handleAction('c', { kind: 'pass' }); const master = game.harborMasterId; game.handleAction(master, { kind: 'skipShare' }); game.handleAction(master, { kind: 'setBoats', boats: [{ good: '人参', start: 5 }, { good: '玉石', start: 2 }, { good: '丝绸', start: 2 }] });
    assert.equal(game.handleAction('b', { kind: 'placeAccomplice', location: '肉豆蔻' }).success, false);
    game.boats[0].fate = 'port'; game.boats[0].arrived = true; game.boats[0].position = 14; game.locations.ginseng = [{ playerId: 'b', fee: 2 }]; game.players[1].placed = [{ location: 'ginseng', fee: 2 }]; const before = game.players[1].cash;
    game.locations.port = [];
    game._settleVoyage();
    assert.equal(game.players[1].cash, before + 36);
    assert.equal(game.market.人参, 5);
});

test('Modern Art keeps hands private and resolves an auction', () => {
    const game = new ModernArtEngine('modernart', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.getPlayerState('a').myHand.length, 10);
    assert.equal(game.getPublicState().players[0].handCount, 10);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: 0, auctionType: 'open' }).success, true);
    for (const [id, amount] of [['b', 10], ['c', 12], ['a', 0], ['b', 0]]) assert.equal(game.handleAction(id, { kind: 'bid', amount }).success, true);
    assert.equal(game.players[2].collection.length, 1);
    assert.equal(game.players[0].cash, 112);
});

test('Modern Art fixed-price auctions require a price and sell to the first accepter', () => {
    const game = new ModernArtEngine('modernart-fixed', players(['a', 'b', 'c']), () => 0);
    game.start();
    const fixedIndex = game.players[0].hand.findIndex(card => card.auctionType === 'fixed');
    assert.notEqual(fixedIndex, -1);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: fixedIndex }).success, false);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: fixedIndex, amount: 20 }).success, true);
    assert.equal(game.handleAction('b', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.handleAction('c', { kind: 'bid', amount: 20 }).success, true);
    assert.equal(game.players[2].collection.length, 1);
    assert.equal(game.players[0].cash, 120);
});

test('Modern Art uses the official hand sizes and supports double auctions', () => {
    for (const [count, handSize] of [[3, 10], [4, 9], [5, 8]]) {
        const game = new ModernArtEngine(`modernart-size-${count}`, players(Array.from({ length: count }, (_, index) => String(index))), () => 0); game.start();
        assert.equal(game.players[0].hand.length, handSize); assert.equal(game.deck.length, 70 - count * handSize);
    }
    const game = new ModernArtEngine('modernart-double', players(['a', 'b', 'c']), () => 0); game.start();
    game.players[0].hand = [{ id: 'a1', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'double' }, { id: 'a2', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'sealed' }]; game.currentSellerIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: 0, secondCardIndex: 1 }).success, true);
    assert.equal(game.handleAction('b', { kind: 'bid', amount: 10 }).success, true);
    assert.equal(game.handleAction('c', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.players[1].collection.length, 2); assert.equal(game.roundSales.length, 2);
});

test('Modern Art completes all four rounds with five players', () => {
    const game = new ModernArtEngine('modernart-full-five', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    let steps = 0;
    while (game.status === 'playing' && steps++ < 2000) {
        if (game.phase === 'auction') {
            const seller = game.players[game.currentSellerIndex];
            const cardIndex = seller.hand.findIndex((card, index) => card.auctionType !== 'double' || seller.hand.some((other, otherIndex) => otherIndex !== index && other.artistId === card.artistId && other.auctionType !== 'double'));
            const chosenIndex = cardIndex < 0 ? 0 : cardIndex;
            const chosen = seller.hand[chosenIndex];
            const action = { kind: 'startAuction', cardIndex: chosenIndex };
            if (chosen.auctionType === 'double') {
                const secondIndex = seller.hand.findIndex((other, index) => index !== chosenIndex && other.artistId === chosen.artistId && other.auctionType !== 'double');
                if (secondIndex >= 0) action.secondCardIndex = secondIndex;
            }
            if (chosen.auctionType === 'fixed') action.amount = 1;
            assert.equal(game.handleAction(seller.id, action).success, true);
        } else if (game.phase === 'bidding') {
            const bidder = game.players[game.auction.currentBidderIndex];
            let amount;
            if (game.auction.type === 'fixed') amount = bidder.id === game.auction.sellerId ? 0 : game.auction.fixedPrice;
            else if (game.auction.type === 'sealed') amount = 1;
            else amount = game.auction.highestBid === 0 ? 1 : 0;
            assert.equal(game.handleAction(bidder.id, { kind: 'bid', amount }).success, true);
        }
    }
    assert.equal(game.status, 'ended');
    assert.equal(game.round, 4);
    assert.ok(game.winner);
    assert.ok(steps < 2000);
});

test('Camel Up moves stacked camels and gives each player a private bet view', () => {
    const game = new CamelUpEngine('camelup', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.deepEqual(game.players.map(player => player.raceCards.length), [5, 5, 5]);
    game._moveCamel('red', 2); game._moveCamel('blue', 2);
    assert.equal(game._ranking()[0].id, 'white');
    assert.equal(game.handleAction('a', { kind: 'betOverall', cardId: game.players[0].raceCards.find(card => card.camelId === 'red').id }).success, true);
    assert.equal(game.getPlayerState('a').myOverallBet.camelId, 'red');
    assert.equal(game.getPublicState().players[0].hasOverallBet, true);
    assert.equal(Object.prototype.hasOwnProperty.call(game.getPublicState().players[0], 'raceCards'), false);
    assert.equal(game.handleAction('a', { kind: 'betOverall', cardId: 'finish-a-red' }).success, false, '同一张终局牌不能重复下注');
});

test('Camel Up final leg scoring does not create a phantom next leg', () => {
    const game = new CamelUpEngine('camel-final-leg', players(['a', 'b', 'c']), () => 0);
    game.start();
    const leg = game.leg;
    game.players[0].legBets = [{ camelId: 'red', payout: 5 }];
    game.players[0].pyramidTiles = 1;
    game._settleLeg(true);
    assert.equal(game.leg, leg);
    assert.equal(game.players[0].cash, 9);
    assert.equal(game.tiles && Object.keys(game.tiles).length, 0);
});

test('Camel Up uses finite leg betting tiles and enforces non-adjacent desert tiles', () => {
    const game = new CamelUpEngine('camel-rules', players(['a', 'b', 'c']), () => 0);
    game.start();
    assert.equal(game.handleAction('a', { kind: 'betLeg', camelId: 'red' }).success, true);
    assert.equal(game.players[0].legBets[0].payout, 5);
    assert.equal(game.handleAction('b', { kind: 'betLeg', camelId: 'red' }).success, true);
    assert.equal(game.players[1].legBets[0].payout, 3);
    assert.equal(game.handleAction('c', { kind: 'betLeg', camelId: 'red' }).success, true);
    assert.equal(game.players[2].legBets[0].payout, 2);
    assert.equal(game.handleAction('a', { kind: 'betLeg', camelId: 'red' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'placeTile', position: 5, tileType: 'oasis' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'placeTile', position: 6, tileType: 'mirage' }).success, false);
    assert.equal(game.handleAction('b', { kind: 'placeTile', position: 8, tileType: 'mirage' }).success, true);
    assert.equal(game.tiles[5].kind, 'oasis');
    assert.equal(game.tiles[8].kind, 'mirage');
});

test('Camel Up uses official starting rolls, movable spectator tiles, and winner/loser bets', () => {
    const game = new CamelUpEngine('camel-formal', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.ok(game.camels.every(camel => camel.position >= 1 && camel.position <= 3));
    const occupied = game.camels[0].position;
    assert.equal(game.handleAction('a', { kind: 'placeTile', position: occupied, tileType: 'oasis' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'placeTile', position: 8, tileType: 'oasis' }).success, true);
    game.turnPlayerIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'placeTile', position: 10, tileType: 'mirage' }).success, true);
    assert.equal(game.tiles[8], undefined);
    assert.equal(game.tiles[10].kind, 'mirage');

    game.turnPlayerIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'betOverall', cardId: game.players[0].raceCards.find(card => card.camelId === 'red').id, outcome: 'winner' }).success, true);
    game.turnPlayerIndex = 1;
    assert.equal(game.handleAction('b', { kind: 'betOverall', cardId: game.players[1].raceCards.find(card => card.camelId === 'blue').id, outcome: 'loser' }).success, true);
    assert.deepEqual(game.getPlayerState('a').myOverallBets, [{ cardId: 'finish-a-red', camelId: 'red', outcome: 'winner', order: 1 }]);
    assert.deepEqual(game.getPublicState().overallBetPiles, { winner: 1, loser: 1 });
    assert.equal(Object.prototype.hasOwnProperty.call(game.getPublicState().players[0], 'overallBets'), false);
    game.camels.forEach(camel => { camel.position = camel.id === 'red' ? 16 : camel.id === 'blue' ? 0 : 2; });
    game._finishRace('red');
    assert.equal(game.players[0].cash, 11);
    assert.equal(game.players[1].cash, 11);
});

test('Camel Up applies the official pyramid, leg, tile, and stack rules', () => {
    const game = new CamelUpEngine('camel-formal-rules', players(['a', 'b', 'c']), () => 0);
    game.start();
    assert.equal(game.handleAction('a', { kind: 'rollDie' }).success, true);
    assert.equal(game.players[0].pyramidTiles, 1);
    assert.equal(game.getPlayerState('a').myPyramidTiles, 1);
    game._settleLeg();
    assert.equal(game.players[0].cash, 4);

    game.turnPlayerIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'placeTile', position: 1, tileType: 'oasis' }).success, false);
    game.camels.forEach(camel => { camel.position = camel.id === 'red' ? 2 : camel.id === 'blue' ? 3 : 8; camel.order = 0; });
    game.tiles[4] = { ownerId: 'a', ownerName: 'a', kind: 'mirage' };
    game._moveCamel('red', 2);
    assert.deepEqual(game._stackAt(3).map(camel => camel.id), ['red', 'blue']);

    game.players[0].cash = 0;
    game.players[0].legBets = [{ camelId: 'green', payout: 5 }];
    game.camels.forEach(camel => { camel.position = camel.id === 'green' ? 1 : camel.id === 'red' ? 2 : 8; });
    game._settleLeg();
    assert.equal(game.players[0].cash, 0, 'losing leg bets cannot make cash negative');
});

test('Camel Up orders overall bets globally and crowns the top finish-line camel', () => {
    const game = new CamelUpEngine('camel-overall-order', players(['a', 'b', 'c']), () => 0);
    game.start();
    assert.equal(game.handleAction('a', { kind: 'betOverall', cardId: game.players[0].raceCards.find(card => card.camelId === 'red').id, outcome: 'winner' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'betOverall', cardId: game.players[1].raceCards.find(card => card.camelId === 'blue').id, outcome: 'winner' }).success, true);
    assert.equal(game.handleAction('c', { kind: 'betOverall', cardId: game.players[2].raceCards.find(card => card.camelId === 'green').id, outcome: 'winner' }).success, true);
    assert.deepEqual(game.players.map(player => player.overallBets[0].order), [1, 2, 3]);
    game.camels.forEach(camel => { camel.position = camel.id === 'red' || camel.id === 'blue' ? 16 : 2; camel.order = camel.id === 'blue' ? 1 : 0; });
    game._finishRace();
    assert.equal(game._ranking()[0].id, 'blue');
    assert.equal(game.players[1].cash, 11, 'first correct winner card receives 8 even if an earlier card was wrong');
    assert.equal(game.players[0].cash, 2, 'a wrong winner card pays only the minimum -1');
});

test('Magical Athlete uses the official 36-card snake draft and team size variants', () => {
    assert.equal(MagicalAthleteEngine.ATHLETES.length, 36);
    assert.equal(new Set(MagicalAthleteEngine.ATHLETES.map(athlete => athlete.id)).size, 36);
    const game = new MagicalAthleteEngine('magicalathlete', players(['a', 'b', 'c', 'd', 'e']), () => 0.42);
    assert.equal(game.start().success, true);
    assert.equal(game.draftPool.length, 10);
    maDraft(game);
    assert.equal(game.phase, 'race_select');
    assert.deepEqual(game.players.map(player => player.team.length), [4, 4, 4, 4, 4]);
    assert.equal(new Set(game.players.flatMap(player => player.team.map(card => card.id))).size, 20);

    const two = new MagicalAthleteEngine('magicalathlete-two', players(['a', 'b']), () => 0.42);
    two.start();
    maDraft(two);
    assert.equal(two.players[0].team.length, 8);
    assert.equal(two.players[1].team.length, 8);
    assert.equal(two.racersPerPlayer, 2);

    const three = new MagicalAthleteEngine('magicalathlete-three', players(['a', 'b', 'c']), () => 0.42);
    three.start();
    maDraft(three);
    assert.deepEqual(three.players.map(player => player.team.length), [8, 8, 8]);
    assert.equal(three.racersPerPlayer, 2);
});

test('Magical Athlete starts a race, awards official gold/silver chips, and ends at the second finisher', () => {
    const game = new MagicalAthleteEngine('magicalathlete-finish', players(['a', 'b', 'c', 'd']), () => 0.99);
    game.start();
    maDraft(game);
    maRaceSelect(game);
    assert.equal(game.phase, 'race');
    const racers = game.racers.slice();
    racers[0].position = 29;
    racers[1].position = 29;
    game.currentTurnIndex = game.players.findIndex(player => player.id === racers[0].playerId);
    game.pending = null;
    racers[0].roll = 2;
    game._applyMainMove(racers[0]);
    maResolvePrompts(game);
    const afterFirst = game.players[game.currentTurnIndex].id;
    racers[1].roll = 2;
    const playerTurn = game.players[game.currentTurnIndex];
    const pick = game.racers.find(racer => racer.playerId === playerTurn.id && racer.finishOrder == null && !racer.turnDoneThisRound);
    assert.ok(pick);
    assert.notEqual(pick.playerId, racers[0].playerId);
    pick.roll = 2;
    game._applyMainMove(pick);
    maResolvePrompts(game);
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].ranking[0].place, 1);
    assert.equal(game.history[0].ranking[1].place, 2);
    const gold = MagicalAthleteEngine.GOLD_POINTS[0];
    const silver = MagicalAthleteEngine.SILVER_POINTS[0];
    const firstPlayer = game.playerMap[game.history[0].ranking[0].playerId];
    const secondPlayer = game.playerMap[game.history[0].ranking[1].playerId];
    assert.equal(firstPlayer.score, gold);
    assert.equal(secondPlayer.score, silver);
    assert.equal(game.match, 2);
});

test('Magical Athlete official racer abilities resolve correctly', () => {
    // Banana trips a passer.
    const bananaGame = new MagicalAthleteEngine('ma-banana', players(['a', 'b', 'c']), () => 0.42);
    bananaGame.start(); maDraft(bananaGame); maRaceSelect(bananaGame); bananaGame.pending = null;
    const banana = maAthlete(bananaGame, 0, 'banana');
    const legs = maAthlete(bananaGame, 1, 'legs');
    banana.position = 3; legs.position = 0;
    legs.roll = 5;
    bananaGame._applyMainMove(legs);
    assert.equal(legs.tripped, true);

    // Inchworm: another racer's 1 is skipped and Inchworm moves 1.
    const wormGame = new MagicalAthleteEngine('ma-worm', players(['a', 'b', 'c']), () => 0.42);
    wormGame.start(); maDraft(wormGame); maRaceSelect(wormGame); wormGame.pending = null;
    const worm = maAthlete(wormGame, 0, 'inchworm');
    const legs2 = maAthlete(wormGame, 1, 'legs');
    worm.position = 0; legs2.position = 5;
    legs2.roll = 1;
    wormGame._applyMainMove(legs2);
    assert.equal(legs2.position, 5);
    assert.equal(worm.position, 1);

    // Lackey: another racer's 6 moves Lackey 2 before they move.
    const lackeyGame = new MagicalAthleteEngine('ma-lackey', players(['a', 'b', 'c']), () => 0.42);
    lackeyGame.start(); maDraft(lackeyGame); maRaceSelect(lackeyGame); lackeyGame.pending = null;
    const lackey = maAthlete(lackeyGame, 0, 'lackey');
    const legs3 = maAthlete(lackeyGame, 1, 'legs');
    lackey.position = 0; legs3.position = 5;
    legs3.roll = 6;
    lackeyGame._applyMainMove(legs3);
    assert.equal(lackey.position, 2);
    assert.equal(legs3.position, 11);

    // Sisyphus: rolling a 6 warps to the Start and loses a bronze chip.
    const sisGame = new MagicalAthleteEngine('ma-sis', players(['a', 'b']), () => 0.42);
    sisGame.start(); maDraft(sisGame); maRaceSelect(sisGame); sisGame.pending = null;
    const sis = maAthlete(sisGame, 0, 'sisyphus');
    sis.position = 8; sis.bronze = 2;
    sis.roll = 6;
    sisGame._applyMainMove(sis);
    assert.equal(sis.position, 0);
    assert.equal(sis.bronze, 1);

    // Rocket Scientist doubles and then trips.
    const rocketGame = new MagicalAthleteEngine('ma-rocket', players(['a', 'b', 'c']), () => 0.42);
    rocketGame.start(); maDraft(rocketGame); maRaceSelect(rocketGame); rocketGame.pending = null;
    const rocket = maAthlete(rocketGame, 0, 'rocketscientist');
    rocket.position = 2; rocket.roll = 6; rocket.doubled = true;
    rocketGame._applyMainMove(rocket);
    assert.equal(rocket.tripped, true);
    assert.equal(rocket.position, 8);

    // Leaptoad skips spaces occupied by other racers.
    const frogGame = new MagicalAthleteEngine('ma-frog', players(['a', 'b', 'c']), () => 0.42);
    frogGame.start(); maDraft(frogGame); maRaceSelect(frogGame); frogGame.pending = null;
    const frog = maAthlete(frogGame, 0, 'leaptoad');
    const o1 = maAthlete(frogGame, 1, 'legs');
    const o2 = maAthlete(frogGame, 2, 'legs');
    frog.position = 0; o1.position = 2; o2.position = 4;
    frog.roll = 5;
    frogGame._applyMainMove(frog);
    assert.equal(frog.position, 7);

    // Hare: +2 on the main move; skips when alone in the lead and gains a bronze chip.
    const hareGame = new MagicalAthleteEngine('ma-hare', players(['a', 'b']), () => 0.42);
    hareGame.start(); maDraft(hareGame); maRaceSelect(hareGame); hareGame.pending = null;
    const hare = maAthlete(hareGame, 0, 'hare');
    const other = maAthlete(hareGame, 1, 'legs');
    other.position = 1; hare.position = 5;
    hare.roll = 3;
    hareGame._applyMainMove(hare);
    assert.equal(hare.position, 10);
    const hare2Game = new MagicalAthleteEngine('ma-hare2', players(['a', 'b']), () => 0.42);
    hare2Game.start(); maDraft(hare2Game); maRaceSelect(hare2Game); hare2Game.pending = null;
    const hare2 = maAthlete(hare2Game, 0, 'hare');
    const other2 = maAthlete(hare2Game, 1, 'legs');
    other2.position = 1; hare2.position = 5;
    hare2Game._resolveStartOfTurn(hare2);
    assert.equal(hare2.skippedMainMove, true);
    assert.equal(hare2.bronze, 1);

    // Blimp (legacy id airship): +3 before the second corner, -1 on/after it.
    const shipGame = new MagicalAthleteEngine('ma-ship', players(['a', 'b']), () => 0.42);
    shipGame.start(); maDraft(shipGame); maRaceSelect(shipGame); shipGame.pending = null;
    const ship = maAthlete(shipGame, 0, 'airship');
    const shipOther = maAthlete(shipGame, 1, 'legs');
    shipOther.position = 3; ship.position = 3; ship._turnStartPos = 3;
    ship.roll = 3;
    shipGame._applyMainMove(ship);
    assert.equal(ship.position, 9);
    ship.position = 12; ship._turnStartPos = 12;
    ship.roll = 3;
    shipGame._applyMainMove(ship);
    assert.equal(ship.position, 18);

    // Gunk: other racers get -1 to their main move.
    const gunkGame = new MagicalAthleteEngine('ma-gunk', players(['a', 'b']), () => 0.42);
    gunkGame.start(); maDraft(gunkGame); maRaceSelect(gunkGame); gunkGame.pending = null;
    const gunk = maAthlete(gunkGame, 0, 'gunk');
    const gunkOther = maAthlete(gunkGame, 1, 'legs');
    gunkOther.position = 0;
    gunkOther.roll = 3;
    gunkGame._applyMainMove(gunkOther);
    assert.equal(gunkOther.position, 2);

    // M.O.U.T.H. eliminates the racer sharing its space.
    const mouthGame = new MagicalAthleteEngine('ma-mouth', players(['a', 'b', 'c', 'd']), () => 0.42);
    mouthGame.start(); maDraft(mouthGame); maRaceSelect(mouthGame); mouthGame.pending = null;
    const mouth = maAthlete(mouthGame, 0, 'mouth');
    const victim = maAthlete(mouthGame, 1, 'legs');
    const far1 = maAthlete(mouthGame, 2, 'legs');
    const far2 = maAthlete(mouthGame, 3, 'legs');
    mouth.position = 5; victim.position = 5; far1.position = 10; far2.position = 10;
    mouthGame._resolveStops(mouth);
    assert.equal(victim.eliminated, true);

    // Scoocher: another racer's power moves Scoocher 1.
    const scooGame = new MagicalAthleteEngine('ma-scoo', players(['a', 'b', 'c']), () => 0.42);
    scooGame.start(); maDraft(scooGame); maRaceSelect(scooGame); scooGame.pending = null;
    const scoo = maAthlete(scooGame, 0, 'scoocher');
    const scooSrc = maAthlete(scooGame, 1, 'legs');
    scoo.position = 0;
    scooGame._powerEvent(scooSrc);
    assert.equal(scoo.position, 1);

    // Duelist: a racer stopping on its space can be challenged (optional), winner moves 2.
    const duelGame = new MagicalAthleteEngine('ma-duel', players(['a', 'b', 'c', 'd']), () => 0.42);
    duelGame.start(); maDraft(duelGame); maRaceSelect(duelGame); duelGame.pending = null;
    const duelist = maAthlete(duelGame, 0, 'duelist');
    const stopper = maAthlete(duelGame, 1, 'legs');
    maAthlete(duelGame, 2, 'legs').position = 10;
    maAthlete(duelGame, 3, 'legs').position = 10;
    duelist.position = 5; stopper.position = 0;
    stopper.roll = 5;
    duelGame._applyMainMove(stopper);
    assert.equal(duelGame.pending.kind, 'duel');
    const duelistPos = duelist.position; const stopperPos = stopper.position;
    const duelResult = duelGame.handleAction(duelGame.pending.playerId, { kind: 'decide', use: true, targetRacerId: stopper.id });
    assert.equal(duelResult.success, true);
    assert.equal(duelist.position !== duelistPos || stopper.position !== stopperPos, true);

    // Suckerfish: a racer moving from its space can be followed (optional).
    const suckGame = new MagicalAthleteEngine('ma-suck', players(['a', 'b', 'c', 'd']), () => 0.42);
    suckGame.start(); maDraft(suckGame); maRaceSelect(suckGame); suckGame.pending = null;
    const sucker = maAthlete(suckGame, 0, 'suckerfish');
    const mover = maAthlete(suckGame, 1, 'legs');
    maAthlete(suckGame, 2, 'legs').position = 10;
    maAthlete(suckGame, 3, 'legs').position = 10;
    sucker.position = 3; mover.position = 3;
    mover.roll = 4;
    suckGame._applyMainMove(mover);
    assert.equal(suckGame.pending.kind, 'suckerfish');
    const followResult = suckGame.handleAction(suckGame.pending.playerId, { kind: 'decide', use: true, targetRacerId: mover.id });
    assert.equal(followResult.success, true);
    assert.equal(sucker.position, mover.position);

    // Mastermind predicting the winner finishes 2nd (and 1st too if it predicts itself).
    const mmGame = new MagicalAthleteEngine('ma-mm', players(['a', 'b']), () => 0.42);
    mmGame.start(); maDraft(mmGame); maRaceSelect(mmGame); mmGame.pending = null;
    const mm = maAthlete(mmGame, 0, 'mastermind');
    const mmOther = maAthlete(mmGame, 1, 'legs');
    mm.predictedWin = mm.id;
    mm.finishOrder = 1; mm.position = 30;
    mmOther.position = 5;
    mmGame._finishRace();
    assert.equal(mmGame.playerMap[mm.playerId].score, MagicalAthleteEngine.GOLD_POINTS[0] + MagicalAthleteEngine.SILVER_POINTS[0]);
});

test('Magical Athlete 2/3-player double-racer variant moves both racers per turn', () => {
    const game = new MagicalAthleteEngine('ma-team', players(['a', 'b']), () => 0.42);
    game.start();
    maDraft(game);
    maRaceSelect(game);
    assert.equal(game.racers.length, 4);
    const a1 = maAthlete(game, 0, 'legs');
    const a2 = maAthlete(game, 1, 'legs');
    maAthlete(game, 2, 'legs');
    maAthlete(game, 3, 'legs');
    game.currentTurnIndex = game.players.findIndex(player => player.id === 'a');
    game.pending = null;
    a1.roll = 3;
    game._runRacerTurn(a1);
    maResolvePrompts(game);
    assert.equal(game.players[game.currentTurnIndex].id, 'a');
    a2.roll = 3;
    game._runRacerTurn(a2);
    maResolvePrompts(game);
    assert.equal(game.players[game.currentTurnIndex].id, 'b');
});

test('Magical Athlete plays a full four-race tournament to a winner', () => {
    const game = new MagicalAthleteEngine('ma-full', players(['a', 'b', 'c', 'd', 'e']), () => 0.42);
    game.start();
    maAutoPlay(game);
    assert.equal(game.status, 'ended');
    assert.equal(game.history.length, 4);
    assert.ok(game.winner);
    const total = game.players.reduce((sum, player) => sum + player.score, 0);
    assert.ok(total > 0);
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

test('Decrypto follows the official first-round order and rotates encryptors', () => {
    assert.ok(DecryptoEngine.WORD_BANK.length >= 4);
    const game = new DecryptoEngine('decrypto', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.phase, 'keycheck');
    assert.equal(game.getPlayerState('a').myKeywords.length, 4);
    assert.equal(game.getPlayerState('a').myKeywords.join(','), game.getPlayerState('c').myKeywords.join(','));
    assert.equal(Object.prototype.hasOwnProperty.call(game.getPublicState().teams[0], 'keywords'), false);
    confirmDecryptoKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    const code = game.currentTurn.code.slice();
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', code: [4, 4, 4], clues: ['晨光', '远行', '回声'] }).success, true);
    assert.equal(game.phase, 'clue');
    assert.equal(game.handleAction(game.roundTurns[1].encryptorId, { kind: 'submitClue', clues: ['蓝晨', '蓝行', '蓝声'] }).success, true);
    const teammate = game.teams[0].members.find(id => id !== encryptor);
    assert.equal(game.phase, 'guessing');
    assert.equal(game.handleAction(game.teams[1].members[0], { kind: 'submitIntercept', code }).success, false);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code }).success, true);
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].intercept, null);
    assert.equal(game.currentTurn.encryptorId, game.teams[1].members[0]);
    const nextEncryptor = game.currentTurn.encryptorId;
    const nextTeammate = game.teams[1].members.find(id => id !== nextEncryptor);
    assert.equal(game.getPlayerState(nextTeammate).currentCode, null);
});

test('Decrypto completes a full four-player game with miscommunication tiebreak', () => {
    const game = new DecryptoEngine('decrypto-full', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    confirmDecryptoKeys(game);
    const playTeamTurn = ({ correct = true, intercept = false } = {}) => {
        const encryptor = game.currentTurn.encryptorId;
        const code = game.currentTurn.code.slice();
        const wrongCode = code[0] === 1 ? [2, 3, 4] : [1, 2, 3];
        const clueIndex = game.history.length;
        if (game.phase === 'clue') {
            assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: [`山${clueIndex}`, `海${clueIndex}`, `风${clueIndex}`] }).success, true);
            const otherEncryptor = game.roundTurns[1].encryptorId;
            assert.equal(game.handleAction(otherEncryptor, { kind: 'submitClue', clues: [`蓝山${clueIndex}`, `蓝海${clueIndex}`, `蓝风${clueIndex}`] }).success, true);
        }
        if (intercept) {
            const opponent = game.teams[1 - game.activeTeam].members[0];
            assert.equal(game.handleAction(opponent, { kind: 'submitIntercept', code: wrongCode }).success, true);
        }
        const teammate = game.teams[game.activeTeam].members.find(id => id !== encryptor);
        assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: correct ? code : wrongCode }).success, true);
    };
    // Round one: both teams guess internally; interception is not allowed.
    playTeamTurn({ correct: true });
    playTeamTurn({ correct: true });
    assert.equal(game.round, 2);
    // Two complete rounds with intentional internal mistakes lead to a tiebreak.
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    playTeamTurn({ correct: false, intercept: true });
    assert.equal(game.phase, 'tiebreak');
    assert.equal(game.history.length, 6);
    assert.equal(game.teams[0].miscommunications, 2);
    assert.equal(game.teams[1].miscommunications, 2);
    const red = game.teams[0].keywords.slice();
    const blue = game.teams[1].keywords.slice();
    assert.equal(game.handleAction('a', { kind: 'tiebreakGuess', keywords: blue }).success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.handleAction('b', { kind: 'tiebreakGuess', keywords: red.map(() => '不存在') }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.teamId, 0);
});

test('Decrypto supports the official three-player lone-interceptor variant', () => {
    const game = new DecryptoEngine('decrypto-three', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    confirmDecryptoKeys(game);
    assert.deepEqual(game.teams.map(team => team.members), [['a', 'b'], ['c']]);
    const submitRound = ({ interceptCode, ownCorrect = true } = {}) => {
        const encryptor = game.currentTurn.encryptorId;
        const actualCode = game.currentTurn.code.slice();
        const wrongCode = actualCode[0] === 1 ? [2, 3, 4] : [1, 2, 3];
        const clueIndex = game.history.length;
        assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: [`火${clueIndex}`, `水${clueIndex}`, `土${clueIndex}`] }).success, true);
        if (interceptCode) assert.equal(game.handleAction('c', { kind: 'submitIntercept', code: interceptCode === 'correct' ? actualCode : wrongCode }).success, true);
        assert.equal(game.handleAction(game.teams[0].members.find(id => id !== encryptor), { kind: 'submitOwnGuess', code: ownCorrect ? actualCode : wrongCode }).success, true);
    };
    // First round has no interception. In the second round a missed team guess
    // awards the lone interceptor a token instead of a miscommunication token.
    submitRound();
    assert.equal(game.round, 2);
    submitRound({ interceptCode: 'wrong', ownCorrect: false });
    assert.equal(game.teams[1].interceptions, 1);
    assert.equal(game.teams[0].miscommunications, 0);
    // One successful interception ends the game on the second token.
    submitRound({ interceptCode: 'correct', ownCorrect: true });
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.teamId, 1);
});

test('Decrypto client protects shared secrets and uses graded offline communication transitions', () => {
    const client = fs.readFileSync('public/games/decrypto/client.js', 'utf8');
    const style = fs.readFileSync('public/games/decrypto/style.css', 'utf8');
    assert.match(client, /data-secret-toggle="keywords"/);
    assert.match(client, /data-secret-code/);
    assert.match(client, /data-code-hold/);
    assert.match(client, /setCodeVisible\(true\)/);
    assert.match(client, /addEventListener\('pointerdown'/);
    assert.match(client, /addEventListener\('pointercancel'/);
    assert.match(client, /addEventListener\('keyup'/);
    assert.match(client, /document\.hidden/);
    assert.match(client, /action: \{ kind: 'confirmKey' \}/);
    assert.match(client, /答案收齐后统一揭晓/);
    assert.match(client, /所有推演完全在线下自由讨论/);
    assert.match(client, /dc-scene-transition/);
    assert.match(client, /密钥已经封存/);
    assert.match(client, /双方通信已经暴露/);
    assert.doesNotMatch(client, /chat|聊天框|发言倒计时/);
    assert.match(style, /\.dc-keywords-cover/);
    assert.match(style, /\.dc-code-cover/);
    assert.match(style, /@keyframes dcSceneCurtain/);
    assert.match(style, /prefers-reduced-motion/);
});

test('Las Vegas uses the full bank and adds neutral dice in a two-player game', () => {
    assert.equal(LasVegasEngine.buildMoneyDeck().length, 54);
    const session = LasVegas.create('lasvegas', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.participants.length, 3);
    assert.equal(game.casinos.length, 6);
    assert.equal(game.casinos.every(casino => casino.money.reduce((sum, value) => sum + value, 0) >= 50), true);
    assert.equal(session.getPlayerState('a').availableActions.canRoll, true);
    assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, true);
    assert.equal(session.getPlayerState('b').currentRoll.length, 12);
    const face = game.currentRoll[0];
    const before = game.players[0].diceRemaining + game.players[0].neutralDiceRemaining;
    assert.equal(session.handleAction('a', { kind: 'placeDice', face }).success, true);
    assert.ok(game.players[0].diceRemaining + game.players[0].neutralDiceRemaining < before);
});

test('Las Vegas tied dice do not receive a casino bill', () => {
    const session = LasVegas.create('lasvegas-tie', players(['a', 'b', 'c'])); session.start(); const game = session.engine;
    game.round = 4;
    game.casinos = [{ face: 1, money: [90, 80], dice: { a: 2, b: 2, c: 1 } }, ...Array.from({ length: 5 }, (_, index) => ({ face: index + 2, money: [50], dice: {} }))];
    game.participants.forEach(player => { player.diceRemaining = 0; });
    game._settleRound();
    assert.equal(game.players[0].money, 0); assert.equal(game.players[1].money, 0); assert.equal(game.players[2].money, 90); assert.equal(game.status, 'ended');
});

test('Las Vegas completes four rounds with five players and resolves every casino', () => {
    const game = new LasVegasEngine('lasvegas-full', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    let guard = 0;
    while (game.status === 'playing' && guard++ < 2000) {
        const current = game._currentParticipant();
        if (!current || current.isNeutral) { game._advanceToAction(); continue; }
        assert.equal(game.handleAction(current.id, { kind: 'rollDice' }).success, true);
        const face = game.currentRoll[0];
        assert.equal(game.handleAction(current.id, { kind: 'placeDice', face }).success, true);
    }
    assert.equal(game.status, 'ended');
    assert.equal(game.round, 4);
    assert.ok(game.winner);
    assert.ok(guard < 2000);
});

test('Avalon keeps roles private and resolves a failed mission after team approval', () => {
    const game = new AvalonEngine('avalon', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.players.length, 5);
    assert.equal(game.getPublicState().players.every(player => player.role === null), true);
    assert.equal(game.getPlayerState('a').myRole, game.players.find(player => player.id === 'a').role);
    assert.equal(game.phase, 'roleReveal');
    assert.equal(game.handleAction('a', { kind: 'proposeTeam', playerIds: ['a', 'b'] }).success, false);
    confirmAvalonRoles(game);
    const evil = game.players.find(player => player.role === 'assassin' || player.role === 'minion');
    const teammate = game.players.find(player => player.id !== 'a' && player.id !== evil.id) || game.players.find(player => player.id !== 'a');
    const missionMate = evil.id === 'a' ? teammate : evil;
    assert.equal(game.handleAction('a', { kind: 'proposeTeam', playerIds: ['a', missionMate.id] }).success, true);
    for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(game.handleAction(id, { kind: 'castVote', approve: true }).success, true);
    assert.equal(game.phase, 'mission');
    if (evil.id === 'a') {
        assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'fail' }).success, true);
        assert.equal(game.handleAction(missionMate.id, { kind: 'missionVote', result: 'success' }).success, true);
    } else {
        assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'success' }).success, true);
        assert.equal(game.handleAction(evil.id, { kind: 'missionVote', result: 'fail' }).success, true);
    }
    assert.equal(game.failedMissions, 1);
    assert.equal(game.missionHistory[0].success, false);
});

test('Avalon enters assassin phase after three successes and evil wins when Merlin is found', () => {
    const game = new AvalonEngine('avalon-assassin', players(['a', 'b', 'c', 'd', 'e']), () => 0); game.start();
    game.round = 3; game.successfulMissions = 2; game.phase = 'mission'; game.team = ['a', 'c']; game.missionVotes = {};
    assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(game.handleAction('c', { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(game.phase, 'assassin');
    const assassin = game.players.find(player => player.role === 'assassin');
    const merlin = game.players.find(player => player.role === 'merlin');
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: merlin.id }).success, true);
    assert.equal(game.status, 'ended'); assert.equal(game.winner.faction, 'evil');
});

test('Avalon completes a five-player good run and assassin endgame', () => {
    const game = new AvalonEngine('avalon-full-five', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    confirmAvalonRoles(game);
    let steps = 0;
    while (game.phase === 'team' && steps++ < 20) {
        const size = game.getPublicState().missionSize;
        const leader = game.players[game.leaderIndex];
        const team = game.players.slice(0, size).map(player => player.id);
        assert.equal(game.handleAction(leader.id, { kind: 'proposeTeam', playerIds: team }).success, true);
        for (const player of game.players) assert.equal(game.handleAction(player.id, { kind: 'castVote', approve: true }).success, true);
        for (const id of team) assert.equal(game.handleAction(id, { kind: 'missionVote', result: 'success' }).success, true);
    }
    assert.equal(game.phase, 'assassin');
    const assassin = game.players.find(player => player.role === 'assassin');
    const merlin = game.players.find(player => player.role === 'merlin');
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: merlin.id }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.faction, 'evil');
    assert.equal(game.successfulMissions, 3);
    assert.equal(game.missionHistory.length, 3);
});

test('Avalon uses the core hidden-role distribution and supports optional roles', () => {
    for (const count of [5, 7, 9, 10]) {
        const game = new AvalonEngine(`avalon-${count}`, players(Array.from({ length: count }, (_, index) => String(index))), () => 0);
        assert.equal(game.start().success, true);
        const roles = game.players.map(player => player.role);
        assert.equal(roles.filter(role => ['assassin', 'minion', 'morgana', 'mordred', 'oberon'].includes(role)).length, ({ 5: 2, 7: 3, 9: 3, 10: 4 })[count]);
        assert.ok(roles.includes('merlin')); assert.ok(roles.includes('assassin'));
        assert.equal(game.getPublicState().players.every(player => player.role === null), true);
    }
    const expanded = new AvalonEngine('avalon-expanded', players(['a', 'b', 'c', 'd', 'e', 'f', 'g']), () => 0, { percival: true, morgana: true, oberon: true });
    assert.equal(expanded.start().success, true);
    assert.ok(expanded.players.some(player => player.role === 'percival'));
    assert.ok(expanded.players.some(player => player.role === 'morgana'));
    assert.ok(expanded.players.some(player => player.role === 'oberon'));
    const merlin = expanded.players.find(player => player.role === 'merlin');
    assert.equal(expanded.getPlayerState(merlin.id).knownPlayers.some(player => player.id === expanded.players.find(item => item.role === 'oberon').id), false);
    const invalid = new AvalonEngine('avalon-invalid-options', players(['a', 'b', 'c', 'd', 'e']), { morgana: true, mordred: true });
    assert.equal(invalid.start().success, false);
});

test('Avalon client keeps identities covered and treats discussion as an offline free-form activity', () => {
    const client = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    const style = fs.readFileSync('public/games/avalon/style.css', 'utf8');
    assert.match(client, /data-role-hold/);
    assert.match(client, /data-role-secret/);
    assert.match(client, /setRoleIdentityVisible\(true\)/);
    assert.match(client, /'confirmRole', !hasViewedRole/);
    assert.match(client, /讨论完全在线下自由进行/);
    assert.match(client, /辅助页面不会规定发言顺序或结束时间/);
    assert.match(client, /av-scene-transition/);
    assert.match(client, /远征队伍已经出发/);
    assert.match(client, /最后一把匕首仍未落下/);
    assert.doesNotMatch(client, /chat|聊天框|发言倒计时/);
    assert.match(style, /\.av-role-cover/);
    assert.match(style, /@keyframes avSceneCurtain/);
    assert.match(style, /\.avalon-app\.scene-expedition/);
});

test('Social deduction games share a prominent responsive identity focus and Avalon uses local BGG role art', () => {
    const common = fs.readFileSync('public/games/common/hidden-role-focus.css', 'utf8');
    const avalonClient = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    const avalonStyle = fs.readFileSync('public/games/avalon/style.css', 'utf8');
    const werewolfClient = fs.readFileSync('public/games/werewolf/client.js', 'utf8');
    const werewolfStyle = fs.readFileSync('public/games/werewolf/style.css', 'utf8');
    const witchtownClient = fs.readFileSync('public/games/witchtown/client.js', 'utf8');
    const witchtownStyle = fs.readFileSync('public/games/witchtown/style.css', 'utf8');
    const sources = fs.readFileSync('public/assets/bgg/SOURCES.md', 'utf8');
    const roles = ['loyal', 'merlin', 'percival', 'minion', 'assassin', 'morgana', 'mordred', 'oberon'];

    assert.match(common, /\.social-role-focus/);
    assert.match(common, /\.social-role-focus-art/);
    for (const client of [avalonClient, werewolfClient, witchtownClient]) {
        assert.match(client, /hidden-role-focus\.css/);
        assert.match(client, /social-role-focus/);
    }
    for (const role of roles) {
        const file = `public/assets/bgg/avalon/roles/${role}.webp`;
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', `${role} 应为本地 WebP`);
        assert.ok(bytes.length > 50_000, `${role} 角色裁图不应是空壳资源`);
        assert.match(avalonClient, new RegExp(`${role}\\.webp`));
    }
    assert.match(avalonClient, /roleArtPreloads/);
    assert.match(avalonClient, /av-role-art social-role-focus-art/);
    assert.match(avalonStyle, /grid-template-columns:\s*minmax\(286px/);
    assert.match(avalonStyle, /\.av-role-art\s*\{/);
    assert.match(werewolfStyle, /\.ww-role\s*\{[\s\S]*?min-height:\s*360px/);
    assert.match(witchtownStyle, /\.witchtown-hall\s*\{[\s\S]*?min-height:\s*220px/);
    assert.match(witchtownStyle, /\.witchtown-role-panel\s*\{\s*display:\s*block;\s*grid-column:\s*2/);
    assert.match(sources, /1453098/);
    assert.match(sources, /1453075/);
});

test('Scout builds 45 dual-number cards and locks the whole-hand orientation', () => {
    assert.equal(ScoutEngine.buildDeck().length, 45);
    const game = new ScoutEngine('scout', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.phase, 'orienting');
    for (const id of ['a', 'b', 'c']) assert.equal(game.handleAction(id, { kind: 'setOrientation', orientation: 0 }).success, true);
    assert.equal(game.phase, 'turn');
    const starter = game.players[game.currentPlayerIndex];
    const first = starter.hand[0];
    assert.equal(game.handleAction(starter.id, { kind: 'show', cardIndices: [0] }).success, true);
    assert.equal(game.activeSet[0].id, first.id);
    assert.equal(starter.hand[0].id !== first.id, true);
});

test('Scout only allows edge recruitment and inserts the recruited card without reordering the rest', () => {
    const game = new ScoutEngine('scout-scout', players(['a', 'b', 'c']), () => 0); game.start();
    for (const id of ['a', 'b', 'c']) game.handleAction(id, { kind: 'setOrientation', orientation: 0 });
    game.phase = 'turn'; game.currentPlayerIndex = 0; game.activeOwnerId = 'b'; game.activeSet = [{ id: 'active-left', front: 8, back: 2, orientation: 0 }, { id: 'active-right', front: 9, back: 3, orientation: 0 }];
    game.players[0].hand = [{ id: 'h1', front: 1, back: 4, orientation: 0 }, { id: 'h2', front: 5, back: 6, orientation: 0 }];
    assert.equal(game.handleAction('a', { kind: 'scout', edge: 'left', insertAt: 1, orientation: 1 }).success, true);
    assert.deepEqual(game.players[0].hand.map(card => card.id), ['h1', 'active-left', 'h2']);
    assert.equal(game.activeSet[0].id, 'active-right');
    assert.equal(game.players[1].scoutTokens, 1);
});

test('Scout uses the official pair deck, setup removals, and the 1/2 start marker', () => {
    const deck = ScoutEngine.buildDeck();
    assert.equal(new Set(deck.map(card => `${card.front}/${card.back}`)).size, 45);
    assert.ok(deck.some(card => card.front === 1 && card.back === 2));
    const three = new ScoutEngine('scout-setup-3', players(['a', 'b', 'c']), () => 0);
    assert.equal(three.start().success, true);
    assert.equal(three.players.every(player => player.hand.every(card => card.front !== 10 && card.back !== 10)), true);
    const holder = three.players.find(player => player.hand.some(card => card.front === 1 && card.back === 2));
    assert.equal(three.currentPlayerIndex, three.players.indexOf(holder));
    const four = new ScoutEngine('scout-setup-4', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(four.start().success, true);
    assert.equal(four.players.flatMap(player => player.hand).some(card => card.front === 9 && card.back === 10), false);
});

test('Scout & Show rolls back the scout when the immediate show is invalid', () => {
    const game = new ScoutEngine('scout-rollback', players(['a', 'b', 'c']), () => 0); game.start();
    for (const id of ['a', 'b', 'c']) game.handleAction(id, { kind: 'setOrientation', orientation: 0 });
    game.phase = 'turn'; game.currentPlayerIndex = 0; game.activeOwnerId = 'b';
    game.activeSet = [{ id: 'active-left', front: 8, back: 2, orientation: 0 }, { id: 'active-right', front: 9, back: 3, orientation: 0 }];
    game.players[0].hand = [{ id: 'h1', front: 1, back: 4, orientation: 0 }, { id: 'h2', front: 5, back: 6, orientation: 0 }];
    const beforeHand = game.players[0].hand.map(card => card.id); const beforeSet = game.activeSet.map(card => card.id);
    assert.equal(game.handleAction('a', { kind: 'scoutShow', edge: 'left', insertAt: 1, orientation: 1, cardIndices: [0, 2] }).success, false);
    assert.deepEqual(game.players[0].hand.map(card => card.id), beforeHand);
    assert.deepEqual(game.activeSet.map(card => card.id), beforeSet);
    assert.equal(game.players[1].scoutTokens, 0);
    assert.equal(game.players[0].scoutShowAvailable, true);
});

test('Scout completes a deterministic three-player game across all rounds', () => {
    const game = new ScoutEngine('scout-full', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    let guard = 0;
    while (game.status === 'playing' && guard++ < 2000) {
        if (game.phase === 'orienting') {
            for (const player of game.players.filter(item => !item.orientationSet)) assert.equal(game.handleAction(player.id, { kind: 'setOrientation', orientation: 0 }).success, true);
            continue;
        }
        const player = game.players[game.currentPlayerIndex];
        let acted = false;
        for (let start = 0; start < player.hand.length && !acted; start += 1) for (let end = start; end < player.hand.length && !acted; end += 1) {
            const result = game.handleAction(player.id, { kind: 'show', cardIndices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset) });
            if (result.success) acted = true;
        }
        if (!acted) assert.equal(game.handleAction(player.id, { kind: 'scout', edge: 'left', insertAt: 0, orientation: 0 }).success, true);
    }
    assert.equal(game.status, 'ended'); assert.equal(game.round, 3); assert.ok(game.winner); assert.ok(guard < 2000);
});

test('Scout completes the official two-player two-round variant', () => {
    const game = new ScoutEngine('scout-full-2', players(['a', 'b']), () => 0);
    assert.equal(game.start().success, true); assert.equal(game.maxRounds, 2);
    let guard = 0;
    while (game.status === 'playing' && guard++ < 2000) {
        if (game.phase === 'orienting') {
            for (const player of game.players.filter(item => !item.orientationSet)) assert.equal(game.handleAction(player.id, { kind: 'setOrientation', orientation: 0 }).success, true);
            continue;
        }
        const player = game.players[game.currentPlayerIndex]; let acted = false;
        for (let start = 0; start < player.hand.length && !acted; start += 1) for (let end = start; end < player.hand.length && !acted; end += 1) {
            const result = game.handleAction(player.id, { kind: 'show', cardIndices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset) });
            if (result.success) acted = true;
        }
        if (!acted && player.scoutChips > 0) assert.equal(game.handleAction(player.id, { kind: 'scout', edge: 'left', insertAt: 0, orientation: 0 }).success, true);
        else if (!acted) assert.equal(game.handleAction(player.id, { kind: 'show', cardIndices: [0] }).success, true);
    }
    assert.equal(game.status, 'ended'); assert.equal(game.round, 2); assert.ok(game.winner); assert.ok(guard < 2000);
});

test('Acquire builds a private six-tile hand and supports founding and buying shares', () => {
    assert.equal(AcquireEngine.buildTiles().length, 108);
    const session = Acquire.create('acquire', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(session.getPlayerState('a').myHand.length, 6);
    assert.equal(session.getPlayerState('b').myHand.length, 6);
    const firstPlayer = game.players[game.currentTurnIndex];
    const first = firstPlayer.hand[0];
    assert.equal(session.handleAction(firstPlayer.id, { kind: 'placeTile', tileId: first.id }).success, true);
    if (game.phase === 'foundation') {
        const chain = Object.values(game.corporations).find(corporation => !corporation.active);
        assert.equal(session.handleAction(firstPlayer.id, { kind: 'foundChain', chainId: chain.id }).success, true);
    }
    assert.equal(game.phase, 'buy');
    assert.equal(session.handleAction(firstPlayer.id, { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(game.currentTurnIndex, (game.players.indexOf(firstPlayer) + 1) % game.players.length);
});

test('Acquire merger keeps the largest chain and pays out acquired shares', () => {
    const session = Acquire.create('acquire-merger', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = ['A1', 'A2']; game.corporations.imperial.active = true; game.corporations.imperial.tiles = ['A4', 'A5', 'A6'];
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' }, A6: { id: 'A6', row: 0, col: 5, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }]; game.playerMap[currentId].shares.sackson = 2; game.corporations.sackson.sharesAvailable = 23;
    assert.equal(session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' }).success, true);
    assert.equal(game.phase, 'merger');
    assert.equal(session.handleAction(currentId, { kind: 'chooseMerger', chainId: 'imperial' }).success, true);
    assert.equal(game.phase, 'merger_settlement');
    assert.equal(session.handleAction(currentId, { kind: 'settleMergerShares', chainId: 'sackson', sell: 2, trade: 0, keep: 0 }).success, true);
    assert.equal(game.phase, 'buy');
    assert.equal(game.players[0].shares.sackson, 0);
    assert.ok(game.playerMap[currentId].cash > 6000);
});

test('Acquire allows a safe chain to absorb an open chain but protects two safe chains', () => {
    const session = Acquire.create('acquire-safe-chain', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true; game.corporations.imperial.tiles = ['A4', 'A5'];
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }];
    const result = session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' });
    assert.equal(result.success, true); assert.equal(game.phase, 'merger');
    game.pendingMerger = null; game.phase = 'place'; game.board.A3 = undefined; delete game.board.A3;
    game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }];
    const blocked = session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' });
    assert.equal(blocked.success, false); assert.equal(game.playerMap[currentId].hand.length, 1); assert.equal(game.phase, 'place');
});

test('Acquire uses the tiered official stock price chart', () => {
    const game = new AcquireEngine('acquire-prices', players(['a', 'b'])); game.start();
    for (const [id, tier] of [['sackson', 200], ['worldwide', 300], ['continental', 400]]) {
        game.corporations[id].active = true; game.corporations[id].tiles = ['A1', 'A2'];
        assert.equal(game._sharePrice(id), tier);
        game.corporations[id].tiles.push('A3', 'A4', 'A5', 'A6');
    }
    assert.equal(game._sharePrice('sackson'), 600); assert.equal(game._sharePrice('worldwide'), 700); assert.equal(game._sharePrice('continental'), 800);
});

test('Acquire uses the official corporation names and price tiers', () => {
    const ids = AcquireEngine.CHAINS.map(chain => chain.id);
    assert.equal(ids.includes('zeta'), false);
    assert.equal(AcquireEngine.CHAINS.find(chain => chain.id === 'imperial').name, '帝国');
    assert.equal(AcquireEngine.CHAIN_TIERS.tower, 'low');
    assert.equal(AcquireEngine.CHAIN_TIERS.worldwide, 'middle');
});

test('Acquire settles multiple acquired corporations from largest to smallest', () => {
    const game = new AcquireEngine('acquire-merger-order', players(['a', 'b']));
    game.start();
    game.corporations.continental.active = true; game.corporations.continental.tiles = ['A1', 'A2', 'A3', 'A4', 'A5'];
    game.corporations.worldwide.active = true; game.corporations.worldwide.tiles = ['B1', 'B2', 'B3', 'B4'];
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = ['C1', 'C2'];
    game.players[0].shares.worldwide = 1; game.players[0].shares.sackson = 1;
    game.pendingMerger = { playerId: 'a', chains: ['continental', 'sackson', 'worldwide'] };
    assert.equal(game._chooseMerger(game.players[0], 'continental').success, true);
    assert.equal(game.pendingMerger.queueChainId, 'worldwide');
    assert.equal(game._settleMergerShares(game.players[0], { chainId: 'worldwide', sell: 0, trade: 0, keep: 1 }).success, true);
    assert.equal(game.pendingMerger.queueChainId, 'sackson');
});

test('Kingdomino creates a 48-tile draft and validates connected placement', () => {
    assert.equal(KingdominoEngine.buildDominoes().length, 48);
    const session = Kingdomino.create('kingdomino', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.draft.length, 4);
    const tile = game.draft[0];
    const first = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(first, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    const second = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(second, { kind: 'selectDomino', dominoId: game.draft[1].id }).success, true);
    const third = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(third, { kind: 'selectDomino', dominoId: game.draft[2].id }).success, true);
    const fourth = game.currentQueue[game.currentQueueIndex].playerId;
    assert.equal(session.handleAction(fourth, { kind: 'selectDomino', dominoId: game.draft[3].id }).success, true);
    assert.equal(game.phase, 'placing');
    assert.equal(session.handleAction(game.currentQueue[0].playerId, { kind: 'placeDomino', x1: 2, y1: 3, x2: 2, y2: 4 }).success, true);
});

test('Kingdomino scales the draft and discards unchosen tiles in three-player games', () => {
    const session = Kingdomino.create('kingdomino-three', players(['a', 'b', 'c']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.draft.length, 3);
    for (const tile of [game.draft[0], game.draft[1], game.draft[2]]) {
        const current = game.currentQueue[game.currentQueueIndex];
        assert.equal(session.handleAction(current.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    }
    assert.equal(game.phase, 'placing');
    assert.equal(game.discarded.length, 0);
});

test('Kingdomino rejects selecting a domino already claimed by another player', () => {
    const session = Kingdomino.create('kingdomino-duplicate', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const tile = game.draft[0];
    const firstPlayer = game.currentQueue[game.currentQueueIndex].playerId;
    const secondPlayer = game.currentQueue[(game.currentQueueIndex + 1) % game.currentQueue.length].playerId;
    assert.equal(session.handleAction(firstPlayer, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    assert.equal(session.handleAction(secondPlayer, { kind: 'selectDomino', dominoId: tile.id }).success, false);
    assert.equal(game.selected.size, 1);
});

test('Kingdomino completes a deterministic four-player twelve-round kingdom', () => {
    const game = new KingdominoEngine('kingdomino-full', players(['a', 'b', 'c', 'd']), () => 0);
    assert.equal(game.start().success, true);
    let steps = 0;
    while (game.status === 'playing' && steps < 2000) {
        if (game.phase === 'selecting') {
            const token = game.currentQueue[game.currentQueueIndex];
            const used = new Set([...game.selected.values()].map(tile => tile.id));
            const tile = game.draft.find(candidate => !used.has(candidate.id));
            assert.ok(tile);
            assert.equal(game.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
        } else {
            const token = game.currentQueue[game.currentQueueIndex];
            const tile = game.selected.get(game._tokenKey(token));
            const player = game.playerMap[token.playerId];
            let placement = null;
            for (let x = 0; x < game.boardSize && !placement; x += 1) for (let y = 0; y < game.boardSize && !placement; y += 1) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                const candidate = { first: { x, y }, second: { x: x + dx, y: y + dy } };
                if (game._canPlace(player, tile, candidate)) placement = candidate;
            }
            const result = placement
                ? game.handleAction(player.id, { kind: 'placeDomino', x1: placement.first.x, y1: placement.first.y, x2: placement.second.x, y2: placement.second.y })
                : game.handleAction(player.id, { kind: 'discardDomino' });
            assert.equal(result.success, true, result.message);
        }
        steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.equal(game.round, 12); assert.ok(game.winner); assert.ok(steps < 2000);
});

test('Acquire can discard an unplayable tile and continue to stock purchase', () => {
    const session = Acquire.create('acquire-discard', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true; game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }, ...game.playerMap[currentId].hand.filter(tile => tile.id !== 'A3').slice(0, 5)];
    const tileId = 'A3';
    assert.equal(session.handleAction(currentId, { kind: 'discardTile', tileId }).success, true);
    assert.equal(game.phase, 'buy');
    assert.equal(game.playerMap[currentId].hand.length, 5);
});

test('Acquire exposes the official end-game declaration conditions and liquidates stock value', () => {
    const session = Acquire.create('acquire-end', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 41 }, (_, index) => `A${index + 1}`);
    game.players[0].shares.sackson = 3; game.players[0].cash = 5000; game.phase = 'buy'; game.currentTurnIndex = 0;
    assert.equal(game.getPlayerState('a').availableActions.canEndGame, true);
    assert.equal(session.handleAction('a', { kind: 'endGame' }).success, true);
    assert.equal(game.status, 'playing'); assert.equal(game.endGamePending, true);
    assert.equal(session.handleAction('a', { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'a'); assert.equal(game.players[0].cash, 23000); assert.equal(game.players[0].shares.sackson, 0);
});

test('Acquire completes a deterministic four-player tile, merger, stock, and liquidation game', () => {
    const game = new AcquireEngine('acquire-full', players(['a', 'b', 'c', 'd']), () => 0); game.start();
    let steps = 0;
    while (game.status === 'playing' && steps < 5000) {
        const current = game.phase === 'merger_settlement'
            ? game.playerMap[game.pendingMerger.queue[game.pendingMerger.queueIndex]]
            : game.players[game.currentTurnIndex];
        let result;
        if (game.phase === 'place') {
            const tile = current.hand[0];
            if (!tile) { result = game.handleAction(current.id, { kind: 'buyShares', orders: {} }); }
            else {
                result = game.handleAction(current.id, { kind: 'placeTile', tileId: tile.id });
                if (!result.success) result = game.handleAction(current.id, { kind: 'discardTile', tileId: tile.id });
            }
        } else if (game.phase === 'foundation') {
            const chain = Object.values(game.corporations).find(corporation => !corporation.active);
            result = game.handleAction(current.id, { kind: 'foundChain', chainId: chain.id });
        } else if (game.phase === 'merger') {
            const chainId = game.pendingMerger.chains.slice().sort((a, b) => game.corporations[b].tiles.length - game.corporations[a].tiles.length)[0];
            result = game.handleAction(current.id, { kind: 'chooseMerger', chainId });
        } else if (game.phase === 'merger_settlement') {
            const chainId = game.pendingMerger.queueChainId;
            result = game.handleAction(current.id, { kind: 'settleMergerShares', chainId, sell: current.shares[chainId], trade: 0, keep: 0 });
        } else if (game.phase === 'buy') {
            const chain = Object.values(game.corporations).find(corporation => corporation.active && corporation.sharesAvailable > 0);
            result = game.handleAction(current.id, { kind: 'buyShares', orders: chain ? { [chain.id]: 1 } : {} });
        }
        assert.equal(result?.success, true, result?.message);
        steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(steps < 5000); assert.equal(game.deck.length, 0);
});

test('Take Five builds the correct deck and bullhead values', () => {
    const deck = TakeFiveEngine.buildDeck();
    assert.equal(deck.length, 104);
    assert.equal(TakeFiveEngine.bullheads(55), 7);
    assert.equal(TakeFiveEngine.bullheads(11), 5);
    assert.equal(TakeFiveEngine.bullheads(50), 3);
    assert.equal(TakeFiveEngine.bullheads(25), 2);
});

test('Take Five waits for all players before resolving selected cards', () => {
    const session = TakeFive.create('takefive', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.rows = [[{ id: 'r1', value: 1, bullheads: 1 }], [{ id: 'r2', value: 2, bullheads: 1 }], [{ id: 'r3', value: 3, bullheads: 1 }], [{ id: 'r4', value: 4, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-card', value: 60, bullheads: 1 }];
    game.players[1].hand = [{ id: 'b-card', value: 70, bullheads: 1 }];
    const aCard = 'a-card';
    const bCard = 'b-card';
    assert.equal(session.handleAction('a', { kind: 'selectCard', cardId: aCard }).success, true);
    assert.equal(game.phase, 'selecting');
    assert.equal(session.getPlayerState('b').myHand.length, 1);
    assert.equal(session.handleAction('b', { kind: 'selectCard', cardId: bCard }).success, true);
    assert.equal(game.round, 2);
    assert.equal(game.phase, 'selecting');
    assert.equal(game.players[0].hand.length, 0);
    assert.equal(game.players[1].hand.length, 0);
});

test('Take Five requires the low card player to choose a row', () => {
    const session = TakeFive.create('takefive-low', players(['a', 'b'])); session.start(); const game = session.engine;
    game.rows = [[{ id: 'r1', value: 20, bullheads: 1 }], [{ id: 'r2', value: 30, bullheads: 1 }], [{ id: 'r3', value: 40, bullheads: 1 }], [{ id: 'r4', value: 50, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'low', value: 5, bullheads: 2 }]; game.players[1].hand = [{ id: 'high', value: 60, bullheads: 1 }]; game.round = 1; game.selected.clear(); game.phase = 'selecting';
    session.handleAction('a', { kind: 'selectCard', cardId: 'low' }); session.handleAction('b', { kind: 'selectCard', cardId: 'high' });
    assert.equal(game.phase, 'choose_row'); assert.equal(game.pendingRowChoice.playerId, 'a');
    assert.equal(session.handleAction('a', { kind: 'chooseRow', rowIndex: 2 }).success, true); assert.equal(game.players[0].score, 0); assert.equal(game.players[0].roundScore, 1); assert.equal(game.lastResolution.length, 2);
});

test('Take Five starts a new hand after ten rounds until someone reaches 66 points', () => {
    const session = TakeFive.create('takefive-end', players(['a', 'b'])); session.start(); const game = session.engine;
    game.round = 10;
    game.rows = [[{ id: 'r1', value: 1, bullheads: 1 }], [{ id: 'r2', value: 2, bullheads: 1 }], [{ id: 'r3', value: 3, bullheads: 1 }], [{ id: 'r4', value: 4, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-end', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-end', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-end' });
    const result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-end' });
    assert.equal(result.ended, false); assert.equal(game.phase, 'selecting'); assert.equal(game.round, 1); assert.equal(game.handNumber, 2); assert.equal(game.players[0].score, 0); assert.equal(game.players[1].score, 0); assert.equal(game.players[0].hand.length, 10); assert.equal(game.players[1].hand.length, 10);
});

test('Take Five ends after a hand when the accumulated score reaches 66', () => {
    const session = TakeFive.create('takefive-target', players(['a', 'b'])); session.start(); const game = session.engine;
    game.round = 10; game.players[0].score = 61; game.players[1].score = 4;
    game.rows = [[{ id: 'r1', value: 10, bullheads: 1 }, { id: 'r1b', value: 20, bullheads: 1 }, { id: 'r1c', value: 30, bullheads: 1 }, { id: 'r1d', value: 40, bullheads: 1 }, { id: 'r1e', value: 50, bullheads: 1 }], [{ id: 'r2', value: 91, bullheads: 1 }], [{ id: 'r3', value: 92, bullheads: 1 }], [{ id: 'r4', value: 93, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-target', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-target', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    const first = session.handleAction('a', { kind: 'selectCard', cardId: 'a-target' });
    assert.equal(first.success, true);
    const result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-target' });
    assert.equal(result.ended, true); assert.equal(game.phase, 'ended'); assert.equal(game.handNumber, 1); assert.equal(game.round, 10); assert.equal(game.players[0].score, 66); assert.equal(game.winner.id, 'b');
});

test('Take Five finishes all ten rounds before checking 66 points', () => {
    const session = TakeFive.create('takefive-early-target', players(['a', 'b'])); session.start(); const game = session.engine;
    game.round = 3; game.players[0].score = 65; game.players[1].score = 2;
    game.rows = [[{ id: 'r1', value: 10, bullheads: 1 }, { id: 'r1b', value: 20, bullheads: 1 }, { id: 'r1c', value: 30, bullheads: 1 }, { id: 'r1d', value: 40, bullheads: 1 }, { id: 'r1e', value: 50, bullheads: 1 }], [{ id: 'r2', value: 91, bullheads: 1 }], [{ id: 'r3', value: 92, bullheads: 1 }], [{ id: 'r4', value: 93, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-early', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-early', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-early' });
    const result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-early' });
    assert.equal(result.ended, false); assert.equal(game.phase, 'selecting'); assert.equal(game.round, 4); assert.equal(game.players[0].score, 65); assert.equal(game.players[0].roundScore, 5); assert.equal(game.winner, null);
});

test('Take Five returns every tied low scorer as a shared winner', () => {
    const session = TakeFive.create('takefive-tied-winners', players(['a', 'b', 'c'])); session.start(); const game = session.engine;
    game.round = 10; game.players[0].score = 10; game.players[1].score = 10; game.players[2].score = 66;
    game.rows = [[{ id: 'r1', value: 1, bullheads: 1 }], [{ id: 'r2', value: 2, bullheads: 1 }], [{ id: 'r3', value: 3, bullheads: 1 }], [{ id: 'r4', value: 4, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-tie', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-tie', value: 70, bullheads: 1 }]; game.players[2].hand = [{ id: 'c-tie', value: 80, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-tie' });
    session.handleAction('b', { kind: 'selectCard', cardId: 'b-tie' });
    const result = session.handleAction('c', { kind: 'selectCard', cardId: 'c-tie' });
    assert.equal(result.ended, true); assert.deepEqual(game.winners.map(player => player.id), ['a', 'b']); assert.deepEqual(result.winners.map(player => player.id), ['a', 'b']); assert.deepEqual(result.state.winners.map(player => player.id), ['a', 'b']);
});

test('Take Five reveals every selected card before a low-card row choice', () => {
    const session = TakeFive.create('takefive-reveal', players(['a', 'b', 'c'])); session.start(); const game = session.engine;
    game.rows = [[{ id: 'r1', value: 20, bullheads: 1 }], [{ id: 'r2', value: 30, bullheads: 1 }], [{ id: 'r3', value: 40, bullheads: 1 }], [{ id: 'r4', value: 50, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-reveal', value: 5, bullheads: 2 }]; game.players[1].hand = [{ id: 'b-reveal', value: 25, bullheads: 1 }]; game.players[2].hand = [{ id: 'c-reveal', value: 60, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-reveal' }); session.handleAction('b', { kind: 'selectCard', cardId: 'b-reveal' });
    const result = session.handleAction('c', { kind: 'selectCard', cardId: 'c-reveal' });
    assert.equal(result.state.phase, 'choose_row'); assert.deepEqual(result.state.revealedCards.map(item => item.card.value), [5, 25, 60]); assert.deepEqual(result.state.revealedCards.map(item => item.playerId), ['a', 'b', 'c']);
});

test('Take Five settles the bull pile only after the tenth card of a hand', () => {
    const session = TakeFive.create('takefive-settlement', players(['a', 'b'])); session.start(); const game = session.engine;
    game.round = 9; game.rows = [[{ id: 'r1', value: 10, bullheads: 1 }, { id: 'r1b', value: 20, bullheads: 1 }, { id: 'r1c', value: 30, bullheads: 1 }, { id: 'r1d', value: 40, bullheads: 1 }, { id: 'r1e', value: 50, bullheads: 1 }], [{ id: 'r2', value: 1, bullheads: 1 }], [{ id: 'r3', value: 2, bullheads: 1 }], [{ id: 'r4', value: 3, bullheads: 1 }]];
    game.players[0].hand = [{ id: 'a-settle', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-settle', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-settle' }); const ninth = session.handleAction('b', { kind: 'selectCard', cardId: 'b-settle' });
    assert.equal(ninth.ended, false); assert.equal(game.round, 10); assert.equal(game.players[0].score, 0); assert.equal(game.players[0].roundScore, 5); assert.equal(game.lastHand, null);
    game.rows = [[{ id: 'r1-next', value: 1, bullheads: 1 }], [{ id: 'r2-next', value: 2, bullheads: 1 }], [{ id: 'r3-next', value: 3, bullheads: 1 }], [{ id: 'r4-next', value: 4, bullheads: 1 }]]; game.players[0].hand = [{ id: 'a-final', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-final', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-final' }); const final = session.handleAction('b', { kind: 'selectCard', cardId: 'b-final' });
    assert.equal(final.ended, false); assert.equal(game.handNumber, 2); assert.equal(game.lastHand.scores.find(item => item.id === 'a').penalty, 5); assert.equal(game.players[0].score, 5);
});

test('Take Five supports the official two-to-six-player professional draft variant', () => {
    const session = TakeFive.create('takefive-pro', players(['a', 'b', 'c']), { variant: 'pro' }); assert.equal(session.start().success, true); const game = session.engine;
    assert.equal(game.phase, 'drafting'); assert.equal(game.draftPool.length, 34); assert.equal(game.getPublicState().draft.cards.length, 34);
    let picks = 0;
    while (game.phase === 'drafting') {
        const player = game.players[game.draftTurnIndex];
        assert.equal(session.handleAction(player.id, { kind: 'draftCard', cardId: game.draftPool[0].id }).success, true);
        picks += 1;
    }
    assert.equal(picks, 30); assert.equal(game.phase, 'selecting'); assert.equal(game.rows.length, 4); assert.deepEqual(game.players.map(player => player.hand.length), [10, 10, 10]);
});

test('Take Five supports custom target scores and fixed-hand endings', () => {
    const session = TakeFive.create('takefive-fixed', players(['a', 'b']), { targetScore: null, maxHands: 1 }); assert.equal(session.start().success, true); const game = session.engine;
    game.round = 10; game.rows = [[{ id: 'r1-fixed', value: 1, bullheads: 1 }], [{ id: 'r2-fixed', value: 2, bullheads: 1 }], [{ id: 'r3-fixed', value: 3, bullheads: 1 }], [{ id: 'r4-fixed', value: 4, bullheads: 1 }]]; game.players[0].hand = [{ id: 'a-fixed', value: 60, bullheads: 1 }]; game.players[1].hand = [{ id: 'b-fixed', value: 70, bullheads: 1 }]; game.phase = 'selecting'; game.selected.clear();
    session.handleAction('a', { kind: 'selectCard', cardId: 'a-fixed' }); const result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-fixed' });
    assert.equal(result.ended, true); assert.equal(game.targetScore, null); assert.equal(game.maxHands, 1); assert.deepEqual(game.winners.map(player => player.id), ['a', 'b']);
});

test('Take Five room options reach the session through the lobby adapter', () => {
    const room = new Room('takefive-options', 'a', 'a', 'takefive', { variant: 'pro', targetScore: null, maxHands: 1 }); room.addPlayer({ id: 'a', name: 'a' }); room.addPlayer({ id: 'b', name: 'b' });
    assert.equal(room.startGame().success, true); assert.equal(room.game.engine.variant, 'pro'); assert.equal(room.game.engine.targetScore, null); assert.equal(room.game.engine.maxHands, 1); assert.equal(room.getInfo().gameOptions.variant, 'pro');
});

test('Splendor builds a 90-card market and scales token supply', () => {
    const cards = SplendorEngine.buildCards();
    assert.equal(cards.length, 90);
    assert.equal(new Set(cards.map(card => card.id)).size, 90);
    assert.deepEqual(cards.find(card => card.id === 's1-white-L1-02'), { id: 's1-white-L1-02', tier: 1, bonus: 'white', points: 1, cost: { green: 4 } });
    assert.deepEqual(cards.find(card => card.id === 's3-black-L3-04'), { id: 's3-black-L3-04', tier: 3, bonus: 'black', points: 5, cost: { red: 7, black: 3 } });
    const session = Splendor.create('splendor', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.engine.tokens.white, 4);
    assert.equal(session.engine.market[1].length, 4);
    assert.equal(session.engine.nobles.length, 3);
});

test('Splendor validates token actions and keeps private reservations private', () => {
    const session = Splendor.create('splendor-actions', players(['a', 'b']), { startingPlayerId: 'a' }); session.start(); const game = session.engine;
    assert.equal(session.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue', 'green'] }).success, true);
    assert.equal(game.players[0].tokens.white, 1);
    assert.equal(session.handleAction('b', { kind: 'takeTokens', colors: ['red', 'red'] }).success, true);
    assert.equal(game.players[1].tokens.red, 2);
    const card = game.market[1][0]; game.currentTurnIndex = 0;
    assert.equal(session.handleAction('a', { kind: 'reserveCard', cardId: card.id }).success, true);
    assert.equal(session.getPlayerState('a').myReserved.length, 1);
    assert.equal(session.getPlayerState('b').myReserved.length, 0);
});

test('Splendor follows the official token-taking shortage rules', () => {
    const game = new SplendorEngine('splendor-tokens', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue', 'green'] }).success, true);
    game.currentTurnIndex = 0;
    game.tokens = { white: 1, blue: 1, green: 0, red: 0, black: 0, gold: 5 };
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, true);
    assert.equal(game.players[0].tokens.white >= 1, true);
});

test('Splendor forces excess gems to be returned after taking or reserving', () => {
    const game = new SplendorEngine('splendor-return', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    game.players[0].tokens = { white: 9, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    game.tokens.white = 7; game.tokens.blue = 7; game.tokens.green = 7; game.tokens.red = 7; game.tokens.black = 7;
    const take = game.handleAction('a', { kind: 'takeTokens', colors: ['blue', 'green', 'red'] });
    assert.equal(take.success, true);
    assert.equal(game.phase, 'return_tokens');
    assert.equal(game.pendingTokenReturn.amount, 2);
    assert.equal(game.currentTurnIndex, 0);
    assert.equal(game.handleAction('a', { kind: 'returnTokens', colors: ['white', 'white'] }).success, true);
    assert.equal(game.phase, 'action');
    assert.equal(game._tokenTotal(game.players[0]) <= 10, true);

    game.currentTurnIndex = 0;
    game.players[0].tokens = { white: 10, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    game.tokens.gold = 1;
    const card = game.market[1][0];
    assert.equal(game.handleAction('a', { kind: 'reserveCard', cardId: card.id }).success, true);
    assert.equal(game.phase, 'return_tokens');
    assert.equal(game.pendingTokenReturn.amount, 1);
});

test('Splendor supports reserving a hidden top-deck card and resolves tied scoring', () => {
    const game = new SplendorEngine('splendor-deck-reserve', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    assert.equal(game.handleAction('a', { kind: 'reserveCard', tier: 2 }).success, true);
    assert.equal(game.players[0].reserved.length, 1);
    assert.equal(game.getPlayerState('a').myReserved.length, 1);
    assert.equal(game.getPlayerState('b').myReserved.length, 0);
    game.status = 'playing'; game.phase = 'action'; game.currentTurnIndex = 0; game.finalRoundStart = 0;
    game.players[0].points = 15; game.players[1].points = 15;
    game.players[0].cards = game.players[0].cards.slice(0, 1); game.players[1].cards = game.players[1].cards.slice(0, 1);
    const result = game._finishGame('points');
    assert.equal(result.success, true);
    assert.equal(game.winner, null);
    assert.equal(game.winners.length, 2);
});

test('Splendor completes a deterministic four-player game through nobles and the final round', () => {
    const game = new SplendorEngine('splendor-full', players(['a', 'b', 'c', 'd']), () => 0); game.start();
    let steps = 0;
    while (game.status === 'playing' && steps < 1000) {
        const current = game.players[game.currentTurnIndex];
        let result;
        if (game.pendingTokenReturn) {
            const toReturn = [];
            for (const color of [...SplendorEngine.COLORS, 'gold']) {
                for (let count = 0; count < current.tokens[color] && toReturn.length < game.pendingTokenReturn.amount; count += 1) toReturn.push(color);
            }
            result = game.handleAction(current.id, { kind: 'returnTokens', colors: toReturn });
        } else if (game.pendingNoble) result = game.handleAction(current.id, { kind: 'chooseNoble', nobleId: game.pendingNoble.options[0].id });
        else {
            const candidates = [...game.market[1], ...game.market[2], ...game.market[3], ...current.reserved];
            const discounts = Object.fromEntries(SplendorEngine.COLORS.map(color => [color, current.cards.filter(card => card.bonus === color).length]));
            const affordable = candidates.find(card => SplendorEngine.COLORS.every(color => Math.max(0, (card.cost[color] || 0) - discounts[color]) <= current.tokens[color] + current.tokens.gold));
            if (affordable) result = game.handleAction(current.id, { kind: 'buyCard', cardId: affordable.id, fromReserve: current.reserved.some(card => card.id === affordable.id) });
            else {
                const available = SplendorEngine.COLORS.filter(color => game.tokens[color] > 0);
                const colors = available.length >= 3 ? available.slice(0, 3) : available;
                result = game.handleAction(current.id, { kind: 'takeTokens', colors });
            }
        }
        assert.equal(result.success, true, result.message); steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(steps < 1000); assert.ok(game.finalRoundStart !== null);
});

test('Hanabi builds a 50-card deck and hides each player hand from itself', () => {
    assert.equal(HanabiEngine.buildDeck().length, 50);
    const session = Hanabi.create('hanabi', players(['a', 'b']), { startingPlayerId: 'a' });
    assert.equal(session.start().success, true);
    const stateA = session.getPlayerState('a');
    assert.equal(stateA.myHand.length, 5);
    assert.equal(stateA.players.find(player => player.id === 'a').hand[0].color, null);
    assert.ok(stateA.players.find(player => player.id === 'b').hand[0].color);
    assert.equal(session.engine.getPublicState().players.every(player => player.hand.every(card => card.color === null && card.value === null)), true);
    assert.equal(session.handleAction('a', { kind: 'discardCard', cardIndex: 0 }).success, false);
    session.engine.clues = 7;
    const acknowledgement = session.handleAction('a', { kind: 'discardCard', cardIndex: 0 });
    assert.equal(acknowledgement.success, true);
    assert.equal(acknowledgement.state.players.every(player => player.hand.every(card => card.color === null && card.value === null)), true);
});

test('Hanabi clues update only the target knowledge and consume a clue token', () => {
    const session = Hanabi.create('hanabi-clue', players(['a', 'b']), { startingPlayerId: 'a' }); session.start(); const game = session.engine;
    const targetColor = game.players[1].hand[0].color;
    const before = game.clues;
    assert.equal(session.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: targetColor }).success, true);
    assert.equal(game.clues, before - 1);
    assert.ok(game.players[1].hand.some(card => card.hints.colors.includes(targetColor)));
    assert.ok(game.players[1].hand.some(card => card.color !== targetColor && card.hints.notColors.includes(targetColor)));
    assert.equal(session.getPlayerState('a').players.find(player => player.id === 'a').hand[0].color, null);
});

test('Hanabi gives complete clue information and keeps successful cards out of discard', () => {
    const game = new HanabiEngine('hanabi-complete-clue', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    const card = (id, color, value) => ({ id, color, value, hints: { colors: [], values: [] } });
    game.players[0].hand = [card('a-red', 'red', 1)];
    game.players[1].hand = [card('b-red', 'red', 1), card('b-blue', 'blue', 2), card('b-red-2', 'red', 4)];
    game.deck = [card('draw', 'yellow', 1)];
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'red' }).success, true);
    assert.ok(game.players[1].hand[0].hints.colors.includes('red'));
    assert.ok(game.players[1].hand[2].hints.colors.includes('red'));
    assert.ok(game.players[1].hand[1].hints.notColors.includes('red'));
    assert.equal(game.handleAction('b', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.fireworks.red, 1);
    assert.equal(game.discard.length, 0);
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'white' }).success, false);
});

test('Hanabi completes a 25-point game and uses the final-round rule after the deck empties', () => {
    const game = new HanabiEngine('hanabi-perfect', players(['a', 'b']), () => 0);
    assert.equal(game.start().success, true);
    const sequence = HanabiEngine.COLORS.flatMap(color => [1, 2, 3, 4, 5].map(value => ({ id: `test-${color}-${value}`, color, value })));
    const hidden = card => ({ ...card, hints: { colors: [], values: [] } });
    game.players[0].hand = [hidden(sequence[0])];
    game.players[1].hand = [hidden(sequence[1])];
    game.deck = sequence.slice(2).map(hidden).reverse();
    game.clues = 0;
    let turns = 0;
    while (game.status === 'playing' && turns < sequence.length) {
        const current = game.players[game.currentTurnIndex];
        assert.equal(game.handleAction(current.id, { kind: 'playCard', cardIndex: 0 }).success, true);
        turns += 1;
    }
    assert.equal(turns, 25);
    assert.equal(game.status, 'ended');
    assert.equal(Object.values(game.fireworks).every(value => value === 5), true);
    assert.equal(game.strikes, 0);
    assert.equal(game.deck.length, 0);
    assert.equal(game.endReason, 'deck');
    assert.equal(game.finalTurnsRemaining, 0);
    assert.equal(game.winner, null);
    assert.equal(game.discard.length, 0);
});

test('Hanabi ends immediately after three failed plays', () => {
    const game = new HanabiEngine('hanabi-strikes', players(['a', 'b']), () => 0);
    game.start();
    const wrong = value => ({ id: `wrong-${value}`, color: 'yellow', value: 2, hints: { colors: [], values: [] } });
    game.players.forEach(player => { player.hand = [wrong(player.id)]; });
    game.deck = [wrong('x'), wrong('y'), wrong('z')];
    for (const id of ['a', 'b', 'a']) assert.equal(game.handleAction(id, { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.strikes, 3);
    assert.equal(game.winner, null);
});

test('Aeroplane Chess assigns colors in the classic board corner order', () => {
    const session = Aeroplane.create('flight-board-colors', players(['a', 'b', 'c', 'd']));
    assert.equal(session.start().success, true);
    assert.deepEqual(session.engine.players.map(player => player.color), ['blue', 'green', 'red', 'yellow']);
    assert.equal(session.start().success, false, '已开始的飞行棋不能重复开始');
    const tooMany = Aeroplane.create('flight-too-many', players(['a', 'b', 'c', 'd', 'e']));
    assert.equal(tooMany.engine.players.length, 5, '构造阶段不能静默截断第 5 名玩家');
    assert.equal(tooMany.start().success, false, '飞行棋只允许 2–4 名玩家');
});

test('Aeroplane Chess enters the waiting point on six, then joins the main track on a later roll', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
        const session = Aeroplane.create('flight', players(['a', 'b']));
        const game = session.engine;
        assert.equal(session.start().success, true);
        const roll = session.handleAction('a', { kind: 'rollDice' });
        assert.equal(roll.success, true); assert.equal(game.dice, 6); assert.equal(game.phase, 'choose_plane');
        assert.equal(game.lastAction.rollId, 1); assert.equal(game.getPublicState().lastAction.dice, 6);
        const launchedPlaneId = game.movablePlaneIds[0];
        const move = session.handleAction('a', { kind: 'movePlane', planeId: launchedPlaneId });
        assert.equal(move.success, true); assert.equal(game.planes[0].status, 'ready'); assert.equal(game.planes[0].progress, -1); assert.equal(game.planes[0].globalPosition, null);
        assert.deepEqual(game.lastAction.events, ['进入起飞等待点']); assert.equal(game.phase, 'await_roll');
        assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, true); assert.equal(game.lastAction.rollId, 2);
        assert.equal(game.movablePlaneIds.includes(launchedPlaneId), true);
        assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: launchedPlaneId }).success, true);
        assert.equal(game.planes[0].status, 'flying'); assert.equal(game.planes[0].progress, 9); assert.equal(game.planes[0].globalPosition, 9);
    } finally { Math.random = originalRandom; }
});

test('Aeroplane Chess captures on landing and requires exact home arrival', () => {
    const session = Aeroplane.create('flight-rules', players(['a', 'b'])); session.start(); const game = session.engine;
    const red = game.planes.find(plane => plane.id === 'a-plane-1'); const blue = game.planes.find(plane => plane.id === 'b-plane-1');
    red.progress = 0; red.status = 'flying'; red.globalPosition = 0; blue.progress = 45; blue.status = 'flying'; blue.globalPosition = 6;
    game.phase = 'choose_plane'; game.dice = 6; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true); assert.equal(blue.status, 'base');
    red.progress = 52; red.status = 'home'; red.globalPosition = null; game.phase = 'choose_plane'; game.dice = 3; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true); assert.equal(red.status, 'finished'); assert.equal(red.progress, 55);
});

test('Aeroplane Chess turns into the home lane after 50 shared-route cells', () => {
    const session = Aeroplane.create('flight-home-entry', players(['a', 'b'])); session.start(); const game = session.engine;
    const plane = game.planes.find(item => item.id === 'a-plane-1');
    plane.progress = 49; plane.status = 'flying'; plane.globalPosition = 49;
    game.phase = 'choose_plane'; game.dice = 1; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 50);
    assert.equal(plane.status, 'home');
    assert.equal(plane.globalPosition, null);
});

test('Aeroplane Chess protects a two-plane enemy stack', () => {
    const session = Aeroplane.create('flight-stack', players(['a', 'b'])); session.start(); const game = session.engine;
    const red = game.planes.find(plane => plane.id === 'a-plane-1');
    const blue = game.planes.filter(plane => plane.playerId === 'b').slice(0, 2);
    red.progress = 0; red.status = 'flying'; red.globalPosition = 0;
    blue.forEach(plane => { plane.progress = 45; plane.status = 'flying'; plane.globalPosition = 6; });
    game.phase = 'choose_plane'; game.dice = 6; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true);
    assert.equal(blue.every(plane => plane.status === 'flying'), true);
});

test('Aeroplane Chess applies direct flight-line chaining and jump-to-flight stopping', () => {
    const session = Aeroplane.create('flight-lines', players(['a', 'b'])); session.start(); const game = session.engine;
    const plane = game.planes.find(item => item.id === 'a-plane-1'); plane.progress = 12; plane.status = 'flying'; plane.globalPosition = 12;
    game.phase = 'choose_plane'; game.dice = 5; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 33);
    assert.deepEqual(game.lastMove.path.map(step => step.progress), [13, 14, 15, 16, 17, 29, 33]);
    game.status = 'playing'; game.phase = 'choose_plane'; game.currentTurnIndex = 0; game.dice = 4;
    plane.progress = 9; plane.status = 'flying'; plane.globalPosition = 9; game.movablePlaneIds = [plane.id]; game.lastMove = null;
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 29);
    assert.deepEqual(game.lastMove.path.map(step => step.progress), [10, 11, 12, 13, 17, 29]);
});

test('Aeroplane Chess uses the board colour sequence for same-colour jumps', () => {
    const session = Aeroplane.create('flight-colour-jumps', players(['a', 'b'])); session.start(); const game = session.engine;
    assert.deepEqual(game.getPublicState().rules.jumpProgress, [1, 5, 9, 13, 21, 25, 29, 33, 37, 41, 45]);
    assert.equal(game.getPublicState().rules.flightProgress, 17);
    assert.equal(game.getPublicState().rules.flightDistance, 12);
    const plane = game.planes.find(item => item.id === 'a-plane-1');
    plane.progress = 0; plane.status = 'flying'; plane.globalPosition = 0;
    game.phase = 'choose_plane'; game.dice = 1; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 5);
    assert.equal(plane.globalPosition, 5);
    assert.deepEqual(game.lastMove.events, ['同色跳跃']);
});

test('Aeroplane Chess completes a full four-player game with all special movement rules', () => {
    const diceSequence = [6, 5, 6, 5, 3];
    let rollIndex = 0;
    const session = Aeroplane.create(
        'flight-full',
        players(['a', 'b', 'c', 'd']),
        () => diceSequence[rollIndex++ % diceSequence.length] / 6 - 0.0001,
    );
    const game = session.engine;
    assert.equal(session.start().success, true);
    let actions = 0;
    let sawFlight = false;
    while (game.status === 'playing' && actions < 1000) {
        const current = game.getCurrentPlayer();
        const result = game.phase === 'await_roll'
            ? session.handleAction(current.id, { kind: 'rollDice' })
            : session.handleAction(current.id, { kind: 'movePlane', planeId: game.movablePlaneIds[0] });
        assert.equal(result.success, true, result.message);
        if (result.state.lastAction?.events?.some(event => event.includes('飞行线'))) sawFlight = true;
        actions += 1;
    }
    assert.equal(game.status, 'ended');
    assert.ok(game.winner);
    assert.equal(game.planes.filter(plane => plane.playerId === game.winner.id && plane.status === 'finished').length, 4);
    assert.equal(sawFlight, true);
    assert.ok(actions < 1000);
});

test('Xiangqi validates river crossing and alternates legal moves', () => {
    const session = Xiangqi.create('xiangqi-rules', players(['a', 'b'])); assert.equal(session.start().success, true);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }).success, false);
    assert.equal(session.handleAction('b', { kind: 'move', from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }).success, true);
    assert.equal(session.engine.turn, 'red');
});

test('Xiangqi warns after two consecutive checks and only penalizes long check on repetition', () => {
    const session = Xiangqi.create('xiangqi-check-warning', [{ id: 'a', name: '红方' }, { id: 'b', name: '黑方' }]);
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.board = new Map([
        ['4,9', { id: 'rk', type: 'k', color: 'red' }],
        ['4,5', { id: 'rs', type: 's', color: 'red' }],
        ['3,1', { id: 'rr', type: 'r', color: 'red' }],
        ['4,0', { id: 'bk', type: 'k', color: 'black' }]
    ]);
    game.turn = 'red'; game.currentTurnIndex = 0; game.positionCounts.clear(); game._recordPosition();
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 3, y: 1 }, to: { x: 4, y: 1 } }).state.longCheckWarning, null);
    assert.equal(session.handleAction('b', { kind: 'move', from: { x: 4, y: 0 }, to: { x: 5, y: 0 } }).success, true);
    const warned = session.handleAction('a', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 5, y: 1 } });
    assert.equal(warned.ended, false);
    assert.deepEqual(warned.state.longCheckWarning, { color: 'red', playerId: 'a', playerName: '红方', count: 2, message: '红方 已连续将军 2 次；再次形成三次重复局面，长将方判负' });
    assert.equal(warned.state.lastMove.gaveCheck, true);
    assert.equal(warned.state.lastMove.piece.id, 'rr');
    assert.deepEqual(warned.state.lastMove.checkingPieceIds, ['rr']);
    assert.match(warned.state.actionLog.at(-1), /连续将军 2 次/);

    const discovered = Xiangqi.create('xiangqi-discovered-check', players(['red', 'black'])); discovered.start();
    discovered.engine.board = new Map([
        ['3,9', { id: 'rk', type: 'k', color: 'red' }],
        ['4,5', { id: 'rr', type: 'r', color: 'red' }],
        ['4,3', { id: 'rs', type: 's', color: 'red' }],
        ['4,0', { id: 'bk', type: 'k', color: 'black' }]
    ]);
    discovered.engine.turn = 'red'; discovered.engine.currentTurnIndex = 0;
    const openedLine = discovered.handleAction('red', { kind: 'move', from: { x: 4, y: 3 }, to: { x: 3, y: 3 } });
    assert.equal(openedLine.success, true);
    assert.equal(openedLine.state.lastMove.piece.id, 'rs');
    assert.deepEqual(openedLine.state.lastMove.checkingPieceIds, ['rr'], '红光应标记真正将军的车，而不是闪开线路的兵');

    game.checkStreak.red = 6; game.chaseStreak.red = 6; game.positionCounts.clear(); game._recordPosition(); game._evaluate();
    assert.equal(game.status, 'playing', '连续计数本身不能在未重复局面时突然判负');

    const repeated = Xiangqi.create('xiangqi-long-check-loss', players(['red', 'black'])); repeated.start();
    repeated.engine.turn = 'black'; repeated.engine.currentTurnIndex = 1;
    repeated.engine.lastMove = { piece: { id: 'checking-rook', type: 'r', color: 'red' }, gaveCheck: true, checkCount: 3 };
    repeated.engine.checkStreak.red = 3;
    repeated.engine.positionCounts.clear(); repeated.engine.positionCounts.set(repeated.engine._positionKey(), 3);
    repeated.engine._evaluate();
    assert.equal(repeated.engine.status, 'ended');
    assert.equal(repeated.engine.winner.id, 'black');
    assert.match(repeated.engine.actionLog.at(-1), /长将获胜/);
});

test('Xiangqi ends a repeated or no-progress position instead of looping forever', () => {
    const session = Xiangqi.create('xiangqi-draw', players(['a', 'b'])); assert.equal(session.start().success, true);
    const game = session.engine;
    game.positionCounts.set(game._positionKey(), 3);
    game._evaluate();
    assert.equal(game.status, 'ended');
    assert.equal(game.drawReason, '三次重复局面和棋');

    const second = Xiangqi.create('xiangqi-quiet', players(['a', 'b'])); assert.equal(second.start().success, true);
    second.engine.quietHalfmoves = 120;
    second.engine._evaluate();
    assert.equal(second.engine.status, 'ended');
    assert.equal(second.engine.drawReason, '六十回合无吃子和棋');
});

test('Xiangqi does not capture the general and treats stalemate as a loss', () => {
    const session = Xiangqi.create('xiangqi-formal', players(['a', 'b'])); session.start(); const game = session.engine;
    game.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black' }],
        ['0,1', { id: 'rr', type: 'r', color: 'red' }],
        ['4,9', { id: 'rk', type: 'k', color: 'red' }]
    ]);
    game.turn = 'red'; game.currentTurnIndex = 0;
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }).success, false);
    game._legalMoves = () => [];
    game._inCheck = () => false;
    game._evaluate();
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'b'); assert.equal(game.drawReason, null);
});

test('Xiangqi completes a deterministic legal game from the initial position', () => {
    const game = new (require('../server/games/xiangqi/engine'))('xiangqi-full', players(['red', 'black']));
    assert.equal(game.start().success, true);
    let moves = 0;
    while (game.status === 'playing' && moves < 500) {
        const legal = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece));
        assert.ok(legal.length, `第 ${moves + 1} 手没有可走着法`);
        const move = legal[(moves * 7) % legal.length];
        assert.equal(game.handleAction(game.players[game.currentTurnIndex].id, { kind: 'move', from: move.from, to: move.to }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner || game.drawReason); assert.ok(moves < 500);
});

test('Monopoly uses a 40-space fold-board route', () => {
    const session = Monopoly.create('classic-board', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.engine.getPublicState().board.length, 40);
    assert.equal(session.engine.getPublicState().board[30].type, 'go_to_jail');
});

test('Monopoly keeps the official board spaces tied to their board rules and supports eight seats', () => {
    const session = Monopoly.create('classic-board-eight', players(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']));
    assert.equal(session.start().success, true);
    const state = session.engine.getPublicState();
    assert.equal(state.board.length, 40);
    assert.equal(state.board[0].type, 'start');
    assert.equal(state.board[2].type, 'community_chest');
    assert.equal(state.board[7].type, 'chance');
    assert.equal(state.board[4].amount, 200);
    assert.equal(state.board[38].amount, 100);
    assert.equal(state.board[12].group, 'utility');
    assert.equal(state.board[5].group, 'transit');
    assert.equal(session.engine.communityChestDeck.find(card => card.title === '住院费').amount, -100);
});

test('Monopoly utilities use dice-based rent and complete groups gate building', () => {
    const session = Monopoly.create('utility-rent', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.board[12].ownerId = 'a'; game.board[28].ownerId = 'a'; game.lastRollTotal = 8;
    assert.equal(game._calculateRent(game.board[12]), 80);
    assert.deepEqual(game.getPlayerState('a').availableActions.buildableTiles, []);
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.players[0].cash = 100;
    assert.ok(game.getPlayerState('a').availableActions.buildableTiles.includes(1));
});

test('Monopoly builds houses evenly across a completed color group', () => {
    const session = Monopoly.create('even-build', players(['a', 'b'])); session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.phase = 'await_roll'; game.players[0].cash = 500;
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.board[1].houses = 1;
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, false);
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 3 }).success, true);
    assert.equal(game.board[1].houses, 1); assert.equal(game.board[3].houses, 1);
    game.phase = 'turn_complete';
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].houses, 2);
});

test('Monopoly auctions an unpurchased property when the landing player declines', () => {
    const session = Monopoly.create('monopoly-auction', players(['a', 'b', 'c'])); session.start(); const game = session.engine; const player = game.players[0];
    player.position = 1; game._resolveLanding(player);
    assert.equal(game.phase, 'property_decision');
    assert.equal(session.handleAction('a', { kind: 'passProperty' }).success, true);
    assert.equal(game.phase, 'auction');
    assert.equal(session.handleAction('b', { kind: 'bidProperty', amount: 75 }).success, true);
    assert.equal(session.handleAction('c', { kind: 'passAuction' }).success, true);
    assert.equal(game.board[1].ownerId, 'b');
    assert.equal(game.players[1].cash, 1425);
});

test('Monopoly uses the official third-jail-roll payment and movement rule', () => {
    const session = Monopoly.create('monopoly-jail', players(['a', 'b'])); session.start(); const game = session.engine;
    const player = game.players[0]; player.inJail = true; player.position = 10; player.jailTurns = 2; player.cash = 100;
    game.phase = 'jail_decision'; game._rollDice = () => [1, 2];
    assert.equal(session.handleAction('a', { kind: 'rollForDoubles' }).success, true);
    assert.equal(player.inJail, false); assert.equal(player.cash, 50); assert.equal(player.position, 13); assert.equal(game.phase, 'property_decision');
});

test('Monopoly supports the complete chance/community decks and hotel upgrade', () => {
    const session = Monopoly.create('monopoly-formal', players(['a', 'b'])); session.start(); const game = session.engine;
    assert.equal(game.chanceDeck.length, 16); assert.equal(game.communityChestDeck.length, 16);
    assert.equal(game.chanceDeck.filter(card => card.kind === 'pay_each_player').length, 1);
    assert.equal(game.chanceDeck.filter(card => card.kind === 'advance' && card.target === 39).length, 1);
    assert.equal(game.board[2].type, 'community_chest'); assert.equal(game.board[7].type, 'chance'); assert.equal(game.board[10].type, 'jail');
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.board[1].houses = 4; game.board[3].houses = 4; game.players[0].cash = 500;
    game.phase = 'turn_complete';
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].houses, 5); assert.equal(game._calculateRent(game.board[1]), 400);
});

test('Monopoly pays the start reward when an advance-to-start card is drawn at start', () => {
    const session = Monopoly.create('monopoly-start-card', players(['a', 'b'])); session.start(); const game = session.engine;
    const player = game.players[0]; player.position = 0; player.cash = 1500;
    game.chanceDeck = [{ title: '前进到起点', text: '前进到起点并领取 ¥200', kind: 'advance', target: 0 }];
    game._drawEvent(player, 0, 'chance');
    assert.equal(player.cash, 1700);
    assert.equal(player.position, 0);
});

test('Monopoly returns a used get-out-of-jail card to its original deck', () => {
    const session = Monopoly.create('monopoly-jail-card', players(['a', 'b'])); session.start(); const game = session.engine;
    const player = game.players[0]; player.position = 2; game.communityChestDeck = [{ title: '出狱卡', text: '保留此卡，可免费离开拘留所', kind: 'get_out_of_jail' }];
    game._resolveLanding(player); assert.equal(player.jailCardCount, 1); assert.equal(game.communityChestDeck.length, 0);
    player.inJail = true; game.phase = 'jail_decision';
    assert.equal(session.handleAction('a', { kind: 'useJailCard' }).success, true);
    assert.equal(player.jailCardCount, 0); assert.equal(game.communityChestDeck.at(-1).kind, 'get_out_of_jail');
});

test('Monopoly completes a deterministic two-player game through bankruptcy', () => {
    const session = Monopoly.create('monopoly-full', players(['a', 'b'])); session.start(); const game = session.engine;
    const debtor = game.players[0]; const creditor = game.players[1];
    debtor.position = 39; debtor.cash = 100; game.board[1].ownerId = creditor.id; game.board[1].houses = 5;
    game._rollDice = () => [1, 1];
    assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, true);
    assert.equal(debtor.position, 1); assert.equal(debtor.isBankrupt, true); assert.equal(game.status, 'ended'); assert.equal(game.winner.id, creditor.id);
});

test('Monopoly Deal rent supports accept and payment response states', () => {
    const session = MonopolyDeal.create('rent-response', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'play'; game.cardsPlayed = 0; game.currentTurnIndex = 0;
    game.players[0].properties.brown = [{ id: 'brown-1', kind: 'property', color: 'brown', value: 1 }, { id: 'brown-wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'rent-1', kind: 'rent', colors: ['brown', 'lightblue'], name: '棕色/浅蓝收租', value: 1 }];
    game.players[1].hand = [];
    game.players[1].bank = [{ id: 'money-1', kind: 'money', name: '现金', value: 3 }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(game.pendingDebt.amount, 2);
    assert.equal(session.handleAction('b', { kind: 'payDebt' }).success, true);
    assert.equal(game.pendingDebt, null);
});

test('Monopoly Deal exposes a full action deck and validates debt collector payments', () => {
    const deck = MonopolyDealEngine.buildDeck();
    assert.equal(deck.length, 110);
    for (const action of ['passGo', 'doubleRent', 'debtCollector', 'birthday', 'slyDeal', 'forcedDeal', 'house', 'hotel']) assert.ok(deck.some(card => card.action === action));
    const session = MonopolyDeal.create('debt-collector', players(['a', 'b'])); session.start(); const game = session.engine; game.phase = 'play'; game.cardsPlayed = 0; game.currentTurnIndex = 0;
    game.players[0].hand = [{ id: 'dc', kind: 'action', action: 'debtCollector', value: 3, name: '债务追缴' }]; game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 5, name: '现金' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(session.handleAction('b', { kind: 'payDebt', cardIds: ['cash'] }).success, true);
    assert.equal(game.players[0].bank[0].id, 'cash');
});

test('Monopoly Deal birthday lets each opponent accept or say no in sequence', () => {
    const session = MonopolyDeal.create('birthday', players(['a', 'b', 'c'])); session.start(); const game = session.engine;
    game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].hand = [{ id: 'birthday', kind: 'action', action: 'birthday', value: 2, name: '生日收礼' }];
    game.players[1].hand = [{ id: 'no-b', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[2].bank = [{ id: 'cash-c', kind: 'money', value: 2, name: '现金' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.targetId, 'b');
    assert.equal(session.handleAction('b', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'a');
    assert.equal(session.handleAction('a', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'c');
    assert.equal(session.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'c');
    assert.equal(session.handleAction('c', { kind: 'payDebt', cardIds: ['cash-c'] }).success, true);
    assert.equal(game.pendingAction, null); assert.equal(game.pendingDebt, null); assert.equal(game.players[0].bank[0].id, 'cash-c');
});

test('Monopoly Deal Just Say No can be countered by another Just Say No', () => {
    const game = new MonopolyDealEngine('deal-no-chain', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'rent', kind: 'rent', colors: [], value: 3, name: '万能收租' }, { id: 'no-a', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[1].hand = [{ id: 'no-b', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[1].bank = [{ id: 'cash', kind: 'money', value: 2, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'brown' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'a');
    assert.equal(game.handleAction('a', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
});

test('Monopoly Deal moves buildings with a complete set taken by Deal Breaker', () => {
    const game = new MonopolyDealEngine('deal-breaker-buildings', players(['a', 'b']));
    game.start();
    const actor = game.players[0]; const target = game.players[1];
    actor.hand = [{ id: 'breaker', kind: 'action', action: 'dealBreaker', value: 5, name: '强制交易' }];
    target.hand = [];
    target.properties.brown = [{ id: 'brown-1', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1 }, { id: 'brown-2', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1 }];
    target.buildings['brown-set'] = { house: { id: 'house', kind: 'action', action: 'house', name: '房屋', value: 3 }, hotel: { id: 'hotel', kind: 'action', action: 'hotel', name: '酒店', value: 4 } }; game.phase = 'play'; game.currentTurnIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(actor.houses.brown, 1); assert.equal(actor.hotels.brown, 1);
    assert.equal(target.houses.brown, 0); assert.equal(target.hotels.brown, 0);
});

test('Monopoly Deal matches the official 110-card box and removes reference cards before dealing', () => {
    const deck = MonopolyDealEngine.buildDeck();
    assert.equal(deck.length, 110); assert.equal(deck.filter(card => card.kind !== 'rules').length, 106);
    assert.equal(deck.filter(card => card.kind === 'property').length, 28);
    assert.equal(deck.filter(card => card.kind === 'property_wild').length, 11);
    assert.equal(deck.filter(card => card.kind === 'money').length, 20);
    assert.equal(deck.filter(card => card.kind === 'rent').length, 13);
    assert.equal(deck.filter(card => card.kind === 'action').length, 34);
    const game = new MonopolyDealEngine('deal-deal', players(['a', 'b'])); game.start();
    assert.equal(game.deck.length, 96); // 106 playable minus two five-card opening hands
});

test('Monopoly Deal assigns and repositions property wildcards only on legal colours', () => {
    const game = new MonopolyDealEngine('deal-wild', players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    const wild = { id: 'wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: null, value: 1, name: '地产万能牌' };
    game.players[0].hand = [wild];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.players[0].properties.brown[0].color, 'brown');
    assert.equal(game.cardsPlayed, 1);
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'wild', fromColor: 'brown', toColor: 'lightblue' }).success, true);
    assert.equal(game.players[0].properties.lightblue[0].color, 'lightblue');
    assert.equal(game.cardsPlayed, 1, '调整万能地产颜色不应占用出牌次数');
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'wild', fromColor: 'lightblue', toColor: 'pink' }).success, false);
});

test('Monopoly Deal uses the explicitly selected side of a two-colour rent card', () => {
    const game = new MonopolyDealEngine('deal-rent-colour-choice', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.red = [{ id: 'red-1', kind: 'property', color: 'red', value: 3 }];
    game.players[0].properties.yellow = [
        { id: 'yellow-1', kind: 'property', color: 'yellow', value: 3 },
        { id: 'yellow-2', kind: 'property', color: 'yellow', value: 3 },
        { id: 'yellow-3', kind: 'property', color: 'yellow', value: 3 },
    ];
    game.players[0].hand = [{ id: 'rent-red-yellow', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红色/黄色收租' }];
    game.players[1].hand = [];
    game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'yellow' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.color, 'yellow');
    assert.equal(game.pendingDebt.amount, 6);
});

test('Monopoly Deal requires Double the Rent to be paired with a Rent card and allows two doublers', () => {
    const game = new MonopolyDealEngine('deal-double-rent', players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'double-1', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' }, { id: 'double-2', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' }, { id: 'rent', kind: 'rent', colors: ['brown', 'lightblue'], value: 1, name: '双色收租' }];
    game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'endTurn' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 8);
    assert.equal(game.cardsPlayed, 3);
});

test('Monopoly Deal does not count pure wild sets as complete and blocks lone ten-colour rent', () => {
    const game = new MonopolyDealEngine('deal-wild-official', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.blue = [{ id: 'all-1', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'blue', value: 0, allColor: true }, { id: 'all-2', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'blue', value: 0, allColor: true }];
    game.players[0].hand = [{ id: 'rent', kind: 'rent', colors: [], value: 3, name: '万能收租' }];
    game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game._completedSets(game.players[0]), 0);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'blue' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 8);
    const single = new MonopolyDealEngine('deal-lone-ten-wild', players(['a', 'b']));
    single.start(); single.phase = 'play'; single.currentTurnIndex = 0; single.cardsPlayed = 0;
    single.players[0].properties.green = [{ id: 'all', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'green', value: 0, allColor: true }];
    single.players[0].hand = [{ id: 'rent2', kind: 'rent', colors: [], value: 3, name: '万能收租' }];
    assert.equal(single.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'green' }).success, false);
});

test('Monopoly Deal two-colour rent charges every opponent in sequence', () => {
    const game = new MonopolyDealEngine('deal-rent-all', players(['a', 'b', 'c']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.red = [{ id: 'r1', kind: 'property', color: 'red', value: 3 }];
    game.players[0].hand = [{ id: 'rent-all', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红色/黄色收租' }];
    game.players[1].hand = []; game.players[2].hand = [];
    game.players[1].bank = [{ id: 'cash-b', kind: 'money', value: 2, name: '现金' }];
    game.players[2].bank = [{ id: 'cash-c', kind: 'money', value: 2, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'red' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(game.pendingDebts.length, 1);
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['cash-b'] }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'c');
    assert.equal(game.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'c');
    assert.equal(game.handleAction('c', { kind: 'payDebt', cardIds: ['cash-c'] }).success, true);
    assert.equal(game.pendingAction, null);
    assert.deepEqual(game.players[0].bank.map(card => card.id), ['cash-b', 'cash-c']);
});

test('Monopoly Deal payment can complete the creditor third set and win immediately', () => {
    const game = new MonopolyDealEngine('deal-payment-win', players(['a', 'b']));
    game.start();
    const creditor = game.players[0]; const payer = game.players[1];
    creditor.properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    creditor.properties.blue = [{ id: 'd1', kind: 'property', color: 'blue', value: 4 }, { id: 'd2', kind: 'property', color: 'blue', value: 4 }];
    payer.properties.utility = [{ id: 'u1', kind: 'property', color: 'utility', value: 2 }, { id: 'u2', kind: 'property', color: 'utility', value: 2 }];
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 2, type: 'rent' };
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['u1', 'u2'] }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.id, 'a');
});

test('Monopoly Deal completes a full three-set win across alternating turns', () => {
    const game = new MonopolyDealEngine('deal-full', players(['a', 'b'])); game.start();
    const sets = [
        [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }, { id: 'l1', kind: 'property', color: 'lightblue', value: 1 }],
        [{ id: 'l2', kind: 'property', color: 'lightblue', value: 1 }, { id: 'l3', kind: 'property', color: 'lightblue', value: 1 }, { id: 'p1', kind: 'property', color: 'pink', value: 2 }],
        [{ id: 'p2', kind: 'property', color: 'pink', value: 2 }, { id: 'p3', kind: 'property', color: 'pink', value: 2 }],
    ];
    for (const hand of sets) {
        const current = game.getCurrentPlayer(); current.hand = hand; game.phase = 'play'; game.cardsPlayed = 0;
        [...hand].forEach(() => game.handleAction(current.id, { kind: 'playCard', cardIndex: 0 }));
        if (game.status === 'ended') break;
        game.handleAction(current.id, { kind: 'endTurn' });
        const next = game.getCurrentPlayer(); next.hand = []; game.phase = 'play'; game.cardsPlayed = 0; game.handleAction(next.id, { kind: 'endTurn' });
    }
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'a'); assert.equal(game._completedSets(game.players[0]), 3);
});

test('Monopoly Deal keeps same-colour property sets independent and never overfills a set', () => {
    const game = new MonopolyDealEngine('deal-independent-groups', players(['a', 'b'])); game.start();
    const player = game.players[0]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    player.hand = [
        { id: 'brown-a', kind: 'property', color: 'brown', value: 1, name: '棕色 A' },
        { id: 'brown-b', kind: 'property', color: 'brown', value: 1, name: '棕色 B' },
        { id: 'brown-extra', kind: 'property', color: 'brown', value: 1, name: '棕色额外牌' },
    ];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'new' }).success, true);
    const firstGroupId = player.properties.brown[0].groupId;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: firstGroupId }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: firstGroupId }).success, false);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'new' }).success, true);
    assert.deepEqual(game._groups(player, 'brown').map(group => group.cards.length), [2, 1]);
    assert.equal(game._completedSets(player), 1, '同色两组也只计一种胜利颜色');
});

test('Monopoly Deal attaches real building cards, banks them when their set breaks, and never duplicates them', () => {
    const game = new MonopolyDealEngine('deal-real-buildings', players(['a', 'b'])); game.start();
    const player = game.players[0]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    player.properties.brown = [
        { id: 'brown-fixed', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1, name: '棕色地产' },
        { id: 'brown-wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: 'brown', groupId: 'brown-set', value: 1, name: '万能地产' },
    ];
    player.hand = [
        { id: 'house-card', kind: 'action', action: 'house', value: 3, name: '房屋' },
        { id: 'hotel-card', kind: 'action', action: 'hotel', value: 4, name: '酒店' },
    ];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.discard.some(card => ['house-card', 'hotel-card'].includes(card.id)), false, '已建设的建筑不应同时进弃牌堆');
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'brown-wild', fromColor: 'brown', fromGroupId: 'brown-set', toColor: 'lightblue', toGroupId: 'new' }).success, true);
    assert.deepEqual(player.bank.filter(card => ['house-card', 'hotel-card'].includes(card.id)).map(card => card.id), ['house-card', 'hotel-card']);
    assert.equal(game.discard.some(card => ['house-card', 'hotel-card'].includes(card.id)), false);
    assert.equal(game.players[0].buildings['brown-set'], undefined);
});

test('Monopoly Deal does not let attached buildings be selected as debt payment', () => {
    const game = new MonopolyDealEngine('deal-building-payment', players(['a', 'b'])); game.start();
    const creditor = game.players[0]; const payer = game.players[1];
    payer.properties.red = [
        { id: 'red-1', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
        { id: 'red-2', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
        { id: 'red-3', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
    ];
    payer.buildings['red-set'] = { house: { id: 'house-pay', kind: 'action', action: 'house', value: 3, name: '房屋' }, hotel: null };
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 3, type: 'rent' };
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['house-pay'] }).success, false);
    assert.equal(creditor.bank.some(card => card.id === 'house-pay'), false);
    assert.equal(payer.buildings['red-set'].house.id, 'house-pay');
    assert.equal(game.discard.some(card => card.id === 'house-pay'), false);
});

test('Monopoly Deal exposes face-up bank and discard cards but never reshuffles banked cards', () => {
    const game = new MonopolyDealEngine('deal-bank-ledger', players(['a', 'b']), () => 0); game.start();
    const player = game.players[0];
    const banked = { id: 'banked-action', kind: 'action', action: 'passGo', value: 1, name: '通过起点' };
    const discarded = { id: 'discarded-action', kind: 'action', action: 'birthday', value: 2, name: '生日收礼' };
    player.bank = [banked]; game.deck = []; game.discard = [discarded];
    const publicState = game.getPublicState();
    assert.deepEqual(publicState.players[0].bank.map(card => card.id), ['banked-action']);
    assert.deepEqual(publicState.discard.map(card => card.id), ['discarded-action']);
    assert.deepEqual(game._draw(2).map(card => card.id), ['discarded-action']);
    assert.deepEqual(player.bank.map(card => card.id), ['banked-action']);
});

test('Monopoly Deal always opens a response window without revealing whether the target holds Just Say No', () => {
    const setup = (roomId, responseCard) => {
        const game = new MonopolyDealEngine(roomId, players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
        game.players[0].hand = [{ id: `debt-${roomId}`, kind: 'action', action: 'debtCollector', value: 3, name: '收取债务' }];
        game.players[1].hand = [responseCard]; game.players[1].bank = [{ id: `cash-${roomId}`, kind: 'money', value: 5, name: '现金' }];
        game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' });
        return game;
    };
    const withNo = setup('with-no', { id: 'secret-no', kind: 'action', action: 'justSayNo', value: 4, name: '说不' });
    const withoutNo = setup('without-no', { id: 'secret-other', kind: 'action', action: 'passGo', value: 1, name: '通过起点' });
    assert.equal(withNo.pendingAction.responsePlayerId, 'b');
    assert.equal(withoutNo.pendingAction.responsePlayerId, 'b');
    assert.equal(withNo.getPlayerState('a').players.find(player => player.id === 'b').handCount, 1);
    assert.equal(withoutNo.getPlayerState('a').players.find(player => player.id === 'b').handCount, 1);
});

test('Monopoly Deal checks both players for an immediate win after Forced Deal', () => {
    const game = new MonopolyDealEngine('deal-forced-target-win', players(['a', 'b'])); game.start();
    const actor = game.players[0]; const target = game.players[1]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    target.properties.brown = [{ id: 'tb1', kind: 'property', color: 'brown', value: 1 }, { id: 'tb2', kind: 'property', color: 'brown', value: 1 }];
    target.properties.blue = [{ id: 'tblue1', kind: 'property', color: 'blue', value: 4 }, { id: 'tblue2', kind: 'property', color: 'blue', value: 4 }];
    target.properties.utility = [{ id: 'tu1', kind: 'property', color: 'utility', value: 2 }];
    target.properties.red = [{ id: 'tr1', kind: 'property', color: 'red', value: 3 }];
    actor.properties.utility = [{ id: 'au1', kind: 'property', color: 'utility', value: 2 }];
    actor.hand = [{ id: 'forced', kind: 'action', action: 'forcedDeal', value: 3, name: '强制交换' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', targetColor: 'red', targetPropertyId: 'tr1', ownColor: 'utility', ownPropertyId: 'au1' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.id, 'b');
});

test('Coup ambassador exchange requires an explicit private keep selection', () => {
    const session = Coup.create('exchange', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].influences = ['duke', 'captain']; game.players[0].revealed = [false, false]; game.deck = ['assassin', 'contessa', 'duke'];
    assert.equal(session.handleAction('a', { kind: 'exchange' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    const privateState = session.getPlayerState('a'); const publicState = session.getPlayerState('b');
    assert.equal(privateState.exchange.isMyTurn, true); assert.equal(privateState.exchange.options.length, 4);
    assert.deepEqual(privateState.exchange.options.map(card => card.index), [0, 1, 2, 3]);
    assert.equal(publicState.exchange.isMyTurn, false); assert.equal(publicState.exchange.options, null);
    assert.equal(session.handleAction('a', { kind: 'exchangeSelect', keepIndices: [2, 3] }).success, true);
    assert.deepEqual(game.players[0].influences, ['duke', 'contessa']);
});

test('Coup lets assassination target block with Contessa before influence loss', () => {
    const session = Coup.create('contessa-block', players(['a', 'b', 'c']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[1].influences = ['contessa', 'duke']; game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'block'); assert.equal(session.getPlayerState('b').challenge.isMyTurn, true);
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'idle'); assert.equal(game.players[1].revealed[0], false); assert.equal(game.players[0].coins, 0);
});

test('Coup cancels a challenged bluff instead of executing it', () => {
    const session = Coup.create('failed-claim', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].coins = 0; game.players[0].influences = ['captain', 'assassin']; game.players[0].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'tax' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'cancel' }).success, true);
    assert.equal(game.phase, 'influence_loss');
    assert.equal(session.handleAction('a', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.players[0].coins, 0); assert.equal(game.phase, 'idle');
});

test('Coup charges assassination before challenge resolution', () => {
    const session = Coup.create('assassination-fee', players(['a', 'b', 'c']));
    session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[0].influences = ['captain', 'ambassador'];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(game.players[0].coins, 0);
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'cancel' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.players[0].coins, 0);
});

test('Coup executes assassination after a challenged Contessa bluff', () => {
    const session = Coup.create('bluff-contessa', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[0].influences = ['assassin', 'duke'];
    game.players[1].influences = ['captain', 'duke']; game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'block');
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'cancel' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.phase, 'influence_loss');
    assert.equal(session.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 }).success, true);
    assert.equal(game.gameOver, true);
    assert.equal(game.winner, 'a');
    assert.equal(game.players[0].coins, 0);
});

test('Coup completes a six-player base-rule match through coups and influence loss', () => {
    const session = Coup.create('coup-full-six', players(['a', 'b', 'c', 'd', 'e', 'f']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    let steps = 0;
    while (!game.gameOver && steps++ < 1000) {
        if (game.phase === 'idle') {
            const current = game.players[game.currentTurnIndex];
            const target = game.players.find(player => player.id !== current.id && game.isPlayerAlive(player.id));
            const action = current.coins >= 7 ? { kind: 'coup', targetId: target.id } : { kind: 'income' };
            assert.equal(session.handleAction(current.id, action).success, true);
        } else if (game.phase === 'influence_loss') {
            const id = game.pendingInfluenceLoss.playerId;
            const player = game.players.find(item => item.id === id);
            const index = player.revealed.findIndex(revealed => !revealed);
            assert.notEqual(index, -1);
            assert.equal(session.handleAction(id, { kind: 'influence_loss', influenceIndex: index }).success, true);
        } else if (game.phase === 'challenge') {
            const id = game.challengeQueue[game.challengeIndex];
            assert.equal(session.handleAction(id, { kind: 'pass' }).success, true);
        } else if (game.phase === 'block') {
            const id = game.challengeQueue[game.challengeIndex];
            assert.equal(session.handleAction(id, { kind: 'pass' }).success, true);
        } else if (game.phase === 'exchange') {
            const id = game.pendingExchange.playerId;
            const view = session.getPlayerState(id);
            const keep = Array.from({ length: view.exchange.keepCount }, (_, index) => index);
            assert.equal(session.handleAction(id, { kind: 'exchangeSelect', keepIndices: keep }).success, true);
        } else {
            assert.fail(`unexpected Coup phase: ${game.phase}`);
        }
    }
    assert.equal(game.gameOver, true);
    assert.ok(game.winner);
    assert.ok(steps < 1000);
});

test('two-player Love Letter sets aside three public cards', () => {
    const session = LoveLetter.create('ll', players(['a', 'b']));
    const result = session.start();
    assert.equal(result.state.setAsideCards.length, 3);
    assert.equal(result.state.setAsideCount, 3);
});

test('Love Letter permits a protected player to use Prince on themself', () => {
    const session = LoveLetter.create('protected-prince', players(['a', 'b'])); session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].hand = [{ id: 5, name: '王子', value: 5, cardId: 'prince' }, { id: 4, name: '侍女', value: 4, cardId: 'handmaid' }]; game.players[0].isProtected = true; game.players[1].hand = [{ id: 1, name: '侍卫', value: 1, cardId: 'guard' }];
    assert.equal(game.playCard('a', 0, 'a').success, true); assert.equal(game.players[0].hand.length, 1);
});

test('Love Letter rejects the non-standard face-down discard action', () => {
    const session = LoveLetter.create('standard-discard', players(['a', 'b']));
    session.start();
    const result = session.handleAction('a', { kind: 'discardCard', cardIndex: 0 });
    assert.equal(result.success, false);
    assert.match(result.message, /必须打出/);
});

test('Love Letter showdown tie uses discarded values', () => {
    const session = LoveLetter.create('tie', players(['a', 'b']));
    const game = session.engine;
    game.status = 'playing'; game.deck = []; game.players[1].favorTokens = game.targetFavor - 1;
    game.players[0].hand = [{ id: 6, name: '国王', value: 6 }];
    game.players[1].hand = [{ id: 6, name: '国王', value: 6 }];
    game.publicDiscard = [{ ownerId: 'a', card: { value: 1 } }, { ownerId: 'b', card: { value: 5 } }];
    assert.equal(game.checkGameEnd(), true);
    assert.equal(game.winner.id, 'b');
    assert.equal(game.roundWinner.id, 'b');
});

test('Love Letter priest reveal stays private to the acting player', () => {
    const session = LoveLetter.create('private-priest', players(['a', 'b']));
    session.start();
    session.engine.players[0].hand = [{ id: 2, value: 2, name: '神父' }];
    session.engine.players[1].hand = [{ id: 8, value: 8, name: '公主' }];
    session.engine.currentTurnIndex = 0;
    const announced = session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' });
    assert.equal(announced.pendingAcknowledgement, true);
    assert.equal(session.getPlayerState('a').lastAction.result.revealedCard, undefined);
    session.engine.pendingAction.availableAt = Date.now() - 1;
    assert.equal(session.handleAction('b', { kind: 'acknowledgeAction', actionId: announced.action.actionId }).success, true);
    assert.equal(session.getPlayerState('a').lastAction.result.revealedCard.name, '公主');
    assert.equal(session.getPlayerState('b').lastAction.result.revealedCard, null);
});

test('Love Letter plays a target card with no effect when every opponent is protected', () => {
    const session = LoveLetter.create('protected-targets', players(['a', 'b', 'c']));
    session.start();
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].hand = [{ id: 1, value: 1, name: '侍卫' }, { id: 2, value: 2, name: '牧师' }];
    game.players[1].hand = [{ id: 8, value: 8, name: '公主' }]; game.players[1].isProtected = true;
    game.players[2].hand = [{ id: 6, value: 6, name: '国王' }]; game.players[2].isProtected = true;
    const result = game.playCard('a', 0, null, null);
    assert.equal(result.success, true);
    assert.equal(result.noEffect, true);
    assert.equal(game.players[0].hand.length, 1);
});

test('Love Letter completes an official four-player match across rounds', () => {
    const game = new LoveLetterEngine('ll-full', players(['a', 'b', 'c', 'd']));
    game.init();
    assert.equal(game.targetFavor, 4);
    assert.equal(game.deck.length + game.players.reduce((sum, player) => sum + player.hand.length, 0) + 1, 16);

    let steps = 0;
    while (game.status !== 'ended' && steps++ < 5000) {
        if (game.pendingAction) {
            const pending = game.pendingAction;
            pending.availableAt = Date.now() - 1;
            assert.equal(game.acknowledgeAction(pending.targetId, pending.actionId).success, true);
            continue;
        }
        if (game.status === 'round_end') {
            assert.ok(game.roundWinner);
            assert.equal(game.startNextRound(game.roundWinner.id).success, true);
            continue;
        }
        const current = game.getCurrentPlayer();
        assert.ok(current, 'playing game must always have a current player');
        const mustCountess = current.hand.some(card => card.id === 7) && current.hand.some(card => card.id === 5 || card.id === 6);
        const candidates = current.hand
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => !mustCountess || card.id === 7);
        let played = false;
        for (const { card, index } of candidates) {
            const alive = game.getAlivePlayers().filter(player => !player.isProtected);
            const other = alive.find(player => player.id !== current.id);
            const targetId = card.id === 5 ? current.id : other?.id;
            const targetRequired = [1, 2, 3, 5, 6].includes(card.id);
            const noTargetableOpponent = game.getAlivePlayers().every(player => player.id === current.id || player.isProtected);
            if (targetRequired && !targetId && !(noTargetableOpponent && [1, 2, 3, 6].includes(card.id))) continue;
            const result = game.playCard(current.id, index, targetId, card.id === 1 ? 2 : undefined);
            if (result.success) { played = true; break; }
        }
        assert.equal(played, true, `no legal action for ${current.name}`);
    }

    assert.equal(game.status, 'ended');
    assert.ok(game.winner);
    assert.ok(game.round >= game.targetFavor);
    assert.ok(game.getState().players.every(player => Array.isArray(player.hand)));
    assert.ok(steps < 5000);
});

test('Love Letter pauses at round end and only the round winner or host can continue', () => {
    const session = LoveLetter.create('ll-round-pause', players(['a', 'b', 'c']));
    session.start();
    const game = session.engine;
    game.deck = [];
    game.players[0].hand = [{ id: 2, value: 2, name: '牧师' }];
    game.players[1].hand = [{ id: 6, value: 6, name: '国王' }];
    game.players[2].hand = [{ id: 3, value: 3, name: '男爵' }];
    assert.equal(game.checkGameEnd(), true);
    assert.equal(game.status, 'round_end');
    assert.equal(game.roundWinner.id, 'b');
    assert.ok(Array.isArray(session.getPlayerState('a').players[0].hand));
    assert.equal(session.handleAction('c', { kind: 'startNextRound' }).success, false);
    assert.equal(session.handleAction('b', { kind: 'startNextRound' }).success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.currentTurnIndex, 1);
});

test('Coup exposes a revealed role to every player', () => {
    const session = Coup.create('revealed-role', players(['a', 'b']));
    session.start();
    session.engine.players[0].revealed[0] = true;
    const card = session.getPlayerState('b').players.find(player => player.id === 'a').influences[0];
    assert.equal(card.revealed, true);
    assert.equal(card.role, session.engine.players[0].influences[0]);
});

test('Coup coup target chooses the influence to reveal', () => {
    const session = Coup.create('coup', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 7; game.players[1].revealed = [false, false];
    const coup = game.handleAction('a', { kind: 'coup', targetId: 'b' });
    assert.equal(coup.success, true); assert.equal(game.phase, 'influence_loss');
    const choice = game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });
    assert.equal(choice.success, true); assert.equal(game.players[1].revealed[1], true); assert.equal(game.players[1].revealed[0], false);
});

test('Coup assassination target chooses the influence to reveal', () => {
    const session = Coup.create('assassination', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 5;
    const action = game.handleAction('a', { kind: 'assassinate', targetId: 'b' });
    assert.equal(action.success, true); assert.equal(game.phase, 'challenge');
    const pass = game.handleAction('b', { kind: 'pass' });
    assert.equal(pass.success, true); assert.equal(game.phase, 'block');
    assert.equal(game.handleAction('b', { kind: 'pass' }).success, true); assert.equal(game.phase, 'influence_loss');
    const choice = game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });
    assert.equal(choice.success, true); assert.equal(game.players[1].revealed[1], true); assert.equal(game.players[1].revealed[0], false);
});

test('Coup keeps a completed match in an explicit ended phase with final reveals', () => {
    const session = Coup.create('coup-ended-pause', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 7;
    game.players[1].influences = ['duke', 'contessa']; game.players[1].revealed = [false, true];
    assert.equal(session.handleAction('a', { kind: 'coup', targetId: 'b' }).success, true);
    const result = session.handleAction('b', { kind: 'influence_loss', influenceIndex: 0 });
    assert.equal(result.success, true);
    assert.equal(game.gameOver, true); assert.equal(game.phase, 'ended');
    assert.equal(game.pendingInfluenceLoss, null); assert.equal(game.pendingAction, null);
    const finalState = session.getPlayerState('a');
    assert.equal(finalState.influenceLoss, undefined);
    assert.equal(finalState.players.find(player => player.id === 'b').influences[0].role, 'duke');
    assert.equal(finalState.players.find(player => player.id === 'b').influences[1].role, 'contessa');
});

test('Room propagates a chess move through the game adapter', () => {
    const room = new Room('chess', 'a', 'a', 'chess'); room.addPlayer({ id: 'a', name: 'a' }); room.addPlayer({ id: 'b', name: 'b' });
    assert.equal(room.startGame().success, true);
    const result = room.handleGameAction('a', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 } });
    assert.equal(result.success, true); assert.equal(room.getPlayerGameState('b').turn, 'black');
});

test('Chess only applies promotion on the last rank', () => {
    const invalid = chessEngine();
    assert.equal(invalid.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 }, promotion: 'q' }).success, true);
    assert.equal(invalid.board.get('4,4').type, 'p');

    const ordinary = chessEngine();
    assert.equal(ordinary.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 4, y: 4 } }).success, true);
    assert.equal(ordinary.board.get('4,4').type, 'p');
});

test('Chess rejects moves that expose or move the king into check', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['4,6', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['4,0', { id: 'br', type: 'r', color: 'black', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
    ]);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 6 }, to: { x: 5, y: 6 } }).success, false);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 4, y: 6 } }).success, false);
});

test('Chess en passant is immediate and removes the passed pawn', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['4,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,3', { id: 'wp', type: 'p', color: 'white', moved: false }],
        ['3,1', { id: 'bp', type: 'p', color: 'black', moved: false }],
    ]);
    engine.turn = 'black'; engine.currentTurnIndex = 1; engine.positionCounts.clear(); engine._recordPosition();
    assert.equal(engine.handleAction('black', { kind: 'move', from: { x: 3, y: 1 }, to: { x: 3, y: 3 } }).success, true);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 3 }, to: { x: 3, y: 2 } }).success, true);
    assert.equal(engine.board.get('3,2').id, 'wp');
    assert.equal(engine.board.has('3,3'), false);
});

test('Chess supports legal castling, blocks castling through check, and promotes', () => {
    const engine = chessEngine();
    engine.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['7,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
    ]);
    assert.equal(engine.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 6, y: 7 } }).success, true);
    assert.equal(engine.board.get('6,7').type, 'k');
    assert.equal(engine.board.get('5,7').type, 'r');

    const blocked = chessEngine();
    blocked.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['7,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['5,0', { id: 'br', type: 'r', color: 'black', moved: false }],
    ]);
    assert.equal(blocked.handleAction('white', { kind: 'move', from: { x: 4, y: 7 }, to: { x: 6, y: 7 } }).success, false);

    const promotion = chessEngine();
    promotion.board = new Map([
        ['4,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,1', { id: 'wp', type: 'p', color: 'white', moved: false }],
    ]);
    assert.equal(promotion.handleAction('white', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 4, y: 0 }, promotion: 'n' }).success, true);
    assert.equal(promotion.board.get('4,0').type, 'n');
});

test('Chess distinguishes checkmate from stalemate', () => {
    const mate = chessEngine();
    assert.equal(mate.handleAction('white', { kind: 'move', from: { x: 5, y: 6 }, to: { x: 5, y: 5 } }).success, true);
    assert.equal(mate.handleAction('black', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 4, y: 3 } }).success, true);
    assert.equal(mate.handleAction('white', { kind: 'move', from: { x: 6, y: 6 }, to: { x: 6, y: 4 } }).success, true);
    assert.equal(mate.handleAction('black', { kind: 'move', from: { x: 3, y: 0 }, to: { x: 7, y: 4 } }).success, true);
    assert.equal(mate.status, 'ended');
    assert.equal(mate.winner.id, 'black');

    const stale = chessEngine();
    stale.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['2,2', { id: 'wk', type: 'k', color: 'white', moved: false }],
        ['2,1', { id: 'wq', type: 'q', color: 'white', moved: false }],
    ]);
    stale.turn = 'black'; stale.currentTurnIndex = 1; stale.positionCounts.clear(); stale._recordPosition(); stale._evaluatePosition();
    assert.equal(stale.status, 'ended');
    assert.equal(stale.winner, null);
    assert.equal(stale.drawReason, '困毙和棋');
});

test('Chess exposes every direct checker and the pieces completing a mating net', () => {
    const doubleCheck = chessEngine();
    doubleCheck.board = new Map([
        ['4,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['4,7', { id: 'wr', type: 'r', color: 'white', moved: false }],
        ['1,3', { id: 'wb', type: 'b', color: 'white', moved: false }],
        ['0,7', { id: 'wk', type: 'k', color: 'white', moved: false }],
    ]);
    doubleCheck.turn = 'black'; doubleCheck.currentTurnIndex = 1;
    const checkState = doubleCheck.getPublicState();
    assert.equal(checkState.check, true);
    assert.equal(checkState.checkedKingId, 'bk');
    assert.deepEqual(new Set(checkState.checkingPieceIds), new Set(['wr', 'wb']));
    assert.deepEqual(checkState.checkmateParticipantIds, []);

    const mate = chessEngine();
    mate.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black', moved: false }],
        ['1,1', { id: 'wq', type: 'q', color: 'white', moved: false }],
        ['2,2', { id: 'wk', type: 'k', color: 'white', moved: false }],
    ]);
    mate.turn = 'black'; mate.currentTurnIndex = 1; mate.positionCounts.clear(); mate._recordPosition(); mate._evaluatePosition();
    const mateState = mate.getPublicState();
    assert.equal(mateState.checkmate, true);
    assert.equal(mateState.checkedKingId, 'bk');
    assert.deepEqual(mateState.checkingPieceIds, ['wq']);
    assert.deepEqual(new Set(mateState.checkmateParticipantIds), new Set(['wq', 'wk']));
});

test('Chess exposes and accepts standard draw claims', () => {
    const engine = chessEngine();
    engine.halfmoveClock = 100;
    assert.equal(engine.getPlayerState('white').canClaimDraw, true);
    assert.equal(engine.handleAction('white', { kind: 'claimDraw' }).success, true);
    assert.equal(engine.status, 'ended');
    assert.equal(engine.drawReason, '五十回合规则和棋');

    const repetition = chessEngine();
    const position = repetition._positionKey();
    repetition.positionCounts.set(position, 3);
    assert.equal(repetition.getPlayerState('white').canClaimDraw, true);
    assert.equal(repetition.handleAction('white', { kind: 'claimDraw' }).success, true);
    assert.equal(repetition.drawReason, '三次重复局面和棋');
});

test('Chess completes a deterministic legal game from the initial position', () => {
    const game = new (require('../server/games/chess/engine'))('chess-full', players(['white', 'black']), () => 0);
    assert.equal(game.start().success, true);
    let moves = 0;
    while (game.status === 'playing' && moves < 1000) {
        const legal = game._allLegalMoves(game.turn);
        assert.ok(legal.length, `第 ${moves + 1} 手没有可走着法`);
        const move = legal[(moves * 7) % legal.length];
        assert.equal(game.handleAction(game.players[game.currentTurnIndex].id, { kind: 'move', from: move.from, to: move.to, promotion: move.promotion || 'q' }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner || game.drawReason); assert.ok(moves < 1000);
});

test('Junqi starts with hidden opponent pieces and player-specific views', () => {
    const session = Junqi.create('junqi-hidden', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const swapA = game.setup.a.pieces.find(piece => piece.type === 'company');
    const swapB = game.setup.a.pieces.find(piece => piece.type === 'platoon');
    const beforeA = { x: swapA.x, y: swapA.y }; const beforeB = { x: swapB.x, y: swapB.y };
    assert.equal(session.handleAction('a', { kind: 'setupSwap', pieceId: swapA.id, targetPieceId: swapB.id }).success, true);
    assert.deepEqual({ x: swapA.x, y: swapA.y }, beforeB); assert.deepEqual({ x: swapB.x, y: swapB.y }, beforeA);
    const flag = game.setup.a.pieces.find(piece => piece.type === 'flag');
    assert.equal(session.handleAction('a', { kind: 'setupSwap', pieceId: flag.id, targetPieceId: swapA.id }).success, false);
    const placeAll = (playerId, color) => {
        const rows = color === 'red' ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        const camps = new Set([[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]].map(([x, y]) => `${x},${y}`));
        const cells = rows.flatMap(y => Array.from({ length: 5 }, (_, x) => ({ x, y }))).filter(cell => !camps.has(`${cell.x},${cell.y}`));
        const hq = color === 'red' ? { x: 1, y: 11 } : { x: 1, y: 0 };
        const entry = game.setup[playerId];
        assert.equal(session.handleAction(playerId, { kind: 'setupReset' }).success, true);
        const pieces = [...entry.pieces].sort((a, b) => (a.type === 'flag' ? -1 : b.type === 'flag' ? 1 : a.type === 'mine' ? -1 : b.type === 'mine' ? 1 : a.type === 'bomb' ? -1 : b.type === 'bomb' ? 1 : 0));
        const used = new Set();
        for (const piece of pieces) {
            let cell = cells.find(candidate => !used.has(`${candidate.x},${candidate.y}`) && (piece.type !== 'flag' || candidate.x === hq.x && candidate.y === hq.y) && (piece.type !== 'mine' || (color === 'red' ? candidate.y >= 10 : candidate.y <= 1)) && (piece.type !== 'bomb' || candidate.y !== (color === 'red' ? 6 : 5)));
            assert.ok(cell, `${color} 没有可用布阵位置`);
            used.add(`${cell.x},${cell.y}`);
            assert.equal(session.handleAction(playerId, { kind: 'setupPlace', pieceId: piece.id, x: cell.x, y: cell.y }).success, true);
        }
        assert.equal(session.handleAction(playerId, { kind: 'setupReady' }).success, true);
    };
    placeAll('a', 'red');
    const redSetup = session.getPlayerState('a');
    const hiddenDuringSetup = session.getPlayerState('b');
    assert.equal(redSetup.setup.pieces.filter(piece => piece.placed).length, 25);
    assert.equal(hiddenDuringSetup.pieces.length, 25);
    placeAll('b', 'blue');
    const red = session.getPlayerState('a');
    const blue = session.getPlayerState('b');
    assert.equal(game.phase, 'play');
    assert.equal(red.pieces.length, 50);
    assert.equal(red.pieces.filter(piece => piece.ownerId === 'a' && piece.type !== 'unknown').length, 25);
    assert.equal(red.pieces.filter(piece => piece.ownerId === 'b' && piece.type === 'unknown').length, 25);
    assert.equal(blue.pieces.filter(piece => piece.ownerId === 'b' && piece.type !== 'unknown').length, 25);
    assert.equal(blue.pieces.filter(piece => piece.ownerId === 'a' && piece.type === 'unknown').length, 25);
    const movingChoice = Object.entries(red.legalMoves).flatMap(([id, moves]) => moves.map(to => ({ id, to }))).find(({ to }) => !game.board.has(`${to.x},${to.y}`));
    assert.ok(movingChoice, '应该存在至少一个不交战的普通移动');
    const movingPiece = red.pieces.find(piece => piece.id === movingChoice.id);
    const acknowledgement = session.handleAction('a', { kind: 'move', from: { x: movingPiece.x, y: movingPiece.y }, to: movingChoice.to });
    assert.equal(acknowledgement.success, true);
    assert.equal(acknowledgement.state.pieces.filter(piece => piece.ownerId === 'b' && piece.type !== 'unknown').length, 0);
    assert.equal(session.getPlayerState('b').actionLog.at(-1).includes(movingPiece.label), false);
});

test('Junqi default formation exposes a legal capture', () => {
    const session = Junqi.create('junqi-default-capture', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.handleAction('a', { kind: 'setupReady' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'setupReady' }).success, true);
    const state = session.getPlayerState('a');
    const choice = Object.entries(state.legalMoves).flatMap(([id, moves]) => moves.map(to => ({ id, to }))).find(({ to }) => session.engine.board.get(`${to.x},${to.y}`)?.color === 'blue');
    assert.ok(choice, '默认布阵应该至少提供一个可攻击目标');
    const attacker = state.pieces.find(piece => piece.id === choice.id);
    const defender = session.engine.board.get(`${choice.to.x},${choice.to.y}`);
    const result = session.handleAction('a', { kind: 'move', from: { x: attacker.x, y: attacker.y }, to: choice.to });
    assert.equal(result.success, true);
    assert.equal(session.engine.lastMove.capture.defenderType, defender.type);
});

test('Junqi resolves rank battles, engineer mines, bombs, and protects camps', () => {
    const session = Junqi.create('junqi-battle', players(['a', 'b'])); session.start(); const game = session.engine; game.phase = 'play'; game.setup.a.ready = true; game.setup.b.ready = true;
    game.board = new Map([
        ['0,6', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 0, y: 6, revealed: false }],
        ['0,5', { id: 'b-company', ownerId: 'b', color: 'blue', type: 'company', x: 0, y: 5, revealed: false }],
        ['1,7', { id: 'a-engineer', ownerId: 'a', color: 'red', type: 'engineer', x: 1, y: 7, revealed: false }],
        ['1,4', { id: 'b-engineer', ownerId: 'b', color: 'blue', type: 'engineer', x: 1, y: 4, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(game.board.get('0,5').type, 'commander');
    assert.equal(game.lastMove.capture.defenderType, 'company');

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['1,6', { id: 'a-eng', ownerId: 'a', color: 'red', type: 'engineer', x: 1, y: 6, revealed: false }],
        ['1,5', { id: 'b-mine', ownerId: 'b', color: 'blue', type: 'mine', x: 1, y: 5, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['0,6', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 0, y: 6, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 1, y: 6 }, to: { x: 1, y: 5 } }).success, true);
    assert.equal(game.board.get('1,5').type, 'engineer');

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['0,6', { id: 'a-bomb', ownerId: 'a', color: 'red', type: 'bomb', x: 0, y: 6, revealed: false }],
        ['0,5', { id: 'b-army', ownerId: 'b', color: 'blue', type: 'army', x: 0, y: 5, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['1,4', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 1, y: 4, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(game.board.has('0,5'), false);

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['2,3', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 2, y: 3, revealed: false }],
        ['1,2', { id: 'b-company', ownerId: 'b', color: 'blue', type: 'company', x: 1, y: 2, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['0,4', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 0, y: 4, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 2, y: 3 }, to: { x: 1, y: 2 } }).success, false);
});

test('Junqi uses camp diagonals, official rail crossings, and reveals the flag after commander loss', () => {
    const session = Junqi.create('junqi-board', players(['a', 'b'])); session.start(); const game = session.engine;
    assert.equal(game._isRailEdge(0, 5, 0, 6), true);
    assert.equal(game._isRailEdge(1, 5, 1, 6), false);
    assert.equal(game._isRailEdge(0, 1, 1, 1), true);
    assert.equal(game._isRailEdge(0, 0, 0, 1), false);
    const campPiece = { id: 'a-scout', ownerId: 'a', color: 'red', type: 'company', x: 2, y: 8, revealed: false };
    game.board = new Map([
        ['2,8', campPiece], ['0,7', { id: 'a-block', ownerId: 'a', color: 'red', type: 'company', x: 0, y: 7, revealed: false }],
        ['1,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 1, y: 11, revealed: false }],
        ['0,9', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 0, y: 9, revealed: false }]
    ]);
    assert.ok(game._legalMoves(campPiece).some(move => move.to.x === 1 && move.to.y === 7));
    game._remove(game.board.get('0,9'));
    assert.equal(game.board.get('1,11').revealed, true);
});

test('Junqi completes a full setup-to-result game with legal moves', () => {
    const session = Junqi.create('junqi-full', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const placeAll = (playerId, color) => {
        const rows = color === 'red' ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        const camps = new Set([[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]].map(([x, y]) => `${x},${y}`));
        const cells = rows.flatMap(y => Array.from({ length: 5 }, (_, x) => ({ x, y }))).filter(cell => !camps.has(`${cell.x},${cell.y}`));
        const hq = color === 'red' ? { x: 1, y: 11 } : { x: 1, y: 0 };
        assert.equal(session.handleAction(playerId, { kind: 'setupReset' }).success, true);
        const pieces = [...game.setup[playerId].pieces].sort((a, b) => (a.type === 'flag' ? -1 : b.type === 'flag' ? 1 : a.type === 'mine' ? -1 : b.type === 'mine' ? 1 : a.type === 'bomb' ? -1 : b.type === 'bomb' ? 1 : 0));
        const used = new Set();
        for (const piece of pieces) {
            const cell = cells.find(candidate => !used.has(`${candidate.x},${candidate.y}`) && (piece.type !== 'flag' || (candidate.x === hq.x && candidate.y === hq.y)) && (piece.type !== 'mine' || (color === 'red' ? candidate.y >= 10 : candidate.y <= 1)) && (piece.type !== 'bomb' || candidate.y !== (color === 'red' ? 6 : 5)));
            assert.ok(cell);
            used.add(`${cell.x},${cell.y}`);
            assert.equal(session.handleAction(playerId, { kind: 'setupPlace', pieceId: piece.id, x: cell.x, y: cell.y }).success, true);
        }
        assert.equal(session.handleAction(playerId, { kind: 'setupReady' }).success, true);
    };
    placeAll('a', 'red'); placeAll('b', 'blue');
    assert.equal(game.phase, 'play');
    let moves = 0;
    while (game.status === 'playing' && moves < 1000) {
        const player = game.players[game.currentTurnIndex];
        const options = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece));
        assert.ok(options.length);
        const move = options[(moves * 17) % options.length];
        assert.equal(session.handleAction(player.id, { kind: 'move', from: move.from, to: move.to }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(moves < 1000);
});

test('Jungle keeps water and trap capture rules explicit', () => {
    const session = Jungle.create('jungle-rules', players(['a', 'b'])); session.start(); const game = session.engine;
    game.board = new Map([
        ['1,3', { id: 'rat-a', x: 1, y: 3, type: 'r', color: 'red' }],
        ['2,3', { id: 'rat-b', x: 2, y: 3, type: 'r', color: 'blue' }],
        ['0,0', { id: 'den-b', x: 0, y: 0, type: 'e', color: 'blue' }],
    ]);
    assert.ok(game._legalMoves(game.board.get('1,3')).some(move => move.to.x === 2 && move.to.y === 3));
    assert.equal(game._canCapture({ type: 'e', color: 'red', x: 0, y: 1 }, { type: 'r', color: 'blue', x: 0, y: 2 }, { x: 0, y: 2 }), false);
    assert.equal(game._canCapture({ type: 'c', color: 'red', x: 1, y: 1 }, { type: 'r', color: 'blue', x: 2, y: 0 }, { x: 2, y: 0 }), true);
});

test('Jungle completes a full deterministic game through den capture', () => {
    const session = Jungle.create('jungle-full', players(['a', 'b'])); session.start(); const game = session.engine;
    let guard = 0;
    while (game.status === 'playing' && guard++ < 600) {
        const player = game.players.find(item => item.color === game.turn);
        const options = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece).map(move => ({ move })));
        assert.ok(options.length);
        const choice = options[guard % options.length].move;
        assert.equal(session.handleAction(player.id, { kind: 'move', from: choice.from, to: choice.to }).success, true);
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(guard < 600);
});

test('Citadels uses the official 67-card classic deck and 8 base roles', () => {
    const deck = CitadelsEngine.buildDistrictDeck();
    assert.equal(deck.length, 67);
    assert.equal(CitadelsEngine.ROLES.length, 8);
    assert.equal(new Set(deck.map(card => card.id)).size, 67);
    const byColor = deck.reduce((map, card) => { map[card.color] = (map[card.color] || 0) + 1; return map; }, {});
    assert.equal(byColor.yellow, 12);
    assert.equal(byColor.blue, 11);
    assert.equal(byColor.green, 20);
    assert.equal(byColor.red, 11);
    assert.equal(byColor.purple, 13);
    const effects = new Set(deck.filter(card => card.effect).map(card => card.effect));
    for (const effect of ['hauntedCity', 'keep', 'imperialTreasury', 'mapRoom', 'laboratory', 'observatory', 'smithy', 'graveyard', 'library', 'schoolOfMagic', 'greatWall']) {
        assert.ok(effects.has(effect), `${effect} 应在官方牌组中`);
    }
});

test('Citadels drafts roles with official face-up and face-down removal per player count', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const expectations = {
        2: { faceUp: 0, faceDown: 4, picked: 4 },
        3: { faceUp: 0, faceDown: 2, picked: 6 },
        4: { faceUp: 2, faceDown: 2, picked: 4 },
        5: { faceUp: 1, faceDown: 2, picked: 5 },
        6: { faceUp: 0, faceDown: 2, picked: 6 },
        7: { faceUp: 0, faceDown: 1, picked: 7 },
    };
    for (const n of [2, 3, 4, 5, 6, 7]) {
        const game = new CitadelsEngine(`draft-${n}`, players(ids.slice(0, n)), () => 0.5);
        assert.equal(game.start().success, true);
        let guard = 0;
        while (game.phase === 'role_selection' && guard++ < 30) {
            const pid = game.draftSteps[game.draftIndex].playerId;
            const options = game._draftOptions(pid);
            assert.ok(options.length);
            const result = game.draftDiscarding
                ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            assert.equal(result.success, true, result.message);
        }
        const expected = expectations[n];
        assert.equal(game.faceUpRoles.length, expected.faceUp, `${n} 人明置数`);
        assert.equal(game.faceDownRoles.length, expected.faceDown, `${n} 人暗置数`);
        assert.equal(Object.keys(game.selectedRoles).length, expected.picked, `${n} 人选中角色数`);
        assert.equal(game.phase, 'character_turn');
        if (n === 2 || n === 3) {
            assert.equal(game.players[0].roles.length, 2);
            assert.equal(game.players[1].roles.length, 2);
        }
    }
});

test('Citadels never leaves the King face-up and replays the 2-3 player draft round', () => {
    let kingFaceUp = 0;
    for (let i = 0; i < 200; i += 1) {
        const game = new CitadelsEngine('king-faceup', players(['a', 'b', 'c', 'd']), () => Math.random());
        game.start();
        if (game.faceUpRoles.includes('king')) kingFaceUp += 1;
    }
    assert.equal(kingFaceUp, 0);
    // 2 人局：完整跑一轮后进入下一轮选角
    const game = new CitadelsEngine('two-round', players(['a', 'b']), () => 0.31);
    game.start();
    let guard = 0;
    while (game.phase === 'role_selection' && guard++ < 20) {
        const pid = game.draftSteps[game.draftIndex].playerId;
        const options = game._draftOptions(pid);
        const result = game.draftDiscarding
            ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
            : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
        assert.equal(result.success, true);
    }
    while (game.round === 1 && game.status === 'playing' && guard++ < 400) {
        let result;
        if (game.phase === 'role_selection') {
            const pid = game.draftSteps[game.draftIndex].playerId;
            const options = game._draftOptions(pid);
            result = game.draftDiscarding
                ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            assert.equal(result.success, true, result.message);
            continue;
        }
        const pid = game.currentPlayerId;
        const player = game.playerMap[pid];
        const actions = game._availableActions(pid);
        if (game.pendingGraveyard) result = game.handleAction(game.pendingGraveyard.ownerId, { kind: 'declineGraveyard' });
        else if (actions.assassinate) result = game.handleAction(pid, { kind: 'assassinate', roleId: 'thief' });
        else if (actions.rob) result = game.handleAction(pid, { kind: 'rob', roleId: 'merchant' });
        else if (actions.drawDistrict) result = game.handleAction(pid, { kind: 'drawDistrict' });
        else if (actions.keepDistrict) { const count = game.drawKeepCount[pid] || 1; result = game.handleAction(pid, { kind: 'keepDistrict', cardIds: game.drawOptions[pid].slice(0, count).map(card => card.id) }); }
        else if (actions.buildDistrict) { const card = player.hand.find(item => item.cost <= player.gold && !player.city.some(existing => existing.name === item.name)); result = card ? game.handleAction(pid, { kind: 'buildDistrict', cardId: card.id }) : game.handleAction(pid, { kind: 'endTurn' }); }
        else result = game.handleAction(pid, { kind: 'endTurn' });
        assert.equal(result.success, true, result.message);
    }
    assert.equal(game.round, 2);
    assert.equal(game.phase, 'role_selection');
});

test('Citadels Magician can exchange hands or discard for the same number of cards', () => {
    const game = new CitadelsEngine('magician', players(['a', 'b', 'c']), () => 0.5);
    game.start();
    game.players[0].roles = [game._role('magician')];
    game.players[1].roles = [game._role('king')];
    game.players[2].roles = [game._role('merchant')];
    game.selectedRoles = { magician: 'a', king: 'b', merchant: 'c' };
    game.phase = 'character_turn';
    game.currentRoleRank = 3;
    game._advanceCharacter();
    const magician = game.players[0];
    const target = game.players[1];
    target.townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    magician.hand = [{ id: 'm1', name: 'M1', color: 'green', cost: 1, points: 1 }];
    target.hand = [{ id: 'k1', name: 'K1', color: 'blue', cost: 2, points: 2 }, { id: 'k2', name: 'K2', color: 'blue', cost: 2, points: 2 }];
    assert.equal(game.handleAction('a', { kind: 'magicianExchange', targetId: 'b' }).success, true);
    assert.equal(magician.hand.length, 2);
    assert.equal(target.hand.length, 1);
    // 已使用能力后不能再次交换
    assert.equal(game.handleAction('a', { kind: 'magicianExchange', targetId: 'b' }).success, false);
    // 换牌：弃 N 张手牌，摸回同数量
    const game2 = new CitadelsEngine('magician-swap', players(['a', 'b']), () => 0.5);
    game2.start();
    game2.players[0].roles = [game2._role('magician')];
    game2.selectedRoles = { magician: 'a', king: 'b' };
    game2.phase = 'character_turn';
    game2.currentRoleRank = 3;
    game2._advanceCharacter();
    const magician2 = game2.players[0];
    magician2.hand = [{ id: 'x1', name: 'X1', color: 'green', cost: 1, points: 1 }, { id: 'x2', name: 'X2', color: 'green', cost: 1, points: 1 }];
    game2.drawPile = [{ id: 'd1', name: 'D1', color: 'red', cost: 1, points: 1 }, { id: 'd2', name: 'D2', color: 'red', cost: 1, points: 1 }, { id: 'd3', name: 'D3', color: 'red', cost: 1, points: 1 }];
    const result = game2.handleAction('a', { kind: 'magicianSwap', cardIds: ['x1', 'x2'] });
    assert.equal(result.success, true);
    assert.equal(magician2.hand.length, 2);
    assert.equal(magician2.hand[0].id, 'd3');
    assert.equal(magician2.hand[1].id, 'd2');
});

test('Citadels Warlord obeys bishop, finished-city, Great Wall, Keep and own-city rules', () => {
    const game = new CitadelsEngine('warlord', players(['a', 'b']), () => 0.5);
    game.start();
    const warlord = game.players[0];
    const target = game.players[1];
    warlord.roles = [game._role('warlord')];
    game.selectedRoles = { warlord: 'a', merchant: 'b' };
    game.phase = 'character_turn';
    game.currentRoleRank = 8;
    game._advanceCharacter();
    game.turn.incomeTaken = true;
    game.turn.buildPhaseClosed = true;
    warlord.gold = 20;
    const card = (id, name, color, cost, extra = {}) => ({ id, name, color, cost, points: extra.points || cost, effect: extra.effect || null });
    // 主教保护
    target.roles = [game._role('bishop')];
    game.selectedRoles.bishop = 'b';
    target.city = [card('c1', '庄园', 'yellow', 3)];
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c1' }).success, false);
    // 已建成 8 座的城市受保护
    target.roles = [game._role('merchant')];
    delete game.selectedRoles.bishop;
    target.city = Array.from({ length: 8 }, (_, index) => card(`c8-${index}`, `D${index}`, index % 2 ? 'yellow' : 'blue', 2));
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c8-0' }).success, false);
    // 长城使摧毁费用 +1
    target.city = [card('c2', '庄园', 'yellow', 3), card('wall', '长城', 'purple', 6, { effect: 'greatWall' })];
    warlord.gold = 2;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c2' }).success, false);
    warlord.gold = 3;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'c2' }).success, true);
    assert.equal(warlord.gold, 0);
    // 摧毁长城本身不应把长城的 +1 成本算到自己身上（费用为 cost-1）。
    target.city = [card('wall-self', '长城', 'purple', 6, { effect: 'greatWall' })];
    warlord.gold = 5;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'wall-self' }).success, true);
    assert.equal(warlord.gold, 0);
    // 堡垒不可摧毁
    target.city = [card('keep', '堡垒', 'purple', 3, { effect: 'keep' })];
    warlord.gold = 20;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'keep' }).success, false);
    // 军阀可以攻击自己的城市
    warlord.city = [card('own', '酒馆', 'green', 1)];
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'a', cardId: 'own' }).success, true);
    assert.equal(warlord.city.length, 0);
    // 墓地回收：被摧毁城区的主人可付 1 金收回
    target.city = [card('church', '教堂', 'blue', 2), card('grave', '墓地', 'purple', 5, { effect: 'graveyard' })];
    target.gold = 1;
    game.turn.powerUsed = false;
    assert.equal(game.handleAction('a', { kind: 'destroyDistrict', targetId: 'b', cardId: 'church' }).success, true);
    assert.ok(game.pendingGraveyard);
    assert.equal(game.getPlayerState('b').availableActions.graveyardRecover, true);
    assert.equal(game.handleAction('b', { kind: 'graveyardRecover' }).success, true);
    assert.equal(target.hand.some(item => item.id === 'church'), true);
    assert.equal(target.gold, 0);
});

test('Citadels scores five colors, first finisher, purple districts and treasury/map room', () => {
    const card = (id, name, color, cost, extra = {}) => ({ id, name, color, cost, points: extra.points || cost, effect: extra.effect || null, builtRound: extra.builtRound || 1 });
    const game = new CitadelsEngine('scoring', players(['a', 'b']), () => 0.5);
    game.start();
    const a = game.players[0];
    const b = game.players[1];
    a.city = [card('a1', '大学', 'purple', 6, { points: 8 }), card('a2', '庄园', 'yellow', 3), card('a3', '神庙', 'blue', 1), card('a4', '酒馆', 'green', 1), card('a5', '瞭望塔', 'red', 1)];
    b.city = [card('b1', '巨龙门', 'purple', 6, { points: 8 }), card('b2', '城堡', 'yellow', 4), card('b3', '教堂', 'blue', 2), card('b4', '集市', 'green', 2), card('b5', '神殿', 'blue', 1), card('b6', '庄园', 'yellow', 3), card('b7', '酒馆', 'green', 1), card('b8', '瞭望塔', 'red', 1)];
    game.firstFinisherId = 'a';
    game.finalRound = 2;
    game._finish();
    const scoreA = game.scores.find(item => item.id === 'a');
    const scoreB = game.scores.find(item => item.id === 'b');
    assert.equal(scoreA.score, 8 + 3 + 1 + 1 + 1 + 4 + 3);
    assert.equal(scoreB.score, 8 + 4 + 2 + 2 + 1 + 3 + 1 + 1 + 2 + 3);
    // 帝国宝库 + 金币，地图室 + 手牌，鬼城补缺色
    const game2 = new CitadelsEngine('scoring2', players(['a', 'b']), () => 0.5);
    game2.start();
    const a2 = game2.players[0];
    a2.city = [card('t1', '帝国宝库', 'purple', 4, { effect: 'imperialTreasury' }), card('t2', '地图室', 'purple', 5, { effect: 'mapRoom' }), card('t3', '鬼城', 'purple', 2, { effect: 'hauntedCity' }), card('t4', '庄园', 'yellow', 3), card('t5', '神庙', 'blue', 1), card('t6', '酒馆', 'green', 1)];
    a2.gold = 7;
    a2.hand = [{ id: 'h1', name: 'H1', color: 'green', cost: 1, points: 1 }, { id: 'h2', name: 'H2', color: 'green', cost: 1, points: 1 }, { id: 'h3', name: 'H3', color: 'green', cost: 1, points: 1 }];
    game2.firstFinisherId = 'a';
    game2.finalRound = 2;
    game2._finish();
    const scoreA2 = game2.scores.find(item => item.id === 'a');
    assert.equal(scoreA2.districtSum, 4 + 5 + 2 + 3 + 1 + 1);
    assert.equal(scoreA2.score, scoreA2.districtSum + 7 + 3 + 3 + 4);
    // 鬼城在终局轮建成不能补缺色
    const game3 = new CitadelsEngine('scoring3', players(['a', 'b']), () => 0.5);
    game3.start();
    const a3 = game3.players[0];
    a3.city = [card('h1', '鬼城', 'purple', 2, { effect: 'hauntedCity', builtRound: 2 }), card('h2', '庄园', 'yellow', 3), card('h3', '神庙', 'blue', 1), card('h4', '酒馆', 'green', 1)];
    game3.firstFinisherId = 'a';
    game3.finalRound = 2;
    game3._finish();
    assert.equal(game3.scores.find(item => item.id === 'a').score, 2 + 3 + 1 + 1 + 4);
});

test('Citadels Architect draws two extra cards and may build three districts', () => {
    const game = new CitadelsEngine('architect', players(['a', 'b', 'c']), () => 0.5);
    game.start();
    const architect = game.players[0];
    architect.roles = [game._role('architect')];
    game.selectedRoles = { architect: 'a' };
    game.phase = 'character_turn';
    game.currentRoleRank = 7;
    game._advanceCharacter();
    assert.equal(architect.hand.length, 4, '建筑师额外牌应在完成资源行动后获得');
    assert.equal(game.handleAction('a', { kind: 'takeGold' }).success, true);
    assert.equal(architect.hand.length, 6);
    game.turn.incomeTaken = true;
    architect.gold = 30;
    architect.hand = [1, 2, 3, 4].map(cost => ({ id: `b-${cost}`, name: `B${cost}`, color: 'green', cost, points: cost }));
    for (let i = 0; i < 3; i += 1) {
        assert.equal(game.handleAction('a', { kind: 'buildDistrict', cardId: `b-${i + 1}` }).success, true);
    }
    assert.equal(game.handleAction('a', { kind: 'buildDistrict', cardId: 'b-4' }).success, false);
    assert.equal(architect.city.length, 3);
});

test('Citadels completes deterministic full games for every player count', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (const n of [2, 3, 4, 5, 6, 7]) {
        const game = new CitadelsEngine(`full-${n}`, players(ids.slice(0, n)), () => 0.42);
        assert.equal(game.start().success, true);
        let steps = 0;
        while (game.status === 'playing' && steps < 8000) {
            let result;
            if (game.phase === 'role_selection') {
                const pid = game.draftSteps[game.draftIndex].playerId;
                const options = game._draftOptions(pid);
                result = game.draftDiscarding
                    ? game.handleAction(pid, { kind: 'discardRole', roleId: options[0] })
                    : game.handleAction(pid, { kind: 'chooseRole', roleId: options[0] });
            } else {
                const pid = game.currentPlayerId;
                const player = game.playerMap[pid];
                const actions = game._availableActions(pid);
                if (game.pendingGraveyard) {
                    result = game.handleAction(game.pendingGraveyard.ownerId, { kind: actions.graveyardRecover ? 'graveyardRecover' : 'declineGraveyard' });
                } else if (actions.assassinate) result = game.handleAction(pid, { kind: 'assassinate', roleId: 'king' });
                else if (actions.rob) result = game.handleAction(pid, { kind: 'rob', roleId: 'merchant' });
                else if (actions.magicianExchange) { const target = game.players.find(item => item.id !== pid); result = game.handleAction(pid, { kind: 'magicianExchange', targetId: target.id }); }
                else if (actions.magicianSwap && player.hand.length >= 2) result = game.handleAction(pid, { kind: 'magicianSwap', cardIds: player.hand.slice(0, 2).map(card => card.id) });
                else if (actions.collectIncome) result = game.handleAction(pid, { kind: 'collectIncome' });
                else if (actions.laboratory && player.hand.length) result = game.handleAction(pid, { kind: 'laboratory', cardId: player.hand[0].id });
                else if (actions.smithy) result = game.handleAction(pid, { kind: 'smithy' });
                // 牌堆可能因玩家长期保留手牌而耗尽；此时按规则选择 2 金，
                // 让自动对局继续以合法方式建城，而不是把“摸空牌堆”当作资源。
                else if (actions.takeGold && game.drawPile.length < 2) result = game.handleAction(pid, { kind: 'takeGold' });
                else if (actions.drawDistrict) result = game.handleAction(pid, { kind: 'drawDistrict' });
                else if (actions.keepDistrict) { const count = game.drawKeepCount[pid] || 1; result = game.handleAction(pid, { kind: 'keepDistrict', cardIds: game.drawOptions[pid].slice(0, count).map(card => card.id) }); }
                else if (actions.buildDistrict) {
                    const card = player.hand.find(item => item.cost <= player.gold && !player.city.some(existing => existing.name === item.name));
                    result = card ? game.handleAction(pid, { kind: 'buildDistrict', cardId: card.id }) : (actions.closeBuild ? game.handleAction(pid, { kind: 'closeBuild' }) : game.handleAction(pid, { kind: 'endTurn' }));
                } else if (actions.closeBuild) result = game.handleAction(pid, { kind: 'closeBuild' });
                else if (actions.destroyDistrict) {
                    const candidates = game.players.filter(item => item.id !== pid && item.city.length && item.city.length < 8 && !(item.roles.some(role => role.id === 'bishop') && game.killedRole !== 'bishop'));
                    let target = null;
                    let card = null;
                    for (const candidate of candidates) {
                        const found = candidate.city.find(item => item.effect !== 'keep' && player.gold >= Math.max(0, item.cost - 1) + (candidate.city.some(x => x.effect === 'greatWall') ? 1 : 0));
                        if (found) { target = candidate; card = found; break; }
                    }
                    result = target && card ? game.handleAction(pid, { kind: 'destroyDistrict', targetId: target.id, cardId: card.id }) : game.handleAction(pid, { kind: 'endTurn' });
                } else {
                    result = game.handleAction(pid, { kind: 'endTurn' });
                }
            }
            assert.equal(result.success, true, `${n} 人局失败: ${result.message}`);
            steps += 1;
        }
        assert.equal(game.status, 'ended', `${n} 人局应正常结束`);
        assert.ok(game.winner);
        assert.ok(game.scores.length === n);
        assert.ok(steps < 8000);
    }
});
test('Witch Town resolves accusation cards and sheriff protection', () => {
    const session = Witchtown.create('witchtown-rules', players(['a', 'b', 'c', 'd'])); assert.equal(session.start().success, true); const game = session.engine;
    confirmWitchtownDossiers(session);
    const dawnWitch = game.players.find(player => player.everWitch);
    assert.ok(dawnWitch);
    assert.equal(session.handleAction(dawnWitch.id, { kind: 'chooseBlackCat', targetId: 'a' }).success, true);
    game.currentTurnId = 'a'; game.currentTurnIndex = 0;
    game.players.forEach(player => { player.everWitch = false; player.everConstable = false; player.trialCards.forEach(card => { card.type = 'town'; }); });
    game.players[0].identity = 'sheriff'; game.players[0].everConstable = true; game.players[0].trialCards[0].type = 'constable';
    game.players[1].identity = 'witch'; game.players[1].everWitch = true; game.players[1].townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' }; game.players[2].identity = 'villager'; game.players[3].identity = 'villager';
    game.players[0].hand = [{ id: 'accuse', kind: 'accuse', name: '指控' }];
    assert.equal(session.getPlayerState('c').players.find(player => player.id === 'b').identity, null);
    assert.equal(session.handleAction('a', { kind: 'playCard', cardId: 'accuse', targetId: 'b' }).success, true);
    assert.equal(game.players[1].redAccusations, 1);
    assert.equal(game._startNight().success, true);
    assert.equal(session.handleAction('b', { kind: 'nightKill', targetId: 'c' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'nightProtect', targetId: 'c' }).success, true);
    passWitchtownConfessions(session);
    assert.equal(game.players[2].eliminated, false);
});

test('Witch Town uses the standard 59-card deck and keeps card zones distinct', () => {
    const session = Witchtown.create('witchtown-card-zones', players(['a', 'b', 'c', 'd']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.deck.length, 46, '黑猫单独放置，59 张牌中开局发出 12 张');
    assert.equal(game.players.flatMap(player => player.hand).length, 12);
    assert.equal(game.players.flatMap(player => player.trialCards).length, 20);
    assert.equal(WitchtownEngine.CARD_DEFS.reduce((sum, [, , count]) => sum + count, 0) + 3, 59, '标准牌含黑猫、阴谋、夜幕');
    confirmWitchtownDossiers(session);
    const witch = game.players.find(player => player.everWitch);
    assert.equal(session.handleAction(witch.id, { kind: 'chooseBlackCat', targetId: 'a' }).success, true);
    game.currentTurnId = 'a'; game.currentTurnIndex = 0;
    const target = game.players[1];
    // The target is selected by seat for this card-zone assertion; make its
    // Town Hall deterministic so Sarah Good's arson immunity does not make
    // the test depend on the random opening deal.
    target.townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    target.hand = [{ id: 'secret-hand', kind: 'accusation', name: '指控', value: 1 }];
    target.redCards = [{ id: 'old-red-1', kind: 'accusation', value: 1 }, { id: 'old-red-2', kind: 'accusation', value: 1 }]; target.redAccusations = 2;
    game.players[0].hand = [{ id: 'arson-1', kind: 'arson', name: '纵火' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardId: 'arson-1', targetId: target.id }).success, true);
    assert.equal(target.hand.length, 0);
    assert.equal(target.redCards.length, 2, '纵火只清空手牌，不会误清指控区');
    assert.equal(game.discard.filter(card => card.id === 'arson-1').length, 1);
    game.players[0].hand = [{ id: 'stocks-1', kind: 'stocks', name: '枷锁' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardId: 'stocks-1', targetId: target.id }).success, true);
    assert.equal(target.blueCards.some(card => card.id === 'stocks-1'), true);
    assert.equal(game.discard.some(card => card.id === 'stocks-1'), false, '蓝牌留在玩家面前而不是重复进入弃牌堆');
});

test('Witch Town deals official-sized private trial cards and supports conspiracy passing', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const session = Witchtown.create('witchtown-official', players(ids));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.deepEqual(game.players.map(player => player.trialCards.length), [5, 5, 5, 5]);
    assert.equal(game.players.flatMap(player => player.trialCards).filter(card => card.type === 'witch').length, 1);
    assert.equal(game.players.flatMap(player => player.trialCards).filter(card => card.type === 'constable').length, 1);
    assert.equal(session.getPlayerState('a').players.find(player => player.id === 'b').identity, null);
    game._startConspiracy();
    for (const id of ids) {
        const state = session.getPlayerState(id);
        assert.equal(state.availableActions.passTrial, true);
        assert.equal(session.handleAction(id, { kind: 'passTrial', trialId: state.conspiracyOptions[0].id }).success, true);
    }
    assert.equal(game.phase, 'dossier_review');
    confirmWitchtownDossiers(session);
    assert.equal(game.phase, 'day');
});

test('Witch Town resumes the second draw after a first-card Conspiracy', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const session = Witchtown.create('witchtown-black-resume', players(ids));
    session.start(); const game = session.engine;
    confirmWitchtownDossiers(session);
    const witch = game.players.find(player => player.everWitch);
    assert.equal(session.handleAction(witch.id, { kind: 'chooseBlackCat', targetId: 'a' }).success, true);
    game.players[0].townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    game.currentTurnId = 'a'; game.currentTurnIndex = 0;
    game.deck = [{ id: 'after-black', kind: 'accusation', name: '指控', color: 'red', value: 1 }, { id: 'black-conspiracy', kind: 'conspiracy', name: '阴谋', color: 'black' }];
    assert.equal(session.handleAction('a', { kind: 'drawCards' }).success, true);
    assert.equal(game.phase, 'conspiracy');
    for (const id of ids) {
        const state = session.getPlayerState(id);
        assert.equal(session.handleAction(id, { kind: 'passTrial', trialId: state.conspiracyOptions[0].id }).success, true);
    }
    assert.equal(game.phase, 'dossier_review');
    confirmWitchtownDossiers(session);
    assert.equal(game.phase, 'day');
    assert.equal(game.players[0].hand.some(card => card.id === 'after-black'), true);
    assert.equal(game.currentTurnId, 'b', '完成第二张摸牌后才结束原玩家回合');
});

test('Witch Town treats a tied witch choice as no night kill', () => {
    const session = Witchtown.create('witchtown-tie', players(['a', 'b', 'c', 'd']));
    session.start(); const game = session.engine;
    game.players.forEach(player => { player.everWitch = false; player.everConstable = false; player.trialCards.forEach(card => { card.type = 'town'; }); });
    game.phase = 'night'; game.night = 1; game.nightStep = 'confession'; game.nightActions = { kills: { a: 'c', b: 'd' }, protect: null, confessions: {} };
    passWitchtownConfessions(session);
    assert.equal(game.players.find(player => player.id === 'c').eliminated, false);
    assert.equal(game.players.find(player => player.id === 'd').eliminated, false);
});

test('Witch Town confession immunity lasts only for the current night', () => {
    const session = Witchtown.create('witchtown-confess', players(['a', 'b', 'c', 'd']));
    session.start(); const game = session.engine;
    game.players.forEach(player => { player.identity = 'villager'; player.everWitch = false; player.everConstable = false; player.trialCards.forEach(card => { card.type = 'town'; }); });
    game._startNight();
    assert.equal(session.handleAction('a', { kind: 'confess', trialId: game.players[0].trialCards.find(card => !card.revealed).id }).success, true);
    game.nightActions.kills = { b: 'a' };
    passWitchtownConfessions(session);
    assert.equal(game.players[0].eliminated, false);
    game._startNight(); game.nightActions.kills = { b: 'a' };
    passWitchtownConfessions(session);
    assert.equal(game.players[0].eliminated, true);
});

test('Witch Town completes a six-player game through night protection and final trial reveals', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const session = Witchtown.create('witchtown-full-six', players(ids));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const trial = (type, id) => ({ id, type, revealed: false });
    game.players.forEach(player => { player.trialCards = Array.from({ length: 5 }, (_, index) => trial('town', `${player.id}-town-${index}`)); player.everWitch = false; player.everConstable = false; player.identity = 'villager'; player.eliminated = false; player.townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' }; player.townHallUsed = {}; });
    game.players[1].trialCards[0] = trial('witch', 'b-witch'); game.players[1].everWitch = true; game.players[1].identity = 'witch'; game.players[1].townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    game.players[2].trialCards[0] = trial('witch', 'c-witch'); game.players[2].everWitch = true; game.players[2].identity = 'witch'; game.players[2].townHall = { id: 'mary-warren', name: 'Mary Warren', description: '' };
    game.players[3].trialCards[0] = trial('constable', 'd-constable'); game.players[3].everConstable = true; game.players[3].identity = 'sheriff';
    game._startNight();
    assert.equal(session.handleAction('b', { kind: 'nightKill', targetId: 'e' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'nightKill', targetId: 'e' }).success, true);
    assert.equal(session.handleAction('d', { kind: 'nightProtect', targetId: 'e' }).success, true);
    passWitchtownConfessions(session);
    assert.equal(game.players.find(player => player.id === 'e').eliminated, false);
    game.phase = 'day'; game.currentTurnId = 'a'; game.currentTurnIndex = 0;
    game.players[0].hand = Array.from({ length: 14 }, (_, index) => ({ id: `accuse-${index}`, kind: 'accuse', name: '指控' }));
    for (let index = 0; index < 7; index += 1) assert.equal(session.handleAction('a', { kind: 'playCard', cardId: `accuse-${index}`, targetId: 'b' }).success, true);
    for (let index = 7; index < 14; index += 1) assert.equal(session.handleAction('a', { kind: 'playCard', cardId: `accuse-${index}`, targetId: 'c' }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.faction, 'town');
    assert.equal(game.revealedWitchCount, 2);
});

test('Witch Town client seals private dossiers and uses moderator-free scene transitions', () => {
    const client = fs.readFileSync('public/games/witchtown/client.js', 'utf8');
    const style = fs.readFileSync('public/games/witchtown/style.css', 'utf8');
    assert.match(client, /密封审判档案/);
    assert.match(client, /confirmDossier/);
    assert.match(client, /passConfession/);
    assert.match(client, /data-role="public-role"/);
    assert.match(client, /全员可见/);
    assert.match(client, /scheduleDossierSeal/);
    assert.match(client, /visibilitychange/);
    assert.match(client, /renderDayTargetSelectors/);
    assert.match(client, /blueCardOptions\(primaryId\)/);
    assert.match(client, /queueStateScenes/);
    assert.match(client, /您已出局/);
    assert.doesNotMatch(client, /宣布天亮|<b>主持人<\/b>/);
    assert.match(style, /\.witchtown-scene\.is-shattering/);
    assert.match(style, /witchtown-fragment-wind/);
    assert.match(style, /\.witchtown-seat-portrait[\s\S]*?aspect-ratio:\s*1/);
    assert.match(style, /\.witchtown-hall-art[\s\S]*?aspect-ratio:\s*1/);
    assert.doesNotMatch(style, /\.witchtown-public-trials[^{}]*\{[^}]*display:\s*none/);
    assert.doesNotMatch(style, /\.witchtown-public-cards[^{}]*\{[^}]*display:\s*none/);
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
    const shell = fs.readFileSync('public/script.js', 'utf8');
    assert.match(shell, /切换到下一方/);
    assert.match(shell, /STUDY_SIDE_LABELS/);
    assert.match(shell, /red: \[\['s', '兵'\].*black: \[\['s', '卒'/s);
    const xiangqiClient = fs.readFileSync('public/games/xiangqi/client.js', 'utf8');
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

test('Guess Number rejects repeated digits and returns A/B feedback', () => {
    const session = GuessNumber.create('guess', players(['a'])); session.start(); const game = session.engine; game.secret = '1234';
    const invalid = game.handleAction('a', { kind: 'submitGuess', guess: '1123' }); assert.equal(invalid.success, false);
    const valid = game.handleAction('a', { kind: 'submitGuess', guess: '1243' }); assert.equal(valid.success, true); assert.equal(valid.state.lastResult.exact, 2); assert.equal(valid.state.lastResult.misplaced, 2);
    assert.equal(valid.state.secret, null);
});

test('Guess Number is explicitly single-player', () => {
    const session = GuessNumber.create('guess-two', players(['a', 'b']));
    assert.equal(session.start().success, false);
    assert.match(session.start().message, /恰好 1 名玩家/);
});

test('Guess Number allows unlimited attempts and reveals the answer only at the end', () => {
    const session = GuessNumber.create('guess-loss', players(['a']));
    assert.equal(session.start().success, true);
    const game = session.engine; game.secret = '9876';
    const guesses = ['0123', '0145', '0168', '0234', '0257', '0345', '0461', '0523', '0681', '9876'];
    for (const guess of guesses.slice(0, -1)) {
        const result = session.handleAction('a', { kind: 'submitGuess', guess });
        assert.equal(result.success, true); assert.equal(result.ended, false);
    }
    assert.equal(game.players[0].attempts, 9);
    const tenth = session.handleAction('a', { kind: 'submitGuess', guess: '1230' });
    assert.equal(tenth.success, true); assert.equal(tenth.ended, false); assert.equal(game.players[0].attempts, 10); assert.equal(tenth.state.maxAttempts, null); assert.equal(tenth.state.players[0].remainingAttempts, null); assert.equal(game.getPlayerState('a').availableActions.canGuess, true);
    const final = session.handleAction('a', { kind: 'submitGuess', guess: guesses.at(-1) });
    assert.equal(final.success, true); assert.equal(final.ended, true); assert.equal(game.status, 'ended');
    assert.equal(final.state.lastResult.exact, 4); assert.equal(final.state.lastResult.misplaced, 0);
    assert.equal(final.state.secret, '9876'); assert.equal(final.state.winner.id, 'a');
    assert.equal(session.handleAction('a', { kind: 'submitGuess', guess: '0123' }).success, false);
});

test('Guess Number rejects malformed guesses without consuming an attempt', () => {
    const session = GuessNumber.create('guess-validation', players(['a'])); session.start(); const game = session.engine; game.secret = '0123';
    for (const guess of ['123', '12345', '12a3', '1123']) assert.equal(session.handleAction('a', { kind: 'submitGuess', guess }).success, false);
    assert.equal(game.players[0].attempts, 0);
});

test('Guess Number remains active after ten incorrect guesses', () => {
    const session = GuessNumber.create('guess-no-winner', players(['a'])); session.start(); const game = session.engine; game.secret = '9876';
    for (const guess of ['0123', '0145', '0168', '0234', '0257', '0345', '0461', '0523', '0681', '1230']) assert.equal(session.handleAction('a', { kind: 'submitGuess', guess }).success, true);
    assert.equal(game.status, 'playing'); assert.equal(game.players[0].attempts, 10); assert.equal(game.winner, null); assert.equal(game.getPublicState().secret, null);
    assert.equal(session.handleAction('a', { kind: 'submitGuess', guess: '0123' }).success, true);
    assert.equal(game.players[0].attempts, 11); assert.equal(game.status, 'playing');
});
