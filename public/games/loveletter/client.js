const CARD_NAMES = { 1: '侍卫', 2: '牧师', 3: '男爵', 4: '侍女', 5: '王子', 6: '国王', 7: '伯爵夫人', 8: '公主' };
const CARD_ART = {
    1: '/assets/bgg/loveletter/cards/guard.jpg',
    2: '/assets/bgg/loveletter/cards/priest.jpg',
    3: '/assets/bgg/loveletter/cards/baron.jpg',
    4: '/assets/bgg/loveletter/cards/handmaid.jpg',
    5: '/assets/bgg/loveletter/cards/prince.jpg',
    6: '/assets/bgg/loveletter/cards/king.jpg',
    7: '/assets/bgg/loveletter/cards/countess.jpg',
    8: '/assets/bgg/loveletter/cards/princess.jpg',
};
const CARD_FOCUS = {
    1: { x: 50, y: 34 },
    2: { x: 50, y: 36 },
    3: { x: 50, y: 37 },
    4: { x: 49, y: 38 },
    5: { x: 51, y: 34 },
    6: { x: 52, y: 37 },
    7: { x: 55, y: 38 },
    8: { x: 51, y: 35 },
};
const CARD_RULES = [
    { value: 1, count: 5, name: '侍卫', effect: '猜一名玩家的手牌，猜中则对方出局。' },
    { value: 2, count: 2, name: '牧师', effect: '查看一名玩家的手牌，只有你能看到。' },
    { value: 3, count: 2, name: '男爵', effect: '和一名玩家比较手牌，点数低者出局。' },
    { value: 4, count: 2, name: '侍女', effect: '保护自己到下一回合，期间不能被指定。' },
    { value: 5, count: 2, name: '王子', effect: '指定一名玩家弃牌并重抽，可以指定自己。' },
    { value: 6, count: 1, name: '国王', effect: '和一名玩家交换手牌。' },
    { value: 7, count: 1, name: '伯爵夫人', effect: '若同时持有王子或国王，必须打出此牌。' },
    { value: 8, count: 1, name: '公主', effect: '打出或弃掉公主会立刻出局。' },
];
const NEEDS_TARGET = new Set([1, 2, 3, 5, 6]);

