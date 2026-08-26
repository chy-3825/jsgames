const WIDTH = 5;
const HEIGHT = 12;
const COLORS = ['red', 'blue'];
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Standard two-player Luzhanqi board: each side has six rows, two
// headquarters and five protected camps.  The camps are not deployment
// points; the remaining 25 positions are exactly the 25 pieces per side.
const HQ = { red: [{ x: 1, y: 11 }, { x: 3, y: 11 }], blue: [{ x: 1, y: 0 }, { x: 3, y: 0 }] };
const CAMPS = [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]];
const RAIL_ROWS = [1, 5, 6, 10];
const HOME_ROWS = { red: [6, 7, 8, 9, 10, 11], blue: [0, 1, 2, 3, 4, 5] };
const PIECES = {
    commander: { label: '司令', rank: 9, count: 1 },
    army: { label: '军长', rank: 8, count: 1 },
    division: { label: '师长', rank: 7, count: 2 },
    brigade: { label: '旅长', rank: 6, count: 2 },
    regiment: { label: '团长', rank: 5, count: 2 },
    battalion: { label: '营长', rank: 4, count: 2 },
    company: { label: '连长', rank: 3, count: 3 },
    platoon: { label: '排长', rank: 2, count: 3 },
    engineer: { label: '工兵', rank: 1, count: 3 },
    mine: { label: '地雷', rank: 0, count: 3 },
    bomb: { label: '炸弹', rank: 0, count: 2 },
    flag: { label: '军旗', rank: -1, count: 1 },
};

