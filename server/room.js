const games = require('./games/registry');

const ROOM_NAME_MAX_LENGTH = 24;

function normalizeRoomName(value, hostName, gameName) {
    const clean = String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if ([...clean].length > ROOM_NAME_MAX_LENGTH) {
        throw new Error(`房间名称不能超过 ${ROOM_NAME_MAX_LENGTH} 个字符`);
    }
    if (clean) return clean;
    return [...`${hostName || '房主'}的${gameName}房间`].slice(0, ROOM_NAME_MAX_LENGTH).join('');
}

class Room {
    constructor(roomId, hostId, hostName, gameType = 'loveletter', gameOptions = {}, roomProperties = {}) {
        const gameModule = games.getGame(gameType);
        if (!gameModule) {
            throw new Error(`\u672a\u77e5\u6e38\u620f\u7c7b\u578b: ${gameType}`);
        }

        this.id = roomId;
        this.gameType = gameType;
        this.gameName = gameModule.metadata.name;
        this.gameModule = gameModule;
        this.gameOptions = gameOptions && typeof gameOptions === 'object' ? { ...gameOptions } : {};
        const properties = roomProperties && typeof roomProperties === 'object' ? roomProperties : {};
        this.roomName = normalizeRoomName(properties.roomName, hostName, this.gameName);
        this.isPublic = properties.isPublic !== false;
        this.hostId = hostId;
        this.players = [];
        this.status = 'waiting';
        this.minPlayers = gameModule.metadata.minPlayers || 2;
        this.maxPlayers = gameModule.metadata.maxPlayers || 4;
        this.allowedPlayerCounts = Array.isArray(gameModule.metadata.playerCounts)
            ? [...new Set(gameModule.metadata.playerCounts.map(Number).filter(Number.isInteger))]
            : [];
        this.allowedEncryptorModes = Array.isArray(gameModule.metadata.encryptorModes)
            ? [...new Set(gameModule.metadata.encryptorModes.map(String))]
            : [];
        if (!this.allowedPlayerCounts.length && properties.seatLimit != null) {
            const seatLimit = Number(properties.seatLimit);
            if (!Number.isInteger(seatLimit) || seatLimit < this.minPlayers || seatLimit > this.maxPlayers) {
                throw new Error(`房间人数上限必须在 ${this.minPlayers}–${this.maxPlayers} 人之间`);
            }
            this.maxPlayers = seatLimit;
        }
        this.configurationRequired = this.allowedPlayerCounts.length > 0 || this.allowedEncryptorModes.length > 0;
        this.configurationConfirmed = !this.configurationRequired;
        this.targetPlayers = null;
        if (this.configurationRequired && this.gameOptions.playerCount != null) {
            const configured = this._setPlayerCount(this.gameOptions.playerCount);
            if (!configured.success) throw new Error(configured.message);
        }
        if (this.allowedEncryptorModes.length && this.gameOptions.encryptorMode != null) {
            const configured = this._setEncryptorMode(this.gameOptions.encryptorMode);
            if (!configured.success) throw new Error(configured.message);
        }
        this._refreshConfiguration();
        this.game = null;
        this.createdAt = Date.now();
        this.messages = [];
    }

    addPlayer(player) {
        if (this.configurationRequired && !this.configurationConfirmed && player.id !== this.hostId) {
            return { success: false, message: '房主尚未确认房间设置' };
        }
        if (this.players.length >= this.maxPlayers) {
            return { success: false, message: '\u623f\u95f4\u5df2\u6ee1' };
        }
        if (this.players.find(p => p.id === player.id)) {
            return { success: false, message: '\u4f60\u5df2\u7ecf\u5728\u8fd9\u4e2a\u623f\u95f4\u4e2d' };
        }
        if (this.status === 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u5f00\u59cb\uff0c\u65e0\u6cd5\u52a0\u5165' };
        }
        this.players.push(player);
        return { success: true, message: '\u52a0\u5165\u6210\u529f' };
    }

    _setPlayerCount(playerCount) {
        const target = Number(playerCount);
        if (!this.allowedPlayerCounts.includes(target)) {
            return { success: false, message: `人数只能选择 ${this.allowedPlayerCounts.join(' 或 ')} 人` };
        }
        if (this.players.length > target) {
            return { success: false, message: `当前已有 ${this.players.length} 人，无法设置为 ${target} 人` };
        }
        this.targetPlayers = target;
        this.minPlayers = target;
        this.maxPlayers = target;
        this.gameOptions.playerCount = target;
        this._refreshConfiguration();
        return { success: true, message: `已确认 ${target} 人房间` };
    }

