import { CODE_LENGTH, escapeHtml } from './constants.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** End-of-case answer reveal and server-timed presentation queue for 猜数字. */
export function createGuessNumberScene({ mount, model, getElement, rulesModal, windowRef = globalThis.window || globalThis, renderer, onPresentationStart }) {
    const $ = role => getElement(role);
    const root = mount.querySelector('.gn-app');
    const setTimeoutRef = windowRef.setTimeout?.bind(windowRef) || setTimeout;
    const clearTimeoutRef = windowRef.clearTimeout?.bind(windowRef) || clearTimeout;

    model.presentationQueue ||= [];
    model.presentationWaiters ||= new Set();
    model.presentationLockedUntil ||= 0;

    let currentEvent = null;
    let currentEventDeadline = Number.POSITIVE_INFINITY;

    function showScene(html) {
        const layer = $('sceneLayer');
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.className = 'gn-scene-layer is-active';
        layer.setAttribute('aria-hidden', 'false');
        $('scene').innerHTML = html;
    }

    function hideScene() {
        const layer = $('sceneLayer');
        clearPresentationFade(layer);
        layer.className = 'gn-scene-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('scene').innerHTML = '';
        layer.hidden = true;
        currentEvent = null;
        model.presentationEvent = null;
    }

    function sceneDelay(duration, token) {
        const wait = model.reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                resolve(value) {
                    model.sceneWaiters.delete(waiter);
                    resolve(value);
                },
            };
            waiter.timer = setTimeoutRef(() => waiter.resolve(token === model.sceneToken), wait);
            model.sceneWaiters.add(waiter);
        });
    }

    function waitUntil(timestamp, token) {
        const wait = Number(timestamp) - Date.now();
        if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve(token === model.presentationToken);
        if (token !== model.presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                done: false,
                resolve(value) {
                    if (waiter.done) return;
                    waiter.done = true;
                    model.presentationWaiters.delete(waiter);
                    clearTimeoutRef(waiter.timer);
                    resolve(value);
                },
            };
            waiter.timer = setTimeoutRef(() => waiter.resolve(token === model.presentationToken), wait);
            model.presentationWaiters.add(waiter);
        });
    }

    function cancelPresentationWaiters() {
        for (const waiter of model.presentationWaiters) {
            clearTimeoutRef(waiter.timer);
            waiter.resolve(false);
        }
        model.presentationWaiters.clear();
    }

    function nextFrame() {
        const request = windowRef.requestAnimationFrame?.bind(windowRef) || (callback => setTimeoutRef(callback, 0));
        return new Promise(resolve => request(() => request(resolve)));
    }

    function revealScene() {
        const request = windowRef.requestAnimationFrame?.bind(windowRef) || (callback => setTimeoutRef(callback, 0));
        request(() => $('sceneLayer')?.classList.add('is-revealed'));
    }

    function eventDigits(event) {
        const value = event.secret || model.state?.secret || '';
        return String(value).padEnd(CODE_LENGTH, '?').slice(0, CODE_LENGTH).split('');
    }

    function settlementMarkup(event) {
        const result = event.lastResult || model.state?.lastResult || {};
        const attempts = Number(event.attempts || result.attempt || 0);
        const personal = event.viewerVariant === 'personalVictory';
        const title = personal ? (event.title || '您已获胜') : `${escapeHtml(event.winnerName || model.state?.winner?.name || '玩家')}成功破解密码`;
        const detail = personal ? (event.detail || '您成功破解了隐藏密码。') : '最终猜测与隐藏答案完全一致。';
        const digits = eventDigits(event);
        return `<span class="gn-scene-kicker">FINAL VERDICT</span><div class="gn-scene-score"><b>${Number(result.exact) === CODE_LENGTH ? CODE_LENGTH : 4}</b>A <i>${Number(result.misplaced) || 0}</i>B</div><h2>${title}</h2><p>${escapeHtml(detail)}</p><div class="gn-scene-code">${digits.map((digit, index) => `<span style="--gn-digit-order:${index}">${escapeHtml(digit)}</span>`).join('')}</div><div class="gn-scene-outcome"><span>破解完成</span><strong>${title}</strong><small>本案共尝试 ${attempts} 次</small></div>`;
    }

    function closureMarkup(event) {
        const personal = event.viewerVariant === 'personalClosure';
        const title = personal ? (event.title || '本局已中止') : '调查中止';
        const detail = personal ? (event.detail || '当前破解者已离线，档案已经封存。') : '当前破解者已离线，本局档案已封存。';
        return `<span class="gn-scene-kicker">INVESTIGATION CLOSED</span><div class="gn-scene-seal" aria-hidden="true">止</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>`;
    }

    function eventMarkup(event) {
        if (event.kind === 'finalClosure' || event.outcome === 'aborted') return closureMarkup(event);
        if (event.kind === 'finalSettlement') return settlementMarkup(event);
        return settlementMarkup(event);
    }

    function clearSkipFlag() {
        model.presentationSkipCurrent = false;
    }

    async function waitAndAddClass(timestamp, className, token) {
        if (Date.now() < Number(timestamp)) {
            const reached = await waitUntil(timestamp, token);
            if (!reached) return model.presentationSkipCurrent ? 'skipped' : false;
        }
        if (token !== model.presentationToken) return false;
        if (model.presentationSkipCurrent) return 'skipped';
        $('sceneLayer').classList.add(className);
        return true;
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return false;
        currentEvent = event;
        model.presentationEvent = event;
        const startedAt = Number.isFinite(Number(event.startedAt)) ? Number(event.startedAt) : Date.now();
        currentEventDeadline = Number.isFinite(Number(event.endsAt))
            ? Number(event.endsAt)
            : startedAt + (Number(event.durationMs) || 900 + PRESENTATION_FADE_MS);

        if (Date.now() < startedAt && !await waitUntil(startedAt, token)) {
            if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }
            return false;
        }
        if (token !== model.presentationToken) return false;
        if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }

        showScene(eventMarkup(event));
        revealScene();
        renderer?.render?.();
        await nextFrame();
        if (token !== model.presentationToken) return false;
        if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }

        if (event.kind === 'finalClosure' || event.outcome === 'aborted') {
            $('sceneLayer').classList.add('is-complete');
        } else {
            $('sceneLayer').classList.add('is-result');
            const contentDuration = Number(event.contentDurationMs) || Math.max(0, currentEventDeadline - startedAt - PRESENTATION_FADE_MS);
            const revealAt = startedAt + Math.min(500, Math.max(0, contentDuration * .2));
            const completeAt = startedAt + Math.min(1400, Math.max(0, contentDuration * .56));
            const revealed = await waitAndAddClass(revealAt, 'is-code-revealed', token);
            if (revealed === 'skipped') { clearSkipFlag(); hideScene(); return 'skipped'; }
            if (!revealed) return false;
            const complete = await waitAndAddClass(completeAt, 'is-complete', token);
            if (complete === 'skipped') { clearSkipFlag(); hideScene(); return 'skipped'; }
            if (!complete) return false;
        }

        if (token !== model.presentationToken) return false;
        const fadeAt = Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS);
        if (!await waitUntil(fadeAt, token)) {
            if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }
            return false;
        }
        if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }
        beginPresentationFade($('sceneLayer'));
        if (!await waitUntil(currentEventDeadline, token)) {
            if (model.presentationSkipCurrent) { clearSkipFlag(); hideScene(); return 'skipped'; }
            return false;
        }
        hideScene();
        renderer?.render?.();
        return true;
    }

    async function holdPresentationLock(token) {
        while (token === model.presentationToken && Date.now() < Number(model.presentationLockedUntil || 0)) {
            if (!await waitUntil(model.presentationLockedUntil, token)) return;
        }
        if (token !== model.presentationToken) return;
        model.presentationPlaying = false;
        root.classList.remove('is-scene-active');
        renderer?.render?.();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        onPresentationStart?.();
        root.classList.add('is-scene-active');
        renderer?.render?.();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const batch = model.presentationQueue.shift();
            for (const event of batch?.events || []) {
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                const played = await playPresentationEvent(event, token);
                if (played === false && token !== model.presentationToken) break;
            }
        }
        if (token !== model.presentationToken) return;
        currentEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        hideScene();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        root.classList.remove('is-scene-active');
        renderer?.render?.();
    }

    function enqueuePresentation(batch) {
        if (!batch?.events?.length) return;
        if (Number.isFinite(Number(batch.endsAt))) {
            if (Number(batch.endsAt) <= Date.now()) return;
            model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(batch.endsAt));
        }
        model.presentationQueue.push(JSON.parse(JSON.stringify(batch)));
        model.presentationQueue.sort((left, right) => Number(left.sequence) - Number(right.sequence));
        void runPresentationQueue();
    }

    function skipPresentation() {
        if (!model.presentationPlaying && !model.presentationQueue.length) return;
        if (!currentEvent) return;
        model.presentationSkipCurrent = true;
        cancelPresentationWaiters();
        hideScene();
        renderer?.render?.();
    }

    // ---------------------- 旧协议兼容场景 ----------------------

    async function playEndScene(finalState) {
        if (model.scenePlaying || model.presentationPlaying) return;
        model.scenePlaying = true;
        const token = ++model.sceneToken;
        root.classList.add('is-scene-active');
        rulesModal.setOpen(false);
        const winner = finalState.winner;
        const player = finalState.players?.find(candidate => candidate.id === winner?.id);
        const attempts = Number(player?.attempts || finalState.lastResult?.attempt || 0);
        if (!winner) {
            showScene('<span class="gn-scene-kicker">INVESTIGATION CLOSED</span><div class="gn-scene-seal" aria-hidden="true">止</div><h2>调查中止</h2><p>当前破解者已离线，本局档案已封存。</p>');
            windowRef.requestAnimationFrame?.(() => $('sceneLayer').classList.add('is-complete'));
            await sceneDelay(1200, token);
        } else {
            const digits = String(finalState.secret || '').padEnd(CODE_LENGTH, '?').slice(0, CODE_LENGTH).split('');
            showScene(`<span class="gn-scene-kicker">FINAL VERDICT</span><div class="gn-scene-score"><b>4</b>A <i>0</i>B</div><h2>密码破解</h2><p>最终猜测与隐藏答案完全一致。</p><div class="gn-scene-code">${digits.map((digit, index) => `<span style="--gn-digit-order:${index}">${escapeHtml(digit)}</span>`).join('')}</div><div class="gn-scene-outcome"><span>破解完成</span><strong>${escapeHtml(winner.name)}成功破解密码</strong><small>本案共尝试 ${attempts} 次</small></div>`);
            windowRef.requestAnimationFrame?.(() => $('sceneLayer').classList.add('is-result'));
            if (!await sceneDelay(500, token)) return;
            $('sceneLayer').classList.add('is-code-revealed');
            if (!await sceneDelay(900, token)) return;
            $('sceneLayer').classList.add('is-complete');
            if (!await sceneDelay(1100, token)) return;
        }
        if (token === model.sceneToken) {
            beginPresentationFade($('sceneLayer'));
            await sceneDelay(PRESENTATION_FADE_MS, token);
            if (token === model.sceneToken) hideScene();
        }
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    function skipScene() {
        if (model.presentationPlaying || model.presentationQueue.length || Date.now() < Number(model.presentationLockedUntil || 0)) return skipPresentation();
        if (!model.scenePlaying) return;
        model.sceneToken++;
        for (const waiter of model.sceneWaiters) { clearTimeoutRef(waiter.timer); waiter.resolve(false); }
        model.sceneWaiters.clear();
        hideScene();
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    function stop() {
        model.presentationToken++;
        model.presentationQueue = [];
        model.presentationSkipCurrent = false;
        cancelPresentationWaiters();
        currentEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        model.presentationEvent = null;
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        model.sceneToken++;
        for (const waiter of model.sceneWaiters) { clearTimeoutRef(waiter.timer); waiter.resolve(false); }
        model.sceneWaiters.clear();
        hideScene();
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
        renderer?.render?.();
    }

    return {
        playEndScene,
        enqueuePresentation,
        skipPresentation,
        skipScene,
        stop,
        destroy: stop,
        isPlaying: () => model.scenePlaying || model.presentationPlaying || model.presentationQueue.length > 0 || Date.now() < Number(model.presentationLockedUntil || 0),
    };
}
