const GobangEngine = require('./engine');

const metadata = {
    type: 'gobang', name: '五子棋', minPlayers: 2, maxPlayers: 2,
    studyMode: true, studyPlayerCount: 2,
    roomSettings: [{ key: 'gameMode', label: '游戏模式', kind: 'choice', defaultValue: 'match', description: '对弈模式由双方分别操作；棋谱模式由房主切换执棋方并独自推演。', options: [{ value: 'match', title: '对弈模式', copy: '两位玩家各执一方。' }, { value: 'study', title: '棋谱模式', copy: '房主一人控制双方，开始后可切换到黑方或白方。' }] }],
};

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
    handleStudySetup(playerId, action) { return this.started ? this.engine.handleStudySetup(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players) { return new GobangSession(roomId, players); } };
