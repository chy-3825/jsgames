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
