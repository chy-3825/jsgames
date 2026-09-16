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
    assert.match(client, /'confirmRole'/);
    assert.match(client, /localizePresentation/);
    assert.match(client, /lastPresentationSequence/);
    assert.match(client, /presentationLockedUntil/);
    assert.match(client, /讨论完全在线下自由进行/);
    assert.match(client, /av-scene-transition/);
    assert.match(client, /event\.kind === 'teamVote'/);
    assert.match(client, /event\.kind === 'identityReveal'/);
    assert.match(client, /event\.kind === 'identityBriefing'/);
    assert.match(client, /waitUntil\(event\.startedAt/);
    assert.match(client, /event\.endsAt/);
    assert.match(client, /pulseVoteLedger/);
    assert.match(client, /event\.kind === 'expeditionStart'/);
    assert.match(client, /'targetRoleReveal', 'assassinPhase'/);
    assert.match(client, /model\.state\.presentations/);
    assert.doesNotMatch(client, /chat|聊天框|发言倒计时/);
    assert.match(style, /\.av-role-cover/);
    assert.match(style, /@keyframes avSceneCurtain/);
    assert.match(style, /\.avalon-app\.scene-expedition/);
    assert.match(style, /\.avalon-app\.is-identity-presentation \.av-role-column/);
    assert.match(style, /\.av-scene-transition\s*\{[\s\S]*pointer-events:\s*none/);
});

