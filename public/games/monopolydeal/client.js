import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createMonopolyDealActions } from './actions.js';
import { createMonopolyDealModel, rentGroups, selectedCard, transferKey, updateDecisionWindow, updateGroupHighlights, updateTransferPresentation } from './state.js';
import { createMonopolyDealTemplate } from './template.js';
import { createMonopolyDealRenderer } from './render.js';
import { createMonopolyDealScene } from './scene.js';

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
    const renderer = createMonopolyDealRenderer({ mount, model, getElement });
    const scene = createMonopolyDealScene({ mount, model, getElement, windowRef });
    const actions = createMonopolyDealActions({ mount, model, scene, renderer, send, rulesModal, getElement });
    mount.addEventListener('change', actions.handleChange, { signal: scope.signal });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    mount.addEventListener('scroll', renderer.scheduleActionPresentation, { capture: true, signal: scope.signal });
    windowRef.addEventListener('resize', renderer.scheduleActionPresentation, { signal: scope.signal });
    renderer.scheduleActionPresentation();

    function handleMessage(message) {
        if (message.state) {
            actions.setSubmissionPending(false);
            const previous = model.state;
            const previousInteractionId = previous?.interaction?.interactionId ?? null;
            model.state = message.state;
            const interactionId = model.state.interaction?.interactionId ?? null;
            if (previous && interactionId && interactionId !== previousInteractionId) model.animateInteractionId = interactionId;
            updateDecisionWindow(model, previous, model.state, renderer.render);
            updateGroupHighlights(model, previous, model.state, windowRef, renderer.render);
            updateTransferPresentation(model, previous, model.state, windowRef, renderer.renderEvent, renderer.scheduleActionPresentation);
            if (model.selected !== null && !model.state.myHand?.[model.selected]) model.selected = null;
            const valid = new Set((model.state.myPaymentOptions || []).map(item => item.id));
            model.paymentIds = model.paymentIds.filter(id => valid.has(id));
            if (model.state.myPendingDoubleRent && model.state.availableActions?.canPlay && model.selected === null) {
                const rentIndex = (model.state.myHand || []).findIndex(card => card.kind === 'rent' && rentGroups(model.state, card).length > 0);
                if (rentIndex >= 0) { model.selected = rentIndex; model.choiceMode = 'rent'; }
            }
            renderer.render();
            const takeoverResolved = model.state.interaction?.type === 'dealBreaker' && model.state.interaction?.transfer?.kind === 'group' && transferKey(model.state) !== transferKey(previous);
            if (takeoverResolved) scene.showTakeoverScene(model.state);
            if (previous && previous.status !== 'ended' && model.state.status === 'ended') scene.showVictoryScene(model.state);
        }
        if (message.type === 'error') { actions.setSubmissionPending(false); addLog?.(message.message || '操作失败', 'error'); }
    }

    return {
        gameType: 'monopolydeal',
        handleMessage,
        destroy() {
            clearTimeout(model.decisionTimer); clearTimeout(model.transferTimer); clearTimeout(model.groupHighlightTimer); clearTimeout(model.victoryTimer);
            const cancel = windowRef.cancelAnimationFrame || globalThis.cancelAnimationFrame; cancel?.(model.actionLayoutFrame);
            scene.destroy(); rulesModal.destroy(); scope.destroy(); documentRef.body.classList.remove('is-monopolydeal-view'); styleHandle.release(); mount.innerHTML = '';
        },
    };
}