export function createGameClient({ mount, send, addLog }) {
    Object.values(CARD_ART).forEach(src => {
        const image = new Image();
        image.src = src;
    });
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/loveletter/style.css?v=20260826-mobile-games-4';
    document.head.appendChild(style);
    document.body.classList.add('is-loveletter-view');

    let state = null;
    let selectedCardIndex = null;
    let selectedTargetId = null;
    let selectedGuess = null;
    let rulesOpen = false;
    let guessOpen = false;
    let pendingAction = false;
    let animateActionId = null;
    let centeredActionId = null;
    let actionLayoutFrame = 0;
    let actionSettleTimer = 0;
    let acknowledgementTimer = 0;
    let acknowledgementClock = 0;
    let acknowledgementActionId = null;
    let acknowledgementReadyAt = 0;
    let acknowledgementDeadline = 0;
    let scenePlaying = false;
    let sceneToken = 0;
    let sceneQueue = [];
    const sceneWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const controller = new AbortController();

    mount.innerHTML = `<section class="ll-app" aria-label="情书游戏">
        <header class="ll-statusbar">
            <div class="ll-turn-status"><span class="ll-turn-dot" aria-hidden="true"></span><div><small data-role="phase">等待开局</small><strong data-role="turn">等待游戏状态</strong></div></div>
            <dl class="ll-round-stats">
                <div><dt>轮次</dt><dd data-role="round">-</dd></div>
                <div><dt>牌库</dt><dd><b data-role="deck">-</b> 张</dd></div>
                <div data-role="asideStat"><dt>二人局移出</dt><dd data-role="aside">-</dd></div>
            </dl>
            <button class="ll-icon-button" data-action="rules" type="button" aria-label="查看规则" title="查看规则">?</button>
        </header>

        <section class="ll-opponents" data-role="seats" aria-label="其他玩家"></section>

            <main class="ll-table">
            <div class="ll-table-core">
                <div class="ll-pile" aria-label="牌库">${renderCardBack('情书', '', '牌库卡背')}<strong><b data-role="deckLarge">-</b> 张</strong><small>牌库</small></div>
                <section class="ll-latest" data-role="event" aria-live="polite"><div><span>最近行动</span><strong>等待第一封信</strong><small>公开行动会显示在这里</small></div></section>
                <div class="ll-pile is-reserved" aria-label="密封预留牌">${renderCardBack('密封', '', '预留牌卡背')}<strong><b data-role="reserved">-</b> 张</strong><small>预留牌</small></div>
            </div>
            <section class="ll-discard-zone" aria-label="公开弃牌">
                <header><div><strong>公开弃牌</strong><span data-role="discardCount">0 张</span></div><small>按玩家分组，公开点数计入牌库耗尽时的平局判定</small></header>
                <div class="ll-discard-list" data-role="discards"><span class="ll-empty">还没有公开弃牌</span></div>
            </section>
        </main>

        <section class="ll-player-dock" data-role="command" aria-label="你的手牌与行动"></section>

        <svg class="ll-action-link" data-role="actionLink" aria-hidden="true">
            <path class="ll-action-link-glow" data-role="actionLinkGlow"></path>
            <path class="ll-action-link-stroke" data-role="actionLinkStroke"></path>
            <circle class="ll-action-link-seal" data-role="actionLinkSeal" r="7"></circle>
        </svg>

        <div class="ll-scene-layer" data-role="sceneLayer" aria-hidden="true" hidden>
            <div class="ll-scene" data-role="scene" role="status" aria-live="assertive"></div>
            <button class="ll-scene-skip" data-action="skip-scene" type="button">跳过</button>
        </div>

        <div class="ll-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <div class="ll-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-rules-title">
                <button class="ll-dialog-close" data-action="close-rules" type="button" aria-label="关闭规则">x</button>
                <span class="ll-dialog-label">经典 16 张基础版</span><h2 id="ll-rules-title">情书规则</h2>
                <p>轮到你时，从两张手牌中打出一张，并执行角色效果。每轮胜者获得一枚爱心筹码。</p>
                <div class="ll-rule-list">${CARD_RULES.map(rule => `<article><b>${rule.value}</b><div><strong>${rule.name}<small>x${rule.count}</small></strong><span>${rule.effect}</span></div></article>`).join('')}</div>
            </div>
        </div>

        <div class="ll-overlay is-hidden" data-role="guessOverlay" aria-hidden="true">
            <div class="ll-dialog ll-guess-dialog" role="dialog" aria-modal="true" aria-labelledby="ll-guess-title">
                <button class="ll-dialog-close" data-action="close-guess" type="button" aria-label="关闭猜牌">x</button>
                <span class="ll-dialog-label">侍卫 · 1 点</span><h2 id="ll-guess-title">选择要猜的角色</h2>
                <p data-role="guessPrompt">不能猜侍卫。选好牌面后，再选择一名对手作为目标。</p>
                <div class="ll-guess-options" data-role="guessCards"></div>
                <button class="ll-primary ll-guess-confirm" data-action="confirm-guess" type="button" disabled>确认猜测牌面</button>
            </div>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const root = mount.querySelector('.ll-app');

    function handleMessage(message) {
        const previousState = state;
        const previousTurn = state ? `${state.round}:${state.currentTurn}` : null;
        const previousActionId = state?.lastAction?.actionId ?? null;
        if (message.state) {
            state = message.state;
            if (state.pendingAction && state.pendingAction.actionId !== acknowledgementActionId) {
                acknowledgementActionId = state.pendingAction.actionId;
                acknowledgementReadyAt = Date.now() + Math.max(0, Number(state.pendingAction.remainingReadyMs ?? 900));
                acknowledgementDeadline = Date.now() + Math.max(0, Number(state.pendingAction.remainingMs ?? 4000));
            } else if (!state.pendingAction) {
                acknowledgementActionId = null;
                acknowledgementReadyAt = 0;
                acknowledgementDeadline = 0;
            }
            const currentTurn = `${state.round}:${state.currentTurn}`;
            const currentActionId = state.lastAction?.actionId ?? null;
            if (previousState && currentActionId && currentActionId !== previousActionId) animateActionId = currentActionId;
            if (previousTurn !== currentTurn || !state.myIsCurrentTurn || state.pendingAction) clearSelection();
            pendingAction = false;
            normalizeSelection();
            render();
            enqueueScenes(deriveScenes(previousState, state));
        }
        if (message.type === 'error') {
            pendingAction = false;
            render();
        }
        const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
        if (text) addLog(text, message.type === 'error' ? 'error' : 'info');
    }

    function deriveScenes(previous, next) {
        if (!previous || !next || previous.round !== next.round) return [];
        const wasOut = new Map((previous.players || []).map(player => [player.id, isOut(player)]));
        const newlyOut = (next.players || []).filter(player => !wasOut.get(player.id) && isOut(player));
        if (newlyOut.length) {
            return newlyOut.map(player => ({
                type: 'elimination',
                player: { id: player.id, name: player.name },
                card: eliminationCard(next, player.id),
                reason: next.lastAction?.result?.message || `${player.name} 离开了本轮`,
                outcome: roundOutcome(next),
            }));
        }
        const enteredRoundEnd = previous.status === 'playing' && (next.status === 'round_end' || next.status === 'ended');
        return enteredRoundEnd && next.endReason === 'showdown' ? [{ type: 'showdown', state: next }] : [];
    }

    function eliminationCard(next, playerId) {
        const result = next.lastAction?.result;
        if (result?.eliminated === playerId && result.revealedCard) return result.revealedCard;
        const entries = (next.publicDiscard || []).filter(entry => entry.ownerId === playerId);
        return [...entries].reverse().find(entry => entry.reason === 'eliminated' || entry.reason === 'prince')?.card || null;
    }

    function roundOutcome(next) {
        if (next.status !== 'round_end' && next.status !== 'ended') return null;
        const winners = next.roundWinners?.length ? next.roundWinners : next.roundWinner ? [next.roundWinner] : [];
        return {
            winners,
            gameEnded: next.status === 'ended',
            targetFavor: next.targetFavor,
            favorTokens: next.favorTokens || [],
        };
    }

    function enqueueScenes(scenes) {
        if (!scenes.length) return;
        sceneQueue.push(...scenes);
        void playSceneQueue();
    }

    async function playSceneQueue() {
        if (scenePlaying) return;
        scenePlaying = true;
        root.classList.add('is-scene-active');
        while (sceneQueue.length) {
            const scene = sceneQueue.shift();
            const token = ++sceneToken;
            if (scene.type === 'elimination') await playEliminationScene(scene, token);
            if (scene.type === 'showdown') await playShowdownScene(scene, token);
            if (token === sceneToken) hideScene();
        }
        scenePlaying = false;
        root.classList.remove('is-scene-active');
    }

    async function playEliminationScene(scene, token) {
        const outcome = scene.outcome;
        showScene('elimination', `<div class="ll-elimination-mark" aria-hidden="true"><span></span></div>
            <div class="ll-scene-kicker">信件退回</div>
            <div class="ll-elimination-reveal">${scene.card ? renderSceneCard(scene.card) : '<span class="ll-broken-seal" aria-hidden="true">♥</span>'}</div>
            <h2>${esc(scene.player.name)}出局</h2>
            <p>${esc(scene.reason)}</p>
            ${outcome ? renderSceneOutcome(outcome) : ''}`);
        requestAnimationFrame(() => $('sceneLayer').classList.add('is-revealed'));
        if (!await sceneDelay(1050, token)) return;
        if (outcome) {
            $('sceneLayer').classList.add('is-decided');
            if (!await sceneDelay(outcome.gameEnded ? 1350 : 1050, token)) return;
        } else {
            await sceneDelay(250, token);
        }
    }

    async function playShowdownScene(scene, token) {
        const finalState = scene.state;
        const discardTotals = Object.fromEntries((finalState.players || []).map(player => [player.id, discardValue(finalState, player.id)]));
        const contenders = (finalState.players || []).filter(player => !isOut(player) && (player.finalHand || player.hand || [])[0]).map((player, index) => ({
            id: player.id,
            name: player.name,
            card: (player.finalHand || player.hand)[0],
            discardValue: discardTotals[player.id] || 0,
            index,
        }));
        const highestHand = Math.max(0, ...contenders.map(player => Number(player.card?.value ?? player.card?.id ?? 0)));
        const highestPlayers = contenders.filter(player => Number(player.card?.value ?? player.card?.id ?? 0) === highestHand);
        const needsTiebreak = highestPlayers.length > 1;
        const winnerIds = new Set((finalState.roundWinners || []).map(player => player.id));
        const outcome = roundOutcome(finalState);
        showScene('showdown', `<div class="ll-scene-kicker">最终拼点</div>
            <h2>最后一封信已经送出</h2>
            <p>牌库耗尽，仍在场的玩家同时公开手牌。</p>
            <div class="ll-showdown-grid">${contenders.map(player => renderShowdownPlayer(player, winnerIds.has(player.id))).join('')}</div>
            ${needsTiebreak ? '<div class="ll-tiebreak-note"><span>手牌同点</span><strong>比较公开弃牌总点数</strong></div>' : ''}
            ${outcome ? renderSceneOutcome(outcome) : ''}`);
        if (!await sceneDelay(550, token)) return;
        $('sceneLayer').classList.add('is-revealed');
        if (!await sceneDelay(850, token)) return;
        if (needsTiebreak) {
            $('sceneLayer').classList.add('is-tiebreak');
            if (!await sceneDelay(650, token)) return;
        }
        $('sceneLayer').classList.add('is-decided');
        await sceneDelay(outcome?.gameEnded ? 1250 : 1000, token);
    }

    function showScene(kind, html) {
        const layer = $('sceneLayer');
        layer.hidden = false;
        layer.className = `ll-scene-layer is-active is-${kind}`;
        layer.setAttribute('aria-hidden', 'false');
        $('scene').innerHTML = html;
    }

    function hideScene() {
        const layer = $('sceneLayer');
        layer.className = 'll-scene-layer';
        layer.setAttribute('aria-hidden', 'true');
        $('scene').innerHTML = '';
        layer.hidden = true;
    }

    function skipScene() {
        if (!scenePlaying) return;
        sceneToken++;
        for (const waiter of sceneWaiters) {
            clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        sceneWaiters.clear();
        hideScene();
    }

    function sceneDelay(duration, token) {
        const wait = reducedMotion ? Math.min(duration, 80) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: 0,
                resolve(value) {
                    sceneWaiters.delete(waiter);
                    resolve(value);
                },
            };
            waiter.timer = window.setTimeout(() => waiter.resolve(token === sceneToken), wait);
            sceneWaiters.add(waiter);
        });
    }

    function renderSceneCard(card) {
        const value = Number(card?.value ?? card?.id);
        return `<span class="ll-scene-card">${renderPortrait({ id: value }, 'll-scene-portrait')}<b>${value || '?'}</b><strong>${esc(card?.name || CARD_NAMES[value] || '未知角色')}</strong></span>`;
    }

    function renderShowdownPlayer(player, winner) {
        const value = Number(player.card?.value ?? player.card?.id);
        return `<article class="ll-showdown-player ${winner ? 'is-winner' : ''}" style="--ll-order:${player.index}">
            <strong>${esc(player.name)}</strong>
            <div class="ll-showdown-card"><div class="ll-showdown-card-inner">
                <div class="ll-showdown-side is-back">${renderCardBack('密封', '', `${player.name}的隐藏手牌`)}</div>
                <div class="ll-showdown-side is-front">${renderSceneCard(player.card)}</div>
            </div></div>
            <span class="ll-hand-value">手牌 <b>${value}</b> 点</span>
            <span class="ll-discard-value">弃牌合计 <b>${player.discardValue}</b> 点</span>
        </article>`;
    }

    function renderSceneOutcome(outcome) {
        const names = outcome.winners.map(player => player.name).join('、') || '无人';
        const scores = outcome.winners.map(player => {
            const count = Number(outcome.favorTokens.find(token => token.id === player.id)?.count || 0);
            return `${esc(player.name)} ${Math.min(count, outcome.targetFavor)}/${outcome.targetFavor}`;
        }).join(' · ');
        return `<div class="ll-scene-outcome"><span>${outcome.gameEnded ? '情书送达' : '本轮胜者'}</span><strong>${esc(names)}${outcome.gameEnded ? '赢得情书' : '获得一枚爱心'}</strong><small><i aria-hidden="true">♥</i>${scores}</small></div>`;
    }

    function discardValue(finalState, playerId) {
        return (finalState.publicDiscard || []).filter(entry => entry.ownerId === playerId).reduce((sum, entry) => sum + Number(entry.card?.value ?? entry.card?.id ?? 0), 0);
    }

    function render() {
        if (!state) return;
        const players = state.players || [];
        const me = players.find(player => player.id === state.myId);
        const ended = state.status === 'ended';
        const roundEnded = state.status === 'round_end';
        const awaitingTarget = Boolean(state.phase === 'target_ack' && state.pendingAction);
        const myTurn = Boolean(state.myIsCurrentTurn && !isOut(me) && !ended && !roundEnded && !awaitingTarget);
        root.classList.toggle('is-my-turn', myTurn);
        root.classList.toggle('is-round-ended', roundEnded || ended);
        root.classList.toggle('is-awaiting-target', awaitingTarget);

        const gameWinners = winnerNames(state.winners, state.winner);
        $('turn').textContent = ended ? (gameWinners ? `${gameWinners} 获胜` : '本局结束') : roundEnded ? `第 ${state.round} 轮结算` : awaitingTarget ? `等待 ${state.pendingAction.targetName || getName(state.pendingAction.targetId)} 知晓` : myTurn ? '轮到你出牌' : `轮到 ${state.currentTurnName || '其他玩家'}`;
        $('phase').textContent = ended ? '整场结束' : roundEnded ? '本轮结束' : awaitingTarget ? `${state.pendingAction.playerName || getName(state.pendingAction.playerId)} 已经出牌` : myTurn ? '请选择一张手牌' : '等待对方行动';
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
        scheduleActionPresentation();
        scheduleAcknowledgement();
    }

    function renderSeats(players, revealHands) {
        const opponents = players.filter(player => player.id !== state.myId);
        $('seats').style.setProperty('--seat-count', String(Math.max(1, opponents.length)));
        $('seats').innerHTML = opponents.map(player => {
            const announced = state.pendingAction;
            const targetable = canTarget(player);
            const selected = selectedTargetId === player.id;
            const visible = revealHands ? (player.finalHand || player.hand || [])[0] : null;
            const tag = targetable ? 'button' : 'article';
            const attrs = `data-player-id="${esc(player.id)}"${targetable ? ` data-target-id="${esc(player.id)}" type="button" aria-pressed="${selected}"` : ''}`;
            const isActionSource = announced?.playerId === player.id;
            const isActionTarget = announced?.targetId === player.id;
            const status = isOut(player) ? '已出局' : isActionTarget ? '等待知晓' : isActionSource ? '信件已发出' : player.isProtected ? '侍女保护' : player.isCurrentTurn ? '正在行动' : `${player.handCount ?? 0} 张手牌`;
            return `<${tag} class="ll-seat ${player.isCurrentTurn ? 'is-turn' : ''} ${player.isProtected ? 'is-protected' : ''} ${isOut(player) ? 'is-out' : ''} ${targetable ? 'is-targetable' : ''} ${selected ? 'is-selected' : ''} ${isActionSource ? 'is-action-source' : ''} ${isActionTarget ? 'is-action-target' : ''}" ${attrs}>
                <span class="ll-avatar" aria-hidden="true">${esc(player.name?.slice(0, 1) || '客')}</span>
                <span class="ll-seat-copy"><strong>${esc(player.name)}</strong><small>${selected ? '已选择为目标' : status}</small><span class="ll-seat-score" aria-label="${favorCount(player.id)} / ${favorTarget()} 枚爱心筹码"><i aria-hidden="true">♥</i><b>${favorScore(favorCount(player.id))}</b></span></span>
                ${visible ? renderTinyCard(visible, 'll-seat-reveal') : renderCardBack('私密', 'll-hidden-card', '隐藏手牌')}
            </${tag}>`;
        }).join('') || '<span class="ll-empty">等待其他玩家入座</span>';
    }

    function renderEvent(roundEnded, ended) {
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
        const detail = action.result?.privateMessage || action.result?.message || (action.targetId ? `目标：${getName(action.targetId)}` : '行动完成');
        $('event').innerHTML = renderTableAction(action, detail, privateInsight ? privateCard : null);
    }

    function renderTableAction(action, detail, privateCard) {
        const card = { id: action.cardId, value: action.cardId, name: action.cardName };
        const targetName = action.targetId ? getName(action.targetId) : '';
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

    function scheduleActionPresentation() {
        cancelAnimationFrame(actionLayoutFrame);
        layoutActionPresentation();
        actionLayoutFrame = requestAnimationFrame(layoutActionPresentation);
    }

    function layoutActionPresentation() {
        const action = state?.pendingAction || state?.lastAction;
        const card = $('playedCard');
        if (card && action?.actionId === animateActionId) {
            const source = playerAnchor(action.playerId);
            const cardRect = card.getBoundingClientRect();
            const sourceRect = source?.getBoundingClientRect();
            const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
            const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight;
            card.style.setProperty('--ll-action-from-x', `${sourceX - (cardRect.left + cardRect.width / 2)}px`);
            card.style.setProperty('--ll-action-from-y', `${sourceY - (cardRect.top + cardRect.height / 2)}px`);
            void card.offsetWidth;
            card.classList.add('is-entering');
            animateActionId = null;
        }
        updateActionLink();
    }

    function updateActionLink() {
        const link = $('actionLink');
        const announced = state?.pendingAction;
        if (!announced) {
            link.classList.remove('is-visible');
            centeredActionId = null;
            return;
        }

        const source = playerAnchor(announced.playerId);
        const target = playerAnchor(announced.targetId);
        if (!source || !target) {
            link.classList.remove('is-visible');
            return;
        }

        if (centeredActionId !== announced.actionId && target.closest('[data-role="seats"]')) {
            const scroller = $('seats');
            const desired = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
            scroller.scrollTo({ left: Math.max(0, desired), behavior: reducedMotion ? 'auto' : 'smooth' });
            centeredActionId = announced.actionId;
            clearTimeout(actionSettleTimer);
            actionSettleTimer = window.setTimeout(scheduleActionPresentation, reducedMotion ? 0 : 280);
        }

        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = window.innerWidth;
        const height = window.innerHeight;
        const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
        const sourceX = clamp(sourceRect.left + sourceRect.width / 2, 12, width - 12);
        const sourceY = clamp(sourceRect.top + sourceRect.height / 2, 12, height - 12);
        const targetX = clamp(targetRect.left + targetRect.width / 2, 12, width - 12);
        const targetY = clamp(targetRect.top + targetRect.height / 2, 12, height - 12);
        const middleX = (sourceX + targetX) / 2;
        const middleY = (sourceY + targetY) / 2 - Math.min(74, Math.max(24, Math.abs(targetX - sourceX) * .11));
        const path = `M ${sourceX} ${sourceY} Q ${middleX} ${middleY} ${targetX} ${targetY}`;
        link.setAttribute('viewBox', `0 0 ${width} ${height}`);
        $('actionLinkGlow').setAttribute('d', path);
        $('actionLinkStroke').setAttribute('d', path);
        $('actionLinkSeal').setAttribute('cx', String(targetX));
        $('actionLinkSeal').setAttribute('cy', String(targetY));
        link.classList.add('is-visible');
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function scheduleAcknowledgement() {
        clearTimeout(acknowledgementTimer);
        clearTimeout(acknowledgementClock);
        const announced = state?.pendingAction;
        if (!announced) return;

        acknowledgementClock = window.setTimeout(() => {
            if (state?.pendingAction?.actionId === announced.actionId) render();
        }, 250);

        const isTarget = announced.targetId === state.myId;
        const isActor = announced.playerId === state.myId;
        const isHostBackup = state.hostId === state.myId;
        if (!isTarget && !isActor && !isHostBackup) return;
        const fallbackDelay = isTarget ? 40 : isActor ? 650 : 1050;
        const delay = Math.max(0, acknowledgementDeadline - Date.now()) + fallbackDelay;
        acknowledgementTimer = window.setTimeout(() => acknowledgePendingAction(true), delay);
    }

    function acknowledgePendingAction(automatic = false) {
        const announced = state?.pendingAction;
        if (!announced || pendingAction) return;
        if (!automatic && announced.targetId !== state.myId) return;
        pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'acknowledgeAction', actionId: announced.actionId } });
        render();
    }

    function renderDiscards() {
        const entries = state.publicDiscard || [];
        const owners = (state.players || []).filter(player => entries.some(entry => entry.ownerId === player.id));
        $('discards').innerHTML = owners.length ? owners.map(player => {
            const cards = entries.filter(entry => entry.ownerId === player.id);
            const total = cards.reduce((sum, entry) => sum + Number(entry.card?.value || entry.card?.id || 0), 0);
            return `<article class="ll-discard-owner"><header><strong>${esc(player.name)}</strong><span>合计 ${total}</span></header><div>${cards.map(entry => renderDiscardCard(entry)).join('')}</div></article>`;
        }).join('') : '<span class="ll-empty">还没有公开弃牌</span>';
    }

    function renderCommand(me, myTurn, roundEnded, ended) {
        if (ended || roundEnded) {
            const winners = ended ? winnerNames(state.winners, state.winner) : winnerNames(state.roundWinners, state.roundWinner);
            const canStart = !ended && ((state.roundWinners || (state.roundWinner ? [state.roundWinner] : [])).some(player => player.id === state.myId) || state.hostId === state.myId);
            $('command').innerHTML = `<div class="ll-result-dock"><div><span>${ended ? '整场结束' : `第 ${state.round} 轮结束`}</span><strong>${esc(winners || '无人')}${ended ? '赢得情书' : '获得一枚爱心'}</strong></div><div class="ll-scoreboard">${(state.favorTokens || []).map(token => `<span><b>${esc(getName(token.id))}</b><strong class="ll-score-value"><i aria-hidden="true">♥</i>${favorScore(token.count)}</strong></span>`).join('')}</div>${ended ? '<span class="ll-result-note">使用上方“回到大厅”离开本局</span>' : `<button class="ll-primary" data-action="start-next-round" type="button" ${canStart && !pendingAction ? '' : 'disabled'}>${canStart ? '开始下一轮' : '等待胜者或房主'}</button>`}</div>`;
            return;
        }

        const hand = state.myHand || [];
        const selected = selectedCardIndex === null ? null : hand[selectedCardIndex];
        const mustCountess = mustPlayCountessNow();
        const selfIsSource = state.pendingAction?.playerId === state.myId;
        const selfIsTarget = state.pendingAction?.targetId === state.myId;
        $('command').innerHTML = `<div class="ll-command-shell">
            <div class="ll-self-summary ${selfIsSource ? 'is-action-source' : ''} ${selfIsTarget ? 'is-action-target' : ''}" data-player-id="${esc(state.myId)}"><span>${esc(me?.name || '我')}</span><strong class="ll-self-score" aria-label="${favorCount(state.myId)} / ${favorTarget()} 枚爱心筹码"><i aria-hidden="true">♥</i>${favorScore(favorCount(state.myId))}</strong></div>
            <div class="ll-hand" aria-label="你的手牌">${hand.map((card, index) => renderHandCard(card, index, myTurn, mustCountess)).join('') || '<span class="ll-empty">你暂时没有手牌</span>'}</div>
            <div class="ll-action-panel">${renderActionPanel(selected, myTurn, mustCountess, isOut(me))}</div>
        </div>`;
    }

    function renderHandCard(card, index, myTurn, mustCountess) {
        const selected = index === selectedCardIndex;
        const locked = mustCountess && card.id !== 7;
        return `<button class="ll-hand-card ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-card-index="${index}" data-card-id="${card.id}" type="button" aria-pressed="${selected}" ${myTurn && !locked && !pendingAction ? '' : 'disabled'}>
            <span class="ll-card-value">${card.value ?? card.id}</span>
            ${renderPortrait(card, 'll-card-portrait')}
            <span class="ll-card-copy"><strong>${esc(card.name || CARD_NAMES[card.id])}</strong><small>${esc(shortEffect(card.id))}</small></span>
        </button>`;
    }

    function renderActionPanel(card, myTurn, mustCountess, out) {
        if (out) return '<div class="ll-waiting"><strong>你已出局</strong><span>公开弃牌仍可用于记牌。</span></div>';
        if (state.pendingAction) {
            const announced = state.pendingAction;
            const remaining = Math.max(0, Math.ceil((acknowledgementDeadline - Date.now()) / 1000));
            if (announced.targetId === state.myId) {
                const guessText = announced.cardId === 1 && announced.guess ? `对方猜测 ${announced.guess} · ${CARD_NAMES[announced.guess]}` : `${announced.playerName || getName(announced.playerId)} 对你使用了${announced.cardName}`;
                const readyIn = Math.max(0, acknowledgementReadyAt - Date.now());
                const ready = readyIn <= 0;
                return `<div class="ll-response-panel"><span>一封信指向了你</span><strong>${esc(guessText)}</strong><small>${ready ? '点击表示已经知晓；这不是拒绝牌效。' : '先看清中央牌面，随后即可确认。'}</small><button class="ll-primary" data-action="acknowledge-action" type="button" ${pendingAction || !ready ? 'disabled' : ''}>${pendingAction ? '正在回应' : ready ? '揭晓结果' : '信件送达中'}<b>${ready ? (remaining ? `${remaining}s` : '即将继续') : `${Math.max(1, Math.ceil(readyIn / 100) / 10)}s`}</b></button></div>`;
            }
            return `<div class="ll-waiting is-response-wait"><strong>等待 ${esc(announced.targetName || getName(announced.targetId))} 知晓</strong><span>${esc(announced.playerName || getName(announced.playerId))} 打出了${esc(announced.cardName)}，${remaining ? `${remaining} 秒后自动继续` : '即将自动继续'}。</span></div>`;
        }
        if (!myTurn) return `<div class="ll-waiting"><strong>等待 ${esc(state.currentTurnName || '其他玩家')}</strong><span>轮到你时会抽至两张手牌。</span></div>`;
        if (!card) return '<div class="ll-waiting"><strong>选择一张手牌</strong><span>牌面会显示角色效果与可选目标。</span></div>';

        const needsTarget = needsTargetSelection(card);
        const targetName = selectedTargetId ? getName(selectedTargetId) : '';
        const noTargetEffect = NEEDS_TARGET.has(card.id) && !needsTarget;
        const canPlay = canPlaySelected(card, myTurn, mustCountess);
        return `<div class="ll-selected-action"><span>已选 ${card.value ?? card.id} · ${esc(card.name || CARD_NAMES[card.id])}</span><small>${esc(shortEffect(card.id))}</small></div>
            ${needsTarget ? `<div class="ll-target-line"><span>${targetName ? `目标：<b>${esc(targetName)}</b>` : '请选择上方高亮玩家'}</span>${card.id === 5 ? '<button data-action="self-target" type="button">指定自己</button>' : ''}</div>` : ''}
            ${noTargetEffect ? '<div class="ll-inline-note">其他玩家均受保护，此牌可以打出但不会生效。</div>' : ''}
            ${card.id === 1 && needsTarget ? `<button class="ll-guess-trigger" data-action="open-guess" type="button">${selectedGuess ? `猜测 ${selectedGuess} · ${CARD_NAMES[selectedGuess]}` : '选择猜测牌面'}</button>` : ''}
            ${mustCountess ? '<div class="ll-inline-note is-warning">同时持有王子或国王，只能打出伯爵夫人。</div>' : ''}
            <button class="ll-primary" data-action="play" type="button" ${canPlay && !pendingAction ? '' : 'disabled'}>${pendingAction ? '等待服务器确认' : '打出这张牌'}</button>`;
    }

    function renderGuessOverlay(myTurn) {
        const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
        const visible = Boolean(guessOpen && myTurn && card?.id === 1);
        $('guessOverlay').classList.toggle('is-hidden', !visible);
        $('guessOverlay').setAttribute('aria-hidden', String(!visible));
        if (!visible) return;
        $('guessPrompt').textContent = selectedTargetId ? `目标：${getName(selectedTargetId)}。猜中后对方立即出局。` : '不能猜侍卫。选好牌面后，再选择一名对手作为目标。';
        $('guessCards').innerHTML = [2, 3, 4, 5, 6, 7, 8].map(value => `<button class="ll-guess-option ${selectedGuess === value ? 'is-selected' : ''}" data-guess="${value}" type="button" aria-pressed="${selectedGuess === value}"><b>${value}</b>${renderPortrait({ id: value }, 'll-guess-portrait')}<span>${CARD_NAMES[value]}</span></button>`).join('');
        mount.querySelector('[data-action="confirm-guess"]').disabled = !selectedGuess;
    }

    function selectCard(index) {
        const card = state?.myHand?.[index];
        if (!card) return;
        selectedCardIndex = index;
        selectedTargetId = null;
        if (card.id !== 1) selectedGuess = null;
        guessOpen = card.id === 1;
        render();
        if (guessOpen) focusDialog('guessOverlay');
    }

    function selectTarget(playerId) {
        selectedTargetId = playerId;
        const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
        if (card?.id === 1 && !selectedGuess) guessOpen = true;
        render();
        if (guessOpen) focusDialog('guessOverlay');
    }

    function playSelected() {
        const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
        if (!card || pendingAction) return;
        pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'playCard', cardIndex: selectedCardIndex, targetId: selectedTargetId, guess: card.id === 1 ? selectedGuess : null } });
        render();
    }

    function startNextRound() {
        if (pendingAction) return;
        pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'startNextRound' } });
        render();
    }

    function canPlaySelected(card, myTurn, mustCountess) {
        if (!myTurn || !card || (mustCountess && card.id !== 7)) return false;
        const needsTarget = needsTargetSelection(card);
        if (needsTarget && !selectedTargetId) return false;
        if (card.id === 1 && needsTarget && !selectedGuess) return false;
        return true;
    }

    function canTarget(player) {
        const card = selectedCardIndex === null ? null : state?.myHand?.[selectedCardIndex];
        return Boolean(state?.myIsCurrentTurn && card && NEEDS_TARGET.has(card.id) && getTargets(card).some(target => target.id === player.id));
    }

    function getTargets(card) {
        const active = (state?.players || []).filter(player => !isOut(player) && !player.isProtected);
        if (!card) return [];
        return card.id === 5 ? active : active.filter(player => player.id !== state.myId);
    }

    function needsTargetSelection(card) {
        if (!card || !NEEDS_TARGET.has(card.id)) return false;
        if (card.id === 5) return true;
        return getTargets(card).length > 0;
    }

    function normalizeSelection() {
        const hand = state?.myHand || [];
        if (selectedCardIndex !== null && !hand[selectedCardIndex]) clearSelection();
        const card = selectedCardIndex === null ? null : hand[selectedCardIndex];
        if (selectedTargetId && !getTargets(card).some(player => player.id === selectedTargetId)) selectedTargetId = null;
        if (card?.id !== 1) {
            selectedGuess = null;
            guessOpen = false;
        }
    }

    function clearSelection() {
        selectedCardIndex = null;
        selectedTargetId = null;
        selectedGuess = null;
        guessOpen = false;
    }

    function setRulesOpen(open) {
        rulesOpen = open;
        $('rulesOverlay').classList.toggle('is-hidden', !open);
        $('rulesOverlay').setAttribute('aria-hidden', String(!open));
        if (open) focusDialog('rulesOverlay');
    }

    function focusDialog(role) {
        requestAnimationFrame(() => $(role)?.querySelector('.ll-dialog-close')?.focus());
    }

    function renderPortrait(card, className) {
        const value = Number(card?.value ?? card?.id);
        const src = CARD_ART[value];
        const focus = CARD_FOCUS[value] || { x: 50, y: 36 };
        return src ? `<span class="${className}" style="--ll-focus-x:${focus.x}%;--ll-focus-y:${focus.y}%"><img src="${src}" alt="" draggable="false"></span>` : '';
    }

    function renderCardBack(label, className = '', ariaLabel = label) {
        return `<span class="ll-card-back ${className}" role="img" aria-label="${esc(ariaLabel)}"><span class="ll-back-rose" aria-hidden="true"></span><span class="ll-back-envelope" aria-hidden="true"></span><span class="ll-back-seal" aria-hidden="true">♥</span></span>`;
    }

    function renderTinyCard(card, className) {
        const value = Number(card?.value ?? card?.id);
        return `<span class="ll-tiny-card ${className}" title="${esc(card?.name || CARD_NAMES[value] || '未知牌')}">${renderPortrait({ id: value }, 'll-tiny-portrait')}<b>${value || '?'}</b></span>`;
    }

    function renderDiscardCard(entry) {
        const card = entry.card || {};
        const value = Number(card.value ?? card.id);
        const reason = entry.reason === 'prince' ? '王子弃置' : entry.reason === 'eliminated' ? '出局公开' : '已打出';
        return `<span class="ll-discard-card" title="${esc(`${card.name || CARD_NAMES[value] || '未知牌'} · ${reason}`)}">${renderPortrait({ id: value }, 'll-discard-portrait')}<b>${value || '?'}</b></span>`;
    }

    function winnerNames(list, fallback) {
        return (list?.length ? list : fallback ? [fallback] : []).map(player => player.name).join('、');
    }

    function mustPlayCountessNow() {
        const hand = state?.myHand || [];
        return hand.some(card => card.id === 7) && hand.some(card => card.id === 5 || card.id === 6);
    }

    function shortEffect(id) { return CARD_RULES.find(rule => rule.value === Number(id))?.effect || ''; }
    function favorCount(playerId) { return Number((state?.favorTokens || []).find(token => token.id === playerId)?.count || 0); }
    function favorTarget() { return Math.min(Number(state?.targetFavor || 4), 7); }
    function favorScore(count) { return `${Math.min(Number(count) || 0, favorTarget())}/${favorTarget()}`; }
    function isOut(player) { return Boolean(player?.isOut || player?.isEliminated || player?.isAlive === false); }
    function getName(id) { return (state?.players || []).find(player => player.id === id)?.name || '目标玩家'; }
    function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }

    mount.addEventListener('click', event => {
        if (scenePlaying) {
            const sceneAction = event.target.closest('[data-action="skip-scene"]');
            event.preventDefault();
            return sceneAction ? skipScene() : undefined;
        }
        if (event.target === $('rulesOverlay')) return setRulesOpen(false);
        if (event.target === $('guessOverlay')) { guessOpen = false; render(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && !card.disabled) return selectCard(Number(card.dataset.cardIndex));
        const target = event.target.closest('[data-target-id]');
        if (target) return selectTarget(target.dataset.targetId);
        const guess = event.target.closest('[data-guess]');
        if (guess) { selectedGuess = Number(guess.dataset.guess); render(); return; }
        const action = event.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'skip-scene') return skipScene();
        if (action.dataset.action === 'acknowledge-action') return acknowledgePendingAction(false);
        if (action.dataset.action === 'rules') setRulesOpen(true);
        if (action.dataset.action === 'close-rules') setRulesOpen(false);
        if (action.dataset.action === 'close-guess') { guessOpen = false; render(); }
        if (action.dataset.action === 'confirm-guess' && selectedGuess) { guessOpen = false; render(); }
        if (action.dataset.action === 'open-guess') { guessOpen = true; render(); focusDialog('guessOverlay'); }
        if (action.dataset.action === 'self-target') { selectedTargetId = state.myId; render(); }
        if (action.dataset.action === 'play') playSelected();
        if (action.dataset.action === 'start-next-round') startNextRound();
    }, { signal: controller.signal });

    mount.addEventListener('keydown', event => {
        if (scenePlaying) {
            if (event.key === 'Escape') skipScene();
            return;
        }
        if (event.key !== 'Escape') return;
        if (rulesOpen) setRulesOpen(false);
        if (guessOpen) { guessOpen = false; render(); }
    }, { signal: controller.signal });
    window.addEventListener('resize', scheduleActionPresentation, { signal: controller.signal });
    mount.addEventListener('scroll', scheduleActionPresentation, { capture: true, signal: controller.signal });

    return {
        gameType: 'loveletter',
        handleMessage,
        destroy() {
            sceneQueue = [];
            skipScene();
            clearTimeout(actionSettleTimer);
            clearTimeout(acknowledgementTimer);
            clearTimeout(acknowledgementClock);
            cancelAnimationFrame(actionLayoutFrame);
            controller.abort();
            style.remove();
            document.body.classList.remove('is-loveletter-view');
            mount.innerHTML = '';
        },
    };
}
