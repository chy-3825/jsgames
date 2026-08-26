const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const casinoNames = ['黄金宫', '海市蜃楼', '星光金字塔', '皇家塔楼', '赤沙宫', '霓虹穹顶'];
const diePips = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
};

function renderDie(face, className = '') {
    const activePips = new Set(diePips[face] || []);
    const pips = Array.from({ length: 9 }, (_, index) => `<i class="${activePips.has(index + 1) ? 'is-pip' : ''}"></i>`).join('');
    return `<span class="lv-die face-${Number(face)} ${className}" aria-label="${Number(face)}点">${pips}</span>`;
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/lasvegas/style.css?v=${Date.now()}`;
    document.head.appendChild(style);

    let state = null;
    let selectedFace = null;
    let rulesTrigger = null;
    let bodyOverflow = '';
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let lastPresentationSequence = null;
    let waitTimer = null;
    let releaseWait = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    mount.innerHTML = `<section class="lasvegas-app" data-game-shell>
        <header class="lv-header">
            <div class="lv-brand">
                <span class="lv-brand-art" aria-hidden="true"></span>
                <div class="lv-brand-copy">
                    <small>骰子赌场之夜</small>
                    <h1>拉斯维加斯</h1>
                    <p>把骰子押在最值得争夺的赌场</p>
                </div>
            </div>
            <div class="lv-round-block" aria-label="轮次进度">
                <span class="lv-kicker">轮次进度</span>
                <div class="lv-round-row"><strong data-role="round">等待入场</strong><div class="lv-round-progress" data-role="roundProgress"></div></div>
            </div>
            <div class="lv-header-actions">
                <button class="lv-quiet-button" data-ui="rules" type="button">规则</button>
                <button class="lv-leave-button" data-ui="leave" type="button">离开</button>
            </div>
        </header>

        <main class="lv-layout">
            <aside class="lv-panel lv-seats" aria-label="玩家资金看板">
                <div class="lv-panel-heading">
                    <div><span class="lv-kicker">玩家看板</span><h2>玩家资金</h2></div>
                    <span class="lv-panel-count" data-role="playerCount">--</span>
                </div>
                <div class="lv-seats-list" data-role="players"></div>
            </aside>

            <section class="lv-table" aria-label="六家赌场主桌">
                <header class="lv-table-head">
                    <div><span class="lv-kicker">六家赌场</span><h2>今晚的赌桌</h2></div>
                    <div class="lv-turn-status" data-role="turnStatus"><i></i><span data-role="turn">等待游戏状态</span></div>
                </header>
                <div class="lv-table-subline"><span data-role="tableHint">每一家赌场都在等待第一枚骰子。</span><span data-role="tableMeta">4 轮 · 54 张钞票</span></div>

                <section class="lv-command" aria-live="polite">
                    <div class="lv-roll-panel">
                        <span class="lv-kicker">我的骰盘</span>
                        <div class="lv-roll-heading"><strong data-role="diceCount">—</strong><span data-role="diceLabel">未掷骰</span></div>
                        <div class="lv-dice" data-role="dice">—</div>
                        <small data-role="hint">轮到谁，谁来掷骰子</small>
                    </div>
                    <div class="lv-action-panel">
                        <div class="lv-face-wrap">
                            <div class="lv-action-heading"><span class="lv-kicker">选择赌场</span><small data-role="actionLabel">掷骰后选择一个点数</small></div>
                            <div class="lv-face-actions" data-role="faces"></div>
                        </div>
                        <button class="lv-roll" data-ui="roll" type="button"><span class="lv-roll-mark">↻</span><strong>掷骰子</strong><small>掷出全部剩余骰子</small></button>
                        <div class="lv-place-confirm" data-role="placeConfirm"></div>
                    </div>
                </section>

                <div class="lv-casinos" data-role="casinos"></div>

                <section class="lv-payout-strip" aria-live="polite">
                    <div><span class="lv-kicker">本轮奖金</span><strong>最近结算</strong></div>
                    <div class="lv-payouts" data-role="payouts"><span class="lv-empty-inline">本轮结束后，领取记录会显示在这里。</span></div>
                    <span class="lv-bank-anchor" data-role="bankAnchor"><small>钞票牌库</small><strong data-role="bankCount">54</strong><em>张</em></span>
                </section>
            </section>

            <aside class="lv-panel lv-log-panel" aria-label="赌场日志">
                <div class="lv-panel-heading"><div><span class="lv-kicker">赌场记录</span><h2>行动记录</h2></div><span class="lv-panel-count" data-role="logCount">0</span></div>
                <div class="lv-log" data-role="log"></div>
            </aside>
        </main>

        <div class="lv-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
            <div class="lv-presentation-shade"></div>
            <svg class="lv-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
            <section class="lv-presentation-scene" data-role="presentationScene"></section>
            <button class="lv-presentation-skip" data-ui="skipPresentation" type="button">跳过演出</button>
        </div>

        <div class="lv-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
            <article class="lv-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="lv-rules-title">
                <button class="lv-dialog-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                <span class="lv-kicker">玩法说明</span>
                <h2 id="lv-rules-title">拉斯维加斯规则</h2>
                <ol>
                    <li>每轮每位玩家轮流掷出所有尚未放置的 8 枚骰子，并把同一点数的全部骰子放入对应赌场。</li>
                    <li>六家赌场各放入总额至少 50 万的钞票；4 轮结束后现金最多者获胜，现金相同先比较钞票张数，仍相同则共享胜利。</li>
                    <li>每家赌场先比较骰子数量；并列最高者全部不领奖，下一位非并列玩家拿最高剩余钞票。</li>
                    <li>两人局加入一组中立骰子；中立骰子也参与多数比较，但钞票不会给中立方。</li>
                </ol>
                <figure class="lv-art-reference"><img src="/assets/bgg/lasvegas/detail.jpg" alt="拉斯维加斯赌场牌、钞票与骰子组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上赌场、骰子和奖金由实时状态绘制</figcaption></figure>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const overlay = $('rulesOverlay');

    function currentPlayer() {
        return state?.players?.find(player => player.id === state.currentTurn) || null;
    }

    function allParticipants() {
        return [...(state?.players || []), ...(state?.neutral ? [state.neutral] : [])];
    }

    function playerById(id) {
        return allParticipants().find(player => player.id === id);
    }

    function playerTone(player) {
        return player?.color || 'neutral';
    }

    function renderRoundTrack() {
        const isEnded = state.status === 'ended';
        const round = Math.max(0, Number(state.round) || 0);
        $('round').textContent = isEnded ? '游戏结束' : round ? `第 ${round} / ${state.maxRounds} 轮` : '等待入场';
        $('roundProgress').innerHTML = Array.from({ length: state.maxRounds || 4 }, (_, index) => `<i class="${index < round ? 'is-complete' : ''} ${isEnded && index === (state.maxRounds || 4) - 1 ? 'is-final' : ''}"></i>`).join('');
    }

    function render() {
        if (!state) return;
        const current = currentPlayer();
        const isEnded = state.status === 'ended';
        const placeable = new Set(state.availableActions?.canPlaceFaces || []);
        if (!placeable.has(selectedFace)) selectedFace = null;
        renderRoundTrack();

        const turnStatus = $('turnStatus');
        turnStatus.className = `lv-turn-status ${isEnded ? 'is-ended' : state.myTurn ? 'is-mine' : ''}`;
        $('turn').textContent = isEnded
            ? `${state.winners?.map(winner => winner.name).join('、') || '结算完成'} 获胜`
            : state.myTurn ? '轮到你' : `等待 ${current?.name || '其他玩家'}`;
        $('tableHint').textContent = isEnded
            ? '四轮结算完成，所有赌场已经封存。'
            : state.myTurn
                ? state.availableActions?.canRoll ? '先掷出当前剩余骰子，再选择一个点数。' : '点选赌场或骰面，核对后确认放置。'
                : `等待 ${current?.name || '其他玩家'} 完成本回合。`;
        $('tableMeta').textContent = `${state.maxRounds || 4} 轮 · 6 家赌场 · 牌库 ${state.moneyDeckCount ?? '—'} 张`;
        $('bankCount').textContent = String(state.moneyDeckCount ?? '—');

        renderPlayers();
        renderCasinos();
        renderDice();
        renderFaces();
        renderPayouts();
        renderLog();
    }

    function renderPlayers() {
        const players = state.players || [];
        $('playerCount').textContent = `${players.length} 位`;
        $('players').innerHTML = allParticipants().map(player => {
            if (player.isNeutral) {
                return `<article class="lv-seat tone-neutral is-neutral" data-player-id="neutral">
                    <header class="lv-seat-head"><span class="lv-avatar">◎</span><div class="lv-seat-name"><strong>中立骰子</strong><small>共享骰池 · 不领取现金</small></div><span class="lv-neutral-tag">公共</span></header>
                    <div class="lv-seat-stats"><span><b>${player.diceRemaining || 0}</b><small>待放骰子</small></span><span><b>多数</b><small>参与比较</small></span></div>
                    <div class="lv-seat-progress"><span style="--progress:${Math.min(100, ((player.diceRemaining || 0) / 8) * 100)}%"></span></div>
                </article>`;
            }
            const remainingNeutral = player.neutralDiceRemaining || 0;
            const isCurrent = player.id === state.currentTurn;
            const isMe = player.id === state.myId;
            const progress = Math.min(100, Math.max(0, ((8 - (player.diceRemaining || 0)) / 8) * 100));
            return `<article class="lv-seat tone-${escapeHtml(playerTone(player))} ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}">
                <header class="lv-seat-head"><span class="lv-avatar">${escapeHtml(String(player.name || '?').slice(0, 1))}</span><div class="lv-seat-name"><strong>${escapeHtml(player.name)}${isMe ? '<em>我</em>' : ''}</strong><small>${isCurrent ? '正在行动' : player.isOnline === false ? '已离线' : '已入座'}</small></div><div class="lv-cash"><b>${player.money || 0}</b><small>万</small></div></header>
                <div class="lv-seat-stats"><span><b>${player.diceRemaining || 0}</b><small>自有骰</small></span><span><b>${remainingNeutral}</b><small>中立骰</small></span><span><b>${player.placedCount || 0}</b><small>已放置</small></span></div>
                <div class="lv-seat-progress"><span style="--progress:${progress}%"></span></div>
            </article>`;
        }).join('');
    }

    function renderMoney(casino) {
        const money = casino.money || [];
        const total = money.reduce((sum, value) => sum + Number(value || 0), 0);
        const visible = money.slice(0, 4).map((value, index) => `<b class="lv-bill bill-${index} value-${Number(value) || 0}"><span>${escapeHtml(value)}<small>万</small></span><em>${index === 0 ? '头奖' : `第${index + 1}奖`}</em></b>`).join('');
        const more = money.length > 4 ? `<span class="lv-more-bills">+${money.length - 4}</span>` : '';
        return `<div class="lv-money-row"><div class="lv-money-total"><strong>${total}</strong><small>万合计</small></div><div class="lv-bills">${visible || '<span class="lv-no-money">等待钞票</span>'}${more}</div></div>`;
    }

    function renderDiceStacks(casino) {
        const diceEntries = Object.entries(casino.dice || {}).filter(([, count]) => Number(count) > 0);
        if (!diceEntries.length) return '<span class="lv-casino-empty">等待第一枚骰子</span>';
        const countFrequency = diceEntries.reduce((frequency, [, count]) => {
            const safeCount = Number(count) || 0;
            frequency.set(safeCount, (frequency.get(safeCount) || 0) + 1);
            return frequency;
        }, new Map());
        return diceEntries.map(([id, count]) => {
            const player = playerById(id);
            const safeCount = Number(count) || 0;
            const tied = (countFrequency.get(safeCount) || 0) > 1;
            const dice = Array.from({ length: Math.min(safeCount, 8) }, () => renderDie(casino.face, 'lv-table-die')).join('');
            return `<div class="lv-dice-stack tone-${escapeHtml(playerTone(player))} ${tied ? 'is-tied' : ''}" title="${escapeHtml(player?.name || id)}${tied ? '：相同骰子数作废' : ''}"><div class="lv-stack-dice">${dice}</div><strong>${safeCount}</strong><small>${player?.isNeutral ? '中立' : escapeHtml(player?.name || '玩家')}</small>${tied ? '<em>平手作废</em>' : ''}</div>`;
        }).join('');
    }

    function renderCasinos() {
        const placeable = new Set(state.availableActions?.canPlaceFaces || []);
        $('casinos').innerHTML = (state.casinos || []).map(casino => {
            const money = casino.money || [];
            const total = money.reduce((sum, value) => sum + Number(value || 0), 0);
            const available = placeable.has(casino.face);
            const selected = selectedFace === casino.face;
            const rollCount = (state.currentRoll || []).filter(value => Number(value) === casino.face).length;
            return `<article class="lv-casino is-face-${casino.face} ${available ? 'is-target' : ''} ${selected ? 'is-selected' : ''}" data-casino-face="${casino.face}">
                <span class="lv-casino-landmark" aria-hidden="true"><i></i></span>
                <header class="lv-casino-head"><span class="lv-casino-number">${renderDie(casino.face, 'lv-sign-die')}</span><div><strong>${casinoNames[casino.face - 1]}</strong><small>${total ? `${total} 万奖池` : '等待钞票'}</small></div><span class="lv-casino-mark">${selected ? '已选定' : available ? `可放 ${rollCount} 枚` : '赌桌'}</span></header>
                ${renderMoney(casino)}
                <div class="lv-casino-dice"><span class="lv-casino-dice-label">骰子堆</span>${renderDiceStacks(casino)}</div>
                ${available ? `<button class="lv-casino-pick" data-face="${casino.face}" type="button">${selected ? '已选定此赌场' : `选择此赌场 · ${rollCount} 枚`}</button>` : ''}
            </article>`;
        }).join('');
    }

    function renderDice() {
        const roll = state.currentRoll || [];
        const ownRoll = state.currentRollOwn || [];
        const neutralRoll = state.currentRollNeutral || [];
        const actorTone = playerTone(currentPlayer());
        $('diceCount').textContent = roll.length ? `${roll.length} 枚` : '—';
        $('diceLabel').textContent = roll.length ? '本次掷骰' : '未掷骰';
        $('dice').innerHTML = roll.length
            ? `<span class="lv-roll-group tone-${escapeHtml(actorTone)}"><small>自有</small>${ownRoll.map(value => renderDie(value, 'lv-own-die')).join('') || '<em>无</em>'}</span>${neutralRoll.length ? `<span class="lv-roll-group tone-neutral"><small>中立</small>${neutralRoll.map(value => renderDie(value, 'lv-neutral-die')).join('')}</span>` : ''}`
            : '<span class="lv-dice-empty">—</span>';
    }

    function renderFaces() {
        const available = new Set(state.availableActions?.canPlaceFaces || []);
        const canRoll = Boolean(state.availableActions?.canRoll && !presentationPlaying);
        $('faces').innerHTML = [1, 2, 3, 4, 5, 6].map(face => {
            const isAvailable = available.has(face);
            const count = (state.currentRoll || []).filter(value => Number(value) === face).length;
            const selected = selectedFace === face;
            return `<button type="button" data-face="${face}" class="${isAvailable ? 'is-available' : ''} ${selected ? 'is-selected' : ''}" ${isAvailable && !presentationPlaying ? '' : 'disabled'} aria-label="${face}号赌场${isAvailable ? `，预选放置 ${count} 枚骰子` : '，不可选择'}"><span class="lv-face-die">${renderDie(face)}</span><span class="lv-face-name">${face}号</span><small>${isAvailable ? `${count} 枚` : '未掷出'}</small></button>`;
        }).join('');
        const rollButton = mount.querySelector('[data-ui="roll"]');
        rollButton.disabled = !canRoll;
        rollButton.classList.toggle('is-ready', canRoll);
        $('actionLabel').textContent = canRoll ? '准备好后掷出所有剩余骰子' : available.size ? '先预选骰面，再确认放置' : '等待当前回合';
        renderPlaceConfirm();
    }

    function renderPlaceConfirm() {
        const confirm = $('placeConfirm');
        const available = new Set(state.availableActions?.canPlaceFaces || []);
        if (!available.size) {
            confirm.className = 'lv-place-confirm is-idle';
            confirm.innerHTML = `<span>${state.availableActions?.canRoll ? '掷骰后在这里核对放置' : '当前没有可提交的骰面'}</span>`;
            return;
        }
        if (!selectedFace) {
            confirm.className = 'lv-place-confirm is-waiting';
            confirm.innerHTML = '<span class="lv-confirm-mark">?</span><div><strong>请先选择一家赌场</strong><small>可点击骰面，也可直接点击赌场上的选择按钮</small></div>';
            return;
        }
        const ownCount = (state.currentRollOwn || []).filter(value => Number(value) === selectedFace).length;
        const neutralCount = (state.currentRollNeutral || []).filter(value => Number(value) === selectedFace).length;
        const count = ownCount + neutralCount;
        const casino = (state.casinos || []).find(item => item.face === selectedFace);
        const total = (casino?.money || []).reduce((sum, value) => sum + Number(value || 0), 0);
        const projection = projectedPosition(casino, ownCount, neutralCount);
        confirm.className = 'lv-place-confirm is-ready';
        confirm.innerHTML = `${renderDie(selectedFace, 'lv-confirm-die')}<div><strong>已选 ${casinoNames[selectedFace - 1]} <em>${escapeHtml(projection)}</em></strong><small>自有 ${ownCount} 枚${neutralCount ? ` · 中立 ${neutralCount} 枚` : ''}，共放置 ${count} 枚 · 奖池 ${total} 万</small></div><button type="button" data-ui="place" ${presentationPlaying ? 'disabled' : ''}>确认放置</button>`;
    }

    function projectedPosition(casino, ownCount, neutralCount) {
        const counts = { ...(casino?.dice || {}) };
        if (ownCount) counts[state.myId] = (Number(counts[state.myId]) || 0) + ownCount;
        if (neutralCount) counts.neutral = (Number(counts.neutral) || 0) + neutralCount;
        const myCount = Number(counts[state.myId]) || 0;
        if (!myCount) return '未形成席位';
        const values = Object.values(counts).map(Number).filter(value => value > 0);
        const frequency = values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map());
        const tied = (frequency.get(myCount) || 0) > 1;
        const eligibleAhead = [...new Set(values.filter(value => value > myCount && frequency.get(value) === 1))].length;
        if (tied) return `${myCount} 枚平手 · 当前作废`;
        return eligibleAhead ? `领奖第 ${eligibleAhead + 1} 顺位` : '领奖第一顺位';
    }

    function renderPayouts() {
        const payouts = state.lastPayouts || [];
        $('payouts').innerHTML = payouts.length
            ? payouts.map(payout => `<span class="lv-payout tone-${escapeHtml(playerTone(playerById(payout.playerId)))}"><i></i><strong>${escapeHtml(payout.playerName)}</strong><b>+${escapeHtml(payout.amount)} 万</b><small>${payout.casino}号 · ${payout.dice} 枚</small></span>`).join('')
            : '<span class="lv-empty-inline">本轮结束后，领取记录会显示在这里。</span>';
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('logCount').textContent = String(entries.length);
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('')
            : '<p class="lv-log-empty">等待第一轮掷骰。</p>';
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

    function presentationAnchor(kind, value) {
        if (kind === 'player') return [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(value)) || null;
        if (kind === 'casino') return mount.querySelector(`[data-casino-face="${Number(value)}"]`);
        if (kind === 'bank') return $('bankAnchor');
        if (kind === 'dice') return $('dice');
        return null;
    }

    function clearPresentationTargets() {
        mount.querySelectorAll('.is-presentation-source, .is-presentation-target').forEach(element => element.classList.remove('is-presentation-source', 'is-presentation-target'));
        $('actionLine').classList.remove('is-visible');
    }

    function drawActionLine(fromElement, toElement, tone = 'gold') {
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
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        head.setAttribute('cx', x2);
        head.setAttribute('cy', y2);
        svg.dataset.tone = tone;
        svg.classList.add('is-visible');
        fromElement.classList.add('is-presentation-source');
        toElement.classList.add('is-presentation-target');
    }

    function showPresentation(kind, html, options = {}) {
        const layer = $('presentationLayer');
        clearPresentationTargets();
        layer.hidden = false;
        layer.className = `lv-presentation-layer is-${kind} ${options.major ? 'is-major' : ''} ${options.compact ? 'is-compact' : ''}`;
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

    function diceBundle(values, className = '') {
        return (values || []).map(value => renderDie(value, `lv-event-die ${className}`)).join('') || '<span class="lv-event-none">无</span>';
    }

    function casinoDiceRows(event) {
        const tiedIds = new Set((event.ties || []).flatMap(tie => tie.participants || []).map(player => player.id));
        return Object.entries(event.diceBefore || {}).sort((left, right) => Number(right[1]) - Number(left[1])).map(([id, count]) => {
            const player = playerById(id) || { name: id === 'neutral' ? '中立骰子' : id, color: id === 'neutral' ? 'neutral' : 'gold' };
            return `<span class="lv-result-player tone-${escapeHtml(playerTone(player))} ${tiedIds.has(id) ? 'is-cancelled' : ''}"><i></i><strong>${escapeHtml(player.name)}</strong><b>${escapeHtml(count)} 枚</b>${tiedIds.has(id) ? '<em>平手作废</em>' : ''}</span>`;
        }).join('') || '<span class="lv-event-none">无人下注</span>';
    }

    async function playCasinoSettlement(event, token) {
        const payouts = event.payouts || [];
        const returned = event.returnedBills || [];
        const money = (event.moneyBefore || []).map(value => `<b>${escapeHtml(value)}<small>万</small></b>`).join('');
        const base = `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮 · 赌场结算</span><h2>${escapeHtml(event.face)}号 · ${escapeHtml(event.casinoName)}</h2><div class="lv-settlement-money">${money || '<span>没有奖金</span>'}</div><div class="lv-settlement-dice">${casinoDiceRows(event)}</div><div class="lv-settlement-award" data-role="eventAward"><span>${payouts.length ? '核对多数与奖金顺位' : returned.length ? '无人取得奖金，钞票返回牌库' : '本桌结算完成'}</span></div>`;
        showPresentation('casino-settlement', base, { major: true });
        const casinoAnchor = presentationAnchor('casino', event.face);
        casinoAnchor?.classList.add('is-presentation-target');
        await waitForPresentation((event.ties || []).length ? 800 : 520, token);
        for (const payout of payouts) {
            if (token !== presentationToken) return;
            clearPresentationTargets();
            const targetKind = payout.returnedToBank ? 'bank' : 'player';
            const target = presentationAnchor(targetKind, payout.playerId);
            const award = $('presentationScene').querySelector('[data-role="eventAward"]');
            if (award) award.innerHTML = payout.returnedToBank
                ? `<span class="tone-neutral"><strong>${escapeHtml(payout.playerName)}</strong> 取得多数，但 <b>${escapeHtml(payout.amount)} 万</b> 返回牌库</span>`
                : `<span class="tone-${escapeHtml(payout.playerColor)}"><strong>${escapeHtml(payout.playerName)}</strong> 凭 ${escapeHtml(payout.dice)} 枚骰子获得 <b>+${escapeHtml(payout.amount)} 万</b></span>`;
            drawActionLine(casinoAnchor, target, payout.playerColor || 'gold');
            await waitForPresentation(850, token);
        }
        if (!payouts.length) {
            drawActionLine(casinoAnchor, presentationAnchor('bank'), 'neutral');
            await waitForPresentation(500, token);
        }
    }

    async function playPresentationEvent(event, token) {
        if (!event || token !== presentationToken) return;
        if (event.kind === 'diceRolled') {
            showPresentation('dice-rolled', `<span class="lv-event-kicker">轮到 ${escapeHtml(event.actorName)}</span><h2>骰子落盘</h2><div class="lv-event-rolls"><div class="tone-${escapeHtml(event.actorColor)}"><small>自有骰 · ${event.ownResults?.length || 0} 枚</small><span>${diceBundle(event.ownResults, 'is-own')}</span></div>${event.neutralResults?.length ? `<div class="tone-neutral"><small>中立骰 · ${event.neutralResults.length} 枚</small><span>${diceBundle(event.neutralResults, 'is-neutral')}</span></div>` : ''}</div>`, { compact: true });
            drawActionLine(presentationAnchor('player', event.actorId), presentationAnchor('dice'), event.actorColor);
            await waitForPresentation(900, token);
            return;
        }
        if (event.kind === 'dicePlaced') {
            const ownDice = Array.from({ length: Math.min(event.ownCount || 0, 8) }, () => event.face);
            const neutralDice = Array.from({ length: Math.min(event.neutralCount || 0, 8) }, () => event.face);
            showPresentation('dice-placed', `<span class="lv-event-kicker">${escapeHtml(event.actorName)} 作出选择</span><h2>押注 ${escapeHtml(event.face)}号 · ${escapeHtml(event.casinoName)}</h2><div class="lv-event-place"><div class="tone-${escapeHtml(event.actorColor)}">${diceBundle(ownDice, 'is-own')}</div>${neutralDice.length ? `<div class="tone-neutral">${diceBundle(neutralDice, 'is-neutral')}</div>` : ''}<strong>共 ${escapeHtml(event.totalCount)} 枚</strong></div><p>自有 ${escapeHtml(event.ownCount)} 枚${event.neutralCount ? ` · 中立 ${escapeHtml(event.neutralCount)} 枚` : ''}</p>`, { compact: true });
            drawActionLine(presentationAnchor('player', event.actorId), presentationAnchor('casino', event.face), event.actorColor);
            await waitForPresentation(950, token);
            return;
        }
        if (event.kind === 'betsClosed') {
            showPresentation('bets-closed', `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮</span><h2>所有赌场 · 正式封盘</h2><p>六家赌场将依次核对平手、排名与奖金。</p>`, { major: true });
            await waitForPresentation(1150, token);
            return;
        }
        if (event.kind === 'casinoSettlement') {
            await playCasinoSettlement(event, token);
            return;
        }
        if (event.kind === 'roundSettlement') {
            const standings = (event.standings || []).map((player, index) => `<li class="tone-${escapeHtml(player.color)}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><span>本轮 <b>+${escapeHtml(player.gained || 0)} 万</b></span><span>累计 ${escapeHtml(player.money)} 万 · ${escapeHtml(player.banknoteCount)} 张</span></li>`).join('');
            showPresentation('round-settlement', `<span class="lv-event-kicker">第 ${escapeHtml(event.round)} 轮结束</span><h2>本轮资金清点</h2><ol class="lv-event-standings">${standings}</ol>`, { major: true });
            await waitForPresentation(1500, token);
            return;
        }
        if (event.kind === 'roundTransition') {
            showPresentation('round-transition', `<span class="lv-event-kicker">赌桌换场</span><h2>第 ${escapeHtml(event.nextRound)} 轮即将开始</h2><p>${escapeHtml(event.nextStarterName)} 获得先手。</p>`, { major: true });
            await waitForPresentation(850, token);
            return;
        }
        if (event.kind === 'roundStarted') {
            const pools = (event.casinos || []).map(casino => `<span>${escapeHtml(casino.face)}号 <b>${casino.money.reduce((sum, value) => sum + Number(value || 0), 0)} 万</b></span>`).join('');
            showPresentation('round-started', `<span class="lv-event-kicker">奖金重新入场</span><h2>第 ${escapeHtml(event.round)} 轮开桌</h2><div class="lv-event-pools">${pools}</div><p>${escapeHtml(event.starterName)} 先掷骰。</p>`, { major: true });
            await waitForPresentation(1150, token);
            return;
        }
        if (event.kind === 'finalSettlement') {
            const winners = new Set(event.winnerIds || []);
            const rows = (event.standings || []).map((player, index) => `<li class="tone-${escapeHtml(player.color)} ${winners.has(player.id) ? 'is-winner' : ''}"><em>${index + 1}</em><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.money)} 万</span><small>${escapeHtml(player.banknoteCount)} 张钞票${winners.has(player.id) ? ' · 最终赢家' : ''}</small></li>`).join('');
            showPresentation('final-settlement', `<span class="lv-event-kicker">四轮赌局结束</span><h2>${winners.size > 1 ? '并列称霸拉斯维加斯' : '今晚的赌场之王'}</h2><ol class="lv-final-standings">${rows}</ol><p>现金同分时，以钞票张数决定最终名次。</p>`, { major: true });
            await waitForPresentation(2800, token);
        }
    }

    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true;
        const token = presentationToken;
        renderFaces();
        while (presentationQueue.length && token === presentationToken) {
            const event = presentationQueue.shift();
            await playPresentationEvent(event, token);
        }
        if (token === presentationToken) {
            hidePresentation();
            presentationPlaying = false;
            render();
        }
    }

    function enqueuePresentation(presentation) {
        const events = presentation?.events || [];
        if (!events.length) return;
        presentationQueue.push(...events);
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

    function openRules() {
        rulesTrigger = document.activeElement;
        bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        overlay.classList.remove('is-hidden');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('[data-ui="closeRules"]')?.focus();
    }

    function closeRules() {
        if (overlay.classList.contains('is-hidden')) return;
        overlay.classList.add('is-hidden');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = bodyOverflow;
        rulesTrigger?.focus?.();
        rulesTrigger = null;
    }

    function handleMessage(message) {
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
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
    }

    function handleClick(event) {
        const control = event.target.closest('[data-ui]');
        const ui = control?.dataset.ui;
        if (ui === 'leave') leaveRoom?.();
        if (ui === 'rules') openRules();
        if (ui === 'closeRules' || event.target === overlay) closeRules();
        if (ui === 'skipPresentation') skipPresentations();
        if (ui === 'roll' && !control.disabled && !presentationPlaying) send({ type: 'gameAction', action: { kind: 'rollDice' } });
        if (ui === 'place' && selectedFace && !presentationPlaying) {
            const face = selectedFace;
            selectedFace = null;
            renderFaces();
            renderCasinos();
            send({ type: 'gameAction', action: { kind: 'placeDice', face } });
            return;
        }

        const faceButton = event.target.closest('[data-face]');
        if (faceButton && !faceButton.disabled && !presentationPlaying) {
            selectedFace = Number(faceButton.dataset.face);
            renderFaces();
            renderCasinos();
            mount.querySelector(`.lv-face-actions [data-face="${selectedFace}"]`)?.focus({ preventScroll: true });
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && !overlay.classList.contains('is-hidden')) closeRules();
    }

    mount.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'lasvegas',
        handleMessage,
        destroy() {
            presentationToken += 1;
            releaseWait?.();
            presentationQueue = [];
            closeRules();
            mount.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            style.remove();
            mount.innerHTML = '';
        },
    };
}
