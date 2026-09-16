'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    toggle(name, force) {
        if (force === undefined) {
            if (this.values.has(name)) this.values.delete(name); else this.values.add(name);
        } else if (force) this.values.add(name); else this.values.delete(name);
    }
}

function createPresentationHarness({ voice = false, reducedMotion = true } = {}) {
    const visible = new Set();
    const starts = [];
    const hidden = [];
    let maxVisible = 0;
    let nextTimerId = 0;
    let now = 0;
    const timers = new Map();
    const utterances = [];

    function markLayer(layer, value) {
        if (value === 'false') {
            visible.add(layer.role); starts.push(layer.role);
            maxVisible = Math.max(maxVisible, visible.size);
        } else {
            visible.delete(layer.role); hidden.push(layer.role);
        }
            assert.ok(visible.size <= 1, `不允许的播报层重叠：${[...visible].join('、')}`);
    }

    function child(role, selector) {
        const state = { innerHTML: '', textContent: '', attrs: {} };
        return {
            get innerHTML() { return state.innerHTML; },
            set innerHTML(value) { state.innerHTML = value; },
            get textContent() { return state.textContent; },
            set textContent(value) { state.textContent = value; },
            setAttribute(name, value) {
                state.attrs[name] = value;
                if (role === 'transition' && selector.includes('transitionTitle') && name === 'aria-label' && value) starts.push(`title:${value}`);
                if (role === 'transition' && selector.includes('transitionResult') && name === 'aria-label' && value) starts.push(`result:${value}`);
            },
        };
    }

    function layer(role) {
        const state = { className: '', attrs: {} };
        const element = {
            role,
            classList: new FakeClassList(),
            querySelector(selector) { return child(role, selector); },
            set className(value) { state.className = value; },
            get className() { return state.className; },
            setAttribute(name, value) {
                state.attrs[name] = value;
                if (name === 'aria-hidden') markLayer(element, value);
            },
        };
        return element;
    }

    const transition = layer('transition');
    const elimination = layer('elimination');
    const app = { classList: new FakeClassList() };
    const mount = { querySelector(selector) { return selector === '.ww-app' ? app : null; } };
    const speechSynthesis = {
        cancelCount: 0,
        speak(utterance) { utterances.push(utterance); },
        cancel() { this.cancelCount += 1; },
    };
    class FakeUtterance {
        constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
    }
    const windowRef = {
        matchMedia() { return { matches: reducedMotion }; },
        setTimeout(callback, delay = 0) {
            const id = ++nextTimerId;
            timers.set(id, { callback, due: now + delay, id });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        ...(voice ? { speechSynthesis, SpeechSynthesisUtterance: FakeUtterance } : {}),
    };

    function runUntil(target) {
        while (true) {
            const next = [...timers.values()].sort((left, right) => left.due - right.due || left.id - right.id)[0];
            if (!next || next.due > target) break;
            timers.delete(next.id); now = next.due; next.callback();
        }
        now = target;
    }
    function runAll() { runUntil(Number.POSITIVE_INFINITY); }

    return {
        mount,
        getElement(role) { return role === 'transition' ? transition : role === 'elimination' ? elimination : null; },
        windowRef,
        utterances,
        starts,
        hidden,
        visible,
        get maxVisible() { return maxVisible; },
        runUntil,
        runAll,
        get now() { return now; },
    };
}

async function loadScene() {
    const scenePath = path.join(__dirname, '..', 'public', 'games', 'werewolf', 'scene.js');
    const statePath = path.join(__dirname, '..', 'public', 'games', 'werewolf', 'state.js');
    const [{ createWerewolfScene, WEREWOLF_SCENE_VISIBLE_MS, WEREWOLF_PRESENTATION_TIMING, werewolfPresentationDuration, werewolfPresentationAppearance }, { createWerewolfModel }] = await Promise.all([
        import(pathToFileURL(scenePath).href),
        import(pathToFileURL(statePath).href),
    ]);
    return { createWerewolfScene, createWerewolfModel, WEREWOLF_SCENE_VISIBLE_MS, WEREWOLF_PRESENTATION_TIMING, werewolfPresentationDuration, werewolfPresentationAppearance };
}

test('狼人杀播报只切换黑白幕布，并按阶段、平安、权力、揭晓和危险配色', async () => {
    const { werewolfPresentationAppearance: appearance } = await loadScene();
    assert.deepEqual(appearance('night', { kind: 'nightFalls' }), { backdrop: 'dark', tone: 'stage' });
    assert.deepEqual(appearance('day', { kind: 'nightDeaths', atomIndex: 0, displayText: '天亮了' }), { backdrop: 'light', tone: 'stage' });
    assert.deepEqual(appearance('day', { kind: 'nightDeaths', atomIndex: 1, displayText: '昨夜的死者是 5 号' }), { backdrop: 'dark', tone: 'danger' });
    assert.deepEqual(appearance('day', { kind: 'peacefulNight' }), { backdrop: 'light', tone: 'safe' });
    assert.deepEqual(appearance('event', { kind: 'sheriffElection' }), { backdrop: 'light', tone: 'authority' });
    assert.deepEqual(appearance('event', { kind: 'identityReveal' }), { backdrop: 'dark', tone: 'reveal' });
    assert.deepEqual(appearance('victory', { kind: 'outcome', winnerFaction: 'good' }), { backdrop: 'light', tone: 'authority' });
    assert.deepEqual(appearance('victory', { kind: 'outcome', winnerFaction: 'wolf' }), { backdrop: 'dark', tone: 'wolf' });
});

test('Werewolf uses readable presentation hold times for every bulletin type', async () => {
    const { WEREWOLF_SCENE_VISIBLE_MS, WEREWOLF_PRESENTATION_TIMING } = await loadScene();
    assert.deepEqual(WEREWOLF_SCENE_VISIBLE_MS, {
        atom: 1140,
        night: 1140,
        day: 1140,
        event: 1140,
        victory: 1600,
        elimination: 3600,
    });
    assert.deepEqual(WEREWOLF_PRESENTATION_TIMING, { fadeInMs: 240, holdMs: 900, fadeOutMs: 360 });
});

test('Werewolf gives long bulletin text extra reading time without changing the fade phases', async () => {
    const { werewolfPresentationDuration } = await loadScene();
    assert.equal(werewolfPresentationDuration('event', '警长竞选期间狼人自爆，本局警徽流失'), 1315);
    assert.equal(werewolfPresentationDuration('event', '很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长'), 1840);
    assert.equal(werewolfPresentationDuration('event', '任意内容', 2000), 2000);
});

test('Werewolf fades grouped title and detail independently without restarting the full backdrop', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness({ reducedMotion: false });
    const model = createWerewolfModel();
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, windowRef: harness.windowRef });

    scene.enqueueScene({ kind: 'day', data: { kind: 'sheriffSignup', presentation: 'sheriffDawn', title: '天亮了', text: '开始警长竞选' } });
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:天亮了']);
    assert.equal(model.sceneQueue.length, 1);
    assert.equal(harness.getElement('transition').classList.values.has('is-visible'), true, '每条原子播报都应重新触发淡入');

    harness.runUntil(2399);
    assert.equal(harness.visible.has('transition'), true, '第一条淡出尚未结束时仍应保持当前层');
    assert.equal(harness.getElement('transition').classList.values.has('is-atom-fading'), true, '阅读停留结束后文字才进入独立淡出');
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:天亮了']);
    harness.runUntil(2400);
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:天亮了', 'title:开始警长竞选']);
    assert.equal(harness.hidden.filter(item => item === 'transition').length, 0, '组内交接不应隐藏或重启整个背景层');
    harness.runAll();
    assert.equal(harness.hidden.filter(item => item === 'transition').length, 1);
    assert.equal(model.scenePlaying, false);
});

