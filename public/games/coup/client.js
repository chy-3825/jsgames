const ROLE_NAMES = {
    duke: '公爵',
    assassin: '刺客',
    captain: '船长',
    ambassador: '大使',
    contessa: '伯爵夫人',
    captain_or_ambassador: '船长或大使',
};

const ROLE_MARKS = {
    duke: '爵',
    assassin: '刺',
    captain: '船',
    ambassador: '使',
    contessa: '夫',
    captain_or_ambassador: '船/使',
};

const ROLE_EFFECTS = {
    duke: '征税获得 3 枚金币；可以阻挡外援。',
    assassin: '支付 3 枚金币，暗杀一名玩家。',
    captain: '从目标处偷取至多 2 枚金币；可以阻挡偷窃。',
    ambassador: '与宫廷牌库交换影响力；可以阻挡偷窃。',
    contessa: '阻挡刺客的暗杀。',
    captain_or_ambassador: '目标可声称船长或大使来阻挡偷窃。',
};

const ROLE_NOTES = {
    duke: '行动：征税 · 反制：外援',
    assassin: '行动：暗杀',
    captain: '行动：偷窃 · 反制：偷窃',
    ambassador: '行动：交换 · 反制：偷窃',
    contessa: '反制：暗杀',
};

const ROLE_ART = {
    duke: 'modern-duke',
    assassin: 'modern-assassin',
    captain: 'modern-captain',
    ambassador: 'modern-ambassador',
    contessa: 'modern-contessa',
};

const CARD_BACK_ART = 'modern-back';

const ACTIONS = [
    { id: 'income', name: '收入', group: 'public', desc: '从国库获得 1 枚金币', icon: '+1' },
    { id: 'foreign_aid', name: '外援', group: 'public', desc: '获得 2 枚金币，可被公爵阻挡', icon: '+2' },
    { id: 'tax', name: '征税', group: 'claim', desc: '声称公爵，获得 3 枚金币', role: 'duke', icon: 'D' },
    { id: 'exchange', name: '交换', group: 'claim', desc: '声称大使，与牌库交换影响力', role: 'ambassador', icon: 'M' },
    { id: 'steal', name: '偷窃', group: 'claim', desc: '声称船长，偷取目标至多 2 枚金币', role: 'captain', needsTarget: true, icon: 'C' },
    { id: 'assassinate', name: '暗杀', group: 'claim', desc: '声称刺客，支付 3 枚金币', role: 'assassin', needCoins: 3, needsTarget: true, icon: 'A' },
    { id: 'coup', name: '政变', group: 'coup', desc: '支付 7 枚金币，目标失去影响力', needCoins: 7, needsTarget: true, icon: '!' },
];

const ACTION_GROUPS = [
    { id: 'public', name: '公开行动' },
    { id: 'claim', name: '角色声明' },
    { id: 'coup', name: '终结手段' },
];

const DECISION_REACTION_MS = 850;

