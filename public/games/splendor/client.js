const COLORS = ['white', 'blue', 'green', 'red', 'black'];
const ALL_TOKENS = [...COLORS, 'gold'];
const COLOR_LABELS = { white: '白', blue: '蓝', green: '绿', red: '红', black: '黑', gold: '黄金' };
const COLOR_GEMS = { white: '钻石', blue: '蓝宝石', green: '祖母绿', red: '红宝石', black: '缟玛瑙', gold: '黄金' };
const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' };
const END_LABELS = {
    points: '最后一轮完成，商会结算',
    players: '在线玩家不足，商会关闭',
};
const SPLENDOR_ART_BY_TIER = {
    1: [5, 6, 7],
    2: [3, 4, 8],
    3: [1, 2],
};
const NOBLE_PORTRAIT_BY_ID = { n1: 1, n2: 2, n3: 3, n4: 4, n5: 5, n6: 1, n7: 2, n8: 3, n9: 4, n10: 5 };

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const tokenTotal = tokens => ALL_TOKENS.reduce((sum, color) => sum + (Number(tokens?.[color]) || 0), 0);

function cardArt(card) {
    const pool = SPLENDOR_ART_BY_TIER[Number(card?.tier)] || SPLENDOR_ART_BY_TIER[1];
    const seed = String(card?.id ?? `${card?.tier}-${card?.bonus}-${card?.points}`);
    const hash = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
    return `/assets/bgg/splendor/art-${pool[hash % pool.length]}.jpg`;
}

function cardBackMarkup(tier, compact = false) {
    const level = TIER_LABELS[tier] || tier;
    return `<span class="sp-card-back tier-${tier} ${compact ? 'is-compact' : ''}" aria-hidden="true"><i></i><b>${level}</b></span>`;
}

function noblePortraitMarkup(noble, extraClass = '') {
    const portrait = NOBLE_PORTRAIT_BY_ID[noble?.id] || 1;
    return `<span class="sp-noble-portrait portrait-${portrait} ${extraClass}" aria-hidden="true"><i></i></span>`;
}

function presentationCardMarkup(card, extraClass = '') {
    if (!card) return '';
    const costs = COLORS.filter(color => Number(card.cost?.[color]) > 0)
        .map(color => `<span class="sp-cost tone-${color}"><i></i><b>${Number(card.cost[color])}</b></span>`).join('');
    return `<article class="sp-dev-card sp-event-card tier-${card.tier} tone-${card.bonus} ${extraClass}">
        <div class="sp-card-face">
            <img src="${cardArt(card)}" alt="璀璨宝石发展卡插画">
            <span class="sp-card-veil"></span>
            <header><strong>${Number(card.points) || '·'}</strong><span class="sp-bonus-gem"><i></i><small>+1</small></span></header>
            <div class="sp-card-costs">${costs || '<span class="sp-free-card">无费用</span>'}</div>
            <span class="sp-card-level">${TIER_LABELS[card.tier] || card.tier}</span>
        </div>
    </article>`;
}

