import { COLORS, END_LABELS, LABELS } from './constants.js';
import { esc, publicCardMarkup } from './cards.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Action and end-of-game presentation queue for 花火. */
export function createHanabiScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, getRender = () => null }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const requestFrame = callback => (windowRef?.requestAnimationFrame ? windowRef.requestAnimationFrame(callback) : windowRef?.setTimeout(callback, 0));
    const setTimeoutRef = windowRef?.setTimeout?.bind(windowRef) || globalThis.setTimeout;
    const clearTimeoutRef = windowRef?.clearTimeout?.bind(windowRef) || globalThis.clearTimeout;
    const root = mount.querySelector('.hb-app');
    const legacyContentDurations = { giveClue: 1650, playCard: 2130, discardCard: 2130, finalRoundStarted: 1450, finalSettlement: 2300, finalClosure: 1400 };
    model.presentationQueue ||= [];
    model.presentationEventIds ||= new Set();
    model.presentationWaiters ||= new Set();
    model.presentationLockedUntil ||= 0;
    model.presentationSkipCurrent ||= false;
    let currentEvent = null;
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    const render = () => getRender()?.();

    function getViewState() {
        return {
            presentationPlaying: Boolean(model.presentationPlaying),
            presentationQueue: [...model.presentationQueue],
            presentationLockedUntil: Number(model.presentationLockedUntil) || 0,
            presentationEvent: currentEvent,
        };
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

    async function waitPhase(timestamp, token) {
        if (model.presentationSkipCurrent) {
            model.presentationSkipCurrent = false;
            hidePresentation();
            return 'skipped';
        }
        const reached = await waitUntil(timestamp, token);
        if (model.presentationSkipCurrent) {
            model.presentationSkipCurrent = false;
            hidePresentation();
            return 'skipped';
        }
        if (reached) return true;
        return false;
    }

    function showPresentation(kind, html) {
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `hb-presentation-layer is-active is-${kind}`;
        $('actionStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-match, .is-event-dim, .is-event-impact').forEach(element => {
            element.classList.remove('is-event-match', 'is-event-dim', 'is-event-impact');
        });
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'hb-presentation-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('actionStage').innerHTML = '';
    }

    function playerAnchor(playerId, preferCards = true) {
        const state = model.state;
        const id = String(playerId ?? '');
        if (id === String(state?.myId) && preferCards) return mount.querySelector('.hb-my-hand');
        const candidates = [...mount.querySelectorAll('[data-player-id]')].filter(element => element.dataset.playerId === id);
        if (preferCards) {
            const cardArea = candidates.find(element => element.classList.contains('hb-teammate'));
            if (cardArea) return cardArea;
        }
        return candidates.find(element => element.classList.contains('hb-player')) || candidates[0] || null;
    }

    function drawActionLine(fromElement, toElement, tone = 'clue') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const bend = Math.max(42, Math.min(150, Math.abs(x2 - x1) * .22 + Math.abs(y2 - y1) * .1));
        const direction = x2 >= x1 ? 1 : -1;
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', `is-visible tone-${tone}`);
    }

    function highlightClueCards(action) {
        const state = model.state;
        const matchedIds = new Set((action.matchedCardIds || []).map(String));
        const target = action.targetId === state?.myId ? mount.querySelector('.hb-my-hand') : playerAnchor(action.targetId, true);
        if (!target) return;
        target.querySelectorAll('[data-card-id], [data-hand-card-id]').forEach(element => {
            const cardId = String(element.dataset.cardId || element.dataset.handCardId || '');
            element.classList.add(matchedIds.has(cardId) ? 'is-event-match' : 'is-event-dim');
        });
    }

    function markImpact(element) {
        if (element) element.classList.add('is-event-impact');
    }

    async function playCluePresentation(action, token, event = {}) {
        const clueText = action.clueKind === 'color' ? `${LABELS[action.value] || action.value}色` : `数字 ${action.value}`;
        const positions = (action.matchedIndexes || []).map(index => Number(index) + 1).join('、');
        showPresentation('clue', `<div class="hb-clue-event">
            <span class="hb-event-kicker">${esc(action.playerName)}传来提示</span>
            <div class="hb-clue-token ${action.clueKind === 'color' ? `tone-${esc(action.value)}` : 'tone-value'}"><i></i><strong>${esc(clueText)}</strong></div>
            <h2>${esc(action.targetName)}，记住这些牌</h2>
            <p>命中 ${action.matchedCardIds?.length || 0} 张${positions ? ` · 第 ${esc(positions)} 张` : ''}</p>
        </div>`);
        const tokenElement = $('actionStage').querySelector('.hb-clue-token');
        drawActionLine(playerAnchor(action.playerId), tokenElement, 'clue');
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || legacyContentDurations.giveClue);
        const transmittingAt = startedAt + 280;
        const settledAt = startedAt + 1330;
        let phase = await waitPhase(transmittingAt, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-transmitting');
        highlightClueCards(action);
        drawActionLine(tokenElement, playerAnchor(action.targetId), action.clueKind === 'color' ? action.value : 'value');
        phase = await waitPhase(settledAt, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-settled');
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    function stageCardMarkup(action) {
        return `<div class="hb-stage-card-motion">
            <div class="hb-stage-card-flip">
                <div class="hb-stage-card-side is-back">${publicCardMarkup({ hidden: true }, { kind: 'stage' })}</div>
                <div class="hb-stage-card-side is-front">${publicCardMarkup({ color: action.color, value: Number(action.value) }, { kind: 'stage' })}</div>
            </div>
        </div>`;
    }

    function setCardOrigin(source, cardElement) {
        if (!source || !cardElement) return;
        const sourceRect = source.getBoundingClientRect();
        const cardRect = cardElement.getBoundingClientRect();
        cardElement.style.setProperty('--hb-from-x', `${sourceRect.left + sourceRect.width / 2 - (cardRect.left + cardRect.width / 2)}px`);
        cardElement.style.setProperty('--hb-from-y', `${sourceRect.top + sourceRect.height / 2 - (cardRect.top + cardRect.height / 2)}px`);
    }

    function setCardDestination(destination, cardElement) {
        if (!destination || !cardElement) return;
        const destinationRect = destination.getBoundingClientRect();
        const cardRect = cardElement.getBoundingClientRect();
        cardElement.style.setProperty('--hb-to-x', `${destinationRect.left + destinationRect.width / 2 - (cardRect.left + cardRect.width / 2)}px`);
        cardElement.style.setProperty('--hb-to-y', `${destinationRect.top + destinationRect.height / 2 - (cardRect.top + cardRect.height / 2)}px`);
    }

    async function playCardPresentation(action, token, event = {}) {
        const isDiscard = action.kind === 'discardCard';
        const resultKind = isDiscard ? 'discard' : action.success ? 'success' : 'misfire';
        const resultTitle = isDiscard ? '公开弃置' : action.success ? `${LABELS[action.color]}色烟花接续成功` : `未能接续 · 需要 ${action.expected}`;
        const resultCopy = isDiscard ? `提示令牌 ${action.cluesBefore} → ${action.cluesAfter}` : action.success ? `${action.scoreBefore} → ${action.scoreAfter} 分${action.clueReward ? ' · 完成 5，返还提示' : ''}` : `引信 ${action.strikesBefore} → ${action.strikesAfter} / 3`;
        showPresentation(isDiscard ? 'discard' : 'play', `<div class="hb-card-event">
            <span class="hb-event-kicker">${esc(action.playerName)}${isDiscard ? '弃置手牌' : '打出未知牌'}</span>
            ${stageCardMarkup(action)}
            <div class="hb-card-event-result"><strong>${esc(resultTitle)}</strong><small>${esc(resultCopy)}</small></div>
        </div>`);
        const cardElement = $('actionStage').querySelector('.hb-stage-card-motion');
        const source = playerAnchor(action.playerId);
        setCardOrigin(source, cardElement);
        drawActionLine(source, cardElement, isDiscard ? 'discard' : 'play');
        const startedAt = Number(event.startedAt) || Date.now();
        const contentDuration = Number(event.contentDurationMs) || legacyContentDurations[action.kind] || 2130;
        const revealedAt = startedAt + 1050;
        const resolvedAt = startedAt + 1830;
        const contentEnd = startedAt + contentDuration;
        await nextFrames();
        $('presentationLayer').classList.add('is-centered');
        let phase = await waitPhase(revealedAt, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-revealed');
        let destination = null;
        if (isDiscard) destination = mount.querySelector('.hb-discard-panel');
        else if (action.success) destination = mount.querySelector(`[data-firework-color="${action.color}"]`);
        else destination = mount.querySelector('[data-event-target="fuses"]');
        phase = await waitPhase(resolvedAt, token);
        if (phase !== true) return phase;
        setCardDestination(destination, cardElement);
        $('presentationLayer').classList.add('is-resolved', `is-${resultKind}`);
        drawActionLine(cardElement, destination, resultKind);
        markImpact(destination);
        if (action.clueReward || isDiscard) markImpact(mount.querySelector('[data-event-target="clues"]'));
        $('presentationLayer').classList.add('is-settled');
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    async function nextFrames() {
        await new Promise(resolve => requestFrame(() => requestFrame(resolve)));
    }

    async function playFinalRoundCue(action, token, event = {}) {
        showPresentation('final-round', `<div class="hb-final-round-cue">
            <span class="hb-final-deck" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="hb-event-kicker">牌库最后一张已经抽出</span>
            <h2>终幕开始</h2>
            <p>每位玩家还剩最后一次行动 · 共 ${Number(action.finalTurnsRemaining) || 0} 次</p>
        </div>`);
        markImpact(mount.querySelector('[data-event-target="deck"]'));
        await nextFrames();
        $('presentationLayer').classList.add('is-revealed');
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || legacyContentDurations.finalRoundStarted);
        const result = await waitPhase(contentEnd, token);
        return result === true ? true : result;
    }

    function finaleFireworks(snapshot) {
        return COLORS.map(color => `<span class="tone-${color}"><i></i><b>${Number(snapshot.fireworks?.[color]) || 0}</b></span>`).join('');
    }

    async function playFinale(event, token) {
        const reason = event.reason || event.endReason;
        if (!['perfect', 'fuses', 'deck', 'players'].includes(reason)) return true;
        const perfectScore = Number(event.score) === 25;
        const title = reason === 'perfect' || perfectScore ? '完美演出' : reason === 'fuses' ? '演出中止' : reason === 'players' ? '合作局中止' : '烟花落幕';
        const kicker = reason === 'perfect' ? '五色烟花全部完成' : reason === 'fuses' ? '第三根引信已经熄灭' : reason === 'players' ? '在线玩家不足，无法继续合作' : '最终轮已经结束';
        showPresentation(`finale finale-${reason}`, `<div class="hb-finale-scene">
            <span class="hb-event-kicker">${esc(kicker)}</span>
            <div class="hb-finale-fireworks">${finaleFireworks(event)}</div>
            <h2>${esc(title)}</h2>
            <div class="hb-finale-score"><strong>${Number(event.score) || 0}</strong><span>/ 25</span></div>
            <p>${esc(event.scoreRating || END_LABELS[reason] || '')}</p>
        </div>`);
        await nextFrames();
        $('presentationLayer').classList.add('is-revealed');
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || legacyContentDurations[reason === 'players' ? 'finalClosure' : 'finalSettlement']);
        const result = await waitPhase(contentEnd, token);
        return result === true ? true : result;
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return false;
        currentEvent = event;
        model.presentationEvent = event;
        const startedAt = Number(event.startedAt) || Date.now();
        currentEventDeadline = Number(event.endsAt) || (startedAt + (Number(event.durationMs) || 900 + PRESENTATION_FADE_MS));
        let phase = await waitPhase(startedAt, token);
        if (phase !== true) return phase;
        if (currentEventDeadline <= Date.now()) return 'expired';

        let played = true;
        if (event.kind === 'giveClue') played = await playCluePresentation(event, token, event);
        else if (['playCard', 'discardCard'].includes(event.kind)) played = await playCardPresentation(event, token, event);
        else if (event.kind === 'finalRoundStarted') played = await playFinalRoundCue(event, token, event);
        else if (['finalSettlement', 'finalClosure'].includes(event.kind)) played = await playFinale(event, token);
        if (played !== true) return played;
        if (token !== model.presentationToken) return false;

        phase = await waitPhase(Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS), token);
        if (phase !== true) return phase;
        beginPresentationFade($('presentationLayer'));
        phase = await waitPhase(currentEventDeadline, token);
        if (phase !== true) return phase;
        hidePresentation();
        currentEvent = null;
        model.presentationEvent = null;
        return true;
    }

    function legacyBatch(item) {
        if (item?.events?.length) return JSON.parse(JSON.stringify(item));
        const action = item?.action;
        const snapshot = item?.snapshot || {};
        if (!action?.kind && !item?.finaleOnly) return null;
        const now = Date.now();
        let cursor = now;
        let eventSequence = 0;
        const events = [];
        const append = (kind, data, contentDuration) => {
            const durationMs = contentDuration + PRESENTATION_FADE_MS;
            const event = {
                ...JSON.parse(JSON.stringify(data || {})),
                kind,
                sequence: ++eventSequence,
                eventId: eventSequence,
                startedAt: cursor,
                endsAt: cursor + durationMs,
                durationMs,
                contentDurationMs: contentDuration,
            };
            events.push(event);
            cursor = event.endsAt;
        };
        if (action?.kind) append(action.kind, action, legacyContentDurations[action.kind] || 900);
        if (action?.finalTurnsStarted && !action?.ended) append('finalRoundStarted', action, legacyContentDurations.finalRoundStarted);
        if (action?.ended || item?.finaleOnly) {
            const reason = snapshot.endReason || action?.endReason || 'deck';
            append(reason === 'players' ? 'finalClosure' : 'finalSettlement', {
                ...snapshot,
                reason,
                endReason: reason,
            }, legacyContentDurations[reason === 'players' ? 'finalClosure' : 'finalSettlement']);
        }
        return { sequence: now, transactionId: now, startedAt: now, endsAt: cursor, durationMs: cursor - now, blocking: true, events };
    }

    async function holdPresentationLock(token) {
        while (token === model.presentationToken && Date.now() < Number(model.presentationLockedUntil || 0)) {
            if (!await waitUntil(model.presentationLockedUntil, token)) return;
        }
        if (token !== model.presentationToken) return;
        model.presentationPlaying = false;
        root?.classList.remove('is-action-presenting');
        render();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        root?.classList.add('is-action-presenting');
        render();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const batch = model.presentationQueue.shift();
            for (const event of (batch?.events || [])) {
                if (token !== model.presentationToken) break;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                const played = await playPresentationEvent(event, token);
                if (played === false && token !== model.presentationToken) break;
            }
        }
        if (token !== model.presentationToken) return;
        currentEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        hidePresentation();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        root?.classList.remove('is-action-presenting');
        render();
    }

    function enqueuePresentation(item) {
        const batch = legacyBatch(item);
        if (!batch?.events?.length) return;
        if (Number.isFinite(Number(batch.endsAt)) && Number(batch.endsAt) <= Date.now()) return;
        model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(batch.endsAt) || 0);
        model.presentationQueue.push(batch);
        model.presentationQueue.sort((left, right) => Number(left.sequence) - Number(right.sequence));
        void runPresentationQueue();
    }

    function skipPresentation() {
        if (!model.presentationPlaying && !model.presentationQueue.length) return;
        if (!currentEvent) return;
        model.presentationSkipCurrent = true;
        cancelPresentationWaiters();
        hidePresentation();
        render();
    }

    function stopPresentation() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        model.presentationSkipCurrent = false;
        cancelPresentationWaiters();
        currentEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        model.presentationEvent = null;
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        hidePresentation();
        root?.classList.remove('is-action-presenting');
        render();
    }

    function destroy() {
        stopPresentation();
    }

    return Object.freeze({ getViewState, enqueuePresentation, skipPresentation, stopPresentation, destroy, isPlaying: () => Boolean(model.presentationPlaying || model.presentationQueue.length || Date.now() < Number(model.presentationLockedUntil || 0)) });
}
