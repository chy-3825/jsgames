import { escapeHtml } from '../common/html.js';
import { COLORS, LABELS, VALUES } from './constants.js';

export const esc = escapeHtml;

export function publicCardMarkup(card, options = {}) {
    const { compact = false, matched = false, dimmed = false, kind = '' } = options;
    if (!card || card.hidden || !COLORS.includes(card.color) || !VALUES.includes(Number(card.value))) {
        return '<span class="hb-public-card hb-public-card-back" aria-label="隐藏牌"><i></i><b aria-hidden="true"></b></span>';
    }
    const value = Number(card.value);
    const label = LABELS[card.color];
    return `<span class="hb-public-card tone-${card.color} value-${value} ${kind ? `hb-${kind}-card` : ''} ${compact ? 'is-compact' : ''} ${matched ? 'is-clue-match' : ''} ${dimmed ? 'is-clue-dim' : ''}" aria-label="${label}色 ${value}">
        <span class="hb-card-corner hb-card-corner-top">${value}</span>
        <span class="hb-card-burst" aria-hidden="true"><i></i><i></i><i></i></span>
        <strong>${value}</strong>
        <small>${label}色</small>
        <span class="hb-card-corner hb-card-corner-bottom">${value}</span>
    </span>`;
}
