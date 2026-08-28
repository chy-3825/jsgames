import { ROLE_NAMES, SCENE_ACTION_NAMES, escapeHtml } from './constants.js';
import { renderSceneRole } from './cards.js';
import { getPlayer, revealReason } from './state.js';

/** Public action and final-result scenes for 政变. */
export function createCoupScene({ mount, model, getElement, windowRef = globalThis.window || globalThis }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const root = mount.querySelector('.cp-app');
    const requestFrame = callback => (windowRef.requestAnimationFrame || (fn => windowRef.setTimeout(fn, 0)))(callback);

    function deriveScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        const previousInteraction = previous.interaction;
        const interaction = next.interaction;
        const isNewInteraction = interaction?.actionId && interaction.actionId !== previousInteraction?.actionId;
        if (isNewInteraction && (interaction.kind === 'coup' || interaction.kind === 'assassinate')) scenes.push({ type: 'declaration', kind: interaction.kind, actor: getPlayer(next, interaction.actorId), target: getPlayer(next, interaction.targetId) });
        if (interaction?.verdict && (interaction.actionId !== previousInteraction?.actionId || interaction.verdict !== previousInteraction?.verdict)) scenes.push({ type: 'verdict', interaction, claimant: getPlayer(next, interaction.provedById || interaction.failedById || interaction.blockerId || interaction.actorId), challenger: getPlayer(next, interaction.challengerId) });
        if (next.lastReveal?.revealId && next.lastReveal.revealId !== previous.lastReveal?.revealId) {
            const revealedPlayer = getPlayer(next, next.lastReveal.playerId);
            const eliminatedRoles = next.lastReveal.eliminated ? (revealedPlayer?.influences || []).filter(card => card.revealed && card.role).map(card => card.role) : [];
            const reveal = eliminatedRoles.length ? { ...next.lastReveal, roles: eliminatedRoles } : next.lastReveal;
            scenes.push({ type: reveal.eliminated ? 'elimination' : 'influence', reveal, player: revealedPlayer });
        }
        if (interaction?.outcome === 'blocked' && (interaction.actionId !== previousInteraction?.actionId || previousInteraction?.outcome !== 'blocked')) scenes.push({ type: 'block', blocker: getPlayer(next, interaction.blockerId), actor: getPlayer(next, interaction.actorId), actionKind: interaction.kind, role: interaction.blockRole });
        if (!previous.gameOver && next.gameOver) scenes.push({ type: 'victory', winner: getPlayer(next, next.winner) });
        return scenes;
    }

    function enqueueScenes(scenes) {
        if (!scenes.length) return;
        model.sceneQueue.push(...scenes);
        void playSceneQueue();
    }

    async function playSceneQueue() {
        if (model.scenePlaying) return;
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
            if (token === model.sceneToken) hideScene();
        }
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    async function playDeclarationScene(scene, token) {
        const isCoup = scene.kind === 'coup';
        showScene('declaration', `<span class="cp-scene-kicker">${isCoup ? '不可阻挡' : '致命声明'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${isCoup ? '政' : '刺'}</div><h2>${escapeHtml(scene.actor?.name || '玩家')}向${escapeHtml(scene.target?.name || '目标')}发动${SCENE_ACTION_NAMES[scene.kind]}</h2><p>${isCoup ? '支付 7 枚金币，目标必须失去一张影响力。' : '声称拥有刺客，这项声明可被质疑或阻挡。'}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playVerdictScene(scene, token) {
        const verdict = scene.interaction.verdict;
        const proved = verdict === 'claim_proved' || verdict === 'block_proved';
        const isBlock = verdict === 'block_proved' || verdict === 'block_failed';
        const role = scene.interaction.provedRole || scene.interaction.blockRole || scene.interaction.claimedRole;
        const title = proved ? `${escapeHtml(scene.claimant?.name || '玩家')}证明了${escapeHtml(ROLE_NAMES[role] || '对应身份')}` : `${escapeHtml(scene.claimant?.name || '玩家')}未能证明${escapeHtml(ROLE_NAMES[role] || '对应身份')}`;
        const detail = proved ? `${escapeHtml(scene.challenger?.name || '质疑者')}质疑失败，必须失去一张影响力。` : `${isBlock ? '阻挡被推翻，原行动将继续。' : '质疑成立，原行动取消。'}`;
        showScene(`verdict ${proved ? 'is-proved' : 'is-failed'}`, `<span class="cp-scene-kicker">${isBlock ? '阻挡裁决' : '身份裁决'}</span><div class="cp-scene-verdict-mark" aria-hidden="true">${proved ? '真' : '伪'}</div><h2>${title}</h2><p>${detail}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playInfluenceScene(scene, token) {
        showScene('influence', `<span class="cp-scene-kicker">影响力揭示</span>${renderSceneRole(scene.reveal.role)}<h2>${escapeHtml(scene.player?.name || '玩家')}失去一张影响力</h2><p>${escapeHtml(revealReason(scene.reveal.reason))}</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playEliminationScene(scene, token) {
        const roles = scene.reveal.roles?.length ? scene.reveal.roles : [scene.reveal.role];
        showScene('elimination', `<span class="cp-scene-kicker">议会除名</span><div class="cp-scene-role-row">${roles.map(renderSceneRole).join('')}</div><h2>${escapeHtml(scene.player?.name || '玩家')}出局</h2><p>两张影响力均已公开，离开本局权力斗争。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        if (!await sceneDelay(1050, token)) return;
        await sceneDelay(300, token);
    }

    async function playBlockScene(scene, token) {
        const actionName = SCENE_ACTION_NAMES[scene.actionKind] || '行动';
        showScene('block', `<span class="cp-scene-kicker">反制生效</span><div class="cp-scene-verdict-mark" aria-hidden="true">阻</div><h2>${escapeHtml(scene.blocker?.name || '玩家')}成功阻挡${actionName}</h2><p>${escapeHtml(ROLE_NAMES[scene.role] || '对应角色')}声明成立，${escapeHtml(scene.actor?.name || '行动者')}的${actionName}没有生效。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playVictoryScene(scene, token) {
        showScene('victory', `<span class="cp-scene-kicker">最终裁决</span><div class="cp-victory-seal" aria-hidden="true">政</div><h2>${escapeHtml(scene.winner?.name || '无人')}掌控了城邦</h2><p>最后仍保有影响力的玩家获得胜利。</p>`);
        requestFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1500, token);
    }

    function showScene(kind, html) {
        const layer = $('sceneLayer');
        layer.hidden = false;
        layer.className = `cp-scene-layer is-active is-${kind}`;
        layer.setAttribute('aria-hidden', 'false');
        $('scene').innerHTML = html;
    }

    function hideScene() {
        const layer = $('sceneLayer');
        layer.className = 'cp-scene-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('scene').innerHTML = '';
        layer.hidden = true;
    }

    function sceneDelay(duration, token) {
        const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        const wait = reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = { timer: 0, resolve(value) { model.sceneWaiters.delete(waiter); resolve(value); } };
            waiter.timer = windowRef.setTimeout(() => waiter.resolve(token === model.sceneToken), wait);
            model.sceneWaiters.add(waiter);
        });
    }

    function skipScene() {
        if (!model.scenePlaying) return;
        model.sceneToken++;
        for (const waiter of model.sceneWaiters) { windowRef.clearTimeout(waiter.timer); waiter.resolve(false); }
        model.sceneWaiters.clear();
        model.sceneQueue = [];
        hideScene();
    }

    function destroy() {
        model.sceneQueue = [];
        skipScene();
        windowRef.clearTimeout(model.actionSettleTimer);
        hideScene();
        model.scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    return { deriveScenes, enqueueScenes, skipScene, destroy, isPlaying: () => model.scenePlaying };
}
