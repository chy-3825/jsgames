const LoveLetterGame = require('./engine');

const metadata = {
    type: 'loveletter',
    name: '\u60c5\u4e66',
    minPlayers: 2,
    maxPlayers: 4,
};

function sanitizeState(state, playerId, hand) {
    if (!state) return null;
    const revealHands = state.status === 'ended' || state.status === 'round_end';
    return {
        ...state,
        players: state.players.map(player => ({
            id: player.id,
            name: player.name,
            handCount: player.handCount,
            hand: revealHands ? player.hand : undefined,
            finalHand: revealHands ? player.hand : undefined,
            isAlive: player.isAlive,
            isOut: player.isOut,
            isProtected: player.isProtected,
            isCurrentTurn: player.isCurrentTurn,
        })),
        lastAction: sanitizeAction(state.lastAction, playerId),
        seatReveals: (state.seatReveals || []).map(action => sanitizeAction(action, playerId)),
        myHand: hand || [],
        myId: playerId,
        myIsCurrentTurn: state.currentTurn === playerId,
    };
}

function sanitizeAction(action, viewerId) {
    if (!action) return null;
    const privateFor = action.result?.privateFor;
    if (!action.isPrivate && (!privateFor || privateFor === viewerId)) {
        return { ...action, result: sanitizeResult(action.result, true) };
    }
    if (!action.isPrivate && privateFor && privateFor !== viewerId) {
        return { ...action, result: sanitizeResult(action.result, false) };
    }

    return {
        ...action,
        cardId: null,
        cardName: null,
        privateCardId: null,
        privateCardName: null,
        result: sanitizeResult(action.result, action.playerId === viewerId),
    };
}

function sanitizeResult(result, owner = true) {
    if (!result) return result;
    // Keep comparison/debug payloads out of the public action envelope.
    const { revealedCards: _revealedCards, ...publicResult } = result;
    return {
        ...publicResult,
        privateFor: owner ? publicResult.privateFor : null,
        privateMessage: owner ? publicResult.privateMessage : null,
        message: owner ? publicResult.message : (publicResult.publicMessage || '牧师查看了手牌'),
        revealedCard: owner ? publicResult.revealedCard : null,
    };
}

class LoveLetterSession {
    constructor(roomId, players, hostId, options = {}) {
        this.engine = new LoveLetterGame(roomId, players, hostId, options?.random);
    }

    start() {
        const state = this.engine.init();
        return { success: true, message: '\u6e38\u620f\u5df2\u5f00\u59cb', state };
    }

    handleAction(playerId, action) {
        if (action?.kind === 'startNextRound') return this.engine.startNextRound(playerId);
        if (action?.kind === 'acknowledgeAction') return this.engine.acknowledgeAction(playerId, action.actionId);
        if (action?.kind === 'discardCard') return this.engine.discardCard(playerId, action.cardIndex);
        if (!action || action.kind !== 'playCard') {
            return { success: false, message: '\u672a\u77e5\u7684\u60c5\u4e66\u52a8\u4f5c' };
        }
        return this.engine.playCard(playerId, action.cardIndex, action.targetId, action.guess);
    }

    handleSystemTick() {
        const result = this.engine.handleSystemTick();
        // Realtime ticks use the adapter-level `state` field as the signal
        // that a room needs a broadcast.  Normal Love Letter actions expose
        // `gameState` for historical compatibility, so mirror it here too;
        // Room.getPlayerGameState still builds the viewer-specific payload.
        if (result?.gameState && !result.state) result.state = result.gameState;
        return result;
    }

    getPlayerState(playerId) {
        const hand = this.engine.getPlayerHand(playerId);
        return sanitizeState(this.engine.getState(), playerId, hand);
    }

    getPlayerAction(action, playerId) {
        const sanitized = sanitizeAction(action?.action || action, playerId);
        if (!sanitized) return action;
        const isOwner = sanitized.playerId === playerId;
        const result = sanitized.result ? { ...sanitized.result } : null;
        if (result && isOwner && result.privateMessage) {
            result.message = result.privateMessage;
        }
        if (result && !isOwner) {
            result.privateMessage = null;
        }
        const envelope = {
            ...action,
            ...result,
            action: sanitized,
            message: result?.message || action?.message,
            privateMessage: isOwner ? result?.privateMessage : null,
        };
        // Room broadcasts the action envelope to every socket in addition to
        // the already-sanitized `state` field.  Sanitize both state aliases
        // here as well, otherwise a raw engine `gameState` could expose every
        // hand through the action payload.
        const hand = this.engine.getPlayerHand(playerId);
        if (action?.state) envelope.state = sanitizeState(action.state, playerId, hand);
        if (action?.gameState) envelope.gameState = sanitizeState(action.gameState, playerId, hand);
        return envelope;
    }

    getWinner() {
        const winners = this.engine.winners?.length ? this.engine.winners : this.engine.winner ? [this.engine.winner] : [];
        if (!winners.length) return null;
        return {
            id: winners[0].id,
            name: winners[0].name,
            winners: winners.map(player => ({ id: player.id, name: player.name })),
        };
    }
}

module.exports = {
    metadata,
    create(roomId, players, hostId, options = {}) {
        return new LoveLetterSession(roomId, players, hostId, options);
    },
};
