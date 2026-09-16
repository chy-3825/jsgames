const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const MagicalAthleteEngine = require('../server/games/magicalathlete/engine');

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

test('胡闹运动会把开幕与后续动作排进服务端绝对时间 FIFO', () => {
    let now = 10_000;
    const game = new MagicalAthleteEngine('ma-presentation-timeline', players(['a', 'b', 'c']), { random: () => 0.2, now: () => now });
    assert.equal(game.start().success, true);
    let state = assertTimeline(game.getPublicState());
    assert.deepEqual(state.presentation.events.map(event => event.kind), ['tournamentStarted', 'draftRoundStarted']);
    assert.equal(state.presentation.startedAt, now);
    const openingEnd = state.presentation.endsAt;

    const current = game.players[game.currentTurnIndex];
    assert.equal(game.handleAction(current.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }).success, true);
    state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations[1].startedAt, openingEnd);
    assert.equal(state.presentations.at(-1).events[0].kind, 'athleteDrafted');
});

test('胡闹运动会房间在公共播报截止前拒绝下一步操作', () => {
    let now = 20_000;
    const realNow = Date.now;
    Date.now = () => now;
    try {
        const room = new Room('ma-presentation-lock', 'a', '玩家a', 'magicalathlete', { random: () => 0.2, now: () => now }, { readyCheckEnabled: true });
        for (const player of players(['a', 'b'])) assert.equal(room.addPlayer(player).success, true);
        assert.equal(room.startGame().success, true);
        const engine = room.game.engine;
        const locked = room.getPlayerGameState('a').presentation;
        assert.equal(locked.blocking, true);
        const rejected = room.handleGameAction(engine.players[engine.currentTurnIndex].id, { kind: 'chooseAthlete', athleteId: engine.draftPool[0].id });
        assert.equal(rejected.success, false);
        assert.match(rejected.message, /播报结束/);
        now = Number(locked.endsAt) + 1;
        const accepted = room.handleGameAction(engine.players[engine.currentTurnIndex].id, { kind: 'chooseAthlete', athleteId: engine.draftPool[0].id });
        assert.equal(accepted.success, true);
    } finally {
        Date.now = realNow;
    }
});

test('胡闹运动会把淘汰与获胜投影为个人播报但保持同一时间槽', () => {
    let now = 30_000;
    const game = new MagicalAthleteEngine('ma-personal-presentation', players(['a', 'b']), { random: () => 0.2, now: () => now });
    assert.equal(game.start().success, true);
    game._startPresentation(null, 'testPersonal');
    game._appendPresentationEvent({
        kind: 'racerEliminated',
        victim: { id: 'a:legs', playerId: 'a', playerName: '玩家a', athleteId: 'legs', athleteName: '飞毛腿', position: 4 },
        source: null,
    });
    game.players[0].score = 1;
    game.players[1].score = 5;
    game.winner = game.players[1];
    game.winners = [game.players[1]];
    game.finalStandings = game.players.map((player, index) => ({ rank: index + 1, playerId: player.id, playerName: player.name, color: player.color, score: player.score, bronze: player.bronze }));
    game.status = 'ended';
    game.phase = 'ended';
    game._appendPresentationEvent({ kind: 'finalSettlement', standings: game.finalStandings, winnerIds: ['b'] });
    game._finishPresentation();

    const publicState = assertTimeline(game.getPublicState());
    const publicEvents = eventsOf(publicState);
    const publicElimination = publicEvents.find(event => event.kind === 'racerEliminated');
    const publicFinal = publicEvents.find(event => event.kind === 'finalSettlement');
    const eliminatedState = game.getPlayerState('a');
    const winnerState = game.getPlayerState('b');
    const eliminatedEvent = eventsOf(eliminatedState).find(event => event.kind === 'racerEliminated');
    const winnerEvent = eventsOf(winnerState).find(event => event.kind === 'finalSettlement');
    const spectatorEvent = eventsOf(game.getPlayerState('a')).find(event => event.kind === 'finalSettlement');
    assert.equal(publicElimination.viewerVariant, undefined);
    assert.equal(eliminatedEvent.viewerVariant, 'personalElimination');
    assert.equal(eliminatedEvent.title, '您的运动员已淘汰');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(spectatorEvent.viewerVariant, undefined);
    assert.equal(eliminatedEvent.startedAt, publicElimination.startedAt);
    assert.equal(winnerEvent.startedAt, publicFinal.startedAt);
    assert.equal(winnerEvent.endsAt, publicFinal.endsAt);
});

