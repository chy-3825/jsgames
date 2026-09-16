import { tileIdFor } from './constants.js';

export function createAcquireModel() {
    return {
        state: null,
        pendingTileId: null,
        pendingTileOrigin: null,
        previousFocus: null,
        pendingConfirmation: null,
        actionPending: false,
        lastPresentationSequence: 0,
        presentationPlaying: false,
        presentationQueue: [],
        presentationToken: 0,
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
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
            segments: event.segments?.map(segment => ({ ...segment, startedAt: toLocalTime(segment.startedAt), endsAt: toLocalTime(segment.endsAt) })),
        })),
    };
}

export function getMe(state) {
    return (state?.players || []).find(player => player.id === state.myId);
}

export function getChain(state, chainId) {
    return state?.corporations?.[chainId] || null;
}

export function getNeighbors(state, row, col) {
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < 9 && nextCol >= 0 && nextCol < 12)
        .map(([nextRow, nextCol]) => state.board?.[tileIdFor(nextRow, nextCol)])
        .filter(Boolean);
}

export function canPlayTile(state, tile) {
    if (!tile || state.board?.[tile.id]) return false;
    const adjacent = getNeighbors(state, tile.row, tile.col);
    const chainIds = [...new Set(adjacent.map(cell => cell.chain).filter(Boolean))];
    const safeChains = chainIds.filter(chainId => (getChain(state, chainId)?.size || 0) >= 11);
    if (safeChains.length >= 2) return false;
    if (!chainIds.length && adjacent.some(cell => !cell.chain)) return Object.values(state.corporations || {}).some(chain => !chain.active);
    return true;
}
