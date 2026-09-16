import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createModernArtActions } from './actions.js';
import { createModernArtModel, localizePresentation, resetInteraction, signature } from './state.js';
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
    const renderer = createModernArtRenderer({ mount, model, getElement });
    let closeRulesForPresentation = () => {};
    const scene = createModernArtScene({ mount, model, getElement, windowRef, renderer, onPresentationStart: () => closeRulesForPresentation() });
    const actions = createModernArtActions({ mount, model, renderer, scene, rulesModal, send, addLog, documentRef, windowRef });
    closeRulesForPresentation = actions.closeRules;
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal }); mount.addEventListener('input', actions.handleInput, { signal: scope.signal }); documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    function handleMessage(message) {
        if (message.state) {
            const nextSignature = signature(message.state);
            model.state = message.state;
            model.actionPending = false;
            renderer.clearError();
            if (nextSignature !== model.interactionSignature) resetInteraction(model);
            model.interactionSignature = nextSignature;

            const presentation = message.state.presentation;
            const hasServerTimeline = Array.isArray(message.state.presentations) || Boolean(presentation);
            const presentations = message.state.presentations?.length
                ? message.state.presentations
                : presentation
                    ? [presentation]
                    : [];
            if (hasServerTimeline) {
                const localNow = Date.now();
                for (const sourceBatch of presentations.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                    const sequence = Number(sourceBatch.sequence) || 0;
                    if (sequence) model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
                    const localized = localizePresentation({ ...sourceBatch, serverNow: sourceBatch.serverNow ?? message.state.serverNow }, localNow);
                    if (!localized) continue;
                    const freshEvents = localized.events.filter((event, index) => {
                        if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= localNow) return false;
                        const sourceEvent = sourceBatch.events?.[index] || event;
                        const key = `${sourceBatch.transactionId ?? sourceBatch.sequence ?? ''}:${sourceEvent.eventId ?? sourceEvent.sequence ?? index}:${sourceEvent.kind}`;
                        if (model.presentationEventIds.has(key)) return false;
                        model.presentationEventIds.add(key);
                        return true;
                    });
                    if (freshEvents.length) scene.enqueuePresentation({ ...localized, events: freshEvents });
                }
            }
            renderer.render();
        }
        if (message.type === 'error') {
            model.actionPending = false;
            renderer.showError(message.message || '操作失败');
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }
    return { gameType: 'modernart', handleMessage, destroy() { scene.stop(); rulesModal.destroy(); scope.destroy(); documentRef.body.classList.remove('is-modernart-view'); styleHandle.release(); mount.innerHTML = ''; } };
}
