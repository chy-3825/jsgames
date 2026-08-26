const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Coup = require('../server/games/coup');
const CoupEngine = require('../server/games/coup/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function fresh(ids = ['a', 'b', 'c'], seed = 1) {
    const session = Coup.create(`coup-${seed}`, players(ids), undefined, { random: lcg(seed) });
    assert.equal(session.start().success, true);
    return session;
}

function passCurrentChallenge(session) {
    const game = session.engine;
    const id = game.challengeQueue[game.challengeIndex];
    assert.ok(id, `阶段 ${game.phase} 必须存在待处理玩家`);
    return session.handleAction(id, { kind: 'pass' });
}

function chooseFirstInfluence(session, id) {
    const player = session.engine.players.find(item => item.id === id);
    const index = player.revealed.findIndex(revealed => !revealed);
    assert.notEqual(index, -1);
    return session.handleAction(id, { kind: 'influence_loss', influenceIndex: index });
}

function resolvePassivePhase(session) {
    const game = session.engine;
    if (game.phase === 'challenge' || game.phase === 'block') return passCurrentChallenge(session);
    if (game.phase === 'influence_loss') return chooseFirstInfluence(session, game.pendingInfluenceLoss.playerId);
    if (game.phase === 'exchange') {
        const id = game.pendingExchange.playerId;
        const view = session.getPlayerState(id);
        const keep = Array.from({ length: view.exchange.keepCount }, (_, index) => index);
        return session.handleAction(id, { kind: 'exchangeSelect', keepIndices: keep });
    }
    return null;
}

function runFullGame(seed, varied = false) {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const room = new Room(`coup-full-${seed}`, 'a', 'a', 'coup', { random: lcg(seed) });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const trace = [];
    let steps = 0;
    while (!game.gameOver && steps++ < 5000) {
        if (game.phase === 'idle') {
            const actor = game.players[game.currentTurnIndex];
            const target = game.players.find(player => player.id !== actor.id && game.isPlayerAlive(player.id));
            let action = { kind: 'income' };
            if (actor.coins >= 7) action = { kind: 'coup', targetId: target.id };
            else if (varied && steps % 6 === 0) action = { kind: 'tax' };
            else if (varied && steps % 6 === 1 && actor.coins >= 3) action = { kind: 'assassinate', targetId: target.id };
            else if (varied && steps % 6 === 2) action = { kind: 'steal', targetId: target.id };
            else if (varied && steps % 6 === 3) action = { kind: 'exchange' };
            else if (varied && steps % 6 === 4) action = { kind: 'foreign_aid' };
            const result = room.handleGameAction(actor.id, action);
            assert.equal(result.success, true, `${seed}: ${actor.id} 的 ${action.kind} 应合法`);
            trace.push(`${actor.id}:${action.kind}`);
        } else {
            const result = resolvePassivePhase(room.game);
            assert.ok(result, `${seed}: 未处理阶段 ${game.phase}`);
            assert.equal(result.success, true, `${seed}: 阶段 ${game.phase} 应正常推进`);
        }
    }
    assert.equal(game.gameOver, true, `种子 ${seed} 必须结束`);
    assert.ok(game.winner, `种子 ${seed} 必须产生胜者`);
    assert.ok(steps < 5000, `种子 ${seed} 不应无限循环`);
    return { game, steps, trace };
}

