const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Splendor = require('../server/games/splendor');
const SplendorEngine = require('../server/games/splendor/engine');

const COLORS = SplendorEngine.COLORS;
const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function tokenState(overrides = {}) {
    return Object.fromEntries([...COLORS, 'gold'].map(color => [color, overrides[color] || 0]));
}

function canAfford(game, player, card) {
    const discounts = Object.fromEntries(COLORS.map(color => [color, player.cards.filter(item => item.bonus === color).length]));
    let goldNeeded = 0;
    for (const color of COLORS) {
        const needed = Math.max(0, (card.cost[color] || 0) - discounts[color]);
        goldNeeded += Math.max(0, needed - player.tokens[color]);
    }
    return goldNeeded <= player.tokens.gold;
}

test('璀璨宝石基础牌组、人数、宝石库存和贵族数量符合官方规则', () => {
    const cards = SplendorEngine.buildCards();
    assert.equal(cards.length, 90);
    assert.equal(new Set(cards.map(card => card.id)).size, 90);
    assert.deepEqual([1, 2, 3].map(tier => cards.filter(card => card.tier === tier).length), [40, 30, 20]);
    assert.deepEqual(COLORS.map(color => cards.filter(card => card.bonus === color).length), [18, 18, 18, 18, 18]);
    assert.equal(SplendorEngine.NOBLES.length, 10);

    for (const [count, supply, nobleCount] of [[2, 4, 3], [3, 5, 4], [4, 7, 5]]) {
        const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
        const session = Splendor.create(`splendor-setup-${count}`, players(ids), { random: lcg(count), startingPlayerId: ids[0] });
        assert.equal(session.start().success, true);
        assert.deepEqual(COLORS.map(color => session.engine.tokens[color]), Array(5).fill(supply));
        assert.equal(session.engine.tokens.gold, 5);
        assert.equal(session.engine.nobles.length, nobleCount);
        assert.deepEqual([1, 2, 3].map(tier => session.engine.market[tier].length), [4, 4, 4]);
        assert.equal(session.start().success, false, '同一会话不能重复开始');
        assert.equal(session.engine.start().success, false, '引擎不能绕过会话重复开始');
    }

    assert.equal(Splendor.create('splendor-too-few', players(['a'])).start().success, false);
    assert.equal(Splendor.create('splendor-too-many', players(['a', 'b', 'c', 'd', 'e'])).start().success, false);

    const first = Splendor.create('splendor-seeded-a', players(['a', 'b']), { random: lcg(77), startingPlayerId: 'a' });
    const second = Splendor.create('splendor-seeded-b', players(['a', 'b']), { random: lcg(77), startingPlayerId: 'a' });
    first.start(); second.start();
    assert.deepEqual(first.engine.market, second.engine.market, '会话应使用传入的随机源复现市场');
    assert.deepEqual(first.engine.nobles, second.engine.nobles);
});

test('璀璨宝石拿宝石的三种合法形式与库存不足边界符合规则', () => {
    const game = new SplendorEngine('splendor-tokens-official', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue', 'green'] }).success, true);
    assert.deepEqual(game.players[0].tokens, tokenState({ white: 1, blue: 1, green: 1 }));

    game.currentTurnIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['red', 'red'] }).success, true);
    assert.equal(game.players[0].tokens.red, 2);
    assert.equal(game.presentation.events[0].kind, 'takeTokens');
    assert.deepEqual(game.presentation.events[0].colors, ['red', 'red']);
    game.currentTurnIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'white'] }).success, false, '同色库存不足四枚时不能拿两枚');

    game.currentTurnIndex = 0;
    game.tokens = tokenState({ white: 1, blue: 1, gold: 5 });
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, true, '仅剩两种有库存时可以拿两种不同颜色');
    game.currentTurnIndex = 0;
    game.tokens = tokenState({ white: 1, gold: 5 });
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white'] }).success, true, '仅剩一种有库存时可以拿一枚');
    game.currentTurnIndex = 0;
    game.tokens = tokenState({ gold: 5 });
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, false);
});

