const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const TakeFive = require('../server/games/takefive');
const TakeFiveEngine = require('../server/games/takefive/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function fresh(ids = ['a', 'b'], seed = 1) {
    const session = TakeFive.create(`takefive-${seed}`, players(ids), undefined, { random: lcg(seed) });
    assert.equal(session.start().success, true);
    return session;
}

function card(id, value) {
    return { id, value, bullheads: TakeFiveEngine.bullheads(value) };
}

function setSelecting(game, rows, hands, round = 1) {
    game.phase = 'selecting';
    game.round = round;
    game.selected.clear();
    game.pendingRowChoice = null;
    game.revealedCards = [];
    game.lastResolution = [];
    game.rows = rows.map(row => row.map(item => ({ ...item })));
    game.players.forEach((player, index) => { player.hand = (hands[index] || []).map(item => ({ ...item })); });
}

test('牛头王基础牌组、人数、起手和私有手牌符合官方规则', () => {
    const deck = TakeFiveEngine.buildDeck();
    assert.equal(deck.length, 104);
    assert.deepEqual(deck.map(card => card.value), Array.from({ length: 104 }, (_, index) => index + 1));
    assert.equal(new Set(deck.map(card => card.id)).size, 104);
    assert.deepEqual([1, 5, 10, 11, 15, 22, 55, 100, 104].map(value => TakeFiveEngine.bullheads(value)), [1, 2, 3, 5, 2, 5, 7, 3, 1]);

    const session = fresh(Array.from({ length: 10 }, (_, index) => String.fromCharCode(97 + index)), 101);
    const game = session.engine;
    assert.deepEqual(game.players.map(player => player.hand.length), Array(10).fill(10));
    assert.deepEqual(game.rows.map(row => row.length), [1, 1, 1, 1]);
    assert.equal(game.deck.length, 0, '十人局 100 张手牌加四行起始牌应刚好用完');
    assert.equal(game.getPlayerState('a').myHand.length, 10);
    assert.equal(game.getPlayerState('b').players.find(player => player.id === 'a').handCount, 10);
    assert.equal(TakeFive.create('too-many', players(Array.from({ length: 11 }, (_, index) => String(index)))).start().success, false);
    assert.equal(session.start().success, false, '同一会话不能重复开始');
});

test('所有玩家锁定后才公开，且按牌面从小到大、最近行尾依次放置', () => {
    const session = fresh(['a', 'b', 'c'], 102);
    const game = session.engine;
    setSelecting(game, [[card('r1', 10)], [card('r2', 20)], [card('r3', 30)], [card('r4', 40)]], [
        [card('a-25', 25)], [card('b-15', 15)], [card('c-35', 35)],
    ]);
    assert.equal(session.handleAction('c', { kind: 'selectCard', cardId: 'c-35' }).success, true);
    assert.equal(game.phase, 'selecting');
    assert.equal(game.getPublicState().revealedCards.length, 0, '未全部锁定前不得公开出牌');
    assert.equal(session.handleAction('b', { kind: 'selectCard', cardId: 'b-15' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'selectCard', cardId: 'b-15' }).success, false, '同一玩家不能重复锁牌');
    const result = session.handleAction('a', { kind: 'selectCard', cardId: 'a-25' });
    assert.equal(result.success, true);
    assert.deepEqual(game.lastResolution.map(item => item.card.value), [15, 25, 35]);
    assert.deepEqual(game.lastResolution.map(item => item.rowIndex), [0, 1, 2]);
    assert.deepEqual(game.rows.slice(0, 3).map(row => row.map(item => item.value)), [[10, 15], [20, 25], [30, 35]]);
    assert.deepEqual(result.state.revealedCards.map(item => item.card.value), [15, 25, 35]);
    assert.equal(result.state.resolutionEvent.status, 'complete');
    assert.deepEqual(result.state.resolutionEvent.initialRows.map(row => row[0].value), [10, 20, 30, 40]);
    assert.deepEqual(result.state.resolutionEvent.steps.map(step => [step.playerId, step.card.value, step.rowIndex, step.kind]), [
        ['b', 15, 0, 'place'], ['a', 25, 1, 'place'], ['c', 35, 2, 'place'],
    ]);
    game.players[0].hand = [card('a-next', 45)];
    const nextRoundLock = session.handleAction('a', { kind: 'selectCard', cardId: 'a-next' });
    assert.equal(nextRoundLock.success, true);
    assert.equal(nextRoundLock.state.revealedCards.length, 0, '新一轮首张暗牌锁定时应收起上轮翻牌');
    assert.equal(nextRoundLock.state.lastResolution.length, 0);
});

