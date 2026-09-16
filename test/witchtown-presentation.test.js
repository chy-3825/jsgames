'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const WitchTownEngine = require('../server/games/witchtown/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function eventsOf(state) {
    return (state.presentations || []).flatMap(batch => batch.events || []);
}

function makeGame(now = 10_000) {
    const clock = { value: now };
    const game = new WitchTownEngine('witchtown-presentation-test', players(['a', 'b', 'c', 'd']), () => 0.23, () => clock.value);
    return { clock, game };
}

test('猎巫镇公共播报使用服务器绝对时间连续排队', () => {
    const { clock, game } = makeGame();
    assert.equal(game.start().success, true);
    const opening = game.getPublicState();
    assert.ok(opening.gameEpoch);
    assert.equal(opening.serverNow, 10_000);
    assert.equal(opening.presentation.blocking, true);
    assert.equal(opening.presentations.length, 1);

    game._publishEvent('trialReveal', '证据已经公开', '镇民审判牌', '1 号的档案被揭开');
    game._publishEvent('elimination', '审判结果', '1 号已出局', '测试出局', { playerId: 'a', playerSeat: 1, selfText: '您已出局' });
    const batch = game.getPublicState().presentations.at(-1);
    assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
    assert.ok(batch.events.length >= 3);
    for (let index = 1; index < batch.events.length; index += 1) {
        assert.ok(batch.events[index].startedAt >= batch.events[index - 1].endsAt, '事件不得重叠');
    }
    assert.equal(batch.events.at(-1).endsAt, batch.endsAt);
    assert.ok(batch.events.every(event => event.eventId.startsWith(`${opening.gameEpoch}:event:`)));

    clock.value = batch.endsAt + 1;
    assert.equal(game.getPublicState().presentations.length, 0, '过期批次不应继续作为活动播报');
    assert.equal(game.getPublicState().presentation.endsAt, batch.endsAt, '兼容字段保留最后截止点');
});

test('猎巫镇黎明播报携带自身的死亡样式依据', () => {
    const { game } = makeGame();
    assert.equal(game.start().success, true);
    game.lastNightDeaths = [];
    game.nightActions = { kills: {}, protect: null, confessions: {} };
    game._rebuildDeckAfterNight = () => {};
    game._beginDay = () => {};
    game._resolveNight();
    const result = game.presentationEvents.findLast(event => event.kind === 'nightResult');
    assert.equal(result.hasDeaths, false);
});

test('出局与获胜个人投影复用公共事件的同一时间槽', () => {
    const { game } = makeGame(20_000);
    assert.equal(game.start().success, true);
    game.players.forEach(player => { player.identity = 'villager'; player.everWitch = false; player.everConstable = false; });
    game.players[1].identity = 'witch'; game.players[1].everWitch = true;

    game._eliminate(game.players[0], '测试出局');
    const publicElimination = eventsOf(game.getPublicState()).find(event => event.kind === 'elimination');
    const personalElimination = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'elimination');
    const observerElimination = eventsOf(game.getPlayerState('b')).find(event => event.kind === 'elimination');
    assert.equal(publicElimination.title, '1 号已出局');
    assert.equal(personalElimination.title, '您已出局');
    assert.equal(personalElimination.viewerVariant, 'personalElimination');
    assert.equal(observerElimination.title, '1 号已出局');
    assert.equal(personalElimination.eventId, observerElimination.eventId);
    assert.equal(personalElimination.startedAt, observerElimination.startedAt);
    assert.equal(personalElimination.endsAt, observerElimination.endsAt);

    game._finish('town', '镇民阵营', '测试终局');
    const publicVictory = eventsOf(game.getPublicState()).find(event => event.kind === 'victory');
    const winnerVictory = eventsOf(game.getPlayerState('c')).find(event => event.kind === 'victory');
    const witchVictory = eventsOf(game.getPlayerState('b')).find(event => event.kind === 'victory');
    assert.equal(publicVictory.title, '镇民阵营获胜');
    assert.equal(winnerVictory.title, '您已获胜');
    assert.equal(winnerVictory.viewerVariant, 'personalVictory');
    assert.equal(witchVictory.title, '镇民阵营获胜');
    assert.equal(winnerVictory.eventId, publicVictory.eventId);
    assert.equal(winnerVictory.startedAt, publicVictory.startedAt);
    assert.equal(winnerVictory.endsAt, publicVictory.endsAt);
});

