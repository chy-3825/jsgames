// Magical Athlete (2025 CMYK edition) — official-rules implementation.
// Reference: Magical Athlete Rulebook (EN/FR), Takashi Ishida / Richard Garfield.
// The 36 racers below match the official card pool; abilities are resolved by
// the race state machine with the official trigger priority:
//   racetrack spaces -> current player's racers -> other players' racers (clockwise).
//
// Data constants printed on physical components (chip values, track-special
// positions) can't be read from the rulebook text layer; they are kept as
// single constants so they are trivial to adjust if ever needed.

const RACES = 4;
// The CMYK board has a 30-space lane (the Start space is position 0 and the
// finish line is reached at 30+).  The earlier 20-space approximation made
// every race and every wild-track location materially too short.
const TRACK_LENGTH = 30;
// Chip values: race 1..4, 1st / 2nd place (later races worth more points).
const GOLD_POINTS = [2, 4, 6, 8];
const SILVER_POINTS = [1, 2, 3, 4];
// Blimp (kept as the legacy `airship` id): strictly before the second corner
// +3; on/after that corner -1.  The +3 is the value printed on the official
// CMYK card (the old implementation accidentally used +2).
// The 30-space board is laid out as 0–9 (top), 10–14 (right turn),
// 15–24 (bottom), 25–29 (left turn), finish at 30.  The second corner is
// therefore the 15-space transition into the bottom straight.
const SECOND_CORNER = 15;
// Track special spaces. Mild Mile (Pépère) has none in the official layout used
// here; Wild Wilds (Galère) has stars, arrows and a trip (rock) space.
const TRACK_SPECIALS = {
    mild: {},
    // CMYK Wild Wilds board (30 spaces): three trip spaces, two stars and
    // five forced arrows.  Values/directions mirror the printed track.
    wild: {
        1: 'star',
        5: 'trip',
        7: 'arrow+3',
        11: 'arrow+1',
        13: 'star',
        15: 'arrow-4',
        16: 'trip',
        22: 'arrow+2',
        23: 'arrow-2',
        25: 'trip',
    },
};

const ATHLETES = [
    ['alchemist', '炼金术师', 'ALCHEMIST', 'TRANSMUTE \'N\' SCOOT', '当我主移动掷出 1 或 2 时，可以改为前进 4 格。'],
    ['airship', '飞艇', 'AIRSHIP', 'BLOW IT', '回合开始时若在第二个弯道之前，主移动 +3；在弯道上或之后，主移动 -1。'],
    ['baba', '巴巴雅嘎', 'BABA YAGA', 'LEG IT', '任何停在我所在格的运动员会摔倒；当我停在对方所在格时，我也会摔倒。'],
    ['banana', '香蕉', 'BANANA', 'THE SLIP', '任何超过我的运动员都会摔倒。'],
    ['centaur', '半人马', 'CENTAUR', 'HOOFWHACK', '当我超过一名运动员时，对方后退 2 格（不能超过起点）。'],
    ['cheerleader', '拉拉队长', 'CHEERLEADER', 'RAH RAH', '回合开始时，可选择让末位运动员前进 2 格；若使用，我前进 1 格。'],
    ['coach', '教练', 'COACH', 'GOOD HUSTLE', '我所在格的所有运动员（包括我）主移动 +1。'],
    ['copycat', '模仿者', 'COPYCAT', 'COPY THAT', '我拥有当前领跑运动员的能力；并列时由我选择。'],
    ['dicemonger', '掷骰商贩', 'DICEMONGER', 'DICEY DEALS', '每名运动员每回合可重掷一次主移动；当其他运动员重掷时，我前进 1 格。'],
    ['duelist', '决斗家', 'DUELIST', 'DUEL!', '每当有运动员与我同格，我可提出决斗：双方掷骰，点数高者前进 2 格，平局我赢。'],
    ['egg', '蛋', 'EGG', 'SCRAMBLE', '赛前从牌库抽 3 张新运动员并选 1 张，我拥有其能力。'],
    ['flopflop', '通通', 'FLIP FLOP', 'FLOP FLIP', '我可以不掷骰，改为与任意一名运动员交换位置（传送）。'],
    ['genius', '天才', 'GENIUS', 'THINK GOOD', '我可以预测主移动掷出的点数；猜中则本回合结束后再行动一次。'],
    ['gunk', '史莱姆', 'GUNK', 'GOOP \'EM', '所有其他运动员主移动 -1。'],
    ['hare', '快兔', 'HARE', 'HUBRIS', '主移动 +2；当我独自领跑时，跳过主移动并获得 1 枚铜星。'],
    ['hugebaby', '大宝宝', 'HUGE BABY', 'REALLY HUGE', '除起点外，任何人不能与我同格；若会发生，把对方放在我身后一格。'],
    ['hyena', '鬣狗', 'HYENA', 'SCHADENFREUDE', '当任一运动员回合结束时距其出发点不超过 1 格，我前进 2 格。'],
    ['hypnotist', '催眠师', 'HYPNOTIST', 'HSSSSST', '主移动前，可选择把一名运动员传送到我所在格。'],
    ['inchworm', '尺蠖', 'INCHWORM', 'WRIGGLE', '当其他运动员主移动掷出 1 时，对方跳过该移动，我前进 1 格。'],
    ['lackey', '管家', 'LACKEY', 'VERY GOOD SIRE', '当其他运动员主移动掷出 6 时，我在对方移动前前进 2 格。'],
    ['leaptoad', '蛙跳', 'LEAPTOAD', 'JUMPFROG', '移动时跳过有其他运动员占据的格子。'],
    ['legs', '盖伊·博尔斯', 'LEGS', 'JOG', '我可以不掷骰，主移动改为前进 5 格。'],
    ['lovableloser', '瞌睡虫', 'LOVABLE LOSER', 'D\'AWW', '主移动前，若我独居末位，获得 1 枚铜星。'],
    ['mouth', '大嘴', 'M.O.U.T.H.', 'CHOMP', '当我停在恰有一名其他运动员的格子时，对方被淘汰出本场。'],
    ['magician', '魔法师', 'MAGICIAN', 'FLOP POOF FLIP', '我的主移动最多可重掷两次。'],
    ['mastermind', '预言家', 'MASTERMIND', 'KNOW-IT-ALL', '我第一个回合开始时预测本场冠军；猜中则本场立即结束，我获得第二名。'],
    ['partyanimal', '派对熊', 'PARTY ANIMAL', 'ANIMAL MAGNETISM', '主移动前，所有运动员向我靠近 1 格；我所在格的每名其他运动员给我主移动 +1。'],
    ['rocketscientist', '火箭医生', 'ROCKET SCIENTIST', 'KABLOOEY', '我掷出主移动后可选择翻倍；若翻倍，移动结束后摔倒。'],
    ['romantic', '浪漫家', 'ROMANTIC', 'AH, LOVE!', '当任何人停在恰有一名其他运动员的格子时，我前进 2 格。'],
    ['scoocher', '跳蚤', 'SCOOCHER', 'SCOOCH SCOOCH', '每当其他运动员的能力触发，我前进 1 格。'],
    ['sisyphus', '西西弗斯', 'SISYPHUS', 'KEEP ROLLIN\'', '赛前获得 4 枚铜星；当我主移动掷出 6 时，改为传送到起点并失去 1 枚铜星。'],
    ['skipper', '队长直通', 'SKIPPER', 'SALTY DOG', '当任何运动员主移动掷出 1 时，下一个轮到我行动。'],
    ['stickler', '挑剔鬼', 'STICKLER', 'ACTUALLY...', '其他运动员只能以恰好所需步数越过终点；多走则不动。'],
    ['suckerfish', '吸盘鱼', 'SUCKERFISH', 'SUCKER!', '当我所在格的运动员移动时，我可以跟随到对方的新位置。'],
    ['thirdwheel', '第五轮', 'THIRD WHEEL', 'ROLL THROUGH', '主移动前，我可以传送到恰有两名运动员的格子。'],
    ['twin', '双胞胎', 'TWIN', 'DOUBLE DIP', '赛前可选择一名上一场获胜的运动员，本场使用其能力。'],
].map(([id, name, en, tagline, description]) => ({ id, name, en, tagline, emoji: '🏃', description }));

const COLORS = ['#dc6256', '#4c83ad', '#c18c3a', '#6d966a', '#80699b', '#9d6b76'];
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

