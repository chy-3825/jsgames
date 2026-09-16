import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { ROLE_ART_ROOT, ROLE_META } from './constants.js';
import { createAvalonActions } from './actions.js';
import { createAvalonModel, localizePresentation } from './state.js';
import { createAvalonTemplate } from './template.js';
import { createAvalonRenderer } from './render.js';
import { createAvalonScene } from './scene.js';

/** Thin protocol/lifecycle entry for 阿瓦隆. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles([...getGameStyleHrefs('avalon'), '/games/common/hidden-role-focus.css?v=20260827-hidden-role-focus-1'], { documentRef });
    const scope = createClientScope({ windowRef });
    const model = createAvalonModel({ windowRef });
    documentRef.body.classList.add('is-avalon-view');
    const ImageCtor = windowRef.Image || globalThis.Image;
    const roleArtPreloads = ImageCtor ? [...new Set(Object.values(ROLE_META).map(role => role.image))].map(file => { const image = new ImageCtor(); image.decoding = 'async'; image.src = `${ROLE_ART_ROOT}${file}`; return image; }) : [];
    mount.innerHTML = createAvalonTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.avalon-app');
    const rulesModal = createModalController({ root: app, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createAvalonRenderer({ mount, model, getElement });
    const scene = createAvalonScene({ mount, model, getElement, renderer, windowRef });
    const actions = createAvalonActions({ mount, model, renderer, scene, rulesModal, send, documentRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('pointerdown', actions.handlePointerDown, { signal: scope.signal });
    windowRef.addEventListener('pointermove', actions.handlePointerMove, { signal: scope.signal });
    mount.addEventListener('pointerout', actions.handlePointerOut, { signal: scope.signal });
    mount.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    mount.addEventListener('focusout', actions.handleFocusout, { signal: scope.signal });
    mount.addEventListener('contextmenu', actions.handleContextmenu, { signal: scope.signal });
    windowRef.addEventListener('pointerup', actions.handlePointerUp, { signal: scope.signal });
    windowRef.addEventListener('pointercancel', actions.handlePointerCancel, { signal: scope.signal });
    windowRef.addEventListener('keyup', actions.handleKeyup, { signal: scope.signal });
    documentRef.addEventListener('visibilitychange', actions.handleVisibilityChange, { signal: scope.signal });
    windowRef.addEventListener('blur', actions.handleBlur, { signal: scope.signal });
    function handleMessage(message) {
        if (message.state) {
            const previous = model.state;
            const viewChanged = previous && (previous.phase !== message.state.phase || previous.myRole !== message.state.myRole);
            if (viewChanged) renderer.hideRoleIdentity();
            if (!previous || message.state.phase !== 'roleReveal' || viewChanged) model.hasViewedRole = false;
            model.state = message.state;
            model.actionPending = false;
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
            renderer.render();
        }
        if (message.type === 'error') {
            model.actionPending = false;
            addLog?.(message.message || '这一步现在无法进行', 'error');
            if (model.state) renderer.render();
        }
    }
    return {
        gameType: 'avalon',
        handleMessage,
        destroy() {
            scene.stop();
            renderer.hideRoleIdentity();
            rulesModal.destroy();
            scope.destroy();
            model.presentationEventIds.clear();
            roleArtPreloads.length = 0;
            documentRef.body.classList.remove('is-avalon-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