test('Avalon identity hold survives pointer edge cases and never keeps a stale faction accent', () => {
    const actionsSource = fs.readFileSync('public/games/avalon/actions.js', 'utf8')
        .replace('export function createAvalonActions', 'function createAvalonActions');
    const createActions = new Function(`${actionsSource}\nreturn createAvalonActions;`)();
    const model = {
        state: { myRole: 'merlin', phase: 'roleReveal' },
        roleRevealPointerId: null,
        roleRevealKey: null,
        roleIdentityVisible: false,
        hasViewedRole: false,
        teamDraft: new Set(),
    };
    const cover = {
        contains: target => target === cover,
        setPointerCapture: () => {},
        getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
    };
    const role = { querySelector: selector => selector === '[data-role-hold]' ? cover : null };
    const mount = {
        querySelector: selector => selector === '[data-role="role"]' ? role : null,
        querySelectorAll: () => [],
    };
    let visible = false;
    let hiddenCount = 0;
    const renderer = {
        setRoleIdentityVisible: value => { visible = value; model.roleIdentityVisible = value; if (value) model.hasViewedRole = true; },
        hideRoleIdentity: () => { visible = false; model.roleIdentityVisible = false; model.roleRevealPointerId = null; model.roleRevealKey = null; hiddenCount += 1; },
        renderDecision: () => {},
    };
    const rulesModal = { trapFocus: () => false, isOpen: () => false, setOpen: () => {} };
    const actions = createActions({ mount, model, renderer, rulesModal, send: () => {}, documentRef: { hidden: false } });
    const target = { closest: selector => selector === '[data-role-hold]' ? cover : null };
    actions.handlePointerDown({ target, pointerId: 11, pointerType: 'touch', button: 0, isPrimary: true, preventDefault: () => {} });
    assert.equal(visible, true);
    assert.equal(model.roleRevealPointerId, 11);
    actions.handlePointerOut({ target, pointerId: 11, clientX: 50, clientY: 50, relatedTarget: null });
    assert.equal(visible, true, '遮罩视觉隐藏触发的同区域 pointerout 不能立即封存身份');
    actions.handlePointerOut({ target, pointerId: 99, relatedTarget: null });
    assert.equal(visible, true, '不相关指针离开不能关闭当前身份牌');
    actions.handlePointerMove({ pointerId: 11, clientX: 101, clientY: 50 });
    assert.equal(visible, false, '当前指针移出身份牌后应立即封存');
    actions.handlePointerDown({ target, pointerId: 12, pointerType: 'touch', button: 0, isPrimary: true, preventDefault: () => {} });
    actions.handlePointerUp({ pointerId: 12 });
    assert.equal(visible, false, '窗口级 pointerup 应可靠封存身份');
    actions.handlePointerDown({ target, pointerId: 13, pointerType: 'touch', button: 0, isPrimary: true, preventDefault: () => {} });
    actions.handlePointerCancel({ pointerId: 13 });
    assert.equal(visible, false, '窗口级 pointercancel 应可靠封存身份');
    actions.handleKeydown({ target, key: ' ', repeat: false, preventDefault: () => {} });
    assert.equal(visible, true);
    assert.equal(model.roleRevealPointerId, null);
    actions.handleKeyup({ key: ' ' });
    assert.equal(visible, false);
    actions.handlePointerDown({ target, pointerId: 14, pointerType: 'touch', button: 0, preventDefault: () => {} });
    actions.handlePointerDown({ target, pointerId: 15, pointerType: 'touch', button: 0, preventDefault: () => {} });
    assert.equal(model.roleRevealPointerId, 14, '第二个触点不能抢占身份显示状态');
    actions.handlePointerUp({ pointerId: 14 });
    assert.equal(visible, false);
    actions.handlePointerDown({ target, pointerId: 16, pointerType: 'touch', button: 0, preventDefault: () => {} });
    actions.handleKeydown({ target, key: 'Enter', repeat: false, preventDefault: () => {} });
    assert.equal(model.roleRevealPointerId, 16, '键盘操作不能遗失正在进行的触摸封存状态');
    actions.handleKeyup({ key: 'Enter' });
    assert.equal(visible, false);
    assert.ok(hiddenCount >= 4);

    const renderSource = fs.readFileSync('public/games/avalon/render.js', 'utf8');
    const styleSource = ['style.css', 'scenes.css'].map(file => fs.readFileSync(`public/games/avalon/${file}`, 'utf8')).join('\n');
    assert.match(renderSource, /role\?\.classList\.toggle\('is-good', model\.roleIdentityVisible && faction === 'good'\)/);
    assert.match(renderSource, /role\?\.classList\.toggle\('is-evil', model\.roleIdentityVisible && faction === 'evil'\)/);
    assert.match(renderSource, /\$\('role'\)\.className = 'av-role social-role-focus';/);
    assert.match(styleSource, /\.av-role:not\(\.is-revealed\)\s*\{[\s\S]*--role-focus-accent/);
    assert.match(styleSource, /\.av-role\.is-revealed \.av-role-cover\s*\{[\s\S]*visibility:\s*visible/);
    assert.match(fs.readFileSync('public/games/avalon/actions.js', 'utf8'), /function pointerInsideCover\(/);
    const clientSource = fs.readFileSync('public/games/avalon/client.js', 'utf8');
    assert.match(clientSource, /message\.state\.phase !== 'roleReveal' \|\| viewChanged/);
});

test('Avalon keeps identity, progress and the current action in one restrained main stage', () => {
    const client = readFrontendSource('avalon');
    const style = ['style.css', 'scenes.css']
        .map(file => fs.readFileSync(`public/games/avalon/${file}`, 'utf8')).join('\n');
    assert.match(client, /class="av-main-stage av-private-action"/);
    assert.match(client, /class="av-role-column"/);
    assert.match(client, /class="av-play-column"/);
    assert.match(client, /class="av-progress-panel av-mission-board"/);
    assert.match(client, /class="av-action-panel"/);
    const records = client.match(/<details class="av-records"[^>]*>/)?.[0];
    assert.ok(records, '表决、战报与纪事应收进圆桌记录');
    assert.doesNotMatch(records, /\sopen(?:\s|=|>)/, '圆桌记录默认应折叠');
    assert.match(client, /<div class="av-role-copy"><strong>[\s\S]*?<p>\$\{escapeHtml\(meta\.copy\)\}<\/p>/);
    assert.match(client, /<div class="av-known">/);
    assert.match(style, /\.av-role-copy > p\s*\{[\s\S]*?display:\s*-webkit-box/);
    assert.match(style, /\.av-known\s*\{[\s\S]*?display:\s*grid/);
});
