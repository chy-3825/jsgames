export function createModernArtModel() { return { state: null, interactionSignature: '', handSelection: { primary: null, second: null }, pendingChoice: null, fixedDraft: 20, bidDraft: 1, actionPending: false, previousFocus: null, presentationQueue: [], presentationPlaying: false, presentationToken: 0, lastPresentationSequence: 0, waitTimer: null, releaseWait: null, presentationEventIds: new Set(), presentationWaiters: new Set(), presentationLockedUntil: 0, presentationEvent: null }; }

/** Translate server absolute presentation deadlines to this browser clock. */
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
export function getActions(state) { return state?.availableActions || {}; }
export function getMyPlayer(state) { return state?.players?.find(player => player.id === state.myId); }
export function signature(next) { const auction = next.auction; const hand = (next.myHand || []).map(card => card.id).join(','); const counts = Object.values(next.roundCounts || {}).join(','); return [next.status, next.phase, next.round, next.currentTurn, auction?.type, auction?.highestBid, auction?.highestBidder, auction?.bidCount, auction?.passed?.length, next.doubleOffer?.passed?.length, next.mysteryOffer?.remaining, next.myCash, hand, next.market?.length, counts].join('|'); }
export function resetInteraction(model) { const state = model.state; model.actionPending = false; model.handSelection = { primary: null, second: null }; model.pendingChoice = null; model.fixedDraft = Math.max(1, Math.min(20, Number(state?.myCash || 1))); const auction = state?.auction; model.bidDraft = auction?.type === 'fixed' ? Number(auction.fixedPrice || 0) : Math.max(1, Number(auction?.highestBid || 0) + 1); }
