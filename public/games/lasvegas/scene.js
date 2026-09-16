import { escapeHtml, renderDie } from './constants.js';
import { playerById, playerTone } from './state.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Server-timed casino scenes.  The browser only renders a slot assigned by the engine. */
export function createLasVegasScene({ mount, model, getElement, renderer = null, windowRef = globalThis.window || globalThis, onPresentationStart = () => {} }) {
    const $ = role => getElement(role);
    const state = () => model.state;
    const reducedMotion = Boolean(windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let currentContentDeadline = Number.POSITIVE_INFINITY;

    function clearPresentationTargets() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target'));
        $('actionLine')?.classList.remove('is-visible');
    }

    function presentationAnchor(kind, value) {
        if (kind === 'player') return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(value)) || null;
        if (kind === 'casino') return mount.querySelector(`[data-casino-face="${Number(value)}"]`);
        if (kind === 'bank') return $('bankAnchor');
        if (kind === 'dice') return $('dice');
        return null;
    }

    function drawActionLine(fromElement, toElement, tone = 'gold') {
        if (!fromElement || !toElement || reducedMotion) return;
        const svg = $('actionLine');
        if (!svg) return;
        const line = svg.querySelector('line');
        const head = svg.querySelector('circle');
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        svg.setAttribute('viewBox', `0 0 ${windowRef.innerWidth || 1} ${windowRef.innerHeight || 1}`);
        line?.setAttribute('x1', x1);
        line?.setAttribute('y1', y1);
        line?.setAttribute('x2', x2);
        line?.setAttribute('y2', y2);
        head?.setAttribute('cx', x2);
        head?.setAttribute('cy', y2);
        svg.dataset.tone = tone;
        svg.classList.add('is-visible');
        fromElement.classList.add('is-presentation-source');
        toElement.classList.add('is-presentation-target');
    }

    function cancelPresentationWait() {
        for (const waiter of model.presentationWaiters || []) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        model.presentationWaiters?.clear();
    }

    function waitUntil(timestamp, token) {
        if (token !== model.presentationToken) return Promise.resolve(false);
        const target = Number(timestamp);
        if (!Number.isFinite(target) || target <= Date.now()) return Promise.resolve(true);
        return new Promise(resolve => {
            const waiter = {
                timer: windowRef.setTimeout(() => {
                    model.presentationWaiters.delete(waiter);
                    resolve(token === model.presentationToken);
                }, Math.max(0, target - Date.now())),
                resolve,
            };
            model.presentationWaiters.add(waiter);
        });
    }

    function waitForPresentation(milliseconds, token) {
        const relativeTarget = Date.now() + Math.max(0, Number(milliseconds) || 0);
        return waitUntil(Math.min(relativeTarget, currentContentDeadline), token);
    }

    function showPresentation(kind, html, options = {}) {
        onPresentationStart?.();
        const layer = $('presentationLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        clearPresentationTargets();
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `lv-presentation-layer is-${kind} ${options.major ? 'is-major' : ''} ${options.compact ? 'is-compact' : ''}`;
        $('presentationScene').innerHTML = html;
        windowRef.requestAnimationFrame?.(() => layer.classList.add('is-visible'));
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        clearPresentationTargets();
        layer.className = 'lv-presentation-layer';
        layer.hidden = true;
        layer.setAttribute('aria-hidden', 'true');
        $('presentationScene').innerHTML = '';
    }

    async function fadeThenHide(token) {
        const layer = $('presentationLayer');
        if (!layer) return true;
        beginPresentationFade(layer);
        const deadline = Number.isFinite(currentEventDeadline) ? currentEventDeadline : Date.now() + PRESENTATION_FADE_MS;
        if (!await waitUntil(deadline, token)) return false;
        hidePresentation();
        return true;
    }

    function diceBundle(values, className = '') {
        return (values || []).map(value => renderDie(value, `lv-event-die ${className}`)).join('') || '<span class="lv-event-none">无</span>';
    }

    function casinoDiceRows(event) {
        const tiedIds = new Set((event.ties || []).flatMap(tie => tie.participants || []).map(player => player.id));
        return Object.entries(event.diceBefore || {})
            .sort((left, right) => Number(right[1]) - Number(left[1]))
            .map(([id, count]) => {
                const player = playerById(state(), id) || { name: id === 'neutral' ? '中立骰子' : id, color: id === 'neutral' ? 'neutral' : 'gold' };
                return `<span class="lv-result-player tone-${escapeHtml(playerTone(player))} ${tiedIds.has(id) ? 'is-cancelled' : ''}"><i></i><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(count)} 枚</b>${tiedIds.has(id) ? '<em>平手作废</em>' : ''}</span>`;
            })
            .join('') || '<span class="lv-event-none">无人下注</span>';
    }

    function casinoSettlementMarkup(event, award = '核对多数与奖金顺位') {
        const money = (event.moneyBefore || []).map(value => `<b>${escapeHtml(value)}<small>万</small></b>`).join('');
        return `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮 · 赌场结算</span><h2>${escapeHtml(event.face)}号 · ${escapeHtml(event.casinoName)}</h2><div class="lv-settlement-money">${money || '<span>没有奖金</span>'}</div><div class="lv-settlement-dice">${casinoDiceRows(event)}</div><div class="lv-settlement-award" data-role="eventAward"><span>${award}</span></div>`;
    }

    async function playCasinoSettlement(event, token) {
        const payouts = event.payouts || [];
        const returned = event.returnedBills || [];
        const fallbackStart = Date.now();
        const fallbackSegments = [{ kind: 'review', startedAt: fallbackStart, endsAt: fallbackStart + ((event.ties || []).length ? 800 : 520) }];
        if (payouts.length) payouts.forEach((_, index) => {
            const previous = fallbackSegments.at(-1).endsAt;
            fallbackSegments.push({ kind: 'payout', index, startedAt: previous, endsAt: previous + 850 });
        });
        if (!payouts.length) {
            const previous = fallbackSegments.at(-1).endsAt;
            fallbackSegments.push({ kind: 'returnToBank', startedAt: previous, endsAt: previous + 500 });
        }
        const segments = Array.isArray(event.segments) && event.segments.length ? event.segments : fallbackSegments;
        for (const segment of segments) {
            if (token !== model.presentationToken) return false;
            if (Number.isFinite(Number(segment.endsAt)) && Number(segment.endsAt) <= Date.now()) continue;
            const payout = segment.kind === 'payout' ? payouts[Number(segment.index)] : null;
            const award = segment.kind === 'review'
                ? (payouts.length ? '核对多数与奖金顺位' : returned.length ? '无人取得奖金，钞票返回牌库' : '本桌结算完成')
                : segment.kind === 'returnToBank'
                    ? '无人取得奖金，钞票返回牌库'
                    : payout?.returnedToBank
                        ? `${escapeHtml(payout.playerName)} 取得多数，但 ${escapeHtml(payout.amount)} 万返回牌库`
                        : `${escapeHtml(payout?.playerName || '玩家')} 凭 ${escapeHtml(payout?.dice || 0)} 枚骰子获得 +${escapeHtml(payout?.amount || 0)} 万`;
            showPresentation('casino-settlement', casinoSettlementMarkup(event, award), { major: true });
            const casinoAnchor = presentationAnchor('casino', event.face);
            if (segment.kind === 'review') casinoAnchor?.classList.add('is-presentation-target');
            if (segment.kind === 'payout' && payout) {
                const target = presentationAnchor(payout.returnedToBank ? 'bank' : 'player', payout.playerId);
                drawActionLine(casinoAnchor, target, payout.returnedToBank ? 'neutral' : payout.playerColor || 'gold');
            }
            if (segment.kind === 'returnToBank') drawActionLine(casinoAnchor, presentationAnchor('bank'), 'neutral');
            if (!await waitUntil(Math.min(Number(segment.endsAt), currentContentDeadline), token)) return false;
        }
        return true;
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return false;
        if (event.kind === 'diceRolled') {
            showPresentation('dice-rolled', `<span class="lv-event-kicker">轮到 ${escapeHtml(event.actorName)}</span><h2>骰子落盘</h2><div class="lv-event-rolls"><div class="tone-${escapeHtml(event.actorColor)}"><small>自有骰 · ${event.ownResults?.length || 0} 枚</small><span>${diceBundle(event.ownResults, 'is-own')}</span></div>${event.neutralResults?.length ? `<div class="tone-neutral"><small>中立骰 · ${event.neutralResults.length} 枚</small><span>${diceBundle(event.neutralResults, 'is-neutral')}</span></div>` : ''}</div>`, { compact: true });
            drawActionLine(presentationAnchor('player', event.actorId), presentationAnchor('dice'), event.actorColor);
            return waitForPresentation(900, token);
        }
        if (event.kind === 'dicePlaced') {
            const ownDice = Array.from({ length: Math.min(event.ownCount || 0, 8) }, () => event.face);
            const neutralDice = Array.from({ length: Math.min(event.neutralCount || 0, 8) }, () => event.face);
            showPresentation('dice-placed', `<span class="lv-event-kicker">${escapeHtml(event.actorName)} 作出选择</span><h2>押注 ${escapeHtml(event.face)}号 · ${escapeHtml(event.casinoName)}</h2><div class="lv-event-place"><div class="tone-${escapeHtml(event.actorColor)}">${diceBundle(ownDice, 'is-own')}</div>${neutralDice.length ? `<div class="tone-neutral">${diceBundle(neutralDice, 'is-neutral')}</div>` : ''}<strong>共 ${escapeHtml(event.totalCount)} 枚</strong></div><p>自有 ${escapeHtml(event.ownCount)} 枚${event.neutralCount ? ` · 中立 ${escapeHtml(event.neutralCount)} 枚` : ''}</p>`, { compact: true });
            drawActionLine(presentationAnchor('player', event.actorId), presentationAnchor('casino', event.face), event.actorColor);
            return waitForPresentation(950, token);
        }
        if (event.kind === 'betsClosed') {
            showPresentation('bets-closed', `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮</span><h2>所有赌场 · 正式封盘</h2><p>六家赌场将依次核对平手、排名与奖金。</p>`, { major: true });
            return waitForPresentation(1150, token);
        }
        if (event.kind === 'casinoSettlement') return playCasinoSettlement(event, token);
        if (event.kind === 'roundSettlement') {
            const standings = (event.standings || []).map((player, index) => `<li class="tone-${escapeHtml(player.color)}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><span>本轮 <b>+${escapeHtml(player.gained || 0)} 万</b></span><span>累计 ${escapeHtml(player.money)} 万 · ${escapeHtml(player.banknoteCount)} 张</span></li>`).join('');
            showPresentation('round-settlement', `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮结束</span><h2>本轮资金清点</h2><ol class="lv-event-standings">${standings}</ol>`, { major: true });
            return waitForPresentation(1500, token);
        }
        if (event.kind === 'roundTransition') {
            showPresentation('round-transition', `<span class="lv-event-kicker">赌桌换场</span><h2>第 ${escapeHtml(event.nextRound)} 轮即将开始</h2><p>${escapeHtml(event.nextStarterName)} 获得先手。</p>`, { major: true });
            return waitForPresentation(850, token);
        }
        if (event.kind === 'roundStarted') {
            const pools = (event.casinos || []).map(casino => `<span>${escapeHtml(casino.face)}号 <b>${casino.money.reduce((sum, value) => sum + Number(value || 0), 0)} 万</b></span>`).join('');
            const neutralCopy = Number(event.neutralDiceTotal) > 0 ? ` · 本局启用 ${escapeHtml(event.neutralDiceTotal)} 枚中立骰` : '';
            showPresentation('round-started', `<span class="lv-event-kicker">${Number(event.round) === 1 ? '拉斯维加斯正式开桌' : '奖金重新入场'}</span><h2>第 ${escapeHtml(event.round)} 轮开桌</h2><div class="lv-event-pools">${pools}</div><p>${escapeHtml(event.starterName)} 先掷骰${neutralCopy}。</p>`, { major: true });
            return waitForPresentation(1150, token);
        }
        if (event.kind === 'playerLeft') {
            const personal = event.viewerVariant === 'personalDeparture';
            showPresentation('player-left', `<span class="lv-event-kicker">赌场席位变动</span><h2>${escapeHtml(event.title || (personal ? '您已离开本局' : `${event.playerName} 离开了赌场`))}</h2><p>${escapeHtml(event.detail || `${event.playerName} 的席位已退出，剩余 ${event.remainingPlayerCount || 0} 位玩家继续。`)}</p>`, { major: true });
            drawActionLine(presentationAnchor('player', event.playerId), $('presentationScene'), 'neutral');
            return waitForPresentation(900, token);
        }
        if (event.kind === 'finalSettlement') {
            const winners = new Set((event.winnerIds || []).map(String));
            const winnerNames = (event.standings || []).filter(player => winners.has(String(player.id))).map(player => player.name).join('、') || '最高资金玩家';
            const rows = (event.standings || []).map((player, index) => `<li class="tone-${escapeHtml(player.color)} ${winners.has(String(player.id)) ? 'is-winner' : ''}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.money)} 万</span><small>${escapeHtml(player.banknoteCount)} 张钞票${winners.has(String(player.id)) ? ' · 最终赢家' : ''}</small></li>`).join('');
            const title = event.title || `${winnerNames}${winners.size > 1 ? '并列称霸拉斯维加斯' : '成为今晚的赌场之王'}`;
            const detail = event.detail || '现金同分时，以钞票张数决定最终名次。';
            showPresentation('final-settlement', `<span class="lv-event-kicker">四轮赌局结束</span><h2>${escapeHtml(title)}</h2><ol class="lv-final-standings">${rows}</ol><p>${escapeHtml(detail)}</p>`, { major: true });
            return waitForPresentation(2800, token);
        }
        return waitForPresentation(820, token);
    }

    async function holdPresentationLock(token) {
        const deadline = Number(model.presentationLockedUntil) || 0;
        if (deadline > Date.now() && !await waitUntil(deadline, token)) return;
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
            const batch = model.presentationQueue.shift();
            for (const event of batch.events || []) {
                if (token !== model.presentationToken) break;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                if (Number.isFinite(Number(event.startedAt)) && !await waitUntil(event.startedAt, token)) break;
                currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Number.POSITIVE_INFINITY;
                currentContentDeadline = Number.isFinite(currentEventDeadline) ? Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS) : Number.POSITIVE_INFINITY;
                model.presentationEvent = event;
                if (currentContentDeadline > Date.now() && !await playPresentationEvent(event, token)) break;
                if (token !== model.presentationToken) break;
                if (Number.isFinite(currentContentDeadline) && !await waitUntil(currentContentDeadline, token)) break;
                if (!await fadeThenHide(token)) break;
            }
        }
        if (token !== model.presentationToken) return;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        model.presentationEvent = null;
        hidePresentation();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        renderer?.render?.();
    }

    function enqueuePresentation(batch) {
        if (!batch?.events?.length) return;
        if (Number.isFinite(Number(batch.endsAt))) {
            if (Number(batch.endsAt) <= Date.now()) return;
            model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(batch.endsAt));
        }
        for (const event of batch.events) {
            if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
            model.presentationQueue.push({ ...batch, events: [event] });
        }
        void drainPresentations();
    }

    function skipPresentations() {
        const token = ++model.presentationToken;
        cancelPresentationWait();
        hidePresentation();
        model.presentationEvent = null;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        model.presentationPlaying = false;
        renderer?.render?.();
        if (model.presentationQueue.length) {
            void drainPresentations();
        } else if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            model.presentationPlaying = true;
            renderer?.render?.();
            void holdPresentationLock(token);
        }
    }

    function stop() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        cancelPresentationWait();
        hidePresentation();
        model.presentationPlaying = false;
        model.presentationEvent = null;
        model.presentationLockedUntil = 0;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
    }

    return {
        enqueuePresentation,
        skipPresentations,
        stop,
        isPlaying: () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0),
    };
}
