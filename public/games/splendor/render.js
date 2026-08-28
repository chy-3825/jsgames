import { ALL_TOKENS, COLORS, COLOR_GEMS, COLOR_LABELS, END_LABELS, TIER_LABELS } from './constants.js';
import { cardArt, cardBackMarkup, escapeHtml, noblePortraitMarkup, tokenTotal } from './cards.js';
import { affordableCount, choiceCounts, discounts, purchasePlan, returnState, takeHint, turnCopy } from './state.js';

/** Dynamic market, command and scoreboard rendering for 璀璨宝石. */
export function createSplendorRenderer({ mount, model, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const currentState = () => model.state;

    function render() {
        const state = currentState();
        if (!state) return;
        const app = mount.querySelector('.sp-app');
        const own = (state.players || []).find(player => player.id === state.myId);
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-my-turn', Boolean(state.availableActions?.canAct));
        app.classList.toggle('is-urgent', Boolean(state.availableActions?.canReturnTokens || state.availableActions?.canChooseNoble));
        app.classList.toggle('is-ended', state.status === 'ended');
        $('turn').innerHTML = `<span class="sp-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(turnCopy(state))}`;
        $('headerPoints').textContent = own?.points || 0;
        renderMarket();
        renderCommand();
        renderNobles();
        renderGuild();
        renderPlayers();
        renderLog();
    }

    function renderMarket() {
        const state = currentState();
        const canAct = Boolean(state.availableActions?.canAct && !model.actionPending);
        const reserveOpen = (state.myReserved?.length || 0) < 3;
        $('marketHint').textContent = state.finalRoundStart !== null && state.finalRoundStart !== undefined
            ? '终局已触发 · 完成本轮'
            : `${(state.myCards || []).length} 张发展卡已加入商会`;
        $('market').innerHTML = [3, 2, 1].map(tier => {
            const cards = state.market?.[tier] || [];
            const reserveDeckDisabled = !canAct || !reserveOpen;
            return `<section class="sp-tier sp-tier-${tier}" data-market-tier="${tier}">
                <header><span class="sp-tier-number">${TIER_LABELS[tier]}</span><div><small>第 ${tier} 级</small><h3>${tier === 3 ? '大师级' : tier === 2 ? '行家级' : '学徒级'}</h3></div>
                    <button class="sp-deck-reserve" data-action="reserveDeck" data-tier="${tier}" type="button" ${reserveDeckDisabled ? 'disabled' : ''} title="预留该等级牌库顶牌"><span class="sp-deck-stack" aria-hidden="true">${cardBackMarkup(tier, true)}${cardBackMarkup(tier, true)}${cardBackMarkup(tier, true)}</span><span>暗抽预留</span></button>
                </header><div class="sp-market-cards">${cards.length ? cards.map(card => cardMarkup(card, 'market')).join('') : '<div class="sp-empty-market">该等级牌库已耗尽</div>'}</div></section>`;
        }).join('');
    }

    function cardMarkup(card, source) {
        const state = currentState();
        const canAct = Boolean(state.availableActions?.canAct && !model.actionPending);
        const plan = purchasePlan(state, card);
        const reserveOpen = (state.myReserved?.length || 0) < 3;
        const selected = model.selectedCard?.id === card.id && model.selectedCard?.source === source;
        const buyEnabled = canAct && plan.affordable;
        const reserveEnabled = source === 'market' && canAct && reserveOpen;
        const costMarkup = COLORS.filter(color => Number(card.cost?.[color]) > 0).map(color => {
            const cost = Number(card.cost[color]);
            const covered = plan.costs[color].afterDiscount === 0;
            return `<span class="sp-cost tone-${color} ${covered ? 'is-covered' : ''}" title="${COLOR_GEMS[color]}费用 ${cost}"><i></i><b>${cost}</b></span>`;
        }).join('');
        const buyTitle = plan.affordable ? plan.goldNeeded > 0 ? `可购买，需使用 ${plan.goldNeeded} 枚黄金` : '可直接购买' : `还缺 ${plan.missing} 枚可替代资源`;
        const prompt = !canAct ? '等待交易' : buyEnabled ? '可购入 · 点选卡面' : source === 'market' && reserveOpen ? '可预留 · 点选卡面' : '点选查看';
        return `<article class="sp-dev-card tier-${card.tier} tone-${card.bonus} ${plan.affordable ? 'is-affordable' : ''} ${selected ? 'is-selected' : ''}" data-card-id="${escapeHtml(card.id)}">
            <button class="sp-card-face" data-card-select="${escapeHtml(card.id)}" data-card-source="${source}" type="button" aria-pressed="${selected}" aria-disabled="${!canAct}" ${canAct ? '' : 'data-read-only="true"'} title="${canAct ? selected ? '取消选择' : '选择这张发展卡' : '查看发展卡费用与奖励'}"><img src="${cardArt(card)}" alt="璀璨宝石发展卡插画"><span class="sp-card-veil"></span><header><strong>${Number(card.points) || '·'}</strong><span class="sp-bonus-gem" title="永久${COLOR_LABELS[card.bonus]}色折扣"><i></i><small>+1</small></span></header><div class="sp-card-costs">${costMarkup || '<span class="sp-free-card">无费用</span>'}</div><span class="sp-card-level">${TIER_LABELS[card.tier] || card.tier}</span></button>
            <footer class="${source === 'reserved' ? 'is-reserved' : ''}">${selected ? `<button class="sp-buy-button" data-action="buy" data-card-id="${escapeHtml(card.id)}" data-from-reserve="${source === 'reserved'}" type="button" ${buyEnabled ? '' : 'disabled'} title="${escapeHtml(buyTitle)}">确认购入</button>${source === 'market' ? `<button class="sp-reserve-button" data-action="reserve" data-card-id="${escapeHtml(card.id)}" type="button" ${reserveEnabled ? '' : 'disabled'} title="${reserveOpen ? '预留这张发展卡' : '预留区已满'}">确认预留</button>` : ''}` : `<span class="sp-card-prompt">${prompt}</span>`}</footer>
        </article>`;
    }

    function bankMarkup(interactive) {
        const state = currentState();
        const selected = choiceCounts(model);
        return `<div class="sp-bank" role="group" aria-label="公共宝石库存">${ALL_TOKENS.map(color => {
            const amount = Number(state.tokens?.[color]) || 0;
            const enabled = interactive && color !== 'gold' && amount > selected[color];
            return `<button class="sp-bank-token tone-${color} ${selected[color] ? 'is-selected' : ''}" data-token-color="${color}" type="button" aria-pressed="${selected[color] > 0}" ${enabled ? '' : 'disabled'} title="${COLOR_GEMS[color]}库存 ${amount}"><span class="sp-gem"><i></i></span><strong>${amount}</strong><small>${COLOR_LABELS[color]}</small>${selected[color] ? `<em>+${selected[color]}</em>` : ''}</button>`;
        }).join('')}</div>`;
    }

    function walletStrip() {
        const state = currentState();
        const wallet = state.myTokens || {};
        return `<div class="sp-command-wallet"><span>我的筹码</span><div>${ALL_TOKENS.map(color => `<i class="tone-${color}" title="${COLOR_LABELS[color]} ${wallet[color] || 0}"><b></b>${wallet[color] || 0}</i>`).join('')}</div><strong>${tokenTotal(wallet)}<small>/10</small></strong></div>`;
    }

    function renderCommand() {
        const state = currentState();
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
        const canAct = Boolean(state.availableActions?.canAct && !model.actionPending);
        command.className = `sp-command-panel ${canAct ? 'is-active' : 'is-waiting'}`;
        if (canAct) {
            const valid = validTakeChoiceProxy();
            command.innerHTML = `<header class="sp-command-heading"><div><small>选择行动</small><h2>拿取公共宝石</h2></div><button data-action="clearTokens" type="button" title="清除已选宝石" aria-label="清除已选宝石" ${model.tokenChoice.length ? '' : 'disabled'}>×</button></header>${walletStrip()}<div class="sp-bank-heading"><strong>公共库存</strong><span>${takeHint(state, model)}</span></div>${bankMarkup(true)}<button class="sp-primary" data-action="takeTokens" type="button" ${valid ? '' : 'disabled'}>确认拿取 <span>${model.tokenChoice.length || 0}</span></button><div class="sp-market-actions"><span><i class="is-buy"></i><strong>购入</strong><small>${affordableCount(state)} 张可负担</small></span><span><i class="is-reserve"></i><strong>预留</strong><small>${state.myReserved?.length || 0} / 3</small></span></div>`;
            return;
        }
        const latest = state.actionLog?.at(-1) || '等待第一笔交易';
        command.innerHTML = `<header><small>当前回合</small><h2>等待 ${escapeHtml(state.currentTurnName || '对手')}</h2></header>${walletStrip()}<div class="sp-bank-heading"><strong>公共库存</strong><span>市场实时库存</span></div>${bankMarkup(false)}<div class="sp-last-action"><small>上一笔交易</small><p>${escapeHtml(latest)}</p></div>`;
    }

    function validTakeChoiceProxy() {
        const state = currentState();
        const availableColors = COLORS.filter(color => (Number(state.tokens?.[color]) || 0) > 0).length;
        const unique = new Set(model.tokenChoice);
        if (model.tokenChoice.length === 3) return unique.size === 3;
        if (model.tokenChoice.length === 2 && unique.size === 1) return (Number(state.tokens?.[model.tokenChoice[0]]) || 0) >= 4;
        if (model.tokenChoice.length === 2 && unique.size === 2) return availableColors === 2;
        if (model.tokenChoice.length === 1) return availableColors === 1;
        return false;
    }

    function returnCommandMarkup() {
        const state = currentState();
        const { wallet, selected, required, after, valid } = returnState(state, model);
        const rows = ALL_TOKENS.map(color => `<div class="sp-return-row tone-${color}"><span class="sp-gem"><i></i></span><span><strong>${COLOR_GEMS[color]}</strong><small>持有 ${wallet[color] || 0}</small></span><div><button data-token-adjust="-1" data-token-color="${color}" type="button" title="减少归还的${COLOR_LABELS[color]}色筹码" ${selected[color] ? '' : 'disabled'}>−</button><b>${selected[color]}</b><button data-token-adjust="1" data-token-color="${color}" type="button" title="增加归还的${COLOR_LABELS[color]}色筹码" ${selected[color] < (wallet[color] || 0) ? '' : 'disabled'}>+</button></div></div>`).join('');
        return `<header class="sp-command-heading"><div><small>归还阶段</small><h2>归还超额筹码</h2></div><button data-action="clearTokens" type="button" title="清除归还选择" aria-label="清除归还选择" ${model.tokenChoice.length ? '' : 'disabled'}>×</button></header><div class="sp-return-status"><span>${model.tokenChoice.length}</span><div><strong>至少归还 ${required} 枚</strong><small>归还后将持有 ${after} / 10 枚筹码</small></div></div><div class="sp-return-list">${rows}</div><button class="sp-primary" data-action="returnTokens" type="button" ${valid ? '' : 'disabled'}>确认归还 <span>${model.tokenChoice.length}</span></button>`;
    }

    function nobleMarkup(noble, actionable, compact = false) {
        const requirements = COLORS.filter(color => Number(noble.requirements?.[color]) > 0).map(color => `<span class="tone-${color}" title="需要 ${noble.requirements[color]} 张${COLOR_LABELS[color]}色发展卡"><i></i><b>${noble.requirements[color]}</b></span>`).join('');
        return `<button class="sp-noble ${actionable ? 'is-eligible' : ''} ${compact ? 'is-compact' : ''}" data-noble-id="${escapeHtml(noble.id)}" type="button" ${actionable && !model.actionPending ? '' : 'disabled'}>${noblePortraitMarkup(noble)}<span class="sp-noble-copy"><strong>${escapeHtml(noble.name)}</strong><small>贵族</small></span><b>+${noble.points}</b><span class="sp-noble-cost">${requirements}</span></button>`;
    }

    function renderNobles() {
        const state = currentState();
        const eligibleIds = new Set((state.pendingNoble?.options || []).map(noble => noble.id));
        const canChoose = Boolean(state.availableActions?.canChooseNoble);
        $('nobleCount').textContent = `${state.nobles?.length || 0} 位`;
        $('nobles').innerHTML = (state.nobles || []).length ? state.nobles.map(noble => nobleMarkup(noble, canChoose && eligibleIds.has(noble.id))).join('') : '<div class="sp-empty">贵族已全部离场</div>';
    }

    function renderGuild() {
        const state = currentState();
        const own = (state.players || []).find(player => player.id === state.myId);
        const ownedDiscounts = discounts(state);
        const wallet = state.myTokens || {};
        $('guildSummary').textContent = `${own?.points || 0} 分 · ${state.myCards?.length || 0} 张发展卡`;
        $('walletTotal').textContent = `${tokenTotal(wallet)} / 10`;
        $('reserveCount').textContent = `${state.myReserved?.length || 0} / 3`;
        $('discounts').innerHTML = COLORS.map(color => {
            const cards = (state.myCards || []).filter(card => card.bonus === color);
            const latest = cards.at(-1);
            return `<article class="sp-discount tone-${color} ${cards.length ? 'has-cards' : ''}">${latest ? `<img src="${cardArt(latest)}" alt="">` : '<span class="sp-discount-pattern">◆</span>'}<span class="sp-discount-veil"></span><span class="sp-gem"><i></i></span><div><strong>${ownedDiscounts[color]}</strong><small>${COLOR_LABELS[color]}色折扣</small></div></article>`;
        }).join('');
        $('wallet').innerHTML = ALL_TOKENS.map(color => `<span class="sp-wallet-token tone-${color}"><i class="sp-gem"><b></b></i><strong>${wallet[color] || 0}</strong><small>${COLOR_LABELS[color]}</small></span>`).join('');
        $('reserved').innerHTML = (state.myReserved || []).length ? state.myReserved.map(card => cardMarkup(card, 'reserved')).join('') : '<div class="sp-empty-reserve"><span>0</span><strong>没有预留发展卡</strong></div>';
    }

    function renderPlayers() {
        const state = currentState();
        $('players').innerHTML = (state.players || []).map((player, index) => {
            const total = tokenTotal(player.tokens);
            return `<article class="sp-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}"><span class="sp-player-order">${String(index + 1).padStart(2, '0')}</span><span class="sp-avatar">${escapeHtml(player.name.slice(0, 1))}</span><span class="sp-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${player.isOnline === false ? '离线' : player.isCurrentTurn ? '正在交易' : `${player.cardCount || 0} 卡 · ${player.reservedCount || 0} 预留`}</small></span><b>${player.points || 0}</b><div class="sp-player-assets"><span>${total} 筹码</span><i></i><span>${player.cardCount || 0} 折扣</span></div></article>`;
        }).join('');
    }

    function renderLog() {
        const state = currentState();
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<p>交易开始后，行动记录会显示在这里。</p>';
    }

    return { render, renderMarket, renderCommand, renderGuild };
}
