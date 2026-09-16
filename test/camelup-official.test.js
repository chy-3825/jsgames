const assert = require('node:assert/strict');
const test = require('node:test');
const Room = require('../server/room');
const CamelUp = require('../server/games/camelup');
const Engine = require('../server/games/camelup/engine');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `camel${index}`, name: `玩家${index + 1}` }));
}

function random(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

test('Camel Up enforces the official 3-8 player setup and private five-card hands', () => {
    assert.equal(CamelUp.create('camel-small', players(2)).start().success, false);
    assert.equal(CamelUp.create('camel-large', players(9)).start().success, false);
    const session = CamelUp.create('camel-setup', players(8), null, { random: random(101) });
    assert.equal(session.start().success, true);
    assert.equal(session.start().success, false, 'a race cannot be restarted in place');
    const game = session.engine;
    assert.deepEqual(game.players.map(player => player.raceCards.length), Array(8).fill(5));
    assert.equal(game.camels.every(camel => camel.position >= 1 && camel.position <= 3), true);
    assert.equal(game.players.every(player => player.cash === 3 && player.tile === null), true);
    assert.equal(game.getPublicState().players.every(player => !Object.hasOwn(player, 'raceCards')), true);
    const presentation = game.getPublicState().presentation;
    assert.equal(presentation.resolved, true);
    assert.deepEqual(presentation.events.map(event => event.kind), ['raceStarted', 'legStarted']);
    assert.deepEqual(presentation.events[0].camels.map(camel => [camel.id, camel.position, camel.order]), game.camels.map(camel => [camel.id, camel.position, camel.order]));
    assert.equal(presentation.events[0].startingCoins, 3);
    assert.equal(presentation.events[1].leg, 1);
});

test('Camel Up applies stacked movement, oasis/mirage order and finite leg rewards', () => {
    const game = new Engine('camel-stack', players(3), random(102));
    assert.equal(game.start().success, true);
    game.camels.forEach(camel => { camel.position = camel.id === 'red' ? 2 : camel.id === 'blue' ? 5 : 8; camel.order = camel.id === 'red' ? 0 : camel.id === 'blue' ? 0 : 0; });
    game.tiles[4] = { ownerId: 'camel0', ownerName: '玩家1', kind: 'oasis' };
    game._moveCamel('red', 2);
    assert.deepEqual(game._stackAt(5).map(camel => camel.id), ['blue', 'red'], 'oasis places the moving unit on top');
    game.tiles[8] = { ownerId: 'camel0', ownerName: '玩家1', kind: 'mirage' };
    game.camels.find(camel => camel.id === 'red').position = 6;
    game.camels.find(camel => camel.id === 'red').order = 0;
    game.camels.find(camel => camel.id === 'blue').position = 7;
    game.camels.find(camel => camel.id === 'blue').order = 0;
    game._moveCamel('red', 2);
    assert.deepEqual(game._stackAt(7).map(camel => camel.id), ['red', 'blue'], 'mirage places the moving unit underneath');
    game.players[0].legBets = [{ camelId: 'red', payout: 5 }, { camelId: 'blue', payout: 2 }];
    game.players[0].pyramidTiles = 1;
    game.camels.forEach(camel => { camel.position = camel.id === 'red' ? 10 : camel.id === 'blue' ? 9 : 3; });
    game._settleLeg();
    assert.equal(game.players[0].cash, 12, '5 for first, +1 for second, +1 pyramid and two tile hits');
    assert.equal(game.legTiles.red[0], 5);
    assert.equal(Object.keys(game.tiles).length, 0);
});

test('Camel Up settles overall winner/loser cards in placement order and shares tied victories', () => {
    const game = new Engine('camel-final', players(3), random(103));
    assert.equal(game.start().success, true);
    game.turnPlayerIndex = 0;
    const red = game.players[0].raceCards.find(card => card.camelId === 'red');
    assert.equal(game.handleAction('camel0', { kind: 'betOverall', cardId: red.id, outcome: 'winner' }).success, true);
    game.turnPlayerIndex = 1;
    const blue = game.players[1].raceCards.find(card => card.camelId === 'blue');
    assert.equal(game.handleAction('camel1', { kind: 'betOverall', cardId: blue.id, outcome: 'loser' }).success, true);
    game.camels.forEach(camel => { camel.position = ['red', 'blue'].includes(camel.id) ? 16 : 2; camel.order = camel.id === 'red' ? 1 : 0; });
    game._settleLeg(true);
    game._finishRace('red');
    assert.equal(game.players[0].cash, 11, 'the first correct overall winner card receives 8');
    assert.equal(game.players[1].cash, 2, 'an incorrect overall loser card loses 1');

    const tie = new Engine('camel-tie', players(3), random(104));
    assert.equal(tie.start().success, true);
    tie._finishRace();
    assert.equal(tie.winners.length, 3, 'without bets all three players remain tied at three coins');
    assert.equal(tie.getWinner().shared, true);
    assert.equal(tie.getPublicState().winners.length, 3);
});

test('Camel Up allows a desert tile on any empty track space except space 1', () => {
    const game = new Engine('camel-tile-sixteen', players(3), random(105));
    assert.equal(game.start().success, true);
    assert.equal(game.handleAction('camel0', { kind: 'placeTile', position: 16, tileType: 'oasis' }).success, true);
    assert.equal(game.tiles[16].kind, 'oasis');
});

test('Camel Up completes three independent maximum-player races from start to shared end scoring', () => {
    for (const seed of [201, 202, 203]) {
        const session = CamelUp.create(`camel-full-${seed}`, players(8), null, { random: random(seed) });
        assert.equal(session.start().success, true);
        const game = session.engine;
        let steps = 0;
        while (game.status === 'playing' && steps < 5000) {
            steps += 1;
            const player = game.players[game.turnPlayerIndex];
            let result;
            if (steps % 5 === 0) {
                const camelId = Object.keys(game.legTiles).find(id => game.legTiles[id].length);
                result = session.handleAction(player.id, { kind: 'betLeg', camelId });
            } else if (steps % 7 === 0 && player.raceCards.length) {
                result = session.handleAction(player.id, { kind: 'betOverall', cardId: player.raceCards[0].id, outcome: steps % 2 ? 'winner' : 'loser' });
            } else if (steps % 4 === 0) {
                const occupied = new Set(game.camels.map(camel => camel.position));
                const existing = Object.keys(game.tiles).map(Number);
                const position = Array.from({ length: 14 }, (_, index) => index + 2).find(candidate => !occupied.has(candidate) && !existing.includes(candidate) && existing.every(tile => Math.abs(tile - candidate) > 1));
                result = position == null ? session.handleAction(player.id, { kind: 'rollDie' }) : session.handleAction(player.id, { kind: 'placeTile', position, tileType: steps % 2 ? 'oasis' : 'mirage' });
            } else {
                result = session.handleAction(player.id, { kind: 'rollDie' });
            }
            assert.equal(result.success, true, `${seed}: step ${steps} should advance the race`);
        }
        assert.equal(game.status, 'ended');
        assert.equal(game.phase, 'ended');
        assert.ok(game.winner);
        assert.ok(game.winners.length >= 1);
        assert.equal(game.history.length >= 1, true);
        assert.ok(steps < 5000);
    }
});

test('Camel Up publishes the die, carried stack and desert-tile movement in order', () => {
    const game = new Engine('camel-presentation-move', players(3), () => 0);
    assert.equal(game.start().success, true);
    game.camels.forEach((camel, index) => {
        camel.position = index < 2 ? 3 : 8 + index;
        camel.order = index < 2 ? index : 0;
    });
    game.tiles[4] = { ownerId: 'camel1', ownerName: '玩家2', kind: 'oasis' };

    assert.equal(game.handleAction('camel0', { kind: 'rollDie' }).success, true);
    const presentation = game.getPublicState().presentation;
    assert.equal(presentation.resolved, true);
    assert.deepEqual(presentation.events.map(event => event.kind), ['dieRevealed', 'camelMoved', 'desertTileTriggered']);
    assert.deepEqual(presentation.events[1].movingCamels.map(camel => camel.id), ['red', 'blue']);
    assert.deepEqual({ from: presentation.events[1].from, landing: presentation.events[1].to, steps: presentation.events[1].steps }, { from: 3, landing: 4, steps: 1 });
    assert.deepEqual({ type: presentation.events[2].tileType, from: presentation.events[2].from, to: presentation.events[2].to, owner: presentation.events[2].ownerId, reward: presentation.events[2].reward }, { type: 'oasis', from: 4, to: 5, owner: 'camel1', reward: 1 });
    assert.equal(game.playerMap.camel1.cash, 4);
});

test('Camel Up keeps an overall bet face down until the race is finished', () => {
    const game = new Engine('camel-presentation-secret', players(3), random(106));
    assert.equal(game.start().success, true);
    const card = game.players[0].raceCards.find(item => item.camelId === 'red');
    assert.equal(game.handleAction('camel0', { kind: 'betOverall', cardId: card.id, outcome: 'winner' }).success, true);

    const publicPresentation = game.getPublicState().presentation;
    const publicEvent = publicPresentation.events[0];
    assert.equal(publicEvent.kind, 'overallBetPlaced');
    assert.equal(Object.hasOwn(publicEvent, 'camelId'), false);
    assert.equal(Object.hasOwn(publicEvent, 'cardId'), false);
    assert.equal(Object.hasOwn(publicEvent, 'private'), false);
    assert.equal(game.getPublicState().actionLog.at(-1).includes('赤焰'), false, 'the shared action log must not reveal the selected camel');

    const ownerEvent = game.getPlayerState('camel0').presentation.events[0];
    const opponentEvent = game.getPlayerState('camel1').presentation.events[0];
    assert.deepEqual(ownerEvent.private, { cardId: card.id, camelId: 'red', camelName: '赤焰' });
    assert.equal(Object.hasOwn(opponentEvent, 'private'), false);
});

test('Camel Up publishes a complete leg settlement and the next-leg curtain', () => {
    const game = new Engine('camel-presentation-leg', players(3), random(107));
    assert.equal(game.start().success, true);
    game.camels.forEach((camel, index) => { camel.position = 12 - index; camel.order = 0; });
    game.players[0].legBets = [{ camelId: 'red', payout: 5 }, { camelId: 'blue', payout: 3 }];
    game.players[0].pyramidTiles = 2;
    game._settleLeg();

    const presentation = game.getPublicState().presentation;
    assert.deepEqual(presentation.events.map(event => event.kind), ['legSettlement', 'legStarted']);
    const result = presentation.events[0].playerResults.find(player => player.playerId === 'camel0');
    assert.deepEqual({ cashBefore: result.cashBefore, cashAfter: result.cashAfter, change: result.change, pyramid: result.pyramidReward }, { cashBefore: 3, cashAfter: 11, change: 8, pyramid: 2 });
    assert.deepEqual(result.bets.map(bet => [bet.camelId, bet.rank, bet.reward]), [['red', 1, 5], ['blue', 2, 1]]);
    assert.equal(presentation.events[1].leg, 2);
    assert.equal(game.rolled.size, 0);
});

test('Camel Up reveals terminal bets in placement order before publishing final standings', () => {
    const game = new Engine('camel-presentation-final', players(3), random(108));
    assert.equal(game.start().success, true);
    game.camels.forEach((camel, index) => { camel.position = 16 - index * 2; camel.order = 0; });
    game.players[0].overallBets = [{ cardId: 'red-winner', camelId: 'red', outcome: 'winner', order: 1 }];
    game.players[1].overallBets = [
        { cardId: 'blue-winner', camelId: 'blue', outcome: 'winner', order: 2 },
        { cardId: 'white-loser', camelId: 'white', outcome: 'loser', order: 1 },
    ];
    game.players[2].overallBets = [{ cardId: 'green-loser', camelId: 'green', outcome: 'loser', order: 2 }];
    game._finishRace();

    const presentation = game.getPublicState().presentation;
    assert.deepEqual(presentation.events.map(event => event.kind), ['raceFinished', 'overallBetsRevealed', 'finalSettlement']);
    const reveals = presentation.events[1];
    assert.deepEqual(reveals.winnerBets.map(bet => [bet.cardId, bet.correct, bet.reward]), [['red-winner', true, 8], ['blue-winner', false, -1]]);
    assert.deepEqual(reveals.loserBets.map(bet => [bet.cardId, bet.correct, bet.reward]), [['white-loser', true, 8], ['green-loser', false, -1]]);
    assert.equal(presentation.events[2].standings[0].id, 'camel0');
    assert.equal(presentation.events[2].standings[0].cash, 11);
    assert.deepEqual(presentation.events[2].winnerIds, ['camel0']);
});

test('Camel Up schedules public presentations on one absolute server timeline', () => {
    const game = new Engine('camel-presentation-timeline', players(3), random(109));
    assert.equal(game.start().success, true);
    let state = game.getPublicState();
    assert.ok(Number.isFinite(state.serverNow));
    assert.equal(state.presentation.blocking, true);
    assert.equal(state.presentation.durationMs, state.presentation.endsAt - state.presentation.startedAt);
    assert.ok(state.presentation.events.every(event => event.endsAt > event.startedAt && event.durationMs === event.endsAt - event.startedAt));
    assert.equal(state.presentation.events.at(-1).endsAt, state.presentation.endsAt);

    const current = game.players[game.turnPlayerIndex];
    assert.equal(game.handleAction(current.id, { kind: 'betLeg', camelId: 'red' }).success, true);
    state = game.getPublicState();
    assert.deepEqual(state.presentations.map(batch => batch.sequence), [1, 2]);
    assert.equal(state.presentations[0].endsAt, state.presentations[1].startedAt);
    assert.equal(state.presentations[1].events[0].startedAt, state.presentations[1].startedAt);
});

test('Camel Up room gate rejects actions until the authoritative presentation deadline', () => {
    const room = new Room('camel-presentation-lock', 'camel0', '玩家1', 'camelup', {}, { readyCheckEnabled: true });
    for (const player of players(3)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('camel0').presentation;
    assert.equal(locked.blocking, true);
    const rejected = room.handleGameAction('camel0', { kind: 'betLeg', camelId: 'red' });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);
    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        assert.equal(room.handleGameAction('camel0', { kind: 'betLeg', camelId: 'red' }).success, true);
    } finally {
        Date.now = realNow;
    }
});

