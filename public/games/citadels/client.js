const ASSETS = {
    detail: '/assets/bgg/citadels/detail.jpg',
    roleBackReference: '/assets/bgg/citadels/reference-role-front-back.jpg',
};

const ROLE_META = {
    assassin: { rank: 1, name: '刺客', accent: 'rose', description: '宣布一个角色被暗杀，该角色本轮跳过行动。' },
    thief: { rank: 2, name: '盗贼', accent: 'amber', description: '指定一个未被暗杀的角色，角色揭示时取走其全部金币。' },
    magician: { rank: 3, name: '魔术师', accent: 'violet', description: '与一位玩家交换全部手牌，或弃掉任意数量再摸回等量牌。' },
    king: { rank: 4, name: '国王', accent: 'gold', color: 'yellow', description: '每座贵族城区提供金币收入，并在回合开始时获得皇冠。' },
    bishop: { rank: 5, name: '主教', accent: 'blue', color: 'blue', description: '每座宗教城区提供金币收入；主教在场时军阀不能攻击你的城市。' },
    merchant: { rank: 6, name: '商人', accent: 'green', color: 'green', description: '每座商业城区提供金币收入，完成资源行动后额外获得 1 金。' },
    architect: { rank: 7, name: '建筑师', accent: 'sand', description: '完成资源行动后额外摸 2 张牌，本回合最多建造 3 座城区。' },
    warlord: { rank: 8, name: '军阀', accent: 'red', color: 'red', description: '每座军事城区提供金币收入；结束建造阶段后可摧毁一座城区。' },
};

const ROLE_ACCENT_COLORS = {
    rose: '#c27d72', amber: '#c59d55', violet: '#9a7ab0', gold: '#d3aa5c',
    blue: '#77a8b5', green: '#7bad88', sand: '#c6a16e', red: '#cf7667',
};

const COLOR_META = {
    yellow: { name: '贵族', short: '贵族区', className: 'noble' },
    blue: { name: '宗教', short: '宗教区', className: 'religious' },
    green: { name: '商业', short: '商业区', className: 'trade' },
    red: { name: '军事', short: '军事区', className: 'military' },
    purple: { name: '独特', short: '独特区', className: 'unique' },
};

const EFFECT_NAMES = {
    hauntedCity: '计分时可视为任意颜色（终局轮建成除外）',
    keep: '军阀无法摧毁',
    imperialTreasury: '终局每枚金币 +1 分',
    mapRoom: '终局每张手牌 +1 分',
    laboratory: '每回合一次：弃 1 手牌换 1 金',
    observatory: '摸牌时摸 3 保留 1',
    smithy: '每回合一次：付 3 金摸 2 牌',
    graveyard: '城区被毁时可付 1 金回收',
    library: '摸牌时保留两张',
    schoolOfMagic: '收入计算时视为任意颜色',
    greatWall: '军阀摧毁需多付 1 金',
};

