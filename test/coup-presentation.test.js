const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const CoupEngine = require('../server/games/coup/engine');

const players = ids => ids.map(id => ({ id, name: `玩家${id}` }));
const eventsOf = state => (state.presentations || []).flatMap(batch => batch.events || []);

function assertTimeline(state) {
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(Array.isArray(state.presentations));
    for (const batch of state.presentations) {
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 1; index < batch.events.length; index += 1) {
            assert.equal(batch.events[index - 1].endsAt, batch.events[index].startedAt);
        }
        assert.deepEqual(batch.events.map(event => event.sequence), batch.events.map(event => event.eventId));
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    }
}

test('政变普通行动、质疑和单张影响力损失触发完整播报', () => {
    let now = 1_000;
    const game = new CoupEngine('coup-presentation-timeline', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);

    game.handleAction('a', { kind: 'income' });
    let state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['actionDeclared', 'actionResolved']);

    game.handleAction('b', { kind: 'income' });
    state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), ['actionDeclared', 'actionResolved', 'actionDeclared', 'actionResolved']);

    game.players[2].influences = ['duke', 'captain'];
    game.players[2].revealed = [false, false];
    game.currentTurnIndex = 2;
    game.handleAction('c', { kind: 'tax' });
    game.handleAction('a', { kind: 'challenge' });
    game.handleAction('c', { kind: 'show' });
    game.handleAction('a', { kind: 'influence_loss', influenceIndex: 0 });
    state = game.getPublicState();
    assertTimeline(state);
    assert.deepEqual(eventsOf(state).map(event => event.kind), [
        'actionDeclared', 'actionResolved',
        'actionDeclared', 'actionResolved',
        'actionDeclared', 'challengeDeclared', 'challengeResolved',
        'influenceRevealed', 'actionResolved',
    ]);
});

test('政变普通行动会用播报锁住下一位玩家', () => {
    const room = new Room('coup-presentation-lock', 'a', '玩家a', 'coup', {}, { readyCheckEnabled: true });
    for (const player of players(['a', 'b'])) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.setPlayerReady('b', true).success, true);
    assert.equal(room.startGame().success, true);

    assert.equal(room.handleGameAction('a', { kind: 'income' }).success, true);
    assert.ok(room.getPlayerGameState('b').presentations.length > 0);
    const blocked = room.handleGameAction('b', { kind: 'income' });
    assert.equal(blocked.success, false);
    assert.match(blocked.message, /播报/);
});

test('政变只给被淘汰者个人出局播报，公共动画时长与其完全一致', () => {
    let now = 2_000;
    const game = new CoupEngine('coup-personal-elimination', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    game.start();
    game.players[0].coins = 7;
    game.players[1].influences = ['duke', 'contessa'];
    game.players[1].revealed = [true, false];
    game.handleAction('a', { kind: 'coup', targetId: 'b' });
    game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });

    const publicEvent = eventsOf(game.getPublicState()).find(event => event.kind === 'playerEliminated');
    const personalEvent = eventsOf(game.getPlayerState('b')).find(event => event.kind === 'playerEliminated');
    const spectatorEvent = eventsOf(game.getPlayerState('c')).find(event => event.kind === 'playerEliminated');
    assert.ok(publicEvent);
    assert.equal(publicEvent.title, undefined);
    assert.equal(personalEvent.title, '你已出局');
    assert.equal(personalEvent.viewerVariant, 'personalElimination');
    assert.equal(personalEvent.startedAt, publicEvent.startedAt);
    assert.equal(personalEvent.endsAt, publicEvent.endsAt);
    assert.equal(spectatorEvent.viewerVariant, undefined);
    assert.equal(game.gameOver, false);
});

test('政变终局把公共胜负替换为胜者或出局者的个人结果', () => {
    let now = 3_000;
    const game = new CoupEngine('coup-personal-finale', players(['a', 'b']), { random: () => 0, now: () => now });
    game.start();
    game.players[0].coins = 7;
    game.players[1].influences = ['duke', 'contessa'];
    game.players[1].revealed = [true, false];
    game.handleAction('a', { kind: 'coup', targetId: 'b' });
    game.handleAction('b', { kind: 'influence_loss', influenceIndex: 1 });

    const publicEvent = eventsOf(game.getPublicState()).find(event => event.kind === 'finalSettlement');
    const winnerEvent = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalSettlement');
    const loserEvent = eventsOf(game.getPlayerState('b')).find(event => event.kind === 'finalSettlement');
    assert.equal(game.gameOver, true);
    assert.equal(publicEvent.title, undefined);
    assert.equal(winnerEvent.title, '你获胜了');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(loserEvent.title, '你已出局');
    assert.equal(loserEvent.viewerVariant, 'personalElimination');
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
    assert.equal(loserEvent.startedAt, publicEvent.startedAt);
    assert.equal(loserEvent.endsAt, publicEvent.endsAt);
    assert.equal(eventsOf(game.getPublicState()).filter(event => event.kind === 'playerEliminated').length, 0);
});

test('政变离场时清理悬空阶段并按同一终局时间轴结算', () => {
    let now = 4_000;
    const game = new CoupEngine('coup-departure-finale', players(['a', 'b', 'c']), { random: () => 0, now: () => now });
    game.start();
    assert.equal(game.handlePlayerLeave('c').success, true);
    assert.equal(game.gameOver, false);
    assert.equal(game.getPublicState().presentations[0].events[0].kind, 'playerEliminated');
    assert.equal(game.handlePlayerLeave('b').success, true);
    assert.equal(game.gameOver, true);
    const state = game.getPublicState();
    assertTimeline(state);
    const final = eventsOf(state).find(event => event.kind === 'finalSettlement');
    const personal = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalSettlement');
    assert.equal(final.reason, 'playerLeave');
    assert.equal(final.winnerId, 'a');
    assert.equal(personal.title, '你获胜了');
    assert.equal(personal.startedAt, final.startedAt);
    assert.equal(personal.endsAt, final.endsAt);
});

test('政变客户端可把服务器绝对时间转换为本地时间并忽略过期批次', async () => {
    const { localizePresentation } = await import('../public/games/coup/state.js');
    const batch = {
        sequence: 7,
        serverNow: 10_000,
        startedAt: 10_100,
        endsAt: 11_000,
        events: [{ kind: 'actionDeclared', startedAt: 10_100, endsAt: 10_700 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].startedAt, 50_100);
    assert.equal(localized.events[0].endsAt, 50_700);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
