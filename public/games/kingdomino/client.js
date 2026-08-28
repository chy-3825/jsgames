import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createKingdominoActions } from './actions.js';
import { createKingdominoModel } from './state.js';
import { createKingdominoTemplate } from './template.js';
import { createKingdominoRenderer } from './render.js';
import { createKingdominoScene } from './scene.js';

/** Thin protocol/lifecycle entry for 多米诺王国. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('kingdomino'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-kingdomino-view');
    const model = createKingdominoModel();
    mount.innerHTML = createKingdominoTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.kd-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rules'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createKingdominoRenderer({ mount, model, getElement });
    const scene = createKingdominoScene({ mount, model, getElement, windowRef });
    const actions = createKingdominoActions({ mount, model, scene, renderer, send, rulesModal, getElement });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const firstState = !model.state;
            model.state = message.state;
            model.pendingDominoId = null;
            model.actionPending = false;
            renderer.render();
            const sequence = Number(model.state.presentation?.sequence) || 0;
            if (firstState) model.lastPresentationSequence = sequence;
            else if (sequence > model.lastPresentationSequence) {
                model.lastPresentationSequence = sequence;
                scene.enqueuePresentation({ batch: JSON.parse(JSON.stringify(model.state.presentation)) });
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }

    return {
        gameType: 'kingdomino',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-kingdomino-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
