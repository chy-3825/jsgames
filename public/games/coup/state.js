import { ACTIONS, DECISION_REACTION_MS, ROLE_NAMES } from './constants.js';

export function createCoupModel() {
    return {
        state: null,
        pendingAction: null,
        submitting: false,
        hoveredActionKind: null,
        selectedTarget: null,
        exchangeOpen: false,
        exchangeMode: null,
        exchangeKeep: [],
        overlayReturnFocus: new WeakMap(),
        animateInteractionId: null,
        centeredInteractionId: null,
        actionLayoutFrame: 0,
        actionSettleTimer: 0,
        decisionKey: null,
        decisionReadyAt: 0,
        decisionTimer: 0,
        scenePlaying: false,
        sceneToken: 0,
        sceneQueue: [],
        sceneWaiters: new Set(),
        // Server-timed public broadcasts.  `sceneQueue` remains as a
        // compatibility buffer for older local scene callers, while these
        // fields drive the authoritative FIFO timeline.
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: 0,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationSkipCurrent: false,
        presentationEvent: null,
    };
}

/** Translate server absolute deadlines to this browser's clock. */
export function localizePresentation(batch, localNow = Date.now()) {
    if (!batch?.events?.length) return null;
    const serverNow = Number(batch.serverNow);
    const batchEnd = Number(batch.endsAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(batchEnd)) return batch;
    if (batchEnd <= serverNow) return null;
    const toLocalTime = value => Number.isFinite(Number(value))
        ? localNow + (Number(value) - serverNow)
        : value;
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

export function getPlayer(state, id) {
    return (state?.players || []).find(player => player.id === id) || null;
}

export function getSelf(state) {
    const publicSelf = getPlayer(state, state?.myId);
    if (!publicSelf && !state?.self) return null;
    return {
        ...(publicSelf || {}),
        ...(state.self || {}),
        name: publicSelf?.name || '我',
        isAlive: publicSelf?.isAlive ?? true,
        influences: publicSelf?.influences?.length ? publicSelf.influences : (state.self?.influences || []),
    };
}

export function isMyTurn(state) {
    return Boolean(state && state.currentTurn === state.myId && !state.gameOver);
}

export function getAction(kind) {
    const normalized = String(kind || '').replace(/^block_/, '');
    return ACTIONS.find(action => action.id === normalized) || null;
}

export function getActionName(kind) {
    return getAction(kind)?.name || '行动';
}

export function challengeLabel(phase) {
    if (phase === 'block') return '阻挡';
    if (phase === 'challenge') return '质疑';
    return '回应';
}

export function firstCharacter(value) {
    return Array.from(String(value || '玩'))[0] || '玩';
}

export function revealReason(reason) {
    if (reason === 'coup') return '因政变失去一张影响力。';
    if (reason === 'assassination') return '暗杀结算，失去一张影响力。';
    if (reason === 'challenge_failed') return '质疑失败，失去一张影响力。';
    if (reason === 'challenge_success') return '声明未通过，失去一张影响力。';
    if (reason === 'left') return '玩家离开了本局。';
    return '一张影响力已揭示。';
}

export function currentDecisionKey(value) {
    if (!value) return null;
    const actionId = value.interaction?.actionId || 0;
    if (value.influenceLoss?.isMyTurn) return `loss:${actionId}:${value.influenceLoss.playerId}:${value.interaction?.lastRevealId || 0}`;
    if (!value.challenge?.isMyTurn) return null;
    const challenge = value.challenge;
    const decider = challenge.currentBlockerId || challenge.currentChallengerId || challenge.responderId || value.myId;
    return `${challenge.phase}:${actionId}:${decider}:${challenge.claimedRole || ''}`;
}

export function updateDecisionWindow(model, previous, next, windowRef, render) {
    const nextKey = currentDecisionKey(next);
    if (!nextKey) {
        model.decisionKey = null;
        model.decisionReadyAt = 0;
        windowRef.clearTimeout(model.decisionTimer);
        return;
    }
    if (nextKey === model.decisionKey) return;
    model.decisionKey = nextKey;
    model.decisionReadyAt = previous ? Date.now() + DECISION_REACTION_MS : 0;
    windowRef.clearTimeout(model.decisionTimer);
    if (model.decisionReadyAt) {
        model.decisionTimer = windowRef.setTimeout(() => {
            if (currentDecisionKey(model.state) === model.decisionKey) render();
        }, DECISION_REACTION_MS + 20);
    }
}

export function decisionReady(model) {
    return !currentDecisionKey(model.state) || Date.now() >= model.decisionReadyAt;
}
