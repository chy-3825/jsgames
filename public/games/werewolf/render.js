import { escapeHtml, formatVoteBallots, ROLE } from './constants.js';

/** Private role, public board and action-area rendering for 狼人杀. */
export function createWerewolfRenderer({ mount, model, getElement, send, windowRef = globalThis.window || globalThis }) {
    const $ = role => getElement(role);
    const state = () => model.state;
    function canShowWolfTeam(current) {
        return Boolean(current?.myRole === 'werewolf' && (current.testMode || model.roleIdentityVisible));
    }
    function renderSeatList(current = state()) {
        if (!current) return;
        const seats = Array.isArray(current.seats) ? current.seats : [];
        const showWolfTeam = canShowWolfTeam(current);
        const seatStatus = seat => current.phase === 'roleReveal' ? seat.roleConfirmed ? '已经记下身份' : '尚未确认身份' : current.phase === 'day' && seat.alive ? seat.dayReady ? '发言结束' : '等待发言' : seat.alive ? seat.number === current.activeSeat ? current.testMode ? '当前测试视角' : '你的位置' : '在场' : '已出局';
        $('seats').innerHTML = seats.map(seat => {
            const knownWolf = Boolean(showWolfTeam && seat.isKnownWolf);
            // In a real wolf perspective the red border is the teammate
            // marker.  Keep the player's name/seat label here instead of
            // redundantly printing “狼人”; test mode still reveals roles for
            // the single-device inspection workflow.
            const visibleRole = current.testMode ? seat.role || model.testRoleBySeat.get(seat.number) : '';
            const roleName = visibleRole ? ROLE[visibleRole]?.name || visibleRole : '';
            const seatLabel = roleName || seat.controllerName || (current.testMode ? '虚拟座位' : '等待入座');
            const statusLabel = roleName ? `${seat.controllerName || '虚拟座位'} · ${seatStatus(seat)}` : seatStatus(seat);
            return `<button type="button" data-seat="${seat.number}" class="ww-seat ${seat.number === current.activeSeat ? 'is-active' : ''} ${seat.alive ? '' : 'is-dead'} ${knownWolf ? 'is-known-wolf' : ''} ${current.phase === 'roleReveal' && seat.roleConfirmed ? 'is-confirmed' : ''} ${current.phase === 'day' && seat.alive ? seat.dayReady ? 'is-day-ready' : 'is-day-pending' : ''}" ${seat.canControl ? '' : 'disabled'}><b>${seat.number}</b><span>${escapeHtml(seatLabel)}</span><small>${escapeHtml(statusLabel)}</small></button>`;
        }).join('') || '<p class="ww-empty">夜幕尚未降临…</p>';
    }
    function setRoleIdentityVisible(visible) {
        const wasVisible = model.roleIdentityVisible;
        const firstWolfReveal = Boolean(visible && state()?.phase === 'roleReveal' && state()?.myRole === 'werewolf' && !model.hasViewedRole);
        model.roleIdentityVisible = Boolean(visible && state()?.myRole);
        if (model.roleIdentityVisible && state()?.phase === 'roleReveal') model.hasViewedRole = true;
        const roleCard = $('role');
        const roleSecret = roleCard?.querySelector('[data-role-secret]');
        const roleHold = roleCard?.querySelector('[data-role-hold]');
        roleCard?.classList.toggle('is-revealed', model.roleIdentityVisible);
        roleSecret?.setAttribute('aria-hidden', String(!model.roleIdentityVisible));
        roleHold?.setAttribute('aria-pressed', String(model.roleIdentityVisible));
        roleHold?.setAttribute('aria-label', model.roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏');
        if (state()?.myRole === 'werewolf' && (firstWolfReveal || wasVisible !== model.roleIdentityVisible)) renderSeatList();
    }
    function hideRoleIdentity() {
        model.roleRevealPointerId = null;
        model.roleRevealKey = null;
        setRoleIdentityVisible(false);
    }
    function updateVoiceButton() {
        const button = mount.querySelector('[data-ui="voice"]');
        if (!button) return;
        button.textContent = model.voiceEnabled ? '语音：开' : '语音：关';
        button.setAttribute('aria-pressed', String(model.voiceEnabled));
    }
    function pulseBulletin() {
        const element = $('voteResult');
        if (!element || element.classList.contains('is-hidden')) return;
        element.classList.remove('is-receiving'); void element.offsetWidth; element.classList.add('is-receiving');
        windowRef.setTimeout(() => element.classList.remove('is-receiving'), 900);
    }
    function flowRemainingSeconds(flow) { return Math.max(0, Number(flow?.remainingSeconds || 0)); }
    function renderNightClock() {
        const current = state(); const clock = $('nightClock'); const output = $('nightRemaining'); const flow = current?.nightFlow;
        if (!clock || !output) return;
        if (!flow?.deadlineAt) { clock.classList.add('is-hidden'); output.textContent = '--'; return; }
        clock.classList.remove('is-hidden');
        output.textContent = current.flowPaused ? '已暂停' : `${flowRemainingSeconds(flow)}s`;
    }
    function scheduleTimedFlow() {
        if (model.timedFlowInterval) { windowRef.clearInterval(model.timedFlowInterval); model.timedFlowInterval = null; }
        const current = state();
        const nightTimed = current?.nightFlow?.deadlineAt ? current.nightFlow : null;
        const sheriffPhase = ['sheriffSignup', 'sheriffCampaign', 'sheriffRunoffSpeech', 'sheriffVote', 'sheriffRunoffVote'].includes(current?.phase);
        const flow = current?.phase === 'lastWords' ? current.lastWordsFlow : current?.phase === 'dayRunoffSpeech' ? current.runoffSpeechFlow : current?.phase === 'day' ? current.speechFlow : null;
        const timed = nightTimed || (sheriffPhase ? current?.sheriff : flow);
        if (!timed || !timed.deadlineAt || current.flowPaused) return;
        let remaining = flowRemainingSeconds(timed);
        model.timedFlowInterval = windowRef.setInterval(() => {
            if (model.state?.flowPaused) return;
            remaining = Math.max(0, remaining - 1);
            const outputs = nightTimed ? [mount.querySelector('[data-role="nightRemaining"]')] : [mount.querySelector('[data-role="timedRemaining"]')];
            outputs.filter(Boolean).forEach(output => { output.textContent = `${remaining}s`; });
            if (nightTimed && remaining <= 0) {
                windowRef.clearInterval(model.timedFlowInterval); model.timedFlowInterval = null;
                return;
            }
            const currentSeat = model.state?.phase === 'day' ? model.state.canFinishSpeech : model.state?.phase === 'dayRunoffSpeech' ? model.state.canFinishRunoffSpeech : model.state?.phase === 'lastWords' ? model.state.canFinishLastWords : Boolean(model.state?.sheriffAction);
            if (remaining <= 0 && currentSeat) {
                windowRef.clearInterval(model.timedFlowInterval); model.timedFlowInterval = null;
                send({ type: 'gameAction', action: { kind: 'timerTick' } });
            }
        }, 1000);
    }
    function renderAnnouncement() {
        const current = state(); const element = $('announcement');
        if (!element) return;
        if (!current.announcement) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        const label = current.announcement.peaceful ? '晨光揭晓 · 平安夜' : `晨光揭晓 · 第 ${current.announcement.day} 天`;
        element.classList.remove('is-hidden');
        element.innerHTML = `<small>${label}</small><strong>${escapeHtml(current.announcement.text)}</strong><span>${current.phase === 'lastWords' ? '请出局玩家依次留下遗言' : current.phase === 'day' ? '白天发言即将开始' : ''}</span>`;
    }
    function renderVoteResult() {
        const current = state(); const element = $('voteResult');
        if (!element) return;
        const result = current.lastVoteResult;
        const identityEvent = (current.publicEvents || []).findLast(event => event.kind === 'identityReveal');
        if (!result && !identityEvent) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        const history = (current.voteHistory || []).slice(-5).reverse().map(item => {
            const counts = Object.entries(item.counts || {}).map(([seat, count]) => `${seat}号 ${count}票`).join(' · ') || '无票';
            return `<article><strong>第 ${item.day} 天 · 第 ${item.round} 轮 · ${escapeHtml(item.message || '投票结束')}</strong><p>${escapeHtml(formatVoteBallots(item))}</p><small>最终票数：${escapeHtml(counts)}</small></article>`;
        }).join('');
        element.classList.remove('is-hidden');
        element.innerHTML = `<div class="ww-section-title"><span>公示栏</span><small>最近 5 轮 · 全场可见</small></div>${identityEvent ? `<article class="is-identity"><strong>${escapeHtml(identityEvent.title)}</strong><p>${escapeHtml(identityEvent.text)}</p></article>` : ''}${history || '<p>暂无公投记录</p>'}`;
    }
    function renderSheriffState() {
        const current = state(); const element = $('sheriffState');
        if (!element) return;
        const sheriff = current.sheriff;
        if (!sheriff?.enabled) { element.classList.add('is-hidden'); element.innerHTML = ''; return; }
        element.classList.remove('is-hidden');
        const result = sheriff.results?.at(-1);
        const ballots = result?.ballots?.map(ballot => `${ballot.voterSeat}→${ballot.targetSeat ?? '弃'}`).join(' · ');
        const summary = sheriff.holderSeat != null ? `${sheriff.holderSeat} 号持有警徽` : sheriff.status === 'torn' ? '警徽已流失' : sheriff.status === 'deferred' ? '警长竞选延期至下一白天' : sheriff.status === 'none' ? '本局没有警长' : '警长竞选正在进行';
        element.innerHTML = `<div class="ww-section-title"><span>警徽归属</span><small>全场可见</small></div><strong>${escapeHtml(summary)}</strong>${sheriff.candidates?.length ? `<p>候选人：${sheriff.candidates.join('、')} 号</p>` : ''}${ballots ? `<p>上一轮票型：${escapeHtml(ballots)}</p>` : ''}`;
    }
    function renderWolfBallots(current = state()) {
        const vote = current?.wolfVote;
        if (current?.myRole !== 'werewolf' || current.phase !== 'nightWolf' || !vote) return '';
        const ballots = Array.isArray(vote.ballots) ? vote.ballots : [];
        const ballotBySeat = new Map(ballots.map(ballot => [Number(ballot.voterSeat), ballot.targetSeat == null ? null : Number(ballot.targetSeat)]));
        const livingWolves = (current.seats || []).filter(seat => seat.alive && seat.isKnownWolf).sort((left, right) => left.number - right.number);
        const rows = livingWolves.map(seat => {
            const hasVote = ballotBySeat.has(Number(seat.number));
            const target = ballotBySeat.get(Number(seat.number));
            const choice = hasVote && target != null ? `${target} 号` : '暂未投票';
            return `<span class="${hasVote ? 'has-voted' : ''} ${seat.number === current.activeSeat ? 'is-mine' : ''}"><b>${seat.number} 号</b><i>→</i><em>${escapeHtml(choice)}</em></span>`;
        }).join('');
        return `<section class="ww-wolf-ballots"><div><strong>狼队临时票型</strong><small>仅狼队可见 · 倒计时结束前可改票</small></div><div class="ww-wolf-ballot-list">${rows || '<span><em>等待狼队选择</em></span>'}</div></section>`;
    }
    function renderRole() {
        const current = state(); const role = ROLE[current.myRole];
        if (!role) { model.roleIdentityVisible = false; $('role').innerHTML = '<p>入局后，你的身份会在这里悄然揭晓。</p>'; return; }
        const skillStatus = current.phase === 'roleReveal' ? current.myRoleConfirmed ? '你已记下自己的身份' : '请看清并记住你的身份' : current.hunterAction?.available || current.canConfirmDeathResolution ? '请完成你的离场行动' : current.myDeathResolutionSettled ? '你的离场行动已经完成' : current.nightConfirmation ? current.nightConfirmation.stage === 'result' ? '请记住查验结果' : '请确认你的选择' : current.wolfVote ? current.wolfVote.resolved ? current.wolfVote.noKill ? '两轮平票，今夜无人遇袭' : `今夜目标：${current.wolfVote.resultTarget} 号` : current.wolfVote.myTarget != null ? `你当前投给 ${current.wolfVote.myTarget} 号，倒计时结束前可改票` : `第 ${current.wolfVote.round || 1} 轮，请选择目标` : current.skillState?.submitted ? '行动已确认，等待倒计时结束' : current.skillState?.available ? '夜色正在等待你的选择' : '夜色尚未呼唤你';
        $('role').innerHTML = `<div class="ww-role-secret" data-role-secret aria-hidden="${String(!model.roleIdentityVisible)}"><div class="ww-role-art social-role-focus-art"><img src="/assets/games/werewolf/${role.image}" alt="${role.name}"></div><div><small>${current.activeSeat} 号玩家 · 仅你可见</small><h2>${role.name}</h2><p>${role.text}</p><span class="ww-skill-status ${current.skillState?.available ? 'is-ready' : ''} ${current.skillState?.submitted ? 'is-used' : ''}">${skillStatus}</span>${current.seerResult ? `<strong class="ww-result">查验结果：${current.seerResult.seat} 号是${current.seerResult.faction === 'wolf' ? '狼人' : '好人'}</strong>` : ''}</div></div><button class="ww-role-cover" data-role-hold type="button" aria-pressed="${String(model.roleIdentityVisible)}" aria-label="${model.roleIdentityVisible ? '正在显示私密身份，松开立即隐藏' : '按住查看私密身份，松开立即隐藏'}"><span>身份已经隐藏</span><b>按住查看身份</b><small>松开或移出后立即遮住 · 也可按住空格 / Enter</small></button>`;
        setRoleIdentityVisible(model.roleIdentityVisible);
    }
    function renderNightConfirmation() {
        const current = state(); const confirmation = current.nightConfirmation;
        if (!confirmation) return '';
        if (confirmation.stage === 'result') {
            const faction = current.seerResult?.faction === 'wolf' ? '狼人' : '好人';
            return `<section class="ww-night-confirmation is-result"><small>第三步 · 记住查验结果</small><strong>${confirmation.targetSeat} 号是 <b>${faction}</b></strong><p>请记住这个结果，确认后继续保持安静，不要向其他玩家展示。</p><button class="ww-confirm-button is-ready" data-action="confirmSeerResult" type="button"><span>✓</span><b>我已看清</b><small>结束今夜的查验</small></button></section>`;
        }
        const summary = confirmation.role === 'guard' ? confirmation.choice === 'pass' ? '本夜空守' : `守护 ${confirmation.targetSeat} 号玩家` : confirmation.role === 'werewolf' ? `将袭击票投给 ${confirmation.targetSeat} 号玩家` : confirmation.role === 'seer' ? `查验 ${confirmation.targetSeat} 号玩家` : confirmation.choice === 'save' ? `对 ${confirmation.targetSeat ?? current.wolfSeat} 号使用解药` : confirmation.choice === 'poison' ? `对 ${confirmation.targetSeat} 号使用毒药` : '本夜不使用任何药物';
        const changeNote = confirmation.role === 'werewolf' ? '确定后会成为狼队临时票，倒计时结束前仍可重新选择。' : '请再核对一次。确定后，本次选择将不能更改。';
        return `${confirmation.role === 'werewolf' ? renderWolfBallots(current) : ''}<section class="ww-night-confirmation"><small>第二步 · 确认你的选择</small><strong>${escapeHtml(summary)}</strong><p>${changeNote}</p><div class="ww-witch-skills"><button class="ww-confirm-button is-ready" data-action="confirmNightAction" type="button"><span>✓</span><b>确定选择</b><small>${confirmation.role === 'seer' ? '确定后揭示对方阵营' : '确定后等待夜晚继续'}</small></button><button class="ww-skill-button" data-action="cancelNightAction" type="button"><span>↩</span><b>返回重选</b><small>当前选择还未生效</small></button></div></section>`;
    }
    function renderTimedTurnAction(kind, activeSeat) {
        const current = state(); const flow = kind === 'lastWords' ? current.lastWordsFlow : kind === 'runoff' ? current.runoffSpeechFlow : current.speechFlow;
        const isCurrent = Number(flow?.currentSeat) === Number(current.activeSeat);
        const startAction = kind === 'lastWords' ? 'startLastWords' : kind === 'runoff' ? 'startRunoffSpeech' : 'startSpeech'; const finishAction = kind === 'lastWords' ? 'finishLastWords' : kind === 'runoff' ? 'finishRunoffSpeech' : 'finishSpeech';
        const canStart = kind === 'lastWords' ? current.canStartLastWords : kind === 'runoff' ? current.canStartRunoffSpeech : current.canStartSpeech; const canFinish = kind === 'lastWords' ? current.canFinishLastWords : kind === 'runoff' ? current.canFinishRunoffSpeech : current.canFinishSpeech; const selfDestructWords = kind === 'lastWords' && flow?.currentKind === 'selfDestruct'; const title = selfDestructWords ? '自爆遗言' : kind === 'lastWords' ? '遗言' : kind === 'runoff' ? 'PK 发言' : '依序发言';
        if (!activeSeat?.alive && kind === 'day') return '<div class="ww-waiting">你已经出局，请听存活玩家依次发言。</div>';
        if (!isCurrent) return `<div class="ww-turn-panel"><strong>${escapeHtml(flow?.currentSeat != null ? `${flow.currentSeat} 号玩家正在${title}` : `${title}即将开始`)}</strong><span>现在请听这位玩家发言，轮到你时界面会亮起。</span></div>`;
        if (canStart) return `<div class="ww-turn-panel is-current"><strong>轮到你${title}</strong><span>${kind === 'lastWords' ? '准备好后开始计时，留下你最后想说的话。' : kind === 'runoff' ? '请针对首轮平票结果进行 PK 发言。' : '准备好后开始计时，发言结束可以提前完成。'}</span><button class="ww-confirm-button is-ready" data-action="${startAction}" type="button"><span>▶</span><b>开始${title}</b><small>限时 ${flow?.durationSeconds || (kind === 'lastWords' ? current.flowRules?.lastWordsSeconds || 60 : 90)} 秒</small></button></div>`;
        if (canFinish || flow?.status === 'speaking') { const remaining = flowRemainingSeconds(flow); const input = kind === 'lastWords' ? '<textarea data-role="lastWordsText" maxlength="240" placeholder="可选：在这里写下遗言，也可以直接说出来"></textarea>' : ''; const speakingTitle = selfDestructWords ? '请您发表自爆遗言' : `你正在${title}`; return `<div class="ww-turn-panel is-current"><strong>${speakingTitle}</strong><b class="ww-turn-timer" data-role="timedRemaining">${remaining}s</b>${input}<button class="ww-confirm-button is-ready" data-action="${finishAction}" type="button"><span>✓</span><b>结束${title}</b><small>时间用尽也会自然结束</small></button></div>`; }
        return `<div class="ww-turn-panel"><strong>${escapeHtml(flow?.status === 'completed' ? `${title}已经结束` : `${title}即将开始`)}</strong><span>请留意接下来的引导。</span></div>`;
    }
    function renderAction() {
        const current = state();
        if (current.status === 'ended') { const reveal = (current.seats || []).filter(seat => seat.role).map(seat => `<span class="ww-final-role"><b>${seat.number}号</b>${escapeHtml(ROLE[seat.role]?.name || seat.role)}${seat.isSheriff ? ' · 警长' : ''}</span>`).join(''); $('action').innerHTML = `<h3>${escapeHtml(current.winner?.name || '本局结束')}</h3><p>本局身份：</p><div class="ww-final-roles">${reveal}</div>`; return; }
        const phase = current.phase || 'waiting';
        const nightSeconds = Number(current.nightFlow?.durationSeconds || current.flowRules?.nightActionSeconds || 20);
        const actionBadge = current.flowPaused ? '等待玩家归来' : current.nightFlow ? current.skillState?.submitted ? '已提交 · 等待倒计时' : `固定 ${nightSeconds} 秒后继续` : current.testMode ? '测试模式 · 自动继续' : '行动完成后继续';
        let html = `<div class="ww-action-head"><div><small>游戏引导</small><h3>${escapeHtml(current.phaseName || '静候开局')}</h3></div><span class="ww-auto-badge">${actionBadge}</span></div>`;
        if (current.flowPaused) { $('action').innerHTML = `${html}<div class="ww-waiting">${escapeHtml(current.phaseInstruction || '有玩家暂时离线，游戏会等他回来。')}</div>`; return; }
        const role = current.myRole; const activeSeat = current.seats.find(seat => seat.number === current.activeSeat);
        if (phase === 'roleReveal') html += current.myRoleConfirmed ? `<div class="ww-skill-complete">你已记下身份，还差 ${Math.max(0, current.phaseProgress.total - current.phaseProgress.completed)} 位玩家。请不要向身边的人展示。</div>` : `<p>${model.hasViewedRole ? '身份已经看清。请遮住卡面后再确认。' : '请先按住上方身份牌查看，记住后遮住卡面再继续。'}</p><button class="ww-confirm-button${model.hasViewedRole ? ' is-ready' : ''}" data-action="confirmRole" type="button"${model.hasViewedRole ? '' : ' disabled'}><span>✓</span><b>${model.hasViewedRole ? '我已记住身份' : '请先查看身份'}</b><small>${current.phaseProgress.total || current.playerCount} 人全部确认后，第一夜降临</small></button>`;
        else if (phase === 'deathResolution' && current.hunterAction?.available) html += '<p>这是你离场前的专属时刻。你可以开枪带走一名存活玩家，也可以放弃。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="hunter-shoot" type="button"><span>枪</span><b>选择开枪目标</b><small>带走一名存活玩家</small></button><button class="ww-skill-button" data-open-skill="hunter-pass" type="button"><span>过</span><b>放弃开枪</b><small>独自离场，不带走任何人</small></button></div>';
        else if (phase === 'deathResolution' && current.sheriffBadgeAction?.available) html += '<p>你带着警徽出局了。请选择将警徽交给一名存活玩家，或亲手撕毁它。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="badge-transfer" type="button"><span>警</span><b>移交警徽</b><small>选择一名存活玩家</small></button><button class="ww-skill-button" data-action="tearBadge" type="button"><span>撕</span><b>撕毁警徽</b><small>本局不再产生警长</small></button></div>';
        else if (phase === 'deathResolution' && current.canConfirmDeathResolution) html += '<p>你没有额外的离场技能。准备好后确认离场，你的身份仍会保密。</p><button class="ww-confirm-button is-ready" data-action="confirmDeathResolution" type="button"><span>别</span><b>我已准备离场</b><small>不会向其他玩家公开你的身份</small></button>';
        else if (phase === 'deathResolution' && current.myDeathResolutionSettled) html += '<div class="ww-skill-complete">你的离场行动已经完成，请等待其他出局玩家。</div>';
        else if (phase === 'deathResolution') html += '<div class="ww-waiting">出局玩家正在完成各自的离场行动，请稍候。</div>';
        else if (current.canConfirmDeadRole) html += '<p>你已经出局，今夜无需发动这个身份的技能。确认后仍会等待公开倒计时结束，不会暴露你的身份。</p><button class="ww-confirm-button" data-action="confirmDeadRole" type="button"><span>过</span><b>今夜不行动</b><small>本阶段仍固定持续 20 秒</small></button>';
        else if (current.nightConfirmation) html += renderNightConfirmation();
        else if (String(phase).startsWith('night') && role !== 'werewolf' && current.skillState?.submitted) html += '<div class="ww-skill-complete"><strong>你的行动已确认</strong><span>为了保持统一的夜间节奏，系统会等到公开倒计时结束后再进入下一个角色。</span></div>';
        else if (phase === 'sheriffSignup') html += current.sheriffAction?.kind === 'signup' && !current.sheriffAction.submitted ? `<p>请选择是否参加警长竞选。在所有人作出选择前，你的决定不会公开。</p><b class="ww-turn-timer">${current.sheriff?.remainingSeconds ?? '--'}s</b><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-action="sheriffRun" type="button"><span>警</span><b>我要上警</b><small>参加警长竞选</small></button><button class="ww-skill-button" data-action="sheriffSkip" type="button"><span>下</span><b>不上警</b><small>稍后拥有投票权</small></button></div>` : '<div class="ww-skill-complete">你的上警选择已经记下，其他玩家仍在决定。</div>';
        else if (phase === 'sheriffCampaign') html += current.sheriffAction?.kind === 'campaign' ? `<p>轮到你进行警上发言。发言结束后选择继续竞选或退水。</p><b class="ww-turn-timer">${current.sheriff?.remainingSeconds ?? '--'}s</b><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-action="sheriffStay" type="button"><span>留</span><b>继续竞选</b><small>保留警长候选资格</small></button><button class="ww-skill-button" data-action="sheriffWithdraw" type="button"><span>退</span><b>退水</b><small>退出本次警长竞选</small></button></div>` : `<div class="ww-waiting">请听 ${current.sheriff?.currentCandidate ?? '当前'} 号完成警上发言。</div>`;
        else if (phase === 'sheriffVote' || phase === 'sheriffRunoffVote') html += current.sheriffAction?.kind === 'vote' ? current.sheriffAction.submitted ? '<div class="ww-skill-complete">你的警长票已经投出，请等待其他玩家。</div>' : '<p>请选择一名候选人担任警长，也可以弃票。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="sheriff-vote" type="button"><span>票</span><b>选择警长候选人</b><small>确定后不能修改</small></button><button class="ww-skill-button" data-action="sheriffAbstain" type="button"><span>弃</span><b>弃票</b><small>本轮不支持任何候选人</small></button></div>' : '<div class="ww-waiting">候选人不参与本轮警长投票，请等待投票结束。</div>';
        else if (phase === 'sheriffRunoffSpeech') html += current.sheriffAction?.kind === 'runoffSpeech' ? `<p>轮到你进行警长平票 PK 发言。</p><b class="ww-turn-timer">${current.sheriff?.remainingSeconds ?? '--'}s</b><button class="ww-confirm-button is-ready" data-action="finishSheriffRunoffSpeech" type="button"><span>言</span><b>完成 PK 发言</b><small>结束后轮到下一位</small></button>` : `<div class="ww-waiting">请听 ${current.sheriff?.currentCandidate ?? '当前'} 号完成 PK 发言。</div>`;
        else if (phase === 'nightWolf' && role === 'werewolf' && !activeSeat?.alive) html += '<div class="ww-waiting">你已经出局，不参与今夜的狼人投票。</div>';
        else if (phase === 'nightGuard' && role === 'guard') html += '<p>守卫请睁眼。选择一名玩家守护，或选择空守度过今夜。</p><div class="ww-witch-skills"><button class="ww-skill-button is-ready" data-open-skill="guard" type="button"><span>守</span><b>选择守护目标</b><small>可自守，不能连续守护同一人</small></button><button class="ww-skill-button" data-stage-night-choice="pass" type="button"><span>空</span><b>本夜空守</b><small>不指定守护目标</small></button></div>';
        else if (phase === 'nightWolf' && role === 'werewolf') {
            const myTarget = current.wolfVote?.myTarget;
            const roundCopy = current.wolfVote?.round === 2 ? `第一轮平票${current.wolfVote.tiedTargets?.length ? `（${current.wolfVote.tiedTargets.join('、')}号）` : ''}，请进行最后一轮投票。` : '存活狼人可以同时选择目标，队友的临时票会实时显示。';
            html += `<p>${roundCopy}</p>${renderWolfBallots(current)}${myTarget != null ? `<div class="ww-wolf-my-vote">你当前投给 <strong>${myTarget} 号</strong>；倒计时结束前可以重新选择。</div>` : ''}<button class="ww-skill-button is-ready" data-open-skill="wolf" type="button"><span>票</span><b>${myTarget != null ? '修改我的袭击票' : '选择袭击目标'}</b><small>第 ${current.wolfVote?.round || 1} 轮 · 倒计时结束时锁定结果</small></button>`;
        }
        else if (phase === 'nightSeer' && role === 'seer') html += '<p>预言家请睁眼。选择一名玩家，查明对方的阵营。</p><button class="ww-skill-button is-ready" data-open-skill="seer" type="button"><span>验</span><b>选择查验目标</b><small>查看一名玩家的阵营</small></button>';
        else if (phase === 'nightWitch' && role === 'witch') {
            const selfSaveBlocked = Boolean(current.wolfSeat != null && Number(current.wolfSeat) === Number(current.activeSeat) && current.witchCanSaveSelf === false);
            const selfSaveRuleLabel = { firstNight: '仅首夜可自救', never: '全程不可自救', always: '整局可自救' }[current.flowRules?.witchSelfSave] || '以房间设置为准';
            const saveButton = current.witchItems?.antidote && current.wolfSeat != null && !selfSaveBlocked
                ? '<button class="ww-skill-button is-ready" data-stage-night-choice="save" type="button"><span>救</span><b>使用解药</b><small>救下今夜遇袭的玩家</small></button>'
                : '';
            const selfSaveNote = selfSaveBlocked ? '<small class="ww-rule-note">本局规则不允许女巫自救</small>' : '';
            const victimText = current.wolfSeat != null ? `${current.wolfSeat} 号玩家` : '今夜无人被狼人袭击';
            html += `<section class="ww-witch-intel"><small>女巫专属 · 用药前刀口</small><strong>${victimText}</strong><p>请先确认今夜狼刀目标，再决定是否使用解药或毒药。</p></section><p>解药 ${current.witchItems?.antidote ? '尚在' : '已用'}，毒药 ${current.witchItems?.poison ? '尚在' : '已用'}。自救规则：${selfSaveRuleLabel}。${selfSaveNote}</p><div class="ww-witch-skills">${saveButton}${current.witchItems?.poison ? '<button class="ww-skill-button is-ready" data-open-skill="witch-poison" type="button"><span>毒</span><b>使用毒药</b><small>选择一名毒药目标</small></button>' : ''}<button class="ww-skill-button" data-stage-night-choice="pass" type="button"><span>过</span><b>不使用药物</b><small>今夜最多使用一瓶药</small></button></div>`;
        }
        else if (phase === 'lastWords') html += renderTimedTurnAction('lastWords', activeSeat);
        else if (phase === 'dayRunoffSpeech') html += renderTimedTurnAction('runoff', activeSeat);
        else if (phase === 'day') html += renderTimedTurnAction('day', activeSeat);
        else if (phase === 'vote') html += !activeSeat?.alive ? '<div class="ww-waiting">你已经出局，本轮没有放逐票。</div>' : !current.voteEligible && current.dayVoteRound === 2 ? `<div class="ww-waiting">你是本轮 PK 候选人，不能参与第二轮投票。请等待其他存活玩家决定。</div>` : `<p>第 ${current.dayVoteRound || 1} 轮：你的放逐票${!current.canVote ? current.myVote == null ? '已经弃权' : `已经投给 ${current.myVote} 号` : '还没有投出'}。目前已有 ${current.voteProgress.completed}/${current.voteProgress.total} 人投票。</p>${current.dayVoteRound === 2 ? `<p>PK 候选人为 ${current.dayTieTargets?.join('、')} 号；本轮由其他存活玩家投票，也可弃权。</p>` : ''}${current.canVote ? '<div class="ww-witch-skills"><button class="ww-vote-button" data-open-vote type="button">选择放逐目标</button><button class="ww-skill-button" data-action="voteAbstain" type="button"><span>弃</span><b>弃权</b><small>本轮不投给任何人</small></button></div>' : '<div class="ww-skill-complete">你的放逐票已经提交，请等待其他玩家。</div>'}`;
        else html += `<p>现在是${escapeHtml(current.phaseName)}。${ROLE[role]?.name || '你'}暂时无需行动，请留意接下来的引导。</p>`;
        if (current.canWolfSelfDestruct) html += '<button class="ww-skill-button ww-self-destruct" data-open-skill="wolf-self-destruct" type="button"><span>爆</span><b>狼人自爆</b><small>立即出局并结束当前白天</small></button>';
        $('action').innerHTML = html;
    }
    function render() {
        const current = state();
        if (!current) return;
        if (current.phase !== 'roleReveal') model.confirmingAllRoles = false;
        const seats = Array.isArray(current.seats) ? current.seats : [];
        const appRoot = mount.querySelector('.ww-app'); const isNight = String(current.phase || '').startsWith('night');
        const presentationLocked = model.scenePlaying || Date.now() < Number(model.presentationLockedUntil || 0);
        appRoot?.classList.toggle('is-night', isNight); appRoot?.classList.toggle('is-day', !isNight && current.status !== 'ended'); appRoot?.classList.toggle('is-my-turn', Boolean(isNight && current.skillState?.available)); appRoot?.classList.toggle('is-flow-paused', Boolean(current.flowPaused)); appRoot?.classList.toggle('is-test-mode', Boolean(current.testMode)); appRoot?.classList.toggle('is-presentation-locked', presentationLocked); appRoot?.classList.toggle('is-my-action', Boolean(current.skillState?.available || current.nightConfirmation || current.canVote || current.canConfirmDeathResolution || current.canStartSpeech || current.canStartRunoffSpeech || current.canStartLastWords || current.sheriffAction?.available));
        if (appRoot) appRoot.dataset.phase = current.phase || 'waiting';
        updateVoiceButton();
        const boardSize = current.playerCount || seats.length;
        if ($('boardSize')) $('boardSize').textContent = `${boardSize} 人局 · 无主持人模式`; if ($('seatTitle')) $('seatTitle').textContent = current.testMode ? '测试席位' : '玩家席位'; if ($('seatHint')) $('seatHint').textContent = current.testMode ? '测试模式：可自由切换席位，查看每个身份与行动界面。' : '你的号码会被点亮；身份与夜间行动只会出现在你的界面。'; if ($('screenMode')) $('screenMode').textContent = current.testMode ? '测试视角' : '你的秘密界面'; if ($('testHelp')) $('testHelp').textContent = `单人座位测试模式可一次确认 ${boardSize} 个座位`;
        $('phase').textContent = current.status === 'ended' ? current.winner?.name || '本局结束' : `${current.day ? `第 ${current.day} 天 · ` : ''}${current.phaseName || '静候开局'}`; $('mode').textContent = current.testMode ? `单人 · ${boardSize} 席测试` : `${boardSize} 人局`; $('currentPhase').textContent = current.status === 'ended' ? current.winner?.name || '本局结束' : current.phaseName || '静候开局'; $('nextPhase').textContent = current.nextPhaseName || '静候揭晓';
        const progress = current.phaseProgress || { completed: 0, total: 0, label: '等待玩家' }; $('phaseProgress').textContent = progress.label; $('phaseProgressCount').textContent = `${progress.completed}/${progress.total}`; $('phaseInstruction').textContent = current.phaseInstruction || ''; const progressBar = $('phaseProgressBar'); if (progressBar) progressBar.style.width = `${progress.total ? Math.min(100, progress.completed / progress.total * 100) : 0}%`;
        const screenSeat = mount.querySelector('[data-role="screen-seat"]'); if (screenSeat) screenSeat.textContent = current.activeSeat != null ? current.testMode ? `正在查看 ${current.activeSeat} 号` : `你是 ${current.activeSeat} 号玩家` : '等待入座';
        const seatStatus = seat => current.phase === 'roleReveal' ? seat.roleConfirmed ? '已经记下身份' : '尚未确认身份' : current.phase === 'day' && seat.alive ? seat.dayReady ? '发言结束' : '等待发言' : seat.alive ? seat.number === current.activeSeat ? current.testMode ? '当前测试视角' : '你的位置' : '在场' : '已出局';
        renderSeatList(current);
        const confirmAllButton = mount.querySelector('[data-ui="confirmAllRoles"]'); const canConfirmAll = Boolean(current.testMode && current.phase === 'roleReveal'); $('seatTools')?.classList.toggle('is-hidden', !current.testMode); confirmAllButton?.classList.toggle('is-hidden', !canConfirmAll); if (confirmAllButton) { confirmAllButton.disabled = !canConfirmAll || model.confirmingAllRoles; confirmAllButton.textContent = model.confirmingAllRoles ? '正在确认全部身份…' : '测试：一键确认全部身份'; }
        const publicSeats = mount.querySelector('[data-role="publicSeats"]'); if (publicSeats) publicSeats.innerHTML = seats.map(seat => `<span class="ww-public-seat ${seat.alive ? 'is-alive' : 'is-dead'} ${seat.isSheriff ? 'is-sheriff' : ''}"><b>${seat.number}${seat.isSheriff ? '<i>警</i>' : ''}</b>${current.status === 'ended' && seat.role ? escapeHtml(ROLE[seat.role]?.name || seat.role) : current.phase === 'roleReveal' ? seat.roleConfirmed ? '已确认' : '待确认' : seat.alive ? '存活' : '出局'}</span>`).join('');
        renderNightClock(); renderSheriffState(); renderAnnouncement(); renderVoteResult(); renderRole(); renderAction(); scheduleTimedFlow();
        $('log').innerHTML = (current.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i>${escapeHtml(entry)}</p>`).join('');
    }
    return { render, renderRole, renderAction, setRoleIdentityVisible, hideRoleIdentity, updateVoiceButton, pulseBulletin, scheduleTimedFlow, flowRemainingSeconds };
}
