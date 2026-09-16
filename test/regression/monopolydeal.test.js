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

test('Monopoly Deal rent supports accept and payment response states', () => {
    const session = MonopolyDeal.create('rent-response', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'play'; game.cardsPlayed = 0; game.currentTurnIndex = 0;
    game.players[0].properties.brown = [{ id: 'brown-1', kind: 'property', color: 'brown', value: 1 }, { id: 'brown-wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'rent-1', kind: 'rent', colors: ['brown', 'lightblue'], name: '棕色/浅蓝收租', value: 1 }];
    game.players[1].hand = [];
    game.players[1].bank = [{ id: 'money-1', kind: 'money', name: '现金', value: 3 }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(game.pendingDebt.amount, 2);
    assert.equal(session.handleAction('b', { kind: 'payDebt' }).success, true);
    assert.equal(game.pendingDebt, null);
});

test('Monopoly Deal exposes a full action deck and validates debt collector payments', () => {
    const deck = MonopolyDealEngine.buildDeck();
    assert.equal(deck.length, 110);
    for (const action of ['passGo', 'doubleRent', 'debtCollector', 'birthday', 'slyDeal', 'forcedDeal', 'house', 'hotel']) assert.ok(deck.some(card => card.action === action));
    const session = MonopolyDeal.create('debt-collector', players(['a', 'b'])); session.start(); const game = session.engine; game.phase = 'play'; game.cardsPlayed = 0; game.currentTurnIndex = 0;
    game.players[0].hand = [{ id: 'dc', kind: 'action', action: 'debtCollector', value: 3, name: '债务追缴' }]; game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 5, name: '现金' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(session.handleAction('b', { kind: 'payDebt', cardIds: ['cash'] }).success, true);
    assert.equal(game.players[0].bank[0].id, 'cash');
});

test('Monopoly Deal birthday lets each opponent accept or say no in sequence', () => {
    const session = MonopolyDeal.create('birthday', players(['a', 'b', 'c'])); session.start(); const game = session.engine;
    game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].hand = [{ id: 'birthday', kind: 'action', action: 'birthday', value: 2, name: '生日收礼' }];
    game.players[1].hand = [{ id: 'no-b', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[2].bank = [{ id: 'cash-c', kind: 'money', value: 2, name: '现金' }];
    assert.equal(session.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.targetId, 'b');
    assert.equal(session.handleAction('b', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'a');
    assert.equal(session.handleAction('a', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'c');
    assert.equal(session.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'c');
    assert.equal(session.handleAction('c', { kind: 'payDebt', cardIds: ['cash-c'] }).success, true);
    assert.equal(game.pendingAction, null); assert.equal(game.pendingDebt, null); assert.equal(game.players[0].bank[0].id, 'cash-c');
});

test('Monopoly Deal Just Say No can be countered by another Just Say No', () => {
    const game = new MonopolyDealEngine('deal-no-chain', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'rent', kind: 'rent', colors: [], value: 3, name: '万能收租' }, { id: 'no-a', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[1].hand = [{ id: 'no-b', kind: 'action', action: 'justSayNo', value: 4, name: '说不' }];
    game.players[1].bank = [{ id: 'cash', kind: 'money', value: 2, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'brown' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'a');
    assert.equal(game.handleAction('a', { kind: 'justSayNo', cardIndex: 0 }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
});

test('Monopoly Deal moves buildings with a complete set taken by Deal Breaker', () => {
    const game = new MonopolyDealEngine('deal-breaker-buildings', players(['a', 'b']));
    game.start();
    const actor = game.players[0]; const target = game.players[1];
    actor.hand = [{ id: 'breaker', kind: 'action', action: 'dealBreaker', value: 5, name: '强制交易' }];
    target.hand = [];
    target.properties.brown = [{ id: 'brown-1', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1 }, { id: 'brown-2', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1 }];
    target.buildings['brown-set'] = { house: { id: 'house', kind: 'action', action: 'house', name: '房屋', value: 3 }, hotel: { id: 'hotel', kind: 'action', action: 'hotel', name: '酒店', value: 4 } }; game.phase = 'play'; game.currentTurnIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(actor.houses.brown, 1); assert.equal(actor.hotels.brown, 1);
    assert.equal(target.houses.brown, 0); assert.equal(target.hotels.brown, 0);
});

test('Monopoly Deal matches the official 110-card box and removes reference cards before dealing', () => {
    const deck = MonopolyDealEngine.buildDeck();
    assert.equal(deck.length, 110); assert.equal(deck.filter(card => card.kind !== 'rules').length, 106);
    assert.equal(deck.filter(card => card.kind === 'property').length, 28);
    assert.equal(deck.filter(card => card.kind === 'property_wild').length, 11);
    assert.equal(deck.filter(card => card.kind === 'money').length, 20);
    assert.equal(deck.filter(card => card.kind === 'rent').length, 13);
    assert.equal(deck.filter(card => card.kind === 'action').length, 34);
    const game = new MonopolyDealEngine('deal-deal', players(['a', 'b'])); game.start();
    assert.equal(game.deck.length, 96); // 106 playable minus two five-card opening hands
});

test('Monopoly Deal assigns and repositions property wildcards only on legal colours', () => {
    const game = new MonopolyDealEngine('deal-wild', players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    const wild = { id: 'wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: null, value: 1, name: '地产万能牌' };
    game.players[0].hand = [wild];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.players[0].properties.brown[0].color, 'brown');
    assert.equal(game.cardsPlayed, 1);
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'wild', fromColor: 'brown', toColor: 'lightblue' }).success, true);
    assert.equal(game.players[0].properties.lightblue[0].color, 'lightblue');
    assert.equal(game.cardsPlayed, 1, '调整万能地产颜色不应占用出牌次数');
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'wild', fromColor: 'lightblue', toColor: 'pink' }).success, false);
});

test('Monopoly Deal uses the explicitly selected side of a two-colour rent card', () => {
    const game = new MonopolyDealEngine('deal-rent-colour-choice', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.red = [{ id: 'red-1', kind: 'property', color: 'red', value: 3 }];
    game.players[0].properties.yellow = [
        { id: 'yellow-1', kind: 'property', color: 'yellow', value: 3 },
        { id: 'yellow-2', kind: 'property', color: 'yellow', value: 3 },
        { id: 'yellow-3', kind: 'property', color: 'yellow', value: 3 },
    ];
    game.players[0].hand = [{ id: 'rent-red-yellow', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红色/黄色收租' }];
    game.players[1].hand = [];
    game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'yellow' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.color, 'yellow');
    assert.equal(game.pendingDebt.amount, 6);
});

test('Monopoly Deal requires Double the Rent to be paired with a Rent card and allows two doublers', () => {
    const game = new MonopolyDealEngine('deal-double-rent', players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    game.players[0].hand = [{ id: 'double-1', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' }, { id: 'double-2', kind: 'action', action: 'doubleRent', value: 1, name: '双倍租金' }, { id: 'rent', kind: 'rent', colors: ['brown', 'lightblue'], value: 1, name: '双色收租' }];
    game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'endTurn' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 8);
    assert.equal(game.cardsPlayed, 3);
});

test('Monopoly Deal does not count pure wild sets as complete and blocks lone ten-colour rent', () => {
    const game = new MonopolyDealEngine('deal-wild-official', players(['a', 'b']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.blue = [{ id: 'all-1', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'blue', value: 0, allColor: true }, { id: 'all-2', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'blue', value: 0, allColor: true }];
    game.players[0].hand = [{ id: 'rent', kind: 'rent', colors: [], value: 3, name: '万能收租' }];
    game.players[1].hand = []; game.players[1].bank = [{ id: 'cash', kind: 'money', value: 10, name: '现金' }];
    assert.equal(game._completedSets(game.players[0]), 0);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'blue' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.amount, 8);
    const single = new MonopolyDealEngine('deal-lone-ten-wild', players(['a', 'b']));
    single.start(); single.phase = 'play'; single.currentTurnIndex = 0; single.cardsPlayed = 0;
    single.players[0].properties.green = [{ id: 'all', kind: 'property_wild', colors: MonopolyDealEngine.COLORS, color: 'green', value: 0, allColor: true }];
    single.players[0].hand = [{ id: 'rent2', kind: 'rent', colors: [], value: 3, name: '万能收租' }];
    assert.equal(single.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', color: 'green' }).success, false);
});

test('Monopoly Deal two-colour rent charges every opponent in sequence', () => {
    const game = new MonopolyDealEngine('deal-rent-all', players(['a', 'b', 'c']));
    game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    game.players[0].properties.red = [{ id: 'r1', kind: 'property', color: 'red', value: 3 }];
    game.players[0].hand = [{ id: 'rent-all', kind: 'rent', colors: ['red', 'yellow'], value: 1, name: '红色/黄色收租' }];
    game.players[1].hand = []; game.players[2].hand = [];
    game.players[1].bank = [{ id: 'cash-b', kind: 'money', value: 2, name: '现金' }];
    game.players[2].bank = [{ id: 'cash-c', kind: 'money', value: 2, name: '现金' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'red' }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'b');
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'b');
    assert.equal(game.pendingDebts.length, 1);
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['cash-b'] }).success, true);
    assert.equal(game.pendingAction.responsePlayerId, 'c');
    assert.equal(game.handleAction('c', { kind: 'acceptAction' }).success, true);
    assert.equal(game.pendingDebt.payerId, 'c');
    assert.equal(game.handleAction('c', { kind: 'payDebt', cardIds: ['cash-c'] }).success, true);
    assert.equal(game.pendingAction, null);
    assert.deepEqual(game.players[0].bank.map(card => card.id), ['cash-b', 'cash-c']);
});

test('Monopoly Deal payment can complete the creditor third set and win immediately', () => {
    const game = new MonopolyDealEngine('deal-payment-win', players(['a', 'b']));
    game.start();
    const creditor = game.players[0]; const payer = game.players[1];
    creditor.properties.brown = [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }];
    creditor.properties.blue = [{ id: 'd1', kind: 'property', color: 'blue', value: 4 }, { id: 'd2', kind: 'property', color: 'blue', value: 4 }];
    payer.properties.utility = [{ id: 'u1', kind: 'property', color: 'utility', value: 2 }, { id: 'u2', kind: 'property', color: 'utility', value: 2 }];
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 2, type: 'rent' };
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['u1', 'u2'] }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.id, 'a');
});

test('Monopoly Deal completes a full three-set win across alternating turns', () => {
    const game = new MonopolyDealEngine('deal-full', players(['a', 'b'])); game.start();
    const sets = [
        [{ id: 'b1', kind: 'property', color: 'brown', value: 1 }, { id: 'b2', kind: 'property', color: 'brown', value: 1 }, { id: 'l1', kind: 'property', color: 'lightblue', value: 1 }],
        [{ id: 'l2', kind: 'property', color: 'lightblue', value: 1 }, { id: 'l3', kind: 'property', color: 'lightblue', value: 1 }, { id: 'p1', kind: 'property', color: 'pink', value: 2 }],
        [{ id: 'p2', kind: 'property', color: 'pink', value: 2 }, { id: 'p3', kind: 'property', color: 'pink', value: 2 }],
    ];
    for (const hand of sets) {
        const current = game.getCurrentPlayer(); current.hand = hand; game.phase = 'play'; game.cardsPlayed = 0;
        [...hand].forEach(() => game.handleAction(current.id, { kind: 'playCard', cardIndex: 0 }));
        if (game.status === 'ended') break;
        game.handleAction(current.id, { kind: 'endTurn' });
        const next = game.getCurrentPlayer(); next.hand = []; game.phase = 'play'; game.cardsPlayed = 0; game.handleAction(next.id, { kind: 'endTurn' });
    }
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'a'); assert.equal(game._completedSets(game.players[0]), 3);
});

test('Monopoly Deal keeps same-colour property sets independent and never overfills a set', () => {
    const game = new MonopolyDealEngine('deal-independent-groups', players(['a', 'b'])); game.start();
    const player = game.players[0]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    player.hand = [
        { id: 'brown-a', kind: 'property', color: 'brown', value: 1, name: '棕色 A' },
        { id: 'brown-b', kind: 'property', color: 'brown', value: 1, name: '棕色 B' },
        { id: 'brown-extra', kind: 'property', color: 'brown', value: 1, name: '棕色额外牌' },
    ];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'new' }).success, true);
    const firstGroupId = player.properties.brown[0].groupId;
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: firstGroupId }).success, true);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: firstGroupId }).success, false);
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'new' }).success, true);
    assert.deepEqual(game._groups(player, 'brown').map(group => group.cards.length), [2, 1]);
    assert.equal(game._completedSets(player), 1, '同色两组也只计一种胜利颜色');
});

