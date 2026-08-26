const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const Room = require('../server/room');
const MonopolyDeal = require('../server/games/monopolydeal');
const MonopolyDealEngine = require('../server/games/monopolydeal/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function fresh(ids = ['a', 'b'], seed = 1) {
    const session = MonopolyDeal.create(`monopolydeal-${seed}`, players(ids), undefined, { random: lcg(seed) });
    assert.equal(session.start().success, true);
    return session;
}

function property(id, color, value) {
    return { id, kind: 'property', color, value, name: `${color}-${id}` };
}

function money(id, value) {
    return { id, kind: 'money', value, name: `${value}M` };
}

function setPlay(game, currentId, hand) {
    game.currentTurnIndex = game.players.findIndex(player => player.id === currentId);
    game.phase = 'play';
    game.cardsPlayed = 0;
    game.pendingAction = null;
    game.pendingDebt = null;
    game.pendingDebts = [];
    game.interaction = null;
    game.players[game.currentTurnIndex].hand = hand;
}

function payAllAvailable(session, playerId) {
    const game = session.engine;
    const debt = game.pendingDebt;
    const options = session.getPlayerState(playerId).myPaymentOptions;
    const selected = [];
    let total = 0;
    for (const option of options) {
        selected.push(option.id);
        total += option.value;
        if (total >= debt.amount) break;
    }
    return session.handleAction(playerId, { kind: 'payDebt', cardIds: selected });
}

test('大富翁纸牌使用正式牌组、人数和起始发牌', () => {
    const deck = MonopolyDealEngine.buildDeck();
    assert.equal(deck.length, 110);
    assert.equal(deck.filter(card => card.kind !== 'rules').length, 106);
    assert.equal(deck.filter(card => card.kind === 'property').length, 28);
    assert.equal(deck.filter(card => card.kind === 'property_wild').length, 11);
    assert.equal(deck.filter(card => card.kind === 'money').length, 20);
    assert.equal(deck.filter(card => card.kind === 'rent').length, 13);
    assert.equal(deck.filter(card => card.kind === 'action').length, 34);
    const actionNames = Object.fromEntries(deck.filter(card => card.kind === 'action').map(card => [card.action, card.name]));
    assert.deepEqual(actionNames, {
        dealBreaker: '物业接管', justSayNo: '做出反对', passGo: '通行证', doubleRent: '双倍租金', debtCollector: '收取债务',
        birthday: '我的生日', slyDeal: '盗取', forcedDeal: '强制交易', house: '房子', hotel: '酒店',
    });
    assert.equal(deck.filter(card => card.kind === 'rent' && !card.colors.length).every(card => card.name === '任何租金'), true);

    const five = fresh(['a', 'b', 'c', 'd', 'e'], 101);
    assert.deepEqual(five.engine.players.map(player => player.hand.length), [5, 5, 5, 5, 5]);
    assert.equal(five.engine.deck.length, 81);
    assert.equal(five.engine.currentTurnIndex, 0);
    assert.equal(MonopolyDeal.create('too-many', players(['a', 'b', 'c', 'd', 'e', 'f'])).start().success, false);
    assert.equal(MonopolyDeal.create('too-few', players(['a'])).start().success, false);
});

test('重复提交同一张手牌不会误打后方卡牌或虚增出牌数', () => {
    const game = fresh(['a', 'b'], 108).engine;
    setPlay(game, 'a', [money('stable-1', 1), money('stable-2', 2), money('stable-3', 3)]);

    const firstRequest = { kind: 'playCard', cardIndex: 0, cardId: 'stable-1', zone: 'bank' };
    assert.equal(game.handleAction('a', firstRequest).success, true);
    assert.equal(game.cardsPlayed, 1);
    assert.deepEqual(game.players[0].hand.map(card => card.id), ['stable-2', 'stable-3']);

    const duplicate = game.handleAction('a', firstRequest);
    assert.equal(duplicate.success, false, '重复请求必须被拒绝');
    assert.equal(game.cardsPlayed, 1, '重复请求不能增加出牌数');
    assert.deepEqual(game.players[0].hand.map(card => card.id), ['stable-2', 'stable-3'], '重复请求不能误删补位的下一张牌');

    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, cardId: 'stable-2', zone: 'bank' }).success, true);
    assert.equal(game.cardsPlayed, 2, '实际打出两张就只能记录两张');
    assert.deepEqual(game.players[0].hand.map(card => card.id), ['stable-3']);
});

