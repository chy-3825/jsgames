import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createTakeFiveActions } from './actions.js';
import { createTakeFiveModel } from './state.js';
import { createTakeFiveTemplate } from './template.js';
import { createTakeFiveRenderer } from './render.js';
import { createTakeFiveScene } from './scene.js';

/**
 * Thin client entry for 牛头王.
 *
 * The websocket protocol and the public game shell call this entry exactly as
 * before. Template, dynamic rendering, user actions and presentation are
 * isolated in their own modules so future rule/UI changes have a small,
 * obvious home.
 */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('takefive'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-takefive-view');

    const model = createTakeFiveModel();
    mount.innerHTML = createTakeFiveTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.takefive-app');
    const rules = getElement('rules');
    const rulesModal = createModalController({
        root: app,
        overlay: rules,
        documentRef,
        windowRef,
        fallbackFocus: () => mount.querySelector('[data-ui="rules"]'),
    });

    let renderCallback = null;
    const scene = createTakeFiveScene({
        model,
        mount,
        getElement,
        windowRef,
        documentRef,
        getRender: () => renderCallback,
    });
    const renderer = createTakeFiveRenderer({ mount, model, scene, getElement });
    renderCallback = renderer.render;
    const actions = createTakeFiveActions({ mount, model, scene, renderer, send, rulesModal, getElement });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    windowRef.addEventListener('resize', scene.schedulePresentationLayout, { signal: scope.signal });
    windowRef.addEventListener('scroll', scene.schedulePresentationLayout, { signal: scope.signal, capture: true });

    function handleMessage(message) {
        if (message.state) {
            const previous = model.state;
            model.state = message.state;
            const event = model.state.resolutionEvent;
            let startPresentation = false;
            if (event?.resolutionId && event.resolutionId !== scene.getViewState().presentationResolutionId) {
                scene.initializeResolutionPresentation(event);
                startPresentation = true;
            }
            const previousChoicePlayer = previous?.pendingRowChoice?.playerId || null;
            const nextChoicePlayer = model.state.pendingRowChoice?.playerId || null;
            if (previousChoicePlayer !== nextChoicePlayer || !nextChoicePlayer) {
                model.pendingRowIndex = null;
                model.rowChoiceSubmitting = false;
                // The scene will make the row selectable after its reveal pause.
            }
            if (model.state.mySelectedCardId || !model.state.availableActions?.canSelect) {
                model.pendingCardId = null;
                model.confirmingCard = false;
            }
            renderer.render();
            if (startPresentation) void scene.runResolutionPresentation(event.resolutionId);
            else {
                scene.resumeResolutionPresentation();
                if (!scene.getViewState().presentationBusy) scene.maybeShowSettlement();
            }
        }
        if (message.type === 'error') {
            model.confirmingCard = false;
            model.rowChoiceSubmitting = false;
            if (model.state) renderer.render();
            addLog(message.message || '操作失败', 'error');
        }
    }

    return {
        gameType: 'takefive',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-takefive-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
