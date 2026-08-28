const CAMELS = [
    { id: 'red', name: '赤焰', color: '#d6574f' },
    { id: 'blue', name: '海蓝', color: '#4e82b1' },
    { id: 'green', name: '绿洲', color: '#6a9b6b' },
    { id: 'yellow', name: '金沙', color: '#d2a13c' },
    { id: 'white', name: '月白', color: '#a7b2b9' },
];
const TRACK_LENGTH = 16;
const PLAYER_COLORS = ['#d45f54', '#4d82a6', '#bf8b3e', '#6d9466', '#80699b', '#9c6876', '#4f8f8e', '#997e58'];

function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

class CamelUpEngine {
    constructor(roomId, players, randomOrOptions = Math.random, extraOptions = {}) {
        const suppliedOptions = typeof randomOrOptions === 'function' ? extraOptions : (randomOrOptions || {});
        const random = typeof randomOrOptions === 'function' ? randomOrOptions : (suppliedOptions.random || Math.random);
        this.roomId = roomId;
        this.random = random;
        this.options = { ...suppliedOptions };
        const playerColors = PLAYER_COLORS;
        // Keep the full roster so start() rejects an unsupported room instead
        // of silently dropping players above the official eight-seat limit.
        this.players = players.map((player, index) => ({
            id: player.id,
            name: player.name,
            color: playerColors[index] || '#777777',
            cash: 3,
            legBets: [],
            overallBets: [],
            overallBet: null,
            raceCards: [],
            tile: null,
            pyramidTiles: 0,
            isOnline: true,
        }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.camels = [];
        this.tiles = {};
        this.legTiles = {};
        this.phase = 'waiting';
        this.status = 'waiting';
        this.leg = 1;
        this.turnPlayerIndex = 0;
        this.rolled = new Set();
        this.history = [];
        this.actionLog = [];
        this.winner = null;
        this.winners = [];
        this.lastLeg = null;
        this.finalStandings = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this.presentationPrivate = {};
    }

    _resetLegTiles() { this.legTiles = Object.fromEntries(CAMELS.map(camel => [camel.id, [5, 3, 2]])); }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '游戏已经开始或已经结束' };
        if (this.players.length < 3 || this.players.length > 8) return { success: false, message: '狂野骆驼需要 3–8 名玩家' };
        this.players.forEach(player => {
            player.cash = 3;
            player.legBets = [];
            player.overallBets = [];
            player.overallBet = null;
            player.raceCards = CAMELS.map(camel => ({ id: `finish-${player.id}-${camel.id}`, camelId: camel.id, ownerId: player.id }));
            player.tile = null;
            player.pyramidTiles = 0;
            player.isOnline = true;
        });
        const order = shuffle(CAMELS, this.random);
        const grouped = [];
        order.forEach(camel => { const position = Math.floor(this.random() * 3) + 1; (grouped[position] ||= []).push(camel.id); });
        this.camels = CAMELS.map(camel => ({ ...camel, position: grouped.findIndex(stack => stack?.includes(camel.id)), order: grouped.find(stack => stack?.includes(camel.id))?.indexOf(camel.id) ?? 0 }));
        this.tiles = {};
        this._resetLegTiles();
        this.leg = 1;
        this.turnPlayerIndex = 0;
        this.rolled = new Set();
        this.history = [];
        this.status = 'playing';
        this.phase = 'leg';
        this.winner = null;
        this.winners = [];
        this.lastLeg = null;
        this.finalStandings = [];
        this.presentation = null;
        this.presentationSequence = 0;
        this.presentationEventSequence = 0;
        this.presentationPrivate = {};
        this.actionLog = ['五匹骆驼已按开局掷骰结果布置在 1–3 号格'];
        this._log(`第 ${this.leg} 回合开始，轮到 ${this.players[0].name}`);
        this._appendPresentationEvent({
            kind: 'raceStarted',
            camels: this.camels.map(camel => this._publicCamel(camel)),
            currentPlayerId: this.players[0]?.id || null,
            currentPlayerName: this.players[0]?.name || '',
            startingCoins: 3,
        });
        this._appendPresentationEvent({ kind: 'legStarted', leg: this.leg, currentPlayerId: this.players[0]?.id || null, currentPlayerName: this.players[0]?.name || '', openingLeg: true });
        this._finishPresentation();
        return this._success('狂野骆驼开始');
    }

