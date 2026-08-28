import {
    BOARD_CENTER_SKINS,
    BOARD_SKIN_STORAGE_KEY,
    BOARD_TILE_COUNT,
    PLAYER_TOKEN_ART,
    TOKEN_STYLE_STORAGE_KEY,
    randomSumSevenDice,
} from './constants.js';

export function readStoredBoardSkin(windowRef = globalThis.window || globalThis) {
    try {
        return windowRef?.localStorage?.getItem(BOARD_SKIN_STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

export function storeBoardSkin(skinId, windowRef = globalThis.window || globalThis) {
    try {
        windowRef?.localStorage?.setItem(BOARD_SKIN_STORAGE_KEY, skinId);
    } catch {
        // Storage may be disabled in privacy mode; the current view still works.
    }
}

export function readStoredTokenStyle(windowRef = globalThis.window || globalThis) {
    try {
        return windowRef?.localStorage?.getItem(TOKEN_STYLE_STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

export function storeTokenStyle(style, windowRef = globalThis.window || globalThis) {
    try {
        windowRef?.localStorage?.setItem(TOKEN_STYLE_STORAGE_KEY, style);
    } catch {
        // Storage may be disabled in privacy mode; the current view still works.
    }
}

export function createMonopolyModel({ windowRef = globalThis.window || globalThis } = {}) {
    const storedTokenStyle = readStoredTokenStyle(windowRef);
    const storedSkinId = readStoredBoardSkin(windowRef);
    const previewTokenStyle = storedTokenStyle === '2d' || storedTokenStyle === '3d' ? storedTokenStyle : '3d';
    const activeSkinId = BOARD_CENTER_SKINS.some(skin => skin.id === storedSkinId) ? storedSkinId : BOARD_CENTER_SKINS[0].id;
    const idleDice = randomSumSevenDice();
    return {
        state: null,
        selectedTile: 0,
        followPlayerPosition: true,
        mobileBoardSignature: '',
        rulesOpen: false,
        skinMenuOpen: false,
        tokenMenuOpen: false,
        localSkinObjectUrl: null,
        previewTokenStyle,
        activeSkinId,
        latestRollKey: '',
        idleDice,
        visibleDice: idleDice,
        diceAnimationTimer: null,
        diceAnimationToken: 0,
        diceAnimationFinal: null,
        diceAnimationStartedAt: 0,
        isDiceAnimating: false,
        isRollPending: false,
        latestMoveKey: '',
        visualPositions: new Map(),
        movementAnimationTimer: null,
        movementAnimationToken: 0,
        movementAnimation: null,
        pendingMovement: null,
        isMoveAnimating: false,
    };
}

export function normalizeDice(values) {
    if (!Array.isArray(values) || values.length !== 2) return null;
    const dice = values.map(value => Number(value));
    return dice.every(value => Number.isInteger(value) && value >= 1 && value <= 6) ? dice : null;
}

export function movementPath(from, to, direction = 1) {
    const start = Number(from);
    const target = Number(to);
    if (!Number.isInteger(start) || !Number.isInteger(target) || start === target) return [];
    const stepDirection = direction < 0 ? -1 : 1;
    const distance = stepDirection > 0
        ? (target - start + BOARD_TILE_COUNT) % BOARD_TILE_COUNT
        : (start - target + BOARD_TILE_COUNT) % BOARD_TILE_COUNT;
    if (!distance || distance > BOARD_TILE_COUNT - 1) return [start, target];
    return Array.from({ length: distance + 1 }, (_, index) => (start + stepDirection * index + BOARD_TILE_COUNT * 2) % BOARD_TILE_COUNT);
}

export function movementRequest(model, previousState, nextState) {
    if (!previousState?.players || !nextState?.players) return null;
    const preferredPlayerId = nextState.lastAction?.playerId || null;
    const changed = nextState.players.find(player => {
        if (player.isBankrupt) return false;
        if (preferredPlayerId && player.id !== preferredPlayerId) return false;
        const previous = previousState.players.find(candidate => candidate.id === player.id);
        return previous && previous.position !== player.position;
    }) || nextState.players.find(player => {
        if (player.isBankrupt) return false;
        const previous = previousState.players.find(candidate => candidate.id === player.id);
        return previous && previous.position !== player.position;
    });
    if (!changed) return null;
    const previousPlayer = previousState.players.find(player => player.id === changed.id);
    const currentVisualPosition = model.movementAnimation?.playerId === changed.id
        ? model.visualPositions.get(changed.id)
        : previousPlayer.position;
    const cardDirection = nextState.lastEvent?.kind === 'move_steps' && Number(nextState.lastEvent.steps) < 0 ? -1 : 1;
    const path = movementPath(currentVisualPosition, changed.position, cardDirection);
    if (path.length < 2) return null;
    return {
        key: `${changed.id}:${previousPlayer.position}:${changed.position}:${nextState.lastAction?.message || ''}`,
        playerId: changed.id,
        path,
    };
}

export function displayedPosition(model, player) {
    if (model.movementAnimation?.playerId === player.id) return model.movementAnimation.path[model.movementAnimation.index];
    return model.visualPositions.get(player.id) ?? player.position;
}

export function syncVisualPositions(model, nextState) {
    const activeIds = new Set((nextState.players || []).map(player => player.id));
    for (const id of model.visualPositions.keys()) if (!activeIds.has(id)) model.visualPositions.delete(id);
    for (const player of nextState.players || []) {
        if (!model.visualPositions.has(player.id)) model.visualPositions.set(player.id, player.position);
    }
}

export function tokenStyleFor(player) {
    return PLAYER_TOKEN_ART[player?.tokenStyle] ? player.tokenStyle : '3d';
}
