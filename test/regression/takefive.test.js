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

