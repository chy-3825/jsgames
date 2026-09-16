'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Room = require('../server/room');
const GuessNumberEngine = require('../server/games/guessnumber/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);

function assertTimeline(state) {
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(Array.isArray(state.presentations));
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 0; index < batch.events.length; index += 1) {
            const event = batch.events[index];
            assert.equal(event.sequence, event.eventId);
            assert.ok(event.endsAt > event.startedAt);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
}

test('猜数字只有终局进入服务器绝对时间轴，普通 A/B 反馈保持局部', () => {
    let now = 1_000;
    const game = new GuessNumberEngine('guessnumber-presentation-timeline', players(['a']), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    game.secret = '1234';

    assert.equal(game.handleAction('a', { kind: 'submitGuess', guess: '1243' }).success, true);
    assert.deepEqual(eventsOf(game.getPublicState()), []);

    assert.equal(game.handleAction('a', { kind: 'submitGuess', guess: '1234' }).success, true);
    const state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['finalSettlement']);
    const event = eventsOf(state)[0];
    assert.equal(event.outcome, 'solved');
    assert.equal(event.secret, '1234');
    assert.equal(event.startedAt, now);
    assert.equal(event.endsAt - event.startedAt, event.durationMs);
    assert.equal(state.presentation.endsAt, event.endsAt);
});

test('猜数字终局只给本人个人胜利文案，并保持公共时间槽一致', () => {
    let now = 2_000;
    const game = new GuessNumberEngine('guessnumber-presentation-personal', players(['a']), { random: () => 0, now: () => now });
    game.start();
    game.secret = '0123';
    game.handleAction('a', { kind: 'submitGuess', guess: '0123' });

    const publicEvent = eventsOf(game.getPublicState()).find(event => event.kind === 'finalSettlement');
    const personalEvent = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalSettlement');
    assert.ok(publicEvent);
    assert.equal(publicEvent.title, undefined);
    assert.equal(personalEvent.title, '您已获胜');
    assert.equal(personalEvent.viewerVariant, 'personalVictory');
    assert.equal(personalEvent.startedAt, publicEvent.startedAt);
    assert.equal(personalEvent.endsAt, publicEvent.endsAt);
});

test('猜数字离场生成同长度的个人封存播报', () => {
    let now = 3_000;
    const game = new GuessNumberEngine('guessnumber-presentation-closure', players(['a']), { random: () => 0, now: () => now });
    game.start();
    assert.equal(game.handlePlayerLeave('a').success, true);
    const publicEvent = eventsOf(game.getPublicState()).find(event => event.kind === 'finalClosure');
    const personalEvent = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalClosure');
    assert.equal(game.status, 'ended');
    assert.equal(publicEvent.title, undefined);
    assert.equal(personalEvent.title, '本局已中止');
    assert.equal(personalEvent.viewerVariant, 'personalClosure');
    assert.equal(personalEvent.startedAt, publicEvent.startedAt);
    assert.equal(personalEvent.endsAt, publicEvent.endsAt);
});

test('猜数字在线房间在终局播报结束前锁定操作', () => {
    const room = new Room('guessnumber-presentation-lock', 'a', '玩家a', 'guessnumber', {}, { readyCheckEnabled: true });
    assert.equal(room.addPlayer({ id: 'a', name: '玩家a' }).success, true);
    assert.equal(room.startGame().success, true);
    room.game.engine.secret = '1234';
    assert.equal(room.handleGameAction('a', { kind: 'submitGuess', guess: '1234' }).success, true);

    const locked = room.getPlayerGameState('a').presentation;
    assert.equal(locked.blocking, true);
    const rejected = room.handleGameAction('a', { kind: 'submitGuess', guess: '0123' });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);

    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        const after = room.handleGameAction('a', { kind: 'submitGuess', guess: '0123' });
        assert.equal(after.success, false);
        assert.match(after.message, /游戏已结束/);
    } finally {
        Date.now = realNow;
    }
});

test('猜数字客户端按服务器截止时间排队并保留跳过后的锁', async () => {
    const { localizePresentation } = await import('../public/games/guessnumber/state.js');
    const batch = {
        sequence: 4,
        serverNow: 10_000,
        startedAt: 10_100,
        endsAt: 12_960,
        events: [{ kind: 'finalSettlement', startedAt: 10_100, endsAt: 12_960 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.endsAt, 52_960);
    assert.equal(localized.events[0].endsAt, 52_960);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);

    const client = fs.readFileSync('public/games/guessnumber/client.js', 'utf8');
    const scene = fs.readFileSync('public/games/guessnumber/scene.js', 'utf8');
    const render = fs.readFileSync('public/games/guessnumber/render.js', 'utf8');
    assert.match(client, /localizePresentation/);
    assert.match(client, /scene\.enqueuePresentation/);
    assert.match(scene, /presentationLockedUntil/);
    assert.match(scene, /function skipPresentation\(/);
    assert.match(render, /aria-busy/);
});
