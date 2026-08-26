const TakeFiveEngine = require('./engine');
const metadata = { type: 'takefive', name: '牛头王', minPlayers: 2, maxPlayers: 10 };
class TakeFiveSession {
    constructor(roomId, players, options = {}) {
        const resolvedOptions = typeof options === 'function' ? {} : (options || {});
        const random = typeof options === 'function' ? options : resolvedOptions.random;
        this.engine = new TakeFiveEngine(roomId, players, random || Math.random, resolvedOptions);
        this.started = false;
    }
    start() { if (this.started) return { success: false, message: '游戏已经开始' }; const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}
module.exports = {
    metadata,
    create(roomId, players, hostId, options = {}) {
        // Room passes hostId and gameOptions as the third/fourth adapter
        // arguments. Direct tests may pass the options object or a random
        // function as the third argument.
        const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object') ? hostId : options;
        return new TakeFiveSession(roomId, players, resolvedOptions);
    },
};
