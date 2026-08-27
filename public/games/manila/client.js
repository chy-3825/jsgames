const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const GOODS = ['人参', '玉石', '肉豆蔻', '丝绸'];
const GOOD_META = {
    人参: { id: 'ginseng', mark: '参', note: '药材贸易', accent: '#c66f4d' },
    玉石: { id: 'jade', mark: '玉', note: '矿石贸易', accent: '#49a98e' },
    肉豆蔻: { id: 'nutmeg', mark: '蔻', note: '香料贸易', accent: '#d39a42' },
    丝绸: { id: 'silk', mark: '绸', note: '织物贸易', accent: '#9a78bb' },
};
const LOCATION_INFO = {
    ginseng: { label: '人参货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' },
    jade: { label: '玉石货船', fees: [3, 4, 5, 6], capacity: 4, group: 'cargo' },
    nutmeg: { label: '肉豆蔻货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' },
    silk: { label: '丝绸货船', fees: [1, 2, 3], capacity: 3, group: 'cargo' },
    'port-a': { label: '一号港口', fee: 4, payout: 6, capacity: 1, group: 'port' },
    'port-b': { label: '二号港口', fee: 3, payout: 8, capacity: 1, group: 'port' },
    'port-c': { label: '三号港口', fee: 2, payout: 15, capacity: 1, group: 'port' },
    'shipyard-a': { label: '一号船坞', fee: 4, payout: 6, capacity: 1, group: 'shipyard' },
    'shipyard-b': { label: '二号船坞', fee: 3, payout: 8, capacity: 1, group: 'shipyard' },
    'shipyard-c': { label: '三号船坞', fee: 2, payout: 15, capacity: 1, group: 'shipyard' },
    pirate: { label: '海盗船', fee: 3, capacity: 2, group: 'office', note: '拦截停在 13 格的船' },
    'pilot-small': { label: '小领航员', fee: 2, capacity: 1, group: 'office', note: '移动一艘船 1 格' },
    'pilot-large': { label: '大领航员', fee: 5, capacity: 1, group: 'office', note: '移动一艘或两艘船' },
    insurance: { label: '保险公司', fee: 0, capacity: 1, group: 'office', note: '立即收入 10，并承保船坞' },
};
const PHASE_LABELS = { auction: '竞选港务长', master: '筹备航线', placement: '安插帮手', sailing: '港务长行船', pilot: '领航调度', pirateBoard: '海盗登船', plunder: '掠夺裁决', ended: '商会结算', waiting: '等待开航' };

