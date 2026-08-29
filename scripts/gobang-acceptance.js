'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Room = require('../server/room');
const GobangEngine = require('../server/games/gobang/engine');

const PLAYERS = [
    { id: 'black', name: '黑方' },
    { id: 'white', name: '白方' },
];
const BOARD_SIZE = GobangEngine.BOARD_SIZE;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createSession(roomId) {
    const room = new Room(roomId, PLAYERS[0].id, PLAYERS[0].name, 'gobang');
    assert.equal(room.addPlayer({ ...PLAYERS[0] }).success, true, `${roomId}: 黑方应能加入房间`);
    assert.equal(room.addPlayer({ ...PLAYERS[1] }).success, true, `${roomId}: 白方应能加入房间`);
    assert.equal(room.startGame().success, true, `${roomId}: 房间应正常开始游戏`);
    // Keep the acceptance helpers concise while every game is created through Room.
    Object.defineProperty(room, 'engine', { get: () => room.game.engine });
    room.handleAction = (playerId, action) => room.handleGameAction(playerId, action);
    room.getPlayerState = playerId => room.getPlayerGameState(playerId);
    return room;
}

function position(piece) {
    return `${piece.x},${piece.y}`;
}

function publicState(session) {
    return session.engine.getPublicState();
}

function assertLegalMoveView(session, state, moveCount, label) {
    const positions = new Set(state.pieces.map(position));
    for (const player of PLAYERS) {
        const playerState = session.getPlayerState(player.id);
        assert.equal(playerState.myColor, player.id, `${label}: 玩家颜色应稳定`);
        if (state.status === 'playing' && playerState.myIsCurrentTurn) {
            assert.ok(Array.isArray(playerState.legalMoves.place), `${label}: 当前玩家应有合法落子列表`);
            assert.equal(playerState.legalMoves.place.length, BOARD_SIZE * BOARD_SIZE - moveCount, `${label}: 合法位置数量错误`);
            for (const target of playerState.legalMoves.place) {
                assert.ok(Number.isInteger(target.x) && Number.isInteger(target.y), `${label}: 合法坐标必须是整数`);
                assert.ok(target.x >= 0 && target.x < BOARD_SIZE && target.y >= 0 && target.y < BOARD_SIZE, `${label}: 合法坐标越界`);
                assert.equal(positions.has(`${target.x},${target.y}`), false, `${label}: 合法位置不能已有棋子`);
            }
        } else {
            assert.equal(playerState.legalMoves.place, undefined, `${label}: 非当前玩家不应收到可落子列表`);
        }
    }
}

function assertStateInvariants(session, before, moves, action, result, label) {
    const state = result.state;
    assert.ok(state, `${label}: 成功动作必须返回状态`);
    assert.doesNotThrow(() => JSON.stringify(state), `${label}: 状态必须可序列化`);
    assert.equal(state.pieces.length, moves.length, `${label}: 棋子数应等于着数`);
    assert.equal(state.moveNumber, moves.length, `${label}: moveNumber 应等于着数`);
    assert.equal(session.engine.board.size, moves.length, `${label}: 服务端棋盘大小应等于着数`);

    const positions = new Set();
    for (const piece of state.pieces) {
        assert.ok(Number.isInteger(piece.x) && Number.isInteger(piece.y), `${label}: 棋子坐标必须是整数`);
        assert.ok(piece.x >= 0 && piece.x < BOARD_SIZE && piece.y >= 0 && piece.y < BOARD_SIZE, `${label}: 棋子坐标越界`);
        assert.ok(piece.color === 'black' || piece.color === 'white', `${label}: 棋子颜色非法`);
        assert.equal(positions.has(position(piece)), false, `${label}: 两枚棋子占据同一位置`);
        positions.add(position(piece));
    }
    if (before) {
        const current = new Map(state.pieces.map(piece => [position(piece), piece]));
        for (const piece of before.pieces) {
            assert.deepEqual(current.get(position(piece)), piece, `${label}: 已落子不能消失或改变`);
        }
        assert.equal(current.has(`${action.x},${action.y}`), true, `${label}: 本次落子未进入棋盘`);
    }

    assert.deepEqual(state.lastMove, {
        x: action.x,
        y: action.y,
        color: action.playerId === 'black' ? 'black' : 'white',
        playerId: action.playerId,
        move: moves.length,
    }, `${label}: lastMove 与动作不一致`);
    assert.equal(state.currentTurn, state.players[state.turn === 'black' ? 0 : 1]?.id, `${label}: currentTurn 与 turn 不一致`);
    if (state.status === 'playing') {
        assert.equal(state.turn, action.playerId === 'black' ? 'white' : 'black', `${label}: 行棋方没有正确切换`);
        assert.equal(state.currentTurn, state.turn === 'black' ? 'black' : 'white', `${label}: 当前玩家没有正确切换`);
        assert.equal(state.winner, null, `${label}: 进行中不应有胜者`);
    } else {
        assert.ok(state.winner || state.drawReason, `${label}: 终局必须有胜者或和棋原因`);
    }
    assertLegalMoveView(session, state, moves.length, label);
}

