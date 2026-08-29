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

