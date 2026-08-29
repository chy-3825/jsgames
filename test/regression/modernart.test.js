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

test('Modern Art keeps hands private and resolves an auction', () => {
    const game = new ModernArtEngine('modernart', players(['a', 'b', 'c']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.getPlayerState('a').myHand.length, 10);
    assert.equal(game.getPublicState().players[0].handCount, 10);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: 0, auctionType: 'open' }).success, true);
    for (const [id, amount] of [['b', 10], ['c', 12], ['a', 0], ['b', 0]]) assert.equal(game.handleAction(id, { kind: 'bid', amount }).success, true);
    assert.equal(game.players[2].collection.length, 1);
    assert.equal(game.players[0].cash, 112);
});

test('Modern Art fixed-price auctions require a price and sell to the first accepter', () => {
    const game = new ModernArtEngine('modernart-fixed', players(['a', 'b', 'c']), () => 0);
    game.start();
    const fixedIndex = game.players[0].hand.findIndex(card => card.auctionType === 'fixed');
    assert.notEqual(fixedIndex, -1);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: fixedIndex }).success, false);
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: fixedIndex, amount: 20 }).success, true);
    assert.equal(game.handleAction('b', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.handleAction('c', { kind: 'bid', amount: 20 }).success, true);
    assert.equal(game.players[2].collection.length, 1);
    assert.equal(game.players[0].cash, 120);
});

test('Modern Art uses the official hand sizes and supports double auctions', () => {
    for (const [count, handSize] of [[3, 10], [4, 9], [5, 8]]) {
        const game = new ModernArtEngine(`modernart-size-${count}`, players(Array.from({ length: count }, (_, index) => String(index))), () => 0); game.start();
        assert.equal(game.players[0].hand.length, handSize); assert.equal(game.deck.length, 70 - count * handSize);
    }
    const game = new ModernArtEngine('modernart-double', players(['a', 'b', 'c']), () => 0); game.start();
    game.players[0].hand = [{ id: 'a1', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'double' }, { id: 'a2', artistId: 'matisse', artistName: '马蒂斯', auctionType: 'sealed' }]; game.currentSellerIndex = 0;
    assert.equal(game.handleAction('a', { kind: 'startAuction', cardIndex: 0, secondCardIndex: 1 }).success, true);
    assert.equal(game.handleAction('b', { kind: 'bid', amount: 10 }).success, true);
    assert.equal(game.handleAction('c', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.handleAction('a', { kind: 'bid', amount: 0 }).success, true);
    assert.equal(game.players[1].collection.length, 2); assert.equal(game.roundSales.length, 2);
});

test('Modern Art completes all four rounds with five players', () => {
    const game = new ModernArtEngine('modernart-full-five', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    let steps = 0;
    while (game.status === 'playing' && steps++ < 2000) {
        if (game.phase === 'auction') {
            const seller = game.players[game.currentSellerIndex];
            const cardIndex = seller.hand.findIndex((card, index) => card.auctionType !== 'double' || seller.hand.some((other, otherIndex) => otherIndex !== index && other.artistId === card.artistId && other.auctionType !== 'double'));
            const chosenIndex = cardIndex < 0 ? 0 : cardIndex;
            const chosen = seller.hand[chosenIndex];
            const action = { kind: 'startAuction', cardIndex: chosenIndex };
            if (chosen.auctionType === 'double') {
                const secondIndex = seller.hand.findIndex((other, index) => index !== chosenIndex && other.artistId === chosen.artistId && other.auctionType !== 'double');
                if (secondIndex >= 0) action.secondCardIndex = secondIndex;
            }
            if (chosen.auctionType === 'fixed') action.amount = 1;
            assert.equal(game.handleAction(seller.id, action).success, true);
        } else if (game.phase === 'bidding') {
            const bidder = game.players[game.auction.currentBidderIndex];
            let amount;
            if (game.auction.type === 'fixed') amount = bidder.id === game.auction.sellerId ? 0 : game.auction.fixedPrice;
            else if (game.auction.type === 'sealed') amount = 1;
            else amount = game.auction.highestBid === 0 ? 1 : 0;
            assert.equal(game.handleAction(bidder.id, { kind: 'bid', amount }).success, true);
        }
    }
    assert.equal(game.status, 'ended');
    assert.equal(game.round, 4);
    assert.ok(game.winner);
    assert.ok(steps < 2000);
});

