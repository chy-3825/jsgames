const ROLE_SETS = {
    9: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager'],
    12: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'],
};
const ROLE_INFO = {
    werewolf: { name: '狼人', faction: 'wolf' }, seer: { name: '预言家', faction: 'good' },
    witch: { name: '女巫', faction: 'good' }, hunter: { name: '猎人', faction: 'good' },
    guard: { name: '守卫', faction: 'good' }, villager: { name: '村民', faction: 'good' },
};
const NIGHT_PHASES = ['nightGuard', 'nightWolf', 'nightSeer', 'nightWitch'];
const PHASE_ROLE = { nightGuard: 'guard', nightWolf: 'werewolf', nightSeer: 'seer', nightWitch: 'witch' };
const PHASE_NAMES = { roleReveal: '查看身份', nightGuard: '守卫请睁眼', nightWolf: '狼人请睁眼', nightSeer: '预言家请睁眼', nightWitch: '女巫请睁眼', deathResolution: '离场时刻', lastWords: '遗言时间', sheriffSignup: '上警报名', sheriffCampaign: '警上发言', sheriffVote: '警长投票', sheriffRunoffSpeech: '警长平票 PK', sheriffRunoffVote: '警长 PK 投票', day: '白天发言', vote: '放逐投票', ended: '本局结束' };
const LAST_WORDS_SECONDS = 60;
const SPEECH_SECONDS = 90;
const SHERIFF_SPEECH_SECONDS = 90;
const SHERIFF_RESPONSE_SECONDS = 120;

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

class WerewolfEngine {
    constructor(roomId, players, hostId, random = Math.random, now = Date.now, options = {}) {
        const requestedPlayerCount = Number(options.playerCount);
        this.playerCount = ROLE_SETS[requestedPlayerCount] ? requestedPlayerCount : players.length > 9 ? 12 : 9;
        this.roomId = roomId; this.realPlayers = players.slice(0, this.playerCount).map((player, index) => ({ id: player.id, name: player.name, seat: index + 1, online: true, left: false }));
        this.hostId = hostId || this.realPlayers[0]?.id; this.random = random; this.now = now; this.winCondition = options.winCondition || 'parity'; this.status = 'waiting'; this.phase = 'waiting'; this.day = 0;
        this.seats = []; this.activeSeat = {}; this.roleConfirmedSeats = {}; this.dayReadySeats = {}; this.dayVoteRound = 1; this.dayTieTargets = []; this.night = {}; this.votes = {}; this.deathResolution = null; this.pendingHunter = null; this.pendingBadge = null; this.lastWordsFlow = null; this.lastWordsHistory = []; this.speechFlow = null; this.flowPausedAt = null; this.announcement = null; this.announcementHistory = []; this.voteHistory = []; this.lastVoteResult = null; this.publicEvent = null; this.publicEvents = []; this.eventSequence = 0; this.sheriff = this._newSheriff(Boolean(options.sheriffEnabled)); this.log = []; this.winner = null; this.witchItems = { antidote: true, poison: true };
    }

    start() {
        if (this.realPlayers.length < 1 || this.realPlayers.length > this.playerCount) return { success: false, message: `狼人杀辅助当前支持 ${this.playerCount} 个座位` };
        const roles = shuffle(ROLE_SETS[this.playerCount], this.random);
        this.seats = roles.map((role, index) => ({ number: index + 1, role, alive: true, controllerId: this.realPlayers[index % this.realPlayers.length].id }));
        this.realPlayers.forEach(player => { this.activeSeat[player.id] = player.seat; });
        this.status = 'playing'; this.phase = 'roleReveal'; this.day = 0; this.roleConfirmedSeats = {}; this.dayReadySeats = {}; this.dayVoteRound = 1; this.dayTieTargets = []; this.night = {}; this.votes = {}; this.deathResolution = null; this.pendingHunter = null; this.pendingBadge = null; this.lastWordsFlow = null; this.lastWordsHistory = []; this.speechFlow = null; this.flowPausedAt = null; this.announcement = null; this.announcementHistory = []; this.voteHistory = []; this.lastVoteResult = null; this.publicEvent = null; this.publicEvents = []; this.eventSequence = 0; this.sheriff = this._newSheriff(this.sheriff.enabled); this.winner = null;
        this.log = [`${this.playerCount} 人局已经就绪，请各自查看并记住身份`];
        return this._success('游戏开始，请先查看你的身份');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return this._fail(playerId, '本局还没有开始');
        const real = this.realPlayers.find(player => player.id === playerId && player.online);
        if (!real) return this._fail(playerId, '你不在这局游戏中');
        if (action.kind === 'switchSeat') return this._switchSeat(real, action.seat);
        if (this._offlineControlledSeats().length) return this._fail(playerId, '有玩家暂时离线，游戏会等他回来');
        const timedAdvance = this._advanceAutomatic();
        // Whichever request first observes an expired deadline becomes the
        // system clock pulse. Return a successful public envelope immediately
        // so Room broadcasts the advanced state instead of hiding a mutation
        // inside an unrelated action failure.
        if (timedAdvance) return this._success('发言时间结束，轮到下一位');
        if (action.kind === 'timerTick') return this._success('计时已经更新，请继续');
        if (action.kind === 'confirmRole') return this._confirmRole(real);
        if (action.kind === 'confirmAllRoles') return this._confirmAllRoles(real);
        if (action.kind === 'confirmDeadRole') return this._confirmDeadRole(real);
        if (action.kind === 'confirmDeathResolution') return this._confirmDeathResolution(real);
        if (action.kind === 'startLastWords') return this._startTimedTurn(real, 'lastWords');
        if (action.kind === 'finishLastWords') return this._finishTimedTurn(real, 'lastWords', action);
        if (action.kind === 'stageNightAction') return this._stageNightAction(real, action);
        if (action.kind === 'confirmNightAction') return this._confirmNightAction(real);
        if (action.kind === 'cancelNightAction') return this._cancelNightAction(real);
        if (action.kind === 'confirmSeerResult') return this._confirmSeerResult(real);
        if (action.kind === 'nightAction') return this._fail(real.id, '夜间技能必须先选择目标，再完成确认');
        if (action.kind === 'hunterAction') return this._hunterAction(real, action);
        if (action.kind === 'sheriffSignup') return this._sheriffSignup(real, action.choice);
        if (action.kind === 'finishSheriffCampaign') return this._finishSheriffCampaign(real, action.choice);
        if (action.kind === 'sheriffVote') return this._sheriffVote(real, action.targetSeat);
        if (action.kind === 'finishSheriffRunoffSpeech') return this._finishSheriffRunoffSpeech(real);
        if (action.kind === 'sheriffBadgeAction') return this._sheriffBadgeAction(real, action);
        if (action.kind === 'startSpeech') return this._startTimedTurn(real, 'day');
        if (action.kind === 'finishSpeech') return this._finishTimedTurn(real, 'day');
        if (action.kind === 'confirmDay') return this._confirmDay(real);
        if (action.kind === 'vote') return this._vote(real, action.targetSeat);
        if (action.kind === 'nextPhase' || action.kind === 'resolveVote') return this._fail(playerId, '相关玩家全部行动后，游戏会自然继续');
        return this._fail(playerId, '这一步现在无法进行');
    }

    _switchSeat(real, seatNumber) {
        const seat = this._seat(seatNumber);
        if (!seat) return this._fail(real.id, '没有这个席位');
        if (!this._controlsSeat(real.id, seat)) return this._fail(real.id, '这个席位属于另一名玩家');
        this.activeSeat[real.id] = seat.number;
        // The room broadcasts successful action envelopes to every player.
        // A seat switch changes only this device's private perspective, so its
        // acknowledgement must not reveal the selected seat to other devices.
        return this._privateSuccess(real.id, `正在查看 ${seat.number} 号测试席位`);
    }

    _confirmRole(real) {
        if (this.phase !== 'roleReveal') return this._fail(real.id, '查看身份的时间已经结束');
        const seat = this._active(real.id);
        if (!seat || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '请先回到自己的席位');
        if (this.roleConfirmedSeats[seat.number]) return this._fail(real.id, '你已经记下这个身份了');
        this.roleConfirmedSeats[seat.number] = true;
        const confirmed = Object.keys(this.roleConfirmedSeats).length;
        if (confirmed === this.seats.length) this._beginFirstNight();
        return this._privateSuccess(real.id, confirmed === this.seats.length ? '所有人都已记下身份，夜幕即将降临' : `你已记下身份，还有 ${this.seats.length - confirmed} 位玩家`);
    }

    _confirmAllRoles(real) {
        if (this.realPlayers.length !== 1) return this._fail(real.id, '只有单人座位测试模式可以一次确认全部身份');
        if (this.phase !== 'roleReveal') return this._fail(real.id, '查看身份的时间已经结束');
        const seat = this._active(real.id);
        if (!seat || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '请先选择一个测试席位');
        this.seats.forEach(item => { this.roleConfirmedSeats[item.number] = true; });
        this._beginFirstNight();
        return this._privateSuccess(real.id, '测试模式已确认全部身份，夜幕即将降临');
    }

    _beginFirstNight() {
        this.day = 1;
        this.night = {};
        this.dayReadySeats = {};
        this.votes = {};
        this.lastWordsFlow = null;
        this.speechFlow = null;
        this.announcement = null;
        this.log.push('所有人都已记下身份，第 1 夜降临');
        this._enterNextNightPhase(-1);
    }

    _beginNextNight() {
        const lastGuard = this.night.guard || null;
        this.day += 1;
        this.night = lastGuard ? { lastGuard } : {};
        this.dayReadySeats = {};
        this.votes = {};
        this.lastWordsFlow = null;
        this.speechFlow = null;
        this.announcement = null;
        this.log.push(`第 ${this.day} 夜开始`);
        this._enterNextNightPhase(-1);
    }

    _enterNextNightPhase(currentIndex = NIGHT_PHASES.indexOf(this.phase)) {
        const phase = NIGHT_PHASES[currentIndex + 1];
        if (phase) {
            this.phase = phase;
            return;
        }
        this._resolveNight();
    }

