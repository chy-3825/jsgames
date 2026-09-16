'use strict';

/** Study-mode behavior kept out of the core room state machine. */
const STUDY_SIDE_LABELS = {
    chess: { white: '白方', black: '黑方' },
    xiangqi: { red: '红方', black: '黑方' },
    jungle: { red: '红方', blue: '蓝方' },
    junqi: { red: '红方', blue: '蓝方' },
    gobang: { black: '黑方', white: '白方' },
    checkers: { red: '红方', blue: '蓝方', green: '绿方', yellow: '黄方', purple: '紫方', orange: '橙方' },
};

function studySideLabel(gameType, color, fallback = '当前阵营') {
    return STUDY_SIDE_LABELS[gameType]?.[color] || fallback || (color ? `${color}方` : '当前阵营');
}

const studyMethods = {
    _enginePlayersForStart(seatedPlayers) {
        if (!(this.studyModeSupported && this.gameOptions.gameMode === 'study')) return seatedPlayers;
        const count = Number(this.gameModule.metadata.studyPlayerCount || this.gameModule.metadata.minPlayers || 2);
        const players = seatedPlayers.slice(0, count);
        const names = this.gameModule.metadata.studySeatNames || [];
        for (let index = players.length; index < count; index += 1) {
            players.push({
                id: `study-${this.id}-${index + 1}`,
                name: names[index] || `研究方 ${index + 1}`,
                seatIndex: index,
                connected: true,
            });
        }
        return players;
    },

    _studyPlayers() {
        return this.game?.engine?.players || [];
    },

    _studyEnginePlayerId(playerId) {
        const players = this._studyPlayers();
        const index = Number(this.studyControl.get(playerId) ?? 0);
        return players[index]?.id || null;
    },

    _studyViewerForEngine(enginePlayerId) {
        for (const [viewerId] of this.studyControl) if (this._studyEnginePlayerId(viewerId) === enginePlayerId) return viewerId;
        return this.hostId;
    },

    _switchStudySeat(playerId, action = {}) {
        const players = this._studyPlayers();
        if (!players.length) return { success: false, message: '研究棋局尚未准备好' };
        let index = Number.isInteger(action.seatIndex) ? action.seatIndex : NaN;
        if (!Number.isInteger(index) && action.color) index = players.findIndex(player => player.color === action.color);
        if (!Number.isInteger(index)) {
            const current = Number(this.studyControl.get(playerId) ?? 0);
            index = (current + 1) % players.length;
        }
        if (index < 0 || index >= players.length) return { success: false, message: '研究阵营不存在' };
        this.studyControl.set(playerId, index);
        const selected = players[index];
        const side = studySideLabel(this.gameType, selected.color, selected.name);
        return {
            success: true,
            message: `已切换到${side}`,
            state: this.getPlayerGameState(playerId),
            action: { kind: 'studySwitchSeat', seatIndex: index, color: selected.color, side, playerName: selected.name },
        };
    },

    _handleStudySetup(enginePlayerId, action = {}, viewerId) {
        if (!action || typeof action !== 'object') return null;
        if (action.kind === 'studySetup') action = { ...action, kind: action.op || action.operation };
        if (!['move', 'place', 'remove', 'clear', 'reset', 'setTurn'].includes(action.kind)) return null;
        if (typeof this.game.handleStudySetup !== 'function') {
            return { success: false, message: `${this.gameName} 的摆棋编辑器尚未支持该操作`, state: this.getPlayerGameState(viewerId) };
        }
        // A study action is routed to the currently selected virtual seat.
        // Do not let a crafted payload place or move the other side without
        // switching perspective first.
        const enginePlayer = this._studyPlayers().find(player => player.id === enginePlayerId);
        if (enginePlayer && (action.kind === 'place' || action.kind === 'move')) action = { ...action, color: enginePlayer.color };
        return this.game.handleStudySetup(enginePlayerId, action, viewerId);
    },

    _applyStudySetupActions(state, enginePlayerId) {
        if (!state || this.studyPhase !== 'setup') return;
        state.myIsCurrentTurn = true;
        state.availableActions = { canMove: true, canPlace: true, canSetup: true };
        const player = state.players?.find(item => item.id === enginePlayerId);
        if (!player) return;
        const pieces = state.pieces || [];
        const empty = [];
        const board = state.rules?.board || {};
        const dimensions = {
            chess: [8, 8],
            xiangqi: [9, 10],
            jungle: [7, 9],
            gobang: [15, 15],
        }[this.gameType] || [Number(board.width || 0), Number(board.height || 0)];
        const width = Number(board.width || dimensions[0] || 0);
        const height = Number(board.height || dimensions[1] || 0);
        if (width && height) for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (!pieces.some(piece => piece.x === x && piece.y === y)) empty.push({ x, y });
        if (this.gameType === 'gobang') {
            state.legalMoves = { place: empty };
            return;
        }
        if (this.gameType === 'checkers') {
            const grid = [];
            for (let y = 0; y <= 16; y += 1) for (let x = 0; x <= 24; x += 1) if (!pieces.some(piece => piece.x === x && piece.y === y)) grid.push({ x, y });
            const own = pieces.filter(piece => piece.color === player.color);
            const viewerId = this._studyViewerForEngine(enginePlayerId);
            const selectedId = this.studySetupSelection.get(viewerId);
            state.legalMoves = { select: own.map(piece => piece.id), step: grid, jump: [] };
            const selected = own.find(piece => piece.id === selectedId);
            state.selectedPiece = selected ? { pieceId: selected.id, x: selected.x, y: selected.y, current: { x: selected.x, y: selected.y } } : null;
            return;
        }
        const own = pieces.filter(piece => piece.color === player.color);
        const targets = empty;
        state.legalMoves = Object.fromEntries(own.map(piece => [piece.id, targets.map(target => ({ ...target }))]));
    }
};

module.exports = studyMethods;
