const LasVegasEngine = require('./engine');
const metadata = { type: 'lasvegas', name: '拉斯维加斯', minPlayers: 2, maxPlayers: 5 };

class LasVegasSession {
    constructor(roomId, players, options = {}) { this.engine = new LasVegasEngine(roomId, players, options); this.started = false; }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players, hostId, options = {}) { const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object') ? hostId : options; return new LasVegasSession(roomId, players, resolvedOptions); } };
