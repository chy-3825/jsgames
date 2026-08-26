const COLORS = ['white', 'blue', 'green', 'red', 'black'];
const COLOR_LABELS = { white: '白', blue: '蓝', green: '绿', red: '红', black: '黑', gold: '黄金' };
// Asmodee/Space Cowboys base-game deck: every physical card is unique.
// The table is transcribed from the official 90-card set (40/30/20).
const OFFICIAL_CARD_TABLE = `
white-L1-01,0,0,3,0,0,0
white-L1-02,1,0,0,4,0,0
white-L1-03,0,0,0,0,2,1
white-L1-04,0,0,2,0,0,2
white-L1-05,0,3,1,0,0,1
white-L1-06,0,0,2,2,0,1
white-L1-07,0,0,1,1,1,1
white-L1-08,0,0,1,2,1,1
white-L2-01,2,0,0,0,5,0
white-L2-02,3,6,0,0,0,0
white-L2-03,2,0,0,0,5,3
white-L2-04,2,0,0,1,4,2
white-L2-05,1,0,0,3,2,2
white-L2-06,1,2,3,0,3,0
white-L3-01,4,0,0,0,0,7
white-L3-02,4,3,0,0,3,6
white-L3-03,3,0,3,3,5,3
white-L3-04,5,3,0,0,0,7
blue-L1-01,0,0,0,0,0,3
blue-L1-02,1,0,0,0,4,0
blue-L1-03,0,1,0,0,0,2
blue-L1-04,0,0,0,2,0,2
blue-L1-05,0,0,1,3,1,0
blue-L1-06,0,1,0,2,2,0
blue-L1-07,0,1,0,1,1,1
blue-L1-08,0,1,0,1,2,1
blue-L2-01,2,0,5,0,0,0
blue-L2-02,3,0,6,0,0,0
blue-L2-03,2,5,3,0,0,0
blue-L2-04,2,2,0,0,1,4
blue-L2-05,1,0,2,2,3,0
blue-L2-06,1,0,2,3,0,3
blue-L3-01,4,7,0,0,0,0
blue-L3-02,4,6,3,0,0,3
blue-L3-03,3,3,0,3,3,5
blue-L3-04,5,7,3,0,0,0
green-L1-01,0,0,0,0,3,0
green-L1-02,1,0,0,0,0,4
green-L1-03,0,2,1,0,0,0
green-L1-04,0,0,2,0,2,0
green-L1-05,0,1,3,1,0,0
green-L1-06,0,0,1,0,2,2
green-L1-07,0,1,1,0,1,1
green-L1-08,0,1,1,0,1,2
green-L2-01,2,0,0,5,0,0
green-L2-02,3,0,0,6,0,0
green-L2-03,2,0,5,3,0,0
green-L2-04,2,4,2,0,0,1
green-L2-05,1,2,3,0,0,2
green-L2-06,1,3,0,2,3,0
green-L3-01,4,0,7,0,0,0
green-L3-02,4,3,6,3,0,0
green-L3-03,3,5,3,0,3,3
green-L3-04,5,0,7,3,0,0
red-L1-01,0,3,0,0,0,0
red-L1-02,1,4,0,0,0,0
red-L1-03,0,0,2,1,0,0
red-L1-04,0,2,0,0,2,0
red-L1-05,0,1,0,0,1,3
red-L1-06,0,2,0,1,0,2
red-L1-07,0,1,1,1,0,1
red-L1-08,0,2,1,1,0,1
red-L2-01,2,0,0,0,0,5
red-L2-02,3,0,0,0,6,0
red-L2-03,2,3,0,0,0,5
red-L2-04,2,1,4,2,0,0
red-L2-05,1,2,0,0,2,3
red-L2-06,1,0,3,0,2,3
red-L3-01,4,0,0,7,0,0
red-L3-02,4,0,3,6,3,0
red-L3-03,3,3,5,3,0,3
red-L3-04,5,0,0,7,3,0
black-L1-01,0,0,0,3,0,0
black-L1-02,1,0,4,0,0,0
black-L1-03,0,0,0,2,1,0
black-L1-04,0,2,0,2,0,0
black-L1-05,0,0,0,1,3,1
black-L1-06,0,2,2,0,1,0
black-L1-07,0,1,1,1,1,0
black-L1-08,0,1,2,1,1,0
black-L2-01,2,5,0,0,0,0
black-L2-02,3,0,0,0,0,6
black-L2-03,2,0,0,5,3,0
black-L2-04,2,0,1,4,2,0
black-L2-05,1,3,2,2,0,0
black-L2-06,1,3,0,3,0,2
black-L3-01,4,0,0,0,7,0
black-L3-02,4,0,0,3,6,3
black-L3-03,3,3,3,5,3,0
black-L3-04,5,0,0,0,7,3`.trim();
const NOBLES = [
    { id: 'n1', name: '安妮', points: 3, requirements: { white: 3, blue: 3 } }, { id: 'n2', name: '亨利', points: 3, requirements: { blue: 3, green: 3 } },
    { id: 'n3', name: '伊莎贝拉', points: 3, requirements: { green: 3, red: 3 } }, { id: 'n4', name: '路易', points: 3, requirements: { red: 3, black: 3 } },
    { id: 'n5', name: '玛丽', points: 3, requirements: { black: 3, white: 3 } }, { id: 'n6', name: '奥托', points: 3, requirements: { white: 4, black: 0, red: 0, blue: 0, green: 0 } },
    { id: 'n7', name: '索菲亚', points: 3, requirements: { blue: 4, white: 0, red: 0, green: 0, black: 0 } }, { id: 'n8', name: '维克多', points: 3, requirements: { green: 4, white: 0, red: 0, blue: 0, black: 0 } },
    { id: 'n9', name: '艾琳', points: 3, requirements: { red: 4, white: 0, blue: 0, green: 0, black: 0 } }, { id: 'n10', name: '约瑟夫', points: 3, requirements: { black: 4, white: 0, blue: 0, green: 0, red: 0 } },
];

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildCards() {
    const columns = ['white', 'blue', 'green', 'red', 'black'];
    return OFFICIAL_CARD_TABLE.split('\n').map(row => {
        const [id, points, ...values] = row.split(',');
        const [, tierText] = id.match(/-L([123])-\d+$/) || [];
        const tier = Number(tierText);
        const bonus = id.split('-')[0];
        const cost = Object.fromEntries(columns.map((color, index) => [color, Number(values[index])]).filter(([, amount]) => amount > 0));
        return { id: `s${tier}-${id}`, tier, bonus, points: Number(points), cost };
    });
}

class SplendorEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.options = options && typeof options === 'object' ? { ...options } : {};
        this.players = players.map(player => ({
            id: player.id,
            name: player.name,
            tokens: Object.fromEntries([...COLORS, 'gold'].map(color => [color, 0])),
            cards: [],
            reserved: [],
            points: 0,
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.decks = {};
        this.market = {};
        this.tokens = {};
        this.nobles = [];
        this.phase = 'waiting';
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.startingPlayerId = null;
        this.pendingNoble = null;
        this.pendingTokenReturn = null;
        this.finalRoundStart = null;
        this.endReason = null;
        this.winner = null;
        this.winners = [];
        this.actionLog = [];
        this.transactionSequence = 0;
        this.presentationSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '璀璨宝石已经开始，不能重复开始' };
        if (this.players.length < 2 || this.players.length > 4) return { success: false, message: '璀璨宝石需要 2–4 名玩家' };

        const amount = this.players.length === 2 ? 4 : this.players.length === 3 ? 5 : 7;
        this.decks = {};
        this.market = {};
        this.tokens = Object.fromEntries([...COLORS, 'gold'].map(color => [color, color === 'gold' ? 5 : amount]));
        const cards = buildCards();
        for (const tier of [1, 2, 3]) {
            this.decks[tier] = this._shuffle(cards.filter(card => card.tier === tier));
            this.market[tier] = Array.from({ length: 4 }, () => this._draw(tier)).filter(Boolean);
        }
        this.nobles = this._shuffle(NOBLES).slice(0, this.players.length + 1);
        this.players.forEach(player => {
            player.isOnline = true;
            player.tokens = Object.fromEntries([...COLORS, 'gold'].map(color => [color, 0]));
            player.cards = [];
            player.reserved = [];
            player.points = 0;
        });
        this.pendingNoble = null;
        this.pendingTokenReturn = null;
        this.finalRoundStart = null;
        this.endReason = null;
        this.winner = null;
        this.winners = [];
        this.transactionSequence = 0;
        this.presentationSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
        const startSeed = this.decks[1][0] || this.market[1][0];
        this.currentTurnIndex = this._startingPlayerIndex(startSeed);
        this.startingPlayerId = this.players[this.currentTurnIndex]?.id || null;
        this.status = 'playing';
        this.phase = 'action';
        this.actionLog = [`${this.players[this.currentTurnIndex].name} 先行动，请选择拿宝石、预留或购买`];
        return this._success('璀璨宝石开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };

        if (this.pendingTokenReturn) {
            if (this.pendingTokenReturn.playerId !== playerId) return { success: false, message: '请等待当前玩家归还超出的宝石', state: this.getPlayerState(playerId) };
            if (action.kind !== 'returnTokens') return { success: false, message: '宝石超过 10 枚，请先归还宝石', state: this.getPlayerState(playerId) };
            return this._returnTokens(player, action.colors);
        }
        if (this.pendingNoble) {
            if (this.pendingNoble.playerId !== playerId) return { success: false, message: '请等待当前玩家选择贵族', state: this.getPlayerState(playerId) };
            if (action.kind !== 'chooseNoble') return { success: false, message: '请先选择要拜访的贵族', state: this.getPlayerState(playerId) };
            return this._chooseNoble(player, action.nobleId);
        }
        if (this.currentTurnIndex !== this.players.indexOf(player)) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };

        if (action.kind === 'takeTokens') return this._takeTokens(player, action.colors);
        if (action.kind === 'reserveCard') return this._reserve(player, action.cardId, action.tier);
        if (action.kind === 'buyCard') return this._buy(player, action.cardId, action.fromReserve);
        return { success: false, message: '未知行动：请选择拿宝石、预留或购买', state: this.getPlayerState(playerId) };
    }

    _takeTokens(player, colors) {
        const validation = this._validateTokenTake(colors);
        if (!validation.success) return validation;
        const counts = validation.counts;
        const tokenTotalBefore = this._tokenTotal(player);
        const bankBefore = { ...this.tokens };
        if (this._tokenTotal(player) + colors.length > 10) {
            // The official rule allows the action, then requires returning tokens.
            // Do not reject the action merely because the temporary total is > 10.
        }
        for (const color of COLORS) {
            this.tokens[color] -= counts[color];
            player.tokens[color] += counts[color];
        }
        const message = `${player.name} 拿取了 ${colors.map(color => COLOR_LABELS[color]).join('、')} 宝石`;
        this._startPresentation(player, 'takeTokens', {
            colors: colors.slice(),
            counts: { ...counts },
            bankBefore,
            bankAfter: { ...this.tokens },
            tokenTotalBefore,
            tokenTotalAfter: this._tokenTotal(player),
        });
        return this._afterResourceAction(player, message);
    }

    _validateTokenTake(colors) {
        if (!Array.isArray(colors) || colors.length < 1 || colors.length > 3 || colors.some(color => !COLORS.includes(color))) {
            return { success: false, message: '请选择符合规则的宝石：三种不同颜色、两枚同色，或库存不足时的两/一枚不同颜色' };
        }
        const counts = Object.fromEntries(COLORS.map(color => [color, 0]));
        colors.forEach(color => { counts[color] += 1; });
        const availableColors = COLORS.filter(color => this.tokens[color] > 0).length;
        if (colors.length === 2 && colors[0] === colors[1]) {
            if (this.tokens[colors[0]] < 4) return { success: false, message: '拿两枚同色宝石时，该色库存必须至少有四枚' };
        } else if (colors.length === 2 && new Set(colors).size === 2) {
            if (availableColors !== 2) return { success: false, message: '只有在不足三种颜色有库存时，才能拿两枚不同颜色宝石' };
        } else if (colors.length === 1) {
            if (availableColors !== 1) return { success: false, message: '只有在仅剩一种颜色有库存时，才能拿一枚宝石' };
        } else if (new Set(colors).size !== 3) {
            return { success: false, message: '拿三枚宝石时必须是三种不同颜色' };
        }
        for (const color of COLORS) if (counts[color] > this.tokens[color]) return { success: false, message: `${COLOR_LABELS[color]}色宝石库存不足` };
        return { success: true, counts };
    }

    _reserve(player, cardId, tier) {
        if (player.reserved.length >= 3) return { success: false, message: '最多只能预留三张牌' };
        let card;
        let source = 'market';
        if (cardId) {
            for (const level of [1, 2, 3]) {
                const index = this.market[level].findIndex(item => item.id === cardId);
                if (index >= 0) {
                    card = this.market[level].splice(index, 1)[0];
                    tier = level;
                    break;
                }
            }
        } else if ([1, 2, 3].includes(Number(tier))) {
            tier = Number(tier);
            card = this._draw(tier);
            source = 'deck';
        }
        if (!card) return { success: false, message: '找不到要预留的卡牌' };
        player.reserved.push(card);
        if (source === 'market') this._refill(tier);
        const goldBefore = this.tokens.gold;
        if (this.tokens.gold > 0) {
            this.tokens.gold -= 1;
            player.tokens.gold += 1;
        }
        this._startPresentation(player, 'reserveCard', {
            source,
            tier: Number(tier || card.tier),
            card: source === 'market' ? this._publicCard(card) : null,
            gainedGold: this.tokens.gold < goldBefore,
            reservedCountAfter: player.reserved.length,
        });
        return this._afterResourceAction(player, `${player.name} 预留了一张发展卡`);
    }

    _buy(player, cardId, fromReserve = false) {
        let source;
        let tier = null;
        if (fromReserve) {
            source = player.reserved;
        } else {
            for (const level of [1, 2, 3]) {
                const found = this.market[level].find(item => item.id === cardId);
                if (found) {
                    source = this.market[level];
                    tier = level;
                    break;
                }
            }
        }
        const index = source?.findIndex(card => card.id === cardId) ?? -1;
        const card = index >= 0 ? source[index] : null;
        if (!card) return { success: false, message: '找不到要购买的卡牌' };

        const discounts = Object.fromEntries(COLORS.map(color => [color, player.cards.filter(item => item.bonus === color).length]));
        const payment = Object.fromEntries(COLORS.map(color => [color, 0]));
        let goldNeeded = 0;
        for (const color of COLORS) {
            const needed = Math.max(0, (card.cost[color] || 0) - discounts[color]);
            const spend = Math.min(player.tokens[color], needed);
            payment[color] = spend;
            goldNeeded += needed - spend;
        }
        if (goldNeeded > player.tokens.gold) return { success: false, message: '宝石或黄金不足，无法购买这张牌' };
        const pointsBefore = player.points;
        const cardCountBefore = player.cards.length;
        for (const color of COLORS) {
            player.tokens[color] -= payment[color];
            this.tokens[color] += payment[color];
        }
        player.tokens.gold -= goldNeeded;
        this.tokens.gold += goldNeeded;
        source.splice(index, 1);
        player.cards.push(card);
        player.points += card.points;
        if (!fromReserve) this._refill(tier || card.tier);
        this._startPresentation(player, 'buyCard', {
            source: fromReserve ? 'reserved' : 'market',
            tier: Number(tier || card.tier),
            card: this._publicCard(card),
            payment: { ...payment, gold: goldNeeded },
            pointsBefore,
            pointsAfter: player.points,
            cardCountBefore,
            cardCountAfter: player.cards.length,
        });
        return this._completeAction(player, `${player.name} 购买了 ${COLOR_LABELS[card.bonus]} 色发展卡`);
    }

    _afterResourceAction(player, message) {
        const excess = this._tokenTotal(player) - 10;
        if (excess > 0) {
            this.pendingTokenReturn = { playerId: player.id, amount: excess, message, transactionId: this.presentation?.transactionId || null };
            this.phase = 'return_tokens';
            this._updatePresentation({ pending: 'returnTokens', resolved: false });
            // Keep the resource action visible while the mandatory return
            // choice is open; otherwise the public timeline still shows the
            // previous player's action during this intermediate state.
            this.actionLog.push(`${message}（等待归还）`);
            return this._success(`${message}；宝石超过 10 枚，请归还至少 ${excess} 枚`);
        }
        return this._completeAction(player, message);
    }

    _returnTokens(player, colors) {
        if (!Array.isArray(colors) || !colors.length) return { success: false, message: '请选择要归还的宝石', state: this.getPlayerState(player.id) };
        const counts = Object.fromEntries([...COLORS, 'gold'].map(color => [color, 0]));
        for (const color of colors) {
            if (!Object.prototype.hasOwnProperty.call(counts, color)) return { success: false, message: '只能归还已有的宝石或黄金', state: this.getPlayerState(player.id) };
            counts[color] += 1;
        }
        for (const color of [...COLORS, 'gold']) {
            if (counts[color] > player.tokens[color]) return { success: false, message: '归还数量不能超过自己持有的宝石', state: this.getPlayerState(player.id) };
        }
        if (colors.length < this.pendingTokenReturn.amount) return { success: false, message: `还需要归还至少 ${this.pendingTokenReturn.amount} 枚宝石`, state: this.getPlayerState(player.id) };
        if (this._tokenTotal(player) - colors.length > 10) return { success: false, message: '归还后宝石仍超过十枚', state: this.getPlayerState(player.id) };
        const transactionId = this.pendingTokenReturn.transactionId;
        const tokenTotalBefore = this._tokenTotal(player);
        const bankBefore = { ...this.tokens };
        for (const color of [...COLORS, 'gold']) {
            player.tokens[color] -= counts[color];
            this.tokens[color] += counts[color];
        }
        const actionMessage = `${this.pendingTokenReturn.message}，${player.name} 归还了 ${colors.map(color => COLOR_LABELS[color]).join('、')} 宝石`;
        const pendingLog = `${this.pendingTokenReturn.message}（等待归还）`;
        if (this.actionLog[this.actionLog.length - 1] === pendingLog) this.actionLog.pop();
        this.pendingTokenReturn = null;
        this.phase = 'action';
        this._startPresentation(player, 'returnTokens', {
            colors: colors.slice(),
            counts: { ...counts },
            bankBefore,
            bankAfter: { ...this.tokens },
            tokenTotalBefore,
            tokenTotalAfter: this._tokenTotal(player),
        }, transactionId);
        return this._completeAction(player, actionMessage);
    }

    _checkNoble(player) {
        return this.nobles.filter(noble => COLORS.every(color => player.cards.filter(card => card.bonus === color).length >= (noble.requirements[color] || 0)));
    }

    _chooseNoble(player, nobleId, { appendToCurrent = false } = {}) {
        if (!this.pendingNoble || this.pendingNoble.playerId !== player.id || !this.pendingNoble.options.some(noble => noble.id === nobleId)) {
            return { success: false, message: '不能选择这位贵族', state: this.getPlayerState(player.id) };
        }
        const transactionId = this.pendingNoble.transactionId;
        const index = this.nobles.findIndex(noble => noble.id === nobleId);
        const noble = this.nobles.splice(index, 1)[0];
        const pointsBefore = player.points;
        player.points += noble.points;
        this.pendingNoble = null;
        const eventData = { noble: clone(noble), pointsBefore, pointsAfter: player.points };
        if (appendToCurrent) this._appendPresentationEvent(player, 'nobleVisit', eventData);
        else this._startPresentation(player, 'nobleVisit', eventData, transactionId);
        const message = `${player.name} 获得了 ${noble.name} 的拜访`;
        this.actionLog.push(message);
        return this._finishTurn(player, message);
    }

    _completeAction(player, message) {
        this.actionLog.push(message);
        const options = this._checkNoble(player);
        if (options.length) {
            this.pendingNoble = { playerId: player.id, options, transactionId: this.presentation?.transactionId || null };
            this.phase = 'choose_noble';
            this._updatePresentation({ pending: 'chooseNoble', resolved: false });
            if (options.length === 1) return this._chooseNoble(player, options[0].id, { appendToCurrent: true });
            return this._success('请选择拜访的贵族');
        }
        return this._finishTurn(player, message);
    }

    _finishTurn(player, message) {
        this.phase = 'action';
        const finalRoundStarted = player.points >= 15 && this.finalRoundStart === null;
        if (finalRoundStarted) this.finalRoundStart = this.currentTurnIndex;
        this.currentTurnIndex = this._nextOnlineIndex(this.currentTurnIndex);
        this._updatePresentation({
            pending: null,
            resolved: true,
            finalRoundStarted,
            finalRoundTrigger: finalRoundStarted ? { playerId: player.id, playerName: player.name, points: player.points } : null,
            nextPlayerId: this.players[this.currentTurnIndex]?.id || null,
            nextPlayerName: this.players[this.currentTurnIndex]?.name || null,
        });
        if (this.finalRoundStart !== null && this.currentTurnIndex === this.finalRoundStart) return this._finishGame('points');
        return this._success(message);
    }

    _finishGame(reason = 'points') {
        this.status = 'ended';
        this.phase = 'ended';
        this.endReason = reason;
        const active = this.players.filter(player => player.isOnline);
        const ranked = active.slice().sort((a, b) => b.points - a.points || a.cards.length - b.cards.length);
        const best = ranked[0];
        this.winners = best ? ranked.filter(player => player.points === best.points && player.cards.length === best.cards.length) : [];
        this.winner = this.winners.length === 1 ? this.winners[0] : null;
        const names = this.winners.map(player => player.name).join('、') || '无人';
        this.actionLog.push(this.winners.length > 1 ? `${names} 并列赢得了宝石商会` : `${names} 赢得了宝石商会`);
        this._updatePresentation({
            resolved: true,
            ended: true,
            endReason: reason,
            standings: ranked.map(player => ({ id: player.id, name: player.name, points: player.points, cardCount: player.cards.length })),
            winners: this.winners.map(player => ({ id: player.id, name: player.name, points: player.points, cardCount: player.cards.length })),
        });
        return this._success('本局结束');
    }

    _finishWithoutWinner(reason, message) {
        this.status = 'ended';
        this.phase = 'ended';
        this.endReason = reason;
        this.winner = null;
        this.winners = [];
        this.pendingNoble = null;
        this.pendingTokenReturn = null;
        this.actionLog.push(message);
        return this._success(message);
    }

    _draw(tier) { return this.decks[tier]?.pop() || null; }

    _startPresentation(player, kind, data = {}, transactionId = null) {
        const resolvedTransactionId = transactionId || ++this.transactionSequence;
        this.presentation = {
            sequence: ++this.presentationSequence,
            transactionId: resolvedTransactionId,
            events: [{
                eventId: ++this.eventSequence,
                kind,
                playerId: player.id,
                playerName: player.name,
                ...clone(data),
            }],
            pending: null,
            resolved: false,
            finalRoundStarted: false,
            finalRoundTrigger: null,
            nextPlayerId: null,
            nextPlayerName: null,
            ended: false,
            endReason: null,
        };
        return this.presentation;
    }

    _appendPresentationEvent(player, kind, data = {}) {
        if (!this.presentation) return this._startPresentation(player, kind, data);
        this.presentation.events.push({
            eventId: ++this.eventSequence,
            kind,
            playerId: player.id,
            playerName: player.name,
            ...clone(data),
        });
        return this.presentation;
    }

    _updatePresentation(values = {}) {
        if (this.presentation) Object.assign(this.presentation, clone(values));
    }

    _refill(tier) {
        const card = this._draw(tier);
        if (card) this.market[tier].push(card);
    }

    _startingPlayerIndex(seedCard) {
        const requestedId = this.options.startingPlayerId;
        const requestedIndex = this.options.startingPlayerIndex;
        if (requestedId && this.playerMap[requestedId]) return this.players.findIndex(player => player.id === requestedId);
        if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < this.players.length) return requestedIndex;
        const seed = String(seedCard?.id || 'splendor');
        let hash = 0;
        for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        return hash % this.players.length;
    }

    _shuffle(values) {
        const result = values.slice();
        for (let index = result.length - 1; index > 0; index -= 1) {
            const other = Math.floor(this.random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }

    _tokenTotal(player) { return [...COLORS, 'gold'].reduce((sum, color) => sum + player.tokens[color], 0); }

    _nextOnlineIndex(index) {
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const next = (index + offset) % this.players.length;
            if (this.players[next]?.isOnline) return next;
        }
        return index;
    }

    _publicCard(card) { return { id: card.id, tier: card.tier, bonus: card.bonus, points: card.points, cost: { ...card.cost } }; }

    getPublicState() {
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            currentTurn: this.players[this.currentTurnIndex]?.id || null,
            currentTurnName: this.players[this.currentTurnIndex]?.name || null,
            startingPlayerId: this.startingPlayerId,
            finalRoundStart: this.finalRoundStart,
            endReason: this.endReason,
            rules: { cardCounts: { tier1: 40, tier2: 30, tier3: 20 }, tokenLimit: 10, reserveLimit: 3, winningPoints: 15 },
            tokens: { ...this.tokens },
            market: Object.fromEntries([1, 2, 3].map(tier => [tier, this.market[tier].map(card => this._publicCard(card))])),
            nobles: this.nobles.map(noble => clone(noble)),
            pendingNoble: this.pendingNoble ? { playerId: this.pendingNoble.playerId, playerName: this.playerMap[this.pendingNoble.playerId]?.name, options: this.pendingNoble.options.map(noble => clone(noble)) } : null,
            pendingTokenReturn: this.pendingTokenReturn ? { playerId: this.pendingTokenReturn.playerId, playerName: this.playerMap[this.pendingTokenReturn.playerId]?.name, amount: this.pendingTokenReturn.amount } : null,
            players: this.players.map(player => ({ id: player.id, name: player.name, points: player.points, cardCount: player.cards.length, reservedCount: player.reserved.length, tokens: { ...player.tokens }, isOnline: player.isOnline, isCurrentTurn: player.id === this.players[this.currentTurnIndex]?.id })),
            actionLog: this.actionLog.slice(-15),
            presentation: this.presentation ? clone(this.presentation) : null,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, points: this.winner.points, cardCount: this.winner.cards.length } : null,
            winners: this.winners.map(player => ({ id: player.id, name: player.name, points: player.points, cardCount: player.cards.length })),
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myTokens = player ? { ...player.tokens } : {};
        state.myCards = player?.cards.map(card => this._publicCard(card)) || [];
        state.myReserved = player?.reserved.map(card => this._publicCard(card)) || [];
        state.availableActions = {
            canAct: this.status === 'playing' && this.currentTurnIndex === this.players.indexOf(player) && !this.pendingNoble && !this.pendingTokenReturn,
            canChooseNoble: this.pendingNoble?.playerId === playerId,
            canReturnTokens: this.pendingTokenReturn?.playerId === playerId,
            returnTokenCount: this.pendingTokenReturn?.playerId === playerId ? this.pendingTokenReturn.amount : 0,
        };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        player.isOnline = false;
        if (this.pendingNoble?.playerId === playerId) this.pendingNoble = null;
        if (this.pendingTokenReturn?.playerId === playerId) this.pendingTokenReturn = null;
        this.phase = 'action';
        if (this.players[this.currentTurnIndex]?.id === playerId && this.status === 'playing') this.currentTurnIndex = this._nextOnlineIndex(this.currentTurnIndex);
        if (this.players.filter(item => item.isOnline).length <= 1 && this.status === 'playing') return this._finishWithoutWinner('players', '在线玩家不足，宝石商会结束');
        return this._success(`${player.name} 离开了宝石桌`);
    }

    _success(message) {
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null };
    }

    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = SplendorEngine;
module.exports.COLORS = COLORS;
module.exports.buildCards = buildCards;
module.exports.NOBLES = NOBLES;
