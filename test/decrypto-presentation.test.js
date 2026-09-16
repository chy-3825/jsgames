const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const DecryptoEngine = require('../server/games/decrypto/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);

function assertTimeline(state) {
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(Array.isArray(state.presentations));
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 0; index < batch.events.length; index += 1) {
            const event = batch.events[index];
            assert.equal(event.sequence, event.eventId);
            assert.ok(event.endsAt > event.startedAt);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    }
}

function confirmKeys(game) {
    for (const player of game.players) game.handleAction(player.id, { kind: 'confirmKey' });
}

function submitBothClues(game, prefix) {
    const firstEncryptor = game.currentTurn.encryptorId;
    assert.equal(game.handleAction(firstEncryptor, { kind: 'submitClue', clues: [`${prefix}甲`, `${prefix}乙`, `${prefix}丙`] }).success, true);
    if (!game.isThreePlayer) {
        const secondEncryptor = game.roundTurns[1].encryptorId;
        assert.equal(game.handleAction(secondEncryptor, { kind: 'submitClue', clues: [`${prefix}丁`, `${prefix}戊`, `${prefix}己`] }).success, true);
    }
}

function wrongCode(code) {
    return code[0] === 1 ? [2, 3, 4] : [1, 2, 3];
}

test('谍报风云把密钥、频道和揭晓事件排进服务器绝对时间轴', () => {
    let now = 1_000;
    const game = new DecryptoEngine('decrypto-presentation-timeline', players(['a', 'b', 'c', 'd']), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    confirmKeys(game);
    submitBothClues(game, '一');

    let state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['keysSealed', 'transmissionOpened']);
    assert.equal(eventsOf(state).some(event => event.keywords || event.currentCode), false);

    const redTeammate = game.teams[0].members.find(id => id !== game.roundTurns[0].encryptorId);
    assert.equal(game.handleAction(redTeammate, { kind: 'submitOwnGuess', code: game.currentTurn.code }).success, true);
    const blueTeammate = game.teams[1].members.find(id => id !== game.roundTurns[1].encryptorId);
    assert.equal(game.handleAction(blueTeammate, { kind: 'submitOwnGuess', code: game.currentTurn.code }).success, true);

    state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['keysSealed', 'transmissionOpened', 'transmissionResolved', 'transmissionResolved']);
    const resolved = eventsOf(state).filter(event => event.kind === 'transmissionResolved');
    assert.ok(resolved.every(event => Array.isArray(event.code) && event.code.length === 3));
    assert.equal(resolved.some(event => event.currentCode || event.keywords), false);
});

test('谍报风云固定加密员选举进入同一条公共事件协议', () => {
    let now = 2_000;
    const game = new DecryptoEngine('decrypto-presentation-fixed', players(['a', 'b', 'c', 'd']), { random: () => 0, now: () => now, encryptorMode: 'fixed_vote' });
    game.start();
    confirmKeys(game);
    assert.deepEqual(eventsOf(game.getPublicState()).map(event => event.kind), ['encryptorElectionStarted']);
    for (const [index, player] of game.players.entries()) {
        const candidate = game.teams[player.team].members[index % game.teams[player.team].members.length];
        assert.equal(game.handleAction(player.id, { kind: 'voteEncryptor', playerId: candidate }).success, true);
    }
    const state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['encryptorElectionStarted', 'keysSealed']);
    assert.equal(eventsOf(state).some(event => event.keywords || event.currentCode), false);
});

test('谍报风云在同一批次串行播放电报揭晓、平局判定和终局', () => {
    let now = 3_000;
    const game = new DecryptoEngine('decrypto-presentation-tiebreak', players(['a', 'b', 'c', 'd']), { random: () => 0, now: () => now });
    game.start();
    confirmKeys(game);
    let turn = 0;
    while (game.phase !== 'tiebreak') {
        submitBothClues(game, `平${turn}`);
        for (let teamTurn = 0; teamTurn < 2 && game.phase === 'guessing'; teamTurn += 1) {
            const activeEncryptor = game.currentTurn.encryptorId;
            if (game.round > 1) {
                const opponent = game.teams[1 - game.activeTeam].members[0];
                assert.equal(game.handleAction(opponent, { kind: 'submitIntercept', code: wrongCode(game.currentTurn.code) }).success, true);
            }
            const teammate = game.teams[game.activeTeam].members.find(id => id !== activeEncryptor);
            assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code: wrongCode(game.currentTurn.code) }).success, true);
        }
        turn += 1;
        assert.ok(turn <= 8);
    }
    const state = game.getPublicState();
    assertTimeline(state);
    const lastBatch = state.presentations.at(-1);
    assert.deepEqual(lastBatch.events.map(event => event.kind), ['transmissionResolved', 'tiebreakStarted']);
    assert.equal(lastBatch.events[1].scores.length, 2);
});

