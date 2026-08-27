const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const CARD_META = {
    accusation: { label: '指控', tone: 'red', copy: '增加 1 点指控' },
    evidence: { label: '证据', tone: 'red', copy: '增加 3 点指控' },
    witness: { label: '目击者', tone: 'red', copy: '增加 7 点指控' },
    alibi: { label: '不在场证明', tone: 'green', copy: '移除目标最近的 3 点指控' },
    arson: { label: '纵火', tone: 'green', copy: '烧掉目标全部手牌' },
    curse: { label: '诅咒', tone: 'green', copy: '移除目标面前一张蓝色牌' },
    robbery: { label: '抢劫', tone: 'green', copy: '把一名玩家的手牌交给另一名玩家' },
    scapegoat: { label: '替罪羊', tone: 'blue', copy: '把红牌与蓝牌转移给另一名玩家' },
    stocks: { label: '枷锁', tone: 'blue', copy: '目标下回合跳过行动' },
    asylum: { label: '避难所', tone: 'blue', copy: '目标免疫一次夜间击杀' },
    matchmaker: { label: '红娘', tone: 'blue', copy: '目标死亡时，红娘持有者一同出局' },
    piety: { label: '虔诚', tone: 'blue', copy: '目标免疫红色指控牌' },
    blackcat: { label: '黑猫', tone: 'blue', copy: '黑猫持有者成为白天首位行动者' },
    conspiracy: { label: '阴谋', tone: 'black', copy: '触发黑猫揭示与审判牌交换' },
    night: { label: '夜幕', tone: 'black', copy: '进入夜晚结算' },
};

const TRIAL_META = {
    town: { label: '镇民', chinese: '镇民', tone: 'town' },
    witch: { label: '女巫', chinese: '女巫', tone: 'witch' },
    constable: { label: '警长', chinese: '警长', tone: 'constable' },
};

const TOWN_HALL_ART_INDEX = {
    'mary-warren': 10, 'ann-putnam': 2, 'giles-corey': 12, 'abigail-williams': 13, 'will-griggs': 8,
    'sarah-good': 1, 'john-proctor': 9, 'samuel-parris': 4, 'rebecca-nurse': 6, 'martha-corey': 11,
    'thomas-danforth': 0, 'william-phips': 3, 'george-burroughs': 7, tituba: 5, 'cotton-mather': 14,
};
const CARD_SIGILS = { accusation: 'Ⅰ', evidence: 'Ⅲ', witness: 'Ⅶ', alibi: 'A', arson: '火', curse: '咒', robbery: '取', scapegoat: '替', stocks: '枷', asylum: '庇', matchmaker: '缘', piety: '祷', blackcat: '猫', conspiracy: '谋', night: '夜' };

function deckCardMeta(cardId) {
    const kind = String(cardId || '').replace(/^salem-/, '').replace(/-\d+$/, '');
    return CARD_META[kind] || { label: '未知牌', tone: 'black' };
}

function townHallArtStyle(hall) {
    const index = TOWN_HALL_ART_INDEX[hall?.id] ?? 0;
    return `--hall-x:${(index % 5) * 25}%;--hall-y:${Math.floor(index / 5) * 50}%`;
}

