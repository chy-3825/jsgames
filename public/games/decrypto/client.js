import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createDecryptoActions } from './actions.js';
import { createDecryptoModel } from './state.js';
import { createDecryptoTemplate } from './template.js';
import { createDecryptoRenderer } from './render.js';
import { createDecryptoScene } from './scene.js';

/** Thin protocol/lifecycle entry for 谍报风云. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('decrypto'), { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createDecryptoModel({ windowRef });
    documentRef.body.classList.add('is-decrypto-view');
    mount.innerHTML = createDecryptoTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.decrypto-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createDecryptoRenderer({ mount, model, getElement });
    const scene = createDecryptoScene({ getElement, model, windowRef });
    const actions = createDecryptoActions({ mount, model, renderer, scene, rulesModal, send, documentRef, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('input', actions.handleInput, { signal: scope.signal });
    mount.addEventListener('submit', actions.handleSubmit, { signal: scope.signal });
    mount.addEventListener('pointerdown', actions.handlePointerDown, { signal: scope.signal });
    mount.addEventListener('pointerup', actions.handlePointerEnd, { signal: scope.signal });
    mount.addEventListener('pointercancel', actions.handlePointerEnd, { signal: scope.signal });
    mount.addEventListener('pointerout', actions.handlePointerOut, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    documentRef.addEventListener('keyup', actions.handleKeyup, { signal: scope.signal });
    documentRef.addEventListener('visibilitychange', actions.handleVisibilityChange, { signal: scope.signal });
    windowRef.addEventListener('blur', actions.concealPrivateInformation, { signal: scope.signal });
    function handleMessage(message) {
        if (message.state) {
            const previous = model.state;
            model.state = message.state;
            renderer.render();
            const scenes = scene.transitionScenes(previous, model.state);
            if (scenes.length) scene.playScenes(scenes);
            if (actions.shouldShowTutorial()) { model.tutorialOpened = true; actions.openOverlay(getElement('tutorialOverlay')); }
        }
        if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
    }
    return {
        gameType: 'decrypto',
        handleMessage,
        destroy() {
            scene.stop();
            actions.concealPrivateInformation();
            actions.closeOverlay();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-decrypto-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
