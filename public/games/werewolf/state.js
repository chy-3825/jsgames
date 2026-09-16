export function createWerewolfModel() {
    return {
        state: null,
        lastActionAt: 0,
        lastActionKey: '',
        targetDialog: null,
        roleIdentityVisible: false,
        hasViewedRole: false,
        roleRevealPointerId: null,
        roleRevealKey: null,
        timedFlowInterval: null,
        transitionTimer: null,
        transitionSequence: 0,
        lastAnnouncementDayKey: '',
        eliminationTimer: null,
        eliminationShatterTimer: null,
        eliminationSequence: 0,
        lastEliminationKey: '',
        lastPublicEventId: null,
        lastWinnerKey: '',
        sceneQueue: [],
        scenePlaying: false,
        activeScene: null,
        sceneDelayTimer: null,
        sceneWaiters: new Set(),
        presentationLockedUntil: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        eliminatedSeat: null,
        personalSpeechTimer: null,
        personalSpeechComplete: null,
        personalSpeechSequence: 0,
        speechTimer: null,
        speechComplete: null,
        speechSequence: 0,
        voiceEnabled: false,
        confirmingAllRoles: false,
        testRoleBySeat: new Map(),
    };
}

// Convert the authoritative epoch timestamps into the local browser clock.
// Every viewer receives the same server interval; only the local offset used
// to render it differs.  If an older snapshot has no serverNow, retain the
// legacy client-relative values so archived fixtures continue to work.
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

export function signature(state) {
    return [state?.status, state?.phase, state?.day, state?.activeSeat, state?.myRole, state?.myRoleConfirmed, state?.winner?.faction, state?.announcement?.day, state?.publicEvents?.at(-1)?.id].join('|');
}
