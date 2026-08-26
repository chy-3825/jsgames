const COLORS = ['red', 'yellow', 'green', 'blue', 'white'];
const VALUES = [1, 2, 3, 4, 5];
const COLOR_LABELS = { red: '红', yellow: '黄', green: '绿', blue: '蓝', white: '白' };
const HAND_SIZE = players => players <= 3 ? 5 : 4;
const SCORE_RATINGS = [
    { max: 5, label: '糟糕，观众喝倒彩' },
    { max: 10, label: '一般，只有零星掌声' },
    { max: 15, label: '合格的尝试' },
    { max: 20, label: '优秀，令人愉悦' },
    { max: 24, label: '惊艳，令人难忘' },
    { max: 25, label: '传奇，完美烟花' },
];

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function emptyHints() {
    return { colors: [], values: [], notColors: [], notValues: [] };
}

function withHints(card) {
    const hints = card?.hints || {};
    return {
        ...card,
        hints: {
            colors: Array.isArray(hints.colors) ? hints.colors.slice() : [],
            values: Array.isArray(hints.values) ? hints.values.slice() : [],
            notColors: Array.isArray(hints.notColors) ? hints.notColors.slice() : [],
            notValues: Array.isArray(hints.notValues) ? hints.notValues.slice() : [],
        },
    };
}

function buildDeck() {
    const deck = [];
    for (const color of COLORS) {
        for (const value of [1, 1, 1, 2, 2, 3, 3, 4, 4, 5]) {
            // Card ids are deliberately opaque because owners receive ids for
            // their hidden cards in order to retain DOM identity across clues.
            deck.push({ id: `h-${deck.length}`, color, value });
        }
    }
    return deck;
}

class HanabiEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.options = options && typeof options === 'object' ? { ...options } : {};
        this.players = players.map(player => ({ id: player.id, name: player.name, hand: [], isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.deck = [];
        this.discard = [];
        this.fireworks = Object.fromEntries(COLORS.map(color => [color, 0]));
        this.clues = 8;
        this.strikes = 0;
        this.phase = 'waiting';
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.startingPlayerId = null;
        this.finalTurnsRemaining = null;
        this.endReason = null;
        this.actionLog = [];
        this.lastAction = null;
        this.actionSequence = 0;
        // Hanabi is cooperative: a perfect display has no individual winner.
        this.winner = null;
    }

    start() {
        if (this.status !== 'waiting') {
            return { success: false, message: '花火已经开始，不能重复开始' };
        }
        if (this.players.length < 2 || this.players.length > 5) {
            return { success: false, message: '花火需要 2–5 名玩家' };
        }

        this.deck = this._shuffle(buildDeck());
        this.discard = [];
        this.fireworks = Object.fromEntries(COLORS.map(color => [color, 0]));
        this.clues = 8;
        this.strikes = 0;
        this.finalTurnsRemaining = null;
        this.endReason = null;
        this.winner = null;
        this.lastAction = null;
        this.actionSequence = 0;
        const size = HAND_SIZE(this.players.length);
        const startingCard = this.deck[0];
        this.players.forEach(player => {
            player.isOnline = true;
            player.hand = Array.from({ length: size }, () => this._draw()).map(withHints);
        });

        this.currentTurnIndex = this._startingPlayerIndex(startingCard);
        this.startingPlayerId = this.players[this.currentTurnIndex]?.id || null;
        this.phase = 'action';
        this.status = 'playing';
        this.actionLog = [`${this.players[this.currentTurnIndex].name} 先行动。记住：你看不到自己的牌。`];
        return this._success('花火开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') {
            return { success: false, message: '游戏尚未开始或已结束' };
        }
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) {
            return { success: false, message: '玩家不存在或已离线' };
        }
        if (this.players[this.currentTurnIndex]?.id !== playerId) {
            return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        }

        if (action.kind === 'giveClue') return this._giveClue(player, action.targetId, action.clueKind, action.value);
        if (action.kind === 'playCard') return this._playCard(player, action.cardIndex);
        if (action.kind === 'discardCard') return this._discardCard(player, action.cardIndex);
        return { success: false, message: '未知操作：每回合必须提示、出牌或弃牌', state: this.getPlayerState(playerId) };
    }

    _giveClue(player, targetId, clueKind, value) {
        const target = this.playerMap[targetId];
        if (!target || target.id === player.id || !target.isOnline) {
            return { success: false, message: '请选择一名其他在线玩家' };
        }
        if (this.clues <= 0) {
            return { success: false, message: '没有可用的提示令牌' };
        }
        if (!['color', 'value'].includes(clueKind)) {
            return { success: false, message: '提示类型无效' };
        }

        const normalizedValue = clueKind === 'value' ? Number(value) : value;
        if (clueKind === 'color' && !COLORS.includes(normalizedValue)) {
            return { success: false, message: '颜色提示无效' };
        }
        if (clueKind === 'value' && !VALUES.includes(normalizedValue)) {
            return { success: false, message: '数字提示无效' };
        }

        const matches = target.hand.filter(card => clueKind === 'color'
            ? card.color === normalizedValue
            : card.value === normalizedValue);
        // The physical rule does not permit saying “zero of those”.
        if (!matches.length) {
            return { success: false, message: '提示必须至少对应目标手牌中的一张牌' };
        }

        const cluesBefore = this.clues;
        const matchedCardIds = matches.map(card => card.id);
        const matchedIndexes = target.hand
            .map((card, index) => matchedCardIds.includes(card.id) ? index : null)
            .filter(index => index !== null);
        this.clues -= 1;
        target.hand.forEach(card => {
            const hints = withHints(card).hints;
            if (clueKind === 'color') {
                if (card.color === normalizedValue) {
                    hints.colors = [...new Set([...hints.colors, normalizedValue])];
                } else {
                    hints.notColors = [...new Set([...(hints.notColors || []), normalizedValue])];
                }
            } else if (card.value === normalizedValue) {
                hints.values = [...new Set([...hints.values, normalizedValue])];
            } else {
                hints.notValues = [...new Set([...(hints.notValues || []), normalizedValue])];
            }
            card.hints = hints;
        });

        this.lastAction = {
            kind: 'giveClue',
            actionId: ++this.actionSequence,
            playerId: player.id,
            playerName: player.name,
            targetId: target.id,
            targetName: target.name,
            clueKind,
            value: normalizedValue,
            matchedCardIds,
            matchedIndexes,
            cluesBefore,
            cluesAfter: this.clues,
            strikesBefore: this.strikes,
            strikesAfter: this.strikes,
            deckCountBefore: this.deck.length,
            deckCountAfter: this.deck.length,
            scoreBefore: this._score(),
            scoreAfter: this._score(),
            message: `${player.name} 给 ${target.name} 提供了${clueKind === 'color' ? COLOR_LABELS[normalizedValue] : normalizedValue}提示（完整指出所有符合的牌）`,
        };
        this.actionLog.push(this.lastAction.message);
        return this._finishAction(player);
    }

    _playCard(player, cardIndex) {
        const card = player.hand[cardIndex];
        if (!card) {
            return { success: false, message: '没有这张手牌', state: this.getPlayerState(player.id) };
        }

        const scoreBefore = this._score();
        const cluesBefore = this.clues;
        const strikesBefore = this.strikes;
        const deckCountBefore = this.deck.length;
        const actionId = ++this.actionSequence;
        player.hand.splice(cardIndex, 1);
        const expected = this.fireworks[card.color] + 1;
        if (card.value === expected) {
            // A successful card belongs to the centre firework, not the discard pile.
            this.fireworks[card.color] = card.value;
            if (card.value === 5) this.clues = Math.min(8, this.clues + 1);
            this.lastAction = {
                kind: 'playCard',
                actionId,
                playerId: player.id,
                playerName: player.name,
                cardId: card.id,
                cardIndex,
                color: card.color,
                value: card.value,
                success: true,
                expected,
                clueReward: card.value === 5,
                cluesBefore,
                cluesAfter: this.clues,
                strikesBefore,
                strikesAfter: this.strikes,
                deckCountBefore,
                deckCountAfter: this.deck.length,
                scoreBefore,
                scoreAfter: this._score(),
                message: `${player.name} 打出了一张正确的${COLOR_LABELS[card.color]}色 ${card.value}${card.value === 5 ? '，奖励一枚提示令牌' : ''}`,
            };
            this.actionLog.push(this.lastAction.message);
            // Completing all five fireworks is an immediate victory only while
            // the normal draw phase is still active. Once the last card has
            // been drawn, the official final-round countdown must finish even
            // if the display reaches 25 during one of those final turns.
            if (this.finalTurnsRemaining === null && card.value === 5 && COLORS.every(color => this.fireworks[color] === 5)) {
                return this._end('perfect', '五种烟花全部完成，获得 25 分完美胜利');
            }
        } else {
            // A failed play is revealed and placed face-up in the discard pile.
            this.discard.push({ ...card });
            this.strikes += 1;
            this.lastAction = {
                kind: 'playCard',
                actionId,
                playerId: player.id,
                playerName: player.name,
                cardId: card.id,
                cardIndex,
                color: card.color,
                value: card.value,
                success: false,
                expected,
                clueReward: false,
                cluesBefore,
                cluesAfter: this.clues,
                strikesBefore,
                strikesAfter: this.strikes,
                deckCountBefore,
                deckCountAfter: this.deck.length,
                scoreBefore,
                scoreAfter: this._score(),
                message: `${player.name} 打错了${COLOR_LABELS[card.color]}色 ${card.value}，引信增加（${this.strikes}/3）`,
            };
            this.actionLog.push(this.lastAction.message);
            if (this.strikes >= 3) {
                return this._end('fuses', '三次失误，引信爆炸，合作局失败');
            }
        }

        this._drawIntoHand(player);
        return this._finishAction(player);
    }

    _discardCard(player, cardIndex) {
        const card = player.hand[cardIndex];
        if (!card) {
            return { success: false, message: '没有这张手牌', state: this.getPlayerState(player.id) };
        }
        if (this.clues >= 8) {
            return { success: false, message: '提示令牌已满，不能通过弃牌获得更多令牌', state: this.getPlayerState(player.id) };
        }

        const cluesBefore = this.clues;
        const deckCountBefore = this.deck.length;
        player.hand.splice(cardIndex, 1);
        this.discard.push({ ...card });
        this.clues += 1;
        this.lastAction = {
            kind: 'discardCard',
            actionId: ++this.actionSequence,
            playerId: player.id,
            playerName: player.name,
            cardId: card.id,
            cardIndex,
            color: card.color,
            value: card.value,
            cluesBefore,
            cluesAfter: this.clues,
            strikesBefore: this.strikes,
            strikesAfter: this.strikes,
            deckCountBefore,
            deckCountAfter: this.deck.length,
            scoreBefore: this._score(),
            scoreAfter: this._score(),
            message: `${player.name} 弃掉了一张牌，恢复一枚提示令牌`,
        };
        this.actionLog.push(this.lastAction.message);
        this._drawIntoHand(player);
        return this._finishAction(player);
    }

    _finishAction(player) {
        if (this.status !== 'playing') return this._success(this.lastAction?.message || '本局结束');

        const finalTurnWasActive = this.finalTurnsRemaining !== null;
        let finalTurnsStarted = false;
        if (this.deck.length === 0 && this.finalTurnsRemaining === null) {
            this.finalTurnsRemaining = this.players.filter(item => item.isOnline).length;
            finalTurnsStarted = true;
        }
        if (finalTurnWasActive) {
            this.finalTurnsRemaining -= 1;
            if (this.finalTurnsRemaining <= 0) {
                this._completeActionPresentation({ finalTurnsStarted });
                return this._end('deck', '牌库耗尽后的最后一轮结束');
            }
        }

        this.currentTurnIndex = this._nextOnlineIndex(this.currentTurnIndex);
        this._completeActionPresentation({ finalTurnsStarted });
        return this._success(this.lastAction?.message || `${player.name} 完成行动`);
    }

    _completeActionPresentation({ finalTurnsStarted = false } = {}) {
        if (!this.lastAction) return;
        const nextPlayer = this.players[this.currentTurnIndex];
        Object.assign(this.lastAction, {
            cluesAfter: this.clues,
            strikesAfter: this.strikes,
            deckCountAfter: this.deck.length,
            scoreAfter: this._score(),
            drewCard: Number(this.deck.length) < Number(this.lastAction.deckCountBefore),
            finalTurnsStarted: Boolean(this.lastAction.finalTurnsStarted || finalTurnsStarted),
            finalTurnsRemaining: this.finalTurnsRemaining,
            nextPlayerId: nextPlayer?.id || null,
            nextPlayerName: nextPlayer?.name || null,
            ended: this.status === 'ended',
            endReason: this.endReason,
        });
    }

    _drawIntoHand(player) {
        const card = this._draw();
        if (card) player.hand.push(withHints(card));
    }

    _startingPlayerIndex(seedCard) {
        const requestedId = this.options.startingPlayerId;
        const requestedIndex = this.options.startingPlayerIndex;
        if (requestedId && this.playerMap[requestedId]) return this.players.findIndex(player => player.id === requestedId);
        if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < this.players.length) return requestedIndex;
        // Physical games use “most colorful clothing”. An online table has no
        // clothing information, so use the already-shuffled deck as a neutral,
        // reproducible random draw without consuming another global RNG value.
        const seed = String(seedCard?.id || 'hanabi');
        let hash = 0;
        for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        return hash % this.players.length;
    }

    _nextOnlineIndex(index) {
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const next = (index + offset) % this.players.length;
            if (this.players[next].isOnline) return next;
        }
        return index;
    }

    _draw() {
        return this.deck.pop();
    }

    _shuffle(values) {
        const result = values.slice();
        for (let index = result.length - 1; index > 0; index -= 1) {
            const other = Math.floor(this.random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }

    _end(reason, message) {
        this.status = 'ended';
        this.phase = 'ended';
        this.endReason = reason;
        if (reason !== 'deck') this.finalTurnsRemaining = null;
        this.winner = null;
        this._completeActionPresentation();
        if (this.lastAction) {
            this.lastAction.ended = true;
            this.lastAction.endReason = reason;
        }
        if (message && this.actionLog[this.actionLog.length - 1] !== message) this.actionLog.push(message);
        return this._success(message);
    }

    _scoreRating(score = this._score()) {
        return SCORE_RATINGS.find(rating => score <= rating.max) || SCORE_RATINGS[SCORE_RATINGS.length - 1];
    }

    _score() {
        return COLORS.reduce((sum, color) => sum + this.fireworks[color], 0);
    }

    _publicCard(card, ownerId, viewerId) {
        const hidden = viewerId === null || viewerId === undefined || ownerId === viewerId;
        const safeCard = withHints(card);
        return {
            id: safeCard.id,
            color: hidden ? null : safeCard.color,
            value: hidden ? null : safeCard.value,
            // Only the owner may see the knowledge they have received.
            hints: hidden && ownerId === viewerId ? clone(safeCard.hints) : null,
            hidden,
        };
    }

    getPublicState(viewerId = null) {
        const score = this._score();
        const rating = this._scoreRating(score);
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            variant: 'base',
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            startingPlayerId: this.startingPlayerId,
            clues: this.clues,
            strikes: this.strikes,
            maxStrikes: 3,
            deckCount: this.deck.length,
            finalTurnsRemaining: this.finalTurnsRemaining,
            endReason: this.endReason,
            fireworks: { ...this.fireworks },
            discard: this.discard.map(card => ({ color: card.color, value: card.value })),
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                hand: player.hand.map(card => this._publicCard(card, player.id, viewerId)),
                handCount: player.hand.length,
                isOnline: player.isOnline,
                isCurrentTurn: player.id === this.players[this.currentTurnIndex]?.id,
            })),
            actionLog: this.actionLog.slice(-16),
            lastAction: this.lastAction ? clone(this.lastAction) : null,
            winner: null,
            score,
            scoreRating: rating.label,
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(playerId);
        state.myId = playerId;
        state.myHand = this.playerMap[playerId]?.hand.map(card => this._publicCard(card, playerId, playerId)) || [];
        const isCurrent = this.status === 'playing' && this.currentTurnIndex === this.players.findIndex(player => player.id === playerId);
        state.availableActions = {
            canAct: isCurrent,
            canGiveClue: isCurrent && this.clues > 0,
            canPlay: isCurrent,
            canDiscard: isCurrent && this.clues < 8,
        };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        player.isOnline = false;
        if (this.players.filter(item => item.isOnline).length < 2 && this.status === 'playing') {
            return this._end('players', '在线玩家不足，合作局结束');
        }
        if (this.players[this.currentTurnIndex]?.id === playerId) {
            this.currentTurnIndex = this._nextOnlineIndex(this.currentTurnIndex);
        }
        return this._success(`${player.name} 离开了花火牌桌`);
    }

    _success(message) {
        return {
            success: true,
            message,
            state: this.getPublicState(),
            ended: this.status === 'ended',
            winner: null,
        };
    }

    getWinner() {
        return null;
    }
}

module.exports = HanabiEngine;
module.exports.COLORS = COLORS;
module.exports.VALUES = VALUES;
module.exports.HAND_SIZE = HAND_SIZE;
module.exports.buildDeck = buildDeck;
