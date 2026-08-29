#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const Room = require('../server/room');
const Checkers = require('../server/games/checkers');
const Engine = require('../server/games/checkers/engine');

const DIRECTIONS = [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const PLAYERS = [{ id: 'p0', name: '甲方' }, { id: 'p1', name: '乙方' }];
const CELL_KEY = (point) => `${point.x},${point.y}`;
const CELL_SET = new Set(Engine.CELLS.map(CELL_KEY));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function publicState(room) { return room.game.engine.getPublicState(); }
function comparableState(state) { const result = clone(state); delete result.roomId; return result; }
function pieceMap(state) { return new Map(state.pieces.map(piece => [piece.id, piece])); }
function positionMap(state) { return new Map(state.pieces.map(piece => [piece.id, CELL_KEY(piece)])); }
function createRoom(roomId, players = PLAYERS) {
    const room = new Room(roomId, players[0].id, players[0].name, 'checkers');
    for (const player of players) assert.equal(room.addPlayer({ ...player }).success, true, `${roomId}: 玩家应能加入`);
    assert.equal(room.startGame().success, true, `${roomId}: 房间应能开始`);
    return room;
}

// Hex-grid shortest distances are used only by the deterministic acceptance
// policy. All actual moves are still submitted through Room.handleGameAction.
const adjacency = new Map(Engine.CELLS.map(cell => [CELL_KEY(cell), []]));
for (const cell of Engine.CELLS) for (const [dx, dy] of DIRECTIONS) {
    const next = { x: cell.x + dx, y: cell.y + dy };
    if (adjacency.has(CELL_KEY(next))) adjacency.get(CELL_KEY(cell)).push(next);
}
const DISTANCES = new Map();
for (const source of Engine.CELLS) {
    const sourceKey = CELL_KEY(source);
    const distances = new Map([[sourceKey, 0]]);
    const queue = [source];
    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        const currentKey = CELL_KEY(current);
        for (const next of adjacency.get(currentKey)) {
            const nextKey = CELL_KEY(next);
            if (!distances.has(nextKey)) {
                distances.set(nextKey, distances.get(currentKey) + 1);
                queue.push(next);
            }
        }
    }
    DISTANCES.set(sourceKey, distances);
}
function distance(from, to) { return DISTANCES.get(CELL_KEY(from)).get(CELL_KEY(to)); }

function minimumAssignment(pieces, target) {
    // Hungarian algorithm, 10x10 in the standard setup.
    const n = pieces.length;
    const m = target.length;
    const u = new Array(n + 1).fill(0);
    const v = new Array(m + 1).fill(0);
    const p = new Array(m + 1).fill(0);
    const way = new Array(m + 1).fill(0);
    for (let row = 1; row <= n; row += 1) {
        p[0] = row;
        let column0 = 0;
        const minValue = new Array(m + 1).fill(Infinity);
        const used = new Array(m + 1).fill(false);
        do {
            used[column0] = true;
            const row0 = p[column0];
            let delta = Infinity;
            let column1 = 0;
            for (let column = 1; column <= m; column += 1) if (!used[column]) {
                const current = distance(pieces[row0 - 1], target[column - 1]) - u[row0] - v[column];
                if (current < minValue[column]) {
                    minValue[column] = current;
                    way[column] = column0;
                }
                if (minValue[column] < delta) {
                    delta = minValue[column];
                    column1 = column;
                }
            }
            for (let column = 0; column <= m; column += 1) {
                if (used[column]) {
                    u[p[column]] += delta;
                    v[column] -= delta;
                } else minValue[column] -= delta;
            }
            column0 = column1;
        } while (p[column0] !== 0);
        do {
            const column1 = way[column0];
            p[column0] = p[column1];
            column0 = column1;
        } while (column0 !== 0);
    }
    return -v[0];
}

function playerScore(board, player) {
    const pieces = [...board.values()].filter(piece => piece.playerId === player.id);
    return minimumAssignment(pieces, Engine.CORNERS[player.targetCorner]);
}

