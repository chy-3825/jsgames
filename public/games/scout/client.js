const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const CARD_COLORS = ['#d7594f', '#e78839', '#d8ad3d', '#75a35d', '#3f988c', '#3e83a7', '#5d6fb0', '#8b62a5', '#bc5c7d', '#76504f'];
const CARD_MOTIFS = ['●', '◆', '▲', '✦', '■', '✺'];

function cardFace(card, index = null, edge = '') {
    const value = Number(card?.value || 0);
    const otherValue = Number(card?.otherValue ?? value);
    const upper = CARD_COLORS[Math.max(0, value - 1) % CARD_COLORS.length];
    const lower = CARD_COLORS[Math.max(0, otherValue - 1) % CARD_COLORS.length];
    const motif = CARD_MOTIFS[Math.abs(value + otherValue) % CARD_MOTIFS.length];
    return `<span class="sc-card-fields" style="--upper:${upper};--lower:${lower}" aria-hidden="true"></span><b class="sc-card-top">${value}</b><span class="sc-card-motif" aria-hidden="true">${motif}</span><b class="sc-card-bottom">${otherValue}</b>${edge ? `<small class="sc-edge-label">${escapeHtml(edge)}</small>` : ''}${Number.isInteger(index) ? `<i class="sc-card-order">${index + 1}</i>` : ''}`;
}

function combination(cards = []) {
    if (!cards.length) return null;
    const values = cards.map(card => Number(card.value));
    if (cards.length === 1) return { kind: 'single', length: 1, strength: values[0], values };
    const matching = values.every(value => value === values[0]);
    const sequence = values.every((value, index) => index === 0 || Math.abs(value - values[index - 1]) === 1) && new Set(values).size === values.length;
    if (!matching && !sequence) return null;
    return { kind: matching ? 'matching' : 'sequence', length: cards.length, strength: matching ? values[0] : Math.min(...values), values };
}

function compareCombination(candidate, active) {
    if (!candidate) return -1;
    if (!active) return 1;
    if (candidate.length !== active.length) return candidate.length > active.length ? 1 : -1;
    if (candidate.kind !== active.kind) return candidate.kind === 'matching' ? 1 : -1;
    return candidate.strength === active.strength ? 0 : candidate.strength > active.strength ? 1 : -1;
}

