'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Room = require('../server/room');
const KingdominoEngine = require('../server/games/kingdomino/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);
const finalEventOf = state => eventsOf(state).findLast(event => event.kind === 'finalSettlement');

function assertTimeline(state) {
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(Array.isArray(state.presentations));
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        assert.ok(Number.isFinite(batch.serverNow));
        for (let index = 0; index < batch.events.length; index += 1) {
            const event = batch.events[index];
            assert.equal(event.sequence, event.eventId);
            assert.ok(event.endsAt > event.startedAt);
            assert.equal(event.durationMs, event.endsAt - event.startedAt);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt, '同批事件必须严格串行');
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt, '跨批播报必须 FIFO 串接');
    }
    if (state.presentations.length) {
        assert.equal(state.presentation.sequence, state.presentations.at(-1).sequence);
        assert.equal(state.presentation.endsAt, state.presentations.at(-1).endsAt);
    }
    return state;
}

function chooseCurrentDomino(game) {
    const token = game.currentQueue[game.currentQueueIndex];
    const used = new Set([...game.selected.values()].map(tile => tile.id));
    const tile = game.draft.find(candidate => !used.has(candidate.id));
    assert.ok(token && tile);
    assert.equal(game.handleAction(token.playerId, { kind: 'selectDomino', dominoId: tile.id }).success, true);
}

function prepareLastPlacement(game, { tied = false } = {}) {
    const actor = game.players[0];
    const tile = {
        id: tied ? 'final-tie' : 'final-sole',
        number: 99,
        left: '麦田',
        right: '麦田',
        crowns: tied ? [0, 0] : [1, 0],
    };
    const castleKey = `${Math.floor(game.boardSize / 2)},${Math.floor(game.boardSize / 2)}`;
    for (const player of game.players) {
        player.grid = { [castleKey]: game._castle() };
        player.score = 0;
        player.selectedTiles = [];
        player.selectedTile = null;
    }
    if (tied) {
        for (const [index, player] of game.players.slice(1).entries()) {
            player.grid['2,3'] = { terrain: '森林', crowns: 0, dominoId: `tie-peer-${index}` };
            player.grid['2,4'] = { terrain: '森林', crowns: 0, dominoId: `tie-peer-${index}` };
        }
    }
    actor.selectedTiles = [{ token: 0, tile }];
    actor.selectedTile = tile;
    game.status = 'playing';
    game.phase = 'placing';
    game.round = game.maxRounds;
    game.deck = [];
    game.currentQueue = [{ playerId: actor.id, token: 0 }];
    game.currentQueueIndex = 0;
    game.selected = new Map([[`${actor.id}:0`, tile]]);
    game.placedTokens = new Set();
    return game.handleAction(actor.id, {
        kind: 'placeDomino',
        x1: 2,
        y1: 3,
        x2: 2,
        y2: 4,
    });
}

test('多米诺王国开局使用服务器绝对时间轴串行播放开场与首轮揭晓', () => {
    let now = 10_000;
    const game = new KingdominoEngine('kingdomino-presentation-opening', players(['a', 'b']), () => 0, { now: () => now });
    assert.equal(game.start().success, true);
    const state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations.length, 1);
    assert.equal(state.presentations[0].startedAt, now);
    assert.deepEqual(state.presentations[0].events.map(event => event.kind), ['gameStart', 'roundReveal']);
    assert.equal(state.presentations[0].events[0].startedAt, now);
    assert.equal(state.presentations[0].events[0].endsAt, state.presentations[0].events[1].startedAt);
});

test('多米诺王国最后一次认领把认领和摆放阶段排入同批，连续行动跨批 FIFO', () => {
    let now = 20_000;
    const game = new KingdominoEngine('kingdomino-presentation-claim', players(['a', 'b']), () => 0, { now: () => now });
    game.start();
    const openingEnd = game.getPublicState().presentation.endsAt;
    while (game.phase === 'selecting') chooseCurrentDomino(game);

    const state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations[1].startedAt, openingEnd);
    assert.equal(state.presentations.length, 5);
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['selectDomino', 'placementPhase']);
    assert.equal(state.presentations.at(-1).events[0].endsAt, state.presentations.at(-1).events[1].startedAt);
});

