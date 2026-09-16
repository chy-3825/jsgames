import { CARD_NAMES, NEEDS_TARGET } from './constants.js';
import { esc, renderCardBack, renderDiscardCard, renderPortrait, renderSceneCard, renderTinyCard } from './cards.js';
import {
    canPlaySelected,
    canTarget,
    compactEffect,
    favorCount,
    favorScore,
    favorTarget,
    getName,
    isOut,
    mustPlayCountessNow,
    needsTargetSelection,
    shortEffect,
} from './state.js';

/** Dynamic table rendering for 情书. */
export function createLoveLetterRenderer({ mount, model, scene, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));

    function displayName(playerId, fallback = '玩家') {
        if (String(playerId) === String(model.state?.myId)) return '您';
        return (model.state?.players || []).find(player => String(player.id) === String(playerId))?.name || fallback;
    }

    function viewerText(text) {
        const state = model.state;
        const own = state?.players?.find(player => String(player.id) === String(state.myId))?.name;
        if (!own) return String(text || '');
        const others = (state.players || [])
            .filter(player => String(player.id) !== String(state.myId) && player.name)
            .sort((left, right) => right.name.length - left.name.length);
        let value = String(text || '');
        others.forEach((player, index) => { value = value.split(player.name).join(`\u0000${index}\u0000`); });
        value = value.split(own).join('您');
        others.forEach((player, index) => { value = value.split(`\u0000${index}\u0000`).join(player.name); });
        return value;
    }

    function displayWinners(list, fallback) {
        const winners = list?.length ? list : fallback ? [fallback] : [];
        return winners.map(player => String(player.id) === String(model.state?.myId) ? '您' : player.name).join('、');
    }

    function render() {
        const state = model.state;
        if (!state) return;
        const sceneState = scene.getViewState();
        const players = state.players || [];
        const me = players.find(player => player.id === state.myId);
        const ended = state.status === 'ended';
        root().classList.toggle('is-game-ended', ended);
        const roundEnded = state.status === 'round_end';
        const awaitingTarget = Boolean(state.phase === 'target_ack' && state.pendingAction);
        const myTurn = Boolean(state.myIsCurrentTurn && !isOut(me) && !ended && !roundEnded && !awaitingTarget);
        const initialState = Boolean(state.status === 'playing' && !state.pendingAction && !state.lastAction);
        const gameWinners = displayWinners(state.winners, state.winner);
        root().classList.toggle('is-my-turn', myTurn);
        root().classList.toggle('is-initial-state', initialState);
        root().classList.toggle('is-round-ended', roundEnded || ended);
        root().classList.toggle('is-awaiting-target', awaitingTarget);
        root().classList.toggle('is-scene-active', sceneState.scenePlaying);
        root().classList.toggle('has-recent-action', Boolean(state.pendingAction || state.lastAction));
        root().setAttribute('aria-busy', String(model.pendingAction));

        $('round').textContent = state.round ?? '-';
        $('deckLarge').textContent = state.deckCount ?? 0;
        $('reserved').textContent = state.reservedCount ?? 0;
        const asideCount = state.setAsideCount ?? state.setAsideCards?.length ?? 0;
        $('aside').textContent = `${asideCount} 张`;
        $('asideStat').hidden = !asideCount;
        const isTwoPlayer = players.length === 2;
        $('publicRemovedPile').hidden = !isTwoPlayer;

        renderStageHeading(me, myTurn, roundEnded, ended, awaitingTarget, gameWinners, initialState);
        renderSeats(players, roundEnded || ended);
        renderEvent(roundEnded, ended, myTurn);
        renderRecentActions();
        renderCommand(me, myTurn, roundEnded, ended);
        renderFinalOverlay(ended && !sceneState.scenePlaying);
        renderGuessOverlay(myTurn);
        scene.scheduleActionPresentation();
    }

    function root() { return mount.querySelector('.ll-app'); }

    function renderStageHeading(me, myTurn, roundEnded, ended, awaitingTarget, gameWinners, initialState) {
        const state = model.state;
        const action = state.pendingAction || state.lastAction;
        let kicker = '本轮';
        let title = '等待首次出牌';
        let hint = '';

        if (ended) {
            kicker = '整场结束';
            title = `${gameWinners || '本局胜者'}赢得整场游戏`;
        } else if (roundEnded) {
            const winners = displayWinners(state.roundWinners, state.roundWinner) || '本轮胜者';
            kicker = `第 ${state.round} 轮`;
            title = `${winners}获得一枚爱心`;
        } else if (awaitingTarget && state.pendingAction) {
            kicker = '等待确认';
            title = state.pendingAction.cardName || CARD_NAMES[state.pendingAction.cardId] || '人物牌';
        } else if (myTurn) {
            kicker = '您的回合';
            title = '选择一张牌';
        } else if (action) {
            kicker = '最近行动';
            title = action.cardName || CARD_NAMES[action.cardId] || '人物牌';
        } else {
            kicker = '等待';
            title = `${displayName(state.currentTurn, state.currentTurnName || '下一位玩家')}出牌`;
        }

        $('stageKicker').textContent = kicker;
        $('stageTitle').textContent = title;
        $('stageHint').textContent = hint;
        $('stageHeading').hidden = initialState || roundEnded || ended;
    }

    function renderSeats(players, revealHands) {
        const state = model.state;
        const opponents = players.filter(player => player.id !== state.myId);
        $('seats').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('seats').dataset.seatCount = String(opponents.length);
        $('seats').innerHTML = opponents.map((player, seatIndex) => {
            const announced = state.pendingAction || state.lastAction;
            const activeAction = state.pendingAction;
            const targetable = canTarget(state, model.selectedCardIndex, player);
            const selected = model.selectedTargetId === player.id;
            const seatReveal = [...(state.seatReveals || [])].reverse().find(action => String(action.targetId) === String(player.id));
            const effectCard = Number(seatReveal?.cardId) === 2
                ? seatReveal.result?.revealedCard
                : Number(seatReveal?.cardId) === 5 ? seatReveal.result?.discardedCard : null;
            const revealId = effectCard && seatReveal?.actionId ? String(seatReveal.actionId) : '';
            const animateReveal = Boolean(revealId && !model.presentedSeatRevealIds.has(revealId));
            if (animateReveal) model.presentedSeatRevealIds.add(revealId);
            const visible = effectCard || (revealHands ? ((player.finalHand || player.hand || [])[0] || (isOut(player) ? [...(state.publicDiscard || [])].reverse().find(entry => entry.ownerId === player.id)?.card : null)) : null);
            const tag = targetable ? 'button' : 'article';
            const targetLabel = `选择${player.name || '玩家'}作为目标`;
            const attrs = `data-player-id="${esc(player.id)}"${targetable ? ` data-target-id="${esc(player.id)}" type="button" aria-pressed="${selected}" aria-label="${esc(targetLabel)}"` : ''}`;
            const isActionSource = activeAction?.playerId === player.id;
            const isActionTarget = activeAction?.targetId === player.id;
            const pending = Boolean(activeAction?.actionId === announced?.actionId);
            const status = isOut(player) ? '已出局' : pending && isActionTarget ? '等待确认' : player.isProtected ? '侍女保护' : '';
            return `<${tag} class="ll-seat ${player.isCurrentTurn ? 'is-turn' : ''} ${player.isProtected ? 'is-protected' : ''} ${isOut(player) ? 'is-out' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isActionSource ? 'is-action-source' : ''} ${isActionTarget ? 'is-action-target' : ''}" ${attrs}>
                <span class="ll-seat-index" aria-hidden="true">玩家 ${seatIndex + 1}</span>
                <span class="ll-seat-copy"><span class="ll-seat-name"><strong>${esc(player.name)}</strong></span>${status ? `<small>${status}</small>` : ''}<span class="ll-seat-score" aria-label="${favorCount(state, player.id)} / ${favorTarget(state)} 枚爱心"><i aria-hidden="true">♥</i><b>${favorScore(state, favorCount(state, player.id))}</b></span></span>
                ${visible ? renderTinyCard(visible, `ll-seat-reveal${effectCard ? ' is-effect-reveal' : ''}${animateReveal ? ' is-new-effect-reveal' : ''}`) : renderCardBack('私密', 'll-hidden-card', '隐藏手牌')}
            </${tag}>`;
        }).join('') || '<span class="ll-empty">等待其他玩家加入</span>';
    }

    function renderEvent(roundEnded, ended, myTurn) {
        const state = model.state;
        const previewIndex = model.selectedCardIndex ?? model.hoveredCardIndex;
        const selected = previewIndex === null ? null : state.myHand?.[previewIndex];
        const locked = model.selectedCardIndex !== null;
        const action = state.lastAction;
        $('event').classList.remove('is-action-stage', 'is-awaiting', 'is-initial-stage', 'is-selection-preview', 'is-hover-preview');
        if (ended) {
            $('event').innerHTML = renderChapterState('游戏结束', '最终结算', 'll-game-result');
            return;
        }
        if (roundEnded) {
            const winners = displayWinners(state.roundWinners, state.roundWinner);
            $('event').innerHTML = renderRoundResult(state.round, winners || '无人');
            return;
        }
        if (myTurn && selected && !model.pendingAction) {
            $('event').classList.add('is-action-stage', 'is-selection-preview');
            $('event').classList.toggle('is-hover-preview', !locked);
            $('event').innerHTML = renderSelectedCard(selected, locked);
            return;
        }
        if (!action) {
            $('event').classList.add('is-action-stage', 'is-initial-stage');
            $('event').innerHTML = renderInitialAction(state.round);
            return;
        }
        $('event').classList.add('is-action-stage');
        $('event').classList.toggle('is-awaiting', Boolean(state.pendingAction));
        $('event').innerHTML = renderTableAction(action);
    }

    function renderSelectedCard(card, locked) {
        const state = model.state;
        const needsTarget = needsTargetSelection(state, card);
        const target = model.selectedTargetId ? displayName(model.selectedTargetId) : '';
        const noTargetEffect = NEEDS_TARGET.has(card.id) && !needsTarget;
        let next = locked ? '确认后出牌。' : '选择这张牌。';
        if (locked) {
            if (needsTarget && !target) next = card.id === 5 ? '选择一名玩家；王子也可以指定自己。' : '选择一名对手作为目标。';
            else if (card.id === 1 && needsTarget && !model.selectedGuess) next = `目标：${target}。选择要猜的角色。`;
            else if (card.id === 1 && needsTarget) next = `目标：${target}，猜测 ${model.selectedGuess} · ${CARD_NAMES[model.selectedGuess]}。`;
            else if (target) next = `目标：${target}。确认后出牌。`;
            else if (noTargetEffect) next = '其他玩家均受保护，出牌不会产生效果。';
        }
        return `<div class="ll-table-action ll-selection-action">
            <div class="ll-action-label">准备出牌</div>
            <div class="ll-action-card-shell">${renderSceneCard(card)}</div>
            <aside class="ll-action-detail"><span>${card.value ?? card.id} 点</span><strong>${esc(card.name || CARD_NAMES[card.id])}</strong><small>${esc(shortEffect(card.id))}</small><em>${esc(next)}</em></aside>
        </div>`;
    }

    function refreshEvent() {
        const state = model.state;
        if (!state) return;
        const me = (state.players || []).find(player => player.id === state.myId);
        const ended = state.status === 'ended';
        const roundEnded = state.status === 'round_end';
        const awaitingTarget = Boolean(state.phase === 'target_ack' && state.pendingAction);
        const myTurn = Boolean(state.myIsCurrentTurn && !isOut(me) && !ended && !roundEnded && !awaitingTarget);
        renderEvent(roundEnded, ended, myTurn);
    }

    function renderInitialAction(round) {
        return renderChapterState(`第 ${Number(round) || 1} 轮开始`, '等待第一位信使', 'll-initial-action');
    }

    function renderRoundResult(round, winners) {
        return renderChapterState(`第 ${Number(round) || 1} 轮结束`, `${winners}获得一颗爱心`, 'll-round-result');
    }

    function renderChapterState(kicker, message, modifier) {
        return `<div class="ll-table-action ll-chapter-state ${modifier}"><span>${esc(kicker)}</span><i aria-hidden="true"></i><strong>${esc(message)}</strong></div>`;
    }

    function renderFinalResult() {
        const state = model.state;
        const winners = state.winners?.length ? state.winners : state.winner ? [state.winner] : [];
        const winnerIds = new Set(winners.map(player => String(player.id)));
        const players = [...(state.players || [])].sort((a, b) => favorCount(state, b.id) - favorCount(state, a.id));
        return `<section class="ll-final-result" aria-label="整场结算">
            <header><span>第 ${Number(state.round) || 1} 轮 · 整场结束</span><h2 id="ll-final-title">${winners.length > 1 ? '共同获胜' : '整场胜者'}</h2></header>
            <div class="ll-final-winners"><strong>${esc(winners.map(player => player.name || '玩家').join('、') || '无人')}</strong></div>
            <div class="ll-final-scores" aria-label="最终成绩">${players.map(player => `<div><strong>${esc(player.name || '玩家')}</strong><span>${winnerIds.has(String(player.id)) ? '<em>获胜</em>' : ''}<b>♥ ${favorCount(state, player.id)}</b></span></div>`).join('')}</div>
            <button class="ll-primary ll-final-return" data-action="return-lobby" type="button">返回大厅</button>
        </section>`;
    }

    function renderFinalOverlay(ended) {
        const overlay = $('finalOverlay');
        overlay.classList.toggle('is-hidden', !ended);
        overlay.setAttribute('aria-hidden', String(!ended));
        if (ended) $('finalContent').innerHTML = renderFinalResult();
    }

    function renderTableAction(action) {
        const state = model.state;
        const card = { id: action.cardId, value: action.cardId, name: action.cardName };
        const result = action.result || {};
        const guess = Number(action.guess || 0);
        const cardId = Number(action.cardId);
        const actor = displayName(action.playerId, action.playerName || '玩家');
        const target = action.targetId ? displayName(action.targetId) : '';
        const actionTarget = action.targetId === action.playerId ? '自己' : target || '目标玩家';
        const cardName = action.cardName || CARD_NAMES[cardId] || '人物牌';
        const pending = state.pendingAction?.actionId === action.actionId;
        const detail = action.targetId ? `${actor}对${actionTarget}打出${cardName}。` : `${actor}打出${cardName}。`;
        let outcome = '';
        if (result.noEffect) {
            outcome = '目标均受侍女保护，本次效果未生效。';
        } else if (cardId === 1 && guess) {
            const guessedRole = CARD_NAMES[guess] || '未知角色';
            outcome = pending ? `猜测${guessedRole}，等待确认。` : result.eliminated ? `猜测${guessedRole}正确，${displayName(result.eliminated)}出局。` : result.guardMiss ? `猜测${guessedRole}错误，没有玩家出局。` : `猜测${guessedRole}。`;
        } else if (cardId === 2) {
            outcome = action.result?.privateFor === state.myId ? '目标手牌已在玩家席位翻开。' : `手牌内容仅${actor}可见。`;
        } else if (cardId === 3 && result.baronOutcome) {
            outcome = result.baronOutcome === 'tie' ? '双方点数相同，没有玩家出局。' : result.eliminated ? `${displayName(result.eliminated)}点数较低，出局。` : '';
        } else if (cardId === 4) {
            outcome = `${actor}获得保护，直到下回合开始。`;
        } else if (cardId === 5 && result.discardedCard) {
            const discarded = result.discardedCard;
            const discardedName = discarded.name || CARD_NAMES[discarded.id] || '未知角色';
            outcome = result.eliminated ? `${actionTarget}弃掉${discardedName}，因此出局。` : `${actionTarget}弃掉${discardedName}并重新摸牌。`;
        } else if (cardId === 6) {
            outcome = pending ? '' : '双方手牌已经交换。';
        } else if (cardId === 7) {
            outcome = '此牌没有其他效果；同时持有国王或王子时必须将其打出。';
        } else if (cardId === 8) {
            outcome = `${actor}立即出局。`;
        }
        if (pending && cardId !== 1) outcome = '等待目标确认。';
        if (!outcome) outcome = '行动已完成。';
        return `<div class="ll-table-action" data-action-id="${Number(action.actionId) || 0}">
            <div class="ll-action-label">最近出牌</div>
            <div class="ll-action-card-shell" data-role="playedCard" data-actor-id="${esc(action.playerId || '')}">${renderSceneCard(card)}</div>
            <aside class="ll-action-detail ${cardId === 1 ? 'is-guess' : ''}"><span>${pending ? '等待确认' : result.noEffect ? '未产生效果' : '行动完成'}</span><strong>${esc(cardName)}</strong><small>${esc(detail)}</small><em>${esc(outcome)}</em></aside>
        </div>`;
    }

    function renderRecentActions() {
        const state = model.state;
        const limit = state.players?.length === 2 ? 2 : 3;
        const entries = (state.publicDiscard || []).filter(entry => entry.reason === 'played').slice(-limit).reverse();
        $('recentActions').setAttribute('aria-label', `最近${limit}次行动`);
        $('recentActions').style.setProperty('--ll-recent-slots', String(limit));
        $('recentActions').innerHTML = entries.length ? entries.map(entry => {
            const card = entry.card || {};
            const cardName = card.name || CARD_NAMES[card.id] || '未知角色';
            const actor = displayName(entry.ownerId);
            const target = entry.targetId ? (entry.targetId === entry.ownerId ? '自己' : displayName(entry.targetId)) : '';
            const pending = state.pendingAction?.actionId === entry.actionId;
            const result = entry.result || (state.lastAction?.actionId === entry.actionId ? state.lastAction.result : null);
            let sentence = `${actor}打出此牌`;
            if (Number(card.id) === 4) sentence = `${actor}获得保护`;
            if (Number(card.id) === 8) sentence = `${actor}出局`;
            if (result?.noEffect) sentence = `${actor}出牌，未产生效果`;
            if (target && !result?.noEffect) {
                if (pending) sentence = `${actor}指定${target}，等待确认`;
                else if (Number(card.id) === 1) sentence = `${actor}猜${target}是${CARD_NAMES[entry.guess] || '未知角色'}${result?.guardMiss ? '，未猜中' : result?.eliminated ? '，猜中了' : ''}`;
                else if (Number(card.id) === 2) sentence = `${actor}查看了${target}的手牌`;
                else if (Number(card.id) === 3) sentence = `${actor}与${target}比较了手牌`;
                else if (Number(card.id) === 5) sentence = `${actor}令${target}弃牌${result?.eliminated ? '并出局' : '并重摸'}`;
                else if (Number(card.id) === 6) sentence = `${actor}与${target}交换了手牌`;
            }
            return `<article class="ll-recent-action"><strong class="ll-recent-card-label">${esc(card.value ?? card.id)} · ${esc(cardName)}</strong><span>${esc(sentence)}</span></article>`;
        }).join('') : '<span class="ll-empty">暂无行动</span>';
    }

    function latestHistoryOutcome(entry) {
        const state = model.state;
        const action = entry.result
            ? { actionId: entry.actionId, cardId: entry.card?.id, targetId: entry.targetId, playerId: entry.ownerId, result: entry.result }
            : state.lastAction;
        if (!action || entry.actionId == null || String(action.actionId) !== String(entry.actionId)) return '';
        const result = action.result || {};
        const target = action.targetId ? displayName(action.targetId) : '目标玩家';
        if (state.pendingAction?.actionId === action.actionId) return `等待${target}确认，倒计时结束后自动结算`;
        if (result.noEffect) return '目标均受侍女保护，本次效果未生效';
        if (Number(action.cardId) === 1) return result.eliminated ? `${displayName(result.eliminated)}出局` : result.guardMiss ? '猜测错误，没有玩家出局' : '已完成猜牌';
        if (Number(action.cardId) === 2) return `已查看${target}的手牌，内容仅${displayName(action.playerId)}可见`;
        if (Number(action.cardId) === 3 && result.baronOutcome) return result.baronOutcome === 'tie' ? '双方点数相同，没有玩家出局' : `${displayName(result.eliminated)}点数较低，出局`;
        if (Number(action.cardId) === 4) return '已获得保护，直到下回合开始';
        if (Number(action.cardId) === 5 && result.discardedCard) {
            const discarded = result.discardedCard.name || CARD_NAMES[result.discardedCard.id] || '一张牌';
            return result.eliminated ? `${target}弃掉${discarded}，因此出局` : `${target}弃掉${discarded}并重新摸牌`;
        }
        if (Number(action.cardId) === 6) return '双方手牌已经交换';
        if (Number(action.cardId) === 7) return '伯爵夫人没有主动效果，本次行动结束';
        if (Number(action.cardId) === 8) return '出牌者立即出局';
        return result.message ? viewerText(result.message) : '行动已完成';
    }

    function historyCopy(entry) {
        const card = entry.card || {};
        const value = Number(card.value ?? card.id);
        const cardName = card.name || CARD_NAMES[value] || '未知牌';
        const owner = entry.ownerId ? displayName(entry.ownerId) : '玩家';
        const target = entry.targetId ? (entry.targetId === entry.ownerId ? '自己' : displayName(entry.targetId)) : '';
        const guess = entry.guess ? `猜 ${entry.guess} · ${CARD_NAMES[entry.guess] || '未知角色'}` : '';
        if (entry.reason === '二人局起始公开') return { title: `${cardName}（${value}点）`, detail: '开局公开移出' };
        if (entry.reason === 'prince') return { title: `${owner}弃掉${cardName} · ${value}点`, detail: value === 8 ? '王子令其弃掉公主，立即出局' : '受王子效果影响，弃牌公开后重新摸牌' };
        if (entry.reason === 'eliminated') return { title: `${owner}出局，弃掉${cardName} · ${value}点`, detail: '离开本轮，剩余手牌公开弃置' };
        const status = latestHistoryOutcome(entry) || '行动已完成';
        return {
            title: target ? `${owner}对${target}使用${cardName}（${value}点）` : `${owner}打出${cardName}（${value}点）`,
            detail: [guess, status].filter(Boolean).join('；'),
        };
    }

    function historyEntries(entries, emptyText) {
        return entries.length ? entries.slice().reverse().map(entry => {
            const card = entry.card || {};
            const value = Number(card.value ?? card.id);
            const copy = historyCopy(entry);
            const tone = historyTone(entry, value);
            return `<article class="ll-history-entry is-${tone}">${renderDiscardCard(entry)}<div><strong>${esc(copy.title)}</strong><small>${esc(copy.detail)}</small></div></article>`;
        }).join('') : `<span class="ll-empty">${esc(emptyText)}</span>`;
    }

    function historyTone(entry, value) {
        if (entry.reason === '二人局起始公开') return 'removed';
        if (Number(value) === 8 || /out|eliminat|出局|失去/i.test(String(entry.reason || ''))) return 'critical';
        if ([1, 3, 5].includes(Number(value))) return 'result';
        return 'normal';
    }

    function renderArchive(kind) {
        const state = model.state;
        let title = '历史记录';
        let label = '本轮行动 · 最新在前';
        let emptyText = '本轮暂无历史记录';
        let entries = (state?.publicDiscard || []).filter(entry => entry.reason === 'played');
        if (kind === 'removed') {
            title = '2人局公共弃牌';
            label = '开局时公开移出的3张牌，本轮不参与游戏';
            emptyText = '暂无公共弃牌';
            entries = (state?.setAsideCards || []).filter(Boolean).map(card => ({ card, reason: '二人局起始公开' }));
        }
        $('archiveTitle').textContent = title;
        $('archiveLabel').textContent = label;
        $('archiveList').innerHTML = historyEntries(entries, emptyText);
    }

    function renderCommand(me, myTurn, roundEnded, ended) {
        const state = model.state;
        const hand = state.myHand || [];
        if (ended || roundEnded) {
            const readyIds = state.nextRoundReadyIds || [];
            const hasConfirmed = readyIds.includes(state.myId);
            const readyCount = Number(state.nextRoundReadyCount ?? readyIds.length);
            const readyTotal = Number(state.nextRoundReadyTotal ?? state.players?.length ?? 0);
            const readyControl = ended ? '' : `<div class="ll-next-round-ready"><button class="ll-primary" title="所有人准备后自动开始" aria-label="准备下一轮" data-action="start-next-round" type="button" ${hasConfirmed || model.pendingAction ? 'disabled' : ''}>${model.pendingAction ? '正在确认…' : hasConfirmed ? '已准备' : '下一轮'}</button><small>已准备 ${readyCount}/${readyTotal}</small></div>`;
            const finalHand = hand.map((card, index) => renderHandCard(card, index, false, false)).join('') || '<span class="ll-empty">暂无手牌</span>';
            $('command').innerHTML = `<div class="ll-command-shell"><aside class="ll-self-summary"><span class="ll-seat-copy"><span class="ll-seat-name"><strong>${esc(me?.name || state.myId)}</strong></span><span class="ll-seat-score"><i aria-hidden="true">♥</i><b>${favorScore(state, favorCount(state, state.myId))}</b></span></span></aside><section class="ll-hand-decision"><div class="ll-hand" aria-label="您的最终手牌">${finalHand}</div></section><section class="ll-action-console">${readyControl}</section></div>`;
            return;
        }

        const selected = model.selectedCardIndex === null ? null : hand[model.selectedCardIndex];
        const mustCountess = mustPlayCountessNow(state);
        const selfIsSource = state.pendingAction?.playerId === state.myId;
        const selfIsTarget = state.pendingAction?.targetId === state.myId;
        const selfTargetable = Boolean(me && canTarget(state, model.selectedCardIndex, me));
        const selfSelected = selfTargetable && model.selectedTargetId === state.myId;
        const selfStatus = isOut(me) ? '已出局' : me?.isProtected ? '侍女保护' : '';
        $('command').innerHTML = `<div class="ll-command-shell">
            <aside class="ll-self-summary ${myTurn ? 'is-turn' : ''} ${me?.isProtected ? 'is-protected' : ''} ${selfIsSource ? 'is-action-source' : ''} ${selfIsTarget ? 'is-action-target' : ''} ${selfTargetable ? 'is-targetable' : ''} ${selfSelected ? 'is-selected' : ''}" data-player-id="${esc(state.myId)}" ${selfTargetable ? `data-target-id="${esc(state.myId)}" role="button" tabindex="0" aria-pressed="${selfSelected}"` : ''} aria-label="${selfTargetable ? '选择' : ''}${esc(me?.name || state.myId)}${me?.isProtected ? '，侍女保护中' : ''}">
                <span class="ll-seat-copy"><span class="ll-seat-name"><strong>${esc(me?.name || state.myId)}</strong></span>${selfStatus ? `<small>${selfStatus}</small>` : ''}<span class="ll-seat-score" aria-label="${favorCount(state, state.myId)} / ${favorTarget(state)} 枚爱心"><i aria-hidden="true">♥</i><b>${favorScore(state, favorCount(state, state.myId))}</b></span></span>
            </aside>
            <section class="ll-hand-decision"><div class="ll-hand" aria-label="您的手牌">${hand.map((card, index) => renderHandCard(card, index, myTurn, mustCountess)).join('') || '<span class="ll-empty">暂无手牌</span>'}</div></section>
            <section class="ll-action-console"><div class="ll-action-panel">${renderActionPanel(selected, myTurn, mustCountess, isOut(me))}</div></section>
        </div>`;
    }

    function renderHandCard(card, index, myTurn, mustCountess) {
        const selected = index === model.selectedCardIndex;
        const locked = mustCountess && card.id !== 7;
        const name = card.name || CARD_NAMES[card.id];
        const accessibleLabel = `${card.value ?? card.id} 点·${name}，${compactEffect(card.id)}${locked ? '，当前不可打出' : ''}`;
        return `<button class="ll-hand-card ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-card-index="${index}" data-card-id="${card.id}" type="button" aria-label="${esc(accessibleLabel)}" aria-pressed="${selected}" ${myTurn && !locked && !model.pendingAction ? '' : 'disabled'}>
            <span class="ll-card-value">${card.value ?? card.id}</span>
            ${renderPortrait(card, 'll-card-portrait')}
            <span class="ll-card-copy"><strong>${esc(name)}</strong><small>${esc(compactEffect(card.id))}</small></span>
        </button>`;
    }

    function renderActionPanel(card, myTurn, mustCountess, out) {
        const state = model.state;
        if (out) return '<button class="ll-primary" type="button" disabled>等待出牌</button>';
        if (state.pendingAction) {
            const announced = state.pendingAction;
            const isTarget = announced.targetId === state.myId;
            if (isTarget) {
                const remaining = Math.max(0, Math.ceil((model.acknowledgementDeadline - Date.now()) / 1000));
                return `<button class="ll-primary" data-action="acknowledge-action" type="button" ${model.pendingAction ? 'disabled' : ''}><span>${model.pendingAction ? '正在确认' : '确认'}</span>${model.pendingAction ? '' : `<span class="ll-confirm-countdown">${remaining}秒后自动确认</span>`}</button>`;
            }
            return '<button class="ll-primary" type="button" disabled>等待出牌</button>';
        }
        if (!myTurn) return '<button class="ll-primary" type="button" disabled>等待出牌</button>';
        if (!card) return '<button class="ll-primary" type="button" disabled>选择手牌</button>';

        const needsTarget = needsTargetSelection(state, card);
        const targetName = model.selectedTargetId ? displayName(model.selectedTargetId) : '';
        const noTargetEffect = NEEDS_TARGET.has(card.id) && !needsTarget;
        const canPlay = canPlaySelected(state, model.selectedCardIndex, model.selectedTargetId, model.selectedGuess, mustCountess);
        return `${needsTarget ? `<div class="ll-target-line"><span>目标</span><b>${targetName ? esc(targetName) : '请选择玩家'}</b></div>` : ''}
            ${noTargetEffect ? '<div class="ll-inline-note">没有有效目标，本次效果作废</div>' : ''}
            ${card.id === 1 && needsTarget ? `<button class="ll-guess-trigger" data-action="open-guess" type="button"><span>猜测</span><b>${model.selectedGuess ? esc(CARD_NAMES[model.selectedGuess]) : '请选择角色'}</b></button>` : ''}
            ${mustCountess ? '<div class="ll-inline-note is-warning">必须打出伯爵夫人</div>' : ''}
            <button class="ll-primary" data-action="play" type="button" ${canPlay && !model.pendingAction ? '' : 'disabled'}>打出手牌</button>`;
    }

    function renderGuessOverlay(myTurn) {
        const state = model.state;
        const card = model.selectedCardIndex === null ? null : state?.myHand?.[model.selectedCardIndex];
        const visible = Boolean(model.guessOpen && myTurn && card?.id === 1);
        $('guessOverlay').classList.toggle('is-hidden', !visible);
        $('guessOverlay').setAttribute('aria-hidden', String(!visible));
        if (!visible) return;
        $('guessPrompt').textContent = model.selectedTargetId ? `目标：${displayName(model.selectedTargetId)}。猜中则对方出局。` : '不能选择侍卫。';
        $('guessCards').innerHTML = [2, 3, 4, 5, 6, 7, 8].map(value => `<button class="ll-guess-option ${model.selectedGuess === value ? 'is-selected' : ''}" data-guess="${value}" type="button" aria-pressed="${model.selectedGuess === value}"><b>${value}</b>${renderPortrait({ id: value }, 'll-guess-portrait')}<span>${CARD_NAMES[value]}</span></button>`).join('');
        mount.querySelector('[data-action="confirm-guess"]').disabled = !model.selectedGuess;
    }

    return Object.freeze({ render, refreshEvent, renderGuessOverlay, renderArchive });
}
