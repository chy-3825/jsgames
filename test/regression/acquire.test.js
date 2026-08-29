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

test('Acquire builds a private six-tile hand and supports founding and buying shares', () => {
    assert.equal(AcquireEngine.buildTiles().length, 108);
    const session = Acquire.create('acquire', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(session.getPlayerState('a').myHand.length, 6);
    assert.equal(session.getPlayerState('b').myHand.length, 6);
    const firstPlayer = game.players[game.currentTurnIndex];
    const first = firstPlayer.hand[0];
    assert.equal(session.handleAction(firstPlayer.id, { kind: 'placeTile', tileId: first.id }).success, true);
    if (game.phase === 'foundation') {
        const chain = Object.values(game.corporations).find(corporation => !corporation.active);
        assert.equal(session.handleAction(firstPlayer.id, { kind: 'foundChain', chainId: chain.id }).success, true);
    }
    assert.equal(game.phase, 'buy');
    assert.equal(session.handleAction(firstPlayer.id, { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(game.currentTurnIndex, (game.players.indexOf(firstPlayer) + 1) % game.players.length);
});

test('Acquire merger keeps the largest chain and pays out acquired shares', () => {
    const session = Acquire.create('acquire-merger', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = ['A1', 'A2']; game.corporations.imperial.active = true; game.corporations.imperial.tiles = ['A4', 'A5', 'A6'];
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' }, A6: { id: 'A6', row: 0, col: 5, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }]; game.playerMap[currentId].shares.sackson = 2; game.corporations.sackson.sharesAvailable = 23;
    assert.equal(session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' }).success, true);
    assert.equal(game.phase, 'merger');
    assert.equal(session.handleAction(currentId, { kind: 'chooseMerger', chainId: 'imperial' }).success, true);
    assert.equal(game.phase, 'merger_settlement');
    assert.equal(session.handleAction(currentId, { kind: 'settleMergerShares', chainId: 'sackson', sell: 2, trade: 0, keep: 0 }).success, true);
    assert.equal(game.phase, 'buy');
    assert.equal(game.players[0].shares.sackson, 0);
    assert.ok(game.playerMap[currentId].cash > 6000);
});

test('Acquire allows a safe chain to absorb an open chain but protects two safe chains', () => {
    const session = Acquire.create('acquire-safe-chain', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true; game.corporations.imperial.tiles = ['A4', 'A5'];
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }];
    const result = session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' });
    assert.equal(result.success, true); assert.equal(game.phase, 'merger');
    game.pendingMerger = null; game.phase = 'place'; game.board.A3 = undefined; delete game.board.A3;
    game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }];
    const blocked = session.handleAction(currentId, { kind: 'placeTile', tileId: 'A3' });
    assert.equal(blocked.success, false); assert.equal(game.playerMap[currentId].hand.length, 1); assert.equal(game.phase, 'place');
});

test('Acquire uses the tiered official stock price chart', () => {
    const game = new AcquireEngine('acquire-prices', players(['a', 'b'])); game.start();
    for (const [id, tier] of [['sackson', 200], ['worldwide', 300], ['continental', 400]]) {
        game.corporations[id].active = true; game.corporations[id].tiles = ['A1', 'A2'];
        assert.equal(game._sharePrice(id), tier);
        game.corporations[id].tiles.push('A3', 'A4', 'A5', 'A6');
    }
    assert.equal(game._sharePrice('sackson'), 600); assert.equal(game._sharePrice('worldwide'), 700); assert.equal(game._sharePrice('continental'), 800);
});

test('Acquire uses the official corporation names and price tiers', () => {
    const ids = AcquireEngine.CHAINS.map(chain => chain.id);
    assert.equal(ids.includes('zeta'), false);
    assert.equal(AcquireEngine.CHAINS.find(chain => chain.id === 'imperial').name, '帝国');
    assert.equal(AcquireEngine.CHAIN_TIERS.tower, 'low');
    assert.equal(AcquireEngine.CHAIN_TIERS.worldwide, 'middle');
});

test('Acquire settles multiple acquired corporations from largest to smallest', () => {
    const game = new AcquireEngine('acquire-merger-order', players(['a', 'b']));
    game.start();
    game.corporations.continental.active = true; game.corporations.continental.tiles = ['A1', 'A2', 'A3', 'A4', 'A5'];
    game.corporations.worldwide.active = true; game.corporations.worldwide.tiles = ['B1', 'B2', 'B3', 'B4'];
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = ['C1', 'C2'];
    game.players[0].shares.worldwide = 1; game.players[0].shares.sackson = 1;
    game.pendingMerger = { playerId: 'a', chains: ['continental', 'sackson', 'worldwide'] };
    assert.equal(game._chooseMerger(game.players[0], 'continental').success, true);
    assert.equal(game.pendingMerger.queueChainId, 'worldwide');
    assert.equal(game._settleMergerShares(game.players[0], { chainId: 'worldwide', sell: 0, trade: 0, keep: 1 }).success, true);
    assert.equal(game.pendingMerger.queueChainId, 'sackson');
});

test('Acquire can discard an unplayable tile and continue to stock purchase', () => {
    const session = Acquire.create('acquire-discard', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true; game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' }, A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' } };
    const currentId = game.players[game.currentTurnIndex].id;
    game.playerMap[currentId].hand = [{ id: 'A3', row: 0, col: 2 }, ...game.playerMap[currentId].hand.filter(tile => tile.id !== 'A3').slice(0, 5)];
    const tileId = 'A3';
    assert.equal(session.handleAction(currentId, { kind: 'discardTile', tileId }).success, true);
    assert.equal(game.phase, 'buy');
    assert.equal(game.playerMap[currentId].hand.length, 5);
});

test('Acquire exposes the official end-game declaration conditions and liquidates stock value', () => {
    const session = Acquire.create('acquire-end', players(['a', 'b'])); session.start(); const game = session.engine;
    game.corporations.sackson.active = true; game.corporations.sackson.tiles = Array.from({ length: 41 }, (_, index) => `A${index + 1}`);
    game.players[0].shares.sackson = 3; game.players[0].cash = 5000; game.phase = 'buy'; game.currentTurnIndex = 0;
    assert.equal(game.getPlayerState('a').availableActions.canEndGame, true);
    assert.equal(session.handleAction('a', { kind: 'endGame' }).success, true);
    assert.equal(game.status, 'playing'); assert.equal(game.endGamePending, true);
    assert.equal(session.handleAction('a', { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'a'); assert.equal(game.players[0].cash, 23000); assert.equal(game.players[0].shares.sackson, 0);
});

test('Acquire completes a deterministic four-player tile, merger, stock, and liquidation game', () => {
    const game = new AcquireEngine('acquire-full', players(['a', 'b', 'c', 'd']), () => 0); game.start();
    let steps = 0;
    while (game.status === 'playing' && steps < 5000) {
        const current = game.phase === 'merger_settlement'
            ? game.playerMap[game.pendingMerger.queue[game.pendingMerger.queueIndex]]
            : game.players[game.currentTurnIndex];
        let result;
        if (game.phase === 'place') {
            const tile = current.hand[0];
            if (!tile) { result = game.handleAction(current.id, { kind: 'buyShares', orders: {} }); }
            else {
                result = game.handleAction(current.id, { kind: 'placeTile', tileId: tile.id });
                if (!result.success) result = game.handleAction(current.id, { kind: 'discardTile', tileId: tile.id });
            }
        } else if (game.phase === 'foundation') {
            const chain = Object.values(game.corporations).find(corporation => !corporation.active);
            result = game.handleAction(current.id, { kind: 'foundChain', chainId: chain.id });
        } else if (game.phase === 'merger') {
            const chainId = game.pendingMerger.chains.slice().sort((a, b) => game.corporations[b].tiles.length - game.corporations[a].tiles.length)[0];
            result = game.handleAction(current.id, { kind: 'chooseMerger', chainId });
        } else if (game.phase === 'merger_settlement') {
            const chainId = game.pendingMerger.queueChainId;
            result = game.handleAction(current.id, { kind: 'settleMergerShares', chainId, sell: current.shares[chainId], trade: 0, keep: 0 });
        } else if (game.phase === 'buy') {
            const chain = Object.values(game.corporations).find(corporation => corporation.active && corporation.sharesAvailable > 0);
            result = game.handleAction(current.id, { kind: 'buyShares', orders: chain ? { [chain.id]: 1 } : {} });
        }
        assert.equal(result?.success, true, result?.message);
        steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(steps < 5000); assert.equal(game.deck.length, 0);
});

