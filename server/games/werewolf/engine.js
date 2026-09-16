const ROLE_SETS = {
    // The 9-player standard board is the pre-witch-hunter board: three
    // wolves, three villagers, and the seer/witch/hunter gods.  Guard belongs
    // to the 12-player board and must not leave an empty 20-second phase in a
    // 9-player game.
    9: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'],
    12: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'],
};
const ROLE_INFO = {
    werewolf: { name: '狼人', faction: 'wolf' }, seer: { name: '预言家', faction: 'good' },
    witch: { name: '女巫', faction: 'good' }, hunter: { name: '猎人', faction: 'good' },
    guard: { name: '守卫', faction: 'good' }, villager: { name: '村民', faction: 'good' },
};
// Keep the standard wolf → witch → seer order for the 9-player board and add
// guard at the front for the 12-player board.  The witch must see the wolf
// target before the seer phase is allowed to reveal its result.
const NIGHT_PHASES = ['nightGuard', 'nightWolf', 'nightWitch', 'nightSeer'];
const NIGHT_PHASES_BY_PLAYER_COUNT = Object.freeze({
    9: Object.freeze(['nightWolf', 'nightWitch', 'nightSeer']),
    12: Object.freeze(NIGHT_PHASES),
});
const PHASE_ROLE = { nightGuard: 'guard', nightWolf: 'werewolf', nightSeer: 'seer', nightWitch: 'witch' };
const PHASE_NAMES = { roleReveal: '查看身份', nightPrelude: '夜幕降临', sheriffPrelude: '竞选即将开始', nightGuard: '守卫请睁眼', nightWolf: '狼人请睁眼', nightWitch: '女巫请睁眼', nightSeer: '预言家请睁眼', deathResolution: '离场时刻', lastWords: '遗言时间', sheriffSignup: '上警报名', sheriffCampaign: '警上发言', sheriffVote: '警长投票', sheriffRunoffSpeech: '警长平票 PK', sheriffRunoffVote: '警长 PK 投票', day: '白天发言', dayRunoffSpeech: '放逐平票 PK', vote: '放逐投票', ended: '本局结束' };
// NetEase's quick 9/10-player board gives ordinary last words 60 seconds,
// while the 12-player standard/advanced boards give them 120 seconds.  Keep
// the board-specific value authoritative in public state and timed flows.
const LAST_WORDS_SECONDS_BY_PLAYER_COUNT = Object.freeze({ 9: 60, 12: 120 });
const SPEECH_SECONDS = 90;
const SHERIFF_SPEECH_SECONDS = 90;
const SHERIFF_RESPONSE_SECONDS = 120;
const NIGHT_ACTION_SECONDS = 20;
const SELF_DESTRUCT_WORDS_SECONDS = 30;
const PRESENTATION_FADE_MS = 360;
const PRESENTATION_CONTENT_DURATIONS = Object.freeze({
    nightFalls: 1140,
    peacefulNight: 1140,
    nightDeaths: 1140,
    sheriffSignup: 1800,
    sheriffCandidates: 1140,
    sheriffVote: 1140,
    sheriffRunoff: 1140,
    sheriffElection: 1140,
    sheriffSpeechStart: 1140,
    sheriffRunoffSpeechStart: 1140,
    voteRunoffSpeech: 1140,
    voteRunoffSpeechStart: 1140,
    selfDestructWordsStart: 1140,
    lastWordsStart: 1140,
    speechStart: 1140,
    hunterReveal: 1140,
    hunterShot: 1140,
    hunterPass: 1140,
    elimination: 3600,
    exile: 1140,
    voteTie: 1140,
    badgeTorn: 1140,
    badgeTransfer: 1140,
    sheriffDeferred: 1140,
    wolfSelfDestruct: 1140,
    identityReveal: 1600,
    outcome: 1600,
});
const PRESENTATION_TEXT_EXTRA_PER_CHARACTER_MS = 35;
const PRESENTATION_TEXT_EXTRA_MAX_MS = 700;
const WITCH_SELF_SAVE_RULES = ['firstNight', 'never', 'always'];
let GAME_EPOCH_SEQUENCE = 0;

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function presentationContentDuration(kind, text = '') {
    const base = PRESENTATION_CONTENT_DURATIONS[kind] || 1140;
    const characterCount = [...String(text || '')].length;
    const extra = Math.min(PRESENTATION_TEXT_EXTRA_MAX_MS, Math.max(0, characterCount - 12) * PRESENTATION_TEXT_EXTRA_PER_CHARACTER_MS);
    return base + extra;
}

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
        this.hostId = hostId || this.realPlayers[0]?.id; this.random = random; this.now = now; this.winCondition = options.winCondition || 'parity'; this.witchSelfSave = WITCH_SELF_SAVE_RULES.includes(options.witchSelfSave) ? options.witchSelfSave : 'firstNight'; this.status = 'waiting'; this.phase = 'waiting'; this.day = 0;
        this.seats = []; this.activeSeat = {}; this.roleConfirmedSeats = {}; this.dayReadySeats = {}; this.dayVoteRound = 1; this.dayTieTargets = []; this.night = {}; this.nightFlow = null; this.presentationGate = null; this.votes = {}; this.deathResolution = null; this.pendingHunter = null; this.pendingBadge = null; this.pendingNightResult = null; this.pendingSelfDestructSequence = null; this.lastWordsFlow = null; this.lastWordsHistory = []; this.speechFlow = null; this.runoffSpeechFlow = null; this.flowPausedAt = null; this.announcement = null; this.announcementHistory = []; this.voteHistory = []; this.lastVoteResult = null; this.publicEvent = null; this.publicEvents = []; this.eventSequence = 0; this.presentationEventSequence = 0; this.presentationSequence = 0; this.presentation = null; this.presentationQueue = []; this.gameEpoch = null; this.sheriff = this._newSheriff(Boolean(options.sheriffEnabled)); this.log = []; this.winner = null; this.witchItems = { antidote: true, poison: true };
    }

    start() {
        if (this.realPlayers.length < 1 || this.realPlayers.length > this.playerCount) return { success: false, message: `狼人杀辅助当前支持 ${this.playerCount} 个座位` };
        const roles = shuffle(ROLE_SETS[this.playerCount], this.random);
        this.seats = roles.map((role, index) => ({ number: index + 1, role, alive: true, controllerId: this.realPlayers[index % this.realPlayers.length].id }));
        this.realPlayers.forEach(player => { this.activeSeat[player.id] = player.seat; });
        this.status = 'playing'; this.phase = 'roleReveal'; this.day = 0; this.roleConfirmedSeats = {}; this.dayReadySeats = {}; this.dayVoteRound = 1; this.dayTieTargets = []; this.night = {}; this.nightFlow = null; this.presentationGate = null; this.votes = {}; this.deathResolution = null; this.pendingHunter = null; this.pendingBadge = null; this.pendingNightResult = null; this.pendingSelfDestructSequence = null; this.lastWordsFlow = null; this.lastWordsHistory = []; this.speechFlow = null; this.runoffSpeechFlow = null; this.flowPausedAt = null; this.announcement = null; this.announcementHistory = []; this.voteHistory = []; this.lastVoteResult = null; this.publicEvent = null; this.publicEvents = []; this.eventSequence = 0; this.presentationEventSequence = 0; this.presentationSequence = 0; this.presentation = null; this.presentationQueue = []; this.gameEpoch = `${this.roomId}:${Number(this.now())}:${++GAME_EPOCH_SEQUENCE}`; this.sheriff = this._newSheriff(this.sheriff.enabled); this.winner = null; this.witchItems = { antidote: true, poison: true };
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
        if (timedAdvance) return this._success('计时结束，游戏已经继续');
        if (action.kind === 'timerTick') return this._success('计时已经更新，请继续');
        if (action.kind === 'presentationComplete') return this._completePresentation(real, action);
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
        if (action.kind === 'nightAction') {
            const seat = this._active(real.id);
            if (this.phase !== 'nightWolf' || seat?.role !== 'werewolf') return this._fail(real.id, '该夜间技能必须先选择目标，再完成确认');
            return this._nightAction(real, action);
        }
        if (action.kind === 'hunterAction') return this._hunterAction(real, action);
        if (action.kind === 'wolfSelfDestruct') return this._wolfSelfDestruct(real);
        if (action.kind === 'sheriffSignup') return this._sheriffSignup(real, action.choice);
        if (action.kind === 'finishSheriffCampaign') return this._finishSheriffCampaign(real, action.choice);
        if (action.kind === 'sheriffVote') return this._sheriffVote(real, action.targetSeat);
        if (action.kind === 'finishSheriffRunoffSpeech') return this._finishSheriffRunoffSpeech(real);
        if (action.kind === 'sheriffBadgeAction') return this._sheriffBadgeAction(real, action);
        if (action.kind === 'startSpeech') return this._startTimedTurn(real, 'day');
        if (action.kind === 'finishSpeech') return this._finishTimedTurn(real, 'day');
        if (action.kind === 'startRunoffSpeech') return this._startTimedTurn(real, 'dayRunoffSpeech');
        if (action.kind === 'finishRunoffSpeech') return this._finishTimedTurn(real, 'dayRunoffSpeech');
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
        this.nightFlow = null;
        this.dayReadySeats = {};
        this.votes = {};
        this.lastWordsFlow = null;
        this.speechFlow = null;
        this.runoffSpeechFlow = null;
        this.pendingNightResult = null;
        this.pendingSelfDestructSequence = null;
        this.announcement = null;
        this.log.push('所有人都已记下身份，第 1 夜降临');
        this._beginNightPrelude(1);
    }

    _beginNextNight() {
        const lastGuard = this._nightPhases().includes('nightGuard') ? this.night.guard ?? null : null;
        this.day += 1;
        this.night = lastGuard != null ? { lastGuard } : {};
        this.nightFlow = null;
        this.dayReadySeats = {};
        this.votes = {};
        this.lastWordsFlow = null;
        this.speechFlow = null;
        this.runoffSpeechFlow = null;
        this.pendingNightResult = null;
        this.pendingSelfDestructSequence = null;
        this.announcement = null;
        this.log.push(`第 ${this.day} 夜开始`);
        this._beginNightPrelude(this.day);
    }

    _presentationPlayers() {
        return this.realPlayers.filter(player => player.online && !player.left);
    }

    _currentPresentation(serverNow = Number(this.now())) {
        return this.presentationQueue.slice().reverse().find(batch => Array.isArray(batch.events) && batch.events.length && Number(batch.endsAt) > serverNow) || null;
    }

    _presentationBlocksAction(action = {}) {
        // A one-device table is an explicit test harness.  Keep its legacy
        // seat-by-seat controls usable; real rooms are always server-timed.
        if (this.realPlayers.length === 1) return false;
        if (['switchSeat', 'presentationComplete', 'timerTick'].includes(action.kind)) return false;
        const presentation = this._currentPresentation();
        return Boolean(presentation?.blocking && Number(presentation.endsAt) > Number(this.now()));
    }

    _allPresentationPlayersReady() {
        if (!this.presentationGate) return true;
        const acknowledged = this.presentationGate.acknowledgedPlayerIds || {};
        return this._presentationPlayers().every(player => acknowledged[player.id]);
    }

    _setPresentationGate(values = {}) {
        const batch = this.presentation;
        const startedAt = Number(batch?.startedAt) || Number(this.now());
        const endsAt = Number(batch?.endsAt) || startedAt;
        this.presentationGate = {
            ...values,
            startedAt,
            endsAt,
            // Kept as a compatibility field for old clients/tests.  It is no
            // longer the clock that controls a production game; endsAt is.
            fallbackDeadlineAt: endsAt,
            acknowledgedPlayerIds: {},
        };
        return this.presentationGate;
    }

    _createNightPresentation(targetDay) {
        const gateId = `${this.gameEpoch}:night:${targetDay}:${this.eventSequence + 1}`;
        const event = this._publishEvent('nightFalls', '天黑请闭眼', '', [], { targetDay, gateId });
        this._setPresentationGate({ id: gateId, kind: 'night', targetDay, eventId: event.id });
        return this.presentationGate;
    }

    _beginNightPrelude(targetDay) {
        this.phase = 'nightPrelude';
        if (!this.presentationGate || this.presentationGate.kind !== 'night' || this.presentationGate.targetDay !== targetDay) this._createNightPresentation(targetDay);
        if (this._allPresentationPlayersReady()) this._startNightActions();
    }

    _startNightActions() {
        this.presentationGate = null;
        this._enterNextNightPhase(-1);
    }

    _advancePresentationGate() {
        const gate = this.presentationGate;
        if (!gate) return false;
        if (gate.kind === 'night' && this.phase === 'nightPrelude') this._startNightActions();
        else if (gate.kind === 'sheriffSignup' && this.phase === 'sheriffPrelude') this._openSheriffSignup();
        else if (gate.kind === 'selfDestructResult' && this.phase === 'lastWords') this._beginSelfDestructWordsPrompt(gate.seatNumber);
        else if (gate.kind === 'selfDestructPrompt' && this.phase === 'lastWords') {
            const seatNumber = gate.seatNumber;
            this.presentationGate = null;
            this._startSelfDestructWordsTurn(seatNumber);
        } else if (gate.kind === 'sheriffDisposition') this._resumePendingSelfDestructNight();
        else return false;
        return true;
    }

    _completePresentation(real, action) {
        const gate = this.presentationGate;
        if (!gate || action.gateId !== gate.id) return this._fail(real.id, '这段播报已经结束');
        gate.acknowledgedPlayerIds[real.id] = true;
        // Current clients do not ACK server-timed scenes. Keep this endpoint
        // for older clients and under-filled unit-test harnesses, but never
        // let a quorum shorten a real 9/12-seat table's shared interval.
        const isUnderfilledHarness = this.realPlayers.length < this.playerCount;
        const advanced = isUnderfilledHarness && this._allPresentationPlayersReady() ? this._advancePresentationGate() : false;
        return this._privateSuccess(real.id, advanced ? '播报完成，游戏继续' : '播报已记录，服务器按统一时间继续');
    }

    _nightPhases() {
        return NIGHT_PHASES_BY_PLAYER_COUNT[this.playerCount] || NIGHT_PHASES;
    }

    _enterNextNightPhase(currentIndex = this._nightPhases().indexOf(this.phase)) {
        const phases = this._nightPhases();
        const phase = phases[currentIndex + 1];
        if (phase) {
            this.phase = phase;
            const startedAt = Number(this.now());
            this.nightFlow = { phase, startedAt, deadlineAt: startedAt + NIGHT_ACTION_SECONDS * 1000, durationSeconds: NIGHT_ACTION_SECONDS };
            return;
        }
        this.nightFlow = null;
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
        return { enabled, status: enabled ? 'pending' : 'disabled', electionAttempt: 0, holderSeat: null, signup: {}, candidates: [], originalCandidates: [], eligibleVoterSeats: [], withdrawn: [], campaignIndex: 0, votes: {}, round: 0, runoffCandidates: [], runoffIndex: 0, results: [], deadlineAt: null, turn: null };
    }

    _witchCanSaveSelf(seat) {
        if (!seat?.alive || seat.role !== 'witch') return false;
        if (this.witchSelfSave === 'always') return true;
        if (this.witchSelfSave === 'firstNight') return this.day === 1;
        return false;
    }

    _canJoinFirstSheriffElection(seat) {
        if (!seat) return false;
        return seat.alive || Boolean(this.pendingNightResult?.deaths?.includes(seat.number));
    }

    _beginDayAgenda() {
        const shouldElectSheriff = this.sheriff.enabled && ((this.day === 1 && this.sheriff.status === 'pending') || this.sheriff.status === 'deferred');
        if (shouldElectSheriff) {
            const resumed = this.sheriff.status === 'deferred';
            this.phase = 'sheriffPrelude';
            this.sheriff.deadlineAt = null;
            this.sheriff.turn = null;
            const gateId = `${this.gameEpoch}:sheriff:${this.day}:${this.sheriff.electionAttempt + 1}:${this.eventSequence + 1}`;
            const event = this._publishEvent('sheriffSignup', resumed ? '警长竞选' : '天亮了', resumed ? '重新开始警长竞选' : '开始警长竞选', [], { presentation: resumed ? 'sheriffResume' : 'sheriffDawn', gateId });
            this._setPresentationGate({ id: gateId, kind: 'sheriffSignup', eventId: event.id });
            return;
        }
        this._beginDaySpeech();
    }

    _openSheriffSignup() {
        this.presentationGate = null;
        this.phase = 'sheriffSignup';
        this.sheriff.status = 'signup';
        this.sheriff.electionAttempt += 1;
        this.sheriff.signup = {};
        this.sheriff.candidates = [];
        this.sheriff.originalCandidates = [];
        this.sheriff.eligibleVoterSeats = [];
        this.sheriff.withdrawn = [];
        this.sheriff.votes = {};
        this.sheriff.round = 0;
        this.sheriff.runoffCandidates = [];
        this._setSheriffDeadline(SHERIFF_RESPONSE_SECONDS);
        this.log.push(`第 ${this.sheriff.electionAttempt} 次上警报名开始`);
    }

    _sheriffSignup(real, choice) {
        if (this.phase !== 'sheriffSignup' || this.sheriff.status !== 'signup') return this._fail(real.id, '上警报名已经结束');
        const seat = this._active(real.id);
        if (!this._canJoinFirstSheriffElection(seat) || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '现在不能参与上警选择');
        if (Object.hasOwn(this.sheriff.signup, seat.number)) return this._fail(real.id, '你已经作出上警选择');
        if (!['run', 'skip'].includes(choice)) return this._fail(real.id, '请选择上警或不上警');
        this.sheriff.signup[seat.number] = choice;
        const alive = this.seats.filter(item => this._canJoinFirstSheriffElection(item));
        const completed = Object.keys(this.sheriff.signup).length;
        if (completed < alive.length) return this._privateSuccess(real.id, `你的选择已经记下，还有 ${alive.length - completed} 位玩家`);
        this.sheriff.candidates = alive.filter(item => this.sheriff.signup[item.number] === 'run').map(item => item.number);
        this.sheriff.originalCandidates = this.sheriff.candidates.slice();
        this.sheriff.eligibleVoterSeats = alive.filter(item => this.sheriff.signup[item.number] === 'skip').map(item => item.number);
        if (this.sheriff.candidates.length === 0) {
            this._finishSheriffElection(null, '无人上警，本局无警长');
        } else if (this.sheriff.candidates.length === 1) {
            this._finishSheriffElection(this.sheriff.candidates[0], `${this.sheriff.candidates[0]} 号是唯一上警玩家，不经投票成为警长`);
        } else {
            this.phase = 'sheriffCampaign';
            this.sheriff.status = 'campaign';
            this.sheriff.campaignIndex = 0;
            this.log.push(`上警玩家：${this.sheriff.candidates.join('、')} 号`);
            this._publishEvent('sheriffCandidates', '警长竞选', `上警玩家：${this.sheriff.candidates.join('、')} 号`, []);
            this._startSheriffTurn('campaign');
        }
        return this._privateSuccess(real.id, '所有人都已作出选择，警长竞选继续');
    }

    _finishSheriffCampaign(real, choice) {
        if (this.phase !== 'sheriffCampaign' || this.sheriff.status !== 'campaign') return this._fail(real.id, '现在不是警上发言时间');
        const seat = this._active(real.id);
        const current = this.sheriff.candidates[this.sheriff.campaignIndex];
        if (!this._canJoinFirstSheriffElection(seat) || !this._controlsSeat(real.id, seat) || seat.number !== current) return this._fail(real.id, '请等待当前候选人完成警上发言');
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
        // A player who退水 remains barred from this election, including its
        // vote and PK vote.  Filtering only the remaining candidates would
        // incorrectly give withdrawn players a ballot.
        const eligible = new Set(this.sheriff.eligibleVoterSeats || []);
        return this.seats.filter(seat => eligible.has(seat.number) && this._canJoinFirstSheriffElection(seat));
    }

    _currentSheriffCandidates() {
        return this.phase === 'sheriffRunoffVote' || this.phase === 'sheriffRunoffSpeech' ? this.sheriff.runoffCandidates.slice() : this.sheriff.candidates.slice();
    }

    _sheriffVote(real, targetSeat) {
        if (!['sheriffVote', 'sheriffRunoffVote'].includes(this.phase)) return this._fail(real.id, '现在不能投警长票');
        const candidates = this._currentSheriffCandidates();
        const voter = this._active(real.id);
        const eligible = this._sheriffEligibleVoters(candidates);
        if (!this._controlsSeat(real.id, voter) || !eligible.some(item => item.number === voter?.number)) return this._fail(real.id, '只有原警下玩家可以参与警长投票');
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
            this.log.push(`警长首轮平票，${top.join('、')} 号进入 PK`);
            this._publishEvent('sheriffRunoff', '警长投票平票', `${top.join('、')} 号进入 PK`, []);
            this._startSheriffTurn('runoffSpeech');
            return;
        }
        this._finishSheriffElection(null, this.sheriff.round === 2 ? '警长 PK 投票仍平票，本局无警长' : '警长投票全部弃票，本局无警长');
    }

    _finishSheriffRunoffSpeech(real) {
        if (this.phase !== 'sheriffRunoffSpeech') return this._fail(real.id, '现在不是警长 PK 发言时间');
        const seat = this._active(real.id);
        const current = this.sheriff.runoffCandidates[this.sheriff.runoffIndex];
        if (!this._canJoinFirstSheriffElection(seat) || !this._controlsSeat(real.id, seat) || seat.number !== current) return this._fail(real.id, '请等待当前 PK 候选人发言');
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
        // On the first day the sheriff election is held before the previous
        // night's death announcement.  Reveal and settle that pending result
        // only after the election has finished.
        if (this.pendingNightResult) {
            this._publishPendingNightResult();
            return;
        }
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
        // Keep sheriff-campaign turns in the same presentation queue as day
        // speech and last words.  Without this event, a candidate changes in
        // the state panel but the shared screen has no full-screen callout,
        // which makes an oral/visual host flow appear to skip a speaker.
        const runoff = kind === 'runoffSpeech';
        this._publishEvent(runoff ? 'sheriffRunoffSpeechStart' : 'sheriffSpeechStart', runoff ? '警长平票 PK' : '警上发言', `${seat} 号开始${runoff ? '警长 PK ' : '警上'}发言`, []);
    }

    _beginDaySpeech() {
        const aliveSeats = this.seats.filter(seat => seat.alive).map(seat => seat.number).sort((left, right) => left - right);
        if (!aliveSeats.length) return;
        const direction = this.random() < 0.5 ? 'clockwise' : 'counterclockwise';
        const sheriffSeat = this.sheriff.enabled && aliveSeats.includes(this.sheriff.holderSeat) ? this.sheriff.holderSeat : null;
        let order;
        if (sheriffSeat) {
            // The sheriff chooses a direction, starts with the adjacent seat,
            // and speaks last.  Starting the sheriff's own turn first would
            // contradict the standard “警长不得抢先发言” rule.
            const sheriffIndex = aliveSeats.indexOf(sheriffSeat);
            const step = direction === 'clockwise' ? 1 : -1;
            order = Array.from({ length: aliveSeats.length - 1 }, (_, offset) => aliveSeats[(sheriffIndex + step * (offset + 1) + aliveSeats.length * 2) % aliveSeats.length]);
            order.push(sheriffSeat);
        } else {
            const startIndex = Math.floor(this.random() * aliveSeats.length);
            order = Array.from({ length: aliveSeats.length }, (_, offset) => {
                const delta = direction === 'clockwise' ? offset : -offset;
                return aliveSeats[(startIndex + delta + aliveSeats.length) % aliveSeats.length];
            });
        }
        this.phase = 'day';
        this.dayReadySeats = {};
        this.votes = {};
        this.dayVoteRound = 1;
        this.dayTieTargets = [];
        this.runoffSpeechFlow = null;
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

    _beginDayRunoffSpeech(tiedSeats) {
        const aliveTargets = [...new Set(tiedSeats.map(Number))].filter(number => this._seat(number)?.alive);
        if (!aliveTargets.length) {
            this.phase = 'vote';
            this.votes = {};
            this._resolveVote();
            return;
        }
        const regularOrder = this.speechFlow?.order || [];
        const order = regularOrder.filter(number => aliveTargets.includes(number));
        aliveTargets.filter(number => !order.includes(number)).sort((left, right) => left - right).forEach(number => order.push(number));
        this.phase = 'dayRunoffSpeech';
        this.runoffSpeechFlow = {
            day: this.day,
            after: 'vote',
            startSeat: order[0],
            direction: this.speechFlow?.direction || null,
            order,
            currentIndex: 0,
            completedSeats: {},
            turn: null,
            durationSeconds: SPEECH_SECONDS,
        };
        this.log.push(`放逐首轮平票，${order.join('、')} 号进行 PK 发言`);
        this._publishEvent('voteRunoffSpeech', '放逐平票 PK', `${order.join('、')} 号进行 PK 发言`, []);
    }

    _beginLastWords(seats, after, options = {}) {
        const completedLastWordsSeats = new Set(this.lastWordsHistory.map(item => Number(item.seat)));
        const order = [...new Set(seats.map(Number))].filter(number => this._seat(number) && !this._seat(number).alive && !completedLastWordsSeats.has(number));
        if (!order.length) {
            this._continueAfterDeathResolution(after);
            return;
        }
        const defaultDurationSeconds = Number(options.defaultDurationSeconds || this._lastWordsSeconds());
        const durationBySeat = Object.fromEntries(Object.entries(options.durationBySeat || {})
            .map(([seat, seconds]) => [Number(seat), Number(seconds)])
            .filter(([seat, seconds]) => order.includes(seat) && Number.isFinite(seconds) && seconds > 0));
        const kindBySeat = Object.fromEntries(Object.entries(options.kindBySeat || {})
            .map(([seat, kind]) => [Number(seat), String(kind)])
            .filter(([seat]) => order.includes(seat)));
        const durationForSeat = seat => durationBySeat[seat] || defaultDurationSeconds;
        this.phase = 'lastWords';
        this.lastWordsFlow = {
            day: this.day,
            after,
            order,
            currentIndex: 0,
            completedSeats: {},
            turn: null,
            durationSeconds: durationForSeat(order[0]),
            defaultDurationSeconds,
            durationBySeat,
            kindBySeat,
        };
        this.log.push(`请 ${order.join('、')} 号按顺序留遗言`);
        if (kindBySeat[order[0]] === 'selfDestruct' && !['selfDestructResult', 'selfDestructPrompt'].includes(this.presentationGate?.kind)) this._startSelfDestructWordsTurn(order[0]);
    }

    _startSelfDestructWordsTurn(seatNumber) {
        const flow = this.lastWordsFlow;
        if (!flow || this.phase !== 'lastWords' || this._currentTimedSeat(flow) !== Number(seatNumber) || flow.turn) return false;
        const startedAt = Number(this.now());
        const durationSeconds = this._timedFlowDuration(flow, seatNumber);
        flow.durationSeconds = durationSeconds;
        flow.turn = { seat: Number(seatNumber), startedAt, deadlineAt: startedAt + durationSeconds * 1000, durationSeconds };
        return true;
    }

    _beginSelfDestructWordsPrompt(seatNumber) {
        const gateId = `${this.gameEpoch}:self-destruct-prompt:${this.day}:${seatNumber}:${this.eventSequence + 1}`;
        const event = this._publishEvent('selfDestructWordsStart', `${seatNumber} 号玩家发表遗言`, '', [Number(seatNumber)], {
            presentation: 'perspective', selfSeat: Number(seatNumber), selfText: '请您发表遗言', gateId,
        });
        this._setPresentationGate({ id: gateId, kind: 'selfDestructPrompt', seatNumber: Number(seatNumber), eventId: event.id });
    }

    _lastWordsSeconds() {
        return LAST_WORDS_SECONDS_BY_PLAYER_COUNT[this.playerCount] || LAST_WORDS_SECONDS_BY_PLAYER_COUNT[9];
    }

    _timedFlowDuration(flow, seatNumber = this._currentTimedSeat(flow)) {
        return Number(flow?.durationBySeat?.[seatNumber] || flow?.durationSeconds || this._lastWordsSeconds());
    }

    _currentTimedSeat(flow) {
        return flow?.order?.[flow.currentIndex] ?? null;
    }

    _startTimedTurn(real, phase) {
        const supported = ['day', 'dayRunoffSpeech', 'lastWords'];
        if (!supported.includes(phase) || this.phase !== phase) return this._fail(real.id, phase === 'lastWords' ? '现在不是遗言时间' : phase === 'dayRunoffSpeech' ? '现在不是放逐 PK 发言时间' : '现在不是白天发言时间');
        const flow = phase === 'day' ? this.speechFlow : phase === 'dayRunoffSpeech' ? this.runoffSpeechFlow : this.lastWordsFlow;
        const seat = this._active(real.id);
        if (!flow || !seat || !this._controlsSeat(real.id, seat) || this._currentTimedSeat(flow) !== seat.number) return this._fail(real.id, '现在还没有轮到你');
        if (flow.turn) return this._fail(real.id, '本轮发言已经开始');
        const startedAt = Number(this.now());
        const durationSeconds = this._timedFlowDuration(flow, seat.number);
        flow.durationSeconds = durationSeconds;
        flow.turn = { seat: seat.number, startedAt, deadlineAt: startedAt + durationSeconds * 1000, durationSeconds };
        const isLastWords = phase === 'lastWords';
        const isRunoff = phase === 'dayRunoffSpeech';
        const wordsKind = isLastWords ? flow.kindBySeat?.[seat.number] || 'lastWords' : null;
        const selfDestructWords = wordsKind === 'selfDestruct';
        const firstNightWords = wordsKind === 'firstNight';
        const wordsTitle = firstNightWords ? '首夜遗言' : '遗言时间';
        const wordsLabel = firstNightWords ? '开始首夜遗言' : '开始遗言';
        // A self-destruct statement is one presentation cue followed by the
        // real 30-second speaking window.  Publishing a generic title and a
        // second “starts speaking” detail made one rule step look like three
        // separate statements in the client queue.
        const eventTitle = selfDestructWords
            ? `${seat.number} 号开始 ${SELF_DESTRUCT_WORDS_SECONDS} 秒自爆遗言`
            : isLastWords ? wordsTitle : isRunoff ? '放逐平票 PK' : '白天发言';
        const eventText = selfDestructWords
            ? ''
            : `${seat.number} 号${isLastWords ? wordsLabel : isRunoff ? '开始 PK 发言' : '开始发言'}`;
        this._publishEvent(selfDestructWords ? 'selfDestructWordsStart' : isLastWords ? 'lastWordsStart' : isRunoff ? 'voteRunoffSpeechStart' : 'speechStart', eventTitle, eventText, []);
        return this._success(`${seat.number} 号${isLastWords ? '遗言' : isRunoff ? 'PK 发言' : '发言'}开始`);
    }

    _finishTimedTurn(real, phase, action = {}) {
        const supported = ['day', 'dayRunoffSpeech', 'lastWords'];
        if (!supported.includes(phase) || this.phase !== phase) return this._fail(real.id, phase === 'lastWords' ? '现在不是遗言时间' : phase === 'dayRunoffSpeech' ? '现在不是放逐 PK 发言时间' : '现在不是白天发言时间');
        const flow = phase === 'day' ? this.speechFlow : phase === 'dayRunoffSpeech' ? this.runoffSpeechFlow : this.lastWordsFlow;
        const seat = this._active(real.id);
        if (!flow || !seat || !this._controlsSeat(real.id, seat) || this._currentTimedSeat(flow) !== seat.number) return this._fail(real.id, '现在还没有轮到你');
        if (!flow.turn) return this._fail(real.id, '请先开始本轮发言');
        const isLast = flow.currentIndex === flow.order.length - 1;
        this._completeTimedTurn(phase, false, action);
        const label = phase === 'lastWords' ? '遗言' : phase === 'dayRunoffSpeech' ? 'PK 发言' : '发言';
        return this._success(isLast
            ? (phase === 'day' ? '所有存活玩家都已发言，现在进入放逐投票' : phase === 'dayRunoffSpeech' ? 'PK 发言结束，非 PK 玩家进入第二轮投票' : '本轮遗言已经结束，游戏继续')
            : `${seat.number} 号${label}完成，请下一位继续`);
    }

    _completeTimedTurn(phase, timedOut, action = {}) {
        const flow = phase === 'day' ? this.speechFlow : phase === 'dayRunoffSpeech' ? this.runoffSpeechFlow : this.lastWordsFlow;
        const seatNumber = this._currentTimedSeat(flow);
        if (!flow || !seatNumber) return;
        flow.completedSeats[seatNumber] = true;
        if (phase === 'day') this.dayReadySeats[seatNumber] = true;
        if (phase === 'lastWords') {
            const text = String(action.text || '').trim().slice(0, 240);
            this.lastWordsHistory.push({ day: flow.day, seat: seatNumber, text, timedOut: Boolean(timedOut), durationSeconds: this._timedFlowDuration(flow, seatNumber), kind: flow.kindBySeat?.[seatNumber] || 'lastWords', recordedAt: Number(this.now()) });
        }
        this.log.push(`${seatNumber} 号${phase === 'day' ? '发言' : phase === 'dayRunoffSpeech' ? 'PK 发言' : '遗言'}${timedOut ? '超时结束' : '完成'}`);
        flow.currentIndex += 1;
        flow.turn = null;
        if (phase === 'lastWords') flow.durationSeconds = this._timedFlowDuration(flow);
        if (flow.currentIndex < flow.order.length) return;
        if (phase === 'day') {
            this.phase = 'vote';
            this.votes = {};
            return;
        }
        if (phase === 'dayRunoffSpeech') {
            this.phase = 'vote';
            this.votes = {};
            if (!this._dayVoteEligibleSeats().length) this._resolveVote();
            return;
        }
        const after = flow.after;
        this.lastWordsFlow = null;
        this._continueAfterDeathResolution(after);
    }

    _advanceExpiredTimedFlow() {
        const phase = this.phase === 'day' ? 'day' : this.phase === 'dayRunoffSpeech' ? 'dayRunoffSpeech' : this.phase === 'lastWords' ? 'lastWords' : null;
        const flow = phase === 'day' ? this.speechFlow : phase === 'dayRunoffSpeech' ? this.runoffSpeechFlow : phase === 'lastWords' ? this.lastWordsFlow : null;
        if (!flow?.turn || Number(this.now()) < flow.turn.deadlineAt) return false;
        this._completeTimedTurn(phase, true);
        return true;
    }

    _advanceExpiredNightFlow() {
        const phases = this._nightPhases();
        if (!phases.includes(this.phase) || !this.nightFlow || this.nightFlow.phase !== this.phase || Number(this.now()) < this.nightFlow.deadlineAt) return false;
        const expiredPhase = this.phase;
        if (this.night.pendingActions) {
            Object.entries(this.night.pendingActions).forEach(([seatNumber, pending]) => {
                if (pending?.phase === expiredPhase) delete this.night.pendingActions[seatNumber];
            });
        }
        if (expiredPhase === 'nightGuard' && !this.night.guardActed) {
            this.night.guard = null;
            this.night.guardActed = true;
        } else if (expiredPhase === 'nightWolf' && !this.night.wolfResolved) {
            this._settleWolfVote(this.hostId);
            // A first-round tie starts a fresh, independent 20-second PK
            // window.  Only the second-round deadline resolves to no kill.
            if (this.phase === 'nightWolf' && !this.night.wolfResolved && this.night.wolfVoteRound === 2) return true;
        } else if (expiredPhase === 'nightWitch' && !this.night.witchActed) {
            this.night.witchActed = true;
            this.night.witchTimedOut = true;
        } else if (expiredPhase === 'nightSeer' && this.night.seer == null) {
            this.night.seerTimedOut = true;
        }
        this.log.push(`${this._phaseName(expiredPhase)}的 20 秒行动时间结束`);
        this.nightFlow = null;
        this._enterNextNightPhase(phases.indexOf(expiredPhase));
        return true;
    }

    _advanceAutomatic() {
        if (this._offlineControlledSeats().length) return false;
        const now = Number(this.now());
        // A presentation is a shared, absolute server-time barrier. Client
        // acknowledgements are informational only; once the advertised end
        // timestamp is reached, the first system pulse advances everybody.
        // Acknowledge-all is a compatibility shortcut for old clients; the
        // current browser follows the same absolute interval on every device.
        if (this.presentationGate) {
            const gateEnd = Number(this.presentationGate.endsAt ?? this.presentationGate.fallbackDeadlineAt);
            // Acknowledgements are telemetry only. A fast client must never
            // shorten the shared interval for the rest of the table.
            if (Number.isFinite(gateEnd) && now >= gateEnd) {
                if (this._advancePresentationGate()) return true;
            }
        }
        if (this._advanceExpiredTimedFlow()) return true;
        if (this._advanceExpiredNightFlow()) return true;
        if (!this.sheriff.enabled || !this.sheriff.deadlineAt || now < this.sheriff.deadlineAt) return false;
        if (this.phase === 'sheriffSignup') {
            const participants = this.seats.filter(seat => this._canJoinFirstSheriffElection(seat));
            participants.filter(seat => !Object.hasOwn(this.sheriff.signup, seat.number)).forEach(seat => { this.sheriff.signup[seat.number] = 'skip'; });
            const candidates = participants.filter(seat => this.sheriff.signup[seat.number] === 'run').map(seat => seat.number);
            this.sheriff.candidates = candidates;
            this.sheriff.originalCandidates = candidates.slice();
            this.sheriff.eligibleVoterSeats = participants.filter(seat => this.sheriff.signup[seat.number] === 'skip').map(seat => seat.number);
            if (!candidates.length) this._finishSheriffElection(null, '上警报名超时且无人报名，本局无警长');
            else if (candidates.length === 1) this._finishSheriffElection(candidates[0], `${candidates[0]} 号是唯一上警玩家，不经投票成为警长`);
            else {
                this.phase = 'sheriffCampaign'; this.sheriff.status = 'campaign'; this.sheriff.campaignIndex = 0;
                this._publishEvent('sheriffCandidates', '警长竞选', `上警玩家：${candidates.join('、')} 号`, []);
                this._startSheriffTurn('campaign');
            }
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
        const flow = this.phase === 'day' ? this.speechFlow : this.phase === 'dayRunoffSpeech' ? this.runoffSpeechFlow : this.phase === 'lastWords' ? this.lastWordsFlow : null;
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
        if (this.nightFlow?.deadlineAt != null) {
            this.nightFlow.startedAt += pausedFor;
            this.nightFlow.deadlineAt += pausedFor;
        }
        this.flowPausedAt = null;
    }

    _confirmDeadRole(real) {
        if (!this._nightPhases().includes(this.phase) || PHASE_ROLE[this.phase] === 'werewolf') return this._fail(real.id, '你现在不需要确认夜间行动');
        const seat = this._active(real.id);
        if (!seat || !this._controlsSeat(real.id, seat) || seat.alive || seat.role !== PHASE_ROLE[this.phase]) return this._fail(real.id, '现在不需要你作出这个选择');
        if (!this.night.deadRoleAcknowledged) this.night.deadRoleAcknowledged = {};
        this.night.deadRoleAcknowledged[this.phase] = true;
        return this._privateSuccess(real.id, '今夜无需行动，本阶段计时结束后会自动继续');
    }

    _stageNightAction(real, action) {
        const seat = this._active(real.id);
        const requiredRole = PHASE_ROLE[this.phase];
        if (!seat?.alive || !this._controlsSeat(real.id, seat) || !requiredRole || seat.role !== requiredRole) return this._fail(real.id, '夜色还没有轮到你行动');
        const target = action.targetSeat == null ? null : this._seat(action.targetSeat);
        if (target && !target.alive) return this._fail(real.id, '目标已出局');
        if (requiredRole === 'guard') {
            if (this.night.guardActed) return this._fail(real.id, '守卫本夜已经行动');
            if (action.choice !== 'pass') {
                if (!target) return this._fail(real.id, '请选择守护目标，或选择空守');
                if (this.night.lastGuard === target.number) return this._fail(real.id, '守卫不能连续两夜守护同一人');
            }
        } else if (requiredRole === 'werewolf') {
            return this._nightAction(real, action);
        } else if (requiredRole === 'seer') {
            if (this.night.seer != null) return this._fail(real.id, '预言家本夜已经行动');
            if (!target || target.number === seat.number) return this._fail(real.id, '请选择其他玩家进行查验');
        } else if (requiredRole === 'witch') {
            if (this.night.witchActed) return this._fail(real.id, '女巫本夜已经行动');
            if (action.choice === 'save') {
                if (!this.witchItems.antidote || this.night.wolf == null) return this._fail(real.id, '解药不可用');
                if (this.night.wolf === seat.number && !this._witchCanSaveSelf(seat)) return this._fail(real.id, this.witchSelfSave === 'firstNight' ? '本局规则仅允许女巫首夜自救' : '本局规则不允许女巫自救');
            } else if (action.choice === 'poison') {
                if (!this.witchItems.poison || !target) return this._fail(real.id, '毒药不可用');
            } else if (action.choice !== 'pass') return this._fail(real.id, '请选择用药或跳过');
        }
        if (!this.night.pendingActions) this.night.pendingActions = {};
        this.night.pendingActions[seat.number] = { phase: this.phase, targetSeat: target?.number ?? null, choice: action.choice || null };
        const choiceText = requiredRole === 'guard' && action.choice === 'pass' ? '本夜空守'
            : requiredRole === 'witch' && action.choice === 'save' ? `使用解药救下 ${this.night.wolf} 号`
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
        if (this.phase !== 'nightSeer' || !seat?.alive || seat.role !== 'seer' || !this._controlsSeat(real.id, seat) || this.night.seer == null || this.night.seerResultAcknowledged) return this._fail(real.id, '现在没有需要记住的查验结果');
        this.night.seerResultAcknowledged = true;
        return this._privateSuccess(real.id, '你已记下查验结果，本阶段计时结束后会自动继续');
    }

    _nightAction(real, action) {
        const seat = this._active(real.id);
        if (!seat?.alive || !this._controlsSeat(real.id, seat)) return this._fail(real.id, '你已经出局，或这不是你的席位');
        const target = action.targetSeat == null ? null : this._seat(action.targetSeat);
        if (target && !target.alive) return this._fail(real.id, '目标已出局');
        if (this.phase === 'nightGuard' && seat.role === 'guard') {
            if (this.night.guardActed) return this._fail(real.id, '守卫本夜已经行动');
            if (action.choice === 'pass') this.night.guard = null;
            else {
                if (!target) return this._fail(real.id, '请选择守护目标，或选择空守');
                if (this.night.lastGuard === target.number) return this._fail(real.id, '守卫不能连续两夜守护同一人');
                this.night.guard = target.number;
            }
            this.night.guardActed = true;
            return this._privateSuccess(real.id, action.choice === 'pass' ? '你决定本夜空守，计时结束后会轮到狼人' : `你决定守护 ${target.number} 号，计时结束后会轮到狼人`);
        }
        if (this.phase === 'nightWolf' && seat.role === 'werewolf') {
            if (!target) return this._fail(real.id, '请选择一名袭击目标');
            if (this.night.wolfVoteRound === 2 && !(this.night.wolfTieTargets || []).includes(target.number)) return this._fail(real.id, '第二轮只能投给首轮平票目标');
            if (!this.night.wolfVotes) this.night.wolfVotes = {};
            this.night.wolfVotes[seat.number] = target.number;
            return this._privateSuccess(real.id, `你的临时袭击票已更新为 ${target.number} 号，20 秒结束前仍可修改`);
        }
        if (this.phase === 'nightSeer' && seat.role === 'seer') {
            if (this.night.seer != null) return this._fail(real.id, '预言家本夜已经行动');
            if (!target || target.number === seat.number) return this._fail(real.id, '请选择其他玩家进行查验');
            this.night.seer = target.number;
            return this._privateSuccess(real.id, `查验结果：${target.number} 号是${ROLE_INFO[target.role].faction === 'wolf' ? '狼人' : '好人'}。请记住这个结果`);
        }
        if (this.phase === 'nightWitch' && seat.role === 'witch') {
            if (this.night.witchActed) return this._fail(real.id, '女巫本夜已经行动');
            if (action.choice === 'save') {
                if (!this.witchItems.antidote || this.night.wolf == null) return this._fail(real.id, '解药不可用');
                if (this.night.wolf === seat.number && !this._witchCanSaveSelf(seat)) return this._fail(real.id, this.witchSelfSave === 'firstNight' ? '本局规则仅允许女巫首夜自救' : '本局规则不允许女巫自救');
                this.night.saved = true;
                this.witchItems.antidote = false;
            }
            else if (action.choice === 'poison') { if (!this.witchItems.poison || !target) return this._fail(real.id, '毒药不可用'); this.night.poison = target.number; this.witchItems.poison = false; }
            else if (action.choice !== 'pass') return this._fail(real.id, '请选择用药或跳过');
            this.night.witchActed = true;
            return this._privateSuccess(real.id, '药瓶已经收起，本阶段计时结束后会轮到预言家');
        }
        return this._fail(real.id, '夜色尚未呼唤你的身份');
    }

    _settleWolfVote(playerId) {
        const counts = {};
        Object.values(this.night.wolfVotes || {}).forEach(number => { counts[number] = (counts[number] || 0) + 1; });
        const highest = Math.max(0, ...Object.values(counts));
        const leaders = Object.keys(counts).filter(number => counts[number] === highest).map(Number);
        if (highest > 0 && leaders.length === 1) {
            this.night.wolf = leaders[0];
            this.night.wolfResolved = true;
            return this._privateSuccess(playerId, `狼队意见一致，今夜的目标是 ${leaders[0]} 号`);
        }
        if ((this.night.wolfVoteRound || 1) < 2 && leaders.length > 1) {
            this.night.wolfVoteRound = 2;
            this.night.wolfVotes = {};
            this.night.wolfTieTargets = leaders;
            const startedAt = Number(this.now());
            this.nightFlow = { phase: 'nightWolf', startedAt, deadlineAt: startedAt + NIGHT_ACTION_SECONDS * 1000, durationSeconds: NIGHT_ACTION_SECONDS };
            this.log.push(`狼队首轮平票（${leaders.join('、')}号），进入第二轮 20 秒投票`);
            return this._privateSuccess(playerId, `第一轮出现平票（${leaders.join('、')}号），请在剩余 20 秒内重新选择`);
        }
        this.night.wolf = null;
        this.night.wolfResolved = true;
        this.night.wolfTieTargets = leaders;
        return this._privateSuccess(playerId, leaders.length ? `狼队最终平票（${leaders.join('、')}号），今夜无人遇袭` : '狼队未投出有效目标，今夜无人遇袭');
    }

    _resolveNight() {
        const deaths = [];
        // The guard only blocks the wolf attack.  A witch antidote does not
        // stack with that shield: when both protect the same wolf target the
        // protection is pierced ("同守同救 / 奶穿") and the target still dies.
        // Poison is appended independently below and is never blocked by the
        // guard.
        const guardProtected = this.night.wolf != null && this.night.guard === this.night.wolf;
        const guardSaveConflict = Boolean(guardProtected && this.night.saved);
        this.night.guardSaveConflict = guardSaveConflict;
        const killedByWolf = this.night.wolf != null && (this.night.saved ? guardSaveConflict : !guardProtected) ? this.night.wolf : null;
        const killedByPoison = this.night.poison ?? null;
        if (killedByWolf != null) deaths.push(killedByWolf);
        // Poison is an independent death source: a guard's protection never
        // changes whether the witch's poison kills its target.
        if (killedByPoison != null && !deaths.includes(killedByPoison)) deaths.push(killedByPoison);
        deaths.sort((left, right) => left - right);
        deaths.forEach(number => { const seat = this._seat(number); if (seat) seat.alive = false; });
        const text = deaths.length ? `天亮，${deaths.join('、')} 号倒牌` : '天亮，昨夜平安夜';
        const announcement = { day: this.day, kind: 'night', deaths: deaths.slice(), peaceful: deaths.length === 0, text, createdAt: Number(this.now()) };
        // Dawn is announced before the sheriff election, while the actual
        // first-night result remains hidden until that election is over.
        if (this.day === 1 && this.sheriff.enabled && this.sheriff.status === 'pending') {
            this.pendingNightResult = { deaths: deaths.slice(), poisonedSeats: this.night.poison != null ? [this.night.poison] : [], announcement, dawnAnnounced: true };
            this._beginDayAgenda();
            return;
        }
        this._publishNightResult({ deaths, poisonedSeats: this.night.poison != null ? [this.night.poison] : [], announcement });
    }

    _publishPendingNightResult() {
        if (!this.pendingNightResult) return;
        const pending = this.pendingNightResult;
        this.pendingNightResult = null;
        this._publishNightResult(pending);
    }

    _publishNightAnnouncement({ deaths, announcement, dawnAnnounced = false }) {
        this.announcement = { ...announcement, deaths: announcement.deaths.slice() };
        this.announcementHistory.push({ ...this.announcement, deaths: this.announcement.deaths.slice() });
        const title = dawnAnnounced ? '昨夜结果' : deaths.length ? '天亮了' : '平安夜';
        const text = deaths.length ? `昨夜的死者是 ${deaths.join('、')} 号` : '昨夜无人出局';
        this._publishEvent(deaths.length ? 'nightDeaths' : 'peacefulNight', title, text, deaths, {
            dawnAnnounced: Boolean(dawnAnnounced),
            announcement: { ...this.announcement, deaths: this.announcement.deaths.slice() },
        });
        this.log.push(announcement.text);
    }

    _publishNightResult({ deaths, poisonedSeats, announcement, dawnAnnounced = false }) {
        this._publishNightAnnouncement({ deaths, announcement, dawnAnnounced });
        const firstNightKindBySeat = this.day === 1
            ? Object.fromEntries([...new Set((deaths || []).map(Number))].map(number => [number, 'firstNight']))
            : {};
        this._beginDeathResolution(deaths, 'day', poisonedSeats, this.day === 1, false, null, { kindBySeat: firstNightKindBySeat });
    }

    _beginDeathResolution(deaths, after, poisonedSeats = [], allowLastWords = true, eventsPublished = false, lastWordsSeats = null, lastWordsOptions = {}) {
        const seats = [...new Set(deaths.map(Number))].filter(number => this._seat(number));
        if (!seats.length) {
            this._checkWinner();
            if (this.status === 'playing') this._continueAfterDeathResolution(after);
            return;
        }
        if (!eventsPublished) seats.forEach(number => this._publishEvent('elimination', '玩家出局', `${number} 号已出局`, [number], {
            selfSeat: number, selfText: '您已出局', singlePresentation: true,
            presentationDurationMs: PRESENTATION_CONTENT_DURATIONS.elimination + PRESENTATION_FADE_MS,
        }));
        const normalizedPoisoned = poisonedSeats.map(Number);
        const hunter = seats.map(number => this._seat(number)).find(seat => seat?.role === 'hunter' && !normalizedPoisoned.includes(seat.number));
        // A legal hunter shot is part of the same elimination chain. Keep the
        // private death-resolution step even when this death reaches a win
        // condition: official daytime deaths still receive their last-words
        // window before the final identity/victory bulletin is published.
        this.deathResolution = { seats, settledSeats: {}, after, poisonedSeats: normalizedPoisoned, allowLastWords, lastWordsSeats: Array.isArray(lastWordsSeats) ? lastWordsSeats.slice() : null };
        this.deathResolution.lastWordsOptions = {
            durationBySeat: { ...(lastWordsOptions.durationBySeat || {}) },
            kindBySeat: { ...(lastWordsOptions.kindBySeat || {}) },
            defaultDurationSeconds: lastWordsOptions.defaultDurationSeconds,
        };
        this.pendingHunter = hunter ? { seat: hunter.number } : null;
        if (hunter) this._publishEvent('hunterReveal', '身份揭晓', `${hunter.number} 号的身份是猎人`, [hunter.number]);
        this.pendingBadge = this.sheriff.holderSeat != null && seats.includes(this.sheriff.holderSeat) ? { seat: this.sheriff.holderSeat } : null;
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
            this._publishEvent('elimination', '玩家出局', `${target.number} 号已出局`, [target.number], {
                selfSeat: target.number, selfText: '您已出局', singlePresentation: true,
                presentationDurationMs: PRESENTATION_CONTENT_DURATIONS.elimination + PRESENTATION_FADE_MS,
            });
            this.deathResolution.seats.push(target.number);
            if (this.sheriff.holderSeat === target.number) this.pendingBadge = { seat: target.number };
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

    _wolfSelfDestruct(real) {
        const allowedPhases = ['sheriffSignup', 'sheriffCampaign', 'sheriffRunoffSpeech', 'day', 'dayRunoffSpeech'];
        const wolf = this._active(real.id);
        if (!allowedPhases.includes(this.phase) || !wolf?.alive || wolf.role !== 'werewolf' || !this._controlsSeat(real.id, wolf)) return this._fail(real.id, '现在不能发动狼人自爆');
        const duringSheriffElection = this.sheriff.enabled && ['sheriffSignup', 'sheriffCampaign', 'sheriffRunoffSpeech'].includes(this.phase);
        wolf.alive = false;
        this.speechFlow = null;
        this.runoffSpeechFlow = null;
        this.votes = {};
        this.log.push(`${wolf.number} 号狼人自爆，白天流程立即结束`);
        const selfDestructText = `${wolf.number} 号玩家自爆`;
        const gateId = `${this.gameEpoch}:self-destruct:${this.day}:${wolf.number}:${this.eventSequence + 1}`;
        const selfDestructEvent = this._publishEvent('wolfSelfDestruct', selfDestructText, '', [wolf.number], {
            gateId, selfSeat: wolf.number, selfText: '您已自爆',
        });
        this._publishEvent('elimination', '玩家出局', `${wolf.number} 号已出局`, [wolf.number], {
            presentation: 'perspective', selfSeat: wolf.number, selfText: '您已出局', singlePresentation: true,
            presentationDurationMs: PRESENTATION_CONTENT_DURATIONS.elimination + PRESENTATION_FADE_MS,
        });
        this._setPresentationGate({ id: gateId, kind: 'selfDestructResult', seatNumber: wolf.number, eventId: selfDestructEvent.id });
        let deaths = [wolf.number];
        let poisonedSeats = [];
        if (duringSheriffElection) {
            this.sheriff.deadlineAt = null;
            this.sheriff.turn = null;
        }
        // The official table grants an ordinary wolf self-destruct a separate
        // 30-second last-words window.  It must happen before the night
        // curtain.  A first-day sheriff self-destruct keeps the first-night
        // result deferred until after that statement.  The deferred deaths
        // still belong to the first dawn and must be fully resolved before
        // the second “night falls” curtain is published.
        if (duringSheriffElection) {
            this.pendingSelfDestructSequence = {
                selfDestructSeat: wolf.number,
                pendingNightResult: this.pendingNightResult,
            };
            this.pendingNightResult = null;
            this._beginLastWords([wolf.number], 'selfDestructNight', {
                durationBySeat: { [wolf.number]: SELF_DESTRUCT_WORDS_SECONDS },
                kindBySeat: { [wolf.number]: 'selfDestruct' },
            });
        } else {
            const selfDestructLastWords = [wolf.number];
            this._beginDeathResolution(deaths, 'night', poisonedSeats, true, true, selfDestructLastWords, {
                durationBySeat: { [wolf.number]: SELF_DESTRUCT_WORDS_SECONDS },
                kindBySeat: { [wolf.number]: 'selfDestruct' },
            });
            if (this.deathResolution?.seats.includes(wolf.number)) {
                this.deathResolution.settledSeats[wolf.number] = true;
                this._completeDeathResolution();
            }
        }
        return this._success(`${wolf.number} 号狼人自爆，白天结束`);
    }

    _completeDeathResolution() {
        if (!this.deathResolution || !this.deathResolution.seats.every(number => this.deathResolution.settledSeats[number])) return;
        const { after, allowLastWords, lastWordsSeats, lastWordsOptions = {} } = this.deathResolution;
        const resolvedSeats = this.deathResolution.seats.slice();
        this.deathResolution = null;
        this.pendingHunter = null;
        this.pendingBadge = null;
        // Resolve the words before checking the win boundary.  NetEase's
        // standard table gives every daytime death a last-words window,
        // including the final player whose death ends the game.
        if (allowLastWords || lastWordsSeats?.length) {
            this._beginLastWords(lastWordsSeats || resolvedSeats, after, lastWordsOptions);
            return;
        }
        this._continueAfterDeathResolution(after);
    }

    _continueAfterDeathResolution(after) {
        this._checkWinner();
        if (this.status === 'ended') return;
        if (after === 'selfDestructNight') {
            this._resumeAfterSelfDestructWords();
            return;
        }
        if (after === 'day') {
            this._beginDayAgenda();
        } else this._beginNextNight();
    }

    _resumeAfterSelfDestructWords() {
        const pendingSequence = this.pendingSelfDestructSequence;
        if (!pendingSequence) {
            this._beginNextNight();
            return;
        }
        const firstTwelvePlayerAttempt = this.playerCount === 12 && this.sheriff.electionAttempt === 1;
        this.sheriff.holderSeat = null;
        this.sheriff.status = firstTwelvePlayerAttempt ? 'deferred' : 'torn';
        const title = firstTwelvePlayerAttempt ? '警长竞选延期' : '本局警徽流失';
        const text = firstTwelvePlayerAttempt ? '警长竞选顺延至下一白天' : '本局警徽流失';
        const gateId = `${this.gameEpoch}:sheriff-disposition:${this.day}:${this.sheriff.electionAttempt}:${this.eventSequence + 1}`;
        const event = this._publishEvent(firstTwelvePlayerAttempt ? 'sheriffDeferred' : 'badgeTorn', title, text, [], { gateId });
        this._setPresentationGate({ id: gateId, kind: 'sheriffDisposition', eventId: event.id });
    }

    _resumePendingSelfDestructNight() {
        const pendingSequence = this.pendingSelfDestructSequence;
        this.pendingSelfDestructSequence = null;
        this.presentationGate = null;
        if (!pendingSequence) { this._beginNextNight(); return; }
        // The bomber's 30-second statement is a daytime event.  The hidden
        // first-night result is still part of that first dawn: announce it,
        // resolve every departure skill and first-night statement, and only
        // then let _beginNextNight publish “天黑请闭眼”.
        const pending = pendingSequence.pendingNightResult;
        if (!pending) {
            this._beginNextNight();
            return;
        }
        const bomberSeat = Number(pendingSequence.selfDestructSeat);
        const pendingDeathSeats = [...new Set((pending.deaths || []).map(Number))]
            .filter(number => Number.isFinite(number) && number !== bomberSeat && this._seat(number));
        const pendingAnnouncement = {
            ...pending,
            deaths: pendingDeathSeats,
            announcement: { ...(pending.announcement || {}), deaths: pendingDeathSeats },
            dawnAnnounced: true,
        };
        this._publishNightAnnouncement(pendingAnnouncement);
        if (!pendingDeathSeats.length) {
            this._beginNextNight();
            return;
        }
        pendingDeathSeats.forEach(number => this._publishEvent('elimination', '玩家出局', `${number} 号已出局`, [number], {
            selfSeat: number, selfText: '您已出局', singlePresentation: true,
            presentationDurationMs: PRESENTATION_CONTENT_DURATIONS.elimination + PRESENTATION_FADE_MS,
        }));
        // A malformed/legacy pending result can contain the bomber again.  It
        // has already completed the independent 30-second self-destruct
        // words, so never schedule that seat for a second ordinary window.
        // Keep the remaining victims in seat order and label their windows as
        // first-night words so the two rule types cannot be confused in the
        // client or in the audit trail.
        const pendingLastWordsSeats = pendingDeathSeats.slice();
        const firstNightKindBySeat = Object.fromEntries(pendingLastWordsSeats.map(number => [number, 'firstNight']));
        this._beginDeathResolution(
            pendingDeathSeats,
            'night',
            pending.poisonedSeats || [],
            pendingLastWordsSeats.length > 0,
            true,
            pendingLastWordsSeats,
            { kindBySeat: firstNightKindBySeat },
        );
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

    _dayVoteEligibleSeats() {
        const tied = this.dayVoteRound === 2 ? new Set(this.dayTieTargets || []) : null;
        return this.seats.filter(seat => seat.alive && (!tied || !tied.has(seat.number)));
    }

    _vote(real, targetSeat) {
        if (this.phase !== 'vote') return this._fail(real.id, '现在不是放逐投票时间');
        const voter = this._active(real.id); const abstain = targetSeat === null || targetSeat === undefined; const target = abstain ? null : this._seat(targetSeat);
        if (!voter?.alive || !this._controlsSeat(real.id, voter) || !this._dayVoteEligibleSeats().some(seat => seat.number === voter.number) || (!abstain && !target?.alive)) return this._fail(real.id, this.dayVoteRound === 2 ? 'PK 候选人不能投票，其他存活玩家才可以投票' : '只有仍在场的玩家可以投票，且只能选择仍在场的目标');
        if (!abstain && this.dayVoteRound === 2 && !this.dayTieTargets.includes(target.number)) return this._fail(real.id, '第二轮只能投给首轮平票玩家');
        if (Object.prototype.hasOwnProperty.call(this.votes, voter.number)) return this._fail(real.id, '你在本轮已经投过票了');
        this.votes[voter.number] = abstain ? null : target.number;
        const aliveCount = this._dayVoteEligibleSeats().length;
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
        const message = high && top.length === 1 ? `${top[0]} 号被放逐` : round === 1 ? top.length ? `首轮平票（${top.join('、')}号），进入 PK 发言` : '首轮全部弃权，本日无人出局' : top.length ? '第二轮仍平票，本轮无人出局' : '第二轮全部弃权，本轮无人出局';
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
            final: Boolean(high && top.length === 1) || round === 2 || (!high && round === 1 && !top.length),
            resolvedAt: Number(this.now()),
        };
        this.lastVoteResult = result;
        this._publishEvent(high && top.length === 1 ? 'exile' : 'voteTie', '投票结束', high && top.length === 1 ? `${top[0]} 号玩家被放逐` : message, high && top.length === 1 ? [top[0]] : []);
        this.voteHistory.push(result);
        this.votes = {};
        if (!(high && top.length === 1) && round === 1 && top.length) {
            this.dayVoteRound = 2;
            this.dayTieTargets = top.slice();
            this._beginDayRunoffSpeech(top);
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
    _beginPresentation() {
        const now = Number(this.now());
        this.presentationQueue = this.presentationQueue
            .filter(batch => Array.isArray(batch.events) && batch.events.length && Number(batch.endsAt) > now - 120000)
            .slice(-60);
        const previousEnd = Number(this.presentationQueue.at(-1)?.endsAt);
        const startedAt = Math.max(now, Number.isFinite(previousEnd) ? previousEnd : now);
        this.presentation = {
            sequence: ++this.presentationSequence,
            transactionId: `${this.gameEpoch}:presentation:${this.presentationSequence}`,
            startedAt,
            endsAt: startedAt,
            durationMs: 0,
            blocking: true,
            events: [],
            resolved: false,
            nextPhase: null,
            nextPlayerId: null,
            ended: false,
            winner: null,
        };
        this.presentationQueue.push(this.presentation);
        return this.presentation;
    }

    _ensurePresentation() {
        const now = Number(this.now());
        if (!this.presentation || !Array.isArray(this.presentation.events) || !this.presentation.events.length || Number(this.presentation.endsAt) <= now) return this._beginPresentation();
        return this.presentation;
    }

    _presentationParts(event = {}) {
        if (event.displayText != null) return [String(event.displayText).trim()].filter(Boolean);
        if (event.publicDisplayText != null) return [String(event.publicDisplayText).trim()].filter(Boolean);
        const title = String(event.title || '').trim();
        const text = String(event.text ?? event.detail ?? '').trim();
        const single = Boolean(event.singlePresentation || ['nightFalls', 'peacefulNight', 'elimination', 'outcome'].includes(event.kind));
        if (single) return [text || title].filter(Boolean);
        if (title && text && title !== text) return [title, text];
        return [text || title].filter(Boolean);
    }

    _appendPresentationEvent(event = {}) {
        const batch = this._ensurePresentation();
        const sourceEventId = event.eventId ?? event.id ?? `${this.gameEpoch}:event:${++this.presentationEventSequence}`;
        const parts = this._presentationParts(event);
        if (!parts.length) return [];
        const atomGroupId = parts.length > 1 ? `${batch.transactionId}:${sourceEventId}` : null;
        const atoms = parts.map((displayText, index) => {
            const contentDurationMs = Number(event.presentationContentDurationMs) > 0
                ? Number(event.presentationContentDurationMs)
                : presentationContentDuration(event.kind, displayText);
            const durationMs = Number(event.presentationDurationMs) > 0
                ? Number(event.presentationDurationMs)
                : contentDurationMs + PRESENTATION_FADE_MS;
            const startedAt = Math.max(Number(this.now()), Number(batch.endsAt) || Number(this.now()));
            const atom = {
                ...clone(event),
                eventId: `${sourceEventId}:${index}`,
                sourceEventId,
                displayText,
                publicDisplayText: displayText,
                selfDisplayText: event.selfText || event.selfDisplayText || null,
                selfSeat: event.selfSeat == null ? null : Number(event.selfSeat),
                winnerFaction: event.winnerFaction || null,
                atomGroupId,
                atomIndex: index,
                atomCount: parts.length,
                startedAt,
                endsAt: startedAt + durationMs,
                durationMs,
                contentDurationMs,
                fadeInMs: Number(event.fadeInMs) > 0 ? Number(event.fadeInMs) : 240,
                fadeOutMs: Number(event.fadeOutMs) > 0 ? Number(event.fadeOutMs) : PRESENTATION_FADE_MS,
            };
            batch.events.push(atom);
            batch.endsAt = atom.endsAt;
            batch.durationMs = batch.endsAt - batch.startedAt;
            return atom;
        });
        return atoms;
    }

    _publishEvent(kind, title, text, eliminatedSeats = [], metadata = {}) {
        this.publicEvent = { id: ++this.eventSequence, eventId: this.eventSequence, kind, title, text, eliminatedSeats: eliminatedSeats.slice(), day: this.day, createdAt: Number(this.now()), ...clone(metadata) };
        this.publicEvents.push({ ...this.publicEvent, eliminatedSeats: this.publicEvent.eliminatedSeats.slice() });
        if (this.publicEvents.length > 30) this.publicEvents.shift();
        if (this.publicEvent.presentation !== 'silent') this._appendPresentationEvent(this.publicEvent);
        return this.publicEvent;
    }

    _appendOutcomePresentation(faction, message, text, reason) {
        const event = {
            eventId: `outcome:${this.eventSequence}`,
            kind: 'outcome',
            title: message,
            text,
            publicDisplayText: message,
            selfText: '您已获胜',
            winnerFaction: faction,
            reason,
            singlePresentation: true,
            presentationContentDurationMs: PRESENTATION_CONTENT_DURATIONS.outcome,
            presentationDurationMs: PRESENTATION_CONTENT_DURATIONS.outcome + PRESENTATION_FADE_MS,
        };
        return this._appendPresentationEvent(event);
    }

    _presentationBatches(serverNow = Number(this.now())) {
        return this.presentationQueue
            .filter(batch => Number(batch.endsAt) > serverNow && Array.isArray(batch.events) && batch.events.length)
            .map(batch => ({ ...clone(batch), serverNow }));
    }

    _projectPresentationEvent(event, player) {
        const projected = { ...event };
        const activeSeat = this._active(player?.id);
        const faction = ROLE_INFO[activeSeat?.role]?.faction;
        if (event.selfSeat != null && Number(event.selfSeat) === Number(activeSeat?.number)) {
            if (event.selfDisplayText) projected.displayText = event.selfDisplayText;
            projected.viewerVariant = event.kind === 'elimination' ? 'personalElimination' : 'personalPerspective';
        } else if (event.kind === 'outcome' && faction && faction === event.winnerFaction) {
            projected.displayText = event.selfDisplayText || '您已获胜';
            projected.viewerVariant = 'personalVictory';
        } else {
            projected.displayText = event.publicDisplayText || event.displayText;
        }
        return projected;
    }

    _projectPresentation(batch, player) {
        if (!batch) return batch;
        const projected = clone(batch);
        projected.events = projected.events.map(event => this._projectPresentationEvent(event, player));
        return projected;
    }
    _finish(faction, message, reason, text) {
        // `nightFalls` is a presentation gate, not the cause of a win.  It
        // can be queued immediately after a self-destruct, so allowing it to
        // become the winner trigger would make the final bulletin claim that
        // the game ended because night arrived.  Keep the nearest causal
        // event (exile, self-destruct, night result, etc.) instead.
        const triggerEvent = this.publicEvents.slice().reverse().find(event => !['elimination', 'hunterReveal', 'nightFalls', 'lastWordsStart', 'selfDestructWordsStart'].includes(event.kind)) || this.publicEvent;
        const groups = {};
        this.seats.forEach(seat => { const name = ROLE_INFO[seat.role]?.name || seat.role; (groups[name] ||= []).push(seat.number); });
        const identityText = Object.entries(groups).map(([name, seats]) => `${name}：${seats.join('、')} 号`).join('；');
        this._publishEvent('identityReveal', '全员身份揭晓', identityText, []);
        this.status = 'ended'; this.phase = 'ended';
        this.winner = { faction, name: message, reason, text, trigger: triggerEvent?.kind || null, eliminatedSeats: triggerEvent?.eliminatedSeats?.slice() || [] };
        this._appendOutcomePresentation(faction, message, text, reason);
        this.log.push(`${message}：${text}`);
    }
    _seat(number) { return this.seats.find(seat => seat.number === Number(number)); }
    _publicSeatAlive(seat) {
        // During first-day sheriff signup the previous night's result is still
        // hidden. The engine marks deaths internally for eligibility and win
        // checks, but the shared board must not reveal them before the official
        // dawn announcement.
        return this.pendingNightResult ? true : seat.alive;
    }
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
        if (this.phase === 'roleReveal') return { key: 'nightPrelude', name: '第一夜 · 天黑请闭眼' };
        const nightPhases = this._nightPhases();
        if (this.phase === 'nightPrelude') return { key: nightPhases[0], name: this._phaseName(nightPhases[0]) };
        if (nightPhases.includes(this.phase)) {
            const phase = nightPhases[nightPhases.indexOf(this.phase) + 1];
            return { key: phase || 'day', name: phase ? this._phaseName(phase) : '天亮与昨夜结果' };
        }
        if (this.phase === 'deathResolution') return { key: 'lastWords', name: this._phaseName('lastWords') };
        if (this.phase === 'lastWords') return this.lastWordsFlow?.after === 'night' ? { key: 'nightPrelude', name: `第 ${this.day + 1} 夜 · 天黑请闭眼` } : this.sheriff.enabled && ['pending', 'deferred'].includes(this.sheriff.status) ? { key: 'sheriffPrelude', name: this._phaseName('sheriffPrelude') } : { key: 'day', name: this._phaseName('day') };
        if (this.phase === 'sheriffPrelude') return { key: 'sheriffSignup', name: this._phaseName('sheriffSignup') };
        if (this.phase === 'sheriffSignup') return { key: 'sheriffCampaign', name: '警上发言或直接产生警长' };
        if (this.phase === 'sheriffCampaign') return { key: 'sheriffVote', name: '警长投票或直接产生警长' };
        if (this.phase === 'sheriffVote') return { key: 'sheriffRunoffSpeech', name: '公布结果（平票则进入 PK）' };
        if (this.phase === 'sheriffRunoffSpeech') return { key: 'sheriffRunoffVote', name: this._phaseName('sheriffRunoffVote') };
        if (this.phase === 'sheriffRunoffVote') return { key: 'day', name: '公布警长结果并开始白天发言' };
        if (this.phase === 'day') return { key: 'vote', name: this._phaseName('vote') };
        if (this.phase === 'dayRunoffSpeech') return { key: 'vote', name: 'PK 发言结束后进行第二轮投票' };
        if (this.phase === 'vote') return { key: 'deathResolution', name: '公布放逐结果' };
        return { key: null, name: '静候揭晓' };
    }
    _phaseProgress() {
        const aliveSeats = this.seats.filter(seat => seat.alive);
        if (this.phase === 'roleReveal') return { completed: Object.keys(this.roleConfirmedSeats).length, total: this.seats.length, label: '已记下身份' };
        if (this.phase === 'day') return { completed: Object.keys(this.dayReadySeats).length, total: aliveSeats.length, label: '已完成发言' };
        if (this.phase === 'lastWords') return { completed: Object.keys(this.lastWordsFlow?.completedSeats || {}).length, total: this.lastWordsFlow?.order.length || 0, label: '已完成遗言' };
        if (this.phase === 'sheriffPrelude') return { completed: this.presentationGate ? Object.keys(this.presentationGate.acknowledgedPlayerIds || {}).length : 0, total: this._presentationPlayers().length, label: '正在播报警长竞选' };
        if (this.phase === 'sheriffSignup') return { completed: Object.keys(this.sheriff.signup).length, total: this.seats.filter(seat => this._canJoinFirstSheriffElection(seat)).length, label: '已作出上警选择' };
        if (this.phase === 'sheriffCampaign') return { completed: this.sheriff.campaignIndex, total: this.sheriff.candidates.length, label: '已完成警上发言' };
        if (this.phase === 'sheriffVote' || this.phase === 'sheriffRunoffVote') return { completed: Object.keys(this.sheriff.votes).length, total: this._sheriffEligibleVoters().length, label: '已投出警长票' };
        if (this.phase === 'sheriffRunoffSpeech') return { completed: this.sheriff.runoffIndex, total: this.sheriff.runoffCandidates.length, label: '已完成 PK 发言' };
        if (this.phase === 'dayRunoffSpeech') return { completed: Object.keys(this.runoffSpeechFlow?.completedSeats || {}).length, total: this.runoffSpeechFlow?.order.length || 0, label: '已完成放逐 PK 发言' };
        if (this.phase === 'vote') return { completed: Object.keys(this.votes).length, total: this._dayVoteEligibleSeats().length, label: `第 ${this.dayVoteRound} 轮放逐投票` };
        if (this.phase === 'deathResolution') return { completed: 0, total: 1, label: '离场行动' };
        if (this.phase === 'nightPrelude') return { completed: this.presentationGate ? Object.keys(this.presentationGate.acknowledgedPlayerIds || {}).length : 0, total: this._presentationPlayers().length, label: '正在播报夜幕' };
        if (this._nightPhases().includes(this.phase)) return { completed: 0, total: 1, label: '夜幕之中' };
        return { completed: this.status === 'ended' ? 1 : 0, total: 1, label: this.status === 'ended' ? '故事落幕' : '静候开局' };
    }
    _phaseInstruction() {
        if (this.phase === 'roleReveal') return `请各自查看并记住身份；${this.seats.length} 人全部确认后，第一夜降临。`;
        if (this.phase === 'nightPrelude') return this._nightPhases().includes('nightGuard') ? '夜幕播报完成后，守卫才会获得完整的 20 秒行动时间。' : '夜幕播报完成后，狼人行动才会获得完整的 20 秒行动时间。';
        if (this.phase === 'nightGuard') return '守卫请睁眼，本阶段固定 20 秒；超时默认空守。其他玩家请保持安静。';
        if (this.phase === 'nightWolf') return '狼人请睁眼，本阶段固定 20 秒；可更新临时票，到点结算，平票则无人遇袭。';
        if (this.phase === 'nightSeer') return '预言家请睁眼，本阶段固定 20 秒；超时默认不查验。其他玩家请保持安静。';
        if (this.phase === 'nightWitch') return '女巫请睁眼，本阶段固定 20 秒；超时默认不用药。其他玩家请保持安静。';
        if (this.phase === 'deathResolution') return '出局玩家正在自己的界面完成离场行动，其他玩家请稍候。';
        if (this.phase === 'lastWords') return `现在请 ${this._currentTimedSeat(this.lastWordsFlow) ?? '当前'} 号玩家留下遗言，结束后轮到下一位。`;
        if (this.phase === 'sheriffPrelude') return '警长竞选播报完全结束后才会开放报名。';
        if (this.phase === 'sheriffSignup') return this.sheriff.electionAttempt > 1 ? '警长竞选重新开始，每名存活玩家选择上警或不上警。' : '首夜死讯尚未公布，每名玩家都选择上警或不上警，所有人决定后再一同公布候选人。';
        if (this.phase === 'sheriffCampaign') return `请 ${this.sheriff.candidates[this.sheriff.campaignIndex] ?? '当前'} 号候选人完成警上发言并选择继续竞选或退水。`;
        if (this.phase === 'sheriffVote') return '非候选存活玩家投票选出警长，也可以弃票。';
        if (this.phase === 'sheriffRunoffSpeech') return `请 ${this.sheriff.runoffCandidates[this.sheriff.runoffIndex] ?? '当前'} 号候选人完成 PK 发言。`;
        if (this.phase === 'sheriffRunoffVote') return '仅原警下玩家进行最后一轮警长投票；原警上玩家仍无投票权，再次平票则无警长。';
        if (this.phase === 'day') return `请 ${this._currentTimedSeat(this.speechFlow) ?? '当前'} 号玩家发言，顺序为${this.speechFlow?.direction === 'counterclockwise' ? '逆时针' : '顺时针'}。`;
        if (this.phase === 'dayRunoffSpeech') return `首轮平票玩家为 ${this.dayTieTargets.join('、')} 号，请依次完成 PK 发言。`;
        if (this.phase === 'vote') return this.dayVoteRound === 2 ? `首轮平票玩家为 ${this.dayTieTargets.join('、')} 号，PK 发言后由其他存活玩家投票。` : '每名存活玩家各投一票，所有人投完后公布结果。';
        return this.status === 'ended' ? '本局结束，现在可以查看所有人的身份。' : '请留意接下来的引导。';
    }
    _fail(playerId, message) { return { success: false, message, state: this.getPlayerState(playerId) }; }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner }; }
    _privateSuccess(playerId, message) { return { ...this._success(message), privateFor: playerId, publicMessage: '' }; }

    _publicTimedFlow(flow) {
        if (!flow) return null;
        const currentSeat = this._currentTimedSeat(flow);
        const turn = flow.turn ? { ...flow.turn } : null;
        const durationSeconds = this._timedFlowDuration(flow, currentSeat);
        const effectiveNow = this.flowPausedAt == null ? Number(this.now()) : this.flowPausedAt;
        return {
            day: flow.day,
            after: flow.after || null,
            startSeat: flow.startSeat ?? flow.order[0] ?? null,
            direction: flow.direction || null,
            directionName: flow.direction === 'counterclockwise' ? '逆时针' : flow.direction === 'clockwise' ? '顺时针' : null,
            order: flow.order.slice(),
            currentIndex: flow.currentIndex,
            currentSeat,
            currentKind: flow.kindBySeat ? (flow.kindBySeat?.[currentSeat] || (flow.after === 'selfDestructNight' ? 'selfDestruct' : 'lastWords')) : null,
            completedSeats: Object.keys(flow.completedSeats || {}).map(Number),
            durationSeconds,
            status: !currentSeat ? 'completed' : turn ? 'speaking' : 'waiting',
            startedAt: turn?.startedAt || null,
            deadlineAt: turn?.deadlineAt || null,
            remainingSeconds: turn ? Math.max(0, Math.ceil((turn.deadlineAt - effectiveNow) / 1000)) : durationSeconds,
            sheriff: flow.sheriff ? { ...flow.sheriff } : null,
        };
    }

    _copyVoteResult(result) {
        return result ? { ...result, ballots: result.ballots.map(ballot => ({ ...ballot })), counts: { ...result.counts }, topSeats: result.topSeats.slice() } : null;
    }

    _copyPublicEvent(event) {
        if (!event) return null;
        return {
            ...event,
            eliminatedSeats: event.eliminatedSeats.slice(),
            ...(event.announcement ? { announcement: { ...event.announcement, deaths: event.announcement.deaths.slice() } } : {}),
        };
    }

    _publicSheriff() {
        const signupComplete = this.phase !== 'sheriffSignup';
        const effectiveNow = this.flowPausedAt == null ? Number(this.now()) : this.flowPausedAt;
        return {
            enabled: this.sheriff.enabled,
            status: this.sheriff.status,
            electionAttempt: this.sheriff.electionAttempt,
            holderSeat: this.sheriff.holderSeat,
            signupCompleted: Object.keys(this.sheriff.signup).length,
            candidates: signupComplete ? this.sheriff.candidates.slice() : [],
            withdrawn: signupComplete ? this.sheriff.withdrawn.slice() : [],
            currentCandidate: this.phase === 'sheriffCampaign' ? this.sheriff.candidates[this.sheriff.campaignIndex] ?? null : this.phase === 'sheriffRunoffSpeech' ? this.sheriff.runoffCandidates[this.sheriff.runoffIndex] ?? null : null,
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
        const serverNow = Number(this.now());
        const effectiveNow = this.flowPausedAt == null ? Number(this.now()) : this.flowPausedAt;
        const nightFlow = this.nightFlow ? { ...this.nightFlow, remainingSeconds: Math.max(0, Math.ceil((this.nightFlow.deadlineAt - effectiveNow) / 1000)) } : null;
        const presentationPlayers = this._presentationPlayers();
        const presentationGate = this.presentationGate ? { id: this.presentationGate.id, kind: this.presentationGate.kind, targetDay: this.presentationGate.targetDay, eventId: this.presentationGate.eventId, startedAt: this.presentationGate.startedAt, endsAt: this.presentationGate.endsAt, completed: presentationPlayers.filter(player => this.presentationGate.acknowledgedPlayerIds[player.id]).length, total: presentationPlayers.length } : null;
        const presentations = this._presentationBatches(serverNow);
        // Keep an empty/current batch in the singular field for clients that
        // receive the state in the same tick as an event is appended.  The
        // array contains only active batches and is the replay cursor used by
        // reconnecting browsers.
        const presentation = presentations.at(-1) || (this.presentation ? { ...clone(this.presentation), serverNow } : null);
        return { roomId: this.roomId, gameEpoch: this.gameEpoch, status: this.status, phase: this.phase, phaseName: this._phaseName(this.phase), nextPhase: nextPhase.key, nextPhaseName: nextPhase.name, phaseProgress: this._phaseProgress(), phaseInstruction: offlineSeats.length ? `${offlineSeats.join('、')} 号玩家暂时离线，游戏会等他们回来，不会代替他们作出选择。` : this._phaseInstruction(), flowPaused: offlineSeats.length > 0, offlineSeats, day: this.day, playerCount: this.playerCount, testMode, nightFlow, presentationGate, serverNow, presentations, presentation,
            seats: this.seats.map(seat => ({ number: seat.number, alive: this._publicSeatAlive(seat), isSheriff: seat.number === this.sheriff.holderSeat, occupied: Boolean(seat.controllerId), controllerName: this.realPlayers.find(player => player.id === seat.controllerId)?.name || null, roleConfirmed: Boolean(this.roleConfirmedSeats[seat.number]), dayReady: Boolean(this.dayReadySeats[seat.number]), role: this.status === 'ended' || testMode ? seat.role : null })),
            announcement: this.announcement ? { ...this.announcement, deaths: this.announcement.deaths.slice() } : null,
            announcementHistory: this.announcementHistory.map(item => ({ ...item, deaths: item.deaths.slice() })),
            lastWordsFlow: this._publicTimedFlow(this.lastWordsFlow), lastWordsHistory: this.lastWordsHistory.map(item => ({ ...item })), speechFlow: this._publicTimedFlow(this.speechFlow), runoffSpeechFlow: this._publicTimedFlow(this.runoffSpeechFlow),
            flowRules: {
                nightOrder: this._nightPhases().slice(),
                nightActionSeconds: NIGHT_ACTION_SECONDS,
                lastWordsSeconds: this._lastWordsSeconds(),
                selfDestructWordsSeconds: SELF_DESTRUCT_WORDS_SECONDS,
                lastWordsPolicy: {
                    firstNightDeaths: true,
                    laterNightDeaths: false,
                    daytimeDeaths: true,
                    poisonCountsAsNight: true,
                    hunterShotSharesCauseTime: true,
                    wolfSelfDestruct: true,
                },
                speechSeconds: SPEECH_SECONDS,
                runoffSpeechSeconds: SPEECH_SECONDS,
                sheriffEnabled: this.sheriff.enabled,
                winCondition: this.winCondition,
                witchSelfSave: this.witchSelfSave,
            },
            sheriff: this._publicSheriff(), voteCount: Object.keys(this.votes).length, dayVoteRound: this.dayVoteRound, dayTieTargets: this.dayTieTargets.slice(),
            lastVoteResult: this._copyVoteResult(this.lastVoteResult), voteHistory: this.voteHistory.map(result => this._copyVoteResult(result)),
            actionLog: this.log.slice(-20), publicEvent: this._copyPublicEvent(this.publicEvent), publicEvents: this.publicEvents.map(event => this._copyPublicEvent(event)), winner: this.winner ? { ...this.winner, eliminatedSeats: this.winner.eliminatedSeats.slice() } : null };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState(); const seat = this._active(playerId); const realPlayer = this.realPlayers.find(player => player.id === playerId) || null;
        state.myId = playerId; state.activeSeat = seat?.number ?? null; state.myRole = seat?.role || null; state.myRoleInfo = seat ? ROLE_INFO[seat.role] : null;
        state.canSwitchAnySeat = this.realPlayers.length === 1;
        const wolfPerspective = Boolean(seat?.role === 'werewolf');
        state.seats = state.seats.map(item => {
            const actual = this._seat(item.number);
            const isKnownWolf = Boolean(wolfPerspective && actual?.role === 'werewolf');
            return { ...item, canControl: this._controlsSeat(playerId, actual), isKnownWolf };
        });
        state.presentationAcknowledged = Boolean(this.presentationGate?.acknowledgedPlayerIds?.[playerId]);
        state.myFaction = ROLE_INFO[seat?.role]?.faction || null;
        state.presentation = this._projectPresentation(state.presentation, realPlayer);
        state.presentations = (state.presentations || []).map(batch => this._projectPresentation(batch, realPlayer));
        state.myRoleConfirmed = Boolean(seat && this.roleConfirmedSeats[seat.number]);
        state.canConfirmRole = Boolean(this.phase === 'roleReveal' && this._controlsSeat(playerId, seat) && !state.myRoleConfirmed);
        state.sheriffAction = null;
        if (this._canJoinFirstSheriffElection(seat) && this._controlsSeat(playerId, seat)) {
            if (this.phase === 'sheriffSignup') state.sheriffAction = { kind: 'signup', submitted: Object.hasOwn(this.sheriff.signup, seat.number) };
            else if (this.phase === 'sheriffCampaign' && this.sheriff.candidates[this.sheriff.campaignIndex] === seat.number) state.sheriffAction = { kind: 'campaign' };
            else if (this.phase === 'sheriffRunoffSpeech' && this.sheriff.runoffCandidates[this.sheriff.runoffIndex] === seat.number) state.sheriffAction = { kind: 'runoffSpeech' };
            else if (this.phase === 'sheriffVote' || this.phase === 'sheriffRunoffVote') {
                const candidates = this._currentSheriffCandidates();
                if (this._sheriffEligibleVoters(candidates).some(item => item.number === seat.number)) state.sheriffAction = { kind: 'vote', submitted: Object.hasOwn(this.sheriff.votes, seat.number), legalTargetSeats: candidates };
            }
        }
        state.myDayReady = Boolean(seat && this.dayReadySeats[seat.number]);
        const isCurrentSpeaker = Boolean(this.phase === 'day' && seat?.alive && this._controlsSeat(playerId, seat) && this._currentTimedSeat(this.speechFlow) === seat.number);
        const isCurrentRunoffSpeaker = Boolean(this.phase === 'dayRunoffSpeech' && seat?.alive && this._controlsSeat(playerId, seat) && this._currentTimedSeat(this.runoffSpeechFlow) === seat.number);
        const isCurrentLastWords = Boolean(this.phase === 'lastWords' && seat && this._controlsSeat(playerId, seat) && this._currentTimedSeat(this.lastWordsFlow) === seat.number);
        state.canStartSpeech = Boolean(isCurrentSpeaker && !this.speechFlow?.turn);
        state.canFinishSpeech = Boolean(isCurrentSpeaker && this.speechFlow?.turn?.seat === seat.number);
        state.canStartRunoffSpeech = Boolean(isCurrentRunoffSpeaker && !this.runoffSpeechFlow?.turn);
        state.canFinishRunoffSpeech = Boolean(isCurrentRunoffSpeaker && this.runoffSpeechFlow?.turn?.seat === seat.number);
        state.canConfirmDay = Boolean(isCurrentSpeaker && !state.myDayReady);
        state.canStartLastWords = Boolean(isCurrentLastWords && !this.lastWordsFlow?.turn);
        state.canFinishLastWords = Boolean(isCurrentLastWords && this.lastWordsFlow?.turn?.seat === seat.number);
        const timedFlow = this.phase === 'day' ? state.speechFlow : this.phase === 'dayRunoffSpeech' ? state.runoffSpeechFlow : this.phase === 'lastWords' ? state.lastWordsFlow : null;
        state.canTimerTick = Boolean(timedFlow?.deadlineAt && timedFlow.remainingSeconds === 0);
        state.wolfSeat = this.phase === 'nightWitch' && seat?.alive && seat.role === 'witch' && this._controlsSeat(playerId, seat) ? this.night.wolf ?? null : null;
        state.seerResult = this.phase === 'nightSeer' && seat?.role === 'seer' && this.night.seer != null ? { seat: this.night.seer, faction: ROLE_INFO[this._seat(this.night.seer).role].faction } : null;
        state.witchItems = seat?.role === 'witch' ? { ...this.witchItems } : null;
        state.witchCanSaveSelf = seat?.role === 'witch' ? this._witchCanSaveSelf(seat) : false;
        const requiredRole = ({ nightGuard: 'guard', nightWolf: 'werewolf', nightSeer: 'seer', nightWitch: 'witch' })[this.phase] || null;
        const pendingNightAction = seat && seat.role !== 'werewolf' && this.night.pendingActions?.[seat.number]?.phase === this.phase ? this.night.pendingActions[seat.number] : null;
        const awaitingSeerResult = Boolean(this.phase === 'nightSeer' && seat?.alive && seat.role === 'seer' && this.night.seer != null && !this.night.seerResultAcknowledged);
        const wolfVoteSubmitted = Boolean(seat && this.night.wolfVotes && Object.hasOwn(this.night.wolfVotes, seat.number));
        const submitted = requiredRole === 'guard' ? Boolean(this.night.guardActed)
            : requiredRole === 'werewolf' ? wolfVoteSubmitted
                : requiredRole === 'seer' ? this.night.seer != null
                    : requiredRole === 'witch' ? Boolean(this.night.witchActed) : false;
        state.skillState = {
            // Wolf resolution belongs to the previous night phase.  Do not
            // carry that flag into the witch/seer availability check: once
            // the 20-second wolf window expires, the next role must still be
            // able to act during its own fixed window.
            available: Boolean(seat?.alive && this._controlsSeat(playerId, seat) && requiredRole && seat.role === requiredRole && (requiredRole === 'werewolf' || !submitted) && !pendingNightAction && !awaitingSeerResult),
            submitted: Boolean(seat?.alive && requiredRole && seat.role === requiredRole && submitted),
        };
        state.nightConfirmation = pendingNightAction ? { stage: 'confirm', role: seat.role, targetSeat: pendingNightAction.targetSeat, choice: pendingNightAction.choice, canConfirm: true, canCancel: true }
            : awaitingSeerResult ? { stage: 'result', role: 'seer', targetSeat: this.night.seer, canConfirm: true, canCancel: false } : null;
        const voteEligible = Boolean(this.phase === 'vote' && seat?.alive && this._controlsSeat(playerId, seat) && this._dayVoteEligibleSeats().some(item => item.number === seat.number));
        const canVote = Boolean(voteEligible && !Object.prototype.hasOwnProperty.call(this.votes, seat.number));
        state.voteEligible = voteEligible;
        state.canVote = canVote;
        state.legalTargetSeats = canVote ? this.seats.filter(target => target.alive && (this.dayVoteRound !== 2 || this.dayTieTargets.includes(target.number))).map(target => target.number) : !state.skillState.available ? [] : this.seats.filter(target => target.alive
            && (requiredRole !== 'seer' || target.number !== seat.number)
            && (requiredRole !== 'guard' || target.number !== this.night.lastGuard)
            && (requiredRole !== 'werewolf' || this.night.wolfVoteRound !== 2 || (this.night.wolfTieTargets || []).includes(target.number))).map(target => target.number);
        state.canWolfSelfDestruct = Boolean(seat?.alive && seat.role === 'werewolf' && this._controlsSeat(playerId, seat) && ['sheriffSignup', 'sheriffCampaign', 'sheriffRunoffSpeech', 'day', 'dayRunoffSpeech'].includes(this.phase));
        state.wolfVote = seat?.alive && seat.role === 'werewolf' && this.phase === 'nightWolf' ? {
            round: this.night.wolfVoteRound || 1,
            submittedCount: Object.keys(this.night.wolfVotes || {}).length,
            totalWolves: this.seats.filter(item => item.alive && item.role === 'werewolf').length,
            myTarget: this.night.wolfVotes?.[seat.number] ?? null,
            ballots: Object.entries(this.night.wolfVotes || {}).map(([voterSeat, targetSeat]) => ({ voterSeat: Number(voterSeat), targetSeat: Number(targetSeat) })).sort((left, right) => left.voterSeat - right.voterSeat),
            resolved: Boolean(this.night.wolfResolved),
            resultTarget: this.night.wolfResolved ? this.night.wolf ?? null : null,
            noKill: Boolean(this.night.wolfResolved && this.night.wolf == null),
            tiedTargets: (this.night.wolfTieTargets || []).slice(),
        } : null;
        state.myVote = seat ? this.votes[seat.number] ?? null : null;
        state.voteProgress = { completed: Object.keys(this.votes).length, total: this._dayVoteEligibleSeats().length };
        state.canConfirmDeadRole = Boolean(this._nightPhases().includes(this.phase) && PHASE_ROLE[this.phase] !== 'werewolf' && seat && !seat.alive && seat.role === PHASE_ROLE[this.phase] && this._controlsSeat(playerId, seat) && !this.night.deadRoleAcknowledged?.[this.phase]);
        const awaitsDeathResolution = Boolean(this.phase === 'deathResolution' && seat && this.deathResolution?.seats.includes(seat.number) && !this.deathResolution.settledSeats[seat.number] && this._controlsSeat(playerId, seat));
        state.eliminationNotice = awaitsDeathResolution ? { day: this.day, seat: seat.number, source: this.deathResolution.after === 'day' ? 'night' : 'day' } : null;
        state.canConfirmDeathResolution = Boolean(awaitsDeathResolution && this.pendingHunter?.seat !== seat.number && this.pendingBadge?.seat !== seat.number);
        state.myDeathResolutionSettled = Boolean(this.phase === 'deathResolution' && seat && this.deathResolution?.seats.includes(seat.number) && this.deathResolution.settledSeats[seat.number]);
        state.hunterAction = awaitsDeathResolution && this.pendingHunter?.seat === seat.number ? { available: true, legalTargetSeats: this.seats.filter(item => item.alive).map(item => item.number) } : null;
        state.sheriffBadgeAction = this.phase === 'deathResolution' && seat && this.pendingBadge?.seat === seat.number && this._controlsSeat(playerId, seat) && this.pendingHunter?.seat !== seat.number ? { available: true, legalTargetSeats: this.seats.filter(item => item.alive && item.number !== seat.number).map(item => item.number) } : null;
        if (state.hunterAction?.available) state.legalTargetSeats = state.hunterAction.legalTargetSeats.slice();
        if (this.phase === 'nightWolf' && seat?.alive && seat.role === 'werewolf') state.phaseProgress = { completed: Object.keys(this.night.wolfVotes || {}).length, total: this.seats.filter(item => item.alive && item.role === 'werewolf').length, label: '狼队临时票型' };
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
