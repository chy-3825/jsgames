import { ACTION_LABELS, COLORS, COLOR_LABELS, COLOR_SIZE, COUNTER_REACTION_MS, RESPONSE_REACTION_MS } from './constants.js';

export function createMonopolyDealModel() {
    return {
        state: null, selected: null, hoveredCardIndex: null, targetId: null, targetColor: null, targetGroupId: null, targetPropertyId: null,
        ownColor: null, ownGroupId: null, ownPropertyId: null, paymentIds: [], moveCardId: null, moveFromColor: null,
        discardIds: [], moveFromGroupId: null, moveToColor: null, moveToGroupId: null, choiceMode: null, archiveKind: null, animateInteractionId: null,
        decisionKey: null, decisionReadyAt: 0, decisionTimer: 0, actionLayoutFrame: 0, activeTransfer: null,
        transferTimer: 0, highlightedGroups: new Set(), groupHighlightTimer: 0, submissionPending: false,
        collectedPlayKeys: new Set(), assetAnimationQueue: [], assetAnimationPlaying: false, turnToastTimer: 0,
        scenePlaying: false, sceneQueue: [], activeScene: null, victoryTimer: 0,
        // Server-authoritative presentation state. Event IDs make replaying a
        // reconnect snapshot harmless while deadlines keep all clients in sync.
        presentationQueue: [], presentationPlaying: false, presentationToken: 0,
        presentationEventIds: new Set(), presentationWaiters: new Set(), presentationLockedUntil: 0,
        presentationEvent: null, lastPresentationSequence: 0, waitTimer: null, releaseWait: null,
    };
}

