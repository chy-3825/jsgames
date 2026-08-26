const COLOR_LABELS = { brown: '棕', lightblue: '浅蓝', pink: '粉', orange: '橙', red: '红', yellow: '黄', green: '绿', blue: '深蓝', railroad: '铁路', utility: '公用事业' };
const COLOR_SIZE = { brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, blue: 2, railroad: 4, utility: 2 };
const COLORS = Object.keys(COLOR_LABELS);
const ACTION_LABELS = { dealBreaker: '物业接管', justSayNo: '做出反对', passGo: '通行证', doubleRent: '双倍租金', debtCollector: '收取债务', birthday: '我的生日', slyDeal: '盗取', forcedDeal: '强制交易', house: '房子', hotel: '酒店' };
const COLOR_HEX = { brown: '#84533d', lightblue: '#6badd0', pink: '#cc5d9b', orange: '#dc793a', red: '#c6423b', yellow: '#e4b938', green: '#3f9a59', blue: '#3e61b2', railroad: '#303a3d', utility: '#86b999' };
const ACTION_MARKS = {
    dealBreaker: ['组', '整组接管'], justSayNo: ['反', '抵制行动'], passGo: ['摸', '摸取两张'], doubleRent: ['×2', '租金翻倍'],
    debtCollector: ['5M', '收取债务'], birthday: ['+2', '我的生日'], slyDeal: ['1↗', '盗取地产'], forcedDeal: ['⇄', '强制交易'],
    house: ['⌂', '加盖房子'], hotel: ['店', '升级酒店'],
};
const RESPONSE_REACTION_MS = 800;
const COUNTER_REACTION_MS = 650;

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/games/monopolydeal/style.css?v=${Date.now()}`;
    document.head.appendChild(link);
    const choiceLink = document.createElement('link');
    choiceLink.rel = 'stylesheet';
    choiceLink.href = `/games/monopolydeal/choice.css?v=${Date.now()}`;
    document.head.appendChild(choiceLink);
    document.body.classList.add('is-monopolydeal-view');

    let state = null;
    let selected = null;
    let targetId = null;
    let targetColor = null;
    let targetGroupId = null;
    let targetPropertyId = null;
    let ownColor = null;
    let ownGroupId = null;
    let ownPropertyId = null;
    let paymentIds = [];
    let moveCardId = null;
    let moveFromColor = null;
    let moveFromGroupId = null;
    let moveToColor = null;
    let moveToGroupId = null;
    let choiceMode = null;
    let animateInteractionId = null;
    let decisionKey = null;
    let decisionReadyAt = 0;
    let decisionTimer = 0;
    let actionLayoutFrame = 0;
    let activeTransfer = null;
    let transferTimer = 0;
    let highlightedGroups = new Set();
    let groupHighlightTimer = 0;
    let victoryTimer = 0;
    let scenePlaying = false;
    let submissionPending = false;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const controller = new AbortController();
    link.addEventListener('load', scheduleActionPresentation, { signal: controller.signal });
    choiceLink.addEventListener('load', scheduleActionPresentation, { signal: controller.signal });

    mount.innerHTML = `<section class="deal-game"><header class="deal-header"><div class="deal-brand"><span class="deal-brand-mark">交</span><div><small>快速交易 · 集齐三组获胜</small><h1>大富翁纸牌</h1></div></div><div data-role="turn" class="deal-turn">等待游戏状态</div><div class="deal-header-actions"><button data-ui="rules" type="button">规则</button><button data-ui="leave" type="button">离开</button></div></header><main class="deal-layout"><section class="deal-opponents" data-role="opponents"></section><section class="deal-table"><div class="deal-center"><div class="deal-stat"><span>我的银行</span><strong data-role="bank">0M</strong></div><div class="deal-draw"><small>牌库</small><b data-role="deck">0</b><button data-action="drawCards" type="button">摸牌</button></div><div class="deal-stat"><span>完成地产</span><strong data-role="sets">0 / 3</strong></div></div><div class="deal-event" data-role="event">选择一张手牌开始行动</div><section class="deal-my-properties"><div class="deal-section-title"><span>我的地产桌</span><small>回合内点击多色地产即可切换颜色</small></div><div class="deal-property-groups" data-role="properties"></div></section></section><aside class="deal-command"><div class="deal-command-kicker">行动决策</div><h2 data-role="commandTitle">选择一张牌</h2><p data-role="commandHint">选中手牌后，这里会显示合法动作、目标和费用。</p><div class="deal-command-body" data-role="command"></div></aside><section class="deal-hand"><div class="deal-hand-title"><div><span>我的手牌</span><small data-role="phase">等待中</small></div><small>本回合 <b data-role="played">0</b> / 3 张</small></div><div class="deal-cards" data-role="hand"></div></section></main><div class="deal-overlay is-hidden" data-role="rulesOverlay"><article class="deal-rules"><button data-ui="closeRules" type="button">×</button><small>标准规则</small><h2>标准版规则</h2><ol><li>106 张可玩牌洗牌，起手 5 张；每回合摸 2 张，没手牌时摸 5 张。</li><li>每回合最多打出 3 张；回合末最多保留 7 张手牌。</li><li>双色租金向所有对手收取；任何租金只向一名玩家收取。</li><li>“做出反对”可以被另一张“做出反对”反制，且不计入本回合 3 张出牌。</li><li>三个不同颜色的完整地产组获胜；纯万能牌不能单独构成完整组。</li></ol></article></div><div class="deal-choice-overlay is-hidden" data-role="choiceOverlay"><section class="deal-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="dealChoiceTitle"><button class="deal-choice-close" data-action="closeChoice" type="button" aria-label="关闭颜色选择">×</button><small>选择地产颜色</small><h2 id="dealChoiceTitle" data-role="choiceTitle">选择颜色</h2><p data-role="choiceHint"></p><div class="deal-choice-targets" data-role="choiceTargets"></div><div class="deal-choice-grid" data-role="choiceGrid"></div><div class="deal-choice-actions" data-role="choiceActions"></div></section></div></section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const opponentsEl = $('opponents');
    const handEl = $('hand');
    const propertiesEl = $('properties');
    const commandEl = $('command');
    const commandTitleEl = $('commandTitle');
    const commandHintEl = $('commandHint');
    const turnEl = $('turn');
    const phaseEl = $('phase');
    const bankEl = $('bank');
    const deckEl = $('deck');
    const setsEl = $('sets');
    const playedEl = $('played');
    const eventEl = $('event');
    const overlay = $('rulesOverlay');
    const choiceOverlay = $('choiceOverlay');
    bankEl.parentElement.insertAdjacentHTML('beforeend', '<button class="deal-ledger-button" data-ui="bank" type="button">查看银行牌</button>');
    deckEl.parentElement.insertAdjacentHTML('beforeend', '<button class="deal-discard-button" data-ui="discard" type="button">弃牌堆 <b data-role="discardCount">0</b></button>');
    mount.querySelector('.deal-table').insertAdjacentHTML('beforeend', '<section class="deal-activity"><div class="deal-section-title"><span>牌桌动态</span><small>最近的公开行动</small></div><div class="deal-history" data-role="history"></div></section>');
    mount.querySelector('.deal-game').insertAdjacentHTML('beforeend', '<div class="deal-ledger-overlay is-hidden" data-role="ledgerOverlay"><section class="deal-ledger-dialog" role="dialog" aria-modal="true" aria-labelledby="dealLedgerTitle"><button class="deal-choice-close" data-action="closeLedger" type="button" aria-label="关闭公开牌区">×</button><small>公开牌区</small><h2 id="dealLedgerTitle">银行账本与弃牌堆</h2><p>银行牌和弃牌均为公开信息；存入银行的牌只作为货币，不会回到摸牌堆。</p><div data-role="bankLedger"></div><section class="deal-discard-ledger"><h3>公开弃牌堆</h3><div data-role="discardLedger"></div></section></section></div>');
    mount.querySelector('.deal-game').insertAdjacentHTML('beforeend', `<svg class="deal-action-links" data-role="actionLinks" aria-hidden="true">
        <path class="deal-link-glow is-action" data-role="actionLinkGlow"></path><path class="deal-link-stroke is-action" data-role="actionLinkStroke"></path><circle class="deal-link-seal is-action" data-role="actionLinkSeal" r="7"></circle>
        <path class="deal-link-glow is-response" data-role="responseLinkGlow"></path><path class="deal-link-stroke is-response" data-role="responseLinkStroke"></path><circle class="deal-link-seal is-response" data-role="responseLinkSeal" r="6"></circle>
    </svg><div class="deal-victory-layer" data-role="victoryLayer" aria-hidden="true" hidden><div class="deal-victory-scene" data-role="victoryScene" role="status" aria-live="assertive"></div><button type="button" class="deal-victory-skip" data-action="skip-victory">跳过</button></div>`);
    const ledgerOverlay = $('ledgerOverlay');
        overlay.innerHTML = `<article class="deal-rules"><button data-ui="closeRules" type="button">×</button><small>标准规则</small><h2>大富翁纸牌完整规则</h2><div class="deal-rules-sections"><section><h3>目标与回合</h3><p>2～5人。每人起手5张；回合开始摸2张，若开始回合时没有手牌则摸5张。每回合可打出0～3张牌，回合末最多保留7张。最先拥有三个不同颜色完整地产组的玩家立即获胜。</p></section><section><h3>三种出牌方式</h3><p>现金牌存入银行；行动牌可以发动后弃置，也可永久作为现金存入银行；地产牌放入独立地产组，不能放进银行。已经存入银行的行动牌永远不能再发动。</p></section><section><h3>支付</h3><p>欠款人自行选择桌面上的银行牌、地产牌或两者组合支付，不能用手牌，也不能直接支付附着在地产组上的房子/酒店。银行牌进入收款人银行，地产进入其地产区。不找零；资产不足时交出全部可支付资产，余债取消。</p></section><section><h3>地产与建筑</h3><p>同色可以建立多组，但每组不能超过牌面规定数量；同色多组只算一种胜利颜色。完整组必须至少有一张普通地产。万能地产仅在自己回合调整且不计出牌。房子只能放在完整的非铁路/公用事业组，酒店必须先有房子，每组各限一张；组被拆散时附着建筑转入拥有者银行，不能进入弃牌堆。</p></section><section><h3>行动牌</h3><p>双色租金选择牌面一种颜色并向所有对手收取；任何租金选择一个地产组和一名玩家。双倍租金必须紧接合法租金牌，可用两张形成四倍。盗取和强制交易不能动完整组；物业接管夺走一整个完整组及建筑。我的生日向所有对手各收2M，收取债务向一人收5M，通行证摸2张。</p></section><section><h3>做出反对</h3><p>“做出反对”可以取消针对自己的行动，只保护使用者本人，也可以反制另一张“做出反对”。回应使用的“做出反对”不占每回合三张出牌额度。</p></section></div></article>`;

    overlay.querySelector('.deal-rules').insertAdjacentHTML('beforeend', '<figure class="deal-rules-art"><img src="/assets/bgg/monopolydeal/detail.jpg" alt="大富翁纸牌地产、收租和行动牌构成参考" loading="lazy"><figcaption>BGG 实物组件参考 · 线上名称、金额与可用动作以实时状态为准</figcaption></figure>');
    const historyEl = $('history');

    function me() { return state?.players?.find(player => player.id === state.myId); }
    function selectedCard() { return selected === null ? null : state?.myHand?.[selected] || null; }
    function setSubmissionPending(pending) {
        submissionPending = Boolean(pending);
        const root = mount.querySelector('.deal-game');
        root?.classList.toggle('is-submitting', submissionPending);
        root?.setAttribute('aria-busy', submissionPending ? 'true' : 'false');
    }
    function submitAction(action) {
        if (submissionPending) return false;
        setSubmissionPending(true);
        try {
            send({ type: 'gameAction', action });
            return true;
        } catch (error) {
            setSubmissionPending(false);
            throw error;
        }
    }
    function handAction(kind, cardIndex, extra = {}) {
        const card = state?.myHand?.[cardIndex];
        return { kind, cardIndex, cardId: card?.id, ...extra };
    }
    function sizeFor(color) { return state?.rules?.colorSize?.[color] || COLOR_SIZE[color] || 2; }
    function completeGroup(cards, color) { return (cards || []).length >= sizeFor(color) && (cards || []).some(card => card.kind === 'property'); }
    function playerGroups(player, color = null) {
        if (!player) return [];
        const groups = Array.isArray(player.propertyGroups) ? player.propertyGroups : Object.entries(player.properties || {}).filter(([, cards]) => cards.length).map(([groupColor, cards]) => ({ id: `${player.id}:${groupColor}:legacy`, color: groupColor, cards, isComplete: completeGroup(cards, groupColor), rent: rentEstimateLegacy(groupColor, player), house: null, hotel: null }));
        return color ? groups.filter(group => group.color === color) : groups;
    }
    function groupNumber(player, group) { return playerGroups(player, group.color).findIndex(item => item.id === group.id) + 1; }
    function groupRent(group) { return Number(group?.rent || 0); }

    function currentDecisionKey(value = state) {
        const pending = value?.pendingAction;
        if (!pending || pending.responsePlayerId !== value.myId) return null;
        return `${value.interaction?.interactionId || 0}:${pending.targetId}:${pending.responsePlayerId}:${pending.noCount || 0}`;
    }

    function updateDecisionWindow(previous, next) {
        const nextKey = currentDecisionKey(next);
        if (!nextKey) {
            decisionKey = null;
            decisionReadyAt = 0;
            clearTimeout(decisionTimer);
            return;
        }
        if (nextKey === decisionKey) return;
        decisionKey = nextKey;
        const delay = next.pendingAction?.noCount ? COUNTER_REACTION_MS : RESPONSE_REACTION_MS;
        decisionReadyAt = previous ? Date.now() + delay : 0;
        clearTimeout(decisionTimer);
        if (decisionReadyAt) {
            decisionTimer = window.setTimeout(() => {
                if (currentDecisionKey() === decisionKey) render();
            }, delay + 20);
        }
    }

    function decisionReady() {
        return !currentDecisionKey() || Date.now() >= decisionReadyAt;
    }

    function completeGroupKeys(value) {
        const result = new Set();
        (value?.players || []).forEach(player => playerGroupsFromState(player).forEach(group => {
            if (group.isComplete) result.add(`${player.id}:${group.id}`);
        }));
        return result;
    }

    function playerGroupsFromState(player) {
        if (!player) return [];
        if (Array.isArray(player.propertyGroups)) return player.propertyGroups;
        return Object.entries(player.properties || {}).filter(([, cards]) => cards.length).map(([color, cards]) => ({ id: `${player.id}:${color}:legacy`, color, cards, isComplete: completeGroup(cards, color) }));
    }

    function updateGroupHighlights(previous, next) {
        if (!previous) return;
        const before = completeGroupKeys(previous);
        const after = completeGroupKeys(next);
        const newlyCompleted = [...after].filter(key => !before.has(key));
        if (!newlyCompleted.length) return;
        highlightedGroups = new Set(newlyCompleted);
        clearTimeout(groupHighlightTimer);
        groupHighlightTimer = window.setTimeout(() => {
            highlightedGroups.clear();
            if (state) render();
        }, reducedMotion ? 700 : 1500);
    }

    function transferKey(value) {
        const interaction = value?.interaction;
        if (!interaction?.transfer) return '';
        return `${interaction.interactionId}:${interaction.results?.length || 0}:${interaction.payments?.length || 0}:${interaction.transfer.kind}:${(interaction.transfer.cardIds || []).join(',')}`;
    }

    function updateTransferPresentation(previous, next) {
        const nextKey = transferKey(next);
        if (!nextKey || nextKey === transferKey(previous)) return;
        activeTransfer = { ...next.interaction.transfer, key: nextKey };
        clearTimeout(transferTimer);
        transferTimer = window.setTimeout(() => {
            activeTransfer = null;
            scheduleActionPresentation();
            if (state) renderEvent();
        }, reducedMotion ? 550 : 1050);
    }

    function showVictoryScene(next) {
        const winner = (next.players || []).find(player => player.id === next.winner?.id);
        const groups = playerGroupsFromState(winner).filter(group => group.isComplete).slice(0, 3);
        const groupMarkup = groups.map(group => `<article style="--victory-color:${COLOR_HEX[group.color] || '#927a58'}"><i></i><strong>${escapeHtml(COLOR_LABELS[group.color] || group.color)}</strong><span>${group.cards.length} 张地产</span></article>`).join('');
        $('victoryScene').innerHTML = `<span class="deal-victory-kicker">地产帝国落成</span><div class="deal-victory-seal">交</div><h2>${escapeHtml(next.winner?.name || '玩家')}完成三组地产</h2><div class="deal-victory-groups">${groupMarkup}</div><p>${escapeHtml(next.lastAction?.message || '三个不同颜色的完整地产组已经建成。')}</p>`;
        const layer = $('victoryLayer');
        layer.hidden = false;
        layer.classList.add('is-active');
        layer.setAttribute('aria-hidden', 'false');
        scenePlaying = true;
        mount.querySelector('.deal-game')?.classList.add('is-scene-active');
        requestAnimationFrame(() => layer.classList.add('is-revealed'));
        clearTimeout(victoryTimer);
        victoryTimer = window.setTimeout(hideVictoryScene, reducedMotion ? 1200 : 2800);
    }

    function hideVictoryScene() {
        clearTimeout(victoryTimer);
        victoryTimer = 0;
        const layer = $('victoryLayer');
        layer?.classList.remove('is-active', 'is-revealed');
        layer?.setAttribute('aria-hidden', 'true');
        if (layer) layer.hidden = true;
        mount.querySelector('.deal-game')?.classList.remove('is-scene-active');
        scenePlaying = false;
    }

    function render() {
        if (!state) return;
        const mine = me();
        const ended = state.status === 'ended';
        const root = mount.querySelector('.deal-game');
        root.classList.toggle('is-my-turn', Boolean(state.myIsCurrentTurn && !ended));
        root.classList.toggle('is-urgent', Boolean(state.pendingDebt?.payerId === state.myId || state.pendingAction?.responsePlayerId === state.myId));
        root.classList.toggle('is-ended', ended);
        root.classList.toggle('has-public-interaction', Boolean(state.interaction?.card));
        const handPanel = handEl.closest('.deal-hand');
        handPanel.dataset.playerId = state.myId;
        handPanel.classList.toggle('is-action-source', state.interaction?.actorId === state.myId);
        handPanel.classList.toggle('is-action-target', state.interaction?.currentTargetId === state.myId);
        handPanel.classList.toggle('is-response-seat', state.interaction?.responsePlayerId === state.myId);
        turnEl.innerHTML = ended ? `<span class="deal-live-dot ended"></span>${escapeHtml(state.winner?.name || '本局')} 获胜` : `<span class="deal-live-dot"></span>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(state.currentTurnName || '对手')}的回合`}<small>第 ${state.turnNumber || 1} 回合</small>`;
        phaseEl.textContent = phaseText();
        deckEl.textContent = state.deckCount || 0;
        bankEl.textContent = `${mine?.bankValue || 0}M`;
        setsEl.textContent = `${mine?.completedSets || 0} / 3`;
        playedEl.textContent = state.cardsPlayed || 0;
        const discardCountEl = $('discardCount');
        if (discardCountEl) discardCountEl.textContent = state.discardCount ?? state.discard?.length ?? 0;
        const drawButton = mount.querySelector('[data-action="drawCards"]');
        if (drawButton) drawButton.disabled = !state.availableActions?.canDraw;
        opponentsEl.innerHTML = (state.players || []).filter(player => player.id !== state.myId).map(renderOpponent).join('');
        handEl.innerHTML = (state.myHand || []).map(renderCard).join('') || '<div class="deal-hand-empty"><strong>手牌为空</strong><small>轮到你时将摸取 5 张牌</small></div>';
        renderProperties(mine);
        renderCommand();
        renderChoiceOverlay();
        renderLedger();
        renderHistory();
        renderEvent();
        scheduleActionPresentation();
    }

    function renderLedger() {
        $('bankLedger').innerHTML = (state.players || []).map(player => `<section class="deal-bank-account"><header><strong>${escapeHtml(player.name)}</strong><span>${player.bankValue || 0}M · ${(player.bank || []).length} 张</span></header><div>${(player.bank || []).map(card => `<article class="deal-ledger-card"><small>${escapeHtml(cardLabel(card))}</small><strong>${escapeHtml(card.name)}</strong><b>${card.value || 0}M</b></article>`).join('') || '<em>银行为空</em>'}</div></section>`).join('');
        $('discardLedger').innerHTML = (state.discard || []).map(card => `<article class="deal-ledger-card"><small>${escapeHtml(cardLabel(card))}</small><strong>${escapeHtml(card.name)}</strong><b>${card.value || 0}M</b></article>`).join('') || '<em>弃牌堆为空</em>';
    }

    function renderHistory() {
        const entries = (state.actionLog || []).slice(-5).reverse();
        historyEl.innerHTML = entries.length
            ? entries.map((message, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(message)}</span></p>`).join('')
            : '<div class="deal-history-empty">本局的公开行动会记录在这里</div>';
    }

    function phaseText() {
        if (state.status === 'ended') return '游戏结束';
        if (state.pendingDebt?.payerId === state.myId) return '支付资产';
        if (state.pendingAction?.responsePlayerId === state.myId) return '回应行动';
        if (state.phase === 'draw') return '请先摸牌';
        if (state.phase === 'discard') return '弃到 7 张';
        return state.myIsCurrentTurn ? '行动阶段' : '等待对手';
    }

    function eventText() {
        const pending = state.pendingAction;
        if (state.myPendingDoubleRent && state.myIsCurrentTurn) return `双倍租金已激活（×${state.myRentMultiplier || 2}），现在必须打出租金牌`;
        if (state.pendingDebt?.payerId === state.myId) return `请向 ${state.pendingDebt.creditorName || '对手'} 支付 ${state.pendingDebt.amount}M`;
        if (pending?.responsePlayerId === state.myId) {
            if ((pending.noCount || 0) % 2 === 1 && pending.actorId === state.myId) return `${pending.targetName} 使用了“做出反对”，你可以反制`;
            return `${pending.actorName} 对你使用${actionName(pending.type)}`;
        }
        if (pending) return `等待 ${pending.responsePlayerName || pending.targetName} 回应${actionName(pending.type)}`;
        if (state.status === 'ended') return `${state.winner?.name || '玩家'}完成了三组地产`;
        return state.myIsCurrentTurn ? (selectedCard() ? '继续配置这张牌的动作' : '选择一张手牌开始行动') : `等待 ${state.currentTurnName || '对手'} 操作`;
    }

    function renderEvent() {
        const interaction = state.interaction;
        eventEl.classList.toggle('is-public-stage', Boolean(interaction?.card));
        eventEl.innerHTML = interaction?.card ? renderPublicInteraction(interaction) : `<span class="deal-event-plain">${escapeHtml(eventText())}</span>`;
    }

    function renderPublicInteraction(interaction) {
        const actor = playerName(interaction.actorId, interaction.actorName);
        const currentTarget = playerName(interaction.currentTargetId, interaction.currentTargetName);
        const cardName = interaction.card?.name || actionName(interaction.type);
        const copy = interactionCopy(interaction, actor, currentTarget, cardName);
        const doubleCards = Array.from({ length: Math.min(2, interaction.doubleRentCount || 0) }, (_, index) => publicCardMarkup({ kind: 'action', action: 'doubleRent', name: '双倍租金', value: 1 }, `deal-support-card is-support-${index + 1}`)).join('');
        const noCards = (interaction.noChain || []).map((entry, index) => publicCardMarkup({ kind: 'action', action: 'justSayNo', name: '做出反对', value: 4 }, 'deal-no-card', `--no-index:${index}`)).join('');
        const targets = (interaction.targetIds || []).map((id, index) => {
            const result = (interaction.results || []).find(item => item.targetId === id);
            const active = id === interaction.currentTargetId;
            return `<span class="${active ? 'is-active' : ''} ${result ? `is-${result.outcome}` : ''}"><i>${index + 1}</i>${escapeHtml(playerName(id, interaction.targetNames?.[index]))}</span>`;
        }).join('');
        const transfer = activeTransfer ? `<em class="deal-transfer-badge">${activeTransfer.kind === 'payment' ? `${activeTransfer.amount || 0}M 资产转移` : activeTransfer.kind === 'swap' ? '地产互换中' : '地产转移中'}</em>` : '';
        return `<div class="deal-public-interaction" data-interaction-id="${Number(interaction.interactionId) || 0}">
            <div class="deal-public-route"><span>${escapeHtml(actor)}<i>→</i><strong>${escapeHtml(currentTarget || '公共牌区')}</strong></span>${interaction.queueTotal > 1 ? `<small>${Math.min((interaction.queueIndex ?? 0) + 1, interaction.queueTotal)} / ${interaction.queueTotal} 位对手</small>` : ''}</div>
            <div class="deal-public-card-stack" data-role="publicCardStack">${doubleCards}${publicCardMarkup(interaction.card, 'deal-main-public-card', '', 'publicCard')}${noCards}${transfer}</div>
            <div class="deal-public-copy"><span>${escapeHtml(copy.label)}</span><strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(copy.detail)}</p><small>${escapeHtml(copy.status)}</small></div>
            ${targets ? `<div class="deal-target-queue">${targets}</div>` : ''}
        </div>`;
    }

    function publicCardMarkup(card, extraClass = '', inlineStyle = '', role = '') {
        if (!card) return '';
        const actionClass = card.action ? `action-${escapeHtml(card.action)}` : '';
        return `<article class="deal-card deal-public-card card-${escapeHtml(card.kind)} ${actionClass} ${extraClass}" ${role ? `data-role="${role}"` : ''} ${inlineStyle ? `style="${inlineStyle}"` : ''} aria-label="${escapeHtml(card.name || actionName(card.action))}">${cardVisualMarkup(card)}<span class="deal-card-wash" aria-hidden="true"></span><small>${escapeHtml(cardLabel(card))}</small><strong>${escapeHtml(card.name || actionName(card.action))}</strong>${cardSwatches(card)}<b>${card.value || 0}M</b></article>`;
    }

    function interactionCopy(interaction, actor, target, cardName) {
        const amount = interaction.amount ? `${interaction.amount}M` : '';
        const color = interaction.color ? COLOR_LABELS[interaction.color] || interaction.color : '';
        if (interaction.stage === 'response') return { label: '公开行动', title: `${actor}对${target}使用${cardName}`, detail: [amount, color].filter(Boolean).join(' · ') || '这张行动牌已经送达目标。', status: `等待${target}接受或使用“做出反对”` };
        if (interaction.stage === 'no_response') {
            const last = interaction.noChain?.[interaction.noChain.length - 1];
            return { label: '反制升级', title: `${last?.playerName || '玩家'}打出“做出反对”`, detail: `${interaction.noCount || 1} 张“做出反对”已叠放在${cardName}上。`, status: `等待${playerName(interaction.responsePlayerId, interaction.responsePlayerName)}决定是否反制` };
        }
        if (interaction.stage === 'payment') return { label: '资产结算', title: `${target}需向${actor}支付${amount}`, detail: '由欠款人自行选择银行牌或地产，不找零。', status: '等待资产选择完成' };
        if (interaction.outcome === 'win') return { label: '三组完成', title: `${playerName(interaction.winnerId)}建成地产帝国`, detail: interaction.message || '第三个完整地产组已经完成。', status: '游戏进入最终结算' };
        if (interaction.outcome === 'armed') return { label: '租金加倍', title: `${actor}已激活 x${interaction.rentMultiplier || 2} 租金`, detail: '下一张租金牌将获得倍率加成。', status: '等待紧接打出租金牌' };
        if (interaction.outcome === 'draw') return { label: '公开行动', title: `${actor}使用通行证`, detail: '从摸牌堆获得两张新牌。', status: '行动已结算' };
        const cancelled = (interaction.results || []).length && (interaction.results || []).every(result => ['cancelled', 'skipped'].includes(result.outcome));
        return { label: cancelled ? '行动取消' : '结算完成', title: cancelled ? `${cardName}未能生效` : `${cardName}已结算`, detail: interaction.message || '牌桌状态已经更新。', status: interaction.queueTotal > 1 ? '所有目标均已处理' : '本次行动结束' };
    }

    function playerName(id, fallback = '') {
        return (state?.players || []).find(player => player.id === id)?.name || fallback || '玩家';
    }

    function scheduleActionPresentation() {
        cancelAnimationFrame(actionLayoutFrame);
        layoutActionPresentation();
        actionLayoutFrame = requestAnimationFrame(layoutActionPresentation);
    }

    function layoutActionPresentation() {
        const interaction = state?.interaction;
        const card = $('publicCard');
        if (card && interaction?.interactionId === animateInteractionId) {
            const source = playerAnchor(interaction.actorId);
            const cardRect = card.getBoundingClientRect();
            const sourceRect = source?.getBoundingClientRect();
            const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
            const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight;
            card.style.setProperty('--deal-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`);
            card.style.setProperty('--deal-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`);
            void card.offsetWidth;
            card.classList.add('is-entering');
            animateInteractionId = null;
        }
        updateActionLinks();
    }

    function updateActionLinks() {
        const svg = $('actionLinks');
        const interaction = state?.interaction;
        if (!interaction || state.status === 'ended') {
            svg.classList.remove('has-action', 'has-response');
            return;
        }
        const actor = playerAnchor(interaction.actorId);
        const target = playerAnchor(interaction.currentTargetId);
        if (actor && target && interaction.actorId !== interaction.currentTargetId) {
            drawLink(actor, target, 'action');
            svg.classList.add('has-action');
        } else {
            svg.classList.remove('has-action');
        }

        let responseSourceId = null;
        let responseTargetId = null;
        if (activeTransfer?.fromId && activeTransfer?.toId) {
            responseSourceId = activeTransfer.fromId;
            responseTargetId = activeTransfer.toId;
        } else if (interaction.stage === 'no_response' && interaction.lastNoBy && interaction.responsePlayerId) {
            responseSourceId = interaction.lastNoBy;
            responseTargetId = interaction.responsePlayerId;
        } else if (interaction.stage === 'payment' && interaction.payerId && interaction.creditorId) {
            responseSourceId = interaction.payerId;
            responseTargetId = interaction.creditorId;
        }
        const responseSource = playerAnchor(responseSourceId);
        const responseTarget = playerAnchor(responseTargetId);
        if (responseSource && responseTarget && responseSourceId !== responseTargetId) {
            drawLink(responseSource, responseTarget, 'response');
            svg.classList.add('has-response');
        } else {
            svg.classList.remove('has-response');
        }
    }

    function drawLink(source, target, kind) {
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = window.innerWidth;
        const height = window.innerHeight;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, width - 12);
        const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, height - 12);
        const targetX = clamp(targetRect.left + targetRect.width / 2, 12, width - 12);
        const targetY = clamp(targetRect.top + targetRect.height / 2, 12, height - 12);
        const bend = kind === 'response' ? 1 : -1;
        const middleX = (sourceX + targetX) / 2 + bend * Math.min(62, Math.abs(targetY - sourceY) * .1);
        const middleY = (sourceY + targetY) / 2 + bend * Math.min(70, Math.max(22, Math.abs(targetX - sourceX) * .11));
        const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`;
        svgViewBox(width, height);
        $(`${kind}LinkGlow`).setAttribute('d', path);
        $(`${kind}LinkStroke`).setAttribute('d', path);
        $(`${kind}LinkSeal`).setAttribute('cx', String(targetX));
        $(`${kind}LinkSeal`).setAttribute('cy', String(targetY));
    }

    function svgViewBox(width, height) {
        $('actionLinks').setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    function playerAnchor(playerId) {
        if (!playerId) return null;
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function renderOpponent(player) {
        const targetable = needsPlayerTarget(selectedCard());
        const interaction = state.interaction;
        const groups = playerGroups(player).map(group => `<i class="deal-mini-set color-${escapeHtml(group.color)} ${highlightedGroups.has(`${player.id}:${group.id}`) ? 'is-newly-complete' : ''}" title="${escapeHtml(COLOR_LABELS[group.color] || group.color)}第${groupNumber(player, group)}组">${group.cards.length}/${sizeFor(group.color)}${group.isComplete ? ' ✓' : ''}</i>`).join('');
        const cardBacks = Array.from({ length: Math.min(player.handCount || 0, 4) }, (_, index) => `<i style="--deal-card-order:${index}" aria-hidden="true"></i>`).join('');
        return `<button type="button" class="deal-opponent ${player.isCurrentTurn ? 'is-current' : ''} ${targetId === player.id ? 'is-targeted' : ''} ${targetable ? 'is-selectable' : ''} ${player.isOnline === false ? 'is-offline' : ''} ${interaction?.actorId === player.id ? 'is-action-source' : ''} ${interaction?.currentTargetId === player.id ? 'is-action-target' : ''} ${interaction?.responsePlayerId === player.id ? 'is-response-seat' : ''}" data-target-id="${escapeHtml(player.id)}" data-player-id="${escapeHtml(player.id)}" aria-pressed="${targetId === player.id}"><span class="deal-opponent-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span class="deal-opponent-copy"><strong>${escapeHtml(player.name)}</strong><small>${player.isOnline === false ? '已离线' : player.isCurrentTurn ? '正在行动' : `${player.completedSets} / 3 组完成`}</small></span><span class="deal-hidden-hand" aria-label="${player.handCount || 0} 张隐藏手牌">${cardBacks}<b>${player.handCount || 0}</b></span><span class="deal-opponent-bank"><small>银行</small><b>${player.bankValue || 0}M</b></span><span class="deal-opponent-sets">${groups || '<em>暂无地产</em>'}</span></button>`;
    }

    function renderCard(card, index) {
        const swatches = cardSwatches(card);
        return `<button type="button" class="deal-card card-${escapeHtml(card.kind)} ${card.action ? `action-${escapeHtml(card.action)}` : ''} ${selected === index ? 'is-selected' : ''}" data-card-index="${index}" aria-pressed="${selected === index}" title="选择${escapeHtml(card.name)}">${cardVisualMarkup(card)}<span class="deal-card-wash" aria-hidden="true"></span><small>${escapeHtml(cardLabel(card))}</small><strong>${escapeHtml(card.name)}</strong>${swatches}<b>${card.value || 0}M</b></button>`;
    }

    function cardVisualMarkup(card) {
        if (card.kind === 'money') return `<span class="deal-card-visual is-money" aria-hidden="true"><i>${card.value || 0}</i><em>现金牌</em></span>`;
        if (card.kind === 'property') {
            const rents = (card.rent || []).map((rent, index) => `<i><span>${index + 1}</span><b>${rent}M</b></i>`).join('');
            return `<span class="deal-card-visual is-property" style="--property-color:${COLOR_HEX[card.color] || '#99866e'}" aria-hidden="true"><em>地产契约</em><span class="deal-rent-ladder">${rents}</span></span>`;
        }
        if (card.kind === 'property_wild') return '<span class="deal-card-visual is-wild" aria-hidden="true"><i>全</i><em>万能地产</em></span>';
        if (card.kind === 'rent') return '<span class="deal-card-visual is-rent" aria-hidden="true"><i>租</i><em>收取租金</em></span>';
        const [mark, caption] = ACTION_MARKS[card.action] || ['◆', '行动牌'];
        return `<span class="deal-card-visual is-action" aria-hidden="true"><span class="deal-action-motif"><b></b><b></b><b></b></span><i>${escapeHtml(mark)}</i><em>${escapeHtml(caption)}</em></span>`;
    }

    function renderProperties(mine) {
        if (!mine) return;
        const groups = playerGroups(mine);
        propertiesEl.innerHTML = groups.length ? groups.map(group => {
            const { color, cards } = group;
            const complete = group.isComplete ?? completeGroup(cards, color);
            const rent = groupRent(group);
            const chips = cards.map(card => {
                const content = `<i class="color-${escapeHtml(color)}"></i><small>${card.kind === 'property_wild' ? '万能地产' : '地产'}</small><strong>${escapeHtml(card.name)}</strong><b>${card.value || 0}M</b>`;
                if (state.availableActions?.canMoveProperty) return `<button class="deal-property-chip ${card.kind === 'property_wild' ? 'is-wild' : 'is-movable'}" type="button" data-move-card-id="${escapeHtml(card.id)}" data-from-color="${escapeHtml(color)}" data-from-group-id="${escapeHtml(group.id)}" title="调整${escapeHtml(card.name)}的地产组">${content}</button>`;
                return `<span class="deal-property-chip">${content}</span>`;
            }).join('');
            return `<article class="deal-property-group ${complete ? 'is-complete' : ''} ${highlightedGroups.has(`${mine.id}:${group.id}`) ? 'is-newly-complete' : ''}" data-group-id="${escapeHtml(group.id)}"><header><span class="deal-color-dot color-${escapeHtml(color)}"></span><div><strong>${escapeHtml(COLOR_LABELS[color] || color)} · 第${groupNumber(mine, group)}组</strong><small>${cards.length} / ${sizeFor(color)} 张</small></div><b>${rent}M<small>租金</small></b></header><div class="deal-property-stack">${chips}</div><footer>${complete ? '<span>完整地产</span>' : `<span>还差 ${Math.max(0, sizeFor(color) - cards.length)} 张</span>`}${group.house || group.hotel ? `<em class="deal-buildings">${group.house ? '房子 +3M' : ''}${group.house && group.hotel ? ' · ' : ''}${group.hotel ? '酒店 +4M' : ''}</em>` : ''}</footer></article>`;
        }).join('') : '<div class="deal-properties-empty"><span>0 / 3</span><strong>还没有地产</strong><small>打出地产牌，完成三个不同颜色的组</small></div>';
    }

    function renderCommand() {
        const card = selectedCard();
        const actions = state.availableActions || {};
        if (state.pendingDebt?.payerId === state.myId) return renderPaymentCommand();
        if (state.pendingAction?.responsePlayerId === state.myId) return renderResponseCommand();
        if (moveCardId) return renderMoveCommand();
        commandTitleEl.textContent = card ? card.name : '选择一张牌';
        commandHintEl.textContent = card ? actionHint(card) : '选中手牌后，这里会显示合法动作、目标和费用。';
        if (actions.canDiscard) {
            commandTitleEl.textContent = card ? `弃掉：${card.name}` : '手牌超过七张';
            commandHintEl.textContent = `还需弃掉 ${Math.max(0, (state.myHand?.length || 0) - 7)} 张手牌才能结束回合。`;
            commandEl.innerHTML = card ? '<button class="deal-primary" data-action="discardCard" type="button">确认弃掉这张牌</button><button class="deal-secondary" data-action="clearSelection" type="button">重新选择</button>' : '<span class="deal-command-note">请从下方手牌选择要弃掉的牌。</span>';
            return;
        }
        if (!card || !actions.canPlay) {
            commandEl.innerHTML = actions.canEndTurn ? `<button class="deal-secondary" data-action="endTurn" type="button">结束回合</button>` : '<span class="deal-command-note">等待回合开始或摸牌</span>';
            return;
        }
        if (card.kind === 'money') commandEl.innerHTML = `<button class="deal-primary" data-action="playBank" type="button">存入银行 <span>+${card.value || 0}M</span></button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`;
        else if (card.kind === 'property' || card.kind === 'property_wild') renderPropertyCommand(card);
        else if (card.kind === 'rent') renderRentCommand(card);
        else renderActionCommand(card);
    }

    function renderPaymentCommand() {
        commandTitleEl.textContent = '支付资产';
        commandHintEl.textContent = `选择交给 ${state.pendingDebt.creditorName || '对手'} 的银行牌或地产牌。`;
        const options = state.myPaymentOptions || [];
        const selectedValue = options.filter(item => paymentIds.includes(item.id)).reduce((sum, item) => sum + item.value, 0);
        const totalValue = options.reduce((sum, item) => sum + item.value, 0);
        const canPay = selectedValue >= state.pendingDebt.amount || totalValue <= selectedValue;
        commandEl.innerHTML = `<div class="deal-debt-card"><strong>${state.pendingDebt.amount}M</strong><span>已选 ${selectedValue}M · 可用 ${totalValue}M</span></div><div class="deal-payment-list">${options.map(item => `<button type="button" class="deal-payment ${paymentIds.includes(item.id) ? 'is-selected' : ''}" data-payment-id="${escapeHtml(item.id)}"><span>${item.zone === 'bank' ? '银行' : `${COLOR_LABELS[item.color] || item.color}地产`}</span><strong>${escapeHtml(item.name)}</strong><b>${item.value}M</b></button>`).join('') || '<span class="deal-command-note">没有可交付资产，确认后债务将结清。</span>'}</div><button class="deal-primary" data-action="payDebt" type="button" ${canPay ? '' : 'disabled'}>确认支付</button>`;
    }

    function renderResponseCommand() {
        const pending = state.pendingAction;
        const counteringNo = (pending.noCount || 0) % 2 === 1 && pending.actorId === state.myId;
        const ready = decisionReady();
        commandTitleEl.textContent = counteringNo ? '对方做出了反对' : `回应${actionName(pending.type)}`;
        commandHintEl.textContent = ready ? (counteringNo ? `${pending.targetName} 正在取消你的行动。` : `${pending.actorName} 的行动等待你的回应。`) : '先查看中央的行动牌和反制关系。';
        const noCards = (state.myHand || []).map((item, index) => item.action === 'justSayNo' ? `<button class="deal-secondary" data-action="justSayNo" data-card-index="${index}" type="button" ${ready ? '' : 'disabled'}>打出“做出反对”</button>` : '').join('');
        commandEl.innerHTML = `${ready ? '' : '<span class="deal-reaction-wait">行动送达中</span>'}<div class="deal-response-card"><strong>${escapeHtml(actionName(pending.type))}</strong><span>${pending.amount ? `${pending.amount}M` : '地产行动'}${pending.color ? ` · ${COLOR_LABELS[pending.color]}` : ''}</span></div><button class="deal-primary" data-action="acceptAction" type="button" ${ready ? '' : 'disabled'}>${counteringNo ? '不反制，取消本次' : '接受行动'}</button>${noCards || '<span class="deal-command-note">你的手牌中没有“做出反对”</span>'}`;
    }

    function renderMoveCommand() {
        const moving = findMyProperty(moveCardId, moveFromColor);
        commandTitleEl.textContent = '调整地产分组';
        commandHintEl.textContent = moving ? `${moving.name} 可在自己的回合移到另一合法地产组。` : '请选择要调整的地产。';
        commandEl.innerHTML = `<div class="deal-command-note">当前：${escapeHtml(COLOR_LABELS[moveFromColor] || moveFromColor)}第 ${groupNumber(me(), playerGroups(me()).find(group => group.id === moveFromGroupId) || { color: moveFromColor })} 组${moveToColor ? `　→　${escapeHtml(COLOR_LABELS[moveToColor] || moveToColor)}` : ''}</div><button class="deal-primary" data-action="openMoveChoice" type="button">选择目标地产组</button><button class="deal-secondary" data-action="clearSelection" type="button">取消调整</button>`;
    }

    function renderPropertyCommand(card) {
        commandEl.innerHTML = `<div class="deal-command-note">${targetColor && targetGroupId ? `已选 ${escapeHtml(COLOR_LABELS[targetColor] || targetColor)}${targetGroupId === 'new' ? '新地产组' : '现有地产组'}` : '选择颜色及具体地产组；完整组不会再接收多余地产。'}</div><button class="deal-primary" data-action="openPropertyChoice" type="button">选择地产组并放置</button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`;
    }

    function renderRentCommand(card) {
        const groups = rentGroups(card);
        const chargeAll = Array.isArray(card.colors) && card.colors.length > 0;
        const selectedGroup = groups.find(group => group.id === targetGroupId);
        const summary = !groups.length
            ? '你还没有这张租金牌支持且能产生租金的地产。'
            : selectedGroup
                ? `${escapeHtml(COLOR_LABELS[selectedGroup.color] || selectedGroup.color)}第${groupNumber(me(), selectedGroup)}组 · ${groupRent(selectedGroup)}M${chargeAll ? ' · 向所有对手' : targetId ? ` · 向${escapeHtml(state.players.find(player => player.id === targetId)?.name || '所选玩家')}` : ''}`
                : chargeAll ? '先选择一组地产，随后向所有对手依次收取。' : '在浮层内选择一组地产和一名玩家。';
        commandEl.innerHTML = `<div class="deal-command-note">${summary}</div><button class="deal-primary" data-action="openRentChoice" type="button" ${groups.length ? '' : 'disabled'}>选择地产组并收租</button>${bankButton(card)}`;
    }

    function renderChoiceOverlay() {
        const card = selectedCard();
        let choices = [];
        let title = '';
        let hint = '';
        let confirmAction = '';
        let confirmText = '';
        let showTargets = false;
        if (choiceMode === 'property' && ['property', 'property_wild'].includes(card?.kind) && state.availableActions?.canPlay) {
            const colors = card.kind === 'property' ? [card.color] : card.colors || [];
            choices = colors.flatMap(color => [...playerGroups(me(), color).filter(group => group.cards.length < sizeFor(color)).map(group => ({ color, groupId: group.id, group })), { color, groupId: 'new', group: null }]);
            title = '选择地产归属颜色';
            hint = `${card.name} 放置后归入所选独立地产组；也可以另开同色新组。`;
            confirmAction = 'confirmPropertyChoice';
            confirmText = '确认放置地产';
        } else if (choiceMode === 'rent' && card?.kind === 'rent' && state.availableActions?.canPlay) {
            choices = rentGroups(card).map(group => ({ color: group.color, groupId: group.id, group }));
            const chargeAll = Array.isArray(card.colors) && card.colors.length > 0;
            title = '选择本次收租颜色';
            hint = chargeAll ? '所选颜色决定租金数额，这张双色租金会向所有对手收取。' : '所选颜色决定租金数额；任何租金还要指定一名收租对象。';
            confirmAction = 'confirmRentChoice';
            confirmText = '确认发起收租';
            showTargets = !chargeAll;
        } else if (choiceMode === 'move' && moveCardId && state.availableActions?.canMoveProperty) {
            const moving = findMyProperty(moveCardId, moveFromColor);
            const colors = moving?.kind === 'property' ? [moveFromColor] : moving?.colors || [];
            choices = colors.flatMap(color => [...playerGroups(me(), color).filter(group => group.id !== moveFromGroupId && group.cards.length < sizeFor(color)).map(group => ({ color, groupId: group.id, group })), { color, groupId: 'new', group: null }]);
            title = '调整地产所在组';
            hint = `${moving?.name || '地产'} 当前属于${COLOR_LABELS[moveFromColor] || moveFromColor}，调整不计入每回合三次出牌。若原完整组被拆散，其建筑会转入你的银行。`;
            confirmAction = 'confirmMoveChoice';
            confirmText = '确认切换颜色';
        } else {
            choiceMode = null;
        }
        choiceOverlay.classList.toggle('is-hidden', !choiceMode);
        if (!choiceMode) return;
        $('choiceTitle').textContent = title;
        $('choiceHint').textContent = hint;
        $('choiceTargets').innerHTML = showTargets ? `<span>收租对象</span><div>${targetPlayers().map(player => `<button type="button" class="deal-choice-target ${targetId === player.id ? 'is-selected' : ''}" data-choice-target-id="${escapeHtml(player.id)}"><i>${escapeHtml(player.name.slice(0, 1))}</i><strong>${escapeHtml(player.name)}</strong><small>${player.bankValue}M · ${player.completedSets} 套地产</small></button>`).join('')}</div>` : '';
        $('choiceGrid').innerHTML = choices.map(choice => {
            const isRent = choiceMode === 'rent';
            const selectedChoice = choiceMode === 'move' ? moveToColor === choice.color && moveToGroupId === choice.groupId : targetColor === choice.color && targetGroupId === choice.groupId;
            return `<button type="button" class="deal-choice-card ${selectedChoice ? 'is-selected' : ''}" data-choice-color="${escapeHtml(choice.color)}" data-choice-group-id="${escapeHtml(choice.groupId)}"><i class="color-${escapeHtml(choice.color)}"></i><b>${escapeHtml(COLOR_LABELS[choice.color] || choice.color)}</b><span>${isRent ? `${groupRent(choice.group)}M 租金` : choice.group ? `${choice.group.cards.length} / ${sizeFor(choice.color)} 张` : '新地产组'}</span><small>${choice.group ? `第${groupNumber(me(), choice.group)}组` : '另开一组'}</small></button>`;
        }).join('') || '<div class="deal-choice-empty">当前没有合法的颜色可选</div>';
        const selectedGroup = choiceMode === 'move' ? moveToGroupId : targetGroupId;
        const canConfirm = Boolean(selectedGroup && (!showTargets || targetId));
        $('choiceActions').innerHTML = `<button class="deal-choice-cancel" data-action="closeChoice" type="button">返回</button><button class="deal-choice-confirm" data-action="${confirmAction}" type="button" ${canConfirm ? '' : 'disabled'}>${confirmText}<span>→</span></button>`;
    }

    function renderActionCommand(card) {
        if (card.action === 'dealBreaker') commandEl.innerHTML = `<label class="deal-field">夺取对象<select data-field="targetId"><option value="">请选择玩家</option>${targetPlayers().map(player => `<option value="${escapeHtml(player.id)}" ${targetId === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></label><label class="deal-field">完整地产组<select data-field="targetGroupId"><option value="">请选择完整组</option>${targetCompleteGroups().map(group => `<option value="${escapeHtml(group.id)}" data-group-color="${escapeHtml(group.color)}" ${targetGroupId === group.id ? 'selected' : ''}>${escapeHtml(COLOR_LABELS[group.color] || group.color)} · 第${groupNumber(state.players.find(player => player.id === targetId), group)}组${group.house || group.hotel ? ' · 含建筑' : ''}</option>`).join('')}</select></label><button class="deal-primary" data-action="playDealBreaker" type="button" ${targetId && targetGroupId ? '' : 'disabled'}>夺取整组地产</button>${bankButton(card)}`;
        else if (card.action === 'debtCollector') commandEl.innerHTML = `<label class="deal-field">债务对象<select data-field="targetId"><option value="">请选择玩家</option>${targetPlayers().map(player => `<option value="${escapeHtml(player.id)}" ${targetId === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></label><button class="deal-primary" data-action="playAction" type="button" ${targetId ? '' : 'disabled'}>收取 5M</button>${bankButton(card)}`;
        else if (card.action === 'slyDeal') commandEl.innerHTML = `<label class="deal-field">交易对象<select data-field="targetId"><option value="">请选择玩家</option>${targetPlayers().map(player => `<option value="${escapeHtml(player.id)}" ${targetId === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></label><label class="deal-field">对手未成组地产<select data-field="targetPropertyId"><option value="">请选择地产</option>${targetProperties().map(item => `<option value="${escapeHtml(item.id)}" ${targetPropertyId === item.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(COLOR_LABELS[item.color] || item.color)}第${item.groupNumber}组</option>`).join('')}</select></label><button class="deal-primary" data-action="playAction" type="button" ${targetId && targetPropertyId ? '' : 'disabled'}>偷取地产</button>${bankButton(card)}`;
        else if (card.action === 'forcedDeal') commandEl.innerHTML = `<label class="deal-field">交换对象<select data-field="targetId"><option value="">请选择玩家</option>${targetPlayers().map(player => `<option value="${escapeHtml(player.id)}" ${targetId === player.id ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></label><label class="deal-field">对手未成组地产<select data-field="targetPropertyId"><option value="">请选择地产</option>${targetProperties().map(item => `<option value="${escapeHtml(item.id)}" ${targetPropertyId === item.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(COLOR_LABELS[item.color] || item.color)}第${item.groupNumber}组</option>`).join('')}</select></label><label class="deal-field">我的未成组地产<select data-field="ownPropertyId"><option value="">请选择地产</option>${ownProperties().map(item => `<option value="${escapeHtml(item.id)}" ${ownPropertyId === item.id ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(COLOR_LABELS[item.color] || item.color)}第${item.groupNumber}组</option>`).join('')}</select></label><button class="deal-primary" data-action="playAction" type="button" ${targetId && targetPropertyId && ownPropertyId ? '' : 'disabled'}>交换地产</button>${bankButton(card)}`;
        else if (card.action === 'house' || card.action === 'hotel') commandEl.innerHTML = `<label class="deal-field">地产组<select data-field="targetGroupId"><option value="">请选择可建设的完整组</option>${buildableGroups(card).map(group => `<option value="${escapeHtml(group.id)}" data-group-color="${escapeHtml(group.color)}" ${targetGroupId === group.id ? 'selected' : ''}>${escapeHtml(COLOR_LABELS[group.color] || group.color)} · 第${groupNumber(me(), group)}组${group.house ? ' · 已有房子' : ''}</option>`).join('')}</select></label><button class="deal-primary" data-action="playAction" type="button" ${targetGroupId ? '' : 'disabled'}>放置${escapeHtml(card.name)}</button>${bankButton(card)}`;
        else if (['passGo', 'doubleRent', 'birthday'].includes(card.action)) commandEl.innerHTML = `<button class="deal-primary" data-action="playAction" type="button">使用${escapeHtml(card.name)}</button>${bankButton(card)}`;
        else commandEl.innerHTML = `<span class="deal-command-note">“做出反对”只能在回应行动时使用。</span>${bankButton(card)}`;
    }

    function bankButton(card) { return `<button class="deal-secondary" data-action="playBank" type="button">存入银行 <span>+${card.value || 0}M</span></button><button class="deal-secondary" data-action="clearSelection" type="button">取消选择</button>`; }
    function targetPlayers() { return (state.players || []).filter(player => player.id !== state.myId && player.isOnline !== false); }
    function needsPlayerTarget(card) { return Boolean(card && (card.kind === 'rent' && !(Array.isArray(card.colors) && card.colors.length)) || ['dealBreaker', 'debtCollector', 'slyDeal', 'forcedDeal'].includes(card?.action)); }
    function targetCompleteGroups() { const target = state.players.find(player => player.id === targetId); return playerGroups(target).filter(group => group.isComplete ?? completeGroup(group.cards, group.color)); }
    function groupProperties(player) { return playerGroups(player).filter(group => !(group.isComplete ?? completeGroup(group.cards, group.color))).flatMap(group => group.cards.map(card => ({ ...card, color: group.color, groupId: group.id, groupNumber: groupNumber(player, group) }))); }
    function targetProperties() { return groupProperties(state.players.find(player => player.id === targetId)); }
    function ownProperties() { return groupProperties(me()); }
    function buildableGroups(card) { return playerGroups(me()).filter(group => !['railroad', 'utility'].includes(group.color) && (group.isComplete ?? completeGroup(group.cards, group.color)) && (card.action === 'house' ? !group.house : Boolean(group.house) && !group.hotel)); }
    function rentGroups(card) { const allowed = Array.isArray(card.colors) && card.colors.length ? card.colors : COLORS; return playerGroups(me()).filter(group => allowed.includes(group.color) && groupRent(group) > 0); }
    function rentEstimateLegacy(color, player) { const cards = player?.properties?.[color] || []; if (!cards.length || (cards.length === 1 && cards[0].allColor)) return 0; const table = state?.rules?.rentTable?.[color] || []; const base = table[Math.min(cards.length, table.length) - 1] || 0; const bonus = ['railroad', 'utility'].includes(color) ? 0 : (player?.houses?.[color] || 0) * 3 + (player?.hotels?.[color] || 0) * 4; return base + bonus; }
    function findMyProperty(id, color) { return playerGroups(me(), color).flatMap(group => group.cards).find(card => card.id === id); }
    function cardLabel(card) { if (card.kind === 'money') return '现金'; if (card.kind === 'property') return COLOR_LABELS[card.color] || card.color; if (card.kind === 'property_wild') return card.allColor ? '十色万能' : '双色万能'; if (card.kind === 'rent') return card.colors?.length ? '双色租金' : '任何租金'; return ACTION_LABELS[card.action] || '行动'; }
    function cardSwatches(card) { const colors = card.kind === 'property' ? [card.color] : ['property_wild', 'rent'].includes(card.kind) ? (card.colors?.length ? card.colors : COLORS) : []; return colors.length ? `<i class="deal-card-swatches ${colors.length > 5 ? 'is-many' : ''}">${colors.map(color => `<span class="color-${escapeHtml(color)}"></span>`).join('')}</i>` : ''; }
    function actionName(type) { return type === 'rent' ? '租金' : (ACTION_LABELS[type] || '行动'); }
    function actionHint(card) { if (card.kind === 'money') return '现金牌可以直接放入银行。'; if (card.kind === 'property') return '地产牌放入对应颜色，凑齐三组即可获胜。'; if (card.kind === 'property_wild') return '选择牌面允许的颜色放置；十色万能牌单独不能收租。'; if (card.kind === 'rent') return card.colors?.length ? '双色租金会向所有对手收取。' : '任何租金可指定一名玩家。'; if (card.action === 'dealBreaker') return '接管对手一整组完整地产，包含房子和酒店。'; if (card.action === 'slyDeal') return '从对手未成套地产中盗取一张。'; if (card.action === 'forcedDeal') return '用自己一张未成套地产与对手强制交易。'; if (card.action === 'debtCollector') return '指定一名玩家支付 5M。'; if (card.action === 'birthday') return '所有其他玩家各支付 2M。'; if (card.action === 'passGo') return '摸两张牌。'; if (card.action === 'doubleRent') return '必须和租金牌连续使用，可连续两张形成四倍租金。'; if (card.action === 'house' || card.action === 'hotel') return '为完整彩色地产组增加租金，铁路和公用事业不能加建。'; return '等待对手行动时使用“做出反对”。'; }

    mount.addEventListener('change', event => {
        const field = event.target.dataset.field;
        if (field === 'targetId') { targetId = event.target.value || null; targetColor = null; targetGroupId = null; targetPropertyId = null; render(); }
        if (field === 'targetGroupId') { targetGroupId = event.target.value || null; targetColor = event.target.selectedOptions[0]?.dataset.groupColor || null; render(); }
        if (field === 'targetPropertyId') { targetPropertyId = event.target.value || null; const item = targetProperties().find(property => property.id === targetPropertyId); targetColor = item?.color || null; targetGroupId = item?.groupId || null; render(); }
        if (field === 'ownPropertyId') { ownPropertyId = event.target.value || null; const item = ownProperties().find(property => property.id === ownPropertyId); ownColor = item?.color || null; ownGroupId = item?.groupId || null; render(); }
    }, { signal: controller.signal });

    mount.addEventListener('click', event => {
        if (scenePlaying) {
            event.preventDefault();
            if (event.target.closest('[data-action="skip-victory"]')) hideVictoryScene();
            return;
        }
        if (submissionPending && event.target.closest('[data-action], [data-payment-id], [data-choice-target-id], [data-choice-color], [data-move-card-id], [data-card-index]')) {
            event.preventDefault();
            return;
        }
        const payment = event.target.closest('[data-payment-id]');
        if (payment) { const id = payment.dataset.paymentId; paymentIds = paymentIds.includes(id) ? paymentIds.filter(item => item !== id) : [...paymentIds, id]; render(); return; }
        const choiceTarget = event.target.closest('[data-choice-target-id]');
        if (choiceTarget) { targetId = choiceTarget.dataset.choiceTargetId; render(); return; }
        const choiceColor = event.target.closest('[data-choice-color]');
        if (choiceColor) {
            if (choiceMode === 'move') {
                moveToColor = choiceColor.dataset.choiceColor;
                moveToGroupId = choiceColor.dataset.choiceGroupId;
            } else {
                targetColor = choiceColor.dataset.choiceColor;
                targetGroupId = choiceColor.dataset.choiceGroupId;
            }
            render();
            return;
        }
        const move = event.target.closest('[data-move-card-id]');
        if (move) { selected = null; targetId = null; targetColor = null; targetGroupId = null; moveCardId = move.dataset.moveCardId; moveFromColor = move.dataset.fromColor; moveFromGroupId = move.dataset.fromGroupId; moveToColor = null; moveToGroupId = null; choiceMode = 'move'; render(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && !event.target.closest('[data-action]')) {
            selected = Number(card.dataset.cardIndex);
            targetId = null;
            targetColor = null;
            targetGroupId = null;
            targetPropertyId = null;
            ownColor = null;
            ownGroupId = null;
            ownPropertyId = null;
            paymentIds = [];
            moveCardId = null;
            moveFromColor = null;
            moveFromGroupId = null;
            moveToColor = null;
            moveToGroupId = null;
            const picked = selectedCard();
            choiceMode = picked?.kind === 'rent' ? 'rent' : ['property', 'property_wild'].includes(picked?.kind) ? 'property' : null;
            render();
            return;
        }
        const target = event.target.closest('[data-target-id]');
        if (target && needsPlayerTarget(selectedCard())) { targetId = target.dataset.targetId; targetColor = null; targetGroupId = null; targetPropertyId = null; render(); return; }
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) {
            if (event.target.closest('[data-ui="rules"]')) overlay.classList.remove('is-hidden');
            if (event.target.closest('[data-ui="closeRules"]') || event.target === overlay) overlay.classList.add('is-hidden');
            if (event.target.closest('[data-ui="bank"]') || event.target.closest('[data-ui="discard"]')) ledgerOverlay.classList.remove('is-hidden');
            if (event.target === ledgerOverlay) ledgerOverlay.classList.add('is-hidden');
            if (event.target === choiceOverlay) { choiceMode = null; render(); }
            if (event.target.closest('[data-ui="leave"]')) leaveRoom?.();
            return;
        }
        const index = selected;
        if (action === 'openPropertyChoice') choiceMode = 'property';
        else if (action === 'openRentChoice') choiceMode = 'rent';
        else if (action === 'openMoveChoice') choiceMode = 'move';
        else if (action === 'closeChoice') choiceMode = null;
        else if (action === 'closeLedger') ledgerOverlay.classList.add('is-hidden');
        else if (action === 'confirmPropertyChoice' && index !== null && targetColor && targetGroupId) { submitAction(handAction('playCard', index, { color: targetColor, groupId: targetGroupId })); clearSelection(); }
        else if (action === 'confirmRentChoice' && index !== null && targetColor && targetGroupId) { submitAction(handAction('playCard', index, { targetId, color: targetColor, groupId: targetGroupId })); clearSelection(); }
        else if (action === 'confirmMoveChoice' && moveCardId && moveFromColor && moveFromGroupId && moveToColor && moveToGroupId) { submitAction({ kind: 'moveProperty', cardId: moveCardId, fromColor: moveFromColor, fromGroupId: moveFromGroupId, toColor: moveToColor, toGroupId: moveToGroupId }); clearSelection(); }
        else if (action === 'drawCards' || action === 'endTurn') submitAction({ kind: action });
        else if (action === 'acceptAction' && decisionReady()) submitAction({ kind: action });
        else if (action === 'discardCard' && index !== null) { submitAction(handAction('discardCard', index)); clearSelection(); }
        else if (action === 'payDebt') { submitAction({ kind: 'payDebt', cardIds: paymentIds }); paymentIds = []; }
        else if (action === 'justSayNo' && decisionReady()) { const responseIndex = Number(event.target.closest('[data-card-index]')?.dataset.cardIndex); submitAction(handAction('justSayNo', responseIndex)); }
        else if (action === 'playBank' && index !== null) { submitAction(handAction('playCard', index, { zone: 'bank' })); clearSelection(); }
        else if (action === 'playDealBreaker' && index !== null && targetId && targetGroupId) { submitAction(handAction('playCard', index, { targetId, color: targetColor, groupId: targetGroupId })); clearSelection(); }
        else if (action === 'playAction' && index !== null) { submitAction(handAction('playCard', index, { targetId, targetPropertyId, targetColor, targetGroupId, ownPropertyId, ownColor, ownGroupId, color: targetColor, groupId: targetGroupId })); clearSelection(); }
        else if (action === 'clearSelection') clearSelection();
        render();
    }, { signal: controller.signal });

    function clearSelection() {
        selected = null;
        targetId = null;
        targetColor = null;
        targetGroupId = null;
        targetPropertyId = null;
        ownColor = null;
        ownGroupId = null;
        ownPropertyId = null;
        paymentIds = [];
        moveCardId = null;
        moveFromColor = null;
        moveFromGroupId = null;
        moveToColor = null;
        moveToGroupId = null;
        choiceMode = null;
    }

    document.addEventListener('keydown', event => {
        if (scenePlaying) {
            if (event.key === 'Escape') hideVictoryScene();
            return;
        }
        if (event.key !== 'Escape') return;
        if (!choiceOverlay.classList.contains('is-hidden')) { choiceMode = null; render(); }
        else if (!ledgerOverlay.classList.contains('is-hidden')) ledgerOverlay.classList.add('is-hidden');
        else if (!overlay.classList.contains('is-hidden')) overlay.classList.add('is-hidden');
    }, { signal: controller.signal });
    window.addEventListener('resize', scheduleActionPresentation, { signal: controller.signal });
    mount.addEventListener('scroll', scheduleActionPresentation, { capture: true, signal: controller.signal });

    return {
        gameType: 'monopolydeal',
        handleMessage(message) {
            if (message.state) {
                setSubmissionPending(false);
                const previous = state;
                const previousInteractionId = state?.interaction?.interactionId ?? null;
                state = message.state;
                const interactionId = state.interaction?.interactionId ?? null;
                if (previous && interactionId && interactionId !== previousInteractionId) animateInteractionId = interactionId;
                updateDecisionWindow(previous, state);
                updateGroupHighlights(previous, state);
                updateTransferPresentation(previous, state);
                if (selected !== null && !state.myHand[selected]) selected = null;
                const valid = new Set((state.myPaymentOptions || []).map(item => item.id));
                paymentIds = paymentIds.filter(id => valid.has(id));
                if (state.myPendingDoubleRent && state.availableActions?.canPlay && selected === null) {
                    const rentIndex = (state.myHand || []).findIndex(card => card.kind === 'rent' && rentGroups(card).length > 0);
                    if (rentIndex >= 0) {
                        selected = rentIndex;
                        choiceMode = 'rent';
                    }
                }
                render();
                if (previous && previous.status !== 'ended' && state.status === 'ended') showVictoryScene(state);
            }
            if (message.type === 'error') {
                setSubmissionPending(false);
                addLog(message.message || '操作失败', 'error');
            }
        },
        destroy() {
            clearTimeout(decisionTimer);
            clearTimeout(transferTimer);
            clearTimeout(groupHighlightTimer);
            clearTimeout(victoryTimer);
            cancelAnimationFrame(actionLayoutFrame);
            controller.abort();
            document.body.classList.remove('is-monopolydeal-view');
            choiceLink.remove();
            link.remove();
            mount.innerHTML = '';
        },
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
