export function createGuessNumberModel({ actionLock, windowRef = globalThis.window || globalThis } = {}) {
    return {
        state: null,
        guess: '',
        inputNotice: '尚未输入数字',
        scenePlaying: false,
        sceneToken: 0,
        sceneWaiters: new Set(),
        reducedMotion: windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        actionLock,
    };
}

export function getPlayer(state, id) { return (state?.players || []).find(player => player.id === id) || null; }
export function firstCharacter(value) { return Array.from(String(value || '玩'))[0] || '玩'; }
