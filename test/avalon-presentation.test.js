const test = require('node:test');
const assert = require('node:assert/strict');
const AvalonEngine = require('../server/games/avalon/engine');
const Room = require('../server/room');

async function loadAvalonState() {
    const module = await import('../public/games/avalon/state.js');
    return module;
}

async function loadAvalonScene() {
    return import('../public/games/avalon/scene.js');
}

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `玩家${index + 1}` }));

function confirmRoles(game) {
    for (const player of game.players) game.handleAction(player.id, { kind: 'confirmRole' });
}

function assertPresentationTimeline(game) {
    const state = game.getPublicState();
    assert.ok(Number.isFinite(state.serverNow));
    assert.ok(state.presentations.length > 0);
    const eventIds = new Set();
    for (const batch of state.presentations) {
        assert.ok(batch.transactionId, '每个播报批次必须有事务标识');
        assert.equal(batch.blocking, true);
        assert.ok(batch.endsAt > batch.startedAt);
        assert.equal(batch.durationMs, batch.endsAt - batch.startedAt);
        for (let index = 1; index < batch.events.length; index += 1) {
            assert.equal(batch.events[index - 1].endsAt, batch.events[index].startedAt, '同一批事件必须严格串行');
        }
        for (const event of batch.events) {
            assert.ok(event.eventId, '每个播报事件必须有唯一标识');
            assert.equal(eventIds.has(event.eventId), false, '播报事件 ID 不得重复');
            eventIds.add(event.eventId);
        }
    }
    for (let index = 1; index < state.presentations.length; index += 1) {
        assert.equal(state.presentations[index - 1].endsAt, state.presentations[index].startedAt, '跨动作事件也必须连续排期');
    }
    return state;
}

test('阿瓦隆客户端把服务端时间轴转换为本地时钟且跳过已经结束的批次', async () => {
    const { localizePresentation } = await loadAvalonState();
    const batch = {
        sequence: 9,
        serverNow: 10_000,
        startedAt: 10_120,
        endsAt: 11_000,
        events: [{ kind: 'teamVote', startedAt: 10_120, endsAt: 11_000 }],
    };
    const localized = localizePresentation(batch, 50_000);
    assert.equal(localized.startedAt, 50_120);
    assert.equal(localized.endsAt, 51_000);
    assert.equal(localized.events[0].startedAt, 50_120);
    assert.equal(localized.events[0].endsAt, 51_000);
    assert.equal(localizePresentation({ ...batch, endsAt: 10_000 }, 50_000), null);
});

test('阿瓦隆终局样式只按胜方阵营区分，不被个人获胜文案改写', async () => {
    const { avalonSceneKind } = await loadAvalonScene();
    assert.equal(avalonSceneKind({ kind: 'outcome', winnerFaction: 'good' }), 'good-victory');
    assert.equal(avalonSceneKind({ kind: 'outcome', winnerFaction: 'good', viewerVariant: 'personalVictory' }), 'good-victory');
    assert.equal(avalonSceneKind({ kind: 'outcome', winnerFaction: 'evil' }), 'evil-victory');
    assert.equal(avalonSceneKind({ kind: 'outcome', winnerFaction: 'evil', viewerVariant: 'personalVictory' }), 'evil-victory');
    assert.equal(avalonSceneKind({ kind: 'outcome', outcome: 'abandoned', winnerFaction: null }), 'abandoned');
    assert.equal(avalonSceneKind({ kind: 'missionResult', mission: { success: true } }), 'success', '普通过章样式保持不变');
    assert.equal(avalonSceneKind({ kind: 'teamVote', approved: false }), 'rejected', '普通否决样式保持不变');
});

