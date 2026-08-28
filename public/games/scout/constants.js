import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const CARD_COLORS = Object.freeze(['#d7594f', '#e78839', '#d8ad3d', '#75a35d', '#3f988c', '#3e83a7', '#5d6fb0', '#8b62a5', '#bc5c7d', '#76504f']);
export const CARD_MOTIFS = Object.freeze(['●', '◆', '▲', '✦', '■', '✺']);

export function cardFace(card, index = null, edge = '') {
    const value = Number(card?.value || 0);
    const otherValue = Number(card?.otherValue ?? value);
    const upper = CARD_COLORS[Math.max(0, value - 1) % CARD_COLORS.length];
    const lower = CARD_COLORS[Math.max(0, otherValue - 1) % CARD_COLORS.length];
    const motif = CARD_MOTIFS[Math.abs(value + otherValue) % CARD_MOTIFS.length];
    return `<span class="sc-card-fields" style="--upper:${upper};--lower:${lower}" aria-hidden="true"></span><b class="sc-card-top">${value}</b><span class="sc-card-motif" aria-hidden="true">${motif}</span><b class="sc-card-bottom">${otherValue}</b>${edge ? `<small class="sc-edge-label">${escapeHtml(edge)}</small>` : ''}${Number.isInteger(index) ? `<i class="sc-card-order">${index + 1}</i>` : ''}`;
}

export function combination(cards = []) {
    if (!cards.length) return null;
    const values = cards.map(card => Number(card.value));
    if (cards.length === 1) return { kind: 'single', length: 1, strength: values[0], values };
    const matching = values.every(value => value === values[0]);
    const sequence = values.every((value, index) => index === 0 || Math.abs(value - values[index - 1]) === 1) && new Set(values).size === values.length;
    if (!matching && !sequence) return null;
    return { kind: matching ? 'matching' : 'sequence', length: cards.length, strength: matching ? values[0] : Math.min(...values), values };
}

export function compareCombination(candidate, active) {
    if (!candidate) return -1;
    if (!active) return 1;
    if (candidate.length !== active.length) return candidate.length > active.length ? 1 : -1;
    if (candidate.kind !== active.kind) return candidate.kind === 'matching' ? 1 : -1;
    return candidate.strength === active.strength ? 0 : candidate.strength > active.strength ? 1 : -1;
}

export function comboName(combo) {
    if (!combo) return '未形成有效节目';
    if (combo.kind === 'single') return `单牌 ${combo.strength}`;
    if (combo.kind === 'matching') return `${combo.length} 张同点 · ${combo.strength}`;
    return `${combo.length} 张顺子 · ${combo.values.join('–')}`;
}
