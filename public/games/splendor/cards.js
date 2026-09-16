import { escapeHtml } from '../common/html.js';
import { ALL_TOKENS, COLORS, COLOR_LABELS, COLOR_GEMS, NOBLE_PORTRAIT_BY_ID, SPLENDOR_ART_BY_TIER, TIER_LABELS } from './constants.js';

export { escapeHtml };

export function cardArt(card) {
    const pool = SPLENDOR_ART_BY_TIER[Number(card?.tier)] || SPLENDOR_ART_BY_TIER[1];
    // Card ids are stable across the server and the client. Use the printed
    // card number instead of a character-code hash so artwork assignments are
    // deterministic, inspectable and easy to replace with an explicit art
    // manifest later.
    const match = String(card?.id ?? '').match(/(?:-|L)?0?(\d+)$/i);
    const cardNumber = Number(match?.[1]) || 1;
    return `/assets/bgg/splendor/card-art-${pool[(cardNumber - 1) % pool.length]}.jpg`;
}

function cardCostMarkup(card) {
    return COLORS.filter(color => Number(card?.cost?.[color]) > 0)
        .map(color => `<span class="sp-cost tone-${color}" title="${COLOR_GEMS[color]}费用 ${Number(card.cost[color])}"><i aria-hidden="true"></i><b>${Number(card.cost[color])}</b><small>${escapeHtml(COLOR_LABELS[color])}</small></span>`)
        .join('');
}

function cardAccessibleLabel(card) {
    const costs = COLORS.filter(color => Number(card?.cost?.[color]) > 0)
        .map(color => `${COLOR_LABELS[color]}${Number(card.cost[color])}`).join('、') || '免费';
    const tier = TIER_LABELS[Number(card?.tier)] || card?.tier || '';
    return `${tier}级发展卡，${Number(card?.points) || 0}点声望，提供${COLOR_LABELS[card?.bonus] || ''}色永久折扣，费用${costs}`;
}

/** Shared face used by market, reserved cards and transaction presentations. */
export function cardFaceMarkup(card, { source = 'market', selected = false, interactive = true, readOnly = false } = {}) {
    if (!card) return '';
    const tag = interactive ? 'button' : 'div';
    const attributes = interactive
        ? ` data-card-select="${escapeHtml(card.id)}" data-card-source="${escapeHtml(source)}" type="button" aria-pressed="${selected}" aria-label="${escapeHtml(cardAccessibleLabel(card))}"${readOnly ? ' data-read-only="true" aria-disabled="true"' : ''}`
        : ` role="img" aria-label="${escapeHtml(cardAccessibleLabel(card))}"`;
    const points = Number(card.points);
    const loading = source === 'market' ? 'eager' : 'lazy';
    return `<${tag} class="sp-card-face ${points ? '' : 'is-zero-point'}"${attributes}>
        <img src="${cardArt(card)}" alt="" loading="${loading}" decoding="async">
        <span class="sp-card-veil" aria-hidden="true"></span>
        <header><strong>${points || ''}</strong><span class="sp-bonus-gem" title="永久${escapeHtml(COLOR_LABELS[card.bonus] || '')}色折扣"><i aria-hidden="true"></i><small>+1</small></span></header>
        <div class="sp-card-costs">${cardCostMarkup(card) || '<span class="sp-free-card">免费</span>'}</div>
        <span class="sp-card-level">${escapeHtml(TIER_LABELS[card.tier] || card.tier || '')}</span>
    </${tag}>`;
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
    return `<article class="sp-dev-card sp-event-card tier-${card.tier} tone-${card.bonus} ${extraClass}">
        ${cardFaceMarkup(card, { interactive: false })}
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
