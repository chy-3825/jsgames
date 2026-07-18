const ROLE_NAMES = {
    duke: '公爵',
    assassin: '刺客',
    captain: '船长',
    ambassador: '大使',
    contessa: '伯爵夫人',
};

const ROLE_VALUES = {
    duke: '3',
    assassin: '3',
    captain: '2',
    ambassador: '2',
    contessa: '1',
};

const ROLE_EFFECTS = {
    duke: '拿 3 枚硬币；可阻挡外援。',
    assassin: '花 3 枚硬币暗杀一名玩家。',
    captain: '偷取目标 2 枚硬币；可阻挡偷窃。',
    ambassador: '与牌库交换角色；可阻挡偷窃。',
    contessa: '阻挡刺客的暗杀。',
};

const ACTIONS = [
    { id: 'income', name: '收入', desc: '+1 硬币' },
    { id: 'foreign_aid', name: '外援', desc: '+2 硬币，可被公爵阻挡' },
    { id: 'coup', name: '政变', desc: '花 7 枚硬币让目标失去一张牌', needCoins: 7, needsTarget: true },
    { id: 'tax', name: '征税', desc: '声称公爵，拿 3 枚硬币' },
    { id: 'steal', name: '偷窃', desc: '声称船长，偷目标 2 枚硬币', needsTarget: true },
    { id: 'assassinate', name: '暗杀', desc: '声称刺客，花 3 枚硬币让目标失去一张牌', needCoins: 3, needsTarget: true },
    { id: 'exchange', name: '交换', desc: '声称大使，与牌库交换角色' },
];

