const KingdominoEngine = require('./engine');
const metadata = { type: 'kingdomino', name: '多米诺王国', minPlayers: 2, maxPlayers: 4 };
class KingdominoSession {
    constructor(roomId, players, options = {}) {
        const random = typeof options === 'function' ? options : options?.random;
        this.options = typeof options === 'object' && options ? { ...options } : {};
        this.engine = new KingdominoEngine(roomId, players, random || Math.random, this.options);
        this.started = false;
    }
    start() { if (this.started || this.engine.status !== 'waiting') return { success: false, message: '多米诺王国已经开始，不能重复开始' }; const result = this.engine.start(); if (result.success) this.started = true; return result; }
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
        return new KingdominoSession(roomId, players, resolvedOptions);
    },
};
