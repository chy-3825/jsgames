const IDENTITIES = {
    villager: { id: 'villager', name: '镇民', faction: 'town', description: '从未持有女巫审判牌的玩家。' },
    sheriff: { id: 'sheriff', name: '警长', faction: 'town', description: '当前持有警长审判牌，夜晚可以放置法槌保护一名玩家。' },
    witch: { id: 'witch', name: '女巫', faction: 'witch', description: '曾经持有过女巫审判牌的玩家，夜晚共同选择击杀目标。' },
};

const CARD_NAMES = {
    accusation: '指控', evidence: '证据', witness: '目击者', alibi: '不在场证明', arson: '纵火',
    curse: '诅咒', robbery: '抢劫', scapegoat: '替罪羊', stocks: '枷锁', asylum: '避难所',
    matchmaker: '红娘', piety: '虔诚', blackcat: '黑猫', conspiracy: '阴谋', night: '夜幕',
};

const TRIAL_SETUP = {
    4: { town: 18, witch: 1, constable: 1, cards: 5 }, 5: { town: 23, witch: 1, constable: 1, cards: 5 },
    6: { town: 27, witch: 2, constable: 1, cards: 5 }, 7: { town: 32, witch: 2, constable: 1, cards: 5 },
    8: { town: 29, witch: 2, constable: 1, cards: 4 }, 9: { town: 33, witch: 2, constable: 1, cards: 4 },
    10: { town: 27, witch: 2, constable: 1, cards: 3 }, 11: { town: 30, witch: 2, constable: 1, cards: 3 },
    12: { town: 33, witch: 2, constable: 1, cards: 3 },
};

// Salem 1692 标准版 15 张 Town Hall 角色牌。Deluxe 的 5 张特殊 Trial 牌不在本版本范围内。
const TOWN_HALLS = [
    ['mary-warren', 'Mary Warren', '免疫红娘和黑猫的效果。'],
    ['ann-putnam', 'Ann Putnam', '你打出本次导致揭示的最后一张指控后，可先摸两张牌。'],
    ['giles-corey', 'Giles Corey', '回合摸到两张普通指控牌时公开并额外摸一张。'],
    ['abigail-williams', 'Abigail Williams', '你打出导致揭示的最后一张指控后，可弃掉自己面前全部指控。'],
    ['will-griggs', 'Will Griggs', '你可以把不在场证明当作目击者（7 点指控）使用。'],
    ['sarah-good', 'Sarah Good', '对你使用抢劫或纵火没有效果，但牌仍会弃置。'],
    ['john-proctor', 'John Proctor', '玩家死亡时，获得其手牌和蓝色牌。'],
    ['samuel-parris', 'Samuel Parris', '每局两次可以从弃牌堆摸两张牌，不能摸黑牌。'],
    ['rebecca-nurse', 'Rebecca Nurse', '其他玩家因指控揭示审判牌时，你摸一张牌。'],
    ['martha-corey', 'Martha Corey', '复制你右侧第一位存活玩家的 Town Hall 能力。'],
    ['thomas-danforth', 'Thomas Danforth', '你对同一目标打出第 6 或第 7 点指控时即可揭示。'],
    ['william-phips', 'William Phips', '每局一次可以不揭示自己的审判牌而进行认罪。'],
    ['george-burroughs', 'George Burroughs', '你需要累计 8 点指控才会揭示审判牌。'],
    ['tituba', 'Tituba', '每局一次，在摸牌前可以重新排列牌库，并继续本回合摸牌。'],
    ['cotton-mather', 'Cotton Mather', '对你的证据牌只计 1 点指控。'],
].map(([id, name, description]) => ({ id, name, description }));

// 标准版 59 张 Salem 牌（黑牌在触发时立即结算，Black Cat 在黎明先放置）。
const CARD_DEFS = [
    ['accusation', 'red', 35, 1], ['evidence', 'red', 5, 3], ['witness', 'red', 1, 7],
    ['alibi', 'green', 3], ['arson', 'green', 1], ['curse', 'green', 1], ['robbery', 'green', 1],
    ['scapegoat', 'blue', 2], ['stocks', 'blue', 3], ['asylum', 'blue', 1], ['matchmaker', 'blue', 2], ['piety', 'blue', 1],
];

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

function cardSummary(card) { return { id: card.id, kind: card.kind, name: card.name, color: card.color, value: card.value || 0 }; }

class WitchTownEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId; this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map((player, index) => ({
            id: player.id, name: player.name, seat: index + 1, identity: null, townHall: null,
            townHallUsed: {}, trialCards: [], everWitch: false, everConstable: false, health: 3,
            redAccusations: 0, redCards: [], blueCards: [], eliminated: false, revealed: false,
            confessed: false, hand: [], exposedHandCards: [], isOnline: true, lastInfo: null,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.hostId = this.players[0]?.id || null; this.status = 'waiting'; this.phase = 'day'; this.day = 1; this.night = 0;
        this.totalWitches = 0;
        this.currentTurnIndex = 0; this.currentTurnId = null; this.deck = []; this.discard = [];
        this.blackCatCard = null; this.blackCatOwnerId = null; this.dawnVotes = {};
        this.currentConspiracy = null; this.dossierReview = null;
        this.nightStep = null; this.nightActions = { kills: {}, protect: null, confessions: {} };
        this.pendingDraw = null; this.dayTurn = null;
        this.lastNightDeaths = []; this.lastTrialReveal = null; this.trialRevealSequence = 0;
        this.revealedWitchCount = 0; this.winner = null; this.judgeMessage = '等待开始'; this.actionLog = [];
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        const setup = TRIAL_SETUP[this.players.length];
        if (!setup) return { success: false, message: '猎巫镇官方基础规则支持 4–12 名玩家' };
        const trialCards = [];
        this.totalWitches = setup.witch;
        for (let index = 0; index < setup.town; index += 1) trialCards.push({ type: 'town' });
        for (let index = 0; index < setup.witch; index += 1) trialCards.push({ type: 'witch' });
        trialCards.push({ type: 'constable' });
        const halls = shuffle(TOWN_HALLS, this.random).slice(0, this.players.length);
        const shuffledTrialCards = shuffle(trialCards, this.random);
        this.players.forEach((player, index) => {
            player.trialCards = shuffledTrialCards.slice(index * setup.cards, (index + 1) * setup.cards).map((card, cardIndex) => ({ id: `tryal-${index + 1}-${cardIndex + 1}`, type: card.type, revealed: false }));
            player.townHall = halls[index]; player.townHallUsed = {}; player.everWitch = player.trialCards.some(card => card.type === 'witch');
            player.everConstable = player.trialCards.some(card => card.type === 'constable'); player.identity = this._identityFor(player);
            player.health = 3; player.redAccusations = 0; player.redCards = []; player.blueCards = []; player.eliminated = false; player.revealed = false; player.confessed = false; player.hand = []; player.exposedHandCards = []; player.lastInfo = null;
        });
        const deck = [];
        for (const [kind, color, count, value] of CARD_DEFS) for (let index = 0; index < count; index += 1) deck.push({ id: `salem-${kind}-${index + 1}`, kind, name: CARD_NAMES[kind], color, value: value || 0 });
        const conspiracy = { id: 'salem-conspiracy', kind: 'conspiracy', name: CARD_NAMES.conspiracy, color: 'black' };
        const night = { id: 'salem-night', kind: 'night', name: CARD_NAMES.night, color: 'black' };
        this.blackCatCard = { id: 'salem-black-cat', kind: 'blackcat', name: CARD_NAMES.blackcat, color: 'blue' };
        this.deck = shuffle(deck, this.random);
        this.players.forEach(player => { player.hand = this._drawRaw(3); });
        this.deck = shuffle(this.deck.concat(conspiracy), this.random);
        // draw 使用 pop()，因此 unshift 才是规则中的“牌库底部”。
        this.deck.unshift(night);
        this.status = 'playing'; this.day = 1; this.night = 0; this.currentTurnId = null; this.currentTurnIndex = 0; this.dayTurn = null;
        this.dawnVotes = {}; this.blackCatOwnerId = null; this.currentConspiracy = null; this.pendingDraw = null; this.winner = null; this.revealedWitchCount = 0;
        this.lastNightDeaths = []; this.lastTrialReveal = null; this.trialRevealSequence = 0; this.nightStep = null;
        this.actionLog = ['审判档案与镇议会角色已经送达，请各自秘密核对'];
        this._startDossierReview('opening');
        return this._success('审判档案已经送达');
    }

    _drawRaw(count) { const cards = []; while (cards.length < count && this.deck.length) cards.push(this.deck.pop()); return cards; }
    _identityFor(player) { return this._isWitch(player) ? 'witch' : this._isConstable(player) ? 'sheriff' : 'villager'; }
    _isWitch(player) { return Boolean(player?.everWitch || player?.trialCards?.some(card => card.type === 'witch')); }
    _isConstable(player) { return Boolean(player?.everConstable && player?.trialCards?.some(card => card.type === 'constable' && !card.revealed)); }
    _refreshAlignment(player) { if (player.trialCards.some(card => card.type === 'witch')) player.everWitch = true; player.everConstable = player.trialCards.some(card => card.type === 'constable' && !card.revealed); player.identity = this._identityFor(player); }
    _effectiveHall(player, seen = new Set()) {
        if (!player?.townHall || seen.has(player.id)) return player?.townHall || null;
        if (player.townHall.id !== 'martha-corey') return player.townHall;
        seen.add(player.id);
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const next = this.players[(player.seat - 1 + offset) % this.players.length];
            if (next && !next.eliminated && next.isOnline) return this._effectiveHall(next, seen);
        }
        return player.townHall;
    }
    _hasHall(player, id) { return this._effectiveHall(player)?.id === id; }
    _alive() { return this.players.filter(player => !player.eliminated && player.isOnline); }
    _validTarget(targetId, allowSelf, actorId) { const target = this.playerMap[targetId]; return target && !target.eliminated && target.isOnline && (allowSelf || target.id !== actorId) ? target : null; }
    _hasBlue(player, kind) { return player.blueCards.some(card => card.kind === kind); }
    _syncHealth(player) { player.health = Math.max(0, 3 - Math.min(3, Math.floor(player.redAccusations / 3))); }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线', state: this.getPlayerState(playerId) };
        if (this.phase === 'dossier_review') return this._dossierAction(player, action);
        if (this.phase === 'dawn') return this._dawnAction(player, action);
        if (this.phase === 'conspiracy_reveal' || this.phase === 'conspiracy') return this._conspiracyAction(player, action);
        if (this.phase === 'night') return this._nightAction(player, action);
        if (this.phase === 'day') return this._dayAction(player, action);
        return { success: false, message: '当前阶段不能操作', state: this.getPlayerState(player.id) };
    }

    _startDossierReview(reason, resume = null) {
        this.phase = 'dossier_review';
        this.dossierReview = { reason, confirmations: {}, resume };
        this.currentTurnId = null;
        this.judgeMessage = reason === 'opening'
            ? '请秘密打开审判档案。所有玩家确认完毕后，塞勒姆的第一场审判才会开始。'
            : '审判牌已经易手。请重新核对完整档案，确认自己现在的身份与职责。';
    }

    _dossierAction(player, action) {
        if (action.kind !== 'confirmDossier') return { success: false, message: '请先核对自己的审判档案', state: this.getPlayerState(player.id) };
        if (player.eliminated) return { success: false, message: '出局玩家无需再次核对档案', state: this.getPlayerState(player.id) };
        if (this.dossierReview?.confirmations[player.id]) return { success: false, message: '你已经确认过这份档案', state: this.getPlayerState(player.id) };
        this.dossierReview.confirmations[player.id] = true;
        const waiting = this._alive().filter(item => !this.dossierReview.confirmations[item.id]);
        if (waiting.length) return this._success('档案已封存，等待其他玩家核对');
        return this._completeDossierReview();
    }

    _completeDossierReview() {
        const review = this.dossierReview;
        if (!review) return this._success('档案核对已经结束');
        this.dossierReview = null;
        if (review.reason === 'opening') {
            this.phase = 'dawn';
            this.judgeMessage = '夜色尚未散去。女巫阵营正在决定黑猫的归属。';
            this._log('所有玩家均已核对审判档案');
            return this._success('所有档案核对完毕');
        }
        this._resumeAfterConspiracy(review.resume || {});
        return this._success('所有玩家均已核对新的审判档案');
    }

    _dawnAction(player, action) {
        if (!this._isWitch(player)) return { success: false, message: '只有女巫可以参与黎明选择', state: this.getPlayerState(player.id) };
        const target = this._validTarget(action.targetId, true, player.id);
        if (!target) return { success: false, message: '请选择黑猫持有者', state: this.getPlayerState(player.id) };
        this.dawnVotes[player.id] = target.id;
        const witches = this.players.filter(item => this._isWitch(item) && item.isOnline && !item.eliminated);
        if (witches.every(item => this.dawnVotes[item.id])) {
            const counts = new Map(); witches.forEach(item => counts.set(this.dawnVotes[item.id], (counts.get(this.dawnVotes[item.id]) || 0) + 1));
            const winner = [...counts.entries()].sort((a, b) => b[1] - a[1] || this.playerMap[a[0]].seat - this.playerMap[b[0]].seat)[0]?.[0];
            const owner = this.playerMap[winner];
            if (owner) { owner.blueCards.push(this.blackCatCard); this.blackCatOwnerId = owner.id; }
            this._beginDay(owner?.id || this.players[0]?.id, true);
            this._log(`${owner?.name || '一名玩家'} 获得黑猫并成为首位行动者`);
            return this._success('黎明完成，黑猫已放置');
        }
        return this._success('已记录女巫的黑猫选择');
    }

    _beginDay(startId, first = false) {
        this.phase = 'day';
        let index = Math.max(0, this.players.findIndex(player => player.id === startId));
        for (let offset = 0; offset < this.players.length; offset += 1) {
            const candidateIndex = (index + offset) % this.players.length;
            const candidate = this.players[candidateIndex];
            if (candidate && !candidate.eliminated && candidate.isOnline) { index = candidateIndex; break; }
        }
        this.currentTurnIndex = index; this.currentTurnId = this.players[index]?.id || null; this.dayTurn = { playerId: this.currentTurnId, played: false, drew: false };
        const starter = this.playerMap[this.currentTurnId];
        this.judgeMessage = first ? `黑猫持有者 ${starter?.name || ''} 先手。每回合只能摸两张牌或对其他玩家打出至少一张牌。` : `第 ${this.day} 天开始。轮到 ${starter?.name || '下一位玩家'}。`;
    }

    _dayAction(player, action) {
        if (action.kind === 'advancePhase') return { success: false, message: '白天由行动牌自然推进；抽到夜幕牌时会自动进入夜晚', state: this.getPlayerState(player.id) };
        if (player.id !== this.currentTurnId || player.eliminated) return { success: false, message: '还没轮到你', state: this.getPlayerState(player.id) };
        if (action.kind === 'drawCards') { if (this.dayTurn?.drew || this.dayTurn?.played) return { success: false, message: '本回合已经选择行动', state: this.getPlayerState(player.id) }; this.dayTurn.drew = true; this._drawForPlayer(player, 2, { endTurn: true }); return this._success('摸两张牌并结束行动'); }
        if (action.kind === 'drawDiscard') return this._drawDiscard(player);
        if (action.kind === 'reorderDeck') return this._reorderDeck(player, action.order);
        if (action.kind === 'playCard') {
            if (this.dayTurn?.drew) return { success: false, message: '本回合已经选择摸牌', state: this.getPlayerState(player.id) };
            const result = this._playCard(player, action);
            if (result.success && this.dayTurn && this.currentTurnId === player.id) this.dayTurn.played = true;
            return result;
        }
        if (action.kind === 'confess') return this._confess(player, action.trialId);
        if (action.kind === 'endTurn') { if (!this.dayTurn?.played) return { success: false, message: '白天必须摸两张牌，或至少打出一张牌后才能结束行动', state: this.getPlayerState(player.id) }; this._nextTurn(); return this._success('行动结束'); }
        return { success: false, message: '未知的白天动作', state: this.getPlayerState(player.id) };
    }

    _drawForPlayer(player, count, options = {}) {
        let drawn = 0;
        const drawnCards = [];
        while (drawn < count && this.deck.length && this.status === 'playing') {
            const card = this.deck.pop();
            if (card.kind === 'conspiracy' || card.kind === 'night') {
                if (card.kind === 'conspiracy') this.discard.push(card);
                this.pendingDraw = { playerId: player.id, remaining: count - drawn - 1, endTurn: Boolean(options.endTurn), resumeTurnId: this.currentTurnId, resumeTurnIndex: this.currentTurnIndex };
                if (card.kind === 'conspiracy') this._startConspiracy(player.id); else this._startNight();
                return;
            }
            // In a two-player endgame blue cards are set aside rather than
            // carrying over to the next draw.  With the online UI the player
            // still gets a complete hand count, but the card is not reused.
            if (this._alive().length <= 2 && ['scapegoat', 'stocks', 'asylum', 'matchmaker', 'piety', 'blackcat'].includes(card.kind)) {
                this.discard.push(card);
                continue;
            }
            player.hand.push(card); drawnCards.push(card); drawn += 1;
        }
        if (this._hasHall(player, 'giles-corey') && drawnCards.length === 2 && drawnCards.every(card => card.kind === 'accusation')) {
            this._log(`${player.name} 的 Giles Corey 能力触发，公开两张指控并额外摸一张`);
            player.exposedHandCards.push(...drawnCards.map(cardSummary));
            this._drawForPlayer(player, 1, { endTurn: Boolean(options.endTurn) });
        }
        if (options.endTurn && this.phase === 'day' && this.currentTurnId === player.id && !this.pendingDraw) this._nextTurn();
    }

    _resumePendingDraw() {
        const pending = this.pendingDraw;
        if (!pending) return;
        this.pendingDraw = null;
        const player = this.playerMap[pending.playerId];
        if (!player || player.eliminated || this.status !== 'playing') return;
        this.currentTurnIndex = pending.resumeTurnIndex ?? this.players.findIndex(item => item.id === pending.resumeTurnId);
        if (this.currentTurnIndex < 0) this.currentTurnIndex = 0;
        this.currentTurnId = pending.resumeTurnId || this.players[this.currentTurnIndex]?.id || player.id;
        if (pending.remaining > 0) this._drawForPlayer(player, pending.remaining, { endTurn: pending.endTurn });
        else if (pending.endTurn && this.phase === 'day' && this.currentTurnId === player.id) this._nextTurn();
    }

    _drawDiscard(player) {
        if (!this._hasHall(player, 'samuel-parris') || (player.townHallUsed.drawDiscard || 0) >= 2) return { success: false, message: 'Samuel Parris 的弃牌堆能力已经用完', state: this.getPlayerState(player.id) };
        const cards = []; while (cards.length < 2 && this.discard.length) { const index = this.discard.findIndex(card => !['conspiracy', 'night'].includes(card.kind)); if (index < 0) break; cards.push(this.discard.splice(index, 1)[0]); }
        player.hand.push(...cards); player.townHallUsed.drawDiscard = (player.townHallUsed.drawDiscard || 0) + 1; if (this.dayTurn) this.dayTurn.drew = true; this._nextTurn(); return this._success('从弃牌堆摸牌并结束行动');
    }

    _reorderDeck(player, order) {
        if (!this._hasHall(player, 'tituba') || player.townHallUsed.reorder) return { success: false, message: 'Tituba 的牌库重排能力已经用完', state: this.getPlayerState(player.id) };
        if (!Array.isArray(order) || order.length !== this.deck.length || new Set(order).size !== this.deck.length || order.some(id => !this.deck.some(card => card.id === id))) return { success: false, message: '牌库排列参数无效', state: this.getPlayerState(player.id) };
        const byId = Object.fromEntries(this.deck.map(card => [card.id, card])); this.deck = order.map(id => byId[id]); player.townHallUsed.reorder = true; this._log(`${player.name} 使用 Tituba 重新排列牌库`); return this._success('牌库已重排，可继续摸牌');
    }

    _playCard(player, action) {
        const index = player.hand.findIndex(item => item.id === action.cardId); const card = player.hand[index];
        if (!card) return { success: false, message: '请选择自己的手牌', state: this.getPlayerState(player.id) };
        // 兼容旧测试/旧客户端曾使用的 `accuse` 动作牌命名，规则上统一为 Accusation。
        if (card.kind === 'accuse') { card.kind = 'accusation'; card.name = CARD_NAMES.accusation; card.color = 'red'; card.value = 1; }
        const target = this._validTarget(action.targetId, false, player.id);
        if (['robbery', 'scapegoat'].includes(card.kind) && (!target || !this._validTarget(action.targetId2, false, player.id) || action.targetId2 === action.targetId)) return { success: false, message: '这张牌需要两名不同的其他玩家', state: this.getPlayerState(player.id) };
        if (!['robbery', 'scapegoat'].includes(card.kind) && !target) return { success: false, message: '请选择一名其他玩家', state: this.getPlayerState(player.id) };
        player.hand.splice(index, 1); player.exposedHandCards = player.exposedHandCards.filter(item => item.id !== card.id);
        const discardImmediately = ['alibi', 'arson', 'curse', 'robbery'].includes(card.kind);
        if (discardImmediately) this.discard.push(card);
        switch (card.kind) {
            case 'accusation': case 'evidence': case 'witness': this._playRed(player, target, card, action); break;
            case 'alibi': this._playAlibi(player, target); break;
            case 'arson': if (!this._hasHall(target, 'sarah-good')) this.discard.push(...target.hand.splice(0)); break;
            case 'curse': this._playCurse(target, action.blueCardId); break;
            case 'robbery': this._playRobbery(target, this.playerMap[action.targetId2]); break;
            case 'scapegoat': this._playScapegoat(target, this.playerMap[action.targetId2], card); break;
            case 'stocks': case 'asylum': case 'piety': this._attachBlue(target, card); break;
            case 'matchmaker': this._playMatchmaker(target, card); break;
            case 'blackcat': this._attachBlue(target, card); this.blackCatOwnerId = target.id; break;
            default: player.hand.push(card); return { success: false, message: '这张牌不能在白天打出', state: this.getPlayerState(player.id) };
        }
        this._checkWin(); return this._success(`${card.name} 已结算`);
    }

    _redThreshold(target) { return this._hasHall(target, 'george-burroughs') ? 8 : 7; }
    _playRed(player, target, card, action) {
        if (this._hasBlue(target, 'piety')) { this.discard.push(card); this._log(`${target.name} 的虔诚使红牌无效`); return; }
        const effective = card.kind === 'evidence' && this._hasHall(target, 'cotton-mather') ? 1 : card.value;
        target.redCards.push({ ...card, value: effective }); target.redAccusations += effective; this._syncHealth(target);
        const thomasThreshold = this._hasHall(player, 'thomas-danforth') && this._hasHall(target, 'george-burroughs') ? 7 : 6;
        const shouldReveal = target.redAccusations >= this._redThreshold(target) || (this._hasHall(player, 'thomas-danforth') && target.redAccusations >= thomasThreshold);
        if (shouldReveal) {
            if (this._hasHall(player, 'ann-putnam')) this._drawForPlayer(player, 2);
            this._revealTrial(target, action.trialId, 'accusation');
            this._discardRed(target);
            if (this._hasHall(player, 'abigail-williams')) this._discardRed(player);
        }
    }
    _playAlibi(player, target) {
        if (this._hasHall(player, 'will-griggs')) { target.redAccusations += 7; target.redCards.push({ id: `alibi-witness-${Date.now()}`, kind: 'witness', name: '不在场证明（目击者）', color: 'red', value: 7 }); this._revealTrial(target, null, 'accusation'); this._discardRed(target); return; }
        const removed = target.redCards.splice(Math.max(0, target.redCards.length - 3), 3);
        this.discard.push(...removed);
        target.redAccusations = target.redCards.reduce((sum, item) => sum + (item.value || 0), 0); this._syncHealth(target);
    }
    _playCurse(target, blueCardId) { const index = target.blueCards.findIndex(card => !blueCardId || card.id === blueCardId); if (index >= 0) { const removed = target.blueCards.splice(index, 1)[0]; this.discard.push(removed); if (removed.kind === 'blackcat' && this.blackCatOwnerId === target.id) this.blackCatOwnerId = null; } }
    _playRobbery(from, to) { if (this._hasHall(from, 'sarah-good')) return; to.hand.push(...from.hand.splice(0)); }
    _playScapegoat(from, to, card) {
        to.redCards.push(...from.redCards.splice(0));
        to.redAccusations = to.redCards.reduce((sum, item) => sum + (item.value || 0), 0);
        const movedBlue = from.blueCards.splice(0);
        to.blueCards.push(...movedBlue);
        if (this.blackCatOwnerId === from.id) this.blackCatOwnerId = to.id;
        const matchmakers = to.blueCards.filter(item => item.kind === 'matchmaker');
        if (matchmakers.length > 1) {
            to.blueCards = to.blueCards.filter(item => item.kind !== 'matchmaker');
            this.discard.push(...matchmakers);
        }
        // Scapegoat is a one-shot transfer card; it is not itself a persistent
        // attachment (the moved blue cards are the persistent state).
        if (card) this.discard.push(card);
        this._syncHealth(to); this._syncHealth(from);
    }
    _attachBlue(target, card) { target.blueCards.push(card); }
    _playMatchmaker(target, card) {
        const existing = target.blueCards.filter(item => item.kind === 'matchmaker');
        if (existing.length) {
            target.blueCards = target.blueCards.filter(item => item.kind !== 'matchmaker');
            this.discard.push(...existing, card);
        } else target.blueCards.push(card);
    }
    _discardRed(player) { this.discard.push(...player.redCards); player.redCards = []; player.redAccusations = 0; this._syncHealth(player); }

    _nextTurn() {
        const alive = this._alive(); if (!alive.length) return; let index = this.currentTurnIndex;
        for (let offset = 1; offset <= this.players.length; offset += 1) { index = (index + 1) % this.players.length; const next = this.players[index]; if (next && !next.eliminated && next.isOnline) { this.currentTurnIndex = index; this.currentTurnId = next.id; break; } }
        const next = this.playerMap[this.currentTurnId]; if (next) { const stocks = next.blueCards.findIndex(card => card.kind === 'stocks'); if (stocks >= 0) { this.discard.push(next.blueCards.splice(stocks, 1)[0]); this._log(`${next.name} 受到枷锁影响，本回合跳过`); this._nextTurn(); return; } }
        this.dayTurn = { playerId: this.currentTurnId, played: false, drew: false };
        this.judgeMessage = `轮到 ${next?.name || '下一位玩家'}。可以摸两张牌，或对其他玩家打出至少一张牌。`;
    }

    _startConspiracy(triggerId = this.currentTurnId) {
        const order = this._alive().map(player => player.id); this.currentConspiracy = { triggerId, order, index: 0, selections: {}, snapshot: null };
        const blackCatOwner = this.playerMap[this.blackCatOwnerId];
        if (blackCatOwner && !this._hasHall(blackCatOwner, 'mary-warren')) { this.phase = 'conspiracy_reveal'; this.judgeMessage = '阴谋触发：先由抽到阴谋的玩家选择黑猫持有者的一张审判牌揭示。'; }
        else this._prepareConspiracy();
        this._log('阴谋牌触发，开始顺时针交换审判牌'); return this._success('阴谋阶段开始');
    }
    _prepareConspiracy() {
        // The Black Cat reveal can eliminate its owner.  Rebuild the passing
        // order after that reveal so a dead seat cannot become an empty source
        // and block the simultaneous exchange.
        this.currentConspiracy.order = this._alive().map(player => player.id);
        this.currentConspiracy.index = 0;
        this.currentConspiracy.selections = {};
        this.currentConspiracy.snapshot = Object.fromEntries(this.currentConspiracy.order.map(id => [id, this.playerMap[id].trialCards.filter(card => !card.revealed).map(card => card.id)]));
        this.phase = 'conspiracy'; this.judgeMessage = '每位玩家从左手玩家处面朝下选择一张未揭示审判牌。';
    }
    _conspiracyAction(player, action) {
        const pending = this.currentConspiracy;
        if (this.phase === 'conspiracy_reveal') {
            if (!pending || pending.triggerId !== player.id) return { success: false, message: '等待抽到阴谋牌的玩家选择揭示牌', state: this.getPlayerState(player.id) };
            const owner = this.playerMap[this.blackCatOwnerId]; const trial = owner?.trialCards.find(card => !card.revealed && (!action.trialId || card.id === action.trialId));
            if (trial) this._revealTrial(owner, trial.id, 'conspiracy');
            this._checkWin();
            if (this.status === 'ended') { this.currentConspiracy = null; this.pendingDraw = null; return this._success('最终审判已经完成'); }
            this._prepareConspiracy(); return this._success('黑猫审判牌已揭示');
        }
        if (!pending || pending.order[pending.index] !== player.id) return { success: false, message: '等待顺时针下一位玩家选择审判牌', state: this.getPlayerState(player.id) };
        const orderIndex = pending.order.indexOf(player.id); const leftId = pending.order[(orderIndex - 1 + pending.order.length) % pending.order.length]; const choices = pending.snapshot?.[leftId] || []; const trialId = choices.includes(action.trialId) ? action.trialId : choices[0]; if (!trialId) return { success: false, message: '左手玩家没有可传递的未揭示审判牌', state: this.getPlayerState(player.id) }; pending.selections[player.id] = { sourceId: leftId, trialId }; pending.index += 1;
        if (pending.index < pending.order.length) return this._success('已记录阴谋取牌');
        const moved = []; for (const id of pending.order) { const selection = pending.selections[id]; const source = this.playerMap[selection.sourceId]; const cardIndex = source.trialCards.findIndex(card => card.id === selection.trialId && !card.revealed); if (cardIndex >= 0) moved.push({ receiverId: id, card: source.trialCards.splice(cardIndex, 1)[0] }); }
        moved.forEach(({ receiverId, card }) => { this.playerMap[receiverId].trialCards.push(card); });
        pending.order.forEach(id => {
            const receiver = this.playerMap[id];
            receiver.trialCards = shuffle(receiver.trialCards, this.random);
            this._refreshAlignment(receiver);
        });
        const triggerIndex = this.players.findIndex(item => item.id === pending.triggerId);
        const hadPendingDraw = Boolean(this.pendingDraw);
        this.currentConspiracy = null;
        this._checkWin();
        if (this.status === 'ended') { this.pendingDraw = null; return this._success('阴谋揭开了最终身份'); }
        this._startDossierReview('conspiracy', { triggerIndex, hadPendingDraw });
        this._log('审判牌已经易手，所有玩家正在重新核对档案');
        return this._success('阴谋传递完成，请重新核对审判档案');
    }

    _resumeAfterConspiracy({ triggerIndex = 0, hadPendingDraw = false } = {}) {
        this.phase = 'day';
        if (hadPendingDraw) {
            this.currentTurnIndex = this.pendingDraw.resumeTurnIndex ?? triggerIndex;
            this.currentTurnId = this.pendingDraw.resumeTurnId || this.players[this.currentTurnIndex]?.id || null;
            this._resumePendingDraw();
        } else {
            this.currentTurnIndex = triggerIndex < 0 ? 0 : triggerIndex; this.currentTurnId = this.players[this.currentTurnIndex]?.id || null; this._nextTurn();
        }
        this._checkWin();
    }

    _nightReady() {
        if (this.nightStep !== 'confession') return false;
        return this._alive().every(player => this.nightActions.confessions[player.id]);
    }
    _startNight() {
        if (this.status !== 'playing') return this._success('游戏结束');
        this.phase = 'night'; this.nightStep = 'witches'; this.night += 1;
        this.nightActions = { kills: {}, protect: null, confessions: {} };
        this.lastNightDeaths = [];
        this.players.forEach(player => { player.confessed = false; });
        this.judgeMessage = `第 ${this.night} 夜：女巫正在黑暗中决定今晚的目标。`;
        this._log(`第 ${this.night} 夜降临塞勒姆`);
        if (!this._alive().some(player => this._isWitch(player))) return this._beginConstableStep();
        return this._success('夜幕降临');
    }
    _beginConstableStep() {
        const constable = this._alive().find(player => this._isConstable(player));
        if (!constable) return this._beginConfessionStep();
        this.nightStep = 'constable';
        this.judgeMessage = `第 ${this.night} 夜：警长正在决定法槌保护的位置。`;
        return this._success('警长开始行动');
    }
    _beginConfessionStep() {
        this.nightStep = 'confession';
        this.judgeMessage = `第 ${this.night} 夜：晨钟响起前，每位存活玩家都必须选择认罪或保持沉默。`;
        return this._success('进入认罪时刻');
    }
    _nightAction(player, action) {
        if (action.kind === 'advancePhase') return { success: false, message: '夜晚会在所有人完成决定后自动结算', state: this.getPlayerState(player.id) };
        if (player.eliminated) return { success: false, message: '出局玩家不能进行夜间操作', state: this.getPlayerState(player.id) };
        if (action.kind === 'nightKill') {
            if (this.nightStep !== 'witches') return { success: false, message: '女巫的决定时刻已经结束', state: this.getPlayerState(player.id) };
            if (!this._isWitch(player)) return { success: false, message: '只有女巫阵营可以选择夜间目标', state: this.getPlayerState(player.id) };
            if (this.nightActions.kills[player.id]) return { success: false, message: '你的夜间决定已经封存', state: this.getPlayerState(player.id) };
            const target = this._validTarget(action.targetId, true, player.id);
            if (!target) return { success: false, message: '请选择一名存活玩家', state: this.getPlayerState(player.id) };
            this.nightActions.kills[player.id] = target.id;
            const witches = this._alive().filter(item => this._isWitch(item));
            if (witches.every(item => this.nightActions.kills[item.id])) return this._beginConstableStep();
            return this._success('你的决定已经封存');
        }
        if (action.kind === 'nightProtect') {
            if (this.nightStep !== 'constable') return { success: false, message: '现在不是警长行动的时刻', state: this.getPlayerState(player.id) };
            if (!this._isConstable(player)) return { success: false, message: '只有当前警长可以放置法槌', state: this.getPlayerState(player.id) };
            if (this.nightActions.protect) return { success: false, message: '法槌的位置已经确定', state: this.getPlayerState(player.id) };
            const target = this._validTarget(action.targetId, false, player.id);
            if (!target) return { success: false, message: '警长不能保护自己', state: this.getPlayerState(player.id) };
            this.nightActions.protect = target.id;
            return this._beginConfessionStep();
        }
        if (action.kind === 'confess') return this._confess(player, action.trialId, false);
        if (action.kind === 'confessFree') return this._confess(player, null, true);
        if (action.kind === 'passConfession') {
            if (this.nightStep !== 'confession') return { success: false, message: '现在还不能作出认罪决定', state: this.getPlayerState(player.id) };
            if (this.nightActions.confessions[player.id]) return { success: false, message: '你的决定已经封存', state: this.getPlayerState(player.id) };
            this.nightActions.confessions[player.id] = 'silent';
            if (this._nightReady()) return this._resolveNight();
            return this._success('你选择保持沉默');
        }
        return { success: false, message: '当前没有可执行的夜间行动', state: this.getPlayerState(player.id) };
    }
    _confess(player, trialId, useFreeConfession = false) {
        if (this.phase !== 'night' || this.nightStep !== 'confession' || player.eliminated) return { success: false, message: '当前不能认罪', state: this.getPlayerState(player.id) };
        if (this.nightActions.confessions[player.id]) return { success: false, message: '你的决定已经封存', state: this.getPlayerState(player.id) };
        const freeAvailable = this._hasHall(player, 'william-phips') && !player.townHallUsed.freeConfess;
        if (useFreeConfession && !freeAvailable) return { success: false, message: '你现在不能使用免揭示认罪', state: this.getPlayerState(player.id) };
        const trial = useFreeConfession ? null : player.trialCards.find(card => !card.revealed && ['town', 'witch'].includes(card.type) && card.id === trialId);
        if (!useFreeConfession && !trial) return { success: false, message: '请选择一张自己的镇民或女巫审判牌', state: this.getPlayerState(player.id) };
        this.nightActions.confessions[player.id] = 'confessed';
        if (trial) this._revealTrial(player, trial.id, 'confess');
        if (useFreeConfession) player.townHallUsed.freeConfess = true;
        player.confessed = true;
        this._log(`${player.name} 在天亮前认罪并获得本夜庇护`);
        this._checkWin();
        if (this.status === 'ended') { this.pendingDraw = null; return this._success('认罪揭开了最终身份'); }
        if (this._nightReady()) return this._resolveNight();
        return this._success(useFreeConfession ? '你已在不揭示审判牌的情况下认罪' : '认罪完成');
    }
    _resolveNight() {
        const counts = new Map(); Object.values(this.nightActions.kills).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)); const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]); const target = ranked.length && (!ranked[1] || ranked[1][1] < ranked[0][1]) ? this.playerMap[ranked[0][0]] : null;
        if (target && !target.eliminated && target.id !== this.nightActions.protect && !target.confessed && !this._hasBlue(target, 'asylum')) { this._eliminate(target, '夜间击杀'); this.lastNightDeaths.push(target.id); }
        this._log(this.lastNightDeaths.length ? `${this.lastNightDeaths.map(id => this.playerMap[id].name).join('、')} 在夜晚出局` : '本夜无人出局'); this.nightActions = { kills: {}, protect: null, confessions: {} }; this.nightStep = null; this._rebuildDeckAfterNight(); this._checkWin();
        if (this.status === 'ended') { this.pendingDraw = null; return this._success('游戏结束'); }
        this.day += 1;
        if (this.pendingDraw) {
            const resumeId = this.pendingDraw.resumeTurnId || this.players[(this.currentTurnIndex + 1) % this.players.length]?.id;
            this._beginDay(resumeId);
            this._resumePendingDraw();
        } else this._beginDay(this.players[(this.currentTurnIndex + 1) % this.players.length]?.id);
        return this._success('天亮了');
    }
    _rebuildDeckAfterNight() { const rest = this.deck.filter(card => card.kind !== 'night'); this.deck = shuffle(rest.concat(this.discard.filter(card => card.kind !== 'night')), this.random); this.discard = []; this.deck.unshift({ id: `salem-night-${this.night + 1}`, kind: 'night', name: CARD_NAMES.night, color: 'black' }); }

    _revealTrial(player, trialId, reason = 'manual') {
        const trial = player.trialCards.find(card => !card.revealed && (!trialId || card.id === trialId)); if (!trial) return null;
        trial.revealed = true; player.revealed = true; this._refreshAlignment(player); if (trial.type === 'witch') this.revealedWitchCount += 1;
        this.trialRevealSequence += 1;
        this.lastTrialReveal = { sequence: this.trialRevealSequence, playerId: player.id, playerName: player.name, trialId: trial.id, type: trial.type, reason };
        if (trial.type === 'witch' || player.trialCards.every(card => card.revealed)) this._eliminate(player, trial.type === 'witch' ? '翻出女巫审判牌' : '所有审判牌已揭示');
        if (reason === 'accusation') this.players.filter(other => other.id !== player.id && !other.eliminated && this._hasHall(other, 'rebecca-nurse')).forEach(other => this._drawForPlayer(other, 1));
        this._refreshAlignment(player); return trial;
    }
    _eliminate(player, reason) {
        if (player.eliminated) return; player.eliminated = true; player.revealed = true; player.trialCards.filter(card => !card.revealed).forEach(card => { card.revealed = true; if (card.type === 'witch') this.revealedWitchCount += 1; });
        const hand = player.hand.splice(0); const blue = player.blueCards.splice(0); const red = player.redCards.splice(0); this.discard.push(...hand, ...blue, ...red); player.redAccusations = 0; this._syncHealth(player); if (this.blackCatOwnerId === player.id) this.blackCatOwnerId = null; this._log(`${player.name} ${reason}，公开剩余审判牌`);
        const proctor = this.players.find(other => !other.eliminated && this._hasHall(other, 'john-proctor')); if (proctor) { for (const card of hand) { const index = this.discard.lastIndexOf(card); if (index >= 0) this.discard.splice(index, 1); proctor.hand.push(card); } for (const card of blue) { const index = this.discard.lastIndexOf(card); if (index >= 0) this.discard.splice(index, 1); proctor.blueCards.push(card); if (card.kind === 'blackcat') this.blackCatOwnerId = proctor.id; } }
        const partners = this.players.filter(other => other.id !== player.id && !other.eliminated && other.blueCards.some(card => card.kind === 'matchmaker'));
        partners.forEach(other => { if (!this._hasHall(other, 'mary-warren')) this._eliminate(other, '红娘连带出局'); });
        if (this.status === 'playing' && this.phase === 'day' && this.currentTurnId === player.id) this._nextTurn();
    }
    _checkWin() {
        // The victory condition is based on the setup count.  Trial cards can
        // move during Conspiracy and are revealed/removed on elimination; a
        // live count would incorrectly end the game if a test or a client
        // temporarily reorders hidden cards.
        const totalWitches = this.totalWitches;
        if (this.revealedWitchCount >= totalWitches) { this.status = 'ended'; this.phase = 'ended'; this.winner = { faction: 'town', name: '镇民阵营' }; this.judgeMessage = '所有女巫审判牌已揭示，镇民阵营获胜'; this._log(this.judgeMessage); return; }
        const living = this._alive(); if (living.length && living.every(player => this._isWitch(player))) { this.status = 'ended'; this.phase = 'ended'; this.winner = { faction: 'witch', name: '女巫阵营' }; this.judgeMessage = '所有仍存活的玩家都属于女巫阵营，女巫获胜'; this._log(this.judgeMessage); }
    }

    getPublicState() {
        const reveal = this.status === 'ended'; const current = this.playerMap[this.currentTurnId];
        const dossierRequired = this.phase === 'dossier_review' ? this._alive().length : 0;
        const dossierConfirmed = this.phase === 'dossier_review' ? this._alive().filter(player => this.dossierReview?.confirmations[player.id]).length : 0;
        let nightProgress = null;
        if (this.phase === 'night') {
            const witches = this._alive().filter(player => this._isWitch(player));
            const required = this.nightStep === 'witches' ? witches.length : this.nightStep === 'constable' ? 1 : this._alive().length;
            const completed = this.nightStep === 'witches' ? witches.filter(player => this.nightActions.kills[player.id]).length : this.nightStep === 'constable' ? Number(Boolean(this.nightActions.protect)) : this._alive().filter(player => this.nightActions.confessions[player.id]).length;
            nightProgress = { completed, required };
        }
        return { roomId: this.roomId, status: this.status, phase: this.phase, day: this.day, night: this.night, hostId: this.hostId, currentTurnId: this.currentTurnId,
            judgeMessage: this.judgeMessage, deckCount: this.deck.length, blackCatOwnerId: this.blackCatOwnerId, lastNightDeaths: this.lastNightDeaths.slice(), lastTrialReveal: this.lastTrialReveal ? { ...this.lastTrialReveal } : null,
            dossierReviewReason: this.dossierReview?.reason || null, dossierProgress: { confirmed: dossierConfirmed, required: dossierRequired }, nightStep: this.nightStep, nightProgress,
            players: this.players.map(player => ({ id: player.id, name: player.name, seat: player.seat, townHall: player.townHall ? { ...player.townHall } : null, health: player.health, eliminated: player.eliminated, trialCount: player.trialCards.length, revealedTrialCount: player.trialCards.filter(card => card.revealed).length, revealedTrialCards: player.trialCards.filter(card => card.revealed).map(card => ({ id: card.id, type: card.type })), accusations: player.redAccusations, redAccusations: player.redAccusations, blueCards: player.blueCards.map(cardSummary), exposedHandCards: player.exposedHandCards.map(cardSummary), isOnline: player.isOnline, identity: reveal || player.eliminated ? IDENTITIES[player.identity] : null })),
            actionLog: this.actionLog.slice(-20), winner: this.winner, currentTurnName: current?.name || null };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myIdentity = player ? IDENTITIES[player.identity] : null; state.myTownHall = player?.townHall ? { ...player.townHall } : null;
        // Players are allowed to inspect their own face-down Trial cards.  A
        // viewer still receives no type information for another player's
        // unrevealed cards through getPublicState().
        state.myTrialCards = player?.trialCards.map(card => ({ id: card.id, revealed: card.revealed, type: card.type })) || []; state.myHand = player?.hand.map(cardSummary) || []; state.myInfo = player?.lastInfo ? { ...player.lastInfo } : null; state.knownWitches = this._isWitch(player || {}) ? this.players.filter(other => this._isWitch(other)).map(other => ({ id: other.id, name: other.name })) : [];
        state.dossierConfirmed = Boolean(this.dossierReview?.confirmations[playerId]);
        const actions = {}; if (!player || this.status !== 'playing') return Object.assign(state, { availableActions: actions });
        if (this.phase === 'dossier_review') actions.confirmDossier = !player.eliminated && !state.dossierConfirmed;
        else if (this.phase === 'dawn') actions.chooseBlackCat = this._isWitch(player) && !this.dawnVotes[player.id];
        else if (this.phase === 'conspiracy_reveal') { actions.revealConspiracyTrial = this.currentConspiracy?.triggerId === playerId; state.conspiracyRevealOptions = this.playerMap[this.blackCatOwnerId]?.trialCards.filter(card => !card.revealed).map(card => ({ id: card.id })) || []; }
        else if (this.phase === 'conspiracy') { actions.passTrial = this.currentConspiracy?.order[this.currentConspiracy.index] === playerId; const order = this.currentConspiracy?.order || []; const leftId = order[(order.indexOf(playerId) - 1 + order.length) % order.length]; state.conspiracyOptions = (this.currentConspiracy?.snapshot?.[leftId] || []).map(id => ({ id })); }
        else if (this.phase === 'night') {
            const undecided = !this.nightActions.confessions[player.id];
            actions.nightKill = this.nightStep === 'witches' && this._isWitch(player) && !player.eliminated && !this.nightActions.kills[player.id];
            actions.nightProtect = this.nightStep === 'constable' && this._isConstable(player) && !player.eliminated && !this.nightActions.protect;
            actions.confess = this.nightStep === 'confession' && !player.eliminated && undecided && player.trialCards.some(card => !card.revealed && ['town', 'witch'].includes(card.type));
            actions.confessFree = this.nightStep === 'confession' && !player.eliminated && undecided && this._hasHall(player, 'william-phips') && !player.townHallUsed.freeConfess;
            actions.passConfession = this.nightStep === 'confession' && !player.eliminated && undecided;
        }
        else if (this.phase === 'day') { const turn = player.id === this.currentTurnId && !player.eliminated; actions.drawCards = turn && !this.dayTurn?.played && !this.dayTurn?.drew; actions.playCard = turn && !this.dayTurn?.drew; actions.endTurn = turn && Boolean(this.dayTurn?.played); actions.drawDiscard = turn && !this.dayTurn?.played && !this.dayTurn?.drew && this._hasHall(player, 'samuel-parris') && (player.townHallUsed.drawDiscard || 0) < 2; actions.reorderDeck = turn && !this.dayTurn?.drew && this._hasHall(player, 'tituba') && !player.townHallUsed.reorder; }
        if (actions.reorderDeck) state.deckOrder = this.deck.map(card => card.id);
        state.availableActions = actions; return state;
    }
    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (!player.eliminated) this._eliminate(player, '离开游戏');
        this._checkWin();
        if (this.status === 'ended') return this._success(`${player.name} 离开后，审判已经结束`);
        if (this.phase === 'dossier_review' && this._alive().every(item => this.dossierReview.confirmations[item.id])) return this._completeDossierReview();
        if (this.phase === 'night' && this.nightStep === 'witches' && this._alive().filter(item => this._isWitch(item)).every(item => this.nightActions.kills[item.id])) return this._beginConstableStep();
        if (this.phase === 'night' && this.nightStep === 'constable' && !this._alive().some(item => this._isConstable(item))) return this._beginConfessionStep();
        if (this.phase === 'night' && this.nightStep === 'confession' && this._nightReady()) return this._resolveNight();
        return this._success(`${player.name} 离开了猎巫镇`);
    }
    _log(message) { this.actionLog.push(message); if (this.actionLog.length > 24) this.actionLog.shift(); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner }; }
    getWinner() { return this.winner; }
}

module.exports = WitchTownEngine;
module.exports.IDENTITIES = IDENTITIES;
module.exports.TRIAL_SETUP = TRIAL_SETUP;
module.exports.TOWN_HALLS = TOWN_HALLS;
module.exports.CARD_DEFS = CARD_DEFS;
