import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const CARD_META = Object.freeze({
    accusation: Object.freeze({ label: '指控', tone: 'red', copy: '增加 1 点指控' }),
    evidence: Object.freeze({ label: '证据', tone: 'red', copy: '增加 3 点指控' }),
    witness: Object.freeze({ label: '目击者', tone: 'red', copy: '增加 7 点指控' }),
    alibi: Object.freeze({ label: '不在场证明', tone: 'green', copy: '移除目标最近的 3 点指控' }),
    arson: Object.freeze({ label: '纵火', tone: 'green', copy: '烧掉目标全部手牌' }),
    curse: Object.freeze({ label: '诅咒', tone: 'green', copy: '移除目标面前一张蓝色牌' }),
    robbery: Object.freeze({ label: '抢劫', tone: 'green', copy: '把一名玩家的手牌交给另一名玩家' }),
    scapegoat: Object.freeze({ label: '替罪羊', tone: 'blue', copy: '把红牌与蓝牌转移给另一名玩家' }),
    stocks: Object.freeze({ label: '枷锁', tone: 'blue', copy: '目标下回合跳过行动' }),
    asylum: Object.freeze({ label: '避难所', tone: 'blue', copy: '目标免疫一次夜间击杀' }),
    matchmaker: Object.freeze({ label: '红娘', tone: 'blue', copy: '目标死亡时，红娘持有者一同出局' }),
    piety: Object.freeze({ label: '虔诚', tone: 'blue', copy: '目标免疫红色指控牌' }),
    blackcat: Object.freeze({ label: '黑猫', tone: 'blue', copy: '黑猫持有者成为白天首位行动者' }),
    conspiracy: Object.freeze({ label: '阴谋', tone: 'black', copy: '触发黑猫揭示与审判牌交换' }),
    night: Object.freeze({ label: '夜幕', tone: 'black', copy: '进入夜晚结算' }),
});

export const TRIAL_META = Object.freeze({
    town: Object.freeze({ label: '镇民', chinese: '镇民', tone: 'town' }),
    witch: Object.freeze({ label: '女巫', chinese: '女巫', tone: 'witch' }),
    constable: Object.freeze({ label: '警长', chinese: '警长', tone: 'constable' }),
});

export const TOWN_HALL_ART_INDEX = Object.freeze({
    'mary-warren': 10, 'ann-putnam': 2, 'giles-corey': 12, 'abigail-williams': 13, 'will-griggs': 8,
    'sarah-good': 1, 'john-proctor': 9, 'samuel-parris': 4, 'rebecca-nurse': 6, 'martha-corey': 11,
    'thomas-danforth': 0, 'william-phips': 3, 'george-burroughs': 7, tituba: 5, 'cotton-mather': 14,
});

export const CARD_SIGILS = Object.freeze({ accusation: 'Ⅰ', evidence: 'Ⅲ', witness: 'Ⅶ', alibi: 'A', arson: '火', curse: '咒', robbery: '取', scapegoat: '替', stocks: '枷', asylum: '庇', matchmaker: '缘', piety: '祷', blackcat: '猫', conspiracy: '谋', night: '夜' });

export function deckCardMeta(cardId) {
    const kind = String(cardId || '').replace(/^salem-/, '').replace(/-\d+$/, '');
    return CARD_META[kind] || { label: '未知牌', tone: 'black' };
}

export function townHallArtStyle(hall) {
    const index = TOWN_HALL_ART_INDEX[hall?.id] ?? 0;
    return `--hall-x:${(index % 5) * 25}%;--hall-y:${Math.floor(index / 5) * 50}%`;
}

export const factionLabel = faction => faction === 'witch' ? '女巫阵营' : '镇民阵营';
