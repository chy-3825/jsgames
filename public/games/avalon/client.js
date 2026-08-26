const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const ROLE_META = {
    merlin: { name: '梅林', faction: 'good', seal: '光', copy: '你知道部分邪恶阵营，但必须隐藏自己。' },
    percival: { name: '派西维尔', faction: 'good', seal: '剑', copy: '你看到梅林与莫甘娜两个可能身份。' },
    assassin: { name: '刺客', faction: 'evil', seal: '刃', copy: '三项任务成功后，选择你认为的梅林。' },
    minion: { name: '爪牙', faction: 'evil', seal: '暗', copy: '帮助邪恶阵营破坏任务。' },
    morgana: { name: '莫甘娜', faction: 'evil', seal: '影', copy: '你会在派西维尔眼中伪装成梅林。' },
    mordred: { name: '莫德雷德', faction: 'evil', seal: '隐', copy: '梅林无法看见你的真实阵营。' },
    oberon: { name: '奥伯伦', faction: 'evil', seal: '雾', copy: '你不认识其他邪恶玩家，他们也看不见你。' },
    loyal: { name: '忠臣', faction: 'good', seal: '盾', copy: '完成任务，辨认谎言，并保护梅林。' },
};

const MISSION_SIZES = {
    5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/avalon/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-avalon-view');

    mount.innerHTML = `
        <section class="avalon-app">
            <header class="av-header">
                <div class="av-brand"><span class="av-mark" aria-hidden="true"><i></i><b></b></span><div><small>亚瑟王的圆桌</small><h1>阿瓦隆</h1><p>忠诚与背叛，都坐在同一张桌前</p></div></div>
                <div class="av-round" data-role="round">等待圆桌开启</div>
                <div class="av-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
            </header>
            <main class="av-layout">
                <aside class="av-players-panel"><div class="av-panel-heading"><div><span class="av-kicker">圆桌席位</span><h2>誓约成员</h2></div><span data-role="playerCount">—</span></div><div class="av-players" data-role="players"></div></aside>
                <section class="av-table">
                    <div class="av-status" data-role="status"></div>
                    <section class="av-mission-board"><div class="av-board-heading"><div><span class="av-kicker">王国任务线</span><h2>五项试炼</h2></div><div class="av-score-seals"><span><i></i><b data-role="goodScore">0</b>善良</span><span><i></i><b data-role="evilScore">0</b>邪恶</span></div></div><div class="av-mission-road" data-role="missionRoad"></div><div class="av-reject-track" data-role="rejectTrack"></div></section>
                    <div class="av-private-action"><section class="av-role" data-role="role"></section><section class="av-decision" data-role="decision"></section></div>
                    <section class="av-history"><div class="av-section-title"><span>任务档案</span><small data-role="score"></small></div><div class="av-history-list" data-role="history"></div></section>
                </section>
                <aside class="av-side"><section class="av-panel av-vote-ledger"><div class="av-panel-heading"><div><span class="av-kicker">上一次公开表决</span><h2>圆桌立场</h2></div></div><div data-role="voteLedger"></div></section><section class="av-panel av-log-panel"><div class="av-panel-heading"><div><span class="av-kicker">公共记录</span><h2>圆桌纪事</h2></div><span data-role="logCount">0</span></div><div class="av-log" data-role="log"></div></section></aside>
            </main>
            <div class="av-scene-transition is-hidden" data-role="sceneTransition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div><small data-role="sceneKicker"></small><strong data-role="sceneTitle"></strong><span data-role="sceneDetail"></span></div></div>
            <div class="av-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="av-rules-title" tabindex="-1"><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span class="av-kicker">玩法说明</span><h2 id="av-rules-title">阿瓦隆规则</h2><ol><li>每个人按住身份牌查看私密身份和线索，所有人确认后圆桌才会开启。</li><li>讨论完全在线下自由进行，不限发言顺序和时间；页面只负责秘密信息与规则判断。</li><li>队长在讨论中提议一支任务队伍，名单公布后所有人继续讨论并秘密投票。</li><li>队伍通过后，队员秘密投入成功或失败；善良阵营只能选择成功。</li><li>7 人及以上时，第四项任务需要两张失败牌才会失败。</li><li>三项任务成功后，刺客可以刺杀梅林。</li><li>三项任务失败，或连续五次组队被拒绝，邪恶获胜。</li></ol><figure class="av-art-reference"><img src="/assets/bgg/avalon/detail.jpg" alt="阿瓦隆身份牌、任务板和标记组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上身份、组队和任务状态由实时规则驱动</figcaption></figure></article></div>
        </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = $('rulesOverlay');
    let state = null;
    let teamDraft = new Set();
    let pendingChoice = null;
    let assassinTarget = null;
    let interactionKey = '';
    let rulesTrigger = null;
    let bodyOverflow = '';
    let roleIdentityVisible = false;
    let hasViewedRole = false;
    let roleRevealPointerId = null;
    let roleRevealKey = null;
    let sceneTimer = null;
    let sceneSequence = 0;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function roleMeta(roleId) { return ROLE_META[roleId] || { name: roleId || '未知身份', faction: 'good', seal: '誓', copy: '你的身份会随牌局状态更新。' }; }
    function syncInteraction() {
        const key = [state.status, state.phase, state.round, state.leaderId, String(state.myRoleConfirmed), String(state.myVote), String(state.myMissionVote)].join('|');
        if (key === interactionKey) return;
        interactionKey = key;
        teamDraft = new Set(state.availableActions?.proposeTeam ? (state.team || []).map(player => player.id) : []);
        pendingChoice = null;
        assassinTarget = null;
    }
    function phaseLabel(phase) { return ({ roleReveal: '身份封存', team: '圆桌议事', vote: '提案表决', mission: '秘密远征', assassin: '刺客终局', ended: '终局揭晓' })[phase] || '等待开始'; }
    function statusText() {
        if (state.status === 'ended') return state.winner?.name || '本局结束';
        if (state.phase === 'roleReveal') return state.myRoleConfirmed ? '你的身份已经封存' : '请查看并记住你的身份';
        if (state.phase === 'team') return state.availableActions?.proposeTeam ? '自由讨论，并提名本轮远征队员' : '圆桌正在自由议事';
        if (state.phase === 'vote') return state.availableActions?.castVote ? '先充分讨论，再决定你的立场' : '圆桌成员仍在表决';
        if (state.phase === 'mission') return state.availableActions?.missionVote ? '请秘密投入一张任务牌' : '远征队伍正在执行任务';
        if (state.phase === 'assassin') return state.availableActions?.assassinate ? '刺客正在寻找梅林' : '等待刺客的最终选择';
        return '等待圆桌开启';
    }
    function statusDetail() {
        if (state.phase === 'roleReveal') return `已有 ${state.roleConfirmCount || 0} / ${state.players?.length || 0} 人记下身份，全部确认后圆桌开启`;
        if (state.phase === 'team') return `队长：${state.leaderName || '—'} · 本轮需要 ${state.missionSize || 0} 人 · 讨论在线下自由进行`;
        if (state.phase === 'vote') return `已有 ${state.voteCount || 0} / ${state.players?.length || 0} 人表态 · 提案队伍：${(state.team || []).map(player => player.name).join('、')}`;
        if (state.phase === 'mission') return `已有 ${state.missionVoteCount || 0} / ${state.team?.length || 0} 名队员完成秘密选择`;
        if (state.phase === 'assassin') return '三项任务已成功，只有刺杀梅林才能扭转结局';
        return state.status === 'ended' ? '所有阵营和身份已经公开' : '';
    }

    function setRoleIdentityVisible(visible) {
        roleIdentityVisible = Boolean(visible && state?.myRole);
        if (roleIdentityVisible) hasViewedRole = true;
        const role = $('role');
        role?.classList.toggle('is-revealed', roleIdentityVisible);
        role?.querySelector('[data-role-secret]')?.setAttribute('aria-hidden', String(!roleIdentityVisible));
        const cover = role?.querySelector('[data-role-hold]');
        cover?.setAttribute('aria-pressed', String(roleIdentityVisible));
        cover?.setAttribute('aria-label', roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏');
    }
    function hideRoleIdentity() {
        roleRevealPointerId = null;
        roleRevealKey = null;
        setRoleIdentityVisible(false);
    }
    function sceneClass(phase, status) {
        if (status === 'ended') return 'scene-ended';
        if (phase === 'roleReveal') return 'scene-identity';
        if (phase === 'mission') return 'scene-expedition';
        if (phase === 'assassin') return 'scene-assassin';
        return 'scene-roundtable';
    }
    function hideSceneTransition() {
        if (sceneTimer) clearTimeout(sceneTimer);
        sceneTimer = null;
        sceneSequence += 1;
        const element = $('sceneTransition');
        element?.classList.add('is-hidden');
        element?.setAttribute('aria-hidden', 'true');
    }
    function showSceneTransition(kind, kicker, title, detail) {
        const element = $('sceneTransition');
        if (!element) return;
        if (sceneTimer) clearTimeout(sceneTimer);
        const sequence = ++sceneSequence;
        element.className = `av-scene-transition is-${kind}`;
        $('sceneKicker').textContent = kicker;
        $('sceneTitle').textContent = title;
        $('sceneDetail').textContent = detail;
        element.setAttribute('aria-hidden', 'false');
        sceneTimer = setTimeout(() => { if (sequence === sceneSequence) hideSceneTransition(); }, prefersReducedMotion ? 1200 : 3600);
    }
    function maybePlaySceneTransition(previous, next) {
        if (!previous || !next || previous.phase === next.phase && previous.status === next.status) return;
        if (previous.phase === 'roleReveal' && next.phase === 'team') {
            showSceneTransition('roundtable', '圆桌开启', '身份已经封存', '忠诚与背叛，同坐于圆桌之前');
            return;
        }
        if (previous.phase === 'vote' && next.phase === 'mission') {
            showSceneTransition('expedition', `第 ${next.round} 项任务`, '远征队伍已经出发', '任务队员将在自己的界面秘密作出选择');
            return;
        }
        if (previous.phase === 'vote' && next.phase === 'team') {
            showSceneTransition('rejected', '圆桌表决', '提案遭到否决', `${next.leaderName || '下一位玩家'}接过队长标记，议事继续`);
            return;
        }
        if (previous.phase === 'mission') {
            const mission = next.lastMission;
            if (next.phase === 'assassin') {
                showSceneTransition('assassin', '三项任务已经完成', '但最后一把匕首仍未落下', '刺客将作出本局最后的选择');
                return;
            }
            if (next.status === 'ended') {
                showSceneTransition('evil', '远征终结', '三项任务已经失败', '阿瓦隆陷落，邪恶阵营获胜');
                return;
            }
            if (mission) showSceneTransition(mission.success ? 'success' : 'failure', `第 ${mission.round} 项任务`, mission.success ? '远征得胜' : '任务失败', mission.success ? '王国赢得一次胜利，圆桌议事重新开始' : `${mission.fails} 张失败牌浮出水面，圆桌议事重新开始`);
            return;
        }
        if (previous.phase === 'assassin' && next.status === 'ended') {
            showSceneTransition(next.winner?.faction === 'evil' ? 'evil' : 'success', '最终刺杀', next.winner?.faction === 'evil' ? '梅林倒在黎明之前' : '梅林仍隐藏在圆桌之中', `${next.winner?.name || '胜利阵营'}赢得阿瓦隆`);
            return;
        }
        if (next.status === 'ended' && next.winner?.faction === 'evil') showSceneTransition('evil', '圆桌崩塌', '圆桌已经分崩离析', '连续五次提案遭到否决，邪恶阵营获胜');
    }

    function render() {
        if (!state) return;
        syncInteraction();
        const app = mount.querySelector('.avalon-app');
        app?.classList.remove('scene-identity', 'scene-roundtable', 'scene-expedition', 'scene-assassin', 'scene-ended');
        app?.classList.add(sceneClass(state.phase, state.status));
        $('round').textContent = state.status === 'ended' ? '本局结束' : state.phase === 'roleReveal' ? `身份确认 · ${state.roleConfirmCount || 0} / ${state.players?.length || 0}` : `第 ${state.round || 1} 项任务 · ${state.successfulMissions || 0} 成功 / ${state.failedMissions || 0} 失败`;
        $('playerCount').textContent = `${state.players?.length || 0} 席`;
        $('goodScore').textContent = state.successfulMissions || 0;
        $('evilScore').textContent = state.failedMissions || 0;
        const mine = state.availableActions && Object.values(state.availableActions).some(Boolean);
        $('status').innerHTML = `<div><span class="av-kicker">${escapeHtml(phaseLabel(state.phase))}</span><h2>${escapeHtml(statusText())}</h2><small>${escapeHtml(statusDetail())}</small></div><span class="av-status-seal ${mine ? 'is-mine' : ''}">${state.status === 'ended' ? '定' : mine ? '我' : '待'}</span>`;
        renderPlayers(); renderMissionBoard(); renderRole(); renderDecision(); renderHistory(); renderVoteLedger(); renderLog();
    }

    function renderPlayers() {
        const teamIds = new Set((state.team || []).map(player => player.id));
        $('players').innerHTML = (state.players || []).map(player => {
            const vote = state.lastVote?.[player.id];
            const publicRole = state.status === 'ended' && player.role ? `<em class="is-${roleMeta(player.role).faction}">${escapeHtml(roleMeta(player.role).name)}</em>` : '';
            const identityState = state.phase === 'roleReveal' ? player.roleConfirmed ? '已经记下身份' : '正在查看身份' : null;
            const seatState = identityState || (player.isLeader ? '当前队长' : teamIds.has(player.id) ? '本轮远征队员' : player.isOnline === false ? '暂时离席' : '圆桌成员');
            const seal = state.phase === 'roleReveal' ? player.roleConfirmed ? '誓' : '…' : player.isLeader ? '冠' : vote === true ? '赞' : vote === false ? '否' : '';
            return `<article class="av-player ${player.id === state.myId ? 'is-me' : ''} ${state.phase !== 'roleReveal' && player.isLeader ? 'is-leader' : ''} ${teamIds.has(player.id) ? 'is-team' : ''} ${player.roleConfirmed ? 'is-role-confirmed' : ''} ${player.isOnline === false ? 'is-offline' : ''}"><span class="av-seat">${escapeHtml(player.seat)}</span><div><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<b>我</b>' : ''}</strong><small>${seatState}</small>${publicRole}</div><i class="${vote === true ? 'is-approve' : vote === false ? 'is-reject' : ''}">${seal}</i></article>`;
        }).join('');
    }

    function renderMissionBoard() {
        const sizes = MISSION_SIZES[state.players?.length] || [2, 3, 3, 4, 4];
        const history = new Map((state.missionHistory || []).map(item => [item.round, item]));
        $('missionRoad').innerHTML = sizes.map((size, index) => {
            const round = index + 1; const result = history.get(round); const current = state.status === 'playing' && round === state.round; const needsTwo = round === 4 && (state.players?.length || 0) >= 7;
            return `<article class="av-quest ${result?.success ? 'is-success' : result ? 'is-fail' : current ? 'is-current' : 'is-future'}"><span>${result ? result.success ? '✓' : '✕' : round}</span><div><strong>试炼 ${round}</strong><small>${size} 人${needsTwo ? ' · 需 2 张失败' : ''}</small></div></article>`;
        }).join('');
        $('rejectTrack').innerHTML = `<div><span>连续否决</span><strong>${state.rejectedTeams || 0} / 5</strong></div><div class="av-reject-seals">${Array.from({ length: 5 }, (_, index) => `<i class="${index < (state.rejectedTeams || 0) ? 'is-filled' : ''}">${index + 1}</i>`).join('')}</div><small>第五次组队被拒绝时，邪恶阵营立即获胜</small>`;
    }

    function renderRole() {
        const role = state.myRole;
        if (!role) { $('role').className = 'av-role is-empty'; $('role').innerHTML = '<span>牌局开始后，你的私密身份会在这里展开。</span>'; return; }
        const meta = roleMeta(role);
        const known = state.knownPlayers?.length ? `<div class="av-known"><span>你能辨认的人</span><strong>${state.knownPlayers.map(player => `${escapeHtml(player.seat)}号 · ${escapeHtml(player.name)}`).join('、')}</strong><small>${role === 'percival' ? '两人中分别是梅林与莫甘娜，但你无法区分。' : '这些线索只对你可见，请不要展示给身边的人。'}</small></div>` : `<div class="av-known"><span>你的私密线索</span><strong>没有额外可见的玩家</strong><small>${role === 'oberon' ? '你与其他邪恶角色彼此不可见。' : '请从圆桌发言、组队和票型中寻找线索。'}</small></div>`;
        $('role').className = `av-role is-${meta.faction}`;
        $('role').innerHTML = `<div class="av-role-secret" data-role-secret aria-hidden="${String(!roleIdentityVisible)}"><div class="av-role-card"><header><span>${state.players?.find(player => player.id === state.myId)?.seat || '—'} 号 · 仅你可见</span><b>${meta.faction === 'evil' ? '邪恶阵营' : '善良阵营'}</b></header><div class="av-role-emblem"><i>${meta.seal}</i></div><strong>${escapeHtml(meta.name)}</strong><p>${escapeHtml(meta.copy)}</p></div>${known}</div><button class="av-role-cover" data-role-hold type="button" aria-pressed="${String(roleIdentityVisible)}" aria-label="${roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏'}"><span>私密身份已遮住</span><b>按住查看身份</b><small>松开或移出后立即遮住 · 也可按住空格 / Enter</small></button>`;
        setRoleIdentityVisible(roleIdentityVisible);
    }

    function confirmMarkup(mark, title, copy, action, disabled = false, danger = false, buttonLabel = '确定选择') {
        return `<div class="av-confirm ${danger ? 'is-danger' : ''}"><span>${mark}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div><button class="av-primary" data-action="${action}" type="button"${disabled ? ' disabled' : ''}>${escapeHtml(buttonLabel)}</button></div>`;
    }

    function renderDecision() {
        const actions = state.availableActions || {}; let html = '';
        if (state.phase === 'roleReveal') {
            html = state.myRoleConfirmed
                ? `<div class="av-waiting is-role-waiting"><span>誓</span><div><strong>你的身份已经封存</strong><small>还有 ${Math.max(0, (state.players?.length || 0) - (state.roleConfirmCount || 0))} 位圆桌成员。请勿向身边的人展示身份界面。</small></div></div>`
                : `<div class="av-decision-heading"><div><span class="av-kicker">身份封存</span><h3>看清身份与私密线索</h3></div><b>${state.roleConfirmCount || 0} / ${state.players?.length || 0}</b></div><p>按住左侧身份牌查看，记住全部内容后松开，让身份重新盖住。</p>${confirmMarkup('誓', hasViewedRole ? '准备立下誓言' : '请先按住查看身份', hasViewedRole ? '确认后等待其他成员，不会公开你的身份' : '身份和你能辨认的人都藏在牌面之下', 'confirmRole', !hasViewedRole, false, '我已记住身份')}`;
        } else if (actions.proposeTeam) {
            const selectedNames = (state.players || []).filter(player => teamDraft.has(player.id)).map(player => player.name);
            html = `<div class="av-decision-heading"><div><span class="av-kicker">圆桌自由议事</span><h3>讨论并组建任务队伍</h3></div><b>${teamDraft.size} / ${state.missionSize}</b></div><p>请与身边玩家自由讨论。你可以边听边调整名单，准备好后再确定提案。</p><div class="av-select-players">${state.players.map(player => `<button type="button" class="av-select-player ${teamDraft.has(player.id) ? 'is-selected' : ''}" data-select-player="${escapeHtml(player.id)}"><span>${escapeHtml(player.seat)}</span><b>${escapeHtml(player.name)}</b><small>${player.id === state.myId ? '我' : player.isLeader ? '队长' : '圆桌成员'}</small></button>`).join('')}</div>${confirmMarkup('誓', selectedNames.length ? '准备公布这支队伍' : '队伍尚未选满', selectedNames.join('、') || `请选择 ${state.missionSize} 名队员`, 'confirmTeam', teamDraft.size !== state.missionSize, false, '确定提案')}`;
        } else if (actions.castVote) {
            const approve = pendingChoice === 'approve'; const reject = pendingChoice === 'reject';
            html = `<div class="av-decision-heading"><div><span class="av-kicker">提案质询</span><h3>讨论后决定你的立场</h3></div><b>${state.voteCount || 0} / ${state.players.length}</b></div><p>提案队员：${state.team.map(player => escapeHtml(player.name)).join('、')}。投票按钮已经开放，但请先在线下充分讨论。</p><div class="av-choice-cards"><button class="is-approve ${approve ? 'is-selected' : ''}" data-choice="approve" type="button"><i>✓</i><strong>赞成</strong><small>允许队伍出发</small></button><button class="is-reject ${reject ? 'is-selected' : ''}" data-choice="reject" type="button"><i>✕</i><strong>反对</strong><small>否决这次组队</small></button></div>${confirmMarkup(pendingChoice ? approve ? '赞' : '否' : '?', pendingChoice ? `你选择了${approve ? '赞成' : '反对'}` : '请先选择立场', '所有人投票前，你的选择不会公开', 'confirmVote', !pendingChoice, reject, '确定投票')}`;
        } else if (actions.missionVote) {
            const success = pendingChoice === 'success'; const fail = pendingChoice === 'fail'; const mayFail = roleMeta(state.myRole).faction === 'evil';
            html = `<div class="av-decision-heading"><div><span class="av-kicker">秘密任务牌</span><h3>决定这次远征的命运</h3></div><b>${state.missionVoteCount || 0} / ${state.team.length}</b></div><p>所有任务牌会混合后统一揭示，不会公开每张牌属于谁。</p><div class="av-choice-cards is-mission"><button class="is-approve ${success ? 'is-selected' : ''}" data-choice="success" type="button"><i>旭</i><strong>任务成功</strong><small>为王国带回一次胜利</small></button>${mayFail ? `<button class="is-reject ${fail ? 'is-selected' : ''}" data-choice="fail" type="button"><i>蚀</i><strong>任务失败</strong><small>秘密破坏这次远征</small></button>` : ''}</div>${confirmMarkup(pendingChoice ? success ? '旭' : '蚀' : '?', pendingChoice ? `你选择了任务${success ? '成功' : '失败'}` : '请先选择任务牌', '确定后不能撤回，其他玩家看不到你的牌面', 'confirmMission', !pendingChoice, fail, '投入任务牌')}`;
        } else if (actions.assassinate) {
            const target = (state.assassinationTargets || []).find(player => player.id === assassinTarget);
            html = `<div class="av-decision-heading"><div><span class="av-kicker">刺客终局</span><h3>找出隐藏的梅林</h3></div><b>最后一击</b></div><p>只能选择善良阵营玩家。选错将让善良阵营获胜。</p><div class="av-select-players">${(state.assassinationTargets || []).map(player => `<button type="button" class="av-select-player is-assassin ${assassinTarget === player.id ? 'is-selected' : ''}" data-assassin-target="${escapeHtml(player.id)}"><span>${escapeHtml(player.seat)}</span><b>${escapeHtml(player.name)}</b><small>刺杀候选</small></button>`).join('')}</div>${confirmMarkup('刃', target ? `你决定刺杀 ${target.name}` : '尚未锁定目标', target ? '这是本局最后的选择，确定后立即揭晓胜负' : '请先选择一名玩家', 'confirmAssassination', !target, true, '确定刺杀')}`;
        } else {
            const waiting = state.status === 'ended' ? ['定', '圆桌已经完成最终判定', '所有身份已公开，可在席位名册中查看']
                : state.phase === 'team' ? ['议', `${state.leaderName || '队长'}正在斟酌远征队伍`, '请与身边玩家自由讨论；辅助页面不会规定发言顺序或结束时间']
                    : state.phase === 'vote' ? ['誓', '你的立场已经决定', '可以继续参与线下讨论，等待其他圆桌成员投票']
                        : state.phase === 'mission' ? ['征', '远征队伍正在执行任务', '请观察公开进度；每名队员的任务牌始终保密']
                            : state.phase === 'assassin' ? ['刃', '刺客正在作出最后选择', '圆桌成员请等待最终身份揭晓']
                                : ['待', '请留意圆桌上的变化', '你仍可以根据任务线和公开表决进行推理'];
            html = `<div class="av-waiting"><span>${waiting[0]}</span><div><strong>${escapeHtml(waiting[1])}</strong><small>${escapeHtml(waiting[2])}</small></div></div>`;
        }
        $('decision').innerHTML = html;
    }

    function renderHistory() {
        $('score').textContent = `善良 ${state.successfulMissions || 0} · 邪恶 ${state.failedMissions || 0}`;
        $('history').innerHTML = (state.missionHistory || []).map(item => `<article class="av-mission ${item.success ? 'is-success' : 'is-fail'}"><span>${item.success ? '✓' : '✕'}</span><div><b>试炼 ${item.round} · ${item.success ? '成功' : '失败'}</b><small>${item.team.map(player => escapeHtml(player.name)).join('、')}</small></div><em>${item.success ? '远征得胜' : `${item.fails} 张失败牌`}</em></article>`).join('') || '<p class="av-empty">还没有完成的任务。</p>';
    }
    function renderVoteLedger() {
        if (!state.lastVote) { $('voteLedger').innerHTML = '<div class="av-ledger-empty"><span>誓</span><p>第一次队伍表决完成后，每位玩家的公开立场会记录在这里。</p></div>'; return; }
        $('voteLedger').innerHTML = `<div class="av-ledger-grid">${(state.players || []).map(player => `<span class="${state.lastVote[player.id] ? 'is-approve' : 'is-reject'}"><i>${state.lastVote[player.id] ? '赞' : '否'}</i><b>${escapeHtml(player.name)}</b></span>`).join('')}</div>`;
    }
    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse(); $('logCount').textContent = String(entries.length);
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') : '<p class="av-log-empty">等待队长提案。</p>';
    }

    function openRules(trigger) { rulesTrigger = trigger || document.activeElement; bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; overlay.classList.remove('is-hidden'); overlay.setAttribute('aria-hidden', 'false'); overlay.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true }); }
    function closeRules() { if (overlay.classList.contains('is-hidden')) return; overlay.classList.add('is-hidden'); overlay.setAttribute('aria-hidden', 'true'); document.body.style.overflow = bodyOverflow; rulesTrigger?.focus?.({ preventScroll: true }); rulesTrigger = null; }
    function handleClick(event) {
        if (!event.target.closest('[data-role-hold]')) hideRoleIdentity();
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) { if (uiButton.dataset.ui === 'leave') leaveRoom?.(); if (uiButton.dataset.ui === 'rules') openRules(uiButton); if (uiButton.dataset.ui === 'closeRules') closeRules(); return; }
        if (event.target === overlay) { closeRules(); return; }
        const playerButton = event.target.closest('[data-select-player]');
        if (playerButton) { const id = playerButton.dataset.selectPlayer; if (teamDraft.has(id)) teamDraft.delete(id); else if (teamDraft.size < state.missionSize) teamDraft.add(id); renderDecision(); mount.querySelector(`[data-select-player="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); return; }
        const choiceButton = event.target.closest('[data-choice]');
        if (choiceButton) { const choice = choiceButton.dataset.choice; pendingChoice = pendingChoice === choice ? null : choice; renderDecision(); if (pendingChoice) mount.querySelector(`[data-choice="${pendingChoice}"]`)?.focus({ preventScroll: true }); return; }
        const assassinButton = event.target.closest('[data-assassin-target]');
        if (assassinButton) { assassinTarget = assassinTarget === assassinButton.dataset.assassinTarget ? null : assassinButton.dataset.assassinTarget; renderDecision(); return; }
        const action = event.target.closest('[data-action]'); if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmRole') { hideRoleIdentity(); send({ type: 'gameAction', action: { kind: 'confirmRole' } }); }
        if (action.dataset.action === 'confirmTeam' && teamDraft.size === state.missionSize) send({ type: 'gameAction', action: { kind: 'proposeTeam', playerIds: [...teamDraft] } });
        if (action.dataset.action === 'confirmVote' && pendingChoice) send({ type: 'gameAction', action: { kind: 'castVote', approve: pendingChoice === 'approve' } });
        if (action.dataset.action === 'confirmMission' && pendingChoice) send({ type: 'gameAction', action: { kind: 'missionVote', result: pendingChoice } });
        if (action.dataset.action === 'confirmAssassination' && assassinTarget) send({ type: 'gameAction', action: { kind: 'assassinate', targetId: assassinTarget } });
    }
    function handlePointerDown(event) {
        const cover = event.target.closest('[data-role-hold]');
        if (!cover || event.button > 0) return;
        event.preventDefault();
        roleRevealPointerId = event.pointerId;
        cover.setPointerCapture?.(event.pointerId);
        setRoleIdentityVisible(true);
        if (state?.phase === 'roleReveal') renderDecision();
    }
    function handlePointerEnd(event) {
        if (roleRevealPointerId !== null && (event.pointerId === undefined || event.pointerId === roleRevealPointerId)) hideRoleIdentity();
    }
    function handlePointerOut(event) {
        const cover = event.target.closest('[data-role-hold]');
        if (cover && !cover.contains(event.relatedTarget)) hideRoleIdentity();
    }
    function handleKeydown(event) {
        if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) closeRules();
        const cover = event.target.closest?.('[data-role-hold]');
        if (!cover || event.repeat || event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        roleRevealKey = event.key;
        setRoleIdentityVisible(true);
        if (state?.phase === 'roleReveal') renderDecision();
    }
    function handleKeyup(event) { if (roleRevealKey && event.key === roleRevealKey) hideRoleIdentity(); }
    function handleFocusOut(event) { if (event.target.closest?.('[data-role-hold]')) hideRoleIdentity(); }
    function handleVisibilityChange() { if (document.hidden) hideRoleIdentity(); }
    mount.addEventListener('click', handleClick); document.addEventListener('keydown', handleKeydown);
    mount.addEventListener('pointerdown', handlePointerDown); mount.addEventListener('pointerout', handlePointerOut); mount.addEventListener('pointercancel', handlePointerEnd); mount.addEventListener('focusout', handleFocusOut);
    document.addEventListener('pointerup', handlePointerEnd); document.addEventListener('keyup', handleKeyup); document.addEventListener('visibilitychange', handleVisibilityChange); window.addEventListener('blur', hideRoleIdentity);
    return { gameType: 'avalon', handleMessage(message) { if (message.state) { const previous = state; if (previous && (previous.phase !== message.state.phase || previous.myRole !== message.state.myRole)) hideRoleIdentity(); state = message.state; render(); maybePlaySceneTransition(previous, state); } if (message.type === 'error') addLog?.(message.message || '这一步现在无法进行', 'error'); }, destroy() { hideRoleIdentity(); hideSceneTransition(); mount.removeEventListener('click', handleClick); mount.removeEventListener('pointerdown', handlePointerDown); mount.removeEventListener('pointerout', handlePointerOut); mount.removeEventListener('pointercancel', handlePointerEnd); mount.removeEventListener('focusout', handleFocusOut); document.removeEventListener('keydown', handleKeydown); document.removeEventListener('pointerup', handlePointerEnd); document.removeEventListener('keyup', handleKeyup); document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('blur', hideRoleIdentity); closeRules(); document.body.classList.remove('is-avalon-view'); style.remove(); mount.innerHTML = ''; } };
}
