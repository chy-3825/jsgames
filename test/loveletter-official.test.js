const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const LoveLetter = require('../server/games/loveletter');
const LoveLetterEngine = require('../server/games/loveletter/engine');

const CARD_NAMES = {
    1: '侍卫', 2: '牧师', 3: '男爵', 4: '侍女',
    5: '王子', 6: '国王', 7: '伯爵夫人', 8: '公主',
};
const CARD_VALUES = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 };
const players = ids => ids.map(id => ({ id, name: id }));
const card = id => ({ id, name: CARD_NAMES[id], value: CARD_VALUES[id], cardId: `${id}-test` });

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function freshGame(ids = ['a', 'b', 'c'], seed = 1) {
    const game = new LoveLetterEngine(`rules-${seed}`, players(ids), ids[0], lcg(seed));
    game.init(ids[0]);
    return game;
}

function situation(ids, hands, { deck = [card(1), card(2), card(3)], reservedCard = card(4), current = 0 } = {}) {
    const game = freshGame(ids, 901 + ids.length);
    game.status = 'playing';
    game.currentTurnIndex = current;
    game.deck = deck.map(item => ({ ...item }));
    game.reservedCard = reservedCard ? { ...reservedCard } : null;
    game.discardPile = [];
    game.hiddenDiscardPile = [];
    game.publicDiscard = [];
    game.players.forEach((player, index) => {
        player.hand = (hands[index] || [card(1)]).map(item => ({ ...item }));
        player.isOut = false;
        player.isAlive = true;
        player.isProtected = false;
    });
    return game;
}

function resolvePlay(game, playerId, cardIndex, targetId, guess) {
    let result = game.playCard(playerId, cardIndex, targetId, guess);
    if (result.pendingAcknowledgement) {
        game.pendingAction.availableAt = Date.now() - 1;
        result = game.acknowledgeAction(targetId, result.action.actionId);
    }
    return result;
}

