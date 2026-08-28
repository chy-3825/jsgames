import { createActionLock } from '../common/action-lock.js';
import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createGobangActions } from './actions.js';
import { createGobangModel } from './state.js';
import { createGobangTemplate } from './template.js';
import { createGobangRenderer } from './render.js';
import { createGobangScene } from './scene.js';

/** Protocol and lifecycle entry for 五子棋. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const styleHandle = loadStyles(getGameStyleHrefs('gobang'), { documentRef });
    const scope = createClientScope();
    const actionLock = createActionLock();
    const model = createGobangModel();
    mount.innerHTML = createGobangTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = getElement('rulesOverlay');
    const rulesModal = createModalController({ root: mount.querySelector('.gobang-game'), overlay, documentRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const scene = createGobangScene({ model });
    const renderer = createGobangRenderer({ model, actionLock, getElement });
    const actions = createGobangActions({ mount, model, renderer, actionLock, rulesModal, overlay, send, addLog });
    mount.addEventListener('mousemove', actions.handleMousemove, { signal: scope.signal });
    mount.addEventListener('mouseleave', actions.handleMouseleave, { signal: scope.signal });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    return {
        gameType: 'gobang',
        handleMessage: actions.handleMessage,
        destroy() {
            scope.destroy();
            scene.reset();
            rulesModal.destroy();
            actionLock.unlock();
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
