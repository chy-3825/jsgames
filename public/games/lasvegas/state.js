export function createLasVegasModel() { return { state: null, selectedFace: null, rulesTrigger: null, actionPending: false, bodyOverflow: '', presentationQueue: [], presentationPlaying: false, presentationToken: 0, lastPresentationSequence: null, waitTimer: null, releaseWait: null }; }
export function currentPlayer(state) { return state?.players?.find(player => player.id === state.currentTurn) || null; }
export function participants(state) { return [...(state?.players || []), ...(state?.neutral ? [state.neutral] : [])]; }
export function playerById(state, id) { return participants(state).find(player => player.id === id); }
export function playerTone(player) { return player?.color || 'neutral'; }
