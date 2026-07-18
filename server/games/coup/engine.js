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
     */
    constructor(roomId, players) {
        this.roomId = roomId;
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
        this.phase = 'idle'; // idle | challenge | respond | action
        this.pendingAction = null; // { kind, targetId, claimedRole }
        this.challengeQueue = []; // 质疑顺序（玩家ID数组）
        this.challengeIndex = 0;
        this.challengerId = null; // 谁发起了质疑
        this.responderId = null;  // 谁需要回应质疑
        this.claimedRole = null;  // 声称的角色ID
        this.winner = null;
        this.gameOver = false;
        this.turnHistory = [];
        this.actionLog = [];

        // 初始化牌堆
        this._initDeck();
        // 发牌
        this._dealCards();
        // 设置起始玩家（房主先手）
        this.currentTurnIndex = 0;
    }

    // ==================== 初始化 ====================

    _initDeck() {
        const count = this.players.length;
        // 每个角色至少2张，最多4张
        const baseCount = count <= 4 ? 2 : 3;
        const extra = count > 6 ? 1 : 0;
        const totalPerRole = Math.min(baseCount + extra, 4);

        this.deck = [];
        ROLE_IDS.forEach(id => {
            for (let i = 0; i < totalPerRole; i++) {
                this.deck.push(id);
            }
        });
        // 确保总数足够
        while (this.deck.length < this.players.length * 2 + 10) {
            this.deck.push(ROLE_IDS[Math.floor(Math.random() * ROLE_IDS.length)]);
        }
        this._shuffleDeck();
    }

    _shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
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
            if (this.deck.length === 0) {
                this._reshuffleDeck();
            }
            drawn.push(this.deck.pop());
        }
        return drawn;
    }

    _reshuffleDeck() {
        // 收集所有已揭示的牌（已经失去的）放回牌堆
        const usedCards = [];
        this.players.forEach(p => {
            p.influences.forEach((role, idx) => {
                if (p.revealed[idx]) {
                    usedCards.push(role);
                }
            });
        });
        // 如果收集到的牌太少，补充一些随机牌
        while (usedCards.length < 10) {
            usedCards.push(ROLE_IDS[Math.floor(Math.random() * ROLE_IDS.length)]);
        }
        this.deck = usedCards;
        this._shuffleDeck();
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

    _getRandomAliveInfluenceIndex(player) {
        const alive = player.influences
            .map((_, idx) => idx)
            .filter(idx => !player.revealed[idx]);
        if (alive.length === 0) return -1;
        return alive[Math.floor(Math.random() * alive.length)];
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
        if (this.players.length < 2) {
            return { success: false, message: '至少需要2名玩家' };
        }
        // 起始玩家为房主（索引0）
        this.currentTurnIndex = 0;
        this.phase = 'idle';
        this.gameOver = false;
        this.winner = null;
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

    _actionIncome(player) {
        player.coins += 1;
        this.actionLog.push(`${player.name} 收入 +1💰`);
        this._endTurn();
        return {
            success: true,
            message: `${player.name} 收入 1 硬币`,
            state: this._getPublicState()
        };
    }

    _actionForeignAid(player) {
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

        // 执行政变
        player.coins -= 7;
        const removed = this._removeInfluence(target);
        this.actionLog.push(`${player.name} 政变 ${target.name}${removed ? '，失去一张影响力' : ''}`);

        this._checkPlayerDeath(target);
        this._endTurn();
        return {
            success: true,
            message: `${player.name} 政变 ${target.name}`,
            state: this._getPublicState()
        };
    }

    // ==================== 质疑阶段 ====================

    _startChallengePhase(player, actionKind, targetId, claimedRole) {
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

        if (this.challengeQueue.length === 0) {
            // 没有其他玩家存活，直接执行
            return this._executePendingAction();
        }

        this.phase = 'challenge';
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

    _handleBlockResponse(playerId, action) {
        const kind = action.kind;
        const currentBlockerId = this.challengeQueue[this.challengeIndex] || null;

        if (playerId !== currentBlockerId) {
            return { success: false, message: '还没轮到你决定是否阻挡' };
        }

        const blocker = this._getPlayer(playerId);
        const requester = this._getPlayer(this.pendingAction && this.pendingAction.playerId);

        if (kind === 'pass') {
            this.challengeIndex++;
            this.actionLog.push(blocker.name + ' 选择不阻挡外援');

            if (this.challengeIndex >= this.challengeQueue.length) {
                this.actionLog.push('无人阻挡，外援成功');
                return this._executePendingAction();
            }

            return {
                success: true,
                message: blocker.name + ' 不阻挡外援',
                state: this._getPublicState()
            };
        }

        if (kind === 'block') {
            this.pendingAction = {
                kind: 'block_foreign_aid',
                playerId: blocker.id,
                claimedRole: 'duke',
                blockedAction: {
                    kind: 'foreign_aid',
                    playerId: requester ? requester.id : null,
                },
            };
            this.claimedRole = 'duke';
            this.responderId = blocker.id;
            this.challengerId = null;
            this.phase = 'challenge';

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

            this.actionLog.push(blocker.name + ' 声称公爵，阻挡了 ' + (requester ? requester.name : '玩家') + ' 的外援，等待质疑');

            if (this.challengeQueue.length === 0) {
                return this._executePendingAction();
            }

            return {
                success: true,
                message: blocker.name + ' 声称公爵阻挡外援，请其他玩家决定是否质疑',
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
                return this._executePendingAction();
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
            const cardIndex = player.influences.findIndex((role, idx) =>
                role === claimedRole && !player.revealed[idx]
            );

            if (cardIndex === -1) {
                // 没有对应的牌，不能出示，只能取消
                return { success: false, message: '你没有对应的角色牌，不能出示，请选择取消', state: this.getPlayerState(playerId) };
            }

            // 出示成功：弃掉该牌，补一张新牌
            player.revealed[cardIndex] = true;
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

            this.actionLog.push(`${player.name} 出示了 ${ROLE_NAMES[claimedRole]}，质疑失败！`);

            // 质疑者失去一张影响力
            const challenger = this._getPlayer(this.challengerId);
            this._removeInfluence(challenger);
            this._checkPlayerDeath(challenger);

            // 继续执行原行动（质疑失败，原行动继续）
            this.phase = 'idle';
            const result = this._executePendingAction();
            return {
                success: true,
                message: `${player.name} 出示了 ${ROLE_NAMES[claimedRole]}，质疑失败！${challenger.name} 失去一张影响力`,
                state: this._getPublicState(),
                ...result
            };
        } else if (kind === 'cancel') {
            const player = this._getPlayer(playerId);
            const wasBlockClaim = this.pendingAction && this.pendingAction.kind === 'block_foreign_aid';
            const blockedAction = wasBlockClaim ? this.pendingAction.blockedAction : null;

            this._removeInfluence(player);
            this._checkPlayerDeath(player);
            this.actionLog.push(player.name + ' 取消，质疑成功');
            this.phase = 'idle';

            if (wasBlockClaim && blockedAction && blockedAction.kind === 'foreign_aid') {
                this.pendingAction = {
                    kind: 'foreign_aid',
                    playerId: blockedAction.playerId,
                    claimedRole: null,
                    targetId: null,
                };
                return this._executePendingAction();
            }

            this._endTurn();
            return {
                success: true,
                message: player.name + ' 取消，质疑成功，失去一张影响力',
                state: this._getPublicState()
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
            case 'block_foreign_aid': {
                const blocked = action.blockedAction || {};
                const requester = this._getPlayer(blocked.playerId);
                this.actionLog.push(player.name + ' 的公爵阻挡成立，' + (requester ? requester.name : '玩家') + ' 的外援失败');
                result = { success: true, message: player.name + ' 阻挡外援成功' };
                break;
            }
            case 'foreign_aid':
                player.coins += 2;
                this.actionLog.push(player.name + ' 外援 +2');
                result = { success: true, message: player.name + ' 获得外援 2 硬币' };
                break;
            case 'tax':
                player.coins += 3;
                this.actionLog.push(`${player.name} 征税 +3💰`);
                result = { success: true, message: `${player.name} 征税 3 硬币` };
                break;
            case 'assassinate':
                if (player.coins < 3) {
                    this.pendingAction = null;
                    return { success: false, message: '暗杀需要3枚硬币' };
                }
                const assassinTarget = this._getPlayer(targetId);
                if (!assassinTarget || !this._isAlive(assassinTarget)) {
                    this.pendingAction = null;
                    return { success: false, message: '目标已不存在' };
                }
                player.coins -= 3;
                this._removeInfluence(assassinTarget);
                this._checkPlayerDeath(assassinTarget);
                this.actionLog.push(`${player.name} 暗杀 ${assassinTarget.name}`);
                result = { success: true, message: `${player.name} 暗杀 ${assassinTarget.name}` };
                break;
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
                result = { success: true, message: `${player.name} 从 ${stealTarget.name} 偷取 ${stealAmount} 硬币` };
                break;
            case 'exchange':
                // 交换：从牌堆抽2张，然后选2张保留
                // 这里需要前端交互，我们用两步走：
                // 第一步：抽2张，发送给玩家选择
                // 但在这里，我们直接执行一个简化版本：自动换掉所有手牌
                // 更完整的实现需要等待前端交互
                const drawn = this._drawCards(2);
                // 弃掉所有当前手牌（未揭示的）
                const oldCards = [];
                for (let i = player.influences.length - 1; i >= 0; i--) {
                    if (!player.revealed[i]) {
                        oldCards.push(player.influences[i]);
                        player.influences.splice(i, 1);
                        player.revealed.splice(i, 1);
                    }
                }
                // 保留已揭示的牌位置，但替换为新牌
                // 简化：如果手牌不足2张，补到2张
                while (player.influences.length < 2) {
                    const card = drawn.pop() || this._drawCards(1)[0] || 'duke';
                    player.influences.push(card);
                    player.revealed.push(false);
                }
                // 剩余抽到的牌放回牌堆
                if (drawn.length > 0) {
                    this._returnToDeck(drawn);
                }
                if (oldCards.length > 0) {
                    this._returnToDeck(oldCards);
                }
                this.actionLog.push(`${player.name} 完成交换`);
                result = { success: true, message: `${player.name} 完成交换` };
                break;
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

    _removeInfluence(player) {
        const idx = this._getRandomAliveInfluenceIndex(player);
        if (idx === -1) return false;
        player.revealed[idx] = true;
        return true;
    }

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
            this.winner = null;
            this.actionLog.push('游戏结束');
            return;
        }
        this.currentTurnIndex = nextIdx;
        this.phase = 'idle';
        this.pendingAction = null;
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
        for (let i = 0; i < player.influences.length; i++) {
            player.revealed[i] = true;
        }
        player.isAlive = false;
        player.isOnline = false;
        this.actionLog.push(`${player.name} 离开了游戏，已出局`);

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
        if (self) {
            state.self = {
                id: self.id,
                coins: self.coins,
                influences: self.influences.map((role, idx) => ({
                    role: self.revealed[idx] ? null : role,
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
                    role: (isSelf && !p.revealed[idx]) ? role : null,
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
            state.challenge = {
                phase: 'block',
                currentBlockerId: currentBlockerId,
                responderId: this.responderId,
                claimedRole: 'duke',
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