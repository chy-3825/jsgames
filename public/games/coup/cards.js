import { CARD_BACK_ART, ROLE_ART, ROLE_EFFECTS, ROLE_MARKS, ROLE_NAMES, escapeHtml } from './constants.js';

export function renderInfluence(card, options = {}, { privateIdentityVisible = false } = {}) {
    const role = card?.role || null;
    const revealed = card?.revealed === true;
    const face = Boolean(role && ROLE_ART[role]);
    const privateIdentity = Boolean(options.privateIdentity && face && !revealed);
    const selectable = Number.isInteger(options.lossIndex) || Number.isInteger(options.exchangeIndex);
    const tag = selectable ? 'button' : 'article';
    const roleLabel = face ? `${ROLE_NAMES[role]}，${ROLE_EFFECTS[role]}` : '隐藏的影响力牌';
    const coveredLabel = Number.isInteger(options.slotIndex) ? `第 ${options.slotIndex + 1} 张隐藏的影响力牌` : '隐藏的影响力牌';
    const label = privateIdentity && !privateIdentityVisible ? coveredLabel : roleLabel;
    const attrs = Number.isInteger(options.lossIndex)
        ? `type="button" data-loss-index="${options.lossIndex}"`
        : Number.isInteger(options.exchangeIndex)
            ? `type="button" data-exchange-index="${options.exchangeIndex}" aria-pressed="${Boolean(options.selected)}"`
            : '';
    const faceMarkup = face ? `<img class="cp-card-art" src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(`${ROLE_NAMES[role]}牌面`)}">${!options.mini ? `<span class="cp-card-copy"><i>${ROLE_MARKS[role]}</i><strong>${ROLE_NAMES[role]}</strong><small>${ROLE_EFFECTS[role]}</small></span>` : ''}` : `<span class="cp-card-back-art" aria-hidden="true"><img src="/assets/bgg/coup/${CARD_BACK_ART}.jpg" alt=""></span>`;
    const identityMarkup = privateIdentity
        ? `<span class="cp-private-card-secret" data-private-identity aria-hidden="${String(!privateIdentityVisible)}">${faceMarkup}</span><span class="cp-private-card-cover" aria-hidden="true"><img src="/assets/bgg/coup/${CARD_BACK_ART}.jpg" alt=""></span>`
        : faceMarkup;

    return `<${tag} class="cp-influence ${options.mini ? 'is-mini' : ''} ${options.exchange ? 'is-exchange' : ''} ${face ? `is-face is-role-${role}` : 'is-hidden'} ${privateIdentity ? 'is-private-identity' : ''} ${revealed ? 'is-lost' : ''} ${selectable ? 'is-selectable' : ''} ${options.selected ? 'is-selected' : ''}" ${attrs} aria-label="${escapeHtml(label)}"${privateIdentity ? ` data-private-role-label="${escapeHtml(roleLabel)}" data-covered-role-label="${escapeHtml(coveredLabel)}"` : ''}>
        ${Number.isInteger(options.slotIndex) ? `<b class="cp-slot-number">${options.slotIndex + 1}</b>` : ''}
        ${options.source ? `<span class="cp-source-label">${escapeHtml(options.source)}</span>` : ''}
        ${identityMarkup}
        ${revealed ? '<b class="cp-lost-stamp">已揭示</b>' : ''}
    </${tag}>`;
}

export function renderSceneRole(role) {
    if (!ROLE_ART[role]) return '<div class="cp-scene-role is-unknown"><b>?</b></div>';
    return `<div class="cp-scene-role is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}牌面"><strong>${escapeHtml(ROLE_NAMES[role])}</strong></div>`;
}

export function renderBlockDeclaration(role) {
    if (role === 'captain_or_ambassador') {
        return `<span class="cp-block-card is-dual"><span><img src="/assets/bgg/coup/${ROLE_ART.captain}.jpg" alt="船长"><img src="/assets/bgg/coup/${ROLE_ART.ambassador}.jpg" alt="大使"></span><b>阻挡声明</b></span>`;
    }
    if (!ROLE_ART[role]) return '';
    return `<span class="cp-block-card is-role-${role}"><img src="/assets/bgg/coup/${ROLE_ART[role]}.jpg" alt="${escapeHtml(ROLE_NAMES[role])}阻挡声明"><b>阻挡声明</b></span>`;
}

export function renderActionVisual(action) {
    if (action?.role && ROLE_ART[action.role]) return `<span class="cp-action-portrait is-role-${action.role}"><img src="/assets/bgg/coup/${ROLE_ART[action.role]}.jpg" alt=""></span>`;
    return `<i class="cp-action-symbol">${escapeHtml(action?.icon || '?')}</i>`;
}
