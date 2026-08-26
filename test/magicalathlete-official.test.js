const assert = require('node:assert/strict');
const test = require('node:test');
const MagicalAthleteEngine = require('../server/games/magicalathlete/engine');

const players = ids => ids.map(id => ({ id, name: id }));

function draftAndSelect(game) {
    game.start();
    let guard = 0;
    while (game.phase === 'draft' && guard++ < 500) {
        const player = game.players[game.currentTurnIndex];
        assert.equal(game.handleAction(player.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }).success, true);
    }
    assert.equal(game.phase, 'race_select');
    guard = 0;
    while (game.phase === 'race_select' && guard++ < 100) {
        const player = game.players[game.currentTurnIndex];
        const picks = game.raceSelections[player.id] || [];
        const card = player.team.find(item => !player.usedAthletes.includes(item.id) && !picks.includes(item.id));
        assert.ok(card);
        assert.equal(game.handleAction(player.id, { kind: 'selectRaceAthlete', athleteId: card.id }).success, true);
    }
    assert.equal(game.phase, 'race');
    game.pending = null;
}

function setAthlete(game, index, athleteId) {
    game.racers[index].athleteId = athleteId;
    game.racers[index].copiedPowers = [];
    return game.racers[index];
}

function resolvePrompt(game) {
    let guard = 0;
    while (game.pending && guard++ < 100) {
        const prompt = game.pending;
        let action;
        if (prompt.kind === 'eggPick') action = { kind: 'eggPick', athleteId: prompt.pool[0] };
        else if (prompt.kind === 'twinPick') action = { kind: 'twinPick', athleteId: prompt.options[0] };
        else if (prompt.kind === 'predict') {
            const target = game.racers.find(racer => racer.id !== prompt.racerId);
            action = { kind: 'predict', targetRacerId: target.id };
        } else if (prompt.kind === 'copycatPick') action = { kind: 'decide', targetRacerId: prompt.options[0] };
        else if (prompt.kind === 'genius') action = { kind: 'genius', guess: 3 };
        else if (prompt.kind === 'magician' || prompt.kind === 'dicemongerReroll') action = { kind: 'decide', reroll: false };
        else action = { kind: 'decide', use: false };
        assert.equal(game.handleAction(prompt.playerId, action).success, true, prompt.kind);
    }
    assert.equal(game.pending, null);
}

function autoPlay(game, maxSteps = 30000) {
    let guard = 0;
    while (game.status === 'playing' && guard++ < maxSteps) {
        if (game.pendingAcknowledgements?.length) {
            const acknowledgement = game.pendingAcknowledgements[0];
            assert.equal(game.handleAction(acknowledgement.playerId, { kind: 'acknowledgeElimination', acknowledgementId: acknowledgement.id }).success, true);
        } else if (game.phase === 'draft' || game.phase === 'race_select') {
            const player = game.players[game.currentTurnIndex];
            if (game.phase === 'draft') {
                assert.equal(game.handleAction(player.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }).success, true);
            } else {
                const picks = game.raceSelections[player.id] || [];
                const card = player.team.find(item => !player.usedAthletes.includes(item.id) && !picks.includes(item.id));
                assert.ok(card);
                assert.equal(game.handleAction(player.id, { kind: 'selectRaceAthlete', athleteId: card.id }).success, true);
            }
        } else if (game.pending) {
            resolvePrompt(game);
        } else {
            const player = game.players[game.currentTurnIndex];
            const racer = game.racers.find(item => item.playerId === player.id && item.finishOrder == null && !item.eliminated && !item.turnDoneThisRound);
            assert.ok(racer);
            assert.equal(game.handleAction(player.id, { kind: 'roll', athleteId: racer.athleteId }).success, true);
        }
    }
    assert.ok(guard < maxSteps, 'the tournament must not loop');
}

