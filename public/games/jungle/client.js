const PIECES = {
    r: { name: '鼠', rank: 1, title: '老鼠' },
    c: { name: '猫', rank: 2, title: '猫' },
    d: { name: '狗', rank: 3, title: '狗' },
    w: { name: '狼', rank: 4, title: '狼' },
    l: { name: '豹', rank: 5, title: '豹' },
    t: { name: '虎', rank: 6, title: '虎' },
    j: { name: '狮', rank: 7, title: '狮子' },
    e: { name: '象', rank: 8, title: '大象' },
};

const WATER = new Set(['1,3', '2,3', '4,3', '5,3', '1,4', '2,4', '4,4', '5,4', '1,5', '2,5', '4,5', '5,5']);
const DENS = new Map([['3,0', 'blue'], ['3,8', 'red']]);
const TRAPS = new Map([['2,0', 'blue'], ['4,0', 'blue'], ['3,1', 'blue'], ['2,8', 'red'], ['4,8', 'red'], ['3,7', 'red']]);

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/games/jungle/style.css?v=${Date.now()}`;
    document.head.appendChild(link);

    let state = null;
    let selected = null;

    mount.innerHTML = `<section class="jungle-game">
        <header class="jungle-header">
            <div class="jungle-brand"><span class="jungle-brand-mark">兽</span><div><small>TRADITIONAL BOARD</small><h1>斗兽棋</h1></div></div>
            <div class="jungle-turn" data-role="turn">等待棋局状态</div>
            <div class="jungle-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
        </header>
        <main class="jungle-layout">
            <aside class="jungle-panel jungle-players"><div class="jungle-panel-title"><span>双方棋手</span><small data-role="status">等待中</small></div><div data-role="players"></div><div class="jungle-rank-key"><strong>兽子等级</strong><span>象 8 · 狮 7 · 虎 6 · 豹 5</span><span>狼 4 · 狗 3 · 猫 2 · 鼠 1</span></div></aside>
            <section class="jungle-stage"><div class="jungle-board-wrap"><div class="jungle-board" data-role="board" aria-label="斗兽棋七乘九棋盘"></div></div><div class="jungle-hint" data-role="hint">点击自己的兽子，再点击高亮位置</div></section>
            <aside class="jungle-panel jungle-info"><div class="jungle-info-card"><span class="jungle-info-seal">兽</span><small>WATER · TRAP · DEN</small><h2>山林棋局</h2><p>八种猛兽在河流与陷阱之间争夺对方兽穴。</p><button type="button" data-ui="rules">查看完整规则</button></div><div class="jungle-log-title">行棋记录</div><div class="jungle-log" data-role="log"></div></aside>
        </main>
        <footer class="jungle-footer"><span>标准 7×9 棋盘 · 红方先行</span><strong data-role="result"></strong></footer>
        <div class="jungle-overlay is-hidden" data-role="rulesOverlay"><article class="jungle-rules"><button class="jungle-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>斗兽棋规则</h2><ol><li>棋盘为 7×9 交叉格，红方先行；占领对方兽穴或令对方无合法着法即可获胜。</li><li>象、狮、虎、豹、狼、狗、猫、鼠按 8 至 1 排名；鼠可以吃象，其他兽子不能反吃高等级兽子。</li><li>只有鼠可以进入河流；狮和虎可以横竖跳过整段河流，河中的鼠会挡住跳跃。</li><li>进入对手陷阱的兽子等级视为 0；自己的兽子不能进入己方兽穴。</li></ol></article></div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const boardEl = $('board');
    const playersEl = $('players');
    const turnEl = $('turn');
    const statusEl = $('status');
    const hintEl = $('hint');
    const logEl = $('log');
    const resultEl = $('result');
    const overlay = $('rulesOverlay');

    function pieceAt(x, y) { return state?.pieces?.find(piece => piece.x === x && piece.y === y) || null; }
    function legalTargets(piece) { return piece?.id ? state?.legalMoves?.[piece.id] || [] : []; }
    function isTarget(x, y) { return Boolean(selected && legalTargets(selected).some(move => move.x === x && move.y === y)); }

    function render() {
        if (!state) return;
        const current = state.players?.find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        turnEl.innerHTML = ended
            ? `<i class="jungle-live-dot ended"></i>${escapeHtml(state.winner?.name || '棋局结束')}<small>对局已结束</small>`
            : `<i class="jungle-live-dot"></i>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}<small>${state.turn === 'red' ? '红方先行' : '蓝方回合'}</small>`;
        statusEl.textContent = ended ? (state.winner ? '已结束' : '无棋可走') : '对局中';
        hintEl.textContent = ended ? `${escapeHtml(state.winner?.name || '对手')} 获胜` : state.myIsCurrentTurn ? (selected ? '选择金色高亮格完成行棋' : '选择一只自己的兽子') : `等待 ${escapeHtml(state.currentTurnName || '对手')} 行棋`;
        resultEl.textContent = state.lastMove ? `${pieceName(state.lastMove.piece?.type)} ${formatSquare(state.lastMove.to)}` : '等待第一步';
        renderPlayers();
        renderBoard();
        renderLog();
    }

    function renderPlayers() {
        playersEl.innerHTML = (state.players || []).map((player, index) => `<article class="jungle-player ${player.color} ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}">
            <span class="jungle-player-stamp">${player.color === 'red' ? '红' : '蓝'}</span><span class="jungle-player-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${player.isCurrentTurn ? '正在行棋' : player.isOnline === false ? '已离线' : `座位 ${index + 1}`}</small></span>
        </article>`).join('');
    }

    function renderBoard() {
        const cells = [];
        for (let y = 0; y < 9; y += 1) for (let x = 0; x < 7; x += 1) {
            const id = `${x},${y}`;
            const piece = pieceAt(x, y);
            const selectedCell = selected?.x === x && selected?.y === y;
            const target = isTarget(x, y);
            const terrain = DENS.has(id) ? `den ${DENS.get(id)}` : TRAPS.has(id) ? `trap ${TRAPS.get(id)}` : WATER.has(id) ? 'water' : 'land';
            const pieceHtml = piece ? `<button class="jungle-piece ${piece.color} ${selected?.id === piece.id ? 'is-selected' : ''} ${piece.color === state.myColor && state.myIsCurrentTurn && legalTargets(piece).length ? 'is-available' : ''}" type="button" data-piece-id="${escapeHtml(piece.id)}" title="${pieceName(piece.type)}，等级 ${PIECES[piece.type]?.rank || ''}"><span>${escapeHtml(PIECES[piece.type]?.name || '?')}</span><small>${PIECES[piece.type]?.rank || ''}</small></button>` : '';
            cells.push(`<div class="jungle-cell ${terrain} ${selectedCell ? 'is-selected' : ''} ${target ? 'is-target' : ''}" role="gridcell" data-x="${x}" data-y="${y}" aria-label="${formatSquare({ x, y })}">${pieceHtml}</div>`);
        }
        boardEl.innerHTML = cells.join('');
    }

    function renderLog() {
        logEl.innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<div class="jungle-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('');
    }

    function pieceName(type) { return PIECES[type]?.title || '兽子'; }
    function formatSquare(square) { return square ? `${square.x + 1}·${square.y + 1}` : ''; }

    function handleMessage(message) {
        if (message.state) { state = message.state; if (selected && !pieceAt(selected.x, selected.y)) selected = null; render(); }
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else if (message.action?.message) addLog(message.action.message, 'info');
    }

    mount.addEventListener('click', event => {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'rules') overlay.classList.remove('is-hidden');
        if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden');
        if (ui === 'leave') leaveRoom?.();
        const cell = event.target.closest('.jungle-cell');
        if (!cell || !state || state.status === 'ended') return;
        const x = Number(cell.dataset.x); const y = Number(cell.dataset.y); const piece = pieceAt(x, y);
        if (selected && isTarget(x, y)) {
            send({ type: 'gameAction', action: { kind: 'move', from: { x: selected.x, y: selected.y }, to: { x, y } } });
            selected = null;
        } else if (piece && piece.color === state.myColor && state.myIsCurrentTurn && legalTargets(piece).length) {
            selected = piece;
        } else {
            selected = null;
        }
        render();
    });

    return { gameType: 'jungle', handleMessage, destroy() { link.remove(); mount.innerHTML = ''; } };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
