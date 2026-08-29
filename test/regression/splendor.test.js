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

test('Splendor builds a 90-card market and scales token supply', () => {
    const cards = SplendorEngine.buildCards();
    assert.equal(cards.length, 90);
    assert.equal(new Set(cards.map(card => card.id)).size, 90);
    assert.deepEqual(cards.find(card => card.id === 's1-white-L1-02'), { id: 's1-white-L1-02', tier: 1, bonus: 'white', points: 1, cost: { green: 4 } });
    assert.deepEqual(cards.find(card => card.id === 's3-black-L3-04'), { id: 's3-black-L3-04', tier: 3, bonus: 'black', points: 5, cost: { red: 7, black: 3 } });
    const session = Splendor.create('splendor', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.engine.tokens.white, 4);
    assert.equal(session.engine.market[1].length, 4);
    assert.equal(session.engine.nobles.length, 3);
});

test('Splendor validates token actions and keeps private reservations private', () => {
    const session = Splendor.create('splendor-actions', players(['a', 'b']), { startingPlayerId: 'a' }); session.start(); const game = session.engine;
    assert.equal(session.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue', 'green'] }).success, true);
    assert.equal(game.players[0].tokens.white, 1);
    assert.equal(session.handleAction('b', { kind: 'takeTokens', colors: ['red', 'red'] }).success, true);
    assert.equal(game.players[1].tokens.red, 2);
    const card = game.market[1][0]; game.currentTurnIndex = 0;
    assert.equal(session.handleAction('a', { kind: 'reserveCard', cardId: card.id }).success, true);
    assert.equal(session.getPlayerState('a').myReserved.length, 1);
    assert.equal(session.getPlayerState('b').myReserved.length, 0);
});

test('Splendor follows the official token-taking shortage rules', () => {
    const game = new SplendorEngine('splendor-tokens', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white'] }).success, false);
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue', 'green'] }).success, true);
    game.currentTurnIndex = 0;
    game.tokens = { white: 1, blue: 1, green: 0, red: 0, black: 0, gold: 5 };
    assert.equal(game.handleAction('a', { kind: 'takeTokens', colors: ['white', 'blue'] }).success, true);
    assert.equal(game.players[0].tokens.white >= 1, true);
});

test('Splendor forces excess gems to be returned after taking or reserving', () => {
    const game = new SplendorEngine('splendor-return', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    game.players[0].tokens = { white: 9, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    game.tokens.white = 7; game.tokens.blue = 7; game.tokens.green = 7; game.tokens.red = 7; game.tokens.black = 7;
    const take = game.handleAction('a', { kind: 'takeTokens', colors: ['blue', 'green', 'red'] });
    assert.equal(take.success, true);
    assert.equal(game.phase, 'return_tokens');
    assert.equal(game.pendingTokenReturn.amount, 2);
    assert.equal(game.currentTurnIndex, 0);
    assert.equal(game.handleAction('a', { kind: 'returnTokens', colors: ['white', 'white'] }).success, true);
    assert.equal(game.phase, 'action');
    assert.equal(game._tokenTotal(game.players[0]) <= 10, true);

    game.currentTurnIndex = 0;
    game.players[0].tokens = { white: 10, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    game.tokens.gold = 1;
    const card = game.market[1][0];
    assert.equal(game.handleAction('a', { kind: 'reserveCard', cardId: card.id }).success, true);
    assert.equal(game.phase, 'return_tokens');
    assert.equal(game.pendingTokenReturn.amount, 1);
});

test('Splendor supports reserving a hidden top-deck card and resolves tied scoring', () => {
    const game = new SplendorEngine('splendor-deck-reserve', players(['a', 'b']), () => 0, { startingPlayerId: 'a' });
    game.start();
    assert.equal(game.handleAction('a', { kind: 'reserveCard', tier: 2 }).success, true);
    assert.equal(game.players[0].reserved.length, 1);
    assert.equal(game.getPlayerState('a').myReserved.length, 1);
    assert.equal(game.getPlayerState('b').myReserved.length, 0);
    game.status = 'playing'; game.phase = 'action'; game.currentTurnIndex = 0; game.finalRoundStart = 0;
    game.players[0].points = 15; game.players[1].points = 15;
    game.players[0].cards = game.players[0].cards.slice(0, 1); game.players[1].cards = game.players[1].cards.slice(0, 1);
    const result = game._finishGame('points');
    assert.equal(result.success, true);
    assert.equal(game.winner, null);
    assert.equal(game.winners.length, 2);
});

test('Splendor completes a deterministic four-player game through nobles and the final round', () => {
    const game = new SplendorEngine('splendor-full', players(['a', 'b', 'c', 'd']), () => 0); game.start();
    let steps = 0;
    while (game.status === 'playing' && steps < 1000) {
        const current = game.players[game.currentTurnIndex];
        let result;
        if (game.pendingTokenReturn) {
            const toReturn = [];
            for (const color of [...SplendorEngine.COLORS, 'gold']) {
                for (let count = 0; count < current.tokens[color] && toReturn.length < game.pendingTokenReturn.amount; count += 1) toReturn.push(color);
            }
            result = game.handleAction(current.id, { kind: 'returnTokens', colors: toReturn });
        } else if (game.pendingNoble) result = game.handleAction(current.id, { kind: 'chooseNoble', nobleId: game.pendingNoble.options[0].id });
        else {
            const candidates = [...game.market[1], ...game.market[2], ...game.market[3], ...current.reserved];
            const discounts = Object.fromEntries(SplendorEngine.COLORS.map(color => [color, current.cards.filter(card => card.bonus === color).length]));
            const affordable = candidates.find(card => SplendorEngine.COLORS.every(color => Math.max(0, (card.cost[color] || 0) - discounts[color]) <= current.tokens[color] + current.tokens.gold));
            if (affordable) result = game.handleAction(current.id, { kind: 'buyCard', cardId: affordable.id, fromReserve: current.reserved.some(card => card.id === affordable.id) });
            else {
                const available = SplendorEngine.COLORS.filter(color => game.tokens[color] > 0);
                const colors = available.length >= 3 ? available.slice(0, 3) : available;
                result = game.handleAction(current.id, { kind: 'takeTokens', colors });
            }
        }
        assert.equal(result.success, true, result.message); steps += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(steps < 1000); assert.ok(game.finalRoundStart !== null);
});

