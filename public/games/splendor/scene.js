import { COLOR_LABELS, TIER_LABELS } from './constants.js';
import { cardBackMarkup, escapeHtml, eventGems, noblePortraitMarkup, paymentGems, presentationCardMarkup } from './cards.js';

/** Transaction and finale presentation queue for 璀璨宝石. */
export function createSplendorScene({ mount, model, getElement, windowRef = globalThis.window || globalThis }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)');

    function presentationDelay(duration, token) {
        const wait = reducedMotion?.matches ? Math.min(180, duration * .2) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: windowRef.setTimeout(() => {
                    model.presentationWaiters.delete(waiter);
                    resolve(token === model.presentationToken);
                }, wait),
                resolve,
            };
            model.presentationWaiters.add(waiter);
        });
    }

    function showPresentation(kind, html) {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `sp-presentation-layer is-active is-${kind}`;
        $('transactionStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'sp-presentation-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('transactionStage').innerHTML = '';
    }

    function playerAnchor(playerId) {
        const state = model.state;
        if (String(playerId) === String(state?.myId)) return $('guild');
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function marketAnchor(tier) {
        return mount.querySelector(`[data-market-tier="${Number(tier)}"]`) || mount.querySelector('.sp-market-stage');
    }

    function bankAnchor() {
        return mount.querySelector('.sp-command-panel .sp-bank') || mount.querySelector('.sp-command-panel');
    }

    function drawActionLine(fromElement, toElement, tone = 'gold') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(45, Math.min(155, Math.abs(x2 - x1) * .2 + Math.abs(y2 - y1) * .12));
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', `is-visible tone-${tone}`);
    }

    function setMotionOrigin(source, element) {
        if (!source || !element) return;
        const from = source.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--sp-from-x', `${from.left + from.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--sp-from-y', `${from.top + from.height / 2 - (target.top + target.height / 2)}px`);
    }

    function setMotionDestination(destination, element) {
        if (!destination || !element) return;
        const to = destination.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--sp-to-x', `${to.left + to.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--sp-to-y', `${to.top + to.height / 2 - (target.top + target.height / 2)}px`);
    }

    function nextFrame() {
        return new Promise(resolve => {
            const raf = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
            raf(() => raf(resolve));
        });
    }

    async function playTokenPresentation(event, token) {
        const returning = event.kind === 'returnTokens';
        showPresentation(returning ? 'return' : 'take', `<div class="sp-token-event"><span class="sp-event-kicker">${escapeHtml(event.playerName)}${returning ? '归还筹码' : '拿取公共宝石'}</span><div class="sp-gem-motion">${eventGems(event.colors)}</div><h2>${returning ? '宝石归还银行' : '宝石收入商会'}</h2><p>${event.tokenTotalBefore} → ${event.tokenTotalAfter} 枚筹码</p></div>`);
        const motion = $('transactionStage').querySelector('.sp-gem-motion');
        const source = returning ? playerAnchor(event.playerId) : bankAnchor();
        const destination = returning ? bankAnchor() : playerAnchor(event.playerId);
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, returning ? 'return' : 'gem');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(390, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, returning ? 'return' : 'gem');
        destination?.classList.add('is-event-impact');
        if (!await presentationDelay(720, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(250, token);
    }

    function reserveCardStage(event) {
        const face = event.card ? presentationCardMarkup(event.card, 'is-reserve-face') : '';
        const back = cardBackMarkup(event.tier);
        return `<div class="sp-reserve-card ${event.source === 'deck' ? 'starts-hidden' : ''}">${face ? `<div class="sp-reserve-side is-face">${face}</div>` : ''}<div class="sp-reserve-side is-back">${back}</div></div>`;
    }

    async function playReservePresentation(event, token) {
        const hiddenDraw = event.source === 'deck';
        showPresentation('reserve', `<div class="sp-reserve-event"><span class="sp-event-kicker">${escapeHtml(event.playerName)}预留发展卡</span><div class="sp-card-motion">${reserveCardStage(event)}</div><h2>${hiddenDraw ? `暗中预留 ${TIER_LABELS[event.tier] || event.tier} 级卡牌` : '公开商品已经锁定'}</h2><p>${event.gainedGold ? '同时获得一枚黄金筹码' : '黄金库存已空，仅保留卡牌'}</p>${event.gainedGold ? '<span class="sp-event-gold tone-gold"><i class="sp-gem"><b></b></i><small>黄金 +1</small></span>' : ''}</div>`);
        const motion = $('transactionStage').querySelector('.sp-card-motion');
        const source = marketAnchor(event.tier);
        const destination = playerAnchor(event.playerId);
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'reserve');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(hiddenDraw ? 520 : 620, token)) return;
        $('presentationLayer').classList.add('is-sealed');
        if (!await presentationDelay(hiddenDraw ? 160 : 430, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'reserve');
        destination?.classList.add('is-event-impact');
        await presentationDelay(720, token);
    }

    async function playBuyPresentation(event, token) {
        const source = event.source === 'reserved' ? playerAnchor(event.playerId) : marketAnchor(event.tier);
        const destination = playerAnchor(event.playerId);
        const pointGain = Number(event.pointsAfter) - Number(event.pointsBefore);
        showPresentation('buy', `<div class="sp-buy-event"><span class="sp-event-kicker">${escapeHtml(event.playerName)}完成一笔购入</span><div class="sp-card-motion">${presentationCardMarkup(event.card)}</div><div class="sp-payment-strip">${paymentGems(event.payment) || '<span class="sp-free-payment">折扣覆盖全部费用</span>'}</div><h2>永久${escapeHtml(COLOR_LABELS[event.card?.bonus] || '')}色折扣 +1</h2><p>${pointGain > 0 ? `声望 ${event.pointsBefore} → ${event.pointsAfter}` : '本卡不提供额外声望'}</p></div>`);
        const motion = $('transactionStage').querySelector('.sp-card-motion');
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'card');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(520, token)) return;
        $('presentationLayer').classList.add('is-paid');
        drawActionLine(playerAnchor(event.playerId), bankAnchor(), 'payment');
        bankAnchor()?.classList.add('is-event-impact');
        if (!await presentationDelay(560, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'card');
        destination?.classList.add('is-event-impact');
        await presentationDelay(760, token);
    }

    async function playNoblePresentation(event, token) {
        const destination = playerAnchor(event.playerId);
        showPresentation('noble', `<div class="sp-noble-event"><span class="sp-event-kicker">贵族正式来访</span><div class="sp-noble-motion">${noblePortraitMarkup(event.noble, 'sp-event-noble')}</div><h2>${escapeHtml(event.noble?.name || '贵族')}认可了${escapeHtml(event.playerName)}的商会</h2><p>声望 ${event.pointsBefore} → ${event.pointsAfter} · +${Number(event.noble?.points) || 3}</p></div>`);
        const motion = $('transactionStage').querySelector('.sp-noble-motion');
        const source = mount.querySelector('.sp-nobles-panel');
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'noble');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(720, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'noble');
        destination?.classList.add('is-event-impact');
        await presentationDelay(820, token);
    }

    async function playFinalRoundPresentation(batch, token) {
        const trigger = batch.finalRoundTrigger || {};
        showPresentation('final-round', `<div class="sp-final-round-cue"><span class="sp-final-bell" aria-hidden="true"><i></i></span><span class="sp-event-kicker">商会钟声响起</span><h2>最后一轮开始</h2><p>${escapeHtml(trigger.playerName || '有玩家')}达到 ${Number(trigger.points) || 15} 点声望 · 完成本轮后结算</p></div>`);
        await nextFrame();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(1500, token);
    }

    async function playFinalePresentation(batch, token) {
        if (batch.endReason !== 'points') return;
        const winners = new Set((batch.winners || []).map(player => String(player.id)));
        const winnerNames = (batch.winners || []).map(player => player.name).join('、') || '无人';
        const standings = batch.standings || [];
        showPresentation('finale', `<div class="sp-finale-scene"><span class="sp-event-kicker">最后一轮完成</span><div class="sp-finale-mark" aria-hidden="true">◆</div><h2>${escapeHtml(winnerNames)}${winners.size > 1 ? '共享商会荣光' : '赢得宝石商会'}</h2><div class="sp-final-standings">${standings.map((player, index) => `<article class="${winners.has(String(player.id)) ? 'is-winner' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}</strong><b>${Number(player.points) || 0}<small>声望</small></b><em>${Number(player.cardCount) || 0} 张发展卡</em></article>`).join('')}</div><p>${winners.size > 1 ? '声望与发展卡数量均相同，并列获胜' : '同分时，发展卡更少者排名更高'}</p></div>`);
        await nextFrame();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2600, token);
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying) return;
        model.presentationPlaying = true;
        mount.querySelector('.sp-app')?.classList.add('is-transaction-presenting');
        while (model.presentationQueue.length) {
            const item = model.presentationQueue.shift();
            const token = ++model.presentationToken;
            for (const event of item.batch?.events || []) {
                if (event.kind === 'takeTokens' || event.kind === 'returnTokens') await playTokenPresentation(event, token);
                if (event.kind === 'reserveCard') await playReservePresentation(event, token);
                if (event.kind === 'buyCard') await playBuyPresentation(event, token);
                if (event.kind === 'nobleVisit') await playNoblePresentation(event, token);
                if (token !== model.presentationToken) break;
                hidePresentation();
                if (!await presentationDelay(90, token)) break;
            }
            if (token !== model.presentationToken) continue;
            if (item.batch?.finalRoundStarted && !item.batch?.ended) await playFinalRoundPresentation(item.batch, token);
            if (token !== model.presentationToken) continue;
            if (item.batch?.ended || item.finaleOnly) await playFinalePresentation(item.batch, token);
            if (token === model.presentationToken) hidePresentation();
        }
        hidePresentation();
        model.presentationPlaying = false;
        mount.querySelector('.sp-app')?.classList.remove('is-transaction-presenting');
    }

    function enqueuePresentation(item) {
        model.presentationQueue.push(item);
        void runPresentationQueue();
    }

    function stopPresentation() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        for (const waiter of model.presentationWaiters) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        model.presentationWaiters.clear();
        hidePresentation();
        model.presentationPlaying = false;
        mount.querySelector('.sp-app')?.classList.remove('is-transaction-presenting');
    }

    return { enqueuePresentation, stopPresentation, isPlaying: () => model.presentationPlaying, destroy: stopPresentation };
}