export function createGameClient({ mount, send, addLog, leaveRoom }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `/games/splendor/style.css?v=${Date.now()}`;
    document.head.appendChild(style);
    document.body.classList.add('is-splendor-view');

    let state = null;
    let tokenChoice = [];
    let selectedCard = null;
    let actionPending = false;
    let rulesTrigger = null;
    let lastPresentationSequence = 0;
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    mount.innerHTML = `<section class="sp-app">
        <header class="sp-header">
            <div class="sp-brand">
                <span class="sp-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <div><small>文艺复兴宝石商会</small><h1>璀璨宝石</h1></div>
            </div>
            <div class="sp-turn" data-role="turn" aria-live="polite"><span class="sp-live-dot"></span>等待游戏状态</div>
            <div class="sp-header-score"><small>声望</small><strong data-role="headerPoints">0</strong><span>/ 15</span></div>
            <div class="sp-header-actions">
                <button class="sp-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button>
                <button class="sp-leave-button" data-ui="leave" type="button">离开商会</button>
            </div>
        </header>

        <main class="sp-layout">
            <section class="sp-market-stage">
                <header class="sp-section-header">
                    <div><small>公开牌列</small><h2>发展卡市场</h2></div>
                    <span data-role="marketHint">三级公开市场</span>
                </header>
                <div class="sp-market" data-role="market"></div>
            </section>

            <aside class="sp-command-column">
                <section class="sp-command-panel" data-role="command"></section>
                <section class="sp-nobles-panel">
                    <header><div><small>来访席位</small><h2>贵族来访</h2></div><span data-role="nobleCount">0 位</span></header>
                    <div class="sp-nobles" data-role="nobles"></div>
                </section>
            </aside>

            <section class="sp-guild" data-role="guild">
                <header class="sp-section-header">
                    <div><small>个人资产</small><h2>我的宝石商会</h2></div>
                    <span data-role="guildSummary">0 分 · 0 张发展卡</span>
                </header>
                <div class="sp-guild-grid">
                    <section class="sp-guild-assets">
                        <div class="sp-subheading"><strong>永久折扣</strong><small>发展卡奖励</small></div>
                        <div class="sp-discounts" data-role="discounts"></div>
                        <div class="sp-subheading sp-wallet-heading"><strong>持有筹码</strong><small data-role="walletTotal">0 / 10</small></div>
                        <div class="sp-wallet" data-role="wallet"></div>
                    </section>
                    <section class="sp-reserved-zone">
                        <div class="sp-subheading"><strong>私密预留</strong><small data-role="reserveCount">0 / 3</small></div>
                        <div class="sp-reserved" data-role="reserved"></div>
                    </section>
                </div>
            </section>

            <aside class="sp-table-rail">
                <section class="sp-players-panel">
                    <header><small>商会排名</small><h2>商会席位</h2></header>
                    <div class="sp-players" data-role="players"></div>
                </section>
                <section class="sp-log-panel">
                    <header><small>本桌记录</small><h2>交易记录</h2></header>
                    <div class="sp-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="sp-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
            <svg class="sp-action-lines" data-role="actionLines" aria-hidden="true">
                <defs>
                    <filter id="spLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
                    <marker id="spLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker>
                </defs>
                <path data-role="actionPath"></path>
            </svg>
            <div class="sp-transaction-stage" data-role="transactionStage" role="status" aria-live="assertive"></div>
            <button class="sp-presentation-skip" data-action="skipPresentation" type="button">跳过</button>
        </div>

        <div class="sp-overlay is-hidden" data-role="rules" role="presentation">
            <article class="sp-rules" role="dialog" aria-modal="true" aria-labelledby="spRulesTitle">
                <button class="sp-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="sp-rules-art" aria-hidden="true">
                    <div class="sp-rules-scene">
                        <header><small>一回合 · 一项行动</small><strong>从宝石到声望</strong></header>
                        <div class="sp-rules-route">
                            <section class="sp-rules-step sp-rules-gem-step">
                                <span class="sp-rules-number">01</span>
                                <div class="sp-rules-gems"><i class="tone-white"></i><i class="tone-blue"></i><i class="tone-green"></i><i class="tone-red"></i><i class="tone-black"></i><i class="tone-gold"></i></div>
                                <b>拿取筹码</b><small>积累宝石</small>
                            </section>
                            <em>›</em>
                            <section class="sp-rules-step">
                                <span class="sp-rules-number">02</span>
                                <div class="sp-rules-card"><img src="/assets/bgg/splendor/art-2.jpg" alt=""><span>2</span><i></i><b>+1</b></div>
                                <b>购买发展</b><small>获得永久折扣</small>
                            </section>
                            <em>›</em>
                            <section class="sp-rules-step">
                                <span class="sp-rules-number">03</span>
                                ${noblePortraitMarkup({ id: 'n3' }, 'sp-rules-noble')}
                                <b>迎接贵族</b><small>取得声望</small>
                            </section>
                        </div>
                        <div class="sp-rules-decks">${cardBackMarkup(1)}${cardBackMarkup(2)}${cardBackMarkup(3)}</div>
                    </div>
                    <span class="sp-rules-target">15<small>声望目标</small></span>
                </div>
                <div class="sp-rules-copy">
                    <small>基础版规则</small>
                    <h2 id="spRulesTitle">用折扣建立你的宝石商会</h2>
                    <ol>
                        <li><b>选择行动</b><span>每回合只能执行一项：拿取宝石、预留发展卡，或购买一张公开或已预留的发展卡。</span></li>
                        <li><b>拿取宝石</b><span>通常拿三种不同颜色；拿两枚同色时，该色行动前至少有四枚。库存颜色不足时，改拿现有的两种或一种。</span></li>
                        <li><b>购买与折扣</b><span>发展卡提供永久同色折扣。支付折扣后的费用，黄金可以代替任意缺少的颜色。</span></li>
                        <li><b>预留</b><span>可预留一张公开牌或暗抽任意等级牌库顶牌，最多三张；公共黄金有剩余时同时获得一枚。</span></li>
                        <li><b>贵族与终局</b><span>满足条件后每回合至多获得一位贵族。有人达到 15 分后完成当前轮，最高分获胜；同分时发展卡较少者胜。</span></li>
                    </ol>
                    <div class="sp-rules-limits"><span><i>10</i>筹码上限</span><span><i>3</i>预留上限</span><span><i>15</i>终局分数</span></div>
                    <p>本桌实现 2–4 人官方基础版，不包含城市、东方、漫威版或双人版扩展。</p>
                </div>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    function me() {
        return (state?.players || []).find(player => player.id === state.myId) || null;
    }

    function discounts() {
        return Object.fromEntries(COLORS.map(color => [color, (state?.myCards || []).filter(card => card.bonus === color).length]));
    }

    function purchasePlan(card) {
        const ownedDiscounts = discounts();
        const wallet = state?.myTokens || {};
        const costs = {};
        let goldNeeded = 0;
        for (const color of COLORS) {
            const printed = Number(card?.cost?.[color]) || 0;
            const afterDiscount = Math.max(0, printed - ownedDiscounts[color]);
            const paid = Math.min(afterDiscount, Number(wallet[color]) || 0);
            const gap = afterDiscount - paid;
            goldNeeded += gap;
            costs[color] = { printed, discount: ownedDiscounts[color], afterDiscount, paid, gap };
        }
        const gold = Number(wallet.gold) || 0;
        return { costs, goldNeeded, gold, missing: Math.max(0, goldNeeded - gold), affordable: goldNeeded <= gold };
    }

    function turnCopy() {
        if (state.status === 'ended') {
            const winners = (state.winners || []).map(player => player.name).join('、');
            return winners ? `${winners} 赢得宝石商会` : END_LABELS[state.endReason] || '本局结束';
        }
        if (state.pendingTokenReturn) {
            return state.availableActions?.canReturnTokens
                ? `请归还 ${state.availableActions.returnTokenCount} 枚筹码`
                : `${state.pendingTokenReturn.playerName || '当前玩家'}正在归还筹码`;
        }
        if (state.pendingNoble) {
            return state.availableActions?.canChooseNoble
                ? '请选择一位来访贵族'
                : `${state.pendingNoble.playerName || '当前玩家'}正在接待贵族`;
        }
        const final = state.finalRoundStart !== null && state.finalRoundStart !== undefined ? ' · 最后一轮' : '';
        return state.availableActions?.canAct ? `你的回合 · 选择一项交易${final}` : `${state.currentTurnName || '对手'}正在行动${final}`;
    }

    function render() {
        if (!state) return;
        const app = mount.querySelector('.sp-app');
        const own = me();
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-my-turn', Boolean(state.availableActions?.canAct));
        app.classList.toggle('is-urgent', Boolean(state.availableActions?.canReturnTokens || state.availableActions?.canChooseNoble));
        app.classList.toggle('is-ended', state.status === 'ended');
        $('turn').innerHTML = `<span class="sp-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(turnCopy())}`;
        $('headerPoints').textContent = own?.points || 0;
        renderMarket();
        renderCommand();
        renderNobles();
        renderGuild();
        renderPlayers();
        renderLog();
    }

    function renderMarket() {
        const canAct = Boolean(state.availableActions?.canAct && !actionPending);
        const reserveOpen = (state.myReserved?.length || 0) < 3;
        $('marketHint').textContent = state.finalRoundStart !== null && state.finalRoundStart !== undefined
            ? '终局已触发 · 完成本轮'
            : `${(state.myCards || []).length} 张发展卡已加入商会`;
        $('market').innerHTML = [3, 2, 1].map(tier => {
            const cards = state.market?.[tier] || [];
            const reserveDeckDisabled = !canAct || !reserveOpen;
            return `<section class="sp-tier sp-tier-${tier}" data-market-tier="${tier}">
                <header>
                    <span class="sp-tier-number">${TIER_LABELS[tier]}</span>
                    <div><small>第 ${tier} 级</small><h3>${tier === 3 ? '大师级' : tier === 2 ? '行家级' : '学徒级'}</h3></div>
                    <button class="sp-deck-reserve" data-action="reserveDeck" data-tier="${tier}" type="button" ${reserveDeckDisabled ? 'disabled' : ''} title="预留该等级牌库顶牌">
                        <span class="sp-deck-stack" aria-hidden="true">${cardBackMarkup(tier, true)}${cardBackMarkup(tier, true)}${cardBackMarkup(tier, true)}</span><span>暗抽预留</span>
                    </button>
                </header>
                <div class="sp-market-cards">${cards.length ? cards.map(card => cardMarkup(card, 'market')).join('') : '<div class="sp-empty-market">该等级牌库已耗尽</div>'}</div>
            </section>`;
        }).join('');
    }

    function cardMarkup(card, source) {
        const canAct = Boolean(state.availableActions?.canAct && !actionPending);
        const plan = purchasePlan(card);
        const reserveOpen = (state.myReserved?.length || 0) < 3;
        const selected = selectedCard?.id === card.id && selectedCard?.source === source;
        const buyEnabled = canAct && plan.affordable;
        const reserveEnabled = source === 'market' && canAct && reserveOpen;
        const costMarkup = COLORS.filter(color => Number(card.cost?.[color]) > 0).map(color => {
            const cost = Number(card.cost[color]);
            const covered = plan.costs[color].afterDiscount === 0;
            return `<span class="sp-cost tone-${color} ${covered ? 'is-covered' : ''}" title="${COLOR_GEMS[color]}费用 ${cost}"><i></i><b>${cost}</b></span>`;
        }).join('');
        const buyTitle = plan.affordable
            ? plan.goldNeeded > 0 ? `可购买，需使用 ${plan.goldNeeded} 枚黄金` : '可直接购买'
            : `还缺 ${plan.missing} 枚可替代资源`;
        const prompt = !canAct
            ? '等待交易'
            : buyEnabled
                ? '可购入 · 点选卡面'
                : source === 'market' && reserveOpen
                    ? '可预留 · 点选卡面'
                    : '点选查看';
        return `<article class="sp-dev-card tier-${card.tier} tone-${card.bonus} ${plan.affordable ? 'is-affordable' : ''} ${selected ? 'is-selected' : ''}" data-card-id="${escapeHtml(card.id)}">
            <button class="sp-card-face" data-card-select="${escapeHtml(card.id)}" data-card-source="${source}" type="button" aria-pressed="${selected}" ${canAct ? '' : 'disabled'} title="${selected ? '取消选择' : '选择这张发展卡'}">
                <img src="${cardArt(card)}" alt="璀璨宝石发展卡插画">
                <span class="sp-card-veil"></span>
                <header><strong>${Number(card.points) || '·'}</strong><span class="sp-bonus-gem" title="永久${COLOR_LABELS[card.bonus]}色折扣"><i></i><small>+1</small></span></header>
                <div class="sp-card-costs">${costMarkup || '<span class="sp-free-card">无费用</span>'}</div>
                <span class="sp-card-level">${TIER_LABELS[card.tier] || card.tier}</span>
            </button>
            <footer class="${source === 'reserved' ? 'is-reserved' : ''}">
                ${selected ? `<button class="sp-buy-button" data-action="buy" data-card-id="${escapeHtml(card.id)}" data-from-reserve="${source === 'reserved'}" type="button" ${buyEnabled ? '' : 'disabled'} title="${escapeHtml(buyTitle)}">确认购入</button>
                ${source === 'market' ? `<button class="sp-reserve-button" data-action="reserve" data-card-id="${escapeHtml(card.id)}" type="button" ${reserveEnabled ? '' : 'disabled'} title="${reserveOpen ? '预留这张发展卡' : '预留区已满'}">确认预留</button>` : ''}` : `<span class="sp-card-prompt">${prompt}</span>`}
            </footer>
        </article>`;
    }

    function choiceCounts() {
        return Object.fromEntries(ALL_TOKENS.map(color => [color, tokenChoice.filter(item => item === color).length]));
    }

    function validTakeChoice() {
        const availableColors = COLORS.filter(color => (Number(state.tokens?.[color]) || 0) > 0).length;
        const unique = new Set(tokenChoice);
        if (tokenChoice.length === 3) return unique.size === 3;
        if (tokenChoice.length === 2 && unique.size === 1) return (Number(state.tokens?.[tokenChoice[0]]) || 0) >= 4;
        if (tokenChoice.length === 2 && unique.size === 2) return availableColors === 2;
        if (tokenChoice.length === 1) return availableColors === 1;
        return false;
    }

    function takeHint() {
        if (!tokenChoice.length) return '0 枚已选';
        if (validTakeChoice()) return tokenChoice.map(color => COLOR_LABELS[color]).join(' · ');
        const unique = new Set(tokenChoice);
        if (tokenChoice.length === 1 && (state.tokens?.[tokenChoice[0]] || 0) >= 4) return '可再取同色，或选择其他颜色';
        if (unique.size === tokenChoice.length && tokenChoice.length < 3) return `还可选择 ${3 - tokenChoice.length} 种颜色`;
        return '当前组合不符合拿取规则';
    }

    function bankMarkup(interactive) {
        const selected = choiceCounts();
        return `<div class="sp-bank" role="group" aria-label="公共宝石库存">${ALL_TOKENS.map(color => {
            const amount = Number(state.tokens?.[color]) || 0;
            const enabled = interactive && color !== 'gold' && amount > selected[color];
            return `<button class="sp-bank-token tone-${color} ${selected[color] ? 'is-selected' : ''}" data-token-color="${color}" type="button" aria-pressed="${selected[color] > 0}" ${enabled ? '' : 'disabled'} title="${COLOR_GEMS[color]}库存 ${amount}">
                <span class="sp-gem"><i></i></span><strong>${amount}</strong><small>${COLOR_LABELS[color]}</small>${selected[color] ? `<em>+${selected[color]}</em>` : ''}
            </button>`;
        }).join('')}</div>`;
    }

    function walletStrip() {
        const wallet = state.myTokens || {};
        return `<div class="sp-command-wallet"><span>我的筹码</span><div>${ALL_TOKENS.map(color => `<i class="tone-${color}" title="${COLOR_LABELS[color]} ${wallet[color] || 0}"><b></b>${wallet[color] || 0}</i>`).join('')}</div><strong>${tokenTotal(wallet)}<small>/10</small></strong></div>`;
    }

    function renderCommand() {
        const command = $('command');
        if (state.status === 'ended') {
            const winners = state.winners || [];
            const names = winners.map(player => player.name).join('、') || '无人获胜';
            const points = winners[0]?.points || 0;
            command.className = 'sp-command-panel is-ended';
            command.innerHTML = `<header><small>结算结果</small><h2>商会结算</h2></header><div class="sp-result-mark">◆</div><div class="sp-result-score"><strong>${points}</strong><span>声望</span></div><p>${escapeHtml(names)}</p><b>${escapeHtml(END_LABELS[state.endReason] || '本局结束')}</b>`;
            return;
        }

        if (state.availableActions?.canReturnTokens) {
            command.className = 'sp-command-panel is-returning';
            command.innerHTML = returnCommandMarkup();
            return;
        }

        if (state.availableActions?.canChooseNoble) {
            const options = state.pendingNoble?.options || [];
            command.className = 'sp-command-panel is-noble-choice';
            command.innerHTML = `<header><small>选择贵族</small><h2>选择来访贵族</h2></header>${walletStrip()}<div class="sp-choice-copy"><strong>${options.length} 位贵族符合条件</strong><small>本回合只能获得一位贵族的 3 点声望</small></div><div class="sp-command-nobles">${options.map(noble => nobleMarkup(noble, true, true)).join('')}</div>`;
            return;
        }

        const canAct = Boolean(state.availableActions?.canAct && !actionPending);
        command.className = `sp-command-panel ${canAct ? 'is-active' : 'is-waiting'}`;
        if (canAct) {
            const valid = validTakeChoice();
            command.innerHTML = `<header class="sp-command-heading"><div><small>选择行动</small><h2>拿取公共宝石</h2></div><button data-action="clearTokens" type="button" title="清除已选宝石" aria-label="清除已选宝石" ${tokenChoice.length ? '' : 'disabled'}>×</button></header>
                ${walletStrip()}
                <div class="sp-bank-heading"><strong>公共库存</strong><span>${takeHint()}</span></div>
                ${bankMarkup(true)}
                <button class="sp-primary" data-action="takeTokens" type="button" ${valid ? '' : 'disabled'}>确认拿取 <span>${tokenChoice.length || 0}</span></button>
                <div class="sp-market-actions"><span><i class="is-buy"></i><strong>购入</strong><small>${affordableCount()} 张可负担</small></span><span><i class="is-reserve"></i><strong>预留</strong><small>${state.myReserved?.length || 0} / 3</small></span></div>`;
            return;
        }

        const latest = state.actionLog?.at(-1) || '等待第一笔交易';
        command.innerHTML = `<header><small>当前回合</small><h2>等待 ${escapeHtml(state.currentTurnName || '对手')}</h2></header>${walletStrip()}<div class="sp-bank-heading"><strong>公共库存</strong><span>市场实时库存</span></div>${bankMarkup(false)}<div class="sp-last-action"><small>上一笔交易</small><p>${escapeHtml(latest)}</p></div>`;
    }

    function affordableCount() {
        return [1, 2, 3].flatMap(tier => state.market?.[tier] || []).filter(card => purchasePlan(card).affordable).length
            + (state.myReserved || []).filter(card => purchasePlan(card).affordable).length;
    }

    function returnCommandMarkup() {
        const wallet = state.myTokens || {};
        const selected = choiceCounts();
        const required = Number(state.availableActions?.returnTokenCount) || 0;
        const after = tokenTotal(wallet) - tokenChoice.length;
        const valid = tokenChoice.length >= required && after <= 10 && !actionPending;
        const rows = ALL_TOKENS.map(color => `<div class="sp-return-row tone-${color}">
            <span class="sp-gem"><i></i></span><span><strong>${COLOR_GEMS[color]}</strong><small>持有 ${wallet[color] || 0}</small></span>
            <div><button data-token-adjust="-1" data-token-color="${color}" type="button" title="减少归还的${COLOR_LABELS[color]}色筹码" ${selected[color] ? '' : 'disabled'}>−</button><b>${selected[color]}</b><button data-token-adjust="1" data-token-color="${color}" type="button" title="增加归还的${COLOR_LABELS[color]}色筹码" ${selected[color] < (wallet[color] || 0) ? '' : 'disabled'}>+</button></div>
        </div>`).join('');
        return `<header class="sp-command-heading"><div><small>归还阶段</small><h2>归还超额筹码</h2></div><button data-action="clearTokens" type="button" title="清除归还选择" aria-label="清除归还选择" ${tokenChoice.length ? '' : 'disabled'}>×</button></header>
            <div class="sp-return-status"><span>${tokenChoice.length}</span><div><strong>至少归还 ${required} 枚</strong><small>归还后将持有 ${after} / 10 枚筹码</small></div></div>
            <div class="sp-return-list">${rows}</div>
            <button class="sp-primary" data-action="returnTokens" type="button" ${valid ? '' : 'disabled'}>确认归还 <span>${tokenChoice.length}</span></button>`;
    }

    function nobleMarkup(noble, actionable, compact = false) {
        const requirements = COLORS.filter(color => Number(noble.requirements?.[color]) > 0).map(color => `<span class="tone-${color}" title="需要 ${noble.requirements[color]} 张${COLOR_LABELS[color]}色发展卡"><i></i><b>${noble.requirements[color]}</b></span>`).join('');
        return `<button class="sp-noble ${actionable ? 'is-eligible' : ''} ${compact ? 'is-compact' : ''}" data-noble-id="${escapeHtml(noble.id)}" type="button" ${actionable && !actionPending ? '' : 'disabled'}>
            ${noblePortraitMarkup(noble)}<span class="sp-noble-copy"><strong>${escapeHtml(noble.name)}</strong><small>贵族</small></span><b>+${noble.points}</b><span class="sp-noble-cost">${requirements}</span>
        </button>`;
    }

    function renderNobles() {
        const eligibleIds = new Set((state.pendingNoble?.options || []).map(noble => noble.id));
        const canChoose = Boolean(state.availableActions?.canChooseNoble);
        $('nobleCount').textContent = `${state.nobles?.length || 0} 位`;
        $('nobles').innerHTML = (state.nobles || []).length
            ? state.nobles.map(noble => nobleMarkup(noble, canChoose && eligibleIds.has(noble.id))).join('')
            : '<div class="sp-empty">贵族已全部离场</div>';
    }

    function renderGuild() {
        const own = me();
        const ownedDiscounts = discounts();
        const wallet = state.myTokens || {};
        $('guildSummary').textContent = `${own?.points || 0} 分 · ${state.myCards?.length || 0} 张发展卡`;
        $('walletTotal').textContent = `${tokenTotal(wallet)} / 10`;
        $('reserveCount').textContent = `${state.myReserved?.length || 0} / 3`;
        $('discounts').innerHTML = COLORS.map(color => {
            const cards = (state.myCards || []).filter(card => card.bonus === color);
            const latest = cards.at(-1);
            return `<article class="sp-discount tone-${color} ${cards.length ? 'has-cards' : ''}">
                ${latest ? `<img src="${cardArt(latest)}" alt="">` : '<span class="sp-discount-pattern">◆</span>'}<span class="sp-discount-veil"></span><span class="sp-gem"><i></i></span><div><strong>${ownedDiscounts[color]}</strong><small>${COLOR_LABELS[color]}色折扣</small></div>
            </article>`;
        }).join('');
        $('wallet').innerHTML = ALL_TOKENS.map(color => `<span class="sp-wallet-token tone-${color}"><i class="sp-gem"><b></b></i><strong>${wallet[color] || 0}</strong><small>${COLOR_LABELS[color]}</small></span>`).join('');
        $('reserved').innerHTML = (state.myReserved || []).length
            ? state.myReserved.map(card => cardMarkup(card, 'reserved')).join('')
            : '<div class="sp-empty-reserve"><span>0</span><strong>没有预留发展卡</strong></div>';
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map((player, index) => {
            const total = tokenTotal(player.tokens);
            return `<article class="sp-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}">
                <span class="sp-player-order">${String(index + 1).padStart(2, '0')}</span><span class="sp-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span class="sp-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${player.isOnline === false ? '离线' : player.isCurrentTurn ? '正在交易' : `${player.cardCount || 0} 卡 · ${player.reservedCount || 0} 预留`}</small></span><b>${player.points || 0}</b>
                <div class="sp-player-assets"><span>${total} 筹码</span><i></i><span>${player.cardCount || 0} 折扣</span></div>
            </article>`;
        }).join('');
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('')
            : '<p>交易开始后，行动记录会显示在这里。</p>';
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
        layer.className = `sp-presentation-layer is-active is-${kind}`;
        $('transactionStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'sp-presentation-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('transactionStage').innerHTML = '';
    }

    function playerAnchor(playerId) {
        if (String(playerId) === String(state?.myId)) return $('guild');
        return [...mount.querySelectorAll('[data-player-id]')]
            .find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function marketAnchor(tier) {
        return mount.querySelector(`[data-market-tier="${Number(tier)}"]`) || mount.querySelector('.sp-market-stage');
    }

    function bankAnchor() {
        return mount.querySelector('.sp-command-panel .sp-bank') || mount.querySelector('.sp-command-panel');
    }

    function drawActionLine(fromElement, toElement, tone = 'gold') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(45, Math.min(155, Math.abs(x2 - x1) * .2 + Math.abs(y2 - y1) * .12));
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', `is-visible tone-${tone}`);
    }

    function setMotionOrigin(source, element) {
        if (!source || !element) return;
        const from = source.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--sp-from-x', `${from.left + from.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--sp-from-y', `${from.top + from.height / 2 - (target.top + target.height / 2)}px`);
    }

    function setMotionDestination(destination, element) {
        if (!destination || !element) return;
        const to = destination.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--sp-to-x', `${to.left + to.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--sp-to-y', `${to.top + to.height / 2 - (target.top + target.height / 2)}px`);
    }

    function eventGems(colors = []) {
        return colors.map((color, index) => `<span class="sp-event-gem tone-${color}" style="--sp-gem-order:${index}"><i class="sp-gem"><b></b></i><small>${escapeHtml(COLOR_LABELS[color] || color)}</small></span>`).join('');
    }

    function paymentGems(payment = {}) {
        return ALL_TOKENS.filter(color => Number(payment[color]) > 0)
            .map(color => `<span class="tone-${color}"><i class="sp-gem"><b></b></i><strong>×${Number(payment[color])}</strong><small>${escapeHtml(COLOR_LABELS[color])}</small></span>`).join('');
    }

    async function playTokenPresentation(event, token) {
        const returning = event.kind === 'returnTokens';
        showPresentation(returning ? 'return' : 'take', `<div class="sp-token-event">
            <span class="sp-event-kicker">${escapeHtml(event.playerName)}${returning ? '归还筹码' : '拿取公共宝石'}</span>
            <div class="sp-gem-motion">${eventGems(event.colors)}</div>
            <h2>${returning ? '宝石归还银行' : '宝石收入商会'}</h2>
            <p>${event.tokenTotalBefore} → ${event.tokenTotalAfter} 枚筹码</p>
        </div>`);
        const motion = $('transactionStage').querySelector('.sp-gem-motion');
        const source = returning ? playerAnchor(event.playerId) : bankAnchor();
        const destination = returning ? bankAnchor() : playerAnchor(event.playerId);
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, returning ? 'return' : 'gem');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(390, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, returning ? 'return' : 'gem');
        destination?.classList.add('is-event-impact');
        if (!await presentationDelay(720, token)) return;
        $('presentationLayer').classList.add('is-settled');
        await presentationDelay(250, token);
    }

    function reserveCardStage(event) {
        const face = event.card ? presentationCardMarkup(event.card, 'is-reserve-face') : '';
        const back = cardBackMarkup(event.tier);
        return `<div class="sp-reserve-card ${event.source === 'deck' ? 'starts-hidden' : ''}">
            ${face ? `<div class="sp-reserve-side is-face">${face}</div>` : ''}
            <div class="sp-reserve-side is-back">${back}</div>
        </div>`;
    }

    async function playReservePresentation(event, token) {
        const hiddenDraw = event.source === 'deck';
        showPresentation('reserve', `<div class="sp-reserve-event">
            <span class="sp-event-kicker">${escapeHtml(event.playerName)}预留发展卡</span>
            <div class="sp-card-motion">${reserveCardStage(event)}</div>
            <h2>${hiddenDraw ? `暗中预留 ${TIER_LABELS[event.tier] || event.tier} 级卡牌` : '公开商品已经锁定'}</h2>
            <p>${event.gainedGold ? '同时获得一枚黄金筹码' : '黄金库存已空，仅保留卡牌'}</p>
            ${event.gainedGold ? '<span class="sp-event-gold tone-gold"><i class="sp-gem"><b></b></i><small>黄金 +1</small></span>' : ''}
        </div>`);
        const motion = $('transactionStage').querySelector('.sp-card-motion');
        const source = marketAnchor(event.tier);
        const destination = playerAnchor(event.playerId);
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'reserve');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(hiddenDraw ? 520 : 620, token)) return;
        $('presentationLayer').classList.add('is-sealed');
        if (!await presentationDelay(hiddenDraw ? 160 : 430, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'reserve');
        destination?.classList.add('is-event-impact');
        await presentationDelay(720, token);
    }

    async function playBuyPresentation(event, token) {
        const source = event.source === 'reserved' ? playerAnchor(event.playerId) : marketAnchor(event.tier);
        const destination = playerAnchor(event.playerId);
        const pointGain = Number(event.pointsAfter) - Number(event.pointsBefore);
        showPresentation('buy', `<div class="sp-buy-event">
            <span class="sp-event-kicker">${escapeHtml(event.playerName)}完成一笔购入</span>
            <div class="sp-card-motion">${presentationCardMarkup(event.card)}</div>
            <div class="sp-payment-strip">${paymentGems(event.payment) || '<span class="sp-free-payment">折扣覆盖全部费用</span>'}</div>
            <h2>永久${escapeHtml(COLOR_LABELS[event.card?.bonus] || '')}色折扣 +1</h2>
            <p>${pointGain > 0 ? `声望 ${event.pointsBefore} → ${event.pointsAfter}` : '本卡不提供额外声望'}</p>
        </div>`);
        const motion = $('transactionStage').querySelector('.sp-card-motion');
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'card');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(520, token)) return;
        $('presentationLayer').classList.add('is-paid');
        drawActionLine(playerAnchor(event.playerId), bankAnchor(), 'payment');
        bankAnchor()?.classList.add('is-event-impact');
        if (!await presentationDelay(560, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'card');
        destination?.classList.add('is-event-impact');
        await presentationDelay(760, token);
    }

    async function playNoblePresentation(event, token) {
        const destination = playerAnchor(event.playerId);
        showPresentation('noble', `<div class="sp-noble-event">
            <span class="sp-event-kicker">贵族正式来访</span>
            <div class="sp-noble-motion">${noblePortraitMarkup(event.noble, 'sp-event-noble')}</div>
            <h2>${escapeHtml(event.noble?.name || '贵族')}认可了${escapeHtml(event.playerName)}的商会</h2>
            <p>声望 ${event.pointsBefore} → ${event.pointsAfter} · +${Number(event.noble?.points) || 3}</p>
        </div>`);
        const motion = $('transactionStage').querySelector('.sp-noble-motion');
        const source = mount.querySelector('.sp-nobles-panel');
        setMotionOrigin(source, motion);
        drawActionLine(source, motion, 'noble');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(720, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, 'noble');
        destination?.classList.add('is-event-impact');
        await presentationDelay(820, token);
    }

    async function playFinalRoundPresentation(batch, token) {
        const trigger = batch.finalRoundTrigger || {};
        showPresentation('final-round', `<div class="sp-final-round-cue">
            <span class="sp-final-bell" aria-hidden="true"><i></i></span>
            <span class="sp-event-kicker">商会钟声响起</span>
            <h2>最后一轮开始</h2>
            <p>${escapeHtml(trigger.playerName || '有玩家')}达到 ${Number(trigger.points) || 15} 点声望 · 完成本轮后结算</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(1500, token);
    }

    async function playFinalePresentation(batch, token) {
        if (batch.endReason !== 'points') return;
        const winners = new Set((batch.winners || []).map(player => String(player.id)));
        const standings = batch.standings || [];
        showPresentation('finale', `<div class="sp-finale-scene">
            <span class="sp-event-kicker">最后一轮完成</span>
            <div class="sp-finale-mark" aria-hidden="true">◆</div>
            <h2>商会结算</h2>
            <div class="sp-final-standings">${standings.map((player, index) => `<article class="${winners.has(String(player.id)) ? 'is-winner' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}</strong><b>${Number(player.points) || 0}<small>声望</small></b><em>${Number(player.cardCount) || 0} 张发展卡</em></article>`).join('')}</div>
            <p>${winners.size > 1 ? '声望与发展卡数量均相同，并列获胜' : '同分时，发展卡更少者排名更高'}</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2600, token);
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.sp-app')?.classList.add('is-transaction-presenting');
        while (presentationQueue.length) {
            const item = presentationQueue.shift();
            const token = ++presentationToken;
            for (const event of item.batch?.events || []) {
                if (event.kind === 'takeTokens' || event.kind === 'returnTokens') await playTokenPresentation(event, token);
                if (event.kind === 'reserveCard') await playReservePresentation(event, token);
                if (event.kind === 'buyCard') await playBuyPresentation(event, token);
                if (event.kind === 'nobleVisit') await playNoblePresentation(event, token);
                if (token !== presentationToken) break;
                hidePresentation();
                if (!await presentationDelay(90, token)) break;
            }
            if (token !== presentationToken) continue;
            if (item.batch?.finalRoundStarted && !item.batch?.ended) await playFinalRoundPresentation(item.batch, token);
            if (token !== presentationToken) continue;
            if (item.batch?.ended || item.finaleOnly) await playFinalePresentation(item.batch, token);
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.sp-app')?.classList.remove('is-transaction-presenting');
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
        mount.querySelector('.sp-app')?.classList.remove('is-transaction-presenting');
    }

    function chooseTakeToken(color) {
        if (!COLORS.includes(color) || !state.availableActions?.canAct || actionPending) return;
        const amount = Number(state.tokens?.[color]) || 0;
        const selected = tokenChoice.filter(item => item === color).length;
        if (!amount || selected >= amount) return;
        if (tokenChoice.length >= 3) tokenChoice = [];
        const unique = new Set(tokenChoice);
        if (selected > 0) {
            if (tokenChoice.length === 1 && amount >= 4) tokenChoice.push(color);
            else tokenChoice = tokenChoice.filter(item => item !== color);
        } else if (tokenChoice.length === 2 && unique.size === 1) {
            tokenChoice = [color];
        } else {
            tokenChoice.push(color);
        }
        selectedCard = null;
        renderCommand();
        renderMarket();
        renderGuild();
    }

    function adjustReturnToken(color, direction) {
        if (!ALL_TOKENS.includes(color) || !state.availableActions?.canReturnTokens || actionPending) return;
        const count = tokenChoice.filter(item => item === color).length;
        const held = Number(state.myTokens?.[color]) || 0;
        if (direction > 0 && count < held) tokenChoice.push(color);
        if (direction < 0 && count > 0) tokenChoice.splice(tokenChoice.lastIndexOf(color), 1);
        renderCommand();
    }

    function sendAction(action) {
        if (actionPending) return;
        actionPending = true;
        send({ type: 'gameAction', action });
        render();
    }

    function openRules(trigger) {
        rulesTrigger = trigger || null;
        $('rules').classList.remove('is-hidden');
        mount.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }

    function closeRules() {
        $('rules').classList.add('is-hidden');
        rulesTrigger?.focus?.({ preventScroll: true });
        rulesTrigger = null;
    }

    function handleClick(event) {
        if (presentationPlaying) {
            if (event.target.closest('[data-action="skipPresentation"]')) stopPresentation();
            return;
        }
        const adjust = event.target.closest('[data-token-adjust]');
        if (adjust && !adjust.disabled) {
            adjustReturnToken(adjust.dataset.tokenColor, Number(adjust.dataset.tokenAdjust));
            return;
        }

        const token = event.target.closest('[data-token-color]');
        if (token && !token.disabled) {
            chooseTakeToken(token.dataset.tokenColor);
            return;
        }

        const card = event.target.closest('[data-card-select]');
        if (card && !card.disabled) {
            const next = { id: card.dataset.cardSelect, source: card.dataset.cardSource };
            selectedCard = selectedCard?.id === next.id && selectedCard?.source === next.source ? null : next;
            tokenChoice = [];
            renderMarket();
            renderGuild();
            renderCommand();
            return;
        }

        const action = event.target.closest('[data-action]');
        if (action && !action.disabled) {
            if (action.dataset.action === 'clearTokens') {
                tokenChoice = [];
                renderCommand();
            }
            if (action.dataset.action === 'takeTokens' && validTakeChoice()) {
                const colors = tokenChoice.slice();
                tokenChoice = [];
                sendAction({ kind: 'takeTokens', colors });
            }
            if (action.dataset.action === 'returnTokens') {
                const colors = tokenChoice.slice();
                tokenChoice = [];
                sendAction({ kind: 'returnTokens', colors });
            }
            if (action.dataset.action === 'buy') sendAction({ kind: 'buyCard', cardId: action.dataset.cardId, fromReserve: action.dataset.fromReserve === 'true' });
            if (action.dataset.action === 'reserve') sendAction({ kind: 'reserveCard', cardId: action.dataset.cardId });
            if (action.dataset.action === 'reserveDeck') sendAction({ kind: 'reserveCard', tier: Number(action.dataset.tier) });
            return;
        }

        const noble = event.target.closest('[data-noble-id]');
        if (noble && !noble.disabled) {
            sendAction({ kind: 'chooseNoble', nobleId: noble.dataset.nobleId });
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
            tokenChoice = [];
            selectedCard = null;
            actionPending = false;
            render();
            const sequence = Number(state.presentation?.sequence) || 0;
            if (firstState) {
                lastPresentationSequence = sequence;
            } else if (sequence > lastPresentationSequence) {
                lastPresentationSequence = sequence;
                enqueuePresentation({ batch: JSON.parse(JSON.stringify(state.presentation)) });
            } else if (previousState.status === 'playing' && state.status === 'ended' && state.endReason === 'points') {
                enqueuePresentation({ finaleOnly: true, batch: {
                    ended: true,
                    endReason: state.endReason,
                    standings: (state.players || []).slice().sort((left, right) => right.points - left.points || left.cardCount - right.cardCount),
                    winners: state.winners || [],
                } });
            }
        }
        if (message.type === 'error') {
            actionPending = false;
            if (state) render();
            addLog(message.message || '操作失败', 'error');
        }
    }

    mount.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'splendor',
        handleMessage,
        destroy() {
            stopPresentation();
            mount.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            document.body.classList.remove('is-splendor-view');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
