const CARDS = [
    { id: 1, name: '\u4f8d\u536b', value: 1, count: 5, description: '\u731c\u4e00\u540d\u73a9\u5bb6\u7684\u624b\u724c\uff0c\u4e0d\u80fd\u731c\u4f8d\u536b\u3002' },
    { id: 2, name: '\u7267\u5e08', value: 2, count: 2, description: '\u67e5\u770b\u4e00\u540d\u73a9\u5bb6\u7684\u624b\u724c\u3002' },
    { id: 3, name: '\u7537\u7235', value: 3, count: 2, description: '\u548c\u4e00\u540d\u73a9\u5bb6\u6bd4\u8f83\u624b\u724c\uff0c\u70b9\u6570\u4f4e\u8005\u51fa\u5c40\u3002' },
    { id: 4, name: '\u4f8d\u5973', value: 4, count: 2, description: '\u4fdd\u62a4\u81ea\u5df1\u76f4\u5230\u4f60\u7684\u4e0b\u4e00\u56de\u5408\u3002' },
    { id: 5, name: '\u738b\u5b50', value: 5, count: 2, description: '\u6307\u5b9a\u4e00\u540d\u73a9\u5bb6\u5f03\u724c\u5e76\u91cd\u62bd\u3002' },
    { id: 6, name: '\u56fd\u738b', value: 6, count: 1, description: '\u548c\u4e00\u540d\u73a9\u5bb6\u4ea4\u6362\u624b\u724c\u3002' },
    { id: 7, name: '\u4f2f\u7235\u592b\u4eba', value: 7, count: 1, description: '\u4e0e\u56fd\u738b\u6216\u738b\u5b50\u540c\u65f6\u5728\u624b\u65f6\u5fc5\u987b\u6253\u51fa\u4f2f\u7235\u592b\u4eba\u3002' },
    { id: 8, name: '\u516c\u4e3b', value: 8, count: 1, description: '\u6253\u51fa\u6216\u5f03\u6389\u516c\u4e3b\u4f1a\u7acb\u523b\u51fa\u5c40\u3002' },
];

function buildDeck() {
    const deck = [];
    for (const card of CARDS) {
        for (let i = 0; i < card.count; i++) {
            deck.push({ ...card, cardId: `${card.id}_${i}` });
        }
    }
    return deck;
}

