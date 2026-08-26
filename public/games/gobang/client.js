const BOARD_SIZE = 15;
const STAR_POINTS = new Set(['3,3', '11,3', '7,7', '3,11', '11,11']);

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/games/gobang/style.css?v=${Date.now()}`;
    document.head.appendChild(link);

    let state = null;
    let hover = null;
    let movePending = false;
    mount.innerHTML = `<section class="gobang-game">
        <header class="gobang-header">
            <div class="gobang-brand"><span class="gobang-mark">五</span><div><small>CLASSIC BOARD GAME</small><h1>五子棋</h1></div></div>
            <div class="gobang-turn" data-role="turn">等待棋局状态</div>
            <div class="gobang-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
        </header>
        <main class="gobang-layout">
            <aside class="gobang-panel gobang-players"><div class="gobang-panel-title"><span>对局双方</span><small data-role="status">等待中</small></div><div data-role="players"></div><div class="gobang-key"><strong>本局设置</strong><span>15 × 15 棋盘</span><span>连成五子即胜</span><span>不设禁手，长连也算胜利</span></div></aside>
            <section class="gobang-stage"><div class="gobang-board-wrap"><div class="gobang-board" data-role="board" role="grid" aria-label="五子棋十五乘十五棋盘"></div></div><div class="gobang-hint" data-role="hint">等待棋局开始</div></section>
            <aside class="gobang-panel gobang-info"><div class="gobang-info-card"><span class="gobang-seal">棋</span><small>FIVE IN A ROW</small><h2>黑白之间</h2><p>轮流落子，在横、竖或斜线上连成五子。</p><button type="button" data-ui="rules">查看规则</button></div><div class="gobang-log-title">行棋记录</div><div class="gobang-log" data-role="log"></div></aside>
        </main>
        <footer class="gobang-footer"><span>黑方先行 · 15×15 标准棋盘</span><strong data-role="result">等待第一步</strong></footer>
        <div class="gobang-overlay is-hidden" data-role="rulesOverlay"><article class="gobang-rules"><button class="gobang-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>五子棋规则</h2><ol><li>黑方先行，双方轮流在棋盘交叉点落下一枚棋子。</li><li>任意横线、竖线或斜线连续五枚己方棋子即可获胜。</li><li>本局不设禁手，三三、四四和长连均不判负；长连也算五子连珠。</li><li>棋盘填满且没有胜者时判和棋。</li></ol></article></div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const boardEl = $('board');
    const turnEl = $('turn');
    const statusEl = $('status');
    const hintEl = $('hint');
    const resultEl = $('result');
    const playersEl = $('players');
    const logEl = $('log');
    const overlay = $('rulesOverlay');

    function pieceAt(x, y) { return state?.pieces?.find(piece => piece.x === x && piece.y === y) || null; }
    function render() {
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

    function renderPlayers() {
        playersEl.innerHTML = (state.players || []).map((player, index) => `<article class="gobang-player ${player.color} ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}"><span class="gobang-player-stone"></span><span><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${player.isCurrentTurn ? '正在行棋' : player.isOnline === false ? '已离线' : `座位 ${index + 1}`}</small></span></article>`).join('');
    }

    function renderBoard() {
        const cells = [];
        for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) {
            const piece = pieceAt(x, y);
            const id = `${x},${y}`;
            const canPlace = !piece && state.status === 'playing' && state.myIsCurrentTurn;
            const star = STAR_POINTS.has(id) ? ' is-star' : '';
            const stone = piece ? `<span class="gobang-stone ${piece.color}" aria-label="${piece.color === 'black' ? '黑棋' : '白棋'}"></span>` : '';
            cells.push(`<button type="button" class="gobang-cell${star}${piece ? ' is-occupied' : ''}" data-x="${x}" data-y="${y}" role="gridcell" aria-label="${formatPoint(x, y)}${piece ? ' 已有棋子' : ''}" ${canPlace ? '' : 'disabled'}>${stone}</button>`);
        }
        boardEl.innerHTML = cells.join('');
        boardEl.classList.toggle('is-pending', movePending);
    }

    function cellAt(x, y) {
        return boardEl.querySelector(`.gobang-cell[data-x="${x}"][data-y="${y}"]`);
    }

    function clearHover() {
        if (!hover) return;
        const cell = cellAt(hover.x, hover.y);
        cell?.classList.remove('is-preview');
        cell?.querySelector('.gobang-stone.preview')?.remove();
        hover = null;
    }

    function setHover(next) {
        if (hover?.x === next?.x && hover?.y === next?.y) return;
        clearHover();
        if (!next || !state?.myIsCurrentTurn || movePending || pieceAt(next.x, next.y)) return;
        const cell = cellAt(next.x, next.y);
        if (!cell || cell.disabled) return;
        hover = next;
        cell.classList.add('is-preview');
        const preview = document.createElement('span');
        preview.className = `gobang-stone preview ${state.myColor}`;
        cell.appendChild(preview);
    }

    function renderLog() { logEl.innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<div class="gobang-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join(''); }
    function formatPoint(x, y) { return `${String.fromCharCode(65 + Number(x))}${Number(y) + 1}`; }
    function handleMessage(message) {
        if (message.state) { state = message.state; movePending = false; clearHover(); render(); }
        if (message.type === 'error') { movePending = false; boardEl.classList.remove('is-pending'); addLog(message.message || '操作失败', 'error'); }
        else if (message.action?.message) addLog(message.action.message, 'info');
    }

    mount.addEventListener('mousemove', event => {
        const cell = event.target.closest('.gobang-cell');
        if (!cell || !state?.myIsCurrentTurn || movePending || cell.disabled || cell.classList.contains('is-occupied')) { clearHover(); return; }
        setHover({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
    });
    mount.addEventListener('mouseleave', clearHover);
    mount.addEventListener('click', event => {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'rules') overlay.classList.remove('is-hidden');
        if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden');
        if (ui === 'leave') leaveRoom?.();
        const cell = event.target.closest('.gobang-cell');
        if (!cell || !state || state.status === 'ended' || movePending || !state.myIsCurrentTurn || cell.disabled || pieceAt(Number(cell.dataset.x), Number(cell.dataset.y))) return;
        movePending = true;
        boardEl.classList.add('is-pending');
        clearHover();
        send({ type: 'gameAction', action: { kind: 'place', x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
    });

    return { gameType: 'gobang', handleMessage, destroy() { link.remove(); mount.innerHTML = ''; } };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
