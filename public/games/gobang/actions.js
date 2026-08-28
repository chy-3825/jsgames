import { pieceAt } from './state.js';

export function createGobangActions({ mount, model, renderer, actionLock, rulesModal, overlay, send, addLog }) {
    function handleMousemove(event) {
        const cell = event.target.closest('.gobang-cell');
        if (!cell || !model.state?.myIsCurrentTurn || actionLock.pending || cell.disabled || cell.classList.contains('is-occupied')) {
            renderer.clearHover();
            return;
        }
        renderer.setHover({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
    }

    function handleClick(event) {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'rules') { rulesModal.setOpen(true); return; }
        if (ui === 'closeRules' || event.target === overlay) { rulesModal.setOpen(false); return; }
        const cell = event.target.closest('.gobang-cell');
        const state = model.state;
        if (!cell || !state || state.status === 'ended' || actionLock.pending || !state.myIsCurrentTurn || cell.disabled || pieceAt(model, Number(cell.dataset.x), Number(cell.dataset.y))) return;
        if (!actionLock.lock()) return;
        renderer.renderBoard();
        renderer.clearHover();
        send({ type: 'gameAction', action: { kind: 'place', x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
    }

    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return {
        handleMousemove,
        handleMouseleave: renderer.clearHover,
        handleClick,
        handleKeydown,
        handleMessage(message) {
            if (message.state) {
                model.state = message.state;
                actionLock.unlock();
                renderer.clearHover();
                renderer.render();
            }
            if (message.type === 'error') {
                actionLock.unlock();
                renderer.renderBoard();
                addLog?.(message.message || '操作失败', 'error');
            } else if (message.action?.message) addLog?.(message.action.message, 'info');
        },
    };
}