function key(x, y) { return `${x},${y}`; }
function inside(x, y) { return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

class JunqiEngine {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players.slice(0, 2).map((player, index) => ({
            id: player.id,
            name: player.name,
            color: COLORS[index],
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.board = this._createBoard();
        this.setup = Object.fromEntries(this.players.map(player => [player.id, { ready: false, pieces: this._setupPieces(player) }]));
        this.status = 'waiting';
        this.phase = 'setup';
        this.turn = 'red';
        this.currentTurnIndex = 0;
        this.lastMove = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.drawReason = null;
    }

    _createBoard() { return new Map(); }

    _setupPieces(player) {
        const types = Object.entries(PIECES).flatMap(([type, info]) => Array.from({ length: info.count }, () => type));
        const pieces = types.map((type, index) => ({ id: `${player.id}-${type}-${index + 1}`, ownerId: player.id, color: player.color, type, x: null, y: null, placed: false }));
        const slots = HOME_ROWS[player.color].flatMap(y => Array.from({ length: WIDTH }, (_, x) => ({ x, y }))).filter(square => !this._isCamp(square.x, square.y));
        const occupied = new Set();
        const put = (piece, square) => { piece.x = square.x; piece.y = square.y; piece.placed = true; occupied.add(key(square.x, square.y)); };
        const take = type => pieces.find(piece => piece.type === type && !piece.placed);
        const free = predicate => slots.find(square => !occupied.has(key(square.x, square.y)) && (!predicate || predicate(square)));
        // The default is a legal suggestion, not a locked arrangement.  The
        // player can still clear it or move any piece before confirming setup.
        put(take('flag'), HQ[player.color][0]);
        const lastTwoRows = player.color === 'red' ? square => square.y >= 10 : square => square.y <= 1;
        for (let count = 0; count < PIECES.mine.count; count += 1) put(take('mine'), free(lastTwoRows));
        const firstRow = player.color === 'red' ? 6 : 5;
        for (let count = 0; count < PIECES.bomb.count; count += 1) put(take('bomb'), free(square => square.y !== firstRow));
        pieces.filter(piece => !piece.placed).forEach(piece => put(piece, free()));
        return pieces;
    }

    _piece(owner, color, type, number, square) {
        return { id: `${owner?.id || color}-${type}-${number}`, ownerId: owner?.id || null, color, type, x: square.x, y: square.y, revealed: false };
    }

    _shuffle(values) {
        for (let index = values.length - 1; index > 0; index -= 1) {
            const other = Math.floor(Math.random() * (index + 1));
            [values[index], values[other]] = [values[other], values[index]];
        }
    }

    start() {
        if (this.players.length !== 2) return { success: false, message: '军棋第一版需要 2 名玩家' };
        this.status = 'playing';
        this.phase = 'setup';
        this.turn = 'red';
        this.currentTurnIndex = 0;
        this.board = this._createBoard();
        this.setup = Object.fromEntries(this.players.map(player => [player.id, { ready: false, pieces: this._setupPieces(player) }]));
        for (const entry of Object.values(this.setup)) for (const piece of entry.pieces) if (piece.placed) this.board.set(key(piece.x, piece.y), piece);
        this.actionLog = ['请双方完成暗棋布阵：军旗必须在大本营，行营不能布子'];
        return this._success('军棋进入摆棋阶段');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '棋局尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.phase === 'setup') return this._handleSetupAction(player, action);
        if (player.color !== this.turn) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind !== 'move') return { success: false, message: '请提交有效走棋', state: this.getPlayerState(playerId) };
        const from = this._coord(action.from);
        const to = this._coord(action.to);
        const piece = from && this.board.get(key(from.x, from.y));
        if (!from || !to || !piece || piece.ownerId !== playerId) return { success: false, message: '只能移动自己的棋子', state: this.getPlayerState(playerId) };
        const move = this._legalMoves(piece).find(candidate => candidate.to.x === to.x && candidate.to.y === to.y);
        if (!move) return { success: false, message: '这步不符合军棋规则', state: this.getPlayerState(playerId) };
        const result = this._applyAction(player, piece, move);
        if (this.status !== 'ended') {
            this.turn = this.turn === 'red' ? 'blue' : 'red';
            this.currentTurnIndex = this.turn === 'red' ? 0 : 1;
            this._evaluateEnd();
        }
        return this._success(result.message);
    }

    _handleSetupAction(player, action) {
        if (action.kind === 'setupPlace') return this._setupPlace(player, action);
        if (action.kind === 'setupSwap') return this._setupSwap(player, action);
        if (action.kind === 'setupRemove') return this._setupRemove(player, action);
        if (action.kind === 'setupReset') return this._setupReset(player);
        if (action.kind === 'setupReady') return this._setupReady(player);
        return { success: false, message: '请先完成摆棋', state: this.getPlayerState(player.id) };
    }

    _setupZone(player, x, y) {
        return HOME_ROWS[player.color].includes(y) && x >= 0 && x < WIDTH && !this._isCamp(x, y);
    }

    _setupPlacementError(player, piece, x, y) {
        if (!this._setupZone(player, x, y)) return '只能把棋子摆在己方兵站或大本营';
        const hq = this._isHQ(player.color, x, y);
        const firstRow = player.color === 'red' ? y === 6 : y === 5;
        const lastTwoRows = player.color === 'red' ? y >= 10 : y <= 1;
        if (piece.type === 'flag' && !hq) return '军旗必须放在大本营';
        if (piece.type === 'mine' && !lastTwoRows) return '地雷只能放在最后两排';
        if (piece.type === 'bomb' && firstRow) return '炸弹不能放在第一排';
        return null;
    }

    _setupPlace(player, action) {
        const entry = this.setup[player.id];
        const piece = entry?.pieces.find(item => item.id === action.pieceId);
        const x = Number(action.x); const y = Number(action.y);
        if (!piece || !Number.isInteger(x) || !Number.isInteger(y)) return { success: false, message: '只能把棋子摆在己方兵站或大本营', state: this.getPlayerState(player.id) };
        if (entry.ready) return { success: false, message: '你已经确认布阵，不能再修改', state: this.getPlayerState(player.id) };
        const occupant = [...this.board.values()].find(item => item.x === x && item.y === y);
        if (occupant && occupant.id !== piece.id) return { success: false, message: '这个位置已经有棋子', state: this.getPlayerState(player.id) };
        const placementError = this._setupPlacementError(player, piece, x, y);
        if (placementError) return { success: false, message: placementError, state: this.getPlayerState(player.id) };
        if (piece.x !== null) this.board.delete(key(piece.x, piece.y));
        piece.x = x; piece.y = y; piece.placed = true;
        this.board.set(key(x, y), piece);
        return this._success(`${PIECES[piece.type].label} 已摆放`);
    }

    _setupSwap(player, action) {
        const entry = this.setup[player.id];
        const piece = entry?.pieces.find(item => item.id === action.pieceId);
        const target = entry?.pieces.find(item => item.id === action.targetPieceId);
        if (!piece || !target || piece.id === target.id || !piece.placed || !target.placed) return { success: false, message: '请选择两枚已摆放的己方棋子', state: this.getPlayerState(player.id) };
        if (entry.ready) return { success: false, message: '你已经确认布阵，不能再修改', state: this.getPlayerState(player.id) };
        const pieceDestination = { x: target.x, y: target.y };
        const targetDestination = { x: piece.x, y: piece.y };
        const pieceError = this._setupPlacementError(player, piece, pieceDestination.x, pieceDestination.y);
        const targetError = this._setupPlacementError(player, target, targetDestination.x, targetDestination.y);
        if (pieceError || targetError) return { success: false, message: `不能交换：${pieceError || targetError}`, state: this.getPlayerState(player.id) };
        this.board.delete(key(piece.x, piece.y)); this.board.delete(key(target.x, target.y));
        piece.x = pieceDestination.x; piece.y = pieceDestination.y;
        target.x = targetDestination.x; target.y = targetDestination.y;
        this.board.set(key(piece.x, piece.y), piece); this.board.set(key(target.x, target.y), target);
        return this._success(`${PIECES[piece.type].label}与${PIECES[target.type].label}已交换`);
    }

    _setupRemove(player, action) {
        const entry = this.setup[player.id];
        const piece = entry?.pieces.find(item => item.id === action.pieceId);
        if (!piece || entry.ready) return { success: false, message: '不能移除此棋子', state: this.getPlayerState(player.id) };
        if (piece.x !== null) this.board.delete(key(piece.x, piece.y));
        piece.x = null; piece.y = null; piece.placed = false;
        return this._success('棋子已收回待摆区');
    }

    _setupReset(player) {
        const entry = this.setup[player.id];
        if (!entry || entry.ready) return { success: false, message: '你已经确认布阵，不能清空', state: this.getPlayerState(player.id) };
        entry.pieces.forEach(piece => {
            if (piece.x !== null) this.board.delete(key(piece.x, piece.y));
            piece.x = null; piece.y = null; piece.placed = false;
        });
        return this._success('已清空你的布阵');
    }

    _setupReady(player) {
        const entry = this.setup[player.id];
        if (!entry || entry.pieces.some(piece => !piece.placed)) return { success: false, message: '25 枚棋子必须全部摆好', state: this.getPlayerState(player.id) };
        if (!entry.pieces.some(piece => piece.type === 'flag' && this._isHQ(player.color, piece.x, piece.y))) return { success: false, message: '军旗必须在大本营', state: this.getPlayerState(player.id) };
        entry.ready = true;
        this.actionLog.push(`${player.name} 已完成布阵，等待对手`);
        if (this.players.every(item => this.setup[item.id]?.ready)) {
            this.phase = 'play';
            this.turn = 'red';
            this.currentTurnIndex = 0;
            this.actionLog.push(`${this.players[0].name} 执红，布阵完成后开始走棋`);
        }
        return this._success(entry.ready && this.phase === 'play' ? '双方布阵完成，红方先行' : '布阵已确认');
    }

    _applyAction(player, piece, move) {
        const target = this.board.get(key(move.to.x, move.to.y));
        const from = { x: piece.x, y: piece.y };
        piece.revealed = true;
        if (!target) {
            this.board.delete(key(piece.x, piece.y));
            piece.x = move.to.x; piece.y = move.to.y;
            this.board.set(key(piece.x, piece.y), piece);
            this.lastMove = { from, to: { ...move.to }, piece: { ...piece, type: piece.type }, capture: null };
            this.lastAction = { kind: 'move', playerId: player.id, playerName: player.name, message: `${player.name} 移动${PIECES[piece.type].label}` };
        } else {
            target.revealed = true;
            const battle = this._resolveBattle(piece, target, move.to);
            this.lastMove = { from, to: { ...move.to }, piece: { ...piece }, capture: { ...battle, defender: { ...target } } };
            this.lastAction = { kind: 'battle', playerId: player.id, playerName: player.name, message: `${player.name} 发起军棋对决：${PIECES[piece.type].label} 对 ${PIECES[target.type].label}`, outcome: battle.outcome };
        }
        this.actionLog.push(this.lastAction.kind === 'move' ? `${player.name} 移动了一枚棋子` : this.lastAction.message);
        if (this.actionLog.length > 18) this.actionLog.shift();
        return this.lastAction;
    }

    _resolveBattle(attacker, defender, destination) {
        const attackerType = attacker.type;
        const defenderType = defender.type;
        let outcome;
        if (defenderType === 'flag') {
            this._remove(defender);
            // The attacking piece occupies the headquarters when the flag is
            // captured.  The game ends immediately, but keeping that final
            // position makes the result and replay consistent with the board.
            this._moveSurvivor(attacker, destination);
            this.status = 'ended';
            this.winner = this.playerMap[attacker.ownerId];
            outcome = 'flag-captured';
        } else if (attackerType === 'bomb' || defenderType === 'bomb') {
            this._remove(attacker); this._remove(defender); outcome = 'both-exploded';
        } else if (defenderType === 'mine') {
            if (attackerType === 'engineer') { this._remove(defender); this._moveSurvivor(attacker, destination); outcome = 'attacker-wins'; }
            else { this._remove(attacker); outcome = 'defender-wins'; }
        } else if (PIECES[attackerType].rank > PIECES[defenderType].rank) {
            this._remove(defender); this._moveSurvivor(attacker, destination); outcome = 'attacker-wins';
        } else if (PIECES[attackerType].rank < PIECES[defenderType].rank) {
            this._remove(attacker); outcome = 'defender-wins';
        } else {
            this._remove(attacker); this._remove(defender); outcome = 'both-removed';
        }
        return { attackerType, defenderType, outcome };
    }

    _moveSurvivor(piece, destination) {
        this.board.delete(key(piece.x, piece.y));
        if (destination) { piece.x = destination.x; piece.y = destination.y; this.board.set(key(piece.x, piece.y), piece); }
    }

    _remove(piece) { this.board.delete(key(piece.x, piece.y)); if (piece.type === 'commander') this._revealFlag(piece.ownerId); }
    _revealFlag(ownerId) { for (const piece of this.board.values()) if (piece.ownerId === ownerId && piece.type === 'flag') piece.revealed = true; }

    _coord(value) { return value && Number.isInteger(value.x) && Number.isInteger(value.y) && inside(value.x, value.y) ? { x: value.x, y: value.y } : null; }

    _legalMoves(piece) {
        if (['flag', 'mine'].includes(piece.type) || this._isHQ(piece.color, piece.x, piece.y)) return [];
        const moves = [];
        const from = { x: piece.x, y: piece.y };
        for (const [dx, dy] of this._roadDirections(piece.x, piece.y)) {
            const x = piece.x + dx; const y = piece.y + dy;
            if (this._canEnter(piece, x, y)) moves.push({ from, to: { x, y }, capture: Boolean(this.board.get(key(x, y))) });
        }
        if (this._isRailNode(piece.x, piece.y)) {
            if (piece.type === 'engineer') this._engineerRailMoves(piece, moves);
            else this._straightRailMoves(piece, moves);
        }
        return moves;
    }

    _canEnter(piece, x, y) {
        if (!inside(x, y)) return false;
        const target = this.board.get(key(x, y));
        if (target?.color === piece.color) return false;
        if (target && this._isCamp(x, y)) return false;
        return true;
    }

    _roadDirections(x, y) {
        const directions = [];
        for (const [dx, dy] of DIRECTIONS) if (this._isRoadEdge(x, y, x + dx, y + dy)) directions.push([dx, dy]);
        for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (this._isRoadEdge(x, y, x + dx, y + dy)) directions.push([dx, dy]);
        return directions;
    }

    _isRoadEdge(x1, y1, x2, y2) {
        if (!inside(x1, y1) || !inside(x2, y2)) return false;
        const dx = Math.abs(x2 - x1); const dy = Math.abs(y2 - y1);
        if (dx + dy === 1) {
            // The two sides meet only through the left, center and right
            // railway crossings.  There is no ordinary road across the
            // central boundary in columns 1 and 3.
            if (y1 === 5 && y2 === 6 || y1 === 6 && y2 === 5) return [0, 2, 4].includes(x1);
            return true;
        }
        if (dx === 1 && dy === 1) return this._isCamp(x1, y1) || this._isCamp(x2, y2);
        return false;
    }

    _engineerRailMoves(piece, moves) {
        const start = key(piece.x, piece.y);
        const queue = [{ x: piece.x, y: piece.y }];
        const visited = new Set([start]);
        while (queue.length) {
            const current = queue.shift();
            for (const [dx, dy] of DIRECTIONS) {
                const x = current.x + dx; const y = current.y + dy;
                if (!inside(x, y) || !this._isRailEdge(current.x, current.y, x, y) || visited.has(key(x, y))) continue;
                const target = this.board.get(key(x, y));
                if (target && key(x, y) !== start && !(x === piece.x && y === piece.y)) {
                    if (target.color !== piece.color && !this._isCamp(x, y)) moves.push({ from: { x: piece.x, y: piece.y }, to: { x, y }, capture: true });
                    continue;
                }
                visited.add(key(x, y));
                queue.push({ x, y });
                if (this._canEnter(piece, x, y)) moves.push({ from: { x: piece.x, y: piece.y }, to: { x, y }, capture: false });
            }
        }
    }

    _straightRailMoves(piece, moves) {
        for (const [dx, dy] of DIRECTIONS) {
            let x = piece.x + dx; let y = piece.y + dy;
            let previous = { x: piece.x, y: piece.y };
            while (inside(x, y) && this._isRailEdge(previous.x, previous.y, x, y)) {
                const target = this.board.get(key(x, y));
                if (target) { if (target.color !== piece.color && !this._isCamp(x, y)) moves.push({ from: { x: piece.x, y: piece.y }, to: { x, y }, capture: true }); break; }
                moves.push({ from: { x: piece.x, y: piece.y }, to: { x, y }, capture: false });
                previous = { x, y }; x += dx; y += dy;
            }
        }
    }

    _isRailNode(x, y) { return inside(x, y) && (x === 0 || x === WIDTH - 1 || RAIL_ROWS.includes(y)); }
    _isRailEdge(x1, y1, x2, y2) {
        if (!this._isRailNode(x1, y1) || !this._isRailNode(x2, y2)) return false;
        if (y1 === y2 && RAIL_ROWS.includes(y1) && Math.abs(x1 - x2) === 1) return true;
        if (x1 === x2 && (x1 === 0 || x1 === WIDTH - 1) && Math.abs(y1 - y2) === 1 && y1 >= 1 && y1 <= 10 && y2 >= 1 && y2 <= 10) return true;
        return x1 === x2 && [0, 2, 4].includes(x1) && ((y1 === 5 && y2 === 6) || (y1 === 6 && y2 === 5));
    }
    _isCamp(x, y) { return CAMPS.some(([cx, cy]) => cx === x && cy === y); }
    _isHQ(color, x, y) { return HQ[color].some(square => square.x === x && square.y === y); }

    _evaluateEnd() {
        const current = this.turn;
        const movable = [...this.board.values()].filter(piece => piece.color === current).some(piece => this._legalMoves(piece).length);
        const flag = [...this.board.values()].find(piece => piece.color === current && piece.type === 'flag');
        if (!flag || !movable) {
            this.status = 'ended';
            this.winner = this.players.find(player => player.color !== current) || null;
            this.actionLog.push(`${this.winner?.name || '对手'} 获胜`);
        }
    }

    _serializePiece(piece, viewerId) {
        const visible = piece.ownerId === viewerId || piece.revealed;
        return { id: piece.id, ownerId: piece.ownerId, color: piece.color, x: piece.x, y: piece.y, revealed: visible, type: visible ? piece.type : 'unknown', label: visible ? PIECES[piece.type].label : '未知棋子' };
    }

    _serializeLastMove(viewerId) {
        if (!this.lastMove) return null;
        const move = clone(this.lastMove);
        if (move.piece?.ownerId !== viewerId && !move.capture) move.piece.type = 'unknown';
        return move;
    }

    _serializeLastAction(viewerId) {
        if (!this.lastAction) return null;
        const action = { ...this.lastAction };
        if (action.kind === 'move' && action.playerId !== viewerId && !this.lastMove?.capture) action.message = `${action.playerName} 移动了一枚棋子`;
        return action;
    }

    getPublicState(viewerId = null) {
        const current = this.players[this.currentTurnIndex];
        // Keep the complete board topology for hit testing, but let the serializer
        // decide which faces are visible.  With no viewer (for example the generic
        // action acknowledgement) every unrevealed piece is therefore a back.
        const visiblePieces = this.phase === 'setup' && viewerId
            ? [...this.board.values()].filter(piece => piece.ownerId === viewerId)
            : this.phase === 'setup' ? [] : [...this.board.values()];
        return {
            roomId: this.roomId, status: this.status, turn: this.turn, currentTurn: current?.id || null, currentTurnName: current?.name || null,
            players: this.players.map(player => ({ ...player, isCurrentTurn: player.color === this.turn })),
            pieces: visiblePieces.map(piece => this._serializePiece(piece, viewerId)),
            lastMove: this._serializeLastMove(viewerId), lastAction: this._serializeLastAction(viewerId),
            actionLog: this.actionLog.slice(-18), drawReason: this.drawReason, winner: this.winner ? { id: this.winner.id, name: this.winner.name, color: this.winner.color } : null,
            phase: this.phase, board: { width: WIDTH, height: HEIGHT, headquarters: HQ, camps: CAMPS, railRows: RAIL_ROWS },
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(playerId);
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myColor = player?.color || null;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.setup = this.phase === 'setup' && player ? { ready: Boolean(this.setup[playerId]?.ready), pieces: this.setup[playerId].pieces.map(piece => ({ ...piece })) } : null;
        state.legalMoves = {};
        if (player?.color === this.turn && this.phase === 'play' && this.status === 'playing') for (const piece of this.board.values()) if (piece.ownerId === playerId) {
            const moves = this._legalMoves(piece).map(move => move.to);
            state.legalMoves[piece.id] = [...new Map(moves.map(move => [`${move.x},${move.y}`, move])).values()];
        }
        state.availableActions = { canMove: state.myIsCurrentTurn && this.phase === 'play' && this.status === 'playing', canSetup: this.phase === 'setup' && !this.setup[playerId]?.ready };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (this.status === 'playing') { this.status = 'ended'; this.winner = this.players.find(other => other.id !== playerId && other.isOnline) || null; }
        return this._success(`${player.name} 离开棋局`);
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = JunqiEngine;
