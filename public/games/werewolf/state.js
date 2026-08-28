export function createWerewolfModel() {
    return {
        state: null,
        lastActionAt: 0,
        lastActionKey: '',
        targetDialog: null,
        roleIdentityVisible: false,
        roleRevealPointerId: null,
        roleRevealKey: null,
        timedFlowInterval: null,
        transitionTimer: null,
        transitionResultTimer: null,
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
        sceneDelayTimer: null,
        voiceEnabled: false,
        confirmingAllRoles: false,
        testRoleBySeat: new Map(),
    };
}

export function signature(state) {
    return [state?.status, state?.phase, state?.day, state?.activeSeat, state?.myRole, state?.myRoleConfirmed, state?.winner?.faction, state?.announcement?.day, state?.publicEvents?.at(-1)?.id].join('|');
}
