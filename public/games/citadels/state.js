import { ROLE_META } from './constants.js';
import { roleMeta } from './cards.js';

export function createCitadelsModel() {
    return {
        state: null,
        selectedCardIds: [],
        pendingRoleId: null,
        pendingRoleAction: null,
        pendingBuildId: null,
        pendingDecision: null,
        swapMode: false,
        actionPending: false,
        lastPresentationSequence: 0,
        presentationPlaying: false,
        presentationQueue: [],
        presentationToken: 0,
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
    };
}

/** Translate the server's absolute timeline to this browser's clock. */
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

export function playerById(state, id) {
    return (state?.players || []).find(player => player.id === id) || null;
}

export function currentRoleMeta(state) {
    if (!state?.currentRoleRank) return null;
    return Object.values(ROLE_META).find(role => role.rank === state.currentRoleRank) || null;
}

export function toggleSelection(model, id, limit) {
    if (!id) return;
    if (model.selectedCardIds.includes(id)) model.selectedCardIds = model.selectedCardIds.filter(item => item !== id);
    else if (model.selectedCardIds.length < limit) model.selectedCardIds.push(id);
}

export function decisionDetails(state, model, decision = model.pendingDecision) {
    if (!decision) return null;
    if (decision.kind === 'assassinate' || decision.kind === 'rob') {
        const role = roleMeta(decision.value);
        return { eyebrow: decision.kind === 'assassinate' ? '刺客密令' : '盗贼目标', title: `${role.rank} · ${role.name}`, copy: decision.kind === 'assassinate' ? '目标角色被呼叫时将本轮缺席；玩家身份现在不会揭示。' : '该角色亮明时，盗贼自动取走其持有者的全部金币。', danger: true };
    }
    if (decision.kind === 'magicianExchange') {
        const target = playerById(state, decision.value);
        const me = playerById(state, state.myId);
        return { eyebrow: '魔术师换手', title: `与 ${target?.name || '目标玩家'} 交换全部手牌`, copy: `你将交出 ${state.myHand?.length || 0} 张，并获得对方的 ${target?.handCount ?? '全部'} 张手牌。牌面不会向其他玩家公开。`, danger: false, me };
    }
    if (decision.kind === 'destroyDistrict') {
        const target = (state.destroyTargets || []).find(item => `${item.targetId}::${item.card?.id}` === decision.value);
        if (!target) return null;
        return { eyebrow: '军阀摧城令', title: `${target.targetName} · ${target.card.name}`, copy: `支付 ${target.cost} 金${target.greatWall ? '（已计入长城额外费用）' : ''}，执行后余额 ${(playerById(state, state.myId)?.gold || 0) - target.cost} 金。`, danger: true };
    }
    if (decision.kind === 'laboratory') {
        const card = (state.myHand || []).find(item => item.id === decision.value);
        if (!card) return null;
        return { eyebrow: '实验室弃牌', title: card.name, copy: '这张手牌将公开弃置，你获得 1 枚金币。', danger: false };
    }
    return null;
}
