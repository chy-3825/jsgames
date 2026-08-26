const SplendorEngine = require('./engine');
const metadata = { type: 'splendor', name: '璀璨宝石', minPlayers: 2, maxPlayers: 4 };
class SplendorSession {
    constructor(roomId, players, options = {}) {
        const resolvedOptions = typeof options === 'function' ? {} : (options || {});
        const random = typeof options === 'function'
            ? options
            : (typeof resolvedOptions.random === 'function' ? resolvedOptions.random : Math.random);
        this.engine = new SplendorEngine(roomId, players, random, resolvedOptions);
        this.started = false;
    }

    start() {
        if (this.started || this.engine.status !== 'waiting') return { success: false, message: '璀璨宝石已经开始，不能重复开始' };
        const result = this.engine.start();
        if (result.success) this.started = true;
        return result;
    }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = {
    metadata,
    create(roomId, players, hostId, options = {}) {
        const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object')
            ? hostId
            : options;
        return new SplendorSession(roomId, players, resolvedOptions);
    },
};
