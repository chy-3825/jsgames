import { COLOR_HEX, COLOR_LABELS } from './constants.js';
import { escapeHtml, publicCardMarkup } from './cards.js';
import { playerGroupsFromState, victorySource } from './state.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/**
 * Server-timed presentation queue for 大富翁纸牌.
 *
 * Every event is received with an absolute server deadline. The client only
 * renders that slot; it never starts a second, state-diff based animation.
 * This makes a refresh, a slow tab, and reduced-motion preferences converge on
 * the same next-phase boundary.
 */
export function createMonopolyDealScene({
    mount,
    model,
    getElement,
    windowRef = globalThis.window || globalThis,
    renderer = null,
    onEvent = () => {},
    onPresentationStart = () => {},
    onPresentationEnd = () => {},
}) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    const root = () => mount.querySelector('.deal-game');
    const now = () => Date.now();

    model.presentationQueue ||= [];
    model.presentationEventIds ||= new Set();
    model.presentationWaiters ||= new Set();
    model.presentationLockedUntil ||= 0;
    model.presentationToken ||= 0;
    model.presentationPlaying ||= false;
    model.presentationEvent ||= null;

    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let currentContentDeadline = Number.POSITIVE_INFINITY;

    function playerName(id, fallback = '') {
        return (state()?.players || []).find(player => player.id === id)?.name || fallback || '玩家';
    }

    function playerAnchor(id) {
        if (!id) return null;
        return [...mount.querySelectorAll('[data-player-id]')].find(element => String(element.dataset.playerId) === String(id)) || null;
    }

    function clearActionLinks() {
        const svg = $('actionLinks');
        svg?.classList.remove('has-action', 'has-response');
    }

    function eventRoute(event) {
        let sourceId = event.actorId || event.playerId || event.payerId || event.fromId;
        let targetId = event.targetId || event.responsePlayerId || event.creditorId || event.toId || event.nextPlayerId;
        // Transfer events name the recipient as actor and the previous owner
        // as target; draw the public line in the same direction as the cards.
        if (['groupTakenOver', 'propertyTransferred'].includes(event.kind)) {
            [sourceId, targetId] = [event.targetId, event.actorId];
        } else if (event.kind === 'justSayNoPlayed') {
            [sourceId, targetId] = [event.playerId, event.responsePlayerId || event.actorId];
        }
        return { sourceId, targetId };
    }

    function centerOf(element) {
        if (!element?.getBoundingClientRect) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function drawEventRoute(event) {
        const { sourceId, targetId } = eventRoute(event);
        const source = playerAnchor(sourceId);
        const target = playerAnchor(targetId);
        const svg = $('actionLinks');
        if (!source || !target || sourceId === targetId || !svg) {
            clearActionLinks();
            return;
        }
        const from = centerOf(source); const to = centerOf(target);
        if (!from || !to) { clearActionLinks(); return; }
        const width = windowRef.innerWidth || globalThis.innerWidth || 1;
        const height = windowRef.innerHeight || globalThis.innerHeight || 1;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const fromX = clamp(from.x, 12, Math.max(12, width - 12));
        const fromY = clamp(from.y, 12, Math.max(12, height - 12));
        const toX = clamp(to.x, 12, Math.max(12, width - 12));
        const toY = clamp(to.y, 12, Math.max(12, height - 12));
        const bend = ['assetsTransferred', 'propertyTransferred', 'propertiesSwapped', 'paymentRequested', 'justSayNoPlayed'].includes(event.kind) ? 1 : -1;
        const middleX = (fromX + toX) / 2 + bend * Math.min(62, Math.abs(toY - fromY) * .1);
        const middleY = (fromY + toY) / 2 + bend * Math.min(70, Math.max(22, Math.abs(toX - fromX) * .11));
        const path = `M ${fromX} ${fromY} Q ${middleX} ${middleY} ${toX} ${toY}`;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        const response = ['responseRequested', 'justSayNoPlayed', 'paymentRequested', 'assetsTransferred', 'propertyTransferred', 'propertiesSwapped'].includes(event.kind);
        const type = response ? 'response' : 'action';
        const glow = $(`${type}LinkGlow`); const stroke = $(`${type}LinkStroke`); const seal = $(`${type}LinkSeal`);
        glow?.setAttribute('d', path); stroke?.setAttribute('d', path); seal?.setAttribute('cx', String(toX)); seal?.setAttribute('cy', String(toY));
        svg.classList.toggle('has-action', !response); svg.classList.toggle('has-response', response);
    }

    function cancelPresentationWait() {
        for (const waiter of model.presentationWaiters) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        model.presentationWaiters.clear();
        if (model.waitTimer) windowRef.clearTimeout(model.waitTimer);
        model.waitTimer = null;
        const release = model.releaseWait;
        model.releaseWait = null;
        release?.(false);
    }

    function waitUntil(timestamp, token) {
        if (token !== model.presentationToken) return Promise.resolve(false);
        const target = Number(timestamp);
        if (!Number.isFinite(target) || target <= now()) return Promise.resolve(true);
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                done: false,
                resolve(value) {
                    if (waiter.done) return;
                    waiter.done = true;
                    model.presentationWaiters.delete(waiter);
                    windowRef.clearTimeout(waiter.timer);
                    resolve(value);
                },
            };
            waiter.timer = windowRef.setTimeout(() => waiter.resolve(token === model.presentationToken), Math.max(0, target - now()));
            model.presentationWaiters.add(waiter);
        });
    }

    function eventTitle(event) {
        const action = event.actionType === 'rent' ? '租金' : ({
            dealBreaker: '物业接管', justSayNo: '做出反对', passGo: '通行证', doubleRent: '双倍租金',
            debtCollector: '收取债务', birthday: '我的生日', slyDeal: '盗取', forcedDeal: '强制交易',
            house: '房子', hotel: '酒店',
        }[event.actionType] || event.actionType || '行动');
        if (event.kind === 'gameStarted') return '牌局已开始';
        if (event.kind === 'cardsDrawn') return `${event.playerName || playerName(event.playerId)}摸了 ${event.amount || 0} 张牌`;
        if (event.kind === 'cardPlayed' || event.kind === 'propertyPlayed') return `${event.playerName || playerName(event.playerId)}打出${event.card?.name || action}`;
        if (event.kind === 'propertyMoved') return `${event.playerName || playerName(event.playerId)}调整地产分组`;
        if (event.kind === 'actionPresented') return `${event.actorName || playerName(event.actorId)}发起${action}`;
        if (event.kind === 'responseRequested') return `${event.playerName || playerName(event.playerId)}等待回应`;
        if (event.kind === 'justSayNoPlayed') return `${event.playerName || playerName(event.playerId)}打出“做出反对”`;
        if (event.kind === 'actionAccepted') return `${event.playerName || playerName(event.playerId)}接受${action}`;
        if (event.kind === 'actionCancelled') return event.message || `${action}已取消`;
        if (event.kind === 'paymentRequested') return `${event.payerName || playerName(event.payerId)}需要支付 ${event.amount || 0}M`;
        if (event.kind === 'assetsTransferred') return `${event.payerName || playerName(event.payerId)}支付 ${event.amount || 0}M`;
        if (event.kind === 'propertyTransferred') return `${event.actorName || playerName(event.actorId)}盗取${event.targetName || playerName(event.targetId)}的地产`;
        if (event.kind === 'propertiesSwapped') return `${event.actorName || playerName(event.actorId)}与${event.targetName || playerName(event.targetId)}交换地产`;
        if (event.kind === 'groupTakenOver') return `${event.actorName || playerName(event.actorId)}接管${event.targetName || playerName(event.targetId)}的地产组`;
        if (event.kind === 'groupCompleted') return `${event.playerName || playerName(event.playerId)}完成地产组`;
        if (event.kind === 'actionResolved') return event.message || '行动已结算';
        if (event.kind === 'turnStarted') return `轮到${event.nextPlayerName || playerName(event.nextPlayerId)}`;
        if (event.kind === 'playerLeft') return event.title || `${event.playerName || playerName(event.playerId)}离开了牌局`;
        if (event.kind === 'finalSettlement') return event.title || `${event.winnerName || playerName(event.winnerId)}赢得大富翁纸牌`;
        return event.message || '牌桌状态已更新';
    }

    function eventKicker(event) {
        if (event.kind === 'finalSettlement') return event.viewerVariant === 'personalVictory' ? '个人终局播报' : '牌局结算';
        if (event.kind === 'playerLeft') return '席位变动';
        if (['assetsTransferred', 'paymentRequested', 'propertyTransferred', 'propertiesSwapped', 'groupTakenOver'].includes(event.kind)) return '公开交易线';
        if (['responseRequested', 'justSayNoPlayed', 'actionAccepted', 'actionCancelled'].includes(event.kind)) return '行动回应';
        return '牌桌播报';
    }

    function eventBody(event) {
        const card = event.card ? publicCardMarkup(event.card, 'deal-event-card') : '';
        const target = event.targetName || event.targetId ? `<span>${escapeHtml(event.targetName || playerName(event.targetId))}</span>` : '';
        const actor = event.actorName || event.playerName || event.payerName || event.playerId ? `<strong>${escapeHtml(event.actorName || event.playerName || event.payerName || playerName(event.playerId))}</strong>` : '';
        const route = actor && target && actor !== target ? `<div class="deal-public-route"><span>${actor}<i>→</i><strong>${target}</strong></span></div>` : '';
        const amount = Number(event.amount);
        const amountCopy = Number.isFinite(amount) && amount > 0 ? `<em class="deal-event-amount">${amount}M</em>` : '';
        const detail = event.detail || event.message || (event.kind === 'groupCompleted' ? `已完成 ${event.completedSets || 0} 组地产` : '服务器已锁定下一阶段开始时间。');
        return `${route}${card ? `<div class="deal-event-card-slot">${card}</div>` : ''}${amountCopy}<p>${escapeHtml(detail)}</p>`;
    }

    function renderGenericEvent(event) {
        const layer = $('victoryLayer');
        layer.className = `deal-victory-layer is-active is-public-event is-event-${String(event.kind || 'generic').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        $('victoryScene').innerHTML = `<span class="deal-victory-kicker">${escapeHtml(eventKicker(event))}</span><div class="deal-public-event-mark" aria-hidden="true">交</div><h2>${escapeHtml(eventTitle(event))}</h2><div class="deal-public-event-body">${eventBody(event)}</div>`;
    }

    function renderTakeoverEvent(event) {
        const color = COLOR_LABELS[event.color] || event.color || '完整';
        const actor = event.actorName || playerName(event.actorId);
        const target = event.targetName || playerName(event.targetId);
        $('victoryScene').innerHTML = `<span class="deal-victory-kicker">重大交易</span><div class="deal-takeover-mark" aria-hidden="true">组</div><h2>${escapeHtml(actor)}接管${escapeHtml(target)}的${escapeHtml(color)}地产组</h2><div class="deal-takeover-route"><span>${escapeHtml(target)}</span><i>→</i><strong>${escapeHtml(actor)}</strong></div><p>物业接管生效，${event.cardIds?.length || 0} 张地产及附属建筑整组转移。</p>`;
    }

    function renderFinalEvent(event) {
        const current = state() || {};
        const winnerIds = new Set((event.winnerIds || (event.winnerId ? [event.winnerId] : [])).map(String));
        const personal = event.viewerVariant === 'personalVictory' || winnerIds.has(String(current.myId || ''));
        const departed = event.viewerVariant === 'personalDeparture';
        const winnerNames = (event.standings || []).filter(player => winnerIds.has(String(player.id))).map(player => player.name).join('、') || event.winnerName || '本局赢家';
        const winner = (current.players || []).find(player => String(player.id) === String(event.winnerId || current.winner?.id));
        const groups = playerGroupsFromState(current, winner).filter(group => group.isComplete).slice(0, 3);
        const groupMarkup = groups.map(group => `<article style="--victory-color:${COLOR_HEX[group.color] || '#927a58'}"><i></i><strong>${escapeHtml(COLOR_LABELS[group.color] || group.color)}</strong><span>${group.cards.length} 张地产</span></article>`).join('');
        const rows = (event.standings || []).map(player => `<span class="${winnerIds.has(String(player.id)) ? 'is-winner' : ''}"><i>${player.rank}</i><b>${escapeHtml(player.name)}</b><em>${player.completedSets || 0} 组</em></span>`).join('');
        const title = departed ? '您已离开本局' : personal ? '您已获胜' : `${escapeHtml(winnerNames)}${winnerIds.size > 1 ? '共同获胜' : '赢得大富翁纸牌'}`;
        const detail = departed
            ? (event.detail || '您已离开本局，其他玩家继续完成结算。')
            : personal
            ? (event.detail || '您已完成三个不同颜色的地产组。')
            : (event.message || '三个不同颜色的完整地产组已经建成。');
        $('victoryScene').innerHTML = `<span class="deal-victory-kicker">${personal || departed ? '个人终局播报' : '地产帝国落成'}</span><div class="deal-victory-seal">交</div><h2>${title}</h2>${!departed ? `<div class="deal-victory-source"><span>致胜行动</span><strong>${escapeHtml(event.source || victorySource(current))}</strong></div>${groupMarkup ? `<div class="deal-victory-groups">${groupMarkup}</div>` : ''}${rows ? `<div class="deal-final-ranking">${rows}</div>` : ''}` : ''}<p>${escapeHtml(detail)}</p>`;
    }

    function showEvent(event) {
        const layer = $('victoryLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        root()?.classList.add('is-scene-active');
        layer.className = `deal-victory-layer is-active is-event-${String(event.kind || 'generic').replace(/[^a-zA-Z0-9_-]/g, '')}`;
        if (event.kind === 'groupTakenOver') renderTakeoverEvent(event);
        else if (event.kind === 'finalSettlement') renderFinalEvent(event);
        else renderGenericEvent(event);
        drawEventRoute(event);
        onEvent?.(event);
        onPresentationStart?.(event);
        const raf = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
        raf(() => layer.classList.add('is-revealed'));
    }

    function hideEvent() {
        const layer = $('victoryLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.hidden = true;
        layer.className = 'deal-victory-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('victoryScene').innerHTML = '';
        clearActionLinks();
        root()?.classList.remove('is-scene-active');
        onEvent?.(null);
        onPresentationEnd?.();
    }

    function fadeThenHide(token) {
        const layer = $('victoryLayer');
        beginPresentationFade(layer);
        const deadline = Number.isFinite(currentEventDeadline) ? currentEventDeadline : now() + PRESENTATION_FADE_MS;
        return waitUntil(deadline, token).then(continued => {
            if (continued) hideEvent();
            return continued;
        });
    }

    async function holdPresentationLock(token) {
        const deadline = Number(model.presentationLockedUntil) || 0;
        if (deadline > now() && !await waitUntil(deadline, token)) return;
        if (token !== model.presentationToken) return;
        model.presentationPlaying = false;
        model.presentationEvent = null;
        renderer?.render?.();
        if (model.presentationQueue.length) void drainPresentations();
    }

    async function drainPresentations() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        renderer?.render?.();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const presentation = model.presentationQueue.shift();
            for (const event of presentation.events || []) {
                if (token !== model.presentationToken) break;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= now()) continue;
                if (Number.isFinite(Number(event.startedAt)) && !await waitUntil(event.startedAt, token)) break;
                currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Number.POSITIVE_INFINITY;
                currentContentDeadline = Number.isFinite(currentEventDeadline) ? Math.max(now(), currentEventDeadline - PRESENTATION_FADE_MS) : Number.POSITIVE_INFINITY;
                model.presentationEvent = event;
                if (currentContentDeadline > now()) showEvent(event);
                if (token !== model.presentationToken) break;
                if (Number.isFinite(currentContentDeadline) && !await waitUntil(currentContentDeadline, token)) break;
                if (!await fadeThenHide(token)) break;
            }
        }
        if (token !== model.presentationToken) return;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        model.presentationEvent = null;
        hideEvent();
        if (now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        renderer?.render?.();
    }

    function enqueuePresentation(presentation) {
        if (!presentation?.events?.length) return;
        if (Number.isFinite(Number(presentation.endsAt))) {
            if (Number(presentation.endsAt) <= now()) return;
            model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(presentation.endsAt));
        }
        for (const event of presentation.events) {
            if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= now()) continue;
            model.presentationQueue.push({ ...presentation, events: [event] });
        }
        model.presentationQueue.sort((left, right) => Number(left.events?.[0]?.startedAt || left.startedAt || 0) - Number(right.events?.[0]?.startedAt || right.startedAt || 0));
        void drainPresentations();
    }

    function skipPresentation() {
        const token = ++model.presentationToken;
        cancelPresentationWait();
        hideEvent();
        model.presentationEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        model.presentationPlaying = false;
        renderer?.render?.();
        if (model.presentationQueue.length) void drainPresentations();
        else if (now() < Number(model.presentationLockedUntil || 0)) {
            model.presentationPlaying = true;
            renderer?.render?.();
            void holdPresentationLock(token);
        }
    }

    function stop() {
        model.presentationToken += 1;
        cancelPresentationWait();
        model.presentationQueue = [];
        model.presentationPlaying = false;
        model.presentationEvent = null;
        model.presentationLockedUntil = 0;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        hideEvent();
        renderer?.render?.();
    }

    return {
        enqueuePresentation,
        skipPresentation,
        stop,
        isPlaying: () => model.presentationPlaying || now() < Number(model.presentationLockedUntil || 0),
        destroy: stop,
    };
}
