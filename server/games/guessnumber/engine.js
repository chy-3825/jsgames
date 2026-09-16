function makeSecret(random = Math.random) {
    const digits = '0123456789'.split('');
    for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits.slice(0, 4).join('');
}

// The single-player table still uses the shared presentation protocol.  There
// is only one viewer, but keeping the result on an absolute server timeline
// makes refresh/reconnect behavior deterministic and keeps the game compatible
// with the room-level presentation gate used by the other games.
const PRESENTATION_FADE_MS = 360;
const PRESENTATION_CONTENT_DURATIONS = {
    finalSettlement: 2500,
    finalClosure: 1200,
};

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function presentationContentDuration(kind) {
    return PRESENTATION_CONTENT_DURATIONS[kind] || 900;
}

class GuessNumberEngine {
    constructor(roomId, players, randomOrOptions = Math.random, extraOptions = {}) {
        const suppliedOptions = typeof randomOrOptions === 'function' ? extraOptions : (randomOrOptions || {});
        const random = typeof randomOrOptions === 'function' ? randomOrOptions : (suppliedOptions.random || Math.random);
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.options = { ...suppliedOptions };
        this.now = typeof suppliedOptions.now === 'function' ? suppliedOptions.now : () => Date.now();
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
        this.presentation = null;
        this.presentationQueue = [];
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
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
        this.presentation = null;
        this.presentationQueue = [];
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this.players.forEach(player => {
            player.attempts = 0;
            player.history = [];
            player.isOnline = true;
        });
        this.actionLog = [`${this.players[0].name} 先猜，答案是四位不重复数字`];
        return this._success('猜数字开始');
    }

    _now() {
        const value = Number(this.now?.());
        return Number.isFinite(value) ? value : Date.now();
    }

    _startPresentation(action = 'finalSettlement', data = {}, initialKind = action) {
        if (this.presentation && !this.presentation.resolved) return this._appendPresentationEvent(initialKind, data);
        const now = this._now();
        this.presentationQueue = this.presentationQueue.filter(batch => Number(batch.endsAt) > now);
        const previousEnd = Number(this.presentationQueue.at(-1)?.endsAt) || 0;
        const startedAt = Math.max(now, previousEnd);
        this.presentation = {
            sequence: ++this.presentationSequence,
            transactionId: this.presentationSequence,
            actorId: this.players[0]?.id || null,
            actorName: this.players[0]?.name || null,
            action,
            startedAt,
            endsAt: startedAt,
            durationMs: 0,
            blocking: true,
            events: [],
            resolved: false,
            ended: false,
            nextPhase: null,
            nextPlayerId: null,
            winner: null,
        };
        this.presentationQueue.push(this.presentation);
        return this._appendPresentationEvent(initialKind, data);
    }

    _appendPresentationEvent(kind, data = {}) {
        if (!this.presentation || this.presentation.resolved) return this._startPresentation(kind, data, kind);
        const now = this._now();
        const previousEnd = Number(this.presentation.events.at(-1)?.endsAt || this.presentation.endsAt) || now;
        const startedAt = Math.max(now, previousEnd);
        const contentDurationMs = presentationContentDuration(kind);
        const durationMs = contentDurationMs + PRESENTATION_FADE_MS;
        const eventId = ++this.presentationEventSequence;
        const event = {
            ...clone(data),
            sequence: eventId,
            eventId,
            kind,
            startedAt,
            endsAt: startedAt + durationMs,
            durationMs,
            contentDurationMs,
        };
        this.presentation.events.push(event);
        this.presentation.endsAt = event.endsAt;
        this.presentation.durationMs = this.presentation.endsAt - this.presentation.startedAt;
        return event;
    }

    _finishPresentation() {
        if (!this.presentation) return;
        this.presentation.resolved = true;
        this.presentation.ended = this.status === 'ended';
        this.presentation.nextPhase = this.status === 'playing' ? 'playing' : 'ended';
        this.presentation.nextPlayerId = this.status === 'playing' ? this.getCurrentPlayer()?.id || null : null;
        this.presentation.winner = this.winner ? { id: this.winner.id, name: this.winner.name } : null;
    }

    _presentationBatches(serverNow = this._now()) {
        return this.presentationQueue
            .filter(batch => Number(batch.endsAt) > serverNow && Array.isArray(batch.events) && batch.events.length)
            .map(batch => ({ ...clone(batch), serverNow }));
    }

    _projectPresentationEvent(event, player) {
        const projected = { ...event };
        if (!player || (event.kind !== 'finalSettlement' && event.kind !== 'finalClosure')) return projected;
        if (event.kind === 'finalSettlement' && event.winnerId != null && String(event.winnerId) === String(player.id)) {
            projected.viewerVariant = 'personalVictory';
            projected.title = '您已获胜';
            projected.detail = '您成功破解了隐藏密码。';
        }
        if (event.kind === 'finalClosure' && String(event.playerId) === String(player.id)) {
            projected.viewerVariant = 'personalClosure';
            projected.title = '本局已中止';
            projected.detail = '当前破解者已离线，档案已经封存。';
        }
        return projected;
    }

    _projectPresentation(batch, player) {
        if (!batch) return batch;
        const projected = clone(batch);
        projected.events = projected.events.map(event => this._projectPresentationEvent(event, player));
        return projected;
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
            this._startPresentation('finalSettlement', {
                outcome: 'solved',
                winnerId: player.id,
                winnerName: player.name,
                secret: this.secret,
                attempts: player.attempts,
                lastResult: clone(result),
            }, 'finalSettlement');
            this._finishPresentation();
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
        const serverNow = this._now();
        const presentations = this._presentationBatches(serverNow);
        const presentation = presentations.at(-1) || (this.presentation ? { ...clone(this.presentation), serverNow } : null);
        return {
            roomId: this.roomId,
            serverNow,
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
            presentations,
            presentation,
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        state.myId = playerId;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        state.availableActions = { canGuess: state.status === 'playing' && state.myIsCurrentTurn && Boolean(this.playerMap[playerId]?.isOnline) };
        state.presentation = this._projectPresentation(state.presentation, this.playerMap[playerId]);
        state.presentations = (state.presentations || []).map(batch => this._projectPresentation(batch, this.playerMap[playerId]));
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在' };
        const wasCurrent = this.getCurrentPlayer()?.id === playerId;
        player.isOnline = false;
        if (wasCurrent && this.status === 'playing') {
            const next = this._findNextAvailableIndex(this.currentTurnIndex);
            if (next === -1) {
                this.status = 'ended';
                this._appendPresentationEvent('finalClosure', {
                    outcome: 'aborted',
                    playerId,
                    playerName: player.name,
                    reason: 'playerLeave',
                });
                this._finishPresentation();
            } else this.currentTurnIndex = next;
        }
        this._syncTurnFlags();
        return this._success(`${player.name} 离开了游戏`);
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = GuessNumberEngine;
module.exports.makeSecret = makeSecret;
module.exports.PRESENTATION_FADE_MS = PRESENTATION_FADE_MS;
module.exports.PRESENTATION_CONTENT_DURATIONS = PRESENTATION_CONTENT_DURATIONS;