function assertRejected(session, playerId, action, expectedText, label) {
    const before = clone(publicState(session));
    const result = session.handleAction(playerId, action);
    assert.equal(result.success, false, `${label}: 非法动作必须拒绝`);
    if (expectedText) assert.match(result.message, expectedText, `${label}: 拒绝原因不明确`);
    assert.deepEqual(publicState(session), before, `${label}: 非法动作不能改变状态`);
}

function replay(roomId, moves) {
    const session = createSession(roomId);
    for (const move of moves) {
        const result = session.handleAction(move.playerId, { kind: 'place', x: move.x, y: move.y });
        assert.equal(result.success, true, `${roomId}: 重放着法必须成功`);
    }
    return session;
}

function runSequence(roomId, sequence, checks = {}) {
    const session = createSession(roomId);
    assertLegalMoveView(session, publicState(session), 0, `${roomId}: 初始状态`);
    assertRejected(session, 'white', { kind: 'place', x: 7, y: 7 }, /还没轮到/, `${roomId}: 非当前玩家`);
    assertRejected(session, 'black', { kind: 'place', x: -1, y: 7 }, /超出/, `${roomId}: 越界坐标`);
    assertRejected(session, 'black', { kind: 'place', x: '7', y: 7 }, /超出/, `${roomId}: 非整数坐标`);
    assertRejected(session, 'black', { kind: 'pass' }, /落子操作/, `${roomId}: 未知动作`);

    const moves = [];
    let before = null;
    for (let index = 0; index < sequence.length; index += 1) {
        const move = sequence[index];
        const expectedPlayer = session.engine.players[session.engine.currentTurnIndex].id;
        assert.equal(move.playerId, expectedPlayer, `${roomId}: 着法 ${index + 1} 行棋方错误`);
        const result = session.handleAction(move.playerId, { kind: 'place', x: move.x, y: move.y });
        assert.equal(result.success, true, `${roomId}: 着法 ${index + 1} 应合法`);
        moves.push({ ...move });
        assertStateInvariants(session, before, moves, move, result, `${roomId}: 着法 ${index + 1}`);
        before = clone(result.state);
        if (index < sequence.length - 1) assert.equal(result.ended, false, `${roomId}: 不应提前结束`);
    }
    assert.equal(session.engine.status, 'ended', `${roomId}: 完整对局必须自然结束`);
    assertRejected(session, session.engine.winner?.id || 'black', { kind: 'place', x: 14, y: 14 }, /已结束/, `${roomId}: 终局后操作`);
    if (checks.assertEnd) checks.assertEnd(session);

    const replayed = replay(roomId, moves);
    assert.deepEqual(publicState(replayed), publicState(session), `${roomId}: 相同着法重放结果必须一致`);
    return {
        roomId,
        moves,
        winner: session.engine.getWinner(),
        drawReason: session.engine.drawReason,
        finalState: clone(publicState(session)),
    };
}

function normalGame() {
    return runSequence('gobang-acceptance-normal', [
        { playerId: 'black', x: 7, y: 7 }, { playerId: 'white', x: 0, y: 0 },
        { playerId: 'black', x: 8, y: 7 }, { playerId: 'white', x: 0, y: 2 },
        { playerId: 'black', x: 9, y: 7 }, { playerId: 'white', x: 0, y: 4 },
        { playerId: 'black', x: 10, y: 7 }, { playerId: 'white', x: 0, y: 6 },
        { playerId: 'black', x: 11, y: 7 },
    ], {
        assertEnd(session) {
            assert.equal(session.engine.winner.id, 'black', '正常局应由黑方获胜');
        },
    });
}

function rulesAttackGame() {
    return runSequence('gobang-acceptance-rules', [
        { playerId: 'black', x: 6, y: 7 }, { playerId: 'white', x: 14, y: 14 },
        { playerId: 'black', x: 8, y: 7 }, { playerId: 'white', x: 14, y: 12 },
        { playerId: 'black', x: 7, y: 6 }, { playerId: 'white', x: 14, y: 10 },
        { playerId: 'black', x: 7, y: 8 }, { playerId: 'white', x: 14, y: 8 },
        { playerId: 'black', x: 7, y: 7 }, { playerId: 'white', x: 14, y: 6 },
        { playerId: 'black', x: 0, y: 0 }, { playerId: 'white', x: 13, y: 13 },
        { playerId: 'black', x: 1, y: 0 }, { playerId: 'white', x: 12, y: 11 },
        { playerId: 'black', x: 2, y: 0 }, { playerId: 'white', x: 11, y: 9 },
        { playerId: 'black', x: 4, y: 0 }, { playerId: 'white', x: 10, y: 7 },
        { playerId: 'black', x: 5, y: 0 }, { playerId: 'white', x: 9, y: 5 },
        { playerId: 'black', x: 3, y: 0 },
    ], {
        assertEnd(session) {
            assert.equal(session.engine.winner.id, 'black', '规则攻击局应由黑方获胜');
            assert.equal(session.engine.lastMove.x, 3, '最后一步应填入间隙');
            assert.equal(session.engine.lastMove.y, 0, '最后一步应形成六连');
        },
    });
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 0x100000000;
    };
}

