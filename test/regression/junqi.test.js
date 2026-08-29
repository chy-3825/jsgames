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

test('Junqi starts with hidden opponent pieces and player-specific views', () => {
    const session = Junqi.create('junqi-hidden', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const swapA = game.setup.a.pieces.find(piece => piece.type === 'company');
    const swapB = game.setup.a.pieces.find(piece => piece.type === 'platoon');
    const beforeA = { x: swapA.x, y: swapA.y }; const beforeB = { x: swapB.x, y: swapB.y };
    assert.equal(session.handleAction('a', { kind: 'setupSwap', pieceId: swapA.id, targetPieceId: swapB.id }).success, true);
    assert.deepEqual({ x: swapA.x, y: swapA.y }, beforeB); assert.deepEqual({ x: swapB.x, y: swapB.y }, beforeA);
    const flag = game.setup.a.pieces.find(piece => piece.type === 'flag');
    assert.equal(session.handleAction('a', { kind: 'setupSwap', pieceId: flag.id, targetPieceId: swapA.id }).success, false);
    const placeAll = (playerId, color) => {
        const rows = color === 'red' ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        const camps = new Set([[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]].map(([x, y]) => `${x},${y}`));
        const cells = rows.flatMap(y => Array.from({ length: 5 }, (_, x) => ({ x, y }))).filter(cell => !camps.has(`${cell.x},${cell.y}`));
        const hq = color === 'red' ? { x: 1, y: 11 } : { x: 1, y: 0 };
        const entry = game.setup[playerId];
        assert.equal(session.handleAction(playerId, { kind: 'setupReset' }).success, true);
        const pieces = [...entry.pieces].sort((a, b) => (a.type === 'flag' ? -1 : b.type === 'flag' ? 1 : a.type === 'mine' ? -1 : b.type === 'mine' ? 1 : a.type === 'bomb' ? -1 : b.type === 'bomb' ? 1 : 0));
        const used = new Set();
        for (const piece of pieces) {
            let cell = cells.find(candidate => !used.has(`${candidate.x},${candidate.y}`) && (piece.type !== 'flag' || candidate.x === hq.x && candidate.y === hq.y) && (piece.type !== 'mine' || (color === 'red' ? candidate.y >= 10 : candidate.y <= 1)) && (piece.type !== 'bomb' || candidate.y !== (color === 'red' ? 6 : 5)));
            assert.ok(cell, `${color} 没有可用布阵位置`);
            used.add(`${cell.x},${cell.y}`);
            assert.equal(session.handleAction(playerId, { kind: 'setupPlace', pieceId: piece.id, x: cell.x, y: cell.y }).success, true);
        }
        assert.equal(session.handleAction(playerId, { kind: 'setupReady' }).success, true);
    };
    placeAll('a', 'red');
    const redSetup = session.getPlayerState('a');
    const hiddenDuringSetup = session.getPlayerState('b');
    assert.equal(redSetup.setup.pieces.filter(piece => piece.placed).length, 25);
    assert.equal(hiddenDuringSetup.pieces.length, 25);
    placeAll('b', 'blue');
    const red = session.getPlayerState('a');
    const blue = session.getPlayerState('b');
    assert.equal(game.phase, 'play');
    assert.equal(red.pieces.length, 50);
    assert.equal(red.pieces.filter(piece => piece.ownerId === 'a' && piece.type !== 'unknown').length, 25);
    assert.equal(red.pieces.filter(piece => piece.ownerId === 'b' && piece.type === 'unknown').length, 25);
    assert.equal(blue.pieces.filter(piece => piece.ownerId === 'b' && piece.type !== 'unknown').length, 25);
    assert.equal(blue.pieces.filter(piece => piece.ownerId === 'a' && piece.type === 'unknown').length, 25);
    const movingChoice = Object.entries(red.legalMoves).flatMap(([id, moves]) => moves.map(to => ({ id, to }))).find(({ to }) => !game.board.has(`${to.x},${to.y}`));
    assert.ok(movingChoice, '应该存在至少一个不交战的普通移动');
    const movingPiece = red.pieces.find(piece => piece.id === movingChoice.id);
    const acknowledgement = session.handleAction('a', { kind: 'move', from: { x: movingPiece.x, y: movingPiece.y }, to: movingChoice.to });
    assert.equal(acknowledgement.success, true);
    assert.equal(acknowledgement.state.pieces.filter(piece => piece.ownerId === 'b' && piece.type !== 'unknown').length, 0);
    assert.equal(session.getPlayerState('b').actionLog.at(-1).includes(movingPiece.label), false);
});

test('Junqi default formation exposes a legal capture', () => {
    const session = Junqi.create('junqi-default-capture', players(['a', 'b']));
    assert.equal(session.start().success, true);
    assert.equal(session.handleAction('a', { kind: 'setupReady' }).success, true);
    assert.equal(session.handleAction('b', { kind: 'setupReady' }).success, true);
    const state = session.getPlayerState('a');
    const choice = Object.entries(state.legalMoves).flatMap(([id, moves]) => moves.map(to => ({ id, to }))).find(({ to }) => session.engine.board.get(`${to.x},${to.y}`)?.color === 'blue');
    assert.ok(choice, '默认布阵应该至少提供一个可攻击目标');
    const attacker = state.pieces.find(piece => piece.id === choice.id);
    const defender = session.engine.board.get(`${choice.to.x},${choice.to.y}`);
    const result = session.handleAction('a', { kind: 'move', from: { x: attacker.x, y: attacker.y }, to: choice.to });
    assert.equal(result.success, true);
    assert.equal(session.engine.lastMove.capture.defenderType, defender.type);
});

test('Junqi resolves rank battles, engineer mines, bombs, and protects camps', () => {
    const session = Junqi.create('junqi-battle', players(['a', 'b'])); session.start(); const game = session.engine; game.phase = 'play'; game.setup.a.ready = true; game.setup.b.ready = true;
    game.board = new Map([
        ['0,6', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 0, y: 6, revealed: false }],
        ['0,5', { id: 'b-company', ownerId: 'b', color: 'blue', type: 'company', x: 0, y: 5, revealed: false }],
        ['1,7', { id: 'a-engineer', ownerId: 'a', color: 'red', type: 'engineer', x: 1, y: 7, revealed: false }],
        ['1,4', { id: 'b-engineer', ownerId: 'b', color: 'blue', type: 'engineer', x: 1, y: 4, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(game.board.get('0,5').type, 'commander');
    assert.equal(game.lastMove.capture.defenderType, 'company');

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['1,6', { id: 'a-eng', ownerId: 'a', color: 'red', type: 'engineer', x: 1, y: 6, revealed: false }],
        ['1,5', { id: 'b-mine', ownerId: 'b', color: 'blue', type: 'mine', x: 1, y: 5, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['0,6', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 0, y: 6, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 1, y: 6 }, to: { x: 1, y: 5 } }).success, true);
    assert.equal(game.board.get('1,5').type, 'engineer');

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['0,6', { id: 'a-bomb', ownerId: 'a', color: 'red', type: 'bomb', x: 0, y: 6, revealed: false }],
        ['0,5', { id: 'b-army', ownerId: 'b', color: 'blue', type: 'army', x: 0, y: 5, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['1,4', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 1, y: 4, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(game.board.has('0,5'), false);

    game.turn = 'red'; game.currentTurnIndex = 0;
    game.board = new Map([
        ['2,3', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 2, y: 3, revealed: false }],
        ['1,2', { id: 'b-company', ownerId: 'b', color: 'blue', type: 'company', x: 1, y: 2, revealed: false }],
        ['2,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 2, y: 11, revealed: false }],
        ['2,0', { id: 'b-flag', ownerId: 'b', color: 'blue', type: 'flag', x: 2, y: 0, revealed: false }],
        ['0,4', { id: 'b-eng', ownerId: 'b', color: 'blue', type: 'engineer', x: 0, y: 4, revealed: false }],
    ]);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 2, y: 3 }, to: { x: 1, y: 2 } }).success, false);
});

test('Junqi uses camp diagonals, official rail crossings, and reveals the flag after commander loss', () => {
    const session = Junqi.create('junqi-board', players(['a', 'b'])); session.start(); const game = session.engine;
    assert.equal(game._isRailEdge(0, 5, 0, 6), true);
    assert.equal(game._isRailEdge(1, 5, 1, 6), false);
    assert.equal(game._isRailEdge(0, 1, 1, 1), true);
    assert.equal(game._isRailEdge(0, 0, 0, 1), false);
    const campPiece = { id: 'a-scout', ownerId: 'a', color: 'red', type: 'company', x: 2, y: 8, revealed: false };
    game.board = new Map([
        ['2,8', campPiece], ['0,7', { id: 'a-block', ownerId: 'a', color: 'red', type: 'company', x: 0, y: 7, revealed: false }],
        ['1,11', { id: 'a-flag', ownerId: 'a', color: 'red', type: 'flag', x: 1, y: 11, revealed: false }],
        ['0,9', { id: 'a-cmd', ownerId: 'a', color: 'red', type: 'commander', x: 0, y: 9, revealed: false }]
    ]);
    assert.ok(game._legalMoves(campPiece).some(move => move.to.x === 1 && move.to.y === 7));
    game._remove(game.board.get('0,9'));
    assert.equal(game.board.get('1,11').revealed, true);
});

test('Junqi completes a full setup-to-result game with legal moves', () => {
    const session = Junqi.create('junqi-full', players(['a', 'b']));
    assert.equal(session.start().success, true);
    const game = session.engine;
    const placeAll = (playerId, color) => {
        const rows = color === 'red' ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];
        const camps = new Set([[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]].map(([x, y]) => `${x},${y}`));
        const cells = rows.flatMap(y => Array.from({ length: 5 }, (_, x) => ({ x, y }))).filter(cell => !camps.has(`${cell.x},${cell.y}`));
        const hq = color === 'red' ? { x: 1, y: 11 } : { x: 1, y: 0 };
        assert.equal(session.handleAction(playerId, { kind: 'setupReset' }).success, true);
        const pieces = [...game.setup[playerId].pieces].sort((a, b) => (a.type === 'flag' ? -1 : b.type === 'flag' ? 1 : a.type === 'mine' ? -1 : b.type === 'mine' ? 1 : a.type === 'bomb' ? -1 : b.type === 'bomb' ? 1 : 0));
        const used = new Set();
        for (const piece of pieces) {
            const cell = cells.find(candidate => !used.has(`${candidate.x},${candidate.y}`) && (piece.type !== 'flag' || (candidate.x === hq.x && candidate.y === hq.y)) && (piece.type !== 'mine' || (color === 'red' ? candidate.y >= 10 : candidate.y <= 1)) && (piece.type !== 'bomb' || candidate.y !== (color === 'red' ? 6 : 5)));
            assert.ok(cell);
            used.add(`${cell.x},${cell.y}`);
            assert.equal(session.handleAction(playerId, { kind: 'setupPlace', pieceId: piece.id, x: cell.x, y: cell.y }).success, true);
        }
        assert.equal(session.handleAction(playerId, { kind: 'setupReady' }).success, true);
    };
    placeAll('a', 'red'); placeAll('b', 'blue');
    assert.equal(game.phase, 'play');
    let moves = 0;
    while (game.status === 'playing' && moves < 1000) {
        const player = game.players[game.currentTurnIndex];
        const options = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece));
        assert.ok(options.length);
        const move = options[(moves * 17) % options.length];
        assert.equal(session.handleAction(player.id, { kind: 'move', from: move.from, to: move.to }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner); assert.ok(moves < 1000);
});

