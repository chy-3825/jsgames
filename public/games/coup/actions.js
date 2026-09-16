import { getAction, getPlayer, isMyTurn, decisionReady } from './state.js';

/** Pointer, keyboard and action submission handlers for 政变. */
export function createCoupActions({ mount, model, renderer, scene, send }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;

    function handleAction(kind) {
        if (scene.isPlaying() || model.submitting) return;
        model.pendingAction = { kind };
        model.hoveredActionKind = null;
        model.selectedTarget = null;
        renderer.render();
    }

    function hoverAvailable() {
        return globalThis.window?.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false;
    }

    function handlePointerOver(event) {
        if (!hoverAvailable() || model.pendingAction || scene.isPlaying()) return;
        const action = event.target.closest('[data-action-kind]');
        if (!action || action.disabled || model.hoveredActionKind === action.dataset.actionKind) return;
        model.hoveredActionKind = action.dataset.actionKind;
        renderer.renderEvent();
    }

    function handlePointerOut(event) {
        if (!model.hoveredActionKind || model.pendingAction) return;
        const action = event.target.closest('[data-action-kind]');
        if (!action || action.contains(event.relatedTarget)) return;
        model.hoveredActionKind = null;
        renderer.renderEvent();
    }

    function selectTarget(id) {
        if (scene.isPlaying() || model.submitting) return;
        if (!model.pendingAction) return;
        if (!getAction(model.pendingAction.kind)?.needsTarget) return;
        model.selectedTarget = id;
        renderer.render();
    }

    function confirmAction() {
        if (scene.isPlaying() || model.submitting) return;
        if (!model.pendingAction) return;
        const action = getAction(model.pendingAction.kind);
        if (action?.needsTarget && !model.selectedTarget) return;
        model.submitting = true;
        send({ type: 'gameAction', action: { kind: model.pendingAction.kind, ...(action?.needsTarget ? { targetId: model.selectedTarget } : {}) } });
        renderer.render();
    }

    function handleClick(event) {
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
            if (!renderer.decisionReady() || model.submitting) return;
            model.submitting = true;
            send({ type: 'gameAction', action: { kind: challenge.dataset.challenge } });
            renderer.render();
            return;
        }
        const loss = event.target.closest('[data-loss-index]');
        if (loss) {
            if (!renderer.decisionReady() || model.submitting) return;
            model.submitting = true;
            send({ type: 'gameAction', action: { kind: 'influence_loss', influenceIndex: Number(loss.dataset.lossIndex) } });
            renderer.render();
            return;
        }
        const roleCard = event.target.closest('[data-role-card]');
        if (roleCard) { renderer.openRoleDetail(roleCard.dataset.roleCard); return; }
        const button = event.target.closest('[data-action]');
        if (!button) {
            if (event.target === $('rolesOverlay')) renderer.setOverlay($('rolesOverlay'), false);
            if (event.target === $('historyOverlay')) renderer.setOverlay($('historyOverlay'), false);
            if (event.target === $('roleDetailOverlay')) renderer.setOverlay($('roleDetailOverlay'), false);
            return;
        }
        switch (button.dataset.action) {
            case 'confirm-action': confirmAction(); break;
            case 'cancel-target': if (!model.submitting) { model.pendingAction = null; model.hoveredActionKind = null; model.selectedTarget = null; renderer.render(); } break;
            case 'roles': renderer.setOverlay($('rolesOverlay'), true); break;
            case 'close-roles': renderer.setOverlay($('rolesOverlay'), false); break;
            case 'open-history': renderer.setOverlay($('historyOverlay'), true); break;
            case 'close-history': renderer.setOverlay($('historyOverlay'), false); break;
            case 'close-role-detail': renderer.setOverlay($('roleDetailOverlay'), false); break;
            case 'confirm-exchange-select':
                if (!model.submitting && current?.exchange?.isMyTurn && model.exchangeKeep.length === current.exchange.keepCount) {
                    model.submitting = true;
                    send({ type: 'gameAction', action: { kind: 'exchangeSelect', keepIndices: model.exchangeKeep } });
                    renderer.render();
                }
                break;
            default: break;
        }
    }

    function handleKeydown(event) {
        if (scene.isPlaying()) { if (event.key === 'Escape') scene.skipScene(); return; }
        if (renderer.trapOverlayFocus(event)) return;
        if (event.key !== 'Escape') return;
        renderer.setOverlay($('rolesOverlay'), false);
        renderer.setOverlay($('historyOverlay'), false);
        renderer.setOverlay($('roleDetailOverlay'), false);
        if (!state()?.exchange?.isMyTurn) {
            renderer.setOverlay($('exchangeOverlay'), false);
            model.exchangeOpen = false;
            model.exchangeMode = null;
        }
    }

    return {
        handleClick,
        handlePointerOver,
        handlePointerOut,
        handleKeydown,
    };
}
