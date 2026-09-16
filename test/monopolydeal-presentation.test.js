'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const MonopolyDealEngine = require('../server/games/monopolydeal/engine');
const { PRESENTATION_FADE_MS } = MonopolyDealEngine;

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));
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
            assert.equal(event.contentDurationMs + PRESENTATION_FADE_MS, event.durationMs);
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    }
    return state;
}

test('大富翁纸牌普通行动留在桌面且不创建阻塞播报', () => {
    let now = 10_000;
    const game = new MonopolyDealEngine('monopolydeal-presentation-timeline', players(3), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    let state = game.getPublicState();
    assert.deepEqual(state.presentations, []);
    assert.equal(state.presentation, null);

    const player = game.players[0];
    assert.equal(game.handleAction('p1', { kind: 'drawCards' }).success, true);
    player.hand[0] = { id: 'money-test', kind: 'money', value: 1, name: '1M 现金' };
    assert.equal(game.handleAction('p1', { kind: 'playCard', cardId: 'money-test', zone: 'bank' }).success, true);
    state = game.getPublicState();
    assert.deepEqual(state.presentations, []);
    assert.equal(state.presentation, null);
    assert.match(state.actionLog.at(-1), /银行/);
});

test('大富翁纸牌开局不锁桌并可立即摸牌', () => {
    const room = new Room('monopolydeal-presentation-lock', 'p1', '玩家1', 'monopolydeal', {}, { readyCheckEnabled: true });
    for (const player of players(2)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    assert.equal(room.getPlayerGameState('p1').presentation, null);
    assert.equal(room.handleGameAction('p1', { kind: 'drawCards' }).success, true);
});

test('大富翁纸牌只向赢家投影个人获胜文案并保持同一时间槽', () => {
    let now = 20_000;
    const game = new MonopolyDealEngine('monopolydeal-personal-victory', players(3), { random: () => 0, now: () => now });
    game.start();
    const winner = game.players[0];
    for (const [color, count] of [['brown', 2], ['lightblue', 3], ['pink', 3]]) {
        winner.properties[color] = Array.from({ length: count }, (_, index) => ({ id: `${color}-${index}`, kind: 'property', color, value: 1, groupId: `winner:${color}` }));
    }
    assert.equal(game._checkWin(winner).ended, true);
    const publicFinal = eventsOf(game.getPublicState()).findLast(event => event.kind === 'finalSettlement');
    const personalFinal = eventsOf(game.getPlayerState('p1')).findLast(event => event.kind === 'finalSettlement');
    const spectatorFinal = eventsOf(game.getPlayerState('p2')).findLast(event => event.kind === 'finalSettlement');
    assert.equal(personalFinal.viewerVariant, 'personalVictory');
    assert.equal(personalFinal.title, '您已获胜');
    assert.equal(personalFinal.startedAt, publicFinal.startedAt);
    assert.equal(personalFinal.endsAt, publicFinal.endsAt);
    assert.equal(spectatorFinal.viewerVariant, undefined);
});

test('大富翁纸牌离场事件和最后一位结算不遗留悬挂回应', () => {
    let now = 30_000;
    const game = new MonopolyDealEngine('monopolydeal-leave', players(2), { random: () => 0, now: () => now });
    game.start();
    const result = game.handlePlayerLeave('p1');
    assert.equal(result.ended, true);
    assert.ok(result.state?.presentation);
    assert.equal(game.status, 'ended');
    assert.equal(game.endReason, 'lastPlayerStanding');
    assert.equal(game.getWinner().id, 'p2');
    assert.equal(game.pendingAction, null);
    assert.equal(game.pendingDebt, null);
    assert.deepEqual(eventsOf(game.getPublicState()).slice(-1).map(event => event.kind), ['finalSettlement']);
    const personal = eventsOf(game.getPlayerState('p1'));
    assert.equal(personal.findLast(event => event.kind === 'finalSettlement').viewerVariant, 'personalDeparture');
});