test('客户端用卡牌 ID 提交、锁定重复操作并在销毁时移除牌桌监听', () => {
    const source = fs.readFileSync('public/games/monopolydeal/client.js', 'utf8');
    assert.match(source, /return \{ kind, cardIndex, cardId: card\?\.id, \.\.\.extra \}/);
    assert.match(source, /if \(submissionPending\) return false/);
    assert.equal((source.match(/\{ signal: controller\.signal \}/g) || []).length >= 6, true);
    assert.doesNotMatch(source, /说不|交易破坏者|通过起点|生日收礼|偷偷交易|强制交换/);
});

test('每回合摸牌、空手摸五张、最多三张和七张手牌上限正确执行', () => {
    const session = fresh(['a', 'b'], 102);
    const game = session.engine;
    game.deck = [];
    game.discard = [];
    game.players[0].hand = [money('m1', 1), money('m2', 1), money('m3', 1), money('m4', 1), money('m5', 1)];
    game.phase = 'draw';
    game.currentTurnIndex = 0;
    assert.equal(session.handleAction('a', { kind: 'drawCards' }).success, true);
    assert.equal(game.players[0].hand.length, 5, '牌库为空时不会凭空产生牌');

    game.players[0].hand = [money('a1', 1), money('a2', 1), money('a3', 1), money('a4', 1)];
    game.phase = 'play'; game.cardsPlayed = 0;
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, zone: 'bank' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, zone: 'bank' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, zone: 'bank' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, zone: 'bank' }).success, false, '每回合最多三次出牌');

    game.players[0].hand = Array.from({ length: 8 }, (_, index) => money(`limit-${index}`, 1));
    game.phase = 'play'; game.cardsPlayed = 0;
    assert.equal(session.handleAction('a', { kind: 'endTurn' }).success, true);
    assert.equal(game.phase, 'discard');
    assert.equal(session.handleAction('a', { kind: 'discardCard', cardIndex: 0 }).success, true);
    assert.equal(game.phase, 'draw');

    const empty = game.getCurrentPlayer();
    empty.hand = [];
    game.phase = 'draw'; game.deck = [money('d1', 1), money('d2', 1), money('d3', 1), money('d4', 1), money('d5', 1)];
    assert.equal(session.handleAction(empty.id, { kind: 'drawCards' }).success, true);
    assert.equal(empty.hand.length, 5, '回合开始没有手牌时必须摸五张');
});

test('地产万能牌、完整组和建筑规则符合正式规则', () => {
    const game = fresh(['a', 'b'], 103).engine;
    setPlay(game, 'a', [
        { id: 'wild-ten-1', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: null, value: 0, allColor: true, name: '十色万能牌' },
        property('brown-1', 'brown', 1), property('brown-2', 'brown', 1),
        { id: 'wild-two', kind: 'property_wild', colors: ['brown', 'lightblue'], color: null, value: 1, name: '双色万能牌' },
    ]);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game._completedSets(game.players[0]), 0, '十色万能牌不能单独组成完整地产组');
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game._completedSets(game.players[0]), 1);
    game.cardsPlayed = 0;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.deepEqual(game._groups(game.players[0], 'brown').map(group => group.cards.length), [2, 2], '完整组不能被万能牌超额填充，万能牌应进入另一组');

    game.players[0].hand = [
        { id: 'house', kind: 'action', action: 'house', value: 3, name: '房屋' },
        { id: 'hotel', kind: 'action', action: 'hotel', value: 4, name: '酒店' },
    ];
    game.cardsPlayed = 0;
    const brownGroup = game._groups(game.players[0], 'brown')[0];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: brownGroup.id }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: brownGroup.id }).success, true);
    assert.equal(game.players[0].buildings[brownGroup.id].house.id, 'house');
    assert.equal(game.players[0].buildings[brownGroup.id].hotel.id, 'hotel');
    assert.equal(game._rentAmount(game.players[0], 'brown', brownGroup.id), 9, '房屋+3、酒店+4应叠加');
});

