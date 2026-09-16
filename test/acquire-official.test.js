const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const Acquire = require('../server/games/acquire');
const AcquireEngine = require('../server/games/acquire/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function lcg(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

test('并购基础设置、起始地块顺序、牌库和私有手牌符合经典版规则', () => {
    for (const count of [2, 3, 4, 5, 6]) {
        const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
        const session = Acquire.create(`acquire-setup-${count}`, players(ids), { random: lcg(count) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        assert.equal(game.deck.length, 108 - count - count * 6);
        assert.equal(game.startingTiles.length, count);
        assert.equal(Object.keys(game.board).length, count);
        assert.ok(Object.values(game.board).every(cell => cell.chain === null), '起始地块不能自动组成集团');
        assert.ok(game.players.every(player => player.hand.length === 6));
        const ordered = game.startingTiles.slice().sort((a, b) => game._tileNumber(a.tile) - game._tileNumber(b.tile));
        assert.equal(game.players[game.currentTurnIndex].id, ordered[0].playerId);
        assert.equal(game.presentation.events[0].kind, 'startSetup');
        assert.deepEqual(game.presentation.events[0].startingTiles.map(entry => entry.tile.id), ordered.map(entry => entry.tile.id));
        assert.equal(game.presentation.events[0].firstPlayer.id, ordered[0].playerId);
        assert.equal(game.presentation.blocking, true);
        assert.equal(game.presentation.events[0].startedAt, game.presentation.startedAt);
        assert.equal(game.presentation.events[0].endsAt, game.presentation.endsAt);
        assert.equal(game.presentation.durationMs, game.presentation.endsAt - game.presentation.startedAt);
        assert.ok(game.getPlayerState(ids[0]).presentation.serverNow >= game.presentation.startedAt);
        assert.equal(session.start().success, false, '同一会话不能重复开始');
        assert.equal(game.start().success, false, '引擎不能绕过会话重复开始');
    }
    const first = Acquire.create('acquire-seeded-a', players(['a', 'b', 'c', 'd']), { random: lcg(90) });
    const second = Acquire.create('acquire-seeded-b', players(['a', 'b', 'c', 'd']), { random: lcg(90) });
    first.start(); second.start();
    assert.deepEqual(first.engine.startingTiles, second.engine.startingTiles);
    assert.deepEqual(first.engine.players.map(player => player.hand), second.engine.players.map(player => player.hand));
});

test('并购创建集团发放创始人股票，回合结束给刚行动玩家补牌', () => {
    const session = Acquire.create('acquire-founder', players(['a', 'b']), { random: lcg(91) });
    assert.equal(session.start().success, true);
    const game = session.engine;
    const current = game.players[game.currentTurnIndex];
    const next = game.players[game._nextOnlineIndex(game.currentTurnIndex)];
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: null } };
    const originalHand = current.hand.slice(1);
    current.hand = [{ id: 'A2', row: 0, col: 1 }, ...originalHand];
    game.deck = game.deck.filter(tile => tile.id !== 'A2');
    assert.equal(game.handleAction(current.id, { kind: 'placeTile', tileId: 'A2' }).success, true);
    assert.equal(game.phase, 'foundation');
    assert.equal(game.presentation.events[0].kind, 'placeTile');
    assert.equal(game.presentation.events[0].resultKind, 'foundation');
    assert.equal(game.presentation.events[0].tile.id, 'A2');
    const chain = Object.values(game.corporations).find(corporation => !corporation.active);
    assert.equal(game.handleAction(current.id, { kind: 'foundChain', chainId: chain.id }).success, true);
    assert.equal(current.shares[chain.id], 1, '创始人应获得一股免费股票');
    assert.equal(game.presentation.events[0].kind, 'foundChain');
    assert.equal(game.presentation.events[0].founderShare, 1);
    assert.deepEqual(new Set(game.presentation.events[0].chain.tileIds), new Set(['A1', 'A2']));
    assert.equal(game.handleAction(current.id, { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(current.hand.length, 6, '刚完成回合的玩家应补回一块地块');
    assert.equal(next.hand.length, 6, '下一位玩家不能在回合开始前被错误摸牌');
});

test('并购集团价格、创始人红利和多数/少数股东红利符合规则', () => {
    const game = new AcquireEngine('acquire-bonuses', players(['a', 'b', 'c']), () => 0);
    game.start();
    const corporation = game.corporations.sackson;
    corporation.active = true;
    corporation.tiles = ['A1', 'A2'];
    game.players.forEach(player => { player.cash = 0; player.shares.sackson = 0; });
    game.players[0].shares.sackson = 1;
    const onlyHolder = game._payMergerBonuses('sackson');
    assert.equal(game.players[0].cash, 3000, '唯一股东应同时获得多数和少数红利');
    assert.deepEqual(onlyHolder.payouts.map(entry => entry.total), [3000]);

    game.players.forEach(player => { player.cash = 0; player.shares.sackson = 0; });
    game.players[0].shares.sackson = 1;
    game.players[1].shares.sackson = 1;
    game._payMergerBonuses('sackson');
    assert.deepEqual(game.players.map(player => player.cash), [1500, 1500, 0], '多数平局应平分合并后的两项红利');

    game.players.forEach(player => { player.cash = 0; player.shares.sackson = 0; });
    game.players[0].shares.sackson = 2;
    game.players[1].shares.sackson = 1;
    game.players[2].shares.sackson = 1;
    game._payMergerBonuses('sackson');
    assert.deepEqual(game.players.map(player => player.cash), [2000, 500, 500], '少数平局应平分少数股东红利');
});

test('并购安全集团只能阻止两个安全集团合并，单个安全集团可吞并小集团', () => {
    const session = Acquire.create('acquire-safe', players(['a', 'b']), { random: lcg(92) });
    session.start();
    const game = session.engine;
    const current = game.players[game.currentTurnIndex];
    game.corporations.sackson.active = true;
    game.corporations.sackson.tiles = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true;
    game.corporations.imperial.tiles = ['A4', 'A5'];
    game.board = {
        A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' },
        A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' },
    };
    current.hand = [{ id: 'A3', row: 0, col: 2 }];
    assert.equal(game.handleAction(current.id, { kind: 'placeTile', tileId: 'A3' }).success, true);
    assert.equal(game.phase, 'merger');
    assert.equal(game.presentation.events[0].kind, 'placeTile');
    assert.equal(game.presentation.events[0].resultKind, 'merger');
    assert.deepEqual(new Set(game.presentation.events[0].adjacentChainIds), new Set(['sackson', 'imperial']));
    game.pendingMerger = null; game.phase = 'place'; delete game.board.A3;
    game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    current.hand = [{ id: 'A3', row: 0, col: 2 }];
    assert.equal(game.handleAction(current.id, { kind: 'placeTile', tileId: 'A3' }).success, false);
    assert.equal(game.players[game.currentTurnIndex].hand.length, 1);
});

test('并购集团首次达到十一格时生成安全集团里程碑播报', () => {
    const session = Acquire.create('acquire-safe-milestone', players(['a', 'b']), { random: lcg(122) });
    session.start();
    const game = session.engine;
    const current = game.players[game.currentTurnIndex];
    game.corporations.sackson.active = true;
    game.corporations.sackson.tiles = Array.from({ length: 10 }, (_, index) => `X${index + 1}`);
    game.board = { A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' } };
    current.hand = [{ id: 'A2', row: 0, col: 1 }];
    assert.equal(game.handleAction(current.id, { kind: 'placeTile', tileId: 'A2' }).success, true);
    assert.deepEqual(game.presentation.events.map(event => event.kind), ['placeTile', 'safeChain']);
    assert.equal(game.presentation.events[1].chain.size, 11);
    assert.equal(game.presentation.events[1].chain.safe, true);
});

test('并购只有永久不可玩地块可以弃置，终局会发放红利并清算股票', () => {
    const session = Acquire.create('acquire-end', players(['a', 'b']), { random: lcg(93) });
    session.start();
    const game = session.engine;
    const current = game.players[game.currentTurnIndex];
    game.corporations.sackson.active = true;
    game.corporations.sackson.tiles = Array.from({ length: 41 }, (_, index) => `A${index + 1}`);
    game.corporations.imperial.active = true;
    game.corporations.imperial.tiles = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);
    game.board = {
        A1: { id: 'A1', row: 0, col: 0, chain: 'sackson' }, A2: { id: 'A2', row: 0, col: 1, chain: 'sackson' },
        A4: { id: 'A4', row: 0, col: 3, chain: 'imperial' }, A5: { id: 'A5', row: 0, col: 4, chain: 'imperial' },
    };
    current.hand = [{ id: 'A3', row: 0, col: 2 }, { id: 'C1', row: 2, col: 2 }];
    assert.equal(game.handleAction(current.id, { kind: 'discardTile', tileId: 'C1' }).success, false, '可铺设地块不能伪装成不可玩地块');
    assert.equal(game.handleAction(current.id, { kind: 'discardTile', tileId: 'A3' }).success, true, '两个安全集团之间的永久不可玩地块可以弃置');
    assert.equal(game.presentation.events[0].kind, 'discardTile');
    assert.equal(game.presentation.events[0].tile.id, 'A3');
    game.phase = 'buy';
    game.currentTurnIndex = game.players.indexOf(current);
    current.shares.sackson = 2;
    current.cash = 5000;
    assert.equal(game.getPlayerState(current.id).availableActions.canEndGame, true);
    assert.equal(game.handleAction(current.id, { kind: 'endGame' }).success, true);
    assert.equal(game.presentation.events[0].kind, 'endGameDeclared');
    assert.equal(game.status, 'playing');
    assert.equal(game.handleAction(current.id, { kind: 'buyShares', orders: {} }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(current.shares.sackson, 0);
    assert.ok(current.cash > 5000, '终局应包含集团红利和股票清算');
    assert.deepEqual(game.presentation.events.map(event => event.kind), ['buyShares', 'finalSettlement']);
    assert.equal(game.presentation.events[0].endsAt, game.presentation.events[1].startedAt, '同一批播报必须串行排期');
    assert.equal(game.presentation.endsAt, game.presentation.events[1].endsAt);
    assert.equal(game.presentation.ended, true);
    assert.equal(game.presentation.winner.id, game.winner.id);
    assert.ok(game.presentation.standings.every(player => player.cashBefore + player.bonuses + player.liquidation === player.finalCash));
    assert.ok(game.presentation.events[1].chainSettlements.length >= 2);
    assert.ok(game.presentation.events[1].chainSettlements.every(item => item.chain && Array.isArray(item.payouts) && Array.isArray(item.liquidations)));
    const finalEvent = game.presentation.events[1];
    assert.equal(finalEvent.segments.length, finalEvent.chainSettlements.length + 1);
    assert.equal(finalEvent.segments[0].startedAt, finalEvent.startedAt);
    assert.equal(finalEvent.segments.at(-1).kind, 'finalOutcome');
    assert.equal(finalEvent.segments.at(-1).endsAt, finalEvent.endsAt);
    for (let index = 1; index < finalEvent.segments.length; index += 1) {
        assert.equal(finalEvent.segments[index - 1].endsAt, finalEvent.segments[index].startedAt, '终局子段必须串行排期');
    }
});

test('并购在在线房间中由服务端锁定播报时段', () => {
    const room = new Room('acquire-server-clock', 'a', 'a', 'acquire', { random: lcg(180) }, { readyCheckEnabled: true });
    for (const id of ['a', 'b']) assert.equal(room.addPlayer({ id, name: id }).success, true);
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    const current = game.players[game.currentTurnIndex];
    const tile = current.hand.find(candidate => game._isTilePlayable(candidate));
    assert.ok(tile);
    const blocked = room.handleGameAction(current.id, { kind: 'placeTile', tileId: tile.id });
    assert.equal(blocked.success, false);
    assert.match(blocked.message, /播报结束/);
    game.presentation.endsAt = Date.now() - 1;
    assert.equal(room.handleGameAction(current.id, { kind: 'placeTile', tileId: tile.id }).success, true);
});

test('并购的服务端队列保留未结束播报且不会相互覆盖', () => {
    const game = new AcquireEngine('acquire-presentation-queue', players(['a', 'b']), lcg(181));
    assert.equal(game.start().success, true);
    const opening = game.presentation;
    assert.equal(game.handlePlayerLeave('b').success, true);
    const finale = game.presentation;
    assert.notEqual(finale.sequence, opening.sequence);
    assert.equal(finale.startedAt, opening.endsAt);
    const state = game.getPlayerState('a');
    assert.deepEqual(state.presentations.map(batch => batch.sequence), [opening.sequence, finale.sequence]);
    assert.equal(state.presentations[0].endsAt, state.presentations[1].startedAt);
});

function runSixPlayerGame(seed) {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const room = new Room(`acquire-full-${seed}`, 'a', 'a', 'acquire', { random: lcg(seed) });
    ids.forEach(id => assert.equal(room.addPlayer({ id, name: id }).success, true));
    assert.equal(room.startGame().success, true);
    const game = room.game.engine;
    let steps = 0;
    const presentationKinds = [];
    let lastPresentationSequence = 0;
    while (game.status === 'playing' && steps < 10000) {
        const current = game.phase === 'merger_settlement'
            ? game.playerMap[game.pendingMerger.queue[game.pendingMerger.queueIndex]]
            : game.players[game.currentTurnIndex];
        let result;
        if (game.phase === 'place') {
            result = null;
            for (const tile of current.hand.slice()) {
                const attempt = game.handleAction(current.id, { kind: 'placeTile', tileId: tile.id });
                if (attempt.success) { result = attempt; break; }
            }
            if (!result) {
                const discardable = current.hand.find(tile => game._isPermanentlyUnplayable(tile));
                if (discardable) result = game.handleAction(current.id, { kind: 'discardTile', tileId: discardable.id });
                else result = game.handleAction(current.id, { kind: 'skipPlacement' });
            }
        } else if (game.phase === 'foundation') {
            const chain = Object.values(game.corporations).find(corporation => !corporation.active);
            result = game.handleAction(current.id, { kind: 'foundChain', chainId: chain.id });
        } else if (game.phase === 'merger') {
            const chainId = game.pendingMerger.chains.slice().sort((a, b) => game.corporations[b].tiles.length - game.corporations[a].tiles.length)[0];
            result = game.handleAction(current.id, { kind: 'chooseMerger', chainId });
        } else if (game.phase === 'merger_settlement') {
            const chainId = game.pendingMerger.queueChainId;
            result = game.handleAction(current.id, { kind: 'settleMergerShares', chainId, sell: current.shares[chainId], trade: 0, keep: 0 });
        } else if (game.phase === 'buy') {
            const chain = Object.values(game.corporations).find(corporation => corporation.active && corporation.sharesAvailable > 0 && corporation.sharePrice <= current.cash);
            result = game.handleAction(current.id, { kind: 'buyShares', orders: chain ? { [chain.id]: 1 } : {} });
        } else assert.fail(`未处理阶段 ${game.phase}`);
        assert.equal(result?.success, true, `${seed}: ${result?.message}`);
        if ((game.presentation?.sequence || 0) > lastPresentationSequence) {
            lastPresentationSequence = game.presentation.sequence;
            presentationKinds.push(...game.presentation.events.map(event => event.kind));
        }
        steps += 1;
    }
    assert.equal(game.status, 'ended', `种子 ${seed} 未自然结束`);
    assert.ok(game.winner);
    assert.equal(game.players.length, 6);
    assert.ok(steps < 10000);
    return { game, steps, presentationKinds };
}

test('并购六人最大人数从起始地块、建集团、合并、购股到终局连续完整运行三局', () => {
    const runs = [runSixPlayerGame(601), runSixPlayerGame(602), runSixPlayerGame(603)];
    assert.ok(runs.every(run => run.game.status === 'ended' && run.game.winner));
    assert.ok(runs.every(run => run.presentationKinds.includes('placeTile')
        && run.presentationKinds.includes('foundChain')
        && run.presentationKinds.includes('merger')
        && run.presentationKinds.includes('mergerBonuses')
        && run.presentationKinds.includes('settleShares')
        && run.presentationKinds.includes('mergerComplete')
        && run.presentationKinds.includes('buyShares')
        && run.presentationKinds.includes('finalSettlement')));
});
