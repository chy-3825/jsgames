#!/usr/bin/env node

/*
 * Fixed-seat, 12-player “主持人口述流程” acceptance run.
 *
 * Seats are deliberately not shuffled:
 *   1-4 狼人 · 5 预言家 · 6 女巫 · 7 猎人 · 8 守卫 · 9-12 平民
 *
 * The transcript uses ordinary text for private actions and parentheses for
 * public/personal presentation scenes.  The event collector mirrors the
 * Werewolf scene queue, so a public elimination is suppressed when its
 * causal night/exile/hunter/self-destruct event already announced the seat.
 */

'use strict';

const assert = require('node:assert/strict');
const WerewolfEngine = require('../server/games/werewolf/engine');

const ROLE_SEATS = Object.freeze({ wolves: [1, 2, 3, 4], seer: 5, witch: 6, hunter: 7, guard: 8, villagers: [9, 10, 11, 12] });
const RESULTS = [];
const GAME_CLOCKS = new WeakMap();

function players() {
    return Array.from({ length: 12 }, (_, index) => ({ id: `p${index + 1}`, name: `${index + 1}号` }));
}

function id(seat) { return `p${seat}`; }

function fixedGame(name, options = {}) {
    // A value close to one makes Fisher–Yates keep ROLE_SETS[12] unchanged.
    const clock = { now: 1000 };
    const game = new WerewolfEngine(name, players(), id(1), () => 0.999999, () => clock.now, {
        playerCount: 12,
        winCondition: 'edge',
        sheriffEnabled: false,
        witchSelfSave: 'firstNight',
        ...options,
    });
    assert.equal(game.start().success, true, `${name}: start failed`);
    assert.deepEqual(game.seats.map(seat => seat.role), [
        'werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard',
        'villager', 'villager', 'villager', 'villager',
    ], `${name}: roles are not fixed to the requested seats`);
    GAME_CLOCKS.set(game, clock);
    return game;
}

function append(state, text) {
    state.transcript.push(text);
}

function formatBallots(result) {
    const groups = new Map();
    (result?.ballots || []).forEach(ballot => {
        const key = ballot.targetSeat == null ? '弃权' : `${ballot.targetSeat}号`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(ballot.voterSeat);
    });
    if (!groups.size) return '本轮无票';
    return [...groups.entries()].map(([target, voters]) => target === '弃权' ? `${voters.join('、')}号弃权` : `${voters.join('、')}号→${target}`).join('；');
}

function eventText(event, game) {
    if (event.kind === 'nightFalls') return ['（天黑请闭眼）'];
    if (event.kind === 'sheriffSignup' && event.presentation === 'sheriffDawn') return ['（天亮了）', '（开始警长竞选）'];
    if (event.kind === 'nightDeaths') return event.dawnAnnounced ? [`（昨晚的死者是${event.eliminatedSeats.join('、')}号）`] : ['（天亮了）', `（昨晚的死者是${event.eliminatedSeats.join('、')}号）`];
    if (event.kind === 'peacefulNight') return event.dawnAnnounced ? ['（昨晚无人出局）'] : ['（天亮了）', '（昨晚无人出局）'];
    // Personal elimination is appended below for every affected device.  It
    // is intentionally not returned as a public event scene here.
    if (event.kind === 'elimination') return [];
    if (event.kind === 'hunterReveal') return [`（${event.eliminatedSeats[0]}号的身份是猎人）`];
    if (event.kind === 'hunterShot') return [`（猎人开枪击杀${event.eliminatedSeats[0]}号）`];
    if (event.kind === 'hunterPass') return [`（${event.text}）`];
    if (event.kind === 'wolfSelfDestruct') return [`（${event.text || event.title}）`];
    if (event.kind === 'selfDestructWordsStart') return [`（${event.title}）`];
    if (event.kind === 'exile' || event.kind === 'voteTie') return [`（${event.text}；票型：${formatBallots(game.lastVoteResult)}）`];
    if (event.kind === 'identityReveal') return [`（全员身份揭晓：${event.text}）`];
    return [`（${event.text}）`];
}