test('政变基础牌组、人数、起始资源和隐藏信息符合规则', () => {
    const session = fresh(['a', 'b', 'c', 'd', 'e', 'f'], 101);
    const game = session.engine;
    assert.equal(game.deck.length, 3);
    assert.deepEqual(game.players.map(player => player.influences.length), [2, 2, 2, 2, 2, 2]);
    assert.ok(game.players.every(player => player.coins === 2));
    assert.deepEqual(Object.fromEntries(['duke', 'assassin', 'captain', 'ambassador', 'contessa'].map(role => [role, [...game.deck, ...game.players.flatMap(player => player.influences)].filter(card => card === role).length])), {
        duke: 3, assassin: 3, captain: 3, ambassador: 3, contessa: 3,
    });
    const privateState = session.getPlayerState('a');
    const otherState = session.getPlayerState('b');
    assert.ok(privateState.self.influences.every(card => card.role));
    assert.ok(otherState.players.find(player => player.id === 'a').influences.every(card => card.role === null));

    const tooMany = Coup.create('too-many', players(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
    assert.equal(tooMany.start().success, false);
    assert.equal(tooMany.started, false, '无效人数不能把会话标成已开始');
});

test('政变七种行动、费用、目标限制和十金币强制政变符合规则', () => {
    const session = fresh(['a', 'b', 'c'], 102);
    const game = session.engine;
    game.players[0].coins = 2;
    assert.equal(session.handleAction('a', { kind: 'income' }).success, true);
    assert.equal(game.players[0].coins, 3);

    assert.equal(session.handleAction('c', { kind: 'foreign_aid' }).success, false, '非当前玩家不能行动');
    assert.equal(session.handleAction('b', { kind: 'foreign_aid' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'pass' }).success, true);
    assert.equal(game.players[1].coins, 4);

    assert.equal(session.handleAction('c', { kind: 'tax' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    assert.equal(game.players[2].coins, 5);

    game.currentTurnIndex = 0;
    game.players[0].coins = 10;
    assert.equal(session.handleAction('a', { kind: 'income' }).success, false);
    assert.match(session.handleAction('a', { kind: 'coup' }).message, /目标/);
    assert.equal(session.handleAction('a', { kind: 'coup', targetId: 'b' }).success, true);
    assert.equal(game.players[0].coins, 3);
    assert.equal(game.phase, 'influence_loss');
});

test('政变质疑：真声明换牌并让质疑者失去影响力，假声明取消行动且费用不退', () => {
    const session = fresh(['a', 'b', 'c'], 103);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].influences = ['duke', 'captain'];
    game.players[0].revealed = [false, false];
    game.players[1].influences = ['assassin', 'contessa'];
    game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'tax' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'show' }).success, true);
    assert.equal(game.phase, 'influence_loss');
    assert.equal(chooseFirstInfluence(session, 'b').success, true);
    assert.equal(game.players[0].coins, 5);
    assert.equal(game.players[1].revealed.filter(Boolean).length, 1);
    assert.equal(game.players[0].revealed.filter(Boolean).length, 0);

    game.currentTurnIndex = 0;
    game.players[0].coins = 3;
    game.players[0].influences = ['captain', 'assassin'];
    game.players[0].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'c' }).success, true);
    assert.equal(game.players[0].coins, 0, '刺杀费用在质疑前支付');
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'cancel' }).success, true);
    assert.equal(chooseFirstInfluence(session, 'a').success, true);
    assert.equal(game.players[2].revealed.filter(Boolean).length, 0, '假刺杀不应伤害目标');
    assert.equal(game.players[0].coins, 0);
});

test('政变公开交互链保留发起、目标、质疑与阻挡信息', () => {
    const session = fresh(['a', 'b', 'c'], 108);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].coins = 3;
    game.players[0].influences = ['assassin', 'captain'];
    game.players[0].revealed = [false, false];
    game.players[1].influences = ['duke', 'contessa'];
    game.players[1].revealed = [false, false];

    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    let view = session.getPlayerState('c');
    const actionId = view.interaction.actionId;
    assert.deepEqual({
        kind: view.interaction.kind,
        actorId: view.interaction.actorId,
        targetId: view.interaction.targetId,
        claimedRole: view.interaction.claimedRole,
        stage: view.interaction.stage,
    }, { kind: 'assassinate', actorId: 'a', targetId: 'b', claimedRole: 'assassin', stage: 'challenge' });

    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.getPlayerState('c').interaction.challengerId, 'b');
    assert.equal(session.getPlayerState('c').interaction.stage, 'challenged');
    assert.equal(session.handleAction('a', { kind: 'show' }).success, true);
    view = session.getPlayerState('c');
    assert.equal(view.interaction.actionId, actionId, '整段交锋应共用同一行动编号');
    assert.equal(view.interaction.verdict, 'claim_proved');
    assert.equal(view.interaction.lossPlayerId, 'b');

    assert.equal(chooseFirstInfluence(session, 'b').success, true);
    view = session.getPlayerState('c');
    assert.equal(game.phase, 'block', '真刺客声明被证明后，目标仍然可用伯爵夫人阻挡');
    assert.equal(view.interaction.stage, 'block_offer');
    assert.equal(view.interaction.blockRole, 'contessa');
    assert.equal(view.lastReveal.playerId, 'b');
    assert.equal(view.lastReveal.eliminated, false);

    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.getPlayerState('a').interaction.blockerId, 'b');
    assert.equal(session.handleAction('c', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'show' }).success, true);
    assert.equal(chooseFirstInfluence(session, 'c').success, true);
    view = session.getPlayerState('a');
    assert.equal(view.interaction.actionId, actionId);
    assert.equal(view.interaction.challengerId, 'c');
    assert.equal(view.interaction.blockerId, 'b');
    assert.equal(view.interaction.verdict, 'block_proved');
    assert.equal(view.interaction.outcome, 'blocked');
});

