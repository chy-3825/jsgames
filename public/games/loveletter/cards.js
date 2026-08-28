import { escapeHtml } from '../common/html.js';
import { CARD_ART, CARD_FOCUS, CARD_NAMES } from './constants.js';

export const esc = escapeHtml;

export function renderPortrait(card, className) {
    const value = Number(card?.value ?? card?.id);
    const src = CARD_ART[value];
    const focus = CARD_FOCUS[value] || { x: 50, y: 36 };
    return src ? `<span class="${className}" style="--ll-focus-x:${focus.x}%;--ll-focus-y:${focus.y}%"><img src="${src}" alt="" draggable="false"></span>` : '';
}

export function renderCardBack(label, className = '', ariaLabel = label) {
    return `<span class="ll-card-back ${className}" role="img" aria-label="${esc(ariaLabel)}"><span class="ll-back-rose" aria-hidden="true"></span><span class="ll-back-envelope" aria-hidden="true"></span><span class="ll-back-seal" aria-hidden="true">♥</span></span>`;
}

export function renderTinyCard(card, className) {
    const value = Number(card?.value ?? card?.id);
    return `<span class="ll-tiny-card ${className}" title="${esc(card?.name || CARD_NAMES[value] || '未知牌')}">${renderPortrait({ id: value }, 'll-tiny-portrait')}<b>${value || '?'}</b></span>`;
}

export function renderDiscardCard(entry) {
    const card = entry.card || {};
    const value = Number(card.value ?? card.id);
    const reason = entry.reason === 'prince' ? '王子弃置' : entry.reason === 'eliminated' ? '出局公开' : '已打出';
    return `<span class="ll-discard-card" title="${esc(`${card.name || CARD_NAMES[value] || '未知牌'} · ${reason}`)}">${renderPortrait({ id: value }, 'll-discard-portrait')}<b>${value || '?'}</b></span>`;
}

export function renderSceneCard(card) {
    const value = Number(card?.value ?? card?.id);
    return `<span class="ll-scene-card">${renderPortrait({ id: value }, 'll-scene-portrait')}<b>${value || '?'}</b><strong>${esc(card?.name || CARD_NAMES[value] || '未知角色')}</strong></span>`;
}
