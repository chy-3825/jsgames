import { CARD_NAMES, CARD_RULES, NEEDS_TARGET } from './constants.js';

export function createLoveLetterModel() {
    return {
        state: null,
        selectedCardIndex: null,
        hoveredCardIndex: null,
        selectedTargetId: null,
        selectedGuess: null,
        guessOpen: false,
        pendingAction: false,
        acknowledgementActionId: null,
        acknowledgementDeadline: 0,
        presentedSeatRevealIds: new Set(),
        archiveKind: null,
    };
}

export function isOut(player) {
    return Boolean(player?.isOut || player?.isEliminated || player?.isAlive === false);
}

export function winnerNames(list, fallback) {
    return (list?.length ? list : fallback ? [fallback] : []).map(player => player.name).join('、');
}

export function getName(state, id) {
    return (state?.players || []).find(player => player.id === id)?.name || '目标玩家';
}

export function favorCount(state, playerId) {
    return Number((state?.favorTokens || []).find(token => token.id === playerId)?.count || 0);
}

export function favorTarget(state) {
    return Math.min(Number(state?.targetFavor || 4), 7);
}

export function favorScore(state, count) {
    return `${Math.min(Number(count) || 0, favorTarget(state))}/${favorTarget(state)}`;
}

export function shortEffect(id) {
    return CARD_RULES.find(rule => rule.value === Number(id))?.effect || '';
}

// Full rules stay in the rules dialog; hand cards only need a compact cue.
export function compactEffect(id) {
    return ({
        1: '猜牌，猜中出局',
        2: '秘密看牌',
        3: '比牌，低点出局',
        4: '保护自己一回合',
        5: '弃牌并重新摸牌',
        6: '交换手牌',
        7: '必须打出',
        8: '打出即出局',
    })[Number(id)] || '';
}

export function mustPlayCountessNow(state) {
    const hand = state?.myHand || [];
    return hand.some(card => card.id === 7) && hand.some(card => card.id === 5 || card.id === 6);
}

export function getTargets(state, card) {
    const active = (state?.players || []).filter(player => !isOut(player) && !player.isProtected);
    if (!card) return [];
    return card.id === 5 ? active : active.filter(player => player.id !== state.myId);
}

export function needsTargetSelection(state, card) {
    if (!card || !NEEDS_TARGET.has(card.id)) return false;
    if (card.id === 5) return true;
    return getTargets(state, card).length > 0;
}

export function canTarget(state, selectedCardIndex, player) {
    const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
    return Boolean(state?.myIsCurrentTurn && card && NEEDS_TARGET.has(card.id) && getTargets(state, card).some(target => target.id === player.id));
}

export function canPlaySelected(state, selectedCardIndex, selectedTargetId, selectedGuess, mustCountess) {
    const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
    if (!state?.myIsCurrentTurn || !card || (mustCountess && card.id !== 7)) return false;
    const needsTarget = needsTargetSelection(state, card);
    if (needsTarget && !selectedTargetId) return false;
    if (card.id === 1 && needsTarget && !selectedGuess) return false;
    return true;
}

export function clearSelection(model) {
    model.selectedCardIndex = null;
    model.hoveredCardIndex = null;
    model.selectedTargetId = null;
    model.selectedGuess = null;
    model.guessOpen = false;
}

export function normalizeSelection(model) {
    const state = model.state;
    const hand = state?.myHand || [];
    if (model.selectedCardIndex !== null && !hand[model.selectedCardIndex]) clearSelection(model);
    const card = model.selectedCardIndex === null ? null : hand[model.selectedCardIndex];
    if (model.selectedTargetId && !getTargets(state, card).some(player => player.id === model.selectedTargetId)) model.selectedTargetId = null;
    if (card?.id !== 1) {
        model.selectedGuess = null;
        model.guessOpen = false;
    }
}

export function discardValue(finalState, playerId) {
    return (finalState.publicDiscard || []).filter(entry => entry.ownerId === playerId).reduce((sum, entry) => sum + Number(entry.card?.value ?? entry.card?.id ?? 0), 0);
}

export function roundOutcome(next) {
    if (next.status !== 'round_end' && next.status !== 'ended') return null;
    const winners = next.status === 'ended'
        ? (next.winners?.length ? next.winners : next.winner ? [next.winner] : [])
        : (next.roundWinners?.length ? next.roundWinners : next.roundWinner ? [next.roundWinner] : []);
    return { winners, gameEnded: next.status === 'ended', targetFavor: next.targetFavor, favorTokens: next.favorTokens || [] };
}

function eliminationCard(next, playerId) {
    const result = next.lastAction?.result;
    if (result?.eliminated === playerId && result.revealedCard) return result.revealedCard;
    const entries = (next.publicDiscard || []).filter(entry => entry.ownerId === playerId);
    return [...entries].reverse().find(entry => entry.reason === 'eliminated' || entry.reason === 'prince')?.card || null;
}

export function deriveScenes(previous, next) {
    if (!previous || !next || previous.round !== next.round) return [];
    const serverTimeline = next.presentation;
    if (!serverTimeline || serverTimeline.id === previous.presentation?.id) return [];
    const remainingMs = Number(serverTimeline.endsAt) - Number(serverTimeline.serverNow || Date.now());
    if (remainingMs <= 0) return [];
    const timeline = { ...serverTimeline, endsAt: Date.now() + remainingMs };
    const wasOut = new Map((previous.players || []).map(player => [player.id, isOut(player)]));
    const newlyOut = (next.players || []).filter(player => !wasOut.get(player.id) && isOut(player));
    if (newlyOut.length) {
        const outcome = roundOutcome(next);
        const won = (timeline.winnerIds || []).includes(next.myId);
        if (won) return [{ type: 'personalVictory', outcome, timeline }];
        return newlyOut.map(player => ({
            type: player.id === next.myId ? 'personalElimination' : 'elimination',
            player: { id: player.id, name: player.name },
            card: eliminationCard(next, player.id),
            reason: next.lastAction?.result?.message || `${player.name} 离开了本轮`,
            outcome: player.id === next.myId ? null : outcome,
            timeline,
        }));
    }
    const enteredRoundEnd = previous.status === 'playing' && (next.status === 'round_end' || next.status === 'ended');
    if (enteredRoundEnd && next.endReason === 'showdown') {
        return [{ type: 'showdown', state: next, timeline }];
    }
    return [];
}
