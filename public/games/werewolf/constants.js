import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const ROLE = Object.freeze({
    werewolf: { name: '狼人', image: 'langr.png', text: '与狼队在夜里投票，决定今夜的袭击目标。' },
    seer: { name: '预言家', image: 'yyj.png', text: '每夜查验一名玩家，得知对方属于狼人或好人阵营。' },
    witch: { name: '女巫', image: 'nw.png', text: '拥有一瓶解药和一瓶毒药，每瓶整局只能使用一次。' },
    hunter: { name: '猎人', image: 'lr.png', text: '并非被毒药带走时，可以开枪带走一名玩家。' },
    guard: { name: '守卫', image: 'sw.png', text: '每夜守护一名玩家，但不能连续两夜守护同一个人。' },
    villager: { name: '平民', image: 'pm.png', text: '从发言和投票中辨认真相，找出藏在人群中的狼人。' },
});

export function eliminationFragments() {
    return Array.from({ length: 35 }, (_, index) => {
        const column = index % 7;
        const row = Math.floor(index / 7);
        const horizontal = column < 3 ? -1 : 1;
        const x = horizontal * (70 + ((index * 47) % 190));
        const y = (row - 2) * 54 + ((index * 31) % 90) - 45;
        const rotation = horizontal * (18 + ((index * 37) % 78));
        const delay = (index % 9) * 18;
        return `<i style="--fx:${x}px;--fy:${y}px;--fr:${rotation}deg;--fd:${delay}ms"></i>`;
    }).join('');
}

export function transitionAnnouncementKey(announcement) {
    return announcement ? `${announcement.day}:${announcement.kind || 'night'}` : '';
}

export function eliminationNoticeKey(notice) {
    return notice ? `${notice.day}:${notice.seat}:${notice.source}` : '';
}

export function formatVoteBallots(result) {
    const groups = new Map();
    (result?.ballots || []).forEach(ballot => {
        const key = ballot.targetSeat == null ? '弃权' : `${ballot.targetSeat} 号`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(ballot.voterSeat);
    });
    if (!groups.size) return '本轮无票';
    return [...groups.entries()].map(([target, voters]) => target === '弃权' ? `${voters.join('、')} 号弃权` : `${voters.join('、')} 号 → ${target}`).join('；');
}
