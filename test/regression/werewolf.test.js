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
    acknowledgeWerewolfPresentation,
    advanceWerewolfNight,
    chessEngine,
    maAthlete,
    maDraft,
    maRaceSelect,
    maResolvePrompts,
    maAutoPlay
} = require("../support/regression.helper");

test('Werewolf allows one tester to switch across all nine private seats', () => {
    const game = new WerewolfEngine('werewolf-solo', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.seats.length, 9);
    assert.equal(game.getPlayerState('host').testMode, true);
    const roles = new Set();
    for (let seat = 1; seat <= 9; seat += 1) {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat }).success, true);
        const state = game.getPlayerState('host');
        assert.equal(state.activeSeat, seat);
        roles.add(state.myRole);
    }
    assert.deepEqual([...roles].sort(), ['hunter', 'seer', 'villager', 'witch', 'werewolf'].sort());
    assert.equal(game.seats.filter(seat => seat.role === 'werewolf').length, 3);
    assert.equal(game.seats.filter(seat => seat.role === 'villager').length, 3);
    assert.equal(game.seats.some(seat => seat.role === 'guard'), false);
});

test('Werewolf solo test mode can confirm all nine roles with one action', () => {
    const game = new WerewolfEngine('werewolf-confirm-all', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.getPlayerState('host').seats.every(seat => seat.role), true);
    assert.equal(game.handleAction('host', { kind: 'confirmAllRoles' }).success, true);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.deepEqual(game.getPublicState().flowRules.nightOrder, ['nightWolf', 'nightWitch', 'nightSeer']);
    assert.equal(game.getPublicState().phaseProgress.completed, 0);
    assert.equal(game.seats.every(seat => game.roleConfirmedSeats[seat.number]), true);

    const multiplayer = new WerewolfEngine('werewolf-confirm-all-restricted', players(['a', 'b']), 'a', () => 0);
    assert.equal(multiplayer.start().success, true);
    assert.equal(multiplayer.getPlayerState('a').seats.every(seat => !seat.role), true);
    assert.equal(multiplayer.handleAction('a', { kind: 'confirmAllRoles' }).success, false);
    assert.equal(multiplayer.phase, 'roleReveal');
});

test('Werewolf gives no player phase authority and assigns every seat to exactly one device', () => {
    const game = new WerewolfEngine('werewolf-no-host', players(['a', 'b']), 'a', () => 0);
    game.start();
    assert.equal(game.handleAction('b', { kind: 'nextPhase' }).success, false);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'confirmRole' }).success, true);
    assert.equal(game.handleAction('b', { kind: 'switchSeat', seat: 1 }).success, false, '不能接管其他真实玩家的座位');
    for (let seat = 3; seat <= 9; seat += 1) {
        const controllerId = game._seat(seat).controllerId;
        assert.equal(game.handleAction(controllerId, { kind: 'switchSeat', seat }).success, true);
        assert.equal(game.handleAction(controllerId, { kind: 'confirmRole' }).success, true);
    }
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.getPublicState().hostId, undefined);
    assert.equal(game.getPlayerState('a').isHost, undefined);
});

test('Werewolf keeps seat-switch acknowledgements private during the night', () => {
    const game = new WerewolfEngine('werewolf-switch-privacy', players(['a', 'b']), 'a', () => 0);
    assert.equal(game.start().success, true);
    game.phase = 'nightWolf';

    const result = game.handleAction('a', { kind: 'switchSeat', seat: 3 });
    assert.equal(result.success, true);
    assert.match(game.getPlayerAction(result, 'a').message, /3 号测试席位/);
    assert.equal(game.getPlayerState('a').activeSeat, 3);
    assert.equal(game.getPlayerState('b').activeSeat, 2);
    const observerAction = game.getPlayerAction(result, 'b');
    assert.equal(observerAction.message, '');
    assert.equal(observerAction.privateFor, undefined);
});

test('Werewolf rooms stay private until the host locks a 9 or 12 player board and require every seat filled', () => {
    for (const targetPlayers of [9, 12]) {
        const room = new Room(`werewolf-room-${targetPlayers}`, 'host', '房主', 'werewolf', { sheriffEnabled: true });
        assert.equal(room.addPlayer({ id: 'host', name: '房主' }).success, true);
        assert.equal(room.getInfo().configurationConfirmed, false);
        assert.equal(room.isListed(), false);
        assert.equal(room.addPlayer({ id: 'early', name: '提前加入' }).success, false);
        assert.match(room.startGame().message, /确认房间人数/);
        assert.equal(room.configure('guest', { playerCount: targetPlayers }).success, false);
        assert.equal(room.configure('host', { playerCount: 10 }).success, false);
        assert.equal(room.configure('host', { playerCount: targetPlayers }).success, true);

        const info = room.getInfo();
        assert.equal(info.configurationConfirmed, true);
        assert.equal(info.targetPlayers, targetPlayers);
        assert.equal(info.minPlayers, targetPlayers);
        assert.equal(info.maxPlayers, targetPlayers);
        assert.equal(room.isListed(), true);
        for (let index = 2; index < targetPlayers; index += 1) {
            assert.equal(room.addPlayer({ id: `p${index}`, name: `玩家${index}` }).success, true);
        }
        assert.match(room.startGame().message, new RegExp(`当前 ${targetPlayers - 1}/${targetPlayers}`));
        assert.equal(room.addPlayer({ id: `p${targetPlayers}`, name: `玩家${targetPlayers}` }).success, true);
        assert.equal(room.startGame().success, true);
        assert.equal(room.game.engine.seats.length, targetPlayers);
        assert.equal(room.game.engine.seats.filter(seat => seat.role === 'werewolf').length, targetPlayers === 12 ? 4 : 3);
        assert.equal(room.game.engine.seats.filter(seat => seat.role === 'villager').length, targetPlayers === 12 ? 4 : 3);
        assert.equal(new Set(room.game.engine.seats.map(seat => seat.controllerId)).size, targetPlayers);
    }
});

test('Werewolf keeps irreversible night-skill confirmation while wolf ballots remain directly mutable', () => {
    const game = new WerewolfEngine('werewolf-night-confirmations', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    assert.equal(game.start().success, true);
    assert.equal(game.handleAction('host', { kind: 'confirmAllRoles' }).success, true);
    acknowledgeWerewolfPresentation(game);
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const guardSeat = seatFor('guard');
    const seerSeat = seatFor('seer');
    const witchSeat = seatFor('witch');
    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);

    game.handleAction('host', { kind: 'switchSeat', seat: guardSeat });
    assert.equal(game.handleAction('host', { kind: 'nightAction', targetSeat: seerSeat }).success, false, '旧的单步动作不能绕过确认轮次');
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: seerSeat }).success, true);
    assert.equal(game.night.guard, undefined, '暂存选择时不能提前写入守护结果');
    assert.deepEqual(game.getPlayerState('host').nightConfirmation, { stage: 'confirm', role: 'guard', targetSeat: seerSeat, choice: null, canConfirm: true, canCancel: true });
    assert.equal(game.handleAction('host', { kind: 'cancelNightAction' }).success, true);
    assert.equal(game.getPlayerState('host').nightConfirmation, null);
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: seerSeat }).success, true);
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.night.guard, seerSeat);
    assert.equal(game.phase, 'nightGuard', '守卫确认后仍需等待完整 20 秒');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWolf');

    for (const wolfSeat of wolfSeats) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: guardSeat }).success, true);
        assert.equal(game.night.wolfVotes?.[wolfSeat], guardSeat, '狼人提交后应立即计入可修改的临时票');
        assert.equal(game.getPlayerState('host').nightConfirmation, null, '狼人不应进入二次确认环节');
    }
    assert.equal(game.phase, 'nightWolf', '狼队投票确认后仍需等待完整 20 秒');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.night.wolf, guardSeat);
    assert.equal(game.phase, 'nightWitch');

    game.handleAction('host', { kind: 'switchSeat', seat: witchSeat });
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', choice: 'pass' }).success, true);
    assert.equal(game.night.witchActed, undefined, '女巫确认前不能提前结算');
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.night.witchActed, true);
    assert.equal(game.phase, 'nightWitch', '女巫确认后仍需等待完整 20 秒');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightSeer');

    game.handleAction('host', { kind: 'switchSeat', seat: seerSeat });
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: wolfSeats[0] }).success, true);
    assert.equal(game.night.seer, undefined);
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.phase, 'nightSeer', '显示查验身份时必须停留在预言家阶段');
    assert.equal(game.getPlayerState('host').nightConfirmation.stage, 'result');
    assert.equal(game.getPlayerState('host').seerResult.faction, 'wolf');
    assert.equal(game.handleAction('host', { kind: 'confirmSeerResult' }).success, true);
    assert.equal(game.phase, 'nightSeer', '预言家确认结果后仍需等待完整 20 秒');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.notEqual(game.phase, 'nightSeer');
});

test('Werewolf follows the standard night order and supports an empty guard', () => {
    const game = new WerewolfEngine('werewolf-standard-night-order', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    assert.equal(game.start().success, true);
    assert.equal(game.handleAction('host', { kind: 'confirmAllRoles' }).success, true);
    acknowledgeWerewolfPresentation(game);
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const guardSeat = seatFor('guard');
    const witchSeat = seatFor('witch');
    const seerSeat = seatFor('seer');
    const target = game.seats.find(seat => seat.role === 'villager').number;

    game.handleAction('host', { kind: 'switchSeat', seat: guardSeat });
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', choice: 'pass' }).success, true);
    assert.equal(game.night.guard, undefined, '空守在确认前不能提前生效');
    assert.equal(game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWolf');

    for (const wolf of game.seats.filter(seat => seat.role === 'werewolf')) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
        assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: target }).success, true);
    }
    assert.equal(game.phase, 'nightWolf');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWitch');
    game.handleAction('host', { kind: 'switchSeat', seat: witchSeat });
    assert.equal(game.getPlayerState('host').wolfSeat, target);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);
    assert.equal(game.phase, 'nightWitch');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightSeer');
    game.handleAction('host', { kind: 'switchSeat', seat: seerSeat });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: target }).success, true);
    assert.equal(game.phase, 'nightSeer');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.notEqual(game.phase, 'nightSeer');
    assert.deepEqual(game.getPublicState().flowRules.nightOrder, ['nightGuard', 'nightWolf', 'nightWitch', 'nightSeer']);
});

