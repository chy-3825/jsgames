export function createJungleModel() {
    return { state: null, selected: null };
}

export function pieceAt(model, x, y) {
    return model.state?.pieces?.find(piece => piece.x === x && piece.y === y) || null;
}

export function legalTargets(model, piece) {
    return piece?.id ? model.state?.legalMoves?.[piece.id] || [] : [];
}

export function isTarget(model, x, y) {
    return Boolean(model.selected && legalTargets(model, model.selected).some(move => move.x === x && move.y === y));
}

export function pieceName(type, pieces) { return pieces[type]?.title || '兽子'; }
export function formatSquare(square) { return square ? `${square.x + 1}·${square.y + 1}` : ''; }
