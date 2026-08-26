const COLOR_NAMES = { blue: '蓝方', green: '绿方', red: '红方', yellow: '黄方' };
const COLOR_ASSETS = Object.fromEntries(
    Object.keys(COLOR_NAMES).map(color => [color, `/games/aeroplane/assets/${color}-plane.svg`]),
);
const COLOR_STARTS = { blue: 0, green: 13, red: 26, yellow: 39 };
const DICE_PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};
// Keep the roll lively without making the player wait before choosing a plane.
const DICE_ANIMATION_MS = 900;
const MOVE_STEP_MS = 105;
const JUMP_PROGRESS = new Set([1, 5, 9, 13, 21, 25, 29, 33, 37, 41, 45]);
const FLIGHT_PROGRESS = 17;
const FLIGHT_DISTANCE = 12;
const LAST_ROUTE_PROGRESS = 49;
const HOME_START_PROGRESS = 50;
const FINISH_PROGRESS = 55;

// Use the sharpened bitmap's native coordinate system. These are measured circle
// centres in board-sharp.png, so pieces stay centred at every responsive size.
const BOARD_SIZE = 1254;
const ROUTE_CENTERS = [
    [112.1, 403.4], [191.3, 374.2], [263, 374.1], [343.8, 403.1], [398.1, 338.9], [373, 259.9], [372.9, 186.4], [399.9, 105.3],
    [481.4, 77.6], [553.4, 77.9], [627.1, 77.9], [700, 77.9], [772.5, 77.7], [854.1, 106.3], [880, 186.3], [879.8, 259.5],
    [854.7, 339], [907.1, 403.4], [989.8, 374.3], [1060.3, 374.5], [1141.4, 403.7], [1168.3, 485.1], [1168, 559], [1168.7, 634.3],
    [1168.9, 708.7], [1168.3, 782.3], [1138.1, 862], [1060, 893.1], [989.3, 893], [904.8, 862], [851.2, 919.3], [879.4, 1005.5],
    [879.4, 1079.6], [850.2, 1162.6], [769.9, 1189.9], [697.7, 1189.6], [626.2, 1189.7], [553.1, 1189.6], [481.5, 1189.8], [399.9, 1162.4],
    [373, 1079.8], [372.9, 1005.6], [399.9, 922.8], [345.1, 862], [263.4, 893.1], [191.3, 893.2], [112.6, 861.9], [83.8, 782.2],
    [84, 708.8], [83.9, 634.7], [84, 559.1], [84, 485.3],
];
const BASE_CENTERS = {
    blue: [[91.9, 85.7], [91.9, 218.5], [217.1, 85.7], [217.1, 218.5]],
    green: [[1034.6, 86.1], [1034.4, 218.9], [1160.8, 86], [1160.8, 218.7]],
    red: [[1033.3, 1044.4], [1033, 1178.3], [1160.6, 1044.5], [1160.4, 1178.4]],
    yellow: [[92.4, 1044.6], [92.2, 1178], [218.3, 1044.3], [217.9, 1177.9]],
};
const READY_CENTERS = { blue: [50.2, 328.1], green: [917.5, 50.2], red: [1212.2, 917.5], yellow: [334.4, 1212.2] };
const HOME_CENTERS = {
    blue: [[191, 634.7], [263.4, 634.5], [336.7, 634.8], [408, 634.6], [480.7, 634.7]],
    green: [[626.9, 186.6], [626.8, 260.7], [626.7, 338.9], [626.7, 412.9], [626.6, 487.5]],
    red: [[1059.4, 634], [987.3, 633.9], [913.9, 634.1], [842.5, 634], [769.4, 634]],
    yellow: [[626.5, 1080.5], [626.5, 1005.8], [626.5, 930.9], [626.5, 856.8], [626.6, 782.7]],
};
const FINISH_CENTERS = { blue: [552.8, 635.3], green: [626.8, 564.2], red: [690.8, 634.6], yellow: [624.5, 705.9] };
const PIECE_SIZES = { base: 113, ready: 65, track: 54, stacked: 44 };
const CAPTURE_BURST_SIZE = 172;
const STACK_LAYOUTS = {
    2: [[-10, -8], [10, 8]],
    3: [[0, -13], [-13, 10], [13, 10]],
    4: [[-10, -10], [10, -10], [-10, 10], [10, 10]],
};

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/aeroplane/style.css?v=${Date.now()}`;
    document.head.appendChild(style);

    const controller = new AbortController();
    let state = null;
    let latestMoveKey = '';
    let animatedPlaneId = null;
    let latestRollKey = '';
    let visibleDiceValue = 0;
    let diceAnimationTimer = null;
    let diceAnimationToken = 0;
    let diceAnimationFinalValue = 0;
    let diceAnimationStartedAt = 0;
    let diceValueBeforeAnimation = 0;
    let isDiceAnimating = false;
    let isRollPending = false;
    let selectedPlaneId = null;
    let movementAnimationTimer = null;
    let movementAnimationToken = 0;
    let movementAnimation = null;
    let isMoveAnimating = false;

    mount.innerHTML = `<section class="flight-game">
        <header class="flight-header">
            <div class="flight-brand"><span class="flight-brand-mark">✈</span><div><small>CLASSIC 52-SPACE BOARD</small><h1>飞行棋</h1></div></div>
            <div class="flight-turn" data-role="turn">等待游戏状态</div>
            <div class="flight-header-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
        </header>
        <main class="flight-layout">
            <aside class="flight-panel flight-players" data-role="players"></aside>
            <section class="flight-stage">
                <div class="flight-board-row">
                    <aside class="flight-panel flight-dice-panel" data-role="dicePanel">
                        <div class="flight-panel-kicker">DICE CONTROL</div>
                        <div class="flight-dice" data-role="dice" aria-live="polite" aria-label="尚未掷骰"></div>
                        <strong data-role="diceCaption">等待掷骰</strong>
                        <small data-role="diceOwner">等待游戏开始</small>
                        <button class="flight-roll" data-ui="roll" type="button">掷骰子<span>ROLL</span></button>
                    </aside>
                    <div class="flight-board-wrap">
                        <div class="flight-board" data-role="board" aria-label="经典五十二格十字飞行棋棋盘"></div>
                    </div>
                </div>
                <div class="flight-command">
                    <div><span class="flight-phase" data-role="phase">等待掷骰</span><strong data-role="hint">轮到谁，谁来掷骰子</strong></div>
                </div>
            </section>
            <aside class="flight-panel flight-log-panel">
                <div class="flight-panel-kicker">FLIGHT LOG</div><h2>飞行记录</h2><div class="flight-log" data-role="log"></div>
                <div class="flight-legend"><span><i class="legend-dot legend-move"></i>先选飞机，再点闪烁落点</span><span><i class="legend-dot legend-capture"></i>落在敌机会击落</span><span><i class="legend-dot legend-home"></i>彩色箭头通向终点</span></div>
            </aside>
        </main>
        <div class="flight-overlay is-hidden" data-role="rulesOverlay">
            <article class="flight-rules"><button class="flight-close" type="button" data-ui="closeRules">×</button><small>HOW TO FLY</small><h2>飞行棋规则</h2><ol><li>掷出六点，基地里的飞机先进入本色起飞等待点；之后再次掷骰，才从等待点进入 52 格主航线。掷出六点仍可额外再掷一次。</li><li>掷骰后先点击一架发光飞机预览逐格路径，再点击闪烁落点确认移动；也可以改选另一架飞机。</li><li>棋盘公用外圈共有 52 格；每种颜色从本色起点行进 50 步后转入自己的归航通道，不会继续走过归航入口。</li><li>落在棋盘标出的同色跳跃格会前进 4 格；飞行线入口会直飞 12 格。落在单架敌机所在格会将其送回基地，敌方双机叠放时受保护。</li><li>进入本方彩色归航通道后必须精确到达中央终点；四架飞机全部抵达的一方获胜。</li></ol></article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const boardEl = $('board');
    const playersEl = $('players');
    const turnEl = $('turn');
    const diceEl = $('dice');
    const dicePanelEl = $('dicePanel');
    const diceCaptionEl = $('diceCaption');
    const diceOwnerEl = $('diceOwner');
    const phaseEl = $('phase');
    const hintEl = $('hint');
    const logEl = $('log');
    const overlay = $('rulesOverlay');
    const rollButton = mount.querySelector('[data-ui="roll"]');

    function currentPlayer() {
        return state?.players?.find(player => player.id === state.currentTurn) || null;
    }

    function canMove(plane) {
        return Boolean(!isDiceAnimating && !isMoveAnimating && plane && state?.availableActions?.movablePlaneIds?.includes(plane.id));
    }

    function setDiceFace(value, announce = true) {
        const dice = Number(value) || 0;
        const face = DICE_PIPS[dice] || DICE_PIPS[1];
        diceEl.dataset.value = dice ? String(dice) : '';
        diceEl.innerHTML = Array.from({ length: 9 }, (_, index) => `<i class="${face.includes(index) ? 'is-on' : ''}" aria-hidden="true"></i>`).join('');
        if (announce) diceEl.setAttribute('aria-label', dice ? `骰子点数 ${dice}` : '尚未掷骰');
    }

    function finishDiceAnimation() {
        if (!diceAnimationFinalValue) return;
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceAnimationTimer = null;
        visibleDiceValue = diceAnimationFinalValue;
        diceAnimationFinalValue = 0;
        isDiceAnimating = false;
        isRollPending = false;
        dicePanelEl.classList.remove('is-rolling');
        diceEl.classList.remove('is-rolling', 'has-landed');
        setDiceFace(visibleDiceValue);
        void diceEl.offsetWidth;
        diceEl.classList.add('has-landed');
        render();
    }

    function runDiceFrame(animationToken) {
        if (animationToken !== diceAnimationToken || !isDiceAnimating) return;
        const elapsed = Date.now() - diceAnimationStartedAt;
        if (elapsed >= DICE_ANIMATION_MS && diceAnimationFinalValue) return finishDiceAnimation();
        setDiceFace(Math.floor(Math.random() * 6) + 1, false);
        const progress = Math.min(elapsed / DICE_ANIMATION_MS, 1);
        const nextDelay = 32 + Math.round(progress * progress * 70);
        diceAnimationTimer = setTimeout(() => runDiceFrame(animationToken), nextDelay);
    }

    function beginDiceAnimation(finalValue = 0, rollKey = '') {
        if (rollKey && rollKey === latestRollKey) return;
        if (rollKey) latestRollKey = rollKey;
        if (isDiceAnimating) {
            if (finalValue) diceAnimationFinalValue = finalValue;
            return;
        }
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceValueBeforeAnimation = visibleDiceValue;
        diceAnimationFinalValue = finalValue;
        diceAnimationStartedAt = Date.now();
        isDiceAnimating = true;
        const animationToken = ++diceAnimationToken;
        dicePanelEl.classList.add('is-rolling');
        diceEl.classList.remove('has-landed');
        diceEl.classList.add('is-rolling');
        diceEl.setAttribute('aria-label', '骰子滚动中');
        runDiceFrame(animationToken);
        render();
    }

    function cancelDiceAnimation() {
        if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
        diceAnimationTimer = null;
        diceAnimationToken += 1;
        diceAnimationFinalValue = 0;
        isDiceAnimating = false;
        isRollPending = false;
        dicePanelEl.classList.remove('is-rolling');
        diceEl.classList.remove('is-rolling');
        setDiceFace(diceValueBeforeAnimation);
        render();
    }

    setDiceFace(0);

    function planePosition(plane) {
        if (!plane) return null;
        if (plane.status === 'base') return BASE_CENTERS[plane.color]?.[plane.number - 1] || null;
        if (plane.status === 'ready') return READY_CENTERS[plane.color] || null;
        if (plane.status === 'flying') return ROUTE_CENTERS[plane.globalPosition] || null;
        if (plane.status === 'home') return HOME_CENTERS[plane.color]?.[plane.progress - HOME_START_PROGRESS] || null;
        if (plane.status === 'finished') return FINISH_CENTERS[plane.color] || null;
        return null;
    }

    function planeLocationKey(plane) {
        if (plane.status === 'base') return `base-${plane.color}-${plane.number}`;
        if (plane.status === 'ready') return `ready-${plane.color}`;
        if (plane.status === 'flying') return `route-${plane.globalPosition}`;
        if (plane.status === 'home') return `home-${plane.color}-${plane.progress}`;
        return `finish-${plane.color}`;
    }

    function positionStyle(point, size, offset = [0, 0]) {
        const x = ((point[0] + offset[0]) / BOARD_SIZE) * 100;
        const y = ((point[1] + offset[1]) / BOARD_SIZE) * 100;
        return `--piece-x:${x}%;--piece-y:${y}%;--piece-size:${(size / BOARD_SIZE) * 100}%`;
    }

    function frameForProgress(template, progress) {
        if (progress < 0) return { ...template, progress: -1, status: 'ready', globalPosition: null };
        const status = progress === FINISH_PROGRESS ? 'finished' : progress > LAST_ROUTE_PROGRESS ? 'home' : 'flying';
        return {
            ...template,
            progress,
            status,
            globalPosition: status === 'flying' ? (COLOR_STARTS[template.color] + progress) % 52 : null,
        };
    }

    function buildMovementPath(previousPlane, move, finalPlane) {
        if (!previousPlane || !move || !finalPlane) return [];
        const path = [{ ...previousPlane }];
        if (Array.isArray(move.path) && move.path.length) {
            for (const frame of move.path) path.push({ ...previousPlane, ...frame });
            return path;
        }
        if (previousPlane.status === 'base') {
            path.push({ ...finalPlane, progress: -1, status: 'ready', globalPosition: null });
            return path;
        }
        const fromProgress = previousPlane.status === 'ready' ? -1 : Number(move.from?.progress ?? previousPlane.progress);
        const toProgress = Number(move.to?.progress ?? finalPlane.progress);
        for (let progress = fromProgress + 1; progress <= toProgress; progress += 1) {
            path.push(frameForProgress(previousPlane, progress));
        }
        if (path.length === 1) path.push({ ...finalPlane });
        return path;
    }

    function finishMovementAnimation(animationToken) {
        if (animationToken !== movementAnimationToken) return;
        if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
        movementAnimationTimer = null;
        movementAnimation = null;
        isMoveAnimating = false;
        render();
    }

    function advanceMovementAnimation(animationToken) {
        if (animationToken !== movementAnimationToken || !movementAnimation) return;
        if (movementAnimation.index >= movementAnimation.path.length - 1) return finishMovementAnimation(animationToken);
        movementAnimation.index += 1;
        render();
        movementAnimationTimer = setTimeout(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
    }

    function startMovementAnimation(previousPlane, move, finalPlane) {
        const path = buildMovementPath(previousPlane, move, finalPlane);
        if (path.length < 2) return false;
        if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
        movementAnimationToken += 1;
        movementAnimation = { planeId: finalPlane.id, path, index: 0 };
        isMoveAnimating = true;
        animatedPlaneId = finalPlane.id;
        selectedPlaneId = null;
        const animationToken = movementAnimationToken;
        movementAnimationTimer = setTimeout(() => advanceMovementAnimation(animationToken), MOVE_STEP_MS);
        return true;
    }

    function movementDisplayPlane(plane) {
        if (!movementAnimation || movementAnimation.planeId !== plane.id) return plane;
        const frame = movementAnimation.path[movementAnimation.index];
        return frame ? { ...plane, ...frame } : plane;
    }

    function render() {
        if (!state) return;
        if (selectedPlaneId && !canMove(state.planes?.find(plane => plane.id === selectedPlaneId))) selectedPlaneId = null;
        const current = currentPlayer();
        const ended = state.status === 'ended';
        dicePanelEl.className = `flight-panel flight-dice-panel tone-${current?.color || 'blue'}${isDiceAnimating ? ' is-rolling' : ''}`;
        turnEl.innerHTML = ended
            ? `<i class="flight-live-dot ended"></i>${escapeHtml(state.winner?.name || '棋局结束')}<small>飞行棋已结束</small>`
            : `<i class="flight-live-dot"></i>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}<small>${escapeHtml(current?.colorName || COLOR_NAMES[current?.color] || '')}</small>`;
        const dice = Number(state.dice) || 0;
        if (!isDiceAnimating && dice) visibleDiceValue = dice;
        if (!isDiceAnimating) setDiceFace(visibleDiceValue);
        diceCaptionEl.textContent = isDiceAnimating
            ? '骰子滚动中…'
            : visibleDiceValue
                ? `最终点数 ${visibleDiceValue}`
                : '等待掷骰';
        diceOwnerEl.textContent = ended
            ? '本局已经结束'
            : state.myIsCurrentTurn
                ? '现在轮到你'
                : `等待 ${current?.name || '对手'} 掷骰`;
        phaseEl.textContent = ended ? '已结束' : isDiceAnimating ? '骰子滚动中' : isMoveAnimating ? '飞机逐格移动中' : state.phase === 'choose_plane' ? `掷出 ${visibleDiceValue} 点 · 选择飞机` : '等待掷骰';
        hintEl.textContent = ended
            ? `${escapeHtml(state.winner?.name || '本局')} 获胜`
            : isDiceAnimating
                ? '请等待骰子停下'
            : isMoveAnimating
                ? '请等待飞机完成移动'
            : state.myIsCurrentTurn
                ? (state.phase === 'choose_plane'
                    ? (selectedPlaneId ? '点击闪烁的落点确认移动' : '点击一架发光的飞机预览落点')
                    : '点击掷骰子开始行动')
                : `等待 ${escapeHtml(current?.name || '对手')} 操作`;
        rollButton.disabled = isDiceAnimating || isMoveAnimating || isRollPending || !state.availableActions?.canRoll;
        rollButton.setAttribute('aria-busy', isDiceAnimating || isMoveAnimating || isRollPending ? 'true' : 'false');
        renderPlayers();
        renderBoard();
        renderLog();
    }

    function renderPlayers() {
        playersEl.innerHTML = (state.players || []).map(player => {
            const planes = state.planes.filter(plane => plane.playerId === player.id);
            const finished = planes.filter(plane => plane.status === 'finished').length;
            return `<article class="flight-seat tone-${player.color} ${player.id === state.myId ? 'is-me' : ''} ${player.isCurrentTurn ? 'is-current' : ''} ${player.isOnline === false ? 'is-offline' : ''}">
                <div class="flight-seat-head"><img class="flight-seat-plane" src="${COLOR_ASSETS[player.color]}" alt=""><div><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${escapeHtml(player.colorName || COLOR_NAMES[player.color] || '')}</small></div><b>${finished}/4</b></div>
                <div class="flight-seat-planes">${planes.map(plane => planeChip(plane)).join('')}</div><div class="flight-seat-progress"><span style="--progress:${finished * 25}%"></span></div>
            </article>`;
        }).join('');
    }

    function planeChip(plane) {
        const movable = canMove(plane);
        const tag = plane.playerId === state.myId && movable ? 'button' : 'span';
        const attributes = tag === 'button' ? `type="button" data-plane-id="${escapeHtml(plane.id)}"` : '';
        return `<${tag} class="flight-chip ${plane.status} ${movable ? 'is-movable' : ''}" ${attributes}><img src="${COLOR_ASSETS[plane.color]}" alt=""><b>${plane.number}</b></${tag}>`;
    }

    function renderBoard() {
        const selected = state?.planes?.find(plane => plane.id === selectedPlaneId) || null;
        if (selectedPlaneId && !canMove(selected)) selectedPlaneId = null;
        const displayPlanes = (state.planes || []).map(movementDisplayPlane);
        const groups = new Map();
        for (const plane of displayPlanes) {
            const key = planeLocationKey(plane);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(plane);
        }

        const pieces = displayPlanes.map(plane => {
            const point = planePosition(plane);
            if (!point) return '';
            const group = groups.get(planeLocationKey(plane)) || [plane];
            const groupIndex = group.findIndex(item => item.id === plane.id);
            const stackLayout = STACK_LAYOUTS[Math.min(group.length, 4)];
            const offset = stackLayout?.[groupIndex % stackLayout.length] || [0, 0];
            const size = group.length > 1
                ? PIECE_SIZES.stacked
                : plane.status === 'base'
                    ? PIECE_SIZES.base
                    : plane.status === 'ready'
                        ? PIECE_SIZES.ready
                        : PIECE_SIZES.track;
            const sourcePlane = state.planes.find(item => item.id === plane.id) || plane;
            const movable = sourcePlane.playerId === state.myId && canMove(sourcePlane);
            const tag = movable ? 'button' : 'span';
            const attributes = movable
                ? `type="button" data-plane-id="${escapeHtml(plane.id)}" aria-label="移动${plane.number}号飞机" aria-pressed="${selectedPlaneId === plane.id ? 'true' : 'false'}"`
                : `aria-label="${escapeHtml(COLOR_NAMES[plane.color])}${plane.number}号飞机"`;
            const classes = `flight-piece tone-${plane.color} ${movable ? 'is-movable' : ''} ${selectedPlaneId === plane.id ? 'is-selected' : ''} ${animatedPlaneId === plane.id ? 'has-moved' : ''} status-${plane.status}`;
            const stackBadge = group.length > 1 && groupIndex === group.length - 1
                ? `<b class="flight-stack-count" aria-hidden="true">×${group.length}</b>`
                : '';
            return `<${tag} class="${classes}" style="${positionStyle(point, size, offset)}" ${attributes}><span class="flight-piece-glow"></span><img src="${COLOR_ASSETS[plane.color]}" alt="">${stackBadge}</${tag}>`;
        }).join('');

        const movedPlane = state.planes?.find(plane => plane.id === animatedPlaneId);
        const burstPoint = !isMoveAnimating && state.lastMove?.events?.some(event => event.includes('击落')) ? planePosition(movedPlane) : null;
        const burst = burstPoint ? `<span class="flight-capture-burst" style="${positionStyle(burstPoint, CAPTURE_BURST_SIZE)}"></span>` : '';
        const readyMarkers = Object.entries(READY_CENTERS).map(([color, point]) => `<span class="flight-ready-marker tone-${color}" style="${positionStyle(point, 48)}" aria-hidden="true"><i></i><b>起飞</b></span>`).join('');
        const pathPreview = renderPathPreview(selected);
        boardEl.innerHTML = `<img class="flight-board-image" src="/games/aeroplane/assets/board-sharp.png" draggable="false" alt="高清经典十五乘十五飞行棋棋盘">${readyMarkers}${pathPreview}${pieces}<button class="flight-ghost" data-role="ghost" type="button" aria-hidden="true"></button>${burst}`;
        renderSelectedGhost();
    }

    function renderPathPreview(plane) {
        if (isMoveAnimating || !plane || plane.id !== selectedPlaneId) return '';
        const movement = buildPredictedMovement(plane, Number(state?.dice));
        if (!movement || movement.frames.length <= 1) return '';
        const path = movement.frames.map((frame, index) => ({ point: planePosition(frame), progress: frame.progress, index })).filter(step => step.point);
        return path.slice(0, -1).map((step, index) => {
            const special = JUMP_PROGRESS.has(step.progress) || step.progress === FLIGHT_PROGRESS;
            return `<span class="flight-path-marker tone-${plane.color} ${special ? 'is-special' : ''}" style="${positionStyle(step.point, 32)}" data-step="${index + 1}" aria-hidden="true"></span>`;
        }).join('');
    }

    function renderLog() {
        logEl.innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<div class="flight-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') || '<div class="flight-log-entry">等待第一架飞机起飞。</div>';
    }

    function buildPredictedMovement(plane, dice) {
        if (!plane || !Number.isInteger(dice) || dice < 1 || dice > 6) return null;
        if (plane.status === 'base') return { final: { ...plane, progress: -1, status: 'ready', globalPosition: null }, frames: [] };
        let progress = plane.status === 'ready' ? dice - 1 : plane.progress + dice;
        if (progress > FINISH_PROGRESS) return null;
        const frames = [];
        const startProgress = plane.status === 'ready' ? -1 : plane.progress;
        const landedByDice = progress;
        for (let step = startProgress + 1; step <= landedByDice; step += 1) frames.push(frameForProgress(plane, step));
        if (progress <= LAST_ROUTE_PROGRESS) {
            let jumpedToFlight = false;
            if (JUMP_PROGRESS.has(progress)) {
                progress = Math.min(progress + 4, LAST_ROUTE_PROGRESS);
                frames.push(frameForProgress(plane, progress));
                jumpedToFlight = progress === FLIGHT_PROGRESS;
            }
            if (progress === FLIGHT_PROGRESS) {
                progress = Math.min(progress + FLIGHT_DISTANCE, LAST_ROUTE_PROGRESS);
                frames.push(frameForProgress(plane, progress));
                if (!jumpedToFlight && landedByDice <= LAST_ROUTE_PROGRESS && progress < LAST_ROUTE_PROGRESS && JUMP_PROGRESS.has(progress)) {
                    progress = Math.min(progress + 4, LAST_ROUTE_PROGRESS);
                    frames.push(frameForProgress(plane, progress));
                }
            }
        }
        return { final: frameForProgress(plane, progress), frames };
    }

    function predictedPlane(plane) {
        if (!plane || !canMove(plane)) return null;
        const movement = buildPredictedMovement(plane, Number(state?.dice));
        return movement?.final || null;
    }

    function renderSelectedGhost() {
        const ghost = boardEl.querySelector('[data-role="ghost"]');
        const plane = state?.planes?.find(item => item.id === selectedPlaneId) || null;
        const predicted = predictedPlane(plane);
        const point = planePosition(predicted);
        if (!ghost || !plane || !point) {
            if (ghost) {
                ghost.className = 'flight-ghost';
                ghost.style.cssText = '';
                ghost.removeAttribute('data-move-confirm');
                ghost.setAttribute('aria-hidden', 'true');
                ghost.innerHTML = '';
            }
            return;
        }
        ghost.className = `flight-ghost is-visible is-confirm-target tone-${plane.color}`;
        const ghostSize = predicted.status === 'ready' ? PIECE_SIZES.ready : PIECE_SIZES.track;
        ghost.style.cssText = positionStyle(point, ghostSize);
        ghost.dataset.moveConfirm = plane.id;
        ghost.removeAttribute('aria-hidden');
        ghost.setAttribute('aria-label', `点击确认移动${plane.number}号飞机`);
        ghost.innerHTML = `<span></span><img src="${COLOR_ASSETS[plane.color]}" alt=""><b>✓</b>`;
    }

    function handleMessage(message) {
        if (message.type === 'error' && isRollPending) cancelDiceAnimation();
        if (message.state) {
            const previousState = state;
            state = message.state;
            const rollAction = state.lastAction?.kind === 'rollDice' ? state.lastAction : null;
            const rollValue = Number(rollAction?.dice) || 0;
            const rollKey = rollValue ? String(rollAction.rollId || `${rollAction.playerId || ''}:${rollValue}:${state.actionLog?.join('|') || ''}`) : '';
            if (rollValue && isRollPending && rollAction.playerId === state.myId && isDiceAnimating) {
                isRollPending = false;
                latestRollKey = rollKey;
                diceAnimationFinalValue = rollValue;
            } else if (rollValue) beginDiceAnimation(rollValue, rollKey);
            const move = state.lastMove;
            const moveKey = move ? `${move.planeId}:${move.from?.progress}:${move.to?.progress}` : '';
            if (moveKey && moveKey !== latestMoveKey) {
                const previousPlane = previousState?.planes?.find(plane => plane.id === move.planeId);
                const finalPlane = state.planes?.find(plane => plane.id === move.planeId);
                animatedPlaneId = move.planeId;
                latestMoveKey = moveKey;
                startMovementAnimation(previousPlane, move, finalPlane);
            } else if (!isMoveAnimating) {
                animatedPlaneId = null;
            }
            render();
        }
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else if (message.action?.message) addLog(message.action.message, 'info');
    }

    mount.addEventListener('click', event => {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'roll' && !rollButton.disabled) {
            isRollPending = true;
            beginDiceAnimation();
            send({ type: 'gameAction', action: { kind: 'rollDice' } });
        }
        if (ui === 'rules') overlay.classList.remove('is-hidden');
        if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden');
        if (ui === 'leave') leaveRoom?.();
        const confirmTarget = event.target.closest('[data-move-confirm]');
        if (confirmTarget) {
            const plane = state?.planes?.find(item => item.id === confirmTarget.dataset.moveConfirm);
            if (canMove(plane)) {
                selectedPlaneId = null;
                render();
                send({ type: 'gameAction', action: { kind: 'movePlane', planeId: plane.id } });
            }
            return;
        }
        const planeButton = event.target.closest('[data-plane-id]');
        if (planeButton) {
            const plane = state?.planes?.find(item => item.id === planeButton.dataset.planeId);
            if (canMove(plane)) {
                selectedPlaneId = selectedPlaneId === plane.id ? null : plane.id;
                render();
            }
        }
    }, { signal: controller.signal });

    return {
        gameType: 'aeroplane',
        handleMessage,
        destroy() {
            controller.abort();
            if (diceAnimationTimer) clearTimeout(diceAnimationTimer);
            if (movementAnimationTimer) clearTimeout(movementAnimationTimer);
            diceAnimationTimer = null;
            movementAnimationTimer = null;
            diceAnimationToken += 1;
            movementAnimationToken += 1;
            movementAnimation = null;
            isMoveAnimating = false;
            selectedPlaneId = null;
            style.remove();
            mount.innerHTML = '';
        },
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