test('Werewolf resolves the guard and witch hidden protection conflicts', () => {
    const makeNight = ({ guard, saved = false, poison = null }) => {
        const game = new WerewolfEngine(`werewolf-protection-${guard}-${saved}-${poison}`, players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
        assert.equal(game.start().success, true);
        const wolfTarget = game.seats.find(seat => seat.role === 'villager').number;
        const otherTarget = game.seats.find(seat => seat.number !== wolfTarget && seat.alive).number;
        const guardTarget = guard === 'target' ? wolfTarget : guard === 'other' ? otherTarget : guard;
        const poisonTarget = poison === 'other' ? otherTarget : poison === 'guard' ? guardTarget : poison;
        game.day = 2;
        game.phase = 'nightSeer';
        game.night = { wolf: wolfTarget, guard: guardTarget || null, saved, poison: poisonTarget || null };
        game._resolveNight();
        return { game, wolfTarget, guardTarget, poisonTarget };
    };

    const blocked = makeNight({ guard: 'target' });
    assert.equal(blocked.game.seats.find(seat => seat.number === blocked.wolfTarget).alive, true, '单独守护应挡住狼刀');
    assert.equal(blocked.game.night.guardSaveConflict, false);

    const saved = makeNight({ guard: null, saved: true });
    assert.equal(saved.game.seats.find(seat => seat.number === saved.wolfTarget).alive, true, '单独解药应救回狼刀目标');
    assert.equal(saved.game.night.guardSaveConflict, false);

    const pierced = makeNight({ guard: 'target', saved: true });
    assert.equal(pierced.game.seats.find(seat => seat.number === pierced.wolfTarget).alive, false, '同守同救应奶穿，目标仍然出局');
    assert.equal(pierced.game.night.guardSaveConflict, true);
    assert.deepEqual(pierced.game.getPublicState().announcement.deaths, [pierced.wolfTarget]);

    const poisoned = makeNight({ guard: 'target', poison: 'other' });
    assert.equal(poisoned.game.seats.find(seat => seat.number === poisoned.wolfTarget).alive, true, '守卫仍只挡狼刀');
    assert.equal(poisoned.game.seats.find(seat => seat.number === poisoned.poisonTarget).alive, false, '守卫不能挡女巫毒药');

    const guardedPoisoned = makeNight({ guard: 'other', poison: 'guard' });
    assert.equal(guardedPoisoned.game.night.guardSaveConflict, false, '守卫守毒药目标不属于同守同救');
    assert.equal(guardedPoisoned.game.seats.find(seat => seat.number === guardedPoisoned.guardTarget).alive, false, '守卫不能挡住落在守护目标身上的毒药');
    assert.equal(guardedPoisoned.game.seats.find(seat => seat.number === guardedPoisoned.wolfTarget).alive, false, '未被守护的狼刀目标仍按狼刀结算');
});

test('Werewolf makes witch self-save a visible, validated board setting', () => {
    const makeWitchNight = (witchSelfSave, day) => {
        const game = new WerewolfEngine(`werewolf-self-save-${witchSelfSave}-${day}`, players(['host']), 'host', () => 0, Date.now, { witchSelfSave });
        assert.equal(game.start().success, true);
        const witch = game.seats.find(seat => seat.role === 'witch');
        game.day = day;
        game.phase = 'nightWitch';
        game.night = { wolf: witch.number };
        game.handleAction('host', { kind: 'switchSeat', seat: witch.number });
        return { game, witch };
    };

    const firstNight = makeWitchNight('firstNight', 1);
    assert.equal(firstNight.game.getPublicState().flowRules.witchSelfSave, 'firstNight');
    assert.equal(firstNight.game.getPlayerState('host').witchCanSaveSelf, true);
    assert.equal(firstNight.game.handleAction('host', { kind: 'stageNightAction', choice: 'save' }).success, true);
    assert.equal(firstNight.game.handleAction('host', { kind: 'confirmNightAction' }).success, true);
    assert.equal(firstNight.game.witchItems.antidote, false);

    const laterFirstNightBoard = makeWitchNight('firstNight', 2);
    assert.equal(laterFirstNightBoard.game.getPlayerState('host').witchCanSaveSelf, false);
    const laterResult = laterFirstNightBoard.game.handleAction('host', { kind: 'stageNightAction', choice: 'save' });
    assert.equal(laterResult.success, false);
    assert.match(laterResult.message, /首夜自救/);

    const never = makeWitchNight('never', 1);
    assert.equal(never.game.getPlayerState('host').witchCanSaveSelf, false);
    assert.equal(never.game.handleAction('host', { kind: 'stageNightAction', choice: 'save' }).success, false);

    const always = makeWitchNight('always', 2);
    assert.equal(always.game.getPlayerState('host').witchCanSaveSelf, true);
    assert.equal(always.game.handleAction('host', { kind: 'stageNightAction', choice: 'save' }).success, true);
});

test('Werewolf confirms every seat and automatically runs the first full day-night cycle', () => {
    const game = new WerewolfEngine('werewolf-night', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    game.start();
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);
    const goodTarget = game.seats.find(seat => seat.role === 'villager').number;
    const dissentTarget = seatFor('seer');

    assert.equal(game.handleAction('host', { kind: 'nextPhase' }).success, false);
    for (let seat = 1; seat <= 12; seat += 1) {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat }).success, true);
        assert.equal(game.getPlayerState('host').canConfirmRole, true);
        assert.equal(game.handleAction('host', { kind: 'confirmRole' }).success, true);
        if (seat === 1) {
            assert.equal(game.handleAction('host', { kind: 'confirmRole' }).success, false);
            assert.equal(game.getPublicState().phaseProgress.completed, 1);
        }
        if (seat < 12) assert.equal(game.phase, 'roleReveal');
    }
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.day, 1);
    assert.equal(game.getPublicState().nextPhaseName, '狼人请睁眼');
    assert.deepEqual(game.getPublicState().phaseProgress, { completed: 0, total: 1, label: '夜幕之中' });
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('guard') });
    assert.equal(game.getPlayerState('host').skillState.available, true);
    assert.equal(game.getPlayerState('host').legalTargetSeats.length, 12);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: seatFor('seer') }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.getPublicState().phaseInstruction, '狼人请睁眼，本阶段固定 20 秒；可更新临时票，到点结算，平票则无人遇袭。');
    assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: goodTarget }).success, false);
    for (const [index, wolfSeat] of wolfSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        if (index === 0) {
            assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: wolfSeats[1] }).success, true, '狼队可以自刀或刀狼队友');
            assert.equal(game.getPlayerState('host').nightConfirmation, null);
        }
        const voteTarget = index === wolfSeats.length - 1 ? dissentTarget : goodTarget;
        const vote = confirmedWerewolfNightAction(game, 'host', { targetSeat: voteTarget });
        assert.equal(vote.success, true);
        assert.equal(game.getPlayerState('host').wolfVote.myTarget, voteTarget);
        if (index === 0) {
            assert.equal(game.handleAction('host', { kind: 'stageNightAction', targetSeat: dissentTarget }).success, true, '倒计时结束前允许修改狼队临时票');
            assert.equal(game.night.wolfVotes[wolfSeat], dissentTarget);
            assert.equal(game.getPlayerState('host').nightConfirmation, null);
            assert.equal(game.handleAction('host', { kind: 'nightAction', targetSeat: goodTarget }).success, true, '可再次覆盖临时票');
        }
        if (index < wolfSeats.length - 1) {
            assert.equal(game.night.wolfResolved, undefined);
            assert.equal(game.phase, 'nightWolf');
        }
    }
    assert.equal(game.phase, 'nightWolf');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.night.wolfResolved, true);
    assert.equal(game.night.wolf, goodTarget);
    assert.equal(game.phase, 'nightWitch');
    for (const wolfSeat of wolfSeats) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat });
        assert.equal(game.night.wolf, goodTarget);
        assert.equal(game.getPlayerState('host').wolfVote, null, '狼队临时票仅在狼人行动阶段公开');
    }
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('witch') });
    assert.equal(game.getPlayerState('host').wolfSeat, goodTarget);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'save', targetSeat: goodTarget }).success, true);
    assert.equal(game.phase, 'nightWitch');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightSeer');
    game.handleAction('host', { kind: 'switchSeat', seat: seatFor('seer') });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: seatFor('werewolf') }).success, true);
    assert.equal(game.phase, 'nightSeer');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'day');
    assert.equal(game.seats.find(seat => seat.number === goodTarget).alive, true);

    const aliveSeats = game.seats.filter(seat => seat.alive).map(seat => seat.number);
    for (const [index, seat] of aliveSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        assert.equal(game.handleAction('host', { kind: 'confirmDay' }).success, true);
        if (index < aliveSeats.length - 1) assert.equal(game.phase, 'day');
    }
    assert.equal(game.phase, 'vote');
    assert.equal(game.handleAction('host', { kind: 'resolveVote' }).success, false);
    for (const [index, seat] of aliveSeats.entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: goodTarget }).success, true);
        if (index < aliveSeats.length - 1) assert.equal(game.phase, 'vote');
    }
    assert.equal(game.seats.find(seat => seat.number === goodTarget).alive, false);
    assert.equal(game.phase, 'deathResolution');
    assert.equal(game.getPublicState().phaseName, '离场时刻');
    game.handleAction('host', { kind: 'switchSeat', seat: goodTarget });
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPlayerState('host').canStartLastWords, true);
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.day, 2);
});

test('Werewolf retries a tied wolf attack once, then treats a second tie as no kill', () => {
    const game = new WerewolfEngine('werewolf-wolf-tie', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    game.start();
    for (let seat = 1; seat <= 12; seat += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        game.handleAction('host', { kind: 'confirmRole' });
    }
    acknowledgeWerewolfPresentation(game);
    const guardSeat = game.seats.find(seat => seat.role === 'guard').number;
    game.handleAction('host', { kind: 'switchSeat', seat: guardSeat });
    confirmedWerewolfNightAction(game, 'host', { targetSeat: guardSeat });
    assert.equal(game.phase, 'nightGuard');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWolf');

    const wolfSeats = game.seats.filter(seat => seat.role === 'werewolf').map(seat => seat.number);
    const goodTargets = game.seats.filter(seat => seat.role !== 'werewolf').slice(0, wolfSeats.length).map(seat => seat.number);
    const castTiedRound = () => wolfSeats.map((wolfSeat, index) => {
        assert.equal(game.handleAction('host', { kind: 'switchSeat', seat: wolfSeat }).success, true);
        return confirmedWerewolfNightAction(game, 'host', { targetSeat: goodTargets[index] });
    });

    assert.equal(castTiedRound().every(result => result.success), true);
    assert.equal(game.night.wolfVoteRound || 1, 1);
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.night.wolfVoteRound, 2);
    assert.deepEqual(game.night.wolfVotes, {});
    assert.deepEqual(game.night.wolfTieTargets.sort((left, right) => left - right), goodTargets.slice().sort((left, right) => left - right));
    assert.equal(game.night.wolfResolved, undefined);

    assert.equal(castTiedRound().every(result => result.success), true);
    assert.equal(game.night.wolfResolved, undefined);
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.night.wolfVoteRound, 2);
    assert.equal(game.night.wolfResolved, true);
    assert.equal(game.night.wolf, null);
    assert.equal(game.night.wolf, null);
    assert.equal(game.night.wolfResolved, true);
    assert.equal(game.phase, 'nightWitch');
});

