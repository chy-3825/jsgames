const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const CAMELS = [
    { id: 'red', name: '赤焰', mark: '赤', color: '#cf4d3f' },
    { id: 'blue', name: '海蓝', mark: '蓝', color: '#347f9d' },
    { id: 'green', name: '绿洲', mark: '绿', color: '#56865b' },
    { id: 'yellow', name: '金沙', mark: '金', color: '#d89a2e' },
    { id: 'white', name: '月白', mark: '白', color: '#a5aba8' },
];

const TRACK_LAYOUT = {
    1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [1, 4], 5: [1, 5], 6: [1, 6],
    7: [2, 6], 8: [3, 6], 9: [4, 6], 10: [4, 5], 11: [4, 4], 12: [4, 3],
    13: [4, 2], 14: [4, 1], 15: [3, 1], 16: [2, 1],
};

const MOBILE_TRACK_LAYOUT = {
    1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [1, 4],
    5: [2, 4], 6: [2, 3], 7: [2, 2], 8: [2, 1],
    9: [3, 1], 10: [3, 2], 11: [3, 3], 12: [3, 4],
    13: [4, 4], 14: [4, 3], 15: [4, 2], 16: [4, 1],
};

function camelMeta(id) {
    return CAMELS.find(camel => camel.id === id) || { id, name: id || '未知', mark: '驼', color: '#8e735a' };
}

function camelGlyph(className = '') {
    return `<svg class="${className}" viewBox="0 0 112 68" aria-hidden="true"><path d="M8 49h14l8-15 13-4 7-17c1-3 5-3 7 0l6 12 11-11c2-2 5-1 7 1l8 13 9-1 8 8-5 8-4 19h-8l1-18H68l-2 18h-8l-3-18H39l-6 18h-8l3-20-8 9H8z"></path><circle cx="96" cy="33" r="2"></circle><path class="cm-glyph-saddle" d="M45 28h25l-5 13H42z"></path></svg>`;
}

function finishCardBack(className = '') {
    return `<i class="cm-finish-back ${className}" aria-hidden="true"><span></span><b>终局</b></i>`;
}

