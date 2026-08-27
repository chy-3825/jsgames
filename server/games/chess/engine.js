const FILES = 'abcdefgh';
function key(x, y) { return `${x},${y}`; }
function inside(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }

class ChessEngine {
    constructor(roomId, players) {
        this.roomId = roomId; this.players = players.slice(0, 2).map((p, i) => ({ id: p.id, name: p.name, color: i === 0 ? 'white' : 'black', isOnline: true })); this.playerMap = Object.fromEntries(this.players.map(p => [p.id, p])); this.board = this._createBoard(); this.status = 'waiting'; this.turn = 'white'; this.currentTurnIndex = 0; this.castling = { K: true, Q: true, k: true, q: true }; this.enPassant = null; this.lastMove = null; this.lastAction = null; this.actionLog = []; this.winner = null; this.drawReason = null; this.halfmoveClock = 0; this.positionCounts = new Map();
    }
    _createBoard() { const board = new Map(); const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']; for (let x = 0; x < 8; x++) { board.set(key(x, 0), { id: `br${x}`, type: back[x], color: 'black', moved: false }); board.set(key(x, 1), { id: `bp${x}`, type: 'p', color: 'black', moved: false }); board.set(key(x, 6), { id: `wp${x}`, type: 'p', color: 'white', moved: false }); board.set(key(x, 7), { id: `wr${x}`, type: back[x], color: 'white', moved: false }); } return board; }
    start() { if (this.players.length !== 2) return { success: false, message: '国际象棋需要 2 名玩家' }; this.status = 'playing'; this.positionCounts.clear(); this._recordPosition(); this.actionLog = [`${this.players[0].name} 执白，请开始走棋`]; return this._success('国际象棋开始'); }
    handleAction(playerId, action = {}) { if (this.status !== 'playing') return { success: false, message: '棋局尚未开始或已结束' }; const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' }; if (player.color !== this.turn) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) }; if (action.kind === 'claimDraw') { const repetitions = this.positionCounts.get(this._positionKey()) || 0; if (this.halfmoveClock < 100 && repetitions < 3) return { success: false, message: '当前还不能声明和棋', state: this.getPlayerState(playerId) }; const reason = this.halfmoveClock >= 100 ? '五十回合规则和棋' : '三次重复局面和棋'; this._endDraw(reason); this.lastAction = { kind: 'draw', playerId, playerName: player.name, message: `${player.name} 声明${reason}` }; return this._success(this.lastAction.message); } if (action.kind !== 'move') return { success: false, message: '请提交走棋操作', state: this.getPlayerState(playerId) }; const from = this._coord(action.from); const to = this._coord(action.to); const piece = from && this.board.get(key(from.x, from.y)); if (!from || !to) return { success: false, message: '坐标无效', state: this.getPlayerState(playerId) }; if (!piece || piece.color !== this.turn) return { success: false, message: '只能移动自己的棋子', state: this.getPlayerState(playerId) }; const move = this._legalMovesForPiece(piece).find(m => m.to.x === to.x && m.to.y === to.y); if (!move) return { success: false, message: '这步不符合国际象棋规则', state: this.getPlayerState(playerId) }; const requestedPromotion = this._normalizePromotion(action.promotion); const promotion = move.promotion ? requestedPromotion || 'q' : null; const wasPawn = piece.type === 'p'; const wasCapture = Boolean(move.capture); this._updateCastlingRights(piece, from, to); this._applyMove(this.board, { ...move, promotion }); this.lastMove = { from, to, piece: { ...piece }, capture: wasCapture, enPassant: Boolean(move.enPassant), castle: Boolean(move.castle), promotion }; this.enPassant = wasPawn && Math.abs(to.y - from.y) === 2 ? { x: from.x, y: (to.y + from.y) / 2 } : null; this.halfmoveClock = wasPawn || wasCapture ? 0 : this.halfmoveClock + 1; this.lastAction = { kind: 'move', playerId, playerName: player.name, message: `${player.name} 走了 ${piece.type.toUpperCase()} ${FILES[from.x]}${8 - from.y}→${FILES[to.x]}${8 - to.y}` }; this.actionLog.push(this.lastAction.message); this.turn = this.turn === 'white' ? 'black' : 'white'; this.currentTurnIndex = this.turn === 'white' ? 0 : 1; const checkingPieceIds = this._checkingPieces(this.turn, this.board); this.lastMove.gaveCheck = checkingPieceIds.length > 0; this.lastMove.checkingPieceIds = checkingPieceIds; this._recordPosition(); this._evaluatePosition(); return this._success(this.lastAction.message); }
    handleStudySetup(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (!player || this.status !== 'playing') return { success: false, message: '摆棋阶段不可用' };
        const coord = value => this._coord(value);
        const resetMeta = message => { this.status = 'playing'; this.winner = null; this.drawReason = null; this.lastMove = null; this.lastAction = null; this.halfmoveClock = 0; this.enPassant = null; this.positionCounts.clear(); this._recordPosition(); this.actionLog = [message]; return this._success(message); };
        const invalidateCastling = () => { this.castling = { K: false, Q: false, k: false, q: false }; };
        if (action.kind === 'reset') { this.board = this._createBoard(); this.castling = { K: true, Q: true, k: true, q: true }; this.turn = 'white'; this.currentTurnIndex = 0; return resetMeta('已恢复国际象棋标准开局'); }
        if (action.kind === 'clear') { this.board = new Map(); this.castling = { K: false, Q: false, k: false, q: false }; this.turn = 'white'; this.currentTurnIndex = 0; return resetMeta('已清空国际象棋局面'); }
        if (action.kind === 'setTurn') { if (!['white', 'black'].includes(action.color)) return { success: false, message: '行动方无效', state: this.getPlayerState(playerId) }; this.turn = action.color; this.currentTurnIndex = action.color === 'white' ? 0 : 1; this.status = 'playing'; this.winner = null; this.drawReason = null; return this._success(`下一手为${action.color === 'white' ? '白方' : '黑方'}`); }
        if (action.kind === 'remove') { const point = coord({ x: action.x, y: action.y }); if (!point || !this.board.delete(key(point.x, point.y))) return { success: false, message: '该位置没有可移除的棋子', state: this.getPlayerState(playerId) }; invalidateCastling(); return resetMeta('已移除棋子'); }
        if (action.kind === 'place') { const point = coord({ x: action.x, y: action.y }); const color = action.color === 'black' ? 'black' : action.color === 'white' ? 'white' : player.color; const type = ['p', 'n', 'b', 'r', 'q', 'k'].includes(action.pieceType || action.type) ? (action.pieceType || action.type) : 'p'; if (!point || this.board.has(key(point.x, point.y))) return { success: false, message: '摆棋位置无效或已有棋子', state: this.getPlayerState(playerId) }; this.board.set(key(point.x, point.y), { id: `study-${color}-${Date.now()}-${this.board.size}`, type, color, moved: false }); invalidateCastling(); return resetMeta('已摆放棋子'); }
        if (action.kind === 'move') { const from = coord(action.from); const to = coord(action.to); const piece = from && this.board.get(key(from.x, from.y)); if (!from || !to || !piece || piece.color !== player.color || this.board.has(key(to.x, to.y))) return { success: false, message: '只能移动当前执棋方的棋子到空位', state: this.getPlayerState(playerId) }; this.board.delete(key(from.x, from.y)); piece.moved = false; this.board.set(key(to.x, to.y), piece); invalidateCastling(); return resetMeta('已调整棋子位置'); }
        return { success: false, message: '未知摆棋操作', state: this.getPlayerState(playerId) };
    }
    _coord(v) { return v && Number.isInteger(v.x) && Number.isInteger(v.y) && inside(v.x, v.y) ? { x: v.x, y: v.y } : null; }
    _normalizePromotion(v) { return ['q', 'r', 'b', 'n'].includes(v) ? v : null; }
    _legalMovesForPiece(piece) { const from = this._findPiece(piece.id, this.board); if (!from) return []; return this._pseudoMoves(piece, from, this.board).filter(move => { if (move.castle) { if (this._isInCheck(piece.color, this.board)) return false; const step = { x: from.x + (move.to.x > from.x ? 1 : -1), y: from.y }; const transit = this._clone(this.board); this._applyMove(transit, { from, to: step }); if (this._isInCheck(piece.color, transit)) return false; } const simulated = this._clone(this.board); this._applyMove(simulated, move); return !this._isInCheck(piece.color, simulated); }); }
    _pseudoMoves(piece, from, board) { const moves = []; const add = (x, y, extra = {}) => { if (!inside(x, y)) return false; const target = board.get(key(x, y)); if (target?.color === piece.color || target?.type === 'k') return false; moves.push({ from: { ...from }, to: { x, y }, capture: Boolean(target), ...extra }); return !target; };
        if (piece.type === 'p') { const dir = piece.color === 'white' ? -1 : 1; const start = piece.color === 'white' ? 6 : 1; const end = piece.color === 'white' ? 0 : 7; if (!board.has(key(from.x, from.y + dir))) { moves.push({ from: { ...from }, to: { x: from.x, y: from.y + dir }, promotion: from.y + dir === end ? 'q' : null }); if (from.y === start && !board.has(key(from.x, from.y + dir * 2))) moves.push({ from: { ...from }, to: { x: from.x, y: from.y + dir * 2 }, doublePawn: true }); } for (const dx of [-1, 1]) { const x = from.x + dx; const y = from.y + dir; const target = board.get(key(x, y)); if (inside(x, y) && target && target.color !== piece.color && target.type !== 'k') moves.push({ from: { ...from }, to: { x, y }, capture: true, promotion: y === end ? 'q' : null }); const adjacent = board.get(key(x, from.y)); const canEnPassant = this.enPassant?.x === x && this.enPassant?.y === y && adjacent?.type === 'p' && adjacent.color !== piece.color && this.lastMove?.piece?.type === 'p' && this.lastMove.to?.x === x && this.lastMove.to?.y === from.y && Math.abs(this.lastMove.from.y - this.lastMove.to.y) === 2; if (canEnPassant) moves.push({ from: { ...from }, to: { x, y }, capture: true, enPassant: true }); } }
        else if (piece.type === 'n') [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dx, dy]) => add(from.x + dx, from.y + dy));
        else if (['b', 'r', 'q'].includes(piece.type)) { const diagonals = [[1, 1], [1, -1], [-1, 1], [-1, -1]], straights = [[1, 0], [-1, 0], [0, 1], [0, -1]], dirs = piece.type === 'b' ? diagonals : piece.type === 'r' ? straights : diagonals.concat(straights); dirs.forEach(([dx, dy]) => { let x = from.x + dx, y = from.y + dy; while (add(x, y)) { x += dx; y += dy; } }); }
        else if (piece.type === 'k') { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(from.x + dx, from.y + dy); const rank = piece.color === 'white' ? 7 : 0; const rights = piece.color === 'white' ? ['K', 'Q'] : ['k', 'q']; const kingRook = board.get(key(7, rank)), queenRook = board.get(key(0, rank)); if (!piece.moved && from.x === 4 && from.y === rank) { if (this.castling[rights[0]] && kingRook?.type === 'r' && kingRook.color === piece.color && !kingRook.moved && !board.has(key(5, rank)) && !board.has(key(6, rank))) moves.push({ from: { ...from }, to: { x: 6, y: rank }, castle: true }); if (this.castling[rights[1]] && queenRook?.type === 'r' && queenRook.color === piece.color && !queenRook.moved && !board.has(key(1, rank)) && !board.has(key(2, rank)) && !board.has(key(3, rank))) moves.push({ from: { ...from }, to: { x: 2, y: rank }, castle: true }); } }
        return moves;
    }
    _applyMove(board, move) { const piece = board.get(key(move.from.x, move.from.y)); if (!piece) return; board.delete(key(move.from.x, move.from.y)); if (move.enPassant) board.delete(key(move.to.x, move.from.y)); if (move.castle) { const rank = piece.color === 'white' ? 7 : 0; const rookFrom = move.to.x === 6 ? 7 : 0, rookTo = move.to.x === 6 ? 5 : 3, rook = board.get(key(rookFrom, rank)); board.delete(key(rookFrom, rank)); if (rook) board.set(key(rookTo, rank), { ...rook, moved: true }); } const type = move.promotion && piece.type === 'p' ? move.promotion : piece.type; board.set(key(move.to.x, move.to.y), { ...piece, type, moved: true }); }
    _clone(board) { return new Map([...board].map(([pos, p]) => [pos, { ...p }])); }
    _findPiece(id, board) { for (const [pos, piece] of board) if (piece.id === id) { const [x, y] = pos.split(',').map(Number); return { x, y }; } return null; }
    _kingEntry(color, board) { return [...board.entries()].find(([, piece]) => piece.color === color && piece.type === 'k') || null; }
    _isInCheck(color, board) { const king = this._kingEntry(color, board); if (!king) return true; const [x, y] = king[0].split(',').map(Number); return this._attacked(board, x, y, color === 'white' ? 'black' : 'white'); }
    _attacked(board, x, y, byColor) { return this._attackersOfSquare(board, x, y, byColor).length > 0; }
    _attackersOfSquare(board, x, y, byColor) {
        const attackers = [];
        for (const [pos, piece] of board) {
            if (piece.color !== byColor) continue;
            const [px, py] = pos.split(',').map(Number);
            const dx = x - px, dy = y - py;
            let attacks = false;
            if (piece.type === 'p') attacks = Math.abs(dx) === 1 && dy === (byColor === 'white' ? -1 : 1);
            else if (piece.type === 'n') attacks = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].some(([a, b]) => a === dx && b === dy);
            else if (piece.type === 'k') attacks = Math.max(Math.abs(dx), Math.abs(dy)) === 1;
            else {
                const diagonal = Math.abs(dx) === Math.abs(dy) && dx !== 0;
                const straight = (dx === 0) !== (dy === 0);
                if ((piece.type === 'b' && diagonal) || (piece.type === 'r' && straight) || (piece.type === 'q' && (diagonal || straight))) {
                    let cx = px + Math.sign(dx), cy = py + Math.sign(dy);
                    attacks = true;
                    while (cx !== x || cy !== y) {
                        if (board.has(key(cx, cy))) { attacks = false; break; }
                        cx += Math.sign(dx); cy += Math.sign(dy);
                    }
                }
            }
            if (attacks) attackers.push(piece.id);
        }
        return attackers;
    }
    _checkingPieces(color, board) { const king = this._kingEntry(color, board); if (!king) return []; const [x, y] = king[0].split(',').map(Number); return this._attackersOfSquare(board, x, y, color === 'white' ? 'black' : 'white'); }
    _checkmateParticipants(color, board) {
        const king = this._kingEntry(color, board);
        if (!king) return [];
        const [position, kingPiece] = king;
        const [x, y] = position.split(',').map(Number);
        const attackerColor = color === 'white' ? 'black' : 'white';
        const participants = new Set(this._attackersOfSquare(board, x, y, attackerColor));
        for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
            if ((!dx && !dy) || !inside(x + dx, y + dy)) continue;
            const destination = key(x + dx, y + dy);
            if (board.get(destination)?.color === color) continue;
            const simulated = this._clone(board);
            simulated.delete(position);
            simulated.delete(destination);
            simulated.set(destination, { ...kingPiece });
            for (const pieceId of this._attackersOfSquare(simulated, x + dx, y + dy, attackerColor)) participants.add(pieceId);
        }
        return [...participants];
    }
    _updateCastlingRights(piece, from, to) { if (piece.type === 'k') { if (piece.color === 'white') this.castling.K = this.castling.Q = false; else this.castling.k = this.castling.q = false; } if (piece.type === 'r') this._disableRook(piece.color, from.x, from.y); const captured = this.board.get(key(to.x, to.y)); if (captured?.type === 'r') this._disableRook(captured.color, to.x, to.y); }
    _disableRook(color, x, y) { if (color === 'white' && y === 7 && x === 0) this.castling.Q = false; if (color === 'white' && y === 7 && x === 7) this.castling.K = false; if (color === 'black' && y === 0 && x === 0) this.castling.q = false; if (color === 'black' && y === 0 && x === 7) this.castling.k = false; }
    _evaluatePosition() {
        const moves = this._allLegalMoves(this.turn);
        if (!moves.length) {
            this.status = 'ended';
            if (this._isInCheck(this.turn, this.board)) {
                this.winner = this.players.find(p => p.color !== this.turn) || null;
                this.actionLog.push(`${this.winner?.name || '对手'} 将死获胜`);
            } else {
                this.drawReason = '困毙和棋';
                this.actionLog.push(this.drawReason);
            }
            return;
        }
        if (this._isDeadPosition()) return this._endDraw('无将死可能，和棋');
        if (this.halfmoveClock >= 150) return this._endDraw('七十五回合规则和棋');
        if ((this.positionCounts.get(this._positionKey()) || 0) >= 5) return this._endDraw('五次重复局面和棋');
    }
    _endDraw(reason) { this.status = 'ended'; this.drawReason = reason; this.actionLog.push(reason); }
    _recordPosition() { const position = this._positionKey(); this.positionCounts.set(position, (this.positionCounts.get(position) || 0) + 1); }
    _positionKey() {
        const pieces = [...this.board.entries()].map(([pos, piece]) => `${pos}:${piece.color[0]}${piece.type}`).sort().join('/');
        const rights = ['K', 'Q', 'k', 'q'].filter(right => this.castling[right]).join('') || '-';
        const enPassant = this.enPassant ? `${this.enPassant.x},${this.enPassant.y}` : '-';
        return `${this.turn}|${rights}|${enPassant}|${pieces}`;
    }
    _isDeadPosition() {
        const nonKings = [...this.board.values()].filter(piece => piece.type !== 'k');
        if (!nonKings.length) return true;
        if (nonKings.some(piece => ['p', 'r', 'q'].includes(piece.type))) return false;
        if (nonKings.length === 1) return true;
        if (nonKings.every(piece => piece.type === 'b')) {
            const squareColors = [...this.board.entries()].filter(([, piece]) => piece.type === 'b').map(([pos]) => { const [x, y] = pos.split(',').map(Number); return (x + y) % 2; });
            return new Set(squareColors).size === 1;
        }
        return false;
    }
    _allLegalMoves(color) { return [...this.board.values()].filter(p => p.color === color).flatMap(p => this._legalMovesForPiece(p)); }
    getPublicState() {
        const repetitions = this.positionCounts.get(this._positionKey()) || 0;
        const king = this._kingEntry(this.turn, this.board);
        const checkingPieceIds = this._checkingPieces(this.turn, this.board);
        const check = checkingPieceIds.length > 0;
        const checkmate = this.status === 'ended' && Boolean(this.winner) && check && this._allLegalMoves(this.turn).length === 0;
        return { roomId: this.roomId, status: this.status, turn: this.turn, currentTurn: this.players[this.currentTurnIndex]?.id || null, currentTurnName: this.players[this.currentTurnIndex]?.name || null, check, checkmate, checkedKingId: king?.[1]?.id || null, checkingPieceIds, checkmateParticipantIds: checkmate ? this._checkmateParticipants(this.turn, this.board) : [], players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color, isOnline: p.isOnline, isCurrentTurn: p.color === this.turn })), pieces: [...this.board.entries()].map(([pos, p]) => { const [x, y] = pos.split(',').map(Number); return { ...p, x, y }; }), lastMove: this.lastMove, lastAction: this.lastAction, actionLog: this.actionLog.slice(-14), drawReason: this.drawReason, winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null, castling: { ...this.castling }, enPassant: this.enPassant, halfmoveClock: this.halfmoveClock, repetitionCount: repetitions, canClaimDraw: this.halfmoveClock >= 100 || repetitions >= 3 };
    }
    getPlayerState(playerId) { const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myColor = player?.color || null; state.myIsCurrentTurn = state.currentTurn === playerId; state.legalMoves = {}; if (player?.color === this.turn && this.status === 'playing') for (const p of this.board.values()) if (p.color === player.color) state.legalMoves[p.id] = this._legalMovesForPiece(p).map(m => ({ ...m.to, capture: Boolean(m.capture) })); state.availableActions = { canMove: state.myIsCurrentTurn && this.status === 'playing' }; return state; }
    handlePlayerLeave(playerId) { const p = this.playerMap[playerId]; if (!p) return { success: false, message: '玩家不存在' }; p.isOnline = false; if (this.status === 'playing') { this.status = 'ended'; this.winner = this.players.find(other => other.id !== playerId && other.isOnline) || null; } return this._success(`${p.name} 离开棋局`); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}
module.exports = ChessEngine;
