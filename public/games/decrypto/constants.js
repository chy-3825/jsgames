import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const PHASES = Object.freeze({
    keycheck: { name: '核对密钥', mark: '锁' },
    encryptor_vote: { name: '选举加密员', mark: '票' },
    clue: { name: '编写线索', mark: '译' },
    guessing: { name: '封存答案', mark: '密' },
    tiebreak: { name: '终局猜词', mark: '决' },
    ended: { name: '通信复盘', mark: '终' },
});

export function phaseMeta(state) { return PHASES[state?.phase] || { name: '等待接入', mark: '待' }; }
export function teamClass(teamId) { return Number(teamId) === 0 ? 'is-red' : 'is-blue'; }
