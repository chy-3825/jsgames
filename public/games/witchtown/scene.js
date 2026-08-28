/** Public scene queue and moderator-free transitions for 猎巫镇. */
export function createWitchTownScene({ mount, model, getElement, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement ? getElement(role) : mount.querySelector(`[data-role="${role}"]`);
    const scene = $('scene');
    const schedule = (callback, delay) => (windowRef?.setTimeout || globalThis.setTimeout)(callback, delay);
    const cancel = timer => (windowRef?.clearTimeout || globalThis.clearTimeout)(timer);

    function enqueueScene(item) {
        model.sceneQueue.push(item);
        if (!model.scenePlaying) playNextScene();
    }

    function playNextScene() {
        const item = model.sceneQueue.shift();
        if (!item || !scene) {
            model.scenePlaying = false;
            return;
        }
        model.scenePlaying = true;
        if (model.sceneTimer) cancel(model.sceneTimer);
        scene.className = `witchtown-scene is-${item.kind || 'verdict'} ${item.persistent ? 'is-persistent' : ''}`;
        scene.setAttribute('aria-hidden', 'false');
        $('scene-kicker').textContent = item.kicker || '';
        $('scene-title').textContent = item.title || '';
        $('scene-detail').textContent = item.detail || '';
        void scene.offsetWidth;
        scene.classList.add('is-active');
        if (!item.persistent) model.sceneTimer = schedule(() => dismissScene(false), item.duration || 1400);
    }

    function dismissScene(shatter = false) {
        if (!model.scenePlaying || !scene) return;
        if (model.sceneTimer) cancel(model.sceneTimer);
        scene.classList.add(shatter ? 'is-shattering' : 'is-leaving');
        model.sceneTimer = schedule(() => {
            scene.className = 'witchtown-scene is-hidden';
            scene.setAttribute('aria-hidden', 'true');
            model.scenePlaying = false;
            playNextScene();
        }, shatter ? 1050 : 720);
    }

    function queueStateScenes(previous, next) {
        if (!next) return;
        const events = Array.isArray(next.presentationEvents) ? next.presentationEvents : [];
        if (!previous) {
            model.lastPresentationEventId = events.at(-1)?.id ?? null;
            return;
        }
        const fresh = events.filter(event => model.lastPresentationEventId === null || event.id > model.lastPresentationEventId).sort((left, right) => left.id - right.id);
        for (const event of fresh) {
            model.lastPresentationEventId = event.id;
            const kind = event.kind === 'nightfall' || ['blackCatChoice', 'witchesComplete', 'constableStart', 'constableComplete', 'constableSkipped', 'confessionStart'].includes(event.kind) ? 'night'
                : ['conspiracyStart', 'conspiracyComplete', 'dossierReview', 'dossierConfirmed'].includes(event.kind) ? 'conspiracy'
                    : event.kind === 'trialReveal' ? event.trialType === 'witch' ? 'trial-witch' : 'trial'
                        : event.kind === 'nightResult' ? (next.lastNightDeaths || []).length ? 'dawn-death' : 'dawn-safe'
                            : event.kind === 'victory' ? event.faction === 'witch' ? 'witch-victory' : 'town-victory'
                                : event.kind === 'elimination' ? 'eliminated'
                                    : 'day';
            const duration = event.kind === 'victory' ? 2600
                : event.kind === 'identityReveal' ? 2000
                    : event.kind === 'elimination' ? 1800
                        : ['trialReveal', 'confession', 'nightResult'].includes(event.kind) ? 1600
                            : 1400;
            enqueueScene({ kind, kicker: event.kicker, title: event.title, detail: event.detail, duration });
            if (event.kind === 'elimination' && event.playerId === next.myId) enqueueScene({ kind: 'eliminated', kicker: '你的审判已经结束', title: '您已出局', detail: '你仍可继续观看塞勒姆的审判。', duration: 1800 });
        }
    }

    function stop() {
        if (model.sceneTimer) cancel(model.sceneTimer);
        model.sceneTimer = null;
        model.sceneQueue.length = 0;
        model.scenePlaying = false;
        if (scene) {
            scene.className = 'witchtown-scene is-hidden';
            scene.setAttribute('aria-hidden', 'true');
        }
    }

    return { enqueueScene, queueStateScenes, playNextScene, dismissScene, isPlaying: () => model.scenePlaying, stop };
}
