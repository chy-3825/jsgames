const XiangqiEngine = require('./engine');
const metadata = {
    type: 'xiangqi', name: '中国象棋', minPlayers: 2, maxPlayers: 2,
    studyMode: true, studyPlayerCount: 2,
    roomSettings: [{ key: 'gameMode', label: '游戏模式', kind: 'choice', defaultValue: 'match', description: '对弈模式由双方分别操作；棋谱模式由房主切换执棋方并独自推演。', options: [{ value: 'match', title: '对弈模式', copy: '两位玩家各执一方。' }, { value: 'study', title: '棋谱模式', copy: '房主一人控制双方，开始后可切换到红方或黑方。' }] }],
};
class XiangqiSession { constructor(roomId, players) { this.engine = new XiangqiEngine(roomId, players); this.started = false; } start() { const result = this.engine.start(); if (result.success) this.started = true; return result; } handleAction(id, action) { return this.started ? this.engine.handleAction(id, action) : { success: false, message: '游戏尚未开始' }; } handleStudySetup(id, action) { return this.started ? this.engine.handleStudySetup(id, action) : { success: false, message: '游戏尚未开始' }; } handlePlayerLeave(id) { return this.engine.handlePlayerLeave(id); } getPlayerState(id) { return this.engine.getPlayerState(id); } getPlayerAction(action) { return action; } getWinner() { return this.engine.getWinner(); } }
module.exports = { metadata, create(roomId, players) { return new XiangqiSession(roomId, players); } };
