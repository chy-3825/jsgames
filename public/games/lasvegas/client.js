import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createLasVegasActions } from './actions.js';
import { createLasVegasModel } from './state.js';
import { createLasVegasTemplate } from './template.js';
import { createLasVegasRenderer } from './render.js';
import { createLasVegasScene } from './scene.js';

/** Thin protocol/lifecycle entry for 拉斯维加斯. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document; const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('lasvegas'), { documentRef }); const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-lasvegas-view'); const model = createLasVegasModel(); mount.innerHTML = createLasVegasTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`); const app = mount.querySelector('.lasvegas-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createLasVegasRenderer({ mount, model, getElement }); const scene = createLasVegasScene({ mount, model, getElement, windowRef }); const actions = createLasVegasActions({ mount, model, renderer, scene, send, addLog, documentRef, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal }); documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    function handleMessage(message) { if (message.state) { const first = !model.state; model.state = message.state; model.actionPending = false; renderer.clearError(); renderer.render(); const presentation = message.state.presentation; if (!first && presentation?.sequence !== model.lastPresentationSequence && presentation?.events?.length) { model.lastPresentationSequence = presentation.sequence; scene.enqueuePresentation(presentation); } else if (first && presentation) model.lastPresentationSequence = presentation.sequence; } if (message.type === 'error') { model.actionPending = false; renderer.showError(message.message || '操作失败'); addLog?.(message.message || '操作失败', 'error'); if (model.state) renderer.render(); } }
    return { gameType: 'lasvegas', handleMessage, destroy() { scene.stop(); rulesModal.destroy(); scope.destroy(); documentRef.body.classList.remove('is-lasvegas-view'); styleHandle.release(); mount.innerHTML = ''; } };
}
