const WerewolfEngine = require('./engine');

const metadata = {
    type: 'werewolf',
    name: '狼人杀自动辅助',
    minPlayers: 9,
    maxPlayers: 12,
    playerCounts: [9, 12],
    roomSettings: [
        {
            key: 'playerCount',
            label: '本局人数',
            kind: 'choice',
            defaultValue: 9,
            options: [
                { value: 9, title: '9 人局', copy: '3 狼 · 3 神 · 3 民（预女猎）' },
                { value: 12, title: '12 人局', copy: '4 狼 · 4 神（预女猎守） · 4 民' },
            ],
            description: '这是固定开局人数，必须全部到齐才能开始。',
            requiredBeforeJoin: true,
        },
        {
            key: 'sheriffEnabled',
            label: '启用警长流程',
            kind: 'toggle',
            defaultValue: true,
            description: '包含上警、竞选发言、投票、PK 与警徽移交。',
        },
        {
            key: 'winCondition',
            label: '狼人胜利条件',
            kind: 'choice',
            defaultValue: 'edge',
            options: [
                { value: 'edge', title: '屠边', copy: '村民或神职任一方全部出局时狼人获胜。' },
                { value: 'parity', title: '人数追平', copy: '存活狼人数不少于存活好人数时狼人获胜。' },
            ],
        },
        {
            key: 'witchSelfSave',
            label: '女巫自救规则',
            kind: 'choice',
            defaultValue: 'firstNight',
            options: [
                { value: 'firstNight', title: '仅首夜可自救', copy: '常见网易标准板约定。' },
                { value: 'never', title: '全程不可自救', copy: '部分官方标准板或房规采用。' },
                { value: 'always', title: '整局可自救', copy: '扩展变体：每夜都允许自救。' },
            ],
            description: '开局前固定本局板子；同守同救仍会奶穿，不因自救选项改变。',
        },
    ],
};

class WerewolfSession {
    constructor(roomId, players, hostId, options = {}) {
        const sheriffEnabled = options.sheriffEnabled !== false;
        const winCondition = options.winCondition === 'parity' ? 'parity' : 'edge';
        const playerCount = Number(options.playerCount) === 12 ? 12 : 9;
        const witchSelfSave = ['firstNight', 'never', 'always'].includes(options.witchSelfSave) ? options.witchSelfSave : 'firstNight';
        this.engine = new WerewolfEngine(roomId, players, hostId, Math.random, Date.now, { sheriffEnabled, winCondition, playerCount, witchSelfSave });
        this.started = false;
    }
    start() { const result = this.engine.start(); if (result.success) this.started = true; return result; }
    handleAction(playerId, action) { return this.started ? this.engine.handleAction(playerId, action) : { success: false, message: '游戏尚未开始' }; }
    handlePlayerDisconnect(playerId) { return this.engine.handlePlayerDisconnect(playerId); }
    handlePlayerReconnect(playerId) { return this.engine.handlePlayerReconnect(playerId); }
    handlePlayerLeave(playerId) { return this.engine.handlePlayerLeave(playerId); }
    handleSystemTick() { return this.started ? this.engine.handleSystemTick() : null; }
    getPlayerState(playerId) { return this.engine.getPlayerState(playerId); }
    getPlayerAction(action, playerId) { return this.engine.getPlayerAction(action, playerId); }
    getWinner() { return this.engine.getWinner(); }
}

module.exports = { metadata, create(roomId, players, hostId, options) { return new WerewolfSession(roomId, players, hostId, options); } };
