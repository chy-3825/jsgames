const assert = require('node:assert/strict');
const test = require('node:test');
const Monopoly = require('../server/games/monopoly');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `m${index}`, name: `玩家${index + 1}` }));
}

function random(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

test('Monopoly accepts the official 2-6 player lifecycle and resets the building bank only once', () => {
    const session = Monopoly.create('monopoly-official-life', players(6), null, { random: random(1406) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const state = game.getPublicState();
    assert.equal(state.board.length, 40);
    assert.equal(game.chanceDeck.length, 16);
    assert.equal(game.communityChestDeck.length, 16);
    assert.equal(state.rules.housesAvailable, 32);
    assert.equal(state.rules.hotelsAvailable, 12);
    assert.equal(state.board[11].name, '湾仔');
    assert.equal(game.chanceDeck.some(card => card.title === '前进到湾仔' && card.target === 11), true);
    assert.equal(session.start().success, false);

    assert.equal(Monopoly.create('monopoly-too-few', players(1)).start().success, false);
    assert.equal(Monopoly.create('monopoly-too-many', players(7)).start().success, false);
});

test('Monopoly enforces even building, bank inventories, building sales and mortgages', () => {
    const session = Monopoly.create('monopoly-assets', players(2));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const owner = game.players[0];
    owner.cash = 3000;
    game.currentTurnIndex = 0;
    game.phase = 'turn_complete';
    game.board[1].ownerId = owner.id;
    game.board[3].ownerId = owner.id;

    game.board[1].houses = 1;
    game.housesAvailable -= 1;
    assert.equal(session.handleAction(owner.id, { kind: 'buildHouse', tileIndex: 1 }).success, false);
    assert.equal(session.handleAction(owner.id, { kind: 'buildHouse', tileIndex: 3 }).success, true);
    assert.equal(game.housesAvailable, 30);

    game.phase = 'turn_complete';
    for (const tileIndex of [1, 3, 1, 3, 1, 3]) {
        assert.equal(session.handleAction(owner.id, { kind: 'buildHouse', tileIndex }).success, true);
        game.phase = 'turn_complete';
    }
    assert.deepEqual([game.board[1].houses, game.board[3].houses], [4, 4]);
    assert.equal(game.housesAvailable, 24);
    assert.equal(session.handleAction(owner.id, { kind: 'buildHouse', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].houses, 5);
    assert.equal(game.hotelsAvailable, 11);
    assert.equal(game.housesAvailable, 28);

    game.phase = 'turn_complete';
    assert.equal(session.handleAction(owner.id, { kind: 'sellBuilding', tileIndex: 1 }).success, true, '酒店可降级为四栋房屋');
    assert.equal(game.board[1].houses, 4);
    assert.equal(game.board[3].houses, 4);
    assert.equal(game.housesAvailable, 24);

    game.board[1].houses = 0;
    game.board[3].houses = 0;
    game.phase = 'turn_complete';
    const cashBeforeMortgage = owner.cash;
    assert.equal(session.handleAction(owner.id, { kind: 'mortgageProperty', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].mortgaged, true);
    assert.equal(owner.cash, cashBeforeMortgage + 30);
    assert.equal(game._calculateRent(game.board[1]), 0);
    assert.equal(session.handleAction(owner.id, { kind: 'buildHouse', tileIndex: 3 }).success, false);
    game.phase = 'turn_complete';
    assert.equal(session.handleAction(owner.id, { kind: 'unmortgageProperty', tileIndex: 1 }).success, true);
    assert.equal(game.board[1].mortgaged, false);
    assert.equal(owner.cash, cashBeforeMortgage - 3);

    const debtor = game.players[1];
    game.board[1].ownerId = debtor.id;
    game.board[1].houses = 5;
    game.board[3].ownerId = debtor.id;
    game.board[3].mortgaged = true;
    const creditorCash = owner.cash;
    const debtorCash = debtor.cash;
    game._bankrupt(debtor, owner, '测试债务');
    assert.equal(game.board[1].ownerId, owner.id);
    assert.equal(game.board[1].houses, 0);
    assert.equal(game.board[1].mortgaged, false);
    assert.equal(game.board[3].ownerId, owner.id);
    assert.equal(game.board[3].mortgaged, true);
    assert.equal(owner.cash, creditorCash + debtorCash + 25 - 3);
});

test('Monopoly auctions bank-bankruptcy properties before advancing the turn', () => {
    const session = Monopoly.create('monopoly-bank-auction', players(3));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const debtor = game.players[0];
    const bidder = game.players[1];
    const secondBidder = game.players[2];
    game.currentTurnIndex = 0;
    game.phase = 'debt_resolution';
    game.pendingDebt = { debtorId: debtor.id, creditorId: null, amountOriginal: 100, amountPaid: 0, amountRemaining: 100, reason: '税费', returnPhase: 'turn_complete', continuation: null };
    debtor.cash = 0;
    game.board[1].ownerId = debtor.id;
    game.board[5].ownerId = debtor.id;

    assert.equal(session.handleAction(debtor.id, { kind: 'declareBankruptcy' }).success, true);
    assert.equal(debtor.isBankrupt, true);
    assert.equal(game.phase, 'auction');
    assert.equal(game.auction.bankruptcy, true);
    assert.equal(game.board[1].ownerId, null);
    assert.equal(session.handleAction(bidder.id, { kind: 'bidProperty', amount: 10 }).success, true);
    assert.equal(session.handleAction(secondBidder.id, { kind: 'passAuction' }).success, true);
    assert.equal(session.handleAction(bidder.id, { kind: 'passAuction' }).success, true);
    assert.equal(game.board[1].ownerId, bidder.id);
    assert.equal(game.phase, 'auction');
    assert.equal(game.auction.tileIndex, 5);
    assert.equal(session.handleAction(secondBidder.id, { kind: 'passAuction' }).success, true);
    assert.equal(game.board[5].ownerId, null);
    assert.equal(game.phase, 'await_roll');
    assert.equal(game.currentTurnIndex, 1);
});

test('Monopoly keeps building inventory rules explicit when the bank is empty', () => {
    const session = Monopoly.create('monopoly-building-bank', players(2));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const player = game.players[0];
    game.currentTurnIndex = 0;
    game.phase = 'turn_complete';
    player.cash = 500;
    game.board[1].ownerId = player.id;
    game.board[3].ownerId = player.id;
    game.housesAvailable = 0;
    assert.equal(session.handleAction(player.id, { kind: 'buildHouse', tileIndex: 1 }).success, false);
    assert.equal(game.phase, 'turn_complete');
    assert.equal(game.auction, null);
});

test('Monopoly completes three maximum-seat games through the real action interface', () => {
    for (const seed of [8101, 8102, 8103]) {
        const session = Monopoly.create(`monopoly-six-${seed}`, players(6), null, { random: random(seed) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        const winner = game.players[5];

        // Give the first player a legal brown-group purchase/build sequence so
        // the six-seat board is stress-tested without relying on an
        // unbounded random game. Every state transition still goes through the
        // same public session actions as the browser client.
        const builder = game.players[0];
        builder.cash = 5000;
        builder.position = 0;
        game.currentTurnIndex = 0;
        game.phase = 'await_roll';
        game._rollDice = () => [1, 2];
        assert.equal(session.handleAction(builder.id, { kind: 'rollDice' }).success, true);
        assert.equal(session.handleAction(builder.id, { kind: 'buyProperty' }).success, true);
        assert.equal(session.handleAction(builder.id, { kind: 'endTurn' }).success, true);
        game.phase = 'await_roll';
        builder.position = 39;
        game.currentTurnIndex = 0;
        game._rollDice = () => [1, 1];
        assert.equal(session.handleAction(builder.id, { kind: 'rollDice' }).success, true);
        assert.equal(session.handleAction(builder.id, { kind: 'buyProperty' }).success, true);
        game.phase = 'turn_complete';
        game.board[1].ownerId = builder.id;
        game.board[3].ownerId = builder.id;
        for (const tileIndex of [1, 3, 1, 3, 1, 3, 1, 3, 1, 3]) {
            game.phase = 'turn_complete';
            assert.equal(session.handleAction(builder.id, { kind: 'buildHouse', tileIndex }).success, true);
        }
        assert.equal(game.board[1].houses, 5);
        assert.equal(game.board[3].houses, 5);
        game.board[1].ownerId = winner.id;
        game.board[3].ownerId = winner.id;

        // Let every other seat take at least one normal turn, then route each
        // debtor to the hotel rent through rollDice. This covers rent transfer,
        // bankruptcy, creditor ownership and the final winner transition.
        for (let index = 0; index < 5; index += 1) {
            const debtor = game.players[index];
            game.currentTurnIndex = index;
            game.phase = 'await_roll';
            debtor.position = 39;
            debtor.cash = 0;
            game._rollDice = () => [1, 1];
            assert.equal(session.handleAction(debtor.id, { kind: 'rollDice' }).success, true);
            if (game.phase === 'debt_resolution') assert.equal(session.handleAction(debtor.id, { kind: 'declareBankruptcy' }).success, true);
            assert.equal(debtor.isBankrupt, true);
        }
        // The final seat is the only survivor and therefore the winner.
        assert.equal(game.status, 'ended');
        assert.equal(game.winner.id, winner.id);
        assert.equal(game.phase, 'ended');
        assert.equal(game.getPublicState().players.filter(player => !player.isBankrupt).length, 1);
    }
});
