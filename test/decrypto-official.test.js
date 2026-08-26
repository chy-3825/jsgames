const test = require('node:test');
const assert = require('node:assert/strict');
const DecryptoEngine = require('../server/games/decrypto/engine');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));
}

function wrongCode(code) {
    const candidate = [1, 2, 3];
    return candidate.every((value, index) => value === code[index]) ? [2, 3, 4] : candidate;
}

function confirmKeys(game) {
    if (game.phase !== 'keycheck') return;
    for (const player of game.players) if (!game.keyConfirmed[player.id]) assert.equal(game.handleAction(player.id, { kind: 'confirmKey' }).success, true);
}

function submitClueAndOwnGuess(game, clueSeed, ownCorrect = true, intercept = false) {
    confirmKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    const code = game.currentTurn.code.slice();
    if (game.phase === 'clue') {
        assert.equal(game.handleAction(encryptor, { kind: 'submitClue', code: [4, 4, 4], clues: [`线索${clueSeed}-甲`, `线索${clueSeed}-乙`, `线索${clueSeed}-丙`] }).success, true);
        if (!game.isThreePlayer) {
            const otherEncryptor = game.roundTurns[1].encryptorId;
            assert.equal(game.handleAction(otherEncryptor, { kind: 'submitClue', clues: [`线索${clueSeed}-丁`, `线索${clueSeed}-戊`, `线索${clueSeed}-己`] }).success, true);
        }
    }
    const opponent = game.teams[1 - game.activeTeam].members[0];
    if (intercept) assert.equal(game.handleAction(opponent, { kind: 'submitIntercept', code: wrongCode(code) }).success, true);
    const teammate = game.teams[game.activeTeam].members.find(id => id !== encryptor);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: ownCorrect ? code : wrongCode(code) }).success, true);
}

test('Decrypto builds the official 24-card code deck and validates the roster', () => {
    const deck = DecryptoEngine.buildCodeDeck();
    assert.equal(deck.length, 24);
    assert.equal(new Set(deck.map(code => code.join(''))).size, 24);
    assert.equal(deck.every(code => new Set(code).size === 3), true);
    const tooMany = new DecryptoEngine('decrypto-nine', players(9), () => 0);
    assert.equal(tooMany.start().success, false);
    const duplicate = new DecryptoEngine('decrypto-duplicate', [{ id: 'x', name: '甲' }, { id: 'x', name: '乙' }, ...players(1)], () => 0);
    assert.equal(duplicate.start().success, false);
    const game = new DecryptoEngine('decrypto-once', players(4), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.phase, 'keycheck');
    assert.equal(game.start().success, false);
});

test('Decrypto keeps the generated code private to the encryptor and prevents clue/code cheating', () => {
    const game = new DecryptoEngine('decrypto-private', players(4), () => 0);
    assert.equal(game.start().success, true);
    confirmKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    const teammate = game.teams[0].members.find(id => id !== encryptor);
    const opponent = game.teams[1].members[0];
    const generated = game.currentTurn.code.slice();
    assert.equal(game.getPlayerState(encryptor).currentCode.join(','), generated.join(','));
    assert.equal(game.getPlayerState(teammate).currentCode, null);
    assert.equal(game.getPlayerState(opponent).currentCode, null);
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', code: [1, 2, 3], clues: [game.teams[0].keywords[0], '公开线索乙', '公开线索丙'] }).success, false);
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', code: [4, 4, 4], clues: ['公开线索甲', '公开线索乙', '公开线索丙'] }).success, true);
    assert.equal(game.history.length, 0);
    assert.equal(game.getPlayerState(teammate).currentCode, null);
    const otherEncryptor = game.roundTurns[1].encryptorId;
    assert.equal(game.handleAction(otherEncryptor, { kind: 'submitClue', clues: ['蓝队线索甲', '蓝队线索乙', '蓝队线索丙'] }).success, true);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: [1, 1, 2] }).success, false);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: generated }).success, true);
    assert.deepEqual(game.history[0].code, generated);
});