test('双色收租向所有对手收租，十色收租只指定一人，双倍租金可叠到四倍', () => {
    const session = fresh(['a', 'b', 'c'], 104);
    const game = session.engine;
    game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.red = [property('r1', 'red', 3), property('r2', 'red', 3), property('r3', 'red', 3)];
    game.players[0].hand = [
        { id: 'double-a', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' },
        { id: 'double-b', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' },
        { id: 'rent-red', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红黄收租' },
    ];
    game.players[1].bank = [money('b-cash', 20)];
    game.players[2].bank = [money('c-cash', 20)];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'red' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 24);
    assert.equal(payAllAvailable(session, 'b').success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'c');
    assert.equal(game.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 24);
    assert.equal(payAllAvailable(session, 'c').success, true);

    game.currentTurnIndex = 0; game.phase = 'play'; game.cardsPlayed = 0;
    game.players[0].hand = [{ id: 'rent-any', kind: 'rent', colors: [], value: 3, name: '万能收租' }];
    game.players[1].bank = [money('b2', 5)]; game.players[2].bank = [money('c2', 5)];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'red', targetId: 'b' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 6);
    assert.equal(game.pendingDebts.length, 0, '十色收租只会排一个目标');
});

test('银行牌、地产牌、做出反对和支付结算保持桌面牌区语义', () => {
    const game = fresh(['a', 'b'], 105).engine;
    const creditor = game.players[0];
    const payer = game.players[1];
    payer.bank = [{ id: 'bank-action', kind: 'action', action: 'birthday', value: 2, name: '我的生日' }];
    payer.hand = [money('hidden-hand', 10)];
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 1, type: 'rent' };
    assert.deepEqual(game.getPlayerState('b').myPaymentOptions.map(item => item.id), ['bank-action']);
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['bank-action'] }).success, true);
    assert.equal(creditor.bank[0].id, 'bank-action', '银行行动牌支付后仍是收款人的银行资产');
    assert.equal(payer.hand.some(card => card.id === 'hidden-hand'), true, '手牌不能用于支付');

    payer.bank = [];
    payer.properties.brown = [property('pay-prop', 'brown', 1), property('pay-prop-2', 'brown', 1)];
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 10, type: 'rent' };
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['pay-prop', 'pay-prop-2'] }).success, true, '资产不足时支付全部可支付资产并结清');
    assert.equal(payer.properties.brown.length, 0);
    assert.equal(creditor.properties.brown.length, 2);

    payer.properties.red = [
        { ...property('red-1', 'red', 3), groupId: 'red-set' },
        { ...property('red-2', 'red', 3), groupId: 'red-set' },
        { ...property('red-3', 'red', 3), groupId: 'red-set' },
    ];
    payer.buildings['red-set'] = { house: { id: 'house-attached', kind: 'action', action: 'house', value: 3, name: '房屋' }, hotel: null };
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 3, type: 'rent' };
    assert.equal(game.getPlayerState('b').myPaymentOptions.some(item => item.id === 'house-attached'), false, '附着建筑不是直接支付选项');
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['house-attached'] }).success, false);
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['red-1'] }).success, true);
    assert.equal(payer.bank.some(card => card.id === 'house-attached'), true, '拆组后的建筑进入付款人银行');
    assert.equal(creditor.properties.red.some(card => card.id === 'red-1'), true);
});

test('公开行动链在做出反对、支付与多目标之间保留同一编号和牌面', () => {
    const session = fresh(['a', 'b', 'c'], 106);
    const game = session.engine;
    game.players[0].properties.red = [property('red-a', 'red', 3), property('red-b', 'red', 3), property('red-c', 'red', 3)];
    setPlay(game, 'a', [
        { id: 'rent-chain', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红黄收租' },
        { id: 'a-no', kind: 'action', action: 'justSayNo', value: 4, name: '做出反对' },
    ]);
    game.players[1].hand = [{ id: 'b-no', kind: 'action', action: 'justSayNo', value: 4, name: '做出反对' }];
    game.players[1].bank = [money('b-cash', 6)];
    game.players[2].bank = [money('c-cash', 6)];

    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'red' }).success, true);
    let view = session.getPlayerState('c');
    const interactionId = view.interaction.interactionId;
    assert.equal(view.interaction.card.id, 'rent-chain');
    assert.deepEqual(view.interaction.targetIds, ['b', 'c']);
    assert.equal(view.interaction.currentTargetId, 'b');
    assert.equal(view.interaction.stage, 'response');

    assert.equal(session.handleAction('b', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(session.getPlayerState('c').interaction.responsePlayerId, 'a');
    assert.equal(session.handleAction('a', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    view = session.getPlayerState('c');
    assert.equal(view.interaction.interactionId, interactionId);
    assert.equal(view.interaction.noCount, 2);
    assert.deepEqual(view.interaction.noChain.map(item => item.playerId), ['b', 'a']);

    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(session.getPlayerState('c').interaction.stage, 'payment');
    assert.equal(session.handleAction('b', { kind: 'payDebt', cardIds: ['b-cash'] }).success, true);
    view = session.getPlayerState('a');
    assert.equal(view.interaction.interactionId, interactionId);
    assert.equal(view.interaction.currentTargetId, 'c');
    assert.equal(view.interaction.stage, 'response');
    assert.equal(view.interaction.payments.length, 1);
    assert.equal(view.interaction.results[0].outcome, 'paid');

    assert.equal(session.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'payDebt', cardIds: ['c-cash'] }).success, true);
    view = session.getPlayerState('b');
    assert.equal(view.interaction.interactionId, interactionId);
    assert.equal(view.interaction.stage, 'resolved');
    assert.equal(view.interaction.outcome, 'completed');
    assert.equal(view.interaction.payments.length, 2);
    assert.ok(view.interaction.resolutionId);
});

