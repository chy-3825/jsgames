export function createGobangModel() {
    return { state: null, hover: null };
}

export function pieceAt(model, x, y) {
    return model.state?.pieces?.find(piece => piece.x === x && piece.y === y) || null;
}

export function formatPoint(x, y) {
    return `${String.fromCharCode(65 + Number(x))}${Number(y) + 1}`;
}
