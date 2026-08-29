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

