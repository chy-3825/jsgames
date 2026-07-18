const CARD_NAMES = {
    1: '侍卫',
    2: '神父',
    3: '男爵',
    4: '侍女',
    5: '王子',
    6: '国王',
    7: '女伯爵',
    8: '公主',
};

const CARD_RULES = [
    { value: 1, count: 5, name: '侍卫', effect: '猜一名玩家的手牌，不能猜侍卫；猜中则对方出局。' },
    { value: 2, count: 2, name: '神父', effect: '查看一名玩家的手牌，只有你能看到。' },
    { value: 3, count: 2, name: '男爵', effect: '和一名玩家比较手牌，点数低者出局。' },
    { value: 4, count: 2, name: '侍女', effect: '保护自己到下一回合，期间不能被指定。' },
    { value: 5, count: 2, name: '王子', effect: '指定一名玩家弃掉手牌并重抽，可以指定自己。牌库空时摸预留牌。' },
    { value: 6, count: 1, name: '国王', effect: '和一名玩家交换手牌。' },
    { value: 7, count: 1, name: '女伯爵', effect: '若同时持有王子或国王，必须打出女伯爵，不能弃牌。' },
    { value: 8, count: 1, name: '公主', effect: '打出或弃掉公主会立刻出局。' },
];

const NEEDS_TARGET = new Set([1, 2, 3, 5, 6]);
const CARD_MARKS = { 1: 'G', 2: 'P', 3: 'B', 4: 'H', 5: 'R', 6: 'K', 7: 'C', 8: 'S' };

