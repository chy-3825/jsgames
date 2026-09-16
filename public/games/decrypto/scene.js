import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Public, server-timed communication scenes for 谍报风云. */
export function createDecryptoScene({ getElement, model, windowRef = globalThis.window || globalThis, renderer, onPresentationStart }) {
    const $ = role => getElement(role);
    const root = getElement('sceneTransition')?.closest('.decrypto-app') || null;
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)');

    model.presentationQueue ||= [];
    model.presentationWaiters ||= new Set();
    model.presentationLockedUntil ||= 0;

    let currentEvent = null;
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let activeBatch = null;
    let activeEventIndex = -1;

    function waitUntil(timestamp, token) {
        const wait = Number(timestamp) - Date.now();
        if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve(token === model.presentationToken);
        if (token !== model.presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const waiter = {
                timer: windowRef.setTimeout(() => waiter.resolve(token === model.presentationToken), wait),
                done: false,
                resolve(value) {
                    if (waiter.done) return;
                    waiter.done = true;
                    model.presentationWaiters.delete(waiter);
                    windowRef.clearTimeout(waiter.timer);
                    resolve(value);
                },
            };
            model.presentationWaiters.add(waiter);
        });
    }

    function cancelPresentationWaiters() {
        for (const waiter of model.presentationWaiters) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        model.presentationWaiters.clear();
    }

    function nextFrame() {
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        return new Promise(resolve => request(() => request(resolve)));
    }

    function playerName(id, fallback = '玩家') {
        return (model.state?.players || []).find(player => player.id === id)?.name || id || fallback;
    }

    function showScene(kind, copy) {
        const layer = $('sceneTransition');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.className = `dc-scene-transition is-${kind || 'signal'}`;
        layer.setAttribute('aria-hidden', 'false');
        layer.hidden = false;
        $('sceneKicker').textContent = copy.kicker || '';
        $('sceneTitle').textContent = copy.title || '';
        $('sceneDetail').textContent = copy.detail || '';
    }

    function hideScene() {
        const layer = $('sceneTransition');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.className = 'dc-scene-transition is-hidden';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        currentEvent = null;
        model.presentationEvent = null;
    }

    function revealScene() {
        const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        request(() => $('sceneTransition')?.classList.add('is-revealed'));
    }

    function eventCopy(event) {
        const team = event.teamName || (Number(event.teamId) === 0 ? '红队' : Number(event.teamId) === 1 ? '蓝队' : '当前队伍');
        if (event.kind === 'encryptorElectionStarted') return {
            kind: 'keys',
            kicker: '全员核对完成',
            title: '固定加密员选举',
            detail: '各队正在秘密投票，选票完成后统一公布结果。',
        };
        if (event.kind === 'keysSealed') return {
            kind: 'keys',
            kicker: event.reason === 'encryptorElectionResolved' ? '选举完成' : '全员核对完成',
            title: '密钥已经封存',
            detail: '第一轮加密频道正在建立，私密关键词不会向对手公开。',
        };
        if (event.kind === 'transmissionOpened') return {
            kind: 'signal',
            kicker: '捕获到新电报',
            title: `${team}频道已接入`,
            detail: '三条线索已经公开，请在同桌或公共语音中开始推演。',
        };
        if (event.kind === 'transmissionResolved') {
            const code = Array.isArray(event.code) ? event.code.join('  ·  ') : '—';
            const own = event.ownGuessCorrect ? '本队解码成功' : '本队出现沟通失误';
            const intercept = event.interceptCorrect === null || event.interceptCorrect === undefined
                ? '首轮不进行截获'
                : event.interceptCorrect ? '对方截获成功' : '对方未能截获';
            return {
                kind: event.interceptCorrect ? 'breach' : event.ownGuessCorrect ? 'decoded' : 'mistake',
                kicker: `${team}电报已解密`,
                title: code,
                detail: `${own} · ${intercept}`,
            };
        }
        if (event.kind === 'tiebreakStarted') return {
            kind: 'tiebreak',
            kicker: '常规标记无法判定胜负',
            title: '双方通信已经暴露',
            detail: '启动最终反向破译，双方猜测对方四张关键词。',
        };
        if (event.kind === 'finalSettlement') {
            const draw = event.winnerTeamId === null || event.draw;
            const personal = event.viewerVariant === 'personalVictory';
            const kind = draw ? 'draw' : Number(event.winnerTeamId) === 0 ? 'red-win' : 'blue-win';
            return {
                kind,
                kicker: personal ? '个人最终结果' : '通信终局',
                title: personal ? (event.title || '您已获胜') : draw ? '双方共享胜利' : `${event.winnerTeamName || '获胜队伍'}控制了频道`,
                detail: personal ? (event.detail || '您的队伍赢得了谍报风云。') : event.reason === 'tiebreakDraw' ? '最终猜词仍然平局，双方共同保留胜果。' : '所有密钥和通信档案已经解封。',
            };
        }
        return { kind: 'signal', kicker: '通信播报', title: '公开记录已经更新', detail: `${playerName(event.actorId, '通信站')}推进了当前流程。` };
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return false;
        currentEvent = event;
        model.presentationEvent = event;
        if (Number.isFinite(Number(event.startedAt)) && !await waitUntil(event.startedAt, token)) {
            if (model.presentationSkipCurrent) {
                model.presentationSkipCurrent = false;
                currentEvent = null;
                model.presentationEvent = null;
                return 'skipped';
            }
            return false;
        }
        if (token !== model.presentationToken) return false;
        if (model.presentationSkipCurrent) {
            model.presentationSkipCurrent = false;
            currentEvent = null;
            model.presentationEvent = null;
            return 'skipped';
        }

        const copy = eventCopy(event);
        currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Date.now() + 900 + PRESENTATION_FADE_MS;
        showScene(copy.kind, copy);
        revealScene();
        renderer?.render?.();
        await nextFrame();
        const fadeAt = Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS);
        if (!await waitUntil(fadeAt, token)) {
            if (model.presentationSkipCurrent) {
                model.presentationSkipCurrent = false;
                hideScene();
                return 'skipped';
            }
            return false;
        }
        if (model.presentationSkipCurrent) {
            model.presentationSkipCurrent = false;
            hideScene();
            return 'skipped';
        }
        beginPresentationFade($('sceneTransition'));
        if (!await waitUntil(currentEventDeadline, token)) {
            if (model.presentationSkipCurrent) {
                model.presentationSkipCurrent = false;
                hideScene();
                return 'skipped';
            }
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
        root?.classList.remove('is-scene-active');
        renderer?.render?.();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        onPresentationStart?.();
        root?.classList.add('is-scene-active');
        renderer?.render?.();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const batch = model.presentationQueue.shift();
            activeBatch = batch;
            for (let index = 0; index < (batch?.events || []).length; index += 1) {
                activeEventIndex = index;
                const event = batch.events[index];
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                const played = await playPresentationEvent(event, token);
                if (played === false && token !== model.presentationToken) break;
            }
            activeBatch = null;
            activeEventIndex = -1;
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
        root?.classList.remove('is-scene-active');
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

    function transitionScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        if (previous.phase === 'keycheck' && next.phase === 'encryptor_vote') scenes.push({ kind: 'keys', kicker: '全员核对完成', title: '固定加密员选举', detail: '请在本队内投出你的选择' });
        if ((previous.phase === 'keycheck' || previous.phase === 'encryptor_vote') && next.phase === 'clue') scenes.push({ kind: 'keys', kicker: previous.phase === 'encryptor_vote' ? '选举完成' : '全员核对完成', title: '密钥已经封存', detail: '第一轮加密频道正在建立' });
        if (previous.phase === 'clue' && next.phase === 'guessing') scenes.push({ kind: 'signal', kicker: '捕获到新电报', title: `${next.currentTeamName || '当前队伍'}频道已接入`, detail: '线索已经公开，请在同桌或公共语音中开始推演' });
        const previousHistory = previous.history?.length || 0;
        const nextHistory = next.history?.length || 0;
        if (nextHistory > previousHistory) {
            const record = next.history[nextHistory - 1];
            const result = [`本队${record.ownGuess?.correct ? '解码成功' : '沟通失误'}`];
            if (record.intercept) result.push(`对方${record.intercept.correct ? '截获成功' : '未能截获'}`);
            else result.push('首轮不进行截获');
            const nextChannel = next.status === 'ended' || next.phase === 'tiebreak' ? '' : next.phase === 'guessing' ? ` · ${next.currentTeamName}频道即将接入` : ` · 第 ${next.round} 轮即将开始`;
            scenes.push({ kind: record.intercept?.correct ? 'breach' : record.ownGuess?.correct ? 'decoded' : 'mistake', kicker: `${record.teamName}电报已解密`, title: record.code.join('  ·  '), detail: `${result.join(' · ')}${nextChannel}` });
        }
        if (previous.phase !== 'tiebreak' && next.phase === 'tiebreak') scenes.push({ kind: 'tiebreak', kicker: '常规标记无法判定胜负', title: '双方通信已经暴露', detail: '启动最终反向破译' });
        if (previous.status !== 'ended' && next.status === 'ended') scenes.push({ kind: next.winner?.teamId === null ? 'draw' : Number(next.winner?.teamId) === 0 ? 'red-win' : 'blue-win', kicker: '通信终局', title: next.winner?.teamId === null ? '双方共享胜利' : `${next.winner?.teamName || '获胜队伍'}控制了频道`, detail: next.lastResult?.message || '所有密钥和通信档案已经解封' });
        return scenes;
    }

    function playScenes(scenes) {
        const sequence = ++model.sceneSequence;
        const queue = (scenes || []).filter(Boolean);
        if (!queue.length) return;
        hideScene();
        const playNext = () => {
            if (sequence !== model.sceneSequence || !queue.length) { hideScene(); return; }
            const scene = queue.shift();
            showScene(scene.kind || 'signal', scene);
            revealScene();
            const visibleDuration = reducedMotion?.matches ? 700 : (scene.duration || 1900);
            const fadeDuration = reducedMotion?.matches ? 0 : PRESENTATION_FADE_MS;
            model.sceneTimer = windowRef.setTimeout(() => {
                if (sequence !== model.sceneSequence) return;
                beginPresentationFade($('sceneTransition'));
                model.sceneTimer = windowRef.setTimeout(() => {
                    if (sequence !== model.sceneSequence) return;
                    hideScene();
                    playNext();
                }, fadeDuration);
            }, visibleDuration);
        };
        playNext();
    }

    function skipScene() {
        if (model.presentationPlaying || model.presentationQueue.length || Date.now() < Number(model.presentationLockedUntil || 0)) return skipPresentation();
        model.sceneSequence += 1;
        if (model.sceneTimer) windowRef.clearTimeout(model.sceneTimer);
        model.sceneTimer = null;
        hideScene();
    }

    function stop() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        model.presentationSkipCurrent = false;
        cancelPresentationWaiters();
        currentEvent = null;
        activeBatch = null;
        activeEventIndex = -1;
        model.presentationEvent = null;
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        hideScene();
        root?.classList.remove('is-scene-active');
        model.sceneSequence += 1;
        if (model.sceneTimer) windowRef.clearTimeout(model.sceneTimer);
        model.sceneTimer = null;
        renderer?.render?.();
    }

    return {
        transitionScenes,
        playScenes,
        enqueuePresentation,
        skipPresentation,
        skipScene,
        stop,
        destroy: stop,
        isPlaying: () => model.presentationPlaying || model.presentationQueue.length > 0 || Date.now() < Number(model.presentationLockedUntil || 0),
    };
}
