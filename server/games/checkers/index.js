const CheckersEngine = require('./engine');

const metadata = { type: 'checkers', name: '跳棋', minPlayers: 2, maxPlayers: 6 };

class CheckersSession {
    constructor(roomId, players) {
        this.engine = new CheckersEngine(roomId, players);
        this.started = false;
    }

    start() {
        const result = this.engine.start();
        if (result.success) this.started = true;
        return result;
    }

    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerDisconnect(playerId) { return this.engine.handlePlayerDisconnect(playerId); }
    handlePlayerReconnect(playerId) { return this.engine.handlePlayerReconnect(playerId); }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players) { return new CheckersSession(roomId, players); } };
