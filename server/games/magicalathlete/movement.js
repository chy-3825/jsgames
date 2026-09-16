/* Movement and stop-trigger rules for the CMYK track. */

'use strict';

const { TRACK_LENGTH, SECOND_CORNER, TRACK_SPECIALS } = require('./constants');

function moveRacer(racer, steps) {
    this.deferredPrompt = null;
    const id = this._effectiveAthleteId(racer);
    const from = racer.position;
    // The rules explicitly distinguish a zero result from a move: it
    // must not trigger passing, stopping, or track-space effects.
    if (steps === 0) return;
    // Suckerfish: when a racer on my space moves, I can follow to their new space
    // (resolved as a deferred prompt after the move completes).
    const suckerAtStart = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'suckerfish' && item.position === from);
    racer._suckerAtStart = suckerAtStart ? suckerAtStart.id : null;
    let target = Math.min(TRACK_LENGTH, from + steps);
    // Stickler: any forward movement (main move or power move) that would
    // overshoot the finish simply does not move at all.
    const stickler = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'stickler');
    let blockedByStickler = false;
    if (stickler && id !== 'stickler' && steps > 0 && from < TRACK_LENGTH && from + steps > TRACK_LENGTH) {
        target = from;
        blockedByStickler = true;
        this._log(`${this._racerName(racer)} 被挑剔鬼阻止，无法以非恰好步数越过终点`);
    }
    const otherRacers = this._activeRacers().filter(item => item.id !== racer.id);
    // Leaptoad: "I only advance onto unoccupied spaces" — occupied spaces are
    // skipped without counting toward the number of spaces moved.
    if (id === 'leaptoad') {
        let position = from;
        let remaining = steps;
        let skipped = 0;
        while (remaining > 0 && position < TRACK_LENGTH) {
            position += 1;
            if (position >= TRACK_LENGTH) break;
            if (!otherRacers.some(item => item.position === position)) remaining -= 1;
            else skipped += 1;
        }
        target = Math.min(TRACK_LENGTH, position);
        for (let index = 0; index < skipped; index += 1) this._powerEvent(racer);
    }
    // Huge Baby: cannot stop on its space (except Start).
    const baby = otherRacers.find(item => this._effectiveAthleteId(item) === 'hugebaby' && item.position === target && item.finishOrder == null && target !== 0);
    if (baby && racer.id !== baby.id) {
        target = Math.max(0, target - 1);
        this._log(`${this._racerName(racer)} 被大宝宝挡回 ${target} 号格`);
    }
    if (blockedByStickler) return;
    racer.position = target;
    this._movementEvent(racer, from, target, 'main', { sourceRacerId: racer.id, steps });
    if (target >= TRACK_LENGTH && racer.finishOrder == null) {
        racer.finishOrder = this._finishedCount() + 1;
        this._appendPresentationEvent({ kind: 'racerFinished', racer: this._publicRacer(racer), place: racer.finishOrder, position: target });
        this._log(`${this._racerName(racer)} 以第 ${racer.finishOrder} 名冲线`);
    }
    if (racer.finishOrder == null) this._resolvePassing(racer, from, target);
    if (this.pendingAcknowledgements.length) return;
    if (racer.finishOrder == null) this._resolveStops(racer);
    if (this.pendingAcknowledgements.length) return;
    // Deferred prompts (Duelist / Suckerfish) pause the turn after the move.
    if (this.deferredPrompt) {
        this.pending = this.deferredPrompt;
        this.deferredPrompt = null;
        return;
    }
    if (racer._suckerAtStart) {
        const sucker = this.racers.find(item => item.id === racer._suckerAtStart && item.finishOrder == null && !item.eliminated);
        racer._suckerAtStart = null;
        if (sucker && sucker.position !== racer.position) {
            this.pending = { kind: 'suckerfish', racerId: sucker.id, playerId: this.playerMap[sucker.playerId].id, targetRacerId: racer.id, interruptRacerId: racer.id };
            this.actionLog.push(`${this._racerName(sucker)} 可跟随 ${this._racerName(racer)} 移动`);
        }
    }
}

