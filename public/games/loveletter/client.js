const CARD_NAMES = {
    1: '\u4f8d\u536b',
    2: '\u7267\u5e08',
    3: '\u7537\u7235',
    4: '\u4f8d\u5973',
    5: '\u738b\u5b50',
    6: '\u56fd\u738b',
    7: '\u4f2f\u7235\u592b\u4eba',
    8: '\u516c\u4e3b',
};

const CARD_RULES = [
    { value: 1, count: 5, name: '\u4f8d\u536b', effect: '\u731c\u4e00\u540d\u73a9\u5bb6\u7684\u624b\u724c\uff0c\u4e0d\u80fd\u731c\u4f8d\u536b\uff1b\u731c\u4e2d\u5219\u5bf9\u65b9\u51fa\u5c40\u3002' },
    { value: 2, count: 2, name: '\u7267\u5e08', effect: '\u67e5\u770b\u4e00\u540d\u73a9\u5bb6\u7684\u624b\u724c\uff0c\u53ea\u6709\u4f60\u80fd\u770b\u5230\u3002' },
    { value: 3, count: 2, name: '\u7537\u7235', effect: '\u548c\u4e00\u540d\u73a9\u5bb6\u6bd4\u8f83\u624b\u724c\uff0c\u70b9\u6570\u4f4e\u8005\u51fa\u5c40\u3002' },
    { value: 4, count: 2, name: '\u4f8d\u5973', effect: '\u4fdd\u62a4\u81ea\u5df1\u5230\u4e0b\u4e2a\u56de\u5408\uff0c\u671f\u95f4\u4e0d\u80fd\u88ab\u6307\u5b9a\u3002' },
    { value: 5, count: 2, name: '\u738b\u5b50', effect: '\u6307\u5b9a\u4e00\u540d\u73a9\u5bb6\u5f03\u6389\u624b\u724c\u5e76\u91cd\u62bd\uff0c\u53ef\u4ee5\u6307\u5b9a\u81ea\u5df1\u3002' },
    { value: 6, count: 1, name: '\u56fd\u738b', effect: '\u548c\u4e00\u540d\u73a9\u5bb6\u4ea4\u6362\u624b\u724c\u3002' },
    { value: 7, count: 1, name: '\u4f2f\u7235\u592b\u4eba', effect: '\u82e5\u540c\u65f6\u6301\u6709\u738b\u5b50\u6216\u56fd\u738b\uff0c\u5fc5\u987b\u6253\u51fa\u4f2f\u7235\u592b\u4eba\uff0c\u4e0d\u80fd\u5f03\u724c\u3002' },
    { value: 8, count: 1, name: '\u516c\u4e3b', effect: '\u6253\u51fa\u6216\u5f03\u6389\u516c\u4e3b\u4f1a\u7acb\u523b\u51fa\u5c40\u3002' },
];

