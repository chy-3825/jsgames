export const CARD_NAMES = Object.freeze({ 1: '侍卫', 2: '牧师', 3: '男爵', 4: '侍女', 5: '王子', 6: '国王', 7: '伯爵夫人', 8: '公主' });

export const CARD_ART = Object.freeze({
    1: '/assets/games/loveletter/cards-clean-zh/guard.png',
    2: '/assets/games/loveletter/cards-clean-zh/priest.png',
    3: '/assets/games/loveletter/cards-clean-zh/baron.png',
    4: '/assets/games/loveletter/cards-clean-zh/handmaid.png',
    5: '/assets/games/loveletter/cards-clean-zh/prince.png',
    6: '/assets/games/loveletter/cards-clean-zh/king.png',
    7: '/assets/games/loveletter/cards-clean-zh/countess.png',
    8: '/assets/games/loveletter/cards-clean-zh/princess.png',
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
    { value: 1, count: 5, name: '侍卫', effect: '猜一名对手的手牌；猜中则对方出局。' },
    { value: 2, count: 2, name: '牧师', effect: '秘密查看一名对手的手牌。' },
    { value: 3, count: 2, name: '男爵', effect: '与一名对手比较手牌；点数较低者出局。' },
    { value: 4, count: 2, name: '侍女', effect: '直到您的下个回合前，不会成为其他玩家的目标。' },
    { value: 5, count: 2, name: '王子', effect: '令一名玩家弃掉手牌并重新摸牌，也可以选择自己。' },
    { value: 6, count: 1, name: '国王', effect: '与一名对手交换手牌。' },
    { value: 7, count: 1, name: '伯爵夫人', effect: '与国王或王子同时在手时，必须打出。' },
    { value: 8, count: 1, name: '公主', effect: '一旦打出或弃掉，立即出局。' },
]);

export const NEEDS_TARGET = new Set([1, 2, 3, 5, 6]);
