import { esc, renderCardBack, renderSceneCard } from './cards.js';
import { discardValue, isOut, roundOutcome } from './state.js';

/** Presentation queue, action routes and acknowledgement timers for 情书. */
export function createLoveLetterScene({ mount, model, send, getElement, windowRef = globalThis.window || globalThis, getRender = () => null }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const requestFrame = callback => (windowRef?.requestAnimationFrame ? windowRef.requestAnimationFrame(callback) : windowRef?.setTimeout(callback, 0));
    const cancelFrame = id => (windowRef?.cancelAnimationFrame ? windowRef.cancelAnimationFrame(id) : windowRef?.clearTimeout(id));
    const setTimeoutRef = windowRef?.setTimeout?.bind(windowRef) || globalThis.setTimeout;
    const clearTimeoutRef = windowRef?.clearTimeout?.bind(windowRef) || globalThis.clearTimeout;
    const reducedMotion = windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let animateActionId = null;
    let centeredActionId = null;
    let actionLayoutFrame = 0;
    let actionSettleTimer = 0;
    let acknowledgementTimer = 0;
    let acknowledgementClock = 0;
    let scenePlaying = false;
    let sceneToken = 0;
    let sceneQueue = [];
    const sceneWaiters = new Set();

    const render = () => getRender()?.();

    function getViewState() {
        return { scenePlaying, animateActionId, centeredActionId };
    }

    function enqueueScenes(scenes) {
        if (!scenes.length) return;
        sceneQueue.push(...scenes);
        void playSceneQueue();
    }

    async function playSceneQueue() {
        if (scenePlaying) return;
        scenePlaying = true;
        mount.querySelector('.ll-app')?.classList.add('is-scene-active');
        while (sceneQueue.length) {
            const item = sceneQueue.shift();
            const token = ++sceneToken;
            if (item.type === 'elimination') await playEliminationScene(item, token);
            if (item.type === 'showdown') await playShowdownScene(item, token);
            if (token === sceneToken) hideScene();
        }
        scenePlaying = false;
        mount.querySelector('.ll-app')?.classList.remove('is-scene-active');
    }

    async function playEliminationScene(item, token) {
        const outcome = item.outcome;
        showScene('elimination', `<div class="ll-elimination-mark" aria-hidden="true"><span></span></div>
            <div class="ll-scene-kicker">信件退回</div>
            <div class="ll-elimination-reveal">${item.card ? renderSceneCard(item.card) : '<span class="ll-broken-seal" aria-hidden="true">♥</span>'}</div>
            <h2>${esc(item.player.name)}出局</h2>
            <p>${esc(item.reason)}</p>
            ${outcome ? renderSceneOutcome(outcome) : ''}`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        if (!await sceneDelay(1050, token)) return;
        if (outcome) {
            $('sceneLayer').classList.add('is-decided');
            if (!await sceneDelay(outcome.gameEnded ? 1350 : 1050, token)) return;
        } else {
            await sceneDelay(250, token);
        }
    }

    async function playShowdownScene(item, token) {
        const finalState = item.state;
        const discardTotals = Object.fromEntries((finalState.players || []).map(player => [player.id, discardValue(finalState, player.id)]));
        const contenders = (finalState.players || []).filter(player => !isOut(player) && (player.finalHand || player.hand || [])[0]).map((player, index) => ({
            id: player.id,
            name: player.name,
            card: (player.finalHand || player.hand)[0],
            discardValue: discardTotals[player.id] || 0,
            index,
        }));
        const highestHand = Math.max(0, ...contenders.map(player => Number(player.card?.value ?? player.card?.id ?? 0)));
        const highestPlayers = contenders.filter(player => Number(player.card?.value ?? player.card?.id ?? 0) === highestHand);
        const needsTiebreak = highestPlayers.length > 1;
        const winnerIds = new Set((finalState.roundWinners || []).map(player => player.id));
        const outcome = roundOutcome(finalState);
        showScene('showdown', `<div class="ll-scene-kicker">最终拼点</div>
            <h2>最后一封信已经送出</h2>
            <p>牌库耗尽，仍在场的玩家同时公开手牌。</p>
            <div class="ll-showdown-grid">${contenders.map(player => renderShowdownPlayer(player, winnerIds.has(player.id))).join('')}</div>
            ${needsTiebreak ? '<div class="ll-tiebreak-note"><span>手牌同点</span><strong>比较公开弃牌总点数</strong></div>' : ''}
            ${outcome ? renderSceneOutcome(outcome) : ''}`);
        if (!await sceneDelay(550, token)) return;
        $('sceneLayer').classList.add('is-revealed');
        if (!await sceneDelay(850, token)) return;
        if (needsTiebreak) {
            $('sceneLayer').classList.add('is-tiebreak');
            if (!await sceneDelay(650, token)) return;
        }
        $('sceneLayer').classList.add('is-decided');
        await sceneDelay(outcome?.gameEnded ? 1250 : 1000, token);
    }

    function showScene(kind, html) {
        const layer = $('sceneLayer');
        layer.hidden = false;
        layer.className = `ll-scene-layer is-active is-${kind}`;
        layer.setAttribute('aria-hidden', 'false');
        $('scene').innerHTML = html;
    }

    function hideScene() {
        const layer = $('sceneLayer');
        layer.className = 'll-scene-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('scene').innerHTML = '';
        layer.hidden = true;
    }

    function skipScene() {
        if (!scenePlaying) return;
        sceneToken += 1;
        for (const waiter of sceneWaiters) {
            clearTimeoutRef(waiter.timer);
            waiter.resolve(false);
        }
        sceneWaiters.clear();
        sceneQueue = [];
        hideScene();
        scenePlaying = false;
        mount.querySelector('.ll-app')?.classList.remove('is-scene-active');
    }

    function sceneDelay(duration, token) {
        const wait = reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                resolve(value) {
                    sceneWaiters.delete(waiter);
                    resolve(value);
                },
            };
            waiter.timer = setTimeoutRef(() => waiter.resolve(token === sceneToken), wait);
            sceneWaiters.add(waiter);
        });
    }

    function renderShowdownPlayer(player, winner) {
        const value = Number(player.card?.value ?? player.card?.id);
        return `<article class="ll-showdown-player ${winner ? 'is-winner' : ''}" style="--ll-order:${player.index}">
            <strong>${esc(player.name)}</strong>
            <div class="ll-showdown-card"><div class="ll-showdown-card-inner">
                <div class="ll-showdown-side is-back">${renderCardBack('密封', '', `${player.name}的隐藏手牌`)}</div>
                <div class="ll-showdown-side is-front">${renderSceneCard(player.card)}</div>
            </div></div>
            <span class="ll-hand-value">手牌 <b>${value}</b> 点</span>
            <span class="ll-discard-value">弃牌合计 <b>${player.discardValue}</b> 点</span>
        </article>`;
    }

    function renderSceneOutcome(outcome) {
        const names = outcome.winners.map(player => player.name).join('、') || '无人';
        const scores = outcome.winners.map(player => {
            const count = Number(outcome.favorTokens.find(token => token.id === player.id)?.count || 0);
            return `${esc(player.name)} ${Math.min(count, outcome.targetFavor)}/${outcome.targetFavor}`;
        }).join(' · ');
        return `<div class="ll-scene-outcome"><span>${outcome.gameEnded ? '情书送达' : '本轮胜者'}</span><strong>${esc(names)}${outcome.gameEnded ? '赢得情书' : '获得一枚爱心'}</strong><small><i aria-hidden="true">♥</i>${scores}</small></div>`;
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function scheduleActionPresentation() {
        if (actionLayoutFrame) cancelFrame(actionLayoutFrame);
        layoutActionPresentation();
        actionLayoutFrame = requestFrame(() => {
            actionLayoutFrame = 0;
            layoutActionPresentation();
        });
    }

    function layoutActionPresentation() {
        const state = model.state;
        const action = state?.pendingAction || state?.lastAction;
        const card = $('playedCard');
        if (card && action?.actionId === animateActionId) {
            const source = playerAnchor(action.playerId);
            const cardRect = card.getBoundingClientRect();
            const sourceRect = source?.getBoundingClientRect();
            const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : (Number(windowRef?.innerWidth) || 0) / 2;
            const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : Number(windowRef?.innerHeight) || 0;
            card.style.setProperty('--ll-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`);
            card.style.setProperty('--ll-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`);
            void card.offsetWidth;
            card.classList.add('is-entering');
            animateActionId = null;
        }
        updateActionLink();
    }

    function updateActionLink() {
        const state = model.state;
        const link = $('actionLink');
        const announced = state?.pendingAction;
        if (!announced) {
            link.classList.remove('is-visible');
            centeredActionId = null;
            return;
        }
        const source = playerAnchor(announced.playerId);
        const target = playerAnchor(announced.targetId);
        if (!source || !target) {
            link.classList.remove('is-visible');
            return;
        }
        if (centeredActionId !== announced.actionId && target.closest('[data-role="seats"]')) {
            const scroller = $('seats');
            const desired = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
            scroller.scrollTo({ left: Math.max(0, desired), behavior: reducedMotion ? 'auto' : 'smooth' });
            centeredActionId = announced.actionId;
            clearTimeoutRef(actionSettleTimer);
            actionSettleTimer = setTimeoutRef(scheduleActionPresentation, reducedMotion ? 0 : 280);
        }
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = Number(windowRef?.innerWidth) || 0;
        const height = Number(windowRef?.innerHeight) || 0;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, width - 12);
        const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, height - 12);
        const targetX = clamp(targetRect.left + targetRect.width / 2, 12, width - 12);
        const targetY = clamp(targetRect.top + targetRect.height / 2, 12, height - 12);
        const middleX = (sourceX + targetX) / 2;
        const middleY = (sourceY + targetY) / 2 - Math.min(74, Math.max(24, Math.abs(targetX - sourceX) * .11));
        const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`;
        link.setAttribute('viewBox', `0 0 ${width} ${height}`);
        $('actionLinkGlow').setAttribute('d', path);
        $('actionLinkStroke').setAttribute('d', path);
        $('actionLinkSeal').setAttribute('cx', String(targetX));
        $('actionLinkSeal').setAttribute('cy', String(targetY));
        link.classList.add('is-visible');
    }

    function scheduleAcknowledgement() {
        clearTimeoutRef(acknowledgementTimer);
        clearTimeoutRef(acknowledgementClock);
        const state = model.state;
        const announced = state?.pendingAction;
        if (!announced) return;
        acknowledgementClock = setTimeoutRef(() => {
            if (model.state?.pendingAction?.actionId === announced.actionId) render();
        }, 250);
        const isTarget = announced.targetId === state.myId;
        const isActor = announced.playerId === state.myId;
        const isHostBackup = state.hostId === state.myId;
        if (!isTarget && !isActor && !isHostBackup) return;
        const fallbackDelay = isTarget ? 40 : isActor ? 650 : 1050;
        const delay = Math.max(0, model.acknowledgementDeadline - Date.now()) + fallbackDelay;
        acknowledgementTimer = setTimeoutRef(() => acknowledgePendingAction(true), delay);
    }

    function acknowledgePendingAction(automatic = false) {
        const state = model.state;
        const announced = state?.pendingAction;
        if (!announced || model.pendingAction) return;
        if (!automatic && announced.targetId !== state.myId) return;
        model.pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'acknowledgeAction', actionId: announced.actionId } });
        render();
    }

    function markAction(actionId) {
        animateActionId = actionId;
    }

    function destroy() {
        sceneQueue = [];
        skipScene();
        clearTimeoutRef(actionSettleTimer);
        clearTimeoutRef(acknowledgementTimer);
        clearTimeoutRef(acknowledgementClock);
        if (actionLayoutFrame) cancelFrame(actionLayoutFrame);
        actionLayoutFrame = 0;
    }

    return Object.freeze({
        getViewState,
        enqueueScenes,
        skipScene,
        scheduleActionPresentation,
        scheduleAcknowledgement,
        acknowledgePendingAction,
        markAction,
        destroy,
    });
}
