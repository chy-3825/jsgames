'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WerewolfEngine = require('../server/games/werewolf/engine');
const Room = require('../server/room');

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));

function confirmAllRoles(game) {
    for (const player of game.realPlayers) {
        game.activeSeat[player.id] = player.seat;
        assert.equal(game.handleAction(player.id, { kind: 'confirmRole' }).success, true);
    }
}

function eventsOf(state) {
    return (state.presentations || []).flatMap(batch => batch.events || []);
}

test('狼人杀所有公共播报由服务器绝对时间排队，并在截止点统一推进夜幕', () => {
    let now = 10_000;
    const game = new WerewolfEngine('werewolf-presentation-timeline', players(9), 'p1', () => 0, () => now, { playerCount: 9, sheriffEnabled: false });
    assert.equal(game.start().success, true);
    confirmAllRoles(game);

    const state = game.getPublicState();
    assert.equal(state.phase, 'nightPrelude');
    assert.ok(Number.isFinite(state.serverNow));
    assert.equal(state.presentations.length, 1);
    const batch = state.presentations[0];
    assert.equal(batch.blocking, true);
    assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
    assert.equal(batch.events[0].startedAt, batch.startedAt);
    assert.equal(batch.events.at(-1).endsAt, batch.endsAt);
    assert.ok(batch.endsAt > now);

    const publicEvent = batch.events[0];
    const viewerEvent = game.getPlayerState('p1').presentations[0].events[0];
    assert.equal(viewerEvent.startedAt, publicEvent.startedAt);
    assert.equal(viewerEvent.endsAt, publicEvent.endsAt);

    const earlyAck = game.handleAction('p1', { kind: 'presentationComplete', gateId: state.presentationGate.id });
    assert.equal(earlyAck.success, true);
    assert.equal(game.phase, 'nightPrelude', '单个客户端确认不能缩短共享播报时隙');

    now = batch.endsAt - 1;
    assert.equal(game.handleSystemTick(), null);
    assert.equal(game.phase, 'nightPrelude');
    now = batch.endsAt;
    assert.equal(game.handleSystemTick().success, true);
    assert.equal(game.phase, 'nightWolf');
    assert.ok(game.nightFlow.deadlineAt > now);
});

test('狼人杀在线房间在服务器播报结束前拒绝动作，截止后由系统脉冲推进', () => {
    const room = new Room('werewolf-presentation-lock', 'p1', '玩家1', 'werewolf', { playerCount: 9, sheriffEnabled: false }, { readyCheckEnabled: true });
    for (const player of players(9)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    for (const player of players(9)) assert.equal(room.handleGameAction(player.id, { kind: 'confirmRole' }).success, true);
    const locked = room.getPlayerGameState('p1').presentation;
    assert.equal(locked.blocking, true);
    const realNow = Date.now;
    const engineNow = room.game.engine.now;
    try {
        Date.now = () => Number(locked.endsAt) - 1;
        const rejected = room.handleGameAction('p1', { kind: 'timerTick' });
        assert.equal(rejected.success, false);
        assert.match(rejected.message, /播报结束/);
        Date.now = () => Number(locked.endsAt) + 1;
        room.game.engine.now = () => Number(locked.endsAt) + 1;
        const advanced = room.handleGameAction('p1', { kind: 'timerTick' });
        assert.equal(advanced.success, true);
        assert.equal(room.game.engine.phase, 'nightWolf');
    } finally {
        Date.now = realNow;
        room.game.engine.now = engineNow;
    }
});

test('狼人杀终局与出局播报按玩家视角替换文字但保持同一时间槽', () => {
    let now = 20_000;
    const game = new WerewolfEngine('werewolf-personal-presentation', players(9), 'p1', () => 0, () => now, { playerCount: 9, sheriffEnabled: false });
    game.start();
    const good = game.seats.find(seat => seat.role !== 'werewolf');
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    game.seats.forEach(seat => { seat.alive = seat === good || seat === wolf; });
    game._finish('good', '好人阵营获胜', 'testWin', '小镇恢复了和平。');
    const publicOutcome = eventsOf(game.getPublicState()).find(event => event.kind === 'outcome');
    const goodOutcome = eventsOf(game.getPlayerState(good.controllerId)).find(event => event.kind === 'outcome');
    const wolfOutcome = eventsOf(game.getPlayerState(wolf.controllerId)).find(event => event.kind === 'outcome');
    assert.equal(publicOutcome.displayText, '好人阵营获胜');
    assert.equal(goodOutcome.displayText, '您已获胜');
    assert.equal(goodOutcome.viewerVariant, 'personalVictory');
    assert.equal(wolfOutcome.displayText, '好人阵营获胜');
    assert.equal(goodOutcome.startedAt, publicOutcome.startedAt);
    assert.equal(goodOutcome.endsAt, publicOutcome.endsAt);

    const elimination = new WerewolfEngine('werewolf-personal-elimination', players(9), 'p1', () => 0, () => now, { playerCount: 9, sheriffEnabled: false });
    elimination.start();
    const target = elimination.seats.find(seat => seat.number === 2);
    elimination._publishEvent('elimination', '玩家出局', `${target.number} 号已出局`, [target.number], { selfSeat: target.number, selfText: '您已出局', singlePresentation: true, presentationDurationMs: 3960 });
    const personal = eventsOf(elimination.getPlayerState(`p${target.number}`)).find(event => event.kind === 'elimination');
    const observer = eventsOf(elimination.getPlayerState('p1')).find(event => event.kind === 'elimination');
    assert.equal(personal.displayText, '您已出局');
    assert.equal(personal.viewerVariant, 'personalElimination');
    assert.equal(observer.displayText, `${target.number} 号已出局`);
    assert.equal(personal.startedAt, observer.startedAt);
    assert.equal(personal.endsAt, observer.endsAt);
});

test('狼人自爆播报仅在自爆玩家视角显示“您已自爆”', () => {
    let now = 30_000;
    const game = new WerewolfEngine('werewolf-personal-self-destruct', players(9), 'p1', () => 0, () => now, { playerCount: 9, sheriffEnabled: false });
    game.start();
    confirmAllRoles(game);
    now = game.presentation.endsAt;
    game.handleSystemTick();

    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    game.phase = 'day';
    assert.equal(game.handleAction(wolf.controllerId, { kind: 'wolfSelfDestruct' }).success, true);

    const personal = eventsOf(game.getPlayerState(wolf.controllerId)).find(event => event.kind === 'wolfSelfDestruct');
    const observerSeat = game.seats.find(seat => seat.controllerId !== wolf.controllerId);
    const observer = eventsOf(game.getPlayerState(observerSeat.controllerId)).find(event => event.kind === 'wolfSelfDestruct');
    assert.equal(personal.displayText, '您已自爆');
    assert.equal(personal.viewerVariant, 'personalPerspective');
    assert.equal(observer.displayText, `${wolf.number} 号玩家自爆`);
    assert.equal(personal.displayText.includes(`${wolf.number} 号`), false);
    assert.equal(personal.startedAt, observer.startedAt);
    assert.equal(personal.endsAt, observer.endsAt);
    assert.equal(personal.durationMs, observer.durationMs);
    assert.equal(personal.contentDurationMs, observer.contentDurationMs);
    assert.equal(personal.fadeInMs, observer.fadeInMs);
    assert.equal(personal.fadeOutMs, observer.fadeOutMs);
});
