import { claimForTile, cellKey, hasLegalPlacement, legalAnchors, placementOrientation } from './state.js';

/** User interaction handlers for 多米诺王国. */
export function createKingdominoActions({ mount, model, scene, renderer, send, rulesModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    function selectBoardCell(cell) {
        const current = state(); const tile = current?.mySelectedTile;
        if (!current?.availableActions?.canPlace || !tile || model.actionPending) return;
        const key = cellKey(cell); const anchors = legalAnchors(current, tile);
        if (!model.placementCells.length) {
            if (anchors.has(key)) model.placementCells = [cell];
        } else if (model.placementCells.length === 1) {
            if (cellKey(model.placementCells[0]) === key) model.placementCells = [];
            else if (placementOrientation(current, tile, [model.placementCells[0], cell])) model.placementCells.push(cell);
            else if (anchors.has(key)) model.placementCells = [cell];
        } else {
            const selected = model.placementCells.find(item => cellKey(item) === key);
            model.placementCells = selected ? [selected] : anchors.has(key) ? [cell] : model.placementCells;
        }
        renderer.renderCommand(); renderer.renderBoard();
    }
    function sendAction(action) {
        if (model.actionPending) return;
        model.actionPending = true;
        send({ type: 'gameAction', action });
        renderer.render();
    }
    function handleClick(event) {
        if (scene.isPlaying()) { if (event.target.closest('[data-action="skipPresentation"]')) scene.stopPresentation(); return; }
        const cellButton = event.target.closest('[data-cell]');
        if (cellButton && !cellButton.disabled) { const [x, y] = cellButton.dataset.cell.split(',').map(Number); if (Number.isInteger(x) && Number.isInteger(y)) selectBoardCell({ x, y }); return; }
        const domino = event.target.closest('[data-domino-id]');
        if (domino && state()?.availableActions?.canSelect && !model.actionPending && !claimForTile(state(), (state().draft || []).find(tile => tile.id === domino.dataset.dominoId))) { model.pendingDominoId = model.pendingDominoId === domino.dataset.dominoId ? null : domino.dataset.dominoId; renderer.renderDraft(); return; }
        const actionButton = event.target.closest('[data-action]');
        if (actionButton && !actionButton.disabled) {
            const action = actionButton.dataset.action;
            if (action === 'clear') { model.placementCells = []; renderer.renderCommand(); renderer.renderBoard(); }
            if (action === 'confirmDomino' && model.pendingDominoId) sendAction({ kind: 'selectDomino', dominoId: model.pendingDominoId });
            if (action === 'swap' && model.placementCells.length === 2) { model.placementCells.reverse(); renderer.renderCommand(); renderer.renderBoard(); }
            if (action === 'place') { const orientation = placementOrientation(state(), state().mySelectedTile, model.placementCells); if (orientation) { const [first, second] = model.placementCells; sendAction({ kind: 'placeDomino', x1: first.x, y1: first.y, x2: second.x, y2: second.y }); } }
            if (action === 'discard' && !hasLegalPlacement(state(), state().mySelectedTile)) sendAction({ kind: 'discardDomino' });
            return;
        }
        const uiButton = event.target.closest('[data-ui]'); const ui = uiButton?.dataset.ui;
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === $('rules')) rulesModal.setOpen(false);
    }
    function handleKeydown(event) {
        if (event.key === 'Escape' && scene.isPlaying()) return scene.stopPresentation();
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }
    return { handleClick, handleKeydown };
}
