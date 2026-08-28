import { createActionLock } from '../common/action-lock.js';
import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createJungleActions } from './actions.js';
import { createJungleModel } from './state.js';
import { createJungleTemplate } from './template.js';
import { createJungleRenderer } from './render.js';
import { createJungleScene } from './scene.js';

/** Protocol and lifecycle entry for 斗兽棋. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const styleHandle = loadStyles(getGameStyleHrefs('jungle'), { documentRef });
    const scope = createClientScope();
    const actionLock = createActionLock();
    const model = createJungleModel();
    mount.innerHTML = createJungleTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = getElement('rulesOverlay');
    const rulesModal = createModalController({ root: mount.querySelector('.jungle-game'), overlay, documentRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const scene = createJungleScene({ model });
    const renderer = createJungleRenderer({ model, actionLock, getElement });
    const actions = createJungleActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog, documentRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    return {
        gameType: 'jungle',
        handleMessage: actions.handleMessage,
        destroy() {
            scope.destroy();
            rulesModal.destroy();
            actionLock.unlock();
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
