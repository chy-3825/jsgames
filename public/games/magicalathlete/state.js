export function createMagicalAthleteModel() {
    return {
        state: null,
        interactionSignature: '',
        pendingAction: null,
        actionPending: false,
        previousFocus: null,
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        presentationTimer: null,
        presentationRelease: null,
        presentationWaiters: new Set(),
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        presentationLockedUntil: 0,
        presentationEvent: null,
        acknowledgementTimer: null,
        acknowledgementId: null,
        acknowledgementDeadline: 0,
    };
}

/** Translate server absolute timestamps to this browser's clock. */
export function localizePresentation(batch, localNow = Date.now()) {
    if (!batch?.events?.length) return null;
    const serverNow = Number(batch.serverNow);
    const batchEnd = Number(batch.endsAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(batchEnd)) return batch;
    if (batchEnd <= serverNow) return null;
    const toLocalTime = value => Number.isFinite(Number(value))
        ? localNow + (Number(value) - serverNow)
        : value;
    return {
        ...batch,
        startedAt: toLocalTime(batch.startedAt),
        endsAt: toLocalTime(batch.endsAt),
        events: batch.events.map(event => ({
            ...event,
            startedAt: toLocalTime(event.startedAt),
            endsAt: toLocalTime(event.endsAt),
        })),
    };
}
export function playerName(state, id) { return state?.players?.find(player => player.id === id)?.name || id; }
export function playerColor(state, id) { return state?.players?.find(player => player.id === id)?.color || '#fff'; }
export function athleteById(state, id) { return state?.athletes?.find(athlete => athlete.id === id); }
export function signature(next) { const racers = (next.racers || []).map(racer => `${racer.id}:${racer.position}:${racer.finishOrder}:${racer.tripped}:${racer.eliminated}`).join(','); const prompt = next.prompt ? `${next.prompt.kind}:${next.prompt.playerId}:${next.prompt.racerId}:${next.prompt.targetRacerId}` : ''; const team = (next.myTeam || []).map(athlete => `${athlete.id}:${athlete.used}`).join(','); const selections = (next.raceSelectionStatus || []).map(entry => `${entry.playerId}:${entry.selectedCount}:${entry.ready}`).join(','); return [next.status, next.phase, next.match, next.currentTurn, next.draftRound, prompt, racers, team, selections, next.myRacer?.roll, (next.myRaceSelections || []).join(','), (next.actionLog || []).at(-1)].join('|'); }
export function resetInteraction(model) { model.pendingAction = null; model.actionPending = false; }
