const BOARD_ROWS = 17;
const BOARD_MAX_X = 24;
const BOARD_MAX_Y = 16;
const BOARD_SIZE = 121;
const PIECES_PER_PLAYER = 10;

// The six directions on the triangular lattice.  Horizontal holes are two
// coordinate units apart; diagonal holes are one row and one column apart.
const DIRECTIONS = [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const CORNER_OPTIONS = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
};

function key(x, y) { return `${x},${y}`; }
function same(a, b) { return a?.x === b?.x && a?.y === b?.y; }
function validCoordinate(x, y) {
    return Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && x <= BOARD_MAX_X
        && y >= 0 && y <= BOARD_MAX_Y;
}

function createCells() {
    const rowCounts = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
    const cells = [];
    for (let y = 0; y < rowCounts.length; y += 1) {
        const count = rowCounts[y];
        const start = 13 - count;
        for (let index = 0; index < count; index += 1) cells.push({ x: start + index * 2, y });
    }
    return cells;
}

const CELLS = createCells();
const CELL_KEYS = new Set(CELLS.map(cell => key(cell.x, cell.y)));

function inside(x, y) { return validCoordinate(x, y) && CELL_KEYS.has(key(x, y)); }

function createCorner(index) {
    return CELLS.filter(({ x, y }) => {
        if (index === 0) return y <= 3;
        if (index === 1) return y >= 4 && y <= 7 && x >= 14 + y;
        if (index === 2) return y >= 9 && y <= 12 && x >= 30 - y;
        if (index === 3) return y >= 13;
        if (index === 4) return y >= 9 && y <= 12 && x <= y - 6;
        return y >= 4 && y <= 7 && x <= 10 - y;
    });
}

const CORNERS = Array.from({ length: 6 }, (_, index) => createCorner(index));
const CORNER_KEYS = CORNERS.map(corner => new Set(corner.map(cell => key(cell.x, cell.y))));