function shareBackFan(count) {
    const visible = Math.min(3, Math.max(0, Number(count) || 0));
    return `<span class="mn-share-back-fan" aria-hidden="true">${Array.from({ length: visible }, () => '<i class="mn-share-back"><b>港</b></i>').join('')}</span>`;
}

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/manila/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(style);

    let state = null;
    let interactionSignature = '';
    let pendingChoice = null;
    let financeChoice = null;
    let bidDraft = 1;
    let boatDraft = GOODS.slice(0, 3).map(good => ({ good, start: 3 }));
    let pilotDraft = { mode: 'one', boat1: '', delta1: 1, boat2: '', delta2: 1 };
    let sailOrder = [];
    let previousFocus = null;
    let actionPending = false;
    let presentationQueue = [];
    let presentationPlaying = false;
    let presentationToken = 0;
    let lastPresentationSequence = null;
    let waitTimer = null;
    let releaseWait = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    mount.innerHTML = `<section class="manila-app">
        <header class="mn-header">
            <div class="mn-brand"><span class="mn-seal" aria-hidden="true">港</span><div><small>南洋商路</small><h1>马尼拉</h1></div></div>
            <div class="mn-voyage" data-role="round">等待开航</div>
            <div class="mn-header-actions"><button data-ui="rules" type="button">规则</button></div>
        </header>
        <main class="mn-layout">
            <section class="mn-chart">
                <div class="mn-status" data-role="status"></div>
                <section class="mn-market" aria-label="黑市行情"><header><span>黑市行情</span><small>任一货物达到 30，商会结算</small></header><div data-role="market"></div></section>
                <section class="mn-routes"><div class="mn-section-heading"><div><span>航运海图</span><small>0 → 13 → 马尼拉</small></div><b data-role="movement"></b></div><div data-role="boats"></div></section>
                <section class="mn-command" data-role="command"></section>
                <section class="mn-docks"><div class="mn-section-heading"><div><span>码头与职位</span><small>本次航行的公开下注</small></div></div><div data-role="locations"></div></section>
            </section>
            <aside class="mn-ledger">
                <section class="mn-paper mn-master" data-role="master"></section>
                <section class="mn-paper"><header class="mn-paper-title"><span>商人名册</span><small>现金 / 股份 / 帮手</small></header><div data-role="players"></div></section>
                <section class="mn-paper mn-vault" data-role="finance"></section>
                <section class="mn-paper"><header class="mn-paper-title"><span>航行记录</span><small>最新在前</small></header><div class="mn-log" data-role="log"></div></section>
            </aside>
        </main>
        <div class="mn-presentation-layer" data-role="presentationLayer" hidden aria-live="assertive">
            <div class="mn-presentation-shade"></div>
            <svg class="mn-action-line" data-role="actionLine" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"></line><circle cx="0" cy="0" r="5"></circle></svg>
            <section class="mn-presentation-scene" data-role="presentationScene"></section>
            <div class="mn-moving-layer" data-role="movingLayer" aria-hidden="true"></div>
            <button class="mn-presentation-skip" data-ui="skipPresentation" type="button">跳过演出</button>
        </div>
        <div class="mn-overlay is-hidden" data-role="rulesOverlay" role="dialog" aria-modal="true" aria-labelledby="mn-rules-title">
            <article><button class="mn-close" data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span class="mn-kicker">港务手册</span><h2 id="mn-rules-title">马尼拉规则</h2>
                <ol><li>每位商人获得 30 比索、2 张私有股份和 3 个帮手；3 人局为 4 个帮手。</li><li>竞价产生港务长；他可按黑市价（最低 5）买一张股份，再装载三种不同货物，三个起点均为 0–5 且总和为 9。</li><li>轮流将帮手放到货船、港口、船坞、海盗、领航员或保险公司。现金与可抵押额度不足时，只有货船允许以全部现金盲乘。</li><li>每次航行移动三轮。服务端掷出对应货物骰，港务长决定同轮内三艘船的移动先后；越过 13 格即按到达顺序进入港口。</li><li>第三轮行船前，小领航员可令一艘船移动 ±1；大领航员可令一艘船移动 ±1/±2，或两艘船各移动 ±1。</li><li>第二轮停在 13 格的船允许海盗登船；第三轮仍停在 13 格的船由海盗决定去港口或船坞。</li><li>货船到港后分红并令对应黑市价上涨 5。股份抵押获得 12 比索，偿还需要 15；任一行情到达 30 后按总财富决胜。</li></ol>
                <figure class="mn-art-reference"><img src="/assets/bgg/manila/detail.jpg" alt="马尼拉货船与港口组件参考图" loading="lazy"><figcaption>实体组件参考 · 线上航线依据正式规则重绘</figcaption></figure>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const actions = () => state?.availableActions || {};
    const myPlayer = () => state?.players?.find(player => player.id === state.myId);
    const phaseLabel = () => PHASE_LABELS[state?.phase] || '等待开航';

    function signature(next) {
        const me = next.players?.find(player => player.id === next.myId);
        const boats = (next.boats || []).map(boat => `${boat.id}:${boat.position}:${boat.fate}`).join(',');
        const positions = Object.entries(next.locations || {}).map(([id, stakes]) => `${id}:${stakes.length}`).join(',');
        const movement = (next.movementPlan?.rolls || []).map(item => `${item.boatId}:${item.roll}:${item.from}`).join(',');
        return [next.status, next.phase, next.voyage, next.masterStep, next.currentTurn, next.movementRound, next.auction?.highestBid, me?.cash, (next.myEncumberedShares || []).join(','), boats, positions, movement].join('|');
    }

    function resetDrafts() {
        actionPending = false;
        pendingChoice = null;
        financeChoice = null;
        bidDraft = Math.max(1, Number(state?.auction?.highestBid || 0) + 1);
        boatDraft = GOODS.slice(0, 3).map(good => ({ good, start: 3 }));
        const sailing = (state?.boats || []).filter(boat => boat.fate === 'sailing');
        pilotDraft = { mode: 'one', boat1: String(sailing[0]?.id ?? ''), delta1: 1, boat2: String(sailing[1]?.id ?? ''), delta2: 1 };
        sailOrder = [];
    }

    function statusText() {
        if (state.status === 'ended') return `${escapeHtml(state.winner?.name || '本局结束')} 赢得商会 · 财富 ${state.winner?.fortune ?? '—'}`;
        if (state.phase === 'auction') return actions().bid ? '轮到你决定港务长竞价' : '港务长竞价正在进行';
        if (state.phase === 'master') return actions().buyShare || actions().setBoats ? '你掌管本次航线' : `${escapeHtml(state.harborMasterName || '港务长')} 正在筹备船队`;
        if (state.phase === 'placement') return actions().placeAccomplice ? '选择位置，核对代价后安插帮手' : '等待下一位商人安插帮手';
        if (state.phase === 'sailing') return actions().sailBoats ? '骰点已公开，请决定货船行进顺序' : `${escapeHtml(state.harborMasterName || '港务长')} 正在决定行船顺序`;
        if (state.phase === 'pilot') return actions().pilotMove ? '领航员正在你的指挥下' : '领航员正在调整航线';
        if (state.phase === 'pirateBoard') return actions().boardPirate ? '选择要登上的货船' : '海盗正在寻找登船机会';
        if (state.phase === 'plunder') return actions().plunderDestination ? '决定被掠夺货船的去向' : '等待海盗船长裁决';
        return '等待商船驶入港湾';
    }

    function render() {
        if (!state) return;
        const me = myPlayer();
        const shareCount = Number(me?.sharesCount ?? state.myShares?.length ?? 0);
        const encumberedCount = Number(me?.encumberedShares ?? state.myEncumberedShares?.length ?? 0);
        $('round').textContent = state.status === 'ended' ? '最终结算' : `第 ${state.voyage || 1} 次航行 · ${phaseLabel()}`;
        $('movement').textContent = state.phase === 'sailing' ? `第 ${state.movementPlan?.round || state.movementRound} / 3 轮 · 骰点已出` : state.movementRound ? `已完成 ${state.movementRound} / 3 轮` : '尚未掷骰';
        $('status').innerHTML = `<div><span class="mn-kicker">${phaseLabel()}</span><h2>${statusText()}</h2></div><aside><p>${state.currentTurnName ? `当前操作 · ${escapeHtml(state.currentTurnName)}` : state.harborMasterName ? `港务长 · ${escapeHtml(state.harborMasterName)}` : '等待港务长'}</p><div class="mn-self-summary" aria-label="我的资产：${me?.cash ?? 0} 比索，${shareCount} 股，${encumberedCount} 股抵押，${me?.accomplices ?? 0} 名帮手"><span><b>${me?.cash ?? 0}</b> 比索</span><span><b>${shareCount}</b> 股</span><span><b>${encumberedCount}</b> 抵押</span><span><b>${me?.accomplices ?? 0}</b> 帮手</span></div></aside>`;
        renderMarket(); renderBoats(); renderCommand(); renderLocations(); renderMaster(); renderPlayers(); renderFinance(); renderLog();
    }

    function renderMarket() {
        $('market').innerHTML = GOODS.map(good => {
            const meta = GOOD_META[good];
            const value = Number(state.market?.[good] || 0);
            const remaining = Number(state.shareMarket?.[good] || 0);
            return `<article class="mn-market-item" data-market-good="${escapeHtml(good)}" style="--good:${meta.accent}"><i>${meta.mark}</i><div><strong>${good}</strong><small>余 ${remaining} 股</small></div><b>${value}</b><span><em style="width:${Math.min(100, value / 30 * 100)}%"></em></span></article>`;
        }).join('');
    }

    function playerDots(stakes, capacity) {
        const list = Array.isArray(stakes) ? stakes : [];
        return Array.from({ length: capacity }, (_, index) => {
            const stake = list[index];
            const player = stake && state.players?.find(candidate => candidate.id === stake.playerId);
            return stake
                ? `<span class="mn-stake is-filled" style="--player:${escapeHtml(player?.color || '#d5a85e')}" title="${escapeHtml(stake.playerName || '商人')} · ${stake.fee} 比索">${escapeHtml((stake.playerName || '?').slice(0, 1))}</span>`
                : '<span class="mn-stake" aria-label="空位"></span>';
        }).join('');
    }

    function boatFate(boat) {
        if (boat.fate === 'port') return `抵达港口${boat.portIndex ? ` · ${boat.portIndex} 号` : ''}`;
        if (boat.fate === 'shipyard') return `进入船坞${boat.shipyardIndex ? ` · ${boat.shipyardIndex} 号` : ''}`;
        if (boat.fate === 'pirated') return '等待海盗裁决';
        return boat.position === 13 ? '停在 13 格' : '航行中';
    }

    function renderBoats() {
        const boats = state.boats || [];
        if (!boats.length) {
            $('boats').innerHTML = '<div class="mn-empty-route"><i></i><strong>船位尚空</strong><span>港务长安排三种货物后，航线会在这里展开。</span></div>';
            return;
        }
        $('boats').innerHTML = boats.map(boat => {
            const meta = GOOD_META[boat.good] || GOOD_META.人参;
            const stakes = state.locations?.[meta.id] || [];
            const pending = state.movementPlan?.rolls?.find(item => Number(item.boatId) === Number(boat.id));
            const latest = state.lastMovement?.moves?.find(item => Number(item.boatId) === Number(boat.id));
            const moveNote = pending ? `待行 +${pending.roll}` : latest && state.lastMovement?.round === state.movementRound ? `本轮 +${latest.roll}` : '';
            const position = Math.max(0, Math.min(14, Number(boat.position) || 0));
            const cells = Array.from({ length: 15 }, (_, point) => {
                const isBoat = point === position;
                const label = point === 14 ? '港' : point;
                return `<span class="mn-river-cell ${point <= 5 ? 'is-start' : ''} ${point === 13 ? 'is-pirate' : ''} ${point === 14 ? 'is-harbor' : ''} ${isBoat ? 'has-boat' : ''}" data-point="${point}"><b>${label}</b>${isBoat ? `<i class="mn-ship" aria-label="${escapeHtml(boat.good)}货船在 ${boat.position > 13 ? '马尼拉港' : `${boat.position} 格`}"><i></i><b></b><em></em></i>` : ''}</span>`;
            }).join('');
            return `<article class="mn-route-row is-${escapeHtml(boat.fate)}" data-boat-id="${boat.id}" style="--good:${meta.accent}">
                <header><i>${meta.mark}</i><div><strong>${escapeHtml(boat.good)}货船</strong><small>${boatFate(boat)}</small></div><b>${moveNote || (boat.arrived ? '到港' : `${boat.position} 格`)}</b></header>
                <div class="mn-waterway"><div class="mn-river-track">${cells}</div></div>
                <footer><span>货舱下注</span><div>${playerDots(stakes, LOCATION_INFO[meta.id].capacity)}</div><small>${boat.accomplices || 0} 名帮手${boat.pirates ? ` · ${boat.pirates} 名海盗已登船` : ''}</small></footer>
            </article>`;
        }).join('');
    }

    function choiceSummary(text, tone = '') {
        return `<div class="mn-confirm ${tone}"><div><span>待确认</span><strong>${text}</strong></div><div><button type="button" data-ui="cancelChoice" ${presentationPlaying ? 'disabled' : ''}>取消</button><button class="mn-primary" type="button" data-ui="confirmChoice" ${presentationPlaying ? 'disabled' : ''}>确认执行</button></div></div>`;
    }

    function renderCommand() {
        const a = actions();
        let html = '';
        if (a.bid || a.passBid) {
            const highest = Number(state.auction?.highestBid || 0);
            const maximum = Number(myPlayer()?.cash || 0) + ((state.myShares?.length || 0) - (state.myEncumberedShares?.length || 0)) * 12;
            html = `<header><div><span class="mn-kicker">本轮操作</span><h3>竞选港务长</h3></div><small>最高出价 ${highest} 比索</small></header><p>港务长决定本次装载与起航位置。可用现金与未抵押股份决定你的出价上限。</p><div class="mn-bid-line"><label>我的出价<input data-draft="bid" type="number" min="${highest + 1}" max="${maximum}" value="${bidDraft}"></label><small>最高可出 ${maximum}</small></div><div class="mn-choice-row"><button type="button" data-choice="bid">选择此出价</button><button type="button" data-choice="pass">选择放弃竞价</button></div>`;
            if (pendingChoice?.kind === 'bid') {
                const cash = Number(myPlayer()?.cash || 0);
                const mortgages = Math.ceil(Math.max(0, pendingChoice.amount - cash) / 12);
                html += choiceSummary(`出价 ${pendingChoice.amount} 比索·${mortgages ? `若成交将抵押 ${mortgages} 股·` : ''}成交后现金 ${cash + mortgages * 12 - pendingChoice.amount}`);
            }
            if (pendingChoice?.kind === 'pass') html += choiceSummary('放弃本轮竞价；本次拍卖不能再次加入', 'is-warning');
        } else if (a.buyShare || a.skipShare) {
            html = `<header><div><span class="mn-kicker">港务长权限</span><h3>购买一张股份</h3></div><small>仅此一次</small></header><p>售价取当前黑市价与 5 比索中的较高者；资金不足时会自动抵押股份。</p><div class="mn-good-choices">${GOODS.map(good => {
                const meta = GOOD_META[good];
                const remaining = Number(state.shareMarket?.[good] || 0);
                const price = Math.max(5, Number(state.market?.[good] || 0));
                return `<button type="button" data-choice="share" data-value="${good}" style="--good:${meta.accent}" ${remaining ? '' : 'disabled'}><i>${meta.mark}</i><span><b>${good}</b><small>${price} 比索 · 余 ${remaining}</small></span></button>`;
            }).join('')}</div><button class="mn-quiet-choice" type="button" data-choice="skipShare">选择不购买</button>`;
            if (pendingChoice?.kind === 'buyShare') html += choiceSummary(`购买 1 张${escapeHtml(pendingChoice.good)}股份，支付 ${pendingChoice.price} 比索`);
            if (pendingChoice?.kind === 'skipShare') html += choiceSummary('跳过本次股份购买机会', 'is-warning');
        } else if (a.setBoats) {
            const sum = boatDraft.reduce((total, boat) => total + Number(boat.start), 0);
            const distinct = new Set(boatDraft.map(boat => boat.good)).size === 3;
            const valid = distinct && sum === 9;
            html = `<header><div><span class="mn-kicker">港务长权限</span><h3>装载三艘货船</h3></div><small>起点总和 ${sum} / 9</small></header><p>三艘船必须装载不同货物；起点越靠前，到港机会越高。</p><div class="mn-boat-planner">${boatDraft.map((boat, index) => `<label><span>第 ${index + 1} 艘</span><select data-draft="boat-good" data-index="${index}">${GOODS.map(good => `<option value="${good}" ${good === boat.good ? 'selected' : ''}>${good}</option>`).join('')}</select><select data-draft="boat-start" data-index="${index}">${[0, 1, 2, 3, 4, 5].map(point => `<option value="${point}" ${point === Number(boat.start) ? 'selected' : ''}>从 ${point} 格出发</option>`).join('')}</select></label>`).join('')}</div><div class="mn-plan-result ${valid ? 'is-valid' : ''}"><span>${distinct ? '货物不重复' : '货物有重复'}</span><span>${sum === 9 ? '起点合计正确' : `还需调整 ${Math.abs(9 - sum)} 格`}</span><button class="mn-primary" type="button" data-confirm="boats" ${valid ? '' : 'disabled'}>确认船队并扬帆</button></div>`;
        } else if (a.placeAccomplice || a.passPlacement) {
            const loaded = new Set((state.boats || []).filter(boat => boat.fate === 'sailing').map(boat => GOOD_META[boat.good]?.id));
            html = `<header><div><span class="mn-kicker">本轮操作</span><h3>安插一名帮手</h3></div><small>剩余 ${myPlayer()?.accomplices ?? 0} 名</small></header><p>先选位置，再核对费用。货船从左至右逐格涨价；必要时服务端会自动抵押股份筹款。</p><div class="mn-placement-choices">${Object.entries(LOCATION_INFO).map(([id, info]) => {
                const occupied = state.locations?.[id]?.length || 0;
                const isCargo = info.group === 'cargo';
                const fee = isCargo ? info.fees[occupied] : info.fee;
                const disabled = !a.placeAccomplice || occupied >= info.capacity || (isCargo && !loaded.has(id));
                return `<button type="button" data-choice="location" data-value="${id}" ${disabled ? 'disabled' : ''}><span><b>${info.label}</b><small>${isCargo ? `货舱 ${occupied + 1} / ${info.capacity}` : info.note || `${occupied} / ${info.capacity}`}</small></span><em>${fee ?? 0}</em></button>`;
            }).join('')}</div><button class="mn-quiet-choice" type="button" data-choice="passPlacement">选择退出本次航行的后续安插</button>`;
            if (pendingChoice?.kind === 'placeAccomplice') {
                const cash = Number(myPlayer()?.cash || 0);
                const mortgages = Math.ceil(Math.max(0, pendingChoice.fee - cash) / 12);
                const projectedCash = cash + mortgages * 12 - pendingChoice.fee + (pendingChoice.location === 'insurance' ? 10 : 0);
                html += choiceSummary(`安插到${LOCATION_INFO[pendingChoice.location]?.label || ''}·席位 ${pendingChoice.occupied + 1}/${pendingChoice.capacity}·支付 ${pendingChoice.fee}${mortgages ? `·抵押 ${mortgages} 股` : ''}·余 ${Math.max(0, projectedCash)} 比索`);
            }
            if (pendingChoice?.kind === 'passPlacement') html += choiceSummary('本次航行不再安插帮手', 'is-warning');
        } else if (state.phase === 'sailing') {
            const rolls = state.movementPlan?.rolls || [];
            const byId = new Map(rolls.map(item => [Number(item.boatId), item]));
            const displayOrder = [...sailOrder, ...rolls.map(item => Number(item.boatId)).filter(id => !sailOrder.includes(id))];
            html = `<header><div><span class="mn-kicker">第 ${state.movementPlan?.round || state.movementRound} 轮行船</span><h3>港务长决定行船顺序</h3></div><small>骰点由服务端掷出</small></header><p>${a.sailBoats ? '依次点选货船。先到港的船占据前面的港口位，因此同一轮内的移动顺序会影响收益。' : `等待${escapeHtml(state.harborMasterName || '港务长')}确认；所有骰点与顺序均为公开信息。`}</p><div class="mn-sail-board">${displayOrder.map(boatId => {
                const item = byId.get(boatId);
                if (!item) return '';
                const orderIndex = sailOrder.indexOf(boatId);
                const meta = GOOD_META[item.good] || GOOD_META.人参;
                return `<button type="button" data-sail-boat="${boatId}" class="${orderIndex >= 0 ? 'is-selected' : ''}" style="--good:${meta.accent}" ${a.sailBoats ? '' : 'disabled'}><span class="mn-sail-order">${orderIndex >= 0 ? orderIndex + 1 : '·'}</span><i class="mn-die">${item.roll}</i><span><b>${escapeHtml(item.good)}货船</b><small>${item.from} 格 → ${item.projected > 13 ? '马尼拉港' : `${item.projected} 格`}</small></span></button>`;
            }).join('')}</div>${a.sailBoats ? `<div class="mn-sail-tools"><span>已选 ${sailOrder.length} / ${rolls.length} 艘</span><button type="button" data-ui="resetSail" ${sailOrder.length ? '' : 'disabled'}>重选顺序</button></div>` : ''}`;
            if (pendingChoice?.kind === 'sailBoats') html += choiceSummary(`依次移动：${pendingChoice.order.map(id => escapeHtml(byId.get(id)?.good || '')).join(' → ')}`);
        } else if (state.phase === 'pilot') {
            const sailing = (state.boats || []).filter(boat => boat.fate === 'sailing');
            const large = (state.locations?.['pilot-large'] || []).some(stake => stake.playerId === state.currentTurn);
            const canMove = Boolean(a.pilotMove && sailing.length);
            if (!large) pilotDraft.mode = 'one';
            const deltaOptions = values => values.map(value => `<option value="${value}" ${Number(pilotDraft.delta1) === value ? 'selected' : ''}>${value > 0 ? `前进 ${value}` : `后退 ${Math.abs(value)}`}</option>`).join('');
            html = `<header><div><span class="mn-kicker">航线修正</span><h3>${large ? '大领航员' : '小领航员'}调度</h3></div><small>${large ? '一艘 ±2 / 两艘 ±1' : '一艘 ±1'}</small></header><p>调整会立即改变海图上的船位，不能让货船退到 0 格之前。</p>`;
            if (large) html += `<div class="mn-mode-tabs"><button type="button" data-draft-button="pilot-mode" data-value="one" class="${pilotDraft.mode === 'one' ? 'is-active' : ''}">移动一艘</button><button type="button" data-draft-button="pilot-mode" data-value="two" class="${pilotDraft.mode === 'two' ? 'is-active' : ''}">移动两艘</button></div>`;
            html += `<div class="mn-pilot-planner"><label><span>第一艘</span><select data-draft="pilot-boat1" ${canMove ? '' : 'disabled'}>${sailing.map(boat => `<option value="${boat.id}" ${String(boat.id) === pilotDraft.boat1 ? 'selected' : ''}>${boat.good} · ${boat.position} 格</option>`).join('')}</select><select data-draft="pilot-delta1" ${canMove ? '' : 'disabled'}>${deltaOptions(large && pilotDraft.mode === 'one' ? [-2, -1, 1, 2] : [-1, 1])}</select></label>`;
            if (large && pilotDraft.mode === 'two') html += `<label><span>第二艘</span><select data-draft="pilot-boat2" ${canMove ? '' : 'disabled'}>${sailing.map(boat => `<option value="${boat.id}" ${String(boat.id) === pilotDraft.boat2 ? 'selected' : ''}>${boat.good} · ${boat.position} 格</option>`).join('')}</select><select data-draft="pilot-delta2" ${canMove ? '' : 'disabled'}><option value="-1" ${Number(pilotDraft.delta2) === -1 ? 'selected' : ''}>后退 1</option><option value="1" ${Number(pilotDraft.delta2) === 1 ? 'selected' : ''}>前进 1</option></select></label>`;
            html += `</div><div class="mn-choice-row"><button class="mn-primary" type="button" data-confirm="pilot" ${canMove && (pilotDraft.mode !== 'two' || pilotDraft.boat1 !== pilotDraft.boat2) ? '' : 'disabled'}>确认移动方案</button><button type="button" data-choice="skipPilot" ${a.skipPilot ? '' : 'disabled'}>选择不调整</button></div>`;
            if (pendingChoice?.kind === 'skipPilot') html += choiceSummary('放弃本次领航调整', 'is-warning');
        } else if (state.phase === 'pirateBoard') {
            const boardable = (state.boats || []).filter(boat => boat.fate === 'sailing' && boat.position === 13);
            html = `<header><div><span class="mn-kicker">海盗行动</span><h3>寻找登船机会</h3></div><small>仅限 13 格</small></header><p>登船后离开海盗船；也可以留守，等待第三轮掠夺仍停在 13 格的货船。</p><div class="mn-decision-grid">${boardable.map(boat => `<button type="button" data-choice="boardPirate" data-value="${boat.id}" ${a.boardPirate ? '' : 'disabled'}><b>${boat.good}货船</b><small>${boat.position} 格 · ${boat.accomplices} 名帮手</small></button>`).join('') || '<span class="mn-muted">没有可登上的货船</span>'}</div><button class="mn-quiet-choice" type="button" data-choice="skipPirate" ${a.skipPirate ? '' : 'disabled'}>选择留在海盗船</button>`;
            if (pendingChoice?.kind === 'boardPirate') html += choiceSummary(`登上${escapeHtml(pendingChoice.good)}货船·占用第 ${pendingChoice.occupied + 1}/${pendingChoice.capacity} 席`);
            if (pendingChoice?.kind === 'skipPirate') html += choiceSummary('留在海盗船，等待最终掠夺', 'is-warning');
        } else if (state.phase === 'plunder') {
            html = `<header><div><span class="mn-kicker">海盗裁决</span><h3>决定货船去向</h3></div><small>货船帮手不参与分红</small></header><p>送往港口会令对应货物涨价；送往船坞则按船坞顺位结算。</p><div class="mn-decision-grid"><button type="button" data-choice="plunder" data-value="port" ${a.plunderDestination ? '' : 'disabled'}><b>送往港口</b><small>货物行情上涨</small></button><button type="button" data-choice="plunder" data-value="shipyard" ${a.plunderDestination ? '' : 'disabled'}><b>送往船坞</b><small>进入保险结算</small></button></div>`;
            if (pendingChoice?.kind === 'plunderDestination') {
                const pending = state.pendingPlunder;
                html += choiceSummary(`把${escapeHtml(pending?.good || '')}货船送往${pendingChoice.destination === 'port' ? '港口（行情 +5）' : '船坞（保险参与赔付）'}·${pending?.cargoAccomplices || 0} 名货舱帮手不分红`);
            }
        } else if (state.status === 'ended') {
            html = `<div class="mn-finished"><i>终</i><div><span>航运季结束</span><strong>${escapeHtml(state.winner?.name || '商会')} 赢得马尼拉商会</strong><small>最终财富 ${state.winner?.fortune ?? '—'} 比索</small></div></div>`;
        } else html = '<div class="mn-waiting"><i></i><div><strong>等待其他商人</strong><span>海图会在下一项决策开始时自动更新。</span></div></div>';
        $('command').innerHTML = html;
    }

    function renderLocations() {
        const groups = [
            { title: '港口', subtitle: '货船到港顺位', ids: ['port-a', 'port-b', 'port-c'] },
            { title: '船坞', subtitle: '未到港船只顺位', ids: ['shipyard-a', 'shipyard-b', 'shipyard-c'] },
            { title: '特殊职位', subtitle: '改变航线与赔付', ids: ['pirate', 'pilot-small', 'pilot-large', 'insurance'] },
        ];
        $('locations').innerHTML = groups.map(group => `<section class="mn-location-group"><header><strong>${group.title}</strong><small>${group.subtitle}</small></header><div>${group.ids.map(id => {
            const info = LOCATION_INFO[id];
            const stakes = state.locations?.[id] || [];
            const detail = info.payout ? `投入 ${info.fee} · 回报 ${info.payout}` : id === 'insurance' ? '免费 · 先收 10' : `投入 ${info.fee}`;
            return `<article class="mn-location-card ${stakes.length ? 'is-occupied' : ''}" data-location-id="${escapeHtml(id)}"><div><strong>${info.label}</strong><small>${info.note || detail}</small></div><aside>${playerDots(stakes, info.capacity)}</aside></article>`;
        }).join('')}</div></section>`).join('');
    }

    function renderMaster() {
        const master = state.players?.find(player => player.id === state.harborMasterId);
        $('master').innerHTML = `<span class="mn-kicker">本次港务长</span><div><i style="--player:${escapeHtml(master?.color || '#d5a85e')}">${escapeHtml((master?.name || '待').slice(0, 1))}</i><span><strong>${escapeHtml(master?.name || '等待竞价')}</strong><small>${state.auction ? `当前最高出价 ${state.auction.highestBid} 比索` : '掌管装载与起点'}</small></span></div>`;
    }

    function renderPlayers() {
        $('players').innerHTML = (state.players || []).map(player => {
            const isMe = player.id === state.myId;
            return `<article class="mn-player ${isMe ? 'is-me' : ''} ${player.isOnline ? '' : 'is-away'}" data-player-id="${escapeHtml(player.id)}"><i style="--player:${escapeHtml(player.color)}">${escapeHtml(player.name.slice(0, 1))}</i><div><strong>${escapeHtml(player.name)}${isMe ? '<em>我</em>' : ''}</strong><small class="mn-player-assets">${isMe ? '' : shareBackFan(player.sharesCount)}<span>${player.sharesCount} 股 · ${player.encumberedShares} 抵押 · ${player.accomplices} 帮手</span></small></div><b>${player.fortune ?? player.cash}</b></article>`;
        }).join('');
    }

    function shareCertificate(good, index, encumbered) {
        const meta = GOOD_META[good] || GOOD_META.人参;
        const a = actions();
        const selectable = (!encumbered && a.takeLoan) || (encumbered && a.repayLoan);
        const selected = financeChoice?.index === index && financeChoice?.kind === (encumbered ? 'repayLoan' : 'takeLoan');
        return `<button class="mn-share ${encumbered ? 'is-encumbered' : ''} ${selected ? 'is-selected' : ''}" style="--share:${meta.accent}" type="button" data-good="${meta.id}" data-finance-kind="${encumbered ? 'repayLoan' : 'takeLoan'}" data-index="${index}" ${selectable ? '' : 'disabled'}><header><span>马尼拉商会股份</span><b>${String(index + 1).padStart(2, '0')}</b></header><div><i>${meta.mark}</i><span><strong>${good}</strong><small>${meta.note}</small></span></div><footer>${encumbered ? '已抵押 · 偿还 15' : '有效凭证 · 可借 12'}</footer></button>`;
    }

    function renderFinance() {
        const cash = myPlayer()?.cash ?? 0;
        const encumbered = new Set(state.myEncumberedShares || []);
        const shares = (state.myShares || []).map((good, index) => shareCertificate(good, index, encumbered.has(index))).join('');
        let confirmation = '';
        if (financeChoice) {
            const good = state.myShares?.[financeChoice.index] || '该';
            confirmation = `<div class="mn-finance-confirm"><span>${financeChoice.kind === 'takeLoan' ? `抵押${good}股份，取得 12 比索` : `支付 15 比索，赎回${good}股份`}</span><div><button type="button" data-ui="cancelFinance">取消</button><button type="button" data-ui="confirmFinance">确认</button></div></div>`;
        }
        $('finance').innerHTML = `<header class="mn-paper-title"><span>我的金库</span><b>${cash} 比索</b></header><p>点击可操作的股份，核对后确认抵押或偿还。</p><div class="mn-shares">${shares || '<span class="mn-muted">尚无股份</span>'}</div>${confirmation}`;
    }

    function renderLog() {
        $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') || '<p><i></i><span>等待第一次航行。</span></p>';
    }

    function playerName(playerId, fallback = '商人') {
        return state?.players?.find(player => player.id === playerId)?.name || fallback;
    }

    function boatName(boatId, fallback = '货船') {
        const boat = state?.boats?.find(candidate => Number(candidate.id) === Number(boatId));
        return boat?.good ? `${boat.good}货船` : fallback;
    }

    function findByData(attribute, value) {
        return [...mount.querySelectorAll(`[${attribute}]`)].find(element => String(element.getAttribute(attribute)) === String(value)) || null;
    }

    function playerAnchor(playerId) { return findByData('data-player-id', playerId); }
    function boatAnchor(boatId) { return findByData('data-boat-id', boatId); }
    function locationAnchor(locationId) { return findByData('data-location-id', locationId); }
    function marketAnchor(good) { return findByData('data-market-good', good); }

    function eventAnchor(sourceId, boatId) {
        if (boatId) return boatAnchor(boatId);
        if (String(sourceId || '').startsWith('boat-')) return boatAnchor(String(sourceId).slice(5));
        return locationAnchor(sourceId);
    }

    function centerOf(element) {
        if (!element?.isConnected) return null;
        const box = element.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }

    function clearHighlights() {
        mount.querySelectorAll('.mn-presentation-anchor').forEach(element => element.classList.remove('mn-presentation-anchor'));
        const line = $('actionLine');
        line?.classList.remove('is-visible', 'is-danger', 'is-profit');
    }

    function drawActionLine(fromElement, toElement, tone = '') {
        clearHighlights();
        const from = centerOf(fromElement);
        const to = centerOf(toElement);
        if (!from || !to) return;
        fromElement.classList.add('mn-presentation-anchor');
        toElement.classList.add('mn-presentation-anchor');
        const svg = $('actionLine');
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        const line = svg.querySelector('line');
        const circle = svg.querySelector('circle');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y); line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
        circle.setAttribute('cx', to.x); circle.setAttribute('cy', to.y);
        svg.classList.toggle('is-danger', tone === 'danger');
        svg.classList.toggle('is-profit', tone === 'profit');
        requestAnimationFrame(() => svg.classList.add('is-visible'));
    }

    function cancelPresentationWait() {
        if (waitTimer) window.clearTimeout(waitTimer);
        waitTimer = null;
        const release = releaseWait;
        releaseWait = null;
        release?.(false);
    }

    function presentationWait(duration, token) {
        if (reducedMotion) duration = Math.min(duration, 180);
        if (token !== presentationToken) return Promise.resolve(false);
        return new Promise(resolve => {
            const finish = value => { waitTimer = null; releaseWait = null; resolve(value); };
            releaseWait = finish;
            waitTimer = window.setTimeout(() => finish(token === presentationToken), Math.max(0, duration));
        });
    }

    function showPresentation(mode, tone, kicker, title, body = '') {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.className = `mn-presentation-layer is-${mode || 'compact'} ${tone ? `is-${tone}` : ''}`;
        $('presentationScene').innerHTML = `<div class="mn-scene-heading"><span>${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></div>${body}`;
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        if (!layer) return;
        layer.hidden = true;
        layer.className = 'mn-presentation-layer';
        $('presentationScene').innerHTML = '';
        $('movingLayer').innerHTML = '';
        mount.querySelectorAll('.mn-route-row.is-reenacting').forEach(row => row.classList.remove('is-reenacting'));
        clearHighlights();
    }

    function goodBadge(good, detail = '') {
        const meta = GOOD_META[good] || GOOD_META.人参;
        return `<span class="mn-scene-good" style="--good:${meta.accent}"><i>${meta.mark}</i><b>${escapeHtml(good || '货物')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
    }

    function playerBadge(playerId, name, detail = '') {
        const player = state?.players?.find(candidate => candidate.id === playerId);
        return `<span class="mn-scene-player" style="--player:${escapeHtml(player?.color || '#c49a5a')}"><i>${escapeHtml((name || player?.name || '商').slice(0, 1))}</i><b>${escapeHtml(name || player?.name || '商人')}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
    }

    async function animateBoatMove(move, token) {
        const row = boatAnchor(move.boatId);
        if (!row) return presentationWait(280, token);
        const points = [...row.querySelectorAll('[data-point]')];
        const fromPoint = Math.max(0, Math.min(14, Number(move.from) > 13 ? 14 : Number(move.from) || 0));
        const toPoint = Math.max(0, Math.min(14, Number(move.to) > 13 ? 14 : Number(move.to) || 0));
        const fromCell = points.find(cell => Number(cell.dataset.point) === fromPoint);
        const toCell = points.find(cell => Number(cell.dataset.point) === toPoint);
        const from = centerOf(fromCell);
        const to = centerOf(toCell);
        if (!from || !to) return presentationWait(280, token);
        row.classList.add('is-reenacting');
        const meta = GOOD_META[move.good] || GOOD_META.人参;
        const ghost = document.createElement('i');
        ghost.className = 'mn-moving-ship';
        ghost.style.setProperty('--good', meta.accent);
        ghost.style.left = `${from.x}px`;
        ghost.style.top = `${from.y}px`;
        ghost.innerHTML = '<i></i><b></b><em></em>';
        $('movingLayer').appendChild(ghost);
        ghost.getBoundingClientRect();
        ghost.style.transform = `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px))`;
        const continued = await presentationWait(620, token);
        ghost.remove();
        row.classList.remove('is-reenacting');
        return continued;
    }

    function movementBody(moves, activeIndex = -1) {
        return `<div class="mn-scene-moves">${(moves || []).map((move, index) => `<span class="${index === activeIndex ? 'is-active' : ''}">${goodBadge(move.good)}<b>${move.from} <em>→</em> ${Number(move.to) > 13 ? '港' : move.to}</b><small>${move.roll ? `骰子 ${move.roll}` : `${Number(move.delta) > 0 ? '+' : ''}${move.delta}`}</small></span>`).join('')}</div>`;
    }

    async function playMovementEvent(event, token, pilot = false) {
        const moves = event.moves || [];
        showPresentation('medium', pilot ? 'pilot' : 'sailing', pilot ? '领航调度' : `第 ${event.round || state?.movementRound || ''} 轮行船`, pilot ? `${event.actorName || playerName(event.actorId)}调整航线` : `${event.actorName || playerName(event.actorId, '港务长')}发布行船顺序`, movementBody(moves));
        drawActionLine(playerAnchor(event.actorId), boatAnchor(moves[0]?.boatId), pilot ? '' : 'profit');
        if (!await presentationWait(420, token)) return;
        for (let index = 0; index < moves.length && token === presentationToken; index += 1) {
            $('presentationScene').innerHTML = `<div class="mn-scene-heading"><span>${pilot ? '领航调度' : `第 ${event.round || ''} 轮行船`}</span><h2>${pilot ? `${event.actorName || '领航员'}调整航线` : `第 ${index + 1} 船出发`}</h2></div>${movementBody(moves, index)}`;
            drawActionLine(playerAnchor(event.actorId), boatAnchor(moves[index].boatId), pilot ? '' : 'profit');
            if (!await animateBoatMove(moves[index], token)) return;
        }
        await presentationWait(300, token);
    }

    async function playVoyageSettlement(event, token) {
        const gains = (event.players || []).slice().sort((a, b) => b.gained - a.gained);
        const boats = (event.boats || []).map(boat => goodBadge(boat.good, boat.plundered ? '遭掠夺' : boat.fate === 'port' ? `港口 ${boat.portIndex || ''}` : `船坞 ${boat.shipyardIndex || ''}`)).join('');
        const marketRows = GOODS.map(good => {
            const before = Number(event.marketBefore?.[good] || 0);
            const after = Number(event.marketAfter?.[good] || 0);
            return `<span class="${after > before ? 'is-up' : ''}"><b>${escapeHtml(good)}</b><em>${before} → ${after}</em></span>`;
        }).join('');
        const gainRows = gains.map(player => `<span data-settlement-player="${escapeHtml(player.id)}"><b>${escapeHtml(player.name)}</b><em class="${player.gained >= 0 ? 'is-positive' : 'is-negative'}">${player.gained >= 0 ? '+' : ''}${player.gained}</em><small>${player.cashAfter} 比索</small></span>`).join('');
        showPresentation('major', 'settlement', `第 ${event.voyage} 次航行`, '船队入港·开盘结算', `<div class="mn-scene-fleet">${boats}</div><div class="mn-settlement-columns"><section><header>商人收益</header><div class="mn-scene-ledger">${gainRows || '<span>本轮无现金变化</span>'}</div></section><section><header>黑市行情</header><div class="mn-scene-market">${marketRows}</div></section></div><p class="mn-live-payout" data-live-payout>港务员正在核对各项分红……</p>`);
        if (!await presentationWait(650, token)) return;
        const details = (event.payoutDetails || []).filter(detail => detail.amount).slice(0, 6);
        for (const detail of details) {
            if (token !== presentationToken) return;
            const live = $('presentationScene').querySelector('[data-live-payout]');
            if (live) live.textContent = `${detail.playerName} ${detail.amount > 0 ? '获得' : '支付'} ${Math.abs(detail.amount)} 比索`;
            drawActionLine(eventAnchor(detail.sourceId, detail.boatId), playerAnchor(detail.playerId), detail.amount > 0 ? 'profit' : 'danger');
            if (!await presentationWait(420, token)) return;
        }
        clearHighlights();
        const live = $('presentationScene').querySelector('[data-live-payout]');
        if (live) live.textContent = '本次航行账目已封存';
        await presentationWait(700, token);
    }

    async function playPresentationEvent(event, token) {
        const actor = event.actorName || playerName(event.actorId);
        if (event.kind === 'boatsSailed') return playMovementEvent(event, token, false);
        if (event.kind === 'pilotMoved') return playMovementEvent(event, token, true);
        if (event.kind === 'voyageSettlement') return playVoyageSettlement(event, token);
        if (event.kind === 'finalSettlement') {
            const winners = new Set(event.winnerIds || []);
            const rows = (event.standings || []).map((player, index) => `<span class="${winners.has(player.id) ? 'is-winner' : ''}"><i>${index + 1}</i><b>${escapeHtml(player.name)}</b><small>现金 ${player.cash} + 股份 ${player.shareValue} − 贷款 ${player.loanPenalty}</small><em>${player.fortune}</em></span>`).join('');
            showPresentation('major', 'final', '马尼拉商会', '航运季最终清算', `<div class="mn-final-ledger">${rows}</div><p class="mn-final-winner">${escapeHtml((event.standings || []).filter(player => winners.has(player.id)).map(player => player.name).join('、') || '商会')}赢得本局</p>`);
            const winnerId = event.winnerIds?.[0];
            drawActionLine($('master'), playerAnchor(winnerId), 'profit');
            await presentationWait(2600, token);
            return;
        }

        let mode = 'compact'; let tone = ''; let kicker = '南洋商路'; let title = ''; let body = ''; let from = null; let to = null; let duration = 650;
        if (event.kind === 'auctionBid') { kicker = '港务长竞价'; title = `${actor}出价 ${event.amount} 比索`; body = playerBadge(event.actorId, actor, `现金 ${event.cash}·可抵押 ${event.mortgageCapacity}`); from = playerAnchor(event.actorId); to = $('master'); }
        else if (event.kind === 'auctionPassed') { kicker = '港务长竞价'; title = `${actor}退出本轮竞价`; body = `<p class="mn-scene-note">仍有 ${event.remaining} 人保留竞价资格</p>`; from = playerAnchor(event.actorId); duration = 420; }
        else if (event.kind === 'harborMasterAppointed') { mode = 'medium'; tone = 'appointed'; kicker = '任命书'; title = `${event.playerName}成为港务长`; body = `${playerBadge(event.playerId, event.playerName, event.winningBid ? `成交价 ${event.winningBid}比索` : '续任')}${event.mortgagesAdded ? `<p class="mn-scene-note">自动抵押 ${event.mortgagesAdded} 张股份</p>` : ''}`; from = $('master'); to = playerAnchor(event.playerId); duration = 1100; }
        else if (event.kind === 'sharePurchased') { kicker = '黑市交割'; title = `${actor}购入${event.good}股份`; body = `${goodBadge(event.good, `${event.price} 比索`)}${event.mortgagesAdded ? `<p class="mn-scene-note">同时抵押 ${event.mortgagesAdded} 张股份</p>` : ''}`; from = playerAnchor(event.actorId); to = marketAnchor(event.good); }
        else if (event.kind === 'sharePurchaseSkipped') { kicker = '港务长权限'; title = `${actor}放弃购股`; body = '<p class="mn-scene-note">船队规划继续</p>'; duration = 430; }
        else if (event.kind === 'fleetPlanned') { mode = 'medium'; tone = 'sailing'; kicker = '港务长航令'; title = `${actor}完成船队配置`; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, `起点 ${boat.start}`)).join('')}</div>`; from = playerAnchor(event.actorId); to = boatAnchor(event.boats?.[0]?.id); duration = 1200; }
        else if (event.kind === 'accomplicePlaced') { kicker = `第 ${event.slot} 席`; title = `${actor}安插帮手`; body = `${playerBadge(event.actorId, actor, `支付 ${event.fee}比索`)}<p class="mn-scene-note">${escapeHtml(event.locationName)}·${event.slot}/${event.capacity}${event.blindPassenger ? '·盲乘客' : ''}${event.insuranceAdvance ? `·保险预支 +${event.insuranceAdvance}` : ''}</p>`; from = playerAnchor(event.actorId); to = event.boatId ? boatAnchor(event.boatId) : locationAnchor(event.locationId); }
        else if (event.kind === 'placementPassed') { kicker = `第 ${event.placementRound} 轮安插`; title = `${actor}退出后续安插`; duration = 420; }
        else if (event.kind === 'sailingRolled') { mode = 'medium'; tone = 'sailing'; kicker = `第 ${event.round} 轮骰点`; title = '海风已定·等待行船顺序'; body = `<div class="mn-dice-reveal">${(event.rolls || []).map(item => `${goodBadge(item.good)}<i>${item.roll}</i>`).join('')}</div>`; from = $('master'); to = playerAnchor(event.harborMasterId); duration = 1050; }
        else if (event.kind === 'placementResumed') { kicker = '新一轮布局'; title = `第 ${event.placementRound} 轮安插开始`; duration = 520; }
        else if (event.kind === 'pilotPhaseStarted') { mode = 'medium'; tone = 'pilot'; kicker = '第三轮之前'; title = '领航员登上海图'; body = `<div class="mn-scene-people">${(event.pilots || []).map(pilot => playerBadge(pilot.playerId, pilot.playerName, pilot.size === 'large' ? '大领航员' : '小领航员')).join('')}</div>`; duration = 950; }
        else if (event.kind === 'pilotSkipped') { kicker = '领航调度'; title = `${actor}保持原航线`; duration = 460; }
        else if (event.kind === 'pirateAlert') { mode = 'medium'; tone = 'danger'; kicker = '十三格警报'; title = '海盗船逼近货船'; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, '停在 13 格')).join('')}</div>`; from = locationAnchor('pirate'); to = boatAnchor(event.boats?.[0]?.id); duration = 1100; }
        else if (event.kind === 'pirateBoarded') { mode = 'medium'; tone = 'danger'; kicker = '海盗登船'; title = `${actor}登上${event.good}货船`; body = `${playerBadge(event.actorId, actor, `船上海盗 ${event.pirateCount}`)}${goodBadge(event.good, `货舱帮手 ${event.accomplices?.length || 0}`)}`; from = playerAnchor(event.actorId) || locationAnchor('pirate'); to = boatAnchor(event.boatId); duration = 1050; }
        else if (event.kind === 'pirateStayed') { kicker = '海盗决断'; title = `${actor}留守海盗船`; body = '<p class="mn-scene-note">等待最终掠夺时机</p>'; duration = 520; }
        else if (event.kind === 'plunderPhaseStarted') { mode = 'medium'; tone = 'danger'; kicker = '航程末端'; title = '海盗船长取得裁决权'; body = `<div class="mn-scene-fleet">${(event.boats || []).map(boat => goodBadge(boat.good, `船长·${boat.captainName}`)).join('')}</div>`; duration = 1000; }
        else if (event.kind === 'plunderResolved') { mode = 'medium'; tone = 'danger'; kicker = '掠夺裁决'; title = `${event.good}货船驶往${event.destination === 'port' ? '港口' : '船坞'}`; body = `${goodBadge(event.good, `海盗预计每人 ${event.estimatedShare}比索`)}<p class="mn-scene-note">货舱帮手将不获得货物分红</p>`; from = boatAnchor(event.boatId); to = locationAnchor(event.destination === 'port' ? 'port-a' : 'shipyard-a'); duration = 1150; }
        else if (event.kind === 'voyageStarted') { mode = 'medium'; tone = 'sailing'; kicker = '新航程'; title = `第 ${event.voyage} 次航行开始`; body = '<p class="mn-scene-note">商人重新竞选港务长</p>'; duration = 850; }
        else return;
        showPresentation(mode, tone, kicker, title, body);
        if (from && to) drawActionLine(from, to, tone === 'danger' ? 'danger' : tone === 'sailing' ? 'profit' : '');
        await presentationWait(duration, token);
    }

    async function drainPresentations() {
        if (presentationPlaying || !presentationQueue.length) return;
        presentationPlaying = true;
        const token = ++presentationToken;
        renderCommand();
        while (presentationQueue.length && token === presentationToken) {
            const presentation = presentationQueue.shift();
            for (const event of presentation.events || []) {
                if (token !== presentationToken) break;
                await playPresentationEvent(event, token);
                clearHighlights();
            }
        }
        if (token !== presentationToken) return;
        hidePresentation();
        presentationPlaying = false;
        renderCommand();
    }

    function skipPresentation() {
        presentationQueue = [];
        presentationPlaying = false;
        presentationToken += 1;
        cancelPresentationWait();
        hidePresentation();
        renderCommand();
    }

    function gameAction(kind, extra = {}) {
        if (actionPending || presentationPlaying) return;
        actionPending = true;
        pendingChoice = null;
        financeChoice = null;
        send({ type: 'gameAction', action: { kind, ...extra } });
    }

    function confirmChoice() {
        if (!pendingChoice) return;
        const choice = pendingChoice;
        if (choice.kind === 'bid') gameAction('bid', { amount: choice.amount });
        else if (choice.kind === 'pass') gameAction('pass');
        else if (choice.kind === 'buyShare') gameAction('buyShare', { good: choice.good });
        else if (choice.kind === 'skipShare') gameAction('skipShare');
        else if (choice.kind === 'placeAccomplice') gameAction('placeAccomplice', { location: choice.location });
        else if (choice.kind === 'passPlacement') gameAction('passPlacement');
        else if (choice.kind === 'sailBoats') gameAction('sailBoats', { order: choice.order });
        else if (choice.kind === 'skipPilot') gameAction('skipPilot');
        else if (choice.kind === 'boardPirate') gameAction('boardPirate', { boatId: choice.boatId });
        else if (choice.kind === 'skipPirate') gameAction('skipPirate');
        else if (choice.kind === 'plunderDestination') gameAction('plunderDestination', { destination: choice.destination });
    }

    function selectChoice(button) {
        const kind = button.dataset.choice;
        const value = button.dataset.value;
        if (kind === 'bid') {
            const input = mount.querySelector('[data-draft="bid"]');
            bidDraft = Number(input?.value);
            const minimum = Number(state.auction?.highestBid || 0) + 1;
            const maximum = Number(myPlayer()?.cash || 0) + ((state.myShares?.length || 0) - (state.myEncumberedShares?.length || 0)) * 12;
            if (!Number.isInteger(bidDraft) || bidDraft < minimum || bidDraft > maximum) { addLog(`出价需为 ${minimum}–${maximum} 的整数`, 'error'); return; }
            pendingChoice = { kind: 'bid', amount: bidDraft };
        } else if (kind === 'pass') pendingChoice = { kind: 'pass' };
        else if (kind === 'share') pendingChoice = { kind: 'buyShare', good: value, price: Math.max(5, Number(state.market?.[value] || 0)) };
        else if (kind === 'skipShare') pendingChoice = { kind: 'skipShare' };
        else if (kind === 'location') {
            const info = LOCATION_INFO[value];
            const occupied = state.locations?.[value]?.length || 0;
            pendingChoice = { kind: 'placeAccomplice', location: value, fee: info.group === 'cargo' ? info.fees[occupied] : info.fee, occupied, capacity: info.capacity };
        } else if (kind === 'passPlacement') pendingChoice = { kind: 'passPlacement' };
        else if (kind === 'skipPilot') pendingChoice = { kind: 'skipPilot' };
        else if (kind === 'boardPirate') {
            const boat = state.boats?.find(candidate => candidate.id === Number(value));
            pendingChoice = { kind: 'boardPirate', boatId: Number(value), good: boat?.good || '', occupied: Number(boat?.accomplices || 0) + Number(boat?.pirates || 0), capacity: boat?.good === '玉石' ? 4 : 3 };
        } else if (kind === 'skipPirate') pendingChoice = { kind: 'skipPirate' };
        else if (kind === 'plunder') pendingChoice = { kind: 'plunderDestination', destination: value };
        renderCommand();
    }

    function openRules() {
        previousFocus = document.activeElement;
        $('rulesOverlay').classList.remove('is-hidden');
        $('rulesOverlay').querySelector('.mn-close')?.focus();
    }

    function closeRules() {
        $('rulesOverlay').classList.add('is-hidden');
        previousFocus?.focus?.();
    }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            const ui = uiButton.dataset.ui;
            if (ui === 'skipPresentation') { skipPresentation(); return; }
            if (presentationPlaying) return;

            else if (ui === 'rules') openRules();
            else if (ui === 'closeRules') closeRules();
            else if (ui === 'cancelChoice') { if (pendingChoice?.kind === 'sailBoats') sailOrder = []; pendingChoice = null; renderCommand(); }
            else if (ui === 'confirmChoice') confirmChoice();
            else if (ui === 'resetSail') { sailOrder = []; pendingChoice = null; renderCommand(); }
            else if (ui === 'cancelFinance') { financeChoice = null; renderFinance(); }
            else if (ui === 'confirmFinance' && financeChoice) gameAction(financeChoice.kind, { shareIndex: financeChoice.index });
            return;
        }
        if (presentationPlaying) return;
        if (event.target === $('rulesOverlay')) { closeRules(); return; }
        const finance = event.target.closest('[data-finance-kind]');
        if (finance) { financeChoice = { kind: finance.dataset.financeKind, index: Number(finance.dataset.index) }; renderFinance(); return; }
        const sailButton = event.target.closest('[data-sail-boat]');
        if (sailButton && !sailButton.disabled) {
            const boatId = Number(sailButton.dataset.sailBoat);
            sailOrder = sailOrder.includes(boatId) ? sailOrder.filter(id => id !== boatId) : [...sailOrder, boatId];
            const required = state.movementPlan?.rolls?.length || 0;
            pendingChoice = required && sailOrder.length === required ? { kind: 'sailBoats', order: sailOrder.slice() } : null;
            renderCommand();
            return;
        }
        const choice = event.target.closest('[data-choice]');
        if (choice && !choice.disabled) { selectChoice(choice); return; }
        const draftButton = event.target.closest('[data-draft-button]');
        if (draftButton?.dataset.draftButton === 'pilot-mode') { pilotDraft.mode = draftButton.dataset.value; renderCommand(); return; }
        const confirmation = event.target.closest('[data-confirm]');
        if (confirmation?.dataset.confirm === 'boats') gameAction('setBoats', { boats: boatDraft.map(boat => ({ good: boat.good, start: Number(boat.start) })) });
        if (confirmation?.dataset.confirm === 'pilot') {
            const moves = [{ boatId: Number(pilotDraft.boat1), delta: Number(pilotDraft.delta1) }];
            if (pilotDraft.mode === 'two') moves.push({ boatId: Number(pilotDraft.boat2), delta: Number(pilotDraft.delta2) });
            gameAction('pilotMove', { moves });
        }
    }

    function handleChange(event) {
        if (presentationPlaying) return;
        const field = event.target.closest('[data-draft]');
        if (!field) return;
        const type = field.dataset.draft;
        if (type === 'bid') { bidDraft = Number(field.value); return; }
        const index = Number(field.dataset.index);
        if (type === 'boat-good') boatDraft[index].good = field.value;
        if (type === 'boat-start') boatDraft[index].start = Number(field.value);
        if (type === 'pilot-boat1') {
            pilotDraft.boat1 = field.value;
            if (pilotDraft.boat2 === field.value) pilotDraft.boat2 = String((state.boats || []).find(boat => boat.fate === 'sailing' && String(boat.id) !== field.value)?.id ?? '');
        }
        if (type === 'pilot-delta1') pilotDraft.delta1 = Number(field.value);
        if (type === 'pilot-boat2') pilotDraft.boat2 = field.value;
        if (type === 'pilot-delta2') pilotDraft.delta2 = Number(field.value);
        renderCommand();
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && !$('rulesOverlay').classList.contains('is-hidden')) closeRules();
    }

    function handleMessage(message) {
        if (message.state) {
            const firstState = !state;
            const nextSignature = signature(message.state);
            state = message.state;
            actionPending = false;
            if (nextSignature !== interactionSignature) { interactionSignature = nextSignature; resetDrafts(); }
            render();
            const presentation = message.state.presentation;
            if (presentation?.resolved && presentation.sequence !== lastPresentationSequence) {
                lastPresentationSequence = presentation.sequence;
                if (!firstState && presentation.events?.length) {
                    presentationQueue.push(presentation);
                    void drainPresentations();
                }
            }
        }
        if (message.type === 'error') {
            actionPending = false;
            addLog(message.message || '操作失败', 'error');
        }
    }

    mount.addEventListener('click', handleClick);
    mount.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'manila',
        handleMessage,
        destroy() {
            presentationToken += 1;
            cancelPresentationWait();
            hidePresentation();
            mount.removeEventListener('click', handleClick);
            mount.removeEventListener('change', handleChange);
            document.removeEventListener('keydown', handleKeydown);
            style.remove();
            mount.innerHTML = '';
        },
    };
}