test('在线房间在猎巫镇服务器播报截止前拒绝操作', () => {
    const room = new Room('witchtown-presentation-lock', 'a', 'a', 'witchtown', {}, { readyCheckEnabled: true });
    for (const player of players(['a', 'b', 'c', 'd'])) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('a').presentation;
    assert.equal(locked.blocking, true);
    const realDateNow = Date.now;
    const realEngineNow = room.game.engine.now;
    try {
        Date.now = () => Number(locked.endsAt) - 1;
        room.game.engine.now = () => Number(locked.endsAt) - 1;
        const early = room.handleGameAction('a', { kind: 'confirmDossier' });
        assert.equal(early.success, false);
        assert.match(early.message, /播报结束/);

        Date.now = () => Number(locked.endsAt) + 1;
        room.game.engine.now = () => Number(locked.endsAt) + 1;
        const onTime = room.handleGameAction('a', { kind: 'confirmDossier' });
        assert.equal(onTime.success, true);
    } finally {
        Date.now = realDateNow;
        room.game.engine.now = realEngineNow;
    }
});

test('重连状态可识别当前批次并跳过已结束事件', () => {
    const { clock, game } = makeGame(30_000);
    assert.equal(game.start().success, true);
    const opening = game.getPublicState().presentation;
    clock.value = opening.startedAt + 100;
    const during = game.getPlayerState('a');
    assert.equal(during.serverNow, opening.startedAt + 100);
    assert.equal(during.presentations[0].events[0].startedAt, opening.startedAt);
    assert.ok(during.presentations[0].events[0].endsAt > during.serverNow);

    clock.value = opening.endsAt + 1;
    const late = game.getPlayerState('a');
    assert.equal(late.presentations.length, 0);
    assert.equal(late.presentation.endsAt, opening.endsAt);
});

test('阴谋传牌当前玩家离场后重建存活顺序', () => {
    const { game } = makeGame(40_000);
    assert.equal(game.start().success, true);
    const leaver = game.players.find(player => !game._isWitch(player));
    const rest = game.players.filter(player => player.id !== leaver.id);
    const order = [leaver, ...rest].map(player => player.id);
    game.phase = 'conspiracy';
    game.currentConspiracy = {
        triggerId: leaver.id,
        order,
        index: 0,
        selections: {},
        snapshot: Object.fromEntries(order.map(id => [id, game.playerMap[id].trialCards.filter(card => !card.revealed).map(card => card.id)])),
    };
    assert.equal(game.handlePlayerLeave(leaver.id).success, true);
    assert.notEqual(game.currentConspiracy.order[game.currentConspiracy.index], leaver.id);
    const next = game.currentConspiracy.order[game.currentConspiracy.index];
    const state = game.getPlayerState(next);
    assert.ok(state.availableActions.passTrial);
    assert.equal(game.handleAction(next, { kind: 'passTrial', trialId: state.conspiracyOptions[0].id }).success, true);
});

test('终局后离场不再追加新的出局播报', () => {
    const { game } = makeGame(50_000);
    assert.equal(game.start().success, true);
    game._finish('town', '镇民阵营', '测试终局');
    const before = game.presentationEvents.map(event => event.kind);
    const result = game.handlePlayerLeave('a');
    assert.equal(result.ended, true);
    assert.deepEqual(game.presentationEvents.map(event => event.kind), before);
});
