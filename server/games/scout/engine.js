const HAND_SIZES = { 2: 11, 3: 12, 4: 11, 5: 9 };

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function buildDeck() {
    const deck = [];
    for (let front = 1; front <= 10; front += 1) for (let back = front + 1; back <= 10; back += 1) {
        deck.push({ id: `scout-${front}-${back}`, front, back });
    }
    return deck;
}

function shuffle(values, random = Math.random) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }

function valueOf(card) { return card.orientation === 1 ? card.back : card.front; }
function otherValueOf(card) { return card.orientation === 1 ? card.front : card.back; }

function combination(cards) {
    if (!cards.length) return null;
    const values = cards.map(valueOf);
    if (cards.length === 1) return { kind: 'single', length: 1, strength: values[0], values };
    const matching = values.every(value => value === values[0]);
    const sequence = values.every((value, index) => index === 0 || Math.abs(value - values[index - 1]) === 1) && new Set(values).size === values.length;
    if (!matching && !sequence) return null;
    return { kind: matching ? 'matching' : 'sequence', length: values.length, strength: matching ? values[0] : Math.min(...values), values };
}

function compareCombination(candidate, active) {
    if (!active) return 1;
    if (candidate.length !== active.length) return candidate.length > active.length ? 1 : -1;
    if (candidate.kind !== active.kind) return candidate.kind === 'matching' ? 1 : -1;
    if (candidate.strength !== active.strength) return candidate.strength > active.strength ? 1 : -1;
    return 0;
}

class ScoutEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId; this.random = random;
        this.players = (Array.isArray(players) ? players : []).map((player, index) => ({ id: player.id, name: player.name, seat: index + 1, hand: [], orientationSet: false, score: 0, captured: 0, scoutTokens: 0, scoutChips: 0, scoutShowAvailable: true, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.status = 'waiting'; this.phase = 'waiting'; this.round = 0; this.maxRounds = this.players.length; this.startPlayerIndex = 0; this.currentPlayerIndex = 0; this.activeSet = []; this.activeOwnerId = null; this.scoutPasses = 0; this.twoPlayerReserve = []; this.lastRound = null; this.roundHistory = []; this.actionLog = []; this.winner = null; this.winners = []; this.presentation = null; this.presentationSequence = 0; this.presentationEventSequence = 0;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '马戏星探已经开始或已经结束' };
        if (this.players.length < 2 || this.players.length > 5) return { success: false, message: '马戏星探需要 2–5 名玩家' };
        if (this.players.some(player => !player.id) || new Set(this.players.map(player => player.id)).size !== this.players.length) return { success: false, message: '玩家身份必须唯一且有效' };
        this.players.forEach(player => { player.score = 0; player.isOnline = true; });
        this.status = 'playing'; this.round = 1; this.maxRounds = this.players.length; this.startPlayerIndex = 0; this.twoPlayerReserve = []; this.lastRound = null; this.roundHistory = []; this.actionLog = []; this.winner = null; this.winners = []; this.presentation = null; this.presentationSequence = 0; this.presentationEventSequence = 0;
        this._startRound();
        return this._success('马戏星探开始');
    }

    _startRound() {
        let deck = buildDeck();
        // Official setup removes all cards containing 10 in a three-player
        // game, and removes only the 9/10 card in a four-player game.
        if (this.players.length === 2) {
            deck = deck.filter(card => !(card.front === 9 && card.back === 10));
            deck = this.round === 1 ? shuffle(deck, this.random) : this.twoPlayerReserve.slice();
        } else {
            if (this.players.length === 3) deck = deck.filter(card => card.front !== 10 && card.back !== 10);
            if (this.players.length === 4) deck = deck.filter(card => !(card.front === 9 && card.back === 10));
            deck = shuffle(deck, this.random);
        }
        const handSize = HAND_SIZES[this.players.length];
        this.players.forEach((player, index) => {
            player.hand = deck.splice(0, handSize).map(card => ({ ...card, orientation: 0 }));
            player.orientationSet = false; player.captured = 0; player.scoutTokens = 0; player.scoutChips = this.players.length === 2 ? 3 : 0; player.scoutShowAvailable = this.players.length !== 2;
        });
        if (this.players.length === 2 && this.round === 1) this.twoPlayerReserve = deck.slice();
        if (this.round === 1) {
            const markerHolder = this.players.findIndex(player => player.hand.some(card => (card.front === 1 && card.back === 2) || (card.front === 2 && card.back === 1)));
            this.startPlayerIndex = markerHolder >= 0 ? markerHolder : 0;
        }
        this.currentPlayerIndex = this.startPlayerIndex % this.players.length; this.activeSet = []; this.activeOwnerId = null; this.scoutPasses = 0; this.phase = 'orienting';
        this._log(`第${this.round}轮开始：请先决定整手牌的方向`);
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (this.phase === 'orienting' && action.kind === 'setOrientation') return this._setOrientation(player, action.orientation);
        if (this.phase !== 'turn' || this._currentPlayer()?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        // In the two-player variant a player must keep scouting until they
        // can show or run out of chips.  Once neither is possible, the round
        // ends immediately; do not leave the table waiting for a particular
        // client action kind.
        if (this.players.length === 2 && this.activeSet.length && player.scoutChips <= 0 && !this._hasBeatingShow(player)) return this._finishRound(this.activeOwnerId, 'unbeatable');
        if (action.kind === 'show') return this._show(player, action.cardIndices);
        if (action.kind === 'scout') return this._scout(player, action.edge, action.insertAt, action.orientation);
        if (action.kind === 'scoutShow') return this._scoutShow(player, action.edge, action.insertAt, action.orientation, action.cardIndices);
        return { success: false, message: '未知的马戏星探动作', state: this.getPlayerState(playerId) };
    }

    _setOrientation(player, orientation) {
        if (player.orientationSet || ![0, 1].includes(Number(orientation))) return { success: false, message: '请在本轮开始时选择整手牌方向', state: this.getPlayerState(player.id) };
        player.hand.forEach(card => { card.orientation = Number(orientation); }); player.orientationSet = true;
        const allLocked = this.players.every(item => item.orientationSet);
        this._startPresentation(player.id, 'setOrientation', { kind: 'orientationLocked', playerId: player.id, playerName: player.name, lockedCount: this.players.filter(item => item.orientationSet).length, totalPlayers: this.players.length, allLocked });
        if (allLocked) {
            this.phase = 'turn';
            this._appendPresentationEvent({ kind: 'showtimeStarted', round: this.round, starterId: this._currentPlayer().id, starterName: this._currentPlayer().name });
            this._log(`所有马戏团已决定方向，${this._currentPlayer().name} 先行动`);
        }
        this._finishPresentation();
        return this._success('手牌方向已锁定');
    }

    _normaliseIndices(indices) {
        if (!Array.isArray(indices) || !indices.length || !indices.every(Number.isInteger)) return null;
        const unique = [...new Set(indices)].sort((a, b) => a - b);
        if (unique.some((index, position) => index < 0 || index >= this._currentPlayer().hand.length || (position && index !== unique[position - 1] + 1))) return null;
        return unique;
    }

    _hasBeatingShow(player) {
        const activeCombo = combination(this.activeSet);
        for (let start = 0; start < player.hand.length; start += 1) for (let end = start; end < player.hand.length; end += 1) {
            const combo = combination(player.hand.slice(start, end + 1));
            if (combo && compareCombination(combo, activeCombo) > 0) return true;
        }
        return false;
    }

    _show(player, indices, suppressAdvance = false, appendToPresentation = false) {
        const chosenIndices = this._normaliseIndices(indices);
        if (!chosenIndices) return { success: false, message: '出牌必须是手牌中连续的一组', state: this.getPlayerState(player.id) };
        const chosen = chosenIndices.map(index => player.hand[index]);
        const combo = combination(chosen);
        if (!combo) return { success: false, message: '这组牌必须是同点数或连续数字', state: this.getPlayerState(player.id) };
        const activeCombo = combination(this.activeSet);
        if (compareCombination(combo, activeCombo) <= 0) return { success: false, message: '这组牌不够大，无法压过当前表演', state: this.getPlayerState(player.id) };
        const previousShow = this.activeSet.map(card => this._publicCard(card));
        const previousOwnerId = this.activeOwnerId;
        const previousOwnerName = this.playerMap[previousOwnerId]?.name || null;
        if (this.activeSet.length) player.captured += this.activeSet.length;
        player.hand = player.hand.filter((_, index) => !chosenIndices.includes(index));
        this.activeSet = chosen; this.activeOwnerId = player.id; this.scoutPasses = 0;
        if (!appendToPresentation) this._startPresentation(player.id, 'show');
        this._appendPresentationEvent({
            kind: 'showPerformed',
            actorId: player.id,
            actorName: player.name,
            previousOwnerId,
            previousOwnerName,
            previousShow,
            newShow: chosen.map(card => this._publicCard(card)),
            combination: clone(combo),
            capturedCount: previousShow.length,
            handRemaining: player.hand.length,
        });
        this._log(`${player.name} 表演了 ${combo.kind === 'matching' ? '同点数' : '连续'} ${combo.length} 张牌`);
        if (!player.hand.length) return this._finishRound(player.id, 'empty');
        if (!suppressAdvance) { this._nextPlayer(); this._finishPresentation(); return this._success('表演完成'); }
        return { success: true };
    }

    _applyScout(player, edge, insertAt, orientation) {
        if (!this.activeSet.length) return { success: false, message: '当前没有可以招募的表演牌', state: this.getPlayerState(player.id) };
        if (this.players.length === 2 && player.scoutChips <= 0) return { success: false, message: '本轮没有可用的招募筹码', state: this.getPlayerState(player.id) };
        if (!['left', 'right'].includes(edge)) return { success: false, message: '请选择从左侧或右侧招募', state: this.getPlayerState(player.id) };
        const position = Number(insertAt);
        if (!Number.isInteger(position) || position < 0 || position > player.hand.length) return { success: false, message: '请选择有效的插入位置', state: this.getPlayerState(player.id) };
        if (![0, 1].includes(Number(orientation))) return { success: false, message: '请选择招募牌方向', state: this.getPlayerState(player.id) };
        const activeBefore = this.activeSet.map(card => this._publicCard(card));
        const activeOwnerId = this.activeOwnerId;
        const activeOwner = this.playerMap[activeOwnerId] || null;
        const chipBefore = player.scoutChips;
        const ownerTokensBefore = activeOwner?.scoutTokens || 0;
        const card = edge === 'left' ? this.activeSet.shift() : this.activeSet.pop();
        card.orientation = Number(orientation); player.hand.splice(position, 0, card);
        if (this.players.length === 2) player.scoutChips -= 1;
        else if (this.activeOwnerId && this.activeOwnerId !== player.id) this.playerMap[this.activeOwnerId].scoutTokens += 1;
        this.scoutPasses += 1; this._log(`${player.name} 从${edge === 'left' ? '左侧' : '右侧'}招募了一个马戏成员`);
        return {
            success: true,
            event: {
                kind: 'cardScouted',
                actorId: player.id,
                actorName: player.name,
                edge,
                insertAt: position,
                card: this._publicCard(card),
                activeBefore,
                activeAfter: this.activeSet.map(item => this._publicCard(item)),
                activeOwnerId,
                activeOwnerName: activeOwner?.name || null,
                ownerTokenAwarded: Math.max(0, (activeOwner?.scoutTokens || 0) - ownerTokensBefore),
                scoutChipSpent: Math.max(0, chipBefore - player.scoutChips),
                handCount: player.hand.length,
            },
        };
    }

    _scout(player, edge, insertAt, orientation) {
        const result = this._applyScout(player, edge, insertAt, orientation); if (!result.success) return result;
        this._startPresentation(player.id, 'scout', result.event);
        if (this.players.length === 2) { this._finishPresentation(); return this._success('招募完成，你可以继续行动'); }
        if (!this.activeSet.length) { this.scoutPasses = 0; this._nextPlayer(); this._finishPresentation(); return this._success('招募完成，等待新的表演'); }
        if (this.scoutPasses >= this.players.length - 1) return this._finishRound(this.activeOwnerId, 'unbeatable');
        this._nextPlayer(); this._finishPresentation(); return this._success('招募完成');
    }

    _scoutShow(player, edge, insertAt, orientation, indices) {
        if (!player.scoutShowAvailable) return { success: false, message: '本轮的招募并表演机会已经使用', state: this.getPlayerState(player.id) };
        const handSnapshot = player.hand.slice(); const activeSnapshot = this.activeSet.slice(); const ownerSnapshot = this.activeOwnerId; const passSnapshot = this.scoutPasses; const scoutChipSnapshot = player.scoutChips; const ownerTokenSnapshot = ownerSnapshot && this.playerMap[ownerSnapshot] ? this.playerMap[ownerSnapshot].scoutTokens : null; const logLength = this.actionLog.length; const presentationSnapshot = clone(this.presentation);
        const result = this._applyScout(player, edge, insertAt, orientation); if (!result.success) return result;
        player.scoutShowAvailable = false;
        this._startPresentation(player.id, 'scoutShow', result.event);
        const shown = this._show(player, indices, true, true);
        if (!shown.success) {
            player.hand = handSnapshot; this.activeSet = activeSnapshot; this.activeOwnerId = ownerSnapshot; this.scoutPasses = passSnapshot; player.scoutChips = scoutChipSnapshot; player.scoutShowAvailable = true;
            if (ownerSnapshot && this.playerMap[ownerSnapshot]) this.playerMap[ownerSnapshot].scoutTokens = ownerTokenSnapshot;
            this.actionLog.length = logLength; this.presentation = presentationSnapshot;
            return { ...shown, state: this.getPlayerState(player.id) };
        }
        if (this.status === 'ended' || this.phase === 'orienting') return shown;
        if (!player.hand.length) return this._finishRound(player.id, 'empty');
        this._nextPlayer(); this._finishPresentation(); return this._success('招募并表演完成');
    }

    _finishRound(winnerId, reason) {
        const winner = this.playerMap[winnerId];
        if (!winner) return this._success('本轮结束');
        if (!this.presentation || this.presentation.resolved) this._startPresentation(winnerId, 'roundSettlement');
        const completedRound = this.round;
        const scores = this.players.map(player => {
            const capturedPoints = player.captured;
            const scoutTokenPoints = player.scoutTokens;
            const scoutChipPoints = this.players.length === 2 ? player.scoutChips : 0;
            const handPenalty = reason === 'unbeatable' && player.id === winnerId ? 0 : player.hand.length;
            const gained = capturedPoints + scoutTokenPoints + scoutChipPoints - handPenalty;
            return { id: player.id, name: player.name, seat: player.seat, capturedPoints, scoutTokenPoints, scoutChipPoints, handPenalty, gained, totalBefore: player.score, total: player.score + gained };
        });
        scores.forEach(item => { this.playerMap[item.id].score = item.total; });
        this.lastRound = { round: completedRound, winnerId, winnerName: winner.name, reason, activeShow: this.activeSet.map(card => this._publicCard(card)), scores: clone(scores) };
        this.roundHistory.push(clone(this.lastRound));
        this._appendPresentationEvent({ kind: 'roundSettlement', round: completedRound, winnerId, winnerName: winner.name, reason, activeShow: this.lastRound.activeShow, scores: clone(scores) });
        this._log(reason === 'empty' ? `${winner.name} 清空手牌，本轮结束` : `${winner.name} 的表演无人能压过，本轮结束`);
        if (this.round >= this.maxRounds) {
            const standings = this._standings();
            const maxScore = standings[0]?.score ?? 0; this.winners = this.players.filter(player => player.score === maxScore); this.winner = this.winners[0] || null; this.status = 'ended'; this.phase = 'ended';
            this._appendPresentationEvent({ kind: 'finalSettlement', standings, winnerIds: this.winners.map(player => player.id), roundHistory: this.roundHistory.map(entry => ({ round: entry.round, scores: entry.scores.map(score => ({ id: score.id, name: score.name, gained: score.gained, total: score.total })) })) });
            this._finishPresentation();
            this._log(`最终胜者：${this.winners.map(player => player.name).join('、')}`); return this._success('马戏星探结束');
        }
        this.round += 1; this.startPlayerIndex = (this.startPlayerIndex + 1) % this.players.length;
        const starter = this.players[this.startPlayerIndex];
        this._appendPresentationEvent({ kind: 'roundTransition', completedRound, nextRound: this.round, starterId: starter.id, starterName: starter.name });
        this._startRound();
        this._appendPresentationEvent({ kind: 'roundStarted', round: this.round, starterId: starter.id, starterName: starter.name, handCounts: this.players.map(player => ({ id: player.id, name: player.name, count: player.hand.length })) });
        this._finishPresentation();
        return this._success(`第${this.round}轮开始`);
    }

    _nextPlayer() { this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length; }
    _currentPlayer() { return this.players[this.currentPlayerIndex] || null; }
    _publicCard(card) { return { id: card.id, front: card.front, back: card.back, value: valueOf(card), otherValue: otherValueOf(card), orientation: card.orientation }; }
    getPublicState() { return { roomId: this.roomId, status: this.status, phase: this.phase, round: this.round, maxRounds: this.maxRounds, startPlayerId: this.players[this.startPlayerIndex]?.id || null, currentPlayerId: this._currentPlayer()?.id || null, currentPlayerName: this._currentPlayer()?.name || null, activeOwnerId: this.activeOwnerId, activeOwnerName: this.playerMap[this.activeOwnerId]?.name || null, activeSet: this.activeSet.map(card => this._publicCard(card)), lastRound: clone(this.lastRound), roundHistory: this.roundHistory.map(entry => ({ round: entry.round, winnerId: entry.winnerId, winnerName: entry.winnerName, reason: entry.reason, scores: entry.scores.map(score => ({ ...score })) })), presentation: clone(this.presentation), players: this.players.map(player => ({ id: player.id, name: player.name, seat: player.seat, handCount: player.hand.length, score: player.score, captured: player.captured, scoutTokens: player.scoutTokens, isCurrent: player.id === this._currentPlayer()?.id, orientationSet: player.orientationSet, isOnline: player.isOnline })), actionLog: this.actionLog.slice(-18), winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })) }; }
    getPlayerState(playerId) { const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myHand = player?.hand.map(card => ({ id: card.id, value: valueOf(card), otherValue: otherValueOf(card), orientation: card.orientation })) || []; state.myScoutShowAvailable = Boolean(player?.scoutShowAvailable); state.myScoutChips = player?.scoutChips || 0; state.availableActions = { canSetOrientation: Boolean(player && this.phase === 'orienting' && !player.orientationSet), canShow: Boolean(player && this.phase === 'turn' && this._currentPlayer()?.id === playerId), canScout: Boolean(player && this.phase === 'turn' && this._currentPlayer()?.id === playerId && this.activeSet.length && (this.players.length !== 2 || player.scoutChips > 0)), canScoutShow: Boolean(player && this.phase === 'turn' && this._currentPlayer()?.id === playerId && player.scoutShowAvailable && this.activeSet.length) }; return state; }
    handlePlayerLeave(playerId) { const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在' }; player.isOnline = false; if (this.status === 'playing' && this.players.filter(item => item.isOnline).length <= 1) { this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null; } this._log(`${player.name} 离开了马戏团`); return this._success(`${player.name} 已离开`); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    _standings() { return this.players.map(player => ({ id: player.id, name: player.name, seat: player.seat, score: player.score })).sort((left, right) => right.score - left.score || left.seat - right.seat); }
    _startPresentation(actorId, action, firstEvent) {
        this.presentation = { sequence: ++this.presentationSequence, actorId, action, resolved: false, events: [] };
        if (firstEvent) this._appendPresentationEvent(firstEvent);
    }
    _appendPresentationEvent(event) {
        if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system');
        this.presentation.events.push({ sequence: ++this.presentationEventSequence, ...clone(event) });
    }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null; }
}

module.exports = ScoutEngine;
module.exports.buildDeck = buildDeck;
module.exports.combination = combination;
module.exports.compareCombination = compareCombination;
module.exports.HAND_SIZES = HAND_SIZES;
