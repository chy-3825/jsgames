const AvalonEngine = require('./engine');
const metadata = { type: 'avalon', name: '阿瓦隆', minPlayers: 5, maxPlayers: 10 };

class AvalonSession {
    constructor(roomId, players, options = {}) { this.options = options && typeof options === 'object' ? { ...options } : {}; this.engine = new AvalonEngine(roomId, players, this.options.random || Math.random, this.options); this.started = false; }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action, playerId) { return this.engine.getPlayerAction(action, playerId); }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = {
    metadata,
    create(roomId, players, hostId, gameOptions = {}) {
        // Room passes hostId and gameOptions; direct callers may pass the
        // options object as the third argument for backwards compatibility.
        const options = hostId && typeof hostId === 'object' && !Array.isArray(hostId) ? hostId : gameOptions;
        return new AvalonSession(roomId, players, options);
    },
};
