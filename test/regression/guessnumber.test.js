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

