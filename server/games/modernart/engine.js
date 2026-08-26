const ARTISTS = [
    { id: 'matisse', name: '马蒂斯', color: '#d95f59', count: 12 },
    { id: 'cassat', name: '卡萨特', color: '#d69c4d', count: 15 },
    { id: 'yoshida', name: '吉田', color: '#6287b3', count: 14 },
    { id: 'bruegel', name: '勃鲁盖尔', color: '#6d9872', count: 16 },
    { id: 'clyfford', name: '克里福特', color: '#8c6a9c', count: 13 },
];
const AUCTION_TYPES = ['open', 'once', 'sealed', 'fixed', 'double'];
const START_CASH = 100;
const ROUNDS = 4;
const DEALS = { 3: [10, 6, 6, 0], 4: [9, 4, 4, 0], 5: [8, 3, 3, 0] };

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

class ModernArtEngine {
    constructor(roomId, players, randomOrOptions = Math.random, extraOptions = {}) {
        const suppliedOptions = typeof randomOrOptions === 'function' ? extraOptions : (randomOrOptions || {});
        const random = typeof randomOrOptions === 'function' ? randomOrOptions : (suppliedOptions.random || Math.random);
        this.roomId = roomId;
        this.random = random;
        this.options = { ...suppliedOptions };
        const playerColors = ['#d45f54', '#4d82a6', '#bf8b3e', '#6d9466', '#80699b'];
        // Keep the complete room roster so start() can reject unsupported
        // player counts instead of silently truncating a six-player room.
        this.players = players.map((player, index) => ({ id: player.id, name: player.name, color: playerColors[index] || '#777777', cash: START_CASH, hand: [], collection: [], isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.deck = []; this.round = 0; this.roundSales = []; this.market = []; this.artistValues = Object.fromEntries(ARTISTS.map(artist => [artist.id, 0]));
        this.currentSellerIndex = 0; this.phase = 'waiting'; this.status = 'waiting'; this.auction = null; this.pendingDouble = null; this.mysteryEnabled = Boolean(this.options.mysteryPlayer && this.players.length === 3); this.mysteryHand = []; this.mysteryPendingPlayerId = null; this.history = []; this.actionLog = []; this.winner = null; this.winners = []; this.finalStandings = [];
        this.presentation = null; this.presentationSequence = 0; this.presentationEventSequence = 0; this.seasonPrivateResults = {};
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < 3 || this.players.length > 5) return { success: false, message: '现代艺术需要 3–5 名玩家' };
        this.players.forEach(player => { player.cash = START_CASH; player.hand = []; player.collection = []; player.isOnline = true; });
        this.round = 1; this.status = 'playing'; this.phase = 'waiting'; this.actionLog = []; this.history = []; this.pendingDouble = null; this.mysteryPendingPlayerId = null; this.mysteryEnabled = Boolean(this.options.mysteryPlayer && this.players.length === 3); this.mysteryHand = []; this.currentSellerIndex = 0; this.winner = null; this.winners = []; this.finalStandings = [];
        this.presentation = null; this.presentationSequence = 0; this.presentationEventSequence = 0; this.seasonPrivateResults = {};
        this.artistValues = Object.fromEntries(ARTISTS.map(artist => [artist.id, 0]));
        this.deck = shuffle(this._buildDeck(), this.random); this._dealRound(); this._beginAuction();
        return this._success('现代艺术开始');
    }

    _buildDeck() {
        const cards = [];
        ARTISTS.forEach((artist, artistIndex) => {
            for (let index = 0; index < artist.count; index += 1) {
                cards.push({ id: `${artist.id}-${index + 1}`, artistId: artist.id, artistName: artist.name, auctionType: AUCTION_TYPES[(index + artistIndex) % AUCTION_TYPES.length] });
            }
        });
        return cards;
    }

    _dealRound() {
        const dealCount = DEALS[this.mysteryEnabled ? 4 : this.players.length]?.[this.round - 1] || 0;
        for (let index = 0; index < dealCount; index += 1) {
            this.players.forEach(player => { const card = this.deck.pop(); if (card) player.hand.push(card); });
            if (this.mysteryEnabled) { const card = this.deck.pop(); if (card) this.mysteryHand.push(card); }
        }
        this.roundSales = []; this.market = [];
    }

    _beginAuction() {
        this.auction = null; this.phase = 'auction';
        const nextSeller = this._nextSellerWithCards(this.currentSellerIndex);
        if (nextSeller === null) { this._finishRound({ kind: 'handsExhausted' }); return; }
        this.currentSellerIndex = nextSeller;
        this._log(`第 ${this.round} 季：${this.players[this.currentSellerIndex].name} 选择要拍卖的作品`);
    }

    _nextSellerWithCards(startIndex) {
        for (let offset = 0; offset < this.players.length; offset += 1) {
            const index = (startIndex + offset) % this.players.length;
            if (this.players[index].hand.length) return index;
        }
        return null;
    }

    handleAction(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (this.phase === 'double_offer') return this._doubleOfferAction(player, action);
        if (this.phase === 'mystery_offer') return this._mysteryAction(player, action);
        if (this.phase === 'auction') return this._startAuction(player, action);
        if (this.phase === 'bidding') return this._bid(player, action);
        return { success: false, message: '当前阶段不能操作', state: this.getPlayerState(playerId) };
    }

    _cardType(card, requestedType) { return card.auctionType || requestedType; }
    _publicCard(card) { return card ? { id: card.id, artistId: card.artistId, artistName: card.artistName, auctionType: card.auctionType } : null; }
    _removeHandCard(player, index) { player.hand.splice(index, 1); }
    _recordOffer(card, sellerId) { this.roundSales.push({ id: card.id, artistId: card.artistId, artistName: card.artistName, price: null, buyerId: null, sellerId }); }
    _markOffer(cardId, patch) { const offer = this.roundSales.slice().reverse().find(item => item.id === cardId); if (offer) Object.assign(offer, patch); }
    _roundReached(artistId) { return this.roundSales.filter(item => item.artistId === artistId).length >= 5; }

    _startAuction(player, action) {
        if (this.players[this.currentSellerIndex]?.id !== player.id) return { success: false, message: '等待当前艺术家出牌', state: this.getPlayerState(player.id) };
        const cardIndex = Number(action.cardIndex); const card = player.hand[cardIndex];
        if (!card) return { success: false, message: '请选择手中的作品', state: this.getPlayerState(player.id) };
        const type = this._cardType(card, action.auctionType);
        if (!AUCTION_TYPES.includes(type)) return { success: false, message: '这张作品缺少拍卖方式', state: this.getPlayerState(player.id) };
        if (type === 'fixed' && (!Number.isInteger(Number(action.amount)) || Number(action.amount) <= 0 || Number(action.amount) > player.cash)) return { success: false, message: '定价拍卖必须设置不超过卖家现金的正整数价格', state: this.getPlayerState(player.id) };
        // When the last painting in a round is reached before an artist's
        // fifth card, the official rules leave that final painting unsold.
        const cardsRemaining = this.players.reduce((sum, item) => sum + item.hand.length, 0);
        const appearance = this.roundSales.filter(item => item.artistId === card.artistId).length + 1;
        this._startPresentation(player.id, 'startAuction', { kind: 'paintingPresented', actorId: player.id, actorName: player.name, sellerId: player.id, sellerName: player.name, card: this._publicCard(card), auctionType: type, auctionTypeName: this._auctionName(type), appearance, endsSeason: cardsRemaining === 1 || appearance >= 5, endReason: cardsRemaining === 1 ? 'lastPainting' : appearance >= 5 ? 'fifthPainting' : null });
        if (cardsRemaining === 1) {
            this._removeHandCard(player, cardIndex); this._recordOffer(card, player.id);
            this.currentSellerIndex = (this.players.indexOf(player) + 1) % this.players.length;
            this._log(`${card.artistName} 是本季最后一幅作品，本幅作品不拍卖`);
            this._finishRound({ kind: 'lastPainting', card: this._publicCard(card), sellerId: player.id, sellerName: player.name });
            this._finishPresentation();
            return this._success('本季结束');
        }
        if (type === 'double') {
            const first = card;
            this._removeHandCard(player, cardIndex);
            this._recordOffer(first, player.id);
            if (this._roundReached(first.artistId)) { this.currentSellerIndex = (this.players.indexOf(player) + 1) % this.players.length; this._log(`${first.artistName} 是本季第五幅作品，双重拍卖未开始`); this._finishRound({ kind: 'fifthPainting', card: this._publicCard(first), sellerId: player.id, sellerName: player.name, doubleAuction: true }); this._finishPresentation(); return this._success('本季结束'); }
            this.pendingDouble = { first, originalSellerId: player.id, currentPlayerIndex: this.players.indexOf(player), passed: new Set() };
            const requestedSecondIndex = Number(action.secondCardIndex);
            const secondIndex = requestedSecondIndex > cardIndex ? requestedSecondIndex - 1 : requestedSecondIndex;
            const second = player.hand[secondIndex];
            if (second && second.artistId === first.artistId && this._cardType(second, action.secondAuctionType) !== 'double') { const result = this._acceptSecondPainting(player, secondIndex, action.secondAuctionType); this._finishPresentation(); return result; }
            this.phase = 'double_offer';
            this._appendPresentationEvent({ kind: 'doubleOfferStarted', card: this._publicCard(first), originalSellerId: player.id, originalSellerName: player.name });
            this._log(`${player.name} 选择双重拍卖；请先决定是否提供同艺术家的第二幅作品`);
            this._finishPresentation();
            return this._success('请选择双重拍卖的第二幅作品');
        }
        this._removeHandCard(player, cardIndex); this._recordOffer(card, player.id);
        if (this._roundReached(card.artistId)) { this.currentSellerIndex = (this.players.indexOf(player) + 1) % this.players.length; this._log(`${card.artistName} 成为本季第五幅作品，本幅作品不拍卖`); this._finishRound({ kind: 'fifthPainting', card: this._publicCard(card), sellerId: player.id, sellerName: player.name }); this._finishPresentation(); return this._success('本季结束'); }
        this._openAuction([card], player, type, type === 'fixed' ? Number(action.amount) : null); this._finishPresentation(); return this._success('拍卖开始');
    }

    _doubleOfferAction(player, action) {
        const pending = this.pendingDouble;
        if (!pending || this.players[pending.currentPlayerIndex]?.id !== player.id) return { success: false, message: '等待下一位玩家决定是否提供第二幅作品', state: this.getPlayerState(player.id) };
        if (action.kind === 'offerSecond') {
            const cardIndex = Number(action.cardIndex);
            const card = player.hand[cardIndex];
            if (!card || card.artistId !== pending.first.artistId || this._cardType(card) === 'double') return { success: false, message: '第二幅作品必须是同一艺术家且不能是双重拍卖', state: this.getPlayerState(player.id) };
            this._startPresentation(player.id, 'doubleOffer');
            const result = this._acceptSecondPainting(player, cardIndex);
            this._finishPresentation();
            return result;
        }
        if (action.kind !== 'passSecond') return { success: false, message: '请选择第二幅作品或跳过', state: this.getPlayerState(player.id) };
        this._startPresentation(player.id, 'doubleOffer', { kind: 'doubleOfferPassed', actorId: player.id, actorName: player.name, card: this._publicCard(pending.first), passedCount: pending.passed.size + 1 });
        pending.passed.add(player.id);
        if (pending.passed.size >= this.players.length) {
            const seller = this.playerMap[pending.originalSellerId];
            seller.collection.push(pending.first); this._markOffer(pending.first.id, { buyerId: seller.id, price: 0, sellerId: seller.id });
            this.currentSellerIndex = (this.players.indexOf(seller) + 1) % this.players.length;
            this.pendingDouble = null; this.phase = 'auction';
            this._appendPresentationEvent({ kind: 'doubleOfferFailed', card: this._publicCard(pending.first), sellerId: seller.id, sellerName: seller.name, nextSellerId: this.players[this.currentSellerIndex]?.id || null, nextSellerName: this.players[this.currentSellerIndex]?.name || null });
            this._log(`${seller.name} 没有找到同艺术家第二幅作品，免费收下双重作品`);
            this._finishPresentation();
            return this._success('双重作品免费归入卖家');
        }
        pending.currentPlayerIndex = (pending.currentPlayerIndex + 1) % this.players.length;
        this._appendPresentationEvent({ kind: 'doubleOfferContinues', playerId: this.players[pending.currentPlayerIndex].id, playerName: this.players[pending.currentPlayerIndex].name });
        this._log(`${this.players[pending.currentPlayerIndex].name} 决定是否提供第二幅作品`);
        this._finishPresentation();
        return this._success('等待下一位玩家决定');
    }

    _acceptSecondPainting(player, cardIndex, requestedType) {
        const pending = this.pendingDouble;
        const second = player.hand[cardIndex];
        this._removeHandCard(player, cardIndex);
        this._recordOffer(second, player.id);
        this._appendPresentationEvent({ kind: 'secondPaintingOffered', actorId: player.id, actorName: player.name, originalSellerId: pending.originalSellerId, originalSellerName: this.playerMap[pending.originalSellerId]?.name || '', firstCard: this._publicCard(pending.first), secondCard: this._publicCard(second), auctionType: this._cardType(second, requestedType), appearance: this.roundSales.filter(item => item.artistId === second.artistId).length });
        if (this._roundReached(second.artistId)) {
            this.currentSellerIndex = (this.players.indexOf(player) + 1) % this.players.length;
            this.pendingDouble = null;
            this._log(`${second.artistName} 成为本季第五幅作品，双重拍卖的两幅作品均未成交`);
            this._finishRound({ kind: 'fifthPainting', card: this._publicCard(second), sellerId: player.id, sellerName: player.name, doubleAuction: true, firstCard: this._publicCard(pending.first) });
            return this._success('本季结束');
        }
        this.pendingDouble = null;
        this._openAuction([pending.first, second], player, this._cardType(second, requestedType));
        return this._success('双重拍卖开始');
    }

    _queueMysteryChoice(seller, nextSellerIndex) {
        const availableSeller = this._nextSellerWithCards(nextSellerIndex);
        this.currentSellerIndex = availableSeller === null ? nextSellerIndex : availableSeller;
        if (this.mysteryEnabled && this.mysteryHand.length) {
            this.mysteryPendingPlayerId = seller.id;
            this.phase = 'mystery_offer';
            this._appendPresentationEvent({ kind: 'mysteryOfferStarted', playerId: seller.id, playerName: seller.name, remaining: this.mysteryHand.length });
            this._log(`${seller.name} 可选择翻开一张神秘作品，或跳过`);
            return;
        }
        this.mysteryPendingPlayerId = null;
        if (availableSeller === null) { this._finishRound({ kind: 'handsExhausted' }); return; }
        this.phase = 'auction';
        this._appendPresentationEvent({ kind: 'sellerTurnStarted', playerId: this.players[this.currentSellerIndex].id, playerName: this.players[this.currentSellerIndex].name, round: this.round });
        this._log(`${this.players[this.currentSellerIndex].name} 选择下一件作品`);
    }

    _mysteryAction(player, action) {
        if (!this.mysteryEnabled || player.id !== this.mysteryPendingPlayerId) return { success: false, message: '等待神秘作品决定', state: this.getPlayerState(player.id) };
        if (action.kind === 'skipMystery') {
            this._startPresentation(player.id, 'mystery', { kind: 'mysterySkipped', actorId: player.id, actorName: player.name, remaining: this.mysteryHand.length });
            this.mysteryPendingPlayerId = null;
            if (this._nextSellerWithCards(this.currentSellerIndex) === null) { this._finishRound({ kind: 'handsExhausted' }); this._finishPresentation(); return this._success('本季结束'); }
            this.phase = 'auction';
            this._appendPresentationEvent({ kind: 'sellerTurnStarted', playerId: this.players[this.currentSellerIndex].id, playerName: this.players[this.currentSellerIndex].name, round: this.round });
            this._log(`${player.name} 跳过神秘作品；${this.players[this.currentSellerIndex].name} 选择下一件作品`);
            this._finishPresentation();
            return this._success('已跳过神秘作品');
        }
        if (action.kind !== 'revealMystery' || !this.mysteryHand.length) return { success: false, message: '请选择翻开神秘作品或跳过', state: this.getPlayerState(player.id) };
        const mysteryIndex = Math.min(this.mysteryHand.length - 1, Math.floor(this.random() * this.mysteryHand.length));
        const card = this.mysteryHand.splice(mysteryIndex, 1)[0];
        this._startPresentation(player.id, 'mystery', { kind: 'mysteryRevealed', actorId: player.id, actorName: player.name, card: this._publicCard(card), appearance: this.roundSales.filter(item => item.artistId === card.artistId).length + 1, remaining: this.mysteryHand.length });
        this._recordOffer(card, null);
        this.mysteryPendingPlayerId = null;
        if (this._roundReached(card.artistId)) {
            this.currentSellerIndex = (this.players.indexOf(player) + 1) % this.players.length;
            this._log(`神秘作品 ${card.artistName} 成为本季第五幅作品，本季结束`);
            this._finishRound({ kind: 'fifthPainting', card: this._publicCard(card), mystery: true });
            this._finishPresentation();
            return this._success('神秘作品结束本季');
        }
        if (this._nextSellerWithCards(this.currentSellerIndex) === null) { this._finishRound({ kind: 'handsExhausted' }); this._finishPresentation(); return this._success('本季结束'); }
        this.phase = 'auction';
        this._appendPresentationEvent({ kind: 'sellerTurnStarted', playerId: this.players[this.currentSellerIndex].id, playerName: this.players[this.currentSellerIndex].name, round: this.round });
        this._log(`神秘作品 ${card.artistName} 已翻开但不拍卖；${this.players[this.currentSellerIndex].name} 选择下一件作品`);
        this._finishPresentation();
        return this._success('已翻开神秘作品');
    }

    _openAuction(cards, seller, type, fixedPrice = null) {
        this.auction = { cards, card: cards[0], sellerId: seller.id, type, fixedPrice, currentBidderIndex: (this.players.indexOf(seller) + 1) % this.players.length, highestBid: 0, highestBidder: null, passed: new Set(), bids: [], sealedBids: [], turns: 0 };
        this._appendPresentationEvent({ kind: 'auctionOpened', sellerId: seller.id, sellerName: seller.name, cards: cards.map(card => this._publicCard(card)), auctionType: type, auctionTypeName: this._auctionName(type), fixedPrice, firstBidderId: this.players[this.auction.currentBidderIndex]?.id || null, firstBidderName: this.players[this.auction.currentBidderIndex]?.name || null });
        this.phase = 'bidding'; this._log(`${seller.name} 拍卖 ${cards.map(item => item.artistName).join('、')}（${this._auctionName(type)}）`);
    }

    _bid(player, action) {
        const auction = this.auction; const current = this.players[auction?.currentBidderIndex];
        if (!auction || !current || current.id !== player.id) return { success: false, message: '等待其他玩家出价', state: this.getPlayerState(player.id) };
        const amount = Number(action.amount);
        if (!Number.isInteger(amount) || amount < 0 || amount > player.cash) return { success: false, message: '出价必须为现金范围内的整数', state: this.getPlayerState(player.id) };
        if (auction.type !== 'sealed' && auction.type !== 'fixed' && amount > 0 && amount <= auction.highestBid) return { success: false, message: '出价必须高于当前报价', state: this.getPlayerState(player.id) };
        if (auction.type === 'fixed' && amount !== 0 && amount !== auction.fixedPrice) return { success: false, message: `定价拍卖只能接受 ${auction.fixedPrice} 元或放弃`, state: this.getPlayerState(player.id) };
        this._startPresentation(player.id, 'bid');
        if (auction.type === 'sealed') {
            auction.sealedBids.push({ playerId: player.id, amount }); auction.bids.push({ playerId: player.id, amount }); auction.turns += 1;
            this._appendPresentationEvent({ kind: 'sealedBidSubmitted', actorId: player.id, actorName: player.name, submitted: auction.sealedBids.length, required: this.players.length, cards: auction.cards.map(card => this._publicCard(card)), sellerId: auction.sellerId, sellerName: this.playerMap[auction.sellerId]?.name || '' });
            if (auction.sealedBids.length >= this.players.length) this._resolveAuction(); else this._advanceBidding();
            this._finishPresentation(); return this._success('秘密报价已提交');
        }
        if (auction.type === 'fixed') {
            auction.turns += 1;
            if (amount === auction.fixedPrice) { auction.highestBid = amount; auction.highestBidder = player.id; auction.bids.push({ playerId: player.id, amount }); this._appendPresentationEvent({ kind: 'fixedPriceAccepted', actorId: player.id, actorName: player.name, amount, cards: auction.cards.map(card => this._publicCard(card)), sellerId: auction.sellerId, sellerName: this.playerMap[auction.sellerId]?.name || '' }); this._resolveAuction(); }
            else if (player.id === auction.sellerId) { auction.highestBid = auction.fixedPrice; auction.highestBidder = player.id; this._appendPresentationEvent({ kind: 'fixedPriceBuyback', actorId: player.id, actorName: player.name, amount: auction.fixedPrice, cards: auction.cards.map(card => this._publicCard(card)) }); this._resolveAuction(); }
            else { this._appendPresentationEvent({ kind: 'bidPassed', actorId: player.id, actorName: player.name, auctionType: auction.type, cards: auction.cards.map(card => this._publicCard(card)), irreversible: true }); this._advanceBidding(); }
            this._finishPresentation(); return this._success(amount ? '定价拍卖成交' : '你已放弃定价');
        }
        if (amount === 0) { auction.passed.add(player.id); this._appendPresentationEvent({ kind: 'bidPassed', actorId: player.id, actorName: player.name, auctionType: auction.type, cards: auction.cards.map(card => this._publicCard(card)), irreversible: auction.type === 'open' || auction.type === 'once' }); }
        else { auction.highestBid = amount; auction.highestBidder = player.id; auction.bids.push({ playerId: player.id, amount }); this._appendPresentationEvent({ kind: 'bidPlaced', actorId: player.id, actorName: player.name, amount, auctionType: auction.type, cards: auction.cards.map(card => this._publicCard(card)), sellerId: auction.sellerId, sellerName: this.playerMap[auction.sellerId]?.name || '' }); }
        auction.turns += 1; this._advanceBidding(); this._finishPresentation(); return this._success(amount ? '出价已记录' : '你已跳过本次出价');
    }

    _advanceBidding() {
        const auction = this.auction; if (!auction) return;
        if (auction.type === 'open') {
            const active = this.players.filter(player => !auction.passed.has(player.id));
            if (active.length === 0 || (auction.highestBidder && active.length === 1 && active[0].id === auction.highestBidder)) { this._resolveAuction(); return; }
            do { auction.currentBidderIndex = (auction.currentBidderIndex + 1) % this.players.length; } while (auction.passed.has(this.players[auction.currentBidderIndex].id));
            return;
        }
        if (auction.turns >= this.players.length) { this._resolveAuction(); return; }
        auction.currentBidderIndex = (auction.currentBidderIndex + 1) % this.players.length;
    }

    _resolveAuction() {
        const auction = this.auction; if (!auction) return;
        let winnerId = auction.highestBidder; let price = auction.highestBid;
        if (auction.type === 'sealed') {
            const ordered = auction.sealedBids.slice().sort((a, b) => b.amount - a.amount || this._clockwiseDistance(auction.sellerId, a.playerId) - this._clockwiseDistance(auction.sellerId, b.playerId));
            winnerId = ordered[0]?.amount > 0 ? ordered[0].playerId : auction.sellerId; price = ordered[0]?.amount > 0 ? ordered[0].amount : 0;
        }
        if (!winnerId) winnerId = auction.sellerId;
        if (auction.type === 'fixed' && (!auction.highestBidder || auction.highestBidder === auction.sellerId)) { winnerId = auction.sellerId; price = auction.fixedPrice; }
        const winner = this.playerMap[winnerId]; const seller = this.playerMap[auction.sellerId];
        if (winnerId === seller.id) seller.cash -= price; else { winner.cash -= price; seller.cash += price; }
        winner.collection.push(...auction.cards);
        auction.cards.forEach(card => { this._markOffer(card.id, { buyerId: winner.id, price, sellerId: seller.id }); this.market.push({ cardId: card.id, artistId: card.artistId, artistName: card.artistName, auctionType: card.auctionType, price, buyerId: winner.id, sellerId: seller.id }); });
        this._appendPresentationEvent({ kind: 'auctionResolved', cards: auction.cards.map(card => this._publicCard(card)), auctionType: auction.type, auctionTypeName: this._auctionName(auction.type), sellerId: seller.id, sellerName: seller.name, buyerId: winner.id, buyerName: winner.name, price, selfPurchase: winner.id === seller.id, sealedBids: auction.type === 'sealed' ? auction.sealedBids.map(bid => ({ playerId: bid.playerId, playerName: this.playerMap[bid.playerId]?.name || '', amount: bid.amount })).sort((a, b) => b.amount - a.amount || this._clockwiseDistance(seller.id, a.playerId) - this._clockwiseDistance(seller.id, b.playerId)) : null });
        this._log(`${winner.name} 以 ${price} 购买 ${auction.cards.map(card => card.artistName).join('、')}`);
        const nextSellerIndex = (this.players.indexOf(seller) + 1) % this.players.length;
        this.auction = null;
        this._queueMysteryChoice(seller, nextSellerIndex);
    }

    _clockwiseDistance(fromId, toId) { const from = this.players.findIndex(player => player.id === fromId); const to = this.players.findIndex(player => player.id === toId); return (to - from + this.players.length) % this.players.length; }

    _finishRound(trigger = { kind: 'seasonComplete' }) {
        const settledRound = this.round;
        const counts = this.roundSales.reduce((map, sale) => { map[sale.artistId] = (map[sale.artistId] || 0) + 1; return map; }, {});
        const ranking = ARTISTS.map(artist => ({ ...artist, count: counts[artist.id] || 0 })).sort((a, b) => b.count - a.count || ARTISTS.indexOf(a) - ARTISTS.indexOf(b));
        const roundValues = {}; ranking.forEach((artist, index) => { roundValues[artist.id] = artist.count ? ([30, 20, 10][index] || 0) : 0; });
        ARTISTS.forEach(artist => { this.artistValues[artist.id] += roundValues[artist.id] || 0; });
        const publicRanking = ranking.map((artist, index) => ({ rank: index + 1, artistId: artist.id, artistName: artist.name, count: artist.count, roundValue: roundValues[artist.id] || 0, cumulativeValue: this.artistValues[artist.id] || 0 }));
        // A painting's bank value is the sum of every value tile that artist
        // has earned so far, not merely this round's newly placed tile.
        const privateResults = {};
        const playerSummaries = [];
        this.players.forEach(player => {
            // Only artists ranked in this round's top three have value now.
            // Their payout uses the cumulative value tiles; all other artists
            // are worthless this round even if they were valuable earlier.
            const cashBefore = player.cash;
            const paintings = player.collection.map(card => ({ ...this._publicCard(card), value: roundValues[card.artistId] ? (this.artistValues[card.artistId] || 0) : 0 }));
            const payout = paintings.reduce((sum, card) => sum + card.value, 0);
            player.cash += payout;
            privateResults[player.id] = { playerId: player.id, playerName: player.name, cashBefore, cashAfter: player.cash, payout, paintings };
            playerSummaries.push({ playerId: player.id, playerName: player.name, collectionCount: paintings.length });
            player.collection = [];
        });
        this.seasonPrivateResults[settledRound] = privateResults;
        this.history.push({ round: settledRound, market: clone(this.market), counts: { ...counts }, values: { ...roundValues }, cumulativeValues: { ...this.artistValues }, ranking: clone(publicRanking), playerCollections: clone(playerSummaries), trigger: clone(trigger) });
        this._appendPresentationEvent({ kind: 'seasonTriggered', round: settledRound, trigger: clone(trigger), appearances: { ...counts } });
        this._appendPresentationEvent({ kind: 'seasonSettlement', round: settledRound, trigger: clone(trigger), ranking: clone(publicRanking), market: clone(this.market), players: clone(playerSummaries) });
        this._log(`第 ${settledRound} 季结算：${ranking.slice(0, 3).filter(artist => artist.count).map((artist, index) => `${artist.name} ${[30, 20, 10][index]}元`).join('、') || '没有热门艺术家'}`);
        if (settledRound >= ROUNDS) { this._finish(); return; }
        this.round += 1; const startingRound = this.round; this._dealRound(); this._beginAuction();
        if (this.status === 'playing' && this.round === startingRound && this.phase === 'auction') this._appendPresentationEvent({ kind: 'seasonStarted', round: this.round, sellerId: this.players[this.currentSellerIndex]?.id || null, sellerName: this.players[this.currentSellerIndex]?.name || '' });
        this._finishPresentation();
    }

    _finish() {
        this.status = 'ended'; this.phase = 'ended';
        const ranked = this.players.map(player => ({ player, fortune: player.cash })).sort((a, b) => b.fortune - a.fortune);
        this.winner = ranked[0]?.player || null;
        this.winners = ranked.filter(item => item.fortune === (ranked[0]?.fortune ?? 0)).map(item => item.player);
        this.finalStandings = ranked.map((item, index) => ({ rank: index + 1, id: item.player.id, name: item.player.name, color: item.player.color, fortune: item.fortune }));
        this._appendPresentationEvent({ kind: 'finalSettlement', standings: clone(this.finalStandings), winnerIds: this.winners.map(player => player.id), artistValues: { ...this.artistValues }, seasons: this.history.map(item => ({ round: item.round, ranking: clone(item.ranking), cumulativeValues: { ...item.cumulativeValues } })) });
        this._finishPresentation();
        this._log(`${this.winner?.name || '无人'} 以 ${ranked[0]?.fortune || 0} 元获胜`);
    }
    _auctionName(type) { return ({ open: '公开竞价', once: '一轮竞价', sealed: '秘密竞价', fixed: '定价拍卖', double: '双重拍卖' })[type] || type; }

    getPublicState() {
        const auction = this.auction;
        const current = this.phase === 'auction' ? this.players[this.currentSellerIndex] : this.phase === 'double_offer' ? this.players[this.pendingDouble?.currentPlayerIndex] : this.phase === 'mystery_offer' ? this.playerMap[this.mysteryPendingPlayerId] : auction ? this.players[auction.currentBidderIndex] : null;
        const sealed = auction?.type === 'sealed';
        const roundCounts = Object.fromEntries(ARTISTS.map(artist => [artist.id, this.roundSales.filter(item => item.artistId === artist.id).length]));
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            round: this.round,
            maxRounds: ROUNDS,
            rules: { players: '3–5', handSize: DEALS[this.mysteryEnabled ? 4 : this.players.length]?.[0], roundDeals: DEALS[this.mysteryEnabled ? 4 : this.players.length], rounds: 4, marketThreshold: 5, moneyHidden: true, mysteryPlayer: this.mysteryEnabled },
            currentTurn: current?.id || null,
            currentTurnName: current?.name || null,
            doubleOffer: this.pendingDouble ? { artist: this.pendingDouble.first.artistName, artistId: this.pendingDouble.first.artistId, originalSellerId: this.pendingDouble.originalSellerId, originalSellerName: this.playerMap[this.pendingDouble.originalSellerId]?.name || null, currentPlayerId: current?.id || null, currentPlayerName: current?.name || null, passed: [...this.pendingDouble.passed] } : null,
            mysteryOffer: this.phase === 'mystery_offer' ? { currentPlayerId: this.mysteryPendingPlayerId, currentPlayerName: this.playerMap[this.mysteryPendingPlayerId]?.name || null, remaining: this.mysteryHand.length } : null,
            auction: auction ? { artist: auction.card.artistName, artistId: auction.card.artistId, artists: auction.cards.map(card => card.artistName), sellerId: auction.sellerId, sellerName: this.playerMap[auction.sellerId]?.name, type: auction.type, typeName: this._auctionName(auction.type), fixedPrice: auction.fixedPrice, highestBid: sealed ? 0 : auction.highestBid, highestBidder: sealed ? null : auction.highestBidder, passed: sealed ? [] : [...auction.passed], bidCount: sealed ? auction.sealedBids.length : undefined } : null,
            market: this.market.map(item => ({ ...item })),
            roundCounts,
            artistValues: { ...this.artistValues },
            mysteryCount: this.mysteryEnabled ? this.mysteryHand.length : 0,
            players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, cash: null, handCount: player.hand.length, collectionCount: player.collection.length, isOnline: player.isOnline })),
            history: clone(this.history),
            presentation: clone(this.presentation),
            finalStandings: clone(this.finalStandings),
            actionLog: this.actionLog.slice(-20),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, cash: this.winner.cash } : null,
            winners: this.winners.map(player => ({ id: player.id, name: player.name, cash: player.cash })),
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myCash = player?.cash ?? null;
        const publicPlayer = state.players.find(item => item.id === playerId); if (publicPlayer) publicPlayer.cash = player.cash;
        state.myHand = player?.hand.map(card => ({ ...card })) || []; state.myCollection = player?.collection.map(card => ({ ...card })) || [];
        if (state.presentation?.events?.length) state.presentation.events = state.presentation.events.map(event => event.kind === 'seasonSettlement' ? { ...event, ownResult: clone(this.seasonPrivateResults[event.round]?.[playerId] || null) } : event);
        const isDoubleOffer = this.phase === 'double_offer' && this.pendingDouble?.currentPlayerIndex === this.players.findIndex(item => item.id === playerId);
        const isMysteryOffer = this.phase === 'mystery_offer' && this.mysteryPendingPlayerId === playerId;
        state.availableActions = { startAuction: this.phase === 'auction' && this.currentSellerIndex === this.players.findIndex(item => item.id === playerId), bid: this.phase === 'bidding' && this.auction && this.players[this.auction.currentBidderIndex]?.id === playerId, offerSecond: isDoubleOffer, passSecond: isDoubleOffer, secondArtistId: isDoubleOffer ? this.pendingDouble.first.artistId : null, revealMystery: isMysteryOffer, skipMystery: isMysteryOffer };
        return state;
    }

    handlePlayerLeave(playerId) { const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在' }; player.isOnline = false; if (this.players.filter(item => item.isOnline).length < 3) { this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null; } return this._success(`${player.name} 已离开`); }
    _startPresentation(actorId, action, firstEvent) { this.presentation = { sequence: ++this.presentationSequence, actorId, action, resolved: false, events: [] }; if (firstEvent) this._appendPresentationEvent(firstEvent); }
    _appendPresentationEvent(event) { if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system'); this.presentation.events.push({ sequence: ++this.presentationEventSequence, ...clone(event) }); }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, cash: this.winner.cash } : null; }
}

module.exports = ModernArtEngine;
module.exports.ARTISTS = ARTISTS;
module.exports.AUCTION_TYPES = AUCTION_TYPES;
module.exports.DEALS = DEALS;
