const LoveLetterGame = require('./engine');

const metadata = {
    type: 'loveletter',
    name: '\u60c5\u4e66',
    minPlayers: 2,
    maxPlayers: 4,
};

function sanitizeState(state, playerId, hand) {
    if (!state) return null;
    return {
        ...state,
        players: state.players.map(player => ({
            id: player.id,
            name: player.name,
            handCount: player.handCount,
            hand: state.status === 'ended' ? player.hand : undefined,
            finalHand: state.status === 'ended' ? player.hand : undefined,
            isAlive: player.isAlive,
            isOut: player.isOut,
            isProtected: player.isProtected,
            isCurrentTurn: player.isCurrentTurn,
        })),
        lastAction: sanitizeAction(state.lastAction, playerId),
        myHand: hand || [],
        myId: playerId,
        myIsCurrentTurn: state.currentTurn === playerId,
    };
}

function sanitizeAction(action, viewerId) {
    if (!action) return null;
    if (!action.isPrivate || action.playerId === viewerId) {
        return action;
    }

    return {
        ...action,
        cardId: null,
        cardName: null,
        privateCardId: null,
        privateCardName: null,
        result: sanitizeResult(action.result),
    };
}

function sanitizeResult(result) {
    if (!result) return result;
    return {
        ...result,
        privateMessage: null,
        message: result.message,
    };
}

class LoveLetterSession {
    constructor(roomId, players) {
        this.engine = new LoveLetterGame(roomId, players);
    }

    start() {
        const state = this.engine.init();
        return { success: true, message: '\u6e38\u620f\u5df2\u5f00\u59cb', state };
    }

    handleAction(playerId, action) {
        if (!action || !['discardCard', 'playCard'].includes(action.kind)) {
            return { success: false, message: '\u672a\u77e5\u7684\u60c5\u4e66\u52a8\u4f5c' };
        }
        if (action.kind === 'playCard') {
            return this.engine.playCard(playerId, action.cardIndex, action.targetId, action.guess);
        }
        return this.engine.discardCard(playerId, action.cardIndex);
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
        return {
            ...action,
            ...result,
            action: sanitized,
            message: result?.message || action?.message,
            privateMessage: isOwner ? result?.privateMessage : null,
        };
    }

    getWinner() {
        const winner = this.engine.winner;
        return winner ? { id: winner.id, name: winner.name } : null;
    }
}

module.exports = {
    metadata,
    create(roomId, players) {
        return new LoveLetterSession(roomId, players);
    },
};