test('谍报风云房间在公共播报结束前锁定下一步操作', () => {
    const room = new Room('decrypto-presentation-lock', 'a', '玩家a', 'decrypto', {}, { readyCheckEnabled: true });
    assert.equal(room.configure('a', { encryptorMode: 'rotation' }).success, true);
    for (const player of players(['a', 'b', 'c'])) assert.equal(room.addPlayer(player).success, true);
    for (const id of ['b', 'c']) assert.equal(room.setPlayerReady(id, true).success, true);
    assert.equal(room.startGame().success, true);
    for (const id of ['a', 'b', 'c']) assert.equal(room.handleGameAction(id, { kind: 'confirmKey' }).success, true);
    const locked = room.getPlayerGameState('a').presentation;
    assert.equal(locked.blocking, true);
    const rejected = room.handleGameAction('a', { kind: 'submitClue', clues: ['甲', '乙', '丙'] });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);

    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        assert.equal(room.handleGameAction('a', { kind: 'submitClue', clues: ['甲', '乙', '丙'] }).success, true);
    } finally {
        Date.now = realNow;
    }
});

test('谍报风云只给获胜队成员个人获胜播报，公共时间槽保持一致', () => {
    let now = 4_000;
    const game = new DecryptoEngine('decrypto-presentation-personal', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    game.start();
    confirmKeys(game);
    for (let round = 1; round <= 3 && game.status === 'playing'; round += 1) {
        const encryptor = game.currentTurn.encryptorId;
        const code = game.currentTurn.code.slice();
        assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: [`终${round}甲`, `终${round}乙`, `终${round}丙`] }).success, true);
        if (round > 1) assert.equal(game.handleAction('c', { kind: 'submitIntercept', code }).success, true);
        const teammate = game.teams[0].members.find(id => id !== encryptor);
        assert.equal(game.handleAction(teammate, { kind: 'submitOwnGuess', code }).success, true);
    }
    assert.equal(game.status, 'ended');
    const publicEvent = eventsOf(game.getPublicState()).find(event => event.kind === 'finalSettlement');
    const winnerEvent = eventsOf(game.getPlayerState('c')).find(event => event.kind === 'finalSettlement');
    const opponentEvent = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalSettlement');
    assert.ok(publicEvent);
    assert.equal(publicEvent.title, undefined);
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(opponentEvent.viewerVariant, undefined);
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
});

test('谍报风云离场自动补全猜码并继续生成揭晓事件', () => {
    let now = 5_000;
    const game = new DecryptoEngine('decrypto-presentation-leave', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    game.start();
    confirmKeys(game);
    const encryptor = game.currentTurn.encryptorId;
    assert.equal(game.handleAction(encryptor, { kind: 'submitClue', clues: ['离甲', '离乙', '离丙'] }).success, true);
    assert.equal(game.handlePlayerLeave('c').success, true);
    assert.equal(game.handlePlayerLeave('b').success, true);
    const state = game.getPublicState();
    assertTimeline(state);
    assert.ok(eventsOf(state).some(event => event.kind === 'transmissionResolved'));
    assert.equal(game.phase === 'guessing' || game.phase === 'clue' || game.status === 'ended', true);
});

test('谍报风云客户端可转换服务器绝对时间并忽略过期批次', async () => {
    const { localizePresentation } = await import('../public/games/decrypto/state.js');
    const batch = {
        sequence: 7,
        serverNow: 10_000,
        startedAt: 10_100,
        endsAt: 11_000,
        events: [{ kind: 'transmissionOpened', startedAt: 10_100, endsAt: 10_700 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].startedAt, 50_100);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