export function createGameClient({ mount, send, addLog }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/games/loveletter/style.css?v=${Date.now()}`;
    document.head.appendChild(link);

    let latestState = null;
    let selectedCardIndex = null;
    let selectedTargetId = null;
    let selectedGuessValue = null;
    let guessModalOpen = false;
    let rulesOpen = false;
    let longPressTimer = null;
    let rayTimer = null;
    let lastRayKey = null;

    mount.innerHTML = `
        <section class="loveletter-table-game">
            <div class="ll-table">
                <svg class="ll-action-ray is-hidden" data-role="actionRay" aria-hidden="true">
                    <line data-role="actionRayLine" x1="0" y1="0" x2="0" y2="0"></line>
                </svg>
                <div class="ll-top-control">
                    <div class="ll-room-code">情书 <span>LOVE LETTER</span></div>
                    <div class="ll-status-pill" data-role="turn">等待游戏状态</div>
                    <button class="ll-table-btn ll-rules-toggle" type="button">规则</button>
                </div>
                <div class="ll-guess-overlay is-hidden" data-role="guessOverlay">
                    <div class="ll-guess-modal" role="dialog" aria-modal="true" aria-label="&#20365;&#21355;&#29468;&#29260;">
                        <button class="ll-guess-close" type="button" aria-label="&#20851;&#38381;&#29468;&#29260;">?</button>
                        <div class="ll-guess-title">&#20365;&#21355;&#29468;&#29260;</div>
                        <div class="ll-guess-desc">&#36873;&#25321;&#20320;&#35201;&#29468;&#30340;&#29260;&#65292;&#20877;&#28857;&#20987;&#30446;&#26631;&#29609;&#23478;&#21457;&#21160;&#20365;&#21355;&#12290;</div>
                        <div class="ll-guess-cards" data-role="guessCards"></div>
                    </div>
                </div>
                <div class="ll-rules-overlay is-hidden" data-role="rulesOverlay">
                    <div class="ll-rules-modal" role="dialog" aria-modal="true" aria-label="情书规则">
                        <button class="ll-rules-close" type="button" aria-label="关闭规则">×</button>
                        <div class="ll-rules-panel" data-role="rules"></div>
                    </div>
                </div>
                <div class="ll-main-area">
                    <div class="ll-ring-top" data-role="topPlayers"></div>
                    <div class="ll-middle-row">
                        <div class="ll-side-ring" data-role="leftPlayers"></div>
                        <div class="ll-play-area">
                            <div class="ll-center-label">桌面</div>
                            <div class="ll-desk-layout">
                                <div class="ll-desk-core">
                                    <div class="ll-center-box ll-deck-box">
                                        <div class="ll-box-label">牌库</div>
                                        <div class="ll-center-card ll-card-back-large"><span class="ll-deck-count" data-role="deckCount">0</span><span class="ll-deck-label">剩余</span></div>
                                    </div>
                                    <div class="ll-center-box">
                                        <div class="ll-box-label">最近行动</div>
                                        <div class="ll-center-card ll-recent-card" data-role="recentCard"><span class="ll-empty-text">等待出牌</span></div>
                                    </div>
                                    <div class="ll-center-box ll-reserved-box">
                                        <div class="ll-box-label">预留牌</div>
                                        <div class="ll-center-card ll-card-back-large"><span class="ll-deck-count" data-role="reservedCount">0</span><span class="ll-deck-label">背面预留</span></div>
                                    </div>
                                </div>
                            </div>
                            <div class="ll-card-effect-popover is-hidden" data-role="effectPopover"></div>
                            <div class="ll-table-message" data-role="message"></div>
                        </div>
                        <div class="ll-side-ring" data-role="rightPlayers"></div>
                    </div>
                    <div class="ll-self-area" data-role="selfArea"></div>
                </div>
            </div>
        </section>
    `;

    const rulesToggleEl = mount.querySelector('.ll-rules-toggle');
    const rulesOverlayEl = mount.querySelector('[data-role="rulesOverlay"]');
    const rulesCloseEl = mount.querySelector('.ll-rules-close');
    const rulesEl = mount.querySelector('[data-role="rules"]');
    const guessOverlayEl = mount.querySelector('[data-role="guessOverlay"]');
    const guessCardsEl = mount.querySelector('[data-role="guessCards"]');
    const guessCloseEl = mount.querySelector('.ll-guess-close');
    const turnEl = mount.querySelector('[data-role="turn"]');
    const topPlayersEl = mount.querySelector('[data-role="topPlayers"]');
    const leftPlayersEl = mount.querySelector('[data-role="leftPlayers"]');
    const rightPlayersEl = mount.querySelector('[data-role="rightPlayers"]');
    const deckCountEl = mount.querySelector('[data-role="deckCount"]');
    const reservedCountEl = mount.querySelector('[data-role="reservedCount"]');
    const recentCardEl = mount.querySelector('[data-role="recentCard"]');
    const effectPopoverEl = mount.querySelector('[data-role="effectPopover"]');
    const messageEl = mount.querySelector('[data-role="message"]');
    const selfAreaEl = mount.querySelector('[data-role="selfArea"]');
    const tableEl = mount.querySelector('.ll-table');
    const actionRayEl = mount.querySelector('[data-role="actionRay"]');
    const actionRayLineEl = mount.querySelector('[data-role="actionRayLine"]');

    renderRules();

    function handleMessage(message) {
        if (message.state) {
            latestState = message.state;
            normalizeSelection();
            render();
        }
        if (message.action?.message) addLog(message.action.message, 'info');
        if (message.message && message.type !== 'gameState') addLog(message.message, 'info');
    }

    function render() {
        if (!latestState) return;
        const isEnded = latestState.status === 'ended';
        const players = latestState.players || [];
        const me = players.find(player => player.id === latestState.myId);
        const currentPlayer = players.find(player => player.id === latestState.currentTurn);
        const myTurn = latestState.myIsCurrentTurn && !isOut(me) && !isEnded;
        const groups = splitOpponents(players.filter(player => player.id !== latestState.myId));
        selfAreaEl.dataset.playerId = latestState.myId || '';

        turnEl.innerHTML = isEnded
            ? getEndTitle()
            : `当前回合：<strong>${escapeHtml(currentPlayer?.name || latestState.currentTurnName || '未知')}</strong>`;
        deckCountEl.textContent = latestState.deckCount ?? 0;
        reservedCountEl.textContent = latestState.reservedCount ?? 0;

        renderRecentCard();
        renderOuterPlayers(groups, isEnded);
        renderSelfArea(me, myTurn, isEnded);
        renderMessage(myTurn, isEnded);
        renderActionRay();
    }

    function renderOuterPlayers(groups, isEnded) {
        topPlayersEl.innerHTML = groups.top.map(player => renderOpponent(player, isEnded)).join('');
        leftPlayersEl.innerHTML = groups.left.map(player => renderOpponent(player, isEnded)).join('');
        rightPlayersEl.innerHTML = groups.right.map(player => renderOpponent(player, isEnded)).join('');
    }

    function renderOpponent(player, isEnded) {
        const targetable = canTarget(player);
        const selected = selectedTargetId === player.id;
        const isWinner = isEnded && latestState.winner?.id === player.id;
        const finalCards = isEnded ? formatCards(player.finalHand || player.hand || []) : '';
        return `
            <button class="ll-player-unit ${player.isCurrentTurn ? 'is-current' : ''} ${isOut(player) ? 'is-out' : ''} ${isWinner ? 'is-winner' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected-target' : ''}" data-target-id="${escapeAttr(player.id)}" data-player-id="${escapeAttr(player.id)}" type="button" ${targetable ? '' : 'disabled'}>
                <span class="ll-player-name">${escapeHtml(player.name)}</span>
                ${renderPlayerCard(player)}
                <span class="ll-player-state">${selected ? '已选目标' : playerStateText(player, isEnded)}</span>
                ${finalCards ? `<span class="ll-final-hand">${finalCards}</span>` : ''}
            </button>
        `;
    }

    function renderPlayerCard(player) {
        const faceCard = getVisiblePlayerCard(player);
        const crossed = shouldCrossPlayerCard(player);
        if (!faceCard) {
            return `<span class="ll-card-back ${crossed ? 'has-red-x' : ''}"><span>${player.handCount ?? 0}</span>${crossed ? '<span class="ll-player-red-x">×</span>' : ''}</span>`;
        }
        return `
            <span class="ll-player-card-face ${crossed ? 'has-red-x' : ''}">
                <span class="ll-face-value">${escapeHtml(faceCard.value ?? faceCard.id)}</span>
                <span class="ll-face-name">${escapeHtml(faceCard.name || CARD_NAMES[faceCard.id] || '')}</span>
                ${crossed ? '<span class="ll-player-red-x">×</span>' : ''}
            </span>
        `;
    }

    function renderSelfArea(me, myTurn, isEnded) {
        const hand = latestState.myHand || [];
        const mustCountess = mustPlayCountessNow();
        const selectedCard = hand[selectedCardIndex];
        const playDisabled = !canPlaySelected(selectedCard);
        const discardDisabled = !myTurn || mustCountess || !selectedCard;
        const targetName = selectedTargetId ? getPlayerName(selectedTargetId) : '';

        selfAreaEl.innerHTML = `
            <div class="ll-self-name">${escapeHtml(me?.name || '我')}${myTurn ? '<span>我的回合</span>' : ''}</div>
            <div class="ll-self-row">
                <div class="ll-hand-area">
                    <div class="ll-hand-label">我的手牌</div>
                    <div class="ll-hand-cards">
                        ${hand.map((card, index) => renderHandCard(card, index, myTurn, mustCountess)).join('') || '<div class="ll-empty-hand">暂无手牌</div>'}
                    </div>
                </div>
                <div class="ll-action-panel">
                    ${renderActionPanel(selectedCard, targetName, playDisabled, discardDisabled, myTurn, isEnded, mustCountess)}
                </div>
            </div>
        `;
    }

    function renderHandCard(card, index, myTurn, mustCountess) {
        const lockedByCountess = mustCountess && card.id !== 7;
        const guessBadge = card.id === 1 && index === selectedCardIndex && selectedGuessValue
            ? `<span class="ll-guess-badge">${selectedGuessValue}</span>`
            : '';
        return `
            <button class="ll-hand-card ${index === selectedCardIndex ? 'is-selected' : ''} ${lockedByCountess ? 'is-locked' : ''}" data-card-index="${index}" data-card-id="${card.id}" type="button" ${myTurn ? '' : 'disabled'}>
                ${guessBadge}
                <span class="ll-card-value">${card.value ?? card.id}</span>
                <strong>${escapeHtml(card.name || CARD_NAMES[card.id])}</strong>
                <em>${lockedByCountess ? '女伯爵规则' : (index === selectedCardIndex ? '已选择' : '点击选择')}</em>
            </button>
        `;
    }

    function renderActionPanel(card, targetName, playDisabled, discardDisabled, myTurn, isEnded, mustCountess) {
        if (isEnded) return renderEndedPanel();
        if (isOut((latestState.players || []).find(player => player.id === latestState.myId))) return '<div class="ll-wait">你已出局，等待本局结束。</div>';
        if (!myTurn) return '<div class="ll-wait">等待其他玩家行动。</div>';
        if (!card) return '<div class="ll-wait">请选择一张手牌。</div>';

        const needsTarget = NEEDS_TARGET.has(card.id);
        return `
            <div class="ll-selected-card">已选：${card.value ?? card.id} - ${escapeHtml(card.name || CARD_NAMES[card.id])}</div>
            <div class="ll-card-effect-fixed">${escapeHtml(shortEffect(card.id))}</div>
            ${needsTarget ? `<div class="ll-selected-target">目标：${targetName ? escapeHtml(targetName) : '点击一名玩家的背面牌'}</div>` : ''}
            ${card.id === 5 ? '<button class="ll-self-target" type="button">目标：自己</button>' : ''}
            ${mustCountess ? '<div class="ll-rule-note">你同时持有女伯爵和王子/国王，本回合只能打出女伯爵，不能弃牌。</div>' : ''}
            ${card.id === 1 ? renderGuessSummary() : ''}
            <div class="ll-actions">
                <button class="ll-table-btn ll-play" type="button" ${playDisabled ? 'disabled' : ''}>出牌</button>
                <button class="ll-table-btn ll-discard" type="button" ${discardDisabled ? 'disabled' : ''}>背面弃牌</button>
            </div>
        `;
    }

    function renderGuessSummary() {
        const text = selectedGuessValue ? '\u5df2\u731c\uff1a' + selectedGuessValue + ' - ' + (CARD_NAMES[selectedGuessValue] || '\u672a\u77e5\u724c') : '\u8bf7\u9009\u62e9\u8981\u731c\u7684\u724c';
        return `
            <button class="ll-guess-summary" type="button">${escapeHtml(text)}</button>
        `;
    }

    function renderGuessModal() {
        guessCardsEl.innerHTML = [2, 3, 4, 5, 6, 7, 8].map(value => `
            <button class="ll-guess-card ${selectedGuessValue === value ? 'is-selected' : ''}" type="button" data-guess-value="${value}">
                <span class="ll-card-value">${value}</span>
                <strong>${escapeHtml(CARD_NAMES[value])}</strong>
                <em>${escapeHtml(shortEffect(value))}</em>
            </button>
        `).join('');
    }

    function setGuessModalOpen(open) {
        guessModalOpen = open;
        if (open) renderGuessModal();
        guessOverlayEl.classList.toggle('is-hidden', !open);
    }
    function renderEndedPanel() {
        const players = latestState.players || [];
        return `
            <div class="ll-ended">${getEndTitle()}<small>${escapeHtml(getEndDetail())}</small></div>
            <div class="ll-final-list">
                ${players.map(player => `
                    <div class="${latestState.winner?.id === player.id ? 'is-winner' : ''}">
                        <strong>${escapeHtml(player.name)}</strong>
                        <span>${formatCards(player.finalHand || player.hand || [])}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderRecentCard() {
        const action = latestState.lastAction;
        if (!action) {
            recentCardEl.innerHTML = '<span class="ll-empty-text">等待出牌</span>';
            return;
        }
        const publicCardName = action.cardName || (action.kind === 'discardCard' ? '背面弃牌' : '未知牌');
        const publicValue = action.cardId || '?';
        const crossed = shouldCrossRecentCard(action);
        const detail = getActionDetail(action);
        const guessBadge = action.cardId === 1 && action.guess
            ? '<span class="ll-guess-badge ll-recent-guess-badge">' + escapeHtml(action.guess) + '</span>'
            : '';
        recentCardEl.innerHTML = `
            ${guessBadge}
            <span class="ll-recent-mark">${action.cardId ? (CARD_MARKS[action.cardId] || publicValue) : '?'}</span>
            <span class="ll-recent-value">${escapeHtml(publicValue)}</span>
            <span class="ll-recent-name">${escapeHtml(publicCardName)}</span>
            <small>${escapeHtml(action.playerName || '')}</small>
            ${detail ? `<span class="ll-action-detail">${escapeHtml(detail)}</span>` : ''}
            ${crossed ? '<span class="ll-recent-red-x">×</span>' : ''}
        `;
    }

    function renderMessage(myTurn, isEnded) {
        if (isEnded) {
            messageEl.textContent = getEndDetail();
            return;
        }
        if (myTurn) {
            const card = latestState.myHand?.[selectedCardIndex];
            if (!card) messageEl.textContent = '请选择一张手牌。';
            else if (NEEDS_TARGET.has(card.id) && !selectedTargetId) messageEl.textContent = '点击一名玩家的背面牌选择目标，然后点击出牌。';
            else if (card.id === 1) messageEl.textContent = '选择猜测点数后点击出牌。';
            else messageEl.textContent = '点击出牌发动效果，或点击背面弃牌不发动效果。';
            return;
        }
        messageEl.textContent = '等待当前玩家行动。';
    }

    function renderRules() {
        rulesEl.innerHTML = `
            <div class="ll-rule-title">完整规则</div>
            <p>开局使用 16 张牌：5 张侍卫，2 张神父，2 张男爵，2 张侍女，2 张王子，1 张国王，1 张女伯爵，1 张公主。</p>
            <p>开始前需提前预留 1 张牌，平时不公开牌面；当最后王子指定玩家弃一摸一而牌库为空时，使用这张预留牌补牌。</p>
            <p>你的回合选择一张手牌：可以打出并发动效果，也可以背面弃牌不发动效果。弃牌内容其他玩家不可见。</p>
            <div class="ll-rule-cards">
                ${CARD_RULES.map(rule => `<div class="ll-rule-card"><strong>${rule.value} - ${rule.name} <small>x${rule.count}</small></strong><span>${rule.effect}</span></div>`).join('')}
            </div>
        `;
    }

    function splitOpponents(others) {
        if (others.length <= 1) return { top: others, left: [], right: [] };
        if (others.length === 2) return { top: [others[0]], left: [others[1]], right: [] };
        return {
            top: others.slice(0, Math.max(1, others.length - 2)),
            left: others.slice(Math.max(1, others.length - 2), Math.max(1, others.length - 1)),
            right: others.slice(Math.max(1, others.length - 1)),
        };
    }

    function normalizeSelection() {
        const handLength = latestState?.myHand?.length || 0;
        if (handLength === 0) {
            selectedCardIndex = null;
            selectedTargetId = null;
            selectedGuessValue = null;
            setGuessModalOpen(false);
            return;
        }
        if (selectedCardIndex === null || selectedCardIndex >= handLength) selectedCardIndex = 0;
        const card = latestState.myHand[selectedCardIndex];
        if (!card || !NEEDS_TARGET.has(card.id) || !getTargets(card).some(player => player.id === selectedTargetId)) selectedTargetId = null;
        if (!card || card.id !== 1) {
            selectedGuessValue = null;
            setGuessModalOpen(false);
        }
    }

    function canTarget(player) {
        const card = latestState?.myHand?.[selectedCardIndex];
        return Boolean(latestState?.myIsCurrentTurn && card && NEEDS_TARGET.has(card.id) && getTargets(card).some(target => target.id === player.id));
    }

    function getTargets(card) {
        const players = (latestState?.players || []).filter(player => !isOut(player));
        if (!card) return [];
        if (card.id === 5) return players;
        return players.filter(player => player.id !== latestState.myId && !player.isProtected);
    }

    function canPlaySelected(card) {
        if (!latestState?.myIsCurrentTurn || !card || latestState.status === 'ended') return false;
        if (mustPlayCountessNow() && card.id !== 7) return false;
        if (card.id === 1 && !selectedGuessValue) return false;
        if (NEEDS_TARGET.has(card.id) && !selectedTargetId) return false;
        return true;
    }

    function mustPlayCountessNow() {
        const hand = latestState?.myHand || [];
        return hand.some(card => card.id === 7) && hand.some(card => card.id === 5 || card.id === 6);
    }

    function sendSelectedAction(kind) {
        const card = latestState?.myHand?.[selectedCardIndex];
        if (!card) return;
        const guessValue = card.id === 1 ? selectedGuessValue : null;
        send({
            type: 'gameAction',
            action: {
                kind,
                cardIndex: selectedCardIndex,
                targetId: kind === 'playCard' ? selectedTargetId : null,
                guess: kind === 'playCard' && guessValue ? Number(guessValue) : null,
            },
        });
    }

    function getEndTitle() {
        const prefix = latestState?.endReason === 'showdown' ? '最终拼点' : '游戏结束';
        return `${prefix}${latestState.winner?.name ? `：${escapeHtml(latestState.winner.name)} 获胜` : ''}`;
    }

    function getEndDetail() {
        if (latestState?.endReason === 'showdown') return '牌库已空，所有仍在场玩家公开手牌，点数最高者获胜。';
        return '本局已经结束，所有玩家的最终手牌已公开。';
    }

    function getActionDetail(action) {
        if (!action) return '';
        const targetName = action.targetId ? getPlayerName(action.targetId) || '目标玩家' : '';
        if (action.kind === 'playCard' && action.cardId === 1) {
            const guessText = action.guess ? `${action.guess} - ${CARD_NAMES[action.guess] || '未知牌'}` : '未选择点数';
            const resultText = action.result?.eliminated ? '猜中，目标出局' : '猜错';
            return `目标：${targetName} / 猜测：${guessText} / 结果：${resultText}`;
        }
        if (action.kind === 'playCard' && targetName) return `目标：${targetName}`;
        if (action.kind === 'discardCard') return '背面弃牌，其他玩家不可见';
        return action.result?.message || '';
    }

    function renderActionRay() {
        const action = latestState?.lastAction;
        if (!actionRayEl || !actionRayLineEl || !tableEl) return;
        if (!action || action.kind !== 'playCard' || !action.targetId) {
            hideActionRay();
            return;
        }

        const rayKey = `${latestState.round}:${action.playerId}:${action.cardId}:${action.targetId}:${action.guess}:${latestState.discardCount}`;
        if (rayKey === lastRayKey && !actionRayEl.classList.contains('is-hidden')) return;
        lastRayKey = rayKey;
        clearTimeout(rayTimer);

        requestAnimationFrame(() => {
            const tableRect = tableEl.getBoundingClientRect();
            const targetEl = findPlayerElement(action.targetId);
            if (!targetEl || tableRect.width <= 0 || tableRect.height <= 0) {
                hideActionRay(false);
                return;
            }

            const startRect = recentCardEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            actionRayEl.setAttribute('width', String(tableRect.width));
            actionRayEl.setAttribute('height', String(tableRect.height));
            actionRayLineEl.setAttribute('x1', String(startRect.left + startRect.width / 2 - tableRect.left));
            actionRayLineEl.setAttribute('y1', String(startRect.top + startRect.height / 2 - tableRect.top));
            actionRayLineEl.setAttribute('x2', String(targetRect.left + targetRect.width / 2 - tableRect.left));
            actionRayLineEl.setAttribute('y2', String(targetRect.top + targetRect.height / 2 - tableRect.top));
            actionRayEl.classList.remove('is-hidden');
            actionRayEl.classList.remove('is-firing');
            void actionRayEl.offsetWidth;
            actionRayEl.classList.add('is-firing');
            rayTimer = setTimeout(() => hideActionRay(false), 2000);
        });
    }

    function hideActionRay(resetKey = true) {
        clearTimeout(rayTimer);
        actionRayEl?.classList.add('is-hidden');
        actionRayEl?.classList.remove('is-firing');
        if (resetKey) lastRayKey = null;
    }

    function findPlayerElement(playerId) {
        const id = String(playerId ?? '');
        const outerPlayer = Array.from(mount.querySelectorAll('.ll-player-unit')).find(element => element.dataset.playerId === id);
        if (outerPlayer) return outerPlayer;
        return selfAreaEl.dataset.playerId === id ? selfAreaEl : null;
    }

    function getActionResult() {
        return latestState?.lastAction?.result || {};
    }

    function getVisiblePlayerCard(player) {
        if (latestState?.status === 'ended') {
            return (player.finalHand || player.hand || []).find(Boolean) || null;
        }
        const action = latestState?.lastAction;
        const result = getActionResult();
        const revealedCards = result.revealedCards || {};
        if (revealedCards[player.id]) return revealedCards[player.id];
        if (result.revealedCard && (result.eliminated === player.id || result.target === player.id)) return result.revealedCard;
        if (action?.playerId === player.id && action.kind === 'playCard' && action.cardId && action.cardName) {
            return { id: action.cardId, value: action.cardId, name: action.cardName };
        }
        return null;
    }

    function shouldCrossPlayerCard(player) {
        const action = latestState?.lastAction;
        const result = getActionResult();
        if (result.eliminated === player.id) return true;
        return Boolean(action?.cardId === 1 && action.playerId === player.id && isGuardMiss(action));
    }

    function shouldCrossRecentCard(action) {
        const result = action?.result || {};
        return Boolean(isGuardMiss(action) || (result.eliminated && result.eliminated === action.playerId));
    }

    function isGuardMiss(action) {
        if (!action || action.kind !== 'playCard' || action.cardId !== 1) return false;
        return Boolean(action.result?.guardMiss || (!action.result?.eliminated && action.targetId));
    }

    function playerStateText(player, isEnded) {
        if (isOut(player)) return '出局';
        if (isEnded) return '结算';
        if (player.isProtected) return '保护中';
        if (player.isCurrentTurn) return '行动中';
        return `${player.handCount ?? 0} 张手牌`;
    }

    function getPlayerName(playerId) {
        return (latestState.players || []).find(player => player.id === playerId)?.name || '';
    }

    function isOut(player) {
        return Boolean(player?.isOut || player?.isEliminated || player?.isAlive === false);
    }

    function formatCards(cards) {
        if (!cards || cards.length === 0) return '无手牌';
        return cards.map(card => `${card.value ?? card.id} - ${escapeHtml(card.name || CARD_NAMES[card.id])}`).join(' / ');
    }

    function shortEffect(cardId) {
        return CARD_RULES.find(rule => rule.value === cardId)?.effect || '';
    }

    function showEffectPreview(cardId) {
        if (!cardId) return;
        const previewCardId = Number(cardId);
        const name = CARD_NAMES[previewCardId] || '';
        effectPopoverEl.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(shortEffect(previewCardId))}</span>`;
        effectPopoverEl.classList.remove('is-hidden');
    }

    function hideEffectPreview() {
        effectPopoverEl.classList.add('is-hidden');
    }

    function setRulesOpen(open) {
        rulesOpen = open;
        rulesOverlayEl.classList.toggle('is-hidden', !rulesOpen);
        rulesToggleEl.textContent = rulesOpen ? '收起规则' : '规则';
    }

    selfAreaEl.addEventListener('mouseover', event => {
        const cardButton = event.target.closest('[data-card-id]');
        if (cardButton) showEffectPreview(cardButton.dataset.cardId);
    });

    selfAreaEl.addEventListener('mouseout', event => {
        if (event.target.closest('[data-card-id]')) hideEffectPreview();
    });

    selfAreaEl.addEventListener('touchstart', event => {
        const cardButton = event.target.closest('[data-card-id]');
        if (!cardButton) return;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => showEffectPreview(cardButton.dataset.cardId), 520);
    }, { passive: true });

    selfAreaEl.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        setTimeout(hideEffectPreview, 900);
    });

    selfAreaEl.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        hideEffectPreview();
    });

    rulesToggleEl.addEventListener('click', () => setRulesOpen(!rulesOpen));
    rulesCloseEl.addEventListener('click', () => setRulesOpen(false));
    rulesOverlayEl.addEventListener('click', event => {
        if (event.target === rulesOverlayEl) setRulesOpen(false);
    });

    guessCloseEl.addEventListener('click', () => setGuessModalOpen(false));
    guessOverlayEl.addEventListener('click', event => {
        if (event.target === guessOverlayEl) setGuessModalOpen(false);
        const guessCard = event.target.closest('[data-guess-value]');
        if (!guessCard) return;
        selectedGuessValue = Number(guessCard.dataset.guessValue);
        setGuessModalOpen(false);
        render();
    });

    selfAreaEl.addEventListener('click', event => {
        const cardButton = event.target.closest('[data-card-index]');
        if (cardButton && !cardButton.disabled) {
            selectedCardIndex = Number(cardButton.dataset.cardIndex);
            selectedTargetId = null;
            const chosenCard = latestState?.myHand?.[selectedCardIndex];
            if (!chosenCard || chosenCard.id !== 1) selectedGuessValue = null;
            normalizeSelection();
            render();
            if (chosenCard?.id === 1) setGuessModalOpen(true);
            return;
        }
        if (event.target.closest('.ll-guess-summary')) {
            setGuessModalOpen(true);
            return;
        }
        if (event.target.closest('.ll-self-target')) {
            selectedTargetId = latestState.myId;
            render();
            return;
        }
        if (event.target.closest('.ll-play')) sendSelectedAction('playCard');
        if (event.target.closest('.ll-discard')) sendSelectedAction('discardCard');
    });

    mount.addEventListener('click', event => {
        const targetButton = event.target.closest('[data-target-id]');
        if (!targetButton || targetButton.disabled) return;
        selectedTargetId = targetButton.dataset.targetId;
        render();
    });

    return {
        gameType: 'loveletter',
        handleMessage,
        destroy() {
            clearTimeout(longPressTimer);
            clearTimeout(rayTimer);
            link.remove();
            mount.innerHTML = '';
        },
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value);
}