function causalSeats(event) {
    if (['nightDeaths', 'peacefulNight', 'exile', 'hunterShot', 'wolfSelfDestruct', 'hunterReveal'].includes(event.kind)) return new Set(event.eliminatedSeats || []);
    return new Set();
}

function observe(game, state) {
    const nextPhase = game.phase;
    const fresh = game.publicEvents.filter(event => event.id > state.lastEventId).sort((left, right) => left.id - right.id);
    const announced = new Set();
    const causalKinds = new Set(['nightDeaths', 'peacefulNight', 'exile', 'hunterShot', 'wolfSelfDestruct', 'hunterReveal']);
    fresh.forEach(event => {
        const causal = causalSeats(event);
        causal.forEach(seat => announced.add(seat));
        if (event.kind === 'elimination') {
            const seats = event.eliminatedSeats || [];
            seats.forEach(seat => {
                const historicalCause = game.publicEvents.some(previous => previous.id < event.id && causalKinds.has(previous.kind) && (previous.eliminatedSeats || []).includes(seat));
                if (!announced.has(seat) && !historicalCause) state.unexpectedPublicEliminations.push({ id: event.id, seat });
            });
        }
        eventText(event, game).forEach(line => append(state, line));
        (event.eliminatedSeats || []).forEach(seat => {
            if (event.kind === 'elimination') append(state, `（${seat}号：您已出局）`);
        });
        state.lastEventId = event.id;
    });
    if (game.winner && !state.winnerKey) {
        state.winnerKey = `${game.winner.faction}:${game.winner.reason}`;
        append(state, `（${game.winner.name}：${game.winner.text}）`);
    }
    state.phase = nextPhase;
}

function acknowledgeNight(state) {
    const game = state.game;
    if (game.phase !== 'nightPrelude' || !game.presentationGate) return;
    acknowledgePresentation(state);
}

function acknowledgePresentation(state) {
    const game = state.game;
    if (!game.presentationGate) return;
    // The browser no longer controls the gate with ACKs. Move the deterministic
    // harness clock to the server-assigned deadline and let the same system
    // pulse used by production rooms advance the shared timeline. This also
    // verifies that no viewer needs to be present for the slot to finish.
    const clock = GAME_CLOCKS.get(game);
    clock.now = Math.max(clock.now, Number(game.presentationGate.endsAt));
    const result = game.handleSystemTick();
    assert.equal(result?.success, true, `${game.roomId}: presentation did not reach its deadline`);
    observe(game, state);
}

function advanceNight(state) {
    const game = state.game;
    assert.ok(game.nightFlow?.deadlineAt != null, `${game.roomId}: missing 20-second night clock`);
    const clock = GAME_CLOCKS.get(game);
    clock.now = Math.max(clock.now + 20_000, game.nightFlow.deadlineAt);
    const result = game.handleSystemTick();
    assert.equal(result?.success, true, `${game.roomId}: night timer did not advance`);
    observe(game, state);
}

function makeObservedGame(name, options = {}) {
    const game = fixedGame(name, options);
    const state = { game, phase: game.phase, lastEventId: 0, winnerKey: '', transcript: [], unexpectedPublicEliminations: [] };
    for (let seat = 1; seat <= 12; seat += 1) {
        const result = game.handleAction(id(seat), { kind: 'confirmRole' });
        assert.equal(result.success, true, `${name}: ${seat}号确认身份失败`);
        append(state, `${seat}号：确认`);
        observe(game, state);
    }
    acknowledgeNight(state);
    return state;
}

function act(state, seat, action, label = JSON.stringify(action)) {
    const result = state.game.handleAction(id(seat), action);
    assert.equal(result.success, true, `${state.game.roomId}: ${seat}号 ${label}失败：${result.message}`);
    observe(state.game, state);
    return result;
}

function expectFailure(state, seat, action, pattern, label) {
    const result = state.game.handleAction(id(seat), action);
    assert.equal(result.success, false, `${state.game.roomId}: ${label} unexpectedly succeeded`);
    assert.match(result.message, pattern, `${state.game.roomId}: ${label} error copy changed`);
    observe(state.game, state);
}

