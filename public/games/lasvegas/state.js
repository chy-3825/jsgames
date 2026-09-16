export function createLasVegasModel() {
    return {
        state: null,
        selectedFace: null,
        rulesTrigger: null,
        actionPending: false,
        bodyOverflow: '',
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationEvent: null,
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
            segments: Array.isArray(event.segments)
                ? event.segments.map(segment => ({
                    ...segment,
                    startedAt: toLocalTime(segment.startedAt),
                    endsAt: toLocalTime(segment.endsAt),
                }))
                : event.segments,
        })),
    };
}

export function currentPlayer(state) { return state?.players?.find(player => player.id === state.currentTurn) || null; }
export function participants(state) { return [...(state?.players || []), ...(state?.neutral ? [state.neutral] : [])]; }
export function playerById(state, id) { return participants(state).find(player => player.id === id); }
export function playerTone(player) { return player?.color || 'neutral'; }
