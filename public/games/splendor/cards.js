import { escapeHtml } from '../common/html.js';
import { COLORS, COLOR_LABELS, COLOR_GEMS, NOBLE_PORTRAIT_BY_ID, SPLENDOR_ART_BY_TIER, TIER_LABELS } from './constants.js';

export { escapeHtml };

export function cardArt(card) {
    const pool = SPLENDOR_ART_BY_TIER[Number(card?.tier)] || SPLENDOR_ART_BY_TIER[1];
    const seed = String(card?.id ?? `${card?.tier}-${card?.bonus}-${card?.points}`);
    const hash = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
    return `/assets/bgg/splendor/art-${pool[hash % pool.length]}.jpg`;
}

export function cardBackMarkup(tier, compact = false) {
    const level = TIER_LABELS[tier] || tier;
    return `<span class="sp-card-back tier-${tier} ${compact ? 'is-compact' : ''}" aria-hidden="true"><i></i><b>${level}</b></span>`;
}

export function noblePortraitMarkup(noble, extraClass = '') {
    const portrait = NOBLE_PORTRAIT_BY_ID[noble?.id] || 1;
    return `<span class="sp-noble-portrait portrait-${portrait} ${extraClass}" aria-hidden="true"><i></i></span>`;
}

export function presentationCardMarkup(card, extraClass = '') {
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

export function tokenTotal(tokens) {
    return ALL_TOKENS.reduce((sum, color) => sum + (Number(tokens?.[color]) || 0), 0);
}

export function paymentGems(payment = {}) {
    return ALL_TOKENS.filter(color => Number(payment[color]) > 0)
        .map(color => `<span class="tone-${color}"><i class="sp-gem"><b></b></i><strong>×${Number(payment[color])}</strong><small>${escapeHtml(COLOR_LABELS[color])}</small></span>`).join('');
}

export function eventGems(colors = []) {
    return colors.map((color, index) => `<span class="sp-event-gem tone-${color}" style="--sp-gem-order:${index}"><i class="sp-gem"><b></b></i><small>${escapeHtml(COLOR_LABELS[color] || color)}</small></span>`).join('');
}