test('Werewolf orders simultaneous night deaths by seat number', () => {
    const game = new WerewolfEngine('werewolf-night-order', players(['host']), 'host', () => 0, () => 99);
    game.start();
    const ordinary = game.seats.filter(seat => seat.role !== 'hunter').map(seat => seat.number).sort((a, b) => a - b);
    const low = ordinary[0];
    const high = ordinary.at(-1);
    game.day = 1;
    game.night = { wolf: high, saved: false, guard: null, poison: low };
    game._resolveNight();
    assert.deepEqual(game.announcement.deaths, [low, high]);
    assert.equal(game.announcement.text, `天亮，${low}、${high} 号倒牌`);
});

test('Werewolf labels ordinary first-night words separately from daytime words', () => {
    const game = new WerewolfEngine('werewolf-first-night-word-label', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: false });
    assert.equal(game.start().success, true);
    const victim = game.seats.find(seat => seat.role === 'villager');
    game.day = 1;
    game.phase = 'nightSeer';
    game.night = { wolf: victim.number, guard: null, saved: false, poison: null };
    game._resolveNight();
    game.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPublicState().lastWordsFlow.currentKind, 'firstNight');
    game.handleAction('host', { kind: 'startLastWords' });
    assert.equal(game.publicEvents.at(-1).title, '首夜遗言');
});

test('Werewolf publishes the complete night death chain before an edge-condition win', () => {
    const game = new WerewolfEngine('werewolf-night-edge-finale', players(['host']), 'host', () => 0, () => 1234, { winCondition: 'edge', sheriffEnabled: false });
    game.start();
    const villagers = game.seats.filter(seat => seat.role === 'villager').map(seat => seat.number);
    assert.equal(villagers.length, 3);
    const nightVictims = villagers.slice(0, 2);
    game._seat(villagers[2]).alive = false;
    game.day = 2;
    game.phase = 'nightSeer';
    game.night = { wolf: nightVictims[0], guard: null, saved: false, poison: nightVictims[1] };

    game._resolveNight();

    assert.equal(game.status, 'playing', '终局夜死仍需先完成离场确认');
    assert.equal(game.phase, 'deathResolution');
    for (const number of nightVictims) {
        game.handleAction('host', { kind: 'switchSeat', seat: number });
        assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    }
    assert.equal(game.status, 'ended');
    assert.equal(game.phase, 'ended');
    assert.deepEqual(game.announcement.deaths, nightVictims.slice().sort((left, right) => left - right));
    assert.deepEqual(game.publicEvents.map(event => event.kind), ['nightDeaths', 'elimination', 'elimination', 'identityReveal']);
    assert.deepEqual(game.publicEvents.slice(1, 3).map(event => event.eliminatedSeats), nightVictims.map(seat => [seat]));
    assert.equal(game.winner.reason, 'allVillagersEliminated');
    assert.equal(game.winner.trigger, 'nightDeaths');
    assert.deepEqual(game.winner.eliminatedSeats, nightVictims.slice().sort((left, right) => left - right));
});

test('Werewolf hides wolf-vote messages and state from non-wolves and dead wolves', () => {
    const game = new WerewolfEngine('werewolf-wolf-privacy', players(['wolf-user', 'good-user']), 'wolf-user', () => 0);
    game.start();
    const wolfSeat = game.seats.find(seat => seat.role === 'werewolf');
    const goodSeat = game.seats.find(seat => seat.role !== 'werewolf' && seat.controllerId !== wolfSeat.controllerId);
    const wolfUser = wolfSeat.controllerId;
    const goodUser = goodSeat.controllerId;
    game.activeSeat[wolfUser] = wolfSeat.number;
    game.activeSeat[goodUser] = goodSeat.number;
    game.phase = 'nightWolf';
    const action = confirmedWerewolfNightAction(game, wolfUser, { targetSeat: goodSeat.number });
    assert.equal(action.success, true);
    assert.match(game.getPlayerAction(action, wolfUser).message, /临时袭击票已更新/);
    assert.equal(game.getPlayerAction(action, goodUser).message, '');
    assert.equal(game.getPlayerState(goodUser).wolfVote, null);
    assert.deepEqual(game.getPlayerState(goodUser).phaseProgress, { completed: 0, total: 1, label: '夜幕之中' });
    assert.equal(game.getPlayerState(wolfUser).phaseProgress.total, 3);
    wolfSeat.alive = false;
    assert.equal(game.getPlayerState(wolfUser).wolfVote, null);
});

test('Werewolf keeps the fixed night order when a hidden role is dead', () => {
    const game = new WerewolfEngine('werewolf-dead-night-role', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    game.start();
    const guard = game.seats.find(seat => seat.role === 'guard');
    const seer = game.seats.find(seat => seat.role === 'seer');
    guard.alive = false;
    seer.alive = false;
    for (let seat = 1; seat <= 12; seat += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat });
        game.handleAction('host', { kind: 'confirmRole' });
    }
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(game.getPublicState().nextPhaseName, '狼人请睁眼');
    game.handleAction('host', { kind: 'switchSeat', seat: guard.number });
    assert.equal(game.getPlayerState('host').canConfirmDeadRole, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeadRole' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWolf');
    const wolves = game.seats.filter(seat => seat.alive && seat.role === 'werewolf');
    const target = game.seats.find(seat => seat.alive && seat.role !== 'werewolf').number;
    for (const wolf of wolves) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
        confirmedWerewolfNightAction(game, 'host', { targetSeat: target });
    }
    assert.equal(game.phase, 'nightWolf');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightWitch');
    const witch = game.seats.find(item => item.role === 'witch');
    game.handleAction('host', { kind: 'switchSeat', seat: witch.number });
    assert.equal(game.getPlayerState('host').skillState.available, true);
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);
    assert.equal(game.phase, 'nightWitch');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.equal(game.phase, 'nightSeer');
    game.handleAction('host', { kind: 'switchSeat', seat: seer.number });
    assert.equal(game.getPlayerState('host').canConfirmDeadRole, true);
    assert.equal(game.handleAction('host', { kind: 'confirmDeadRole' }).success, true);
    assert.equal(game.phase, 'nightSeer');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    assert.notEqual(game.phase, 'nightSeer');
});

