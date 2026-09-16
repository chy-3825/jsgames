export const COLORS = ['white', 'blue', 'green', 'red', 'black'];
export const ALL_TOKENS = [...COLORS, 'gold'];
export const COLOR_LABELS = { white: '白', blue: '蓝', green: '绿', red: '红', black: '黑', gold: '黄金' };
export const COLOR_GEMS = { white: '钻石', blue: '蓝宝石', green: '祖母绿', red: '红宝石', black: '缟玛瑙', gold: '黄金' };
export const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' };
export const END_LABELS = {
    points: '最后一轮完成，商会结算',
    players: '在线玩家不足，商会关闭',
};
export const SPLENDOR_ART_BY_TIER = {
    // The local BGG crop set is deliberately shared across tiers in a
    // stable sequence. It keeps a four-card row from repeating the same two
    // portraits while the tier border and gem still carry game semantics.
    1: [5, 6, 7, 8, 3, 4, 1, 2],
    2: [3, 4, 8, 5, 6, 7, 1, 2],
    3: [1, 2, 3, 4, 8, 5, 6, 7],
};
export const NOBLE_PORTRAIT_BY_ID = { n1: 1, n2: 2, n3: 3, n4: 4, n5: 5, n6: 1, n7: 2, n8: 3, n9: 4, n10: 5 };
