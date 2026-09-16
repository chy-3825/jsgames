const test = require('node:test');
const assert = require('node:assert/strict');
const AvalonEngine = require('../server/games/avalon/engine');
const Avalon = require('../server/games/avalon');
const Room = require('../server/room');

function players(count) {
    return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));
}

function confirmRoles(game) {
    if (game.phase !== 'roleReveal') return;
    for (const player of game.players) assert.equal(game.handleAction(player.id, { kind: 'confirmRole' }).success, true);
    assert.equal(game.phase, 'team');
}

function approveTeam(game, team, approve = true) {
    confirmRoles(game);
    const leader = game.players[game.leaderIndex];
    assert.equal(game.handleAction(leader.id, { kind: 'proposeTeam', playerIds: team }).success, true);
    for (const player of game.players) assert.equal(game.handleAction(player.id, { kind: 'castVote', approve }).success, true);
}

function completeMission(game, team, resultFor = () => 'success') {
    approveTeam(game, team, true);
    for (const id of team) assert.equal(game.handleAction(id, { kind: 'missionVote', result: resultFor(id) }).success, true);
}

test('Avalon rejects invalid rosters and does not silently truncate or restart', () => {
    const tooMany = new AvalonEngine('avalon-11', players(11), () => 0);
    assert.equal(tooMany.start().success, false);
    const duplicate = new AvalonEngine('avalon-duplicate', [{ id: 'x', name: '甲' }, { id: 'x', name: '乙' }, ...players(3)], () => 0);
    assert.equal(duplicate.start().success, false);
    const game = new AvalonEngine('avalon-start-once', players(5), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.start().success, false);
});

test('Avalon seals every private identity before opening the round table', () => {
    const game = new AvalonEngine('avalon-role-reveal', players(5), () => 0);
    assert.equal(game.start().success, true);
    assert.equal(game.phase, 'roleReveal');
    assert.equal(game.getPublicState().roleConfirmCount, 0);
    assert.equal(game.getPlayerState('p1').availableActions.confirmRole, true);
    assert.equal(game.handleAction('p1', { kind: 'proposeTeam', playerIds: ['p1', 'p2'] }).success, false);
    const first = game.handleAction('p1', { kind: 'confirmRole' });
    assert.equal(first.success, true);
    assert.equal(first.privateFor, 'p1');
    assert.equal(game.getPlayerAction(first, 'p2').message, '');
    assert.equal(game.getPublicState().players.find(player => player.id === 'p1').roleConfirmed, true);
    assert.equal(game.handleAction('p1', { kind: 'confirmRole' }).success, false);
    for (const player of game.players.slice(1)) assert.equal(game.handleAction(player.id, { kind: 'confirmRole' }).success, true);
    assert.equal(game.phase, 'team');
    assert.equal(game.getPublicState().roleConfirmCount, 5);
});

test('Avalon publishes the complete team ballot only after every player votes', () => {
    const game = new AvalonEngine('avalon-public-ballot', players(5), () => 0);
    game.start(); confirmRoles(game);
    const team = game.players.slice(0, 2).map(player => player.id);
    assert.equal(game.handleAction(game.players[0].id, { kind: 'proposeTeam', playerIds: team }).success, true);
    const proposalEventId = game.getPublicState().publicEvent.id;
    for (const player of game.players.slice(0, -1)) {
        assert.equal(game.handleAction(player.id, { kind: 'castVote', approve: player.id !== 'p4' }).success, true);
        assert.equal(game.getPublicState().publicEvent.id, proposalEventId);
        assert.equal(game.getPublicState().publicEvents.some(event => event.kind === 'teamVote'), false);
    }
    assert.equal(game.handleAction('p5', { kind: 'castVote', approve: true }).success, true);
    const event = game.getPublicState().publicEvents.findLast(item => item.kind === 'teamVote');
    assert.deepEqual({ kind: event.kind, title: event.title, detail: event.detail, approvals: event.approvals, rejections: event.rejections }, {
        kind: 'teamVote', title: '提案获得通过 · 4 比 1', detail: '1、2、3、5 号赞成；4 号反对', approvals: 4, rejections: 1,
    });
    assert.deepEqual(event.ballots, { p1: true, p2: true, p3: true, p4: false, p5: true });
});

