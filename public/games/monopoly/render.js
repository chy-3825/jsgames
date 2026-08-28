import {
    BOARD_IMAGE_SIZE,
    BOARD_CENTER_SKINS,
    BOARD_RECTS,
    BOARD_TILE_COUNT,
    DICE_PIPS,
    GROUP_LABELS,
    PLAYER_TOKEN_ART,
    PLAYER_TOKEN_NAMES,
    TYPE_LABELS,
    actionMark,
    buildingMarkup,
    escapeHtml,
    firstCharacter,
    money,
    tileSymbol,
} from './constants.js';
import { displayedPosition, tokenStyleFor } from './state.js';

const esc = escapeHtml;

/** Dynamic board, command and ledger rendering for 环城大富翁. */
export function createMonopolyRenderer({ mount, model, getElement }) {
    const $ = role => getElement ? getElement(role) : mount.querySelector(`[data-role="${role}"]`);
    const root = mount.querySelector('.mono-game');
    const boardEl = $('board');
    const playersEl = $('players');
    const actionsEl = $('actions');
    const centerArtEl = $('centerArt');
    const skinMenuEl = $('skinMenu');
    const skinTriggerEl = mount.querySelector('[data-ui="toggleSkinMenu"]');
    const tokenMenuEl = $('tokenMenu');
    const tokenTriggerEl = mount.querySelector('[data-ui="toggleTokenMenu"]');
    const tokenOptionsEl = $('tokenOptions');
    const tokenStyleButtons = mount.querySelectorAll('[data-ui="selectTokenStyle"]');
    const mobileTileSelectEl = $('mobileTileSelect');
    const followPositionButtonEl = $('followPositionButton');

    function updateSkinControls() {
        const builtInSkin = model.activeSkinId === 'local' ? null : BOARD_CENTER_SKINS.find(skin => skin.id === model.activeSkinId);
        const displayName = builtInSkin?.name || (model.activeSkinId === 'local' ? '本地图片' : '维港纪念');
        $('skinLabel').textContent = displayName;
        skinTriggerEl.setAttribute('aria-label', `更换棋盘中央图片，当前为${displayName}`);
        mount.querySelectorAll('[data-ui="selectSkin"]').forEach(option => {
            const selected = option.dataset.skinId === model.activeSkinId;
            option.classList.toggle('is-selected', selected);
            option.setAttribute('aria-selected', String(selected));
        });
        const uploadButton = mount.querySelector('[data-ui="uploadSkin"]');
        const localSelected = model.activeSkinId === 'local';
        uploadButton.classList.toggle('is-selected', localSelected);
        uploadButton.setAttribute('aria-pressed', String(localSelected));
        const preview = $('localSkinPreview');
        preview.hidden = !localSelected;
        preview.parentElement.classList.toggle('has-image', localSelected);
        if (localSelected && model.localSkinObjectUrl) preview.src = model.localSkinObjectUrl;
        else preview.removeAttribute('src');
        if (centerArtEl && model.localSkinObjectUrl && localSelected) centerArtEl.src = model.localSkinObjectUrl;
    }

    function updateTokenStyleControls() {
        tokenStyleButtons.forEach(button => {
            const selected = button.dataset.tokenStyle === model.previewTokenStyle;
            button.setAttribute('aria-pressed', String(selected));
            button.classList.toggle('is-selected', selected);
        });
    }

    function updateTokenMenu() {
        updateTokenStyleControls();
        const state = model.state;
        const me = state?.players?.find(player => player.id === state.myId) || null;
        const usedBy = new Map((state?.players || [])
            .filter(player => player.id !== state?.myId && !player.isBankrupt && player.isOnline !== false && Number.isInteger(player.tokenId))
            .map(player => [player.tokenId, player]));
        const assignedToken = Number.isInteger(me?.tokenId) ? me.tokenId : null;
        const tokenLabel = assignedToken == null
            ? '开局随机分配'
            : `${PLAYER_TOKEN_NAMES[assignedToken] || '棋子'} · ${me.tokenStyle === '2d' ? '2D' : '3D'}`;
        $('tokenLabel').textContent = tokenLabel;
        tokenTriggerEl.setAttribute('aria-label', `选择棋子，当前为${tokenLabel}`);
        tokenOptionsEl.innerHTML = PLAYER_TOKEN_NAMES.map((name, tokenId) => {
            const owner = usedBy.get(tokenId);
            const selected = assignedToken === tokenId;
            const disabled = !state || state.status !== 'playing' || model.isDiceAnimating || model.isMoveAnimating || model.isRollPending || Boolean(owner);
            const status = owner ? `已被 ${esc(owner.name)} 使用` : selected ? '当前棋子' : state?.status === 'playing' ? '可选择' : '开局后可选择';
            return `<button class="mono-token-option ${selected ? 'is-selected' : ''} ${owner ? 'is-used' : ''}" data-ui="selectToken" data-token-id="${tokenId}" type="button" role="option" aria-selected="${selected}" ${disabled ? 'disabled' : ''}>
                <span class="mono-token-option-art"><img src="${PLAYER_TOKEN_ART[model.previewTokenStyle][tokenId]}" alt="" aria-hidden="true" draggable="false"></span>
                <span class="mono-token-option-copy"><strong>${esc(name)}</strong><small>${status}</small></span><i aria-hidden="true">${selected ? '✓' : owner ? '×' : ''}</i>
            </button>`;
        }).join('');
    }

    function normalizeDiceForRender(values) {
        if (!Array.isArray(values) || values.length !== 2) return null;
        const dice = values.map(value => Number(value));
        return dice.every(value => Number.isInteger(value) && value >= 1 && value <= 6) ? dice : null;
    }

    function diceMarkup(value, index, rolling = false) {
        const face = Number(value) || 0;
        if (!face) return `<span class="mono-die is-empty${rolling ? ' is-rolling' : ''}" aria-label="第${index + 1}枚骰子尚未掷出">?</span>`;
        const activePips = DICE_PIPS[face] || [];
        const pips = Array.from({ length: 9 }, (_, pipIndex) => `<i class="${activePips.includes(pipIndex) ? 'is-on' : ''}" aria-hidden="true"></i>`).join('');
        return `<span class="mono-die${rolling ? ' is-rolling' : ''}" data-value="${face}" aria-label="第${index + 1}枚骰子 ${face}">${pips}</span>`;
    }

    function renderDice(values = null, landed = false) {
        const explicitDice = normalizeDiceForRender(values);
        const stateDice = normalizeDiceForRender(model.state?.dice);
        const dice = explicitDice || stateDice || (model.isDiceAnimating ? normalizeDiceForRender(model.visibleDice) : model.idleDice);
        const isPreview = !explicitDice && !stateDice && !model.isDiceAnimating;
        const tray = $('dice');
        const rolling = model.isDiceAnimating;
        const faceKey = dice ? dice.join(',') : 'empty';
        tray.classList.toggle('is-rolling', rolling);
        tray.classList.toggle('is-preview', isPreview);
        tray.setAttribute('aria-label', rolling ? '骰子滚动中' : isPreview ? '等待掷骰，示例骰面合计七点' : dice ? `骰子 ${dice[0]} 加 ${dice[1]}` : '等待掷骰');
        if (tray.dataset.faces === faceKey && !rolling && !landed) return;
        tray.dataset.faces = faceKey;
        tray.innerHTML = dice
            ? `${diceMarkup(dice[0], 0, rolling)}${diceMarkup(dice[1], 1, rolling)}<b>= ${dice[0] + dice[1]}</b>`
            : `${diceMarkup(0, 0, rolling)}${diceMarkup(0, 1, rolling)}<b>等待掷骰</b>`;
        if (landed && dice) {
            tray.querySelectorAll('.mono-die').forEach(die => {
                die.classList.remove('has-landed');
                void die.offsetWidth;
                die.classList.add('has-landed');
            });
        }
    }

    function render() {
        const state = model.state;
        if (!state) return;
        if (model.followPlayerPosition) {
            const focusPlayer = state.players?.find(player => player.id === state.myId && !player.isBankrupt)
                || state.players?.find(player => player.id === state.currentTurn && !player.isBankrupt)
                || state.players?.find(player => !player.isBankrupt);
            if (focusPlayer) model.selectedTile = displayedPosition(model, focusPlayer);
        }
        if (!state.board?.[model.selectedTile]) model.selectedTile = 0;

        const ended = state.status === 'ended';
        const phase = phaseInfo();
        const rules = state.rules || {};
        const houses = rules.housesAvailable ?? 32;
        const hotels = rules.hotelsAvailable ?? 12;

        root.classList.toggle('is-my-turn', Boolean(state.myTurn));
        root.classList.toggle('is-ended', ended);
        root.classList.toggle('is-auction', state.phase === 'auction');
        root.classList.toggle('is-animating', model.isDiceAnimating || model.isMoveAnimating || model.isRollPending);
        $('turn').innerHTML = ended
            ? `<span class="mono-live-dot ended"></span>${esc(state.winner?.name || '本局结束')} 获胜`
            : `<span class="mono-live-dot"></span>${state.myTurn ? '你的回合' : `${esc(state.currentTurnName || '其他玩家')}的回合`}<small>第 ${state.turnNumber || 1} 回合</small>`;
        $('phase').textContent = phase.label;
        $('phaseShort').textContent = phase.short;
        $('turnNumber').textContent = String(state.turnNumber || 1).padStart(2, '0');
        $('houses').textContent = String(houses);
        $('hotels').textContent = String(hotels);
        $('boardRound').textContent = `ROUND ${String(state.turnNumber || 1).padStart(2, '0')}`;
        $('bankStatus').textContent = `${houses} 栋房屋 · ${hotels} 间酒店`;
        $('eventBadge').textContent = state.lastEvent?.title || phase.short;
        $('commandTitle').textContent = model.isDiceAnimating
            ? '骰子滚动中…'
            : model.isMoveAnimating
                ? '棋子逐格移动中…'
                : phase.title;
        $('commandHint').textContent = model.isDiceAnimating
            ? '请等待骰子停下，棋子会沿路线逐格前进。'
            : model.isMoveAnimating
                ? '请等待棋子完成这一回合的移动。'
                : phase.hint;
        $('commandState').textContent = ended ? 'CLOSED' : state.myTurn ? 'YOUR TURN' : 'WAITING';

        renderEvent();
        renderDice();
        renderTiles();
        renderPlayers();
        updateTokenMenu();
        renderActions();
        renderInspector();
        renderMobileNavigator();
        renderLog();
    }

    function phaseInfo() {
        const state = model.state;
        if (!state || state.status === 'waiting') return { short: '等待开局', label: '等待开局', title: '等待房主开始游戏', hint: '游戏开始后，第一位玩家可以掷骰子。' };
        if (state.status === 'ended') return { short: '已结束', label: '本局已结束', title: `${state.winner?.name || '本局'}赢得城市`, hint: '本局资产已经结算，棋盘保留供复盘查看。' };
        if (state.phase === 'auction') {
            const auctionName = state.auction?.tileName || '这块地产';
            return state.myTurn
                ? { short: '公开拍卖', label: '轮到你竞价', title: `竞拍 ${auctionName}`, hint: '输入高于当前最高价的整数，或选择放弃竞拍。' }
                : { short: '公开拍卖', label: `${state.currentTurnName || '其他玩家'}竞价中`, title: `等待 ${state.currentTurnName || '其他玩家'}`, hint: `${auctionName} 正在公开拍卖，当前最高价为 ${money(state.auction?.highestBid)}。` };
        }
        if (state.phase === 'property_decision') return { short: '地产决策', label: '需要决定地产归属', title: state.myTurn ? '决定这块地产' : '等待地产决定', hint: state.myTurn ? '按标价购买，或放弃购买并将它送入公开拍卖。' : '落地玩家需要先决定是否购买这块地产。' };
        if (state.phase === 'jail_decision') return { short: '拘留所', label: '处理拘留状态', title: state.myTurn ? '离开拘留所' : '等待离开拘留所', hint: state.myTurn ? '支付保释金、使用出狱卡，或尝试掷出对子。' : '当前玩家正在处理拘留状态。' };
        if (state.phase === 'turn_complete') return { short: '行动完成', label: '可以整理资产', title: state.myTurn ? '整理你的资产' : '等待结束回合', hint: state.myTurn ? '可以建造、出售建筑、抵押或赎回地产，然后结束回合。' : '当前玩家正在整理本回合资产。' };
        return state.myTurn
            ? { short: '等待掷骰', label: '轮到你行动', title: '开始你的回合', hint: '掷出两枚骰子，沿着城市路线前进。' }
            : { short: '等待掷骰', label: `${state.currentTurnName || '其他玩家'}行动中`, title: `等待 ${state.currentTurnName || '其他玩家'}`, hint: '你可以查看棋盘格和玩家资产，等待回合轮转。' };
    }

    function renderEvent() {
        const state = model.state;
        const event = state.lastEvent;
        const lastAction = state.lastAction;
        if (event) {
            $('eventCard').innerHTML = `<span class="mono-event-label">CITY EVENT</span><strong>${esc(event.title || '城市事件')}</strong><p>${esc(event.text || '')}</p>`;
            return;
        }
        $('eventCard').innerHTML = `<span class="mono-event-label">${state.status === 'ended' ? 'CITY CLOSED' : 'TABLE NOTE'}</span><strong>${esc(state.status === 'ended' ? '城市账本已封存' : lastAction?.message || '等待第一掷')}</strong><p>${esc(state.status === 'ended' ? `${state.winner?.name || '最后的玩家'} 成为城市赢家。` : lastAction?.message ? '行动结果已记录在右侧账本。' : '掷出骰子，开始你的城市路线。')}</p>`;
    }

    function renderTiles() {
        const state = model.state;
        boardEl.querySelectorAll('.mono-tile').forEach(tileEl => {
            const tile = state.board[Number(tileEl.dataset.index)];
            if (!tile) return;
            const occupant = state.players.filter(player => displayedPosition(model, player) === tile.index && !player.isBankrupt);
            const owner = tile.ownerId ? state.players.find(player => player.id === tile.ownerId) : null;
            const kind = tile.type === 'property' ? (tile.group === 'transit' ? 'transit' : tile.group === 'utility' ? 'utility' : 'property') : tile.type;
            const visibleOccupants = occupant.slice(0, 2);
            const tokens = visibleOccupants.map(player => `<i class="mono-token-piece ${player.id === state.currentTurn ? 'is-current' : ''} ${model.movementAnimation?.playerId === player.id && model.isMoveAnimating ? 'is-moving' : ''}" style="--token:${esc(player.color)}" title="${esc(player.name)}"><img src="${tokenArt(state, player)}" alt="" aria-hidden="true" draggable="false"></i>`).join('');
            const tokenOverflow = occupant.length > visibleOccupants.length
                ? `<b class="mono-token-more" title="${esc(occupant.slice(visibleOccupants.length).map(player => player.name).join('、'))}">+${occupant.length - visibleOccupants.length}</b>`
                : '';
            const ownerMark = owner ? `<span class="mono-owner-mark" style="--token:${esc(owner.color)}" title="${esc(owner.name)}">${esc(firstCharacter(owner.name))}</span>` : '';
            const propertyBody = tile.type === 'property'
                ? `<span class="mono-tile-price">${money(tile.price)}</span><span class="mono-buildings">${buildingMarkup(tile)}</span>`
                : `<strong class="mono-tile-symbol">${tileSymbol(tile.type)}</strong><span class="mono-tile-type">${esc(TYPE_LABELS[tile.type] || '城市格')}</span>`;
            tileEl.className = `mono-tile mono-type-${kind} ${model.selectedTile === tile.index ? 'is-inspected' : ''} ${tile.ownerId ? 'is-owned' : ''} ${tile.mortgaged ? 'is-mortgaged' : ''} ${occupant.length ? 'has-player' : ''}`;
            tileEl.setAttribute('aria-label', `${tile.name}${tile.ownerName ? `，归 ${tile.ownerName} 所有` : ''}`);
            tileEl.setAttribute('aria-current', model.selectedTile === tile.index ? 'location' : 'false');
            tileEl.innerHTML = `<span class="mono-tile-band" style="--tile-color:${esc(tile.color || '#8f9a8d')}"></span><span class="mono-tile-name">${esc(tile.name)}</span>${propertyBody}${ownerMark}<span class="mono-tokens">${tokens}${tokenOverflow}</span>`;
        });
    }

    function renderPlayers() {
        const state = model.state;
        playersEl.innerHTML = (state.players || []).map((player, index) => {
            const current = player.isCurrentTurn || player.id === state.currentTurn;
            const status = player.isBankrupt ? '已破产' : model.movementAnimation?.playerId === player.id && model.isMoveAnimating ? '逐格移动中' : player.inJail ? `拘留所 · 第 ${player.jailTurns || 0} 次` : current ? '正在行动' : `${player.position} 号格`;
            return `<article class="mono-player ${current ? 'is-current' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''}">
                <span class="mono-player-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="mono-avatar" style="--token:${esc(player.color)}" title="${esc(player.name)}"><img src="${tokenArt(state, player)}" alt="" aria-hidden="true" draggable="false"></span>
                <div class="mono-player-copy"><strong>${esc(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><small>${esc(status)}</small><span>${player.propertyCount || 0} 处地产 · ${player.jailCardCount || 0} 张出狱卡</span></div>
                <div class="mono-player-cash"><small>现金</small><b>${money(player.cash)}</b></div>
            </article>`;
        }).join('') || '<div class="mono-empty">等待玩家入座</div>';
    }

    function tokenArt(state, player) {
        const playerIndex = (state?.players || []).findIndex(candidate => candidate.id === player?.id);
        const tokenStyle = tokenStyleFor(player);
        const tokenSet = PLAYER_TOKEN_ART[tokenStyle];
        const tokenIndex = Number.isInteger(player?.tokenId) ? player.tokenId : playerIndex >= 0 ? playerIndex % tokenSet.length : 0;
        return tokenSet[tokenIndex];
    }

    function renderActions() {
        const state = model.state;
        const available = state.availableActions || {};
        const locked = model.isDiceAnimating || model.isMoveAnimating || model.isRollPending;
        if (locked) {
            actionsEl.innerHTML = `<div class="mono-waiting-note"><span class="mono-action-mark" aria-hidden="true">${model.isDiceAnimating ? '⚄' : '·'}</span><div><strong>${model.isDiceAnimating ? '骰子滚动中' : '棋子逐格移动中'}</strong><small>动画完成后再继续操作。</small></div></div>`;
            return;
        }
        if (state.phase === 'auction') {
            const auction = state.auction || {};
            const passedNames = (auction.passed || []).map(id => state.players.find(player => player.id === id)?.name).filter(Boolean).join('、');
            actionsEl.innerHTML = `<div class="mono-auction-card">
                <div class="mono-auction-copy"><span class="mono-kicker">PUBLIC AUCTION</span><h3>${esc(auction.tileName || '地产')}</h3><p>最高出价 <b>${money(auction.highestBid)}</b> · ${esc(auction.currentBidderName || '等待玩家')} 行动</p>${passedNames ? `<small>已放弃：${esc(passedNames)}</small>` : ''}</div>
                <label class="mono-bid-field"><span>你的出价</span><input data-auction-amount type="number" inputmode="numeric" min="${available.auctionMinBid || 1}" placeholder="至少 ${available.auctionMinBid || 1}" ${available.canAuctionBid && !locked ? '' : 'disabled'}></label>
                <div class="mono-auction-actions"><button class="mono-action-primary" data-action="bidProperty" type="button" ${available.canAuctionBid && !locked ? '' : 'disabled'}>出价 <small>确认金额</small></button><button class="mono-action-quiet" data-action="passAuction" type="button" ${available.canAuctionPass && !locked ? '' : 'disabled'}>放弃竞拍</button></div>
            </div>`;
            return;
        }

        const pendingTile = state.board?.[state.pendingPurchase?.tileIndex];
        const buttons = [
            actionButton('rollDice', '掷骰子', state.dice ? state.dice.join(' + ') : '两枚骰子', available.canRoll, 'mono-action-primary'),
            actionButton('buyProperty', '购买地产', pendingTile ? `${pendingTile.name} · ${money(pendingTile.price)}` : '等待可购买地产', available.canBuy),
            actionButton('passProperty', '进入拍卖', pendingTile ? `放弃 ${pendingTile.name}` : '放弃当前地产', available.canPass),
            actionButton('payBail', '支付保释', '¥50 离开拘留所', available.canPayBail),
            actionButton('rollForDoubles', '掷对子离开', '最多尝试三次', available.canRollForDoubles),
            actionButton('useJailCard', '使用出狱卡', '免费离开拘留所', available.canUseJailCard),
            actionButton('endTurn', '结束回合', state.extraTurn ? '保留额外回合' : '轮到下一位玩家', available.canEndTurn, 'mono-action-quiet'),
        ];
        const management = [
            ...(available.buildableTiles || []).map(index => tileAction('buildHouse', '建造', state.board[index], `¥${state.board[index]?.buildCost || 0}`)),
            ...(available.sellableTiles || []).map(index => tileAction('sellBuilding', '出售建筑', state.board[index], `收回 ¥${Math.floor((state.board[index]?.buildCost || 0) / 2)}`)),
            ...(available.mortgageableTiles || []).map(index => tileAction('mortgageProperty', '抵押', state.board[index], money(state.board[index]?.mortgageValue))),
            ...(available.unmortgageableTiles || []).map(index => tileAction('unmortgageProperty', '赎回', state.board[index], `支付 ${money(Math.ceil((state.board[index]?.price || 0) * .55))}`)),
        ];
        const hasTurnAction = ['canRoll', 'canBuy', 'canPass', 'canPayBail', 'canRollForDoubles', 'canUseJailCard', 'canEndTurn'].some(key => available[key]);
        if (!hasTurnAction && !management.length) {
            actionsEl.innerHTML = `<div class="mono-waiting-note"><span class="mono-action-mark" aria-hidden="true">…</span><div><strong>${state.status === 'ended' ? '本局已经结束' : '等待当前玩家完成行动'}</strong><small>${state.status === 'ended' ? '仍可点击棋盘格复盘地产状态。' : '轮到你时，合法操作会自动出现在这里。'}</small></div></div>`;
            return;
        }
        actionsEl.innerHTML = `<div class="mono-action-group"><span class="mono-action-group-label">回合动作</span><div class="mono-action-grid">${buttons.join('')}</div></div>${management.length ? `<div class="mono-action-group mono-management"><span class="mono-action-group-label">资产整理</span><div class="mono-action-grid">${management.join('')}</div></div>` : ''}`;
    }

    function canSubmitAction(enabled) {
        return Boolean(enabled && !model.isDiceAnimating && !model.isMoveAnimating && !model.isRollPending);
    }

    function actionButton(kind, label, detail, enabled, className = '') {
        return `<button class="mono-action ${className}" data-action="${kind}" type="button" ${canSubmitAction(enabled) ? '' : 'disabled'}><span class="mono-action-mark" aria-hidden="true">${actionMark(kind)}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`;
    }

    function tileAction(kind, label, tile, detail) {
        if (!tile) return '';
        const selected = model.selectedTile === tile.index ? ' is-highlighted' : '';
        return `<button class="mono-action mono-action-asset${selected}" data-action="${kind}" data-tile-index="${tile.index}" type="button" ${canSubmitAction(true) ? '' : 'disabled'}><span class="mono-action-mark" aria-hidden="true">${kind === 'buildHouse' ? '＋' : kind === 'sellBuilding' ? '−' : kind === 'mortgageProperty' ? '↘' : '↗'}</span><span><strong>${esc(label)} · ${esc(tile.name)}</strong><small>${esc(detail)}</small></span></button>`;
    }

    function renderInspector() {
        const state = model.state;
        const tile = state.board?.[model.selectedTile];
        if (!tile) return;
        const owner = tile.ownerName ? `归 ${tile.ownerName} 所有` : tile.type === 'property' ? '尚未出售' : '公共功能格';
        const isProperty = tile.type === 'property';
        const rent = isProperty ? (tile.currentRent || tile.rents?.[0] || 0) : 0;
        const typeLabel = isProperty ? (GROUP_LABELS[tile.group] || '地产') : (TYPE_LABELS[tile.type] || '城市格');
        const status = tile.mortgaged ? '已抵押 · 暂不收租' : tile.houses >= 5 ? '酒店' : isProperty && tile.houses ? `${tile.houses} 栋房屋` : '无建筑';
        $('inspector').innerHTML = `<div class="mono-inspector-content"><div class="mono-inspector-heading"><div><span class="mono-kicker">TILE ${String(tile.index).padStart(2, '0')} · ${esc(typeLabel)}</span><h2>${esc(tile.name)}</h2></div><span class="mono-inspector-owner">${esc(owner)}</span></div>${isProperty ? `<div class="mono-deed-strip" style="--tile-color:${esc(tile.color || '#8f9a8d')}"><span></span><strong>${esc(typeLabel)}</strong><small>${tile.mortgaged ? '抵押中' : '城市地产'}</small></div><div class="mono-inspector-stats"><div><small>标价</small><b>${money(tile.price)}</b></div><div><small>当前租金</small><b>${money(rent)}</b></div><div><small>状态</small><b>${esc(status)}</b></div></div><p class="mono-inspector-note">${tile.houses >= 5 ? '酒店已建成，租金按酒店档位结算。' : tile.houses ? '建筑会提升这块地产的租金。' : tile.group === 'transit' ? '拥有更多车站会提高租金。' : tile.group === 'utility' ? '租金根据最近一次骰子总点数计算。' : '点击棋盘格或操作区，继续管理这块地产。'}</p>` : `<div class="mono-special-tile"><strong>${tileSymbol(tile.type)}</strong><div><b>${esc(typeLabel)}</b><small>落点结果会显示在行动记录和城市事件中。</small></div></div>`}</div>`;
    }

    function renderMobileNavigator() {
        const state = model.state;
        const tile = state.board?.[model.selectedTile];
        if (!tile) return;
        const isProperty = tile.type === 'property';
        const typeLabel = isProperty ? (GROUP_LABELS[tile.group] || '地产') : (TYPE_LABELS[tile.type] || '城市格');
        const owner = tile.ownerName ? `归 ${tile.ownerName} 所有` : isProperty ? '尚未出售' : '公共功能格';
        const rent = isProperty ? (tile.currentRent || tile.rents?.[0] || 0) : 0;
        const status = tile.mortgaged ? '已抵押' : tile.houses >= 5 ? '酒店' : tile.houses ? `${tile.houses} 栋房屋` : '无建筑';
        const occupants = (state.players || []).filter(player => displayedPosition(model, player) === tile.index && !player.isBankrupt);
        const occupantText = occupants.length ? `停留：${occupants.map(player => player.name).join('、')}` : '当前没有玩家停留';
        const specialValue = tile.type === 'tax' ? money(tile.amount) : tile.type === 'start' ? '+¥200' : '落点触发';

        $('mobileInspector').innerHTML = `<header><div><span>第 ${String(tile.index).padStart(2, '0')} 站 · ${esc(typeLabel)}</span><strong>${esc(tile.name)}</strong></div><small>${esc(owner)}</small></header><div class="mono-mobile-place-stats">${isProperty ? `<div><small>标价</small><b>${money(tile.price)}</b></div><div><small>当前租金</small><b>${money(rent)}</b></div><div><small>建筑</small><b>${esc(status)}</b></div>` : `<div><small>类型</small><b>${esc(typeLabel)}</b></div><div><small>落点</small><b>${esc(specialValue)}</b></div><div><small>位置</small><b>${tile.index} / ${BOARD_TILE_COUNT - 1}</b></div>`}</div><p>${esc(occupantText)}</p>`;

        const signature = (state.board || []).map(boardTile => `${boardTile.index}:${boardTile.name}`).join('|');
        if (signature !== model.mobileBoardSignature) {
            model.mobileBoardSignature = signature;
            mobileTileSelectEl.innerHTML = (state.board || []).map(boardTile => `<option value="${boardTile.index}">${String(boardTile.index).padStart(2, '0')} · ${esc(boardTile.name)}</option>`).join('');
        }
        mobileTileSelectEl.value = String(tile.index);
        followPositionButtonEl.setAttribute('aria-pressed', String(model.followPlayerPosition));
        followPositionButtonEl.classList.toggle('is-active', model.followPlayerPosition);
    }

    function renderLog() {
        const state = model.state;
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="mono-log-entry ${index === 0 ? 'is-latest' : ''}"><i aria-hidden="true"></i><span>${esc(entry)}</span></div>`).join('') : '<p class="mono-log-empty">第一项行动完成后，记录会出现在这里。</p>';
    }

    function buildBoard() {
        const percent = value => `${(value / BOARD_IMAGE_SIZE * 100).toFixed(6)}%`;
        const cells = BOARD_RECTS.map((rect, index) => `<button class="mono-tile" data-index="${index}" data-edge="${rect.edge}" style="left:${percent(rect.x)};top:${percent(rect.y)};width:${percent(rect.width)};height:${percent(rect.height)}" type="button"></button>`).join('');
        boardEl.insertAdjacentHTML('afterbegin', cells);
    }

    buildBoard();
    return { render, renderDice, buildBoard, updateSkinControls, updateTokenMenu };
}
