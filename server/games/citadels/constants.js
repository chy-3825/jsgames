'use strict';

const COLORS = ['yellow', 'blue', 'green', 'red', 'purple'];
const ROLES = [
    { id: 'assassin', rank: 1, name: '刺客', color: null },
    { id: 'thief', rank: 2, name: '盗贼', color: null },
    { id: 'magician', rank: 3, name: '魔术师', color: null },
    { id: 'king', rank: 4, name: '国王', color: 'yellow' },
    { id: 'bishop', rank: 5, name: '主教', color: 'blue' },
    { id: 'merchant', rank: 6, name: '商人', color: 'green' },
    { id: 'architect', rank: 7, name: '建筑师', color: null },
    { id: 'warlord', rank: 8, name: '军阀', color: 'red' },
];
// 官方经典版城区牌：54 张四色常规区 + 13 张紫色独特区 = 67 张
// 字段：id, name(中文), color, cost, count, points(可选，默认=cost), effect(可选)
const DISTRICT_TYPES = [
    // 贵族区（黄色）12 张
    { id: 'manor', name: '庄园', color: 'yellow', cost: 3, count: 5 },
    { id: 'castle', name: '城堡', color: 'yellow', cost: 4, count: 4 },
    { id: 'palace', name: '宫殿', color: 'yellow', cost: 5, count: 3 },
    // 宗教区（蓝色）11 张
    { id: 'temple', name: '神庙', color: 'blue', cost: 1, count: 3 },
    { id: 'church', name: '教堂', color: 'blue', cost: 2, count: 3 },
    { id: 'monastery', name: '修道院', color: 'blue', cost: 3, count: 3 },
    { id: 'cathedral', name: '大教堂', color: 'blue', cost: 5, count: 2 },
    // 商业区（绿色）20 张
    { id: 'tavern', name: '酒馆', color: 'green', cost: 1, count: 5 },
    { id: 'market', name: '集市', color: 'green', cost: 2, count: 4 },
    { id: 'tradingpost', name: '商栈', color: 'green', cost: 2, count: 3 },
    { id: 'docks', name: '船坞', color: 'green', cost: 3, count: 3 },
    { id: 'harbor', name: '港口', color: 'green', cost: 4, count: 3 },
    { id: 'townhall', name: '市政厅', color: 'green', cost: 5, count: 2 },
    // 军事区（红色）11 张
    { id: 'watchtower', name: '瞭望塔', color: 'red', cost: 1, count: 3 },
    { id: 'prison', name: '监狱', color: 'red', cost: 2, count: 3 },
    { id: 'battlefield', name: '战场', color: 'red', cost: 3, count: 3 },
    { id: 'fortress', name: '要塞', color: 'red', cost: 5, count: 2 },
    // 独特区（紫色）13 张
    { id: 'haunted-city', name: '鬼城', color: 'purple', cost: 2, count: 1, effect: 'hauntedCity' },
    { id: 'keep', name: '堡垒', color: 'purple', cost: 3, count: 1, effect: 'keep' },
    { id: 'imperial-treasury', name: '帝国宝库', color: 'purple', cost: 4, count: 1, effect: 'imperialTreasury' },
    { id: 'map-room', name: '地图室', color: 'purple', cost: 5, count: 1, effect: 'mapRoom' },
    { id: 'laboratory', name: '实验室', color: 'purple', cost: 5, count: 1, effect: 'laboratory' },
    { id: 'observatory', name: '天文台', color: 'purple', cost: 5, count: 1, effect: 'observatory' },
    { id: 'smithy', name: '铁匠铺', color: 'purple', cost: 5, count: 1, effect: 'smithy' },
    { id: 'graveyard', name: '墓地', color: 'purple', cost: 5, count: 1, effect: 'graveyard' },
    { id: 'library', name: '图书馆', color: 'purple', cost: 6, count: 1, effect: 'library' },
    { id: 'school-of-magic', name: '魔法学院', color: 'purple', cost: 6, count: 1, effect: 'schoolOfMagic' },
    { id: 'university', name: '大学', color: 'purple', cost: 6, count: 1, points: 8 },
    { id: 'dragon-gate', name: '巨龙门', color: 'purple', cost: 6, count: 1, points: 8 },
    { id: 'great-wall', name: '长城', color: 'purple', cost: 6, count: 1, effect: 'greatWall' },
];
const EFFECT_NAMES = {
    hauntedCity: '计分时可视为任意一种颜色（终局轮建成的除外）',
    keep: '军阀无法摧毁本区',
    imperialTreasury: '终局每持有 1 枚金币 +1 分',
    mapRoom: '终局每持有 1 张手牌 +1 分',
    laboratory: '每回合一次：弃 1 张手牌换 1 枚金币',
    observatory: '回合开始摸牌时摸 3 张保留 1 张',
    smithy: '每回合一次：支付 3 金摸 2 张城区牌',
    graveyard: '城区被军阀摧毁时，可付 1 金收回手牌（不能救墓地本身）',
    library: '回合开始摸牌时保留两张',
    schoolOfMagic: '计算金币收入时可视为任意颜色',
    greatWall: '军阀摧毁你的城区需多付 1 枚金币',
};

module.exports = { COLORS, ROLES, DISTRICT_TYPES, EFFECT_NAMES };

