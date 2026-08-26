const STARTING_CASH = 1500;
const PASS_START_REWARD = 200;
const BAIL_COST = 50;
const MAX_BUILDINGS = 5; // four houses, then one hotel
const PLAYER_COLORS = ['#d85b62', '#4e8fc4', '#c59a45', '#62a778', '#9872b4', '#d78350', '#bb6d9b', '#4c9d9d'];
const TOKEN_COUNT = 8;
const TOKEN_STYLES = new Set(['2d', '3d']);
const TOKEN_NAMES = ['电车', '渡轮', '帆船', '出租车', '灯笼', '紫荆花', '缆车', '点心'];

function property(index, name, group, color, price, buildCost, rents) { return { index, type: 'property', name, group, color, price, buildCost, rents }; }

const BOARD_TEMPLATE = [
    { index: 0, type: 'start', name: '维港起点' }, property(1, '深水埗', 'brown', '#9b7356', 60, 50, [8, 30, 90, 220, 400]), { index: 2, type: 'community_chest', name: '命运' }, property(3, '旺角', 'brown', '#9b7356', 60, 50, [8, 30, 90, 220, 400]), { index: 4, type: 'tax', name: '印花税', amount: 200 }, property(5, '九广铁路', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]), property(6, '油麻地', 'lightblue', '#75b7d2', 100, 50, [12, 60, 180, 500, 700]), { index: 7, type: 'chance', name: '机会' }, property(8, '尖沙咀', 'lightblue', '#75b7d2', 100, 50, [12, 60, 180, 500, 700]), property(9, '佐敦', 'lightblue', '#75b7d2', 120, 50, [14, 70, 200, 550, 750]), { index: 10, type: 'jail', name: '拘留所 / 只是探访' }, property(11, '湾仔', 'pink', '#d47e9f', 140, 100, [16, 80, 220, 600, 900]), { index: 12, type: 'utility', name: '中华电力', group: 'utility', color: '#8e85bc', price: 150, buildCost: 0, rents: [4, 10] }, property(13, '铜锣湾', 'pink', '#d47e9f', 140, 100, [16, 80, 220, 600, 900]), property(14, '跑马地', 'pink', '#d47e9f', 160, 100, [18, 90, 250, 700, 1000]), property(15, '山顶缆车', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]), property(16, '北角', 'orange', '#d58f45', 180, 100, [22, 100, 300, 750, 1050]), { index: 17, type: 'community_chest', name: '命运' }, property(18, '太古城', 'orange', '#d58f45', 180, 100, [22, 100, 300, 750, 1050]), property(19, '筲箕湾', 'orange', '#d58f45', 200, 100, [24, 110, 330, 800, 1150]), { index: 20, type: 'parking', name: '免费泊车' }, property(21, '赤柱', 'red', '#c85e56', 220, 150, [26, 120, 360, 850, 1250]), { index: 22, type: 'chance', name: '机会' }, property(23, '浅水湾', 'red', '#c85e56', 220, 150, [26, 120, 360, 850, 1250]), property(24, '海洋公园', 'red', '#c85e56', 240, 150, [28, 140, 400, 900, 1300]), property(25, '天星码头', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]), property(26, '中环', 'yellow', '#e6bb4f', 260, 150, [30, 150, 450, 1000, 1400]), property(27, '金钟', 'yellow', '#e6bb4f', 260, 150, [30, 150, 450, 1000, 1400]), { index: 28, type: 'utility', name: '水务署', group: 'utility', color: '#8e85bc', price: 150, buildCost: 0, rents: [4, 10] }, property(29, '兰桂坊', 'yellow', '#e6bb4f', 280, 150, [32, 160, 500, 1100, 1500]), { index: 30, type: 'go_to_jail', name: '前往拘留所' }, property(31, '西环', 'green', '#6eae73', 300, 200, [34, 170, 520, 1150, 1600]), property(32, '上环', 'green', '#6eae73', 300, 200, [34, 170, 520, 1150, 1600]), { index: 33, type: 'community_chest', name: '命运' }, property(34, '苏豪区', 'green', '#6eae73', 320, 200, [36, 180, 550, 1200, 1700]), property(35, '香港电车', 'transit', '#8292a8', 200, 0, [25, 50, 100, 200]), { index: 36, type: 'chance', name: '机会' }, property(37, '太平山', 'blue', '#5f83ba', 350, 200, [40, 200, 600, 1400, 1750]), { index: 38, type: 'tax', name: '港湾税', amount: 100 }, property(39, '维多利亚港', 'blue', '#5f83ba', 400, 200, [50, 250, 700, 1500, 2000]),
];

