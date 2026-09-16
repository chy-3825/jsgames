/* Public/private state projection for Magical Athlete. */

'use strict';

const { RACES, TRACK_LENGTH, TRACK_SPECIALS, ATHLETES } = require('./constants');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function getPublicState() {
    const current = this.players[this.currentTurnIndex]?.isOnline === false ? null : this.players[this.currentTurnIndex];
    const serverNow = this._now?.() ?? Date.now();
    const presentations = this._presentationBatches
        ? this._presentationBatches(serverNow)
        : (this.presentation ? [clone({ ...this.presentation, serverNow })] : []);
    const presentation = presentations.at(-1) || null;
    const prompt = this.pending ? { kind: this.pending.kind, playerId: this.pending.playerId, racerId: this.pending.racerId || null, targetRacerId: this.pending.targetRacerId || null, pool: this.pending.pool || null, options: this.pending.options || null } : null;
    return {
        roomId: this.roomId,
        status: this.status,
        phase: this.phase,
        match: this.match,
        maxMatches: RACES,
        teamSize: this.teamSize,
        racersPerPlayer: this.racersPerPlayer,
        trackSide: this.trackSide,
        trackLength: TRACK_LENGTH,
        draftRound: this.draftRound,
        draftPool: this.draftPool.map(athlete => ({ ...athlete })),
        serverNow,
        currentTurn: current?.id || null,
        currentTurnName: current?.name || null,
        raceSelectionStatus: this.phase === 'race_select' ? this.players.map(player => {
            const selectedCount = (this.raceSelections[player.id] || []).length;
            return {
                playerId: player.id,
                selectedCount,
                ready: selectedCount >= this.racersPerPlayer,
            };
        }) : [],
        athletes: ATHLETES.map(athlete => ({ ...athlete, takenBy: this.phase === 'draft' ? this.players.find(player => player.team.some(card => card.id === athlete.id))?.id || null : null, takenByName: this.phase === 'draft' ? this.players.find(player => player.team.some(card => card.id === athlete.id))?.name || null : null })),
        players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, score: player.score, bronze: player.bronze, isOnline: player.isOnline })),
        racers: this.racers.map(racer => ({ id: racer.id, playerId: racer.playerId, athleteId: racer.athleteId, position: racer.position, tripped: racer.tripped, eliminated: racer.eliminated, finishOrder: racer.finishOrder, bronze: racer.bronze, copiedAthlete: racer.copiedPowers[0] || null, athlete: this._athlete(racer.athleteId) })),
        trackSpecials: { ...TRACK_SPECIALS[this.trackSide] },
        history: this.history,
        presentation: clone(presentation),
        presentations,
        acknowledgement: this.pendingAcknowledgements[0] ? clone(this.pendingAcknowledgements[0]) : null,
        finalStandings: clone(this.finalStandings),
        prompt,
        actionLog: this.actionLog.slice(-24),
        winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null,
        winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })),
    };
}

function getPlayerState(playerId) {
    const state = this.getPublicState();
    const player = this.playerMap[playerId];
    if (state.prompt && state.prompt.playerId !== playerId) {
        // Egg/Twin choices are private information.  Other viewers may
        // see that a decision is pending, but not the candidate cards.
        state.prompt = { ...state.prompt, pool: null, options: null };
    }
    const projectBatch = batch => {
        const projected = this._projectPresentation ? this._projectPresentation(batch, player) : clone(batch);
        if (!projected?.events?.length) return projected;
        return {
            ...projected,
            events: projected.events.map(event => {
                const batchPrivate = this.presentationPrivate?.[batch.sequence];
                const privateData = batchPrivate?.[event.eventId]
                    || batchPrivate?.[event.sequence]
                    || (this.presentationPrivate?.[event.sequence]?.[playerId]);
                const viewerPrivate = privateData?.[playerId] || privateData;
                return viewerPrivate ? { ...event, private: clone(viewerPrivate) } : event;
            }),
        };
    };
    state.presentations = (state.presentations || []).map(projectBatch);
    state.presentation = state.presentations.at(-1) || null;
    const picks = this.raceSelections[playerId] || [];
    state.myId = playerId;
    state.myTeam = player?.team.map(athlete => ({ ...athlete, used: player.usedAthletes.includes(athlete.id) })) || [];
    state.myRaceSelections = picks.slice();
    state.myBronze = player?.bronze || 0;
    state.myAthlete = this.racers.find(racer => racer.playerId === playerId)?.athlete || null;
    const myRacer = this.racers.find(racer => racer.playerId === playerId && racer.finishOrder == null && !racer.eliminated);
    state.myRacer = myRacer ? { id: myRacer.id, athleteId: myRacer.athleteId, position: myRacer.position, tripped: myRacer.tripped, roll: myRacer.roll ?? null, extraTurn: Boolean(myRacer.extraTurn) } : null;
    state.availableActions = {
        chooseAthlete: !state.acknowledgement && this.phase === 'draft' && state.currentTurn === playerId,
        selectRaceAthlete: !state.acknowledgement && player?.isOnline !== false && this.phase === 'race_select' && this.raceSelectionQueue[this.raceSelectionIndex] === playerId,
        roll: !state.acknowledgement && this.phase === 'race' && state.currentTurn === playerId && this._playerHasActiveRacer(playerId) && !this.pending,
        acknowledgeElimination: state.acknowledgement?.playerId === playerId,
    };
    return state;
}

function getWinner() {
    if (!this.winner) return null;
    return {
        id: this.winner.id,
        name: this.winner.name,
        score: this.winner.score,
        shared: this.winners.length > 1,
        winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })),
    };
}
module.exports = {
    getPublicState,
    getPlayerState,
    getWinner,
};