    _confirmDay(real) {
        if (this.phase !== 'day') return this._fail(real.id, '现在不是白天发言时间');
        const seat = this._active(real.id);
        if (!seat?.alive || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '只有仍在场的玩家可以完成发言');
        if (this._currentTimedSeat(this.speechFlow) !== seat.number) return this._fail(real.id, '还没有轮到你发言');
        // Backward-compatible one-tap action. New clients use startSpeech and
        // finishSpeech separately so that the shared screen can show a timer.
        if (!this.speechFlow.turn) this._startTimedTurn(real, 'day');
        return this._finishTimedTurn(real, 'day');
    }

    _newSheriff(enabled) {
        return { enabled, status: enabled ? 'pending' : 'disabled', holderSeat: null, signup: {}, candidates: [], withdrawn: [], campaignIndex: 0, votes: {}, round: 0, runoffCandidates: [], runoffIndex: 0, results: [], deadlineAt: null, turn: null };
    }

    _beginDayAgenda() {
        if (this.sheriff.enabled && this.day === 1 && this.sheriff.status === 'pending') {
            this.phase = 'sheriffSignup';
            this.sheriff.status = 'signup';
            this.sheriff.signup = {};
            this._setSheriffDeadline(SHERIFF_RESPONSE_SECONDS);
            this.log.push('首日上警报名开始');
            this._publishEvent('sheriffSignup', '警长竞选', '上警报名开始', []);
            return;
        }
        this._beginDaySpeech();
    }

    _sheriffSignup(real, choice) {
        if (this.phase !== 'sheriffSignup' || this.sheriff.status !== 'signup') return this._fail(real.id, '上警报名已经结束');
        const seat = this._active(real.id);
        if (!seat?.alive || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '只有仍在场的玩家可以参与上警选择');
        if (Object.hasOwn(this.sheriff.signup, seat.number)) return this._fail(real.id, '你已经作出上警选择');
        if (!['run', 'skip'].includes(choice)) return this._fail(real.id, '请选择上警或不上警');
        this.sheriff.signup[seat.number] = choice;
        const alive = this.seats.filter(item => item.alive);
        const completed = Object.keys(this.sheriff.signup).length;
        if (completed < alive.length) return this._privateSuccess(real.id, `你的选择已经记下，还有 ${alive.length - completed} 位玩家`);
        this.sheriff.candidates = alive.filter(item => this.sheriff.signup[item.number] === 'run').map(item => item.number);
        if (this.sheriff.candidates.length === 0) {
            this._finishSheriffElection(null, '无人上警，本局无警长');
        } else if (this.sheriff.candidates.length === 1) {
            this._finishSheriffElection(this.sheriff.candidates[0], `${this.sheriff.candidates[0]} 号是唯一上警玩家，不经投票成为警长`);
        } else {
            this.phase = 'sheriffCampaign';
            this.sheriff.status = 'campaign';
            this.sheriff.campaignIndex = 0;
            this._startSheriffTurn('campaign');
            this.log.push(`上警玩家：${this.sheriff.candidates.join('、')} 号`);
            this._publishEvent('sheriffCandidates', '警长竞选', `上警玩家：${this.sheriff.candidates.join('、')} 号`, []);
        }
        return this._privateSuccess(real.id, '所有人都已作出选择，警长竞选继续');
    }

    _finishSheriffCampaign(real, choice) {
        if (this.phase !== 'sheriffCampaign' || this.sheriff.status !== 'campaign') return this._fail(real.id, '现在不是警上发言时间');
        const seat = this._active(real.id);
        const current = this.sheriff.candidates[this.sheriff.campaignIndex];
        if (!seat?.alive || !this._controlsSeat(real.id, seat) || seat.number !== current) return this._fail(real.id, '请等待当前候选人完成警上发言');
        if (!['stay', 'withdraw'].includes(choice)) return this._fail(real.id, '请选择继续竞选或退水');
        if (choice === 'withdraw') this.sheriff.withdrawn.push(seat.number);
        this.sheriff.campaignIndex += 1;
        this.sheriff.turn = null;
        this.sheriff.deadlineAt = null;
        if (this.sheriff.campaignIndex < this.sheriff.candidates.length) {
            this._startSheriffTurn('campaign');
            return this._success(`${seat.number} 号警上发言完成`);
        }
        const finalists = this.sheriff.candidates.filter(number => !this.sheriff.withdrawn.includes(number));
        this.sheriff.candidates = finalists;
        if (finalists.length === 0) this._finishSheriffElection(null, '候选人全部退水，本局无警长');
        else if (finalists.length === 1) this._finishSheriffElection(finalists[0], `${finalists[0]} 号成为唯一候选人，不经投票成为警长`);
        else this._beginSheriffVote(finalists, false);
        return this._success('警上发言结束，警长竞选继续');
    }

    _beginSheriffVote(candidates, runoff) {
        this.phase = runoff ? 'sheriffRunoffVote' : 'sheriffVote';
        this.sheriff.status = runoff ? 'runoffVote' : 'vote';
        this.sheriff.round = runoff ? 2 : 1;
        this.sheriff.votes = {};
        this._setSheriffDeadline(SHERIFF_RESPONSE_SECONDS);
        if (runoff) this.sheriff.runoffCandidates = candidates.slice();
        this.log.push(`${runoff ? '警长 PK' : '警长'}投票开始`);
        if (!this._sheriffEligibleVoters(candidates).length) this._finishSheriffElection(null, '没有符合条件的投票者，本局无警长');
    }

    _sheriffEligibleVoters(candidates = this._currentSheriffCandidates()) {
        return this.seats.filter(seat => seat.alive && !candidates.includes(seat.number));
    }

    _currentSheriffCandidates() {
        return this.phase === 'sheriffRunoffVote' || this.phase === 'sheriffRunoffSpeech' ? this.sheriff.runoffCandidates.slice() : this.sheriff.candidates.slice();
    }

    _sheriffVote(real, targetSeat) {
        if (!['sheriffVote', 'sheriffRunoffVote'].includes(this.phase)) return this._fail(real.id, '现在不能投警长票');
        const candidates = this._currentSheriffCandidates();
        const voter = this._active(real.id);
        const eligible = this._sheriffEligibleVoters(candidates);
        if (!voter?.alive || !this._controlsSeat(real.id, voter) || !eligible.some(item => item.number === voter.number)) return this._fail(real.id, '候选人不能参与本轮警长投票');
        if (Object.hasOwn(this.sheriff.votes, voter.number)) return this._fail(real.id, '你已经投过警长票了');
        const target = targetSeat == null ? null : Number(targetSeat);
        if (target !== null && !candidates.includes(target)) return this._fail(real.id, '只能投给本轮候选人或弃票');
        this.sheriff.votes[voter.number] = target;
        const completed = Object.keys(this.sheriff.votes).length;
        if (completed < eligible.length) return this._privateSuccess(real.id, `你的警长票已经投出，还有 ${eligible.length - completed} 位玩家`);
        this._resolveSheriffVote(candidates);
        return this._privateSuccess(real.id, '警长投票已完成，结果已公开');
    }

    _resolveSheriffVote(candidates) {
        const counts = Object.fromEntries(candidates.map(number => [number, 0]));
        Object.values(this.sheriff.votes).forEach(number => { if (number != null) counts[number] += 1; });
        const high = Math.max(0, ...Object.values(counts));
        const top = high ? candidates.filter(number => counts[number] === high) : [];
        const result = { round: this.sheriff.round, ballots: Object.entries(this.sheriff.votes).map(([voterSeat, targetSeat]) => ({ voterSeat: Number(voterSeat), targetSeat })).sort((a, b) => a.voterSeat - b.voterSeat), counts: { ...counts }, topSeats: top.slice() };
        this.sheriff.results.push(result);
        const countText = candidates.map(number => `${number} 号 ${counts[number] || 0} 票`).join(' · ');
        this._publishEvent('sheriffVote', this.sheriff.round === 2 ? '警长 PK 投票' : '警长投票', countText || '本轮无人得票', []);
        if (top.length === 1) return this._finishSheriffElection(top[0], `${top[0]} 号当选警长`);
        if (this.sheriff.round === 1 && top.length > 1) {
            this.phase = 'sheriffRunoffSpeech';
            this.sheriff.status = 'runoffSpeech';
            this.sheriff.runoffCandidates = top.slice();
            this.sheriff.runoffIndex = 0;
            this.sheriff.votes = {};
            this._startSheriffTurn('runoffSpeech');
            this.log.push(`警长首轮平票，${top.join('、')} 号进入 PK`);
            this._publishEvent('sheriffRunoff', '警长投票平票', `${top.join('、')} 号进入 PK`, []);
            return;
        }
        this._finishSheriffElection(null, this.sheriff.round === 2 ? '警长 PK 投票仍平票，本局无警长' : '警长投票全部弃票，本局无警长');
    }

    _finishSheriffRunoffSpeech(real) {
        if (this.phase !== 'sheriffRunoffSpeech') return this._fail(real.id, '现在不是警长 PK 发言时间');
        const seat = this._active(real.id);
        const current = this.sheriff.runoffCandidates[this.sheriff.runoffIndex];
        if (!seat?.alive || !this._controlsSeat(real.id, seat) || seat.number !== current) return this._fail(real.id, '请等待当前 PK 候选人发言');
        this.sheriff.runoffIndex += 1;
        this.sheriff.turn = null;
        this.sheriff.deadlineAt = null;
        if (this.sheriff.runoffIndex >= this.sheriff.runoffCandidates.length) this._beginSheriffVote(this.sheriff.runoffCandidates, true);
        else this._startSheriffTurn('runoffSpeech');
        return this._success(`${seat.number} 号 PK 发言完成`);
    }

