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

function startAeroplane(session) {
    const started = session.start();
    if (!started.success) return started;
    const colors = ['blue', 'green', 'red', 'yellow'];
    session.engine.players.forEach((player, index) => {
        assert.equal(session.handleAction(player.id, { kind: 'selectColor', color: colors[index] }).success, true);
    });
    return started;
}

test('Aeroplane Chess assigns colors in the classic board corner order', () => {
    const session = Aeroplane.create('flight-board-colors', players(['a', 'b', 'c', 'd']));
    assert.equal(session.start().success, true);
    assert.equal(session.engine.status, 'selecting_color');
    session.engine.players.forEach((player, index) => assert.equal(session.handleAction(player.id, { kind: 'selectColor', color: ['blue', 'green', 'red', 'yellow'][index] }).success, true));
    assert.deepEqual(session.engine.players.map(player => player.color), ['blue', 'green', 'red', 'yellow']);
    assert.equal(session.start().success, false, '已开始的飞行棋不能重复开始');
    const tooMany = Aeroplane.create('flight-too-many', players(['a', 'b', 'c', 'd', 'e']));
    assert.equal(tooMany.engine.players.length, 5, '构造阶段不能静默截断第 5 名玩家');
    assert.equal(tooMany.start().success, false, '飞行棋只允许 2–4 名玩家');
});

test('Aeroplane Chess requires unique color choices before the first turn', () => {
    const session = Aeroplane.create('flight-color-choice', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, false);
    assert.equal(session.handleAction('a', { kind: 'selectColor', color: 'red' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'selectColor', color: 'red' }).success, false);
    assert.equal(session.handleAction('b', { kind: 'selectColor', color: 'yellow' }).success, true);
    assert.equal(session.engine.status, 'playing');
    assert.equal(session.engine.phase, 'await_roll');
});

test('Aeroplane Chess releases colors and cannot stall when a player leaves during color selection', () => {
    const session = Aeroplane.create('flight-color-leave', players(['a', 'b', 'c']));
    session.start();
    session.handleAction('a', { kind: 'selectColor', color: 'red' });
    session.handleAction('b', { kind: 'selectColor', color: 'yellow' });
    assert.equal(session.handlePlayerLeave('b').success, true);
    assert.equal(session.engine.playerMap.b.color, null);
    assert.equal(session.handleAction('c', { kind: 'selectColor', color: 'yellow' }).success, true);
    assert.equal(session.engine.status, 'playing');
    assert.equal(session.engine.getCurrentPlayer().id, 'a');
});

test('Aeroplane Chess enters the waiting point on six, then joins the main track on a later roll', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
        const session = Aeroplane.create('flight', players(['a', 'b']));
        const game = session.engine;
        assert.equal(startAeroplane(session).success, true);
        const roll = session.handleAction('a', { kind: 'rollDice' });
        assert.equal(roll.success, true); assert.equal(game.dice, 6); assert.equal(game.phase, 'choose_plane');
        assert.equal(game.lastAction.rollId, 1); assert.equal(game.getPublicState().lastAction.dice, 6);
        const launchedPlaneId = game.movablePlaneIds[0];
        const move = session.handleAction('a', { kind: 'movePlane', planeId: launchedPlaneId });
        assert.equal(move.success, true); assert.equal(game.planes[0].status, 'ready'); assert.equal(game.planes[0].progress, -1); assert.equal(game.planes[0].globalPosition, null);
        assert.deepEqual(game.lastAction.events, ['进入起飞等待点']); assert.equal(game.phase, 'await_roll');
        assert.equal(session.handleAction('a', { kind: 'rollDice' }).success, true); assert.equal(game.lastAction.rollId, 2);
        assert.equal(game.movablePlaneIds.includes(launchedPlaneId), true);
        assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: launchedPlaneId }).success, true);
        assert.equal(game.planes[0].status, 'flying'); assert.equal(game.planes[0].progress, 9); assert.equal(game.planes[0].globalPosition, 9);
    } finally { Math.random = originalRandom; }
});

test('Aeroplane Chess captures on landing and requires exact home arrival', () => {
    const session = Aeroplane.create('flight-rules', players(['a', 'b'])); startAeroplane(session); const game = session.engine;
    const red = game.planes.find(plane => plane.id === 'a-plane-1'); const blue = game.planes.find(plane => plane.id === 'b-plane-1');
    red.progress = 0; red.status = 'flying'; red.globalPosition = 0; blue.progress = 45; blue.status = 'flying'; blue.globalPosition = 6;
    game.phase = 'choose_plane'; game.dice = 6; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true); assert.equal(blue.status, 'base');
    red.progress = 52; red.status = 'home'; red.globalPosition = null; game.phase = 'choose_plane'; game.dice = 3; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true); assert.equal(red.status, 'finished'); assert.equal(red.progress, 55);
});

