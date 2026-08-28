import { COLORS, END_LABELS, LABELS, VALUES } from './constants.js';

export function createHanabiModel() {
    return {
        state: null,
        targetId: null,
        clueKind: 'color',
        clueValue: 'red',
        pendingCardId: null,
        submittingCardAction: null,
        submittingClue: false,
        lastPresentedActionId: 0,
    };
}

export function endLabel(state) {
    return END_LABELS[state?.endReason] || `本局结束 · ${state?.score || 0} / 25 分`;
}

export function currentTarget(state, targetId) {
    return (state?.players || []).find(player => player.id === targetId && player.id !== state.myId && player.isOnline !== false) || null;
}

export function cardMatchesClue(clueKind, clueValue, card) {
    if (!card || card.hidden) return false;
    return clueKind === 'color' ? card.color === clueValue : Number(card.value) === Number(clueValue);
}

export function normalizeClueValue(model) {
    const target = currentTarget(model.state, model.targetId);
    const cards = (target?.hand || []).filter(card => !card.hidden);
    if (!cards.length) return;
    if (!cards.some(card => cardMatchesClue(model.clueKind, model.clueValue, card))) {
        model.clueValue = model.clueKind === 'color' ? cards[0].color : Number(cards[0].value);
    }
}

export function turnCopy(state) {
    if (state.status === 'ended') return `${endLabel(state)} · ${state.scoreRating || ''}`;
    const final = state.finalTurnsRemaining !== null && state.finalTurnsRemaining !== undefined
        ? ` · 最终轮剩 ${state.finalTurnsRemaining} 次行动`
        : '';
    if (state.currentTurn === state.myId) return `你的回合 · 选择一项行动${final}`;
    return `${state.currentTurnName || '队友'}正在行动${final}`;
}

export function ownKnowledge(card) {
    const hints = card?.hints || {};
    const knownColors = (hints.colors || []).filter(color => COLORS.includes(color));
    const excludedColors = (hints.notColors || []).filter(color => COLORS.includes(color));
    const knownValues = (hints.values || []).map(Number).filter(value => VALUES.includes(value));
    const excludedValues = (hints.notValues || []).map(Number).filter(value => VALUES.includes(value));
    const possibleColors = knownColors.length ? knownColors : COLORS.filter(color => !excludedColors.includes(color));
    const possibleValues = knownValues.length ? knownValues : VALUES.filter(value => !excludedValues.includes(value));
    return {
        knownColor: knownColors[0] || null,
        knownValue: knownValues[0] || null,
        colorText: knownColors.length
            ? `已知 ${knownColors.map(color => `${LABELS[color]}色`).join('、')}`
            : excludedColors.length
                ? `可能 ${possibleColors.map(color => LABELS[color]).join('、')}`
                : '颜色未知',
        valueText: knownValues.length
            ? `已知数字 ${knownValues.join('、')}`
            : excludedValues.length
                ? `可能数字 ${possibleValues.join('、')}`
                : '数字未知',
        exclusionText: [
            excludedColors.length ? `排除 ${excludedColors.map(color => LABELS[color]).join('、')}` : '',
            excludedValues.length ? `排除 ${excludedValues.join('、')}` : '',
        ].filter(Boolean).join(' · '),
        hasKnowledge: Boolean(knownColors.length || excludedColors.length || knownValues.length || excludedValues.length),
    };
}
