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

test('Monopoly uses a 40-space fold-board route', () => {
    const session = Monopoly.create('classic-board', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.engine.getPublicState().board.length, 40);
    assert.equal(session.engine.getPublicState().board[30].type, 'go_to_jail');
});

test('Monopoly keeps the C1009 board spaces tied to their board rules and supports six seats', () => {
    const session = Monopoly.create('classic-board-six', players(['a', 'b', 'c', 'd', 'e', 'f']));
    assert.equal(session.start().success, true);
    const state = session.engine.getPublicState();
    assert.equal(state.board.length, 40);
    assert.equal(state.board[0].type, 'start');
    assert.equal(state.board[2].type, 'community_chest');
    assert.equal(state.board[7].type, 'chance');
    assert.equal(state.board[4].amount, 200);
    assert.equal(state.board[38].amount, 100);
    assert.equal(state.board[12].group, 'utility');
    assert.equal(state.board[5].group, 'transit');
    assert.equal(session.engine.communityChestDeck.find(card => card.title === '住院费').amount, -100);
});

test('Monopoly utilities use dice-based rent and complete groups gate building', () => {
    const session = Monopoly.create('utility-rent', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.board[12].ownerId = 'a'; game.board[28].ownerId = 'a'; game.lastRollTotal = 8;
    assert.equal(game._calculateRent(game.board[12]), 80);
    assert.deepEqual(game.getPlayerState('a').availableActions.buildableTiles, []);
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.players[0].cash = 100;
    assert.ok(game.getPlayerState('a').availableActions.buildableTiles.includes(1));
});

test('Monopoly builds houses evenly across a completed color group', () => {
    const session = Monopoly.create('even-build', players(['a', 'b'])); session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.phase = 'await_roll'; game.players[0].cash = 500;
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.board[1].houses = 1;
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, false);
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 3 }).success, true);
    assert.equal(game.board[1].houses, 1); assert.equal(game.board[3].houses, 1);
    game.phase = 'turn_complete';
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].houses, 2);
});

test('Monopoly auctions an unpurchased property when the landing player declines', () => {
    const session = Monopoly.create('monopoly-auction', players(['a', 'b', 'c'])); session.start(); const game = session.engine; const player = game.players[0]; game.currentTurnIndex = 0;
    player.position = 1; game._resolveLanding(player);
    assert.equal(game.phase, 'property_decision');
    assert.equal(session.handleAction('a', { kind: 'passProperty' }).success, true);
    assert.equal(game.phase, 'auction');
    assert.equal(session.handleAction('a', { kind: 'bidProperty', amount: 10 }).success, true);
    assert.equal(session.handleAction('b', { kind: 'bidProperty', amount: 75 }).success, true);
    assert.equal(session.handleAction('c', { kind: 'passAuction' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'passAuction' }).success, true);
    assert.equal(game.board[1].ownerId, 'b');
    assert.equal(game.players[1].cash, 1425);
});

test('Monopoly allows a property trade while an auction is in progress', () => {
    const session = Monopoly.create('monopoly-trade-auction', players(['a', 'b', 'c']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.currentTurnIndex = 0;
    game.phase = 'property_decision';
    game.pendingPurchase = { playerId: 'a', tileIndex: 1 };
    assert.equal(session.handleAction('a', { kind: 'passProperty' }).success, true);
    game.board[3].ownerId = 'b';
    assert.equal(session.handleAction('b', { kind: 'proposeTrade', targetPlayerId: 'c', propertyOffer: [3], cashOffer: 0, cashRequest: 0, propertyRequest: [] }).success, true);
    assert.equal(game.tradeOffers.size, 1);
    assert.equal(game.phase, 'auction');
});

test('Monopoly uses the official third-jail-roll payment and movement rule', () => {
    const session = Monopoly.create('monopoly-jail', players(['a', 'b'])); session.start(); const game = session.engine; game.currentTurnIndex = 0;
    const player = game.players[0]; player.inJail = true; player.position = 10; player.jailTurns = 2; player.cash = 100;
    game.phase = 'jail_decision'; game._rollDice = () => [1, 2];
    assert.equal(session.handleAction('a', { kind: 'rollForDoubles' }).success, true);
    assert.equal(player.inJail, false); assert.equal(player.cash, 50); assert.equal(player.position, 13); assert.equal(game.phase, 'property_decision');
});

test('Monopoly supports the complete chance/community decks and hotel upgrade', () => {
    const session = Monopoly.create('monopoly-formal', players(['a', 'b'])); session.start(); const game = session.engine;
    assert.equal(game.chanceDeck.length, 16); assert.equal(game.communityChestDeck.length, 16);
    assert.equal(game.chanceDeck.filter(card => card.kind === 'pay_each_player').length, 1);
    assert.equal(game.chanceDeck.filter(card => card.kind === 'advance' && card.target === 39).length, 1);
    assert.equal(game.board[2].type, 'community_chest'); assert.equal(game.board[7].type, 'chance'); assert.equal(game.board[10].type, 'jail');
    game.board[1].ownerId = 'a'; game.board[3].ownerId = 'a'; game.board[1].houses = 4; game.board[3].houses = 4; game.players[0].cash = 500;
    game.phase = 'turn_complete';
    assert.equal(session.handleAction('a', { kind: 'buildHouse', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].houses, 5); assert.equal(game._calculateRent(game.board[1]), 250);
});

test('Monopoly pays the start reward when an advance-to-start card is drawn at start', () => {
    const session = Monopoly.create('monopoly-start-card', players(['a', 'b'])); session.start(); const game = session.engine;
    const player = game.players[0]; player.position = 0; player.cash = 1500;
    game.chanceDeck = [{ title: '前进到起点', text: '前进到起点并领取 M200', kind: 'advance', target: 0 }];
    game._drawEvent(player, 0, 'chance');
    assert.equal(player.cash, 1700);
    assert.equal(player.position, 0);
});

test('Monopoly returns a used get-out-of-jail card to its original deck', () => {
    const session = Monopoly.create('monopoly-jail-card', players(['a', 'b'])); session.start(); const game = session.engine;
    const player = game.players[0]; game.currentTurnIndex = 0; player.position = 2; game.communityChestDeck = [{ title: '免费出狱卡', text: '保留此卡，可免费离开监狱', kind: 'get_out_of_jail' }];
    game._resolveLanding(player); assert.equal(player.jailCardCount, 1); assert.equal(game.communityChestDeck.length, 0);
    player.inJail = true; game.phase = 'jail_decision';
    assert.equal(session.handleAction('a', { kind: 'useJailCard' }).success, true);
    assert.equal(player.jailCardCount, 0); assert.equal(game.communityChestDeck.at(-1).kind, 'get_out_of_jail');
});

test('Monopoly completes a deterministic two-player game through bankruptcy', () => {
    const session = Monopoly.create('monopoly-full', players(['a', 'b'])); session.start(); const game = session.engine;
    const debtor = game.players[0]; const creditor = game.players[1]; game.currentTurnIndex = 0;
    debtor.position = 39; debtor.cash = 0; game.board[1].ownerId = creditor.id; game.board[1].houses = 5;
    game._rollDice = () => [1, 1];
    assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'declareBankruptcy' }).success, true);
    assert.equal(debtor.position, 1); assert.equal(debtor.isBankrupt, true); assert.equal(game.status, 'ended'); assert.equal(game.winner.id, creditor.id);
});
