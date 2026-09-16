import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createCamelUpActions } from './actions.js';
import { createCamelUpModel, localizePresentation, resetInteraction, signature } from './state.js';
import { createCamelUpTemplate } from './template.js';
import { createCamelUpRenderer } from './render.js';
import { createCamelUpScene } from './scene.js';

/** Thin protocol/lifecycle entry for 狂野骆驼. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('camelup'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-camelup-view');
    const model = createCamelUpModel();
    mount.innerHTML = createCamelUpTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.camel-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createCamelUpRenderer({ mount, model, getElement });
    let closeRulesForPresentation = () => {};
    const scene = createCamelUpScene({ mount, model, getElement, windowRef, renderer, onPresentationStart: () => closeRulesForPresentation() });
    const actions = createCamelUpActions({ mount, model, renderer, scene, send, addLog, documentRef, windowRef });
    closeRulesForPresentation = actions.closeRules;
    mount.addEventListener('click', actions.onClick, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.onKeydown, { signal: scope.signal });
    function handleMessage(message) {
        if (message.state) {
            const nextSignature = signature(message.state);
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
            if (nextSignature !== model.interactionSignature) resetInteraction(model);
            model.interactionSignature = nextSignature;
            renderer.render();
            const presentation = message.state.presentation;
            const presentations = message.state.presentations?.length
                ? message.state.presentations
                : presentation
                    ? [presentation]
                    : [];
            const localNow = Date.now();
            for (const batch of presentations.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                const sequence = Number(batch.sequence) || 0;
                if (sequence && sequence <= model.lastPresentationSequence) continue;
                const localized = localizePresentation(batch, localNow);
                if (sequence) model.lastPresentationSequence = sequence;
                if (localized) scene.enqueuePresentation(localized);
            }
        }
        if (message.type === 'error') { model.actionPending = false; renderer.showError(message.message || '操作失败'); addLog?.(message.message || '操作失败', 'error'); if (model.state) renderer.render(); }
    }
    return { gameType: 'camelup', handleMessage, destroy() { scene.stop(); rulesModal.destroy(); scope.destroy(); documentRef.body.classList.remove('is-camelup-view'); styleHandle.release(); mount.innerHTML = ''; } };
}
