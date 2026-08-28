import { key } from './constants.js';

export function createCheckersModel() {
    return {
        state: null,
        requestTimer: null,
        animationPending: false,
        animationSequence: 0,
        displayedPositions: new Map(),
        destroyed: false,
    };
}

export function effectivePieces(model) {
    const pieces = (model.state?.pieces || []).map(piece => Object.assign({}, piece));
    const pending = model.state?.pendingMove;
    if (!pending) return pieces;
    const moving = pieces.find(piece => piece.id === pending.pieceId);
    if (moving) { moving.x = pending.current.x; moving.y = pending.current.y; }
    return pieces;
}

export function isLegalTarget(model, x, y) {
    if (!model.state?.selectedPiece) return false;
    return (model.state.legalMoves?.step || []).concat(model.state.legalMoves?.jump || []).some(target => target.x === x && target.y === y);
}

export function interactionLocked(model, actionLock) { return actionLock.pending || model.animationPending; }
export function boardPositionMap(pieces) { return new Map(pieces.map(piece => [piece.id, { x: piece.x, y: piece.y }])); }
export function positionKey(x, y) { return key(x, y); }