test('Magical Athlete rejects invalid room sizes and does not restart an active match', () => {
    const tooMany = new MagicalAthleteEngine('ma-invalid', players(['a', 'b', 'c', 'd', 'e', 'f', 'g']), () => 0.3);
    assert.equal(tooMany.start().success, false);
    const game = new MagicalAthleteEngine('ma-restart', players(['a', 'b']), () => 0.3);
    assert.equal(game.start().success, true);
    assert.equal(game.start().success, false);
});

test('Magical Athlete uses the official 30-space lanes and all Wild Wilds effects', () => {
    const game = new MagicalAthleteEngine('ma-track', players(['a', 'b']), () => 0.3);
    assert.equal(MagicalAthleteEngine.TRACK_LENGTH, 30);
    assert.deepEqual(MagicalAthleteEngine.TRACK_SPECIALS.mild, {});
    assert.deepEqual(MagicalAthleteEngine.TRACK_SPECIALS.wild, {
        1: 'star', 5: 'trip', 7: 'arrow+3', 11: 'arrow+1', 13: 'star',
        15: 'arrow-4', 16: 'trip', 22: 'arrow+2', 23: 'arrow-2', 25: 'trip',
    });
    assert.equal(game.start().success, true);
});

test('Magical Athlete uses a pre-roll Genius prediction and official Blimp +3', () => {
    const game = new MagicalAthleteEngine('ma-genius', players(['a', 'b']), () => 0.999);
    draftAndSelect(game);
    const genius = setAthlete(game, 0, 'genius');
    const other = setAthlete(game, 1, 'legs');
    genius.position = 0;
    other.position = 10;
    game.currentTurnIndex = game.players.findIndex(player => player.id === genius.playerId);
    game._runRacerTurn(genius);
    assert.equal(game.pending.kind, 'genius');
    assert.equal(game.handleAction(genius.playerId, { kind: 'genius', guess: 6 }).success, true);
    assert.equal(genius.roll, 6);
    assert.ok(game.actionLog.some(message => message.includes('预测正确，再行动一次')));

    const blimp = setAthlete(game, 0, 'airship');
    blimp.position = 3;
    blimp._turnStartPos = 3;
    blimp.roll = 3;
    game._applyMainMove(blimp);
    assert.equal(blimp.position, 9);
});

test('Magical Athlete counts bronze point chips and treats a zero move as no move', () => {
    const game = new MagicalAthleteEngine('ma-bronze', players(['a', 'b']), () => 0.42);
    draftAndSelect(game);
    game.trackSide = 'wild';
    const star = setAthlete(game, 0, 'legs');
    star.position = 1;
    game._resolveStops(star);
    assert.equal(game.playerMap[star.playerId].bronze, 1);
    assert.equal(game.playerMap[star.playerId].score, 1);

    game.players.forEach(player => { player.bronze = 0; player.score = 0; });
    game.racers.forEach(racer => { racer.bronze = 0; racer.beforeRacePending = false; racer.copiedPowers = []; });
    game.racers.slice(2).forEach(racer => { racer.athleteId = 'legs'; });
    const sis = setAthlete(game, 1, 'sisyphus');
    game._resolveBeforeRace();
    assert.equal(game.playerMap[sis.playerId].bronze, 4);
    assert.equal(game.playerMap[sis.playerId].score, 4);
    sis.position = 8;
    sis.roll = 6;
    game._applyMainMove(sis);
    assert.equal(game.playerMap[sis.playerId].bronze, 3);
    assert.equal(game.playerMap[sis.playerId].score, 3);

    const zero = setAthlete(game, 0, 'legs');
    const gunk = setAthlete(game, 1, 'gunk');
    zero.position = 1;
    zero.roll = 1;
    game.trackSide = 'wild';
    game._applyMainMove(zero);
    assert.equal(zero.position, 1);
    assert.equal(zero.bronze, 0, '停在星格但没有移动，不应获得星格铜星');
    assert.equal(gunk.position, 0);
});

