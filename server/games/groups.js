/**
 * 游戏大厅的分组与使用方式。
 *
 * 运行时由 registry.js 把这些字段附加到游戏 metadata；分组说明和验收
 * 约定见项目根目录的 GAME_GROUPS.md。不要在大厅模板里重复维护游戏分组。
 */
const GROUP_DEFINITIONS = {
    'social-assist': {
        id: 'social-assist',
        name: '社交推理与流程辅助',
        description: '身份、沟通与自动流程',
        order: 1,
    },
    board: {
        id: 'board',
        name: '棋类与棋盘游戏',
        description: '棋盘对弈与路线竞赛',
        order: 2,
    },
    tabletop: {
        id: 'tabletop',
        name: '卡牌与策略桌游',
        description: '卡牌、经营、竞价与策略',
        order: 3,
    },
};

const GAME_GROUPS = {
    // 社交推理与流程辅助
    avalon: { group: 'social-assist', playMode: 'online', sortOrder: 2 },
    decrypto: { group: 'social-assist', playMode: 'hybrid', sortOrder: 3 },
    witchtown: { group: 'social-assist', playMode: 'online', sortOrder: 4 },
    werewolf: { group: 'social-assist', playMode: 'auto-assist', sortOrder: 1 },

    // 棋类与棋盘游戏
    chess: { group: 'board', playMode: 'online', sortOrder: 1 },
    xiangqi: { group: 'board', playMode: 'online', sortOrder: 2 },
    jungle: { group: 'board', playMode: 'online', sortOrder: 3 },
    junqi: { group: 'board', playMode: 'online', sortOrder: 4 },
    aeroplane: { group: 'board', playMode: 'online', sortOrder: 5 },
    gobang: { group: 'board', playMode: 'online', sortOrder: 6 },
    checkers: { group: 'board', playMode: 'online', sortOrder: 7 },
    monopoly: { group: 'board', playMode: 'online', sortOrder: 8 },

    // 卡牌与策略桌游
    loveletter: { group: 'tabletop', playMode: 'online', sortOrder: 1 },
    coup: { group: 'tabletop', playMode: 'online', sortOrder: 2 },
    guessnumber: { group: 'tabletop', playMode: 'solo', sortOrder: 3 },
    monopolydeal: { group: 'tabletop', playMode: 'online', sortOrder: 4 },
    takefive: { group: 'tabletop', playMode: 'online', sortOrder: 5 },
    hanabi: { group: 'tabletop', playMode: 'online', sortOrder: 6 },
    splendor: { group: 'tabletop', playMode: 'online', sortOrder: 7 },
    kingdomino: { group: 'tabletop', playMode: 'online', sortOrder: 8 },
    acquire: { group: 'tabletop', playMode: 'online', sortOrder: 9 },
    citadels: { group: 'tabletop', playMode: 'online', sortOrder: 10 },
    lasvegas: { group: 'tabletop', playMode: 'online', sortOrder: 12 },
    scout: { group: 'tabletop', playMode: 'online', sortOrder: 13 },
    manila: { group: 'tabletop', playMode: 'online', sortOrder: 14 },
    modernart: { group: 'tabletop', playMode: 'online', sortOrder: 15 },
    camelup: { group: 'tabletop', playMode: 'online', sortOrder: 16 },
    magicalathlete: { group: 'tabletop', playMode: 'online', sortOrder: 17 },
};

function decorateGameMetadata(metadata) {
    const classification = GAME_GROUPS[metadata?.type];
    if (!classification) return { ...metadata };
    const group = GROUP_DEFINITIONS[classification.group];
    return {
        ...metadata,
        ...classification,
        groupName: group.name,
        groupDescription: group.description,
        groupOrder: group.order,
    };
}

module.exports = {
    GROUP_DEFINITIONS,
    GAME_GROUPS,
    decorateGameMetadata,
};