test('Werewolf uses the same private death resolution for ordinary, hunter, and poisoned-hunter deaths', () => {
    const ordinary = new WerewolfEngine('werewolf-ordinary-death', players(['host']), 'host', () => 0);
    ordinary.start();
    const villager = ordinary.seats.find(seat => seat.role === 'villager');
    ordinary.phase = 'vote';
    ordinary.day = 1;
    let ordinaryVote;
    for (const seat of ordinary.seats) {
        ordinary.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        ordinaryVote = ordinary.handleAction('host', { kind: 'vote', targetSeat: villager.number });
        assert.equal(ordinaryVote.success, true);
    }
    const ordinaryPublic = ordinary.getPublicState();
    assert.equal(ordinary.phase, 'deathResolution');
    assert.equal(ordinaryPublic.phaseName, '离场时刻');
    assert.equal(ordinaryPublic.pendingHunter, undefined);
    assert.doesNotMatch(JSON.stringify(ordinaryPublic), /猎人/);
    assert.doesNotMatch(ordinaryVote.message, /猎人|技能/);
    ordinary.handleAction('host', { kind: 'switchSeat', seat: villager.number });
    const ordinaryPrivate = ordinary.getPlayerState('host');
    assert.equal(ordinaryPrivate.canConfirmDeathResolution, true);
    assert.equal(ordinaryPrivate.hunterAction, null);
    assert.deepEqual(ordinaryPrivate.eliminationNotice, { day: 1, seat: villager.number, source: 'day' });
    assert.equal(ordinaryPublic.eliminationNotice, undefined, '个人出局提示不能进入公开状态');
    assert.equal(ordinary.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(ordinary.phase, 'lastWords', '出局私密结算后自动进入遗言');
    assert.equal(ordinary.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(ordinary.handleAction('host', { kind: 'finishLastWords' }).success, true);
    acknowledgeWerewolfPresentation(ordinary);
    assert.equal(ordinary.phase, 'nightWolf', '普通玩家完成遗言后不会卡住');

    const game = new WerewolfEngine('werewolf-hunter', players(['host']), 'host', () => 0);
    game.start();
    const hunter = game.seats.find(seat => seat.role === 'hunter');
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    game.phase = 'vote';
    game.day = 1;
    let hunterVote;
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        hunterVote = game.handleAction('host', { kind: 'vote', targetSeat: hunter.number });
        assert.equal(hunterVote.success, true);
    }
    assert.equal(game.phase, 'deathResolution');
    assert.equal(hunter.alive, false);
    const hunterPublic = game.getPublicState();
    assert.deepEqual(
        { phase: hunterPublic.phase, phaseName: hunterPublic.phaseName, nextPhaseName: hunterPublic.nextPhaseName, phaseProgress: hunterPublic.phaseProgress, phaseInstruction: hunterPublic.phaseInstruction },
        { phase: ordinaryPublic.phase, phaseName: ordinaryPublic.phaseName, nextPhaseName: ordinaryPublic.nextPhaseName, phaseProgress: ordinaryPublic.phaseProgress, phaseInstruction: ordinaryPublic.phaseInstruction },
        '猎人与普通玩家出局的公开阶段信息必须一致',
    );
    assert.deepEqual(hunterPublic.publicEvents.slice(-2).map(event => ({ kind: event.kind, text: event.text })), [
        { kind: 'elimination', text: `${hunter.number} 号已出局` },
        { kind: 'hunterReveal', text: `${hunter.number} 号的身份是猎人` },
    ]);
    assert.doesNotMatch(hunterVote.message, /猎人|技能/);
    const bystander = game.seats.find(seat => seat.number !== hunter.number);
    game.handleAction('host', { kind: 'switchSeat', seat: bystander.number });
    assert.equal(game.getPlayerState('host').hunterAction, null);
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, false);
    assert.equal(game.getPlayerState('host').eliminationNotice, null);
    game.handleAction('host', { kind: 'switchSeat', seat: hunter.number });
    assert.equal(game.getPlayerState('host').hunterAction.available, true);
    assert.equal(game.getPlayerState('host').canConfirmDeathResolution, false);
    assert.equal(game.handleAction('host', { kind: 'hunterAction', choice: 'shoot', targetSeat: wolf.number }).success, true);
    assert.equal(wolf.alive, false);
    assert.deepEqual(game.getPublicState().publicEvents.slice(-2).map(event => ({ kind: event.kind, text: event.text })), [
        { kind: 'hunterShot', text: `猎人开枪带走了 ${wolf.number} 号` },
        { kind: 'elimination', text: `${wolf.number} 号已出局` },
    ]);
    assert.equal(game.phase, 'deathResolution');
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    for (const seatNumber of [hunter.number, wolf.number]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
        assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    }
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.day, 2);

    const poisoned = new WerewolfEngine('werewolf-poisoned-hunter', players(['host']), 'host', () => 0);
    poisoned.start();
    const poisonedHunter = poisoned.seats.find(seat => seat.role === 'hunter');
    const witch = poisoned.seats.find(seat => seat.role === 'witch');
    poisoned.phase = 'nightWitch';
    poisoned.day = 1;
    poisoned.night = {};
    const poisonedClock = Number(poisoned.now());
    poisoned.nightFlow = { phase: 'nightWitch', startedAt: poisonedClock, deadlineAt: poisonedClock + 20_000, durationSeconds: 20 };
    poisoned.handleAction('host', { kind: 'switchSeat', seat: witch.number });
    assert.equal(confirmedWerewolfNightAction(poisoned, 'host', { choice: 'poison', targetSeat: poisonedHunter.number }).success, true);
    assert.equal(poisoned.phase, 'nightWitch');
    assert.equal(advanceWerewolfNight(poisoned)?.success, true);
    poisoned.handleAction('host', { kind: 'switchSeat', seat: poisoned.seats.find(seat => seat.role === 'seer').number });
    assert.equal(confirmedWerewolfNightAction(poisoned, 'host', { targetSeat: poisoned.seats.find(seat => seat.number !== poisonedHunter.number).number }).success, true);
    assert.equal(poisoned.phase, 'nightSeer');
    assert.equal(advanceWerewolfNight(poisoned)?.success, true);
    assert.equal(poisonedHunter.alive, false);
    assert.equal(poisoned.pendingHunter, null);
    assert.equal(poisoned.phase, 'deathResolution');
    poisoned.handleAction('host', { kind: 'switchSeat', seat: poisonedHunter.number });
    assert.equal(poisoned.getPlayerState('host').hunterAction, null);
    assert.equal(poisoned.getPlayerState('host').canConfirmDeathResolution, true);
    assert.deepEqual(poisoned.getPlayerState('host').eliminationNotice, { day: 1, seat: poisonedHunter.number, source: 'night' });
    assert.equal(poisoned.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(poisoned.phase, 'lastWords');
    assert.equal(poisoned.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(poisoned.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(poisoned.phase, 'day');

    const laterPoison = new WerewolfEngine('werewolf-later-poison-no-words', players(['host']), 'host', () => 0, Date.now);
    laterPoison.start();
    const laterPoisonVictim = laterPoison.seats.find(seat => seat.role === 'villager');
    laterPoison.day = 2;
    laterPoison._beginDeathResolution([laterPoisonVictim.number], 'day', [laterPoisonVictim.number], false);
    laterPoison.handleAction('host', { kind: 'switchSeat', seat: laterPoisonVictim.number });
    assert.equal(laterPoison.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(laterPoison.phase, 'day');
    assert.equal(laterPoison.lastWordsFlow, null, '第二夜女巫毒杀也没有遗言');
});

test('Werewolf gives a later-night hunter shot the same no-last-words window as its night death', () => {
    const game = new WerewolfEngine('werewolf-later-night-hunter', players(['host']), 'host', () => 0);
    assert.equal(game.start().success, true);
    game.day = 2;
    const hunter = game.seats.find(seat => seat.role === 'hunter');
    const target = game.seats.find(seat => seat.alive && seat.number !== hunter.number);
    hunter.alive = false;
    game._beginDeathResolution([hunter.number], 'day', [], false);
    game.handleAction('host', { kind: 'switchSeat', seat: hunter.number });
    assert.equal(game.handleAction('host', { kind: 'hunterAction', choice: 'shoot', targetSeat: target.number }).success, true);
    game.handleAction('host', { kind: 'switchSeat', seat: target.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'day');
    assert.equal(game.lastWordsFlow, null);
    assert.equal(game.lastWordsHistory.length, 0);
});

test('Werewolf announces night deaths, times ordered speeches, and retains complete public vote history', () => {
    let now = 1_700_000_000_000;
    const game = new WerewolfEngine('werewolf-day-flow', players(['host']), 'host', () => 0, () => now);
    game.start();
    const firstVictim = game.seats.find(seat => seat.role === 'villager');
    const secondVictim = game.seats.find(seat => seat.role === 'villager' && seat.number !== firstVictim.number);
    const witch = game.seats.find(seat => seat.role === 'witch');
    game.day = 1;
    game.phase = 'nightWitch';
    game.night = { wolf: firstVictim.number };
    game.nightFlow = { phase: 'nightWitch', startedAt: now, deadlineAt: now + 20_000, durationSeconds: 20 };
    game.handleAction('host', { kind: 'switchSeat', seat: witch.number });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);
    assert.equal(game.phase, 'nightWitch');
    now += 20_000;
    assert.equal(game.handleSystemTick().success, true);
    assert.equal(game.phase, 'nightSeer');
    const seer = game.seats.find(seat => seat.role === 'seer');
    game.handleAction('host', { kind: 'switchSeat', seat: seer.number });
    const seerTarget = game.seats.find(seat => seat.alive && seat.number !== seer.number).number;
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: seerTarget }).success, true);
    assert.equal(game.phase, 'nightSeer');
    now += 20_000;
    assert.equal(game.handleSystemTick().success, true);

    let publicState = game.getPublicState();
    assert.equal(game.phase, 'deathResolution');
    assert.deepEqual(publicState.announcement.deaths, [firstVictim.number]);
    assert.equal(publicState.announcement.peaceful, false);
    assert.match(publicState.announcement.text, new RegExp(`${firstVictim.number} 号倒牌`));
    assert.deepEqual(publicState.announcementHistory.map(item => item.day), [1]);

    game.handleAction('host', { kind: 'switchSeat', seat: firstVictim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    publicState = game.getPublicState();
    assert.deepEqual(publicState.lastWordsFlow.order, [firstVictim.number]);
    assert.equal(publicState.lastWordsFlow.currentSeat, firstVictim.number);
    assert.equal(publicState.lastWordsFlow.status, 'waiting');
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    publicState = game.getPublicState();
    assert.equal(publicState.lastWordsFlow.deadlineAt, now + 60_000);
    assert.equal(publicState.lastWordsFlow.remainingSeconds, 60);
    now += 59_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPublicState().lastWordsFlow.remainingSeconds, 1);
    now += 1_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.phase, 'day');

    publicState = game.getPublicState();
    const aliveSeats = game.seats.filter(seat => seat.alive).map(seat => seat.number).sort((left, right) => left - right);
    assert.equal(publicState.speechFlow.startSeat, aliveSeats[0]);
    assert.equal(publicState.speechFlow.direction, 'clockwise');
    assert.deepEqual(publicState.speechFlow.order, aliveSeats);
    assert.equal(new Set(publicState.speechFlow.order).size, aliveSeats.length);
    game.handleAction('host', { kind: 'switchSeat', seat: aliveSeats[1] });
    assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, false, '不能跳过系统指定的当前发言者');
    game.handleAction('host', { kind: 'switchSeat', seat: aliveSeats[0] });
    assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, true);
    const firstSpeechDeadline = now + 90_000;
    assert.equal(game.getPublicState().speechFlow.deadlineAt, firstSpeechDeadline);
    now += 10_000;
    assert.equal(game.handlePlayerDisconnect('host').success, true);
    assert.equal(game.getPublicState().speechFlow.remainingSeconds, 80);
    now += 300_000;
    assert.equal(game.getPublicState().speechFlow.remainingSeconds, 80, '断线暂停期间倒计时应冻结');
    assert.equal(game.handlePlayerReconnect('host').success, true);
    assert.equal(game.getPublicState().speechFlow.deadlineAt, firstSpeechDeadline + 300_000);
    now += 80_000;
    assert.equal(game.handleAction('host', { kind: 'timerTick' }).success, true);
    assert.equal(game.getPublicState().speechFlow.currentSeat, aliveSeats[1]);
    for (const [index, seatNumber] of publicState.speechFlow.order.slice(1).entries()) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.getPlayerState('host').canStartSpeech, true);
        assert.equal(game.handleAction('host', { kind: 'startSpeech' }).success, true);
        assert.equal(game.getPublicState().speechFlow.deadlineAt, now + 90_000);
        if (index === 0) now += 90_000;
        assert.equal(game.handleAction('host', { kind: 'finishSpeech' }).success, true);
    }
    assert.equal(game.phase, 'vote');

    const voters = game.seats.filter(seat => seat.alive).map(seat => seat.number);
    for (const seatNumber of voters) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: secondVictim.number }).success, true);
    }
    publicState = game.getPublicState();
    assert.equal(publicState.lastVoteResult.day, 1);
    assert.equal(publicState.lastVoteResult.exiledSeat, secondVictim.number);
    assert.equal(publicState.lastVoteResult.tied, false);
    assert.equal(publicState.lastVoteResult.ballots.length, voters.length);
    assert.deepEqual(publicState.lastVoteResult.ballots.map(ballot => ballot.voterSeat), voters);
    assert.equal(publicState.lastVoteResult.counts[secondVictim.number], voters.length);
    assert.equal(publicState.voteHistory.length, 1);

    game.handleAction('host', { kind: 'switchSeat', seat: secondVictim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.getPublicState().voteHistory[0].exiledSeat, secondVictim.number, '进入下一夜后完整票型仍保留');
});

