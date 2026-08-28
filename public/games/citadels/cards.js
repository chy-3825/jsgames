import { ASSETS, COLOR_META, DISTRICT_MARKS, EFFECT_NAMES, ROLE_META, districtVariant, escapeHtml } from './constants.js';

export function roleMeta(roleOrId) {
    const id = typeof roleOrId === 'string' ? roleOrId : roleOrId?.id;
    return ROLE_META[id] || { rank: roleOrId?.rank || '—', name: roleOrId?.name || id || '角色', accent: 'gold', description: '角色能力将在角色被呼叫时显示。' };
}

export function colorMeta(color) {
    return COLOR_META[color] || { name: color || '城区', short: '城区', className: 'neutral' };
}

export function roleArt(role, size = '') {
    const meta = roleMeta(role);
    return `<span class="citadels-role-art ${size ? `citadels-role-art-${size}` : ''} role-art-${meta.rank}" aria-hidden="true"><img src="${ASSETS.detail}" alt=""><span class="citadels-role-art-label"><b>${meta.rank}</b><strong>${escapeHtml(meta.name)}</strong></span></span>`;
}

export function roleBack(size = '') {
    return `<span class="citadels-role-back ${size ? `citadels-role-back-${size}` : ''}" aria-hidden="true"><img src="${ASSETS.roleBackReference}" alt=""></span>`;
}

export function districtBack(size = '') {
    return `<span class="citadels-district-back ${size ? `citadels-district-back-${size}` : ''}" aria-hidden="true"><i></i><b>C</b></span>`;
}

export function cityCardMarkup(card, ownerId = '') {
    const color = colorMeta(card.color);
    const mark = DISTRICT_MARKS[card.effect] || '';
    return `<span class="citadels-city-card color-${color.className}" data-district-id="${escapeHtml(card.id)}" data-city-owner="${escapeHtml(ownerId)}"${mark ? ` data-mark="${escapeHtml(mark)}"` : ''} title="${escapeHtml(EFFECT_NAMES[card.effect] || color.name)}"><span class="citadels-building" aria-hidden="true"></span><b>${escapeHtml(card.name)}</b><small><i>${card.cost}</i> 金 · ${card.points} 分</small></span>`;
}

export function districtCardMarkup(card, buttons = '', selected = false, disabled = false) {
    const color = colorMeta(card.color);
    const mark = DISTRICT_MARKS[card.effect] || '';
    const effect = card.effect ? `<span class="citadels-card-effect"><b>独特能力</b>${escapeHtml(EFFECT_NAMES[card.effect] || '')}</span>` : '<span class="citadels-card-effect is-empty">基础城区 · 建成后提供固定分数</span>';
    return `<article class="citadels-district-card color-${color.className} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}">
        <div class="citadels-card-top"><span>${escapeHtml(color.short)}</span><b>${card.cost}</b></div>
        <div class="citadels-card-main"><span class="citadels-district-art art-v${districtVariant(card)}" aria-hidden="true"><i${mark ? ` data-mark="${escapeHtml(mark)}"` : ''}></i></span><small>${card.effect ? '独特城区' : '基础城区'}</small><strong>${escapeHtml(card.name)}</strong><em>${escapeHtml(color.name)} · ${card.points} 分</em></div>
        ${effect}
        ${buttons ? `<div class="citadels-card-actions">${buttons}</div>` : ''}
    </article>`;
}
