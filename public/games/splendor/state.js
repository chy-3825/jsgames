import { ALL_TOKENS, COLORS, COLOR_LABELS, END_LABELS } from './constants.js';
import { tokenTotal } from './cards.js';

export function createSplendorModel() {
    return {
        state: null,
        tokenChoice: [],
        selectedCard: null,
        commandMode: 'tokens',
        activeTier: 3,
        commandExpanded: false,
        actionPending: false,
        lastPresentationSequence: 0,
        presentationPlaying: false,
        presentationQueue: [],
        presentationToken: 0,
        presentationWaiters: new Set(),
    };
}

export function me(state) {
    return (state?.players || []).find(player => player.id === state.myId) || null;
}

export function discounts(state) {
    return Object.fromEntries(COLORS.map(color => [color, (state?.myCards || []).filter(card => card.bonus === color).length]));
}

export function purchasePlan(state, card) {
    const ownedDiscounts = discounts(state);
    const wallet = state?.myTokens || {};
    const costs = {};
    let goldNeeded = 0;
    for (const color of COLORS) {
        const printed = Number(card?.cost?.[color]) || 0;
        const afterDiscount = Math.max(0, printed - ownedDiscounts[color]);
        const paid = Math.min(afterDiscount, Number(wallet[color]) || 0);
        const gap = afterDiscount - paid;
        goldNeeded += gap;
        costs[color] = { printed, discount: ownedDiscounts[color], afterDiscount, paid, gap };
    }
    const gold = Number(wallet.gold) || 0;
    return { costs, goldNeeded, gold, missing: Math.max(0, goldNeeded - gold), affordable: goldNeeded <= gold };
}

export function turnCopy(state) {
    if (state.status === 'ended') {
        const winners = (state.winners || []).map(player => player.name).join('、');
        return winners ? `${winners} 赢得宝石商会` : END_LABELS[state.endReason] || '本局结束';
    }
    if (state.pendingTokenReturn) {
        return state.availableActions?.canReturnTokens
            ? `请归还 ${state.availableActions.returnTokenCount} 枚筹码`
            : `${state.pendingTokenReturn.playerName || '当前玩家'}正在归还筹码`;
    }
    if (state.pendingNoble) {
        return state.availableActions?.canChooseNoble
            ? '请选择一位来访贵族'
            : `${state.pendingNoble.playerName || '当前玩家'}正在接待贵族`;
    }
    const final = state.finalRoundStart !== null && state.finalRoundStart !== undefined ? ' · 最后一轮' : '';
    return state.availableActions?.canAct ? `你的回合 · 选择一项交易${final}` : `${state.currentTurnName || '对手'}正在行动${final}`;
}

export function choiceCounts(model) {
    return Object.fromEntries(ALL_TOKENS.map(color => [color, model.tokenChoice.filter(item => item === color).length]));
}

export function validTakeChoice(state, model) {
    const availableColors = COLORS.filter(color => (Number(state.tokens?.[color]) || 0) > 0).length;
    const unique = new Set(model.tokenChoice);
    if (model.tokenChoice.length === 3) return unique.size === 3;
    if (model.tokenChoice.length === 2 && unique.size === 1) return (Number(state.tokens?.[model.tokenChoice[0]]) || 0) >= 4;
    if (model.tokenChoice.length === 2 && unique.size === 2) return availableColors === 2;
    if (model.tokenChoice.length === 1) return availableColors === 1;
    return false;
}

export function takeHint(state, model) {
    if (!model.tokenChoice.length) return '0 枚已选';
    if (validTakeChoice(state, model)) return model.tokenChoice.map(color => COLOR_LABELS[color]).join(' · ');
    const unique = new Set(model.tokenChoice);
    if (model.tokenChoice.length === 1 && (state.tokens?.[model.tokenChoice[0]] || 0) >= 4) return '可再取同色，或选择其他颜色';
    if (unique.size === model.tokenChoice.length && model.tokenChoice.length < 3) return `还可选择 ${3 - model.tokenChoice.length} 种颜色`;
    return '当前组合不符合拿取规则';
}

export function affordableCount(state) {
    return [1, 2, 3].flatMap(tier => state.market?.[tier] || []).filter(card => purchasePlan(state, card).affordable).length
        + (state.myReserved || []).filter(card => purchasePlan(state, card).affordable).length;
}

export function returnState(state, model) {
    const wallet = state.myTokens || {};
    const selected = choiceCounts(model);
    const required = Number(state.availableActions?.returnTokenCount) || 0;
    const after = tokenTotal(wallet) - model.tokenChoice.length;
    return { wallet, selected, required, after, valid: model.tokenChoice.length >= required && after <= 10 && !model.actionPending };
}
