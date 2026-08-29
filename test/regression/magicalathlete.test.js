'use strict';

const {
    assert,
    test,
    fs,
    Room,
    LoveLetter,
    LoveLetterEngine,
    Coup,
    Chess,
    Xiangqi,
    Jungle,
    Gobang,
    Checkers,
    Monopoly,
    MonopolyDeal,
    MonopolyDealEngine,
    GuessNumber,
    Aeroplane,
    Junqi,
    TakeFive,
    TakeFiveEngine,
    Splendor,
    SplendorEngine,
    Hanabi,
    HanabiEngine,
    Kingdomino,
    KingdominoEngine,
    Acquire,
    AcquireEngine,
    Citadels,
    CitadelsEngine,
    Witchtown,
    WitchtownEngine,
    LasVegas,
    LasVegasEngine,
    Avalon,
    AvalonEngine,
    Scout,
    ScoutEngine,
    Decrypto,
    DecryptoEngine,
    Manila,
    ManilaEngine,
    ModernArt,
    ModernArtEngine,
    CamelUp,
    CamelUpEngine,
    MagicalAthlete,
    MagicalAthleteEngine,
    Werewolf,
    WerewolfEngine,
    registry,
    GROUP_DEFINITIONS,
    GAME_GROUPS,
    players,
    readFrontendSource,
    readWitchtownClient,
    confirmAvalonRoles,
    confirmDecryptoKeys,
    confirmWitchtownDossiers,
    passWitchtownConfessions,
    confirmedWerewolfNightAction,
    chessEngine,
    maAthlete,
    maDraft,
    maRaceSelect,
    maResolvePrompts,
    maAutoPlay
} = require("../support/regression.helper");

test('Magical Athlete uses the official 36-card snake draft and team size variants', () => {
    assert.equal(MagicalAthleteEngine.ATHLETES.length, 36);
    assert.equal(new Set(MagicalAthleteEngine.ATHLETES.map(athlete => athlete.id)).size, 36);
    const game = new MagicalAthleteEngine('magicalathlete', players(['a', 'b', 'c', 'd', 'e']), () => 0.42);
    assert.equal(game.start().success, true);
    assert.equal(game.draftPool.length, 10);
    maDraft(game);
    assert.equal(game.phase, 'race_select');
    assert.deepEqual(game.players.map(player => player.team.length), [4, 4, 4, 4, 4]);
    assert.equal(new Set(game.players.flatMap(player => player.team.map(card => card.id))).size, 20);

    const two = new MagicalAthleteEngine('magicalathlete-two', players(['a', 'b']), () => 0.42);
    two.start();
    maDraft(two);
    assert.equal(two.players[0].team.length, 8);
    assert.equal(two.players[1].team.length, 8);
    assert.equal(two.racersPerPlayer, 2);

    const three = new MagicalAthleteEngine('magicalathlete-three', players(['a', 'b', 'c']), () => 0.42);
    three.start();
    maDraft(three);
    assert.deepEqual(three.players.map(player => player.team.length), [8, 8, 8]);
    assert.equal(three.racersPerPlayer, 2);
});

test('Magical Athlete starts a race, awards official gold/silver chips, and ends at the second finisher', () => {
    const game = new MagicalAthleteEngine('magicalathlete-finish', players(['a', 'b', 'c', 'd']), () => 0.99);
    game.start();
    maDraft(game);
    maRaceSelect(game);
    assert.equal(game.phase, 'race');
    const racers = game.racers.slice();
    racers[0].position = 29;
    racers[1].position = 29;
    game.currentTurnIndex = game.players.findIndex(player => player.id === racers[0].playerId);
    game.pending = null;
    racers[0].roll = 2;
    game._applyMainMove(racers[0]);
    maResolvePrompts(game);
    const afterFirst = game.players[game.currentTurnIndex].id;
    racers[1].roll = 2;
    const playerTurn = game.players[game.currentTurnIndex];
    const pick = game.racers.find(racer => racer.playerId === playerTurn.id && racer.finishOrder == null && !racer.turnDoneThisRound);
    assert.ok(pick);
    assert.notEqual(pick.playerId, racers[0].playerId);
    pick.roll = 2;
    game._applyMainMove(pick);
    maResolvePrompts(game);
    assert.equal(game.history.length, 1);
    assert.equal(game.history[0].ranking[0].place, 1);
    assert.equal(game.history[0].ranking[1].place, 2);
    const gold = MagicalAthleteEngine.GOLD_POINTS[0];
    const silver = MagicalAthleteEngine.SILVER_POINTS[0];
    const firstPlayer = game.playerMap[game.history[0].ranking[0].playerId];
    const secondPlayer = game.playerMap[game.history[0].ranking[1].playerId];
    assert.equal(firstPlayer.score, gold);
    assert.equal(secondPlayer.score, silver);
    assert.equal(game.match, 2);
});

