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

const TARGET_ACKNOWLEDGEMENT_MS = 4000;
const TARGET_REACTION_MS = 900;

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
    constructor(roomId, players, hostId = null, random = Math.random) {
        this.roomId = roomId;
        this.hostId = hostId || players[0]?.id || null;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            isAlive: true,
            isProtected: false,
            isOut: false,
            favorTokens: 0,
        }));
        this.deck = [];
        this.reservedCard = null;
        this.setAsideCards = [];
        this.discardPile = [];
        this.hiddenDiscardPile = [];
        this.publicDiscard = [];
        this.currentTurnIndex = 0;
        this.status = 'waiting';
        this.winner = null;
        this.winners = [];
        this.round = 0;
        this.targetFavor = players.length === 2 ? 7 : players.length === 3 ? 5 : 4;
        this.roundWinner = null;
        this.roundWinners = [];
        this.nextRoundStarterId = null;
        this.lastAction = null;
        this.pendingAction = null;
        this.phase = 'turn';
        this.actionSequence = 0;
        this.endReason = null;
        this.actionLog = [];
    }

    init(startingPlayerId = null, preserveFavor = true) {
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
        this.setAsideCards = [];
        if (this.players.length === 2) {
            for (let i = 0; i < 3; i++) {
                const card = this.drawCard();
                if (card) this.setAsideCards.push(card);
            }
        }
        this.discardPile = [];
        this.hiddenDiscardPile = [];
        this.publicDiscard = [];
        this.currentTurnIndex = startingPlayerId ? Math.max(0, this.players.findIndex(player => player.id === startingPlayerId)) : 0;
        this.status = 'playing';
        if (!preserveFavor) this.players.forEach(player => { player.favorTokens = 0; });
        this.winner = null;
        this.winners = [];
        this.round++;
        this.roundWinner = null;
        this.roundWinners = [];
        this.lastAction = null;
        this.pendingAction = null;
        this.phase = 'turn';
        this.endReason = null;

        for (const player of this.players) {
            player.hand.push(this.drawCard());
        }
        this.drawForCurrentPlayer();
        return this.getState();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
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
            this._completeRound(alive[0] || null, 'elimination');
            return true;
        }

        if (this.deck.length === 0) {
            const highestValue = Math.max(...alive.map(player => player.hand[0]?.value || 0));
            const highest = alive.filter(player => (player.hand[0]?.value || 0) === highestValue);
            const highestDiscard = Math.max(...highest.map(player => this._discardValue(player.id)));
            const roundWinners = highest.filter(player => this._discardValue(player.id) === highestDiscard);
            this._completeRound(roundWinners, 'showdown');
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

        const effectiveTargetId = card.id === 5 ? targetId || player.id : targetId || null;
        const intent = this.validatePlayIntent(player, card, effectiveTargetId, guess);
        if (!intent.success) return intent;

        player.hand.splice(cardIndex, 1);

        this.discardPile.push(card);
        this.publicDiscard.push({ ownerId: player.id, card: { ...card }, reason: 'played' });
        const actionId = ++this.actionSequence;

        if (intent.requiresAcknowledgement) {
            return this.beginTargetAcknowledgement(player, card, effectiveTargetId, guess, actionId);
        }

        const result = this.resolveCardEffect(player, card, effectiveTargetId, guess);
        return this.finishAction(player, card, result, {
            kind: 'playCard',
            targetId: effectiveTargetId,
            guess: guess || null,
            isPrivate: false,
            actionId,
        });
    }

    resolveCardEffect(player, card, targetId, guess) {
        switch (card.id) {
            case 1:
                return this.resolveGuard(player, targetId, guess);
            case 2:
                return this.resolvePriest(player, targetId);
            case 3:
                return this.resolveBaron(player, targetId);
            case 4:
                return this.resolveHandmaid(player);
            case 5:
                return this.resolvePrince(player, targetId || player.id);
            case 6:
                return this.resolveKing(player, targetId);
            case 7:
                return { success: true, message: `${player.name} \u6253\u51fa\u4e86\u4f2f\u7235\u592b\u4eba` };
            case 8:
                return this.resolvePrincess(player);
            default:
                return { success: false, message: '\u672a\u77e5\u724c' };
        }
    }

    validatePlayIntent(player, card, targetId, guess) {
        if ([1, 2, 3, 6].includes(card.id)) {
            const target = this.findTarget(targetId, false, player.id);
            if (!target) {
                if (!this.hasTargetableOpponent(player.id)) return { success: true, requiresAcknowledgement: false };
                return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
            }
            if (card.id === 1 && (!guess || guess < 2 || guess > 8)) {
                return { success: false, message: '\u731c\u6d4b\u5fc5\u987b\u662f 2-8' };
            }
            return { success: true, requiresAcknowledgement: true };
        }

        if (card.id === 5) {
            const target = this.findTarget(targetId, true, player.id);
            if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
            return { success: true, requiresAcknowledgement: target.id !== player.id };
        }

        return { success: true, requiresAcknowledgement: false };
    }

    beginTargetAcknowledgement(player, card, targetId, guess, actionId) {
        const target = this.players.find(candidate => candidate.id === targetId);
        const announcedAt = Date.now();
        const availableAt = announcedAt + TARGET_REACTION_MS;
        const deadlineAt = announcedAt + TARGET_ACKNOWLEDGEMENT_MS;
        this.phase = 'target_ack';
        this.pendingAction = {
            actionId,
            playerId: player.id,
            playerName: player.name,
            card: { ...card },
            targetId: target.id,
            targetName: target.name,
            guess: guess || null,
            availableAt,
            deadlineAt,
        };
        const guessedRole = CARDS.find(candidate => candidate.id === Number(guess))?.name || '\u672a\u77e5\u89d2\u8272';
        const guessText = card.id === 1 ? `\uff0c\u731c\u6d4b ${guess} \u00b7 ${guessedRole}` : '';
        const message = `${player.name} \u5bf9 ${target.name} \u6253\u51fa\u4e86${card.name}${guessText}\uff0c\u7b49\u5f85\u5bf9\u65b9\u77e5\u6653`;
        this.lastAction = {
            kind: 'playCard',
            actionId,
            playerId: player.id,
            playerName: player.name,
            cardId: card.id,
            cardName: card.name,
            targetId,
            guess: guess || null,
            isPrivate: false,
            result: { success: true, pendingAcknowledgement: true, message },
        };
        return { success: true, pendingAcknowledgement: true, message, ended: false, gameState: this.getState(), action: this.lastAction };
    }

    acknowledgeAction(playerId, actionId) {
        const pending = this.pendingAction;
        if (!pending) {
            if (this.lastAction?.actionId === Number(actionId)) {
                return { success: true, alreadyResolved: true, message: '\u8be5\u51fa\u724c\u5df2\u7ecf\u7ed3\u7b97', ended: this.status === 'ended', gameState: this.getState(), action: this.lastAction };
            }
            return { success: false, message: '\u5f53\u524d\u6ca1\u6709\u7b49\u5f85\u786e\u8ba4\u7684\u51fa\u724c', state: this.getState() };
        }
        if (Number(actionId) !== pending.actionId) {
            return { success: false, message: '\u8fd9\u5c01\u4fe1\u5df2\u7ecf\u8fc7\u671f', state: this.getState() };
        }
        if (playerId === pending.targetId && Date.now() < pending.availableAt) {
            return { success: false, message: '\u8bf7\u5148\u67e5\u770b\u5b8c\u6574\u7684\u51fa\u724c\u5c55\u793a', state: this.getState() };
        }
        if (playerId !== pending.targetId && Date.now() < pending.deadlineAt) {
            return { success: false, message: '\u8bf7\u7b49\u5f85\u76ee\u6807\u73a9\u5bb6\u77e5\u6653', state: this.getState() };
        }

        const player = this.players.find(candidate => candidate.id === pending.playerId);
        const card = pending.card;
        this.pendingAction = null;
        this.phase = 'turn';
        const result = this.resolveCardEffect(player, card, pending.targetId, pending.guess);
        return this.finishAction(player, card, result, {
            kind: 'playCard',
            targetId: pending.targetId,
            guess: pending.guess,
            isPrivate: false,
            actionId: pending.actionId,
        });
    }

    discardCard(playerId, cardIndex) {
        return { success: false, message: '\u6807\u51c6\u60c5\u4e66\u6bcf\u56de\u5408\u5fc5\u987b\u6253\u51fa\u4e00\u5f20\u724c\uff0c\u4e0d\u80fd\u80cc\u9762\u5f03\u724c' };
    }

    prepareTurnCard(playerId, cardIndex) {
        if (this.pendingAction) {
            return { success: false, message: '请先等待目标玩家知晓上一封信' };
        }
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
        const roundEnded = this.checkGameEnd();
        this.lastAction = {
            kind: meta.kind,
            actionId: meta.actionId,
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

        if (!roundEnded) this.nextTurn();
        this.phase = this.status === 'playing' ? 'turn' : 'round_result';
        const ended = this.status === 'ended';
        return { ...result, ended, gameState: this.getState(), action: this.lastAction };
    }

    _completeRound(roundWinner, reason) {
        const roundWinners = (Array.isArray(roundWinner) ? roundWinner : [roundWinner]).filter(Boolean);
        this.roundWinners = roundWinners;
        this.roundWinner = roundWinners[0] || null;
        this.endReason = reason;
        roundWinners.forEach(player => { player.favorTokens += 1; });
        const gameWinners = roundWinners.filter(player => player.favorTokens >= this.targetFavor);
        if (gameWinners.length) {
            this.status = 'ended';
            this.phase = 'round_result';
            this.winners = gameWinners;
            this.winner = gameWinners[0];
            const names = gameWinners.map(player => player.name).join('、');
            this.actionLog.push(`${names} 赢得本轮并集齐 ${this.targetFavor} 枚爱心筹码，赢下情书！`);
            return;
        }
        const nextStarter = roundWinners[0]?.id || this.getCurrentPlayer()?.id || this.players[0]?.id;
        this.nextRoundStarterId = nextStarter;
        this.status = 'round_end';
        this.phase = 'round_result';
        const names = roundWinners.map(player => player.name).join('、') || '无人';
        this.actionLog.push(`${names} 赢得第 ${this.round} 轮，获得 1 枚爱心筹码`);
        if (this.actionLog.length > 20) this.actionLog = this.actionLog.slice(-20);
    }

    startNextRound(playerId) {
        if (this.status !== 'round_end') {
            return { success: false, message: '当前没有等待开始的下一轮', state: this.getState() };
        }
        if (!this.roundWinners.some(player => player.id === playerId) && playerId !== this.hostId) {
            return { success: false, message: '只有本轮胜者或房主可以开始下一轮', state: this.getState() };
        }
        const starterId = this.nextRoundStarterId || this.roundWinner?.id || this.players[0]?.id;
        const winnerName = this.roundWinners.map(player => player.name).join('、') || '随机玩家';
        this.init(starterId, true);
        this.roundWinner = null;
        this.nextRoundStarterId = null;
        this.actionLog.unshift(`第 ${this.round} 轮开始：${winnerName} 先手`);
        if (this.actionLog.length > 20) this.actionLog = this.actionLog.slice(-20);
        return { success: true, message: `第 ${this.round} 轮开始`, state: this.getState() };
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
        if (target.isProtected && !(allowSelf && target.id === actorId)) return null;
        return target;
    }

    hasTargetableOpponent(playerId) {
        return this.getAlivePlayers().some(player => player.id !== playerId && !player.isProtected);
    }

    resolveGuard(player, targetId, guess) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) {
            // Official edge case: if every other player is protected by a
            // Handmaid, cards that require another player are still played,
            // but their effect simply does nothing.
            if (!this.hasTargetableOpponent(player.id)) return { success: true, message: '\u6240\u6709\u5176\u4ed6\u73a9\u5bb6\u90fd\u53d7\u4fdd\u62a4\uff0c\u4f8d\u536b\u6548\u679c\u8431\u53d1', noEffect: true };
            return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        }
        if (!guess || guess < 2 || guess > 8) {
            return { success: false, message: '\u731c\u6d4b\u5fc5\u987b\u662f 2-8' };
        }

        const targetCard = target.hand[0];
        if (targetCard?.value === guess) {
            this.eliminatePlayer(target);
            return { success: true, message: `${player.name} \u731c\u5bf9\u4e86\uff0c${target.name} \u51fa\u5c40`, eliminated: target.id, revealedCard: targetCard };
        }
        return { success: true, message: `${player.name} \u731c\u9519\u4e86`, guardMiss: true };
    }

    resolvePriest(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) {
            if (!this.hasTargetableOpponent(player.id)) return { success: true, message: '\u6240\u6709\u5176\u4ed6\u73a9\u5bb6\u90fd\u53d7\u4fdd\u62a4\uff0c\u7267\u5e08\u6548\u679c\u5931\u6548', noEffect: true };
            return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        }
        return {
            success: true,
            message: `${target.name} \u7684\u624b\u724c\u662f ${target.hand[0]?.name || '\u65e0'}`,
            privateFor: player.id,
            publicMessage: `${player.name} \u4f7f\u7528\u4e86\u7267\u5e08`,
            target: target.id,
            revealedCard: target.hand[0] || null,
        };
    }

    resolveBaron(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) {
            if (!this.hasTargetableOpponent(player.id)) return { success: true, message: '\u6240\u6709\u5176\u4ed6\u73a9\u5bb6\u90fd\u53d7\u4fdd\u62a4\uff0c\u7537\u7235\u6548\u679c\u5931\u6548', noEffect: true };
            return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        }

        const playerCard = player.hand.find(Boolean) || null;
        const targetCard = target.hand.find(Boolean) || null;
        const revealedCards = { [player.id]: playerCard, [target.id]: targetCard };
        const playerValue = playerCard?.value || 0;
        const targetValue = targetCard?.value || 0;
        if (playerValue > targetValue) {
            this.eliminatePlayer(target);
            return { success: true, message: `${target.name} \u51fa\u5c40`, eliminated: target.id, revealedCard: targetCard, revealedCards };
        }
        if (targetValue > playerValue) {
            this.eliminatePlayer(player);
            return { success: true, message: `${player.name} \u51fa\u5c40`, eliminated: player.id, revealedCard: playerCard, revealedCards };
        }
        return { success: true, message: '\u70b9\u6570\u76f8\u540c\uff0c\u65e0\u4eba\u51fa\u5c40', revealedCards };
    }

    resolveHandmaid(player) {
        player.isProtected = true;
        return { success: true, message: `${player.name} \u8fdb\u5165\u4fdd\u62a4\u72b6\u6001` };
    }

    resolvePrince(player, targetId) {
        const target = this.findTarget(targetId, true, player.id);
        if (!target) return { success: false, message: '\u65e0\u6548\u76ee\u6807' };

        const discarded = target.hand.shift();
        if (discarded) {
            this.discardPile.push(discarded);
            this.publicDiscard.push({ ownerId: target.id, card: { ...discarded }, reason: 'prince' });
        }
        if (discarded?.id === 8) {
            this.eliminatePlayer(target);
            return { success: true, message: `${target.name} \u5f03\u6389\u516c\u4e3b\uff0c\u51fa\u5c40`, eliminated: target.id, revealedCard: discarded };
        }

        const newCard = this.drawCardForPrince();
        if (newCard) {
            target.hand.push(newCard);
            return { success: true, message: `${target.name} \u5f03\u724c\u5e76\u91cd\u62bd` };
        }

        this.eliminatePlayer(target);
        return { success: true, message: `${target.name} \u65e0\u724c\u53ef\u62bd\uff0c\u51fa\u5c40`, eliminated: target.id };
    }

    resolveKing(player, targetId) {
        const target = this.findTarget(targetId, false, player.id);
        if (!target) {
            if (!this.hasTargetableOpponent(player.id)) return { success: true, message: '\u6240\u6709\u5176\u4ed6\u73a9\u5bb6\u90fd\u53d7\u4fdd\u62a4\uff0c\u56fd\u738b\u6548\u679c\u5931\u6548', noEffect: true };
            return { success: false, message: '\u65e0\u6548\u76ee\u6807' };
        }
        [player.hand, target.hand] = [target.hand, player.hand];
        return { success: true, message: `${player.name} \u548c ${target.name} \u4ea4\u6362\u4e86\u624b\u724c` };
    }

    resolvePrincess(player) {
        this.eliminatePlayer(player);
        return { success: true, message: `${player.name} \u6253\u51fa\u516c\u4e3b\uff0c\u51fa\u5c40`, eliminated: player.id, revealedCard: { ...CARDS.find(card => card.id === 8) } };
    }

    eliminatePlayer(player) {
        if (!player || player.isOut) return;
        player.isOut = true;
        player.isAlive = false;
        player.isProtected = false;
        for (const discarded of player.hand.splice(0)) {
            this.discardPile.push(discarded);
            this.publicDiscard.push({ ownerId: player.id, card: { ...discarded }, reason: 'eliminated' });
        }
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
            phase: this.phase,
            hostId: this.hostId,
            round: this.round,
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                handCount: player.hand.length,
                // Hands stay hidden during a round.  They are revealed only
                // after the round has ended, when the official showdown is
                // resolved for everyone at the table.
                hand: this.status === 'ended' || this.status === 'round_end' ? player.hand.map(card => ({ ...card })) : undefined,
                isAlive: player.isAlive,
                isOut: player.isOut,
                isProtected: player.isProtected,
                isCurrentTurn: player.id === this.players[this.currentTurnIndex]?.id,
            })),
            deckCount: this.deck.length,
            reservedCount: this.reservedCard ? 1 : 0,
            setAsideCount: this.setAsideCards.length,
            // Two-player face-down cards are never revealed, including in
            // the public start/action payloads.  Keep placeholders so the UI
            // can still show how many cards were removed from the round.
            setAsideCards: this.setAsideCards.map(() => null),
            discardCount: this.discardPile.length + this.hiddenDiscardPile.length,
            publicDiscardCount: this.publicDiscard.length,
            hiddenDiscardCount: this.hiddenDiscardPile.length,
            publicDiscard: this.publicDiscard.map(entry => ({ ...entry, card: { ...entry.card } })),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
            winners: this.winners.map(player => ({ id: player.id, name: player.name })),
            roundWinner: this.roundWinner ? { id: this.roundWinner.id, name: this.roundWinner.name } : null,
            roundWinners: this.roundWinners.map(player => ({ id: player.id, name: player.name })),
            targetFavor: this.targetFavor,
            favorTokens: this.players.map(player => ({ id: player.id, count: player.favorTokens })),
            endReason: this.endReason,
            nextRoundStarterId: this.nextRoundStarterId,
            pendingAction: this.pendingAction ? {
                actionId: this.pendingAction.actionId,
                playerId: this.pendingAction.playerId,
                playerName: this.pendingAction.playerName,
                cardId: this.pendingAction.card.id,
                cardName: this.pendingAction.card.name,
                targetId: this.pendingAction.targetId,
                targetName: this.pendingAction.targetName,
                guess: this.pendingAction.guess,
                availableAt: this.pendingAction.availableAt,
                remainingReadyMs: Math.max(0, this.pendingAction.availableAt - Date.now()),
                deadlineAt: this.pendingAction.deadlineAt,
                remainingMs: Math.max(0, this.pendingAction.deadlineAt - Date.now()),
            } : null,
            lastAction: this.lastAction,
        };
    }

    getPlayerHand(playerId) {
        return this.players.find(player => player.id === playerId)?.hand || null;
    }

    getAvailableActions(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.isOut) return null;
        if (this.pendingAction) {
            return {
                canAct: false,
                canAcknowledge: this.pendingAction.targetId === playerId,
                reason: this.pendingAction.targetId === playerId ? '请查看并知晓这封信' : `等待 ${this.pendingAction.targetName} 知晓`,
            };
        }
        if (this.status !== 'playing') {
            return { canAct: false, reason: this.status === 'round_end' ? '等待开始下一轮' : '游戏已结束' };
        }
        const current = this.getCurrentPlayer();
        if (!current || current.id !== playerId) {
            return { canAct: false, reason: '\u8fd8\u6ca1\u5230\u4f60\u7684\u56de\u5408' };
        }
        return { canAct: true, hand: player.hand };
    }

    _discardValue(playerId) {
        const publicEntries = this.publicDiscard.filter(entry => entry.ownerId === playerId);
        const publicCardIds = new Set(publicEntries.map(entry => entry.card?.cardId).filter(Boolean));
        const publicValue = publicEntries.reduce((sum, entry) => sum + (entry.card?.value || 0), 0);
        const hiddenValue = this.hiddenDiscardPile
            .filter(entry => entry.ownerId === playerId && (!entry.card?.cardId || !publicCardIds.has(entry.card.cardId)))
            .reduce((sum, entry) => sum + (entry.card?.value || 0), 0);
        return publicValue + hiddenValue;
    }
}

module.exports = LoveLetterGame;