    _finishSheriffElection(holderSeat, message) {
        this.sheriff.holderSeat = holderSeat;
        this.sheriff.status = holderSeat ? 'elected' : 'none';
        this.sheriff.votes = {};
        this.sheriff.deadlineAt = null;
        this.sheriff.turn = null;
        this.log.push(message);
        this._publishEvent('sheriffElection', '警长竞选结果', message, holderSeat ? [holderSeat] : []);
        this._beginDaySpeech();
    }

    _setSheriffDeadline(seconds) {
        const startedAt = Number(this.now());
        this.sheriff.deadlineAt = startedAt + seconds * 1000;
        this.sheriff.turn = null;
    }

    _startSheriffTurn(kind) {
        const seat = kind === 'campaign' ? this.sheriff.candidates[this.sheriff.campaignIndex] : this.sheriff.runoffCandidates[this.sheriff.runoffIndex];
        const startedAt = Number(this.now());
        this.sheriff.turn = { kind, seat, startedAt, deadlineAt: startedAt + SHERIFF_SPEECH_SECONDS * 1000 };
        this.sheriff.deadlineAt = this.sheriff.turn.deadlineAt;
    }

    _beginDaySpeech() {
        const aliveSeats = this.seats.filter(seat => seat.alive).map(seat => seat.number).sort((left, right) => left - right);
        if (!aliveSeats.length) return;
        const preferredStart = this.sheriff.enabled && aliveSeats.includes(this.sheriff.holderSeat) ? this.sheriff.holderSeat : null;
        const startIndex = preferredStart ? aliveSeats.indexOf(preferredStart) : Math.floor(this.random() * aliveSeats.length);
        const direction = this.random() < 0.5 ? 'clockwise' : 'counterclockwise';
        const order = Array.from({ length: aliveSeats.length }, (_, offset) => {
            const delta = direction === 'clockwise' ? offset : -offset;
            return aliveSeats[(startIndex + delta + aliveSeats.length) % aliveSeats.length];
        });
        this.phase = 'day';
        this.dayReadySeats = {};
        this.votes = {};
        this.dayVoteRound = 1;
        this.dayTieTargets = [];
        this.speechFlow = {
            day: this.day,
            startSeat: order[0],
            direction,
            order,
            currentIndex: 0,
            completedSeats: {},
            turn: null,
            durationSeconds: SPEECH_SECONDS,
            sheriff: { enabled: this.sheriff.enabled, holderSeat: this.sheriff.holderSeat },
        };
        this.log.push(`第 ${this.day} 天发言顺序：${order.join('→')}（${direction === 'clockwise' ? '顺时针' : '逆时针'}）`);
    }

    _beginLastWords(seats, after) {
        const order = [...new Set(seats.map(Number))].filter(number => this._seat(number) && !this._seat(number).alive);
        if (!order.length) {
            this._continueAfterDeathResolution(after);
            return;
        }
        this.phase = 'lastWords';
        this.lastWordsFlow = { day: this.day, after, order, currentIndex: 0, completedSeats: {}, turn: null, durationSeconds: LAST_WORDS_SECONDS };
        this.log.push(`请 ${order.join('、')} 号按顺序留遗言`);
    }

    _currentTimedSeat(flow) {
        return flow?.order?.[flow.currentIndex] || null;
    }

    _startTimedTurn(real, phase) {
        if (this.phase !== phase) return this._fail(real.id, phase === 'day' ? '现在不是白天发言时间' : '现在不是遗言时间');
        const flow = phase === 'day' ? this.speechFlow : this.lastWordsFlow;
        const seat = this._active(real.id);
        if (!flow || !seat || !this._controlsSeat(real.id, seat) || this._currentTimedSeat(flow) !== seat.number) return this._fail(real.id, '现在还没有轮到你');
        if (flow.turn) return this._fail(real.id, '本轮发言已经开始');
        const startedAt = Number(this.now());
        flow.turn = { seat: seat.number, startedAt, deadlineAt: startedAt + flow.durationSeconds * 1000 };
        this._publishEvent(phase === 'day' ? 'speechStart' : 'lastWordsStart', phase === 'day' ? '白天发言' : '遗言时间', `${seat.number} 号${phase === 'day' ? '开始发言' : '开始遗言'}`, []);
        return this._success(`${seat.number} 号${phase === 'day' ? '发言' : '遗言'}开始`);
    }

    _finishTimedTurn(real, phase, action = {}) {
        if (this.phase !== phase) return this._fail(real.id, phase === 'day' ? '现在不是白天发言时间' : '现在不是遗言时间');
        const flow = phase === 'day' ? this.speechFlow : this.lastWordsFlow;
        const seat = this._active(real.id);
        if (!flow || !seat || !this._controlsSeat(real.id, seat) || this._currentTimedSeat(flow) !== seat.number) return this._fail(real.id, '现在还没有轮到你');
        if (!flow.turn) return this._fail(real.id, '请先开始本轮发言');
        const isLast = flow.currentIndex === flow.order.length - 1;
        this._completeTimedTurn(phase, false, action);
        return this._success(isLast
            ? (phase === 'day' ? '所有存活玩家都已发言，现在进入放逐投票' : '本轮遗言已经结束，游戏继续')
            : `${seat.number} 号发言完成，请下一位继续`);
    }

    _completeTimedTurn(phase, timedOut, action = {}) {
        const flow = phase === 'day' ? this.speechFlow : this.lastWordsFlow;
        const seatNumber = this._currentTimedSeat(flow);
        if (!flow || !seatNumber) return;
        flow.completedSeats[seatNumber] = true;
        if (phase === 'day') this.dayReadySeats[seatNumber] = true;
        if (phase === 'lastWords') {
            const text = String(action.text || '').trim().slice(0, 240);
            this.lastWordsHistory.push({ day: flow.day, seat: seatNumber, text, timedOut: Boolean(timedOut), recordedAt: Number(this.now()) });
        }
        this.log.push(`${seatNumber} 号${phase === 'day' ? '发言' : '遗言'}${timedOut ? '超时结束' : '完成'}`);
        flow.currentIndex += 1;
        flow.turn = null;
        if (flow.currentIndex < flow.order.length) return;
        if (phase === 'day') {
            this.phase = 'vote';
            this.votes = {};
            return;
        }
        const after = flow.after;
        this.lastWordsFlow = null;
        this._continueAfterDeathResolution(after);
    }

    _advanceExpiredTimedFlow() {
        const phase = this.phase === 'day' ? 'day' : this.phase === 'lastWords' ? 'lastWords' : null;
        const flow = phase === 'day' ? this.speechFlow : phase === 'lastWords' ? this.lastWordsFlow : null;
        if (!flow?.turn || Number(this.now()) < flow.turn.deadlineAt) return false;
        this._completeTimedTurn(phase, true);
        return true;
    }

    _advanceAutomatic() {
        if (this._offlineControlledSeats().length) return false;
        if (this._advanceExpiredTimedFlow()) return true;
        const now = Number(this.now());
        if (!this.sheriff.enabled || !this.sheriff.deadlineAt || now < this.sheriff.deadlineAt) return false;
        if (this.phase === 'sheriffSignup') {
            this.seats.filter(seat => seat.alive && !Object.hasOwn(this.sheriff.signup, seat.number)).forEach(seat => { this.sheriff.signup[seat.number] = 'skip'; });
            const candidates = this.seats.filter(seat => seat.alive && this.sheriff.signup[seat.number] === 'run').map(seat => seat.number);
            this.sheriff.candidates = candidates;
            if (!candidates.length) this._finishSheriffElection(null, '上警报名超时且无人报名，本局无警长');
            else if (candidates.length === 1) this._finishSheriffElection(candidates[0], `${candidates[0]} 号是唯一上警玩家，不经投票成为警长`);
            else { this.phase = 'sheriffCampaign'; this.sheriff.status = 'campaign'; this.sheriff.campaignIndex = 0; this._startSheriffTurn('campaign'); }
            return true;
        }
        if (this.phase === 'sheriffCampaign') {
            const current = this.sheriff.candidates[this.sheriff.campaignIndex];
            if (current != null && !this.sheriff.withdrawn.includes(current)) this.sheriff.withdrawn.push(current);
            this.sheriff.campaignIndex += 1;
            this.sheriff.turn = null; this.sheriff.deadlineAt = null;
            if (this.sheriff.campaignIndex < this.sheriff.candidates.length) this._startSheriffTurn('campaign');
            else {
                this.sheriff.candidates = this.sheriff.candidates.filter(number => !this.sheriff.withdrawn.includes(number));
                if (!this.sheriff.candidates.length) this._finishSheriffElection(null, '警上发言超时，候选人全部退水');
                else if (this.sheriff.candidates.length === 1) this._finishSheriffElection(this.sheriff.candidates[0], `${this.sheriff.candidates[0]} 号成为唯一候选人，不经投票成为警长`);
                else this._beginSheriffVote(this.sheriff.candidates, false);
            }
            return true;
        }
        if (this.phase === 'sheriffRunoffSpeech') {
            this.sheriff.runoffIndex += 1;
            this.sheriff.turn = null; this.sheriff.deadlineAt = null;
            if (this.sheriff.runoffIndex >= this.sheriff.runoffCandidates.length) this._beginSheriffVote(this.sheriff.runoffCandidates, true);
            else this._startSheriffTurn('runoffSpeech');
            return true;
        }
        if (this.phase === 'sheriffVote' || this.phase === 'sheriffRunoffVote') {
            const candidates = this._currentSheriffCandidates();
            this._sheriffEligibleVoters(candidates).forEach(seat => { if (!Object.hasOwn(this.sheriff.votes, seat.number)) this.sheriff.votes[seat.number] = null; });
            this._resolveSheriffVote(candidates);
            return true;
        }
        return false;
    }

    handleSystemTick() {
        if (this.status !== 'playing') return null;
        if (!this._advanceAutomatic()) return null;
        return this._success('计时结束，游戏已经继续');
    }

    _pauseTimedFlow() {
        if (this.flowPausedAt == null) this.flowPausedAt = Number(this.now());
    }