function oneHopMoves(board, piece) {
    const moves = [];
    for (const [dx, dy] of DIRECTIONS) {
        const over = { x: piece.x + dx, y: piece.y + dy };
        const to = { x: piece.x + dx * 2, y: piece.y + dy * 2 };
        if (CELL_SET.has(CELL_KEY(over)) && !board.has(CELL_KEY(over))) {
            moves.push({ kind: 'step', to: over, over: null });
        }
        if (CELL_SET.has(CELL_KEY(over)) && CELL_SET.has(CELL_KEY(to)) && board.has(CELL_KEY(over)) && !board.has(CELL_KEY(to))) {
            moves.push({ kind: 'jump', to, over });
        }
    }
    return moves;
}

function applyPureMove(board, piece, target) {
    const next = new Map(board);
    next.delete(CELL_KEY(piece));
    next.set(CELL_KEY(target), { ...piece, x: target.x, y: target.y });
    return next;
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function assertLegalView(room, state, label) {
    const currentId = state.currentTurn;
    const positions = new Set(state.pieces.map(CELL_KEY));
    const pendingFrom = state.pendingMove ? CELL_KEY(state.pendingMove.from) : null;
    const virtualOccupied = target => positions.has(CELL_KEY(target)) && CELL_KEY(target) !== pendingFrom;
    for (const player of state.players) {
        const view = room.getPlayerGameState(player.id);
        assert.equal(view.myColor, player.color, `${label}: 玩家颜色应稳定`);
        if (player.id !== currentId || state.status !== 'playing') {
            assert.deepEqual(view.legalMoves, { select: [], step: [], jump: [] }, `${label}: 非当前玩家不应有合法着法`);
            continue;
        }
        if (view.selectedPiece) {
            for (const target of [...view.legalMoves.step, ...view.legalMoves.jump]) {
                assert.ok(Number.isInteger(target.x) && Number.isInteger(target.y), `${label}: 目标坐标必须为整数`);
                assert.ok(CELL_SET.has(CELL_KEY(target)), `${label}: 合法目标必须在 121 个棋位内`);
                assert.equal(virtualOccupied(target), false, `${label}: 合法目标必须为空位`);
            }
            assert.equal(view.selectedPiece.pieceId, state.pendingMove?.pieceId, `${label}: 私有选择与公共待行状态不一致`);
        } else {
            for (const pieceId of view.legalMoves.select) {
                const piece = state.pieces.find(item => item.id === pieceId);
                assert.ok(piece && piece.playerId === player.id, `${label}: 只能选择自己的棋子`);
            }
        }
    }
}

function assertStateInvariants(room, before, action, result, label) {
    assert.equal(result.success, true, `${label}: 合法动作应成功`);
    const state = publicState(room);
    assert.doesNotThrow(() => JSON.stringify(state), `${label}: 状态必须可序列化`);
    assert.equal(state.pieces.length, 20, `${label}: 跳棋不应吃子，棋子总数必须保持 20`);
    const positions = new Set();
    const ids = new Set();
    for (const piece of state.pieces) {
        assert.equal(ids.has(piece.id), false, `${label}: 棋子 ID 不能重复`);
        ids.add(piece.id);
        assert.equal(positions.has(CELL_KEY(piece)), false, `${label}: 两枚棋子不能占据同一位置`);
        positions.add(CELL_KEY(piece));
        assert.ok(CELL_SET.has(CELL_KEY(piece)), `${label}: 棋子必须位于棋盘棋位`);
    }
    for (const player of state.players) assert.equal(player.pieceCount, 10, `${label}: 每方棋子数必须保持 10`);
    assert.equal(state.currentTurn, room.game.engine.players[room.game.engine.currentTurnIndex]?.id || null, `${label}: 当前行动方错误`);
    assertLegalView(room, state, label);

    if (!before) return;
    const beforePositions = positionMap(before);
    const afterPositions = positionMap(state);
    assert.deepEqual(new Set(beforePositions.keys()), new Set(afterPositions.keys()), `${label}: 棋子不能凭空出现或消失`);
    const isSelect = action.kind === 'selectPiece' || action.kind === 'select';
    const isJump = action.kind === 'movePiece' && before.pendingMove && state.pendingMove;
    const isComplete = action.kind === 'endMove' || (action.kind === 'movePiece' && !state.pendingMove);
    if (isSelect || isJump) {
        assert.deepEqual(afterPositions, beforePositions, `${label}: 选择和连跳中途不应提前改变公共棋盘`);
        assert.equal(state.moveNumber, before.moveNumber, `${label}: 连跳中途不应提前计回合`);
        assert.equal(state.currentTurn, before.currentTurn, `${label}: 连跳中途不能切换行动方`);
    }
    if (isComplete) {
        assert.equal(state.moveNumber, before.moveNumber + 1, `${label}: 完整移动应只增加一个回合`);
        if (state.status === 'playing') assert.notEqual(state.currentTurn, before.currentTurn, `${label}: 完整移动后应切换行动方`);
        if (action.kind === 'movePiece' && action.to) {
            const movedId = result.state.lastMove?.pieceId;
            if (movedId) assert.equal(afterPositions.get(movedId), CELL_KEY(action.to), `${label}: 移动棋子没有到达目标`);
        }
    }
    if (state.status === 'ended') assert.ok(state.winner, `${label}: 终局必须有胜者`);
}

function perform(room, playerId, action, records, label) {
    const before = clone(publicState(room));
    const result = room.handleGameAction(playerId, action);
    assertStateInvariants(room, before, action, result, label);
    records.push({ playerId, action: clone(action) });
    return result;
}

function assertRejected(room, playerId, action, label) {
    const before = clone(publicState(room));
    const result = room.handleGameAction(playerId, action);
    assert.equal(result.success, false, `${label}: 非法动作必须拒绝`);
    assert.deepEqual(publicState(room), before, `${label}: 非法动作不能改变状态`);
    return result;
}

function initialBoundaryChecks(room, label) {
    assertRejected(room, 'p1', { kind: 'selectPiece', pieceId: 'p1-piece-1' }, `${label}: 非当前玩家`);
    assertRejected(room, 'p0', { kind: 'movePiece', to: { x: 8, y: 4 } }, `${label}: 未选择棋子`);
    assertRejected(room, 'p0', { kind: 'selectPiece', pieceId: 'p1-piece-1' }, `${label}: 选择敌方棋子`);
    const records = [];
    perform(room, 'p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }, records, `${label}: 选择己方棋子`);
    assertRejected(room, 'p0', { kind: 'movePiece', to: { x: '8', y: 4 } }, `${label}: 非整数目标`);
    assertRejected(room, 'p0', { kind: 'movePiece', to: { x: 20, y: 20 } }, `${label}: 非棋位目标`);
    assertRejected(room, 'p0', { kind: 'endMove' }, `${label}: 无连跳时结束`);
    // The selected piece is still pending after the rejected actions.
    assert.equal(room.game.engine.pendingMove?.pieceId, 'p0-piece-7', `${label}: 非法动作不能清掉选择`);
    // Complete the selected piece's legal step to leave a clean initial turn.
    const state = room.getPlayerGameState('p0');
    const target = state.legalMoves.step[0] || state.legalMoves.jump[0];
    assert.ok(target, `${label}: 初始棋子应存在合法目标`);
    perform(room, 'p0', { kind: 'movePiece', to: target }, records, `${label}: 边界检查收尾`);
    return records;
}

function candidateMoves(engine, playerId, reverseTargets, preferEnemyJump) {
    const player = engine.players.find(item => item.id === playerId);
    const candidates = [];
    for (const piece of engine.board.values()) {
        if (piece.playerId !== playerId) continue;
        for (const move of oneHopMoves(engine.board, piece)) {
            const nextBoard = applyPureMove(engine.board, piece, move.to);
            const overPiece = move.over ? engine.board.get(CELL_KEY(move.over)) : null;
            candidates.push({
                pieceId: piece.id,
                from: { x: piece.x, y: piece.y },
                to: move.to,
                kind: move.kind,
                enemyJump: move.kind === 'jump' && overPiece && overPiece.playerId !== playerId,
                reverse: reverseTargets.get(piece.id) === CELL_KEY(move.to),
                score: playerScore(nextBoard, player),
            });
        }
    }
    candidates.sort((left, right) => {
        if (preferEnemyJump && left.enemyJump !== right.enemyJump) return Number(right.enemyJump) - Number(left.enemyJump);
        if (left.reverse !== right.reverse) return Number(left.reverse) - Number(right.reverse);
        return left.score - right.score;
    });
    return candidates;
}

function plannerTurn(room, random, records, options = {}) {
    const engine = room.game.engine;
    const playerId = engine.players[engine.currentTurnIndex].id;
    const candidates = candidateMoves(engine, playerId, options.reverseTargets, options.preferEnemyJump && !options.metrics.enemyJump);
    assert.ok(candidates.length, `${room.id}: 当前玩家必须存在合法移动`);
    const topCount = Math.min(4, candidates.length);
    const pick = candidates[Math.floor(options.randomized && random() < 0.12 ? random() * topCount : 0)];
    perform(room, playerId, { kind: 'selectPiece', pieceId: pick.pieceId }, records, `${room.id}: 选择棋子`);
    perform(room, playerId, { kind: 'movePiece', to: pick.to }, records, `${room.id}: ${pick.kind} 移动`);
    if (pick.enemyJump) options.metrics.enemyJump = true;
    if (pick.kind === 'jump') perform(room, playerId, { kind: 'endMove' }, records, `${room.id}: 结束连跳`);
    options.reverseTargets.set(pick.pieceId, CELL_KEY(pick.from));
}

function finishWithPlanner(room, seed, records, options = {}) {
    const random = seededRandom(seed);
    const reverseTargets = new Map();
    const metrics = options.metrics || { enemyJump: false };
    let guard = 0;
    while (room.status === 'playing') {
        assert.ok(guard < (options.maxMoves || 5000), `${room.id}: 完整对局不能触及回合上限`);
        plannerTurn(room, random, records, { randomized: Boolean(options.randomized), reverseTargets, metrics, preferEnemyJump: Boolean(options.preferEnemyJump) });
        guard += 1;
    }
    assert.equal(room.status, 'ended', `${room.id}: 必须自然结束`);
    assert.ok(room.getWinner(), `${room.id}: 必须产生胜者`);
    return { moves: room.game.engine.moveNumber, winner: room.getWinner(), metrics };
}

function replay(roomId, records) {
    const room = createRoom(roomId);
    for (const [index, record] of records.entries()) {
        const result = room.handleGameAction(record.playerId, record.action);
        assert.equal(result.success, true, `${roomId}: 重放动作 ${index + 1} 必须合法 (${record.playerId} ${record.action.kind} ${JSON.stringify(record.action)}: ${result.message})`);
    }
    return room;
}

function completeGame(roomId, seed, mode) {
    const room = createRoom(roomId);
    const records = initialBoundaryChecks(room, roomId);
    const metrics = { enemyJump: false, selfReturningChain: false };
    if (mode === 'rules') {
        // The initial four-piece cluster makes this legal two-jump cycle.
        perform(room, 'p1', { kind: 'selectPiece', pieceId: 'p1-piece-5' }, records, `${roomId}: 连跳选择`);
        perform(room, 'p1', { kind: 'movePiece', to: { x: 8, y: 12 } }, records, `${roomId}: 第一次跳跃`);
        perform(room, 'p1', { kind: 'movePiece', to: { x: 10, y: 14 } }, records, `${roomId}: 返回原位的第二次跳跃`);
        perform(room, 'p1', { kind: 'endMove' }, records, `${roomId}: 主动结束连跳`);
        metrics.selfReturningChain = true;
    }
    const result = finishWithPlanner(room, seed, records, { randomized: mode === 'random', preferEnemyJump: mode === 'rules', metrics });
    assert.equal(room.game.engine.status, 'ended', `${roomId}: 状态必须为 ended`);
    assertRejected(room, room.getWinner().id, { kind: 'selectPiece', pieceId: `${room.getWinner().id}-piece-1` }, `${roomId}: 终局后拒绝动作`);
    const replayed = replay(roomId, records);
    assert.deepEqual(publicState(replayed), publicState(room), `${roomId}: 完整动作重放必须得到相同状态`);
    return {
        roomId,
        seed,
        mode,
        actions: records,
        moves: result.moves,
        winner: result.winner,
        metrics,
        finalState: clone(publicState(room)),
    };
}

function setupCoverage() {
    const result = [];
    for (let count = 2; count <= 6; count += 1) {
        const players = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `玩家${index}` }));
        const room = createRoom(`checkers-setup-${count}`, players);
        const state = publicState(room);
        assert.equal(state.pieces.length, count * 10, `${count} 人棋子数量错误`);
        assert.equal(new Set(state.pieces.map(CELL_KEY)).size, count * 10, `${count} 人初始棋子不能重叠`);
        result.push({ players: count, pieces: state.pieces.length, corners: state.players.map(player => ({ corner: player.corner, targetCorner: player.targetCorner })) });
    }
    const one = new Room('checkers-too-few', 'p0', '甲', 'checkers');
    one.addPlayer({ id: 'p0', name: '甲' });
    assert.equal(one.startGame().success, false, '单人跳棋不能开局');
    const seven = new Room('checkers-too-many', 'p0', '甲', 'checkers');
    for (let index = 0; index < 6; index += 1) assert.equal(seven.addPlayer({ id: `p${index}`, name: `玩家${index}` }).success, true);
    assert.equal(seven.addPlayer({ id: 'p6', name: '超出' }).success, false, '第 7 名玩家必须被拒绝');
    return result;
}