    handleAction(playerId, action = {}) {
        const player = this.playerMap[playerId];
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (this.players[this.turnPlayerIndex].id !== playerId) return { success: false, message: '还没轮到你', state: this.getPlayerState(playerId) };
        if (action.kind === 'rollDie') return this._roll(player);
        if (action.kind === 'betLeg') return this._betLeg(player, action.camelId);
        if (action.kind === 'betOverall') return this._betOverall(player, action.cardId, action.outcome);
        if (action.kind === 'placeTile') return this._placeTile(player, action);
        return { success: false, message: '未知动作', state: this.getPlayerState(playerId) };
    }

    _roll(player) {
        if (this.rolled.size >= CAMELS.length) return { success: false, message: '本回合五匹骆驼都已掷过', state: this.getPlayerState(player.id) };
        const available = this.camels.filter(camel => !this.rolled.has(camel.id));
        const camel = available[Math.floor(this.random() * available.length)];
        const steps = Math.floor(this.random() * 3) + 1;
        this._startPresentation(player.id, 'rollDie');
        this._appendPresentationEvent({ kind: 'dieRevealed', actorId: player.id, actorName: player.name, camel: this._publicCamel(camel), steps, remainingBefore: available.length, pyramidReward: 1 });
        player.pyramidTiles += 1;
        const movement = this._moveCamel(camel.id, steps);
        this._appendPresentationEvent({ kind: 'camelMoved', actorId: player.id, actorName: player.name, camel: this._publicCamel(camel), steps, from: movement.from, to: movement.landingPosition, movingCamels: movement.movingCamels, destinationStack: movement.destinationStack });
        if (movement.tileTrigger) this._appendPresentationEvent({ kind: 'desertTileTriggered', actorId: player.id, actorName: player.name, camel: this._publicCamel(camel), movingCamels: movement.movingCamels, ...movement.tileTrigger });
        this.rolled.add(camel.id);
        this._log(`${player.name} 掷骰：${camel.name} 前进 ${steps} 格，并获得 1 块金字塔板块`);
        if (camel.position >= TRACK_LENGTH) {
            this._appendPresentationEvent({ kind: 'raceFinished', actorId: player.id, actorName: player.name, camel: this._publicCamel(camel), position: camel.position, ranking: this._ranking().map(item => this._publicCamel(item)) });
            this._settleLeg(true);
            this._finishRace({ announce: false });
            this._finishPresentation();
            return this._success('骆驼冲线，比赛结束');
        }
        if (this.rolled.size >= CAMELS.length) this._settleLeg(); else this._nextTurn();
        this._finishPresentation();
        return this._success('骰子已结算');
    }

    _moveCamel(camelId, steps) {
        const camel = this.camels.find(item => item.id === camelId);
        if (!camel) return { from: 0, landingPosition: 0, finalPosition: 0, movingCamels: [], destinationStack: [], tileTrigger: null };
        const from = camel.position;
        const group = this._stackAt(from);
        const index = group.findIndex(item => item.id === camelId);
        const moving = group.slice(index);
        const target = Math.min(TRACK_LENGTH, from + steps);
        const destination = this._stackAt(target).filter(item => !moving.includes(item));
        const destinationStack = destination.map(item => this._publicCamel(item));
        moving.forEach(item => { item.position = target; item.order = destination.length; destination.push(item); });
        const tile = this.tiles[target];
        let tileTrigger = null;
        if (tile && target <= TRACK_LENGTH) {
            const shift = tile.kind === 'oasis' ? 1 : -1;
            const finalPosition = Math.max(0, Math.min(TRACK_LENGTH, target + shift));
            const finalStack = this._stackAt(finalPosition).filter(item => !moving.includes(item));
            // Oasis places the moving stack above the existing stack; mirage places it below.
            const ordered = tile.kind === 'oasis' ? [...finalStack, ...moving] : [...moving, ...finalStack];
            ordered.forEach((item, order) => { item.position = finalPosition; item.order = order; });
            const owner = this.playerMap[tile.ownerId];
            if (owner) this._adjustCash(owner, 1);
            tileTrigger = { tileType: tile.kind, tilePosition: target, from: target, to: finalPosition, ownerId: tile.ownerId, ownerName: tile.ownerName, reward: owner ? 1 : 0, finalStack: this._stackAt(finalPosition).map(item => this._publicCamel(item)) };
            this._log(`${camel.name} 触发${tile.kind === 'oasis' ? '绿洲，前进 1 格' : '海市蜃楼，后退 1 格'}`);
        }
        return { from, landingPosition: target, finalPosition: camel.position, movingCamels: moving.map(item => this._publicCamel(item)), destinationStack, tileTrigger };
    }