test('Werewolf serializes perspective-specific exits and puts the second night after deferred first-night words', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness();
    const model = createWerewolfModel();
    const sent = [];
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, send: payload => sent.push(payload), windowRef: harness.windowRef });
    const previous = { phase: 'sheriffCampaign', activeSeat: 4, announcement: null, publicEvents: [] };
    const next = {
        phase: 'nightPrelude',
        activeSeat: 4,
        publicEvents: [
            { id: 1, kind: 'sheriffSignup', presentation: 'sheriffDawn', title: '天亮了', text: '开始警长竞选' },
            { id: 2, kind: 'wolfSelfDestruct', title: '4 号玩家自爆', text: '', eliminatedSeats: [4], gateId: 'self-destruct-gate' },
            { id: 3, kind: 'elimination', title: '玩家出局', text: '4号已出局', eliminatedSeats: [4], presentation: 'silent' },
            { id: 4, kind: 'badgeTorn', title: '警徽流失', text: '警长竞选期间狼人自爆，本局警徽流失', presentation: 'silent' },
            { id: 5, kind: 'selfDestructWordsStart', title: '4 号玩家发表遗言', text: '', eliminatedSeats: [4], presentation: 'perspective', selfSeat: 4, selfText: '请您发表遗言', gateId: 'self-destruct-prompt-gate' },
            { id: 6, kind: 'nightDeaths', title: '昨夜结果', text: '昨夜的死者是 2 号', eliminatedSeats: [2] },
            { id: 7, kind: 'elimination', title: '玩家出局', text: '2号已出局', eliminatedSeats: [2] },
            { id: 8, kind: 'lastWordsStart', title: '首夜遗言', text: '2号开始首夜遗言' },
            { id: 9, kind: 'nightFalls', title: '天黑请闭眼', text: '', gateId: 'night-gate' },
        ],
    };

    scene.maybePlayTransition(previous, next);
    assert.equal(model.sceneQueue.some(item => item.kind === 'delay'), false);
    harness.runAll();
    assert.deepEqual(harness.starts.filter(item => item === 'elimination' || item.startsWith('title:')), [
        'title:天亮了', 'title:开始警长竞选',
        'title:4 号玩家自爆',
        'title:请您发表遗言',
        'title:昨夜结果', 'title:昨夜的死者是 2 号', 'title:2号已出局',
        'title:首夜遗言', 'title:2号开始首夜遗言',
        'title:天黑请闭眼',
    ]);
    assert.equal(harness.hidden.filter(item => item === 'transition').length, 7, '自爆狼视角保留一次专属遗言提示');
    assert.equal(harness.maxVisible, 1);
    assert.deepEqual(sent.map(payload => payload.action), [
        { kind: 'presentationComplete', gateId: 'self-destruct-gate' },
        { kind: 'presentationComplete', gateId: 'self-destruct-prompt-gate' },
        { kind: 'presentationComplete', gateId: 'night-gate' },
    ]);
    assert.equal(model.scenePlaying, false);
});

