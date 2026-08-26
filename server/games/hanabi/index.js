const HanabiEngine = require('./engine');
const metadata = { type: 'hanabi', name: '花火', minPlayers: 2, maxPlayers: 5 };
class HanabiSession {
    constructor(roomId, players, options = {}) {
        // Keep the session adapter deterministic in tests and simulations while
        // retaining Math.random as the normal production source.
        const resolvedOptions = typeof options === 'function' ? {} : (options || {});
        const random = typeof options === 'function'
            ? options
            : (typeof resolvedOptions.random === 'function' ? resolvedOptions.random : Math.random);
        this.engine = new HanabiEngine(roomId, players, random, resolvedOptions);
        this.started = false;
    }

    start() {
        if (this.started || this.engine.status !== 'waiting') {
            return { success: false, message: '花火已经开始，不能重复开始' };
        }
        const result = this.engine.start();
        if (result.success) this.started = true;
        return result;
    }

    handleAction(playerId, action) {
        return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' };
    }

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
        return new HanabiSession(roomId, players, resolvedOptions);
    },
};