function resolvePassing(racer, from, to) {
    const others = this._activeRacers().filter(item => item.id !== racer.id && item.position > from && item.position < to);
    for (const other of others) {
        const otherId = this._effectiveAthleteId(other);
        if (otherId === 'banana') {
            racer.tripped = true;
            this._abilityEvent(other, 'banana', [racer]);
            this._tripEvent(racer, 'banana', other.id);
            this._log(`${this._racerName(racer)} 超过香蕉，摔倒`);
            this._powerEvent(other);
            if (this.pendingAcknowledgements.length) return;
        }
        const racerId = this._effectiveAthleteId(racer);
        if (racerId === 'centaur') {
            this._abilityEvent(racer, 'centaur', [other]);
            this._log(`${this._racerName(racer)} 超过 ${this._racerName(other)}，对方后退 2 格`);
            this._moveByPower(other, -2, { sourceRacerId: racer.id, targetRacerId: other.id, abilityId: 'centaur' });
            this._powerEvent(racer);
            if (this.pendingAcknowledgements.length) return;
        }
    }
}

function resolveStops(racer) {
    const id = this._effectiveAthleteId(racer);
    const others = this._activeRacers().filter(item => item.id !== racer.id);
    // Track spaces resolve first (official trigger priority).
    const special = TRACK_SPECIALS[this.trackSide]?.[racer.position];
    if (special === 'star') { this._awardBronze(racer, 1); this._log(`${this._racerName(racer)} 停在星格，获得 1 枚铜星`); }
    if (special?.startsWith('arrow')) {
        const delta = Number(special.slice('arrow'.length));
        if (Number.isFinite(delta) && delta !== 0) {
            this._log(`${this._racerName(racer)} 停在箭格，${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`);
            this._moveByPower(racer, delta);
            return;
        }
    }
    if (special === 'trip') { racer.tripped = true; this._tripEvent(racer, 'track'); this._log(`${this._racerName(racer)} 停在 OUPS! 格，摔倒`); }
    // The stopper's own stop-powers.
    if (id === 'mouth' && this._countOn(racer.position) === 2) {
        const victim = others.find(item => item.position === racer.position && item.finishOrder == null && !item.eliminated);
        if (victim) {
            victim.eliminated = true;
            victim.eliminationOrder = ++this.eliminationCounter;
            this._abilityEvent(racer, 'mouth', [victim]);
            const warning = this._appendPresentationEvent({
                kind: 'eliminationThreatened', source: this._publicRacer(racer), victim: this._publicRacer(victim),
                position: racer.position, targetPlayerId: victim.playerId,
            });
            const createdAt = Number(warning.startedAt) || this._now();
            const deadlineAt = (Number(warning.endsAt) || createdAt) + 8000;
            this.pendingAcknowledgements.push({
                id: `elimination-${warning.eventId || warning.sequence}`, eventSequence: warning.eventId || warning.sequence,
                createdAt, deadlineAt,
                playerId: victim.playerId, playerName: this.playerMap[victim.playerId]?.name || '',
                racerId: victim.id, athleteId: victim.athleteId, athleteName: this._athlete(victim.athleteId)?.name || victim.athleteId,
                sourceRacerId: racer.id, sourceAthleteName: this._athlete(racer.athleteId)?.name || racer.athleteId,
                position: racer.position,
            });
            this._log(`${this._racerName(racer)} 吃掉了 ${this._racerName(victim)}！`);
            return;
        }
    }
    if (id === 'baba' && others.some(item => item.position === racer.position && item.finishOrder == null)) {
        racer.tripped = true;
        this._abilityEvent(racer, 'baba', others.filter(item => item.position === racer.position));
        this._tripEvent(racer, 'baba', racer.id);
        this._log(`${this._racerName(racer)} 停在有人的格子上，摔倒`);
        this._powerEvent(racer);
    }
    // Other racers' stop-powers (clockwise).
    for (const other of others) {
        if (this._effectiveAthleteId(other) === 'baba' && other.position === racer.position) {
            racer.tripped = true;
            this._abilityEvent(other, 'baba', [racer]);
            this._tripEvent(racer, 'baba', other.id);
            this._log(`${this._racerName(racer)} 停在巴巴雅嘎所在格，摔倒`);
            this._powerEvent(other);
        }
        if (this._effectiveAthleteId(other) === 'duelist' && other.position === racer.position && !racer._duelPrompted && !this.deferredPrompt) {
            racer._duelPrompted = true;
            this.deferredPrompt = { kind: 'duel', racerId: other.id, playerId: this.playerMap[other.playerId].id, targetRacerId: racer.id, interruptRacerId: racer.id };
            this.actionLog.push(`${this._racerName(other)} 可向 ${this._racerName(racer)} 提出决斗`);
        }
    }
    if (this._countOn(racer.position) === 2) {
        const romantic = others.find(item => this._effectiveAthleteId(item) === 'romantic' && item.finishOrder == null);
        if (romantic) {
            this._abilityEvent(romantic, 'romantic', [racer]);
            this._log(`${this._racerName(romantic)} 因 ${this._racerName(racer)} 停在独一格前进 2 格`);
            this._moveByPower(romantic, 2, { sourceRacerId: romantic.id, targetRacerId: racer.id, abilityId: 'romantic' });
            this._powerEvent(romantic);
        }
    }
}