test('Werewolf serializes rapid full-screen broadcasts and never overlaps layers', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness();
    const model = createWerewolfModel();
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, windowRef: harness.windowRef });

    scene.enqueueScene({ kind: 'event', data: { kind: 'wolfSelfDestruct', title: '狼人自爆', text: '1号玩家自爆' } });
    scene.enqueueScene({ kind: 'elimination' });
    scene.enqueueScene({ kind: 'event', data: { kind: 'hunterShot', title: '枪声响起', text: '猎人开枪带走了2号' } });
    assert.equal(model.scenePlaying, true);
    assert.equal(model.sceneQueue.length, 4);
    assert.equal(harness.maxVisible, 1);

    harness.runAll();
    assert.equal(model.scenePlaying, false);
    assert.equal(model.activeScene, null);
    assert.deepEqual(model.sceneQueue, []);
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:狼人自爆', 'title:1号玩家自爆', 'title:枪声响起', 'title:猎人开枪带走了2号']);
    assert.equal(harness.starts.filter(item => item === 'elimination').length, 1);
    assert.equal(harness.visible.size, 0);
});

test('Werewolf waits for voice completion before starting the next broadcast', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness({ voice: true });
    const model = createWerewolfModel(); model.voiceEnabled = true;
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, windowRef: harness.windowRef });

    scene.enqueueScene({ kind: 'event', data: { kind: 'notice', title: '第一条', text: '第一条播报' } });
    scene.enqueueScene({ kind: 'event', data: { kind: 'notice', title: '第二条', text: '第二条播报' } });
    harness.runUntil(500);
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:第一条']);
    assert.equal(model.sceneQueue.length, 3);
    assert.equal(harness.utterances.length, 1);

    harness.utterances[0].onend();
    harness.runAll();
    assert.deepEqual(harness.starts.filter(item => item.startsWith('title:')), ['title:第一条', 'title:第一条播报', 'title:第二条', 'title:第二条播报']);
    assert.equal(model.scenePlaying, false);
    assert.ok(harness.windowRef.speechSynthesis.cancelCount >= 2);
});

