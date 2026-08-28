import { escapeHtml } from './constants.js';
import { getAction, getPlayer, isMyTurn, decisionReady } from './state.js';

/** Pointer, keyboard and action submission handlers for 政变. */
export function createCoupActions({ mount, model, renderer, scene, send, documentRef = globalThis.document }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;

    function setPrivateIdentityVisible(visible) {
        model.privateIdentityVisible = Boolean(visible && state() && !state().gameOver);
        renderer.syncPrivateIdentityVisibility();
    }

    function hidePrivateIdentity() {
        model.identityRevealPointerId = null;
        model.identityRevealKey = null;
        model.identityRevealElement = null;
        setPrivateIdentityVisible(false);
    }

    function handleAction(kind) {
        if (kind === 'exchange') {
            model.exchangeMode = 'confirm';
            model.exchangeOpen = true;
            renderer.render();
            return;
        }
        const action = getAction(kind);
        if (action?.needsTarget) {
            model.pendingAction = { kind };
            model.selectedTarget = null;
            renderer.render();
            return;
        }
        send({ type: 'gameAction', action: { kind } });
    }

    function selectTarget(id) {
        if (!model.pendingAction) return;
        model.selectedTarget = id;
        renderer.render();
    }

    function confirmTarget() {
        if (!model.pendingAction || !model.selectedTarget) return;
        send({ type: 'gameAction', action: { kind: model.pendingAction.kind, targetId: model.selectedTarget } });
        model.pendingAction = null;
        model.selectedTarget = null;
        renderer.render();
    }

    function handleClick(event) {
        if (event.target.closest('[data-identity-hold]')) { event.preventDefault(); return; }
        if (scene.isPlaying()) {
            const sceneAction = event.target.closest('[data-action="skip-scene"]');
            event.preventDefault();
            if (sceneAction) scene.skipScene();
            return;
        }
        const current = state();
        const exchangeCard = event.target.closest('[data-exchange-index]');
        if (exchangeCard && current?.exchange?.isMyTurn) {
            const index = Number(exchangeCard.dataset.exchangeIndex);
            const keepCount = current.exchange.keepCount || 0;
            if (model.exchangeKeep.includes(index)) model.exchangeKeep = model.exchangeKeep.filter(item => item !== index);
            else if (model.exchangeKeep.length < keepCount) model.exchangeKeep = [...model.exchangeKeep, index];
            renderer.render();
            return;
        }
        const target = event.target.closest('[data-target-player]');
        if (target) { selectTarget(target.dataset.targetPlayer); return; }
        const actionButton = event.target.closest('[data-action-kind]');
        if (actionButton) { handleAction(actionButton.dataset.actionKind); return; }
        const challenge = event.target.closest('[data-challenge]');
        if (challenge) {
            if (!renderer.decisionReady()) return;
            send({ type: 'gameAction', action: { kind: challenge.dataset.challenge } });
            return;
        }
        const loss = event.target.closest('[data-loss-index]');
        if (loss) {
            if (!renderer.decisionReady()) return;
            send({ type: 'gameAction', action: { kind: 'influence_loss', influenceIndex: Number(loss.dataset.lossIndex) } });
            return;
        }
        const button = event.target.closest('[data-action]');
        if (!button) {
            if (event.target === $('rolesOverlay')) renderer.setOverlay($('rolesOverlay'), false);
            return;
        }
        switch (button.dataset.action) {
            case 'confirm-target': confirmTarget(); break;
            case 'cancel-target': model.pendingAction = null; model.selectedTarget = null; renderer.render(); break;
            case 'roles': renderer.setOverlay($('rolesOverlay'), true); break;
            case 'close-roles': renderer.setOverlay($('rolesOverlay'), false); break;
            case 'confirm-exchange':
                renderer.setOverlay($('exchangeOverlay'), false);
                model.exchangeOpen = false;
                model.exchangeMode = null;
                send({ type: 'gameAction', action: { kind: 'exchange' } });
                break;
            case 'confirm-exchange-select':
                if (current?.exchange?.isMyTurn && model.exchangeKeep.length === current.exchange.keepCount) {
                    send({ type: 'gameAction', action: { kind: 'exchangeSelect', keepIndices: model.exchangeKeep } });
                    model.exchangeKeep = [];
                }
                break;
            case 'cancel-exchange':
                renderer.setOverlay($('exchangeOverlay'), false);
                model.exchangeOpen = false;
                model.exchangeMode = null;
                break;
            default: break;
        }
    }

    function handleKeydown(event) {
        const identityHold = event.target.closest?.('[data-identity-hold]');
        if (identityHold && !event.repeat && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            model.identityRevealPointerId = null;
            model.identityRevealKey = event.key;
            model.identityRevealElement = identityHold;
            setPrivateIdentityVisible(true);
            return;
        }
        if (scene.isPlaying()) { if (event.key === 'Escape') scene.skipScene(); return; }
        if (renderer.trapOverlayFocus(event)) return;
        if (event.key !== 'Escape') return;
        renderer.setOverlay($('rolesOverlay'), false);
        if (!state()?.exchange?.isMyTurn) {
            renderer.setOverlay($('exchangeOverlay'), false);
            model.exchangeOpen = false;
            model.exchangeMode = null;
        }
    }

    function handleIdentityPointerDown(event) {
        const hold = event.target.closest('[data-identity-hold]');
        if (!hold || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        model.identityRevealPointerId = event.pointerId;
        model.identityRevealKey = null;
        model.identityRevealElement = hold;
        setPrivateIdentityVisible(true);
    }

    function handleIdentityPointerMove(event) {
        if (event.pointerId !== model.identityRevealPointerId) return;
        const hold = model.identityRevealElement;
        if (!hold) return hidePrivateIdentity();
        const bounds = hold.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) hidePrivateIdentity();
    }

    function handleIdentityPointerOut(event) {
        const hold = event.target.closest('[data-identity-hold]');
        if (hold && event.pointerId === model.identityRevealPointerId && !hold.contains(event.relatedTarget)) hidePrivateIdentity();
    }

    function handleIdentityPointerEnd(event) {
        if (event.pointerId === model.identityRevealPointerId) hidePrivateIdentity();
    }

    function handleIdentityKeyup(event) {
        if (event.key === model.identityRevealKey) hidePrivateIdentity();
    }

    function handleIdentityVisibilityChange() {
        if (documentRef.hidden) hidePrivateIdentity();
    }

    function handleFocusOut(event) {
        if (event.target.closest?.('[data-identity-hold]')) hidePrivateIdentity();
    }

    function handleContextMenu(event) {
        if (event.target.closest?.('[data-identity-hold]')) event.preventDefault();
    }

    return {
        handleClick,
        handleKeydown,
        handleIdentityPointerDown,
        handleIdentityPointerMove,
        handleIdentityPointerOut,
        handleIdentityPointerEnd,
        handleIdentityKeyup,
        handleIdentityVisibilityChange,
        handleFocusOut,
        handleContextMenu,
        hidePrivateIdentity,
        setPrivateIdentityVisible,
    };
}
