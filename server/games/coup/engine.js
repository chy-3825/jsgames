/**
 * 政变 (Coup) 核心游戏引擎
 * 纯规则逻辑，不依赖任何网络或显示层
 * 
 * 设计决策：
 * - 纯PvP，无AI
 * - 2~8人动态人数
 * - 房主先手
 * - 质疑按顺时针轮流，一旦有人质疑则停止询问
 * - 出牌证明后牌弃掉换新，原行动继续（质疑失败时）
 * - 退出即出局
 * - 强制政变（≥10块只能政变）
 * - 不检查角色牌（允许假装）
 */

const ROLE_IDS = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

const ROLE_DISPLAY = {
    duke: '🏦',
    assassin: '🗡️',
    captain: '⚓',
    ambassador: '🎭',
    contessa: '👸'
};

const ROLE_NAMES = {
    duke: '公爵',
    assassin: '刺客',
    captain: '船长',
    ambassador: '大使',
    contessa: '伯爵夫人'
};

// 哪些行动可以被质疑
const CHALLENGEABLE_ACTIONS = ['tax', 'assassinate', 'steal', 'exchange'];

// 哪些行动需要声称角色
const ROLE_CLAIM_ACTIONS = {
    tax: 'duke',
    assassinate: 'assassin',
    steal: 'captain',
    exchange: 'ambassador'
};

class CoupEngine {
    /**
     * @param {string} roomId - 房间ID
     * @param {Array} players - 玩家数组 [{ id, name }, ...]
     * @param {Function} random - 可注入的随机源（测试/回放用）
     */
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map(p => ({
            id: p.id,
            name: p.name,
            coins: 2,
            influences: [],      // 角色ID数组，长度为2
            revealed: [false, false], // 对应influences的揭示状态
            isAlive: true,
            isOnline: true,
        }));
        this.playerMap = {};
        this.players.forEach(p => { this.playerMap[p.id] = p; });

        this.deck = [];
        this.currentTurnIndex = 0;
        this.phase = 'idle'; // idle | challenge | respond | block | influence_loss | exchange | ended
        this.pendingAction = null; // { kind, targetId, claimedRole }
        this.pendingInfluenceLoss = null;
        this.pendingExchange = null;
        this.challengeQueue = []; // 质疑顺序（玩家ID数组）
        this.challengeIndex = 0;
        this.challengerId = null; // 谁发起了质疑
        this.responderId = null;  // 谁需要回应质疑
        this.claimedRole = null;  // 声称的角色ID
        this.winner = null;
        this.gameOver = false;
        this.turnHistory = [];
        this.actionLog = [];
        this.actionSequence = 0;
        this.revealSequence = 0;
        this.interaction = null;
        this.lastReveal = null;