test('Magical Athlete keeps Egg/Twin prompt cards private to the deciding player', () => {
    const game = new MagicalAthleteEngine('ma-private-prompt', players(['a', 'b']), () => 0.42);
    draftAndSelect(game);
    game.pending = { kind: 'eggPick', racerId: game.racers[0].id, playerId: 'a', pool: ['alchemist', 'hare', 'legs'] };
    assert.deepEqual(game.getPlayerState('a').prompt.pool, ['alchemist', 'hare', 'legs']);
    assert.equal(game.getPlayerState('b').prompt.pool, null);
    assert.equal(game.getPlayerState('b').prompt.options, null);
});

test('Magical Athlete publishes face-down selection progress without leaking selected athlete ids', () => {
    const game = new MagicalAthleteEngine('ma-private-lineup', players(['a', 'b']), () => 0.42);
    game.start();
    let guard = 0;
    while (game.phase === 'draft' && guard++ < 500) {
        const player = game.players[game.currentTurnIndex];
        assert.equal(game.handleAction(player.id, { kind: 'chooseAthlete', athleteId: game.draftPool[0].id }).success, true);
    }
    assert.equal(game.phase, 'race_select');
    const picker = game.players[game.currentTurnIndex];
    const watcher = game.players.find(player => player.id !== picker.id);
    const first = picker.team.find(card => !picker.usedAthletes.includes(card.id));
    assert.equal(game.handleAction(picker.id, { kind: 'selectRaceAthlete', athleteId: first.id }).success, true);

    let publicEntry = game.getPublicState().raceSelectionStatus.find(entry => entry.playerId === picker.id);
    assert.deepEqual(publicEntry, { playerId: picker.id, selectedCount: 1, ready: false });
    assert.equal('athleteId' in publicEntry, false);
    assert.deepEqual(game.getPlayerState(watcher.id).myRaceSelections, []);
    const publicLock = game.getPublicState().presentation.events.find(event => event.kind === 'lineupLocked');
    const ownerLock = game.getPlayerState(picker.id).presentation.events.find(event => event.kind === 'lineupLocked');
    assert.equal(Object.hasOwn(publicLock, 'athleteId'), false);
    assert.equal(Object.hasOwn(publicLock, 'private'), false);
    assert.equal(ownerLock.private.athleteId, first.id);

    const second = picker.team.find(card => card.id !== first.id && !picker.usedAthletes.includes(card.id));
    assert.equal(game.handleAction(picker.id, { kind: 'selectRaceAthlete', athleteId: second.id }).success, true);
    publicEntry = game.getPublicState().raceSelectionStatus.find(entry => entry.playerId === picker.id);
    assert.deepEqual(publicEntry, { playerId: picker.id, selectedCount: 2, ready: true });
});

test('Magical Athlete pauses M.O.U.T.H. elimination until the affected player acknowledges it', () => {
    const game = new MagicalAthleteEngine('ma-mouth-ack', players(['a', 'b', 'c', 'd']), () => 0.42);
    draftAndSelect(game);
    const mouth = setAthlete(game, 0, 'mouth');
    const victim = setAthlete(game, 1, 'legs');
    game.racers.slice(2).forEach((racer, index) => { setAthlete(game, index + 2, 'legs'); racer.position = 12 + index; });
    mouth.position = 4; victim.position = 5;
    game.currentTurnIndex = game.players.findIndex(player => player.id === mouth.playerId);
    mouth.turnDoneThisRound = true;
    game._startPresentation(mouth.playerId, 'testMouth');
    game._moveRacer(mouth, 1);
    game.deferredAfterAcknowledgement = { racerId: mouth.id, mode: 'afterMainMove' };
    game._finishPresentation();

    assert.equal(victim.eliminated, true);
    assert.equal(game.pendingAcknowledgements.length, 1);
    assert.deepEqual(game.getPublicState().presentation.events.map(event => event.kind).slice(-2), ['abilityTriggered', 'eliminationThreatened']);
    assert.equal(game.handleAction('c', { kind: 'roll' }).success, false);

    const acknowledgement = game.pendingAcknowledgements[0];
    assert.equal(game.getPlayerState(victim.playerId).availableActions.acknowledgeElimination, true);
    assert.equal(game.handleAction(victim.playerId, { kind: 'acknowledgeElimination', acknowledgementId: acknowledgement.id }).success, true);
    assert.equal(game.pendingAcknowledgements.length, 0);
    assert.equal(game.getPublicState().presentation.events[0].kind, 'racerEliminated');
});