function nightAction(state, seat, action, { advance = true } = {}) {
    // Wolves use the live ballot endpoint: their temporary votes remain
    // mutable until the shared 20-second window expires.  The staged
    // selection/confirmation flow is reserved for guard, witch and seer.
    if (state.game.phase === 'nightWolf' && state.game._seat(seat)?.role === 'werewolf') {
        act(state, seat, { kind: 'nightAction', ...action }, `wolf vote ${JSON.stringify(action)}`);
        if (advance) advanceNight(state);
        return;
    }
    act(state, seat, { kind: 'stageNightAction', ...action }, `stage ${JSON.stringify(action)}`);
    act(state, seat, { kind: 'confirmNightAction' }, 'confirm night action');
    if (seat === ROLE_SEATS.seer && state.game.phase === 'nightSeer' && state.game.getPlayerState(id(seat)).nightConfirmation?.stage === 'result') {
        act(state, seat, { kind: 'confirmSeerResult' }, 'confirm seer result');
    }
    if (advance) advanceNight(state);
}

function deadNightRole(state, seat) {
    act(state, seat, { kind: 'confirmDeadRole' }, 'confirm dead role');
    advanceNight(state);
}

function runNight(state, config = {}) {
    const game = state.game;
    acknowledgeNight(state);
    append(state, '主持人：守卫请睁眼。');
    if (game._seat(ROLE_SEATS.guard).alive) {
        if (config.guardTarget == null) {
            append(state, '8号守卫：空守。');
            nightAction(state, ROLE_SEATS.guard, { choice: 'pass' });
        } else {
            append(state, `8号守卫：守护${config.guardTarget}号`);
            nightAction(state, ROLE_SEATS.guard, { targetSeat: config.guardTarget });
        }
    } else deadNightRole(state, ROLE_SEATS.guard);

    const wolves = game.seats.filter(seat => seat.alive && seat.role === 'werewolf').map(seat => seat.number);
    append(state, `主持人：狼人请睁眼。${wolves.join('、')}号狼人进行袭击投票。`);
    const voteRounds = config.wolfVoteRounds || [Object.fromEntries(wolves.map(seat => [seat, config.wolfTarget]))];
    voteRounds.forEach((round, index) => {
        if (voteRounds.length > 1) append(state, `狼人：第${index + 1}轮选择${Object.values(round).join('、')}号。`);
        wolves.forEach(seat => {
            const targetSeat = round[seat] ?? config.wolfTarget;
            assert.ok(targetSeat != null, `${game.roomId}: wolf target missing`);
            nightAction(state, seat, { targetSeat }, { advance: false });
        });
        advanceNight(state);
    });

    append(state, '主持人：女巫请睁眼。');
    if (game._seat(ROLE_SEATS.witch).alive) {
        if (config.witchChoice === 'saveThenPass') {
            append(state, '6号女巫：尝试使用解药自救。');
            expectFailure(state, ROLE_SEATS.witch, { kind: 'stageNightAction', choice: 'save' }, /不允许女巫自救|仅允许女巫首夜自救/, '女巫自救限制');
            append(state, '6号女巫：改为不使用药物。');
            nightAction(state, ROLE_SEATS.witch, { choice: 'pass' });
        } else if (config.witchChoice === 'save') {
            append(state, `6号女巫：使用解药救${game.night.wolf}号。`);
            nightAction(state, ROLE_SEATS.witch, { choice: 'save' });
        } else if (config.witchChoice === 'poison') {
            append(state, `6号女巫：对${config.poisonTarget}号使用毒药。`);
            nightAction(state, ROLE_SEATS.witch, { choice: 'poison', targetSeat: config.poisonTarget });
        } else {
            append(state, '6号女巫：不使用药物。');
            nightAction(state, ROLE_SEATS.witch, { choice: 'pass' });
        }
    } else deadNightRole(state, ROLE_SEATS.witch);

    append(state, '主持人：预言家请睁眼。');
    if (game._seat(ROLE_SEATS.seer).alive) {
        const target = config.seerTarget || game.seats.find(seat => seat.alive && seat.number !== ROLE_SEATS.seer)?.number;
        append(state, `5号预言家：查验${target}号。`);
        nightAction(state, ROLE_SEATS.seer, { targetSeat: target });
    } else deadNightRole(state, ROLE_SEATS.seer);
    if (game.presentationGate) acknowledgePresentation(state);
    assert.ok(['deathResolution', 'lastWords', 'day', 'sheriffPrelude', 'sheriffSignup', 'nightGuard', 'ended'].includes(game.phase), `${game.roomId}: night did not resolve (${game.phase})`);
}

