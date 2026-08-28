import { BOARD_SIZE, STAR_POINTS } from './constants.js';
import { formatPoint, pieceAt } from './state.js';
import { escapeHtml } from '../common/html.js';

export function createGobangRenderer({ model, actionLock, getElement }) {
    const boardEl = getElement('board');
    const turnEl = getElement('turn');
    const statusEl = getElement('status');
    const hintEl = getElement('hint');
    const resultEl = getElement('result');
    const playersEl = getElement('players');
    const logEl = getElement('log');

    function renderPlayers() {
        const state = model.state;
        playersEl.innerHTML = (state.players || []).map((player, index) => `<article class="gobang-player ${player.color} ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}"><span class="gobang-player-stone"></span><span><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${player.isCurrentTurn ? '正在行棋' : player.isOnline === false ? '已离线' : `座位 ${index + 1}`}</small></span></article>`).join('');
    }

    function renderBoard() {
        const state = model.state;
        const cells = [];
        for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) {
            const piece = pieceAt(model, x, y);
            const id = `${x},${y}`;
            const canPlace = !piece && state.status === 'playing' && state.myIsCurrentTurn;
            const star = STAR_POINTS.has(id) ? ' is-star' : '';
            const stone = piece ? `<span class="gobang-stone ${piece.color}" aria-label="${piece.color === 'black' ? '黑棋' : '白棋'}"></span>` : '';
            cells.push(`<button type="button" class="gobang-cell${star}${piece ? ' is-occupied' : ''}" data-x="${x}" data-y="${y}" role="gridcell" aria-label="${formatPoint(x, y)}${piece ? ' 已有棋子' : ''}" ${canPlace ? '' : 'disabled'}>${stone}</button>`);
        }
        boardEl.innerHTML = cells.join('');
        boardEl.classList.toggle('is-pending', actionLock.pending);
    }

    function cellAt(x, y) { return boardEl.querySelector(`.gobang-cell[data-x="${x}"][data-y="${y}"]`); }

    function clearHover() {
        if (!model.hover) return;
        const cell = cellAt(model.hover.x, model.hover.y);
        cell?.classList.remove('is-preview');
        cell?.querySelector('.gobang-stone.preview')?.remove();
        model.hover = null;
    }

    function setHover(next) {
        if (model.hover?.x === next?.x && model.hover?.y === next?.y) return;
        clearHover();
        if (!next || !model.state?.myIsCurrentTurn || actionLock.pending || pieceAt(model, next.x, next.y)) return;
        const cell = cellAt(next.x, next.y);
        if (!cell || cell.disabled) return;
        model.hover = next;
        cell.classList.add('is-preview');
        const preview = document.createElement('span');
        preview.className = `gobang-stone preview ${model.state.myColor}`;
        cell.appendChild(preview);
    }

    function renderLog() {
        logEl.innerHTML = (model.state.actionLog || []).slice().reverse().map((entry, index) => `<div class="gobang-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('');
    }

    function render() {
        const state = model.state;
        if (!state) return;
        const current = state.players?.find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        turnEl.innerHTML = ended
            ? `<i class="gobang-live-dot ended"></i>${escapeHtml(state.winner?.name || '棋局结束')}<small>${state.drawReason || '对局已结束'}</small>`
            : `<i class="gobang-live-dot"></i>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}<small>${state.turn === 'black' ? '黑方先行' : '白方回合'}</small>`;
        statusEl.textContent = ended ? (state.winner ? '已结束' : '和棋') : '对局中';
        hintEl.textContent = ended ? (state.winner ? `${escapeHtml(state.winner.name)} 获胜` : '棋盘已满，和棋') : state.myIsCurrentTurn ? '点击棋盘空位落子' : `等待 ${escapeHtml(state.currentTurnName || '对手')} 行棋`;
        resultEl.textContent = state.lastMove ? `${state.lastMove.color === 'black' ? '黑' : '白'}棋 · ${formatPoint(state.lastMove.x, state.lastMove.y)}` : '等待第一步';
        renderPlayers();
        renderBoard();
        renderLog();
    }

    return { render, renderBoard, cellAt, clearHover, setHover };
}
