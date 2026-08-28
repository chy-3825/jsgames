import { escapeHtml } from './constants.js';

/** User interaction and action submission handlers for 富饶之城. */
export function createCitadelsActions({ mount, model, renderer, scene, send, rulesModal }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;

    function sendAction(action) {
        if (model.actionPending) return false;
        model.actionPending = true;
        renderer.clearError();
        send({ type: 'gameAction', action });
        renderer.render();
        return true;
    }

    function handleClick(event) {
        const skipButton = event.target.closest('[data-action="skipPresentation"]');
        if (skipButton) { scene.stopPresentation(); return; }
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            if (uiButton.dataset.ui === 'rules') rulesModal.setOpen(true);
            if (uiButton.dataset.ui === 'closeRules') rulesModal.setOpen(false);
            return;
        }
        if (scene.isPlaying()) return;
        const overlay = $('rulesOverlay');
        if (event.target === overlay) { rulesModal.setOpen(false); return; }
        const actionButtonElement = event.target.closest('button[data-action]');
        if (!actionButtonElement || actionButtonElement.disabled || model.actionPending) return;
        const kind = actionButtonElement.dataset.action;
        const value = actionButtonElement.dataset.value || mount.querySelector(`select[data-select-for="${kind}"]`)?.value;
        if (kind === 'prepareDecision') {
            const decisionKind = actionButtonElement.dataset.decisionKind;
            const decisionValue = actionButtonElement.dataset.value || mount.querySelector(`select[data-select-for="${decisionKind}"]`)?.value;
            if (decisionKind && decisionValue) {
                if (decisionKind === 'laboratory') model.pendingBuildId = null;
                model.pendingDecision = { kind: decisionKind, value: decisionValue };
                renderer.render();
            }
        } else if (kind === 'cancelDecision') { model.pendingDecision = null; renderer.render(); }
        else if (kind === 'confirmDecision' && model.pendingDecision) {
            const decision = model.pendingDecision;
            renderer.render();
            if (decision.kind === 'assassinate' || decision.kind === 'rob') sendAction({ kind: decision.kind, roleId: decision.value });
            else if (decision.kind === 'magicianExchange') sendAction({ kind: decision.kind, targetId: decision.value });
            else if (decision.kind === 'laboratory') sendAction({ kind: decision.kind, cardId: decision.value });
            else if (decision.kind === 'destroyDistrict') {
                const [targetId, cardId] = String(decision.value || '').split('::');
                if (targetId && cardId) sendAction({ kind: decision.kind, targetId, cardId });
            }
        } else if (kind === 'selectRole') {
            model.pendingRoleId = model.pendingRoleId === value && model.pendingRoleAction === actionButtonElement.dataset.roleAction ? null : value;
            model.pendingRoleAction = model.pendingRoleId ? actionButtonElement.dataset.roleAction : null;
            renderer.render();
        } else if (kind === 'confirmRole' && model.pendingRoleId && model.pendingRoleAction) {
            const roleId = model.pendingRoleId;
            const roleAction = model.pendingRoleAction;
            renderer.render();
            sendAction({ kind: roleAction, roleId });
        } else if (kind === 'selectBuild') { model.pendingDecision = null; model.pendingBuildId = model.pendingBuildId === value ? null : value; renderer.render(); }
        else if (kind === 'confirmBuild' && model.pendingBuildId) { const cardId = model.pendingBuildId; renderer.render(); sendAction({ kind: 'buildDistrict', cardId }); }
        else if (kind === 'keepDistrict') sendAction({ kind, cardIds: [value] });
        else if (kind === 'toggleKeep') { renderer.toggleSelection(value, state().myDrawKeepCount || 1); renderer.render(); }
        else if (kind === 'confirmKeep') sendAction({ kind: 'keepDistrict', cardIds: model.selectedCardIds });
        else if (kind === 'startSwap') { model.swapMode = true; model.selectedCardIds = []; renderer.render(); }
        else if (kind === 'toggleSwap') { renderer.toggleSelection(value, state().myHand?.length || 0); renderer.render(); }
        else if (kind === 'confirmSwap') sendAction({ kind: 'magicianSwap', cardIds: model.selectedCardIds });
        else sendAction({ kind });
    }

    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
        else if (event.key === 'Escape' && model.pendingDecision) { model.pendingDecision = null; renderer.render(); }
        else if (event.key === 'Escape' && scene.isPlaying()) scene.stopPresentation();
    }

    return { handleClick, handleKeydown, sendAction };
}
