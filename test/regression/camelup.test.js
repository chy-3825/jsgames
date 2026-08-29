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

