import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createScoutActions } from './actions.js';
import { createScoutModel, signature } from './state.js';
import { createScoutTemplate } from './template.js';
import { createScoutRenderer } from './render.js';
import { createScoutScene } from './scene.js';

/** Thin protocol/lifecycle entry for 马戏星探. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('scout'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-scout-view');
    const model = createScoutModel();
    mount.innerHTML = createScoutTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.scout-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createScoutRenderer({ mount, model, getElement });
    const scene = createScoutScene({ mount, model, getElement, renderer, windowRef });
    const actions = createScoutActions({ mount, model, renderer, scene, rulesModal, send });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('change', actions.handleChange, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const first = !model.state;
            const nextSignature = signature(message.state);
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
            if (nextSignature !== model.interactionKey) {
                model.selected = new Set();
                model.orientationDraft = null;
                model.actionMode = 'show';
                model.scoutDraft = { edge: 'left', insertAt: 0, orientation: 0 };
                model.interactionKey = nextSignature;
            }
            renderer.render();
            const presentation = message.state.presentation;
            if (presentation?.sequence !== model.lastPresentationSequence) {
                const shouldPlay = !first;
                model.lastPresentationSequence = presentation?.sequence ?? model.lastPresentationSequence;
                if (shouldPlay && presentation) scene.enqueuePresentation(presentation);
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
        gameType: 'scout',
        handleMessage,
        destroy() {
            scene.stop();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-scout-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
