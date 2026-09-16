// Magical Athlete (2025 CMYK edition) — official-rules implementation.
// Reference: Magical Athlete Rulebook (EN/FR), Takashi Ishida / Richard Garfield.
// The 36 racers below match the official card pool; abilities are resolved by
// the race state machine with the official trigger priority:
//   racetrack spaces -> current player's racers -> other players' racers (clockwise).
//
// Data constants printed on physical components (chip values, track-special
// positions) can't be read from the rulebook text layer; they are kept as
// single constants so they are trivial to adjust if ever needed.

const { RACES, TRACK_LENGTH, GOLD_POINTS, SILVER_POINTS, SECOND_CORNER, TRACK_SPECIALS, ATHLETES, COLORS } = require('./constants');
const { resolveStartOfTurn, resolvePrompt, afterRollPrompt, rerollMainMove, continueTurn, startMainMove, finalizeRoll, applyMainMove, finishRace } = require('./turn-resolution');
const { moveRacer, resolvePassing, resolveStops, moveByPower, warpTo, powerEvent } = require('./movement');
const { getPublicState, getPlayerState, getWinner } = require('./state');
const { PRESENTATION_FADE_MS, PRESENTATION_CONTENT_DURATIONS, presentationMethods } = require('./presentation');

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
        this.now = typeof suppliedOptions.now === 'function' ? suppliedOptions.now : () => Date.now();
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
        this.presentationQueue = [];
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
        this.presentationQueue = [];
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
        const order = this._onlineOrder(this.startPlayerIndex + this.draftRound).map(player => this.players.indexOf(player));
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
        const activePlayers = this._onlineOrder(this.startPlayerIndex);
        this.raceSelections = Object.fromEntries(this.players.map(player => [player.id, []]));
        this.raceSelectionQueue = activePlayers.map(player => player.id);
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
        const starter = this._onlinePlayerAtOrAfter(this.startPlayerIndex);
        this.currentTurnIndex = starter ? this.players.indexOf(starter) : 0;
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
        const previousPresentationQueue = this.presentationQueue.slice();
        const previousPrivate = clone(this.presentationPrivate);
        const previousPresentationSequence = this.presentationSequence;
        const previousEventSequence = this.presentationEventSequence;
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
            this.presentationQueue = previousPresentationQueue;
            this.presentationPrivate = previousPrivate;
            this.presentationSequence = previousPresentationSequence;
            this.presentationEventSequence = previousEventSequence;
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
        if (Number.isFinite(Number(acknowledgement.deadlineAt)) && Number(acknowledgement.deadlineAt) <= this._now()) {
            return this._resolveEliminationAcknowledgement(player.id, acknowledgement.id, true);
        }
        return this._resolveEliminationAcknowledgement(player.id, acknowledgement.id, false);
    }

    _resolveEliminationAcknowledgement(playerId, acknowledgementId, automatic = false) {
        const acknowledgement = this.pendingAcknowledgements[0];
        if (!acknowledgement || acknowledgement.id !== acknowledgementId || acknowledgement.playerId !== playerId) return { success: false, message: '淘汰确认已经更新，请重新确认', state: this.getPlayerState(playerId) };
        this.pendingAcknowledgements.shift();
        this._startPresentation(playerId, automatic ? 'eliminationAutoAcknowledged' : 'acknowledgeElimination');
        const victim = this.racers.find(racer => racer.id === acknowledgement.racerId);
        const source = this.racers.find(racer => racer.id === acknowledgement.sourceRacerId);
        this._appendPresentationEvent({
            kind: 'racerEliminated', victim: victim ? this._publicRacer(victim) : clone(acknowledgement),
            source: source ? this._publicRacer(source) : null, position: acknowledgement.position,
            acknowledgedBy: automatic ? null : playerId,
        });
        const player = this.playerMap[playerId];
        this._log(`${player?.name || acknowledgement.playerName} ${automatic ? '未在时限内确认，系统自动确认' : '已确认'} ${acknowledgement.athleteName} 从本场淘汰`);
        if (!this.pendingAcknowledgements.length && this.deferredAfterAcknowledgement) {
            const continuation = this.deferredAfterAcknowledgement;
            this.deferredAfterAcknowledgement = null;
            const racer = this.racers.find(item => item.id === continuation.racerId);
            if (racer) this._resumeAfterAcknowledgement(racer, continuation.mode);
        }
        this._finishPresentation();
        return this._success(automatic ? '淘汰确认超时，系统已自动处理' : '已确认淘汰，比赛继续');
    }

    handleSystemTick() {
        if (this.status !== 'playing') return null;
        let result = null;
        let guard = 0;
        while (this.pendingAcknowledgements.length && guard++ < 16) {
            const acknowledgement = this.pendingAcknowledgements[0];
            if (!Number.isFinite(Number(acknowledgement.deadlineAt)) || Number(acknowledgement.deadlineAt) > this._now()) break;
            result = this._resolveEliminationAcknowledgement(acknowledgement.playerId, acknowledgement.id, true);
            if (!result?.success) break;
        }
        return result;
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
        const currentPlayer = this.players[this.currentTurnIndex]?.isOnline === false ? null : this.players[this.currentTurnIndex];
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
        while (attempts <= this.players.length && (!this.players[nextIndex] || !this._playerHasActiveRacer(this.players[nextIndex].id))) {
            nextIndex = (nextIndex + 1) % this.players.length;
            attempts += 1;
        }
        this.currentTurnIndex = nextIndex;
        this.racers.forEach(racer => { racer.turnDoneThisRound = false; racer.rerollUsedThisTurn = false; racer._turnStartPos = racer.position; racer._duelPrompted = false; racer._suckerAtStart = null; });
        const nextPlayer = this.players[this.currentTurnIndex];
        if (nextPlayer) this.actionLog.push(`轮到 ${nextPlayer.name}`);
    }

    _playerHasActiveRacer(playerId) {
        return this.playerMap[playerId]?.isOnline !== false && this.racers.some(racer => racer.playerId === playerId && racer.finishOrder == null && !racer.eliminated);
    }

    _checkRaceEnd() {
        const finished = this._finishedCount();
        const active = this._activeRacers().length;
        if (this.phase !== 'race') return;
        if (finished >= 2 || (active <= 1 && this.racers.length >= 1)) this._finishRace();
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
            const eligible = this._activePlayers();
            const low = Math.min(...eligible.map(player => points[player.id] || 0));
            const candidates = eligible.filter(player => (points[player.id] || 0) === low).map(player => this.players.indexOf(player));
            return candidates.length === 1 ? candidates[0] : this._rollOffPlayerIndex(candidates);
        }
        // In the standard game the first eliminated racer, if any, determines
        // the next start; otherwise use the racer farthest behind.
        const eliminated = this.racers.filter(racer => racer.eliminated).sort((a, b) => (a.eliminationOrder || 0) - (b.eliminationOrder || 0))[0];
        const last = eliminated || this.racers.filter(racer => racer.finishOrder == null && !racer.eliminated).sort((a, b) => a.position - b.position)[0];
        const index = this.players.findIndex(player => player.id === last?.playerId && player.isOnline !== false);
        return index >= 0 ? index : this.startPlayerIndex;
    }

    _raceStateKey() {
        const racers = this.racers.map(racer => [racer.id, racer.position, racer.finishOrder, racer.eliminated, racer.tripped, racer.turnDoneThisRound]).join('|');
        return `${this.match}:${this.currentTurnIndex}:${this.skipperPending}:${racers}`;
    }

    // ==================== HELPERS ====================

    _activePlayers() { return this.players.filter(player => player.isOnline !== false); }
    _onlinePlayerAtOrAfter(index = 0) {
        if (!this.players.length) return null;
        for (let offset = 0; offset < this.players.length; offset += 1) {
            const player = this.players[(Number(index) + offset + this.players.length) % this.players.length];
            if (player?.isOnline !== false) return player;
        }
        return null;
    }
    _onlineOrder(index = 0) {
        const result = [];
        const seen = new Set();
        for (let offset = 0; offset < this.players.length; offset += 1) {
            const player = this.players[(Number(index) + offset + this.players.length * 2) % this.players.length];
            if (player?.isOnline !== false && !seen.has(player.id)) {
                result.push(player);
                seen.add(player.id);
            }
        }
        return result;
    }
    _finishedCount() { return this.racers.filter(racer => racer.finishOrder != null).length; }
    _activeRacers() { return this.racers.filter(racer => racer.finishOrder == null && !racer.eliminated && this.playerMap[racer.playerId]?.isOnline !== false); }
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
    _log(message) { this.actionLog.push(message); }

    // ==================== STATE ====================

    _success(message) {
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended' && !this.pendingAcknowledgements.length, winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })) };
    }
    _removePlayerFromTurnQueue(queueName, indexName, playerId) {
        const queue = Array.isArray(this[queueName]) ? this[queueName] : [];
        const index = Number(this[indexName]) || 0;
        const removedBefore = queue.slice(0, index).filter(id => id === playerId).length;
        const next = queue.filter(id => id !== playerId);
        this[queueName] = next;
        this[indexName] = Math.max(0, Math.min(next.length, index - removedBefore));
        return { hadCurrent: queue[index] === playerId, exhausted: this[indexName] >= next.length };
    }

    _finishByDeparture() {
        const active = this._activePlayers();
        const sorted = active.slice().sort((left, right) => right.score - left.score || right.bronze - left.bronze || left.id.localeCompare(right.id));
        const high = sorted[0]?.score ?? 0;
        this.winners = sorted.filter(player => player.score === high);
        this.winner = this.winners[0] || null;
        this.finalStandings = sorted.map((player, index) => ({
            rank: index + 1,
            playerId: player.id,
            playerName: player.name,
            color: player.color,
            score: player.score,
            bronze: player.bronze || 0,
        }));
        this.status = 'ended';
        this.phase = 'ended';
        this.endReason = 'players';
        this.outcome = 'lastPlayerStanding';
        this.pending = null;
        this.deferredPrompt = null;
        this.pendingAcknowledgements = [];
        this.deferredAfterAcknowledgement = null;
        this._appendPresentationEvent({
            kind: 'finalSettlement',
            forced: true,
            reason: 'players',
            outcome: 'lastPlayerStanding',
            standings: clone(this.finalStandings),
            winnerIds: this.winners.map(player => player.id),
        });
        this._log(`${this.winners.map(player => player.name).join('、') || '无人'} 在离场收束中获胜`);
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || player.isOnline === false) return { success: false, message: '玩家不存在' };
        const wasPlaying = this.status === 'playing';
        const phaseBefore = this.phase;
        const wasCurrent = this.players[this.currentTurnIndex]?.id === playerId;
        player.isOnline = false;
        // A natural final result is immutable.  Leaving an already finished
        // room only changes the roster/connection flag and never recalculates
        // the winner or emits a second finale.
        if (!wasPlaying) return this._success(`${player.name} 已离开赛场`);

        this._startPresentation(playerId, 'playerLeave');
        this._appendPresentationEvent({
            kind: 'playerLeft',
            playerId,
            playerName: player.name,
            phase: phaseBefore,
            wasCurrent,
            remainingPlayerCount: this._activePlayers().length,
        });

        // Remove the departed seat from serial decision queues.  The current
        // queue index is kept stable so already completed picks are not replayed.
        if (phaseBefore === 'draft') {
            const queueResult = this._removePlayerFromTurnQueue('draftQueue', 'draftQueueIndex', playerId);
            if (queueResult.exhausted) {
                this.draftRound += 1;
                if (this.draftRound < this._draftRounds()) this._openDraftRound();
                else if (this._activePlayers().every(item => item.team.length >= this.teamSize)) { this.match = 1; this._beginRaceSelection(); }
                else this._openDraftRound();
            } else {
                const nextId = this.draftQueue[this.draftQueueIndex];
                this.currentTurnIndex = this.players.findIndex(item => item.id === nextId);
            }
        } else if (phaseBefore === 'race_select') {
            const queueResult = this._removePlayerFromTurnQueue('raceSelectionQueue', 'raceSelectionIndex', playerId);
            if (queueResult.exhausted) this._startRace();
            else {
                const nextId = this.raceSelectionQueue[this.raceSelectionIndex];
                this.currentTurnIndex = this.players.findIndex(item => item.id === nextId);
            }
        }

        // A departed racer can never remain active or become the next turn.
        for (const racer of this.racers.filter(item => item.playerId === playerId && !item.eliminated && item.finishOrder == null)) {
            racer.eliminated = true;
            racer.eliminationOrder = ++this.eliminationCounter;
        }

        // Resolve a pending acknowledgement owned by the departed player.  It
        // follows the same event path as the timeout, but is immediate because
        // the player can no longer acknowledge it.
        const droppedAcknowledgement = this.pendingAcknowledgements.find(item => item.playerId === playerId);
        if (droppedAcknowledgement) {
            this.pendingAcknowledgements = this.pendingAcknowledgements.filter(item => item.id !== droppedAcknowledgement.id);
            const victim = this.racers.find(racer => racer.id === droppedAcknowledgement.racerId);
            const source = this.racers.find(racer => racer.id === droppedAcknowledgement.sourceRacerId);
            this._appendPresentationEvent({ kind: 'racerEliminated', victim: victim ? this._publicRacer(victim) : clone(droppedAcknowledgement), source: source ? this._publicRacer(source) : null, position: droppedAcknowledgement.position, acknowledgedBy: null, automatic: true });
            if (!this.pendingAcknowledgements.length && this.deferredAfterAcknowledgement) {
                const continuation = this.deferredAfterAcknowledgement;
                this.deferredAfterAcknowledgement = null;
                const racer = this.racers.find(item => item.id === continuation.racerId);
                if (racer && racer.playerId !== playerId && !racer.eliminated) this._resumeAfterAcknowledgement(racer, continuation.mode);
            }
        }

        // Any prompt whose owner or target was the departed seat is cancelled
        // with the least-surprising default (do not use the optional power),
        // then the interrupted turn continues for an online racer.
        const pending = this.pending;
        const pendingRacer = pending?.racerId ? this.racers.find(item => item.id === pending.racerId) : null;
        const pendingTouchesDeparture = pending && (pending.playerId === playerId || pendingRacer?.playerId === playerId || pending.targetRacerId?.startsWith?.(`${playerId}:`));
        if (pendingTouchesDeparture) {
            this.pending = null;
            if (pendingRacer?.playerId === playerId) pendingRacer.beforeRacePending = false;
            if (pendingRacer && pendingRacer.playerId !== playerId && !pendingRacer.eliminated) {
                const interrupted = pending.interruptRacerId ? this.racers.find(item => item.id === pending.interruptRacerId) : pendingRacer;
                if (pending.kind === 'duel' || pending.kind === 'suckerfish') this._afterRacerTurn(interrupted || pendingRacer);
                else this._continueTurn(pendingRacer);
            } else if (pending?.kind === 'eggPick' || pending?.kind === 'twinPick') this._openBeforeRacePrompt();
        }
        if (this.deferredPrompt && (this.deferredPrompt.playerId === playerId || this.deferredPrompt.racerId?.startsWith?.(`${playerId}:`) || this.deferredPrompt.targetRacerId?.startsWith?.(`${playerId}:`))) this.deferredPrompt = null;
        if (this.deferredAfterAcknowledgement?.racerId?.startsWith?.(`${playerId}:`)) this.deferredAfterAcknowledgement = null;

        if (this._activePlayers().length < 2) {
            this._finishByDeparture();
            this._finishPresentation();
            return this._success(`${player.name} 离开后，比赛结束`);
        }
        if (this.phase === 'race') {
            if (!this._playerHasActiveRacer(this.players[this.currentTurnIndex]?.id)) this._advanceTurn();
            this._checkRaceEnd();
        }
        if (this.status === 'playing') this._finishPresentation();
        return this._success(`${player.name} 已离开赛场`);
    }

}