test('Werewolf wraps counterclockwise speech order and records a tied public ballot', () => {
    const game = new WerewolfEngine('werewolf-day-order-tie', players(['host']), 'host', () => 0);
    game.start();
    game.day = 1;
    game.random = () => 0.75;
    game._beginDaySpeech();
    assert.equal(game.getPublicState().speechFlow.startSeat, 7);
    assert.equal(game.getPublicState().speechFlow.directionName, '逆时针');
    assert.deepEqual(game.getPublicState().speechFlow.order, [7, 6, 5, 4, 3, 2, 1, 9, 8]);

    game.phase = 'vote';
    game.votes = {};
    game.seats.find(seat => seat.number === 9).alive = false;
    const targets = [1, 2, 3];
    for (let seatNumber = 1; seatNumber <= 8; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        const targetSeat = seatNumber <= 4 ? targets[0] : seatNumber <= 8 ? targets[1] : targets[2];
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat }).success, true);
    }
    const result = game.getPublicState().lastVoteResult;
    assert.equal(result.tied, true);
    assert.equal(result.exiledSeat, null);
    assert.deepEqual(result.topSeats, [1, 2]);
    assert.deepEqual(result.counts, { 1: 4, 2: 4 });
    assert.equal(result.ballots.length, 8);
    assert.equal(game.phase, 'dayRunoffSpeech');
    assert.deepEqual(game.runoffSpeechFlow.order, [2, 1]);
    for (const seatNumber of game.runoffSpeechFlow.order) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'startRunoffSpeech' }).success, true);
        assert.equal(game.handleAction('host', { kind: 'finishRunoffSpeech' }).success, true);
    }
    assert.equal(game.phase, 'vote');
    for (let seatNumber = 1; seatNumber <= 8; seatNumber += 1) {
        if ([1, 2].includes(seatNumber)) continue;
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat: seatNumber % 2 ? 1 : 2 }).success, true);
    }
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.getPublicState().lastVoteResult.tied, true);
    assert.equal(game.getPublicState().voteHistory.length, 2);
});

test('Werewolf public ballot supports abstention without creating a phantom target', () => {
    const game = new WerewolfEngine('werewolf-abstain', players(['host']), 'host', () => 0, Date.now, { playerCount: 12 });
    game.start(); game.phase = 'vote'; game.day = 1; game.votes = {};
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        const targetSeat = [10, 11].includes(seat.number) ? null : seat.number === 1 || seat.number === 3 ? 4 : 9;
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat }).success, true);
    }
    const result = game.getPublicState().lastVoteResult;
    assert.deepEqual(result.ballots.filter(ballot => ballot.targetSeat === null).map(ballot => ballot.voterSeat), [10, 11]);
    assert.equal(Object.prototype.hasOwnProperty.call(result.counts, 0), false);
    assert.equal(result.ballots.length, 12);
});

test('Werewolf runs a private first-day sheriff election and applies the 1.5 vote weight', () => {
    const game = new WerewolfEngine('werewolf-sheriff-election', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    game.day = 1;
    game._beginDayAgenda();
    assert.equal(game.phase, 'sheriffPrelude');
    assert.equal(game.sheriff.deadlineAt, null, '天亮播报结束前不得启动报名计时');
    assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: 'run' }).success, false);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'sheriffSignup');
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 2 ? 'run' : 'skip' }).success, true);
        if (seatNumber < 9) assert.deepEqual(game.getPublicState().sheriff.candidates, [], '报名结束前不能公开候选人');
    }
    assert.equal(game.phase, 'sheriffCampaign');
    assert.deepEqual(game.getPublicState().sheriff.candidates, [1, 2]);
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' }).success, true);
    }
    assert.equal(game.phase, 'sheriffVote');
    for (let seatNumber = 3; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat: 1 }).success, true);
    }
    assert.equal(game.phase, 'day');
    assert.equal(game.sheriff.holderSeat, 1);
    assert.equal(game.getPublicState().seats.find(seat => seat.number === 1).isSheriff, true);

    game.phase = 'vote';
    game.votes = {};
    const ordinaryTargets = [3, 4, 5, 6, 7, 8, 9, 1];
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        const targetSeat = seatNumber === 1 ? 2 : ordinaryTargets[seatNumber - 2];
        assert.equal(game.handleAction('host', { kind: 'vote', targetSeat }).success, true);
    }
    assert.equal(game.getPublicState().lastVoteResult.exiledSeat, 2);
    assert.equal(game.getPublicState().lastVoteResult.counts[2], 1.5);
    assert.equal(game.getPublicState().lastVoteResult.ballots.find(ballot => ballot.voterSeat === 1).weight, 1.5);
});

test('Werewolf publishes each sheriff campaign and runoff speaker start', () => {
    const game = new WerewolfEngine('werewolf-sheriff-speech-events', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    game.day = 1;
    game._beginDayAgenda();
    acknowledgeWerewolfPresentation(game);
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 2 ? 'run' : 'skip' }).success, true);
    }
    assert.deepEqual(game.publicEvents.map(event => event.kind), ['sheriffSignup', 'sheriffCandidates', 'sheriffSpeechStart']);
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' }).success, true);
    }
    assert.equal(game.phase, 'sheriffVote');
    for (let seatNumber = 3; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        const targetSeat = seatNumber <= 5 ? 1 : seatNumber <= 8 ? 2 : null;
        assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat }).success, true);
    }
    assert.equal(game.phase, 'sheriffRunoffSpeech');
    assert.equal(game.publicEvents.at(-2).kind, 'sheriffRunoff');
    assert.equal(game.publicEvents.at(-1).kind, 'sheriffRunoffSpeechStart');
    for (const seatNumber of game.sheriff.runoffCandidates) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffRunoffSpeech' }).success, true);
    }
    assert.equal(game.publicEvents.at(-1).kind, 'sheriffRunoffSpeechStart');
});

test('Werewolf holds the first sheriff election before revealing the first-night deaths', () => {
    const game = new WerewolfEngine('werewolf-first-day-agenda', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true, playerCount: 12 });
    game.start();
    game.handleAction('host', { kind: 'confirmAllRoles' });
    acknowledgeWerewolfPresentation(game);
    const seatFor = role => game.seats.find(seat => seat.role === role).number;
    const victim = seatFor('villager');
    const guard = seatFor('guard');
    const witch = seatFor('witch');
    const seer = seatFor('seer');
    const wolfTarget = seatFor('werewolf');

    game.handleAction('host', { kind: 'switchSeat', seat: guard });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);
    assert.equal(game.phase, 'nightGuard');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    for (const wolf of game.seats.filter(seat => seat.role === 'werewolf')) {
        game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
        assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: victim }).success, true);
    }
    assert.equal(game.phase, 'nightWolf');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    game.handleAction('host', { kind: 'switchSeat', seat: witch });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { choice: 'pass' }).success, true);
    assert.equal(game.phase, 'nightWitch');
    assert.equal(advanceWerewolfNight(game)?.success, true);
    game.handleAction('host', { kind: 'switchSeat', seat: seer });
    assert.equal(confirmedWerewolfNightAction(game, 'host', { targetSeat: wolfTarget }).success, true);
    assert.equal(game.phase, 'nightSeer');
    assert.equal(advanceWerewolfNight(game)?.success, true);

    assert.equal(game.phase, 'sheriffPrelude');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'sheriffSignup');
    assert.equal(game.pendingNightResult.deaths.includes(victim), true);
    assert.equal(game.getPublicState().announcement, null);
    assert.equal(game.getPublicState().seats.every(seat => seat.alive), true, '首夜死讯公开前，公共席位不能泄露死亡');

    const candidate = game.seats.find(seat => seat.alive && seat.number !== victim).number;
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: seat.number === candidate ? 'run' : 'skip' }).success, true);
    }
    assert.equal(game.sheriff.holderSeat, candidate);
    assert.deepEqual(game.getPublicState().announcement.deaths, [victim]);
    assert.equal(game.phase, 'deathResolution');
});

test('Werewolf lets a hidden first-night victim complete the sheriff election', () => {
    const game = new WerewolfEngine('werewolf-hidden-victim-election', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    const victim = game.seats.find(seat => seat.role === 'villager');
    victim.alive = false;
    game.day = 1;
    game.pendingNightResult = { deaths: [victim.number], poisonedSeats: [], announcement: { day: 1, kind: 'night', deaths: [victim.number], peaceful: false, text: `天亮，${victim.number} 号倒牌`, createdAt: 1 } };
    game._beginDayAgenda();
    acknowledgeWerewolfPresentation(game);

    game.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    assert.equal(game.getPlayerState('host').sheriffAction.kind, 'signup');
    assert.equal(game.handleAction('host', { kind: 'sheriffSignup', choice: 'run' }).success, true);
    for (const seat of game.seats.filter(item => item.number !== victim.number)) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        game.handleAction('host', { kind: 'sheriffSignup', choice: 'skip' });
    }
    assert.equal(game.sheriff.holderSeat, victim.number);
    assert.equal(game.phase, 'deathResolution');
    assert.equal(game.pendingBadge.seat, victim.number);
});

test('Werewolf sheriff runoff ballots remain restricted to the original non-candidates', () => {
    const game = new WerewolfEngine('werewolf-original-down-voters', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start(); game.day = 1; game._beginDayAgenda(); acknowledgeWerewolfPresentation(game);
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        game.handleAction('host', { kind: 'sheriffSignup', choice: seat.number <= 3 ? 'run' : 'skip' });
    }
    for (const seatNumber of [1, 2, 3]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' });
    }
    for (let seatNumber = 4; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'sheriffVote', targetSeat: seatNumber <= 6 ? 1 : 2 });
    }
    assert.equal(game.phase, 'sheriffRunoffSpeech');
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'finishSheriffRunoffSpeech' });
    }
    game.handleAction('host', { kind: 'switchSeat', seat: 3 });
    assert.equal(game.getPlayerState('host').sheriffAction, null);
    assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat: 1 }).success, false);
    assert.deepEqual(game._sheriffEligibleVoters().map(seat => seat.number), [4, 5, 6, 7, 8, 9]);
});

