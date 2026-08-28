export const CARD_NAMES = Object.freeze({ 1: '侍卫', 2: '牧师', 3: '男爵', 4: '侍女', 5: '王子', 6: '国王', 7: '伯爵夫人', 8: '公主' });

export const CARD_ART = Object.freeze({
    1: '/assets/bgg/loveletter/cards/guard.jpg',
    2: '/assets/bgg/loveletter/cards/priest.jpg',
    3: '/assets/bgg/loveletter/cards/baron.jpg',
    4: '/assets/bgg/loveletter/cards/handmaid.jpg',
    5: '/assets/bgg/loveletter/cards/prince.jpg',
    6: '/assets/bgg/loveletter/cards/king.jpg',
    7: '/assets/bgg/loveletter/cards/countess.jpg',
    8: '/assets/bgg/loveletter/cards/princess.jpg',
});

export const CARD_FOCUS = Object.freeze({
    1: { x: 50, y: 34 },
    2: { x: 50, y: 36 },
    3: { x: 50, y: 37 },
    4: { x: 49, y: 38 },
    5: { x: 51, y: 34 },
    6: { x: 52, y: 37 },
    7: { x: 55, y: 38 },
    8: { x: 51, y: 35 },
});

export const CARD_RULES = Object.freeze([
    { value: 1, count: 5, name: '侍卫', effect: '猜一名玩家的手牌，猜中则对方出局。' },
    { value: 2, count: 2, name: '牧师', effect: '查看一名玩家的手牌，只有你能看到。' },
    { value: 3, count: 2, name: '男爵', effect: '和一名玩家比较手牌，点数低者出局。' },
    { value: 4, count: 2, name: '侍女', effect: '保护自己到下一回合，期间不能被指定。' },
    { value: 5, count: 2, name: '王子', effect: '指定一名玩家弃牌并重抽，可以指定自己。' },
    { value: 6, count: 1, name: '国王', effect: '和一名玩家交换手牌。' },
    { value: 7, count: 1, name: '伯爵夫人', effect: '若同时持有王子或国王，必须打出此牌。' },
    { value: 8, count: 1, name: '公主', effect: '打出或弃掉公主会立刻出局。' },
]);

export const NEEDS_TARGET = new Set([1, 2, 3, 5, 6]);