function settleDeath(state, { hunterChoice = 'pass', hunterTarget = null, badgeChoice = 'tear', badgeTarget = null } = {}) {
    const game = state.game;
    let guard = 0;
    while (game.phase === 'deathResolution' && guard++ < 50) {
        if (game.pendingHunter) {
            const hunter = game.pendingHunter.seat;
            if (hunterChoice === 'shoot') {
                append(state, `${hunter}号猎人选择${hunterTarget}号。`);
                act(state, hunter, { kind: 'hunterAction', choice: 'shoot', targetSeat: hunterTarget }, 'hunter shoot');
            } else {
                append(state, `${hunter}号猎人选择不开枪。`);
                act(state, hunter, { kind: 'hunterAction', choice: 'pass' }, 'hunter pass');
            }
            continue;
        }
        if (game.pendingBadge) {
            const sheriff = game.pendingBadge.seat;
            if (badgeChoice === 'transfer') {
                const target = badgeTarget || game.seats.find(seat => seat.alive && seat.number !== sheriff)?.number;
                append(state, `${sheriff}号警长将警徽移交给${target}号。`);
                act(state, sheriff, { kind: 'sheriffBadgeAction', choice: 'transfer', targetSeat: target }, 'badge transfer');
            } else {
                append(state, `${sheriff}号警长撕毁警徽。`);
                act(state, sheriff, { kind: 'sheriffBadgeAction', choice: 'tear' }, 'badge tear');
            }
            continue;
        }
        const unresolved = game.deathResolution?.seats.find(seat => !game.deathResolution.settledSeats[seat]);
        if (unresolved == null) break;
        append(state, `${unresolved}号完成离场确认。`);
        act(state, unresolved, { kind: 'confirmDeathResolution' }, 'death resolution');
    }
    assert.ok(guard < 50, `${game.roomId}: death resolution loop`);
}

function finishLastWords(state) {
    const game = state.game;
    if (game.phase !== 'lastWords') return;
    if (!game.lastWordsFlow) {
        if (game.presentationGate) acknowledgePresentation(state);
        return;
    }
    // A self-destruct flow has two server-owned visual barriers before the
    // 30-second turn is opened.  Oral mode acknowledges both without changing
    // the production browser's absolute-time behavior.
    while (game.presentationGate && game.lastWordsFlow && !game.lastWordsFlow.turn) acknowledgePresentation(state);
    if (!game.lastWordsFlow) return;
    for (const seat of game.lastWordsFlow.order.slice()) {
        append(state, `${seat}号：遗言结束。`);
        while (game.presentationGate && game.lastWordsFlow && !game.lastWordsFlow.turn) acknowledgePresentation(state);
        if (!game.lastWordsFlow?.turn) act(state, seat, { kind: 'startLastWords' }, 'start last words');
        act(state, seat, { kind: 'finishLastWords', text: `${seat}号遗言` }, 'finish last words');
        if (game.presentationGate && !game.lastWordsFlow) acknowledgePresentation(state);
    }
}

function finishDaySpeech(state) {
    const game = state.game;
    assert.equal(game.phase, 'day', `${game.roomId}: expected day speech, got ${game.phase}`);
    for (const seat of game.speechFlow.order.slice()) {
        append(state, `${seat}号：白天发言结束。`);
        act(state, seat, { kind: 'startSpeech' }, 'start speech');
        act(state, seat, { kind: 'finishSpeech' }, 'finish speech');
    }
    assert.equal(game.phase, 'vote', `${game.roomId}: speech did not reach vote`);
}

function voteAll(state, target, excluded = []) {
    const game = state.game;
    const excludedSet = new Set(excluded);
    const voters = game.seats.filter(seat => seat.alive && !excludedSet.has(seat.number)).map(seat => seat.number);
    voters.forEach(seat => {
        append(state, `${seat}号投${target}号。`);
        act(state, seat, { kind: 'vote', targetSeat: target }, 'day vote');
    });
}