test('Werewolf self-destruct publishes one complete scene chain and grants a 30-second self-destruct statement', () => {
    const game = new WerewolfEngine('werewolf-self-destruct', players(['host']), 'host', () => 0, () => 77, { sheriffEnabled: false });
    game.start(); game.day = 2; game._beginDaySpeech();
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
    assert.equal(game.getPlayerState('host').canWolfSelfDestruct, true);
    assert.equal(game.handleAction('host', { kind: 'wolfSelfDestruct' }).success, true);
    assert.deepEqual(game.publicEvents.slice(-2).map(event => event.kind), ['wolfSelfDestruct', 'elimination']);
    assert.equal(game.phase, 'lastWords');
    assert.deepEqual(game.lastWordsFlow.order, [wolf.number]);
    assert.equal(game.lastWordsFlow.turn, null, '自爆结果播放完前不能消耗遗言时间');
    assert.equal(game.presentationGate.kind, 'selfDestructResult');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.publicEvents.at(-1).kind, 'selfDestructWordsStart');
    assert.equal(game.lastWordsFlow.turn, null, '遗言提示播放期间不得消耗遗言时间');
    assert.equal(game.presentationGate.kind, 'selfDestructPrompt');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.getPublicState().lastWordsFlow.durationSeconds, 30);
    assert.equal(game.getPublicState().flowRules.selfDestructWordsSeconds, 30);
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
    assert.equal(game.getPlayerState('host').canStartLastWords, false, '自爆遗言应自动开始');
    assert.equal(game.getPlayerState('host').canFinishLastWords, true);
    assert.equal(game.publicEvents.at(-1).kind, 'selfDestructWordsStart');
    assert.equal(game.handleAction('host', { kind: 'finishLastWords', text: '这是我的自爆遗言' }).success, true);
    assert.equal(game.publicEvents.at(-1).kind, 'nightFalls');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.lastWordsFlow, null);
    assert.equal(game.lastWordsHistory.at(-1).kind, 'selfDestruct');
    assert.equal(game.lastWordsHistory.at(-1).durationSeconds, 30);

    const laterNight = new WerewolfEngine('werewolf-no-later-night-last-words', players(['host']), 'host', () => 0);
    laterNight.start(); laterNight.day = 2;
    const victim = laterNight.seats.find(seat => seat.role === 'villager');
    victim.alive = false;
    laterNight._beginDeathResolution([victim.number], 'day', [], false);
    laterNight.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    laterNight.handleAction('host', { kind: 'confirmDeathResolution' });
    assert.equal(laterNight.phase, 'day');
    assert.equal(laterNight.lastWordsFlow, null);
});

test('Werewolf uses board-specific ordinary last-words duration', () => {
    const game = new WerewolfEngine('werewolf-twelve-last-words', players(['host']), 'host', () => 0, Date.now, { playerCount: 12, winCondition: 'edge' });
    assert.equal(game.start().success, true);
    assert.equal(game.getPublicState().flowRules.lastWordsSeconds, 120);
    const victim = game.seats.find(seat => seat.role === 'villager');
    victim.alive = false;
    game.day = 1;
    game._beginDeathResolution([victim.number], 'day', [], true);
    game.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.getPublicState().lastWordsFlow.durationSeconds, 120);
});

test('Werewolf sheriff-phase self-destruct consumes the badge and preserves first-night victim last words', () => {
    const game = new WerewolfEngine('werewolf-sheriff-self-destruct', players(['host']), 'host', () => 0, () => 88, { sheriffEnabled: true });
    game.start(); game.day = 1;
    const victim = game.seats.find(seat => seat.role === 'villager');
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    victim.alive = false;
    game.pendingNightResult = { deaths: [victim.number], poisonedSeats: [], announcement: { day: 1, kind: 'night', deaths: [victim.number], peaceful: false, text: `天亮，${victim.number} 号倒牌`, createdAt: 88 } };
    game._beginDayAgenda();
    acknowledgeWerewolfPresentation(game);
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });

    assert.equal(game.handleAction('host', { kind: 'wolfSelfDestruct' }).success, true);
    assert.deepEqual(game.publicEvents.map(event => event.kind), ['sheriffSignup', 'wolfSelfDestruct', 'elimination']);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.lastWordsFlow.turn, null);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.publicEvents.at(-1).kind, 'selfDestructWordsStart');
    assert.equal(game.lastWordsFlow.turn, null);
    acknowledgeWerewolfPresentation(game);
    game.handleAction('host', { kind: 'switchSeat', seat: wolf.number });
    assert.equal(game.getPlayerState('host').canStartLastWords, false);
    assert.equal(game.getPlayerState('host').canFinishLastWords, true);
    assert.equal(game.publicEvents.at(-1).title, `${wolf.number} 号玩家发表遗言`);
    assert.equal(game.publicEvents.at(-1).text, '');
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.publicEvents.at(-1).kind, 'badgeTorn');
    assert.equal(game.publicEvents.at(-1).title, '本局警徽流失');
    assert.equal(game.publicEvents.at(-1).text, '本局警徽流失');
    assert.equal(game.sheriff.status, 'torn');
    acknowledgeWerewolfPresentation(game);
    assert.deepEqual(game.publicEvents.map(event => event.kind), ['sheriffSignup', 'wolfSelfDestruct', 'elimination', 'selfDestructWordsStart', 'badgeTorn', 'nightDeaths', 'elimination']);
    assert.equal(game.publicEvents.some(event => event.kind === 'nightFalls'), false, '首夜死者结算前不能先播第二次天黑');
    assert.equal(game.phase, 'deathResolution');
    game.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    assert.equal(game.handleAction('host', { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.deepEqual(game.lastWordsFlow.order, [victim.number]);
    assert.equal(game.lastWordsFlow.durationBySeat[victim.number], undefined);
    assert.equal(game.getPublicState().lastWordsFlow.currentKind, 'firstNight');
    game.handleAction('host', { kind: 'switchSeat', seat: victim.number });
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.publicEvents.at(-1).title, '首夜遗言');
    assert.equal(game.handleAction('host', { kind: 'finishLastWords', text: '这是首夜遗言' }).success, true);
    assert.equal(game.lastWordsHistory.at(-1).kind, 'firstNight');
    assert.equal(game.publicEvents.at(-1).kind, 'nightFalls', '第二次天黑必须排在首夜死者及遗言处理之后');
    assert.equal(game.phase, 'nightPrelude');
});

test('Werewolf defers the first 12-player sheriff self-destruct and tears the badge on the second attempt', () => {
    const game = new WerewolfEngine('werewolf-twelve-sheriff-retry', players(['host']), 'host', () => 0, () => 500, { sheriffEnabled: true, playerCount: 12 });
    game.start(); game.day = 1;
    game.pendingNightResult = { deaths: [], poisonedSeats: [], announcement: { day: 1, kind: 'night', deaths: [], peaceful: true, text: '天亮，昨夜平安夜', createdAt: 500 } };
    game._beginDayAgenda();
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.sheriff.electionAttempt, 1);

    const wolves = game.seats.filter(seat => seat.role === 'werewolf');
    game.handleAction('host', { kind: 'switchSeat', seat: wolves[0].number });
    assert.equal(game.handleAction('host', { kind: 'wolfSelfDestruct' }).success, true);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.presentationGate.kind, 'selfDestructPrompt');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.lastWordsFlow.turn.durationSeconds, 30);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.sheriff.status, 'deferred');
    assert.equal(game.publicEvents.at(-1).kind, 'sheriffDeferred');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightPrelude');
    assert.equal(game.publicEvents.at(-1).kind, 'nightFalls');

    acknowledgeWerewolfPresentation(game);
    assert.equal(game.day, 2);
    game._beginDayAgenda();
    assert.equal(game.phase, 'sheriffPrelude');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.sheriff.electionAttempt, 2);

    game.handleAction('host', { kind: 'switchSeat', seat: wolves[1].number });
    assert.equal(game.handleAction('host', { kind: 'wolfSelfDestruct' }).success, true);
    acknowledgeWerewolfPresentation(game);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.sheriff.status, 'torn');
    assert.equal(game.publicEvents.at(-1).kind, 'badgeTorn');
    assert.equal(game.publicEvents.at(-1).title, '本局警徽流失');
    assert.equal(game.publicEvents.at(-1).text, '本局警徽流失');
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightPrelude');
    assert.equal(game.day, 3);
    assert.equal(game.publicEvents.at(-1).kind, 'nightFalls', '警徽流失必须在第三次天黑请闭眼之前播放');
});

test('Werewolf drops a malformed duplicate bomber from the deferred first-night words queue', () => {
    const game = new WerewolfEngine('werewolf-self-destruct-dedupe', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    assert.equal(game.start().success, true);
    const bomber = game.seats.find(seat => seat.role === 'werewolf');
    const victim = game.seats.find(seat => seat.role === 'villager');
    bomber.alive = false;
    victim.alive = false;
    game.pendingSelfDestructSequence = {
        targetDay: 2,
        selfDestructSeat: bomber.number,
        pendingNightResult: {
            deaths: [bomber.number, victim.number, victim.number],
            poisonedSeats: [],
            announcement: { day: 1, kind: 'night', deaths: [bomber.number, victim.number], peaceful: false, text: '首夜死讯', createdAt: 1 },
        },
    };
    game._resumeAfterSelfDestructWords();
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'deathResolution');
    assert.deepEqual(game.deathResolution.seats, [victim.number]);
    assert.deepEqual(game.deathResolution.lastWordsSeats, [victim.number]);
    assert.deepEqual(game.deathResolution.lastWordsOptions.kindBySeat, { [victim.number]: 'firstNight' });
});

test('Werewolf never schedules a second last-words turn for a seat that already completed one', () => {
    const game = new WerewolfEngine('werewolf-last-words-history-dedupe', players(['host']), 'host', () => 0);
    game.start();
    const wolf = game.seats.find(seat => seat.role === 'werewolf');
    wolf.alive = false;
    game.lastWordsHistory.push({ day: 1, seat: wolf.number, kind: 'selfDestruct', durationSeconds: 30 });
    let continuedAfter = null;
    game._continueAfterDeathResolution = after => { continuedAfter = after; };

    game._beginLastWords([wolf.number, wolf.number], 'night', {
        durationBySeat: { [wolf.number]: 30 },
        kindBySeat: { [wolf.number]: 'selfDestruct' },
    });

    assert.equal(game.lastWordsFlow, null);
    assert.equal(continuedAfter, 'night');
    assert.equal(game.lastWordsHistory.length, 1);
});

