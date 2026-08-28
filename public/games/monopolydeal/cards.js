import { escapeHtml } from '../common/html.js';
import { ACTION_LABELS, ACTION_MARKS, COLORS, COLOR_HEX, COLOR_LABELS } from './constants.js';

export { escapeHtml };

export function cardLabel(card) {
    if (card.kind === 'money') return '现金';
    if (card.kind === 'property') return COLOR_LABELS[card.color] || card.color;
    if (card.kind === 'property_wild') return card.allColor ? '十色万能' : '双色万能';
    if (card.kind === 'rent') return card.colors?.length ? '双色租金' : '任何租金';
    return ACTION_LABELS[card.action] || '行动';
}

export function cardSwatches(card) {
    const colors = card.kind === 'property' ? [card.color] : ['property_wild', 'rent'].includes(card.kind) ? (card.colors?.length ? card.colors : COLORS) : [];
    return colors.length ? `<i class="deal-card-swatches ${colors.length > 5 ? 'is-many' : ''}">${colors.map(color => `<span class="color-${escapeHtml(color)}"></span>`).join('')}</i>` : '';
}

export function cardVisualMarkup(card) {
    if (card.kind === 'money') return `<span class="deal-card-visual is-money" aria-hidden="true"><i>${card.value || 0}</i><em>现金牌</em></span>`;
    if (card.kind === 'property') {
        const rents = (card.rent || []).map((rent, index) => `<i><span>${index + 1}</span><b>${rent}M</b></i>`).join('');
        return `<span class="deal-card-visual is-property" style="--property-color:${COLOR_HEX[card.color] || '#99866e'}" aria-hidden="true"><em>地产契约</em><span class="deal-rent-ladder">${rents}</span></span>`;
    }
    if (card.kind === 'property_wild') return '<span class="deal-card-visual is-wild" aria-hidden="true"><i>全</i><em>万能地产</em></span>';
    if (card.kind === 'rent') return '<span class="deal-card-visual is-rent" aria-hidden="true"><i>租</i><em>收取租金</em></span>';
    const [mark, caption] = ACTION_MARKS[card.action] || ['◆', '行动牌'];
    return `<span class="deal-card-visual is-action" aria-hidden="true"><span class="deal-action-motif"><b></b><b></b><b></b></span><i>${escapeHtml(mark)}</i><em>${escapeHtml(caption)}</em></span>`;
}

export function publicCardMarkup(card, extraClass = '', inlineStyle = '', role = '') {
    if (!card) return '';
    const actionClass = card.action ? `action-${escapeHtml(card.action)}` : '';
    return `<article class="deal-card deal-public-card card-${escapeHtml(card.kind)} ${actionClass} ${extraClass}" ${role ? `data-role="${role}"` : ''} ${inlineStyle ? `style="${inlineStyle}"` : ''} aria-label="${escapeHtml(card.name || ACTION_LABELS[card.action])}">${cardVisualMarkup(card)}<span class="deal-card-wash" aria-hidden="true"></span><small>${escapeHtml(cardLabel(card))}</small><strong>${escapeHtml(card.name || ACTION_LABELS[card.action])}</strong>${cardSwatches(card)}<b>${card.value || 0}M</b></article>`;
}
