'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

class FakeClassList {
    constructor(owner) {
        this.owner = owner;
        this.values = new Set();
    }

    replaceFrom(value) {
        this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }

    sync() {
        this.owner._className = [...this.values].join(' ');
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
        this.sync();
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
        this.sync();
    }

    contains(name) {
        return this.values.has(name);
    }

    toggle(name, force) {
        const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
        if (enabled) this.values.add(name);
        else this.values.delete(name);
        this.sync();
        return enabled;
    }
}

class FakeStyle {
    setProperty(name, value) {
        this[name] = String(value);
    }

    removeProperty(name) {
        delete this[name];
    }
}

class FakeElement {
    constructor(name, clock, trace = []) {
        this.name = name;
        this.clock = clock;
        this.trace = trace;
        this.attributes = new Map();
        this.style = new FakeStyle();
        this.classList = new FakeClassList(this);
        this._className = '';
        this._innerHTML = '';
        this.hidden = false;
        this.dataset = {};
    }

    set className(value) {
        this._className = String(value || '');
        this.classList.replaceFrom(this._className);
        this.trace.push({ type: 'className', element: this.name, value: this._className, at: this.clock.now });
    }

    get className() {
        return this._className;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.trace.push({ type: 'innerHTML', element: this.name, value: this._innerHTML, at: this.clock.now });
    }

    get innerHTML() {
        return this._innerHTML;
    }

    get offsetWidth() {
        return 0;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    getBoundingClientRect() {
        return { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };
    }
}

class FakeClock {
    constructor(now = 1_000, reducedMotion = false) {
        this.now = now;
        this.reducedMotion = reducedMotion;
        this.nextTimerId = 1;
        this.timers = new Map();
        // The production scene intentionally accepts the browser API as a
        // bare callback, so mirror requestAnimationFrame's bound host method.
        this.requestAnimationFrame = callback => this.setTimeout(() => callback(this.now), 16);
    }

    setTimeout(callback, delay = 0) {
        const id = this.nextTimerId++;
        this.timers.set(id, { id, callback, at: this.now + Math.max(0, Number(delay) || 0) });
        return id;
    }

    clearTimeout(id) {
        this.timers.delete(id);
    }

    matchMedia() {
        return { matches: this.reducedMotion, addEventListener() {}, removeEventListener() {} };
    }

    async settle() {
        for (let index = 0; index < 12; index += 1) await Promise.resolve();
    }

    nextDue(target) {
        return [...this.timers.values()]
            .filter(timer => timer.at <= target)
            .sort((left, right) => left.at - right.at || left.id - right.id)[0] || null;
    }

