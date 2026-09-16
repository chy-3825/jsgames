import { ROLE_NAMES, SCENE_ACTION_NAMES, escapeHtml } from './constants.js';
import { renderSceneRole } from './cards.js';
import { getPlayer, revealReason } from './state.js';
import { beginPresentationFade, clearPresentationFade, PRESENTATION_FADE_MS } from '../common/presentation-fade.js';

/** Public action and final-result scenes for 政变. */
export function createCoupScene({ mount, model, getElement, windowRef = globalThis.window || globalThis, renderer }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const root = mount.querySelector('.cp-app');
    const requestFrame = callback => (windowRef.requestAnimationFrame || (fn => windowRef.setTimeout(fn, 0)))(callback);
    const reducedMotion = Boolean(windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    model.presentationQueue ||= [];
    model.presentationWaiters ||= new Set();
    model.presentationEventIds ||= new Set();
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
        return getPlayer(model.state, id)?.name || id || fallback;
    }

    function actionName(kind) {
        return SCENE_ACTION_NAMES[kind] || (kind === 'playerLeave' ? '离场' : '行动');
    }

    function roleName(role) {
        return ROLE_NAMES[role] || role || '对应角色';
    }

    function showScene(kind, html) {
        const layer = $('sceneLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.hidden = false;
        layer.className = `cp-scene-layer is-active is-${kind}`;
        layer.setAttribute('aria-hidden', 'false');
        $('scene').innerHTML = html;
    }

    function hideScene() {
        const layer = $('sceneLayer');
        if (!layer) return;
        clearPresentationFade(layer);
        layer.className = 'cp-scene-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('scene').innerHTML = '';
        layer.hidden = true;
        currentEvent = null;
        model.presentationEvent = null;
    }

    function revealScene() {
        requestFrame(() => $('sceneLayer')?.classList.add('is-revealed'));
    }

    function closeOverlaysForPresentation() {
        for (const role of ['rolesOverlay', 'exchangeOverlay', 'endOverlay']) {
            const overlay = $(role);
            if (overlay && !overlay.classList.contains('is-hidden')) renderer?.setOverlay?.(overlay, false);
        }
    }

    function eventMarkup(event) {
        const kind = event.kind;
        const actor = event.actorName || playerName(event.actorId);
        const target = event.targetName || playerName(event.targetId, '目标玩家');
        const action = actionName(event.actionKind);

        if (kind === 'actionDeclared') {
            const mark = event.actionKind === 'coup' ? '政' : event.actionKind === 'assassinate' ? '刺' : event.actionKind === 'tax' ? '税' : event.actionKind === 'exchange' ? '换' : event.actionKind === 'steal' ? '窃' : event.actionKind === 'foreign_aid' ? '援' : '入';
            const detail = event.actionKind === 'coup'
                ? '支付 7 枚金币，目标必须失去一张影响力。'
                : event.actionKind === 'assassinate'
                    ? '支付 3 枚金币，目标必须失去一张影响力。'
                    : event.claimedRole
                        ? `声称拥有${roleName(event.claimedRole)}，声明可以被质疑。`
                        : `${action}已提交。`;
            const title = event.targetId ? `${actor}向${target}发动${action}` : `${actor}选择${action}`;
            return {
                sceneKind: 'declaration',
                html: `<span class="cp-scene-kicker">${event.claimedRole ? '角色声明' : '行动'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${mark}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>`,
            };
        }

        if (kind === 'challengeDeclared') {
            const challenger = event.challengerName || playerName(event.challengerId);
            const responder = event.responderName || playerName(event.responderId);
            return {
                sceneKind: 'verdict',
                html: `<span class="cp-scene-kicker">质疑</span><div class="cp-scene-verdict-mark" aria-hidden="true">疑</div><h2>${escapeHtml(challenger)}质疑${escapeHtml(responder)}的${escapeHtml(roleName(event.claimedRole))}声明</h2><p>${escapeHtml(action)}暂停，等待声明者回应。</p>`,
            };
        }

        if (kind === 'blockDeclared') {
            const blocker = event.actorName || playerName(event.actorId);
            const requester = event.targetName || playerName(event.targetId);
            return {
                sceneKind: 'block',
                html: `<span class="cp-scene-kicker">阻挡</span><div class="cp-scene-verdict-mark" aria-hidden="true">阻</div><h2>${escapeHtml(blocker)}阻挡${escapeHtml(action)}</h2><p>${escapeHtml(requester)}的行动暂时停止；阻挡声明仍可被质疑。</p>`,
            };
        }

        if (kind === 'challengeResolved') {
            const proved = String(event.verdict || '').endsWith('_proved');
            const isBlock = String(event.verdict || '').startsWith('block_');
            const responder = event.responderName || playerName(event.responderId);
            const challenger = event.challengerName || playerName(event.challengerId);
            const title = proved ? `${responder}证明了${roleName(event.provedRole || event.claimedRole)}` : `${responder}无法证明${roleName(event.claimedRole)}`;
            const detail = proved
                ? `${challenger}质疑失败，揭示一张影响力。`
                : (isBlock ? '阻挡未成立，原行动继续。' : '声明未成立，原行动取消。');
            return {
                sceneKind: `verdict ${proved ? 'is-proved' : 'is-failed'}`,
                html: `<span class="cp-scene-kicker">${isBlock ? '阻挡结果' : '质疑结果'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${proved ? '真' : '伪'}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>`,
            };
        }

        if (kind === 'blockResolved') {
            const blocker = event.actorName || playerName(event.actorId);
            return {
                sceneKind: 'block',
                html: `<span class="cp-scene-kicker">阻挡成功</span><div class="cp-scene-verdict-mark" aria-hidden="true">阻</div><h2>${escapeHtml(blocker)}阻挡了${escapeHtml(action)}</h2><p>${escapeHtml(roleName(event.claimedRole))}声明成立，原行动未生效。</p>`,
            };
        }

        if (kind === 'influenceRevealed') {
            const name = event.playerName || playerName(event.playerId);
            return {
                sceneKind: 'influence',
                html: `<span class="cp-scene-kicker">揭示影响力</span>${renderSceneRole(event.role)}<h2>${escapeHtml(name)}失去一张影响力</h2><p>${escapeHtml(revealReason(event.reason))}</p>`,
            };
        }

        if (kind === 'playerEliminated') {
            const personal = event.viewerVariant === 'personalElimination';
            const name = event.playerName || playerName(event.playerId);
            const roles = (event.roles || []).filter(Boolean);
            const title = personal ? (event.title || '你已出局') : `${name}已出局`;
            const detail = personal
                ? (event.detail || '你的两张影响力均已揭示，可以继续观战。')
                : '两张影响力均已揭示。';
            return {
                sceneKind: 'elimination',
                html: `<span class="cp-scene-kicker">${personal ? '个人结果' : '玩家出局'}</span><div class="cp-scene-role-row">${roles.map(renderSceneRole).join('')}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>`,
            };
        }

        if (kind === 'finalSettlement') {
            const personal = event.viewerVariant === 'personalVictory' || event.viewerVariant === 'personalElimination';
            const winner = event.winnerName || playerName(event.winnerId, '无人');
            const title = personal ? (event.title || (event.viewerVariant === 'personalVictory' ? '你获胜了' : '你已出局')) : (event.winnerId ? `${winner}获胜` : '本局结束');
            const detail = personal
                ? (event.detail || (event.viewerVariant === 'personalVictory' ? '你是最后仍有影响力的玩家。' : '你的最后一张影响力已揭示，游戏结束。'))
                : (event.reason === 'playerLeave' ? `${event.eliminatedPlayerName || '一名玩家'}离场，剩余玩家完成终局结算。` : '最后仍有影响力的玩家获胜。');
            const roles = (event.eliminatedRoles || []).filter(Boolean);
            return {
                sceneKind: 'victory',
                html: `<span class="cp-scene-kicker">${personal ? '个人结果' : '游戏结束'}</span><div class="cp-victory-seal" aria-hidden="true">${event.viewerVariant === 'personalElimination' ? '失' : '政'}</div>${roles.length ? `<div class="cp-scene-role-row">${roles.map(renderSceneRole).join('')}</div>` : ''}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>`,
            };
        }

        if (kind === 'exchangeResolved') {
            const count = Number(event.keptCount) || 0;
            return {
                sceneKind: 'declaration',
                html: `<span class="cp-scene-kicker">交换完成</span><div class="cp-scene-verdict-mark" aria-hidden="true">换</div><h2>${escapeHtml(actor)}完成交换</h2><p>保留 ${count} 张影响力；交换结果仅本人可见。</p>`,
            };
        }

        if (kind === 'actionResolved') {
            if (event.amount) {
                const seat = [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === event.actorId);
                const wallet = seat?.querySelector('.cp-wallet, .cp-seat-coins') || seat;
                const rect = wallet?.getBoundingClientRect();
                const position = rect ? `left:${rect.left + rect.width / 2}px;top:${Math.max(24, rect.top - 12)}px` : 'left:50%;top:50%';
                return { sceneKind: 'amount', html: `<div class="cp-amount-feedback" style="${position}"><strong>+${escapeHtml(String(event.amount))}</strong><small>${escapeHtml(action)}</small></div>` };
            }
            const detail = event.awaitingPlayerName ? `请${event.awaitingPlayerName}选择要揭示的一张影响力。` : `${actor}已完成行动。`;
            return { sceneKind: 'declaration', html: `<h2>${escapeHtml(action)}</h2><p>${escapeHtml(detail)}</p>` };

        }

        return {
            sceneKind: 'declaration',
            html: `<span class="cp-scene-kicker">行动更新</span><div class="cp-scene-verdict-mark" aria-hidden="true">政</div><h2>${escapeHtml(actor)}完成${escapeHtml(action)}</h2><p>行动记录已更新。</p>`,
        };
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

        const rendered = eventMarkup(event);
        currentEventDeadline = Number.isFinite(Number(event.endsAt)) ? Number(event.endsAt) : Date.now() + 820 + PRESENTATION_FADE_MS;
        showScene(rendered.sceneKind, rendered.html);
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
        beginPresentationFade($('sceneLayer'));
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
        root.classList.remove('is-scene-active');
        renderer?.render?.();
        if (model.presentationQueue.length) void runPresentationQueue();
    }

    async function runPresentationQueue() {
        if (model.presentationPlaying || !model.presentationQueue.length) return;
        model.presentationPlaying = true;
        const token = ++model.presentationToken;
        closeOverlaysForPresentation();
        root.classList.add('is-scene-active');
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
        root.classList.remove('is-scene-active');
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

    // ---------------------- 旧协议兼容场景 ----------------------

    function deriveScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        if (next.lastReveal?.revealId && next.lastReveal.revealId !== previous.lastReveal?.revealId) {
            const revealedPlayer = getPlayer(next, next.lastReveal.playerId);
            const eliminatedRoles = next.lastReveal.eliminated ? (revealedPlayer?.influences || []).filter(card => card.revealed && card.role).map(card => card.role) : [];
            if (next.lastReveal.eliminated) scenes.push({ type: 'elimination', reveal: { ...next.lastReveal, roles: eliminatedRoles }, player: revealedPlayer });
        }
        if (!previous.gameOver && next.gameOver) scenes.push({ type: 'victory', winner: getPlayer(next, next.winner) });
        return scenes;
    }

    function enqueueScenes(scenes) {
        if (!scenes.length) return;
        model.sceneQueue.push(...scenes);
        void playSceneQueue();
    }

    async function playSceneQueue() {
        if (model.scenePlaying || model.presentationPlaying) return;
        model.scenePlaying = true;
        root.classList.add('is-scene-active');
        while (model.sceneQueue.length) {
            const scene = model.sceneQueue.shift();
            const token = ++model.sceneToken;
            if (scene.type === 'declaration') await playDeclarationScene(scene, token);
            if (scene.type === 'verdict') await playVerdictScene(scene, token);
            if (scene.type === 'influence') await playInfluenceScene(scene, token);
            if (scene.type === 'elimination') await playEliminationScene(scene, token);
            if (scene.type === 'block') await playBlockScene(scene, token);
            if (scene.type === 'victory') await playVictoryScene(scene, token);
            if (token === model.sceneToken && !await fadeThenHide(token)) break;
        }
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    async function playDeclarationScene(scene, token) {
        const isCoup = scene.kind === 'coup';
        showScene('declaration', `<span class="cp-scene-kicker">${isCoup ? '政变' : '角色声明'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${isCoup ? '政' : '刺'}</div><h2>${escapeHtml(scene.actor?.name || '玩家')}向${escapeHtml(scene.target?.name || '目标')}发动${SCENE_ACTION_NAMES[scene.kind]}</h2><p>${isCoup ? '支付 7 枚金币，目标必须失去一张影响力。' : '声称拥有刺客，声明可被质疑或阻挡。'}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playVerdictScene(scene, token) {
        const verdict = scene.interaction.verdict;
        const proved = verdict === 'claim_proved' || verdict === 'block_proved';
        const isBlock = verdict === 'block_proved' || verdict === 'block_failed';
        const role = scene.interaction.provedRole || scene.interaction.blockRole || scene.interaction.claimedRole;
        const title = proved ? `${escapeHtml(scene.claimant?.name || '玩家')}证明了${escapeHtml(ROLE_NAMES[role] || '对应角色')}` : `${escapeHtml(scene.claimant?.name || '玩家')}无法证明${escapeHtml(ROLE_NAMES[role] || '对应角色')}`;
        const detail = proved ? `${escapeHtml(scene.challenger?.name || '质疑者')}质疑失败，揭示一张影响力。` : `${isBlock ? '阻挡未成立，原行动继续。' : '声明未成立，原行动取消。'}`;
        showScene(`verdict ${proved ? 'is-proved' : 'is-failed'}`, `<span class="cp-scene-kicker">${isBlock ? '阻挡结果' : '质疑结果'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${proved ? '真' : '伪'}</div><h2>${title}</h2><p>${detail}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playInfluenceScene(scene, token) {
        showScene('influence', `<span class="cp-scene-kicker">揭示影响力</span>${renderSceneRole(scene.reveal.role)}<h2>${escapeHtml(scene.player?.name || '玩家')}失去一张影响力</h2><p>${escapeHtml(revealReason(scene.reveal.reason))}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playEliminationScene(scene, token) {
        const roles = scene.reveal.roles?.length ? scene.reveal.roles : [scene.reveal.role];
        showScene('elimination', `<span class="cp-scene-kicker">玩家出局</span><div class="cp-scene-role-row">${roles.map(renderSceneRole).join('')}</div><h2>${escapeHtml(scene.player?.name || '玩家')}已出局</h2><p>两张影响力均已揭示。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        if (!await sceneDelay(1050, token)) return;
        await sceneDelay(300, token);
    }

    async function playBlockScene(scene, token) {
        const actionNameValue = SCENE_ACTION_NAMES[scene.actionKind] || '行动';
        showScene('block', `<span class="cp-scene-kicker">阻挡成功</span><div class="cp-scene-verdict-mark" aria-hidden="true">阻</div><h2>${escapeHtml(scene.blocker?.name || '玩家')}阻挡了${actionNameValue}</h2><p>${escapeHtml(ROLE_NAMES[scene.role] || '对应角色')}声明成立，${escapeHtml(scene.actor?.name || '行动者')}的${actionNameValue}未生效。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playVictoryScene(scene, token) {
        showScene('victory', `<span class="cp-scene-kicker">游戏结束</span><div class="cp-victory-seal" aria-hidden="true">政</div><h2>${escapeHtml(scene.winner?.name || '无人')}获胜</h2><p>最后仍有影响力的玩家获胜。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1500, token);
    }

    function fadeThenHide(token) {
        const layer = $('sceneLayer');
        beginPresentationFade(layer);
        return sceneDelay(PRESENTATION_FADE_MS, token).then(continued => {
            if (!continued) return false;
            hideScene();
            return true;
        });
    }

    function sceneDelay(duration, token) {
        const wait = reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = { timer: 0, done: false, resolve(value) { if (waiter.done) return; waiter.done = true; model.sceneWaiters.delete(waiter); windowRef.clearTimeout(waiter.timer); resolve(value); } };
            waiter.timer = windowRef.setTimeout(() => waiter.resolve(token === model.sceneToken), wait);
            model.sceneWaiters.add(waiter);
        });
    }

    function skipPresentation() {
        if (!model.presentationPlaying && !model.presentationQueue.length) return;
        if (!currentEvent) return;
        model.presentationSkipCurrent = true;
        cancelPresentationWaiters();
        hideScene();
        renderer?.render?.();
    }

    function skipScene() {
        if (model.presentationPlaying || model.presentationQueue.length) return skipPresentation();
        if (!model.scenePlaying) return;
        model.sceneToken++;
        for (const waiter of model.sceneWaiters) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); }
        model.sceneWaiters.clear();
        model.sceneQueue = [];
        hideScene();
    }

    function stopPresentation() {
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
        root.classList.remove('is-scene-active');
        model.sceneToken += 1;
        model.sceneQueue = [];
        for (const waiter of model.sceneWaiters) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); }
        model.sceneWaiters.clear();
        model.scenePlaying = false;
        windowRef.clearTimeout(model.actionSettleTimer);
        renderer?.render?.();
    }

    function destroy() {
        stopPresentation();
    }

    return {
        deriveScenes,
        enqueueScenes,
        enqueuePresentation,
        skipPresentation,
        stopPresentation,
        skipScene,
        destroy,
        isPlaying: () => model.scenePlaying || model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0),
    };
}
