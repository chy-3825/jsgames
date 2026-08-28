import { createActionLock } from '../common/action-lock.js';
import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createAeroplaneActions } from './actions.js';
import { createAeroplaneModel } from './state.js';
import { createAeroplaneTemplate } from './template.js';
import { createAeroplaneRenderer } from './render.js';
import { createAeroplaneScene } from './scene.js';

/** Protocol and lifecycle entry for 飞行棋. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('aeroplane'), { documentRef });
    const scope = createClientScope({ windowRef });
    const actionLock = createActionLock();
    const model = createAeroplaneModel();
    mount.innerHTML = createAeroplaneTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = getElement('rulesOverlay');
    const rulesModal = createModalController({ root: mount.querySelector('.flight-game'), overlay, documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    let renderer = null;
    const scene = createAeroplaneScene({ model, getElement, windowRef, onRender: () => renderer?.render() });
    renderer = createAeroplaneRenderer({ model, actionLock, scene, getElement });
    const actions = createAeroplaneActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    return {
        gameType: 'aeroplane',
        handleMessage: actions.handleMessage,
        destroy() { scene.stop(); scope.destroy(); rulesModal.destroy(); actionLock.unlock(); styleHandle.release(); mount.innerHTML = ''; },
    };
}