test('Monopoly Deal locks built property groups against manual splitting without duplicating buildings', () => {
    const game = new MonopolyDealEngine('deal-real-buildings', players(['a', 'b'])); game.start();
    const player = game.players[0]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    player.properties.brown = [
        { id: 'brown-fixed', kind: 'property', color: 'brown', groupId: 'brown-set', value: 1, name: '棕色地产' },
        { id: 'brown-wild', kind: 'property_wild', colors: ['brown', 'lightblue'], color: 'brown', groupId: 'brown-set', value: 1, name: '万能地产' },
    ];
    player.hand = [
        { id: 'house-card', kind: 'action', action: 'house', value: 3, name: '房屋' },
        { id: 'hotel-card', kind: 'action', action: 'hotel', value: 4, name: '酒店' },
    ];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'brown-wild', fromColor: 'brown', fromGroupId: 'brown-set', toColor: 'lightblue', toGroupId: 'new' }).success, false, '房子建成后立即锁组');
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, color: 'brown', groupId: 'brown-set' }).success, true);
    assert.equal(game.discard.some(card => ['house-card', 'hotel-card'].includes(card.id)), false, '已建设的建筑不应同时进弃牌堆');
    assert.equal(game.handleAction('a', { kind: 'moveProperty', cardId: 'brown-wild', fromColor: 'brown', fromGroupId: 'brown-set', toColor: 'lightblue', toGroupId: 'new' }).success, false);
    assert.deepEqual(player.bank.filter(card => ['house-card', 'hotel-card'].includes(card.id)).map(card => card.id), []);
    assert.equal(game.discard.some(card => ['house-card', 'hotel-card'].includes(card.id)), false);
    assert.equal(game.players[0].buildings['brown-set'].house.id, 'house-card');
    assert.equal(game.players[0].buildings['brown-set'].hotel.id, 'hotel-card');
    assert.equal(player.properties.brown.length, 2);
    assert.equal(player.properties.lightblue.length, 0);
});

