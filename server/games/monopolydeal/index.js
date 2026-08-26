const MonopolyDealEngine = require('./engine');
const metadata = { type: 'monopolydeal', name: '大富翁纸牌', minPlayers: 2, maxPlayers: 5 };
class MonopolyDealSession {
    constructor(roomId, players, options = {}) {
        const random = typeof options === 'function' ? options : options?.random;
        this.engine = new MonopolyDealEngine(roomId, players, random);
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
    create(roomId, players, hostId, gameOptions = {}) {
        // Room passes hostId and optional gameOptions as the third/fourth
        // adapter arguments. Direct tests may pass a random function as the
        // third argument, so keep both forms supported.
        const options = typeof hostId === 'function' ? hostId : gameOptions;
        return new MonopolyDealSession(roomId, players, options);
    },
};
