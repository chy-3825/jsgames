'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

class FakeClock {
    constructor(now = 1_000) { this.now = now; this.nextId = 1; this.timers = new Map(); }
    setTimeout(callback, delay = 0) { const id = this.nextId++; this.timers.set(id, { id, callback, at: this.now + Math.max(0, Number(delay) || 0) }); return id; }
    clearTimeout(id) { this.timers.delete(id); }
    async advanceTo(target) {
        while (true) {
            const timer = [...this.timers.values()].filter(item => item.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
            if (!timer) break;
            this.timers.delete(timer.id); this.now = timer.at; timer.callback();
            await Promise.resolve();
        }
        this.now = target;
        await Promise.resolve();
    }
}

class FakeClassList {
    constructor(owner) { this.owner = owner; this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); this.owner.syncClassName(); }
    remove(...names) { names.forEach(name => this.values.delete(name)); this.owner.syncClassName(); }
}

class FakeElement {
    constructor(name, clock, trace) { this.name = name; this.clock = clock; this.trace = trace; this._className = ''; this.classList = new FakeClassList(this); this.attributes = new Map(); this.textContent = ''; }
    set className(value) { this._className = String(value); this.classList.values = new Set(this._className.split(/\s+/).filter(Boolean)); this.trace.push({ type: 'className', element: this.name, value: this._className, at: this.clock.now }); }
    get className() { return this._className; }
    syncClassName() { this._className = [...this.classList.values].join(' '); this.trace.push({ type: 'className', element: this.name, value: this._className, at: this.clock.now }); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    get offsetWidth() { return 0; }
}

async function createHarness(start = 1_000) {
    const { createWitchTownScene } = await import('../public/games/witchtown/scene.js');
    const { createWitchTownModel } = await import('../public/games/witchtown/state.js');
    const clock = new FakeClock(start); const trace = [];
    const elements = Object.fromEntries(['scene', 'scene-kicker', 'scene-title', 'scene-detail'].map(role => [role, new FakeElement(role, clock, trace)]));
    const model = createWitchTownModel();
    const scene = createWitchTownScene({ mount: {}, model, getElement: role => elements[role], windowRef: { setTimeout: clock.setTimeout.bind(clock), clearTimeout: clock.clearTimeout.bind(clock), Date: { now: () => clock.now } } });
    return { clock, elements, model, scene, trace };
}

function stateWithEvents(events, now = 1_000) {
    return { gameEpoch: 'client-epoch', serverNow: now, presentations: [{ sequence: 1, transactionId: 'client-batch', startedAt: events[0].startedAt, endsAt: events.at(-1).endsAt, blocking: true, events }] };
}

test('猎巫镇客户端按服务器时间严格 FIFO，且同一时刻只显示一个场景', async () => {
    const { clock, scene, trace } = await createHarness();
    const events = [
        { eventId: 'e1', kind: 'dayStart', title: '第一幕', detail: '', startedAt: 1_000, endsAt: 1_820, contentDurationMs: 100, fadeOutMs: 720 },
        { eventId: 'e2', kind: 'victory', title: '第二幕', detail: '', startedAt: 1_820, endsAt: 2_640, contentDurationMs: 100, fadeOutMs: 720 },
    ];
    scene.queueStateScenes(null, stateWithEvents(events));
    assert.equal(trace.filter(item => item.type === 'className' && item.value.includes('is-active')).length, 1);
    assert.equal(trace.at(-1).at, 1_000);
    await clock.advanceTo(1_819);
    assert.equal(trace.some(item => item.type === 'className' && item.value.includes('is-town-victory')), false, '下一条场景不能提前显示');
    await clock.advanceTo(1_820);
    const active = trace.filter(item => item.type === 'className' && item.value.includes('is-active') && !item.value.includes('is-leaving'));
    assert.equal(active.length, 2);
    assert.equal(active.at(-1).at, 1_820);
    const firstHide = trace.findIndex(item => item.type === 'className' && item.value === 'witchtown-scene is-hidden' && item.at === 1_820);
    const secondShow = trace.findIndex(item => item === active.at(-1));
    assert.ok(firstHide >= 0 && firstHide < secondShow, '下一条场景必须在上一条隐藏后显示');
    await clock.advanceTo(2_640);
    assert.equal(scene.isPlaying(), false);
});

test('猎巫镇客户端重连时跳过过期槽位，只播放当前未结束槽位', async () => {
    const { clock, scene, elements } = await createHarness(1_500);
    const events = [
        { eventId: 'expired', kind: 'dayStart', title: '过期', detail: '', startedAt: 1_000, endsAt: 1_300, contentDurationMs: 100, fadeOutMs: 200 },
        { eventId: 'current', kind: 'victory', title: '当前', detail: '', startedAt: 1_300, endsAt: 1_820, contentDurationMs: 100, fadeOutMs: 200 },
        { eventId: 'future', kind: 'dayStart', title: '未来', detail: '', startedAt: 1_820, endsAt: 2_340, contentDurationMs: 100, fadeOutMs: 200 },
    ];
    scene.queueStateScenes(null, stateWithEvents(events, 1_500));
    assert.equal(elements['scene-title'].textContent, '当前');
    await clock.advanceTo(1_820);
    assert.equal(elements['scene-title'].textContent, '未来');
    await clock.advanceTo(2_340);
    assert.equal(scene.isPlaying(), false);
});

test('猎巫镇黎明样式优先使用播报自身的死亡标记', async () => {
    const safe = await createHarness();
    safe.model.state = { lastNightDeaths: ['stale-death'] };
    safe.scene.queueStateScenes(null, stateWithEvents([
        { eventId: 'safe', kind: 'nightResult', hasDeaths: false, title: '天亮了', startedAt: 1_000, endsAt: 1_820 },
    ]));
    assert.match(safe.elements.scene.className, /is-dawn-safe/);

    const death = await createHarness();
    death.model.state = { lastNightDeaths: [] };
    death.scene.queueStateScenes(null, stateWithEvents([
        { eventId: 'death', kind: 'nightResult', hasDeaths: true, title: '天亮了', startedAt: 1_000, endsAt: 1_820 },
    ]));
    assert.match(death.elements.scene.className, /is-dawn-death/);
});
