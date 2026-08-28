import { escapeHtml } from '../common/html.js';
import { DIRECTIONS, TERRAIN_META, TERRAIN_ORDER } from './constants.js';

export { escapeHtml };

export function terrainMeta(terrain) {
    return TERRAIN_META[terrain] || TERRAIN_META.草地;
}

export function seedHash(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function terrainArt(terrain, seed = '') {
    const arts = terrainMeta(terrain).arts;
    return arts.length ? arts[seedHash(`${terrain}:${seed}`) % arts.length] : '';
}

export function castleMarkup(extraClass = '') {
    return `<span class="kd-castle-art ${extraClass}" aria-hidden="true"><i></i><i></i><i></i><b></b></span>`;
}

export function rulesKingdomMarkup() {
    const cells = [['森林', '森林', '草地', '海洋', '海洋'], ['森林', '草地', '草地', '海洋', '沼泽'], ['麦田', '草地', '城堡', '沼泽', '沼泽'], ['麦田', '麦田', '草地', '矿山', '沼泽'], ['麦田', '矿山', '矿山', '矿山', '草地']];
    const crowns = new Map([['0,0', 1], ['4,0', 1], ['2,1', 1], ['4,2', 1], ['0,3', 1], ['1,4', 2]]);
    return `<div class="kd-rules-board" aria-label="五乘五王国计分示例">${cells.flatMap((row, y) => row.map((terrain, x) => { const meta = terrainMeta(terrain); const count = crowns.get(`${x},${y}`) || 0; const visual = terrain === '城堡' ? castleMarkup('is-rule-castle') : `<img src="${terrainArt(terrain, `rules:${x}:${y}`)}" alt="" aria-hidden="true"><span class="kd-rule-shade" aria-hidden="true"></span>`; return `<span class="kd-rule-cell terrain-${meta.key}" title="${terrain}">${visual}${count ? `<b class="kd-rule-crown">${'♛'.repeat(count)}</b>` : ''}</span>`; })).join('')}</div><div class="kd-rules-art-caption"><span>地形相连</span><i></i><span>领地 × 王冠</span><strong>5 × 5</strong></div>`;
}

export function crownMarkup(count, className = '') {
    const amount = Number(count) || 0;
    if (!amount) return '';
    return `<span class="kd-crowns ${className}" aria-label="${amount} 顶王冠">${Array.from({ length: amount }, () => '<i>♛</i>').join('')}</span>`;
}

export function tileHalfMarkup(terrain, crowns = 0, seed = '') {
    const meta = terrainMeta(terrain);
    return `<span class="kd-tile-half terrain-${meta.key}"><img src="${terrainArt(terrain, seed)}" alt="" aria-hidden="true"><span class="kd-tile-shade" aria-hidden="true"></span><span class="kd-tile-label">${escapeHtml(terrain)}</span>${crownMarkup(crowns)}</span>`;
}

export function dominoFaceMarkup(tile, showNumber = true) {
    return `<span class="kd-domino-face">${showNumber ? `<span class="kd-domino-number"><small>顺序</small><strong>${String(Number(tile.number) || 0).padStart(2, '0')}</strong></span>` : ''}<span class="kd-domino-halves">${tileHalfMarkup(tile.left, tile.crowns?.[0], `${tile.id}:0`)}${tileHalfMarkup(tile.right, tile.crowns?.[1], `${tile.id}:1`)}</span></span>`;
}

export function eventDominoMarkup(tile, extraClass = '') {
    return `<div class="kd-event-domino ${extraClass}">${dominoFaceMarkup(tile)}</div>`;
}
