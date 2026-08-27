const MISSION_SIZES = {
    5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
const ROLE_INFO = {
    merlin: { name: '梅林', faction: 'good' }, percival: { name: '派西维尔', faction: 'good' }, loyal: { name: '忠臣', faction: 'good' },
    assassin: { name: '刺客', faction: 'evil' }, minion: { name: '爪牙', faction: 'evil' }, morgana: { name: '莫甘娜', faction: 'evil' }, mordred: { name: '莫德雷德', faction: 'evil' }, oberon: { name: '奥伯伦', faction: 'evil' },
};

function roleSetup(playerCount, options = {}) {
    // Core Avalon setup.  Percival/Morgana/Mordred/Oberon are optional role
    // cards in the physical game, so they are opt-in rather than silently
    // inserted into every room.
    const evilCount = ({ 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 })[playerCount];
    const evilRoles = ['assassin'];
    if (options.morgana) evilRoles.push('morgana');
    if (options.mordred) evilRoles.push('mordred');
    if (options.oberon) evilRoles.push('oberon');
    if (evilRoles.length > evilCount) throw new Error(`${playerCount} 人局最多配置 ${evilCount} 名邪恶角色（刺客及可选角色合计）`);
    while (evilRoles.length < evilCount) evilRoles.push('minion');
    const goodRoles = ['merlin'];
    if (options.percival) goodRoles.push('percival');
    while (goodRoles.length + evilRoles.length < playerCount) goodRoles.push('loyal');
    return [...goodRoles, ...evilRoles].slice(0, playerCount);
}

function shuffle(values, random = Math.random) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }

class AvalonEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        if (typeof random === 'object') { options = random; random = Math.random; }
        this.roomId = roomId; this.random = random; this.options = options || {};
        this.players = (Array.isArray(players) ? players : []).map((player, index) => ({ id: player.id, name: player.name, seat: index + 1, role: null, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.status = 'waiting'; this.phase = 'waiting'; this.round = 0; this.leaderIndex = 0; this.rejectedTeams = 0; this.team = []; this.votes = {}; this.missionVotes = {}; this.missionHistory = []; this.successfulMissions = 0; this.failedMissions = 0; this.lastVote = null; this.lastMission = null; this.roleConfirmed = {}; this.actionLog = []; this.winner = null; this.winners = [];
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '阿瓦隆已经开始或已经结束' };
        if (this.players.length < 5 || this.players.length > 10) return { success: false, message: '阿瓦隆需要 5–10 名玩家' };
        if (this.players.some(player => !player.id) || new Set(this.players.map(player => player.id)).size !== this.players.length) return { success: false, message: '玩家身份必须唯一且有效' };
        let roles;
        try { roles = roleSetup(this.players.length, this.options); } catch (error) { return { success: false, message: error.message }; }
        shuffle(roles, this.random).forEach((role, index) => { this.players[index].role = role; this.players[index].isOnline = true; });
        this.status = 'playing'; this.phase = 'roleReveal'; this.round = 1; this.leaderIndex = 0; this.rejectedTeams = 0; this.successfulMissions = 0; this.failedMissions = 0; this.team = []; this.votes = {}; this.missionVotes = {}; this.missionHistory = []; this.roleConfirmed = {}; this.winner = null; this.winners = [];
        this.actionLog = ['身份已经分发，请各自查看并记住自己的秘密'];
        return this._success('身份已经分发，请先查看你的身份');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离线', state: this.getPlayerState(playerId) };
        if (this.phase === 'roleReveal') return this._confirmRole(player, action);
        if (this.phase === 'team') return this._proposeTeam(player, action);
        if (this.phase === 'vote') return this._vote(player, action);
        if (this.phase === 'mission') return this._mission(player, action);
        if (this.phase === 'assassin') return this._assassinate(player, action);
        return { success: false, message: '这一步现在无法进行', state: this.getPlayerState(playerId) };
    }

    _confirmRole(player, action) {
        if (action.kind !== 'confirmRole') return { success: false, message: '请先查看并记住自己的身份', state: this.getPlayerState(player.id) };
        if (this.roleConfirmed[player.id]) return { success: false, message: '你已经记下自己的身份', state: this.getPlayerState(player.id) };
        this.roleConfirmed[player.id] = true;
        return this._resolveRoleReveal(player.id);
    }

    _resolveRoleReveal(playerId = null) {
        const confirmed = Object.keys(this.roleConfirmed).length;
        if (confirmed < this.players.length) {
            const remaining = this.players.length - confirmed;
            return playerId && this.playerMap[playerId]?.isOnline
                ? this._privateSuccess(playerId, `你已记下身份，还有 ${remaining} 位玩家`)
                : this._success(`身份确认继续等待，还有 ${remaining} 位玩家`);
        }
        if (!this.players[this.leaderIndex]?.isOnline) {
            const firstOnline = this._nextOnlineIndex(this.leaderIndex, true);
            if (firstOnline >= 0) this.leaderIndex = firstOnline;
        }
        this.phase = 'team';
        this._log(`所有人都已记下身份，第1项任务开始，${this.players[this.leaderIndex]?.name || '在线玩家'} 担任队长`);
        return this._success('身份已经封存，圆桌议事开始');
    }

    _proposeTeam(player, action) {
        if (player.id !== this.players[this.leaderIndex]?.id) return { success: false, message: '只有当前队长可以组队', state: this.getPlayerState(player.id) };
        if (action.kind !== 'proposeTeam' || !Array.isArray(action.playerIds)) return { success: false, message: '请选择任务队伍', state: this.getPlayerState(player.id) };
        const size = MISSION_SIZES[this.players.length][this.round - 1];
        const ids = [...new Set(action.playerIds)];
        if (ids.length !== size || ids.some(id => !this.playerMap[id] || !this.playerMap[id].isOnline)) return { success: false, message: `本轮需要选择 ${size} 名在线玩家`, state: this.getPlayerState(player.id) };
        this.team = ids;
        this.votes = Object.fromEntries(this.players.filter(item => !item.isOnline).map(item => [item.id, false]));
        this.phase = 'vote'; this.lastVote = null;
        this._log(`${player.name} 提议由 ${ids.map(id => this.playerMap[id].name).join('、')} 执行第${this.round}项任务`);
        return this._success('队伍已经公布，请充分讨论后再投票');
    }

    _vote(player, action) {
        if (action.kind !== 'castVote' || typeof action.approve !== 'boolean') return { success: false, message: '请选择通过或拒绝', state: this.getPlayerState(player.id) };
        if (this.votes[player.id] !== undefined) return { success: false, message: '你已经投过票', state: this.getPlayerState(player.id) };
        this.votes[player.id] = action.approve;
        return this._resolveVote(player.id);
    }

    _resolveVote(playerId = null) {
        const voteCount = Object.keys(this.votes).length;
        if (voteCount < this.players.length) {
            const remaining = this.players.length - voteCount;
            return playerId && this.playerMap[playerId]?.isOnline
                ? this._privateSuccess(playerId, `你的立场已经决定，还有 ${remaining} 位玩家`)
                : this._success(`投票继续等待，还有 ${remaining} 位玩家`);
        }
        const approved = Object.values(this.votes).filter(Boolean).length > this.players.length / 2;
        this.lastVote = { ...this.votes };
        this.actionLog.push(approved ? '队伍投票通过，进入任务' : '队伍投票未通过，队长顺时针轮换');
        if (!approved) {
            this.rejectedTeams += 1;
            if (this.rejectedTeams >= 5) return this._finish('evil', '连续五次组队被拒绝，邪恶阵营获胜');
            const nextLeader = this._nextOnlineIndex(this.leaderIndex);
            if (nextLeader < 0) return this._finish('evil', '没有在线玩家继续远征，邪恶阵营获胜');
            this.leaderIndex = nextLeader; this.phase = 'team'; this.team = []; this.votes = {};
            return this._success('队伍被拒绝');
        }
        this.rejectedTeams = 0; this.phase = 'mission'; this.missionVotes = {};
        return this._success('队伍获得圆桌批准，远征即将出发');
    }

    _mission(player, action) {
        if (!this.team.includes(player.id)) return { success: false, message: '只有本轮远征队员可以投入任务牌', state: this.getPlayerState(player.id) };
        if (this.missionVotes[player.id] !== undefined) return { success: false, message: '你的任务牌已经投入', state: this.getPlayerState(player.id) };
        if (action.kind !== 'missionVote' || !['success', 'fail'].includes(action.result)) return { success: false, message: '请选择任务成功或失败', state: this.getPlayerState(player.id) };
        if (action.result === 'fail' && ROLE_INFO[player.role]?.faction === 'good') return { success: false, message: '善良阵营不能选择任务失败', state: this.getPlayerState(player.id) };
        this.missionVotes[player.id] = action.result;
        return this._resolveMission(player.id);
    }

    _resolveMission(playerId = null) {
        const voteCount = Object.keys(this.missionVotes).length;
        if (voteCount < this.team.length) {
            const remaining = this.team.length - voteCount;
            return playerId && this.playerMap[playerId]?.isOnline
                ? this._privateSuccess(playerId, `你的任务牌已经投入，还有 ${remaining} 名队员`)
                : this._success(`任务牌继续等待，还有 ${remaining} 名队员`);
        }
        const fails = Object.values(this.missionVotes).filter(result => result === 'fail').length;
        const requiredFails = this.players.length >= 7 && this.round === 4 ? 2 : 1;
        const success = fails < requiredFails;
        this.lastMission = { round: this.round, team: this.team.slice(), fails, requiredFails, success };
        this.missionHistory.push({ ...this.lastMission });
        if (success) this.successfulMissions += 1; else this.failedMissions += 1;
        this._log(`第${this.round}项任务${success ? '成功' : `失败（${fails} 张失败牌）`}`);
        if (!success && this.failedMissions >= 3) return this._finish('evil', '三项任务失败，邪恶阵营获胜');
        if (success && this.successfulMissions >= 3) { this.phase = 'assassin'; this._log('三项任务成功，但最后一把匕首仍未落下'); return this._success('刺客请作出本局最后的选择'); }
        if (this.round >= 5) return this._finish(this.successfulMissions > this.failedMissions ? 'good' : 'evil', '五项任务完成');
        this.round += 1;
        const nextLeader = this._nextOnlineIndex(this.leaderIndex);
        if (nextLeader < 0) return this._finish('evil', '没有在线玩家继续远征，邪恶阵营获胜');
        this.leaderIndex = nextLeader; this.phase = 'team'; this.team = []; this.votes = {}; this.missionVotes = {};
        return this._success('远征结果已经揭晓，圆桌议事重新开始');
    }

    _assassinate(player, action) {
        if (player.role !== 'assassin') return { success: false, message: '只有刺客可以执行终局刺杀', state: this.getPlayerState(player.id) };
        if (action.kind !== 'assassinate' || !this.playerMap[action.targetId]) return { success: false, message: '请选择一名玩家', state: this.getPlayerState(player.id) };
        const target = this.playerMap[action.targetId];
        if (ROLE_INFO[target.role]?.faction !== 'good') return { success: false, message: '刺客只能选择一名善良阵营玩家', state: this.getPlayerState(player.id) };
        return this._finish(target.role === 'merlin' ? 'evil' : 'good', target.role === 'merlin' ? '刺客成功找出梅林，邪恶阵营获胜' : '刺客没有找出梅林，善良阵营获胜');
    }

    _finish(faction, message) {
        this.status = 'ended'; this.phase = 'ended'; this.winner = { faction, name: faction === 'good' ? '善良阵营' : '邪恶阵营' }; this.winners = [this.winner]; this._log(message); return this._success(message);
    }

    getPublicState() {
        const currentLeader = this.players[this.leaderIndex];
        return { roomId: this.roomId, status: this.status, phase: this.phase, round: this.round, missionSize: this.status === 'playing' ? MISSION_SIZES[this.players.length][this.round - 1] : null, leaderId: currentLeader?.id || null, leaderName: currentLeader?.name || null, team: this.team.map(id => ({ id, name: this.playerMap[id]?.name })), voteCount: Object.keys(this.votes).length, missionVoteCount: Object.keys(this.missionVotes).length, roleConfirmCount: Object.keys(this.roleConfirmed).length, rejectedTeams: this.rejectedTeams, successfulMissions: this.successfulMissions, failedMissions: this.failedMissions, lastVote: this.lastVote, lastMission: this.lastMission, missionHistory: this.missionHistory.map(item => ({ ...item, team: item.team.map(id => ({ id, name: this.playerMap[id]?.name })) })), players: this.players.map(player => ({ id: player.id, name: player.name, seat: player.seat, isOnline: player.isOnline, roleConfirmed: Boolean(this.roleConfirmed[player.id]), role: this.status === 'ended' ? player.role : null, isLeader: player.id === currentLeader?.id })), actionLog: this.actionLog.slice(-20), winner: this.winner };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId];
        state.myId = playerId; state.myRole = player?.role || null;
        // Merlin sees evil agents except the two hidden-evil variants:
        // Mordred and Oberon are invisible to Merlin in the base rules.
        const visibleEvil = item => ROLE_INFO[item.role]?.faction === 'evil' && !['mordred', 'oberon'].includes(item.role);
        state.knownPlayers = player?.role === 'merlin' ? this.players.filter(visibleEvil).map(item => ({ id: item.id, name: item.name, seat: item.seat, faction: 'evil' })) : player?.role === 'percival' ? this.players.filter(item => item.role === 'merlin' || item.role === 'morgana').map(item => ({ id: item.id, name: item.name, seat: item.seat, faction: item.role === 'morgana' ? 'evil' : 'good', possible: true })) : ['assassin', 'minion', 'morgana', 'mordred'].includes(player?.role) ? this.players.filter(item => item.id !== playerId && ['assassin', 'minion', 'morgana', 'mordred'].includes(item.role)).map(item => ({ id: item.id, name: item.name, seat: item.seat, faction: 'evil' })) : [];
        state.myRoleConfirmed = Boolean(this.roleConfirmed[playerId]); state.myVote = this.votes[playerId]; state.myMissionVote = this.missionVotes[playerId];
        state.assassinationTargets = player?.role === 'assassin' && this.phase === 'assassin' ? this.players.filter(item => ROLE_INFO[item.role]?.faction === 'good').map(item => ({ id: item.id, name: item.name, seat: item.seat })) : [];
        state.availableActions = { confirmRole: this.phase === 'roleReveal' && !state.myRoleConfirmed, proposeTeam: this.phase === 'team' && this.leaderIndex === this.players.findIndex(item => item.id === playerId), castVote: this.phase === 'vote' && this.votes[playerId] === undefined, missionVote: this.phase === 'mission' && this.team.includes(playerId) && this.missionVotes[playerId] === undefined, assassinate: this.phase === 'assassin' && player?.role === 'assassin' };
        return state;
    }

    _nextOnlineIndex(fromIndex, includeCurrent = false) {
        for (let offset = includeCurrent ? 0 : 1; offset <= this.players.length; offset += 1) {
            const index = (fromIndex + offset) % this.players.length;
            if (this.players[index]?.isOnline) return index;
        }
        return -1;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        const wasLeader = this.phase === 'team' && this.players[this.leaderIndex]?.id === playerId;
        player.isOnline = false;
        this._log(`${player.name} 离开了阿瓦隆`);

        // A permanent leave must never remain in a phase's required-action
        // count.  Its role is still kept for the finished-game audit, while
        // all pending decisions are resolved with the neutral safe default.
        if (this.phase === 'roleReveal') {
            this.roleConfirmed[playerId] = true;
            return this._resolveRoleReveal();
        }
        if (this.phase === 'team' && wasLeader) {
            const next = this._nextOnlineIndex(this.leaderIndex);
            if (next >= 0) this.leaderIndex = next;
            return this._success(`${player.name} 离开，队长已交给在线玩家`);
        }
        if (this.phase === 'vote') {
            this.votes[playerId] = false;
            return this._resolveVote();
        }
        if (this.phase === 'mission' && this.team.includes(playerId)) {
            this.missionVotes[playerId] = 'success';
            return this._resolveMission();
        }
        if (this.phase === 'assassin' && player.role === 'assassin') return this._finish('good', '刺客离开，善良阵营赢得终局');
        return this._success(`${player.name} 已离开`);
    }
    _log(message) { this.actionLog.push(message); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner }; }
    _privateSuccess(playerId, message) { return { ...this._success(message), privateFor: playerId, publicMessage: '' }; }
    getPlayerAction(action, playerId) {
        if (!action?.privateFor || action.privateFor === playerId) return action;
        const { privateFor, publicMessage, ...safe } = action;
        return { ...safe, message: publicMessage ?? '' };
    }
    getWinner() { return this.winner; }
}

module.exports = AvalonEngine;
module.exports.MISSION_SIZES = MISSION_SIZES;
module.exports.ROLE_INFO = ROLE_INFO;
module.exports.roleSetup = roleSetup;
