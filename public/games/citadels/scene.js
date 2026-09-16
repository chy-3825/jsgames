import { ROLE_ACCENT_COLORS, escapeHtml } from './constants.js';
import { districtCardMarkup, districtBack, roleArt, roleBack, roleMeta } from './cards.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Role, city and finale presentation queue for 富饶之城. */
export function createCitadelsScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, renderer, onPresentationStart = () => {} }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)');
    const state = () => model.state;
    model.presentationWaiters ||= new Set();
    let currentEventDeadline = Number.POSITIVE_INFINITY;
    let currentContentDeadline = Number.POSITIVE_INFINITY;
    let activeBatch = null;
    let activeEventIndex = -1;

    function waitUntil(timestamp, token) {
        const wait = Number(timestamp) - Date.now();
        if (!Number.isFinite(wait) || wait <= 0) return Promise.resolve(token === model.presentationToken);
        if (token !== model.presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const waiter = {
                timer: windowRef.setTimeout(() => { model.presentationWaiters.delete(waiter); resolve(token === model.presentationToken); }, wait),
                resolve,
            };
            model.presentationWaiters.add(waiter);
        });
    }

    function presentationDelay(duration, token) {
        const preferred = reducedMotion?.matches ? Math.min(160, duration * .2) : duration;
        const remaining = Number.isFinite(currentContentDeadline) ? Math.max(0, currentContentDeadline - Date.now()) : preferred;
        return waitUntil(Date.now() + Math.min(preferred, remaining), token);
    }

    function cancelPresentationWait() {
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

    function showPresentation(kind, html, options = {}) {
        onPresentationStart?.();
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `citadels-presentation-layer is-active is-${kind}${options.strong ? ' is-strong' : ''}`;
        layer.style.setProperty('--event-color', options.color || '#d3aa5c');
        $('presentationStage').innerHTML = html;
        clearActionLine();
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationFade(layer);
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
        clearActionLine();
        layer.className = 'citadels-presentation-layer';
        layer.style.removeProperty('--event-color');
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('presentationStage').innerHTML = '';
    }

    async function fadeThenHide(token) {
        const layer = $('presentationLayer');
        beginPresentationFade(layer);
        const fadeDeadline = Number.isFinite(currentEventDeadline) ? currentEventDeadline : Date.now() + PRESENTATION_FADE_MS;
        if (!await waitUntil(fadeDeadline, token)) return false;
        hidePresentation();
        return true;
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.removeAttribute('class');
    }

    function dataAnchor(attribute, value) { return [...mount.querySelectorAll(`[${attribute}]`)].find(element => element.getAttribute(attribute) === String(value)) || null; }
    function playerAnchor(playerId) { return dataAnchor('data-player-id', playerId) || dataAnchor('data-city-owner', playerId) || $('players'); }
    function cityAnchor(playerId, cardId = null) {
        if (cardId) { const card = [...mount.querySelectorAll('[data-district-id]')].find(element => element.dataset.districtId === String(cardId) && element.dataset.cityOwner === String(playerId)); if (card) return card; }
        return [...mount.querySelectorAll('.citadels-city-row[data-city-owner]')].find(element => element.dataset.cityOwner === String(playerId)) || playerAnchor(playerId);
    }
    function roleAnchor(roleId) { return dataAnchor('data-role-id', roleId) || $('roleTrack'); }
    function drawActionLine(fromElement, toElement, className = '') {
        const path = $('actionPath');
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect(); const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2; const y1 = from.top + from.height / 2; const x2 = to.left + to.width / 2; const y2 = to.top + to.height / 2;
        const curve = Math.max(40, Math.abs(x2 - x1) * .18);
        path.setAttribute('d', `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - curve} ${x2} ${y2}`);
        path.setAttribute('class', `is-visible ${className}`.trim());
    }
    function setMotionPoint(motion, anchor, prefix) {
        if (!motion || !anchor) return;
        const source = anchor.getBoundingClientRect(); const target = motion.getBoundingClientRect();
        motion.style.setProperty(`--event-${prefix}-x`, `${source.left + source.width / 2 - (target.left + target.width / 2)}px`);
        motion.style.setProperty(`--event-${prefix}-y`, `${source.top + source.height / 2 - (target.top + target.height / 2)}px`);
    }
    function eventFrame(kicker, title, copy, visual, extraClass = '') { return `<article class="citadels-event ${extraClass}"><span class="citadels-event-kicker">${escapeHtml(kicker)}</span><div class="citadels-event-visual">${visual}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></article>`; }
    function eventRoleMarkup(role, extraClass = '') { const meta = roleMeta(role); return `<div class="citadels-event-role citadels-event-motion role-${meta.accent} ${extraClass}">${roleArt(role, 'event')}<span><small>角色 ${meta.rank}</small><strong>${escapeHtml(meta.name)}</strong></span></div>`; }
    function eventDistrictMarkup(card, extraClass = '') { return `<div class="citadels-event-district citadels-event-motion ${extraClass}">${districtCardMarkup(card)}</div>`; }
    function eventBacks(count, extraClass = '') { const shown = Math.max(1, Math.min(5, Number(count) || 1)); return `<span class="citadels-event-backs ${extraClass}">${Array.from({ length: shown }, (_, index) => `<i style="--back-index:${index}">${districtBack('event')}</i>`).join('')}<b>×${Number(count) || 0}</b></span>`; }

    async function routePresentation(event, token, options) {
        showPresentation(options.kind, eventFrame(options.kicker, options.title, options.copy, options.visual, options.extraClass || ''), { strong: options.strong, color: options.color });
        const motion = $('presentationStage').querySelector('.citadels-event-motion') || $('presentationStage').querySelector('.citadels-event-visual');
        await nextFrame();
        if (options.from) { setMotionPoint(motion, options.from, 'from'); drawActionLine(options.from, motion, options.lineClass || ''); }
        if (options.to) setMotionPoint(motion, options.to, 'to');
        $('presentationLayer').classList.add('is-routed');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(options.centerDuration || 380, token)) return;
        if (options.to) { $('presentationLayer').classList.add('is-transferred'); drawActionLine(motion, options.to, options.lineClass || ''); options.to.classList.add('is-event-impact'); }
        else $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(options.endDuration || 620, token);
    }

    async function playRoleDraft(event, token) {
        const copy = event.action === 'discard' ? '一张角色牌已暗置，其身份对所有人保密' : '角色牌已封入私人手令，将在被召集时揭示';
        await routePresentation(event, token, { kind: 'role-draft', kicker: '秘密选角', title: event.action === 'discard' ? '角色暗置' : `${event.playerName}完成选角`, copy, visual: `<div class="citadels-event-motion citadels-event-role-back">${roleBack('event')}<span>密</span></div>`, from: $('roleTrack'), to: playerAnchor(event.playerId), centerDuration: 260, endDuration: 360 });
    }
    async function playRoleDraftStart(event, token) { const faceUp = event.faceUpRoles || []; showPresentation('role-draft-start', eventFrame(`第 ${event.round || state().round || 1} 轮 · 宫廷议会`, `${event.crownHolderName || '皇冠持有者'}率先选择角色`, faceUp.length ? `本轮明置角色：${faceUp.map(role => role.name).join('、')}` : '本轮没有明置角色，所有可选身份保持隐秘', '<span class="citadels-event-major-mark">♛</span>')); await nextFrame(); $('presentationLayer').classList.add('is-revealed'); await presentationDelay(1050, token); }
    async function playRoleUnanswered(event, token) { const meta = roleMeta(event.role); await routePresentation(event, token, { kind: 'role-unanswered', kicker: `第 ${event.round || state().round || '—'} 轮 · 宫廷召集`, title: `${meta.rank} · ${meta.name}无人应答`, copy: '该角色本轮不会行动，继续召集下一位角色', visual: eventRoleMarkup(event.role, 'is-unanswered'), from: roleAnchor(event.role?.id), color: '#77838a', centerDuration: 300, endDuration: 520 }); }
    async function playCrownAcquired(event, token) { showPresentation('crown-acquired', eventFrame(`${event.playerName}亮明国王身份`, `${event.playerName}取得皇冠`, '下一轮将由皇冠持有者率先选择角色', '<span class="citadels-event-major-mark">♛</span>'), { color: '#d3aa5c' }); await nextFrame(); $('presentationLayer').classList.add('is-revealed'); playerAnchor(event.playerId)?.classList.add('is-event-impact'); await presentationDelay(950, token); }
    async function playRoleCall(event, token) { const meta = roleMeta(event.role); await routePresentation(event, token, { kind: 'role-call', kicker: `第 ${state().round || '—'} 轮 · 宫廷召集`, title: `${meta.rank} · ${meta.name}`, copy: `${event.playerName}亮明身份，开始执行角色回合`, visual: eventRoleMarkup(event.role), from: roleAnchor(event.role?.id), to: playerAnchor(event.playerId), color: ROLE_ACCENT_COLORS[meta.accent] || '#d3aa5c', centerDuration: 360, endDuration: 520 }); }
    async function playDeclaration(event, token, kind) { const assassin = kind === 'assassinationDeclared'; const target = roleMeta(event.targetRole); await routePresentation(event, token, { kind: assassin ? 'assassination-declared' : 'robbery-declared', kicker: `${event.playerName}颁布密令`, title: assassin ? `暗杀目标：${target.name}` : `盗窃目标：${target.name}`, copy: '只公开目标角色；角色持有者要到被召集时才会显现', visual: `<div class="citadels-event-declaration"><div class="citadels-event-motion">${roleArt(assassin ? 'assassin' : 'thief', 'event')}</div><span><small>目标角色</small><b>${target.rank}</b><strong>${escapeHtml(target.name)}</strong></span></div>`, from: playerAnchor(event.playerId), color: assassin ? '#cf7667' : '#c59d55', lineClass: assassin ? 'is-danger' : '', centerDuration: 420, endDuration: 650 }); }
    async function playAssassination(event, token) { const meta = roleMeta(event.role); const personal = event.viewerVariant === 'personalElimination'; await routePresentation(event, token, { kind: 'assassination-resolved', kicker: personal ? '个人身份结算' : '密令在召集时生效', title: personal ? (event.title || '您已出局') : `${meta.name}遇刺`, copy: personal ? (event.detail || `您的${meta.name}本轮被刺杀，将跳过本轮行动。`) : `${event.playerName}本轮缺席，但并未永久退出游戏`, visual: eventRoleMarkup(event.role, 'is-assassinated'), from: roleAnchor(event.role?.id), to: playerAnchor(event.playerId), color: '#cf665f', lineClass: 'is-danger', strong: true, centerDuration: 560, endDuration: 850 }); }
    async function playRobbery(event, token) { await routePresentation(event, token, { kind: 'robbery-resolved', kicker: `${event.targetRole?.name || '目标角色'}已亮明`, title: `盗贼取走 ${event.amount || 0} 金`, copy: `${event.targetPlayerName}的金币转移给${event.playerName}`, visual: `<div class="citadels-event-coins citadels-event-motion"><i>金</i><i>金</i><b>${event.amount || 0}</b></div>`, from: playerAnchor(event.targetPlayerId), to: playerAnchor(event.playerId), color: '#d3aa5c', centerDuration: 330, endDuration: 600 }); }
    async function playMagician(event, token) { const exchange = event.kind === 'magicianExchange'; await routePresentation(event, token, { kind: exchange ? 'magician-exchange' : 'magician-swap', kicker: `${event.playerName}发动魔术师`, title: exchange ? `与${event.targetPlayerName}交换全部手牌` : `弃 ${event.discardedCount || 0} 张，补 ${event.drawnCount || 0} 张`, copy: exchange ? `${event.actorCardCount || 0} 张与 ${event.targetCardCount || 0} 张卡背交错而过，牌面仍保密` : '私密牌面不对其他玩家展示', visual: `<div class="citadels-event-motion citadels-event-card-exchange">${eventBacks(exchange ? event.actorCardCount : event.discardedCount, 'is-left')}<i>⇄</i>${eventBacks(exchange ? event.targetCardCount : event.drawnCount, 'is-right')}</div>`, from: playerAnchor(event.playerId), to: exchange ? playerAnchor(event.targetPlayerId) : null, color: '#9a7ab0', centerDuration: 420, endDuration: 700 }); }
    async function playResource(event, token) { const config = { takeGold: ['国库支取', `获得 ${event.amount || 0} 金`, event.merchantBonus ? '商人额外收入同时到账' : event.architectCards ? `建筑师另摸 ${event.architectCards} 张牌` : '基础资源行动', `<div class="citadels-event-coins citadels-event-motion"><i>金</i><i>金</i><b>+${(event.amount || 0) + (event.merchantBonus || 0)}</b></div>`], drawDistrict: ['城区牌库', `摸取 ${event.count || 0} 张城区牌`, event.count ? `私下选择保留 ${event.keepCount || 0} 张` : '城区牌堆已空', `<div class="citadels-event-motion">${eventBacks(event.count)}</div>`], keepDistrict: ['私密抉择', `保留 ${event.keptCount || 0} 张城区牌`, `其余 ${event.returnedCount || 0} 张返回牌堆底，牌面不公开`, `<div class="citadels-event-motion">${eventBacks(event.keptCount)}</div>`], incomeCollected: ['角色收入', `${event.role?.name || '角色'}收入 +${event.amount || 0} 金`, '对应颜色的已建城区产生收入', `<div class="citadels-event-coins citadels-event-motion"><i>金</i><b>+${event.amount || 0}</b></div>`], smithy: ['紫色独特区', '铁匠铺开炉', `支付 ${event.cost || 3} 金，私下摸取 ${event.drawnCount || 0} 张城区牌`, `<div class="citadels-event-motion">${eventBacks(event.drawnCount)}</div>`] }[event.kind]; if (!config) return; await routePresentation(event, token, { kind: 'resource', kicker: config[0], title: config[1], copy: config[2], visual: config[3], to: playerAnchor(event.playerId), centerDuration: 250, endDuration: 420 }); }
    async function playBuild(event, token) { await routePresentation(event, token, { kind: 'build-district', kicker: `${event.playerName}扩建城市`, title: `${event.card?.name || '城区'}落成`, copy: `支付 ${event.cost || 0} 金 · 城市现有 ${event.cityCount || 0} / 8 座城区`, visual: eventDistrictMarkup(event.card), from: playerAnchor(event.playerId), to: cityAnchor(event.playerId, event.card?.id), color: '#d3aa5c', centerDuration: 380, endDuration: 600 }); }
    async function playBuildPhaseClosed(event, token) { await routePresentation(event, token, { kind: 'build-phase-closed', kicker: `${event.role?.name || '军阀'}回合`, title: '建造阶段结束', copy: '军阀正在决定是否摧毁一座城区', visual: '<span class="citadels-event-major-mark citadels-event-motion">Ⅱ</span>', from: playerAnchor(event.playerId), color: '#cf7667', centerDuration: 240, endDuration: 520 }); }
    async function playTurnEnded(event, token) { await routePresentation(event, token, { kind: 'turn-ended', kicker: '角色回合结算', title: `${event.role?.name || '角色'}回合结束`, copy: '本位角色已经完成行动，继续召集下一位角色', visual: '<span class="citadels-event-major-mark citadels-event-motion">✓</span>', from: playerAnchor(event.playerId), color: '#77838a', centerDuration: 220, endDuration: 420 }); }
    async function playLaboratory(event, token) { await routePresentation(event, token, { kind: 'laboratory', kicker: `${event.playerName}启动实验室`, title: `${event.card?.name || '城区牌'}已弃置`, copy: '公开弃牌完成，并获得 1 枚金币', visual: eventDistrictMarkup(event.card, 'is-discarded'), from: playerAnchor(event.playerId), color: '#9a7ab0', centerDuration: 320, endDuration: 500 }); }
    async function playDestroy(event, token) { await routePresentation(event, token, { kind: 'destroy-district', kicker: `${event.playerName}发动军阀`, title: `${event.card?.name || '城区'}遭到摧毁`, copy: event.graveyardPending ? `已支付 ${event.cost || 0} 金 · 等待${event.targetPlayerName}决定是否用墓地回收` : `已支付 ${event.cost || 0} 金 · ${event.targetPlayerName}的城区已移出城市`, visual: eventDistrictMarkup(event.card, 'is-damaged'), from: playerAnchor(event.playerId), to: cityAnchor(event.targetPlayerId), color: '#cf7667', lineClass: 'is-danger', centerDuration: 470, endDuration: event.graveyardPending ? 900 : 650 }); }
    async function playGraveyard(event, token) { const recovered = event.kind === 'graveyardRecovered'; await routePresentation(event, token, { kind: recovered ? 'graveyard-recovered' : 'graveyard-declined', kicker: '墓地的最终裁决', title: recovered ? `${event.card?.name || '城区'}回到手中` : `${event.card?.name || '城区'}化为废墟`, copy: recovered ? '支付 1 金，该牌回到墓地主人的私密手牌' : '墓地主人放弃回收，摧城结算完成', visual: eventDistrictMarkup(event.card, recovered ? 'is-recovered' : 'is-crumbling'), to: recovered ? playerAnchor(event.playerId) : null, color: recovered ? '#9a7ab0' : '#cf7667', centerDuration: 420, endDuration: 650 }); }
    async function playMajorNotice(event, token) { const configs = { roleSummoningStart: ['role-summoning', '宫廷封好所有密令', '角色召集开始', `第 ${event.round || state().round} 轮将从 1 号到 8 号依次揭示`, 'Ⅷ', false, 760], roundTransition: ['round-transition', `第 ${event.completedRound || 0} 轮结束`, `进入第 ${event.nextRound || 0} 轮`, `${event.crownHolderName || '新国王'}持有皇冠，将率先选择角色`, '♛', false, 850], finalRoundTriggered: ['final-round', `${event.playerName}建成第八座城区`, '最终轮已锁定', '完成当前角色召集后，所有城市进入最终计分', 'Ⅷ', true, 1250] }[event.kind]; if (!configs) return; showPresentation(configs[0], eventFrame(configs[1], configs[2], configs[3], `<span class="citadels-event-major-mark">${configs[4]}</span>`), { strong: configs[5] }); await nextFrame(); $('presentationLayer').classList.add('is-revealed'); await presentationDelay(configs[6], token); }
    async function playFinalSettlement(event, token) { const winnerIds = new Set((event.winners || []).map(item => String(item.id))); const rows = (event.standings || []).map((score, index) => `<article class="${winnerIds.has(String(score.id)) ? 'is-winner' : ''}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${escapeHtml(score.name)}</strong><small>城区 ${score.districtSum} + 首建 ${score.firstFinisherBonus || 0} + 八城 ${score.eightCityBonus || 0} + 五色 ${score.colorBonus || 0} + 宝库 ${score.treasuryBonus || 0} + 地图室 ${score.mapRoomBonus || 0}</small></span><em>${score.score}</em></article>`).join(''); const names = (event.winners || []).map(item => item.name).join('、'); const personal = event.viewerVariant === 'personalVictory'; const title = personal ? (event.title || '您已获胜') : `${names || '本局'}获胜`; const detail = personal ? (event.detail || '您建成了最辉煌的城市，终局账本已经结算。') : '总分相同时依次比较城区分与剩余金币'; showPresentation('final-settlement', `<article class="citadels-finale-event"><span class="citadels-event-kicker">八座城市的最终账簿</span><span class="citadels-finale-crown">♛</span><h2>${escapeHtml(title)}</h2><div class="citadels-finale-list">${rows}</div><p>${escapeHtml(detail)}</p></article>`, { strong: true }); await nextFrame(); $('presentationLayer').classList.add('is-revealed'); await presentationDelay(2800, token); }

    async function playPresentationEvent(event, token) {
        if (event.kind === 'roleDraftStart') return playRoleDraftStart(event, token);
        if (event.kind === 'roleDraftProgress') return playRoleDraft(event, token);
        if (event.kind === 'roleUnanswered') return playRoleUnanswered(event, token);
        if (event.kind === 'roleCall') return playRoleCall(event, token);
        if (event.kind === 'crownAcquired') return playCrownAcquired(event, token);
        if (event.kind === 'assassinationDeclared' || event.kind === 'robberyDeclared') return playDeclaration(event, token, event.kind);
        if (event.kind === 'assassinationResolved') return playAssassination(event, token);
        if (event.kind === 'robberyResolved') return playRobbery(event, token);
        if (event.kind === 'magicianExchange' || event.kind === 'magicianSwap') return playMagician(event, token);
        if (['takeGold', 'drawDistrict', 'keepDistrict', 'incomeCollected', 'smithy'].includes(event.kind)) return playResource(event, token);
        if (event.kind === 'buildDistrict') return playBuild(event, token);
        if (event.kind === 'buildPhaseClosed') return playBuildPhaseClosed(event, token);
        if (event.kind === 'turnEnded') return playTurnEnded(event, token);
        if (event.kind === 'laboratory') return playLaboratory(event, token);
        if (event.kind === 'destroyDistrict') return playDestroy(event, token);
        if (event.kind === 'graveyardRecovered' || event.kind === 'graveyardDeclined') return playGraveyard(event, token);
        if (['roleSummoningStart', 'roundTransition', 'finalRoundTriggered'].includes(event.kind)) return playMajorNotice(event, token);
        if (event.kind === 'finalSettlement') return playFinalSettlement(event, token);
        return null;
    }

    async function holdPresentationLock(token) {
        while (token === model.presentationToken && Date.now() < Number(model.presentationLockedUntil || 0)) {
            if (!await waitUntil(model.presentationLockedUntil, token)) return;
        }
        if (token !== model.presentationToken) return;
        model.presentationPlaying = false;
        mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
        renderer?.render?.();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        mount.querySelector('.citadels-app')?.classList.add('is-presentation-playing');
        renderer?.render?.();
        while (model.presentationQueue.length && token === model.presentationToken) {
            const batch = model.presentationQueue.shift();
            activeBatch = batch;
            for (let eventIndex = 0; eventIndex < (batch?.events || []).length; eventIndex += 1) {
                activeEventIndex = eventIndex;
                const event = batch.events[eventIndex];
                if (token !== model.presentationToken) break;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= Date.now()) continue;
                if (Number.isFinite(Number(event.startedAt)) && !await waitUntil(event.startedAt, token)) break;
                currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Number.POSITIVE_INFINITY;
                currentContentDeadline = Number.isFinite(currentEventDeadline)
                    ? Math.max(Date.now(), currentEventDeadline - PRESENTATION_FADE_MS)
                    : Number.POSITIVE_INFINITY;
                const played = playPresentationEvent(event, token);
                if (played) await played;
                if (token !== model.presentationToken) break;
                if (Number.isFinite(currentContentDeadline) && !await waitUntil(currentContentDeadline, token)) break;
                if (!await fadeThenHide(token)) break;
            }
        }
        if (token !== model.presentationToken) return;
        activeBatch = null;
        activeEventIndex = -1;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        hidePresentation();
        if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            void holdPresentationLock(token);
            return;
        }
        model.presentationPlaying = false;
        mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
        renderer?.render?.();
    }

    function enqueuePresentation(batch) {
        if (!batch?.events?.length) return;
        if (Number.isFinite(Number(batch.endsAt))) {
            if (Number(batch.endsAt) <= Date.now()) return;
            model.presentationLockedUntil = Math.max(Number(model.presentationLockedUntil) || 0, Number(batch.endsAt));
        }
        model.presentationQueue.push(JSON.parse(JSON.stringify(batch)));
        void runPresentationQueue();
    }

    function skipPresentation() {
        // The current visual is local-only and may be skipped, but events
        // that have not started yet must stay queued for their server slots.
        if (activeBatch && activeEventIndex >= 0) {
            const remaining = (activeBatch.events || []).slice(activeEventIndex + 1)
                .filter(event => !Number.isFinite(Number(event.endsAt)) || Number(event.endsAt) > Date.now());
            if (remaining.length) model.presentationQueue.unshift({ ...activeBatch, events: remaining, startedAt: remaining[0].startedAt });
        }
        const token = ++model.presentationToken;
        cancelPresentationWait();
        hidePresentation();
        activeBatch = null;
        activeEventIndex = -1;
        if (model.presentationQueue.length) {
            model.presentationPlaying = false;
            void runPresentationQueue();
        } else if (Date.now() < Number(model.presentationLockedUntil || 0)) {
            model.presentationPlaying = true;
            mount.querySelector('.citadels-app')?.classList.add('is-presentation-playing');
            renderer?.render?.();
            void holdPresentationLock(token);
        } else {
            model.presentationPlaying = false;
            mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
            renderer?.render?.();
        }
    }

    function stopPresentation() {
        model.presentationToken += 1;
        model.presentationQueue = [];
        cancelPresentationWait();
        hidePresentation();
        model.presentationPlaying = false;
        model.presentationLockedUntil = 0;
        currentEventDeadline = Number.POSITIVE_INFINITY;
        currentContentDeadline = Number.POSITIVE_INFINITY;
        mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
        renderer?.render?.();
    }
    return { enqueuePresentation, skipPresentation, stopPresentation, isPlaying: () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0) };
}