class MagicalAthleteEngine {
    constructor(roomId, players, randomOrOptions = Math.random, extraOptions = {}) {
        const suppliedOptions = typeof randomOrOptions === 'function' ? extraOptions : (randomOrOptions || {});
        const random = typeof randomOrOptions === 'function' ? randomOrOptions : (suppliedOptions.random || Math.random);
        this.roomId = roomId;
        this.random = random;
        this.options = { ...suppliedOptions };
        // Keep the full roster so an invalid room is rejected explicitly by
        // start(), instead of silently dropping players above the official cap.
        this.players = players.map((player, index) => ({ id: player.id, name: player.name, color: COLORS[index] || '#777777', team: [], usedAthletes: [], score: 0, bronze: 0, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.status = 'waiting';
        this.phase = 'waiting';
        this.match = 0;
        this.maxMatches = RACES;
        this.currentTurnIndex = 0;
        this.startPlayerIndex = 0;
        this.raceStartRolled = false;
        this.draftRound = 0;
        this.draftQueue = [];
        this.draftQueueIndex = 0;
        this.draftPool = [];
        this.draftDeck = [];
        this.raceSelections = {};
        this.raceSelectionQueue = [];
        this.raceSelectionIndex = 0;
        this.racers = [];
        this.trackSide = 'mild';
        this.pending = null;
        this.skipperPending = false;
        this.eliminationCounter = 0;
        this.history = [];
        this.actionLog = [];
        this.winner = null;
        this.winners = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this.presentationPrivate = {};
        this.pendingAcknowledgements = [];
        this.deferredAfterAcknowledgement = null;
        this.finalStandings = [];
    }

    get teamSize() { return this.players.length <= 3 ? 8 : 4; }
    get racersPerPlayer() { return this.players.length <= 3 ? 2 : 1; }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < 2 || this.players.length > 6) return { success: false, message: '胡闹运动会需要 2–6 名玩家' };
        this.players.forEach(player => { player.team = []; player.usedAthletes = []; player.score = 0; player.bronze = 0; player.isOnline = true; });
        this.status = 'playing';
        this.phase = 'draft';
        this.match = 0;
        this.currentTurnIndex = 0;
        this.startPlayerIndex = this._rollOffPlayerIndex();
        this.raceStartRolled = false;
        this.draftRound = 0;
        this.draftDeck = shuffle(ATHLETES, this.random);
        this.history = [];
        this.winner = null;
        this.winners = [];
        this.pending = null;
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this.presentationPrivate = {};
        this.pendingAcknowledgements = [];
        this.deferredAfterAcknowledgement = null;
        this.finalStandings = [];
        this._appendPresentationEvent({
            kind: 'tournamentStarted', playerCount: this.players.length, teamSize: this.teamSize,
            races: RACES, racersPerPlayer: this.racersPerPlayer,
        });
        this._openDraftRound();
        this.actionLog.push('官方蛇形轮抽：组建自己的运动员队伍');
        this._finishPresentation();
        return this._success('胡闹运动会开始');
    }

    // ==================== DRAFT ====================

    _openDraftRound() {
        const poolSize = this.players.length === 2 ? 8 : this.players.length * 2;
        this.draftPool = this.draftDeck.splice(0, poolSize);
        // Every subsequent snake round starts one seat to the left of the
        // previous round's start player (the first round starts at the roll-off
        // winner), not at absolute player index zero.
        const order = Array.from({ length: this.players.length }, (_, offset) => (this.startPlayerIndex + this.draftRound + offset) % this.players.length);
        const reverse = order.slice().reverse();
        const snake = [...order, ...reverse];
        this.draftQueue = (this.players.length === 2 ? [...snake, ...snake] : snake).map(index => this.players[index].id);
        this.draftQueueIndex = 0;
        this.currentTurnIndex = this.players.findIndex(player => player.id === this.draftQueue[0]);
        this._appendPresentationEvent({
            kind: 'draftRoundStarted', round: this.draftRound + 1, totalRounds: this._draftRounds(),
            pool: clone(this.draftPool), startPlayerId: this.draftQueue[0] || null,
            startPlayerName: this.playerMap[this.draftQueue[0]]?.name || '',
        });
    }

    _draftRounds() { return this.players.length <= 3 ? (this.players.length === 2 ? 2 : 4) : 2; }

    _chooseDraftAthlete(player, athleteId) {
        if (this.draftQueue[this.draftQueueIndex] !== player.id) return { success: false, message: '还没轮到你选人', state: this.getPlayerState(player.id) };
        const index = this.draftPool.findIndex(athlete => athlete.id === athleteId);
        if (index < 0) return { success: false, message: '这张运动员牌不在当前牌列', state: this.getPlayerState(player.id) };
        const athlete = this.draftPool.splice(index, 1)[0];
        player.team.push(athlete);
        this._appendPresentationEvent({ kind: 'athleteDrafted', actorId: player.id, actorName: player.name, athlete: clone(athlete), teamCount: player.team.length, teamSize: this.teamSize });
        this.actionLog.push(`${player.name} 选入一名运动员`);
        this.draftQueueIndex += 1;
        if (this.draftQueueIndex < this.draftQueue.length) {
            this.currentTurnIndex = this.players.findIndex(item => item.id === this.draftQueue[this.draftQueueIndex]);
            return this._success('选角完成');
        }
        this.draftRound += 1;
        if (this.draftRound < this._draftRounds()) {
            this._openDraftRound();
            this.actionLog.push(`第 ${this.draftRound + 1} 轮蛇形选角开始`);
            return this._success('进入下一轮选角');
        }
        if (this.players.some(item => item.team.length !== this.teamSize)) return { success: false, message: '组队牌数不正确', state: this.getPlayerState(player.id) };
        this.match = 1;
        this._beginRaceSelection();
        return this._success('组队完成，开始第一场选手确认');
    }

    // ==================== RACE SETUP ====================

    _beginRaceSelection() {
        this.phase = 'race_select';
        if (this.match === 1 && !this.raceStartRolled) {
            // The first race has its own roll-off, independent of the draft
            // roll-off.  Later races use the official last-place rule.
            this.startPlayerIndex = this._rollOffPlayerIndex();
            this.raceStartRolled = true;
        }
        this.trackSide = this.match % 2 === 0 ? 'wild' : 'mild';
        this.raceSelections = Object.fromEntries(this.players.map(player => [player.id, []]));
        this.raceSelectionQueue = this.players.map((_, index) => this.players[(this.startPlayerIndex + index) % this.players.length].id);
        this.raceSelectionIndex = 0;
        this.currentTurnIndex = this.players.findIndex(player => player.id === this.raceSelectionQueue[0]);
        this.racers = [];
        this.pending = null;
        this.actionLog.push(`第 ${this.match} 场${this.trackSide === 'wild' ? '狂野' : '温和'}赛道：同时选出上场运动员`);
        this._appendPresentationEvent({
            kind: 'raceSelectionStarted', match: this.match, trackSide: this.trackSide,
            required: this.racersPerPlayer, startPlayerId: this.raceSelectionQueue[0] || null,
            startPlayerName: this.playerMap[this.raceSelectionQueue[0]]?.name || '',
        });
    }

    _selectRaceAthlete(player, athleteId) {
        if (this.raceSelectionQueue[this.raceSelectionIndex] !== player.id) return { success: false, message: '等待其他玩家选择上场运动员', state: this.getPlayerState(player.id) };
        const athlete = player.team.find(item => item.id === athleteId);
        const picks = this.raceSelections[player.id] || [];
        if (!athlete || player.usedAthletes.includes(athleteId) || picks.includes(athleteId)) return { success: false, message: '只能选择自己尚未使用的运动员', state: this.getPlayerState(player.id) };
        picks.push(athleteId);
        this.raceSelections[player.id] = picks;
        this._appendPresentationEvent({
            kind: 'lineupLocked', actorId: player.id, actorName: player.name,
            selectedCount: picks.length, required: this.racersPerPlayer,
            ready: picks.length >= this.racersPerPlayer,
        }, { [player.id]: { athleteId, athleteName: athlete.name } });
        if (picks.length < this.racersPerPlayer) return this._success('还需要选择另一名上场运动员');
        this.raceSelectionIndex += 1;
        if (this.raceSelectionIndex < this.raceSelectionQueue.length) {
            this.currentTurnIndex = this.players.findIndex(item => item.id === this.raceSelectionQueue[this.raceSelectionIndex]);
            return this._success('选手确认完成');
        }
        this._startRace();
        return this._success('所有选手已就位，比赛开始');
    }

    _startRace() {
        this.phase = 'race';
        this.racers = [];
        this.players.forEach(player => (this.raceSelections[player.id] || []).forEach((athleteId, index) => {
            const athlete = player.team.find(item => item.id === athleteId);
            player.usedAthletes.push(athleteId);
            this.racers.push({
                id: `${player.id}:${athleteId}`,
                playerId: player.id,
                athleteId,
                position: 0,
                finishOrder: null,
                tripped: false,
                eliminated: false,
                eliminationOrder: null,
                turnSlot: index,
                bronze: 0,
                copiedPowers: [],
                beforeRacePending: false,
                eggPool: null,
                twinOptions: null,
                predictedWin: null,
                extraTurn: false,
                doubled: false,
                skippedMainMove: false,
                turnDoneThisRound: false,
                rerollUsedThisTurn: false,
                geniusGuess: null,
                roll: null,
                copycatChoice: null,
                _turnStartPos: 0,
            });
        }));
        this.currentTurnIndex = this.startPlayerIndex;
        this.pending = null;
        this.deferredPrompt = null;
        this.skipperPending = false;
        this.eliminationCounter = 0;
        this.raceStateVisits = new Map();
        this._appendPresentationEvent({
            kind: 'lineupRevealed', match: this.match, trackSide: this.trackSide,
            racers: this.racers.map(racer => this._publicRacer(racer)),
        });
        this._appendPresentationEvent({
            kind: 'raceStarted', match: this.match, trackSide: this.trackSide,
            gold: GOLD_POINTS[this.match - 1] || 0, silver: SILVER_POINTS[this.match - 1] || 0,
            startPlayerId: this.players[this.startPlayerIndex]?.id || null,
            startPlayerName: this.players[this.startPlayerIndex]?.name || '',
        });
        this._resolveBeforeRace();
        this.actionLog.push('所有运动员位于起点，开始掷骰');
    }

    _resolveBeforeRace() {
        for (const racer of this.racers) {
            if (racer.eliminated) continue;
            // Actual Sisyphus (or Egg/Twin copying Sisyphus) get 4 bronze chips.
            if (racer.athleteId === 'sisyphus' || racer.copiedPowers.includes('sisyphus')) {
                this._awardBronze(racer, 4);
                this._log(`${this._racerName(racer)} 赛前获得 4 枚铜星`);
            }
            if (racer.athleteId === 'egg' || racer.athleteId === 'twin') racer.beforeRacePending = true;
        }
        if (this.racers.some(racer => racer.beforeRacePending)) this._openBeforeRacePrompt();
    }

    _openBeforeRacePrompt() {
        const racer = this.racers.find(item => item.beforeRacePending && !item.eliminated);
        if (!racer) return;
        const player = this.playerMap[racer.playerId];
        if (racer.athleteId === 'egg') {
            if (this.draftDeck.length < 3) {
                racer.beforeRacePending = false;
                this._log(`${this._racerName(racer)} 牌库不足，无法使用蛋的能力`);
                return this._openBeforeRacePrompt();
            }
            racer.eggPool = this.draftDeck.splice(0, 3);
            this.pending = { kind: 'eggPick', racerId: racer.id, playerId: racer.playerId, pool: racer.eggPool.map(card => card.id) };
            this.actionLog.push(`${player.name} 的蛋抽到 3 张新运动员，请选择要复制的能力`);
        } else if (racer.athleteId === 'twin') {
            if (!this.history.length) { racer.beforeRacePending = false; return this._openBeforeRacePrompt(); }
            const winners = this.history.map(entry => entry.ranking.find(rank => rank.place === 1)).filter(Boolean);
            const options = [...new Set(winners.map(winner => winner.athleteId))];
            racer.twinOptions = options;
            this.pending = { kind: 'twinPick', racerId: racer.id, playerId: racer.playerId, options };
            this.actionLog.push(`${player.name} 的双胞胎可选择复制一名上场冠军的能力`);
        }
    }

    _resolveBeforeRaceChoice(player, action) {
        if (!this.pending || this.pending.playerId !== player.id) return { success: false, message: '现在没有需要你决定的赛前能力', state: this.getPlayerState(player.id) };
        const racer = this.racers.find(item => item.id === this.pending.racerId);
        if (!racer) return { success: false, message: '赛前能力对象不存在', state: this.getPlayerState(player.id) };
        if (this.pending.kind === 'eggPick') {
            if (!racer.eggPool.some(card => card.id === action.athleteId)) return { success: false, message: '请选择抽到的三张运动员之一', state: this.getPlayerState(player.id) };
            racer.copiedPowers = [action.athleteId];
            this.actionLog.push(`${this._racerName(racer)} 复制了 ${this._athlete(action.athleteId)?.name} 的能力`);
        } else if (this.pending.kind === 'twinPick') {
            if (!racer.twinOptions.includes(action.athleteId)) return { success: false, message: '请选择一名上场冠军', state: this.getPlayerState(player.id) };
            racer.copiedPowers = [action.athleteId];
            this.actionLog.push(`${this._racerName(racer)} 复制了 ${this._athlete(action.athleteId)?.name} 的能力`);
        }
        racer.beforeRacePending = false;
        this.pending = null;
        // A copied Sisyphus (via Egg/Twin) also grants the before-race chips.
        if (racer.copiedPowers.includes('sisyphus')) { this._awardBronze(racer, 4); this._log(`${this._racerName(racer)} 赛前获得 4 枚铜星`); }
        this._openBeforeRacePrompt();
        return this._success('赛前能力已确定');
    }

    _athlete(id) { return ATHLETES.find(athlete => athlete.id === id); }

    // Effective power source: explicit copies (Egg/Twin) and Copycat's dynamic copy.
    _effectiveAthleteId(racer, depth = 0) {
        if (depth > 4) return racer.athleteId;
        if (racer.copiedPowers.length) return racer.copiedPowers[0];
        if (racer.athleteId === 'copycat') {
            const lead = this._leadRacers().filter(item => item.id !== racer.id);
            if (lead.length === 1) return this._effectiveAthleteId(lead[0], depth + 1);
            if (lead.length > 1 && racer.copycatChoice) return this._effectiveAthleteId(this.racers.find(item => item.id === racer.copycatChoice) || racer, depth + 1);
        }
        return racer.athleteId;
    }

    // ==================== RACE TURN ====================

    handleAction(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (this.pendingAcknowledgements.length) {
            if (action.kind === 'acknowledgeElimination') return this._acknowledgeElimination(player, action);
            return { success: false, message: '请等待受影响玩家确认运动员淘汰', state: this.getPlayerState(player.id) };
        }
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };

        const previousPresentation = this.presentation;
        const previousPrivate = this.presentationPrivate;
        this._startPresentation(player.id, action.kind || 'unknown');
        let result;
        if (this.phase === 'draft' && action.kind === 'chooseAthlete') result = this._chooseDraftAthlete(player, action.athleteId);
        else if (this.phase === 'race_select' && action.kind === 'selectRaceAthlete') result = this._selectRaceAthlete(player, action.athleteId);
        else if (this.pending) {
            if (this.pending.kind === 'eggPick' || this.pending.kind === 'twinPick') result = this._resolveBeforeRaceChoice(player, action);
            else if (this.pending.playerId !== player.id) result = { success: false, message: '等待当前玩家决定', state: this.getPlayerState(player.id) };
            else result = this._resolvePrompt(player, action);
        } else if (this.phase === 'race' && action.kind === 'roll') result = this._roll(player, action.athleteId);
        else result = { success: false, message: '当前阶段不能操作', state: this.getPlayerState(playerId) };

        if (!result.success) {
            this.presentation = previousPresentation;
            this.presentationPrivate = previousPrivate;
            result.state = this.getPlayerState(playerId);
            return result;
        }
        this._finishPresentation();
        result.state = this.getPublicState();
        return result;
    }

