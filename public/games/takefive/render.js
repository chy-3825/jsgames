import { escapeHtml } from '../common/html.js';
import { bullTotal, cardMarkup } from './cards.js';
import { getPhaseCopy, getPlayerStatus } from './state.js';

/**
 * Dynamic table rendering for 牛头王.
 *
 * Every function receives the current model and scene snapshot through the
 * factory, so rendering stays a pure consequence of state rather than an
 * additional source of game rules.
 */
export function createTakeFiveRenderer({ mount, model, scene, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const view = () => scene.getViewState();

    function render() {
        const state = model.state;
        if (!state) return;
        const sceneState = view();
        const app = mount.querySelector('.takefive-app');
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-ended', state.status === 'ended');
        app.classList.toggle('is-presenting', sceneState.presentationBusy);
        app.classList.toggle('is-scene-active', sceneState.scenePlaying);
        app.classList.toggle('is-my-action', Boolean(!sceneState.presentationBusy && !sceneState.scenePlaying && (state.availableActions?.canSelect || state.availableActions?.canDraft || (state.availableActions?.canChooseRow && sceneState.rowChoiceReady))));

        $('turn').innerHTML = `<span class="tf-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(getPhaseCopy(state, sceneState))}`;
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
        scene.schedulePresentationLayout();
    }

    function renderPublicStage() {
        const state = model.state;
        const sceneState = view();
        const stage = $('publicStage');
        const event = sceneState.currentResolution;
        const keepResolvedCards = Boolean(event && state.selectedCount === 0 && state.revealedCards?.length);
        const showResolution = Boolean(event && (sceneState.presentationBusy || sceneState.presentationPhase === 'choice' || keepResolvedCards));
        if (!showResolution) {
            const count = Number(state.selectedCount) || 0;
            stage.className = `tf-public-stage ${count ? 'is-locking' : 'is-idle'}`;
            stage.innerHTML = `<header><div><small>中央公共区</small><strong>${count ? '暗牌锁定中' : '等待本轮出牌'}</strong></div><span>${count} / ${state.playerCount || 0} 已锁定</span></header>
                <div class="tf-public-backs" aria-label="${count} 名玩家已锁定">${Array.from({ length: Math.min(count, 10) }, (_, index) => `<i style="--public-back:${index}"></i>`).join('') || '<em>所有人锁定后，牌面将在这里同时翻开</em>'}</div>`;
            return;
        }
        const choiceCardId = event.pendingRowChoice?.card?.id;
        const cards = event.revealedCards || [];
        const faceDown = sceneState.presentationPhase === 'backs';
        stage.className = `tf-public-stage is-resolution is-${sceneState.presentationPhase}`;
        stage.innerHTML = `<header><div><small>本轮公开结算</small><strong>${faceDown ? '即将同时翻牌' : '按数字升序入列'}</strong></div><span>${Math.min(sceneState.presentationStepIndex, cards.length)} / ${cards.length} 已处理</span></header>
            <div class="tf-public-cards">${cards.map((item, index) => {
                const isActive = sceneState.activeStep?.card?.id === item.card.id || (!sceneState.activeStep && sceneState.presentationPhase === 'choice' && choiceCardId === item.card.id);
                const resolved = index < sceneState.presentationStepIndex;
                const extraClass = `${faceDown ? 'is-face-down' : ''} ${isActive ? 'is-active' : ''} ${resolved ? 'is-resolved' : ''} ${isActive && sceneState.presentationPhase === 'depart' ? 'is-departing' : ''}`;
                return `<article class="tf-public-card-wrap ${isActive ? 'is-current' : ''}" data-public-player-id="${escapeHtml(item.playerId)}"><span>${escapeHtml(item.playerName)}</span>${cardMarkup(item.card, { kind: 'public', extraClass, dataAttributes: `data-public-card-id="${escapeHtml(item.card.id)}"${isActive ? ' data-public-active="true"' : ''}` })}</article>`;
            }).join('')}</div>`;
    }

    function renderRoundProgress() {
        const state = model.state;
        const current = state.phase === 'drafting' ? 0 : Number(state.round) || 0;
        $('roundProgress').innerHTML = Array.from({ length: state.maxRounds || 10 }, (_, index) => {
            const round = index + 1;
            return `<i class="${round < current ? 'is-done' : round === current ? 'is-current' : ''}" title="第 ${round} 轮"><span>${round}</span></i>`;
        }).join('');
    }

    function renderPlayers() {
        const state = model.state;
        const sceneState = view();
        const players = state.players || [];
        $('playerMeta').textContent = `${players.length} 人 · 低分领先`;
        const activePlayerId = sceneState.activeStep?.playerId || (sceneState.presentationPhase === 'choice' ? sceneState.currentResolution?.pendingRowChoice?.playerId : null);
        $('players').innerHTML = players.map((player, index) => `<article class="tf-player ${player.id === state.myId ? 'is-me' : ''} ${player.hasSelected ? 'is-ready' : ''} ${player.isOnline === false ? 'is-offline' : ''} ${activePlayerId === player.id ? 'is-resolving' : ''}" data-player-id="${escapeHtml(player.id)}">
            <span class="tf-player-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="tf-avatar">${escapeHtml(player.name.slice(0, 1))}</span>
            <span class="tf-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${escapeHtml(getPlayerStatus(state, player))}</small></span>
            <span class="tf-player-score"><b>${Number(player.score) || 0}</b><small>累计</small></span>
        </article>`).join('');
    }

    function renderDraft() {
        const state = model.state;
        const sceneState = view();
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
                disabled: !state.availableActions?.canDraft || sceneState.presentationBusy || sceneState.scenePlaying,
                action: 'draftCard',
            })).join('')}</div>`;
    }

    function renderRows() {
        const state = model.state;
        const sceneState = view();
        const choosing = state.pendingRowChoice?.playerId === state.myId && sceneState.rowChoiceReady && !sceneState.presentationBusy && !model.rowChoiceSubmitting && !sceneState.scenePlaying;
        const rows = sceneState.presentationMatches ? sceneState.visualRows : state.rows?.length ? state.rows : Array.from({ length: 4 }, () => []);
        $('rows').innerHTML = rows.map((row, index) => {
            const heads = bullTotal(row);
            const tag = choosing ? 'button' : 'article';
            const emptySlots = Array.from({ length: Math.max(0, 5 - row.length) }, (_, slot) => `<i class="tf-empty-slot"><span>${row.length + slot + 1}</span></i>`).join('');
            const className = row.length >= 5 ? 'is-critical' : row.length >= 4 ? 'is-warning' : '';
            const isTarget = sceneState.activeStep?.rowIndex === index;
            const isPicked = model.pendingRowIndex === index && choosing;
            const burst = sceneState.collectionBurst?.rowIndex === index ? `<span class="tf-collection-burst"><b>+${sceneState.collectionBurst.bullheads}</b><small>${escapeHtml(sceneState.collectionBurst.playerName)} 收下 ${sceneState.collectionBurst.cardCount} 张</small></span>` : '';
            return `<${tag} class="tf-row ${className} ${choosing ? 'is-selectable' : ''} ${isTarget ? 'is-resolution-target' : ''} ${isPicked ? 'is-choice-picked' : ''} ${burst ? 'is-collecting' : ''}" data-row-anchor="${index}" ${choosing ? `type="button" data-row-index="${index}" aria-pressed="${isPicked}" aria-label="收取第 ${index + 1} 行，共 ${heads} 牛头"` : ''}>
                <span class="tf-row-label"><small>牌列</small><strong>${index + 1}</strong><em>${row.length}/5</em></span>
                <span class="tf-row-track">${row.map(card => cardMarkup(card, { kind: 'row' })).join('')}${emptySlots}<i class="tf-sixth-slot"><b>6</b><small>收行</small></i></span>
                <span class="tf-row-tally"><span>${Array.from({ length: 5 }, (_, tallyIndex) => `<i class="${tallyIndex < row.length ? 'is-filled' : ''}"></i>`).join('')}</span><b>${heads}</b><small>牛头</small>${choosing ? `<em>${isPicked ? '已预选' : '选择这行'}</em>` : ''}</span>${burst}
            </${tag}>`;
        }).join('');
    }

    function renderResolution() {
        const state = model.state;
        const sceneState = view();
        const resolution = $('resolution');
        if (sceneState.presentationBusy) {
            resolution.className = 'tf-resolution is-waiting';
            resolution.innerHTML = `<span class="tf-resolution-mark">↓</span><div><strong>正在按数字从小到大结算</strong><small>可以观看每张牌入列，或直接跳到本轮最终牌面。</small><button class="tf-row-confirm" data-ui="skipResolution" type="button">跳过本轮动画</button></div>`;
            return;
        }
        if (state.pendingRowChoice?.playerId === state.myId) {
            resolution.className = 'tf-resolution is-alert';
            const pickedRow = model.pendingRowIndex === null ? null : (sceneState.presentationMatches ? sceneState.visualRows : state.rows)?.[model.pendingRowIndex];
            const pickedHeads = bullTotal(pickedRow);
            resolution.innerHTML = `<span class="tf-resolution-mark">!</span><div><strong>${state.pendingRowChoice.card.value} 小于所有行尾</strong><small>${!sceneState.rowChoiceReady ? '先看清中央翻牌与四行分值，稍后可以选择。' : model.pendingRowIndex === null ? '点击一行进行预选，不会立即收取。' : `已预选第 ${model.pendingRowIndex + 1} 行：${pickedRow?.length || 0} 张、${pickedHeads} 牛头。`}</small>${model.pendingRowIndex !== null && sceneState.rowChoiceReady ? `<button class="tf-row-confirm" data-ui="confirmRow" type="button" ${model.rowChoiceSubmitting ? 'disabled' : ''}>${model.rowChoiceSubmitting ? '正在确认' : `确认收取第 ${model.pendingRowIndex + 1} 行`}<b>+${pickedHeads}</b></button>` : ''}</div>`;
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
        const state = model.state;
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
        const state = model.state;
        const sceneState = view();
        const cards = [...(state.myHand || [])].sort((left, right) => left.value - right.value);
        const canSelect = Boolean(state.availableActions?.canSelect && !sceneState.presentationBusy && !sceneState.scenePlaying);
        const lockedCardId = state.mySelectedCardId;
        const pendingCard = canSelect ? cards.find(card => card.id === model.pendingCardId) : null;
        if (!pendingCard && !lockedCardId) model.pendingCardId = null;
        $('pileScore').textContent = `${state.myRoundScore || 0} 牛头`;
        $('handHint').textContent = state.phase === 'drafting'
            ? `已选 ${cards.length} / 10 张`
            : lockedCardId
                ? '本轮选择已锁定'
                : model.confirmingCard
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
                selected: card.id === lockedCardId || card.id === model.pendingCardId,
                disabled: !canSelect || model.confirmingCard,
                action: 'stageCard',
                badge: card.id === lockedCardId ? '已锁定' : card.id === model.pendingCardId ? '待确认' : '',
                locked: card.id === lockedCardId,
            })).join('')
            : `<div class="tf-empty-hand"><span>${state.phase === 'drafting' ? '10' : '0'}</span><strong>${state.phase === 'drafting' ? '从公开牌池选择手牌' : '本手牌已全部打出'}</strong></div>`;
        const confirm = $('handConfirm');
        confirm.classList.toggle('is-hidden', state.phase === 'drafting' || (!canSelect && !lockedCardId));
        confirm.innerHTML = lockedCardId
            ? `<span class="tf-confirmed-mark">✓</span><div><strong>本轮手牌已锁定</strong><small>等待其他玩家完成选择</small></div>`
            : model.pendingCardId && pendingCard
                ? `<button class="tf-confirm-button" data-ui="confirmCard" type="button" ${model.confirmingCard ? 'disabled' : ''}><span>${model.confirmingCard ? '正在锁定' : '确认锁定'}</span><b>${pendingCard.value}</b></button><small>锁定后不可更换</small>`
                : '<button class="tf-confirm-button" type="button" disabled><span>请先选择一张牌</span></button><small>点击手牌只会预选</small>';
    }

    function renderLog() {
        const entries = (model.state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('')
            : '<p>牌桌建立后，行动记录会显示在这里。</p>';
    }

    return Object.freeze({ render, renderHand });
}
