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
    const client = readWitchtownClient();
    const style = ['public/games/witchtown/style.css', 'public/games/witchtown/table.css', 'public/games/witchtown/dossier.css', 'public/games/witchtown/scenes.css', 'public/games/witchtown/responsive.css']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(client, /密封审判档案/);
    assert.match(client, /confirmDossier/);
    assert.match(client, /passConfession/);
    assert.match(client, /data-role="public-role"/);
    assert.match(client, /全员可见/);
    assert.match(client, /data-dossier-hold/);
    assert.match(client, /setDossierIdentityVisible\(true\)/);
    assert.match(client, /hideDossierIdentity/);
    assert.doesNotMatch(client, /scheduleDossierSeal|45000/);
    assert.match(client, /visibilitychange/);
    assert.match(client, /renderDayTargetSelectors/);
    assert.match(client, /blueCardOptions\(primaryId\)/);
    assert.match(client, /queueStateScenes/);
    assert.match(client, /您已出局/);
    assert.match(client, /event\.kind === 'victory' \? 2600/);
    assert.match(client, /event\.kind === 'identityReveal' \? 2000/);
    assert.match(client, /\['trialReveal', 'confession', 'nightResult'\]\.includes\(event\.kind\) \? 1600/);
    assert.doesNotMatch(client, /persistent: true/);
    assert.doesNotMatch(client, /宣布天亮|<b>主持人<\/b>/);
    assert.match(style, /\.witchtown-scene\.is-shattering/);
    assert.match(style, /witchtown-fragment-wind/);
    assert.match(style, /\.witchtown-seat-file\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(style, /\.witchtown-hall-art[\s\S]*?aspect-ratio:\s*1/);
    assert.doesNotMatch(style, /\.witchtown-public-trials[^{}]*\{[^}]*display:\s*none/);
    assert.doesNotMatch(style, /\.witchtown-public-cards[^{}]*\{[^}]*display:\s*none/);
});
