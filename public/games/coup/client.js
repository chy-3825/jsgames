import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { loadStyles } from '../common/style-loader.js';
import { createCoupActions } from './actions.js';
import { createCoupModel, updateDecisionWindow } from './state.js';
import { createCoupTemplate } from './template.js';
import { createCoupRenderer } from './render.js';
import { createCoupScene } from './scene.js';

/** Thin protocol/lifecycle entry for 政变. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('coup'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-coup-view');
    const model = createCoupModel();
    mount.innerHTML = createCoupTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const renderer = createCoupRenderer({ mount, model, getElement, windowRef, documentRef });
    const scene = createCoupScene({ mount, model, getElement, windowRef });
    const actions = createCoupActions({ mount, model, renderer, scene, send, documentRef });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    mount.addEventListener('pointerdown', actions.handleIdentityPointerDown, { signal: scope.signal });
    mount.addEventListener('pointermove', actions.handleIdentityPointerMove, { signal: scope.signal });
    mount.addEventListener('pointerout', actions.handleIdentityPointerOut, { signal: scope.signal });
    mount.addEventListener('focusout', actions.handleFocusOut, { signal: scope.signal });
    mount.addEventListener('contextmenu', actions.handleContextMenu, { signal: scope.signal });
    documentRef.addEventListener('pointerup', actions.handleIdentityPointerEnd, { signal: scope.signal });
    documentRef.addEventListener('pointercancel', actions.handleIdentityPointerEnd, { signal: scope.signal });
    documentRef.addEventListener('keyup', actions.handleIdentityKeyup, { signal: scope.signal });
    documentRef.addEventListener('visibilitychange', actions.handleIdentityVisibilityChange, { signal: scope.signal });
    windowRef.addEventListener('blur', actions.hidePrivateIdentity, { signal: scope.signal });
    windowRef.addEventListener('resize', renderer.scheduleActionPresentation, { signal: scope.signal });
    mount.addEventListener('scroll', renderer.scheduleActionPresentation, { capture: true, signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const previousInteractionId = model.state?.interaction?.actionId ?? null;
            actions.hidePrivateIdentity();
            model.state = message.state;
            const currentInteractionId = model.state.interaction?.actionId ?? null;
            if (previousState && currentInteractionId && currentInteractionId !== previousInteractionId) model.animateInteractionId = currentInteractionId;
            updateDecisionWindow(model, previousState, model.state, windowRef, renderer.render);
            if (model.state.exchange?.isMyTurn) {
                model.exchangeMode = 'select';
                model.exchangeOpen = true;
            } else if (!model.state.exchange) {
                model.exchangeKeep = [];
                if (model.exchangeMode === 'select') { model.exchangeMode = null; model.exchangeOpen = false; }
            }
            if (!renderer.isMyTurn() || model.state.challenge || model.state.influenceLoss || model.state.exchange || model.state.gameOver) {
                model.pendingAction = null;
                model.selectedTarget = null;
            }
            renderer.render();
            scene.enqueueScenes(scene.deriveScenes(previousState, model.state));
        }
        if (message.type === 'gameEnded' && message.winner) addLog?.(`${message.winner.name} 获胜`, 'system');
        if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
        else {
            const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
            if (text) addLog?.(text, 'info');
        }
    }

    return {
        gameType: 'coup',
        handleMessage,
        destroy() {
            actions.hidePrivateIdentity();
            scene.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-coup-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