export function createGameClient({ mount, send, addLog }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/games/loveletter/style.css?v=${Date.now()}`;
    document.head.appendChild(link);

    let latestState = null;
    let selectedCardIndex = 0;

    mount.innerHTML = `
        <section class="panel loveletter-game">
            <div class="ll-header">
                <h3>\u60c5\u4e66</h3>
                <button class="ll-rules-toggle" type="button">\u6e38\u620f\u89c4\u5219</button>
            </div>
            <div class="ll-rules is-hidden">
                <div class="ll-rule-title">\u6e38\u620f\u76ee\u6807</div>
                <p>\u7559\u5230\u6700\u540e\uff0c\u6216\u5728\u724c\u5e93\u6478\u5b8c\u65f6\u6301\u6709\u70b9\u6570\u6700\u9ad8\u7684\u624b\u724c\u3002</p>
                <div class="ll-rule-title">\u56de\u5408\u6d41\u7a0b</div>
                <p>\u8f6e\u5230\u4f60\u65f6\u6478\u5230 2 \u5f20\u624b\u724c\uff0c\u9009\u62e9\u5176\u4e2d 1 \u5f20\u6253\u51fa\u53d1\u52a8\u6548\u679c\uff0c\u6216\u80cc\u9762\u5f03\u6389 1 \u5f20\u4e0d\u53d1\u52a8\u6548\u679c\u3002</p>
                <div class="ll-rule-title">\u7279\u6b8a\u89c4\u5219</div>
                <p>\u6253\u51fa\u6216\u5f03\u6389\u516c\u4e3b\u4f1a\u51fa\u5c40\u3002\u624b\u91cc\u540c\u65f6\u6709\u4f2f\u7235\u592b\u4eba\u548c\u738b\u5b50/\u56fd\u738b\u65f6\uff0c\u5fc5\u987b\u6253\u51fa\u4f2f\u7235\u592b\u4eba\uff0c\u4e0d\u80fd\u5f03\u724c\u3002</p>
                <div class="ll-rule-title">\u9884\u7559\u724c</div>
                <p>\u5f00\u5c40\u9700\u4ece 16 \u5f20\u724c\u4e2d\u80cc\u9762\u9884\u7559 1 \u5f20\uff0c\u5e73\u65f6\u4e0d\u516c\u5f00\u724c\u9762\uff0c\u53ea\u663e\u793a\u9884\u7559\u6570\u91cf\u3002\u8fd9\u5f20\u724c\u4e13\u95e8\u7528\u4e8e\u724c\u5e93\u6478\u7a7a\u540e\uff0c\u738b\u5b50\u6307\u5b9a\u73a9\u5bb6\u5f03\u4e00\u5f20\u518d\u6478\u4e00\u5f20\u65f6\u4f7f\u7528\u3002</p>
                <div class="ll-rule-title">\u5168\u90e8\u724c\u7ec4\u548c\u529f\u80fd</div>
                <div class="ll-rule-cards">
                    ${CARD_RULES.map(rule => `
                        <div class="ll-rule-card">
                            <strong>${rule.value} - ${rule.name} <small>x${rule.count}</small></strong>
                            <span>${rule.effect}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="ll-status"></div>
            <div class="ll-players"></div>
            <div class="ll-hand"></div>
            <div class="ll-action"></div>
        </section>
    `;

    const rulesToggleEl = mount.querySelector('.ll-rules-toggle');
    const rulesEl = mount.querySelector('.ll-rules');
    const statusEl = mount.querySelector('.ll-status');
    const playersEl = mount.querySelector('.ll-players');
    const handEl = mount.querySelector('.ll-hand');
    const actionEl = mount.querySelector('.ll-action');

    function handleMessage(message) {
        if (message.state) {
            latestState = message.state;
            selectedCardIndex = clampSelectedIndex(selectedCardIndex);
            render();
        }
        if (message.action?.message) {
            addLog(message.action.message, 'info');
        }
        if (message.type === 'gameEnded') {
            renderFinalHands(message.winner);
        }
    }

    function render() {
        if (!latestState) return;

        statusEl.innerHTML = `
            <div>\u5f53\u524d\u56de\u5408: <strong>${escapeHtml(latestState.currentTurnName || '\u672a\u77e5')}</strong></div>
            <div>\u724c\u5e93: ${latestState.deckCount} - \u9884\u7559: ${latestState.reservedCount || 0} - \u5f03\u724c: ${latestState.discardCount}</div>
        `;

        playersEl.innerHTML = latestState.players.map(player => {
            const finalCards = latestState.status === 'ended' ? (player.finalHand || player.hand || []) : null;
            const finalText = finalCards ? ` - ${formatCards(finalCards)}` : '';
            return `
                <div class="ll-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.isOut ? 'is-out' : ''}">
                    <span>${escapeHtml(player.name)}${player.id === latestState.myId ? ' (\u6211)' : ''}</span>
                    <span>${player.isOut ? '\u51fa\u5c40' : player.isProtected ? '\u4fdd\u62a4\u4e2d' : `${player.handCount} \u5f20\u724c`}${finalText}</span>
                </div>
            `;
        }).join('');

        const hand = latestState.myHand || [];
        handEl.innerHTML = `
            <div class="ll-label">\u6211\u7684\u624b\u724c</div>
            <div class="ll-cards">
                ${hand.map((card, index) => `
                    <button class="ll-card ${index === selectedCardIndex ? 'is-selected' : ''}" data-card-index="${index}" type="button">
                        <strong>${card.value} - ${escapeHtml(card.name || CARD_NAMES[card.id])}</strong>
                        <span>${escapeHtml(card.description || getCardEffect(card.id))}</span>
                        <em>${index === selectedCardIndex ? '\u5df2\u9009\u4e2d' : '\u70b9\u51fb\u9009\u62e9\u8fd9\u5f20'}</em>
                    </button>
                `).join('') || '<div class="ll-empty">\u6682\u65e0\u624b\u724c</div>'}
            </div>
        `;

        if (latestState.status === 'ended') {
            renderFinalHands(latestState.winner);
        } else if (latestState.myIsCurrentTurn && !latestState.myIsOut) {
            renderActionForm(hand[selectedCardIndex], selectedCardIndex);
        } else {
            actionEl.innerHTML = `<div class="ll-wait">${latestState.myIsOut ? '\u4f60\u5df2\u51fa\u5c40' : '\u7b49\u5f85\u5176\u4ed6\u73a9\u5bb6\u884c\u52a8'}</div>`;
        }
    }

    function renderFinalHands(winner) {
        if (!latestState) return;
        const winnerName = winner?.name || latestState.winner?.name || '\u672a\u77e5';
        actionEl.innerHTML = `
            <div class="ll-ended">\u6e38\u620f\u7ed3\u675f - \u80dc\u8005: ${escapeHtml(winnerName)}</div>
            <div class="ll-final-list">
                ${latestState.players.map(player => `
                    <div class="ll-final-row">
                        <strong>${escapeHtml(player.name)}</strong>
                        <span>${formatCards(player.finalHand || player.hand || [])}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderActionForm(card, cardIndex) {
        if (!card) {
            actionEl.innerHTML = '<div class="ll-wait">\u6ca1\u6709\u53ef\u64cd\u4f5c\u7684\u724c</div>';
            return;
        }

        const targets = getTargets(card);
        const needsTarget = [1, 2, 3, 5, 6].includes(card.id);
        const needsGuess = card.id === 1;
        const mustPlayCountess = mustPlayCountessNow();
        const playDisabled = (needsTarget && targets.length === 0) || (mustPlayCountess && card.id !== 7);
        const discardDisabled = mustPlayCountess;

        actionEl.innerHTML = `
            <div class="ll-label">\u884c\u52a8</div>
            <div class="ll-selected">\u5df2\u9009: ${card.value} - ${escapeHtml(card.name || CARD_NAMES[card.id])}</div>
            ${mustPlayCountess ? '<div class="ll-rule-note">\u624b\u91cc\u6709\u4f2f\u7235\u592b\u4eba\u548c\u56fd\u738b/\u738b\u5b50\uff0c\u5fc5\u987b\u6253\u51fa\u4f2f\u7235\u592b\u4eba</div>' : ''}
            ${needsTarget ? `
                <select class="ll-target" ${playDisabled ? 'disabled' : ''}>
                    ${targets.map(player => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`).join('')}
                </select>
            ` : ''}
            ${needsGuess ? `
                <select class="ll-guess">
                    ${[2, 3, 4, 5, 6, 7, 8].map(value => `<option value="${value}">${value} - ${CARD_NAMES[value]}</option>`).join('')}
                </select>
            ` : ''}
            <div class="ll-actions">
                <button class="ll-play" data-card-index="${cardIndex}" type="button" ${playDisabled ? 'disabled' : ''}>\u6253\u51fa ${escapeHtml(card.name || CARD_NAMES[card.id])}</button>
                <button class="ll-discard" data-card-index="${cardIndex}" type="button" ${discardDisabled ? 'disabled' : ''}>\u5f03\u6389 ${escapeHtml(card.name || CARD_NAMES[card.id])}</button>
            </div>
        `;
    }

    function mustPlayCountessNow() {
        const hand = latestState?.myHand || [];
        return hand.some(card => card.id === 7) && hand.some(card => card.id === 5 || card.id === 6);
    }

    function getTargets(card) {
        const alive = latestState.players.filter(player => !player.isOut);
        if (card.id === 5) return alive;
        return alive.filter(player => player.id !== latestState.myId && !player.isProtected);
    }

    function sendSelectedAction(kind, cardIndex = selectedCardIndex) {
        selectedCardIndex = clampSelectedIndex(Number(cardIndex));
        const card = latestState?.myHand?.[selectedCardIndex];
        if (!card) return;

        const target = actionEl.querySelector('.ll-target')?.value || null;
        const guessValue = actionEl.querySelector('.ll-guess')?.value;
        const guess = guessValue ? Number(guessValue) : null;

        send({
            type: 'gameAction',
            action: {
                kind,
                cardIndex: selectedCardIndex,
                targetId: kind === 'playCard' ? target : null,
                guess: kind === 'playCard' ? guess : null,
            },
        });
    }

    function getCardEffect(cardId) {
        return CARD_RULES.find(rule => rule.value === cardId)?.effect || '';
    }

    function formatCards(cards) {
        if (!cards || cards.length === 0) return '\u65e0\u624b\u724c';
        return cards.map(card => `${card.value} - ${escapeHtml(card.name || CARD_NAMES[card.id])}`).join(' / ');
    }

    function clampSelectedIndex(index) {
        const handLength = latestState?.myHand?.length || 0;
        if (handLength === 0) return 0;
        if (!Number.isFinite(index)) return 0;
        return Math.max(0, Math.min(index, handLength - 1));
    }

    rulesToggleEl.addEventListener('click', () => {
        const isHidden = rulesEl.classList.toggle('is-hidden');
        rulesToggleEl.textContent = isHidden ? '\u6e38\u620f\u89c4\u5219' : '\u6536\u8d77\u89c4\u5219';
    });

    handEl.addEventListener('click', event => {
        const cardButton = event.target.closest('[data-card-index]');
        if (!cardButton) return;
        selectedCardIndex = clampSelectedIndex(Number(cardButton.dataset.cardIndex));
        render();
    });

    actionEl.addEventListener('click', event => {
        const playButton = event.target.closest('.ll-play');
        if (playButton) {
            sendSelectedAction('playCard', playButton.dataset.cardIndex);
            return;
        }

        const discardButton = event.target.closest('.ll-discard');
        if (discardButton) {
            sendSelectedAction('discardCard', discardButton.dataset.cardIndex);
        }
    });

    return {
        gameType: 'loveletter',
        handleMessage,
        destroy() {
            link.remove();
            mount.innerHTML = '';
        },
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }[char]));
}



