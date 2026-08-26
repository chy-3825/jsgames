const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Hanabi = require('../server/games/hanabi');
const HanabiEngine = require('../server/games/hanabi/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function card(id, color, value) {
    return { id, color, value, hints: { colors: [], values: [], notColors: [], notValues: [] } };
}

test('花火基础牌组、人数、手牌数量和会话启动状态符合官方规则', () => {
    const deck = HanabiEngine.buildDeck();
    assert.equal(deck.length, 50);
    assert.equal(new Set(deck.map(item => item.id)).size, 50);
    assert.ok(deck.every(item => !item.id.includes(item.color) && !item.id.includes(`-${item.value}-`)), '隐藏牌身份不能编码颜色或数字');
    for (const color of HanabiEngine.COLORS) {
        assert.deepEqual(deck.filter(item => item.color === color).map(item => item.value).sort((a, b) => a - b), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    }

    for (const [count, handSize] of [[2, 5], [3, 5], [4, 4], [5, 4]]) {
        const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
        const session = Hanabi.create(`hanabi-setup-${count}`, players(ids), { random: lcg(count), startingPlayerId: ids[0] });
        assert.equal(session.start().success, true);
        assert.deepEqual(session.engine.players.map(player => player.hand.length), Array(count).fill(handSize));
        assert.equal(session.start().success, false, '同一会话不能重复开始');
        assert.equal(session.engine.start().success, false, '引擎也不能绕过会话重复开始');
    }

    assert.equal(Hanabi.create('hanabi-too-few', players(['a'])).start().success, false);
    assert.equal(Hanabi.create('hanabi-too-many', players(['a', 'b', 'c', 'd', 'e', 'f'])).start().success, false);

    const first = Hanabi.create('hanabi-seeded-a', players(['a', 'b']), { random: lcg(91), startingPlayerId: 'a' });
    const second = Hanabi.create('hanabi-seeded-b', players(['a', 'b']), { random: lcg(91), startingPlayerId: 'a' });
    assert.equal(first.start().success, true);
    assert.equal(second.start().success, true);
    assert.deepEqual(first.engine.players.map(player => player.hand.map(item => item.id)), second.engine.players.map(player => player.hand.map(item => item.id)), '会话应使用传入的随机源');
});

test('花火只向队友公开牌面，只向持牌者公开提示知识', () => {
    const session = Hanabi.create('hanabi-privacy', players(['a', 'b', 'c']), { random: lcg(92), startingPlayerId: 'a' });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const target = game.players[1];
    const targetColor = target.hand[0].color;
    assert.equal(session.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: targetColor }).success, true);

    const stateA = session.getPlayerState('a');
    const own = stateA.players.find(player => player.id === 'a');
    const teammate = stateA.players.find(player => player.id === 'b');
    assert.ok(own.hand.every(item => item.color === null && item.value === null));
    assert.ok(teammate.hand.some(item => item.color !== null && item.value !== null));
    assert.ok(session.getPlayerState('b').players.find(player => player.id === 'b').hand.some(item => item.hints?.colors?.includes(targetColor)));
    assert.equal(teammate.hand.every(item => item.hints === null), true);
    assert.equal(game.getPublicState().players.every(player => player.hand.every(item => item.color === null && item.value === null && item.hints === null)), true);
});

test('花火提示必须命中并完整标记，提示和弃牌令牌边界正确', () => {
    const game = new HanabiEngine('hanabi-clues', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    assert.equal(game.start().success, true);
    game.players[0].hand = [card('a-red', 'red', 1)];
    game.players[1].hand = [card('b-red-1', 'red', 1), card('b-blue-2', 'blue', 2), card('b-red-4', 'red', 4)];
    game.deck = [card('draw', 'yellow', 1)];
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'a', clueKind: 'color', value: 'red' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'green' }).success, false, '不能给零命中提示');
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'red' }).success, true);
    assert.equal(game.clues, 7);
    assert.ok(game.players[1].hand[0].hints.colors.includes('red'));
    assert.ok(game.players[1].hand[2].hints.colors.includes('red'));
    assert.ok(game.players[1].hand[1].hints.notColors.includes('red'));
    assert.equal(game.lastAction.actionId, 1);
    assert.deepEqual(game.lastAction.matchedCardIds, ['b-red-1', 'b-red-4']);
    assert.deepEqual(game.lastAction.matchedIndexes, [0, 2]);
    assert.equal(game.lastAction.cluesBefore, 8);
    assert.equal(game.lastAction.cluesAfter, 7);
    game.currentTurnIndex = 0;
    game.clues = 8;
    assert.equal(game.handleAction('a', { kind: 'discardCard', cardIndex: 0 }).success, false);
    game.clues = 7;
    assert.equal(game.handleAction('a', { kind: 'discardCard', cardIndex: 0 }).success, true);
    assert.equal(game.clues, 8);
    assert.equal(game.lastAction.actionId, 2);
    assert.equal(game.lastAction.cardId, 'a-red');
    assert.equal(game.lastAction.cardIndex, 0);
    assert.equal(game.lastAction.cluesBefore, 7);
    assert.equal(game.lastAction.cluesAfter, 8);
});