export function createGameClient({ mount, send: lobbySend, addLog: lobbyAddLog }) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/games/coup/style.css?v=' + Date.now();
    document.head.appendChild(link);

    mount.innerHTML = `
        <div id="coupApp" class="coup-app">
            <header class="game-header">
                <div class="header-center">
                    <span class="room-id"><span id="roomDisplay">政变</span></span>
                    <span class="turn-display"><span id="turnDisplay">等待开始</span></span>
                </div>
                <div class="header-right">
                    <span id="statusDot" class="status-dot connected"></span>
                    <span id="statusText" class="status-text">已连接</span>
                </div>
            </header>
            <main class="game-table" id="gameTable">
                <div class="top-row" id="topPlayers"></div>
                <div class="middle-layout">
                    <div class="side-column" id="leftPlayers"></div>
                    <div class="center-stage" id="centerStage">
                        <div class="action-log" id="actionLog">
                            <span id="logText">等待游戏开始...</span>
                            <span id="challengeArea" class="challenge-buttons"></span>
                        </div>
                        <div class="game-over-overlay" id="gameOverOverlay" style="display:none;">
                            <div class="game-over-content">
                                <h2 id="winnerText">游戏结束</h2>
                                <button class="btn btn-primary" id="backToLobbyBtn" type="button">返回大厅</button>
                            </div>
                        </div>
                    </div>
                    <div class="side-column" id="rightPlayers"></div>
                </div>
                <div class="self-zone" id="selfArea"></div>
            </main>
            <div id="modalContainer"></div>
        </div>
    `;

    const $ = id => mount.querySelector('#' + id);
    const roomDisplay = $('roomDisplay');
    const turnDisplay = $('turnDisplay');
    const statusDot = $('statusDot');
    const statusText = $('statusText');
    const logText = $('logText');
    const challengeArea = $('challengeArea');
    const gameOverOverlay = $('gameOverOverlay');
    const winnerText = $('winnerText');
    const backToLobbyBtn = $('backToLobbyBtn');
    const topPlayers = $('topPlayers');
    const leftPlayers = $('leftPlayers');
    const rightPlayers = $('rightPlayers');
    const selfArea = $('selfArea');
    const modalContainer = $('modalContainer');

    let currentState = null;
    let myId = null;
    let roomId = null;
    let pendingAction = null;

    function send(payload) {
        lobbySend(payload);
    }

    function handleMessage(data) {
        if (data.state) {
            currentState = data.state;
            myId = data.state.myId || data.playerId || myId;
            roomId = data.roomId || data.state.roomId || roomId;
            renderAll();
        }
        if (data.roomId && !roomId) roomId = data.roomId;
        if (data.type === 'gameEnded') showGameOver(data.winner?.name || currentState?.winner?.name || '无人');
        if (data.type === 'error') {
            if (!data.state && currentState) renderAll();
            addLog(data.message || '操作失败', 'error');
        }
        if (data.message && data.type !== 'error') addLog(data.message, 'info');
    }

    function renderAll() {
        if (!currentState) return;
        renderHeader();
        renderPlayers();
        renderSelf();
        renderCenter();
    }

    function renderHeader() {
        roomDisplay.textContent = roomId ? `政变-${roomId}` : '政变';
        const current = getPlayer(currentState.currentTurn);
        turnDisplay.textContent = currentState.gameOver ? '游戏结束' : current ? `当前：${current.name}` : '等待开始';
    }

    function renderPlayers() {
        const others = (currentState.players || []).filter(player => player.id !== myId);
        topPlayers.innerHTML = '';
        leftPlayers.innerHTML = '';
        rightPlayers.innerHTML = '';
        others.forEach((player, index) => {
            const bucket = index % 3 === 0 ? topPlayers : index % 3 === 1 ? leftPlayers : rightPlayers;
            bucket.insertAdjacentHTML('beforeend', renderPlayerUnit(player, bucket !== topPlayers));
        });
        mount.querySelectorAll('[data-coup-target-id]').forEach(card => {
            card.addEventListener('click', () => selectTarget(card.dataset.coupTargetId));
        });
    }

    function renderPlayerUnit(player, isSide) {
        const alive = player.isAlive !== false;
        const cards = player.influences || Array.from({ length: player.influenceCount || 0 }, () => ({ role: null, revealed: false }));
        return `
            <div class="${isSide ? 'influence-pair' : 'opponent-unit'} ${alive ? '' : 'is-out'}">
                <div class="opponent-name">${escapeHtml(player.name)} ${alive ? `硬币 ${player.coins ?? 0}` : '出局'}</div>
                <div class="dual-cards">
                    ${cards.map((card, index) => renderInfluenceCard(card, {
                        targetId: canTarget(player, card) ? player.id : null,
                        turn: index === 0 && currentState.currentTurn === player.id && alive,
                        lost: card.revealed === true,
                    })).join('')}
                </div>
            </div>
        `;
    }

    function renderSelf() {
        const self = getPlayer(myId);
        if (!self) {
            selfArea.innerHTML = '<div class="self-info">等待玩家数据...</div>';
            return;
        }
        const alive = self.isAlive !== false;
        const coins = self.coins || 0;
        const cards = self.influences || [];
        selfArea.innerHTML = `
            <div class="self-left">
                <div class="self-info">硬币 ${coins}${isMyTurn() ? ' / 我的回合' : ''}</div>
                <div class="self-hand">
                    ${cards.map((card, index) => renderInfluenceCard(card, {
                        turn: index === 0 && isMyTurn() && alive,
                        lost: card.revealed === true,
                    })).join('') || '<div class="self-info">暂无手牌</div>'}
                </div>
            </div>
            <div class="self-right">
                ${renderActionRows(self, alive)}
            </div>
        `;
        selfArea.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', () => handleAction(button.dataset.action));
        });
    }

    function renderActionRows(self, alive) {
        const rows = [ACTIONS.slice(0, 4), ACTIONS.slice(4)];
        return rows.map(row => `
            <div class="action-row">
                ${row.map(action => renderActionButton(action, self, alive)).join('')}
            </div>
        `).join('');
    }

    function renderActionButton(action, self, alive) {
        let disabled = !alive || !isMyTurn() || currentState.gameOver || currentState.challenge;
        let title = action.desc;
        if (!disabled && self.coins >= 10 && action.id !== 'coup') {
            disabled = true;
            title = '拥有 10 枚或更多硬币时必须政变';
        }
        if (!disabled && action.needCoins && self.coins < action.needCoins) {
            disabled = true;
            title = `需要 ${action.needCoins} 枚硬币`;
        }
        return `<button class="btn" type="button" data-action="${action.id}" title="${escapeAttr(title)}" ${disabled ? 'disabled' : ''}>${escapeHtml(action.name)}</button>`;
    }

    function renderInfluenceCard(card, options = {}) {
        const role = card?.role || null;
        const lost = options.lost || card?.revealed === true;
        const face = Boolean(role && (!lost || card?.revealed));
        const classes = ['card-back', face ? 'is-face' : '', lost ? 'lost' : '', options.targetId ? 'clickable' : ''].filter(Boolean).join(' ');
        const attrs = [
            options.targetId ? `data-coup-target-id="${escapeAttr(options.targetId)}"` : '',
            role ? `title="${escapeAttr(`${ROLE_NAMES[role] || role}: ${ROLE_EFFECTS[role] || ''}`)}"` : '',
        ].filter(Boolean).join(' ');
        const content = face
            ? `<span class="coup-card-value">${escapeHtml(ROLE_VALUES[role] || '')}</span><strong>${escapeHtml(ROLE_NAMES[role] || role)}</strong><em>${escapeHtml(ROLE_EFFECTS[role] || '')}</em>`
            : '<span class="coup-card-back-mark">COUP</span>';
        return `<div class="${classes}" ${attrs}>${content}${options.turn ? '<span class="turn-tag">行动中</span>' : ''}</div>`;
    }

    function renderCenter() {
        const latest = currentState.actionLog?.[currentState.actionLog.length - 1];
        if (currentState.gameOver) logText.textContent = '游戏结束';
        else if (pendingAction) logText.textContent = `选择${getActionName(pendingAction.kind)}的目标：点击对手背面牌`;
        else logText.textContent = latest || (isMyTurn() ? '请选择行动' : '等待其他玩家行动');
        renderChallenge();
    }

    function renderChallenge() {
        challengeArea.innerHTML = '';
        const challenge = currentState.challenge;
        if (!challenge) return;
        const roleName = ROLE_NAMES[challenge.claimedRole] || challenge.claimedRole || '角色';
        if (challenge.phase === 'block') {
            const requesterName = getPlayer(challenge.responderId)?.name || '玩家';
            if (challenge.isMyTurn) {
                challengeArea.innerHTML = `
                    <button class="btn btn-warning" type="button" data-challenge-action="block">公爵阻挡</button>
                    <button class="btn" type="button" data-challenge-action="pass">无视</button>
                `;
                logText.textContent = requesterName + ' 申请外援，是否用公爵阻挡？';
            } else {
                logText.textContent = '等待 ' + (getPlayer(challenge.currentBlockerId)?.name || '其他玩家') + ' 决定是否阻挡外援';
            }
        }
        if (challenge.phase === 'challenge') {
            if (challenge.isMyTurn) {
                challengeArea.innerHTML = `
                    <button class="btn btn-warning" type="button" data-challenge-action="challenge">质疑 ${escapeHtml(roleName)}</button>
                    <button class="btn" type="button" data-challenge-action="pass">无视</button>
                `;
                logText.textContent = `是否质疑 ${roleName}？`;
            } else {
                logText.textContent = `等待 ${getPlayer(challenge.currentChallengerId)?.name || '其他玩家'} 决定是否质疑`;
            }
        }
        if (challenge.phase === 'respond') {
            if (challenge.isMyTurn) {
                challengeArea.innerHTML = `
                    <button class="btn btn-primary" type="button" data-challenge-action="show">出示 ${escapeHtml(roleName)}</button>
                    <button class="btn btn-warning" type="button" data-challenge-action="cancel">取消</button>
                `;
                logText.textContent = `出示 ${roleName} 证明，或取消？`;
            } else {
                logText.textContent = `等待 ${getPlayer(challenge.responderId)?.name || '玩家'} 回应质疑`;
            }
        }
        challengeArea.querySelectorAll('[data-challenge-action]').forEach(button => {
            button.addEventListener('click', () => {
                send({ type: 'gameAction', action: { kind: button.dataset.challengeAction } });
                challengeArea.innerHTML = '<span class="waiting-msg">等待服务器更新...</span>';
});
        });
    }

    function handleAction(kind) {
        if (!isMyTurn() || currentState.gameOver) return;
        if (['coup', 'assassinate', 'steal'].includes(kind)) {
            pendingAction = { kind };
            renderAll();
            return;
        }
        if (kind === 'exchange') {
            showExchangeModal();
            return;
        }
        send({ type: 'gameAction', action: { kind } });
    }

    function selectTarget(targetId) {
        if (!pendingAction) return;
        send({ type: 'gameAction', action: { kind: pendingAction.kind, targetId } });
        pendingAction = null;
        renderAll();
    }

    function showExchangeModal() {
        modalContainer.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-box">
                    <h3>大使交换</h3>
                    <div class="modal-desc">确认发动交换。该行动会先进入质疑流程，通过后由服务端完成换牌。</div>
                    <div class="modal-cards">
                        ${renderModalRoleCard('ambassador')}
                        <div class="modal-card placeholder">牌库</div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" type="button" data-exchange-confirm>确认</button>
                        <button class="btn" type="button" data-exchange-cancel>取消</button>
                    </div>
                </div>
            </div>
        `;
        modalContainer.querySelector('[data-exchange-confirm]').addEventListener('click', () => {
            closeModal();
            send({ type: 'gameAction', action: { kind: 'exchange' } });
        });
        modalContainer.querySelector('[data-exchange-cancel]').addEventListener('click', closeModal);
    }

    function renderModalRoleCard(role) {
        return `<div class="modal-card"><span>${escapeHtml(ROLE_VALUES[role])}</span><span class="role-label">${escapeHtml(ROLE_NAMES[role])}</span></div>`;
    }

    function closeModal() {
        modalContainer.innerHTML = '';
    }

    function canTarget(player, card) {
        return Boolean(pendingAction && isMyTurn() && player.id !== myId && player.isAlive !== false && card?.revealed !== true);
    }

    function isMyTurn() {
        return Boolean(currentState && currentState.currentTurn === myId);
    }

    function getPlayer(playerId) {
        return (currentState?.players || []).find(player => player.id === playerId) || null;
    }

    function getActionName(kind) {
        return ACTIONS.find(action => action.id === kind)?.name || kind;
    }

    function showGameOver(winnerName) {
        gameOverOverlay.style.display = 'flex';
        winnerText.textContent = `${winnerName} 获胜！`;
    }

    function addLog(message, type = 'info') {
        if (type === 'error') logText.textContent = `错误：${message}`;
        else logText.textContent = message;
        lobbyAddLog?.(message, type);
    }

    function updateStatus(connected, text) {
        statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
        statusText.textContent = text || (connected ? '已连接' : '断开');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }
    backToLobbyBtn?.addEventListener('click', () => addLog('请使用大厅的离开房间按钮返回大厅。', 'system'));
    updateStatus(true, '已连接');

    return {
        gameType: 'coup',
        handleMessage,
        destroy() {
            link.remove();
            mount.innerHTML = '';
        },
    };
}
