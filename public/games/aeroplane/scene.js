import { DICE_ANIMATION_MS, DICE_PIPS, MOVE_STEP_MS } from './constants.js';
import { buildMovementPath } from './state.js';

export function createAeroplaneScene({ model, getElement, onRender, windowRef = globalThis.window || globalThis }) {
    const diceEl = getElement('dice');
    const dicePanelEl = getElement('dicePanel');
    const diceCaptionEl = getElement('diceCaption');
    const schedule = (callback, delay) => (windowRef.setTimeout || setTimeout)(callback, delay);
    const cancel = timer => (windowRef.clearTimeout || clearTimeout)(timer);

    function setDiceFace(value, announce = true) {
        const dice = Number(value) || 0;
        const face = DICE_PIPS[dice] || DICE_PIPS[1];
        diceEl.dataset.value = dice ? String(dice) : '';
        diceEl.innerHTML = Array.from({ length: 9 }, (_, index) => `<i class="${face.includes(index) ? 'is-on' : ''}" aria-hidden="true"></i>`).join('');
        if (announce) diceEl.setAttribute('aria-label', dice ? `骰子点数 ${dice}` : '尚未掷骰');
    }
    function finishDiceAnimation() {
        if (!model.diceAnimationFinalValue) return;
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceAnimationTimer = null;
        model.visibleDiceValue = model.diceAnimationFinalValue;
        model.diceAnimationFinalValue = 0;
        model.isDiceAnimating = false;
        model.isRollPending = false;
        dicePanelEl.classList.remove('is-rolling');
        diceEl.classList.remove('is-rolling', 'has-landed');
        setDiceFace(model.visibleDiceValue);
        void diceEl.offsetWidth;
        diceEl.classList.add('has-landed');
        onRender?.();
    }
    function runDiceFrame(animationToken) {
        if (animationToken !== model.diceAnimationToken || !model.isDiceAnimating) return;
        const elapsed = Date.now() - model.diceAnimationStartedAt;
        if (elapsed >= DICE_ANIMATION_MS && model.diceAnimationFinalValue) return finishDiceAnimation();
        setDiceFace(Math.floor(Math.random() * 6) + 1, false);
        const progress = Math.min(elapsed / DICE_ANIMATION_MS, 1);
        model.diceAnimationTimer = schedule(() => runDiceFrame(animationToken), 32 + Math.round(progress * progress * 70));
    }
    function beginDiceAnimation(finalValue = 0, rollKey = '') {
        if (rollKey && rollKey === model.latestRollKey) return;
        if (rollKey) model.latestRollKey = rollKey;
        if (model.isDiceAnimating) { if (finalValue) model.diceAnimationFinalValue = finalValue; return; }
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceValueBeforeAnimation = model.visibleDiceValue;
        model.diceAnimationFinalValue = finalValue;
        model.diceAnimationStartedAt = Date.now();
        model.isDiceAnimating = true;
        const animationToken = ++model.diceAnimationToken;
        dicePanelEl.classList.add('is-rolling');
        diceEl.classList.remove('has-landed');
        diceEl.classList.add('is-rolling');
        diceEl.setAttribute('aria-label', '骰子滚动中');
        runDiceFrame(animationToken);
        onRender?.();
    }
    function cancelDiceAnimation() {
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        model.diceAnimationTimer = null;
        model.diceAnimationToken += 1;
        model.diceAnimationFinalValue = 0;
        model.isDiceAnimating = false;
        model.isRollPending = false;
        dicePanelEl.classList.remove('is-rolling');
        diceEl.classList.remove('is-rolling');
        setDiceFace(model.diceValueBeforeAnimation);
        onRender?.();
    }
    function finishMovementAnimation(animationToken) {
        if (animationToken !== model.movementAnimationToken) return;
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.movementAnimationTimer = null;
        model.movementAnimation = null;
        model.isMoveAnimating = false;
        onRender?.();
    }
    function advanceMovementAnimation(animationToken) {
        if (animationToken !== model.movementAnimationToken || !model.movementAnimation) return;
        if (model.movementAnimation.index >= model.movementAnimation.path.length - 1) return finishMovementAnimation(animationToken);
        model.movementAnimation.index += 1;
        onRender?.();
        model.movementAnimationTimer = schedule(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
    }
    function startMovementAnimation(previousPlane, move, finalPlane) {
        const path = buildMovementPath(previousPlane, move, finalPlane);
        if (path.length < 2) return false;
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.movementAnimationToken += 1;
        model.movementAnimation = { planeId: finalPlane.id, path, index: 0 };
        model.isMoveAnimating = true;
        model.animatedPlaneId = finalPlane.id;
        model.selectedPlaneId = null;
        const animationToken = model.movementAnimationToken;
        model.movementAnimationTimer = schedule(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
        onRender?.();
        return true;
    }
    function movementDisplayPlane(plane) {
        if (!model.movementAnimation || model.movementAnimation.planeId !== plane.id) return plane;
        const frame = model.movementAnimation.path[model.movementAnimation.index];
        return frame ? { ...plane, ...frame } : plane;
    }
    function stop() {
        if (model.diceAnimationTimer) cancel(model.diceAnimationTimer);
        if (model.movementAnimationTimer) cancel(model.movementAnimationTimer);
        model.diceAnimationTimer = null;
        model.movementAnimationTimer = null;
        model.diceAnimationToken += 1;
        model.movementAnimationToken += 1;
        model.movementAnimation = null;
        model.isDiceAnimating = false;
        model.isMoveAnimating = false;
        model.isRollPending = false;
    }
    setDiceFace(0);
    return { setDiceFace, beginDiceAnimation, cancelDiceAnimation, startMovementAnimation, movementDisplayPlane, stop };
}
