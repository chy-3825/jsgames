import { createActionLock } from '../common/action-lock.js';
import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createCheckersActions } from './actions.js';
import { createCheckersModel } from './state.js';
import { createCheckersTemplate } from './template.js';
import { createCheckersRenderer } from './render.js';
import { createCheckersScene } from './scene.js';

/** Protocol and lifecycle entry for 跳棋. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('checkers'), { documentRef });
    const scope = createClientScope({ windowRef });
    const actionLock = createActionLock();
    const model = createCheckersModel();
    mount.innerHTML = createCheckersTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = getElement('rulesOverlay');
    const rulesModal = createModalController({ root: mount.querySelector('.checkers-game'), overlay, documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    let renderer = null;
    const scene = createCheckersScene({ model, boardEl: getElement('board'), holesEl: getElement('holes'), windowRef, onAnimationComplete: () => renderer?.syncInteractionState() });
    renderer = createCheckersRenderer({ model, actionLock, scene, getElement, windowRef });
    const actions = createCheckersActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    return {
        gameType: 'checkers',
        handleMessage: actions.handleMessage,
        destroy() {
            model.destroyed = true;
            scene.stop();
            scope.destroy();
            actions.releaseRequest();
            rulesModal.destroy();
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
