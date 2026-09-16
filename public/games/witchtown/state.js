export function createWitchTownModel() {
    return {
        state: null,
        pendingCardId: null,
        deckOrderDraft: null,
        dossierIdentityVisible: false,
        dossierRevealPointerId: null,
        dossierRevealKey: null,
        dossierReviewKey: '',
        hasViewedDossier: false,
        selectDraft: new Map(),
        sceneTimer: null,
        sceneStartTimer: null,
        scenePlaying: false,
        sceneQueue: [],
        lastPresentationEventId: null,
        seenPresentationEventIds: new Set(),
        presentationEpoch: null,
        presentationClockOffset: 0,
        rulesScrollY: 0,
    };
}

export function playerById(state, id) {
    return (state?.players || []).find(player => player.id === id) || null;
}

export function alivePlayers(state, includeSelf = false) {
    return (state?.players || []).filter(player => !player.eliminated && (includeSelf || player.id !== state.myId));
}

export function currentDossierReviewKey(state) {
    if (!state || state.phase !== 'dossier_review') return '';
    return [state.dossierReviewReason || 'review', ...(state.myTrialCards || []).map(card => `${card.id}:${card.type}:${String(card.revealed)}`)].join('|');
}

export function hasMyAction(actions) {
    return Object.values(actions || {}).some(Boolean);
}
