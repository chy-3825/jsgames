import { TERRAIN_ORDER } from './constants.js';
import { castleMarkup, dominoFaceMarkup, escapeHtml, terrainArt, terrainMeta, crownMarkup } from './cards.js';
import { analyzeGrid, cellKey, claimForTile, hasLegalPlacement, legalAnchors, legalPartners, me, placementOrientation, safeColor, turnCopy } from './state.js';

/** Dynamic draft, board and score rendering for 多米诺王国. */
export function createKingdominoRenderer({ mount, model, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const currentState = () => model.state;

    function render() {
        const state = currentState();
        if (!state) return;
        const currentTileId = state.availableActions?.canPlace ? state.mySelectedTile?.id || null : null;
        if (currentTileId !== model.placementTileId) { model.placementCells = []; model.placementTileId = currentTileId; }
        const analysis = analyzeGrid(state.myGrid || {});
        const app = mount.querySelector('.kd-app');
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-my-turn', Boolean(state.availableActions?.canSelect || state.availableActions?.canPlace));
        app.classList.toggle('is-ended', state.status === 'ended');
        app.classList.toggle('is-duel-board', Number(state.boardSize) === 7);
        $('turn').innerHTML = `<span class="kd-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(turnCopy(state))}`;
        $('headerScore').textContent = analysis.score;
        $('headerRound').textContent = state.round || '—';
        $('headerRounds').textContent = `/ ${state.maxRounds || '—'}`;
        $('deckCount').textContent = Number(state.remainingTileCount) || 0;
        $('supply').setAttribute('aria-label', `未揭示领地牌堆，剩余 ${Number(state.remainingTileCount) || 0} 块`);
        $('roundProgress').style.width = `${Math.min(100, Math.max(0, (Number(state.round) || 0) / (Number(state.maxRounds) || 1) * 100))}%`;
        $('territoryCount').textContent = analysis.occupied;
        $('crownCount').textContent = analysis.crowns;
        $('boardScore').textContent = analysis.score;
        $('boardSize').textContent = `${state.boardSize || 5} × ${state.boardSize || 5}`;
        renderCommand(); renderDraft(); renderBoard(); renderTerrainLedger(analysis); renderPlayers(); renderLog();
    }

    function renderDraft() {
        const state = currentState();
        const draft = state.draft || [];
        if (!draft.some(tile => tile.id === model.pendingDominoId && !claimForTile(state, tile))) model.pendingDominoId = null;
        const selectedCount = draft.filter(tile => claimForTile(state, tile)).length;
        $('draftNote').textContent = state.availableActions?.canSelect ? `轮到你 · ${selectedCount}/${state.draftSize || draft.length} 已选` : `${selectedCount}/${state.draftSize || draft.length} 已选`;
        $('draft').innerHTML = draft.length ? draft.map(tile => {
            const claim = claimForTile(state, tile);
            const canSelect = Boolean(state.availableActions?.canSelect && !claim && !model.actionPending);
            const isPending = canSelect && model.pendingDominoId === tile.id;
            const playerColor = safeColor(claim?.color);
            return `<button class="kd-domino-card ${claim ? 'is-claimed' : ''} ${canSelect ? 'is-selectable' : ''} ${isPending ? 'is-pending' : ''}" data-domino-id="${escapeHtml(tile.id)}" type="button" aria-disabled="${!canSelect}" ${canSelect ? '' : 'data-read-only="true"'} aria-pressed="${isPending}" aria-label="${claim ? `${escapeHtml(claim.playerName)}已选择` : isPending ? '取消选择' : '查看'}第 ${tile.number} 号多米诺">${dominoFaceMarkup(tile)}${claim ? `<span class="kd-domino-claim" style="--player-color:${playerColor}"><i>${escapeHtml(String(claim.playerName || '?').slice(0, 1))}</i><b>${escapeHtml(claim.playerName || '已占用')}</b><small>${Number(claim.token) > 0 ? `王冠 ${Number(claim.token) + 1}` : '已选择'}</small></span>` : `<span class="kd-domino-open">${isPending ? '已预选' : '可选择'}</span>`}</button>`;
        }).join('') : '<div class="kd-empty-state"><span>♛</span><strong>本轮领地已结算</strong></div>';
        const pendingTile = draft.find(tile => tile.id === model.pendingDominoId);
        const confirm = $('draftConfirm');
        confirm.classList.toggle('is-hidden', !pendingTile || !state.availableActions?.canSelect);
        confirm.innerHTML = pendingTile ? `<span><small>准备锁定</small><strong>第 ${String(Number(pendingTile.number) || 0).padStart(2, '0')} 号领地</strong></span><button data-action="confirmDomino" type="button" ${model.actionPending ? 'disabled' : ''}>确认选择</button>` : '';
    }

    function renderCommand() {
        const state = currentState();
        const tile = state.mySelectedTile;
        const command = $('command');
        if (state.status === 'ended') {
            const ranking = [...(state.players || [])].filter(player => player.isOnline !== false).sort((a, b) => b.score - a.score);
            const ownRank = ranking.findIndex(player => player.id === state.myId) + 1;
            command.className = 'kd-command is-ended';
            command.innerHTML = `<header><small>最终疆域</small><h2>王国结算</h2></header><div class="kd-result-crown">♛</div><div class="kd-result-score"><strong>${state.winner?.score ?? ranking[0]?.score ?? 0}</strong><span>最终分</span></div><p>${escapeHtml(state.winner?.name || '王国建设完成')}</p><b>${ownRank ? `你的席位 · 第 ${ownRank} 名` : '本局已经结束'}</b>`;
            return;
        }
        if (state.availableActions?.canSelect) {
            const tokenNumber = Number(state.currentToken?.token) + 1;
            command.className = 'kd-command is-selecting';
            command.innerHTML = `<header><small>你的选择</small><h2>选择下一块领地</h2></header><div class="kd-command-mark"><span>01</span><div><strong>从本轮公开牌中选择</strong><small>${tokenNumber > 1 ? `这是你的第 ${tokenNumber} 枚王冠` : '较低编号会优先摆放'}</small></div></div><div class="kd-order-scale"><span>先行动</span><i></i><span>高价值领地</span></div><p>选择后将锁定，等待所有国王完成选牌。</p>`;
            return;
        }
        if (state.availableActions?.canPlace && tile) {
            const orientation = placementOrientation(state, tile, model.placementCells);
            const legal = hasLegalPlacement(state, tile);
            const step = model.placementCells.length === 0 ? '选择第一格' : model.placementCells.length === 1 ? '选择高亮的相邻格' : orientation ? '位置有效，可以确认' : '这组位置无法连接';
            command.className = 'kd-command is-placing';
            command.innerHTML = `<header><small>摆放领地</small><h2>扩建你的王国</h2></header><div class="kd-current-domino">${dominoFaceMarkup(tile)}<span>本轮多米诺</span></div><div class="kd-placement-status ${orientation ? 'is-ready' : ''}"><span>${model.placementCells.length}<small>/2</small></span><div><strong>${step}</strong><small>${orientation ? `${orientation.terrains[0]} · ${orientation.terrains[1]}` : legal ? '棋盘仅显示合法起点与相邻位置' : '王国中已没有合法位置'}</small></div></div><div class="kd-placement-controls"><button class="kd-icon-action" data-action="swap" type="button" title="交换两格方向" aria-label="交换两格方向" ${orientation && !model.actionPending ? '' : 'disabled'}>↔</button><button class="kd-icon-action" data-action="clear" type="button" title="清除摆放选择" aria-label="清除摆放选择" ${model.placementCells.length && !model.actionPending ? '' : 'disabled'}>×</button><button class="kd-primary-action" data-action="place" type="button" ${orientation && !model.actionPending ? '' : 'disabled'}>确认摆放</button></div><button class="kd-discard-action" data-action="discard" type="button" ${!legal && !model.actionPending ? '' : 'disabled'} title="${legal ? '仍有合法摆放位置，不能弃置' : '弃置无法放入王国的多米诺'}">无法摆放，弃置此牌</button>`;
            return;
        }
        const ownSelections = state.mySelectedTiles || [];
        const waitingFor = state.phase === 'placing' ? '等待摆放顺序' : '等待其他国王选择';
        const selectedTiles = ownSelections.length ? ownSelections.map(entry => `<span>#${String(entry.tile?.number || 0).padStart(2, '0')}</span>`).join('') : '<span>尚未锁定领地</span>';
        command.className = 'kd-command is-waiting';
        command.innerHTML = `<header><small>牌局状态</small><h2>${waitingFor}</h2></header><div class="kd-waiting-player"><span style="--player-color:${safeColor((state.players || []).find(player => player.id === state.currentTurn)?.color)}">${escapeHtml(String(state.currentTurnName || '王').slice(0, 1))}</span><div><strong>${escapeHtml(state.currentTurnName || '下一位国王')}</strong><small>${state.phase === 'placing' ? '正在扩建王国' : '正在选择领地'}</small></div></div><div class="kd-locked-tiles"><small>我的本轮领地</small><div>${selectedTiles}</div></div><p>${escapeHtml(state.lastAction?.message || '王冠顺序会自动推进。')}</p>`;
    }

    function renderBoard() {
        const state = currentState();
        const board = $('board'); const grid = state.myGrid || {}; const size = Number(state.boardSize) || 5; const tile = state.mySelectedTile;
        const canPlace = Boolean(state.availableActions?.canPlace && tile && !model.actionPending);
        const anchors = canPlace ? legalAnchors(state, tile) : new Set();
        const partners = canPlace && model.placementCells.length === 1 ? new Set(legalPartners(state, tile, model.placementCells[0]).map(cellKey)) : new Set();
        const orientation = placementOrientation(state, tile, model.placementCells);
        board.style.setProperty('--kd-size', size); board.setAttribute('aria-label', `我的 ${size} 乘 ${size} 王国棋盘`);
        $('boardHint').textContent = state.status === 'ended' ? '最终疆域' : !canPlace ? '王国以城堡为中心' : model.placementCells.length === 0 ? `${anchors.size} 个合法起点` : model.placementCells.length === 1 ? `${partners.size} 个相邻位置` : orientation ? '摆放预览已就绪' : '重新选择位置';
        board.innerHTML = Array.from({ length: size * size }, (_, index) => {
            const x = index % size; const y = Math.floor(index / size); const key = `${x},${y}`; const existing = grid[key]; const selectedIndex = model.placementCells.findIndex(cell => cell.x === x && cell.y === y);
            const preview = selectedIndex >= 0 && orientation ? { terrain: orientation.terrains[selectedIndex], crowns: orientation.crowns[selectedIndex] } : null;
            const shown = existing || preview; const meta = shown ? terrainMeta(shown.terrain) : null; const isAnchor = selectedIndex === 0; const isSelected = selectedIndex >= 0; const isCandidate = partners.has(key); const isPlaceable = anchors.has(key); const interactive = canPlace && !existing && (isSelected || isCandidate || isPlaceable);
            const classes = ['kd-cell', shown ? `terrain-${meta.key}` : 'is-empty', preview ? 'is-preview' : '', isAnchor ? 'is-anchor' : '', isSelected ? 'is-selected' : '', isCandidate ? 'is-candidate' : '', !model.placementCells.length && isPlaceable ? 'is-placeable' : ''].filter(Boolean).join(' ');
            const label = shown ? `${shown.terrain}${shown.crowns ? `，${shown.crowns} 顶王冠` : ''}` : isCandidate ? '合法的第二格' : isPlaceable ? '合法起点' : '空格';
            const visual = shown?.terrain === '城堡' ? castleMarkup() : shown ? `<img src="${terrainArt(shown.terrain, `${shown.dominoId || tile?.id || 'cell'}:${key}`)}" alt="" aria-hidden="true"><span class="kd-cell-shade" aria-hidden="true"></span>` : '';
            return `<button class="${classes}" data-cell="${key}" type="button" ${interactive ? '' : 'disabled'} aria-pressed="${isSelected}" aria-label="第 ${y + 1} 行第 ${x + 1} 列，${label}">${shown ? `${visual}<span class="kd-cell-label">${escapeHtml(shown.terrain)}</span>${crownMarkup(shown.crowns, 'kd-cell-crowns')}` : `<span class="kd-empty-mark">${isCandidate ? '2' : isPlaceable ? '＋' : ''}</span>`}</button>`;
        }).join('');
    }

    function renderTerrainLedger(analysis) {
        $('terrainLedger').innerHTML = TERRAIN_ORDER.map(terrain => { const meta = terrainMeta(terrain); const item = analysis.terrains[terrain]; return `<article class="terrain-${meta.key} ${item.cells ? 'has-land' : ''}"><span><img src="${terrainArt(terrain, `ledger:${terrain}`)}" alt="" aria-hidden="true"></span><div><strong>${terrain}</strong><small>${item.cells} 格 · ${item.crowns} 冠</small></div><b>${item.points}</b></article>`; }).join('');
    }

    function renderPlayers() {
        const state = currentState(); const claims = (state.draft || []).filter(tile => claimForTile(state, tile));
        $('players').innerHTML = (state.players || []).map((player, index) => {
            const selectedNumbers = claims.filter(tile => claimForTile(state, tile)?.playerId === player.id).map(tile => tile.number);
            const status = player.isOnline === false ? '离线' : player.isCurrentTurn ? state.phase === 'placing' ? '正在摆放' : '正在选择' : selectedNumbers.length ? `已选 ${selectedNumbers.map(number => `#${number}`).join(' · ')}` : `${player.placedCount || 0} 块多米诺`;
            return `<article class="kd-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}" style="--player-color:${safeColor(player.color)}"><span class="kd-player-order">${String(index + 1).padStart(2, '0')}</span><span class="kd-avatar">${escapeHtml(String(player.name || '?').slice(0, 1))}</span><span class="kd-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${escapeHtml(status)}</small></span><b>${player.score || 0}<small>分</small></b></article>`;
        }).join('');
    }

    function renderLog() {
        const state = currentState(); const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('') : '<p>王国开始建设后，行动会记录在这里。</p>';
    }

    return { render, renderDraft, renderCommand, renderBoard };
}
