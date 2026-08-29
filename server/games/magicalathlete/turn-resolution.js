/* Race-turn decision and settlement workflows. Methods are installed on the engine prototype and use `this` for state. */

'use strict';

const { RACES, GOLD_POINTS, SILVER_POINTS, SECOND_CORNER } = require('./constants');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function resolveStartOfTurn(racer) {
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

function resolvePrompt(player, action) {
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

function afterRollPrompt(racer) {
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

function rerollMainMove(racer) {
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

function continueTurn(racer) {
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

function startMainMove(racer) {
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

function finalizeRoll(racer) {
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

function applyMainMove(racer) {
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

function finishRace({ loop = false } = {}) {
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
module.exports = {
    resolveStartOfTurn,
    resolvePrompt,
    afterRollPrompt,
    rerollMainMove,
    continueTurn,
    startMainMove,
    finalizeRoll,
    applyMainMove,
    finishRace,
};