test('多米诺王国最后摆放与换轮或终局结算分别保持同批顺序', () => {
    let now = 30_000;
    const transition = new KingdominoEngine('kingdomino-presentation-transition', players(['a', 'b']), () => 0, { now: () => now });
    transition.start();
    transition.round = 1;
    transition.phase = 'placing';
    transition.currentQueue = [{ playerId: 'a', token: 0 }];
    transition.currentQueueIndex = 0;
    const transitionTile = { id: 'transition', number: 90, left: '麦田', right: '麦田', crowns: [0, 0] };
    transition.selected = new Map([['a:0', transitionTile]]);
    transition.players[0].selectedTiles = [{ token: 0, tile: transitionTile }];
    transition.players[0].selectedTile = transitionTile;
    assert.equal(transition.handleAction('a', { kind: 'placeDomino', x1: 2, y1: 3, x2: 2, y2: 4 }).success, true);
    let state = assertTimeline(transition.getPublicState());
    assert.equal(transition.phase, 'selecting');
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['placeDomino', 'roundReveal']);

    now = 31_000;
    const finale = new KingdominoEngine('kingdomino-presentation-finale-order', players(['a', 'b']), () => 0, { now: () => now });
    finale.start();
    assert.equal(prepareLastPlacement(finale).success, true);
    state = assertTimeline(finale.getPublicState());
    assert.equal(finale.status, 'ended');
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['placeDomino', 'finalSettlement']);
    assert.equal(finalEventOf(state).reason, 'points');
    assert.equal(state.endReason, 'points');
    assert.equal(state.presentations.at(-1).endReason, 'points');
});

test('多米诺王国 Room 在公共播报截止前拒绝下一步操作', () => {
    const realNow = Date.now;
    let now = 40_000;
    Date.now = () => now;
    try {
        const room = new Room('kingdomino-presentation-lock', 'a', '玩家a', 'kingdomino', { random: () => 0 }, { readyCheckEnabled: true });
        assert.equal(room.addPlayer({ id: 'a', name: '玩家a' }).success, true);
        assert.equal(room.addPlayer({ id: 'b', name: '玩家b' }).success, true);
        assert.equal(room.setPlayerReady('b', true).success, true);
        assert.equal(room.startGame().success, true);

        const game = room.game.engine;
        const opening = room.getPlayerGameState('a').presentation;
        const firstToken = game.currentQueue[game.currentQueueIndex];
        const firstTile = game.draft[0];
        const rejected = room.handleGameAction(firstToken.playerId, { kind: 'selectDomino', dominoId: firstTile.id });
        assert.equal(rejected.success, false);
        assert.match(rejected.message, /播报结束/);

        now = Number(opening.endsAt) + 1;
        assert.equal(room.handleGameAction(firstToken.playerId, { kind: 'selectDomino', dominoId: firstTile.id }).success, true);
        const actionPresentation = room.getPlayerGameState('a').presentation;
        const nextToken = game.currentQueue[game.currentQueueIndex];
        const nextTile = game.draft.find(tile => ![...game.selected.values()].some(selected => selected.id === tile.id));
        const secondRejected = room.handleGameAction(nextToken.playerId, { kind: 'selectDomino', dominoId: nextTile.id });
        assert.equal(secondRejected.success, false);
        assert.match(secondRejected.message, /播报结束/);
        assert.ok(actionPresentation.endsAt > now);
    } finally {
        Date.now = realNow;
    }
});

test('多米诺王国重连时本地化未结束批次，过期批次不重播', async () => {
    const { localizePresentation } = await import('../public/games/kingdomino/state.js');
    const batch = {
        sequence: 7,
        serverNow: 50_000,
        startedAt: 49_000,
        endsAt: 52_000,
        events: [
            { eventId: 10, kind: 'gameStart', startedAt: 49_000, endsAt: 50_000 },
            { eventId: 11, kind: 'roundReveal', startedAt: 50_000, endsAt: 52_000 },
        ],
    };
    const localized = localizePresentation(batch, 90_000);
    assert.equal(localized.startedAt, 89_000);
    assert.equal(localized.endsAt, 92_000);
    assert.equal(localized.events[0].endsAt, 90_000);
    assert.equal(localized.events[1].startedAt, 90_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 50_000 }, 90_000), null);

    const client = fs.readFileSync('public/games/kingdomino/client.js', 'utf8');
    const scene = fs.readFileSync('public/games/kingdomino/scene.js', 'utf8');
    assert.match(client, /localizePresentation/);
    assert.match(client, /state\.presentations/);
    assert.match(client, /scene\.enqueuePresentation/);
    assert.match(scene, /presentationLockedUntil/);
    assert.match(scene, /function waitUntil\(/);
});

