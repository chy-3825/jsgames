import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createAcquireActions } from './actions.js';
import { createAcquireModel, localizePresentation } from './state.js';
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

    getElement('settlementDialog').addEventListener('cancel', event => event.preventDefault(), { signal: scope.signal });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('input', actions.handleInput, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
            model.pendingTileId = null;
            if (decisionModal.isOpen()) actions.closeDecision(false);
            renderer.render();
            const presentations = model.state.presentations?.length ? model.state.presentations : model.state.presentation ? [model.state.presentation] : [];
            const localNow = Date.now();
            for (const batch of presentations.slice().sort((a, b) => Number(a.sequence) - Number(b.sequence))) {
                const sequence = Number(batch.sequence) || 0;
                if (sequence <= model.lastPresentationSequence) continue;
                model.lastPresentationSequence = sequence;
                const presentation = localizePresentation(batch, localNow);
                if (presentation) scene.enqueuePresentation(presentation);
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            model.pendingTileOrigin = null;
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
