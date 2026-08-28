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
        sceneTimer: null,
        sceneSequence: 0,
        sceneQueue: [],
        scenePlaying: false,
        lastPublicEventId: null,
        lastWinnerKey: '',
        prefersReducedMotion: windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
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
