/** Server-timed public scene queue for 猎巫镇. Personal slots may say “您已出局” or “您已获胜”. */
export function createWitchTownScene({ mount, model, getElement, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement ? getElement(role) : mount.querySelector(`[data-role="${role}"]`);
    const scene = $('scene');
    const schedule = (callback, delay) => (windowRef?.setTimeout || globalThis.setTimeout)(callback, Math.max(0, delay));
    const cancel = timer => (windowRef?.clearTimeout || globalThis.clearTimeout)(timer);
    const localNow = () => {
        const clock = windowRef?.Date?.now || globalThis.Date?.now;
        const value = typeof clock === 'function' ? Number(clock.call(windowRef.Date || globalThis.Date)) : Date.now();
        return Number.isFinite(value) ? value : Date.now();
    };
    const serverNow = () => localNow() + (Number(model.presentationClockOffset) || 0);
    const timed = item => Number.isFinite(Number(item?.startedAt)) && Number.isFinite(Number(item?.endsAt));

    function clearTimer(name) {
        if (model[name] != null) cancel(model[name]);
        model[name] = null;
    }

    function enqueueScene(item) {
        if (!item) return;
        model.sceneQueue.push(item);
        model.sceneQueue.sort((left, right) => {
            const leftStart = Number.isFinite(Number(left.startedAt)) ? Number(left.startedAt) : Number.MAX_SAFE_INTEGER;
            const rightStart = Number.isFinite(Number(right.startedAt)) ? Number(right.startedAt) : Number.MAX_SAFE_INTEGER;
            return leftStart - rightStart;
        });
        if (!model.scenePlaying && !model.sceneStartTimer) playNextScene();
    }

    function finishScene() {
        clearTimer('sceneTimer');
        if (scene) {
            scene.className = 'witchtown-scene is-hidden';
            scene.setAttribute('aria-hidden', 'true');
        }
        model.scenePlaying = false;
        model.activeScene = null;
        playNextScene();
    }

    function beginScene(item) {
        if (!scene) {
            model.scenePlaying = false;
            model.activeScene = null;
            playNextScene();
            return;
        }
        model.scenePlaying = true;
        model.activeScene = item;
        clearTimer('sceneTimer');
        scene.className = `witchtown-scene is-${item.kind || 'verdict'} ${item.persistent ? 'is-persistent' : ''}`;
        scene.setAttribute('aria-hidden', 'false');
        $('scene-kicker').textContent = item.kicker || '';
        $('scene-title').textContent = item.title || '';
        $('scene-detail').textContent = item.detail || '';
        void scene.offsetWidth;
        scene.classList.add('is-active');
        if (item.persistent) return;

        if (timed(item)) {
            const remaining = Math.max(0, Number(item.endsAt) - serverNow());
            const fadeOutMs = Number(item.fadeOutMs) > 0 ? Number(item.fadeOutMs) : 720;
            model.sceneTimer = schedule(() => dismissScene(false), Math.max(0, remaining - fadeOutMs));
        } else {
            // Keep the old local fallback for snapshots from older clients.
            const duration = item.duration || 1400;
            model.sceneTimer = schedule(() => dismissScene(false), duration);
        }
    }

    function playNextScene() {
        if (model.scenePlaying || model.sceneStartTimer) return;
        let item = null;
        while (model.sceneQueue.length) {
            const candidate = model.sceneQueue.shift();
            if (timed(candidate)) {
                const now = serverNow();
                if (Number(candidate.endsAt) <= now) continue;
                if (Number(candidate.startedAt) > now) {
                    model.sceneQueue.unshift(candidate);
                    model.sceneStartTimer = schedule(() => {
                        model.sceneStartTimer = null;
                        playNextScene();
                    }, Number(candidate.startedAt) - now);
                    return;
                }
            }
            item = candidate;
            break;
        }
        if (!item) {
            model.scenePlaying = false;
            model.activeScene = null;
            return;
        }
        beginScene(item);
    }

    function dismissScene(shatter = false) {
        if (!model.scenePlaying || !scene) return;
        clearTimer('sceneTimer');
        scene.classList.add(shatter ? 'is-shattering' : 'is-leaving');
        const active = model.activeScene;
        const exitDuration = shatter ? 1050 : 720;
        const remaining = timed(active) ? Math.max(0, Number(active.endsAt) - serverNow()) : exitDuration;
        const fadeOutMs = Number(active?.fadeOutMs) > 0 ? Number(active.fadeOutMs) : exitDuration;
        model.sceneTimer = schedule(finishScene, timed(active) ? Math.min(remaining, fadeOutMs) : exitDuration);
    }

    function eventSceneKind(event) {
        return event.kind === 'nightfall' || ['blackCatChoice', 'witchesComplete', 'constableStart', 'constableComplete', 'constableSkipped', 'confessionStart'].includes(event.kind) ? 'night'
            : ['conspiracyStart', 'conspiracyComplete', 'conspiracyAdjusted', 'dossierReview', 'dossierConfirmed'].includes(event.kind) ? 'conspiracy'
                : event.kind === 'trialReveal' ? event.trialType === 'witch' ? 'trial-witch' : 'trial'
                    : event.kind === 'nightResult' ? (event.hasDeaths ?? Boolean((model.state?.lastNightDeaths || []).length)) ? 'dawn-death' : 'dawn-safe'
                        : event.kind === 'victory' ? event.faction === 'witch' ? 'witch-victory' : 'town-victory'
                            : event.kind === 'elimination' ? 'eliminated'
                                : 'day';
    }

    function localContentDuration(event) {
        // Keep the compatibility values while timed servers are rolled out.
        return event.kind === 'victory' ? 2600
            : event.kind === 'identityReveal' ? 2000
                : event.kind === 'elimination' ? 1800
                    : ['trialReveal', 'confession', 'nightResult'].includes(event.kind) ? 1600
                        : 1400;
    }

    function presentationEventKey(event, epoch) {
        return String(event?.eventId || event?.sourceEventId || `${epoch || 'legacy'}:${event?.id ?? ''}`);
    }

    function rememberEvent(key) {
        model.seenPresentationEventIds ||= new Set();
        if (model.seenPresentationEventIds.has(key)) return false;
        model.seenPresentationEventIds.add(key);
        if (model.seenPresentationEventIds.size > 600) {
            const old = [...model.seenPresentationEventIds].slice(0, 200);
            old.forEach(item => model.seenPresentationEventIds.delete(item));
        }
        return true;
    }

    function queueTimedStateScenes(next, epoch) {
        const batches = [];
        for (const batch of (Array.isArray(next.presentations) ? next.presentations : [])) batches.push(batch);
        if (next.presentation) batches.push(next.presentation);
        const uniqueBatches = [...new Map(batches.filter(Boolean).map(batch => [batch.transactionId || `batch:${batch.sequence}`, batch])).values()];
        const events = uniqueBatches.flatMap(batch => Array.isArray(batch.events) ? batch.events : [])
            .filter(event => rememberEvent(presentationEventKey(event, epoch)))
            .sort((left, right) => Number(left.startedAt) - Number(right.startedAt));
        const now = serverNow();
        for (const event of events) {
            if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= now) continue;
            enqueueScene({
                ...event,
                kind: eventSceneKind(event),
                kicker: event.kicker,
                title: event.title,
                detail: event.detail,
                duration: Number(event.contentDurationMs) > 0 ? Number(event.contentDurationMs) : localContentDuration(event),
            });
        }
    }

    function queueStateScenes(previous, next) {
        if (!next) return;
        const epoch = next.gameEpoch || null;
        if (epoch && model.presentationEpoch && epoch !== model.presentationEpoch) {
            stop();
            model.seenPresentationEventIds = new Set();
            model.lastPresentationEventId = null;
        }
        if (epoch) model.presentationEpoch = epoch;
        if (Number.isFinite(Number(next.serverNow))) model.presentationClockOffset = Number(next.serverNow) - localNow();

        const hasTimedPresentation = (Array.isArray(next.presentations) && next.presentations.length)
            || Boolean(next.presentation && Array.isArray(next.presentation.events));
        if (hasTimedPresentation) {
            queueTimedStateScenes(next, epoch);
            return;
        }

        // Legacy snapshots have no authoritative clock.  Preserve their old
        // behavior: do not replay an entire history on initial mount.
        const events = Array.isArray(next.presentationEvents) ? next.presentationEvents : [];
        if (!previous) {
            model.lastPresentationEventId = events.at(-1)?.id ?? null;
            return;
        }
        const fresh = events.filter(event => model.lastPresentationEventId === null || event.id > model.lastPresentationEventId).sort((left, right) => left.id - right.id);
        for (const event of fresh) {
            model.lastPresentationEventId = event.id;
            enqueueScene({
                ...event,
                kind: eventSceneKind(event),
                duration: localContentDuration(event),
            });
        }
    }

    function stop() {
        clearTimer('sceneTimer');
        clearTimer('sceneStartTimer');
        model.sceneQueue.length = 0;
        model.scenePlaying = false;
        model.activeScene = null;
        if (scene) {
            scene.className = 'witchtown-scene is-hidden';
            scene.setAttribute('aria-hidden', 'true');
        }
    }

    return { enqueueScene, queueStateScenes, playNextScene, dismissScene, isPlaying: () => model.scenePlaying || Boolean(model.sceneStartTimer), stop };
}
