import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createSplendorActions } from './actions.js';
import { createSplendorModel } from './state.js';
import { createSplendorTemplate } from './template.js';
import { createSplendorRenderer } from './render.js';
import { createSplendorScene } from './scene.js';

/** Thin protocol/lifecycle entry for 璀璨宝石. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('splendor'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-splendor-view');

    const model = createSplendorModel();
    mount.innerHTML = createSplendorTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.sp-app');
    const rulesModal = createModalController({
        root: app,
        overlay: getElement('rules'),
        documentRef,
        windowRef,
        fallbackFocus: () => mount.querySelector('[data-ui="rules"]'),
    });
    const renderer = createSplendorRenderer({ mount, model, getElement });
    const scene = createSplendorScene({ mount, model, getElement, windowRef });
    const actions = createSplendorActions({ mount, model, scene, renderer, send, rulesModal, getElement });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const firstState = !previousState;
            model.state = message.state;
            model.tokenChoice = [];
            model.selectedCard = null;
            model.actionPending = false;
            renderer.render();
            const sequence = Number(model.state.presentation?.sequence) || 0;
            if (firstState) {
                model.lastPresentationSequence = sequence;
            } else if (sequence > model.lastPresentationSequence) {
                model.lastPresentationSequence = sequence;
                scene.enqueuePresentation({ batch: JSON.parse(JSON.stringify(model.state.presentation)) });
            } else if (previousState.status === 'playing' && model.state.status === 'ended' && model.state.endReason === 'points') {
                scene.enqueuePresentation({ finaleOnly: true, batch: {
                    ended: true,
                    endReason: model.state.endReason,
                    standings: (model.state.players || []).slice().sort((left, right) => right.points - left.points || left.cardCount - right.cardCount),
                    winners: model.state.winners || [],
                } });
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            if (model.state) renderer.render();
            addLog?.(message.message || '操作失败', 'error');
        }
    }

    return {
        gameType: 'splendor',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-splendor-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