function finishSheriffSignup(state, choices) {
    const game = state.game;
    assert.equal(game.phase, 'sheriffSignup', `${game.roomId}: expected sheriff signup, got ${game.phase}`);
    const hiddenEligible = game.seats.filter(seat => seat.alive || game.pendingNightResult?.deaths?.includes(seat.number));
    hiddenEligible.forEach(seat => {
        const choice = choices[seat.number] || 'skip';
        append(state, `${seat.number}号：${choice === 'run' ? '上警' : '不上警'}。`);
        act(state, seat.number, { kind: 'sheriffSignup', choice }, 'sheriff signup');
    });
}

function finishSheriffCampaign(state, choices = {}) {
    const game = state.game;
    assert.equal(game.phase, 'sheriffCampaign', `${game.roomId}: expected sheriff campaign, got ${game.phase}`);
    for (const seat of game.sheriff.candidates.slice()) {
        const choice = choices[seat] || 'stay';
        append(state, `${seat}号：警上发言${choice === 'withdraw' ? '后退水' : '后继续竞选'}。`);
        act(state, seat, { kind: 'finishSheriffCampaign', choice }, 'sheriff campaign');
    }
}

function finishSheriffVote(state, targetBySeat) {
    const game = state.game;
    assert.ok(['sheriffVote', 'sheriffRunoffVote'].includes(game.phase), `${game.roomId}: expected sheriff vote, got ${game.phase}`);
    const voters = game._sheriffEligibleVoters().map(seat => seat.number);
    voters.forEach(seat => {
        const target = targetBySeat?.[seat] ?? targetBySeat?.default ?? game._currentSheriffCandidates()[0];
        append(state, `${seat}号投警长${target}号。`);
        act(state, seat, { kind: 'sheriffVote', targetSeat: target }, 'sheriff vote');
    });
}

function finishSheriffRunoffSpeech(state) {
    const game = state.game;
    assert.equal(game.phase, 'sheriffRunoffSpeech', `${game.roomId}: expected sheriff runoff speech, got ${game.phase}`);
    for (const seat of game.sheriff.runoffCandidates.slice()) {
        append(state, `${seat}号：警长 PK 发言结束。`);
        act(state, seat, { kind: 'finishSheriffRunoffSpeech' }, 'sheriff runoff speech');
    }
}

function finishKeyFlow(state, config = {}) {
    // Finish a first-night death, including first-night last words.  A
    // sheriff-phase self-destruct has one extra step: the bomber's 30-second
    // statement completes before the night curtain reveals the pending death,
    // so loop until both private resolution and words are settled.
    let guard = 0;
    while (guard++ < 8 && ['deathResolution', 'lastWords'].includes(state.game.phase)) {
        if (state.game.phase === 'deathResolution') settleDeath(state, config.death);
        if (state.game.phase === 'lastWords') finishLastWords(state);
    }
    assert.ok(guard < 8, `${state.game.roomId}: first-night settlement loop`);
    acknowledgeNight(state);
}

function finishDayWithExile(state, target) {
    finishDaySpeech(state);
    voteAll(state, target);
    settleDeath(state);
    if (state.game.phase === 'lastWords') finishLastWords(state);
}

function report(state, number, title, expectedKinds = []) {
    const kinds = state.game.publicEvents.map(event => event.kind);
    expectedKinds.forEach(kind => assert.ok(kinds.includes(kind), `${title}: missing event ${kind}`));
    assert.deepEqual(state.unexpectedPublicEliminations, [], `${title}: duplicate public elimination would be shown`);
    RESULTS.push({ number, title, phase: state.game.phase, kinds, alive: state.game.seats.filter(seat => seat.alive).map(seat => seat.number), transcript: state.transcript.slice() });
}