test('Decrypto enforces unique clues and counts duplicate tiebreak guesses once', () => {
    const game = new DecryptoEngine('decrypto-clues', players(4), () => 0);
    game.start();
    confirmKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: ['重复', '重复', '第三'] }).success, false);
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: ['独一', '独二', '独三'] }).success, true);
    assert.equal(game.handleAction(game.roundTurns[1].encryptorId, { kind: 'submitClue', clues: ['蓝一', '蓝二', '蓝三'] }).success, true);
    const teammate = game.teams[0].members.find(id => id !== encryptor);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: game.currentTurn.code }).success, true);
    const target0 = game.teams[0].keywords;
    const target1 = game.teams[1].keywords;
    game.phase = 'tiebreak'; game.tiebreakGuesses = {};
    assert.equal(game.handleAction(game.teams[0].members[0], { kind: 'tiebreakGuess', keywords: [target1[0], target1[0], '不存在甲', '不存在乙'] }).success, true);
    assert.equal(game.handleAction(game.teams[1].members[0], { kind: 'tiebreakGuess', keywords: [target0[0], '不存在丙', '不存在丁', '不存在戊'] }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.teamId, null);
});

test('Decrypto completes three independent maximum-player games through eight rounds and tiebreak', () => {
    for (let run = 1; run <= 3; run += 1) {
        const game = new DecryptoEngine(`decrypto-max-${run}`, players(8), () => 0);
        assert.equal(game.start().success, true);
        confirmKeys(game);
        let clueSeed = 0;
        while (game.status === 'playing' && game.phase !== 'tiebreak') {
            submitClueAndOwnGuess(game, `${run}-${clueSeed++}`, true, game.round > 1);
        }
        assert.equal(game.phase, 'tiebreak');
        const red = game.teams[0].keywords.slice();
        const blue = game.teams[1].keywords.slice();
        assert.equal(game.handleAction(game.teams[0].members[0], { kind: 'tiebreakGuess', keywords: blue }).success, true);
        assert.equal(game.handleAction(game.teams[1].members[0], { kind: 'tiebreakGuess', keywords: ['不存在一', '不存在二', '不存在三', '不存在四'] }).success, true);
        assert.equal(game.status, 'ended');
        assert.equal(game.winner.teamId, 0);
        assert.equal(game.history.length, 16);
        assert.equal(red.length, 4);
    }
});

test('Decrypto preserves the official three-player lone-interceptor flow', () => {
    const game = new DecryptoEngine('decrypto-three-official', players(3), () => 0);
    assert.equal(game.start().success, true);
    confirmKeys(game);
    assert.deepEqual(game.teams.map(team => team.members), [['p1', 'p2'], ['p3']]);
    submitClueAndOwnGuess(game, 'three-1', true, false);
    assert.equal(game.round, 2);
    assert.equal(game.currentTurn.encryptorId, 'p2');
    const code = game.currentTurn.code.slice();
    const encryptor = game.currentTurn.encryptorId;
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: ['三人甲', '三人乙', '三人丙'] }).success, true);
    assert.equal(game.handleAction('p3', { kind: 'submitIntercept', code: code }).success, true);
    const teammate = game.teams[0].members.find(id => id !== encryptor);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: wrongCode(code) }).success, true);
    assert.equal(game.teams[1].interceptions, 2);
    assert.equal(game.winner.teamId, 1);
});

