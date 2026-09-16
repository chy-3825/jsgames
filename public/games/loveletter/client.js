import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { CARD_ART } from './constants.js';
import { createLoveLetterActions } from './actions.js';
import { createLoveLetterModel, deriveScenes, normalizeSelection } from './state.js';
import { createLoveLetterTemplate } from './template.js';
import { createLoveLetterRenderer } from './render.js';
import { createLoveLetterScene } from './scene.js';

/** Thin protocol/lifecycle entry for 情书. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    Object.values(CARD_ART).forEach(src => {
        const image = new Image();
        image.src = src;
    });
    const styleHandle = loadStyles(getGameStyleHrefs('loveletter'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-loveletter-view');

    const model = createLoveLetterModel();
    mount.innerHTML = createLoveLetterTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.ll-app');
    const rulesModal = createModalController({
        root: app,
        overlay: getElement('rulesOverlay'),
        documentRef,
        windowRef,
        fallbackFocus: () => mount.querySelector('[data-action="rules"]'),
    });
    const archiveModal = createModalController({
        root: app,
        overlay: getElement('archiveOverlay'),
        documentRef,
        windowRef,
        fallbackFocus: () => mount.querySelector('[data-action="open-archive"]'),
    });

    let renderCallback = null;
    const scene = createLoveLetterScene({
        mount,
        model,
        send,
        getElement,
        windowRef,
        getRender: () => renderCallback,
    });
    const renderer = createLoveLetterRenderer({ mount, model, scene, getElement });
    renderCallback = renderer.render;
    const actions = createLoveLetterActions({ mount, model, scene, renderer, send, rulesModal, archiveModal, getElement, documentRef, windowRef });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('mouseover', actions.handlePointerOver, { signal: scope.signal });
    mount.addEventListener('mouseout', actions.handlePointerOut, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    windowRef.addEventListener('resize', scene.scheduleActionPresentation, { signal: scope.signal });
    mount.addEventListener('scroll', scene.scheduleActionPresentation, { capture: true, signal: scope.signal });

    function handleMessage(message) {
        const previousState = model.state;
        const previousTurn = model.state ? `${model.state.round}:${model.state.currentTurn}` : null;
        const previousActionId = model.state?.lastAction?.actionId ?? null;
        if (message.state) {
            model.state = message.state;
            if (model.state.pendingAction && model.state.pendingAction.actionId !== model.acknowledgementActionId) {
                model.acknowledgementActionId = model.state.pendingAction.actionId;
                model.acknowledgementDeadline = Date.now() + Math.max(0, Number(model.state.pendingAction.remainingMs ?? 4000));
            } else if (!model.state.pendingAction) {
                model.acknowledgementActionId = null;
                model.acknowledgementDeadline = 0;
            }
            const currentTurn = `${model.state.round}:${model.state.currentTurn}`;
            const currentActionId = model.state.lastAction?.actionId ?? null;
            if (previousState && currentActionId && currentActionId !== previousActionId) scene.markAction(currentActionId);
            if (previousTurn !== currentTurn || !model.state.myIsCurrentTurn || model.state.pendingAction) actions.clearSelection();
            model.pendingAction = false;
            normalizeSelection(model);
            scene.enqueueScenes(deriveScenes(previousState, model.state));
            renderer.render();
            if (archiveModal.isOpen() && model.archiveKind) renderer.renderArchive(model.archiveKind);
            scene.scheduleAcknowledgement();
        }
        if (message.type === 'error') {
            model.pendingAction = false;
            renderer.render();
        }
        const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
        if (text) addLog(text, message.type === 'error' ? 'error' : 'info');
    }

    return {
        gameType: 'loveletter',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            archiveModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-loveletter-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
