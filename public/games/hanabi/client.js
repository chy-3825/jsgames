const COLORS = ['red', 'yellow', 'green', 'blue', 'white'];
const VALUES = [1, 2, 3, 4, 5];
const LABELS = { red: '红', yellow: '黄', green: '绿', blue: '蓝', white: '白' };
const COPIES = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 };
const END_LABELS = {
    perfect: '五色烟花全部完成',
    fuses: '第三根引信熄灭，演出失败',
    deck: '最终轮结束，演出落幕',
    players: '在线玩家不足，合作局结束',
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

function publicCardMarkup(card, options = {}) {
    const { compact = false, matched = false, dimmed = false, kind = '' } = options;
    if (!card || card.hidden || !COLORS.includes(card.color) || !VALUES.includes(Number(card.value))) {
        return '<span class="hb-public-card hb-public-card-back" aria-label="隐藏牌"><i></i><b aria-hidden="true"></b></span>';
    }
    const value = Number(card.value);
    const label = LABELS[card.color];
    return `<span class="hb-public-card tone-${card.color} value-${value} ${kind ? `hb-${kind}-card` : ''} ${compact ? 'is-compact' : ''} ${matched ? 'is-clue-match' : ''} ${dimmed ? 'is-clue-dim' : ''}" aria-label="${label}色 ${value}">
        <span class="hb-card-corner hb-card-corner-top">${value}</span>
        <span class="hb-card-burst" aria-hidden="true"><i></i><i></i><i></i></span>
        <strong>${value}</strong>
        <small>${label}色</small>
        <span class="hb-card-corner hb-card-corner-bottom">${value}</span>
    </span>`;
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/hanabi/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-hanabi-view');

    let state = null;
    let targetId = null;
    let clueKind = 'color';
    let clueValue = 'red';
    let rulesTrigger = null;
    let pendingCardId = null;
    let submittingCardAction = null;
    let lastPresentedActionId = 0;
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    mount.innerHTML = `<section class="hb-app">
        <header class="hb-header">
            <div class="hb-brand">
                <span class="hb-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <div><small>看见彼此 · 点亮夜空</small><h1>花火</h1></div>
            </div>
            <div class="hb-turn" data-role="turn" aria-live="polite"><span class="hb-live-dot"></span>等待游戏状态</div>
            <div class="hb-header-score"><small>协作得分</small><strong data-role="headerScore">0</strong><span>/ 25</span></div>
            <div class="hb-header-actions">
                <button class="hb-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button>
                <button class="hb-leave-button" data-ui="leave" type="button">离开牌桌</button>
            </div>
        </header>

        <main class="hb-layout">
            <section class="hb-sky">
                <header class="hb-section-header">
                    <div><small>演出进度</small><h2>五色烟花</h2></div>
                    <div class="hb-score-copy"><strong data-role="score">0</strong><span>共同得分</span></div>
                </header>
                <div class="hb-fireworks" data-role="fireworks"></div>
                <div class="hb-resources" data-role="resources"></div>
            </section>

            <aside class="hb-command-panel" data-role="command"></aside>

            <section class="hb-teammates-section">
                <header class="hb-section-header">
                    <div><small>公开信息</small><h2>队友的牌</h2></div>
                    <span data-role="teammateHint">选择队友给予完整提示</span>
                </header>
                <div class="hb-teammates" data-role="teammates"></div>
            </section>

            <section class="hb-my-hand">
                <header class="hb-section-header">
                    <div><small>提示记忆</small><h2>我的牌背</h2></div>
                    <span data-role="handHint">只根据已知提示行动</span>
                </header>
                <div class="hb-hand" data-role="hand"></div>
                <div class="hb-hand-action-bar is-hidden" data-role="handActions"></div>
            </section>

            <aside class="hb-table-rail">
                <section class="hb-players-panel">
                    <header><small>顺时针行动</small><h2>行动顺序</h2></header>
                    <div class="hb-players" data-role="players"></div>
                </section>
                <section class="hb-discard-panel">
                    <header><div><small>牌库追踪</small><h2>弃牌统计</h2></div><span data-role="discardCount">0 张</span></header>
                    <div class="hb-discard" data-role="discard"></div>
                </section>
                <section class="hb-log-panel">
                    <header><small>行动回顾</small><h2>演出记录</h2></header>
                    <div class="hb-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="hb-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
            <svg class="hb-action-lines" data-role="actionLines" aria-hidden="true">
                <defs>
                    <filter id="hbLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
                    <marker id="hbLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker>
                </defs>
                <path data-role="actionPath"></path>
            </svg>
            <div class="hb-action-stage" data-role="actionStage" role="status" aria-live="assertive"></div>
            <button class="hb-presentation-skip" data-action="skipPresentation" type="button">跳过</button>
        </div>

        <div class="hb-overlay is-hidden" data-role="rules" role="presentation">
            <article class="hb-rules" role="dialog" aria-modal="true" aria-labelledby="hbRulesTitle">
                <button class="hb-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="hb-rules-art">
                    <div class="hb-rules-card-fan" aria-label="五色花火牌与隐藏牌背示例">
                        ${COLORS.map((color, index) => publicCardMarkup({ color, value: index + 1 }, { kind: 'rules' })).join('')}
                        <span class="hb-public-card hb-public-card-back hb-rules-card" aria-label="隐藏牌背"><i></i><b aria-hidden="true"></b></span>
                    </div>
                    <span>合作</span>
                </div>
                <div class="hb-rules-copy">
                    <small>基础规则</small>
                    <h2 id="hbRulesTitle">看得见彼此，看不见自己</h2>
                    <ol>
                        <li><b>共同目标</b><span>五种颜色分别按 1、2、3、4、5 的顺序完成，最终得分为五条烟花之和。</span></li>
                        <li><b>隐藏手牌</b><span>你只能看队友的牌；自己的牌面始终不可见，只能依据收到的提示推理。</span></li>
                        <li><b>完整提示</b><span>消耗一枚提示令牌，指出一名队友手中某种颜色或某个数字的全部牌，不能提示零张。</span></li>
                        <li><b>出牌与弃牌</b><span>正确出牌推进烟花；错误牌公开弃置并点燃一根引信。弃牌恢复一枚提示令牌。</span></li>
                        <li><b>演出结束</b><span>第三次失误立即失败；抽走牌库最后一张后，每名玩家各再行动一次。</span></li>
                    </ol>
                    <div class="hb-rules-tokens"><span><i class="is-clue"></i>8 枚提示</span><span><i class="is-fuse"></i>3 根引信</span><span><i class="is-score"></i>25 分完美演出</span></div>
                    <p>本桌实现五色基础版，不包含第六种多色牌、皇冠或其他扩展规则。</p>
                </div>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    function endLabel() {
        return END_LABELS[state?.endReason] || `本局结束 · ${state?.score || 0} / 25 分`;
    }

    function currentTarget() {
        return (state?.players || []).find(player => player.id === targetId && player.id !== state.myId && player.isOnline !== false) || null;
    }

    function cardMatchesClue(card) {
        if (!card || card.hidden) return false;
        return clueKind === 'color' ? card.color === clueValue : Number(card.value) === Number(clueValue);
    }

    function normalizeClueValue() {
        const target = currentTarget();
        const cards = (target?.hand || []).filter(card => !card.hidden);
        if (!cards.length) return;
        const hasCurrent = cards.some(card => cardMatchesClue(card));
        if (!hasCurrent) clueValue = clueKind === 'color' ? cards[0].color : Number(cards[0].value);
    }

    function turnCopy() {
        if (state.status === 'ended') return `${endLabel()} · ${state.scoreRating || ''}`;
        const final = state.finalTurnsRemaining !== null && state.finalTurnsRemaining !== undefined
            ? ` · 最终轮剩 ${state.finalTurnsRemaining} 次行动`
            : '';
        if (state.currentTurn === state.myId) return `你的回合 · 选择一项行动${final}`;
        return `${state.currentTurnName || '队友'}正在行动${final}`;
    }

    function render() {
        if (!state) return;
        const app = mount.querySelector('.hb-app');
        app.dataset.status = state.status || 'waiting';
        app.classList.toggle('is-my-turn', state.currentTurn === state.myId && state.status === 'playing');
        app.classList.toggle('is-ended', state.status === 'ended');

        $('turn').innerHTML = `<span class="hb-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(turnCopy())}`;
        $('headerScore').textContent = state.score || 0;
        $('score').textContent = state.score || 0;
        renderFireworks();
        renderResources();
        renderTeammates();
        renderHand();
        renderCommand();
        renderPlayers();
        renderDiscard();
        renderLog();
    }

    function renderFireworks() {
        $('fireworks').innerHTML = COLORS.map(color => {
            const level = Number(state.fireworks?.[color]) || 0;
            const sequence = VALUES.map(value => `<i class="${value <= level ? 'is-complete' : ''} ${value === level && level > 0 ? 'is-current' : ''}"><span>${value}</span></i>`).join('');
            return `<article class="hb-firework tone-${color} level-${level}" data-firework-color="${color}">
                <header><span class="hb-color-mark"></span><strong>${LABELS[color]}色</strong><small>${level} / 5</small></header>
                <div class="hb-firework-burst" aria-hidden="true"><i></i><b>${level || '·'}</b></div>
                <footer>${sequence}</footer>
            </article>`;
        }).join('');
    }

    function renderResources() {
        const clues = Math.max(0, Number(state.clues) || 0);
        const strikes = Math.max(0, Number(state.strikes) || 0);
        const finalTurns = state.finalTurnsRemaining;
        $('resources').innerHTML = `<div class="hb-resource hb-clue-resource" data-event-target="clues">
            <span><small>可用提示</small><strong>提示令牌</strong></span>
            <div aria-label="${clues} / 8 枚提示">${Array.from({ length: 8 }, (_, index) => `<i class="${index < clues ? 'is-filled' : ''}"></i>`).join('')}</div>
            <b>${clues}<small>/ 8</small></b>
        </div>
        <div class="hb-resource hb-fuse-resource" data-event-target="fuses">
            <span><small>失误次数</small><strong>引信</strong></span>
            <div aria-label="${strikes} / ${state.maxStrikes || 3} 次失误">${Array.from({ length: state.maxStrikes || 3 }, (_, index) => `<i class="${index < strikes ? 'is-filled' : ''}"></i>`).join('')}</div>
            <b>${strikes}<small>/ ${state.maxStrikes || 3}</small></b>
        </div>
        <div class="hb-resource hb-deck-resource" data-event-target="deck">
            <span><small>剩余牌库</small><strong>${finalTurns !== null && finalTurns !== undefined ? '最终轮' : '牌库'}</strong></span>
            <div class="hb-deck-stack" aria-hidden="true"><i></i><i></i><i></i></div>
            <b>${finalTurns !== null && finalTurns !== undefined ? finalTurns : state.deckCount || 0}<small>${finalTurns !== null && finalTurns !== undefined ? '次行动' : '张'}</small></b>
        </div>`;
    }

    function renderTeammates() {
        const teammates = (state.players || []).filter(player => player.id !== state.myId);
        const canTarget = Boolean(state.availableActions?.canGiveClue && state.status === 'playing');
        $('teammateHint').textContent = canTarget ? '点击一位队友准备提示' : '队友牌面始终公开';
        $('teammates').innerHTML = teammates.length ? teammates.map((player, index) => {
            const selected = player.id === targetId;
            const actionable = canTarget && player.isOnline !== false;
            const tag = actionable ? 'button' : 'article';
            const cards = (player.hand || []).map((card, cardIndex) => {
                const matched = selected && cardMatchesClue(card);
                return `<span class="hb-teammate-card-wrap" data-card-id="${escapeHtml(card.id)}"><span class="hb-card-position">${cardIndex + 1}</span>${publicCardMarkup(card, { matched, dimmed: selected && !matched })}</span>`;
            }).join('');
            return `<${tag} class="hb-teammate ${selected ? 'is-target' : ''} ${player.isCurrentTurn ? 'is-current' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}" ${actionable ? `type="button" data-target-id="${escapeHtml(player.id)}" aria-pressed="${selected}"` : ''}>
                <span class="hb-teammate-header"><span class="hb-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span><strong>${escapeHtml(player.name)}</strong><small>${player.isOnline === false ? '已离线' : player.isCurrentTurn ? '正在行动' : selected ? '当前提示对象' : `${player.handCount || player.hand?.length || 0} 张公开牌`}</small></span><em>${String(index + 1).padStart(2, '0')}</em></span>
                <span class="hb-visible-cards">${cards}</span>
            </${tag}>`;
        }).join('') : '<div class="hb-empty">等待队友加入</div>';
    }

    function ownKnowledge(card) {
        const hints = card?.hints || {};
        const knownColors = (hints.colors || []).filter(color => COLORS.includes(color));
        const excludedColors = (hints.notColors || []).filter(color => COLORS.includes(color));
        const knownValues = (hints.values || []).map(Number).filter(value => VALUES.includes(value));
        const excludedValues = (hints.notValues || []).map(Number).filter(value => VALUES.includes(value));
        const possibleColors = knownColors.length ? knownColors : COLORS.filter(color => !excludedColors.includes(color));
        const possibleValues = knownValues.length ? knownValues : VALUES.filter(value => !excludedValues.includes(value));
        return {
            knownColor: knownColors[0] || null,
            knownValue: knownValues[0] || null,
            colorText: knownColors.length
                ? `已知 ${knownColors.map(color => `${LABELS[color]}色`).join('、')}`
                : excludedColors.length
                    ? `可能 ${possibleColors.map(color => LABELS[color]).join('、')}`
                    : '颜色未知',
            valueText: knownValues.length
                ? `已知数字 ${knownValues.join('、')}`
                : excludedValues.length
                    ? `可能数字 ${possibleValues.join('、')}`
                    : '数字未知',
            exclusionText: [
                excludedColors.length ? `排除 ${excludedColors.map(color => LABELS[color]).join('、')}` : '',
                excludedValues.length ? `排除 ${excludedValues.join('、')}` : '',
            ].filter(Boolean).join(' · '),
            hasKnowledge: Boolean(knownColors.length || excludedColors.length || knownValues.length || excludedValues.length),
        };
    }

    function renderHand() {
        const canPlay = Boolean(state.availableActions?.canPlay);
        const canDiscard = Boolean(state.availableActions?.canDiscard);
        const cards = state.myHand || [];
        let selectedIndex = cards.findIndex(card => card.id === pendingCardId);
        if (selectedIndex < 0) {
            pendingCardId = null;
            selectedIndex = -1;
        }
    $('handHint').textContent = state.status === 'ended'
        ? '演出已经结束'
        : submittingCardAction
            ? '正在提交本回合行动'
            : canPlay
                ? selectedIndex >= 0
                    ? `已选择第 ${selectedIndex + 1} 张牌`
                    : '你的回合 · 先选择一张牌'
                : '牌面不会向自己公开';
        $('hand').innerHTML = cards.length ? cards.map((card, index) => {
            const knowledge = ownKnowledge(card);
            const tone = knowledge.knownColor ? `tone-${knowledge.knownColor}` : '';
            const selected = card.id === pendingCardId;
            return `<button class="hb-hidden-card ${tone} ${knowledge.hasKnowledge ? 'has-knowledge' : ''} ${selected ? 'is-selected' : ''}" data-hand-card-id="${escapeHtml(card.id)}" type="button" aria-pressed="${selected}" ${canPlay && !submittingCardAction ? '' : 'disabled'}>
                <div class="hb-card-back">
                    <span class="hb-own-position">${String(index + 1).padStart(2, '0')}</span>
                    <span class="hb-back-pattern" aria-hidden="true"></span>
                    <strong>${knowledge.knownValue || '?'}</strong>
                    <div class="hb-knowledge"><span>${escapeHtml(knowledge.colorText)}</span><b>${escapeHtml(knowledge.valueText)}</b>${knowledge.exclusionText ? `<small>${escapeHtml(knowledge.exclusionText)}</small>` : ''}</div>
                </div>
                <span class="hb-card-select-copy">${selected ? '已选择' : canPlay ? '点击选择' : `第 ${index + 1} 张`}</span>
            </button>`;
        }).join('') : '<div class="hb-empty-hand"><span>0</span><strong>没有剩余手牌</strong></div>';
        const actionBar = $('handActions');
        actionBar.classList.toggle('is-hidden', !canPlay);
        if (!canPlay) {
            actionBar.innerHTML = '';
        } else if (selectedIndex < 0) {
            actionBar.innerHTML = '<span class="hb-action-step">1</span><div><strong>选择一张牌</strong><small>牌面仍然隐藏，请依据收到的提示判断</small></div>';
        } else {
            const selectedKnowledge = ownKnowledge(cards[selectedIndex]);
            actionBar.innerHTML = `<span class="hb-action-step">2</span><div><strong>确认第 ${selectedIndex + 1} 张牌的行动</strong><small>${escapeHtml(selectedKnowledge.colorText)} · ${escapeHtml(selectedKnowledge.valueText)} · 公开后不可撤回</small></div><div class="hb-selected-actions"><button class="hb-play-button" data-card-action="play" data-index="${selectedIndex}" type="button" ${submittingCardAction ? 'disabled' : ''}>${submittingCardAction === 'play' ? '正在打出' : '确认打出'}</button><button class="hb-discard-button" data-card-action="discard" data-index="${selectedIndex}" type="button" ${canDiscard && !submittingCardAction ? '' : 'disabled'}>${submittingCardAction === 'discard' ? '正在弃置' : '确认弃置'}</button></div>`;
        }
    }

    function renderCommand() {
        const command = $('command');
        if (state.status === 'ended') {
            command.className = 'hb-command-panel is-ended';
            command.innerHTML = `<header><small>最终结果</small><h2>演出结束</h2></header><div class="hb-result-score"><strong>${state.score || 0}</strong><span>/ 25</span></div><p>${escapeHtml(endLabel())}</p><b>${escapeHtml(state.scoreRating || '')}</b>`;
            return;
        }
        if (!state.availableActions?.canAct) {
            command.className = 'hb-command-panel is-waiting';
            const last = state.lastAction?.message || (state.actionLog || []).at(-1) || '等待第一位玩家行动';
            command.innerHTML = `<header><small>当前行动</small><h2>等待队友</h2></header><div class="hb-waiting-player"><span>${escapeHtml((state.currentTurnName || '队').slice(0, 1))}</span><div><strong>${escapeHtml(state.currentTurnName || '队友')}</strong><small>正在决定本回合行动</small></div></div><div class="hb-last-action"><small>上一行动</small><p>${escapeHtml(last)}</p></div>`;
            return;
        }

        const target = currentTarget();
        command.className = 'hb-command-panel is-active';
        if (!target) {
            command.innerHTML = `<header><small>轮到你</small><h2>选择行动</h2></header><div class="hb-action-options"><div><span class="is-clue">${state.clues || 0}</span><strong>给提示</strong><small>${state.clues > 0 ? '在队友牌区选择一名队友' : '提示令牌已经耗尽'}</small></div><div><span class="is-play">1</span><strong>打出手牌</strong><small>先在手牌区选择，再确认打出</small></div><div class="${state.availableActions?.canDiscard ? '' : 'is-disabled'}"><span class="is-discard">+</span><strong>弃置手牌</strong><small>${state.availableActions?.canDiscard ? '恢复一枚提示令牌' : '提示令牌已满'}</small></div></div>`;
            return;
        }

        normalizeClueValue();
        const matches = (target.hand || []).filter(card => cardMatchesClue(card));
        const colorChoices = COLORS.map(color => {
            const count = (target.hand || []).filter(card => !card.hidden && card.color === color).length;
            return `<button type="button" class="hb-clue-choice hb-color-choice tone-${color} ${clueKind === 'color' && clueValue === color ? 'is-selected' : ''}" data-clue-value="${color}" ${count ? '' : 'disabled'}><i></i><span>${LABELS[color]}</span><small>${count || '—'}</small></button>`;
        }).join('');
        const valueChoices = VALUES.map(value => {
            const count = (target.hand || []).filter(card => !card.hidden && Number(card.value) === value).length;
            return `<button type="button" class="hb-clue-choice hb-value-choice ${clueKind === 'value' && Number(clueValue) === value ? 'is-selected' : ''}" data-clue-value="${value}" ${count ? '' : 'disabled'}><strong>${value}</strong><small>${count || '—'}</small></button>`;
        }).join('');
        const matchPositions = (target.hand || []).map((card, index) => cardMatchesClue(card) ? index + 1 : null).filter(Boolean);
        command.innerHTML = `<header class="hb-command-heading"><div><small>发送提示</small><h2>提示 ${escapeHtml(target.name)}</h2></div><button data-action="clearTarget" type="button" title="取消提示对象" aria-label="取消提示对象">×</button></header>
            <div class="hb-clue-modes" role="group" aria-label="提示类型"><button type="button" data-clue-kind="color" class="${clueKind === 'color' ? 'is-selected' : ''}">颜色</button><button type="button" data-clue-kind="value" class="${clueKind === 'value' ? 'is-selected' : ''}">数字</button></div>
            <div class="hb-clue-choices">${clueKind === 'color' ? colorChoices : valueChoices}</div>
            <div class="hb-clue-preview"><span>${matches.length}</span><div><strong>命中 ${matches.length} 张牌</strong><small>第 ${matchPositions.join('、')} 张会被完整指出</small></div></div>
            <button class="hb-primary" data-action="clue" type="button" ${state.clues > 0 && matches.length ? '' : 'disabled'}>发送提示 <span>−1</span></button>`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map((player, index) => `<article class="hb-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}">
            <span class="hb-player-order">${String(index + 1).padStart(2, '0')}</span><span class="hb-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${player.isOnline === false ? '离线' : player.isCurrentTurn ? '当前行动' : `${player.handCount || 0} 张牌`}</small></span><i></i>
        </article>`).join('');
    }

    function renderDiscard() {
        const cards = state.discard || [];
        $('discardCount').textContent = `${cards.length} 张`;
        $('discard').innerHTML = COLORS.map(color => {
            const valueCells = VALUES.map(value => {
                const count = cards.filter(card => card.color === color && Number(card.value) === value).length;
                const exhausted = count >= COPIES[value];
                return `<span class="${count ? 'has-cards' : ''} ${exhausted ? 'is-exhausted' : ''}" title="${LABELS[color]}色 ${value}：弃置 ${count} / ${COPIES[value]} 张"><b>${value}</b><small>${count}/${COPIES[value]}</small></span>`;
            }).join('');
            return `<div class="hb-discard-row tone-${color}"><strong><i></i>${LABELS[color]}</strong><div>${valueCells}</div></div>`;
        }).join('');
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('')
            : '<p>演出开始后，行动记录会显示在这里。</p>';
    }

    function presentationDelay(duration, token) {
        const wait = reducedMotion?.matches ? Math.min(180, duration * .2) : duration;
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

    function showPresentation(kind, html) {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `hb-presentation-layer is-active is-${kind}`;
        $('actionStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-match, .is-event-dim, .is-event-impact').forEach(element => {
            element.classList.remove('is-event-match', 'is-event-dim', 'is-event-impact');
        });
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'hb-presentation-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('actionStage').innerHTML = '';
    }

    function playerAnchor(playerId, preferCards = true) {
        const id = String(playerId ?? '');
        if (id === String(state?.myId) && preferCards) return mount.querySelector('.hb-my-hand');
        const candidates = [...mount.querySelectorAll('[data-player-id]')]
            .filter(element => element.dataset.playerId === id);
        if (preferCards) {
            const cardArea = candidates.find(element => element.classList.contains('hb-teammate'));
            if (cardArea) return cardArea;
        }
        return candidates.find(element => element.classList.contains('hb-player')) || candidates[0] || null;
    }

    function drawActionLine(fromElement, toElement, tone = 'clue') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const bend = Math.max(42, Math.min(150, Math.abs(x2 - x1) * .22 + Math.abs(y2 - y1) * .1));
        const direction = x2 >= x1 ? 1 : -1;
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', `is-visible tone-${tone}`);
    }

    function highlightClueCards(action) {
        const matchedIds = new Set((action.matchedCardIds || []).map(String));
        const target = action.targetId === state?.myId
            ? mount.querySelector('.hb-my-hand')
            : playerAnchor(action.targetId, true);
        if (!target) return;
        target.querySelectorAll('[data-card-id], [data-hand-card-id]').forEach(element => {
            const cardId = String(element.dataset.cardId || element.dataset.handCardId || '');
            element.classList.add(matchedIds.has(cardId) ? 'is-event-match' : 'is-event-dim');
        });
    }

    function markImpact(element) {
        if (element) element.classList.add('is-event-impact');
    }

    async function playCluePresentation(action, token) {
        const clueText = action.clueKind === 'color'
            ? `${LABELS[action.value] || action.value}色`
            : `数字 ${action.value}`;
        const positions = (action.matchedIndexes || []).map(index => Number(index) + 1).join('、');
        showPresentation('clue', `<div class="hb-clue-event">
            <span class="hb-event-kicker">${escapeHtml(action.playerName)}传来提示</span>
            <div class="hb-clue-token ${action.clueKind === 'color' ? `tone-${escapeHtml(action.value)}` : 'tone-value'}"><i></i><strong>${escapeHtml(clueText)}</strong></div>
            <h2>${escapeHtml(action.targetName)}，记住这些牌</h2>
            <p>命中 ${action.matchedCardIds?.length || 0} 张${positions ? ` · 第 ${escapeHtml(positions)} 张` : ''}</p>
        </div>`);
        const tokenElement = $('actionStage').querySelector('.hb-clue-token');
        drawActionLine(playerAnchor(action.playerId), tokenElement, 'clue');
        if (!await presentationDelay(280, token)) return;
        $('presentationLayer').classList.add('is-transmitting');
        highlightClueCards(action);
        drawActionLine(tokenElement, playerAnchor(action.targetId), action.clueKind === 'color' ? action.value : 'value');
        if (!await presentationDelay(1050, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(320, token);
    }

    function stageCardMarkup(action) {
        return `<div class="hb-stage-card-motion">
            <div class="hb-stage-card-flip">
                <div class="hb-stage-card-side is-back">${publicCardMarkup({ hidden: true }, { kind: 'stage' })}</div>
                <div class="hb-stage-card-side is-front">${publicCardMarkup({ color: action.color, value: Number(action.value) }, { kind: 'stage' })}</div>
            </div>
        </div>`;
    }

    function setCardOrigin(source, cardElement) {
        if (!source || !cardElement) return;
        const sourceRect = source.getBoundingClientRect();
        const cardRect = cardElement.getBoundingClientRect();
        cardElement.style.setProperty('--hb-from-x', `${sourceRect.left + sourceRect.width / 2 - (cardRect.left + cardRect.width / 2)}px`);
        cardElement.style.setProperty('--hb-from-y', `${sourceRect.top + sourceRect.height / 2 - (cardRect.top + cardRect.height / 2)}px`);
    }

    function setCardDestination(destination, cardElement) {
        if (!destination || !cardElement) return;
        const destinationRect = destination.getBoundingClientRect();
        const cardRect = cardElement.getBoundingClientRect();
        cardElement.style.setProperty('--hb-to-x', `${destinationRect.left + destinationRect.width / 2 - (cardRect.left + cardRect.width / 2)}px`);
        cardElement.style.setProperty('--hb-to-y', `${destinationRect.top + destinationRect.height / 2 - (cardRect.top + cardRect.height / 2)}px`);
    }

    async function playCardPresentation(action, token) {
        const isDiscard = action.kind === 'discardCard';
        const resultKind = isDiscard ? 'discard' : action.success ? 'success' : 'misfire';
        const resultTitle = isDiscard
            ? '公开弃置'
            : action.success
                ? `${LABELS[action.color]}色烟花接续成功`
                : `未能接续 · 需要 ${action.expected}`;
        const resultCopy = isDiscard
            ? `提示令牌 ${action.cluesBefore} → ${action.cluesAfter}`
            : action.success
                ? `${action.scoreBefore} → ${action.scoreAfter} 分${action.clueReward ? ' · 完成 5，返还提示' : ''}`
                : `引信 ${action.strikesBefore} → ${action.strikesAfter} / 3`;
        showPresentation(isDiscard ? 'discard' : 'play', `<div class="hb-card-event">
            <span class="hb-event-kicker">${escapeHtml(action.playerName)}${isDiscard ? '弃置手牌' : '打出未知牌'}</span>
            ${stageCardMarkup(action)}
            <div class="hb-card-event-result"><strong>${escapeHtml(resultTitle)}</strong><small>${escapeHtml(resultCopy)}</small></div>
        </div>`);
        const cardElement = $('actionStage').querySelector('.hb-stage-card-motion');
        const source = playerAnchor(action.playerId);
        setCardOrigin(source, cardElement);
        drawActionLine(source, cardElement, isDiscard ? 'discard' : 'play');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(430, token)) return;
        $('presentationLayer').classList.add('is-revealed');
        if (!await presentationDelay(620, token)) return;

        let destination = null;
        if (isDiscard) destination = mount.querySelector('.hb-discard-panel');
        else if (action.success) destination = mount.querySelector(`[data-firework-color="${action.color}"]`);
        else destination = mount.querySelector('[data-event-target="fuses"]');
        setCardDestination(destination, cardElement);
        $('presentationLayer').classList.add('is-resolved', `is-${resultKind}`);
        drawActionLine(cardElement, destination, resultKind);
        markImpact(destination);
        if (action.clueReward || isDiscard) markImpact(mount.querySelector('[data-event-target="clues"]'));
        if (!await presentationDelay(780, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(300, token);
    }

    async function playFinalRoundCue(action, token) {
        showPresentation('final-round', `<div class="hb-final-round-cue">
            <span class="hb-final-deck" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="hb-event-kicker">牌库最后一张已经抽出</span>
            <h2>终幕开始</h2>
            <p>每位玩家还剩最后一次行动 · 共 ${Number(action.finalTurnsRemaining) || 0} 次</p>
        </div>`);
        markImpact(mount.querySelector('[data-event-target="deck"]'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(1450, token);
    }

    function finaleFireworks(snapshot) {
        return COLORS.map(color => `<span class="tone-${color}"><i></i><b>${Number(snapshot.fireworks?.[color]) || 0}</b></span>`).join('');
    }

    async function playFinale(snapshot, token) {
        const reason = snapshot.endReason;
        if (!['perfect', 'fuses', 'deck'].includes(reason)) return;
        const perfectScore = Number(snapshot.score) === 25;
        const title = reason === 'perfect' || perfectScore ? '完美演出' : reason === 'fuses' ? '演出中止' : '烟花落幕';
        const kicker = reason === 'perfect' ? '五色烟花全部完成' : reason === 'fuses' ? '第三根引信已经熄灭' : '最终轮已经结束';
        showPresentation(`finale finale-${reason}`, `<div class="hb-finale-scene">
            <span class="hb-event-kicker">${escapeHtml(kicker)}</span>
            <div class="hb-finale-fireworks">${finaleFireworks(snapshot)}</div>
            <h2>${escapeHtml(title)}</h2>
            <div class="hb-finale-score"><strong>${Number(snapshot.score) || 0}</strong><span>/ 25</span></div>
            <p>${escapeHtml(snapshot.scoreRating || END_LABELS[reason] || '')}</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2300, token);
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.hb-app')?.classList.add('is-action-presenting');
        while (presentationQueue.length) {
            const item = presentationQueue.shift();
            const token = ++presentationToken;
            if (item.action?.kind === 'giveClue') await playCluePresentation(item.action, token);
            if (['playCard', 'discardCard'].includes(item.action?.kind)) await playCardPresentation(item.action, token);
            if (token !== presentationToken) continue;
            if (item.action?.finalTurnsStarted && !item.action?.ended) await playFinalRoundCue(item.action, token);
            if (token !== presentationToken) continue;
            if (item.action?.ended || item.finaleOnly) await playFinale(item.snapshot, token);
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.hb-app')?.classList.remove('is-action-presenting');
    }

    function enqueuePresentation(item) {
        presentationQueue.push(item);
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
        mount.querySelector('.hb-app')?.classList.remove('is-action-presenting');
    }

    function openRules(trigger) {
        rulesTrigger = trigger || null;
        $('rules').classList.remove('is-hidden');
        mount.querySelector('[data-ui="closeRules"]')?.focus();
    }

    function closeRules() {
        $('rules').classList.add('is-hidden');
        rulesTrigger?.focus?.();
        rulesTrigger = null;
    }

    function handleClick(event) {
        if (presentationPlaying) {
            if (event.target.closest('[data-action="skipPresentation"]')) stopPresentation();
            return;
        }
        const target = event.target.closest('[data-target-id]');
        if (target && !target.disabled) {
            targetId = target.dataset.targetId;
            normalizeClueValue();
            renderTeammates();
            renderCommand();
            return;
        }

        const clueKindButton = event.target.closest('[data-clue-kind]');
        if (clueKindButton) {
            clueKind = clueKindButton.dataset.clueKind;
            const targetPlayer = currentTarget();
            const firstCard = targetPlayer?.hand?.find(card => !card.hidden);
            clueValue = clueKind === 'color' ? firstCard?.color || 'red' : Number(firstCard?.value) || 1;
            renderTeammates();
            renderCommand();
            return;
        }

        const clueValueButton = event.target.closest('[data-clue-value]');
        if (clueValueButton && !clueValueButton.disabled) {
            clueValue = clueKind === 'value' ? Number(clueValueButton.dataset.clueValue) : clueValueButton.dataset.clueValue;
            renderTeammates();
            renderCommand();
            return;
        }

        const handCard = event.target.closest('[data-hand-card-id]');
        if (handCard && !handCard.disabled) {
            pendingCardId = handCard.dataset.handCardId;
            submittingCardAction = null;
            renderHand();
            return;
        }

        const cardAction = event.target.closest('[data-card-action]');
        if (cardAction && !cardAction.disabled) {
            submittingCardAction = cardAction.dataset.cardAction;
            renderHand();
            send({
                type: 'gameAction',
                action: {
                    kind: cardAction.dataset.cardAction === 'play' ? 'playCard' : 'discardCard',
                    cardIndex: Number(cardAction.dataset.index),
                },
            });
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            if (actionButton.dataset.action === 'clearTarget') {
                targetId = null;
                renderTeammates();
                renderCommand();
            }
            if (actionButton.dataset.action === 'clue' && targetId && !actionButton.disabled) {
                send({
                    type: 'gameAction',
                    action: {
                        kind: 'giveClue',
                        targetId,
                        clueKind,
                        value: clueKind === 'value' ? Number(clueValue) : clueValue,
                    },
                });
            }
            return;
        }

        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;
        if (ui === 'leave') leaveRoom?.();
        if (ui === 'rules') openRules(uiButton);
        if (ui === 'closeRules' || event.target === $('rules')) closeRules();
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && presentationPlaying) return stopPresentation();
        if (event.key === 'Escape' && !$('rules').classList.contains('is-hidden')) closeRules();
    }

    function handleMessage(message) {
        if (message.state) {
            const previousState = state;
            const firstState = !previousState;
            state = message.state;
            if (!currentTarget() || !state.availableActions?.canGiveClue) targetId = null;
            if (!state.availableActions?.canPlay || !(state.myHand || []).some(card => card.id === pendingCardId)) {
                pendingCardId = null;
                submittingCardAction = null;
            }
            normalizeClueValue();
            render();
            const actionId = Number(state.lastAction?.actionId) || 0;
            if (firstState) {
                lastPresentedActionId = actionId;
            } else if (actionId > lastPresentedActionId) {
                lastPresentedActionId = actionId;
                enqueuePresentation({
                    action: JSON.parse(JSON.stringify(state.lastAction)),
                    snapshot: JSON.parse(JSON.stringify(state)),
                });
            } else if (previousState.status === 'playing' && state.status === 'ended' && ['perfect', 'fuses', 'deck'].includes(state.endReason)) {
                enqueuePresentation({ finaleOnly: true, snapshot: JSON.parse(JSON.stringify(state)) });
            }
        }
        if (message.type === 'error') {
            submittingCardAction = null;
            if (state) renderHand();
            addLog(message.message || '操作失败', 'error');
        }
    }

    mount.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'hanabi',
        handleMessage,
        destroy() {
            stopPresentation();
            mount.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            document.body.classList.remove('is-hanabi-view');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
