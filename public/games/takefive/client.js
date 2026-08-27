const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const bullTotal = cards => (cards || []).reduce((sum, card) => sum + (Number(card?.bullheads) || 0), 0);

function bullClass(card) {
    const count = Number(card?.bullheads) || 1;
    return `bulls-${[1, 2, 3, 5, 7].includes(count) ? count : 1}`;
}

function cardMarkup(card, options = {}) {
    const {
        kind = 'row',
        interactive = false,
        selected = false,
        disabled = false,
        action = 'selectCard',
        badge = '',
        locked = false,
        extraClass = '',
        dataAttributes = '',
    } = options;
    const tag = interactive ? 'button' : 'span';
    const value = Number(card?.value) || 0;
    const heads = Number(card?.bullheads) || 0;
    const pips = Array.from({ length: heads }, () => '<i></i>').join('');
    const attributes = interactive
        ? ` type="button" data-card-id="${escapeHtml(card?.id)}" data-card-action="${action}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}`
        : '';
    return `<${tag}${attributes}${dataAttributes ? ` ${dataAttributes}` : ''} class="tf-number-card tf-${kind}-card ${bullClass(card)} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${extraClass}" aria-label="${value}，${heads} 牛头" title="${value} · ${heads} 牛头">
        <span class="tf-card-corner tf-card-corner-top">${value}</span>
        <span class="tf-card-bull" aria-hidden="true"><i></i></span>
        <strong>${value}</strong>
        <span class="tf-bull-pips" aria-hidden="true">${pips}</span>
        <small>${heads} 牛头</small>
        <span class="tf-card-corner tf-card-corner-bottom">${value}</span>
        ${badge ? `<span class="tf-card-lock">${escapeHtml(badge)}</span>` : ''}
    </${tag}>`;
}

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/takefive/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(style);
    document.body.classList.add('is-takefive-view');

    let state = null;
    let rulesTrigger = null;
    let pendingCardId = null;
    let confirmingCard = false;
    let presentationResolutionId = null;
    let presentationStepIndex = 0;
    let presentationPhase = 'idle';
    let presentationBusy = false;
    let presentationToken = 0;
    let visualRows = null;
    let activeStep = null;
    let collectionBurst = null;
    let rowChoiceReady = false;
    let pendingRowIndex = null;
    let rowChoiceSubmitting = false;
    let shownSettlementId = null;
    let scenePlaying = false;
    let sceneTimer = 0;
    let layoutFrame = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    mount.innerHTML = `<section class="takefive-app">
        <header class="tf-header">
            <div class="tf-brand">
                <span class="tf-brand-mark" aria-hidden="true"><i></i><b>6</b></span>
                <div><small>同时出牌 · 避开第六张</small><h1>牛头王</h1></div>
            </div>
            <div class="tf-turn" data-role="turn" aria-live="polite"><span class="tf-live-dot"></span>等待游戏状态</div>
            <div class="tf-header-round">
                <small>本手进度</small>
                <strong data-role="round">第 — 手 · — / 10</strong>
            </div>
            <div class="tf-header-actions">
                <button class="tf-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button>

            </div>
        </header>

        <main class="tf-layout">
            <aside class="tf-players-panel">
                <header><div><small>低分领先</small><h2>玩家记分</h2></div><span data-role="playerMeta">0 人</span></header>
                <div class="tf-players" data-role="players"></div>
            </aside>

            <section class="tf-board">
                <header class="tf-board-header">
                    <div><small>四列牌阵</small><h2>中央牌列</h2></div>
                    <div class="tf-round-progress" data-role="roundProgress" aria-label="本手进度"></div>
                </header>
                <section class="tf-public-stage" data-role="publicStage" aria-live="polite"></section>
                <section class="tf-draft is-hidden" data-role="draft"></section>
                <div class="tf-rows" data-role="rows"></div>
                <div class="tf-resolution" data-role="resolution" aria-live="polite"></div>
            </section>

            <aside class="tf-table-rail">
                <section class="tf-reveal-panel">
                    <header><div><small>同时公开</small><h2>本轮翻牌</h2></div><span data-role="revealMeta">等待中</span></header>
                    <div class="tf-revealed" data-role="revealed"></div>
                </section>
                <section class="tf-log-panel">
                    <header><div><small>行动回顾</small><h2>牌桌记录</h2></div></header>
                    <div class="tf-log" data-role="log"></div>
                </section>
                <section class="tf-target-panel">
                    <span class="tf-target-ornament" aria-hidden="true"><i></i></span>
                    <div><small>终局线</small><strong data-role="targetScore">66</strong><span>牛头</span></div>
                </section>
            </aside>

            <section class="tf-hand-panel">
                <header class="tf-hand-header">
                    <div><small>私人手牌</small><h2>我的手牌</h2></div>
                    <div class="tf-hand-stats"><span data-role="handHint">等待发牌</span><b data-role="pileScore">0 牛头</b></div>
                </header>
                <div class="tf-cards" data-role="hand"></div>
                <div class="tf-hand-confirm" data-role="handConfirm"></div>
            </section>
        </main>

        <div class="tf-overlay is-hidden" data-role="rules" role="presentation">
            <article class="tf-rules" role="dialog" aria-modal="true" aria-labelledby="tfRulesTitle">
                <button class="tf-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="tf-rules-art">
                    <div class="tf-rules-card-fan" aria-label="不同牛头分值的数字牌示例">
                        ${cardMarkup({ value: 17, bullheads: 1 }, { kind: 'rules' })}
                        ${cardMarkup({ value: 55, bullheads: 7 }, { kind: 'rules' })}
                        ${cardMarkup({ value: 30, bullheads: 3 }, { kind: 'rules' })}
                    </div>
                    <span>1—104</span>
                </div>
                <div class="tf-rules-copy">
                    <small>规则速览</small>
                    <h2 id="tfRulesTitle">别成为第六张牌</h2>
                    <ol>
                        <li><b>同时锁牌</b><span>每轮每人暗中选择一张；所有人锁定后才一起公开。</span></li>
                        <li><b>从小到大</b><span>公开牌按数字升序处理，接到小于它且数值最接近的行尾。</span></li>
                        <li><b>第六张收行</b><span>牌成为一行第六张时，出牌者收走前五张并承受其牛头。</span></li>
                        <li><b>低牌自选</b><span>若牌小于全部行尾，出牌者选择一行收走，再以该牌重开。</span></li>
                    </ol>
                    <div class="tf-score-key"><span><i class="key-1"></i>普通牌 1</span><span><i class="key-2"></i>5 的倍数 2</span><span><i class="key-3"></i>10 的倍数 3</span><span><i class="key-5"></i>11 的倍数 5</span><span><i class="key-7"></i>55 为 7</span></div>
                    <p>每手十轮后统一计分；整手结束时如有人累计达到 <b>66</b> 牛头，累计分最低者获胜。专业变体限 2–6 人，先从公开牌池轮流选满十张。</p>
                </div>
            </article>
        </div>
        <svg class="tf-action-links" data-role="actionLinks" aria-hidden="true">
            <path class="tf-action-link-glow" data-role="actionLinkGlow"></path>
            <path class="tf-action-link-stroke" data-role="actionLinkStroke"></path>
            <circle class="tf-action-link-seal" data-role="actionLinkSeal" r="7"></circle>
        </svg>
        <div class="tf-settlement-layer" data-role="settlementLayer" aria-hidden="true" hidden>
            <section class="tf-settlement-scene" data-role="settlementScene" role="status" aria-live="assertive"></section>
            <button class="tf-settlement-skip" data-ui="skipSettlement" type="button">跳过</button>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    const cloneRows = rows => (rows || []).map(row => (row || []).map(card => ({ ...card })));
    const currentResolution = () => state?.resolutionEvent?.resolutionId === presentationResolutionId ? state.resolutionEvent : null;
    const presentationMatches = () => Boolean(currentResolution() && visualRows);

    function presentationDelay(duration, token) {
        return new Promise(resolve => {
            const waiter = { timer: 0, resolve };
            waiter.timer = window.setTimeout(() => {
                presentationWaiters.delete(waiter);
                resolve(token === presentationToken);
            }, reducedMotion ? Math.min(80, duration) : duration);
            presentationWaiters.add(waiter);
        });
    }

    function initializeResolutionPresentation(event) {
        presentationToken += 1;
        presentationResolutionId = event.resolutionId;
        presentationStepIndex = 0;
        presentationPhase = 'backs';
        presentationBusy = false;
        visualRows = cloneRows(event.initialRows);
        activeStep = null;
        collectionBurst = null;
        rowChoiceReady = false;
        pendingRowIndex = null;
        rowChoiceSubmitting = false;
    }

    function phaseCopy() {
        if (presentationBusy) return presentationPhase === 'backs' ? '所有人已锁牌 · 准备翻开' : '正在按数字从小到大结算';
        if (scenePlaying) return '正在公布本手结算';
        if (state.status === 'ended') {
            const winners = state.winners?.length ? state.winners : state.winner ? [state.winner] : [];
            if (!winners.length) return '本局结束';
            return winners.length > 1
                ? `${winners.map(player => player.name).join('、')} 并列获胜`
                : `${winners[0].name} 获胜`;
        }
        if (state.phase === 'drafting') {
            return state.availableActions?.canDraft
                ? '轮到你从公开牌池选牌'
                : `等待 ${state.draft?.currentPlayerName || '当前玩家'} 公开选牌`;
        }
        if (state.phase === 'choose_row') {
            return state.pendingRowChoice?.playerId === state.myId
                ? `你的 ${state.pendingRowChoice.card.value} 需要收取一行`
                : `等待 ${state.pendingRowChoice?.playerName || '当前玩家'} 选择牌行`;
        }
        if (state.phase === 'resolving') return '正在按数字从小到大结算';
        if (state.availableActions?.canSelect) return '选择一张手牌并锁定';
        if (state.mySelectedCardId) return `你的牌已锁定 · ${state.selectedCount}/${state.playerCount}`;
        return `等待玩家选牌 · ${state.selectedCount}/${state.playerCount}`;
    }

    function render() {
        if (!state) return;
        const app = mount.querySelector('.takefive-app');
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-ended', state.status === 'ended');
        app.classList.toggle('is-presenting', presentationBusy);
        app.classList.toggle('is-scene-active', scenePlaying);
        app.classList.toggle('is-my-action', Boolean(!presentationBusy && !scenePlaying && (state.availableActions?.canSelect || state.availableActions?.canDraft || (state.availableActions?.canChooseRow && rowChoiceReady))));

        $('turn').innerHTML = `<span class="tf-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(phaseCopy())}`;
        $('round').textContent = state.phase === 'drafting'
            ? `第 ${state.handNumber || 1} 手 · 公开选牌`
            : `第 ${state.handNumber || 1} 手 · ${state.round || 0} / ${state.maxRounds || 10}`;
        $('targetScore').textContent = state.targetScore === null ? state.maxHands || '—' : state.targetScore || 66;
        $('targetScore').nextElementSibling.textContent = state.targetScore === null ? '手结束' : '牛头';

        renderRoundProgress();
        renderPlayers();
        renderPublicStage();
        renderDraft();
        renderRows();
        renderResolution();
        renderRevealed();
        renderHand();
        renderLog();
        schedulePresentationLayout();
    }

    function renderPublicStage() {
        const stage = $('publicStage');
        const event = currentResolution();
        const keepResolvedCards = Boolean(event && state.selectedCount === 0 && state.revealedCards?.length);
        const showResolution = Boolean(event && (presentationBusy || presentationPhase === 'choice' || keepResolvedCards));
        if (!showResolution) {
            const count = Number(state.selectedCount) || 0;
            stage.className = `tf-public-stage ${count ? 'is-locking' : 'is-idle'}`;
            stage.innerHTML = `<header><div><small>中央公共区</small><strong>${count ? '暗牌锁定中' : '等待本轮出牌'}</strong></div><span>${count} / ${state.playerCount || 0} 已锁定</span></header>
                <div class="tf-public-backs" aria-label="${count} 名玩家已锁定">${Array.from({ length: Math.min(count, 10) }, (_, index) => `<i style="--public-back:${index}"></i>`).join('') || '<em>所有人锁定后，牌面将在这里同时翻开</em>'}</div>`;
            return;
        }
        const choiceCardId = event.pendingRowChoice?.card?.id;
        const cards = event.revealedCards || [];
        const faceDown = presentationPhase === 'backs';
        stage.className = `tf-public-stage is-resolution is-${presentationPhase}`;
        stage.innerHTML = `<header><div><small>本轮公开结算</small><strong>${faceDown ? '即将同时翻牌' : '按数字升序入列'}</strong></div><span>${Math.min(presentationStepIndex, cards.length)} / ${cards.length} 已处理</span></header>
            <div class="tf-public-cards">${cards.map((item, index) => {
                const isActive = activeStep?.card?.id === item.card.id || (!activeStep && presentationPhase === 'choice' && choiceCardId === item.card.id);
                const resolved = index < presentationStepIndex;
                const extraClass = `${faceDown ? 'is-face-down' : ''} ${isActive ? 'is-active' : ''} ${resolved ? 'is-resolved' : ''} ${isActive && presentationPhase === 'depart' ? 'is-departing' : ''}`;
                return `<article class="tf-public-card-wrap ${isActive ? 'is-current' : ''}" data-public-player-id="${escapeHtml(item.playerId)}"><span>${escapeHtml(item.playerName)}</span>${cardMarkup(item.card, { kind: 'public', extraClass, dataAttributes: `data-public-card-id="${escapeHtml(item.card.id)}"${isActive ? ' data-public-active="true"' : ''}` })}</article>`;
            }).join('')}</div>`;
    }

    function renderRoundProgress() {
        const current = state.phase === 'drafting' ? 0 : Number(state.round) || 0;
        $('roundProgress').innerHTML = Array.from({ length: state.maxRounds || 10 }, (_, index) => {
            const round = index + 1;
            return `<i class="${round < current ? 'is-done' : round === current ? 'is-current' : ''}" title="第 ${round} 轮"><span>${round}</span></i>`;
        }).join('');
    }

    function playerStatus(player) {
        if (player.isOnline === false) return '离线';
        if (state.status === 'ended') return '最终得分';
        if (state.phase === 'drafting') {
            if (state.draft?.currentPlayerId === player.id) return '正在选牌';
            return `${player.handCount || 0} / 10 张`;
        }
        if (player.hasSelected) return '已锁定';
        if (state.phase === 'choose_row' && state.pendingRowChoice?.playerId === player.id) return '正在选行';
        return `${player.handCount || 0} 张手牌`;
    }

    function renderPlayers() {
        const players = state.players || [];
        $('playerMeta').textContent = `${players.length} 人 · 低分领先`;
        const activePlayerId = activeStep?.playerId || (presentationPhase === 'choice' ? currentResolution()?.pendingRowChoice?.playerId : null);
        $('players').innerHTML = players.map((player, index) => `<article class="tf-player ${player.id === state.myId ? 'is-me' : ''} ${player.hasSelected ? 'is-ready' : ''} ${player.isOnline === false ? 'is-offline' : ''} ${activePlayerId === player.id ? 'is-resolving' : ''}" data-player-id="${escapeHtml(player.id)}">
            <span class="tf-player-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="tf-avatar">${escapeHtml(player.name.slice(0, 1))}</span>
            <span class="tf-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${escapeHtml(playerStatus(player))}</small></span>
            <span class="tf-player-score"><b>${Number(player.score) || 0}</b><small>累计</small></span>
        </article>`).join('');
    }

    function renderDraft() {
        const draft = $('draft');
        if (state.phase !== 'drafting' || !state.draft) {
            draft.classList.add('is-hidden');
            draft.innerHTML = '';
            return;
        }
        draft.classList.remove('is-hidden');
        const cards = [...(state.draft.cards || [])].sort((left, right) => left.value - right.value);
        draft.innerHTML = `<header><div><small>专业变体</small><strong>公开选牌池</strong></div><span>${escapeHtml(state.draft.currentPlayerName || '玩家')} 选择 · 余 ${cards.length} 张</span></header>
            <div class="tf-draft-cards">${cards.map(card => cardMarkup(card, {
                kind: 'draft',
                interactive: true,
                disabled: !state.availableActions?.canDraft || presentationBusy || scenePlaying,
                action: 'draftCard',
            })).join('')}</div>`;
    }

    function renderRows() {
        const choosing = state.pendingRowChoice?.playerId === state.myId && rowChoiceReady && !presentationBusy && !rowChoiceSubmitting && !scenePlaying;
        const rows = presentationMatches() ? visualRows : state.rows?.length ? state.rows : Array.from({ length: 4 }, () => []);
        $('rows').innerHTML = rows.map((row, index) => {
            const heads = bullTotal(row);
            const tag = choosing ? 'button' : 'article';
            const emptySlots = Array.from({ length: Math.max(0, 5 - row.length) }, (_, slot) => `<i class="tf-empty-slot"><span>${row.length + slot + 1}</span></i>`).join('');
            const className = row.length >= 5 ? 'is-critical' : row.length >= 4 ? 'is-warning' : '';
            const isTarget = activeStep?.rowIndex === index;
            const isPicked = pendingRowIndex === index && choosing;
            const burst = collectionBurst?.rowIndex === index ? `<span class="tf-collection-burst"><b>+${collectionBurst.bullheads}</b><small>${escapeHtml(collectionBurst.playerName)} 收下 ${collectionBurst.cardCount} 张</small></span>` : '';
            return `<${tag} class="tf-row ${className} ${choosing ? 'is-selectable' : ''} ${isTarget ? 'is-resolution-target' : ''} ${isPicked ? 'is-choice-picked' : ''} ${burst ? 'is-collecting' : ''}" data-row-anchor="${index}" ${choosing ? `type="button" data-row-index="${index}" aria-pressed="${isPicked}" aria-label="收取第 ${index + 1} 行，共 ${heads} 牛头"` : ''}>
                <span class="tf-row-label"><small>牌列</small><strong>${index + 1}</strong><em>${row.length}/5</em></span>
                <span class="tf-row-track">${row.map(card => cardMarkup(card, { kind: 'row' })).join('')}${emptySlots}<i class="tf-sixth-slot"><b>6</b><small>收行</small></i></span>
                <span class="tf-row-tally"><span>${Array.from({ length: 5 }, (_, tallyIndex) => `<i class="${tallyIndex < row.length ? 'is-filled' : ''}"></i>`).join('')}</span><b>${heads}</b><small>牛头</small>${choosing ? `<em>${isPicked ? '已预选' : '选择这行'}</em>` : ''}</span>${burst}
            </${tag}>`;
        }).join('');
    }

    function renderResolution() {
        const resolution = $('resolution');
        if (state.pendingRowChoice?.playerId === state.myId) {
            resolution.className = 'tf-resolution is-alert';
            const pickedRow = pendingRowIndex === null ? null : (presentationMatches() ? visualRows : state.rows)?.[pendingRowIndex];
            const pickedHeads = bullTotal(pickedRow);
            resolution.innerHTML = `<span class="tf-resolution-mark">!</span><div><strong>${state.pendingRowChoice.card.value} 小于所有行尾</strong><small>${!rowChoiceReady ? '先看清中央翻牌与四行分值，稍后可以选择。' : pendingRowIndex === null ? '点击一行进行预选，不会立即收取。' : `已预选第 ${pendingRowIndex + 1} 行：${pickedRow?.length || 0} 张、${pickedHeads} 牛头。`}</small>${pendingRowIndex !== null && rowChoiceReady ? `<button class="tf-row-confirm" data-ui="confirmRow" type="button" ${rowChoiceSubmitting ? 'disabled' : ''}>${rowChoiceSubmitting ? '正在确认' : `确认收取第 ${pendingRowIndex + 1} 行`}<b>+${pickedHeads}</b></button>` : ''}</div>`;
            return;
        }
        if (state.pendingRowChoice) {
            resolution.className = 'tf-resolution is-waiting';
            resolution.innerHTML = `<span class="tf-resolution-mark">…</span><div><strong>${escapeHtml(state.pendingRowChoice.playerName)} 正在选择牌行</strong><small>选择完成后，将继续按数字顺序结算剩余出牌。</small></div>`;
            return;
        }
        if (state.lastHand) {
            const myResult = state.lastHand.scores?.find(player => player.id === state.myId);
            resolution.className = 'tf-resolution is-summary';
            resolution.innerHTML = `<span class="tf-resolution-mark">${state.lastHand.handNumber}</span><div><strong>第 ${state.lastHand.handNumber} 手已计分${myResult ? ` · 你本手 +${myResult.penalty}` : ''}</strong><small>${(state.lastHand.scores || []).map(player => `${escapeHtml(player.name)} ${player.total}`).join(' · ')}</small></div>`;
            return;
        }
        const latestTake = [...(state.lastResolution || [])].reverse().find(item => item.took?.length);
        resolution.className = `tf-resolution ${latestTake ? 'is-summary' : ''}`;
        resolution.innerHTML = latestTake
            ? `<span class="tf-resolution-mark">+${bullTotal(latestTake.took)}</span><div><strong>${escapeHtml(latestTake.playerName)} 收走第 ${latestTake.rowIndex + 1} 行</strong><small>${latestTake.took.length} 张牌进入牛头堆。</small></div>`
            : '<span class="tf-resolution-mark">↗</span><div><strong>同时选牌，依次入列</strong><small>所有玩家锁定后，系统会按牌面数字从小到大自动结算。</small></div>';
    }

    function renderRevealed() {
        const revealed = state.revealedCards || [];
        if (!revealed.length) {
            $('revealMeta').textContent = `${state.selectedCount || 0}/${state.playerCount || 0} 已锁定`;
            $('revealed').innerHTML = `<div class="tf-face-down-stack" aria-label="已锁定 ${state.selectedCount || 0} 张牌">${Array.from({ length: Math.min(state.selectedCount || 0, 5) }, (_, index) => `<i style="--stack:${index}"></i>`).join('')}</div><p>牌面保持隐藏，直到所有玩家完成锁定。</p>`;
            return;
        }
        $('revealMeta').textContent = `${revealed.length} 张 · 升序`;
        $('revealed').innerHTML = `<div class="tf-reveal-list">${revealed.map((item, index) => `<article>
            <span class="tf-reveal-order">${index + 1}</span>
            ${cardMarkup(item.card, { kind: 'reveal' })}
            <span><strong>${escapeHtml(item.playerName)}</strong><small>${item.card.bullheads} 牛头</small></span>
        </article>`).join('')}</div>`;
    }

    function renderHand() {
        const cards = [...(state.myHand || [])].sort((left, right) => left.value - right.value);
        const canSelect = Boolean(state.availableActions?.canSelect && !presentationBusy && !scenePlaying);
        const lockedCardId = state.mySelectedCardId;
        const pendingCard = canSelect ? cards.find(card => card.id === pendingCardId) : null;
        if (!pendingCard && !lockedCardId) pendingCardId = null;
        $('pileScore').textContent = `${state.myRoundScore || 0} 牛头`;
        $('handHint').textContent = state.phase === 'drafting'
            ? `已选 ${cards.length} / 10 张`
            : lockedCardId
                ? '本轮选择已锁定'
                : confirmingCard
                    ? '正在提交锁牌选择'
                    : pendingCard
                        ? `已选 ${pendingCard.value} · 等待确认`
                        : canSelect
                            ? `${cards.length} 张 · 先选牌再确认`
                            : `${state.myBullPileCount || 0} 张罚牌`;
        $('hand').innerHTML = cards.length
            ? cards.map(card => cardMarkup(card, {
                kind: 'hand',
                interactive: true,
                selected: card.id === lockedCardId || card.id === pendingCardId,
                disabled: !canSelect || confirmingCard,
                action: 'stageCard',
                badge: card.id === lockedCardId ? '已锁定' : card.id === pendingCardId ? '待确认' : '',
                locked: card.id === lockedCardId,
            })).join('')
            : `<div class="tf-empty-hand"><span>${state.phase === 'drafting' ? '10' : '0'}</span><strong>${state.phase === 'drafting' ? '从公开牌池选择手牌' : '本手牌已全部打出'}</strong></div>`;
        const confirm = $('handConfirm');
        confirm.classList.toggle('is-hidden', state.phase === 'drafting' || (!canSelect && !lockedCardId));
        confirm.innerHTML = lockedCardId
            ? `<span class="tf-confirmed-mark">✓</span><div><strong>本轮手牌已锁定</strong><small>等待其他玩家完成选择</small></div>`
            : pendingCard
                ? `<button class="tf-confirm-button" data-ui="confirmCard" type="button" ${confirmingCard ? 'disabled' : ''}><span>${confirmingCard ? '正在锁定' : '确认锁定'}</span><b>${pendingCard.value}</b></button><small>锁定后不可更换</small>`
                : '<button class="tf-confirm-button" type="button" disabled><span>请先选择一张牌</span></button><small>点击手牌只会预选</small>';
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('')
            : '<p>牌桌建立后，行动记录会显示在这里。</p>';
    }

    function applyVisualStep(step) {
        if (!visualRows || !Number.isInteger(step?.rowIndex) || !step.card) return;
        if (step.took?.length) visualRows[step.rowIndex] = [{ ...step.card }];
        else visualRows[step.rowIndex] = [...(visualRows[step.rowIndex] || []), { ...step.card }];
    }

    async function runResolutionPresentation(resolutionId, token = presentationToken) {
        if (presentationBusy || resolutionId !== presentationResolutionId || token !== presentationToken) return;
        presentationBusy = true;
        rowChoiceReady = false;
        if (presentationStepIndex === 0 && presentationPhase === 'backs') {
            render();
            if (!await presentationDelay(260, token)) return;
            presentationPhase = 'reveal';
            render();
            if (!await presentationDelay(480, token)) return;
        }

        while (token === presentationToken) {
            const event = currentResolution();
            const step = event?.steps?.[presentationStepIndex];
            if (!step) break;
            activeStep = step;
            collectionBurst = null;
            presentationPhase = 'focus';
            render();
            if (!await presentationDelay(step.kind === 'sixth' ? 470 : 300, token)) return;
            presentationPhase = 'depart';
            render();
            if (!await presentationDelay(step.kind === 'sixth' ? 500 : 360, token)) return;
            applyVisualStep(step);
            if (step.took?.length) {
                collectionBurst = { rowIndex: step.rowIndex, bullheads: step.bullheads, playerName: step.playerName, cardCount: step.took.length };
                presentationPhase = 'collect';
                render();
                if (!await presentationDelay(620, token)) return;
            }
            presentationStepIndex += 1;
            activeStep = null;
            collectionBurst = null;
            presentationPhase = 'reveal';
            render();
            if (!await presentationDelay(120, token)) return;
        }

        const event = currentResolution();
        presentationBusy = false;
        activeStep = null;
        collectionBurst = null;
        if (event?.status === 'waiting_choice' && state.pendingRowChoice) {
            presentationPhase = 'choice';
            render();
            if (!await presentationDelay(620, token)) return;
            if (token === presentationToken && currentResolution()?.status === 'waiting_choice') {
                rowChoiceReady = true;
                render();
            }
            return;
        }
        if (event?.status === 'complete' && presentationStepIndex >= (event.steps?.length || 0)) {
            presentationPhase = 'complete';
            visualRows = cloneRows(state.rows);
            render();
            if (!await presentationDelay(320, token)) return;
            visualRows = null;
            render();
            maybeShowSettlement();
            return;
        }
        presentationPhase = 'reveal';
        render();
    }

    function resumeResolutionPresentation() {
        const event = currentResolution();
        if (!event || presentationBusy) return;
        const hasSteps = presentationStepIndex < (event.steps?.length || 0);
        const canComplete = event.status === 'complete' && visualRows;
        if (hasSteps || canComplete) void runResolutionPresentation(event.resolutionId, presentationToken);
    }

    function maybeShowSettlement() {
        const settlement = state?.handSettlement;
        if (!settlement || settlement.settlementId === shownSettlementId || presentationBusy || visualRows) return;
        showSettlement(settlement);
    }

    function showSettlement(settlement) {
        shownSettlementId = settlement.settlementId;
        scenePlaying = true;
        const winnerIds = new Set((settlement.winners || []).map(player => player.id));
        const sorted = [...(settlement.scores || [])].sort((left, right) => left.total - right.total || left.name.localeCompare(right.name));
        const rows = sorted.map((player, index) => `<article class="${winnerIds.has(player.id) ? 'is-winner' : ''} ${player.id === state.myId ? 'is-me' : ''}"><i>${String(index + 1).padStart(2, '0')}</i><strong>${escapeHtml(player.name)}</strong><span>本手 <b>+${player.penalty}</b></span><em>${player.total} 牛头</em></article>`).join('');
        const winnerNames = (settlement.winners || []).map(player => player.name).join('、');
        const triggered = (settlement.triggeredBy || []).map(player => player.name).join('、');
        $('settlementScene').innerHTML = settlement.ended
            ? `<span class="tf-settlement-kicker">最终结算</span><div class="tf-settlement-seal">6</div><h2>${escapeHtml(winnerNames || '最低分玩家')}获胜</h2><p>${triggered ? `${escapeHtml(triggered)}累计到达 ${settlement.targetScore} 牛头；` : ''}本局以累计牛头最少者为胜。</p><div class="tf-settlement-board">${rows}</div>`
            : `<span class="tf-settlement-kicker">十轮完成</span><div class="tf-settlement-seal">${settlement.handNumber}</div><h2>第 ${settlement.handNumber} 手计分</h2><p>本手牛头已计入累计分，低分仍然领先。</p><div class="tf-settlement-board">${rows}</div>`;
        const layer = $('settlementLayer');
        layer.hidden = false;
        layer.className = `tf-settlement-layer is-active ${settlement.ended ? 'is-final' : 'is-hand'}`;
        layer.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => layer.classList.add('is-revealed'));
        clearTimeout(sceneTimer);
        sceneTimer = window.setTimeout(hideSettlement, reducedMotion ? 1100 : settlement.ended ? 3600 : 2600);
        render();
    }

    function hideSettlement() {
        clearTimeout(sceneTimer);
        sceneTimer = 0;
        const layer = $('settlementLayer');
        layer?.classList.remove('is-active', 'is-revealed', 'is-final', 'is-hand');
        layer?.setAttribute('aria-hidden', 'true');
        if (layer) layer.hidden = true;
        scenePlaying = false;
        if (state) render();
    }

    function schedulePresentationLayout() {
        cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(updatePresentationLayout);
    }

    function updatePresentationLayout() {
        const svg = $('actionLinks');
        const lineStep = activeStep || (presentationPhase === 'choice' && pendingRowIndex !== null ? {
            playerId: currentResolution()?.pendingRowChoice?.playerId,
            rowIndex: pendingRowIndex,
        } : null);
        const playerSource = lineStep?.playerId ? [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(lineStep.playerId)) : null;
        const activeCard = mount.querySelector('[data-public-active="true"]');
        const playerSourceRect = playerSource?.getBoundingClientRect();
        const source = playerSourceRect && playerSourceRect.bottom > 0 && playerSourceRect.top < window.innerHeight ? playerSource : activeCard;
        const target = Number.isInteger(lineStep?.rowIndex) ? mount.querySelector(`[data-row-anchor="${lineStep.rowIndex}"]`) : null;
        if (!source || !target || (!activeStep && pendingRowIndex === null)) {
            svg.classList.remove('is-active', 'is-danger');
            return;
        }
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const sourceX = Math.min(window.innerWidth - 12, Math.max(12, sourceRect.right - Math.min(18, sourceRect.width * .12)));
        const sourceY = Math.min(window.innerHeight - 12, Math.max(12, sourceRect.top + sourceRect.height / 2));
        const targetX = Math.min(window.innerWidth - 12, Math.max(12, targetRect.left + Math.min(targetRect.width * .72, 430)));
        const targetY = Math.min(window.innerHeight - 12, Math.max(12, targetRect.top + targetRect.height / 2));
        const path = `M ${sourceX} ${sourceY} Q ${(sourceX + targetX) / 2} ${Math.min(sourceY, targetY) - 42} ${targetX} ${targetY}`;
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        $('actionLinkGlow').setAttribute('d', path);
        $('actionLinkStroke').setAttribute('d', path);
        $('actionLinkSeal').setAttribute('cx', String(targetX));
        $('actionLinkSeal').setAttribute('cy', String(targetY));
        svg.classList.add('is-active');
        svg.classList.toggle('is-danger', Boolean(activeStep?.took?.length));

        if (activeCard && presentationPhase === 'depart') {
            const cardRect = activeCard.getBoundingClientRect();
            activeCard.style.setProperty('--tf-flight-x', `${targetX - (cardRect.left + cardRect.width / 2)}px`);
            activeCard.style.setProperty('--tf-flight-y', `${targetY - (cardRect.top + cardRect.height / 2)}px`);
            void activeCard.offsetWidth;
            activeCard.classList.add('is-flying');
        }
    }

    function openRules(trigger) {
        rulesTrigger = trigger || null;
        $('rules').classList.remove('is-hidden');
        mount.querySelector('[data-ui="closeRules"]')?.focus();
    }

    function closeRules() {
        $('rules').classList.add('is-hidden');
        rulesTrigger?.focus?.();
        rulesTrigger = null;
    }

    function handleClick(event) {
        const earlyUi = event.target.closest('[data-ui]')?.dataset.ui;
        if (scenePlaying) {
            event.preventDefault();
            if (earlyUi === 'skipSettlement') hideSettlement();
            return;
        }
        if (presentationBusy) {
            event.preventDefault();
            return;
        }
        const card = event.target.closest('[data-card-id]');
        if (card && !card.disabled) {
            if (card.dataset.cardAction === 'stageCard') {
                pendingCardId = card.dataset.cardId;
                confirmingCard = false;
                renderHand();
                return;
            }
            send({
                type: 'gameAction',
                action: { kind: card.dataset.cardAction, cardId: card.dataset.cardId },
            });
            return;
        }
        const row = event.target.closest('[data-row-index]');
        if (row && rowChoiceReady && !rowChoiceSubmitting) {
            pendingRowIndex = Number(row.dataset.rowIndex);
            render();
            return;
        }
        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;

        if (ui === 'confirmCard' && pendingCardId && !confirmingCard) {
            confirmingCard = true;
            renderHand();
            send({ type: 'gameAction', action: { kind: 'selectCard', cardId: pendingCardId } });
        }
        if (ui === 'confirmRow' && pendingRowIndex !== null && rowChoiceReady && !rowChoiceSubmitting) {
            rowChoiceSubmitting = true;
            render();
            send({ type: 'gameAction', action: { kind: 'chooseRow', rowIndex: pendingRowIndex } });
        }
        if (ui === 'rules') openRules(uiButton);
        if (ui === 'closeRules' || event.target === $('rules')) closeRules();
    }

    function handleKeydown(event) {
        if (scenePlaying) {
            if (event.key === 'Escape') hideSettlement();
            return;
        }
        if (event.key === 'Escape' && !$('rules').classList.contains('is-hidden')) closeRules();
    }

    function handleMessage(message) {
        if (message.state) {
            const previous = state;
            state = message.state;
            const event = state.resolutionEvent;
            let startPresentation = false;
            if (event?.resolutionId && event.resolutionId !== presentationResolutionId) {
                initializeResolutionPresentation(event);
                startPresentation = true;
            }
            const previousChoicePlayer = previous?.pendingRowChoice?.playerId || null;
            const nextChoicePlayer = state.pendingRowChoice?.playerId || null;
            if (previousChoicePlayer !== nextChoicePlayer || !nextChoicePlayer) {
                pendingRowIndex = null;
                rowChoiceSubmitting = false;
                rowChoiceReady = false;
            }
            if (state.mySelectedCardId || !state.availableActions?.canSelect) {
                pendingCardId = null;
                confirmingCard = false;
            }
            render();
            if (startPresentation) void runResolutionPresentation(event.resolutionId, presentationToken);
            else {
                resumeResolutionPresentation();
                if (!presentationBusy) maybeShowSettlement();
            }
        }
        if (message.type === 'error') {
            confirmingCard = false;
            rowChoiceSubmitting = false;
            if (state) renderHand();
            addLog(message.message || '操作失败', 'error');
        }
    }

    mount.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', schedulePresentationLayout);
    window.addEventListener('scroll', schedulePresentationLayout, true);

    return {
        gameType: 'takefive',
        handleMessage,
        destroy() {
            presentationToken += 1;
            for (const waiter of presentationWaiters) {
                clearTimeout(waiter.timer);
                waiter.resolve(false);
            }
            presentationWaiters.clear();
            clearTimeout(sceneTimer);
            cancelAnimationFrame(layoutFrame);
            mount.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('resize', schedulePresentationLayout);
            window.removeEventListener('scroll', schedulePresentationLayout, true);
            document.body.classList.remove('is-takefive-view');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