    _resumeTimedFlow() {
        if (this.flowPausedAt == null) return;
        const pausedFor = Math.max(0, Number(this.now()) - this.flowPausedAt);
        const flow = this.phase === 'day' ? this.speechFlow : this.phase === 'lastWords' ? this.lastWordsFlow : null;
        if (flow?.turn) {
            flow.turn.startedAt += pausedFor;
            flow.turn.deadlineAt += pausedFor;
        }
        if (this.sheriff.deadlineAt != null) {
            this.sheriff.deadlineAt += pausedFor;
            if (this.sheriff.turn) {
                this.sheriff.turn.startedAt += pausedFor;
                this.sheriff.turn.deadlineAt += pausedFor;
            }
        }
        this.flowPausedAt = null;
    }

    _confirmDeadRole(real) {
        if (!NIGHT_PHASES.includes(this.phase) || PHASE_ROLE[this.phase] === 'werewolf') return this._fail(real.id, '你现在不需要确认夜间行动');
        const seat = this._active(real.id);
        if (!seat || !this._controlsSeat(real.id, seat) || seat.alive || seat.role !== PHASE_ROLE[this.phase]) return this._fail(real.id, '现在不需要你作出这个选择');
        this._enterNextNightPhase();
        return this._privateSuccess(real.id, '今夜无需行动，请继续保持安静');
    }

    _stageNightAction(real, action) {
        const seat = this._active(real.id);
        const requiredRole = PHASE_ROLE[this.phase];
        if (!seat?.alive || !this._controlsSeat(real.id, seat) || !requiredRole || seat.role !== requiredRole) return this._fail(real.id, '夜色还没有轮到你行动');
        const target = action.targetSeat == null ? null : this._seat(action.targetSeat);
        if (target && !target.alive) return this._fail(real.id, '目标已出局');
        if (requiredRole === 'guard') {
            if (this.night.guard) return this._fail(real.id, '守卫本夜已经行动');
            if (!target) return this._fail(real.id, '请选择守护目标');
            if (this.night.lastGuard === target.number) return this._fail(real.id, '守卫不能连续两夜守护同一人');
        } else if (requiredRole === 'werewolf') {
            if (this.night.wolfResolved) return this._fail(real.id, '狼队本夜投票已经结束');
            if (!target || target.role === 'werewolf') return this._fail(real.id, '请选择一名非狼人目标');
            if (this.night.wolfVoteRound === 2 && !this.night.wolfTieTargets.includes(target.number)) return this._fail(real.id, '第二轮只能投给首轮平票目标');
            if (this.night.wolfVotes?.[seat.number]) return this._fail(real.id, '你在本轮狼队投票中已经投过票');
        } else if (requiredRole === 'seer') {
            if (this.night.seer) return this._fail(real.id, '预言家本夜已经行动');
            if (!target || target.number === seat.number) return this._fail(real.id, '请选择其他玩家进行查验');
        } else if (requiredRole === 'witch') {
            if (this.night.witchActed) return this._fail(real.id, '女巫本夜已经行动');
            if (action.choice === 'save') {
                if (!this.witchItems.antidote || !this.night.wolf) return this._fail(real.id, '解药不可用');
            } else if (action.choice === 'poison') {
                if (!this.witchItems.poison || !target) return this._fail(real.id, '毒药不可用');
            } else if (action.choice !== 'pass') return this._fail(real.id, '请选择用药或跳过');
        }
        if (!this.night.pendingActions) this.night.pendingActions = {};
        this.night.pendingActions[seat.number] = { phase: this.phase, targetSeat: target?.number || null, choice: action.choice || null };
        const choiceText = requiredRole === 'witch' && action.choice === 'save' ? `使用解药救下 ${this.night.wolf} 号`
            : requiredRole === 'witch' && action.choice === 'poison' ? `对 ${target.number} 号使用毒药`
                : requiredRole === 'witch' ? '本夜不使用药物' : `${target.number} 号`;
        return this._privateSuccess(real.id, `你选择了${choiceText}，请再确认一次`);
    }

    _confirmNightAction(real) {
        const seat = this._active(real.id);
        const pending = seat && this.night.pendingActions?.[seat.number];
        if (!seat?.alive || !this._controlsSeat(real.id, seat) || !pending || pending.phase !== this.phase) return this._fail(real.id, '现在没有需要确认的夜间选择');
        delete this.night.pendingActions[seat.number];
        if (seat.role === 'seer' && this.phase === 'nightSeer') {
            const target = this._seat(pending.targetSeat);
            if (!target?.alive || target.number === seat.number) {
                this.night.pendingActions[seat.number] = pending;
                return this._fail(real.id, '查验目标已经无效，请重新选择');
            }
            this.night.seer = target.number;
            this.night.seerResultAcknowledged = false;
            return this._privateSuccess(real.id, '查验结果已经揭晓，请记住对方阵营');
        }
        const result = this._nightAction(real, pending);
        if (!result.success) this.night.pendingActions[seat.number] = pending;
        return result;
    }

    _cancelNightAction(real) {
        const seat = this._active(real.id);
        const pending = seat && this.night.pendingActions?.[seat.number];
        if (!seat || !this._controlsSeat(real.id, seat) || !pending || pending.phase !== this.phase) return this._fail(real.id, '现在没有可以返回重选的行动');
        delete this.night.pendingActions[seat.number];
        return this._privateSuccess(real.id, '请重新选择目标');
    }

    _confirmSeerResult(real) {
        const seat = this._active(real.id);
        if (this.phase !== 'nightSeer' || !seat?.alive || seat.role !== 'seer' || !this._controlsSeat(real.id, seat) || !this.night.seer || this.night.seerResultAcknowledged) return this._fail(real.id, '现在没有需要记住的查验结果');
        this.night.seerResultAcknowledged = true;
        this._enterNextNightPhase();
        return this._privateSuccess(real.id, '你已记下查验结果，请闭眼等待');
    }

    _nightAction(real, action) {
        const seat = this._active(real.id);
        if (!seat?.alive || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '你已经出局，或这不是你的席位');
        const target = action.targetSeat == null ? null : this._seat(action.targetSeat);
        if (target && !target.alive) return this._fail(real.id, '目标已出局');
        if (this.phase === 'nightGuard' && seat.role === 'guard') {
            if (this.night.guard) return this._fail(real.id, '守卫本夜已经行动');
            if (!target) return this._fail(real.id, '请选择守护目标');
            if (this.night.lastGuard === target.number) return this._fail(real.id, '守卫不能连续两夜守护同一人');
            this.night.guard = target.number;
            this._enterNextNightPhase();
            return this._privateSuccess(real.id, `你决定守护 ${target.number} 号，请闭眼等待`);
        }
        if (this.phase === 'nightWolf' && seat.role === 'werewolf') {
            if (this.night.wolfResolved) return this._fail(real.id, '狼队本夜投票已经结束');
            if (!target || target.role === 'werewolf') return this._fail(real.id, '请选择一名非狼人目标');
            if (this.night.wolfVoteRound === 2 && !this.night.wolfTieTargets.includes(target.number)) return this._fail(real.id, '第二轮只能投给首轮平票目标');
            if (!this.night.wolfVotes) this.night.wolfVotes = {};
            if (!this.night.wolfVoteRound) this.night.wolfVoteRound = 1;
            if (this.night.wolfVotes[seat.number]) return this._fail(real.id, '你在本轮狼队投票中已经投过票');
            this.night.wolfVotes[seat.number] = target.number;
            const aliveWolves = this.seats.filter(item => item.alive && item.role === 'werewolf');
            const submitted = Object.keys(this.night.wolfVotes).length;
            if (submitted < aliveWolves.length) return this._privateSuccess(real.id, `你的袭击选择已藏入夜色，还有 ${aliveWolves.length - submitted} 名狼人`);
            return this._settleWolfVote(real.id);
        }
        if (this.phase === 'nightSeer' && seat.role === 'seer') {
            if (this.night.seer) return this._fail(real.id, '预言家本夜已经行动');
            if (!target || target.number === seat.number) return this._fail(real.id, '请选择其他玩家进行查验');
            this.night.seer = target.number;
            this._enterNextNightPhase();
            return this._privateSuccess(real.id, `查验结果：${target.number} 号是${ROLE_INFO[target.role].faction === 'wolf' ? '狼人' : '好人'}。请记住这个结果`);
        }
        if (this.phase === 'nightWitch' && seat.role === 'witch') {
            if (this.night.witchActed) return this._fail(real.id, '女巫本夜已经行动');
            if (action.choice === 'save') { if (!this.witchItems.antidote || !this.night.wolf) return this._fail(real.id, '解药不可用'); this.night.saved = true; this.witchItems.antidote = false; }
            else if (action.choice === 'poison') { if (!this.witchItems.poison || !target) return this._fail(real.id, '毒药不可用'); this.night.poison = target.number; this.witchItems.poison = false; }
            else if (action.choice !== 'pass') return this._fail(real.id, '请选择用药或跳过');
            this.night.witchActed = true;
            this._enterNextNightPhase();
            return this._privateSuccess(real.id, '药瓶已经收起，请闭眼等待天明');
        }
        return this._fail(real.id, '夜色尚未呼唤你的身份');
    }

    _settleWolfVote(playerId) {
        const counts = {};
        Object.values(this.night.wolfVotes).forEach(number => { counts[number] = (counts[number] || 0) + 1; });
        const highest = Math.max(...Object.values(counts));
        const leaders = Object.keys(counts).filter(number => counts[number] === highest).map(Number);
        if (leaders.length === 1) {
            this.night.wolf = leaders[0];
            this.night.wolfResolved = true;
            this._enterNextNightPhase();
            return this._privateSuccess(playerId, `狼队意见一致，今夜的目标是 ${leaders[0]} 号`);
        }
        if (this.night.wolfVoteRound < 2) {
            this.night.wolfVoteRound = 2;
            this.night.wolfVotes = {};
            this.night.wolfTieTargets = leaders;
            return this._privateSuccess(playerId, `第一轮出现平票（${leaders.join('、')}号），请进行最后一轮选择`);
        }
        this.night.wolf = null;
        this.night.wolfResolved = true;
        this.night.wolfTieTargets = leaders;
        this._enterNextNightPhase();
        return this._privateSuccess(playerId, `第二轮仍然平票（${leaders.join('、')}号），今夜无人遇袭`);
    }