// 1. Standard no-kill night, then four clean daytime wolf exiles to exercise
// the repeated day → night loop and the final identity/victory scenes.
{
    const state = makeObservedGame('global-01', { sheriffEnabled: false });
    runNight(state, { guardTarget: 9, wolfTarget: 9, witchChoice: 'pass', seerTarget: 1 });
    finishKeyFlow(state);
    for (const wolf of [1, 2, 3, 4]) {
        if (state.game.phase === 'nightPrelude') acknowledgeNight(state);
        if (state.game.phase === 'nightGuard') runNight(state, { guardTarget: 10, wolfTarget: 10, witchChoice: 'pass', seerTarget: 1 });
        if (state.game.phase !== 'day') break;
        finishDaySpeech(state); voteAll(state, wolf); settleDeath(state);
        if (state.game.phase === 'lastWords') finishLastWords(state);
        if (state.game.phase === 'nightPrelude') acknowledgeNight(state);
        if (state.game.phase === 'nightGuard') {
            const guardTarget = [10, 11, 12][[1, 2, 3].indexOf(wolf)] || 10;
            runNight(state, { guardTarget, wolfTarget: guardTarget, witchChoice: 'pass' });
            finishKeyFlow(state);
        }
    }
    report(state, 1, '标准首夜平安、白天循环与好人胜利', ['peacefulNight', 'exile', 'identityReveal']);
}

// 2. Same guard + antidote (奶穿): the protected target still dies.
{
    const state = makeObservedGame('global-02');
    runNight(state, { guardTarget: 9, wolfTarget: 9, witchChoice: 'save', seerTarget: 1 });
    finishKeyFlow(state);
    finishDayWithExile(state, 1);
    report(state, 2, '同守同救（奶穿）', ['nightDeaths', 'elimination', 'exile', 'speechStart']);
}

// 3. Guard only blocks the wolf attack; poison independently kills its target.
{
    const state = makeObservedGame('global-03');
    runNight(state, { guardTarget: 9, wolfTarget: 10, witchChoice: 'poison', poisonTarget: 9, seerTarget: 1 });
    finishKeyFlow(state);
    finishDayWithExile(state, 1);
    report(state, 3, '守毒独立结算的双死', ['nightDeaths', 'elimination', 'exile', 'speechStart']);
}

// 4. Wolf kills the witch on night one; this board explicitly forbids self-save.
{
    const state = makeObservedGame('global-04', { witchSelfSave: 'never' });
    runNight(state, { guardTarget: 9, wolfTarget: ROLE_SEATS.witch, witchChoice: 'saveThenPass', seerTarget: 1 });
    finishKeyFlow(state);
    finishDayWithExile(state, 1);
    report(state, 4, '首日刀女巫且女巫不能自救', ['nightDeaths', 'elimination', 'exile', 'speechStart']);
}

// 5. The hidden first-night victim (9) runs for sheriff, campaigns, wins, then
// transfers the badge after the delayed dawn announcement.
{
    const state = makeObservedGame('global-05', { sheriffEnabled: true });
    runNight(state, { guardTarget: 10, wolfTarget: 9, witchChoice: 'pass', seerTarget: 1 });
    finishSheriffSignup(state, { 9: 'run', 10: 'run' });
    finishSheriffCampaign(state);
    finishSheriffVote(state, { default: 9 });
    assert.equal(state.game.phase, 'deathResolution');
    settleDeath(state, { badgeChoice: 'transfer', badgeTarget: 12 });
    finishLastWords(state);
    finishDayWithExile(state, 1);
    report(state, 5, '首日死者上警并处理警徽', ['sheriffSignup', 'sheriffCandidates', 'sheriffSpeechStart', 'sheriffVote', 'sheriffElection', 'nightDeaths', 'badgeTransfer', 'exile', 'speechStart']);
}

// 6. Wolf team self-targets a teammate at night (wolf self-knife/team knife).
{
    const state = makeObservedGame('global-06');
    runNight(state, { guardTarget: 9, wolfTarget: 2, witchChoice: 'pass', seerTarget: 1 });
    finishKeyFlow(state);
    finishDayWithExile(state, 1);
    report(state, 6, '狼人夜间刀队友', ['nightDeaths', 'elimination', 'exile', 'speechStart']);
}

