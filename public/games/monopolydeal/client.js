import { getGameStyleHrefs } from '../common/game-manifest.js?v=20260910-game-feedback-1';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createMonopolyDealActions } from './actions.js';
import { createMonopolyDealModel, rentGroups, selectedCard, updateDecisionWindow, updateGroupHighlights, updateTransferPresentation } from './state.js';
import { createMonopolyDealTemplate } from './template.js';
import { createMonopolyDealRenderer } from './render.js';
import { createMonopolyDealScene } from './scene.js';
import { createMonopolyDealPresentation } from './presentation.js';

/** Thin protocol/lifecycle entry for 大富翁纸牌. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('monopolydeal'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-monopolydeal-view');
    const model = createMonopolyDealModel();
    mount.innerHTML = createMonopolyDealTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const rulesModal = createModalController({ root: mount.querySelector('.deal-game'), overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const archiveModal = createModalController({ root: mount.querySelector('.deal-game'), overlay: getElement('archiveOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-action="openArchive"]') });
    const renderer = createMonopolyDealRenderer({ mount, model, getElement });
    const scene = createMonopolyDealScene({
        mount,
        model,
        getElement,
        windowRef,
        renderer,
        onEvent: event => {
            model.presentationEvent = event;
            renderer.renderEvent?.();
            renderer.scheduleActionPresentation?.();
        },
        onPresentationStart: () => {
            // A public slot owns the whole table. Close local choice surfaces
            // so they cannot cover or compete with the shared announcement.
            model.choiceMode = null;
            model.archiveKind = null;
            rulesModal.setOpen?.(false);
            archiveModal.setOpen?.(false);
            renderer.render?.();
        },
    });
    const actions = createMonopolyDealActions({ mount, model, scene, renderer, send, rulesModal, archiveModal, getElement });
    const presentation = createMonopolyDealPresentation({ model, renderer, scene });
    mount.addEventListener('change', actions.handleChange, { signal: scope.signal });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('mouseover', actions.handlePointerOver, { signal: scope.signal });
    mount.addEventListener('mouseout', actions.handlePointerOut, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    mount.addEventListener('scroll', renderer.scheduleActionPresentation, { capture: true, signal: scope.signal });
    windowRef.addEventListener('resize', renderer.scheduleActionPresentation, { signal: scope.signal });
    renderer.scheduleActionPresentation();

    function handleMessage(message) {
        if (message.state) {
            actions.setSubmissionPending(false);
            const previous = model.state;
            const previousInteractionId = previous?.interaction?.interactionId ?? null;
            presentation.captureState(previous, message.state);
            const becameMyTurn = Boolean(message.state.myIsCurrentTurn && (!previous?.myIsCurrentTurn || Number(previous?.turnNumber || 0) !== Number(message.state.turnNumber || 0)));
            model.state = message.state;
            const interactionId = model.state.interaction?.interactionId ?? null;
            if (previous && interactionId && interactionId !== previousInteractionId) model.animateInteractionId = interactionId;
            updateDecisionWindow(model, previous, model.state, renderer.render);
            updateGroupHighlights(model, previous, model.state, windowRef, renderer.render);
            updateTransferPresentation(model, previous, model.state, windowRef, renderer.renderEvent, renderer.scheduleActionPresentation);
            presentation.enqueueStatePresentations(model.state);
            if (model.selected !== null && !model.state.myHand?.[model.selected]) model.selected = null;
            if (model.hoveredCardIndex !== null && !model.state.myHand?.[model.hoveredCardIndex]) model.hoveredCardIndex = null;
            if (model.hoveredCardIndex !== null && (!model.state.myIsCurrentTurn || model.state.pendingAction || model.state.pendingDebt)) model.hoveredCardIndex = null;
            const valid = new Set((model.state.myPaymentOptions || []).map(item => item.id));
            model.paymentIds = model.paymentIds.filter(id => valid.has(id));
            if (model.state.myPendingDoubleRent && model.state.availableActions?.canPlay && model.selected === null) {
                const rentIndex = (model.state.myHand || []).findIndex(card => card.kind === 'rent' && rentGroups(model.state, card).length > 0);
                if (rentIndex >= 0) { model.selected = rentIndex; model.choiceMode = 'rent'; }
            }
            const paying = model.state.pendingDebt?.payerId === model.state.myId;
            const wasPaying = previous?.pendingDebt?.payerId === previous?.myId && Boolean(previous?.pendingDebt);
            if (paying && (!wasPaying || interactionId !== previousInteractionId)) { model.paymentIds = []; model.assetPicking = false; model.archiveKind = 'payment'; }
            if (!paying && model.archiveKind === 'payment') { model.archiveKind = null; archiveModal.setOpen(false); }
            renderer.render();
            if (paying && model.archiveKind === 'payment') { renderer.renderArchive('payment'); archiveModal.setOpen(true); }
            presentation.drainAssetCollections();
            if (becameMyTurn && model.state.status === 'playing') renderer.showTurnToast?.();
            if (archiveModal.isOpen() && model.archiveKind) renderer.renderArchive?.(model.archiveKind);
        }
        if (message.type === 'error') {
            actions.setSubmissionPending(false);
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }

    return {
        gameType: 'monopolydeal',
        handleMessage,
        destroy() {
            clearTimeout(model.decisionTimer);
            clearTimeout(model.transferTimer);
            clearTimeout(model.groupHighlightTimer);
            clearTimeout(model.turnToastTimer);
            clearTimeout(model.victoryTimer);
            presentation.destroy();
            const cancel = windowRef.cancelAnimationFrame || globalThis.cancelAnimationFrame;
            cancel?.(model.actionLayoutFrame);
            scene.destroy();
            rulesModal.destroy();
            archiveModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-monopolydeal-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