    _resolveNight() {
        const deaths = [];
        const killedByWolf = this.night.wolf && !this.night.saved && this.night.guard !== this.night.wolf ? this.night.wolf : null;
        if (killedByWolf) deaths.push(killedByWolf);
        if (this.night.poison && !deaths.includes(this.night.poison)) deaths.push(this.night.poison);
        deaths.sort((left, right) => left - right);
        deaths.forEach(number => { const seat = this._seat(number); if (seat) seat.alive = false; });
        const text = deaths.length ? `天亮，${deaths.join('、')} 号倒牌` : '天亮，昨夜平安夜';
        this.announcement = { day: this.day, kind: 'night', deaths: deaths.slice(), peaceful: deaths.length === 0, text, createdAt: Number(this.now()) };
        this.announcementHistory.push({ ...this.announcement, deaths: this.announcement.deaths.slice() });
        this._publishEvent(deaths.length ? 'nightDeaths' : 'peacefulNight', deaths.length ? '天亮了' : '平安夜', deaths.length ? `昨夜的死者是 ${deaths.join('、')} 号` : '昨夜无人出局', deaths);
        this.log.push(text);
        this._beginDeathResolution(deaths, 'day', this.night.poison ? [this.night.poison] : []);
    }

    _beginDeathResolution(deaths, after, poisonedSeats = []) {
        const seats = [...new Set(deaths.map(Number))].filter(number => this._seat(number));
        if (!seats.length) {
            this._checkWinner();
            if (this.status === 'playing') this._continueAfterDeathResolution(after);
            return;
        }
        seats.forEach(number => this._publishEvent('elimination', '玩家出局', `${number} 号已出局`, [number]));
        const normalizedPoisoned = poisonedSeats.map(Number);
        const hunter = seats.map(number => this._seat(number)).find(seat => seat?.role === 'hunter' && !normalizedPoisoned.includes(seat.number));
        // A legal hunter shot is part of the same elimination chain and must
        // resolve before checking the final boundary. Other decisive deaths
        // finish immediately without waiting for a private acknowledgement.
        if (!hunter) {
            this._checkWinner();
            if (this.status === 'ended') return;
        }
        this.deathResolution = { seats, settledSeats: {}, after, poisonedSeats: normalizedPoisoned };
        this.pendingHunter = hunter ? { seat: hunter.number } : null;
        if (hunter) this._publishEvent('hunterReveal', '身份揭晓', `${hunter.number} 号的身份是猎人`, [hunter.number]);
        this.pendingBadge = this.sheriff.holderSeat && seats.includes(this.sheriff.holderSeat) ? { seat: this.sheriff.holderSeat } : null;
        this._autoTearBadgeIfNecessary();
        this.phase = 'deathResolution';
        this._completeDeathResolution();
    }

    _confirmDeathResolution(real) {
        if (this.phase !== 'deathResolution' || !this.deathResolution) return this._fail(real.id, '现在没有需要完成的离场行动');
        const seat = this._active(real.id);
        if (!seat || !this._controlsSeat(real.id, seat) || !this.deathResolution.seats.includes(seat.number)) return this._fail(real.id, '只有本轮出局玩家需要完成离场行动');
        if (this.deathResolution.settledSeats[seat.number]) return this._fail(real.id, '你的离场行动已经完成');
        if (this.pendingHunter?.seat === seat.number) return this._fail(real.id, '请先选择开枪目标，或放弃开枪');
        if (this.pendingBadge?.seat === seat.number) return this._fail(real.id, '请先选择移交或撕毁警徽');
        this.deathResolution.settledSeats[seat.number] = true;
        this._completeDeathResolution();
        return this._privateSuccess(real.id, '你的离场行动已经完成，请等待其他出局玩家');
    }

    _hunterAction(real, action) {
        if (this.phase !== 'deathResolution' || !this.deathResolution || !this.pendingHunter) return this._fail(real.id, '现在没有可以发动的离场技能');
        const hunter = this._active(real.id);
        if (!hunter || !this._controlsSeat(real.id, hunter) || hunter.number !== this.pendingHunter.seat || hunter.role !== 'hunter') return this._fail(real.id, '现在只有出局的猎人可以作出选择');
        let message = '猎人选择不开枪';
        if (action.choice === 'shoot') {
            const target = this._seat(action.targetSeat);
            if (!target?.alive) return this._fail(real.id, '请选择一名存活玩家作为开枪目标');
            target.alive = false;
            message = `猎人开枪带走 ${target.number} 号`;
            this.log.push(`猎人开枪，${target.number} 号一同出局`);
            this._publishEvent('hunterShot', '枪声响起', `猎人开枪带走了 ${target.number} 号`, [target.number]);
            this._publishEvent('elimination', '玩家出局', `${target.number} 号已出局`, [target.number]);
            this.deathResolution.seats.push(target.number);
            if (this.sheriff.holderSeat === target.number) this.pendingBadge = { seat: target.number };
            if (this.deathResolution.after === 'day' && this.announcement) {
                this.announcement.deaths.push(target.number);
                this.announcement.text += `；猎人开枪，${target.number} 号一同出局`;
                const recorded = this.announcementHistory[this.announcementHistory.length - 1];
                if (recorded?.day === this.announcement.day) {
                    recorded.deaths = this.announcement.deaths.slice();
                    recorded.text = this.announcement.text;
                }
            }
        } else if (action.choice === 'pass') {
            this.log.push(`${hunter.number} 号猎人选择不开枪`);
            this._publishEvent('hunterPass', '猎人抉择', `${hunter.number} 号猎人选择不开枪`, []);
        } else return this._fail(real.id, '请选择开枪或放弃');
        this.pendingHunter = null;
        this._autoTearBadgeIfNecessary();
        if (this.pendingBadge?.seat !== hunter.number) this.deathResolution.settledSeats[hunter.number] = true;
        this._completeDeathResolution();
        return this._privateSuccess(real.id, `${message}，请等待游戏继续`);
    }

    _completeDeathResolution() {
        if (!this.deathResolution || !this.deathResolution.seats.every(number => this.deathResolution.settledSeats[number])) return;
        const { after } = this.deathResolution;
        const resolvedSeats = this.deathResolution.seats.slice();
        this.deathResolution = null;
        this.pendingHunter = null;
        this.pendingBadge = null;
        this._checkWinner();
        if (this.status === 'playing') this._beginLastWords(resolvedSeats, after);
    }

    _continueAfterDeathResolution(after) {
        if (after === 'day') {
            this._beginDayAgenda();
        } else this._beginNextNight();
    }

    _autoTearBadgeIfNecessary() {
        if (!this.pendingBadge) return;
        const legal = this.seats.filter(seat => seat.alive && seat.number !== this.pendingBadge.seat);
        if (legal.length) return;
        const deadSheriff = this.pendingBadge.seat;
        this.sheriff.holderSeat = null;
        this.sheriff.status = 'torn';
        this.pendingBadge = null;
        if (this.deathResolution) this.deathResolution.settledSeats[deadSheriff] = true;
        this.log.push('场上已无可接过警徽的玩家，警徽就此撕毁');
        this._publishEvent('badgeTorn', '警徽流失', '警徽已经撕毁', []);
    }

    _sheriffBadgeAction(real, action) {
        if (this.phase !== 'deathResolution' || !this.deathResolution || !this.pendingBadge) return this._fail(real.id, '现在没有需要处理的警徽');
        const sheriffSeat = this._active(real.id);
        if (!sheriffSeat || !this._controlsSeat(real.id, sheriffSeat) || sheriffSeat.number !== this.pendingBadge.seat) return this._fail(real.id, '现在只有出局的警长可以处理警徽');
        if (this.pendingHunter?.seat === sheriffSeat.number) return this._fail(real.id, '请先完成猎人的离场行动');
        if (action.choice === 'transfer') {
            const target = this._seat(action.targetSeat);
            if (!target?.alive || target.number === sheriffSeat.number) return this._fail(real.id, '警徽只能移交给其他存活玩家');
            this.sheriff.holderSeat = target.number;
            this.sheriff.status = 'elected';
            this.log.push(`${sheriffSeat.number} 号将警徽移交给 ${target.number} 号`);
            this._publishEvent('badgeTransfer', '警徽移交', `${sheriffSeat.number} 号将警徽移交给 ${target.number} 号`, [target.number]);
        } else if (action.choice === 'tear') {
            this.sheriff.holderSeat = null;
            this.sheriff.status = 'torn';
            this.log.push(`${sheriffSeat.number} 号选择撕毁警徽`);
            this._publishEvent('badgeTorn', '警徽流失', `${sheriffSeat.number} 号选择撕毁警徽`, []);
        } else return this._fail(real.id, '请选择移交或撕毁警徽');
        this.deathResolution.settledSeats[sheriffSeat.number] = true;
        this.pendingBadge = null;
        this._completeDeathResolution();
        return this._privateSuccess(real.id, '警徽已经处理，请等待游戏继续');
    }

    _vote(real, targetSeat) {
        if (this.phase !== 'vote') return this._fail(real.id, '现在不是放逐投票时间');
        const voter = this._active(real.id); const abstain = targetSeat === null || targetSeat === undefined; const target = abstain ? null : this._seat(targetSeat);
        if (!voter?.alive || !this._controlsSeat(real.id, voter) || (!abstain && !target?.alive)) return this._fail(real.id, '只有仍在场的玩家可以投票，且只能选择仍在场的目标');
        if (!abstain && this.dayVoteRound === 2 && !this.dayTieTargets.includes(target.number)) return this._fail(real.id, '第二轮只能投给首轮平票玩家');
        if (Object.prototype.hasOwnProperty.call(this.votes, voter.number)) return this._fail(real.id, '你在本轮已经投过票了');
        this.votes[voter.number] = abstain ? null : target.number;
        const aliveCount = this.seats.filter(seat => seat.alive).length;
        const submittedCount = Object.keys(this.votes).length;
        if (submittedCount === aliveCount) {
            const outcome = this._resolveVote();
            return this._success(`${voter.number} 号已经投票；${outcome}`);
        }
        return this._success(`${voter.number} 号已经投票，还有 ${aliveCount - submittedCount} 位玩家`);
    }