function autoPlayFour(seed) {
    const room = new Room(`full-${seed}`, 'a', '甲', 'loveletter', { random: lcg(seed) });
    for (const player of players(['a', 'b', 'c', 'd'])) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const trace = [];
    let steps = 0;
    while (game.status !== 'ended' && steps++ < 5000) {
        if (game.pendingAction) {
            const pending = game.pendingAction;
            pending.availableAt = Date.now() - 1;
            assert.equal(room.handleGameAction(pending.targetId, { kind: 'acknowledgeAction', actionId: pending.actionId }).success, true);
            continue;
        }
        if (game.status === 'round_end') {
            trace.push(`第${game.round}轮结算：${game.roundWinner?.name || '无人'}胜`);
            assert.equal(room.handleGameAction(game.roundWinner.id, { kind: 'startNextRound' }).success, true);
            continue;
        }

        const current = game.getCurrentPlayer();
        assert.ok(current, '进行中的回合必须有当前玩家');
        const mustCountess = current.hand.some(item => item.id === 7) && current.hand.some(item => item.id === 5 || item.id === 6);
        const candidates = current.hand
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !mustCountess || item.id === 7);
        const opponents = game.getAlivePlayers().filter(player => player.id !== current.id && !player.isProtected);
        let played = false;
        for (const { item, index } of candidates) {
            const requiresTarget = [1, 2, 3, 5, 6].includes(item.id);
            const targetId = item.id === 5 ? current.id : opponents[0]?.id || null;
            const noTarget = !targetId && [1, 2, 3, 6].includes(item.id);
            if (requiresTarget && !targetId && !noTarget) continue;
            const result = room.handleGameAction(current.id, { kind: 'playCard', cardIndex: index, targetId, guess: item.id === 1 ? 2 : undefined });
            if (!result.success) continue;
            trace.push(`${current.name} 打出${item.name}${targetId ? `→${targetId}` : ''}${result.eliminated ? `，${result.eliminated}出局` : ''}`);
            played = true;
            break;
        }
        assert.equal(played, true, `第 ${steps} 步没有找到合法出牌：${current.name}`);
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未能结束`);
    assert.ok(game.winner, `种子 ${seed} 应产生整局胜者`);
    assert.ok(steps < 5000);
    return { game, steps, trace };
}

test('经典版牌组、发牌和人数目标与规则一致', () => {
    const game = freshGame(['a', 'b', 'c', 'd'], 1);
    const allCards = [...game.deck, ...game.players.flatMap(player => player.hand), game.reservedCard];
    assert.equal(allCards.length, 16);
    assert.deepEqual(Object.fromEntries(Object.entries(CARD_VALUES).map(([id]) => [id, allCards.filter(item => item.id === Number(id)).length])), {
        1: 5, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1,
    });
    assert.equal(game.players[0].hand.length, 2);
    assert.deepEqual(game.players.slice(1).map(player => player.hand.length), [1, 1, 1]);
    assert.equal(game.targetFavor, 4);

    const two = freshGame(['a', 'b'], 2);
    assert.equal(two.setAsideCards.length, 3);
    assert.equal(two.deck.length + two.players.reduce((sum, player) => sum + player.hand.length, 0) + 1 + two.setAsideCards.length, 16);
    assert.equal(two.targetFavor, 7);
    assert.equal(freshGame(['a', 'b', 'c'], 3).targetFavor, 5);
});

test('侍卫、牧师、男爵和侍女逐条执行目标、猜牌、比较和保护规则', () => {
    let game = situation(['a', 'b', 'c'], [[card(1), card(4)], [card(8)], [card(6)]]);
    let result = resolvePlay(game, 'a', 0, 'b', 8);
    assert.equal(result.success, true);
    assert.equal(game.players.find(player => player.id === 'b').isOut, true);
    assert.equal(game.players.find(player => player.id === 'b').hand.length, 0);
    assert.equal(game.publicDiscard.some(entry => entry.ownerId === 'b' && entry.reason === 'eliminated' && entry.card.id === 8), true);

    game = situation(['a', 'b'], [[card(2), card(4)], [card(8)]]);
    result = resolvePlay(game, 'a', 0, 'b');
    assert.equal(result.success, true);
    assert.equal(result.revealedCard.id, 8);

    game = situation(['a', 'b'], [[card(3), card(4)], [card(2)]]);
    result = resolvePlay(game, 'a', 0, 'b');
    assert.equal(result.success, true);
    assert.equal(game.players.find(player => player.id === 'b').isOut, true);
    assert.equal(game.players.find(player => player.id === 'b').hand.length, 0);

    game = situation(['a', 'b', 'c'], [[card(4), card(1)], [card(8)], [card(6)]]);
    result = game.playCard('a', 0);
    assert.equal(result.success, true);
    assert.equal(game.players.find(player => player.id === 'a').isProtected, true);
    game.currentTurnIndex = 2;
    game.players[2].hand = [card(1), card(4)];
    result = game.playCard('c', 0, 'a', 8);
    assert.equal(result.success, false);
    assert.match(result.message, /目标/);
    game.currentTurnIndex = 2;
    game.nextTurn();
    assert.equal(game.getCurrentPlayer().id, 'a');
    assert.equal(game.players.find(player => player.id === 'a').isProtected, false);
});

test('王子、国王、伯爵夫人和公主的特殊规则均可完成', () => {
    let game = situation(['a', 'b'], [[card(5), card(4)], [card(6)]], { deck: [card(8)] });
    let result = game.playCard('a', 0, 'a');
    assert.equal(result.success, true);
    assert.equal(game.players[0].hand[0].id, 8);

    game = situation(['a', 'b'], [[card(5), card(4)], [card(8)]], { deck: [card(2)] });
    result = resolvePlay(game, 'a', 0, 'b');
    assert.equal(result.success, true);
    assert.equal(game.players[1].isOut, true);

    game = situation(['a', 'b'], [[card(5), card(4)], [card(6)]], { deck: [], reservedCard: card(2) });
    result = game.playCard('a', 0, 'a');
    assert.equal(result.success, true);
    assert.equal(game.players[0].hand.some(item => item.id === 2), true);

    game = situation(['a', 'b'], [[card(6), card(1)], [card(5)]], { deck: [card(2)] });
    result = resolvePlay(game, 'a', 0, 'b');
    assert.equal(result.success, true);
    assert.equal(game.players[0].hand.some(item => item.id === 5), true);
    assert.equal(game.players[1].hand.some(item => item.id === 1), true);

    game = situation(['a', 'b'], [[card(7), card(6)], [card(1)]], { deck: [card(2)] });
    result = game.playCard('a', 1);
    assert.equal(result.success, false);
    assert.match(result.message, /只能打出伯爵夫人/);
    result = game.playCard('a', 0);
    assert.equal(result.success, true);

    game = situation(['a', 'b'], [[card(8), card(1)], [card(2)]], { deck: [card(3)] });
    result = game.playCard('a', 0);
    assert.equal(result.success, true);
    assert.equal(game.players[0].isOut, true);
    assert.equal(game.players[0].hand.length, 0);
});

test('所有目标均受保护时，需指定他人的牌按官方规则无效果', () => {
    for (const id of [1, 2, 3, 6]) {
        const game = situation(['a', 'b', 'c'], [[card(id), card(4)], [card(8)], [card(5)]]);
        game.players[1].isProtected = true;
        game.players[2].isProtected = true;
        const result = game.playCard('a', 0);
        assert.equal(result.success, true, `牌 ${id} 应可无效果打出`);
        assert.equal(result.noEffect, true, `牌 ${id} 应标记无效果`);
    }
});

test('非法目标、非法猜牌、越权回合和背面弃牌均被拒绝', () => {
    const game = situation(['a', 'b'], [[card(1), card(4)], [card(8)]], { deck: [card(2)] });
    assert.equal(game.playCard('b', 0, 'a', 8).success, false);
    assert.equal(game.playCard('a', 0, 'a', 8).success, false);
    assert.equal(game.playCard('a', 0, 'b', 1).success, false);
    assert.equal(game.discardCard('a', 0).success, false);
    assert.equal(game.players[0].hand.length, 2);
});

test('摊牌、弃牌点数、轮末暂停和爱心筹码规则正确', () => {
    const game = situation(['a', 'b', 'c'], [[card(6)], [card(6)], [card(4)]], { deck: [], reservedCard: card(4) });
    game.publicDiscard = [{ ownerId: 'a', card: card(1) }, { ownerId: 'b', card: card(5) }];
    assert.equal(game.checkGameEnd(), true);
    assert.equal(game.status, 'round_end');
    assert.equal(game.roundWinner.id, 'b');
    assert.equal(game.players[1].favorTokens, 1);
    assert.equal(game.startNextRound('c').success, false);
    assert.equal(game.startNextRound('b').success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.currentTurnIndex, 1);
});

test('手牌与弃牌总点数完全相同的摊牌由并列玩家共同赢得本轮', () => {
    const game = situation(['a', 'b', 'c'], [[card(6)], [card(6)], [card(4)]], { deck: [], reservedCard: card(2) });
    game.publicDiscard = [{ ownerId: 'a', card: card(1) }, { ownerId: 'b', card: card(1) }];
    assert.equal(game.checkGameEnd(), true);
    assert.deepEqual(game.roundWinners.map(player => player.id), ['a', 'b']);
    assert.equal(game.players[0].favorTokens, 1);
    assert.equal(game.players[1].favorTokens, 1);
    assert.equal(game.startNextRound('c').success, false);
    assert.equal(game.startNextRound('a').success, true);
});

test('并列玩家同时达到爱心目标时，最终胜者保持并列', () => {
    const game = situation(['a', 'b'], [[card(6)], [card(6)]], { deck: [], reservedCard: card(2) });
    game.players[0].favorTokens = game.targetFavor - 1;
    game.players[1].favorTokens = game.targetFavor - 1;
    game.publicDiscard = [{ ownerId: 'a', card: card(1) }, { ownerId: 'b', card: card(1) }];
    assert.equal(game.checkGameEnd(), true);
    assert.equal(game.status, 'ended');
    assert.deepEqual(game.winners.map(player => player.id), ['a', 'b']);
});

test('牧师信息仅发送给施放者，行动和状态包不会泄露私牌', () => {
    const session = LoveLetter.create('private', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].hand = [card(2), card(4)];
    game.players[1].hand = [card(8)];
    const announced = session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' });
    assert.equal(announced.pendingAcknowledgement, true);
    assert.equal(session.getPlayerState('a').lastAction.result.revealedCard, undefined);
    game.pendingAction.availableAt = Date.now() - 1;
    const result = session.handleAction('b', { kind: 'acknowledgeAction', actionId: announced.action.actionId });
    assert.equal(result.success, true);
    const actor = session.getPlayerAction(result, 'a');
    const observer = session.getPlayerAction(result, 'b');
    assert.equal(actor.action.result.revealedCard.id, 8);
    assert.equal(observer.action.result.revealedCard, null);
    assert.equal(observer.gameState.players.find(player => player.id === 'b').hand, undefined);
    assert.equal(session.getPlayerState('b').lastAction.result.revealedCard, null);
});

test('指定目标的牌先等待目标知晓，确认或超时后才正式结算', () => {
    for (const id of [1, 2, 3, 5, 6]) {
        const waitingGame = situation(['a', 'b', 'c'], [[card(id), card(4)], [card(8)], [card(6)]]);
        const waitingResult = waitingGame.playCard('a', 0, 'b', id === 1 ? 8 : undefined);
        assert.equal(waitingResult.pendingAcknowledgement, true, `${CARD_NAMES[id]}指定他人时应先等待知晓`);
        assert.equal(waitingGame.phase, 'target_ack');
        assert.equal(waitingGame.currentTurnIndex, 0);
        assert.equal(waitingGame.players[1].isOut, false);
    }

    const game = situation(['a', 'b', 'c'], [[card(1), card(4)], [card(8)], [card(6)]]);
    const announced = game.playCard('a', 0, 'b', 8);
    assert.equal(announced.pendingAcknowledgement, true);
    assert.equal(game.phase, 'target_ack');
    assert.equal(game.players[1].isOut, false);
    assert.equal(game.getState().pendingAction.guess, 8);
    assert.equal(game.playCard('a', 0, 'b', 8).success, false);
    assert.equal(game.acknowledgeAction('c', announced.action.actionId).success, false);
    assert.equal(game.acknowledgeAction('b', announced.action.actionId).success, false);

    game.pendingAction.availableAt = Date.now() - 1;
    const resolved = game.acknowledgeAction('b', announced.action.actionId);
    assert.equal(resolved.success, true);
    assert.equal(game.pendingAction, null);
    assert.equal(game.players[1].isOut, true);

    const timeout = situation(['a', 'b', 'c'], [[card(2), card(4)], [card(8)], [card(6)]]);
    const waiting = timeout.playCard('a', 0, 'b');
    timeout.pendingAction.deadlineAt = Date.now() - 1;
    assert.equal(timeout.acknowledgeAction('c', waiting.action.actionId).success, true);
});

test('四人最大人数三局完整比赛均能从开局自然结束', () => {
    const runs = [11, 29, 47].map(autoPlayFour);
    assert.equal(runs.length, 3);
    assert.ok(runs.every(run => run.game.winner && run.trace.length > 0));
});
