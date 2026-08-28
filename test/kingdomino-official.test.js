const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Kingdomino = require('../server/games/kingdomino');
const KingdominoEngine = require('../server/games/kingdomino/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function selectDraft(session) {
    const game = session.engine;
    while (game.phase === 'selecting') {
        const token = game.currentQueue[game.currentQueueIndex];
        const used = new Set([...game.selected.values()].map(tile => tile.id));
        const tile = game.draft.find(candidate => !used.has(candidate.id));
        assert.ok(tile);
        assert.equal(session.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    }
}

test('多米诺王国基础牌组、人数调整、棋盘尺寸和随机顺序符合官方规则', () => {
    const dominoes = KingdominoEngine.buildDominoes();
    assert.equal(dominoes.length, 48);
    assert.deepEqual(dominoes.map(tile => tile.number), Array.from({ length: 48 }, (_, index) => index + 1));
    assert.equal(new Set(dominoes.map(tile => tile.id)).size, 48);
    assert.equal(new Set(dominoes.flatMap(tile => [tile.left, tile.right])).size, 6);

    const setup = [
        [2, 5, 6, 24, 4],
        [3, 5, 12, 36, 3],
        [4, 5, 12, 48, 4],
    ];
    for (const [count, boardSize, rounds, tileCount, draftSize] of setup) {
        const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
        const session = Kingdomino.create(`kingdomino-setup-${count}`, players(ids), { random: lcg(count), startingPlayerId: ids[0] });
        assert.equal(session.start().success, true);
        const game = session.engine;
        assert.equal(game.boardSize, boardSize);
        assert.equal(game.maxRounds, rounds);
        assert.equal(game.deck.length, tileCount - draftSize);
        assert.equal(game.draft.length, draftSize);
        assert.equal(game.getPublicState().remainingTileCount, tileCount - draftSize, '客户端应能显示未揭示地块数量');
        assert.deepEqual(game.presentation.events.map(event => event.kind), ['gameStart', 'roundReveal']);
        assert.deepEqual(game.presentation.events[1].draft.map(tile => tile.id), game.draft.map(tile => tile.id), '第一轮公开领地应进入开场播报');
        assert.equal(game.presentation.resolved, true);
        const castleKey = `${Math.floor(boardSize / 2)},${Math.floor(boardSize / 2)}`;
        assert.ok(game.players.every(player => player.grid[castleKey]?.terrain === '城堡'));
        assert.equal(session.start().success, false, '同一会话不能重复开始');
        assert.equal(session.engine.start().success, false, '引擎不能绕过会话重复开始');
    }

    const mightyDuel = Kingdomino.create('kingdomino-mighty-duel', players(['a', 'b']), { random: lcg(7), mightyDuel: true });
    assert.equal(mightyDuel.start().success, true);
    assert.equal(mightyDuel.engine.boardSize, 7);
    assert.equal(mightyDuel.engine.maxRounds, 12);
    assert.equal(mightyDuel.engine.deck.length + mightyDuel.engine.draft.length, 48);

    const first = Kingdomino.create('kingdomino-seeded-a', players(['a', 'b', 'c', 'd']), { random: lcg(88), startingPlayerId: 'a' });
    const second = Kingdomino.create('kingdomino-seeded-b', players(['a', 'b', 'c', 'd']), { random: lcg(88), startingPlayerId: 'a' });
    first.start(); second.start();
    assert.deepEqual(first.engine.draft, second.engine.draft, '大厅随机源应能复现首轮公开牌');
    assert.deepEqual(first.engine.selectionOrder, second.engine.selectionOrder);
});

test('多米诺王国仅在公开领地确实无人认领时生成移出播报', () => {
    const session = Kingdomino.create('kingdomino-unclaimed', players(['a', 'b', 'c']), { random: lcg(109), startingPlayerId: 'a' });
    assert.equal(session.start().success, true);
    const game = session.engine;
    assert.equal(game.draft.length, 3, '官方三人局每轮只公开三块领地');
    while (game.phase === 'selecting') {
        const token = game.currentQueue[game.currentQueueIndex];
        const tile = game.draft.find(candidate => ![...game.selected.values()].some(item => item.id === candidate.id));
        assert.equal(session.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    }
    assert.equal(game.presentation.events.some(event => event.kind === 'unclaimedDomino'), false, '标准三人局不应虚构第四块落选牌');
});

test('多米诺王国选牌严格按王冠顺序，未选牌弃置且重复选择被拒绝', () => {
    const session = Kingdomino.create('kingdomino-selection', players(['a', 'b', 'c', 'd']), { random: lcg(89), startingPlayerId: 'a' });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const firstToken = game.currentQueue[0];
    const wrongPlayer = game.players.find(player => player.id !== firstToken.playerId);
    assert.equal(session.handleAction(wrongPlayer.id, { kind: 'selectDomino', dominoId: game.draft[0].id }).success, false);
    const chosen = game.draft[0];
    assert.equal(session.handleAction(firstToken.playerId, { kind: 'selectDomino', dominoId: chosen.id }).success, true);
    const publicClaim = game.getPublicState().draft.find(tile => tile.id === chosen.id).selectedBy;
    assert.equal(publicClaim.playerId, firstToken.playerId, '公开牌应标记选择它的国王');
    assert.equal(publicClaim.token, firstToken.token, '二人局的两枚王冠需要保持各自编号');
    assert.equal(game.presentation.events[0].kind, 'selectDomino');
    assert.equal(game.presentation.events[0].tile.id, chosen.id);
    assert.equal(game.presentation.events[0].tokenNumber, firstToken.token + 1);
    assert.equal(session.handleAction(firstToken.playerId, { kind: 'selectDomino', dominoId: game.draft[1].id }).success, false);
    while (game.phase === 'selecting') {
        const token = game.currentQueue[game.currentQueueIndex];
        const tile = game.draft.find(candidate => ![...game.selected.values()].some(item => item.id === candidate.id));
        assert.equal(session.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
    }
    assert.equal(game.phase, 'placing');
    assert.equal(game.selected.size, 4);
    assert.equal(game.discarded.length, 0, '四人局本轮所有公开牌均被选走');
    assert.deepEqual(game.currentQueue.map(token => game.selected.get(game._tokenKey(token)).number), [...game.currentQueue].map(token => game.selected.get(game._tokenKey(token)).number).sort((a, b) => a - b));
    assert.deepEqual(game.presentation.events.map(event => event.kind), ['selectDomino', 'placementPhase']);
    assert.deepEqual(game.presentation.events[1].order.map(item => item.tile.number), game.currentQueue.map(token => game.selected.get(game._tokenKey(token)).number));
});

test('多米诺王国反向摆放会同步交换地形与王冠，且仍遵守相邻规则', () => {
    const game = new KingdominoEngine('kingdomino-orientation', players(['a', 'b']), () => 0);
    assert.equal(game.start().success, true);
    const player = game.players[0];
    player.grid = { '2,2': game._castle(), '1,2': { terrain: '森林', crowns: 0, dominoId: 'existing' } };
    const tile = { id: 'orientation-tile', number: 99, left: '海洋', right: '森林', crowns: [1, 2] };
    const token = { playerId: 'a', token: 0 };
    game.phase = 'placing';
    game.currentQueue = [token];
    game.currentQueueIndex = 0;
    game.selected.set(game._tokenKey(token), tile);
    player.selectedTiles = [{ token: 0, tile }];
    player.selectedTile = tile;
    // The first cell touches the existing forest, so the tile must be flipped:
    // forest/crown-2 first, sea/crown-1 second.
    const result = game.handleAction('a', { kind: 'placeDomino', x1: 1, y1: 1, x2: 1, y2: 0 });
    assert.equal(result.success, true);
    assert.deepEqual(player.grid['1,1'], { terrain: '森林', crowns: 2, dominoId: tile.id });
    assert.deepEqual(player.grid['1,0'], { terrain: '海洋', crowns: 1, dominoId: tile.id });
    assert.equal(game.presentation.events[0].kind, 'placeDomino');
    assert.deepEqual(game.presentation.events[0].placement.terrains, ['森林', '海洋']);
    assert.deepEqual(game.presentation.events[0].placement.crowns, [2, 1]);
    assert.equal(game.presentation.events[0].scoreAfter, game._score(player));
});

test('多米诺王国只有完全无合法位置时才能弃置多米诺', () => {
    const game = new KingdominoEngine('kingdomino-discard', players(['a', 'b']), () => 0);
    assert.equal(game.start().success, true);
    const player = game.players[0];
    const token = { playerId: 'a', token: 0 };
    const tile = { id: 'playable', number: 90, left: '海洋', right: '沼泽', crowns: [0, 0] };
    game.phase = 'placing';
    game.currentQueue = [token];
    game.currentQueueIndex = 0;
    game.selected.set(game._tokenKey(token), tile);
    player.selectedTiles = [{ token: 0, tile }];
    player.selectedTile = tile;
    assert.equal(game.handleAction('a', { kind: 'discardDomino' }).success, false, '城堡旁仍有位置时不得弃置');

    // Leave only two adjacent cells in the corner.  Every neighbouring cell
    // is forest, so this sea/swamp tile has no matching terrain or castle and
    // is genuinely unplayable.
    player.grid = {};
    for (let x = 0; x < game.boardSize; x += 1) {
        for (let y = 0; y < game.boardSize; y += 1) player.grid[`${x},${y}`] = { terrain: '森林', crowns: 0 };
    }
    player.grid['2,2'] = game._castle();
    delete player.grid['0,0'];
    delete player.grid['0,1'];
    assert.equal(game._hasLegalPlacement(player, tile), false);
    assert.equal(game.handleAction('a', { kind: 'discardDomino' }).success, true, '无合法位置时允许弃置');
    assert.equal(game.presentation.events[0].kind, 'discardDomino');
    assert.equal(game.presentation.events[0].tile.id, tile.id);
});

test('多米诺王国按连通地形面积乘王冠计分，并拒绝越界、重叠和无匹配摆放', () => {
    const game = new KingdominoEngine('kingdomino-scoring', players(['a', 'b']), () => 0);
    game.start();
    const player = game.players[0];
    player.grid = {
        '2,2': game._castle(),
        '2,3': { terrain: '麦田', crowns: 1 }, '1,3': { terrain: '麦田', crowns: 0 },
        '2,4': { terrain: '麦田', crowns: 0 }, '0,0': { terrain: '森林', crowns: 2 },
    };
    assert.equal(game._score(player), 5, '三块麦田乘一顶王冠，加上孤立森林两顶王冠');
    const tile = { id: 'invalid', number: 100, left: '海洋', right: '沼泽', crowns: [0, 0] };
    assert.equal(game._canPlace(player, tile, { first: { x: -1, y: 0 }, second: { x: 0, y: 0 } }), false);
    assert.equal(game._canPlace(player, tile, { first: { x: 2, y: 3 }, second: { x: 2, y: 2 } }), false);
    assert.equal(game._canPlace(player, tile, { first: { x: 0, y: 1 }, second: { x: 0, y: 2 } }), false);
});

function runFourPlayerGame(seed) {
    const ids = ['a', 'b', 'c', 'd'];
    const room = new Room(`kingdomino-full-${seed}`, 'a', 'a', 'kingdomino', { random: lcg(seed), startingPlayerId: 'a' });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    let steps = 0;
    const trace = [];
    const presentationKinds = [];
    while (game.status === 'playing' && steps < 1000) {
        if (game.phase === 'selecting') {
            const token = game.currentQueue[game.currentQueueIndex];
            const used = new Set([...game.selected.values()].map(tile => tile.id));
            const tile = game.draft.find(candidate => !used.has(candidate.id));
            const result = room.handleGameAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id });
            assert.equal(result.success, true, `${seed}: 选牌失败：${result.message}`);
            trace.push(`${token.playerId}:select-${tile.number}`);
            presentationKinds.push(...(game.presentation?.events || []).map(event => event.kind));
        } else if (game.phase === 'placing') {
            const token = game.currentQueue[game.currentQueueIndex];
            const tile = game.selected.get(game._tokenKey(token));
            const player = game.playerMap[token.playerId];
            let placement = null;
            for (let x = 0; x < game.boardSize && !placement; x += 1) {
                for (let y = 0; y < game.boardSize && !placement; y += 1) {
                    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                        const candidate = { first: { x, y }, second: { x: x + dx, y: y + dy } };
                        if (game._canPlace(player, tile, candidate)) placement = candidate;
                    }
                }
            }
            let result;
            if (placement) {
                result = room.handleGameAction(player.id, { kind: 'placeDomino', x1: placement.first.x, y1: placement.first.y, x2: placement.second.x, y2: placement.second.y });
                trace.push(`${player.id}:place-${tile.number}`);
            } else {
                result = room.handleGameAction(player.id, { kind: 'discardDomino' });
                trace.push(`${player.id}:discard-${tile.number}`);
            }
            assert.equal(result.success, true, `${seed}: 摆放失败：${result.message}`);
            presentationKinds.push(...(game.presentation?.events || []).map(event => event.kind));
        } else assert.fail(`${seed}: 未处理阶段 ${game.phase}`);
        steps += 1;
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未正常结束`);
    assert.equal(game.phase, 'ended');
    assert.equal(game.round, 12);
    assert.ok(game.winner);
    assert.equal(game.players.every(player => player.placedCount === 12), true);
    assert.ok(steps < 1000);
    assert.equal(trace.length, 96, '四人局应有 12 轮 × 4 次选牌和 4 次摆放');
    assert.ok(presentationKinds.includes('placementPhase'));
    assert.ok(presentationKinds.includes('roundReveal'));
    assert.equal(game.presentation.ended, true);
    assert.deepEqual(game.presentation.standings.map(player => player.id), game._rankedPlayers().map(player => player.id));
    assert.equal(game.presentation.winner.id, game.winner.id);
    assert.ok(game.presentation.standings.every(player => Number.isInteger(player.largestTerritory) && Number.isInteger(player.totalCrowns)));
    return { game, steps, trace, presentationKinds };
}

test('多米诺王国四人最大人数从选牌、排序、摆放到结算完整运行三局', () => {
    const runs = [runFourPlayerGame(501), runFourPlayerGame(502), runFourPlayerGame(503)];
    assert.deepEqual(runs.map(run => run.game.players.length), [4, 4, 4]);
    assert.ok(runs.every(run => run.game.winner));
});
