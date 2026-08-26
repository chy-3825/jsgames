const ROUNDS = 4;
const DICE_PER_PLAYER = 8;
const NEUTRAL_ID = 'neutral';
const COLORS = ['red', 'blue', 'gold', 'green', 'violet'];
const CASINO_NAMES = ['黄金宫', '海市蜃楼', '星光金字塔', '皇家塔楼', '赤沙宫', '霓虹穹顶'];
const BILL_COUNTS = new Map([[10, 6], [20, 8], [30, 8], [40, 6], [50, 6], [60, 5], [70, 5], [80, 5], [90, 5]]);

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function casinoNamesForEngine(face) {
    return CASINO_NAMES[Number(face) - 1] || `${face}号赌场`;
}

function buildMoneyDeck() {
    const deck = [];
    for (const [value, count] of BILL_COUNTS) for (let index = 0; index < count; index += 1) deck.push(value);
    return deck;
}

class LasVegasEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = random;
        this.players = players.slice(0, 5).map((player, index) => ({ id: player.id, name: player.name, color: COLORS[index], money: 0, banknotes: [], diceRemaining: DICE_PER_PLAYER, roll: [], placed: {}, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.participants = this.players;
        this.neutral = null;
        this.neutralDicePerPlayer = 0;
        this.neutralAssignments = {};
        this.round = 0;
        this.status = 'waiting';
        this.phase = 'waiting';
        this.currentTurnIndex = 0;
        this.startPlayerIndex = 0;
        this.casinos = [];
        this.moneyDeck = [];
        this.currentRoll = null;
        this.lastPayouts = [];
        this.actionLog = [];
        this.winner = null;
        this.winners = [];
        this.startPlayerIndex = 0;
        this.roundHistory = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < 2 || this.players.length > 5) return { success: false, message: '拉斯维加斯需要 2–5 名玩家' };
        this.players.forEach(player => { player.money = 0; player.banknotes = []; player.isOnline = true; });
        this.participants = this.players;
        this.neutralDicePerPlayer = this.players.length <= 4 ? (this.players.length === 2 ? 4 : 2) : 0;
        this.neutral = this.neutralDicePerPlayer ? { id: NEUTRAL_ID, name: '中立骰子', color: 'neutral', money: 0, diceRemaining: 0, roll: [], placed: {}, isOnline: true, isNeutral: true } : null;
        // Keep the neutral participant in the public participant list for
        // compatibility with existing room state, but it never receives an
        // independent turn: its dice are rolled by real players.
        if (this.neutral) this.participants = this.players.concat(this.neutral);
        this.moneyDeck = this._shuffle(buildMoneyDeck());
        this.startPlayerIndex = 0;
        this.round = 1;
        this.status = 'playing';
        this.actionLog = [];
        this.lastPayouts = [];
        this.winner = null;
        this.winners = [];
        this.roundHistory = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this._startRound();
        this._log(`第 ${this.round} 轮开始，${this.players[0].name} 先掷骰`);
        this._advanceToAction();
        return this._success('拉斯维加斯开始');
    }

    _startRound() {
        this.casinos = Array.from({ length: 6 }, (_, index) => ({ face: index + 1, money: [], dice: {} }));
        this.neutralAssignments = {};
        this.players.forEach(player => {
            player.diceRemaining = DICE_PER_PLAYER;
            player.neutralDiceRemaining = this.neutralDicePerPlayer;
            player.roll = [];
            player.placed = {};
            this.neutralAssignments[player.id] = this.neutralDicePerPlayer;
        });
        if (this.players.length === 3 && this.neutral) {
            const starter = this.players[this.startPlayerIndex % this.players.length];
            starter.neutralDiceRemaining += 2;
            this.neutralAssignments[starter.id] += 2;
        }
        if (this.neutral) {
            this.neutral.diceRemaining = Object.values(this.neutralAssignments).reduce((sum, count) => sum + count, 0);
            this.neutral.roll = [];
            this.neutral.placed = {};
        }
        for (const casino of this.casinos) {
            let total = 0;
            while (total < 50 && this.moneyDeck.length) { const bill = this.moneyDeck.pop(); casino.money.push(bill); total += bill; }
            casino.money.sort((a, b) => b - a);
        }
        this.currentTurnIndex = this.startPlayerIndex % this.players.length;
        this.phase = 'roll';
        this.currentRoll = null;
        this.currentRollOwn = null;
        this.currentRollNeutral = null;
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        const current = this._currentParticipant();
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离线', state: this.getPlayerState(playerId) };
        if (current?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind === 'rollDice') return this._roll(player);
        if (action.kind === 'placeDice') return this._place(player, action.face);
        return { success: false, message: '未知的拉斯维加斯动作', state: this.getPlayerState(playerId) };
    }

    _roll(player) {
        const neutralRemaining = player.neutralDiceRemaining || 0;
        if (this.phase !== 'roll' || player.diceRemaining + neutralRemaining <= 0) return { success: false, message: '当前不能掷骰子', state: this.getPlayerState(player.id) };
        const ownRoll = Array.from({ length: player.diceRemaining }, () => Math.floor(this.random() * 6) + 1);
        const neutralRoll = Array.from({ length: neutralRemaining }, () => Math.floor(this.random() * 6) + 1);
        this.currentRollOwn = ownRoll;
        this.currentRollNeutral = neutralRoll;
        this.currentRoll = ownRoll.concat(neutralRoll);
        player.roll = this.currentRoll.slice();
        this.phase = 'place';
        this._startPresentation(player.id, 'rollDice', {
            kind: 'diceRolled',
            actorId: player.id,
            actorName: player.name,
            actorColor: player.color,
            ownResults: ownRoll.slice(),
            neutralResults: neutralRoll.slice(),
            ownDiceRemaining: player.diceRemaining,
            neutralDiceRemaining: neutralRemaining,
        });
        this._finishPresentation();
        this._log(`${player.name} 掷出 ${this.currentRoll.join('、')}`);
        return this._success('请选择一个赌场放置同点数骰子');
    }

    _place(player, faceValue) {
        const face = Number(faceValue);
        if (this.phase !== 'place' || !this.currentRoll?.length || !Number.isInteger(face) || face < 1 || face > 6) return { success: false, message: '请选择本次掷出的点数', state: this.getPlayerState(player.id) };
        const ownCount = (this.currentRollOwn || []).filter(value => value === face).length;
        const neutralCount = (this.currentRollNeutral || []).filter(value => value === face).length;
        const count = ownCount + neutralCount;
        if (!count) return { success: false, message: '只能放置同一个点数的全部骰子', state: this.getPlayerState(player.id) };
        const casino = this.casinos[face - 1];
        const diceBefore = { ...casino.dice };
        if (ownCount) {
            casino.dice[player.id] = (casino.dice[player.id] || 0) + ownCount;
            player.placed[face] = (player.placed[face] || 0) + ownCount;
            player.diceRemaining -= ownCount;
        }
        if (neutralCount && this.neutral) {
            casino.dice[this.neutral.id] = (casino.dice[this.neutral.id] || 0) + neutralCount;
            this.neutral.placed[face] = (this.neutral.placed[face] || 0) + neutralCount;
            player.neutralDiceRemaining -= neutralCount;
            this.neutral.diceRemaining -= neutralCount;
        }
        player.roll = [];
        this.currentRoll = null;
        this.currentRollOwn = null;
        this.currentRollNeutral = null;
        this._startPresentation(player.id, 'placeDice', {
            kind: 'dicePlaced',
            actorId: player.id,
            actorName: player.name,
            actorColor: player.color,
            face,
            casinoName: casinoNamesForEngine(face),
            ownCount,
            neutralCount,
            totalCount: count,
            diceBefore,
            diceAfter: { ...casino.dice },
            actorDiceRemaining: player.diceRemaining,
            actorNeutralRemaining: player.neutralDiceRemaining || 0,
        });
        this._log(`${player.name} 把 ${count} 枚 ${face} 点骰子放到${face}号赌场`);
        this._advanceTurnIndex();
        this._advanceToAction();
        this._finishPresentation();
        return this._success(this.status === 'ended' ? '本轮结算完成' : '骰子已放置');
    }

    _advanceTurnIndex() { this.currentTurnIndex = (this.currentTurnIndex + 1) % this.participants.length; }

    _advanceToAction() {
        while (this.status === 'playing') {
            if (this.players.every(player => player.diceRemaining === 0 && (player.neutralDiceRemaining || 0) === 0)) { this._settleRound(); return; }
            const current = this._currentParticipant();
            if (!current || current.isNeutral || current.diceRemaining + (current.neutralDiceRemaining || 0) === 0) { this._advanceTurnIndex(); continue; }
            this.phase = 'roll';
            return;
        }
    }

    _settleRound() {
        this.phase = 'settling';
        this.lastPayouts = [];
        const settlingRound = this.round;
        const gains = Object.fromEntries(this.players.map(player => [player.id, 0]));
        const casinoSnapshot = this.casinos.map(casino => this._publicCasino(casino));
        this._appendPresentationEvent({
            kind: 'betsClosed',
            round: settlingRound,
            casinos: casinoSnapshot,
        });
        const casinoResults = [];
        for (const casino of this.casinos) {
            const ranked = Object.entries(casino.dice).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
            let billIndex = 0;
            const returnedBills = [];
            const ties = [];
            const payouts = [];
            const moneyBefore = casino.money.slice();
            const diceBefore = { ...casino.dice };
            for (let index = 0; index < ranked.length;) {
                const count = ranked[index][1];
                const group = ranked.slice(index).filter(([, value]) => value === count);
                if (group.length === 1 && casino.money[billIndex] != null) {
                    const participantId = group[0][0];
                    const player = this.playerMap[participantId];
                    const participant = player || (participantId === NEUTRAL_ID ? this.neutral : null);
                    const amount = casino.money[billIndex];
                    if (player) {
                        player.money += amount;
                        player.banknotes.push(amount);
                        gains[player.id] += amount;
                        this.lastPayouts.push({ casino: casino.face, playerId: player.id, playerName: player.name, amount, dice: count });
                    } else returnedBills.push(amount);
                    payouts.push({
                        playerId: participantId,
                        playerName: participant?.name || '中立骰子',
                        playerColor: participant?.color || 'neutral',
                        amount,
                        dice: count,
                        returnedToBank: !player,
                    });
                    billIndex += 1;
                } else if (group.length > 1) {
                    const participants = group.map(([id]) => {
                        const participant = this.playerMap[id] || (id === NEUTRAL_ID ? this.neutral : null);
                        return { id, name: participant?.name || id, color: participant?.color || 'neutral' };
                    });
                    ties.push({ count, participants });
                    this._log(`${casino.face}号赌场有 ${group.length} 位玩家并列，平手者都拿不到钱`);
                }
                index += group.length;
            }
            returnedBills.push(...casino.money.slice(billIndex));
            const casinoResult = {
                kind: 'casinoSettlement',
                round: settlingRound,
                face: casino.face,
                casinoName: casinoNamesForEngine(casino.face),
                moneyBefore,
                diceBefore,
                ties,
                payouts,
                returnedBills: returnedBills.slice(),
            };
            casinoResults.push(clone(casinoResult));
            this._appendPresentationEvent(casinoResult);
            // The deck is drawn from the end; returned notes go beneath it.
            this.moneyDeck.push(...returnedBills.reverse());
            // All dice have been returned to their supplies after payout; the
            // next round will repopulate the casino dice maps from zero.
            casino.dice = {};
            casino.money = [];
        }
        const payoutText = this.lastPayouts.map(item => `${item.playerName} 从${item.casino}号赌场拿到 ${item.amount} 万`).join('；');
        if (payoutText) this._log(payoutText);
        const roundStanding = this._standings().map(player => ({ ...player, gained: gains[player.id] || 0 }));
        const historyEntry = {
            round: settlingRound,
            players: roundStanding.map(player => ({ ...player })),
            casinos: casinoResults,
        };
        this.roundHistory.push(historyEntry);
        this._appendPresentationEvent({
            kind: 'roundSettlement',
            round: settlingRound,
            standings: roundStanding,
        });
        if (this.round >= ROUNDS) {
            const standings = this._standings();
            const best = standings[0] || { money: 0, banknoteCount: 0 };
            this.winners = this.players.filter(player => player.money === best.money && player.banknotes.length === best.banknoteCount);
            this.winner = this.winners[0] || null;
            this.status = 'ended'; this.phase = 'ended';
            this._appendPresentationEvent({
                kind: 'finalSettlement',
                round: settlingRound,
                standings,
                winnerIds: this.winners.map(player => player.id),
                roundHistory: this.roundHistory.map(entry => ({
                    round: entry.round,
                    players: entry.players.map(player => ({ id: player.id, name: player.name, color: player.color, gained: player.gained, money: player.money, banknoteCount: player.banknoteCount })),
                })),
            });
            this._finishPresentation();
            this._log(this.winners.length > 1 ? `最终平分：${this.winners.map(player => player.name).join('、')}` : `${this.winner?.name || '无人'} 以 ${best.money} 万获胜`);
            return;
        }
        const completedRound = this.round;
        this.round += 1;
        this.startPlayerIndex = (this.startPlayerIndex + 1) % this.players.length;
        const nextStarter = this.players[this.startPlayerIndex];
        this._appendPresentationEvent({ kind: 'roundTransition', completedRound, nextRound: this.round, nextStarterId: nextStarter?.id || null, nextStarterName: nextStarter?.name || '' });
        this._startRound();
        this._appendPresentationEvent({
            kind: 'roundStarted',
            round: this.round,
            starterId: nextStarter?.id || null,
            starterName: nextStarter?.name || '',
            casinos: this.casinos.map(casino => ({ face: casino.face, money: casino.money.slice() })),
        });
        this._finishPresentation();
        this._log(`第 ${this.round} 轮开始`);
        this._advanceToAction();
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开' };
        player.isOnline = false;
        if (this.status === 'playing' && this.players.filter(item => item.isOnline).length <= 1) {
            this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null; this.winners = this.winner ? [this.winner] : [];
        } else if (this.status === 'playing' && this._currentParticipant()?.id === playerId) { this._advanceTurnIndex(); this._advanceToAction(); }
        this._log(`${player.name} 离开了赌场`);
        return this._success(`${player.name} 已离开`);
    }

    _currentParticipant() { return this.participants[this.currentTurnIndex] || null; }
    _publicCasino(casino) { return { face: casino.face, money: casino.money.slice(), dice: { ...casino.dice } }; }
    _publicPlayer(player) { return { id: player.id, name: player.name, color: player.color, money: player.money, banknoteCount: player.banknotes?.length || 0, diceRemaining: player.diceRemaining, neutralDiceRemaining: player.neutralDiceRemaining || 0, placedCount: DICE_PER_PLAYER - player.diceRemaining, isOnline: player.isOnline, isNeutral: Boolean(player.isNeutral) }; }
    getPublicState() {
        const current = this._currentParticipant();
        return { roomId: this.roomId, status: this.status, phase: this.phase, round: this.round, maxRounds: ROUNDS, rules: { players: '2–5', casinos: 6, dicePerPlayer: 8, casinoMinimum: 50, tie: '并列最高者不拿该张，下一位非并列最高者拿最高剩余钞票', twoPlayerNeutral: '2 人每人 4 枚中立骰；3–4 人每人 2 枚，3 人起始玩家另掷 2 枚', moneyDeck: 54 }, currentTurn: current?.isNeutral ? null : current?.id || null, currentTurnName: current?.isNeutral ? null : current?.name || null, currentRoll: this.phase === 'place' ? this.currentRoll?.slice() : null, currentRollOwn: this.phase === 'place' ? this.currentRollOwn?.slice() : null, currentRollNeutral: this.phase === 'place' ? this.currentRollNeutral?.slice() : null, casinos: this.casinos.map(casino => this._publicCasino(casino)), players: this.players.map(player => this._publicPlayer(player)), neutral: this.neutral ? this._publicPlayer(this.neutral) : null, moneyDeckCount: this.moneyDeck.length, lastPayouts: this.lastPayouts.map(item => ({ ...item })), roundHistory: this.roundHistory.map(entry => ({ round: entry.round, players: entry.players.map(player => ({ ...player })) })), presentation: clone(this.presentation), actionLog: this.actionLog.slice(-18), winner: this.winner ? { id: this.winner.id, name: this.winner.name, money: this.winner.money, banknoteCount: this.winner.banknotes.length } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, money: player.money, banknoteCount: player.banknotes.length })) };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        state.myId = playerId;
        state.myTurn = this._currentParticipant()?.id === playerId;
        state.availableActions = { canRoll: Boolean(state.myTurn && this.phase === 'roll'), canPlace: Boolean(state.myTurn && this.phase === 'place'), canPlaceFaces: state.myTurn && this.phase === 'place' ? [...new Set(this.currentRoll)] : [] };
        return state;
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    _standings() {
        return this.players.map(player => ({ id: player.id, name: player.name, color: player.color, money: player.money, banknoteCount: player.banknotes.length })).sort((left, right) => right.money - left.money || right.banknoteCount - left.banknoteCount);
    }
    _startPresentation(actorId, action, firstEvent) {
        this.presentation = {
            sequence: ++this.presentationSequence,
            actorId,
            action,
            resolved: false,
            events: [],
        };
        if (firstEvent) this._appendPresentationEvent(firstEvent);
    }
    _appendPresentationEvent(event) {
        if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system');
        this.presentation.events.push({ sequence: ++this.presentationEventSequence, ...clone(event) });
    }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }
    _shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(this.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, money: this.winner.money } : null; }
}

module.exports = LasVegasEngine;
module.exports.buildMoneyDeck = buildMoneyDeck;
module.exports.ROUNDS = ROUNDS;
module.exports.DICE_PER_PLAYER = DICE_PER_PLAYER;
