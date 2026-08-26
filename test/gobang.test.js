const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Gobang = require('../server/games/gobang');
const GobangEngine = require('../server/games/gobang/engine');

const players = [{ id: 'black', name: '黑方' }, { id: 'white', name: '白方' }];

function createSession() {
    const session = Gobang.create('gobang-test', players);
    assert.equal(session.start().success, true);
    return session;
}

function stateWithoutView(state) {
    const copy = JSON.parse(JSON.stringify(state));
    for (const key of ['roomId', 'myId', 'myColor', 'myIsCurrentTurn', 'legalMoves', 'availableActions']) delete copy[key];
    return copy;
}

test('Gobang registers as a two-player no-forbidden-move game', () => {
    const session = createSession();
    const state = session.getPlayerState('black');
    assert.deepEqual(state.rules, { board: { width: 15, height: 15 }, winLength: 5, forbiddenMoves: false, overlineWins: true });
    assert.equal(state.turn, 'black');
    assert.equal(state.currentTurn, 'black');
    assert.equal(state.myIsCurrentTurn, true);
    assert.equal(state.legalMoves.place.length, 225);
    assert.equal(session.getPlayerState('white').legalMoves.place, undefined);
});

test('Gobang alternates legal placements and rejects illegal actions without changing state', () => {
    const session = createSession();
    const before = stateWithoutView(session.getPlayerState('black'));
    assert.equal(session.handleAction('white', { kind: 'place', x: 0, y: 0 }).success, false);
    assert.deepEqual(stateWithoutView(session.getPlayerState('black')), before);
    assert.equal(session.handleAction('black', { kind: 'place', x: 15, y: 0 }).success, false);
    assert.equal(session.handleAction('black', { kind: 'place', x: 0, y: 0 }).success, true);
    assert.equal(session.handleAction('white', { kind: 'place', x: 0, y: 0 }).success, false);
    assert.equal(session.handleAction('white', { kind: 'place', x: 1, y: 0 }).success, true);
    assert.equal(session.engine.board.size, 2);
});

test('Gobang detects horizontal, vertical, diagonal, and overline wins', () => {
    for (const sequence of [
        [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
        [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
        [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
        [[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]],
        [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
    ]) {
        const session = createSession();
        for (let index = 0; index < sequence.length; index += 1) {
            if (session.engine.status !== 'playing') break;
            const [x, y] = sequence[index];
            const result = session.handleAction('black', { kind: 'place', x, y });
            assert.equal(result.success, true);
            if (index < sequence.length - 1 && session.engine.status === 'playing') assert.equal(session.handleAction('white', { kind: 'place', x: 14 - index, y: 14 }).success, true);
        }
        assert.equal(session.engine.status, 'ended');
        assert.equal(session.engine.winner.id, 'black');
    }
});

test('Gobang rejects moves after a win and supports a full-board draw', () => {
    const session = createSession();
    for (const [id, x, y] of [['black', 0, 0], ['white', 1, 0], ['black', 0, 1], ['white', 1, 1], ['black', 0, 2], ['white', 1, 2], ['black', 0, 3], ['white', 1, 3], ['black', 0, 4]]) assert.equal(session.handleAction(id, { kind: 'place', x, y }).success, true);
    const ended = stateWithoutView(session.getPlayerState('black'));
    assert.equal(session.handleAction('white', { kind: 'place', x: 2, y: 2 }).success, false);
    assert.deepEqual(stateWithoutView(session.getPlayerState('black')), ended);

    const draw = createSession();
    draw.engine.board = new Map();
    for (let y = 0; y < GobangEngine.BOARD_SIZE; y += 1) for (let x = 0; x < GobangEngine.BOARD_SIZE; x += 1) {
        if (x === 13 && y === 14) continue;
        const color = (x + 2 * y) % 4 < 2 ? 'black' : 'white';
        draw.engine.board.set(`${x},${y}`, { id: `${x}-${y}`, x, y, color, move: x + y * 15 + 1 });
    }
    draw.engine.moveNumber = 224;
    draw.engine.turn = 'black';
    const occupied = draw.handleAction('black', { kind: 'place', x: 0, y: 0 });
    assert.equal(occupied.success, false, '已占位置不能再次落子');
    const last = draw.handleAction('black', { kind: 'place', x: 13, y: 14 });
    assert.equal(last.success, true);
    assert.equal(last.ended, true);
    assert.equal(draw.engine.drawReason, '棋盘已满，和棋');
});

test('Gobang session works through the generic Room adapter', () => {
    const room = new Room('gobang-room', 'black', '黑方', 'gobang');
    assert.equal(room.addPlayer({ ...players[0] }).success, true);
    assert.equal(room.addPlayer({ ...players[1] }).success, true);
    assert.equal(room.startGame().success, true);
    assert.equal(room.getPlayerGameState('black').myColor, 'black');
    assert.equal(room.handleGameAction('black', { kind: 'place', x: 7, y: 7 }).success, true);
    assert.equal(room.getPlayerGameState('white').pieces.length, 1);
});
