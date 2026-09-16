import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createMagicalAthleteActions } from './actions.js';
import { createMagicalAthleteModel, localizePresentation, resetInteraction, signature } from './state.js';
import { createMagicalAthleteTemplate } from './template.js';
import { createMagicalAthleteRenderer } from './render.js';
import { createMagicalAthleteScene } from './scene.js';

/** Thin protocol/lifecycle entry for 胡闹运动会. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('magicalathlete'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-magicalathlete-view');
    const model = createMagicalAthleteModel();
    mount.innerHTML = createMagicalAthleteTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.ma-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createMagicalAthleteRenderer({ mount, model, getElement });
    let closeRulesForPresentation = () => {};
    const scene = createMagicalAthleteScene({ mount, model, getElement, windowRef, renderer, onPresentationStart: () => closeRulesForPresentation() });
    const actions = createMagicalAthleteActions({ mount, model, renderer, scene, rulesModal, send, addLog, documentRef, windowRef });
    closeRulesForPresentation = actions.closeRules || (() => rulesModal.setOpen(false));

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function syncAcknowledgementTimer() {
        const acknowledgement = model.state?.acknowledgement;
        const nextId = acknowledgement?.playerId === model.state?.myId ? acknowledgement.id : null;
        const serverNow = Number(model.state?.serverNow);
        const deadlineAt = nextId && Number.isFinite(Number(acknowledgement.deadlineAt))
            ? (Number.isFinite(serverNow) ? Date.now() + Number(acknowledgement.deadlineAt) - serverNow : Number(acknowledgement.deadlineAt))
            : 0;
        if (nextId === model.acknowledgementId && Math.abs(Number(model.acknowledgementDeadline || 0) - deadlineAt) < 5) return;
        if (model.acknowledgementTimer) windowRef.clearTimeout(model.acknowledgementTimer);
        model.acknowledgementTimer = null;
        model.acknowledgementId = nextId;
        model.acknowledgementDeadline = deadlineAt;
        if (nextId) {
            const attempt = () => {
                if (model.state?.acknowledgement?.id !== nextId) return;
                if (model.actionPending || scene.isPlaying()) {
                    model.acknowledgementTimer = windowRef.setTimeout(attempt, 250);
                    return;
                }
                actions.submitAction({ kind: 'acknowledgeElimination', acknowledgementId: nextId });
            };
            model.acknowledgementTimer = windowRef.setTimeout(attempt, Math.max(0, deadlineAt ? deadlineAt - Date.now() : 8000));
        }
    }
    function commitState(nextState) {
        const nextSignature = signature(nextState);
        model.state = nextState;
        model.actionPending = false;
        renderer.clearError();
        if (nextSignature !== model.interactionSignature) resetInteraction(model);
        model.interactionSignature = nextSignature;
        renderer.render();
        syncAcknowledgementTimer();
    }
    function handleMessage(message) {
        if (message.state) {
            const nextState = message.state;
            commitState(nextState);
            const presentation = nextState.presentation;
            const hasServerTimeline = Array.isArray(nextState.presentations)
                || Boolean(presentation && Number.isFinite(Number(presentation.endsAt)) && Number.isFinite(Number(presentation.serverNow ?? nextState.serverNow)));
            const batches = nextState.presentations?.length
                ? nextState.presentations
                : presentation
                    ? [presentation]
                    : [];
            if (hasServerTimeline) {
                const localNow = Date.now();
                for (const sourceBatch of batches.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                    const sequence = Number(sourceBatch.sequence) || 0;
                    if (sequence) model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
                    const localized = localizePresentation({
                        ...sourceBatch,
                        serverNow: sourceBatch.serverNow ?? nextState.serverNow,
                    }, localNow);
                    if (!localized) continue;
                    const freshEvents = localized.events.filter((event, index) => {
                        if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= localNow) return false;
                        const sourceEvent = sourceBatch.events?.[index] || event;
                        const key = `${sourceBatch.transactionId ?? sourceBatch.sequence ?? ''}:${sourceEvent.eventId ?? sourceEvent.sequence ?? index}:${sourceEvent.kind}`;
                        if (model.presentationEventIds.has(key)) return false;
                        model.presentationEventIds.add(key);
                        return true;
                    });
                    if (!freshEvents.length) continue;
                    if (rulesModal.isOpen()) rulesModal.setOpen(false);
                    scene.enqueuePresentation({ ...localized, events: freshEvents });
                }
            } else {
                // Compatibility for an older server that only sent one
                // resolved batch and no absolute timestamps.
                const sequence = Number(presentation?.sequence) || 0;
                if (sequence > model.lastPresentationSequence && presentation?.events?.length) {
                    model.lastPresentationSequence = sequence;
                    scene.enqueuePresentation(presentation);
                }
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            renderer.showError(message.message || '操作失败');
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }
    return {
        gameType: 'magicalathlete',
        handleMessage,
        destroy() {
            scene.stop();
            if (model.acknowledgementTimer) windowRef.clearTimeout(model.acknowledgementTimer);
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-magicalathlete-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