export function createGameClient({ mount, send: lobbySend, addLog: lobbyAddLog }) {
    [...Object.values(ROLE_ART), CARD_BACK_ART].forEach(file => {
        const image = new Image();
        image.src = `/assets/bgg/coup/${file}.jpg`;
    });

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/coup/style.css?v=20260826-mobile-games-4';
    document.head.appendChild(style);
    document.body.classList.add('is-coup-view');

    let state = null;
    let pendingAction = null;
    let selectedTarget = null;
    let exchangeOpen = false;
    let exchangeMode = null;
    let exchangeKeep = [];
    let animateInteractionId = null;
    let centeredInteractionId = null;
    let actionLayoutFrame = 0;
    let actionSettleTimer = 0;
    let decisionKey = null;
    let decisionReadyAt = 0;
    let decisionTimer = 0;
    let scenePlaying = false;
    let sceneToken = 0;
    let sceneQueue = [];
    const sceneWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const controller = new AbortController();
    style.addEventListener('load', scheduleActionPresentation, { signal: controller.signal });

    mount.innerHTML = `<section class="cp-app" aria-label="政变游戏">
        <header class="cp-statusbar">
            <div class="cp-brand"><span class="cp-brand-seal" aria-hidden="true">政</span><div><small>密谋 · 质疑 · 夺权</small><h1>城邦议会</h1></div></div>
            <div class="cp-turn-status"><span class="cp-turn-dot" aria-hidden="true"></span><div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div></div>
            <dl class="cp-public-stats"><div><dt>在场</dt><dd><b data-role="alive">0</b> 人</dd></div><div><dt>阶段</dt><dd data-role="phaseShort">等待</dd></div></dl>
            <button class="cp-icon-button" data-action="roles" type="button" aria-label="查看角色速查" title="角色速查">?</button>
        </header>

        <section class="cp-council" aria-label="其他玩家">
            <div class="cp-council-heading"><strong>议会席位</strong><span>金币与失效影响力公开</span></div>
            <div class="cp-players" data-role="players"></div>
        </section>

        <main class="cp-table">
            <div class="cp-table-inner">
                <section class="cp-stage" aria-label="当前局势">
                    <div class="cp-stage-core">
                        <div class="cp-court-deck" aria-label="宫廷牌库"><span class="cp-deck-stack"><span class="cp-card-back-art" role="img" aria-label="影响力牌背"><img src="/assets/bgg/coup/${CARD_BACK_ART}.jpg" alt=""></span></span><strong>宫廷牌库</strong></div>
                        <section class="cp-event" data-role="event" aria-live="polite"><div class="cp-event-sigil">政</div><div class="cp-event-copy"><span>当前局势</span><strong>等待第一项行动</strong><p>权力只属于最后仍保有影响力的人。</p></div></section>
                        <div class="cp-treasury" aria-label="公共国库"><span><i></i><i></i><i></i></span><strong>公共国库</strong></div>
                    </div>
                    <section class="cp-challenge" data-role="challenge" aria-live="assertive"></section>
                </section>

                <aside class="cp-intel" aria-label="最近行动记录">
                    <header><div><strong>局势记录</strong><span>最近行动</span></div><i aria-hidden="true"></i></header>
                    <div class="cp-timeline" data-role="timeline"></div>
                </aside>
            </div>
        </main>

        <section class="cp-command" data-role="command" aria-label="你的影响力与行动"></section>

        <svg class="cp-action-links" data-role="actionLinks" aria-hidden="true">
            <path class="cp-link-glow is-action" data-role="actionLinkGlow"></path>
            <path class="cp-link-stroke is-action" data-role="actionLinkStroke"></path>
            <circle class="cp-link-seal is-action" data-role="actionLinkSeal" r="7"></circle>
            <path class="cp-link-glow is-response" data-role="responseLinkGlow"></path>
            <path class="cp-link-stroke is-response" data-role="responseLinkStroke"></path>
            <circle class="cp-link-seal is-response" data-role="responseLinkSeal" r="6"></circle>
        </svg>

        <div class="cp-scene-layer" data-role="sceneLayer" aria-hidden="true" hidden>
            <div class="cp-scene" data-role="scene" role="status" aria-live="assertive"></div>
            <button class="cp-scene-skip" data-action="skip-scene" type="button">跳过</button>
        </div>

        <div class="cp-overlay is-hidden" data-role="rolesOverlay" aria-hidden="true">
            <div class="cp-dialog cp-roles-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-roles-title">
                <button class="cp-dialog-close" data-action="close-roles" type="button" aria-label="关闭角色速查">x</button>
                <span class="cp-dialog-label">基础版 · 五种影响力</span>
                <h2 id="cp-roles-title">宫廷角色速查</h2>
                <div class="cp-role-grid">${Object.keys(ROLE_ART).map(role => `<article class="cp-role-entry is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${ROLE_NAMES[role]}牌面"><div><header><i>${ROLE_MARKS[role]}</i><strong>${ROLE_NAMES[role]}</strong></header><p>${ROLE_EFFECTS[role]}</p><small>${ROLE_NOTES[role]}</small></div></article>`).join('')}</div>
            </div>
        </div>

        <div class="cp-overlay is-hidden" data-role="exchangeOverlay" aria-hidden="true">
            <div class="cp-dialog cp-exchange-dialog" data-role="exchangeDialog" role="dialog" aria-modal="true" aria-labelledby="cp-exchange-title"></div>
        </div>

        <div class="cp-overlay cp-end-overlay is-hidden" data-role="endOverlay" aria-hidden="true">
            <div class="cp-dialog cp-end-dialog" data-role="endDialog" role="dialog" aria-modal="true" aria-labelledby="cp-end-title"></div>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const root = mount.querySelector('.cp-app');

    function handleMessage(message) {
        if (message.state) {
            const previousState = state;
            const previousInteractionId = state?.interaction?.actionId ?? null;
            state = message.state;
            const currentInteractionId = state.interaction?.actionId ?? null;
            if (previousState && currentInteractionId && currentInteractionId !== previousInteractionId) {
                animateInteractionId = currentInteractionId;
            }
            updateDecisionWindow(previousState, state);

            if (state.exchange?.isMyTurn) {
                exchangeMode = 'select';
                exchangeOpen = true;
            } else if (!state.exchange) {
                exchangeKeep = [];
                if (exchangeMode === 'select') {
                    exchangeMode = null;
                    exchangeOpen = false;
                }
            }

            if (!isMyTurn() || state.challenge || state.influenceLoss || state.exchange || state.gameOver) {
                pendingAction = null;
                selectedTarget = null;
            }
            render();
            enqueueScenes(deriveScenes(previousState, state));
        }

        if (message.type === 'gameEnded' && message.winner) addLog(`${message.winner.name} 获胜`, 'system');
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else {
            const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
            if (text) addLog(text, 'info');
        }
    }

    function currentDecisionKey(value = state) {
        if (!value) return null;
        const actionId = value.interaction?.actionId || 0;
        if (value.influenceLoss?.isMyTurn) return `loss:${actionId}:${value.influenceLoss.playerId}:${value.interaction?.lastRevealId || 0}`;
        if (!value.challenge?.isMyTurn) return null;
        const challenge = value.challenge;
        const decider = challenge.currentBlockerId || challenge.currentChallengerId || challenge.responderId || value.myId;
        return `${challenge.phase}:${actionId}:${decider}:${challenge.claimedRole || ''}`;
    }

    function updateDecisionWindow(previous, next) {
        const nextKey = currentDecisionKey(next);
        if (!nextKey) {
            decisionKey = null;
            decisionReadyAt = 0;
            clearTimeout(decisionTimer);
            return;
        }
        if (nextKey === decisionKey) return;
        decisionKey = nextKey;
        decisionReadyAt = previous ? Date.now() + DECISION_REACTION_MS : 0;
        clearTimeout(decisionTimer);
        if (decisionReadyAt) {
            decisionTimer = window.setTimeout(() => {
                if (currentDecisionKey() === decisionKey) render();
            }, DECISION_REACTION_MS + 20);
        }
    }

    function decisionReady() {
        return !currentDecisionKey() || Date.now() >= decisionReadyAt;
    }

    function deriveScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        if (next.lastReveal?.revealId && next.lastReveal.revealId !== previous.lastReveal?.revealId) {
            const revealedPlayer = getPlayerFrom(next, next.lastReveal.playerId);
            const eliminatedRoles = next.lastReveal.eliminated
                ? (revealedPlayer?.influences || []).filter(card => card.revealed && card.role).map(card => card.role)
                : [];
            const reveal = eliminatedRoles.length ? { ...next.lastReveal, roles: eliminatedRoles } : next.lastReveal;
            scenes.push({
                type: reveal.eliminated ? 'elimination' : 'influence',
                reveal,
                player: revealedPlayer,
                winner: next.gameOver ? getPlayerFrom(next, next.winner) : null,
            });
        } else if (!previous.gameOver && next.gameOver) {
            scenes.push({ type: 'victory', winner: getPlayerFrom(next, next.winner) });
        }
        return scenes;
    }

    function getPlayerFrom(value, id) {
        return (value?.players || []).find(player => player.id === id) || null;
    }

    function enqueueScenes(scenes) {
        if (!scenes.length) return;
        sceneQueue.push(...scenes);
        void playSceneQueue();
    }

    async function playSceneQueue() {
        if (scenePlaying) return;
        scenePlaying = true;
        root.classList.add('is-scene-active');
        while (sceneQueue.length) {
            const scene = sceneQueue.shift();
            const token = ++sceneToken;
            if (scene.type === 'influence') await playInfluenceScene(scene, token);
            if (scene.type === 'elimination') await playEliminationScene(scene, token);
            if (scene.type === 'victory') await playVictoryScene(scene, token);
            if (token === sceneToken) hideScene();
        }
        scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    async function playInfluenceScene(scene, token) {
        const role = scene.reveal.role;
        showScene('influence', `<span class="cp-scene-kicker">影响力揭示</span>${renderSceneRole(role)}<h2>${esc(scene.player?.name || '玩家')}失去一张影响力</h2><p>${esc(revealReason(scene.reveal.reason))}</p>`);
        requestAnimationFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1050, token);
    }

    async function playEliminationScene(scene, token) {
        const roles = scene.reveal.roles?.length ? scene.reveal.roles : [scene.reveal.role];
        showScene('elimination', `<span class="cp-scene-kicker">议会除名</span><div class="cp-scene-role-row">${roles.map(renderSceneRole).join('')}</div><h2>${esc(scene.player?.name || '玩家')}出局</h2><p>两张影响力均已公开，离开本局权力斗争。</p>${scene.winner ? `<div class="cp-scene-victory"><span>最终掌权者</span><strong>${esc(scene.winner.name)}</strong></div>` : ''}`);
        requestAnimationFrame(() => $('sceneLayer').classList.add('is-revealed'));
        if (!await sceneDelay(1050, token)) return;
        if (scene.winner) {
            $('sceneLayer').classList.add('is-decided');
            await sceneDelay(1150, token);
        } else {
            await sceneDelay(300, token);
        }
    }

    async function playVictoryScene(scene, token) {
        showScene('victory', `<span class="cp-scene-kicker">最终裁决</span><div class="cp-victory-seal" aria-hidden="true">政</div><h2>${esc(scene.winner?.name || '无人')}掌控了城邦</h2><p>最后仍保有影响力的玩家获得胜利。</p>`);
        requestAnimationFrame(() => $('sceneLayer').classList.add('is-revealed'));
        await sceneDelay(1500, token);
    }

    function renderSceneRole(role) {
        if (!ROLE_ART[role]) return '<div class="cp-scene-role is-unknown"><b>?</b></div>';
        return `<div class="cp-scene-role is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${esc(ROLE_NAMES[role])}牌面"><strong>${esc(ROLE_NAMES[role])}</strong></div>`;
    }

    function revealReason(reason) {
        if (reason === 'coup') return '政变迫使其公开一张影响力。';
        if (reason === 'assassination') return '暗杀结算，必须失去一张影响力。';
        if (reason === 'challenge_failed') return '质疑失败，质疑者承担代价。';
        if (reason === 'challenge_success') return '角色声明未能得到证明。';
        if (reason === 'left') return '玩家离开了本局。';
        return '一张隐藏影响力已经公开。';
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

    function skipScene() {
        if (!scenePlaying) return;
        sceneToken++;
        for (const waiter of sceneWaiters) {
            clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        sceneWaiters.clear();
        hideScene();
    }

    function sceneDelay(duration, token) {
        const wait = reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                resolve(value) {
                    sceneWaiters.delete(waiter);
                    resolve(value);
                },
            };
            waiter.timer = window.setTimeout(() => waiter.resolve(token === sceneToken), wait);
            sceneWaiters.add(waiter);
        });
    }

    function render() {
        if (!state) return;
        const self = getSelf();
        const myTurn = isMyTurn();
        const alive = (state.players || []).filter(player => player.isAlive !== false).length;
        const turnName = getPlayer(state.currentTurn)?.name || '其他玩家';
        const phase = getPhaseLabel();

        root.classList.toggle('is-my-turn', myTurn);
        root.classList.toggle('is-decision', Boolean(state.challenge?.isMyTurn || state.influenceLoss?.isMyTurn || state.exchange?.isMyTurn));
        root.classList.toggle('is-challenge-decision', Boolean(state.challenge?.isMyTurn));
        root.classList.toggle('is-influence-decision', Boolean(state.influenceLoss?.isMyTurn));
        root.classList.toggle('is-exchange-decision', Boolean(state.exchange?.isMyTurn));
        $('turn').textContent = getTurnStatus(myTurn, turnName);
        $('phase').textContent = phase.long;
        $('phaseShort').textContent = phase.short;
        $('alive').textContent = String(alive);

        renderPlayers();
        renderEvent();
        renderChallenge();
        renderTimeline();
        renderCommand(self, myTurn);
        renderExchangeOverlay();
        renderEndOverlay();
        scheduleActionPresentation();
    }

    function renderPlayers() {
        const opponents = (state.players || []).filter(player => player.id !== state.myId);
        $('players').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('players').innerHTML = opponents.map(player => {
            const interaction = state.interaction;
            const targetable = Boolean(pendingAction && player.isAlive !== false);
            const selected = selectedTarget === player.id;
            const isSource = interaction?.actorId === player.id;
            const isTarget = interaction?.targetId === player.id;
            const isChallenger = interaction?.challengerId === player.id;
            const isBlocker = interaction?.blockerId === player.id;
            const tag = targetable ? 'button' : 'article';
            const attrs = `data-player-id="${esc(player.id)}"${targetable ? ` type="button" data-target-player="${esc(player.id)}" aria-pressed="${selected}"` : ''}`;
            const influences = player.influences || [];
            const influenceCount = player.influenceCount ?? influences.filter(card => !card.revealed).length;
            const status = player.isAlive === false
                ? '已出局'
                : player.id === state.currentTurn ? '正在行动' : `${influenceCount} 张影响力`;

            return `<${tag} class="cp-seat ${player.isAlive === false ? 'is-out' : ''} ${player.id === state.currentTurn ? 'is-turn' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isSource ? 'is-action-source' : ''} ${isTarget ? 'is-action-target' : ''} ${isChallenger ? 'is-challenger' : ''} ${isBlocker ? 'is-blocker' : ''}" ${attrs}>
                <span class="cp-avatar" aria-hidden="true">${esc(firstCharacter(player.name))}</span>
                <span class="cp-seat-copy"><strong>${esc(player.name)}</strong><small>${esc(status)}</small><span class="cp-seat-coins"><i></i><b>${player.coins ?? 0}</b> 金币</span></span>
                <span class="cp-seat-cards">${influences.map(card => renderInfluence(card, { mini: true })).join('')}</span>
                ${targetable ? '<em class="cp-target-hint">选择目标</em>' : ''}
            </${tag}>`;
        }).join('') || '<div class="cp-empty">等待其他玩家加入议会</div>';
    }

    function renderInfluence(card, options = {}) {
        const role = card?.role || null;
        const revealed = card?.revealed === true;
        const face = Boolean(role && ROLE_ART[role]);
        const selectable = Number.isInteger(options.lossIndex) || Number.isInteger(options.exchangeIndex);
        const tag = selectable ? 'button' : 'article';
        const label = face ? `${ROLE_NAMES[role]}，${ROLE_EFFECTS[role]}` : '隐藏的影响力牌';
        const attrs = Number.isInteger(options.lossIndex)
            ? `type="button" data-loss-index="${options.lossIndex}"`
            : Number.isInteger(options.exchangeIndex)
                ? `type="button" data-exchange-index="${options.exchangeIndex}" aria-pressed="${Boolean(options.selected)}"`
                : '';

        return `<${tag} class="cp-influence ${options.mini ? 'is-mini' : ''} ${options.exchange ? 'is-exchange' : ''} ${face ? `is-face is-role-${role}` : 'is-hidden'} ${revealed ? 'is-lost' : ''} ${selectable ? 'is-selectable' : ''} ${options.selected ? 'is-selected' : ''}" ${attrs} aria-label="${esc(label)}">
            ${Number.isInteger(options.slotIndex) ? `<b class="cp-slot-number">${options.slotIndex + 1}</b>` : ''}
            ${options.source ? `<span class="cp-source-label">${esc(options.source)}</span>` : ''}
            ${face ? `<img class="cp-card-art" src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${esc(`${ROLE_NAMES[role]}牌面`)}">` : `<span class="cp-card-back-art" aria-hidden="true"><img src="/assets/bgg/coup/${CARD_BACK_ART}.jpg" alt=""></span>`}
            ${!options.mini && face ? `<span class="cp-card-copy"><i>${ROLE_MARKS[role]}</i><strong>${ROLE_NAMES[role]}</strong><small>${ROLE_EFFECTS[role]}</small></span>` : ''}
            ${revealed ? '<b class="cp-lost-stamp">已揭示</b>' : ''}
        </${tag}>`;
    }

    function renderEvent() {
        $('event').classList.remove('is-public-action');
        const latest = state.actionLog?.[state.actionLog.length - 1];
        let label = '当前局势';
        let title = latest || '等待第一项行动';
        let detail = isMyTurn() ? '选择一项行动，或声称你需要的角色。' : '观察金币、影响力与每一次角色声明。';
        let role = null;
        let sigil = '政';

        if (pendingAction) {
            const action = getAction(pendingAction.kind);
            label = '选择目标';
            title = `为${action?.name || '行动'}指定一名玩家`;
            detail = selectedTarget ? `已选择 ${getPlayer(selectedTarget)?.name || '目标玩家'}，确认后才会提交行动。` : '从上方议会席位中选择一名仍在场的玩家。';
            role = action?.role || null;
            sigil = action?.icon || '!';
        } else if (state.gameOver) {
            const winner = getPlayer(state.winner)?.name || '无人';
            label = '最终裁决';
            title = `${winner} 掌控了城邦`;
            detail = '最后仍保有影响力的玩家赢得本局。';
            sigil = '冠';
        } else if (state.interaction) {
            $('event').classList.add('is-public-action');
            $('event').innerHTML = renderPublicInteraction(state.interaction, latest);
            return;
        } else if (state.forceCoup) {
            label = '强制政变';
            title = '你拥有至少 10 枚金币';
            detail = '本回合只能支付 7 枚金币发动政变。';
            sigil = '!';
        }

        const visual = role
            ? `<span class="cp-event-card is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${ROLE_NAMES[role]}牌面"></span>`
            : `<div class="cp-event-sigil">${esc(sigil)}</div>`;
        $('event').innerHTML = `${visual}<div class="cp-event-copy"><span>${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
    }

    function renderPublicInteraction(interaction, latest) {
        const action = getAction(interaction.kind);
        const actor = getPlayer(interaction.actorId)?.name || '玩家';
        const target = interaction.targetId ? getPlayer(interaction.targetId)?.name || '目标玩家' : '';
        const role = interaction.claimedRole;
        const actionName = action?.name || getActionName(interaction.kind);
        const stageCopy = interactionStageCopy(interaction, actor, target, actionName, latest);
        const mainCard = role && ROLE_ART[role]
            ? `<span class="cp-event-card cp-declaration-card is-role-${role}" data-role="declaredCard" data-actor-id="${esc(interaction.actorId)}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${esc(ROLE_NAMES[role])}声明牌"><b>声明</b></span>`
            : `<span class="cp-action-token ${interaction.kind === 'coup' ? 'is-coup' : ''}" data-role="declaredCard" data-actor-id="${esc(interaction.actorId)}"><i>${esc(action?.icon || '政')}</i><b>${esc(actionName)}</b></span>`;
        const blockCard = interaction.blockerId && interaction.blockRole ? renderBlockDeclaration(interaction.blockRole) : '';
        const challenger = interaction.challengerId ? getPlayer(interaction.challengerId)?.name || '玩家' : '';
        const relation = target ? `${actor}<i>→</i><strong>${target}</strong>` : `${actor}<i>→</i><strong>中央议会</strong>`;
        return `<div class="cp-public-interaction" data-interaction-id="${Number(interaction.actionId) || 0}">
            <div class="cp-interaction-route"><span>${relation}</span>${challenger ? `<em>${esc(challenger)}提出质疑</em>` : ''}</div>
            <div class="cp-claim-stack">${mainCard}${blockCard}</div>
            <div class="cp-event-copy"><span>${esc(stageCopy.label)}</span><strong>${esc(stageCopy.title)}</strong><p>${esc(stageCopy.detail)}</p><small>${esc(stageCopy.status)}</small></div>
        </div>`;
    }

    function renderBlockDeclaration(role) {
        if (role === 'captain_or_ambassador') {
            return `<span class="cp-block-card is-dual"><span><img src="/assets/bgg/coup/${ROLE_ART.captain}.jpg" alt="船长"><img src="/assets/bgg/coup/${ROLE_ART.ambassador}.jpg" alt="大使"></span><b>阻挡声明</b></span>`;
        }
        if (!ROLE_ART[role]) return '';
        return `<span class="cp-block-card is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${esc(ROLE_NAMES[role])}阻挡声明"><b>阻挡声明</b></span>`;
    }

    function interactionStageCopy(interaction, actor, target, actionName, latest) {
        const blocker = interaction.blockerId ? getPlayer(interaction.blockerId)?.name || '玩家' : '';
        const challenger = interaction.challengerId ? getPlayer(interaction.challengerId)?.name || '玩家' : '';
        const lossPlayer = interaction.lossPlayerId ? getPlayer(interaction.lossPlayerId)?.name || '玩家' : '';
        const blockDecider = getPlayer(state.challenge?.currentBlockerId)?.name || target || '下一位玩家';
        if (interaction.stage === 'challenge') return { label: '公开声明', title: `${actor}声称${ROLE_NAMES[interaction.claimedRole] || actionName}`, detail: target ? `准备对${target}执行${actionName}。` : `准备执行${actionName}。`, status: '等待议会决定是否质疑' };
        if (interaction.stage === 'challenged') {
            const claimant = blocker || actor;
            return { label: '质疑成立', title: `${challenger}质疑${claimant}的声明`, detail: `${claimant}必须出示对应角色，或承认声明失败。`, status: '身份裁决即将发生' };
        }
        if (interaction.stage === 'block_offer') return { label: '反制窗口', title: `${blockDecider}可以阻挡${actionName}`, detail: `可声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}进行阻挡。`, status: '原行动仍在中央等待结算' };
        if (interaction.stage === 'block_challenge') return { label: '阻挡声明', title: `${blocker}声称${ROLE_NAMES[interaction.blockRole] || '对应角色'}阻挡`, detail: `${actor}的${actionName}暂时停止。`, status: '阻挡声明同样可以被质疑' };
        if (interaction.stage === 'influence_loss') {
            const provedBy = interaction.provedById ? getPlayer(interaction.provedById)?.name || '玩家' : '';
            const failedBy = interaction.failedById ? getPlayer(interaction.failedById)?.name || '玩家' : '';
            const provedRole = ROLE_NAMES[interaction.provedRole || interaction.blockRole || interaction.claimedRole] || '对应角色';
            if (interaction.verdict === 'claim_proved' || interaction.verdict === 'block_proved') {
                return { label: '身份已证明', title: `${provedBy}证明了${provedRole}`, detail: `${lossPlayer}质疑失败，必须揭示一张影响力。`, status: '等待本人选择后才继续' };
            }
            if (interaction.verdict === 'claim_failed' || interaction.verdict === 'block_failed') {
                return { label: '声明被拆穿', title: `${failedBy}未能证明角色`, detail: `${lossPlayer}必须揭示一张影响力，原声明将按裁决处理。`, status: '等待本人选择后才继续' };
            }
            return { label: '裁决结果', title: `${lossPlayer}必须揭示一张影响力`, detail: revealReason(interaction.lossReason), status: '等待本人选择后才继续' };
        }
        if (interaction.stage === 'exchange') return { label: '声明通过', title: `${actor}正在秘密交换影响力`, detail: '交换结果不会向其他玩家公开。', status: '等待大使完成选择' };
        if (interaction.stage === 'cancelled') return { label: '声明失败', title: `${actor}的${actionName}被取消`, detail: latest || '行动未能通过质疑。', status: '本次行动已经结束' };
        if (interaction.outcome === 'blocked') return { label: '阻挡成立', title: `${blocker}阻止了${actionName}`, detail: latest || '原行动没有生效。', status: '本次交锋已经结算' };
        return { label: interaction.claimedRole ? '声明通过' : '公开行动', title: `${actor}完成${actionName}`, detail: latest || `${actionName}已经结算。`, status: '行动结果已写入局势记录' };
    }

    function renderChallenge() {
        const challenge = state.challenge;
        if (!challenge) {
            $('challenge').innerHTML = '';
            return;
        }

        const role = ROLE_NAMES[challenge.claimedRole] || challenge.claimedRole || '对应角色';
        const actionName = getActionName(challenge.actionKind);
        let title = '';
        let detail = '';
        let buttons = '';
        const ready = decisionReady();
        const waitLabel = ready ? '' : '<span class="cp-reaction-wait">声明送达中</span>';

        if (challenge.phase === 'block') {
            const decider = getPlayer(challenge.currentBlockerId)?.name || '玩家';
            title = challenge.isMyTurn ? `是否阻挡这次${actionName}？` : `等待 ${decider} 决定是否阻挡`;
            detail = `阻挡意味着你声称自己拥有${role}，这项声明仍可被质疑。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="block" type="button" ${ready ? '' : 'disabled'}>用${esc(role)}阻挡</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>放行</button>`;
        } else if (challenge.phase === 'challenge') {
            const claimant = getPlayer(challenge.responderId)?.name || '玩家';
            const decider = getPlayer(challenge.currentChallengerId)?.name || '玩家';
            title = challenge.isMyTurn ? `是否质疑 ${claimant}？` : `等待 ${decider} 回应声明`;
            detail = `${claimant} 声称${role}来执行${actionName}；错误的一方将失去一张影响力。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-danger" data-challenge="challenge" type="button" ${ready ? '' : 'disabled'}>质疑${esc(role)}</button><button class="cp-secondary" data-challenge="pass" type="button" ${ready ? '' : 'disabled'}>接受声明</button>`;
        } else {
            const claimant = getPlayer(challenge.responderId)?.name || '玩家';
            title = challenge.isMyTurn ? '你的身份受到质疑' : `等待 ${claimant} 回应质疑`;
            detail = `若你确有${role}，出示后会洗回牌库并补抽；否则必须取消声明。`;
            if (challenge.isMyTurn) buttons = `${waitLabel}<button class="cp-primary" data-challenge="show" type="button" ${ready ? '' : 'disabled'}>出示${esc(role)}</button><button class="cp-danger" data-challenge="cancel" type="button" ${ready ? '' : 'disabled'}>承认失败</button>`;
        }

        $('challenge').innerHTML = `<div class="cp-decision-copy"><span>${challengeLabel(challenge.phase)}</span><strong>${esc(title)}</strong><small>${esc(detail)}</small></div><div class="cp-decision-actions">${buttons || '<span class="cp-wait">决策进行中</span>'}</div>`;
    }

    function scheduleActionPresentation() {
        cancelAnimationFrame(actionLayoutFrame);
        layoutActionPresentation();
        actionLayoutFrame = requestAnimationFrame(layoutActionPresentation);
    }

    function layoutActionPresentation() {
        const interaction = state?.interaction;
        const card = $('declaredCard');
        if (card && interaction?.actionId === animateInteractionId) {
            const source = playerAnchor(interaction.actorId);
            const cardRect = card.getBoundingClientRect();
            const sourceRect = source?.getBoundingClientRect();
            const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
            const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight;
            card.style.setProperty('--cp-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`);
            card.style.setProperty('--cp-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`);
            void card.offsetWidth;
            card.classList.add('is-entering');
            animateInteractionId = null;
        }
        updateActionLinks();
    }

    function updateActionLinks() {
        const svg = $('actionLinks');
        const interaction = state?.interaction;
        if (!interaction || state.gameOver) {
            svg.classList.remove('has-action', 'has-response');
            centeredInteractionId = null;
            return;
        }

        const actionSource = playerAnchor(interaction.actorId);
        const actionTarget = interaction.targetId ? playerAnchor(interaction.targetId) : null;
        if (actionSource && actionTarget) {
            centerSeatIfNeeded(actionTarget, interaction.actionId);
            drawLink(actionSource, actionTarget, 'action');
            svg.classList.add('has-action');
        } else {
            svg.classList.remove('has-action');
        }

        const responseSourceId = interaction.challengerId || interaction.blockerId;
        const responseTargetId = interaction.challengerId ? (interaction.blockerId || interaction.actorId) : interaction.actorId;
        const responseSource = responseSourceId ? playerAnchor(responseSourceId) : null;
        const responseTarget = responseTargetId ? playerAnchor(responseTargetId) : null;
        if (responseSource && responseTarget) {
            drawLink(responseSource, responseTarget, 'response');
            svg.classList.add('has-response');
        } else {
            svg.classList.remove('has-response');
        }
    }

    function centerSeatIfNeeded(target, actionId) {
        const scroller = target.closest('[data-role="players"]');
        if (!scroller || centeredInteractionId === actionId) return;
        const desired = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
        scroller.scrollTo({ left: Math.max(0, desired), behavior: reducedMotion ? 'auto' : 'smooth' });
        centeredInteractionId = actionId;
        clearTimeout(actionSettleTimer);
        actionSettleTimer = window.setTimeout(scheduleActionPresentation, reducedMotion ? 0 : 280);
    }

    function drawLink(source, target, kind) {
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = window.innerWidth;
        const height = window.innerHeight;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, width - 12);
        const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, height - 12);
        const targetX = clamp(targetRect.left + targetRect.width / 2, 12, width - 12);
        const targetY = clamp(targetRect.top + targetRect.height / 2, 12, height - 12);
        const bend = kind === 'response' ? 1 : -1;
        const middleX = (sourceX + targetX) / 2 + bend * Math.min(58, Math.abs(targetY - sourceY) * .08);
        const middleY = (sourceY + targetY) / 2 + bend * Math.min(66, Math.max(22, Math.abs(targetX - sourceX) * .1));
        const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`;
        $('actionLinks').setAttribute('viewBox', `0 0 ${width} ${height}`);
        $(`${kind}LinkGlow`).setAttribute('d', path);
        $(`${kind}LinkStroke`).setAttribute('d', path);
        $(`${kind}LinkSeal`).setAttribute('cx', String(targetX));
        $(`${kind}LinkSeal`).setAttribute('cy', String(targetY));
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function renderTimeline() {
        const entries = (state.actionLog || []).slice(-7).reverse();
        $('timeline').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="cp-timeline-entry"><i class="${index === 0 ? 'is-latest' : ''}"></i><span>${esc(entry)}</span></div>`).join('')
            : '<span class="cp-muted">行动后将在这里留下公开记录</span>';
    }

    function renderCommand(self, myTurn) {
        if (!self) {
            $('command').innerHTML = '<div class="cp-command-message">等待玩家数据</div>';
            return;
        }

        const influences = self.influences || [];
        if (state.gameOver) {
            $('command').innerHTML = `<div class="cp-ended-command"><span>本局结束</span><strong>${esc(getPlayer(state.winner)?.name || '无人')} 赢得政变</strong><small>完整结果已在终局裁决中封存。</small></div>`;
            return;
        }

        if (state.exchange?.isMyTurn) {
            $('command').innerHTML = '<div class="cp-ended-command"><span>大使交换</span><strong>私密选牌窗口已打开</strong><small>从原有影响力与新抽牌中选择要保留的牌。</small></div>';
            return;
        }

        if (state.influenceLoss?.isMyTurn) {
            const ready = decisionReady();
            $('command').innerHTML = `<div class="cp-loss-panel ${state.interaction?.targetId === state.myId ? 'is-action-target' : ''}" data-player-id="${esc(state.myId)}"><div class="cp-loss-copy"><span>失去影响力</span><strong>${ready ? '选择一张牌永久揭示' : '先查看中央裁决'}</strong><small>${ready ? '已揭示的角色会公开留在你的席位上；两张均揭示后出局。' : '裁决展示结束后即可选择，牌效不能被拒绝。'}</small></div><div class="cp-loss-cards ${ready ? '' : 'is-waiting'}">${influences.map((card, index) => renderInfluence(card, { lossIndex: card.revealed || !ready ? null : index, slotIndex: index })).join('')}</div></div>`;
            return;
        }

        const target = selectedTarget ? getPlayer(selectedTarget) : null;
        const action = pendingAction ? getAction(pendingAction.kind) : null;
        const actionContent = pendingAction
            ? `<div class="cp-target-panel"><div class="cp-target-action">${renderActionVisual(action)}<span><small>准备发动</small><strong>${esc(action?.name || '行动')}</strong></span></div><div class="cp-target-choice"><span>${target ? `目标：${esc(target.name)}` : '请从上方议会席位选择目标'}</span><div><button class="cp-secondary" data-action="cancel-target" type="button">取消</button><button class="cp-primary" data-action="confirm-target" type="button" ${target ? '' : 'disabled'}>确认${esc(action?.name || '行动')}</button></div></div></div>`
            : `<div class="cp-action-groups">${ACTION_GROUPS.map(group => `<section class="cp-action-group is-${group.id}"><span>${group.name}</span><div>${ACTIONS.filter(actionItem => actionItem.group === group.id).map(actionItem => renderActionButton(actionItem, self, myTurn)).join('')}</div></section>`).join('')}</div>`;

        const activeCount = influences.filter(card => !card.revealed).length;
        const status = self.isAlive === false ? '你已出局，可继续旁观' : myTurn ? '你的回合' : `等待 ${getPlayer(state.currentTurn)?.name || '其他玩家'}`;
        $('command').innerHTML = `<div class="cp-command-inner">
            <section class="cp-private ${state.interaction?.actorId === state.myId ? 'is-action-source' : ''} ${state.interaction?.targetId === state.myId ? 'is-action-target' : ''} ${state.interaction?.challengerId === state.myId ? 'is-challenger' : ''} ${state.interaction?.blockerId === state.myId ? 'is-blocker' : ''}" data-player-id="${esc(state.myId)}"><header><div><span>你的影响力</span><strong>${esc(self.name || '我')}</strong><small>${esc(status)} · ${activeCount} 张仍生效</small></div><div class="cp-wallet"><i></i><b>${self.coins ?? 0}</b><span>金币</span></div></header><div class="cp-self-cards">${influences.map((card, index) => renderInfluence(card, { slotIndex: index })).join('')}</div></section>
            <section class="cp-action-console"><header><div><span>行动台</span><strong>${myTurn ? '选择本回合行动' : '查看可用行动'}</strong></div>${state.forceCoup ? '<em>必须政变</em>' : ''}</header>${actionContent}</section>
        </div>`;
    }

    function renderActionButton(action, self, myTurn) {
        let disabled = !myTurn || state.gameOver || state.challenge || state.influenceLoss || state.exchange || self.isAlive === false;
        let reason = action.desc;
        if (!disabled && state.forceCoup && action.id !== 'coup') {
            disabled = true;
            reason = '拥有 10 枚或更多金币时必须发动政变';
        }
        if (!disabled && action.needCoins && (self.coins || 0) < action.needCoins) {
            disabled = true;
            reason = `需要 ${action.needCoins} 枚金币`;
        }

        return `<button class="cp-action ${action.id === 'coup' ? 'is-coup' : ''}" data-action-kind="${action.id}" type="button" title="${esc(reason)}" ${disabled ? 'disabled' : ''}>${renderActionVisual(action)}<span><b>${action.name}</b><small>${action.needCoins ? `${action.needCoins} 金币 · ` : ''}${action.desc}</small></span></button>`;
    }

    function renderActionVisual(action) {
        if (action?.role && ROLE_ART[action.role]) return `<span class="cp-action-portrait is-role-${action.role}"><img src="/assets/bgg/coup/${ROLE_ART[action.role]}.jpg" alt=""></span>`;
        return `<i class="cp-action-symbol">${esc(action?.icon || '?')}</i>`;
    }

    function renderExchangeOverlay() {
        const overlay = $('exchangeOverlay');
        const dialog = $('exchangeDialog');

        if (state.exchange?.isMyTurn) {
            exchangeMode = 'select';
            exchangeOpen = true;
            const options = state.exchange.options || [];
            const keepCount = state.exchange.keepCount || 0;
            dialog.innerHTML = `<span class="cp-dialog-label">大使 · 私密交换</span><h2 id="cp-exchange-title">选择要保留的影响力</h2><p>从原有手牌和新抽到的牌中保留 <strong>${keepCount}</strong> 张，其余牌会洗回宫廷牌库。</p><div class="cp-exchange-options">${options.map((card, index) => {
                const optionIndex = Number.isInteger(card.index) ? card.index : index;
                const source = card.source === 'drawn' ? '新抽牌' : '原有影响力';
                return renderInfluence(card, { exchange: true, exchangeIndex: optionIndex, selected: exchangeKeep.includes(optionIndex), source });
            }).join('')}</div><div class="cp-exchange-footer"><span>已选择 <b>${exchangeKeep.length}</b> / ${keepCount}</span><button class="cp-primary" data-action="confirm-exchange-select" type="button" ${exchangeKeep.length === keepCount ? '' : 'disabled'}>确认交换结果</button></div>`;
            setOverlay(overlay, true);
            return;
        }

        if (exchangeMode === 'confirm' && exchangeOpen && !state.gameOver) {
            dialog.innerHTML = `<button class="cp-dialog-close" data-action="cancel-exchange" type="button" aria-label="关闭交换确认">x</button><span class="cp-dialog-label">大使声明</span><h2 id="cp-exchange-title">声称大使并交换？</h2><p>其他玩家可以质疑这项声明。若声明通过，你会从原有影响力与两张新牌中秘密选择保留牌。</p><div class="cp-dialog-actions"><button class="cp-secondary" data-action="cancel-exchange" type="button">取消</button><button class="cp-primary" data-action="confirm-exchange" type="button">确认声明</button></div>`;
            setOverlay(overlay, true);
            return;
        }

        setOverlay(overlay, false);
    }

    function renderEndOverlay() {
        const overlay = $('endOverlay');
        const dialog = $('endDialog');
        if (!state.gameOver) {
            setOverlay(overlay, false);
            return;
        }

        const winner = getPlayer(state.winner)?.name || '无人';
        const recent = (state.actionLog || []).slice(-5).reverse().map(entry => `<li>${esc(entry)}</li>`).join('');
        dialog.innerHTML = `<span class="cp-dialog-label">最终裁决</span><h2 id="cp-end-title">${esc(winner)} 掌控了城邦</h2><p>本局已经结束，所有角色与最后几项行动会留在当前房间供玩家复盘。</p><ol class="cp-end-log">${recent || '<li>没有额外终局记录</li>'}</ol><p class="cp-dialog-note">可使用顶部统一导航返回大厅</p>`;
        setOverlay(overlay, true);
    }

    function handleAction(kind) {
        if (kind === 'exchange') {
            exchangeMode = 'confirm';
            exchangeOpen = true;
            renderExchangeOverlay();
            return;
        }

        const action = getAction(kind);
        if (action?.needsTarget) {
            pendingAction = { kind };
            selectedTarget = null;
            render();
            return;
        }
        lobbySend({ type: 'gameAction', action: { kind } });
    }

    function selectTarget(id) {
        if (!pendingAction) return;
        selectedTarget = id;
        render();
    }

    function confirmTarget() {
        if (!pendingAction || !selectedTarget) return;
        lobbySend({ type: 'gameAction', action: { kind: pendingAction.kind, targetId: selectedTarget } });
        pendingAction = null;
        selectedTarget = null;
        render();
    }

    function getSelf() {
        const publicSelf = getPlayer(state?.myId);
        if (!publicSelf && !state?.self) return null;
        return {
            ...(publicSelf || {}),
            ...(state.self || {}),
            name: publicSelf?.name || '我',
            isAlive: publicSelf?.isAlive ?? true,
            influences: publicSelf?.influences?.length ? publicSelf.influences : (state.self?.influences || []),
        };
    }

    function getPhaseLabel() {
        if (state.gameOver) return { short: '终局', long: '本局已经结束' };
        if (state.exchange) return { short: '交换', long: '大使正在交换影响力' };
        if (state.influenceLoss) return { short: '揭示', long: '等待失去一张影响力' };
        if (state.challenge) return { short: challengeLabel(state.challenge.phase), long: state.challenge.isMyTurn ? '现在需要你作出决定' : '等待玩家作出决定' };
        if (isMyTurn()) return { short: '行动', long: '从七种行动中选择一项' };
        return { short: '等待', long: '观察其他玩家的行动' };
    }

    function getTurnStatus(myTurn, turnName) {
        if (state.gameOver) return `${getPlayer(state.winner)?.name || '无人'} 获胜`;
        if (state.exchange?.isMyTurn) return '请选择要保留的影响力';
        if (state.influenceLoss?.isMyTurn) return '请选择要揭示的影响力';
        if (state.challenge?.isMyTurn) {
            if (state.challenge.phase === 'block') return '请决定是否阻挡';
            if (state.challenge.phase === 'challenge') return '请决定是否质疑';
            return '请回应对方的质疑';
        }
        return myTurn ? '轮到你采取行动' : `轮到 ${turnName}`;
    }

    function setOverlay(overlay, open) {
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
    }

    function isMyTurn() {
        return Boolean(state && state.currentTurn === state.myId && !state.gameOver);
    }

    function getPlayer(id) {
        return (state?.players || []).find(player => player.id === id) || null;
    }

    function getAction(kind) {
        const normalized = String(kind || '').replace(/^block_/, '');
        return ACTIONS.find(action => action.id === normalized) || null;
    }

    function getActionName(kind) {
        return getAction(kind)?.name || '行动';
    }

    function challengeLabel(phase) {
        if (phase === 'block') return '阻挡';
        if (phase === 'challenge') return '质疑';
        return '回应';
    }

    function firstCharacter(value) {
        return Array.from(String(value || '玩'))[0] || '玩';
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    mount.addEventListener('click', event => {
        if (scenePlaying) {
            const sceneAction = event.target.closest('[data-action="skip-scene"]');
            event.preventDefault();
            return sceneAction ? skipScene() : undefined;
        }
        const exchangeCard = event.target.closest('[data-exchange-index]');
        if (exchangeCard && state?.exchange?.isMyTurn) {
            const index = Number(exchangeCard.dataset.exchangeIndex);
            const keepCount = state.exchange.keepCount || 0;
            if (exchangeKeep.includes(index)) exchangeKeep = exchangeKeep.filter(item => item !== index);
            else if (exchangeKeep.length < keepCount) exchangeKeep = [...exchangeKeep, index];
            render();
            return;
        }

        const target = event.target.closest('[data-target-player]');
        if (target) {
            selectTarget(target.dataset.targetPlayer);
            return;
        }

        const actionButton = event.target.closest('[data-action-kind]');
        if (actionButton) {
            handleAction(actionButton.dataset.actionKind);
            return;
        }

        const challenge = event.target.closest('[data-challenge]');
        if (challenge) {
            if (!decisionReady()) return;
            lobbySend({ type: 'gameAction', action: { kind: challenge.dataset.challenge } });
            return;
        }

        const loss = event.target.closest('[data-loss-index]');
        if (loss) {
            if (!decisionReady()) return;
            lobbySend({ type: 'gameAction', action: { kind: 'influence_loss', influenceIndex: Number(loss.dataset.lossIndex) } });
            return;
        }

        const button = event.target.closest('[data-action]');
        if (!button) {
            if (event.target === $('rolesOverlay')) setOverlay($('rolesOverlay'), false);
            return;
        }

        switch (button.dataset.action) {
            case 'confirm-target':
                confirmTarget();
                break;
            case 'cancel-target':
                pendingAction = null;
                selectedTarget = null;
                render();
                break;
            case 'roles':
                setOverlay($('rolesOverlay'), true);
                break;
            case 'close-roles':
                setOverlay($('rolesOverlay'), false);
                break;
            case 'confirm-exchange':
                setOverlay($('exchangeOverlay'), false);
                exchangeOpen = false;
                exchangeMode = null;
                lobbySend({ type: 'gameAction', action: { kind: 'exchange' } });
                break;
            case 'confirm-exchange-select':
                if (state.exchange?.isMyTurn && exchangeKeep.length === state.exchange.keepCount) {
                    lobbySend({ type: 'gameAction', action: { kind: 'exchangeSelect', keepIndices: exchangeKeep } });
                    exchangeKeep = [];
                }
                break;
            case 'cancel-exchange':
                setOverlay($('exchangeOverlay'), false);
                exchangeOpen = false;
                exchangeMode = null;
                break;
            default:
                break;
        }
    }, { signal: controller.signal });

    mount.addEventListener('keydown', event => {
        if (scenePlaying) {
            if (event.key === 'Escape') skipScene();
            return;
        }
        if (event.key !== 'Escape') return;
        setOverlay($('rolesOverlay'), false);
        if (!state?.exchange?.isMyTurn) {
            setOverlay($('exchangeOverlay'), false);
            exchangeOpen = false;
            exchangeMode = null;
        }
    }, { signal: controller.signal });
    window.addEventListener('resize', scheduleActionPresentation, { signal: controller.signal });
    mount.addEventListener('scroll', scheduleActionPresentation, { capture: true, signal: controller.signal });

    function addLog(message, type) {
        lobbyAddLog?.(message, type);
    }

    return {
        gameType: 'coup',
        handleMessage,
        destroy() {
            sceneQueue = [];
            skipScene();
            clearTimeout(actionSettleTimer);
            clearTimeout(decisionTimer);
            cancelAnimationFrame(actionLayoutFrame);
            controller.abort();
            document.body.classList.remove('is-coup-view');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
