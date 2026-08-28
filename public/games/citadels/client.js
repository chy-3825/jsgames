import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createCitadelsActions } from './actions.js';
import { createCitadelsModel } from './state.js';
import { createCitadelsTemplate } from './template.js';
import { createCitadelsRenderer } from './render.js';
import { createCitadelsScene } from './scene.js';

/** Thin protocol/lifecycle entry for 富饶之城. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('citadels'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-citadels-view');
    const model = createCitadelsModel();
    mount.innerHTML = createCitadelsTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.citadels-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createCitadelsRenderer({ mount, model, getElement });
    const scene = createCitadelsScene({ mount, model, getElement, windowRef });
    const actions = createCitadelsActions({ mount, model, renderer, scene, send, rulesModal });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const firstState = !model.state;
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
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
        gameType: 'citadels',
        handleMessage,
        destroy() {
            scene.stopPresentation();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-citadels-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