function finishBackFan(count, className = '') {
    const visible = Math.min(3, Math.max(0, Number(count) || 0));
    return `<span class="cm-finish-back-fan ${className}" aria-hidden="true">${Array.from({ length: visible }, (_, index) => finishCardBack(`is-${index + 1}`)).join('')}</span>`;
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/camelup/style.css?v=${Date.now()}`;
    document.head.appendChild(style);

    let state = null;
    let interactionSignature = '';
    let actionMode = null;
    let selectedCamel = null;
    let selectedFinishCard = null;
    let selectedOutcome = 'winner';
    let selectedTileType = 'oasis';
    let selectedTilePosition = null;
    let actionPending = false;
    let previousFocus = null;
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let lastPresentationSequence = null;
    let presentationTimer = null;
    let presentationRelease = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    mount.innerHTML = `<section class="camel-app">
        <header class="cm-header">
            <div class="cm-brand"><span class="cm-brand-mark" aria-hidden="true">${camelGlyph('cm-brand-camel')}</span><div><small>沙漠驼队竞速</small><h1>狂野骆驼</h1></div></div>
            <div class="cm-round" data-role="round">等待发令</div>
            <div class="cm-header-actions"><button type="button" data-ui="rules">规则</button><button type="button" data-ui="leave">离开</button></div>
        </header>
        <main class="cm-layout">
            <section class="cm-race-table">
                <section class="cm-status" data-role="status"></section>
                <section class="cm-track" data-role="track"></section>
                <section class="cm-command" data-role="command"></section>
                <section class="cm-last-leg" data-role="history"></section>
            </section>
            <aside class="cm-ledger">
                <section class="cm-panel cm-wallet" data-role="wallet"></section>
                <section class="cm-panel"><header class="cm-panel-title"><span>观赛席</span><small>金币与公开筹码</small></header><div data-role="players"></div></section>
                <section class="cm-panel"><header class="cm-panel-title"><span>赛场记录</span><small>最新在前</small></header><div class="cm-log" data-role="log"></div></section>
            </aside>
        </main>
        <div class="cm-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
            <div class="cm-presentation-shade"></div>
            <svg class="cm-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
            <section class="cm-presentation-stage" data-role="presentationStage"></section>
            <div class="cm-floating-layer" data-role="floatingLayer" aria-hidden="true"></div>
            <button class="cm-presentation-skip" type="button" data-ui="skipPresentation">跳过演出</button>
        </div>
        <div class="cm-overlay is-hidden" data-role="rulesOverlay" role="dialog" aria-modal="true" aria-labelledby="cm-rules-title">
            <article><button class="cm-close" type="button" data-ui="closeRules" aria-label="关闭规则">×</button><span class="cm-kicker">竞赛手册</span><h2 id="cm-rules-title">狂野骆驼规则</h2>
                <ol><li>轮到你时执行一个动作：摇动骰塔、拿一张赛段下注牌、放一张冠军或垫底终局牌，或者放置与移动沙漠板块。</li><li>摇骰者先获得一块金字塔板块，赛段结算时价值 1 金币。移动的骆驼会带走它上方的整叠骆驼。</li><li>绿洲令落脚的骆驼组再前进 1 格并叠在上方；海市蜃楼令其后退 1 格并垫在下方，板块主人获得 1 金币。</li><li>赛段冠军的下注牌按牌面获得 5、3 或 2 金币；第二名每张获得 1 金币，其余每张失去 1 金币。</li><li>终局冠军和垫底分区按放牌顺序结算：正确下注依次获得 8、5、3、2、1 金币，错误下注失去 1 金币。</li><li>沙漠板块不能放在 1 号格、骆驼所在格、已有板块格或其他板块相邻格。第一匹骆驼到达 16 号格立即终局；同格时上层领先。</li></ol>
                <figure class="cm-art-reference"><img src="/assets/bgg/camelup/detail.jpg" alt="狂野骆驼实体赛道、骆驼和下注组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上赛道、骆驼堆与下注牌均按实时状态重绘</figcaption></figure>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const actions = () => state?.availableActions || {};
    const myPlayer = () => state?.players?.find(player => player.id === state.myId);
    const isMyTurn = () => !presentationPlaying && state?.status === 'playing' && state?.currentTurn === state?.myId;

    function signature(next) {
        const camelState = (next.camels || []).map(camel => `${camel.id}:${camel.position}:${camel.order}`).join(',');
        const tiles = Object.entries(next.tiles || {}).map(([position, tile]) => `${position}:${tile.ownerId}:${tile.kind}`).join(',');
        const cards = (next.myRaceCards || []).map(card => card.id).join(',');
        const actionState = Object.entries(next.availableActions || {}).map(([key, value]) => `${key}:${value}`).join(',');
        return [next.status, next.phase, next.leg, next.currentTurn, (next.rolled || []).join(','), camelState, tiles, cards, actionState].join('|');
    }

    function resetInteraction() {
        actionMode = null;
        selectedCamel = null;
        selectedFinishCard = null;
        selectedOutcome = 'winner';
        selectedTileType = 'oasis';
        selectedTilePosition = null;
        actionPending = false;
    }

    function roundSummary() {
        if (state.status === 'ended') return '比赛结束 · 金币结算完成';
        return `第 ${state.leg} 赛段 · 骰塔剩余 ${Math.max(0, 5 - (state.rolled?.length || 0))} 枚`;
    }

    function turnMessage() {
        if (state.status === 'ended') {
            const winners = (state.winners || []).map(player => escapeHtml(player.name)).join('、') || escapeHtml(state.winner?.name || '本局玩家');
            return `${winners}${state.winners?.length > 1 ? '并列' : ''}赢得比赛`;
        }
        return isMyTurn() ? '轮到你选择一项行动' : `等待 ${escapeHtml(state.currentTurnName || '下一位玩家')} 行动`;
    }

    function render() {
        if (!state) return;
        const me = myPlayer();
        const legBetCount = state.myLegBets?.length || 0;
        const overallBetCount = state.myOverallBets?.length || 0;
        $('round').textContent = roundSummary();
        const rolled = new Set(state.rolled || []);
        $('status').innerHTML = `<div class="cm-status-copy"><span class="cm-kicker">${state.status === 'ended' ? '冲线结算' : '当前赛况'}</span><h2>${turnMessage()}</h2><small>${state.status === 'ended' ? '现金最高者获得胜利' : '同格骆驼按堆叠高度决定先后'}</small><div class="cm-self-summary" aria-label="我的策略摘要：${me?.cash ?? 0} 金币，${legBetCount} 张赛段下注，${overallBetCount} 张终局暗注，${state.myPyramidTiles || 0} 块金字塔"><span><b>${me?.cash ?? 0}</b> 金币</span><span><b>${legBetCount}</b> 赛段</span><span><b>${overallBetCount}</b> 暗注</span><span><b>${state.myPyramidTiles || 0}</b> 金字塔</span></div></div><div class="cm-dice-progress"><span>本段骰子</span><div>${CAMELS.map(camel => `<i class="${rolled.has(camel.id) ? 'is-rolled' : ''}" style="--camel:${camel.color}" title="${camel.name}${rolled.has(camel.id) ? '已掷' : '待掷'}">${camel.mark}</i>`).join('')}</div></div>`;
        renderTrack();
        renderCommand();
        renderHistory();
        renderWallet();
        renderPlayers();
        renderLog();
    }

    function validTilePositions() {
        const valid = new Set();
        if (!actions().placeTile || actionMode !== 'placeTile') return valid;
        const occupied = new Set((state.camels || []).map(camel => Number(camel.position)));
        const entries = Object.entries(state.tiles || {}).map(([position, tile]) => [Number(position), tile]);
        const oldPosition = entries.find(([, tile]) => tile.ownerId === state.myId)?.[0];
        for (let position = 2; position <= 16; position += 1) {
            if (occupied.has(position)) continue;
            if (state.tiles?.[position] && position !== oldPosition) continue;
            if (entries.some(([tilePosition]) => tilePosition !== oldPosition && Math.abs(tilePosition - position) <= 1)) continue;
            valid.add(position);
        }
        return valid;
    }

    function renderTrack() {
        const stacks = (state.camels || []).reduce((map, camel) => {
            const position = Math.max(1, Math.min(16, Number(camel.position) || 1));
            (map[position] ||= []).push(camel);
            return map;
        }, {});
        Object.values(stacks).forEach(stack => stack.sort((a, b) => a.order - b.order));
        const valid = validTilePositions();
        const ranking = (state.ranking || []).map((id, index) => {
            const camel = camelMeta(id);
            return `<span class="cm-rank" style="--camel:${camel.color}"><b>${index + 1}</b>${camelGlyph('cm-rank-camel')}<small>${camel.name}</small></span>`;
        }).join('');
        const cells = Array.from({ length: 16 }, (_, index) => {
            const position = index + 1;
            const [row, column] = TRACK_LAYOUT[position];
            const [mobileRow, mobileColumn] = MOBILE_TRACK_LAYOUT[position];
            const stack = stacks[position] || [];
            const tile = state.tiles?.[position];
            const placeable = valid.has(position);
            const selected = selectedTilePosition === position;
            const stackLabel = stack.map(camel => camelMeta(camel.id).name).join('、');
            return `<button class="cm-track-cell ${position === 1 ? 'is-start' : ''} ${position === 16 ? 'is-finish' : ''} ${tile ? 'has-tile' : ''} ${placeable ? 'is-placeable' : ''} ${selected ? 'is-selected' : ''}" type="button" data-track-cell="${position}" style="--row:${row};--column:${column};--mobile-row:${mobileRow};--mobile-column:${mobileColumn}" ${placeable ? `data-track-position="${position}"` : 'disabled'} aria-label="第 ${position} 格${stackLabel ? `，${escapeHtml(stackLabel)}` : ''}${placeable ? '，可放置板块' : ''}">
                <span class="cm-cell-number">${position === 1 ? '起跑 · 1' : position === 16 ? '终点 · 16' : position}</span>
                ${tile ? `<i class="cm-desert-tile ${tile.kind === 'oasis' ? 'is-oasis' : 'is-mirage'}" title="${escapeHtml(tile.ownerName)} 的${tile.kind === 'oasis' ? '绿洲' : '海市蜃楼'}"><b>${tile.kind === 'oasis' ? '+1' : '−1'}</b><small>${tile.kind === 'oasis' ? '绿洲' : '幻境'}</small></i>` : ''}
                <span class="cm-camel-stack">${stack.map((camel, stackIndex) => {
                    const meta = camelMeta(camel.id);
                    return `<i class="cm-camel-token" data-camel-id="${meta.id}" style="--camel:${meta.color};--stack:${stackIndex}" title="${meta.name} · 第 ${stackIndex + 1} 层">${camelGlyph('cm-token-camel')}<small>${meta.mark}</small></i>`;
                }).join('')}</span>
            </button>`;
        }).join('');
        $('track').innerHTML = `<header class="cm-track-header"><div><span>环形赛道</span><small>${actionMode === 'placeTile' ? '发光格可放置沙漠板块' : '数字按顺时针方向推进'}</small></div><div class="cm-ranking"><span>当前顺位</span>${ranking}</div></header><div class="cm-board"><div class="cm-board-center"><span class="cm-sun"></span><div class="cm-pyramid" data-stage-anchor="pyramid"><i></i><b>骰塔</b><small>${Math.max(0, 5 - (state.rolled?.length || 0))} 枚待掷</small></div><p>越过终点<br>立即结算</p></div>${cells}</div>`;
    }

    function legPayout(count) {
        return ({ 3: 5, 2: 3, 1: 2 })[Number(count)] || '—';
    }

    function legCardMarkup(camel, count) {
        const interactive = Boolean(actions().betLeg && count > 0 && !actionPending && !presentationPlaying);
        return `<button class="cm-leg-card ${selectedCamel === camel.id ? 'is-selected' : ''} ${count ? '' : 'is-empty'}" type="button" data-leg-anchor="${camel.id}" style="--camel:${camel.color}" ${interactive ? `data-leg-camel="${camel.id}"` : 'disabled'}><span>${count} 张</span>${camelGlyph('cm-card-camel')}<b>${legPayout(count)}</b><strong>${camel.name}</strong><small>${count ? '当前冠军收益' : '本段已取完'}</small></button>`;
    }

    function finishCardMarkup(card) {
        const camel = camelMeta(card.camelId);
        const interactive = Boolean(actions().betOverall && !actionPending && !presentationPlaying);
        const selected = selectedFinishCard === card.id;
        return `<button class="cm-finish-card ${selected ? 'is-selected' : ''}" type="button" style="--camel:${camel.color}" ${interactive ? `data-finish-card="${escapeHtml(card.id)}"` : 'disabled'}><span>终局密押</span><i></i><div>${camelGlyph('cm-finish-camel')}</div><strong>${camel.name}</strong><small>冠军或垫底 · 二选一</small>${selected ? `<em class="cm-outcome-stamp is-${selectedOutcome}">${selectedOutcome === 'winner' ? '冠军' : '垫底'}</em>` : ''}</button>`;
    }

    function actionTabs() {
        const a = actions();
        const tabs = [
            ['rollDie', '骰', '摇骰塔', a.rollDie],
            ['betLeg', '段', '押赛段', a.betLeg],
            ['betOverall', '终', '押终局', a.betOverall],
            ['placeTile', '板', '放板块', a.placeTile],
        ];
        return tabs.map(([mode, mark, label, enabled]) => `<button class="${actionMode === mode ? 'is-active' : ''}" type="button" data-action-mode="${mode}" ${enabled && !actionPending && !presentationPlaying ? '' : 'disabled'}><i>${mark}</i><span>${label}</span></button>`).join('');
    }

    function confirmation(text, detail) {
        return `<div class="cm-confirm"><div><span>待确认</span><strong>${text}</strong><small>${detail}</small></div><div><button type="button" data-ui="cancelSelection" ${presentationPlaying ? 'disabled' : ''}>取消</button><button class="cm-primary" type="button" data-ui="confirmAction" ${actionPending || presentationPlaying ? 'disabled' : ''}>${actionPending ? '正在提交…' : '确认行动'}</button></div></div>`;
    }

    function commandWorkspace() {
        if (!isMyTurn()) return `<div class="cm-waiting"><i></i><div><strong>${state.status === 'ended' ? '本局已经结算' : '暂时收起策略'}</strong><small>${state.status === 'ended' ? '可在右侧查看最终金币与胜者。' : `当前由 ${escapeHtml(state.currentTurnName || '其他玩家')} 行动，你仍可查看自己的下注牌。`}</small></div></div>`;
        if (!actionMode) return '<div class="cm-waiting is-ready"><i></i><div><strong>选择本回合唯一行动</strong><small>也可以直接点击下方的赛段牌或终局牌开始下注。</small></div></div>';
        if (actionMode === 'rollDie') return confirmation('摇动金字塔骰塔', '随机决定一匹尚未移动的骆驼及其 1–3 格步数，并获得 1 块金字塔板块。');
        if (actionMode === 'betLeg') {
            if (!selectedCamel) return '<div class="cm-prompt"><b>押赛段</b><span>点击下方任意一张仍有库存的赛段牌。</span></div>';
            const camel = camelMeta(selectedCamel);
            const count = Number(state.legTiles?.[selectedCamel] || 0);
            return confirmation(`押注 ${camel.name} 赢得本赛段`, `拿取当前价值 ${legPayout(count)} 金币的顶牌；若它最终第二名则获得 1 金币，否则失去 1 金币。`);
        }
        if (actionMode === 'betOverall') {
            const outcomes = `<div class="cm-outcome-toggle"><button class="${selectedOutcome === 'winner' ? 'is-active' : ''}" type="button" data-outcome="winner">押冠军</button><button class="${selectedOutcome === 'loser' ? 'is-active' : ''}" type="button" data-outcome="loser">押垫底</button></div>`;
            if (!selectedFinishCard) return `<div class="cm-prompt"><div><b>押全场终局</b><span>先决定冠军或垫底，再点击一张私密终局牌。</span></div>${outcomes}</div>`;
            const card = (state.myRaceCards || []).find(item => item.id === selectedFinishCard);
            const camel = camelMeta(card?.camelId);
            const order = Number(state.overallBetPiles?.[selectedOutcome] || 0) + 1;
            return `${outcomes}${confirmation(`押 ${camel.name}${selectedOutcome === 'winner' ? '夺冠' : '垫底'}`, `将作为${selectedOutcome === 'winner' ? '冠军' : '垫底'}区第 ${order} 张牌面朝下放入，放下后不能收回。错误牌不占用 8/5/3/2/1 的正确奖励位。`)}`;
        }
        const types = `<div class="cm-tile-types"><button class="${selectedTileType === 'oasis' ? 'is-active' : ''}" type="button" data-tile-type="oasis"><i>+1</i><span>绿洲</span></button><button class="${selectedTileType === 'mirage' ? 'is-active' : ''}" type="button" data-tile-type="mirage"><i>−1</i><span>海市蜃楼</span></button></div>`;
        if (!selectedTilePosition) return `<div class="cm-prompt"><div><b>布置沙漠板块</b><span>选择板块正反面，再点击赛道上发光的合法位置。</span></div>${types}</div>`;
        return `${types}${confirmation(`在 ${selectedTilePosition} 号格放置${selectedTileType === 'oasis' ? '绿洲' : '海市蜃楼'}`, `${selectedTileType === 'oasis' ? '经过的骆驼组再前进 1 格并叠到上方。' : '经过的骆驼组后退 1 格并垫到下方。'}板块触发时你获得 1 金币。`)}`;
    }

    function renderCommand() {
        const legCards = CAMELS.map(camel => legCardMarkup(camel, Number(state.legTiles?.[camel.id] || 0))).join('');
        const finishCards = (state.myRaceCards || []).map(finishCardMarkup).join('') || '<p class="cm-empty-cards">五张终局牌均已放置。</p>';
        const pileCounts = state.overallBetPiles || { winner: 0, loser: 0 };
        const publicPiles = `<div class="cm-secret-piles" aria-label="终局暗注区：冠军 ${pileCounts.winner || 0} 张，垫底 ${pileCounts.loser || 0} 张"><span>已提交暗注</span><div data-overall-pile="winner"><small>冠军</small>${finishBackFan(pileCounts.winner, 'is-public')}<b>${pileCounts.winner || 0}</b></div><div data-overall-pile="loser"><small>垫底</small>${finishBackFan(pileCounts.loser, 'is-public')}<b>${pileCounts.loser || 0}</b></div></div>`;
        $('command').innerHTML = `<header><div><span class="cm-kicker">策略帐篷</span><h3>${isMyTurn() ? '你的回合' : '等待行动'}</h3></div><small>每回合只执行一项</small></header><nav class="cm-action-tabs" aria-label="选择行动">${actionTabs()}</nav><div class="cm-command-workspace">${commandWorkspace()}</div><div class="cm-bet-shelves"><section><header><div><span>赛段下注牌</span><small>冠军按牌面，第二名 +1，其余 −1</small></div><b>公开</b></header><div class="cm-leg-cards">${legCards}</div><small class="cm-swipe-hint">左右滑动查看全部赛段牌 →</small></section><section><header><div><span>我的终局牌</span><small>每个颜色只有一张，已放牌不公开颜色</small></div><b>私密</b></header><div class="cm-finish-cards">${finishCards}</div><small class="cm-swipe-hint">左右滑动查看全部终局牌 →</small>${publicPiles}</section></div>`;
    }

    function renderHistory() {
        if (!state.lastLeg) {
            $('history').innerHTML = '<span>首个赛段进行中</span><small>五枚骰子全部掷出后自动结算下注与金字塔板块。</small>';
            return;
        }
        $('history').innerHTML = `<span>第 ${state.lastLeg.leg} 赛段结果</span><div>${state.lastLeg.ranking.map((id, index) => {
            const camel = camelMeta(id);
            return `<b style="--camel:${camel.color}"><i>${index + 1}</i>${camel.name}</b>`;
        }).join('')}</div>`;
    }

    function renderWallet() {
        const player = myPlayer();
        const legBets = state.myLegBets || [];
        const overallBets = state.myOverallBets || [];
        $('wallet').innerHTML = `<span class="cm-kicker">我的钱袋</span><div class="cm-cash"><strong>${player?.cash ?? 0}</strong><small>金币</small><i>${state.myPyramidTiles || 0} 块金字塔</i></div><div class="cm-my-bets"><span>已下注</span>${legBets.length || overallBets.length ? `<div>${legBets.map(bet => { const camel = camelMeta(bet.camelId); return `<b style="--camel:${camel.color}">${camel.mark} · 赛段 ${bet.payout}</b>`; }).join('')}${overallBets.map(bet => { const camel = camelMeta(bet.camelId); return `<b style="--camel:${camel.color}">${camel.mark} · ${bet.outcome === 'loser' ? '垫底' : '冠军'}</b>`; }).join('')}</div>` : '<small>尚未持有下注牌</small>'}</div>`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map(player => {
            const isMe = player.id === state.myId;
            return `<article class="cm-player ${isMe ? 'is-me' : ''} ${player.id === state.currentTurn && state.status !== 'ended' ? 'is-current' : ''} ${player.isOnline === false ? 'is-away' : ''}" data-player-id="${escapeHtml(player.id)}" style="--player:${escapeHtml(player.color || '#8c755d')}"><i>${escapeHtml(player.name?.slice(0, 1) || '客')}</i><div><strong>${escapeHtml(player.name)}${isMe ? '<em>我</em>' : ''}</strong><small class="cm-player-assets">${isMe ? '' : finishBackFan(player.overallBetCount)}<span>赛段 ${player.legBetCount} · 终局 ${player.overallBetCount || 0} · 金字塔 ${player.pyramidTileCount || 0}</span></small></div><b>${player.cash}<small>币</small></b></article>`;
        }).join('');
    }

    function renderLog() {
        $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') || '<p><i></i><span>等待比赛开始。</span></p>';
    }

    function findData(attribute, value) {
        return [...mount.querySelectorAll(`[${attribute}]`)].find(element => String(element.getAttribute(attribute)) === String(value)) || null;
    }
    function playerAnchor(playerId) { return findData('data-player-id', playerId); }
    function trackAnchor(position) { return findData('data-track-cell', position); }
    function legAnchor(camelId) { return findData('data-leg-anchor', camelId); }
    function overallAnchor(outcome) { return findData('data-overall-pile', outcome); }
    function pyramidAnchor() { return mount.querySelector('[data-stage-anchor="pyramid"]'); }
    function centerOf(element) { if (!element?.isConnected) return null; const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target, .is-presentation-destination').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target', 'is-presentation-destination'));
        $('actionLine')?.classList.remove('is-visible', 'is-money', 'is-secret', 'is-danger');
    }

    function drawActionLine(fromElement, toElement, tone = '') {
        clearPresentationMarks();
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to) return;
        fromElement.classList.add('is-presentation-source'); toElement.classList.add('is-presentation-target');
        const svg = $('actionLine');
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        const line = svg.querySelector('line'); const circle = svg.querySelector('circle');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y); line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
        circle.setAttribute('cx', to.x); circle.setAttribute('cy', to.y);
        svg.classList.toggle('is-money', tone === 'money'); svg.classList.toggle('is-secret', tone === 'secret'); svg.classList.toggle('is-danger', tone === 'danger');
        requestAnimationFrame(() => svg.classList.add('is-visible'));
    }

    function cancelPresentationWait() {
        if (presentationTimer) window.clearTimeout(presentationTimer);
        presentationTimer = null; const release = presentationRelease; presentationRelease = null; release?.(false);
    }
    function presentationWait(duration, token) {
        if (reducedMotion) duration = Math.min(duration, 150);
        if (token !== presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const finish = value => { presentationTimer = null; presentationRelease = null; resolve(value); };
            presentationRelease = finish; presentationTimer = window.setTimeout(() => finish(token === presentationToken), Math.max(0, duration));
        });
    }

    function showPresentation(mode, tone, kicker, title, body = '') {
        const layer = $('presentationLayer'); layer.hidden = false;
        layer.className = `cm-presentation-layer is-${mode || 'compact'} ${tone ? `is-${tone}` : ''}`;
        $('presentationStage').innerHTML = `<header class="cm-event-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></header>${body}`;
    }
    function hidePresentation() {
        const layer = $('presentationLayer'); if (!layer) return;
        layer.hidden = true; layer.className = 'cm-presentation-layer'; $('presentationStage').innerHTML = ''; $('floatingLayer').innerHTML = ''; clearPresentationMarks();
    }

    function eventPlayer(playerId, name, detail = '') {
        const player = state?.players?.find(candidate => candidate.id === playerId);
        return `<span class="cm-event-player" style="--player:${escapeHtml(player?.color || '#8c755d')}"><i>${escapeHtml((name || player?.name || '客').slice(0, 1))}</i><b>${escapeHtml(name || player?.name || '玩家')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
    }
    function eventCamel(camel, detail = '') {
        const meta = camelMeta(camel?.id);
        return `<span class="cm-event-camel" style="--camel:${meta.color}">${camelGlyph('cm-event-camel-glyph')}<b>${escapeHtml(meta.name)}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
    }
    function eventLegCard(camel, payout) {
        const meta = camelMeta(camel?.id);
        return `<span class="cm-event-leg-card" style="--camel:${meta.color}">${camelGlyph('cm-event-card-camel')}<b>${payout}</b><small>${escapeHtml(meta.name)}·赛段</small></span>`;
    }
    function eventFinishCard(camelId = null, outcome = 'winner', faceDown = true) {
        if (faceDown || !camelId) return `<span class="cm-event-finish-back">${finishCardBack('is-event')}<small>${outcome === 'loser' ? '垫底区' : '冠军区'}</small></span>`;
        const meta = camelMeta(camelId);
        return `<span class="cm-event-finish-face" style="--camel:${meta.color}">${camelGlyph('cm-event-card-camel')}<b>${escapeHtml(meta.name)}</b><small>${outcome === 'loser' ? '垫底' : '冠军'}</small></span>`;
    }
    function eventTile(kind, position = '') { return `<span class="cm-event-tile is-${kind}"><b>${kind === 'oasis' ? '+1' : '−1'}</b><small>${kind === 'oasis' ? '绿洲' : '海市蜃楼'}${position ? `·${position} 号格` : ''}</small></span>`; }

    async function animateFloating(fromElement, toElement, className, html, token, duration = 620) {
        const from = centerOf(fromElement); const to = centerOf(toElement);
        if (!from || !to) return presentationWait(220, token);
        const ghost = document.createElement('div'); ghost.className = className; ghost.style.left = `${from.x}px`; ghost.style.top = `${from.y}px`; ghost.innerHTML = html;
        $('floatingLayer').appendChild(ghost); ghost.getBoundingClientRect();
        ghost.style.transform = `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) rotate(-2deg)`;
        const continued = await presentationWait(duration, token); ghost.remove(); return continued;
    }

    async function animateCamelStack(event, token) {
        const from = trackAnchor(event.from); const to = trackAnchor(event.to);
        const camelIds = (event.movingCamels || []).map(camel => camel.id);
        camelIds.forEach(id => findData('data-camel-id', id)?.classList.add('is-presentation-destination'));
        const markup = `<span class="cm-floating-camel-stack">${(event.movingCamels || []).map((camel, index) => { const meta = camelMeta(camel.id); return `<i style="--camel:${meta.color};--stack:${index}">${camelGlyph('cm-floating-camel')}<small>${meta.mark}</small></i>`; }).join('')}</span>`;
        const continued = await animateFloating(from, to, 'cm-floating-camels', markup, token, 720);
        camelIds.forEach(id => findData('data-camel-id', id)?.classList.remove('is-presentation-destination'));
        return continued;
    }

    async function playDieRevealed(event, token) {
        const meta = camelMeta(event.camel?.id);
        showPresentation('compact', 'dice', '骰塔开启', `${event.actorName}掷出 ${meta.name}·${event.steps} 格`, `<div class="cm-event-die" style="--camel:${meta.color}"><i>${meta.mark}</i><b>${event.steps}</b><small>获得 1 块金字塔牌</small></div>`);
        drawActionLine(playerAnchor(event.actorId), pyramidAnchor());
        await presentationWait(720, token);
    }

    async function playCamelMoved(event, token) {
        const count = event.movingCamels?.length || 1;
        showPresentation('compact', 'move', '驼队移动', `${event.camel?.name}前进 ${event.steps} 格`, `<div class="cm-event-route">${eventCamel(event.camel, count > 1 ? `携带上方 ${count - 1} 匹` : '单独移动')}<i>${event.from}</i><b>→</b><i>${event.to}</i></div>`);
        drawActionLine(trackAnchor(event.from), trackAnchor(event.to));
        if (!await animateCamelStack(event, token)) return;
        await presentationWait(260, token);
    }

    async function playTileTriggered(event, token) {
        showPresentation('medium', 'tile', event.tileType === 'oasis' ? '绿洲触发' : '海市蜃楼触发', `${event.camel?.name}${event.tileType === 'oasis' ? '再前进 1 格' : '后退 1 格'}`, `<div class="cm-event-route">${eventTile(event.tileType, event.tilePosition)}<i>${event.from}</i><b>→</b><i>${event.to}</i></div><p class="cm-event-note">${escapeHtml(event.ownerName || '板块主人')}${event.reward ? '获得 1 金币' : ''}</p>`);
        drawActionLine(trackAnchor(event.from), trackAnchor(event.to));
        if (!await animateCamelStack(event, token)) return;
        if (event.reward && playerAnchor(event.ownerId)) { drawActionLine(trackAnchor(event.tilePosition), playerAnchor(event.ownerId), 'money'); await presentationWait(520, token); }
    }

    async function playLegBet(event, token) {
        showPresentation('compact', 'bet', '赛段下注', `${event.actorName}押注${event.camel.name}`, `<div class="cm-event-transaction">${eventLegCard(event.camel, event.payout)}<i>→</i>${eventPlayer(event.actorId, event.actorName, `当前牌面 ${event.payout}`)}</div><p class="cm-event-note">该颜色牌架还剩 ${event.remaining} 张</p>`);
        drawActionLine(playerAnchor(event.actorId), legAnchor(event.camel.id));
        if (!await animateFloating(legAnchor(event.camel.id), playerAnchor(event.actorId), 'cm-floating-card', eventLegCard(event.camel, event.payout), token)) return;
        await presentationWait(280, token);
    }

    async function playOverallBet(event, token) {
        const own = event.private;
        const face = own ? eventFinishCard(own.camelId, event.outcome, false) : eventFinishCard(null, event.outcome, true);
        showPresentation('compact', 'secret', '终局暗注', `${event.actorName}放入${event.outcome === 'loser' ? '垫底' : '冠军'}区`, `${face}<p class="cm-event-note">第 ${event.order} 张入堆·牌面保密至冲线</p>`);
        drawActionLine(playerAnchor(event.actorId), overallAnchor(event.outcome), 'secret');
        if (!await animateFloating(playerAnchor(event.actorId), overallAnchor(event.outcome), 'cm-floating-card', eventFinishCard(null, event.outcome, true), token)) return;
        await presentationWait(280, token);
    }

    async function playTilePlaced(event, token) {
        showPresentation('compact', 'tile', event.moved ? '移动沙漠板块' : '布置沙漠板块', `${event.actorName}选择 ${event.position} 号格`, `${eventTile(event.tileType, event.position)}<p class="cm-event-note">${event.tileType === 'oasis' ? '驼队经过时前进并叠到上方' : '驼队经过时后退并垫到下方'}</p>`);
        drawActionLine(playerAnchor(event.actorId), trackAnchor(event.position));
        await animateFloating(event.moved ? trackAnchor(event.previousPosition) : playerAnchor(event.actorId), trackAnchor(event.position), 'cm-floating-tile', eventTile(event.tileType), token);
    }

    async function playLegSettlement(event, token) {
        const ranking = (event.ranking || []).map((camel, index) => `<span style="--camel:${camelMeta(camel.id).color}"><i>${index + 1}</i>${camelGlyph('cm-settlement-camel')}<b>${escapeHtml(camel.name)}</b></span>`).join('');
        const results = (event.playerResults || []).map(player => `<span class="${player.change > 0 ? 'is-profit' : player.change < 0 ? 'is-loss' : ''}">${eventPlayer(player.playerId, player.playerName)}<small>${player.bets.length ? player.bets.map(bet => `${escapeHtml(bet.camelName)} ${bet.reward > 0 ? '+' : ''}${bet.reward}`).join('·') : '无赛段下注'}${player.pyramidReward ? `·金字塔 +${player.pyramidReward}` : ''}</small><b>${player.change > 0 ? '+' : ''}${player.change}</b><em>${player.cashBefore} → ${player.cashAfter}</em></span>`).join('');
        showPresentation('major', 'settlement', event.final ? '最后赛段结算' : `第 ${event.leg} 赛段结束`, '驼队顺位与金币结算', `<div class="cm-leg-ranking">${ranking}</div><div class="cm-player-settlements">${results}</div>`);
        await presentationWait(event.final ? 2300 : 2000, token);
    }

    async function playRaceFinished(event, token) {
        showPresentation('major', 'finish', '骆驼冲线', `${event.camel?.name || '领先骆驼'}越过终点`, `<div class="cm-finish-hero">${eventCamel(event.camel, '全场比赛结束')}<b>FINISH</b></div><p class="cm-event-note">先结算最后赛段，再逐张揭开终局暗注</p>`);
        drawActionLine(trackAnchor(16), $('presentationStage'), 'danger');
        await presentationWait(1500, token);
    }

    async function playOverallReveals(event, token) {
        const groups = [
            { key: 'winner', label: '冠军暗注', bets: event.winnerBets || [] },
            { key: 'loser', label: '垫底暗注', bets: event.loserBets || [] },
        ];
        const groupMarkup = groups.map(group => `<section data-reveal-group="${group.key}"><header>${group.label}<small>${group.bets.length} 张</small></header><div>${group.bets.map((bet, index) => `<span class="cm-reveal-row" data-reveal-index="${group.key}-${index}">${eventFinishCard(bet.camelId, group.key, false)}${eventPlayer(bet.playerId, bet.playerName)}<b class="${bet.correct ? 'is-correct' : 'is-wrong'}">${bet.correct ? '命中' : '失败'}</b><em>${bet.reward > 0 ? '+' : ''}${bet.reward}</em></span>`).join('') || '<p>本区没有暗注</p>'}</div></section>`).join('');
        showPresentation('major', 'reveal', '终局开牌', '冠军与垫底暗注', `<div class="cm-overall-reveals">${groupMarkup}</div>`);
        for (const group of groups) {
            for (let index = 0; index < group.bets.length; index += 1) {
                if (token !== presentationToken) return;
                const row = $('presentationStage').querySelector(`[data-reveal-index="${group.key}-${index}"]`); row?.classList.add('is-revealed'); row?.scrollIntoView?.({ block: 'nearest' });
                if (!await presentationWait(260, token)) return;
            }
            if (!await presentationWait(280, token)) return;
        }
        await presentationWait(650, token);
    }

    async function playFinalSettlement(event, token) {
        const winners = new Set(event.winnerIds || []);
        const rows = (event.standings || []).map(player => `<span class="${winners.has(player.id) ? 'is-winner' : ''}"><i>${player.rank}</i><b>${escapeHtml(player.name)}</b><em>${player.cash} 金币</em></span>`).join('');
        const winnerNames = (event.standings || []).filter(player => winners.has(player.id)).map(player => player.name).join('、');
        showPresentation('major', 'final', '沙漠大赛落幕', '最终金币排名', `<div class="cm-final-ranking">${rows}</div><p class="cm-final-winner">${escapeHtml(winnerNames || '本局玩家')}${winners.size > 1 ? '并列' : ''}赢得比赛</p>`);
        await presentationWait(2700, token);
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== presentationToken) return;
        if (event.kind === 'dieRevealed') return playDieRevealed(event, token);
        if (event.kind === 'camelMoved') return playCamelMoved(event, token);
        if (event.kind === 'desertTileTriggered') return playTileTriggered(event, token);
        if (event.kind === 'legBetTaken') return playLegBet(event, token);
        if (event.kind === 'overallBetPlaced') return playOverallBet(event, token);
        if (event.kind === 'desertTilePlaced') return playTilePlaced(event, token);
        if (event.kind === 'legSettlement') return playLegSettlement(event, token);
        if (event.kind === 'raceFinished') return playRaceFinished(event, token);
        if (event.kind === 'overallBetsRevealed') return playOverallReveals(event, token);
        if (event.kind === 'finalSettlement') return playFinalSettlement(event, token);
        if (event.kind === 'legStarted') {
            showPresentation('medium', 'start', '新赛段发令', `第 ${event.leg} 赛段开始`, `<p class="cm-event-note">${escapeHtml(event.currentPlayerName || '下一位玩家')}首先行动·骰子、下注牌与板块已重置</p>`);
            await presentationWait(850, token);
        }
    }

    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true; resetInteraction(); const token = ++presentationToken; render();
        while (presentationQueue.length && token === presentationToken) {
            const presentation = presentationQueue.shift();
            for (const event of presentation.events || []) { if (token !== presentationToken) break; await playPresentationEvent(event, token); clearPresentationMarks(); }
        }
        if (token !== presentationToken) return;
        hidePresentation(); presentationPlaying = false; render();
    }
    function skipPresentation() { presentationQueue = []; presentationPlaying = false; presentationToken += 1; cancelPresentationWait(); hidePresentation(); render(); }

    function setActionMode(mode) {
        actionMode = mode;
        selectedCamel = null;
        selectedFinishCard = null;
        selectedTilePosition = null;
        renderTrack();
        renderCommand();
    }

    function actionPayload() {
        if (actionMode === 'rollDie') return { kind: 'rollDie' };
        if (actionMode === 'betLeg' && selectedCamel) return { kind: 'betLeg', camelId: selectedCamel };
        if (actionMode === 'betOverall' && selectedFinishCard) return { kind: 'betOverall', cardId: selectedFinishCard, outcome: selectedOutcome };
        if (actionMode === 'placeTile' && selectedTilePosition) return { kind: 'placeTile', position: selectedTilePosition, tileType: selectedTileType };
        return null;
    }

    function openRules() {
        previousFocus = document.activeElement;
        $('rulesOverlay').classList.remove('is-hidden');
        requestAnimationFrame(() => mount.querySelector('[data-ui="closeRules"]')?.focus());
    }

    function closeRules() {
        $('rulesOverlay').classList.add('is-hidden');
        previousFocus?.focus?.();
        previousFocus = null;
    }

    function onClick(event) {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'skipPresentation') { skipPresentation(); return; }
        if (presentationPlaying) return;
        if (ui === 'leave') { leaveRoom?.(); return; }
        if (ui === 'rules') { openRules(); return; }
        if (ui === 'closeRules' || event.target === $('rulesOverlay')) { closeRules(); return; }
        if (ui === 'cancelSelection') { resetInteraction(); renderTrack(); renderCommand(); return; }
        if (ui === 'confirmAction') {
            const action = actionPayload();
            if (!action || actionPending) return;
            actionPending = true;
            renderCommand();
            send({ type: 'gameAction', action });
            return;
        }

        const modeButton = event.target.closest('[data-action-mode]');
        if (modeButton && !modeButton.disabled) { setActionMode(modeButton.dataset.actionMode); return; }

        const legCard = event.target.closest('[data-leg-camel]');
        if (legCard && !legCard.disabled) {
            actionMode = 'betLeg';
            selectedCamel = legCard.dataset.legCamel;
            selectedFinishCard = null;
            selectedTilePosition = null;
            renderTrack(); renderCommand(); return;
        }

        const finishCard = event.target.closest('[data-finish-card]');
        if (finishCard && !finishCard.disabled) {
            actionMode = 'betOverall';
            selectedFinishCard = finishCard.dataset.finishCard;
            selectedCamel = null;
            selectedTilePosition = null;
            renderTrack(); renderCommand(); return;
        }

        const outcome = event.target.closest('[data-outcome]')?.dataset.outcome;
        if (outcome) { selectedOutcome = outcome; renderCommand(); return; }
        const tileType = event.target.closest('[data-tile-type]')?.dataset.tileType;
        if (tileType) { selectedTileType = tileType; renderCommand(); return; }
        const trackPosition = event.target.closest('[data-track-position]')?.dataset.trackPosition;
        if (trackPosition) { selectedTilePosition = Number(trackPosition); renderTrack(); renderCommand(); }
    }

    function onKeydown(event) {
        if (presentationPlaying) return;
        if (event.key !== 'Escape') return;
        if (!$('rulesOverlay').classList.contains('is-hidden')) closeRules();
        else if (actionMode) { resetInteraction(); renderTrack(); renderCommand(); }
    }

    function handleMessage(message) {
        if (message.state) {
            const firstState = !state;
            const nextSignature = signature(message.state);
            state = message.state;
            if (nextSignature !== interactionSignature) resetInteraction();
            interactionSignature = nextSignature;
            render();
            const presentation = message.state.presentation;
            if (presentation?.resolved && presentation.sequence !== lastPresentationSequence) {
                lastPresentationSequence = presentation.sequence;
                if (!firstState && presentation.events?.length) { presentationQueue.push(presentation); void drainPresentations(); }
            }
        }
        if (message.type === 'error') {
            actionPending = false;
            addLog(message.message || '操作失败', 'error');
            if (state) renderCommand();
        }
    }

    mount.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);

    return {
        gameType: 'camelup',
        handleMessage,
        destroy() {
            presentationToken += 1; presentationQueue = []; cancelPresentationWait(); hidePresentation();
            mount.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeydown);
            style.remove();
            mount.innerHTML = '';
        },
    };
}