class LoveLetterGame {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            isAlive: true,
            isProtected: false,
            isOut: false,
        }));
        this.deck = [];
        this.reservedCard = null;
        this.discardPile = [];
        this.hiddenDiscardPile = [];
        this.currentTurnIndex = 0;
        this.status = 'waiting';
        this.winner = null;
        this.round = 0;
        this.lastAction = null;
    }

    init() {
        if (this.players.length < 2 || this.players.length > 4) {
            throw new Error('\u60c5\u4e66\u9700\u8981 2-4 \u540d\u73a9\u5bb6');
        }

        this.players.forEach(player => {
            player.hand = [];
            player.isAlive = true;
            player.isProtected = false;
            player.isOut = false;
        });

        this.deck = this.shuffle(buildDeck());
        this.reservedCard = this.drawCard();
        this.discardPile = [];
        this.hiddenDiscardPile = [];
        this.currentTurnIndex = 0;
        this.status = 'playing';
        this.winner = null;
        this.round++;
        this.lastAction = null;

        for (const player of this.players) {
            player.hand.push(this.drawCard());
        }
        this.drawForCurrentPlayer();
        return this.getState();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    drawCard() {
        return this.deck.length > 0 ? this.deck.pop() : null;
    }

    drawCardForPrince() {
        const card = this.drawCard();
        if (card) return card;
        if (!this.reservedCard) return null;
        const reserved = this.reservedCard;
        this.reservedCard = null;
        return reserved;
    }

    drawForCurrentPlayer() {
        const player = this.getCurrentPlayer();
        if (!player || player.isOut || player.hand.length >= 2) return;
        const card = this.drawCard();
        if (card) player.hand.push(card);
    }

    getCurrentPlayer() {
        let attempts = 0;
        while (this.players[this.currentTurnIndex]?.isOut && attempts < this.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts++;
        }
        return this.players[this.currentTurnIndex] || null;
    }

    getAlivePlayers() {
        return this.players.filter(player => !player.isOut);
    }

    checkGameEnd() {
        const alive = this.getAlivePlayers();
        if (alive.length <= 1) {
            this.status = 'ended';
            this.winner = alive[0] || null;
            return true;
        }

        if (this.deck.length === 0) {
            this.status = 'ended';
            this.winner = alive.reduce((best, player) => {
                const value = player.hand[0]?.value || 0;
                const bestValue = best?.hand[0]?.value || 0;
                return value > bestValue ? player : best;
            }, alive[0]);
            return true;
        }

        return false;
    }

    playCard(playerId, cardIndex, targetId, guess) {
        const setup = this.prepareTurnCard(playerId, cardIndex);
        if (!setup.success) return setup;

        const { player, card } = setup;
        const countessError = this.validateCountessRule(player, card, 'playCard');
        if (countessError) return countessError;

        player.hand.splice(cardIndex, 1);

        let result;
        switch (card.id) {
            case 1:
                result = this.resolveGuard(player, targetId, guess);
                break;
            case 2:
                result = this.resolvePriest(player, targetId);
                break;
            case 3:
                result = this.resolveBaron(player, targetId);
                break;
            case 4:
                result = this.resolveHandmaid(player);
                break;
            case 5:
                result = this.resolvePrince(player, targetId || player.id);
                break;
            case 6:
                result = this.resolveKing(player, targetId);
                break;
            case 7:
                result = { success: true, message: `${player.name} \u6253\u51fa\u4e86\u4f2f\u7235\u592b\u4eba` };
                break;
            case 8:
                result = this.resolvePrincess(player);
                break;
            default:
                result = { success: false, message: '\u672a\u77e5\u724c' };
        }

        if (!result.success) {
            player.hand.splice(cardIndex, 0, card);
            return result;
        }

        this.discardPile.push(card);
        return this.finishAction(player, card, result, {
            kind: 'playCard',
            targetId: targetId || null,
            guess: guess || null,
            isPrivate: false,
        });
    }

    discardCard(playerId, cardIndex) {
        const setup = this.prepareTurnCard(playerId, cardIndex);
        if (!setup.success) return setup;

        const { player, card } = setup;
        const countessError = this.validateCountessRule(player, card, 'discardCard');
        if (countessError) return countessError;

        player.hand.splice(cardIndex, 1);
        this.hiddenDiscardPile.push({ ownerId: player.id, card });

        let result = {
            success: true,
            message: `${player.name} \u80cc\u9762\u5f03\u4e86\u4e00\u5f20\u724c`,
            privateMessage: `${player.name} \u80cc\u9762\u5f03\u6389\u4e86 ${card.name}`,
        };
        if (card.id === 8) {
            player.isOut = true;
            player.isAlive = false;
            result = {
                success: true,
                message: `${player.name} \u80cc\u9762\u5f03\u4e86\u4e00\u5f20\u724c\uff0c\u51fa\u5c40`,
                privateMessage: `${player.name} \u80cc\u9762\u5f03\u6389\u516c\u4e3b\uff0c\u51fa\u5c40`,
                eliminated: player.id,
            };
        }

        return this.finishAction(player, card, result, {
            kind: 'discardCard',
            targetId: null,
            guess: null,
            isPrivate: true,
        });
    }

    prepareTurnCard(playerId, cardIndex) {
        if (this.status !== 'playing') {
            return { success: false, message: '\u6e38\u620f\u5df2\u7ed3\u675f' };
        }

        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isOut) {
            return { success: false, message: '\u73a9\u5bb6\u4e0d\u5728\u5c40\u5185\u6216\u5df2\u51fa\u5c40' };
        }

        const current = this.getCurrentPlayer();
        if (!current || current.id !== playerId) {
            return { success: false, message: '\u8fd8\u6ca1\u5230\u4f60\u7684\u56de\u5408' };
        }

        if (cardIndex < 0 || cardIndex >= player.hand.length) {
            return { success: false, message: '\u65e0\u6548\u7684\u624b\u724c' };
        }

        const card = player.hand[cardIndex];
        if (!card) {
            return { success: false, message: '\u627e\u4e0d\u5230\u8fd9\u5f20\u724c' };
        }

        return { success: true, player, card };
    }

    finishAction(player, card, result, meta) {
        const ended = this.checkGameEnd();
        this.lastAction = {
            kind: meta.kind,
            playerId: player.id,
            playerName: player.name,
            cardId: meta.isPrivate ? null : card.id,
            cardName: meta.isPrivate ? null : card.name,
            privateCardId: meta.isPrivate ? card.id : null,
            privateCardName: meta.isPrivate ? card.name : null,
            targetId: meta.targetId,
            guess: meta.guess,
            isPrivate: meta.isPrivate,
            result,
        };

        if (!ended) this.nextTurn();
        return { ...result, ended, gameState: this.getState(), action: this.lastAction };
    }

    validateCountessRule(player, card, kind) {
        const hasCountess = player.hand.some(c => c.id === 7);
        const hasKingOrPrince = player.hand.some(c => c.id === 5 || c.id === 6);
        if (!hasCountess || !hasKingOrPrince) return null;
        if (kind === 'playCard' && card.id === 7) return null;
        return { success: false, message: '\u624b\u91cc\u6709\u4f2f\u7235\u592b\u4eba\u548c\u56fd\u738b\u6216\u738b\u5b50\u65f6\uff0c\u53ea\u80fd\u6253\u51fa\u4f2f\u7235\u592b\u4eba\uff0c\u4e0d\u80fd\u5f03\u6389' };
    }

    findTarget(targetId, allowSelf = false, actorId = null) {
        const target = this.players.find(p => p.id === targetId);
        if (!target || target.isOut) return null;
        if (!allowSelf && target.id === actorId) return null;
        if (target.isProtected) return null;
        return target;
    }

    resolveGuard(player, targetId, guess) {
        if (!guess || guess < 2 || guess > 8) {
            return { success: false, message: '\u731c\u6d4b\u5fc5\u987b\u662f 2-8' };
        }
        const target = this.findTarget(targetId, false, player.id);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };

        const targetCard = target.hand[0];
        if (targetCard?.value === guess) {
            target.isOut = true;
            target.isAlive = false;
            return { success: true, message: `${player.name} \u731c\u5bf9\u4e86\uff0c${target.name} \u51fa\u5c40`, eliminated: target.id };
        }
        return { success: true, message: `${player.name} \u731c\u9519\u4e86` };
    }

    resolvePriest(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        return {
            success: true,
            message: `${target.name} \u7684\u624b\u724c\u662f ${target.hand[0]?.name || '\u65e0'}`,
            target: target.id,
            revealedCard: target.hand[0] || null,
        };
    }

    resolveBaron(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };

        const playerValue = player.hand.find(Boolean)?.value || 0;
        const targetValue = target.hand.find(Boolean)?.value || 0;
        if (playerValue > targetValue) {
            target.isOut = true;
            target.isAlive = false;
            return { success: true, message: `${target.name} \u51fa\u5c40`, eliminated: target.id };
        }
        if (targetValue > playerValue) {
            player.isOut = true;
            player.isAlive = false;
            return { success: true, message: `${player.name} \u51fa\u5c40`, eliminated: player.id };
        }
        return { success: true, message: '\u70b9\u6570\u76f8\u540c\uff0c\u65e0\u4eba\u51fa\u5c40' };
    }

    resolveHandmaid(player) {
        player.isProtected = true;
        return { success: true, message: `${player.name} \u8fdb\u5165\u4fdd\u62a4\u72b6\u6001` };
    }

    resolvePrince(player, targetId) {
        const target = this.findTarget(targetId, true, null);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };

        const discarded = target.hand.shift();
        if (discarded) this.discardPile.push(discarded);
        if (discarded?.id === 8) {
            target.isOut = true;
            target.isAlive = false;
            return { success: true, message: `${target.name} \u5f03\u6389\u516c\u4e3b\uff0c\u51fa\u5c40`, eliminated: target.id };
        }

        const newCard = this.drawCardForPrince();
        if (newCard) {
            target.hand.push(newCard);
            return { success: true, message: `${target.name} \u5f03\u724c\u5e76\u91cd\u62bd` };
        }

        target.isOut = true;
        target.isAlive = false;
        return { success: true, message: `${target.name} \u65e0\u724c\u53ef\u62bd\uff0c\u51fa\u5c40`, eliminated: target.id };
    }

    resolveKing(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        [player.hand, target.hand] = [target.hand, player.hand];
        return { success: true, message: `${player.name} \u548c ${target.name} \u4ea4\u6362\u4e86\u624b\u724c` };
    }

    resolvePrincess(player) {
        player.isOut = true;
        player.isAlive = false;
        return { success: true, message: `${player.name} \u6253\u51fa\u516c\u4e3b\uff0c\u51fa\u5c40`, eliminated: player.id };
    }

    nextTurn() {
        let attempts = 0;
        do {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts++;
        } while (this.players[this.currentTurnIndex].isOut && attempts < this.players.length);

        const current = this.players[this.currentTurnIndex];
        if (current) current.isProtected = false;
        this.drawForCurrentPlayer();
    }

    getState() {
        return {
            status: this.status,
            round: this.round,
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                handCount: player.hand.length,
                hand: player.hand,
                isAlive: player.isAlive,
                isOut: player.isOut,
                isProtected: player.isProtected,
                isCurrentTurn: player.id === this.players[this.currentTurnIndex]?.id,
            })),
            deckCount: this.deck.length,
            reservedCount: this.reservedCard ? 1 : 0,
            discardCount: this.discardPile.length + this.hiddenDiscardPile.length,
            publicDiscardCount: this.discardPile.length,
            hiddenDiscardCount: this.hiddenDiscardPile.length,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
            lastAction: this.lastAction,
        };
    }

    getPlayerHand(playerId) {
        return this.players.find(player => player.id === playerId)?.hand || null;
    }

    getAvailableActions(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isOut) return null;
        const current = this.getCurrentPlayer();
        if (!current || current.id !== playerId) {
            return { canAct: false, reason: '\u8fd8\u6ca1\u5230\u4f60\u7684\u56de\u5408' };
        }
        return { canAct: true, hand: player.hand };
    }
}

module.exports = LoveLetterGame;




