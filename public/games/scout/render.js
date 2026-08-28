import { cardFace, combination, comboName, escapeHtml } from './constants.js';
import { getActions, orientedScoutCard, scoutSourceCard, selectedIndices, selectionAssessment, syncInteraction } from './state.js';

/** Main board, hand, command and score rendering for 马戏星探. */
export function createScoutRenderer({ mount, model, getElement }) {
    const $ = role => getElement(role);
    const state = () => model.state;
    const actions = () => getActions(state());

    function phaseName() {
        const current = state();
        if (current?.status === 'ended') return '全场谢幕';
        if (current?.phase === 'orienting') return '排定节目单';
        return current?.currentPlayerId === current?.myId ? '我的行动' : '观看演出';
    }
    function statusTitle() {
        const current = state();
        if (current?.status === 'ended') return `${(current.winners || []).map(player => player.name).join('、') || '本局'} 获胜`;
        if (current?.phase === 'orienting') return actions().canSetOrientation ? '请选择整手牌方向' : '等待其他马戏团排定节目';
        return current?.currentPlayerId === current?.myId ? '聚光灯已经照向你' : `${current?.currentPlayerName || '下一位'} 正在决定节目`;
    }
    function statusDetail() {
        const current = state();
        if (current?.status === 'ended') return '最终分数已经结算';
        if (current?.phase === 'orienting') return '整手翻面只改变读取方向，牌与牌之间的位置不会改变';
        if (current?.currentPlayerId === current?.myId) return '选择一段连续手牌演出，或从舞台两端招募成员';
        return current?.activeOwnerName ? `当前节目由 ${current.activeOwnerName} 保持` : '等待本轮第一个节目登台';
    }
    function clearError() {
        const banner = $('errorBanner');
        if (!banner) return;
        banner.textContent = '';
        banner.classList.add('is-hidden');
    }
    function showError(message) {
        const banner = $('errorBanner');
        if (!banner) return;
        banner.textContent = message || '操作失败，请重试';
        banner.classList.remove('is-hidden');
        banner.focus?.({ preventScroll: true });
    }
    function renderActive() {
        const current = state();
        const activeCards = current.activeSet || [];
        const combo = combination(activeCards);
        const activeMount = $('active');
        activeMount.classList.toggle('is-sparse', activeCards.length > 0 && activeCards.length <= 4);
        activeMount.classList.toggle('is-crowded', activeCards.length >= 8);
        $('activeCombo').innerHTML = combo ? `<span>${escapeHtml(current.activeOwnerName || '舞台')}</span><strong>${escapeHtml(comboName(combo))}</strong>` : '<span>等待开场</span><strong>空舞台</strong>';
        activeMount.innerHTML = activeCards.length ? activeCards.map((card, index) => {
            const edge = index === 0 ? '左端' : index === activeCards.length - 1 ? '右端' : '';
            return `<article class="sc-active-card" style="--index:${index}" tabindex="0" role="img" aria-label="当前节目第 ${index + 1} 张，${card.value} 与 ${card.otherValue}${edge ? `，${edge}` : ''}">${cardFace(card, null, edge)}</article>`;
        }).join('') : '<div class="sc-empty-stage"><span>★</span><strong>舞台尚未开场</strong><small>第一组节目不需要压过任何牌</small></div>';
    }
    function renderHand() {
        const current = state();
        const assessment = selectionAssessment(model);
        $('handCount').textContent = `${current.myHand?.length || 0} 张`;
        $('selectionHint').textContent = model.selected.size ? assessment.combo ? comboName(assessment.combo) : assessment.message : '点击连续手牌组成节目';
        const hand = current.myHand || [];
        const previewCard = current.availableActions?.canShow && ['scout', 'scoutShow'].includes(model.actionMode) ? orientedScoutCard(model) : null;
        const ghost = previewCard ? `<span class="sc-card sc-scout-ghost" aria-label="招募牌将插入这里">${cardFace(previewCard)}<small class="sc-ghost-label">招募插入</small></span>` : '';
        const rendered = [];
        hand.forEach((card, index) => {
            if (previewCard && index === model.scoutDraft.insertAt) rendered.push(ghost);
            const indices = selectedIndices(model); const first = indices[0]; const last = indices[indices.length - 1];
            const selectedClass = model.selected.has(index) ? `is-selected ${index === first ? 'is-first' : ''} ${index === last ? 'is-last' : ''}` : '';
            rendered.push(`<button type="button" class="sc-card ${selectedClass}" data-card-index="${index}" aria-pressed="${model.selected.has(index)}" aria-label="第 ${index + 1} 张牌，${card.value} 与 ${card.otherValue}">${cardFace(card, index)}</button>`);
        });
        if (previewCard && model.scoutDraft.insertAt >= hand.length) rendered.push(ghost);
        $('hand').innerHTML = rendered.join('') || '<div class="sc-empty-hand">节目单已经清空</div>';
    }
    function renderPlayers() {
        const current = state();
        $('players').innerHTML = (current.players || []).map(player => {
            const mine = player.id === current.myId;
            const handCount = Math.max(0, Number(player.handCount) || 0);
            const hiddenHand = mine
                ? `<span class="sc-own-hand-count">手牌 ${handCount}</span>`
                : `<span class="sc-opponent-hand" role="img" aria-label="隐藏手牌 ${handCount} 张"><span class="sc-card-back-fan" aria-hidden="true">${Array.from({ length: Math.min(3, handCount) }, () => '<i class="sc-card-back"></i>').join('')}</span><b>${handCount} 张</b></span>`;
            const chips = current.players.length === 2 && mine ? `<span>招募筹码 ${current.myScoutChips ?? 0}</span>` : '';
            return `<article class="sc-player ${mine ? 'is-me' : ''} ${player.isCurrent ? 'is-current' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}"><span class="sc-seat">${player.seat}</span><div><strong>${escapeHtml(player.name)}${mine ? '<b>我</b>' : ''}</strong><small>${player.isCurrent ? '正在行动' : player.id === current.startPlayerId ? '本轮起始' : player.isOnline === false ? '已离线' : '等待节目'}</small></div><div class="sc-player-score"><b>${player.score}</b><small>总分</small></div><footer>${hiddenHand}<span>赢牌 ${player.captured || 0}</span><span>招募标记 ${player.scoutTokens || 0}</span>${chips}</footer></article>`;
        }).join('');
    }
    function scoutFields() {
        const current = state();
        const handLength = current.myHand?.length || 0;
        const sourceCard = scoutSourceCard(model);
        const front = Number(sourceCard?.front ?? sourceCard?.value ?? 0);
        const back = Number(sourceCard?.back ?? sourceCard?.otherValue ?? sourceCard?.value ?? 0);
        const positions = Array.from({ length: handLength + 1 }, (_, index) => `<option value="${index}"${index === model.scoutDraft.insertAt ? ' selected' : ''}>${index === 0 ? '节目单最左' : index === handLength ? '节目单最右' : `第 ${index} 与 ${index + 1} 张之间`}</option>`).join('');
        return `<div class="sc-scout-config"><fieldset><legend>从哪一端招募</legend><div class="sc-segments"><button type="button" data-scout-edge="left" class="${model.scoutDraft.edge === 'left' ? 'is-selected' : ''}"><i>←</i><span>左端成员</span><small>${current.activeSet?.[0]?.value ?? '—'}</small></button><button type="button" data-scout-edge="right" class="${model.scoutDraft.edge === 'right' ? 'is-selected' : ''}"><i>→</i><span>右端成员</span><small>${current.activeSet?.at(-1)?.value ?? '—'}</small></button></div></fieldset><label><span>插入节目单</span><select data-draft="insertAt">${positions}</select></label><label><span>采用牌面</span><select data-draft="orientation"><option value="0"${model.scoutDraft.orientation === 0 ? ' selected' : ''}>${front || '—'} 朝上</option><option value="1"${model.scoutDraft.orientation === 1 ? ' selected' : ''}>${back || '—'} 朝上</option></select></label></div>`;
    }
    function confirmBlock(mark, title, copy, action, disabled = false) {
        return `<div class="sc-confirm"><span>${mark}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div><button class="sc-primary" type="button" data-action="${action}"${disabled || model.presentationPlaying || model.actionPending ? ' disabled' : ''}>${model.actionPending ? '处理中…' : '确认提交'}</button></div>`;
    }
    function renderCommand() {
        const current = state();
        const available = actions();
        if (available.canSetOrientation) {
            const chosen = model.orientationDraft !== null;
            $('command').innerHTML = `<div class="sc-command-heading"><div><span class="sc-kicker">开场准备</span><h2>决定整手牌的读取方向</h2></div><b>只选择一次</b></div><p class="sc-command-copy">比较两端数字后选择方向。提交后整手牌会锁定，不能再次翻面。</p><div class="sc-orientation-choice"><button type="button" data-orientation-choice="0" class="${model.orientationDraft === 0 ? 'is-selected' : ''}"><span>当前数字</span><strong>保持当前方向</strong><small>从左至右读取现在的上方数字</small></button><button type="button" data-orientation-choice="1" class="${model.orientationDraft === 1 ? 'is-selected' : ''}"><span>另一端数字</span><strong>整手翻面</strong><small>位置保持不变，采用每张牌另一端数字</small></button></div>${confirmBlock('向', chosen ? (model.orientationDraft === 0 ? '保持当前方向' : '整手翻面') : '尚未选择方向', '确认后本轮不能更改', 'confirmOrientation', !chosen)}`;
            return;
        }
        if (!available.canShow) {
            $('command').innerHTML = `<div class="sc-waiting"><span>${current.status === 'ended' ? '终' : '待'}</span><div><strong>${current.status === 'ended' ? '本局演出已经结束' : '当前不是你的行动阶段'}</strong><small>${current.status === 'ended' ? '查看右侧最终分数与演出记录' : '仍可观察舞台两端和其他玩家的手牌数量'}</small></div></div>`;
            return;
        }
        const modes = [{ id: 'show', name: '演出', copy: '打出连续组合', enabled: true }, { id: 'scout', name: '招募', copy: '取走舞台端牌', enabled: available.canScout }, { id: 'scoutShow', name: '招募并演出', copy: '每轮限一次', enabled: available.canScoutShow }].filter(mode => mode.enabled);
        if (!modes.some(mode => mode.id === model.actionMode)) model.actionMode = modes[0]?.id || 'show';
        let body = '';
        if (model.actionMode === 'show') {
            const assessment = selectionAssessment(model, 'show');
            const resultCopy = assessment.valid ? assessment.target ? `压过 ${comboName(assessment.target)} · 将赢得 ${assessment.target.length} 张节目牌` : '作为本轮第一个节目登台' : assessment.message;
            body = `<div class="sc-action-summary"><span>从节目单选择一段连续手牌</span><b>${model.selected.size ? escapeHtml(comboName(assessment.combo)) : '尚未选牌'}</b></div>${confirmBlock('演', assessment.valid ? comboName(assessment.combo) : '节目尚未就绪', resultCopy, 'confirmShow', !assessment.valid)}`;
        } else if (model.actionMode === 'scout') {
            const edgeValue = model.scoutDraft.edge === 'left' ? current.activeSet?.[0]?.value : current.activeSet?.at(-1)?.value;
            const award = current.players.length === 2 ? '将消耗 1 枚招募筹码' : `${current.activeOwnerName || '原表演者'}将获得 1 枚招募标记`;
            body = `${scoutFields()}${confirmBlock('招', `招募${model.scoutDraft.edge === 'left' ? '左端' : '右端'}的 ${edgeValue ?? '—'}`, `插入${model.scoutDraft.insertAt === 0 ? '最左侧' : model.scoutDraft.insertAt === current.myHand.length ? '最右侧' : `第 ${model.scoutDraft.insertAt} 张之后`} · ${award}`, 'confirmScout')}`;
        } else {
            const assessment = selectionAssessment(model, 'scoutShow');
            const resultCopy = assessment.valid ? assessment.target?.length ? `招募后压过 ${comboName(assessment.target)} · 将赢得 ${assessment.target.length} 张` : '招募后作为新的首项节目登台' : assessment.message;
            body = `<p class="sc-command-copy">先配置招募，再从上方节目单选择原有手牌；插入后的下标会自动校正。</p>${scoutFields()}${confirmBlock('合', assessment.valid ? `招募后演出 ${comboName(assessment.combo)}` : '组合尚未就绪', resultCopy, 'confirmScoutShow', !assessment.valid)}`;
        }
        $('command').innerHTML = `<div class="sc-command-heading"><div><span class="sc-kicker">我的行动</span><h2>安排下一项节目</h2></div><b>${current.players.length === 2 ? `招募筹码 ${current.myScoutChips ?? 0}` : current.myScoutShowAvailable ? '联演可用' : '联演已用'}</b></div><div class="sc-mode-tabs">${modes.map(mode => `<button type="button" data-mode="${mode.id}" class="${model.actionMode === mode.id ? 'is-selected' : ''}"><strong>${mode.name}</strong><small>${mode.copy}</small></button>`).join('')}</div><div class="sc-command-body">${body}</div>`;
    }
    function renderLog() {
        const current = state();
        const entries = (current.actionLog || []).slice().reverse();
        $('logCount').textContent = String(entries.length);
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') : '<p class="sc-log-empty">等待第一场表演。</p>';
    }
    function render() {
        const current = state();
        if (!current) return;
        mount.querySelector('.scout-app')?.setAttribute('aria-busy', String(model.actionPending));
        syncInteraction(model);
        const starter = (current.players || []).find(player => player.id === current.startPlayerId);
        $('round').textContent = current.status === 'ended' ? '本局结束' : `第 ${current.round || 1} / ${current.maxRounds || 1} 轮 · 起始 ${starter?.name || '—'}`;
        $('playerCount').textContent = `${current.players?.length || 0} 团`;
        const actionable = current.availableActions && Object.values(current.availableActions).some(Boolean);
        $('status').innerHTML = `<div><span class="sc-kicker">${escapeHtml(phaseName())}</span><h2>${escapeHtml(statusTitle())}</h2><p>${escapeHtml(statusDetail())}</p></div><span class="sc-status-ticket ${actionable ? 'is-mine' : ''}">${current.status === 'ended' ? '终' : actionable ? '我' : '待'}</span>`;
        renderActive(); renderHand(); renderPlayers(); renderCommand(); renderLog();
        if (model.actionPending) mount.querySelectorAll('[data-action], [data-mode], [data-orientation-choice], [data-scout-edge], [data-draft], [data-card-index]').forEach(control => { control.disabled = true; });
    }
    return { render, renderActive, renderHand, renderPlayers, renderCommand, renderLog, clearError, showError };
}
