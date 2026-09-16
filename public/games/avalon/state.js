export function createAvalonModel({ windowRef = globalThis.window || globalThis } = {}) {
    return {
        state: null,
        teamDraft: new Set(),
        pendingChoice: null,
        assassinTarget: null,
        interactionKey: '',
        roleIdentityVisible: false,
        hasViewedRole: false,
        roleRevealPointerId: null,
        roleRevealKey: null,
        actionPending: false,
        sceneTimer: null,
        sceneSequence: 0,
        sceneQueue: [],
        scenePlaying: false,
        sceneToken: 0,
        sceneWaiters: new Set(),
        presentationLockedUntil: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        lastPublicEventId: null,
        lastWinnerKey: '',
        prefersReducedMotion: windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    };
}

export function localizePresentation(batch, localNow = Date.now()) {
    if (!batch?.events?.length) return null;
    const serverNow = Number(batch.serverNow);
    const batchEnd = Number(batch.endsAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(batchEnd)) return batch;
    if (batchEnd <= serverNow) return null;
    const toLocalTime = value => localNow + (Number(value) - serverNow);
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

export function signature(state) { return [state?.status, state?.phase, state?.round, state?.leaderId, String(state?.myRoleConfirmed), String(state?.myVote), String(state?.myMissionVote), state?.publicEvents?.at(-1)?.id].join('|'); }

export function syncInteraction(model) {
    const state = model.state; const key = signature(state);
    if (key === model.interactionKey) return;
    model.interactionKey = key;
    model.teamDraft = new Set(state?.availableActions?.proposeTeam ? (state.team || []).map(player => player.id) : []);
    model.pendingChoice = null; model.assassinTarget = null;
}