function uniformRandomSmoke(seed, maxMoves = 10000) {
    const room = createRoom(`checkers-uniform-${seed.toString(16)}`);
    const random = seededRandom(seed);
    let actions = 0;
    let before = null;
    const submit = (playerId, action, label) => {
        const previous = before || clone(publicState(room));
        const result = room.handleGameAction(playerId, action);
        assertStateInvariants(room, previous, action, result, label);
        before = clone(publicState(room));
        actions += 1;
        return result;
    };
    while (room.status === 'playing' && room.game.engine.moveNumber < maxMoves) {
        const playerId = room.game.engine.players[room.game.engine.currentTurnIndex].id;
        const state = room.getPlayerGameState(playerId);
        if (!state.selectedPiece) {
            assert.ok(state.legalMoves.select.length, '均匀随机局当前应有可选择棋子');
            const pieceId = state.legalMoves.select[Math.floor(random() * state.legalMoves.select.length)];
            submit(playerId, { kind: 'selectPiece', pieceId }, `均匀随机局选择 ${actions + 1}`);
            continue;
        }
        const jumps = state.legalMoves.jump || [];
        const steps = state.legalMoves.step || [];
        let kind;
        let target;
        if (jumps.length && (random() < 0.7 || !steps.length)) {
            kind = 'jump';
            target = jumps[Math.floor(random() * jumps.length)];
        } else if (steps.length) {
            kind = 'step';
            target = steps[Math.floor(random() * steps.length)];
        } else {
            assert.equal(state.availableActions.canEndMove, true, '均匀随机局无目标时只能结束连跳');
            submit(playerId, { kind: 'endMove' }, `均匀随机局结束连跳 ${actions + 1}`);
            continue;
        }
        submit(playerId, { kind: 'movePiece', to: target }, `均匀随机局 ${kind} ${actions + 1}`);
        if (kind === 'jump' && room.game.engine.pendingMove && random() < 0.5) submit(playerId, { kind: 'endMove' }, `均匀随机局结束连跳 ${actions + 1}`);
    }
    return { seed, maxMoves, turns: room.game.engine.moveNumber, actions, ended: room.status === 'ended', winner: room.getWinner() };
}

