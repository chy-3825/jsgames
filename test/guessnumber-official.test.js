const test = require('node:test');
const assert = require('node:assert/strict');
const GuessNumber = require('../server/games/guessnumber');

function player(id = 'a') { return [{ id, name: `玩家${id}` }]; }

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function rotate(value, amount) {
    const shift = amount % value.length;
    return value.slice(shift) + value.slice(0, shift);
}

test('Guess Number enforces the single-player lifecycle and keeps the answer private', () => {
    const tooMany = GuessNumber.create('guess-too-many', player('a').concat({ id: 'b', name: '玩家b' }));
    assert.equal(tooMany.start().success, false);
    assert.match(tooMany.start().message, /恰好 1 名玩家/);

    const session = GuessNumber.create('guess-lifecycle', player(), { random: seededRandom(1001) });
    assert.equal(session.start().success, true);
    assert.equal(session.start().success, false, '已经开始的单人局不能重复开始');
    const game = session.engine;
    assert.match(game.secret, /^\d{4}$/);
    assert.equal(new Set(game.secret).size, 4);
    assert.equal(session.getPlayerState('a').secret, null);
    assert.equal(session.getPlayerState('a').availableActions.canGuess, true);
    assert.equal(session.handleAction('a', { kind: 'unknown' }).success, false);
});

test('Guess Number rejects every malformed or repeated guess without consuming an attempt', () => {
    const session = GuessNumber.create('guess-validation-official', player(), { random: seededRandom(1002) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    for (const guess of ['', '123', '12345', '12a3', '1123', '１２３４']) {
        assert.equal(session.handleAction('a', { kind: 'submitGuess', guess }).success, false, `应拒绝 ${guess}`);
    }
    assert.equal(game.players[0].attempts, 0);
    assert.equal(game.players[0].history.length, 0);
    const valid = session.handleAction('a', { kind: 'submitGuess', guess: '0123' });
    assert.equal(valid.success, true);
    assert.equal(game.players[0].attempts, 1);
    assert.equal(valid.state.secret, null);
    assert.equal(valid.state.lastResult.guess, '0123');
    assert.equal(valid.state.lastResult.exact + valid.state.lastResult.misplaced + valid.state.lastResult.absent, 4);
});

function playCompleteGame(seed) {
    const session = GuessNumber.create(`guess-full-${seed}`, player(), { random: seededRandom(seed) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const secret = game.secret;
    const wrong = [rotate(secret, 1), rotate(secret, 2), secret.split('').reverse().join('')].filter(guess => guess !== secret);
    for (const guess of wrong) {
        const result = session.handleAction('a', { kind: 'submitGuess', guess });
        assert.equal(result.success, true);
        assert.equal(result.ended, false);
        assert.equal(result.state.secret, null);
    }
    const solved = session.handleAction('a', { kind: 'submitGuess', guess: secret });
    assert.equal(solved.success, true);
    assert.equal(solved.ended, true);
    assert.equal(solved.state.status, 'ended');
    assert.equal(solved.state.secret, secret);
    assert.equal(solved.state.lastResult.exact, 4);
    assert.equal(solved.state.lastResult.misplaced, 0);
    assert.equal(solved.state.winner.id, 'a');
    assert.equal(game.players[0].attempts, wrong.length + 1);
    assert.equal(session.handleAction('a', { kind: 'submitGuess', guess: '0123' }).success, false);
    return { seed, secret, attempts: game.players[0].attempts };
}

test('Guess Number completes three independent single-player games', () => {
    const results = [2001, 2002, 2003].map(playCompleteGame);
    assert.equal(results.length, 3);
    assert.ok(results.every(result => result.attempts >= 2));
    assert.ok(new Set(results.map(result => result.secret)).size >= 2, '种子应能产生可复现但不恒定的答案');
});

test('Guess Number supports unlimited attempts and only exposes the answer after 4A', () => {
    const session = GuessNumber.create('guess-unlimited-official', player(), { random: seededRandom(2004) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const secret = game.secret;
    const guesses = [rotate(secret, 1), rotate(secret, 2), rotate(secret, 3), rotate(secret, 1), rotate(secret, 2), rotate(secret, 3), rotate(secret, 1), rotate(secret, 2), rotate(secret, 3), rotate(secret, 1), rotate(secret, 2)];
    for (const guess of guesses) {
        assert.notEqual(guess, secret);
        assert.equal(session.handleAction('a', { kind: 'submitGuess', guess }).success, true);
        assert.equal(game.status, 'playing');
        assert.equal(game.getPublicState().secret, null);
    }
    assert.equal(game.players[0].attempts, guesses.length);
    assert.equal(session.handleAction('a', { kind: 'submitGuess', guess: secret }).ended, true);
    assert.equal(game.getPublicState().secret, secret);
});
