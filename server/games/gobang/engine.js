const BOARD_SIZE = 15;
const WIN_LENGTH = 5;

function key(x, y) { return `${x},${y}`; }
function inside(x, y) { return Number.isInteger(x) && x >= 0 && x < BOARD_SIZE && Number.isInteger(y) && y >= 0 && y < BOARD_SIZE; }

class GobangEngine {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players.slice(0, 2).map((player, index) => ({
            id: player.id,
            name: player.name,
            color: index === 0 ? 'black' : 'white',
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.board = new Map();
        this.status = 'waiting';
        this.turn = 'black';
        this.currentTurnIndex = 0;
        this.lastMove = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.drawReason = null;
        this.moveNumber = 0;
    }

    start() {
        if (this.players.length !== 2) return { success: false, message: '五子棋需要 2 名玩家' };
        this.board.clear();
        this.status = 'playing';
        this.turn = 'black';
        this.currentTurnIndex = 0;
        this.lastMove = null;
        this.lastAction = null;
        this.actionLog = [`${this.players[0].name} 执黑，黑方先行`];
        this.winner = null;
        this.drawReason = null;
        this.moveNumber = 0;
        return this._success('五子棋开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '棋局尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (player.color !== this.turn) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind !== 'place') return { success: false, message: '请提交落子操作', state: this.getPlayerState(playerId) };
        const x = action.x;
        const y = action.y;
        if (!inside(x, y)) return { success: false, message: '落子位置超出棋盘', state: this.getPlayerState(playerId) };
        const position = key(x, y);
        if (this.board.has(position)) return { success: false, message: '这个位置已经有棋子', state: this.getPlayerState(playerId) };

        const stone = { id: `${player.color}-${this.moveNumber + 1}`, x, y, color: player.color, move: this.moveNumber + 1 };
        this.board.set(position, stone);
        this.moveNumber += 1;
        this.lastMove = { x, y, color: player.color, playerId, move: this.moveNumber };
        this.lastAction = { kind: 'place', playerId, playerName: player.name, x, y, color: player.color, message: `${player.name} 落子于 ${String.fromCharCode(65 + x)}${y + 1}` };
        this.actionLog.push(this.lastAction.message);

        if (this._hasFive(x, y, player.color)) {
            this.status = 'ended';
            this.winner = player;
            this.actionLog.push(`${player.name} 五子连珠，获胜`);
            return this._success(`${player.name} 五子连珠，获胜`);
        }
        if (this.board.size === BOARD_SIZE * BOARD_SIZE) {
            this.status = 'ended';
            this.drawReason = '棋盘已满，和棋';
            this.actionLog.push(this.drawReason);
            return this._success(this.drawReason);
        }
        this.turn = this.turn === 'black' ? 'white' : 'black';
        this.currentTurnIndex = this.turn === 'black' ? 0 : 1;
        return this._success(this.lastAction.message);
    }

    _hasFive(x, y, color) {
        return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
            let count = 1;
            for (const direction of [1, -1]) {
                let nx = x + dx * direction;
                let ny = y + dy * direction;
                while (this.board.get(key(nx, ny))?.color === color) {
                    count += 1;
                    nx += dx * direction;
                    ny += dy * direction;
                }
            }
            return count >= WIN_LENGTH;
        });
    }

    getPublicState() {
        return {
            roomId: this.roomId,
            status: this.status,
            turn: this.turn,
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            players: this.players.map(player => ({ ...player, isCurrentTurn: player.color === this.turn })),
            pieces: [...this.board.values()],
            lastMove: this.lastMove,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-14),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            drawReason: this.drawReason,
            moveNumber: this.moveNumber,
            rules: { board: { width: BOARD_SIZE, height: BOARD_SIZE }, winLength: WIN_LENGTH, forbiddenMoves: false, overlineWins: true },
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        state.myId = playerId;
        state.myColor = this.playerMap[playerId]?.color || null;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.legalMoves = {};
        if (state.myIsCurrentTurn && this.status === 'playing') {
            state.legalMoves.place = [];
            for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) if (!this.board.has(key(x, y))) state.legalMoves.place.push({ x, y });
        }
        state.availableActions = { canPlace: state.myIsCurrentTurn && this.status === 'playing' };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (this.status === 'playing') {
            this.status = 'ended';
            this.winner = this.players.find(other => other.id !== playerId && other.isOnline) || null;
            this.actionLog.push(`${player.name} 离开棋局`);
        }
        return this._success(`${player.name} 离开棋局`);
    }

    _success(message) {
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null };
    }

    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = GobangEngine;
module.exports.BOARD_SIZE = BOARD_SIZE;
module.exports.WIN_LENGTH = WIN_LENGTH;