const DISTRICT_MARKS = {
    hauntedCity: '月',
    keep: '塔',
    imperialTreasury: '库',
    mapRoom: '图',
    laboratory: '药',
    observatory: '星',
    smithy: '锻',
    graveyard: '墓',
    library: '书',
    schoolOfMagic: '秘',
    greatWall: '墙',
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

function districtVariant(card) {
    const seed = String(card?.name || card?.id || '').split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return (seed % 4) + 1;
}

// Keep the role-art-${state.currentRoleRank} marker readable for component-art checks.

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/citadels/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-citadels-view');

    let state = null;
    let selectedCardIds = [];
    let pendingRoleId = null;
    let pendingRoleAction = null;
    let pendingBuildId = null;
    let pendingDecision = null;
    let swapMode = false;
    let rulesTrigger = null;
    let lastPresentationSequence = 0;
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    mount.innerHTML = `<section class="citadels-app" data-game-root>
        <header class="citadels-topbar">
            <div class="citadels-brand">
                <span class="citadels-brand-mark" aria-hidden="true"><i></i><i></i><i></i><b>♛</b></span>
                <div class="citadels-brand-copy">
                    <span class="citadels-eyebrow">阴谋与建筑之城</span>
                    <h1>富饶之城</h1>
                    <p>选角、建城、暗中操纵皇冠</p>
                </div>
            </div>
            <div class="citadels-top-stats" aria-label="牌局状态">
                <div class="citadels-stat"><span>轮次</span><strong data-role="round">—</strong></div>
                <div class="citadels-stat"><span>当前阶段</span><strong data-role="phase">等待开局</strong></div>
                <div class="citadels-stat citadels-current-stat"><span>呼叫角色</span><strong data-role="currentRole">等待选角</strong></div>
                <div class="citadels-stat"><span>皇冠</span><strong data-role="crown">—</strong></div>
            </div>
            <div class="citadels-header-actions">
                <button class="citadels-quiet-button" data-ui="rules" type="button">规则</button>
                <button class="citadels-leave-button" data-ui="leave" type="button">离开</button>
            </div>
        </header>

        <main class="citadels-shell">
            <section class="citadels-command" data-role="command" aria-live="polite">
                <div class="citadels-command-head">
                    <div>
                        <span class="citadels-kicker" data-role="commandKicker">牌局状态</span>
                        <h2 data-role="commandTitle">等待牌局状态</h2>
                        <p data-role="commandCopy">牌局开始后，当前操作会显示在这里。</p>
                    </div>
                    <div class="citadels-command-status" data-role="commandStatus"></div>
                </div>
                <div class="citadels-command-body" data-role="commandBody"></div>
                <div class="citadels-command-footer" data-role="commandFooter"></div>
            </section>

            <div class="citadels-workspace">
                <section class="citadels-stage">
                    <header class="citadels-section-heading">
                        <div><span class="citadels-kicker">城市名册</span><h2>城市总览</h2></div>
                        <div class="citadels-stage-summary" data-role="stageSummary"></div>
                    </header>
                    <div class="citadels-role-track" data-role="roleTrack" aria-label="本轮角色呼叫顺序"></div>
                    <div class="citadels-city-register" data-role="cities"></div>

                    <section class="citadels-hand-panel">
                        <header class="citadels-section-heading">
                            <div><span class="citadels-kicker">私密城区</span><h2>我的城区牌</h2></div>
                            <span class="citadels-section-meta" data-role="handNote">— 张 · 仅你可见</span>
                        </header>
                        <div class="citadels-hand" data-role="hand"></div>
                    </section>
                </section>

                <aside class="citadels-rail">
                    <section class="citadels-rail-panel citadels-ledger-panel">
                        <header class="citadels-section-heading"><div><span class="citadels-kicker">我的账本</span><h2>我的城邦</h2></div><span class="citadels-section-meta">私密</span></header>
                        <div class="citadels-ledger" data-role="ledger"></div>
                    </section>
                    <section class="citadels-rail-panel">
                        <header class="citadels-section-heading"><div><span class="citadels-kicker">宫廷席位</span><h2>玩家席位</h2></div><span class="citadels-section-meta">金币 / 城区</span></header>
                        <div class="citadels-players" data-role="players"></div>
                    </section>
                    <section class="citadels-rail-panel citadels-log-panel">
                        <header class="citadels-section-heading"><div><span class="citadels-kicker">城市纪事</span><h2>城中传闻</h2></div><span class="citadels-section-meta">最近动态</span></header>
                        <div class="citadels-log" data-role="log"></div>
                    </section>
                </aside>
            </div>
        </main>

        <footer class="citadels-footer"><span data-role="hint">等待牌局状态</span><span>富饶之城 · 基础版 · <b data-role="room">—</b></span></footer>

        <div class="citadels-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
            <svg class="citadels-action-line" aria-hidden="true"><path data-role="actionPath"></path></svg>
            <div class="citadels-presentation-stage" data-role="presentationStage" role="status" aria-live="assertive"></div>
            <button class="citadels-presentation-skip" data-action="skipPresentation" type="button">跳过演出</button>
        </div>

        <div class="citadels-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <article class="citadels-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="citadelsRulesTitle">
                <button class="citadels-dialog-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                <figure class="citadels-rules-art"><img src="${ASSETS.detail}" alt="富饶之城八张角色牌参考图" loading="lazy"><figcaption>八张基础角色牌 · 实体组件参考</figcaption></figure>
                <div class="citadels-rules-copy">
                    <span class="citadels-kicker">玩法说明 · 经典基础版</span>
                    <h2 id="citadelsRulesTitle">在皇冠与金币之间建成一座城市</h2>
                    <ol>
                        <li><b>秘密选角</b><span>从皇冠持有者开始，按顺序各选一个角色。2–3 人局每人控制两个角色。</span></li>
                        <li><b>按编号行动</b><span>角色 1 到 8 依次被呼叫；每回合先拿 2 金或摸牌，再建造城区并使用角色能力。</span></li>
                        <li><b>建立城市</b><span>城区不能与已有同名城区重复。建筑师最多建造 3 座，其他角色每回合最多 1 座。</span></li>
                        <li><b>触发终局</b><span>有人建成第 8 座城区后，完成当前轮并计分：城区分数、五色、首位建成和建成奖励。</span></li>
                        <li><b>记住军阀</b><span>军阀必须先结束建造阶段，之后才能支付城区费用减 1 摧毁目标城市。</span></li>
                    </ol>
                    <div class="citadels-rules-facts"><span><b>2–7</b>名玩家</span><span><b>8</b>个角色</span><span><b>67</b>张城区牌</span></div>
                </div>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = $('rulesOverlay');

    function playerById(id) {
        return (state?.players || []).find(player => player.id === id) || null;
    }

    function roleMeta(roleOrId) {
        const id = typeof roleOrId === 'string' ? roleOrId : roleOrId?.id;
        return ROLE_META[id] || { rank: roleOrId?.rank || '—', name: roleOrId?.name || id || '角色', accent: 'gold', description: '角色能力将在角色被呼叫时显示。' };
    }

    function colorMeta(color) {
        return COLOR_META[color] || { name: color || '城区', short: '城区', className: 'neutral' };
    }

    function currentRoleMeta() {
        if (!state?.currentRoleRank) return null;
        return Object.values(ROLE_META).find(role => role.rank === state.currentRoleRank) || null;
    }

    function actionButton(label, action, value = '', className = '', disabled = false) {
        return `<button class="citadels-button ${className}" data-action="${escapeHtml(action)}" data-value="${escapeHtml(value)}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
    }

    function decisionButton(label, kind, value = '', className = '', disabled = false) {
        return `<button class="citadels-button ${className}" data-action="prepareDecision" data-decision-kind="${escapeHtml(kind)}" data-value="${escapeHtml(value)}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
    }

    function decisionDetails(decision = pendingDecision) {
        if (!decision) return null;
        if (decision.kind === 'assassinate' || decision.kind === 'rob') {
            const role = roleMeta(decision.value);
            return { eyebrow: decision.kind === 'assassinate' ? '刺客密令' : '盗贼目标', title: `${role.rank} · ${role.name}`, copy: decision.kind === 'assassinate' ? '目标角色被呼叫时将本轮缺席；玩家身份现在不会揭示。' : '该角色亮明时，盗贼自动取走其持有者的全部金币。', danger: true };
        }
        if (decision.kind === 'magicianExchange') {
            const target = playerById(decision.value);
            const me = playerById(state.myId);
            return { eyebrow: '魔术师换手', title: `与 ${target?.name || '目标玩家'} 交换全部手牌`, copy: `你将交出 ${state.myHand?.length || 0} 张，并获得对方的 ${target?.handCount ?? '全部'} 张手牌。牌面不会向其他玩家公开。`, danger: false, me };
        }
        if (decision.kind === 'destroyDistrict') {
            const target = (state.destroyTargets || []).find(item => `${item.targetId}::${item.card?.id}` === decision.value);
            if (!target) return null;
            return { eyebrow: '军阀摧城令', title: `${target.targetName} · ${target.card.name}`, copy: `支付 ${target.cost} 金${target.greatWall ? '（已计入长城额外费用）' : ''}，执行后余额 ${(playerById(state.myId)?.gold || 0) - target.cost} 金。`, danger: true };
        }
        if (decision.kind === 'laboratory') {
            const card = (state.myHand || []).find(item => item.id === decision.value);
            if (!card) return null;
            return { eyebrow: '实验室弃牌', title: card.name, copy: '这张手牌将公开弃置，你获得 1 枚金币。', danger: false };
        }
        return null;
    }

    function decisionConfirmMarkup(decision = pendingDecision) {
        const details = decisionDetails(decision);
        if (!details) return '';
        return `<div class="citadels-decision-confirm ${details.danger ? 'is-danger' : ''}"><span><small>${escapeHtml(details.eyebrow)}</small><strong>${escapeHtml(details.title)}</strong><em>${escapeHtml(details.copy)}</em></span><div><button class="citadels-button is-muted" data-action="cancelDecision" type="button">取消</button><button class="citadels-button ${details.danger ? 'is-danger' : 'is-primary'}" data-action="confirmDecision" type="button">确认执行</button></div></div>`;
    }

    function roleArt(role, size = '') {
        const meta = roleMeta(role);
        return `<span class="citadels-role-art ${size ? `citadels-role-art-${size}` : ''} role-art-${meta.rank}" aria-hidden="true"><img src="${ASSETS.detail}" alt=""><span class="citadels-role-art-label"><b>${meta.rank}</b><strong>${escapeHtml(meta.name)}</strong></span></span>`;
    }

    function roleBack(size = '') {
        return `<span class="citadels-role-back ${size ? `citadels-role-back-${size}` : ''}" aria-hidden="true"><img src="${ASSETS.roleBackReference}" alt=""></span>`;
    }

    function districtBack(size = '') {
        return `<span class="citadels-district-back ${size ? `citadels-district-back-${size}` : ''}" aria-hidden="true"><i></i><b>C</b></span>`;
    }

    function roleDraftInfo(up) {
        const faceUp = up.length
            ? `<span class="citadels-draft-face-up"><small>明置</small>${up.map(item => `<span title="${item.rank} · ${escapeHtml(item.name)}">${roleArt(item, 'draft')}</span>`).join('')}</span>`
            : '';
        return `<div class="citadels-draft-track" aria-label="角色牌堆状态">
            <span class="citadels-draft-component"><span class="citadels-role-stack is-pile">${roleBack('draft')}</span><span><b>${state.roleDeckCount || 0}</b><small>张待选</small></span></span>
            <span class="citadels-draft-component"><span class="citadels-role-stack">${roleBack('draft')}</span><span><b>${state.faceDownCount || 0}</b><small>张暗置</small></span></span>
            ${faceUp}
        </div>`;
    }

    function roleOption(role, action, value, className = '') {
        const meta = roleMeta(role);
        const optionValue = value || role.id;
        const selected = pendingRoleId === optionValue && pendingRoleAction === action;
        return `<button class="citadels-role-option role-${meta.accent} ${className} ${selected ? 'is-selected' : ''}" data-action="selectRole" data-role-action="${escapeHtml(action)}" data-value="${escapeHtml(optionValue)}" type="button" aria-pressed="${selected}">
            ${roleArt(role, 'mini')}
            <span class="citadels-role-option-copy"><small>角色 ${meta.rank}</small><strong>${escapeHtml(meta.name)}</strong><em>${escapeHtml(meta.description)}</em></span>
            <span class="citadels-role-option-arrow">›</span>
        </button>`;
    }

    function phaseLabels() {
        if (state?.status === 'ended') return { kicker: '最终账本', label: '牌局结束' };
        if (state?.phase === 'role_selection') return { kicker: '秘密选角', label: '秘密选角' };
        return { kicker: '角色回合', label: state?.currentRoleName ? `角色 ${state.currentRoleRank} · ${state.currentRoleName}` : '角色行动' };
    }

    function render() {
        if (!state) return;
        syncSelection();
        const root = mount.querySelector('[data-game-root]');
        root?.classList.toggle('is-draft-phase', state.phase === 'role_selection' && state.status !== 'ended');
        root?.classList.toggle('is-ended-phase', state.status === 'ended');
        const phase = phaseLabels();
        $('round').textContent = state.status === 'ended' ? '完' : `第 ${state.round || '—'}`;
        $('phase').textContent = phase.label;
        $('currentRole').textContent = state.status === 'ended' ? '已结算' : state.currentRoleName ? `${state.currentRoleRank} · ${state.currentRoleName}` : state.phase === 'role_selection' ? '秘密选角' : '等待呼叫';
        $('crown').textContent = playerById(state.crownHolderId)?.name || '—';
        $('room').textContent = state.roomId ? `房间 ${state.roomId}` : '富饶之城';
        renderCommand();
        renderRoleTrack();
        renderCities();
        renderHand();
        renderLedger();
        renderPlayers();
        renderLog();
        $('hint').textContent = hintText();
    }

    function syncSelection() {
        const drawIds = new Set((state?.myDrawOptions || []).map(card => card.id));
        if (state?.myDrawOptions?.length) selectedCardIds = selectedCardIds.filter(id => drawIds.has(id));
        if (!state?.availableActions?.magicianSwap) {
            swapMode = false;
            if (!state?.myDrawOptions?.length) selectedCardIds = [];
        }
        const roleAction = state?.availableActions?.discardRole ? 'discardRole' : state?.availableActions?.chooseRole ? 'chooseRole' : null;
        const roleOptions = roleAction === 'discardRole' ? state?.discardOptions || [] : state?.availableRoles || [];
        if (!roleAction || pendingRoleAction !== roleAction || !roleOptions.some(role => role.id === pendingRoleId)) {
            pendingRoleId = null;
            pendingRoleAction = null;
        }
        const me = playerById(state?.myId);
        const buildCard = (state?.myHand || []).find(card => card.id === pendingBuildId);
        if (!state?.availableActions?.buildDistrict || !buildCard || (me?.gold || 0) < buildCard.cost || me?.city?.some(card => card.name === buildCard.name)) pendingBuildId = null;
        const decisionAvailable = pendingDecision && state?.availableActions?.[pendingDecision.kind];
        if (!decisionAvailable) pendingDecision = null;
    }

    function renderRoleTrack() {
        const faceUp = new Set((state.faceUpRoles || []).map(role => role.id));
        $('roleTrack').innerHTML = Object.entries(ROLE_META).map(([id, meta]) => {
            const isCurrent = state.phase === 'character_turn' && meta.rank === state.currentRoleRank;
            const isPast = state.phase === 'character_turn' && meta.rank < state.currentRoleRank;
            const isFaceUp = state.phase === 'role_selection' && faceUp.has(id);
            const status = isCurrent ? '正在呼叫' : isPast ? '已呼叫' : isFaceUp ? '本轮明置' : '等待';
            return `<span class="citadels-role-step role-${meta.accent} ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''} ${isFaceUp ? 'is-face-up' : ''}" data-role-id="${escapeHtml(id)}"><b>${meta.rank}</b><strong>${escapeHtml(meta.name)}</strong><small>${status}</small></span>`;
        }).join('');
    }

    function hintText() {
        if (!state) return '等待牌局状态';
        if (state.status === 'ended') {
            const names = (state.winners?.length ? state.winners : state.winner ? [state.winner] : []).map(item => item.name).join('、');
            return `${names || '本局'} 获胜 · 城市账本已封存`;
        }
        if (state.phase === 'role_selection') {
            if (state.availableActions?.discardRole) return '暗置一张角色牌，继续秘密选角';
            if (state.availableActions?.chooseRole) return `轮到你选角 · ${state.myRoles?.length || 0} / ${state.players?.length <= 3 ? 2 : 1}`;
            return state.draftDiscarding ? '等待当前玩家暗置角色牌' : '等待其他玩家完成秘密选角';
        }
        const actions = state.availableActions || {};
        if (actions.graveyardRecover || actions.declineGraveyard) return '你的墓地正在等待决定';
        if (state.myDrawOptions?.length) return `从摸到的牌中保留 ${state.myDrawKeepCount || 1} 张`;
        if (swapMode) return `已选 ${selectedCardIds.length} 张 · 点击手牌选择要换掉的牌`;
        if (actions.closeBuild) return '军阀：建造完成后，先结束建造阶段再选择目标';
        if (actions.endTurn) return '资源、能力与建造完成后，结束当前角色回合';
        const current = playerById(state.currentPlayerId);
        return `等待 ${current?.name || '下一位角色'} 行动`;
    }

    function renderCommand() {
        const phase = phaseLabels();
        const commandKicker = $('commandKicker');
        const title = $('commandTitle');
        const copy = $('commandCopy');
        const status = $('commandStatus');
        const body = $('commandBody');
        const footer = $('commandFooter');
        commandKicker.textContent = phase.kicker;
        footer.innerHTML = '';

        const amDraftPlayer = state.phase === 'role_selection' && state.draftPlayerId === state.myId;
        const amCurrentPlayer = state.currentPlayerId === state.myId;
        const activeForMe = Boolean(amDraftPlayer || amCurrentPlayer || state.availableActions?.graveyardRecover || state.availableActions?.declineGraveyard);
        status.innerHTML = state.status === 'ended'
            ? '<span class="citadels-status-badge is-ended">已结算</span>'
            : `<span class="citadels-status-badge ${activeForMe ? 'is-mine' : ''}">${activeForMe ? '轮到我' : '等待中'}</span>`;

        if (state.status === 'ended') {
            const winnerNames = (state.winners?.length ? state.winners : state.winner ? [state.winner] : []).map(item => item.name).join('、');
            title.textContent = `${winnerNames || '本局'} 获胜`;
            copy.textContent = '终局城市账本已经结算，下面保留本局的最终排名。';
            body.innerHTML = `<div class="citadels-scoreboard">${(state.scores || []).map((score, index) => `<div class="citadels-score-row ${state.winners?.some(item => item.id === score.id) ? 'is-winner' : ''}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${escapeHtml(score.name)}</strong><small>城区 ${score.districtSum} · 首建 +${score.firstFinisherBonus || 0} · 八城 +${score.eightCityBonus || 0} · 五色 +${score.colorBonus || 0} · 特殊 +${(score.treasuryBonus || 0) + (score.mapRoomBonus || 0)}</small></span><em>${score.score}<small>分</small></em></div>`).join('')}</div>`;
            return;
        }

        if (state.phase === 'role_selection') {
            renderRoleSelection(title, copy, body);
            return;
        }

        renderCharacterCommand(title, copy, body, footer, amCurrentPlayer);
    }

    function renderRoleSelection(title, copy, body) {
        const up = state.faceUpRoles || [];
        const roleInfo = roleDraftInfo(up);
        if (state.availableActions?.discardRole) {
            title.textContent = '暗置一张角色牌';
            copy.textContent = '这张牌将从本轮公开信息中消失，其他玩家不会知道你的选择。';
            body.innerHTML = `<div class="citadels-draft-top"><div><span class="citadels-command-note-label">当前步骤</span><strong>从角色牌堆中选择一张暗置</strong></div>${roleInfo}</div><div class="citadels-role-grid">${(state.discardOptions || []).map(item => roleOption(item, 'discardRole', item.id, 'is-discard')).join('')}</div>${roleConfirmMarkup('discardRole', '确认暗置角色')}`;
            return;
        }
        if (state.availableActions?.chooseRole) {
            const count = state.myRoles?.length || 0;
            const total = state.players?.length <= 3 ? 2 : 1;
            title.textContent = `选择你的${total > 1 ? `第 ${count + 1} 个` : ''}角色`;
            copy.textContent = total > 1 ? `你控制 ${total} 个角色，已选择 ${count} 个；每个角色会在对应编号被呼叫。` : '选定后角色牌会保持私密，轮到对应编号时才会揭示。';
            body.innerHTML = `<div class="citadels-draft-top"><div><span class="citadels-command-note-label">我的选择</span><strong>${count ? `已选：${state.myRoles.map(item => escapeHtml(item.name)).join('、')}` : '选择一张适合你城市的角色'}</strong></div>${roleInfo}</div><div class="citadels-role-grid">${(state.availableRoles || []).map(item => roleOption(item, 'chooseRole', item.id)).join('')}</div>${roleConfirmMarkup('chooseRole', '确认选择角色')}`;
            return;
        }
        title.textContent = '秘密选角进行中';
        copy.textContent = state.draftDiscarding ? '当前玩家正在暗置角色牌。' : '角色选择会按皇冠顺序推进，选定后才会公开行动。';
        body.innerHTML = `<div class="citadels-waiting"><span class="citadels-pulse"></span><div><strong>等待其他玩家完成选择</strong><small>${state.draftPlayerId ? `${escapeHtml(playerById(state.draftPlayerId)?.name || '下一位玩家')} 正在看牌` : '角色牌正在重新整理'}</small></div></div>${roleInfo}`;
    }

    function roleConfirmMarkup(action, label) {
        const meta = pendingRoleId ? roleMeta(pendingRoleId) : null;
        return `<div class="citadels-role-confirm ${meta ? `role-${meta.accent}` : ''}"><span><small>${meta ? '准备提交本轮选择' : '先从上方预选一张角色牌'}</small><strong>${meta ? `${meta.rank} · ${escapeHtml(meta.name)}` : '尚未预选'}</strong></span><button class="citadels-button is-primary" data-action="confirmRole" data-role-action="${escapeHtml(action)}" type="button" ${meta ? '' : 'disabled'}>${escapeHtml(label)}</button></div>`;
    }

    function renderCharacterCommand(title, copy, body, footer, amCurrentPlayer) {
        const meta = currentRoleMeta();
        const roleOwner = playerById(state.currentPlayerId);
        title.textContent = state.currentRoleName ? `${state.currentRoleRank} · ${state.currentRoleName} 的回合` : '角色行动';
        copy.textContent = roleOwner ? `${roleOwner.name} 正在执行 ${meta?.name || state.currentRoleName || '角色'}。` : '角色牌按编号依次揭示。';

        const roleHero = `<div class="citadels-role-hero ${meta ? `role-${meta.accent}` : ''}">${meta ? roleArt(meta) : '<span class="citadels-role-placeholder">?</span>'}<div class="citadels-role-hero-copy"><span class="citadels-command-note-label">已呼叫角色 · ${meta?.rank || '—'}号</span><strong>${escapeHtml(meta?.name || state.currentRoleName || '等待呼叫')}</strong><p>${escapeHtml(meta?.description || '角色能力将在牌局状态更新后显示。')}</p><small>${roleOwner ? `当前玩家：${escapeHtml(roleOwner.name)}` : '等待角色持有者'}</small></div><div class="citadels-my-role-strip"><span>我的角色</span><b>${(state.myRoles || []).map(item => `${item.rank} · ${escapeHtml(item.name)}`).join(' / ') || '—'}</b></div></div>`;

        if (state.availableActions?.graveyardRecover || state.availableActions?.declineGraveyard) {
            const pending = state.pendingGraveyard;
            title.textContent = '墓地回收决定';
            copy.textContent = `军阀摧毁了你的${pending?.cardName || '城区'}，墓地可以让它回到手牌。`;
            body.innerHTML = `${roleHero}<div class="citadels-reaction"><span class="citadels-reaction-mark">墓</span><div><strong>支付 1 金回收${escapeHtml(pending?.cardName || '被摧毁的城区')}</strong><small>回收不会占用当前角色的行动。</small></div><div class="citadels-action-row">${state.availableActions.graveyardRecover ? actionButton('支付 1 金回收', 'graveyardRecover', '', 'is-primary') : ''}${actionButton('放弃回收', 'declineGraveyard', '', 'is-danger')}</div></div>`;
            return;
        }

        if (!amCurrentPlayer) {
            body.innerHTML = `${roleHero}<div class="citadels-waiting"><span class="citadels-pulse"></span><div><strong>${escapeHtml(roleOwner?.name || '当前玩家')} 正在行动</strong><small>你可以查看自己的城市与手牌，轮到你时操作会出现在这里。</small></div></div>`;
            return;
        }

        const actions = state.availableActions || {};
        const parts = [roleHero];
        if (actions.assassinate) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>宣布暗杀</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>目标角色</span><select data-select-for="assassinate">${roleChoices(['assassin']).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('')}</select></label>${decisionButton('核对暗杀对象', 'assassinate', '', 'is-danger')}</div></section>`);
        if (actions.rob) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>指定盗窃目标</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>目标角色</span><select data-select-for="rob">${roleChoices(['assassin', 'thief']).filter(([id]) => id !== state.killedRole).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('')}</select></label>${decisionButton('核对盗窃对象', 'rob', '', 'is-danger')}</div></section>`);
        if (actions.magicianExchange) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>交换全部手牌</strong></div><div class="citadels-action-row"><label class="citadels-select"><span>交换对象</span><select data-select-for="magicianExchange">${(state.players || []).filter(player => player.id !== state.myId).map(player => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}</option>`).join('')}</select></label>${decisionButton('核对交换对象', 'magicianExchange', '', 'is-violet')}</div></section>`);
        if (actions.magicianSwap) parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>角色能力</span><strong>${swapMode ? `已选 ${selectedCardIds.length} 张牌` : '弃牌并补回等量牌'}</strong></div><p class="citadels-action-copy">${swapMode ? '在下方手牌中选择任意数量，再确认换牌。' : '可以弃掉任意数量的手牌，并从牌堆补回同样数量。'}</p><div class="citadels-action-row">${swapMode ? actionButton(`确认换 ${selectedCardIds.length} 张`, 'confirmSwap', '', 'is-violet', false) : actionButton('选择要弃掉的牌', 'startSwap', '', 'is-violet')}</div></section>`);

        if (actions.takeGold || actions.drawDistrict || actions.collectIncome) {
            const resourceCards = [];
            if (actions.takeGold) resourceCards.push(actionButton('拿 2 金', 'takeGold', '', 'is-resource', false));
            if (actions.drawDistrict) resourceCards.push(actionButton('摸城区牌', 'drawDistrict', '', 'is-resource', false));
            if (actions.collectIncome) resourceCards.push(actionButton('领取角色收入', 'collectIncome', '', 'is-income', false));
            parts.push(`<section class="citadels-action-section"><div class="citadels-action-section-head"><span>本回合第一步</span><strong>选择资源</strong></div><div class="citadels-resource-grid">${resourceCards.join('')}</div><p class="citadels-action-copy">先选择金币或城区牌；有颜色的角色还可以领取对应城区收入。</p></section>`);
        }
        if (actions.keepDistrict) parts.push(`<div class="citadels-draw-callout"><b>摸牌完成</b><span>请在下方牌面选择保留 ${state.myDrawKeepCount || 1} 张。</span></div>`);
        if (actions.smithy) parts.push(`<section class="citadels-action-section citadels-utility-action"><div><span>紫色独特区</span><strong>铁匠铺</strong><small>支付 3 金，额外摸 2 张城区牌。</small></div>${actionButton('使用铁匠铺', 'smithy', '', 'is-violet')}</section>`);
        if (actions.closeBuild) parts.push(`<section class="citadels-action-section citadels-utility-action is-warlord"><div><span>军阀阶段</span><strong>结束建造阶段</strong><small>结束后才可以选择是否摧毁其他城市的城区。</small></div>${actionButton('结束建造', 'closeBuild', '', 'is-primary')}</section>`);
        if (actions.destroyDistrict) {
            const targets = (state.destroyTargets || []).map(target => ({ label: `${target.targetName} · ${target.card.name} · ${target.cost} 金${target.greatWall ? ' · 长城' : ''}`, value: `${target.targetId}::${target.card.id}` }));
            parts.push(`<section class="citadels-action-section citadels-utility-action is-warlord"><div><span>军阀阶段</span><strong>摧毁一座城区</strong><small>列表只显示服务器核定后可摧毁且付得起的城区。</small></div><div class="citadels-action-row"><label class="citadels-select"><span>目标</span><select data-select-for="destroyDistrict">${targets.length ? targets.map(target => `<option value="${escapeHtml(target.value)}">${escapeHtml(target.label)}</option>`).join('') : '<option value="">暂无可选城区</option>'}</select></label>${decisionButton('核对摧城令', 'destroyDistrict', '', 'is-danger', !targets.length)}</div></section>`);
        }
        if (actions.endTurn) parts.push(`<div class="citadels-end-turn-row"><span>城区行动完成后结束这张角色牌的回合</span>${actionButton('结束角色回合', 'endTurn', '', 'is-primary')}</div>`);
        if (pendingDecision && pendingDecision.kind !== 'laboratory') parts.push(decisionConfirmMarkup());
        body.innerHTML = parts.join('');
    }

    function roleChoices(excluded = []) {
        return Object.entries(ROLE_META).filter(([id]) => !excluded.includes(id)).map(([id, meta]) => [id, meta.name]);
    }

    function renderLedger() {
        const me = playerById(state.myId);
        const myRoles = state.myRoles || [];
        const city = me?.city || [];
        const colors = Object.keys(COLOR_META).map(color => ({ color, count: city.filter(card => card.color === color).length }));
        $('ledger').innerHTML = `<div class="citadels-ledger-balance"><span class="citadels-coin-mark">金</span><div><small>当前金币</small><strong>${me?.gold ?? 0}</strong></div><span class="citadels-ledger-unit">金币</span></div>
            <div class="citadels-ledger-stats"><span><b>${city.length}</b><small>城区 / 8</small></span><span><b>${state.myHand?.length || 0}</b><small>手牌</small></span><span><b>${state.districtDeckCount || 0}</b><small>牌库</small></span></div>
            <div class="citadels-my-roles"><span>已持角色</span><div>${myRoles.length ? myRoles.map(item => `<span class="citadels-role-chip role-${roleMeta(item).accent}">${item.rank} · ${escapeHtml(item.name)}</span>`).join('') : '<em>角色尚未揭示</em>'}</div></div>
            <div class="citadels-color-meter">${colors.map(item => `<span class="color-meter-${colorMeta(item.color).className}" style="--count:${item.count}" title="${colorMeta(item.color).name} ${item.count} 座"><i></i><b>${item.count}</b></span>`).join('')}</div>`;
        $('stageSummary').innerHTML = `<span><b>${city.length}</b> / 8 城区</span><span><b>${state.myHand?.length || 0}</b> 张手牌</span><span class="citadels-stage-deck">${districtBack('micro')}<b>${state.districtDeckCount || 0}</b> 张牌库</span>`;
        $('handNote').textContent = `${state.myHand?.length || 0} 张 · 仅你可见`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map((player, index) => {
            const murderedRoleIds = new Set((player.murderedRoles || []).map(item => item.id));
            const revealed = player.roles?.length ? player.roles.map(item => `${item.name}${murderedRoleIds.has(item.id) ? '（缺席）' : ''}`).join('、') : player.murdered ? '本轮缺席' : '角色隐藏';
            const status = player.isOnline === false ? '离线' : player.isCurrentTurn ? '正在行动' : `${revealed}`;
            const onlyMurderedRolesRevealed = murderedRoleIds.size > 0 && murderedRoleIds.size === (player.roles?.length || 0);
            return `<article class="citadels-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${onlyMurderedRolesRevealed ? 'is-murdered' : ''}" data-player-id="${escapeHtml(player.id)}">
                <span class="citadels-player-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="citadels-avatar">${escapeHtml(String(player.name || '?').slice(0, 1))}${player.id === state.crownHolderId ? '<i>♛</i>' : ''}</span>
                <span class="citadels-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${escapeHtml(status)}</small></span>
                <span class="citadels-player-assets"><b>${player.gold}</b><small>金</small><b>${player.cityCount}</b><small>区</small></span>
            </article>`;
        }).join('');
    }

    function cityCardMarkup(card, ownerId = '') {
        const color = colorMeta(card.color);
        const mark = DISTRICT_MARKS[card.effect] || '';
        return `<span class="citadels-city-card color-${color.className}" data-district-id="${escapeHtml(card.id)}" data-city-owner="${escapeHtml(ownerId)}"${mark ? ` data-mark="${escapeHtml(mark)}"` : ''} title="${escapeHtml(EFFECT_NAMES[card.effect] || color.name)}"><span class="citadels-building" aria-hidden="true"></span><b>${escapeHtml(card.name)}</b><small><i>${card.cost}</i> 金 · ${card.points} 分</small></span>`;
    }

    function renderCities() {
        $('cities').innerHTML = (state.players || []).map((player, index) => `<article class="citadels-city-row ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''}" data-city-owner="${escapeHtml(player.id)}">
            <header><span class="citadels-city-order">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我的城市</em>' : ''}</strong>${player.id === state.crownHolderId ? '<span class="citadels-crown-label">♛ 皇冠</span>' : ''}<span class="citadels-city-count"><i style="--built:${Math.min(8, player.cityCount || 0)}"></i><b>${player.cityCount} / 8</b></span></header>
            <div class="citadels-city-cards">${player.city?.length ? player.city.map(card => cityCardMarkup(card, player.id)).join('') : '<span class="citadels-empty-city">尚未建造城区</span>'}</div>
        </article>`).join('');
    }

    function districtCardMarkup(card, buttons = '', selected = false, disabled = false) {
        const color = colorMeta(card.color);
        const mark = DISTRICT_MARKS[card.effect] || '';
        const effect = card.effect ? `<span class="citadels-card-effect"><b>独特能力</b>${escapeHtml(EFFECT_NAMES[card.effect] || '')}</span>` : '<span class="citadels-card-effect is-empty">基础城区 · 建成后提供固定分数</span>';
        return `<article class="citadels-district-card color-${color.className} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}">
            <div class="citadels-card-top"><span>${escapeHtml(color.short)}</span><b>${card.cost}</b></div>
            <div class="citadels-card-main"><span class="citadels-district-art art-v${districtVariant(card)}" aria-hidden="true"><i${mark ? ` data-mark="${escapeHtml(mark)}"` : ''}></i></span><small>${card.effect ? '独特城区' : '基础城区'}</small><strong>${escapeHtml(card.name)}</strong><em>${escapeHtml(color.name)} · ${card.points} 分</em></div>
            ${effect}
            ${buttons ? `<div class="citadels-card-actions">${buttons}</div>` : ''}
        </article>`;
    }

    function renderHand() {
        const hand = $('hand');
        const actions = state.availableActions || {};
        const drawOptions = state.myDrawOptions || [];
        if (drawOptions.length) {
            const keepCount = state.myDrawKeepCount || 1;
            hand.innerHTML = `<div class="citadels-hand-callout"><span class="citadels-callout-mark">摸牌</span><div><strong>选择保留 ${keepCount} 张</strong><small>未保留的牌会回到城区牌堆底部。</small></div><b>${selectedCardIds.length} / ${keepCount}</b></div><div class="citadels-card-grid">${drawOptions.map(card => {
                const selected = selectedCardIds.includes(card.id);
                const buttons = keepCount > 1
                    ? actionButton(selected ? '已选择' : '选择保留', 'toggleKeep', card.id, selected ? 'is-primary' : '', false)
                    : actionButton('保留这张', 'keepDistrict', card.id, 'is-primary');
                return districtCardMarkup(card, buttons, selected);
            }).join('')}</div>${keepCount > 1 ? `<div class="citadels-hand-confirm">${actionButton(`保留所选（${selectedCardIds.length} / ${keepCount}）`, 'confirmKeep', '', 'is-primary', selectedCardIds.length !== keepCount)}</div>` : ''}`;
            return;
        }

        const me = playerById(state.myId);
        const cards = state.myHand || [];
        if (!cards.length) {
            hand.innerHTML = '<div class="citadels-empty-hand"><span>○</span><strong>手牌暂为空</strong><small>摸到城区牌后，牌面会出现在这里。</small></div>';
            return;
        }
        const cardGrid = `<div class="citadels-card-grid">${cards.map(card => {
            const duplicate = Boolean(me?.city?.some(existing => existing.name === card.name));
            const cannotBuild = duplicate || (me?.gold || 0) < card.cost;
            const buttons = [];
            if (swapMode) buttons.push(actionButton(selectedCardIds.includes(card.id) ? '已选择' : '选择弃掉', 'toggleSwap', card.id, selectedCardIds.includes(card.id) ? 'is-violet' : ''));
            else if (actions.buildDistrict) buttons.push(actionButton(duplicate ? '城市已有同名' : pendingBuildId === card.id ? '已预选' : '预选建造', 'selectBuild', card.id, duplicate ? 'is-muted' : pendingBuildId === card.id ? 'is-primary' : '', cannotBuild));
            if (actions.laboratory) buttons.push(decisionButton(pendingDecision?.kind === 'laboratory' && pendingDecision.value === card.id ? '已预选弃置' : '实验室弃牌', 'laboratory', card.id, 'is-violet'));
            return districtCardMarkup(card, buttons.join(''), selectedCardIds.includes(card.id) || pendingBuildId === card.id, cannotBuild && actions.buildDistrict && !swapMode);
        }).join('')}</div>`;
        const buildCard = cards.find(card => card.id === pendingBuildId);
        const buildConfirm = buildCard && actions.buildDistrict && !swapMode
            ? `<div class="citadels-build-confirm"><span><small>准备加入我的城市</small><strong>${escapeHtml(buildCard.name)} · 支付 ${buildCard.cost} 金</strong></span><button class="citadels-button is-primary" data-action="confirmBuild" type="button">确认建造</button></div>`
            : '';
        const laboratoryConfirm = pendingDecision?.kind === 'laboratory' ? decisionConfirmMarkup() : '';
        hand.innerHTML = `${cardGrid}${buildConfirm}${laboratoryConfirm}`;
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="citadels-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<p class="citadels-empty-log">牌局开始后，城中的传闻会记录在这里。</p>';
    }

    function presentationDelay(duration, token) {
        const wait = reducedMotion?.matches ? Math.min(160, duration * .2) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: window.setTimeout(() => {
                    presentationWaiters.delete(waiter);
                    resolve(token === presentationToken);
                }, wait),
                resolve,
            };
            presentationWaiters.add(waiter);
        });
    }

    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function showPresentation(kind, html, options = {}) {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `citadels-presentation-layer is-active is-${kind}${options.strong ? ' is-strong' : ''}`;
        layer.style.setProperty('--event-color', options.color || '#d3aa5c');
        $('presentationStage').innerHTML = html;
        clearActionLine();
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
        clearActionLine();
        layer.className = 'citadels-presentation-layer';
        layer.style.removeProperty('--event-color');
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('presentationStage').innerHTML = '';
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.removeAttribute('class');
    }

    function dataAnchor(attribute, value) {
        return [...mount.querySelectorAll(`[${attribute}]`)].find(element => element.getAttribute(attribute) === String(value)) || null;
    }

    function playerAnchor(playerId) {
        return dataAnchor('data-player-id', playerId) || dataAnchor('data-city-owner', playerId) || $('players');
    }

    function cityAnchor(playerId, cardId = null) {
        if (cardId) {
            const card = [...mount.querySelectorAll('[data-district-id]')].find(element => element.dataset.districtId === String(cardId) && element.dataset.cityOwner === String(playerId));
            if (card) return card;
        }
        return [...mount.querySelectorAll('.citadels-city-row[data-city-owner]')].find(element => element.dataset.cityOwner === String(playerId)) || playerAnchor(playerId);
    }

    function roleAnchor(roleId) {
        return dataAnchor('data-role-id', roleId) || $('roleTrack');
    }

    function drawActionLine(fromElement, toElement, className = '') {
        const path = $('actionPath');
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const curve = Math.max(40, Math.abs(x2 - x1) * .18);
        path.setAttribute('d', `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - curve} ${x2} ${y2}`);
        path.setAttribute('class', `is-visible ${className}`.trim());
    }

    function setMotionPoint(motion, anchor, prefix) {
        if (!motion || !anchor) return;
        const source = anchor.getBoundingClientRect();
        const target = motion.getBoundingClientRect();
        motion.style.setProperty(`--event-${prefix}-x`, `${source.left + source.width / 2 - (target.left + target.width / 2)}px`);
        motion.style.setProperty(`--event-${prefix}-y`, `${source.top + source.height / 2 - (target.top + target.height / 2)}px`);
    }

    function eventFrame(kicker, title, copy, visual, extraClass = '') {
        return `<article class="citadels-event ${extraClass}"><span class="citadels-event-kicker">${escapeHtml(kicker)}</span><div class="citadels-event-visual">${visual}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></article>`;
    }

    function eventRoleMarkup(role, extraClass = '') {
        const meta = roleMeta(role);
        return `<div class="citadels-event-role citadels-event-motion role-${meta.accent} ${extraClass}">${roleArt(role, 'event')}<span><small>角色 ${meta.rank}</small><strong>${escapeHtml(meta.name)}</strong></span></div>`;
    }

    function eventDistrictMarkup(card, extraClass = '') {
        return `<div class="citadels-event-district citadels-event-motion ${extraClass}">${districtCardMarkup(card)}</div>`;
    }

    function eventBacks(count, extraClass = '') {
        const shown = Math.max(1, Math.min(5, Number(count) || 1));
        return `<span class="citadels-event-backs ${extraClass}">${Array.from({ length: shown }, (_, index) => `<i style="--back-index:${index}">${districtBack('event')}</i>`).join('')}<b>×${Number(count) || 0}</b></span>`;
    }

    async function routePresentation(event, token, options) {
        showPresentation(options.kind, eventFrame(options.kicker, options.title, options.copy, options.visual, options.extraClass || ''), { strong: options.strong, color: options.color });
        const motion = $('presentationStage').querySelector('.citadels-event-motion') || $('presentationStage').querySelector('.citadels-event-visual');
        const from = options.from || null;
        const to = options.to || null;
        await nextFrame();
        if (from) {
            setMotionPoint(motion, from, 'from');
            drawActionLine(from, motion, options.lineClass || '');
        }
        if (to) setMotionPoint(motion, to, 'to');
        $('presentationLayer').classList.add('is-routed');
        await nextFrame();
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(options.centerDuration || 380, token)) return;
        if (to) {
            $('presentationLayer').classList.add('is-transferred');
            drawActionLine(motion, to, options.lineClass || '');
            to.classList.add('is-event-impact');
        } else {
            $('presentationLayer').classList.add('is-revealed');
        }
        await presentationDelay(options.endDuration || 620, token);
    }

    async function playRoleDraft(event, token) {
        const copy = event.action === 'discard' ? '一张角色牌已暗置，其身份对所有人保密' : '角色牌已封入私人手令，将在被召集时揭示';
        await routePresentation(event, token, {
            kind: 'role-draft', kicker: '秘密选角', title: event.action === 'discard' ? '角色暗置' : `${event.playerName}完成选角`, copy,
            visual: `<div class="citadels-event-motion citadels-event-role-back">${roleBack('event')}<span>密</span></div>`,
            from: $('roleTrack'), to: playerAnchor(event.playerId), centerDuration: 260, endDuration: 360,
        });
    }

    async function playRoleCall(event, token) {
        const meta = roleMeta(event.role);
        await routePresentation(event, token, {
            kind: 'role-call', kicker: `第 ${state.round || '—'} 轮 · 宫廷召集`, title: `${meta.rank} · ${meta.name}`, copy: `${event.playerName}亮明身份，开始执行角色回合`,
            visual: eventRoleMarkup(event.role), from: roleAnchor(event.role?.id), to: playerAnchor(event.playerId), color: ROLE_ACCENT_COLORS[meta.accent] || '#d3aa5c', centerDuration: 360, endDuration: 520,
        });
    }

    async function playDeclaration(event, token, kind) {
        const assassin = kind === 'assassinationDeclared';
        const actorRole = assassin ? ROLE_META.assassin : ROLE_META.thief;
        const target = roleMeta(event.targetRole);
        await routePresentation(event, token, {
            kind: assassin ? 'assassination-declared' : 'robbery-declared', kicker: `${event.playerName}颁布密令`, title: assassin ? `暗杀目标：${target.name}` : `盗窃目标：${target.name}`,
            copy: '只公开目标角色；角色持有者要到被召集时才会显现',
            visual: `<div class="citadels-event-declaration"><div class="citadels-event-motion">${roleArt(assassin ? 'assassin' : 'thief', 'event')}</div><span><small>目标角色</small><b>${target.rank}</b><strong>${escapeHtml(target.name)}</strong></span></div>`,
            from: playerAnchor(event.playerId), color: assassin ? '#cf7667' : '#c59d55', lineClass: assassin ? 'is-danger' : '', centerDuration: 420, endDuration: 650,
        });
    }

    async function playAssassination(event, token) {
        const meta = roleMeta(event.role);
        const target = playerAnchor(event.playerId);
        await routePresentation(event, token, {
            kind: 'assassination-resolved', kicker: '密令在召集时生效', title: `${meta.name}遇刺`, copy: `${event.playerName}本轮缺席，但并未永久退出游戏`,
            visual: eventRoleMarkup(event.role, 'is-assassinated'), from: roleAnchor(event.role?.id), to: target, color: '#cf665f', lineClass: 'is-danger', strong: true, centerDuration: 560, endDuration: 850,
        });
    }

    async function playRobbery(event, token) {
        await routePresentation(event, token, {
            kind: 'robbery-resolved', kicker: `${event.targetRole?.name || '目标角色'}已亮明`, title: `盗贼取走 ${event.amount || 0} 金`, copy: `${event.targetPlayerName}的金币转移给${event.playerName}`,
            visual: `<div class="citadels-event-coins citadels-event-motion"><i>金</i><i>金</i><b>${event.amount || 0}</b></div>`, from: playerAnchor(event.targetPlayerId), to: playerAnchor(event.playerId), color: '#d3aa5c', centerDuration: 330, endDuration: 600,
        });
    }

    async function playMagician(event, token) {
        const exchange = event.kind === 'magicianExchange';
        await routePresentation(event, token, {
            kind: exchange ? 'magician-exchange' : 'magician-swap', kicker: `${event.playerName}发动魔术师`, title: exchange ? `与${event.targetPlayerName}交换全部手牌` : `弃 ${event.discardedCount || 0} 张，补 ${event.drawnCount || 0} 张`, copy: exchange ? `${event.actorCardCount || 0} 张与 ${event.targetCardCount || 0} 张卡背交错而过，牌面仍保密` : '私密牌面不对其他玩家展示',
            visual: `<div class="citadels-event-motion citadels-event-card-exchange">${eventBacks(exchange ? event.actorCardCount : event.discardedCount, 'is-left')}<i>⇄</i>${eventBacks(exchange ? event.targetCardCount : event.drawnCount, 'is-right')}</div>`,
            from: playerAnchor(event.playerId), to: exchange ? playerAnchor(event.targetPlayerId) : null, color: '#9a7ab0', centerDuration: 420, endDuration: 700,
        });
    }

    async function playResource(event, token) {
        const config = {
            takeGold: ['国库支取', `获得 ${event.amount || 0} 金`, event.merchantBonus ? '商人额外收入同时到账' : event.architectCards ? `建筑师另摸 ${event.architectCards} 张牌` : '基础资源行动', `<div class="citadels-event-coins citadels-event-motion"><i>金</i><i>金</i><b>+${(event.amount || 0) + (event.merchantBonus || 0)}</b></div>`],
            drawDistrict: ['城区牌库', `摸取 ${event.count || 0} 张城区牌`, event.count ? `私下选择保留 ${event.keepCount || 0} 张` : '城区牌堆已空', `<div class="citadels-event-motion">${eventBacks(event.count)}</div>`],
            keepDistrict: ['私密抉择', `保留 ${event.keptCount || 0} 张城区牌`, `其余 ${event.returnedCount || 0} 张返回牌堆底，牌面不公开`, `<div class="citadels-event-motion">${eventBacks(event.keptCount)}</div>`],
            incomeCollected: ['角色收入', `${event.role?.name || '角色'}收入 +${event.amount || 0} 金`, '对应颜色的已建城区产生收入', `<div class="citadels-event-coins citadels-event-motion"><i>金</i><b>+${event.amount || 0}</b></div>`],
            smithy: ['紫色独特区', '铁匠铺开炉', `支付 ${event.cost || 3} 金，私下摸取 ${event.drawnCount || 0} 张城区牌`, `<div class="citadels-event-motion">${eventBacks(event.drawnCount)}</div>`],
        }[event.kind];
        if (!config) return;
        await routePresentation(event, token, { kind: 'resource', kicker: config[0], title: config[1], copy: config[2], visual: config[3], to: playerAnchor(event.playerId), centerDuration: 250, endDuration: 420 });
    }

    async function playBuild(event, token) {
        const destination = cityAnchor(event.playerId, event.card?.id);
        await routePresentation(event, token, {
            kind: 'build-district', kicker: `${event.playerName}扩建城市`, title: `${event.card?.name || '城区'}落成`, copy: `支付 ${event.cost || 0} 金 · 城市现有 ${event.cityCount || 0} / 8 座城区`,
            visual: eventDistrictMarkup(event.card), from: playerAnchor(event.playerId), to: destination, color: '#d3aa5c', centerDuration: 380, endDuration: 600,
        });
    }

    async function playLaboratory(event, token) {
        await routePresentation(event, token, {
            kind: 'laboratory', kicker: `${event.playerName}启动实验室`, title: `${event.card?.name || '城区牌'}已弃置`, copy: '公开弃牌完成，并获得 1 枚金币', visual: eventDistrictMarkup(event.card, 'is-discarded'), from: playerAnchor(event.playerId), color: '#9a7ab0', centerDuration: 320, endDuration: 500,
        });
    }

    async function playDestroy(event, token) {
        await routePresentation(event, token, {
            kind: 'destroy-district', kicker: `${event.playerName}发动军阀`, title: `${event.card?.name || '城区'}遭到摧毁`, copy: event.graveyardPending ? `已支付 ${event.cost || 0} 金 · 等待${event.targetPlayerName}决定是否用墓地回收` : `已支付 ${event.cost || 0} 金 · ${event.targetPlayerName}的城区已移出城市`,
            visual: eventDistrictMarkup(event.card, 'is-damaged'), from: playerAnchor(event.playerId), to: cityAnchor(event.targetPlayerId), color: '#cf7667', lineClass: 'is-danger', centerDuration: 470, endDuration: event.graveyardPending ? 900 : 650,
        });
    }

    async function playGraveyard(event, token) {
        const recovered = event.kind === 'graveyardRecovered';
        await routePresentation(event, token, {
            kind: recovered ? 'graveyard-recovered' : 'graveyard-declined', kicker: '墓地的最终裁决', title: recovered ? `${event.card?.name || '城区'}回到手中` : `${event.card?.name || '城区'}化为废墟`, copy: recovered ? '支付 1 金，该牌回到墓地主人的私密手牌' : '墓地主人放弃回收，摧城结算完成',
            visual: eventDistrictMarkup(event.card, recovered ? 'is-recovered' : 'is-crumbling'), to: recovered ? playerAnchor(event.playerId) : null, color: recovered ? '#9a7ab0' : '#cf7667', centerDuration: 420, endDuration: 650,
        });
    }

    async function playMajorNotice(event, token) {
        const configs = {
            roleSummoningStart: ['role-summoning', '宫廷封好所有密令', '角色召集开始', `第 ${event.round || state.round} 轮将从 1 号到 8 号依次揭示`, 'Ⅷ', false, 760],
            roundTransition: ['round-transition', `第 ${event.completedRound || 0} 轮结束`, `进入第 ${event.nextRound || 0} 轮`, `${event.crownHolderName || '新国王'}持有皇冠，将率先选择角色`, '♛', false, 850],
            finalRoundTriggered: ['final-round', `${event.playerName}建成第八座城区`, '最终轮已锁定', '完成当前角色召集后，所有城市进入最终计分', 'Ⅷ', true, 1250],
        }[event.kind];
        if (!configs) return;
        showPresentation(configs[0], eventFrame(configs[1], configs[2], configs[3], `<span class="citadels-event-major-mark">${configs[4]}</span>`), { strong: configs[5] });
        await nextFrame();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(configs[6], token);
    }

    async function playFinalSettlement(event, token) {
        const winnerIds = new Set((event.winners || []).map(item => String(item.id)));
        const rows = (event.standings || []).map((score, index) => `<article class="${winnerIds.has(String(score.id)) ? 'is-winner' : ''}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${escapeHtml(score.name)}</strong><small>城区 ${score.districtSum} + 首建 ${score.firstFinisherBonus || 0} + 八城 ${score.eightCityBonus || 0} + 五色 ${score.colorBonus || 0} + 宝库 ${score.treasuryBonus || 0} + 地图室 ${score.mapRoomBonus || 0}</small></span><em>${score.score}</em></article>`).join('');
        const names = (event.winners || []).map(item => item.name).join('、');
        showPresentation('final-settlement', `<article class="citadels-finale-event"><span class="citadels-event-kicker">八座城市的最终账簿</span><span class="citadels-finale-crown">♛</span><h2>${escapeHtml(names || '本局')}获胜</h2><div class="citadels-finale-list">${rows}</div><p>总分相同时依次比较城区分与剩余金币</p></article>`, { strong: true });
        await nextFrame();
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2800, token);
    }

    async function playPresentationEvent(event, token) {
        if (event.kind === 'roleDraftProgress') return playRoleDraft(event, token);
        if (event.kind === 'roleCall') return playRoleCall(event, token);
        if (event.kind === 'assassinationDeclared' || event.kind === 'robberyDeclared') return playDeclaration(event, token, event.kind);
        if (event.kind === 'assassinationResolved') return playAssassination(event, token);
        if (event.kind === 'robberyResolved') return playRobbery(event, token);
        if (event.kind === 'magicianExchange' || event.kind === 'magicianSwap') return playMagician(event, token);
        if (['takeGold', 'drawDistrict', 'keepDistrict', 'incomeCollected', 'smithy'].includes(event.kind)) return playResource(event, token);
        if (event.kind === 'buildDistrict') return playBuild(event, token);
        if (event.kind === 'laboratory') return playLaboratory(event, token);
        if (event.kind === 'destroyDistrict') return playDestroy(event, token);
        if (event.kind === 'graveyardRecovered' || event.kind === 'graveyardDeclined') return playGraveyard(event, token);
        if (['roleSummoningStart', 'roundTransition', 'finalRoundTriggered'].includes(event.kind)) return playMajorNotice(event, token);
        if (event.kind === 'finalSettlement') return playFinalSettlement(event, token);
        return null;
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.citadels-app')?.classList.add('is-presentation-playing');
        while (presentationQueue.length) {
            const batch = presentationQueue.shift();
            const token = ++presentationToken;
            for (const event of batch?.events || []) {
                const played = playPresentationEvent(event, token);
                if (played) await played;
                if (token !== presentationToken) break;
                hidePresentation();
                if (!await presentationDelay(55, token)) break;
            }
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
    }

    function enqueuePresentation(batch) {
        presentationQueue.push(JSON.parse(JSON.stringify(batch)));
        void runPresentationQueue();
    }

    function stopPresentation() {
        presentationToken += 1;
        presentationQueue = [];
        for (const waiter of presentationWaiters) {
            window.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        presentationWaiters.clear();
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.citadels-app')?.classList.remove('is-presentation-playing');
    }

    function openRules(trigger) {
        rulesTrigger = trigger || document.activeElement;
        overlay.classList.remove('is-hidden');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('[data-ui="closeRules"]')?.focus();
    }

    function closeRules() {
        overlay.classList.add('is-hidden');
        overlay.setAttribute('aria-hidden', 'true');
        if (rulesTrigger?.isConnected) rulesTrigger.focus();
        rulesTrigger = null;
    }

    function onClick(event) {
        const skipButton = event.target.closest('[data-action="skipPresentation"]');
        if (skipButton) {
            stopPresentation();
            return;
        }
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            if (uiButton.dataset.ui === 'leave') leaveRoom?.();
            if (uiButton.dataset.ui === 'rules') openRules(uiButton);
            if (uiButton.dataset.ui === 'closeRules') closeRules();
            return;
        }
        if (event.target === overlay) {
            closeRules();
            return;
        }
        const actionButtonElement = event.target.closest('button[data-action]');
        if (!actionButtonElement || actionButtonElement.disabled) return;
        const kind = actionButtonElement.dataset.action;
        const value = actionButtonElement.dataset.value || mount.querySelector(`select[data-select-for="${kind}"]`)?.value;
        if (kind === 'prepareDecision') {
            const decisionKind = actionButtonElement.dataset.decisionKind;
            const decisionValue = actionButtonElement.dataset.value || mount.querySelector(`select[data-select-for="${decisionKind}"]`)?.value;
            if (decisionKind && decisionValue) {
                if (decisionKind === 'laboratory') pendingBuildId = null;
                pendingDecision = { kind: decisionKind, value: decisionValue };
                render();
            }
        } else if (kind === 'cancelDecision') {
            pendingDecision = null;
            render();
        } else if (kind === 'confirmDecision' && pendingDecision) {
            const decision = pendingDecision;
            pendingDecision = null;
            render();
            if (decision.kind === 'assassinate' || decision.kind === 'rob') sendAction({ kind: decision.kind, roleId: decision.value });
            else if (decision.kind === 'magicianExchange') sendAction({ kind: decision.kind, targetId: decision.value });
            else if (decision.kind === 'laboratory') sendAction({ kind: decision.kind, cardId: decision.value });
            else if (decision.kind === 'destroyDistrict') {
                const [targetId, cardId] = String(decision.value || '').split('::');
                if (targetId && cardId) sendAction({ kind: decision.kind, targetId, cardId });
            }
        } else if (kind === 'selectRole') {
            pendingRoleId = pendingRoleId === value && pendingRoleAction === actionButtonElement.dataset.roleAction ? null : value;
            pendingRoleAction = pendingRoleId ? actionButtonElement.dataset.roleAction : null;
            render();
        } else if (kind === 'confirmRole' && pendingRoleId && pendingRoleAction) {
            const roleId = pendingRoleId;
            const roleAction = pendingRoleAction;
            pendingRoleId = null;
            pendingRoleAction = null;
            render();
            sendAction({ kind: roleAction, roleId });
        }
        else if (kind === 'selectBuild') {
            pendingDecision = null;
            pendingBuildId = pendingBuildId === value ? null : value;
            render();
        } else if (kind === 'confirmBuild' && pendingBuildId) {
            const cardId = pendingBuildId;
            pendingBuildId = null;
            render();
            sendAction({ kind: 'buildDistrict', cardId });
        }
        else if (kind === 'keepDistrict') sendAction({ kind, cardIds: [value] });
        else if (kind === 'toggleKeep') { toggleSelection(value, state.myDrawKeepCount || 1); render(); }
        else if (kind === 'confirmKeep') sendAction({ kind: 'keepDistrict', cardIds: selectedCardIds });
        else if (kind === 'startSwap') { swapMode = true; selectedCardIds = []; render(); }
        else if (kind === 'toggleSwap') { toggleSelection(value, state.myHand?.length || 0); render(); }
        else if (kind === 'confirmSwap') sendAction({ kind: 'magicianSwap', cardIds: selectedCardIds });
        else sendAction({ kind });
    }

    function toggleSelection(id, limit) {
        if (!id) return;
        if (selectedCardIds.includes(id)) selectedCardIds = selectedCardIds.filter(item => item !== id);
        else if (selectedCardIds.length < limit) selectedCardIds.push(id);
    }

    function sendAction(action) {
        send({ type: 'gameAction', action });
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) closeRules();
        else if (event.key === 'Escape' && pendingDecision) { pendingDecision = null; render(); }
        else if (event.key === 'Escape' && presentationPlaying) stopPresentation();
    }

    mount.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);

    return {
        gameType: 'citadels',
        handleMessage(message) {
            if (message.state) {
                const firstState = !state;
                state = message.state;
                render();
                const sequence = Number(state.presentation?.sequence) || 0;
                if (firstState) lastPresentationSequence = sequence;
                else if (sequence > lastPresentationSequence) {
                    lastPresentationSequence = sequence;
                    enqueuePresentation(state.presentation);
                }
            }
            if (message.type === 'error') {
                addLog?.(message.message || '操作失败', 'error');
                if (state) render();
            }
        },
        destroy() {
            stopPresentation();
            mount.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeydown);
            document.body.classList.remove('is-citadels-view');
            rulesTrigger = null;
            style.remove();
            mount.innerHTML = '';
        },
    };
}