class CheckersEngine {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players.slice(0, 6).map((player, index) => ({
            id: player.id,
            name: player.name,
            color: PLAYER_COLORS[index],
            corner: null,
            targetCorner: null,
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.board = new Map();
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.pendingMove = null;
        this.moveNumber = 0;
        this.lastMove = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.studyTemplates = [];
    }

    start() {
        if (this.players.length < 2 || this.players.length > 6) return { success: false, message: '跳棋需要 2 至 6 名玩家' };
        const corners = CORNER_OPTIONS[this.players.length];
        this.board.clear();
        this.players.forEach((player, index) => {
            player.corner = corners[index];
            player.targetCorner = (player.corner + 3) % 6;
            CORNERS[player.corner].forEach((cell, pieceIndex) => {
                const id = `${player.id}-piece-${pieceIndex + 1}`;
                this.board.set(key(cell.x, cell.y), { id, playerId: player.id, color: player.color, number: pieceIndex + 1, x: cell.x, y: cell.y });
            });
        });
        this.status = 'playing';
        this.currentTurnIndex = 0;
        this.pendingMove = null;
        this.moveNumber = 0;
        this.lastMove = null;
        this.lastAction = null;
        this.winner = null;
        this.actionLog = [`${this.players[0].name} 先手，目标是对角的 ${this.players[0].targetCorner + 1} 号角`];
        this.studyTemplates = [...this.board.values()].map(piece => ({ ...piece }));
        return this._success('跳棋开始');
    }

    handleStudySetup(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (!player || this.status !== 'playing') return { success: false, message: '摆棋阶段不可用' };
        const valid = point => validCoordinate(point?.x, point?.y) && inside(point.x, point.y);
        if (action.kind === 'reset') return this.start();
        if (action.kind === 'clear') { this.board.clear(); this.pendingMove = null; this.winner = null; this.actionLog = ['已清空跳棋局面']; return this._success('已清空局面'); }
        if (action.kind === 'setTurn') {
            const turnIndex = this.players.findIndex(item => item.color === action.color);
            if (turnIndex < 0) return { success: false, message: '未知的先手阵营', state: this.getPlayerState(playerId) };
            this.currentTurnIndex = turnIndex;
            this.pendingMove = null;
            this.winner = null;
            this.lastAction = { kind: 'setTurn', color: action.color, message: `已将 ${action.color} 设为先手` };
            return this._success(this.lastAction.message);
        }
        if (action.kind === 'remove') { if (!valid(action) || !this.board.delete(key(action.x, action.y))) return { success: false, message: '该位置没有可移除的棋子', state: this.getPlayerState(playerId) }; return this._success('已移除棋子'); }
        if (action.kind === 'place') {
            if (!valid(action) || this.board.has(key(action.x, action.y))) return { success: false, message: '摆棋位置无效或已有棋子', state: this.getPlayerState(playerId) };
            const color = action.color || player.color;
            const template = this.studyTemplates.find(piece => piece.color === color && ![...this.board.values()].some(current => current.id === piece.id));
            if (!template) return { success: false, message: '该阵营没有可再摆放的棋子', state: this.getPlayerState(playerId) };
            this.board.set(key(action.x, action.y), { ...template, x: action.x, y: action.y });
            return this._success('已摆放棋子');
        }
        if (action.kind === 'move') {
            const from = action.from, to = action.to; const piece = from && this.board.get(key(from.x, from.y));
            if (!valid(from) || !valid(to) || !piece || piece.color !== player.color || this.board.has(key(to.x, to.y))) return { success: false, message: '只能移动当前执棋方的棋子到空位', state: this.getPlayerState(playerId) };
            this.board.delete(key(from.x, from.y)); this.board.set(key(to.x, to.y), { ...piece, x: to.x, y: to.y }); return this._success('已调整棋子位置');
        }
        return { success: false, message: '未知摆棋操作', state: this.getPlayerState(playerId) };
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '棋局尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.players[this.currentTurnIndex]?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind === 'selectPiece' || action.kind === 'select') return this._selectPiece(player, action.pieceId);
        if (action.kind === 'movePiece' || action.kind === 'move') return this._movePiece(player, action.to || { x: action.x, y: action.y });
        if (action.kind === 'endMove' || action.kind === 'endJump') return this._endMove(player);
        return { success: false, message: '未知操作', state: this.getPlayerState(playerId) };
    }

    _selectPiece(player, pieceId) {
        if (this.pendingMove) {
            if (this.pendingMove.playerId !== player.id || this.pendingMove.jumpCount > 0 || this.pendingMove.mode === 'jump') {
                return { success: false, message: '连续跳跃已经开始，请继续跳跃或结束移动', state: this.getPlayerState(player.id) };
            }
            if (this.pendingMove.pieceId === String(pieceId)) {
                this.pendingMove = null;
                this.lastAction = { kind: 'cancelSelection', playerId: player.id, message: `${player.name} 取消了选择` };
                return this._success(this.lastAction.message);
            }
        }
        const piece = [...this.board.values()].find(item => item.id === String(pieceId));
        if (!piece || piece.playerId !== player.id) return { success: false, message: '只能选择自己的棋子', state: this.getPlayerState(player.id) };
        const moves = this._movesFor(piece);
        if (!moves.step.length && !moves.jump.length) return { success: false, message: '这枚棋子没有合法移动', state: this.getPlayerState(player.id) };
        this.pendingMove = { playerId: player.id, pieceId: piece.id, from: { x: piece.x, y: piece.y }, current: { x: piece.x, y: piece.y }, path: [{ x: piece.x, y: piece.y }], jumpCount: 0, mode: null };
        this.lastAction = { kind: 'selectPiece', playerId: player.id, pieceId: piece.id, message: `${player.name} 选中了一枚棋子` };
        return this._success(this.lastAction.message);
    }

    _movePiece(player, target) {
        if (!this.pendingMove || this.pendingMove.playerId !== player.id) return { success: false, message: '请先选择自己的棋子', state: this.getPlayerState(player.id) };
        if (!target || !validCoordinate(target.x, target.y) || !inside(target.x, target.y)) return { success: false, message: '目标位置不在棋盘上', state: this.getPlayerState(player.id) };
        const pending = this.pendingMove;
        const piece = this.board.get(key(pending.from.x, pending.from.y));
        if (!piece || piece.id !== pending.pieceId) return { success: false, message: '选中的棋子状态已失效', state: this.getPlayerState(player.id) };
        const jumps = this._jumpTargets(pending.current, pending);
        const isJump = jumps.some(move => same(move.to, target));
        if (isJump) {
            pending.mode = 'jump';
            pending.current = { x: target.x, y: target.y };
            pending.path.push({ x: target.x, y: target.y });
            pending.jumpCount += 1;
            this.lastMove = { pieceId: piece.id, playerId: player.id, from: pending.from, to: pending.current, path: pending.path.slice(), complete: false };
            this.lastAction = { kind: 'jump', playerId: player.id, pieceId: piece.id, message: `${player.name} 跳跃了 ${pending.jumpCount} 次，可继续跳或结束移动` };
            return this._success(this.lastAction.message);
        }
        const steps = pending.jumpCount === 0 && !pending.mode ? this._stepTargets(pending.current) : [];
        if (steps.some(move => same(move, target))) return this._commitMove(player, piece, target, 'step');
        return { success: false, message: '目标位置不是合法的相邻移动或跳跃位置', state: this.getPlayerState(player.id) };
    }

    _endMove(player) {
        if (!this.pendingMove || this.pendingMove.playerId !== player.id || this.pendingMove.jumpCount < 1) return { success: false, message: '当前没有可以结束的连续跳跃', state: this.getPlayerState(player.id) };
        const pending = this.pendingMove;
        const piece = this.board.get(key(pending.from.x, pending.from.y));
        return this._commitMove(player, piece, pending.current, 'jump', pending.path);
    }

    _commitMove(player, piece, target, mode, path = [piece ? { x: piece.x, y: piece.y } : target, target]) {
        const from = { x: piece?.x, y: piece?.y };
        const targetOccupied = this.board.has(key(target.x, target.y)) && !same(target, from);
        if (!piece || piece.playerId !== player.id || targetOccupied) return { success: false, message: '目标位置已经有棋子', state: this.getPlayerState(player.id) };
        this.board.delete(key(piece.x, piece.y));
        piece.x = target.x; piece.y = target.y;
        this.board.set(key(piece.x, piece.y), piece);
        this.pendingMove = null;
        this.moveNumber += 1;
        this.lastMove = { pieceId: piece.id, playerId: player.id, from, to: { x: target.x, y: target.y }, path: path.slice(), mode, complete: true, move: this.moveNumber };
        const jumpCount = Math.max(1, path.length - 1);
        const moveMessage = mode === 'jump' ? `${player.name} 完成连续跳跃（${jumpCount} 跳）` : `${player.name} 完成相邻移动`;
        this.lastAction = { kind: 'movePiece', playerId: player.id, pieceId: piece.id, from, to: { x: target.x, y: target.y }, mode, message: moveMessage };
        this.actionLog.push(this.lastAction.message);
        if (this._hasWon(player)) {
            this.status = 'ended';
            this.winner = player;
            this.actionLog.push(`${player.name} 的全部棋子进入目标角，获胜！`);
            return this._success(`${player.name} 获胜`);
        }
        this._advanceTurn();
        return this._success(this.lastAction.message);
    }

    _stepTargets(position) {
        return DIRECTIONS.map(([dx, dy]) => ({ x: position.x + dx, y: position.y + dy }))
            .filter(target => inside(target.x, target.y) && !this.board.has(key(target.x, target.y)));
    }

    _jumpTargets(position, pending = null) {
        return DIRECTIONS.map(([dx, dy]) => {
            const over = { x: position.x + dx, y: position.y + dy };
            const to = { x: position.x + dx * 2, y: position.y + dy * 2 };
            return { over, to };
        }).filter(move => inside(move.over.x, move.over.y) && inside(move.to.x, move.to.y) && this._occupied(move.over, pending) && !this._occupied(move.to, pending));
    }

    _occupied(position, pending = null) {
        if (pending) {
            if (same(position, pending.from)) return false;
            if (same(position, pending.current)) return true;
        }
        return this.board.has(key(position.x, position.y));
    }

    _movesFor(piece) {
        return { step: this._stepTargets(piece), jump: this._jumpTargets(piece, null).map(move => move.to) };
    }

    _hasWon(player) {
        const target = CORNER_KEYS[player.targetCorner];
        const pieces = [...this.board.values()].filter(piece => piece.playerId === player.id);
        return pieces.length === PIECES_PER_PLAYER && pieces.every(piece => target.has(key(piece.x, piece.y)));
    }

    _advanceTurn(endWhenSolo = true) {
        const active = this.players.filter(player => player.isOnline);
        if (active.length <= 1) {
            if (endWhenSolo) {
                this.status = 'ended';
                this.winner = active[0] || null;
            } else if (active.length === 1) {
                this.currentTurnIndex = this.players.indexOf(active[0]);
            }
            return;
        }
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const next = (this.currentTurnIndex + offset) % this.players.length;
            if (this.players[next]?.isOnline) {
                this.currentTurnIndex = next;
                this.actionLog.push(`${this.players[next].name} 的回合`);
                return;
            }
        }
    }

    handlePlayerDisconnect(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已断线' };
        const wasCurrent = this.players[this.currentTurnIndex]?.id === playerId;
        player.isOnline = false;
        if (this.pendingMove?.playerId === playerId) this.pendingMove = null;
        if (this.status === 'playing' && wasCurrent) this._advanceTurn(false);
        return this._success(`${player.name} 连接中断，等待重连`);
    }

    handlePlayerReconnect(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = true;
        if (this.status === 'playing' && !this.players[this.currentTurnIndex]?.isOnline) {
            this.currentTurnIndex = this.players.indexOf(player);
        }
        return this._success(`${player.name} 已重连`);
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (this.pendingMove?.playerId === playerId) this.pendingMove = null;
        if (this.status === 'playing') {
            const active = this.players.filter(item => item.isOnline);
            if (active.length <= 1) {
                this.status = 'ended';
                this.winner = active[0] || null;
                this.actionLog.push(`${player.name} 离开棋局`);
            } else if (this.players[this.currentTurnIndex]?.id === playerId) {
                this._advanceTurn();
            }
        }
        return this._success(`${player.name} 离开棋局`);
    }

    getPublicState() {
        const current = this.players[this.currentTurnIndex];
        return {
            roomId: this.roomId,
            status: this.status,
            currentTurn: current?.id || null,
            currentTurnName: current?.name || null,
            players: this.players.map(player => ({ ...player, isCurrentTurn: player.id === current?.id, pieceCount: [...this.board.values()].filter(piece => piece.playerId === player.id).length })),
            pieces: [...this.board.values()].map(piece => ({ ...piece })),
            pendingMove: this.pendingMove ? { ...this.pendingMove, path: this.pendingMove.path.map(point => ({ ...point })) } : null,
            lastMove: this.lastMove,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-18),
            moveNumber: this.moveNumber,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            rules: { board: { rows: BOARD_ROWS, holes: BOARD_SIZE }, piecesPerPlayer: PIECES_PER_PLAYER, movement: 'adjacent-or-chain-jump', target: 'opposite-corner', players: '2-6' },
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myColor = player?.color || null;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.selectedPiece = this.pendingMove?.playerId === playerId ? { pieceId: this.pendingMove.pieceId, current: { ...this.pendingMove.current }, path: this.pendingMove.path.map(point => ({ ...point })), jumpCount: this.pendingMove.jumpCount, mode: this.pendingMove.mode } : null;
        state.legalMoves = { select: [], step: [], jump: [] };
        state.availableActions = { canSelect: false, canMove: false, canEndMove: false };
        if (state.myIsCurrentTurn && this.status === 'playing' && player) {
            if (this.pendingMove?.playerId === playerId) {
                if (this.pendingMove.jumpCount === 0 && !this.pendingMove.mode) {
                    state.legalMoves.select = this.boardValuesFor(player).filter(piece => {
                        const moves = this._movesFor(piece);
                        return moves.step.length || moves.jump.length;
                    }).map(piece => piece.id);
                    state.availableActions.canSelect = state.legalMoves.select.length > 0;
                }
                state.legalMoves.step = this.pendingMove.jumpCount === 0 && !this.pendingMove.mode ? this._stepTargets(this.pendingMove.current) : [];
                state.legalMoves.jump = this._jumpTargets(this.pendingMove.current, this.pendingMove).map(move => move.to);
                state.availableActions.canMove = state.legalMoves.step.length > 0 || state.legalMoves.jump.length > 0;
                state.availableActions.canEndMove = this.pendingMove.jumpCount > 0;
            } else if (!this.pendingMove) {
                state.legalMoves.select = this.boardValuesFor(player).filter(piece => {
                    const moves = this._movesFor(piece);
                    return moves.step.length || moves.jump.length;
                }).map(piece => piece.id);
                state.availableActions.canSelect = state.legalMoves.select.length > 0;
            }
        }
        return state;
    }

    boardValuesFor(player) { return [...this.board.values()].filter(piece => piece.playerId === player.id); }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = CheckersEngine;
module.exports.BOARD_ROWS = BOARD_ROWS;
module.exports.BOARD_MAX_X = BOARD_MAX_X;
module.exports.BOARD_MAX_Y = BOARD_MAX_Y;
module.exports.BOARD_SIZE = BOARD_SIZE;
module.exports.PIECES_PER_PLAYER = PIECES_PER_PLAYER;
module.exports.CELLS = CELLS;
module.exports.CORNERS = CORNERS;
module.exports.CORNER_OPTIONS = CORNER_OPTIONS;