test('物业接管的整组转移与第三组胜利保留在最终公开结算中', () => {
    const session = fresh(['a', 'b'], 107);
    const game = session.engine;
    game.players[0].properties.brown = [property('a-brown-1', 'brown', 1), property('a-brown-2', 'brown', 1)];
    game.players[0].properties.lightblue = [property('a-blue-1', 'lightblue', 1), property('a-blue-2', 'lightblue', 1), property('a-blue-3', 'lightblue', 1)];
    game.players[1].properties.blue = [property('b-dark-1', 'blue', 4), property('b-dark-2', 'blue', 4)];
    setPlay(game, 'a', [{ id: 'breaker', kind: 'action', action: 'dealBreaker', value: 5, name: '物业接管' }]);
    const targetGroup = game._groups(game.players[1], 'blue')[0];

    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'blue', groupId: targetGroup.id }).success, true);
    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    const view = session.getPlayerState('a');
    assert.equal(view.status, 'ended');
    assert.equal(view.winner.id, 'a');
    assert.equal(view.interaction.type, 'dealBreaker');
    assert.equal(view.interaction.transfer.kind, 'group');
    assert.equal(view.interaction.transfer.fromId, 'b');
    assert.equal(view.interaction.transfer.toId, 'a');
    assert.equal(view.interaction.transfer.cardIds.length, 2);
    assert.equal(view.interaction.outcome, 'win');
    assert.equal(view.interaction.winnerId, 'a');
});

function runFivePlayerFullGame(seed, winnerId) {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const room = new Room(`monopolydeal-full-${seed}`, 'a', 'a', 'monopolydeal', { random: lcg(seed) });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const winner = game.playerMap[winnerId];
    winner.hand = [
        property(`${winnerId}-brown-1`, 'brown', 1), property(`${winnerId}-brown-2`, 'brown', 1),
        property(`${winnerId}-lightblue-1`, 'lightblue', 1), property(`${winnerId}-lightblue-2`, 'lightblue', 1), property(`${winnerId}-lightblue-3`, 'lightblue', 1),
        property(`${winnerId}-pink-1`, 'pink', 2), property(`${winnerId}-pink-2`, 'pink', 2), property(`${winnerId}-pink-3`, 'pink', 2),
    ];
    ids.filter(id => id !== winnerId).forEach(id => { game.playerMap[id].hand = [money(`${id}-seed-money`, 1)]; });
    game.deck = [];
    game.discard = [];
    const turns = new Set();
    let steps = 0;
    while (game.status === 'playing' && steps++ < 200) {
        const player = game.getCurrentPlayer();
        turns.add(player.id);
        if (game.phase === 'draw') assert.equal(room.handleGameAction(player.id, { kind: 'drawCards' }).success, true);
        if (game.phase === 'discard') {
            assert.equal(room.handleGameAction(player.id, { kind: 'discardCard', cardIndex: 0 }).success, true);
            continue;
        }
        while (game.phase === 'play' && game.cardsPlayed < 3 && player.hand.length) {
            const card = player.hand[0];
            const action = card.kind === 'money'
                ? { kind: 'playCard', cardIndex: 0, zone: 'bank' }
                : { kind: 'playCard', cardIndex: 0 };
            assert.equal(room.handleGameAction(player.id, action).success, true, `${seed}: ${player.id} 的牌应能正常打出`);
        }
        if (game.status === 'playing') assert.equal(room.handleGameAction(player.id, { kind: 'endTurn' }).success, true);
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 应完整结束`);
    assert.equal(game.winner.id, winnerId);
    assert.ok(steps < 200);
    assert.deepEqual([...turns].sort(), ids.sort(), '五名玩家都应至少完成一个回合');
    return { game, steps };
}

test('五人最大人数局可从发牌、轮转到三组胜利完整结束（三局）', () => {
    runFivePlayerFullGame(201, 'a');
    runFivePlayerFullGame(202, 'c');
    runFivePlayerFullGame(203, 'e');
});
