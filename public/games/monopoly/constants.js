import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const BOARD_IMAGE_SIZE = 1254;
export const BOARD_TILE_COUNT = 40;
// Keep the roll brisk so the board action starts without a long pause.
export const DICE_ANIMATION_MS = 900;
export const MOVE_STEP_MS = 220;
export const DICE_PIPS = Object.freeze({
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
});

export function randomSumSevenDice() {
    const first = 1 + Math.floor(Math.random() * 6);
    return [first, 7 - first];
}

export const PLAYER_TOKEN_ART = Object.freeze({
    '2d': Object.freeze([
        '/assets/monopoly/tokens/2d-tram.png',
        '/assets/monopoly/tokens/2d-ferry.png',
        '/assets/monopoly/tokens/2d-junk.png',
        '/assets/monopoly/tokens/2d-taxi.png',
        '/assets/monopoly/tokens/2d-lantern.png',
        '/assets/monopoly/tokens/2d-bauhinia.png',
        '/assets/monopoly/tokens/2d-cable-car.png',
        '/assets/monopoly/tokens/2d-dim-sum.png',
    ]),
    '3d': Object.freeze([
        '/assets/monopoly/tokens/3d-tram.png',
        '/assets/monopoly/tokens/3d-ferry.png',
        '/assets/monopoly/tokens/3d-junk.png',
        '/assets/monopoly/tokens/3d-taxi.png',
        '/assets/monopoly/tokens/3d-lantern.png',
        '/assets/monopoly/tokens/3d-bauhinia.png',
        '/assets/monopoly/tokens/3d-cable-car.png',
        '/assets/monopoly/tokens/3d-dim-sum.png',
    ]),
});

export const PLAYER_TOKEN_NAMES = Object.freeze(['电车', '渡轮', '帆船', '出租车', '灯笼', '紫荆花', '缆车', '点心']);
export const TOKEN_STYLE_STORAGE_KEY = 'jsgames.monopoly.tokenStyle';
export const BOARD_CENTER_SKINS = Object.freeze([
    Object.freeze({
        id: 'harbour',
        name: '维港纪念',
        detail: '经典海港插画',
        image: '/assets/monopoly/hong-kong-board-center.png',
    }),
    Object.freeze({
        id: 'neon',
        name: '霓虹雨夜',
        detail: '雨夜城市灯影',
        image: '/assets/monopoly/hong-kong-board-center-neon.png',
    }),
]);
export const BOARD_SKIN_STORAGE_KEY = 'jsgames.monopoly.centerSkin';

export const BOARD_RECTS = (() => {
    const rects = [];
    const inset = 2;
    const setRect = (index, x1, y1, x2, y2, edge) => {
        rects[index] = { x: x1 + inset, y: y1 + inset, width: x2 - x1 - inset * 2, height: y2 - y1 - inset * 2, edge };
    };

    // These coordinates follow the actual cream paper cells in the 1254px
    // source image. The outer gold/jade frame and inner green trim are left
    // outside every hit target.
    const bottomX = [198, 308, 398, 487, 575, 670, 760, 849, 939, 1052];
    const topX = [198, 310, 400, 487, 575, 670, 760, 849, 939, 1052];
    const leftY = [201, 290, 376, 465, 552, 701, 788, 876, 962, 1054];
    const rightY = [201, 290, 376, 466, 552, 701, 788, 876, 962, 1054];

    setRect(0, 1052, 1054, 1228, 1228, 'corner');
    for (let index = 1; index <= 9; index += 1) {
        const cell = 9 - index;
        setRect(index, bottomX[cell], 1078, bottomX[cell + 1], 1228, 'bottom');
    }
    setRect(10, 26, 1054, 198, 1228, 'corner');
    for (let index = 11; index <= 19; index += 1) {
        const cell = 19 - index;
        setRect(index, 26, leftY[cell], 176, leftY[cell + 1], 'left');
    }
    setRect(20, 26, 26, 198, 198, 'corner');
    for (let index = 21; index <= 29; index += 1) {
        const cell = index - 21;
        setRect(index, topX[cell], 26, topX[cell + 1], 178, 'top');
    }
    setRect(30, 1052, 26, 1228, 198, 'corner');
    for (let index = 31; index <= 39; index += 1) {
        const cell = index - 31;
        setRect(index, 1078, rightY[cell], 1228, rightY[cell + 1], 'right');
    }
    return Object.freeze(rects);
})();

export const GROUP_LABELS = Object.freeze({
    brown: '棕色地产',
    lightblue: '浅蓝地产',
    pink: '粉色地产',
    orange: '橙色地产',
    red: '红色地产',
    yellow: '黄色地产',
    green: '绿色地产',
    blue: '深蓝地产',
    transit: '交通设施',
    utility: '公用事业',
});

export const TYPE_LABELS = Object.freeze({
    start: '起点',
    chance: '机会',
    community_chest: '公益金',
    tax: '税费',
    jail: '监狱',
    parking: '免费停车',
    go_to_jail: '前往监狱',
});

export function actionMark(kind) {
    return ({ rollDice: '⚄', buyProperty: '＋', passProperty: '↗', payBail: 'M', rollForDoubles: '⚄', useJailCard: '□', endTurn: '→' }[kind] || '·');
}

export function tileSymbol(type) {
    return ({ start: 'GO', chance: '?', community_chest: '公', tax: 'M', jail: '囚', parking: 'P', go_to_jail: '→' }[type] || '·');
}

export function buildingMarkup(tile) {
    if (tile.houses >= 5) return '<b class="mono-hotel" title="酒店">H</b>';
    return Array.from({ length: Math.min(tile.houses || 0, 4) }, () => '<i class="mono-house" aria-hidden="true"></i>').join('');
}

export function firstCharacter(value) {
    return Array.from(String(value || '玩'))[0] || '玩';
}

export function money(value) {
    return `M${Number(value || 0).toLocaleString('zh-CN')}`;
}
