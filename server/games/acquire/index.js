const AcquireEngine = require('./engine');
const metadata = { type: 'acquire', name: '并购', minPlayers: 2, maxPlayers: 6 };
class AcquireSession {
    constructor(roomId, players, options = {}) { this.options = options && typeof options === 'object' ? { ...options } : {}; this.engine = new AcquireEngine(roomId, players, this.options.random || Math.random); this.started = false; }
    start() { if (this.started || this.engine.status !== 'waiting') return { success: false, message: '游戏已经开始' }; const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}
module.exports = {
    metadata,
    create(roomId, players, hostId, options = {}) {
        const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object') ? hostId : options;
        return new AcquireSession(roomId, players, resolvedOptions);
    },
};