    async advanceTo(target) {
        assert.ok(target >= this.now, `fake clock cannot travel backwards (${this.now} -> ${target})`);
        await this.settle();
        let timer = this.nextDue(target);
        while (timer) {
            this.timers.delete(timer.id);
            this.now = timer.at;
            timer.callback();
            await this.settle();
            timer = this.nextDue(target);
        }
        this.now = target;
        await this.settle();
        timer = this.nextDue(target);
        while (timer) {
            this.timers.delete(timer.id);
            timer.callback();
            await this.settle();
            timer = this.nextDue(target);
        }
    }
}

function presentationBatch() {
    return {
        sequence: 1,
        transactionId: 'client-runtime-1',
        startedAt: 1_000,
        endsAt: 1_820,
        durationMs: 820,
        blocking: true,
        events: [
            {
                eventId: 1,
                sequence: 1,
                kind: 'gameStart',
                boardSize: 5,
                maxRounds: 12,
                startedAt: 1_000,
                endsAt: 1_410,
                contentDurationMs: 50,
                durationMs: 410,
            },
            {
                eventId: 2,
                sequence: 2,
                kind: 'roundReveal',
                round: 2,
                draft: [],
                remainingTileCount: 20,
                startedAt: 1_410,
                endsAt: 1_820,
                contentDurationMs: 50,
                durationMs: 410,
            },
        ],
    };
}

async function createHarness({ reducedMotion = false } = {}) {
    const { createKingdominoScene } = await import('../public/games/kingdomino/scene.js');
    const { createKingdominoModel } = await import('../public/games/kingdomino/state.js');
    const clock = new FakeClock(1_000, reducedMotion);
    const trace = [];
    const root = new FakeElement('root', clock, trace);
    root.className = 'kd-app';
    const layer = new FakeElement('presentationLayer', clock, trace);
    const stage = new FakeElement('presentationStage', clock, trace);
    const path = new FakeElement('actionPath', clock, trace);
    const elements = { presentationLayer: layer, presentationStage: stage, actionPath: path };
    const mount = new FakeElement('mount', clock, trace);
    mount.querySelector = selector => selector === '.kd-app' ? root : null;
    mount.querySelectorAll = () => [];
    const model = createKingdominoModel();
    model.state = { myId: 'a', players: [] };
    const scene = createKingdominoScene({
        mount,
        model,
        getElement: role => elements[role],
        windowRef: clock,
        getRender: () => () => {},
    });
    await clock.settle();
    return { clock, layer, model, scene, trace };
}

function activeScenes(trace) {
    return trace.filter(entry => entry.type === 'className'
        && entry.element === 'presentationLayer'
        && entry.value.includes('is-active'));
}

async function withFakeDate(run) {
    const realNow = Date.now;
    let harness;
    try {
        harness = await createHarness(run.options);
        Date.now = () => harness.clock.now;
        await run(harness);
    } finally {
        harness?.scene.destroy();
        Date.now = realNow;
    }
}

test('Kingdomino client runs absolute-time events in strict FIFO without overlap', { concurrency: false }, async () => {
    await withFakeDate(async ({ clock, scene, trace }) => {
        scene.enqueuePresentation(presentationBatch());
        await clock.settle();
        await clock.advanceTo(1_409);
        assert.deepEqual(activeScenes(trace).map(entry => [entry.at, entry.value]), [
            [1_000, 'kd-presentation-layer is-active is-game-start'],
        ]);

        await clock.advanceTo(1_410);
        const scenes = activeScenes(trace);
        assert.deepEqual(scenes.map(entry => [entry.at, entry.value]), [
            [1_000, 'kd-presentation-layer is-active is-game-start'],
            [1_410, 'kd-presentation-layer is-active is-round-reveal'],
        ]);
        const firstHide = trace.findIndex(entry => entry.type === 'className'
            && entry.element === 'presentationLayer'
            && entry.at === 1_410
            && entry.value === 'kd-presentation-layer');
        const secondShow = trace.findIndex(entry => entry === scenes[1]);
        assert.ok(firstHide >= 0 && firstHide < secondShow, 'the first scene must hide before the second scene is shown');

        await clock.advanceTo(1_820);
        assert.equal(scene.isPlaying(), false);
    });
});

test('skipPresentation skips only the current event and preserves the server lock', { concurrency: false }, async () => {
    await withFakeDate(async ({ clock, model, scene, trace }) => {
        scene.enqueuePresentation(presentationBatch());
        await clock.advanceTo(1_032);
        assert.equal(activeScenes(trace).at(-1).value.includes('is-game-start'), true);

        scene.skipPresentation();
        await clock.settle();
        assert.equal(model.presentationLockedUntil, 1_820);
        assert.equal(scene.isPlaying(), true);
        assert.equal(activeScenes(trace).some(entry => entry.value.includes('is-round-reveal')), false);

        await clock.advanceTo(1_410);
        assert.equal(activeScenes(trace).at(-1).value.includes('is-round-reveal'), true, 'the later event must remain queued');
        assert.equal(model.presentationLockedUntil, 1_820);
        assert.equal(scene.isPlaying(), true);

        await clock.advanceTo(1_820);
        assert.equal(scene.isPlaying(), false);
    });
});

test('prefers-reduced-motion does not shorten the absolute presentation timeline', { concurrency: false }, async () => {
    const run = async ({ clock, scene, trace }) => {
        scene.enqueuePresentation(presentationBatch());
        await clock.advanceTo(1_409);
        assert.equal(scene.isPlaying(), true);
        assert.equal(activeScenes(trace).length, 1);

        await clock.advanceTo(1_410);
        assert.equal(activeScenes(trace).at(-1).value.includes('is-round-reveal'), true);
        await clock.advanceTo(1_819);
        assert.equal(scene.isPlaying(), true);
        await clock.advanceTo(1_820);
        assert.equal(scene.isPlaying(), false);
    };
    run.options = { reducedMotion: true };
    await withFakeDate(run);
});

test('destroy is safe while the scene is between its two animation frames', { concurrency: false }, async () => {
    await withFakeDate(async ({ clock, layer, scene }) => {
        scene.enqueuePresentation({
            ...presentationBatch(),
            endsAt: 1_410,
            durationMs: 410,
            events: [presentationBatch().events[0]],
        });
        await clock.advanceTo(1_016);
        assert.doesNotThrow(() => scene.destroy());
        await clock.advanceTo(1_032);
        assert.equal(scene.isPlaying(), false);
        assert.equal(layer.hidden, true);
    });
});

test('events that expired before enqueue are omitted while future events still play', { concurrency: false }, async () => {
    await withFakeDate(async ({ clock, scene, trace }) => {
        const batch = presentationBatch();
        batch.startedAt = 500;
        batch.events[0] = { ...batch.events[0], startedAt: 500, endsAt: 900 };
        batch.events[1] = { ...batch.events[1], startedAt: 1_100, endsAt: 1_510 };
        batch.endsAt = 1_510;
        scene.enqueuePresentation(batch);
        await clock.advanceTo(1_100);
        const scenes = activeScenes(trace);
        assert.equal(scenes.some(entry => entry.value.includes('is-game-start')), false);
        assert.equal(scenes.at(-1).value.includes('is-round-reveal'), true);
    });
});
