'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Room = require('../server/room');
const HanabiEngine = require('../server/games/hanabi/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const card = (id, color, value) => ({ id, color, value, hints: { colors: [], values: [], notColors: [], notValues: [] } });
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
            assert.equal(event.durationMs, event.endsAt - event.startedAt);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
}

test('花火普通行动使用服务器绝对时间轴，并按批次 FIFO 串接', () => {
    let now = 10_000;
    const game = new HanabiEngine('hanabi-presentation-actions', players(['a', 'b']), () => 0, { startingPlayerId: 'a', now: () => now });
    game.start();
    game.players[0].hand = [card('a-red', 'red', 1)];
    game.players[1].hand = [card('b-blue', 'blue', 1)];
    game.deck = [card('draw-1', 'yellow', 1), card('draw-2', 'green', 1)];

    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'blue' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'giveClue', targetId: 'a', clueKind: 'color', value: 'red' }).success, true);
    const state = game.getPublicState();
    assertTimeline(state);
    assert.equal(state.presentations.length, 2);
    assert.equal(state.presentations[0].events[0].kind, 'giveClue');
    assert.equal(state.presentations[1].events[0].kind, 'giveClue');
    assert.equal(state.presentations[1].startedAt, state.presentations[0].endsAt);
    assert.equal(state.presentations[0].events[0].durationMs, HanabiEngine.PRESENTATION_CONTENT_DURATIONS.giveClue + HanabiEngine.PRESENTATION_FADE_MS);
    assert.equal(state.presentation.endsAt, state.presentations[1].endsAt);
});

test('花火抽空牌库时把行动和终轮提示放在同一批次', () => {
    let now = 20_000;
    const game = new HanabiEngine('hanabi-presentation-final-round', players(['a', 'b']), () => 0, { startingPlayerId: 'a', now: () => now });
    game.start();
    game.players[0].hand = [card('a-red', 'red', 1)];
    game.players[1].hand = [card('b-blue', 'blue', 1)];
    game.deck = [card('last', 'green', 1)];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    const state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(state.presentations.at(-1).events.map(event => event.kind), ['playCard', 'finalRoundStarted']);
    assert.equal(state.status, 'playing');
    assert.equal(state.presentations.at(-1).events[1].startedAt, state.presentations.at(-1).events[0].endsAt);
});

