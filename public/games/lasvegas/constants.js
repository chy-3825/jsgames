import { escapeHtml } from '../common/html.js';
export { escapeHtml };
export const CASINO_NAMES = Object.freeze(['黄金宫', '海市蜃楼', '星光金字塔', '皇家塔楼', '赤沙宫', '霓虹穹顶']);
export const DIE_PIPS = Object.freeze({ 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] });
export function renderDie(face, className = '') { const activePips = new Set(DIE_PIPS[face] || []); const pips = Array.from({ length: 9 }, (_, index) => `<i class="${activePips.has(index + 1) ? 'is-pip' : ''}"></i>`).join(''); return `<span class="lv-die face-${Number(face)} ${className}" aria-label="${Number(face)}点">${pips}</span>`; }