test('Werewolf dawn broadcast uses the immutable night event when a delayed snapshot also contains a hunter shot', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness();
    const model = createWerewolfModel();
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, windowRef: harness.windowRef });
    const previous = { phase: 'nightSeer', activeSeat: 9, announcement: null, publicEvents: [] };
    const next = {
        phase: 'deathResolution',
        activeSeat: 9,
        // The current top-level announcement has already been extended by the
        // hunter shot.  It must not rewrite the earlier nightDeaths event.
        announcement: { day: 1, kind: 'night', deaths: [5, 1], peaceful: false, text: '天亮，5 号倒牌；猎人开枪，1 号一同出局' },
        publicEvents: [
            { id: 1, kind: 'nightDeaths', day: 1, title: '天亮了', text: '昨夜的死者是 5 号', eliminatedSeats: [5] },
            { id: 2, kind: 'elimination', day: 1, title: '玩家出局', text: '5 号已出局', eliminatedSeats: [5] },
            { id: 3, kind: 'hunterReveal', day: 1, title: '身份揭晓', text: '5 号的身份是猎人', eliminatedSeats: [5] },
            { id: 4, kind: 'hunterShot', day: 1, title: '枪声响起', text: '猎人开枪带走了 1 号', eliminatedSeats: [1] },
            { id: 5, kind: 'elimination', day: 1, title: '玩家出局', text: '1 号已出局', eliminatedSeats: [1] },
        ],
    };

    scene.maybePlayTransition(previous, next);
    harness.runAll();

    const titles = harness.starts.filter(item => item.startsWith('title:'));
    assert.equal(titles[0], 'title:天亮了');
    assert.equal(titles[1], 'title:昨夜的死者是 5 号');
    assert.doesNotMatch(titles[1], /1 号/);
    assert.deepEqual(titles, ['title:天亮了', 'title:昨夜的死者是 5 号', 'title:5 号已出局', 'title:身份揭晓', 'title:5 号的身份是猎人', 'title:枪声响起', 'title:猎人开枪带走了 1 号', 'title:1 号已出局']);
});

test('Werewolf queues the affected player exit after the causal bulletin and never overlaps layers', async () => {
    const { createWerewolfScene, createWerewolfModel } = await loadScene();
    const harness = createPresentationHarness({ voice: true });
    const model = createWerewolfModel();
    model.voiceEnabled = true;
    const scene = createWerewolfScene({ mount: harness.mount, model, getElement: harness.getElement, renderer: {}, windowRef: harness.windowRef });
    const previous = { phase: 'nightSeer', activeSeat: 5, announcement: null, publicEvents: [] };
    const next = {
        phase: 'deathResolution',
        activeSeat: 5,
        seats: [{ number: 5, alive: false }, { number: 7, alive: false }],
        eliminationNotice: { day: 2, seat: 5, source: 'night' },
        publicEvents: [
            { id: 1, kind: 'nightDeaths', day: 2, title: '天亮了', text: '昨夜的死者是 5、7 号', eliminatedSeats: [5, 7] },
            { id: 2, kind: 'elimination', day: 2, title: '玩家出局', text: '5 号已出局', eliminatedSeats: [5] },
            { id: 3, kind: 'elimination', day: 2, title: '玩家出局', text: '7 号已出局', eliminatedSeats: [7] },
        ],
    };

    scene.maybePlayTransition(previous, next);
    assert.equal(model.eliminatedSeat, 5);
    assert.equal(model.sceneQueue.length, 3, '死讯正文、本人出局槽和其他玩家公开出局槽必须依次排队');
    assert.equal(harness.visible.has('transition'), true);
    assert.equal(harness.visible.has('elimination'), false, '个人出局层不能覆盖正在播放的公共死讯');
    assert.equal(harness.utterances.length, 1, '当前只能有一条前台播报语音');
    harness.utterances[0].onend();

    harness.runAll();
    assert.equal(harness.starts.filter(item => item === 'elimination').length, 1);
    assert.deepEqual(harness.starts.filter(item => item === 'elimination' || item.startsWith('title:')), ['title:天亮了', 'title:昨夜的死者是 5、7 号', 'elimination', 'title:7 号已出局']);
    assert.equal(harness.maxVisible, 1);
});
