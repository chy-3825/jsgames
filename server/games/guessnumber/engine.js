function makeSecret(random = Math.random) {
    const digits = '0123456789'.split('');
    for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits.slice(0, 4).join('');
}

class GuessNumberEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map((player, index) => ({
            id: player.id,
            name: player.name,
            attempts: 0,
            history: [],
            isOnline: true,
            isCurrentTurn: index === 0,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.secret = null;
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.turnNumber = 1;
        this.lastResult = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length !== 1) return { success: false, message: '单人猜数字需要恰好 1 名玩家' };
        this.secret = makeSecret(this.random);
        this.status = 'playing';
        this.currentTurnIndex = 0;
        this.turnNumber = 1;
        this.lastResult = null;
        this.lastAction = null;
        this.winner = null;
        this.players.forEach(player => {
            player.attempts = 0;
            player.history = [];
            player.isOnline = true;
        });
        this.actionLog = [`${this.players[0].name} 先猜，答案是四位不重复数字`];
        return this._success('猜数字开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.getCurrentPlayer()?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind !== 'submitGuess') return { success: false, message: '请输入四位数字', state: this.getPlayerState(playerId) };
        const guess = String(action.guess ?? '').trim();
        if (!/^\d{4}$/.test(guess)) return { success: false, message: '请输入恰好四位数字', state: this.getPlayerState(playerId) };
        if (new Set(guess).size !== 4) return { success: false, message: '四位数字不能重复', state: this.getPlayerState(playerId) };

        const exact = [...guess].filter((digit, index) => digit === this.secret[index]).length;
        const matched = [...guess].filter(digit => this.secret.includes(digit)).length;
        const misplaced = matched - exact;
        const result = { guess, exact, misplaced, absent: 4 - matched, attempt: player.attempts + 1 };
        player.attempts++;
        player.history.push(result);
        this.lastResult = { ...result, playerId, playerName: player.name };
        this.lastAction = { kind: 'submitGuess', playerId, playerName: player.name, message: `${player.name} 猜了 ${guess}：${exact}A ${misplaced}B` };
        this.actionLog.push(this.lastAction.message);

        if (exact === 4) {
            this.status = 'ended';
            this.winner = player;
            this.actionLog.push(`${player.name} 猜中了答案`);
        } else {
            const next = this._findNextAvailableIndex(this.currentTurnIndex);
            if (next === -1) {
                this.status = 'ended';
                this.actionLog.push('没有在线玩家，本局结束');
            } else {
                this.currentTurnIndex = next;
                this.turnNumber++;
            }
        }
        this._syncTurnFlags();
        return this._success(this.lastAction.message);
    }

    getCurrentPlayer() { return this.players[this.currentTurnIndex] || null; }

    _findNextAvailableIndex(fromIndex) {
        for (let offset = 1; offset <= this.players.length; offset++) {
            const index = (fromIndex + offset) % this.players.length;
            const player = this.players[index];
            if (player.isOnline) return index;
        }
        return -1;
    }

    _syncTurnFlags() { this.players.forEach((player, index) => { player.isCurrentTurn = index === this.currentTurnIndex && this.status === 'playing'; }); }

    getPublicState() {
        return {
            roomId: this.roomId,
            status: this.status,
            currentTurn: this.getCurrentPlayer()?.id || null,
            currentTurnName: this.getCurrentPlayer()?.name || null,
            turnNumber: this.turnNumber,
            maxAttempts: null,
            lastResult: this.lastResult,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-15),
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                isOnline: player.isOnline,
                attempts: player.attempts,
                remainingAttempts: null,
                history: player.history.slice(),
                isCurrentTurn: player.isCurrentTurn,
            })),
            secret: this.status === 'ended' ? this.secret : null,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        state.myId = playerId;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.availableActions = { canGuess: state.status === 'playing' && state.myIsCurrentTurn && Boolean(this.playerMap[playerId]?.isOnline) };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在' };
        const wasCurrent = this.getCurrentPlayer()?.id === playerId;
        player.isOnline = false;
        if (wasCurrent && this.status === 'playing') {
            const next = this._findNextAvailableIndex(this.currentTurnIndex);
            if (next === -1) this.status = 'ended'; else this.currentTurnIndex = next;
        }
        this._syncTurnFlags();
        return this._success(`${player.name} 离开了游戏`);
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = GuessNumberEngine;
module.exports.makeSecret = makeSecret;
