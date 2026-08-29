/**
 * Waiting-room state derivation and table presentation.
 *
 * The lobby entry keeps the protocol and navigation orchestration, while this
 * module owns the seat geometry, readiness copy and visual lifecycle timers.
 * All room data is read through getters so a render always uses the latest
 * server-authoritative snapshot.
 */

export function createWaitingRoomScene({
    mount,
    currentRoomPanel,
    startGameBtn,
    lobbyStartGameBtn,
    getRoom = () => null,
    getRoomId = () => null,
    getPlayerId = () => null,
    getPendingRoomSettings = () => ({}),
    getGamePresentation = () => null,
    getGameCovers = () => ({}),
    getBggArt = () => ({}),
    getGamePreloadState = () => ({ status: 'idle' }),
    getRoomSettingDefinitions = () => [],
    getRoomSettingValues = () => ({}),
    renderSharedRoomSettings = () => '',
    escapeHtml = value => String(value ?? ''),
    documentRef = globalThis.document,
    windowRef = globalThis,
} = {}) {
    let waitingSeatVisualRoomId = null;
    let waitingSeatVisualSnapshot = new Map();
    let waitingRoomResizeFrame = null;
    const waitingSeatExtinguishTimers = new Map();
    const waitingSeatIgniteUntil = new Map();
    const waitingSeatIgniteTimers = new Map();
    const waitingSeatVisualOrderCache = new Map();

    const clearVisualTimers = () => {
        waitingSeatExtinguishTimers.forEach(timer => windowRef.clearTimeout(timer));
        waitingSeatExtinguishTimers.clear();
        waitingSeatIgniteUntil.clear();
        waitingSeatIgniteTimers.forEach(timer => windowRef.clearTimeout(timer));
        waitingSeatIgniteTimers.clear();
    };

    function getWaitingRoomState() {
        const currentRoom = getRoom();
        const currentRoomId = getRoomId();
        const myId = getPlayerId();
        if (!currentRoom || !currentRoomId || currentRoom.status !== 'waiting') return null;
        const players = currentRoom.players || [];
        const minPlayers = currentRoom.minPlayers || 2;
        const isHost = currentRoom.hostId === myId;
        const currentPlayer = players.find(player => player.id === myId) || null;
        const needsConfiguration = Boolean(currentRoom.configurationRequired && !currentRoom.configurationConfirmed);
        const targetPlayers = Number(currentRoom.targetPlayers || currentRoom.maxPlayers || minPlayers);
        const fixedPlayerCount = Boolean(currentRoom.targetPlayers);
        const connectedPlayers = players.filter(player => player.isOnline !== false);
        const memberPlayers = connectedPlayers.filter(player => player.id !== currentRoom.hostId);
        const readyCount = memberPlayers.filter(player => player.ready === true).length;
        const allPlayersReady = readyCount === memberPlayers.length;
        const playerProgress = fixedPlayerCount
            ? (players.length === targetPlayers ? '玩家已到齐' : `还差 ${Math.max(0, targetPlayers - players.length)} 人`)
            : (players.length >= minPlayers ? `已满足开局人数，还有 ${Math.max(0, targetPlayers - players.length)} 个空位` : `至少还需 ${Math.max(0, minPlayers - players.length)} 人`);
        const preload = getGamePreloadState(currentRoom.gameType);
        const playerCountReady = currentRoom.targetPlayers ? players.length === targetPlayers : players.length >= minPlayers;
        return {
            players,
            minPlayers,
            isHost,
            currentPlayer,
            needsConfiguration,
            targetPlayers,
            fixedPlayerCount,
            playerProgress,
            preload,
            connectedPlayers,
            memberPlayers,
            readyCount,
            allPlayersReady,
            playerCountReady,
            canStart: isHost && !needsConfiguration && playerCountReady && allPlayersReady && preload.status === 'ready',
        };
    }

    function waitingRoomConfigurationMarkup(waiting) {
        const currentRoom = getRoom();
        if (!waiting.needsConfiguration || !currentRoom) return '';
        // 兼容旧验收文案：9 / 12 人选项现在由服务器的 roomSettings 元数据提供。
        const values = getRoomSettingValues(currentRoom, getPendingRoomSettings());
        return `<section class="room-configuration room-settings-configuration"><small>ROOM SETUP</small><strong>确认本局游戏设置</strong><p>确认后房间才会公开；之后仍可由房主在房间内调整。</p><div class="pregame-room-setting-fields">${renderSharedRoomSettings(currentRoom, values, 'waiting', !waiting.isHost)}</div>${waiting.isHost ? '<button class="room-config-confirm" data-confirm-room-configuration type="button">确认设置并公开房间 <span>→</span></button>' : '<em>等待房主确认…</em>'}</section>`;
    }

    function waitingRoomToolsMarkup(waiting) {
        const currentRoom = getRoom();
        const myId = getPlayerId();
        if (!currentRoom) return '';
        const me = waiting.currentPlayer;
        const playerRows = waiting.players.map(player => `<div class="pregame-player-row ${player.ready ? 'is-ready' : ''} ${player.isOnline === false ? 'is-offline' : ''}"><span class="pregame-player-state" aria-hidden="true"></span><span class="pregame-player-name"><strong>${escapeHtml(player.name)}</strong><small>${player.isHost ? '房主' : player.ready ? '已准备' : '等待准备'}${player.isOnline === false ? ' · 已断线' : ''}</small></span>${waiting.isHost && player.id !== myId ? `<button type="button" class="pregame-kick-button" data-kick-player="${escapeHtml(player.id)}">移出</button>` : ''}</div>`).join('');
        const settings = getRoomSettingDefinitions(currentRoom).length
            ? `<section class="pregame-inline-settings"><header><span>GAME SETTINGS</span><strong>游戏设置</strong><small>${waiting.isHost ? '房主修改后，成员需要重新准备' : '当前设置由房主管理'}</small></header><div class="pregame-room-setting-fields">${renderSharedRoomSettings(currentRoom, getRoomSettingValues(currentRoom, getPendingRoomSettings()), 'waiting', !waiting.isHost)}</div>${waiting.isHost ? '<button type="button" class="pregame-settings-save" data-save-room-settings>保存房间设置 <span>→</span></button>' : ''}</section>`
            : '';
        const readyPanel = waiting.isHost
            ? '<section class="pregame-ready-panel is-host"><div><strong>房主可以开局</strong><small>房主无需准备；等待成员准备完成后即可点击桌面魔法阵。</small></div></section>'
            : `<section class="pregame-ready-panel"><div><strong>${me?.ready ? '你已准备' : '准备好了吗？'}</strong><small>${waiting.allPlayersReady ? '所有成员均已准备' : `${waiting.readyCount}/${waiting.memberPlayers.length} 名成员已准备`}</small></div><button type="button" class="pregame-ready-button ${me?.ready ? 'is-ready' : ''}" data-toggle-ready>${me?.ready ? '取消准备' : '准备'}</button></section>`;
        return `<details class="pregame-room-tools" open><summary><span>ROOM CONTROL</span><strong>房间管理</strong><em>${waiting.readyCount}/${waiting.memberPlayers.length} 名成员已准备</em></summary><div class="pregame-tools-body">${readyPanel}<section class="pregame-player-list"><header><span>PLAYERS</span><strong>房间成员</strong></header>${playerRows}</section>${settings}</div></details>`;
    }

    function waitingRoomStartPresentation(waiting) {
        const count = waiting.players.length;
        const requiredPlayers = waiting.fixedPlayerCount ? waiting.targetPlayers : waiting.minPlayers;
        const missing = Math.max(0, requiredPlayers - count);
        let state = 'locked';
        let label = '尚未达到开局人数';
        let detail = missing > 0 ? `还差 ${missing} 人` : '';
        if (waiting.needsConfiguration) {
            state = 'setup';
            label = '请先完成房间设置';
            detail = waiting.isHost ? '确认规则后即可继续' : '等待房主确认规则';
        } else if (missing > 0) {
            state = 'locked';
        } else if (waiting.preload.status === 'error') {
            state = 'error';
            label = '游戏资源准备失败，请重新加载';
            detail = '资源准备失败';
        } else if (waiting.preload.status !== 'ready') {
            state = 'loading';
            label = '正在准备游戏资源';
            detail = '资源完成后即可开始';
        } else if (!waiting.allPlayersReady) {
            state = 'locked';
            label = '请等待所有成员准备';
            detail = `${waiting.readyCount}/${waiting.memberPlayers.length} 已准备`;
        } else if (waiting.isHost) {
            state = 'ready';
            label = '可以开始游戏了，请点击桌面魔法阵';
            detail = '点击魔法阵开始游戏';
        } else {
            state = 'waiting-host';
            label = '请等待房主开始游戏';
            detail = '房主可以点击魔法阵开始游戏';
        }
        return { state, label, detail };
    }

    function waitingRoomMagicMarkup(waiting) {
        const { state, label, detail } = waitingRoomStartPresentation(waiting);
        const circle = '<svg class="pregame-magic-svg" viewBox="0 0 220 220" preserveAspectRatio="none" aria-hidden="true"><circle class="pregame-magic-outer" cx="110" cy="110" r="91"></circle><circle class="pregame-magic-inner" cx="110" cy="110" r="79"></circle><path class="pregame-magic-triangle" d="M110 29 L181 153 L39 153 Z"></path><path class="pregame-magic-triangle" d="M110 191 L39 67 L181 67 Z"></path><circle class="pregame-magic-node" cx="110" cy="29" r="5"></circle><circle class="pregame-magic-node" cx="181" cy="153" r="5"></circle><circle class="pregame-magic-node" cx="39" cy="153" r="5"></circle><circle class="pregame-magic-node" cx="110" cy="191" r="5"></circle><circle class="pregame-magic-node" cx="39" cy="67" r="5"></circle><circle class="pregame-magic-node" cx="181" cy="67" r="5"></circle></svg>';
        const interactive = waiting.isHost;
        const trigger = interactive
            ? `<button class="pregame-magic-trigger" data-start-game data-start-state="${state}" type="button" aria-disabled="${state === 'ready' ? 'false' : 'true'}" aria-label="${escapeHtml(label)}，${escapeHtml(detail)}">${circle}</button>`
            : `<div class="pregame-magic-static" role="img" aria-label="${escapeHtml(label)}，${escapeHtml(detail)}">${circle}</div>`;
        return `<div class="pregame-magic-control is-${state}">${trigger}</div>`;
    }

    function waitingRoomStartGuidanceMarkup(waiting) {
        const { state, label } = waitingRoomStartPresentation(waiting);
        const requiredPlayers = waiting.fixedPlayerCount ? waiting.targetPlayers : waiting.minPlayers;
        const playerCountReady = waiting.players.length >= requiredPlayers && !waiting.needsConfiguration && waiting.allPlayersReady;
        return `<p class="pregame-start-guidance is-${state} ${playerCountReady ? 'has-player-count' : ''}" role="status">${escapeHtml(label)}</p>`;
    }

    function waitingSeatVisualOrder(capacity) {
        if (waitingSeatVisualOrderCache.has(capacity)) return waitingSeatVisualOrderCache.get(capacity);
        const order = [0];
        const used = new Set(order);
        const regionForSlot = slot => Math.min(3, Math.floor(slot * 4 / capacity));
        const circularDistance = (left, right) => {
            const delta = Math.abs(left - right);
            return Math.min(delta, capacity - delta);
        };
        // Every arrival is placed from the current distribution instead of a
        // capacity-specific order. Candidate positions are scored by the gaps
        // they would leave around the whole ring; region and arrival direction
        // only break ties after the geometry is already balanced.
        while (order.length < capacity) {
            const previous = order[order.length - 1];
            const previousPrevious = order[order.length - 2];
            const previousPreviousRegion = previousPrevious == null ? -1 : regionForSlot(previousPrevious);
            const candidates = Array.from({ length: capacity }, (_, slot) => slot).filter(slot => !used.has(slot));
            const scoredCandidates = candidates.map(slot => {
                const occupied = [...order, slot].sort((left, right) => left - right);
                const gaps = occupied.map((current, index) => (occupied[(index + 1) % occupied.length] - current + capacity) % capacity);
                return {
                    slot,
                    nearestDistance: Math.min(...order.map(item => circularDistance(slot, item))),
                    largestGap: Math.max(...gaps),
                    gapImbalance: gaps.reduce((total, gap) => total + gap * gap, 0),
                    regionLoad: order.filter(item => regionForSlot(item) === regionForSlot(slot)).length,
                    previousDistance: circularDistance(slot, previous),
                    repeatsPreviousPreviousRegion: Number(regionForSlot(slot) === previousPreviousRegion),
                };
            });
            scoredCandidates.sort((left, right) =>
                right.nearestDistance - left.nearestDistance
                || left.largestGap - right.largestGap
                || left.gapImbalance - right.gapImbalance
                || left.regionLoad - right.regionLoad
                || right.previousDistance - left.previousDistance
                || left.repeatsPreviousPreviousRegion - right.repeatsPreviousPreviousRegion
                || left.slot - right.slot
            );
            const candidate = scoredCandidates[0].slot;
            used.add(candidate);
            order.push(candidate);
        }
        waitingSeatVisualOrderCache.set(capacity, order);
        return order;
    }

    function waitingSeatVisualSlot(seatIndex, capacity) {
        const order = waitingSeatVisualOrder(capacity);
        const slot = order.indexOf(seatIndex);
        return slot >= 0 ? slot : seatIndex % capacity;
    }

    function waitingSeatStyle(seatIndex, capacity, mySeatIndex) {
        const seatSlot = waitingSeatVisualSlot(seatIndex, capacity);
        const mySlot = waitingSeatVisualSlot(mySeatIndex, capacity);
        // The viewer is always the six-o'clock anchor. Every other seat rotates by
        // the same slot offset, so each client receives its own table orientation.
        const visualSlot = seatIndex === mySeatIndex ? 0 : (seatSlot - mySlot + capacity) % capacity;
        const angle = Math.PI / 2 + (Math.PI * 2 * visualSlot / capacity);
        const compact = windowRef.matchMedia?.('(max-width: 760px)').matches;
        // Keep the same angular ring on every client, but leave enough edge room
        // for the flame/name block at tablet widths and for 9–12 seat layouts.
        const x = 50 + Math.cos(angle) * (compact ? 34 : 38);
        const y = 50 + Math.sin(angle) * (compact ? 35 : 35);
        const flameDelay = (seatIndex * 137) % 900;
        return `--seat-x:${x.toFixed(2)}%;--seat-y:${y.toFixed(2)}%;--flame-delay:-${flameDelay}ms`;
    }

    function renderWaitingRoomScene() {
        const currentRoom = getRoom();
        const currentRoomId = getRoomId();
        const myId = getPlayerId();
        const waiting = getWaitingRoomState();
        if (!waiting || !documentRef?.body?.classList.contains('is-waiting-room-view')) {
            waitingSeatVisualRoomId = null;
            waitingSeatVisualSnapshot = new Map();
            clearVisualTimers();
            return;
        }
        if (waitingSeatVisualRoomId !== currentRoomId) {
            waitingSeatVisualRoomId = currentRoomId;
            waitingSeatVisualSnapshot = new Map();
            clearVisualTimers();
        }
        const meta = getGamePresentation(currentRoom.gameType) || { symbol: '◇', tone: 'default', title: currentRoom.gameName };
        const capacity = Math.max(1, waiting.targetPlayers);
        const playerBySeat = new Map();
        waiting.players.forEach((player, fallbackIndex) => {
            let seatIndex = Number(player.seatIndex);
            if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= capacity || playerBySeat.has(seatIndex)) {
                seatIndex = fallbackIndex;
                while (seatIndex < capacity && playerBySeat.has(seatIndex)) seatIndex += 1;
            }
            if (seatIndex < capacity) playerBySeat.set(seatIndex, player);
        });
        const previousSeats = waitingSeatVisualSnapshot;
        const nextSeats = new Map();
        const myPlayer = waiting.players.find(player => player.id === myId);
        const mySeatIndex = [...playerBySeat.entries()].find(([, player]) => player.id === myPlayer?.id)?.[0] ?? 0;
        const presetLayout = ['werewolf', 'avalon'].includes(currentRoom.gameType);
        const seats = Array.from({ length: capacity }, (_, seatIndex) => {
            const player = playerBySeat.get(seatIndex);
            const previous = previousSeats.get(seatIndex);
            const leaving = !player && previous?.player;
            const visualPlayer = player || (leaving ? previous.player : null);
            const occupied = Boolean(visualPlayer);
            const playerChanged = Boolean(player && player.id !== previous?.player?.id);
            const becameReady = Boolean(
                player
                && player.id !== currentRoom.hostId
                && player.ready === true
                && previous?.player?.id === player.id
                && previous.player.ready !== true,
            );
            if (playerChanged || becameReady) {
                const roomIdAtIgnite = currentRoomId;
                waitingSeatIgniteUntil.set(seatIndex, Date.now() + 840);
                windowRef.clearTimeout(waitingSeatIgniteTimers.get(seatIndex));
                waitingSeatIgniteTimers.set(seatIndex, windowRef.setTimeout(() => {
                    waitingSeatIgniteTimers.delete(seatIndex);
                    waitingSeatIgniteUntil.delete(seatIndex);
                    if (getRoomId() === roomIdAtIgnite && getRoom()?.players?.some(item => Number(item.seatIndex) === seatIndex)) renderWaitingRoomScene();
                }, 850));
            }
            const isIgniting = Boolean(player && ((waitingSeatIgniteUntil.get(seatIndex) || 0) > Date.now()));
            const isExtinguishing = Boolean(leaving);
            const seatLabel = isExtinguishing ? '已离开' : visualPlayer?.id === currentRoom.hostId ? '房主' : visualPlayer?.id === myId ? '我的位置' : occupied ? '已入座' : '等待玩家';
            const readyLabel = occupied && !isExtinguishing && visualPlayer.id !== currentRoom.hostId ? (visualPlayer.isOnline === false ? '已断线' : visualPlayer.ready ? '已准备' : '未准备') : '';
            const seatName = occupied ? escapeHtml(visualPlayer.name) : `${seatIndex + 1} 号空位`;
            const seatAriaLabel = occupied ? `${escapeHtml(visualPlayer.name)}，${seatLabel}${readyLabel ? `，${readyLabel}` : ''}` : `${seatIndex + 1} 号空位，等待玩家`;
            if (player) nextSeats.set(seatIndex, { player });
            else {
                waitingSeatIgniteUntil.delete(seatIndex);
                windowRef.clearTimeout(waitingSeatIgniteTimers.get(seatIndex));
                waitingSeatIgniteTimers.delete(seatIndex);
            }
            if (isExtinguishing && !waitingSeatExtinguishTimers.has(seatIndex)) {
                const roomIdAtRender = currentRoomId;
                const timer = windowRef.setTimeout(() => {
                    waitingSeatExtinguishTimers.delete(seatIndex);
                    const currentPlayer = getRoom()?.players?.some(item => Number(item.seatIndex) === seatIndex);
                    if (getRoomId() === roomIdAtRender && !currentPlayer) renderWaitingRoomScene();
                }, 720);
                waitingSeatExtinguishTimers.set(seatIndex, timer);
            }
            const seatClasses = [
                'pregame-seat', occupied ? 'is-occupied' : 'is-empty',
                visualPlayer?.id === myId ? 'is-me' : '',
                visualPlayer?.id === currentRoom.hostId ? 'is-host' : '',
                visualPlayer && visualPlayer.id !== currentRoom.hostId && visualPlayer.ready !== true ? 'is-not-ready' : '',
                isIgniting ? 'is-igniting' : '',
                isExtinguishing ? 'is-extinguishing' : '',
            ].filter(Boolean).join(' ');
            return `<article class="${seatClasses}" style="${waitingSeatStyle(seatIndex, capacity, mySeatIndex)}" data-seat-index="${seatIndex}" aria-label="${seatAriaLabel}"><span class="pregame-chair" aria-hidden="true"></span><span class="pregame-seat-fire" aria-hidden="true"><i class="pregame-fire-glow"></i><i class="pregame-fire-flame"></i><i class="pregame-fire-core"></i></span><span class="pregame-seat-copy"><strong>${seatName}</strong><small>${seatLabel}${readyLabel ? ` · ${readyLabel}` : ''}</small></span><b>${String(seatIndex + 1).padStart(2, '0')}</b></article>`;
        }).join('');
        waitingSeatVisualSnapshot = nextSeats;
        const preloadLabel = waiting.preload.status === 'ready' ? '游戏资源已准备' : waiting.preload.status === 'error' ? '资源准备失败' : '正在准备游戏资源';
        const preloadAction = waiting.preload.status === 'error' ? '<button class="pregame-retry" data-retry-preload type="button">重新加载</button>' : `<i class="pregame-load-dot ${waiting.preload.status === 'ready' ? 'is-ready' : ''}"></i>`;
        const tableAction = waitingRoomMagicMarkup(waiting);
        const startGuidance = waitingRoomStartGuidanceMarkup(waiting);
        const gameCovers = getGameCovers();
        const bggArt = getBggArt();
        const art = gameCovers[currentRoom.gameType] || bggArt[currentRoom.gameType] || '';
        const roomSettingsMarkup = waitingRoomConfigurationMarkup(waiting) || waitingRoomToolsMarkup(waiting);
        mount.innerHTML = `<section class="pregame-room tone-${meta.tone || 'default'} ${presetLayout ? 'is-preset-layout' : ''}" data-game-type="${escapeHtml(currentRoom.gameType)}" style="--pregame-art:url('${escapeHtml(art)}')"><div class="pregame-backdrop" aria-hidden="true"></div><header class="pregame-room-meta"><div><span>${meta.english || currentRoom.gameType.toUpperCase()}</span><h1>${escapeHtml(currentRoom.roomName || meta.title || currentRoom.gameName)}</h1></div><div><span>${currentRoom.isPublic === false ? '仅凭邀请' : '公开房间'}</span><strong>${escapeHtml(currentRoom.id)}</strong></div></header><main class="pregame-stage" data-seat-count="${capacity}"><div class="pregame-table" aria-label="${escapeHtml(meta.title || currentRoom.gameName)}等待牌桌"><div class="pregame-table-action">${tableAction}</div></div><div class="pregame-seats">${seats}</div></main>${startGuidance}<footer class="pregame-room-footer"><div class="pregame-resource-state">${preloadAction}<span>${preloadLabel}<small>${waiting.preload.status === 'ready' ? '开局后无需再次下载核心界面' : waiting.preload.error || '只加载当前这款游戏'}</small></span></div><div><span>${waiting.players.length} / ${waiting.targetPlayers} 已入座</span><button type="button" data-copy-room-code>复制房间号</button></div></footer>${roomSettingsMarkup}</section>`;
    }

    function scheduleRender() {
        if (!documentRef?.body?.classList.contains('is-waiting-room-view')) return;
        if (waitingRoomResizeFrame) windowRef.cancelAnimationFrame(waitingRoomResizeFrame);
        waitingRoomResizeFrame = windowRef.requestAnimationFrame(() => {
            waitingRoomResizeFrame = null;
            renderWaitingRoomScene();
        });
    }

    function renderPanel() {
        if (currentRoomPanel) currentRoomPanel.style.display = 'none';
        if (startGameBtn) startGameBtn.style.display = 'none';
        if (lobbyStartGameBtn) lobbyStartGameBtn.style.display = 'none';
        renderWaitingRoomScene();
    }

    return {
        getState: getWaitingRoomState,
        render: renderWaitingRoomScene,
        renderPanel,
        scheduleRender,
        getSeatVisualSlot: waitingSeatVisualSlot,
        reset: clearVisualTimers,
    };
}