test('Magical Athlete official racer abilities resolve correctly', () => {
    // Banana trips a passer.
    const bananaGame = new MagicalAthleteEngine('ma-banana', players(['a', 'b', 'c']), () => 0.42);
    bananaGame.start(); maDraft(bananaGame); maRaceSelect(bananaGame); bananaGame.pending = null;
    const banana = maAthlete(bananaGame, 0, 'banana');
    const legs = maAthlete(bananaGame, 1, 'legs');
    banana.position = 3; legs.position = 0;
    legs.roll = 5;
    bananaGame._applyMainMove(legs);
    assert.equal(legs.tripped, true);

    // Inchworm: another racer's 1 is skipped and Inchworm moves 1.
    const wormGame = new MagicalAthleteEngine('ma-worm', players(['a', 'b', 'c']), () => 0.42);
    wormGame.start(); maDraft(wormGame); maRaceSelect(wormGame); wormGame.pending = null;
    const worm = maAthlete(wormGame, 0, 'inchworm');
    const legs2 = maAthlete(wormGame, 1, 'legs');
    worm.position = 0; legs2.position = 5;
    legs2.roll = 1;
    wormGame._applyMainMove(legs2);
    assert.equal(legs2.position, 5);
    assert.equal(worm.position, 1);

    // Lackey: another racer's 6 moves Lackey 2 before they move.
    const lackeyGame = new MagicalAthleteEngine('ma-lackey', players(['a', 'b', 'c']), () => 0.42);
    lackeyGame.start(); maDraft(lackeyGame); maRaceSelect(lackeyGame); lackeyGame.pending = null;
    const lackey = maAthlete(lackeyGame, 0, 'lackey');
    const legs3 = maAthlete(lackeyGame, 1, 'legs');
    lackey.position = 0; legs3.position = 5;
    legs3.roll = 6;
    lackeyGame._applyMainMove(legs3);
    assert.equal(lackey.position, 2);
    assert.equal(legs3.position, 11);

    // Sisyphus: rolling a 6 warps to the Start and loses a bronze chip.
    const sisGame = new MagicalAthleteEngine('ma-sis', players(['a', 'b']), () => 0.42);
    sisGame.start(); maDraft(sisGame); maRaceSelect(sisGame); sisGame.pending = null;
    const sis = maAthlete(sisGame, 0, 'sisyphus');
    sis.position = 8; sis.bronze = 2;
    sis.roll = 6;
    sisGame._applyMainMove(sis);
    assert.equal(sis.position, 0);
    assert.equal(sis.bronze, 1);

    // Rocket Scientist doubles and then trips.
    const rocketGame = new MagicalAthleteEngine('ma-rocket', players(['a', 'b', 'c']), () => 0.42);
    rocketGame.start(); maDraft(rocketGame); maRaceSelect(rocketGame); rocketGame.pending = null;
    const rocket = maAthlete(rocketGame, 0, 'rocketscientist');
    rocket.position = 2; rocket.roll = 6; rocket.doubled = true;
    rocketGame._applyMainMove(rocket);
    assert.equal(rocket.tripped, true);
    assert.equal(rocket.position, 8);

    // Leaptoad skips spaces occupied by other racers.
    const frogGame = new MagicalAthleteEngine('ma-frog', players(['a', 'b', 'c']), () => 0.42);
    frogGame.start(); maDraft(frogGame); maRaceSelect(frogGame); frogGame.pending = null;
    const frog = maAthlete(frogGame, 0, 'leaptoad');
    const o1 = maAthlete(frogGame, 1, 'legs');
    const o2 = maAthlete(frogGame, 2, 'legs');
    frog.position = 0; o1.position = 2; o2.position = 4;
    frog.roll = 5;
    frogGame._applyMainMove(frog);
    assert.equal(frog.position, 7);

    // Hare: +2 on the main move; skips when alone in the lead and gains a bronze chip.
    const hareGame = new MagicalAthleteEngine('ma-hare', players(['a', 'b']), () => 0.42);
    hareGame.start(); maDraft(hareGame); maRaceSelect(hareGame); hareGame.pending = null;
    const hare = maAthlete(hareGame, 0, 'hare');
    const other = maAthlete(hareGame, 1, 'legs');
    other.position = 1; hare.position = 5;
    hare.roll = 3;
    hareGame._applyMainMove(hare);
    assert.equal(hare.position, 10);
    const hare2Game = new MagicalAthleteEngine('ma-hare2', players(['a', 'b']), () => 0.42);
    hare2Game.start(); maDraft(hare2Game); maRaceSelect(hare2Game); hare2Game.pending = null;
    const hare2 = maAthlete(hare2Game, 0, 'hare');
    const other2 = maAthlete(hare2Game, 1, 'legs');
    other2.position = 1; hare2.position = 5;
    hare2Game._resolveStartOfTurn(hare2);
    assert.equal(hare2.skippedMainMove, true);
    assert.equal(hare2.bronze, 1);

    // Blimp (legacy id airship): +3 before the second corner, -1 on/after it.
    const shipGame = new MagicalAthleteEngine('ma-ship', players(['a', 'b']), () => 0.42);
    shipGame.start(); maDraft(shipGame); maRaceSelect(shipGame); shipGame.pending = null;
    const ship = maAthlete(shipGame, 0, 'airship');
    const shipOther = maAthlete(shipGame, 1, 'legs');
    shipOther.position = 3; ship.position = 3; ship._turnStartPos = 3;
    ship.roll = 3;
    shipGame._applyMainMove(ship);
    assert.equal(ship.position, 9);
    ship.position = 12; ship._turnStartPos = 12;
    ship.roll = 3;
    shipGame._applyMainMove(ship);
    assert.equal(ship.position, 18);

    // Gunk: other racers get -1 to their main move.
    const gunkGame = new MagicalAthleteEngine('ma-gunk', players(['a', 'b']), () => 0.42);
    gunkGame.start(); maDraft(gunkGame); maRaceSelect(gunkGame); gunkGame.pending = null;
    const gunk = maAthlete(gunkGame, 0, 'gunk');
    const gunkOther = maAthlete(gunkGame, 1, 'legs');
    gunkOther.position = 0;
    gunkOther.roll = 3;
    gunkGame._applyMainMove(gunkOther);
    assert.equal(gunkOther.position, 2);

    // M.O.U.T.H. eliminates the racer sharing its space.
    const mouthGame = new MagicalAthleteEngine('ma-mouth', players(['a', 'b', 'c', 'd']), () => 0.42);
    mouthGame.start(); maDraft(mouthGame); maRaceSelect(mouthGame); mouthGame.pending = null;
    const mouth = maAthlete(mouthGame, 0, 'mouth');
    const victim = maAthlete(mouthGame, 1, 'legs');
    const far1 = maAthlete(mouthGame, 2, 'legs');
    const far2 = maAthlete(mouthGame, 3, 'legs');
    mouth.position = 5; victim.position = 5; far1.position = 10; far2.position = 10;
    mouthGame._resolveStops(mouth);
    assert.equal(victim.eliminated, true);

    // Scoocher: another racer's power moves Scoocher 1.
    const scooGame = new MagicalAthleteEngine('ma-scoo', players(['a', 'b', 'c']), () => 0.42);
    scooGame.start(); maDraft(scooGame); maRaceSelect(scooGame); scooGame.pending = null;
    const scoo = maAthlete(scooGame, 0, 'scoocher');
    const scooSrc = maAthlete(scooGame, 1, 'legs');
    scoo.position = 0;
    scooGame._powerEvent(scooSrc);
    assert.equal(scoo.position, 1);

    // Duelist: a racer stopping on its space can be challenged (optional), winner moves 2.
    const duelGame = new MagicalAthleteEngine('ma-duel', players(['a', 'b', 'c', 'd']), () => 0.42);
    duelGame.start(); maDraft(duelGame); maRaceSelect(duelGame); duelGame.pending = null;
    const duelist = maAthlete(duelGame, 0, 'duelist');
    const stopper = maAthlete(duelGame, 1, 'legs');
    maAthlete(duelGame, 2, 'legs').position = 10;
    maAthlete(duelGame, 3, 'legs').position = 10;
    duelist.position = 5; stopper.position = 0;
    stopper.roll = 5;
    duelGame._applyMainMove(stopper);
    assert.equal(duelGame.pending.kind, 'duel');
    const duelistPos = duelist.position; const stopperPos = stopper.position;
    const duelResult = duelGame.handleAction(duelGame.pending.playerId, { kind: 'decide', use: true, targetRacerId: stopper.id });
    assert.equal(duelResult.success, true);
    assert.equal(duelist.position !== duelistPos || stopper.position !== stopperPos, true);

    // Suckerfish: a racer moving from its space can be followed (optional).
    const suckGame = new MagicalAthleteEngine('ma-suck', players(['a', 'b', 'c', 'd']), () => 0.42);
    suckGame.start(); maDraft(suckGame); maRaceSelect(suckGame); suckGame.pending = null;
    const sucker = maAthlete(suckGame, 0, 'suckerfish');
    const mover = maAthlete(suckGame, 1, 'legs');
    maAthlete(suckGame, 2, 'legs').position = 10;
    maAthlete(suckGame, 3, 'legs').position = 10;
    sucker.position = 3; mover.position = 3;
    mover.roll = 4;
    suckGame._applyMainMove(mover);
    assert.equal(suckGame.pending.kind, 'suckerfish');
    const followResult = suckGame.handleAction(suckGame.pending.playerId, { kind: 'decide', use: true, targetRacerId: mover.id });
    assert.equal(followResult.success, true);
    assert.equal(sucker.position, mover.position);

    // Mastermind predicting the winner finishes 2nd (and 1st too if it predicts itself).
    const mmGame = new MagicalAthleteEngine('ma-mm', players(['a', 'b']), () => 0.42);
    mmGame.start(); maDraft(mmGame); maRaceSelect(mmGame); mmGame.pending = null;
    const mm = maAthlete(mmGame, 0, 'mastermind');
    const mmOther = maAthlete(mmGame, 1, 'legs');
    mm.predictedWin = mm.id;
    mm.finishOrder = 1; mm.position = 30;
    mmOther.position = 5;
    mmGame._finishRace();
    assert.equal(mmGame.playerMap[mm.playerId].score, MagicalAthleteEngine.GOLD_POINTS[0] + MagicalAthleteEngine.SILVER_POINTS[0]);
});