test('多米诺王国单独胜者只在自己视角看到“您已获胜”且不改变公共时间槽', () => {
    let now = 60_000;
    const game = new KingdominoEngine('kingdomino-presentation-sole-winner', players(['a', 'b', 'c']), () => 0, { now: () => now });
    game.start();
    assert.equal(prepareLastPlacement(game).success, true);

    const publicEvent = finalEventOf(game.getPublicState());
    const winnerEvent = finalEventOf(game.getPlayerState('a'));
    const opponentEvent = finalEventOf(game.getPlayerState('b'));
    assert.deepEqual(publicEvent.winnerIds, ['a']);
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(opponentEvent.viewerVariant, undefined);
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
});

test('多米诺王国三人完全同分时所有并列胜者共用同一结算时间槽', () => {
    let now = 70_000;
    const game = new KingdominoEngine('kingdomino-presentation-tied-winners', players(['a', 'b', 'c']), () => 0, { now: () => now });
    game.start();
    assert.equal(prepareLastPlacement(game, { tied: true }).success, true);

    const publicEvent = finalEventOf(game.getPublicState());
    assert.deepEqual(new Set(publicEvent.winnerIds), new Set(['a', 'b', 'c']));
    for (const id of ['a', 'b', 'c']) {
        const event = finalEventOf(game.getPlayerState(id));
        assert.equal(event.title, '您已并列获胜');
        assert.equal(event.viewerVariant, 'personalVictory');
        assert.equal(event.startedAt, publicEvent.startedAt);
        assert.equal(event.endsAt, publicEvent.endsAt);
    }
    const lobbyWinner = game.getWinner();
    assert.equal(lobbyWinner.shared, true);
    assert.deepEqual(new Set(lobbyWinner.winners.map(winner => winner.id)), new Set(['a', 'b', 'c']));
});

test('多米诺王国摆放阶段永久离场会正确修正已行动、当前和未来席位', () => {
    function preparedGame(suffix) {
        const game = new KingdominoEngine(`kingdomino-placement-leave-${suffix}`, players(['a', 'b', 'c', 'd']), () => 0, { now: () => 75_000 });
        game.start();
        game.phase = 'placing';
        game.currentQueue = ['a', 'b', 'c', 'd'].map(playerId => ({ playerId, token: 0 }));
        game.currentQueueIndex = 1;
        game.selectionOrder = game.currentQueue.map(token => ({ ...token }));
        game.selected = new Map();
        game.placedTokens = new Set(['a:0']);
        for (const [index, player] of game.players.entries()) {
            const tile = { id: `leave-tile-${player.id}`, number: 80 + index, left: '麦田', right: '森林', crowns: [0, 0] };
            game.selected.set(`${player.id}:0`, tile);
            player.selectedTiles = [{ token: 0, tile }];
            player.selectedTile = tile;
        }
        return game;
    }

    for (const scenario of [
        { leaverId: 'a', expectedCurrent: 'b', discarded: false },
        { leaverId: 'b', expectedCurrent: 'c', discarded: true },
        { leaverId: 'd', expectedCurrent: 'b', discarded: true },
    ]) {
        const game = preparedGame(scenario.leaverId);
        assert.equal(game.handlePlayerLeave(scenario.leaverId).success, true);
        assert.equal(game.status, 'playing');
        assert.equal(game.currentQueue[game.currentQueueIndex]?.playerId, scenario.expectedCurrent);
        assert.equal(game.currentQueue.some(token => token.playerId === scenario.leaverId), false);
        assert.equal(game.selectionOrder.some(token => token.playerId === scenario.leaverId), false);
        assert.equal([...game.selected.keys()].some(key => key.startsWith(`${scenario.leaverId}:`)), false);
        const events = game.getPublicState().presentations.at(-1).events;
        assert.equal(events[0].kind, 'playerLeft');
        assert.equal(events.some(event => event.kind === 'discardDomino'), scenario.discarded);
        if (scenario.discarded) assert.equal(events.find(event => event.kind === 'discardDomino').reason, 'playerLeave');
    }
});

