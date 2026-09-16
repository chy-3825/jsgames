import { PHASE_ENGLISH, PHASE_LABELS, escapeHtml, formatMoney, formatNumber, safeChainId, safeColor, tileIdFor } from './constants.js';
import { chainHeadquartersMarkup, stockCertificateMarkup } from './cards.js';
import { canPlayTile, getChain, getMe } from './state.js';

/** Dynamic board, command and market rendering for 并购. */
export function createAcquireRenderer({ mount, model, getElement }) {
    const $ = selector => getElement ? (selector.startsWith('[') ? mount.querySelector(selector) : getElement(selector)) : mount.querySelector(selector.startsWith('[') ? selector : `[data-role="${selector}"]`);
    const state = () => model.state;

    function clearError() { const banner = $('errorBanner'); banner.textContent = ''; banner.classList.add('is-hidden'); }
    function showError(message) { const banner = $('errorBanner'); banner.textContent = message || '操作失败，请重试'; banner.classList.remove('is-hidden'); banner.focus?.({ preventScroll: true }); }

    function render() {
        const current = state();
        if (!current) return;
        mount.querySelector('.acquire-app')?.setAttribute('aria-busy', String(model.actionPending));
        const me = getMe(current);
        const phase = current.status === 'ended' ? 'ended' : current.phase;
        const isMyTurn = Boolean(me?.isCurrentTurn || current.mergerSettlement?.currentPlayerId === current.myId);
        $('phase').textContent = PHASE_LABELS[phase] || '等待中';
        $('deck').textContent = current.status === 'ended' ? '封存' : formatNumber(current.deckCount);
        $('turn').innerHTML = current.status === 'ended' ? `<span class="acquire-turn-dot is-ended"></span>${escapeHtml(current.winner?.name || '本局结束')}` : `<span class="acquire-turn-dot ${isMyTurn ? 'is-mine' : ''}></span>${escapeHtml(current.currentTurnName || '等待中')}`;
        $('hand-note').textContent = `${current.myHand?.length || 0} 张 · 仅你可见`;
        renderCommand(me, phase, isMyTurn); renderBoard(); renderHand(); renderChains(); renderPlayers(); renderLog();
        if ($('detailDialog').open) renderDetails();
        const settlementDialog = $('settlementDialog');
        const settling = phase === 'merger_settlement' && current.availableActions?.canSettleMerger && current.mergerSettlement;
        if (settling) {
            if ($('command').parentElement !== settlementDialog) settlementDialog.append($('command'));
            if (!settlementDialog.open) settlementDialog.showModal();
        } else {
            if (settlementDialog.open) settlementDialog.close();
            if ($('command').parentElement === settlementDialog) $('commandAnchor').after($('command'));
        }
        if (model.actionPending) mount.querySelectorAll('[data-action]:not([data-action="skipPresentation"])').forEach(button => { button.disabled = true; });
    }

    function renderCommand(me, phase, isMyTurn) {
        const current = state();
        const available = current.availableActions || {};
        const commandKicker = $('[data-role="command-kicker"]'); const commandTitle = $('[data-role="command-title"]'); const commandCopy = $('[data-role="command-copy"]'); const commandTurn = $('[data-role="command-turn"]'); const body = $('[data-role="command-body"]'); const footer = $('[data-role="command-footer"]');
        commandKicker.textContent = PHASE_ENGLISH[phase] || '牌局状态';
        commandTurn.innerHTML = current.status === 'ended' ? '<span class="acquire-command-badge is-ended">已结算</span>' : `<span class="acquire-command-badge ${isMyTurn ? 'is-mine' : ''}">${isMyTurn ? '轮到我' : '等待中'}</span>`;
        footer.innerHTML = '';
        if (phase === 'ended') { commandTitle.textContent = current.winner?.id === current.myId ? '您已获胜' : `${current.winner?.name || '本局'} 获胜`; commandCopy.textContent = '终局账本已结算，所有存续集团股票完成清算。'; body.innerHTML = `<div class="acquire-result-banner"><strong>${formatMoney(getMe(current)?.cash)}</strong><span>我的最终现金</span><i></i><strong>${formatNumber(current.players?.length || 0)}</strong><span>参赛投资人</span></div>`; return; }
        if (phase === 'place' && available.canPlace) { commandTitle.textContent = '选择一块地块'; commandCopy.textContent = '选择手牌后确认铺设'; body.innerHTML = ''; }
        else if (phase === 'place' && available.canSkipPlacement) { commandTitle.textContent = '没有合法铺设'; commandCopy.textContent = '当前手牌无法加入版图，可以跳过铺设并进入购股。'; body.innerHTML = '<div class="acquire-command-note is-warm"><span class="acquire-note-icon">↷</span><div><strong>保留手牌，直接进入购股</strong><small>永久不可玩地块仍需按规则单独弃置。</small></div></div>'; footer.innerHTML = '<button class="acquire-secondary-button" data-action="skipPlacement" type="button">跳过铺设</button>'; }
        else if (phase === 'foundation' && available.canFound) { commandTitle.textContent = '选择新集团'; commandCopy.textContent = '这块地块可以成为酒店集团的起点。'; const chains = Object.values(current.corporations || {}).filter(chain => !chain.active); body.innerHTML = `<div class="acquire-option-grid">${chains.map(chain => chainOption(chain, 'foundChain', '启用集团')).join('')}</div>`; footer.innerHTML = '<button class="acquire-secondary-button" data-action="skipFoundation" type="button">暂不创建，保持独立</button>'; }
        else if (phase === 'merger' && available.canChooseMerger) { const pending = current.pendingMerger; const options = (pending?.chains || []).map(id => getChain(current, id)).filter(Boolean); const largest = Math.max(...options.map(chain => chain.size), 0); commandTitle.textContent = '决定存续集团'; commandCopy.textContent = '规模最大的集团必须保留；同规模时由你决定。'; body.innerHTML = `<div class="acquire-option-grid">${options.map(chain => chainOption(chain, 'chooseMerger', chain.size === largest ? '可存续' : '规模不足', chain.size < largest)).join('')}</div>`; }
        else if (phase === 'merger_settlement' && available.canSettleMerger && current.mergerSettlement) renderSettlementCommand();
        else if (phase === 'buy' && available.canBuy) renderBuyCommand();
        else { const waitingName = current.currentTurnName || '其他投资人'; commandTitle.textContent = current.endGamePending ? '终局清算即将开始' : `${waitingName} 正在行动`; commandCopy.textContent = current.endGamePending ? '当前回合完成后将发放终局红利并结算股票。' : `当前阶段：${PHASE_LABELS[phase] || '牌桌处理中'}`; body.innerHTML = `<div class="acquire-waiting"><span class="acquire-pulse"></span><span>${current.endGamePending ? '等待本回合完成' : '等待中'}</span></div>`; }
        if (available.canEndGame) footer.insertAdjacentHTML('beforeend', '<button class="acquire-end-button" data-action="endGame" type="button">宣布结束并清算</button>');
    }

    function chainOption(chain, action, label, disabled = false) { return `<button class="acquire-chain-option ${disabled ? 'is-disabled' : ''}" data-chain="${safeChainId(chain.id)}" data-action="${action}" data-chain-id="${escapeHtml(chain.id)}" style="--chain-color:${safeColor(chain.color)}" type="button" ${disabled ? 'disabled' : ''}>${chainHeadquartersMarkup(chain, 'is-option')}<span class="acquire-chain-option-copy"><strong>${escapeHtml(chain.name)}</strong><small>${label} · ${chain.size} 格${chain.active ? ` · ${formatMoney(chain.sharePrice)}/股` : ''}</small></span><span class="acquire-option-arrow">›</span></button>`; }
    function renderSettlementCommand() { const current = state(); const settlement = current.mergerSettlement; const oldChain = getChain(current, settlement.chainId); const surviving = getChain(current, settlement.survivingId); const holding = settlement.holding || 0; $('[data-role="command-title"]').textContent = `处理 ${oldChain?.name || '旧集团'} 股票`; $('[data-role="command-copy"]').textContent = `你持有 ${holding} 股旧股票；卖出 ${formatMoney(oldChain?.sharePrice || 0)} / 股，2 股换 1 股。`; $('[data-role="command-body"]').innerHTML = `<div class="acquire-settlement-route">${chainHeadquartersMarkup(oldChain, 'is-option')}<span class="acquire-route-line"></span>${chainHeadquartersMarkup(surviving, 'is-option')}<span><strong>${escapeHtml(surviving?.name || '存续集团')}</strong><small>存续集团</small></span></div><div class="acquire-settlement-grid"><label><span>卖出</span><input type="number" min="0" max="${holding}" value="0" inputmode="numeric" data-merger-settle="sell"></label><label><span>换股 <small>旧股</small></span><input type="number" min="0" max="${holding}" step="2" value="0" inputmode="numeric" data-merger-settle="trade"></label><label><span>保留</span><input type="number" min="0" max="${holding}" value="${holding}" inputmode="numeric" data-merger-settle="keep"></label></div><div class="acquire-input-summary" data-role="settlement-summary">剩余待分配 ${holding} 股</div>`; $('[data-role="command-footer"]').innerHTML = '<button class="acquire-primary-button" data-action="settleMergerShares" type="button">确认股东选择</button>'; updateSettlementPreview(); }
    function renderBuyCommand() { const current = state(); const activeChains = Object.values(current.corporations || {}).filter(chain => chain.active); $('[data-role="command-title"]').textContent = '买股'; $('[data-role="command-copy"]').textContent = '最多 3 股'; $('[data-role="command-body"]').innerHTML = activeChains.length ? `<div class="acquire-buy-grid">${activeChains.map(chain => { const max = Math.min(3, chain.sharesAvailable); return `<label class="acquire-buy-row" style="--chain-color:${safeColor(chain.color)}">${stockCertificateMarkup(chain, 0, 'market')}<span class="acquire-stock-order"><small>购买股数</small><input type="number" min="0" max="${max}" value="0" inputmode="numeric" data-buy-chain="${escapeHtml(chain.id)}" aria-label="购买${escapeHtml(chain.name)}股票数量"><em>最多 ${max}</em></span></label>`; }).join('')}</div><div class="acquire-input-summary acquire-buy-summary" data-role="buy-summary">已选 0 股 · ${formatMoney(0)}</div>` : '<div class="acquire-command-note"><span class="acquire-note-icon">—</span><div><strong>目前没有可购股票</strong><small>确认交易后结束本回合。</small></div></div>'; $('[data-role="command-footer"]').innerHTML = '<button class="acquire-primary-button" data-action="buyShares" type="button">确认交易并结束回合</button>'; updateBuyPreview(); }

    function renderBoard() {
        const current = state(); const cells = [];
        for (let row = 0; row < 9; row += 1) for (let col = 0; col < 12; col += 1) { const id = tileIdFor(row, col); const cell = current.board?.[id]; const chain = cell?.chain ? getChain(current, cell.chain) : null; const color = safeColor(chain?.color); const kind = chain ? '集团' : cell ? '中立地块' : '空位'; cells.push(`<div class="acquire-cell ${chain ? 'is-chain' : cell ? 'is-neutral' : 'is-empty'}" data-board-cell="${id}" data-chain="${safeChainId(chain?.id)}" style="--chain-color:${color}" role="gridcell" ${chain ? `tabindex="0" data-ui="chainDetails" data-chain-id="${safeChainId(chain.id)}"` : ''} aria-label="${id} ${kind}" title="${id} · ${kind}"><span class="acquire-cell-mark">${chain ? chainHeadquartersMarkup(chain, 'is-board') : cell ? '·' : ''}</span><span class="acquire-cell-id">${id}</span></div>`); }
        $('[data-role="board"]').innerHTML = cells.join('');
        const legendChains = Object.values(current.corporations || {}).filter(chain => chain.active);
        $('[data-role="board-legend"]').innerHTML = legendChains.length ? legendChains.map(chain => `<span class="acquire-legend-item" data-chain="${safeChainId(chain.id)}" style="--chain-color:${safeColor(chain.color)}">${chainHeadquartersMarkup(chain, 'is-legend')}<strong>${escapeHtml(chain.name)}</strong><small>${chain.size} 格 · ${formatMoney(chain.sharePrice)}</small></span>`).join('') : '<span class="acquire-legend-empty">尚未启用集团</span>';
    }

    function renderHand() {
        const current = state(); const hand = current.myHand || []; const canPlace = Boolean(current.availableActions?.canPlace); const canDiscard = Boolean(current.availableActions?.canDiscard);
        if (!hand.some(tile => tile.id === model.pendingTileId && canPlayTile(current, tile) && !tile.permanentlyUnplayable)) model.pendingTileId = null;
        if (!hand.length) { $('[data-role="hand"]').innerHTML = '<div class="acquire-empty-hand">手牌已用尽</div>'; $('[data-role="hand-confirm"]').classList.add('is-hidden'); $('[data-role="hand-confirm"]').innerHTML = ''; return; }
        $('[data-role="hand"]').innerHTML = hand.map(tile => { const playable = canPlayTile(current, tile); const locked = Boolean(tile.permanentlyUnplayable); const disabled = !canPlace || !playable || locked; const selected = !disabled && model.pendingTileId === tile.id; const code = String(tile.id || '--'); return `<div class="acquire-tile-wrap ${locked ? 'is-locked' : ''}"><button class="acquire-tile ${playable && canPlace ? 'is-playable' : ''} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-tile-id="${escapeHtml(tile.id)}" type="button" ${disabled ? 'disabled' : ''} aria-pressed="${selected}" title="${locked ? '永久不可玩，只能弃置' : selected ? '取消预选' : playable ? '预选这块地块' : '当前不能铺设'}"><span class="acquire-tile-corner">${escapeHtml(code)}</span><span class="acquire-tile-city" aria-hidden="true"><i></i><i></i><i></i></span><strong>${escapeHtml(code)}</strong><small>城市建筑地块</small><em>${locked ? '永久不可玩' : selected ? '已预选' : playable && canPlace ? '可铺设' : canPlace ? '不可铺设' : '等待'}</em></button>${canDiscard && locked ? `<button class="acquire-discard-button" data-discard-tile="${escapeHtml(tile.id)}" type="button">弃置地块</button>` : ''}</div>`; }).join('');
        const selectedTile = hand.find(tile => tile.id === model.pendingTileId); const confirm = $('[data-role="hand-confirm"]'); confirm.classList.toggle('is-hidden', !selectedTile || !canPlace); confirm.innerHTML = selectedTile ? `<span><small>准备铺设到城市版图</small><strong>${escapeHtml(selectedTile.id)}</strong></span><button data-action="confirmTile" type="button">确认铺设</button>` : '';
    }

    function renderChains() {
        $('chains').innerHTML = Object.values(state().corporations || {}).map(chain => `<button type="button" class="acquire-market-entry ${chain.active ? '' : 'is-off'}" data-ui="chainDetails" data-chain-id="${safeChainId(chain.id)}" data-market-chain="${safeChainId(chain.id)}" data-chain="${safeChainId(chain.id)}" aria-haspopup="dialog">
            ${chainHeadquartersMarkup(chain, 'is-option')}<strong>${escapeHtml(chain.name)}</strong><span>${chain.size || 0}${chain.size >= 11 ? ' ◆' : ''}</span><b>${chain.active ? formatMoney(chain.sharePrice) : '—'}</b><span>${chain.sharesAvailable}</span></button>`).join('');
    }
    function renderPlayers() {
        const current = state();
        const actor = current.mergerSettlement?.currentPlayerId || current.players?.find(player => player.isCurrentTurn)?.id;
        $('players').innerHTML = (current.players || []).map(player => `<button type="button" class="acquire-player-row ${player.id === actor ? 'is-current' : ''}" data-ui="playerDetails" data-player-id="${escapeHtml(player.id)}" aria-haspopup="dialog" aria-label="查看${escapeHtml(player.name)}的资产"><span class="acquire-player-dot" style="background:${safeColor(player.color)}"></span><strong>${escapeHtml(player.name)}${player.id === current.myId ? ' · 我' : ''}${player.isOnline === false ? ' · 离线' : ''}</strong><b>${formatMoney(player.cash)}</b></button>`).join('');
    }
    function renderDetails() {
        const current = state();
        if (model.detailKind === 'player') {
            const player = current.players.find(item => item.id === model.detailId);
            if (!player) { $('detailDialog').close(); return; }
            const holdings = Object.entries(player.shares || {}).filter(([, count]) => count > 0);
            const value = holdings.reduce((sum, [id, count]) => sum + count * (getChain(current, id)?.sharePrice || 0), 0);
            $('detailContent').innerHTML = `<h2 id="acquire-detail-title">${escapeHtml(player.name)}的资产</h2><p>${formatMoney(player.cash)} · 持股估值 ${formatMoney(value)}</p>${holdings.map(([id, count]) => { const chain = getChain(current, id); return `<button class="acquire-detail-row" type="button" data-ui="chainDetails" data-chain-id="${safeChainId(id)}"><strong>${escapeHtml(chain?.name || id)}</strong><span>${count} 股</span><b>${formatMoney(count * (chain?.sharePrice || 0))}</b></button>`; }).join('') || '<p>暂无持股</p>'}`;
        } else {
            const chain = getChain(current, model.detailId);
            if (!chain) { $('detailDialog').close(); return; }
            const holders = current.players.filter(player => player.shares?.[chain.id] > 0).sort((a, b) => b.shares[chain.id] - a.shares[chain.id]);
            $('detailContent').innerHTML = `<h2 id="acquire-detail-title">${escapeHtml(chain.name)}</h2><p>${chain.active ? `${chain.size} 格 · ${formatMoney(chain.sharePrice)} / 股 · 余 ${chain.sharesAvailable} 股${chain.size >= 11 ? ' · 安全集团' : ''}` : '尚未成立'}</p>${chain.active ? `<p>多数红利 ${formatMoney(chain.sharePrice * 10)} · 少数红利 ${formatMoney(chain.sharePrice * 5)}</p>` : ''}<h3>持股排名</h3>${holders.map(player => `<button class="acquire-detail-row" type="button" data-ui="playerDetails" data-player-id="${escapeHtml(player.id)}"><strong>${escapeHtml(player.name)}</strong><span>${player.shares[chain.id]} 股</span></button>`).join('') || '<p>暂无股东</p>'}`;
        }
    }
    function renderLog() { const entries = (state().actionLog || []).slice().reverse(); $('[data-role="log"]').innerHTML = entries.length ? entries.map((entry, index) => `<div class="acquire-log-entry ${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<span class="acquire-muted">等待第一笔交易</span>'; }

    function updateSettlementPreview() { let validInputs = true; const inputs = Object.fromEntries([...mount.querySelectorAll('[data-merger-settle]')].map(input => { const value = Number(input.value); const max = Number(input.max); if (!Number.isInteger(value) || value < 0 || value > max) validInputs = false; return [input.dataset.mergerSettle, Number.isFinite(value) ? value : 0]; })); const holding = state()?.mergerSettlement?.holding || 0; const remaining = holding - (inputs.sell || 0) - (inputs.trade || 0) - (inputs.keep || 0); const exchange = Math.floor((inputs.trade || 0) / 2); const summary = $('[data-role="settlement-summary"]'); if (!summary) return; const valid = validInputs && remaining === 0 && (inputs.trade || 0) % 2 === 0; summary.className = `acquire-input-summary ${valid ? 'is-valid' : 'is-invalid'}`; summary.textContent = valid ? `分配完成 · 将换得 ${exchange} 股存续集团股票` : `${validInputs ? `还需分配 ${Math.abs(remaining)} 股` : '请输入范围内的整数'}${(inputs.trade || 0) % 2 ? ' · 换股数量必须为偶数' : ''}`; const confirm = mount.querySelector('[data-action="settleMergerShares"]'); if (confirm) confirm.disabled = !valid; }
    function updateBuyPreview() { const summary = $('[data-role="buy-summary"]'); if (!summary) return; const current = state(); const me = getMe(current); const selected = [...mount.querySelectorAll('[data-buy-chain]')].reduce((result, input) => { const rawCount = Number(input.value); const count = Number.isFinite(rawCount) ? rawCount : 0; const chain = getChain(current, input.dataset.buyChain); const max = Math.min(3, Number(chain?.sharesAvailable) || 0); if (!Number.isInteger(count) || count < 0 || count > max) result.valid = false; result.count += count; result.cost += count * (chain?.sharePrice || 0); return result; }, { count: 0, cost: 0, valid: true }); const valid = selected.valid && selected.count <= 3 && selected.cost <= (me?.cash || 0); summary.className = `acquire-input-summary acquire-buy-summary ${valid ? '' : 'is-invalid'}`; summary.textContent = `${selected.valid ? `已选 ${selected.count} 股 · ${formatMoney(selected.cost)}` : '请输入库存范围内的整数'}${me && selected.valid ? ` · 余额 ${formatMoney(me.cash - selected.cost)}` : ''}`; const confirm = mount.querySelector('[data-action="buyShares"]'); if (confirm) confirm.disabled = !valid; }

    return { render, renderDetails, clearError, showError, renderHand, updateSettlementPreview, updateBuyPreview };
}
