const ManilaEngine = require('./engine');
const metadata = { type: 'manila', name: '马尼拉', minPlayers: 3, maxPlayers: 5 };
class ManilaSession {
    constructor(roomId, players, options = {}) { const random = typeof options === 'function' ? options : options?.random; this.engine = new ManilaEngine(roomId, players, random || Math.random); this.started = false; }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}
module.exports = { metadata, create(roomId, players, hostId, gameOptions = {}) { const options = typeof hostId === 'function' || (hostId && typeof hostId === 'object' && !Array.isArray(hostId)) ? hostId : gameOptions; return new ManilaSession(roomId, players, options); } };
