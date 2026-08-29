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

test('Xiangqi validates river crossing and alternates legal moves', () => {
    const session = Xiangqi.create('xiangqi-rules', players(['a', 'b'])); assert.equal(session.start().success, true);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }).success, true);
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }).success, false);
    assert.equal(session.handleAction('b', { kind: 'move', from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }).success, true);
    assert.equal(session.engine.turn, 'red');
});

test('Xiangqi warns after two consecutive checks and only penalizes long check on repetition', () => {
    const session = Xiangqi.create('xiangqi-check-warning', [{ id: 'a', name: '红方' }, { id: 'b', name: '黑方' }]);
    assert.equal(session.start().success, true);
    const game = session.engine;
    game.board = new Map([
        ['4,9', { id: 'rk', type: 'k', color: 'red' }],
        ['4,5', { id: 'rs', type: 's', color: 'red' }],
        ['3,1', { id: 'rr', type: 'r', color: 'red' }],
        ['4,0', { id: 'bk', type: 'k', color: 'black' }]
    ]);
    game.turn = 'red'; game.currentTurnIndex = 0; game.positionCounts.clear(); game._recordPosition();
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 3, y: 1 }, to: { x: 4, y: 1 } }).state.longCheckWarning, null);
    assert.equal(session.handleAction('b', { kind: 'move', from: { x: 4, y: 0 }, to: { x: 5, y: 0 } }).success, true);
    const warned = session.handleAction('a', { kind: 'move', from: { x: 4, y: 1 }, to: { x: 5, y: 1 } });
    assert.equal(warned.ended, false);
    assert.deepEqual(warned.state.longCheckWarning, { color: 'red', playerId: 'a', playerName: '红方', count: 2, message: '红方 已连续将军 2 次；再次形成三次重复局面，长将方判负' });
    assert.equal(warned.state.lastMove.gaveCheck, true);
    assert.equal(warned.state.lastMove.piece.id, 'rr');
    assert.deepEqual(warned.state.lastMove.checkingPieceIds, ['rr']);
    assert.match(warned.state.actionLog.at(-1), /连续将军 2 次/);

    const discovered = Xiangqi.create('xiangqi-discovered-check', players(['red', 'black'])); discovered.start();
    discovered.engine.board = new Map([
        ['3,9', { id: 'rk', type: 'k', color: 'red' }],
        ['4,5', { id: 'rr', type: 'r', color: 'red' }],
        ['4,3', { id: 'rs', type: 's', color: 'red' }],
        ['4,0', { id: 'bk', type: 'k', color: 'black' }]
    ]);
    discovered.engine.turn = 'red'; discovered.engine.currentTurnIndex = 0;
    const openedLine = discovered.handleAction('red', { kind: 'move', from: { x: 4, y: 3 }, to: { x: 3, y: 3 } });
    assert.equal(openedLine.success, true);
    assert.equal(openedLine.state.lastMove.piece.id, 'rs');
    assert.deepEqual(openedLine.state.lastMove.checkingPieceIds, ['rr'], '红光应标记真正将军的车，而不是闪开线路的兵');

    game.checkStreak.red = 6; game.chaseStreak.red = 6; game.positionCounts.clear(); game._recordPosition(); game._evaluate();
    assert.equal(game.status, 'playing', '连续计数本身不能在未重复局面时突然判负');

    const repeated = Xiangqi.create('xiangqi-long-check-loss', players(['red', 'black'])); repeated.start();
    repeated.engine.turn = 'black'; repeated.engine.currentTurnIndex = 1;
    repeated.engine.lastMove = { piece: { id: 'checking-rook', type: 'r', color: 'red' }, gaveCheck: true, checkCount: 3 };
    repeated.engine.checkStreak.red = 3;
    repeated.engine.positionCounts.clear(); repeated.engine.positionCounts.set(repeated.engine._positionKey(), 3);
    repeated.engine._evaluate();
    assert.equal(repeated.engine.status, 'ended');
    assert.equal(repeated.engine.winner.id, 'black');
    assert.match(repeated.engine.actionLog.at(-1), /长将获胜/);
});

test('Xiangqi ends a repeated or no-progress position instead of looping forever', () => {
    const session = Xiangqi.create('xiangqi-draw', players(['a', 'b'])); assert.equal(session.start().success, true);
    const game = session.engine;
    game.positionCounts.set(game._positionKey(), 3);
    game._evaluate();
    assert.equal(game.status, 'ended');
    assert.equal(game.drawReason, '三次重复局面和棋');

    const second = Xiangqi.create('xiangqi-quiet', players(['a', 'b'])); assert.equal(second.start().success, true);
    second.engine.quietHalfmoves = 120;
    second.engine._evaluate();
    assert.equal(second.engine.status, 'ended');
    assert.equal(second.engine.drawReason, '六十回合无吃子和棋');
});

test('Xiangqi does not capture the general and treats stalemate as a loss', () => {
    const session = Xiangqi.create('xiangqi-formal', players(['a', 'b'])); session.start(); const game = session.engine;
    game.board = new Map([
        ['0,0', { id: 'bk', type: 'k', color: 'black' }],
        ['0,1', { id: 'rr', type: 'r', color: 'red' }],
        ['4,9', { id: 'rk', type: 'k', color: 'red' }]
    ]);
    game.turn = 'red'; game.currentTurnIndex = 0;
    assert.equal(session.handleAction('a', { kind: 'move', from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }).success, false);
    game._legalMoves = () => [];
    game._inCheck = () => false;
    game._evaluate();
    assert.equal(game.status, 'ended'); assert.equal(game.winner.id, 'b'); assert.equal(game.drawReason, null);
});

test('Xiangqi completes a deterministic legal game from the initial position', () => {
    const game = new (require('../../server/games/xiangqi/engine'))('xiangqi-full', players(['red', 'black']));
    assert.equal(game.start().success, true);
    let moves = 0;
    while (game.status === 'playing' && moves < 500) {
        const legal = [...game.board.values()].filter(piece => piece.color === game.turn).flatMap(piece => game._legalMoves(piece));
        assert.ok(legal.length, `第 ${moves + 1} 手没有可走着法`);
        const move = legal[(moves * 7) % legal.length];
        assert.equal(game.handleAction(game.players[game.currentTurnIndex].id, { kind: 'move', from: move.from, to: move.to }).success, true);
        moves += 1;
    }
    assert.equal(game.status, 'ended'); assert.ok(game.winner || game.drawReason); assert.ok(moves < 500);
});
