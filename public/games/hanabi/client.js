import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createHanabiActions } from './actions.js';
import { createHanabiTemplate } from './template.js';
import { createHanabiRenderer } from './render.js';
import { createHanabiScene } from './scene.js';
import { createHanabiModel, currentTarget, normalizeClueValue } from './state.js';

/** Thin protocol/lifecycle entry for 花火. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('hanabi'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-hanabi-view');

    const model = createHanabiModel();
    mount.innerHTML = createHanabiTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.hb-app');
    const rulesModal = createModalController({
        root: app,
        overlay: getElement('rules'),
        documentRef,
        windowRef,
        fallbackFocus: () => mount.querySelector('[data-ui="rules"]'),
    });

    let renderCallback = null;
    const scene = createHanabiScene({ mount, model, getElement, windowRef, getRender: () => renderCallback });
    const renderer = createHanabiRenderer({ mount, model, scene, getElement });
    renderCallback = renderer.render;
    const actions = createHanabiActions({ mount, model, scene, renderer, send, rulesModal, getElement });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const firstState = !previousState;
            model.state = message.state;
            model.submittingClue = false;
            if (!currentTarget(model.state, model.targetId) || !model.state.availableActions?.canGiveClue) model.targetId = null;
            if (!model.state.availableActions?.canPlay || !(model.state.myHand || []).some(card => card.id === model.pendingCardId)) {
                model.pendingCardId = null;
                model.submittingCardAction = null;
            }
            normalizeClueValue(model);
            renderer.render();
            const actionId = Number(model.state.lastAction?.actionId) || 0;
            if (firstState) {
                model.lastPresentedActionId = actionId;
            } else if (actionId > model.lastPresentedActionId) {
                model.lastPresentedActionId = actionId;
                scene.enqueuePresentation({
                    action: JSON.parse(JSON.stringify(model.state.lastAction)),
                    snapshot: JSON.parse(JSON.stringify(model.state)),
                });
            } else if (previousState.status === 'playing' && model.state.status === 'ended' && ['perfect', 'fuses', 'deck'].includes(model.state.endReason)) {
                scene.enqueuePresentation({ finaleOnly: true, snapshot: JSON.parse(JSON.stringify(model.state)) });
            }
        }
        if (message.type === 'error') {
            model.submittingCardAction = null;
            model.submittingClue = false;
            if (model.state) renderer.render();
            addLog(message.message || '操作失败', 'error');
        }
    }

    return {
        gameType: 'hanabi',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-hanabi-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