test('Aeroplane Chess turns into the home lane after 50 shared-route cells', () => {
    const session = Aeroplane.create('flight-home-entry', players(['a', 'b'])); startAeroplane(session); const game = session.engine;
    const plane = game.planes.find(item => item.id === 'a-plane-1');
    plane.progress = 49; plane.status = 'flying'; plane.globalPosition = 49;
    game.phase = 'choose_plane'; game.dice = 1; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 50);
    assert.equal(plane.status, 'home');
    assert.equal(plane.globalPosition, null);
});

test('Aeroplane Chess maps every home-lane step and finish to a board position', async () => {
    const { planePosition } = await import('../../public/games/aeroplane/state.js');
    for (const color of ['blue', 'green', 'red', 'yellow']) {
        for (let progress = 50; progress <= 54; progress += 1) {
            const point = planePosition({ color, status: 'home', progress });
            assert.equal(Array.isArray(point), true, `${color} progress ${progress} should have a home-lane position`);
            assert.equal(point.length, 2);
        }
        assert.equal(planePosition({ color, status: 'finished', progress: 55 }).length, 2);
    }
});

test('Aeroplane Chess protects a two-plane enemy stack', () => {
    const session = Aeroplane.create('flight-stack', players(['a', 'b'])); startAeroplane(session); const game = session.engine;
    const red = game.planes.find(plane => plane.id === 'a-plane-1');
    const blue = game.planes.filter(plane => plane.playerId === 'b').slice(0, 2);
    red.progress = 0; red.status = 'flying'; red.globalPosition = 0;
    blue.forEach(plane => { plane.progress = 45; plane.status = 'flying'; plane.globalPosition = 6; });
    game.phase = 'choose_plane'; game.dice = 6; game.movablePlaneIds = [red.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: red.id }).success, true);
    assert.equal(blue.every(plane => plane.status === 'flying'), true);
});

test('Aeroplane Chess applies direct flight-line chaining and jump-to-flight stopping', () => {
    const session = Aeroplane.create('flight-lines', players(['a', 'b'])); startAeroplane(session); const game = session.engine;
    const plane = game.planes.find(item => item.id === 'a-plane-1'); plane.progress = 12; plane.status = 'flying'; plane.globalPosition = 12;
    game.phase = 'choose_plane'; game.dice = 5; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 33);
    assert.deepEqual(game.lastMove.path.map(step => step.progress), [13, 14, 15, 16, 17, 29, 33]);
    game.status = 'playing'; game.phase = 'choose_plane'; game.currentTurnIndex = 0; game.dice = 4;
    plane.progress = 9; plane.status = 'flying'; plane.globalPosition = 9; game.movablePlaneIds = [plane.id]; game.lastMove = null;
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 29);
    assert.deepEqual(game.lastMove.path.map(step => step.progress), [10, 11, 12, 13, 17, 29]);
});

test('Aeroplane Chess uses the board colour sequence for same-colour jumps', () => {
    const session = Aeroplane.create('flight-colour-jumps', players(['a', 'b'])); startAeroplane(session); const game = session.engine;
    assert.deepEqual(game.getPublicState().rules.jumpProgress, [1, 5, 9, 13, 21, 25, 29, 33, 37, 41, 45]);
    assert.equal(game.getPublicState().rules.flightProgress, 17);
    assert.equal(game.getPublicState().rules.flightDistance, 12);
    const plane = game.planes.find(item => item.id === 'a-plane-1');
    plane.progress = 0; plane.status = 'flying'; plane.globalPosition = 0;
    game.phase = 'choose_plane'; game.dice = 1; game.movablePlaneIds = [plane.id];
    assert.equal(session.handleAction('a', { kind: 'movePlane', planeId: plane.id }).success, true);
    assert.equal(plane.progress, 5);
    assert.equal(plane.globalPosition, 5);
    assert.deepEqual(game.lastMove.events, ['同色跳跃']);
});

test('Aeroplane Chess completes a full four-player game with all special movement rules', () => {
    const diceSequence = [6, 5, 6, 5, 3];
    let rollIndex = 0;
    const session = Aeroplane.create(
        'flight-full',
        players(['a', 'b', 'c', 'd']),
        () => diceSequence[rollIndex++ % diceSequence.length] / 6 - 0.0001,
    );
    const game = session.engine;
    assert.equal(startAeroplane(session).success, true);
    let actions = 0;
    let sawFlight = false;
    while (game.status === 'playing' && actions < 1000) {
        const current = game.getCurrentPlayer();
        const result = game.phase === 'await_roll'
            ? session.handleAction(current.id, { kind: 'rollDice' })
            : session.handleAction(current.id, { kind: 'movePlane', planeId: game.movablePlaneIds[0] });
        assert.equal(result.success, true, result.message);
        if (result.state.lastAction?.events?.some(event => event.includes('飞行线'))) sawFlight = true;
        actions += 1;
    }
    assert.equal(game.status, 'ended');
    assert.ok(game.winner);
    assert.equal(game.planes.filter(plane => plane.playerId === game.winner.id && plane.status === 'finished').length, 4);
    assert.equal(sawFlight, true);
    assert.ok(actions < 1000);
});
