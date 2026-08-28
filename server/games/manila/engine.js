const GOODS = ['人参', '玉石', '肉豆蔻', '丝绸'];
const WARE_PROFITS = { 人参: 36, 玉石: 36, 肉豆蔻: 24, 丝绸: 24 };
const COLORS = ['#d45f54', '#4d82a6', '#bf8b3e', '#6d9466', '#80699b'];

const LOCATIONS = [
    { id: 'ginseng', name: '人参货船', kind: 'good', good: '人参', fees: [1, 2, 3], capacity: 3 },
    { id: 'jade', name: '玉石货船', kind: 'good', good: '玉石', fees: [3, 4, 5, 6], capacity: 4 },
    { id: 'nutmeg', name: '肉豆蔻货船', kind: 'good', good: '肉豆蔻', fees: [1, 2, 3], capacity: 3 },
    { id: 'silk', name: '丝绸货船', kind: 'good', good: '丝绸', fees: [1, 2, 3], capacity: 3 },
    { id: 'port-a', name: '港口 A', kind: 'port', fee: 4, payout: 6, capacity: 1, threshold: 1 },
    { id: 'port-b', name: '港口 B', kind: 'port', fee: 3, payout: 8, capacity: 1, threshold: 2 },
    { id: 'port-c', name: '港口 C', kind: 'port', fee: 2, payout: 15, capacity: 1, threshold: 3 },
    { id: 'shipyard-a', name: '船坞 A', kind: 'shipyard', fee: 4, payout: 6, capacity: 1, threshold: 1 },
    { id: 'shipyard-b', name: '船坞 B', kind: 'shipyard', fee: 3, payout: 8, capacity: 1, threshold: 2 },
    { id: 'shipyard-c', name: '船坞 C', kind: 'shipyard', fee: 2, payout: 15, capacity: 1, threshold: 3 },
    { id: 'pirate', name: '海盗船', kind: 'pirate', fee: 3, capacity: 2 },
    { id: 'pilot-small', name: '小领航员', kind: 'pilot', pilotSize: 'small', fee: 2, capacity: 1 },
    { id: 'pilot-large', name: '大领航员', kind: 'pilot', pilotSize: 'large', fee: 5, capacity: 1 },
    { id: 'insurance', name: '保险公司', kind: 'insurance', fee: 0, capacity: 1 },
];
const LOCATION_ALIASES = { pilot: 'pilot-small', shipyard: 'shipyard-a' };

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const roll = Number(random());
        const other = Math.min(index, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * (index + 1))));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

function locationId(id) { return LOCATION_ALIASES[id] || id; }

