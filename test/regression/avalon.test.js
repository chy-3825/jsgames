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

test('Avalon keeps roles private and resolves a failed mission after team approval', () => {
    const game = new AvalonEngine('avalon', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.players.length, 5);
    assert.equal(game.getPublicState().players.every(player => player.role === null), true);
    assert.equal(game.getPlayerState('a').myRole, game.players.find(player => player.id === 'a').role);
    assert.equal(game.phase, 'roleReveal');
    assert.equal(game.handleAction('a', { kind: 'proposeTeam', playerIds: ['a', 'b'] }).success, false);
    confirmAvalonRoles(game);
    const evil = game.players.find(player => player.role === 'assassin' || player.role === 'minion');
    const teammate = game.players.find(player => player.id !== 'a' && player.id !== evil.id) || game.players.find(player => player.id !== 'a');
    const missionMate = evil.id === 'a' ? teammate : evil;
    assert.equal(game.handleAction('a', { kind: 'proposeTeam', playerIds: ['a', missionMate.id] }).success, true);
    for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(game.handleAction(id, { kind: 'castVote', approve: true }).success, true);
    assert.equal(game.phase, 'mission');
    if (evil.id === 'a') {
        assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'fail' }).success, true);
        assert.equal(game.handleAction(missionMate.id, { kind: 'missionVote', result: 'success' }).success, true);
    } else {
        assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'success' }).success, true);
        assert.equal(game.handleAction(evil.id, { kind: 'missionVote', result: 'fail' }).success, true);
    }
    assert.equal(game.failedMissions, 1);
    assert.equal(game.missionHistory[0].success, false);
});

test('Avalon enters assassin phase after three successes and evil wins when Merlin is found', () => {
    const game = new AvalonEngine('avalon-assassin', players(['a', 'b', 'c', 'd', 'e']), () => 0); game.start();
    game.round = 3; game.successfulMissions = 2; game.phase = 'mission'; game.team = ['a', 'c']; game.missionVotes = {};
    assert.equal(game.handleAction('a', { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(game.handleAction('c', { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(game.phase, 'assassin');
    const assassin = game.players.find(player => player.role === 'assassin');
    const merlin = game.players.find(player => player.role === 'merlin');
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: merlin.id }).success, true);
    assert.equal(game.status, 'ended'); assert.equal(game.winner.faction, 'evil');
});

test('Avalon completes a five-player good run and assassin endgame', () => {
    const game = new AvalonEngine('avalon-full-five', players(['a', 'b', 'c', 'd', 'e']), () => 0);
    assert.equal(game.start().success, true);
    confirmAvalonRoles(game);
    let steps = 0;
    while (game.phase === 'team' && steps++ < 20) {
        const size = game.getPublicState().missionSize;
        const leader = game.players[game.leaderIndex];
        const team = game.players.slice(0, size).map(player => player.id);
        assert.equal(game.handleAction(leader.id, { kind: 'proposeTeam', playerIds: team }).success, true);
        for (const player of game.players) assert.equal(game.handleAction(player.id, { kind: 'castVote', approve: true }).success, true);
        for (const id of team) assert.equal(game.handleAction(id, { kind: 'missionVote', result: 'success' }).success, true);
    }
    assert.equal(game.phase, 'assassin');
    const assassin = game.players.find(player => player.role === 'assassin');
    const merlin = game.players.find(player => player.role === 'merlin');
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: merlin.id }).success, true);
    assert.equal(game.status, 'ended');
    assert.equal(game.winner.faction, 'evil');
    assert.equal(game.successfulMissions, 3);
    assert.equal(game.missionHistory.length, 3);
});

test('Avalon uses the core hidden-role distribution and supports optional roles', () => {
    for (const count of [5, 7, 9, 10]) {
        const game = new AvalonEngine(`avalon-${count}`, players(Array.from({ length: count }, (_, index) => String(index))), () => 0);
        assert.equal(game.start().success, true);
        const roles = game.players.map(player => player.role);
        assert.equal(roles.filter(role => ['assassin', 'minion', 'morgana', 'mordred', 'oberon'].includes(role)).length, ({ 5: 2, 7: 3, 9: 3, 10: 4 })[count]);
        assert.ok(roles.includes('merlin')); assert.ok(roles.includes('assassin'));
        assert.equal(game.getPublicState().players.every(player => player.role === null), true);
    }
    const expanded = new AvalonEngine('avalon-expanded', players(['a', 'b', 'c', 'd', 'e', 'f', 'g']), () => 0, { percival: true, morgana: true, oberon: true });
    assert.equal(expanded.start().success, true);
    assert.ok(expanded.players.some(player => player.role === 'percival'));
    assert.ok(expanded.players.some(player => player.role === 'morgana'));
    assert.ok(expanded.players.some(player => player.role === 'oberon'));
    const merlin = expanded.players.find(player => player.role === 'merlin');
    assert.equal(expanded.getPlayerState(merlin.id).knownPlayers.some(player => player.id === expanded.players.find(item => item.role === 'oberon').id), false);
    const invalid = new AvalonEngine('avalon-invalid-options', players(['a', 'b', 'c', 'd', 'e']), { morgana: true, mordred: true });
    assert.equal(invalid.start().success, false);
});

test('Avalon client keeps identities covered and treats discussion as an offline free-form activity', () => {
    const client = readFrontendSource('avalon');
    const style = ['style.css', 'scenes.css']
        .map(file => fs.readFileSync(`public/games/avalon/${file}`, 'utf8')).join('\n');
    assert.match(client, /data-role-hold/);
    assert.match(client, /data-role-secret/);
    assert.match(client, /setRoleIdentityVisible\(true\)/);
    assert.match(client, /'confirmRole', !model\.hasViewedRole/);
    assert.match(client, /讨论完全在线下自由进行/);
    assert.match(client, /辅助页面不会规定发言顺序或结束时间/);
    assert.match(client, /av-scene-transition/);
    assert.match(client, /event\.kind === 'teamVote' \? 'ballot'/);
    assert.match(client, /event\.kind === 'identityReveal' \? 2000/);
    assert.match(client, /pulseVoteLedger/);
    assert.match(client, /event\.kind === 'expeditionStart'/);
    assert.match(client, /'targetRoleReveal', 'assassinPhase'/);
    assert.match(client, /Array\.isArray\(next\.publicEvents\)/);
    assert.doesNotMatch(client, /chat|聊天框|发言倒计时/);
    assert.match(style, /\.av-role-cover/);
    assert.match(style, /@keyframes avSceneCurtain/);
    assert.match(style, /\.avalon-app\.scene-expedition/);
});
