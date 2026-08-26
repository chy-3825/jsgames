const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Room = require('../server/room');
const Checkers = require('../server/games/checkers');
const CheckersEngine = require('../server/games/checkers/engine');

const players = ids => ids.map(id => ({ id, name: id }));

test('Chinese Checkers browser client is a valid ES module', () => {
    const clientPath = path.join(__dirname, '../public/games/checkers/client.js');
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
        encoding: 'utf8',
        input: fs.readFileSync(clientPath, 'utf8'),
    });
    assert.equal(result.status, 0, result.stderr);
});

test('Chinese Checkers maps each starting corner to the viewer bottom', () => {
    const clientPath = path.join(__dirname, '../public/games/checkers/client.js');
    const source = fs.readFileSync(clientPath, 'utf8');
    assert.match(source, /function boardRotationForCorner|export function boardRotationForCorner/);
    assert.match(source, /180 - corner \* 60/);
});

function session(count = 2) {
    const game = Checkers.create('checkers-test', players(Array.from({ length: count }, (_, index) => `p${index}`)));
    assert.equal(game.start().success, true);
    return game;
}

test('Chinese Checkers builds the 121-hole star board and scales 2-6 players', () => {
    assert.equal(CheckersEngine.CELLS.length, 121);
    const rowCounts = Array.from({ length: 17 }, (_, y) => CheckersEngine.CELLS.filter(cell => cell.y === y).length);
    assert.deepEqual(rowCounts, [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1]);
    assert.deepEqual(CheckersEngine.CELLS.filter(cell => cell.y === 0), [{ x: 12, y: 0 }]);
    assert.deepEqual(CheckersEngine.CELLS.filter(cell => cell.y === 4).map(cell => cell.x), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    assert.deepEqual(CheckersEngine.CORNERS.map(corner => corner.length), [10, 10, 10, 10, 10, 10]);
    assert.equal(new Set(CheckersEngine.CORNERS.flat().map(cell => `${cell.x},${cell.y}`)).size, 60);
    for (let count = 2; count <= 6; count += 1) {
        const game = session(count);
        assert.equal(game.engine.board.size, count * 10);
        assert.equal(game.engine.players.length, count);
        assert.deepEqual(game.engine.players.map(player => player.targetCorner), game.engine.players.map(player => (player.corner + 3) % 6));
    }
});

test('Chinese Checkers enforces turns, selection ownership, and adjacent moves', () => {
    const game = session();
    const before = JSON.stringify(game.engine.getPublicState());
    assert.equal(game.handleAction('p1', { kind: 'selectPiece', pieceId: 'p1-piece-1' }).success, false);
    assert.equal(JSON.stringify(game.engine.getPublicState()), before);
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p1-piece-1' }).success, false);
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }).success, true);
    assert.deepEqual(game.getPlayerState('p0').legalMoves.step, [{ x: 10, y: 4 }, { x: 8, y: 4 }]);
    assert.equal(game.handleAction('p0', { kind: 'movePiece', to: { x: 10, y: 4 } }).success, true);
    assert.equal(game.engine.moveNumber, 1);
    assert.equal(game.engine.currentTurnIndex, 1);
    assert.equal(game.engine.board.get('10,4').id, 'p0-piece-7');
});

test('Chinese Checkers lets a player cancel or change selection before moving', () => {
    const game = session();
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }).success, true);
    let state = game.getPlayerState('p0');
    assert.equal(state.legalMoves.select.includes('p0-piece-7'), true);
    assert.equal(state.legalMoves.select.includes('p0-piece-8'), true);

    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-8' }).success, true);
    assert.equal(game.engine.pendingMove.pieceId, 'p0-piece-8');
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-8' }).success, true);
    assert.equal(game.engine.pendingMove, null);
    assert.equal(game.engine.moveNumber, 0);

    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-4' }).success, true);
    assert.equal(game.handleAction('p0', { kind: 'movePiece', to: { x: 12, y: 4 } }).success, true);
    state = game.getPlayerState('p0');
    assert.equal(state.selectedPiece.jumpCount, 1);
    assert.deepEqual(state.legalMoves.select, []);
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }).success, false);
});

test('Chinese Checkers supports chain jumps and explicit end of a jump turn', () => {
    const game = session();
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-4' }).success, true);
    assert.equal(game.handleAction('p0', { kind: 'movePiece', to: { x: 12, y: 4 } }).success, true);
    assert.equal(game.engine.moveNumber, 0, '中途连续跳跃不应提前计为完整回合');
    assert.equal(game.getPlayerState('p0').selectedPiece.jumpCount, 1);
    assert.deepEqual(game.getPlayerState('p0').legalMoves.jump, [{ x: 10, y: 2 }]);
    assert.equal(game.handleAction('p0', { kind: 'endMove' }).success, true);
    assert.equal(game.engine.moveNumber, 1);
    assert.equal(game.engine.currentTurnIndex, 1);
    assert.equal(game.engine.board.get('12,4').id, 'p0-piece-4');
    assert.equal(game.handleAction('p1', { kind: 'endMove' }).success, false);
});

test('Chinese Checkers rejects malformed targets and preserves state', () => {
    const game = session();
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }).success, true);
    const before = JSON.stringify(game.engine.getPublicState());
    assert.equal(game.handleAction('p0', { kind: 'movePiece', to: { x: '8', y: 4 } }).success, false);
    assert.equal(game.handleAction('p0', { kind: 'movePiece', to: { x: 20, y: 20 } }).success, false);
    assert.equal(JSON.stringify(game.engine.getPublicState()), before);
    assert.equal(game.engine.pendingMove.pieceId, 'p0-piece-7');
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-8' }).success, true);
    assert.equal(game.engine.pendingMove.pieceId, 'p0-piece-8');
});

test('Chinese Checkers ends the game when the only opponent leaves', () => {
    const game = session();
    const result = game.handlePlayerLeave('p1');
    assert.equal(result.success, true);
    assert.equal(result.ended, true);
    assert.equal(game.engine.status, 'ended');
    assert.equal(game.engine.winner.id, 'p0');
    assert.equal(game.handleAction('p0', { kind: 'selectPiece', pieceId: 'p0-piece-7' }).success, false);
});

test('Chinese Checkers advances after a transient disconnect and restores on reconnect', () => {
    const game = session();
    assert.equal(game.engine.currentTurnIndex, 0);
    const disconnected = game.handlePlayerDisconnect('p0');
    assert.equal(disconnected.success, true);
    assert.equal(game.engine.status, 'playing');
    assert.equal(game.engine.currentTurnIndex, 1);
    assert.equal(game.getPlayerState('p1').myIsCurrentTurn, true);
    const reconnected = game.handlePlayerReconnect('p0');
    assert.equal(reconnected.success, true);
    assert.equal(game.engine.players[0].isOnline, true);
    assert.equal(game.engine.currentTurnIndex, 1);
});

test('Chinese Checkers works through the generic Room adapter', () => {
    const room = new Room('checkers-room', 'a', '甲', 'checkers');
    assert.equal(room.addPlayer({ id: 'a', name: '甲' }).success, true);
    assert.equal(room.addPlayer({ id: 'b', name: '乙' }).success, true);
    assert.equal(room.startGame().success, true);
    assert.equal(room.getPlayerGameState('a').legalMoves.select.length > 0, true);
    assert.equal(room.handleGameAction('a', { kind: 'selectPiece', pieceId: 'a-piece-7' }).success, true);
    assert.equal(room.getPlayerGameState('a').selectedPiece.pieceId, 'a-piece-7');
});
