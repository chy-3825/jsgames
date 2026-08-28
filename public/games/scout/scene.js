import { cardFace, escapeHtml } from './constants.js';

/** Presentation queue and table-side animations for 马戏星探. */
export function createScoutScene({ mount, model, getElement, renderer, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const state = () => model.state;
    function waitForPresentation(milliseconds, token) {
        if (token !== model.presentationToken) return Promise.resolve();
        const duration = reducedMotion ? Math.min(milliseconds, 80) : milliseconds;
        return new Promise(resolve => {
            model.releaseWait = () => {
                windowRef.clearTimeout(model.waitTimer);
                model.waitTimer = null;
                model.releaseWait = null;
                resolve();
            };
            model.waitTimer = windowRef.setTimeout(model.releaseWait, duration);
        });
    }
    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }
    function clearPresentationTargets() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target'));
        $('actionLine').classList.remove('is-visible');
    }
    function drawActionLine(fromElement, toElement, direction = 'forward') {
        if (!fromElement || !toElement || reducedMotion) return;
        const svg = $('actionLine');
        const line = svg.querySelector('line');
        const head = svg.querySelector('circle');
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        svg.setAttribute('viewBox', `0 0 ${windowRef.innerWidth} ${windowRef.innerHeight}`);
        line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        head.setAttribute('cx', x2); head.setAttribute('cy', y2);
        svg.dataset.direction = direction;
        svg.classList.add('is-visible');
        fromElement.classList.add('is-presentation-source');
        toElement.classList.add('is-presentation-target');
    }
    function showPresentation(kind, html, options = {}) {
        const layer = $('presentationLayer');
        clearPresentationTargets();
        layer.hidden = false;
        layer.className = `sc-presentation-layer is-${kind} ${options.major ? 'is-major' : ''} ${options.compact ? 'is-compact' : ''}`;
        $('presentationScene').innerHTML = html;
        windowRef.requestAnimationFrame?.(() => layer.classList.add('is-visible'));
    }
    function hidePresentation() {
        clearPresentationTargets();
        const layer = $('presentationLayer');
        layer.classList.remove('is-visible');
        layer.hidden = true;
        $('presentationScene').innerHTML = '';
    }
    function eventCards(cards = [], className = '') {
        return cards.map((card, index) => `<article class="sc-event-card ${className}" style="--event-index:${index}">${cardFace(card)}</article>`).join('') || '<span class="sc-event-empty">空舞台</span>';
    }
    function eventComboName(combo) {
        if (!combo) return '新的节目';
        if (combo.kind === 'single') return `单牌 ${combo.strength}`;
        if (combo.kind === 'matching') return `${combo.length} 张同点 · ${combo.strength}`;
        return `${combo.length} 张顺子 · ${(combo.values || []).join('–')}`;
    }
    async function playShowEvent(event, token) {
        showPresentation('show', `<span class="sc-event-kicker">${escapeHtml(event.actorName)} 登台</span><h2>${escapeHtml(eventComboName(event.combination))}</h2><div class="sc-event-card-row">${eventCards(event.newShow, 'is-new-show')}</div><p data-role="eventCopy">${event.capturedCount ? `压过旧节目，并赢得 ${escapeHtml(event.capturedCount)} 张牌` : '本轮第一项节目正式登台'}</p>`, { compact: true });
        drawActionLine(playerAnchor(event.actorId), $('active'), 'to-stage');
        await waitForPresentation(720, token);
        if (event.capturedCount && token === model.presentationToken) {
            clearPresentationTargets();
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.innerHTML = `旧节目收归 <strong>${escapeHtml(event.actorName)}</strong> · +${escapeHtml(event.capturedCount)} 张赢牌`;
            drawActionLine($('active'), playerAnchor(event.actorId), 'capture');
            await waitForPresentation(520, token);
        }
    }
    async function playScoutEvent(event, token) {
        const side = event.edge === 'left' ? '左端' : '右端';
        showPresentation('scout', `<span class="sc-event-kicker">${escapeHtml(event.actorName)} 发起招募</span><h2>从舞台${side}带走成员</h2><div class="sc-event-card-row is-single">${eventCards([event.card], 'is-scouted')}</div><p data-role="eventCopy">采用 ${escapeHtml(event.card?.value)} 点方向 · 插入节目单第 ${Number(event.insertAt) + 1} 位</p>`, { compact: true });
        drawActionLine($('active'), playerAnchor(event.actorId), 'from-stage');
        await waitForPresentation(760, token);
        if (event.ownerTokenAwarded && event.activeOwnerId && token === model.presentationToken) {
            clearPresentationTargets();
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.innerHTML = `<strong>${escapeHtml(event.activeOwnerName)}</strong> 因节目被招募获得 1 枚标记`;
            drawActionLine($('active'), playerAnchor(event.activeOwnerId), 'token');
            await waitForPresentation(480, token);
        } else if (event.scoutChipSpent && token === model.presentationToken) {
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.textContent = `${event.actorName} 消耗了 1 枚招募筹码`;
            await waitForPresentation(320, token);
        }
    }
    async function playPresentationEvent(event, token) {
        if (!event || token !== model.presentationToken) return;
        if (event.kind === 'orientationLocked') {
            showPresentation('orientation', `<span class="sc-event-kicker">节目单封存</span><h2>${escapeHtml(event.playerName)} 已锁定方向</h2><p>${escapeHtml(event.lockedCount)} / ${escapeHtml(event.totalPlayers)} 个马戏团准备完成</p>`, { compact: true });
            await waitForPresentation(event.allLocked ? 520 : 380, token); return;
        }
        if (event.kind === 'showtimeStarted') {
            showPresentation('showtime', `<span class="sc-event-kicker">第 ${escapeHtml(event.round)} 轮</span><h2>帷幕升起</h2><p>聚光灯首先照向 ${escapeHtml(event.starterName)}。</p>`, { compact: true });
            await waitForPresentation(760, token); return;
        }
        if (event.kind === 'showPerformed') { await playShowEvent(event, token); return; }
        if (event.kind === 'cardScouted') { await playScoutEvent(event, token); return; }
        if (event.kind === 'roundSettlement') {
            const reason = event.reason === 'empty' ? `${event.winnerName} 清空了节目单` : `${event.winnerName} 的节目无人能够压过`;
            const rows = (event.scores || []).slice().sort((left, right) => right.total - left.total).map(score => `<li><strong>${escapeHtml(score.name)}</strong><span>赢牌 ${escapeHtml(score.capturedPoints)} + 标记 ${escapeHtml(score.scoutTokenPoints)}${score.scoutChipPoints ? ` + 筹码 ${escapeHtml(score.scoutChipPoints)}` : ''} − 手牌 ${escapeHtml(score.handPenalty)}</span><b>${score.gained >= 0 ? '+' : ''}${escapeHtml(score.gained)}</b><em>累计 ${escapeHtml(score.total)}</em></li>`).join('');
            showPresentation('round-settlement', `<span class="sc-event-kicker">第 ${escapeHtml(event.round)} 轮谢幕</span><h2>${escapeHtml(reason)}</h2><ol class="sc-event-scores">${rows}</ol>`, { major: true });
            await waitForPresentation(1900, token); return;
        }
        if (event.kind === 'roundTransition') {
            showPresentation('round-transition', `<span class="sc-event-kicker">巡演换场</span><h2>第 ${escapeHtml(event.nextRound)} 轮即将开幕</h2><p>起始标记交给 ${escapeHtml(event.starterName)}。</p>`, { major: true });
            await waitForPresentation(850, token); return;
        }
        if (event.kind === 'roundStarted') {
            const hands = (event.handCounts || []).map(player => `<span><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(player.count)} 张</b></span>`).join('');
            showPresentation('round-started', `<span class="sc-event-kicker">${Number(event.round) === 1 ? '巡回演出正式开幕' : '新节目单已经发放'}</span><h2>第 ${escapeHtml(event.round)} 轮开场</h2><div class="sc-event-hands">${hands}</div><p>起始标记由 ${escapeHtml(event.starterName)} 持有 · 请各自决定整手牌方向。</p>`, { compact: true });
            await waitForPresentation(900, token); return;
        }
        if (event.kind === 'finalSettlement') {
            const winners = new Set(event.winnerIds || []);
            const winnerNames = (event.standings || []).filter(player => winners.has(player.id)).map(player => player.name).join('、') || '最高分玩家';
            const standings = (event.standings || []).map((player, index) => `<li class="${winners.has(player.id) ? 'is-winner' : ''}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(player.score)} 分</b><small>${winners.has(player.id) ? '最终冠军' : '巡演完成'}</small></li>`).join('');
            showPresentation('final-settlement', `<span class="sc-event-kicker">巡回演出终场</span><h2>${escapeHtml(winnerNames)}${winners.size > 1 ? '并列摘下马戏桂冠' : '成为今晚的马戏之星'}</h2><ol class="sc-final-scores">${standings}</ol>`, { major: true });
            await waitForPresentation(2800, token);
        }
    }
    async function drainPresentations() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = model.presentationToken;
        if (model.state) renderer?.renderCommand?.();
        while (model.presentationQueue.length && token === model.presentationToken) await playPresentationEvent(model.presentationQueue.shift(), token);
        if (token === model.presentationToken) {
            hidePresentation();
            model.presentationPlaying = false;
            if (model.state) renderer?.renderCommand?.();
        }
    }
    function enqueuePresentation(presentation) {
        if (!presentation?.events?.length) return;
        model.presentationQueue.push(...presentation.events);
        void drainPresentations();
    }
    function skipPresentations() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        model.releaseWait?.();
        hidePresentation();
        model.presentationPlaying = false;
        if (model.state) renderer?.renderCommand?.();
    }
    function stop() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        model.releaseWait?.();
        hidePresentation();
        model.presentationPlaying = false;
        if (model.state) renderer?.renderCommand?.();
    }
    return { enqueuePresentation, skipPresentations, stop, isPlaying: () => model.presentationPlaying };
}
