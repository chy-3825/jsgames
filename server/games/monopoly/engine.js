const STARTING_CASH = 1500;
const PASS_START_REWARD = 200;
const BAIL_COST = 50;
const MAX_HOUSES_PER_PROPERTY = 4;
const HOTEL_LEVEL = 5;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const AUCTION_START_BID = 10;
const CURRENCY = 'M';

const PLAYER_COLORS = ['#d85b62', '#4e8fc4', '#c59a45', '#62a778', '#9872b4', '#d78350', '#bb6d9b', '#4c9d9d'];
const TOKEN_COUNT = 8;
const TOKEN_STYLES = new Set(['2d', '3d']);
const TOKEN_NAMES = ['电车', '渡轮', '帆船', '出租车', '灯笼', '紫荆花', '缆车', '点心'];

function property(index, name, group, color, price, buildCost, rents) {
    return { index, type: 'property', name, group, color, price, buildCost, rents };
}

// The Hong Kong names are a presentation reskin. Prices, building costs and
// rent ladders retain the C1009 classic-board economy.
const BOARD_TEMPLATE = [
    { index: 0, type: 'start', name: '维港起点' },
    property(1, '深水埗', 'brown', '#9b7356', 60, 50, [2, 10, 30, 90, 160, 250]),
    { index: 2, type: 'community_chest', name: '公益金' },
    property(3, '旺角', 'brown', '#9b7356', 60, 50, [4, 20, 60, 180, 320, 450]),
    { index: 4, type: 'tax', name: '印花税', amount: 200 },
    property(5, '九广铁路', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]),
    property(6, '油麻地', 'lightblue', '#75b7d2', 100, 50, [6, 30, 90, 270, 400, 550]),
    { index: 7, type: 'chance', name: '机会' },
    property(8, '尖沙咀', 'lightblue', '#75b7d2', 100, 50, [6, 30, 90, 270, 400, 550]),
    property(9, '佐敦', 'lightblue', '#75b7d2', 120, 50, [8, 40, 100, 300, 450, 600]),
    { index: 10, type: 'jail', name: '监狱 / 仅探访' },
    property(11, '湾仔', 'pink', '#d47e9f', 140, 100, [10, 50, 150, 450, 625, 750]),
    { index: 12, type: 'utility', name: '中华电力', group: 'utility', color: '#8e85bc', price: 150, buildCost: 0, rents: [4, 10] },
    property(13, '铜锣湾', 'pink', '#d47e9f', 140, 100, [10, 50, 150, 450, 625, 750]),
    property(14, '跑马地', 'pink', '#d47e9f', 160, 100, [12, 60, 180, 500, 700, 900]),
    property(15, '山顶缆车', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]),
    property(16, '北角', 'orange', '#d58f45', 180, 100, [14, 70, 200, 550, 750, 950]),
    { index: 17, type: 'community_chest', name: '公益金' },
    property(18, '太古城', 'orange', '#d58f45', 180, 100, [14, 70, 200, 550, 750, 950]),
    property(19, '筲箕湾', 'orange', '#d58f45', 200, 100, [16, 80, 220, 600, 800, 1000]),
    { index: 20, type: 'parking', name: '免费停车' },
    property(21, '赤柱', 'red', '#c85e56', 220, 150, [18, 90, 250, 700, 875, 1050]),
    { index: 22, type: 'chance', name: '机会' },
    property(23, '浅水湾', 'red', '#c85e56', 220, 150, [18, 90, 250, 700, 875, 1050]),
    property(24, '海洋公园', 'red', '#c85e56', 240, 150, [20, 100, 300, 750, 925, 1100]),
    property(25, '天星码头', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]),
    property(26, '中环', 'yellow', '#e6bb4f', 260, 150, [22, 110, 330, 800, 975, 1150]),
    property(27, '金钟', 'yellow', '#e6bb4f', 260, 150, [22, 110, 330, 800, 975, 1150]),
    { index: 28, type: 'utility', name: '水务署', group: 'utility', color: '#8e85bc', price: 150, buildCost: 0, rents: [4, 10] },
    property(29, '兰桂坊', 'yellow', '#e6bb4f', 280, 150, [24, 120, 360, 850, 1025, 1200]),
    { index: 30, type: 'go_to_jail', name: '前往监狱' },
    property(31, '西环', 'green', '#6eae73', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    property(32, '上环', 'green', '#6eae73', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    { index: 33, type: 'community_chest', name: '公益金' },
    property(34, '苏豪区', 'green', '#6eae73', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
    property(35, '香港电车', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]),
    { index: 36, type: 'chance', name: '机会' },
    property(37, '太平山', 'blue', '#5f83ba', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
    { index: 38, type: 'tax', name: '港湾税', amount: 100 },
    property(39, '维多利亚港', 'blue', '#5f83ba', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
];

const COMMUNITY_CHEST_CARDS = [
    { id: 'cc-go', title: '前进到起点', text: '前进到起点并领取 M200', kind: 'advance', target: 0 },
    { id: 'cc-bank-error', title: '银行错误', text: '银行多付给你 M200', kind: 'money', amount: 200 },
    { id: 'cc-doctor', title: '医生费', text: '支付 M50', kind: 'money', amount: -50 },
    { id: 'cc-stock', title: '股票出售', text: '获得 M50', kind: 'money', amount: 50 },
    { id: 'cc-jail-card', title: '免费出狱卡', text: '保留此卡，可免费离开监狱', kind: 'get_out_of_jail' },
    { id: 'cc-holiday', title: '假日基金到期', text: '获得 M100', kind: 'money', amount: 100 },
    { id: 'cc-income-refund', title: '所得税退款', text: '获得 M20', kind: 'money', amount: 20 },
    { id: 'cc-birthday', title: '生日礼金', text: '每位玩家支付你 M10', kind: 'collect_from_players', amount: 10 },
    { id: 'cc-life-insurance', title: '人寿保险到期', text: '获得 M100', kind: 'money', amount: 100 },
    { id: 'cc-hospital', title: '住院费', text: '支付 M100', kind: 'money', amount: -100 },
    { id: 'cc-school', title: '学校费用', text: '支付 M50', kind: 'money', amount: -50 },
    { id: 'cc-consulting', title: '咨询费', text: '获得 M25', kind: 'money', amount: 25 },
    { id: 'cc-repairs', title: '街道维修', text: '每栋房屋支付 M40、每间酒店支付 M115', kind: 'repairs', house: 40, hotel: 115 },
    { id: 'cc-beauty', title: '选美比赛', text: '获得 M10', kind: 'money', amount: 10 },
    { id: 'cc-inheritance', title: '继承遗产', text: '获得 M100', kind: 'money', amount: 100 },
    { id: 'cc-go-to-jail', title: '前往监狱', text: '直接前往监狱，不经过起点，不领取 M200', kind: 'go_to_jail' },
];

const CHANCE_CARDS = [
    { id: 'ch-go', title: '前进到起点', text: '前进到起点并领取 M200', kind: 'advance', target: 0 },
    { id: 'ch-wan-chai', title: '前进到湾仔', text: '前进到湾仔；经过起点领取 M200', kind: 'advance', target: 11 },
    { id: 'ch-ocean-park', title: '前进到海洋公园', text: '前进到海洋公园；经过起点领取 M200', kind: 'advance', target: 24 },
    { id: 'ch-victoria-harbour', title: '前进到维多利亚港', text: '前进到维多利亚港；经过起点领取 M200', kind: 'advance', target: 39 },
    { id: 'ch-nearest-transit-1', title: '前进到最近交通设施', text: '前进到最近交通设施并支付双倍租金', kind: 'nearest_railroad' },
    { id: 'ch-nearest-transit-2', title: '前进到最近交通设施', text: '前进到最近交通设施并支付双倍租金', kind: 'nearest_railroad' },
    { id: 'ch-nearest-utility', title: '前进到最近公用事业', text: '前进到最近公用事业；重新掷骰并支付十倍骰点', kind: 'nearest_utility' },
    { id: 'ch-bank-dividend', title: '银行红利', text: '获得 M50', kind: 'money', amount: 50 },
    { id: 'ch-jail-card', title: '免费出狱卡', text: '保留此卡，可免费离开监狱', kind: 'get_out_of_jail' },
    { id: 'ch-back-three', title: '退后三格', text: '退后三格', kind: 'move_steps', steps: -3 },
    { id: 'ch-go-to-jail', title: '前往监狱', text: '直接前往监狱，不经过起点，不领取 M200', kind: 'go_to_jail' },
    { id: 'ch-repairs', title: '房屋维修', text: '每栋房屋支付 M25、每间酒店支付 M100', kind: 'repairs', house: 25, hotel: 100 },
    { id: 'ch-speeding', title: '超速罚款', text: '支付 M15', kind: 'money', amount: -15 },
    { id: 'ch-building-loan', title: '建筑贷款到期', text: '获得 M150', kind: 'money', amount: 150 },
    { id: 'ch-chairman', title: '董事会主席', text: '向每位玩家支付 M50', kind: 'pay_each_player', amount: 50 },
    { id: 'ch-railway', title: '前进到九广铁路', text: '前进到九广铁路；经过起点领取 M200', kind: 'advance', target: 5 },
];

function cloneCard(card) {
    return card && typeof card === 'object' ? { ...card } : card;
}

class MonopolyEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map((p, index) => ({
            id: p.id,
            name: p.name,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            tokenId: null,
            tokenStyle: '3d',
            cash: STARTING_CASH,
            position: 0,
            inJail: false,
            jailTurns: 0,
            consecutiveDoubles: 0,
            isBankrupt: false,
            isOnline: true,
            jailCards: [],
            jailCardCount: 0,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.board = this._createBoard();
        this.currentTurnIndex = 0;
        this.turnNumber = 1;
        this.status = 'waiting';
        this.phase = 'await_roll';
        this.dice = null;
        this.lastRollTotal = 7;
        this.rollSequence = 0;
        this.extraTurn = false;
        this.pendingPurchase = null;
        this.pendingDebt = null;
        this.paymentQueue = [];
        this.auction = null;
        this.bankAuctionQueue = [];
        this.bankruptcyAuctionPlayerId = null;
        this.tradeOffers = new Map();
        this.tradeSequence = 0;
        this.cardSequence = 0;
        this.lastEvent = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.openingRolls = [];
        this.chanceDeck = [];
        this.communityChestDeck = [];
        this.housesAvailable = 32;
        this.hotelsAvailable = 12;
    }

    _createBoard() {
        return BOARD_TEMPLATE.map(tile => ({
            ...tile,
            rents: tile.rents ? [...tile.rents] : undefined,
            ownerId: tile.type === 'property' || tile.type === 'utility' ? null : undefined,
            houses: tile.type === 'property' || tile.type === 'utility' ? 0 : undefined,
            mortgaged: tile.type === 'property' || tile.type === 'utility' ? false : undefined,
            type: tile.type === 'utility' ? 'property' : tile.type,
        }));
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < MIN_PLAYERS || this.players.length > MAX_PLAYERS) return { success: false, message: `环城大富翁需要 ${MIN_PLAYERS}–${MAX_PLAYERS} 名玩家` };
        this.chanceDeck = this._shuffle(CHANCE_CARDS);
        this.communityChestDeck = this._shuffle(COMMUNITY_CHEST_CARDS);
        this._assignRandomTokens();
        this.housesAvailable = 32;
        this.hotelsAvailable = 12;
        this.currentTurnIndex = this._selectOpeningPlayer();
        this.status = 'playing';
        this.phase = 'await_roll';
        const starter = this.getCurrentPlayer();
        const total = this.openingRolls.find(roll => roll.playerId === starter?.id)?.total;
        this.actionLog = [`游戏开始，${starter?.name || '首位玩家'} 以 ${total || 0} 点先手`];
        return this._success('游戏已开始');
    }

    _selectOpeningPlayer() {
        let candidates = this.players.map((_, index) => index);
        let latest = [];
        let rounds = 0;
        while (candidates.length > 1 && rounds < 100) {
            latest = candidates.map(index => {
                const dice = this._rollDice();
                return { playerId: this.players[index].id, playerName: this.players[index].name, dice, total: dice[0] + dice[1] };
            });
            const highest = Math.max(...latest.map(roll => roll.total));
            candidates = latest.filter(roll => roll.total === highest).map(roll => this.players.findIndex(player => player.id === roll.playerId));
            rounds += 1;
        }
        this.openingRolls = latest;
        return candidates[0] ?? 0;
    }

    _shuffle(cards) {
        const deck = cards.map(cloneCard);
        for (let index = deck.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(this.random() * (index + 1));
            [deck[index], deck[swap]] = [deck[swap], deck[index]];
        }
        return deck;
    }

    _assignRandomTokens() {
        const used = new Set();
        for (const player of this.players) {
            const tokenId = Number.isInteger(player.tokenId) ? player.tokenId : null;
            if (Number.isInteger(tokenId) && tokenId >= 0 && tokenId < TOKEN_COUNT && !used.has(tokenId)) used.add(tokenId);
            else player.tokenId = null;
            if (!TOKEN_STYLES.has(player.tokenStyle)) player.tokenStyle = '3d';
        }
        const available = this._shuffle(Array.from({ length: TOKEN_COUNT }, (_, index) => index).filter(index => !used.has(index)));
        for (const player of this.players) if (player.tokenId == null) player.tokenId = available.shift();
    }

    getCurrentPlayer() { return this.players[this.currentTurnIndex] || null; }
    getActivePlayers() { return this.players.filter(player => !player.isBankrupt && player.isOnline); }
    _isAssetAction(kind) { return ['buildHouse', 'sellBuilding', 'mortgageProperty', 'unmortgageProperty'].includes(kind); }
    _active(player) { return Boolean(player && !player.isBankrupt && player.isOnline); }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束' };
        const player = this.playerMap[playerId];
        if (!this._active(player)) return { success: false, message: '玩家不存在或已经破产' };
        if (action.kind === 'selectToken') return this._selectToken(player, action);
        if (['proposeTrade', 'acceptTrade', 'rejectTrade', 'cancelTrade'].includes(action.kind)) return this._handleTradeAction(player, action);
        if (this.phase === 'auction') return this._auctionAction(player, action);
        if (this.phase === 'debt_resolution') {
            if (action.kind === 'declareBankruptcy') return this._declareBankruptcy(player);
            if (action.kind === 'payDebt') return this._payPendingDebt(player);
            if (this._isAssetAction(action.kind)) {
                if (this.pendingDebt?.debtorId !== player.id) return { success: false, message: '只有欠款玩家可以筹措资金', state: this.getPlayerState(player.id) };
                return this._handleAssetAction(player, action);
            }
            return { success: false, message: '请先处理当前欠款', state: this.getPlayerState(player.id) };
        }
        if (this._isAssetAction(action.kind)) return this._handleAssetAction(player, action);
        if (this.getCurrentPlayer()?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        switch (action.kind) {
            case 'rollDice': return this._rollTurn(player);
            case 'buyProperty': return this._buyProperty(player);
            case 'passProperty': return this._passProperty(player);
            case 'endTurn': return this._endTurn(player);
            case 'payBail': return this._payBail(player);
            case 'rollForDoubles': return this._rollFromJail(player);
            case 'useJailCard': return this._useJailCard(player, action);
            default: return { success: false, message: '未知的大富翁动作', state: this.getPlayerState(player.id) };
        }
    }

    _handleAssetAction(player, action) {
        const tileIndex = Number(action.tileIndex);
        if (action.kind === 'buildHouse') return this._buildHouse(player, tileIndex);
        if (action.kind === 'sellBuilding') return this._sellBuilding(player, tileIndex);
        if (action.kind === 'mortgageProperty') return this._mortgageProperty(player, tileIndex);
        return this._unmortgageProperty(player, tileIndex);
    }

    _selectToken(player, action) {
        const tokenId = Number(action.tokenId);
        const tokenStyle = String(action.tokenStyle || player.tokenStyle || '3d');
        if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= TOKEN_COUNT) return { success: false, message: '请选择有效的棋子', state: this.getPlayerState(player.id) };
        if (!TOKEN_STYLES.has(tokenStyle)) return { success: false, message: '请选择有效的棋子样式', state: this.getPlayerState(player.id) };
        const owner = this.players.find(candidate => candidate.id !== player.id && this._active(candidate) && candidate.tokenId === tokenId);
        if (owner) return { success: false, message: `这枚棋子已被${owner.name}使用`, state: this.getPlayerState(player.id) };
        player.tokenId = tokenId;
        player.tokenStyle = tokenStyle;
        return this._record('selectToken', player, `${player.name} 选择了${TOKEN_NAMES[tokenId]}棋子`);
    }

    _rollTurn(player) {
        if (this.phase !== 'await_roll') return { success: false, message: '现在不能掷骰子', state: this.getPlayerState(player.id) };
        if (player.inJail) return { success: false, message: '请先处理监狱状态', state: this.getPlayerState(player.id) };
        return this._resolveRoll(player, this._rollDice());
    }

    _rollFromJail(player) {
        if (this.phase !== 'jail_decision') return { success: false, message: '现在不需要处理监狱状态', state: this.getPlayerState(player.id) };
        const dice = this._rollDice();
        this.dice = dice;
        if (dice[0] === dice[1]) {
            player.inJail = false;
            player.jailTurns = 0;
            player.consecutiveDoubles = 0;
            this.actionLog.push(`${player.name} 掷出对子，离开监狱；本回合结束`);
            return this._resolveRoll(player, dice, true);
        }
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
            player.inJail = false;
            player.jailTurns = 0;
            player.consecutiveDoubles = 0;
            if (player.cash >= BAIL_COST) {
                player.cash -= BAIL_COST;
                return this._resolveRoll(player, dice, true);
            }
            this._requestPayment(player, null, BAIL_COST, '第三次未掷出对子，支付监狱费用', { kind: 'jailThirdRoll', dice });
            return this._success('现金不足，请先筹措监狱费用');
        }
        this.extraTurn = false;
        this.phase = 'turn_complete';
        return this._record('rollForDoubles', player, `${player.name} 未掷出对子，继续留在监狱`, { dice, rollId: ++this.rollSequence });
    }

    _resolveRoll(player, dice, leavingJail = false) {
        const rollId = ++this.rollSequence;
        this.dice = dice;
        const total = dice[0] + dice[1];
        this.lastRollTotal = total;
        const doubles = dice[0] === dice[1];
        if (leavingJail) player.consecutiveDoubles = 0;
        else player.consecutiveDoubles = doubles ? player.consecutiveDoubles + 1 : 0;
        if (!leavingJail && player.consecutiveDoubles >= 3) {
            this._sendToJail(player);
            this.extraTurn = false;
            this.phase = 'turn_complete';
            return this._record('rollDice', player, `${player.name} 连续三次对子，进入监狱`, { dice, rollId });
        }
        const old = player.position;
        const next = (old + total) % this.board.length;
        if (old + total >= this.board.length) player.cash += PASS_START_REWARD;
        player.position = next;
        this.phase = 'turn_complete';
        this.pendingPurchase = null;
        this.lastEvent = null;
        const landing = this._resolveLanding(player);
        const suffix = landing ? `：${landing}` : '';
        this.lastAction = { kind: 'rollDice', rollId, playerId: player.id, playerName: player.name, message: `${player.name} 掷出 ${dice[0]} + ${dice[1]}，到达 ${this.board[next].name}`, dice, from: old, to: next, leavingJail };
        this.actionLog.push(this.lastAction.message + suffix);
        this.extraTurn = !leavingJail && doubles && this.status === 'playing' && !player.inJail && !player.isBankrupt;
        return this._success(this.lastAction.message);
    }

    _resolveLanding(player, depth = 0, rentMultiplier = 1, rentDiceTotal = this.lastRollTotal) {
        if (depth > 3 || player.isBankrupt) return '';
        const tile = this.board[player.position];
        if (tile.type === 'property') {
            if (!tile.ownerId) {
                this.pendingPurchase = { playerId: player.id, tileIndex: tile.index };
                this.phase = 'property_decision';
                return `${tile.name} 尚未出售，可用 ${CURRENCY}${tile.price} 购买`;
            }
            if (tile.ownerId === player.id) return '回到自己的地产';
            const owner = this.playerMap[tile.ownerId];
            const rent = this._calculateRent(tile, rentDiceTotal) * rentMultiplier;
            return this._transferMoney(player, owner, rent, `${tile.name} 租金`);
        }
        if (tile.type === 'chance' || tile.type === 'community_chest') return this._drawEvent(player, depth, tile.type);
        if (tile.type === 'tax') {
            this._payBank(player, tile.amount, tile.name);
            return `支付 ${CURRENCY}${tile.amount}`;
        }
        if (tile.type === 'go_to_jail') {
            this._sendToJail(player);
            this.extraTurn = false;
            return '前往监狱';
        }
        if (tile.type === 'parking') return '免费停车，不领取奖金';
        return '';
    }

    _drawEvent(player, depth, tileType) {
        const deckKey = tileType === 'community_chest' ? 'communityChestDeck' : 'chanceDeck';
        const source = tileType === 'community_chest' ? COMMUNITY_CHEST_CARDS : CHANCE_CARDS;
        if (!this[deckKey].length) this[deckKey] = this._shuffle(source);
        const card = this[deckKey].shift();
        this.lastEvent = cloneCard(card);
        if (card.kind !== 'get_out_of_jail') this[deckKey].push(cloneCard(card));
        if (card.kind === 'money') {
            if (card.amount >= 0) player.cash += card.amount;
            else this._payBank(player, -card.amount, card.title);
        }
        if (card.kind === 'collect_from_players') {
            this._queuePayments(this.getActivePlayers().filter(other => other.id !== player.id).map(other => ({ from: other, to: player, amount: card.amount, reason: card.title })));
        }
        if (card.kind === 'pay_each_player') {
            this._queuePayments(this.getActivePlayers().filter(other => other.id !== player.id).map(other => ({ from: player, to: other, amount: card.amount, reason: card.title })));
        }
        if (card.kind === 'get_out_of_jail') {
            const held = { id: `${tileType}-${card.id}-${++this.cardSequence}`, deck: tileType, card: cloneCard(card) };
            player.jailCards.push(held);
            player.jailCardCount = player.jailCards.length;
        }
        if (card.kind === 'advance') {
            const old = player.position;
            if (card.target === 0 || card.target < old) player.cash += PASS_START_REWARD;
            player.position = card.target;
            this._resolveLanding(player, depth + 1);
        }
        if (card.kind === 'move_steps') {
            player.position = (player.position + card.steps + this.board.length) % this.board.length;
            this._resolveLanding(player, depth + 1);
        }
        if (card.kind === 'nearest_railroad') {
            const targets = [5, 15, 25, 35];
            const target = targets.find(index => index > player.position) ?? targets[0];
            if (target <= player.position) player.cash += PASS_START_REWARD;
            player.position = target;
            this._resolveLanding(player, depth + 1, 2);
        }
        if (card.kind === 'nearest_utility') {
            const targets = [12, 28];
            const target = targets.find(index => index > player.position) ?? targets[0];
            if (target <= player.position) player.cash += PASS_START_REWARD;
            player.position = target;
            const utilityDice = this._rollDice();
            this.lastEvent = { ...cloneCard(card), utilityDice };
            this._resolveLanding(player, depth + 1, 1, utilityDice[0] + utilityDice[1]);
        }
        if (card.kind === 'repairs') {
            const amount = this.board.filter(tile => tile.ownerId === player.id).reduce((sum, tile) => sum + (tile.houses >= HOTEL_LEVEL ? card.hotel : (tile.houses || 0) * card.house), 0);
            if (amount) this._payBank(player, amount, card.title);
        }
        if (card.kind === 'go_to_jail') {
            this._sendToJail(player);
            this.extraTurn = false;
        }
        return `${card.title}：${card.text}`;
    }

    _buyProperty(player) {
        if (this.phase !== 'property_decision' || this.pendingPurchase?.playerId !== player.id) return { success: false, message: '当前没有可购买的地产', state: this.getPlayerState(player.id) };
        const tile = this.board[this.pendingPurchase.tileIndex];
        if (!tile || tile.ownerId || player.cash < tile.price) return { success: false, message: player.cash < (tile?.price || Infinity) ? '现金不足，请放弃购买并进入拍卖' : '当前地产已经有所有者', state: this.getPlayerState(player.id) };
        player.cash -= tile.price;
        tile.ownerId = player.id;
        this.pendingPurchase = null;
        this.phase = 'turn_complete';
        return this._record('buyProperty', player, `${player.name} 购买了 ${tile.name}`);
    }

    _passProperty(player) {
        if (this.phase !== 'property_decision' || this.pendingPurchase?.playerId !== player.id) return { success: false, message: '当前没有可跳过的地产', state: this.getPlayerState(player.id) };
        const tileIndex = this.pendingPurchase.tileIndex;
        this.pendingPurchase = null;
        this.auction = {
            type: 'property',
            tileIndex,
            currentBidderIndex: this.currentTurnIndex,
            highestBid: 0,
            highestBidder: null,
            passed: new Set(),
        };
        this.phase = 'auction';
        this.actionLog.push(`${player.name} 放弃购买${this.board[tileIndex].name}，进入公开拍卖`);
        return this._success('地产进入公开拍卖，起拍价为 M10');
    }

    _auctionAction(player, action) {
        if (this.phase !== 'auction' || !this.auction) return { success: false, message: '当前没有进行中的拍卖', state: this.getPlayerState(player.id) };
        const current = this.players[this.auction.currentBidderIndex];
        if (!current || current.id !== player.id) return { success: false, message: '等待其他玩家竞拍', state: this.getPlayerState(player.id) };
        const auction = this.auction;
        if (action.kind === 'bidProperty' || action.kind === 'bidBuilding') {
            const amount = Number(action.amount);
            const minimum = Math.max(AUCTION_START_BID, auction.highestBid + 1);
            if (!Number.isInteger(amount) || amount < minimum || amount > player.cash) return { success: false, message: `出价至少为 ${CURRENCY}${minimum}，且不能超过现金`, state: this.getPlayerState(player.id) };
            if (auction.type === 'building') {
                const targetIndex = Number(action.tileIndex ?? auction.tileIndex);
                if (!this._canBuildTile(player, targetIndex, { ignoreBank: true })) return { success: false, message: '只能竞拍自己当前可以建造的地产', state: this.getPlayerState(player.id) };
                auction.tileIndex = targetIndex;
            }
            auction.highestBid = amount;
            auction.highestBidder = player.id;
            auction.passed = new Set([player.id]);
        } else if (action.kind === 'passAuction') {
            auction.passed.add(player.id);
        } else {
            return { success: false, message: '请选择出价或暂不加价', state: this.getPlayerState(player.id) };
        }
        if (this._auctionShouldFinish()) return this._finishAuction();
        this._advanceAuctionTurn();
        return this._success(action.kind === 'passAuction' ? '已记录暂不加价' : '出价已记录');
    }

    _auctionShouldFinish() {
        if (!this.auction) return true;
        const active = this.getActivePlayers();
        if (!this.auction.highestBidder) return active.every(player => this.auction.passed.has(player.id));
        return active.filter(player => player.id !== this.auction.highestBidder).every(player => this.auction.passed.has(player.id));
    }

    _advanceAuctionTurn() {
        if (!this.auction) return;
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const index = (this.auction.currentBidderIndex + offset) % this.players.length;
            const candidate = this.players[index];
            if (this._active(candidate) && !this.auction.passed.has(candidate.id)) {
                this.auction.currentBidderIndex = index;
                return;
            }
        }
        this._finishAuction();
    }

    _finishAuction() {
        const auction = this.auction;
        if (!auction) return this._success('拍卖已结束');
        const tile = this.board[auction.tileIndex];
        const winner = auction.highestBidder ? this.playerMap[auction.highestBidder] : null;
        let message;
        if (winner && auction.highestBid > 0 && tile) {
            winner.cash -= auction.highestBid;
            if (auction.type === 'building') {
                this._placeBuilding(winner, tile, auction.buildingType || (tile.houses === MAX_HOUSES_PER_PROPERTY ? 'hotel' : 'house'));
                message = `${winner.name} 以 ${CURRENCY}${auction.highestBid} 竞得${tile.name}的建筑名额`;
            } else {
                tile.ownerId = winner.id;
                message = `${winner.name} 以 ${CURRENCY}${auction.highestBid} 拍下 ${tile.name}`;
            }
        } else {
            message = `${tile?.name || '建筑名额'} 无人竞拍`;
        }
        this.auction = null;
        const actor = winner || this.getCurrentPlayer();
        this.lastAction = { kind: 'auction', playerId: actor?.id || null, playerName: actor?.name || null, message };
        this.actionLog.push(message);
        if (this.bankAuctionQueue.length && this.status === 'playing') {
            this._startNextBankAuction();
        } else if (auction.bankruptcy && this.status === 'playing') {
            const bankruptId = this.bankruptcyAuctionPlayerId;
            this.bankruptcyAuctionPlayerId = null;
            this.phase = 'turn_complete';
            if (bankruptId && this.getCurrentPlayer()?.id === bankruptId) this._advanceTurn();
        } else {
            this.phase = 'turn_complete';
        }
        return this._success(message);
    }

    _startNextBankAuction() {
        while (this.bankAuctionQueue.length && this.status === 'playing') {
            const tileIndex = this.bankAuctionQueue.shift();
            const tile = this.board[tileIndex];
            if (!tile || tile.type !== 'property' || tile.ownerId) continue;
            const sourceIndex = this.players.findIndex(player => player.id === this.bankruptcyAuctionPlayerId);
            const currentBidderIndex = this._nextActiveIndex(sourceIndex >= 0 ? sourceIndex : this.currentTurnIndex);
            if (currentBidderIndex < 0) break;
            this.auction = {
                type: 'property',
                tileIndex,
                currentBidderIndex,
                highestBid: 0,
                highestBidder: null,
                passed: new Set(),
                bankruptcy: true,
            };
            this.phase = 'auction';
            this.actionLog.push(`${tile.name} 进入破产资产拍卖，起拍价为 M10`);
            return true;
        }
        this.auction = null;
        if (this.status === 'playing') {
            const bankruptId = this.bankruptcyAuctionPlayerId;
            this.bankruptcyAuctionPlayerId = null;
            this.phase = 'turn_complete';
            if (bankruptId && this.getCurrentPlayer()?.id === bankruptId) this._advanceTurn();
        }
        return false;
    }

    _endTurn(player) {
        if (this.phase !== 'turn_complete') return { success: false, message: '请先完成当前行动', state: this.getPlayerState(player.id) };
        if (this.extraTurn) {
            this.extraTurn = false;
            this.phase = 'await_roll';
            this.actionLog.push(`${player.name} 获得额外回合`);
            return this._success('掷出对子，再进行一回合');
        }
        this._advanceTurn();
        return this._success(this.status === 'ended' ? '本局结束' : `轮到${this.getCurrentPlayer()?.name || '下一位玩家'}`);
    }

    _advanceTurn() {
        const next = this._nextActiveIndex(this.currentTurnIndex);
        if (next === -1 || this.getActivePlayers().length <= 1) {
            this.status = 'ended';
            this.winner = this.getActivePlayers()[0] || null;
            this.phase = 'ended';
            return;
        }
        this.currentTurnIndex = next;
        this.turnNumber += 1;
        this.phase = this.getCurrentPlayer().inJail ? 'jail_decision' : 'await_roll';
        this.dice = null;
        this.pendingPurchase = null;
        this.extraTurn = false;
    }

    _payBail(player) {
        if (this.phase !== 'jail_decision' || !player.inJail) return { success: false, message: '当前不需要支付监狱费用', state: this.getPlayerState(player.id) };
        if (player.cash < BAIL_COST) return { success: false, message: '现金不足，请先筹措监狱费用', state: this.getPlayerState(player.id) };
        player.cash -= BAIL_COST;
        player.inJail = false;
        player.jailTurns = 0;
        this.phase = 'await_roll';
        return this._record('payBail', player, `${player.name} 支付 ${CURRENCY}${BAIL_COST} 离开监狱`);
    }

    _useJailCard(player, action = {}) {
        if (this.phase !== 'jail_decision' || !player.inJail || !player.jailCards.length) return { success: false, message: '没有可用的免费出狱卡', state: this.getPlayerState(player.id) };
        const requested = action.cardId ? player.jailCards.findIndex(card => card.id === action.cardId) : 0;
        const index = requested >= 0 ? requested : 0;
        const held = player.jailCards.splice(index, 1)[0];
        player.jailCardCount = player.jailCards.length;
        const deckKey = held.deck === 'community_chest' ? 'communityChestDeck' : 'chanceDeck';
        this[deckKey].push(cloneCard(held.card));
        player.inJail = false;
        player.jailTurns = 0;
        this.phase = 'await_roll';
        return this._record('useJailCard', player, `${player.name} 使用免费出狱卡并离开监狱`);
    }

    _canBuildTile(player, tileIndex, { ignoreBank = false } = {}) {
        const tile = this.board[tileIndex];
        if (!this._active(player) || !tile || tile.type !== 'property' || tile.group === 'transit' || tile.group === 'utility' || tile.ownerId !== player.id || tile.mortgaged || tile.buildCost <= 0 || tile.houses >= HOTEL_LEVEL) return false;
        const group = this._groupTiles(tile.group);
        if (!group.every(item => item.ownerId === player.id && !item.mortgaged)) return false;
        const isHotel = tile.houses === MAX_HOUSES_PER_PROPERTY;
        if (isHotel) {
            if (!group.every(item => item.houses >= MAX_HOUSES_PER_PROPERTY) || (!ignoreBank && this.hotelsAvailable < 1)) return false;
        } else {
            const lowest = Math.min(...group.map(item => item.houses || 0));
            if (tile.houses > lowest || (!ignoreBank && this.housesAvailable < 1)) return false;
        }
        return player.cash >= tile.buildCost;
    }

    _placeBuilding(player, tile, buildingType = tile.houses === MAX_HOUSES_PER_PROPERTY ? 'hotel' : 'house') {
        const isHotel = buildingType === 'hotel' || tile.houses === MAX_HOUSES_PER_PROPERTY;
        if (isHotel) {
            tile.houses = HOTEL_LEVEL;
            this.hotelsAvailable = Math.max(0, this.hotelsAvailable - 1);
            this.housesAvailable += MAX_HOUSES_PER_PROPERTY;
        } else {
            tile.houses += 1;
            this.housesAvailable = Math.max(0, this.housesAvailable - 1);
        }
        return isHotel;
    }

    _buildHouse(player, tileIndex) {
        if (this.pendingDebt) return { success: false, message: '请先偿还当前欠款', state: this.getPlayerState(player.id) };
        const tile = this.board[tileIndex];
        if (!this._canBuildTile(player, tileIndex, { ignoreBank: true })) return { success: false, message: '当前不能在这里建造', state: this.getPlayerState(player.id) };
        const isHotel = tile.houses === MAX_HOUSES_PER_PROPERTY;
        if ((isHotel && this.hotelsAvailable < 1) || (!isHotel && this.housesAvailable < 1)) return { success: false, message: `银行暂无可用${isHotel ? '酒店' : '房屋'}，等有建筑归还后再建造`, state: this.getPlayerState(player.id) };
        player.cash -= tile.buildCost;
        const placedHotel = this._placeBuilding(player, tile, isHotel ? 'hotel' : 'house');
        return this._record('buildHouse', player, `${player.name} 在${tile.name}建造了${placedHotel ? '酒店' : '房屋'}`);
    }

    _canSellBuilding(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!this._active(player) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || !tile.houses) return false;
        const group = this._groupTiles(tile.group);
        const levels = group.map(item => item.houses || 0);
        const lowest = Math.min(...levels);
        const allEqual = levels.every(level => level === tile.houses);
        return allEqual || tile.houses > lowest;
    }

    _sellBuilding(player, tileIndex) {
        if (!this._canSellBuilding(player, tileIndex)) return { success: false, message: '建筑必须从当前最高层级均匀出售', state: this.getPlayerState(player.id) };
        const tile = this.board[tileIndex];
        const soldHotel = tile.houses === HOTEL_LEVEL;
        if (soldHotel) {
            if (this.housesAvailable < MAX_HOUSES_PER_PROPERTY) return { success: false, message: '银行没有足够房屋接替酒店', state: this.getPlayerState(player.id) };
            tile.houses = MAX_HOUSES_PER_PROPERTY;
            this.hotelsAvailable += 1;
            this.housesAvailable -= MAX_HOUSES_PER_PROPERTY;
            player.cash += Math.floor(tile.buildCost / 2);
        } else {
            tile.houses -= 1;
            this.housesAvailable += 1;
            player.cash += Math.floor(tile.buildCost / 2);
        }
        const result = this._record('sellBuilding', player, `${player.name} 出售${tile.name}的${soldHotel ? '酒店' : '一栋房屋'}`);
        if (this.pendingDebt?.debtorId === player.id) {
            this._trySettlePendingDebt(player);
            return this._success(result.message);
        }
        return result;
    }

    _mortgageProperty(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!this._active(player) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || tile.mortgaged || tile.houses) return { success: false, message: '当前不能抵押这块地产', state: this.getPlayerState(player.id) };
        const group = this._groupTiles(tile.group);
        if (group.some(item => item.houses)) return { success: false, message: '同色地产组必须先卖掉全部建筑', state: this.getPlayerState(player.id) };
        tile.mortgaged = true;
        player.cash += this._mortgageValue(tile);
        const result = this._record('mortgageProperty', player, `${player.name} 抵押了${tile.name}`);
        if (this.pendingDebt?.debtorId === player.id) {
            this._trySettlePendingDebt(player);
            return this._success(result.message);
        }
        return result;
    }

    _unmortgageProperty(player, tileIndex) {
        const tile = this.board[tileIndex];
        const cost = tile ? this._unmortgageCost(tile) : Infinity;
        if (!this._active(player) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || !tile.mortgaged) return { success: false, message: '当前不能赎回这块地产', state: this.getPlayerState(player.id) };
        if (player.cash < cost) return { success: false, message: '现金不足以支付抵押利息', state: this.getPlayerState(player.id) };
        player.cash -= cost;
        tile.mortgaged = false;
        return this._record('unmortgageProperty', player, `${player.name} 赎回了${tile.name}`);
    }

    _groupTiles(group) { return this.board.filter(tile => tile.type === 'property' && tile.group === group); }
    _mortgageValue(tile) { return Math.floor(tile.price / 2); }
    _unmortgageCost(tile) { return Math.ceil(this._mortgageValue(tile) * 1.1); }

    _sendToJail(player) {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        player.consecutiveDoubles = 0;
    }

    _payBank(player, amount, reason) {
        const result = this._requestPayment(player, null, amount, reason);
        return result.status === 'paid';
    }

    _transferMoney(from, to, amount, reason) {
        const result = this._requestPayment(from, to, amount, reason);
        if (result.status === 'pending') return `${from.name} 支付能力不足，请先筹措 ${CURRENCY}${result.remaining}`;
        if (result.status === 'skipped') return `${from.name} 无需支付`;
        return `${from.name} 支付 ${CURRENCY}${amount}（${reason}）`;
    }

    _requestPayment(from, to, amount, reason, continuation = null) {
        const value = Math.max(0, Math.floor(Number(amount) || 0));
        if (!from || from.isBankrupt || value <= 0) return { status: 'skipped', amountPaid: 0 };
        if (this.pendingDebt) {
            this.paymentQueue.push({ from, to, amount: value, reason, continuation });
            return { status: 'queued', amountPaid: 0 };
        }
        const returnPhase = this.phase === 'debt_resolution' ? 'turn_complete' : this.phase;
        const paid = Math.min(from.cash, value);
        from.cash -= paid;
        if (to && !to.isBankrupt) to.cash += paid;
        if (paid >= value) return { status: 'paid', amountPaid: paid, remaining: 0 };
        this.pendingDebt = {
            debtorId: from.id,
            creditorId: to?.id || null,
            amountOriginal: value,
            amountPaid: paid,
            amountRemaining: value - paid,
            reason,
            returnPhase,
            continuation,
        };
        this.phase = 'debt_resolution';
        this.lastAction = { kind: 'debt', playerId: from.id, playerName: from.name, message: `${from.name} 尚欠 ${CURRENCY}${value - paid}（${reason}）` };
        this.actionLog.push(this.lastAction.message);
        return { status: 'pending', amountPaid: paid, remaining: value - paid };
    }

    _queuePayments(payments) {
        this.paymentQueue.push(...payments.filter(payment => payment?.from && payment.amount > 0));
        this._processPaymentQueue();
    }

    _processPaymentQueue() {
        if (this.pendingDebt) return;
        while (this.paymentQueue.length) {
            const payment = this.paymentQueue.shift();
            if (!payment?.from || payment.from.isBankrupt) continue;
            const result = this._requestPayment(payment.from, payment.to, payment.amount, payment.reason, payment.continuation);
            if (result.status === 'pending') return;
        }
    }

    _payPendingDebt(player) {
        if (!this.pendingDebt || this.pendingDebt.debtorId !== player.id) return { success: false, message: '当前没有你的待偿债务', state: this.getPlayerState(player.id) };
        if (player.cash < this.pendingDebt.amountRemaining) return { success: false, message: `还需要 ${CURRENCY}${this.pendingDebt.amountRemaining - player.cash}`, state: this.getPlayerState(player.id) };
        this._settlePendingDebt();
        return this._success(`${player.name} 偿还了当前欠款`);
    }

    _settlePendingDebt() {
        const pending = this.pendingDebt;
        if (!pending) return false;
        const debtor = this.playerMap[pending.debtorId];
        if (!debtor || debtor.cash < pending.amountRemaining) return false;
        debtor.cash -= pending.amountRemaining;
        const creditor = pending.creditorId ? this.playerMap[pending.creditorId] : null;
        if (creditor && !creditor.isBankrupt) creditor.cash += pending.amountRemaining;
        this.pendingDebt = null;
        this.phase = pending.returnPhase || 'turn_complete';
        this._processPaymentQueue();
        if (!this.pendingDebt) this._resumeAfterDebt(pending.continuation, pending.returnPhase);
        return true;
    }

    _trySettlePendingDebt(player) {
        if (this.pendingDebt?.debtorId === player.id) this._settlePendingDebt();
    }

    _resumeAfterDebt(continuation, returnPhase) {
        if (this.pendingDebt || this.status !== 'playing') return;
        if (continuation?.kind === 'jailThirdRoll') {
            const player = this.playerMap[continuation.playerId] || this.getCurrentPlayer();
            if (player && !player.isBankrupt) this._resolveRoll(player, continuation.dice, true);
            return;
        }
        this.phase = returnPhase || 'turn_complete';
    }

    _declareBankruptcy(player) {
        const pending = this.pendingDebt;
        if (!pending || pending.debtorId !== player.id) return { success: false, message: '当前没有可以确认的债务', state: this.getPlayerState(player.id) };
        if (player.cash >= pending.amountRemaining) return { success: false, message: `现金足够，请先偿还 ${CURRENCY}${pending.amountRemaining}`, state: this.getPlayerState(player.id) };
        this.pendingDebt = null;
        this.phase = pending.returnPhase || 'turn_complete';
        const creditor = pending.creditorId ? this.playerMap[pending.creditorId] : null;
        this._bankrupt(player, creditor, pending.reason);
        this._processPaymentQueue();
        if (this.status === 'playing' && this.bankAuctionQueue.length) {
            this.bankruptcyAuctionPlayerId = player.id;
            this._startNextBankAuction();
        } else if (this.status === 'playing' && this.getCurrentPlayer()?.id === player.id) this._advanceTurn();
        return this._success(`${player.name} 无法偿还债务，已破产`);
    }

    _bankrupt(player, creditor, reason) {
        if (!player || player.isBankrupt) return;
        const cash = Math.max(0, player.cash);
        if (creditor && !creditor.isBankrupt) creditor.cash += cash;
        player.cash = 0;
        const bankAuctionTiles = [];
        this.board.forEach(tile => {
            if (tile.ownerId !== player.id) return;
            const buildingValue = tile.houses ? Math.floor(tile.buildCost / 2) : 0;
            if (tile.houses >= HOTEL_LEVEL) {
                this.hotelsAvailable += 1;
                this.housesAvailable += MAX_HOUSES_PER_PROPERTY;
            } else {
                this.housesAvailable += tile.houses || 0;
            }
            tile.houses = 0;
            if (creditor && !creditor.isBankrupt) {
                creditor.cash += buildingValue;
                tile.ownerId = creditor.id;
                if (tile.mortgaged) creditor.cash = Math.max(0, creditor.cash - Math.ceil(this._mortgageValue(tile) * 0.1));
            } else {
                tile.ownerId = null;
                tile.mortgaged = false;
                bankAuctionTiles.push(tile.index);
            }
        });
        if (creditor && !creditor.isBankrupt) {
            creditor.jailCards.push(...player.jailCards);
            creditor.jailCardCount = creditor.jailCards.length;
        } else {
            for (const held of player.jailCards) {
                const deckKey = held.deck === 'community_chest' ? 'communityChestDeck' : 'chanceDeck';
                this[deckKey].push(cloneCard(held.card));
            }
        }
        player.jailCards = [];
        player.jailCardCount = 0;
        player.isBankrupt = true;
        player.inJail = false;
        for (const [id, offer] of this.tradeOffers.entries()) if (offer.fromId === player.id || offer.toId === player.id) this.tradeOffers.delete(id);
        this.actionLog.push(`${player.name} 因${reason}破产`);
        if (this.getActivePlayers().length <= 1) {
            this.status = 'ended';
            this.winner = this.getActivePlayers()[0] || null;
            this.phase = 'ended';
        } else if (!creditor && bankAuctionTiles.length) {
            this.bankAuctionQueue.push(...bankAuctionTiles);
            if (!this.bankruptcyAuctionPlayerId) this.bankruptcyAuctionPlayerId = player.id;
        }
    }

    _handleTradeAction(player, action) {
        if (action.kind === 'proposeTrade') return this._proposeTrade(player, action);
        const offer = this.tradeOffers.get(String(action.tradeId));
        if (!offer) return { success: false, message: '交易不存在或已失效', state: this.getPlayerState(player.id) };
        if (action.kind === 'cancelTrade') {
            if (offer.fromId !== player.id && offer.toId !== player.id) return { success: false, message: '你不能取消这笔交易', state: this.getPlayerState(player.id) };
            this.tradeOffers.delete(offer.id);
            return this._record('cancelTrade', player, `${player.name} 取消了一笔交易`);
        }
        if (action.kind === 'rejectTrade') {
            if (offer.toId !== player.id) return { success: false, message: '只有交易对象可以拒绝', state: this.getPlayerState(player.id) };
            this.tradeOffers.delete(offer.id);
            return this._record('rejectTrade', player, `${player.name} 拒绝了一笔交易`);
        }
        if (offer.toId !== player.id) return { success: false, message: '只有交易对象可以接受', state: this.getPlayerState(player.id) };
        return this._acceptTrade(player, offer);
    }

    _proposeTrade(player, action) {
        const target = this.playerMap[action.targetPlayerId];
        if (!this._active(target) || target.id === player.id) return { success: false, message: '请选择一名仍在游戏中的其他玩家', state: this.getPlayerState(player.id) };
        const cashOffer = this._integerAmount(action.cashOffer);
        const cashRequest = this._integerAmount(action.cashRequest);
        if (cashOffer < 0 || cashRequest < 0) return { success: false, message: '交易金额必须是非负整数', state: this.getPlayerState(player.id) };
        const propertyOffer = this._integerArray(action.propertyOffer);
        const propertyRequest = this._integerArray(action.propertyRequest);
        const jailCardOffer = this._stringArray(action.jailCardOffer);
        const jailCardRequest = this._stringArray(action.jailCardRequest);
        if (cashOffer > player.cash || cashRequest > target.cash) return { success: false, message: '交易金额不能超过当前现金', state: this.getPlayerState(player.id) };
        if (!this._validTradeProperties(player, propertyOffer) || !this._validTradeProperties(target, propertyRequest)) return { success: false, message: '只能交易无建筑且属于自己的地产', state: this.getPlayerState(player.id) };
        if (!this._validTradeCards(player, jailCardOffer) || !this._validTradeCards(target, jailCardRequest)) return { success: false, message: '请选择自己持有的免费出狱卡', state: this.getPlayerState(player.id) };
        if (!cashOffer && !cashRequest && !propertyOffer.length && !propertyRequest.length && !jailCardOffer.length && !jailCardRequest.length) return { success: false, message: '交易至少需要包含一项现金、地产或免费出狱卡', state: this.getPlayerState(player.id) };
        const offer = { id: `trade-${++this.tradeSequence}`, fromId: player.id, toId: target.id, cashOffer, cashRequest, propertyOffer, propertyRequest, jailCardOffer, jailCardRequest, createdAt: Date.now() };
        this.tradeOffers.set(offer.id, offer);
        return this._record('proposeTrade', player, `${player.name} 向${target.name} 发起交易`);
    }

    _acceptTrade(player, offer) {
        const from = this.playerMap[offer.fromId];
        const to = this.playerMap[offer.toId];
        if (!this._active(from) || !this._active(to) || from.cash < offer.cashOffer || to.cash < offer.cashRequest || !this._validTradeProperties(from, offer.propertyOffer) || !this._validTradeProperties(to, offer.propertyRequest) || !this._validTradeCards(from, offer.jailCardOffer) || !this._validTradeCards(to, offer.jailCardRequest)) {
            this.tradeOffers.delete(offer.id);
            return { success: false, message: '交易内容已经变化，请重新发起', state: this.getPlayerState(player.id) };
        }
        const incomingTo = offer.propertyOffer.map(index => this.board[index]).filter(tile => tile.mortgaged);
        const incomingFrom = offer.propertyRequest.map(index => this.board[index]).filter(tile => tile.mortgaged);
        const toFee = incomingTo.reduce((sum, tile) => sum + Math.ceil(this._mortgageValue(tile) * 0.1), 0);
        const fromFee = incomingFrom.reduce((sum, tile) => sum + Math.ceil(this._mortgageValue(tile) * 0.1), 0);
        if (to.cash - offer.cashRequest + offer.cashOffer < toFee || from.cash - offer.cashOffer + offer.cashRequest < fromFee) return { success: false, message: `交易后无法支付抵押地产的 ${CURRENCY}10% 费用`, state: this.getPlayerState(player.id) };
        from.cash = from.cash - offer.cashOffer + offer.cashRequest;
        to.cash = to.cash - offer.cashRequest + offer.cashOffer;
        offer.propertyOffer.forEach(index => { this.board[index].ownerId = to.id; });
        offer.propertyRequest.forEach(index => { this.board[index].ownerId = from.id; });
        this._moveJailCards(from, to, offer.jailCardOffer);
        this._moveJailCards(to, from, offer.jailCardRequest);
        to.cash -= toFee;
        from.cash -= fromFee;
        this.tradeOffers.delete(offer.id);
        this._trySettlePendingDebt(from);
        this._trySettlePendingDebt(to);
        return this._record('acceptTrade', player, `${to.name} 接受了与${from.name}的交易`);
    }

    _validTradeProperties(player, indexes) {
        return indexes.every(index => {
            const tile = this.board[index];
            return tile && tile.type === 'property' && tile.ownerId === player.id && !tile.houses;
        });
    }

    _validTradeCards(player, ids) { return ids.every(id => player.jailCards.some(card => card.id === id)); }
    _integerAmount(value) { const amount = Number(value || 0); return Number.isInteger(amount) && amount >= 0 ? amount : -1; }
    _integerArray(value) { return Array.isArray(value) ? [...new Set(value.map(Number).filter(Number.isInteger))] : []; }
    _stringArray(value) { return Array.isArray(value) ? [...new Set(value.map(String))] : []; }

    _moveJailCards(from, to, ids) {
        for (const id of ids) {
            const index = from.jailCards.findIndex(card => card.id === id);
            if (index < 0) continue;
            to.jailCards.push(from.jailCards.splice(index, 1)[0]);
        }
        from.jailCardCount = from.jailCards.length;
        to.jailCardCount = to.jailCards.length;
    }

    _nextActiveIndex(from) {
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const index = (from + offset) % this.players.length;
            if (this._active(this.players[index])) return index;
        }
        return -1;
    }

    _calculateRent(tile, diceTotal = this.lastRollTotal || 7) {
        if (!tile || tile.mortgaged || !tile.ownerId) return 0;
        if (tile.group === 'utility') {
            const count = this.board.filter(item => item.type === 'property' && item.group === 'utility' && item.ownerId === tile.ownerId).length;
            return diceTotal * (count >= 2 ? 10 : 4);
        }
        if (tile.group === 'transit') {
            const count = this.board.filter(item => item.type === 'property' && item.group === 'transit' && item.ownerId === tile.ownerId).length;
            return tile.rents[Math.max(0, Math.min(count - 1, tile.rents.length - 1))];
        }
        if (tile.houses > 0) return tile.rents[Math.min(tile.houses, tile.rents.length - 1)];
        const group = this._groupTiles(tile.group);
        return tile.rents[0] * (group.every(item => item.ownerId === tile.ownerId) ? 2 : 1);
    }

    _rollDice() { return [Math.floor(this.random() * 6) + 1, Math.floor(this.random() * 6) + 1]; }
    _record(kind, player, message, extra = {}) {
        this.lastAction = { kind, playerId: player?.id || null, playerName: player?.name || null, message, ...extra };
        this.actionLog.push(message);
        return this._success(message);
    }

    _emptyActions() {
        return { canRoll: false, canBuy: false, canPass: false, canEndTurn: false, canPayBail: false, canRollForDoubles: false, canUseJailCard: false, canAuctionBid: false, canAuctionPass: false, auctionMinBid: 0, canProposeTrade: false, canDeclareBankruptcy: false, canPayDebt: false, buildableTiles: [], sellableTiles: [], mortgageableTiles: [], unmortgageableTiles: [] };
    }

    _getAvailableActions(player) {
        const empty = this._emptyActions();
        if (!this._active(player) || this.status !== 'playing') return empty;
        const actions = { ...empty, canProposeTrade: true };
        if (this.phase === 'auction') {
            const current = this.players[this.auction?.currentBidderIndex];
            actions.canAuctionBid = current?.id === player.id;
            actions.canAuctionPass = current?.id === player.id;
            actions.auctionMinBid = Math.max(AUCTION_START_BID, (this.auction?.highestBid || 0) + 1);
            return actions;
        }
        if (this.phase === 'debt_resolution') {
            if (this.pendingDebt?.debtorId === player.id) {
                actions.canDeclareBankruptcy = true;
                actions.canPayDebt = player.cash >= this.pendingDebt.amountRemaining;
                actions.sellableTiles = this.board.filter(tile => this._canSellBuilding(player, tile.index)).map(tile => tile.index);
                actions.mortgageableTiles = this.board.filter(tile => this._canMortgageForPlayer(player, tile.index)).map(tile => tile.index);
            }
            return actions;
        }
        if (!this.pendingDebt) {
            actions.buildableTiles = this.board.filter(tile => this._canBuildTile(player, tile.index)).map(tile => tile.index);
            actions.sellableTiles = this.board.filter(tile => this._canSellBuilding(player, tile.index)).map(tile => tile.index);
            actions.mortgageableTiles = this.board.filter(tile => this._canMortgageForPlayer(player, tile.index)).map(tile => tile.index);
            actions.unmortgageableTiles = this.board.filter(tile => tile.type === 'property' && tile.ownerId === player.id && tile.mortgaged && player.cash >= this._unmortgageCost(tile)).map(tile => tile.index);
        }
        const isCurrent = this.getCurrentPlayer()?.id === player.id;
        actions.canRoll = isCurrent && this.phase === 'await_roll';
        actions.canBuy = isCurrent && this.phase === 'property_decision' && this.pendingPurchase?.playerId === player.id && player.cash >= (this.board[this.pendingPurchase.tileIndex]?.price || Infinity);
        actions.canPass = isCurrent && this.phase === 'property_decision' && this.pendingPurchase?.playerId === player.id;
        actions.canEndTurn = isCurrent && this.phase === 'turn_complete';
        actions.canPayBail = isCurrent && this.phase === 'jail_decision' && player.cash >= BAIL_COST;
        actions.canRollForDoubles = isCurrent && this.phase === 'jail_decision';
        actions.canUseJailCard = isCurrent && this.phase === 'jail_decision' && player.jailCardCount > 0;
        return actions;
    }

    _canMortgageForPlayer(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!this._active(player) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || tile.mortgaged || tile.houses) return false;
        return !this._groupTiles(tile.group).some(item => item.houses);
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myTurn = state.currentTurn === playerId;
        state.availableActions = this._getAvailableActions(player);
        state.myJailCards = player?.jailCards.map(held => ({ id: held.id, deck: held.deck, card: cloneCard(held.card) })) || [];
        state.myTradeOffers = [...this.tradeOffers.values()].filter(offer => offer.fromId === playerId || offer.toId === playerId).map(offer => ({ ...offer }));
        return state;
    }

    _serializeAuction() {
        if (!this.auction) return null;
        return {
            type: this.auction.type,
            tileIndex: this.auction.tileIndex,
            tileName: this.board[this.auction.tileIndex]?.name,
            buildingType: this.auction.buildingType || null,
            currentBidder: this.players[this.auction.currentBidderIndex]?.id || null,
            currentBidderName: this.players[this.auction.currentBidderIndex]?.name || null,
            highestBid: this.auction.highestBid,
            highestBidder: this.auction.highestBidder,
            highestBidderName: this.playerMap[this.auction.highestBidder]?.name || null,
            passed: [...this.auction.passed],
            minimumBid: Math.max(AUCTION_START_BID, this.auction.highestBid + 1),
            bankruptcy: Boolean(this.auction.bankruptcy),
        };
    }

    _serializeDebt() {
        if (!this.pendingDebt) return null;
        const debtor = this.playerMap[this.pendingDebt.debtorId];
        const creditor = this.pendingDebt.creditorId ? this.playerMap[this.pendingDebt.creditorId] : null;
        return { debtorId: debtor?.id || null, debtorName: debtor?.name || null, creditorId: creditor?.id || null, creditorName: creditor?.name || '银行', amountOriginal: this.pendingDebt.amountOriginal, amountPaid: this.pendingDebt.amountPaid, amountRemaining: this.pendingDebt.amountRemaining, reason: this.pendingDebt.reason };
    }

    _serializeTrades() {
        return [...this.tradeOffers.values()].map(offer => ({
            ...offer,
            fromName: this.playerMap[offer.fromId]?.name || '玩家',
            toName: this.playerMap[offer.toId]?.name || '玩家',
            propertyOfferNames: offer.propertyOffer.map(index => this.board[index]?.name).filter(Boolean),
            propertyRequestNames: offer.propertyRequest.map(index => this.board[index]?.name).filter(Boolean),
            jailCardOfferCount: offer.jailCardOffer.length,
            jailCardRequestCount: offer.jailCardRequest.length,
        }));
    }

    getPublicState() {
        const effectiveTurnId = this.phase === 'auction' ? this.players[this.auction?.currentBidderIndex]?.id || null : this.getCurrentPlayer()?.id || null;
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            turnNumber: this.turnNumber,
            currentTurn: effectiveTurnId,
            currentTurnName: this.playerMap[effectiveTurnId]?.name || null,
            dice: this.dice,
            extraTurn: this.extraTurn,
            pendingPurchase: this.pendingPurchase,
            pendingDebt: this._serializeDebt(),
            auction: this._serializeAuction(),
            tradeOffers: this._serializeTrades(),
            openingRolls: this.openingRolls,
            lastEvent: this.lastEvent ? cloneCard(this.lastEvent) : null,
            lastAction: this.lastAction,
            actionLog: this.actionLog.slice(-14),
            rules: { version: 'C1009', currency: CURRENCY, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, startingCash: STARTING_CASH, passStartReward: PASS_START_REWARD, bailCost: BAIL_COST, auctionStartBid: AUCTION_START_BID, maxBuildings: HOTEL_LEVEL, housesPerProperty: MAX_HOUSES_PER_PROPERTY, hotelPerProperty: 1, housesAvailable: this.housesAvailable, hotelsAvailable: this.hotelsAvailable },
            board: this.board.map(tile => ({ ...tile, rents: tile.rents ? [...tile.rents] : undefined, mortgageValue: tile.type === 'property' ? this._mortgageValue(tile) : 0, unmortgageCost: tile.type === 'property' ? this._unmortgageCost(tile) : 0, ownerName: tile.ownerId ? this.playerMap[tile.ownerId]?.name || null : null, currentRent: tile.type === 'property' && tile.ownerId ? this._calculateRent(tile) : 0, groupComplete: tile.type === 'property' && tile.ownerId ? this._groupTiles(tile.group).every(item => item.ownerId === tile.ownerId) : false })),
            players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, tokenId: player.tokenId, tokenStyle: player.tokenStyle, cash: player.cash, position: player.position, inJail: player.inJail, jailTurns: player.jailTurns, jailCardCount: player.jailCardCount, isBankrupt: player.isBankrupt, isOnline: player.isOnline, isCurrentTurn: player.id === effectiveTurnId, propertyCount: this.board.filter(tile => tile.ownerId === player.id).length })),
            winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
        };
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player) return { success: false, message: '玩家不存在' };
        const wasCurrent = this.getCurrentPlayer()?.id === playerId;
        player.isOnline = false;
        if (this.pendingDebt?.debtorId === player.id) {
            const pending = this.pendingDebt;
            this.pendingDebt = null;
            const creditor = pending.creditorId ? this.playerMap[pending.creditorId] : null;
            this._bankrupt(player, creditor, '主动离开游戏');
        } else this._bankrupt(player, null, '主动离开游戏');
        if (this.status === 'playing' && this.bankAuctionQueue.length && !this.auction) {
            this.bankruptcyAuctionPlayerId = this.bankruptcyAuctionPlayerId || player.id;
            this._startNextBankAuction();
        }
        if (this.auction?.currentBidderIndex != null && this.players[this.auction.currentBidderIndex]?.id === player.id) {
            this.auction.passed.add(player.id);
            if (this._auctionShouldFinish()) this._finishAuction();
            else this._advanceAuctionTurn();
        }
        if (wasCurrent && this.getCurrentPlayer()?.id === playerId && this.status === 'playing' && !this.auction && !this.bankruptcyAuctionPlayerId) this._advanceTurn();
        return this._success(`${player.name} 已离开游戏`);
    }

    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = MonopolyEngine;
module.exports.BOARD_TEMPLATE = BOARD_TEMPLATE;
module.exports.CHANCE_CARDS = CHANCE_CARDS;
module.exports.COMMUNITY_CHEST_CARDS = COMMUNITY_CHEST_CARDS;
module.exports.RULES = Object.freeze({ version: 'C1009', minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, currency: CURRENCY, startingCash: STARTING_CASH, passStartReward: PASS_START_REWARD, bailCost: BAIL_COST, auctionStartBid: AUCTION_START_BID });
