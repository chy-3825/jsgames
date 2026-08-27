const DecryptoEngine = require('./engine');
const metadata = {
    type: 'decrypto',
    name: '谍报风云',
    minPlayers: 3,
    maxPlayers: 8,
    encryptorModes: ['fixed_vote', 'rotation', 'random'],
    roomSettings: [{
        key: 'encryptorMode',
        label: '加密员产生方式',
        kind: 'choice',
        defaultValue: 'rotation',
        options: [
            { value: 'fixed_vote', title: '固定投票', copy: '各队开局秘密投票，选出整局固定加密员。' },
            { value: 'rotation', title: '轮流担任', copy: '队员按照座位顺序依次担任加密员。' },
            { value: 'random', title: '每轮随机', copy: '每轮重新抽选，避免同一人连续担任。' },
        ],
    }],
};

class DecryptoSession {
    constructor(roomId, players, options = {}) {
        const random = typeof options === 'function' ? options : options?.random;
        this.engine = new DecryptoEngine(roomId, players, random || Math.random, typeof options === 'object' ? options : {});
        this.started = false;
    }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action, playerId) { return this.engine.getPlayerAction(action, playerId); }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = {
    metadata,
    create(roomId, players, hostId, gameOptions = {}) {
        const options = typeof hostId === 'function' || (hostId && typeof hostId === 'object' && !Array.isArray(hostId)) ? hostId : gameOptions;
        return new DecryptoSession(roomId, players, options);
    }
};
