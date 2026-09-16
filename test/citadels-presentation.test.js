const test = require('node:test');
const assert = require('node:assert/strict');
const CitadelsEngine = require('../server/games/citadels/engine');
const Room = require('../server/room');

function players(ids) { return ids.map(id => ({ id, name: `玩家${id}` })); }

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
}

function assertTimeline(game) {
    const state = game.getPublicState();
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(state.presentations.length > 0);
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 1; index < batch.events.length; index += 1) {
            assert.equal(batch.events[index - 1].endsAt, batch.events[index].startedAt, '同批播报必须严格串行');
        }
        assert.deepEqual(batch.events.map(event => event.sequence), batch.events.map(event => event.eventId));
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt, '跨动作播报必须严格串行');
    }
    return state;
}

test('富饶之城客户端可把服务器绝对时间转换为本地时间并跳过过期批次', async () => {
    const { localizePresentation } = await import('../public/games/citadels/state.js');
    const batch = {
        sequence: 9,
        serverNow: 10_000,
        startedAt: 10_120,
        endsAt: 11_000,
        events: [{ kind: 'roleCall', startedAt: 10_120, endsAt: 11_000 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_120);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].startedAt, 50_120);
    assert.equal(localized.events[0].endsAt, 51_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});

test('富饶之城把每次行动排入同一条服务器时间轴并保留未结束批次', () => {
    const game = new CitadelsEngine('citadels-presentation-timeline', players(['a', 'b', 'c', 'd']), seededRandom(101));
    assert.equal(game.start().success, true);
    let state = assertTimeline(game);
    assert.equal(state.presentation.events[0].kind, 'roleDraftStart');

    const playerId = game.draftSteps[game.draftIndex].playerId;
    const roleId = game._draftOptions(playerId)[0];
    assert.equal(game.handleAction(playerId, { kind: 'chooseRole', roleId }).success, true);
    state = assertTimeline(game);
    assert.deepEqual(state.presentations.map(batch => batch.sequence), [1, 2]);
    assert.equal(state.presentations[0].endsAt, state.presentations[1].startedAt);
    assert.equal(state.presentations[1].events[0].startedAt, state.presentations[1].startedAt);
});

test('富饶之城在线房间在服务器播报结束前拒绝下一步操作', () => {
    const room = new Room('citadels-presentation-lock', 'a', '玩家a', 'citadels', {}, { readyCheckEnabled: true });
    for (const player of players(['a', 'b', 'c', 'd'])) assert.equal(room.addPlayer(player).success, true);
    for (const player of players(['b', 'c', 'd'])) assert.equal(room.setPlayerReady(player.id, true).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('a').presentation;
    assert.equal(locked.blocking, true);
    const draftPlayer = room.game.engine.draftSteps[room.game.engine.draftIndex].playerId;
    const roleId = room.game.engine._draftOptions(draftPlayer)[0];
    const rejected = room.handleGameAction(draftPlayer, { kind: 'chooseRole', roleId });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);

    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        assert.equal(room.handleGameAction(draftPlayer, { kind: 'chooseRole', roleId }).success, true);
    } finally {
        Date.now = realNow;
    }
});

test('富饶之城只给遇刺角色个人出局播报，并保持与公共动画同一时长', () => {
    const game = new CitadelsEngine('citadels-personal-elimination', players(['a', 'b', 'c', 'd']), seededRandom(102));
    assert.equal(game.start().success, true);
    game.phase = 'character_turn';
    game.presentation = null;
    game.selectedRoles = { assassin: 'b' };
    game.killedRole = 'assassin';
    game.currentRoleRank = 1;
    game._advanceCharacter();

    const publicEvent = game.getPublicState().presentations.flatMap(batch => batch.events).find(event => event.kind === 'assassinationResolved');
    const targetEvent = game.getPlayerState('b').presentations.flatMap(batch => batch.events).find(event => event.kind === 'assassinationResolved');
    const spectatorEvent = game.getPlayerState('c').presentations.flatMap(batch => batch.events).find(event => event.kind === 'assassinationResolved');
    assert.equal(publicEvent.title, undefined);
    assert.equal(targetEvent.title, '您已出局');
    assert.equal(targetEvent.viewerVariant, 'personalElimination');
    assert.equal(targetEvent.startedAt, publicEvent.startedAt);
    assert.equal(targetEvent.endsAt, publicEvent.endsAt);
    assert.equal(spectatorEvent.viewerVariant, undefined);
});

test('富饶之城把终局胜者替换为个人获胜播报，离场也会收束到同一终局批次', () => {
    const game = new CitadelsEngine('citadels-personal-winner', players(['a', 'b', 'c']), seededRandom(103));
    assert.equal(game.start().success, true);
    game.players[0].city = [{ id: 'winner-district', name: '宫殿', color: 'yellow', cost: 5, points: 5, effect: null }];
    game._finish();
    const publicEvent = game.getPublicState().presentations.flatMap(batch => batch.events).findLast(event => event.kind === 'finalSettlement');
    const winnerEvent = game.getPlayerState('a').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    const opponentEvent = game.getPlayerState('b').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
    assert.equal(opponentEvent.viewerVariant, undefined);

    const departure = new CitadelsEngine('citadels-departure-finale', players(['a', 'b', 'c']), seededRandom(104));
    assert.equal(departure.start().success, true);
    const result = departure.handlePlayerLeave('c');
    assert.equal(result.success, true);
    assert.equal(result.ended, true);
    assert.equal(departure.phase, 'ended');
    const departureEvent = departure.getPublicState().presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    const departureWinnerEvent = departure.getPlayerState('a').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    assert.equal(departureEvent.reason, 'playerLeave');
    assert.equal(departureWinnerEvent.viewerVariant, 'personalVictory');
    assert.equal(departureWinnerEvent.startedAt, departureEvent.startedAt);
    assert.equal(departureWinnerEvent.endsAt, departureEvent.endsAt);
});
