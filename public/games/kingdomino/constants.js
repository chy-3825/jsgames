export const TERRAIN_ORDER = ['麦田', '森林', '海洋', '草地', '沼泽', '矿山'];
export const TERRAIN_META = {
    麦田: { key: 'wheat', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/wheat-${index}.jpg`) },
    森林: { key: 'forest', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/forest-${index}.jpg`) },
    海洋: { key: 'sea', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/sea-${index}.jpg`) },
    草地: { key: 'meadow', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/meadow-${index}.jpg`) },
    沼泽: { key: 'swamp', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/swamp-${index}.jpg`) },
    矿山: { key: 'mine', arts: [1, 2, 3].map(index => `/assets/bgg/kingdomino/mine-${index}.jpg`) },
    城堡: { key: 'castle', arts: [] },
};
export const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
