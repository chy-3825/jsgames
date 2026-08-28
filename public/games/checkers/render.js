import { BOARD_MAX_X, BOARD_MAX_Y, BOARD_SPAN, CELLS, boardRotationForCorner, key, pointStyle } from './constants.js';
import { boardPositionMap, effectivePieces, interactionLocked } from './state.js';
import { escapeHtml } from '../common/html.js';

export function createCheckersRenderer({ model, actionLock, scene, getElement, windowRef = globalThis.window || globalThis }) {
    const boardEl = getElement('board');
    const holesEl = getElement('holes');
    const turnEl = getElement('turn');
    const statusEl = getElement('status');
    const hintEl = getElement('hint');
    const resultEl = getElement('result');
    const playersEl = getElement('players');
    const logEl = getElement('log');
    const endMoveButton = getElement('endMove');

    function renderPlayers() {
        const state = model.state;
        playersEl.innerHTML = (state.players || []).map((player, index) => '<article class="checkers-player ' + player.color + (player.isCurrentTurn ? ' is-current' : '') + (player.id === state.myId ? ' is-me' : '') + '"><span class="checkers-player-stone"></span><span><strong>' + escapeHtml(player.name) + (player.id === state.myId ? ' · 我' : '') + '</strong><small>' + (player.isCurrentTurn ? '正在行棋' : (player.pieceCount || 0) + '/10 枚在场') + '</small></span><i>' + (index + 1) + '</i></article>').join('');
    }

    function labelForCell(cell, piece, canSelect, isSelected, isStep, isJump) {
        const position = '棋位 ' + (Number(cell.x) + 1) + '·' + (Number(cell.y) + 1);
        if (piece) {
            const owner = (model.state.players || []).find(player => player.id === piece.playerId);
            if (isSelected) return (owner?.name || '玩家') + '的棋子，' + position + '，已选中；再次点击取消';
            return (owner?.name || '玩家') + '的棋子，' + position + (canSelect ? '，可选择' : '');
        }
        if (isJump) return position + '，跳跃目标';
        if (isStep) return position + '，相邻移动目标';
        return position + '，空位';
    }

    function syncInteractionState() {
        const state = model.state;
        if (!state || !holesEl) return;
        const locked = interactionLocked(model, actionLock);
        holesEl.querySelectorAll('.checkers-hole').forEach(hole => {
            const interactive = hole.classList.contains('is-selectable') || hole.classList.contains('is-step') || hole.classList.contains('is-jump');
            hole.disabled = locked || !state.myIsCurrentTurn || !interactive;
        });
        endMoveButton.disabled = locked;
        boardEl.classList.toggle('is-pending', locked);
        boardEl.setAttribute('aria-busy', locked ? 'true' : 'false');
    }

    function findStone(pieceId) {
        const hole = Array.from(holesEl.querySelectorAll('[data-piece-id]')).find(item => item.dataset.pieceId === pieceId);
        return hole && hole.querySelector('.checkers-stone');
    }

    function renderBoard() {
        const state = model.state;
        const pieces = effectivePieces(model);
        const nextPositions = boardPositionMap(pieces);
        const movements = [];
        if (model.displayedPositions.size) for (const piece of pieces) {
            const previous = model.displayedPositions.get(piece.id);
            if (previous && (previous.x !== piece.x || previous.y !== piece.y)) movements.push({ pieceId: piece.id, from: previous, to: { x: piece.x, y: piece.y } });
        }
        model.displayedPositions = nextPositions;
        const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        model.animationPending = movements.length > 0 && !reducedMotion;
        const byPosition = new Map(pieces.map(piece => [key(piece.x, piece.y), piece]));
        const selectable = new Set(state.legalMoves?.select || []);
        const steps = new Set((state.legalMoves?.step || []).map(target => key(target.x, target.y)));
        const jumps = new Set((state.legalMoves?.jump || []).map(target => key(target.x, target.y)));
        const lastFrom = state.lastMove?.from ? key(state.lastMove.from.x, state.lastMove.from.y) : '';
        const lastTo = state.lastMove?.to ? key(state.lastMove.to.x, state.lastMove.to.y) : '';
        holesEl.innerHTML = CELLS.map(cell => {
            const id = key(cell.x, cell.y);
            const piece = byPosition.get(id);
            const isSelected = piece && state.selectedPiece?.pieceId === piece.id;
            const canSelect = piece && selectable.has(piece.id);
            const isStep = steps.has(id);
            const isJump = jumps.has(id);
            const clickable = canSelect || (!piece && (isStep || isJump));
            const classes = ['checkers-hole'];
            if (piece) classes.push('has-piece', 'piece-' + piece.color);
            if (isSelected) classes.push('is-selected');
            if (canSelect) classes.push('is-selectable');
            if (isStep) classes.push('is-step');
            if (isJump) classes.push('is-jump');
            if (id === lastFrom) classes.push('is-last-from');
            if (id === lastTo) classes.push('is-last-to');
            const stone = piece ? '<span class="checkers-stone ' + piece.color + '" aria-hidden="true"></span>' : '';
            const ariaSelected = isSelected ? ' aria-selected="true"' : '';
            const ariaLabel = labelForCell(cell, piece, canSelect, isSelected, isStep, isJump);
            return '<button class="' + classes.join(' ') + '" style="' + pointStyle(cell) + '" data-x="' + cell.x + '" data-y="' + cell.y + '"' + (piece ? ' data-piece-id="' + escapeHtml(piece.id) + '"' : '') + ' type="button" role="gridcell" aria-label="' + escapeHtml(ariaLabel) + '"' + ariaSelected + (clickable && !interactionLocked(model, actionLock) && state.myIsCurrentTurn ? '' : ' disabled') + '>' + stone + '</button>';
        }).join('');
        syncInteractionState();
        if (model.animationPending) scene.animateMovements(movements, findStone);
    }

    function renderLog() { logEl.innerHTML = (model.state.actionLog || []).slice().reverse().map((entry, index) => '<div class="checkers-log-entry ' + (index === 0 ? 'is-latest' : '') + '"><i></i><span>' + escapeHtml(entry) + '</span></div>').join(''); }

    function render() {
        const state = model.state;
        if (!state) return;
        const current = (state.players || []).find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        const pending = state.pendingMove;
        const selected = state.selectedPiece;
        const turnDetail = pending?.jumpCount > 0 ? '连续跳跃 ' + pending.jumpCount + ' 次' : selected ? '已选中棋子，可选择落点' : '选择棋子开始移动';
        turnEl.innerHTML = ended
            ? '<i class="checkers-live-dot ended"></i>' + escapeHtml(state.winner?.name || '棋局结束') + '<small>' + (state.winner ? '全部棋子进入目标角' : '对局已结束') + '</small>'
            : '<i class="checkers-live-dot"></i>' + (state.myIsCurrentTurn ? '你的回合' : escapeHtml(current?.name || '对手') + '的回合') + '<small>' + turnDetail + '</small>';
        statusEl.textContent = ended ? '已结束' : '对局中';
        hintEl.textContent = ended ? (state.winner ? escapeHtml(state.winner.name) + ' 获胜' : '棋局结束') : selected ? (state.availableActions?.canEndMove ? '可继续跳跃，也可以结束这次移动' : '选择高亮落点；点击其他棋子可换选，再点当前棋子可取消') : state.myIsCurrentTurn ? '选择自己的棋子' : '等待 ' + escapeHtml(state.currentTurnName || '对手') + ' 行棋';
        resultEl.textContent = state.lastMove?.to ? '最后移动 · 棋位 ' + (Number(state.lastMove.to.x) + 1) + '·' + (Number(state.lastMove.to.y) + 1) : '等待第一步';
        endMoveButton.hidden = !(state.availableActions?.canEndMove);
        endMoveButton.disabled = interactionLocked(model, actionLock);
        renderPlayers();
        const me = (state.players || []).find(player => player.id === state.myId);
        boardEl.style.setProperty('--checkers-board-rotation', boardRotationForCorner(me?.corner) + 'deg');
        renderBoard();
        renderLog();
    }

    return { render, renderBoard, syncInteractionState, findStone };
}
