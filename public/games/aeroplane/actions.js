import { COLOR_NAMES } from './constants.js';
import { canMove } from './state.js';

export function createAeroplaneActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog }) {
    const rollButton = mount.querySelector('[data-ui="roll"]');
    function handleClick(event) {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'roll' && !rollButton.disabled) { model.isRollPending = true; scene.beginDiceAnimation(); send({ type: 'gameAction', action: { kind: 'rollDice' } }); }
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === overlay) rulesModal.setOpen(false);
        const confirmTarget = event.target.closest('[data-move-confirm]');
        if (confirmTarget) {
            const plane = model.state?.planes?.find(item => item.id === confirmTarget.dataset.moveConfirm);
            if (canMove(model, plane, actionLock)) {
                if (!actionLock.lock()) return;
                model.selectedPlaneId = null;
                renderer.render();
                try { send({ type: 'gameAction', action: { kind: 'movePlane', planeId: plane.id } }); } catch (error) { actionLock.unlock(); addLog?.(error?.message || '操作发送失败', 'error'); renderer.render(); }
            }
            return;
        }
        const planeButton = event.target.closest('[data-plane-id]');
        if (planeButton) { const plane = model.state?.planes?.find(item => item.id === planeButton.dataset.planeId); if (canMove(model, plane, actionLock)) { model.selectedPlaneId = model.selectedPlaneId === plane.id ? null : plane.id; renderer.render(); } }
    }
    function handleKeydown(event) { if (rulesModal.trapFocus(event)) return; if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false); }
    function handleMessage(message) {
        if (message.type === 'error' && model.isRollPending) scene.cancelDiceAnimation();
        if (message.type === 'error') actionLock.unlock();
        if (message.state) {
            const previous = model.state; model.state = message.state;
            const rollAction = model.state.lastAction?.kind === 'rollDice' ? model.state.lastAction : null; const rollValue = Number(rollAction?.dice) || 0; const rollKey = rollValue ? String(rollAction.rollId || `${rollAction.playerId || ''}:${rollValue}:${model.state.actionLog?.join('|') || ''}`) : '';
            if (rollValue && model.isRollPending && rollAction.playerId === model.state.myId && model.isDiceAnimating) { model.isRollPending = false; model.latestRollKey = rollKey; model.diceAnimationFinalValue = rollValue; } else if (rollValue) scene.beginDiceAnimation(rollValue, rollKey);
            const move = model.state.lastMove; const moveKey = move ? `${move.planeId}:${move.from?.progress}:${move.to?.progress}` : '';
            if (moveKey && moveKey !== model.latestMoveKey) { actionLock.unlock(); const previousPlane = previous?.planes?.find(plane => plane.id === move.planeId); const finalPlane = model.state.planes?.find(plane => plane.id === move.planeId); model.animatedPlaneId = move.planeId; model.latestMoveKey = moveKey; scene.startMovementAnimation(previousPlane, move, finalPlane); } else if (!model.isMoveAnimating) model.animatedPlaneId = null;
            renderer.render();
        }
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else if (message.action?.message) addLog(message.action.message, 'info');
    }
    return { handleClick, handleKeydown, handleMessage };
}