test('阿瓦隆公共事件使用服务端绝对时间并按批次连续排期', () => {
    const game = new AvalonEngine('avalon-presentation-timeline', players(5), () => 0);
    game.start();
    assertPresentationTimeline(game);
    confirmRoles(game);
    const leader = game.players[game.leaderIndex];
    const team = game.players.slice(0, 2).map(player => player.id);
    game.handleAction(leader.id, { kind: 'proposeTeam', playerIds: team });
    for (const player of game.players) game.handleAction(player.id, { kind: 'castVote', approve: true });
    const state = assertPresentationTimeline(game);
    const latest = state.presentations.at(-1);
    assert.deepEqual(latest.events.map(event => event.kind), ['teamVote', 'expeditionStart']);
    assert.equal(game.getPlayerState('p1').presentation.serverNow >= state.serverNow, true);
    assert.equal(game.getPlayerState('p1').presentation.events[0].startedAt, latest.startedAt);
});

test('阿瓦隆在线房间在公共播报结束前拒绝下一步操作', () => {
    const room = new Room('avalon-presentation-lock', 'p1', '玩家1', 'avalon', {}, { readyCheckEnabled: true });
    for (const player of players(5)) assert.equal(room.addPlayer(player).success, true);
    for (const player of players(5).slice(1)) assert.equal(room.setPlayerReady(player.id, true).success, true);
    assert.equal(room.startGame().success, true);
    const locked = room.getPlayerGameState('p1').presentation;
    assert.equal(locked.blocking, true);
    const rejected = room.handleGameAction('p1', { kind: 'confirmRole' });
    assert.equal(rejected.success, false);
    assert.match(rejected.message, /播报结束/);

    const realNow = Date.now;
    Date.now = () => Number(locked.endsAt) + 1;
    try {
        const accepted = room.handleGameAction('p1', { kind: 'confirmRole' });
        assert.equal(accepted.success, true);
    } finally {
        Date.now = realNow;
    }
});

test('阿瓦隆终局按玩家视角替换获胜与梅林出局播报', () => {
    const game = new AvalonEngine('avalon-personal-outcome', players(5), () => 0);
    game.start();
    const good = game.players.find(player => ['merlin', 'loyal', 'percival'].includes(player.role));
    const evil = game.players.find(player => ['assassin', 'minion', 'morgana', 'mordred', 'oberon'].includes(player.role));
    game._finish('good', '善良阵营获胜', 'testGoodWin', '善良阵营守住了阿瓦隆。');
    const publicOutcome = game.getPublicState().publicEvents.findLast(event => event.kind === 'outcome');
    const goodOutcome = game.getPlayerState(good.id).presentations.flatMap(batch => batch.events).find(event => event.kind === 'outcome');
    const evilOutcome = game.getPlayerState(evil.id).presentations.flatMap(batch => batch.events).find(event => event.kind === 'outcome');
    assert.equal(publicOutcome.title, '善良阵营获胜');
    assert.equal(goodOutcome.title, '您已获胜');
    assert.equal(goodOutcome.viewerVariant, 'personalVictory');
    assert.equal(evilOutcome.title, '善良阵营获胜');
    assert.equal(goodOutcome.startedAt, publicOutcome.startedAt);
    assert.equal(goodOutcome.endsAt, publicOutcome.endsAt);

    const assassination = new AvalonEngine('avalon-personal-elimination', players(5), () => 0);
    assassination.start();
    const assassin = assassination.players.find(player => player.role === 'assassin');
    const merlin = assassination.players.find(player => player.role === 'merlin');
    assassination.phase = 'assassin';
    assert.equal(assassination.handleAction(assassin.id, { kind: 'assassinate', targetId: merlin.id }).success, true);
    const targetEvent = assassination.getPublicState().publicEvents.findLast(event => event.kind === 'targetRoleReveal');
    const personalEvent = assassination.getPlayerState(merlin.id).presentations.flatMap(batch => batch.events).find(event => event.kind === 'targetRoleReveal');
    assert.equal(targetEvent.title.includes('梅林'), true);
    assert.equal(personalEvent.title, '您已出局');
    assert.equal(personalEvent.viewerVariant, 'personalElimination');
    assert.equal(personalEvent.startedAt, targetEvent.startedAt);
    assert.equal(personalEvent.endsAt, targetEvent.endsAt);
});

