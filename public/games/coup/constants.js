import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const ROLE_NAMES = {
    duke: '公爵',
    assassin: '刺客',
    captain: '船长',
    ambassador: '大使',
    contessa: '伯爵夫人',
    captain_or_ambassador: '船长或大使',
};

export const ROLE_MARKS = {
    duke: '爵',
    assassin: '刺',
    captain: '船',
    ambassador: '使',
    contessa: '夫',
    captain_or_ambassador: '船/使',
};

export const ROLE_EFFECTS = {
    duke: '行动：征税获得 3 枚金币；可以阻挡外援。',
    assassin: '支付 3 枚金币，暗杀一名玩家。',
    captain: '从目标处偷取至多 2 枚金币；可以阻挡偷窃。',
    ambassador: '与宫廷牌库交换影响力；可以阻挡偷窃。',
    contessa: '阻挡刺客的暗杀。',
    captain_or_ambassador: '目标可声称船长或大使来阻挡偷窃。',
};

export const ROLE_NOTES = {
    duke: '行动：征税 · 反制：外援',
    assassin: '行动：暗杀',
    captain: '行动：偷窃 · 反制：偷窃',
    ambassador: '行动：交换 · 反制：偷窃',
    contessa: '反制：暗杀',
};

export const ROLE_ART = {
    duke: 'modern-duke',
    assassin: 'modern-assassin',
    captain: 'modern-captain',
    ambassador: 'modern-ambassador',
    contessa: 'modern-contessa',
};

export const CARD_BACK_ART = 'modern-back';

export const ACTIONS = [
    { id: 'income', name: '收入', group: 'public', desc: '从国库获得 1 枚金币', icon: '+1' },
    { id: 'foreign_aid', name: '外援', group: 'public', desc: '获得 2 枚金币，可被公爵阻挡', icon: '+2' },
    { id: 'tax', name: '征税', group: 'claim', desc: '声称公爵，获得 3 枚金币', role: 'duke', icon: 'D' },
    { id: 'exchange', name: '交换', group: 'claim', desc: '声称大使，与牌库交换影响力', role: 'ambassador', icon: 'M' },
    { id: 'steal', name: '偷窃', group: 'claim', desc: '声称船长，偷取目标至多 2 枚金币', role: 'captain', needsTarget: true, icon: 'C' },
    { id: 'assassinate', name: '暗杀', group: 'claim', desc: '声称刺客，支付 3 枚金币', role: 'assassin', needCoins: 3, needsTarget: true, icon: 'A' },
    { id: 'coup', name: '政变', group: 'coup', desc: '支付 7 枚金币，目标失去影响力', needCoins: 7, needsTarget: true, icon: '!' },
];

export const ACTION_GROUPS = [
    { id: 'public', name: '公开行动' },
    { id: 'claim', name: '角色声明' },
    { id: 'coup', name: '终结手段' },
];

export const DECISION_REACTION_MS = 850;

export const SCENE_ACTION_NAMES = {
    coup: '政变',
    assassinate: '暗杀',
    steal: '偷窃',
    foreign_aid: '外援',
    tax: '征税',
    exchange: '交换',
};