    _setEncryptorMode(mode) {
        const value = String(mode || '');
        if (!this.allowedEncryptorModes.includes(value)) return { success: false, message: '请选择有效的加密员产生方式' };
        this.gameOptions.encryptorMode = value;
        this._refreshConfiguration();
        const labels = { fixed_vote: '固定投票', rotation: '轮流', random: '每轮随机' };
        return { success: true, message: `已选择“${labels[value] || value}”加密员规则` };
    }

    _refreshConfiguration() {
        const playerCountReady = !this.allowedPlayerCounts.length || this.targetPlayers != null;
        const encryptorModeReady = !this.allowedEncryptorModes.length || this.allowedEncryptorModes.includes(this.gameOptions.encryptorMode);
        this.configurationConfirmed = playerCountReady && encryptorModeReady;
    }

    configure(playerId, options = {}) {
        if (!this.configurationRequired) return { success: false, message: '该游戏无需额外设置' };
        if (playerId !== this.hostId) return { success: false, message: '只有房主可以确认房间设置' };
        if (this.status !== 'waiting') return { success: false, message: '游戏已开始，无法修改设置' };
        if (this.configurationConfirmed) return { success: false, message: '房间设置已经确认' };
        if (this.allowedPlayerCounts.length) return this._setPlayerCount(options.playerCount);
        if (this.allowedEncryptorModes.length) return this._setEncryptorMode(options.encryptorMode);
        return { success: false, message: '缺少房间设置' };
    }

    isListed() {
        return this.configurationConfirmed && this.isPublic;
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) return null;

        const removed = this.players.splice(index, 1)[0];
        if (this.hostId === playerId && this.players.length > 0) {
            this.hostId = this.players[0].id;
        }
        if (this.players.length === 0) {
            this.status = 'ended';
        }
        return removed;
    }

    getPlayerInfo() {
        return this.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.id === this.hostId,
        }));
    }

    getInfo() {
        return {
            id: this.id,
            gameType: this.gameType,
            gameName: this.gameName,
            roomName: this.roomName,
            isPublic: this.isPublic,
            gameOptions: { ...this.gameOptions },
            hostId: this.hostId,
            status: this.status,
            playerCount: this.players.length,
            minPlayers: this.minPlayers,
            maxPlayers: this.maxPlayers,
            targetPlayers: this.targetPlayers,
            allowedPlayerCounts: this.allowedPlayerCounts.slice(),
            allowedEncryptorModes: this.allowedEncryptorModes.slice(),
            configurationRequired: this.configurationRequired,
            configurationConfirmed: this.configurationConfirmed,
            players: this.getPlayerInfo(),
            createdAt: this.createdAt,
        };
    }

    startGame() {
        if (this.status === 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u5f00\u59cb' };
        }
        if (this.configurationRequired && !this.configurationConfirmed) {
            return { success: false, message: this.allowedPlayerCounts.length ? '请先确认房间人数' : '请先确认房间设置' };
        }
        if (this.targetPlayers && this.players.length !== this.targetPlayers) {
            return { success: false, message: `需要 ${this.targetPlayers} 名玩家全部到齐才能开始（当前 ${this.players.length}/${this.targetPlayers}）` };
        }
        if (this.players.length < this.minPlayers) {
            return { success: false, message: `\u81f3\u5c11\u9700\u8981 ${this.minPlayers} \u540d\u73a9\u5bb6` };
        }
        if (this.players.length > this.maxPlayers) {
            return { success: false, message: `\u6700\u591a\u652f\u6301 ${this.maxPlayers} \u540d\u73a9\u5bb6` };
        }

        try {
            // The optional third argument lets games with an inter-round
            // pause authorize the room host without changing older adapters.
            this.game = this.gameModule.create(this.id, this.players, this.hostId, this.gameOptions);
            const result = this.game.start();
            if (!result.success) return result;
            this.status = 'playing';
            return result;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    handleGameAction(playerId, action) {
        if (this.status !== 'playing' || !this.game) {
            return { success: false, message: '\u6e38\u620f\u672a\u5f00\u59cb' };
        }

        const result = this.game.handleAction(playerId, action);
        if (result.success && result.ended) {
            this.status = 'ended';
        }
        return result;
    }

    handleSystemTick() {
        if (this.status !== 'playing' || !this.game?.handleSystemTick) return null;
        const result = this.game.handleSystemTick();
        if (result?.success && result.ended) this.status = 'ended';
        return result;
    }

    getPlayerGameState(playerId) {
        if (!this.game) {
            return null;
        }
        return this.game.getPlayerState(playerId);
    }

    getPlayerGameAction(action, playerId) {
        if (!this.game || !this.game.getPlayerAction) return action;
        return this.game.getPlayerAction(action, playerId);
    }

    getWinner() {
        return this.game ? this.game.getWinner() : null;
    }
}

module.exports = Room;
