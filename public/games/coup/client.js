import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { loadStyles } from '../common/style-loader.js';
import { createCoupActions } from './actions.js';
import { createCoupModel, localizePresentation, updateDecisionWindow } from './state.js';
import { createCoupTemplate } from './template.js';
import { createCoupRenderer } from './render.js';
import { createCoupScene } from './scene.js';

/** Thin protocol/lifecycle entry for 政变. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('coup'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-coup-view');
    const model = createCoupModel();
    mount.innerHTML = createCoupTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const renderer = createCoupRenderer({ mount, model, getElement, windowRef, documentRef });
    const scene = createCoupScene({ mount, model, getElement, windowRef, renderer });
    const actions = createCoupActions({ mount, model, renderer, scene, send });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('mouseover', actions.handlePointerOver, { signal: scope.signal });
    mount.addEventListener('mouseout', actions.handlePointerOut, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    windowRef.addEventListener('resize', renderer.scheduleActionPresentation, { signal: scope.signal });
    mount.addEventListener('scroll', renderer.scheduleActionPresentation, { capture: true, signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const previousInteractionId = model.state?.interaction?.actionId ?? null;
            model.state = message.state;
            model.submitting = false;
            const currentInteractionId = model.state.interaction?.actionId ?? null;
            if (previousState && currentInteractionId && currentInteractionId !== previousInteractionId) model.animateInteractionId = currentInteractionId;
            updateDecisionWindow(model, previousState, model.state, windowRef, renderer.render);
            if (model.state.exchange?.isMyTurn) {
                model.exchangeMode = 'select';
                model.exchangeOpen = true;
            } else if (!model.state.exchange) {
                model.exchangeKeep = [];
                if (model.exchangeMode === 'select') { model.exchangeMode = null; model.exchangeOpen = false; }
            }
            if (!renderer.isMyTurn() || model.state.challenge || model.state.influenceLoss || model.state.exchange || model.state.gameOver) {
                model.pendingAction = null;
                model.hoveredActionKind = null;
                model.selectedTarget = null;
            }

            // Presentation events are server-authoritative.  Keep a per-event
            // cursor instead of a per-batch cursor because a challenge can
            // append more events to the same transaction after the first state
            // update has already reached this browser.
            const hasServerTimeline = Array.isArray(model.state.presentations) || Boolean(model.state.presentation);
            if (hasServerTimeline) {
                const presentation = model.state.presentation;
                const presentations = model.state.presentations?.length
                    ? model.state.presentations
                    : presentation
                        ? [presentation]
                        : [];
                const localNow = Date.now();
                for (const batch of presentations.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                    const sequence = Number(batch.sequence) || 0;
                    if (sequence) model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
                    const localized = localizePresentation(batch, localNow);
                    if (!localized) continue;
                    const freshEvents = localized.events.filter(event => {
                        const key = String(event.eventId ?? `${sequence}:${event.sequence ?? ''}:${event.kind}:${event.startedAt}`);
                        if (model.presentationEventIds.has(key)) return false;
                        model.presentationEventIds.add(key);
                        return true;
                    });
                    if (freshEvents.length) scene.enqueuePresentation({ ...localized, events: freshEvents });
                }
            }
            renderer.render();
            // Older servers did not publish a timeline.  Retain their local
            // derivation as a compatibility path, but never run it alongside
            // server events (which would duplicate every public animation).
            if (!hasServerTimeline) scene.enqueueScenes(scene.deriveScenes(previousState, model.state));
        }
        if (message.type === 'gameEnded' && message.winner) addLog?.(`${message.winner.name} 获胜`, 'system');
        if (message.type === 'error') {
            model.submitting = false;
            renderer.render();
            addLog?.(message.message || '操作失败', 'error');
        }
        else {
            const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
            if (text) addLog?.(text, 'info');
        }
    }

    return {
        gameType: 'coup',
        handleMessage,
        destroy() {
            scene.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-coup-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