        // 初始化牌堆
        this._initDeck();
        // 发牌
        this._dealCards();
        // 设置起始玩家（房主先手）
        this.currentTurnIndex = 0;
    }

    // ==================== 初始化 ====================

    _initDeck() {
        // The base game has exactly three copies of each of its five roles.
        // It is tempting to pad the deck for larger rooms, but doing so makes
        // claims statistically and mechanically different from Coup.  The
        // session therefore caps the base rules at six players.
        this.deck = ROLE_IDS.flatMap(id => [id, id, id]);
        this._shuffleDeck();
    }

    _shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    _dealCards() {
        // 每人发2张
        for (let i = 0; i < this.players.length; i++) {
            const cards = this._drawCards(2);
            this.players[i].influences = cards;
            this.players[i].revealed = [false, false];
            this.players[i].isAlive = true;
        }
    }

    _drawCards(count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) break;
            drawn.push(this.deck.pop());
        }
        return drawn;
    }

    _reshuffleDeck() {
        // Revealed influence is permanently out of the court deck.  Kept as a
        // no-op for compatibility with older callers; exchange cards are
        // returned explicitly through _returnToDeck instead.
        return this.deck;
    }

    _returnToDeck(cards) {
        this.deck.push(...cards);
        this._shuffleDeck();
    }

    // ==================== 工具方法 ====================

    _getPlayer(playerId) {
        return this.playerMap[playerId] || null;
    }

    _getPlayerIndex(playerId) {
        return this.players.findIndex(p => p.id === playerId);
    }

    _getAlivePlayers() {
        return this.players.filter(p => p.isAlive && p.isOnline);
    }

    _getAlivePlayerIds() {
        return this._getAlivePlayers().map(p => p.id);
    }

    _getAliveOpponentIds(playerId) {
        return this._getAlivePlayers()
            .filter(p => p.id !== playerId)
            .map(p => p.id);
    }

    _getActiveInfluenceCount(player) {
        return player.influences.filter((_, idx) => !player.revealed[idx]).length;
    }

    _isAlive(player) {
        return player.isAlive && player.isOnline && this._getActiveInfluenceCount(player) > 0;
    }

    _getNextTurnIndex(currentIdx) {
        let next = (currentIdx + 1) % this.players.length;
        let attempts = 0;
        while (!this._isAlive(this.players[next]) && attempts < this.players.length) {
            next = (next + 1) % this.players.length;
            attempts++;
        }
        return attempts >= this.players.length ? -1 : next;
    }

    _getNextPlayerId(currentIdx) {
        const idx = this._getNextTurnIndex(currentIdx);
        return idx === -1 ? null : this.players[idx].id;
    }

    // ==================== 核心方法：启动 ====================

    start() {
        if (this.players.length < 2 || this.players.length > 6) return { success: false, message: '基础政变支持 2–6 名玩家' };
        // 起始玩家为房主（索引0）
        this.currentTurnIndex = 0;
        this.phase = 'idle';
        this.gameOver = false;
        this.winner = null;
        this.interaction = null;
        this.lastReveal = null;
        this.actionLog = ['游戏开始！'];
        return {
            success: true,
            message: '游戏已开始',
            state: this._getPublicState()
        };
    }

    // ==================== 处理玩家操作 ====================

    /**
     * 处理玩家操作
     * @param {string} playerId - 玩家ID
     * @param {object} action - 操作对象
     * @returns {object} { success, message, state }
     */
    handleAction(playerId, action) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束' };
        }

        const player = this._getPlayer(playerId);
        if (!player || !this._isAlive(player)) {
            return { success: false, message: '玩家不存在或已出局' };
        }

        if (this.phase === 'influence_loss') {
            return this._handleInfluenceLoss(playerId, action);
        }
        if (this.phase === 'exchange') {
            return this._handleExchangeAction(playerId, action);
        }

        // 验证是否为当前回合玩家
        switch (this.phase) {
            case 'idle': {
                const currentPlayer = this.players[this.currentTurnIndex];
                if (currentPlayer.id !== playerId) {
                    return { success: false, message: '还没轮到你的回合' };
                }
                return this._handleIdleAction(player, action);
            }
            case 'challenge':
                return this._handleChallengeResponse(playerId, action);
            case 'respond':
                return this._handleRespondAction(playerId, action);
            case 'block':
                return this._handleBlockResponse(playerId, action);
            default:
                return { success: false, message: '当前阶段无法操作' };
        }
    }

    // ==================== 阶段处理：IDLE（选择行动） ====================

    _handleIdleAction(player, action) {
        const { kind } = action;

        // 强制政变检测：玩家≥10块只能政变
        if (player.coins >= 10 && kind !== 'coup') {
            return { success: false, message: '你拥有10枚或更多硬币，必须发动政变！' };
        }

        switch (kind) {
            case 'income':
                return this._actionIncome(player);
            case 'foreign_aid':
                return this._actionForeignAid(player);
            case 'tax':
                return this._actionTax(player);
            case 'coup':
                return this._actionCoup(player, action.targetId);
            case 'assassinate':
                return this._actionAssassinate(player, action.targetId);
            case 'steal':
                return this._actionSteal(player, action.targetId);
            case 'exchange':
                return this._actionExchange(player);
            default:
                return { success: false, message: '未知行动' };
        }
    }

    // ----- 基础行动 -----

    _beginInteraction(player, kind, targetId = null, claimedRole = null) {
        this.interaction = {
            actionId: ++this.actionSequence,
            kind,
            actorId: player.id,
            targetId: targetId || null,
            claimedRole: claimedRole || null,
            stage: 'declared',
            challengerId: null,
            blockerId: null,
            blockRole: null,
            verdict: null,
            outcome: null,
        };
        return this.interaction;
    }

    _updateInteraction(fields = {}) {
        if (this.interaction) Object.assign(this.interaction, fields);
        return this.interaction;
    }

    _recordReveal(player, roles, reason) {
        const revealedRoles = (Array.isArray(roles) ? roles : [roles]).filter(Boolean);
        this.lastReveal = {
            revealId: ++this.revealSequence,
            actionId: this.interaction?.actionId || null,
            playerId: player.id,
            roles: revealedRoles,
            role: revealedRoles[revealedRoles.length - 1] || null,
            reason: reason || null,
            eliminated: !this._isAlive(player),
        };
        this._updateInteraction({ lastRevealId: this.lastReveal.revealId });
    }

    _actionIncome(player) {
        this._beginInteraction(player, 'income');
        player.coins += 1;
        this.actionLog.push(`${player.name} 收入 +1💰`);
        this._updateInteraction({ stage: 'resolved', outcome: 'income' });
        this._endTurn();
        return {
            success: true,
            message: `${player.name} 收入 1 硬币`,
            state: this._getPublicState()
        };
    }

    _actionForeignAid(player) {
        this._beginInteraction(player, 'foreign_aid');
        this.pendingAction = {
            kind: 'foreign_aid',
            playerId: player.id,
            claimedRole: null,
            targetId: null,
        };
        this.responderId = player.id;

        const startIdx = (this.currentTurnIndex + 1) % this.players.length;
        this.challengeQueue = [];
        for (let i = 0; i < this.players.length; i++) {
            const idx = (startIdx + i) % this.players.length;
            const p = this.players[idx];
            if (this._isAlive(p) && p.id !== player.id) {
                this.challengeQueue.push(p.id);
            }
        }
        this.challengeIndex = 0;

        if (this.challengeQueue.length === 0) {
            return this._executePendingAction();
        }

        this.phase = 'block';
        this._updateInteraction({ stage: 'block_offer', blockRole: 'duke' });
        this.actionLog.push(player.name + ' 申请外援，等待公爵阻挡...');
        return {
            success: true,
            message: player.name + ' 申请外援，请其他玩家决定是否用公爵阻挡',
            state: this._getPublicState()
        };
    }

    _actionTax(player) {
        const claimedRole = 'duke';
        return this._startChallengePhase(player, 'tax', null, claimedRole);
    }

    _actionAssassinate(player, targetId) {
        if (player.coins < 3) {
            return { success: false, message: '暗杀需要3枚硬币' };
        }
        const target = this._getPlayer(targetId);
        if (!target || !this._isAlive(target)) {
            return { success: false, message: '目标玩家不存在或已出局' };
        }
        if (target.id === player.id) {
            return { success: false, message: '不能暗杀自己' };
        }
        // The 3-coin assassination fee is paid when the action is announced,
        // before any challenge or block is resolved.
        player.coins -= 3;
        const claimedRole = 'assassin';
        return this._startChallengePhase(player, 'assassinate', targetId, claimedRole);
    }

    _actionSteal(player, targetId) {
        const target = this._getPlayer(targetId);
        if (!target || !this._isAlive(target)) {
            return { success: false, message: '目标玩家不存在或已出局' };
        }
        if (target.id === player.id) {
            return { success: false, message: '不能偷自己' };
        }
        const claimedRole = 'captain';
        return this._startChallengePhase(player, 'steal', targetId, claimedRole);
    }

    _actionExchange(player) {
        const claimedRole = 'ambassador';
        return this._startChallengePhase(player, 'exchange', null, claimedRole);
    }

    // ----- 政变（不可被质疑） -----

    _actionCoup(player, targetId) {
        if (player.coins < 7) {
            return { success: false, message: '政变需要7枚硬币' };
        }
        const target = this._getPlayer(targetId);
        if (!target || !this._isAlive(target)) {
            return { success: false, message: '目标玩家不存在或已出局' };
        }
        if (target.id === player.id) {
            return { success: false, message: '不能政变自己' };
        }

        // 执行政变。失去哪一张影响力必须由目标玩家自己选择。
        this._beginInteraction(player, 'coup', target.id);
        player.coins -= 7;
        this.actionLog.push(`${player.name} 政变 ${target.name}，等待对方选择失去的影响力`);
        this.pendingInfluenceLoss = { playerId: target.id, reason: 'coup', continuation: 'coup', actorId: player.id };
        this.phase = 'influence_loss';
        this._updateInteraction({ stage: 'influence_loss', lossPlayerId: target.id, lossReason: 'coup' });
        return {
            success: true,
            message: `${player.name} 政变 ${target.name}，请目标选择要揭示的影响力`,
            state: this._getPublicState()
        };
    }

    _handleInfluenceLoss(playerId, action = {}) {
        const pending = this.pendingInfluenceLoss;
        if (!pending || pending.playerId !== playerId) return { success: false, message: '请等待目标玩家选择影响力' };
        const index = Number(action.influenceIndex);
        const player = this._getPlayer(playerId);
        if (action.kind !== 'influence_loss' || !Number.isInteger(index) || index < 0 || index >= player.influences.length || player.revealed[index]) {
            return { success: false, message: '请选择一张仍在生效的影响力', state: this.getPlayerState(playerId) };
        }
        const revealedRole = player.influences[index];
        player.revealed[index] = true;
        this.pendingInfluenceLoss = null;
        this.actionLog.push(`${player.name} 选择揭示第 ${index + 1} 张影响力`);
        this._checkPlayerDeath(player);
        this._recordReveal(player, revealedRole, pending.reason);

        if (this.gameOver) {
            this._updateInteraction({ stage: 'resolved', outcome: 'game_over', lossPlayerId: player.id });
            return { success: true, message: `${player.name} 已选择失去一张影响力`, state: this._getPublicState(), ended: true, winner: this.getWinner() };
        }

        if (pending.continuation === 'challenge_failed') {
            this.phase = 'idle';
            const challengedAction = this.pendingAction;
            let result;
            if (challengedAction?.targetId === player.id && !this._isAlive(player)) {
                this.pendingAction = null;
                this._updateInteraction({ stage: 'resolved', outcome: 'target_eliminated', lossPlayerId: player.id });
                this._endTurn();
                result = { success: true, message: `${player.name} 已在质疑中出局，原行动无需继续结算`, state: this._getPublicState() };
            } else {
                // 质疑失败只证明了原声明；暗杀和偷窃仍应给目标保留阻挡窗口。
                result = this._afterChallenges();
            }
            return {
                ...result,
                success: true,
                message: `${player.name} 已选择失去一张影响力，质疑失败的行动继续`,
                state: result.state || this._getPublicState(),
                ended: this.gameOver,
                winner: this.getWinner(),
            };
        }

        if (pending.continuation === 'block_challenge_success') {
            this.phase = 'idle';
            const blockedAction = this.pendingAction?.blockedAction;
            this.pendingAction = blockedAction ? { ...blockedAction } : null;
            const result = this.pendingAction ? this._executePendingAction() : { success: true, message: '外援被阻挡' };
            return {
                ...result,
                success: true,
                message: `${player.name} 已选择失去一张影响力，质疑成功`,
                state: result.state || this._getPublicState(),
                ended: this.gameOver,
                winner: this.getWinner(),
            };
        }

        if (pending.continuation === 'challenge_success') {
            this.pendingAction = null;
            this.phase = 'idle';
            this.actionLog.push('质疑成功，原行动取消');
            this._updateInteraction({ stage: 'cancelled', outcome: 'claim_failed', lossPlayerId: player.id });
            this._endTurn();
            return { success: true, message: `${player.name} 已选择失去一张影响力，原行动取消`, state: this._getPublicState(), ended: this.gameOver, winner: this.getWinner() };
        }

        this._updateInteraction({ stage: 'resolved', outcome: pending.reason, lossPlayerId: player.id });
        this._endTurn();
        return { success: true, message: `${player.name} 已选择失去一张影响力`, state: this._getPublicState(), ended: this.gameOver, winner: this.getWinner() };
    }

    _handleExchangeAction(playerId, action = {}) {
        const pending = this.pendingExchange;
        if (!pending || pending.playerId !== playerId) return { success: false, message: '请等待大使交换完成' };
        if (action.kind !== 'exchangeSelect' || !Array.isArray(action.keepIndices)) return { success: false, message: '请选择要保留的影响力', state: this.getPlayerState(playerId) };
        const player = this._getPlayer(playerId);
        const activeIndexes = player.influences.map((role, index) => (!player.revealed[index] ? index : -1)).filter(index => index >= 0);
        const options = [...activeIndexes.map(index => ({ source: 'hand', index, role: player.influences[index] })), ...pending.drawn.map((role, index) => ({ source: 'drawn', index, role }))];
        const keep = action.keepIndices.map(index => Number(index));
        if (keep.length !== activeIndexes.length || new Set(keep).size !== keep.length || keep.some(index => !Number.isInteger(index) || !options[index])) return { success: false, message: `请选择恰好 ${activeIndexes.length} 张影响力`, state: this.getPlayerState(playerId) };
        const keptRoles = keep.map(index => options[index].role);
        const returned = options.filter((_, index) => !keep.includes(index)).map(item => item.role);
        activeIndexes.forEach((slot, index) => { player.influences[slot] = keptRoles[index]; player.revealed[slot] = false; });
        this._returnToDeck(returned);
        this.pendingExchange = null;
        this.actionLog.push(`${player.name} 完成大使交换`);
        this._updateInteraction({ stage: 'resolved', outcome: 'exchange' });
        this._endTurn();
        return { success: true, message: `${player.name} 完成交换`, state: this._getPublicState() };
    }

    _requestInfluenceLoss(player, reason, continuation) {
        if (!player || !this._isAlive(player)) {
            return { success: false, message: '该玩家已经没有可失去的影响力' };
        }
        this.pendingInfluenceLoss = { playerId: player.id, reason, continuation };
        this.phase = 'influence_loss';
        this._updateInteraction({ stage: 'influence_loss', lossPlayerId: player.id, lossReason: reason });
        return {
            success: true,
            message: `${player.name} 请选择要失去的影响力`,
            state: this._getPublicState(),
        };
    }

    // ==================== 质疑阶段 ====================

    _startChallengePhase(player, actionKind, targetId, claimedRole) {
        this._beginInteraction(player, actionKind, targetId, claimedRole);
        // 保存待执行的行动
        this.pendingAction = {
            kind: actionKind,
            targetId: targetId,
            claimedRole: claimedRole,
            playerId: player.id,
        };
        this.claimedRole = claimedRole;
        this.responderId = player.id;

        // 构建质疑队列：从下家开始顺时针
        const startIdx = (this.currentTurnIndex + 1) % this.players.length;
        this.challengeQueue = [];
        for (let i = 0; i < this.players.length; i++) {
            const idx = (startIdx + i) % this.players.length;
            const p = this.players[idx];
            if (this._isAlive(p) && p.id !== player.id) {
                this.challengeQueue.push(p.id);
            }
        }
        this.challengeIndex = 0;

        if (this.challengeQueue.length === 0) return this._afterChallenges();

        this.phase = 'challenge';
        this._updateInteraction({ stage: 'challenge' });
        this.actionLog.push(`${player.name} 声称 ${ROLE_NAMES[claimedRole]}，等待质疑...`);

        return {
            success: true,
            message: `${player.name} 声称 ${ROLE_NAMES[claimedRole]}，请其他玩家决定是否质疑`,
            state: this._getPublicState(),
            challenge: {
                phase: 'challenge',
                currentChallengerId: this.challengeQueue[0],
                responderId: player.id,
                claimedRole: claimedRole,
                actionKind: actionKind,
            }
        };
    }

    _blockRoleForAction(action) {
        if (!action) return null;
        if (action.kind === 'foreign_aid') return 'duke';
        if (action.kind === 'assassinate') return 'contessa';
        if (action.kind === 'steal') return 'captain_or_ambassador';
        return null;
    }

    _afterChallenges() {
        const action = this.pendingAction;
        if (!action) return { success: false, message: '没有待执行的行动' };
        const blockerRole = this._blockRoleForAction(action);
        if (blockerRole) {
            const target = this._getPlayer(action.targetId);
            if (target && this._isAlive(target)) {
                this.phase = 'block'; this.claimedRole = blockerRole; this.challengeQueue = [target.id]; this.challengeIndex = 0; this.responderId = target.id;
                this._updateInteraction({ stage: 'block_offer', blockRole: blockerRole });
                this.actionLog.push(`${target.name} 可以用${blockerRole === 'contessa' ? '伯爵夫人' : '船长或大使'}阻挡 ${this._getPlayer(action.playerId)?.name || '玩家'} 的${action.kind === 'assassinate' ? '暗杀' : '偷窃'}`);
                return { success: true, message: '等待目标决定是否阻挡', state: this._getPublicState() };
            }
        }
        return this._executePendingAction();
    }

    _handleBlockResponse(playerId, action) {
        const kind = action.kind;
        const currentBlockerId = this.challengeQueue[this.challengeIndex] || null;

        if (playerId !== currentBlockerId) {
            return { success: false, message: '还没轮到你决定是否阻挡' };
        }

        const blocker = this._getPlayer(playerId);
        const pending = this.pendingAction;
        const requester = this._getPlayer(pending && pending.playerId);

        if (kind === 'pass') {
            this.challengeIndex++;
            this.actionLog.push(`${blocker.name} 选择不阻挡`);

            if (this.challengeIndex >= this.challengeQueue.length) {
                this.actionLog.push('无人阻挡，行动继续');
                return this._executePendingAction();
            }

            return {
                success: true,
                message: `${blocker.name} 不阻挡`,
                state: this._getPublicState()
            };
        }

        if (kind === 'block') {
            const blockRole = this._blockRoleForAction(pending);
            if (!blockRole) return { success: false, message: '当前行动不能被阻挡' };
            const blockedAction = pending ? { ...pending } : null;
            this.pendingAction = { kind: `block_${pending?.kind || 'action'}`, playerId: blocker.id, claimedRole: blockRole, blockedAction };
            this.claimedRole = blockRole;
            this.responderId = blocker.id;
            this.challengerId = null;
            this.phase = 'challenge';
            this._updateInteraction({ stage: 'block_challenge', blockerId: blocker.id, blockRole });

            const blockerIndex = this._getPlayerIndex(blocker.id);
            const startIdx = (blockerIndex + 1) % this.players.length;
            this.challengeQueue = [];
            for (let i = 0; i < this.players.length; i++) {
                const idx = (startIdx + i) % this.players.length;
                const p = this.players[idx];
                if (this._isAlive(p) && p.id !== blocker.id) {
                    this.challengeQueue.push(p.id);
                }
            }
            this.challengeIndex = 0;

            this.actionLog.push(`${blocker.name} 声称${blockRole === 'duke' ? '公爵' : blockRole === 'contessa' ? '伯爵夫人' : '船长或大使'}，阻挡了${requester ? requester.name : '玩家'}的行动，等待质疑`);

            if (this.challengeQueue.length === 0) {
                return this._executePendingAction();
            }

            return {
                success: true,
                message: `${blocker.name} 声称${blockRole === 'duke' ? '公爵' : blockRole === 'contessa' ? '伯爵夫人' : '船长或大使'}阻挡，请其他玩家决定是否质疑`,
                state: this._getPublicState()
            };
        }

        return { success: false, message: '无效操作，请选择阻挡或无视' };
    }

    _handleChallengeResponse(playerId, action) {
        const { kind } = action;
        const currentChallengerId = this.challengeQueue[this.challengeIndex] || null;

        if (playerId !== currentChallengerId) {
            return { success: false, message: '还没轮到你质疑' };
        }

        if (kind === 'pass') {
            // 无视
            this.challengeIndex++;
            this.actionLog.push(`${this._getPlayer(playerId).name} 选择无视`);

            if (this.challengeIndex >= this.challengeQueue.length) {
                // 所有人都无视，执行原行动
                this.actionLog.push('无人质疑，行动继续');
                return this._afterChallenges();
            } else {
                // 继续询问下一个玩家
                return {
                    success: true,
                    message: `${this._getPlayer(playerId).name} 无视了质疑`,
                    state: this._getPublicState(),
                    challenge: {
                        phase: 'challenge',
                        currentChallengerId: this.challengeQueue[this.challengeIndex],
                        responderId: this.responderId,
                        claimedRole: this.claimedRole,
                        actionKind: this.pendingAction.kind,
                    }
                };
            }
        } else if (kind === 'challenge') {
            // 发起质疑
            this.challengerId = playerId;
            this.phase = 'respond';
            this._updateInteraction({ stage: 'challenged', challengerId: playerId });
            this.actionLog.push(`${this._getPlayer(playerId).name} 发起质疑！`);

            return {
                success: true,
                message: `${this._getPlayer(playerId).name} 质疑了 ${this._getPlayer(this.responderId).name}！`,
                state: this._getPublicState(),
                challenge: {
                    phase: 'respond',
                    responderId: this.responderId,
                    challengerId: playerId,
                    claimedRole: this.claimedRole,
                    actionKind: this.pendingAction.kind,
                }
            };
        } else {
            return { success: false, message: '无效操作，请选择质疑或无视' };
        }
    }

    // ==================== 回应阶段 ====================

    _handleRespondAction(playerId, action) {
        if (playerId !== this.responderId) {
            return { success: false, message: '只有被质疑者需要回应' };
        }

        const { kind } = action;

        if (kind === 'show') {
            // 出示证明：被质疑者展示对应的角色牌
            const player = this._getPlayer(playerId);
            const claimedRole = this.claimedRole;

            // 检查是否有对应的角色牌（未揭示的）
            const claimedRoles = claimedRole === 'captain_or_ambassador' ? ['captain', 'ambassador'] : [claimedRole];
            const shownRole = claimedRole === 'captain_or_ambassador' ? '船长或大使' : ROLE_NAMES[claimedRole];
            const cardIndex = player.influences.findIndex((role, idx) => claimedRoles.includes(role) && !player.revealed[idx]);

            if (cardIndex === -1) {
                // 没有对应的牌，不能出示，只能取消
                return { success: false, message: '你没有对应的角色牌，不能出示，请选择取消', state: this.getPlayerState(playerId) };
            }

            // 出示成功：证明牌回到 Court，再补一张新牌。揭示的影响力
            // 不应进入牌堆，否则每次质疑都会凭空增加牌张。
            player.revealed[cardIndex] = true;
            this._returnToDeck([player.influences[cardIndex]]);
            const newCard = this._drawCards(1)[0] || null;
            if (newCard) {
                player.influences[cardIndex] = newCard;
                player.revealed[cardIndex] = false;
            } else {
                // 牌堆没牌了，该位置保留已揭示状态
                // 但玩家已经失去了这张牌，相当于该位置无法使用
                // 这里需要把该位置标记为失去，但保留角色名以显示
                // 实际上，已揭示的牌已经算失去了
                // 但如果补不到牌，该位置直接变为失去
                player.revealed[cardIndex] = true;
            }

            this.actionLog.push(`${player.name} 出示了 ${shownRole}，质疑失败！`);
            const wasBlockClaim = Boolean(this.pendingAction?.blockedAction);
            this._updateInteraction({
                stage: 'verdict',
                verdict: wasBlockClaim ? 'block_proved' : 'claim_proved',
                provedById: player.id,
                challengerId: this.challengerId,
                provedRole: claimedRole,
            });

            // 质疑失败：质疑者自己选择要失去的影响力。
            const challenger = this._getPlayer(this.challengerId);
            const loss = this._requestInfluenceLoss(challenger, 'challenge_failed', 'challenge_failed');
            return {
                ...loss,
                message: `${player.name} 出示了 ${shownRole}，质疑失败！请 ${challenger.name} 选择失去的影响力`,
            };
        } else if (kind === 'cancel') {
            const player = this._getPlayer(playerId);
            // A successful challenge against any block (Duke, Contessa, or
            // Captain/Ambassador) makes the original action continue.  The
            // previous implementation handled only foreign aid, which
            // silently cancelled challenged assassination and steal blocks.
            const blockedAction = this.pendingAction?.blockedAction || null;
            const wasBlockClaim = Boolean(blockedAction);

            this.actionLog.push(player.name + ' 取消，质疑成功');
            this._updateInteraction({
                stage: 'verdict',
                verdict: wasBlockClaim ? 'block_failed' : 'claim_failed',
                failedById: player.id,
                challengerId: this.challengerId,
            });
            const loss = this._requestInfluenceLoss(
                player,
                'challenge_success',
                wasBlockClaim ? 'block_challenge_success' : 'challenge_success'
            );
            return {
                ...loss,
                message: player.name + ' 取消，质疑成功，请选择要失去的影响力',
            };
        } else {
            return { success: false, message: '无效操作，请选择出示或取消' };
        }
    }

    // ==================== 执行待执行行动 ====================

    _executePendingAction() {
        const action = this.pendingAction;
        if (!action) {
            this.phase = 'idle';
            return { success: false, message: '没有待执行的行动' };
        }

        const player = this._getPlayer(action.playerId);
        if (!player || !this._isAlive(player)) {
            this.phase = 'idle';
            this.pendingAction = null;
            return { success: false, message: '行动者已出局' };
        }

        this.phase = 'idle';
        const { kind, targetId } = action;

        let result = null;
        switch (kind) {
            case 'block_foreign_aid':
            case 'block_assassinate':
            case 'block_steal': {
                const blocked = action.blockedAction || {};
                const requester = this._getPlayer(blocked.playerId);
                const roleName = action.claimedRole === 'duke' ? '公爵' : action.claimedRole === 'contessa' ? '伯爵夫人' : '船长或大使';
                const actionName = blocked.kind === 'assassinate' ? '暗杀' : blocked.kind === 'steal' ? '偷窃' : '外援';
                this.actionLog.push(`${player.name} 的${roleName}阻挡成立，${requester ? requester.name : '玩家'}的${actionName}失败`);
                this._updateInteraction({ stage: 'resolved', outcome: 'blocked', blockerId: player.id, blockRole: action.claimedRole });
                result = { success: true, message: `${player.name} 阻挡${actionName}成功` };
                break;
            }
            case 'foreign_aid':
                player.coins += 2;
                this.actionLog.push(player.name + ' 外援 +2');
                this._updateInteraction({ stage: 'resolved', outcome: 'foreign_aid' });
                result = { success: true, message: player.name + ' 获得外援 2 硬币' };
                break;
            case 'tax':
                player.coins += 3;
                this.actionLog.push(`${player.name} 征税 +3💰`);
                this._updateInteraction({ stage: 'resolved', outcome: 'tax' });
                result = { success: true, message: `${player.name} 征税 3 硬币` };
                break;
            case 'assassinate':
                if (player.coins < 0) {
                    this.pendingAction = null;
                    return { success: false, message: '暗杀费用状态无效' };
                }
                const assassinTarget = this._getPlayer(targetId);
                if (!assassinTarget || !this._isAlive(assassinTarget)) {
                    this.pendingAction = null;
                    return { success: false, message: '目标已不存在' };
                }
                this.actionLog.push(`${player.name} 暗杀 ${assassinTarget.name}`);
                this.pendingAction = null;
                this._updateInteraction({ stage: 'influence_loss', outcome: 'assassination', lossPlayerId: assassinTarget.id, lossReason: 'assassination' });
                const assassinationLoss = this._requestInfluenceLoss(assassinTarget, 'assassination', 'assassination');
                return {
                    ...assassinationLoss,
                    message: `${player.name} 暗杀 ${assassinTarget.name}，请目标选择失去的影响力`,
                };
            case 'steal':
                const stealTarget = this._getPlayer(targetId);
                if (!stealTarget || !this._isAlive(stealTarget)) {
                    this.pendingAction = null;
                    return { success: false, message: '目标已不存在' };
                }
                const stealAmount = Math.min(2, stealTarget.coins);
                stealTarget.coins -= stealAmount;
                player.coins += stealAmount;
                this.actionLog.push(`${player.name} 从 ${stealTarget.name} 偷取 ${stealAmount}💰`);
                this._updateInteraction({ stage: 'resolved', outcome: 'steal', amount: stealAmount });
                result = { success: true, message: `${player.name} 从 ${stealTarget.name} 偷取 ${stealAmount} 硬币` };
                break;
            case 'exchange':
                const exchangeDrawn = this._drawCards(2);
                const activeCount = player.influences.filter((_, index) => !player.revealed[index]).length;
                this.pendingExchange = { playerId: player.id, drawn: exchangeDrawn, keepCount: activeCount };
                this.phase = 'exchange';
                this._updateInteraction({ stage: 'exchange', outcome: 'exchange_pending' });
                this.actionLog.push(`${player.name} 抽取了两张影响力，正在选择交换结果`);
                return { success: true, message: `${player.name} 请从影响力中选择保留的牌`, state: this._getPublicState() };
            default:
                this.pendingAction = null;
                return { success: false, message: '未知行动' };
        }

        this.pendingAction = null;
        this._endTurn();
        return {
            ...result,
            state: this._getPublicState()
        };
    }

    // ==================== 辅助方法 ====================

    _checkPlayerDeath(player) {
        if (!this._isAlive(player)) {
            player.isAlive = false;
            this.actionLog.push(`${player.name} 出局！`);
            this._checkGameOver();
        }
    }

    _checkGameOver() {
        const alive = this._getAlivePlayers();
        if (alive.length <= 1) {
            this.gameOver = true;
            this.phase = 'ended';
            this.pendingAction = null;
            this.pendingInfluenceLoss = null;
            this.pendingExchange = null;
            this.challengeQueue = [];
            this.challengeIndex = 0;
            this.challengerId = null;
            this.responderId = null;
            this.claimedRole = null;
            this.winner = alive.length === 1 ? alive[0].id : null;
            if (this.winner) {
                this.actionLog.push(`${this._getPlayer(this.winner).name} 获胜！`);
            } else {
                this.actionLog.push('游戏结束，无人获胜');
            }
        }
    }

    _endTurn() {
        if (this.gameOver) return;
        const nextIdx = this._getNextTurnIndex(this.currentTurnIndex);
        if (nextIdx === -1) {
            this.gameOver = true;
            this.phase = 'ended';
            this.winner = null;
            this.actionLog.push('游戏结束');
            return;
        }
        this.currentTurnIndex = nextIdx;
        this.phase = 'idle';
        this.pendingAction = null;
        this.pendingInfluenceLoss = null;
        this.pendingExchange = null;
        this.challengeQueue = [];
        this.challengeIndex = 0;
        this.challengerId = null;
        this.responderId = null;
        this.claimedRole = null;
    }

    // ==================== 玩家退出 ====================

    handlePlayerLeave(playerId) {
        const player = this._getPlayer(playerId);
        if (!player) return { success: false, message: '玩家不存在' };

        if (this.gameOver) {
            // 游戏已结束，直接标记为离线
            player.isOnline = false;
            return { success: true, message: '玩家已离线' };
        }

        if (!this._isAlive(player)) {
            player.isOnline = false;
            return { success: true, message: '玩家已出局' };
        }

        // 玩家退出 => 直接出局
        // 强制揭示所有影响力（失去所有牌）
        const newlyRevealed = [];
        for (let i = 0; i < player.influences.length; i++) {
            if (!player.revealed[i]) newlyRevealed.push(player.influences[i]);
            player.revealed[i] = true;
        }
        player.isAlive = false;
        player.isOnline = false;
        this.actionLog.push(`${player.name} 离开了游戏，已出局`);
        this._recordReveal(player, newlyRevealed, 'left');

        // 如果当前是退出玩家的回合，跳到下一位
        const currentPlayer = this.players[this.currentTurnIndex];
        if (currentPlayer.id === playerId) {
            this._endTurn();
        }

        this._checkGameOver();
        return {
            success: true,
            message: `${player.name} 已出局`,
            state: this._getPublicState()
        };
    }

    // ==================== 获取状态 ====================

    /**
     * 获取某个玩家能看到的状态（信息隐藏）
     */
    getPlayerState(playerId) {
        const state = this._getPublicState();
        state.myId = playerId;
        const self = this._getPlayer(playerId);

        // 添加玩家自己的私有信息
        const revealAll = this.gameOver;
        if (self) {
            state.self = {
                id: self.id,
                coins: self.coins,
                influences: self.influences.map((role, idx) => ({
                    role: revealAll || !self.revealed[idx] ? role : null,
                    revealed: self.revealed[idx],
                })),
            };
        }

        // 每个玩家能看到其他人的硬币和存活状态，但手牌隐藏
        state.players = this.players.map(p => {
            const isSelf = p.id === playerId;
            return {
                id: p.id,
                name: p.name,
                coins: p.coins,
                isAlive: p.isAlive && p.isOnline,
                isOnline: p.isOnline,
                isSelf: isSelf,
                // 手牌：只有自己能看到，且只显示未揭示的
                influences: p.influences.map((role, idx) => ({
                    role: (isSelf || revealAll || p.revealed[idx]) ? role : null,
                    revealed: p.revealed[idx],
                })),
            };
        });

        // 当前回合玩家信息
        if (this.currentTurnIndex >= 0 && this.currentTurnIndex < this.players.length) {
            state.currentTurn = this.players[this.currentTurnIndex].id;
        }

        // 质疑信息
        if (this.phase === 'block') {
            const currentBlockerId = this.challengeQueue[this.challengeIndex] || null;
            const blockRole = this._blockRoleForAction(this.pendingAction);
            state.challenge = {
                phase: 'block',
                currentBlockerId: currentBlockerId,
                responderId: this.responderId,
                // At this point the action itself has not been blocked yet.
                // The claim shown to the target must be the counteraction
                // role (Contessa/Captain-or-Ambassador/Duke), not the role
                // claimed by the original action (Assassin/Captain/Duke).
                claimedRole: blockRole || this.pendingAction?.claimedRole || 'duke',
                actionKind: this.pendingAction ? this.pendingAction.kind : null,
                isMyTurn: playerId === currentBlockerId,
            };
        } else if (this.phase === 'challenge') {
            const currentChallengerId = this.challengeQueue[this.challengeIndex] || null;
            state.challenge = {
                phase: 'challenge',
                currentChallengerId: currentChallengerId,
                responderId: this.responderId,
                claimedRole: this.claimedRole,
                actionKind: this.pendingAction ? this.pendingAction.kind : null,
                isMyTurn: playerId === currentChallengerId,
            };
        } else if (this.phase === 'respond') {
            state.challenge = {
                phase: 'respond',
                responderId: this.responderId,
                challengerId: this.challengerId,
                claimedRole: this.claimedRole,
                actionKind: this.pendingAction ? this.pendingAction.kind : null,
                isMyTurn: playerId === this.responderId,
            };
        } else if (this.phase === 'influence_loss') {
            state.influenceLoss = {
                playerId: this.pendingInfluenceLoss?.playerId || null,
                isMyTurn: playerId === this.pendingInfluenceLoss?.playerId,
            };
        } else if (this.phase === 'exchange') {
            const exchangeOwner = this.pendingExchange?.playerId === playerId;
            state.exchange = {
                playerId: this.pendingExchange?.playerId || null,
                keepCount: this.pendingExchange?.keepCount || 0,
                isMyTurn: exchangeOwner,
                options: exchangeOwner ? [
                    ...((state.self?.influences || []).filter(card => !card.revealed).map((card, index) => ({ index, role: card.role, source: 'hand' }))),
                    ...((this.pendingExchange?.drawn || []).map((role, index) => ({ index: index + (state.self?.influences || []).filter(card => !card.revealed).length, role, source: 'drawn' }))),
                ] : null,
            };
        } else {
            state.challenge = null;
        }

        // 强制政变提示
        if (state.currentTurn === playerId && self && self.coins >= 10) {
            state.forceCoup = true;
        }

        state.gameOver = this.gameOver;
        state.winner = this.winner;
        state.actionLog = this.actionLog.slice(-10); // 最近10条

        return state;
    }

    _getPublicState() {
        return {
            roomId: this.roomId,
            phase: this.phase,
            currentTurn: this.currentTurnIndex >= 0 ? this.players[this.currentTurnIndex].id : null,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                coins: p.coins,
                isAlive: p.isAlive && p.isOnline,
                isOnline: p.isOnline,
                influenceCount: this._getActiveInfluenceCount(p),
            })),
            gameOver: this.gameOver,
            winner: this.winner,
            interaction: this.interaction ? { ...this.interaction } : null,
            lastReveal: this.lastReveal ? { ...this.lastReveal, roles: [...this.lastReveal.roles] } : null,
        };
    }

    // ==================== 获取胜者 ====================

    getWinner() {
        if (!this.gameOver) return null;
        return this.winner ? this._getPlayer(this.winner) : null;
    }

    // ==================== 检查玩家是否存活 ====================

    isPlayerAlive(playerId) {
        const player = this._getPlayer(playerId);
        return player ? this._isAlive(player) : false;
    }
}

module.exports = CoupEngine;