    _resolveVote() {
        const weightedCounts = {}; Object.entries(this.votes).forEach(([voter, number]) => { if (number !== null) weightedCounts[number] = (weightedCounts[number] || 0) + (Number(voter) === this.sheriff.holderSeat ? 3 : 2); });
        const high = Math.max(0, ...Object.values(weightedCounts)); const top = Object.keys(weightedCounts).filter(number => weightedCounts[number] === high).map(Number);
        const counts = Object.fromEntries(Object.entries(weightedCounts).map(([number, units]) => [number, units / 2]));
        const round = this.dayVoteRound;
        const message = high && top.length === 1 ? `${top[0]} 号被放逐` : round === 1 ? top.length ? `首轮平票（${top.join('、')}号），进入第二轮投票` : '首轮全部弃权，进入第二轮投票' : top.length ? '第二轮仍平票，本轮无人出局' : '第二轮全部弃权，本轮无人出局';
        if (high && top.length === 1) this._seat(top[0]).alive = false;
        this.log.push(message);
        const result = {
            day: this.day,
            round,
            ballots: Object.entries(this.votes).map(([voterSeat, targetSeat]) => ({ voterSeat: Number(voterSeat), targetSeat: targetSeat === null ? null : Number(targetSeat), weight: Number(voterSeat) === this.sheriff.holderSeat ? 1.5 : 1 })).sort((left, right) => left.voterSeat - right.voterSeat),
            counts: Object.fromEntries(Object.entries(counts).map(([seat, count]) => [Number(seat), count])),
            topSeats: top.slice(),
            exiledSeat: high && top.length === 1 ? top[0] : null,
            tied: !(high && top.length === 1),
            message,
            final: Boolean(high && top.length === 1) || round === 2,
            resolvedAt: Number(this.now()),
        };
        this.lastVoteResult = result;
        this._publishEvent(high && top.length === 1 ? 'exile' : 'voteTie', '投票结束', high && top.length === 1 ? `${top[0]} 号玩家被放逐` : message, high && top.length === 1 ? [top[0]] : []);
        this.voteHistory.push(result);
        this.votes = {};
        if (!(high && top.length === 1) && round === 1) {
            this.dayVoteRound = 2;
            this.dayTieTargets = top.slice();
            return message;
        }
        this.dayVoteRound = 1;
        this.dayTieTargets = [];
        const exiled = high && top.length === 1 ? this._seat(top[0]) : null;
        if (exiled) {
            this._beginDeathResolution([exiled.number], 'night');
            return `所有人都已投票：${message}。请出局玩家完成离场行动`;
        }
        this._checkWinner();
        if (this.status === 'playing') this._beginNextNight();
        return `所有人都已投票：${message}`;
    }

