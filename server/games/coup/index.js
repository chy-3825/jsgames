/**
 * 政变 (Coup) - 大厅适配层
 * 实现 server/games/registry.js 约定的接口
 * 
 * 职责：
 * 1. 提供游戏元信息 (metadata)
 * 2. 创建游戏会话 (GameSession)
 * 3. 将大厅消息转换为 engine 调用
 * 4. 为每个玩家提供不同的状态视图（信息隐藏）
 */

const CoupEngine = require('./engine');

// ==================== 游戏元信息 ====================

const metadata = {
    type: 'coup',
    name: '政变',
    minPlayers: 2,
    maxPlayers: 8,
};

// ==================== 游戏会话类 ====================

class CoupSession {
    /**
     * @param {string} roomId - 房间ID
     * @param {Array} players - 玩家数组 [{ id, name }, ...]
     */
    constructor(roomId, players) {
        this.roomId = roomId;
        // 将大厅玩家数据传给 engine
        this.engine = new CoupEngine(roomId, players);
        this.started = false;
    }

    /**
     * 开始游戏
     * @returns {object} { success, message, state }
     */
    start() {
        if (this.started) {
            return { success: false, message: '游戏已经开始' };
        }
        if (this.engine.players.length < 2) {
            return { success: false, message: '至少需要2名玩家' };
        }
        this.started = true;
        const result = this.engine.start();
        return {
            success: result.success,
            message: result.message,
            state: result.state,
        };
    }

    /**
     * 处理玩家操作
     * @param {string} playerId - 玩家ID
     * @param {object} action - 操作对象
     * @returns {object} { success, message, state, challenge? }
     */
    handleAction(playerId, action) {
        if (!this.started) {
            return { success: false, message: '游戏尚未开始' };
        }
        if (this.engine.gameOver) {
            return { success: false, message: '游戏已结束' };
        }
        return this.engine.handleAction(playerId, action);
    }

    /**
     * 获取某个玩家能看到的状态
     * @param {string} playerId - 玩家ID
     * @returns {object} 该玩家的视角状态
     */
    getPlayerState(playerId) {
        if (!this.started) {
            return {
                roomId: this.roomId,
                started: false,
                players: this.engine.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    isAlive: true,
                })),
            };
        }
        return this.engine.getPlayerState(playerId);
    }

    /**
     * 获取玩家操作（用于日志/记录）
     * @param {object} action - 原始操作
     * @param {string} playerId - 玩家ID
     * @returns {object} 可记录的操作对象
     */
    getPlayerAction(action, playerId) {
        // 可以在这里添加日志或过滤敏感信息
        return action;
    }

    /**
     * 获取胜者
     * @returns {object|null} 胜者玩家对象，或 null
     */
    getWinner() {
        if (!this.started || !this.engine.gameOver) return null;
        const winnerId = this.engine.winner;
        if (!winnerId) return null;
        const player = this.engine.players.find(p => p.id === winnerId);
        if (!player) return null;
        return {
            id: player.id,
            name: player.name,
        };
    }

    /**
     * 处理玩家离开（视为投降/出局）
     * @param {string} playerId - 离开的玩家ID
     * @returns {object} { success, message, state }
     */
    handlePlayerLeave(playerId) {
        if (!this.started || this.engine.gameOver) {
            // 游戏未开始或已结束，简单标记离线
            const player = this.engine.players.find(p => p.id === playerId);
            if (player) {
                player.isOnline = false;
            }
            return { success: true, message: '玩家已离开' };
        }
        return this.engine.handlePlayerLeave(playerId);
    }

    /**
     * 检查玩家是否存活
     * @param {string} playerId - 玩家ID
     * @returns {boolean}
     */
    isPlayerAlive(playerId) {
        return this.engine.isPlayerAlive(playerId);
    }

    /**
     * 获取所有存活玩家（用于服务端逻辑）
     * @returns {Array} 存活玩家列表
     */
    getAlivePlayers() {
        return this.engine._getAlivePlayers();
    }
}

// ==================== 导出 ====================

module.exports = {
    metadata,
    /**
     * 创建游戏会话
     * @param {string} roomId - 房间ID
     * @param {Array} players - 玩家数组 [{ id, name }, ...]
     * @returns {CoupSession}
     */
    create(roomId, players) {
        return new CoupSession(roomId, players);
    },
};