const COLORS = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'railroad', 'utility'];
const COLOR_LABELS = { brown: '棕色', lightblue: '浅蓝', pink: '粉色', orange: '橙色', red: '红色', yellow: '黄色', green: '绿色', blue: '深蓝', railroad: '铁路', utility: '公用事业' };
const COLOR_SIZE = { brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, blue: 2, railroad: 4, utility: 2 };
const RENT_TABLE = {
    brown: [1, 2],
    lightblue: [1, 2, 3],
    pink: [1, 2, 4],
    orange: [1, 3, 5],
    red: [2, 3, 6],
    yellow: [2, 4, 6],
    green: [2, 4, 7],
    blue: [3, 8],
    railroad: [1, 2, 3, 4],
    utility: [1, 2],
};
const PROPERTY_NAMES = {
    brown: ['地中海大道', '波罗的海大道'],
    lightblue: ['东方大道', '佛蒙特大道', '康涅狄格大道'],
    pink: ['圣查尔斯广场', '州际大道', '弗吉尼亚大道'],
    orange: ['圣詹姆斯广场', '田纳西大道', '纽约大道'],
    red: ['肯塔基大道', '印第安纳大道', '伊利诺伊大道'],
    yellow: ['大西洋大道', '文特诺大道', '马文花园'],
    green: ['太平洋大道', '北卡罗来纳大道', '宾夕法尼亚大道'],
    blue: ['公园广场', '木板路'],
    railroad: ['雷丁铁路', '宾州铁路', 'B&O 铁路', '短线铁路'],
    utility: ['电力公司', '自来水厂'],
};
const PROPERTY_VALUES = { brown: 1, lightblue: 1, pink: 2, orange: 2, red: 3, yellow: 3, green: 4, blue: 4, railroad: 2, utility: 2 };
const ACTION_NAMES = {
    dealBreaker: '物业接管',
    justSayNo: '做出反对',
    passGo: '通行证',
    doubleRent: '双倍租金',
    debtCollector: '收取债务',
    birthday: '我的生日',
    slyDeal: '盗取',
    forcedDeal: '强制交易',
    house: '房子',
    hotel: '酒店',
};

function publicCard(card) {
    return card ? { ...card, colors: Array.isArray(card.colors) ? card.colors.slice() : card.colors } : null;
}

function buildDeck() {
    const deck = [];
    let id = 1;
    for (const color of COLORS) {
        PROPERTY_NAMES[color].forEach(name => deck.push({ id: `p${id++}`, kind: 'property', color, value: PROPERTY_VALUES[color], name, rent: RENT_TABLE[color].slice(), setSize: COLOR_SIZE[color] }));
    }
    const wilds = [
        { colors: ['brown', 'lightblue'], value: 1 },
        { colors: ['lightblue', 'railroad'], value: 4 },
        { colors: ['pink', 'orange'], value: 2 },
        { colors: ['pink', 'orange'], value: 2 },
        { colors: ['red', 'yellow'], value: 3 },
        { colors: ['red', 'yellow'], value: 3 },
        { colors: ['blue', 'green'], value: 4 },
        { colors: ['green', 'railroad'], value: 4 },
        { colors: ['railroad', 'utility'], value: 2 },
        { colors: COLORS, value: 0, allColor: true },
        { colors: COLORS, value: 0, allColor: true },
    ];
    wilds.forEach(wild => deck.push({ id: `w${id++}`, kind: 'property_wild', colors: wild.colors.slice(), color: null, value: wild.value, allColor: Boolean(wild.allColor), name: wild.allColor ? '十色地产万能牌' : `${wild.colors.map(color => COLOR_LABELS[color]).join('/')}万能地产` }));
    [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 10].forEach(value => deck.push({ id: `m${id++}`, kind: 'money', value, name: `${value}M 现金` }));
    [['lightblue', 'brown'], ['pink', 'orange'], ['red', 'yellow'], ['blue', 'green'], ['railroad', 'utility']].forEach(colors => {
        for (let i = 0; i < 2; i++) deck.push({ id: `r${id++}`, kind: 'rent', colors: colors.slice(), value: 1, name: `${colors.map(color => COLOR_LABELS[color]).join('/')}租金` });
    });
    for (let i = 0; i < 3; i++) deck.push({ id: `r${id++}`, kind: 'rent', colors: [], value: 3, name: '任何租金' });
    const addAction = (action, count, value, name) => {
        for (let i = 0; i < count; i++) deck.push({ id: `a${id++}`, kind: 'action', action, value, name });
    };
    addAction('dealBreaker', 2, 5, ACTION_NAMES.dealBreaker);
    addAction('justSayNo', 3, 4, ACTION_NAMES.justSayNo);
    addAction('passGo', 10, 1, ACTION_NAMES.passGo);
    addAction('doubleRent', 2, 1, ACTION_NAMES.doubleRent);
    addAction('debtCollector', 3, 3, ACTION_NAMES.debtCollector);
    addAction('birthday', 3, 2, ACTION_NAMES.birthday);
    addAction('slyDeal', 3, 3, ACTION_NAMES.slyDeal);
    addAction('forcedDeal', 3, 3, ACTION_NAMES.forcedDeal);
    addAction('house', 3, 3, ACTION_NAMES.house);
    addAction('hotel', 2, 4, ACTION_NAMES.hotel);
    for (let i = 0; i < 4; i++) deck.push({ id: `q${id++}`, kind: 'rules', value: 0, name: '规则卡' });
    return deck;
}

class MonopolyDealEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = random;
        this.players = players.map(p => ({
            id: p.id,
            name: p.name,
            hand: [],
            bank: [],
            properties: Object.fromEntries(COLORS.map(color => [color, []])),
            houses: Object.fromEntries(COLORS.map(color => [color, 0])),
            hotels: Object.fromEntries(COLORS.map(color => [color, 0])),
            buildings: {},
            nextGroupNumber: 1,
            rentMultiplier: 1,
            pendingDoubleRent: false,
            doubleRentCount: 0,
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(p => [p.id, p]));
        this.deck = buildDeck().filter(card => card.kind !== 'rules');
        this.discard = [];
        this.status = 'waiting';
        this.phase = 'draw';
        this.currentTurnIndex = 0;
        this.cardsPlayed = 0;
        this.drawn = false;
        this.pendingAction = null;
        this.pendingDebts = [];
        this.pendingDebt = null;
        this.interactionSequence = 0;
        this.resolutionSequence = 0;
        this.interaction = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this._shuffle();
    }
    _shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    _draw(count) {
        const cards = [];
        for (let i = 0; i < count; i++) {
            if (!this.deck.length) {
                this.deck = this.discard.splice(0);
                this._shuffle();
            }
            if (this.deck.length) cards.push(this.deck.pop());
        }
        return cards;
    }
    start() {
        if (this.players.length < 2 || this.players.length > 5) return { success: false, message: '大富翁纸牌需要 2-5 名玩家' };
        this.players.forEach(player => { player.hand = this._draw(5); });
        this.status = 'playing';
        this.phase = 'draw';
        this.turnNumber = 1;
        this.interactionSequence = 0;
        this.resolutionSequence = 0;
        this.interaction = null;
        this.actionLog = [`游戏开始，${this.players[0].name} 先行动`];
        return this._success('大富翁纸牌开始');
    }
    getCurrentPlayer() { return this.players[this.currentTurnIndex] || null; }
    _beginInteraction(type, actor, card, targets = [], extra = {}) {
        const targetIds = targets.map(target => target.id);
        const targetNames = targets.map(target => target.name);
        this.interaction = {
            interactionId: ++this.interactionSequence,
            resolutionId: null,
            type,
            actorId: actor?.id || null,
            actorName: actor?.name || null,
            card: publicCard(card),
            targetIds,
            targetNames,
            currentTargetId: targetIds[0] || null,
            currentTargetName: targetNames[0] || null,
            responsePlayerId: targetIds[0] || null,
            responsePlayerName: targetNames[0] || null,
            queueIndex: targetIds.length ? 0 : null,
            queueTotal: targetIds.length,
            stage: targets.length ? 'response' : 'resolved',
            noCount: 0,
            noChain: [],
            results: [],
            payments: [],
            transfer: null,
            outcome: targets.length ? null : 'resolved',
            message: null,
            ...extra,
        };
        return this.interaction;
    }
    _updateInteraction(fields = {}) {
        if (this.interaction) Object.assign(this.interaction, fields);
        return this.interaction;
    }
    _recordInteractionResult(targetId, outcome, message, extra = {}) {
        if (!this.interaction) return;
        this.interaction.results.push({ targetId, outcome, message, ...extra });
    }
    _finishInteraction(outcome, message, extra = {}) {
        if (!this.interaction) return;
        Object.assign(this.interaction, {
            stage: 'resolved',
            outcome,
            message,
            responsePlayerId: null,
            responsePlayerName: null,
            resolutionId: ++this.resolutionSequence,
            ...extra,
        });
    }
    _newGroupId(player, color) {
        const id = `${player.id}:${color}:${player.nextGroupNumber++}`;
        return id;
    }
    _groups(player, onlyColor = null) {
        const colors = onlyColor ? [onlyColor] : COLORS;
        const groups = [];
        colors.forEach(color => {
            const byId = new Map();
            (player.properties[color] || []).forEach(card => {
                if (!card.groupId) card.groupId = `${player.id}:${color}:legacy`;
                if (!byId.has(card.groupId)) byId.set(card.groupId, { id: card.groupId, color, cards: [] });
                byId.get(card.groupId).cards.push(card);
            });
            groups.push(...byId.values());
        });
        return groups;
    }
    _findGroup(player, groupId, color = null) {
        return this._groups(player, color).find(group => group.id === groupId) || null;
    }
    _groupIsComplete(group) {
        return Boolean(group && group.cards.length >= (COLOR_SIZE[group.color] || 2) && group.cards.some(card => card.kind === 'property'));
    }
    _groupBuildings(player, groupId) {
        if (!player.buildings[groupId]) player.buildings[groupId] = { house: null, hotel: null };
        return player.buildings[groupId];
    }
    _syncBuildingCounts(player) {
        COLORS.forEach(color => { player.houses[color] = 0; player.hotels[color] = 0; });
        this._groups(player).forEach(group => {
            const slot = player.buildings[group.id];
            if (slot?.house) player.houses[group.color] += 1;
            if (slot?.hotel) player.hotels[group.color] += 1;
        });
    }
    _cleanupGroupBuildings(player, groupId) {
        const group = this._findGroup(player, groupId);
        if (group && this._groupIsComplete(group)) return [];
        const slot = player.buildings[groupId];
        if (!slot) return [];
        // A property payment or rearrangement may break a developed set. The
        // physical House/Hotel cards stay in the owner's table-side bank;
        // they are not discarded and cannot be used as a property payment.
        const movedToBank = [slot.house, slot.hotel].filter(Boolean);
        player.bank.push(...movedToBank);
        delete player.buildings[groupId];
        this._syncBuildingCounts(player);
        return movedToBank;
    }
    _chooseGroup(player, color, requestedGroupId = null) {
        const groups = this._groups(player, color);
        if (requestedGroupId && requestedGroupId !== 'new') {
            const requested = groups.find(group => group.id === requestedGroupId);
            if (!requested || requested.cards.length >= COLOR_SIZE[color]) return null;
            return requested;
        }
        if (requestedGroupId !== 'new') {
            const incomplete = groups.find(group => group.cards.length < COLOR_SIZE[color]);
            if (incomplete) return incomplete;
        }
        return { id: this._newGroupId(player, color), color, cards: [] };
    }
    _addProperty(player, card, color, requestedGroupId = null) {
        const group = this._chooseGroup(player, color, requestedGroupId);
        if (!group) return null;
        const placed = { ...card, color, groupId: group.id };
        player.properties[color].push(placed);
        return placed;
    }
    _removeProperty(player, color, cardId) {
        const pile = player.properties[color] || [];
        const index = pile.findIndex(card => card.id === cardId);
        if (index < 0) return null;
        const [card] = pile.splice(index, 1);
        this._cleanupGroupBuildings(player, card.groupId || `${player.id}:${color}:legacy`);
        return card;
    }
    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在' };
        if (this.pendingAction && this.pendingAction.responsePlayerId === playerId) return this._handleResponse(player, action);
        if (this.pendingDebt?.payerId === playerId) return this._payDebt(player, action);
        if (this.pendingAction || this.pendingDebt) return { success: false, message: '请等待当前回应或支付流程完成', state: this.getPlayerState(playerId) };
        if (this.getCurrentPlayer()?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (this.phase === 'discard') {
            if (action.kind !== 'discardCard') return { success: false, message: '手牌超过七张，请先弃牌到七张', state: this.getPlayerState(playerId) };
            return this._discardForLimit(player, action);
        }
        if (action.kind === 'drawCards') return this._drawCards(player);
        if (action.kind === 'playCard') return this._playCard(player, action);
        if (action.kind === 'moveProperty') return this._moveProperty(player, action);
        if (action.kind === 'endTurn') return this._endTurn(player);
        return { success: false, message: '未知的大富翁纸牌动作', state: this.getPlayerState(playerId) };
    }
    _drawCards(player) {
        if (this.phase !== 'draw') return { success: false, message: '本回合已经摸过牌', state: this.getPlayerState(player.id) };
        this.interaction = null;
        const amount = player.hand.length === 0 ? 5 : 2;
        player.hand.push(...this._draw(amount));
        this.phase = 'play';
        this.drawn = true;
        return this._log('drawCards', player, `${player.name} 摸了 ${amount} 张牌`);
    }
    _playCard(player, action) {
        if (this.phase !== 'play') return { success: false, message: '请先摸牌', state: this.getPlayerState(player.id) };
        if (this.cardsPlayed >= 3) return { success: false, message: '本回合最多打出三张牌', state: this.getPlayerState(player.id) };
        const index = this._handCardIndex(player, action);
        const card = player.hand[index];
        if (!card) return { success: false, message: action.cardId ? '这张牌已经不在手牌中，请按最新手牌重新选择' : '找不到这张牌', state: this.getPlayerState(player.id) };
        if (player.pendingDoubleRent && card.kind !== 'rent' && card.action !== 'doubleRent') return { success: false, message: '双倍租金必须紧接租金牌，或再接一张双倍租金', state: this.getPlayerState(player.id) };
        // 新的出牌覆盖中央的上一次公开行动；会产生回应链的分支会在后续重新建立。
        this.interaction = null;
        if (card.kind === 'money' || (action.zone === 'bank' && ['action', 'rent'].includes(card.kind))) {
            this._spendHandCard(player, index);
            player.bank.push(card);
            return this._recordPlay(player, `${player.name} 把${card.name}存入银行`);
        }
        if (card.kind === 'property' || card.kind === 'property_wild') return this._playProperty(player, index, card, action);
        if (card.kind === 'rent') return this._playRent(player, index, card, action);
        if (card.kind !== 'action') return { success: false, message: '这张牌当前不能使用', state: this.getPlayerState(player.id) };
        if (card.action === 'justSayNo') return { success: false, message: '“做出反对”只能用于回应对手行动', state: this.getPlayerState(player.id) };
        if (card.action === 'dealBreaker') return this._playDealBreaker(player, index, card, action);
        if (card.action === 'passGo') {
            this._spendHandCard(player, index);
            this.discard.push(card);
            player.hand.push(...this._draw(2));
            const message = `${player.name} 使用通行证，摸了两张牌`;
            this._beginInteraction('passGo', player, card, [], { stage: 'resolved', outcome: 'draw', message });
            this._finishInteraction('draw', message);
            return this._recordPlay(player, message);
        }
        if (card.action === 'doubleRent') return this._playDoubleRent(player, index, card);
        if (card.action === 'house' || card.action === 'hotel') return this._playBuilding(player, index, card, action);
        if (card.action === 'debtCollector') return this._playDebtCollector(player, index, card, action);
        if (card.action === 'birthday') return this._playBirthday(player, index, card);
        if (card.action === 'slyDeal' || card.action === 'forcedDeal') return this._playPropertyDeal(player, index, card, action);
        return { success: false, message: '这张牌当前不能使用', state: this.getPlayerState(player.id) };
    }
    _playProperty(player, index, card, action) {
        const color = card.kind === 'property' ? card.color : action.color;
        if (!this._canUseColor(card, color)) return { success: false, message: '请选择这张地产牌允许的颜色', state: this.getPlayerState(player.id) };
        const targetGroup = this._chooseGroup(player, color, action.groupId || null);
        if (!targetGroup) return { success: false, message: '所选地产组已经完整，请另开一组或选择未完成组', state: this.getPlayerState(player.id) };
        const placed = { ...card, color, groupId: targetGroup.id };
        this._spendHandCard(player, index);
        player.properties[color].push(placed);
        const groupNumber = this._groups(player, color).findIndex(group => group.id === placed.groupId) + 1;
        const result = this._recordPlay(player, `${player.name} 放置了${card.name}${card.kind === 'property_wild' ? `（${COLOR_LABELS[color]}）` : ''}到第 ${groupNumber} 组`);
        return this._checkWin(player, result);
    }
    _playRent(player, index, card, action) {
        const supportedColors = Array.isArray(card.colors) && card.colors.length ? card.colors : COLORS;
        const color = supportedColors.includes(action.color) ? action.color : null;
        const group = color ? this._rentableGroups(player, color).find(item => item.id === action.groupId) || (!action.groupId ? this._bestRentGroup(player, color) : null) : null;
        const amount = group ? this._rentAmount(player, color, group.id) : 0;
        if (!color || amount <= 0) return { success: false, message: '请选择可收租且你已拥有的地产颜色', state: this.getPlayerState(player.id) };
        const targets = Array.isArray(card.colors) && card.colors.length
            ? this.players.filter(target => target.id !== player.id && target.isOnline)
            : [this.playerMap[action.targetId]].filter(target => target && target.id !== player.id && target.isOnline);
        if (!targets.length) return { success: false, message: '请选择可收租对象', state: this.getPlayerState(player.id) };
        const rentMultiplier = player.rentMultiplier || 1;
        const doubleRentCount = player.doubleRentCount || 0;
        this._spendHandCard(player, index);
        this.discard.push(card);
        this.cardsPlayed += 1;
        player.rentMultiplier = 1;
        player.pendingDoubleRent = false;
        player.doubleRentCount = 0;
        const actions = targets.map(target => this._pendingCharge('rent', player, target, amount, card, { color, groupId: group.id, rentMultiplier, doubleRentCount }));
        const groupNumber = this._groups(player, color).findIndex(item => item.id === group.id) + 1;
        return this._startPendingActions(actions, `${player.name} 使用${card.name}，按${COLOR_LABELS[color]}地产第 ${groupNumber} 组向${Array.isArray(card.colors) && card.colors.length ? '所有对手' : targets[0].name}收取 ${amount}M`);
    }
    _playDoubleRent(player, index, card) {
        if (player.doubleRentCount >= 2) return { success: false, message: '最多连续使用两张双倍租金', state: this.getPlayerState(player.id) };
        if (this.cardsPlayed >= 2) return { success: false, message: '没有剩余出牌次数与租金牌配合', state: this.getPlayerState(player.id) };
        const remainingRent = player.hand.some((item, cardIndex) => cardIndex !== index && item.kind === 'rent' && this._cardHasRentableGroup(player, item));
        if (!remainingRent) return { success: false, message: '手牌中没有能立即配合的租金牌', state: this.getPlayerState(player.id) };
        this._spendHandCard(player, index);
        this.discard.push(card);
        player.rentMultiplier = Math.min(4, (player.rentMultiplier || 1) * 2);
        player.pendingDoubleRent = true;
        player.doubleRentCount += 1;
        const message = `${player.name} 打出第 ${player.doubleRentCount} 张双倍租金，下一张租金牌将 x${player.rentMultiplier}`;
        this._beginInteraction('doubleRent', player, card, [], { stage: 'resolved', outcome: 'armed', message, rentMultiplier: player.rentMultiplier, doubleRentCount: player.doubleRentCount });
        this._finishInteraction('armed', message);
        return this._recordPlay(player, message);
    }
    _playBuilding(player, index, card, action) {
        const group = this._findGroup(player, action.groupId, action.color);
        const color = group?.color || action.color;
        if (!group || !COLORS.includes(color) || ['railroad', 'utility'].includes(color) || !this._groupIsComplete(group)) return { success: false, message: '房子或酒店只能放在自己的完整彩色地产组，且不能放在铁路或公用事业', state: this.getPlayerState(player.id) };
        const buildings = this._groupBuildings(player, group.id);
        if (card.action === 'house' && buildings.house) return { success: false, message: '每个地产组最多放置一张房子牌', state: this.getPlayerState(player.id) };
        if (card.action === 'hotel' && buildings.hotel) return { success: false, message: '每个地产组最多放置一张酒店牌', state: this.getPlayerState(player.id) };
        if (card.action === 'hotel' && !buildings.house) return { success: false, message: '酒店必须建在已有房子的地产组', state: this.getPlayerState(player.id) };
        this._spendHandCard(player, index);
        if (card.action === 'house') buildings.house = card;
        else buildings.hotel = card;
        this._syncBuildingCounts(player);
        return this._recordPlay(player, `${player.name} 在${COLOR_LABELS[color]}地产组放置了${card.name}`);
    }
    _playDebtCollector(player, index, card, action) {
        const target = this.playerMap[action.targetId];
        if (!target || target.id === player.id || !target.isOnline) return { success: false, message: '请选择在线的债务对象', state: this.getPlayerState(player.id) };
        this._spendHandCard(player, index);
        this.discard.push(card);
        this.cardsPlayed += 1;
        return this._startPendingActions([this._pendingCharge('debtCollector', player, target, 5, card)], `${player.name} 向${target.name}收取 5M 债务`);
    }
    _playBirthday(player, index, card) {
        const targets = this.players.filter(target => target.id !== player.id && target.isOnline);
        if (!targets.length) return { success: false, message: '没有其他在线玩家', state: this.getPlayerState(player.id) };
        this._spendHandCard(player, index);
        this.discard.push(card);
        this.cardsPlayed += 1;
        return this._startPendingActions(targets.map(target => this._pendingCharge('birthday', player, target, 2, card)), `${player.name} 使用我的生日，所有对手各支付 2M`);
    }
    _playDealBreaker(player, index, card, action) {
        const target = this.playerMap[action.targetId];
        const group = target ? this._findGroup(target, action.groupId, action.color) || (!action.groupId ? this._groups(target, action.color).find(item => this._groupIsComplete(item)) : null) : null;
        if (!target || target.id === player.id || !target.isOnline || !group || !this._groupIsComplete(group)) return { success: false, message: '请选择对手的一组完整地产', state: this.getPlayerState(player.id) };
        this._spendHandCard(player, index);
        this.discard.push(card);
        this.cardsPlayed += 1;
        return this._startPendingActions([this._pendingAction('dealBreaker', player, target, card, { color: group.color, groupId: group.id })], `${player.name} 想夺走${target.name}的${COLOR_LABELS[group.color]}完整地产组`);
    }
    _playPropertyDeal(player, index, card, action) {
        const target = this.playerMap[action.targetId];
        const targetProperty = target?.properties?.[action.targetColor]?.find(item => item.id === action.targetPropertyId);
        const ownProperty = player.properties?.[action.ownColor]?.find(item => item.id === action.ownPropertyId);
        if (!target || target.id === player.id || !target.isOnline || !targetProperty) return { success: false, message: '请选择对手的一张地产', state: this.getPlayerState(player.id) };
        const targetGroup = this._findGroup(target, targetProperty.groupId || `${target.id}:${action.targetColor}:legacy`, action.targetColor);
        if (this._groupIsComplete(targetGroup)) return { success: false, message: '不能偷取或交换完整地产组中的地产', state: this.getPlayerState(player.id) };
        if (card.action === 'forcedDeal') {
            if (!ownProperty || !action.ownColor) return { success: false, message: '强制交易需要选择自己的一张地产', state: this.getPlayerState(player.id) };
            const ownGroup = this._findGroup(player, ownProperty.groupId || `${player.id}:${action.ownColor}:legacy`, action.ownColor);
            if (this._groupIsComplete(ownGroup)) return { success: false, message: '不能用自己完整地产组中的地产交换', state: this.getPlayerState(player.id) };
        }
        this._spendHandCard(player, index);
        this.discard.push(card);
        this.cardsPlayed += 1;
        return this._startPendingActions([this._pendingAction(card.action, player, target, card, { targetColor: action.targetColor, targetPropertyId: action.targetPropertyId, ownColor: action.ownColor || null, ownPropertyId: action.ownPropertyId || null })], `${player.name} 对${target.name}使用${card.action === 'slyDeal' ? '盗取' : '强制交易'}`);
    }
    _handleResponse(player, action) {
        const pending = this.pendingAction;
        if (!pending || pending.responsePlayerId !== player.id) return { success: false, message: '现在不需要你回应', state: this.getPlayerState(player.id) };
        if (action.kind === 'justSayNo') {
            const cardIndex = this._handCardIndex(player, action);
            const card = player.hand[cardIndex];
            if (!card || card.kind !== 'action' || card.action !== 'justSayNo') return { success: false, message: '请选择“做出反对”牌', state: this.getPlayerState(player.id) };
            this._spendHandCard(player, cardIndex);
            this.discard.push(card);
            pending.noCount = (pending.noCount || 0) + 1;
            pending.lastNoBy = player.id;
            const actionLives = pending.noCount % 2 === 0;
            pending.responsePlayerId = actionLives ? pending.targetId : pending.actorId;
            pending.responsePlayerName = actionLives ? pending.targetName : pending.actorName;
            const message = actionLives
                ? `${player.name} 用“做出反对”反制，${pending.targetName}需要重新回应`
                : `${player.name} 使用“做出反对”，等待${pending.actorName}是否反制`;
            if (this.interaction) {
                this.interaction.noChain.push({ playerId: player.id, playerName: player.name, targetId: pending.targetId, count: pending.noCount });
                this._updateInteraction({
                    stage: 'no_response',
                    noCount: pending.noCount,
                    lastNoBy: player.id,
                    responsePlayerId: pending.responsePlayerId,
                    responsePlayerName: pending.responsePlayerName,
                    message,
                });
            }
            return this._log('justSayNo', player, message);
        }
        if (action.kind !== 'acceptAction') return { success: false, message: '请选择接受或使用“做出反对”', state: this.getPlayerState(player.id) };
        if ((pending.noCount || 0) % 2 === 1) {
            const message = `${player.name} 没有反制，“做出反对”生效，${pending.targetName}免除本次行动`;
            this.pendingAction = null;
            this._recordInteractionResult(pending.targetId, 'cancelled', message, { noCount: pending.noCount || 0 });
            return this._finishPendingStep(message);
        }
        this.pendingAction = null;
        this._updateInteraction({ stage: 'accepted', responsePlayerId: null, responsePlayerName: null, message: `${player.name} 接受${this._actionName(pending.type)}` });
        return this._resolveAcceptedAction(player, pending);
    }
    _resolveAcceptedAction(player, pending, auto = false) {
        if (['rent', 'debtCollector', 'birthday'].includes(pending.type)) {
            this.pendingDebt = {
                payerId: pending.targetId,
                payerName: pending.targetName,
                creditorId: pending.actorId,
                creditorName: pending.actorName,
                amount: pending.amount,
                card: pending.card,
                type: pending.type,
                color: pending.color || null,
            };
            if (!this._paymentOptions(this.playerMap[pending.targetId]).length) {
                this.pendingDebt = null;
                const message = `${pending.targetName} 没有可支付资产，本次${this._actionName(pending.type)}结清`;
                this._recordInteractionResult(pending.targetId, 'no_assets', message, { amount: pending.amount });
                return this._finishPendingStep(message);
            }
            const prefix = auto ? `${pending.targetName} 没有“做出反对”，` : `${pending.targetName} 接受${this._actionName(pending.type)}，`;
            const message = `${prefix}请支付 ${pending.amount}M`;
            this._updateInteraction({
                stage: 'payment',
                currentTargetId: pending.targetId,
                currentTargetName: pending.targetName,
                responsePlayerId: pending.targetId,
                responsePlayerName: pending.targetName,
                payerId: pending.targetId,
                creditorId: pending.actorId,
                amount: pending.amount,
                message,
            });
            return this._log(auto ? 'autoAcceptAction' : 'acceptAction', player, message);
        }
        if (pending.type === 'dealBreaker') return this._resolveDealBreaker(player, pending);
        if (pending.type === 'slyDeal') return this._resolveSlyDeal(player, pending);
        if (pending.type === 'forcedDeal') return this._resolveForcedDeal(player, pending);
        return this._finishPendingStep(`${player.name} 接受了行动`);
    }
    _resolveDealBreaker(player, pending) {
        const actor = this.playerMap[pending.actorId];
        const target = this.playerMap[pending.targetId];
        if (actor && target) {
            const group = this._findGroup(target, pending.groupId, pending.color);
            if (group) {
                const newGroupId = this._newGroupId(actor, pending.color);
                const ids = new Set(group.cards.map(card => card.id));
                const taken = target.properties[pending.color].filter(card => ids.has(card.id));
                target.properties[pending.color] = target.properties[pending.color].filter(card => !ids.has(card.id));
                actor.properties[pending.color].push(...taken.map(card => ({ ...card, color: pending.color, groupId: newGroupId })));
                const buildings = target.buildings[group.id];
                if (buildings) {
                    actor.buildings[newGroupId] = buildings;
                    delete target.buildings[group.id];
                }
                this._syncBuildingCounts(actor);
                this._syncBuildingCounts(target);
                this._updateInteraction({
                    stage: 'transfer',
                    transfer: { kind: 'group', fromId: target.id, toId: actor.id, color: pending.color, cardIds: taken.map(card => card.id), groupId: newGroupId },
                });
            }
        }
        const message = `${player.name} 接受物业接管，${pending.actorName}获得${COLOR_LABELS[pending.color]}完整地产组`;
        this._recordInteractionResult(pending.targetId, 'transferred', message, { transfer: this.interaction?.transfer || null });
        const result = this._finishPendingStep(message);
        return actor ? this._checkWin(actor, result) : result;
    }
    _resolveSlyDeal(player, pending) {
        const actor = this.playerMap[pending.actorId];
        const target = this.playerMap[pending.targetId];
        if (actor && target) {
            const taken = this._removeProperty(target, pending.targetColor, pending.targetPropertyId);
            if (taken) {
                const placed = this._addProperty(actor, taken, pending.targetColor);
                this._updateInteraction({
                    stage: 'transfer',
                    transfer: { kind: 'property', fromId: target.id, toId: actor.id, color: pending.targetColor, cardIds: [taken.id], groupId: placed?.groupId || null },
                });
            }
        }
        const message = `${player.name} 接受盗取，${pending.actorName}获得一张地产`;
        this._recordInteractionResult(pending.targetId, 'transferred', message, { transfer: this.interaction?.transfer || null });
        const result = this._finishPendingStep(message);
        return actor ? this._checkWin(actor, result) : result;
    }
    _resolveForcedDeal(player, pending) {
        const actor = this.playerMap[pending.actorId];
        const target = this.playerMap[pending.targetId];
        if (actor && target) {
            const targetCard = this._removeProperty(target, pending.targetColor, pending.targetPropertyId);
            const ownCard = this._removeProperty(actor, pending.ownColor, pending.ownPropertyId);
            if (targetCard && ownCard) {
                const actorPlacement = this._addProperty(actor, targetCard, pending.targetColor);
                const targetPlacement = this._addProperty(target, ownCard, pending.ownColor);
                this._updateInteraction({
                    stage: 'transfer',
                    transfer: {
                        kind: 'swap',
                        fromId: target.id,
                        toId: actor.id,
                        cardIds: [targetCard.id, ownCard.id],
                        targetColor: pending.targetColor,
                        ownColor: pending.ownColor,
                        actorGroupId: actorPlacement?.groupId || null,
                        targetGroupId: targetPlacement?.groupId || null,
                    },
                });
            }
        }
        const message = `${player.name} 接受强制交易，双方地产互换`;
        this._recordInteractionResult(pending.targetId, 'swapped', message, { transfer: this.interaction?.transfer || null });
        const result = this._finishPendingStep(message);
        const actorResult = actor ? this._checkWin(actor, result) : result;
        return this.status === 'ended' || !target ? actorResult : this._checkWin(target, actorResult);
    }
    _payDebt(player, action) {
        if (action.kind !== 'payDebt') return { success: false, message: '请支付债务', state: this.getPlayerState(player.id) };
        const debt = this.pendingDebt;
        const creditor = this.playerMap[debt.creditorId];
        if (!creditor) {
            this.pendingDebt = null;
            return this._finishPendingStep('债权人已离线，债务结束');
        }
        const available = this._paymentOptions(player);
        const requestedIds = Array.isArray(action.cardIds) ? action.cardIds.map(String) : [];
        const picked = requestedIds.map(id => available.find(item => item.card.id === id)).filter(Boolean);
        const selected = requestedIds.length ? picked : available.filter(item => item.zone === 'bank');
        if (requestedIds.length !== new Set(requestedIds).size || (requestedIds.length > 0 && selected.length !== requestedIds.length)) return { success: false, message: '支付资产无效，请重新选择', state: this.getPlayerState(player.id) };
        const selectedValue = selected.reduce((sum, item) => sum + (item.card.value || 0), 0);
        const totalAvailable = available.reduce((sum, item) => sum + (item.card.value || 0), 0);
        if (selectedValue < debt.amount && totalAvailable > selectedValue) return { success: false, message: `还需要选择至少 ${debt.amount - selectedValue}M 资产`, state: this.getPlayerState(player.id) };
        selected.slice().sort((left, right) => Number(right.zone === 'building') - Number(left.zone === 'building')).forEach(item => {
            if (item.zone === 'bank') {
                const index = player.bank.findIndex(card => card.id === item.card.id);
                if (index >= 0) creditor.bank.push(player.bank.splice(index, 1)[0]);
            } else {
                const paid = this._removeProperty(player, item.color, item.card.id);
                if (paid) this._addProperty(creditor, paid, item.color);
            }
        });
        this._syncBuildingCounts(player);
        this._syncBuildingCounts(creditor);
        this.pendingDebt = null;
        const suffix = selectedValue < debt.amount ? `（资产不足，已支付 ${selectedValue}M）` : '';
        const message = `${player.name} 支付了 ${selectedValue}M${suffix}`;
        const payment = {
            payerId: player.id,
            creditorId: creditor.id,
            amount: selectedValue,
            requestedAmount: debt.amount,
            assets: selected.map(item => ({ id: item.card.id, name: item.card.name, value: item.card.value || 0, zone: item.zone, color: item.color || null })),
        };
        if (this.interaction) this.interaction.payments.push(payment);
        this._updateInteraction({ stage: 'transfer', transfer: { kind: 'payment', fromId: player.id, toId: creditor.id, amount: selectedValue, cardIds: payment.assets.map(asset => asset.id) }, message });
        this._recordInteractionResult(player.id, 'paid', message, { amount: selectedValue, requestedAmount: debt.amount });
        const result = this._finishPendingStep(message);
        return this._checkWin(creditor, result);
    }
    _paymentOptions(player) {
        const options = player.bank.map(card => ({ card, zone: 'bank' }));
        COLORS.forEach(color => (player.properties[color] || []).forEach(card => {
            if ((card.value || 0) > 0) options.push({ card, zone: 'property', color, groupId: card.groupId || null });
        }));
        return options;
    }
    _moveProperty(player, action) {
        if (this.phase !== 'play') return { success: false, message: '只能在自己的出牌阶段调整地产', state: this.getPlayerState(player.id) };
        if (player.pendingDoubleRent) return { success: false, message: '双倍租金必须紧接租金牌，不能先调整地产', state: this.getPlayerState(player.id) };
        const fromColor = action.fromColor;
        const toColor = action.toColor;
        const cardId = String(action.cardId || '');
        if (!COLORS.includes(fromColor) || !COLORS.includes(toColor)) return { success: false, message: '请选择合法的地产组', state: this.getPlayerState(player.id) };
        const pile = player.properties[fromColor] || [];
        const index = pile.findIndex(card => card.id === cardId);
        const card = pile[index];
        const sourceGroupId = card?.groupId || `${player.id}:${fromColor}:legacy`;
        if (action.fromGroupId && action.fromGroupId !== sourceGroupId) return { success: false, message: '地产牌已经不在所选原组', state: this.getPlayerState(player.id) };
        if (!card || !this._canUseColor(card, toColor)) return { success: false, message: '这张地产牌不能放入目标颜色', state: this.getPlayerState(player.id) };
        if (fromColor === toColor && (!action.toGroupId || action.toGroupId === sourceGroupId)) return { success: false, message: '请选择同色的另一组或新建一组', state: this.getPlayerState(player.id) };
        const targetGroup = this._chooseGroup(player, toColor, action.toGroupId || null);
        if (!targetGroup || targetGroup.id === sourceGroupId) return { success: false, message: '目标地产组不可用或已经完整', state: this.getPlayerState(player.id) };
        this.interaction = null;
        pile.splice(index, 1);
        card.color = toColor;
        card.groupId = targetGroup.id;
        player.properties[toColor].push(card);
        this._cleanupGroupBuildings(player, sourceGroupId);
        const result = this._log('moveProperty', player, `${player.name} 将${card.name || '地产牌'}移到${COLOR_LABELS[toColor]}的另一地产组`);
        return this._checkWin(player, result);
    }
    _pendingCharge(type, actor, target, amount, card, extra = {}) {
        return this._pendingAction(type, actor, target, card, { ...extra, amount });
    }
    _pendingAction(type, actor, target, card, extra = {}) {
        return {
            type,
            actorId: actor.id,
            actorName: actor.name,
            targetId: target.id,
            targetName: target.name,
            responsePlayerId: target.id,
            responsePlayerName: target.name,
            noCount: 0,
            card: publicCard(card),
            ...extra,
        };
    }
    _startPendingActions(actions, message) {
        this.pendingAction = null;
        this.pendingDebts = actions;
        const first = actions[0] || null;
        const actor = first ? this.playerMap[first.actorId] : null;
        const targets = actions.map(item => this.playerMap[item.targetId]).filter(Boolean);
        if (first && actor) {
            this._beginInteraction(first.type, actor, first.card, targets, {
                stage: 'response',
                amount: first.amount || null,
                color: first.color || null,
                groupId: first.groupId || null,
                targetColor: first.targetColor || null,
                targetPropertyId: first.targetPropertyId || null,
                ownColor: first.ownColor || null,
                ownPropertyId: first.ownPropertyId || null,
                rentMultiplier: first.rentMultiplier || 1,
                doubleRentCount: first.doubleRentCount || 0,
                message,
            });
        }
        this.lastAction = { kind: 'playCard', playerId: actions[0]?.actorId || null, playerName: actions[0]?.actorName || null, message };
        this.actionLog.push(message);
        return this._activateNextPendingAction(message);
    }
    _finishPendingStep(message) {
        this.lastAction = { kind: 'resolveAction', playerId: null, playerName: null, message };
        this.actionLog.push(message);
        const result = this._activateNextPendingAction(message);
        if (!this.pendingAction && !this.pendingDebt && !this.pendingDebts.length) {
            this._finishInteraction('completed', message);
            return { ...result, state: this.getPublicState() };
        }
        return result;
    }
    _activateNextPendingAction(message) {
        if (this.pendingDebt || this.status === 'ended') return this._success(message);
        const next = this.pendingDebts.shift() || null;
        this.pendingAction = null;
        if (!next) return this._success(message);
        const target = this.playerMap[next.targetId];
        if (!target || !target.isOnline) {
            this.actionLog.push(`${next.targetName} 已离线，跳过本次${this._actionName(next.type)}`);
            this._recordInteractionResult(next.targetId, 'skipped', `${next.targetName} 已离线`);
            return this._activateNextPendingAction(message);
        }
        this.pendingAction = next;
        this.actionLog.push(`${next.responsePlayerName} 可接受或使用“做出反对”回应${this._actionName(next.type)}`);
        const queueIndex = this.interaction?.targetIds?.indexOf(next.targetId) ?? -1;
        this._updateInteraction({
            stage: 'response',
            currentTargetId: next.targetId,
            currentTargetName: next.targetName,
            responsePlayerId: next.responsePlayerId,
            responsePlayerName: next.responsePlayerName,
            queueIndex: queueIndex >= 0 ? queueIndex : null,
            amount: next.amount || this.interaction?.amount || null,
            color: next.color || this.interaction?.color || null,
            noCount: next.noCount || 0,
            message: `${next.responsePlayerName} 可接受或使用“做出反对”回应${this._actionName(next.type)}`,
        });
        return this._success(message);
    }
    _spendHandCard(player, index) { return player.hand.splice(index, 1)[0]; }
    _handCardIndex(player, action = {}) {
        const cardId = typeof action.cardId === 'string' ? action.cardId : '';
        if (cardId) return player.hand.findIndex(card => card.id === cardId);
        const index = Number(action.cardIndex);
        return Number.isInteger(index) ? index : -1;
    }
    _recordPlay(player, message) {
        this.cardsPlayed += 1;
        return this._log('playCard', player, message);
    }
    _log(kind, player, message) {
        this.lastAction = { kind, playerId: player?.id || null, playerName: player?.name || null, message };
        this.actionLog.push(message);
        return this._success(message);
    }
    _actionName(type) {
        return type === 'rent' ? '租金' : (ACTION_NAMES[type] || '行动');
    }
    _hasJustSayNo(playerId) {
        return Boolean(this.playerMap[playerId]?.hand.some(card => card.kind === 'action' && card.action === 'justSayNo'));
    }
    _canUseColor(card, color) {
        return COLORS.includes(color) && (card.kind === 'property' ? card.color === color : Array.isArray(card.colors) && card.colors.includes(color));
    }
    _rentAmount(player, color, groupId = null) {
        const group = groupId ? this._findGroup(player, groupId, color) : this._bestRentGroup(player, color, false);
        const pile = group?.cards || [];
        if (!pile.length) return 0;
        if (pile.length === 1 && pile[0].allColor) return 0;
        const table = RENT_TABLE[color] || [];
        const rent = table[Math.min(pile.length, table.length) - 1] || 0;
        const buildings = group ? player.buildings[group.id] : null;
        const buildingBonus = ['railroad', 'utility'].includes(color) ? 0 : (buildings?.house ? 3 : 0) + (buildings?.hotel ? 4 : 0);
        return (rent + buildingBonus) * (player.rentMultiplier || 1);
    }
    _rentableGroups(player, color) {
        return this._groups(player, color).filter(group => {
            if (!group.cards.length) return false;
            return !(group.cards.length === 1 && group.cards[0].allColor);
        });
    }
    _bestRentGroup(player, color, applyMultiplier = true) {
        const groups = this._rentableGroups(player, color);
        if (!groups.length) return null;
        const multiplier = player.rentMultiplier;
        if (!applyMultiplier) player.rentMultiplier = 1;
        const best = groups.sort((left, right) => this._rentAmount(player, color, right.id) - this._rentAmount(player, color, left.id))[0];
        if (!applyMultiplier) player.rentMultiplier = multiplier;
        return best;
    }
    _cardHasRentableGroup(player, card) {
        const colors = Array.isArray(card.colors) && card.colors.length ? card.colors : COLORS;
        return colors.some(color => this._rentableGroups(player, color).length > 0);
    }
    _isComplete(player, color) {
        return this._groups(player, color).some(group => this._groupIsComplete(group));
    }
    _completedSets(player) { return COLORS.filter(color => this._groups(player, color).some(group => this._groupIsComplete(group))).length; }
    _checkWin(player, result = this._success('完成')) {
        if (this.status === 'playing' && this._completedSets(player) >= 3) {
            this.status = 'ended';
            this.winner = player;
            const message = `${player.name} 完成三个不同颜色的地产组，赢得游戏`;
            this._finishInteraction('win', message, { winnerId: player.id });
            this.lastAction = { kind: 'gameOver', playerId: player.id, playerName: player.name, message };
            this.actionLog.push(message);
            return { ...this._success(message), ended: true, winner: { id: player.id, name: player.name } };
        }
        return result;
    }
    _endTurn(player) {
        if (this.phase !== 'play') return { success: false, message: '请先摸牌', state: this.getPlayerState(player.id) };
        if (player.pendingDoubleRent) return { success: false, message: '双倍租金尚未与租金牌一起使用', state: this.getPlayerState(player.id) };
        if (player.hand.length > 7) {
            this.phase = 'discard';
            return this._success(`${player.name} 手牌超过七张，请弃到七张`);
        }
        return this._advanceTurn(player);
    }
    _discardForLimit(player, action) {
        const index = this._handCardIndex(player, action);
        if (!Number.isInteger(index) || !player.hand[index]) return { success: false, message: '请选择要弃掉的手牌', state: this.getPlayerState(player.id) };
        const [card] = player.hand.splice(index, 1);
        this.discard.push(card);
        if (player.hand.length <= 7) return this._advanceTurn(player);
        return this._success(`${player.name} 弃掉一张牌，还需弃 ${player.hand.length - 7} 张`);
    }
    _advanceTurn(player) {
        player.rentMultiplier = 1;
        player.pendingDoubleRent = false;
        player.doubleRentCount = 0;
        let attempts = 0;
        do {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts += 1;
        } while (attempts <= this.players.length && !this.players[this.currentTurnIndex]?.isOnline);
        this.turnNumber = (this.turnNumber || 1) + 1;
        this.phase = 'draw';
        this.cardsPlayed = 0;
        this.drawn = false;
        return this._log('endTurn', player, `轮到${this.getCurrentPlayer().name}`);
    }
    getPublicState() {
        this.players.forEach(player => this._syncBuildingCounts(player));
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            turnNumber: this.turnNumber || 1,
            currentTurn: this.getCurrentPlayer()?.id || null,
            currentTurnName: this.getCurrentPlayer()?.name || null,
            cardsPlayed: this.cardsPlayed,
            deckCount: this.deck.length,
            discard: this.discard.map(publicCard),
            discardCount: this.discard.length,
            pendingAction: this.pendingAction ? { ...this.pendingAction, card: publicCard(this.pendingAction.card) } : null,
            pendingDebt: this.pendingDebt ? { payerId: this.pendingDebt.payerId, payerName: this.pendingDebt.payerName, creditorId: this.pendingDebt.creditorId, creditorName: this.pendingDebt.creditorName, amount: this.pendingDebt.amount, type: this.pendingDebt.type, color: this.pendingDebt.color } : null,
            pendingDebtCount: this.pendingDebts.length,
            interaction: this.interaction ? JSON.parse(JSON.stringify(this.interaction)) : null,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-18),
            rules: { cardsInBox: 110, playableCards: 106, handLimit: 7, cardsPerTurn: 3, winSets: 3, colorSize: { ...COLOR_SIZE }, rentTable: Object.fromEntries(Object.entries(RENT_TABLE).map(([color, rents]) => [color, rents.slice()])) },
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                handCount: player.hand.length,
                bankValue: player.bank.reduce((sum, card) => sum + (card.value || 0), 0),
                bank: player.bank.map(publicCard),
                properties: Object.fromEntries(COLORS.map(color => [color, player.properties[color].map(publicCard)])),
                propertyGroups: this._groups(player).map(group => {
                    const buildings = player.buildings[group.id] || {};
                    return {
                        id: group.id,
                        color: group.color,
                        cards: group.cards.map(publicCard),
                        isComplete: this._groupIsComplete(group),
                        rent: this._rentAmount(player, group.color, group.id),
                        house: publicCard(buildings.house),
                        hotel: publicCard(buildings.hotel),
                    };
                }),
                houses: { ...player.houses },
                hotels: { ...player.hotels },
                isOnline: player.isOnline,
                isCurrentTurn: player.id === this.getCurrentPlayer()?.id,
                completedSets: this._completedSets(player),
            })),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
        };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState();
        state.myId = playerId;
        state.myIsCurrentTurn = state.currentTurn === playerId;
        const me = this.playerMap[playerId];
        state.myHand = me?.hand.map(publicCard) || [];
        state.myBank = me?.bank.map(publicCard) || [];
        state.myPendingDoubleRent = Boolean(me?.pendingDoubleRent);
        state.myRentMultiplier = me?.rentMultiplier || 1;
        state.myPaymentOptions = me ? this._paymentOptions(me).map(item => ({ id: item.card.id, name: item.card.name, value: item.card.value || 0, zone: item.zone, color: item.color || null, groupId: item.groupId || null, buildingType: item.buildingType || null })) : [];
        state.availableActions = {
            canDraw: state.myIsCurrentTurn && state.phase === 'draw' && !this.pendingAction && !this.pendingDebt,
            canPlay: state.myIsCurrentTurn && state.phase === 'play' && this.cardsPlayed < 3 && !this.pendingAction && !this.pendingDebt,
            canMoveProperty: state.myIsCurrentTurn && state.phase === 'play' && !me?.pendingDoubleRent && !this.pendingAction && !this.pendingDebt,
            canEndTurn: state.myIsCurrentTurn && state.phase === 'play' && !me?.pendingDoubleRent && !this.pendingAction && !this.pendingDebt,
            canDiscard: state.myIsCurrentTurn && state.phase === 'discard',
            canRespond: this.pendingAction?.responsePlayerId === playerId,
            canPayDebt: this.pendingDebt?.payerId === playerId,
        };
        return state;
    }
    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        player.isOnline = false;
        if (this.pendingAction?.responsePlayerId === playerId) this.pendingAction = null;
        if (this.pendingDebt?.payerId === playerId) this.pendingDebt = null;
        if (this.getCurrentPlayer()?.id === playerId) this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        return this._success(`${player.name} 离开游戏`);
    }
    _success(message) {
        return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null };
    }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = MonopolyDealEngine;
module.exports.buildDeck = buildDeck;
module.exports.COLORS = COLORS;
module.exports.COLOR_SIZE = COLOR_SIZE;
module.exports.RENT_TABLE = RENT_TABLE;