export function me(state) { return state?.players?.find(player => player.id === state.myId); }
export function selectedCard(state, model) { return model.selected === null ? null : state?.myHand?.[model.selected] || null; }
export function sizeFor(state, color) { return state?.rules?.colorSize?.[color] || COLOR_SIZE[color] || 2; }
export function completeGroup(state, cards, color) { return (cards || []).length >= sizeFor(state, color) && (cards || []).some(card => card.kind === 'property'); }
export function rentEstimateLegacy(state, color, player) { const cards = player?.properties?.[color] || []; if (!cards.length || (cards.length === 1 && cards[0].allColor)) return 0; const table = state?.rules?.rentTable?.[color] || []; const base = table[Math.min(cards.length, table.length) - 1] || 0; const bonus = ['railroad', 'utility'].includes(color) ? 0 : (player?.houses?.[color] || 0) * 3 + (player?.hotels?.[color] || 0) * 4; return base + bonus; }
export function playerGroups(state, player, color = null) {
    if (!player) return [];
    const groups = Array.isArray(player.propertyGroups) ? player.propertyGroups : Object.entries(player.properties || {}).filter(([, cards]) => cards.length).map(([groupColor, cards]) => ({ id: `${player.id}:${groupColor}:legacy`, color: groupColor, cards, isComplete: completeGroup(state, cards, groupColor), rent: rentEstimateLegacy(state, groupColor, player), house: null, hotel: null }));
    return color ? groups.filter(group => group.color === color) : groups;
}
export function groupNumber(state, player, group) { return playerGroups(state, player, group.color).findIndex(item => item.id === group.id) + 1; }
export function groupRent(group) { return Number(group?.rent || 0); }
export function playerGroupsFromState(state, player) { if (!player) return []; if (Array.isArray(player.propertyGroups)) return player.propertyGroups; return Object.entries(player.properties || {}).filter(([, cards]) => cards.length).map(([color, cards]) => ({ id: `${player.id}:${color}:legacy`, color, cards, isComplete: completeGroup(state, cards, color) })); }
export function completeGroupKeys(state) { const result = new Set(); (state?.players || []).forEach(player => playerGroupsFromState(state, player).forEach(group => { if (group.isComplete) result.add(`${player.id}:${group.id}`); })); return result; }
export function transferKey(value) { const interaction = value?.interaction; if (!interaction?.transfer) return ''; return `${interaction.interactionId}:${interaction.results?.length || 0}:${interaction.payments?.length || 0}:${interaction.transfer.kind}:${(interaction.transfer.cardIds || []).join(',')}`; }
export function currentDecisionKey(value) { const pending = value?.pendingAction; if (!pending || pending.responsePlayerId !== value.myId) return null; return `${value.interaction?.interactionId || 0}:${pending.targetId}:${pending.responsePlayerId}:${pending.noCount || 0}`; }
export function victorySource(next) { const interaction = next.interaction; if (interaction?.type === 'dealBreaker') return '通过物业接管夺得第三组完整地产'; if (interaction?.type === 'forcedDeal') return '通过强制交易完成第三组地产'; if (interaction?.type === 'slyDeal') return '通过盗取完成第三组地产'; if (interaction?.transfer?.kind === 'payment') return '从资产支付中取得第三组地产'; return '放下第三组完整地产'; }
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
export function actionName(type) { return type === 'rent' ? '租金' : (ACTION_LABELS[type] || '行动'); }
export function actionHint(card) { if (card.kind === 'money') return '现金牌可以直接放入银行。'; if (card.kind === 'property') return '地产牌放入对应颜色，凑齐三组即可获胜。'; if (card.kind === 'property_wild') return '选择牌面允许的颜色放置；十色万能牌单独不能收租。'; if (card.kind === 'rent') return card.colors?.length ? '选择牌面的一种颜色，按对应地产组租金向所有其他玩家收费。' : '选择任意一组地产，指定一名玩家支付当前租金。'; if (card.action === 'dealBreaker') return '接管对手一整组完整地产，房子和酒店一并转移。'; if (card.action === 'slyDeal') return '从对手未成套地产中盗取一张，不能选择完整地产组。'; if (card.action === 'forcedDeal') return '选择双方各一张未成套地产并进行交换。'; if (card.action === 'debtCollector') return '指定一名玩家支付 5M，可用银行资金或地产支付。'; if (card.action === 'birthday') return '所有其他玩家各向您支付 2M。'; if (card.action === 'passGo') return '从摸牌堆摸取两张牌。'; if (card.action === 'doubleRent') return '必须紧接租金牌使用；可连续使用两张，使租金变为四倍。'; if (card.action === 'house') return '放在完整彩色地产组上，使租金增加 3M；每组最多一栋，铁路和公用事业不能建设。'; if (card.action === 'hotel') return '放在已有房子的完整彩色地产组上，使租金再增加 4M；每组最多一座，铁路和公用事业不能建设。'; return '取消针对您的行动；也可以反制另一张“做出反对”。'; }
export function targetPlayers(state) { return (state.players || []).filter(player => player.id !== state.myId && player.isOnline !== false); }
export function needsPlayerTarget(card) { return Boolean(card && (card.kind === 'rent' && !(Array.isArray(card.colors) && card.colors.length) || ['dealBreaker', 'debtCollector', 'slyDeal', 'forcedDeal'].includes(card?.action))); }
export function targetCompleteGroups(state, model) { const target = state.players.find(player => player.id === model.targetId); return playerGroups(state, target).filter(group => group.isComplete ?? completeGroup(state, group.cards, group.color)); }
export function groupProperties(state, player) { return playerGroups(state, player).filter(group => !(group.isComplete ?? completeGroup(state, group.cards, group.color))).flatMap(group => group.cards.map(card => ({ ...card, color: group.color, groupId: group.id, groupNumber: groupNumber(state, player, group) }))); }
export function targetProperties(state, model) { return groupProperties(state, state.players.find(player => player.id === model.targetId)); }
export function ownProperties(state) { return groupProperties(state, me(state)); }
export function buildableGroups(state, card) { return playerGroups(state, me(state)).filter(group => !['railroad', 'utility'].includes(group.color) && (group.isComplete ?? completeGroup(state, group.cards, group.color)) && (card.action === 'house' ? !group.house : Boolean(group.house) && !group.hotel)); }
export function rentGroups(state, card) { const allowed = Array.isArray(card.colors) && card.colors.length ? card.colors : COLORS; return playerGroups(state, me(state)).filter(group => allowed.includes(group.color) && groupRent(group) > 0); }
export function findMyProperty(state, id, color) { return playerGroups(state, me(state), color).flatMap(group => group.cards).find(card => card.id === id); }
export function updateDecisionWindow(model, previous, next, render) {
    const nextKey = currentDecisionKey(next);
    if (!nextKey) { model.decisionKey = null; model.decisionReadyAt = 0; clearTimeout(model.decisionTimer); return; }
    if (nextKey === model.decisionKey) return;
    model.decisionKey = nextKey; const delay = next.pendingAction?.noCount ? COUNTER_REACTION_MS : RESPONSE_REACTION_MS;
    const unlockDelay = delay;
    model.decisionReadyAt = previous ? Date.now() + unlockDelay : 0; clearTimeout(model.decisionTimer);
    if (model.decisionReadyAt) model.decisionTimer = setTimeout(() => { if (currentDecisionKey(model.state) === model.decisionKey) render(); }, unlockDelay + 20);
}
export function decisionReady(model, state) {
    const lockedUntil = Number(model.presentationLockedUntil || 0);
    return (!currentDecisionKey(state) || Date.now() >= model.decisionReadyAt)
        && Date.now() >= lockedUntil;
}
export function updateTransferPresentation(model, previous, next, windowRef, renderEvent, schedule) {
    const nextKey = transferKey(next); if (!nextKey || nextKey === transferKey(previous)) return;
    model.activeTransfer = { ...next.interaction.transfer, key: nextKey }; clearTimeout(model.transferTimer);
    model.transferTimer = windowRef.setTimeout(() => { model.activeTransfer = null; schedule(); if (model.state) renderEvent(); }, windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 550 : 1050);
}
export function updateGroupHighlights(model, previous, next, windowRef, render) {
    if (!previous) return; const before = completeGroupKeys(previous); const after = completeGroupKeys(next); const newlyCompleted = [...after].filter(key => !before.has(key)); if (!newlyCompleted.length) return;
    model.highlightedGroups = new Set(newlyCompleted); clearTimeout(model.groupHighlightTimer); const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    model.groupHighlightTimer = windowRef.setTimeout(() => { model.highlightedGroups.clear(); if (model.state) render(); }, reduced ? 700 : 1500);
}
