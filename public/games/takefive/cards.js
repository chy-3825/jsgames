import { escapeHtml } from '../common/html.js';

export const bullTotal = cards => (cards || []).reduce((sum, card) => sum + (Number(card?.bullheads) || 0), 0);

export function bullClass(card) {
    const count = Number(card?.bullheads) || 1;
    return `bulls-${[1, 2, 3, 5, 7].includes(count) ? count : 1}`;
}

export function cardMarkup(card, options = {}) {
    const {
        kind = 'row',
        interactive = false,
        selected = false,
        disabled = false,
        action = 'selectCard',
        badge = '',
        locked = false,
        extraClass = '',
        dataAttributes = '',
    } = options;
    const tag = interactive ? 'button' : 'span';
    const value = Number(card?.value) || 0;
    const heads = Number(card?.bullheads) || 0;
    const pips = Array.from({ length: heads }, () => '<i></i>').join('');
    const attributes = interactive
        ? ` type="button" data-card-id="${escapeHtml(card?.id)}" data-card-action="${action}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}`
        : '';
    return `<${tag}${attributes}${dataAttributes ? ` ${dataAttributes}` : ''} class="tf-number-card tf-${kind}-card ${bullClass(card)} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${extraClass}" aria-label="${value}，${heads} 牛头" title="${value} · ${heads} 牛头">
        <span class="tf-card-corner tf-card-corner-top">${value}</span>
        <span class="tf-card-bull" aria-hidden="true"><i></i></span>
        <strong>${value}</strong>
        <span class="tf-bull-pips" aria-hidden="true">${pips}</span>
        <small>${heads} 牛头</small>
        <span class="tf-card-corner tf-card-corner-bottom">${value}</span>
        ${badge ? `<span class="tf-card-lock">${escapeHtml(badge)}</span>` : ''}
    </${tag}>`;
}