function comboName(combo) {
    if (!combo) return '未形成有效节目';
    if (combo.kind === 'single') return `单牌 ${combo.strength}`;
    if (combo.kind === 'matching') return `${combo.length} 张同点 · ${combo.strength}`;
    return `${combo.length} 张顺子 · ${combo.values.join('–')}`;
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/scout/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-scout-view');

    mount.innerHTML = `
        <section class="scout-app">
            <header class="sc-header">
                <div class="sc-brand"><span class="sc-mark" aria-hidden="true"><i></i><b>星</b></span><div><small>巡回马戏团</small><h1>马戏星探</h1><p>节目顺序一旦排定，就不能悄悄换位</p></div></div>
                <div class="sc-round" data-role="round">等待开场</div>
                <div class="sc-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
            </header>
            <main class="sc-layout">
                <section class="sc-stage">
                    <div class="sc-status" data-role="status"></div>
                    <section class="sc-show-board">
                        <div class="sc-show-heading"><div><span class="sc-kicker">中央舞台</span><h2>当前节目</h2></div><div class="sc-current-combo" data-role="activeCombo"></div></div>
                        <div class="sc-curtain-stage"><i class="sc-curtain is-left" aria-hidden="true"></i><i class="sc-curtain is-right" aria-hidden="true"></i><div class="sc-active" data-role="active"></div><div class="sc-footlights" aria-hidden="true"></div></div>
                    </section>
                    <section class="sc-hand-panel">
                        <div class="sc-hand-heading"><div><span class="sc-kicker">我的节目单</span><h2>顺序锁定的手牌</h2></div><div class="sc-hand-meta"><b data-role="handCount">0 张</b><span data-role="selectionHint">点击连续手牌组成节目</span></div></div>
                        <div class="sc-program-track"><span class="sc-track-start">开场</span><div class="sc-hand" data-role="hand"></div><span class="sc-track-end">谢幕</span></div>
                    </section>
                    <section class="sc-command" data-role="command"></section>
                </section>
                <aside class="sc-side">
                    <section class="sc-panel sc-scoreboard"><div class="sc-panel-heading"><div><span class="sc-kicker">马戏团席位</span><h2>本轮阵容</h2></div><span data-role="playerCount">—</span></div><div class="sc-players" data-role="players"></div></section>
                    <section class="sc-panel sc-log-panel"><div class="sc-panel-heading"><div><span class="sc-kicker">场边播报</span><h2>演出记录</h2></div><span data-role="logCount">0</span></div><div class="sc-log" data-role="log"></div></section>
                </aside>
            </main>
            <div class="sc-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
                <div class="sc-presentation-shade"></div>
                <svg class="sc-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
                <section class="sc-presentation-scene" data-role="presentationScene"></section>
                <button class="sc-presentation-skip" type="button" data-ui="skipPresentation">跳过演出</button>
            </div>
            <div class="sc-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true"><article role="dialog" aria-modal="true" aria-labelledby="sc-rules-title" tabindex="-1"><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span class="sc-kicker">玩法说明</span><h2 id="sc-rules-title">马戏星探规则</h2><ol><li>每轮开始选择整手牌的方向；锁定后不能翻面，也不能改变手牌顺序。</li><li>只能打出位置连续的牌。它们必须是同点数，或按手牌方向逐张相邻的顺子。</li><li>先比较张数；张数相同时，同点数组合高于顺子，再比较组合点数。</li><li>不演出时，可从当前节目的左端或右端招募一张，按所选方向插入任意位置。</li><li>3–5 人局每轮可使用一次“招募并演出”；2 人局改为每人 3 枚招募筹码。</li><li>演出获得的牌与招募标记计分，回合结束时手中剩牌扣分。</li></ol><figure class="sc-art-reference"><img src="/assets/bgg/scout/detail.jpg" alt="马戏星探实体组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上牌面与节目顺序由实时状态绘制</figcaption></figure></article></div>
        </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = $('rulesOverlay');
    let state = null;
    let selected = new Set();
    let actionMode = 'show';
    let orientationDraft = null;
    let scoutDraft = { edge: 'left', insertAt: 0, orientation: 0 };
    let interactionKey = '';
    let rulesTrigger = null;
    let bodyOverflow = '';
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let lastPresentationSequence = null;
    let waitTimer = null;
    let releaseWait = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function selectedIndices() { return [...selected].sort((a, b) => a - b); }
    function selectedCards() { return selectedIndices().map(index => state.myHand?.[index]).filter(Boolean); }
    function selectionIsContinuous(indices = selectedIndices()) { return indices.length > 0 && indices.every((index, position) => position === 0 || index === indices[position - 1] + 1); }
    function activeAfterScout() {
        const cards = (state.activeSet || []).slice();
        if (scoutDraft.edge === 'left') cards.shift(); else cards.pop();
        return cards;
    }
    function scoutSourceCard() {
        const active = state.activeSet || [];
        return scoutDraft.edge === 'left' ? active[0] : active.at(-1);
    }
    function orientedScoutCard() {
        const card = scoutSourceCard();
        if (!card) return null;
        const front = Number(card.front ?? card.value ?? 0);
        const back = Number(card.back ?? card.otherValue ?? card.value ?? 0);
        return { ...card, value: scoutDraft.orientation === 1 ? back : front, otherValue: scoutDraft.orientation === 1 ? front : back, orientation: scoutDraft.orientation };
    }
    function postScoutIndices() { return selectedIndices().map(index => index >= scoutDraft.insertAt ? index + 1 : index); }
    function postScoutSelectionIsContinuous() { return selectionIsContinuous(postScoutIndices()); }
    function selectionAssessment(mode = actionMode) {
        const combo = combination(selectedCards());
        if (!selected.size) return { combo: null, valid: false, message: '请从上方节目单选择连续手牌' };
        if (!selectionIsContinuous()) return { combo: null, valid: false, message: '手牌必须连续，不能跨过中间的牌' };
        if (!combo) return { combo: null, valid: false, message: '所选牌不是同点数，也不是连续顺子' };
        if (mode === 'scoutShow' && !postScoutSelectionIsContinuous()) return { combo, valid: false, message: '当前插入位置会拆开所选节目，请移到组合外侧' };
        const target = combination(mode === 'scoutShow' ? activeAfterScout() : state.activeSet || []);
        if (compareCombination(combo, target) <= 0) return { combo, valid: false, message: '这组牌还压不过招募后的当前节目' };
        return { combo, target, valid: true, message: mode === 'scoutShow' ? '招募后将立即提交这组节目' : '这组节目可以登台' };
    }

    function syncInteraction() {
        const handKey = (state.myHand || []).map(card => `${card.id}:${card.value}`).join(',');
        const activeKey = (state.activeSet || []).map(card => `${card.id}:${card.value}`).join(',');
        const key = [state.status, state.phase, state.currentPlayerId, handKey, activeKey].join('|');
        if (key === interactionKey) return;
        interactionKey = key;
        selected = new Set();
        orientationDraft = null;
        actionMode = 'show';
        scoutDraft = { edge: 'left', insertAt: 0, orientation: 0 };
    }

    function phaseName() {
        if (state.status === 'ended') return '全场谢幕';
        if (state.phase === 'orienting') return '排定节目单';
        return state.currentPlayerId === state.myId ? '我的行动' : '观看演出';
    }
    function statusTitle() {
        if (state.status === 'ended') return `${(state.winners || []).map(player => player.name).join('、') || '本局'} 获胜`;
        if (state.phase === 'orienting') return state.availableActions?.canSetOrientation ? '请选择整手牌方向' : '等待其他马戏团排定节目';
        return state.currentPlayerId === state.myId ? '聚光灯已经照向你' : `${state.currentPlayerName || '下一位'} 正在决定节目`;
    }
    function statusDetail() {
        if (state.status === 'ended') return '最终分数已经结算';
        if (state.phase === 'orienting') return '整手翻面只改变读取方向，牌与牌之间的位置不会改变';
        if (state.currentPlayerId === state.myId) return '选择一段连续手牌演出，或从舞台两端招募成员';
        return state.activeOwnerName ? `当前节目由 ${state.activeOwnerName} 保持` : '等待本轮第一个节目登台';
    }

    function render() {
        if (!state) return;
        syncInteraction();
        const starter = (state.players || []).find(player => player.id === state.startPlayerId);
        $('round').textContent = state.status === 'ended' ? '本局结束' : `第 ${state.round || 1} / ${state.maxRounds || 1} 轮 · 起始 ${starter?.name || '—'}`;
        $('playerCount').textContent = `${state.players?.length || 0} 团`;
        const actionable = state.availableActions && Object.values(state.availableActions).some(Boolean);
        $('status').innerHTML = `<div><span class="sc-kicker">${escapeHtml(phaseName())}</span><h2>${escapeHtml(statusTitle())}</h2><p>${escapeHtml(statusDetail())}</p></div><span class="sc-status-ticket ${actionable ? 'is-mine' : ''}">${state.status === 'ended' ? '终' : actionable ? '我' : '待'}</span>`;
        renderActive(); renderHand(); renderPlayers(); renderCommand(); renderLog();
    }

    function renderActive() {
        const activeCards = state.activeSet || [];
        const combo = combination(activeCards);
        const activeMount = $('active');
        activeMount.classList.toggle('is-sparse', activeCards.length > 0 && activeCards.length <= 4);
        activeMount.classList.toggle('is-crowded', activeCards.length >= 8);
        $('activeCombo').innerHTML = combo ? `<span>${escapeHtml(state.activeOwnerName || '舞台')}</span><strong>${escapeHtml(comboName(combo))}</strong>` : '<span>等待开场</span><strong>空舞台</strong>';
        activeMount.innerHTML = activeCards.length ? activeCards.map((card, index) => {
            const edge = index === 0 ? '左端' : index === activeCards.length - 1 ? '右端' : '';
            return `<article class="sc-active-card" style="--index:${index}">${cardFace(card, null, edge)}</article>`;
        }).join('') : '<div class="sc-empty-stage"><span>★</span><strong>舞台尚未开场</strong><small>第一组节目不需要压过任何牌</small></div>';
    }

    function renderHand() {
        const assessment = selectionAssessment();
        $('handCount').textContent = `${state.myHand?.length || 0} 张`;
        $('selectionHint').textContent = selected.size ? assessment.combo ? comboName(assessment.combo) : assessment.message : '点击连续手牌组成节目';
        const hand = state.myHand || [];
        const previewCard = state.availableActions?.canShow && ['scout', 'scoutShow'].includes(actionMode) ? orientedScoutCard() : null;
        const ghost = previewCard ? `<span class="sc-card sc-scout-ghost" aria-label="招募牌将插入这里">${cardFace(previewCard)}<small class="sc-ghost-label">招募插入</small></span>` : '';
        const rendered = [];
        hand.forEach((card, index) => {
            if (previewCard && index === scoutDraft.insertAt) rendered.push(ghost);
            const indices = selectedIndices(); const first = indices[0]; const last = indices[indices.length - 1];
            const selectedClass = selected.has(index) ? `is-selected ${index === first ? 'is-first' : ''} ${index === last ? 'is-last' : ''}` : '';
            rendered.push(`<button type="button" class="sc-card ${selectedClass}" data-card-index="${index}" aria-pressed="${selected.has(index)}" aria-label="第 ${index + 1} 张牌，${card.value} 与 ${card.otherValue}">${cardFace(card, index)}</button>`);
        });
        if (previewCard && scoutDraft.insertAt >= hand.length) rendered.push(ghost);
        $('hand').innerHTML = rendered.join('') || '<div class="sc-empty-hand">节目单已经清空</div>';
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map(player => {
            const mine = player.id === state.myId;
            const handCount = Math.max(0, Number(player.handCount) || 0);
            const hiddenHand = mine
                ? `<span class="sc-own-hand-count">手牌 ${handCount}</span>`
                : `<span class="sc-opponent-hand" role="img" aria-label="隐藏手牌 ${handCount} 张"><span class="sc-card-back-fan" aria-hidden="true">${Array.from({ length: Math.min(3, handCount) }, () => '<i class="sc-card-back"></i>').join('')}</span><b>${handCount} 张</b></span>`;
            const chips = state.players.length === 2 && mine ? `<span>招募筹码 ${state.myScoutChips ?? 0}</span>` : '';
            return `<article class="sc-player ${mine ? 'is-me' : ''} ${player.isCurrent ? 'is-current' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}"><span class="sc-seat">${player.seat}</span><div><strong>${escapeHtml(player.name)}${mine ? '<b>我</b>' : ''}</strong><small>${player.isCurrent ? '正在行动' : player.id === state.startPlayerId ? '本轮起始' : player.isOnline === false ? '已离线' : '等待节目'}</small></div><div class="sc-player-score"><b>${player.score}</b><small>总分</small></div><footer>${hiddenHand}<span>赢牌 ${player.captured || 0}</span><span>招募标记 ${player.scoutTokens || 0}</span>${chips}</footer></article>`;
        }).join('');
    }

    function scoutFields() {
        const handLength = state.myHand?.length || 0;
        const sourceCard = scoutSourceCard();
        const front = Number(sourceCard?.front ?? sourceCard?.value ?? 0);
        const back = Number(sourceCard?.back ?? sourceCard?.otherValue ?? sourceCard?.value ?? 0);
        const positions = Array.from({ length: handLength + 1 }, (_, index) => `<option value="${index}"${index === scoutDraft.insertAt ? ' selected' : ''}>${index === 0 ? '节目单最左' : index === handLength ? '节目单最右' : `第 ${index} 与 ${index + 1} 张之间`}</option>`).join('');
        return `<div class="sc-scout-config"><fieldset><legend>从哪一端招募</legend><div class="sc-segments"><button type="button" data-scout-edge="left" class="${scoutDraft.edge === 'left' ? 'is-selected' : ''}"><i>←</i><span>左端成员</span><small>${state.activeSet?.[0]?.value ?? '—'}</small></button><button type="button" data-scout-edge="right" class="${scoutDraft.edge === 'right' ? 'is-selected' : ''}"><i>→</i><span>右端成员</span><small>${state.activeSet?.at(-1)?.value ?? '—'}</small></button></div></fieldset><label><span>插入节目单</span><select data-draft="insertAt">${positions}</select></label><label><span>采用牌面</span><select data-draft="orientation"><option value="0"${scoutDraft.orientation === 0 ? ' selected' : ''}>${front || '—'} 朝上</option><option value="1"${scoutDraft.orientation === 1 ? ' selected' : ''}>${back || '—'} 朝上</option></select></label></div>`;
    }

    function confirmBlock(mark, title, copy, action, disabled = false) {
        return `<div class="sc-confirm"><span>${mark}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div><button class="sc-primary" type="button" data-action="${action}"${disabled || presentationPlaying ? ' disabled' : ''}>确认提交</button></div>`;
    }

    function renderCommand() {
        const actions = state.availableActions || {};
        if (actions.canSetOrientation) {
            const chosen = orientationDraft !== null;
            $('command').innerHTML = `<div class="sc-command-heading"><div><span class="sc-kicker">开场准备</span><h2>决定整手牌的读取方向</h2></div><b>只选择一次</b></div><p class="sc-command-copy">比较两端数字后选择方向。提交后整手牌会锁定，不能再次翻面。</p><div class="sc-orientation-choice"><button type="button" data-orientation-choice="0" class="${orientationDraft === 0 ? 'is-selected' : ''}"><span>当前数字</span><strong>保持当前方向</strong><small>从左至右读取现在的上方数字</small></button><button type="button" data-orientation-choice="1" class="${orientationDraft === 1 ? 'is-selected' : ''}"><span>另一端数字</span><strong>整手翻面</strong><small>位置保持不变，采用每张牌另一端数字</small></button></div>${confirmBlock('向', chosen ? (orientationDraft === 0 ? '保持当前方向' : '整手翻面') : '尚未选择方向', '确认后本轮不能更改', 'confirmOrientation', !chosen)}`;
            return;
        }
        if (!actions.canShow) {
            $('command').innerHTML = `<div class="sc-waiting"><span>${state.status === 'ended' ? '终' : '待'}</span><div><strong>${state.status === 'ended' ? '本局演出已经结束' : '当前不是你的行动阶段'}</strong><small>${state.status === 'ended' ? '查看右侧最终分数与演出记录' : '仍可观察舞台两端和其他玩家的手牌数量'}</small></div></div>`;
            return;
        }
        const modes = [{ id: 'show', name: '演出', copy: '打出连续组合', enabled: true }, { id: 'scout', name: '招募', copy: '取走舞台端牌', enabled: actions.canScout }, { id: 'scoutShow', name: '招募并演出', copy: '每轮限一次', enabled: actions.canScoutShow }].filter(mode => mode.enabled);
        if (!modes.some(mode => mode.id === actionMode)) actionMode = modes[0]?.id || 'show';
        let body = '';
        if (actionMode === 'show') {
            const assessment = selectionAssessment('show');
            const resultCopy = assessment.valid ? assessment.target ? `压过 ${comboName(assessment.target)} · 将赢得 ${assessment.target.length} 张节目牌` : '作为本轮第一个节目登台' : assessment.message;
            body = `<div class="sc-action-summary"><span>从节目单选择一段连续手牌</span><b>${selected.size ? escapeHtml(comboName(assessment.combo)) : '尚未选牌'}</b></div>${confirmBlock('演', assessment.valid ? comboName(assessment.combo) : '节目尚未就绪', resultCopy, 'confirmShow', !assessment.valid)}`;
        } else if (actionMode === 'scout') {
            const edgeValue = scoutDraft.edge === 'left' ? state.activeSet?.[0]?.value : state.activeSet?.at(-1)?.value;
            const award = state.players.length === 2 ? '将消耗 1 枚招募筹码' : `${state.activeOwnerName || '原表演者'}将获得 1 枚招募标记`;
            body = `${scoutFields()}${confirmBlock('招', `招募${scoutDraft.edge === 'left' ? '左端' : '右端'}的 ${edgeValue ?? '—'}`, `插入${scoutDraft.insertAt === 0 ? '最左侧' : scoutDraft.insertAt === state.myHand.length ? '最右侧' : `第 ${scoutDraft.insertAt} 张之后`} · ${award}`, 'confirmScout')}`;
        } else {
            const assessment = selectionAssessment('scoutShow');
            const resultCopy = assessment.valid ? assessment.target?.length ? `招募后压过 ${comboName(assessment.target)} · 将赢得 ${assessment.target.length} 张` : '招募后作为新的首项节目登台' : assessment.message;
            body = `<p class="sc-command-copy">先配置招募，再从上方节目单选择原有手牌；插入后的下标会自动校正。</p>${scoutFields()}${confirmBlock('合', assessment.valid ? `招募后演出 ${comboName(assessment.combo)}` : '组合尚未就绪', resultCopy, 'confirmScoutShow', !assessment.valid)}`;
        }
        $('command').innerHTML = `<div class="sc-command-heading"><div><span class="sc-kicker">我的行动</span><h2>安排下一项节目</h2></div><b>${state.players.length === 2 ? `招募筹码 ${state.myScoutChips ?? 0}` : state.myScoutShowAvailable ? '联演可用' : '联演已用'}</b></div><div class="sc-mode-tabs">${modes.map(mode => `<button type="button" data-mode="${mode.id}" class="${actionMode === mode.id ? 'is-selected' : ''}"><strong>${mode.name}</strong><small>${mode.copy}</small></button>`).join('')}</div><div class="sc-command-body">${body}</div>`;
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('logCount').textContent = String(entries.length);
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') : '<p class="sc-log-empty">等待第一场表演。</p>';
    }

    function waitForPresentation(milliseconds, token) {
        if (token !== presentationToken) return Promise.resolve();
        const duration = reducedMotion ? Math.min(milliseconds, 80) : milliseconds;
        return new Promise(resolve => {
            releaseWait = () => {
                window.clearTimeout(waitTimer);
                waitTimer = null;
                releaseWait = null;
                resolve();
            };
            waitTimer = window.setTimeout(releaseWait, duration);
        });
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function clearPresentationTargets() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target'));
        $('actionLine').classList.remove('is-visible');
    }

    function drawActionLine(fromElement, toElement, direction = 'forward') {
        if (!fromElement || !toElement || reducedMotion) return;
        const svg = $('actionLine');
        const line = svg.querySelector('line');
        const head = svg.querySelector('circle');
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        head.setAttribute('cx', x2); head.setAttribute('cy', y2);
        svg.dataset.direction = direction;
        svg.classList.add('is-visible');
        fromElement.classList.add('is-presentation-source');
        toElement.classList.add('is-presentation-target');
    }

    function showPresentation(kind, html, options = {}) {
        const layer = $('presentationLayer');
        clearPresentationTargets();
        layer.hidden = false;
        layer.className = `sc-presentation-layer is-${kind} ${options.major ? 'is-major' : ''} ${options.compact ? 'is-compact' : ''}`;
        $('presentationScene').innerHTML = html;
        window.requestAnimationFrame(() => layer.classList.add('is-visible'));
    }

    function hidePresentation() {
        clearPresentationTargets();
        const layer = $('presentationLayer');
        layer.classList.remove('is-visible');
        layer.hidden = true;
        $('presentationScene').innerHTML = '';
    }

    function eventCards(cards = [], className = '') {
        return cards.map((card, index) => `<article class="sc-event-card ${className}" style="--event-index:${index}">${cardFace(card)}</article>`).join('') || '<span class="sc-event-empty">空舞台</span>';
    }

    function eventComboName(combo) {
        if (!combo) return '新的节目';
        if (combo.kind === 'single') return `单牌 ${combo.strength}`;
        if (combo.kind === 'matching') return `${combo.length} 张同点 · ${combo.strength}`;
        return `${combo.length} 张顺子 · ${(combo.values || []).join('–')}`;
    }

    async function playShowEvent(event, token) {
        showPresentation('show', `<span class="sc-event-kicker">${escapeHtml(event.actorName)} 登台</span><h2>${escapeHtml(eventComboName(event.combination))}</h2><div class="sc-event-card-row">${eventCards(event.newShow, 'is-new-show')}</div><p data-role="eventCopy">${event.capturedCount ? `压过旧节目，并赢得 ${escapeHtml(event.capturedCount)} 张牌` : '本轮第一项节目正式登台'}</p>`, { compact: true });
        drawActionLine(playerAnchor(event.actorId), $('active'), 'to-stage');
        await waitForPresentation(720, token);
        if (event.capturedCount && token === presentationToken) {
            clearPresentationTargets();
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.innerHTML = `旧节目收归 <strong>${escapeHtml(event.actorName)}</strong> · +${escapeHtml(event.capturedCount)} 张赢牌`;
            drawActionLine($('active'), playerAnchor(event.actorId), 'capture');
            await waitForPresentation(520, token);
        }
    }

    async function playScoutEvent(event, token) {
        const side = event.edge === 'left' ? '左端' : '右端';
        showPresentation('scout', `<span class="sc-event-kicker">${escapeHtml(event.actorName)} 发起招募</span><h2>从舞台${side}带走成员</h2><div class="sc-event-card-row is-single">${eventCards([event.card], 'is-scouted')}</div><p data-role="eventCopy">采用 ${escapeHtml(event.card?.value)} 点方向 · 插入节目单第 ${Number(event.insertAt) + 1} 位</p>`, { compact: true });
        drawActionLine($('active'), playerAnchor(event.actorId), 'from-stage');
        await waitForPresentation(760, token);
        if (event.ownerTokenAwarded && event.activeOwnerId && token === presentationToken) {
            clearPresentationTargets();
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.innerHTML = `<strong>${escapeHtml(event.activeOwnerName)}</strong> 因节目被招募获得 1 枚标记`;
            drawActionLine($('active'), playerAnchor(event.activeOwnerId), 'token');
            await waitForPresentation(480, token);
        } else if (event.scoutChipSpent && token === presentationToken) {
            const copy = $('presentationScene').querySelector('[data-role="eventCopy"]');
            if (copy) copy.textContent = `${event.actorName} 消耗了 1 枚招募筹码`;
            await waitForPresentation(320, token);
        }
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== presentationToken) return;
        if (event.kind === 'orientationLocked') {
            showPresentation('orientation', `<span class="sc-event-kicker">节目单封存</span><h2>${escapeHtml(event.playerName)} 已锁定方向</h2><p>${escapeHtml(event.lockedCount)} / ${escapeHtml(event.totalPlayers)} 个马戏团准备完成</p>`, { compact: true });
            await waitForPresentation(event.allLocked ? 520 : 380, token);
            return;
        }
        if (event.kind === 'showtimeStarted') {
            showPresentation('showtime', `<span class="sc-event-kicker">第 ${escapeHtml(event.round)} 轮</span><h2>帷幕升起</h2><p>聚光灯首先照向 ${escapeHtml(event.starterName)}。</p>`, { compact: true });
            await waitForPresentation(760, token);
            return;
        }
        if (event.kind === 'showPerformed') {
            await playShowEvent(event, token);
            return;
        }
        if (event.kind === 'cardScouted') {
            await playScoutEvent(event, token);
            return;
        }
        if (event.kind === 'roundSettlement') {
            const reason = event.reason === 'empty' ? `${event.winnerName} 清空了节目单` : `${event.winnerName} 的节目无人能够压过`;
            const rows = (event.scores || []).slice().sort((left, right) => right.total - left.total).map(score => `<li><strong>${escapeHtml(score.name)}</strong><span>赢牌 ${escapeHtml(score.capturedPoints)} + 标记 ${escapeHtml(score.scoutTokenPoints)}${score.scoutChipPoints ? ` + 筹码 ${escapeHtml(score.scoutChipPoints)}` : ''} − 手牌 ${escapeHtml(score.handPenalty)}</span><b>${score.gained >= 0 ? '+' : ''}${escapeHtml(score.gained)}</b><em>累计 ${escapeHtml(score.total)}</em></li>`).join('');
            showPresentation('round-settlement', `<span class="sc-event-kicker">第 ${escapeHtml(event.round)} 轮谢幕</span><h2>${escapeHtml(reason)}</h2><ol class="sc-event-scores">${rows}</ol>`, { major: true });
            await waitForPresentation(1900, token);
            return;
        }
        if (event.kind === 'roundTransition') {
            showPresentation('round-transition', `<span class="sc-event-kicker">巡演换场</span><h2>第 ${escapeHtml(event.nextRound)} 轮即将开幕</h2><p>起始标记交给 ${escapeHtml(event.starterName)}。</p>`, { major: true });
            await waitForPresentation(850, token);
            return;
        }
        if (event.kind === 'roundStarted') {
            const hands = (event.handCounts || []).map(player => `<span><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(player.count)} 张</b></span>`).join('');
            showPresentation('round-started', `<span class="sc-event-kicker">新节目单已经发放</span><h2>第 ${escapeHtml(event.round)} 轮开场</h2><div class="sc-event-hands">${hands}</div><p>请各自决定整手牌方向。</p>`, { compact: true });
            await waitForPresentation(900, token);
            return;
        }
        if (event.kind === 'finalSettlement') {
            const winners = new Set(event.winnerIds || []);
            const standings = (event.standings || []).map((player, index) => `<li class="${winners.has(player.id) ? 'is-winner' : ''}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(player.score)} 分</b><small>${winners.has(player.id) ? '最终冠军' : '巡演完成'}</small></li>`).join('');
            showPresentation('final-settlement', `<span class="sc-event-kicker">巡回演出终场</span><h2>${winners.size > 1 ? '并列摘下马戏桂冠' : '今晚的马戏之星'}</h2><ol class="sc-final-scores">${standings}</ol>`, { major: true });
            await waitForPresentation(2800, token);
        }
    }

    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true;
        const token = presentationToken;
        renderCommand();
        while (presentationQueue.length && token === presentationToken) await playPresentationEvent(presentationQueue.shift(), token);
        if (token === presentationToken) {
            hidePresentation();
            presentationPlaying = false;
            render();
        }
    }

    function enqueuePresentation(presentation) {
        if (!presentation?.events?.length) return;
        presentationQueue.push(...presentation.events);
        drainPresentations();
    }

    function skipPresentations() {
        presentationToken += 1;
        presentationQueue = [];
        releaseWait?.();
        hidePresentation();
        presentationPlaying = false;
        render();
    }

    function updateSelection(index) {
        if (!state.availableActions?.canShow || presentationPlaying) return;
        if (!selected.size) selected.add(index);
        else if (selected.has(index)) {
            const indices = selectedIndices();
            if (index === indices[0] || index === indices.at(-1)) selected.delete(index); else selected = new Set([index]);
        } else {
            const indices = selectedIndices();
            if (index === indices[0] - 1 || index === indices.at(-1) + 1) selected.add(index); else selected = new Set([index]);
        }
        renderHand(); renderCommand();
    }

    function openRules(trigger) {
        rulesTrigger = trigger || document.activeElement;
        bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        overlay.classList.remove('is-hidden'); overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }
    function closeRules() {
        if (overlay.classList.contains('is-hidden')) return;
        overlay.classList.add('is-hidden'); overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = bodyOverflow; rulesTrigger?.focus?.({ preventScroll: true }); rulesTrigger = null;
    }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton?.dataset.ui === 'skipPresentation') { skipPresentations(); return; }
        if (presentationPlaying) return;
        if (uiButton) { if (uiButton.dataset.ui === 'leave') leaveRoom?.(); if (uiButton.dataset.ui === 'rules') openRules(uiButton); if (uiButton.dataset.ui === 'closeRules') closeRules(); return; }
        if (event.target === overlay) { closeRules(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card) { updateSelection(Number(card.dataset.cardIndex)); return; }
        const orientation = event.target.closest('[data-orientation-choice]');
        if (orientation) { orientationDraft = Number(orientation.dataset.orientationChoice); renderCommand(); return; }
        const mode = event.target.closest('[data-mode]');
        if (mode) {
            actionMode = mode.dataset.mode;
            if (['scout', 'scoutShow'].includes(actionMode)) scoutDraft.orientation = Number(scoutSourceCard()?.orientation) || 0;
            renderHand(); renderCommand(); return;
        }
        const edge = event.target.closest('[data-scout-edge]');
        if (edge) { scoutDraft.edge = edge.dataset.scoutEdge; scoutDraft.orientation = Number(scoutSourceCard()?.orientation) || 0; renderHand(); renderCommand(); return; }
        const action = event.target.closest('[data-action]');
        if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmOrientation' && orientationDraft !== null) send({ type: 'gameAction', action: { kind: 'setOrientation', orientation: orientationDraft } });
        if (action.dataset.action === 'confirmShow' && selectionAssessment('show').valid) send({ type: 'gameAction', action: { kind: 'show', cardIndices: selectedIndices() } });
        if (action.dataset.action === 'confirmScout') send({ type: 'gameAction', action: { kind: 'scout', ...scoutDraft } });
        if (action.dataset.action === 'confirmScoutShow' && selectionAssessment('scoutShow').valid) send({ type: 'gameAction', action: { kind: 'scoutShow', ...scoutDraft, cardIndices: postScoutIndices() } });
    }
    function handleChange(event) {
        const field = event.target.closest('[data-draft]'); if (!field || presentationPlaying) return;
        scoutDraft[field.dataset.draft] = Number(field.value);
        renderHand(); renderCommand();
    }
    function handleKeydown(event) { if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) closeRules(); }

    mount.addEventListener('click', handleClick);
    mount.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
    return {
        gameType: 'scout',
        handleMessage(message) {
            if (message.state) {
                const hadState = Boolean(state);
                const incomingPresentation = message.state.presentation;
                state = message.state;
                render();
                if (incomingPresentation?.sequence !== lastPresentationSequence) {
                    const shouldPlay = hadState;
                    lastPresentationSequence = incomingPresentation?.sequence ?? lastPresentationSequence;
                    if (shouldPlay && incomingPresentation) enqueuePresentation(incomingPresentation);
                }
            }
            if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
        },
        destroy() {
            presentationToken += 1; presentationQueue = []; releaseWait?.();
            mount.removeEventListener('click', handleClick); mount.removeEventListener('change', handleChange); document.removeEventListener('keydown', handleKeydown); closeRules(); document.body.classList.remove('is-scout-view'); style.remove(); mount.innerHTML = '';
        },
    };
}
