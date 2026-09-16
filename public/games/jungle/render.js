import { DENS, PIECES, TRAPS, WATER } from './constants.js';
import { formatSquare, isTarget, legalTargets, pieceAt, pieceName } from './state.js';
import { escapeHtml } from '../common/html.js';

export function createJungleRenderer({ model, actionLock, getElement }) {
    const boardEl = getElement('board');
    const playersEl = getElement('players');
    const turnEl = getElement('turn');
    const statusEl = getElement('status');
    const hintEl = getElement('hint');
    const logEl = getElement('log');
    const resultEl = getElement('result');

    function renderPlayers() {
        const state = model.state;
        playersEl.innerHTML = (state.players || []).map((player, index) => `<article class="jungle-player ${player.color} ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}">
            <span class="jungle-player-stamp">${player.color === 'red' ? '红' : '蓝'}</span><span><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${player.isCurrentTurn ? '正在行棋' : player.isOnline === false ? '已离线' : `座位 ${index + 1}`}</small></span>
        </article>`).join('');
    }

    function renderBoard() {
        const state = model.state;
        const cells = [];
        for (let y = 0; y < 9; y += 1) for (let x = 0; x < 7; x += 1) {
            const id = `${x},${y}`;
            const piece = pieceAt(model, x, y);
            const selectedCell = model.selected?.x === x && model.selected?.y === y;
            const target = isTarget(model, x, y);
            const terrain = DENS.has(id) ? `den ${DENS.get(id)}` : TRAPS.has(id) ? `trap ${TRAPS.get(id)}` : WATER.has(id) ? 'water' : 'land';
            const pieceHtml = piece ? `<button class="jungle-piece ${piece.color} ${model.selected?.id === piece.id ? 'is-selected' : ''} ${piece.color === state.myColor && state.myIsCurrentTurn && legalTargets(model, piece).length ? 'is-available' : ''}" type="button" data-piece-id="${escapeHtml(piece.id)}" title="${pieceName(piece.type, PIECES)}，等级 ${PIECES[piece.type]?.rank || ''}"><span>${escapeHtml(PIECES[piece.type]?.name || '?')}</span><small>${PIECES[piece.type]?.rank || ''}</small></button>` : '';
            cells.push(`<div class="jungle-cell ${terrain} ${selectedCell ? 'is-selected' : ''} ${target ? 'is-target' : ''}" role="gridcell" data-x="${x}" data-y="${y}" aria-label="${formatSquare({ x, y })}">${pieceHtml}</div>`);
        }
        boardEl.innerHTML = cells.join('');
    }

    function renderLog() { logEl.innerHTML = (model.state.actionLog || []).slice().reverse().map((entry, index) => `<div class="jungle-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join(''); }

    function render() {
        const state = model.state;
        if (!state) return;
        const current = state.players?.find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        turnEl.innerHTML = ended
            ? `<i class="jungle-live-dot ended"></i>${escapeHtml(state.winner?.name || '棋局结束')}<small>对局已结束</small>`
            : `<i class="jungle-live-dot"></i>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}<small>${state.turn === 'red' ? '红方先行' : '蓝方回合'}</small>`;
        statusEl.textContent = ended ? (state.winner ? '已结束' : '无棋可走') : '对局中';
        hintEl.textContent = ended ? `${escapeHtml(state.winner?.name || '对手')} 获胜` : state.myIsCurrentTurn ? (model.selected ? '选择金色高亮格完成行棋' : '选择一只自己的兽子') : `等待 ${escapeHtml(state.currentTurnName || '对手')} 行棋`;
        resultEl.textContent = state.lastMove ? `${pieceName(state.lastMove.piece?.type, PIECES)} ${formatSquare(state.lastMove.to)}` : '等待第一步';
        renderPlayers();
        renderBoard();
        renderLog();
        boardEl.classList.toggle('is-pending', actionLock.pending);
    }

    return { render, renderBoard };
}