    _publicCamel(camel) { return camel ? { id: camel.id, name: camel.name, color: camel.color, position: camel.position, order: camel.order } : null; }

    _stackAt(position) { return this.camels.filter(camel => camel.position === position).sort((a, b) => a.order - b.order); }

    _betLeg(player, camelId) {
        if (!CAMELS.some(camel => camel.id === camelId) || !this.legTiles[camelId]?.length) return { success: false, message: '这匹骆驼的本回合下注牌已经拿完', state: this.getPlayerState(player.id) };
        this._startPresentation(player.id, 'betLeg');
        const payout = this.legTiles[camelId].shift();
        player.legBets.push({ camelId, payout });
        const camel = CAMELS.find(item => item.id === camelId);
        this._appendPresentationEvent({ kind: 'legBetTaken', actorId: player.id, actorName: player.name, camel: clone(camel), payout, remaining: this.legTiles[camelId].length });
        this._log(`${player.name} 押注本回合 ${this.playerMap[camelId]?.name || CAMELS.find(camel => camel.id === camelId)?.name}（${payout} 金币牌）`);
        this._nextTurn();
        this._finishPresentation();
        return this._success('回合下注已放置');
    }

    _betOverall(player, cardId, outcome = 'winner') {
        if (!['winner', 'loser'].includes(outcome)) return { success: false, message: '请选择冠军或垫底下注类型', state: this.getPlayerState(player.id) };
        const cardIndex = player.raceCards.findIndex(card => card.id === cardId);
        if (cardIndex < 0) return { success: false, message: '请选择自己手中的一张终局下注牌', state: this.getPlayerState(player.id) };
        const card = player.raceCards[cardIndex];
        const camelId = card.camelId;
        const order = this.players.flatMap(item => item.overallBets).filter(bet => bet.outcome === outcome).length + 1;
        this._startPresentation(player.id, 'betOverall');
        player.raceCards.splice(cardIndex, 1);
        const bet = { cardId: card.id, camelId, outcome, order };
        player.overallBets.push(bet);
        player.overallBet = player.overallBets[0] || null;
        this._appendPresentationEvent({ kind: 'overallBetPlaced', actorId: player.id, actorName: player.name, outcome, order }, { [player.id]: { cardId: card.id, camelId, camelName: CAMELS.find(camel => camel.id === camelId)?.name || camelId } });
        this._log(`${player.name} 将一张终局牌面朝下放入${outcome === 'loser' ? '垫底' : '冠军'}区`);
        this._nextTurn();
        this._finishPresentation();
        return this._success('全场下注已放置');
    }

