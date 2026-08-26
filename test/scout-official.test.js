const test = require('node:test');
const assert = require('node:assert/strict');
const ScoutEngine = require('../server/games/scout/engine');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));
}

function lockOrientations(game, orientation = 0) {
    for (const player of game.players.filter(item => !item.orientationSet)) {
        assert.equal(game.handleAction(player.id, { kind: 'setOrientation', orientation }).success, true);
    }
}

function playGreedyGame(game, maxSteps = 5000) {
    let steps = 0;
    while (game.status === 'playing' && steps++ < maxSteps) {
        if (game.phase === 'orienting') { lockOrientations(game); continue; }
        const player = game.players[game.currentPlayerIndex];
        let acted = false;
        for (let start = 0; start < player.hand.length && !acted; start += 1) {
            for (let end = start; end < player.hand.length && !acted; end += 1) {
                const result = game.handleAction(player.id, { kind: 'show', cardIndices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset) });
                if (result.success) acted = true;
            }
        }
        if (!acted) {
            const result = game.handleAction(player.id, { kind: 'scout', edge: 'left', insertAt: 0, orientation: 0 });
            assert.equal(result.success, true, result.message);
        }
    }
    assert.ok(steps < maxSteps, '马戏星探自动对局超过步数上限');
    assert.equal(game.status, 'ended');
}

test('Scout validates the official roster, deck variants, marker, and one-shot start', () => {
    assert.equal(ScoutEngine.buildDeck().length, 45);
    const tooMany = new ScoutEngine('scout-six', players(6), () => 0);
    assert.equal(tooMany.start().success, false);
    const duplicate = new ScoutEngine('scout-duplicate', [{ id: 'x', name: '甲' }, { id: 'x', name: '乙' }, ...players(3)], () => 0);
    assert.equal(duplicate.start().success, false);
    const game = new ScoutEngine('scout-once', players(5), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.start().success, false);
    assert.equal(game.players.flatMap(player => player.hand).length, 45);
    assert.equal(game.players.every(player => player.hand.length === 9), true);
    assert.ok(game.players.some(player => player.hand.some(card => card.front === 1 && card.back === 2)));
});

test('Scout applies the official setup removals and combination hierarchy', () => {
    const three = new ScoutEngine('scout-three-setup', players(3), () => 0);
    assert.equal(three.start().success, true);
    assert.equal(three.players.flatMap(player => player.hand).some(card => card.front === 10 || card.back === 10), false);
    const four = new ScoutEngine('scout-four-setup', players(4), () => 0);
    assert.equal(four.start().success, true);
    assert.equal(four.players.flatMap(player => player.hand).some(card => card.front === 9 && card.back === 10), false);
    const five = new ScoutEngine('scout-five-setup', players(5), () => 0);
    assert.equal(five.start().success, true);
    assert.equal(five.players.flatMap(player => player.hand).length, 45);
    const card = (value, id) => ({ id, front: value, back: value + 1, orientation: 0 });
    assert.equal(ScoutEngine.combination([card(3, 'a'), card(3, 'b')]).kind, 'matching');
    assert.equal(ScoutEngine.combination([card(3, 'a'), card(4, 'b')]).kind, 'sequence');
    const matching = ScoutEngine.combination([card(4, 'a'), card(4, 'b')]);
    const sequence = ScoutEngine.combination([card(8, 'a'), card(9, 'b')]);
    assert.equal(matching.length, sequence.length);
    assert.equal(matching.kind === 'matching', true);
    assert.equal(ScoutEngine.compareCombination(matching, sequence) > 0, true);
});

test('Scout & Show rolls back every changed field when the immediate show is illegal', () => {
    const game = new ScoutEngine('scout-show-rollback', players(3), () => 0);
    game.start(); lockOrientations(game);
    game.phase = 'turn'; game.currentPlayerIndex = 0; game.activeOwnerId = 'p2';
    game.activeSet = [{ id: 'active-left', front: 8, back: 2, orientation: 0 }, { id: 'active-right', front: 9, back: 3, orientation: 0 }];
    game.players[0].hand = [{ id: 'h1', front: 1, back: 4, orientation: 0 }, { id: 'h2', front: 5, back: 6, orientation: 0 }];
    const before = { hand: game.players[0].hand.map(card => card.id), active: game.activeSet.map(card => card.id), tokens: game.players[1].scoutTokens, available: game.players[0].scoutShowAvailable };
    assert.equal(game.handleAction('p1', { kind: 'scoutShow', edge: 'left', insertAt: 1, orientation: 1, cardIndices: [0, 2] }).success, false);
    assert.deepEqual(game.players[0].hand.map(card => card.id), before.hand);
    assert.deepEqual(game.activeSet.map(card => card.id), before.active);
    assert.equal(game.players[1].scoutTokens, before.tokens);
    assert.equal(game.players[0].scoutShowAvailable, before.available);
});