class ManilaEngine {
    constructor(roomId, players, random = Math.random) {
        this.roomId = roomId;
        this.random = random;
        const input = Array.isArray(players) ? players : [];
        this.players = input.map((player, index) => ({ id: player.id, name: player.name, color: COLORS[index], cash: 30, shares: [], encumberedShares: [], accomplices: 3, placed: [], isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.market = Object.fromEntries(GOODS.map(good => [good, 0]));
        this.shareDeck = [];
        this.shareMarket = Object.fromEntries(GOODS.map(good => [good, 5]));
        this.harborMasterId = null;
        this.voyage = 0;
        this.status = 'waiting';
        this.phase = 'waiting';
        this.auction = null;
        this.masterStep = null;
        this.boats = [];
        this.placementRound = 0;
        this.placementRounds = 3;
        this.placementTurnIndex = 0;
        this.passed = new Set();
        this.locations = {};
        this.actionLog = [];
        this.lastVoyage = null;
        this.winner = null;
        this.movementRound = 0;
        this.movementPlan = null;
        this.movementAfter = null;
        this.lastMovement = null;
        this.arrivalCounter = 0;
        this.pilotQueue = [];
        this.pilotIndex = 0;
        this.pirateQueue = [];
        this.pirateIndex = 0;
        this.plunderQueue = [];
        this.plunderIndex = 0;
        this.voyageHistory = [];
        this.winners = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '马尼拉已经开始或已经结束' };
        if (this.players.length < 3 || this.players.length > 5) return { success: false, message: '马尼拉需要 3–5 名玩家' };
        if (this.players.some(player => !player.id) || new Set(this.players.map(player => player.id)).size !== this.players.length) return { success: false, message: '玩家身份必须唯一且有效' };
        this.players.forEach(player => { player.cash = 30; player.shares = []; player.encumberedShares = []; player.accomplices = this.players.length === 3 ? 4 : 3; player.placed = []; player.isOnline = true; });
        this.market = Object.fromEntries(GOODS.map(good => [good, 0]));
        this.shareDeck = shuffle(GOODS.flatMap(good => Array.from({ length: 5 }, () => good)), this.random);
        this.shareMarket = Object.fromEntries(GOODS.map(good => [good, 5]));
        this.players.forEach(player => { player.shares = [this.shareDeck.pop(), this.shareDeck.pop()]; player.shares.forEach(good => { this.shareMarket[good] -= 1; }); });
        this.harborMasterId = this.players[0].id;
        this.voyage = 1;
        this.status = 'playing';
        this.phase = 'waiting';
        this.actionLog = ['马尼拉商人们领取资本、股份和帮手'];
        this.lastVoyage = null; this.voyageHistory = []; this.winner = null; this.winners = []; this.finalFortunes = null; this.presentation = null; this.presentationSequence = 0; this.presentationEventSequence = 0;
        this._beginAuction();
        this._appendPresentationEvent({
            kind: 'voyageStarted',
            voyage: this.voyage,
            harborMasterId: this.harborMasterId,
            harborMasterName: this.playerMap[this.harborMasterId]?.name || '',
            seasonOpening: true,
            startingCash: 30,
            privateSharesEach: 2,
            accomplicesEach: this.players.length === 3 ? 4 : 3,
        });
        this._finishPresentation();
        return this._success('马尼拉开始');
    }

    _beginAuction() { this.phase = 'auction'; this.auction = { currentIndex: this.players.findIndex(player => player.id === this.harborMasterId), highestBid: 0, highestBidder: null, passed: new Set(), bids: {} }; this._log(`第 ${this.voyage} 次航行：竞选港务长`); }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (action.kind === 'takeLoan') return this._takeLoan(player, action);
        if (action.kind === 'repayLoan') return this._repayLoan(player, action);
        if (this.phase === 'auction') return this._auctionAction(player, action);
        if (this.phase === 'master') return this._masterAction(player, action);
        if (this.phase === 'placement') return this._placementAction(player, action);
        if (this.phase === 'sailing') return this._sailingAction(player, action);
        if (this.phase === 'pilot') return this._pilotAction(player, action);
        if (this.phase === 'pirateBoard') return this._pirateBoardAction(player, action);
        if (this.phase === 'plunder') return this._plunderAction(player, action);
        return { success: false, message: '当前阶段不能操作', state: this.getPlayerState(playerId) };
    }

    _availableLoans(player) { return player.shares.reduce((count, _, index) => count + (player.encumberedShares.includes(index) ? 0 : 1), 0); }

    _raiseFunds(player, amount) {
        while (player.cash < amount) {
            const index = player.shares.findIndex((_, shareIndex) => !player.encumberedShares.includes(shareIndex));
            if (index < 0) break;
            player.encumberedShares.push(index);
            player.cash += 12;
            this._log(`${player.name} 抵押一张股份，借得 12 比索`);
        }
        return player.cash >= amount;
    }

    _takeLoan(player, action) {
        const index = Number.isInteger(Number(action.shareIndex)) ? Number(action.shareIndex) : player.shares.findIndex((_, shareIndex) => !player.encumberedShares.includes(shareIndex));
        if (index < 0 || index >= player.shares.length || player.encumberedShares.includes(index)) return { success: false, message: '没有可抵押的未抵押股份', state: this.getPlayerState(player.id) };
        player.encumberedShares.push(index);
        player.cash += 12;
        this._startPresentation(player.id, 'takeLoan', { kind: 'loanTaken', actorId: player.id, actorName: player.name, amount: 12, cashAfter: player.cash, encumberedCount: player.encumberedShares.length });
        this._finishPresentation();
        return this._success(`${player.name} 抵押了${player.shares[index]}股份`);
    }

    _repayLoan(player, action) {
        const index = Number(action.shareIndex);
        if (!Number.isInteger(index) || !player.encumberedShares.includes(index) || player.cash < 15) return { success: false, message: '需要选择已抵押股份且拥有 15 比索', state: this.getPlayerState(player.id) };
        player.cash -= 15;
        player.encumberedShares = player.encumberedShares.filter(shareIndex => shareIndex !== index);
        this._startPresentation(player.id, 'repayLoan', { kind: 'loanRepaid', actorId: player.id, actorName: player.name, amount: 15, cashAfter: player.cash, encumberedCount: player.encumberedShares.length });
        this._finishPresentation();
        return this._success(`${player.name} 偿还贷款，恢复一张股份`);
    }

    _auctionAction(player, action) {
        const current = this.players[this.auction.currentIndex];
        if (!current || current.id !== player.id) return { success: false, message: '等待其他玩家竞价', state: this.getPlayerState(player.id) };
        if (this.auction.passed.has(player.id)) return { success: false, message: '你已经放弃本轮竞价', state: this.getPlayerState(player.id) };
        if (action.kind === 'pass') {
            this.auction.passed.add(player.id);
            this._startPresentation(player.id, 'auction', { kind: 'auctionPassed', actorId: player.id, actorName: player.name, highestBid: this.auction.highestBid, remaining: this.players.length - this.auction.passed.size });
        }
        else if (action.kind === 'bid') {
            const bid = Number(action.amount);
            if (!Number.isInteger(bid) || bid < 1 || bid <= this.auction.highestBid || bid > player.cash + this._availableLoans(player) * 12) return { success: false, message: '出价必须高于当前最高价且不能超过现金与可抵押额度', state: this.getPlayerState(player.id) };
            // Keep bids as commitments until the auction closes.  Losing bids
            // are therefore never charged, while the winner pays exactly once.
            this.auction.bids[player.id] = bid;
            this.auction.highestBid = bid;
            this.auction.highestBidder = player.id;
            this._startPresentation(player.id, 'auction', { kind: 'auctionBid', actorId: player.id, actorName: player.name, amount: bid, cash: player.cash, mortgageCapacity: this._availableLoans(player) * 12 });
        } else return { success: false, message: '请选择出价或放弃', state: this.getPlayerState(player.id) };
        this._advanceAuction();
        this._finishPresentation();
        return this._success('竞价更新');
    }

    _advanceAuction() {
        const eligible = this.players.filter(player => !this.auction.passed.has(player.id));
        if (eligible.length <= 1) {
            const previousMasterId = this.harborMasterId;
            const winner = this.auction.highestBidder ? this.playerMap[this.auction.highestBidder] : this.playerMap[this.harborMasterId];
            const cashBefore = winner.cash;
            const mortgagesBefore = winner.encumberedShares.length;
            const winningBid = this.auction.highestBid;
            if (this.auction.highestBidder) {
                if (!this._raiseFunds(winner, this.auction.highestBid)) {
                    // This can only happen if the winner spent money after
                    // bidding; reject the auction rather than creating debt.
                    this._log(`${winner.name} 无法支付最高出价，港务长职位由上一任保留`);
                    this.auction.highestBid = 0; this.auction.highestBidder = null;
                    this.harborMasterId = this.playerMap[this.harborMasterId].id;
                } else {
                    winner.cash -= this.auction.highestBid;
                    this._log(`${winner.name} 支付 ${this.auction.highestBid} 比索成为港务长`);
                    this.harborMasterId = winner.id;
                }
            } else this.harborMasterId = winner.id;
            this._appendPresentationEvent({ kind: 'harborMasterAppointed', playerId: this.harborMasterId, playerName: this.playerMap[this.harborMasterId]?.name || '', previousMasterId, winningBid: this.auction.highestBidder ? winningBid : 0, cashBefore, cashAfter: winner.cash, mortgagesAdded: Math.max(0, winner.encumberedShares.length - mortgagesBefore) });
            this._beginMaster(); return;
        }
        do this.auction.currentIndex = (this.auction.currentIndex + 1) % this.players.length; while (this.auction.passed.has(this.players[this.auction.currentIndex].id));
    }

    _beginMaster() { this.phase = 'master'; this.masterStep = 'buyShare'; this.boats = []; this._log(`${this.playerMap[this.harborMasterId].name} 成为港务长，可买一张股份后安排三艘船`); }

    _masterAction(player, action) {
        if (player.id !== this.harborMasterId) return { success: false, message: '只有港务长能安排航行', state: this.getPlayerState(player.id) };
        if (this.masterStep === 'buyShare') {
            if (action.kind === 'buyShare') {
                const good = action.good;
                const price = Math.max(5, this.market[good] || 0);
                const cashBefore = player.cash; const mortgagesBefore = player.encumberedShares.length;
                if (!GOODS.includes(good) || this.shareMarket[good] <= 0 || !this._raiseFunds(player, price)) return { success: false, message: '该股份不可购买或现金不足', state: this.getPlayerState(player.id) };
                player.cash -= price; player.shares.push(good); this.shareMarket[good] -= 1; this.masterStep = 'plan';
                this._startPresentation(player.id, 'buyShare', { kind: 'sharePurchased', actorId: player.id, actorName: player.name, good, price, cashBefore, cashAfter: player.cash, mortgagesAdded: Math.max(0, player.encumberedShares.length - mortgagesBefore) }); this._finishPresentation();
                return this._success(`港务长购买了${good}股份`);
            }
            if (action.kind === 'skipShare') { this.masterStep = 'plan'; this._startPresentation(player.id, 'skipShare', { kind: 'sharePurchaseSkipped', actorId: player.id, actorName: player.name }); this._finishPresentation(); return this._success('港务长跳过买股'); }
            if (action.kind !== 'setBoats') return { success: false, message: '港务长可买一张股份，或跳过购买', state: this.getPlayerState(player.id) };
            this.masterStep = 'plan';
        }
        if (action.kind !== 'setBoats') return { success: false, message: '请一次提交三艘船的货物和起点', state: this.getPlayerState(player.id) };
        const boats = Array.isArray(action.boats) ? action.boats : [];
        if (boats.length !== 3 || new Set(boats.map(boat => boat.good)).size !== 3 || boats.some(boat => !GOODS.includes(boat.good) || !Number.isInteger(Number(boat.start)) || Number(boat.start) < 0 || Number(boat.start) > 5) || boats.reduce((sum, boat) => sum + Number(boat.start), 0) !== 9) return { success: false, message: '三艘船必须装不同货物，起点为 0–5 且总和为 9', state: this.getPlayerState(player.id) };
        this.boats = boats.map((boat, index) => ({ id: index + 1, good: boat.good, position: Number(boat.start), fate: 'sailing', arrived: false, placements: [], pirates: [], finishOrder: null }));
        this._startPresentation(player.id, 'setBoats', { kind: 'fleetPlanned', actorId: player.id, actorName: player.name, boats: this.boats.map(boat => ({ id: boat.id, good: boat.good, start: boat.position })) });
        this._beginPlacement();
        this._finishPresentation();
        return this._success('港务长已完成装船和放船');
    }

    _beginPlacement() {
        this.phase = 'placement'; this.placementRound = 1; this.placementRounds = this.players.length === 3 ? 4 : 3; this.placementTurnIndex = this.players.findIndex(player => player.id === this.harborMasterId); this.passed = new Set(); this.locations = Object.fromEntries(LOCATIONS.map(location => [location.id, []])); this.movementRound = 0; this.movementPlan = null; this.movementAfter = null; this.lastMovement = null; this.arrivalCounter = 0; this._log(`商人们开始安插帮手，共 ${this.placementRounds} 轮`);
    }

    _location(id) { return LOCATIONS.find(location => location.id === locationId(id)); }

    _placementAction(player, action) {
        const current = this.players[this.placementTurnIndex];
        if (!current || current.id !== player.id) return { success: false, message: '等待轮到你的安插行动', state: this.getPlayerState(player.id) };
        if (this.passed.has(player.id)) return { success: false, message: '你本次航行已经跳过', state: this.getPlayerState(player.id) };
        if (action.kind === 'passPlacement') {
            this.passed.add(player.id);
            this._startPresentation(player.id, 'placement', { kind: 'placementPassed', actorId: player.id, actorName: player.name, placementRound: this.placementRound });
        }
        else if (action.kind === 'placeAccomplice') {
            const id = locationId(action.location); const location = this._location(id);
            if (!location || !this.locations[id] || this.locations[id].length >= location.capacity || player.accomplices <= 0) return { success: false, message: '这个位置不能安插帮手', state: this.getPlayerState(player.id) };
            let boat = null; let fee = location.fee;
            if (location.kind === 'good') {
                boat = this.boats.find(candidate => candidate.good === location.good);
                if (!boat || boat.fate !== 'sailing' || boat.placements.length >= location.capacity) return { success: false, message: '该货船未装载、已抵达或已经没有空位', state: this.getPlayerState(player.id) };
                fee = location.fees[boat.placements.length];
            }
            const cashBefore = player.cash; const mortgagesBefore = player.encumberedShares.length; const accomplicesBefore = player.accomplices;
            if (location.kind !== 'insurance' && !this._raiseFunds(player, fee)) {
                // Official blind-passenger rule: when a player cannot raise
                // the cheapest cargo fee, a cargo-space placement is still
                // legal and consumes all remaining cash (possibly zero).
                if (location.kind !== 'good') return { success: false, message: '现金和可抵押股份不足，不能安插到这里', state: this.getPlayerState(player.id) };
                fee = player.cash;
            }
            player.cash -= fee; if (location.kind === 'insurance') player.cash += 10;
            const stake = { playerId: player.id, fee, slot: this.locations[id].length + 1 };
            this.locations[id].push(stake); player.placed.push({ location: id, fee }); player.accomplices -= 1;
            if (boat) boat.placements.push({ playerId: player.id, fee });
            this._startPresentation(player.id, 'placement', { kind: 'accomplicePlaced', actorId: player.id, actorName: player.name, locationId: id, locationName: location.name, locationKind: location.kind, good: location.good || null, boatId: boat?.id || null, fee, cashBefore, cashAfter: player.cash, mortgagesAdded: Math.max(0, player.encumberedShares.length - mortgagesBefore), blindPassenger: location.kind === 'good' && fee < (location.fees[stake.slot - 1] ?? fee), insuranceAdvance: location.kind === 'insurance' ? 10 : 0, slot: stake.slot, capacity: location.capacity, accomplicesBefore, accomplicesAfter: player.accomplices });
        } else return { success: false, message: '请选择安插位置或跳过', state: this.getPlayerState(player.id) };
        this._advancePlacement();
        this._finishPresentation();
        return this._success('安插行动完成');
    }

    _advancePlacement() {
        this.placementTurnIndex = (this.placementTurnIndex + 1) % this.players.length;
        if (this.placementTurnIndex !== this.players.findIndex(player => player.id === this.harborMasterId)) return;
        const firstMovementRound = this.players.length === 3 ? 2 : 1;
        if (this.placementRound < firstMovementRound) { this.placementRound += 1; this.passed = new Set(); this._log(`第 ${this.placementRound} 轮安插开始`); return; }
        if (this.placementRound === this.placementRounds) { this._beginPilots(); return; }
        this._beginSailing('nextPlacement');
    }

    _beginPilots() {
        this.pilotQueue = [];
        for (const id of ['pilot-small', 'pilot-large']) { const stake = this.locations[id]?.[0]; if (stake) this.pilotQueue.push({ ...stake, location: id, pilotSize: id === 'pilot-small' ? 'small' : 'large' }); }
        this.pilotIndex = 0;
        if (!this.pilotQueue.length) { this._beginSailing('finishMovement'); return; }
        this.phase = 'pilot'; this._appendPresentationEvent({ kind: 'pilotPhaseStarted', pilots: this.pilotQueue.map(pilot => ({ playerId: pilot.playerId, playerName: this.playerMap[pilot.playerId]?.name || '', size: pilot.pilotSize })) }); this._log('领航员在第三次掷骰前决定是否影响航线');
    }

    _pilotAction(player, action) {
        const pilot = this.pilotQueue[this.pilotIndex];
        if (!pilot || pilot.playerId !== player.id) return { success: false, message: '等待当前领航员决定', state: this.getPlayerState(player.id) };
        if (action.kind === 'skipPilot') {
            this._startPresentation(player.id, 'pilot', { kind: 'pilotSkipped', actorId: player.id, actorName: player.name, pilotSize: pilot.pilotSize });
            const result = this._advancePilot(); this._finishPresentation(); return result;
        }
        if (action.kind !== 'pilotMove') return { success: false, message: '请选择领航员移动或跳过', state: this.getPlayerState(player.id) };
        const moves = Array.isArray(action.moves) ? action.moves : [];
        const expected = pilot.pilotSize === 'small' ? 1 : (moves.length === 1 ? 1 : 2);
        if (moves.length !== expected || moves.some(move => !Number.isInteger(Number(move.boatId)) || ![-2, -1, 1, 2].includes(Number(move.delta)))) return { success: false, message: '领航员移动参数不合法', state: this.getPlayerState(player.id) };
        if (pilot.pilotSize === 'small' && Math.abs(Number(moves[0].delta)) !== 1) return { success: false, message: '小领航员只能移动一格', state: this.getPlayerState(player.id) };
        if (pilot.pilotSize === 'large' && moves.length === 2 && moves.some(move => Math.abs(Number(move.delta)) !== 1)) return { success: false, message: '大领航员可移动两艘船各一格', state: this.getPlayerState(player.id) };
        if (pilot.pilotSize === 'large' && moves.length === 1 && Math.abs(Number(moves[0].delta)) > 2) return { success: false, message: '大领航员可移动一艘船一至两格', state: this.getPlayerState(player.id) };
        const ids = new Set();
        for (const move of moves) { const boat = this.boats.find(candidate => candidate.id === Number(move.boatId)); if (!boat || boat.fate !== 'sailing' || ids.has(boat.id) || boat.position + Number(move.delta) < 0) return { success: false, message: '该船已抵达或移动位置不合法', state: this.getPlayerState(player.id) }; ids.add(boat.id); }
        const movement = moves.map(move => { const boat = this.boats.find(candidate => candidate.id === Number(move.boatId)); return { boatId: boat.id, good: boat.good, delta: Number(move.delta), from: boat.position, to: boat.position + Number(move.delta) }; });
        moves.forEach(move => this._pilotMoveBoat(Number(move.boatId), Number(move.delta)));
        movement.forEach(item => { const boat = this.boats.find(candidate => candidate.id === item.boatId); item.to = boat.position; item.fate = boat.fate; });
        this._startPresentation(player.id, 'pilot', { kind: 'pilotMoved', actorId: player.id, actorName: player.name, pilotSize: pilot.pilotSize, moves: movement });
        const result = this._advancePilot(); this._finishPresentation(); return result;
    }

    _pilotMoveBoat(boatId, delta) { const boat = this.boats.find(candidate => candidate.id === boatId); if (!boat || boat.fate !== 'sailing') return; boat.position += delta; if (boat.position > 13) this._arriveBoat(boat); }

    _advancePilot() { this.pilotIndex += 1; if (this.pilotIndex < this.pilotQueue.length) return this._success('领航员行动完成，等待下一位领航员'); this._beginSailing('finishMovement'); return this._success('领航员行动完成，等待港务长行船'); }

    _arriveBoat(boat) { if (boat.fate !== 'sailing') return; boat.fate = 'port'; boat.arrived = true; boat.position = 14; boat.finishOrder = ++this.arrivalCounter; }

    _beginSailing(after) {
        this.movementRound += 1;
        const sailing = this.boats.filter(boat => boat.fate === 'sailing');
        this.movementAfter = after;
        if (!sailing.length) { this.movementPlan = null; this._completeMovement(after); return; }
        const rolls = sailing.map(boat => {
            const roll = Math.floor(Math.max(0, Math.min(0.999999, Number(this.random()) || 0)) * 6) + 1;
            return { boatId: boat.id, good: boat.good, roll, from: boat.position, projected: Math.min(14, boat.position + roll) };
        });
        this.movementPlan = { round: this.movementRound, rolls };
        this.phase = 'sailing';
        this._appendPresentationEvent({ kind: 'sailingRolled', round: this.movementRound, rolls: rolls.map(item => ({ ...item })), harborMasterId: this.harborMasterId, harborMasterName: this.playerMap[this.harborMasterId]?.name || '' });
        this._log(`第 ${this.movementRound} 轮行船骰点：${rolls.map(item => `${item.good} ${item.roll}`).join('、')}；等待港务长决定顺序`);
    }

    _sailingAction(player, action) {
        if (player.id !== this.harborMasterId) return { success: false, message: '只有港务长能决定行船顺序', state: this.getPlayerState(player.id) };
        if (action.kind !== 'sailBoats' || !this.movementPlan) return { success: false, message: '请选择本轮货船的移动顺序', state: this.getPlayerState(player.id) };
        const expected = this.movementPlan.rolls.map(item => item.boatId);
        const order = Array.isArray(action.order) ? action.order.map(Number) : [];
        if (order.length !== expected.length || new Set(order).size !== expected.length || expected.some(id => !order.includes(id))) return { success: false, message: '行船顺序必须包含本轮全部未到港货船，且不能重复', state: this.getPlayerState(player.id) };
        const moves = [];
        const pirateCandidates = [];
        for (const boatId of order) {
            const die = this.movementPlan.rolls.find(item => item.boatId === boatId);
            const boat = this.boats.find(candidate => candidate.id === boatId);
            if (!die || !boat || boat.fate !== 'sailing') return { success: false, message: '货船状态已经变化，请重新选择顺序', state: this.getPlayerState(player.id) };
            const from = boat.position;
            boat.position += die.roll;
            if (boat.position > 13) this._arriveBoat(boat);
            else if (boat.position === 13 && this.movementRound === 2) pirateCandidates.push(boat);
            moves.push({ boatId: boat.id, good: boat.good, roll: die.roll, from, to: boat.position, fate: boat.fate });
            this._log(`${boat.good}船按骰点 ${die.roll}，从 ${from} 格驶至 ${boat.position > 13 ? '马尼拉' : `${boat.position} 格`}`);
        }
        const after = this.movementAfter;
        this.lastMovement = { round: this.movementRound, moves };
        this._startPresentation(player.id, 'sailBoats', { kind: 'boatsSailed', actorId: player.id, actorName: player.name, round: this.movementRound, order: order.slice(), moves: moves.map(move => ({ ...move })) });
        this.movementPlan = null;
        this.movementAfter = null;
        if (this.movementRound === 2 && pirateCandidates.length && this.locations.pirate?.length) {
            this._beginPirateBoard(pirateCandidates, after);
            this._finishPresentation();
            return this._success('货船已移动，等待海盗决定是否登船');
        }
        this._completeMovement(after);
        this._finishPresentation();
        return this._success('本轮行船完成');
    }

    _completeMovement(after) {
        if (after === 'nextPlacement') { this.phase = 'placement'; this.placementRound += 1; this.passed = new Set(); this._appendPresentationEvent({ kind: 'placementResumed', placementRound: this.placementRound }); this._log(`第 ${this.placementRound} 轮安插开始`); return; }
        this._finishMovement();
    }

    _beginPirateBoard(boats, after) { this.pirateQueue = this.locations.pirate.map(stake => ({ ...stake, boats: boats.map(boat => boat.id) })); this.pirateIndex = 0; this.pirateAfter = after; if (!this.pirateQueue.length) return this._completeMovement(after); this.phase = 'pirateBoard'; this._appendPresentationEvent({ kind: 'pirateAlert', boats: boats.map(boat => ({ id: boat.id, good: boat.good, position: boat.position })), pirates: this.pirateQueue.map(pirate => ({ playerId: pirate.playerId, playerName: this.playerMap[pirate.playerId]?.name || '' })) }); this._log('海盗可以登上停在 13 格的船'); }

    _pirateBoardAction(player, action) {
        const pirate = this.pirateQueue[this.pirateIndex];
        if (!pirate || pirate.playerId !== player.id) return { success: false, message: '等待当前海盗决定', state: this.getPlayerState(player.id) };
        if (action.kind === 'boardPirate') {
            const boat = this.boats.find(candidate => candidate.id === Number(action.boatId) && pirate.boats.includes(candidate.id) && candidate.position === 13 && candidate.fate === 'sailing');
            const capacity = boat?.good === '玉石' ? 4 : 3;
            if (!boat || boat.placements.length + boat.pirates.length >= capacity) return { success: false, message: '这艘船没有可供海盗登船的空位', state: this.getPlayerState(player.id) };
            this.locations.pirate = this.locations.pirate.filter(stake => stake.playerId !== pirate.playerId);
            boat.pirates.push({ playerId: pirate.playerId, fee: pirate.fee });
            this._startPresentation(player.id, 'pirateBoard', { kind: 'pirateBoarded', actorId: player.id, actorName: player.name, boatId: boat.id, good: boat.good, position: boat.position, accomplices: boat.placements.map(stake => ({ playerId: stake.playerId, playerName: this.playerMap[stake.playerId]?.name || '' })), pirateCount: boat.pirates.length });
            this._log(`${this.playerMap[pirate.playerId].name} 登上${boat.good}船`);
        } else if (action.kind === 'skipPirate') this._startPresentation(player.id, 'pirateBoard', { kind: 'pirateStayed', actorId: player.id, actorName: player.name });
        else return { success: false, message: '请选择登船或跳过', state: this.getPlayerState(player.id) };
        this.pirateIndex += 1;
        if (this.pirateIndex < this.pirateQueue.length) { this._finishPresentation(); return this._success('海盗决定已记录'); }
        const after = this.pirateAfter; this.pirateAfter = null; this._completeMovement(after); this._finishPresentation(); return this._success('海盗登船阶段结束');
    }

    _finishMovement() {
        const candidates = [];
        for (const boat of this.boats) {
            if (boat.fate === 'sailing' && boat.position === 13) {
                const pirates = [...(this.locations.pirate || []), ...(boat.pirates || [])];
                if (pirates.length) { boat.fate = 'pirated'; candidates.push(boat); } else this._arriveBoat(boat);
            }
        }
        for (const boat of this.boats) if (boat.fate === 'sailing') { boat.fate = 'shipyard'; boat.finishOrder = ++this.arrivalCounter; }
        this.plunderQueue = candidates.map(boat => ({ boatId: boat.id, playerId: (boat.pirates[0] || this.locations.pirate?.[0])?.playerId })).filter(item => item.playerId);
        this.plunderIndex = 0;
        if (this.plunderQueue.length) { this.phase = 'plunder'; this._appendPresentationEvent({ kind: 'plunderPhaseStarted', boats: this.plunderQueue.map(item => { const boat = this.boats.find(candidate => candidate.id === item.boatId); return { boatId: item.boatId, good: boat?.good || '', captainId: item.playerId, captainName: this.playerMap[item.playerId]?.name || '' }; }) }); this._log('海盗船长决定被掠夺船只的去向'); return; }
        this._settleVoyage();
    }

    _plunderAction(player, action) {
        const pending = this.plunderQueue[this.plunderIndex];
        if (!pending || pending.playerId !== player.id) return { success: false, message: '等待对应海盗船长决定', state: this.getPlayerState(player.id) };
        if (action.kind !== 'plunderDestination' || !['port', 'shipyard'].includes(action.destination)) return { success: false, message: '请选择将掠夺船只送往港口或船坞', state: this.getPlayerState(player.id) };
        const boat = this.boats.find(candidate => candidate.id === pending.boatId); boat.fate = action.destination; boat.plundered = true; boat.finishOrder = ++this.arrivalCounter; this.plunderIndex += 1;
        const piratePlayers = [...(this.locations.pirate || []), ...(boat.pirates || [])];
        this._startPresentation(player.id, 'plunder', { kind: 'plunderResolved', actorId: player.id, actorName: player.name, boatId: boat.id, good: boat.good, destination: action.destination, cargoAccomplices: boat.placements.map(stake => ({ playerId: stake.playerId, playerName: this.playerMap[stake.playerId]?.name || '' })), pirates: piratePlayers.map(stake => ({ playerId: stake.playerId, playerName: this.playerMap[stake.playerId]?.name || '' })), estimatedShare: Math.floor((WARE_PROFITS[boat.good] || 24) / Math.max(1, piratePlayers.length)) });
        if (this.plunderIndex < this.plunderQueue.length) { this._finishPresentation(); return this._success('掠夺去向已记录'); }
        this._settleVoyage(); this._finishPresentation(); return this._success('掠夺结算完成');
    }

    _payOut(player, amount, payer = null) { if (!player || amount <= 0) return; if (payer) { if (payer.cash < amount) this._raiseFunds(payer, amount); const paid = Math.min(payer.cash, amount); payer.cash -= paid; player.cash += paid; } else player.cash += amount; }

    _settleVoyage() {
        const payouts = [];
        const payoutDetails = [];
        const marketBefore = { ...this.market };
        const cashBefore = Object.fromEntries(this.players.map(player => [player.id, player.cash]));
        const portBoats = this.boats.filter(boat => boat.fate === 'port').sort((a, b) => a.finishOrder - b.finishOrder);
        const yardBoats = this.boats.filter(boat => boat.fate === 'shipyard').sort((a, b) => a.finishOrder - b.finishOrder);
        portBoats.forEach((boat, index) => { boat.portIndex = index + 1; }); yardBoats.forEach((boat, index) => { boat.shipyardIndex = index + 1; });
        const pirates = [...(this.locations.pirate || [])];
        for (const boat of this.boats) {
            if (boat.plundered) {
                const piratePlayers = [...pirates, ...(boat.pirates || [])]; const share = Math.floor((WARE_PROFITS[boat.good] || 24) / Math.max(1, piratePlayers.length));
                piratePlayers.forEach(stake => { const target = this.playerMap[stake.playerId]; target.cash += share; payouts.push(`${target.name} 作为海盗从${boat.good}船获得 ${share} 比索`); payoutDetails.push({ kind: 'pirate', sourceId: `boat-${boat.id}`, boatId: boat.id, good: boat.good, playerId: target.id, playerName: target.name, amount: share, payerId: null }); });
            }
            if (boat.fate === 'port') {
                const cargoId = { 人参: 'ginseng', 玉石: 'jade', 肉豆蔻: 'nutmeg', 丝绸: 'silk' }[boat.good];
                const cargoStakes = boat.placements.length ? boat.placements : (this.locations[cargoId] || []);
                // A pirate may send the punt to port, but plunder removes all
                // cargo accomplices without paying them their normal profit.
                if (!boat.plundered && cargoStakes.length) { const each = Math.floor((WARE_PROFITS[boat.good] || 24) / cargoStakes.length); cargoStakes.forEach(stake => { const target = this.playerMap[stake.playerId]; target.cash += each; payouts.push(`${target.name} 从${boat.good}船获得 ${each} 比索`); payoutDetails.push({ kind: 'cargo', sourceId: `boat-${boat.id}`, boatId: boat.id, good: boat.good, playerId: target.id, playerName: target.name, amount: each, payerId: null }); }); }
                this.market[boat.good] = Math.min(30, this.market[boat.good] + 5);
            }
        }
        ['port-a', 'port-b', 'port-c'].forEach((id, index) => { const boat = portBoats[index]; if (!boat) return; const location = this._location(id); (this.locations[id] || []).forEach(stake => { const target = this.playerMap[stake.playerId]; target.cash += location.payout; payouts.push(`${target.name} 在${location.name}获得 ${location.payout} 比索`); payoutDetails.push({ kind: 'port', sourceId: id, boatId: boat.id, good: boat.good, playerId: target.id, playerName: target.name, amount: location.payout, payerId: null }); }); });
        const insurancePlayer = this.locations.insurance?.[0] ? this.playerMap[this.locations.insurance[0].playerId] : null;
        ['shipyard-a', 'shipyard-b', 'shipyard-c'].forEach((id, index) => {
            const boat = yardBoats[index]; if (!boat) return; const location = this._location(id); const stakes = this.locations[id] || [];
            if (stakes.length) stakes.forEach(stake => { const target = this.playerMap[stake.playerId]; const before = target.cash; this._payOut(target, location.payout, insurancePlayer); const paid = target.cash - before; payouts.push(`${target.name} 在${location.name}获得 ${paid} 比索`); payoutDetails.push({ kind: 'shipyard', sourceId: id, boatId: boat.id, good: boat.good, playerId: target.id, playerName: target.name, amount: paid, payerId: insurancePlayer?.id || null, payerName: insurancePlayer?.name || null }); });
            else if (insurancePlayer) { this._raiseFunds(insurancePlayer, location.payout); const paid = Math.min(insurancePlayer.cash, location.payout); insurancePlayer.cash -= paid; payoutDetails.push({ kind: 'insuranceLoss', sourceId: id, boatId: boat.id, good: boat.good, playerId: insurancePlayer.id, playerName: insurancePlayer.name, amount: -paid, payerId: insurancePlayer.id }); }
        });
        this.players.forEach(player => { player.accomplices += player.placed.length; player.placed = []; });
        const boatsSnapshot = this.boats.map(boat => ({ id: boat.id, good: boat.good, position: boat.position, arrived: boat.fate === 'port', fate: boat.fate, plundered: Boolean(boat.plundered), portIndex: boat.portIndex || null, shipyardIndex: boat.shipyardIndex || null }));
        const cashAfter = Object.fromEntries(this.players.map(player => [player.id, player.cash]));
        const marketAfter = { ...this.market };
        this.lastVoyage = { voyage: this.voyage, boats: boatsSnapshot, payouts, payoutDetails, marketBefore, marketAfter, players: this.players.map(player => ({ id: player.id, name: player.name, cashBefore: cashBefore[player.id], cashAfter: cashAfter[player.id], gained: cashAfter[player.id] - cashBefore[player.id] })) };
        this.voyageHistory.push(clone(this.lastVoyage));
        this._appendPresentationEvent({ kind: 'voyageSettlement', ...clone(this.lastVoyage) });
        payouts.forEach(message => this._log(message));
        if (Object.values(this.market).some(value => value >= 30)) {
            this._appendPresentationEvent({
                kind: 'marketThresholdReached',
                goods: GOODS.filter(good => this.market[good] >= 30).map(good => ({ good, before: marketBefore[good], after: this.market[good] })),
            });
            this._finish();
            return;
        }
        this.voyage += 1; this._beginAuction(); this._appendPresentationEvent({ kind: 'voyageStarted', voyage: this.voyage, harborMasterId: this.harborMasterId, harborMasterName: this.playerMap[this.harborMasterId]?.name || '' }); this._finishPresentation();
    }

    _finish() {
        this.status = 'ended'; this.phase = 'ended';
        const ranked = this.players.map(player => ({ player, fortune: player.cash + player.shares.reduce((sum, good) => sum + this.market[good], 0) - player.encumberedShares.length * 15 })).sort((a, b) => b.fortune - a.fortune);
        this.winner = ranked[0]?.player || null; this.winners = ranked.filter(item => item.fortune === (ranked[0]?.fortune ?? 0)).map(item => item.player); this.finalFortunes = Object.fromEntries(ranked.map(item => [item.player.id, item.fortune]));
        this._appendPresentationEvent({ kind: 'finalSettlement', standings: ranked.map(item => ({ id: item.player.id, name: item.player.name, color: item.player.color, cash: item.player.cash, shareValue: item.player.shares.reduce((sum, good) => sum + this.market[good], 0), loanPenalty: item.player.encumberedShares.length * 15, fortune: item.fortune })), winnerIds: this.winners.map(player => player.id), market: { ...this.market }, voyageHistory: this.voyageHistory.map(entry => ({ voyage: entry.voyage, players: entry.players.map(player => ({ ...player })) })) }); this._finishPresentation();
        this._log(`${this.winner?.name || '无人'} 以 ${ranked[0]?.fortune || 0} 财富获胜`);
    }

    getPublicState() {
        let current = null;
        if (this.phase === 'auction') current = this.players[this.auction.currentIndex];
        if (this.phase === 'placement') current = this.players[this.placementTurnIndex];
        if (this.phase === 'sailing') current = this.playerMap[this.harborMasterId];
        if (this.phase === 'pilot') current = this.playerMap[this.pilotQueue[this.pilotIndex]?.playerId];
        if (this.phase === 'pirateBoard') current = this.playerMap[this.pirateQueue[this.pirateIndex]?.playerId];
        if (this.phase === 'plunder') current = this.playerMap[this.plunderQueue[this.plunderIndex]?.playerId];
        const pendingPlunderEntry = this.phase === 'plunder' ? this.plunderQueue[this.plunderIndex] : null;
        const pendingPlunderBoat = pendingPlunderEntry ? this.boats.find(boat => boat.id === pendingPlunderEntry.boatId) : null;
        return {
            roomId: this.roomId, status: this.status, phase: this.phase, voyage: this.voyage, maxVoyages: null,
            rules: { players: '3–5', startingCash: 30, sharesEach: 2, accomplices: this.players.length === 3 ? 4 : 3, placementRounds: this.players.length === 3 ? 4 : 3, movementRounds: 3, startSum: 9, finishAtMarket: 30, loans: 12, repayment: 15 },
            harborMasterId: this.harborMasterId, harborMasterName: this.playerMap[this.harborMasterId]?.name || null, masterStep: this.masterStep,
            shareMarket: { ...this.shareMarket }, market: { ...this.market }, currentTurn: current?.id || null, currentTurnName: current?.name || null, movementRound: this.movementRound,
            movementPlan: this.movementPlan ? { round: this.movementPlan.round, rolls: this.movementPlan.rolls.map(item => ({ ...item })) } : null,
            lastMovement: this.lastMovement ? { round: this.lastMovement.round, moves: this.lastMovement.moves.map(item => ({ ...item })) } : null,
            auction: this.auction ? { highestBid: this.auction.highestBid, highestBidder: this.auction.highestBidder, passed: [...this.auction.passed] } : null,
            boats: this.boats.map(boat => ({ id: boat.id, good: boat.good, position: boat.position, arrived: boat.fate === 'port', fate: boat.fate, plundered: Boolean(boat.plundered), portIndex: boat.portIndex || null, shipyardIndex: boat.shipyardIndex || null, accomplices: boat.placements.length, pirates: boat.pirates.length })),
            pendingPlunder: pendingPlunderBoat ? { boatId: pendingPlunderBoat.id, good: pendingPlunderBoat.good, captainId: pendingPlunderEntry.playerId, captainName: this.playerMap[pendingPlunderEntry.playerId]?.name || '', cargoAccomplices: pendingPlunderBoat.placements.length, pirates: (this.locations.pirate?.length || 0) + (pendingPlunderBoat.pirates?.length || 0) } : null,
            locations: Object.fromEntries(Object.entries(this.locations).map(([id, stakes]) => [id, stakes.map(stake => ({ playerId: stake.playerId, playerName: this.playerMap[stake.playerId]?.name, fee: stake.fee, slot: stake.slot }))])),
            players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, cash: player.cash, sharesCount: player.shares.length, encumberedShares: player.encumberedShares.length, accomplices: player.accomplices, isOnline: player.isOnline, fortune: this.finalFortunes?.[player.id] ?? null })),
            lastVoyage: clone(this.lastVoyage), voyageHistory: this.voyageHistory.map(entry => ({ voyage: entry.voyage, players: entry.players.map(player => ({ ...player })), marketAfter: { ...entry.marketAfter } })), presentation: clone(this.presentation), actionLog: this.actionLog.slice(-20), winner: this.winner ? { id: this.winner.id, name: this.winner.name, cash: this.winner.cash, fortune: this.finalFortunes?.[this.winner.id] ?? null } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, fortune: this.finalFortunes?.[player.id] ?? null })),
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState(); const player = this.playerMap[playerId]; state.myId = playerId; state.myShares = player?.shares?.slice() || []; state.myEncumberedShares = player?.encumberedShares?.slice() || [];
        const ownTurn = state.currentTurn === playerId;
        state.availableActions = {
            bid: this.phase === 'auction' && ownTurn && !this.auction.passed.has(playerId), passBid: this.phase === 'auction' && ownTurn && !this.auction.passed.has(playerId), buyShare: this.phase === 'master' && this.harborMasterId === playerId && this.masterStep === 'buyShare', skipShare: this.phase === 'master' && this.harborMasterId === playerId && this.masterStep === 'buyShare', setBoats: this.phase === 'master' && this.harborMasterId === playerId && this.masterStep === 'plan', placeAccomplice: this.phase === 'placement' && ownTurn && !this.passed.has(playerId), passPlacement: this.phase === 'placement' && ownTurn && !this.passed.has(playerId), sailBoats: this.phase === 'sailing' && this.harborMasterId === playerId, pilotMove: this.phase === 'pilot' && ownTurn, skipPilot: this.phase === 'pilot' && ownTurn, boardPirate: this.phase === 'pirateBoard' && ownTurn, skipPirate: this.phase === 'pirateBoard' && ownTurn, plunderDestination: this.phase === 'plunder' && ownTurn, takeLoan: this.status === 'playing' && player ? this._availableLoans(player) > 0 : false, repayLoan: this.status === 'playing' && player ? player.encumberedShares.length > 0 && player.cash >= 15 : false,
        };
        return state;
    }

    handlePlayerLeave(playerId) { const player = this.playerMap[playerId]; if (!player || !player.isOnline) return { success: false, message: '玩家不存在' }; player.isOnline = false; this._log(`${player.name} 离开了马尼拉商会`); if (this.players.filter(item => item.isOnline).length < 3) { this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null; } return this._success(`${player.name} 已离开`); }
    _startPresentation(actorId, action, firstEvent) { this.presentation = { sequence: ++this.presentationSequence, actorId, action, resolved: false, events: [] }; if (firstEvent) this._appendPresentationEvent(firstEvent); }
    _appendPresentationEvent(event) { if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system'); this.presentation.events.push({ sequence: ++this.presentationEventSequence, ...clone(event) }); }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, fortune: this.finalFortunes?.[this.winner.id] ?? null } : null; }
}

module.exports = ManilaEngine;
module.exports.GOODS = GOODS;
module.exports.WARE_PROFITS = WARE_PROFITS;
module.exports.LOCATIONS = LOCATIONS;
