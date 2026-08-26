const BOARD_MAX_X = 24;
const BOARD_MAX_Y = 16;
const BOARD_INSET = 7;
const BOARD_SPAN = 100 - BOARD_INSET * 2;
const ROW_COUNTS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];

function key(x, y) { return String(x) + ',' + String(y); }

function createCells() {
    const cells = [];
    for (let y = 0; y < ROW_COUNTS.length; y += 1) {
        const count = ROW_COUNTS[y];
        const start = 13 - count;
        for (let index = 0; index < count; index += 1) cells.push({ x: start + index * 2, y });
    }
    return cells;
}

const CELLS = createCells();
const CELL_KEYS = new Set(CELLS.map(cell => key(cell.x, cell.y)));
function inside(x, y) { return CELL_KEYS.has(key(x, y)); }
function pointStyle(point) {
    return 'left:' + (BOARD_INSET + point.x * BOARD_SPAN / BOARD_MAX_X) + '%;top:' + (BOARD_INSET + point.y * BOARD_SPAN / BOARD_MAX_Y) + '%';
}
export function boardRotationForCorner(corner) {
    return Number.isInteger(corner) && corner >= 0 && corner <= 5 ? 180 - corner * 60 : 0;
}

function createLines() {
    const lines = [];
    for (const cell of CELLS) for (const direction of [[2, 0], [1, 1], [1, -1]]) {
        const other = { x: cell.x + direction[0], y: cell.y + direction[1] };
        if (inside(other.x, other.y)) lines.push('<line x1="' + cell.x + '" y1="' + cell.y + '" x2="' + other.x + '" y2="' + other.y + '"></line>');
    }
    return lines.join('');
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/checkers/style.css?v=' + Date.now();
    document.head.appendChild(style);

    let state = null;
    let requestPending = false;
    let requestTimer = null;
    let animationPending = false;
    let animationSequence = 0;
    let displayedPositions = new Map();
    let destroyed = false;
    mount.innerHTML = '<section class="checkers-game">' +
        '<header class="checkers-header"><div class="checkers-brand"><span class="checkers-mark">跳</span><div><small>CLASSIC HEXAGON BOARD</small><h1>跳棋</h1></div></div><div class="checkers-turn" data-role="turn" aria-live="polite">等待棋局状态</div><div class="checkers-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div></header>' +
        '<main class="checkers-layout"><aside class="checkers-panel checkers-players"><div class="checkers-panel-title"><span>对局玩家</span><small data-role="status">等待中</small></div><div data-role="players"></div><div class="checkers-key"><strong>本局设置</strong><span>121 个棋位 · 2–6 人</span><span>每方 10 枚棋子</span><span>可连续跳跃，跳过任意颜色</span></div></aside>' +
        '<section class="checkers-stage"><div class="checkers-board-wrap"><div class="checkers-board" data-role="board" role="grid" aria-label="六角星跳棋棋盘"><svg class="checkers-lines" viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true">' + createLines() + '</svg><div class="checkers-holes" data-role="holes"></div></div></div><div class="checkers-hint" data-role="hint" aria-live="polite">等待棋局开始</div><button class="checkers-end-move" data-ui="endMove" type="button" hidden>结束连续跳跃</button></section>' +
        '<aside class="checkers-panel checkers-info"><div class="checkers-info-card"><span class="checkers-seal">棋</span><small>CHINESE CHECKERS</small><h2>六角星上的远征</h2><p>把自己的十枚棋子全部送进对角目标角，先完成者获胜。</p><button type="button" data-ui="rules">查看规则</button></div><div class="checkers-log-title">行棋记录</div><div class="checkers-log" data-role="log"></div></aside></main>' +
        '<footer class="checkers-footer"><span>相邻移动 · 连续跳跃 · 对角目标角</span><strong data-role="result">等待第一步</strong></footer>' +
        '<div class="checkers-overlay is-hidden" data-role="rulesOverlay"><article class="checkers-rules"><button class="checkers-close" type="button" data-ui="closeRules">×</button><small>HOW TO PLAY</small><h2>跳棋规则</h2><ol><li>棋盘有六个角，每方十枚棋子，目标是占满自己的对角目标角。</li><li>轮到你时，可将一枚棋子走到相邻空位。</li><li>也可以跳过相邻的任意颜色棋子，落到后方空位；一次回合可连续改变方向跳跃。</li><li>连续跳跃中可以随时结束移动，先把全部棋子送入目标角的一方获胜。</li></ol></article></div></section>';

    const $ = role => mount.querySelector('[data-role="' + role + '"]');
    const boardEl = $('board');
    const holesEl = $('holes');
    const turnEl = $('turn');
    const statusEl = $('status');
    const hintEl = $('hint');
    const resultEl = $('result');
    const playersEl = $('players');
    const logEl = $('log');
    const overlay = $('rulesOverlay');
    const endMoveButton = mount.querySelector('[data-ui="endMove"]');

    function effectivePieces() {
        const pieces = (state && state.pieces || []).map(piece => Object.assign({}, piece));
        const pending = state && state.pendingMove;
        if (!pending) return pieces;
        const moving = pieces.find(piece => piece.id === pending.pieceId);
        if (moving) { moving.x = pending.current.x; moving.y = pending.current.y; }
        return pieces;
    }

    function isLegalTarget(x, y) {
        if (!state || !state.selectedPiece) return false;
        return (state.legalMoves.step || []).concat(state.legalMoves.jump || []).some(target => target.x === x && target.y === y);
    }

    function interactionLocked() { return requestPending || animationPending; }

    function releaseRequest() {
        requestPending = false;
        if (requestTimer) clearTimeout(requestTimer);
        requestTimer = null;
    }

    function submitAction(action) {
        if (interactionLocked()) return;
        requestPending = true;
        syncInteractionState();
        try {
            send({ type: 'gameAction', action });
        } catch (error) {
            releaseRequest();
            syncInteractionState();
            addLog(error && error.message || '操作发送失败', 'error');
            return;
        }
        requestTimer = setTimeout(() => {
            if (destroyed || !requestPending) return;
            releaseRequest();
            syncInteractionState();
            addLog('服务器响应超时，已恢复棋盘操作，请确认连接状态后重试', 'error');
        }, 5000);
    }

    function render() {
        if (!state) return;
        const current = (state.players || []).find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        const pending = state.pendingMove;
        const selected = state.selectedPiece;
        const turnDetail = pending && pending.jumpCount > 0
            ? '连续跳跃 ' + pending.jumpCount + ' 次'
            : selected ? '已选中棋子，可选择落点' : '选择棋子开始移动';
        turnEl.innerHTML = ended
            ? '<i class="checkers-live-dot ended"></i>' + escapeHtml(state.winner && state.winner.name || '棋局结束') + '<small>' + (state.winner ? '全部棋子进入目标角' : '对局已结束') + '</small>'
            : '<i class="checkers-live-dot"></i>' + (state.myIsCurrentTurn ? '你的回合' : escapeHtml(current && current.name || '对手') + '的回合') + '<small>' + turnDetail + '</small>';
        statusEl.textContent = ended ? '已结束' : '对局中';
        hintEl.textContent = ended ? (state.winner ? escapeHtml(state.winner.name) + ' 获胜' : '棋局结束') : selected ? (state.availableActions && state.availableActions.canEndMove ? '可继续跳跃，也可以结束这次移动' : '选择高亮落点；点击其他棋子可换选，再点当前棋子可取消') : state.myIsCurrentTurn ? '选择自己的棋子' : '等待 ' + escapeHtml(state.currentTurnName || '对手') + ' 行棋';
        resultEl.textContent = state.lastMove && state.lastMove.to ? '最后移动 · ' + formatPoint(state.lastMove.to.x, state.lastMove.to.y) : '等待第一步';
        endMoveButton.hidden = !(state.availableActions && state.availableActions.canEndMove);
        endMoveButton.disabled = interactionLocked();
        renderPlayers();
        const me = (state.players || []).find(player => player.id === state.myId);
        boardEl.style.setProperty('--checkers-board-rotation', boardRotationForCorner(me?.corner) + 'deg');
        renderBoard();
        renderLog();
    }

    function renderPlayers() {
        playersEl.innerHTML = (state.players || []).map((player, index) => '<article class="checkers-player ' + player.color + (player.isCurrentTurn ? ' is-current' : '') + (player.id === state.myId ? ' is-me' : '') + '"><span class="checkers-player-stone"></span><span><strong>' + escapeHtml(player.name) + (player.id === state.myId ? ' · 我' : '') + '</strong><small>' + (player.isCurrentTurn ? '正在行棋' : (player.pieceCount || 0) + '/10 枚在场') + '</small></span><i>' + (index + 1) + '</i></article>').join('');
    }

    function boardPositionMap(pieces) {
        return new Map(pieces.map(piece => [piece.id, { x: piece.x, y: piece.y }]));
    }

    function labelForCell(cell, piece, canSelect, isSelected, isStep, isJump) {
        const position = formatPoint(cell.x, cell.y);
        if (piece) {
            const owner = (state.players || []).find(player => player.id === piece.playerId);
            if (isSelected) return (owner && owner.name || '玩家') + '的棋子，' + position + '，已选中；再次点击取消';
            return (owner && owner.name || '玩家') + '的棋子，' + position + (canSelect ? '，可选择' : '');
        }
        if (isJump) return position + '，跳跃目标';
        if (isStep) return position + '，相邻移动目标';
        return position + '，空位';
    }

    function renderBoard() {
        const pieces = effectivePieces();
        const nextPositions = boardPositionMap(pieces);
        const movements = [];
        if (displayedPositions.size) {
            for (const piece of pieces) {
                const previous = displayedPositions.get(piece.id);
                if (previous && (previous.x !== piece.x || previous.y !== piece.y)) {
                    movements.push({ pieceId: piece.id, from: previous, to: { x: piece.x, y: piece.y } });
                }
            }
        }
        displayedPositions = nextPositions;
        const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        animationPending = movements.length > 0 && !reducedMotion;
        const byPosition = new Map(pieces.map(piece => [key(piece.x, piece.y), piece]));
        const selectable = new Set(state && state.legalMoves && state.legalMoves.select || []);
        const steps = new Set((state && state.legalMoves && state.legalMoves.step || []).map(target => key(target.x, target.y)));
        const jumps = new Set((state && state.legalMoves && state.legalMoves.jump || []).map(target => key(target.x, target.y)));
        const lastFrom = state && state.lastMove && state.lastMove.from ? key(state.lastMove.from.x, state.lastMove.from.y) : '';
        const lastTo = state && state.lastMove && state.lastMove.to ? key(state.lastMove.to.x, state.lastMove.to.y) : '';
        holesEl.innerHTML = CELLS.map(cell => {
            const id = key(cell.x, cell.y);
            const piece = byPosition.get(id);
            const isSelected = piece && state.selectedPiece && state.selectedPiece.pieceId === piece.id;
            const canSelect = piece && selectable.has(piece.id);
            const isStep = steps.has(id);
            const isJump = jumps.has(id);
            const canMove = !piece && (isStep || isJump);
            const clickable = canSelect || canMove;
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
            return '<button class="' + classes.join(' ') + '" style="' + pointStyle(cell) + '" data-x="' + cell.x + '" data-y="' + cell.y + '"' + (piece ? ' data-piece-id="' + escapeHtml(piece.id) + '"' : '') + ' type="button" role="gridcell" aria-label="' + escapeHtml(ariaLabel) + '"' + ariaSelected + (clickable && !interactionLocked() && state.myIsCurrentTurn ? '' : ' disabled') + '>' + stone + '</button>';
        }).join('');
        syncInteractionState();
        if (animationPending) animateMovements(movements);
    }

    function syncInteractionState() {
        if (!state || !holesEl) return;
        const locked = interactionLocked();
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

    function animateMovements(movements) {
        const sequence = ++animationSequence;
        const width = boardEl.clientWidth;
        const height = boardEl.clientHeight;
        const animations = movements.map(movement => {
            const stone = findStone(movement.pieceId);
            if (!stone || typeof stone.animate !== 'function') return Promise.resolve();
            const dx = (movement.from.x - movement.to.x) * BOARD_SPAN / BOARD_MAX_X * width / 100;
            const dy = (movement.from.y - movement.to.y) * BOARD_SPAN / BOARD_MAX_Y * height / 100;
            const isJump = Math.abs(movement.from.x - movement.to.x) > 2 || Math.abs(movement.from.y - movement.to.y) > 1;
            const middleX = dx * .46;
            const middleY = dy * .46 - (isJump ? Math.max(12, width * .026) : Math.max(5, width * .011));
            const animation = stone.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px) translateY(-4%) scale(1)', filter: 'brightness(1)' },
                { transform: 'translate(' + middleX + 'px,' + middleY + 'px) translateY(-4%) scale(' + (isJump ? '1.1' : '1.04') + ')', filter: 'brightness(1.12)', offset: .48 },
                { transform: 'translate(0,0) translateY(-4%) scale(1)', filter: 'brightness(1)' },
            ], { duration: isJump ? 380 : 250, easing: 'cubic-bezier(.2,.72,.22,1)', fill: 'both' });
            return animation.finished.catch(() => undefined);
        });
        Promise.all(animations).then(() => {
            if (destroyed || sequence !== animationSequence) return;
            animationPending = false;
            syncInteractionState();
        });
    }

    function renderLog() { logEl.innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => '<div class="checkers-log-entry ' + (index === 0 ? 'is-latest' : '') + '"><i></i><span>' + escapeHtml(entry) + '</span></div>').join(''); }
    function formatPoint(x, y) { return '棋位 ' + (Number(x) + 1) + '·' + (Number(y) + 1); }
    function handleMessage(message) {
        releaseRequest();
        if (message.state) { state = message.state; render(); }
        else if (state) render();
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else if (message.action && message.action.message) addLog(message.action.message, 'info');
    }

    mount.addEventListener('click', event => {
        const uiTarget = event.target.closest('[data-ui]');
        const ui = uiTarget && uiTarget.dataset.ui;
        if (ui === 'rules') overlay.classList.remove('is-hidden');
        if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden');
        if (ui === 'leave') leaveRoom && leaveRoom();
        if (ui === 'endMove' && state && state.availableActions && state.availableActions.canEndMove && !interactionLocked()) {
            submitAction({ kind: 'endMove' });
            return;
        }
        const hole = event.target.closest('.checkers-hole');
        if (!hole || !state || interactionLocked() || !state.myIsCurrentTurn) return;
        if (hole.dataset.pieceId && state.legalMoves && state.legalMoves.select && state.legalMoves.select.includes(hole.dataset.pieceId)) {
            submitAction({ kind: 'selectPiece', pieceId: hole.dataset.pieceId });
            return;
        }
        const x = Number(hole.dataset.x); const y = Number(hole.dataset.y);
        if (state.selectedPiece && isLegalTarget(x, y)) {
            submitAction({ kind: 'movePiece', to: { x, y } });
        }
    });

    return { gameType: 'checkers', handleMessage, destroy() { destroyed = true; animationSequence += 1; releaseRequest(); style.remove(); mount.innerHTML = ''; } };
}

function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
