import { DICE_ANIMATION_MS, MOVE_STEP_MS, randomSumSevenDice } from './constants.js';
import { movementRequest as getMovementRequest, normalizeDice, displayedPosition, syncVisualPositions } from './state.js';

/** Dice and token movement presentation for 环城大富翁. */
export function createMonopolyScene({ model, renderer, windowRef = globalThis.window || globalThis }) {
    const schedule = (callback, delay) => (windowRef?.setTimeout || globalThis.setTimeout)(callback, delay);
    const cancel = timer => (windowRef?.clearTimeout || globalThis.clearTimeout)(timer);
    const now = () => (windowRef?.Date?.now || Date.now)();

    function finishDiceAnimation() {
        if (!model.diceAnimationFinal) return;
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceAnimationTimer = null;
        model.visibleDice = model.diceAnimationFinal;
        model.diceAnimationFinal = null;
        model.isDiceAnimating = false;
        model.isRollPending = false;
        const queuedMovement = model.pendingMovement;
        model.pendingMovement = null;
        renderer.renderDice(model.visibleDice, true);
        if (queuedMovement) startMovementAnimation(queuedMovement);
        renderer.render();
    }

    function runDiceFrame(animationToken) {
        if (animationToken !== model.diceAnimationToken || !model.isDiceAnimating) return;
        const elapsed = now() - model.diceAnimationStartedAt;
        if (elapsed >= DICE_ANIMATION_MS && model.diceAnimationFinal) return finishDiceAnimation();
        const rollingDice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        renderer.renderDice(rollingDice);
        const progress = Math.min(elapsed / DICE_ANIMATION_MS, 1);
        const nextDelay = 35 + Math.round(progress * progress * 75);
        model.diceAnimationTimer = schedule(() => runDiceFrame(animationToken), nextDelay);
    }

    function beginDiceAnimation(finalValues = null, rollKey = '') {
        const finalDice = normalizeDice(finalValues);
        if (rollKey && rollKey === model.latestRollKey) {
            if (finalDice) model.diceAnimationFinal = finalDice;
            return;
        }
        if (rollKey) model.latestRollKey = rollKey;
        if (model.isDiceAnimating) {
            if (finalDice) model.diceAnimationFinal = finalDice;
            return;
        }
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceAnimationFinal = finalDice;
        model.diceAnimationStartedAt = now();
        model.isDiceAnimating = true;
        const animationToken = ++model.diceAnimationToken;
        renderer.render();
        runDiceFrame(animationToken);
    }

    function cancelDiceAnimation() {
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceAnimationTimer = null;
        model.diceAnimationToken += 1;
        model.diceAnimationFinal = null;
        model.isDiceAnimating = false;
        model.isRollPending = false;
        model.pendingMovement = null;
        renderer.render();
    }

    function finishMovementAnimation(animationToken) {
        if (animationToken !== model.movementAnimationToken) return;
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.movementAnimationTimer = null;
        if (model.movementAnimation) model.visualPositions.set(model.movementAnimation.playerId, model.movementAnimation.path[model.movementAnimation.path.length - 1]);
        model.movementAnimation = null;
        model.isMoveAnimating = false;
        renderer.render();
    }

    function advanceMovementAnimation(animationToken) {
        if (animationToken !== model.movementAnimationToken || !model.movementAnimation) return;
        if (model.movementAnimation.index >= model.movementAnimation.path.length - 1) return finishMovementAnimation(animationToken);
        model.movementAnimation.index += 1;
        model.visualPositions.set(model.movementAnimation.playerId, model.movementAnimation.path[model.movementAnimation.index]);
        renderer.render();
        model.movementAnimationTimer = schedule(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
    }

    function startMovementAnimation(request) {
        if (!request || request.path.length < 2) return false;
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.movementAnimationToken += 1;
        model.visualPositions.set(request.playerId, request.path[0]);
        model.movementAnimation = { ...request, index: 0 };
        model.isMoveAnimating = true;
        const animationToken = model.movementAnimationToken;
        model.movementAnimationTimer = schedule(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
        renderer.render();
        return true;
    }

    function movementRequest(previousState, nextState) {
        return getMovementRequest(model, previousState, nextState);
    }

    function syncPositions(nextState) {
        syncVisualPositions(model, nextState);
    }

    function stop() {
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.diceAnimationTimer = null;
        model.movementAnimationTimer = null;
        model.diceAnimationToken += 1;
        model.movementAnimationToken += 1;
        model.movementAnimation = null;
        model.pendingMovement = null;
        model.isDiceAnimating = false;
        model.isMoveAnimating = false;
        model.isRollPending = false;
    }

    return {
        beginDiceAnimation,
        cancelDiceAnimation,
        movementRequest,
        startMovementAnimation,
        syncVisualPositions: syncPositions,
        displayedPosition: player => displayedPosition(model, player),
        stop,
        randomizeIdleDice() {
            model.idleDice = randomSumSevenDice();
        },
    };
}
