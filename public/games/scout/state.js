import { combination, compareCombination } from './constants.js';

export function createScoutModel() {
    return {
        state: null,
        selected: new Set(),
        actionMode: 'show',
        orientationDraft: null,
        scoutDraft: { edge: 'left', insertAt: 0, orientation: 0 },
        interactionKey: '',
        actionPending: false,
        presentationQueue: [],
        presentationPlaying: false,
        presentationToken: 0,
        lastPresentationSequence: null,
        waitTimer: null,
        releaseWait: null,
    };
}

export function getActions(state) {
    return state?.availableActions || {};
}

export function selectedIndices(model) {
    return [...model.selected].sort((a, b) => a - b);
}

export function selectedCards(model) {
    return selectedIndices(model).map(index => model.state?.myHand?.[index]).filter(Boolean);
}

export function selectionIsContinuous(model, indices = selectedIndices(model)) {
    return indices.length > 0 && indices.every((index, position) => position === 0 || index === indices[position - 1] + 1);
}

export function activeAfterScout(model) {
    const cards = (model.state?.activeSet || []).slice();
    if (model.scoutDraft.edge === 'left') cards.shift(); else cards.pop();
    return cards;
}

export function scoutSourceCard(model) {
    const active = model.state?.activeSet || [];
    return model.scoutDraft.edge === 'left' ? active[0] : active.at(-1);
}

export function orientedScoutCard(model) {
    const card = scoutSourceCard(model);
    if (!card) return null;
    const front = Number(card.front ?? card.value ?? 0);
    const back = Number(card.back ?? card.otherValue ?? card.value ?? 0);
    return { ...card, value: model.scoutDraft.orientation === 1 ? back : front, otherValue: model.scoutDraft.orientation === 1 ? front : back, orientation: model.scoutDraft.orientation };
}

export function postScoutIndices(model) {
    return selectedIndices(model).map(index => index >= model.scoutDraft.insertAt ? index + 1 : index);
}

export function postScoutSelectionIsContinuous(model) {
    return selectionIsContinuous(model, postScoutIndices(model));
}

export function selectionAssessment(model, mode = model.actionMode) {
    const combo = combination(selectedCards(model));
    if (!model.selected.size) return { combo: null, valid: false, message: '请从上方节目单选择连续手牌' };
    if (!selectionIsContinuous(model)) return { combo: null, valid: false, message: '手牌必须连续，不能跨过中间的牌' };
    if (!combo) return { combo: null, valid: false, message: '所选牌不是同点数，也不是连续顺子' };
    if (mode === 'scoutShow' && !postScoutSelectionIsContinuous(model)) return { combo, valid: false, message: '当前插入位置会拆开所选节目，请移到组合外侧' };
    const target = combination(mode === 'scoutShow' ? activeAfterScout(model) : model.state?.activeSet || []);
    if (compareCombination(combo, target) <= 0) return { combo, target, valid: false, message: '这组牌还压不过招募后的当前节目' };
    return { combo, target, valid: true, message: mode === 'scoutShow' ? '招募后将立即提交这组节目' : '这组节目可以登台' };
}

export function syncInteraction(model) {
    const state = model.state;
    const handKey = (state?.myHand || []).map(card => `${card.id}:${card.value}`).join(',');
    const activeKey = (state?.activeSet || []).map(card => `${card.id}:${card.value}`).join(',');
    const key = [state?.status, state?.phase, state?.currentPlayerId, handKey, activeKey].join('|');
    if (key === model.interactionKey) return;
    model.interactionKey = key;
    model.selected = new Set();
    model.orientationDraft = null;
    model.actionMode = 'show';
    model.scoutDraft = { edge: 'left', insertAt: 0, orientation: 0 };
}

export function signature(state) {
    const hand = (state?.myHand || []).map(card => `${card.id}:${card.value}`).join(',');
    const active = (state?.activeSet || []).map(card => `${card.id}:${card.value}`).join(',');
    return [state?.status, state?.phase, state?.currentPlayerId, hand, active, state?.round, state?.startPlayerId].join('|');
}
