const JunqiEngine = require('./engine');

const metadata = { type: 'junqi', name: '军棋', minPlayers: 2, maxPlayers: 2 };

class JunqiSession {
    constructor(roomId, players) { this.engine = new JunqiEngine(roomId, players); this.started = false; }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players) { return new JunqiSession(roomId, players); } };