test('花火完美终局按行动后结算，所有玩家看到相同公共结果', () => {
    let now = 30_000;
    const game = new HanabiEngine('hanabi-presentation-perfect', players(['a', 'b']), () => 0, { startingPlayerId: 'a', now: () => now });
    game.start();
    game.fireworks = { red: 4, yellow: 5, green: 5, blue: 5, white: 5 };
    game.players[0].hand = [card('red-five', 'red', 5)];
    game.players[1].hand = [card('b-filler', 'blue', 1)];
    game.deck = [card('replacement', 'yellow', 1)];
    assert.equal(game.handleAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
    const publicEvents = eventsOf(game.getPublicState());
    const eventsA = eventsOf(game.getPlayerState('a'));
    const eventsB = eventsOf(game.getPlayerState('b'));
    assert.equal(game.status, 'ended');
    assert.deepEqual(publicEvents.slice(-2).map(event => event.kind), ['playCard', 'finalSettlement']);
    const publicFinal = publicEvents.at(-1);
    assert.equal(publicFinal.reason, 'perfect');
    assert.equal(publicFinal.outcome, 'perfect');
    assert.equal(publicFinal.viewerVariant, undefined);
    assert.deepEqual(eventsA.at(-1), publicFinal);
    assert.deepEqual(eventsB.at(-1), publicFinal);
    assertTimeline(game.getPublicState());
});

test('花火人数不足终局生成独立封存事件，不重播上一行动', () => {
    let now = 40_000;
    const game = new HanabiEngine('hanabi-presentation-closure', players(['a', 'b']), () => 0, { startingPlayerId: 'a', now: () => now });
    game.start();
    game.players[1].hand = [card('b-red', 'red', 1)];
    game.deck = [card('draw', 'yellow', 1)];
    assert.equal(game.handleAction('a', { kind: 'giveClue', targetId: 'b', clueKind: 'color', value: 'red' }).success, true);
    const previousActionId = game.lastAction.actionId;
    assert.equal(game.handlePlayerLeave('b').success, true);
    const state = game.getPublicState();
    const closure = state.presentations.at(-1);
    assert.equal(game.status, 'ended');
    assert.equal(game.lastAction.actionId, previousActionId);
    assert.equal(game.lastAction.ended, false);
    assert.deepEqual(closure.events.map(event => event.kind), ['finalClosure']);
    assert.equal(closure.events[0].reason, 'players');
    assert.equal(closure.events[0].outcome, 'aborted');
    assert.equal(eventsOf(game.getPlayerState('a')).at(-1).viewerVariant, undefined);
});

test('花火 Room 在公共播报截止前拒绝下一行动', () => {
    const realNow = Date.now;
    let now = 50_000;
    Date.now = () => now;
    try {
        const room = new Room('hanabi-presentation-lock', 'a', '玩家a', 'hanabi', { startingPlayerId: 'a' }, { readyCheckEnabled: true });
        assert.equal(room.addPlayer({ id: 'a', name: '玩家a' }).success, true);
        assert.equal(room.addPlayer({ id: 'b', name: '玩家b' }).success, true);
        assert.equal(room.startGame().success, true);
        room.game.engine.players[0].hand = [card('a-red', 'red', 1)];
        room.game.engine.players[1].hand = [card('b-blue', 'blue', 1)];
        room.game.engine.deck = [card('draw', 'green', 1)];
        assert.equal(room.handleGameAction('a', { kind: 'playCard', cardIndex: 0 }).success, true);
        const locked = room.getPlayerGameState('b').presentation;
        assert.equal(locked.blocking, true);
        const rejected = room.handleGameAction('b', { kind: 'playCard', cardIndex: 0 });
        assert.equal(rejected.success, false);
        assert.match(rejected.message, /播报结束/);
        now = Number(locked.endsAt) + 1;
        const after = room.handleGameAction('b', { kind: 'playCard', cardIndex: 0 });
        assert.notEqual(after.message, '请等待当前播报结束');
    } finally {
        Date.now = realNow;
    }
});

test('花火客户端把绝对时间本地化，并保留服务端锁定契约', async () => {
    const { localizePresentation } = await import('../public/games/hanabi/state.js');
    const batch = {
        sequence: 2,
        serverNow: 60_000,
        startedAt: 60_100,
        endsAt: 62_110,
        events: [{ kind: 'giveClue', startedAt: 60_100, endsAt: 62_110 }],
    };
    const localized = localizePresentation(batch, 90_000);
    assert.equal(localized.startedAt, 90_100);
    assert.equal(localized.endsAt, 92_110);
    assert.equal(localized.events[0].endsAt, 92_110);
    assert.equal(localizePresentation({ ...batch, endsAt: 60_000 }, 90_000), null);

    const client = fs.readFileSync('public/games/hanabi/client.js', 'utf8');
    const scene = fs.readFileSync('public/games/hanabi/scene.js', 'utf8');
    const render = fs.readFileSync('public/games/hanabi/render.js', 'utf8');
    const actions = fs.readFileSync('public/games/hanabi/actions.js', 'utf8');
    assert.match(client, /localizePresentation/);
    assert.match(client, /scene\.enqueuePresentation/);
    assert.match(scene, /presentationLockedUntil/);
    assert.match(scene, /function skipPresentation\(/);
    assert.match(scene, /waitUntil\(/);
    assert.match(render, /aria-busy/);
    assert.match(actions, /scene\.skipPresentation\(\)/);
});
