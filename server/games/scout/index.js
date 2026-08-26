const ScoutEngine = require('./engine');
const metadata = { type: 'scout', name: '马戏星探', minPlayers: 2, maxPlayers: 5 };

class ScoutSession {
    constructor(roomId, players, options = {}) { this.options = options && typeof options === 'object' ? { ...options } : {}; this.engine = new ScoutEngine(roomId, players, this.options.random || Math.random); this.started = false; }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = {
    metadata,
    create(roomId, players, hostId, gameOptions = {}) {
        const options = hostId && typeof hostId === 'object' && !Array.isArray(hostId) ? hostId : gameOptions;
        return new ScoutSession(roomId, players, options);
    },
};