class WsClient {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.messages = [];
        this.waiters = [];
        this.opened = new Promise((resolve, reject) => {
            this.ws.once('open', resolve);
            this.ws.once('error', reject);
        });
        this.ws.on('message', data => {
            const message = JSON.parse(data.toString());
            this.messages.push(message);
            for (const waiter of this.waiters.splice(0)) {
                const found = this.messages.findIndex(waiter.predicate);
                if (found >= 0) waiter.resolve(this.messages.splice(found, 1)[0]);
                else this.waiters.push(waiter);
            }
        });
    }
    send(message) { this.ws.send(JSON.stringify(message)); }
    async wait(predicate, timeout = 6000) {
        const index = this.messages.findIndex(predicate);
        if (index >= 0) return this.messages.splice(index, 1)[0];
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.waiters = this.waiters.filter(item => item.resolve !== resolve); reject(new Error('WebSocket message timeout')); }, timeout);
            this.waiters.push({ predicate, resolve: value => { clearTimeout(timer); resolve(value); }, reject });
        });
    }
    close() { if (this.ws.readyState === WebSocket.OPEN) this.ws.close(); }
}

async function websocketAcceptance(url = process.env.CHECKERS_WS_URL || 'ws://127.0.0.1:3000') {
    const host = new WsClient(url);
    const guest = new WsClient(url);
    await Promise.all([host.opened, guest.opened]);
    const hostSession = await host.wait(message => message.type === 'session');
    const guestSession = await guest.wait(message => message.type === 'session');
    host.send({ type: 'setName', name: '协议甲' });
    guest.send({ type: 'setName', name: '协议乙' });
    host.send({ type: 'createRoom', gameType: 'checkers' });
    const created = await host.wait(message => message.type === 'roomCreated');
    guest.send({ type: 'joinRoom', roomId: created.roomId });
    await guest.wait(message => message.type === 'joinSuccess');
    host.send({ type: 'startGame' });
    const startedHost = await host.wait(message => message.type === 'gameStarted');
    const startedGuest = await guest.wait(message => message.type === 'gameStarted');
    assert.equal(startedHost.state.myId, hostSession.playerId, '主客户端身份必须稳定');
    assert.equal(startedGuest.state.myId, guestSession.playerId, '客客户端身份必须稳定');
    assert.notEqual(startedHost.state.myColor, startedGuest.state.myColor, '双方颜色必须不同');
    assert.deepEqual(startedHost.state.pieces, startedGuest.state.pieces, '初始公共棋盘必须一致');

    const hostPiece = startedHost.state.legalMoves.select[0];
    host.send({ type: 'gameAction', action: { kind: 'selectPiece', pieceId: hostPiece } });
    const selectedHost = await host.wait(message => message.type === 'gameState');
    const selectedGuest = await guest.wait(message => message.type === 'gameState');
    assert.ok(selectedHost.state.selectedPiece, '当前客户端应看到自己的选择');
    assert.equal(selectedGuest.state.selectedPiece, null, '对手客户端不应看到私有选择状态');
    const target = selectedHost.state.legalMoves.step[0] || selectedHost.state.legalMoves.jump[0];
    assert.ok(target, '主客户端应有合法目标');
    host.send({ type: 'gameAction', action: { kind: 'movePiece', to: target } });
    let movedHost = await host.wait(message => message.type === 'gameState');
    let movedGuest = await guest.wait(message => message.type === 'gameState');
    if (movedHost.state.pendingMove) {
        host.send({ type: 'gameAction', action: { kind: 'endMove' } });
        movedHost = await host.wait(message => message.type === 'gameState');
        movedGuest = await guest.wait(message => message.type === 'gameState');
    }
    assert.equal(movedHost.state.pieces.length, 20, '协议移动不能吃子');
    assert.deepEqual(movedHost.state.pieces, movedGuest.state.pieces, '双方棋盘状态必须同步');

    host.send({ type: 'gameAction', action: { kind: 'selectPiece', pieceId: hostPiece } });
    const rejected = await host.wait(message => message.type === 'error');
    assert.match(rejected.message, /还没轮到你/, '非当前玩家动作必须被服务器拒绝');

    const guestState = movedGuest.state;
    const currentGuest = guestState.currentTurn === guestSession.playerId ? guestState : await guest.wait(message => message.type === 'gameState');
    const guestPiece = currentGuest.legalMoves.select[0];
    guest.send({ type: 'gameAction', action: { kind: 'selectPiece', pieceId: guestPiece } });
    const guestSelected = await guest.wait(message => message.type === 'gameState');
    const guestTarget = guestSelected.state.legalMoves.step[0] || guestSelected.state.legalMoves.jump[0];
    guest.send({ type: 'gameAction', action: { kind: 'movePiece', to: guestTarget } });
    let guestMoved = await guest.wait(message => message.type === 'gameState');
    await host.wait(message => message.type === 'gameState');
    if (guestMoved.state.pendingMove) {
        guest.send({ type: 'gameAction', action: { kind: 'endMove' } });
        guestMoved = await guest.wait(message => message.type === 'gameState');
        await host.wait(message => message.type === 'gameState');
    }

    host.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    const reconnect = new WsClient(url);
    await reconnect.opened;
    reconnect.send({ type: 'resumeSession', sessionToken: hostSession.sessionToken });
    const resumed = await reconnect.wait(message => message.type === 'resumeSuccess');
    const resumedState = await reconnect.wait(message => message.type === 'gameState');
    assert.equal(resumed.playerId, hostSession.playerId, '断线重连必须恢复原玩家');
    assert.equal(resumedState.state.myId, hostSession.playerId, '重连视角必须恢复');
    assert.equal(resumedState.state.moveNumber, guestMoved.state.moveNumber, '重连棋局进度必须恢复');

    // Clean up the temporary room without affecting the assertions above.
    reconnect.send({ type: 'leaveRoom' });
    guest.send({ type: 'leaveRoom' });
    await new Promise(resolve => setTimeout(resolve, 100));
    reconnect.close();
    guest.close();
    return { roomId: created.roomId, playerIds: [hostSession.playerId, guestSession.playerId], moveNumber: resumedState.state.moveNumber, privateSelectionHidden: true, reconnectRestored: true };
}

