/** Team selection, hidden identity reveal and decision controls for 阿瓦隆. */
export function createAvalonActions({ mount, model, renderer, scene, rulesModal, send, documentRef = globalThis.document }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`); const state = () => model.state;
    function openRules() { if (scene?.isPlaying?.()) return; rulesModal.setOpen(true); }
    function closeRules() { rulesModal.setOpen(false); }
    function sendAction(action) {
        if (model.actionPending || scene?.isPlaying?.()) return false;
        model.actionPending = true;
        send({ type: 'gameAction', action });
        renderer.render();
        return true;
    }
    function handleClick(event) {
        if (!event.target.closest?.('[data-role-hold]')) renderer.hideRoleIdentity();
        const uiButton = event.target.closest?.('[data-ui]'); const overlay = $('rulesOverlay');
        if (uiButton) { if (uiButton.dataset.ui === 'rules') openRules(); if (uiButton.dataset.ui === 'closeRules') closeRules(); return; }
        if (event.target === overlay) { closeRules(); return; }
        if (model.actionPending || scene?.isPlaying?.()) return;
        const playerButton = event.target.closest?.('[data-select-player]');
        if (playerButton) { const id = playerButton.dataset.selectPlayer; if (model.teamDraft.has(id)) model.teamDraft.delete(id); else if (model.teamDraft.size < state().missionSize) model.teamDraft.add(id); renderer.renderDecision(); [...mount.querySelectorAll('[data-select-player]')].find(button => button.dataset.selectPlayer === id)?.focus({ preventScroll: true }); return; }
        const choiceButton = event.target.closest?.('[data-choice]');
        if (choiceButton) { const choice = choiceButton.dataset.choice; model.pendingChoice = model.pendingChoice === choice ? null : choice; renderer.renderDecision(); if (model.pendingChoice) [...mount.querySelectorAll('[data-choice]')].find(button => button.dataset.choice === model.pendingChoice)?.focus({ preventScroll: true }); return; }
        const assassinButton = event.target.closest?.('[data-assassin-target]'); if (assassinButton) { model.assassinTarget = model.assassinTarget === assassinButton.dataset.assassinTarget ? null : assassinButton.dataset.assassinTarget; renderer.renderDecision(); return; }
        const action = event.target.closest?.('[data-action]'); if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmRole') { renderer.hideRoleIdentity(); sendAction({ kind: 'confirmRole' }); }
        if (action.dataset.action === 'confirmTeam' && model.teamDraft.size === state().missionSize) sendAction({ kind: 'proposeTeam', playerIds: [...model.teamDraft] });
        if (action.dataset.action === 'confirmVote' && model.pendingChoice) sendAction({ kind: 'castVote', approve: model.pendingChoice === 'approve' });
        if (action.dataset.action === 'confirmMission' && model.pendingChoice) sendAction({ kind: 'missionVote', result: model.pendingChoice });
        if (action.dataset.action === 'confirmAssassination' && model.assassinTarget) sendAction({ kind: 'assassinate', targetId: model.assassinTarget });
    }
    function revealRole() { renderer.setRoleIdentityVisible(true); if (state()?.phase === 'roleReveal') renderer.renderDecision(); }
    function handlePointerDown(event) {
        const cover = event.target.closest?.('[data-role-hold]');
        if (!cover || (model.roleRevealPointerId !== null && model.roleRevealPointerId !== event.pointerId) || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        model.roleRevealPointerId = event.pointerId;
        model.roleRevealKey = null;
        try { cover.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture can fail after a concurrent state render. */ }
        revealRole();
    }
    function handlePointerMove(event) {
        if (event.pointerId !== model.roleRevealPointerId) return;
        const cover = $('role')?.querySelector('[data-role-hold]');
        if (!cover) return renderer.hideRoleIdentity();
        const bounds = cover.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) renderer.hideRoleIdentity();
    }
    function pointerInsideCover(cover, event) {
        const bounds = cover?.getBoundingClientRect?.();
        if (!bounds || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
        return event.clientX >= bounds.left && event.clientX <= bounds.right
            && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    }
    function handlePointerOut(event) {
        const cover = event.target.closest?.('[data-role-hold]');
        if (!cover || event.pointerId !== model.roleRevealPointerId || cover.contains(event.relatedTarget)) return;
        // Revealing the card changes the cover's visual state.  Browsers may
        // emit a synthetic pointerout while the pointer is still inside the
        // same rectangle; only a real geometric exit should reseal it.
        if (!pointerInsideCover(cover, event)) renderer.hideRoleIdentity();
    }
    function handlePointerUp(event) { if (model.roleRevealPointerId !== null && event.pointerId === model.roleRevealPointerId) renderer.hideRoleIdentity(); }
    function handlePointerCancel(event) { if (model.roleRevealPointerId !== null && event.pointerId === model.roleRevealPointerId) renderer.hideRoleIdentity(); }
    function handleKeydown(event) { if (rulesModal.trapFocus(event)) return; if (event.key === 'Escape' && rulesModal.isOpen()) { closeRules(); return; } const cover = event.target.closest?.('[data-role-hold]'); if (!cover || event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return; event.preventDefault(); model.roleRevealKey = event.key; revealRole(); }
    function handleKeyup(event) { if (model.roleRevealKey && event.key === model.roleRevealKey) { model.roleRevealKey = null; renderer.hideRoleIdentity(); } }
    function handleFocusout(event) { if (event.target.closest?.('[data-role-hold]')) renderer.hideRoleIdentity(); }
    function handleVisibilityChange() { if (documentRef.hidden) renderer.hideRoleIdentity(); }
    function handleContextmenu(event) { if (event.target.closest?.('[data-role-hold]')) event.preventDefault(); }
    function handleBlur() { renderer.hideRoleIdentity(); }
    return { handleClick, handlePointerDown, handlePointerMove, handlePointerOut, handlePointerUp, handlePointerCancel, handlePointerEnd: handlePointerUp, handleKeydown, handleKeyup, handleFocusout, handleVisibilityChange, handleContextmenu, handleBlur, hideRoleIdentity: renderer.hideRoleIdentity, closeRules };
}
