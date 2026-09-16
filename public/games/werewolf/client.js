import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createWerewolfActions } from './actions.js';
import { createWerewolfModel, localizePresentation } from './state.js';
import { createWerewolfTemplate } from './template.js';
import { createWerewolfRenderer } from './render.js';
import { createWerewolfScene } from './scene.js';

/** Thin protocol/lifecycle entry for 狼人杀. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles([...getGameStyleHrefs('werewolf'), '/games/common/hidden-role-focus.css?v=20260827-hidden-role-focus-1'], { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createWerewolfModel();
    documentRef.body.classList.add('is-werewolf-view');
    mount.innerHTML = createWerewolfTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.ww-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rules'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createWerewolfRenderer({ mount, model, getElement, send, windowRef });
    const scene = createWerewolfScene({ mount, model, getElement, renderer, send, windowRef });
    const actions = createWerewolfActions({ mount, model, renderer, scene, rulesModal, send, documentRef, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('pointerdown', actions.handlePointerdown, { signal: scope.signal });
    mount.addEventListener('pointermove', actions.handlePointermove, { signal: scope.signal });
    mount.addEventListener('pointerout', actions.handlePointerout, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    mount.addEventListener('focusout', actions.handleFocusout, { signal: scope.signal });
    mount.addEventListener('contextmenu', actions.handleContextmenu, { signal: scope.signal });
    windowRef.addEventListener('pointerup', actions.handlePointerup, { signal: scope.signal });
    windowRef.addEventListener('pointercancel', actions.handlePointercancel, { signal: scope.signal });
    windowRef.addEventListener('keyup', actions.handleKeyup, { signal: scope.signal });
    windowRef.addEventListener('blur', actions.handleBlur, { signal: scope.signal });
    documentRef.addEventListener('visibilitychange', actions.handleVisibilitychange, { signal: scope.signal });

    function handleMessage(message) {
        try {
            if (message?.state) {
                let previousState = model.state;
                if (previousState?.gameEpoch && message.state.gameEpoch && previousState.gameEpoch !== message.state.gameEpoch) {
                    scene.stop();
                    model.lastAnnouncementDayKey = '';
                    model.lastEliminationKey = '';
                    model.lastPublicEventId = null;
                    model.lastWinnerKey = '';
                    model.hasViewedRole = false;
                    model.eliminatedSeat = null;
                    model.presentationEventIds.clear();
                    model.lastPresentationSequence = 0;
                    // Do not diff a new game against the previous game's
                    // phase/event cursor.  Otherwise the first snapshot can
                    // replay stale transitions or skip the new night gate.
                    previousState = null;
                }
                const viewChanged = previousState && (previousState.phase !== message.state.phase || previousState.activeSeat !== message.state.activeSeat || previousState.myRole !== message.state.myRole || previousState.myRoleConfirmed !== message.state.myRoleConfirmed);
                if (viewChanged) renderer.hideRoleIdentity();
                if (message.state.phase !== 'roleReveal' || (viewChanged && (!previousState || previousState.phase !== 'roleReveal' || previousState.activeSeat !== message.state.activeSeat || previousState.myRole !== message.state.myRole))) model.hasViewedRole = false;
                model.state = message.state;
                if (model.state.testMode) {
                    (model.state.seats || []).forEach(seat => { if (seat.role) model.testRoleBySeat.set(seat.number, seat.role); });
                    if (model.state.activeSeat != null && model.state.myRole) model.testRoleBySeat.set(model.state.activeSeat, model.state.myRole);
                }
                const hasServerTimeline = Array.isArray(model.state.presentations) || Boolean(model.state.presentation?.events?.length);
                if (hasServerTimeline) {
                    const presentations = model.state.presentations?.length
                        ? model.state.presentations
                        : model.state.presentation
                            ? [model.state.presentation]
                            : [];
                    const localNow = Date.now();
                    for (const batch of presentations.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
                        const sequence = Number(batch.sequence) || 0;
                        const localized = localizePresentation(batch, localNow);
                        if (!localized) continue;
                        const freshEvents = localized.events.filter((event, index) => {
                            const eventKey = `${batch.transactionId || sequence}:${event.eventId || event.sequence || `${index}:${event.kind || 'event'}`}`;
                            if (model.presentationEventIds.has(eventKey)) return false;
                            model.presentationEventIds.add(eventKey);
                            return true;
                        });
                        model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
                        if (freshEvents.length) {
                            rulesModal.setOpen(false);
                            scene.enqueuePresentation({ ...localized, events: freshEvents });
                        }
                    }
                } else if (!previousState) {
                    // A reconnect can land directly in a night prelude after
                    // the transition event was already archived. Re-play the
                    // gate event when available (or acknowledge it when the
                    // archive has rolled over) so the room never waits
                    // forever for this device.
                    const gate = model.state.presentationGate;
                    const gateEvent = gate && (model.state.publicEvents || []).find(event => event.id === gate.eventId || (event.kind === 'nightFalls' && event.gateId === gate.id));
                    if (gate && !model.state.presentationAcknowledged) {
                        if (gateEvent) {
                            const perspectiveText = gateEvent.presentation === 'perspective' && Number(gateEvent.selfSeat) === Number(model.state.activeSeat) ? gateEvent.selfText : null;
                            const kind = gateEvent.kind === 'nightFalls' ? 'night' : gateEvent.presentation === 'sheriffDawn' ? 'day' : 'event';
                            scene.enqueueScene({ kind, data: { ...gateEvent, ...(perspectiveText ? { displayText: perspectiveText } : {}), gateId: gate.id } });
                        }
                        else send({ type: 'gameAction', action: { kind: 'presentationComplete', gateId: gate.id } });
                    }
                }
                if (!hasServerTimeline) scene.maybePlayTransition(previousState, model.state);
                if (viewChanged) actions.closeTargetDialog();
                renderer.render();
            }
            if (message?.type === 'error') addLog?.(message.message || '这一步暂时无法进行', 'error');
            else if (message?.action?.message) addLog?.(message.action.message, 'info');
        } catch (error) {
            console.error('狼人杀状态渲染失败', error, message);
            addLog?.(`狼人杀界面暂时无法显示：${error.message}`, 'error');
            getElement('action').innerHTML = '<p class="ww-render-error">界面正在恢复，请稍候；如果长时间没有变化，可以刷新页面。</p>';
        }
    }
    return {
        gameType: 'werewolf',
        handleMessage,
        destroy() {
            scope.destroy();
            scene.stop();
            rulesModal.destroy();
            if (windowRef.speechSynthesis) windowRef.speechSynthesis.cancel();
            documentRef.body.classList.remove('is-werewolf-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
