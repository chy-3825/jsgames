import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createMagicalAthleteActions } from './actions.js';
import { createMagicalAthleteModel, resetInteraction, signature } from './state.js';
import { createMagicalAthleteTemplate } from './template.js';
import { createMagicalAthleteRenderer } from './render.js';
import { createMagicalAthleteScene } from './scene.js';

/** Thin protocol/lifecycle entry for 胡闹运动会. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('magicalathlete'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-magicalathlete-view');
    const model = createMagicalAthleteModel();
    mount.innerHTML = createMagicalAthleteTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.ma-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createMagicalAthleteRenderer({ mount, model, getElement });
    const scene = createMagicalAthleteScene({ mount, model, getElement, windowRef, renderer });
    const actions = createMagicalAthleteActions({ mount, model, renderer, scene, send, addLog, documentRef, windowRef });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function syncAcknowledgementTimer() {
        const acknowledgement = model.state?.acknowledgement;
        const nextId = acknowledgement?.playerId === model.state?.myId ? acknowledgement.id : null;
        if (nextId === model.acknowledgementId) return;
        if (model.acknowledgementTimer) windowRef.clearTimeout(model.acknowledgementTimer);
        model.acknowledgementTimer = null;
        model.acknowledgementId = nextId;
        if (nextId) model.acknowledgementTimer = windowRef.setTimeout(() => {
            if (model.state?.acknowledgement?.id !== nextId || model.actionPending || model.presentationPlaying) return;
            actions.submitAction({ kind: 'acknowledgeElimination', acknowledgementId: nextId });
        }, 8000);
    }
    function commitState(nextState) {
        const nextSignature = signature(nextState);
        model.state = nextState;
        model.actionPending = false;
        renderer.clearError();
        if (nextSignature !== model.interactionSignature) resetInteraction(model);
        model.interactionSignature = nextSignature;
        renderer.render();
        syncAcknowledgementTimer();
    }
    function handleMessage(message) {
        if (message.state) {
            const firstState = !model.state;
            const presentation = message.state.presentation;
            if (presentation?.resolved && presentation.sequence !== model.lastPresentationSequence) {
                model.lastPresentationSequence = presentation.sequence;
                if (!firstState && presentation.events?.length) scene.enqueuePresentation(presentation, message.state);
                else commitState(message.state);
            } else commitState(message.state);
        }
        if (message.type === 'error') {
            model.actionPending = false;
            renderer.showError(message.message || '操作失败');
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }
    return {
        gameType: 'magicalathlete',
        handleMessage,
        destroy() {
            scene.stop();
            if (model.acknowledgementTimer) windowRef.clearTimeout(model.acknowledgementTimer);
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-magicalathlete-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
