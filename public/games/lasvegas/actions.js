export function createLasVegasActions({ mount, model, renderer, scene, rulesModal, send, addLog, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const state = () => model.state; const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const presentationLocked = () => scene.isPlaying();
    function sendAction(action) { if (presentationLocked() || model.actionPending) return false; model.actionPending = true; renderer.clearError(); send({ type: 'gameAction', action }); renderer.render(); return true; }
    function openRules() { if (presentationLocked()) return; rulesModal?.setOpen(true); }
    function closeRules() { rulesModal?.setOpen(false); }
    function handleClick(event) {
        if (presentationLocked()) {
            if (event.target.closest('[data-ui="skipPresentation"]')) scene.skipPresentations();
            return;
        }
        const control = event.target.closest('[data-ui]'); const ui = control?.dataset.ui;
        if (ui === 'rules') openRules();
        if (ui === 'closeRules' || event.target === $('rulesOverlay')) closeRules();
        if (ui === 'skipPresentation') scene.skipPresentations();
        if (ui === 'roll' && !control.disabled) sendAction({ kind: 'rollDice' });
        if (ui === 'place' && model.selectedFace) { sendAction({ kind: 'placeDice', face: model.selectedFace }); return; }
        const faceButton = event.target.closest('[data-face]');
        if (faceButton && !faceButton.disabled && !presentationLocked()) {
            model.selectedFace = Number(faceButton.dataset.face);
            renderer.renderFaces(); renderer.renderCasinos();
            mount.querySelector(`.lv-face-actions [data-face="${model.selectedFace}"]`)?.focus({ preventScroll: true });
        }
    }
    function handleKeydown(event) {
        if (presentationLocked()) { if (event.key === 'Escape') scene.skipPresentations(); return; }
        if (rulesModal?.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal?.isOpen()) closeRules();
    }
    return { handleClick, handleKeydown, sendAction, openRules, closeRules };
}
