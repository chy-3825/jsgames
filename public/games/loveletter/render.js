import { CARD_NAMES, NEEDS_TARGET } from './constants.js';
import { esc, renderCardBack, renderDiscardCard, renderPortrait, renderSceneCard, renderTinyCard } from './cards.js';
import {
    canPlaySelected,
    canTarget,
    favorCount,
    favorScore,
    favorTarget,
    getName,
    isOut,
    mustPlayCountessNow,
    needsTargetSelection,
    shortEffect,
    winnerNames,
} from './state.js';

/** Dynamic table rendering for 情书. */
export function createLoveLetterRenderer({ mount, model, scene, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));

    function render() {
        const state = model.state;
        if (!state) return;
        const sceneState = scene.getViewState();
        const players = state.players || [];
        const me = players.find(player => player.id === state.myId);
        const ended = state.status === 'ended';
        const roundEnded = state.status === 'round_end';
        const awaitingTarget = Boolean(state.phase === 'target_ack' && state.pendingAction);
        const myTurn = Boolean(state.myIsCurrentTurn && !isOut(me) && !ended && !roundEnded && !awaitingTarget);
        const gameWinners = winnerNames(state.winners, state.winner);
        root().classList.toggle('is-my-turn', myTurn);
        root().classList.toggle('is-round-ended', roundEnded || ended);
        root().classList.toggle('is-awaiting-target', awaitingTarget);
        root().classList.toggle('is-scene-active', sceneState.scenePlaying);

        $('turn').textContent = ended ? (gameWinners ? `${gameWinners} 获胜` : '本局结束') : roundEnded ? `第 ${state.round} 轮结算` : awaitingTarget ? `等待 ${state.pendingAction.targetName || getName(state, state.pendingAction.targetId)} 知晓` : myTurn ? '轮到你出牌' : `轮到 ${state.currentTurnName || '其他玩家'}`;
        $('phase').textContent = ended ? '整场结束' : roundEnded ? '本轮结束' : awaitingTarget ? `${state.pendingAction.playerName || getName(state, state.pendingAction.playerId)} 已经出牌` : myTurn ? '请选择一张手牌' : '等待对方行动';
        $('round').textContent = state.round ?? '-';
        $('deck').textContent = state.deckCount ?? 0;
        $('deckLarge').textContent = state.deckCount ?? 0;
        $('reserved').textContent = state.reservedCount ?? 0;
        const asideCount = state.setAsideCount ?? state.setAsideCards?.length ?? 0;
        $('aside').textContent = `${asideCount} 张`;
        $('asideStat').hidden = !asideCount;
        $('discardCount').textContent = `${state.publicDiscard?.length || 0} 张`;

        renderSeats(players, roundEnded || ended);
        renderEvent(roundEnded, ended);
        renderDiscards();
        renderCommand(me, myTurn, roundEnded, ended);
        renderGuessOverlay(myTurn);
        scene.scheduleActionPresentation();
    }

    function root() { return mount.querySelector('.ll-app'); }

    function renderSeats(players, revealHands) {
        const state = model.state;
        const opponents = players.filter(player => player.id !== state.myId);
        $('seats').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('seats').innerHTML = opponents.map(player => {
            const announced = state.pendingAction;
            const targetable = canTarget(state, model.selectedCardIndex, player);
            const selected = model.selectedTargetId === player.id;
            const visible = revealHands ? (player.finalHand || player.hand || [])[0] : null;
            const tag = targetable ? 'button' : 'article';
            const attrs = `data-player-id="${esc(player.id)}"${targetable ? ` data-target-id="${esc(player.id)}" type="button" aria-pressed="${selected}"` : ''}`;
            const isActionSource = announced?.playerId === player.id;
            const isActionTarget = announced?.targetId === player.id;
            const status = isOut(player) ? '已出局' : isActionTarget ? '等待知晓' : isActionSource ? '信件已发出' : player.isProtected ? '侍女保护' : player.isCurrentTurn ? '正在行动' : `${player.handCount ?? 0} 张手牌`;
            return `<${tag} class="ll-seat ${player.isCurrentTurn ? 'is-turn' : ''} ${player.isProtected ? 'is-protected' : ''} ${isOut(player) ? 'is-out' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isActionSource ? 'is-action-source' : ''} ${isActionTarget ? 'is-action-target' : ''}" ${attrs}>
                <span class="ll-avatar" aria-hidden="true">${esc(player.name?.slice(0, 1) || '客')}</span>
                <span class="ll-seat-copy"><strong>${esc(player.name)}</strong><small>${selected ? '已选择为目标' : status}</small><span class="ll-seat-score" aria-label="${favorCount(state, player.id)} / ${favorTarget(state)} 枚爱心筹码"><i aria-hidden="true">♥</i><b>${favorScore(state, favorCount(state, player.id))}</b></span></span>
                ${visible ? renderTinyCard(visible, 'll-seat-reveal') : renderCardBack('私密', 'll-hidden-card', '隐藏手牌')}
            </${tag}>`;
        }).join('') || '<span class="ll-empty">等待其他玩家入座</span>';
    }

    function renderEvent(roundEnded, ended) {
        const state = model.state;
        $('event').classList.remove('is-action-stage', 'is-awaiting');
        if (ended) {
            $('event').innerHTML = `<div class="ll-event-copy"><span>整场结果</span><strong>${esc(winnerNames(state.winners, state.winner) || '无人')} 获胜</strong><small>最终手牌和爱心筹码已经公开。</small></div>`;
            return;
        }
        if (roundEnded) {
            const winners = winnerNames(state.roundWinners, state.roundWinner);
            $('event').innerHTML = `<div class="ll-event-copy"><span>第 ${state.round} 轮结果</span><strong>${esc(winners || '无人')} 赢得爱心</strong><small>${state.endReason === 'showdown' ? '牌库耗尽，按手牌和公开弃牌结算。' : '其他玩家均已出局。'}</small></div>`;
            return;
        }
        const action = state.lastAction;
        if (!action) {
            $('event').innerHTML = '<div class="ll-event-copy"><span>最近行动</span><strong>等待第一封信</strong><small>出牌结果会保留到下一次行动。</small></div>';
            return;
        }
        $('event').classList.add('is-action-stage');
        $('event').classList.toggle('is-awaiting', Boolean(state.pendingAction));
        const privateCard = action.result?.revealedCard;
        const privateInsight = Boolean(privateCard && action.result?.privateFor === state.myId);
        const detail = action.result?.privateMessage || action.result?.message || (action.targetId ? `目标：${getName(state, action.targetId)}` : '行动完成');
        $('event').innerHTML = renderTableAction(action, detail, privateInsight ? privateCard : null);
    }

    function renderTableAction(action, detail, privateCard) {
        const state = model.state;
        const card = { id: action.cardId, value: action.cardId, name: action.cardName };
        const targetName = action.targetId ? getName(state, action.targetId) : '';
        const awaiting = Boolean(state.pendingAction?.actionId === action.actionId);
        const guess = Number(action.guess || 0);
        const side = guess
            ? `<aside class="ll-action-detail is-guess"><span>侍卫猜测</span><strong>${guess}</strong><small>${esc(CARD_NAMES[guess] || '未知角色')}</small></aside>`
            : targetName
                ? `<aside class="ll-action-detail"><span>信件送往</span><strong>${esc(targetName)}</strong><small>${awaiting ? '等待对方知晓' : '牌效已经结算'}</small></aside>`
                : `<aside class="ll-action-detail"><span>角色效果</span><strong>${esc(action.cardName || '公开行动')}</strong><small>${awaiting ? '等待知晓' : '已经生效'}</small></aside>`;
        const privateNote = privateCard ? `<div class="ll-action-private"><span>仅你可见</span><strong>${esc(targetName)}持有 ${esc(privateCard.name || CARD_NAMES[privateCard.id])}</strong></div>` : '';
        return `<div class="ll-table-action" data-action-id="${Number(action.actionId) || 0}">
            <div class="ll-action-route"><span>${esc(action.playerName || '玩家')}</span><i aria-hidden="true">→</i><strong>${esc(targetName || '宫廷')}</strong></div>
            <div class="ll-action-card-shell" data-role="playedCard" data-actor-id="${esc(action.playerId || '')}">${renderSceneCard(card)}</div>
            ${side}
            <div class="ll-action-caption"><strong>${esc(action.cardName || '一张牌')}</strong><small>${esc(detail)}</small></div>
            ${privateNote}
        </div>`;
    }

    function renderDiscards() {
        const state = model.state;
        const entries = state.publicDiscard || [];
        const owners = (state.players || []).filter(player => entries.some(entry => entry.ownerId === player.id));
        $('discards').innerHTML = owners.length ? owners.map(player => {
            const cards = entries.filter(entry => entry.ownerId === player.id);
            const total = cards.reduce((sum, entry) => sum + Number(entry.card?.value || entry.card?.id || 0), 0);
            return `<article class="ll-discard-owner"><header><strong>${esc(player.name)}</strong><span>合计 ${total}</span></header><div>${cards.map(entry => renderDiscardCard(entry)).join('')}</div></article>`;
        }).join('') : '<span class="ll-empty">还没有公开弃牌</span>';
    }

    function renderCommand(me, myTurn, roundEnded, ended) {
        const state = model.state;
        if (ended || roundEnded) {
            const winners = ended ? winnerNames(state.winners, state.winner) : winnerNames(state.roundWinners, state.roundWinner);
            const canStart = !ended && ((state.roundWinners || (state.roundWinner ? [state.roundWinner] : [])).some(player => player.id === state.myId) || state.hostId === state.myId);
            $('command').innerHTML = `<div class="ll-result-dock"><div><span>${ended ? '整场结束' : `第 ${state.round} 轮结束`}</span><strong>${esc(winners || '无人')}${ended ? '赢得情书' : '获得一枚爱心'}</strong></div><div class="ll-scoreboard">${(state.favorTokens || []).map(token => `<span><b>${esc(getName(state, token.id))}</b><strong class="ll-score-value"><i aria-hidden="true">♥</i>${favorScore(state, token.count)}</strong></span>`).join('')}</div>${ended ? '<span class="ll-result-note">使用上方“回到大厅”离开本局</span>' : `<button class="ll-primary" data-action="start-next-round" type="button" ${canStart && !state.pendingAction ? '' : 'disabled'}>${canStart ? '开始下一轮' : '等待胜者或房主'}</button>`}</div>`;
            return;
        }

        const hand = state.myHand || [];
        const selected = model.selectedCardIndex === null ? null : hand[model.selectedCardIndex];
        const mustCountess = mustPlayCountessNow(state);
        const selfIsSource = state.pendingAction?.playerId === state.myId;
        const selfIsTarget = state.pendingAction?.targetId === state.myId;
        $('command').innerHTML = `<div class="ll-command-shell">
            <div class="ll-self-summary ${selfIsSource ? 'is-action-source' : ''} ${selfIsTarget ? 'is-action-target' : ''}" data-player-id="${esc(state.myId)}"><span>${esc(me?.name || '我')}</span><strong class="ll-self-score" aria-label="${favorCount(state, state.myId)} / ${favorTarget(state)} 枚爱心筹码"><i aria-hidden="true">♥</i>${favorScore(state, favorCount(state, state.myId))}</strong></div>
            <div class="ll-hand" aria-label="你的手牌">${hand.map((card, index) => renderHandCard(card, index, myTurn, mustCountess)).join('') || '<span class="ll-empty">你暂时没有手牌</span>'}</div>
            <div class="ll-action-panel">${renderActionPanel(selected, myTurn, mustCountess, isOut(me))}</div>
        </div>`;
    }

    function renderHandCard(card, index, myTurn, mustCountess) {
        const selected = index === model.selectedCardIndex;
        const locked = mustCountess && card.id !== 7;
        return `<button class="ll-hand-card ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-card-index="${index}" data-card-id="${card.id}" type="button" aria-pressed="${selected}" ${myTurn && !locked && !model.pendingAction ? '' : 'disabled'}>
            <span class="ll-card-value">${card.value ?? card.id}</span>
            ${renderPortrait(card, 'll-card-portrait')}
            <span class="ll-card-copy"><strong>${esc(card.name || CARD_NAMES[card.id])}</strong><small>${esc(shortEffect(card.id))}</small></span>
        </button>`;
    }

    function renderActionPanel(card, myTurn, mustCountess, out) {
        const state = model.state;
        if (out) return '<div class="ll-waiting"><strong>你已出局</strong><span>公开弃牌仍可用于记牌。</span></div>';
        if (state.pendingAction) {
            const announced = state.pendingAction;
            const remaining = Math.max(0, Math.ceil((model.acknowledgementDeadline - Date.now()) / 1000));
            if (announced.targetId === state.myId) {
                const guessText = announced.cardId === 1 && announced.guess ? `对方猜测 ${announced.guess} · ${CARD_NAMES[announced.guess]}` : `${announced.playerName || getName(state, announced.playerId)} 对你使用了${announced.cardName}`;
                const readyIn = Math.max(0, model.acknowledgementReadyAt - Date.now());
                const ready = readyIn <= 0;
                return `<div class="ll-response-panel"><span>一封信指向了你</span><strong>${esc(guessText)}</strong><small>${ready ? '点击表示已经知晓；这不是拒绝牌效。' : '先看清中央牌面，随后即可确认。'}</small><button class="ll-primary" data-action="acknowledge-action" type="button" ${model.pendingAction || !ready ? 'disabled' : ''}>${model.pendingAction ? '正在回应' : ready ? '揭晓结果' : '信件送达中'}<b>${ready ? (remaining ? `${remaining}s` : '即将继续') : `${Math.max(1, Math.ceil(readyIn / 100) / 10)}s`}</b></button></div>`;
            }
            return `<div class="ll-waiting is-response-wait"><strong>等待 ${esc(announced.targetName || getName(state, announced.targetId))} 知晓</strong><span>${esc(announced.playerName || getName(state, announced.playerId))} 打出了${esc(announced.cardName)}，${remaining ? `${remaining} 秒后自动继续` : '即将自动继续'}。</span></div>`;
        }
        if (!myTurn) return `<div class="ll-waiting"><strong>等待 ${esc(state.currentTurnName || '其他玩家')}</strong><span>轮到你时会抽至两张手牌。</span></div>`;
        if (!card) return '<div class="ll-waiting"><strong>选择一张手牌</strong><span>牌面会显示角色效果与可选目标。</span></div>';

        const needsTarget = needsTargetSelection(state, card);
        const targetName = model.selectedTargetId ? getName(state, model.selectedTargetId) : '';
        const noTargetEffect = NEEDS_TARGET.has(card.id) && !needsTarget;
        const canPlay = canPlaySelected(state, model.selectedCardIndex, model.selectedTargetId, model.selectedGuess, mustCountess);
        return `<div class="ll-selected-action"><span>已选 ${card.value ?? card.id} · ${esc(card.name || CARD_NAMES[card.id])}</span><small>${esc(shortEffect(card.id))}</small></div>
            ${needsTarget ? `<div class="ll-target-line"><span>${targetName ? `目标：<b>${esc(targetName)}</b>` : '请选择上方高亮玩家'}</span>${card.id === 5 ? '<button data-action="self-target" type="button">指定自己</button>' : ''}</div>` : ''}
            ${noTargetEffect ? '<div class="ll-inline-note">其他玩家均受保护，此牌可以打出但不会生效。</div>' : ''}
            ${card.id === 1 && needsTarget ? `<button class="ll-guess-trigger" data-action="open-guess" type="button">${model.selectedGuess ? `猜测 ${model.selectedGuess} · ${CARD_NAMES[model.selectedGuess]}` : '选择猜测牌面'}</button>` : ''}
            ${mustCountess ? '<div class="ll-inline-note is-warning">同时持有王子或国王，只能打出伯爵夫人。</div>' : ''}
            <button class="ll-primary" data-action="play" type="button" ${canPlay && !model.pendingAction ? '' : 'disabled'}>${model.pendingAction ? '等待服务器确认' : '打出这张牌'}</button>`;
    }

    function renderGuessOverlay(myTurn) {
        const state = model.state;
        const card = model.selectedCardIndex === null ? null : state?.myHand?.[model.selectedCardIndex];
        const visible = Boolean(model.guessOpen && myTurn && card?.id === 1);
        $('guessOverlay').classList.toggle('is-hidden', !visible);
        $('guessOverlay').setAttribute('aria-hidden', String(!visible));
        if (!visible) return;
        $('guessPrompt').textContent = model.selectedTargetId ? `目标：${getName(state, model.selectedTargetId)}。猜中后对方立即出局。` : '不能猜侍卫。选好牌面后，再选择一名对手作为目标。';
        $('guessCards').innerHTML = [2, 3, 4, 5, 6, 7, 8].map(value => `<button class="ll-guess-option ${model.selectedGuess === value ? 'is-selected' : ''}" data-guess="${value}" type="button" aria-pressed="${model.selectedGuess === value}"><b>${value}</b>${renderPortrait({ id: value }, 'll-guess-portrait')}<span>${CARD_NAMES[value]}</span></button>`).join('');
        mount.querySelector('[data-action="confirm-guess"]').disabled = !model.selectedGuess;
    }

    return Object.freeze({ render, renderGuessOverlay });
}
