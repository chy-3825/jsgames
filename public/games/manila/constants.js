import { escapeHtml } from '../common/html.js';

export { escapeHtml };

export const GOODS = Object.freeze(['人参', '玉石', '肉豆蔻', '丝绸']);
export const GOOD_META = Object.freeze({
    人参: Object.freeze({ id: 'ginseng', mark: '参', note: '药材贸易', accent: '#c66f4d' }),
    玉石: Object.freeze({ id: 'jade', mark: '玉', note: '矿石贸易', accent: '#49a98e' }),
    肉豆蔻: Object.freeze({ id: 'nutmeg', mark: '蔻', note: '香料贸易', accent: '#d39a42' }),
    丝绸: Object.freeze({ id: 'silk', mark: '绸', note: '织物贸易', accent: '#9a78bb' }),
});
export const LOCATION_INFO = Object.freeze({
    ginseng: Object.freeze({ label: '人参货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' }),
    jade: Object.freeze({ label: '玉石货船', fees: [3, 4, 5, 6], capacity: 4, group: 'cargo' }),
    nutmeg: Object.freeze({ label: '肉豆蔻货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' }),
    silk: Object.freeze({ label: '丝绸货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' }),
    'port-a': Object.freeze({ label: '一号港口', fee: 4, payout: 6, capacity: 1, group: 'port' }),
    'port-b': Object.freeze({ label: '二号港口', fee: 3, payout: 8, capacity: 1, group: 'port' }),
    'port-c': Object.freeze({ label: '三号港口', fee: 2, payout: 15, capacity: 1, group: 'port' }),
    'shipyard-a': Object.freeze({ label: '一号船坞', fee: 4, payout: 6, capacity: 1, group: 'shipyard' }),
    'shipyard-b': Object.freeze({ label: '二号船坞', fee: 3, payout: 8, capacity: 1, group: 'shipyard' }),
    'shipyard-c': Object.freeze({ label: '三号船坞', fee: 2, payout: 15, capacity: 1, group: 'shipyard' }),
    pirate: Object.freeze({ label: '海盗船', fee: 3, capacity: 2, group: 'office', note: '拦截停在 13 格的船' }),
    'pilot-small': Object.freeze({ label: '小领航员', fee: 2, capacity: 1, group: 'office', note: '移动一艘船 1 格' }),
    'pilot-large': Object.freeze({ label: '大领航员', fee: 5, capacity: 1, group: 'office', note: '移动一艘或两艘船' }),
    insurance: Object.freeze({ label: '保险公司', fee: 0, capacity: 1, group: 'office', note: '立即收入 10，并承保船坞' }),
});
export const PHASE_LABELS = Object.freeze({ auction: '竞选港务长', master: '筹备航线', placement: '安插帮手', sailing: '港务长行船', pilot: '领航调度', pirateBoard: '海盗登船', plunder: '掠夺裁决', ended: '商会结算', waiting: '等待开航' });

export function shareBackFan(count) {
    const visible = Math.min(3, Math.max(0, Number(count) || 0));
    return `<span class="mn-share-back-fan" aria-hidden="true">${Array.from({ length: visible }, () => '<i class="mn-share-back"><b>港</b></i>').join('')}</span>`;
}
