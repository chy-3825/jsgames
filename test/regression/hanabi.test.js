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