Object.assign(MagicalAthleteEngine.prototype, {
    ...presentationMethods,
    _resolveStartOfTurn: resolveStartOfTurn,
    _resolvePrompt: resolvePrompt,
    _afterRollPrompt: afterRollPrompt,
    _rerollMainMove: rerollMainMove,
    _continueTurn: continueTurn,
    _startMainMove: startMainMove,
    _finalizeRoll: finalizeRoll,
    _applyMainMove: applyMainMove,
    _finishRace: finishRace,
    _moveRacer: moveRacer,
    _resolvePassing: resolvePassing,
    _resolveStops: resolveStops,
    _moveByPower: moveByPower,
    _warpTo: warpTo,
    _powerEvent: powerEvent,
    getPublicState,
    getPlayerState,
    getWinner,
});

module.exports = MagicalAthleteEngine;
module.exports.ATHLETES = ATHLETES;
module.exports.RACES = RACES;
module.exports.GOLD_POINTS = GOLD_POINTS;
module.exports.SILVER_POINTS = SILVER_POINTS;
module.exports.TRACK_SPECIALS = TRACK_SPECIALS;
module.exports.TRACK_LENGTH = TRACK_LENGTH;
module.exports.PRESENTATION_FADE_MS = PRESENTATION_FADE_MS;
module.exports.PRESENTATION_CONTENT_DURATIONS = PRESENTATION_CONTENT_DURATIONS;