    _placeTile(player, action) {
        const position = Number(action.position);
        const kind = action.tileType;
        const oldPosition = player.tile?.position;
        const adjacent = Object.keys(this.tiles).some(tilePosition => Number(tilePosition) !== oldPosition && Math.abs(Number(tilePosition) - position) <= 1);
        const occupied = this.camels.some(camel => camel.position === position);
        if (!['oasis', 'mirage'].includes(kind) || !Number.isInteger(position) || position < 2 || position > TRACK_LENGTH || occupied || (this.tiles[position] && Number(position) !== oldPosition) || adjacent) return { success: false, message: '沙漠板块不能放在 1 号格、骆驼所在格、重叠格或相邻格', state: this.getPlayerState(player.id) };
        this._startPresentation(player.id, 'placeTile');
        if (oldPosition != null) delete this.tiles[oldPosition];
        this.tiles[position] = { ownerId: player.id, ownerName: player.name, kind };
        player.tile = { position, kind };
        this._appendPresentationEvent({ kind: 'desertTilePlaced', actorId: player.id, actorName: player.name, tileType: kind, position, previousPosition: oldPosition ?? null, moved: oldPosition != null });
        this._log(`${player.name} 在 ${position} 号格${oldPosition == null ? '放置' : '移动'}${kind === 'oasis' ? '绿洲' : '海市蜃楼'}`);
        this._nextTurn();
        this._finishPresentation();
        return this._success('沙漠板块已放置');
    }