function randomGame(seed, roomId = `gobang-random-${seed.toString(16)}`) {
    const session = createSession(roomId);
    const random = seededRandom(seed);
    const moves = [];
    let before = null;
    while (session.engine.status === 'playing') {
        assert.ok(moves.length < BOARD_SIZE * BOARD_SIZE, `${roomId}: 随机局不能超过棋盘容量`);
        const playerId = session.engine.players[session.engine.currentTurnIndex].id;
        const legal = session.getPlayerState(playerId).legalMoves.place;
        assert.ok(legal.length > 0, `${roomId}: 进行中必须有合法落子`);
        const target = legal[Math.floor(random() * legal.length)];
        const move = { playerId, x: target.x, y: target.y };
        const result = session.handleAction(playerId, { kind: 'place', x: target.x, y: target.y });
        assert.equal(result.success, true, `${roomId}: 随机合法着法应成功`);
        moves.push(move);
        assertStateInvariants(session, before, moves, move, result, `${roomId}: 着法 ${moves.length}`);
        before = clone(result.state);
    }
    assert.ok(session.engine.winner || session.engine.drawReason, `${roomId}: 随机局必须自然产生结果`);
    const replayed = replay(roomId, moves);
    assert.deepEqual(publicState(replayed), publicState(session), `${roomId}: 固定种子重放必须一致`);
    return { seed, roomId, moves, winner: session.engine.getWinner(), drawReason: session.engine.drawReason, finalState: clone(publicState(session)) };
}

function naturalDraw() {
    const buckets = { black: [], white: [] };
    for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) {
        const color = (x + 2 * y) % 4 < 2 ? 'black' : 'white';
        buckets[color].push({ x, y });
    }
    const sequence = [];
    while (buckets.black.length || buckets.white.length) {
        const playerId = sequence.length % 2 === 0 ? 'black' : 'white';
        const target = buckets[playerId].shift();
        assert.ok(target, `和棋构造应为当前玩家保留位置`);
        sequence.push({ playerId, ...target });
    }
    const record = runSequence('gobang-acceptance-draw', sequence, {
        assertEnd(session) {
            assert.equal(session.engine.winner, null, '满盘和棋不应有胜者');
            assert.equal(session.engine.drawReason, '棋盘已满，和棋');
        },
    });
    assert.equal(record.moves.length, BOARD_SIZE * BOARD_SIZE, '自然和棋应填满棋盘');
    return { moves: record.moves.length, drawReason: record.drawReason, finalState: record.finalState };
}

function main() {
    const normal = normalGame();
    const rules = rulesAttackGame();
    const fixedSeed = 0x5eed1234;
    const random = randomGame(fixedSeed, 'gobang-acceptance-random');
    const randomReplay = randomGame(fixedSeed, 'gobang-acceptance-random-replay');
    assert.deepEqual(random.moves, randomReplay.moves, '相同种子必须产生完全相同的着法');

    const random100 = [];
    for (let index = 0; index < 100; index += 1) {
        const seed = (0x5eed0000 + index) >>> 0;
        const result = randomGame(seed);
        random100.push({ seed, moves: result.moves.length, winner: result.winner, drawReason: result.drawReason });
    }
    const draw = naturalDraw();

    const report = {
        generatedAt: new Date().toISOString(),
        rules: { board: '15x15', first: 'black', winLength: 5, forbiddenMoves: false, overlineWins: true, fullBoardDraw: true },
        completeGames: [normal, rules, random],
        deterministicReplay: { seed: fixedSeed, sameMoves: true },
        random100: { count: random100.length, seeds: random100.map(item => item.seed), results: random100 },
        naturalDraw: draw,
        checks: {
            uniquePositions: true,
            turnSwitching: true,
            noRemovedPieces: true,
            legalMovesInBounds: true,
            illegalActionsRejected: true,
            endedGameRejectsActions: true,
            jsonSerialization: true,
            replay: true,
            explicitRestoreApi: typeof GobangEngine.prototype.restore === 'function',
        },
    };
    const outputPath = path.join(__dirname, '..', 'TEST_REPORTS', 'artifacts', 'gobang-acceptance-runs.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
        completeGames: report.completeGames.map(game => ({ roomId: game.roomId, moves: game.moves.length, winner: game.winner, drawReason: game.drawReason })),
        random100: { count: report.random100.count, minMoves: Math.min(...random100.map(item => item.moves)), maxMoves: Math.max(...random100.map(item => item.moves)), draws: random100.filter(item => item.drawReason).length },
        naturalDraw: { moves: draw.moves, drawReason: draw.drawReason },
        explicitRestoreApi: report.checks.explicitRestoreApi,
        outputPath,
    }, null, 2));
}

main();
