/** Server-timed public scene queue for 阿瓦隆. */
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

export function avalonSceneKind(event = {}) {
    // Outcome styling follows the winning faction, never the viewer-specific
    // wording. In particular, an evil player's "您已获胜" must remain an
    // evil victory rather than inheriting the ordinary success treatment.
    if (event.kind === 'outcome') {
        if (event.outcome === 'abandoned' || !event.winnerFaction) return 'abandoned';
        return event.winnerFaction === 'evil' ? 'evil-victory' : 'good-victory';
    }
    return event.kind === 'identityBriefing'
        ? 'identity'
        : event.kind === 'playerLeft'
            ? 'rejected'
        : event.kind === 'teamVote'
            ? event.approved ? 'success' : 'rejected'
        : event.kind === 'missionResult'
            ? event.mission?.success ? 'success' : 'failure'
            : ['assassination', 'targetRoleReveal', 'assassinPhase'].includes(event.kind)
                ? 'assassin'
                : event.kind === 'identityReveal'
                    ? 'roundtable'
                    : event.kind === 'expeditionStart'
                        ? 'expedition'
                        : event.kind === 'leaderTransfer'
                            ? 'rejected'
                            : 'roundtable';
}

export function createAvalonScene({ mount, model, getElement, renderer, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let currentContentDeadline = Number.POSITIVE_INFINITY;
    const pulseTimers = new Set();

    function hideSceneTransition() {
        const element = $('sceneTransition');
        clearPresentationFade(element);
        element?.classList.add('is-hidden');
        element?.setAttribute('aria-hidden', 'true');
        mount.querySelector('.avalon-app')?.classList.remove('is-identity-presentation');
    }

    function showSceneTransition(kind, kicker, title, detail) {
        const element = $('sceneTransition');
        if (!element) return;
        clearPresentationFade(element);
        element.className = `av-scene-transition is-${kind}`;
        $('sceneKicker').textContent = kicker || '';
        $('sceneTitle').textContent = title || '';
        $('sceneDetail').textContent = detail || '';
        element.setAttribute('aria-hidden', 'false');
        mount.querySelector('.avalon-app')?.classList.toggle('is-identity-presentation', kind === 'identity');
    }

    function waitUntil(timestamp, token) {
        const wait = Number(timestamp) - Date.now();
        if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve(token === model.sceneToken);
        return new Promise(resolve => {
            const waiter = {
                timer: windowRef.setTimeout(() => {
                    model.sceneWaiters.delete(waiter);
                    resolve(token === model.sceneToken);
                }, wait),
                resolve,
            };
            model.sceneWaiters.add(waiter);
        });
    }

    function nextFrame() {
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        return new Promise(resolve => request(() => resolve()));
    }

    async function fadeThenHide(token) {
        const element = $('sceneTransition');
        beginPresentationFade(element);
        if (!await waitUntil(currentEventDeadline, token)) return false;
        hideSceneTransition();
        return true;
    }

    function pulseVoteLedger() {
        const element = mount.querySelector('.av-vote-ledger');
        if (!element) return;
        element.classList.remove('is-receiving');
        void element.offsetWidth;
        element.classList.add('is-receiving');
        const timer = windowRef.setTimeout(() => {
            pulseTimers.delete(timer);
            element.classList.remove('is-receiving');
        }, 900);
        pulseTimers.add(timer);
    }

    async function playEvent(event, token) {
        if (!event || Number(event.endsAt) <= Date.now()) return true;
        if (Number.isFinite(Number(event.startedAt)) && !await waitUntil(event.startedAt, token)) return false;
        if (token !== model.sceneToken) return false;
        currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.isFinite(currentEventDeadline)
            ? Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS)
            : Number.POSITIVE_INFINITY;
        showSceneTransition(avalonSceneKind(event), event.kicker, event.title, event.detail);
        if (event.kind === 'teamVote') pulseVoteLedger();
        await nextFrame();
        if (!await waitUntil(currentContentDeadline, token)) return false;
        return fadeThenHide(token);
    }

    async function runPresentationQueue() {
        if (model.scenePlaying) return;
        model.scenePlaying = true;
        const token = ++model.sceneToken;
        mount.querySelector('.avalon-app')?.classList.add('is-presentation-playing');
        renderer?.render?.();
        while (model.sceneQueue.length && token === model.sceneToken) {
            const batch = model.sceneQueue.shift();
            for (const event of batch?.events || []) {
                if (!await playEvent(event, token)) break;
            }
        }
        if (token !== model.sceneToken) return;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        hideSceneTransition();
        model.scenePlaying = false;
        mount.querySelector('.avalon-app')?.classList.remove('is-presentation-playing');
        renderer?.render?.();
    }

    function enqueuePresentation(batch) {
        if (!batch?.events?.length || (Number.isFinite(Number(batch.endsAt)) && Number(batch.endsAt) <= Date.now())) return;
        if (Number.isFinite(Number(batch.endsAt))) model.presentationLockedUntil = Math.max(model.presentationLockedUntil, Number(batch.endsAt));
        model.sceneQueue.push(batch);
        void runPresentationQueue();
    }

    // Compatibility helper for callers that enqueue one legacy scene directly.
    function enqueueScene(kind, kicker, title, detail, duration = 1400) {
        const startedAt = Date.now();
        enqueuePresentation({
            sequence: ++model.lastPresentationSequence,
            startedAt,
            endsAt: startedAt + duration + PRESENTATION_FADE_MS,
            events: [{ kind, kicker, title, detail, startedAt, endsAt: startedAt + duration + PRESENTATION_FADE_MS }],
        });
    }

    function stop() {
        model.sceneToken += 1;
        model.sceneQueue = [];
        model.sceneTimer = null;
        for (const waiter of model.sceneWaiters) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        model.sceneWaiters.clear();
        for (const timer of pulseTimers) windowRef.clearTimeout(timer);
        pulseTimers.clear();
        model.scenePlaying = false;
        model.presentationLockedUntil = 0;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        hideSceneTransition();
        mount.querySelector('.avalon-app')?.classList.remove('is-presentation-playing');
    }

    return {
        enqueuePresentation,
        enqueueScene,
        stop,
        pulseVoteLedger,
        isPlaying: () => model.scenePlaying || Date.now() < Number(model.presentationLockedUntil),
    };
}