test('Avalon enforces official mission sizes and the two-fail fourth mission', () => {
    const sizes = { 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] };
    for (const [count, expected] of Object.entries(sizes)) {
        const game = new AvalonEngine(`avalon-sizes-${count}`, players(Number(count)), () => 0);
        assert.equal(game.start().success, true);
        assert.deepEqual(expected.slice(0, 1), [game.getPublicState().missionSize]);
        game.round = 4;
        game.phase = 'mission';
        game.team = game.players.slice(0, expected[3]).map(player => player.id);
        game.missionVotes = {};
        for (const id of game.team) assert.equal(game.handleAction(id, { kind: 'missionVote', result: 'success' }).success, true);
        assert.equal(game.lastMission.requiredFails, Number(count) >= 7 ? 2 : 1);
    }

    const seven = new AvalonEngine('avalon-two-fails', players(7), () => 0);
    seven.start();
    seven.round = 4; seven.phase = 'mission'; seven.team = [seven.players[3].id, seven.players[4].id, seven.players[0].id, seven.players[1].id]; seven.missionVotes = {};
    assert.equal(seven.handleAction(seven.team[0], { kind: 'missionVote', result: 'fail' }).success, true);
    assert.equal(seven.handleAction(seven.team[1], { kind: 'missionVote', result: 'fail' }).success, true);
    for (const id of seven.team.slice(2)) assert.equal(seven.handleAction(id, { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(seven.lastMission.success, false);
    const sevenOneFail = new AvalonEngine('avalon-one-fail', players(7), () => 0);
    sevenOneFail.start();
    sevenOneFail.round = 4; sevenOneFail.phase = 'mission'; sevenOneFail.team = [sevenOneFail.players[3].id, sevenOneFail.players[0].id, sevenOneFail.players[1].id, sevenOneFail.players[2].id]; sevenOneFail.missionVotes = {};
    assert.equal(sevenOneFail.handleAction(sevenOneFail.team[0], { kind: 'missionVote', result: 'fail' }).success, true);
    for (const id of sevenOneFail.team.slice(1)) assert.equal(sevenOneFail.handleAction(id, { kind: 'missionVote', result: 'success' }).success, true);
    assert.equal(sevenOneFail.lastMission.success, true);
    assert.equal(sevenOneFail.getPublicState().publicEvents.findLast(event => event.kind === 'missionResult').detail, '1 张失败牌，不足 2 张，任务仍然成功');
});

test('Avalon enforces private role knowledge and optional role visibility rules', () => {
    const game = new AvalonEngine('avalon-roles', players(7), () => 0, { percival: true, morgana: true, mordred: true });
    assert.equal(game.start().success, true);
    const merlin = game.players.find(player => player.role === 'merlin');
    const percival = game.players.find(player => player.role === 'percival');
    const morgana = game.players.find(player => player.role === 'morgana');
    const mordred = game.players.find(player => player.role === 'mordred');
    assert.ok(merlin && percival && morgana && mordred);
    assert.equal(game.getPublicState().players.every(player => player.role === null), true);
    assert.equal(game.getPlayerState(percival.id).knownPlayers.every(player => !Object.hasOwn(player, 'faction')), true, '派西维尔不能通过状态 payload 区分梅林与莫甘娜');
    assert.equal(game.getPlayerState(merlin.id).knownPlayers.some(player => player.id === mordred.id), false);
    assert.deepEqual(game.getPlayerState(percival.id).knownPlayers.map(player => player.id).sort(), [merlin.id, morgana.id].sort());
    assert.equal(game.getPlayerState(morgana.id).knownPlayers.some(player => player.id === mordred.id), true);

    const oberonGame = new AvalonEngine('avalon-oberon', players(10), () => 0, { percival: true, morgana: true, oberon: true });
    assert.equal(oberonGame.start().success, true);
    const oberon = oberonGame.players.find(player => player.role === 'oberon');
    assert.equal(oberonGame.getPlayerState(oberon.id).knownPlayers.length, 0);
    for (const player of oberonGame.players.filter(item => item.id !== oberon.id && ['assassin', 'minion', 'morgana'].includes(item.role))) {
        assert.equal(oberonGame.getPlayerState(player.id).knownPlayers.some(item => item.id === oberon.id), false);
    }
});

test('Avalon only allows the assassin to target a good player', () => {
    const game = new AvalonEngine('avalon-assassin-targets', players(5), () => 0);
    game.start();
    const assassin = game.players.find(player => player.role === 'assassin');
    const evil = game.players.find(player => player.id !== assassin.id && ['minion', 'morgana', 'mordred', 'oberon'].includes(player.role));
    game.phase = 'assassin';
    const state = game.getPlayerState(assassin.id);
    assert.equal(state.assassinationTargets.some(player => player.id === evil.id), false);
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: evil.id }).success, false);
    const good = game.players.find(player => player.role === 'loyal');
    assert.equal(game.handleAction(assassin.id, { kind: 'assassinate', targetId: good.id }).success, true);
    assert.equal(game.winner.faction, 'good');
    assert.equal(game.winner.reason, 'missedMerlin');
    assert.equal(game.winner.targetId, good.id);
    const endingKinds = game.getPublicState().publicEvents.slice(-4).map(event => event.kind);
    assert.deepEqual(endingKinds, ['assassination', 'targetRoleReveal', 'identityReveal', 'outcome']);
    const assassination = game.getPublicState().publicEvents.find(event => event.kind === 'assassination');
    assert.deepEqual({ title: assassination.title, detail: assassination.detail, targetId: assassination.targetId, hit: assassination.hit }, {
        title: `刺客选择了 ${good.seat} 号 · ${good.name}`, detail: '梅林仍隐藏在圆桌之中', targetId: good.id, hit: false,
    });
});