    _checkWinner() {
        const wolves = this.seats.filter(seat => seat.alive && seat.role === 'werewolf').length;
        const good = this.seats.filter(seat => seat.alive && seat.role !== 'werewolf').length;
        const villagers = this.seats.filter(seat => seat.alive && seat.role === 'villager').length;
        const gods = this.seats.filter(seat => seat.alive && !['werewolf', 'villager'].includes(seat.role)).length;
        if (!wolves) this._finish('good', '好人阵营获胜', 'allWolvesEliminated', '所有狼人已被消灭，小镇恢复了和平与宁静。');
        else if (this.winCondition === 'edge' ? (!villagers || !gods) : wolves >= good) {
            const reason = this.winCondition === 'edge' ? (!villagers ? 'allVillagersEliminated' : 'allGodsEliminated') : 'parity';
            const text = reason === 'allVillagersEliminated' ? '最后的平民已经倒下，狼人占领了小镇。' : reason === 'allGodsEliminated' ? '守护小镇的神职已经覆灭，黑夜再无人能够阻挡。' : '狼群已经掌控局势，小镇彻底坠入长夜。';
            this._finish('wolf', '狼人阵营获胜', reason, text);
        }
    }
    _publishEvent(kind, title, text, eliminatedSeats = []) {
        this.publicEvent = { id: ++this.eventSequence, kind, title, text, eliminatedSeats: eliminatedSeats.slice(), day: this.day, createdAt: Number(this.now()) };
        this.publicEvents.push({ ...this.publicEvent, eliminatedSeats: this.publicEvent.eliminatedSeats.slice() });
        if (this.publicEvents.length > 30) this.publicEvents.shift();
    }
    _finish(faction, message, reason, text) {
        const triggerEvent = this.publicEvents.slice().reverse().find(event => !['elimination', 'hunterReveal'].includes(event.kind)) || this.publicEvent;
        const groups = {};
        this.seats.forEach(seat => { const name = ROLE_INFO[seat.role]?.name || seat.role; (groups[name] ||= []).push(seat.number); });
        const identityText = Object.entries(groups).map(([name, seats]) => `${name}：${seats.join('、')} 号`).join('；');
        this._publishEvent('identityReveal', '全员身份揭晓', identityText, []);
        this.status = 'ended'; this.phase = 'ended';
        this.winner = { faction, name: message, reason, text, trigger: triggerEvent?.kind || null, eliminatedSeats: triggerEvent?.eliminatedSeats?.slice() || [] };
        this.log.push(`${message}：${text}`);
    }
    _seat(number) { return this.seats.find(seat => seat.number === Number(number)); }
    _active(playerId) { return this._seat(this.activeSeat[playerId]); }
    _controlsSeat(playerId, seat) { return Boolean(seat && (this.realPlayers.length === 1 || seat.controllerId === playerId)); }
    _offlineControlledSeats() {
        return this.seats.filter(seat => !this.realPlayers.find(player => player.id === seat.controllerId)?.online);
    }
    _reassignOrphanedSeats() {
        const onlinePlayers = this.realPlayers.filter(player => player.online && !player.left);
        if (!onlinePlayers.length) return [];
        const reassigned = [];
        for (const seat of this.seats.filter(item => this.realPlayers.find(player => player.id === item.controllerId)?.left)) {
            const controller = onlinePlayers.reduce((best, candidate) => {
                const bestCount = this.seats.filter(item => item.controllerId === best.id).length;
                const candidateCount = this.seats.filter(item => item.controllerId === candidate.id).length;
                return candidateCount < bestCount ? candidate : best;
            });
            seat.controllerId = controller.id;
            reassigned.push(seat.number);
        }
        return reassigned;
    }
    _phaseName(phase) { return PHASE_NAMES[phase] || phase; }
    _nextPhaseInfo() {
        if (this.status === 'ended') return { key: null, name: '故事已经落幕' };
        if (this.phase === 'roleReveal') return { key: NIGHT_PHASES[0], name: `第一夜 · ${this._phaseName(NIGHT_PHASES[0])}` };
        if (NIGHT_PHASES.includes(this.phase)) {
            const phase = NIGHT_PHASES[NIGHT_PHASES.indexOf(this.phase) + 1];
            return { key: phase || 'day', name: phase ? this._phaseName(phase) : '天亮与昨夜结果' };
        }
        if (this.phase === 'deathResolution') return { key: 'lastWords', name: this._phaseName('lastWords') };
        if (this.phase === 'lastWords') return this.lastWordsFlow?.after === 'night' ? { key: 'nightGuard', name: `第 ${this.day + 1} 夜 · ${this._phaseName('nightGuard')}` } : this.sheriff.enabled && this.day === 1 && this.sheriff.status === 'pending' ? { key: 'sheriffSignup', name: this._phaseName('sheriffSignup') } : { key: 'day', name: this._phaseName('day') };
        if (this.phase === 'sheriffSignup') return { key: 'sheriffCampaign', name: '警上发言或直接产生警长' };
        if (this.phase === 'sheriffCampaign') return { key: 'sheriffVote', name: '警长投票或直接产生警长' };
        if (this.phase === 'sheriffVote') return { key: 'sheriffRunoffSpeech', name: '公布结果（平票则进入 PK）' };
        if (this.phase === 'sheriffRunoffSpeech') return { key: 'sheriffRunoffVote', name: this._phaseName('sheriffRunoffVote') };
        if (this.phase === 'sheriffRunoffVote') return { key: 'day', name: '公布警长结果并开始白天发言' };
        if (this.phase === 'day') return { key: 'vote', name: this._phaseName('vote') };
        if (this.phase === 'vote') return { key: 'deathResolution', name: '公布放逐结果' };
        return { key: null, name: '静候揭晓' };
    }
    _phaseProgress() {
        const aliveSeats = this.seats.filter(seat => seat.alive);
        if (this.phase === 'roleReveal') return { completed: Object.keys(this.roleConfirmedSeats).length, total: this.seats.length, label: '已记下身份' };
        if (this.phase === 'day') return { completed: Object.keys(this.dayReadySeats).length, total: aliveSeats.length, label: '已完成发言' };
        if (this.phase === 'lastWords') return { completed: Object.keys(this.lastWordsFlow?.completedSeats || {}).length, total: this.lastWordsFlow?.order.length || 0, label: '已完成遗言' };
        if (this.phase === 'sheriffSignup') return { completed: Object.keys(this.sheriff.signup).length, total: aliveSeats.length, label: '已作出上警选择' };
        if (this.phase === 'sheriffCampaign') return { completed: this.sheriff.campaignIndex, total: this.sheriff.candidates.length, label: '已完成警上发言' };
        if (this.phase === 'sheriffVote' || this.phase === 'sheriffRunoffVote') return { completed: Object.keys(this.sheriff.votes).length, total: this._sheriffEligibleVoters().length, label: '已投出警长票' };
        if (this.phase === 'sheriffRunoffSpeech') return { completed: this.sheriff.runoffIndex, total: this.sheriff.runoffCandidates.length, label: '已完成 PK 发言' };
        if (this.phase === 'vote') return { completed: Object.keys(this.votes).length, total: aliveSeats.length, label: `第 ${this.dayVoteRound} 轮放逐投票` };
        if (this.phase === 'deathResolution') return { completed: 0, total: 1, label: '离场行动' };
        if (NIGHT_PHASES.includes(this.phase)) return { completed: 0, total: 1, label: '夜幕之中' };
        return { completed: this.status === 'ended' ? 1 : 0, total: 1, label: this.status === 'ended' ? '故事落幕' : '静候开局' };
    }
    _phaseInstruction() {
        if (this.phase === 'roleReveal') return `请各自查看并记住身份；${this.seats.length} 人全部确认后，第一夜降临。`;
        if (this.phase === 'nightGuard') return '守卫请睁眼，选择今晚要守护的人。其他玩家请保持安静。';
        if (this.phase === 'nightWolf') return '狼人请睁眼，共同决定今夜的袭击目标。其他玩家请保持安静。';
        if (this.phase === 'nightSeer') return '预言家请睁眼，查验一名玩家的阵营。其他玩家请保持安静。';
        if (this.phase === 'nightWitch') return '女巫请睁眼，决定是否使用解药或毒药。其他玩家请保持安静。';
        if (this.phase === 'deathResolution') return '出局玩家正在自己的界面完成离场行动，其他玩家请稍候。';
        if (this.phase === 'lastWords') return `现在请 ${this._currentTimedSeat(this.lastWordsFlow) || '当前'} 号玩家留下遗言，结束后轮到下一位。`;
        if (this.phase === 'sheriffSignup') return '每名存活玩家选择上警或不上警，所有人决定后再一同公布候选人。';
        if (this.phase === 'sheriffCampaign') return `请 ${this.sheriff.candidates[this.sheriff.campaignIndex] || '当前'} 号候选人完成警上发言并选择继续竞选或退水。`;
        if (this.phase === 'sheriffVote') return '非候选存活玩家投票选出警长，也可以弃票。';
        if (this.phase === 'sheriffRunoffSpeech') return `请 ${this.sheriff.runoffCandidates[this.sheriff.runoffIndex] || '当前'} 号候选人完成 PK 发言。`;
        if (this.phase === 'sheriffRunoffVote') return '非 PK 候选存活玩家进行最后一轮警长投票；再次平票则无警长。';
        if (this.phase === 'day') return `请 ${this._currentTimedSeat(this.speechFlow) || '当前'} 号玩家发言，顺序为${this.speechFlow?.direction === 'counterclockwise' ? '逆时针' : '顺时针'}。`;
        if (this.phase === 'vote') return this.dayVoteRound === 2 ? `首轮平票玩家为 ${this.dayTieTargets.join('、')} 号，第二轮只能投给这些玩家。` : '每名存活玩家各投一票，所有人投完后公布结果。';
        return this.status === 'ended' ? '本局结束，现在可以查看所有人的身份。' : '请留意接下来的引导。';
    }
    _fail(playerId, message) { return { success: false, message, state: this.getPlayerState(playerId) }; }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner }; }
    _privateSuccess(playerId, message) { return { ...this._success(message), privateFor: playerId, publicMessage: '' }; }

    _publicTimedFlow(flow) {
        if (!flow) return null;
        const currentSeat = this._currentTimedSeat(flow);
        const turn = flow.turn ? { ...flow.turn } : null;
        const effectiveNow = this.flowPausedAt == null ? Number(this.now()) : this.flowPausedAt;
        return {
            day: flow.day,
            after: flow.after || null,
            startSeat: flow.startSeat || flow.order[0] || null,
            direction: flow.direction || null,
            directionName: flow.direction === 'counterclockwise' ? '逆时针' : flow.direction === 'clockwise' ? '顺时针' : null,
            order: flow.order.slice(),
            currentIndex: flow.currentIndex,
            currentSeat,
            completedSeats: Object.keys(flow.completedSeats || {}).map(Number),
            durationSeconds: flow.durationSeconds,
            status: !currentSeat ? 'completed' : turn ? 'speaking' : 'waiting',
            startedAt: turn?.startedAt || null,
            deadlineAt: turn?.deadlineAt || null,
            remainingSeconds: turn ? Math.max(0, Math.ceil((turn.deadlineAt - effectiveNow) / 1000)) : flow.durationSeconds,
            sheriff: flow.sheriff ? { ...flow.sheriff } : null,
        };
    }

    _copyVoteResult(result) {
        return result ? { ...result, ballots: result.ballots.map(ballot => ({ ...ballot })), counts: { ...result.counts }, topSeats: result.topSeats.slice() } : null;
    }

    _publicSheriff() {
        const signupComplete = this.phase !== 'sheriffSignup';
        const effectiveNow = this.flowPausedAt == null ? Number(this.now()) : this.flowPausedAt;
        return {
            enabled: this.sheriff.enabled,
            status: this.sheriff.status,
            holderSeat: this.sheriff.holderSeat,
            signupCompleted: Object.keys(this.sheriff.signup).length,
            candidates: signupComplete ? this.sheriff.candidates.slice() : [],
            withdrawn: signupComplete ? this.sheriff.withdrawn.slice() : [],
            currentCandidate: this.phase === 'sheriffCampaign' ? this.sheriff.candidates[this.sheriff.campaignIndex] || null : this.phase === 'sheriffRunoffSpeech' ? this.sheriff.runoffCandidates[this.sheriff.runoffIndex] || null : null,
            round: this.sheriff.round,
            runoffCandidates: this.sheriff.runoffCandidates.slice(),
            submittedVotes: Object.keys(this.sheriff.votes).length,
            deadlineAt: this.sheriff.deadlineAt,
            remainingSeconds: this.sheriff.deadlineAt ? Math.max(0, Math.ceil((this.sheriff.deadlineAt - effectiveNow) / 1000)) : null,
            results: this.sheriff.results.map(result => ({ ...result, ballots: result.ballots.map(ballot => ({ ...ballot })), counts: { ...result.counts }, topSeats: result.topSeats.slice() })),
        };
    }

    getPublicState() {
        const nextPhase = this._nextPhaseInfo();
        const offlineSeats = this._offlineControlledSeats().map(seat => seat.number);
        const testMode = this.realPlayers.length === 1;
        return { roomId: this.roomId, status: this.status, phase: this.phase, phaseName: this._phaseName(this.phase), nextPhase: nextPhase.key, nextPhaseName: nextPhase.name, phaseProgress: this._phaseProgress(), phaseInstruction: offlineSeats.length ? `${offlineSeats.join('、')} 号玩家暂时离线，游戏会等他们回来，不会代替他们作出选择。` : this._phaseInstruction(), flowPaused: offlineSeats.length > 0, offlineSeats, day: this.day, playerCount: this.playerCount, testMode,
            seats: this.seats.map(seat => ({ number: seat.number, alive: seat.alive, isSheriff: seat.number === this.sheriff.holderSeat, occupied: Boolean(seat.controllerId), controllerName: this.realPlayers.find(player => player.id === seat.controllerId)?.name || null, roleConfirmed: Boolean(this.roleConfirmedSeats[seat.number]), dayReady: Boolean(this.dayReadySeats[seat.number]), role: this.status === 'ended' || testMode ? seat.role : null })),
            announcement: this.announcement ? { ...this.announcement, deaths: this.announcement.deaths.slice() } : null,
            announcementHistory: this.announcementHistory.map(item => ({ ...item, deaths: item.deaths.slice() })),
            lastWordsFlow: this._publicTimedFlow(this.lastWordsFlow), lastWordsHistory: this.lastWordsHistory.map(item => ({ ...item })), speechFlow: this._publicTimedFlow(this.speechFlow),
            flowRules: { lastWordsSeconds: LAST_WORDS_SECONDS, speechSeconds: SPEECH_SECONDS, sheriffEnabled: this.sheriff.enabled, winCondition: this.winCondition },
            sheriff: this._publicSheriff(), voteCount: Object.keys(this.votes).length, dayVoteRound: this.dayVoteRound, dayTieTargets: this.dayTieTargets.slice(),
            lastVoteResult: this._copyVoteResult(this.lastVoteResult), voteHistory: this.voteHistory.map(result => this._copyVoteResult(result)),
            actionLog: this.log.slice(-20), publicEvent: this.publicEvent ? { ...this.publicEvent, eliminatedSeats: this.publicEvent.eliminatedSeats.slice() } : null, publicEvents: this.publicEvents.map(event => ({ ...event, eliminatedSeats: event.eliminatedSeats.slice() })), winner: this.winner ? { ...this.winner, eliminatedSeats: this.winner.eliminatedSeats.slice() } : null };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState(); const seat = this._active(playerId);
        state.myId = playerId; state.activeSeat = seat?.number || null; state.myRole = seat?.role || null; state.myRoleInfo = seat ? ROLE_INFO[seat.role] : null;
        state.canSwitchAnySeat = this.realPlayers.length === 1;
        state.seats = state.seats.map(item => ({ ...item, canControl: this._controlsSeat(playerId, this._seat(item.number)) }));
        state.myRoleConfirmed = Boolean(seat && this.roleConfirmedSeats[seat.number]);
        state.canConfirmRole = Boolean(this.phase === 'roleReveal' && this._controlsSeat(playerId, seat) && !state.myRoleConfirmed);
        state.sheriffAction = null;
        if (seat?.alive && this._controlsSeat(playerId, seat)) {
            if (this.phase === 'sheriffSignup') state.sheriffAction = { kind: 'signup', submitted: Object.hasOwn(this.sheriff.signup, seat.number) };
            else if (this.phase === 'sheriffCampaign' && this.sheriff.candidates[this.sheriff.campaignIndex] === seat.number) state.sheriffAction = { kind: 'campaign' };
            else if (this.phase === 'sheriffRunoffSpeech' && this.sheriff.runoffCandidates[this.sheriff.runoffIndex] === seat.number) state.sheriffAction = { kind: 'runoffSpeech' };
            else if (this.phase === 'sheriffVote' || this.phase === 'sheriffRunoffVote') {
                const candidates = this._currentSheriffCandidates();
                if (!candidates.includes(seat.number)) state.sheriffAction = { kind: 'vote', submitted: Object.hasOwn(this.sheriff.votes, seat.number), legalTargetSeats: candidates };
            }
        }
        state.myDayReady = Boolean(seat && this.dayReadySeats[seat.number]);
        const isCurrentSpeaker = Boolean(this.phase === 'day' && seat?.alive && this._controlsSeat(playerId, seat) && this._currentTimedSeat(this.speechFlow) === seat.number);
        const isCurrentLastWords = Boolean(this.phase === 'lastWords' && seat && this._controlsSeat(playerId, seat) && this._currentTimedSeat(this.lastWordsFlow) === seat.number);
        state.canStartSpeech = Boolean(isCurrentSpeaker && !this.speechFlow?.turn);
        state.canFinishSpeech = Boolean(isCurrentSpeaker && this.speechFlow?.turn?.seat === seat.number);
        state.canConfirmDay = Boolean(isCurrentSpeaker && !state.myDayReady);
        state.canStartLastWords = Boolean(isCurrentLastWords && !this.lastWordsFlow?.turn);
        state.canFinishLastWords = Boolean(isCurrentLastWords && this.lastWordsFlow?.turn?.seat === seat.number);
        const timedFlow = this.phase === 'day' ? state.speechFlow : this.phase === 'lastWords' ? state.lastWordsFlow : null;
        state.canTimerTick = Boolean(timedFlow?.deadlineAt && timedFlow.remainingSeconds === 0);
        state.wolfSeat = this.phase === 'nightWitch' && seat?.role === 'witch' ? this.night.wolf || null : null;
        state.seerResult = seat?.role === 'seer' && this.night.seer ? { seat: this.night.seer, faction: ROLE_INFO[this._seat(this.night.seer).role].faction } : null;
        state.witchItems = seat?.role === 'witch' ? { ...this.witchItems } : null;
        const requiredRole = ({ nightGuard: 'guard', nightWolf: 'werewolf', nightSeer: 'seer', nightWitch: 'witch' })[this.phase] || null;
        const pendingNightAction = seat && this.night.pendingActions?.[seat.number]?.phase === this.phase ? this.night.pendingActions[seat.number] : null;
        const awaitingSeerResult = Boolean(this.phase === 'nightSeer' && seat?.alive && seat.role === 'seer' && this.night.seer && !this.night.seerResultAcknowledged);
        const wolfVoteSubmitted = Boolean(seat && this.night.wolfVotes?.[seat.number]);
        const submitted = requiredRole === 'guard' ? Boolean(this.night.guard)
            : requiredRole === 'werewolf' ? Boolean(this.night.wolfResolved || wolfVoteSubmitted)
                : requiredRole === 'seer' ? Boolean(this.night.seer)
                    : requiredRole === 'witch' ? Boolean(this.night.witchActed) : false;
        state.skillState = {
            available: Boolean(seat?.alive && this._controlsSeat(playerId, seat) && requiredRole && seat.role === requiredRole && !submitted && !pendingNightAction && !awaitingSeerResult && (requiredRole !== 'werewolf' || !this.night.wolfResolved)),
            submitted: Boolean(seat?.alive && requiredRole && seat.role === requiredRole && submitted),
        };
        state.nightConfirmation = pendingNightAction ? { stage: 'confirm', role: seat.role, targetSeat: pendingNightAction.targetSeat, choice: pendingNightAction.choice, canConfirm: true, canCancel: true }
            : awaitingSeerResult ? { stage: 'result', role: 'seer', targetSeat: this.night.seer, canConfirm: true, canCancel: false } : null;
        const canVote = Boolean(this.phase === 'vote' && seat?.alive && this._controlsSeat(playerId, seat) && !Object.prototype.hasOwnProperty.call(this.votes, seat.number));
        state.canVote = canVote;
        state.legalTargetSeats = canVote ? this.seats.filter(target => target.alive && (this.dayVoteRound !== 2 || this.dayTieTargets.includes(target.number))).map(target => target.number) : !state.skillState.available ? [] : this.seats.filter(target => target.alive
            && (requiredRole !== 'werewolf' || target.role !== 'werewolf')
            && (requiredRole !== 'werewolf' || this.night.wolfVoteRound !== 2 || this.night.wolfTieTargets.includes(target.number))
            && (requiredRole !== 'seer' || target.number !== seat.number)
            && (requiredRole !== 'guard' || target.number !== this.night.lastGuard)).map(target => target.number);
        state.wolfVote = seat?.alive && seat.role === 'werewolf' && this.phase !== 'ended' && this.night.wolfVotes ? {
            round: this.night.wolfVoteRound || 1,
            submittedCount: Object.keys(this.night.wolfVotes || {}).length,
            totalWolves: this.seats.filter(item => item.alive && item.role === 'werewolf').length,
            myTarget: this.night.wolfVotes?.[seat.number] || null,
            resolved: Boolean(this.night.wolfResolved),
            resultTarget: this.night.wolfResolved ? this.night.wolf || null : null,
            noKill: Boolean(this.night.wolfResolved && !this.night.wolf),
            tiedTargets: (this.night.wolfTieTargets || []).slice(),
        } : null;
        state.myVote = seat ? this.votes[seat.number] || null : null;
        state.voteProgress = { completed: Object.keys(this.votes).length, total: this.seats.filter(item => item.alive).length };
        state.canConfirmDeadRole = Boolean(NIGHT_PHASES.includes(this.phase) && PHASE_ROLE[this.phase] !== 'werewolf' && seat && !seat.alive && seat.role === PHASE_ROLE[this.phase] && this._controlsSeat(playerId, seat));
        const awaitsDeathResolution = Boolean(this.phase === 'deathResolution' && seat && this.deathResolution?.seats.includes(seat.number) && !this.deathResolution.settledSeats[seat.number] && this._controlsSeat(playerId, seat));
        state.eliminationNotice = awaitsDeathResolution ? { day: this.day, seat: seat.number, source: this.deathResolution.after === 'day' ? 'night' : 'day' } : null;
        state.canConfirmDeathResolution = Boolean(awaitsDeathResolution && this.pendingHunter?.seat !== seat.number && this.pendingBadge?.seat !== seat.number);
        state.myDeathResolutionSettled = Boolean(this.phase === 'deathResolution' && seat && this.deathResolution?.seats.includes(seat.number) && this.deathResolution.settledSeats[seat.number]);
        state.hunterAction = awaitsDeathResolution && this.pendingHunter?.seat === seat.number ? { available: true, legalTargetSeats: this.seats.filter(item => item.alive).map(item => item.number) } : null;
        state.sheriffBadgeAction = this.phase === 'deathResolution' && seat && this.pendingBadge?.seat === seat.number && this._controlsSeat(playerId, seat) && this.pendingHunter?.seat !== seat.number ? { available: true, legalTargetSeats: this.seats.filter(item => item.alive && item.number !== seat.number).map(item => item.number) } : null;
        if (state.hunterAction?.available) state.legalTargetSeats = state.hunterAction.legalTargetSeats.slice();
        if (this.phase === 'nightWolf' && seat?.alive && seat.role === 'werewolf') state.phaseProgress = { completed: Object.keys(this.night.wolfVotes || {}).length, total: this.seats.filter(item => item.alive && item.role === 'werewolf').length, label: `狼队第 ${this.night.wolfVoteRound || 1} 轮选择` };
        return state;
    }
    handlePlayerDisconnect(playerId) {
        const player = this.realPlayers.find(item => item.id === playerId);
        if (!player || player.left) return { success: false, message: '用户不存在' };
        const wasPaused = this._offlineControlledSeats().length > 0;
        player.online = false;
        if (!wasPaused && this._offlineControlledSeats().length) this._pauseTimedFlow();
        return this._success(`${player.name} 暂时离线，游戏会等他回来`);
    }
    handlePlayerReconnect(playerId) {
        const player = this.realPlayers.find(item => item.id === playerId);
        if (!player || player.left) return { success: false, message: '用户不存在' };
        const wasPaused = this._offlineControlledSeats().length > 0;
        player.online = true;
        const reassigned = this._reassignOrphanedSeats();
        if (wasPaused && !this._offlineControlledSeats().length) this._resumeTimedFlow();
        return this._success(reassigned.length ? `${player.name} 已经回来，并接管 ${reassigned.join('、')} 号测试席位` : `${player.name} 已经回来，游戏继续`);
    }
    handlePlayerLeave(playerId) {
        const player = this.realPlayers.find(item => item.id === playerId);
        if (!player) return { success: false, message: '用户不存在' };
        const wasPaused = this._offlineControlledSeats().length > 0;
        player.online = false;
        player.left = true;
        delete this.activeSeat[player.id];
        const reassigned = this._reassignOrphanedSeats();
        const isPaused = this._offlineControlledSeats().length > 0;
        if (!wasPaused && isPaused) this._pauseTimedFlow();
        else if (wasPaused && !isPaused) this._resumeTimedFlow();
        return this._success(reassigned.length ? `${player.name} 已离开，${reassigned.join('、')} 号测试席位已交给在线玩家` : `${player.name} 已离开`);
    }
    getPlayerAction(action, playerId) {
        if (!action?.privateFor || action.privateFor === playerId) return action;
        const { privateFor, publicMessage, ...safe } = action;
        return { ...safe, message: publicMessage ?? '' };
    }
    getWinner() { return this.winner; }
}

module.exports = WerewolfEngine;
module.exports.ROLES = ROLE_SETS[9];
module.exports.ROLE_SETS = ROLE_SETS;
module.exports.ROLE_INFO = ROLE_INFO;
