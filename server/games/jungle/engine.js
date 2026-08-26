// Traditional Dou Shou Qi has eight animals per side.  Keep lion and
// leopard as separate piece types; older code used `l` for both and made the
// starting position impossible to represent faithfully.
const PIECES = {
    r: { name: '老鼠', rank: 1, symbol: '鼠' },
    c: { name: '猫', rank: 2, symbol: '猫' },
    d: { name: '狗', rank: 3, symbol: '狗' },
    w: { name: '狼', rank: 4, symbol: '狼' },
    l: { name: '豹', rank: 5, symbol: '豹' },
    t: { name: '虎', rank: 6, symbol: '虎' },
    j: { name: '狮', rank: 7, symbol: '狮' },
    e: { name: '大象', rank: 8, symbol: '象' },
};
function key(x, y) { return `${x},${y}`; }
function inside(x, y) { return x >= 0 && x < 7 && y >= 0 && y < 9; }

class JungleEngine {
    constructor(roomId, players) { this.roomId = roomId; this.players = players.slice(0, 2).map((p, i) => ({ id: p.id, name: p.name, color: i === 0 ? 'red' : 'blue', isOnline: true })); this.playerMap = Object.fromEntries(this.players.map(p => [p.id, p])); this.board = this._createBoard(); this.status = 'waiting'; this.turn = 'red'; this.currentTurnIndex = 0; this.lastMove = null; this.lastAction = null; this.actionLog = []; this.winner = null; }
    _createBoard() { const b = new Map(); const add = (x, y, type, color, id) => b.set(key(x, y), { x, y, type, color, id }); add(0, 0, 'j', 'blue', 'bj0'); add(6, 0, 't', 'blue', 'bt0'); add(1, 1, 'd', 'blue', 'bd1'); add(5, 1, 'c', 'blue', 'bc5'); add(0, 2, 'r', 'blue', 'br0'); add(2, 2, 'l', 'blue', 'bl2'); add(4, 2, 'w', 'blue', 'bw4'); add(6, 2, 'e', 'blue', 'be6'); add(0, 8, 't', 'red', 'rt0'); add(6, 8, 'j', 'red', 'rj6'); add(1, 7, 'c', 'red', 'rc1'); add(5, 7, 'd', 'red', 'rd5'); add(0, 6, 'e', 'red', 're0'); add(2, 6, 'w', 'red', 'rw2'); add(4, 6, 'l', 'red', 'rl4'); add(6, 6, 'r', 'red', 'rr6'); return b; }
    start() { if (this.players.length !== 2) return { success: false, message: '斗兽棋需要 2 名玩家' }; this.status = 'playing'; this.actionLog = [`${this.players[0].name} 执红，请开始走棋`]; return this._success('斗兽棋开始'); }
    handleAction(playerId, action = {}) { if (this.status !== 'playing') return { success: false, message: '棋局尚未开始或已结束' }; const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' }; if (player.color !== this.turn) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) }; const from = this._coord(action.from), to = this._coord(action.to), piece = from && this.board.get(key(from.x, from.y)); if (action.kind !== 'move' || !from || !to || !piece || piece.color !== this.turn) return { success: false, message: '请移动自己的兽子', state: this.getPlayerState(playerId) }; const move = this._legalMoves(piece).find(m => m.to.x === to.x && m.to.y === to.y); if (!move) return { success: false, message: '这步不符合斗兽棋规则', state: this.getPlayerState(playerId) }; const captured = this.board.get(key(to.x, to.y)); this.board.delete(key(from.x, from.y)); this.board.set(key(to.x, to.y), { ...piece, x: to.x, y: to.y }); this.lastMove = { from, to, piece: { ...piece }, capture: captured || null }; this.lastAction = { kind: 'move', playerId, playerName: player.name, message: `${player.name} 的${PIECES[piece.type].name}走到了新位置` }; this.actionLog.push(this.lastAction.message); const enemyDen = this._den(this.turn === 'red' ? 'blue' : 'red'); if (to.x === enemyDen.x && to.y === enemyDen.y) { this.status = 'ended'; this.winner = player; this.actionLog.push(`${player.name} 占领对方兽穴`); return this._success(`${player.name} 占领兽穴，获胜`); } this.turn = this.turn === 'red' ? 'blue' : 'red'; this.currentTurnIndex = this.turn === 'red' ? 0 : 1; this._evaluate(); return this._success(this.lastAction.message); }
    _coord(v) { return v && Number.isInteger(v.x) && Number.isInteger(v.y) && inside(v.x, v.y) ? { x: v.x, y: v.y } : null; }
    _legalMoves(piece) {
        return this._pseudo(piece).filter(move => {
            const target = this.board.get(key(move.to.x, move.to.y));
            return !target || this._canCapture(piece, target, move.to);
        });
    }
    _pseudo(piece) { const result = []; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const target = this._jump(piece, dx, dy); if (target) result.push({ from: { x: piece.x, y: piece.y }, to: target }); } return result; }
    _jump(piece, dx, dy) { let x = piece.x + dx, y = piece.y + dy; if (!inside(x, y)) return null; if (this._water(x, y) && ['j', 't'].includes(piece.type)) { while (inside(x, y) && this._water(x, y)) { if (this.board.get(key(x, y))?.type === 'r') return null; x += dx; y += dy; } if (!inside(x, y)) return null; } else if (this._water(x, y) && piece.type !== 'r') return null; const ownDen = this._den(piece.color); if (x === ownDen.x && y === ownDen.y) return null; return { x, y }; }
    _canCapture(attacker, target, destination) {
        if (attacker.color === target.color) return false;
        // A piece that is in water may only attack another piece in water;
        // only a rat may enter water and attack a piece already there.
        if (this._water(attacker.x, attacker.y) && !this._water(destination.x, destination.y)) return false;
        if (!this._water(attacker.x, attacker.y) && this._water(destination.x, destination.y) && attacker.type !== 'r') return false;
        const targetRank = this._inOpponentTrap(target) ? 0 : PIECES[target.type].rank;
        // The elephant/rat exception applies outside traps.  A piece in the
        // opponent's trap has rank zero and can be captured by any animal.
        if (targetRank > 0 && attacker.type === 'r' && target.type === 'e') return true;
        if (targetRank > 0 && attacker.type === 'e' && target.type === 'r') return false;
        return PIECES[attacker.type].rank >= targetRank;
    }
    _water(x, y) { return [1, 2, 4, 5].includes(x) && y >= 3 && y <= 5; }
    _den(color) { return color === 'red' ? { x: 3, y: 8 } : { x: 3, y: 0 }; }
    _trapOwner(x, y) { if ((y === 0 || y === 8) && [2, 4].includes(x)) return y === 0 ? 'blue' : 'red'; if (y === 1 && x === 3) return 'blue'; if (y === 7 && x === 3) return 'red'; return null; }
    _inOpponentTrap(piece) { const owner = this._trapOwner(piece.x, piece.y); return owner && owner !== piece.color; }
    _evaluate() {
        const pieces = [...this.board.values()].filter(piece => piece.color === this.turn);
        if (!pieces.length || !pieces.some(piece => this._legalMoves(piece).length)) {
            this.status = 'ended';
            this.winner = this.players.find(player => player.color !== this.turn) || null;
            this.actionLog.push(`${this.winner?.name || '对手'} 赢得斗兽棋`);
        }
    }
    getPublicState() {
        return {
            roomId: this.roomId, status: this.status, turn: this.turn,
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            players: this.players.map(player => ({ ...player, isCurrentTurn: player.color === this.turn })),
            pieces: [...this.board.values()], lastMove: this.lastMove, lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-14), winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            rules: { waterJumpers: ['t', 'j'], trapRank: 0, board: { width: 7, height: 9 } },
            terrain: { water: [[1, 3], [2, 3], [4, 3], [5, 3], [1, 4], [2, 4], [4, 4], [5, 4], [1, 5], [2, 5], [4, 5], [5, 5]], dens: [{ x: 3, y: 0, color: 'blue' }, { x: 3, y: 8, color: 'red' }], traps: [[2, 0], [4, 0], [3, 1], [2, 8], [4, 8], [3, 7]] },
        };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId];
        state.myId = playerId; state.myColor = player?.color || null; state.myIsCurrentTurn = state.currentTurn === playerId; state.legalMoves = {};
        if (player?.color === this.turn && this.status === 'playing') for (const piece of this.board.values()) if (piece.color === player.color) state.legalMoves[piece.id] = this._legalMoves(piece).map(move => move.to);
        state.availableActions = { canMove: state.myIsCurrentTurn && this.status === 'playing' };
        return state;
    }
    handlePlayerLeave(playerId) { const p = this.playerMap[playerId]; if (!p) return { success: false, message: '玩家不存在' }; p.isOnline = false; if (this.status === 'playing') { this.status = 'ended'; this.winner = this.players.find(other => other.id !== playerId && other.isOnline) || null; } return this._success(`${p.name} 离开棋局`); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}
module.exports = JungleEngine;
module.exports.PIECES = PIECES;
