import { escapeHtml } from '../common/html.js';
import { CARD_ART, CARD_FOCUS, CARD_NAMES } from './constants.js';

export const esc = escapeHtml;
export const CARD_BACK_ART = '/assets/games/loveletter/rose-card-back-gold.png';

export function renderPortrait(card, className) {
    const value = Number(card?.value ?? card?.id);
    const src = CARD_ART[value];
    const focus = CARD_FOCUS[value] || { x: 50, y: 36 };
    if (!src) return '';
    return `<span class="${className} ll-localized-face" style="--ll-focus-x:${focus.x}%;--ll-focus-y:${focus.y}%"><img src="${src}" alt="${esc(CARD_NAMES[value] || '人物牌')}" draggable="false"></span>`;
}

export function renderCardBack(label, className = '', ariaLabel = label) {
    return `<span class="ll-card-back ${className}" role="img" aria-label="${esc(ariaLabel)}"><span class="ll-card-back-ornament ll-card-back-ornament-top" aria-hidden="true"></span><span class="ll-card-back-ornament ll-card-back-ornament-bottom" aria-hidden="true"></span><img class="ll-back-rose-art" src="${CARD_BACK_ART}" alt="" draggable="false" aria-hidden="true"></span>`;
}

export function renderTinyCard(card, className) {
    const value = Number(card?.value ?? card?.id);
    return `<span class="ll-tiny-card ${className}" title="${esc(card?.name || CARD_NAMES[value] || '未知牌')}">${renderPortrait({ id: value }, 'll-tiny-portrait')}<b>${value || '?'}</b></span>`;
}

export function renderDiscardCard(entry) {
    const card = entry.card || {};
    const value = Number(card.value ?? card.id);
    const reason = entry.reason === 'prince' ? '王子弃牌' : entry.reason === 'eliminated' ? '出局公开' : entry.reason === '二人局起始公开' ? '二人局起始公开' : '已出牌';
    return `<span class="ll-discard-card" title="${esc(`${card.name || CARD_NAMES[value] || '未知牌'} · ${reason}`)}">${renderPortrait({ id: value }, 'll-discard-portrait')}<b>${value || '?'}</b></span>`;
}

export function renderSceneCard(card) {
    const value = Number(card?.value ?? card?.id);
    return `<span class="ll-scene-card">${renderPortrait({ id: value }, 'll-scene-portrait')}<b>${value || '?'}</b><strong>${esc(card?.name || CARD_NAMES[value] || '未知角色')}</strong></span>`;
}