test('Avalon publishes the complete ten-player ceremony sequence', () => {
    const game = new AvalonEngine('avalon-ceremony', players(10), () => 0);
    game.start();
    assert.equal(game.getPublicState().publicEvents[0].kind, 'identityBriefing');
    confirmRoles(game);
    assert.equal(game.getPublicState().publicEvent.kind, 'roundStart');
    const team = game.players.slice(0, 3).map(player => player.id);
    approveTeam(game, team, false);
    assert.deepEqual(game.getPublicState().publicEvents.slice(-2).map(event => event.kind), ['teamVote', 'leaderTransfer']);
    game.round = 3; game.phase = 'mission'; game.team = team; game.missionVotes = Object.fromEntries(team.map(id => [id, 'success'])); game.successfulMissions = 1;
    game._resolveMission();
    assert.deepEqual(game.getPublicState().publicEvents.slice(-3).map(event => event.kind), ['missionResult', 'roundStart', 'twoFailRule']);
});

test('Avalon completes three independent maximum-player games from start to finish', () => {
    // Game 1: three successful missions, then the assassin misses Merlin.
    const good = new AvalonEngine('avalon-max-good', players(10), () => 0);
    assert.equal(good.start().success, true);
    confirmRoles(good);
    for (let mission = 0; mission < 3; mission++) {
        const size = good.getPublicState().missionSize;
        const team = good.players.slice(0, size).map(player => player.id);
        completeMission(good, team);
    }
    assert.equal(good.phase, 'assassin');
    const assassin = good.players.find(player => player.role === 'assassin');
    const goodTarget = good.players.find(player => ['loyal', 'percival'].includes(player.role));
    assert.equal(good.handleAction(assassin.id, { kind: 'assassinate', targetId: goodTarget.id }).success, true);
    assert.equal(good.winner.faction, 'good');

    // Game 2: three sabotaged missions end immediately for evil.
    const evil = new AvalonEngine('avalon-max-evil', players(10), () => 0);
    assert.equal(evil.start().success, true);
    confirmRoles(evil);
    const evilPlayers = evil.players.filter(player => ['assassin', 'minion'].includes(player.role));
    for (let mission = 0; mission < 3; mission++) {
        const size = evil.getPublicState().missionSize;
        const team = evilPlayers.slice(0, Math.min(evilPlayers.length, size)).map(player => player.id);
        while (team.length < size) team.push(evil.players.find(player => !team.includes(player.id)).id);
        completeMission(evil, team, id => evilPlayers.some(player => player.id === id) ? 'fail' : 'success');
        if (evil.status === 'ended') break;
    }
    assert.equal(evil.status, 'ended');
    assert.equal(evil.winner.faction, 'evil');
    assert.equal(evil.failedMissions, 3);

    // Game 3: five consecutive rejected proposals end for evil.
    const rejected = new AvalonEngine('avalon-max-rejected', players(10), () => 0);
    assert.equal(rejected.start().success, true);
    confirmRoles(rejected);
    for (let proposal = 0; proposal < 5; proposal++) {
        const size = rejected.getPublicState().missionSize;
        approveTeam(rejected, rejected.players.slice(0, size).map(player => player.id), false);
        if (rejected.status === 'ended') break;
    }
    assert.equal(rejected.status, 'ended');
    assert.equal(rejected.winner.faction, 'evil');
    assert.equal(rejected.rejectedTeams, 5);
});

test('Avalon room adapter forwards game options and resolves an optional setup', () => {
    const room = new Room('avalon-room-options', 'p1', '玩家1', 'avalon', { percival: true, morgana: true });
    for (const player of players(5)) assert.equal(room.addPlayer(player).success, true);
    assert.equal(room.startGame().success, true);
    assert.ok(room.game.engine.players.some(player => player.role === 'percival'));
    assert.ok(room.game.engine.players.some(player => player.role === 'morgana'));
});
