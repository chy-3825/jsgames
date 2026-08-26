const WitchTownEngine = require('./engine');
const metadata = { type: 'witchtown', name: '猎巫镇', minPlayers: 4, maxPlayers: 12 };
class WitchTownSession {
    constructor(roomId, players, options = {}) {
        const random = typeof options === 'function' ? options : options?.random;
        this.engine = new WitchTownEngine(roomId, players, random);
        this.started = false;
    }
    start() {
        if (this.started) return { success: false, message: '游戏已经开始或已经结束' };
        const result = this.engine.start();
        if (result.success) this.started = true;
        return result;
    }
    handleAction(id, action) { return this.started ? this.engine.handleAction(id, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(id) { return this.engine.handlePlayerLeave(id); }
    getPlayerState(id) { return this.engine.getPlayerState(id); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}
module.exports = {
    metadata,
    create(roomId, players, hostId, options = {}) {
        const resolvedOptions = typeof hostId === 'function' || (hostId && typeof hostId === 'object') ? hostId : options;
        return new WitchTownSession(roomId, players, resolvedOptions);
    },
};
