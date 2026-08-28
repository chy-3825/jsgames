import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createWitchTownActions } from './actions.js';
import { createWitchTownModel, currentDossierReviewKey } from './state.js';
import { createWitchTownTemplate } from './template.js';
import { createWitchTownRenderer } from './render.js';
import { createWitchTownScene } from './scene.js';

/** Thin protocol/lifecycle entry for 猎巫镇. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles([
        ...getGameStyleHrefs('witchtown'),
        '/games/common/hidden-role-focus.css?v=20260827-hidden-role-focus-1',
    ], { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-witchtown-view');
    const model = createWitchTownModel();
    mount.innerHTML = createWitchTownTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const renderer = createWitchTownRenderer({ mount, model, getElement });
    const scene = createWitchTownScene({ mount, model, getElement, windowRef });
    const rulesModal = createModalController({ root: mount.querySelector('.witchtown-app'), overlay: getElement('overlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const actions = createWitchTownActions({ mount, model, renderer, scene, send, rulesModal, documentRef, windowRef });

    mount.addEventListener('click', actions.onClick, { signal: scope.signal });
    mount.addEventListener('change', actions.onChange, { signal: scope.signal });
    mount.addEventListener('pointerdown', actions.onPointerDown, { signal: scope.signal });
    mount.addEventListener('pointermove', actions.onPointerMove, { signal: scope.signal });
    mount.addEventListener('pointerout', actions.onPointerOut, { signal: scope.signal });
    mount.addEventListener('focusout', actions.onFocusOut, { signal: scope.signal });
    mount.addEventListener('contextmenu', actions.onContextMenu, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.onKeydown, { signal: scope.signal });
    documentRef.addEventListener('pointerup', actions.onPointerEnd, { signal: scope.signal });
    documentRef.addEventListener('pointercancel', actions.onPointerEnd, { signal: scope.signal });
    documentRef.addEventListener('keyup', actions.onKeyup, { signal: scope.signal });
    documentRef.addEventListener('visibilitychange', actions.onVisibilityChange, { signal: scope.signal });
    windowRef.addEventListener('blur', actions.onWindowBlur, { signal: scope.signal });

    function handleMessage(message) {
        if (message.state) {
            const previous = model.state;
            actions.hideDossierIdentity();
            model.state = message.state;
            const nextReviewKey = currentDossierReviewKey(model.state);
            if (nextReviewKey !== model.dossierReviewKey) {
                model.dossierReviewKey = nextReviewKey;
                model.hasViewedDossier = false;
            }
            renderer.render();
            scene.queueStateScenes(previous, model.state);
        }
        if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
    }

    return {
        gameType: 'witchtown',
        handleMessage,
        destroy() {
            actions.hideDossierIdentity();
            scene.stop();
            actions.closeRules();
            rulesModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-witchtown-view', 'witchtown-rules-open');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
