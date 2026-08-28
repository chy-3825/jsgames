import { escapeHtml, formatMoney, formatNumber, safeChainId, safeColor } from './constants.js';

export function chainHeadquartersMarkup(chain, variant = '') {
    const modifier = /^is-(board|legend|option|rules|stock|guide)$/.test(variant) ? ` ${variant}` : '';
    return `<span class="acquire-hq${modifier}" data-chain="${safeChainId(chain?.id)}" aria-hidden="true"><span class="acquire-hq-buildings"><i></i><i></i><i></i></span><b>${escapeHtml(chain?.short || '?')}</b></span>`;
}

export function stockCertificateMarkup(chain, count = 0, variant = 'holding') {
    const short = chain?.short || '?';
    const name = chain?.name || '未知集团';
    const price = chain?.sharePrice || 0;
    const marketCopy = `库存 ${chain?.sharesAvailable || 0} 股`;
    const holdingCopy = `账面 ${formatMoney(count * price)}`;
    return `<article class="acquire-stock-certificate is-${variant}" data-chain="${safeChainId(chain?.id)}" style="--chain-color:${safeColor(chain?.color)}"><header><span>ACQUIRE · 股份凭证</span><b>${variant === 'holding' ? `${formatNumber(count)} 股` : formatMoney(price)}</b></header><div class="acquire-stock-face">${chainHeadquartersMarkup(chain, 'is-stock')}<span class="acquire-stock-identity"><strong>${escapeHtml(name)}</strong><small>HOTEL GROUP · ${escapeHtml(short)}</small></span><i class="acquire-stock-seal">60</i></div><footer><span>酒店集团股份</span><small>${variant === 'holding' ? holdingCopy : marketCopy}</small></footer></article>`;
}

export function eventTileMarkup(tile, extraClass = '') {
    const code = String(tile?.id || '--');
    return `<span class="acquire-event-tile ${extraClass}"><span>${escapeHtml(code)}</span><i class="acquire-tile-city" aria-hidden="true"><i></i><i></i><i></i></i><strong>${escapeHtml(code)}</strong><small>城市建筑地块</small></span>`;
}

export function eventChainMarkup(chain, extraClass = '') {
    if (!chain) return '';
    return `<article class="acquire-event-chain ${extraClass}" data-event-chain="${safeChainId(chain.id)}" style="--chain-color:${safeColor(chain.color)}">${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain.name)}</strong><small>${Number(chain.size) || 0} 格 · ${formatMoney(chain.sharePrice)}/股</small></span></article>`;
}
