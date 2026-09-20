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
    duke: '征税获得 3 枚金币；可以阻挡外援。',
    assassin: '支付 3 枚金币，使一名玩家失去一张影响力。',
    captain: '从目标处拿走至多 2 枚金币；可以阻挡偷窃。',
    ambassador: '与影响力牌库交换牌；可以阻挡偷窃。',
    contessa: '可以阻挡暗杀。',
    captain_or_ambassador: '偷窃的目标可以声称船长或大使来阻挡。',
};

export const ROLE_NOTES = {
    duke: '行动：征税 · 阻挡：外援',
    assassin: '行动：暗杀',
    captain: '行动：偷窃 · 阻挡：偷窃',
    ambassador: '行动：交换 · 阻挡：偷窃',
    contessa: '阻挡：暗杀',
};

export const ROLE_ART = {
    duke: 'duke',
    assassin: 'assassin-v1',
    captain: 'captain',
    ambassador: 'ambassador-v4',
    contessa: 'contessa',
};

export const CARD_BACK_ART = 'back-palace-v2';

export const ACTIONS = [
    { id: 'income', name: '收入', group: 'public', desc: '从国库获得 1 枚金币', icon: '+1' },
    { id: 'foreign_aid', name: '外援', group: 'public', desc: '获得 2 枚金币；可被公爵阻挡', icon: '+2' },
    { id: 'tax', name: '征税', group: 'claim', desc: '声称公爵，获得 3 枚金币', role: 'duke', icon: 'D' },
    { id: 'exchange', name: '交换', group: 'claim', desc: '声称大使，交换影响力', role: 'ambassador', icon: 'M' },
    { id: 'steal', name: '偷窃', group: 'claim', desc: '声称船长，从目标处拿走至多 2 枚金币', role: 'captain', needsTarget: true, icon: 'C' },
    { id: 'assassinate', name: '暗杀', group: 'claim', desc: '声称刺客，使目标失去一张影响力', role: 'assassin', needCoins: 3, needsTarget: true, icon: 'A' },
    { id: 'coup', name: '政变', group: 'coup', desc: '目标揭示一张影响力；不可质疑、阻挡', needCoins: 7, needsTarget: true, icon: '!' },
];

export const ACTION_GROUPS = [
    { id: 'public', name: '基础行动' },
    { id: 'claim', name: '角色行动' },
    { id: 'coup', name: '政变' },
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
