import { isTarget, legalTargets, pieceAt } from './state.js';

export function createJungleActions({ mount, model, renderer, scene, actionLock, rulesModal, overlay, send, addLog, documentRef = globalThis.document }) {
    function handleClick(event) {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'rules') { rulesModal.setOpen(true); return; }
        if (ui === 'closeRules' || event.target === overlay) { rulesModal.setOpen(false); return; }
        const cell = event.target.closest('.jungle-cell');
        const state = model.state;
        if (!cell || !state || state.status === 'ended' || actionLock.pending) return;
        const x = Number(cell.dataset.x); const y = Number(cell.dataset.y); const piece = pieceAt(model, x, y);
        if (model.selected && isTarget(model, x, y)) {
            if (!actionLock.lock()) return;
            try {
                send({ type: 'gameAction', action: { kind: 'move', from: { x: model.selected.x, y: model.selected.y }, to: { x, y } } });
            } catch (error) {
                actionLock.unlock();
                addLog?.(error?.message || '操作发送失败', 'error');
            }
            scene.clearSelection();
        } else if (piece && piece.color === state.myColor && state.myIsCurrentTurn && legalTargets(model, piece).length) {
            model.selected = piece;
        } else {
            scene.clearSelection();
        }
        renderer.render();
    }

    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return {
        handleClick,
        handleKeydown,
        handleMessage(message) {
            if (message.state) {
                model.state = message.state;
                actionLock.unlock();
                scene.reconcileSelection((x, y) => pieceAt(model, x, y));
                renderer.render();
            }
            if (message.type === 'error') { actionLock.unlock(); renderer.render(); addLog(message.message || '操作失败', 'error'); }
            else if (message.action?.message) addLog(message.action.message, 'info');
        },
    };
}
