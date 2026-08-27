const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const PHASE_LABELS = {
    place: '铺设地块',
    foundation: '创建集团',
    merger: '合并选择',
    merger_settlement: '股东结算',
    buy: '购入股票',
    ended: '牌局结束',
};

const PHASE_ENGLISH = {
    place: '铺设地块',
    foundation: '创建集团',
    merger: '选择存续集团',
    merger_settlement: '结算旧股',
    buy: '购买股票',
    ended: '最终账本',
};

const formatMoney = value => `$${Number(value || 0).toLocaleString('en-US')}`;
const formatNumber = value => Number(value || 0).toLocaleString('en-US');
const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#687b77';
const safeChainId = value => /^(sackson|imperial|america|festival|worldwide|continental|tower)$/.test(String(value || '')) ? value : 'unknown';
const tileIdFor = (row, col) => `${String.fromCharCode(65 + row)}${col + 1}`;

function chainHeadquartersMarkup(chain, variant = '') {
    const modifier = /^is-(board|legend|option|rules|stock)$/.test(variant) ? ` ${variant}` : '';
    return `<span class="acquire-hq${modifier}" data-chain="${safeChainId(chain?.id)}" aria-hidden="true"><span class="acquire-hq-buildings"><i></i><i></i><i></i></span><b>${escapeHtml(chain?.short || '?')}</b></span>`;
}

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/acquire/style.css?v=20260826-mobile-shell-1';
    let resolveStyleReady;
    const styleReady = new Promise(resolve => { resolveStyleReady = resolve; });
    style.addEventListener('load', resolveStyleReady, { once: true });
    style.addEventListener('error', resolveStyleReady, { once: true });
    window.setTimeout(resolveStyleReady, 800);
    document.head.appendChild(style);
    document.body.classList.add('acquire-game-active');

    let state = null;
    let pendingTileId = null;
    let previousFocus = null;
    let pendingConfirmation = null;
    let lastPresentationSequence = 0;
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    mount.innerHTML = `
        <section class="acquire-app" data-game-root>
            <header class="acquire-topbar">
                <div class="acquire-brand">
                    <span class="acquire-brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                    <div class="acquire-brand-copy">
                        <span class="acquire-eyebrow">ACQUIRE 60 · 经典模式</span>
                        <h1>并购</h1>
                        <p>城市版图上的酒店资本战</p>
                    </div>
                </div>
                <div class="acquire-top-stats" aria-label="牌局状态">
                    <div class="acquire-stat"><span>当前阶段</span><strong data-role="phase">等待开局</strong></div>
                    <div class="acquire-stat acquire-deck-stat"><span>建筑地块</span><div class="acquire-deck-counter"><span class="acquire-deck-kit" aria-hidden="true"><i class="acquire-tile-bag"></i><i class="acquire-tile-back"></i></span><strong data-role="deck">--</strong></div></div>
                    <div class="acquire-stat acquire-turn-stat"><span>行动者</span><strong data-role="turn">等待牌局状态</strong></div>
                </div>
                <div class="acquire-header-actions">
                    <button class="acquire-quiet-button" data-ui="rules" type="button">规则</button>

                </div>
            </header>

            <main class="acquire-shell">
                <section class="acquire-command" data-role="command" aria-live="polite">
                    <div class="acquire-command-head">
                        <div>
                            <span class="acquire-kicker" data-role="command-kicker">牌局状态</span>
                            <h2 data-role="command-title">等待牌局状态</h2>
                            <p data-role="command-copy">牌局开始后，当前操作会显示在这里。</p>
                        </div>
                        <div class="acquire-command-turn" data-role="command-turn"></div>
                    </div>
                    <div class="acquire-command-body" data-role="command-body"></div>
                    <div class="acquire-command-footer" data-role="command-footer"></div>
                </section>

                <section class="acquire-stage">
                    <div class="acquire-stage-heading">
                        <div>
                            <span class="acquire-kicker">城市网格</span>
                            <h2>城市版图</h2>
                        </div>
                        <div class="acquire-board-legend" data-role="board-legend"></div>
                    </div>
                    <section class="acquire-board-surface" aria-label="并购城市棋盘">
                        <div class="acquire-board-axis acquire-board-axis-top" aria-hidden="true">
                            <span></span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
                        </div>
                        <div class="acquire-board-map">
                            <div class="acquire-board-axis acquire-board-axis-side" aria-hidden="true"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><span>F</span><span>G</span><span>H</span><span>I</span></div>
                            <div class="acquire-board" data-role="board" role="grid" aria-label="9 行 12 列城市网格"></div>
                        </div>
                    </section>
                    <section class="acquire-hand-surface">
                        <div class="acquire-section-heading">
                            <div><span class="acquire-kicker">私密地块</span><h2>我的地块</h2></div>
                            <span class="acquire-section-meta" data-role="hand-note">-- 张 · 仅你可见</span>
                        </div>
                        <div class="acquire-hand" data-role="hand"></div>
                        <div class="acquire-hand-confirm is-hidden" data-role="hand-confirm"></div>
                    </section>
                </section>

                <aside class="acquire-rail">
                    <section class="acquire-rail-panel acquire-portfolio-panel">
                        <div class="acquire-section-heading"><div><span class="acquire-kicker">我的账本</span><h2>我的资产</h2></div><span class="acquire-section-meta">实时</span></div>
                        <div class="acquire-portfolio" data-role="portfolio"></div>
                    </section>
                    <section class="acquire-rail-panel acquire-market-panel">
                        <div class="acquire-section-heading"><div><span class="acquire-kicker">酒店集团</span><h2>集团行情</h2></div><span class="acquire-section-meta">股价 / 库存</span></div>
                        <div class="acquire-chains" data-role="chains"></div>
                    </section>
                    <section class="acquire-rail-panel acquire-players-panel">
                        <div class="acquire-section-heading"><div><span class="acquire-kicker">股东名册</span><h2>投资人</h2></div><span class="acquire-section-meta">现金 / 持股</span></div>
                        <div class="acquire-players" data-role="players"></div>
                    </section>
                    <section class="acquire-rail-panel acquire-log-panel">
                        <div class="acquire-section-heading"><div><span class="acquire-kicker">行情记录</span><h2>交易记录</h2></div><span class="acquire-section-meta">最近行动</span></div>
                        <div class="acquire-log" data-role="log"></div>
                    </section>
                </aside>
            </main>

            <div class="acquire-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
                <svg class="acquire-action-lines" data-role="actionLines" aria-hidden="true">
                    <defs>
                        <filter id="acquireLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
                        <marker id="acquireLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker>
                    </defs>
                    <path data-role="actionPath"></path>
                </svg>
                <div class="acquire-presentation-stage" data-role="presentationStage" role="status" aria-live="assertive"></div>
                <button class="acquire-presentation-skip" data-action="skipPresentation" type="button">跳过演出</button>
            </div>

            <div class="acquire-decision-overlay is-hidden" data-role="decisionOverlay" aria-hidden="true">
                <article class="acquire-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="acquireDecisionTitle">
                    <span class="acquire-decision-mark" data-role="decisionMark">A</span>
                    <small data-role="decisionKicker">确认决策</small>
                    <h2 id="acquireDecisionTitle" data-role="decisionTitle">确认操作</h2>
                    <p data-role="decisionCopy"></p>
                    <div class="acquire-decision-summary" data-role="decisionSummary"></div>
                    <div class="acquire-decision-actions">
                        <button class="acquire-secondary-button" data-ui="cancelDecision" type="button">返回检查</button>
                        <button class="acquire-primary-button" data-ui="confirmDecision" type="button">确认</button>
                    </div>
                </article>
            </div>

            <div class="acquire-overlay is-hidden" data-role="rulesOverlay" aria-hidden="true">
                <article class="acquire-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="acquire-rules-title">
                    <button class="acquire-dialog-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button>
                    <span class="acquire-kicker">玩法说明</span>
                    <h2 id="acquire-rules-title">并购规则</h2>
                    <ol>
                        <li>开局每位玩家抽一块起始地块放到地图上，编号最小者先手；随后每人持有六块隐藏地块。</li>
                        <li>轮到你时铺设一块地块；相邻地块可以创建集团，连接两个或更多集团会触发合并，规模最大的集团必须保留。</li>
                        <li>创建集团的玩家获得一股创始人股票；合并时按持股结算多数与少数股东红利，旧集团股票可卖出、按 2:1 换股或保留。</li>
                        <li>铺砖后可以用现金购买最多三股已启用集团的股票，然后补一块地块。</li>
                        <li>集团达到 11 格为安全集团；达到 41 格或所有集团都安全时可宣布结束，完成当前回合后清算。</li>
                    </ol>
                    <figure class="acquire-component-guide">
                        <div class="acquire-guide-board">
                            <span class="acquire-guide-label">CLASSIC MERGER</span>
                            <div class="acquire-guide-merger">
                                ${chainHeadquartersMarkup({ id: 'sackson', short: 'S' }, 'is-rules')}
                                <span class="acquire-guide-link"><i></i><b>+</b><i></i></span>
                                ${chainHeadquartersMarkup({ id: 'imperial', short: 'I' }, 'is-rules')}
                                <span class="acquire-guide-arrow">→</span>
                                <span class="acquire-guide-survivor">${chainHeadquartersMarkup({ id: 'imperial', short: 'I' }, 'is-rules')}<small>大集团存续</small></span>
                            </div>
                        </div>
                        <div class="acquire-guide-components">
                            <section><span>建筑地块</span><div class="acquire-deck-kit is-guide" aria-hidden="true"><i class="acquire-tile-bag"></i><i class="acquire-tile-back"></i></div><strong>牌袋抽取 · 坐标铺设</strong></section>
                            <section class="acquire-guide-stock"><span>集团股票</span>${stockCertificateMarkup({ id: 'worldwide', short: 'W', name: '环球', color: '#66a578', sharePrice: 700, sharesAvailable: 18 }, 0, 'guide')}</section>
                        </div>
                        <figcaption>当前牌桌采用 60 周年版的现代城市视觉语言，规则仍为经典模式；总部轮廓和集团色在棋盘、股票与行情区保持一致。</figcaption>
                    </figure>
                </article>
            </div>
        </section>`;

    const $ = selector => mount.querySelector(selector.startsWith('[') ? selector : `[data-role="${selector}"]`);
    const rulesOverlay = $('rulesOverlay');

    function getMe() {
        return (state?.players || []).find(player => player.id === state.myId);
    }

    function getChain(chainId) {
        return state?.corporations?.[chainId] || null;
    }

    function stockCertificateMarkup(chain, count = 0, variant = 'holding') {
        const short = chain?.short || '?';
        const name = chain?.name || '未知集团';
        const price = chain?.sharePrice || 0;
        const marketCopy = `库存 ${chain?.sharesAvailable || 0} 股`;
        const holdingCopy = `账面 ${formatMoney(count * price)}`;
        return `<article class="acquire-stock-certificate is-${variant}" data-chain="${safeChainId(chain?.id)}" style="--chain-color:${safeColor(chain?.color)}"><header><span>ACQUIRE · 股份凭证</span><b>${variant === 'holding' ? `${formatNumber(count)} 股` : formatMoney(price)}</b></header><div class="acquire-stock-face">${chainHeadquartersMarkup(chain, 'is-stock')}<span class="acquire-stock-identity"><strong>${escapeHtml(name)}</strong><small>HOTEL GROUP · ${escapeHtml(short)}</small></span><i class="acquire-stock-seal">60</i></div><footer><span>酒店集团股份</span><small>${variant === 'holding' ? holdingCopy : marketCopy}</small></footer></article>`;
    }

    function getNeighbors(row, col) {
        return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
            .filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < 9 && nextCol >= 0 && nextCol < 12)
            .map(([nextRow, nextCol]) => state.board?.[tileIdFor(nextRow, nextCol)])
            .filter(Boolean);
    }

    function canPlayTile(tile) {
        if (!tile || state.board?.[tile.id]) return false;
        const adjacent = getNeighbors(tile.row, tile.col);
        const chainIds = [...new Set(adjacent.map(cell => cell.chain).filter(Boolean))];
        const safeChains = chainIds.filter(chainId => (getChain(chainId)?.size || 0) >= 11);
        if (safeChains.length >= 2) return false;
        if (!chainIds.length && adjacent.some(cell => !cell.chain)) {
            return Object.values(state.corporations || {}).some(chain => !chain.active);
        }
        return true;
    }

    function sendAction(kind, payload = {}) {
        send({ type: 'gameAction', action: { kind, ...payload } });
    }

    function render() {
        if (!state) return;
        const me = getMe();
        const phase = state.status === 'ended' ? 'ended' : state.phase;
        const isMyTurn = Boolean(me?.isCurrentTurn || state.mergerSettlement?.currentPlayerId === state.myId);
        $('[data-role="phase"]').textContent = PHASE_LABELS[phase] || '等待中';
        $('[data-role="deck"]').textContent = state.status === 'ended' ? '封存' : formatNumber(state.deckCount);
        $('[data-role="turn"]').innerHTML = state.status === 'ended'
            ? `<span class="acquire-turn-dot is-ended"></span>${escapeHtml(state.winner?.name || '本局结束')}`
            : `<span class="acquire-turn-dot ${isMyTurn ? 'is-mine' : ''}"></span>${escapeHtml(state.currentTurnName || '等待中')}`;
        $('[data-role="hand-note"]').textContent = `${state.myHand?.length || 0} 张 · 仅你可见`;
        renderCommand(me, phase, isMyTurn);
        renderBoard();
        renderHand();
        renderPortfolio(me);
        renderChains();
        renderPlayers();
        renderLog();
    }

    function renderCommand(me, phase, isMyTurn) {
        const available = state.availableActions || {};
        const commandKicker = $('[data-role="command-kicker"]');
        const commandTitle = $('[data-role="command-title"]');
        const commandCopy = $('[data-role="command-copy"]');
        const commandTurn = $('[data-role="command-turn"]');
        const body = $('[data-role="command-body"]');
        const footer = $('[data-role="command-footer"]');
        commandKicker.textContent = PHASE_ENGLISH[phase] || '牌局状态';
        commandTurn.innerHTML = state.status === 'ended'
            ? '<span class="acquire-command-badge is-ended">已结算</span>'
            : `<span class="acquire-command-badge ${isMyTurn ? 'is-mine' : ''}">${isMyTurn ? '轮到我' : '等待中'}</span>`;
        footer.innerHTML = '';

        if (phase === 'ended') {
            commandTitle.textContent = `${state.winner?.name || '本局'} 获胜`;
            commandCopy.textContent = '终局账本已结算，所有存续集团股票完成清算。';
            body.innerHTML = `<div class="acquire-result-banner"><strong>${formatMoney(getMe()?.cash)}</strong><span>我的最终现金</span><i></i><strong>${formatNumber(state.players?.length || 0)}</strong><span>参赛投资人</span></div>`;
            return;
        }

        if (phase === 'place' && available.canPlace) {
            commandTitle.textContent = '选择一块地块';
            commandCopy.textContent = '把私人地块加入城市版图，观察它会连接哪些集团。';
            body.innerHTML = '<div class="acquire-command-note"><span class="acquire-note-icon">+</span><div><strong>铺设窗口已打开</strong><small>先在版图下方预选一块地块，再确认铺设。</small></div></div>';
        } else if (phase === 'place' && available.canSkipPlacement) {
            commandTitle.textContent = '没有合法铺设';
            commandCopy.textContent = '当前手牌无法加入版图，可以跳过铺设并进入购股。';
            body.innerHTML = '<div class="acquire-command-note is-warm"><span class="acquire-note-icon">↷</span><div><strong>保留手牌，直接进入购股</strong><small>永久不可玩地块仍需按规则单独弃置。</small></div></div>';
            footer.innerHTML = '<button class="acquire-secondary-button" data-action="skipPlacement" type="button">跳过铺设</button>';
        } else if (phase === 'foundation' && available.canFound) {
            commandTitle.textContent = '选择新集团';
            commandCopy.textContent = '这块地块可以成为酒店集团的起点。';
            const chains = Object.values(state.corporations || {}).filter(chain => !chain.active);
            body.innerHTML = `<div class="acquire-option-grid">${chains.map(chain => chainOption(chain, 'foundChain', '启用集团')).join('')}</div>`;
            footer.innerHTML = '<button class="acquire-secondary-button" data-action="skipFoundation" type="button">暂不创建，保持独立</button>';
        } else if (phase === 'merger' && available.canChooseMerger) {
            const pending = state.pendingMerger;
            const options = (pending?.chains || []).map(id => getChain(id)).filter(Boolean);
            const largest = Math.max(...options.map(chain => chain.size), 0);
            commandTitle.textContent = '决定存续集团';
            commandCopy.textContent = '规模最大的集团必须保留；同规模时由你决定。';
            body.innerHTML = `<div class="acquire-option-grid">${options.map(chain => chainOption(chain, 'chooseMerger', chain.size === largest ? '可存续' : '规模不足', chain.size < largest)).join('')}</div>`;
        } else if (phase === 'merger_settlement' && available.canSettleMerger && state.mergerSettlement) {
            renderSettlementCommand();
        } else if (phase === 'buy' && available.canBuy) {
            renderBuyCommand();
        } else {
            const waitingName = state.currentTurnName || '其他投资人';
            commandTitle.textContent = state.endGamePending ? '终局清算即将开始' : `${waitingName} 正在行动`;
            commandCopy.textContent = state.endGamePending ? '当前回合完成后将发放终局红利并结算股票。' : `当前阶段：${PHASE_LABELS[phase] || '牌局处理中'}`;
            body.innerHTML = `<div class="acquire-waiting"><span class="acquire-pulse"></span><span>${state.endGamePending ? '等待本回合完成' : '牌桌状态会自动更新'}</span></div>`;
        }

        if (available.canEndGame) {
            footer.insertAdjacentHTML('beforeend', '<button class="acquire-end-button" data-action="endGame" type="button">宣布结束并清算</button>');
        }
    }

    function chainOption(chain, action, label, disabled = false) {
        const color = safeColor(chain.color);
        return `<button class="acquire-chain-option ${disabled ? 'is-disabled' : ''}" data-chain="${safeChainId(chain.id)}" data-action="${action}" data-chain-id="${escapeHtml(chain.id)}" style="--chain-color:${color}" type="button" ${disabled ? 'disabled' : ''}>
            ${chainHeadquartersMarkup(chain, 'is-option')}
            <span class="acquire-chain-option-copy"><strong>${escapeHtml(chain.name)}</strong><small>${label} · ${chain.size} 格${chain.active ? ` · ${formatMoney(chain.sharePrice)}/股` : ''}</small></span>
            <span class="acquire-option-arrow">›</span>
        </button>`;
    }

    function renderSettlementCommand() {
        const settlement = state.mergerSettlement;
        const oldChain = getChain(settlement.chainId);
        const surviving = getChain(settlement.survivingId);
        const holding = settlement.holding || 0;
        $('[data-role="command-title"]').textContent = `处理 ${oldChain?.name || '旧集团'} 股票`;
        $('[data-role="command-copy"]').textContent = `你持有 ${holding} 股旧股票；三种处理数量必须合计为 ${holding}。`;
        $('[data-role="command-body"]').innerHTML = `
            <div class="acquire-settlement-route">${chainHeadquartersMarkup(oldChain, 'is-option')}<span class="acquire-route-line"></span>${chainHeadquartersMarkup(surviving, 'is-option')}<span><strong>${escapeHtml(surviving?.name || '存续集团')}</strong><small>存续集团</small></span></div>
            <div class="acquire-settlement-grid">
                <label><span>卖出</span><input type="number" min="0" max="${holding}" value="0" inputmode="numeric" data-merger-settle="sell"></label>
                <label><span>换股 <small>旧股</small></span><input type="number" min="0" max="${holding}" step="2" value="0" inputmode="numeric" data-merger-settle="trade"></label>
                <label><span>保留</span><input type="number" min="0" max="${holding}" value="${holding}" inputmode="numeric" data-merger-settle="keep"></label>
            </div>
            <div class="acquire-input-summary" data-role="settlement-summary">剩余待分配 ${holding} 股</div>`;
        $('[data-role="command-footer"]').innerHTML = '<button class="acquire-primary-button" data-action="settleMergerShares" type="button">确认股东选择</button>';
        updateSettlementPreview();
    }

    function renderBuyCommand() {
        const activeChains = Object.values(state.corporations || {}).filter(chain => chain.active);
        $('[data-role="command-title"]').textContent = '把现金换成集团股份';
        $('[data-role="command-copy"]').textContent = '本回合最多购买 3 股，未填写的集团保持为 0。';
        $('[data-role="command-body"]').innerHTML = activeChains.length ? `<div class="acquire-buy-grid">${activeChains.map(chain => {
            const color = safeColor(chain.color);
            const max = Math.min(3, chain.sharesAvailable);
            return `<label class="acquire-buy-row" style="--chain-color:${color}">${stockCertificateMarkup(chain, 0, 'market')}<span class="acquire-stock-order"><small>购买股数</small><input type="number" min="0" max="${max}" value="0" inputmode="numeric" data-buy-chain="${escapeHtml(chain.id)}" aria-label="购买${escapeHtml(chain.name)}股票数量"><em>最多 ${max}</em></span></label>`;
        }).join('')}</div><div class="acquire-input-summary acquire-buy-summary" data-role="buy-summary">已选 0 股 · ${formatMoney(0)}</div>` : '<div class="acquire-command-note"><span class="acquire-note-icon">—</span><div><strong>目前没有可购股票</strong><small>确认交易后结束本回合。</small></div></div>';
        $('[data-role="command-footer"]').innerHTML = '<button class="acquire-primary-button" data-action="buyShares" type="button">确认交易并结束回合</button>';
        updateBuyPreview();
    }

    function renderBoard() {
        const cells = [];
        for (let row = 0; row < 9; row += 1) {
            for (let col = 0; col < 12; col += 1) {
                const id = tileIdFor(row, col);
                const cell = state.board?.[id];
                const chain = cell?.chain ? getChain(cell.chain) : null;
                const color = safeColor(chain?.color);
                const kind = chain ? '集团' : cell ? '中立地块' : '空位';
                cells.push(`<div class="acquire-cell ${chain ? 'is-chain' : cell ? 'is-neutral' : 'is-empty'}" data-board-cell="${id}" data-chain="${safeChainId(chain?.id)}" style="--chain-color:${color}" role="gridcell" aria-label="${id} ${kind}" title="${id} · ${kind}">
                    <span class="acquire-cell-mark">${chain ? chainHeadquartersMarkup(chain, 'is-board') : cell ? '·' : ''}</span><span class="acquire-cell-id">${id}</span>
                </div>`);
            }
        }
        $('[data-role="board"]').innerHTML = cells.join('');
        const legendChains = Object.values(state.corporations || {}).filter(chain => chain.active);
        $('[data-role="board-legend"]').innerHTML = legendChains.length ? legendChains.map(chain => `<span class="acquire-legend-item" data-chain="${safeChainId(chain.id)}" style="--chain-color:${safeColor(chain.color)}">${chainHeadquartersMarkup(chain, 'is-legend')}<strong>${escapeHtml(chain.name)}</strong><small>${chain.size} 格 · ${formatMoney(chain.sharePrice)}</small></span>`).join('') : '<span class="acquire-legend-empty">尚未启用集团</span>';
    }

    function renderHand() {
        const hand = state.myHand || [];
        const canPlace = Boolean(state.availableActions?.canPlace);
        const canDiscard = Boolean(state.availableActions?.canDiscard);
        if (!hand.some(tile => tile.id === pendingTileId && canPlayTile(tile) && !tile.permanentlyUnplayable)) pendingTileId = null;
        if (!hand.length) {
            $('[data-role="hand"]').innerHTML = '<div class="acquire-empty-hand">手牌已用尽</div>';
            $('[data-role="hand-confirm"]').classList.add('is-hidden');
            $('[data-role="hand-confirm"]').innerHTML = '';
            return;
        }
        $('[data-role="hand"]').innerHTML = hand.map(tile => {
            const playable = canPlayTile(tile);
            const locked = Boolean(tile.permanentlyUnplayable);
            const disabled = !canPlace || !playable || locked;
            const selected = !disabled && pendingTileId === tile.id;
            const code = String(tile.id || '--');
            return `<div class="acquire-tile-wrap ${locked ? 'is-locked' : ''}">
                <button class="acquire-tile ${playable && canPlace ? 'is-playable' : ''} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-tile-id="${escapeHtml(tile.id)}" type="button" ${disabled ? 'disabled' : ''} aria-pressed="${selected}" title="${locked ? '永久不可玩，只能弃置' : selected ? '取消预选' : playable ? '预选这块地块' : '当前不能铺设'}">
                    <span class="acquire-tile-corner">${escapeHtml(code)}</span><span class="acquire-tile-city" aria-hidden="true"><i></i><i></i><i></i></span><strong>${escapeHtml(code)}</strong><small>城市建筑地块</small><em>${locked ? '永久不可玩' : selected ? '已预选' : playable && canPlace ? '可铺设' : canPlace ? '不可铺设' : '等待'}</em>
                </button>
                ${canDiscard && locked ? `<button class="acquire-discard-button" data-discard-tile="${escapeHtml(tile.id)}" type="button">弃置地块</button>` : ''}
            </div>`;
        }).join('');
        const selectedTile = hand.find(tile => tile.id === pendingTileId);
        const confirm = $('[data-role="hand-confirm"]');
        confirm.classList.toggle('is-hidden', !selectedTile || !canPlace);
        confirm.innerHTML = selectedTile
            ? `<span><small>准备铺设到城市版图</small><strong>${escapeHtml(selectedTile.id)}</strong></span><button data-action="confirmTile" type="button">确认铺设</button>`
            : '';
    }

    function renderPortfolio(me) {
        if (!me) {
            $('[data-role="portfolio"]').innerHTML = '<span class="acquire-muted">等待玩家加入牌局</span>';
            return;
        }
        const shares = Object.entries(me.shares || {}).filter(([, count]) => count > 0);
        const value = shares.reduce((sum, [chainId, count]) => sum + count * (getChain(chainId)?.sharePrice || 0), 0);
        $('[data-role="portfolio"]').innerHTML = `<div class="acquire-cash-line"><span>现金</span><strong>${formatMoney(me.cash)}</strong></div><div class="acquire-ledger-stats"><span><b>${formatNumber(shares.reduce((sum, [, count]) => sum + count, 0))}</b> 股</span><span><b>${formatMoney(value)}</b> 账面估值</span></div><div class="acquire-holding-list">${shares.length ? shares.map(([chainId, count]) => stockCertificateMarkup(getChain(chainId), count, 'holding')).join('') : '<small>尚未持有集团股票</small>'}</div>`;
    }

    function renderChains() {
        const chains = Object.values(state.corporations || {});
        $('[data-role="chains"]').innerHTML = chains.map(chain => {
            const color = safeColor(chain.color);
            const size = chain.size || 0;
            const progress = Math.min(100, Math.round(size / 41 * 100));
            const sizeStatus = size >= 41 ? '可触发终局' : size >= 11 ? '安全集团' : '扩张中';
            return `<article class="acquire-chain-row ${chain.active ? 'is-active' : 'is-off'}" data-market-chain="${safeChainId(chain.id)}" data-chain="${safeChainId(chain.id)}" style="--chain-color:${color}"><div class="acquire-chain-row-head">${chainHeadquartersMarkup(chain, 'is-option')}<div><strong>${escapeHtml(chain.name)}</strong><small>${chain.active ? `库存 ${chain.sharesAvailable} 股 · ${sizeStatus}` : '尚未成立'}</small></div><span class="acquire-chain-size"><b>${size}</b><small>格</small></span><b>${chain.active ? formatMoney(chain.sharePrice) : '—'}</b></div><div class="acquire-chain-progress"><span style="width:${progress}%"></span></div></article>`;
        }).join('');
    }

    function renderPlayers() {
        $('[data-role="players"]').innerHTML = (state.players || []).map(player => {
            const isMe = player.id === state.myId;
            const totalShares = Object.values(player.shares || {}).reduce((sum, count) => sum + count, 0);
            const holdings = Object.entries(player.shares || {}).filter(([, count]) => count > 0).map(([chainId, count]) => `<i style="--chain-color:${safeColor(getChain(chainId)?.color)}">${escapeHtml(getChain(chainId)?.short || '?')}${count}</i>`).join('');
            return `<article class="acquire-player-row ${player.isCurrentTurn ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}" style="--player-color:${safeColor(player.color)}"><div class="acquire-player-head"><span class="acquire-player-dot"></span><strong>${escapeHtml(player.name)}${isMe ? ' · 我' : ''}</strong><b>${formatMoney(player.cash)}</b></div><div class="acquire-player-meta"><span class="acquire-player-tiles"><i class="acquire-mini-tile-back" aria-hidden="true"></i>${player.handCount} 张地块</span><span>${totalShares} 股</span><span class="acquire-player-holdings">${holdings || '—'}</span></div></article>`;
        }).join('') || '<span class="acquire-muted">尚无投资人</span>';
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('[data-role="log"]').innerHTML = entries.length ? entries.map((entry, index) => `<div class="acquire-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<span class="acquire-muted">等待第一笔交易</span>';
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

    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function showPresentation(kind, html, color = '#d5ad55') {
        const layer = $('[data-role="presentationLayer"]');
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `acquire-presentation-layer is-active is-${kind}`;
        layer.style.setProperty('--acquire-action-color', safeColor(color));
        $('[data-role="presentationStage"]').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('[data-role="actionPath"]');
        path.removeAttribute('d');
        path.setAttribute('class', '');
        path.style.removeProperty('stroke');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-impact, .is-event-chain, .is-event-acquired').forEach(element => element.classList.remove('is-event-impact', 'is-event-chain', 'is-event-acquired'));
    }

    function hidePresentation() {
        const layer = $('[data-role="presentationLayer"]');
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'acquire-presentation-layer';
        layer.style.removeProperty('--acquire-action-color');
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('[data-role="presentationStage"]').innerHTML = '';
    }

    function playerAnchor(playerId) {
        const player = [...mount.querySelectorAll('[data-player-id]')].find(element => element.dataset.playerId === String(playerId)) || null;
        if (!player) return $('[data-role="turn"]');
        const rect = player.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight ? player : $('[data-role="turn"]');
    }

    function boardAnchor(tileId) {
        return [...mount.querySelectorAll('[data-board-cell]')].find(element => element.dataset.boardCell === String(tileId)) || $('[data-role="board"]');
    }

    function marketAnchor(chainId) {
        return [...mount.querySelectorAll('[data-market-chain]')].find(element => element.dataset.marketChain === String(chainId)) || $('[data-role="chains"]');
    }

    function combinedAnchor(elements = []) {
        const available = elements.filter(Boolean);
        if (!available.length) return null;
        return {
            getBoundingClientRect() {
                const rects = available.map(element => element.getBoundingClientRect());
                const left = Math.min(...rects.map(rect => rect.left));
                const right = Math.max(...rects.map(rect => rect.right));
                const top = Math.min(...rects.map(rect => rect.top));
                const bottom = Math.max(...rects.map(rect => rect.bottom));
                return { left, right, top, bottom, width: right - left, height: bottom - top };
            },
        };
    }

    function chainBoardAnchor(chain) {
        return combinedAnchor((chain?.tileIds || []).map(boardAnchor));
    }

    function drawActionLine(fromElement, toElement, color = '#d5ad55') {
        if (!fromElement || !toElement) return clearActionLine();
        const svg = $('[data-role="actionLines"]');
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(46, Math.min(170, Math.abs(x2 - x1) * .22 + Math.abs(y2 - y1) * .12));
        const path = $('[data-role="actionPath"]');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', 'is-visible');
        path.style.stroke = safeColor(color);
    }

    function setMotionOrigin(source, element) {
        if (!source || !element) return;
        const from = source.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--acquire-from-x', `${from.left + from.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--acquire-from-y', `${from.top + from.height / 2 - (target.top + target.height / 2)}px`);
    }

    function setMotionDestination(destination, element) {
        if (!destination || !element) return;
        const to = destination.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--acquire-to-x', `${to.left + to.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--acquire-to-y', `${to.top + to.height / 2 - (target.top + target.height / 2)}px`);
    }

    function eventTileMarkup(tile, extraClass = '') {
        const code = String(tile?.id || '--');
        return `<span class="acquire-event-tile ${extraClass}"><span>${escapeHtml(code)}</span><i class="acquire-tile-city" aria-hidden="true"><i></i><i></i><i></i></i><strong>${escapeHtml(code)}</strong><small>城市建筑地块</small></span>`;
    }

    function eventChainMarkup(chain, extraClass = '') {
        if (!chain) return '';
        return `<article class="acquire-event-chain ${extraClass}" data-event-chain="${safeChainId(chain.id)}" style="--chain-color:${safeColor(chain.color)}">${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain.name)}</strong><small>${Number(chain.size) || 0} 格 · ${formatMoney(chain.sharePrice)}/股</small></span></article>`;
    }

    function markTiles(tileIds = [], className = 'is-event-chain') {
        tileIds.forEach(tileId => boardAnchor(tileId)?.classList.add(className));
    }

    async function playPlacePresentation(event, token) {
        const color = safeColor(event.playerColor);
        const labels = {
            neutral: ['独立建筑落位', '暂未连接酒店集团'],
            expand: [`${event.chainAfter?.name || '酒店集团'}继续扩张`, `${Number(event.chainBefore?.size) || 0} → ${Number(event.chainAfter?.size) || 0} 格`],
            foundation: ['新的城市板块形成', '接下来可以成立酒店集团'],
            merger: ['集团边界发生碰撞', '这块地块触发了一宗并购案'],
        };
        const [title, copy] = labels[event.resultKind] || labels.neutral;
        showPresentation('place-tile', `<div class="acquire-place-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}铺设私人地块</span>
            <div class="acquire-tile-motion">${eventTileMarkup(event.tile)}</div>
            <h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>
        </div>`, color);
        const motion = $('[data-role="presentationStage"]').querySelector('.acquire-tile-motion');
        const actor = playerAnchor(event.playerId);
        const destination = boardAnchor(event.tile?.id);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-centered');
        if (!await presentationDelay(390, token)) return;
        setMotionDestination(destination, motion);
        $('[data-role="presentationLayer"]').classList.add('is-transferred');
        drawActionLine(motion, destination, color);
        destination?.classList.add('is-event-impact');
        markTiles(event.adjacentNeutralIds || []);
        await presentationDelay(event.resultKind === 'merger' ? 760 : 560, token);
    }

    async function playDiscardPresentation(event, token) {
        const color = safeColor(event.playerColor);
        showPresentation('discard-tile', `<div class="acquire-place-event is-discard">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}处理永久不可玩地块</span>
            <div class="acquire-tile-motion">${eventTileMarkup(event.tile)}</div>
            <h2>${escapeHtml(event.tile?.id || '')} 已弃置</h2><p>它会连接两个安全集团，不能进入城市版图</p>
        </div>`, color);
        const motion = $('[data-role="presentationStage"]').querySelector('.acquire-tile-motion');
        const actor = playerAnchor(event.playerId);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-centered');
        if (!await presentationDelay(360, token)) return;
        $('[data-role="presentationLayer"]').classList.add('is-discarded');
        clearActionLine();
        await presentationDelay(480, token);
    }

    async function playSimpleNotice(event, token, options = {}) {
        const color = safeColor(event.playerColor);
        showPresentation(options.kind || 'notice', `<div class="acquire-notice-event"><span>${options.mark || '—'}</span><div><small>${escapeHtml(event.playerName || '牌桌')}</small><h2>${escapeHtml(options.title || '')}</h2><p>${escapeHtml(options.copy || '')}</p></div></div>`, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        await presentationDelay(options.duration || 650, token);
    }

    async function playFoundationPresentation(event, token) {
        const chain = event.chain;
        const color = safeColor(chain?.color || event.playerColor);
        showPresentation('foundation', `<div class="acquire-foundation-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}签署集团成立书</span>
            <div class="acquire-chain-motion">${eventChainMarkup(chain)}</div>
            <h2>${escapeHtml(chain?.name || '')}集团成立</h2>
            <p>${Number(chain?.size) || 0} 格建筑纳入集团${event.founderShare ? ' · 创始人获得 1 股' : ''}</p>
            ${event.founderShare ? `<span class="acquire-founder-stock">+1 <small>${escapeHtml(chain?.short || '')} 股</small></span>` : ''}
        </div>`, color);
        const motion = $('[data-role="presentationStage"]').querySelector('.acquire-chain-motion');
        const actor = playerAnchor(event.playerId);
        const destination = boardAnchor(event.triggerTile?.id);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-centered');
        if (!await presentationDelay(420, token)) return;
        setMotionDestination(destination, motion);
        $('[data-role="presentationLayer"]').classList.add('is-transferred');
        drawActionLine(motion, destination, color);
        markTiles(chain?.tileIds || []);
        destination?.classList.add('is-event-impact');
        await presentationDelay(720, token);
    }

    async function playMergerPresentation(event, token) {
        const survivor = event.survivingChain;
        const color = safeColor(survivor?.color);
        showPresentation('merger', `<div class="acquire-merger-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}提交集团存续裁决</span>
            <h2>酒店集团并购案</h2>
            <div class="acquire-merger-route">
                <div class="acquire-merger-acquired">${(event.acquiredChains || []).map(chain => eventChainMarkup(chain, 'is-acquired')).join('')}</div>
                <span class="acquire-merger-arrow"><i></i><b>ACQUIRED</b></span>
                ${eventChainMarkup(survivor, 'is-survivor')}
            </div>
            <p>${(event.acquiredChains || []).map(chain => escapeHtml(chain.name)).join('、')}并入${escapeHtml(survivor?.name || '')}</p>
        </div>`, color);
        (event.participatingChains || []).forEach(chain => markTiles(chain.tileIds || [], chain.id === survivor?.id ? 'is-event-chain' : 'is-event-acquired'));
        const acquiredAnchor = combinedAnchor((event.acquiredChains || []).map(chainBoardAnchor));
        const trigger = boardAnchor(event.triggerTile?.id);
        drawActionLine(acquiredAnchor, trigger, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        if (!await presentationDelay(720, token)) return;
        $('[data-role="presentationLayer"]').classList.add('is-acquired');
        drawActionLine(trigger, chainBoardAnchor(survivor), color);
        await presentationDelay(1050, token);
    }

    async function playMergerBonusesPresentation(event, token) {
        const chain = event.chain;
        showPresentation('merger-bonuses', `<div class="acquire-bonus-event">
            <span class="acquire-event-kicker">${escapeHtml(chain?.name || '')}股东名册封账</span>
            <h2>多数与少数股东奖金</h2>
            <div class="acquire-bonus-chain">${eventChainMarkup(chain)}</div>
            <div class="acquire-bonus-list">${(event.payouts || []).length ? event.payouts.map((payout, index) => `<article style="--player-color:${safeColor(payout.playerColor)}"><span>${index + 1}</span><div><strong>${escapeHtml(payout.playerName)}</strong><small>${Number(payout.shares) || 0} 股 · ${payout.majorityBonus ? '多数' : '少数'}股东</small></div><b>+${formatMoney(payout.total)}</b></article>`).join('') : '<p>该集团没有股东，不发放奖金</p>'}</div>
        </div>`, chain?.color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        await presentationDelay(1150, token);
    }

    async function playSettlementPresentation(event, token) {
        const color = safeColor(event.acquiredChain?.color || event.playerColor);
        showPresentation('share-settlement', `<div class="acquire-share-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}处理被收购集团股票</span>
            <div class="acquire-share-route">${eventChainMarkup(event.acquiredChain)}<i></i>${eventChainMarkup(event.survivingChain)}</div>
            <h2>旧股处理完成</h2>
            <div class="acquire-share-results"><span><small>卖出</small><b>${Number(event.sell) || 0}</b><em>+${formatMoney((Number(event.sell) || 0) * (Number(event.price) || 0))}</em></span><span><small>换股</small><b>${Number(event.trade) || 0}→${Number(event.exchange) || 0}</b><em>${escapeHtml(event.survivingChain?.short || '')} 股</em></span><span><small>保留</small><b>${Number(event.keep) || 0}</b><em>${escapeHtml(event.acquiredChain?.short || '')} 股</em></span></div>
        </div>`, color);
        const actor = playerAnchor(event.playerId);
        const scene = $('[data-role="presentationStage"]').querySelector('.acquire-share-event');
        drawActionLine(actor, scene, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        actor?.classList.add('is-event-impact');
        await presentationDelay(950, token);
    }

    async function playBuyPresentation(event, token) {
        const orders = event.orders || [];
        if (!orders.length) return playSimpleNotice(event, token, { kind: 'no-purchase', mark: '—', title: '本回合不买股票', copy: `${event.playerName}保留现金并结束回合`, duration: 480 });
        const first = orders[0]?.chain;
        const color = safeColor(first?.color || event.playerColor);
        showPresentation('buy-shares', `<div class="acquire-buy-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}完成市场交易</span>
            <div class="acquire-buy-certificates">${orders.map(order => `<article style="--chain-color:${safeColor(order.chain?.color)}">${chainHeadquartersMarkup(order.chain, 'is-stock')}<strong>${escapeHtml(order.chain?.name || '')}</strong><b>×${Number(order.count) || 0}</b><small>${formatMoney(order.unitPrice)}/股</small></article>`).join('')}</div>
            <h2>购入 ${Number(event.totalCount) || 0} 股</h2><p>支付 ${formatMoney(event.cost)} · 余额 ${formatMoney(event.cashAfter)}</p>
        </div>`, color);
        const actor = playerAnchor(event.playerId);
        const scene = $('[data-role="presentationStage"]').querySelector('.acquire-buy-certificates');
        drawActionLine(marketAnchor(first?.id), scene, color);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        if (!await presentationDelay(460, token)) return;
        drawActionLine(scene, actor, color);
        actor?.classList.add('is-event-impact');
        await presentationDelay(590, token);
    }

    async function playEndGameDeclaredPresentation(event, token) {
        showPresentation('end-declared', `<div class="acquire-end-event">
            <span class="acquire-event-kicker">${escapeHtml(event.playerName)}敲响收市钟</span>
            <span class="acquire-closing-bell" aria-hidden="true">$</span>
            <h2>最终清算已经锁定</h2>
            <p>完成本回合交易后，所有集团将发放奖金并按最终股价清算</p>
            <div>${(event.activeChains || []).map(chain => `<span style="--chain-color:${safeColor(chain.color)}"><b>${escapeHtml(chain.short)}</b><small>${Number(chain.size) || 0} 格</small></span>`).join('')}</div>
        </div>`);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        await presentationDelay(1450, token);
    }

    async function playFinalSettlementPresentation(event, token) {
        const standings = event.standings || [];
        const winnerId = String(event.winner?.id || '');
        showPresentation('final-settlement', `<div class="acquire-finale-event">
            <span class="acquire-event-kicker">所有酒店集团完成封账</span>
            <span class="acquire-finale-mark" aria-hidden="true">A</span>
            <h2>最终资产账本</h2>
            <div class="acquire-final-standings">${standings.map((player, index) => `<article class="${String(player.id) === winnerId ? 'is-winner' : ''}" style="--player-color:${safeColor(player.color)}"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(player.name)}</strong><small>现金 ${formatMoney(player.cashBefore)} · 奖金 +${formatMoney(player.bonuses)} · 股票 +${formatMoney(player.liquidation)}</small></div><b>${formatMoney(player.finalCash)}</b></article>`).join('')}</div>
            <p>${escapeHtml(event.winner?.name || '本局')}以最高最终现金赢得并购</p>
        </div>`);
        await nextFrame();
        $('[data-role="presentationLayer"]').classList.add('is-revealed');
        await presentationDelay(3000, token);
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.acquire-app')?.classList.add('is-presentation-playing');
        await styleReady;
        while (presentationQueue.length) {
            const item = presentationQueue.shift();
            const token = ++presentationToken;
            for (const event of item.batch?.events || []) {
                if (event.kind === 'placeTile') await playPlacePresentation(event, token);
                if (event.kind === 'discardTile') await playDiscardPresentation(event, token);
                if (event.kind === 'skipPlacement') await playSimpleNotice(event, token, { mark: '↷', title: '跳过地块铺设', copy: '当前手牌没有合法位置，直接进入股票市场' });
                if (event.kind === 'foundChain') await playFoundationPresentation(event, token);
                if (event.kind === 'skipFoundation') await playSimpleNotice(event, token, { mark: '—', title: '保留独立建筑', copy: '本回合不成立新的酒店集团' });
                if (event.kind === 'merger') await playMergerPresentation(event, token);
                if (event.kind === 'mergerBonuses') await playMergerBonusesPresentation(event, token);
                if (event.kind === 'settleShares') await playSettlementPresentation(event, token);
                if (event.kind === 'mergerComplete') await playSimpleNotice(event, token, { mark: event.survivingChain?.short || 'A', title: `${event.survivingChain?.name || '存续'}集团完成整合`, copy: `集团规模扩大到 ${Number(event.survivingChain?.size) || 0} 格`, duration: 820 });
                if (event.kind === 'buyShares') await playBuyPresentation(event, token);
                if (event.kind === 'endGameDeclared') await playEndGameDeclaredPresentation(event, token);
                if (event.kind === 'finalSettlement') await playFinalSettlementPresentation(event, token);
                if (token !== presentationToken) break;
                hidePresentation();
                if (!await presentationDelay(60, token)) break;
            }
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.acquire-app')?.classList.remove('is-presentation-playing');
    }

    function enqueuePresentation(batch) {
        presentationQueue.push({ batch });
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
        mount.querySelector('.acquire-app')?.classList.remove('is-presentation-playing');
    }

    function updateSettlementPreview() {
        let validInputs = true;
        const inputs = Object.fromEntries([...mount.querySelectorAll('[data-merger-settle]')].map(input => {
            const value = Number(input.value);
            const max = Number(input.max);
            if (!Number.isInteger(value) || value < 0 || value > max) validInputs = false;
            return [input.dataset.mergerSettle, Number.isFinite(value) ? value : 0];
        }));
        const holding = state?.mergerSettlement?.holding || 0;
        const remaining = holding - (inputs.sell || 0) - (inputs.trade || 0) - (inputs.keep || 0);
        const exchange = Math.floor((inputs.trade || 0) / 2);
        const summary = $('[data-role="settlement-summary"]');
        if (!summary) return;
        const valid = validInputs && remaining === 0 && (inputs.trade || 0) % 2 === 0;
        summary.className = `acquire-input-summary ${valid ? 'is-valid' : 'is-invalid'}`;
        summary.textContent = valid
            ? `分配完成 · 将换得 ${exchange} 股存续集团股票`
            : `${validInputs ? `还需分配 ${Math.abs(remaining)} 股` : '请输入范围内的整数'}${(inputs.trade || 0) % 2 ? ' · 换股数量必须为偶数' : ''}`;
        const confirm = mount.querySelector('[data-action="settleMergerShares"]');
        if (confirm) confirm.disabled = !valid;
    }

    function updateBuyPreview() {
        const summary = $('[data-role="buy-summary"]');
        if (!summary) return;
        const me = getMe();
        const selected = [...mount.querySelectorAll('[data-buy-chain]')].reduce((result, input) => {
            const rawCount = Number(input.value);
            const count = Number.isFinite(rawCount) ? rawCount : 0;
            const chain = getChain(input.dataset.buyChain);
            const max = Math.min(3, Number(chain?.sharesAvailable) || 0);
            if (!Number.isInteger(count) || count < 0 || count > max) result.valid = false;
            result.count += count;
            result.cost += count * (chain?.sharePrice || 0);
            return result;
        }, { count: 0, cost: 0, valid: true });
        const valid = selected.valid && selected.count <= 3 && selected.cost <= (me?.cash || 0);
        summary.className = `acquire-input-summary acquire-buy-summary ${valid ? '' : 'is-invalid'}`;
        summary.textContent = `${selected.valid ? `已选 ${selected.count} 股 · ${formatMoney(selected.cost)}` : '请输入库存范围内的整数'}${me && selected.valid ? ` · 余额 ${formatMoney(me.cash - selected.cost)}` : ''}`;
        const confirm = mount.querySelector('[data-action="buyShares"]');
        if (confirm) confirm.disabled = !valid;
    }

    function openDecision(config, trigger) {
        pendingConfirmation = config?.action ? config : null;
        if (!pendingConfirmation) return;
        previousFocus = trigger || document.activeElement;
        $('[data-role="decisionMark"]').textContent = config.mark || 'A';
        $('[data-role="decisionKicker"]').textContent = config.kicker || '确认决策';
        $('[data-role="decisionTitle"]').textContent = config.title || '确认操作';
        $('[data-role="decisionCopy"]').textContent = config.copy || '';
        $('[data-role="decisionSummary"]').innerHTML = config.summary || '';
        const confirm = mount.querySelector('[data-ui="confirmDecision"]');
        confirm.textContent = config.confirmLabel || '确认执行';
        confirm.className = `${config.danger ? 'acquire-end-button' : 'acquire-primary-button'}`;
        $('[data-role="decisionOverlay"]').classList.remove('is-hidden');
        $('[data-role="decisionOverlay"]').setAttribute('aria-hidden', 'false');
        confirm.focus({ preventScroll: true });
    }

    function closeDecision(restoreFocus = true) {
        $('[data-role="decisionOverlay"]').classList.add('is-hidden');
        $('[data-role="decisionOverlay"]').setAttribute('aria-hidden', 'true');
        pendingConfirmation = null;
        if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        previousFocus = null;
    }

    function confirmDecision() {
        const decision = pendingConfirmation;
        if (!decision?.action) return;
        closeDecision(false);
        const { kind, ...payload } = decision.action;
        sendAction(kind, payload);
    }

    function openRules(trigger) {
        previousFocus = trigger || document.activeElement;
        rulesOverlay.classList.remove('is-hidden');
        rulesOverlay.setAttribute('aria-hidden', 'false');
        rulesOverlay.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }

    function closeRules() {
        rulesOverlay.classList.add('is-hidden');
        rulesOverlay.setAttribute('aria-hidden', 'true');
        if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        previousFocus = null;
    }

    function onClick(event) {
        const presentationAction = event.target.closest('[data-action="skipPresentation"]');
        if (presentationAction) {
            stopPresentation();
            return;
        }
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            const ui = uiButton.dataset.ui;
            if (ui === 'rules') openRules(uiButton);
            if (ui === 'closeRules') closeRules();

            if (ui === 'cancelDecision') closeDecision();
            if (ui === 'confirmDecision') confirmDecision();
            return;
        }
        if (presentationPlaying) return;
        if (event.target === rulesOverlay) {
            closeRules();
            return;
        }
        if (event.target === $('[data-role="decisionOverlay"]')) {
            closeDecision();
            return;
        }
        const discard = event.target.closest('[data-discard-tile]');
        if (discard && !discard.disabled) {
            const tileId = discard.dataset.discardTile;
            openDecision({
                action: { kind: 'discardTile', tileId },
                mark: '×',
                kicker: '永久不可玩地块',
                title: `确认弃置 ${tileId}`,
                copy: '这块地块会连接两个安全集团，已经无法合法铺设；弃置后本回合进入购股阶段。',
                summary: `<span>弃置地块</span><strong>${escapeHtml(tileId)}</strong>`,
                confirmLabel: '确认弃置',
            }, discard);
            return;
        }
        const tile = event.target.closest('[data-tile-id]');
        if (tile && !tile.disabled) {
            pendingTileId = pendingTileId === tile.dataset.tileId ? null : tile.dataset.tileId;
            renderHand();
            return;
        }
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton || actionButton.disabled) return;
        const action = actionButton.dataset.action;
        if (action === 'confirmTile' && pendingTileId) {
            const tileId = pendingTileId;
            pendingTileId = null;
            renderHand();
            sendAction('placeTile', { tileId });
        }
        if (action === 'foundChain') {
            const chain = getChain(actionButton.dataset.chainId);
            openDecision({
                action: { kind: action, chainId: chain?.id },
                mark: chain?.short,
                kicker: '集团成立决议',
                title: `成立${chain?.name || '新'}集团`,
                copy: '确认后，相连的中立建筑会归入该集团；若股票库存充足，你将获得一股创始人股票。',
                summary: `${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain?.name || '')}</strong><small>创始人股票 ×1</small></span>`,
                confirmLabel: '确认成立集团',
            }, actionButton);
        }
        if (action === 'chooseMerger') {
            const chain = getChain(actionButton.dataset.chainId);
            const acquired = (state.pendingMerger?.chains || []).map(getChain).filter(item => item && item.id !== chain?.id);
            openDecision({
                action: { kind: action, chainId: chain?.id },
                mark: chain?.short,
                kicker: '并购存续裁决',
                title: `让${chain?.name || '该'}集团存续`,
                copy: '确认后将立即发放被收购集团的多数与少数股东奖金，并依次进入旧股处理。',
                summary: `${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain?.name || '')} · ${Number(chain?.size) || 0} 格</strong><small>收购 ${acquired.map(item => `${escapeHtml(item.name)} ${Number(item.size) || 0} 格`).join('、')}</small></span>`,
                confirmLabel: '确认存续集团',
                danger: true,
            }, actionButton);
        }
        if (action === 'skipFoundation') {
            openDecision({
                action: { kind: action },
                mark: '—',
                kicker: '放弃成立集团',
                title: '保持为独立建筑？',
                copy: '确认后不会成立集团，也不会获得创始人股票，本回合将进入购股阶段。',
                summary: '<span>当前地块</span><strong>保持中立</strong>',
                confirmLabel: '确认保持独立',
            }, actionButton);
        }
        if (action === 'skipPlacement') sendAction(action);
        if (action === 'endGame') {
            openDecision({
                action: { kind: action },
                mark: '$',
                kicker: '最终收市决议',
                title: '宣布结束并购？',
                copy: '宣布后不能撤回；你仍要完成本回合购股，随后立即发放全部股东奖金并清算所有股票。',
                summary: '<span>清算时点</span><strong>本回合交易结束后</strong>',
                confirmLabel: '确认宣布结束',
                danger: true,
            }, actionButton);
        }
        if (action === 'settleMergerShares') {
            const values = Object.fromEntries([...mount.querySelectorAll('[data-merger-settle]')].map(input => [input.dataset.mergerSettle, Number(input.value) || 0]));
            sendAction(action, { chainId: state.mergerSettlement.chainId, sell: values.sell || 0, trade: values.trade || 0, keep: values.keep || 0 });
        }
        if (action === 'buyShares') {
            const orders = {};
            mount.querySelectorAll('[data-buy-chain]').forEach(input => { const count = Number(input.value) || 0; if (count > 0) orders[input.dataset.buyChain] = count; });
            sendAction(action, { orders });
        }
    }

    function onInput(event) {
        if (event.target.matches('[data-merger-settle]')) updateSettlementPreview();
        if (event.target.matches('[data-buy-chain]')) updateBuyPreview();
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && !rulesOverlay.classList.contains('is-hidden')) closeRules();
        else if (event.key === 'Escape' && !$('[data-role="decisionOverlay"]').classList.contains('is-hidden')) closeDecision();
        else if (event.key === 'Escape' && presentationPlaying) stopPresentation();
    }

    mount.addEventListener('click', onClick);
    mount.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);

    return {
        gameType: 'acquire',
        handleMessage(message) {
            if (message.state) {
                const firstState = !state;
                state = message.state;
                pendingTileId = null;
                if (!$('[data-role="decisionOverlay"]').classList.contains('is-hidden')) closeDecision(false);
                render();
                const sequence = Number(state.presentation?.sequence) || 0;
                if (firstState) lastPresentationSequence = sequence;
                else if (sequence > lastPresentationSequence) {
                    lastPresentationSequence = sequence;
                    enqueuePresentation(state.presentation);
                }
            }
            if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        },
        destroy() {
            stopPresentation();
            previousFocus = null;
            document.removeEventListener('keydown', onKeydown);
            mount.removeEventListener('click', onClick);
            mount.removeEventListener('input', onInput);
            document.body.classList.remove('acquire-game-active');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
