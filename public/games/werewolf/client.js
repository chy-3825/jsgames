const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const ROLE = {
    werewolf: { name: '狼人', image: 'langr.png', text: '与狼队在夜里投票，决定今夜的袭击目标。' }, seer: { name: '预言家', image: 'yyj.png', text: '每夜查验一名玩家，得知对方属于狼人或好人阵营。' },
    witch: { name: '女巫', image: 'nw.png', text: '拥有一瓶解药和一瓶毒药，每瓶整局只能使用一次。' }, hunter: { name: '猎人', image: 'lr.png', text: '并非被毒药带走时，可以开枪带走一名玩家。' },
    guard: { name: '守卫', image: 'sw.png', text: '每夜守护一名玩家，但不能连续两夜守护同一个人。' }, villager: { name: '平民', image: 'pm.png', text: '从发言和投票中辨认真相，找出藏在人群中的狼人。' },
};

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = `/games/werewolf/style.css?v=${Date.now()}`; document.head.appendChild(style);
    const controller = new AbortController();
    let state = null;
    let lastActionAt = 0;
    let lastActionKey = '';
    let targetDialog = null;
    let roleIdentityVisible = false;
    let roleRevealPointerId = null;
    let roleRevealKey = null;
    let timedFlowInterval = null;
    let transitionTimer = null;
    let transitionResultTimer = null;
    let transitionSequence = 0;
    let lastAnnouncementDayKey = '';
    let eliminationTimer = null;
    let eliminationShatterTimer = null;
    let eliminationSequence = 0;
    let lastEliminationKey = '';
    let voiceEnabled = false;
    let confirmingAllRoles = false;
    const testRoleBySeat = new Map();
    mount.innerHTML = `
        <section class="ww-app">
            <header class="ww-header">
                <div class="ww-brand"><span>狼</span><div><small data-role="boardSize">9 / 12 人 · 无主持人模式</small><h1>狼人杀 · 夜幕助手</h1></div></div>
                <div class="ww-phase" data-role="phase">等待开始</div>
                <div class="ww-header-actions"><button data-ui="voice" type="button" aria-pressed="false">语音：关</button><button data-ui="rules" type="button">本局规则</button><button data-ui="leave" type="button">离开</button></div>
            </header>
            <main class="ww-layout">
                <aside class="ww-seat-panel">
                    <div class="ww-section-title"><span data-role="seatTitle">玩家席位</span><small data-role="mode"></small></div>
                    <p class="ww-debug-hint" data-role="seatHint">你的号码会被点亮；身份与夜间行动只会出现在你的界面。</p>
                    <div class="ww-seats" data-role="seats"></div>
                    <div class="ww-seat-tools is-hidden" data-role="seatTools"><button class="is-hidden" data-ui="confirmAllRoles" type="button">测试：确认全部身份</button><small data-role="testHelp">单人座位测试模式可一次确认全部座位</small></div>
                </aside>
                <section class="ww-screen">
                    <div class="ww-screen-bar"><span><i></i> <b data-role="screenMode">你的秘密界面</b></span><strong data-role="screen-seat">等待入座</strong></div>
                    <section class="ww-flow" aria-live="polite">
                        <div class="ww-flow-stage is-current"><small>此刻</small><strong data-role="currentPhase">静候开局</strong></div>
                        <span class="ww-flow-arrow">→</span>
                        <div class="ww-flow-stage"><small>接下来</small><strong data-role="nextPhase">序幕将启</strong></div>
                        <div class="ww-flow-progress"><div><span data-role="phaseProgress">等待玩家</span><b data-role="phaseProgressCount">0/0</b></div><div class="ww-flow-track"><i data-role="phaseProgressBar"></i></div><p data-role="phaseInstruction"></p></div>
                    </section>
                    <section class="ww-announcement is-hidden" data-role="announcement" aria-live="polite"></section>
                    <div class="ww-screen-body">
                        <section class="ww-main"><div class="ww-role" data-role="role"></div><div class="ww-action" data-role="action"></div></section>
                        <aside class="ww-screen-side">
                            <section class="ww-public-card"><div class="ww-section-title"><span>在场玩家</span><small>全场可见</small></div><div class="ww-public-seats" data-role="publicSeats"></div></section>
                            <section class="ww-public-card ww-sheriff-state" data-role="sheriffState"></section>
                            <section class="ww-public-card ww-vote-result" data-role="voteResult"></section>
                            <section class="ww-public-card"><div class="ww-section-title"><span>游戏纪事</span><small>本局足迹</small></div><div class="ww-log" data-role="log"></div></section>
                            <section class="ww-auto-note"><strong>无需主持人</strong><p>每个人完成自己的行动后，游戏会自然继续；夜间结果与放逐票型将在合适的时刻公布。</p></section>
                        </aside>
                    </div>
                    <div class="ww-target-overlay is-hidden" data-role="targetModal"><article class="ww-target-dialog" role="dialog" aria-modal="true" aria-labelledby="wwTargetTitle"><button class="ww-target-close" data-ui="closeTarget" type="button" aria-label="取消选择">×</button><small data-role="targetKicker">选择对象</small><h2 id="wwTargetTitle" data-role="targetTitle">选择目标</h2><p data-role="targetDescription"></p><div class="ww-target-grid" data-role="targetGrid"></div><div class="ww-target-selection" data-role="targetSelection">还没有选择</div><div class="ww-target-actions"><button data-ui="cancelTarget" type="button">取消</button><button class="ww-target-confirm" data-ui="confirmTarget" type="button" disabled>确定选择</button></div></article></div>
                </section>
            </main>
            <div class="ww-transition is-hidden" data-role="transition" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div class="ww-transition-surface"><div class="ww-transition-title" data-role="transitionTitle"></div><div class="ww-transition-result" data-role="transitionResult"></div></div></div>
            <div class="ww-elimination is-hidden" data-role="elimination" role="status" aria-live="assertive" aria-atomic="true" aria-hidden="true"><div class="ww-elimination-plate"><strong>您已出局</strong></div><div class="ww-elimination-fragments" aria-hidden="true">${eliminationFragments()}</div></div>
            <div class="ww-overlay is-hidden" data-role="rules"><article><button data-ui="closeRules" type="button">×</button><small>本局约定</small><h2>开始前请知晓</h2><ol><li>9 人局为 3 狼、4 神、2 民；12 人局为 4 狼、4 神、4 民。四名神职为预言家、女巫、猎人和守卫。</li><li>所有玩家都记下自己的身份后，第一夜才会降临。</li><li>身份默认隐藏；按住身份区域可以查看，松开后会立即遮住。</li><li>好人采用屠边胜利条件：所有平民或所有神职出局后狼人获胜；狼人全部出局则好人获胜。</li><li>首日依次进行上警报名、警上发言、退水和警长投票；首轮平票进行一次 PK，第二轮仍平票则本局没有警长。</li><li>警长在白天放逐投票中拥有 1.5 票；出局时可以移交或撕毁警徽。</li><li>狼人袭击和白天放逐若首轮平票，都会再投一轮；第二轮只能投给首轮平票目标。</li><li>夜间行动、白天发言与放逐投票会在相关玩家全部完成后继续，无需额外主持人。</li><li>出局玩家会在自己的界面完成离场行动；猎人可以选择开枪或放弃。</li></ol></article></div>
        </section>`;
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    function setRoleIdentityVisible(visible) {
        roleIdentityVisible = Boolean(visible && state?.myRole);
        const roleCard = $('role');
        const roleSecret = roleCard?.querySelector('[data-role-secret]');
        const roleHold = roleCard?.querySelector('[data-role-hold]');
        roleCard?.classList.toggle('is-revealed', roleIdentityVisible);
        roleSecret?.setAttribute('aria-hidden', String(!roleIdentityVisible));
        roleHold?.setAttribute('aria-pressed', String(roleIdentityVisible));
        roleHold?.setAttribute('aria-label', roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏');
    }
    function hideRoleIdentity() {
        roleRevealPointerId = null;
        roleRevealKey = null;
        setRoleIdentityVisible(false);
    }
    function transitionAnnouncementKey(announcement) {
        return announcement ? `${announcement.day}:${announcement.kind || 'night'}` : '';
    }
    function eliminationNoticeKey(notice) {
        return notice ? `${notice.day}:${notice.seat}:${notice.source}` : '';
    }
    function eliminationFragments() {
        return Array.from({ length: 35 }, (_, index) => {
            const column = index % 7;
            const row = Math.floor(index / 7);
            const horizontal = column < 3 ? -1 : 1;
            const x = horizontal * (70 + ((index * 47) % 190));
            const y = (row - 2) * 54 + ((index * 31) % 90) - 45;
            const rotation = horizontal * (18 + ((index * 37) % 78));
            const delay = (index % 9) * 18;
            return `<i style="--fx:${x}px;--fy:${y}px;--fr:${rotation}deg;--fd:${delay}ms"></i>`;
        }).join('');
    }
    function transitionGlyphs(text) {
        return [...String(text || '')].map((character, index) => {
            const safeCharacter = character === ' ' ? '\u00a0' : character;
            const shards = Array.from({ length: 12 }, (_, shardIndex) => {
                const x = 100 + ((index * 43 + shardIndex * 61) % 180);
                const y = ((index * 29 + shardIndex * 47) % 160) - 112;
                const middleX = 30 + ((index * 17 + shardIndex * 29) % 62);
                const middleY = ((index * 13 + shardIndex * 23) % 54) - 38;
                const rotation = ((index * 37 + shardIndex * 53) % 300) - 150;
                const middleRotation = ((index * 19 + shardIndex * 31) % 90) - 45;
                const width = 1 + ((index + shardIndex * 2) % 6);
                const height = 2 + ((index * 2 + shardIndex * 3) % 7);
                const delay = (shardIndex % 6) * 38;
                const trail = 12 + ((index * 11 + shardIndex * 17) % 30);
                const opacity = (.58 + ((index + shardIndex * 3) % 38) / 100).toFixed(2);
                return `<i class="ww-transition-shard" aria-hidden="true" style="--sx:${x}px;--sy:${y}px;--mx:${middleX}px;--my:${middleY}px;--srot:${rotation}deg;--mrot:${middleRotation}deg;--sw:${width}px;--sh:${height}px;--sd:${delay}ms;--trail:${trail}px;--so:${opacity}"></i>`;
            }).join('');
            return `<span class="ww-transition-glyph" style="--i:${index};--gd:${index * 60}ms"><b>${escapeHtml(safeCharacter)}</b>${shards}</span>`;
        }).join('');
    }
    function setTransitionText(element, text) {
        const value = String(text || '');
        element.innerHTML = transitionGlyphs(value);
        element.setAttribute('aria-label', value);
    }
    function speakTransition(text) {
        if (!voiceEnabled || !text || typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = .88;
        utterance.pitch = .92;
        window.speechSynthesis.speak(utterance);
    }
    function hideTransition() {
        if (transitionTimer) clearTimeout(transitionTimer);
        if (transitionResultTimer) clearTimeout(transitionResultTimer);
        transitionTimer = null;
        transitionResultTimer = null;
        transitionSequence += 1;
        const element = $('transition');
        element?.classList.add('is-hidden');
        element?.setAttribute('aria-hidden', 'true');
        mount.querySelector('.ww-app')?.classList.remove('is-transitioning');
    }
    function showTransition(kind, announcement = null, onComplete = null) {
        const element = $('transition');
        const appRoot = mount.querySelector('.ww-app');
        if (!element || !appRoot) return;
        if (transitionTimer) clearTimeout(transitionTimer);
        if (transitionResultTimer) clearTimeout(transitionResultTimer);
        const sequence = ++transitionSequence;
        const title = element.querySelector('[data-role="transitionTitle"]');
        const result = element.querySelector('[data-role="transitionResult"]');
        const isNight = kind === 'night';
        const deaths = Array.isArray(announcement?.deaths) ? announcement.deaths : [];
        const resultText = announcement?.peaceful ? '昨夜是平安夜' : `昨夜的死者是 ${deaths.join('、')} 号`;
        element.className = `ww-transition ${isNight ? 'is-night' : 'is-day'}${!isNight && announcement?.peaceful ? ' is-peaceful' : ''}${!isNight && !announcement?.peaceful ? ' is-danger' : ''}`;
        element.classList.remove('show-result');
        element.setAttribute('aria-hidden', 'false');
        appRoot.classList.add('is-transitioning');
        setTransitionText(title, isNight ? '天黑请闭眼' : '天亮了');
        setTransitionText(result, isNight ? '' : resultText);
        speakTransition(isNight ? '天黑请闭眼' : announcement?.peaceful ? '天亮了。昨夜是平安夜。' : `天亮了。昨夜的死者是${deaths.join('、')}号。`);
        if (!isNight) {
            transitionResultTimer = setTimeout(() => {
                if (sequence !== transitionSequence) return;
                element.classList.add('show-result');
            }, 3200);
        }
        transitionTimer = setTimeout(() => {
            if (sequence !== transitionSequence) return;
            hideTransition();
            onComplete?.();
        }, isNight ? 4450 : 7900);
    }
    function hidePersonalElimination() {
        if (eliminationTimer) clearTimeout(eliminationTimer);
        if (eliminationShatterTimer) clearTimeout(eliminationShatterTimer);
        eliminationTimer = null;
        eliminationShatterTimer = null;
        eliminationSequence += 1;
        const element = $('elimination');
        element?.classList.add('is-hidden');
        element?.classList.remove('is-entering', 'is-shattering');
        element?.setAttribute('aria-hidden', 'true');
        mount.querySelector('.ww-app')?.classList.remove('is-eliminating');
    }
    function showPersonalElimination() {
        const element = $('elimination');
        const appRoot = mount.querySelector('.ww-app');
        if (!element || !appRoot) return;
        hidePersonalElimination();
        const sequence = ++eliminationSequence;
        element.className = 'ww-elimination is-entering';
        element.setAttribute('aria-hidden', 'false');
        appRoot.classList.add('is-eliminating');
        speakTransition('您已出局');
        eliminationShatterTimer = setTimeout(() => {
            if (sequence === eliminationSequence) element.classList.add('is-shattering');
        }, 3150);
        eliminationTimer = setTimeout(() => {
            if (sequence === eliminationSequence) hidePersonalElimination();
        }, 4650);
    }
    function maybePlayTransition(previous, next) {
        if (!next || next.status === 'ended') return;
        const eliminationKey = eliminationNoticeKey(next.eliminationNotice);
        if (!previous) {
            // Initial snapshots (including reconnects) describe the current
            // state, rather than a newly entered phase. Do not replay a stale
            // announcement or overlay while hydrating the page.
            lastAnnouncementDayKey = transitionAnnouncementKey(next.announcement);
            lastEliminationKey = eliminationKey;
            return;
        }
        const previousPhase = previous?.phase || '';
        const nextPhase = next.phase || '';
        const wasNight = previousPhase.startsWith('night');
        const isNight = nextPhase.startsWith('night');
        if (isNight && !wasNight) showTransition('night');
        const announcementKey = transitionAnnouncementKey(next.announcement);
        const newPersonalElimination = Boolean(eliminationKey && eliminationKey !== lastEliminationKey);
        if (newPersonalElimination) lastEliminationKey = eliminationKey;
        if (announcementKey && announcementKey !== lastAnnouncementDayKey) {
            lastAnnouncementDayKey = announcementKey;
            showTransition('day', next.announcement, newPersonalElimination ? showPersonalElimination : null);
        } else if (newPersonalElimination) {
            showPersonalElimination();
        }
    }
    function updateVoiceButton() {
        const button = mount.querySelector('[data-ui="voice"]');
        if (!button) return;
        button.textContent = voiceEnabled ? '语音：开' : '语音：关';
        button.setAttribute('aria-pressed', String(voiceEnabled));
    }
    function confirmAllRolesForTest() {
        if (!state?.testMode || state.phase !== 'roleReveal' || confirmingAllRoles) return;
        const pendingSeats = (state.seats || []).filter(seat => seat.canControl && !seat.roleConfirmed).map(seat => seat.number);
        if (!pendingSeats.length) return;
        confirmingAllRoles = true;
        render();
        // These are existing, stable actions and WebSocket messages are
        // processed in order: select a seat, then confirm that seat.
        pendingSeats.forEach(seat => {
            send({ type: 'gameAction', action: { kind: 'switchSeat', seat } });
            send({ type: 'gameAction', action: { kind: 'confirmRole' } });
        });
    }
    function render() {
        if (!state) return;
        if (state.phase !== 'roleReveal') confirmingAllRoles = false;
        const seats = Array.isArray(state.seats) ? state.seats : [];
        const appRoot = mount.querySelector('.ww-app');
        const isNight = String(state.phase || '').startsWith('night');
        appRoot?.classList.toggle('is-night', isNight);
        appRoot?.classList.toggle('is-day', !isNight && state.status !== 'ended');
        appRoot?.classList.toggle('is-my-turn', Boolean(isNight && state.skillState?.available));
        appRoot?.classList.toggle('is-flow-paused', Boolean(state.flowPaused));
        appRoot?.classList.toggle('is-test-mode', Boolean(state.testMode));
        updateVoiceButton();
        const boardSize = state.playerCount || seats.length;
        if ($('boardSize')) $('boardSize').textContent = `${boardSize} 人局 · 无主持人模式`;
        if ($('seatTitle')) $('seatTitle').textContent = state.testMode ? '测试席位' : '玩家席位';
        if ($('seatHint')) $('seatHint').textContent = state.testMode ? '测试模式：可自由切换席位，查看每个身份与行动界面。' : '你的号码会被点亮；身份与夜间行动只会出现在你的界面。';
        if ($('screenMode')) $('screenMode').textContent = state.testMode ? '测试视角' : '你的秘密界面';
        if ($('testHelp')) $('testHelp').textContent = `单人座位测试模式可一次确认 ${boardSize} 个座位`;
        $('phase').textContent = state.status === 'ended' ? state.winner?.name || '本局结束' : `${state.day ? `第 ${state.day} 天 · ` : ''}${state.phaseName || '静候开局'}`;
        $('mode').textContent = state.testMode ? `单人 · ${boardSize} 席测试` : `${boardSize} 人局`;
        $('currentPhase').textContent = state.status === 'ended' ? state.winner?.name || '本局结束' : state.phaseName || '静候开局';
        $('nextPhase').textContent = state.nextPhaseName || '静候揭晓';
        const progress = state.phaseProgress || { completed: 0, total: 0, label: '等待玩家' };
        $('phaseProgress').textContent = progress.label;
        $('phaseProgressCount').textContent = `${progress.completed}/${progress.total}`;
        $('phaseInstruction').textContent = state.phaseInstruction || '';
        const progressBar = $('phaseProgressBar');
        if (progressBar) progressBar.style.width = `${progress.total ? Math.min(100, progress.completed / progress.total * 100) : 0}%`;
        const screenSeat = mount.querySelector('[data-role="screen-seat"]');
        if (screenSeat) screenSeat.textContent = state.activeSeat ? state.testMode ? `正在查看 ${state.activeSeat} 号` : `你是 ${state.activeSeat} 号玩家` : '等待入座';
        const seatStatus = seat => state.phase === 'roleReveal' ? seat.roleConfirmed ? '已经记下身份' : '尚未确认身份' : state.phase === 'day' && seat.alive ? seat.dayReady ? '发言结束' : '等待发言' : seat.alive ? seat.number === state.activeSeat ? state.testMode ? '当前测试视角' : '你的位置' : '在场' : '已出局';
        $('seats').innerHTML = seats.map(seat => {
            const role = state.testMode ? seat.role || testRoleBySeat.get(seat.number) : '';
            const roleName = role ? ROLE[role]?.name || role : '';
            const seatLabel = roleName || seat.controllerName || (state.testMode ? '虚拟座位' : '等待入座');
            const statusLabel = roleName ? `${seat.controllerName || '虚拟座位'} · ${seatStatus(seat)}` : seatStatus(seat);
            return `<button type="button" data-seat="${seat.number}" class="ww-seat ${seat.number === state.activeSeat ? 'is-active' : ''} ${seat.alive ? '' : 'is-dead'} ${state.phase === 'roleReveal' && seat.roleConfirmed ? 'is-confirmed' : ''} ${state.phase === 'day' && seat.alive ? seat.dayReady ? 'is-day-ready' : 'is-day-pending' : ''}" ${seat.canControl ? '' : 'disabled'}><b>${seat.number}</b><span>${escapeHtml(seatLabel)}</span><small>${escapeHtml(statusLabel)}</small></button>`;
        }).join('') || '<p class="ww-empty">夜幕尚未降临…</p>';
        const confirmAllButton = mount.querySelector('[data-ui="confirmAllRoles"]');
        const canConfirmAll = Boolean(state.testMode && state.phase === 'roleReveal');
        $('seatTools')?.classList.toggle('is-hidden', !state.testMode);
        confirmAllButton?.classList.toggle('is-hidden', !canConfirmAll);
        if (confirmAllButton) {
            confirmAllButton.disabled = !canConfirmAll || confirmingAllRoles;
            confirmAllButton.textContent = confirmingAllRoles ? '正在确认全部身份…' : '测试：一键确认全部身份';
        }
        const publicSeats = mount.querySelector('[data-role="publicSeats"]');
        if (publicSeats) publicSeats.innerHTML = seats.map(seat => `<span class="ww-public-seat ${seat.alive ? 'is-alive' : 'is-dead'} ${seat.isSheriff ? 'is-sheriff' : ''}"><b>${seat.number}${seat.isSheriff ? '<i>警</i>' : ''}</b>${state.status === 'ended' && seat.role ? escapeHtml(ROLE[seat.role]?.name || seat.role) : state.phase === 'roleReveal' ? seat.roleConfirmed ? '已确认' : '待确认' : seat.alive ? '存活' : '出局'}</span>`).join('');
        renderSheriffState();
        renderAnnouncement();
        renderVoteResult();
        renderRole(); renderAction();
        scheduleTimedFlow();
        $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i>${escapeHtml(entry)}</p>`).join('');
    }
    function renderAnnouncement() {
        const element = $('announcement');
        if (!element) return;
        if (!state.announcement) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        element.classList.remove('is-hidden');
        const label = state.announcement.peaceful ? '晨光揭晓 · 平安夜' : `晨光揭晓 · 第 ${state.announcement.day} 天`;
        element.innerHTML = `<small>${label}</small><strong>${escapeHtml(state.announcement.text)}</strong><span>${state.phase === 'lastWords' ? '请出局玩家依次留下遗言' : state.phase === 'day' ? '白天发言即将开始' : ''}</span>`;
    }
    function renderVoteResult() {
        const element = $('voteResult');
        if (!element) return;
        const result = state.lastVoteResult;
        if (!result) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        const ballots = result.ballots?.map(ballot => `${ballot.voterSeat}→${ballot.targetSeat}`).join(' · ') || '无票';
        const counts = Object.entries(result.counts || {}).map(([seat, count]) => `${seat}号 ${count}票`).join(' · ') || '无票';
        element.classList.remove('is-hidden');
        element.innerHTML = `<div class="ww-section-title"><span>上一轮票型</span><small>全场可见</small></div><strong>${escapeHtml(result.message || '投票结束')}</strong><p>每人的选择：${escapeHtml(ballots)}</p><p>最终票数：${escapeHtml(counts)}</p>`;
    }
    function renderSheriffState() {
        const element = $('sheriffState');
        if (!element) return;
        const sheriff = state.sheriff;
        if (!sheriff?.enabled) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        element.classList.remove('is-hidden');
        const result = sheriff.results?.at(-1);
        const ballots = result?.ballots?.map(ballot => `${ballot.voterSeat}→${ballot.targetSeat ?? '弃'}`).join(' · ');
        const summary = sheriff.holderSeat ? `${sheriff.holderSeat} 号持有警徽` : sheriff.status === 'torn' ? '警徽已撕毁' : sheriff.status === 'none' ? '本局没有警长' : '警长竞选正在进行';
        element.innerHTML = `<div class="ww-section-title"><span>警徽归属</span><small>全场可见</small></div><strong>${escapeHtml(summary)}</strong>${sheriff.candidates?.length ? `<p>候选人：${sheriff.candidates.join('、')} 号</p>` : ''}${ballots ? `<p>上一轮票型：${escapeHtml(ballots)}</p>` : ''}`;
    }
    function renderRole() {
        const role = ROLE[state.myRole];
        if (!role) { roleIdentityVisible = false; $('role').innerHTML = '<p>入局后，你的身份会在这里悄然揭晓。</p>'; return; }
        const skillStatus = state.phase === 'roleReveal' ? state.myRoleConfirmed ? '你已记下自己的身份' : '请看清并记住你的身份' : state.hunterAction?.available || state.canConfirmDeathResolution ? '请完成你的离场行动' : state.myDeathResolutionSettled ? '你的离场行动已经完成' : state.nightConfirmation ? state.nightConfirmation.stage === 'result' ? '请记住查验结果' : '请确认你的选择' : state.wolfVote ? state.wolfVote.resolved ? state.wolfVote.noKill ? '两轮平票，今夜无人遇袭' : `今夜目标：${state.wolfVote.resultTarget} 号` : state.wolfVote.myTarget ? `你已选择 ${state.wolfVote.myTarget} 号，静候同伴（${state.wolfVote.submittedCount}/${state.wolfVote.totalWolves}）` : `第 ${state.wolfVote.round} 轮，请选择目标` : state.skillState?.submitted ? '今夜的行动已经决定' : state.skillState?.available ? '夜色正在等待你的选择' : '夜色尚未呼唤你';
        $('role').innerHTML = `<div class="ww-role-secret" data-role-secret aria-hidden="${String(!roleIdentityVisible)}"><div class="ww-role-art"><img src="/assets/werewolf-netease/characters/${role.image}" alt="${role.name}"></div><div><small>${state.activeSeat} 号玩家 · 仅你可见</small><h2>${role.name}</h2><p>${role.text}</p><span class="ww-skill-status ${state.skillState?.available ? 'is-ready' : ''} ${state.skillState?.submitted ? 'is-used' : ''}">${skillStatus}</span>${state.seerResult ? `<strong class="ww-result">查验结果：${state.seerResult.seat} 号是${state.seerResult.faction === 'wolf' ? '狼人' : '好人'}</strong>` : ''}</div></div><button class="ww-role-cover" data-role-hold type="button" aria-pressed="${String(roleIdentityVisible)}" aria-label="${roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏'}"><span>身份已经隐藏</span><b>按住查看身份</b><small>松开或移出后立即遮住 · 也可按住空格 / Enter</small></button>`;
        setRoleIdentityVisible(roleIdentityVisible);
    }
    function renderNightConfirmation() {
        const confirmation = state.nightConfirmation;
        if (!confirmation) return '';
        if (confirmation.stage === 'result') {
            const faction = state.seerResult?.faction === 'wolf' ? '狼人' : '好人';
            return `<section class="ww-night-confirmation is-result"><small>第三步 · 记住查验结果</small><strong>${confirmation.targetSeat} 号是 <b>${faction}</b></strong><p>请记住这个结果，确认后继续保持安静，不要向其他玩家展示。</p><button class="ww-confirm-button is-ready" data-action="confirmSeerResult" type="button"><span>✓</span><b>我已看清</b><small>结束今夜的查验</small></button></section>`;
        }
        const summary = confirmation.role === 'guard' ? `守护 ${confirmation.targetSeat} 号玩家`
            : confirmation.role === 'werewolf' ? `将袭击票投给 ${confirmation.targetSeat} 号玩家`
                : confirmation.role === 'seer' ? `查验 ${confirmation.targetSeat} 号玩家`
                    : confirmation.choice === 'save' ? `对 ${confirmation.targetSeat || state.wolfSeat} 号使用解药`
                        : confirmation.choice === 'poison' ? `对 ${confirmation.targetSeat} 号使用毒药` : '本夜不使用任何药物';
        return `<section class="ww-night-confirmation"><small>第二步 · 确认你的选择</small><strong>${escapeHtml(summary)}</strong><p>请再核对一次。确定后，本次选择将不能更改。</p><div class="ww-witch-skills"><button class="ww-confirm-button is-ready" data-action="confirmNightAction" type="button"><span>✓</span><b>确定选择</b><small>${confirmation.role === 'seer' ? '确定后揭示对方阵营' : '确定后等待夜晚继续'}</small></button><button class="ww-skill-button" data-action="cancelNightAction" type="button"><span>↩</span><b>返回重选</b><small>当前选择还未生效</small></button></div></section>`;
    }
    function renderAction() {
        if (state.status === 'ended') { const reveal = (state.seats || []).filter(seat => seat.role).map(seat => `<span class="ww-final-role"><b>${seat.number}号</b>${escapeHtml(ROLE[seat.role]?.name || seat.role)}${seat.isSheriff ? ' · 警长' : ''}</span>`).join(''); $('action').innerHTML = `<h3>${escapeHtml(state.winner?.name || '本局结束')}</h3><p>本局身份：</p><div class="ww-final-roles">${reveal}</div>`; return; }
        const phase = state.phase || 'waiting';
        let html = `<div class="ww-action-head"><div><small>游戏引导</small><h3>${escapeHtml(state.phaseName || '静候开局')}</h3></div><span class="ww-auto-badge">${state.flowPaused ? '等待玩家归来' : state.testMode ? '测试模式 · 自动继续' : '行动完成后继续'}</span></div>`;
        if (state.flowPaused) { $('action').innerHTML = `${html}<div class="ww-waiting">${escapeHtml(state.phaseInstruction || '有玩家暂时离线，游戏会等他回来。')}</div>`; return; }
        const role = state.myRole;
        const activeSeat = state.seats.find(seat => seat.number === state.activeSeat);
        if (phase === 'roleReveal') html += state.myRoleConfirmed ? `<div class="ww-skill-complete">你已记下身份，还差 ${Math.max(0, state.phaseProgress.total - state.phaseProgress.completed)} 位玩家。请不要向身边的人展示。</div>` : `<p>请仔细阅读上方身份与技能，记住后遮住卡面再继续。</p><button class="ww-confirm-button is-ready" data-action="confirmRole" type="button"><span>✓</span><b>我已记住身份</b><small>${state.phaseProgress.total || state.playerCount} 人全部确认后，第一夜降临</small></button>`;
        else if (phase === 'deathResolution' && state.hunterAction?.available) html += '<p>这是你离场前的专属时刻。你可以开枪带走一名存活玩家，也可以放弃。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="hunter-shoot" type="button"><span>枪</span><b>选择开枪目标</b><small>带走一名存活玩家</small></button><button class="ww-skill-button" data-open-skill="hunter-pass" type="button"><span>过</span><b>放弃开枪</b><small>独自离场，不带走任何人</small></button></div>';
        else if (phase === 'deathResolution' && state.sheriffBadgeAction?.available) html += '<p>你带着警徽出局了。请选择将警徽交给一名存活玩家，或亲手撕毁它。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="badge-transfer" type="button"><span>警</span><b>移交警徽</b><small>选择一名存活玩家</small></button><button class="ww-skill-button" data-action="tearBadge" type="button"><span>撕</span><b>撕毁警徽</b><small>本局不再产生警长</small></button></div>';
        else if (phase === 'deathResolution' && state.canConfirmDeathResolution) html += '<p>你没有额外的离场技能。准备好后确认离场，你的身份仍会保密。</p><button class="ww-confirm-button is-ready" data-action="confirmDeathResolution" type="button"><span>别</span><b>我已准备离场</b><small>不会向其他玩家公开你的身份</small></button>';
        else if (phase === 'deathResolution' && state.myDeathResolutionSettled) html += '<div class="ww-skill-complete">你的离场行动已经完成，请等待其他出局玩家。</div>';
        else if (phase === 'deathResolution') html += '<div class="ww-waiting">出局玩家正在完成各自的离场行动，请稍候。</div>';
        else if (state.canConfirmDeadRole) html += '<p>你已经出局，今夜无需发动这个身份的技能。确认后请继续保持安静。</p><button class="ww-confirm-button" data-action="confirmDeadRole" type="button"><span>过</span><b>今夜不行动</b><small>你的身份仍然不会公开</small></button>';
        else if (state.nightConfirmation) html += renderNightConfirmation();
        else if (phase === 'sheriffSignup') html += state.sheriffAction?.kind === 'signup' && !state.sheriffAction.submitted ? `<p>请选择是否参加警长竞选。在所有人作出选择前，你的决定不会公开。</p><b class="ww-turn-timer">${state.sheriff?.remainingSeconds ?? '--'}s</b><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-action="sheriffRun" type="button"><span>警</span><b>我要上警</b><small>参加警长竞选</small></button><button class="ww-skill-button" data-action="sheriffSkip" type="button"><span>下</span><b>不上警</b><small>稍后拥有投票权</small></button></div>` : '<div class="ww-skill-complete">你的上警选择已经记下，其他玩家仍在决定。</div>';
        else if (phase === 'sheriffCampaign') html += state.sheriffAction?.kind === 'campaign' ? `<p>轮到你进行警上发言。发言结束后选择继续竞选或退水。</p><b class="ww-turn-timer">${state.sheriff?.remainingSeconds ?? '--'}s</b><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-action="sheriffStay" type="button"><span>留</span><b>继续竞选</b><small>保留警长候选资格</small></button><button class="ww-skill-button" data-action="sheriffWithdraw" type="button"><span>退</span><b>退水</b><small>退出本次警长竞选</small></button></div>` : `<div class="ww-waiting">请听 ${state.sheriff?.currentCandidate || '当前'} 号完成警上发言。</div>`;
        else if (phase === 'sheriffVote' || phase === 'sheriffRunoffVote') html += state.sheriffAction?.kind === 'vote' ? state.sheriffAction.submitted ? '<div class="ww-skill-complete">你的警长票已经投出，请等待其他玩家。</div>' : '<p>请选择一名候选人担任警长，也可以弃票。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="sheriff-vote" type="button"><span>票</span><b>选择警长候选人</b><small>确定后不能修改</small></button><button class="ww-skill-button" data-action="sheriffAbstain" type="button"><span>弃</span><b>弃票</b><small>本轮不支持任何候选人</small></button></div>' : '<div class="ww-waiting">候选人不参与本轮警长投票，请等待投票结束。</div>';
        else if (phase === 'sheriffRunoffSpeech') html += state.sheriffAction?.kind === 'runoffSpeech' ? `<p>轮到你进行警长平票 PK 发言。</p><b class="ww-turn-timer">${state.sheriff?.remainingSeconds ?? '--'}s</b><button class="ww-confirm-button is-ready" data-action="finishSheriffRunoffSpeech" type="button"><span>言</span><b>完成 PK 发言</b><small>结束后轮到下一位</small></button>` : `<div class="ww-waiting">请听 ${state.sheriff?.currentCandidate || '当前'} 号完成 PK 发言。</div>`;
        else if (phase === 'nightWolf' && role === 'werewolf' && !activeSeat?.alive) html += '<div class="ww-waiting">你已经出局，不参与今夜的狼人投票。</div>';
        else if (phase === 'nightGuard' && role === 'guard') html += '<p>守卫请睁眼。选择一名玩家，守护他度过今夜。</p><button class="ww-skill-button is-ready" data-open-skill="guard" type="button"><span>守</span><b>选择守护目标</b><small>选择一名存活玩家</small></button>';
        else if (phase === 'nightWolf' && role === 'werewolf') html += state.wolfVote?.myTarget ? `<div class="ww-skill-complete">你选择了 ${state.wolfVote.myTarget} 号，其他狼人仍在决定（${state.wolfVote.submittedCount}/${state.wolfVote.totalWolves}）。</div>` : `<p>${state.wolfVote?.round === 2 ? `第一轮平票${state.wolfVote.tiedTargets?.length ? `（${state.wolfVote.tiedTargets.join('、')}号）` : ''}，请进行最后一轮投票。` : '每名存活狼人各投一票，所有人选择后再一同揭晓。'}</p><button class="ww-skill-button is-ready" data-open-skill="wolf" type="button"><span>票</span><b>选择袭击目标</b><small>第 ${state.wolfVote?.round || 1} 轮 · 不能选择狼人同伴</small></button>`;
        else if (phase === 'nightSeer' && role === 'seer') html += '<p>预言家请睁眼。选择一名玩家，查明对方的阵营。</p><button class="ww-skill-button is-ready" data-open-skill="seer" type="button"><span>验</span><b>选择查验目标</b><small>查看一名玩家的阵营</small></button>';
        else if (phase === 'nightWitch' && role === 'witch') html += `<p>女巫请睁眼。今夜遇袭的是：${state.wolfSeat ? `${state.wolfSeat} 号` : '无人'}。解药 ${state.witchItems?.antidote ? '尚在' : '已用'}，毒药 ${state.witchItems?.poison ? '尚在' : '已用'}。</p><div class="ww-witch-skills">${state.witchItems?.antidote && state.wolfSeat ? '<button class="ww-skill-button is-ready" data-stage-night-choice="save" type="button"><span>救</span><b>使用解药</b><small>救下今夜遇袭的玩家</small></button>' : ''}${state.witchItems?.poison ? '<button class="ww-skill-button is-ready" data-open-skill="witch-poison" type="button"><span>毒</span><b>使用毒药</b><small>选择一名毒药目标</small></button>' : ''}<button class="ww-skill-button" data-stage-night-choice="pass" type="button"><span>过</span><b>不使用药物</b><small>今夜收起两只药瓶</small></button></div>`;
        else if (phase === 'lastWords') html += renderTimedTurnAction('lastWords', activeSeat);
        else if (phase === 'day') html += renderTimedTurnAction('day', activeSeat);
        else if (phase === 'vote') html += !activeSeat?.alive ? '<div class="ww-waiting">你已经出局，本轮没有放逐票。</div>' : `<p>第 ${state.dayVoteRound || 1} 轮：你的放逐票${state.myVote ? `已经投给 ${state.myVote} 号` : '还没有投出'}。目前已有 ${state.voteProgress.completed}/${state.voteProgress.total} 人投票。</p>${state.dayVoteRound === 2 ? `<p>本轮只能投给 ${state.dayTieTargets?.join('、')} 号。</p>` : ''}${state.canVote ? '<button class="ww-vote-button" data-open-vote type="button">选择放逐目标</button>' : '<div class="ww-skill-complete">你的放逐票已经投出，请等待其他玩家。</div>'}`;
        else html += `<p>现在是${escapeHtml(state.phaseName)}。${ROLE[role]?.name || '你'}暂时无需行动，请留意接下来的引导。</p>`;
        $('action').innerHTML = html;
    }
    function renderTimedTurnAction(kind, activeSeat) {
        const flow = kind === 'lastWords' ? state.lastWordsFlow : state.speechFlow;
        const current = Number(flow?.currentSeat) === Number(state.activeSeat);
        const startAction = kind === 'lastWords' ? 'startLastWords' : 'startSpeech';
        const finishAction = kind === 'lastWords' ? 'finishLastWords' : 'finishSpeech';
        const canStart = kind === 'lastWords' ? state.canStartLastWords : state.canStartSpeech;
        const canFinish = kind === 'lastWords' ? state.canFinishLastWords : state.canFinishSpeech;
        const title = kind === 'lastWords' ? '遗言' : '依序发言';
        if (!activeSeat?.alive && kind === 'day') return '<div class="ww-waiting">你已经出局，请听存活玩家依次发言。</div>';
        if (!current) return `<div class="ww-turn-panel"><strong>${escapeHtml(flow?.currentSeat ? `${flow.currentSeat} 号玩家正在${title}` : `${title}即将开始`)}</strong><span>现在请听这位玩家发言，轮到你时界面会亮起。</span></div>`;
        if (canStart) return `<div class="ww-turn-panel is-current"><strong>轮到你${title}</strong><span>${kind === 'lastWords' ? '准备好后开始计时，留下你最后想说的话。' : '准备好后开始计时，发言结束可以提前完成。'}</span><button class="ww-confirm-button is-ready" data-action="${startAction}" type="button"><span>▶</span><b>开始${title}</b><small>限时 ${flow?.durationSeconds || (kind === 'lastWords' ? 60 : 90)} 秒</small></button></div>`;
        if (canFinish || flow?.status === 'speaking') {
            const remaining = flowRemainingSeconds(flow);
            const input = kind === 'lastWords' ? '<textarea data-role="lastWordsText" maxlength="240" placeholder="可选：在这里写下遗言，也可以直接说出来"></textarea>' : '';
            return `<div class="ww-turn-panel is-current"><strong>你正在${title}</strong><b class="ww-turn-timer" data-role="timedRemaining">${remaining}s</b>${input}<button class="ww-confirm-button is-ready" data-action="${finishAction}" type="button"><span>✓</span><b>结束${title}</b><small>时间用尽也会自然结束</small></button></div>`;
        }
        return `<div class="ww-turn-panel"><strong>${escapeHtml(flow?.status === 'completed' ? `${title}已经结束` : `${title}即将开始`)}</strong><span>请留意接下来的引导。</span></div>`;
    }
    function flowRemainingSeconds(flow) {
        return Math.max(0, Number(flow?.remainingSeconds || 0));
    }
    function scheduleTimedFlow() {
        if (timedFlowInterval) { clearInterval(timedFlowInterval); timedFlowInterval = null; }
        const sheriffPhase = ['sheriffSignup', 'sheriffCampaign', 'sheriffRunoffSpeech', 'sheriffVote', 'sheriffRunoffVote'].includes(state?.phase);
        const flow = state?.phase === 'lastWords' ? state.lastWordsFlow : state?.phase === 'day' ? state.speechFlow : null;
        const timed = sheriffPhase ? state?.sheriff : flow;
        if (!timed || !timed.deadlineAt || state.flowPaused) return;
        let remaining = sheriffPhase ? Math.max(0, Number(timed.remainingSeconds || 0)) : flowRemainingSeconds(timed);
        timedFlowInterval = setInterval(() => {
            if (state?.flowPaused) return;
            remaining = Math.max(0, remaining - 1);
            const output = mount.querySelector('[data-role="timedRemaining"]');
            if (output) output.textContent = `${remaining}s`;
            const currentSeat = state?.phase === 'day' ? state.canFinishSpeech : state?.phase === 'lastWords' ? state.canFinishLastWords : Boolean(state?.sheriffAction);
            if (remaining <= 0 && currentSeat) {
                clearInterval(timedFlowInterval); timedFlowInterval = null;
                sendAction({ kind: 'timerTick' });
            }
        }, 1000);
    }
    function openTargetDialog(type) {
        hideRoleIdentity();
        const definitions = {
            guard: { title: '第一步 · 选择守护目标', description: '选择今晚要保护的玩家，下一步还可以再次核对。', action: { kind: 'stageNightAction' }, targets: state.legalTargetSeats || [] },
            wolf: { title: `第一步 · 第 ${state.wolfVote?.round || 1} 轮袭击投票`, description: '选择一名袭击目标，下一步确定后便不能更改。', action: { kind: 'stageNightAction' }, targets: state.legalTargetSeats || [] },
            seer: { title: '第一步 · 选择查验目标', description: '选择另一名玩家，最终确定后会揭示对方阵营。', action: { kind: 'stageNightAction' }, targets: state.legalTargetSeats || [] },
            'witch-poison': { title: '第一步 · 选择毒药目标', description: '选择一名玩家，最终确定后将用掉毒药。', action: { kind: 'stageNightAction', choice: 'poison' }, targets: state.legalTargetSeats || [] },
            'hunter-shoot': { title: '选择开枪目标', description: '被选中的存活玩家将立即出局。', action: { kind: 'hunterAction', choice: 'shoot' }, targets: state.hunterAction?.legalTargetSeats || [] },
            'hunter-pass': { title: '确认放弃开枪', description: '确认后不带走任何玩家。', action: { kind: 'hunterAction', choice: 'pass' }, targets: [], noTarget: true },
            'badge-transfer': { title: '选择警徽接收者', description: '警徽会立即移交给选中的存活玩家。', action: { kind: 'sheriffBadgeAction', choice: 'transfer' }, targets: state.sheriffBadgeAction?.legalTargetSeats || [] },
            'sheriff-vote': { title: state.phase === 'sheriffRunoffVote' ? '选择 PK 候选人' : '选择警长候选人', description: '这张票确定后不能修改。', action: { kind: 'sheriffVote' }, targets: state.sheriffAction?.legalTargetSeats || [] },
            vote: { title: '选择放逐目标', description: '请投出你的放逐票，确定后不能修改。', action: { kind: 'vote' }, targets: state.legalTargetSeats || [] },
        };
        const definition = definitions[type];
        if (!definition) return;
        targetDialog = { ...definition, selected: definition.fixedTarget || null };
        renderTargetDialog();
        mount.querySelector('.ww-screen')?.classList.add('is-modal-open');
        $('targetModal')?.classList.remove('is-hidden');
    }
    function renderTargetDialog() {
        if (!targetDialog) return;
        $('targetTitle').textContent = targetDialog.title;
        $('targetDescription').textContent = targetDialog.description;
        const grid = $('targetGrid');
        grid.innerHTML = targetDialog.targets.length ? targetDialog.targets.map(number => {
            const seat = state.seats.find(item => item.number === number);
            return `<button type="button" data-modal-target="${number}" class="${targetDialog.selected === number ? 'is-selected' : ''}"><b>${number}</b><span>${seat?.alive ? '存活' : '出局'}</span></button>`;
        }).join('') : '';
        grid.classList.toggle('is-hidden', !targetDialog.targets.length);
        const selection = $('targetSelection');
        selection.textContent = targetDialog.noTarget ? '这次不选择任何目标' : targetDialog.selected ? `你选择了 ${targetDialog.selected} 号玩家` : '还没有选择';
        const confirm = mount.querySelector('[data-ui="confirmTarget"]');
        confirm.disabled = !targetDialog.noTarget && !targetDialog.selected;
        confirm.textContent = targetDialog.action.kind === 'stageNightAction' ? '下一步：确认' : ['vote', 'sheriffVote'].includes(targetDialog.action.kind) ? '确定投票' : targetDialog.action.kind === 'sheriffBadgeAction' ? '确定移交' : '确定选择';
    }
    function closeTargetDialog() {
        targetDialog = null;
        $('targetModal')?.classList.add('is-hidden');
        mount.querySelector('.ww-screen')?.classList.remove('is-modal-open');
    }
    function handleMessage(message) {
        try {
            if (message?.state) {
                const viewChanged = state && (state.phase !== message.state.phase || state.activeSeat !== message.state.activeSeat || state.myRole !== message.state.myRole || state.myRoleConfirmed !== message.state.myRoleConfirmed);
                const previousState = state;
                if (viewChanged) hideRoleIdentity();
                state = message.state;
                if (state.testMode) {
                    (state.seats || []).forEach(seat => { if (seat.role) testRoleBySeat.set(seat.number, seat.role); });
                    if (state.activeSeat && state.myRole) testRoleBySeat.set(state.activeSeat, state.myRole);
                }
                maybePlayTransition(previousState, state);
                if (viewChanged) closeTargetDialog();
                render();
            }
            if (message?.type === 'error') addLog(message.message || '这一步暂时无法进行', 'error');
            else if (message?.action?.message) addLog(message.action.message, 'info');
        } catch (error) {
            console.error('狼人杀状态渲染失败', error, message);
            addLog(`狼人杀界面暂时无法显示：${error.message}`, 'error');
            $('action').innerHTML = '<p class="ww-render-error">界面正在恢复，请稍候；如果长时间没有变化，可以刷新页面。</p>';
        }
    }
    function sendAction(action) {
        const now = Date.now();
        const actionKey = JSON.stringify(action);
        if (actionKey === lastActionKey && now - lastActionAt < 400) return;
        lastActionAt = now;
        lastActionKey = actionKey;
        send({ type: 'gameAction', action });
    }
    mount.addEventListener('click', event => {
        if (!event.target.closest('[data-role-hold]')) hideRoleIdentity();
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        const rulesOverlay = $('rules');
        if (ui === 'leave') leaveRoom?.();
        if (ui === 'voice') {
            voiceEnabled = !voiceEnabled;
            if (!voiceEnabled && typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
            updateVoiceButton();
            return;
        }
        if (ui === 'confirmAllRoles') return confirmAllRolesForTest();
        if (ui === 'rules') rulesOverlay?.classList.remove('is-hidden');
        if (ui === 'closeRules' || event.target === rulesOverlay) rulesOverlay?.classList.add('is-hidden');
        if (ui === 'closeTarget' || ui === 'cancelTarget' || event.target === $('targetModal')) { closeTargetDialog(); return; }
        if (ui === 'confirmTarget' && targetDialog) {
            const action = { ...targetDialog.action };
            if (targetDialog.selected && !targetDialog.noTarget) action.targetSeat = targetDialog.selected;
            closeTargetDialog();
            return sendAction(action);
        }
        const modalTarget = event.target.closest('[data-modal-target]');
        if (modalTarget && targetDialog) { targetDialog.selected = Number(modalTarget.dataset.modalTarget); renderTargetDialog(); return; }
        const skill = event.target.closest('[data-open-skill]');
        if (skill) { openTargetDialog(skill.dataset.openSkill); return; }
        const stagedNightChoice = event.target.closest('[data-stage-night-choice]');
        if (stagedNightChoice) return sendAction({ kind: 'stageNightAction', choice: stagedNightChoice.dataset.stageNightChoice });
        if (event.target.closest('[data-open-vote]')) { openTargetDialog('vote'); return; }
        if (event.target.closest('[data-action="confirmRole"]')) return sendAction({ kind: 'confirmRole' });
        if (event.target.closest('[data-action="confirmDeadRole"]')) return sendAction({ kind: 'confirmDeadRole' });
        if (event.target.closest('[data-action="confirmNightAction"]')) return sendAction({ kind: 'confirmNightAction' });
        if (event.target.closest('[data-action="cancelNightAction"]')) return sendAction({ kind: 'cancelNightAction' });
        if (event.target.closest('[data-action="confirmSeerResult"]')) return sendAction({ kind: 'confirmSeerResult' });
        if (event.target.closest('[data-action="confirmDeathResolution"]')) return sendAction({ kind: 'confirmDeathResolution' });
        if (event.target.closest('[data-action="confirmDay"]')) return sendAction({ kind: 'confirmDay' });
        if (event.target.closest('[data-action="startSpeech"]')) return sendAction({ kind: 'startSpeech' });
        if (event.target.closest('[data-action="finishSpeech"]')) return sendAction({ kind: 'finishSpeech' });
        if (event.target.closest('[data-action="startLastWords"]')) return sendAction({ kind: 'startLastWords' });
        if (event.target.closest('[data-action="finishLastWords"]')) return sendAction({ kind: 'finishLastWords', text: mount.querySelector('[data-role="lastWordsText"]')?.value?.trim() || '' });
        if (event.target.closest('[data-action="sheriffRun"]')) return sendAction({ kind: 'sheriffSignup', choice: 'run' });
        if (event.target.closest('[data-action="sheriffSkip"]')) return sendAction({ kind: 'sheriffSignup', choice: 'skip' });
        if (event.target.closest('[data-action="sheriffStay"]')) return sendAction({ kind: 'finishSheriffCampaign', choice: 'stay' });
        if (event.target.closest('[data-action="sheriffWithdraw"]')) return sendAction({ kind: 'finishSheriffCampaign', choice: 'withdraw' });
        if (event.target.closest('[data-action="sheriffAbstain"]')) return sendAction({ kind: 'sheriffVote', targetSeat: null });
        if (event.target.closest('[data-action="finishSheriffRunoffSpeech"]')) return sendAction({ kind: 'finishSheriffRunoffSpeech' });
        if (event.target.closest('[data-action="tearBadge"]')) return sendAction({ kind: 'sheriffBadgeAction', choice: 'tear' });
        const seat = event.target.closest('[data-seat]'); if (seat) { closeTargetDialog(); return sendAction({ kind: 'switchSeat', seat: Number(seat.dataset.seat) }); }
    }, { signal: controller.signal });
    mount.addEventListener('pointerdown', event => {
        if (!event.target.closest('[data-role-hold]') || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        roleRevealPointerId = event.pointerId;
        roleRevealKey = null;
        setRoleIdentityVisible(true);
    }, { signal: controller.signal });
    mount.addEventListener('pointermove', event => {
        if (event.pointerId !== roleRevealPointerId) return;
        const hold = $('role')?.querySelector('[data-role-hold]');
        if (!hold) return hideRoleIdentity();
        const bounds = hold.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) hideRoleIdentity();
    }, { signal: controller.signal });
    mount.addEventListener('pointerout', event => {
        const hold = event.target.closest('[data-role-hold]');
        if (hold && event.pointerId === roleRevealPointerId && !hold.contains(event.relatedTarget)) hideRoleIdentity();
    }, { signal: controller.signal });
    mount.addEventListener('keydown', event => {
        if (!event.target.closest('[data-role-hold]') || (event.key !== ' ' && event.key !== 'Enter')) return;
        event.preventDefault();
        if (!event.repeat) {
            roleRevealPointerId = null;
            roleRevealKey = event.key;
            setRoleIdentityVisible(true);
        }
    }, { signal: controller.signal });
    mount.addEventListener('focusout', event => {
        if (event.target.closest('[data-role-hold]')) hideRoleIdentity();
    }, { signal: controller.signal });
    mount.addEventListener('contextmenu', event => {
        if (event.target.closest('[data-role-hold]')) event.preventDefault();
    }, { signal: controller.signal });
    window.addEventListener('pointerup', event => {
        if (event.pointerId === roleRevealPointerId) hideRoleIdentity();
    }, { signal: controller.signal });
    window.addEventListener('pointercancel', event => {
        if (event.pointerId === roleRevealPointerId) hideRoleIdentity();
    }, { signal: controller.signal });
    window.addEventListener('keyup', event => {
        if (event.key === roleRevealKey) hideRoleIdentity();
    }, { signal: controller.signal });
    window.addEventListener('blur', hideRoleIdentity, { signal: controller.signal });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) hideRoleIdentity();
    }, { signal: controller.signal });
    return { gameType: 'werewolf', handleMessage, destroy() { controller.abort(); if (timedFlowInterval) clearInterval(timedFlowInterval); hideTransition(); hidePersonalElimination(); if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); style.remove(); mount.innerHTML = ''; } };
}
