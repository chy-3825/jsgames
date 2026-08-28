import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createModernArtActions } from './actions.js';
import { createModernArtModel, resetInteraction, signature } from './state.js';
import { createModernArtTemplate } from './template.js';
import { createModernArtRenderer } from './render.js';
import { createModernArtScene } from './scene.js';

/** Thin protocol/lifecycle entry for 现代艺术. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document; const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('modernart'), { documentRef }); const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-modernart-view'); const model = createModernArtModel(); mount.innerHTML = createModernArtTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`); const app = mount.querySelector('.art-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createModernArtRenderer({ mount, model, getElement }); const scene = createModernArtScene({ mount, model, getElement, windowRef, renderer }); const actions = createModernArtActions({ mount, model, renderer, scene, send, addLog, documentRef, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal }); mount.addEventListener('input', actions.handleInput, { signal: scope.signal }); documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    function handleMessage(message) { if (message.state) { const first = !model.state; const nextSignature = signature(message.state); model.state = message.state; model.actionPending = false; renderer.clearError(); if (nextSignature !== model.interactionSignature) resetInteraction(model); model.interactionSignature = nextSignature; renderer.render(); const presentation = message.state.presentation; if (presentation?.resolved && presentation.sequence !== model.lastPresentationSequence) { model.lastPresentationSequence = presentation.sequence; if (!first && presentation.events?.length) scene.enqueuePresentation(presentation); } } if (message.type === 'error') { model.actionPending = false; renderer.showError(message.message || '操作失败'); addLog?.(message.message || '操作失败', 'error'); if (model.state) renderer.render(); } }
    return { gameType: 'modernart', handleMessage, destroy() { scene.stop(); rulesModal.destroy(); scope.destroy(); documentRef.body.classList.remove('is-modernart-view'); styleHandle.release(); mount.innerHTML = ''; } };
}
