export function createGuessNumberModel({ actionLock, windowRef = globalThis.window || globalThis } = {}) {
    return {
        state: null,
        guess: '',
        inputNotice: '尚未输入数字',
        // Server-timed presentation state.  Guess Number is a solo table, but
        // keeping the same queue/deadline contract as the multiplayer games
        // makes refresh, skip and room-level gating deterministic.
        scenePlaying: false,
        sceneToken: 0,
        sceneWaiters: new Set(),
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationSkipCurrent: false,
        presentationEvent: null,
        reducedMotion: windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        actionLock,
    };
}

/** Translate server absolute deadlines to this browser's clock. */
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

export function getPlayer(state, id) { return (state?.players || []).find(player => player.id === id) || null; }
export function firstCharacter(value) { return Array.from(String(value || '玩'))[0] || '玩'; }