test('Magical Athlete 2/3-player double-racer variant moves both racers per turn', () => {
    const game = new MagicalAthleteEngine('ma-team', players(['a', 'b']), () => 0.42);
    game.start();
    maDraft(game);
    maRaceSelect(game);
    assert.equal(game.racers.length, 4);
    const a1 = maAthlete(game, 0, 'legs');
    const a2 = maAthlete(game, 1, 'legs');
    maAthlete(game, 2, 'legs');
    maAthlete(game, 3, 'legs');
    game.currentTurnIndex = game.players.findIndex(player => player.id === 'a');
    game.pending = null;
    a1.roll = 3;
    game._runRacerTurn(a1);
    maResolvePrompts(game);
    assert.equal(game.players[game.currentTurnIndex].id, 'a');
    a2.roll = 3;
    game._runRacerTurn(a2);
    maResolvePrompts(game);
    assert.equal(game.players[game.currentTurnIndex].id, 'b');
});

test('Magical Athlete plays a full four-race tournament to a winner', () => {
    const game = new MagicalAthleteEngine('ma-full', players(['a', 'b', 'c', 'd', 'e']), () => 0.42);
    game.start();
    maAutoPlay(game);
    assert.equal(game.status, 'ended');
    assert.equal(game.history.length, 4);
    assert.ok(game.winner);
    const total = game.players.reduce((sum, player) => sum + player.score, 0);
    assert.ok(total > 0);
});