// The classic 16-card decks. Cards are shuffled at setup and recycled only
// after the deck is exhausted; this keeps card order private while retaining
// the physical game's one-card-at-a-time behaviour.
const COMMUNITY_CHEST_CARDS = [
    { title: '前进到起点', text: '前进到起点并领取 ¥200', kind: 'advance', target: 0 },
    { title: '银行错误', text: '银行多付给你 ¥200', kind: 'money', amount: 200 },
    { title: '医生费', text: '支付 ¥50', kind: 'money', amount: -50 },
    { title: '股票出售', text: '获得 ¥50', kind: 'money', amount: 50 },
    { title: '出狱卡', text: '保留此卡，可免费离开拘留所', kind: 'get_out_of_jail' },
    { title: '假日基金到期', text: '获得 ¥100', kind: 'money', amount: 100 },
    { title: '所得税退款', text: '获得 ¥20', kind: 'money', amount: 20 },
    { title: '生日礼金', text: '每位玩家支付你 ¥10', kind: 'collect_from_players', amount: 10 },
    { title: '人寿保险到期', text: '获得 ¥100', kind: 'money', amount: 100 },
    { title: '住院费', text: '支付 ¥100', kind: 'money', amount: -100 },
    { title: '学校费用', text: '支付 ¥50', kind: 'money', amount: -50 },
    { title: '咨询费', text: '获得 ¥25', kind: 'money', amount: 25 },
    { title: '街道维修', text: '每栋房屋支付 ¥40、每间酒店支付 ¥115', kind: 'repairs', house: 40, hotel: 115 },
    { title: '选美比赛', text: '获得 ¥10', kind: 'money', amount: 10 },
    { title: '继承遗产', text: '获得 ¥100', kind: 'money', amount: 100 },
    { title: '人寿保险红利', text: '获得 ¥100', kind: 'money', amount: 100 },
];

const CHANCE_CARDS = [
    { title: '前进到起点', text: '前进到起点并领取 ¥200', kind: 'advance', target: 0 },
    { title: '前进到湾仔', text: '前进到湾仔；经过起点领取 ¥200', kind: 'advance', target: 11 },
    { title: '前进到海洋公园', text: '前进到海洋公园；经过起点领取 ¥200', kind: 'advance', target: 24 },
    { title: '前进到维多利亚港', text: '前进到维多利亚港；经过起点领取 ¥200', kind: 'advance', target: 39 },
    { title: '前进到最近车站', text: '前进到最近车站并支付双倍租金', kind: 'nearest_railroad' },
    { title: '前进到最近车站', text: '前进到最近车站并支付双倍租金', kind: 'nearest_railroad' },
    { title: '前进到最近公用事业', text: '前进到最近公用事业；若有人拥有则支付十倍骰子点数', kind: 'nearest_utility' },
    { title: '银行红利', text: '获得 ¥50', kind: 'money', amount: 50 },
    { title: '出狱卡', text: '保留此卡，可免费离开拘留所', kind: 'get_out_of_jail' },
    { title: '退后三格', text: '退后三格', kind: 'move_steps', steps: -3 },
    { title: '前往拘留所', text: '直接前往拘留所，不经过起点，不领取 ¥200', kind: 'go_to_jail' },
    { title: '房屋维修', text: '每栋房屋支付 ¥25、每间酒店支付 ¥100', kind: 'repairs', house: 25, hotel: 100 },
    { title: '超速罚款', text: '支付 ¥15', kind: 'money', amount: -15 },
    { title: '建筑贷款到期', text: '获得 ¥150', kind: 'money', amount: 150 },
    { title: '董事会主席', text: '向每位玩家支付 ¥50', kind: 'pay_each_player', amount: 50 },
    { title: '前进到九广铁路', text: '前进到九广铁路；经过起点领取 ¥200', kind: 'advance', target: 5 },
];

class MonopolyEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId; this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map((p, index) => ({ id: p.id, name: p.name, color: PLAYER_COLORS[index % PLAYER_COLORS.length], tokenId: null, tokenStyle: '3d', cash: STARTING_CASH, position: 0, inJail: false, jailTurns: 0, consecutiveDoubles: 0, isBankrupt: false, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(p => [p.id, p]));
        this.board = this._createBoard(); this.currentTurnIndex = 0; this.turnNumber = 1; this.status = 'waiting'; this.phase = 'await_roll'; this.dice = null; this.lastRollTotal = 7; this.extraTurn = false; this.pendingPurchase = null; this.auction = null; this.lastEvent = null; this.lastAction = null; this.actionLog = []; this.winner = null;
        this.chanceDeck = []; this.communityChestDeck = [];
        this.housesAvailable = 32; this.hotelsAvailable = 12;
        this.players.forEach(player => { player.jailCardCount = 0; player.jailCards = []; });
    }
    _createBoard() { return BOARD_TEMPLATE.map(tile => { const normalized = tile.type === 'water' || tile.group === 'utility' ? { ...tile, type: 'property' } : tile; return { ...normalized, rents: normalized.rents ? [...normalized.rents] : undefined, ownerId: normalized.type === 'property' ? null : undefined, houses: normalized.type === 'property' ? 0 : undefined, mortgaged: normalized.type === 'property' ? false : undefined }; }); }
    start() { if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' }; if (this.players.length < 2 || this.players.length > 8) return { success: false, message: '环城大富翁需要 2–8 名玩家' }; this.chanceDeck = this._shuffle(CHANCE_CARDS); this.communityChestDeck = this._shuffle(COMMUNITY_CHEST_CARDS); this._assignRandomTokens(); this.housesAvailable = 32; this.hotelsAvailable = 12; this.status = 'playing'; this.phase = 'await_roll'; this.actionLog = [`游戏开始，${this.players[0].name} 先行动`]; return this._success('游戏已开始'); }
    _shuffle(cards) { const deck = cards.map(card => card && typeof card === 'object' ? { ...card } : card); for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(this.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
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
    getActivePlayers() { return this.players.filter(p => !p.isBankrupt && p.isOnline); }
    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束' };
        const player = this.playerMap[playerId];
        if (!player || player.isBankrupt || !player.isOnline) return { success: false, message: '玩家不存在或已经破产' };
        if (action.kind === 'selectToken') return this._selectToken(player, action);
        if (this.phase === 'auction') return this._auctionAction(player, action);
        if (this.getCurrentPlayer()?.id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        switch (action.kind) {
            case 'rollDice': return this._rollTurn(player);
            case 'buyProperty': return this._buyProperty(player);
            case 'passProperty': return this._passProperty(player);
            case 'endTurn': return this._endTurn(player);
            case 'payBail': return this._payBail(player);
            case 'rollForDoubles': return this._rollFromJail(player);
            case 'useJailCard': return this._useJailCard(player);
            case 'buildHouse': return this._buildHouse(player, Number(action.tileIndex));
            case 'sellBuilding': return this._sellBuilding(player, Number(action.tileIndex));
            case 'mortgageProperty': return this._mortgageProperty(player, Number(action.tileIndex));
            case 'unmortgageProperty': return this._unmortgageProperty(player, Number(action.tileIndex));
            default: return { success: false, message: '未知的大富翁动作', state: this.getPlayerState(playerId) };
        }
    }
    _selectToken(player, action) {
        const tokenId = Number(action.tokenId);
        const tokenStyle = String(action.tokenStyle || player.tokenStyle || '3d');
        if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= TOKEN_COUNT) return { success: false, message: '请选择有效的棋子', state: this.getPlayerState(player.id) };
        if (!TOKEN_STYLES.has(tokenStyle)) return { success: false, message: '请选择有效的棋子样式', state: this.getPlayerState(player.id) };
        const owner = this.players.find(candidate => candidate.id !== player.id && !candidate.isBankrupt && candidate.isOnline && candidate.tokenId === tokenId);
        if (owner) return { success: false, message: `这枚棋子已被${owner.name}使用`, state: this.getPlayerState(player.id) };
        player.tokenId = tokenId;
        player.tokenStyle = tokenStyle;
        this.lastAction = { kind: 'selectToken', playerId: player.id, playerName: player.name, message: `${player.name} 选择了${TOKEN_NAMES[tokenId]}棋子` };
        return this._success(this.lastAction.message);
    }
    _rollTurn(player) {
        if (this.phase !== 'await_roll') return { success: false, message: '现在不能掷骰子', state: this.getPlayerState(player.id) };
        if (player.inJail) return { success: false, message: '请先处理拘留状态', state: this.getPlayerState(player.id) };
        return this._resolveRoll(player, this._rollDice());
    }
    _rollFromJail(player) {
        if (this.phase !== 'jail_decision') return { success: false, message: '现在不需要处理拘留状态', state: this.getPlayerState(player.id) };
        const dice = this._rollDice(); this.dice = dice;
        if (dice[0] === dice[1]) { player.inJail = false; player.jailTurns = 0; this.actionLog.push(`${player.name} 掷出对子，离开拘留所`); return this._resolveRoll(player, dice, true); }
        player.jailTurns++;
        if (player.jailTurns >= 3) {
            player.inJail = false;
            player.jailTurns = 0;
            if (player.cash >= BAIL_COST) {
                player.cash -= BAIL_COST;
                // On the third failed attempt the player must pay the fine,
                // then move by that roll; the failed roll is not discarded.
                return this._resolveRoll(player, dice, true);
            }
            this._bankrupt(player, null, '无法支付保释金');
        }
        this.phase = 'turn_complete'; this.lastAction = { kind: 'rollForDoubles', playerId: player.id, playerName: player.name, message: `${player.name} 没有掷出对子` }; this.actionLog.push(this.lastAction.message); return this._success(this.lastAction.message);
    }
    _resolveRoll(player, dice, leavingJail = false) {
        this.dice = dice; const total = dice[0] + dice[1]; this.lastRollTotal = total; const doubles = dice[0] === dice[1]; player.consecutiveDoubles = doubles ? player.consecutiveDoubles + 1 : 0;
        if (player.consecutiveDoubles >= 3) { this._sendToJail(player); this.phase = 'turn_complete'; this.lastAction = { kind: 'rollDice', playerId: player.id, playerName: player.name, message: `${player.name} 连续三次对子，进入拘留所` }; this.actionLog.push(this.lastAction.message); return this._success(this.lastAction.message); }
        const old = player.position; const next = (old + total) % this.board.length; if (old + total >= this.board.length) player.cash += PASS_START_REWARD;
        player.position = next; this.phase = 'turn_complete'; this.pendingPurchase = null; this.lastEvent = null;
        const landing = this._resolveLanding(player); this.lastAction = { kind: 'rollDice', playerId: player.id, playerName: player.name, message: `${player.name} 掷出 ${dice[0]} + ${dice[1]}，到达 ${this.board[next].name}`, dice, from: old, to: next, leavingJail };
        this.actionLog.push(this.lastAction.message + (landing ? `：${landing}` : ''));
        this.extraTurn = doubles && this.status === 'playing' && !player.inJail && !player.isBankrupt;
        return this._success(this.lastAction.message);
    }
    _resolveLanding(player, depth = 0, rentMultiplier = 1) {
        if (depth > 2 || player.isBankrupt) return '';
        const tile = this.board[player.position];
        if (tile.type === 'property') {
            if (!tile.ownerId) { this.pendingPurchase = { playerId: player.id, tileIndex: tile.index }; this.phase = 'property_decision'; return `${tile.name} 尚未出售，可用 ${tile.price} 购买`; }
            if (tile.ownerId === player.id) return '回到自己的地产';
            const owner = this.playerMap[tile.ownerId]; const rent = this._calculateRent(tile, this.lastRollTotal) * rentMultiplier; const paid = this._transferMoney(player, owner, rent, `${tile.name} 租金`); return paid;
        }
        if (tile.type === 'chance' || tile.type === 'community_chest') return this._drawEvent(player, depth, tile.type);
        if (tile.type === 'tax') { this._payBank(player, tile.amount, tile.name); return `支付 ${tile.amount}`; }
        if (tile.type === 'go_to_jail') { this._sendToJail(player); return '前往拘留所'; }
        return '';
    }
    _drawEvent(player, depth, tileType) {
        const deckKey = tileType === 'community_chest' ? 'communityChestDeck' : 'chanceDeck';
        if (!this[deckKey].length) this[deckKey] = this._shuffle(tileType === 'community_chest' ? COMMUNITY_CHEST_CARDS : CHANCE_CARDS);
        const card = this[deckKey].shift(); this.lastEvent = card;
        if (card.kind === 'money') card.amount >= 0 ? player.cash += card.amount : this._payBank(player, -card.amount, card.title);
        if (card.kind === 'collect_from_players') this.players.filter(other => other.id !== player.id && !other.isBankrupt).forEach(other => this._transferMoney(other, player, card.amount, card.title));
        if (card.kind === 'pay_each_player') this.players.filter(other => other.id !== player.id && !other.isBankrupt).forEach(other => this._transferMoney(player, other, card.amount, card.title));
        if (card.kind === 'get_out_of_jail') { player.jailCards.push({ deck: tileType, card: { ...card } }); player.jailCardCount = player.jailCards.length; }
        if (card.kind === 'advance') {
            const old = player.position; if (card.target === 0 || card.target < old) player.cash += PASS_START_REWARD;
            player.position = card.target; this._resolveLanding(player, depth + 1);
        }
        if (card.kind === 'move_steps') { player.position = (player.position + card.steps + this.board.length) % this.board.length; this._resolveLanding(player, depth + 1); }
        if (card.kind === 'nearest_railroad') {
            const targets = [5, 15, 25, 35]; const target = targets.find(index => index > player.position) ?? targets[0];
            if (target <= player.position) player.cash += PASS_START_REWARD;
            player.position = target; this._resolveLanding(player, depth + 1, 2);
        }
        if (card.kind === 'nearest_utility') {
            const targets = [12, 28]; const target = targets.find(index => index > player.position) ?? targets[0];
            if (target <= player.position) player.cash += PASS_START_REWARD;
            player.position = target; this._resolveLanding(player, depth + 1, 10);
        }
        if (card.kind === 'repairs') {
            const amount = this.board.filter(tile => tile.ownerId === player.id).reduce((sum, tile) => sum + (tile.houses >= 5 ? card.hotel : (tile.houses || 0) * card.house), 0);
            if (amount) this._payBank(player, amount, card.title);
        }
        if (card.kind === 'go_to_jail') this._sendToJail(player);
        return `${card.title}：${card.text}`;
    }
    _buyProperty(player) { if (this.phase !== 'property_decision' || this.pendingPurchase?.playerId !== player.id) return { success: false, message: '当前没有可购买的地产', state: this.getPlayerState(player.id) }; const tile = this.board[this.pendingPurchase.tileIndex]; if (player.cash < tile.price) return { success: false, message: '现金不足', state: this.getPlayerState(player.id) }; player.cash -= tile.price; tile.ownerId = player.id; this.pendingPurchase = null; this.phase = 'turn_complete'; this.lastAction = { kind: 'buyProperty', playerId: player.id, playerName: player.name, message: `${player.name} 购买了 ${tile.name}` }; this.actionLog.push(this.lastAction.message); return this._success(this.lastAction.message); }
    _passProperty(player) { if (this.phase !== 'property_decision' || this.pendingPurchase?.playerId !== player.id) return { success: false, message: '当前没有可跳过的地产', state: this.getPlayerState(player.id) }; const tileIndex = this.pendingPurchase.tileIndex; this.pendingPurchase = null; this.auction = { tileIndex, currentBidderIndex: this.currentTurnIndex, highestBid: 0, highestBidder: null, passed: new Set([player.id]) }; this.phase = 'auction'; this._advanceAuctionTurn(); this.actionLog.push(`${player.name} 放弃购买${this.board[tileIndex].name}，进入公开拍卖`); return this._success('地产进入公开拍卖'); }
    _auctionAction(player, action) { if (this.phase !== 'auction' || !this.auction || this.players[this.auction.currentBidderIndex]?.id !== player.id) return { success: false, message: '等待其他玩家竞拍', state: this.getPlayerState(player.id) }; if (action.kind === 'bidProperty') { const amount = Number(action.amount); if (!Number.isInteger(amount) || amount <= this.auction.highestBid || amount > player.cash) return { success: false, message: '出价必须高于当前价格且不能超过现金', state: this.getPlayerState(player.id) }; this.auction.highestBid = amount; this.auction.highestBidder = player.id; } else if (action.kind === 'passAuction') this.auction.passed.add(player.id); else return { success: false, message: '请选择出价或放弃竞拍', state: this.getPlayerState(player.id) }; const active = this.getActivePlayers().filter(item => !this.auction.passed.has(item.id)); if (active.length <= 1) { const tile = this.board[this.auction.tileIndex]; const winner = this.auction.highestBidder ? this.playerMap[this.auction.highestBidder] : null; if (winner && this.auction.highestBid > 0) { winner.cash -= this.auction.highestBid; tile.ownerId = winner.id; this.lastAction = { kind: 'bidProperty', playerId: winner.id, playerName: winner.name, message: `${winner.name} 以 ¥${this.auction.highestBid} 拍下 ${tile.name}` }; } else this.lastAction = { kind: 'passAuction', playerId: player.id, playerName: player.name, message: `${tile.name} 无人竞拍` }; this.auction = null; this.phase = 'turn_complete'; this.actionLog.push(this.lastAction.message); return this._success(this.lastAction.message); } this._advanceAuctionTurn(); return this._success('竞价已记录'); }
    _advanceAuctionTurn() { if (!this.auction) return; do { this.auction.currentBidderIndex = (this.auction.currentBidderIndex + 1) % this.players.length; } while (this.auction.passed.has(this.players[this.auction.currentBidderIndex]?.id) || this.players[this.auction.currentBidderIndex]?.isBankrupt || !this.players[this.auction.currentBidderIndex]?.isOnline); }
    _endTurn(player) { if (this.phase !== 'turn_complete') return { success: false, message: '请先完成当前行动', state: this.getPlayerState(player.id) }; if (this.extraTurn) { this.extraTurn = false; this.phase = 'await_roll'; this.actionLog.push(`${player.name} 获得额外回合`); return this._success('获得额外回合'); } this._advanceTurn(); return this._success(`轮到${this.getCurrentPlayer()?.name || '下一位玩家'}`); }
    _advanceTurn() { const next = this._nextActiveIndex(this.currentTurnIndex); if (next === -1 || this.getActivePlayers().length <= 1) { this.status = 'ended'; this.winner = this.getActivePlayers()[0] || null; this.phase = 'ended'; return; } this.currentTurnIndex = next; this.turnNumber++; this.phase = this.getCurrentPlayer().inJail ? 'jail_decision' : 'await_roll'; this.dice = null; this.pendingPurchase = null; }
    _payBail(player) { if (this.phase !== 'jail_decision' || !player.inJail) return { success: false, message: '当前不需要支付保释金', state: this.getPlayerState(player.id) }; if (player.cash < BAIL_COST) return { success: false, message: '现金不足', state: this.getPlayerState(player.id) }; player.cash -= BAIL_COST; player.inJail = false; player.jailTurns = 0; this.phase = 'await_roll'; return this._success(`${player.name} 支付保释金并离开拘留所`); }
    _useJailCard(player) { if (this.phase !== 'jail_decision' || !player.inJail || !player.jailCards?.length) return { success: false, message: '没有可用的出狱卡', state: this.getPlayerState(player.id) }; const held = player.jailCards.shift(); player.jailCardCount = player.jailCards.length; const deckKey = held.deck === 'community_chest' ? 'communityChestDeck' : 'chanceDeck'; this[deckKey].push(held.card); player.inJail = false; player.jailTurns = 0; this.phase = 'await_roll'; this.actionLog.push(`${player.name} 使用出狱卡`); return this._success(`${player.name} 使用出狱卡并离开拘留所`); }
    _buildHouse(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!['await_roll', 'turn_complete'].includes(this.phase) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || tile.mortgaged || tile.buildCost <= 0 || tile.houses >= MAX_BUILDINGS) return { success: false, message: '当前不能在这里建造', state: this.getPlayerState(player.id) };
        const group = this.board.filter(t => t.type === 'property' && t.group === tile.group);
        if (!group.every(t => t.ownerId === player.id && !t.mortgaged)) return { success: false, message: '必须拥有完整且未抵押的地产组', state: this.getPlayerState(player.id) };
        const isHotel = tile.houses === 4;
        if (isHotel) {
            if (!group.every(item => (item.houses || 0) >= 4)) return { success: false, message: '建造酒店前，同色地产都必须有四栋房屋', state: this.getPlayerState(player.id) };
            if (this.hotelsAvailable < 1) return { success: false, message: '银行没有酒店了', state: this.getPlayerState(player.id) };
        } else {
            const lowestHouses = Math.min(...group.map(item => item.houses || 0));
            if (tile.houses > lowestHouses) return { success: false, message: '房屋必须在同色地产上平均建造', state: this.getPlayerState(player.id) };
            if (this.housesAvailable < 1) return { success: false, message: '银行没有房屋了', state: this.getPlayerState(player.id) };
        }
        if (player.cash < tile.buildCost) return { success: false, message: '现金不足', state: this.getPlayerState(player.id) };
        player.cash -= tile.buildCost;
        if (isHotel) { tile.houses++; this.hotelsAvailable--; this.housesAvailable += 4; }
        else { tile.houses++; this.housesAvailable--; }
        return this._success(`${player.name} 在${tile.name}建造了${isHotel ? '酒店' : '房屋'}`);
    }
    _sellBuilding(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!['await_roll', 'turn_complete'].includes(this.phase) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || !tile.houses) return { success: false, message: '当前不能出售这里的建筑', state: this.getPlayerState(player.id) };
        const group = this.board.filter(item => item.type === 'property' && item.group === tile.group);
        const lowest = Math.min(...group.map(item => item.houses || 0));
        if (tile.houses > lowest) return { success: false, message: '建筑必须均匀出售', state: this.getPlayerState(player.id) };
        if (tile.houses === 5) {
            if (this.housesAvailable < 4) return { success: false, message: '银行没有足够房屋接替酒店', state: this.getPlayerState(player.id) };
            tile.houses = 4; this.hotelsAvailable++; this.housesAvailable -= 4; player.cash += Math.floor(tile.buildCost / 2);
            return this._success(`${player.name} 将${tile.name}的酒店降为四栋房屋`);
        }
        tile.houses--; this.housesAvailable++; player.cash += Math.floor(tile.buildCost / 2);
        return this._success(`${player.name} 出售${tile.name}的一栋房屋`);
    }
    _mortgageProperty(player, tileIndex) {
        const tile = this.board[tileIndex];
        if (!['await_roll', 'turn_complete'].includes(this.phase) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || tile.mortgaged || tile.houses) return { success: false, message: '当前不能抵押这块地产', state: this.getPlayerState(player.id) };
        const group = this.board.filter(item => item.type === 'property' && item.group === tile.group);
        if (group.some(item => item.houses)) return { success: false, message: '同色地产组必须先卖掉全部建筑', state: this.getPlayerState(player.id) };
        tile.mortgaged = true; player.cash += Math.floor(tile.price / 2);
        return this._success(`${player.name} 抵押了${tile.name}`);
    }
    _unmortgageProperty(player, tileIndex) {
        const tile = this.board[tileIndex];
        const cost = tile ? Math.ceil(tile.price * 0.55) : Infinity;
        if (!['await_roll', 'turn_complete'].includes(this.phase) || !tile || tile.type !== 'property' || tile.ownerId !== player.id || !tile.mortgaged) return { success: false, message: '当前不能赎回这块地产', state: this.getPlayerState(player.id) };
        if (player.cash < cost) return { success: false, message: '现金不足以支付抵押利息', state: this.getPlayerState(player.id) };
        player.cash -= cost; tile.mortgaged = false;
        return this._success(`${player.name} 赎回了${tile.name}`);
    }
    _sendToJail(player) { player.position = 10; player.inJail = true; player.jailTurns = 0; player.consecutiveDoubles = 0; }
    _payBank(player, amount, reason) { if (player.cash >= amount) { player.cash -= amount; return true; } this._bankrupt(player, null, reason); return false; }
    _transferMoney(from, to, amount, reason) { const paid = Math.min(from.cash, amount); from.cash -= paid; if (to && !to.isBankrupt) to.cash += paid; if (paid < amount) this._bankrupt(from, to, reason); return `${from.name} 支付 ${paid}（${reason}）`; }
    _bankrupt(player, creditor, reason) {
        if (player.isBankrupt) return;
        player.isBankrupt = true; player.cash = 0;
        this.board.forEach(tile => {
            if (tile.ownerId !== player.id) return;
            // Buildings are always sold back to the bank before property is
            // handed to a creditor, exactly as in the paper game.
            if (tile.houses >= 5) { this.hotelsAvailable++; this.housesAvailable += 4; }
            else this.housesAvailable += tile.houses || 0;
            tile.houses = 0;
            if (creditor) {
                tile.ownerId = creditor.id;
                // A creditor receiving a mortgaged deed owes the bank 10% of
                // its mortgage value immediately. Keep the deed mortgaged.
                if (tile.mortgaged) creditor.cash = Math.max(0, creditor.cash - Math.ceil((tile.price / 2) * 0.1));
            } else {
                tile.ownerId = null; tile.mortgaged = false;
            }
        });
        this.actionLog.push(`${player.name} 因${reason}破产`);
        if (this.getActivePlayers().length <= 1) { this.status = 'ended'; this.winner = this.getActivePlayers()[0] || null; this.phase = 'ended'; }
    }
    _nextActiveIndex(from) { for (let offset = 1; offset <= this.players.length; offset++) { const index = (from + offset) % this.players.length; if (!this.players[index].isBankrupt && this.players[index].isOnline) return index; } return -1; }
    _calculateRent(tile, diceTotal = this.lastRollTotal || 7) { if (!tile || tile.mortgaged) return 0; if (tile.group === 'utility') { const count = this.board.filter(t => t.type === 'property' && t.group === 'utility' && t.ownerId === tile.ownerId && !t.mortgaged).length; return diceTotal * (count >= 2 ? 10 : 4); } if (tile.group === 'transit') { const count = this.board.filter(t => t.type === 'property' && t.group === 'transit' && t.ownerId === tile.ownerId && !t.mortgaged).length; return tile.rents[Math.max(0, Math.min(count - 1, tile.rents.length - 1))]; } if (tile.houses > 0) return tile.rents[Math.min(tile.houses, tile.rents.length - 1)]; const group = this.board.filter(t => t.type === 'property' && t.group === tile.group); return tile.rents[0] * (group.every(t => t.ownerId === tile.ownerId && !t.mortgaged) ? 2 : 1); }
    _rollDice() { return [Math.floor(this.random() * 6) + 1, Math.floor(this.random() * 6) + 1]; }
    getPlayerState(playerId) { const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myTurn = state.currentTurn === playerId; state.availableActions = this._getAvailableActions(player); return state; }
    _getAvailableActions(player) { if (!player || player.isBankrupt || !player.isOnline || this.status !== 'playing') return { canRoll: false, canBuy: false, canPass: false, canEndTurn: false, canPayBail: false, canRollForDoubles: false, canUseJailCard: false, canAuctionBid: false, canAuctionPass: false, auctionMinBid: 0, buildableTiles: [], sellableTiles: [], mortgageableTiles: [], unmortgageableTiles: [] }; if (this.phase === 'auction') { const current = this.players[this.auction?.currentBidderIndex]; return { canRoll: false, canBuy: false, canPass: false, canEndTurn: false, canPayBail: false, canRollForDoubles: false, canUseJailCard: false, canAuctionBid: current?.id === player.id, canAuctionPass: current?.id === player.id, auctionMinBid: (this.auction?.highestBid || 0) + 1, buildableTiles: [], sellableTiles: [], mortgageableTiles: [], unmortgageableTiles: [] }; } const inactive = this.getCurrentPlayer()?.id !== player.id; if (inactive) return { canRoll: false, canBuy: false, canPass: false, canEndTurn: false, canPayBail: false, canRollForDoubles: false, canUseJailCard: false, canAuctionBid: false, canAuctionPass: false, auctionMinBid: 0, buildableTiles: [], sellableTiles: [], mortgageableTiles: [], unmortgageableTiles: [] }; const buildableTiles = ['await_roll', 'turn_complete'].includes(this.phase) ? this.board.filter(t => t.type === 'property' && t.ownerId === player.id && !t.mortgaged && t.buildCost > 0 && t.houses < MAX_BUILDINGS).filter(t => this.board.filter(item => item.type === 'property' && item.group === t.group).every(item => item.ownerId === player.id && !item.mortgaged)).filter(t => player.cash >= t.buildCost).map(t => t.index) : []; const sellableTiles = ['await_roll', 'turn_complete'].includes(this.phase) ? this.board.filter(t => t.type === 'property' && t.ownerId === player.id && t.houses > 0).map(t => t.index) : []; const mortgageableTiles = ['await_roll', 'turn_complete'].includes(this.phase) ? this.board.filter(t => t.type === 'property' && t.ownerId === player.id && !t.mortgaged && !t.houses && !this.board.some(item => item.type === 'property' && item.group === t.group && item.houses)).map(t => t.index) : []; const unmortgageableTiles = ['await_roll', 'turn_complete'].includes(this.phase) ? this.board.filter(t => t.type === 'property' && t.ownerId === player.id && t.mortgaged && player.cash >= Math.ceil(t.price * 0.55)).map(t => t.index) : []; return { canRoll: this.phase === 'await_roll', canBuy: this.phase === 'property_decision' && this.pendingPurchase?.playerId === player.id && player.cash >= (this.board[this.pendingPurchase.tileIndex]?.price || Infinity), canPass: this.phase === 'property_decision' && this.pendingPurchase?.playerId === player.id, canEndTurn: this.phase === 'turn_complete', canPayBail: this.phase === 'jail_decision' && player.cash >= BAIL_COST, canRollForDoubles: this.phase === 'jail_decision', canUseJailCard: this.phase === 'jail_decision' && player.jailCardCount > 0, canAuctionBid: false, canAuctionPass: false, auctionMinBid: 0, buildableTiles, sellableTiles, mortgageableTiles, unmortgageableTiles }; }
    getPublicState() { const effectiveTurnId = this.phase === 'auction' ? this.players[this.auction?.currentBidderIndex]?.id || null : this.getCurrentPlayer()?.id || null; return { roomId: this.roomId, status: this.status, phase: this.phase, turnNumber: this.turnNumber, currentTurn: effectiveTurnId, currentTurnName: this.playerMap[effectiveTurnId]?.name || null, dice: this.dice, extraTurn: this.extraTurn, pendingPurchase: this.pendingPurchase, auction: this.auction ? { tileIndex: this.auction.tileIndex, tileName: this.board[this.auction.tileIndex]?.name, currentBidder: this.players[this.auction.currentBidderIndex]?.id, currentBidderName: this.players[this.auction.currentBidderIndex]?.name, highestBid: this.auction.highestBid, highestBidder: this.auction.highestBidder, passed: [...this.auction.passed] } : null, lastEvent: this.lastEvent, lastAction: this.lastAction, actionLog: this.actionLog.slice(-14), rules: { startingCash: STARTING_CASH, passStartReward: PASS_START_REWARD, bailCost: BAIL_COST, maxBuildings: MAX_BUILDINGS, housesPerProperty: 4, hotelPerProperty: 1, housesAvailable: this.housesAvailable, hotelsAvailable: this.hotelsAvailable }, board: this.board.map(tile => ({ ...tile, mortgageValue: tile.type === 'property' ? Math.floor(tile.price / 2) : 0, ownerName: tile.ownerId ? this.playerMap[tile.ownerId]?.name || null : null, currentRent: tile.type === 'property' && tile.ownerId ? this._calculateRent(tile) : 0 })), players: this.players.map(p => ({ id: p.id, name: p.name, color: p.color, tokenId: p.tokenId, tokenStyle: p.tokenStyle, cash: p.cash, position: p.position, inJail: p.inJail, jailTurns: p.jailTurns, jailCardCount: p.jailCardCount, isBankrupt: p.isBankrupt, isOnline: p.isOnline, isCurrentTurn: p.id === effectiveTurnId, propertyCount: this.board.filter(t => t.ownerId === p.id).length })), winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    handlePlayerLeave(playerId) { const player = this.playerMap[playerId]; if (!player) return { success: false, message: '玩家不存在' }; player.isOnline = false; this._bankrupt(player, null, '离开游戏'); if (this.getCurrentPlayer()?.id === playerId && this.status === 'playing') this._advanceTurn(); return this._success(`${player.name} 离开游戏`); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = MonopolyEngine;
module.exports.BOARD_TEMPLATE = BOARD_TEMPLATE;