test('Monopoly Deal does not let attached buildings be selected as debt payment', () => {
    const game = new MonopolyDealEngine('deal-building-payment', players(['a', 'b'])); game.start();
    const creditor = game.players[0]; const payer = game.players[1];
    payer.properties.red = [
        { id: 'red-1', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
        { id: 'red-2', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
        { id: 'red-3', kind: 'property', color: 'red', groupId: 'red-set', value: 3 },
    ];
    payer.buildings['red-set'] = { house: { id: 'house-pay', kind: 'action', action: 'house', value: 3, name: '房屋' }, hotel: null };
    game.pendingDebt = { payerId: 'b', payerName: 'b', creditorId: 'a', creditorName: 'a', amount: 3, type: 'rent' };
    assert.equal(game.handleAction('b', { kind: 'payDebt', cardIds: ['house-pay'] }).success, false);
    assert.equal(creditor.bank.some(card => card.id === 'house-pay'), false);
    assert.equal(payer.buildings['red-set'].house.id, 'house-pay');
    assert.equal(game.discard.some(card => card.id === 'house-pay'), false);
});

test('Monopoly Deal exposes face-up bank and discard cards but never reshuffles banked cards', () => {
    const game = new MonopolyDealEngine('deal-bank-ledger', players(['a', 'b']), () => 0); game.start();
    const player = game.players[0];
    const banked = { id: 'banked-action', kind: 'action', action: 'passGo', value: 1, name: '通过起点' };
    const discarded = { id: 'discarded-action', kind: 'action', action: 'birthday', value: 2, name: '生日收礼' };
    player.bank = [banked]; game.deck = []; game.discard = [discarded];
    const publicState = game.getPublicState();
    assert.deepEqual(publicState.players[0].bank.map(card => card.id), ['banked-action']);
    assert.deepEqual(publicState.discard.map(card => card.id), ['discarded-action']);
    assert.deepEqual(game._draw(2).map(card => card.id), ['discarded-action']);
    assert.deepEqual(player.bank.map(card => card.id), ['banked-action']);
});

test('Monopoly Deal always opens a response window without revealing whether the target holds Just Say No', () => {
    const setup = (roomId, responseCard) => {
        const game = new MonopolyDealEngine(roomId, players(['a', 'b'])); game.start(); game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
        game.players[0].hand = [{ id: `debt-${roomId}`, kind: 'action', action: 'debtCollector', value: 3, name: '收取债务' }];
        game.players[1].hand = [responseCard]; game.players[1].bank = [{ id: `cash-${roomId}`, kind: 'money', value: 5, name: '现金' }];
        game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b' });
        return game;
    };
    const withNo = setup('with-no', { id: 'secret-no', kind: 'action', action: 'justSayNo', value: 4, name: '说不' });
    const withoutNo = setup('without-no', { id: 'secret-other', kind: 'action', action: 'passGo', value: 1, name: '通过起点' });
    assert.equal(withNo.pendingAction.responsePlayerId, 'b');
    assert.equal(withoutNo.pendingAction.responsePlayerId, 'b');
    assert.equal(withNo.getPlayerState('a').players.find(player => player.id === 'b').handCount, 1);
    assert.equal(withoutNo.getPlayerState('a').players.find(player => player.id === 'b').handCount, 1);
});

test('Monopoly Deal checks both players for an immediate win after Forced Deal', () => {
    const game = new MonopolyDealEngine('deal-forced-target-win', players(['a', 'b'])); game.start();
    const actor = game.players[0]; const target = game.players[1]; game.phase = 'play'; game.currentTurnIndex = 0; game.cardsPlayed = 0;
    target.properties.brown = [{ id: 'tb1', kind: 'property', color: 'brown', value: 1 }, { id: 'tb2', kind: 'property', color: 'brown', value: 1 }];
    target.properties.blue = [{ id: 'tblue1', kind: 'property', color: 'blue', value: 4 }, { id: 'tblue2', kind: 'property', color: 'blue', value: 4 }];
    target.properties.utility = [{ id: 'tu1', kind: 'property', color: 'utility', value: 2 }];
    target.properties.red = [{ id: 'tr1', kind: 'property', color: 'red', value: 3 }];
    actor.properties.utility = [{ id: 'au1', kind: 'property', color: 'utility', value: 2 }];
    actor.hand = [{ id: 'forced', kind: 'action', action: 'forcedDeal', value: 3, name: '强制交换' }];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0, targetId: 'b', targetColor: 'red', targetPropertyId: 'tr1', ownColor: 'utility', ownPropertyId: 'au1' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'acceptAction' }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.id, 'b');
});