test('Decrypto seals both guesses before revealing or scoring the transmission', () => {
    const game = new DecryptoEngine('decrypto-sealed-guesses', players(4), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.handleAction('p1', { kind: 'submitClue', clues: ['越权甲', '越权乙', '越权丙'] }).success, false);
    const firstConfirmation = game.handleAction('p1', { kind: 'confirmKey' });
    assert.equal(firstConfirmation.success, true);
    assert.equal(game.getPlayerAction(firstConfirmation, 'p2').message, '');
    assert.equal(game.getPublicState().keyConfirmCount, 1);
    confirmKeys(game);
    submitClueAndOwnGuess(game, 'sealed-first', true, false);
    submitClueAndOwnGuess(game, 'sealed-first-blue', true, false);
    assert.equal(game.round, 2);
    const redEncryptor = game.currentTurn.encryptorId;
    assert.equal(game.handleAction(redEncryptor, { kind: 'submitClue', clues: ['封存甲', '封存乙', '封存丙'] }).success, true);
    assert.equal(game.handleAction(game.roundTurns[1].encryptorId, { kind: 'submitClue', clues: ['密封甲', '密封乙', '密封丙'] }).success, true);
    const code = game.currentTurn.code.slice();
    const opponent = game.teams[1].members[0];
    const historyBefore = game.history.length;
    assert.equal(game.handleAction(opponent, { kind: 'submitIntercept', code }).success, true);
    assert.equal(game.phase, 'guessing');
    assert.equal(game.history.length, historyBefore);
    assert.equal(game.teams[1].interceptions, 0);
    assert.equal(game.actionLog.some(entry => entry.includes('成功截获')), false);
    assert.equal(game.getPublicState().interceptSubmitted, true);
    const teammate = game.teams[0].members.find(id => id !== redEncryptor);
    assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: wrongCode(code) }).success, true);
    assert.equal(game.history.length, historyBefore + 1);
    assert.equal(game.teams[1].interceptions, 1);
    assert.equal(game.teams[0].miscommunications, 1);
});

test('Decrypto fixed-vote mode elects within each team and keeps the winners fixed', () => {
    const game = new DecryptoEngine('decrypto-fixed', players(6), () => 0, { encryptorMode: 'fixed_vote' });
    assert.equal(game.start().success, true);
    confirmKeys(game);
    assert.equal(game.phase, 'encryptor_vote');
    assert.equal(game.getPlayerState('p1').availableActions.voteEncryptor, true);
    assert.deepEqual(game.getPlayerState('p1').encryptorCandidates.map(candidate => candidate.id), ['p1', 'p3', 'p5']);
    assert.equal(game.handleAction('p1', { kind: 'voteEncryptor', playerId: 'p2' }).success, false);
    const votes = { p1: 'p3', p3: 'p3', p5: 'p1', p2: 'p4', p4: 'p4', p6: 'p2' };
    for (const [voter, candidate] of Object.entries(votes)) assert.equal(game.handleAction(voter, { kind: 'voteEncryptor', playerId: candidate }).success, true);
    assert.equal(game.phase, 'clue');
    assert.deepEqual(game.fixedEncryptors, ['p3', 'p4']);
    assert.deepEqual(game.roundTurns.map(turn => turn.encryptorId), ['p3', 'p4']);
    game.round = 2;
    game._beginRound();
    assert.deepEqual(game.roundTurns.map(turn => turn.encryptorId), ['p3', 'p4']);
});

test('Decrypto random mode never selects the same encryptor in consecutive rounds', () => {
    const game = new DecryptoEngine('decrypto-random', players(8), () => 0, { encryptorMode: 'random' });
    assert.equal(game.start().success, true);
    confirmKeys(game);
    const first = game.roundTurns.map(turn => turn.encryptorId);
    game.round = 2;
    game._beginRound();
    const second = game.roundTurns.map(turn => turn.encryptorId);
    assert.notEqual(second[0], first[0]);
    assert.notEqual(second[1], first[1]);
    assert.equal(game.getPublicState().encryptorMode, 'random');
});

test('Decrypto three-player fixed vote excludes the lone interceptor', () => {
    const game = new DecryptoEngine('decrypto-fixed-three', players(3), () => 0, { encryptorMode: 'fixed_vote' });
    game.start();
    confirmKeys(game);
    assert.equal(game.getPlayerState('p3').availableActions.voteEncryptor, false);
    assert.equal(game.handleAction('p1', { kind: 'voteEncryptor', playerId: 'p2' }).success, true);
    assert.equal(game.handleAction('p2', { kind: 'voteEncryptor', playerId: 'p2' }).success, true);
    assert.equal(game.currentTurn.encryptorId, 'p2');
});