// Power-caused movement (not the main move): still triggers pass/stop powers.

function moveByPower(racer, delta, context = {}) {
    if (racer.finishOrder != null || racer.eliminated) return;
    if (delta === 0) return;
    const from = racer.position;
    let target = Math.max(0, Math.min(TRACK_LENGTH, from + delta));
    const id = this._effectiveAthleteId(racer);
    const stickler = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'stickler');
    if (stickler && id !== 'stickler' && delta > 0 && from + delta > TRACK_LENGTH) {
        this._log(`${this._racerName(racer)} 被挑剔鬼阻止，无法以非恰好步数越过终点`);
        return;
    }
    if (id === 'leaptoad' && delta !== 0) {
        const direction = delta > 0 ? 1 : -1;
        let position = from;
        let remaining = Math.abs(delta);
        let skipped = 0;
        const others = this._activeRacers().filter(item => item.id !== racer.id);
        while (remaining > 0 && position > 0 && position < TRACK_LENGTH) {
            position += direction;
            if (position <= 0 || position >= TRACK_LENGTH) break;
            if (others.some(item => item.position === position)) skipped += 1;
            else remaining -= 1;
        }
        target = Math.max(0, Math.min(TRACK_LENGTH, position));
        for (let index = 0; index < skipped; index += 1) this._powerEvent(racer);
    }
    racer.position = target;
    this._movementEvent(racer, from, target, context.movementType || 'ability', { ...context, steps: delta });
    if (target >= TRACK_LENGTH && racer.finishOrder == null) {
        racer.finishOrder = this._finishedCount() + 1;
        this._appendPresentationEvent({ kind: 'racerFinished', racer: this._publicRacer(racer), place: racer.finishOrder, position: target });
        this._log(`${this._racerName(racer)} 以第 ${racer.finishOrder} 名冲线`);
    }
    if (racer.finishOrder == null) this._resolvePassing(racer, from, target);
    if (this.pendingAcknowledgements.length) return;
    if (racer.finishOrder == null) this._resolveStops(racer);
    if (this.pendingAcknowledgements.length) return;
    if (this.deferredPrompt) { this.pending = this.deferredPrompt; this.deferredPrompt = null; }
}

function warpTo(racer, target, context = {}) {
    if (racer.finishOrder != null || racer.eliminated) return;
    const from = racer.position;
    racer.position = Math.max(0, Math.min(TRACK_LENGTH, target));
    this._movementEvent(racer, from, racer.position, 'warp', context);
    // Warping does not count as movement (no passing), but arriving on a
    // space still counts as stopping and can trigger stop powers.
    this._resolveStops(racer);
    if (this.pendingAcknowledgements.length) return;
    if (this.deferredPrompt) { this.pending = this.deferredPrompt; this.deferredPrompt = null; }
}

// ---------- power events (Scoocher / Dicemonger) ----------

function powerEvent(source) {
    if (this.pendingAcknowledgements.length) return;
    // Scoocher: "When another racer's power happens, I move 1."
    // Dicemonger reroll movement is handled by the same event.
    for (const racer of this._activeRacers()) {
        if (racer.id === source.id) continue;
        const id = this._effectiveAthleteId(racer);
        if (id === 'scoocher') {
            this._abilityEvent(racer, 'scoocher', [source]);
            this._log(`${this._racerName(racer)} 因 ${this._racerName(source)} 的能力触发前进 1 格`);
            this._moveByPower(racer, 1, { sourceRacerId: source.id, targetRacerId: racer.id, abilityId: 'scoocher' });
            if (this.pendingAcknowledgements.length) return;
        }
    }
}

// ---------- after a racer's sub-turn ----------
module.exports = {
    moveRacer,
    resolvePassing,
    resolveStops,
    moveByPower,
    warpTo,
    powerEvent,
};