test('政变揭示事件可区分失去一张影响力与玩家出局', () => {
    const session = fresh(['a', 'b'], 109);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].coins = 7;
    game.players[1].influences = ['captain', 'duke'];
    game.players[1].revealed = [true, false];

    assert.equal(session.handleAction('a', { kind: 'coup', targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 }).success, true);
    const view = session.getPlayerState('a');
    assert.equal(view.lastReveal.actionId, view.interaction.actionId);
    assert.equal(view.lastReveal.playerId, 'b');
    assert.deepEqual(view.lastReveal.roles, ['duke']);
    assert.equal(view.lastReveal.reason, 'coup');
    assert.equal(view.lastReveal.eliminated, true);
    assert.equal(view.interaction.outcome, 'game_over');
    assert.equal(view.gameOver, true);
    assert.equal(view.winner, 'a');
});

test('政变阻挡声明按官方角色生效，阻挡质疑成功后原行动继续', () => {
    const session = fresh(['a', 'b', 'c'], 104);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].coins = 3;
    game.players[1].influences = ['contessa', 'duke'];
    game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(passCurrentChallenge(session).success, true);
    assert.equal(passCurrentChallenge(session).success, true);
    assert.equal(game.phase, 'block');
    assert.equal(session.getPlayerState('b').challenge.claimedRole, 'contessa');
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'show' }).success, true);
    assert.equal(chooseFirstInfluence(session, 'c').success, true);
    assert.equal(game.phase, 'idle');
    assert.equal(game.players[1].revealed.filter(Boolean).length, 0);
    assert.equal(game.players[0].coins, 0);
    assert.equal(game.players[1].revealed.filter(Boolean).length, 0);

    // 外援只能被公爵阻挡；阻挡声明被质疑并证明后，外援仍然被阻断。
    game.currentTurnIndex = 0;
    game.players[0].coins = 0;
    game.players[1].influences = ['duke', 'captain'];
    game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'foreign_aid' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'show' }).success, true);
    assert.equal(chooseFirstInfluence(session, 'c').success, true);
    assert.equal(game.players[0].coins, 0);

    // 偷窃只能由目标用船长或大使阻挡，且通过阻挡后不会转移硬币。
    game.currentTurnIndex = 0;
    game.players[0].coins = 0;
    game.players[1].coins = 4;
    game.players[1].influences = ['ambassador', 'captain'];
    game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'steal', targetId: 'b' }).success, true);
    while (game.phase === 'challenge') assert.equal(passCurrentChallenge(session).success, true);
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    while (game.phase === 'challenge') assert.equal(passCurrentChallenge(session).success, true);
    assert.equal(game.players[0].coins, 0);
    assert.equal(game.players[1].coins, 4);
});

test('大使交换只保留生效影响力并把其余两张牌洗回牌库，选项只对本人可见', () => {
    const session = fresh(['a', 'b'], 105);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.players[0].influences = ['duke', 'captain'];
    game.players[0].revealed = [true, false];
    game.deck = ['assassin', 'contessa', 'ambassador'];
    assert.equal(session.handleAction('a', { kind: 'exchange' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    const own = session.getPlayerState('a');
    const other = session.getPlayerState('b');
    assert.equal(own.exchange.keepCount, 1);
    assert.equal(own.exchange.options.length, 3);
    assert.equal(other.exchange.options, null);
    const ambassadorIndex = own.exchange.options.find(card => card.role === 'ambassador').index;
    assert.equal(session.handleAction('a', { kind: 'exchangeSelect', keepIndices: [ambassadorIndex] }).success, true);
    assert.equal(game.players[0].revealed[0], true);
    assert.equal(game.players[0].revealed[1], false);
    assert.equal(game.players[0].influences[1], 'ambassador');
    assert.equal(game.deck.length, 3);
});

test('政变最多六人可从开始到终局完整运行三局', () => {
    const first = runFullGame(201);
    const second = runFullGame(202, true);
    const third = runFullGame(203, true);
    for (const result of [first, second, third]) {
        assert.ok(result.trace.length > 10);
        assert.equal(result.game.phase, 'ended');
        assert.equal(result.game._getAlivePlayers().length, 1);
        assert.ok(result.game.actionLog.some(entry => entry.includes('获胜')));
    }
    assert.ok(second.trace.some(entry => entry.includes(':exchange')));
    assert.ok(second.trace.some(entry => entry.includes(':assassinate')));
});
