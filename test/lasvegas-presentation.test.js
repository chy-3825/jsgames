'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const Engine = require('../server/games/lasvegas/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);

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
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    }
    return state;
}

test('拉斯维加斯开局和连续动作使用服务端绝对时间 FIFO', () => {
    let now = 10_000;
    const game = new Engine('lasvegas-presentation-timeline', players(['a', 'b']), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    let state = assertTimeline(game.getPublicState());
    assert.deepEqual(state.presentations[0].events.map(event => event.kind), ['roundStarted']);
    assert.equal(state.presentations[0].startedAt, now);
    const openingEnd = state.presentation.endsAt;

    assert.equal(game.handleAction('a', { kind: 'rollDice' }).success, true);
    state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations[1].startedAt, openingEnd);
    assert.equal(state.presentations[1].events[0].kind, 'diceRolled');

    assert.equal(game.handleAction('a', { kind: 'placeDice', face: 1 }).success, true);
    state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations.at(-1).events[0].kind, 'dicePlaced');
    assert.ok(state.presentations.at(-1).events[0].startedAt >= state.presentations[1].endsAt);
});

test('拉斯维加斯结算链包含六家赌场和可恢复的子时间槽', () => {
    let now = 20_000;
    const game = new Engine('lasvegas-presentation-settlement', players(['a', 'b']), { random: () => 0, now: () => now });
    game.start();
    game.round = 4;
    game.moneyDeck = [];
    game.players.forEach(player => { player.diceRemaining = 0; player.neutralDiceRemaining = 0; });
    game.neutral.diceRemaining = 0;
    game.casinos = [
        { face: 1, money: [90, 80], dice: { a: 2, b: 1 } },
        ...Array.from({ length: 5 }, (_, index) => ({ face: index + 2, money: [50], dice: {} })),
    ];
    game._settleRound();
    const state = assertTimeline(game.getPublicState());
    const batch = state.presentations.at(-1);
    assert.deepEqual(batch.events.map(event => event.kind), ['betsClosed', 'casinoSettlement', 'casinoSettlement', 'casinoSettlement', 'casinoSettlement', 'casinoSettlement', 'casinoSettlement', 'roundSettlement', 'finalSettlement']);
    assert.equal(batch.events.filter(event => event.kind === 'casinoSettlement').every(event => Array.isArray(event.segments)), true);
    assert.equal(batch.events.at(-1).reason, 'rounds');
    assert.equal(batch.events.at(-1).outcome, 'completed');
});

test('拉斯维加斯房间在服务端播报截止前拒绝动作', () => {
    const room = new Room('lasvegas-presentation-lock', 'a', '玩家a', 'lasvegas', {}, { readyCheckEnabled: true });
    for (const player of players(['a', 'b'])) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('a').presentation;
    assert.equal(locked.blocking, true);
    const rejected = room.handleGameAction('a', { kind: 'rollDice' });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);
    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        assert.equal(room.handleGameAction('a', { kind: 'rollDice' }).success, true);
    } finally {
        Date.now = realNow;
    }
});

test('拉斯维加斯终局把胜者投影为同一时间槽的个人胜利', () => {
    let now = 30_000;
    const game = new Engine('lasvegas-personal-winner', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    game.start();
    game.round = 4;
    game.moneyDeck = [];
    game.players[0].money = 100; game.players[0].banknotes = [50, 50];
    game.players[1].money = 100; game.players[1].banknotes = [40, 30, 30];
    game.players[2].money = 0; game.players[2].banknotes = [];
    game.players.forEach(player => { player.diceRemaining = 0; player.neutralDiceRemaining = 0; });
    game.neutral.diceRemaining = 0;
    game.casinos = Array.from({ length: 6 }, (_, index) => ({ face: index + 1, money: [], dice: {} }));
    game._settleRound();
    const publicEvent = eventsOf(game.getPublicState()).findLast(event => event.kind === 'finalSettlement');
    const winnerEvent = eventsOf(game.getPlayerState('b')).findLast(event => event.kind === 'finalSettlement');
    const spectatorEvent = eventsOf(game.getPlayerState('a')).findLast(event => event.kind === 'finalSettlement');
    assert.equal(publicEvent.winnerIds.length, 1);
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
    assert.equal(spectatorEvent.viewerVariant, undefined);
});

test('拉斯维加斯永久离场跳过离线回合并在只剩一人时收束', () => {
    let now = 40_000;
    const ongoing = new Engine('lasvegas-presentation-leave', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    ongoing.start();
    assert.equal(ongoing.handlePlayerLeave('b').success, true);
    assert.equal(ongoing.status, 'playing');
    ongoing.handleAction('a', { kind: 'rollDice' });
    ongoing.handleAction('a', { kind: 'placeDice', face: 1 });
    assert.notEqual(ongoing.getPublicState().currentTurn, 'b');
    assert.equal(ongoing.getPublicState().neutral.diceRemaining, 2);
    const closing = new Engine('lasvegas-presentation-leave-final', players(['a', 'b']), { random: () => 0, now: () => now });
    closing.start();
    assert.equal(closing.handlePlayerLeave('b').ended, true);
    const state = assertTimeline(closing.getPublicState());
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['playerLeft', 'finalSettlement']);
    assert.equal(state.presentations.at(-1).events.at(-1).reason, 'players');
    assert.equal(closing.getPlayerState('a').presentations.at(-1).events.at(-1).title, '您已获胜');
});

test('拉斯维加斯客户端本地化会忽略过期批次并保留子时间槽', async () => {
    const { localizePresentation } = await import('../public/games/lasvegas/state.js');
    const batch = { sequence: 2, transactionId: 2, serverNow: 10_000, startedAt: 10_100, endsAt: 11_000, events: [{ kind: 'casinoSettlement', startedAt: 10_100, endsAt: 11_000, segments: [{ kind: 'review', startedAt: 10_100, endsAt: 10_500 }] }] };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.events[0].segments[0].endsAt, 50_500);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