async function main() {
    const setup = setupCoverage();
    const normal = completeGame('checkers-acceptance-normal', 0x1001, 'normal');
    const rules = completeGame('checkers-acceptance-rules', 0x2002, 'rules');
    const random = completeGame('checkers-acceptance-random', 0x5eed1234, 'random');
    const randomReplay = replay('checkers-acceptance-random-replay', random.actions);
    assert.deepEqual(comparableState(publicState(randomReplay)), comparableState(random.finalState), '固定种子随机合法局必须可重放');

    const guided100 = [];
    for (let index = 0; index < 100; index += 1) {
        const seed = (0x5eed0000 + index) >>> 0;
        const record = completeGame(`checkers-guided-${index}`, seed, 'random');
        guided100.push({ seed, moves: record.moves, winner: record.winner });
    }
    const uniform = uniformRandomSmoke(0x5eed1234, 10000);
    const protocol = await websocketAcceptance();
    const report = {
        generatedAt: new Date().toISOString(),
        rules: {
            board: '121-hole six-point star',
            playerCounts: '2-6',
            piecesPerPlayer: 10,
            movement: ['adjacent step', 'jump over any color', 'continuous jumps', 'voluntary end of jump'],
            win: 'all pieces in opposite target corner',
            captures: false,
        },
        setupCoverage: setup,
        completeGames: [normal, rules, random],
        deterministicReplay: { seed: random.seed, sameActions: true },
        guidedRandom100: { count: guided100.length, results: guided100 },
        uniformRandomSmoke: uniform,
        websocket: protocol,
        checks: {
            uniquePositions: true,
            turnSwitching: true,
            noCapturesOrDisappearingPieces: true,
            legalTargetsInBounds: true,
            malformedAndUnauthorizedActionsRejected: true,
            endedGameRejectsActions: true,
            jsonSerialization: true,
            actionReplay: true,
            privateSelectionHidden: protocol.privateSelectionHidden,
            reconnectRestored: protocol.reconnectRestored,
        },
    };
    const outputPath = path.join(__dirname, '..', 'TEST_REPORTS', 'artifacts', 'checkers-acceptance-runs.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
        completeGames: report.completeGames.map(game => ({ roomId: game.roomId, moves: game.moves, winner: game.winner, metrics: game.metrics })),
        guidedRandom100: { count: guided100.length, minMoves: Math.min(...guided100.map(item => item.moves)), maxMoves: Math.max(...guided100.map(item => item.moves)) },
        uniformRandomSmoke: uniform,
        websocket: protocol,
        outputPath,
    }, null, 2));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
