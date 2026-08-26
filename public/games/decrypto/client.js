const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const PHASES = {
    keycheck: { name: '核对密钥', mark: '锁' },
    encryptor_vote: { name: '选举加密员', mark: '票' },
    clue: { name: '编写线索', mark: '译' },
    guessing: { name: '封存答案', mark: '密' },
    tiebreak: { name: '终局猜词', mark: '决' },
    ended: { name: '通信复盘', mark: '终' },
};

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/decrypto/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-decrypto-view');

    mount.innerHTML = `
        <section class="decrypto-app">
            <header class="dc-header">
                <div class="dc-brand"><span class="dc-mark" aria-hidden="true"><i></i><b>密</b></span><div><small>双队加密通信站</small><h1>谍报风云</h1><p>让队友听懂，同时让对手误判</p></div></div>
                <div class="dc-round" data-role="round">等待频道接通</div>
                <div class="dc-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
            </header>
            <main class="dc-layout">
                <section class="dc-workbench">
                    <div class="dc-status" data-role="status"></div>
                    <div class="dc-phase-track" data-role="phaseTrack"></div>
                    <div class="dc-signal-grid">
                        <section class="dc-key-vault">
                            <header><div><span class="dc-kicker">本队机密</span><h2>四张关键词</h2></div><span class="dc-private-seal">仅本队可见</span></header>
                            <div class="dc-keywords" data-role="keywords"></div>
                        </section>
                        <section class="dc-transmission" data-role="briefing"></section>
                    </div>
                    <section class="dc-command" data-role="command"></section>
                    <section class="dc-history"><header class="dc-section-heading"><div><span class="dc-kicker">已解密档案</span><h2>通信记录</h2></div><span data-role="historyCount">0 封</span></header><div class="dc-history-list" data-role="history"></div></section>
                </section>
                <aside class="dc-side">
                    <section class="dc-panel dc-identity" data-role="identity"></section>
                    <section class="dc-panel dc-teams-panel"><header class="dc-panel-heading"><div><span class="dc-kicker">频道状态</span><h2>双方情报组</h2></div><span>2 枚决胜</span></header><div class="dc-teams" data-role="teams"></div></section>
                    <section class="dc-panel dc-log-panel"><header class="dc-panel-heading"><div><span class="dc-kicker">公共播报</span><h2>行动记录</h2></div><span data-role="logCount">0</span></header><div class="dc-log" data-role="log"></div></section>
                </aside>
            </main>
            <div class="dc-scene-transition is-hidden" data-role="sceneTransition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div><small data-role="sceneKicker"></small><strong data-role="sceneTitle"></strong><span data-role="sceneDetail"></span></div></div>
            <div class="dc-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="dc-rules-title" tabindex="-1"><button type="button" data-ui="closeRules" aria-label="关闭规则">×</button><span class="dc-kicker">玩法说明</span><h2 id="dc-rules-title">谍报风云规则</h2><ol><li>每个人先打开本队密钥库，核对四个关键词；全员确认后第一轮才会开始。</li><li>加密员按住查看三位私密密码，并按顺序写出三条线索；双方都提交后才会公开电报。</li><li>所有推演完全在线下自由讨论；加密员公布线索后不能追加解释。</li><li>第一轮不截获；第二轮起，对方截获方案和本队解码答案都会先封存，收齐后才统一揭晓。</li><li>本队猜错获得一次沟通失误，对手猜中获得一次截获；任一项达到两枚即可决定胜负。</li><li>双方同轮同时满足终局条件或完成八轮后，进入最终反向破译；三人变体最多进行五轮。</li></ol><figure class="dc-art-reference"><img src="/assets/bgg/decrypto/detail.png" alt="谍报风云密码机和组件参考图" loading="lazy"><figcaption>实体组件参考 · 页面保管秘密与规则，讨论、联想和误导都留在线下</figcaption></figure></article></div>
        </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const app = mount.querySelector('.decrypto-app');
    const overlay = $('rulesOverlay');
    const sceneTransition = $('sceneTransition');
    let state = null;
    let codeDraft = [];
    let encryptorCandidateId = '';
    let interactionKey = '';
    let rulesTrigger = null;
    let bodyOverflow = '';
    let keywordsVisible = false;
    let codeVisible = false;
    let hasViewedKeywords = false;
    let hasViewedCode = false;
    let codePointerId = null;
    let codeRevealKey = null;
    let sceneTimer = null;
    let sceneSequence = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    function phaseMeta() { return PHASES[state.phase] || { name: '等待接入', mark: '待' }; }
    function teamClass(teamId) { return Number(teamId) === 0 ? 'is-red' : 'is-blue'; }
    function myPlayer() { return (state.players || []).find(player => player.id === state.myId); }
    function myTeam() { return (state.teams || []).find(team => team.id === state.myTeam); }
    function maxRounds() { return state.players?.length === 3 ? 5 : 8; }
    function setKeywordsVisible(visible) {
        keywordsVisible = Boolean(visible);
        if (keywordsVisible) hasViewedKeywords = true;
        $('keywords')?.classList.toggle('is-revealed', keywordsVisible);
        const toggle = mount.querySelector('[data-secret-toggle="keywords"]');
        if (toggle) {
            toggle.setAttribute('aria-pressed', String(keywordsVisible));
            toggle.querySelector('strong').textContent = keywordsVisible ? '点击重新封存' : '点击打开密钥库';
        }
    }
    function setCodeVisible(visible) {
        codeVisible = Boolean(visible);
        if (codeVisible) hasViewedCode = true;
        mount.querySelectorAll('[data-secret-code]').forEach(element => element.classList.toggle('is-revealed', codeVisible));
    }
    function syncInteraction() {
        const key = [state.status, state.phase, state.round, state.currentTeam, state.activeTeam, state.encryptorId, (state.currentClues || []).join('|')].join('·');
        if (key === interactionKey) return;
        interactionKey = key;
        codeDraft = [];
        encryptorCandidateId = '';
        codeVisible = false;
        codePointerId = null;
        codeRevealKey = null;
        hasViewedCode = false;
        if (state.phase !== 'keycheck') keywordsVisible = false;
    }

    function sceneClass() {
        if (state.status === 'ended') return 'scene-ended';
        if (state.phase === 'keycheck') return 'scene-keycheck';
        if (state.phase === 'encryptor_vote') return 'scene-keycheck';
        if (state.phase === 'clue') return 'scene-encrypting';
        if (state.phase === 'guessing') return 'scene-broadcast';
        if (state.phase === 'tiebreak') return 'scene-tiebreak';
        return 'scene-encrypting';
    }
    function hideScene() {
        if (sceneTimer) clearTimeout(sceneTimer);
        sceneTimer = null;
        sceneTransition.className = 'dc-scene-transition is-hidden';
        sceneTransition.setAttribute('aria-hidden', 'true');
    }
    function playScenes(scenes) {
        const sequence = ++sceneSequence;
        hideScene();
        const queue = scenes.filter(Boolean);
        const playNext = () => {
            if (sequence !== sceneSequence || !queue.length) { hideScene(); return; }
            const scene = queue.shift();
            $('sceneKicker').textContent = scene.kicker || '';
            $('sceneTitle').textContent = scene.title || '';
            $('sceneDetail').textContent = scene.detail || '';
            sceneTransition.className = `dc-scene-transition is-${scene.kind || 'signal'}`;
            sceneTransition.setAttribute('aria-hidden', 'false');
            sceneTimer = setTimeout(playNext, reducedMotion?.matches ? 1100 : (scene.duration || 2900));
        };
        playNext();
    }
    function transitionScenes(previous, next) {
        if (!previous || !next) return [];
        const scenes = [];
        if (previous.phase === 'keycheck' && next.phase === 'encryptor_vote') scenes.push({ kind: 'keys', kicker: '全员核对完成', title: '固定加密员选举', detail: '请在本队内投出你的选择' });
        if ((previous.phase === 'keycheck' || previous.phase === 'encryptor_vote') && next.phase === 'clue') scenes.push({ kind: 'keys', kicker: previous.phase === 'encryptor_vote' ? '选举完成' : '全员核对完成', title: '密钥已经封存', detail: '第一轮加密频道正在建立' });
        if (previous.phase === 'clue' && next.phase === 'guessing') scenes.push({ kind: 'signal', kicker: '捕获到新电报', title: `${next.currentTeamName || '当前队伍'}频道已接入`, detail: '线索已经公开，双方可以开始线下推演' });
        const previousHistory = previous.history?.length || 0;
        const nextHistory = next.history?.length || 0;
        if (nextHistory > previousHistory) {
            const record = next.history[nextHistory - 1];
            const result = [`本队${record.ownGuess?.correct ? '解码成功' : '沟通失误'}`];
            if (record.intercept) result.push(`对方${record.intercept.correct ? '截获成功' : '未能截获'}`);
            else result.push('首轮不进行截获');
            const nextChannel = next.status === 'ended' || next.phase === 'tiebreak' ? '' : next.phase === 'guessing' ? ` · ${next.currentTeamName}频道即将接入` : ` · 第 ${next.round} 轮即将开始`;
            scenes.push({ kind: record.intercept?.correct ? 'breach' : record.ownGuess?.correct ? 'decoded' : 'mistake', kicker: `${record.teamName}电报已解密`, title: record.code.join('  ·  '), detail: `${result.join(' · ')}${nextChannel}` });
        }
        if (previous.phase !== 'tiebreak' && next.phase === 'tiebreak') scenes.push({ kind: 'tiebreak', kicker: '常规标记无法判定胜负', title: '双方通信已经暴露', detail: '启动最终反向破译' });
        if (previous.status !== 'ended' && next.status === 'ended') scenes.push({ kind: next.winner?.teamId === null ? 'draw' : Number(next.winner?.teamId) === 0 ? 'red-win' : 'blue-win', kicker: '通信终局', title: next.winner?.teamId === null ? '双方共享胜利' : `${next.winner?.teamName || '获胜队伍'}控制了频道`, detail: next.lastResult?.message || '所有密钥和通信档案已经解封' });
        return scenes;
    }

    function statusTitle() {
        const actions = state.availableActions || {};
        if (state.status === 'ended') return state.winner?.teamId === null ? (state.winner.teamName || '双方共享胜利') : `${state.winner?.teamName || '本局'}获胜`;
        if (state.phase === 'keycheck') return state.myKeyConfirmed ? '你的密钥已经封存' : '请打开并核对本队密钥';
        if (state.phase === 'encryptor_vote') return actions.voteEncryptor ? '请选出本局固定加密员' : '你的选票已经封存';
        if (actions.submitClue) return '请把三位密码译成三条线索';
        if (state.phase === 'clue') return `${state.encryptorName || '另一位加密员'}正在编写线索`;
        if (actions.submitIntercept) return '请封存对方密码的截获方案';
        if (actions.submitOwnGuess) return '请封存本队的最终解码答案';
        if (state.phase === 'guessing') return '双方正在线下推演这封电报';
        if (actions.tiebreakGuess) return '请提交对方的四张关键词';
        if (state.phase === 'tiebreak') return '等待双方终局猜词';
        return '等待加密频道接通';
    }
    function statusDetail() {
        if (state.status === 'ended') return state.lastResult?.message || '所有通信记录已经归档';
        if (state.phase === 'keycheck') return `已有 ${state.keyConfirmCount || 0} / ${state.players?.length || 0} 人完成核对，全员确认后建立通信频道`;
        if (state.phase === 'encryptor_vote') return `已封存 ${state.encryptorVoteCount || 0} 张选票；两队完成后同时公布加密员`;
        if (state.phase === 'clue') return `当前加密员：${state.encryptorName || '—'} · 密码只对本人显示`;
        if (state.phase === 'guessing') {
            const intercept = state.round === 1 ? '首轮不进行截获' : `截获${state.interceptSubmitted ? '已封存' : '未封存'}`;
            return `解码${state.ownGuessSubmitted ? '已封存' : '未封存'} · ${intercept} · 答案收齐后统一揭晓`;
        }
        if (state.phase === 'tiebreak') return '四个猜词会去重计分，提交后不能修改';
        return '';
    }

    function render() {
        if (!state) return;
        syncInteraction();
        app.classList.toggle('is-red-view', state.myTeam === 0);
        app.classList.toggle('is-blue-view', state.myTeam === 1);
        app.classList.remove('scene-keycheck', 'scene-encrypting', 'scene-broadcast', 'scene-tiebreak', 'scene-ended');
        app.classList.add(sceneClass());
        app.dataset.phase = state.phase || 'waiting';
        $('round').textContent = state.status === 'ended' ? '频道关闭' : state.phase === 'keycheck' ? `密钥核对 · ${state.keyConfirmCount || 0} / ${state.players?.length || 0}` : state.phase === 'encryptor_vote' ? `固定加密员选举 · ${state.encryptorVoteCount || 0} 票` : `第 ${state.round || 1} / ${maxRounds()} 轮 · ${phaseMeta().name}`;
        const actionable = state.availableActions && Object.values(state.availableActions).some(Boolean);
        $('status').innerHTML = `<div><span class="dc-kicker">${escapeHtml(phaseMeta().name)}</span><h2>${escapeHtml(statusTitle())}</h2><p>${escapeHtml(statusDetail())}</p></div><span class="dc-status-dial ${actionable ? 'is-live' : ''}">${state.status === 'ended' ? '终' : actionable ? '我' : phaseMeta().mark}</span>`;
        renderPhaseTrack(); renderKeywords(); renderBriefing(); renderCommand(); renderIdentity(); renderTeams(); renderHistory(); renderLog();
    }

    function renderPhaseTrack() {
        if (state.phase === 'keycheck') {
            $('phaseTrack').innerHTML = [
                ['锁', '核对密钥', `${state.keyConfirmCount || 0} / ${state.players?.length || 0} 人确认`],
                ['频', '建立频道', '全员确认后自动开启'],
                ['译', '开始通信', '加密员将收到私密密码'],
            ].map((item, index) => `<div class="${index === 0 ? 'is-current' : ''}"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></div>`).join('');
            return;
        }
        if (state.phase === 'encryptor_vote') {
            $('phaseTrack').innerHTML = [['锁', '核对密钥', '全员已确认'], ['票', '队内选举', '选票封存后统一公布'], ['译', '开始通信', '固定加密员将收到密码']].map((item, index) => `<div class="${index === 1 ? 'is-current' : index === 0 ? 'is-done' : ''}"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></div>`).join('');
            return;
        }
        const done = state.status === 'ended' || state.phase === 'tiebreak';
        $('phaseTrack').innerHTML = [
            { mark: 1, title: '编写线索', copy: '双方分别封存电报', current: state.phase === 'clue', complete: state.phase === 'guessing' || done },
            { mark: 2, title: '线下推演', copy: state.round === 1 ? '本队解码，首轮无截获' : '双方答案分别封存', current: state.phase === 'guessing', complete: done },
            { mark: 3, title: '统一揭晓', copy: '公开正确密码与双方结果', current: false, complete: done },
        ].map(item => `<div class="${item.current ? 'is-current' : item.complete ? 'is-done' : ''}"><span>${item.mark}</span><strong>${item.title}</strong><small>${item.copy}</small></div>`).join('');
    }

    function renderKeywords() {
        const words = state.myKeywords || [];
        if (!words.length) { $('keywords').innerHTML = '<div class="dc-keywords-empty"><span>锁</span><p>牌局开始后，本队关键词会在这里解锁。</p></div>'; return; }
        $('keywords').classList.toggle('is-revealed', keywordsVisible);
        const cards = words.map((word, index) => {
            const clueOrder = hasViewedCode ? (state.currentCode?.indexOf(index + 1) ?? -1) : -1;
            return `<article class="dc-key-card ${clueOrder >= 0 ? 'is-in-code' : ''}"><span>${index + 1}</span><div><small>关键词 ${index + 1}</small><strong>${escapeHtml(word)}</strong></div>${clueOrder >= 0 ? `<i>第 ${clueOrder + 1} 条线索</i>` : '<i>本队机密</i>'}</article>`;
        }).join('');
        $('keywords').innerHTML = `${cards}<button type="button" class="dc-keywords-cover" data-secret-toggle="keywords" aria-pressed="${keywordsVisible}"><span>锁</span><strong>${keywordsVisible ? '点击重新封存' : '点击打开密钥库'}</strong><small>${keywordsVisible ? '离开页面时会自动盖住' : '四个关键词只对本队可见'}</small></button>`;
    }

    function codeDisplay(code, label, isPrivate = false) {
        const values = Array.isArray(code) ? code : [];
        return `<div class="dc-code-display ${isPrivate ? `is-private ${codeVisible ? 'is-revealed' : ''}` : ''}"${isPrivate ? ' data-secret-code' : ''}><small>${escapeHtml(label)}</small><div>${[0, 1, 2].map(index => `<b>${values[index] ?? '?'}</b>`).join('')}</div>${isPrivate ? '<button type="button" class="dc-code-cover" data-code-hold aria-label="按住查看私密密码"><span>密</span><strong>按住查看</strong></button>' : ''}</div>`;
    }

    function renderBriefing() {
        const clues = state.currentClues || [];
        const team = (state.teams || []).find(item => item.id === state.currentTeam);
        if (state.phase === 'keycheck' || state.phase === 'encryptor_vote') {
            $('briefing').innerHTML = `<div class="dc-empty-signal is-keycheck"><span aria-hidden="true"><i></i></span><div><strong>${state.phase === 'encryptor_vote' ? '加密员选举进行中' : '通信频道尚未建立'}</strong><small>${state.phase === 'encryptor_vote' ? '投票只能选择本队成员，平票时按座位顺序确定' : '请先打开左侧密钥库，核对本队的四个关键词'}</small></div></div>`;
            return;
        }
        if (clues.length) {
            $('briefing').innerHTML = `<header><div><span class="dc-kicker">公开频道</span><h2>${escapeHtml(team?.name || '当前队伍')}的三条线索</h2></div>${state.currentCode ? codeDisplay(state.currentCode, '仅你可见的密码', true) : '<span class="dc-scrambled">密码仍在加密</span>'}</header><div class="dc-clue-tapes">${clues.map((clue, index) => `<article><span>${index + 1}</span><strong>${escapeHtml(clue)}</strong></article>`).join('')}</div>`;
        } else if (state.currentCode?.length) {
            $('briefing').innerHTML = `<header><div><span class="dc-kicker">加密员专属</span><h2>本轮私密密码</h2></div><span class="dc-private-seal">不要念出数字</span></header><div class="dc-private-code">${codeDisplay(state.currentCode, '按顺序编写三条线索', true)}<p>依次为 ${state.currentCode.map((digit, index) => `第 ${index + 1} 条线索对应 ${digit} 号关键词`).join('；')}。</p></div>`;
        } else {
            $('briefing').innerHTML = `<div class="dc-empty-signal"><span aria-hidden="true"><i></i></span><div><strong>等待本轮公开线索</strong><small>双方加密员都提交后，频道才会公开内容</small></div></div>`;
        }
    }

    function confirmBlock(mark, title, copy, action, disabled = false, submit = false, buttonLabel = '确认提交') {
        return `<div class="dc-confirm"><span>${mark}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div><button class="dc-primary" ${submit ? 'type="submit"' : 'type="button"'} data-action="${action}"${disabled ? ' disabled' : ''}>${escapeHtml(buttonLabel)}</button></div>`;
    }

    function codeBuilder(kind, title, copy) {
        const ready = codeDraft.length === 3;
        return `<div class="dc-command-heading"><div><span class="dc-kicker">密码推演</span><h2>${escapeHtml(title)}</h2></div><button class="dc-clear-code" type="button" data-code-reset${codeDraft.length ? '' : ' disabled'}>清空</button></div><p class="dc-command-copy">${escapeHtml(copy)}</p><div class="dc-code-builder"><div class="dc-code-slots">${[0, 1, 2].map(index => `<span class="${codeDraft[index] ? 'is-filled' : ''}"><small>第 ${index + 1} 位</small><b>${codeDraft[index] || '?'}</b></span>`).join('')}</div><div class="dc-number-pad">${[1, 2, 3, 4].map(digit => { const position = codeDraft.indexOf(digit); return `<button type="button" data-code-digit="${digit}" class="${position >= 0 ? 'is-selected' : ''}"><b>${digit}</b><small>${position >= 0 ? `第 ${position + 1} 位` : '选择'}</small></button>`; }).join('')}</div></div>${confirmBlock(kind === 'intercept' ? '截' : '解', ready ? codeDraft.join(' · ') : '密码尚未填满', ready ? '三个数字均不重复，封存后不可撤回' : '按顺序选择三个不同数字', kind === 'intercept' ? 'confirmIntercept' : 'confirmOwnGuess', !ready, false, kind === 'intercept' ? '封存截获方案' : '封存解码答案')}`;
    }

    function textFields(kind, count, disabled = false) {
        const isClue = kind === 'clue';
        return `<div class="dc-text-fields ${count === 4 ? 'has-four' : ''}">${Array.from({ length: count }, (_, index) => {
            const keyword = hasViewedCode ? state.currentCode?.[index] : null;
            return `<label><span>${isClue ? `线索 ${index + 1}` : `对方关键词 ${index + 1}`}${isClue && keyword ? `<small>对应 ${keyword} 号关键词</small>` : ''}</span><input required maxlength="120" autocomplete="off" data-text-index="${index}" placeholder="${isClue ? '输入联想线索' : '输入你的猜测'}"${disabled ? ' disabled' : ''}></label>`;
        }).join('')}</div>`;
    }

    function renderCommand() {
        const actions = state.availableActions || {};
        if (state.phase === 'keycheck') {
            if (actions.confirmKey) {
                $('command').innerHTML = `<div class="dc-command-heading"><div><span class="dc-kicker">密钥核对</span><h2>确认本队四个关键词</h2></div><b>${state.keyConfirmCount || 0} / ${state.players?.length || 0}</b></div><p class="dc-command-copy">点击左侧密钥库查看全部关键词，确认后等待其他成员。</p>${confirmBlock('锁', hasViewedKeywords ? '本队密钥已经查看' : '请先打开密钥库', hasViewedKeywords ? '确认只表示已完成核对，关键词不会公开' : '看清四个关键词后才能封存', 'confirmKey', !hasViewedKeywords, false, '我已核对密钥')}`;
            } else {
                $('command').innerHTML = `<div class="dc-waiting"><span>锁</span><div><strong>你的密钥已经封存</strong><small>还有 ${(state.players?.length || 0) - (state.keyConfirmCount || 0)} 名成员未确认，全员完成后自动开始</small></div></div>`;
            }
            return;
        }
        if (state.phase === 'encryptor_vote') {
            if (actions.voteEncryptor) {
                const candidates = state.encryptorCandidates || [];
                $('command').innerHTML = `<div class="dc-command-heading"><div><span class="dc-kicker">队内秘密选举</span><h2>选择本局固定加密员</h2></div><b>${state.encryptorVoteCount || 0} 票已封存</b></div><p class="dc-command-copy">他将在后续每一轮为本队编写线索，选票提交后不可修改。</p><div class="dc-number-pad">${candidates.map(candidate => `<button type="button" data-encryptor-candidate="${escapeHtml(candidate.id)}" class="${candidate.id === encryptorCandidateId ? 'is-selected' : ''}"><b>${escapeHtml(candidate.name)}</b><small>${candidate.id === state.myId ? '我自己' : '本队成员'}</small></button>`).join('')}</div>${confirmBlock('票', encryptorCandidateId ? '选择已完成' : '尚未选择', encryptorCandidateId ? '确认后封存选票' : '请先选择一名本队成员', 'confirmEncryptorVote', !encryptorCandidateId, false, '封存选票')}`;
            } else $('command').innerHTML = `<div class="dc-waiting"><span>票</span><div><strong>你的选票已经封存</strong><small>等待其他队员完成选择，结果将统一公布</small></div></div>`;
            return;
        }
        if (actions.submitClue) {
            $('command').innerHTML = `<form data-text-form="clue"><div class="dc-command-heading"><div><span class="dc-kicker">加密员专属</span><h2>编写三条加密线索</h2></div><b>${hasViewedCode ? '密码已核对' : '密码仍在封存'}</b></div><p class="dc-command-copy">${hasViewedCode ? '不要直接写出关键词，提交后不能再向队友追加解释。' : '请先按住上方密码牌查看三位密码。'}</p>${textFields('clue', 3, !hasViewedCode)}${confirmBlock('译', hasViewedCode ? '三条线索尚未完成' : '请先查看私密密码', hasViewedCode ? '填写三条不同线索后可以封存' : '按住查看后才能开始编写', 'confirmClue', true, true, '封存电报')}</form>`;
            return;
        }
        if (actions.submitIntercept) { $('command').innerHTML = codeBuilder('intercept', '封存截获方案', '先与队友在线下自由推演；提交后只会显示“已封存”，不会提前公布对错。'); return; }
        if (actions.submitOwnGuess) { $('command').innerHTML = codeBuilder('own', '封存本队解码', '先与队友在线下自由讨论；加密员不能追加解释，也不能代替队友提交。'); return; }
        if (actions.tiebreakGuess) {
            $('command').innerHTML = `<form data-text-form="tiebreak"><div class="dc-command-heading"><div><span class="dc-kicker">终局操作</span><h2>猜出对方四张关键词</h2></div><b>最终判定</b></div><p class="dc-command-copy">四个答案会按完整词语匹配；相同答案只计算一次。</p>${textFields('tiebreak', 4)}${confirmBlock('决', '四个猜词尚未完成', '填写四个不同猜词后可以提交', 'confirmTiebreak', true, true)}</form>`;
            return;
        }
        const waitingTitle = state.phase === 'guessing' ? '你所在一方的答案已封存' : '当前没有需要你提交的内容';
        const waitingCopy = state.phase === 'guessing' ? '继续在线下观察和推演；系统收齐答案后会统一揭晓' : '所有讨论都在线下自由进行，页面只保管秘密与判定规则';
        $('command').innerHTML = `<div class="dc-waiting"><span>${state.status === 'ended' ? '终' : phaseMeta().mark}</span><div><strong>${state.status === 'ended' ? '本局通信已经结束' : waitingTitle}</strong><small>${state.status === 'ended' ? '可查看通信档案和最终标记' : waitingCopy}</small></div></div>`;
    }

    function renderIdentity() {
        const team = myTeam(); const player = myPlayer(); const threePlayerRole = state.players?.length === 3 ? (state.myTeam === 0 ? '密码守卫' : '单独截获者') : '情报组成员';
        $('identity').className = `dc-panel dc-identity ${teamClass(state.myTeam)}`;
        $('identity').innerHTML = `<span class="dc-access-mark">${state.myTeam === 0 ? '红' : '蓝'}</span><div><span class="dc-kicker">我的通信权限</span><h2>${escapeHtml(team?.name || '未分队')}</h2><strong>${escapeHtml(player?.name || state.myId || '观察员')}</strong><small>${state.encryptorId === state.myId ? '本轮加密员 · 可查看私密密码' : threePlayerRole}</small></div>`;
    }

    function markerTrack(count, kind) { return `<div class="dc-marker-track ${kind}">${[0, 1].map(index => `<i class="${index < count ? 'is-filled' : ''}">${index + 1}</i>`).join('')}</div>`; }
    function renderTeams() {
        $('teams').innerHTML = (state.teams || []).map(team => `<article class="dc-team ${teamClass(team.id)} ${team.id === state.myTeam ? 'is-mine' : ''} ${team.id === state.activeTeam ? 'is-active' : ''}"><header><span>${team.id === 0 ? '红' : '蓝'}</span><div><strong>${escapeHtml(team.name)}</strong><small>${team.id === state.myTeam ? '我的队伍' : team.id === state.activeTeam ? '当前密码队' : '对方频道'}</small></div></header><div class="dc-members">${team.members.map(member => { const player = state.players?.find(item => item.id === member.id); return `<span class="${member.id === state.encryptorId ? 'is-encryptor' : ''} ${player?.keyConfirmed ? 'is-key-confirmed' : ''}">${escapeHtml(member.name)}${state.phase === 'keycheck' ? `<i>${player?.keyConfirmed ? '已核对' : '核对中'}</i>` : member.id === state.encryptorId ? '<i>加密员</i>' : ''}</span>`; }).join('')}</div><footer><div><span>截获</span>${markerTrack(team.interceptions || 0, 'interceptions')}</div><div><span>失误</span>${markerTrack(team.miscommunications || 0, 'mistakes')}</div></footer></article>`).join('');
    }

    function renderHistory() {
        const history = (state.history || []).slice().reverse();
        $('historyCount').textContent = `${history.length} 封`;
        $('history').innerHTML = history.length ? history.map(item => `<article class="dc-history-item ${teamClass(item.team)}"><header><span>第 ${item.round} 轮 · ${escapeHtml(item.teamName)}</span>${codeDisplay(item.code, '正确密码')}</header><div class="dc-history-clues">${item.clues.map((clue, index) => `<span><i>${index + 1}</i><b>${escapeHtml(clue)}</b></span>`).join('')}</div><footer><span class="${item.ownGuess?.correct ? 'is-good' : 'is-bad'}">本队猜测 ${(item.ownGuess?.code || []).join('·') || '—'} · ${item.ownGuess?.correct ? '正确' : '失误'}</span>${item.intercept ? `<span class="${item.intercept.correct ? 'is-good' : ''}">对手${item.intercept.correct ? '截获成功' : '未能截获'}</span>` : '<span>首轮跳过截获</span>'}</footer></article>`).join('') : '<div class="dc-history-empty"><span>档</span><p>第一组密码完成解码后，会在这里公开正确密码与线索。</p></div>';
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('logCount').textContent = String(entries.length);
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') : '<p class="dc-log-empty">等待通信开始。</p>';
    }

    function updateTextForm(form) {
        const inputs = [...form.querySelectorAll('[data-text-index]')];
        const values = inputs.map(input => input.value.trim());
        const complete = values.every(Boolean);
        const unique = new Set(values.map(value => value.toLocaleLowerCase())).size === values.length;
        const confirm = form.querySelector('.dc-confirm'); const button = form.querySelector('.dc-primary');
        button.disabled = !complete || !unique;
        const title = confirm.querySelector('strong'); const copy = confirm.querySelector('small');
        title.textContent = !complete ? `${values.filter(Boolean).length} / ${values.length} 项已填写` : !unique ? '存在重复内容' : '内容已经填写完整';
        copy.textContent = !complete ? '填完所有内容后可以提交' : !unique ? '每一项必须使用不同文字' : '确认后将立即发送，不能撤回';
    }

    function openRules(trigger) {
        rulesTrigger = trigger || document.activeElement; bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
        overlay.classList.remove('is-hidden'); overlay.setAttribute('aria-hidden', 'false'); overlay.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }
    function closeRules() {
        if (overlay.classList.contains('is-hidden')) return;
        overlay.classList.add('is-hidden'); overlay.setAttribute('aria-hidden', 'true'); document.body.style.overflow = bodyOverflow; rulesTrigger?.focus?.({ preventScroll: true }); rulesTrigger = null;
    }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) { if (uiButton.dataset.ui === 'leave') leaveRoom?.(); if (uiButton.dataset.ui === 'rules') openRules(uiButton); if (uiButton.dataset.ui === 'closeRules') closeRules(); return; }
        if (event.target === overlay) { closeRules(); return; }
        if (event.target.closest('[data-secret-toggle="keywords"]')) { setKeywordsVisible(!keywordsVisible); if (state?.phase === 'keycheck') renderCommand(); return; }
        const digitButton = event.target.closest('[data-code-digit]');
        if (digitButton) {
            const digit = Number(digitButton.dataset.codeDigit); const existing = codeDraft.indexOf(digit);
            if (existing >= 0) codeDraft.splice(existing, 1); else if (codeDraft.length < 3) codeDraft.push(digit);
            renderCommand(); return;
        }
        const candidate = event.target.closest('[data-encryptor-candidate]');
        if (candidate) { encryptorCandidateId = candidate.dataset.encryptorCandidate; renderCommand(); return; }
        if (event.target.closest('[data-code-reset]')) { codeDraft = []; renderCommand(); return; }
        const action = event.target.closest('[data-action]'); if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmKey') { setKeywordsVisible(false); send({ type: 'gameAction', action: { kind: 'confirmKey' } }); return; }
        if (action.dataset.action === 'confirmEncryptorVote' && encryptorCandidateId) { send({ type: 'gameAction', action: { kind: 'voteEncryptor', playerId: encryptorCandidateId } }); return; }
        if (action.dataset.action === 'confirmIntercept' && codeDraft.length === 3) { send({ type: 'gameAction', action: { kind: 'submitIntercept', code: codeDraft.slice() } }); return; }
        if (action.dataset.action === 'confirmOwnGuess' && codeDraft.length === 3) { send({ type: 'gameAction', action: { kind: 'submitOwnGuess', code: codeDraft.slice() } }); }
    }
    function handleInput(event) { const form = event.target.closest('[data-text-form]'); if (form) updateTextForm(form); }
    function handleSubmit(event) {
        const form = event.target.closest('[data-text-form]'); if (!form) return; event.preventDefault();
        const values = [...form.querySelectorAll('[data-text-index]')].map(input => input.value.trim());
        if (!values.every(Boolean) || new Set(values.map(value => value.toLocaleLowerCase())).size !== values.length) return;
        if (form.dataset.textForm === 'clue') send({ type: 'gameAction', action: { kind: 'submitClue', clues: values } });
        if (form.dataset.textForm === 'tiebreak') send({ type: 'gameAction', action: { kind: 'tiebreakGuess', keywords: values } });
    }
    function handlePointerDown(event) {
        const hold = event.target.closest('[data-code-hold]');
        if (!hold) return;
        event.preventDefault();
        codePointerId = event.pointerId;
        hold.setPointerCapture?.(event.pointerId);
        setCodeVisible(true);
        if (state?.phase === 'clue') { renderKeywords(); renderCommand(); }
    }
    function handlePointerEnd(event) {
        if (codePointerId === null || (event.pointerId !== undefined && event.pointerId !== codePointerId)) return;
        codePointerId = null;
        setCodeVisible(false);
    }
    function handlePointerOut(event) {
        if (codePointerId === null || event.pointerId !== codePointerId) return;
        const hold = event.target.closest('[data-code-hold]');
        if (hold && !hold.contains(event.relatedTarget)) handlePointerEnd(event);
    }
    function handleKeydown(event) {
        if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) { closeRules(); return; }
        const hold = event.target.closest?.('[data-code-hold]');
        if (!hold || (event.key !== ' ' && event.key !== 'Enter') || event.repeat) return;
        event.preventDefault();
        codeRevealKey = event.key;
        setCodeVisible(true);
        if (state?.phase === 'clue') { renderKeywords(); renderCommand(); }
    }
    function handleKeyup(event) { if (codeRevealKey && event.key === codeRevealKey) { codeRevealKey = null; setCodeVisible(false); } }
    function concealPrivateInformation() { setKeywordsVisible(false); setCodeVisible(false); codePointerId = null; codeRevealKey = null; }
    function handleVisibilityChange() { if (document.hidden) concealPrivateInformation(); }

    mount.addEventListener('click', handleClick);
    mount.addEventListener('input', handleInput);
    mount.addEventListener('submit', handleSubmit);
    mount.addEventListener('pointerdown', handlePointerDown);
    mount.addEventListener('pointerup', handlePointerEnd);
    mount.addEventListener('pointercancel', handlePointerEnd);
    mount.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', concealPrivateInformation);
    return {
        gameType: 'decrypto',
        handleMessage(message) {
            if (message.state) {
                const previous = state;
                state = message.state;
                render();
                const scenes = transitionScenes(previous, state);
                if (scenes.length) playScenes(scenes);
            }
            if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
        },
        destroy() {
            sceneSequence += 1; hideScene(); concealPrivateInformation();
            mount.removeEventListener('click', handleClick); mount.removeEventListener('input', handleInput); mount.removeEventListener('submit', handleSubmit);
            mount.removeEventListener('pointerdown', handlePointerDown); mount.removeEventListener('pointerup', handlePointerEnd); mount.removeEventListener('pointercancel', handlePointerEnd); mount.removeEventListener('pointerout', handlePointerOut);
            document.removeEventListener('keydown', handleKeydown); document.removeEventListener('keyup', handleKeyup); document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('blur', concealPrivateInformation);
            closeRules(); document.body.classList.remove('is-decrypto-view'); style.remove(); mount.innerHTML = '';
        },
    };
}
