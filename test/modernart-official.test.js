const assert = require('node:assert/strict');
const test = require('node:test');
const ModernArt = require('../server/games/modernart');
const Engine = require('../server/games/modernart/engine');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `art${index}`, name: `玩家${index + 1}` }));
}

function random(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

test('Modern Art enforces the official 3-5 player setup, 70-card deck and four-season lifecycle', () => {
    assert.equal(Engine.ARTISTS.reduce((sum, artist) => sum + artist.count, 0), 70);
    for (const [count, handSize] of [[3, 10], [4, 9], [5, 8]]) {
        const session = ModernArt.create(`modernart-setup-${count}`, players(count), null, { random: random(count) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        assert.equal(game.players.every(player => player.hand.length === handSize), true);
        assert.equal(game.deck.length, 70 - count * handSize);
        assert.deepEqual(game.artistValues, { matisse: 0, cassat: 0, yoshida: 0, bruegel: 0, clyfford: 0 });
        assert.deepEqual(game.getPublicState().roundCounts, { matisse: 0, cassat: 0, yoshida: 0, bruegel: 0, clyfford: 0 });
        assert.equal(game.presentation.resolved, true);
        assert.equal(game.presentation.events[0].kind, 'seasonStarted');
        assert.equal(game.presentation.events[0].seasonOpening, true);
        assert.equal(game.presentation.events[0].sellerId, game.players[game.currentSellerIndex].id);
        assert.deepEqual(game.presentation.events[0].handCounts.map(player => player.count), Array(count).fill(handSize));
        assert.equal(session.start().success, false);
    }
    assert.equal(ModernArt.create('modernart-too-small', players(2)).start().success, false);
    assert.equal(ModernArt.create('modernart-too-large', players(6)).start().success, false);
    const mystery = ModernArt.create('modernart-mystery-opening', players(3), null, { mysteryPlayer: true, random: random(19) });
    assert.equal(mystery.start().success, true);
    assert.equal(mystery.engine.presentation.events[0].mysteryEnabled, true);
    assert.equal(Object.prototype.hasOwnProperty.call(mystery.engine.presentation.events[0], 'hands'), false);
});

test('Modern Art supports other players taking over a double auction and keeps cumulative artist values', () => {
    const session = ModernArt.create('modernart-double-offer', players(3), null, { random: random(77) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.players[0].hand = [{ id: 'first', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'double' }];
    game.players[1].hand = [{ id: 'second', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'sealed' }];
    game.players[2].hand = [{ id: 'reserve', artistId: 'bruegel', artistName: '勃鲁盖尔', auctionType: 'open' }];
    game.currentSellerIndex = 0;
    assert.equal(session.handleAction('art0', { kind: 'startAuction', cardIndex: 0 }).success, true);
    assert.equal(game.phase, 'double_offer');
    assert.equal(session.handleAction('art0', { kind: 'passSecond' }).success, true);
    assert.equal(game.getPublicState().currentTurn, 'art1');
    assert.equal(session.handleAction('art1', { kind: 'offerSecond', cardIndex: 0 }).success, true);
    assert.equal(game.phase, 'bidding');
    assert.equal(game.auction.sellerId, 'art1');
    assert.equal(game.auction.cards.length, 2);
    for (const [id, amount] of [['art2', 5], ['art0', 5], ['art1', 0]]) assert.equal(session.handleAction(id, { kind: 'bid', amount }).success, true);
    assert.equal(game.players[2].collection.length, 2);
    assert.equal(game.players[1].cash, 105);

    game.round = 1;
    game.roundSales = [{ artistId: 'matisse' }, { artistId: 'matisse' }, { artistId: 'matisse' }, { artistId: 'matisse' }];
    game.players[0].collection = [{ artistId: 'matisse' }];
    game.players[1].collection = [{ artistId: 'cassat' }];
    game.artistValues.matisse = 30;
    game.artistValues.cassat = 20;
    game._finishRound();
    assert.equal(game.players[0].cash, 160);
    assert.equal(game.players[1].cash, 105, 'an artist outside this round\'s top three is worthless');
    assert.equal(game.artistValues.matisse, 60);
});

test('Modern Art completes three independent five-player four-season games', () => {
    for (const seed of [5201, 5202, 5203]) {
        const session = ModernArt.create(`modernart-full-${seed}`, players(5), null, { random: random(seed) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        let steps = 0;
        while (game.status === 'playing' && steps < 3000) {
            steps += 1;
            if (game.phase === 'auction') {
                const seller = game.players[game.currentSellerIndex];
                const cardIndex = seller.hand.findIndex((card, index) => card.auctionType !== 'double' || seller.hand.some((other, otherIndex) => otherIndex !== index && other.artistId === card.artistId && other.auctionType !== 'double'));
                const chosenIndex = cardIndex >= 0 ? cardIndex : 0;
                const chosen = seller.hand[chosenIndex];
                const action = { kind: 'startAuction', cardIndex: chosenIndex };
                if (chosen.auctionType === 'double') {
                    const secondIndex = seller.hand.findIndex((other, index) => index !== chosenIndex && other.artistId === chosen.artistId && other.auctionType !== 'double');
                    if (secondIndex >= 0) action.secondCardIndex = secondIndex;
                }
                if (chosen.auctionType === 'fixed') action.amount = 1;
                assert.equal(session.handleAction(seller.id, action).success, true);
            } else if (game.phase === 'double_offer') {
                const current = game.players[game.pendingDouble.currentPlayerIndex];
                const index = current.hand.findIndex(card => card.artistId === game.pendingDouble.first.artistId && card.auctionType !== 'double');
                const action = index >= 0 ? { kind: 'offerSecond', cardIndex: index } : { kind: 'passSecond' };
                assert.equal(session.handleAction(current.id, action).success, true);
            } else if (game.phase === 'bidding') {
                const bidder = game.players[game.auction.currentBidderIndex];
                let amount;
                if (game.auction.type === 'fixed') amount = bidder.id === game.auction.sellerId ? 0 : game.auction.fixedPrice;
                else if (game.auction.type === 'sealed') amount = bidder.id === game.auction.sellerId ? 0 : 1;
                else amount = game.auction.highestBid === 0 ? 1 : 0;
                assert.equal(session.handleAction(bidder.id, { kind: 'bid', amount }).success, true);
            } else throw new Error(`unexpected phase ${game.phase}`);
        }
        assert.equal(game.status, 'ended');
        assert.equal(game.round, 4);
        assert.ok(game.winner);
        assert.ok(steps < 3000);
        assert.equal(game.history.length, 4);
    }
});

test('Modern Art supports the optional three-player mystery-player variant', () => {
    const session = ModernArt.create('modernart-mystery', players(3), null, { random: random(901), mysteryPlayer: true });
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.mysteryEnabled, true);
    assert.deepEqual(game.players.map(player => player.hand.length), [9, 9, 9], 'variant deals as four players');
    assert.equal(game.mysteryHand.length, 9);
    assert.equal(game.getPublicState().mysteryCount, 9);

    const seller = game.players[game.currentSellerIndex];
    const cardIndex = seller.hand.findIndex(card => card.auctionType !== 'double');
    const card = seller.hand[cardIndex];
    const startAction = { kind: 'startAuction', cardIndex };
    if (card.auctionType === 'fixed') startAction.amount = 1;
    assert.equal(session.handleAction(seller.id, startAction).success, true);
    let guard = 0;
    while (game.phase === 'bidding' && guard++ < 20) {
        const bidder = game.players[game.auction.currentBidderIndex];
        assert.equal(session.handleAction(bidder.id, { kind: 'bid', amount: 0 }).success, true);
    }
    assert.equal(game.phase, 'mystery_offer');
    assert.equal(game.getPlayerState(seller.id).availableActions.revealMystery, true);
    assert.equal(session.handleAction(seller.id, { kind: 'revealMystery' }).success, true);
    assert.equal(game.mysteryHand.length, 8);
    assert.notEqual(game.phase, 'mystery_offer');
});

test('Modern Art skips empty sellers and leaves the final unauctioned painting out of the market', () => {
    const game = new Engine('modernart-final-card', players(3), random(902));
    assert.equal(game.start().success, true);
    game.players[0].hand = [{ id: 'auctioned', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' }];
    game.players[1].hand = [{ id: 'last', artistId: 'cassat', artistName: '卡萨特', auctionType: 'open' }];
    game.players[2].hand = [];
    game.currentSellerIndex = 0;
    assert.equal(game.handleAction('art0', { kind: 'startAuction', cardIndex: 0 }).success, true);
    for (const id of ['art1', 'art2', 'art0']) assert.equal(game.handleAction(id, { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.currentSellerIndex, 1, 'the player with no hand is skipped');
    assert.equal(game.handleAction('art1', { kind: 'startAuction', cardIndex: 0 }).success, true);
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].counts.cassat, 1, 'the final card still sets the artist ranking');
    assert.equal(game.history[0].market.length, 1, 'the final card is not auctioned');
});

test('Modern Art publishes a complete painting, bid and hammer presentation sequence', () => {
    const game = new Engine('modernart-presentation-auction', players(3), random(903));
    assert.equal(game.start().success, true);
    game.players[0].hand = [{ id: 'matisse-stage', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' }];
    game.players[1].hand = [{ id: 'cassat-reserve', artistId: 'cassat', artistName: '卡萨特', auctionType: 'once' }];
    game.players[2].hand = [{ id: 'yoshida-reserve', artistId: 'yoshida', artistName: '吉田', auctionType: 'sealed' }];
    game.currentSellerIndex = 0;

    assert.equal(game.handleAction('art0', { kind: 'startAuction', cardIndex: 0 }).success, true);
    let presentation = game.getPublicState().presentation;
    assert.equal(presentation.resolved, true);
    assert.deepEqual(presentation.events.map(event => event.kind), ['paintingPresented', 'auctionOpened']);
    assert.equal(presentation.events[0].card.id, 'matisse-stage');
    assert.equal(presentation.events[1].firstBidderId, 'art1');

    assert.equal(game.handleAction('art1', { kind: 'bid', amount: 5 }).success, true);
    presentation = game.getPublicState().presentation;
    assert.equal(presentation.events[0].kind, 'bidPlaced');
    assert.equal(presentation.events[0].amount, 5);
    assert.equal(game.handleAction('art2', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.handleAction('art0', { kind: 'bid', amount: 0 }).success, true);

    presentation = game.getPublicState().presentation;
    assert.deepEqual(presentation.events.map(event => event.kind), ['bidPassed', 'auctionResolved', 'sellerTurnStarted']);
    const hammer = presentation.events.find(event => event.kind === 'auctionResolved');
    assert.equal(hammer.buyerId, 'art1');
    assert.equal(hammer.sellerId, 'art0');
    assert.equal(hammer.price, 5);
    assert.deepEqual(hammer.cards.map(card => card.id), ['matisse-stage']);
});

test('Modern Art keeps sealed bids private until the hammer event', () => {
    const game = new Engine('modernart-presentation-sealed', players(3), random(904));
    assert.equal(game.start().success, true);
    game.players[0].hand = [{ id: 'sealed-work', artistId: 'cassat', artistName: '卡萨特', auctionType: 'sealed' }];
    game.players[1].hand = [{ id: 'reserve-one', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' }];
    game.players[2].hand = [{ id: 'reserve-two', artistId: 'yoshida', artistName: '吉田', auctionType: 'fixed' }];
    game.currentSellerIndex = 0;

    assert.equal(game.handleAction('art0', { kind: 'startAuction', cardIndex: 0 }).success, true);
    assert.equal(game.handleAction('art1', { kind: 'bid', amount: 7 }).success, true);
    let event = game.getPublicState().presentation.events[0];
    assert.equal(event.kind, 'sealedBidSubmitted');
    assert.equal(Object.hasOwn(event, 'amount'), false, 'a submitted sealed bid must not publish its amount');
    assert.equal(game.getPublicState().auction.highestBid, 0);
    assert.equal(game.getPublicState().auction.highestBidder, null);

    assert.equal(game.handleAction('art2', { kind: 'bid', amount: 2 }).success, true);
    event = game.getPublicState().presentation.events[0];
    assert.equal(Object.hasOwn(event, 'amount'), false);
    assert.equal(event.submitted, 2);

    assert.equal(game.handleAction('art0', { kind: 'bid', amount: 0 }).success, true);
    const presentation = game.getPublicState().presentation;
    const hammer = presentation.events.find(item => item.kind === 'auctionResolved');
    assert.ok(hammer, 'the final sealed bid must be followed by a hammer event');
    assert.deepEqual(hammer.sealedBids.map(bid => [bid.playerId, bid.amount]), [['art1', 7], ['art2', 2], ['art0', 0]]);
    assert.equal(hammer.buyerId, 'art1');
    assert.equal(hammer.price, 7);
});

test('Modern Art keeps season proceeds private and publishes the final standings', () => {
    const game = new Engine('modernart-presentation-season', players(3), random(905));
    assert.equal(game.start().success, true);
    game.roundSales = Array.from({ length: 4 }, (_, index) => ({ id: `matisse-sale-${index}`, artistId: 'matisse', artistName: '马蒂斯' }));
    game.players[0].collection = [{ id: 'owned-matisse', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' }];
    game.players[1].collection = [{ id: 'owned-cassat', artistId: 'cassat', artistName: '卡萨特', auctionType: 'once' }];
    game.players[0].hand = [{ id: 'fifth-matisse', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'open' }];
    game.players[1].hand = [{ id: 'next-season-reserve', artistId: 'cassat', artistName: '卡萨特', auctionType: 'sealed' }];
    game.players[2].hand = [{ id: 'next-season-reserve-two', artistId: 'yoshida', artistName: '吉田', auctionType: 'fixed' }];
    game.currentSellerIndex = 0;

    assert.equal(game.handleAction('art0', { kind: 'startAuction', cardIndex: 0 }).success, true);
    const publicPresentation = game.getPublicState().presentation;
    assert.deepEqual(publicPresentation.events.map(event => event.kind), ['paintingPresented', 'seasonTriggered', 'seasonSettlement', 'seasonStarted']);
    const publicSettlement = publicPresentation.events.find(event => event.kind === 'seasonSettlement');
    assert.equal(Object.hasOwn(publicSettlement, 'ownResult'), false);
    assert.equal(Object.hasOwn(publicSettlement.players[0], 'payout'), false);
    assert.equal(Object.hasOwn(publicSettlement.players[0], 'cashAfter'), false);

    const firstPlayerSettlement = game.getPlayerState('art0').presentation.events.find(event => event.kind === 'seasonSettlement').ownResult;
    const secondPlayerSettlement = game.getPlayerState('art1').presentation.events.find(event => event.kind === 'seasonSettlement').ownResult;
    assert.deepEqual({ playerId: firstPlayerSettlement.playerId, payout: firstPlayerSettlement.payout, cashBefore: firstPlayerSettlement.cashBefore, cashAfter: firstPlayerSettlement.cashAfter }, { playerId: 'art0', payout: 30, cashBefore: 100, cashAfter: 130 });
    assert.deepEqual({ playerId: secondPlayerSettlement.playerId, payout: secondPlayerSettlement.payout, cashBefore: secondPlayerSettlement.cashBefore, cashAfter: secondPlayerSettlement.cashAfter }, { playerId: 'art1', payout: 0, cashBefore: 100, cashAfter: 100 });

    game.round = 4;
    game.roundSales = [{ id: 'final-sale', artistId: 'bruegel', artistName: '勃鲁盖尔' }];
    game.players[0].cash = 155;
    game.players[1].cash = 142;
    game.players[2].cash = 155;
    game._startPresentation(null, 'final-test');
    game._finishRound({ kind: 'handsExhausted' });
    const finalPresentation = game.getPublicState().presentation;
    assert.equal(game.status, 'ended');
    assert.deepEqual(finalPresentation.events.map(event => event.kind), ['seasonTriggered', 'seasonSettlement', 'finalSettlement']);
    assert.deepEqual(game.winners.map(player => player.id), ['art0', 'art2']);
    assert.deepEqual(finalPresentation.events.at(-1).winnerIds, ['art0', 'art2']);
    assert.deepEqual(finalPresentation.events.at(-1).standings.map(player => player.fortune), [155, 155, 142]);
});