    _acknowledgeElimination(player, action) {
        const acknowledgement = this.pendingAcknowledgements[0];
        if (!acknowledgement || acknowledgement.playerId !== player.id) return { success: false, message: '当前不需要你确认淘汰', state: this.getPlayerState(player.id) };
        if (action.acknowledgementId && action.acknowledgementId !== acknowledgement.id) return { success: false, message: '淘汰确认已经更新，请重新确认', state: this.getPlayerState(player.id) };
        this.pendingAcknowledgements.shift();
        this._startPresentation(player.id, 'acknowledgeElimination');
        const victim = this.racers.find(racer => racer.id === acknowledgement.racerId);
        const source = this.racers.find(racer => racer.id === acknowledgement.sourceRacerId);
        this._appendPresentationEvent({
            kind: 'racerEliminated', victim: victim ? this._publicRacer(victim) : clone(acknowledgement),
            source: source ? this._publicRacer(source) : null, position: acknowledgement.position,
            acknowledgedBy: player.id,
        });
        this._log(`${player.name} 已确认 ${acknowledgement.athleteName} 从本场淘汰`);
        if (!this.pendingAcknowledgements.length && this.deferredAfterAcknowledgement) {
            const continuation = this.deferredAfterAcknowledgement;
            this.deferredAfterAcknowledgement = null;
            const racer = this.racers.find(item => item.id === continuation.racerId);
            if (racer) this._resumeAfterAcknowledgement(racer, continuation.mode);
        }
        this._finishPresentation();
        return this._success('已确认淘汰，比赛继续');
    }

    _resumeAfterAcknowledgement(racer, mode) {
        if (mode === 'afterRoll') this._afterRollPrompt(racer);
        else if (mode === 'apply') this._applyMainMove(racer);
        else if (mode === 'finalize') this._finalizeRoll(racer);
        else if (mode === 'afterTurn') this._afterRacerTurn(racer);
        else if (mode === 'afterMainMove') {
            if (racer.doubled && racer.finishOrder == null && !racer.eliminated) {
                racer.tripped = true;
                racer.doubled = false;
                this._tripEvent(racer, 'rocketscientist');
            }
            this._afterRacerTurn(racer);
        } else this._continueTurn(racer);
    }

    _pickRacer(player, athleteId) {
        const own = this.racers.filter(racer => racer.playerId === player.id && racer.finishOrder == null && !racer.eliminated);
        if (!own.length) return null;
        return own.find(racer => racer.athleteId === athleteId) || own[0];
    }

    _roll(player, athleteId) {
        if (this.players[this.currentTurnIndex]?.id !== player.id) return { success: false, message: '还没轮到你', state: this.getPlayerState(player.id) };
        if (this.pending) return { success: false, message: '请先完成当前决定', state: this.getPlayerState(player.id) };
        const racer = this._pickRacer(player, athleteId);
        if (!racer) return { success: false, message: '你的运动员都已完成或淘汰', state: this.getPlayerState(player.id) };
        this._runRacerTurn(racer);
        return this._success('回合推进');
    }

    _runRacerTurn(racer) {
        // A Copycat chooses again on each new turn when the lead is tied;
        // never carry a previous tie choice into a later turn.
        if (racer.athleteId === 'copycat') racer.copycatChoice = null;
        racer._turnStartPos = racer.position;
        racer.turnDoneThisRound = true;
        racer.rerollUsedThisTurn = false;
        racer.geniusGuess = null;
        racer.magicianRerollsLeft = 0;
        racer.magicianExhausted = false;
        this._appendPresentationEvent({ kind: 'turnStarted', racer: this._publicRacer(racer), playerId: racer.playerId, playerName: this.playerMap[racer.playerId]?.name || '' });
        if (racer.tripped) {
            racer.tripped = false;
            racer.skippedMainMove = true;
            this._appendPresentationEvent({ kind: 'racerRecovered', racer: this._publicRacer(racer), position: racer.position });
            this._log(`${this._racerName(racer)} 恢复站立，本回合跳过主移动`);
            // Powers can still trigger while recovering from a trip.
            this._resolveStartOfTurn(racer);
            if (this.pending) return;
            this._afterRacerTurn(racer);
            return;
        }
        this._resolveStartOfTurn(racer);
        if (this.pending) return; // waiting for a prompt decision
        if (racer.skippedMainMove) { racer.skippedMainMove = false; this._afterRacerTurn(racer); return; }
        if (racer.finishOrder != null || racer.eliminated) { this._afterRacerTurn(racer); return; }
        this._startMainMove(racer);
    }

    // ---------- start-of-turn powers ----------

