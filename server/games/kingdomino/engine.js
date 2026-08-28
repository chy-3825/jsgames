// Base Kingdomino has six landscapes.  The old implementation accidentally
// used a Queendomino-style village landscape and a generated distribution;
// this table is the numbered 48-domino base set.
const TERRAIN_TYPES = ['麦田', '森林', '海洋', '草地', '沼泽', '矿山'];
const TERRAIN_COLORS = { 麦田: '#d5a948', 森林: '#3d7b5b', 海洋: '#4e88b8', 草地: '#93ad62', 沼泽: '#796c68', 矿山: '#756b88' };
const BOARD_SIZE = 5;
const ROUNDS = 12;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function buildDominoes() {
    const pairs = [
        ['麦田', '麦田', 0, 0], ['麦田', '麦田', 0, 0], ['森林', '森林', 0, 0], ['森林', '森林', 0, 0],
        ['森林', '森林', 0, 0], ['森林', '森林', 0, 0], ['海洋', '海洋', 0, 0], ['海洋', '海洋', 0, 0],
        ['海洋', '海洋', 0, 0], ['草地', '草地', 0, 0], ['草地', '草地', 0, 0], ['沼泽', '沼泽', 0, 0],
        ['麦田', '森林', 0, 0], ['麦田', '海洋', 0, 0], ['麦田', '草地', 0, 0], ['麦田', '沼泽', 0, 0],
        ['森林', '海洋', 0, 0], ['森林', '草地', 0, 0], ['麦田', '森林', 1, 0], ['麦田', '海洋', 1, 0],
        ['麦田', '草地', 1, 0], ['麦田', '沼泽', 1, 0], ['麦田', '矿山', 1, 0], ['森林', '麦田', 1, 0],
        ['森林', '麦田', 1, 0], ['森林', '麦田', 1, 0], ['森林', '麦田', 1, 0], ['森林', '海洋', 1, 0],
        ['森林', '草地', 1, 0], ['海洋', '麦田', 1, 0], ['海洋', '麦田', 1, 0], ['海洋', '森林', 1, 0],
        ['海洋', '森林', 1, 0], ['海洋', '森林', 1, 0], ['海洋', '森林', 1, 0], ['麦田', '草地', 0, 1],
        ['海洋', '草地', 0, 1], ['麦田', '沼泽', 0, 1], ['草地', '沼泽', 0, 0], ['矿山', '麦田', 1, 0],
        ['麦田', '草地', 0, 2], ['海洋', '草地', 0, 2], ['麦田', '沼泽', 0, 2], ['草地', '沼泽', 0, 2],
        ['矿山', '麦田', 2, 0], ['沼泽', '矿山', 0, 2], ['沼泽', '矿山', 0, 2], ['麦田', '矿山', 0, 3],
    ];
    return pairs.map((pair, index) => ({ id: `domino-${String(index + 1).padStart(2, '0')}`, number: index + 1, left: pair[0], right: pair[1], crowns: [pair[2], pair[3]] }));
}

class KingdominoEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        this.roomId = roomId;
        this.random = typeof random === 'function' ? random : Math.random;
        this.options = options && typeof options === 'object' ? { ...options } : {};
        this.players = players.map((player, index) => ({ id: player.id, name: player.name, color: ['#d66a56', '#4f83aa', '#c99a3d', '#6b9b68'][index], grid: {}, score: 0, isOnline: true, selectedTile: null, selectedTiles: [], placedCount: 0 }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.deck = [];
        this.draft = [];
        this.phase = 'waiting';
        this.status = 'waiting';
        this.round = 0;
        this.maxRounds = 12;
        this.boardSize = 5;
        this.selectionOrder = [];
        this.currentQueue = [];
        this.currentQueueIndex = 0;
        this.selected = new Map();
        this.placedTokens = new Set();
        this.discarded = [];
        this.lastAction = null;
        this.actionLog = [];
        this.winner = null;
        this.presentationSequence = 0;
        this.transactionSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '多米诺王国已经开始，不能重复开始' };
        if (this.players.length < 2 || this.players.length > 4) return { success: false, message: '多米诺王国需要 2–4 名玩家' };
        // The base game scales the supply with player count: 24 tiles for two
        // players, 36 for three and the full 48 for four.  Two-player games
        // use two kings per player and therefore last six turns.  The 7x7
        // Mighty Duel is an optional two-player variant: use all 48 tiles and
        // 12 turns only when explicitly requested by the room.
        this.mightyDuel = this.players.length === 2 && this.options.mightyDuel === true;
        const tileCount = this.players.length === 2 ? (this.mightyDuel ? 48 : 24) : this.players.length === 3 ? 36 : 48;
        this.deck = this._shuffle(buildDominoes()).slice(0, tileCount);
        // The castle occupies the centre of the kingdom.  Keeping it in a
        // corner would silently forbid half of the legal table placements.
        this.maxRounds = this.players.length === 2 ? (this.mightyDuel ? 12 : 6) : 12;
        this.boardSize = this.players.length === 2 && this.mightyDuel ? 7 : 5;
        const castleCoordinate = `${Math.floor(this.boardSize / 2)},${Math.floor(this.boardSize / 2)}`;
        this.players.forEach(player => { player.grid = { [castleCoordinate]: this._castle() }; player.score = 0; player.selectedTile = null; player.selectedTiles = []; player.placedCount = 0; player.isOnline = true; });
        this.round = 1;
        this.selectionOrder = this._selectionTokensForPlayers(true);
        this.selected.clear();
        this.placedTokens.clear();
        this.discarded = [];
        this.lastAction = null;
        this.winner = null;
        this.presentationSequence = 0;
        this.transactionSequence = 0;
        this.eventSequence = 0;
        this.presentation = null;
        this._openDraft();
        this.status = 'playing';
        this.phase = 'selecting';
        this._startPresentation(null, 'gameStart', {
            round: this.round,
            maxRounds: this.maxRounds,
            boardSize: this.boardSize,
        });
        this._appendPresentationEvent(null, 'roundReveal', {
            round: this.round,
            maxRounds: this.maxRounds,
            draft: this._publicDraft(),
            isLastRound: this.round === this.maxRounds,
            remainingTileCount: this.deck.length,
        });
        this._updatePresentation({ resolved: true, nextPlayerId: this.currentQueue[0]?.playerId || null });
        this.actionLog = [`第 1 轮：按王冠旁的顺序选择多米诺`];
        return this._success('多米诺王国开始');
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '王国尚未开始或已结束' };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        if (this.phase === 'selecting' && action.kind === 'selectDomino') return this._selectDomino(player, action.dominoId);
        if (this.phase === 'placing' && action.kind === 'placeDomino') return this._placeDomino(player, action);
        if (this.phase === 'placing' && action.kind === 'discardDomino') return this._discardDomino(player);
        return { success: false, message: '现在不能执行这个操作', state: this.getPlayerState(playerId) };
    }

    _selectDomino(player, dominoId) {
        const token = this.currentQueue[this.currentQueueIndex];
        if (token?.playerId !== player.id) return { success: false, message: '请等待前一位国王选择', state: this.getPlayerState(player.id) };
        const tokenKey = this._tokenKey(token);
        if (this.selected.has(tokenKey)) return { success: false, message: '你已经选择过这次多米诺', state: this.getPlayerState(player.id) };
        const index = this.draft.findIndex(tile => tile.id === dominoId);
        if (index < 0) return { success: false, message: '这块多米诺已经被选走', state: this.getPlayerState(player.id) };
        const tile = this.draft[index];
        if (Array.from(this.selected.values()).some(selected => selected.id === tile.id)) return { success: false, message: '这块多米诺已经被选走', state: this.getPlayerState(player.id) };
        this.selected.set(tokenKey, tile);
        player.selectedTiles.push({ token: token.token, tile });
        player.selectedTile = tile;
        this.currentQueueIndex += 1;
        const message = `${player.name} 选择了第 ${tile.number} 号多米诺`;
        this.actionLog.push(message);
        this.lastAction = { playerId: player.id, playerName: player.name, message };
        this._startPresentation(player, 'selectDomino', {
            tile: this._publicTile(tile),
            token: token.token,
            tokenNumber: token.token + 1,
            playerColor: player.color,
            round: this.round,
        });
        if (this.currentQueueIndex >= this.currentQueue.length) {
            const selectedIds = new Set(Array.from(this.selected.values()).map(selected => selected.id));
            const unclaimedTiles = this.draft.filter(tile => !selectedIds.has(tile.id));
            this.discarded.push(...unclaimedTiles);
            for (const unclaimedTile of unclaimedTiles) {
                this._appendPresentationEvent(null, 'unclaimedDomino', {
                    tile: this._publicTile(unclaimedTile),
                    round: this.round,
                });
            }
            this.phase = 'placing';
            this.currentQueue = this._orderByDraftSelection();
            this.currentQueueIndex = 0;
            this._appendPresentationEvent(null, 'placementPhase', {
                round: this.round,
                order: this._placementOrderPresentation(),
            });
            this._updatePresentation({ resolved: true, nextPlayerId: this.currentQueue[0]?.playerId || null });
            this.actionLog.push('选牌完成，请按顺序把多米诺放入王国');
            return this._success(`${player.name} 完成选牌`);
        }
        this._updatePresentation({ resolved: true, nextPlayerId: this.currentQueue[this.currentQueueIndex]?.playerId || null });
        return this._success(`${player.name} 完成选牌，轮到下一位`);
    }

    _placeDomino(player, action) {
        const token = this.currentQueue[this.currentQueueIndex];
        if (token?.playerId !== player.id) return { success: false, message: '请等待前一位国王摆放', state: this.getPlayerState(player.id) };
        const tile = this.selected.get(this._tokenKey(token));
        if (!tile) return { success: false, message: '本轮没有可摆放的多米诺', state: this.getPlayerState(player.id) };
        const placement = this._normalizePlacement(action);
        const orientation = placement && this._placementOrientation(player, tile, placement);
        if (!orientation) return { success: false, message: `多米诺必须完整放入 ${this.boardSize}×${this.boardSize} 王国，并与相同地形或城堡相邻`, state: this.getPlayerState(player.id) };
        const scoreBefore = this._score(player);
        this._applyPlacement(player, tile, placement, orientation);
        const scoreAfter = this._score(player);
        player.score = scoreAfter;
        this._startPresentation(player, 'placeDomino', {
            tile: this._publicTile(tile),
            token: token.token,
            tokenNumber: token.token + 1,
            playerColor: player.color,
            placement: {
                first: { ...placement.first },
                second: { ...placement.second },
                terrains: orientation.terrains.slice(),
                crowns: orientation.crowns.slice(),
            },
            scoreBefore,
            scoreAfter,
            round: this.round,
        });
        this._finishPlacement(player, token, `${player.name} 将第 ${tile.number} 号多米诺放入王国`);
        return this._afterPlacement();
    }

    _discardDomino(player) {
        const token = this.currentQueue[this.currentQueueIndex];
        if (token?.playerId !== player.id) return { success: false, message: '请等待前一位国王摆放', state: this.getPlayerState(player.id) };
        const tile = this.selected.get(this._tokenKey(token));
        if (!tile) return { success: false, message: '本轮没有可弃置的多米诺', state: this.getPlayerState(player.id) };
        // The physical rules only allow a domino to be discarded when it has
        // no legal placement in the player's kingdom.  Previously the client
        // could bypass this by sending discardDomino immediately, which made
        // a playable tile disappear and changed the balance of the game.
        if (this._hasLegalPlacement(player, tile)) {
            return { success: false, message: '这块多米诺仍有合法摆放位置，不能弃置', state: this.getPlayerState(player.id) };
        }
        this._startPresentation(player, 'discardDomino', {
            tile: this._publicTile(tile),
            token: token.token,
            tokenNumber: token.token + 1,
            playerColor: player.color,
            round: this.round,
        });
        this._finishPlacement(player, token, `${player.name} 无法摆放第 ${tile.number} 号多米诺，弃置该牌`);
        return this._afterPlacement();
    }

    _finishPlacement(player, token, message) {
        const tokenKey = this._tokenKey(token);
        this.placedTokens.add(tokenKey);
        player.selectedTiles = player.selectedTiles.filter(entry => entry.token !== token.token);
        player.selectedTile = player.selectedTiles[0]?.tile || null;
        player.placedCount += 1;
        this.actionLog.push(message);
        this.lastAction = { playerId: player.id, playerName: player.name, message };
        this.currentQueueIndex += 1;
    }

    _afterPlacement() {
        if (this.currentQueueIndex < this.currentQueue.length) {
            this._updatePresentation({ resolved: true, nextPlayerId: this.currentQueue[this.currentQueueIndex]?.playerId || null });
            return this._success(this.lastAction.message);
        }
        this.players.forEach(player => { player.score = this._score(player); });
        if (this.round >= this.maxRounds || this.deck.length < this._draftSize()) {
            this.status = 'ended'; this.phase = 'ended';
            const online = this._rankedPlayers();
            this.winner = online[0] || null;
            this._updatePresentation({
                resolved: true,
                ended: true,
                standings: online.map(player => this._standing(player)),
                winner: this.winner ? this._standing(this.winner) : null,
            });
            this.actionLog.push(`${this.winner?.name || '无人'} 以 ${this.winner?.score || 0} 分成为王国霸主`);
            return this._success('王国建设完成');
        }
        this.round += 1;
        this.selectionOrder = this.currentQueue.filter(token => this.playerMap[token.playerId]?.isOnline).map(token => ({ ...token }));
        this._openDraft();
        this.currentQueueIndex = 0;
        this.selected.clear();
        this.placedTokens.clear();
        this.players.forEach(player => { player.selectedTiles = []; player.selectedTile = null; });
        this.phase = 'selecting';
        this._appendPresentationEvent(null, 'roundReveal', {
            round: this.round,
            maxRounds: this.maxRounds,
            draft: this._publicDraft(),
            isLastRound: this.round === this.maxRounds,
            remainingTileCount: this.deck.length,
        });
        this._updatePresentation({ resolved: true, nextPlayerId: this.currentQueue[0]?.playerId || null });
        this.actionLog.push(`第 ${this.round} 轮：按照上一轮王冠顺序选择`);
        return this._success(`第 ${this.round} 轮开始`);
    }

    _openDraft() { this.draft = Array.from({ length: this._draftSize() }, () => this.deck.pop()).filter(Boolean); this.currentQueue = this.selectionOrder.filter(token => this.playerMap[token.playerId]?.isOnline); this.currentQueueIndex = 0; }
    _draftSize() { return this.players.length === 3 ? 3 : 4; }
    _selectionTokensForPlayers(randomize = false) { const active = this.players.filter(player => player.isOnline); const kings = active.length === 2 ? 2 : 1; const tokens = Array.from({ length: kings }, (_, token) => active.map(player => ({ playerId: player.id, token }))).flat(); return randomize ? this._shuffle(tokens) : tokens; }
    _tokenKey(token) { return `${token.playerId}:${token.token}`; }
    _orderByDraftSelection() { return this.currentQueue.map(token => ({ token, tile: this.selected.get(this._tokenKey(token)) })).sort((a, b) => a.tile.number - b.tile.number || a.token.token - b.token.token).map(item => item.token); }
    _placementOrderPresentation() {
        return this.currentQueue.map((token, index) => {
            const player = this.playerMap[token.playerId];
            const tile = this.selected.get(this._tokenKey(token));
            return {
                order: index + 1,
                playerId: token.playerId,
                playerName: player?.name || '',
                playerColor: player?.color || '',
                token: token.token,
                tokenNumber: token.token + 1,
                tile: this._publicTile(tile),
            };
        });
    }
    _normalizePlacement(action) { const x1 = Number(action.x1); const y1 = Number(action.y1); const x2 = Number(action.x2); const y2 = Number(action.y2); if (![x1, y1, x2, y2].every(Number.isInteger)) return null; if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return null; return { first: { x: x1, y: y1 }, second: { x: x2, y: y2 } }; }
    _placementOrientation(player, tile, placement) {
        const cells = [placement.first, placement.second];
        if (cells.some(cell => cell.x < 0 || cell.x >= this.boardSize || cell.y < 0 || cell.y >= this.boardSize)) return null;
        if (cells.some(cell => player.grid[`${cell.x},${cell.y}`])) return null;
        const orientations = [
            { terrains: [tile.left, tile.right], crowns: tile.crowns.slice() },
            { terrains: [tile.right, tile.left], crowns: [tile.crowns[1], tile.crowns[0]] },
        ];
        for (const orientation of orientations) {
            const matches = cells.some((cell, index) => this._adjacentKeys(player.grid, cell).some(key => {
                const neighbour = player.grid[key];
                return neighbour.terrain === '城堡' || neighbour.terrain === orientation.terrains[index];
            }));
            if (matches) return orientation;
        }
        return null;
    }
    _canPlace(player, tile, placement) { return Boolean(this._placementOrientation(player, tile, placement)); }
    _hasLegalPlacement(player, tile) {
        for (let x = 0; x < this.boardSize; x += 1) {
            for (let y = 0; y < this.boardSize; y += 1) {
                for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                    const placement = { first: { x, y }, second: { x: x + dx, y: y + dy } };
                    if (this._canPlace(player, tile, placement)) return true;
                }
            }
        }
        return false;
    }
    _applyPlacement(player, tile, placement, orientation = this._placementOrientation(player, tile, placement)) {
        if (!orientation) return false;
        player.grid[`${placement.first.x},${placement.first.y}`] = { terrain: orientation.terrains[0], crowns: orientation.crowns[0], dominoId: tile.id };
        player.grid[`${placement.second.x},${placement.second.y}`] = { terrain: orientation.terrains[1], crowns: orientation.crowns[1], dominoId: tile.id };
        return true;
    }
    _adjacentKeys(grid, cell) { return [[cell.x - 1, cell.y], [cell.x + 1, cell.y], [cell.x, cell.y - 1], [cell.x, cell.y + 1]].map(([x, y]) => `${x},${y}`).filter(key => grid[key]); }
    _castle() { return { terrain: '城堡', crowns: 0, dominoId: 'castle' }; }
    _score(player) {
        const visited = new Set(); let score = 0;
        for (const [key, cell] of Object.entries(player.grid)) { if (cell.terrain === '城堡' || visited.has(key)) continue; const queue = [key]; visited.add(key); let size = 0; let crowns = 0;
            while (queue.length) { const current = queue.shift(); const currentCell = player.grid[current]; size += 1; crowns += currentCell.crowns || 0; const [x, y] = current.split(',').map(Number); for (const adjacent of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { const nextKey = `${adjacent[0]},${adjacent[1]}`; if (!visited.has(nextKey) && player.grid[nextKey]?.terrain === currentCell.terrain) { visited.add(nextKey); queue.push(nextKey); } } }
            score += size * crowns;
        }
        return score;
    }
    _largestTerritory(player) {
        const visited = new Set(); let largest = 0;
        for (const [key, cell] of Object.entries(player.grid)) { if (cell.terrain === '城堡' || visited.has(key)) continue; const queue = [key]; visited.add(key); let size = 0;
            while (queue.length) { const current = queue.shift(); const currentCell = player.grid[current]; size += 1; const [x, y] = current.split(',').map(Number); for (const adjacent of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { const nextKey = `${adjacent[0]},${adjacent[1]}`; if (!visited.has(nextKey) && player.grid[nextKey]?.terrain === currentCell.terrain) { visited.add(nextKey); queue.push(nextKey); } } }
            largest = Math.max(largest, size);
        }
        return largest;
    }
    _totalCrowns(player) { return Object.values(player.grid).reduce((sum, cell) => sum + (cell.crowns || 0), 0); }
    _rankedPlayers() {
        return this.players.filter(player => player.isOnline).sort((a, b) => b.score - a.score || this._largestTerritory(b) - this._largestTerritory(a) || this._totalCrowns(b) - this._totalCrowns(a));
    }
    _standing(player) {
        return {
            id: player.id,
            name: player.name,
            color: player.color,
            score: player.score,
            largestTerritory: this._largestTerritory(player),
            totalCrowns: this._totalCrowns(player),
            placedCount: player.placedCount,
        };
    }
    _shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(this.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
    _publicTile(tile) { return tile ? { id: tile.id, number: tile.number, left: tile.left, right: tile.right, crowns: tile.crowns.slice() } : null; }
    _publicDraft() {
        const claims = new Map();
        for (const [tokenKey, tile] of this.selected.entries()) {
            const separator = tokenKey.lastIndexOf(':');
            const playerId = tokenKey.slice(0, separator);
            const token = Number(tokenKey.slice(separator + 1));
            const player = this.playerMap[playerId];
            claims.set(tile.id, {
                playerId,
                playerName: player?.name || '',
                color: player?.color || '',
                token,
            });
        }
        return this.draft.map(tile => ({ ...this._publicTile(tile), selectedBy: claims.get(tile.id) || null }));
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
                ...clone(data),
            }],
            resolved: false,
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
            ...clone(data),
        });
        return this.presentation;
    }
    _updatePresentation(values = {}) {
        if (this.presentation) Object.assign(this.presentation, clone(values));
    }
    getPublicState() {
        const currentToken = this.currentQueue[this.currentQueueIndex] || null;
        const currentPlayerId = currentToken?.playerId || null;
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            round: this.round,
            maxRounds: this.maxRounds,
            boardSize: this.boardSize,
            draftSize: this._draftSize(),
            remainingTileCount: this.deck.length,
            discardedTileCount: this.discarded.length,
            currentTurn: currentPlayerId,
            currentToken: currentToken ? { ...currentToken } : null,
            currentTurnName: this.playerMap[currentPlayerId]?.name || null,
            draft: this._publicDraft(),
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                score: player.score,
                placedCount: player.placedCount,
                selectionCount: Array.from(this.selected.keys()).filter(key => key.startsWith(`${player.id}:`)).length,
                hasSelection: Array.from(this.selected.keys()).some(key => key.startsWith(`${player.id}:`)),
                isOnline: player.isOnline,
                isCurrentTurn: player.id === currentPlayerId,
            })),
            lastAction: this.lastAction ? clone(this.lastAction) : null,
            actionLog: this.actionLog.slice(-18),
            presentation: this.presentation ? clone(this.presentation) : null,
            winner: this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null,
        };
    }
    getPlayerState(playerId) { const state = this.getPublicState(); const player = this.playerMap[playerId]; const currentToken = this.currentQueue[this.currentQueueIndex]; const currentTile = currentToken?.playerId === playerId ? this.selected.get(this._tokenKey(currentToken)) : null; state.myId = playerId; state.myGrid = player ? clone(player.grid) : {}; state.mySelectedTiles = player ? player.selectedTiles.map(entry => ({ token: entry.token, tile: this._publicTile(entry.tile) })) : []; state.mySelectedTile = this._publicTile(currentTile || player?.selectedTile); state.availableActions = { canSelect: Boolean(player?.isOnline && this.phase === 'selecting' && currentToken?.playerId === playerId), canPlace: Boolean(player?.isOnline && this.phase === 'placing' && currentToken?.playerId === playerId && currentTile && !this.placedTokens.has(this._tokenKey(currentToken))), canDiscard: Boolean(player?.isOnline && this.phase === 'placing' && currentToken?.playerId === playerId && currentTile && !this.placedTokens.has(this._tokenKey(currentToken))) }; return state; }
    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        const currentToken = this.currentQueue[this.currentQueueIndex];
        const wasCurrent = currentToken?.playerId === playerId;
        player.isOnline = false;
        if (this.status === 'playing' && this.players.filter(item => item.isOnline).length < 2) {
            this.status = 'ended'; this.phase = 'ended'; this.winner = this.players.find(item => item.isOnline) || null;
        } else if (this.status === 'playing' && wasCurrent && this.phase === 'selecting') {
            this.currentQueue = this.currentQueue.filter(token => token.playerId !== playerId);
            const fallbackToken = this.currentQueue[this.currentQueueIndex];
            const fallbackTile = this.draft.find(tile => !Array.from(this.selected.values()).some(selected => selected.id === tile.id));
            if (fallbackToken && fallbackTile) {
                const fallback = this.playerMap[fallbackToken.playerId];
                this.selected.set(this._tokenKey(fallbackToken), fallbackTile); fallback.selectedTiles.push({ token: fallbackToken.token, tile: fallbackTile }); fallback.selectedTile = fallbackTile; this.currentQueueIndex += 1;
                if (this.currentQueueIndex >= this.currentQueue.length) { this.phase = 'placing'; this.currentQueue = this._orderByDraftSelection(); this.currentQueueIndex = 0; }
            }
        } else if (this.status === 'playing' && this.phase === 'placing' && this.currentQueue.some(token => token.playerId === playerId)) {
            this.currentQueue = this.currentQueue.filter(token => token.playerId !== playerId);
            player.selectedTiles = [];
            player.selectedTile = null;
            const oldIndex = currentToken ? this.currentQueue.indexOf(currentToken) : -1;
            if (oldIndex >= 0 && oldIndex < this.currentQueueIndex) this.currentQueueIndex -= 1;
            if (!this.currentQueue.length || this.currentQueueIndex >= this.currentQueue.length) return this._afterPlacement();
        }
        this.actionLog.push(`${player.name} 离开了王国建设`);
        return this._success(`${player.name} 已离开`);
    }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null }; }
    getWinner() { return this.winner ? { id: this.winner.id, name: this.winner.name, score: this.winner.score } : null; }
}

module.exports = KingdominoEngine;
module.exports.buildDominoes = buildDominoes;
module.exports.TERRAIN_TYPES = TERRAIN_TYPES;
module.exports.TERRAIN_COLORS = TERRAIN_COLORS;
