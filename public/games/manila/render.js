import { escapeHtml, GOODS, GOOD_META, LOCATION_INFO, PHASE_LABELS, shareBackFan } from './constants.js';
import { getActions, getMyPlayer, phaseLabel } from './state.js';

/** Manila's state-to-DOM renderer.  It owns no websocket or event wiring. */
export function createManilaRenderer({ mount, model, getElement }) {
    const $ = role => getElement(role);
    const current = () => model.state;
    const actions = () => getActions(current());
    const myPlayer = () => getMyPlayer(current());
    const label = () => phaseLabel(current(), PHASE_LABELS);
    const presentationLocked = () => model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0);

    function clearError() {
        const banner = $('errorBanner');
        banner.textContent = '';
        banner.classList.add('is-hidden');
    }

    function showError(message) {
        const banner = $('errorBanner');
        banner.textContent = message || '操作失败，请重试';
        banner.classList.remove('is-hidden');
        banner.focus?.({ preventScroll: true });
    }

    function statusText() {
        const state = current();
        if (state.status === 'ended') {
            const winnerIds = (state.winners || []).map(player => String(player.id));
            if (winnerIds.includes(String(state.myId))) return winnerIds.length > 1 ? '您已并列获胜 · 终局财富已封存' : '您已获胜 · 终局财富已封存';
            const names = state.winners?.map(player => player.name).join('、') || state.winner?.name || '本局结束';
            return `${escapeHtml(names)} ${winnerIds.length > 1 ? '并列赢得商会' : '赢得商会'} · 财富 ${state.winner?.fortune ?? '—'}`;
        }
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
        const state = current();
        if (!state) return;
        mount.querySelector('.manila-app')?.setAttribute('aria-busy', String(model.actionPending || presentationLocked()));
        const me = myPlayer();
        const shareCount = Number(me?.sharesCount ?? state.myShares?.length ?? 0);
        const encumberedCount = Number(me?.encumberedShares ?? state.myEncumberedShares?.length ?? 0);
        $('round').textContent = state.status === 'ended' ? '最终结算' : `第 ${state.voyage || 1} 次航行 · ${label()}`;
        $('movement').textContent = state.phase === 'sailing' ? `第 ${state.movementPlan?.round || state.movementRound} / 3 轮 · 骰点已出` : state.movementRound ? `已完成 ${state.movementRound} / 3 轮` : '尚未掷骰';
        $('status').innerHTML = `<div><span class="mn-kicker">${label()}</span><h2>${statusText()}</h2></div><aside><p>${state.currentTurnName ? `当前操作 · ${escapeHtml(state.currentTurnName)}` : state.harborMasterName ? `港务长 · ${escapeHtml(state.harborMasterName)}` : '等待港务长'}</p><div class="mn-self-summary" aria-label="我的资产：${me?.cash ?? 0} 比索，${shareCount} 股，${encumberedCount} 股抵押，${me?.accomplices ?? 0} 名帮手"><span><b>${me?.cash ?? 0}</b> 比索</span><span><b>${shareCount}</b> 股</span><span><b>${encumberedCount}</b> 抵押</span><span><b>${me?.accomplices ?? 0}</b> 帮手</span></div></aside>`;
        renderMarket(); renderBoats(); renderCommand(); renderLocations(); renderMaster(); renderPlayers(); renderFinance(); renderLog();
        if (model.actionPending || presentationLocked()) mount.querySelectorAll('button:not([data-ui="skipPresentation"]), input, select').forEach(control => { control.disabled = true; });
    }

    function renderMarket() {
        const state = current();
        $('market').innerHTML = GOODS.map(good => {
            const meta = GOOD_META[good];
            const value = Number(state.market?.[good] || 0);
            const remaining = Number(state.shareMarket?.[good] || 0);
            return `<article class="mn-market-item" data-market-good="${escapeHtml(good)}" style="--good:${meta.accent}"><i>${meta.mark}</i><div><strong>${good}</strong><small>余 ${remaining} 股</small></div><b>${value}</b><span><em style="width:${Math.min(100, value / 30 * 100)}%"></em></span></article>`;
        }).join('');
    }

    function playerDots(stakes, capacity) {
        const state = current();
        const list = Array.isArray(stakes) ? stakes : [];
        return Array.from({ length: capacity }, (_, index) => {
            const stake = list[index];
            const player = stake && state.players?.find(candidate => candidate.id === stake.playerId);
            return stake ? `<span class="mn-stake is-filled" style="--player:${escapeHtml(player?.color || '#d5a85e')}" title="${escapeHtml(stake.playerName || '商人')} · ${stake.fee} 比索" aria-label="${escapeHtml(stake.playerName || '商人')}下注"></span>` : '<span class="mn-stake" aria-label="空位"></span>';
        }).join('');
    }

    function boatFate(boat) {
        if (boat.fate === 'port') return `抵达港口${boat.portIndex ? ` · ${boat.portIndex} 号` : ''}`;
        if (boat.fate === 'shipyard') return `进入船坞${boat.shipyardIndex ? ` · ${boat.shipyardIndex} 号` : ''}`;
        if (boat.fate === 'pirated') return '等待海盗裁决';
        return boat.position === 13 ? '停在 13 格' : '航行中';
    }

    function renderBoats() {
        const state = current();
        const boats = state.boats || [];
        if (!boats.length) { $('boats').innerHTML = '<div class="mn-empty-route"><i></i><strong>船位尚空</strong><span>港务长安排三种货物后，航线会在这里展开。</span></div>'; return; }
        $('boats').innerHTML = boats.map(boat => {
            const meta = GOOD_META[boat.good] || GOOD_META.人参;
            const stakes = state.locations?.[meta.id] || [];
            const pending = state.movementPlan?.rolls?.find(item => Number(item.boatId) === Number(boat.id));
            const latest = state.lastMovement?.moves?.find(item => Number(item.boatId) === Number(boat.id));
            const moveNote = pending ? `待行 +${pending.roll}` : latest && state.lastMovement?.round === state.movementRound ? `本轮 +${latest.roll}` : '';
            const position = Math.max(0, Math.min(14, Number(boat.position) || 0));
            const cells = Array.from({ length: 15 }, (_, point) => {
                const isBoat = point === position; const label = point === 14 ? '港' : point;
                return `<span class="mn-river-cell ${point <= 5 ? 'is-start' : ''} ${point === 13 ? 'is-pirate' : ''} ${point === 14 ? 'is-harbor' : ''} ${isBoat ? 'has-boat' : ''}" data-point="${point}"><b>${label}</b>${isBoat ? `<i class="mn-ship" aria-label="${escapeHtml(boat.good)}货船在 ${boat.position > 13 ? '马尼拉港' : `${boat.position} 格`}"><i></i><b></b><em></em></i>` : ''}</span>`;
            }).join('');
            return `<article class="mn-route-row is-${escapeHtml(boat.fate)}" data-boat-id="${boat.id}" style="--good:${meta.accent}"><header><i>${meta.mark}</i><div><strong>${escapeHtml(boat.good)}货船</strong><small>${boatFate(boat)}</small></div><b>${moveNote || (boat.arrived ? '到港' : `${boat.position} 格`)}</b></header><div class="mn-waterway"><div class="mn-river-track">${cells}</div></div><footer><span>货舱下注</span><div>${playerDots(stakes, LOCATION_INFO[meta.id].capacity)}</div><small>${boat.accomplices || 0} 名帮手${boat.pirates ? ` · ${boat.pirates} 名海盗已登船` : ''}</small></footer></article>`;
        }).join('');
    }

    function choiceSummary(text, tone = '') { return `<div class="mn-confirm ${tone}"><div><span>待确认</span><strong>${text}</strong></div><div><button type="button" data-ui="cancelChoice" ${model.presentationPlaying ? 'disabled' : ''}>取消</button><button class="mn-primary" type="button" data-ui="confirmChoice" ${model.presentationPlaying ? 'disabled' : ''}>确认执行</button></div></div>`; }

    function renderCommand() {
        const state = current(); const a = actions(); let html = '';
        if (a.bid || a.passBid) {
            const highest = Number(state.auction?.highestBid || 0); const maximum = Number(myPlayer()?.cash || 0) + ((state.myShares?.length || 0) - (state.myEncumberedShares?.length || 0)) * 12;
            html = `<header><div><span class="mn-kicker">本轮操作</span><h3>竞选港务长</h3></div><small>最高出价 ${highest} 比索</small></header><p>港务长决定本次装载与起航位置。可用现金与未抵押股份决定你的出价上限。</p><div class="mn-bid-line"><label>我的出价<input data-draft="bid" type="number" min="${highest + 1}" max="${maximum}" value="${model.bidDraft}"></label><small>最高可出 ${maximum}</small></div><div class="mn-choice-row"><button type="button" data-choice="bid">选择此出价</button><button type="button" data-choice="pass">选择放弃竞价</button></div>`;
            if (model.pendingChoice?.kind === 'bid') { const cash = Number(myPlayer()?.cash || 0); const mortgages = Math.ceil(Math.max(0, model.pendingChoice.amount - cash) / 12); html += choiceSummary(`出价 ${model.pendingChoice.amount} 比索·${mortgages ? `若成交将抵押 ${mortgages} 股·` : ''}成交后现金 ${cash + mortgages * 12 - model.pendingChoice.amount}`); }
            if (model.pendingChoice?.kind === 'pass') html += choiceSummary('放弃本轮竞价；本次拍卖不能再次加入', 'is-warning');
        } else if (a.buyShare || a.skipShare) {
            html = `<header><div><span class="mn-kicker">港务长权限</span><h3>购买一张股份</h3></div><small>仅此一次</small></header><p>售价取当前黑市价与 5 比索中的较高者；资金不足时会自动抵押股份。</p><div class="mn-good-choices">${GOODS.map(good => { const meta = GOOD_META[good]; const remaining = Number(state.shareMarket?.[good] || 0); const price = Math.max(5, Number(state.market?.[good] || 0)); return `<button type="button" data-choice="share" data-value="${good}" style="--good:${meta.accent}" ${remaining ? '' : 'disabled'}><i>${meta.mark}</i><span><b>${good}</b><small>${price} 比索 · 余 ${remaining}</small></span></button>`; }).join('')}</div><button class="mn-quiet-choice" type="button" data-choice="skipShare">选择不购买</button>`;
            if (model.pendingChoice?.kind === 'buyShare') html += choiceSummary(`购买 1 张${escapeHtml(model.pendingChoice.good)}股份，支付 ${model.pendingChoice.price} 比索`);
            if (model.pendingChoice?.kind === 'skipShare') html += choiceSummary('跳过本次股份购买机会', 'is-warning');
        } else if (a.setBoats) {
            const sum = model.boatDraft.reduce((total, boat) => total + Number(boat.start), 0); const distinct = new Set(model.boatDraft.map(boat => boat.good)).size === 3; const valid = distinct && sum === 9;
            html = `<header><div><span class="mn-kicker">港务长权限</span><h3>装载三艘货船</h3></div><small>起点总和 ${sum} / 9</small></header><p>三艘船必须装载不同货物；起点越靠前，到港机会越高。</p><div class="mn-boat-planner">${model.boatDraft.map((boat, index) => `<label><span>第 ${index + 1} 艘</span><select data-draft="boat-good" data-index="${index}">${GOODS.map(good => `<option value="${good}" ${good === boat.good ? 'selected' : ''}>${good}</option>`).join('')}</select><select data-draft="boat-start" data-index="${index}">${[0, 1, 2, 3, 4, 5].map(point => `<option value="${point}" ${point === Number(boat.start) ? 'selected' : ''}>从 ${point} 格出发</option>`).join('')}</select></label>`).join('')}</div><div class="mn-plan-result ${valid ? 'is-valid' : ''}"><span>${distinct ? '货物不重复' : '货物有重复'}</span><span>${sum === 9 ? '起点合计正确' : `还需调整 ${Math.abs(9 - sum)} 格`}</span><button class="mn-primary" type="button" data-confirm="boats" ${valid ? '' : 'disabled'}>确认船队并扬帆</button></div>`;
        } else if (a.placeAccomplice || a.passPlacement) {
            const loaded = new Set((state.boats || []).filter(boat => boat.fate === 'sailing').map(boat => GOOD_META[boat.good]?.id));
            html = `<header><div><span class="mn-kicker">本轮操作</span><h3>安插一名帮手</h3></div><small>剩余 ${myPlayer()?.accomplices ?? 0} 名</small></header><p>先选位置，再核对费用。货船从左至右逐格涨价；必要时服务端会自动抵押股份筹款。</p><div class="mn-placement-choices">${Object.entries(LOCATION_INFO).map(([id, info]) => { const occupied = state.locations?.[id]?.length || 0; const isCargo = info.group === 'cargo'; const fee = isCargo ? info.fees[occupied] : info.fee; const disabled = !a.placeAccomplice || occupied >= info.capacity || (isCargo && !loaded.has(id)); return `<button type="button" data-choice="location" data-value="${id}" ${disabled ? 'disabled' : ''}><span><b>${info.label}</b><small>${isCargo ? `货舱 ${occupied + 1} / ${info.capacity}` : info.note || `${occupied} / ${info.capacity}`}</small></span><em>${fee ?? 0}</em></button>`; }).join('')}</div><button class="mn-quiet-choice" type="button" data-choice="passPlacement">选择退出本次航行的后续安插</button>`;
            if (model.pendingChoice?.kind === 'placeAccomplice') { const cash = Number(myPlayer()?.cash || 0); const mortgages = Math.ceil(Math.max(0, model.pendingChoice.fee - cash) / 12); const projectedCash = cash + mortgages * 12 - model.pendingChoice.fee + (model.pendingChoice.location === 'insurance' ? 10 : 0); html += choiceSummary(`安插到${LOCATION_INFO[model.pendingChoice.location]?.label || ''}·席位 ${model.pendingChoice.occupied + 1}/${model.pendingChoice.capacity}·支付 ${model.pendingChoice.fee}${mortgages ? `·抵押 ${mortgages} 股` : ''}·余 ${Math.max(0, projectedCash)} 比索`); }
            if (model.pendingChoice?.kind === 'passPlacement') html += choiceSummary('本次航行不再安插帮手', 'is-warning');
        } else if (state.phase === 'sailing') {
            const rolls = state.movementPlan?.rolls || []; const byId = new Map(rolls.map(item => [Number(item.boatId), item])); const displayOrder = [...model.sailOrder, ...rolls.map(item => Number(item.boatId)).filter(id => !model.sailOrder.includes(id))];
            html = `<header><div><span class="mn-kicker">第 ${state.movementPlan?.round || state.movementRound} 轮行船</span><h3>港务长决定行船顺序</h3></div><small>公开骰点 · 依次选船</small></header><p>${a.sailBoats ? '依次点选货船。先到港的船占据前面的港口位，因此同一轮内的移动顺序会影响收益。' : `等待${escapeHtml(state.harborMasterName || '港务长')}确认；所有骰点与顺序均为公开信息。`}</p><div class="mn-sail-board">${displayOrder.map(boatId => { const item = byId.get(boatId); if (!item) return ''; const orderIndex = model.sailOrder.indexOf(boatId); const meta = GOOD_META[item.good] || GOOD_META.人参; return `<button type="button" data-sail-boat="${boatId}" class="${orderIndex >= 0 ? 'is-selected' : ''}" style="--good:${meta.accent}" ${a.sailBoats ? '' : 'disabled'}><span class="mn-sail-order">${orderIndex >= 0 ? orderIndex + 1 : '·'}</span><i class="mn-die">${item.roll}</i><span><b>${escapeHtml(item.good)}货船</b><small>${item.from} 格 → ${item.projected > 13 ? '马尼拉港' : `${item.projected} 格`}</small></span></button>`; }).join('')}</div>${a.sailBoats ? `<div class="mn-sail-tools"><span>已选 ${model.sailOrder.length} / ${rolls.length} 艘</span><button type="button" data-ui="resetSail" ${model.sailOrder.length ? '' : 'disabled'}>重选顺序</button></div>` : ''}`;
            if (model.pendingChoice?.kind === 'sailBoats') html += choiceSummary(`依次移动：${model.pendingChoice.order.map(id => escapeHtml(byId.get(id)?.good || '')).join(' → ')}`);
        } else if (state.phase === 'pilot') {
            const sailing = (state.boats || []).filter(boat => boat.fate === 'sailing'); const large = (state.locations?.['pilot-large'] || []).some(stake => stake.playerId === state.currentTurn); const canMove = Boolean(a.pilotMove && sailing.length); if (!large) model.pilotDraft.mode = 'one';
            const deltaOptions = values => values.map(value => `<option value="${value}" ${Number(model.pilotDraft.delta1) === value ? 'selected' : ''}>${value > 0 ? `前进 ${value}` : `后退 ${Math.abs(value)}`}</option>`).join('');
            html = `<header><div><span class="mn-kicker">航线修正</span><h3>${large ? '大领航员' : '小领航员'}调度</h3></div><small>${large ? '一艘 ±2 / 两艘 ±1' : '一艘 ±1'}</small></header><p>调整会立即改变海图上的船位，不能让货船退到 0 格之前。</p>`;
            if (large) html += `<div class="mn-mode-tabs"><button type="button" data-draft-button="pilot-mode" data-value="one" class="${model.pilotDraft.mode === 'one' ? 'is-active' : ''}">移动一艘</button><button type="button" data-draft-button="pilot-mode" data-value="two" class="${model.pilotDraft.mode === 'two' ? 'is-active' : ''}">移动两艘</button></div>`;
            html += `<div class="mn-pilot-planner"><label><span>第一艘</span><select data-draft="pilot-boat1" ${canMove ? '' : 'disabled'}>${sailing.map(boat => `<option value="${boat.id}" ${String(boat.id) === model.pilotDraft.boat1 ? 'selected' : ''}>${boat.good} · ${boat.position} 格</option>`).join('')}</select><select data-draft="pilot-delta1" ${canMove ? '' : 'disabled'}>${deltaOptions(large && model.pilotDraft.mode === 'one' ? [-2, -1, 1, 2] : [-1, 1])}</select></label>`;
            if (large && model.pilotDraft.mode === 'two') html += `<label><span>第二艘</span><select data-draft="pilot-boat2" ${canMove ? '' : 'disabled'}>${sailing.map(boat => `<option value="${boat.id}" ${String(boat.id) === model.pilotDraft.boat2 ? 'selected' : ''}>${boat.good} · ${boat.position} 格</option>`).join('')}</select><select data-draft="pilot-delta2" ${canMove ? '' : 'disabled'}><option value="-1" ${Number(model.pilotDraft.delta2) === -1 ? 'selected' : ''}>后退 1</option><option value="1" ${Number(model.pilotDraft.delta2) === 1 ? 'selected' : ''}>前进 1</option></select></label>`;
            html += `</div><div class="mn-choice-row"><button class="mn-primary" type="button" data-confirm="pilot" ${canMove && (model.pilotDraft.mode !== 'two' || model.pilotDraft.boat1 !== model.pilotDraft.boat2) ? '' : 'disabled'}>确认移动方案</button><button type="button" data-choice="skipPilot" ${a.skipPilot ? '' : 'disabled'}>选择不调整</button></div>`;
            if (model.pendingChoice?.kind === 'skipPilot') html += choiceSummary('放弃本次领航调整', 'is-warning');
        } else if (state.phase === 'pirateBoard') {
            const boardable = (state.boats || []).filter(boat => boat.fate === 'sailing' && boat.position === 13); html = `<header><div><span class="mn-kicker">海盗行动</span><h3>寻找登船机会</h3></div><small>仅限 13 格</small></header><p>登船后离开海盗船；也可以留守，等待第三轮掠夺仍停在 13 格的货船。</p><div class="mn-decision-grid">${boardable.map(boat => `<button type="button" data-choice="boardPirate" data-value="${boat.id}" ${a.boardPirate ? '' : 'disabled'}><b>${boat.good}货船</b><small>${boat.position} 格 · ${boat.accomplices} 名帮手</small></button>`).join('') || '<span class="mn-muted">没有可登上的货船</span>'}</div><button class="mn-quiet-choice" type="button" data-choice="skipPirate" ${a.skipPirate ? '' : 'disabled'}>选择留在海盗船</button>`;
            if (model.pendingChoice?.kind === 'boardPirate') html += choiceSummary(`登上${escapeHtml(model.pendingChoice.good)}货船·占用第 ${model.pendingChoice.occupied + 1}/${model.pendingChoice.capacity} 席`);
            if (model.pendingChoice?.kind === 'skipPirate') html += choiceSummary('留在海盗船，等待最终掠夺', 'is-warning');
        } else if (state.phase === 'plunder') {
            html = `<header><div><span class="mn-kicker">海盗裁决</span><h3>决定货船去向</h3></div><small>货船帮手不参与分红</small></header><p>送往港口会令对应货物涨价；送往船坞则按船坞顺位结算。</p><div class="mn-decision-grid"><button type="button" data-choice="plunder" data-value="port" ${a.plunderDestination ? '' : 'disabled'}><b>送往港口</b><small>货物行情上涨</small></button><button type="button" data-choice="plunder" data-value="shipyard" ${a.plunderDestination ? '' : 'disabled'}><b>送往船坞</b><small>进入保险结算</small></button></div>`;
            if (model.pendingChoice?.kind === 'plunderDestination') { const pending = state.pendingPlunder; html += choiceSummary(`把${escapeHtml(pending?.good || '')}货船送往${model.pendingChoice.destination === 'port' ? '港口（行情 +5）' : '船坞（保险参与赔付）'}·${pending?.cargoAccomplices || 0} 名货舱帮手不分红`); }
        } else if (state.status === 'ended') html = `<div class="mn-finished"><i>终</i><div><span>航运季结束</span><strong>${escapeHtml(state.winner?.name || '商会')} 赢得马尼拉商会</strong><small>最终财富 ${state.winner?.fortune ?? '—'} 比索</small></div></div>`;
        else html = '<div class="mn-waiting"><i></i><div><strong>等待其他商人</strong><span>海图会在下一项决策开始时自动更新。</span></div></div>';
        $('command').innerHTML = html;
    }

    function renderLocations() {
        const state = current(); const groups = [{ title: '港口', subtitle: '货船到港顺位', ids: ['port-a', 'port-b', 'port-c'] }, { title: '船坞', subtitle: '未到港船只顺位', ids: ['shipyard-a', 'shipyard-b', 'shipyard-c'] }, { title: '特殊职位', subtitle: '改变航线与赔付', ids: ['pirate', 'pilot-small', 'pilot-large', 'insurance'] }];
        $('locations').innerHTML = groups.map(group => `<section class="mn-location-group"><header><strong>${group.title}</strong><small>${group.subtitle}</small></header><div>${group.ids.map(id => { const info = LOCATION_INFO[id]; const stakes = state.locations?.[id] || []; const detail = info.payout ? `投入 ${info.fee} · 回报 ${info.payout}` : id === 'insurance' ? '免费 · 先收 10' : `投入 ${info.fee}`; return `<article class="mn-location-card ${stakes.length ? 'is-occupied' : ''}" data-location-id="${escapeHtml(id)}"><div><strong>${info.label}</strong><small>${info.note || detail}</small></div><aside>${playerDots(stakes, info.capacity)}</aside></article>`; }).join('')}</div></section>`).join('');
    }

    function renderMaster() { const state = current(); const master = state.players?.find(player => player.id === state.harborMasterId); $('master').innerHTML = `<span class="mn-kicker">本次港务长</span><div style="--player:${escapeHtml(master?.color || '#d5a85e')}"><span><strong>${escapeHtml(master?.name || '等待竞价')}</strong><small>${state.auction ? `当前最高出价 ${state.auction.highestBid} 比索` : '掌管装载与起点'}</small></span></div>`; }
    function renderPlayers() { const state = current(); $('players').innerHTML = (state.players || []).map(player => { const isMe = player.id === state.myId; return `<article class="mn-player ${isMe ? 'is-me' : ''} ${player.isOnline ? '' : 'is-away'}" data-player-id="${escapeHtml(player.id)}" style="--player:${escapeHtml(player.color)}"><div><strong>${escapeHtml(player.name)}${isMe ? '<em>我</em>' : ''}</strong><small class="mn-player-assets">${isMe ? '' : shareBackFan(player.sharesCount)}<span>${player.sharesCount} 股 · ${player.encumberedShares} 抵押 · ${player.accomplices} 帮手</span></small></div><b>${player.fortune ?? player.cash}</b></article>`; }).join(''); }

    function shareCertificate(good, index, encumbered) { const state = current(); const meta = GOOD_META[good] || GOOD_META.人参; const a = actions(); const selectable = (!encumbered && a.takeLoan) || (encumbered && a.repayLoan); const selected = model.financeChoice?.index === index && model.financeChoice?.kind === (encumbered ? 'repayLoan' : 'takeLoan'); return `<button class="mn-share ${encumbered ? 'is-encumbered' : ''} ${selected ? 'is-selected' : ''}" style="--share:${meta.accent}" type="button" data-good="${meta.id}" data-finance-kind="${encumbered ? 'repayLoan' : 'takeLoan'}" data-index="${index}" ${selectable ? '' : 'disabled'}><header><span>马尼拉商会股份</span><b>${String(index + 1).padStart(2, '0')}</b></header><div><i>${meta.mark}</i><span><strong>${good}</strong><small>${meta.note}</small></span></div><footer>${encumbered ? '已抵押 · 偿还 15' : '有效凭证 · 可借 12'}</footer></button>`; }
    function renderFinance() { const state = current(); const cash = myPlayer()?.cash ?? 0; const encumbered = new Set(state.myEncumberedShares || []); const shares = (state.myShares || []).map((good, index) => shareCertificate(good, index, encumbered.has(index))).join(''); let confirmation = ''; if (model.financeChoice) { const good = state.myShares?.[model.financeChoice.index] || '该'; confirmation = `<div class="mn-finance-confirm"><span>${model.financeChoice.kind === 'takeLoan' ? `抵押${good}股份，取得 12 比索` : `支付 15 比索，赎回${good}股份`}</span><div><button type="button" data-ui="cancelFinance">取消</button><button type="button" data-ui="confirmFinance">确认</button></div></div>`; } $('finance').innerHTML = `<header class="mn-paper-title"><span>我的金库</span><b>${cash} 比索</b></header><p>点击可操作的股份，核对后确认抵押或偿还。</p><div class="mn-shares">${shares || '<span class="mn-muted">尚无股份</span>'}</div>${confirmation}`; }
    function renderLog() { const state = current(); $('log').innerHTML = (state.actionLog || []).slice().reverse().map((entry, index) => `<p class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></p>`).join('') || '<p><i></i><span>等待第一次航行。</span></p>'; }

    return { render, renderCommand, renderFinance, clearError, showError };
}