    _resolveStartOfTurn(racer) {
        const id = this._effectiveAthleteId(racer);
        if (id === 'lovableloser' && this._aloneInLast(racer)) {
            this._awardBronze(racer, 1);
            this._log(`${this._racerName(racer)} 独居末位，获得 1 枚铜星`);
            this._powerEvent(racer);
        }
        if (id === 'partyanimal') {
            const others = this._activeRacers().filter(item => item.id !== racer.id);
            this._abilityEvent(racer, 'partyanimal', others);
            for (const other of others) {
                if (other.position < racer.position) this._moveByPower(other, 1, { sourceRacerId: racer.id, abilityId: 'partyanimal' });
                else if (other.position > racer.position) this._moveByPower(other, -1, { sourceRacerId: racer.id, abilityId: 'partyanimal' });
                if (this.pendingAcknowledgements.length) return;
            }
            this._log(`${this._racerName(racer)} 发动派对熊能力：所有人向其靠近 1 格`);
            this._powerEvent(racer);
        }
        if (id === 'mastermind' && !racer.beforeRaceDone) {
            racer.beforeRaceDone = true;
            this.pending = { kind: 'predict', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        if (id === 'cheerleader') {
            this.pending = { kind: 'cheerleader', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        if (id === 'hypnotist') {
            this.pending = { kind: 'hypnotist', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        if (id === 'thirdwheel') {
            this.pending = { kind: 'thirdwheel', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        if (id === 'hare' && this._aloneInLead(racer)) {
            this._abilityEvent(racer, 'hare');
            this._awardBronze(racer, 1);
            racer.skippedMainMove = true;
            this._log(`${this._racerName(racer)} 独居领跑，跳过主移动并获得 1 枚铜星`);
            this._powerEvent(racer);
        }
        // Copycat tie choice.
        if (racer.athleteId === 'copycat') {
            const lead = this._leadRacers().filter(item => item.id !== racer.id);
            if (lead.length > 1 && !racer.copycatChoice) {
                this.pending = { kind: 'copycatPick', racerId: racer.id, playerId: racer.playerId, options: lead.map(item => item.id) };
                return;
            }
        }
    }

    _resolvePrompt(player, action) {
        const kind = this.pending.kind;
        const racer = this.racers.find(item => item.id === this.pending.racerId);
        const sourcePrompt = this.pending;
        // mode: 'continue' -> proceed to the main move; 'afterRoll' -> continue the
        // roll pipeline (rerolls / predictions); 'apply' -> apply the main move now.
        const finish = (log, mode = 'continue') => {
            if (log) this._log(log);
            if (this.pendingAcknowledgements.length) {
                this.pending = null;
                this.deferredAfterAcknowledgement = { racerId: racer.id, mode };
                return this._success('等待受影响玩家确认淘汰');
            }
            // A stop power triggered while resolving this prompt may open a
            // second prompt (for example a Duelist on a warp destination).
            // Preserve that prompt and let its interrupt racer resume the
            // original turn after the nested decision.
            const nestedPrompt = this.pending && this.pending !== sourcePrompt ? this.pending : null;
            if (nestedPrompt) {
                this.pending = nestedPrompt;
                return this._success('决定已记录，等待后续能力');
            }
            const afterRacer = this.pending && this.pending.interruptRacerId ? this.racers.find(item => item.id === this.pending.interruptRacerId) : racer;
            this.pending = null;
            if (afterRacer) {
                if (mode === 'afterRoll') this._afterRollPrompt(afterRacer);
                else if (mode === 'apply') this._applyMainMove(afterRacer);
                else if (mode === 'finalize') this._finalizeRoll(afterRacer);
                else if (mode === 'afterTurn') this._afterRacerTurn(afterRacer);
                else this._continueTurn(afterRacer);
            }
            return this._success('决定已记录');
        };

        if (kind === 'predict') {
            const targetId = action.targetRacerId;
            if (!targetId || !this.racers.some(item => item.id === targetId && item.finishOrder == null && !item.eliminated)) return { success: false, message: '请预测一名尚未完成比赛的运动员', state: this.getPlayerState(player.id) };
            racer.predictedWin = targetId;
            this._log(`${this._racerName(racer)} 预测 ${this._racerName(this.racers.find(item => item.id === targetId))} 赢得本场`);
            return finish(null);
        }
        if (kind === 'cheerleader') {
            if (!action.use) return finish(`${this._racerName(racer)} 不使用拉拉队长能力`);
            const last = this._lastPlaceRacers();
            this._abilityEvent(racer, 'cheerleader', last);
            for (const target of last) this._moveByPower(target, 2, { sourceRacerId: racer.id, abilityId: 'cheerleader' });
            this._moveByPower(racer, 1, { sourceRacerId: racer.id, abilityId: 'cheerleader' });
            this._powerEvent(racer);
            return finish(`${this._racerName(racer)} 让末位前进 2 格，自己前进 1 格`);
        }
        if (kind === 'hypnotist') {
            if (!action.use) return finish(`${this._racerName(racer)} 不使用催眠师能力`);
            const target = this.racers.find(item => item.id === action.targetRacerId && item.id !== racer.id && item.finishOrder == null && !item.eliminated);
            if (!target) return { success: false, message: '请选择一名其他运动员进行传送', state: this.getPlayerState(player.id) };
            this._abilityEvent(racer, 'hypnotist', [target]);
            this._warpTo(target, racer.position, { sourceRacerId: racer.id, abilityId: 'hypnotist' });
            this._log(`${this._racerName(racer)} 把 ${this._racerName(target)} 传送到自己所在格`);
            this._powerEvent(racer);
            return finish(null);
        }
        if (kind === 'thirdwheel') {
            if (!action.use) return finish(`${this._racerName(racer)} 不使用第五轮能力`);
            const targets = this.racers.filter(item => item.id !== racer.id && item.finishOrder == null && !item.eliminated && this._countOn(item.position) === 2);
            const target = targets.find(item => item.id === action.targetRacerId);
            if (!target) return finish(`${this._racerName(racer)} 找不到恰有两名运动员的格子，不使用第五轮能力`);
            this._abilityEvent(racer, 'thirdwheel', [target]);
            this._warpTo(racer, target.position, { sourceRacerId: racer.id, targetRacerId: target.id, abilityId: 'thirdwheel' });
            this._log(`${this._racerName(racer)} 传送到 ${target.position} 号格`);
            this._powerEvent(racer);
            return finish(null);
        }
        if (kind === 'copycatPick') {
            if (!this.pending.options.includes(action.targetRacerId)) return { success: false, message: '请选择一名领跑运动员', state: this.getPlayerState(player.id) };
            racer.copycatChoice = action.targetRacerId;
            return finish(`${this._racerName(racer)} 选择复制 ${this._racerName(this.racers.find(item => item.id === action.targetRacerId))} 的能力`);
        }
        if (kind === 'legs') {
            if (!action.use) { racer.roll = this._rollDie(); this._dieEvent(racer, racer.roll); return this._afterRollPrompt(racer); }
            racer.roll = 5;
            this._abilityEvent(racer, 'legs');
            this._log(`${this._racerName(racer)} 选择不掷骰，主移动 5 格`);
            return finish(null, 'apply');
        }
        if (kind === 'flopflop') {
            if (!action.use) { racer.roll = this._rollDie(); this._dieEvent(racer, racer.roll); return this._afterRollPrompt(racer); }
            const target = this.racers.find(item => item.id === action.targetRacerId && item.id !== racer.id && item.finishOrder == null && !item.eliminated);
            if (!target) return { success: false, message: '请选择一名其他运动员交换位置', state: this.getPlayerState(player.id) };
            this._abilityEvent(racer, 'flopflop', [target]);
            const racerFrom = racer.position; const targetFrom = target.position;
            racer.position = targetFrom; target.position = racerFrom;
            this._movementEvent(racer, racerFrom, racer.position, 'swap', { sourceRacerId: racer.id, targetRacerId: target.id, abilityId: 'flopflop' });
            this._movementEvent(target, targetFrom, target.position, 'swap', { sourceRacerId: racer.id, targetRacerId: target.id, abilityId: 'flopflop' });
            this._resolveStops(racer);
            this._resolveStops(target);
            if (this.deferredPrompt) { this.pending = this.deferredPrompt; this.deferredPrompt = null; }
            this._log(`${this._racerName(racer)} 与 ${this._racerName(target)} 交换位置（传送）`);
            racer.skippedMainMove = true;
            this._powerEvent(racer);
            return finish(null);
        }
        if (kind === 'magician' || kind === 'dicemongerReroll') {
            if (!action.reroll) {
                if (kind === 'magician') { racer.magicianRerollsLeft = 0; racer.magicianExhausted = true; }
                if (kind === 'dicemongerReroll') racer.rerollUsedThisTurn = true;
                return finish(`${this._racerName(racer)} 保留 ${racer.roll}`, 'afterRoll');
            }
            if (kind === 'dicemongerReroll') racer.rerollUsedThisTurn = true;
            if (kind === 'magician') {
                racer.magicianRerollsLeft = Math.max(0, (racer.magicianRerollsLeft || 1) - 1);
                if (racer.magicianRerollsLeft === 0) racer.magicianExhausted = true;
            }
            this._rerollMainMove(racer);
            if (kind === 'magician' && racer.magicianRerollsLeft > 0) {
                this.pending = { kind, racerId: racer.id, playerId: racer.playerId };
                return this._success(`魔法师重掷为 ${racer.roll}，可再次重掷`);
            }
            this.pending = null;
            this._afterRollPrompt(racer);
            return this._success(`${this._racerName(racer)} 重掷为 ${racer.roll}`);
        }
        if (kind === 'genius') {
            if (action.guess == null) return { success: false, message: '请输入预测点数', state: this.getPlayerState(player.id) };
            racer.geniusGuess = Number(action.guess);
            racer.roll = this._rollDie();
            this._abilityEvent(racer, 'genius');
            this._dieEvent(racer, racer.roll, { guess: racer.geniusGuess });
            if (racer.roll === racer.geniusGuess) { racer.extraTurn = true; this._log(`${this._racerName(racer)} 预测正确，本回合结束后再行动`); }
            return finish(`${this._racerName(racer)} 预测 ${racer.geniusGuess}，实际掷出 ${racer.roll}`, 'afterRoll');
        }
        if (kind === 'alchemist') {
            if (!action.use) return finish(null, 'apply');
            this._abilityEvent(racer, 'alchemist');
            racer.roll = 4;
            return finish(`${this._racerName(racer)} 使用炼金术师能力，主移动 4 格`, 'apply');
        }
        if (kind === 'rocket') {
            if (!action.use) return finish(null, 'apply');
            this._abilityEvent(racer, 'rocketscientist');
            racer.doubled = true;
            racer.roll *= 2;
            return finish(`${this._racerName(racer)} 火箭医生翻倍：主移动 ${racer.roll} 格`, 'apply');
        }
        if (kind === 'duel') {
            if (!action.use) return finish(`${this._racerName(racer)} 放弃决斗`);
            const target = this.racers.find(item => item.id === action.targetRacerId && item.id === this.pending.targetRacerId && item.id !== racer.id && item.finishOrder == null && !item.eliminated && item.position === racer.position);
            if (!target) return { success: false, message: '请选择仍与决斗家同格的运动员', state: this.getPlayerState(player.id) };
            const a = this._rollDie(); const b = this._rollDie();
            const winner = a >= b ? racer : target;
            this._abilityEvent(racer, 'duelist', [target], { sourceRoll: a, targetRoll: b, winnerRacerId: winner.id });
            this._log(`${this._racerName(racer)} 与 ${this._racerName(target)} 决斗：${a} vs ${b}，${this._racerName(winner)} 前进 2 格`);
            this._moveByPower(winner, 2, { sourceRacerId: racer.id, targetRacerId: target.id, abilityId: 'duelist' });
            this._powerEvent(racer);
            return finish(null, 'afterTurn');
        }
        if (kind === 'suckerfish') {
            if (!action.use) return finish(null, 'afterTurn');
            const target = this.racers.find(item => item.id === action.targetRacerId && item.id === this.pending.targetRacerId);
            if (!target) return { success: false, message: '请选择跟随对象', state: this.getPlayerState(player.id) };
            const delta = target.position - racer.position;
            this._abilityEvent(racer, 'suckerfish', [target]);
            if (delta) this._moveByPower(racer, delta, { sourceRacerId: target.id, targetRacerId: racer.id, abilityId: 'suckerfish' });
            this._log(`${this._racerName(racer)} 跟随 ${this._racerName(target)} 移动`);
            return finish(null, 'afterTurn');
        }
        return finish(null);
    }

    _afterRollPrompt(racer) {
        if (this.pendingAcknowledgements.length) {
            this.deferredAfterAcknowledgement = { racerId: racer.id, mode: 'afterRoll' };
            return this._success('等待受影响玩家确认淘汰');
        }
        this.pending = null;
        const id = this._effectiveAthleteId(racer);
        if (id === 'magician' && !racer.magicianExhausted) {
            racer.magicianRerollsLeft = 2;
            this.pending = { kind: 'magician', racerId: racer.id, playerId: racer.playerId };
            this._log(`${this._racerName(racer)} 掷出 ${racer.roll}，魔法师可重掷`);
            return this._success('可重掷');
        }
        const dicemonger = this._activeRacers().find(item => this._effectiveAthleteId(item) === 'dicemonger' && !racer.rerollUsedThisTurn);
        if (dicemonger) {
            this.pending = { kind: 'dicemongerReroll', racerId: racer.id, playerId: racer.playerId };
            this._log(`${this._racerName(racer)} 掷出 ${racer.roll}，商贩允许重掷一次`);
            return this._success('可重掷');
        }
        this._finalizeRoll(racer);
        return this._success('继续');
    }

    _rerollMainMove(racer) {
        // Every reroll replaces the previous result; the previous number is as
        // though it had never been rolled.  Dicemongers move before another
        // racer rerolls, and Scoocher reacts once to each ability event.
        const mongers = this._activeRacers().filter(item => this._effectiveAthleteId(item) === 'dicemonger' && item.id !== racer.id);
        for (const monger of mongers) {
            this._abilityEvent(monger, 'dicemonger', [racer]);
            this._moveByPower(monger, 1, { sourceRacerId: racer.id, targetRacerId: monger.id, abilityId: 'dicemonger' });
            this._powerEvent(monger);
        }
        this._powerEvent(racer);
        racer.roll = this._rollDie();
        this._dieEvent(racer, racer.roll, { reroll: true });
        return racer.roll;
    }

    _continueTurn(racer) {
        if (this.pendingAcknowledgements.length) {
            this.deferredAfterAcknowledgement = { racerId: racer.id, mode: 'continue' };
            return;
        }
        if (this.pending) return;
        if (racer.skippedMainMove) { racer.skippedMainMove = false; this._afterRacerTurn(racer); return; }
        if (racer.finishOrder != null || racer.eliminated) { this._afterRacerTurn(racer); return; }
        this._startMainMove(racer);
    }

    // ---------- main move ----------

    _startMainMove(racer) {
        const id = this._effectiveAthleteId(racer);
        if (id === 'legs') { this.pending = { kind: 'legs', racerId: racer.id, playerId: racer.playerId }; return; }
        if (id === 'flopflop') { this.pending = { kind: 'flopflop', racerId: racer.id, playerId: racer.playerId }; return; }
        // Genius makes the prediction before the die is rolled.  The previous
        // implementation rolled once and then asked for a guess, which made a
        // correct prediction impossible to model faithfully.
        if (id === 'genius') {
            this.pending = { kind: 'genius', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        racer.roll = this._rollDie();
        this._dieEvent(racer, racer.roll);
        this._afterRollPrompt(racer);
    }

    _finalizeRoll(racer) {
        const id = this._effectiveAthleteId(racer);
        const die = racer.roll;
        if (id === 'alchemist' && (die === 1 || die === 2)) {
            this.pending = { kind: 'alchemist', racerId: racer.id, playerId: racer.playerId };
            this._log(`${this._racerName(racer)} 掷出 ${die}，炼金术师可改为前进 4 格`);
            return;
        }
        if (id === 'rocketscientist') {
            this.pending = { kind: 'rocket', racerId: racer.id, playerId: racer.playerId };
            return;
        }
        this._applyMainMove(racer);
    }

    _applyMainMove(racer) {
        const id = this._effectiveAthleteId(racer);
        let steps = racer.roll || 0;
        if (id === 'hare') steps += 2;
        if (id === 'airship') steps += racer._turnStartPos < SECOND_CORNER ? 3 : -1;
        // Every Coach on the starting space benefits every racer there,
        // including the Coach itself.  Likewise every Gunk applies its own
        // -1; the die result remains unchanged (so Lackey/Inchworm still see
        // the original 6/1).
        const coaches = this._activeRacers().filter(item => this._effectiveAthleteId(item) === 'coach' && item.position === racer.position);
        steps += coaches.length;
        const gunks = this._activeRacers().filter(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'gunk');
        steps -= gunks.length;
        if (id === 'partyanimal') {
            steps += this._activeRacers().filter(item => item.id !== racer.id && item.position === racer.position).length;
        }
        // Gunk's modifier is itself a power event for every affected -1.
        for (const gunk of gunks) this._powerEvent(gunk);
        steps = Math.max(0, steps);
        this._log(`${this._racerName(racer)} 主移动掷出 ${racer.roll}，前进 ${steps} 格`);
        if (racer.roll === 1) {
            const inchworm = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'inchworm');
            if (inchworm) {
                this._abilityEvent(inchworm, 'inchworm', [racer]);
                this._log(`${this._racerName(inchworm)} 让 ${this._racerName(racer)} 跳过该移动，自己前进 1 格`);
                this._moveByPower(inchworm, 1, { sourceRacerId: inchworm.id, targetRacerId: racer.id, abilityId: 'inchworm' });
                this._powerEvent(inchworm);
                this._afterRacerTurn(racer);
                return;
            }
            this.skipperPending = true;
        }
        if (racer.roll === 6) {
            const lackey = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'lackey');
            if (lackey) {
                this._abilityEvent(lackey, 'lackey', [racer]);
                this._log(`${this._racerName(lackey)} 在 ${this._racerName(racer)} 移动前前进 2 格`);
                this._moveByPower(lackey, 2, { sourceRacerId: lackey.id, targetRacerId: racer.id, abilityId: 'lackey' });
                this._powerEvent(lackey);
            }
        }
        // Sisyphus: rolling a 6 warps to Start and loses 1 point chip.
        if (id === 'sisyphus' && racer.roll === 6) {
            this._abilityEvent(racer, 'sisyphus');
            this._log(`${this._racerName(racer)} 掷出 6，传送回起点并失去 1 枚铜星`);
            const from = racer.position;
            racer.position = 0;
            this._movementEvent(racer, from, 0, 'warp', { sourceRacerId: racer.id, abilityId: 'sisyphus' });
            this._removeBronze(racer, 1);
            this._afterRacerTurn(racer);
            return;
        }
        this._moveRacer(racer, steps);
        if (this.pendingAcknowledgements.length) {
            this.deferredAfterAcknowledgement = { racerId: racer.id, mode: 'afterMainMove' };
            return;
        }
        if (this.pending) return;
        if (racer.finishOrder != null || racer.eliminated) { this._afterRacerTurn(racer); return; }
        if (racer.doubled) { racer.tripped = true; racer.doubled = false; this._tripEvent(racer, 'rocketscientist'); this._log(`${this._racerName(racer)} 火箭医生翻倍后摔倒`); }
        this._afterRacerTurn(racer);
    }

    // Core movement: Leaptoad skipping, Stickler finish restriction,
    // Huge Baby push-back, track spaces; triggers pass/stop powers.
    _moveRacer(racer, steps) {
        this.deferredPrompt = null;
        const id = this._effectiveAthleteId(racer);
        const from = racer.position;
        // The rules explicitly distinguish a zero result from a move: it
        // must not trigger passing, stopping, or track-space effects.
        if (steps === 0) return;
        // Suckerfish: when a racer on my space moves, I can follow to their new space
        // (resolved as a deferred prompt after the move completes).
        const suckerAtStart = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'suckerfish' && item.position === from);
        racer._suckerAtStart = suckerAtStart ? suckerAtStart.id : null;
        let target = Math.min(TRACK_LENGTH, from + steps);
        // Stickler: any forward movement (main move or power move) that would
        // overshoot the finish simply does not move at all.
        const stickler = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'stickler');
        let blockedByStickler = false;
        if (stickler && id !== 'stickler' && steps > 0 && from < TRACK_LENGTH && from + steps > TRACK_LENGTH) {
            target = from;
            blockedByStickler = true;
            this._log(`${this._racerName(racer)} 被挑剔鬼阻止，无法以非恰好步数越过终点`);
        }
        const otherRacers = this._activeRacers().filter(item => item.id !== racer.id);
        // Leaptoad: "I only advance onto unoccupied spaces" — occupied spaces are
        // skipped without counting toward the number of spaces moved.
        if (id === 'leaptoad') {
            let position = from;
            let remaining = steps;
            let skipped = 0;
            while (remaining > 0 && position < TRACK_LENGTH) {
                position += 1;
                if (position >= TRACK_LENGTH) break;
                if (!otherRacers.some(item => item.position === position)) remaining -= 1;
                else skipped += 1;
            }
            target = Math.min(TRACK_LENGTH, position);
            for (let index = 0; index < skipped; index += 1) this._powerEvent(racer);
        }
        // Huge Baby: cannot stop on its space (except Start).
        const baby = otherRacers.find(item => this._effectiveAthleteId(item) === 'hugebaby' && item.position === target && item.finishOrder == null && target !== 0);
        if (baby && racer.id !== baby.id) {
            target = Math.max(0, target - 1);
            this._log(`${this._racerName(racer)} 被大宝宝挡回 ${target} 号格`);
        }
        if (blockedByStickler) return;
        racer.position = target;
        this._movementEvent(racer, from, target, 'main', { sourceRacerId: racer.id, steps });
        if (target >= TRACK_LENGTH && racer.finishOrder == null) {
            racer.finishOrder = this._finishedCount() + 1;
            this._appendPresentationEvent({ kind: 'racerFinished', racer: this._publicRacer(racer), place: racer.finishOrder, position: target });
            this._log(`${this._racerName(racer)} 以第 ${racer.finishOrder} 名冲线`);
        }
        if (racer.finishOrder == null) this._resolvePassing(racer, from, target);
        if (this.pendingAcknowledgements.length) return;
        if (racer.finishOrder == null) this._resolveStops(racer);
        if (this.pendingAcknowledgements.length) return;
        // Deferred prompts (Duelist / Suckerfish) pause the turn after the move.
        if (this.deferredPrompt) {
            this.pending = this.deferredPrompt;
            this.deferredPrompt = null;
            return;
        }
        if (racer._suckerAtStart) {
            const sucker = this.racers.find(item => item.id === racer._suckerAtStart && item.finishOrder == null && !item.eliminated);
            racer._suckerAtStart = null;
            if (sucker && sucker.position !== racer.position) {
                this.pending = { kind: 'suckerfish', racerId: sucker.id, playerId: this.playerMap[sucker.playerId].id, targetRacerId: racer.id, interruptRacerId: racer.id };
                this.actionLog.push(`${this._racerName(sucker)} 可跟随 ${this._racerName(racer)} 移动`);
            }
        }
    }

    _resolvePassing(racer, from, to) {
        const others = this._activeRacers().filter(item => item.id !== racer.id && item.position > from && item.position < to);
        for (const other of others) {
            const otherId = this._effectiveAthleteId(other);
            if (otherId === 'banana') {
                racer.tripped = true;
                this._abilityEvent(other, 'banana', [racer]);
                this._tripEvent(racer, 'banana', other.id);
                this._log(`${this._racerName(racer)} 超过香蕉，摔倒`);
                this._powerEvent(other);
                if (this.pendingAcknowledgements.length) return;
            }
            const racerId = this._effectiveAthleteId(racer);
            if (racerId === 'centaur') {
                this._abilityEvent(racer, 'centaur', [other]);
                this._log(`${this._racerName(racer)} 超过 ${this._racerName(other)}，对方后退 2 格`);
                this._moveByPower(other, -2, { sourceRacerId: racer.id, targetRacerId: other.id, abilityId: 'centaur' });
                this._powerEvent(racer);
                if (this.pendingAcknowledgements.length) return;
            }
        }
    }

    _resolveStops(racer) {
        const id = this._effectiveAthleteId(racer);
        const others = this._activeRacers().filter(item => item.id !== racer.id);
        // Track spaces resolve first (official trigger priority).
        const special = TRACK_SPECIALS[this.trackSide]?.[racer.position];
        if (special === 'star') { this._awardBronze(racer, 1); this._log(`${this._racerName(racer)} 停在星格，获得 1 枚铜星`); }
        if (special?.startsWith('arrow')) {
            const delta = Number(special.slice('arrow'.length));
            if (Number.isFinite(delta) && delta !== 0) {
                this._log(`${this._racerName(racer)} 停在箭格，${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`);
                this._moveByPower(racer, delta);
                return;
            }
        }
        if (special === 'trip') { racer.tripped = true; this._tripEvent(racer, 'track'); this._log(`${this._racerName(racer)} 停在 OUPS! 格，摔倒`); }
        // The stopper's own stop-powers.
        if (id === 'mouth' && this._countOn(racer.position) === 2) {
            const victim = others.find(item => item.position === racer.position && item.finishOrder == null && !item.eliminated);
            if (victim) {
                victim.eliminated = true;
                victim.eliminationOrder = ++this.eliminationCounter;
                this._abilityEvent(racer, 'mouth', [victim]);
                const warning = this._appendPresentationEvent({
                    kind: 'eliminationThreatened', source: this._publicRacer(racer), victim: this._publicRacer(victim),
                    position: racer.position, targetPlayerId: victim.playerId,
                });
                this.pendingAcknowledgements.push({
                    id: `elimination-${warning.sequence}`, eventSequence: warning.sequence,
                    playerId: victim.playerId, playerName: this.playerMap[victim.playerId]?.name || '',
                    racerId: victim.id, athleteId: victim.athleteId, athleteName: this._athlete(victim.athleteId)?.name || victim.athleteId,
                    sourceRacerId: racer.id, sourceAthleteName: this._athlete(racer.athleteId)?.name || racer.athleteId,
                    position: racer.position,
                });
                this._log(`${this._racerName(racer)} 吃掉了 ${this._racerName(victim)}！`);
                return;
            }
        }
        if (id === 'baba' && others.some(item => item.position === racer.position && item.finishOrder == null)) {
            racer.tripped = true;
            this._abilityEvent(racer, 'baba', others.filter(item => item.position === racer.position));
            this._tripEvent(racer, 'baba', racer.id);
            this._log(`${this._racerName(racer)} 停在有人的格子上，摔倒`);
            this._powerEvent(racer);
        }
        // Other racers' stop-powers (clockwise).
        for (const other of others) {
            if (this._effectiveAthleteId(other) === 'baba' && other.position === racer.position) {
                racer.tripped = true;
                this._abilityEvent(other, 'baba', [racer]);
                this._tripEvent(racer, 'baba', other.id);
                this._log(`${this._racerName(racer)} 停在巴巴雅嘎所在格，摔倒`);
                this._powerEvent(other);
            }
            if (this._effectiveAthleteId(other) === 'duelist' && other.position === racer.position && !racer._duelPrompted && !this.deferredPrompt) {
                racer._duelPrompted = true;
                this.deferredPrompt = { kind: 'duel', racerId: other.id, playerId: this.playerMap[other.playerId].id, targetRacerId: racer.id, interruptRacerId: racer.id };
                this.actionLog.push(`${this._racerName(other)} 可向 ${this._racerName(racer)} 提出决斗`);
            }
        }
        if (this._countOn(racer.position) === 2) {
            const romantic = others.find(item => this._effectiveAthleteId(item) === 'romantic' && item.finishOrder == null);
            if (romantic) {
                this._abilityEvent(romantic, 'romantic', [racer]);
                this._log(`${this._racerName(romantic)} 因 ${this._racerName(racer)} 停在独一格前进 2 格`);
                this._moveByPower(romantic, 2, { sourceRacerId: romantic.id, targetRacerId: racer.id, abilityId: 'romantic' });
                this._powerEvent(romantic);
            }
        }
    }

    // Power-caused movement (not the main move): still triggers pass/stop powers.
    _moveByPower(racer, delta, context = {}) {
        if (racer.finishOrder != null || racer.eliminated) return;
        if (delta === 0) return;
        const from = racer.position;
        let target = Math.max(0, Math.min(TRACK_LENGTH, from + delta));
        const id = this._effectiveAthleteId(racer);
        const stickler = this._activeRacers().find(item => item.id !== racer.id && this._effectiveAthleteId(item) === 'stickler');
        if (stickler && id !== 'stickler' && delta > 0 && from + delta > TRACK_LENGTH) {
            this._log(`${this._racerName(racer)} 被挑剔鬼阻止，无法以非恰好步数越过终点`);
            return;
        }
        if (id === 'leaptoad' && delta !== 0) {
            const direction = delta > 0 ? 1 : -1;
            let position = from;
            let remaining = Math.abs(delta);
            let skipped = 0;
            const others = this._activeRacers().filter(item => item.id !== racer.id);
            while (remaining > 0 && position > 0 && position < TRACK_LENGTH) {
                position += direction;
                if (position <= 0 || position >= TRACK_LENGTH) break;
                if (others.some(item => item.position === position)) skipped += 1;
                else remaining -= 1;
            }
            target = Math.max(0, Math.min(TRACK_LENGTH, position));
            for (let index = 0; index < skipped; index += 1) this._powerEvent(racer);
        }
        racer.position = target;
        this._movementEvent(racer, from, target, context.movementType || 'ability', { ...context, steps: delta });
        if (target >= TRACK_LENGTH && racer.finishOrder == null) {
            racer.finishOrder = this._finishedCount() + 1;
            this._appendPresentationEvent({ kind: 'racerFinished', racer: this._publicRacer(racer), place: racer.finishOrder, position: target });
            this._log(`${this._racerName(racer)} 以第 ${racer.finishOrder} 名冲线`);
        }
        if (racer.finishOrder == null) this._resolvePassing(racer, from, target);
        if (this.pendingAcknowledgements.length) return;
        if (racer.finishOrder == null) this._resolveStops(racer);
        if (this.pendingAcknowledgements.length) return;
        if (this.deferredPrompt) { this.pending = this.deferredPrompt; this.deferredPrompt = null; }
    }

    _warpTo(racer, target, context = {}) {
        if (racer.finishOrder != null || racer.eliminated) return;
        const from = racer.position;
        racer.position = Math.max(0, Math.min(TRACK_LENGTH, target));
        this._movementEvent(racer, from, racer.position, 'warp', context);
        // Warping does not count as movement (no passing), but arriving on a
        // space still counts as stopping and can trigger stop powers.
        this._resolveStops(racer);
        if (this.pendingAcknowledgements.length) return;
        if (this.deferredPrompt) { this.pending = this.deferredPrompt; this.deferredPrompt = null; }
    }

    // ---------- power events (Scoocher / Dicemonger) ----------

    _powerEvent(source) {
        if (this.pendingAcknowledgements.length) return;
        // Scoocher: "When another racer's power happens, I move 1."
        // Dicemonger reroll movement is handled by the same event.
        for (const racer of this._activeRacers()) {
            if (racer.id === source.id) continue;
            const id = this._effectiveAthleteId(racer);
            if (id === 'scoocher') {
                this._abilityEvent(racer, 'scoocher', [source]);
                this._log(`${this._racerName(racer)} 因 ${this._racerName(source)} 的能力触发前进 1 格`);
                this._moveByPower(racer, 1, { sourceRacerId: source.id, targetRacerId: racer.id, abilityId: 'scoocher' });
                if (this.pendingAcknowledgements.length) return;
            }
        }
    }

    // ---------- after a racer's sub-turn ----------

    _afterRacerTurn(racer) {
        if (this.pendingAcknowledgements.length) {
            this.deferredAfterAcknowledgement = { racerId: racer.id, mode: 'afterTurn' };
            return;
        }
        if (this.pending) return;
        // Hyena: any racer ending turn within 1 space of where they started -> move 2.
        const hyena = this._activeRacers().find(item => this._effectiveAthleteId(item) === 'hyena' && item.id !== racer.id);
        if (hyena) {
            if (Math.abs(racer.position - racer._turnStartPos) <= 1) {
                this._log(`${this._racerName(hyena)} 因 ${this._racerName(racer)} 停在出发点附近前进 2 格`);
                this._moveByPower(hyena, 2);
                this._powerEvent(hyena);
            }
        }
        // A few official ability combinations can form a deterministic loop
        // (for example the Wild Wilds -4/+1 arrows).  The rulebook says to end
        // such a race without awarding the still-unclaimed place chips rather
        // than letting an online room hang forever.
        const loopKey = this._raceStateKey();
        const visits = (this.raceStateVisits.get(loopKey) || 0) + 1;
        this.raceStateVisits.set(loopKey, visits);
        if (visits >= 3) {
            this._log('检测到无法完成的能力循环，本场结束且未发放剩余名次奖励');
            this._finishRace({ loop: true });
            return;
        }
        this._checkRaceEnd();
        if (this.status !== 'playing' || this.phase !== 'race') return;
        // Genius extra turn: the same racer acts again.
        if (racer.extraTurn) {
            racer.extraTurn = false;
            racer.turnDoneThisRound = false;
            this.actionLog.push(`${this._racerName(racer)} 预测正确，再行动一次`);
            this._runRacerTurn(racer);
            return;
        }
        this._advanceTurn();
    }

    _advanceTurn() {
        const currentPlayer = this.players[this.currentTurnIndex];
        // Team variant: the same player keeps their turn until all racers moved.
        const hasMore = currentPlayer && this.racers.some(racer => racer.playerId === currentPlayer.id && racer.finishOrder == null && !racer.eliminated && !racer.turnDoneThisRound);
        if (hasMore) {
            this.actionLog.push(`轮到 ${currentPlayer.name} 选择下一名运动员`);
            return;
        }
        let nextIndex = (this.currentTurnIndex + 1) % this.players.length;
        if (this.skipperPending) {
            this.skipperPending = false;
            const skipperPlayer = this.racers.find(item => this._effectiveAthleteId(item) === 'skipper' && item.finishOrder == null && !item.eliminated)?.playerId;
            if (skipperPlayer) nextIndex = this.players.findIndex(player => player.id === skipperPlayer);
        }
        let attempts = 0;
        while (attempts <= this.players.length && !this._playerHasActiveRacer(this.players[nextIndex].id)) {
            nextIndex = (nextIndex + 1) % this.players.length;
            attempts += 1;
        }
        this.currentTurnIndex = nextIndex;
        this.racers.forEach(racer => { racer.turnDoneThisRound = false; racer.rerollUsedThisTurn = false; racer._turnStartPos = racer.position; racer._duelPrompted = false; racer._suckerAtStart = null; });
        const nextPlayer = this.players[this.currentTurnIndex];
        if (nextPlayer) this.actionLog.push(`轮到 ${nextPlayer.name}`);
    }

    _playerHasActiveRacer(playerId) {
        return this.racers.some(racer => racer.playerId === playerId && racer.finishOrder == null && !racer.eliminated);
    }

    _checkRaceEnd() {
        const finished = this._finishedCount();
        const active = this._activeRacers().length;
        if (this.phase !== 'race') return;
        if (finished >= 2 || (active <= 1 && this.racers.length >= 1)) this._finishRace();
    }

    _finishRace({ loop = false } = {}) {
        const standalonePresentation = !this.presentation || this.presentation.resolved;
        if (standalonePresentation) this._startPresentation(null, 'raceSettlement');
        const scoreBefore = Object.fromEntries(this.players.map(player => [player.id, player.score]));
        // If M.O.U.T.H. leaves only one racer, that racer receives whichever
        // place is still available.  Eliminated racers never receive a gold or
        // silver chip, and a missing second finisher means the silver is simply
        // unawarded as in the physical game.
        const active = this._activeRacers();
        const first = this.racers.filter(racer => racer.finishOrder === 1)[0] || (active.length === 1 ? active[0] : null);
        if (first && first.finishOrder == null) first.finishOrder = this._finishedCount() ? 2 : 1;

        // Mastermind: predicting the first finisher ends the race immediately
        // with the prediction holder in second.  Predicting itself is the one
        // exception: the same racer takes both first and second rewards.
        const mastermind = this.racers.find(racer => racer.predictedWin && first && racer.predictedWin === first.id);
        let mastermindDouble = false;
        if (mastermind && mastermind === first) {
            mastermindDouble = true;
            this._log(`${this._racerName(mastermind)} 预测自己获胜，获得金牌与银牌`);
        } else if (mastermind && mastermind.finishOrder == null && !mastermind.eliminated) {
            mastermind.finishOrder = 2;
            this._log(`${this._racerName(mastermind)} 预测正确，本场立即结束，获得第二名`);
        }
        const placed = this.racers.filter(racer => racer.finishOrder != null && !racer.eliminated)
            .sort((a, b) => a.finishOrder - b.finishOrder || b.position - a.position);
        const leftovers = this.racers.filter(racer => racer.finishOrder == null && !racer.eliminated)
            .sort((a, b) => b.position - a.position);
        const ranking = [...placed, ...leftovers, ...this.racers.filter(racer => racer.eliminated)];
        const gold = GOLD_POINTS[this.match - 1] || 0;
        const silver = SILVER_POINTS[this.match - 1] || 0;
        const firstR = ranking[0];
        const secondR = mastermindDouble ? firstR : (loop ? null : ranking[1]);
        const awardedFirst = loop ? null : firstR;
        const awardedSecond = loop ? null : secondR;
        const firstPlayer = awardedFirst ? this.playerMap[awardedFirst.playerId] : null;
        const secondPlayer = awardedSecond ? this.playerMap[awardedSecond.playerId] : null;
        if (firstPlayer && awardedFirst && !awardedFirst.eliminated) firstPlayer.score += gold;
        if (secondPlayer && awardedSecond && !awardedSecond.eliminated) secondPlayer.score += silver;
        const historyEntry = {
            match: this.match,
            trackSide: this.trackSide,
            ranking: ranking.map((racer, index) => ({
                id: racer.id,
                playerId: racer.playerId,
                athleteId: racer.athleteId,
                position: racer.position,
                finishOrder: racer.finishOrder,
                place: index + 1,
                gold: racer === awardedFirst && awardedFirst && !awardedFirst.eliminated ? gold : 0,
                silver: racer === awardedSecond && awardedSecond && !awardedSecond.eliminated ? silver : 0,
                eliminated: Boolean(racer.eliminated),
                bronze: racer.bronze || 0,
            })),
        };
        this.history.push(historyEntry);
        const playerResults = this.players.map(player => ({
            playerId: player.id, playerName: player.name, color: player.color,
            scoreBefore: scoreBefore[player.id] || 0, scoreAfter: player.score,
            change: player.score - (scoreBefore[player.id] || 0), bronze: player.bronze || 0,
            gold: historyEntry.ranking.filter(rank => rank.playerId === player.id).reduce((sum, rank) => sum + (rank.gold || 0), 0),
            silver: historyEntry.ranking.filter(rank => rank.playerId === player.id).reduce((sum, rank) => sum + (rank.silver || 0), 0),
        }));
        this._appendPresentationEvent({
            kind: 'raceSettlement', match: this.match, trackSide: this.trackSide, loop,
            goldValue: gold, silverValue: silver, ranking: clone(historyEntry.ranking),
            racers: ranking.map(racer => this._publicRacer(racer)), playerResults,
        });
        this._log(`第 ${this.match} 场结束：${firstPlayer?.name || '无人'} 获金牌（${gold} 分），${secondPlayer?.name || '无人'} 获银牌（${silver} 分）`);
        if (this.match >= RACES) {
            this.status = 'ended';
            this.phase = 'ended';
            this.pending = null;
            const high = Math.max(...this.players.map(player => player.score));
            this.winners = this.players.filter(player => player.score === high);
            this.winner = this.winners[0] || null;
            const sorted = this.players.slice().sort((a, b) => b.score - a.score || b.bronze - a.bronze);
            this.finalStandings = sorted.map(player => ({
                rank: sorted.findIndex(item => item.score === player.score) + 1,
                playerId: player.id, playerName: player.name, color: player.color,
                score: player.score, bronze: player.bronze || 0,
            }));
            this._appendPresentationEvent({ kind: 'finalSettlement', standings: clone(this.finalStandings), winnerIds: this.winners.map(player => player.id) });
            this._log(this.winners.length > 1 ? `最终并列冠军：${this.winners.map(player => player.name).join('、')}` : `${this.winner?.name || '无人'} 赢得运动会总冠军`);
            if (standalonePresentation) this._finishPresentation();
            return;
        }
        this.startPlayerIndex = this._nextRaceStartPlayerIndex();
        this.match += 1;
        this._beginRaceSelection();
        if (standalonePresentation) this._finishPresentation();
    }

    _nextRaceStartPlayerIndex() {
        const previous = this.history[this.history.length - 1];
        if (!previous) return this.startPlayerIndex;
        if (this.players.length <= 3) {
            // The official double-racer variant starts the next race with the
            // player who earned fewer points in the previous race; ties roll
            // off among the tied players.
            const points = Object.fromEntries(this.players.map(player => [player.id, 0]));
            previous.ranking.forEach(rank => { points[rank.playerId] = (points[rank.playerId] || 0) + (rank.gold || 0) + (rank.silver || 0); });
            const low = Math.min(...this.players.map(player => points[player.id] || 0));
            const candidates = this.players.map((player, index) => ({ player, index })).filter(item => (points[item.player.id] || 0) === low).map(item => item.index);
            return candidates.length === 1 ? candidates[0] : this._rollOffPlayerIndex(candidates);
        }
        // In the standard game the first eliminated racer, if any, determines
        // the next start; otherwise use the racer farthest behind.
        const eliminated = this.racers.filter(racer => racer.eliminated).sort((a, b) => (a.eliminationOrder || 0) - (b.eliminationOrder || 0))[0];
        const last = eliminated || this.racers.filter(racer => racer.finishOrder == null && !racer.eliminated).sort((a, b) => a.position - b.position)[0];
        const index = this.players.findIndex(player => player.id === last?.playerId);
        return index >= 0 ? index : this.startPlayerIndex;
    }

    _raceStateKey() {
        const racers = this.racers.map(racer => [racer.id, racer.position, racer.finishOrder, racer.eliminated, racer.tripped, racer.turnDoneThisRound]).join('|');
        return `${this.match}:${this.currentTurnIndex}:${this.skipperPending}:${racers}`;
    }

    // ==================== HELPERS ====================

    _finishedCount() { return this.racers.filter(racer => racer.finishOrder != null).length; }
    _activeRacers() { return this.racers.filter(racer => racer.finishOrder == null && !racer.eliminated); }
    _countOn(position) { return this._activeRacers().filter(racer => racer.position === position).length; }
    _racerName(racer) { const athlete = this._athlete(racer.athleteId); return `${this.playerMap[racer.playerId]?.name || ''}·${athlete?.name || ''}`; }
    _publicRacer(racer) {
        if (!racer) return null;
        return {
            id: racer.id, playerId: racer.playerId, playerName: this.playerMap[racer.playerId]?.name || '',
            athleteId: racer.athleteId, athleteName: this._athlete(racer.athleteId)?.name || racer.athleteId,
            position: racer.position, tripped: Boolean(racer.tripped), eliminated: Boolean(racer.eliminated),
            finishOrder: racer.finishOrder, bronze: racer.bronze || 0,
            copiedAthlete: racer.copiedPowers?.[0] || null,
        };
    }
    _abilityEvent(source, abilityId, targets = [], extra = {}) {
        return this._appendPresentationEvent({
            kind: 'abilityTriggered', source: this._publicRacer(source), abilityId,
            abilityName: this._athlete(abilityId)?.name || abilityId,
            targets: targets.filter(Boolean).map(target => this._publicRacer(target)), ...clone(extra),
        });
    }
    _dieEvent(racer, value, extra = {}) {
        return this._appendPresentationEvent({ kind: 'dieRevealed', racer: this._publicRacer(racer), value, ...clone(extra) });
    }
    _movementEvent(racer, from, to, movementType = 'ability', context = {}) {
        if (!racer || from === to) return null;
        return this._appendPresentationEvent({
            kind: 'racerMoved', racer: this._publicRacer(racer), from, to, movementType,
            sourceRacerId: context.sourceRacerId || racer.id,
            targetRacerId: context.targetRacerId || racer.id,
            abilityId: context.abilityId || null, steps: context.steps ?? (to - from),
        });
    }
    _tripEvent(racer, cause = 'ability', sourceRacerId = null) {
        return this._appendPresentationEvent({ kind: 'racerTripped', racer: this._publicRacer(racer), position: racer.position, cause, sourceRacerId });
    }
    _awardBronze(racer, amount) {
        const points = Math.max(0, Number(amount) || 0);
        if (!points) return;
        const player = this.playerMap[racer.playerId];
        racer.bronze += points;
        if (player) {
            player.bronze += points;
            player.score += points;
        }
        this._appendPresentationEvent({ kind: 'bronzeAwarded', racer: this._publicRacer(racer), amount: points, playerScore: player?.score || 0 });
    }
    _removeBronze(racer, amount) {
        const requested = Math.max(0, Number(amount) || 0);
        const removed = Math.min(requested, Math.max(0, racer.bronze));
        if (!removed) return 0;
        racer.bronze -= removed;
        const player = this.playerMap[racer.playerId];
        if (player) {
            const playerRemoved = Math.min(removed, Math.max(0, player.bronze));
            player.bronze -= playerRemoved;
            player.score = Math.max(0, player.score - playerRemoved);
        }
        this._appendPresentationEvent({ kind: 'bronzeRemoved', racer: this._publicRacer(racer), amount: removed, playerScore: player?.score || 0 });
        return removed;
    }
    _rollDie() { return Math.floor(this.random() * 6) + 1; }
    _aloneInLast(racer) { const last = this._lastPlaceRacers(); return last.length === 1 && last[0].id === racer.id; }
    _aloneInLead(racer) { const lead = this._leadRacers(); return lead.length === 1 && lead[0].id === racer.id; }
    _lastPlaceRacers() {
        const active = this._activeRacers();
        if (!active.length) return [];
        const min = Math.min(...active.map(racer => racer.position));
        return active.filter(racer => racer.position === min);
    }
    _leadRacers() {
        const active = this._activeRacers();
        if (!active.length) return [];
        const max = Math.max(...active.map(racer => racer.position));
        return active.filter(racer => racer.position === max);
    }
    _rollOffPlayerIndex(candidateIndexes = this.players.map((_, index) => index)) {
        if (!candidateIndexes.length) return 0;
        // Highest unique roll wins.  On a tie the tied players roll again;
        // guard the loop for deterministic test RNGs that intentionally return
        // the same value forever, then use stable seat order as the final tie
        // break rather than hanging a room.
        let contenders = candidateIndexes.slice();
        for (let round = 0; round < 32 && contenders.length > 1; round += 1) {
            const rolls = contenders.map(index => ({ index, roll: this._rollDie() }));
            const highest = Math.max(...rolls.map(item => item.roll));
            const tied = rolls.filter(item => item.roll === highest).map(item => item.index);
            if (tied.length === 1) return tied[0];
            contenders = tied;
        }
        return Math.min(...contenders);
    }
    _startPresentation(actorId, action) {
        this.presentation = { sequence: ++this.presentationSequence, actorId, action, resolved: false, events: [] };
        this.presentationPrivate = {};
    }
    _appendPresentationEvent(event, privateByPlayer = null) {
        if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system');
        const entry = { sequence: ++this.presentationEventSequence, ...clone(event) };
        this.presentation.events.push(entry);
        if (privateByPlayer && Object.keys(privateByPlayer).length) this.presentationPrivate[entry.sequence] = clone(privateByPlayer);
        return entry;
    }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }

    // ==================== STATE ====================

    _success(message) {
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended' && !this.pendingAcknowledgements.length, winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })) };
    }

    getPublicState() {
        const current = this.players[this.currentTurnIndex];
        const prompt = this.pending ? { kind: this.pending.kind, playerId: this.pending.playerId, racerId: this.pending.racerId || null, targetRacerId: this.pending.targetRacerId || null, pool: this.pending.pool || null, options: this.pending.options || null } : null;
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            match: this.match,
            maxMatches: RACES,
            teamSize: this.teamSize,
            racersPerPlayer: this.racersPerPlayer,
            trackSide: this.trackSide,
            trackLength: TRACK_LENGTH,
            draftRound: this.draftRound,
            draftPool: this.draftPool.map(athlete => ({ ...athlete })),
            currentTurn: current?.id || null,
            currentTurnName: current?.name || null,
            raceSelectionStatus: this.phase === 'race_select' ? this.players.map(player => {
                const selectedCount = (this.raceSelections[player.id] || []).length;
                return {
                    playerId: player.id,
                    selectedCount,
                    ready: selectedCount >= this.racersPerPlayer,
                };
            }) : [],
            athletes: ATHLETES.map(athlete => ({ ...athlete, takenBy: this.phase === 'draft' ? this.players.find(player => player.team.some(card => card.id === athlete.id))?.id || null : null, takenByName: this.phase === 'draft' ? this.players.find(player => player.team.some(card => card.id === athlete.id))?.name || null : null })),
            players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, score: player.score, bronze: player.bronze, isOnline: player.isOnline })),
            racers: this.racers.map(racer => ({ id: racer.id, playerId: racer.playerId, athleteId: racer.athleteId, position: racer.position, tripped: racer.tripped, eliminated: racer.eliminated, finishOrder: racer.finishOrder, bronze: racer.bronze, copiedAthlete: racer.copiedPowers[0] || null, athlete: this._athlete(racer.athleteId) })),
            trackSpecials: { ...TRACK_SPECIALS[this.trackSide] },
            history: this.history,
            presentation: clone(this.presentation),
            acknowledgement: this.pendingAcknowledgements[0] ? clone(this.pendingAcknowledgements[0]) : null,
            finalStandings: clone(this.finalStandings),
            prompt,
            actionLog: this.actionLog.slice(-24),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null,
            winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })),
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        if (state.prompt && state.prompt.playerId !== playerId) {
            // Egg/Twin choices are private information.  Other viewers may
            // see that a decision is pending, but not the candidate cards.
            state.prompt = { ...state.prompt, pool: null, options: null };
        }
        if (state.presentation?.events?.length) state.presentation.events = state.presentation.events.map(event => {
            const privateData = this.presentationPrivate[event.sequence]?.[playerId];
            return privateData ? { ...event, private: clone(privateData) } : event;
        });
        const picks = this.raceSelections[playerId] || [];
        state.myId = playerId;
        state.myTeam = player?.team.map(athlete => ({ ...athlete, used: player.usedAthletes.includes(athlete.id) })) || [];
        state.myRaceSelections = picks.slice();
        state.myBronze = player?.bronze || 0;
        state.myAthlete = this.racers.find(racer => racer.playerId === playerId)?.athlete || null;
        const myRacer = this.racers.find(racer => racer.playerId === playerId && racer.finishOrder == null && !racer.eliminated);
        state.myRacer = myRacer ? { id: myRacer.id, athleteId: myRacer.athleteId, position: myRacer.position, tripped: myRacer.tripped, roll: myRacer.roll ?? null, extraTurn: Boolean(myRacer.extraTurn) } : null;
        state.availableActions = {
            chooseAthlete: !state.acknowledgement && this.phase === 'draft' && state.currentTurn === playerId,
            selectRaceAthlete: !state.acknowledgement && this.phase === 'race_select' && this.raceSelectionQueue[this.raceSelectionIndex] === playerId,
            roll: !state.acknowledgement && this.phase === 'race' && state.currentTurn === playerId && this._playerHasActiveRacer(playerId) && !this.pending,
            acknowledgeElimination: state.acknowledgement?.playerId === playerId,
        };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        const droppedAcknowledgement = this.pendingAcknowledgements.find(item => item.playerId === playerId);
        this.pendingAcknowledgements = this.pendingAcknowledgements.filter(item => item.playerId !== playerId);
        if (droppedAcknowledgement && !this.pendingAcknowledgements.length && this.deferredAfterAcknowledgement) {
            this._startPresentation(playerId, 'eliminationAutoAcknowledged');
            const victim = this.racers.find(racer => racer.id === droppedAcknowledgement.racerId);
            const source = this.racers.find(racer => racer.id === droppedAcknowledgement.sourceRacerId);
            this._appendPresentationEvent({ kind: 'racerEliminated', victim: victim ? this._publicRacer(victim) : clone(droppedAcknowledgement), source: source ? this._publicRacer(source) : null, position: droppedAcknowledgement.position, acknowledgedBy: null });
            const continuation = this.deferredAfterAcknowledgement;
            this.deferredAfterAcknowledgement = null;
            const racer = this.racers.find(item => item.id === continuation.racerId);
            if (racer) this._resumeAfterAcknowledgement(racer, continuation.mode);
            this._finishPresentation();
        }
        if (this.players.filter(item => item.isOnline).length < 2) {
            this.status = 'ended';
            this.phase = 'ended';
            this.pending = null;
            this.winner = this.players.find(item => item.isOnline) || null;
        }
        return this._success(`${player.name} 已离开赛场`);
    }

    getWinner() {
        if (!this.winner) return null;
        return {
            id: this.winner.id,
            name: this.winner.name,
            score: this.winner.score,
            shared: this.winners.length > 1,
            winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })),
        };
    }
}

module.exports = MagicalAthleteEngine;
module.exports.ATHLETES = ATHLETES;
module.exports.RACES = RACES;
module.exports.GOLD_POINTS = GOLD_POINTS;
module.exports.SILVER_POINTS = SILVER_POINTS;
module.exports.TRACK_SPECIALS = TRACK_SPECIALS;
module.exports.TRACK_LENGTH = TRACK_LENGTH;