test('Camel Up projects sole and tied winners into the same final presentation slot', () => {
    const sole = new Engine('camel-personal-winner', players(3), random(110));
    sole.start();
    sole.players[0].cash = 8;
    sole._finishRace();
    const publicSole = sole.getPublicState().presentations.flatMap(batch => batch.events).findLast(event => event.kind === 'finalSettlement');
    const soleWinner = sole.getPlayerState('camel0').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    const soleOpponent = sole.getPlayerState('camel1').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    assert.equal(soleWinner.viewerVariant, 'personalVictory');
    assert.equal(soleWinner.title, '您已获胜');
    assert.equal(soleWinner.startedAt, publicSole.startedAt);
    assert.equal(soleWinner.endsAt, publicSole.endsAt);
    assert.equal(soleOpponent.viewerVariant, undefined);

    const tie = new Engine('camel-personal-tie', players(3), random(111));
    tie.start();
    tie.players[0].cash = 8;
    tie.players[1].cash = 8;
    tie._finishRace();
    for (const id of ['camel0', 'camel1']) {
        const event = tie.getPlayerState(id).presentations.flatMap(batch => batch.events).find(item => item.kind === 'finalSettlement');
        assert.equal(event.viewerVariant, 'personalVictory');
        assert.equal(event.title, '您已获胜');
    }
    const spectator = tie.getPlayerState('camel2').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    assert.equal(spectator.viewerVariant, undefined);
});