test('Werewolf keeps withdrawn sheriff candidates out of both sheriff ballots', () => {
    const game = new WerewolfEngine('werewolf-withdrawn-sheriff', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    game.day = 1;
    game._beginDayAgenda();
    acknowledgeWerewolfPresentation(game);
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 3 ? 'run' : 'skip' });
    }
    assert.equal(game.phase, 'sheriffCampaign');
    game.handleAction('host', { kind: 'switchSeat', seat: 1 });
    game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'withdraw' });
    for (const seatNumber of [2, 3]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' });
    }
    assert.equal(game.phase, 'sheriffVote');
    assert.equal(game._sheriffEligibleVoters().some(seat => seat.number === 1), false);
    game.handleAction('host', { kind: 'switchSeat', seat: 1 });
    assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat: 2 }).success, false);
    for (const voter of game._sheriffEligibleVoters()) {
        game.handleAction('host', { kind: 'switchSeat', seat: voter.number });
        assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat: 2 }).success, true);
    }
    assert.equal(game.getPublicState().sheriff.results[0].ballots.some(ballot => ballot.voterSeat === 1), false);
});

test('Werewolf sheriff runoff ends without a sheriff after a second tie', () => {
    const game = new WerewolfEngine('werewolf-sheriff-runoff', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start(); game.day = 1; game._beginDayAgenda(); acknowledgeWerewolfPresentation(game);
    for (let seatNumber = 1; seatNumber <= 9; seatNumber += 1) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'sheriffSignup', choice: seatNumber <= 2 ? 'run' : 'skip' });
    }
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        game.handleAction('host', { kind: 'finishSheriffCampaign', choice: 'stay' });
    }
    const castTie = () => {
        for (let seatNumber = 3; seatNumber <= 9; seatNumber += 1) {
            game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
            const targetSeat = seatNumber <= 5 ? 1 : seatNumber <= 8 ? 2 : null;
            assert.equal(game.handleAction('host', { kind: 'sheriffVote', targetSeat }).success, true);
        }
    };
    castTie();
    assert.equal(game.phase, 'sheriffRunoffSpeech');
    assert.deepEqual(game.sheriff.runoffCandidates, [1, 2]);
    for (const seatNumber of [1, 2]) {
        game.handleAction('host', { kind: 'switchSeat', seat: seatNumber });
        assert.equal(game.handleAction('host', { kind: 'finishSheriffRunoffSpeech' }).success, true);
    }
    assert.equal(game.phase, 'sheriffRunoffVote');
    castTie();
    assert.equal(game.phase, 'day');
    assert.equal(game.sheriff.holderSeat, null);
    assert.equal(game.sheriff.status, 'none');
    assert.equal(game.getPublicState().sheriff.results.length, 2);
});

