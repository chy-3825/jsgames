const GobangEngine = require('./engine');

const metadata = { type: 'gobang', name: '五子棋', minPlayers: 2, maxPlayers: 2 };

class GobangSession {
    constructor(roomId, players) {
        this.engine = new GobangEngine(roomId, players);
        this.started = false;
    }

    start() {
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

module.exports = { metadata, create(roomId, players) { return new GobangSession(roomId, players); } };
