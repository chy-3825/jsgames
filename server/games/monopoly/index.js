const MonopolyEngine = require('./engine');
const metadata = { type: 'monopoly', name: '环城大富翁', minPlayers: 2, maxPlayers: 8 };
class MonopolySession {
    constructor(roomId, players, options = {}) {
        const random = typeof options === 'function' ? options : options?.random;
        this.engine = new MonopolyEngine(roomId, players, random);
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
        const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object') ? hostId : options;
        return new MonopolySession(roomId, players, resolvedOptions);
    },
};
