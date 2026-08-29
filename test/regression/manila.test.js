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

