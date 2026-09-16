import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createKingdominoActions } from './actions.js';
import { createKingdominoModel, localizePresentation } from './state.js';
import { createKingdominoTemplate } from './template.js';
import { createKingdominoRenderer } from './render.js';
import { createKingdominoScene } from './scene.js';

/** Thin protocol/lifecycle entry for 多米诺王国. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('kingdomino'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-kingdomino-view');
    const model = createKingdominoModel();
    mount.innerHTML = createKingdominoTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.kd-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rules'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    let renderer = null;
    const scene = createKingdominoScene({ mount, model, getElement, windowRef, getRender: () => renderer?.render });
    renderer = createKingdominoRenderer({ mount, model, scene, getElement });
    const actions = createKingdominoActions({ mount, model, scene, renderer, send, rulesModal, getElement });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const firstState = !previousState;
            model.state = message.state;
            model.pendingDominoId = null;
            model.actionPending = false;
            renderer.render();

            const presentation = model.state.presentation;
            const hasServerTimeline = Array.isArray(model.state.presentations)
                || Boolean(presentation && Number.isFinite(Number(presentation.endsAt)) && Number.isFinite(Number(presentation.serverNow ?? model.state.serverNow)));
            if (hasServerTimeline) {
                const batches = model.state.presentations?.length
                    ? model.state.presentations
                    : presentation
                        ? [presentation]
                        : [];
                const localNow = Date.now();
                for (const sourceBatch of batches.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                    const sequence = Number(sourceBatch.sequence) || 0;
                    if (sequence) model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
                    const localized = localizePresentation({
                        ...sourceBatch,
                        serverNow: sourceBatch.serverNow ?? model.state.serverNow,
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
                    model.pendingDominoId = null;
                    model.placementCells = [];
                    model.placementTileId = null;
                    model.actionPending = false;
                    scene.enqueuePresentation({ ...localized, events: freshEvents });
                }
            } else {
                // Compatibility with servers that publish ordered content but
                // do not yet attach absolute presentation timestamps.
                const sequence = Number(presentation?.sequence) || 0;
                if (firstState) {
                    model.lastPresentationSequence = sequence;
                } else if (sequence > model.lastPresentationSequence) {
                    model.lastPresentationSequence = sequence;
                    if (rulesModal.isOpen()) rulesModal.setOpen(false);
                    model.placementCells = [];
                    scene.enqueuePresentation({ batch: JSON.parse(JSON.stringify(presentation)) });
                } else if (previousState.status === 'playing' && model.state.status === 'ended') {
                    if (rulesModal.isOpen()) rulesModal.setOpen(false);
                    scene.enqueuePresentation({
                        finaleOnly: true,
                        batch: {
                            sequence: Date.now(),
                            ended: true,
                            endReason: model.state.endReason || 'players',
                            standings: model.state.standings || model.state.players || [],
                            winner: model.state.winner || null,
                            winners: model.state.winners || (model.state.winner ? [model.state.winner] : []),
                        },
                    });
                }
            }
        }
        if (message.type === 'error') {
            model.actionPending = false;
            addLog?.(message.message || '操作失败', 'error');
            if (model.state) renderer.render();
        }
    }

    return {
        gameType: 'kingdomino',
        handleMessage,
        destroy() {
            scene.destroy();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-kingdomino-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
