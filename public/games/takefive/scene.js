import { escapeHtml } from '../common/html.js';
import { cloneRows } from './state.js';

/**
 * Resolution and settlement presentation for 牛头王.
 *
 * The server remains authoritative for rows and scores.  This module only
 * keeps a temporary visual copy while cards travel into their rows, and owns
 * every timer/animation frame used by that presentation.
 */
export function createTakeFiveScene({ model, mount, getElement, windowRef = globalThis.window || globalThis, documentRef = globalThis.document, getRender = () => null }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const requestFrame = callback => (windowRef?.requestAnimationFrame ? windowRef.requestAnimationFrame(callback) : windowRef?.setTimeout(callback, 0));
    const cancelFrame = id => (windowRef?.cancelAnimationFrame ? windowRef.cancelAnimationFrame(id) : windowRef?.clearTimeout(id));
    const setTimeoutRef = windowRef?.setTimeout?.bind(windowRef) || globalThis.setTimeout;
    const clearTimeoutRef = windowRef?.clearTimeout?.bind(windowRef) || globalThis.clearTimeout;
    const reducedMotion = windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let presentationResolutionId = null;
    let presentationStepIndex = 0;
    let presentationPhase = 'idle';
    let presentationBusy = false;
    let presentationToken = 0;
    let visualRows = null;
    let activeStep = null;
    let collectionBurst = null;
    let rowChoiceReady = false;
    let shownSettlementId = null;
    let scenePlaying = false;
    let sceneTimer = 0;
    let layoutFrame = 0;
    const presentationWaiters = new Set();

    const render = () => getRender()?.();

    function currentResolution() {
        return model.state?.resolutionEvent?.resolutionId === presentationResolutionId ? model.state.resolutionEvent : null;
    }

    function presentationMatches() {
        return Boolean(currentResolution() && visualRows);
    }

    function getViewState() {
        return {
            currentResolution: currentResolution(),
            presentationResolutionId,
            presentationStepIndex,
            presentationPhase,
            presentationBusy,
            presentationMatches: presentationMatches(),
            visualRows,
            activeStep,
            collectionBurst,
            rowChoiceReady,
            scenePlaying,
        };
    }

    function presentationDelay(duration, token) {
        return new Promise(resolve => {
            const waiter = { timer: 0, resolve };
            waiter.timer = setTimeoutRef(() => {
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
        model.pendingRowIndex = null;
        model.rowChoiceSubmitting = false;
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
        if (event?.status === 'waiting_choice' && model.state.pendingRowChoice) {
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
            visualRows = cloneRows(model.state.rows);
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
        const settlement = model.state?.handSettlement;
        if (!settlement || settlement.settlementId === shownSettlementId || presentationBusy || visualRows) return;
        showSettlement(settlement);
    }

    function showSettlement(settlement) {
        shownSettlementId = settlement.settlementId;
        scenePlaying = true;
        const winnerIds = new Set((settlement.winners || []).map(player => player.id));
        const sorted = [...(settlement.scores || [])].sort((left, right) => left.total - right.total || left.name.localeCompare(right.name));
        const rows = sorted.map((player, index) => `<article class="${winnerIds.has(player.id) ? 'is-winner' : ''} ${player.id === model.state.myId ? 'is-me' : ''}"><i>${String(index + 1).padStart(2, '0')}</i><strong>${escapeHtml(player.name)}</strong><span>本手 <b>+${player.penalty}</b></span><em>${player.total} 牛头</em></article>`).join('');
        const winnerNames = (settlement.winners || []).map(player => player.name).join('、');
        const triggered = (settlement.triggeredBy || []).map(player => player.name).join('、');
        $('settlementScene').innerHTML = settlement.ended
            ? `<span class="tf-settlement-kicker">最终结算</span><div class="tf-settlement-seal">6</div><h2>${escapeHtml(winnerNames || '最低分玩家')}获胜</h2><p>${triggered ? `${escapeHtml(triggered)}累计到达 ${settlement.targetScore} 牛头；` : ''}本局以累计牛头最少者为胜。</p><div class="tf-settlement-board">${rows}</div>`
            : `<span class="tf-settlement-kicker">十轮完成</span><div class="tf-settlement-seal">${settlement.handNumber}</div><h2>第 ${settlement.handNumber} 手计分</h2><p>本手牛头已计入累计分，低分仍然领先。</p><div class="tf-settlement-board">${rows}</div>`;
        const layer = $('settlementLayer');
        layer.hidden = false;
        layer.className = `tf-settlement-layer is-active ${settlement.ended ? 'is-final' : 'is-hand'}`;
        layer.setAttribute('aria-hidden', 'false');
        requestFrame(() => {
            layer.classList.add('is-revealed');
            layer.querySelector('[data-ui="skipSettlement"]')?.focus({ preventScroll: true });
        });
        clearTimeoutRef(sceneTimer);
        sceneTimer = 0;
        render();
    }

    function hideSettlement() {
        clearTimeoutRef(sceneTimer);
        sceneTimer = 0;
        const layer = $('settlementLayer');
        layer?.classList.remove('is-active', 'is-revealed', 'is-final', 'is-hand');
        layer?.setAttribute('aria-hidden', 'true');
        if (layer) layer.hidden = true;
        scenePlaying = false;
        if (model.state) render();
    }

    function schedulePresentationLayout() {
        if (layoutFrame) cancelFrame(layoutFrame);
        layoutFrame = requestFrame(() => {
            layoutFrame = 0;
            updatePresentationLayout();
        });
    }

    function updatePresentationLayout() {
        const svg = $('actionLinks');
        const lineStep = activeStep || (presentationPhase === 'choice' && model.pendingRowIndex !== null ? {
            playerId: currentResolution()?.pendingRowChoice?.playerId,
            rowIndex: model.pendingRowIndex,
        } : null);
        const playerSource = lineStep?.playerId ? [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(lineStep.playerId)) : null;
        const activeCard = mount.querySelector('[data-public-active="true"]');
        const playerSourceRect = playerSource?.getBoundingClientRect();
        const viewportHeight = Number(windowRef?.innerHeight) || 0;
        const viewportWidth = Number(windowRef?.innerWidth) || 0;
        const source = playerSourceRect && playerSourceRect.bottom > 0 && playerSourceRect.top < viewportHeight ? playerSource : activeCard;
        const target = Number.isInteger(lineStep?.rowIndex) ? mount.querySelector(`[data-row-anchor="${lineStep.rowIndex}"]`) : null;
        if (!source || !target || (!activeStep && model.pendingRowIndex === null)) {
            svg.classList.remove('is-active', 'is-danger');
            return;
        }
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const sourceX = Math.min(viewportWidth - 12, Math.max(12, sourceRect.right - Math.min(18, sourceRect.width * .12)));
        const sourceY = Math.min(viewportHeight - 12, Math.max(12, sourceRect.top + sourceRect.height / 2));
        const targetX = Math.min(viewportWidth - 12, Math.max(12, targetRect.left + Math.min(targetRect.width * .72, 430)));
        const targetY = Math.min(viewportHeight - 12, Math.max(12, targetRect.top + targetRect.height / 2));
        const path = `M ${sourceX} ${sourceY} Q ${(sourceX + targetX) / 2} ${Math.min(sourceY, targetY) - 42} ${targetX} ${targetY}`;
        svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
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

    function skipResolutionPresentation() {
        const event = currentResolution();
        if (!event) return;
        presentationToken += 1;
        for (const waiter of presentationWaiters) {
            clearTimeoutRef(waiter.timer);
            waiter.resolve(false);
        }
        presentationWaiters.clear();
        presentationStepIndex = event.steps?.length || 0;
        presentationBusy = false;
        activeStep = null;
        collectionBurst = null;
        visualRows = cloneRows(model.state.rows);
        if (event.status === 'waiting_choice' && model.state.pendingRowChoice) {
            presentationPhase = 'choice';
            rowChoiceReady = true;
        } else {
            presentationPhase = 'complete';
            visualRows = null;
        }
        render();
        maybeShowSettlement();
    }

    function destroy() {
        presentationToken += 1;
        for (const waiter of presentationWaiters) {
            clearTimeoutRef(waiter.timer);
            waiter.resolve(false);
        }
        presentationWaiters.clear();
        clearTimeoutRef(sceneTimer);
        if (layoutFrame) cancelFrame(layoutFrame);
        layoutFrame = 0;
    }

    return Object.freeze({
        getViewState,
        currentResolution,
        initializeResolutionPresentation,
        runResolutionPresentation,
        resumeResolutionPresentation,
        maybeShowSettlement,
        showSettlement,
        hideSettlement,
        schedulePresentationLayout,
        skipResolutionPresentation,
        destroy,
    });
}
