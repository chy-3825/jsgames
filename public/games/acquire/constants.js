import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const PHASE_LABELS = Object.freeze({ place: '铺设地块', foundation: '创建集团', merger: '合并选择', merger_settlement: '股东结算', buy: '购入股票', ended: '牌局结束' });
export const PHASE_ENGLISH = Object.freeze({ place: '铺设地块', foundation: '创建集团', merger: '选择存续集团', merger_settlement: '结算旧股', buy: '购买股票', ended: '最终账本' });
export const CHAIN_IDS = Object.freeze(['sackson', 'imperial', 'america', 'festival', 'worldwide', 'continental', 'tower']);
export const formatMoney = value => `$${Number(value || 0).toLocaleString('en-US')}`;
export const formatNumber = value => Number(value || 0).toLocaleString('en-US');
export const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#687b77';
export const safeChainId = value => CHAIN_IDS.includes(String(value || '')) ? value : 'unknown';
export const tileIdFor = (row, col) => `${String.fromCharCode(65 + row)}${col + 1}`;
