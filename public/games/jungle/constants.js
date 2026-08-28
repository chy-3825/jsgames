export const PIECES = Object.freeze({
    r: { name: '鼠', rank: 1, title: '老鼠' },
    c: { name: '猫', rank: 2, title: '猫' },
    d: { name: '狗', rank: 3, title: '狗' },
    w: { name: '狼', rank: 4, title: '狼' },
    l: { name: '豹', rank: 5, title: '豹' },
    t: { name: '虎', rank: 6, title: '虎' },
    j: { name: '狮', rank: 7, title: '狮子' },
    e: { name: '象', rank: 8, title: '大象' },
});

export const WATER = new Set(['1,3', '2,3', '4,3', '5,3', '1,4', '2,4', '4,4', '5,4', '1,5', '2,5', '4,5', '5,5']);
export const DENS = new Map([['3,0', 'blue'], ['3,8', 'red']]);
export const TRAPS = new Map([['2,0', 'blue'], ['4,0', 'blue'], ['3,1', 'blue'], ['2,8', 'red'], ['4,8', 'red'], ['3,7', 'red']]);