test('多米诺王国永久离场席位不再进入后续队列，人数不足按 players 原因收束', () => {
    let now = 80_000;
    const ongoing = new KingdominoEngine('kingdomino-presentation-leave-ongoing', players(['a', 'b', 'c', 'd']), () => 0, { now: () => now });
    ongoing.start();
    const currentId = ongoing.currentQueue[ongoing.currentQueueIndex].playerId;
    const leaver = ongoing.players.find(player => player.id !== currentId);
    assert.equal(ongoing.handlePlayerLeave(leaver.id).success, true);
    let state = assertTimeline(ongoing.getPublicState());
    assert.equal(ongoing.status, 'playing');
    assert.equal(ongoing.playerMap[leaver.id].isOnline, false);
    assert.equal(ongoing.currentQueue.some(token => token.playerId === leaver.id), false);
    assert.equal(ongoing.selectionOrder.some(token => token.playerId === leaver.id), false);
    assert.equal(state.presentations.at(-1).events.at(-1).kind, 'playerLeft');
    while (ongoing.phase === 'selecting') chooseCurrentDomino(ongoing);
    state = assertTimeline(ongoing.getPublicState());
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['selectDomino', 'unclaimedDomino', 'placementPhase']);

    now = 81_000;
    const closing = new KingdominoEngine('kingdomino-presentation-leave-closing', players(['a', 'b']), () => 0, { now: () => now });
    closing.start();
    assert.equal(closing.handlePlayerLeave('b').success, true);
    state = assertTimeline(closing.getPublicState());
    assert.equal(closing.status, 'ended');
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['playerLeft', 'finalSettlement']);
    const final = finalEventOf(state);
    assert.equal(final.reason, 'players');
    assert.equal(final.outcome, 'lastPlayerStanding');
    assert.deepEqual(final.winnerIds, ['a']);
    const personal = finalEventOf(closing.getPlayerState('a'));
    assert.equal(personal.viewerVariant, 'personalVictory');
    assert.equal(personal.startedAt, final.startedAt);
    assert.equal(personal.endsAt, final.endsAt);
});

test('多米诺王国两人局离场会弃置该席位全部未摆放领地后再统一结算', () => {
    const game = new KingdominoEngine('kingdomino-presentation-multi-token-leave', players(['a', 'b']), () => 0, { now: () => 90_000 });
    game.start();
    game.phase = 'placing';
    game.currentQueue = [
        { playerId: 'a', token: 0 }, { playerId: 'b', token: 0 },
        { playerId: 'a', token: 1 }, { playerId: 'b', token: 1 },
    ];
    game.currentQueueIndex = 0;
    game.selectionOrder = game.currentQueue.map(token => ({ ...token }));
    game.selected = new Map();
    game.placedTokens = new Set();
    for (const token of game.currentQueue) {
        const tile = { id: `multi-${token.playerId}-${token.token}`, number: 90 + token.token, left: '麦田', right: '森林', crowns: [0, 0] };
        game.selected.set(`${token.playerId}:${token.token}`, tile);
        game.playerMap[token.playerId].selectedTiles.push({ token: token.token, tile });
        game.playerMap[token.playerId].selectedTile ||= tile;
    }

    assert.equal(game.handlePlayerLeave('b').success, true);
    const events = game.getPublicState().presentations.at(-1).events;
    assert.deepEqual(events.map(event => event.kind), ['playerLeft', 'discardDomino', 'discardDomino', 'finalSettlement']);
    assert.ok(events.slice(1, 3).every(event => event.reason === 'playerLeave'));
    assert.equal(game.discarded.filter(tile => tile.id.startsWith('multi-b-')).length, 2);
    assert.equal(game.currentQueue.some(token => token.playerId === 'b'), false);
    assert.equal(game.selectionOrder.some(token => token.playerId === 'b'), false);
    assert.deepEqual(events.at(-1).winnerIds, ['a']);
});
