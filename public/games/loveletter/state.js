import { CARD_NAMES, CARD_RULES, NEEDS_TARGET } from './constants.js';

export function createLoveLetterModel() {
    return {
        state: null,
        selectedCardIndex: null,
        selectedTargetId: null,
        selectedGuess: null,
        guessOpen: false,
        pendingAction: false,
        acknowledgementActionId: null,
        acknowledgementReadyAt: 0,
        acknowledgementDeadline: 0,
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
    const winners = next.roundWinners?.length ? next.roundWinners : next.roundWinner ? [next.roundWinner] : [];
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
    const wasOut = new Map((previous.players || []).map(player => [player.id, isOut(player)]));
    const newlyOut = (next.players || []).filter(player => !wasOut.get(player.id) && isOut(player));
    if (newlyOut.length) {
        return newlyOut.map(player => ({
            type: 'elimination',
            player: { id: player.id, name: player.name },
            card: eliminationCard(next, player.id),
            reason: next.lastAction?.result?.message || `${player.name} 离开了本轮`,
            outcome: roundOutcome(next),
        }));
    }
    const enteredRoundEnd = previous.status === 'playing' && (next.status === 'round_end' || next.status === 'ended');
    return enteredRoundEnd && next.endReason === 'showdown' ? [{ type: 'showdown', state: next }] : [];
}
