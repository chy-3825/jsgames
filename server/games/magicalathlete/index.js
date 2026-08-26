const MagicalAthleteEngine = require('./engine');
const metadata = { type: 'magicalathlete', name: '胡闹运动会', minPlayers: 2, maxPlayers: 6 };
class MagicalAthleteSession {
    constructor(roomId, players, options = {}) {
        this.options = options && typeof options === 'object' ? { ...options } : {};
        this.engine = new MagicalAthleteEngine(roomId, players, this.options);
        this.started = false;
    }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}
module.exports = { metadata, create(roomId, players, _hostId, options = {}) { return new MagicalAthleteSession(roomId, players, options); } };
