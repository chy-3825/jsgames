import { escapeHtml, GOODS, GOOD_META } from './constants.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Presentation queue and voyage animations for 马尼拉. */
export function createManilaScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, renderCommand, renderer = null, onPresentationStart = () => {} }) {
    const $ = role => getElement(role);
    model.presentationWaiters ||= new Set();
    model.presentationQueue ||= [];
    model.presentationToken ||= 0;
    model.presentationLockedUntil ||= 0;
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let currentContentDeadline = Number.POSITIVE_INFINITY;

    function playerName(playerId, fallback = '商人') { return model.state?.players?.find(player => player.id === playerId)?.name || fallback; }
    function boatName(boatId, fallback = '货船') { const boat = model.state?.boats?.find(candidate => Number(candidate.id) === Number(boatId)); return boat?.good ? `${boat.good}货船` : fallback; }
    function findByData(attribute, value) { return [...mount.querySelectorAll(`[${attribute}]`)].find(element => String(element.getAttribute(attribute)) === String(value)) || null; }
    function playerAnchor(playerId) { return findByData('data-player-id', playerId); }
    function boatAnchor(boatId) { return findByData('data-boat-id', boatId); }
    function locationAnchor(locationId) { return findByData('data-location-id', locationId); }
    function marketAnchor(good) { return findByData('data-market-good', good); }
    function eventAnchor(sourceId, boatId) { if (boatId) return boatAnchor(boatId); if (String(sourceId || '').startsWith('boat-')) return boatAnchor(String(sourceId).slice(5)); return locationAnchor(sourceId); }
    function centerOf(element) { if (!element?.isConnected) return null; const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; }

    function clearHighlights() {
        mount.querySelectorAll('.mn-presentation-anchor').forEach(element => element.classList.remove('mn-presentation-anchor'));
        const line = $('actionLine'); line?.classList.remove('is-visible', 'is-danger', 'is-profit');
    }
    function drawActionLine(fromElement, toElement, tone = '') {
        clearHighlights(); const from = centerOf(fromElement); const to = centerOf(toElement); if (!from || !to) return;
        fromElement.classList.add('mn-presentation-anchor'); toElement.classList.add('mn-presentation-anchor');
        const svg = $('actionLine'); svg.setAttribute('viewBox', `0 0 ${windowRef.innerWidth || 1} ${windowRef.innerHeight || 1}`);
        const line = svg.querySelector('line'); const circle = svg.querySelector('circle');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y); line.setAttribute('x2', to.x); line.setAttribute('y2', to.y); circle.setAttribute('cx', to.x); circle.setAttribute('cy', to.y);
        svg.classList.toggle('is-danger', tone === 'danger'); svg.classList.toggle('is-profit', tone === 'profit');
        (windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0)))(() => svg.classList.add('is-visible'));
    }
    function cancelPresentationWait() { for (const waiter of model.presentationWaiters || []) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); } model.presentationWaiters?.clear(); if (model.waitTimer) windowRef.clearTimeout(model.waitTimer); model.waitTimer = null; const release = model.releaseWait; model.releaseWait = null; release?.(false); }
    function waitUntil(timestamp, token) { if (token !== model.presentationToken) return Promise.resolve(false); const target = Number(timestamp); if (!Number.isFinite(target) || target <= Date.now()) return Promise.resolve(true); return new Promise(resolve => { const waiter = { timer: windowRef.setTimeout(() => { model.presentationWaiters.delete(waiter); resolve(token === model.presentationToken); }, Math.max(0, target - Date.now())), resolve }; model.presentationWaiters.add(waiter); }); }
    function presentationWait(duration, token) {
        if (reducedMotion) duration = Math.min(duration, 180);
        const relativeTarget = Date.now() + Math.max(0, Number(duration) || 0);
        const target = Number.isFinite(currentContentDeadline) ? Math.min(relativeTarget, currentContentDeadline) : relativeTarget;
        return waitUntil(target, token);
    }
    function showPresentation(mode, tone, kicker, title, body = '') { onPresentationStart?.(); const layer = $('presentationLayer'); clearPresentationFade(layer); layer.hidden = false; layer.setAttribute('aria-hidden', 'false'); layer.className = `mn-presentation-layer is-${mode || 'compact'} ${tone ? `is-${tone}` : ''}`; $('presentationScene').innerHTML = `<div class="mn-scene-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></div>${body}`; windowRef.requestAnimationFrame?.(() => layer.classList.add('is-visible')); }
    function hidePresentation() { const layer = $('presentationLayer'); if (!layer) return; clearPresentationFade(layer); layer.hidden = true; layer.className = 'mn-presentation-layer'; layer.setAttribute('aria-hidden', 'true'); $('presentationScene').innerHTML = ''; $('movingLayer').innerHTML = ''; mount.querySelectorAll('.mn-route-row.is-reenacting').forEach(row => row.classList.remove('is-reenacting')); clearHighlights(); }
    async function fadeThenHide(token) { const layer = $('presentationLayer'); beginPresentationFade(layer); const deadline = Number.isFinite(currentEventDeadline) ? currentEventDeadline : Date.now() + PRESENTATION_FADE_MS; if (!await waitUntil(deadline, token)) return false; hidePresentation(); return true; }
    function goodBadge(good, detail = '') { const meta = GOOD_META[good] || GOOD_META.人参; return `<span class="mn-scene-good" style="--good:${meta.accent}"><i>${meta.mark}</i><b>${escapeHtml(good || '货物')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`; }
    function playerBadge(playerId, name, detail = '') { const player = model.state?.players?.find(candidate => candidate.id === playerId); return `<span class="mn-scene-player" style="--player:${escapeHtml(player?.color || '#c49a5a')}"><b>${escapeHtml(name || player?.name || '商人')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`; }

    async function animateBoatMove(move, token) {
        const row = boatAnchor(move.boatId); if (!row) return presentationWait(280, token);
        const points = [...row.querySelectorAll('[data-point]')]; const fromPoint = Math.max(0, Math.min(14, Number(move.from) > 13 ? 14 : Number(move.from) || 0)); const toPoint = Math.max(0, Math.min(14, Number(move.to) > 13 ? 14 : Number(move.to) || 0));
        const from = centerOf(points.find(cell => Number(cell.dataset.point) === fromPoint)); const to = centerOf(points.find(cell => Number(cell.dataset.point) === toPoint)); if (!from || !to) return presentationWait(280, token);
        row.classList.add('is-reenacting'); const meta = GOOD_META[move.good] || GOOD_META.人参; const ghost = mount.ownerDocument.createElement('i'); ghost.className = 'mn-moving-ship'; ghost.style.setProperty('--good', meta.accent); ghost.style.left = `${from.x}px`; ghost.style.top = `${from.y}px`; ghost.innerHTML = '<i></i><b></b><em></em>'; $('movingLayer').appendChild(ghost); ghost.getBoundingClientRect(); ghost.style.transform = `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px))`;
        const continued = await presentationWait(620, token); ghost.remove(); row.classList.remove('is-reenacting'); return continued;
    }
    function movementBody(moves, activeIndex = -1) { return `<div class="mn-scene-moves">${(moves || []).map((move, index) => `<span class="${index === activeIndex ? 'is-active' : ''}">${goodBadge(move.good)}<b>${move.from} <em>→</em> ${Number(move.to) > 13 ? '港' : move.to}</b><small>${move.roll ? `骰子 ${move.roll}` : `${Number(move.delta) > 0 ? '+' : ''}${move.delta}`}</small></span>`).join('')}</div>`; }
    async function playMovementEvent(event, token, pilot = false) { const moves = event.moves || []; showPresentation('medium', pilot ? 'pilot' : 'sailing', pilot ? '领航调度' : `第 ${event.round || model.state?.movementRound || ''} 轮行船`, pilot ? `${event.actorName || playerName(event.actorId)}调整航线` : `${event.actorName || playerName(event.actorId, '港务长')}发布行船顺序`, movementBody(moves)); drawActionLine(playerAnchor(event.actorId), boatAnchor(moves[0]?.boatId), pilot ? '' : 'profit'); if (!await presentationWait(420, token)) return; for (let index = 0; index < moves.length && token === model.presentationToken; index += 1) { $('presentationScene').innerHTML = `<div class="mn-scene-heading"><span>${pilot ? '领航调度' : `第 ${event.round || ''} 轮行船`}</span><h2>${pilot ? `${event.actorName || '领航员'}调整航线` : `第 ${index + 1} 船出发`}</h2></div>${movementBody(moves, index)}`; drawActionLine(playerAnchor(event.actorId), boatAnchor(moves[index].boatId), pilot ? '' : 'profit'); if (!await animateBoatMove(moves[index], token)) return; } await presentationWait(300, token); }
    async function playVoyageSettlement(event, token) { const gains = (event.players || []).slice().sort((a, b) => b.gained - a.gained); const boats = (event.boats || []).map(boat => goodBadge(boat.good, boat.plundered ? '遭掠夺' : boat.fate === 'port' ? `港口 ${boat.portIndex || ''}` : `船坞 ${boat.shipyardIndex || ''}`)).join(''); const marketRows = GOODS.map(good => { const before = Number(event.marketBefore?.[good] || 0); const after = Number(event.marketAfter?.[good] || 0); return `<span class="${after > before ? 'is-up' : ''}"><b>${escapeHtml(good)}</b><em>${before} → ${after}</em></span>`; }).join(''); const gainRows = gains.map(player => `<span data-settlement-player="${escapeHtml(player.id)}"><b>${escapeHtml(player.name)}</b><em class="${player.gained >= 0 ? 'is-positive' : 'is-negative'}">${player.gained >= 0 ? '+' : ''}${player.gained}</em><small>${player.cashAfter} 比索</small></span>`).join(''); showPresentation('major', 'settlement', `第 ${event.voyage} 次航行`, '船队入港·开盘结算', `<div class="mn-scene-fleet">${boats}</div><div class="mn-settlement-columns"><section><header>商人收益</header><div class="mn-scene-ledger">${gainRows || '<span>本轮无现金变化</span>'}</div></section><section><header>黑市行情</header><div class="mn-scene-market">${marketRows}</div></section></div><p class="mn-live-payout" data-live-payout>港务员正在核对各项分红……</p>`); if (!await presentationWait(650, token)) return; const details = (event.payoutDetails || []).filter(detail => detail.amount).slice(0, 6); for (const detail of details) { if (token !== model.presentationToken) return; const live = $('presentationScene').querySelector('[data-live-payout]'); if (live) live.textContent = `${detail.playerName} ${detail.amount > 0 ? '获得' : '支付'} ${Math.abs(detail.amount)} 比索`; drawActionLine(eventAnchor(detail.sourceId, detail.boatId), playerAnchor(detail.playerId), detail.amount > 0 ? 'profit' : 'danger'); if (!await presentationWait(420, token)) return; } clearHighlights(); const live = $('presentationScene').querySelector('[data-live-payout]'); if (live) live.textContent = '本次航行账目已封存'; await presentationWait(700, token); }

    async function playPresentationEvent(event, token) {
        const actor = event.actorName || playerName(event.actorId); let mode = 'compact'; let tone = ''; let kicker = '南洋商路'; let title = ''; let body = ''; let from = null; let to = null; let duration = 650;
        if (event.kind === 'boatsSailed') return playMovementEvent(event, token, false); if (event.kind === 'pilotMoved') return playMovementEvent(event, token, true); if (event.kind === 'voyageSettlement') return playVoyageSettlement(event, token);
        if (event.kind === 'playerLeft') { const personal = event.viewerVariant === 'personalDeparture'; showPresentation('major', 'final', '商会席位变动', event.title || (personal ? '您已离开本局' : `${event.playerName} 离开了马尼拉商会`), `<p class="mn-scene-note">${escapeHtml(event.detail || `${event.playerName} 的席位已退出，剩余 ${event.remainingPlayerCount || 0} 位商人继续。`)}</p>`); drawActionLine(playerAnchor(event.playerId), $('presentationScene'), ''); await presentationWait(900, token); return; }
        if (event.kind === 'finalSettlement') { const winners = new Set((event.winnerIds || []).map(String)); const winnerNames = (event.standings || []).filter(player => winners.has(String(player.id))).map(player => player.name).join('、') || '最高财富玩家'; const rows = (event.standings || []).map((player, index) => `<span class="${winners.has(String(player.id)) ? 'is-winner' : ''}"><i>${index + 1}</i><b>${escapeHtml(player.name)}</b><small>现金 ${player.cash} + 股份 ${player.shareValue} − 贷款 ${player.loanPenalty}</small><em>${player.fortune}</em></span>`).join(''); const title = event.title || `${winnerNames}${winners.size > 1 ? '共享马尼拉商会荣光' : '赢得马尼拉商会'}`; const detail = event.detail || '所有在线商人的最终财富已经结算。'; showPresentation('major', 'final', '航运季最终清算', title, `<div class="mn-final-ledger">${rows}</div><p class="mn-scene-note">${escapeHtml(detail)}</p>`); drawActionLine($('master'), playerAnchor(event.winnerIds?.[0]), 'profit'); await presentationWait(2600, token); return; }
        if (event.kind === 'auctionBid') { kicker = '港务长竞价'; title = `${actor}出价 ${event.amount} 比索`; body = playerBadge(event.actorId, actor, `现金 ${event.cash}·可抵押 ${event.mortgageCapacity}`); from = playerAnchor(event.actorId); to = $('master'); }
        else if (event.kind === 'auctionPassed') { kicker = '港务长竞价'; title = `${actor}退出本轮竞价`; body = `<p class="mn-scene-note">仍有 ${event.remaining} 人保留竞价资格</p>`; from = playerAnchor(event.actorId); duration = 420; }
        else if (event.kind === 'harborMasterAppointed') { mode = 'medium'; tone = 'appointed'; kicker = '任命书'; title = `${event.playerName}成为港务长`; body = `${playerBadge(event.playerId, event.playerName, event.winningBid ? `成交价 ${event.winningBid}比索` : '续任')}${event.mortgagesAdded ? `<p class="mn-scene-note">自动抵押 ${event.mortgagesAdded} 张股份</p>` : ''}`; from = $('master'); to = playerAnchor(event.playerId); duration = 1100; }
        else if (event.kind === 'sharePurchased') { kicker = '黑市交割'; title = `${actor}购入${event.good}股份`; body = `${goodBadge(event.good, `${event.price} 比索`)}${event.mortgagesAdded ? `<p class="mn-scene-note">同时抵押 ${event.mortgagesAdded} 张股份</p>` : ''}`; from = playerAnchor(event.actorId); to = marketAnchor(event.good); }
        else if (event.kind === 'sharePurchaseSkipped') { kicker = '港务长权限'; title = `${actor}放弃购股`; body = '<p class="mn-scene-note">船队规划继续</p>'; duration = 430; }
        else if (event.kind === 'fleetPlanned') { mode = 'medium'; tone = 'sailing'; kicker = '港务长航令'; title = `${actor}完成船队配置`; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, `起点 ${boat.start}`)).join('')}</div>`; from = playerAnchor(event.actorId); to = boatAnchor(event.boats?.[0]?.id); duration = 1200; }
        else if (event.kind === 'accomplicePlaced') { kicker = `第 ${event.slot} 席`; title = `${actor}安插帮手`; body = `${playerBadge(event.actorId, actor, `支付 ${event.fee}比索`)}<p class="mn-scene-note">${escapeHtml(event.locationName)}·${event.slot}/${event.capacity}${event.blindPassenger ? '·盲乘客' : ''}${event.insuranceAdvance ? `·保险预支 +${event.insuranceAdvance}` : ''}</p>`; from = playerAnchor(event.actorId); to = event.boatId ? boatAnchor(event.boatId) : locationAnchor(event.locationId); }
        else if (event.kind === 'placementPassed') { kicker = `第 ${event.placementRound} 轮安插`; title = `${actor}退出后续安插`; duration = 420; }
        else if (event.kind === 'sailingRolled') { mode = 'medium'; tone = 'sailing'; kicker = `第 ${event.round} 轮骰点`; title = '海风已定·等待行船顺序'; body = `<div class="mn-dice-reveal">${(event.rolls || []).map(item => `${goodBadge(item.good)}<i>${item.roll}</i>`).join('')}</div>`; from = $('master'); to = playerAnchor(event.harborMasterId); duration = 1050; }
        else if (event.kind === 'placementResumed') { kicker = '新一轮布局'; title = `第 ${event.placementRound} 轮安插开始`; duration = 520; }
        else if (event.kind === 'pilotPhaseStarted') { mode = 'medium'; tone = 'pilot'; kicker = '第三轮之前'; title = '领航员登上海图'; body = `<div class="mn-scene-people">${(event.pilots || []).map(pilot => playerBadge(pilot.playerId, pilot.playerName, pilot.size === 'large' ? '大领航员' : '小领航员')).join('')}</div>`; duration = 950; }
        else if (event.kind === 'pilotSkipped') { kicker = '领航调度'; title = `${actor}保持原航线`; duration = 460; }
        else if (event.kind === 'pirateAlert') { mode = 'medium'; tone = 'danger'; kicker = '十三格警报'; title = '海盗船逼近货船'; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, '停在 13 格')).join('')}</div>`; from = locationAnchor('pirate'); to = boatAnchor(event.boats?.[0]?.id); duration = 1100; }
        else if (event.kind === 'pirateBoarded') { mode = 'medium'; tone = 'danger'; kicker = '海盗登船'; title = `${actor}登上${event.good}货船`; body = `${playerBadge(event.actorId, actor, `船上海盗 ${event.pirateCount}`)}${goodBadge(event.good, `货舱帮手 ${event.accomplices?.length || 0}`)}`; from = playerAnchor(event.actorId) || locationAnchor('pirate'); to = boatAnchor(event.boatId); duration = 1050; }
        else if (event.kind === 'pirateStayed') { kicker = '海盗决断'; title = `${actor}留守海盗船`; body = '<p class="mn-scene-note">等待最终掠夺时机</p>'; duration = 520; }
        else if (event.kind === 'plunderPhaseStarted') { mode = 'medium'; tone = 'danger'; kicker = '航程末端'; title = '海盗船长取得裁决权'; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, `船长·${boat.captainName}`)).join('')}</div>`; duration = 1000; }
        else if (event.kind === 'plunderResolved') { mode = 'medium'; tone = 'danger'; kicker = '掠夺裁决'; title = `${event.good}货船驶往${event.destination === 'port' ? '港口' : '船坞'}`; body = `${goodBadge(event.good, `海盗预计每人 ${event.estimatedShare}比索`)}<p class="mn-scene-note">货舱帮手将不获得货物分红</p>`; from = boatAnchor(event.boatId); to = locationAnchor(event.destination === 'port' ? 'port-a' : 'shipyard-a'); duration = 1150; }
        else if (event.kind === 'voyageStarted') { mode = 'medium'; tone = 'sailing'; kicker = event.seasonOpening ? '马尼拉航运季开幕' : '新航程'; title = `第 ${event.voyage} 次航行开始`; body = event.seasonOpening ? `<p class="mn-scene-note">每位商人获得 ${event.startingCash} 比索、${event.privateSharesEach} 张私密股份和 ${event.accomplicesEach} 名帮手</p>` : '<p class="mn-scene-note">商人重新竞选港务长</p>'; duration = event.seasonOpening ? 1100 : 850; }
        else if (event.kind === 'loanTaken') { tone = 'appointed'; kicker = '股份抵押'; title = `${actor}获得 ${event.amount} 比索贷款`; body = `<p class="mn-scene-note">已有 ${event.encumberedCount} 张股份被抵押 · 具体货物保持私密</p>`; from = playerAnchor(event.actorId); duration = 800; }
        else if (event.kind === 'loanRepaid') { tone = 'appointed'; kicker = '贷款偿还'; title = `${actor}支付 ${event.amount} 比索解除抵押`; body = `<p class="mn-scene-note">剩余 ${event.encumberedCount} 张抵押股份 · 具体货物保持私密</p>`; to = playerAnchor(event.actorId); duration = 800; }
        else if (event.kind === 'marketThresholdReached') { mode = 'major'; tone = 'final'; kicker = '黑市终局线'; title = `${(event.goods || []).map(item => item.good).join('、')}达到 30`; body = `<div class="mn-scene-market">${(event.goods || []).map(item => goodBadge(item.good, `${item.before} → ${item.after}`)).join('')}</div><p class="mn-scene-note">航运季结束，商会开始最终清算</p>`; duration = 1250; }
        else return;
        showPresentation(mode, tone, kicker, title, body); if (from && to) drawActionLine(from, to, tone === 'danger' ? 'danger' : tone === 'sailing' ? 'profit' : ''); await presentationWait(duration, token);
    }

    async function holdPresentationLock(token) { const deadline = Number(model.presentationLockedUntil) || 0; if (deadline > Date.now() && !await waitUntil(deadline, token)) return; if (token !== model.presentationToken) return; model.presentationPlaying = false; model.presentationEvent = null; renderer?.render?.(); renderCommand?.(); if (model.presentationQueue.length) void drainPresentations(); }
    async function drainPresentations() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        renderer?.render?.(); renderCommand?.();
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
        currentEventDeadline = Number.POSITIVE_INFINITY; currentContentDeadline = Number.POSITIVE_INFINITY; model.presentationEvent = null; hidePresentation();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) { void holdPresentationLock(token); return; }
        model.presentationPlaying = false; renderer?.render?.(); renderCommand?.();
    }
    function enqueuePresentation(presentation) {
        if (!presentation?.events?.length) return;
        if (Number.isFinite(Number(presentation.endsAt))) { if (Number(presentation.endsAt) <= Date.now()) return; model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(presentation.endsAt)); }
        for (const event of presentation.events) {
            if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
            model.presentationQueue.push({ ...presentation, events: [event] });
        }
        void drainPresentations();
    }
    function skipPresentation() {
        const token = ++model.presentationToken;
        cancelPresentationWait(); hidePresentation(); model.presentationEvent = null; currentEventDeadline = Number.POSITIVE_INFINITY; currentContentDeadline = Number.POSITIVE_INFINITY; model.presentationPlaying = false;
        renderer?.render?.(); renderCommand?.();
        if (model.presentationQueue.length) void drainPresentations();
        else if (Date.now() < Number(model.presentationLockedUntil || 0)) { model.presentationPlaying = true; renderer?.render?.(); void holdPresentationLock(token); }
    }
    function stop() { model.presentationToken += 1; cancelPresentationWait(); model.presentationQueue = []; hidePresentation(); model.presentationPlaying = false; model.presentationEvent = null; model.presentationLockedUntil = 0; currentEventDeadline = Number.POSITIVE_INFINITY; currentContentDeadline = Number.POSITIVE_INFINITY; renderer?.render?.(); renderCommand?.(); }

    return { enqueuePresentation, skipPresentation, skipPresentations: skipPresentation, stop, isPlaying: () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0) };
}
