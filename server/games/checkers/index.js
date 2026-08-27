const CheckersEngine = require('./engine');

const metadata = {
    type: 'checkers', name: '跳棋', minPlayers: 2, maxPlayers: 6,
    studyMode: true, studyPlayerCount: 2,
    roomSettings: [{ key: 'gameMode', label: '游戏模式', kind: 'choice', defaultValue: 'match', description: '对弈模式由各方分别操作；棋谱模式使用双方研究盘，由房主切换执棋方。', options: [{ value: 'match', title: '对弈模式', copy: '2–6 位玩家分别操作。' }, { value: 'study', title: '棋谱模式', copy: '房主一人控制双方并切换到红方或蓝方。' }] }],
};

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
    handleStudySetup(playerId, action) { return this.started ? this.engine.handleStudySetup(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerDisconnect(playerId) { return this.engine.handlePlayerDisconnect(playerId); }
    handlePlayerReconnect(playerId) { return this.engine.handlePlayerReconnect(playerId); }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action) { return action; }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players) { return new CheckersSession(roomId, players); } };
