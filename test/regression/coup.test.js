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

test('Coup ambassador exchange requires an explicit private keep selection', () => {
    const session = Coup.create('exchange', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].influences = ['duke', 'captain']; game.players[0].revealed = [false, false]; game.deck = ['assassin', 'contessa', 'duke'];
    assert.equal(session.handleAction('a', { kind: 'exchange' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    const privateState = session.getPlayerState('a'); const publicState = session.getPlayerState('b');
    assert.equal(privateState.exchange.isMyTurn, true); assert.equal(privateState.exchange.options.length, 4);
    assert.deepEqual(privateState.exchange.options.map(card => card.index), [0, 1, 2, 3]);
    assert.equal(publicState.exchange.isMyTurn, false); assert.equal(publicState.exchange.options, null);
    assert.equal(session.handleAction('a', { kind: 'exchangeSelect', keepIndices: [2, 3] }).success, true);
    assert.deepEqual(game.players[0].influences, ['duke', 'contessa']);
});

test('Coup lets assassination target block with Contessa before influence loss', () => {
    const session = Coup.create('contessa-block', players(['a', 'b', 'c']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[1].influences = ['contessa', 'duke']; game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'block'); assert.equal(session.getPlayerState('b').challenge.isMyTurn, true);
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('c', { kind: 'pass' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'idle'); assert.equal(game.players[1].revealed[0], false); assert.equal(game.players[0].coins, 0);
});

test('Coup cancels a challenged bluff instead of executing it', () => {
    const session = Coup.create('failed-claim', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.phase = 'idle'; game.currentTurnIndex = 0; game.players[0].coins = 0; game.players[0].influences = ['captain', 'assassin']; game.players[0].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'tax' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'cancel' }).success, true);
    assert.equal(game.phase, 'influence_loss');
    assert.equal(session.handleAction('a', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.players[0].coins, 0); assert.equal(game.phase, 'idle');
});

test('Coup charges assassination before challenge resolution', () => {
    const session = Coup.create('assassination-fee', players(['a', 'b', 'c']));
    session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[0].influences = ['captain', 'ambassador'];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(game.players[0].coins, 0);
    assert.equal(session.handleAction('b', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'cancel' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.players[0].coins, 0);
});

test('Coup executes assassination after a challenged Contessa bluff', () => {
    const session = Coup.create('bluff-contessa', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.currentTurnIndex = 0; game.players[0].coins = 3; game.players[0].influences = ['assassin', 'duke'];
    game.players[1].influences = ['captain', 'duke']; game.players[1].revealed = [false, false];
    assert.equal(session.handleAction('a', { kind: 'assassinate', targetId: 'b' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'pass' }).success, true);
    assert.equal(game.phase, 'block');
    assert.equal(session.handleAction('b', { kind: 'block' }).success, true);
    assert.equal(session.handleAction('a', { kind: 'challenge' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'cancel' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'influence_loss', influenceIndex: 0 }).success, true);
    assert.equal(game.phase, 'influence_loss');
    assert.equal(session.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 }).success, true);
    assert.equal(game.gameOver, true);
    assert.equal(game.winner, 'a');
    assert.equal(game.players[0].coins, 0);
});

test('Coup completes a six-player base-rule match through coups and influence loss', () => {
    const session = Coup.create('coup-full-six', players(['a', 'b', 'c', 'd', 'e', 'f']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    let steps = 0;
    while (!game.gameOver && steps++ < 1000) {
        if (game.phase === 'idle') {
            const current = game.players[game.currentTurnIndex];
            const target = game.players.find(player => player.id !== current.id && game.isPlayerAlive(player.id));
            const action = current.coins >= 7 ? { kind: 'coup', targetId: target.id } : { kind: 'income' };
            assert.equal(session.handleAction(current.id, action).success, true);
        } else if (game.phase === 'influence_loss') {
            const id = game.pendingInfluenceLoss.playerId;
            const player = game.players.find(item => item.id === id);
            const index = player.revealed.findIndex(revealed => !revealed);
            assert.notEqual(index, -1);
            assert.equal(session.handleAction(id, { kind: 'influence_loss', influenceIndex: index }).success, true);
        } else if (game.phase === 'challenge') {
            const id = game.challengeQueue[game.challengeIndex];
            assert.equal(session.handleAction(id, { kind: 'pass' }).success, true);
        } else if (game.phase === 'block') {
            const id = game.challengeQueue[game.challengeIndex];
            assert.equal(session.handleAction(id, { kind: 'pass' }).success, true);
        } else if (game.phase === 'exchange') {
            const id = game.pendingExchange.playerId;
            const view = session.getPlayerState(id);
            const keep = Array.from({ length: view.exchange.keepCount }, (_, index) => index);
            assert.equal(session.handleAction(id, { kind: 'exchangeSelect', keepIndices: keep }).success, true);
        } else {
            assert.fail(`unexpected Coup phase: ${game.phase}`);
        }
    }
    assert.equal(game.gameOver, true);
    assert.ok(game.winner);
    assert.ok(steps < 1000);
});

test('Coup exposes a revealed role to every player', () => {
    const session = Coup.create('revealed-role', players(['a', 'b']));
    session.start();
    session.engine.players[0].revealed[0] = true;
    const card = session.getPlayerState('b').players.find(player => player.id === 'a').influences[0];
    assert.equal(card.revealed, true);
    assert.equal(card.role, session.engine.players[0].influences[0]);
});

test('Coup coup target chooses the influence to reveal', () => {
    const session = Coup.create('coup', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 7; game.players[1].revealed = [false, false];
    const coup = game.handleAction('a', { kind: 'coup', targetId: 'b' });
    assert.equal(coup.success, true); assert.equal(game.phase, 'influence_loss');
    const choice = game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });
    assert.equal(choice.success, true); assert.equal(game.players[1].revealed[1], true); assert.equal(game.players[1].revealed[0], false);
});

test('Coup assassination target chooses the influence to reveal', () => {
    const session = Coup.create('assassination', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 5;
    const action = game.handleAction('a', { kind: 'assassinate', targetId: 'b' });
    assert.equal(action.success, true); assert.equal(game.phase, 'challenge');
    const pass = game.handleAction('b', { kind: 'pass' });
    assert.equal(pass.success, true); assert.equal(game.phase, 'block');
    assert.equal(game.handleAction('b', { kind: 'pass' }).success, true); assert.equal(game.phase, 'influence_loss');
    const choice = game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });
    assert.equal(choice.success, true); assert.equal(game.players[1].revealed[1], true); assert.equal(game.players[1].revealed[0], false);
});

test('Coup keeps a completed match in an explicit ended phase with final reveals', () => {
    const session = Coup.create('coup-ended-pause', players(['a', 'b']));
    session.start(); const game = session.engine;
    game.players[0].coins = 7;
    game.players[1].influences = ['duke', 'contessa']; game.players[1].revealed = [false, true];
    assert.equal(session.handleAction('a', { kind: 'coup', targetId: 'b' }).success, true);
    const result = session.handleAction('b', { kind: 'influence_loss', influenceIndex: 0 });
    assert.equal(result.success, true);
    assert.equal(game.gameOver, true); assert.equal(game.phase, 'ended');
    assert.equal(game.pendingInfluenceLoss, null); assert.equal(game.pendingAction, null);
    const finalState = session.getPlayerState('a');
    assert.equal(finalState.influenceLoss, undefined);
    assert.equal(finalState.players.find(player => player.id === 'b').influences[0].role, 'duke');
    assert.equal(finalState.players.find(player => player.id === 'b').influences[1].role, 'contessa');
});

