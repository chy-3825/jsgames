import { GOODS } from './constants.js';

export function createManilaModel() {
    return {
        state: null,
        interactionSignature: '',
        pendingChoice: null,
        financeChoice: null,
        bidDraft: 1,
        boatDraft: GOODS.slice(0, 3).map(good => ({ good, start: 3 })),
        pilotDraft: { mode: 'one', boat1: '', delta1: 1, boat2: '', delta2: 1 },
        sailOrder: [],
        previousFocus: null,
        actionPending: false,
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: 0,
        waitTimer: null,
        releaseWait: null,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationEvent: null,
    };
}

/** Translate server absolute timestamps to this browser's clock. */
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
            segments: Array.isArray(event.segments) ? event.segments.map(segment => ({ ...segment, startedAt: toLocalTime(segment.startedAt), endsAt: toLocalTime(segment.endsAt) })) : event.segments,
        })),
    };
}

export function getActions(state) { return state?.availableActions || {}; }
export function getMyPlayer(state) { return state?.players?.find(player => player.id === state.myId); }
export function phaseLabel(state, labels) { return labels[state?.phase] || '等待开航'; }

export function stateSignature(next) {
    const me = next.players?.find(player => player.id === next.myId);
    const boats = (next.boats || []).map(boat => `${boat.id}:${boat.position}:${boat.fate}`).join(',');
    const positions = Object.entries(next.locations || {}).map(([id, stakes]) => `${id}:${stakes.length}`).join(',');
    const movement = (next.movementPlan?.rolls || []).map(item => `${item.boatId}:${item.roll}:${item.from}`).join(',');
    return [next.status, next.phase, next.voyage, next.masterStep, next.currentTurn, next.movementRound, next.auction?.highestBid, me?.cash, (next.myEncumberedShares || []).join(','), boats, positions, movement].join('|');
}

export function resetDrafts(model) {
    const state = model.state;
    model.actionPending = false;
    model.pendingChoice = null;
    model.financeChoice = null;
    model.bidDraft = Math.max(1, Number(state?.auction?.highestBid || 0) + 1);
    model.boatDraft = GOODS.slice(0, 3).map(good => ({ good, start: 3 }));
    const sailing = (state?.boats || []).filter(boat => boat.fate === 'sailing');
    model.pilotDraft = { mode: 'one', boat1: String(sailing[0]?.id ?? ''), delta1: 1, boat2: String(sailing[1]?.id ?? ''), delta2: 1 };
    model.sailOrder = [];
}
