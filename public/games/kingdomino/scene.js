import { escapeHtml, eventDominoMarkup } from './cards.js';
import { safeColor } from './state.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

const LEGACY_CONTENT_DURATIONS = Object.freeze({
    gameStart: 900,
    selectDomino: 1120,
    unclaimedDomino: 940,
    placementPhase: 850,
    placeDomino: 1020,
    discardDomino: 940,
    playerLeft: 1000,
    finalSettlement: 2700,
});

/** Draft, placement and finale presentation queue for 多米诺王国. */
export function createKingdominoScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, getRender = () => null }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const setTimeoutRef = windowRef?.setTimeout?.bind(windowRef) || globalThis.setTimeout;
    const clearTimeoutRef = windowRef?.clearTimeout?.bind(windowRef) || globalThis.clearTimeout;
    const root = mount.querySelector('.kd-app');
    const state = () => model.state;
    const render = () => getRender()?.();
    model.presentationQueue ||= [];
    model.presentationEventIds ||= new Set();
    model.presentationWaiters ||= new Set();
    model.presentationLockedUntil ||= 0;
    model.presentationSkipCurrent ||= false;
    let currentEvent = null;
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let holdingPresentationLock = false;

    function contentDuration(kind, event = {}) {
        if (kind === 'roundReveal') return event.isLastRound ? 1350 : 920;
        return LEGACY_CONTENT_DURATIONS[kind] || 900;
    }

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
        return reached ? true : false;
    }

    function nextFrame(token) {
        return new Promise(resolve => {
            const raf = windowRef.requestAnimationFrame || (callback => setTimeoutRef(callback, 0));
            raf(() => raf(() => resolve(token === model.presentationToken)));
        });
    }

    function showPresentation(kind, html, color = '#d4a83d') {
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `kd-presentation-layer is-active is-${kind}`;
        layer.style.setProperty('--kd-action-color', safeColor(color));
        $('presentationStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
        path.style.removeProperty('stroke');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'kd-presentation-layer';
        layer.style.removeProperty('--kd-action-color');
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('presentationStage').innerHTML = '';
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function draftAnchor(tileId) {
        return [...mount.querySelectorAll('[data-domino-id]')].find(element => element.dataset.dominoId === String(tileId)) || mount.querySelector('.kd-draft-section');
    }

    function combinedAnchor(elements = []) {
        const available = elements.filter(Boolean);
        if (!available.length) return null;
        return {
            getBoundingClientRect() {
                const rects = available.map(element => element.getBoundingClientRect());
                const left = Math.min(...rects.map(rect => rect.left));
                const right = Math.max(...rects.map(rect => rect.right));
                const top = Math.min(...rects.map(rect => rect.top));
                const bottom = Math.max(...rects.map(rect => rect.bottom));
                return { left, right, top, bottom, width: right - left, height: bottom - top };
            },
        };
    }

    function placementAnchor(event) {
        if (String(event.playerId) !== String(state()?.myId)) return playerAnchor(event.playerId);
        const cells = [event.placement?.first, event.placement?.second]
            .map(cell => cell && mount.querySelector(`[data-cell="${cell.x},${cell.y}"]`));
        return combinedAnchor(cells) || $('board');
    }

    function drawActionLine(fromElement, toElement, color = '#d4a83d') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(42, Math.min(150, Math.abs(x2 - x1) * .22 + Math.abs(y2 - y1) * .1));
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', 'is-visible');
        path.style.stroke = safeColor(color);
    }

    function setMotionOrigin(source, element) {
        if (!source || !element) return;
        const from = source.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--kd-from-x', `${from.left + from.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--kd-from-y', `${from.top + from.height / 2 - (target.top + target.height / 2)}px`);
    }

    function setMotionDestination(destination, element) {
        if (!destination || !element) return;
        const to = destination.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--kd-to-x', `${to.left + to.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--kd-to-y', `${to.top + to.height / 2 - (target.top + target.height / 2)}px`);
    }

    async function playClaimPresentation(event, token) {
        const color = safeColor(event.playerColor);
        showPresentation('claim', `<div class="kd-claim-event"><span class="kd-event-kicker">${escapeHtml(event.playerName)}认领公开领地</span><h2>第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地</h2><p>王冠已落位 · 编号越小，下轮行动越早</p></div><span class="kd-crown-flight" style="--player-color:${color}"><i>♛</i><small>王冠 ${Number(event.tokenNumber) || 1}</small></span>`, color);
        const crown = $('presentationStage').querySelector('.kd-crown-flight');
        const target = draftAnchor(event.tile?.id);
        const actor = playerAnchor(event.playerId);
        setMotionOrigin(actor, crown);
        setMotionDestination(target, crown);
        drawActionLine(actor, target, color);
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || contentDuration(event.kind, event));
        if (!await nextFrame(token)) return false;
        let phase = await waitPhase(startedAt + 300, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-crowned');
        phase = await waitPhase(startedAt + 730, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-landed');
        target?.classList.add('is-event-impact');
        clearActionLine();
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    async function playGameStartPresentation(event, token) {
        showPresentation('game-start', `<div class="kd-phase-event"><span class="kd-event-kicker">国王们已经抵达边境</span><h2>王国建设开始</h2><p>${Number(event.boardSize) || 5} × ${Number(event.boardSize) || 5} 疆域 · 共 ${Number(event.maxRounds) || 12} 轮</p></div>`);
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-revealed');
        return waitPhase((Number(event.startedAt) || Date.now()) + (Number(event.contentDurationMs) || contentDuration(event.kind, event)), token);
    }

    async function playUnclaimedPresentation(event, token) {
        showPresentation('unclaimed', `<div class="kd-discard-event"><span class="kd-event-kicker">本轮认领已经结束</span><div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div><h2>第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地无人认领</h2><p>这块领地移出本轮，不进入任何玩家的王国</p></div>`);
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || contentDuration(event.kind, event));
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-centered');
        let phase = await waitPhase(startedAt + 380, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-discarded');
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    async function playPlacementPhasePresentation(event, token) {
        showPresentation('placement-phase', `<div class="kd-phase-event"><span class="kd-event-kicker">第 ${Number(event.round) || 1} 轮领地已经锁定</span><h2>按编号扩建王国</h2><div class="kd-placement-order">${(event.order || []).map(entry => `<article style="--player-color:${safeColor(entry.playerColor)}"><span>${Number(entry.order)}</span>${eventDominoMarkup(entry.tile, 'is-order-domino')}<strong>${escapeHtml(entry.playerName)}</strong><small>王冠 ${Number(entry.tokenNumber) || 1}</small></article>`).join('')}</div><p>低编号的国王先摆放领地</p></div>`);
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-revealed');
        return waitPhase((Number(event.startedAt) || Date.now()) + (Number(event.contentDurationMs) || contentDuration(event.kind, event)), token);
    }

    async function playPlacePresentation(event, token) {
        const color = safeColor(event.playerColor);
        const gain = Number(event.scoreAfter) - Number(event.scoreBefore);
        showPresentation('place', `<div class="kd-place-event"><span class="kd-event-kicker">${escapeHtml(event.playerName)}扩建王国</span><div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div><h2>领地正式落位</h2><p>${gain > 0 ? `王国 ${Number(event.scoreBefore)} → ${Number(event.scoreAfter)} 分 · +${gain}` : `当前 ${Number(event.scoreAfter)} 分 · 新领地尚未形成得分`}</p></div>`, color);
        const motion = $('presentationStage').querySelector('.kd-domino-motion');
        const actor = playerAnchor(event.playerId);
        const destination = placementAnchor(event);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || contentDuration(event.kind, event));
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-centered');
        let phase = await waitPhase(startedAt + 430, token);
        if (phase !== true) return phase;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, color);
        if (String(event.playerId) === String(state()?.myId)) {
            for (const cell of [event.placement?.first, event.placement?.second]) {
                if (cell) mount.querySelector(`[data-cell="${cell.x},${cell.y}"]`)?.classList.add('is-event-impact');
            }
        } else {
            playerAnchor(event.playerId)?.classList.add('is-event-impact');
        }
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    async function playDiscardPresentation(event, token) {
        const color = safeColor(event.playerColor);
        const leftGame = event.reason === 'playerLeave';
        const kicker = leftGame ? `${event.playerName || '一位国王'}已离开本局` : `${event.playerName || '一位国王'}无法连接这块领地`;
        const title = leftGame ? `第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地随席位移出` : `第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地被弃置`;
        const detail = leftGame ? '该席位未摆放的领地不再进入后续王冠顺序' : '王国中已经没有合法的相邻位置';
        showPresentation('discard', `<div class="kd-discard-event"><span class="kd-event-kicker">${escapeHtml(kicker)}</span><div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`, color);
        const motion = $('presentationStage').querySelector('.kd-domino-motion');
        const actor = playerAnchor(event.playerId);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        const startedAt = Number(event.startedAt) || Date.now();
        const contentEnd = startedAt + (Number(event.contentDurationMs) || contentDuration(event.kind, event));
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-centered');
        let phase = await waitPhase(startedAt + 380, token);
        if (phase !== true) return phase;
        $('presentationLayer').classList.add('is-discarded');
        clearActionLine();
        phase = await waitPhase(contentEnd, token);
        return phase === true ? true : phase;
    }

    async function playRoundRevealPresentation(event, token) {
        const last = Boolean(event.isLastRound);
        showPresentation(last ? 'last-round' : 'round-reveal', `<div class="kd-round-event"><span class="kd-event-kicker">${last ? '王国边界即将封闭' : '新的领地已经揭晓'}</span><h2>${last ? '最后一轮' : `第 ${Number(event.round)} 轮`}</h2><div class="kd-round-dominoes">${(event.draft || []).map((tile, index) => `<span style="--kd-reveal-order:${index}">${eventDominoMarkup(tile, 'is-round-domino')}</span>`).join('')}</div><p>${last ? '这是扩建王国的最后机会' : `牌库还剩 ${Number(event.remainingTileCount) || 0} 块领地`}</p></div>`);
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-revealed');
        return waitPhase((Number(event.startedAt) || Date.now()) + (Number(event.contentDurationMs) || contentDuration(event.kind, event)), token);
    }

    async function playPlayerLeftPresentation(event, token) {
        const personal = event.viewerVariant === 'personalDeparture';
        const title = personal ? (event.title || '您已离开本局') : `${event.playerName || '一位国王'}离开了王国建设`;
        const detail = personal
            ? (event.detail || '您的王冠已移出后续行动顺序。')
            : (event.detail || '剩余国王将按当前顺序继续建设。');
        showPresentation('player-left', `<div class="kd-phase-event"><span class="kd-event-kicker">${personal ? '个人离场结果' : '王冠席位变更'}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`, event.playerColor);
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-revealed');
        return waitPhase((Number(event.startedAt) || Date.now()) + (Number(event.contentDurationMs) || contentDuration(event.kind, event)), token);
    }

    async function playFinalePresentation(event, token) {
        const standings = event.standings || [];
        const winners = event.winners?.length ? event.winners : event.winner ? [event.winner] : [];
        const winnerIds = new Set((event.winnerIds?.length ? event.winnerIds : winners.map(player => player.id)).map(String));
        const winnerNames = winners.map(player => player.name).filter(Boolean).join('、') || event.winner?.name || '最高分玩家';
        const personal = event.viewerVariant === 'personalVictory';
        const reason = event.reason || event.endReason;
        const shared = winnerIds.size > 1;
        const title = personal
            ? (event.title || (shared ? '您已并列获胜' : '您已获胜'))
            : reason === 'players'
                ? (winners.length ? `${winnerNames}成为最后留在王国的国王` : '王国建设提前结束')
                : `${winnerNames}${shared ? '并列成为王国霸主' : '成为王国霸主'}`;
        const detail = personal
            ? (event.detail || (shared ? '您与其他国王并列取得最高终局排名。' : '您的王国取得了最高终局排名。'))
            : reason === 'players'
                ? '在线国王不足，本局建设已经封存。'
                : '同分时依次比较最大连续领地与王冠总数';
        showPresentation('finale', `<div class="kd-finale-scene"><span class="kd-event-kicker">${reason === 'players' ? '王冠席位不足' : '所有王国已经完成'}</span><div class="kd-finale-crown" aria-hidden="true">♛</div><h2>${escapeHtml(title)}</h2><div class="kd-final-standings">${standings.map((player, index) => `<article class="${winnerIds.has(String(player.id)) ? 'is-winner' : ''}" style="--player-color:${safeColor(player.color)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}</strong><b>${Number(player.score) || 0}<small>分</small></b><em data-crowns="${Number(player.totalCrowns) || 0}">最大领地 ${Number(player.largestTerritory) || 0}</em><i>♛ ${Number(player.totalCrowns) || 0}</i></article>`).join('')}</div><p>${escapeHtml(detail)}</p></div>`);
        if (!await nextFrame(token)) return false;
        $('presentationLayer').classList.add('is-revealed');
        return waitPhase((Number(event.startedAt) || Date.now()) + (Number(event.contentDurationMs) || contentDuration(event.kind, event)), token);
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return false;
        currentEvent = event;
        model.presentationEvent = event;
        const startedAt = Number(event.startedAt) || Date.now();
        currentEventDeadline = Number(event.endsAt) || (startedAt + (Number(event.durationMs) || contentDuration(event.kind, event) + PRESENTATION_FADE_MS));
        let phase = await waitPhase(startedAt, token);
        if (phase !== true) return phase;
        if (currentEventDeadline <= Date.now()) return 'expired';

        let played = true;
        if (event.kind === 'gameStart') played = await playGameStartPresentation(event, token);
        else if (event.kind === 'selectDomino') played = await playClaimPresentation(event, token);
        else if (event.kind === 'unclaimedDomino') played = await playUnclaimedPresentation(event, token);
        else if (event.kind === 'placementPhase') played = await playPlacementPhasePresentation(event, token);
        else if (event.kind === 'placeDomino') played = await playPlacePresentation(event, token);
        else if (event.kind === 'discardDomino') played = await playDiscardPresentation(event, token);
        else if (event.kind === 'roundReveal') played = await playRoundRevealPresentation(event, token);
        else if (event.kind === 'playerLeft') played = await playPlayerLeftPresentation(event, token);
        else if (event.kind === 'finalSettlement') played = await playFinalePresentation(event, token);
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
        const source = item?.batch || item;
        if (!source) return null;
        if (source.events?.length && Number.isFinite(Number(source.endsAt)) && source.events.some(event => Number.isFinite(Number(event.endsAt)))) {
            return JSON.parse(JSON.stringify(source));
        }
        const now = Date.now();
        let cursor = now;
        let fallbackSequence = 0;
        const events = [];
        const append = (kind, data = {}) => {
            const contentDurationMs = Number(data.contentDurationMs) || contentDuration(kind, data);
            const durationMs = contentDurationMs + PRESENTATION_FADE_MS;
            const event = {
                ...JSON.parse(JSON.stringify(data)),
                kind,
                sequence: Number(data.sequence) || ++fallbackSequence,
                eventId: data.eventId ?? fallbackSequence,
                startedAt: cursor,
                endsAt: cursor + durationMs,
                durationMs,
                contentDurationMs,
            };
            events.push(event);
            cursor = event.endsAt;
        };
        for (const event of source.events || []) append(event.kind, event);
        const hasSettlement = events.some(event => event.kind === 'finalSettlement');
        if ((source.ended || item?.finaleOnly) && !hasSettlement) {
            append('finalSettlement', {
                standings: source.standings || [],
                winner: source.winner || null,
                winners: source.winners || (source.winner ? [source.winner] : []),
                winnerIds: source.winnerIds || (source.winner ? [source.winner.id] : []),
                reason: source.endReason || source.reason || 'completed',
                endReason: source.endReason || source.reason || 'completed',
            });
        }
        if (!events.length) return null;
        return {
            ...JSON.parse(JSON.stringify(source)),
            sequence: Number(source.sequence) || now,
            transactionId: source.transactionId ?? source.sequence ?? now,
            startedAt: now,
            endsAt: cursor,
            durationMs: cursor - now,
            blocking: true,
            events,
        };
    }

    async function holdPresentationLock(token) {
        holdingPresentationLock = true;
        while (token === model.presentationToken && Date.now() < Number(model.presentationLockedUntil || 0)) {
            if (model.presentationQueue.length) {
                holdingPresentationLock = false;
                model.presentationPlaying = false;
                void runPresentationQueue();
                return;
            }
            const reached = await waitUntil(model.presentationLockedUntil, token);
            if (!reached && token === model.presentationToken && model.presentationQueue.length) continue;
            if (!reached) {
                holdingPresentationLock = false;
                return;
            }
        }
        holdingPresentationLock = false;
        if (token !== model.presentationToken) return;
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        root?.classList.remove('is-presentation-playing');
        render();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        root?.classList.add('is-presentation-playing');
        render();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const batch = model.presentationQueue.shift();
            for (const event of batch?.events || []) {
                if (token !== model.presentationToken) break;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                const played = await playPresentationEvent(event, token);
                if (played === false && token !== model.presentationToken) break;
            }
        }
        if (token !== model.presentationToken) return;
        currentEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        model.presentationEvent = null;
        hidePresentation();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        root?.classList.remove('is-presentation-playing');
        render();
    }

    function enqueuePresentation(item) {
        const batch = legacyBatch(item);
        if (!batch?.events?.length) return;
        if (Number.isFinite(Number(batch.endsAt)) && Number(batch.endsAt) <= Date.now()) return;
        model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(batch.endsAt) || 0);
        model.presentationQueue.push(batch);
        model.presentationQueue.sort((left, right) => Number(left.sequence) - Number(right.sequence));
        if (holdingPresentationLock) cancelPresentationWaiters();
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
        holdingPresentationLock = false;
        model.presentationEvent = null;
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        hidePresentation();
        root?.classList.remove('is-presentation-playing');
        render();
    }

    return Object.freeze({
        getViewState,
        enqueuePresentation,
        skipPresentation,
        stopPresentation,
        isPlaying: () => Boolean(model.presentationPlaying || model.presentationQueue.length || Date.now() < Number(model.presentationLockedUntil || 0)),
        destroy: stopPresentation,
    });
}
