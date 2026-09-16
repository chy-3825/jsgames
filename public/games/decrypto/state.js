export function createDecryptoModel({ windowRef = globalThis.window || globalThis } = {}) {
    let privacyProtection = true;
    try { privacyProtection = windowRef.localStorage?.getItem('jsgames.decrypto.privacy') !== 'off'; } catch {}
    return {
        state: null,
        codeDraft: [],
        encryptorCandidateId: '',
        interactionKey: '',
        overlayTrigger: null,
        activeOverlay: null,
        bodyOverflow: '',
        keywordsVisible: false,
        notebookView: 'matrix',
        tutorialOpened: false,
        privacyProtection,
        codeVisible: false,
        hasViewedKeywords: false,
        hasViewedCode: false,
        codePointerId: null,
        codeRevealKey: null,
        sceneTimer: null,
        sceneSequence: 0,
        // Server-timed public broadcasts.  The legacy scene fields remain
        // available for compatibility with older room snapshots.
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationSkipCurrent: false,
        presentationEvent: null,
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

export function myPlayer(state) { return (state?.players || []).find(player => player.id === state?.myId); }
export function myTeam(state) { return (state?.teams || []).find(team => team.id === state?.myTeam); }
export function maxRounds(state) { return state?.players?.length === 3 ? 5 : 8; }
export function signature(state) { return [state?.status, state?.phase, state?.round, state?.currentTeam, state?.activeTeam, state?.encryptorId, (state?.currentClues || []).join('|'), state?.history?.length].join('·'); }

export function syncInteraction(model) {
    const state = model.state;
    const key = [state?.status, state?.phase, state?.round, state?.currentTeam, state?.activeTeam, state?.encryptorId, (state?.currentClues || []).join('|')].join('·');
    if (key === model.interactionKey) return;
    model.interactionKey = key;
    model.codeDraft = [];
    model.encryptorCandidateId = '';
    model.codeVisible = false;
    model.codePointerId = null;
    model.codeRevealKey = null;
    model.hasViewedCode = false;
    if (state?.phase !== 'keycheck' && model.privacyProtection) model.keywordsVisible = false;
}