const factionLabel = faction => faction === 'witch' ? '女巫阵营' : '镇民阵营';

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/witchtown/style.css?v=20260827-hidden-role-focus-1';
    document.head.appendChild(style);
    const focusStyle = document.createElement('link');
    focusStyle.rel = 'stylesheet';
    focusStyle.href = '/games/common/hidden-role-focus.css?v=20260827-hidden-role-focus-1';
    document.head.appendChild(focusStyle);
    document.body.classList.add('is-witchtown-view');

    mount.innerHTML = `
        <section class="witchtown-app">
            <header class="witchtown-topbar">

                <div class="witchtown-brand">
                    <span class="witchtown-brand-mark" aria-hidden="true"><i></i><b></b></span>
                    <div><span class="witchtown-eyebrow">塞勒姆审判</span><h1>猎巫镇</h1><p>传言会死，证词会说谎</p></div>
                </div>
                <div class="witchtown-top-stats" aria-label="牌局信息">
                    <div class="witchtown-stat"><span>周期</span><strong data-role="cycle">—</strong></div>
                    <div class="witchtown-stat"><span>阶段</span><strong data-role="phase">—</strong></div>
                    <div class="witchtown-stat"><span>牌库</span><strong data-role="deck">—</strong></div>
                    <div class="witchtown-stat witchtown-stat-turn"><span>当前行动</span><strong data-role="current">—</strong></div>
                </div>
                <div class="witchtown-header-actions">
                    <span class="witchtown-room" data-role="room">猎巫镇</span>
                    <button class="witchtown-quiet-button" data-ui="rules" type="button">规则</button>
                </div>
            </header>

            <main class="witchtown-shell">
                <section class="witchtown-command" aria-live="polite">
                    <div class="witchtown-command-head">
                        <div><span class="witchtown-kicker" data-role="command-kicker">牌局状态</span><h2 data-role="command-title">等待牌局状态</h2><p data-role="command-copy">连接到房间后，当前阶段与可用行动会显示在这里。</p></div>
                        <span class="witchtown-status-badge" data-role="command-status">等待中</span>
                    </div>
                    <div class="witchtown-command-body" data-role="command-body"></div>
                    <div class="witchtown-command-footer"><span data-role="judge-footer"></span><span data-role="command-footer"></span></div>
                </section>

                <div class="witchtown-workspace">
                    <section class="witchtown-panel witchtown-table-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">公开审判席</span><h2>镇民与嫌疑人</h2></div><div class="witchtown-section-meta" data-role="table-summary">—</div></div>
                        <div class="witchtown-tribunal-line" aria-hidden="true"><span></span><i></i><span></span></div>
                        <div class="witchtown-player-grid" data-role="table"></div>
                    </section>

                    <aside class="witchtown-panel witchtown-private-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">密封档案</span><h2>我的审判牌</h2></div><span class="witchtown-private-mark">本人私密</span></div>
                        <div data-role="private"></div>
                    </aside>

                    <aside class="witchtown-panel witchtown-role-panel social-role-focus">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">公开身份牌</span><h2>我的镇议会角色</h2></div><span class="witchtown-public-mark">全员可见</span></div>
                        <div data-role="public-role"></div>
                    </aside>

                    <section class="witchtown-panel witchtown-hand-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">证词与行动牌</span><h2>我的手牌</h2></div><div class="witchtown-section-meta" data-role="hand-summary">—</div></div>
                        <div data-role="hand"></div>
                    </section>

                    <aside class="witchtown-panel witchtown-players-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">公开名册</span><h2>镇民状态</h2></div></div>
                        <div class="witchtown-ledger" data-role="players"></div>
                    </aside>

                    <aside class="witchtown-panel witchtown-log-panel">
                        <div class="witchtown-section-heading"><div><span class="witchtown-kicker">审判记录</span><h2>事件记录</h2></div></div>
                        <div class="witchtown-log" data-role="log"></div>
                    </aside>
                </div>
            </main>

            <footer class="witchtown-footer"><span data-role="hint">等待牌局状态</span><span>房间 <b data-role="footer-room">—</b></span></footer>

            <div class="witchtown-overlay is-hidden" data-role="overlay" aria-hidden="true">
                <article class="witchtown-rules" role="dialog" aria-modal="true" aria-labelledby="witchtown-rules-title" tabindex="-1">
                    <button class="witchtown-modal-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                    <span class="witchtown-kicker">玩法说明 · 塞勒姆审判</span>
                    <h2 id="witchtown-rules-title">猎巫镇标准版</h2>
                    <p class="witchtown-rules-lead">每位玩家拥有公开的镇议会角色牌和面朝下的审判牌。任何曾经持有女巫牌的人，始终属于女巫阵营。</p>
                    <div class="witchtown-rules-grid">
                        <section><b>01 · 核对档案</b><p>所有玩家先秘密查看并确认审判档案。阴谋交换后，所有存活玩家还要重新核对。</p></section>
                        <section><b>02 · 黎明</b><p>女巫阵营秘密选择黑猫持有者。黑猫持有者成为白天首位行动者。</p></section>
                        <section><b>03 · 白天</b><p>当前玩家摸两张牌结束回合，或至少打出一张牌后结束行动。讨论始终在线下自由进行。</p></section>
                        <section><b>04 · 指控</b><p>指控 1 点、证据 3 点、目击者 7 点。通常累计到 7 点时揭示一张审判牌，George Burroughs 需要 8 点。</p></section>
                        <section><b>05 · 三种颜色</b><p>红色牌累计指控；绿色牌结算后弃置；蓝色牌留在目标面前并持续生效。</p></section>
                        <section><b>06 · 阴谋</b><p>揭示黑猫持有者的一张牌后，所有存活玩家秘密交换审判牌；完成后重新核对整份档案。</p></section>
                        <section><b>07 · 夜幕</b><p>女巫、警长依次行动，随后每名存活玩家选择认罪或沉默；全部完成后自动天亮，无需主持人。</p></section>
                    </div>
                    <div class="witchtown-rules-win"><strong>胜利条件</strong><span>所有女巫审判牌揭示，镇民胜；所有存活者都曾持有女巫牌，女巫胜。</span></div>
                    <p class="witchtown-rules-note">本版本实现标准版 59 张塞勒姆牌和 15 张镇议会角色牌；豪华版特殊审判牌及 2–3 人变体暂不启用。</p>
                </article>
            </div>
            <div class="witchtown-scene is-hidden" data-role="scene" aria-hidden="true">
                <div class="witchtown-scene-wash" aria-hidden="true"></div>
                <div class="witchtown-scene-fragments" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--fragment-x:${12 + index * 4.25}%;--fragment-y:${40 + (index - 9) * 1.35}%;--fragment-delay:${index * 12}ms;--fragment-width:${5 + index * .5}px;--fragment-height:${3 + index * .28}px;--wind-x:${20 + index * .5}vw;--wind-y:${-45 + index * 5}px;--wind-spin:${80 + index * 19}deg;--shard-width:${30 + index * 4}px;--shard-height:${70 + index * 5}px;--shard-x:${(index - 9) * 22}px;--shard-y:${240 + index * 5}px;--shard-spin:${index * 31}deg"></i>`).join('')}</div>
                <div class="witchtown-scene-copy">
                    <span data-role="scene-kicker"></span>
                    <h2 data-role="scene-title"></h2>
                    <p data-role="scene-detail"></p>
                    <button class="witchtown-scene-continue" data-ui="sceneContinue" type="button">查看后续审判</button>
                </div>
            </div>
        </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = $('overlay');
    const scene = $('scene');
    let state = null;
    let pendingCardId = null;
    let deckOrderDraft = null;
    let dossierOpen = false;
    let dossierSealTimer = null;
    const selectDraft = new Map();
    let sceneTimer = null;
    let scenePlaying = false;
    const sceneQueue = [];
    let rulesTrigger = null;
    let rulesScrollY = 0;

    const actionButton = (label, action, value = '', className = '', disabled = false) => `<button class="witchtown-button ${className}" data-action="${escapeHtml(action)}" data-value="${escapeHtml(value)}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</button>`;
    const playerById = id => (state?.players || []).find(player => player.id === id);

    function alivePlayers(includeSelf = false) {
        return (state?.players || []).filter(player => !player.eliminated && (includeSelf || player.id !== state.myId));
    }

    function targetOptions(includeSelf = false, excludedIds = []) {
        const excluded = new Set(excludedIds.filter(Boolean));
        return alivePlayers(includeSelf).filter(player => !excluded.has(player.id)).map(player => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</option>`).join('');
    }

    function trialOptions(cards = []) {
        return cards.map((card, index) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.label || `审判牌 ${index + 1}`)}</option>`).join('');
    }

    function blueCardOptions(targetId) {
        const target = playerById(targetId);
        return (target?.blueCards || []).map(card => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)}</option>`).join('');
    }

    function phaseMeta() {
        if (!state) return { kicker: '牌局状态', title: '等待牌局状态', copy: '连接到房间后，当前阶段与可用行动会显示在这里。' };
        if (state.status === 'ended') {
            const winner = state.winner?.name || '本局';
            return { kicker: '最终判决', title: `${winner}获胜`, copy: state.judgeMessage || '牌局已经结束，最终阵营已经公开。' };
        }
        if (state.phase === 'dossier_review') {
            const isOpening = state.dossierReviewReason === 'opening';
            return { kicker: isOpening ? '审判开始前 · 私密核对' : '阴谋过后 · 档案易手', title: isOpening ? '请核对你的审判档案' : '请重新核对审判档案', copy: state.judgeMessage || '打开密封档案，确认自己的审判牌与当前职责。' };
        }
        if (state.phase === 'dawn') return { kicker: '黎明 · 秘密投票', title: '黎明：黑猫归属', copy: state.judgeMessage || '女巫阵营正在选择黑猫持有者。' };
        if (state.phase === 'conspiracy_reveal') return { kicker: '阴谋 · 揭示', title: '阴谋：揭示黑猫审判牌', copy: state.judgeMessage || '阴谋触发，等待指定玩家揭示一张牌。' };
        if (state.phase === 'conspiracy') return { kicker: '阴谋 · 交换', title: '阴谋：顺时针交换', copy: state.judgeMessage || '所有存活玩家从左手玩家处秘密交换一张牌。' };
        if (state.phase === 'night') {
            const step = { witches: ['女巫行动', '黑暗中的低语'], constable: ['警长行动', '法槌落下之前'], confession: ['认罪时刻', '晨钟响起之前'] }[state.nightStep] || ['秘密行动', '夜幕笼罩塞勒姆'];
            return { kicker: `第 ${state.night || 1} 夜 · ${step[0]}`, title: step[1], copy: state.judgeMessage || '夜间行动正在等待提交。' };
        }
        return { kicker: `第 ${state.day || 1} 天 · 公开行动`, title: `第 ${state.day || 1} 天 · ${state.currentTurnName || '白天行动'}`, copy: state.judgeMessage || '当前玩家正在行动。' };
    }

    function render() {
        if (!state) return;
        const meta = phaseMeta();
        const actions = state.availableActions || {};
        if (!actions.playCard || !(state.myHand || []).some(card => card.id === pendingCardId)) pendingCardId = null;
        if (!actions.reorderDeck) deckOrderDraft = null;
        else if (!deckOrderDraft || deckOrderDraft.length !== (state.deckOrder || []).length || deckOrderDraft.some(id => !(state.deckOrder || []).includes(id))) deckOrderDraft = (state.deckOrder || []).slice();
        const app = mount.querySelector('.witchtown-app');
        app.classList.toggle('is-night-phase', state.phase === 'night' || state.phase === 'dawn');
        app.classList.toggle('is-day-phase', state.phase === 'day');
        app.classList.toggle('is-conspiracy-phase', ['conspiracy_reveal', 'conspiracy', 'dossier_review'].includes(state.phase) && state.dossierReviewReason !== 'opening');
        app.classList.toggle('is-my-action', hasMyAction(actions));
        app.dataset.phase = state.phase || 'waiting';
        $('room').textContent = state.roomId ? `房间 ${state.roomId}` : '猎巫镇';
        $('footer-room').textContent = state.roomId || '—';
        $('cycle').textContent = state.status === 'ended' ? '终局' : state.phase === 'night' ? `第${state.night || 1}夜` : `第${state.day || 1}天`;
        $('phase').textContent = state.status === 'ended' ? '结算' : ({ dossier_review: '核对档案', dawn: '黎明', conspiracy_reveal: '揭示', conspiracy: '交换', day: '白天', night: '夜晚' }[state.phase] || state.phase);
        $('deck').textContent = `${state.deckCount ?? 0} 张`;
        $('current').textContent = state.status === 'ended' ? '已结束' : state.phase === 'dossier_review' ? '全员核对' : state.currentTurnName || '等待';
        $('command-kicker').textContent = meta.kicker;
        $('command-title').textContent = meta.title;
        $('command-copy').textContent = meta.copy;
        $('command-status').textContent = state.status === 'ended' ? '已结算' : state.phase === 'dossier_review' && state.dossierConfirmed ? '已确认' : hasMyAction(actions) ? '轮到我' : '等待中';
        $('command-status').className = `witchtown-status-badge ${state.status === 'ended' ? 'is-ended' : hasMyAction(actions) ? 'is-mine' : ''}`;
        $('judge-footer').textContent = state.status === 'ended' ? '最终判决已记录' : state.judgeMessage || '';
        $('command-footer').textContent = state.status === 'ended' ? '最终阵营已公开' : state.phase === 'dossier_review' ? `${state.dossierProgress?.confirmed || 0} / ${state.dossierProgress?.required || 0} 人已确认` : state.phase === 'night' ? state.nightProgress?.sealed ? '秘密决定正在封存' : `${state.nightProgress?.completed || 0} / ${state.nightProgress?.required || 0} 项决定已完成` : `${state.deckCount ?? 0} 张牌留在牌库`;
        renderCommand();
        renderTable();
        renderPrivate();
        renderPublicRole();
        renderHand();
        renderPlayers();
        renderLog();
        $('hint').textContent = state.status === 'ended' ? '本局已结束 · 牌局档案已封存' : state.judgeMessage || '等待牌局状态';
    }

    function hasMyAction(actions) {
        return Object.values(actions).some(Boolean);
    }

    function captureSelectDraft() {
        $('command-body')?.querySelectorAll('select[data-select-for]').forEach(select => selectDraft.set(select.dataset.selectFor, select.value));
    }

    function setCommandMarkup(body, markup) {
        body.innerHTML = markup;
        body.querySelectorAll('select[data-select-for]').forEach(select => {
            const draft = selectDraft.get(select.dataset.selectFor);
            if (draft && [...select.options].some(option => option.value === draft)) select.value = draft;
            selectDraft.set(select.dataset.selectFor, select.value);
        });
        updatePlayConfirmText();
    }

    function selectedHandCard() {
        return (state?.myHand || []).find(card => card.id === pendingCardId) || null;
    }

    function renderDayTargetSelectors() {
        const selected = selectedHandCard();
        if (!selected) return '<div class="witchtown-target-prompt"><b>先从手牌中预选一张牌</b><small>选择牌后，这里只显示该牌真正需要的目标。</small></div>';
        const primaryId = selectDraft.get('playCard') || alivePlayers(false)[0]?.id || '';
        const fields = [`<label class="witchtown-select"><span>目标</span><select data-select-for="playCard">${targetOptions(false)}</select></label>`];
        if (['robbery', 'scapegoat'].includes(selected.kind)) fields.push(`<label class="witchtown-select"><span>接收者</span><select data-select-for="playCard2">${targetOptions(false, [primaryId])}</select></label>`);
        if (selected.kind === 'curse') {
            const blueOptions = blueCardOptions(primaryId);
            fields.push(`<label class="witchtown-select witchtown-blue-target"><span>移除目标的持续牌</span><select data-select-for="curseBlue"${blueOptions ? '' : ' disabled'}>${blueOptions || '<option value="">目标没有持续牌</option>'}</select></label>`);
        }
        return `<div class="witchtown-targets" data-card-kind="${escapeHtml(selected.kind)}">${fields.join('')}</div>`;
    }

    function renderCommand() {
        const body = $('command-body');
        const actions = state.availableActions || {};
        captureSelectDraft();
        if (state.status === 'ended') {
            const winner = state.winner?.name || '本局';
            setCommandMarkup(body, `<div class="witchtown-verdict"><span class="witchtown-verdict-mark">裁</span><div><strong>${escapeHtml(winner)}获胜</strong><small>${escapeHtml(state.judgeMessage || '最终阵营已经公开。')}</small></div></div><div class="witchtown-final-list">${(state.players || []).map(player => `<span><b>${escapeHtml(player.name)}</b><em>${escapeHtml(player.identity?.name || '身份已公开')}</em></span>`).join('')}</div>`);
            return;
        }

        if (state.phase === 'dossier_review') {
            const progress = state.dossierProgress || { confirmed: 0, required: 0 };
            setCommandMarkup(body, state.dossierConfirmed
                ? waitingMarkup('你的档案已经重新封存', `已有 ${progress.confirmed}/${progress.required} 名玩家完成核对。`)
                : `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon is-paper">档</span><div><b>${state.dossierReviewReason === 'opening' ? '打开密封档案' : '审判牌已经易手'}</b><small>先在“我的审判牌”区域核对完整档案，再确认你已记住当前阵营与职责。</small></div></div><div class="witchtown-day-buttons">${actionButton(dossierOpen ? '档案已打开' : '打开我的档案', 'openDossier', '', 'is-paper')}</div></div>`);
            return;
        }

        if (state.phase === 'dawn') {
            setCommandMarkup(body, actions.chooseBlackCat
                ? `<div class="witchtown-action-card is-dawn"><div class="witchtown-action-head"><span class="witchtown-action-icon">巫</span><div><b>选择黑猫持有者</b><small>女巫阵营的选择完成后，黑猫持有者先手。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>黑猫交给</span><select data-select-for="chooseBlackCat">${targetOptions(true)}</select></label>${actionButton('确认选择', 'chooseBlackCat', '', 'is-primary')}</div></div>`
                : waitingMarkup('女巫阵营正在秘密投票', '等待所有女巫完成黑猫选择。'));
            return;
        }

        if (state.phase === 'conspiracy_reveal') {
            setCommandMarkup(body, actions.revealConspiracyTrial
                ? `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon">谋</span><div><b>揭示黑猫的一张审判牌</b><small>确认后，揭晓的审判牌会出现在所有人的公开审判席。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>选择牌</span><select data-select-for="revealConspiracyTrial">${trialOptions((state.conspiracyRevealOptions || []).map((card, index) => ({ ...card, label: `黑猫审判牌 ${index + 1}` })))}</select></label>${actionButton('揭示', 'revealConspiracyTrial', '', 'is-primary')}</div></div>`
                : waitingMarkup('阴谋正在揭示黑猫审判牌', '等待抽到阴谋牌的玩家完成选择。'));
            return;
        }

        if (state.phase === 'conspiracy') {
            setCommandMarkup(body, actions.passTrial
                ? `<div class="witchtown-action-card is-conspiracy"><div class="witchtown-action-head"><span class="witchtown-action-icon">换</span><div><b>从左手玩家处取一张牌</b><small>只显示牌的数量，不会公开左手玩家的身份类型。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>取走哪张</span><select data-select-for="passTrial">${trialOptions((state.conspiracyOptions || []).map((card, index) => ({ ...card, label: `左手审判牌 ${index + 1}` })))}</select></label>${actionButton('确认取牌', 'passTrial', '', 'is-primary')}</div></div>`
                : waitingMarkup('阴谋交换进行中', '所有存活玩家按座位顺序秘密取牌。'));
            return;
        }

        if (state.phase === 'night') {
            const parts = [];
            if (actions.nightKill) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-rose">巫</span><div><b>决定今晚的目标</b><small>选择目标并核对后封存决定。所有女巫完成后，夜晚会自动继续。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>今晚的目标</span><select data-select-for="nightKill">${targetOptions(true)}</select></label>${actionButton('确认并封存', 'nightKill', '', 'is-danger')}</div>`);
            if (actions.nightProtect) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-blue">槌</span><div><b>决定法槌的守护位置</b><small>选择一名其他存活玩家。确认后将立即进入认罪时刻。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>法槌守护</span><select data-select-for="nightProtect">${targetOptions(false)}</select></label>${actionButton('确认并封存', 'nightProtect', '', 'is-blue')}</div>`);
            if (actions.confess) parts.push(`<div class="witchtown-action-head"><span class="witchtown-action-icon is-paper">认</span><div><b>是否在晨钟前认罪？</b><small>认罪会公开一张镇民或女巫审判牌，并使你免受本夜袭击。</small></div></div><div class="witchtown-action-row"><label class="witchtown-select"><span>公开审判牌</span><select data-select-for="confess">${trialOptions((state.myTrialCards || []).filter(card => !card.revealed && ['town', 'witch'].includes(card.type)).map((card, index) => ({ ...card, label: `${TRIAL_META[card.type]?.chinese || '审判'}牌 ${index + 1}` })))}</select></label>${actionButton('确认认罪', 'confess', '', 'is-paper')}</div>`);
            if (actions.confessFree) parts.push(`<div class="witchtown-special-choice"><span><b>William Phips</b><small>你本局可以有一次不公开审判牌的认罪。</small></span>${actionButton('使用能力认罪', 'confessFree', '', 'is-violet')}</div>`);
            if (actions.passConfession) parts.push(`<div class="witchtown-special-choice"><span><b>保持沉默</b><small>不会公开审判牌，也不会获得本夜免疫。</small></span>${actionButton('确认保持沉默', 'passConfession')}</div>`);
            const waitCopy = state.nightStep === 'witches' ? '女巫正在黑暗中作出决定。' : state.nightStep === 'constable' ? '警长正在放置法槌。' : '等待其他存活玩家完成认罪决定。';
            setCommandMarkup(body, parts.length ? `<div class="witchtown-action-card is-night">${parts.join('<hr>')}</div>` : waitingMarkup('夜幕中的秘密行动', waitCopy));
            return;
        }

        const selectors = actions.playCard ? renderDayTargetSelectors() : '';
        const dayButtons = [];
        if (actions.drawCards) dayButtons.push(actionButton('摸两张并结束', 'drawCards', '', 'is-primary'));
        if (actions.drawDiscard) dayButtons.push(actionButton('从弃牌堆摸两张', 'drawDiscard', '', 'is-blue'));
        if (actions.reorderDeck) dayButtons.push(actionButton('打开牌库顺序', 'toggleDeckOrder', '', 'is-violet'));
        if (actions.endTurn) dayButtons.push(actionButton('结束行动', 'endTurn', '', 'is-primary'));
        setCommandMarkup(body, actions.playCard || dayButtons.length
            ? `<div class="witchtown-action-card is-day">${actions.playCard ? `<div class="witchtown-action-head"><span class="witchtown-action-icon is-red">牌</span><div><b>白天行动</b><small>先选定下方手牌，再核对目标并确认打出。一回合可以连续打出多张牌。</small></div></div>${selectors}` : ''}${dayButtons.length ? `<div class="witchtown-day-buttons">${dayButtons.join('')}</div>` : ''}${actions.reorderDeck ? renderDeckOrder() : ''}</div>`
            : waitingMarkup(`${escapeHtml(state.currentTurnName || '其他玩家')} 正在行动`, '你可以查看自己的档案与手牌，轮到你时操作台会更新。'));
    }

    function waitingMarkup(title, copy) {
        return `<div class="witchtown-waiting"><span class="witchtown-waiting-dot"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div></div>`;
    }

    function renderDeckOrder() {
        if (!deckOrderDraft) return '';
        const visualOrder = deckOrderDraft.slice().reverse();
        const rows = visualOrder.map((id, index) => {
            const meta = deckCardMeta(id);
            return `<li class="witchtown-deck-row is-${escapeHtml(meta.tone)}"><span><i>${index + 1}</i><b>${escapeHtml(meta.label)}</b><small>${index === 0 ? '最先抽到' : `第 ${index + 1} 张`}</small></span><span><button type="button" data-action="moveDeckCard" data-value="${escapeHtml(id)}" data-direction="up"${index === 0 ? ' disabled' : ''} aria-label="向上移动">↑</button><button type="button" data-action="moveDeckCard" data-value="${escapeHtml(id)}" data-direction="down"${index === visualOrder.length - 1 ? ' disabled' : ''} aria-label="向下移动">↓</button></span></li>`;
        }).join('');
        return `<details class="witchtown-deck-order"><summary>排列牌库 <small>顶部在前 · 共 ${visualOrder.length} 张</small></summary><p>只有确认后才会提交新顺序。牌面来自你的角色能力所允许查看的牌库。</p><ol>${rows}</ol><div class="witchtown-deck-confirm">${actionButton('恢复原顺序', 'resetDeckOrder')}${actionButton('确认新顺序', 'confirmDeckOrder', '', 'is-violet')}</div></details>`;
    }

    function renderTable() {
        $('table-summary').textContent = `${(state.players || []).filter(player => !player.eliminated).length} 名存活 · ${state.players?.length || 0} 个席位`;
        $('table').innerHTML = (state.players || []).map(player => {
            const isCurrent = player.id === state.currentTurnId && state.status !== 'ended';
            const isMe = player.id === state.myId;
            const identity = player.identity ? `<span class="witchtown-identity-chip ${player.identity.faction === 'witch' ? 'is-witch' : 'is-town'}">${escapeHtml(player.identity.name)}</span>` : player.eliminated ? '<span class="witchtown-identity-chip is-dead">已出局</span>' : '<span class="witchtown-identity-chip is-hidden">身份隐藏</span>';
            const blue = (player.blueCards || []).map(card => `<span class="witchtown-blue-chip">${escapeHtml(card.name)}</span>`).join('');
            const red = (player.redCards || []).map(card => `<span class="witchtown-red-chip">${escapeHtml(card.name)}${card.value ? ` ${escapeHtml(card.value)}` : ''}</span>`).join('');
            const exposed = (player.exposedHandCards || []).map(card => `<span class="witchtown-exposed-chip">公开手牌 · ${escapeHtml(card.name)}</span>`).join('');
            const revealedTrials = (player.revealedTrialCards || []).map(card => `<span class="witchtown-revealed-trial is-${escapeHtml(TRIAL_META[card.type]?.tone || 'town')}">${escapeHtml(TRIAL_META[card.type]?.chinese || '审判')}</span>`).join('');
            const health = Array.from({ length: 3 }, (_, index) => `<i class="${index < (player.health || 0) ? 'is-full' : ''}"></i>`).join('');
            const threshold = player.townHall?.id === 'george-burroughs' ? 8 : 7;
            const accusation = Math.min(threshold, player.redAccusations || 0);
            return `<article class="witchtown-seat ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${player.eliminated ? 'is-dead' : ''}"><div class="witchtown-seat-portrait"><span class="witchtown-seat-art" style="${townHallArtStyle(player.townHall)}" aria-hidden="true"></span><i>${String(player.seat || 0).padStart(2, '0')}</i>${player.id === state.blackCatOwnerId ? '<b class="witchtown-cat-mark" title="黑猫持有者">猫</b>' : ''}</div><div class="witchtown-seat-file"><header><div class="witchtown-seat-name"><strong>${escapeHtml(player.name)}${isMe ? '<em>我</em>' : ''}</strong><small>${isCurrent ? '正在受审' : player.eliminated ? '已离席' : player.isOnline === false ? '离线' : '等待证词'}</small></div>${identity}</header><div class="witchtown-seat-role" title="${escapeHtml(player.townHall?.description || '')}"><span>${escapeHtml(player.townHall?.name || '镇议会角色')}</span><b>${player.revealedTrialCount || 0} / ${player.trialCount || 0} 已揭示</b></div><div class="witchtown-public-trials">${revealedTrials || '<span>尚无公开审判牌</span>'}</div><div class="witchtown-accusation-line" style="--progress:${(accusation / threshold) * 100}%"><span><i></i></span><b>${player.redAccusations || 0}<small> / ${threshold} 指控</small></b></div><div class="witchtown-public-cards">${red}${blue}${exposed || ''}${!red && !blue && !exposed ? '<span class="witchtown-empty-chip">暂无公开附牌</span>' : ''}</div><div class="witchtown-seat-metrics"><span><span class="witchtown-health">${health}</span><small>生命</small></span><span><b>${player.trialCount || 0}</b><small>审判牌</small></span></div></div></article>`;
        }).join('');
    }

    function renderPrivate() {
        const me = state.myIdentity;
        const trialCards = (state.myTrialCards || []).map((card, index) => {
            const meta = TRIAL_META[card.type] || { label: '审判', chinese: '审判', tone: 'town' };
            const seal = card.type === 'witch' ? '巫' : card.type === 'constable' ? '槌' : '镇';
            return `<article class="witchtown-trial-card is-${escapeHtml(meta.tone)} ${card.revealed ? 'is-revealed' : 'is-secret'}"><span>${String(index + 1).padStart(2, '0')}</span><i aria-hidden="true">${seal}</i><strong>${escapeHtml(meta.label)}</strong><small>${card.revealed ? '已揭示' : '未揭示'}</small></article>`;
        }).join('');
        const witches = state.knownWitches?.length ? `<div class="witchtown-known"><span>同阵营玩家</span><strong>${state.knownWitches.map(player => escapeHtml(player.name)).join('、')}</strong></div>` : '';
        const info = state.myInfo ? `<div class="witchtown-info"><span>最近调查</span><strong>${escapeHtml(state.myInfo.targetName || '目标')} · ${state.myInfo.type === 'witch' ? '女巫牌持有者' : '非女巫'}</strong></div>` : '';
        const showDossier = dossierOpen || state.status === 'ended';
        const reviewCopy = state.phase === 'dossier_review'
            ? state.dossierConfirmed ? '你已完成本轮核对，可随时再次打开查看。' : '核对全部审判牌后，请在档案内确认。'
            : '审判期间可以随时秘密查看，查看后请重新封存。';
        const controls = `<div class="witchtown-dossier-actions">${state.status === 'ended' ? '' : actionButton('重新封存', 'closeDossier')}${state.availableActions?.confirmDossier ? actionButton('我已核对档案', 'confirmDossier', '', 'is-primary') : ''}</div>`;
        const dossier = showDossier
            ? `<section class="witchtown-dossier is-open"><div class="witchtown-dossier-ribbon"><span>私密审判档案</span><small>${escapeHtml(reviewCopy)}</small></div><div class="witchtown-faction ${me?.faction === 'witch' ? 'is-witch' : 'is-town'}"><span>当前阵营</span><strong>${escapeHtml(factionLabel(me?.faction))}</strong><small>${escapeHtml(me?.description || '你的身份信息会随牌局进程更新。')}</small></div><div class="witchtown-private-block"><div class="witchtown-private-heading"><span>审判牌</span><small>仅本人可见</small></div><div class="witchtown-trial-grid">${trialCards || '<span class="witchtown-muted">尚未发牌</span>'}</div></div>${witches}${info}${controls}</section>`
            : `<button class="witchtown-dossier-cover" data-action="openDossier" type="button"><span>SALEM · 1692</span><i aria-hidden="true">审</i><strong>密封审判档案</strong><small>${escapeHtml(reviewCopy)}</small><b>${state.dossierConfirmed ? '本轮已核对' : '点击秘密查看'}</b></button>`;
        $('private').innerHTML = dossier;
    }

    function renderPublicRole() {
        const hall = state.myTownHall;
        $('public-role').innerHTML = hall
            ? `<div class="witchtown-hall"><span class="witchtown-hall-art social-role-focus-art" style="${townHallArtStyle(hall)}" aria-hidden="true"></span><div><strong>${escapeHtml(hall.name)}</strong><p>${escapeHtml(hall.description)}</p><small>镇议会角色从开局起始终公开，不属于密封档案。</small></div></div>`
            : '<span class="witchtown-muted">尚未发放镇议会角色。</span>';
    }

    function clearDossierSealTimer() {
        clearTimeout(dossierSealTimer);
        dossierSealTimer = null;
    }

    function scheduleDossierSeal() {
        clearDossierSealTimer();
        if (state?.status !== 'ended') dossierSealTimer = window.setTimeout(() => sealDossier(), 45000);
    }

    function sealDossier() {
        if (!dossierOpen || state?.status === 'ended') return;
        dossierOpen = false;
        clearDossierSealTimer();
        renderPrivate();
        if (state.phase === 'dossier_review') renderCommand();
    }

    function cardMarkup(card, canPlay) {
        const meta = CARD_META[card.kind] || { label: card.name || '游戏牌', tone: 'black', copy: '特殊游戏牌' };
        const cardType = { red: '指控牌', green: '行动牌', blue: '持续牌', black: '事件牌' }[meta.tone] || '游戏牌';
        const sigil = CARD_SIGILS[card.kind] || '◆';
        const selected = pendingCardId === card.id;
        const button = canPlay ? actionButton(selected ? '已预选' : '预选此牌', 'selectCard', card.id, `is-card-action ${selected ? 'is-selected' : ''}`) : '';
        return `<article class="witchtown-card is-${escapeHtml(meta.tone)} is-kind-${escapeHtml(card.kind)} ${selected ? 'is-selected' : ''}"><div class="witchtown-card-top"><span>${cardType}</span>${card.value ? `<b>${escapeHtml(card.value)} 点</b>` : '<b>·</b>'}</div><div class="witchtown-card-main"><span class="witchtown-card-scene" aria-hidden="true"><i>${sigil}</i></span><strong>${escapeHtml(meta.label || card.name)}</strong><small>${escapeHtml(meta.copy)}</small></div>${button ? `<div class="witchtown-card-action">${button}</div>` : ''}</article>`;
    }

    function renderHand() {
        const canPlay = state.phase === 'day' && Boolean(state.availableActions?.playCard);
        const cards = (state.myHand || []).map(card => cardMarkup(card, canPlay)).join('');
        $('hand-summary').textContent = `${state.myHand?.length || 0} 张 · ${canPlay ? '可行动' : '等待行动'}`;
        const selected = (state.myHand || []).find(card => card.id === pendingCardId);
        const selectedMeta = selected ? CARD_META[selected.kind] || { label: selected.name || '游戏牌' } : null;
        const draftReady = selected ? isPlayDraftValid(selected) : false;
        const confirm = selected ? `<div class="witchtown-card-confirm"><span class="witchtown-confirm-seal">审</span><div><small>待提交证词</small><strong>${escapeHtml(selectedMeta.label)}</strong><p data-role="play-confirm-target">正在核对目标……</p></div>${actionButton(draftReady ? '确认打出' : '请补全目标', 'confirmPlay', selected.id, 'is-danger', !draftReady)}</div>` : '';
        $('hand').innerHTML = `<div class="witchtown-hand-note"><span class="witchtown-hand-lock">${canPlay ? '行动中' : '私密手牌'}</span><small>${canPlay ? '点选手牌后，在确认条核对目标' : '手牌内容不会公开给其他玩家'}</small></div><div class="witchtown-card-grid">${cards || '<div class="witchtown-empty-hand">手牌暂为空</div>'}</div>${confirm}`;
        updatePlayConfirmText();
    }

    function isPlayDraftValid(card = selectedHandCard()) {
        if (!card || !playerById(readSelect('playCard'))) return false;
        if (['robbery', 'scapegoat'].includes(card.kind)) {
            const second = readSelect('playCard2');
            if (!playerById(second) || second === readSelect('playCard')) return false;
        }
        if (card.kind === 'curse') {
            const target = playerById(readSelect('playCard'));
            if (!(target?.blueCards || []).some(item => item.id === readSelect('curseBlue'))) return false;
        }
        return true;
    }

    function updatePlayConfirmText() {
        const target = mount.querySelector('[data-role="play-confirm-target"]');
        if (!target || !state) return;
        const card = selectedHandCard();
        const primary = playerById(readSelect('playCard'))?.name || '未选择';
        const secondary = playerById(readSelect('playCard2'))?.name;
        const blue = playerById(readSelect('playCard'))?.blueCards?.find(item => item.id === readSelect('curseBlue'))?.name;
        target.textContent = `目标：${primary}${card && ['robbery', 'scapegoat'].includes(card.kind) ? ` · 接收者：${secondary || '未选择'}` : ''}${card?.kind === 'curse' ? ` · 持续牌：${blue || '未选择'}` : ''}`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map(player => `<article class="witchtown-ledger-row ${player.id === state.currentTurnId ? 'is-current' : ''} ${player.eliminated ? 'is-dead' : ''}"><span class="witchtown-ledger-avatar">${escapeHtml(String(player.name || '?').slice(0, 1))}</span><div><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${player.eliminated ? '已出局' : `${escapeHtml(player.townHall?.name || '镇议会角色')} · ${player.revealedTrialCount || 0}/${player.trialCount || 0}`}</small></div><b>${player.blueCards?.length || 0}<small> 蓝牌</small></b></article>`).join('');
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="witchtown-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<span class="witchtown-muted">牌局开始后，事件会记录在这里。</span>';
    }

    function readSelect(action) {
        return mount.querySelector(`select[data-select-for="${action}"]`)?.value || '';
    }

    function sendAction(kind, value = '') {
        const action = { kind };
        if (kind === 'chooseBlackCat' || kind === 'nightKill' || kind === 'nightProtect') action.targetId = readSelect(kind);
        else if (kind === 'revealConspiracyTrial' || kind === 'passTrial' || kind === 'confess') action.trialId = readSelect(kind);
        else if (kind === 'playCard') {
            action.cardId = value;
            action.targetId = readSelect('playCard');
            action.targetId2 = readSelect('playCard2');
            action.blueCardId = readSelect('curseBlue');
        } else if (kind === 'reorderDeck') action.order = (deckOrderDraft || state.deckOrder || []).slice();
        send({ type: 'gameAction', action });
    }

    function openRules(trigger) {
        rulesTrigger = trigger || document.activeElement;
        rulesScrollY = window.scrollY;
        document.body.classList.add('witchtown-rules-open');
        overlay.classList.remove('is-hidden');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }

    function closeRules() {
        overlay.classList.add('is-hidden');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('witchtown-rules-open');
        window.scrollTo(0, rulesScrollY);
        if (rulesTrigger?.isConnected) rulesTrigger.focus();
        rulesTrigger = null;
    }

    function queueScene(item) {
        sceneQueue.push(item);
        if (!scenePlaying) playNextScene();
    }

    function playNextScene() {
        const item = sceneQueue.shift();
        if (!item || !scene) { scenePlaying = false; return; }
        scenePlaying = true;
        clearTimeout(sceneTimer);
        scene.className = `witchtown-scene is-${item.kind || 'verdict'} ${item.persistent ? 'is-persistent' : ''}`;
        scene.setAttribute('aria-hidden', 'false');
        $('scene-kicker').textContent = item.kicker || '';
        $('scene-title').textContent = item.title || '';
        $('scene-detail').textContent = item.detail || '';
        void scene.offsetWidth;
        scene.classList.add('is-active');
        if (!item.persistent) sceneTimer = window.setTimeout(() => dismissScene(false), item.duration || 3900);
    }

    function dismissScene(shatter = false) {
        if (!scenePlaying || !scene) return;
        clearTimeout(sceneTimer);
        scene.classList.add(shatter ? 'is-shattering' : 'is-leaving');
        sceneTimer = window.setTimeout(() => {
            scene.className = 'witchtown-scene is-hidden';
            scene.setAttribute('aria-hidden', 'true');
            scenePlaying = false;
            playNextScene();
        }, shatter ? 1050 : 720);
    }

    function queueStateScenes(previous, next) {
        if (!previous || !next) return;
        const beforeMe = (previous.players || []).find(player => player.id === previous.myId);
        const afterMe = (next.players || []).find(player => player.id === next.myId);

        if (next.phase === 'night' && previous.phase !== 'night') {
            queueScene({ kind: 'night', kicker: `第 ${next.night || 1} 夜`, title: '夜幕降临', detail: '塞勒姆已经沉入寂静，请等待属于你的时刻。' });
        } else if (previous.phase === 'night' && next.phase === 'day') {
            const deaths = (next.lastNightDeaths || []).map(id => playerByState(next, id)?.name).filter(Boolean);
            queueScene({ kind: deaths.length ? 'dawn-death' : 'dawn-safe', kicker: '晨钟响起', title: '天亮了', detail: deaths.length ? `昨夜，${deaths.join('、')} 遇害` : '昨夜无人遇害' });
        } else if (previous.phase === 'dossier_review' && next.phase === 'dawn') {
            queueScene({ kind: 'night', kicker: '审判即将开始', title: '黑猫正在寻找主人', detail: '请保持安静，等待塞勒姆作出第一个秘密决定。' });
        } else if (previous.phase === 'dawn' && next.phase === 'day') {
            queueScene({ kind: 'day', kicker: '晨雾散去', title: '审判开始', detail: '自由讨论已经开始，黑猫持有者首先行动。' });
        } else if (!['conspiracy_reveal', 'conspiracy'].includes(previous.phase) && ['conspiracy_reveal', 'conspiracy'].includes(next.phase)) {
            queueScene({ kind: 'conspiracy', kicker: '流言穿过人群', title: '阴谋蔓延', detail: '审判档案即将易手，任何人的立场都可能改变。' });
        } else if (next.phase === 'dossier_review' && next.dossierReviewReason === 'conspiracy' && previous.phase !== 'dossier_review') {
            queueScene({ kind: 'conspiracy', kicker: '档案已经易手', title: '重新审视你的秘密', detail: '打开完整审判档案，确认你如今效忠于谁。' });
        }

        if (next.lastTrialReveal?.sequence && next.lastTrialReveal.sequence !== previous.lastTrialReveal?.sequence) {
            const revealed = TRIAL_META[next.lastTrialReveal.type]?.chinese || '审判';
            queueScene({ kind: next.lastTrialReveal.type === 'witch' ? 'trial-witch' : 'trial', kicker: '证据已经公开', title: `${revealed}审判牌`, detail: `${next.lastTrialReveal.playerName || '一名玩家'} 的档案被揭开` });
        }

        if (beforeMe && afterMe && !beforeMe.eliminated && afterMe.eliminated) {
            queueScene({ kind: 'eliminated', kicker: '你的审判已经结束', title: '您已出局', detail: '确认后可继续观看塞勒姆的审判。', persistent: true });
        }

        if (previous.status !== 'ended' && next.status === 'ended') {
            queueScene({ kind: next.winner?.faction === 'witch' ? 'witch-victory' : 'town-victory', kicker: '最终判决', title: `${next.winner?.name || '本局'}获胜`, detail: next.judgeMessage || '所有秘密都已写入审判档案。', duration: 5200 });
        }
    }

    function playerByState(source, id) {
        return (source?.players || []).find(player => player.id === id);
    }

    function onClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {

            if (uiButton.dataset.ui === 'rules') openRules(uiButton);
            if (uiButton.dataset.ui === 'closeRules') closeRules();
            if (uiButton.dataset.ui === 'sceneContinue') dismissScene(true);
            return;
        }
        if (event.target === overlay) {
            closeRules();
            return;
        }
        const actionElement = event.target.closest('button[data-action]');
        if (!actionElement || actionElement.disabled) return;
        if (actionElement.dataset.action === 'openDossier') {
            dossierOpen = true;
            scheduleDossierSeal();
            renderPrivate();
            if (state.phase === 'dossier_review') renderCommand();
            return;
        }
        if (actionElement.dataset.action === 'closeDossier') {
            sealDossier();
            return;
        }
        if (actionElement.dataset.action === 'confirmDossier') {
            dossierOpen = false;
            clearDossierSealTimer();
            renderPrivate();
            renderCommand();
            sendAction('confirmDossier');
            return;
        }
        if (actionElement.dataset.action === 'selectCard') {
            pendingCardId = pendingCardId === actionElement.dataset.value ? null : actionElement.dataset.value;
            renderCommand();
            renderHand();
            return;
        }
        if (actionElement.dataset.action === 'confirmPlay') {
            if (!isPlayDraftValid()) return;
            const cardId = pendingCardId;
            pendingCardId = null;
            renderCommand();
            renderHand();
            sendAction('playCard', cardId);
            return;
        }
        if (actionElement.dataset.action === 'toggleDeckOrder') {
            mount.querySelector('.witchtown-deck-order')?.toggleAttribute('open');
            return;
        }
        if (actionElement.dataset.action === 'moveDeckCard') {
            const visualOrder = (deckOrderDraft || []).slice().reverse();
            const index = visualOrder.indexOf(actionElement.dataset.value);
            const offset = actionElement.dataset.direction === 'up' ? -1 : 1;
            if (index >= 0 && visualOrder[index + offset]) [visualOrder[index], visualOrder[index + offset]] = [visualOrder[index + offset], visualOrder[index]];
            deckOrderDraft = visualOrder.reverse();
            renderCommand();
            mount.querySelector('.witchtown-deck-order')?.setAttribute('open', '');
            return;
        }
        if (actionElement.dataset.action === 'resetDeckOrder') {
            deckOrderDraft = (state.deckOrder || []).slice();
            renderCommand();
            mount.querySelector('.witchtown-deck-order')?.setAttribute('open', '');
            return;
        }
        if (actionElement.dataset.action === 'confirmDeckOrder') {
            sendAction('reorderDeck');
            return;
        }
        sendAction(actionElement.dataset.action, actionElement.dataset.value || '');
    }

    function onChange(event) {
        if (!event.target.matches('select[data-select-for]')) return;
        selectDraft.set(event.target.dataset.selectFor, event.target.value);
        const selected = selectedHandCard();
        if (event.target.dataset.selectFor === 'playCard' && selected && ['curse', 'robbery', 'scapegoat'].includes(selected.kind)) {
            if (selected.kind === 'curse') selectDraft.delete('curseBlue');
            renderCommand();
            renderHand();
            return;
        }
        updatePlayConfirmText();
        renderHand();
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) closeRules();
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'hidden') sealDossier();
    }

    function onWindowBlur() {
        sealDossier();
    }

    mount.addEventListener('click', onClick);
    mount.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return {
        gameType: 'witchtown',
        handleMessage(message) {
            if (message.state) {
                const previous = state;
                state = message.state;
                if (previous?.phase !== state.phase) {
                    dossierOpen = false;
                    clearDossierSealTimer();
                }
                render();
                queueStateScenes(previous, state);
            }
            if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
        },
        destroy() {
            mount.removeEventListener('click', onClick);
            mount.removeEventListener('change', onChange);
            document.removeEventListener('keydown', onKeydown);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('blur', onWindowBlur);
            clearDossierSealTimer();
            clearTimeout(sceneTimer);
            sceneQueue.length = 0;
            closeRules();
            document.body.classList.remove('is-witchtown-view');
            focusStyle.remove();
            style.remove();
            mount.innerHTML = '';
        },
    };
}