test('Camel Up retains private overall bets in every queued batch', () => {
    const game = new Engine('camel-private-queue', players(3), random(112));
    game.start();
    const red = game.players[0].raceCards.find(card => card.camelId === 'red');
    const blue = game.players[1].raceCards.find(card => card.camelId === 'blue');
    assert.equal(game.handleAction('camel0', { kind: 'betOverall', cardId: red.id, outcome: 'winner' }).success, true);
    assert.equal(game.handleAction('camel1', { kind: 'betOverall', cardId: blue.id, outcome: 'loser' }).success, true);
    const ownerEvents = game.getPlayerState('camel0').presentations.flatMap(batch => batch.events).filter(event => event.kind === 'overallBetPlaced');
    const opponentEvents = game.getPlayerState('camel1').presentations.flatMap(batch => batch.events).filter(event => event.kind === 'overallBetPlaced');
    const spectatorEvents = game.getPlayerState('camel2').presentations.flatMap(batch => batch.events).filter(event => event.kind === 'overallBetPlaced');
    assert.deepEqual(ownerEvents.map(event => event.private?.camelId), ['red', undefined]);
    assert.deepEqual(opponentEvents.map(event => event.private?.camelId), [undefined, 'blue']);
    assert.equal(spectatorEvents.some(event => event.private), false);
});

