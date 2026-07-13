const games = require('./games/registry');

class Room {
    constructor(roomId, hostId, hostName, gameType = 'loveletter') {
        const gameModule = games.getGame(gameType);
        if (!gameModule) {
            throw new Error(`\u672a\u77e5\u6e38\u620f\u7c7b\u578b: ${gameType}`);
        }

        this.id = roomId;
        this.gameType = gameType;
        this.gameName = gameModule.metadata.name;
        this.gameModule = gameModule;
        this.hostId = hostId;
        this.players = [];
        this.status = 'waiting';
        this.minPlayers = gameModule.metadata.minPlayers || 2;
        this.maxPlayers = gameModule.metadata.maxPlayers || 4;
        this.game = null;
        this.createdAt = Date.now();
        this.messages = [];
    }

    addPlayer(player) {
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
            hostId: this.hostId,
            status: this.status,
            playerCount: this.players.length,
            minPlayers: this.minPlayers,
            maxPlayers: this.maxPlayers,
            players: this.getPlayerInfo(),
            createdAt: this.createdAt,
        };
    }

    startGame() {
        if (this.status === 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u5f00\u59cb' };
        }
        if (this.players.length < this.minPlayers) {
            return { success: false, message: `\u81f3\u5c11\u9700\u8981 ${this.minPlayers} \u540d\u73a9\u5bb6` };
        }
        if (this.players.length > this.maxPlayers) {
            return { success: false, message: `\u6700\u591a\u652f\u6301 ${this.maxPlayers} \u540d\u73a9\u5bb6` };
        }

        try {
            this.game = this.gameModule.create(this.id, this.players);
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


