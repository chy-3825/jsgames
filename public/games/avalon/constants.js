import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const ROLE_META = Object.freeze({
    merlin: { name: '梅林', faction: 'good', seal: '光', image: 'merlin.webp', copy: '你知道部分邪恶阵营，但必须隐藏自己。' },
    percival: { name: '派西维尔', faction: 'good', seal: '剑', image: 'percival.webp', copy: '你看到梅林与莫甘娜两个可能身份。' },
    assassin: { name: '刺客', faction: 'evil', seal: '刃', image: 'assassin.webp', copy: '三项任务成功后，选择你认为的梅林。' },
    minion: { name: '爪牙', faction: 'evil', seal: '暗', image: 'minion.webp', copy: '帮助邪恶阵营破坏任务。' },
    morgana: { name: '莫甘娜', faction: 'evil', seal: '影', image: 'morgana.webp', copy: '你会在派西维尔眼中伪装成梅林。' },
    mordred: { name: '莫德雷德', faction: 'evil', seal: '隐', image: 'mordred.webp', copy: '梅林无法看见你的真实阵营。' },
    oberon: { name: '奥伯伦', faction: 'evil', seal: '雾', image: 'oberon.webp', copy: '你不认识其他邪恶玩家，他们也看不见你。' },
    loyal: { name: '忠臣', faction: 'good', seal: '盾', image: 'loyal.webp', copy: '完成任务，辨认谎言，并保护梅林。' },
});
export const ROLE_ART_ROOT = '/assets/bgg/avalon/roles/';
export const MISSION_SIZES = Object.freeze({ 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] });
export function roleMeta(roleId) { return ROLE_META[roleId] || { name: roleId || '未知身份', faction: 'good', seal: '誓', copy: '你的身份会随牌局状态更新。' }; }
