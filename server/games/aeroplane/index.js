const AeroplaneEngine = require('./engine');

const metadata = { type: 'aeroplane', name: '飞行棋', minPlayers: 2, maxPlayers: 4 };

class AeroplaneSession {
    constructor(roomId, players) {
        this.engine = new AeroplaneEngine(roomId, players);
        this.started = false;
    }

    start() {
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
    create(roomId, players) { return new AeroplaneSession(roomId, players); },
};
