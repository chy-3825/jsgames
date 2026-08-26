const WerewolfEngine = require('./engine');

const metadata = { type: 'werewolf', name: '狼人杀自动辅助', minPlayers: 9, maxPlayers: 12, playerCounts: [9, 12] };

class WerewolfSession {
    constructor(roomId, players, hostId, options = {}) {
        const sheriffEnabled = options.sheriffEnabled !== false;
        const winCondition = options.winCondition === 'parity' ? 'parity' : 'edge';
        const playerCount = Number(options.playerCount) === 12 ? 12 : 9;
        this.engine = new WerewolfEngine(roomId, players, hostId, Math.random, Date.now, { sheriffEnabled, winCondition, playerCount });
        this.started = false;
    }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerDisconnect(playerId) { return this.engine.handlePlayerDisconnect(playerId); }
    handlePlayerReconnect(playerId) { return this.engine.handlePlayerReconnect(playerId); }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    handleSystemTick() { return this.started ? this.engine.handleSystemTick() : null; }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action, playerId) { return this.engine.getPlayerAction(action, playerId); }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players, hostId, options) { return new WerewolfSession(roomId, players, hostId, options); } };