test('第六张收走整行，低牌必须选行并把出牌作为新行首', () => {
    const session = fresh(['a', 'b'], 103);
    const game = session.engine;
    setSelecting(game, [
        [card('r1a', 10), card('r1b', 20), card('r1c', 30), card('r1d', 40), card('r1e', 50)],
        [card('r2', 70)], [card('r3', 80)], [card('r4', 90)],
    ], [[card('a-60', 60)], [card('b-65', 65)]]);
    let result = session.handleAction('a', { kind: 'selectCard', cardId: 'a-60' });
    assert.equal(result.success, true);
    result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-65' });
    assert.equal(result.success, true);
    assert.deepEqual(game.players[0].bullPile.map(item => item.value), [10, 20, 30, 40, 50]);
    assert.equal(game.players[0].roundScore, 15, '10、20、30、40、50 共 3+3+3+3+3 牛头');
    assert.deepEqual(game.rows[0].map(item => item.value), [60, 65]);

    setSelecting(game, [[card('low-r1', 20)], [card('low-r2', 30)], [card('low-r3', 40)], [card('low-r4', 50)]], [[card('a-low', 5)], [card('b-high', 60)]]);
    result = session.handleAction('a', { kind: 'selectCard', cardId: 'a-low' });
    assert.equal(result.success, true);
    result = session.handleAction('b', { kind: 'selectCard', cardId: 'b-high' });
    assert.equal(result.success, true);
    assert.equal(game.phase, 'choose_row');
    assert.deepEqual(result.state.revealedCards.map(item => item.card.value), [5, 60]);
    const resolutionId = result.state.resolutionEvent.resolutionId;
    assert.equal(result.state.resolutionEvent.status, 'waiting_choice');
    assert.equal(result.state.resolutionEvent.steps.length, 0);
    assert.equal(session.handleAction('b', { kind: 'chooseRow', rowIndex: 1 }).success, false);
    result = session.handleAction('a', { kind: 'chooseRow', rowIndex: 1 });
    assert.equal(result.success, true);
    assert.equal(result.state.resolutionEvent.resolutionId, resolutionId, '选行后应沿用同一公开结算事件');
    assert.deepEqual(result.state.resolutionEvent.steps.map(step => step.kind), ['choice', 'place']);
    assert.equal(result.state.resolutionEvent.steps[0].bullheads, 3);
    assert.equal(result.state.resolutionEvent.status, 'complete');
    assert.deepEqual(game.rows[1].map(item => item.value), [5]);
    assert.deepEqual(game.rows[3].map(item => item.value), [50, 60], '低牌重开行后，后续高牌仍按最近较小行尾放置');
    assert.deepEqual(game.players[0].bullPile.map(item => item.value), [10, 20, 30, 40, 50, 30]);
});

function runTenPlayerGame(seed) {
    const ids = Array.from({ length: 10 }, (_, index) => String.fromCharCode(97 + index));
    const room = new Room(`takefive-full-${seed}`, 'a', 'a', 'takefive', { random: lcg(seed) });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const trace = [];
    let steps = 0;
    while (game.status === 'playing' && steps++ < 10000) {
        if (game.phase === 'selecting') {
            const player = game._activePlayers().find(item => !game.selected.has(item.id));
            assert.ok(player, `${seed}: selecting 阶段必须存在未锁牌玩家`);
            const chosen = player.hand[0];
            const result = room.handleGameAction(player.id, { kind: 'selectCard', cardId: chosen.id });
            assert.equal(result.success, true, `${seed}: ${player.id} 选牌失败`);
            trace.push(`${player.id}:${chosen.value}`);
        } else if (game.phase === 'choose_row') {
            const player = game.playerMap[game.pendingRowChoice.playerId];
            const rowIndex = game.rows.map((row, index) => ({ index, bullheads: row.reduce((sum, item) => sum + item.bullheads, 0) })).sort((left, right) => left.bullheads - right.bullheads)[0].index;
            const result = room.handleGameAction(player.id, { kind: 'chooseRow', rowIndex });
            assert.equal(result.success, true, `${seed}: ${player.id} 选行失败`);
            trace.push(`${player.id}:row${rowIndex + 1}`);
        } else {
            assert.fail(`${seed}: 未处理的阶段 ${game.phase}`);
        }
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未在合理步数内结束`);
    assert.ok(game.winner);
    assert.ok(steps < 10000);
    assert.equal(game.phase, 'ended');
    assert.equal(game.lastHand.scores.length, 10);
    assert.ok(trace.length >= 100, '十人每手十轮应有至少 100 次锁牌/选行记录');
    assert.equal(game.handSettlement.ended, true);
    assert.equal(game.handSettlement.handNumber, game.handNumber);
    assert.deepEqual(game.handSettlement.winners.map(player => player.id).sort(), game.winners.map(player => player.id).sort());
    return { game, steps, trace };
}

test('十人最大人数局从发牌、十轮结算到终局完整运行三局', () => {
    const runs = [runTenPlayerGame(201), runTenPlayerGame(202), runTenPlayerGame(203)];
    assert.deepEqual(runs.map(run => run.game.players.length), [10, 10, 10]);
    assert.ok(runs.every(run => run.game.winners.length >= 1));
});