test('璀璨宝石购买、折扣、黄金支付、公开/牌库顶预留和隐私符合规则', () => {
    const game = new SplendorEngine('splendor-actions-official', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    const purchase = { id: 'official-purchase', tier: 1, bonus: 'red', points: 1, cost: { white: 2, blue: 1 } };
    game.market[1] = [purchase];
    game.decks[1] = [];
    game.players[0].tokens = tokenState({ white: 1, gold: 2 });
    game.tokens = tokenState({ white: 6, blue: 7, green: 7, red: 7, black: 7, gold: 3 });
    assert.equal(game.handleAction('a', { kind: 'buyCard', cardId: purchase.id }).success, true);
    assert.equal(game.players[0].points, 1);
    assert.equal(game.players[0].tokens.white, 0);
    assert.equal(game.players[0].tokens.gold, 0, '黄金应补足折扣后的缺口');
    assert.equal(game.players[0].cards[0].bonus, 'red');
    assert.equal(game.market[1].length, 0, '牌库耗尽时公开市场不补牌');
    assert.equal(game.presentation.events[0].kind, 'buyCard');
    assert.equal(game.presentation.events[0].card.id, purchase.id);
    assert.equal(game.presentation.events[0].payment.gold, 2);

    game.currentTurnIndex = 0;
    game.tokens.gold = 2;
    game.decks[2] = [{ id: 'hidden-top', tier: 2, bonus: 'blue', points: 2, cost: { red: 3 } }];
    assert.equal(game.handleAction('a', { kind: 'reserveCard', tier: 2 }).success, true);
    assert.equal(game.players[0].reserved.length, 1);
    assert.equal(game.players[0].tokens.gold, 1);
    assert.equal(game.presentation.events[0].source, 'deck');
    assert.equal(game.presentation.events[0].card, null, '暗抽预留的公共演出不能泄露牌面或牌 id');
    const opponentState = game.getPlayerState('b');
    assert.equal(opponentState.players.find(player => player.id === 'a').reservedCount, 1);
    assert.equal(opponentState.myReserved.length, 0, '牌库顶预留牌不能泄露给其他玩家');
    assert.equal(JSON.stringify(opponentState).includes('hidden-top'), false, '对手收到的完整状态中也不能出现暗抽牌 id');

    game.currentTurnIndex = 0;
    game.players[0].cards = [
        { id: 'discount-white', tier: 1, bonus: 'white', points: 0, cost: {} },
    ];
    const discounted = { id: 'discounted', tier: 1, bonus: 'blue', points: 0, cost: { white: 2 } };
    game.market[1] = [discounted];
    game.players[0].tokens = tokenState({ white: 1 });
    game.tokens = tokenState({ white: 6, blue: 7, green: 7, red: 7, black: 7, gold: 1 });
    assert.equal(game.handleAction('a', { kind: 'buyCard', cardId: discounted.id }).success, true, '永久同色折扣应降低购买成本');
    assert.equal(game.players[0].tokens.white, 0);
});

test('璀璨宝石超过十枚宝石必须归还，贵族同回合只能选择一位，终局同分按少牌数裁定', () => {
    const game = new SplendorEngine('splendor-edge-official', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    game.players[0].tokens = tokenState({ white: 9 });
    game.tokens = tokenState({ white: 7, blue: 7, green: 7, red: 7, black: 7, gold: 5 });
    const take = game.handleAction('a', { kind: 'takeTokens', colors: ['blue', 'green', 'red'] });
    assert.equal(take.success, true);
    assert.equal(game.phase, 'return_tokens');
    assert.equal(game.pendingTokenReturn.amount, 2);
    const transactionId = game.presentation.transactionId;
    assert.equal(game.presentation.pending, 'returnTokens');
    assert.match(game.actionLog.at(-1), /等待归还/);
    assert.equal(game.handleAction('b', { kind: 'returnTokens', colors: ['white', 'white'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'returnTokens', colors: ['white', 'white'] }).success, true);
    assert.equal(game._tokenTotal(game.players[0]) <= 10, true);
    assert.equal(game.presentation.transactionId, transactionId);
    assert.equal(game.presentation.events[0].kind, 'returnTokens');
    assert.match(game.actionLog.at(-1), /归还了/);

    game.currentTurnIndex = 0;
    game.players[0].cards = [
        { id: 'w1', bonus: 'white', points: 0, cost: {} }, { id: 'w2', bonus: 'white', points: 0, cost: {} }, { id: 'w3', bonus: 'white', points: 0, cost: {} },
        { id: 'b1', bonus: 'blue', points: 0, cost: {} }, { id: 'b2', bonus: 'blue', points: 0, cost: {} }, { id: 'b3', bonus: 'blue', points: 0, cost: {} },
    ];
    game.nobles = [
        { id: 'n-white-blue', name: '双贵族甲', points: 3, requirements: { white: 3, blue: 3 } },
        { id: 'n-white-blue-2', name: '双贵族乙', points: 3, requirements: { white: 3, blue: 3 } },
    ];
    game.market[1] = [{ id: 'free-noble-card', tier: 1, bonus: 'green', points: 0, cost: {} }];
    game.decks[1] = [];
    game.players[0].tokens = tokenState();
    const bought = game.handleAction('a', { kind: 'buyCard', cardId: 'free-noble-card' });
    assert.equal(bought.success, true);
    assert.equal(game.phase, 'choose_noble');
    assert.equal(game.pendingNoble.options.length, 2);
    assert.equal(game.handleAction('b', { kind: 'chooseNoble', nobleId: 'n-white-blue' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'chooseNoble', nobleId: 'n-white-blue' }).success, true);
    assert.equal(game.players[0].points, 3);
    assert.equal(game.presentation.events[0].kind, 'nobleVisit');
    assert.match(game.actionLog.at(-1), /双贵族甲/);

    game.status = 'playing'; game.phase = 'action'; game.currentTurnIndex = 0; game.finalRoundStart = 0;
    game.players[0].points = 15; game.players[1].points = 15;
    game.players[0].cards = [{ id: 'tie-a' }];
    game.players[1].cards = [{ id: 'tie-b1' }, { id: 'tie-b2' }];
    assert.equal(game._finishGame('points').success, true);
    assert.equal(game.winner.id, 'a');
    assert.deepEqual(game.winners.map(player => player.id), ['a']);
});

test('璀璨宝石自动贵族、最后一轮与终局结算形成完整的公开演出事件', () => {
    const nobleGame = new SplendorEngine('splendor-presentation-noble', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    nobleGame.start();
    nobleGame.players[0].cards = [
        { id: 'w1', bonus: 'white', points: 0, cost: {} }, { id: 'w2', bonus: 'white', points: 0, cost: {} }, { id: 'w3', bonus: 'white', points: 0, cost: {} },
        { id: 'b1', bonus: 'blue', points: 0, cost: {} }, { id: 'b2', bonus: 'blue', points: 0, cost: {} }, { id: 'b3', bonus: 'blue', points: 0, cost: {} },
    ];
    nobleGame.nobles = [{ id: 'sole-noble', name: '唯一贵族', points: 3, requirements: { white: 3, blue: 3 } }];
    nobleGame.market[1] = [{ id: 'noble-purchase', tier: 1, bonus: 'green', points: 0, cost: {} }];
    nobleGame.decks[1] = [];
    assert.equal(nobleGame.handleAction('a', { kind: 'buyCard', cardId: 'noble-purchase' }).success, true);
    assert.deepEqual(nobleGame.presentation.events.map(event => event.kind), ['buyCard', 'nobleVisit']);
    assert.equal(new Set(nobleGame.presentation.events.map(event => event.eventId)).size, 2);
    assert.equal(nobleGame.presentation.resolved, true);

    const finalGame = new SplendorEngine('splendor-presentation-final', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    finalGame.start();
    finalGame.nobles = [];
    finalGame.players[0].points = 14;
    finalGame.market[1] = [
        { id: 'trigger-final-round', tier: 1, bonus: 'red', points: 1, cost: {} },
        { id: 'complete-final-round', tier: 1, bonus: 'blue', points: 0, cost: {} },
    ];
    finalGame.decks[1] = [];
    assert.equal(finalGame.handleAction('a', { kind: 'buyCard', cardId: 'trigger-final-round' }).success, true);
    assert.equal(finalGame.presentation.finalRoundStarted, true);
    assert.deepEqual(finalGame.presentation.finalRoundTrigger, { playerId: 'a', playerName: 'a', points: 15 });
    assert.equal(finalGame.presentation.ended, false);
    assert.equal(finalGame.handleAction('b', { kind: 'buyCard', cardId: 'complete-final-round' }).success, true);
    assert.equal(finalGame.status, 'ended');
    assert.equal(finalGame.presentation.ended, true);
    assert.equal(finalGame.presentation.endReason, 'points');
    assert.deepEqual(finalGame.presentation.standings.map(player => player.id), ['a', 'b']);
    assert.deepEqual(finalGame.presentation.winners.map(player => player.id), ['a']);
});

function runFourPlayerGame(seed) {
    const ids = ['a', 'b', 'c', 'd'];
    const room = new Room(`splendor-full-${seed}`, 'a', 'a', 'splendor', { random: lcg(seed), startingPlayerId: 'a' });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const trace = [];
    let steps = 0;
    while (game.status === 'playing' && steps < 1000) {
        const current = game.players[game.currentTurnIndex];
        let action;
        if (game.pendingTokenReturn) {
            const colors = [];
            for (const color of [...COLORS, 'gold']) {
                for (let count = 0; count < current.tokens[color] && colors.length < game.pendingTokenReturn.amount; count += 1) colors.push(color);
            }
            action = { kind: 'returnTokens', colors };
        } else if (game.pendingNoble) {
            action = { kind: 'chooseNoble', nobleId: game.pendingNoble.options[0].id };
        } else {
            const candidates = [...game.market[1], ...game.market[2], ...game.market[3], ...current.reserved]
                .filter(card => canAfford(game, current, card))
                .sort((left, right) => right.points - left.points || left.tier - right.tier);
            if (candidates[0]) {
                action = { kind: 'buyCard', cardId: candidates[0].id, fromReserve: current.reserved.some(card => card.id === candidates[0].id) };
            } else {
                const available = COLORS.filter(color => game.tokens[color] > 0);
                if (available.length > 0) {
                    action = { kind: 'takeTokens', colors: available.length >= 3 ? available.slice(0, 3) : available };
                } else {
                    const marketCard = [1, 2, 3].flatMap(tier => game.market[tier])[0];
                    assert.ok(marketCard, `${seed}: 没有宝石时仍应有可预留牌`);
                    action = { kind: 'reserveCard', cardId: marketCard.id };
                }
            }
        }
        const result = room.handleGameAction(current.id, action);
        assert.equal(result.success, true, `${seed}: ${current.id} ${action.kind} 失败：${result.message}`);
        trace.push(`${current.id}:${action.kind}`);
        steps += 1;
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未正常结束`);
    assert.equal(game.phase, 'ended');
    assert.equal(game.endReason, 'points');
    assert.ok(steps < 1000);
    assert.ok(game.winners.length >= 1);
    assert.ok(trace.length > 80, '四人局应覆盖完整的资源、购买和终局轮流程');
    return { game, steps, trace };
}

test('璀璨宝石四人最大人数从发牌、购买到最后一轮完整运行三局', () => {
    const runs = [runFourPlayerGame(401), runFourPlayerGame(402), runFourPlayerGame(403)];
    assert.deepEqual(runs.map(run => run.game.players.length), [4, 4, 4]);
    assert.ok(runs.every(run => run.game.players.some(player => player.points >= 15)));
});