    _nextTurn() {
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const index = (this.turnPlayerIndex + offset) % this.players.length;
            if (this.players[index].isOnline) { this.turnPlayerIndex = index; return; }
        }
    }

    _adjustCash(player, amount) { player.cash = Math.max(0, player.cash + amount); }

    _settleLeg(final = false) {
        const standalonePresentation = !this.presentation || this.presentation.resolved;
        if (standalonePresentation) this._startPresentation(null, 'legSettlement');
        const ranking = this._ranking();
        const payouts = [];
        const pyramidRewards = [];
        const playerResults = [];
        for (const player of this.players) {
            const cashBefore = player.cash;
            const pyramid = player.pyramidTiles;
            if (pyramid) { this._adjustCash(player, pyramid); pyramidRewards.push({ playerId: player.id, amount: pyramid }); }
            player.pyramidTiles = 0;
            const bets = [];
            player.legBets.forEach(bet => {
                const rank = ranking.findIndex(camel => camel.id === bet.camelId);
                const reward = rank === 0 ? bet.payout : rank === 1 ? 1 : -1;
                this._adjustCash(player, reward);
                payouts.push({ playerId: player.id, camelId: bet.camelId, amount: reward, rank: rank + 1 });
                bets.push({ camelId: bet.camelId, camelName: CAMELS.find(camel => camel.id === bet.camelId)?.name || bet.camelId, faceValue: bet.payout, rank: rank + 1, reward });
            });
            player.legBets = [];
            playerResults.push({ playerId: player.id, playerName: player.name, cashBefore, cashAfter: player.cash, change: player.cash - cashBefore, pyramidCount: pyramid, pyramidReward: pyramid, bets });
        }
        this.lastLeg = { leg: this.leg, ranking: ranking.map(camel => camel.id), payouts, pyramidRewards, playerResults: clone(playerResults), final };
        this.history.push(this.lastLeg);
        this._appendPresentationEvent({ kind: 'legSettlement', leg: this.leg, final, ranking: ranking.map(camel => this._publicCamel(camel)), playerResults: clone(playerResults) });
        this._log(`第 ${this.leg} 回合结束：${ranking.map(camel => camel.name).join('、')}`);
        if (!final) {
            this.rolled.clear();
            this._resetLegTiles();
            this.players.forEach(player => { player.tile = null; });
            this.tiles = {};
            this.leg += 1;
            this._nextTurn();
            this._appendPresentationEvent({ kind: 'legStarted', leg: this.leg, currentPlayerId: this.players[this.turnPlayerIndex]?.id || null, currentPlayerName: this.players[this.turnPlayerIndex]?.name || '' });
        }
        if (standalonePresentation) this._finishPresentation();
    }

    _ranking() { return this._stackAt(TRACK_LENGTH).sort((a, b) => b.order - a.order).concat(this.camels.filter(camel => camel.position < TRACK_LENGTH).sort((a, b) => b.position - a.position || b.order - a.order)); }

    _finishRace(options = {}) {
        const announce = typeof options === 'object' ? options.announce !== false : true;
        const standalonePresentation = !this.presentation || this.presentation.resolved;
        if (standalonePresentation) this._startPresentation(null, 'finishRace');
        const ranking = this._ranking();
        if (announce) this._appendPresentationEvent({ kind: 'raceFinished', camel: this._publicCamel(ranking[0]), position: ranking[0]?.position ?? TRACK_LENGTH, ranking: ranking.map(camel => this._publicCamel(camel)) });
        const payouts = [8, 5, 3, 2, 1];
        const revealGroups = { winner: [], loser: [] };
        // Cards are revealed in placement order.  Incorrect cards always lose
        // one EP; only correct cards advance the 8/5/3/2/1 reward ladder.
        for (const outcome of ['winner', 'loser']) {
            const bets = this.players.flatMap(player => player.overallBets.filter(bet => bet.outcome === outcome).map(bet => ({ player, bet }))).sort((a, b) => a.bet.order - b.bet.order);
            let correctRank = 0;
            for (const { player, bet } of bets) {
                const rank = ranking.findIndex(camel => camel.id === bet.camelId);
                const correct = outcome === 'winner' ? rank === 0 : rank === ranking.length - 1;
                const reward = correct ? (payouts[correctRank++] || 1) : -1;
                const cashBefore = player.cash;
                this._adjustCash(player, reward);
                revealGroups[outcome].push({ order: bet.order, playerId: player.id, playerName: player.name, cardId: bet.cardId, camelId: bet.camelId, camelName: CAMELS.find(camel => camel.id === bet.camelId)?.name || bet.camelId, correct, reward, cashBefore, cashAfter: player.cash });
            }
        }
        this._appendPresentationEvent({ kind: 'overallBetsRevealed', ranking: ranking.map(camel => this._publicCamel(camel)), winnerBets: revealGroups.winner, loserBets: revealGroups.loser });
        this.status = 'ended';
        this.phase = 'ended';
        const highestCash = Math.max(...this.players.map(player => player.cash), 0);
        this.winners = this.players.filter(player => player.cash === highestCash);
        // Keep winner for older room adapters while exposing all co-winners.
        this.winner = this.winners[0] || null;
        const sortedPlayers = this.players.slice().sort((a, b) => b.cash - a.cash);
        this.finalStandings = sortedPlayers.map((player, index) => ({ rank: sortedPlayers.findIndex(item => item.cash === player.cash) + 1, id: player.id, name: player.name, color: player.color, cash: player.cash }));
        this._appendPresentationEvent({ kind: 'finalSettlement', standings: clone(this.finalStandings), winnerIds: this.winners.map(player => player.id), camelRanking: ranking.map(camel => this._publicCamel(camel)) });
        this._log(`${this.winners.map(player => player.name).join('、') || '无人'} 以 ${highestCash} 金币${this.winners.length > 1 ? '并列' : ''}获胜`);
        if (standalonePresentation) this._finishPresentation();
    }

    getPublicState() {
        const ranking = this._ranking();
        const current = this.players[this.turnPlayerIndex];
        return {
            roomId: this.roomId, status: this.status, phase: this.phase, leg: this.leg,
            rules: { players: '3–8', startingCoins: 3, camels: 5, trackLength: TRACK_LENGTH, legBetPayouts: [5, 3, 2], legOtherCamelPayout: -1, overallBetPayouts: [8, 5, 3, 2, 1], desertTiles: '不可放在 1 号格、骆驼所在格，且不能与其他板块相邻', pyramidTileReward: 1, finish: '第一匹骆驼越过 16 格后立即终局；同格时最上方骆驼为冠军' },
            currentTurn: current?.id || null, currentTurnName: current?.name || null, rolled: [...this.rolled],
            legTiles: Object.fromEntries(Object.entries(this.legTiles).map(([id, tiles]) => [id, tiles.length])),
            camels: this.camels.map(camel => ({ id: camel.id, name: camel.name, color: camel.color, position: camel.position, order: camel.order })),
            ranking: ranking.map(camel => camel.id), tiles: Object.fromEntries(Object.entries(this.tiles).map(([position, tile]) => [position, { ...tile }])),
            overallBetPiles: {
                winner: this.players.reduce((total, player) => total + player.overallBets.filter(bet => bet.outcome === 'winner').length, 0),
                loser: this.players.reduce((total, player) => total + player.overallBets.filter(bet => bet.outcome === 'loser').length, 0),
            },
            players: this.players.map(player => ({ id: player.id, name: player.name, color: player.color, cash: player.cash, pyramidTileCount: player.pyramidTiles, legBetCount: player.legBets.length, overallBetCount: player.overallBets.length, finishCardCount: player.raceCards.length, hasOverallBet: Boolean(player.overallBets.length), isOnline: player.isOnline })),
            lastLeg: clone(this.lastLeg), presentation: clone(this.presentation), finalStandings: clone(this.finalStandings), actionLog: this.actionLog.slice(-20), winner: this.winner ? { id: this.winner.id, name: this.winner.name, cash: this.winner.cash } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, cash: player.cash })),
        };
    }

    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        state.myId = playerId;
        state.myLegBets = player?.legBets.map(bet => ({ ...bet })) || [];
        state.myOverallBets = player?.overallBets.map(bet => ({ ...bet })) || [];
        state.myOverallBet = player?.overallBets[0] ? { ...player.overallBets[0] } : null;
        state.myRaceCards = player?.raceCards.map(card => ({ ...card })) || [];
        state.myPyramidTiles = player?.pyramidTiles || 0;
        if (state.presentation?.events?.length) state.presentation.events = state.presentation.events.map(event => {
            const privateData = this.presentationPrivate[event.sequence]?.[playerId];
            return privateData ? { ...event, private: clone(privateData) } : event;
        });
        state.availableActions = { rollDie: this.phase === 'leg' && state.currentTurn === playerId && this.rolled.size < CAMELS.length, betLeg: this.phase === 'leg' && state.currentTurn === playerId && Object.values(this.legTiles).some(tiles => tiles.length), betOverall: this.phase === 'leg' && state.currentTurn === playerId && (player?.raceCards.length || 0) > 0, placeTile: this.phase === 'leg' && state.currentTurn === playerId };
        return state;
    }

    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在' };
        const wasCurrent = this.players[this.turnPlayerIndex]?.id === playerId;
        player.isOnline = false;
        if (this.players.filter(item => item.isOnline).length < 3) { this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null; this.winners = this.winner ? [this.winner] : []; }
        else if (wasCurrent) this._nextTurn();
        return this._success(`${player.name} 已离开赛道`);
    }

    _startPresentation(actorId, action, firstEvent = null, privateByPlayer = null) {
        this.presentation = { sequence: ++this.presentationSequence, actorId, action, resolved: false, events: [] };
        this.presentationPrivate = {};
        if (firstEvent) this._appendPresentationEvent(firstEvent, privateByPlayer);
    }
    _appendPresentationEvent(event, privateByPlayer = null) {
        if (!this.presentation || this.presentation.resolved) this._startPresentation(event.actorId || null, event.kind || 'system');
        const entry = { sequence: ++this.presentationEventSequence, ...clone(event) };
        this.presentation.events.push(entry);
        if (privateByPlayer && Object.keys(privateByPlayer).length) this.presentationPrivate[entry.sequence] = clone(privateByPlayer);
        return entry;
    }
    _finishPresentation() { if (this.presentation) this.presentation.resolved = true; }
    _log(message) { this.actionLog.push(message); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null, winners: this.winners.map(player => ({ id: player.id, name: player.name, cash: player.cash })) }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, cash: this.winner.cash, shared: this.winners.length > 1, winners: this.winners.map(player => ({ id: player.id, name: player.name, cash: player.cash })) } : null; }
}

module.exports = CamelUpEngine;
module.exports.CAMELS = CAMELS;
module.exports.TRACK_LENGTH = TRACK_LENGTH;