// 7. Daytime self-destruct: immediate public self-destruct, personal exit,
// the official 30-second self-destruct statement, then night.
{
    const state = makeObservedGame('global-07');
    runNight(state, { guardTarget: 9, wolfTarget: 9, witchChoice: 'pass', seerTarget: 1 });
    finishKeyFlow(state);
    // Self-destruct is legal during the speaking phase (before the vote).
    const firstSpeaker = state.game.speechFlow.order[0];
    append(state, `${firstSpeaker}号：开始白天发言。`);
    act(state, firstSpeaker, { kind: 'startSpeech' }, 'start day speech');
    append(state, '1号狼人：发动自爆。');
    act(state, 1, { kind: 'wolfSelfDestruct' }, 'wolf self destruct');
    finishLastWords(state);
    acknowledgeNight(state);
    report(state, 7, '白天狼人自爆', ['wolfSelfDestruct', 'elimination']);
}

// 8. Sheriff-signup self-destruct while first-night deaths are still hidden.
{
    const state = makeObservedGame('global-08', { sheriffEnabled: true });
    runNight(state, { guardTarget: 10, wolfTarget: 9, witchChoice: 'pass', seerTarget: 1 });
    append(state, '1号狼人：在上警阶段发动自爆。');
    act(state, 1, { kind: 'wolfSelfDestruct' }, 'sheriff-phase self destruct');
    finishKeyFlow(state);
    report(state, 8, '警上狼人自爆并延期警长竞选', ['sheriffSignup', 'wolfSelfDestruct', 'sheriffDeferred', 'nightDeaths', 'elimination', 'selfDestructWordsStart', 'lastWordsStart']);
}

// 9. Hunter is killed by the wolf, reveals, shoots wolf 1, and both personal
// elimination scenes remain in the same causal chain.
{
    const state = makeObservedGame('global-09');
    runNight(state, { guardTarget: 9, wolfTarget: ROLE_SEATS.hunter, witchChoice: 'pass', seerTarget: 1 });
    settleDeath(state, { hunterChoice: 'shoot', hunterTarget: 1 });
    finishLastWords(state);
    finishDayWithExile(state, 2);
    report(state, 9, '猎人被刀后开枪', ['nightDeaths', 'hunterReveal', 'hunterShot', 'elimination', 'exile', 'speechStart']);
}

// 10. Poisoned hunter has no legal shot, then the first daytime vote ties,
// PK speeches run, and the second vote ties again (no exile).
{
    const state = makeObservedGame('global-10');
    runNight(state, { guardTarget: 9, wolfTarget: 10, witchChoice: 'poison', poisonTarget: 7, seerTarget: 1 });
    settleDeath(state, { hunterChoice: 'pass' });
    finishLastWords(state);
    finishDaySpeech(state);
    for (const seat of state.game.seats.filter(item => item.alive).map(item => item.number)) {
        const target = seat % 2 ? 1 : 2;
        append(state, `${seat}号投${target}号。`);
        act(state, seat, { kind: 'vote', targetSeat: target }, 'first vote');
    }
    assert.equal(state.game.phase, 'dayRunoffSpeech');
    for (const seat of state.game.runoffSpeechFlow.order.slice()) {
        append(state, `${seat}号：放逐 PK 发言结束。`);
        act(state, seat, { kind: 'startRunoffSpeech' }, 'start exile PK speech');
        act(state, seat, { kind: 'finishRunoffSpeech' }, 'finish exile PK speech');
    }
    const runoffVoters = state.game.seats.filter(item => item.alive && !state.game.dayTieTargets.includes(item.number)).map(item => item.number);
    runoffVoters.forEach(seat => {
        const target = seat % 2 ? 1 : 2;
        append(state, `${seat}号投${target}号。`);
        act(state, seat, { kind: 'vote', targetSeat: target }, 'runoff vote');
    });
    assert.equal(state.game.publicEvents.some(event => event.kind === 'hunterReveal' || event.kind === 'hunterPass'), false, '毒猎不应出现猎人揭示或不开枪播报');
    report(state, 10, '毒猎无枪与白天二轮平票', ['nightDeaths', 'voteTie', 'voteRunoffSpeech', 'voteRunoffSpeechStart']);
}

RESULTS.forEach(result => {
    console.log(`\n=== ${result.number}. ${result.title} ===`);
    console.log(result.transcript.join(' '));
    console.log(`STATE phase=${result.phase}; events=${result.kinds.join(' → ')}; alive=${result.alive.join(',')}`);
});
console.log(`\nGLOBAL_ORAL_SIM_PASS ${RESULTS.length}/10`);
