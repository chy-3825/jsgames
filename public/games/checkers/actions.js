import { interactionLocked, isLegalTarget } from './state.js';

export function createCheckersActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog, windowRef = globalThis.window || globalThis }) {
    function releaseRequest() {
        actionLock.unlock();
        if (model.requestTimer) (windowRef.clearTimeout || clearTimeout)(model.requestTimer);
        model.requestTimer = null;
    }

    function submitAction(action) {
        if (interactionLocked(model, actionLock) || !actionLock.lock()) return;
        renderer.syncInteractionState();
        try {
            send({ type: 'gameAction', action });
        } catch (error) {
            releaseRequest();
            renderer.syncInteractionState();
            addLog(error?.message || '操作发送失败', 'error');
            return;
        }
        model.requestTimer = (windowRef.setTimeout || setTimeout)(() => {
            if (model.destroyed || !actionLock.pending) return;
            releaseRequest();
            renderer.syncInteractionState();
            addLog('服务器响应超时，已恢复棋盘操作，请确认连接状态后重试', 'error');
        }, 5000);
    }

    function handleClick(event) {
        const uiTarget = event.target.closest('[data-ui]');
        const ui = uiTarget?.dataset.ui;
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === overlay) rulesModal.setOpen(false);
        if (ui === 'endMove' && model.state?.availableActions?.canEndMove && !interactionLocked(model, actionLock)) {
            submitAction({ kind: 'endMove' });
            return;
        }
        const hole = event.target.closest('.checkers-hole');
        const state = model.state;
        if (!hole || !state || interactionLocked(model, actionLock) || !state.myIsCurrentTurn) return;
        if (hole.dataset.pieceId && state.legalMoves?.select?.includes(hole.dataset.pieceId)) {
            submitAction({ kind: 'selectPiece', pieceId: hole.dataset.pieceId });
            return;
        }
        const x = Number(hole.dataset.x); const y = Number(hole.dataset.y);
        if (state.selectedPiece && isLegalTarget(model, x, y)) submitAction({ kind: 'movePiece', to: { x, y } });
    }

    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return {
        handleClick,
        handleKeydown,
        releaseRequest,
        handleMessage(message) {
            releaseRequest();
            if (message.state) { model.state = message.state; renderer.render(); }
            else if (model.state) renderer.render();
            if (message.type === 'error') addLog(message.message || '操作失败', 'error');
            else if (message.action?.message) addLog(message.action.message, 'info');
        },
    };
}