test('胡闹运动会当前玩家离场后移除队列并继续剩余玩家', () => {
    let now = 40_000;
    const game = new MagicalAthleteEngine('ma-presentation-leave', players(['a', 'b', 'c']), { random: () => 0.2, now: () => now });
    assert.equal(game.start().success, true);
    const departed = game.players[game.currentTurnIndex];
    assert.equal(game.handlePlayerLeave(departed.id).success, true);
    assert.equal(game.status, 'playing');
    assert.equal(game.players.find(player => player.id === departed.id).isOnline, false);
    assert.equal(game.draftQueue.includes(departed.id), false);
    assert.notEqual(game.getPublicState().currentTurn, departed.id);
    const next = game.players[game.currentTurnIndex];
    assert.equal(next.isOnline, true);
    assert.equal(game.handleAction(next.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }).success, true);
    assert.ok(eventsOf(game.getPublicState()).some(event => event.kind === 'playerLeft'));
});

test('胡闹运动会仅剩一人时提前结算，且自然终局离场不改写胜者', () => {
    let now = 50_000;
    const closing = new MagicalAthleteEngine('ma-presentation-leave-final', players(['a', 'b']), { random: () => 0.2, now: () => now });
    assert.equal(closing.start().success, true);
    closing.players[0].score = 7;
    closing.players[1].score = 2;
    assert.equal(closing.handlePlayerLeave('b').ended, true);
    assert.equal(closing.status, 'ended');
    assert.equal(closing.winner.id, 'a');
    const final = eventsOf(closing.getPublicState()).findLast(event => event.kind === 'finalSettlement');
    assert.equal(final.reason, 'players');
    assert.deepEqual(final.winnerIds, ['a']);

    const natural = new MagicalAthleteEngine('ma-natural-final-leave', players(['a', 'b']), { random: () => 0.2, now: () => now });
    assert.equal(natural.start().success, true);
    natural.status = 'ended';
    natural.phase = 'ended';
    natural.winner = natural.players[0];
    natural.winners = [natural.players[0]];
    const before = natural.winner;
    assert.equal(natural.handlePlayerLeave('a').success, true);
    assert.equal(natural.winner, before);
    assert.equal(eventsOf(natural.getPublicState()).filter(event => event.kind === 'finalSettlement').length, 0);
});

test('胡闹运动会淘汰确认到期后由服务端自动确认并继续', () => {
    let now = 60_000;
    const game = new MagicalAthleteEngine('ma-presentation-ack-timeout', players(['a', 'b']), { random: () => 0.2, now: () => now });
    assert.equal(game.start().success, true);
    game.phase = 'race';
    game.racers = [{
        id: 'a:legs', playerId: 'a', athleteId: 'legs', position: 3, finishOrder: null,
        tripped: false, eliminated: true, eliminationOrder: 1, copiedPowers: [], bronze: 0,
    }];
    game.pendingAcknowledgements = [{
        id: 'ack-1', playerId: 'a', playerName: '玩家a', racerId: 'a:legs', athleteId: 'legs',
        athleteName: '飞毛腿', sourceRacerId: null, position: 3, deadlineAt: now + 100,
    }];
    assert.equal(game.handleSystemTick(), null);
    now += 101;
    const result = game.handleSystemTick();
    assert.equal(result.success, true);
    assert.equal(game.pendingAcknowledgements.length, 0);
    const event = eventsOf(game.getPublicState()).findLast(item => item.kind === 'racerEliminated');
    assert.equal(event.acknowledgedBy, null);
    assert.equal(event.automatic, undefined);
    assert.match(result.message, /自动处理/);

    const late = new MagicalAthleteEngine('ma-presentation-ack-late', players(['a', 'b']), { random: () => 0.2, now: () => now });
    assert.equal(late.start().success, true);
    late.phase = 'race';
    late.racers = [{ id: 'a:legs', playerId: 'a', athleteId: 'legs', position: 3, finishOrder: null, tripped: false, eliminated: true, eliminationOrder: 1, copiedPowers: [], bronze: 0 }];
    late.pendingAcknowledgements = [{ id: 'late-ack', playerId: 'a', racerId: 'a:legs', athleteId: 'legs', athleteName: '飞毛腿', deadlineAt: now - 1 }];
    const lateResult = late.handleAction('a', { kind: 'acknowledgeElimination', acknowledgementId: 'late-ack' });
    assert.equal(lateResult.success, true);
    assert.match(lateResult.message, /自动处理/);
});

test('胡闹运动会客户端本地化会忽略过期批次并保留绝对事件时间', async () => {
    const { localizePresentation } = await import('../public/games/magicalathlete/state.js');
    const batch = {
        sequence: 2, serverNow: 10_000, startedAt: 10_100, endsAt: 11_000,
        events: [{ kind: 'racerMoved', startedAt: 10_100, endsAt: 10_880 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].endsAt, 50_880);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