test('Magical Athlete publishes ordered movement and rich race settlement events', () => {
    const game = new MagicalAthleteEngine('ma-presentation', players(['a', 'b', 'c', 'd']), () => 0.42);
    draftAndSelect(game);
    const racer = setAthlete(game, 0, 'legs');
    racer.position = 3;
    game._startPresentation(racer.playerId, 'testMove');
    game._moveRacer(racer, 4);
    game._finishPresentation();
    const move = game.getPublicState().presentation.events.find(event => event.kind === 'racerMoved');
    assert.deepEqual({ from: move.from, to: move.to, movementType: move.movementType }, { from: 3, to: 7, movementType: 'main' });

    game.racers[0].finishOrder = 1; game.racers[0].position = 30;
    game.racers[1].finishOrder = 2; game.racers[1].position = 30;
    game._finishRace();
    const events = game.getPublicState().presentation.events;
    assert.deepEqual(events.map(event => event.kind), ['raceSettlement', 'nextRaceStarted']);
    assert.ok(events[0].playerResults.every(result => Number.isFinite(result.scoreBefore) && Number.isFinite(result.scoreAfter)));
});

test('Magical Athlete Dicemonger allows one reroll for the rolling racer and moves before it', () => {
    const game = new MagicalAthleteEngine('ma-dice', players(['a', 'b', 'c']), () => 0);
    draftAndSelect(game);
    const monger = setAthlete(game, 0, 'dicemonger');
    const roller = setAthlete(game, 1, 'alchemist');
    setAthlete(game, 2, 'legs');
    monger.position = 0;
    roller.position = 0;
    game.currentTurnIndex = game.players.findIndex(player => player.id === roller.playerId);
    game._runRacerTurn(roller);
    assert.equal(game.pending.kind, 'dicemongerReroll');
    assert.equal(game.handleAction(roller.playerId, { kind: 'decide', reroll: true }).success, true);
    assert.equal(roller.rerollUsedThisTurn, true);
    assert.equal(monger.position, 1);
});

test('Magical Athlete Stickler blocks every overshooting move and M.O.U.T.H. can leave no silver finisher', () => {
    const game = new MagicalAthleteEngine('ma-stickler', players(['a', 'b', 'c']), () => 0.3);
    draftAndSelect(game);
    const stickler = setAthlete(game, 0, 'stickler');
    const runner = setAthlete(game, 1, 'legs');
    stickler.position = 28;
    runner.position = 29;
    runner.roll = 6;
    game._applyMainMove(runner);
    assert.equal(runner.position, 29);

    const mouth = setAthlete(game, 0, 'mouth');
    mouth.position = 5;
    game.racers.slice(1).forEach(racer => { racer.eliminated = true; racer.finishOrder = null; });
    game.phase = 'race';
    game._checkRaceEnd();
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].ranking[0].playerId, mouth.playerId);
    assert.equal(game.history[0].ranking[1].silver, 0, '没有第二名冲线时不得伪造银牌');
    assert.equal(game.playerMap[mouth.playerId].score, MagicalAthleteEngine.GOLD_POINTS[0]);
});

test('Magical Athlete completes three independent six-player four-race tournaments', () => {
    for (let run = 0; run < 3; run += 1) {
        const game = new MagicalAthleteEngine(`ma-max-${run}`, players(['a', 'b', 'c', 'd', 'e', 'f']), () => 0.42);
        assert.equal(game.start().success, true);
        autoPlay(game);
        assert.equal(game.status, 'ended');
        assert.equal(game.history.length, 4);
        assert.ok(game.winner);
        assert.equal(game.racers.length, 6);
    }
});
