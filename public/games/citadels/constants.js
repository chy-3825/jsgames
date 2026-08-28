import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const ASSETS = Object.freeze({
    detail: '/assets/bgg/citadels/detail.jpg',
    roleBackReference: '/assets/bgg/citadels/reference-role-front-back.jpg',
});

export const ROLE_META = Object.freeze({
    assassin: { rank: 1, name: '刺客', accent: 'rose', description: '宣布一个角色被暗杀，该角色本轮跳过行动。' },
    thief: { rank: 2, name: '盗贼', accent: 'amber', description: '指定一个未被暗杀的角色，角色揭示时取走其全部金币。' },
    magician: { rank: 3, name: '魔术师', accent: 'violet', description: '与一位玩家交换全部手牌，或弃掉任意数量再摸回等量牌。' },
    king: { rank: 4, name: '国王', accent: 'gold', color: 'yellow', description: '每座贵族城区提供金币收入，并在回合开始时获得皇冠。' },
    bishop: { rank: 5, name: '主教', accent: 'blue', color: 'blue', description: '每座宗教城区提供金币收入；主教在场时军阀不能攻击你的城市。' },
    merchant: { rank: 6, name: '商人', accent: 'green', color: 'green', description: '每座商业城区提供金币收入，完成资源行动后额外获得 1 金。' },
    architect: { rank: 7, name: '建筑师', accent: 'sand', description: '完成资源行动后额外摸 2 张牌，本回合最多建造 3 座城区。' },
    warlord: { rank: 8, name: '军阀', accent: 'red', color: 'red', description: '每座军事城区提供金币收入；结束建造阶段后可摧毁一座城区。' },
});

export const ROLE_ACCENT_COLORS = Object.freeze({
    rose: '#c27d72', amber: '#c59d55', violet: '#9a7ab0', gold: '#d3aa5c',
    blue: '#77a8b5', green: '#7bad88', sand: '#c6a16e', red: '#cf7667',
});

export const COLOR_META = Object.freeze({
    yellow: { name: '贵族', short: '贵族区', className: 'noble' },
    blue: { name: '宗教', short: '宗教区', className: 'religious' },
    green: { name: '商业', short: '商业区', className: 'trade' },
    red: { name: '军事', short: '军事区', className: 'military' },
    purple: { name: '独特', short: '独特区', className: 'unique' },
});

export const EFFECT_NAMES = Object.freeze({
    hauntedCity: '计分时可视为任意颜色（终局轮建成除外）',
    keep: '军阀无法摧毁',
    imperialTreasury: '终局每枚金币 +1 分',
    mapRoom: '终局每张手牌 +1 分',
    laboratory: '每回合一次：弃 1 手牌换 1 金',
    observatory: '摸牌时摸 3 保留 1',
    smithy: '每回合一次：付 3 金摸 2 牌',
    graveyard: '城区被毁时可付 1 金回收',
    library: '摸牌时保留两张',
    schoolOfMagic: '收入计算时视为任意颜色',
    greatWall: '军阀摧毁需多付 1 金',
});

export const DISTRICT_MARKS = Object.freeze({ hauntedCity: '月', keep: '塔', imperialTreasury: '库', mapRoom: '图', laboratory: '药', observatory: '星', smithy: '锻', graveyard: '墓', library: '书', schoolOfMagic: '秘', greatWall: '墙' });

export function districtVariant(card) {
    const seed = String(card?.name || card?.id || '').split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return (seed % 4) + 1;
}
