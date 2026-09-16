import { propertyFaceMarkup } from './property-original.js';
import { ACTION_LABELS, COLORS, COLOR_HEX, COLOR_LABELS } from './constants.js';
import { cardLabel, handCardMarkup, moneyFaceMarkup, escapeHtml, publicCardMarkup } from './cards.js';
import { actionHint, actionName, buildableGroups, completeGroup, decisionReady, findMyProperty, groupNumber, groupProperties, groupRent, me, needsPlayerTarget, ownProperties, playerGroups, rentGroups, selectedCard, sizeFor, targetCompleteGroups, targetPlayers, targetProperties } from './state.js';

/** Dynamic table, command and public interaction rendering for 大富翁纸牌. */
export function createMonopolyDealRenderer({ mount, model, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    let opponentsEl; let selfSeatEl; let handEl; let commandEl; let commandTitleEl; let commandHintEl; let turnEl; let phaseEl; let eventEl; let historyEl; let historyCardEl; let removedCardsEl;

    function bindElements() { opponentsEl = $('opponents'); selfSeatEl = $('selfSeat'); handEl = $('hand'); commandEl = $('command'); commandTitleEl = $('commandTitle'); commandHintEl = $('commandHint'); turnEl = $('turn'); phaseEl = $('phase'); eventEl = $('event'); historyEl = $('history'); historyCardEl = $('historyCard'); removedCardsEl = $('removedCards'); }
    bindElements();

    function playerName(id, fallback = '') { if (String(id) === String(state()?.myId)) return '您'; return (state()?.players || []).find(player => String(player.id) === String(id))?.name || fallback || '玩家'; }
    function viewerMessage(message) {
        const value = state();
        const own = me(value)?.name;
        if (!own) return String(message || '');
        const others = (value?.players || []).filter(player => player.id !== value.myId && player.name).sort((left, right) => right.name.length - left.name.length);
        let text = String(message || '');
        others.forEach((player, index) => { text = text.split(player.name).join(`\u0000${index}\u0000`); });
        text = text.split(own).join('您');
        others.forEach((player, index) => { text = text.split(`\u0000${index}\u0000`).join(player.name); });
        return text;
    }
    function propertyName(cardId) {
        if (!cardId) return '';
        for (const player of state()?.players || []) {
            const card = playerGroups(state(), player).flatMap(group => group.cards || []).find(item => item.id === cardId);
            if (card?.name) return card.name;
        }
        return '';
    }
    function phaseText() { const value = state(); if (value.status === 'ended') return '游戏结束'; if (value.pendingDebt?.payerId === value.myId) return '支付资产'; if (value.pendingAction?.responsePlayerId === value.myId) return '回应行动'; if (value.phase === 'draw') return '请先摸牌'; if (value.phase === 'discard') return '弃到 7 张'; return value.myIsCurrentTurn ? '行动阶段' : '等待对手'; }
    function renderIdleEvent() {
        const value = state();
        let title = '等待对方行动';
        let detail = playerName(value.currentTurn, value.currentTurnName || '下一位玩家');
        if (value.status === 'ended') {
            title = `${playerName(value.winner?.id, value.winner?.name || '本局玩家')}获胜`;
            detail = '牌局结束';
        } else if (value.myIsCurrentTurn) {
            if (value.availableActions?.canDiscard) {
                title = '请选择要弃掉的手牌';
                detail = `需弃 ${Math.max(0, (value.myHand?.length || 0) - 7)} 张 · 已选 ${(model.discardIds || []).length} 张`;
            } else if (value.phase === 'draw') {
                title = '请先摸牌';
                detail = '点击左侧牌库';
            } else if (value.cardsPlayed >= 3) {
                title = '本回合出牌已完成';
                detail = '点击“结束回合”';
            } else if (!value.myHand?.length) {
                title = '手牌已用完';
                detail = '点击“结束回合”';
            } else {
                title = '请选择一张手牌';
                detail = '';
            }
        }
        return `<div class="deal-event-idle"><div><strong>${escapeHtml(title)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</div></div>`;
    }
    function cardDescription(card) {
        if (card.kind === 'rent') return card.colors?.length
            ? '选择牌面的一种颜色，按您对应地产组的当前租金向所有其他玩家收费。'
            : '选择您拥有的任意一组地产，并指定一名玩家支付该组当前租金。';
        if (card.kind !== 'action') return '';
        return {
            passGo: '从牌库摸两张牌。',
            birthday: '所有其他玩家各向您支付 2M。',
            debtCollector: '选择一名玩家，向其收取 5M；对方可以用银行资金或地产支付。',
            slyDeal: '从一名玩家的未成套地产中盗取一张；不能选择完整地产组。',
            forcedDeal: '选择您和另一名玩家各一张未成套地产，并交换这两张牌。',
            dealBreaker: '接管其他玩家的一整组完整地产，包括该组的房子和酒店。',
            justSayNo: '取消当前针对您的行动；也可以反制另一张“做出反对”，使原行动重新生效。',
            doubleRent: '必须紧接租金牌使用，两张牌均计入本回合出牌次数；可连续使用两张，使租金变为四倍。',
            house: '放在一组完整地产上，使该组租金增加 3M。每组最多一栋房子；铁路和公用事业不能放置。',
            hotel: '放在已有房子的一组完整地产上，使该组租金再增加 4M。每组最多一座酒店；铁路和公用事业不能放置。',
        }[card.action] || '';
    }
    function cardCopy(card, className, status = '', descriptionOverride = null) {
        const name = card.kind === 'money' ? `${card.value || 0}M 货币牌` : card.name || cardLabel(card);
        const description = descriptionOverride === null ? cardDescription(card) : descriptionOverride;
        return `<aside class="${className}"><strong>${escapeHtml(name)}</strong>${description ? `<p>${escapeHtml(description)}</p>` : ''}${status ? `<small>${escapeHtml(status)}</small>` : ''}</aside>`;
    }
    function renderCardPreview(card, locked) { return `<div class="deal-card-preview ${locked ? 'is-locked' : 'is-hover'}"><div class="deal-preview-label">准备出牌</div><div class="deal-preview-card-shell">${publicCardMarkup(card, 'deal-preview-card')}</div>${cardCopy(card, 'deal-preview-copy')}</div>`; }
    function renderRecentPlay(play) { const card = play?.card; if (!card) return renderIdleEvent(); let description = null; const actor = playerName(play.playerId, play.playerName); if (play.zone === 'bank') description = `${actor}将这张牌作为${card.value || 0}M货币存入银行。`; else if (['house', 'hotel'].includes(play.action) && play.color) description = `${actor}在${COLOR_LABELS[play.color] || play.color}完整地产组放置${card.name}。`; return `<div class="deal-card-preview deal-recent-play"><div class="deal-preview-label">最近出牌</div><div class="deal-preview-card-shell">${publicCardMarkup(card, 'deal-preview-card')}</div>${cardCopy(card, 'deal-preview-copy', '', description)}</div>`; }

    function interactionCopy(interaction) {
        const actor = playerName(interaction.actorId, interaction.actorName);
        const target = playerName(interaction.currentTargetId, interaction.currentTargetName);
        const targets = (interaction.targetIds || []).map((id, index) => playerName(id, interaction.targetNames?.[index])).filter(Boolean);
        const cardName = interaction.card?.name || actionName(interaction.type);
        const amount = Number(interaction.amount) || 0;
        const amountText = amount ? `${amount}M` : '';
        const color = COLOR_LABELS[interaction.color] || interaction.color || '';
        const allTargets = targets.length > 1 ? '所有其他玩家' : target;
        let detail = `${actor}使用${cardName}。`;

        if (interaction.type === 'rent') detail = `${actor}按${color || '所选'}地产组的当前租金，向${allTargets}收取${amountText}。`;
        if (interaction.type === 'debtCollector') detail = `${actor}向${target}收取${amountText}债务。`;
        if (interaction.type === 'birthday') detail = `${actor}发起“我的生日”，所有其他玩家各支付${amountText}。`;
        if (interaction.type === 'dealBreaker') detail = `${actor}准备接管${target}的${color || '一组'}完整地产，房子和酒店将一并转移。`;
        if (interaction.type === 'slyDeal') detail = `${actor}准备从${target}处盗取${propertyName(interaction.targetPropertyId) || '一张未成套地产'}。`;
        if (interaction.type === 'forcedDeal') detail = `${actor}准备用${propertyName(interaction.ownPropertyId) || '一张未成套地产'}交换${target}的${propertyName(interaction.targetPropertyId) || '一张未成套地产'}。`;

        if (interaction.stage === 'response') return { label: '等待回应', title: cardName, detail, status: `等待${target}接受行动或使用“做出反对”` };
        if (interaction.stage === 'no_response') {
            const lastNo = interaction.noChain?.at(-1);
            const responder = playerName(interaction.responsePlayerId, interaction.responsePlayerName);
            const lastPlayer = playerName(lastNo?.playerId, lastNo?.playerName);
            const actionLives = (Number(interaction.noCount) || 0) % 2 === 0;
            return { label: '等待反制', title: cardName, detail: `${lastPlayer}打出“做出反对”，${cardName}${actionLives ? '重新生效' : '暂时取消'}。`, status: `等待${responder}决定是否继续反制` };
        }
        if (interaction.stage === 'payment') return { label: '资产支付', title: cardName, detail: `${target}需向${actor}支付${amountText}，可以选择银行资金或地产；超额部分不找零，资产不足时交出全部资产。`, status: target === '您' ? '请您选择用于支付的资产' : `等待${target}选择支付资产` };
        if (interaction.outcome === 'win') return { label: '三组完成', title: cardName, detail: `${playerName(interaction.winnerId)}通过${cardName}完成了第三组不同颜色的完整地产。`, status: '游戏进入最终结算' };
        if (interaction.outcome === 'armed') return { label: '等待租金牌', title: cardName, detail: `${actor}已使用${interaction.doubleRentCount || 1}张“双倍租金”，下一张租金变为${interaction.rentMultiplier || 2}倍。`, status: '必须紧接打出租金牌' };
        if (interaction.outcome === 'draw') return { label: '行动完成', title: cardName, detail: `${actor}从摸牌堆摸取了${Number(interaction.amount) || 2}张牌。`, status: '' };

        const cancelled = (interaction.results || []).length && interaction.results.every(result => ['cancelled', 'skipped'].includes(result.outcome));
        const paid = (interaction.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const noAssets = (interaction.results || []).filter(result => result.outcome === 'no_assets').length;
        if (cancelled) return { label: '行动取消', title: cardName, detail: `${cardName}未能生效。`, status: '' };
        if (interaction.type === 'rent') detail = `${actor}完成收租${paid ? `，共收到${paid}M资产` : ''}${noAssets ? `；${noAssets}名玩家没有可支付资产` : ''}。`;
        else if (interaction.type === 'debtCollector') detail = noAssets ? `${target}没有可用于支付债务的资产。` : `${target}已向${actor}支付债务${paid ? `，实际支付${paid}M资产` : ''}。`;
        else if (interaction.type === 'birthday') detail = `其他玩家已依次完成生日支付${paid ? `，${actor}共收到${paid}M资产` : ''}${noAssets ? `；${noAssets}名玩家没有可支付资产` : ''}。`;
        else if (interaction.type === 'dealBreaker') detail = `${actor}已接管${target}的${color || ''}完整地产组，组内地产和建筑一并转移。`;
        else if (interaction.type === 'slyDeal') detail = `${actor}已从${target}处获得${propertyName(interaction.transfer?.cardIds?.[0]) || '一张未成套地产'}。`;
        else if (interaction.type === 'forcedDeal') { const received = propertyName(interaction.transfer?.cardIds?.[0]); const given = propertyName(interaction.transfer?.cardIds?.[1]); detail = `${actor}与${target}已经交换${received && given ? `${received}和${given}` : '选择的两张地产'}。`; }
        else if (interaction.type === 'house' || interaction.type === 'hotel') detail = `${actor}已在${color || '所选'}完整地产组放置${cardName}。`;
        return { label: '行动完成', title: cardName, detail, status: '' };
    }

    function renderPublicInteraction(interaction) {
        const copy = interactionCopy(interaction);
        // While arming rent, the current Double the Rent is already rendered as
        // the main card. Only earlier doublers belong in the support stack;
        // otherwise the same physical card appears twice and the stack jumps
        // when the following rent card replaces it.
        const currentIsDoubleRent = interaction.card?.action === 'doubleRent';
        const supportDoubleRentCount = Math.max(0, Math.min(2, Number(interaction.doubleRentCount) || 0) - (currentIsDoubleRent ? 1 : 0));
        const doubleCards = Array.from({ length: supportDoubleRentCount }, (_, index) => publicCardMarkup({ kind: 'action', action: 'doubleRent', name: '双倍租金', value: 1 }, `deal-support-card is-support-${index + 1}`)).join('');
        const noCards = (interaction.noChain || []).map((entry, index) => publicCardMarkup({ kind: 'action', action: 'justSayNo', name: '做出反对', value: 4 }, 'deal-no-card', `--no-index:${index}`)).join('');
        const transfer = model.activeTransfer ? `<em class="deal-transfer-badge">${model.activeTransfer.kind === 'payment' ? `${model.activeTransfer.amount || 0}M 资产转移` : model.activeTransfer.kind === 'swap' ? '地产互换中' : '地产转移中'}</em>` : '';
        return `<div class="deal-public-interaction" data-interaction-id="${Number(interaction.interactionId) || 0}"><div class="deal-preview-label">最近出牌</div><div class="deal-public-card-stack" data-role="publicCardStack">${doubleCards}${publicCardMarkup(interaction.card, 'deal-main-public-card', '', 'publicCard')}${noCards}${transfer}</div><aside class="deal-public-copy"><span>${escapeHtml(copy.label)}</span><strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(copy.detail)}</p>${copy.status ? `<small>${escapeHtml(copy.status)}</small>` : ''}</aside></div>`;
    }

    function renderEvent() { const value = state(); if (!value || !eventEl) return; if (value.availableActions?.canDiscard || value.lastPlayedCard?.zone === 'discard') {
            const selecting = value.availableActions?.canDiscard;
            const cards = selecting ? (value.myHand || []).filter(card => (model.discardIds || []).includes(card.id)) : value.lastPlayedCard.cards || [];
            eventEl.classList.remove('is-card-preview', 'is-hover-preview', 'is-selection-preview');
            eventEl.classList.add('is-public-stage');
            eventEl.innerHTML = selecting && !cards.length ? renderIdleEvent() : `<div class="deal-discard-stage" aria-label="弃牌"><div class="deal-discard-cards">${cards.map(card => publicCardMarkup(card, 'deal-discard-card')).join('')}</div></div>`;
            return;
        } const previewIndex = model.selected ?? model.hoveredCardIndex; const preview = previewIndex === null ? null : value.myHand?.[previewIndex]; const canPreview = Boolean(preview && value.myIsCurrentTurn && value.status !== 'ended' && !value.pendingAction && !value.pendingDebt); const interaction = value.interaction; const recentPlay = value.lastPlayedCard?.zone === 'discard' ? null : value.lastPlayedCard; const hasTableCard = Boolean(interaction?.card || recentPlay?.card); eventEl.classList.toggle('is-public-stage', Boolean(hasTableCard && !canPreview)); eventEl.classList.toggle('is-card-preview', canPreview); eventEl.classList.toggle('is-hover-preview', canPreview && model.selected === null); eventEl.classList.toggle('is-selection-preview', canPreview && model.selected !== null); if (canPreview) { eventEl.innerHTML = renderCardPreview(preview, model.selected !== null); return; } eventEl.innerHTML = interaction?.card ? renderPublicInteraction(interaction) : recentPlay?.card ? renderRecentPlay(recentPlay) : renderIdleEvent(); }
    function refreshEvent() { renderEvent(); }
    function propertyStrokes(value, player) {
        const groups = playerGroups(value, player);
        const colors = COLORS.filter(color => groups.some(group => group.color === color && group.cards?.length));
        const markup = colors.map(color => {
            const colorGroups = groups.filter(group => group.color === color);
            const count = Math.max(...colorGroups.map(group => group.cards?.length || 0), 0);
            const size = sizeFor(value, color);
            const complete = colorGroups.some(group => group.isComplete ?? completeGroup(value, group.cards, color));
            const highlighted = colorGroups.some(group => model.highlightedGroups.has(`${player.id}:${group.id}`));
            const hasHouse = colorGroups.some(group => group.house);
            const hasHotel = colorGroups.some(group => group.hotel);
            const label = `${COLOR_LABELS[color] || color} ${count}/${size}`;
            return `<i role="listitem" aria-label="${escapeHtml(label)}" class="deal-property-stroke deal-property-slot color-${escapeHtml(color)} ${complete ? 'is-complete' : ''} ${hasHouse ? 'has-house' : ''} ${hasHotel ? 'has-hotel' : ''} ${highlighted ? 'is-newly-complete' : ''}" style="--property-color:${COLOR_HEX[color] || '#99866e'}" title="${escapeHtml(label)}"><em class="deal-property-slot-fill" aria-hidden="true" style="width:${Math.min(1, count / size) * 100}%"></em></i>`;
        }).join('');
        return { markup, count: colors.length };
    }
    function seatContent(player, propertySummary, self = false) {
        const name = escapeHtml(self ? (player.name || player.id || '玩家') : playerName(player.id, player.name || '玩家'));
        const completed = Number(player.completedSets) || 0;
        const progressLevel = Math.max(0, Math.min(3, completed));
        const bankValue = Number(player.bankValue) || 0;
        const groups = propertySummary?.markup || '';
        const colorCount = propertySummary?.count || 0;
        return `<header class="deal-seat-identity"><span class="deal-seat-name"><strong>${name}</strong></span></header><span class="deal-seat-progress is-progress-${progressLevel}" aria-label="已完成 ${completed} / 3 组"><b>${completed}/3</b></span><div class="deal-seat-assets" data-action="openAssets" role="button" tabindex="0" aria-label="查看${name}的公开资产"><span class="deal-seat-bank" data-asset-bank aria-label="银行 ${bankValue}M"><b>${bankValue}M</b></span><span class="deal-seat-properties ${groups ? '' : 'is-empty'} ${colorCount > 8 ? 'is-crowded' : ''}" data-color-count="${colorCount}" data-asset-properties role="list" aria-label="${groups ? '地产组' : '暂无地产'}">${groups || '<em>暂无地产</em>'}</span></div>`;
    }
    function renderOpponent(player) { const value = state(); const card = selectedCard(value, model); const targetable = needsPlayerTarget(card) && (card?.kind !== 'rent' || Boolean(model.targetGroupId)); const interaction = value.interaction; const groups = propertyStrokes(value, player); const tag = targetable ? 'button' : 'div'; return `<article class="deal-opponent ${player.isCurrentTurn ? 'is-current' : ''} ${model.targetId === player.id ? 'is-targeted' : ''} ${targetable ? 'is-selectable' : ''} ${player.isOnline === false ? 'is-offline' : ''} ${interaction?.actorId === player.id ? 'is-action-source' : ''} ${interaction?.currentTargetId === player.id ? 'is-action-target' : ''} ${interaction?.responsePlayerId === player.id ? 'is-response-seat' : ''}" data-player-id="${escapeHtml(player.id)}"><${tag} ${targetable ? 'type="button"' : ''} class="deal-seat-main deal-seat-layout" ${targetable ? `data-target-id="${escapeHtml(player.id)}" aria-label="选择${escapeHtml(player.name)}" aria-pressed="${model.targetId === player.id}"` : ''}>${seatContent(player, groups)}</${tag}></article>`; }
    function renderSelfSeat(player) { const value = state(); if (!player) return '<div class="deal-self-seat-empty">等待您的玩家数据</div>'; const interaction = value.interaction; const groups = propertyStrokes(value, player); const selfTarget = interaction?.currentTargetId === player.id; const selfSource = interaction?.actorId === player.id; const selfResponse = interaction?.responsePlayerId === player.id; return `<div class="deal-self-seat-card ${player.isCurrentTurn ? 'is-current' : ''} ${selfTarget ? 'is-action-target' : ''} ${selfSource ? 'is-action-source' : ''} ${selfResponse ? 'is-response-seat' : ''}" data-player-id="${escapeHtml(player.id)}"><div class="deal-self-seat-main deal-seat-layout">${seatContent(player, groups, true)}</div></div>`; }
    function renderCard(card, index) { const name = card.name || cardLabel(card); const description = actionHint(card); const selected = state().availableActions?.canDiscard ? (model.discardIds || []).includes(card.id) : model.selected === index; const accessibleLabel = `${name}，${description}`; return `<button type="button" class="deal-card deal-hand-card-face card-${escapeHtml(card.kind)} ${card.action ? `action-${escapeHtml(card.action)}` : ''} ${selected ? 'is-selected' : ''}" data-card-index="${index}" aria-pressed="${selected}" aria-label="${escapeHtml(accessibleLabel)}" title="${escapeHtml(`${name}：${description}`)}">${handCardMarkup(card)}</button>`; }


    function bankButton(card) { return `<button class="deal-secondary" data-action="playBank" type="button">存入银行 <span>+${card.value || 0}M</span></button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`; }
    function renderPaymentCommand() {
        commandEl.innerHTML = '<button class="deal-primary" data-action="openPayment" type="button">选择支付资产</button>';
    }
    function paymentAssetMarkup(value) {
        const options = value.myPaymentOptions || [];
        const selected = options.filter(item => model.paymentIds.includes(item.id));
        const total = options.reduce((sum, item) => sum + item.value, 0);
        const amount = selected.reduce((sum, item) => sum + item.value, 0);
        const canPay = amount >= value.pendingDebt.amount || amount >= total;
        const bank = MONEY_DENOMINATIONS.map(denomination => {
            const items = options.filter(item => item.zone === 'bank' && item.value === denomination);
            if (!items.length) return '';
            const count = items.filter(item => model.paymentIds.includes(item.id)).length;
            return `<div class="deal-payment-denomination"><button type="button" data-payment-value="${denomination}" ${count === items.length ? 'disabled' : ''} aria-label="选择一张 ${denomination}M">${moneyFaceMarkup(denomination)}<span>已选 ${count} / ${items.length} 张</span></button><button class="deal-secondary" type="button" data-payment-remove="${denomination}" ${count ? '' : 'disabled'}>减一张</button></div>`;
        }).join('');
        const owner = me(value);
        const properties = playerGroups(value, owner).flatMap(group => group.cards).filter(card => options.some(item => item.zone !== 'bank' && item.id === card.id)).map(card => `<button type="button" class="deal-card deal-payment-property ${model.paymentIds.includes(card.id) ? 'is-selected' : ''}" data-payment-id="${escapeHtml(card.id)}" aria-pressed="${model.paymentIds.includes(card.id)}" aria-label="选择${escapeHtml(card.name)}">${propertyFaceMarkup(card)}</button>`).join('');
        return `<section><h3>银行 · 点一次选一张</h3><div class="deal-money-grid">${bank || '没有银行资产'}</div></section><section><h3>地产 · 点击选择或取消</h3><div class="deal-payment-properties">${properties || '没有可支付地产'}</div></section><div class="deal-asset-pick-controls"><span>应付 ${value.pendingDebt.amount}M · 已选 ${amount}M${amount > value.pendingDebt.amount ? '（不找零）' : ''}${total < value.pendingDebt.amount ? ' · 资产不足需交出全部可支付资产' : ''}</span><button class="deal-primary" data-action="payDebt" type="button" ${canPay ? '' : 'disabled'}>确认支付</button></div>`;
    }
    function renderResponseCommand() { const value = state(); const pending = value.pendingAction; const counteringNo = (pending.noCount || 0) % 2 === 1 && pending.actorId === value.myId; const ready = decisionReady(model, value); commandTitleEl.textContent = counteringNo ? '对方做出了反对' : `回应${actionName(pending.type)}`; commandHintEl.textContent = ready ? (counteringNo ? `${playerName(pending.targetId, pending.targetName)}正在取消您的行动。` : `${playerName(pending.actorId, pending.actorName)}的行动等待您回应。`) : '先查看中央的行动牌和反制关系。'; const noCards = (value.myHand || []).map((item, index) => item.action === 'justSayNo' ? `<button class="deal-secondary" data-action="justSayNo" data-card-index="${index}" type="button" ${ready ? '' : 'disabled'}>打出“做出反对”</button>` : '').join(''); commandEl.innerHTML = `${ready ? '' : '<span class="deal-reaction-wait">行动送达中</span>'}<div class="deal-response-card"><strong>${escapeHtml(actionName(pending.type))}</strong><span>${pending.amount ? `${pending.amount}M` : '地产行动'}${pending.color ? ` · ${COLOR_LABELS[pending.color]}` : ''}</span></div><button class="deal-primary" data-action="acceptAction" type="button" ${ready ? '' : 'disabled'}>${counteringNo ? '不反制，取消本次' : '接受行动'}</button>${noCards || '<span class="deal-command-note">您的手牌中没有“做出反对”</span>'}`; }
    function renderMoveCommand() { const value = state(); const moving = findMyProperty(value, model.moveCardId, model.moveFromColor); commandTitleEl.textContent = '调整地产分组'; commandHintEl.textContent = moving ? `${moving.name} 可在自己的回合移到另一合法地产组。` : '请选择要调整的地产。'; commandEl.innerHTML = `<div class="deal-command-note">当前：${escapeHtml(COLOR_LABELS[model.moveFromColor] || model.moveFromColor)}第 ${groupNumber(value, me(value), playerGroups(value, me(value)).find(group => group.id === model.moveFromGroupId) || { color: model.moveFromColor })} 组${model.moveToColor ? `　→　${escapeHtml(COLOR_LABELS[model.moveToColor] || model.moveToColor)}` : ''}</div><button class="deal-primary" data-action="openMoveChoice" type="button">选择目标地产组</button><button class="deal-secondary" data-action="clearSelection" type="button">取消调整</button>`; }
    function renderPropertyCommand(card) { commandEl.innerHTML = `<div class="deal-command-note">${model.targetColor && model.targetGroupId ? `已选 ${escapeHtml(COLOR_LABELS[model.targetColor] || model.targetColor)}${model.targetGroupId === 'new' ? '新地产组' : '现有地产组'}` : '选择颜色及具体地产组；完整组不会再接收多余地产。'}</div><button class="deal-primary" data-action="openPropertyChoice" type="button">选择地产组并放置</button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`; }
    function renderRentCommand(card) { const value = state(); const groups = rentGroups(value, card); const chargeAll = Array.isArray(card.colors) && card.colors.length > 0; const selectedGroup = groups.find(group => group.id === model.targetGroupId); const target = value.players.find(player => player.id === model.targetId); const summary = !groups.length ? '您还没有这张租金牌支持且能产生租金的地产。' : selectedGroup ? `${escapeHtml(COLOR_LABELS[selectedGroup.color] || selectedGroup.color)}第${groupNumber(value, me(value), selectedGroup)}组 · ${groupRent(selectedGroup)}M${chargeAll ? ' · 向所有对手' : target ? ` · 向${escapeHtml(target.name)}` : ' · 请在牌桌上选择一名玩家'}` : '先选择本次收租使用的地产颜色。'; if (!selectedGroup) { commandEl.innerHTML = `<div class="deal-command-note">${summary}</div><button class="deal-primary" data-action="openRentChoice" type="button" ${groups.length ? '' : 'disabled'}>选择收租颜色</button>${bankButton(card)}`; return; } commandEl.innerHTML = `<div class="deal-command-note">${summary}</div>${chargeAll ? '' : `<button class="deal-primary" data-action="playRent" type="button" ${target ? '' : 'disabled'}>确认发起收租</button>`}<button class="deal-secondary" data-action="openRentChoice" type="button">重新选择颜色</button>${bankButton(card)}`; }

    function renderActionCommand(card) {
        if (['slyDeal', 'dealBreaker'].includes(card.action)) {
            const ready = Boolean(model.targetId && model.targetGroupId && (card.action === 'dealBreaker' || model.targetPropertyId));
            commandEl.innerHTML = `<span class="deal-command-note">${ready ? `已选 ${escapeHtml(playerName(model.targetId))}的${card.action === 'dealBreaker' ? '完整地产组' : '地产牌'}` : '点击对手角色框，从资产卡面选择目标。'}</span><button class="deal-primary" data-action="${card.action === 'dealBreaker' ? 'playDealBreaker' : 'playAction'}" type="button" ${ready ? '' : 'disabled'}>出牌</button><button class="deal-secondary" data-action="clearSelection" type="button">取消</button>${bankButton(card)}`;
            return;
        }
 const value = state(); const players = targetPlayers(value); const targetGroups = targetCompleteGroups(value, model); const targetItems = targetProperties(value, model); const ownItems = ownProperties(value); const optionPlayers = players.map(player => `<option value="${escapeHtml(player.id)}" ${model.targetId === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join(''); const groupOptions = targetGroups.map(group => `<option value="${escapeHtml(group.id)}" data-group-color="${escapeHtml(group.color)}" ${model.targetGroupId === group.id ? 'selected' : ''}>${escapeHtml(COLOR_LABELS[group.color] || group.color)} · 第${groupNumber(value, value.players.find(player => player.id === model.targetId), group)}组${group.house || group.hotel ? ' · 含建筑' : ''}</option>`).join(''); const targetPropertyOptions = targetItems.map(item => `<option value="${escapeHtml(item.id)}" ${model.targetPropertyId === item.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(COLOR_LABELS[item.color] || item.color)}第${item.groupNumber}组</option>`).join(''); const ownPropertyOptions = ownItems.map(item => `<option value="${escapeHtml(item.id)}" ${model.ownPropertyId === item.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(COLOR_LABELS[item.color] || item.color)}第${item.groupNumber}组</option>`).join(''); if (card.action === 'dealBreaker') commandEl.innerHTML = `<label class="deal-field">夺取对象<select data-field="targetId"><option value="">请选择玩家</option>${optionPlayers}</select></label><label class="deal-field">完整地产组<select data-field="targetGroupId"><option value="">请选择完整组</option>${groupOptions}</select></label><button class="deal-primary" data-action="playDealBreaker" type="button" ${model.targetId && model.targetGroupId ? '' : 'disabled'}>夺取整组地产</button>${bankButton(card)}`; else if (card.action === 'debtCollector') commandEl.innerHTML = `<label class="deal-field">债务对象<select data-field="targetId"><option value="">请选择玩家</option>${optionPlayers}</select></label><button class="deal-primary" data-action="playAction" type="button" ${model.targetId ? '' : 'disabled'}>收取 5M</button>${bankButton(card)}`; else if (card.action === 'slyDeal') commandEl.innerHTML = `<label class="deal-field">交易对象<select data-field="targetId"><option value="">请选择玩家</option>${optionPlayers}</select></label><label class="deal-field">对手未成组地产<select data-field="targetPropertyId"><option value="">请选择地产</option>${targetPropertyOptions}</select></label><button class="deal-primary" data-action="playAction" type="button" ${model.targetId && model.targetPropertyId ? '' : 'disabled'}>偷取地产</button>${bankButton(card)}`; else if (card.action === 'forcedDeal') commandEl.innerHTML = `<label class="deal-field">交换对象<select data-field="targetId"><option value="">请选择玩家</option>${optionPlayers}</select></label><label class="deal-field">对手未成组地产<select data-field="targetPropertyId"><option value="">请选择地产</option>${targetPropertyOptions}</select></label><label class="deal-field">我的未成组地产<select data-field="ownPropertyId"><option value="">请选择地产</option>${ownPropertyOptions}</select></label><button class="deal-primary" data-action="playAction" type="button" ${model.targetId && model.targetPropertyId && model.ownPropertyId ? '' : 'disabled'}>交换地产</button>${bankButton(card)}`; else if (card.action === 'house' || card.action === 'hotel') { const build = buildableGroups(value, card).map(group => `<option value="${escapeHtml(group.id)}" data-group-color="${escapeHtml(group.color)}" ${model.targetGroupId === group.id ? 'selected' : ''}>${escapeHtml(COLOR_LABELS[group.color] || group.color)} · 第${groupNumber(value, me(value), group)}组${group.house ? ' · 已有房子' : ''}</option>`).join(''); commandEl.innerHTML = `<label class="deal-field">地产组<select data-field="targetGroupId"><option value="">请选择可建设的完整组</option>${build}</select></label><button class="deal-primary" data-action="playAction" type="button" ${model.targetGroupId ? '' : 'disabled'}>放置${escapeHtml(card.name)}</button>${bankButton(card)}`; } else if (['passGo', 'doubleRent', 'birthday'].includes(card.action)) commandEl.innerHTML = `<button class="deal-primary" data-action="playAction" type="button">使用${escapeHtml(card.name)}</button>${bankButton(card)}`; else commandEl.innerHTML = `<span class="deal-command-note">“做出反对”只能在回应行动时使用。</span>${bankButton(card)}`; }

    function renderChoiceOverlay() {
        const value = state(); const card = selectedCard(value, model); let choices = []; let title = ''; let hint = ''; let confirmAction = ''; let confirmText = '';
        if (model.choiceMode === 'property' && ['property', 'property_wild'].includes(card?.kind) && value.availableActions?.canPlay) { const colors = card.kind === 'property' ? [card.color] : card.colors || []; choices = colors.flatMap(color => [...playerGroups(value, me(value), color).filter(group => group.cards.length < sizeFor(value, color)).map(group => ({ color, groupId: group.id, group })), { color, groupId: 'new', group: null }]); title = '选择地产归属颜色'; hint = `${card.name} 放置后归入所选独立地产组；也可以另开同色新组。`; confirmAction = 'confirmPropertyChoice'; confirmText = '确认放置地产'; } else if (model.choiceMode === 'rent' && card?.kind === 'rent' && value.availableActions?.canPlay) { choices = rentGroups(value, card).map(group => ({ color: group.color, groupId: group.id, group })); const chargeAll = Array.isArray(card.colors) && card.colors.length > 0; title = '选择本次收租颜色'; hint = chargeAll ? '所选颜色决定租金数额；确认后向所有对手依次收取。' : '所选颜色决定租金数额；确认后回到牌桌选择一名玩家。'; confirmAction = 'confirmRentChoice'; confirmText = chargeAll ? '确认并向所有人收租' : '确认颜色并选择玩家'; } else if (model.choiceMode === 'move' && model.moveCardId && value.availableActions?.canMoveProperty) { const moving = findMyProperty(value, model.moveCardId, model.moveFromColor); const colors = moving?.kind === 'property' ? [model.moveFromColor] : moving?.colors || []; choices = colors.flatMap(color => [...playerGroups(value, me(value), color).filter(group => group.id !== model.moveFromGroupId && group.cards.length < sizeFor(value, color)).map(group => ({ color, groupId: group.id, group })), { color, groupId: 'new', group: null }]); title = '调整地产所在组'; hint = `${moving?.name || '地产'} 当前属于${COLOR_LABELS[model.moveFromColor] || model.moveFromColor}，调整不计入每回合三次出牌。`; confirmAction = 'confirmMoveChoice'; confirmText = '确认切换颜色'; } else model.choiceMode = null;
        const overlay = $('choiceOverlay'); overlay.classList.toggle('is-hidden', !model.choiceMode); if (!model.choiceMode) return; $('choiceTitle').textContent = title; $('choiceHint').textContent = hint; $('choiceGrid').innerHTML = choices.map(choice => { const isRent = model.choiceMode === 'rent'; const selectedChoice = model.choiceMode === 'move' ? model.moveToColor === choice.color && model.moveToGroupId === choice.groupId : model.targetColor === choice.color && model.targetGroupId === choice.groupId; return `<button type="button" class="deal-choice-card ${selectedChoice ? 'is-selected' : ''}" data-choice-color="${escapeHtml(choice.color)}" data-choice-group-id="${escapeHtml(choice.groupId)}"><i class="color-${escapeHtml(choice.color)}"></i><b>${escapeHtml(COLOR_LABELS[choice.color] || choice.color)}</b><span>${isRent ? `${groupRent(choice.group)}M 租金` : choice.group ? `${choice.group.cards.length} / ${sizeFor(value, choice.color)} 张` : '新地产组'}</span><small>${choice.group ? `第${groupNumber(value, me(value), choice.group)}组` : '另开一组'}</small></button>`; }).join('') || '<div class="deal-choice-empty">当前没有合法的颜色可选</div>'; const selectedGroup = model.choiceMode === 'move' ? model.moveToGroupId : model.targetGroupId; const canConfirm = Boolean(selectedGroup); $('choiceActions').innerHTML = `<button class="deal-choice-cancel" data-action="closeChoice" type="button">返回</button><button class="deal-choice-confirm" data-action="${confirmAction}" type="button" ${canConfirm ? '' : 'disabled'}>${confirmText}<span>→</span></button>`;
    }

    function renderCommand() { const value = state(); const card = selectedCard(value, model); const actions = value.availableActions || {}; if (value.pendingDebt?.payerId === value.myId) return renderPaymentCommand(); if (value.pendingAction?.responsePlayerId === value.myId) return renderResponseCommand(); if (model.moveCardId) return renderMoveCommand(); commandTitleEl.textContent = card ? card.name : '选择一张牌'; commandHintEl.textContent = card ? actionHint(card) : '选中手牌后，这里会显示合法动作、目标和费用。'; if (actions.canDiscard) { const required = Math.max(0, (value.myHand?.length || 0) - 7); const count = (model.discardIds || []).length; commandTitleEl.textContent = '一起弃牌'; commandHintEl.textContent = `请选择 ${required} 张手牌，已选 ${count} 张。`; commandEl.innerHTML = `<button class="deal-primary" data-action="discardCard" type="button" ${count !== required ? 'disabled' : ''}>确认弃掉 ${required} 张牌</button><button class="deal-secondary" data-action="clearSelection" type="button">重新选择</button>`; return; } if (!card || !actions.canPlay) { commandEl.innerHTML = actions.canEndTurn ? `<div class="deal-end-turn-control"><button class="deal-secondary" data-action="endTurn" type="button">结束回合</button>${value.myIsCurrentTurn ? `<small>已出 ${value.cardsPlayed || 0}／3 张</small>` : ''}</div>` : '<span class="deal-command-note">等待回合开始或摸牌</span>'; return; } if (card.kind === 'money') commandEl.innerHTML = `<button class="deal-primary" data-action="playBank" type="button">存入银行 <span>+${card.value || 0}M</span></button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`; else if (card.kind === 'property' || card.kind === 'property_wild') renderPropertyCommand(card); else if (card.kind === 'rent') renderRentCommand(card); else renderActionCommand(card); }

    function scheduleActionPresentation() { if (model.actionLayoutFrame) { const cancel = globalThis.window?.cancelAnimationFrame || globalThis.cancelAnimationFrame; cancel?.(model.actionLayoutFrame); } layoutHand(); layoutActionPresentation(); const raf = globalThis.window?.requestAnimationFrame || globalThis.requestAnimationFrame || (callback => setTimeout(callback, 0)); model.actionLayoutFrame = raf(() => { layoutHand(); layoutActionPresentation(); }); }
    function layoutHand() {
        if (!handEl) return;
        const cards = [...handEl.querySelectorAll('[data-card-index]')];
        const width = cards[0]?.getBoundingClientRect().width || 80;
        const available = Math.max(0, handEl.clientWidth - 16);
        const gap = cards.length > 1 ? Math.max(-width * .38, Math.min(8, (available - width * cards.length) / (cards.length - 1))) : 8;
        handEl.style.setProperty('--deal-hand-spacing', `${gap}px`);
    }
    async function animateDiscard(play) {
        const source = playerAnchor(play.playerId)?.getBoundingClientRect();
        const targets = [...(eventEl?.querySelectorAll('.deal-discard-card') || [])];
        if (!source || !targets.length || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        await Promise.all(targets.map(async (target, index) => {
            const rect = target.getBoundingClientRect();
            const flight = target.cloneNode(true);
            flight.classList.add('deal-asset-flight-card');
            Object.assign(flight.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
            mount.appendChild(flight);
            const dx = source.left + source.width / 2 - rect.left - rect.width / 2;
            const dy = source.top + source.height / 2 - rect.top - rect.height / 2;
            if (!flight.animate) { flight.remove(); return; }
            target.style.visibility = 'hidden';
            try {
                await flight.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.4)`, opacity: .4 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: 520, delay: index * 55, fill: 'both', easing: 'cubic-bezier(.2,.75,.25,1)' }).finished;
            } catch { /* View was dismissed during the animation. */ }
            finally { flight.remove(); target.style.visibility = ''; }
        }));
    }
    function currentTableCardRect() { const card = eventEl?.querySelector('.deal-main-public-card, .deal-recent-play .deal-preview-card'); if (!card) return null; const rect = card.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; }
    function animateAssetCollection(play, fromRect) {
        if (!play?.card || !fromRect) return Promise.resolve(false);
        const seat = [...mount.querySelectorAll('[data-player-id]')].find(element => String(element.dataset.playerId) === String(play.playerId));
        const toBank = play.zone === 'bank' || play.card.kind === 'money';
        const destination = seat?.querySelector(toBank ? '[data-asset-bank]' : '[data-asset-properties]') || seat;
        if (!destination) return Promise.resolve(false);
        const target = destination.getBoundingClientRect();
        const shell = globalThis.document.createElement('div');
        shell.innerHTML = publicCardMarkup(play.card, 'deal-asset-flight-card');
        const card = shell.firstElementChild;
        if (!card) return Promise.resolve(false);
        card.style.left = `${fromRect.left}px`; card.style.top = `${fromRect.top}px`; card.style.width = `${fromRect.width}px`; card.style.height = `${fromRect.height}px`;
        mount.appendChild(card);
        const reduced = globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduced || typeof card.animate !== 'function') {
            card.remove();
            destination.classList.add('is-receiving-card');
            return new Promise(resolve => setTimeout(() => { destination.classList.remove('is-receiving-card'); resolve(true); }, reduced ? 0 : 420));
        }
        const dx = target.left + target.width / 2 - (fromRect.left + fromRect.width / 2);
        const dy = target.top + target.height / 2 - (fromRect.top + fromRect.height / 2);
        destination.classList.add('is-receiving-card');
        const animation = card.animate([
            { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
            { opacity: .96, offset: .62, transform: `translate(${dx * .72}px, ${dy * .72}px) rotate(-5deg) scale(.62)` },
            { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(-8deg) scale(.22)` },
        ], { duration: 720, easing: 'cubic-bezier(.2,.76,.22,1)', fill: 'forwards' });
        const finished = animation.finished || Promise.resolve();
        return finished.then(() => true, () => false).finally(() => { card.remove(); destination.classList.remove('is-receiving-card'); });
    }
    function showTurnToast() {
        const toast = $('turnToast');
        if (!toast) return;
        clearTimeout(model.turnToastTimer);
        toast.classList.remove('is-visible');
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        toast.setAttribute('aria-hidden', 'false');
        const reduced = globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        model.turnToastTimer = setTimeout(() => { toast.classList.remove('is-visible'); toast.setAttribute('aria-hidden', 'true'); }, reduced ? 700 : 1250);
    }
    function layoutActionPresentation() { const value = state(); const interaction = value?.interaction; const card = $('publicCard'); if (card && interaction?.interactionId === model.animateInteractionId) { const source = playerAnchor(interaction.actorId); const cardRect = card.getBoundingClientRect(); const sourceRect = source?.getBoundingClientRect(); const width = globalThis.innerWidth || 0; const height = globalThis.innerHeight || 0; const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : width / 2; const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : height; card.style.setProperty('--deal-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`); card.style.setProperty('--deal-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`); void card.offsetWidth; card.classList.add('is-entering'); model.animateInteractionId = null; } updateActionLinks(); }
    function updateActionLinks() {
        const svg = $('actionLinks'); const value = state();
        if (!svg) return;
        svg.classList.remove('has-action', 'has-response');
        const interaction = value?.interaction;
        if (!interaction || value.status === 'ended' || value.lastPlayedCard?.zone === 'discard') return;
        const actor = playerAnchor(interaction.actorId);
        if (!actor) return;
        const ids = [...new Set(interaction.targetIds?.length ? interaction.targetIds : [interaction.currentTargetId])].filter(id => id && id !== interaction.actorId);
        let paths = '';
        for (const id of ids) {
            const target = playerAnchor(id);
            if (target) paths += drawLink(actor, target, 'action');
        }
        if (paths) {
            $('actionLinkGlow').setAttribute('d', paths); $('actionLinkStroke').setAttribute('d', paths);
            svg.classList.add('has-action');
        }
        const responding = interaction.stage === 'no_response' ? interaction.noChain?.at(-1)?.playerId : interaction.stage === 'payment' ? interaction.currentTargetId : null;
        const responder = responding && playerAnchor(responding);
        if (responder && responding !== interaction.actorId) { drawLink(responder, actor, 'response'); svg.classList.add('has-response'); }
    }
    function drawLink(source, target, kind) { const sourceRect = source.getBoundingClientRect(); const targetRect = target.getBoundingClientRect(); const width = globalThis.innerWidth || 0; const height = globalThis.innerHeight || 0; const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value)); const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, Math.max(12, width - 12)); const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, Math.max(12, height - 12)); const targetX = clamp(targetRect.left + targetRect.width / 2, 12, Math.max(12, width - 12)); const targetY = clamp(targetRect.top + targetRect.height / 2, 12, Math.max(12, height - 12)); const bend = kind === 'response' ? 1 : -1; const middleX = (sourceX + targetX) / 2 + bend * Math.min(62, Math.abs(targetY - sourceY) * .1); const middleY = (sourceY + targetY) / 2 + bend * Math.min(70, Math.max(22, Math.abs(targetX - sourceX) * .11)); const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`; $('actionLinks').setAttribute('viewBox', `0 0 ${width} ${height}`); $(`${kind}LinkGlow`).setAttribute('d', path); $(`${kind}LinkStroke`).setAttribute('d', path); $(`${kind}LinkSeal`).setAttribute('cx', String(targetX)); $(`${kind}LinkSeal`).setAttribute('cy', String(targetY)); return `${path} `; }
    function playerAnchor(playerId) { if (!playerId) return null; return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null; }

    function render() {
        const value = state();
        if (!value) return;
        const mine = me(value);
        const players = value.players || [];
        const opponents = players.filter(player => player.id !== value.myId);
        const ended = value.status === 'ended';
        const locked = model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0);
        const root = mount.querySelector('.deal-game');
        root.classList.toggle('is-my-turn', Boolean(value.myIsCurrentTurn && !ended));
        root.classList.toggle('is-urgent', Boolean(value.pendingDebt?.payerId === value.myId || value.pendingAction?.responsePlayerId === value.myId));
        root.classList.toggle('is-ended', ended);
        root.classList.toggle('has-public-interaction', Boolean(value.interaction?.card));
        root.classList.toggle('is-presentation-locked', locked);
        root.setAttribute('aria-busy', (locked || model.submissionPending) ? 'true' : 'false');
        turnEl.innerHTML = ended ? `<span class="deal-live-dot ended"></span>${escapeHtml(playerName(value.winner?.id, value.winner?.name || '本局'))}获胜` : `<span class="deal-live-dot"></span>${value.myIsCurrentTurn ? '您的回合' : `${escapeHtml(playerName(value.currentTurn, value.currentTurnName || '对手'))}的回合`}<small>第 ${value.turnNumber || 1} 回合</small>`;
        phaseEl.textContent = phaseText();
        const drawButton = mount.querySelector('[data-action="drawCards"]');
        if (drawButton) {
            const canDraw = Boolean(value.availableActions?.canDraw && !locked);
            const drawCount = (value.myHand?.length || 0) === 0 ? 5 : 2;
            const drawStatus = canDraw
                ? `摸 ${drawCount} 张`
                : ended ? '牌局结束' : value.myIsCurrentTurn && value.phase !== 'draw' ? '本回合已摸' : '等待回合';
            drawButton.disabled = !canDraw;
            drawButton.title = drawStatus;
            drawButton.setAttribute('aria-label', canDraw ? `从牌库摸 ${drawCount} 张牌` : drawStatus);
        }
        opponentsEl.style.setProperty('--deal-seat-count', String(Math.max(1, opponents.length)));
        opponentsEl.dataset.seatCount = String(opponents.length);
        opponentsEl.innerHTML = opponents.map(renderOpponent).join('');
        if (selfSeatEl) selfSeatEl.innerHTML = renderSelfSeat(mine);
        handEl.innerHTML = (value.myHand || []).map(renderCard).join('') || '<div class="deal-hand-empty"><strong>手牌为空</strong><small>轮到您时将摸取 5 张牌</small></div>';
        renderCommand();
        renderChoiceOverlay();
        renderHistory();
        renderRetiredPreview();
        if (model.archiveKind && !$('archiveOverlay')?.classList.contains('is-hidden')) renderArchive(model.archiveKind);
        renderEvent();
        scheduleActionPresentation();
        if (model.submissionPending || locked) mount.querySelectorAll('[data-action], [data-payment-id], [data-choice-target-id], [data-choice-color], [data-move-card-id], [data-card-index], select').forEach(control => { if (control.dataset.action !== 'skip-victory') control.disabled = true; });
    }
    function historyEntries(value) {
        const structured = Array.isArray(value?.actionHistory) ? value.actionHistory : [];
        if (structured.length) return structured;
        return (value?.actionLog || []).map((message, index) => ({ id: index + 1, kind: 'legacy', message }));
    }

    const HISTORY_LABELS = {
        gameStarted: '牌局开始',
        drawCards: '摸牌',
        cardsDrawn: '摸牌',
        rent: '租金',
        debtCollector: '收取债务',
        birthday: '我的生日',
        dealBreaker: '物业接管',
        slyDeal: '盗取',
        forcedDeal: '强制交易',
        house: '房子',
        hotel: '酒店',
        passGo: '通行证',
        doubleRent: '双倍租金',
        justSayNo: '做出反对',
        discardCard: '弃牌',
        bankCard: '存入银行',
        property: '地产',
        property_wild: '万能地产',
        moveProperty: '调整地产',
        responseRequested: '等待回应',
        actionSkipped: '行动跳过',
        turnStarted: '回合开始',
        endTurn: '回合结束',
        gameOver: '牌局结束',
    };

    function historyActionType(entry) {
        const raw = entry.actionType || entry.action || entry.kind || '';
        const card = entry.card || {};
        if (card.kind === 'money') return 'bankCard';
        if (card.kind === 'rent') return card.action || 'rent';
        if (card.kind === 'property' || card.kind === 'property_wild') return card.kind;
        if (['playCard', 'cardPlayed', 'actionResult', 'resolveAction'].includes(raw) && card.action) return card.action;
        return raw;
    }

    function historyLabel(entry) {
        const type = historyActionType(entry);
        if (HISTORY_LABELS[type]) return HISTORY_LABELS[type];
        const text = viewerMessage(entry.message);
        if (/游戏开始/.test(text)) return '牌局开始';
        if (/完成三个不同颜色|赢得游戏|本局结束/.test(text)) return '牌局结束';
        if (/弃掉/.test(text)) return '弃牌';
        return entry.card?.name || '公开行动';
    }

    function historyRows(value) {
        const rows = [];
        for (const entry of historyEntries(value)) {
            const key = entry.interactionId != null
                ? `interaction:${entry.interactionId}`
                : entry.actionId != null ? `action:${entry.actionId}` : null;
            const previous = rows.at(-1);
            if (key && previous?.key === key) previous.entries.push(entry);
            else rows.push({ key, entries: [entry] });
        }
        return rows;
    }

    function historyStatus(row) {
        const entries = row.entries || [];
        const messages = entries
            .filter(entry => ['responseRequested', 'actionResult', 'resolveAction', 'actionSkipped', 'gameOver'].includes(entry.kind) || entry.outcome || entry.reason)
            .map(entry => viewerMessage(entry.message || '').trim())
            .filter(Boolean);
        const unique = [...new Set(messages)];
        if (unique.length) return unique.join('；');
        return viewerMessage(entries.at(-1)?.message || '');
    }

    function historyCopy(row) {
        const primary = row.entries.find(entry => entry.kind === 'playCard' || entry.card) || row.entries[0] || {};
        return {
            title: historyLabel(primary),
            detail: historyContext(primary),
            status: historyStatus(row),
        };
    }

    function historyContext(entry) {
        const actor = playerName(entry.actorId || entry.playerId, viewerMessage(entry.actorName || entry.playerName || '牌桌'));
        const targets = entry.targetIds?.length ? entry.targetIds.map((id, index) => playerName(id, entry.targetNames?.[index])).join('、') : entry.targetId ? playerName(entry.targetId, viewerMessage(entry.targetName)) : viewerMessage(entry.targetName || '');
        const detail = [targets ? `→ ${targets}` : '', entry.color ? (COLOR_LABELS[entry.color] || entry.color) : '', entry.amount !== null && entry.amount !== undefined ? `${entry.amount}M` : ''].filter(Boolean).join(' · ');
        return viewerMessage([actor, detail].filter(Boolean).join(' '));
    }
    function renderHistory() {
        const value = state();
        const rows = historyRows(value);
        const latest = rows.at(-1);
        const copy = latest ? historyCopy(latest) : null;
        historyEl.innerHTML = `<small>最近行动</small><strong><b>${rows.length}</b> 条记录</strong><em>${escapeHtml(copy?.status || copy?.detail || '点击查看全部记录')}</em>`;
        if (historyCardEl) historyCardEl.innerHTML = value.lastPlayedCard?.card && value.lastPlayedCard.zone !== 'discard' ? publicCardMarkup(value.lastPlayedCard.card, 'deal-record-card-face') : '<span class="deal-record-card-empty">交</span>';
    }
    function retiredCards(value) { return (value?.players || []).flatMap(player => (player.bank || []).map(card => ({ ...card, ownerId: player.id, ownerName: player.name }))); }
    const MONEY_DENOMINATIONS = [1, 2, 3, 4, 5, 10];
    function moneyDenominations(player) {
        const counts = Object.fromEntries(MONEY_DENOMINATIONS.map(value => [value, 0]));
        (player?.bank || []).forEach(card => { if (Object.prototype.hasOwnProperty.call(counts, card.value)) counts[card.value] += 1; });
        return counts;
    }
    function assetPropertyGroupMarkup(value, player, group) {
        const color = group.color;
        const label = COLOR_LABELS[color] || color;
        const size = sizeFor(value, color);
        const complete = group.isComplete ?? completeGroup(value, group.cards, color);
        const canMove = String(player?.id) === String(value.myId) && value.availableActions?.canMoveProperty && !group.house && !group.hotel;
        const cards = (group.cards || []).map((card, index) => {
            const markup = publicCardMarkup({ ...card, color: card.color || color }, 'deal-asset-property-card', `--deal-stack-index:${index};`);
            if (model.assetPicking && selectedCard(value, model)?.action === 'slyDeal' && !complete) {
                return markup.replace('<article ', `<article role="button" tabindex="0" data-asset-pick="card" data-card-id="${escapeHtml(card.id)}" data-group-id="${escapeHtml(group.id)}" data-color="${escapeHtml(color)}" aria-pressed="${model.assetDraft?.cardId === card.id}" `);
            }
            if (!canMove) return markup;
            const attributes = `role="button" tabindex="0" data-move-card-id="${escapeHtml(card.id)}" data-from-color="${escapeHtml(color)}" data-from-group-id="${escapeHtml(group.id)}" title="调整${escapeHtml(card.name)}的地产组"`;
            return markup.replace('<article ', `<article ${attributes} `);
        }).join('');
        const buildings = [group.house, group.hotel].filter(Boolean).map((card, index) => publicCardMarkup(card, 'deal-asset-property-card deal-asset-building-card', `--deal-stack-index:${group.cards.length + index};`)).join('');
        const pickGroup = model.assetPicking && selectedCard(value, model)?.action === 'dealBreaker' && complete;
        const pickAttrs = pickGroup ? `role="button" tabindex="0" data-asset-pick="group" data-group-id="${escapeHtml(group.id)}" data-color="${escapeHtml(color)}" aria-pressed="${model.assetDraft?.groupId === group.id}"` : '';
        return `<article ${pickAttrs} class="deal-asset-property-group color-${escapeHtml(color)} ${complete ? 'is-complete' : ''} ${group.house ? 'has-house' : ''} ${group.hotel ? 'has-hotel' : ''}" style="--deal-property-color:${COLOR_HEX[color] || '#99866e'}"><header><strong>${escapeHtml(label)} · 第${groupNumber(value, player, group)}组</strong><span>${group.cards.length}/${size} 张</span></header><div class="deal-asset-property-stack" role="list" aria-label="${escapeHtml(label)}第${groupNumber(value, player, group)}组地产">${cards || '<em>暂无地产</em>'}${buildings}</div><footer><span>${groupRent(group)}M 租金</span>${complete ? '<b>完整</b>' : ''}</footer></article>`;
    }
    function renderRetiredPreview() {
        if (!removedCardsEl) return;
        const cards = retiredCards(state());
        removedCardsEl.innerHTML = `<strong>已退出循环</strong><small>${cards.length ? `<b>${cards.length}</b> 张银行牌不会洗回牌库` : '暂无银行牌'}</small>`;
    }
    function renderArchive(kind = 'history') {
        const value = state();
        const archive = $('archiveOverlay');
        if (!archive) return;
        if (kind === 'payment' && value.pendingDebt?.payerId === value.myId) {
            $('archiveKicker').textContent = '支付资产';
            $('archiveTitle').textContent = `向${value.pendingDebt.creditorName || '对手'}支付`;
            $('archiveHint').textContent = '银行每点一次选一张；地产点击切换选择。确认后才会交付。';
            const list = $('archiveList'); list.classList.remove('is-retired'); list.innerHTML = paymentAssetMarkup(value); return;
        }
        const retired = kind === 'retired';
        const assets = kind === 'assets';
        const assetPlayer = (value.players || []).find(player => String(player.id) === String(model.assetPlayerId));
        const entries = retired ? retiredCards(value) : assets ? [] : historyRows(value).slice().reverse();
        const kicker = $('archiveKicker');
        const title = $('archiveTitle');
        const hint = $('archiveHint');
        const list = $('archiveList');
        if (kicker) kicker.textContent = retired ? '永久离场牌' : assets ? '公开资产' : '公开记录';
        if (title) title.textContent = retired ? '已退出循环的银行牌' : assets ? `${playerName(assetPlayer?.id, assetPlayer?.name || '玩家')}的公开资产` : '完整行动记录';
        if (hint) hint.textContent = retired ? '现金、行动牌和租金牌一旦进入银行就不会再洗回牌库；支付转移后仍留在银行。' : assets ? '银行和地产组对所有玩家公开。' : '中央保留最近出牌，这里记录本局全部公开行动。';
        if (!list) return;
        if (assets && model.assetPicking && hint) hint.textContent = selectedCard(value, model)?.action === 'dealBreaker' ? '点击完整地产组，确认后再出牌；没有合适目标可取消。' : '点击未成套组内的地产牌，确认后再出牌；没有合适目标可取消。';
        list.classList.toggle('is-retired', retired);
        if (assets) {
            const groups = assetPlayer ? playerGroups(value, assetPlayer) : [];
            const counts = moneyDenominations(assetPlayer);
            const money = MONEY_DENOMINATIONS.map(value => `<article class="deal-money-denomination ${counts[value] ? '' : 'is-empty'}">${moneyFaceMarkup(value)}<strong>${value}M</strong><span>× ${counts[value]}</span></article>`).join('');
            list.innerHTML = `<section class="deal-asset-dialog-section deal-asset-money"><header><h3>银行货币</h3><b>${assetPlayer?.bankValue || 0}M</b></header><div class="deal-money-grid">${money}</div><small class="deal-asset-note">银行中的行动牌和租金牌也按牌面金额计入。</small></section><section class="deal-asset-dialog-section deal-asset-properties"><header><h3>地产组</h3><b>${groups.length} 组</b></header><div class="deal-asset-property-groups">${groups.map(group => assetPropertyGroupMarkup(value, assetPlayer, group)).join('') || '<em class="deal-archive-empty">暂无地产</em>'}</div></section>`;
            if (model.assetPicking) list.innerHTML += `<div class="deal-asset-pick-controls"><button class="deal-secondary" data-action="closeArchive" type="button">取消</button><button class="deal-primary" data-action="confirmAssetPick" type="button" ${model.assetDraft ? '' : 'disabled'}>确认选择</button></div>`;
            return;
        }
        list.innerHTML = entries.length
            ? retired
                ? entries.map(card => `<article class="deal-archive-entry deal-archive-card"><span class="deal-archive-card-face">${publicCardMarkup(card, 'deal-archive-card-art')}</span><div><strong>${escapeHtml(card.name || '未命名牌')}</strong><small>${escapeHtml(playerName(card.ownerId, card.ownerName || '玩家'))} · 作为货币保存 · ${card.value || 0}M</small></div><b>${card.value || 0}M</b></article>`).join('')
                : entries.map((row, index) => {
                    const primary = row.entries.find(entry => entry.kind === 'playCard' || entry.card) || row.entries[0] || {};
                    const copy = historyCopy(row);
                    return `<article class="deal-archive-entry ${index === 0 ? 'is-latest' : ''}">${primary.card ? `<span class="deal-archive-card-face">${publicCardMarkup(primary.card, 'deal-archive-card-art')}</span>` : '<i class="deal-archive-entry-mark">行</i>'}<div><strong>${escapeHtml(copy.title)}</strong><small>${escapeHtml(copy.detail)}</small><span>${escapeHtml(copy.status)}</span></div></article>`;
                }).join('')
            : `<em class="deal-archive-empty">${retired ? '暂无银行牌退出循环' : '本局还没有公开行动记录'}</em>`;
    }
    return { render, renderEvent, refreshEvent, renderArchive, scheduleActionPresentation, playerAnchor, currentTableCardRect, animateAssetCollection, animateDiscard, showTurnToast };
}
