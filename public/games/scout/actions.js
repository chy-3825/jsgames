import { scoutSourceCard, selectedIndices, selectionAssessment } from './state.js';

/** User interaction and action submission for 马戏星探. */
export function createScoutActions({ mount, model, renderer, scene, rulesModal, send }) {
    const state = () => model.state;
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    function sendAction(action) {
        if (model.actionPending || scene.isPlaying()) return false;
        model.actionPending = true;
        renderer.clearError();
        send({ type: 'gameAction', action });
        renderer.render();
        return true;
    }
    function updateSelection(index) {
        if (!state().availableActions?.canShow || scene.isPlaying()) return;
        if (!model.selected.size) model.selected.add(index);
        else if (model.selected.has(index)) {
            const indices = selectedIndices(model);
            if (index === indices[0] || index === indices.at(-1)) model.selected.delete(index); else model.selected = new Set([index]);
        } else {
            const indices = selectedIndices(model);
            if (index === indices[0] - 1 || index === indices.at(-1) + 1) model.selected.add(index); else model.selected = new Set([index]);
        }
        renderer.renderHand(); renderer.renderCommand();
    }
    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton?.dataset.ui === 'skipPresentation') { scene.skipPresentations(); return; }
        if (scene.isPlaying()) return;
        if (uiButton) {
            if (uiButton.dataset.ui === 'rules') rulesModal.setOpen(true);
            if (uiButton.dataset.ui === 'closeRules') rulesModal.setOpen(false);
            return;
        }
        if (event.target === $('rulesOverlay')) { rulesModal.setOpen(false); return; }
        const card = event.target.closest('[data-card-index]');
        if (card) { updateSelection(Number(card.dataset.cardIndex)); return; }
        const orientation = event.target.closest('[data-orientation-choice]');
        if (orientation) { model.orientationDraft = Number(orientation.dataset.orientationChoice); renderer.renderCommand(); return; }
        const mode = event.target.closest('[data-mode]');
        if (mode) {
            model.actionMode = mode.dataset.mode;
            if (['scout', 'scoutShow'].includes(model.actionMode)) model.scoutDraft.orientation = Number(scoutSourceCard(model)?.orientation) || 0;
            renderer.renderHand(); renderer.renderCommand(); return;
        }
        const edge = event.target.closest('[data-scout-edge]');
        if (edge) { model.scoutDraft.edge = edge.dataset.scoutEdge; model.scoutDraft.orientation = Number(scoutSourceCard(model)?.orientation) || 0; renderer.renderHand(); renderer.renderCommand(); return; }
        const action = event.target.closest('[data-action]');
        if (!action || action.disabled || model.actionPending) return;
        if (action.dataset.action === 'confirmOrientation' && model.orientationDraft !== null) sendAction({ kind: 'setOrientation', orientation: model.orientationDraft });
        if (action.dataset.action === 'confirmShow' && selectionAssessment(model, 'show').valid) sendAction({ kind: 'show', cardIndices: selectedIndices(model) });
        if (action.dataset.action === 'confirmScout') sendAction({ kind: 'scout', ...model.scoutDraft });
        if (action.dataset.action === 'confirmScoutShow' && selectionAssessment(model, 'scoutShow').valid) sendAction({ kind: 'scoutShow', ...model.scoutDraft, cardIndices: selectedIndices(model).map(index => index >= model.scoutDraft.insertAt ? index + 1 : index) });
    }
    function handleChange(event) {
        const field = event.target.closest('[data-draft]');
        if (!field || scene.isPlaying()) return;
        model.scoutDraft[field.dataset.draft] = Number(field.value);
        renderer.renderHand(); renderer.renderCommand();
    }
    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }
    return { handleClick, handleChange, handleKeydown, sendAction };
}
