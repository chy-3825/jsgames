import { BASE_CENTERS, COLOR_STARTS, FINISH_CENTERS, FINISH_PROGRESS, FLIGHT_DISTANCE, FLIGHT_PROGRESS, HOME_CENTERS, HOME_START_PROGRESS, LAST_ROUTE_PROGRESS, READY_CENTERS, ROUTE_CENTERS } from './constants.js';

export function createAeroplaneModel() {
    return { state: null, latestMoveKey: '', animatedPlaneId: null, latestRollKey: '', visibleDiceValue: 0, diceAnimationTimer: null, diceAnimationToken: 0, diceAnimationFinalValue: 0, diceAnimationStartedAt: 0, diceValueBeforeAnimation: 0, isDiceAnimating: false, isRollPending: false, selectedPlaneId: null, selectedColor: null, movementAnimationTimer: null, movementAnimationToken: 0, movementAnimation: null, isMoveAnimating: false, destroyed: false };
}

export function currentPlayer(model) { return model.state?.players?.find(player => player.id === model.state.currentTurn) || null; }
export function canMove(model, plane, actionLock = null) { return Boolean(!model.isDiceAnimating && !model.isMoveAnimating && !actionLock?.pending && plane && model.state?.availableActions?.movablePlaneIds?.includes(plane.id)); }
export function planePosition(plane) {
    if (!plane) return null;
    if (plane.status === 'base') return BASE_CENTERS[plane.color]?.[plane.number - 1] || null;
    if (plane.status === 'ready') return READY_CENTERS[plane.color] || null;
    if (plane.status === 'flying') return ROUTE_CENTERS[plane.globalPosition] || null;
    if (plane.status === 'home') return HOME_CENTERS[plane.color]?.[plane.progress - HOME_START_PROGRESS] || null;
    if (plane.status === 'finished') return FINISH_CENTERS[plane.color] || null;
    return null;
}
export function planeLocationKey(plane) {
    if (plane.status === 'base') return `base-${plane.color}-${plane.number}`;
    if (plane.status === 'ready') return `ready-${plane.color}`;
    if (plane.status === 'flying') return `route-${plane.globalPosition}`;
    if (plane.status === 'home') return `home-${plane.color}-${plane.progress}`;
    return `finish-${plane.color}`;
}
export function positionStyle(point, size, offset = [0, 0], boardSize = 1254) {
    const x = ((point[0] + offset[0]) / boardSize) * 100;
    const y = ((point[1] + offset[1]) / boardSize) * 100;
    return `--piece-x:${x}%;--piece-y:${y}%;--piece-size:${(size / boardSize) * 100}%`;
}
export function frameForProgress(template, progress) {
    if (progress < 0) return { ...template, progress: -1, status: 'ready', globalPosition: null };
    const status = progress === FINISH_PROGRESS ? 'finished' : progress > LAST_ROUTE_PROGRESS ? 'home' : 'flying';
    return { ...template, progress, status, globalPosition: status === 'flying' ? (COLOR_STARTS[template.color] + progress) % 52 : null };
}
export function buildMovementPath(previousPlane, move, finalPlane) {
    if (!previousPlane || !move || !finalPlane) return [];
    const path = [{ ...previousPlane }];
    if (Array.isArray(move.path) && move.path.length) {
        for (const frame of move.path) path.push({ ...previousPlane, ...frame });
        return path;
    }
    if (previousPlane.status === 'base') {
        path.push({ ...finalPlane, progress: -1, status: 'ready', globalPosition: null });
        return path;
    }
    const fromProgress = previousPlane.status === 'ready' ? -1 : Number(move.from?.progress ?? previousPlane.progress);
    const toProgress = Number(move.to?.progress ?? finalPlane.progress);
    for (let progress = fromProgress + 1; progress <= toProgress; progress += 1) path.push(frameForProgress(previousPlane, progress));
    if (path.length === 1) path.push({ ...finalPlane });
    return path;
}
export function buildPredictedMovement(plane, dice, jumpProgress, flightProgress) {
    if (!plane || !Number.isInteger(dice) || dice < 1 || dice > 6) return null;
    if (plane.status === 'base') return { final: { ...plane, progress: -1, status: 'ready', globalPosition: null }, frames: [] };
    let progress = plane.status === 'ready' ? dice - 1 : plane.progress + dice;
    if (progress > FINISH_PROGRESS) return null;
    const frames = [];
    const startProgress = plane.status === 'ready' ? -1 : plane.progress;
    const landedByDice = progress;
    for (let step = startProgress + 1; step <= landedByDice; step += 1) frames.push(frameForProgress(plane, step));
    if (progress <= LAST_ROUTE_PROGRESS) {
        let jumpedToFlight = false;
        if (jumpProgress.has(progress)) { progress = Math.min(progress + 4, LAST_ROUTE_PROGRESS); frames.push(frameForProgress(plane, progress)); jumpedToFlight = progress === flightProgress; }
        if (progress === flightProgress) {
            progress = Math.min(progress + FLIGHT_DISTANCE, LAST_ROUTE_PROGRESS);
            frames.push(frameForProgress(plane, progress));
            if (!jumpedToFlight && landedByDice <= LAST_ROUTE_PROGRESS && progress < LAST_ROUTE_PROGRESS && jumpProgress.has(progress)) { progress = Math.min(progress + 4, LAST_ROUTE_PROGRESS); frames.push(frameForProgress(plane, progress)); }
        }
    }
    return { final: frameForProgress(plane, progress), frames };
}
export function predictedPlane(model, plane, jumpProgress, flightProgress, actionLock = null) {
    if (!plane || !canMove(model, plane, actionLock)) return null;
    return buildPredictedMovement(plane, Number(model.state?.dice), jumpProgress, flightProgress)?.final || null;
}