test('花火正确出牌进烟花、错误出牌进弃牌，完成 5 奖励提示且三次失误立即结束', () => {
    const game = new HanabiEngine('hanabi-actions', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    assert.equal(game.start().success, true);
    game.players[0].hand = [card('correct', 'red', 1)];
    game.players[1].hand = [card('wrong', 'blue', 2)];
    game.deck = [card('replacement', 'yellow', 1)];
    game.clues = 8;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.fireworks.red, 1);
    assert.equal(game.discard.length, 0);
    assert.equal(game.players[0].hand.some(item => item.id === 'replacement'), true);
    assert.equal(game.lastAction.cardId, 'correct');
    assert.equal(game.lastAction.success, true);
    assert.equal(game.lastAction.scoreBefore, 0);
    assert.equal(game.lastAction.scoreAfter, 1);
    assert.equal(game.lastAction.drewCard, true);
    assert.equal(JSON.stringify(game.lastAction).includes('replacement'), false, '公共动作事件不能包含新抽牌身份');

    game.currentTurnIndex = 1;
    game.deck = [card('wrong-draw-1', 'blue', 2), card('wrong-draw-2', 'blue', 2), card('wrong-draw-3', 'blue', 2)];
    game.players[1].hand = [card('wrong-1', 'blue', 2)];
    game.players[0].hand = [card('wrong-2', 'blue', 2)];
    game.clues = 7;
    assert.equal(game.handleAction('b', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.strikes, 1);
    assert.equal(game.discard.at(-1).value, 2);
    assert.equal(game.lastAction.success, false);
    assert.equal(game.lastAction.strikesBefore, 0);
    assert.equal(game.lastAction.strikesAfter, 1);

    const reward = new HanabiEngine('hanabi-reward', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    reward.start();
    reward.players[0].hand = [card('five', 'red', 5)];
    reward.fireworks.red = 4;
    reward.clues = 6;
    reward.deck = [card('after-five', 'yellow', 1)];
    assert.equal(reward.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(reward.fireworks.red, 5);
    assert.equal(reward.clues, 7);

    const failed = new HanabiEngine('hanabi-fuses', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    failed.start();
    const wrong = index => card(`wrong-${index}`, 'yellow', 2);
    failed.players.forEach(player => { player.hand = [wrong(player.id)]; });
    failed.deck = [wrong('x'), wrong('y'), wrong('z')];
    for (const id of ['a', 'b', 'a']) assert.equal(failed.handleAction(id, { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(failed.status, 'ended');
    assert.equal(failed.endReason, 'fuses');
    assert.equal(failed.strikes, 3);
    assert.equal(failed.lastAction.ended, true);
    assert.equal(failed.lastAction.endReason, 'fuses');
});

test('花火抽完最后一张后即使在终局轮完成 25 分，也必须先完成每人一次终局行动', () => {
    const game = new HanabiEngine('hanabi-final-round', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    game.fireworks = { red: 4, yellow: 5, green: 5, blue: 5, white: 5 };
    game.clues = 0;
    game.players[0].hand = [card('red-4', 'red', 4)];
    game.players[1].hand = [card('b-filler', 'blue', 1)];
    game.deck = [card('red-5', 'red', 5)];

    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.finalTurnsRemaining, 2, '抽到最后一张牌后先建立两人的终局倒计时');
    assert.equal(game.lastAction.finalTurnsStarted, true);
    assert.equal(game.lastAction.deckCountBefore, 1);
    assert.equal(game.lastAction.deckCountAfter, 0);
    assert.equal(game.status, 'playing');
    assert.equal(game.handleAction('b', { kind: 'discardCard', cardIndex: 0 }).success, true);
    assert.equal(game.finalTurnsRemaining, 1);
    const last = game.handleAction('a', { kind: 'playCard', cardIndex: 0 });
    assert.equal(last.success, true);
    assert.equal(game.endReason, 'deck');
    assert.equal(game.finalTurnsRemaining, 0);
    assert.equal(game.getPublicState().score, 25);
});

function runFivePlayerGame(seed) {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const room = new Room(`hanabi-full-${seed}`, 'a', 'a', 'hanabi', { random: lcg(seed), startingPlayerId: 'a' });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    assert.deepEqual(game.players.map(player => player.hand.length), [4, 4, 4, 4, 4]);
    const trace = [];
    let steps = 0;
    while (game.status === 'playing' && steps < 1000) {
        const current = game.players[game.currentTurnIndex];
        const playable = current.hand.findIndex(item => item.value === game.fireworks[item.color] + 1);
        let action;
        if (playable >= 0) {
            action = { kind: 'playCard', cardIndex: playable };
        } else if (game.clues > 0) {
            const target = game.players.find(player => player.id !== current.id && player.isOnline && player.hand.length > 0);
            action = { kind: 'giveClue', targetId: target.id, clueKind: 'color', value: target.hand[0].color };
        } else {
            action = { kind: 'discardCard', cardIndex: 0 };
        }
        const result = room.handleGameAction(current.id, action);
        assert.equal(result.success, true, `${seed}: ${current.id} 行动失败：${result.message}`);
        trace.push(`${current.id}:${action.kind}`);
        steps += 1;
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未正常结束`);
    assert.ok(steps < 1000);
    assert.equal(game.phase, 'ended');
    assert.ok(['perfect', 'deck'].includes(game.endReason));
    assert.ok(trace.length > 40, '五人局应覆盖完整回合序列');
    return { game, steps, trace };
}

test('花火五人最大人数从发牌到终局完整运行三局', () => {
    const runs = [runFivePlayerGame(301), runFivePlayerGame(302), runFivePlayerGame(303)];
    assert.deepEqual(runs.map(run => run.game.players.length), [5, 5, 5]);
    assert.ok(runs.every(run => run.game.endReason === 'perfect' || run.game.endReason === 'deck'));
    assert.ok(runs.some(run => run.game.endReason === 'deck'), '三局应至少覆盖牌库耗尽终局');
});
