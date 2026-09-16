import { COLORS, COPIES, LABELS, VALUES } from './constants.js';
import { esc, publicCardMarkup } from './cards.js';
import { cardMatchesClue, currentTarget, endLabel, ownKnowledge, turnCopy } from './state.js';

/** Dynamic board, private-hand and command rendering for 花火. */
export function createHanabiRenderer({ mount, model, scene, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));

    function render() {
        const state = model.state;
        if (!state) return;
        const app = mount.querySelector('.hb-app');
        const sceneState = scene.getViewState();
        const presentationLocked = Boolean(sceneState.presentationPlaying || sceneState.presentationQueue?.length || Date.now() < Number(sceneState.presentationLockedUntil || 0));
        app.dataset.status = state.status || 'waiting';
        app.classList.toggle('is-my-turn', state.currentTurn === state.myId && state.status === 'playing');
        app.classList.toggle('is-ended', state.status === 'ended');
        app.classList.toggle('is-action-presenting', presentationLocked);
        app.setAttribute('aria-busy', String(presentationLocked));
        $('turn').innerHTML = `<span class="hb-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${esc(turnCopy(state))}`;
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
        const state = model.state;
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
        const state = model.state;
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
        const state = model.state;
        const target = currentTarget(state, model.targetId);
        const presentationLocked = scene.getViewState().presentationPlaying || scene.getViewState().presentationQueue?.length || Date.now() < Number(scene.getViewState().presentationLockedUntil || 0);
        mount.querySelector('.hb-app')?.classList.toggle('is-clue-targeting', Boolean(target && state.availableActions?.canGiveClue && !presentationLocked));
        const teammates = (state.players || []).filter(player => player.id !== state.myId);
        const canTarget = Boolean(state.availableActions?.canGiveClue && state.status === 'playing' && !model.submittingClue && !presentationLocked);
        $('teammateHint').textContent = model.submittingClue ? '正在发送提示' : canTarget ? '点击一位队友准备提示' : '队友牌面始终公开';
        $('teammates').innerHTML = teammates.length ? teammates.map((player, index) => {
            const selected = player.id === model.targetId;
            const actionable = canTarget && player.isOnline !== false;
            const tag = actionable ? 'button' : 'article';
            const cards = (player.hand || []).map((card, cardIndex) => {
                const matched = selected && cardMatchesClue(model.clueKind, model.clueValue, card);
                return `<span class="hb-teammate-card-wrap" data-card-id="${esc(card.id)}"><span class="hb-card-position">${cardIndex + 1}</span>${publicCardMarkup(card, { matched, dimmed: selected && !matched })}</span>`;
            }).join('');
            return `<${tag} class="hb-teammate ${selected ? 'is-target' : ''} ${player.isCurrentTurn ? 'is-current' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${esc(player.id)}" ${actionable ? `type="button" data-target-id="${esc(player.id)}" aria-pressed="${selected}"` : ''}>
                <span class="hb-teammate-header"><span><strong>${esc(player.name)}</strong><small>${player.isOnline === false ? '已离线' : player.isCurrentTurn ? '正在行动' : selected ? '当前提示对象' : `${player.handCount || player.hand?.length || 0} 张公开牌`}</small></span><em>${String(index + 1).padStart(2, '0')}</em></span>
                <span class="hb-visible-cards">${cards}</span>
            </${tag}>`;
        }).join('') : '<div class="hb-empty">等待队友加入</div>';
    }

    function renderHand() {
        const state = model.state;
        const sceneState = scene.getViewState();
        const presentationLocked = Boolean(sceneState.presentationPlaying || sceneState.presentationQueue?.length || Date.now() < Number(sceneState.presentationLockedUntil || 0));
        const canPlay = Boolean(state.availableActions?.canPlay && !presentationLocked);
        const canDiscard = Boolean(state.availableActions?.canDiscard && !presentationLocked);
        const cards = state.myHand || [];
        let selectedIndex = cards.findIndex(card => card.id === model.pendingCardId);
        if (selectedIndex < 0) {
            model.pendingCardId = null;
            selectedIndex = -1;
        }
        $('handHint').textContent = state.status === 'ended'
            ? '演出已经结束'
            : presentationLocked
                ? '正在播报，行动将在播报结束后恢复'
            : model.submittingCardAction
                ? '正在提交本回合行动'
                : canPlay
                    ? selectedIndex >= 0
                        ? `已选择第 ${selectedIndex + 1} 张牌`
                        : '你的回合 · 先选择一张牌'
                    : '牌面不会向自己公开';
        $('hand').innerHTML = cards.length ? cards.map((card, index) => {
            const knowledge = ownKnowledge(card);
            const tone = knowledge.knownColor ? `tone-${knowledge.knownColor}` : '';
            const selected = card.id === model.pendingCardId;
            const selectable = canPlay && !model.submittingCardAction;
            return `<button class="hb-hidden-card ${tone} ${knowledge.hasKnowledge ? 'has-knowledge' : ''} ${selected ? 'is-selected' : ''}" data-hand-card-id="${esc(card.id)}" type="button" aria-pressed="${selected}" aria-disabled="${!selectable}" ${selectable ? '' : 'data-read-only="true"'}>
                <div class="hb-card-back">
                    <span class="hb-own-position">${String(index + 1).padStart(2, '0')}</span>
                    <span class="hb-back-pattern" aria-hidden="true"></span>
                    <strong>${knowledge.knownValue || '?'}</strong>
                    <div class="hb-knowledge"><span>${esc(knowledge.colorText)}</span><b>${esc(knowledge.valueText)}</b>${knowledge.exclusionText ? `<small>${esc(knowledge.exclusionText)}</small>` : ''}</div>
                </div>
                <span class="hb-card-select-copy">${selected ? '已选择' : canPlay ? '点击选择' : `第 ${index + 1} 张`}</span>
            </button>`;
        }).join('') : '<div class="hb-empty-hand"><span>0</span><strong>没有剩余手牌</strong></div>';
        const actionBar = $('handActions');
        actionBar.classList.toggle('is-hidden', !canPlay);
        if (!canPlay) actionBar.innerHTML = '';
        else if (selectedIndex < 0) actionBar.innerHTML = '<span class="hb-action-step">1</span><div><strong>选择一张牌</strong><small>牌面仍然隐藏，请依据收到的提示判断</small></div>';
        else {
            const selectedKnowledge = ownKnowledge(cards[selectedIndex]);
            actionBar.innerHTML = `<span class="hb-action-step">2</span><div><strong>确认第 ${selectedIndex + 1} 张牌的行动</strong><small>${esc(selectedKnowledge.colorText)} · ${esc(selectedKnowledge.valueText)} · 公开后不可撤回</small></div><div class="hb-selected-actions"><button class="hb-play-button" data-card-action="play" data-index="${selectedIndex}" type="button" ${model.submittingCardAction ? 'disabled' : ''}>${model.submittingCardAction === 'play' ? '正在打出' : '确认打出'}</button><button class="hb-discard-button" data-card-action="discard" data-index="${selectedIndex}" type="button" ${canDiscard && !model.submittingCardAction ? '' : 'disabled'}>${model.submittingCardAction === 'discard' ? '正在弃置' : '确认弃置'}</button></div>`;
        }
    }

    function renderCommand() {
        const state = model.state;
        const command = $('command');
        if (state.status === 'ended') {
            command.className = 'hb-command-panel is-ended';
            command.innerHTML = `<header><small>最终结果</small><h2>演出结束</h2></header><div class="hb-result-score"><strong>${state.score || 0}</strong><span>/ 25</span></div><p>${esc(endLabel(state))}</p><b>${esc(state.scoreRating || '')}</b>`;
            return;
        }
        const sceneState = scene.getViewState();
        const presentationLocked = Boolean(sceneState.presentationPlaying || sceneState.presentationQueue?.length || Date.now() < Number(sceneState.presentationLockedUntil || 0));
        if (presentationLocked) {
            command.className = 'hb-command-panel is-waiting';
            const last = state.lastAction?.message || (state.actionLog || []).at(-1) || '上一行动正在播报';
            command.innerHTML = `<header><small>公共播报</small><h2>正在演出</h2></header><div class="hb-last-action"><small>播报结束后继续行动</small><p>${esc(last)}</p></div>`;
            return;
        }
        if (!state.availableActions?.canAct) {
            command.className = 'hb-command-panel is-waiting';
            const last = state.lastAction?.message || (state.actionLog || []).at(-1) || '等待第一位玩家行动';
            command.innerHTML = `<header><small>当前行动</small><h2>等待队友</h2></header><div class="hb-waiting-player"><div><strong>${esc(state.currentTurnName || '队友')}</strong><small>正在决定本回合行动</small></div></div><div class="hb-last-action"><small>上一行动</small><p>${esc(last)}</p></div>`;
            return;
        }
        const target = currentTarget(state, model.targetId);
        command.className = 'hb-command-panel is-active';
        if (!target) {
            command.innerHTML = `<header><small>轮到你</small><h2>选择行动</h2></header><div class="hb-action-options"><div><span class="is-clue">${state.clues || 0}</span><strong>给提示</strong><small>${state.clues > 0 ? '在队友牌区选择一名队友' : '提示令牌已经耗尽'}</small></div><div><span class="is-play">1</span><strong>打出手牌</strong><small>先在手牌区选择，再确认打出</small></div><div class="${state.availableActions?.canDiscard ? '' : 'is-disabled'}"><span class="is-discard">+</span><strong>弃置手牌</strong><small>${state.availableActions?.canDiscard ? '恢复一枚提示令牌' : '提示令牌已满'}</small></div></div>`;
            return;
        }

        normalizeClueValue(model);
        const matches = (target.hand || []).filter(card => cardMatchesClue(model.clueKind, model.clueValue, card));
        const colorChoices = COLORS.map(color => {
            const count = (target.hand || []).filter(card => !card.hidden && card.color === color).length;
            return `<button type="button" class="hb-clue-choice hb-color-choice tone-${color} ${model.clueKind === 'color' && model.clueValue === color ? 'is-selected' : ''}" data-clue-value="${color}" ${count ? '' : 'disabled'}><i></i><span>${LABELS[color]}</span><small>${count || '—'}</small></button>`;
        }).join('');
        const valueChoices = VALUES.map(value => {
            const count = (target.hand || []).filter(card => !card.hidden && Number(card.value) === value).length;
            return `<button type="button" class="hb-clue-choice hb-value-choice ${model.clueKind === 'value' && Number(model.clueValue) === value ? 'is-selected' : ''}" data-clue-value="${value}" ${count ? '' : 'disabled'}><strong>${value}</strong><small>${count || '—'}</small></button>`;
        }).join('');
        const matchPositions = (target.hand || []).map((card, index) => cardMatchesClue(model.clueKind, model.clueValue, card) ? index + 1 : null).filter(Boolean);
        command.innerHTML = `<header class="hb-command-heading"><div><small>发送提示</small><h2>提示 ${esc(target.name)}</h2></div><button data-action="clearTarget" type="button" title="取消提示对象" aria-label="取消提示对象">×</button></header>
            <div class="hb-clue-modes" role="group" aria-label="提示类型"><button type="button" data-clue-kind="color" class="${model.clueKind === 'color' ? 'is-selected' : ''}">颜色</button><button type="button" data-clue-kind="value" class="${model.clueKind === 'value' ? 'is-selected' : ''}">数字</button></div>
            <div class="hb-clue-choices">${model.clueKind === 'color' ? colorChoices : valueChoices}</div>
            <div class="hb-clue-preview"><span>${matches.length}</span><div><strong>命中 ${matches.length} 张牌</strong><small>第 ${matchPositions.join('、')} 张会被完整指出</small></div></div>
            <button class="hb-primary" data-action="clue" type="button" ${state.clues > 0 && matches.length && !model.submittingClue ? '' : 'disabled'}>${model.submittingClue ? '正在发送' : '发送提示'} <span>−1</span></button>`;
    }

    function renderPlayers() {
        const state = model.state;
        $('players').innerHTML = (state.players || []).map((player, index) => `<article class="hb-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${esc(player.id)}">
            <span class="hb-player-order">${String(index + 1).padStart(2, '0')}</span><span><strong>${esc(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${player.isOnline === false ? '离线' : player.isCurrentTurn ? '当前行动' : `${player.handCount || 0} 张牌`}</small></span><i></i>
        </article>`).join('');
    }

    function renderDiscard() {
        const state = model.state;
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
        const entries = (model.state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${esc(entry)}</span></div>`).join('')
            : '<p>演出开始后，行动记录会显示在这里。</p>';
    }

    return Object.freeze({ render, renderHand, renderCommand, renderTeammates });
}
