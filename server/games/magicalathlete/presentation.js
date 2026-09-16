// Server-owned presentation timeline for Magical Athlete.

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

const PRESENTATION_FADE_MS = 360;
const PRESENTATION_CONTENT_DURATIONS = {
    tournamentStarted: 1200,
    draftRoundStarted: 900,
    athleteDrafted: 520,
    raceSelectionStarted: 900,
    lineupLocked: 560,
    lineupRevealed: 1500,
    raceStarted: 850,
    turnStarted: 430,
    dieRevealed: 620,
    abilityTriggered: 650,
    racerMoved: 780,
    racerTripped: 520,
    racerRecovered: 520,
    bronzeAwarded: 420,
    bronzeRemoved: 420,
    eliminationThreatened: 1200,
    racerEliminated: 1150,
    racerFinished: 1200,
    raceSettlement: 2200,
    finalSettlement: 3000,
    playerLeft: 900,
};

function presentationContentDuration(kind, data = {}) {
    if (kind === 'abilityTriggered' && data.abilityId === 'duelist') return 1000;
    return PRESENTATION_CONTENT_DURATIONS[kind] || 820;
}

const presentationMethods = {
    _now() { return Number(this.now?.()) || Date.now(); },

    _startPresentation(actorId, action) {
        const now = this._now();
        this.presentationQueue = this.presentationQueue.filter(batch => Number(batch.endsAt) > now);
        const previousEnd = Number(this.presentationQueue.at(-1)?.endsAt) || 0;
        const startedAt = Math.max(now, previousEnd);
        const sequence = ++this.presentationSequence;
        this.presentation = {
            sequence,
            transactionId: sequence,
            actorId,
            action,
            startedAt,
            endsAt: startedAt,
            durationMs: 0,
            blocking: true,
            events: [],
            resolved: false,
            ended: false,
            endReason: null,
            outcome: null,
            nextPhase: null,
            nextPlayerId: null,
            winner: null,
        };
        this.presentationQueue.push(this.presentation);
        this.presentationPrivate[sequence] ||= {};
        return this.presentation;
    },

    _appendPresentationEvent(event, privateByPlayer = null) {
        if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system');
        const now = this._now();
        const previousEnd = Number(this.presentation.events.at(-1)?.endsAt || this.presentation.endsAt) || now;
        const startedAt = Math.max(now, previousEnd);
        const contentDurationMs = Math.max(0, Number(event.contentDurationMs) || presentationContentDuration(event.kind, event));
        const durationMs = contentDurationMs + PRESENTATION_FADE_MS;
        const eventId = ++this.presentationEventSequence;
        const entry = {
            ...clone(event),
            eventId,
            sequence: eventId,
            startedAt,
            endsAt: startedAt + durationMs,
            durationMs,
            contentDurationMs,
        };
        this.presentation.events.push(entry);
        this.presentation.endsAt = entry.endsAt;
        this.presentation.durationMs = this.presentation.endsAt - this.presentation.startedAt;
        if (privateByPlayer && Object.keys(privateByPlayer).length) {
            this.presentationPrivate[this.presentation.sequence] ||= {};
            this.presentationPrivate[this.presentation.sequence][eventId] = clone(privateByPlayer);
        }
        return entry;
    },

    _finishPresentation() {
        if (!this.presentation) return;
        this.presentation.resolved = true;
        this.presentation.ended = this.status === 'ended';
        this.presentation.endReason = this.endReason || null;
        this.presentation.outcome = this.outcome || null;
        this.presentation.nextPhase = this.phase;
        this.presentation.nextPlayerId = this.status === 'playing' ? this.players[this.currentTurnIndex]?.isOnline ? this.players[this.currentTurnIndex].id : null : null;
        this.presentation.winner = this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null;
    },

    _presentationBatches(serverNow = this._now()) {
        return this.presentationQueue
            .filter(batch => Number(batch.endsAt) > serverNow && Array.isArray(batch.events) && batch.events.length)
            .map(batch => ({ ...clone(batch), serverNow }));
    },

    _projectPresentationEvent(event, player) {
        const projected = { ...event };
        const viewerId = String(player?.id ?? '');
        if (event.kind === 'racerEliminated' && String(event.victim?.playerId ?? '') === viewerId) {
            projected.viewerVariant = 'personalElimination';
            projected.title = '您的运动员已淘汰';
            projected.detail = '该运动员退出本场比赛，您的队伍仍可参加后续场次。';
        }
        if (event.kind === 'eliminationThreatened' && String(event.targetPlayerId ?? event.victim?.playerId ?? '') === viewerId) {
            projected.viewerVariant = 'personalEliminationWarning';
            projected.title = '您的运动员面临淘汰';
            projected.detail = '确认后将执行本场淘汰；您仍可参加后续场次。';
        }
        if (event.kind === 'finalSettlement' && (event.winnerIds || []).map(String).includes(viewerId)) {
            const shared = (event.winnerIds || []).length > 1;
            projected.viewerVariant = 'personalVictory';
            projected.title = shared ? '您已并列获胜' : '您已获胜';
            projected.detail = shared ? '您与其他玩家共享本场最终胜利。' : '您的队伍取得了最高终局积分。';
        }
        if (event.kind === 'playerLeft' && String(event.playerId ?? '') === viewerId) {
            projected.viewerVariant = 'personalDeparture';
            projected.title = '您已离开本局';
            projected.detail = '您的席位已退出，剩余玩家将完成结算。';
        }
        return projected;
    },

    _projectPresentation(batch, player) {
        if (!batch) return batch;
        const projected = clone(batch);
        projected.events = (projected.events || []).map(event => this._projectPresentationEvent(event, player));
        return projected;
    },
};

module.exports = { PRESENTATION_FADE_MS, PRESENTATION_CONTENT_DURATIONS, presentationMethods };
