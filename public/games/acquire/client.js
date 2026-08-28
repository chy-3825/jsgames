import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createAcquireActions } from './actions.js';
import { createAcquireModel } from './state.js';
import { createAcquireTemplate } from './template.js';
import { createAcquireRenderer } from './render.js';
import { createAcquireScene } from './scene.js';

/** Thin protocol/lifecycle entry for 并购. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('acquire'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('acquire-game-active');
    const model = createAcquireModel();
    mount.innerHTML = createAcquireTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.acquire-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const decisionModal = createModalController({ root: app, overlay: getElement('decisionOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createAcquireRenderer({ mount, model, getElement });
    const scene = createAcquireScene({ mount, model, getElement, windowRef });
    const actions = createAcquireActions({ mount, model, renderer, scene, send, rulesModal, decisionModal });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('input', actions.handleInput, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const firstState = !model.state;
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
            model.pendingTileId = null;
            if (decisionModal.isOpen()) actions.closeDecision(false);
            renderer.render();
            const sequence = Number(model.state.presentation?.sequence) || 0;
            if (firstState) model.lastPresentationSequence = sequence;
            else if (sequence > model.lastPresentationSequence) {
                model.lastPresentationSequence = sequence;
                scene.enqueuePresentation(model.state.presentation);
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            renderer.showError(message.message || '操作失败');
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }

    return {
        gameType: 'acquire',
        handleMessage,
        destroy() {
            scene.stopPresentation();
            rulesModal.destroy();
            decisionModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('acquire-game-active');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
