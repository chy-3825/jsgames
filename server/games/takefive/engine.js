const MAX_ROUNDS = 10;
const TARGET_SCORE = 66;
const PRO_MAX_PLAYERS = 6;

function bullheads(value) {
    if (value === 55) return 7;
    if (value % 11 === 0) return 5;
    if (value % 10 === 0) return 3;
    if (value % 5 === 0) return 2;
    return 1;
}

function buildDeck(size = 104) {
    return Array.from({ length: size }, (_, index) => {
        const value = index + 1;
        return { id: `takefive-${value}`, value, bullheads: bullheads(value) };
    });
}

class TakeFiveEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        if (random && typeof random === 'object') { options = random; random = Math.random; }
        this.roomId = roomId;
        this.random = random;
        this.options = options || {};
        this.variant = this.options.variant === 'pro' ? 'pro' : 'standard';
        this.targetScore = this.options.targetScore === null ? null : Number.isFinite(Number(this.options.targetScore)) && Number(this.options.targetScore) > 0 ? Math.floor(Number(this.options.targetScore)) : TARGET_SCORE;
        this.maxHands = Number.isFinite(Number(this.options.maxHands)) && Number(this.options.maxHands) > 0 ? Math.floor(Number(this.options.maxHands)) : null;
        if (this.targetScore === null && this.maxHands === null) this.maxHands = MAX_ROUNDS;
        this.players = players.map(player => ({ id: player.id, name: player.name, hand: [], score: 0, bullPile: [], roundScore: 0, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.deck = [];
        this.rows = [];
        this.selected = new Map();
        this.phase = 'waiting';
        this.status = 'waiting';
        this.round = 0;
        this.handNumber = 0;
        this.pendingRowChoice = null;
        this.resolutionOrder = [];
        this.resolutionIndex = 0;
        this.lastResolution = [];
        this.revealedCards = [];
        this.resolutionSequence = 0;
        this.resolutionEvent = null;
        this.handSettlementSequence = 0;
        this.handSettlement = null;
        this.draftPool = [];
        this.draftTurnIndex = 0;
        this.lastHand = null;
        this.actionLog = [];
        this.winner = null;
        this.winners = [];
    }

    start() {
        if (this.players.length < 2 || this.players.length > 10) return { success: false, message: '牛头王需要 2–10 名玩家' };
        if (this.variant === 'pro' && this.players.length > PRO_MAX_PLAYERS) return { success: false, message: '牛头王专业变体需要 2–6 名玩家' };
        this.players.forEach(player => { player.score = 0; player.bullPile = []; player.roundScore = 0; player.isOnline = true; });
        this.round = 1;
        this.handNumber = 1;
        this.status = 'playing';
        this.actionLog = [];
        this.lastResolution = [];
        this.lastHand = null;
        this.resolutionSequence = 0;
        this.resolutionEvent = null;
        this.handSettlementSequence = 0;
        this.handSettlement = null;
        this.winner = null;
        this.winners = [];
        this._dealRound();
        this.actionLog.push(this.variant === 'pro' ? '专业变体开始：请按顺序从公开牌中选取手牌' : '牌桌已摆好四行，请所有玩家同时选牌');
        return this._success('牛头王开始');
    }

    _dealRound() {
        this.lastResolution = [];
        this.revealedCards = [];
        this.pendingRowChoice = null;
        this.resolutionOrder = [];
        this.resolutionIndex = 0;
        this.selected.clear();
        if (this.variant === 'pro') {
            this.deck = [];
            this.rows = [];
            this.draftPool = this._shuffle(buildDeck(this.players.length * 10 + 4));
            this.draftTurnIndex = 0;
            this._activePlayers().forEach(player => { player.hand = []; player.bullPile = []; player.roundScore = 0; });
            this.phase = 'drafting';
            return;
        }
        this.deck = this._shuffle(buildDeck());
        this._activePlayers().forEach(player => { player.hand = Array.from({ length: 10 }, () => this._draw()); player.bullPile = []; player.roundScore = 0; });
        this.rows = Array.from({ length: 4 }, () => [this._draw()]);
        this.phase = 'selecting';
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.phase === 'drafting' && action.kind === 'draftCard') return this._draftCard(player, action.cardId);
        if (this.phase === 'selecting' && action.kind === 'selectCard') return this._selectCard(player, action.cardId);
        if (this.phase === 'choose_row' && action.kind === 'chooseRow') return this._chooseRow(player, action.rowIndex);
        return { success: false, message: '现在不能执行这个操作', state: this.getPlayerState(playerId) };
    }

    _draftCard(player, cardId) {
        const current = this.players[this.draftTurnIndex];
        if (current?.id !== player.id) return { success: false, message: `请等待${current?.name || '下一位玩家'}选牌`, state: this.getPlayerState(player.id) };
        const index = this.draftPool.findIndex(card => card.id === cardId);
        if (index === -1) return { success: false, message: '这张公开牌已被选走', state: this.getPlayerState(player.id) };
        if (this.draftPool.length === this.players.length * 10 + 4) {
            this.revealedCards = [];
            this.lastResolution = [];
            this.lastHand = null;
        }
        const [card] = this.draftPool.splice(index, 1);
        player.hand.push(card);
        this.actionLog.push(`${player.name} 从公开牌中选取了 ${card.value}`);
        if (this.draftPool.length === 4) {
            this.rows = this.draftPool.splice(0, 4).map(rowCard => [rowCard]);
            this.draftTurnIndex = 0;
            this.phase = 'selecting';
            this.actionLog.push('专业变体选牌完成，四张剩余牌成为牌行起点');
            return this._success('公开选牌完成，请所有玩家同时选牌');
        }
        this.draftTurnIndex = (this.draftTurnIndex + 1) % this.players.length;
        return this._success(`${player.name} 已选牌，轮到${this.players[this.draftTurnIndex].name}`);
    }

    _selectCard(player, cardId) {
        if (this.selected.has(player.id)) return { success: false, message: '你已经选过牌，可以等待其他玩家', state: this.getPlayerState(player.id) };
        const card = player.hand.find(item => item.id === cardId);
        if (!card) return { success: false, message: '这张牌不在你的手牌中', state: this.getPlayerState(player.id) };
        // 下一轮第一张暗牌锁定时，收起上轮的旧翻牌与文字摘要。
        // 独立的 resolutionEvent / handSettlement 仍保留编号，供客户端去重播放。
        if (this.selected.size === 0) {
            this.revealedCards = [];
            this.lastResolution = [];
            if (this.lastHand?.handNumber < this.handNumber) this.lastHand = null;
        }
        this.selected.set(player.id, card.id);
        this.actionLog.push(`${player.name} 已锁定一张牌`);
        if (this._activePlayers().every(item => this.selected.has(item.id))) return this._beginResolution();
        return this._success(`${player.name} 已锁定选牌`);
    }

    _beginResolution() {
        this.phase = 'resolving';
        const order = this._activePlayers().map(player => ({ player, card: player.hand.find(card => card.id === this.selected.get(player.id)) })).filter(item => item.card).sort((a, b) => a.card.value - b.card.value);
        this.lastResolution = [];
        this.resolutionOrder = order;
        this.revealedCards = order.map(item => ({ playerId: item.player.id, playerName: item.player.name, card: { ...item.card } }));
        this.resolutionIndex = 0;
        this.resolutionEvent = {
            resolutionId: ++this.resolutionSequence,
            handNumber: this.handNumber,
            round: this.round,
            initialRows: this.rows.map(row => row.map(card => this._publicCard(card))),
            revealedCards: this.revealedCards.map(item => ({ playerId: item.playerId, playerName: item.playerName, card: this._publicCard(item.card) })),
            steps: [],
            status: 'resolving',
            activePlayerId: order[0]?.player.id || null,
            activePlayerName: order[0]?.player.name || null,
            activeCard: this._publicCard(order[0]?.card),
            pendingRowChoice: null,
        };
        return this._continueResolution();
    }

    _continueResolution() {
        while (this.resolutionIndex < this.resolutionOrder.length) {
            const item = this.resolutionOrder[this.resolutionIndex];
            if (this.resolutionEvent) {
                this.resolutionEvent.status = 'resolving';
                this.resolutionEvent.activePlayerId = item.player.id;
                this.resolutionEvent.activePlayerName = item.player.name;
                this.resolutionEvent.activeCard = this._publicCard(item.card);
                this.resolutionEvent.pendingRowChoice = null;
            }
            item.player.hand = item.player.hand.filter(card => card.id !== item.card.id);
            const rowIndex = this._closestRow(item.card.value);
            if (rowIndex === -1) {
                this.pendingRowChoice = { playerId: item.player.id, card: item.card };
                this.phase = 'choose_row';
                if (this.resolutionEvent) {
                    this.resolutionEvent.status = 'waiting_choice';
                    this.resolutionEvent.pendingRowChoice = { playerId: item.player.id, playerName: item.player.name, card: this._publicCard(item.card) };
                }
                this.actionLog.push(`${item.player.name} 的 ${item.card.value} 小于所有行尾，请选择收取哪一行`);
                return this._success(`${item.player.name} 需要选择收取的一行`);
            }
            this._placeCard(item.player, item.card, rowIndex);
            this.resolutionIndex += 1;
        }
        return this._finishRound();
    }

    _chooseRow(player, rowIndex) {
        if (!this.pendingRowChoice || this.pendingRowChoice.playerId !== player.id) return { success: false, message: '还没轮到你选择收取哪一行', state: this.getPlayerState(player.id) };
        if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.rows.length) return { success: false, message: '请选择有效的牌行', state: this.getPlayerState(player.id) };
        const card = this.pendingRowChoice.card;
        const taken = this.rows[rowIndex].slice();
        this._collect(player, taken);
        this.rows[rowIndex] = [card];
        this.lastResolution.push({ playerId: player.id, playerName: player.name, card: { ...card }, rowIndex, took: taken.map(item => ({ ...item })) });
        this._recordResolutionStep(player, card, rowIndex, taken, 'choice');
        this.actionLog.push(`${player.name} 收走第 ${rowIndex + 1} 行的 ${taken.length} 张牌`);
        this.pendingRowChoice = null;
        this.resolutionIndex += 1;
        return this._continueResolution();
    }

    _placeCard(player, card, rowIndex) {
        const row = this.rows[rowIndex];
        if (row.length === 5) {
            this._collect(player, row);
            this.rows[rowIndex] = [card];
            this.lastResolution.push({ playerId: player.id, playerName: player.name, card: { ...card }, rowIndex, took: row.map(item => ({ ...item })) });
            this._recordResolutionStep(player, card, rowIndex, row, 'sixth');
            this.actionLog.push(`${player.name} 的 ${card.value} 成为第六张，收走第 ${rowIndex + 1} 行`);
            return;
        }
        row.push(card);
        this.lastResolution.push({ playerId: player.id, playerName: player.name, card: { ...card }, rowIndex, took: [] });
        this._recordResolutionStep(player, card, rowIndex, [], 'place');
        this.actionLog.push(`${player.name} 的 ${card.value} 接入第 ${rowIndex + 1} 行`);
    }

    _recordResolutionStep(player, card, rowIndex, taken, kind) {
        if (!this.resolutionEvent) return;
        this.resolutionEvent.steps.push({
            stepIndex: this.resolutionEvent.steps.length,
            playerId: player.id,
            playerName: player.name,
            card: this._publicCard(card),
            rowIndex,
            kind,
            took: taken.map(item => this._publicCard(item)),
            bullheads: taken.reduce((sum, item) => sum + item.bullheads, 0),
        });
    }

    _closestRow(value) {
        let chosen = -1;
        let difference = Infinity;
        for (let index = 0; index < this.rows.length; index += 1) {
            const last = this.rows[index][this.rows[index].length - 1];
            if (last.value < value && value - last.value < difference) { chosen = index; difference = value - last.value; }
        }
        return chosen;
    }

    _collect(player, cards) {
        player.bullPile.push(...cards.map(card => ({ ...card })));
        player.roundScore += cards.reduce((sum, item) => sum + item.bullheads, 0);
    }

    _settleHand() {
        const scores = this._activePlayers().map(player => {
            const penalty = player.roundScore;
            player.score += penalty;
            const result = { id: player.id, name: player.name, penalty, total: player.score, cards: player.bullPile.length };
            player.bullPile = [];
            player.roundScore = 0;
            return result;
        });
        this.lastHand = { handNumber: this.handNumber, scores };
        this.handSettlement = {
            settlementId: ++this.handSettlementSequence,
            handNumber: this.handNumber,
            scores: scores.map(score => ({ ...score })),
            ended: false,
            winners: [],
            targetScore: this.targetScore,
        };
        return scores;
    }

    _finishRound() {
        if (this.resolutionEvent) {
            this.resolutionEvent.status = 'complete';
            this.resolutionEvent.activePlayerId = null;
            this.resolutionEvent.activePlayerName = null;
            this.resolutionEvent.activeCard = null;
            this.resolutionEvent.pendingRowChoice = null;
        }
        if (this.round >= MAX_ROUNDS) {
            this._settleHand();
            const activePlayers = this._activePlayers();
            const reachedTarget = this.targetScore !== null && activePlayers.filter(player => player.score >= this.targetScore);
            const reachedHandLimit = this.maxHands !== null && this.handNumber >= this.maxHands;
            if (reachedTarget?.length || reachedHandLimit) {
                const bestScore = Math.min(...activePlayers.map(player => player.score));
                this.winners = activePlayers.filter(player => player.score === bestScore);
                this.winner = this.winners[0] || null;
                this.status = 'ended'; this.phase = 'ended';
                if (this.handSettlement) {
                    this.handSettlement.ended = true;
                    this.handSettlement.winners = this.winners.map(player => ({ id: player.id, name: player.name, score: player.score }));
                    this.handSettlement.triggeredBy = Array.isArray(reachedTarget) ? reachedTarget.map(player => ({ id: player.id, name: player.name, score: player.score })) : [];
                }
                const winnerNames = this.winners.map(player => player.name).join('、');
                this.actionLog.push(this.winners.length > 1
                    ? `第 ${this.handNumber} 手结束；${winnerNames} 以 ${bestScore} 牛头并列获胜`
                    : reachedTarget?.length
                        ? `第 ${this.handNumber} 手结束；${reachedTarget.map(player => player.name).join('、')} 累计达到 ${this.targetScore} 牛头，${winnerNames} 以最低分获胜`
                        : `第 ${this.handNumber} 手结束；达到预设手数，${winnerNames} 以最低分获胜`);
                return this._success(reachedTarget?.length ? '本手结算后达到结束分数，本局结束' : '完成预设手数，本局结束');
            }
            this.handNumber += 1;
            this.round = 1;
            this._dealRound();
            this.actionLog.push(this.variant === 'pro' ? `第 ${this.handNumber} 手开始：重新进行公开选牌` : `第 ${this.handNumber} 手开始：所有玩家继续累计牛头分`);
            return this._success(`第 ${this.handNumber} 手开始`);
        }
        this.round += 1; this.phase = 'selecting'; this.selected.clear();
        if (this.resolutionEvent) this.resolutionEvent.nextRound = this.round;
        this.actionLog.push(`第 ${this.round} 轮，请同时选牌`);
        return this._success(`第 ${this.round} 轮开始`);
    }

    _draw() { return this.deck.pop(); }
    _shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(this.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
    _activePlayers() { return this.players.filter(player => player.isOnline); }
    _publicCard(card) { return card ? { id: card.id, value: card.value, bullheads: card.bullheads } : null; }

    getPublicState() {
        return { roomId: this.roomId, status: this.status, phase: this.phase, variant: this.variant, round: this.round, maxRounds: MAX_ROUNDS, handNumber: this.handNumber, maxHands: this.maxHands, targetScore: this.targetScore, deckCount: this.phase === 'drafting' ? this.draftPool.length : this.deck.length, selectedCount: this.selected.size, playerCount: this._activePlayers().length, rows: this.rows.map(row => row.map(card => this._publicCard(card))), revealedCards: this.revealedCards.map(item => ({ playerId: item.playerId, playerName: item.playerName, card: this._publicCard(item.card) })), resolutionEvent: this.resolutionEvent ? JSON.parse(JSON.stringify(this.resolutionEvent)) : null, handSettlement: this.handSettlement ? JSON.parse(JSON.stringify(this.handSettlement)) : null, draft: this.phase === 'drafting' ? { cards: this.draftPool.map(card => this._publicCard(card)), currentPlayerId: this.players[this.draftTurnIndex]?.id || null, currentPlayerName: this.players[this.draftTurnIndex]?.name || null } : null, pendingRowChoice: this.pendingRowChoice ? { playerId: this.pendingRowChoice.playerId, playerName: this.playerMap[this.pendingRowChoice.playerId]?.name, card: this._publicCard(this.pendingRowChoice.card) } : null, lastResolution: this.lastResolution.map(item => ({ ...item, card: this._publicCard(item.card), took: item.took.map(card => this._publicCard(card)) })), lastHand: this.lastHand, players: this.players.map(player => ({ id: player.id, name: player.name, score: player.score, bullPileCount: player.bullPile.length, handCount: player.hand.length, isOnline: player.isOnline, hasSelected: this.selected.has(player.id) })), actionLog: this.actionLog.slice(-16), winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })) };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId];
        state.myId = playerId; state.myHand = player?.hand.map(card => this._publicCard(card)) || []; state.myRoundScore = player?.roundScore || 0; state.myBullPileCount = player?.bullPile.length || 0; state.mySelectedCardId = this.selected.get(playerId) || null; state.myIsChoosingRow = this.pendingRowChoice?.playerId === playerId;
        state.availableActions = { canDraft: Boolean(player?.isOnline && this.phase === 'drafting' && this.players[this.draftTurnIndex]?.id === playerId), canSelect: Boolean(player?.isOnline && this.phase === 'selecting' && !this.selected.has(playerId)), canChooseRow: state.myIsChoosingRow };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        player.isOnline = false; this.selected.delete(playerId);
        if (this._activePlayers().length <= 1 && this.status === 'playing') { this.status = 'ended'; this.phase = 'ended'; this.winner = this._activePlayers()[0] || null; this.winners = this.winner ? [this.winner] : []; }
        else if (this.phase === 'selecting' && this._activePlayers().every(item => this.selected.has(item.id))) this._beginResolution();
        else if (this.phase === 'choose_row' && this.pendingRowChoice?.playerId === playerId) { this.rows[0] = [this.pendingRowChoice.card]; this.pendingRowChoice = null; this._finishRound(); }
        this.actionLog.push(`${player.name} 离开了牌局`);
        return this._success(`${player.name} 已离开`);
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, score: player.score })) }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = TakeFiveEngine;
module.exports.buildDeck = buildDeck;
module.exports.bullheads = bullheads;
module.exports.MAX_ROUNDS = MAX_ROUNDS;
module.exports.TARGET_SCORE = TARGET_SCORE;
