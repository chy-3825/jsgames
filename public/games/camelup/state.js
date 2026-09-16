export function createCamelUpModel() { return { state: null, interactionSignature: '', actionMode: null, selectedCamel: null, selectedFinishCard: null, selectedOutcome: 'winner', selectedTileType: 'oasis', selectedTilePosition: null, actionPending: false, previousFocus: null, presentationQueue: [], presentationPlaying: false, presentationToken: 0, lastPresentationSequence: 0, presentationTimer: null, presentationRelease: null, presentationWaiters: new Set(), presentationLockedUntil: 0 }; }
export function getActions(state) { return state?.availableActions || {}; }
export function getMyPlayer(state) { return state?.players?.find(player => player.id === state.myId); }
export function signature(next) { const camelState = (next.camels || []).map(camel => `${camel.id}:${camel.position}:${camel.order}`).join(','); const tiles = Object.entries(next.tiles || {}).map(([position, tile]) => `${position}:${tile.ownerId}:${tile.kind}`).join(','); const cards = (next.myRaceCards || []).map(card => card.id).join(','); const actionState = Object.entries(next.availableActions || {}).map(([key, value]) => `${key}:${value}`).join(','); return [next.status, next.phase, next.leg, next.currentTurn, (next.rolled || []).join(','), camelState, tiles, cards, actionState].join('|'); }
export function resetInteraction(model) { model.actionMode = null; model.selectedCamel = null; model.selectedFinishCard = null; model.selectedOutcome = 'winner'; model.selectedTileType = 'oasis'; model.selectedTilePosition = null; model.actionPending = false; }

export function localizePresentation(batch, localNow = Date.now()) {
    if (!batch?.events?.length) return null;
    const serverNow = Number(batch.serverNow);
    const batchEnd = Number(batch.endsAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(batchEnd)) return batch;
    if (batchEnd <= serverNow) return null;
    const toLocalTime = value => Number.isFinite(Number(value)) ? localNow + (Number(value) - serverNow) : value;
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
