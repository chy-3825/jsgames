export function createJungleScene({ model }) {
    return {
        clearSelection() { model.selected = null; },
        reconcileSelection(pieceAt) {
            if (model.selected && !pieceAt(model.selected.x, model.selected.y)) model.selected = null;
        },
    };
}
