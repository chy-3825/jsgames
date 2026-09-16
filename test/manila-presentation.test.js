'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../server/room');
const ManilaEngine = require('../server/games/manila/engine');

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
            if (index) assert.equal(batch.events[index - 1].endsAt, event.startedAt);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt);
    return state;
}

test('Manila uses server absolute time and preserves cross-action presentation FIFO', () => {
    let now = 10_000;
    const game = new ManilaEngine('manila-presentation-timeline', players(4), { random: () => 0, now: () => now });
    assert.equal(game.start().success, true);
    let state = assertTimeline(game.getPublicState());
    assert.deepEqual(state.presentations[0].events.map(event => event.kind), ['voyageStarted']);
    assert.equal(state.presentations[0].startedAt, now);
    const openingEnd = state.presentation.endsAt;

    assert.equal(game.handleAction('p1', { kind: 'pass' }).success, true);
    state = assertTimeline(game.getPublicState());
    assert.equal(state.presentations.length, 2);
    assert.equal(state.presentations[1].startedAt, openingEnd);
    assert.equal(state.presentations[1].events[0].kind, 'auctionPassed');
});

test('Manila room rejects actions until the authoritative presentation deadline', () => {
    const room = new Room('manila-presentation-lock', 'p1', '玩家1', 'manila', {}, { readyCheckEnabled: true });
    for (const player of players(3)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('p1').presentation;
    assert.equal(locked.blocking, true);
    assert.equal(room.handleGameAction('p1', { kind: 'pass' }).success, false);
    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try { assert.equal(room.handleGameAction('p1', { kind: 'pass' }).success, true); } finally { Date.now = realNow; }
});

test('Manila projects a winner-only presentation without changing its time slot', () => {
    let now = 20_000;
    const game = new ManilaEngine('manila-personal-winner', players(3), { random: () => 0, now: () => now });
    game.start();
    game.players[0].cash = 100;
    game.players[1].cash = 10;
    game.players[2].cash = 5;
    game._finish();
    const publicEvent = eventsOf(game.getPublicState()).findLast(event => event.kind === 'finalSettlement');
    const winnerEvent = eventsOf(game.getPlayerState('p1')).findLast(event => event.kind === 'finalSettlement');
    const spectatorEvent = eventsOf(game.getPlayerState('p2')).findLast(event => event.kind === 'finalSettlement');
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
    assert.equal(spectatorEvent.viewerVariant, undefined);
});

test('Manila skips a leaving current auction seat and settles a minimum-player departure', () => {
    let now = 30_000;
    const ongoing = new ManilaEngine('manila-leave-auction', players(4), { random: () => 0, now: () => now });
    ongoing.start();
    assert.equal(ongoing.handlePlayerLeave('p1').success, true);
    assert.equal(ongoing.getPublicState().currentTurn, 'p2');
    let guard = 0;
    while (ongoing.phase === 'auction' && guard++ < 10) {
        const current = ongoing.players[ongoing.auction.currentIndex];
        assert.ok(current?.isOnline);
        assert.equal(ongoing.handleAction(current.id, { kind: 'pass' }).success, true);
    }
    assert.equal(ongoing.phase, 'master');
    assert.notEqual(ongoing.harborMasterId, 'p1');

    const closing = new ManilaEngine('manila-leave-final', players(3), { random: () => 0, now: () => now });
    closing.start();
    closing.players[0].cash = 80;
    closing.players[1].cash = 10;
    assert.equal(closing.handlePlayerLeave('p3').ended, true);
    assert.equal(closing.status, 'ended');
    assert.equal(closing.getWinner().id, 'p1');
    assert.deepEqual(closing.getPublicState().presentations.at(-1).events.map(event => event.kind), ['playerLeft', 'finalSettlement']);
    assert.equal(closing.getPlayerState('p1').presentations.at(-1).events.at(-1).title, '您已获胜');
});

test('Manila transfers or skips every phase owner when a seat leaves', () => {
    const prepared = () => {
        const game = new ManilaEngine('manila-phase-leave', players(4), { random: () => 0, now: () => 50_000 });
        game.start();
        while (game.phase === 'auction') {
            const current = game.players[game.auction.currentIndex];
            game.handleAction(current.id, { kind: 'pass' });
        }
        game.handleAction(game.harborMasterId, { kind: 'skipShare' });
        game.handleAction(game.harborMasterId, { kind: 'setBoats', boats: [{ good: '人参', start: 3 }, { good: '玉石', start: 3 }, { good: '丝绸', start: 3 }] });
        return game;
    };

    const master = prepared();
    const oldMaster = master.harborMasterId;
    assert.equal(master.handlePlayerLeave(oldMaster).success, true);
    assert.ok(master.playerMap[master.harborMasterId]?.isOnline);
    assert.equal(master.getPublicState().presentations.at(-1).events[0].wasCurrent, true);

    const placement = prepared();
    const placementCurrent = placement.players[placement.placementTurnIndex].id;
    assert.equal(placement.handlePlayerLeave(placementCurrent).success, true);
    assert.ok(placement.players[placement.placementTurnIndex]?.isOnline);

    const sailing = prepared();
    while (sailing.phase === 'placement') sailing.handleAction(sailing.players[sailing.placementTurnIndex].id, { kind: 'passPlacement' });
    const sailingMaster = sailing.harborMasterId;
    assert.equal(sailing.handlePlayerLeave(sailingMaster).success, true);
    assert.ok(sailing.playerMap[sailing.harborMasterId]?.isOnline);
    assert.equal(sailing.handleAction(sailing.harborMasterId, { kind: 'sailBoats', order: sailing.movementPlan.rolls.map(item => item.boatId) }).success, true);

    const pilot = prepared();
    pilot.phase = 'pilot'; pilot.locations['pilot-small'] = [{ playerId: 'p1', fee: 2, slot: 1 }]; pilot.locations['pilot-large'] = [{ playerId: 'p2', fee: 5, slot: 1 }]; pilot.pilotQueue = [{ playerId: 'p1', fee: 2, location: 'pilot-small', pilotSize: 'small' }, { playerId: 'p2', fee: 5, location: 'pilot-large', pilotSize: 'large' }]; pilot.pilotIndex = 0;
    assert.equal(pilot.handlePlayerLeave('p1').success, true);
    assert.equal(pilot.phase, 'pilot');
    assert.equal(pilot.getPublicState().currentTurn, 'p2');
    assert.notEqual(pilot.harborMasterId, 'p1');
    assert.equal(pilot.handleAction('p2', { kind: 'skipPilot' }).success, true);
    assert.equal(pilot.phase, 'sailing');
    assert.ok(pilot.playerMap[pilot.harborMasterId]?.isOnline);

    const pirate = prepared();
    pirate.phase = 'pirateBoard'; pirate.pirateAfter = 'finishMovement'; pirate.locations.pirate = [{ playerId: 'p1', fee: 3, slot: 1 }]; pirate.pirateQueue = [{ playerId: 'p1', fee: 3, slot: 1, boats: [1] }]; pirate.pirateIndex = 0; pirate.boats[0].position = 13; pirate.boats[0].fate = 'sailing';
    assert.equal(pirate.handlePlayerLeave('p1').success, true);
    assert.notEqual(pirate.getPublicState().currentTurn, 'p1');
    assert.ok(pirate.playerMap[pirate.harborMasterId]?.isOnline);

    const plunder = prepared();
    plunder.phase = 'plunder'; plunder.plunderQueue = [{ playerId: 'p1', boatId: 1 }]; plunder.plunderIndex = 0; plunder.boats[0].fate = 'pirated'; plunder.boats[0].pirates = [{ playerId: 'p1', fee: 3 }];
    assert.equal(plunder.handlePlayerLeave('p1').success, true);
    assert.equal(plunder.boats[0].fate, 'port');
    assert.ok(plunder.playerMap[plunder.harborMasterId]?.isOnline);
});

test('Manila natural terminal result is immutable after a later departure', () => {
    const game = new ManilaEngine('manila-terminal-immutable', players(3), { random: () => 0, now: () => 40_000 });
    game.start();
    game.players[0].cash = 1;
    game.players[1].cash = 99;
    game.players[2].cash = 5;
    game._finish();
    const winnerBefore = game.getWinner();
    const sequenceBefore = game.presentationSequence;
    assert.equal(game.handlePlayerLeave('p3').success, true);
    assert.deepEqual(game.getWinner(), winnerBefore);
    assert.equal(game.presentationSequence, sequenceBefore);
});

test('Manila client presentation localization ignores expired batches and preserves event slots', async () => {
    const { localizePresentation } = await import('../public/games/manila/state.js');
    const batch = { sequence: 2, transactionId: 2, serverNow: 10_000, startedAt: 10_100, endsAt: 11_000, events: [{ kind: 'boatsSailed', startedAt: 10_100, endsAt: 11_000, segments: [{ kind: 'move', startedAt: 10_520, endsAt: 11_000 }] }] };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_100);
    assert.equal(localized.events[0].segments[0].endsAt, 51_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});