test('Werewolf privately transfers or tears the badge when the sheriff dies', () => {
    const game = new WerewolfEngine('werewolf-sheriff-badge', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    const sheriff = game.seats.find(seat => seat.role === 'villager');
    const receiver = game.seats.find(seat => seat.number !== sheriff.number);
    game.sheriff.status = 'elected';
    game.sheriff.holderSeat = sheriff.number;
    game.phase = 'vote'; game.day = 1;
    for (const seat of game.seats) {
        game.handleAction('host', { kind: 'switchSeat', seat: seat.number });
        game.handleAction('host', { kind: 'vote', targetSeat: sheriff.number });
    }
    assert.equal(game.phase, 'deathResolution');
    game.handleAction('host', { kind: 'switchSeat', seat: sheriff.number });
    const privateState = game.getPlayerState('host');
    assert.equal(privateState.canConfirmDeathResolution, false);
    assert.equal(privateState.sheriffBadgeAction.available, true);
    assert.equal(game.handleAction('host', { kind: 'sheriffBadgeAction', choice: 'transfer', targetSeat: receiver.number }).success, true);
    assert.equal(game.sheriff.holderSeat, receiver.number);
    assert.equal(game.getPublicState().seats.find(seat => seat.number === receiver.number).isSheriff, true);
});

test('Werewolf does not deadlock when an isolated sheriff is auto-torn with no receiver', () => {
    const game = new WerewolfEngine('werewolf-sheriff-autotear', players(['host']), 'host', () => 0, Date.now, { sheriffEnabled: true });
    game.start();
    const sheriff = game.seats.find(seat => seat.role === 'villager');
    game.seats.forEach(seat => { seat.alive = seat.number === sheriff.number; });
    game.sheriff.status = 'elected';
    game.sheriff.holderSeat = sheriff.number;
    sheriff.alive = false;
    game._beginDeathResolution([sheriff.number], 'night');
    assert.equal(game.phase, 'lastWords');
    game.handleAction('host', { kind: 'switchSeat', seat: sheriff.number });
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction('host', { kind: 'finishLastWords' }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.phase, 'ended');
    assert.equal(game.pendingBadge, null);
});

test('Werewolf stores typed last words and server ticks timed turns', () => {
    let now = 1_700_000_000_000;
    const game = new WerewolfEngine('werewolf-tick-text', players(['host']), 'host', () => 0, () => now);
    game.start();
    const dead = game.seats.find(seat => seat.role === 'villager');
    dead.alive = false;
    game.phase = 'lastWords';
    game.lastWordsFlow = { day: 1, after: 'night', order: [dead.number], currentIndex: 0, completedSeats: {}, turn: null, durationSeconds: 60 };
    game.handleAction('host', { kind: 'switchSeat', seat: dead.number });
    assert.equal(game.handleAction('host', { kind: 'startLastWords' }).success, true);
    now += 60_000;
    assert.equal(game.handleSystemTick().success, true);
    acknowledgeWerewolfPresentation(game);
    assert.equal(game.phase, 'nightWolf');
    assert.equal(game.lastWordsHistory[0].text, '');

    game.phase = 'lastWords';
    game.lastWordsFlow = { day: 1, after: 'night', order: [dead.number], currentIndex: 0, completedSeats: {}, turn: null, durationSeconds: 60 };
    game.handleAction('host', { kind: 'startLastWords' });
    assert.equal(game.handleAction('host', { kind: 'finishLastWords', text: '我昨晚查验了 3 号。' }).success, true);
    assert.equal(game.lastWordsHistory.at(-1).text, '我昨晚查验了 3 号。');
});

test('Werewolf session uses the nine-player edge win condition', () => {
    const session = Werewolf.create('werewolf-edge-condition', players(['host']), 'host');
    session.start();
    const game = session.engine;
    const wolves = game.seats.filter(seat => seat.role === 'werewolf');
    const villager = game.seats.find(seat => seat.role === 'villager');
    const gods = game.seats.filter(seat => !['werewolf', 'villager'].includes(seat.role)).slice(0, 2);
    game.seats.forEach(seat => { seat.alive = wolves.includes(seat) || seat === villager || gods.includes(seat); });
    game._checkWinner();
    assert.equal(game.status, 'playing', '仍有平民和神职时不应按人数相等提前判狼胜');
    villager.alive = false;
    game._checkWinner();
    assert.equal(game.winner.faction, 'wolf');
});

test('Werewolf resolves a decisive edge exile immediately and publishes it to every player', () => {
    const game = new WerewolfEngine('werewolf-edge-exile', players(['a', 'b']), 'a', () => 0, () => 1234, { winCondition: 'edge' });
    game.start();
    const wolves = game.seats.filter(seat => seat.role === 'werewolf');
    const villager = game.seats.find(seat => seat.role === 'villager');
    const god = game.seats.find(seat => !['werewolf', 'villager'].includes(seat.role));
    game.seats.forEach(seat => { seat.alive = wolves.includes(seat) || seat === villager || seat === god; });
    game.phase = 'vote';
    game.day = 2;
    game.votes = Object.fromEntries(game.seats.filter(seat => seat.alive).map(seat => [seat.number, villager.number]));

    game._resolveVote();

    assert.equal(game.status, 'playing');
    assert.equal(game.phase, 'deathResolution');
    const villagerPlayer = game._seat(villager.number).controllerId;
    game.activeSeat[villagerPlayer] = villager.number;
    assert.equal(game.handleAction(villagerPlayer, { kind: 'confirmDeathResolution' }).success, true);
    assert.equal(game.phase, 'lastWords');
    assert.equal(game.handleAction(villagerPlayer, { kind: 'startLastWords' }).success, true);
    assert.equal(game.handleAction(villagerPlayer, { kind: 'finishLastWords', text: '最后的白天遗言' }).success, true);
    assert.equal(game.status, 'ended');
    assert.deepEqual(game.winner, {
        faction: 'wolf', name: '狼人阵营获胜', reason: 'allVillagersEliminated', text: '最后的平民已经倒下，狼人占领了小镇。', trigger: 'exile', eliminatedSeats: [villager.number],
    });
    for (const playerId of ['a', 'b']) {
        const events = game.getPlayerState(playerId).publicEvents.map(event => ({ kind: event.kind, text: event.text }));
        assert.deepEqual(events.slice(0, 2), [
            { kind: 'exile', text: `${villager.number} 号玩家被放逐` },
            { kind: 'elimination', text: `${villager.number} 号已出局` },
        ]);
        assert.equal(events[2].kind, 'lastWordsStart');
        assert.equal(events[3].kind, 'identityReveal');
        assert.match(events[3].text, /狼人：/);
    }
});

test('Werewolf pauses on a transient disconnect and resumes the same controller safely', () => {
    const game = new WerewolfEngine('werewolf-offline', players(['a', 'b']), 'a', () => 0);
    game.start();
    assert.equal(game.handlePlayerDisconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, true);
    assert.ok(game.getPublicState().offlineSeats.length > 0);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, false);
    assert.equal(game.phase, 'roleReveal');
    assert.equal(game.handlePlayerReconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.deepEqual(game.getPublicState().offlineSeats, []);
    assert.equal(game.handleAction('a', { kind: 'confirmRole' }).success, true);
});

test('Werewolf permanently leaving controller hands its seats to online devices', () => {
    const game = new WerewolfEngine('werewolf-controller-takeover', players(['a', 'b', 'c']), 'a', () => 0);
    game.start();
    const abandonedSeats = game.seats.filter(seat => seat.controllerId === 'b').map(seat => seat.number);
    assert.ok(abandonedSeats.length > 0);
    game.handlePlayerDisconnect('b');
    assert.equal(game.getPublicState().flowPaused, true);
    assert.equal(game.handlePlayerLeave('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.deepEqual(game.getPublicState().offlineSeats, []);
    assert.ok(game.seats.every(seat => seat.controllerId !== 'b'));
    assert.ok(abandonedSeats.every(number => ['a', 'c'].includes(game._seat(number).controllerId)));
    const adoptedSeat = game._seat(abandonedSeats[0]);
    assert.equal(game.handleAction(adoptedSeat.controllerId, { kind: 'switchSeat', seat: adoptedSeat.number }).success, true);
    assert.equal(game.handleAction(adoptedSeat.controllerId, { kind: 'confirmRole' }).success, true);
});

test('Werewolf assigns orphaned seats when another paused controller reconnects', () => {
    const game = new WerewolfEngine('werewolf-delayed-takeover', players(['a', 'b']), 'a', () => 0);
    game.start();
    game.handlePlayerDisconnect('a');
    game.handlePlayerDisconnect('b');
    assert.equal(game.handlePlayerLeave('a').success, true);
    assert.equal(game.getPublicState().flowPaused, true);
    assert.equal(game.handlePlayerReconnect('b').success, true);
    assert.equal(game.getPublicState().flowPaused, false);
    assert.ok(game.seats.every(seat => seat.controllerId === 'b'));
});

test('Werewolf WebSocket lifecycle wires transient disconnect and resume hooks', () => {
    const appSource = ['app.js', 'server/realtime/create-realtime-server.js', 'server/realtime/room-handlers.js', 'server/realtime/socket-lifecycle.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const session = Werewolf.create('werewolf-reconnect-adapter', players(['a', 'b']), 'a');
    assert.equal(session.start().success, true);
    assert.equal(typeof session.handlePlayerDisconnect, 'function');
    assert.equal(typeof session.handlePlayerReconnect, 'function');
    assert.match(appSource, /markPlayerDisconnected\(player\.id\)/);
    assert.match(appSource, /handlePlayerReconnect\?\.\(player\.id\)/);
    session.handlePlayerDisconnect('b');
    assert.equal(session.getPlayerState('a').flowPaused, true);
    session.handlePlayerReconnect('b');
    assert.equal(session.getPlayerState('a').flowPaused, false);
});

test('Werewolf client uses player-facing copy, matching role art, and disposes click listeners', () => {
    const client = readFrontendSource('werewolf');
    const style = fs.readFileSync('public/games/werewolf/style.css', 'utf8');
    assert.match(client, /werewolf: \{ name: '狼人', image: 'werewolf-v2\.png'/);
    assert.match(client, /hunter: \{ name: '猎人', image: 'hunter-v3\.png'/);
    assert.match(client, /guard: \{ name: '守卫', image: 'guard-v3\.png'/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /scope\.destroy\(\)/);
    assert.match(client, /天黑请闭眼/);
    assert.match(client, /天亮了/);
    assert.match(client, /maybePlayTransition/);
    assert.match(client, /speechSynthesis/);
    assert.match(client, /transitionGlyphs/);
    assert.match(client, /showPersonalElimination/);
    assert.match(client, /WEREWOLF_PRESENTATION_TIMING/);
    assert.match(client, /fadeInMs: 240/);
    assert.match(client, /holdMs: 900/);
    assert.match(client, /fadeOutMs: PRESENTATION_FADE_MS/);
    assert.match(client, /victory: 1600/);
    assert.match(client, /elimination: 3600/);
    assert.match(client, /您已出局/);
    assert.match(client, /enqueueEventPresentation\(\{ \.\.\.next\.winner/);
    assert.match(client, /sceneQueue/);
    assert.match(client, /event\.kind === 'nightFalls'/);
    assert.match(client, /presentationComplete/);
    assert.match(client, /gameEpoch/);
    assert.match(client, /enqueueEliminationSlot/);
    assert.match(client, /enqueueScene\(\{ kind: 'elimination'/);
    assert.match(client, /presentationDurationMs: WEREWOLF_SCENE_VISIBLE_MS\.elimination/);
    assert.doesNotMatch(client, /playConcurrentPersonalElimination/);
    assert.match(client, /const visibleRole = current\.testMode \? seat\.role \|\| model\.testRoleBySeat\.get\(seat\.number\) : ''/);
    assert.doesNotMatch(client, /knownWolf \? seat\.knownRole \|\| 'werewolf'/);
    assert.match(client, /current\.wolfSeat != null/);
    assert.match(client, /myTarget = current\.wolfVote\?\.myTarget/);
    assert.match(client, /dialog\.selected != null/);
    assert.match(client, /formatVoteBallots/);
    assert.match(client, /data-ui="bulletins"/);
    assert.match(client, /data-action="voteAbstain"/);
    assert.doesNotMatch(client, /next\.status === 'ended'\) return/);
    assert.doesNotMatch(client, /ww-transition-card|skipTransition/);
    assert.match(client, /confirmAllRolesForTest/);
    assert.match(client, /pendingSeats\.forEach/);
    assert.match(client, /testRoleBySeat/);
    assert.match(client, /current\.testMode \|\| model\.roleIdentityVisible/);
    assert.doesNotMatch(client, /current\.phase !== 'roleReveal' \|\| model\.hasViewedRole/);
    assert.match(client, /current\.testMode \? '测试席位' : '玩家席位'/);
    assert.match(client, /\$\('seatTools'\)\?\.classList\.toggle\('is-hidden', !current\.testMode\)/);
    assert.match(client, /你的秘密界面/);
    assert.match(client, /游戏纪事/);
    assert.doesNotMatch(client, /玩家设备视角|选择可控制的座位|私密出局结算|系统记录|自动流程助手/);
    assert.match(client, /stageNightAction/);
    assert.match(client, /confirmNightAction/);
    assert.match(client, /confirmSeerResult/);
    assert.match(style, /\.ww-transition\.is-peaceful \.ww-transition-result/);
    assert.match(style, /\.ww-transition-result \{[\s\S]*font: 600 clamp\(22px, 3\.6vw, 36px\)/);
    assert.doesNotMatch(style, /\.ww-transition\.is-danger \.ww-transition-result \{[\s\S]*font: 600 clamp\(38px, 8vw, 78px\)/);
    assert.match(style, /--ww-curtain-duration: 1\.14s/);
    assert.match(style, /\.ww-transition-title,\s*\.ww-transition-result \{[\s\S]*grid-area: 1 \/ 1;/);
    assert.match(style, /\.ww-transition-shard::after/);
    assert.match(style, /\.ww-transition-result:empty \{ display: none; \}/);
    assert.doesNotMatch(style, /\.ww-transition\.show-result \.ww-transition-title \.ww-transition-glyph b/);
    assert.doesNotMatch(style, /@keyframes wwGlyphExit/);
    assert.match(style, /\.ww-elimination\.is-shattering \.ww-elimination-fragments i/);
    assert.match(style, /@keyframes wwEliminationFragment/);
    assert.match(client, /data-stage-night-choice="save"/);
    assert.match(client, /data-stage-night-choice="pass"/);
    assert.match(client, /同守同救/);
    assert.match(client, /挡不住女巫毒药/);
    assert.match(client, /witchCanSaveSelf/);
    assert.match(client, /自救规则/);
    assert.doesNotMatch(client, /data-open-skill="witch-(?:save|pass)"/);
    assert.doesNotMatch(client, /\$\('\[data-role=/, '角色查询辅助函数不能接收完整 CSS 选择器');
    assert.match(client, /data-role="targetModal"/);
    assert.match(client, /data-role="currentPhase"/);
    assert.match(client, /data-role="nextPhase"/);
    assert.match(client, /data-role="phaseProgress"/);
    assert.match(client, /data-role-hold/);
    assert.match(client, /data-role-secret/);
    assert.match(client, /setRoleIdentityVisible\(true\)/);
    assert.match(client, /hasViewedRole/);
    assert.match(client, /data-action="confirmRole".*disabled/);
    assert.match(client, /ww-confirm-button\$\{model\.hasViewedRole \? ' is-ready' : ''\}/);
    assert.match(style, /\.ww-confirm-button:disabled/);
    assert.match(client, /addEventListener\('pointerdown'/);
    assert.match(client, /addEventListener\('pointermove'/);
    assert.match(client, /addEventListener\('pointerout'/);
    assert.match(client, /addEventListener\('pointercancel'/);
    assert.match(client, /addEventListener\('keyup'/);
    assert.match(client, /addEventListener\('blur'/);
    assert.match(client, /documentRef\.hidden/);
    assert.match(client, /event\.key !== ' ' && event\.key !== 'Enter'/);
    assert.match(client, /data-action="confirmRole"/);
    assert.match(client, /data-action="confirmDeadRole"/);
    assert.match(client, /data-action="confirmDeathResolution"/);
    assert.match(client, /data-action="confirmDay"/);
    assert.match(client, /<small>此刻<\/small>/);
    assert.match(client, /<small>接下来<\/small>/);
    assert.match(client, /行动完成后继续/);
    assert.match(client, /data-open-skill="guard"/);
    assert.match(client, /data-open-skill="wolf"/);
    assert.match(client, /data-open-skill="hunter-shoot"/);
    assert.match(client, /phase === 'deathResolution'/);
    assert.doesNotMatch(client, /phase === 'hunter'/);
    assert.match(client, /选择袭击目标/);
    assert.match(client, /current\.wolfVote/);
    assert.match(client, /data-modal-target/);
    assert.match(client, /确定选择/);
    assert.doesNotMatch(client, /data-night-target/, '夜间技能不应继续直接铺开目标按钮');
    assert.match(client, /无需主持人/);
    assert.doesNotMatch(client, /主持人推进|主持人操作/);
    assert.doesNotMatch(client, /data-action="nextPhase"/);
    assert.doesNotMatch(client, /data-action="resolveVote"/);
    assert.doesNotMatch(client, /state\.isHost/);
});

test('Werewolf lobby requires host room configuration before listing and starting', () => {
    const appServer = ['app.js', 'server/realtime/create-realtime-server.js', 'server/realtime/room-handlers.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const room = fs.readFileSync('server/room.js', 'utf8');
    const lobby = ['public/script.js', 'public/lobby/message-handler.js', 'public/lobby/event-bindings.js', 'public/lobby/waiting-room-scene.js']
        .map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(appServer, /case 'configureRoom'/);
    assert.match(appServer, /filter\(room => room\.isListed\(\)\)/);
    assert.match(room, /playerCounts/);
    assert.match(room, /configurationConfirmed/);
    assert.match(room, /this\.targetPlayers && connectedPlayers\.length !== this\.targetPlayers/);
    assert.match(lobby, /data-room-player-count/);
    assert.match(lobby, /data-confirm-room-configuration/);
    assert.match(lobby, /type: 'configureRoom'/);
    assert.match(lobby, /9 \/ 12 人/);
});
