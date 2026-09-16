import { propertyFaceMarkup, propertyHandFaceMarkup } from './property-original.js';
export { propertyFaceMarkup } from './property-original.js';
import { escapeHtml } from '../common/html.js';
import { ACTION_LABELS, COLOR_LABELS } from './constants.js';

export { escapeHtml };

const RENT_PAIRS = ['brown,lightblue', 'orange,pink', 'red,yellow', 'blue,green', 'railroad,utility'];
export function rentFaceMarkup(card) {
    const index = card.colors?.length ? RENT_PAIRS.indexOf([...card.colors].sort().join(',')) : 5;
    if (index < 0) return '';
    // Generated 1254px sheet has gutters; sample only the card rectangles.
    const x = [15, 428, 839][index % 3];
    const y = index < 3 ? 15 : 634;
    return `<span class="deal-rent-original" style="background-position:${x / 857 * 100}% ${y / 648 * 100}%" aria-hidden="true"></span>`;
}

const ACTION_IMAGES = {
    debtCollector: ['pilot', 0, 0], justSayNo: ['pilot', 1, 0],
    dealBreaker: ['rest', 0, 0], passGo: ['rest', 1, 0],
    doubleRent: ['rest', 2, 0], birthday: ['rest', 3, 0],
    slyDeal: ['rest', 0, 1], forcedDeal: ['rest', 1, 1],
    house: ['rest', 2, 1], hotel: ['rest', 3, 1],
};

export function actionFaceMarkup(action, value) {
    const face = ACTION_IMAGES[action];
    if (!face) return '';
    const [sheet, column, row] = face;
    const x = sheet === 'pilot' ? column * 100 : column / 3 * 100;
    const correction = action === 'justSayNo' && Number.isFinite(value)
        ? `<span class="deal-action-value-fix is-top">${value}M</span><span class="deal-action-value-fix is-bottom">${value}M</span>` : '';
    return `<span class="deal-action-original is-${sheet}" style="background-position:${x}% ${row * 100}%" aria-hidden="true">${correction}</span>`;
}

// BGG image 424915: six original denominations, displayed as CSS sprite windows.
const MONEY_WINDOWS = { 1: [29, 35], 2: [414, 27], 3: [37, 294], 4: [419, 295], 5: [40, 557], 10: [428, 552] };
export function moneyFaceMarkup(value) {
    const crop = MONEY_WINDOWS[value];
    if (!crop) return '';
    return `<span class="deal-money-original" role="img" aria-label="${value}M 货币牌" style="background-position:${crop[0] / 444 * 100}% ${crop[1] / 594 * 100}%"></span>`;
}

export function cardLabel(card) {
    if (card.kind === 'money') return '现金';
    if (card.kind === 'property') return COLOR_LABELS[card.color] || card.color;
    if (card.kind === 'property_wild') return card.allColor ? '十色万能' : '双色万能';
    if (card.kind === 'rent') return card.colors?.length ? '双色租金' : '任何租金';
    return ACTION_LABELS[card.action] || '行动';
}

/** Hand properties retain the artwork with a simplified information panel. */
export function handCardMarkup(card) {
    if (card.kind === 'rent') {
        const face = rentFaceMarkup(card);
        if (face) return face;
    }
    if (card.kind === 'action' && ACTION_IMAGES[card.action]) return actionFaceMarkup(card.action, card.value);
    const amount = `${card.value || 0}M`;
    if (card.kind === 'money') {
        const face = moneyFaceMarkup(card.value);
        return face ? `<span class="deal-hand-money-frame">${face}</span>` : `<span class="deal-hand-money">${amount}</span>`;
    }
    if (['property', 'property_wild'].includes(card.kind)) return propertyHandFaceMarkup(card);
    const name = ACTION_LABELS[card.action] || card.name || '行动牌';
    return `<span class="deal-hand-action"><span class="deal-hand-action-value">${amount}</span><span class="deal-hand-action-name">${escapeHtml(name)}</span></span>`;
}

/** One wrapper for full faces; unknown cards get a small readable fallback. */
export function publicCardMarkup(card, extraClass = '', inlineStyle = '', role = '') {
    if (!card) return '';
    let face = '';
    let faceClass = '';
    if (['property', 'property_wild'].includes(card.kind)) {
        face = propertyFaceMarkup(card);
        faceClass = 'deal-localized-property';
    } else if (card.kind === 'rent') {
        face = rentFaceMarkup(card);
        faceClass = 'deal-localized-rent';
    } else if (card.kind === 'action') {
        face = actionFaceMarkup(card.action, card.value);
        faceClass = 'deal-localized-action';
    } else if (card.kind === 'money') {
        face = `<span class="deal-hand-money-frame">${moneyFaceMarkup(card.value)}</span>`;
        faceClass = 'deal-original-money';
    }
    const name = card.name || ACTION_LABELS[card.action] || cardLabel(card);
    if (!face) face = `<span class="deal-card-fallback"><strong>${escapeHtml(name)}</strong><span>${card.value || 0}M</span></span>`;
    const actionClass = card.action ? `action-${escapeHtml(card.action)}` : '';
    return `<article class="deal-card deal-public-card card-${escapeHtml(card.kind)} ${actionClass} ${faceClass} ${extraClass}" ${role ? `data-role="${escapeHtml(role)}"` : ''} ${inlineStyle ? `style="${escapeHtml(inlineStyle)}"` : ''} aria-label="${escapeHtml(name)}，${card.value || 0}M">${face}</article>`;
}