test('阿瓦隆玩家离场不会改写已经提交的表决或任务牌', () => {
    const voteGame = new AvalonEngine('avalon-leave-vote', players(5), () => 0);
    voteGame.start();
    confirmRoles(voteGame);
    const leader = voteGame.players[voteGame.leaderIndex];
    voteGame.handleAction(leader.id, { kind: 'proposeTeam', playerIds: voteGame.players.slice(0, 2).map(player => player.id) });
    voteGame.handleAction('p2', { kind: 'castVote', approve: true });
    voteGame.handlePlayerLeave('p2');
    assert.equal(voteGame.votes.p2, true, '已提交赞成票的离场玩家必须保留原票');

    const missionGame = new AvalonEngine('avalon-leave-mission', players(5), () => 0);
    missionGame.start();
    confirmRoles(missionGame);
    const evil = missionGame.players.find(player => ['assassin', 'minion'].includes(player.role));
    const good = missionGame.players.find(player => player.id !== evil.id && ['merlin', 'loyal', 'percival'].includes(player.role));
    missionGame.phase = 'mission';
    missionGame.team = [evil.id, good.id];
    missionGame.missionVotes = {};
    missionGame.handleAction(evil.id, { kind: 'missionVote', result: 'fail' });
    missionGame.handlePlayerLeave(evil.id);
    assert.equal(missionGame.missionVotes[evil.id], 'fail', '已提交失败牌的离场玩家必须保留原结果');
});

test('阿瓦隆队长离场会进入连续公共播报，在线人数不足时终止而不死锁', () => {
    const leaderGame = new AvalonEngine('avalon-leave-leader', players(5), () => 0);
    leaderGame.start();
    confirmRoles(leaderGame);
    const leader = leaderGame.players[leaderGame.leaderIndex];
    const leaveResult = leaderGame.handlePlayerLeave(leader.id);
    const leaveBatch = leaveResult.state.presentations.find(batch => batch.events.some(event => event.kind === 'playerLeft'));
    assert.deepEqual(leaveBatch.events.map(event => event.kind), ['playerLeft', 'leaderTransfer']);
    assert.equal(leaveBatch.events[0].endsAt, leaveBatch.events[1].startedAt);
    const personalLeave = leaderGame.getPlayerState(leader.id).presentations.flatMap(batch => batch.events).find(event => event.kind === 'playerLeft');
    assert.equal(personalLeave.title, '您已离开本局');
    assert.equal(personalLeave.viewerVariant, 'personalDeparture');

    const sparseGame = new AvalonEngine('avalon-leave-sparse', players(5), () => 0);
    sparseGame.start();
    confirmRoles(sparseGame);
    for (const player of sparseGame.players.slice(1)) sparseGame.handlePlayerLeave(player.id);
    const sparseState = sparseGame.getPublicState();
    assert.equal(sparseState.status, 'ended');
    assert.equal(sparseState.outcome, 'abandoned');
    assert.equal(sparseState.endReason, 'insufficientOnline');
    assert.equal(sparseState.winner, null);
    assert.deepEqual(sparseState.publicEvents.slice(-2).map(event => event.kind), ['identityReveal', 'outcome']);
});

test('阿瓦隆客户端在公共播报期间关闭规则层并按事件 ID 去重', () => {
    const fs = require('node:fs');
    const client = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    const actions = fs.readFileSync('public/games/avalon/actions.js', 'utf8');
    assert.match(client, /presentationEventIds/);
    assert.match(client, /rulesModal\.setOpen\(false\)/);
    assert.match(actions, /function openRules\(\) \{ if \(scene\?\.isPlaying\?\.\(\)\) return;/);
});
