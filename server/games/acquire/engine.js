const ROWS = 9;
const COLS = 12;
const STARTING_CASH = 6000;
const HAND_SIZE = 6;
const MAX_BUY = 3;
const CHAINS = [
    { id: 'sackson', name: '萨克森', short: 'S', color: '#d26a5d' },
    { id: 'imperial', name: '帝国', short: 'I', color: '#d5a84d' },
    { id: 'america', name: '美国', short: 'A', color: '#5a8db2' },
    { id: 'festival', name: '节庆', short: 'F', color: '#b47caa' },
    { id: 'worldwide', name: '环球', short: 'W', color: '#66a578' },
    { id: 'continental', name: '大陆', short: 'C', color: '#8e7db2' },
    { id: 'tower', name: '塔楼', short: 'T', color: '#d17e43' },
];
const CHAIN_MAP = Object.fromEntries(CHAINS.map(chain => [chain.id, chain]));
const CHAIN_TIERS = { sackson: 'low', tower: 'low', america: 'middle', festival: 'middle', worldwide: 'middle', continental: 'high', imperial: 'high' };
const SHARE_PRICE_BY_SIZE = {
    low: [[2, 200], [3, 300], [4, 400], [5, 500], [10, 600], [20, 700], [30, 800], [40, 900], [Infinity, 1000]],
    middle: [[2, 300], [3, 400], [4, 500], [5, 600], [10, 700], [20, 800], [30, 900], [40, 1000], [Infinity, 1100]],
    high: [[2, 400], [3, 500], [4, 600], [5, 700], [10, 800], [20, 900], [30, 1000], [40, 1100], [Infinity, 1200]],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function tileId(row, col) { return `${String.fromCharCode(65 + row)}${col + 1}`; }
function parseTile(id) { const match = /^([A-I])(1[0-2]|[1-9])$/.exec(String(id)); return match ? { row: match[1].charCodeAt(0) - 65, col: Number(match[2]) - 1 } : null; }
function buildTiles() { return Array.from({ length: ROWS * COLS }, (_, index) => ({ id: tileId(Math.floor(index / COLS), index % COLS), row: Math.floor(index / COLS), col: index % COLS })); }

class AcquireEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.players = players.map((player, index) => ({ id: player.id, name: player.name, color: ['#d26a5d', '#5a8db2', '#66a578', '#d5a84d', '#b47caa', '#8e7db2'][index], cash: STARTING_CASH, shares: Object.fromEntries(CHAINS.map(chain => [chain.id, 0])), hand: [], isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.deck = [];
        this.board = {};
        this.corporations = {};
        this.phase = 'waiting';
        this.status = 'waiting';
        this.currentTurnIndex = 0;
        this.startingTiles = [];
        this.pendingTile = null;
        this.pendingFoundation = null;
        this.pendingMerger = null;
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.endGamePending = false;
        this.skipDrawForCurrent = false;
        this.presentationSequence = 0;
        this.transactionSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '并购已经开始，不能重复开始' };
        if (this.players.length < 2 || this.players.length > 6) return { success: false, message: '并购需要 2–6 名玩家' };
        this.deck = this._shuffle(buildTiles());
        this.board = {};
        this.corporations = Object.fromEntries(CHAINS.map(chain => [chain.id, { ...chain, active: false, sharesAvailable: 25, tiles: [] }]));
        this.startingTiles = this.players.map(player => ({ playerId: player.id, tile: this._draw() })).filter(entry => entry.tile);
        this.startingTiles.forEach(entry => { this.board[entry.tile.id] = { ...entry.tile, chain: null, startingPlayerId: entry.playerId }; });
        const first = this.startingTiles.slice().sort((a, b) => this._tileNumber(a.tile) - this._tileNumber(b.tile) || String(a.tile.id).localeCompare(String(b.tile.id)))[0];
        this.currentTurnIndex = Math.max(0, this.players.findIndex(player => player.id === first?.playerId));
        this.players.forEach(player => { player.cash = STARTING_CASH; player.shares = Object.fromEntries(CHAINS.map(chain => [chain.id, 0])); player.hand = Array.from({ length: HAND_SIZE }, () => this._draw()).filter(Boolean); player.isOnline = true; });
        this.lastAction = null;
        this.winner = null;
        this.presentationSequence = 0;
        this.transactionSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
        this.phase = 'place'; this.status = 'playing'; this.endGamePending = false; this.actionLog = [`${this.playerMap[first?.playerId]?.name || this.players[0].name} 按起始地块顺序先手`];
        return this._success('并购开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '并购尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        const isMergerShareholderTurn = this.phase === 'merger_settlement' && this.pendingMerger?.queue?.[this.pendingMerger.queueIndex] === player.id;
        if (!isMergerShareholderTurn && player.id !== this.players[this.currentTurnIndex]?.id) return { success: false, message: '还没轮到你', state: this.getPlayerState(player.id) };
        if (this.phase === 'place' && action.kind === 'placeTile') return this._placeTile(player, action.tileId);
        if (this.phase === 'place' && action.kind === 'discardTile') return this._discardTile(player, action.tileId);
        if (this.phase === 'place' && action.kind === 'skipPlacement') return this._skipPlacement(player);
        if (this.phase === 'foundation' && action.kind === 'foundChain') return this._foundChain(player, action.chainId);
        if (this.phase === 'foundation' && action.kind === 'skipFoundation') return this._finishFoundation(player, null);
        if (this.phase === 'merger' && action.kind === 'chooseMerger') return this._chooseMerger(player, action.chainId);
        if (this.phase === 'merger_settlement' && action.kind === 'settleMergerShares') return this._settleMergerShares(player, action);
        if (this.phase === 'buy' && action.kind === 'buyShares') return this._buyShares(player, action.orders);
        if (action.kind === 'endGame' && ['place', 'buy'].includes(this.phase)) return this._declareEndGame(player);
        return { success: false, message: '现在不能执行这个操作', state: this.getPlayerState(player.id) };
    }

    _canEndGame() {
        const activeChains = Object.values(this.corporations).filter(corporation => corporation.active);
        return activeChains.some(corporation => corporation.tiles.length >= 41)
            || (activeChains.length > 0 && activeChains.every(corporation => corporation.tiles.length >= 11));
    }

    _declareEndGame(player) {
        if (!this._canEndGame()) return { success: false, message: '当前尚未满足结束并购的条件', state: this.getPlayerState(player.id) };
        this.endGamePending = true;
        this.actionLog.push(`${player.name} 宣布结束游戏`);
        this._startPresentation(player, 'endGameDeclared', {
            activeChains: Object.values(this.corporations).filter(corporation => corporation.active).map(corporation => this._chainPresentation(corporation.id)),
            cash: player.cash,
        });
        this._updatePresentation({ resolved: true, pending: 'finalTransaction', nextPlayerId: player.id });
        return this._success(`${player.name} 宣布结束并购，请先完成本回合交易`);
    }

    _placeTile(player, tileIdValue) {
        const index = player.hand.findIndex(tile => tile.id === tileIdValue);
        if (index < 0) return { success: false, message: '这块地块不在你的手牌中', state: this.getPlayerState(player.id) };
        if (!this._isTilePlayable(player.hand[index])) return { success: false, message: '这块地块当前不可铺设', state: this.getPlayerState(player.id) };
        const tile = player.hand.splice(index, 1)[0];
        if (this.board[tile.id]) return { success: false, message: '这块地块已经铺在棋盘上', state: this.getPlayerState(player.id) };
        const adjacent = this._neighbors(tile).filter(neighbor => this.board[neighbor.id]);
        const chainIds = [...new Set(adjacent.map(neighbor => this.board[neighbor.id].chain).filter(Boolean))];
        const neutralAdjacent = adjacent.filter(neighbor => !this.board[neighbor.id].chain);
        if (chainIds.length >= 2 && chainIds.filter(chainId => this.corporations[chainId].tiles.length >= 11).length >= 2) {
            player.hand.push(tile);
            return { success: false, message: '不能合并两个规模达到 11 格的安全集团', state: this.getPlayerState(player.id) };
        }
        if (chainIds.length >= 2) {
            this.board[tile.id] = { ...tile, chain: null };
            this.pendingTile = tile;
            this.pendingMerger = { playerId: player.id, chains: chainIds };
            this.phase = 'merger';
            this.actionLog.push(`${player.name} 铺下 ${tile.id}，触发 ${chainIds.map(id => CHAIN_MAP[id].name).join('与')} 合并`);
            this._startPresentation(player, 'placeTile', {
                tile: { ...tile },
                resultKind: 'merger',
                adjacentChainIds: chainIds.slice(),
                adjacentNeutralIds: neutralAdjacent.map(neighbor => neighbor.id),
                chains: chainIds.map(chainId => this._chainPresentation(chainId)),
            });
            this._updatePresentation({ pending: 'chooseMerger', resolved: false, nextPlayerId: player.id });
            return this._success('请选择合并后保留的集团');
        }
        this.board[tile.id] = { ...tile, chain: chainIds[0] || null };
        if (chainIds.length === 1) {
            const before = this._chainPresentation(chainIds[0]);
            this._absorbNeutralNeighbors(tile, chainIds[0]);
            this._startPresentation(player, 'placeTile', {
                tile: { ...tile },
                resultKind: 'expand',
                adjacentChainIds: chainIds.slice(),
                adjacentNeutralIds: neutralAdjacent.map(neighbor => neighbor.id),
                chainBefore: before,
                chainAfter: this._chainPresentation(chainIds[0]),
            });
        }
        if (chainIds.length === 0 && neutralAdjacent.length > 0) {
            this.pendingTile = tile;
            this.pendingFoundation = { playerId: player.id, tileId: tile.id };
            this.phase = 'foundation';
            this.actionLog.push(`${player.name} 铺下 ${tile.id}，可以创建新的酒店集团`);
            this._startPresentation(player, 'placeTile', {
                tile: { ...tile },
                resultKind: 'foundation',
                adjacentChainIds: [],
                adjacentNeutralIds: neutralAdjacent.map(neighbor => neighbor.id),
            });
            this._updatePresentation({ pending: 'foundation', resolved: false, nextPlayerId: player.id });
            return this._success('请选择是否创建酒店集团');
        }
        if (chainIds.length === 0) {
            this._startPresentation(player, 'placeTile', {
                tile: { ...tile },
                resultKind: 'neutral',
                adjacentChainIds: [],
                adjacentNeutralIds: [],
            });
        }
        return this._beginBuy(player, `${player.name} 铺下 ${tile.id}`);
    }

    _skipPlacement(player) {
        if (player.hand.some(tile => this._isTilePlayable(tile))) return { success: false, message: '手牌中仍有可以铺设的地块', state: this.getPlayerState(player.id) };
        this.skipDrawForCurrent = true;
        this._startPresentation(player, 'skipPlacement', { handCount: player.hand.length });
        return this._beginBuy(player, `${player.name} 本回合没有合法铺设`);
    }

    _discardTile(player, tileIdValue) {
        const index = player.hand.findIndex(tile => tile.id === tileIdValue);
        if (index < 0) return { success: false, message: '这块地块不在你的手牌中', state: this.getPlayerState(player.id) };
        if (!this._isPermanentlyUnplayable(player.hand[index])) return { success: false, message: '只有会合并两个安全集团的永久不可玩地块才能弃置', state: this.getPlayerState(player.id) };
        const [tile] = player.hand.splice(index, 1);
        this.actionLog.push(`${player.name} 弃置了无法铺设的 ${tile.id}`);
        this._startPresentation(player, 'discardTile', { tile: { ...tile } });
        return this._beginBuy(player, `${player.name} 完成弃置`);
    }

    _foundChain(player, chainId) {
        if (!this.pendingFoundation || this.pendingFoundation.playerId !== player.id) return { success: false, message: '现在不能创建集团', state: this.getPlayerState(player.id) };
        if (!this.corporations[chainId] || this.corporations[chainId].active) return { success: false, message: '请选择一个尚未启用的酒店集团', state: this.getPlayerState(player.id) };
        const tile = this.board[this.pendingFoundation.tileId];
        this.corporations[chainId].active = true;
        tile.chain = chainId;
        this.corporations[chainId].tiles.push(tile.id);
        let founderShare = 0;
        if (this.corporations[chainId].sharesAvailable > 0) {
            this.corporations[chainId].sharesAvailable -= 1;
            player.shares[chainId] += 1;
            founderShare = 1;
            this.actionLog.push(`${player.name} 获得${CHAIN_MAP[chainId].name}创始人股票 1 股`);
        }
        this._absorbNeutralNeighbors(tile, chainId);
        this._startPresentation(player, 'foundChain', {
            triggerTile: { id: tile.id, row: tile.row, col: tile.col },
            chain: this._chainPresentation(chainId),
            founderShare,
        });
        return this._finishFoundation(player, chainId);
    }

    _finishFoundation(player, chainId) {
        if (chainId) this.actionLog.push(`${player.name} 创建了${CHAIN_MAP[chainId].name}集团`);
        if (!chainId) {
            const tile = this.pendingTile;
            this._startPresentation(player, 'skipFoundation', { triggerTile: tile ? { id: tile.id, row: tile.row, col: tile.col } : null });
        }
        this.pendingFoundation = null; this.pendingTile = null;
        return this._beginBuy(player, chainId ? '酒店集团已创建' : `${player.name} 保留为独立地块`);
    }

    _chooseMerger(player, survivingId) {
        if (!this.pendingMerger || this.pendingMerger.playerId !== player.id) return { success: false, message: '现在不能选择合并集团', state: this.getPlayerState(player.id) };
        if (!this.pendingMerger.chains.includes(survivingId)) return { success: false, message: '请选择参与合并的集团', state: this.getPlayerState(player.id) };
        // In a three-or-more-chain merger, settle the acquired corporations from
        // largest to smallest. Preserve the board adjacency order only for ties.
        const chainOrder = this.pendingMerger.chains.slice();
        const acquired = chainOrder.filter(id => id !== survivingId).sort((a, b) => {
            const sizeDifference = this.corporations[b].tiles.length - this.corporations[a].tiles.length;
            return sizeDifference || chainOrder.indexOf(a) - chainOrder.indexOf(b);
        });
        const largest = Math.max(...this.pendingMerger.chains.map(id => this.corporations[id].tiles.length));
        if (this.corporations[survivingId].tiles.length < largest) return { success: false, message: '规模最大的集团必须保留', state: this.getPlayerState(player.id) };
        const triggerTile = this.pendingTile ? { id: this.pendingTile.id, row: this.pendingTile.row, col: this.pendingTile.col } : null;
        const participatingChains = this.pendingMerger.chains.map(chainId => this._chainPresentation(chainId));
        this.pendingMerger = { playerId: player.id, chains: this.pendingMerger.chains, survivingId, acquiredChains: acquired, settlementChainIndex: 0, queue: [], queueIndex: 0 };
        this.actionLog.push(`${player.name} 让${CHAIN_MAP[survivingId].name}集团吞并了${acquired.map(id => CHAIN_MAP[id].name).join('、')}，开始股东结算`);
        this._startPresentation(player, 'merger', {
            triggerTile,
            participatingChains,
            survivingChain: participatingChains.find(chain => chain.id === survivingId) || this._chainPresentation(survivingId),
            acquiredChains: acquired.map(chainId => participatingChains.find(chain => chain.id === chainId) || this._chainPresentation(chainId)),
        });
        this._updatePresentation({ pending: 'mergerSettlement', resolved: false });
        return this._prepareMergerSettlement();
    }

    _payMergerBonuses(chainId) {
        const corporation = this.corporations[chainId];
        const price = this._sharePrice(chainId);
        const holders = this.players.filter(player => player.shares[chainId] > 0).sort((a, b) => b.shares[chainId] - a.shares[chainId]);
        const result = { chain: this._chainPresentation(chainId), price, payouts: [] };
        if (!corporation || !price || !holders.length) return result;
        const majority = holders[0].shares[chainId];
        const majorityHolders = holders.filter(player => player.shares[chainId] === majority);
        const payout = amount => Math.ceil(amount / 100) * 100;
        const awards = new Map(holders.map(player => [player.id, {
            playerId: player.id,
            playerName: player.name,
            playerColor: player.color,
            shares: player.shares[chainId],
            majorityBonus: 0,
            minorityBonus: 0,
            total: 0,
        }]));
        const award = (player, field, amount) => {
            player.cash += amount;
            const entry = awards.get(player.id);
            entry[field] += amount;
            entry.total += amount;
        };
        if (majorityHolders.length > 1) {
            const split = payout(price * 15 / majorityHolders.length);
            majorityHolders.forEach(player => award(player, 'majorityBonus', split));
            result.payouts = [...awards.values()].filter(entry => entry.total > 0);
            return result;
        }
        award(majorityHolders[0], 'majorityBonus', price * 10);
        const minority = holders.filter(player => player.shares[chainId] < majority && player.shares[chainId] > 0);
        if (!minority.length) {
            award(majorityHolders[0], 'minorityBonus', price * 5);
        } else {
            const second = Math.max(...minority.map(player => player.shares[chainId]));
            const minorityHolders = minority.filter(player => player.shares[chainId] === second);
            const split = payout(price * 5 / minorityHolders.length);
            minorityHolders.forEach(player => award(player, 'minorityBonus', split));
        }
        result.payouts = [...awards.values()].filter(entry => entry.total > 0);
        return result;
    }

    _prepareMergerSettlement() {
        const pending = this.pendingMerger;
        if (!pending) return this._success('合并结算已结束');
        const chainId = pending.acquiredChains[pending.settlementChainIndex];
        if (!chainId) {
            const surviving = this.corporations[pending.survivingId];
            const acquiredChainIds = pending.acquiredChains.slice();
            for (const cell of Object.values(this.board)) if (cell.chain === pending.survivingId || pending.acquiredChains.includes(cell.chain) || (this.pendingTile && cell.id === this.pendingTile.id)) { cell.chain = pending.survivingId; if (!surviving.tiles.includes(cell.id)) surviving.tiles.push(cell.id); }
            for (const acquiredId of pending.acquiredChains) { this.corporations[acquiredId].active = false; this.corporations[acquiredId].tiles = []; }
            const name = this.playerMap[pending.playerId]?.name || '当前玩家';
            this._appendPresentationEvent(this.playerMap[pending.playerId], 'mergerComplete', {
                survivingChain: this._chainPresentation(pending.survivingId),
                acquiredChainIds,
                triggerTile: this.pendingTile ? { id: this.pendingTile.id, row: this.pendingTile.row, col: this.pendingTile.col } : null,
            });
            this.pendingMerger = null; this.pendingTile = null;
            this.actionLog.push(`${name} 完成股东结算`);
            return this._beginBuy(this.playerMap[pending.playerId], '合并结算完成');
        }
        if (!pending.queue.length || pending.queueChainId !== chainId) {
            pending.queueChainId = chainId;
            const bonuses = this._payMergerBonuses(chainId);
            this._appendPresentationEvent(null, 'mergerBonuses', bonuses);
            pending.queue = this.players.slice(this.currentTurnIndex).concat(this.players.slice(0, this.currentTurnIndex)).filter(item => item.shares[chainId] > 0).map(item => item.id);
            pending.queueIndex = 0;
        }
        if (!pending.queue.length) {
            pending.settlementChainIndex += 1; pending.queue = []; pending.queueChainId = null;
            return this._prepareMergerSettlement();
        }
        this.phase = 'merger_settlement';
        const current = this.playerMap[pending.queue[pending.queueIndex]];
        this.actionLog.push(`${current.name} 请处理${CHAIN_MAP[chainId].name}股票：卖出、换股或保留`);
        this._updatePresentation({ pending: 'mergerSettlement', resolved: true, nextPlayerId: current.id });
        return this._success(`${current.name} 请处理${CHAIN_MAP[chainId].name}股票`);
    }

    _settleMergerShares(player, action) {
        const pending = this.pendingMerger;
        const chainId = pending?.queueChainId;
        const currentId = pending?.queue?.[pending.queueIndex];
        if (!pending || !chainId || currentId !== player.id) return { success: false, message: '现在不是你的合并股票结算', state: this.getPlayerState(player.id) };
        if (action.chainId !== chainId) return { success: false, message: '请选择当前正在结算的集团', state: this.getPlayerState(player.id) };
        const holding = player.shares[chainId] || 0;
        const sell = Number(action.sell || 0); const trade = Number(action.trade || 0); const keep = Number(action.keep || 0);
        if (![sell, trade, keep].every(Number.isInteger) || [sell, trade, keep].some(value => value < 0) || sell + trade + keep !== holding) return { success: false, message: `你持有 ${holding} 股，请完整分配卖出、换股和保留数量`, state: this.getPlayerState(player.id) };
        if (trade % 2 !== 0) return { success: false, message: '换股必须按两股旧股票换一股存续集团股票', state: this.getPlayerState(player.id) };
        const surviving = this.corporations[pending.survivingId];
        const exchange = trade / 2;
        if (exchange > surviving.sharesAvailable) return { success: false, message: '存续集团股票库存不足，不能完成换股', state: this.getPlayerState(player.id) };
        const price = this._sharePrice(chainId);
        const cashBefore = player.cash;
        const oldHoldingBefore = player.shares[chainId];
        const survivingHoldingBefore = player.shares[pending.survivingId];
        player.cash += sell * price;
        player.shares[chainId] -= sell + trade;
        this.corporations[chainId].sharesAvailable += sell + trade;
        surviving.sharesAvailable -= exchange;
        player.shares[pending.survivingId] += exchange;
        this.actionLog.push(`${player.name} 处理${CHAIN_MAP[chainId].name}股票：卖出 ${sell}、换股 ${trade}、保留 ${keep}`);
        this._startPresentation(player, 'settleShares', {
            acquiredChain: this._chainPresentation(chainId),
            survivingChain: this._chainPresentation(pending.survivingId),
            sell,
            trade,
            keep,
            exchange,
            price,
            cashBefore,
            cashAfter: player.cash,
            oldHoldingBefore,
            oldHoldingAfter: player.shares[chainId],
            survivingHoldingBefore,
            survivingHoldingAfter: player.shares[pending.survivingId],
        });
        pending.queueIndex += 1;
        if (pending.queueIndex < pending.queue.length) {
            this.phase = 'merger_settlement';
            this._updatePresentation({ pending: 'mergerSettlement', resolved: true, nextPlayerId: pending.queue[pending.queueIndex] });
            return this._success('股东选择已记录');
        }
        pending.settlementChainIndex += 1; pending.queue = []; pending.queueChainId = null;
        return this._prepareMergerSettlement();
    }

    _beginBuy(player, message) { this.phase = 'buy'; this.pendingTile = null; this.actionLog.push(message); this._updatePresentation({ pending: null, resolved: true, nextPhase: 'buy', nextPlayerId: player?.id || null }); return this._success('可以购买最多三股酒店股票'); }

    _buyShares(player, orders) {
        if (!orders || typeof orders !== 'object') return { success: false, message: '请提交股票购买清单', state: this.getPlayerState(player.id) };
        const normalized = Object.entries(orders).map(([chainId, count]) => [chainId, Number(count)]).filter(([, count]) => count > 0);
        const total = normalized.reduce((sum, [, count]) => sum + count, 0);
        if (total > MAX_BUY) return { success: false, message: '每回合最多购买三股', state: this.getPlayerState(player.id) };
        let cost = 0;
        for (const [chainId, count] of normalized) { if (!this.corporations[chainId]?.active) return { success: false, message: '只能购买已启用集团的股票', state: this.getPlayerState(player.id) }; if (!Number.isInteger(count) || count < 1 || count > this.corporations[chainId].sharesAvailable) return { success: false, message: '股票数量无效或库存不足', state: this.getPlayerState(player.id) }; cost += count * this._sharePrice(chainId); }
        if (cost > player.cash) return { success: false, message: '现金不足，无法完成购买', state: this.getPlayerState(player.id) };
        const cashBefore = player.cash;
        const holdingsBefore = Object.fromEntries(normalized.map(([chainId]) => [chainId, player.shares[chainId]]));
        normalized.forEach(([chainId, count]) => { this.corporations[chainId].sharesAvailable -= count; player.shares[chainId] += count; });
        player.cash -= cost;
        const summary = normalized.length ? normalized.map(([chainId, count]) => `${CHAIN_MAP[chainId].name}×${count}`).join('、') : '本回合不买股票';
        this.actionLog.push(`${player.name} 购买 ${summary}`);
        this._startPresentation(player, 'buyShares', {
            orders: normalized.map(([chainId, count]) => ({
                chain: this._chainPresentation(chainId),
                count,
                unitPrice: this._sharePrice(chainId),
                holdingBefore: holdingsBefore[chainId],
                holdingAfter: player.shares[chainId],
            })),
            totalCount: total,
            cost,
            cashBefore,
            cashAfter: player.cash,
        });
        if (this.endGamePending) {
            this._finishGame({ appendPresentation: true });
            return this._success(`${player.name} 完成回合并开始终局清算`);
        }
        this._nextTurn();
        return this._success(`${player.name} 完成回合`);
    }

    _nextTurn() {
        const active = this.players.filter(player => player.isOnline);
        if (!active.length) { this.status = 'ended'; this.phase = 'ended'; return; }
        const current = this.players[this.currentTurnIndex];
        if (current && this.deck.length && !this.skipDrawForCurrent) current.hand.push(this._draw());
        this.skipDrawForCurrent = false;
        const next = this._nextOnlineIndex(this.currentTurnIndex);
        this.currentTurnIndex = next;
        const player = this.players[next];
        if (!this.deck.length && this.players.every(item => item.hand.length === 0)) return this._finishGame({ appendPresentation: true });
        if (!player.hand.length) {
            this._beginBuy(player, `${player.name} 没有可铺设地块`);
            return;
        }
        this.phase = 'place';
        this.actionLog.push(`${player.name} 的回合：请铺设一块地块`);
        this._updatePresentation({ resolved: true, nextPhase: 'place', nextPlayerId: player.id });
        if (current && current.hand.length > HAND_SIZE) current.hand = current.hand.slice(0, HAND_SIZE);
    }

    _finishGame(options = {}) {
        if (this.status === 'ended') return;
        const cashBefore = Object.fromEntries(this.players.map(player => [player.id, player.cash]));
        const totalBonuses = Object.fromEntries(this.players.map(player => [player.id, 0]));
        const totalLiquidations = Object.fromEntries(this.players.map(player => [player.id, 0]));
        const activeChains = Object.values(this.corporations).filter(corporation => corporation.active).sort((a, b) => a.tiles.length - b.tiles.length);
        const chainSettlements = activeChains.map(corporation => {
            const bonuses = this._payMergerBonuses(corporation.id);
            bonuses.payouts.forEach(payoutEntry => { totalBonuses[payoutEntry.playerId] += payoutEntry.total; });
            const price = this._sharePrice(corporation.id);
            const liquidations = [];
            this.players.forEach(player => {
                const holding = player.shares[corporation.id] || 0;
                if (!holding) return;
                const value = holding * price;
                player.cash += value;
                totalLiquidations[player.id] += value;
                liquidations.push({ playerId: player.id, playerName: player.name, playerColor: player.color, shares: holding, unitPrice: price, value });
                corporation.sharesAvailable += holding;
                player.shares[corporation.id] = 0;
            });
            return { chain: bonuses.chain, payouts: bonuses.payouts, liquidations };
        });
        this.status = 'ended'; this.phase = 'ended'; this.endGamePending = false;
        const ranked = this.players.filter(player => player.isOnline).map(player => ({ player, total: player.cash })).sort((a, b) => b.total - a.total);
        this.winner = ranked[0]?.player || null;
        this.actionLog.push(`${this.winner?.name || '无人'} 以 ${ranked[0]?.total || 0} 元资产获胜`);
        const standings = ranked.map(({ player }) => ({
            id: player.id,
            name: player.name,
            color: player.color,
            cashBefore: cashBefore[player.id],
            bonuses: totalBonuses[player.id],
            liquidation: totalLiquidations[player.id],
            finalCash: player.cash,
        }));
        const finale = { chainSettlements, standings, winner: standings.find(player => player.id === this.winner?.id) || null };
        if (options.appendPresentation && this.presentation) this._appendPresentationEvent(null, 'finalSettlement', finale);
        else this._startPresentation(null, 'finalSettlement', finale);
        this._updatePresentation({ resolved: true, ended: true, standings, winner: finale.winner, pending: null, nextPlayerId: null, nextPhase: 'ended' });
    }

    _absorbNeutralNeighbors(tile, chainId) { const corporation = this.corporations[chainId]; if (!corporation) return; tile.chain = chainId; if (!corporation.tiles.includes(tile.id)) corporation.tiles.push(tile.id); for (const neighbor of this._neighbors(tile)) { const cell = this.board[neighbor.id]; if (cell && !cell.chain) { cell.chain = chainId; if (!corporation.tiles.includes(cell.id)) corporation.tiles.push(cell.id); } } }
    _neighbors(tile) { return [[tile.row - 1, tile.col], [tile.row + 1, tile.col], [tile.row, tile.col - 1], [tile.row, tile.col + 1]].filter(([row, col]) => row >= 0 && row < ROWS && col >= 0 && col < COLS).map(([row, col]) => ({ id: tileId(row, col), row, col })); }
    _tileNumber(tile) { return tile ? tile.row * COLS + tile.col : Number.POSITIVE_INFINITY; }
    _isTilePlayable(tile) {
        if (!tile || this.board[tile.id]) return false;
        const adjacent = this._neighbors(tile).filter(neighbor => this.board[neighbor.id]);
        const chainIds = [...new Set(adjacent.map(neighbor => this.board[neighbor.id].chain).filter(Boolean))];
        if (chainIds.length >= 2 && chainIds.filter(chainId => this.corporations[chainId]?.tiles.length >= 11).length >= 2) return false;
        if (chainIds.length === 0 && adjacent.some(neighbor => !this.board[neighbor.id].chain) && !Object.values(this.corporations).some(corporation => !corporation.active)) return false;
        return true;
    }
    _isPermanentlyUnplayable(tile) {
        if (!tile || !this.board) return false;
        const adjacent = this._neighbors(tile).filter(neighbor => this.board[neighbor.id]);
        const chainIds = [...new Set(adjacent.map(neighbor => this.board[neighbor.id].chain).filter(Boolean))];
        return chainIds.length >= 2 && chainIds.filter(chainId => this.corporations[chainId]?.tiles.length >= 11).length >= 2;
    }
    _sharePrice(chainId) { const corporation = this.corporations[chainId]; if (!corporation?.active || corporation.tiles.length < 2) return 0; const tier = CHAIN_TIERS[chainId] || 'middle'; const row = SHARE_PRICE_BY_SIZE[tier].find(([max]) => corporation.tiles.length <= max); return row?.[1] || 0; }
    _chainPresentation(chainId) {
        const corporation = this.corporations[chainId];
        const meta = CHAIN_MAP[chainId];
        if (!corporation || !meta) return null;
        return {
            id: chainId,
            name: meta.name,
            short: meta.short,
            color: meta.color,
            active: corporation.active,
            size: corporation.tiles.length,
            tileIds: corporation.tiles.slice(),
            sharesAvailable: corporation.sharesAvailable,
            sharePrice: this._sharePrice(chainId),
            safe: corporation.tiles.length >= 11,
        };
    }
    _startPresentation(player, kind, data = {}) {
        this.presentation = {
            sequence: ++this.presentationSequence,
            transactionId: ++this.transactionSequence,
            events: [{
                eventId: ++this.eventSequence,
                kind,
                playerId: player?.id || null,
                playerName: player?.name || null,
                playerColor: player?.color || null,
                ...clone(data),
            }],
            pending: null,
            resolved: false,
            nextPhase: null,
            nextPlayerId: null,
            ended: false,
            standings: null,
            winner: null,
        };
        return this.presentation;
    }
    _appendPresentationEvent(player, kind, data = {}) {
        if (!this.presentation) return this._startPresentation(player, kind, data);
        this.presentation.events.push({
            eventId: ++this.eventSequence,
            kind,
            playerId: player?.id || null,
            playerName: player?.name || null,
            playerColor: player?.color || null,
            ...clone(data),
        });
        return this.presentation;
    }
    _updatePresentation(values = {}) {
        if (this.presentation) Object.assign(this.presentation, clone(values));
    }
    _nextOnlineIndex(index) { for (let offset = 1; offset <= this.players.length; offset += 1) { const next = (index + offset) % this.players.length; if (this.players[next].isOnline) return next; } return index; }
    _draw() { return this.deck.pop() || null; }
    _shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(this.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
    _publicCell(cell) { return { id: cell.id, row: cell.row, col: cell.col, chain: cell.chain || null }; }
    getPublicState() { const settlementTurnId = this.phase === 'merger_settlement' ? this.pendingMerger?.queue?.[this.pendingMerger.queueIndex] : null; const current = settlementTurnId ? this.playerMap[settlementTurnId] : this.players[this.currentTurnIndex]; return { roomId: this.roomId, status: this.status, phase: this.phase, currentTurn: current?.id || null, currentTurnName: current?.name || null, deckCount: this.deck.length, endGamePending: this.endGamePending, rules: { boardRows: ROWS, boardCols: COLS, startingCash: STARTING_CASH, handSize: HAND_SIZE, maxBuy: MAX_BUY, safeChainSize: 11, endChainSize: 41, maxSharesPerChain: 25 }, board: Object.fromEntries(Object.entries(this.board).map(([id, cell]) => [id, this._publicCell(cell)])), corporations: Object.fromEntries(CHAINS.map(chain => { const corporation = this.corporations[chain.id]; return [chain.id, { id: chain.id, name: chain.name, short: chain.short, color: chain.color, active: corporation?.active || false, size: corporation?.tiles.length || 0, sharesAvailable: corporation?.sharesAvailable ?? 25, sharePrice: this._sharePrice(chain.id) }]; })), players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, cash: player.cash, shares: { ...player.shares }, handCount: player.hand.length, isOnline: player.isOnline, isCurrentTurn: player.id === current?.id })), pendingFoundation: this.pendingFoundation ? { playerId: this.pendingFoundation.playerId } : null, pendingMerger: this.pendingMerger ? { playerId: this.pendingMerger.playerId, chains: this.pendingMerger.chains || [] } : null, mergerSettlement: this.pendingMerger?.queueChainId ? { chainId: this.pendingMerger.queueChainId, currentPlayerId: this.pendingMerger.queue?.[this.pendingMerger.queueIndex] || null, survivingId: this.pendingMerger.survivingId } : null, lastAction: this.lastAction ? clone(this.lastAction) : null, actionLog: this.actionLog.slice(-18), presentation: this.presentation ? clone(this.presentation) : null, winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getPlayerState(playerId) { const state = this.getPublicState(); const player = this.playerMap[playerId]; const settlement = state.mergerSettlement?.currentPlayerId === playerId ? this.pendingMerger : null; state.myId = playerId; state.myHand = player?.hand.map(tile => ({ ...tile, permanentlyUnplayable: this._isPermanentlyUnplayable(tile) })) || []; state.myShares = player ? { ...player.shares } : {}; state.mergerSettlement = settlement ? { chainId: settlement.queueChainId, survivingId: settlement.survivingId, holding: player.shares[settlement.queueChainId] || 0 } : null; state.availableActions = { canPlace: Boolean(player?.isOnline && this.phase === 'place' && player.id === this.players[this.currentTurnIndex]?.id), canDiscard: Boolean(player?.isOnline && this.phase === 'place' && player.id === this.players[this.currentTurnIndex]?.id), canSkipPlacement: Boolean(player?.isOnline && this.phase === 'place' && player.id === this.players[this.currentTurnIndex]?.id && player.hand.every(tile => !this._isTilePlayable(tile))), canFound: Boolean(player?.isOnline && this.phase === 'foundation' && this.pendingFoundation?.playerId === playerId), canChooseMerger: Boolean(player?.isOnline && this.phase === 'merger' && this.pendingMerger?.playerId === playerId), canSettleMerger: Boolean(player?.isOnline && this.phase === 'merger_settlement' && this.pendingMerger?.queue?.[this.pendingMerger.queueIndex] === playerId), canBuy: Boolean(player?.isOnline && this.phase === 'buy' && player.id === this.players[this.currentTurnIndex]?.id), canEndGame: Boolean(player?.isOnline && this.phase === 'buy' && player.id === this.players[this.currentTurnIndex]?.id && !this.endGamePending && this._canEndGame()) }; return state; }
    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        player.isOnline = false;
        if (this.players.filter(item => item.isOnline).length < 2 && this.status === 'playing') return this._finishGameResult(`${player.name} 离开后，剩余玩家获胜`);
        if (player.id === this.players[this.currentTurnIndex]?.id && this.status === 'playing') {
            this.pendingFoundation = null; this.pendingMerger = null; this.pendingTile = null;
            if (this.phase === 'buy') this._buyShares(player, {});
            else { this.phase = 'place'; this._nextTurn(); }
        }
        this.actionLog.push(`${player.name} 离开了并购牌桌`);
        return this._success(`${player.name} 已离开`);
    }
    _finishGameResult(message) { this._finishGame(); return this._success(message); }
    _success(message) { this.lastAction = { message }; return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name } : null; }
}

module.exports = AcquireEngine;
module.exports.buildTiles = buildTiles;
module.exports.CHAINS = CHAINS;
module.exports.CHAIN_TIERS = CHAIN_TIERS;