test('Scout two-player no-action state ends the round and preserves the chip rule', () => {
    const game = new ScoutEngine('scout-two-no-action', players(2), () => 0);
    game.start(); lockOrientations(game);
    game.phase = 'turn'; game.currentPlayerIndex = 0; game.activeOwnerId = 'p2';
    game.activeSet = [{ id: 'active', front: 9, back: 10, orientation: 0 }];
    game.players[0].hand = [{ id: 'weak', front: 1, back: 2, orientation: 0 }];
    game.players[0].scoutChips = 0;
    assert.equal(game.handleAction('p1', { kind: 'show', cardIndices: [0] }).success, true);
    assert.equal(game.round, 2);
    assert.equal(game.lastRound.reason, 'unbeatable');
    assert.equal(game.players[0].scoutChips, 3);
});

test('Scout completes three independent maximum-player games from setup to final score', () => {
    for (let run = 1; run <= 3; run += 1) {
        const game = new ScoutEngine(`scout-max-${run}`, players(5), () => 0);
        assert.equal(game.start().success, true);
        playGreedyGame(game);
        assert.equal(game.round, 5);
        assert.ok(game.winners.length >= 1);
        assert.equal(game.players.reduce((sum, player) => sum + player.score, 0) >= -45, true);
    }
});

test('Scout exposes both public card ends and publishes structured show and scout events', () => {
    const game = new ScoutEngine('scout-presentation-events', players(3), () => 0);
    game.start(); lockOrientations(game);
    game.phase = 'turn'; game.currentPlayerIndex = 0; game.activeOwnerId = 'p2';
    game.activeSet = [{ id: 'stage-card', front: 5, back: 9, orientation: 0 }];
    game.players[0].hand = [{ id: 'show-card', front: 6, back: 10, orientation: 0 }, { id: 'reserve-card', front: 1, back: 2, orientation: 0 }];

    const publicStage = game.getPublicState().activeSet[0];
    assert.equal(publicStage.value, 5);
    assert.equal(publicStage.otherValue, 9);
    assert.equal(publicStage.front, 5);
    assert.equal(publicStage.back, 9);

    assert.equal(game.handleAction('p1', { kind: 'show', cardIndices: [0] }).success, true);
    const showEvent = game.presentation.events[0];
    assert.equal(showEvent.kind, 'showPerformed');
    assert.equal(showEvent.actorId, 'p1');
    assert.equal(showEvent.previousShow[0].otherValue, 9);
    assert.equal(showEvent.newShow[0].value, 6);
    assert.equal(showEvent.capturedCount, 1);

    game.currentPlayerIndex = 1;
    game.activeOwnerId = 'p1';
    game.activeSet = [{ id: 'scout-card', front: 7, back: 3, orientation: 0 }, { id: 'stay-card', front: 8, back: 4, orientation: 0 }];
    assert.equal(game.handleAction('p2', { kind: 'scout', edge: 'left', insertAt: 0, orientation: 1 }).success, true);
    const scoutEvent = game.presentation.events[0];
    assert.equal(scoutEvent.kind, 'cardScouted');
    assert.equal(scoutEvent.card.value, 3);
    assert.equal(scoutEvent.card.otherValue, 7);
    assert.equal(scoutEvent.ownerTokenAwarded, 1);
    assert.equal(scoutEvent.activeAfter.length, 1);
});

test('Scout preserves score breakdowns for the round curtain and final ceremony', () => {
    const game = new ScoutEngine('scout-final-presentation', players(3), () => 0);
    game.start(); lockOrientations(game);
    game.round = game.maxRounds;
    game.phase = 'turn';
    game.activeOwnerId = 'p1';
    game.activeSet = [{ id: 'final-show', front: 9, back: 10, orientation: 0 }];
    game.players[0].captured = 4; game.players[0].scoutTokens = 2; game.players[0].hand = [{ id: 'a', front: 1, back: 2, orientation: 0 }];
    game.players[1].captured = 2; game.players[1].hand = [{ id: 'b', front: 3, back: 4, orientation: 0 }, { id: 'c', front: 5, back: 6, orientation: 0 }];
    game.players[2].captured = 1; game.players[2].hand = [{ id: 'd', front: 7, back: 8, orientation: 0 }];
    game._finishRound('p1', 'unbeatable');

    assert.equal(game.roundHistory.length, 1);
    assert.equal(game.lastRound.scores[0].capturedPoints, 4);
    assert.equal(game.lastRound.scores[0].scoutTokenPoints, 2);
    assert.equal(game.lastRound.scores[0].handPenalty, 0);
    assert.equal(game.presentation.events.at(-2).kind, 'roundSettlement');
    assert.equal(game.presentation.events.at(-1).kind, 'finalSettlement');
    assert.ok(game.presentation.events.at(-1).winnerIds.length >= 1);
});
