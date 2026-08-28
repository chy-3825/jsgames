import { COLORS, END_LABELS, LABELS } from './constants.js';
import { esc, publicCardMarkup } from './cards.js';

/** Action and end-of-game presentation queue for 花火. */
export function createHanabiScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, getRender = () => null }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const requestFrame = callback => (windowRef?.requestAnimationFrame ? windowRef.requestAnimationFrame(callback) : windowRef?.setTimeout(callback, 0));
    const setTimeoutRef = windowRef?.setTimeout?.bind(windowRef) || globalThis.setTimeout;
    const clearTimeoutRef = windowRef?.clearTimeout?.bind(windowRef) || globalThis.clearTimeout;
    const reducedMotion = windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)');
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const render = () => getRender()?.();

    function getViewState() {
        return { presentationPlaying, presentationQueue: [...presentationQueue] };
    }

    function presentationDelay(duration, token) {
        const wait = reducedMotion?.matches ? Math.min(180, duration * .2) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: setTimeoutRef(() => {
                    presentationWaiters.delete(waiter);
                    resolve(token === presentationToken);
                }, wait),
                resolve,
            };
            presentationWaiters.add(waiter);
        });
    }

    function showPresentation(kind, html) {
        const layer = $('presentationLayer');
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

    async function playCluePresentation(action, token) {
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
        if (!await presentationDelay(280, token)) return;
        $('presentationLayer').classList.add('is-transmitting');
        highlightClueCards(action);
        drawActionLine(tokenElement, playerAnchor(action.targetId), action.clueKind === 'color' ? action.value : 'value');
        if (!await presentationDelay(1050, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(320, token);
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

    async function playCardPresentation(action, token) {
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
        await nextFrames();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(430, token)) return;
        $('presentationLayer').classList.add('is-revealed');
        if (!await presentationDelay(620, token)) return;

        let destination = null;
        if (isDiscard) destination = mount.querySelector('.hb-discard-panel');
        else if (action.success) destination = mount.querySelector(`[data-firework-color="${action.color}"]`);
        else destination = mount.querySelector('[data-event-target="fuses"]');
        setCardDestination(destination, cardElement);
        $('presentationLayer').classList.add('is-resolved', `is-${resultKind}`);
        drawActionLine(cardElement, destination, resultKind);
        markImpact(destination);
        if (action.clueReward || isDiscard) markImpact(mount.querySelector('[data-event-target="clues"]'));
        if (!await presentationDelay(780, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(300, token);
    }

    async function nextFrames() {
        await new Promise(resolve => requestFrame(() => requestFrame(resolve)));
    }

    async function playFinalRoundCue(action, token) {
        showPresentation('final-round', `<div class="hb-final-round-cue">
            <span class="hb-final-deck" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="hb-event-kicker">牌库最后一张已经抽出</span>
            <h2>终幕开始</h2>
            <p>每位玩家还剩最后一次行动 · 共 ${Number(action.finalTurnsRemaining) || 0} 次</p>
        </div>`);
        markImpact(mount.querySelector('[data-event-target="deck"]'));
        await nextFrames();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(1450, token);
    }

    function finaleFireworks(snapshot) {
        return COLORS.map(color => `<span class="tone-${color}"><i></i><b>${Number(snapshot.fireworks?.[color]) || 0}</b></span>`).join('');
    }

    async function playFinale(snapshot, token) {
        const reason = snapshot.endReason;
        if (!['perfect', 'fuses', 'deck'].includes(reason)) return;
        const perfectScore = Number(snapshot.score) === 25;
        const title = reason === 'perfect' || perfectScore ? '完美演出' : reason === 'fuses' ? '演出中止' : '烟花落幕';
        const kicker = reason === 'perfect' ? '五色烟花全部完成' : reason === 'fuses' ? '第三根引信已经熄灭' : '最终轮已经结束';
        showPresentation(`finale finale-${reason}`, `<div class="hb-finale-scene">
            <span class="hb-event-kicker">${esc(kicker)}</span>
            <div class="hb-finale-fireworks">${finaleFireworks(snapshot)}</div>
            <h2>${esc(title)}</h2>
            <div class="hb-finale-score"><strong>${Number(snapshot.score) || 0}</strong><span>/ 25</span></div>
            <p>${esc(snapshot.scoreRating || END_LABELS[reason] || '')}</p>
        </div>`);
        await nextFrames();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2300, token);
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.hb-app')?.classList.add('is-action-presenting');
        while (presentationQueue.length) {
            const item = presentationQueue.shift();
            const token = ++presentationToken;
            if (item.action?.kind === 'giveClue') await playCluePresentation(item.action, token);
            if (['playCard', 'discardCard'].includes(item.action?.kind)) await playCardPresentation(item.action, token);
            if (token !== presentationToken) continue;
            if (item.action?.finalTurnsStarted && !item.action?.ended) await playFinalRoundCue(item.action, token);
            if (token !== presentationToken) continue;
            if (item.action?.ended || item.finaleOnly) await playFinale(item.snapshot, token);
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.hb-app')?.classList.remove('is-action-presenting');
    }

    function enqueuePresentation(item) {
        presentationQueue.push(item);
        void runPresentationQueue();
    }

    function stopPresentation() {
        presentationToken += 1;
        presentationQueue = [];
        for (const waiter of presentationWaiters) {
            clearTimeoutRef(waiter.timer);
            waiter.resolve(false);
        }
        presentationWaiters.clear();
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.hb-app')?.classList.remove('is-action-presenting');
    }

    function destroy() {
        stopPresentation();
    }

    return Object.freeze({ getViewState, enqueuePresentation, stopPresentation, destroy });
}