test('Camel Up converts server presentation timestamps for a late or reconnecting viewer', async () => {
    const { localizePresentation } = await import('../public/games/camelup/state.js');
    const batch = {
        sequence: 17,
        serverNow: 10_000,
        startedAt: 10_140,
        endsAt: 11_000,
        events: [{ kind: 'camelMoved', startedAt: 10_140, endsAt: 11_000 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_140);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].startedAt, 50_140);
    assert.equal(localized.events[0].endsAt, 51_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});

test('Camel Up ends the public race on departure and keeps the winner in the shared final slot', () => {
    const game = new Engine('camel-departure-finale', players(3), random(113));
    game.start();
    game.players[0].cash = 9;
    game.players[1].cash = 7;
    game.players[2].cash = 1;
    const result = game.handlePlayerLeave('camel2');
    assert.equal(result.success, true);
    assert.equal(result.ended, true);
    assert.equal(game.status, 'ended');
    assert.deepEqual(game.winners.map(player => player.id), ['camel0']);
    const publicEvent = game.getPublicState().presentations.flatMap(batch => batch.events).findLast(event => event.kind === 'finalSettlement');
    const winnerEvent = game.getPlayerState('camel0').presentations.flatMap(batch => batch.events).find(event => event.kind === 'finalSettlement');
    assert.equal(publicEvent.viewerVariant, undefined);
    assert.equal(winnerEvent.viewerVariant, 'personalVictory');
    assert.equal(winnerEvent.title, '您已获胜');
    assert.equal(winnerEvent.startedAt, publicEvent.startedAt);
    assert.equal(winnerEvent.endsAt, publicEvent.endsAt);
});
