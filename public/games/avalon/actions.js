/** Team selection, hidden identity reveal and decision controls for 阿瓦隆. */
export function createAvalonActions({ mount, model, renderer, rulesModal, send, documentRef = globalThis.document }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`); const state = () => model.state;
    function openRules() { rulesModal.setOpen(true); }
    function closeRules() { rulesModal.setOpen(false); }
    function sendAction(action) { send({ type: 'gameAction', action }); }
    function handleClick(event) {
        if (!event.target.closest('[data-role-hold]')) renderer.hideRoleIdentity();
        const uiButton = event.target.closest('[data-ui]'); const overlay = $('rulesOverlay');
        if (uiButton) { if (uiButton.dataset.ui === 'rules') openRules(); if (uiButton.dataset.ui === 'closeRules') closeRules(); return; }
        if (event.target === overlay) { closeRules(); return; }
        const playerButton = event.target.closest('[data-select-player]');
        if (playerButton) { const id = playerButton.dataset.selectPlayer; if (model.teamDraft.has(id)) model.teamDraft.delete(id); else if (model.teamDraft.size < state().missionSize) model.teamDraft.add(id); renderer.renderDecision(); [...mount.querySelectorAll('[data-select-player]')].find(button => button.dataset.selectPlayer === id)?.focus({ preventScroll: true }); return; }
        const choiceButton = event.target.closest('[data-choice]');
        if (choiceButton) { const choice = choiceButton.dataset.choice; model.pendingChoice = model.pendingChoice === choice ? null : choice; renderer.renderDecision(); if (model.pendingChoice) [...mount.querySelectorAll('[data-choice]')].find(button => button.dataset.choice === model.pendingChoice)?.focus({ preventScroll: true }); return; }
        const assassinButton = event.target.closest('[data-assassin-target]'); if (assassinButton) { model.assassinTarget = model.assassinTarget === assassinButton.dataset.assassinTarget ? null : assassinButton.dataset.assassinTarget; renderer.renderDecision(); return; }
        const action = event.target.closest('[data-action]'); if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmRole') { renderer.hideRoleIdentity(); sendAction({ kind: 'confirmRole' }); }
        if (action.dataset.action === 'confirmTeam' && model.teamDraft.size === state().missionSize) sendAction({ kind: 'proposeTeam', playerIds: [...model.teamDraft] });
        if (action.dataset.action === 'confirmVote' && model.pendingChoice) sendAction({ kind: 'castVote', approve: model.pendingChoice === 'approve' });
        if (action.dataset.action === 'confirmMission' && model.pendingChoice) sendAction({ kind: 'missionVote', result: model.pendingChoice });
        if (action.dataset.action === 'confirmAssassination' && model.assassinTarget) sendAction({ kind: 'assassinate', targetId: model.assassinTarget });
    }
    function handlePointerDown(event) { const cover = event.target.closest('[data-role-hold]'); if (!cover || (event.button !== undefined && event.button > 0)) return; event.preventDefault(); model.roleRevealPointerId = event.pointerId; cover.setPointerCapture?.(event.pointerId); renderer.setRoleIdentityVisible(true); if (state()?.phase === 'roleReveal') renderer.renderDecision(); }
    function handlePointerEnd(event) { if (model.roleRevealPointerId !== null && (event.pointerId === undefined || event.pointerId === model.roleRevealPointerId)) renderer.hideRoleIdentity(); }
    function handlePointerOut(event) { const cover = event.target.closest('[data-role-hold]'); if (cover && !cover.contains(event.relatedTarget)) renderer.hideRoleIdentity(); }
    function handleKeydown(event) { if (rulesModal.trapFocus(event)) return; if (event.key === 'Escape' && rulesModal.isOpen()) { closeRules(); return; } const cover = event.target.closest?.('[data-role-hold]'); if (!cover || event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return; event.preventDefault(); model.roleRevealKey = event.key; renderer.setRoleIdentityVisible(true); if (state()?.phase === 'roleReveal') renderer.renderDecision(); }
    function handleKeyup(event) { if (model.roleRevealKey && event.key === model.roleRevealKey) { model.roleRevealKey = null; renderer.hideRoleIdentity(); } }
    function handleFocusout(event) { if (event.target.closest?.('[data-role-hold]')) renderer.hideRoleIdentity(); }
    function handleVisibilityChange() { if (documentRef.hidden) renderer.hideRoleIdentity(); }
    return { handleClick, handlePointerDown, handlePointerEnd, handlePointerOut, handleKeydown, handleKeyup, handleFocusout, handleVisibilityChange, hideRoleIdentity: renderer.hideRoleIdentity, closeRules };
}
