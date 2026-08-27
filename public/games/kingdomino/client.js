const TERRAIN_ORDER = ['麦田', '森林', '海洋', '草地', '沼泽', '矿山'];
const TERRAIN_META = {
    麦田: { key: 'wheat', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/wheat-${index}.jpg`) },
    森林: { key: 'forest', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/forest-${index}.jpg`) },
    海洋: { key: 'sea', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/sea-${index}.jpg`) },
    草地: { key: 'meadow', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/meadow-${index}.jpg`) },
    沼泽: { key: 'swamp', arts: [1, 2, 3, 4].map(index => `/assets/bgg/kingdomino/swamp-${index}.jpg`) },
    矿山: { key: 'mine', arts: [1, 2, 3].map(index => `/assets/bgg/kingdomino/mine-${index}.jpg`) },
    城堡: { key: 'castle', arts: [] },
};
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const cellKey = cell => `${cell.x},${cell.y}`;
const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#7f8a83';

function terrainMeta(terrain) {
    return TERRAIN_META[terrain] || TERRAIN_META.草地;
}

function seedHash(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function terrainArt(terrain, seed = '') {
    const arts = terrainMeta(terrain).arts;
    return arts.length ? arts[seedHash(`${terrain}:${seed}`) % arts.length] : '';
}

function castleMarkup(extraClass = '') {
    return `<span class="kd-castle-art ${extraClass}" aria-hidden="true"><i></i><i></i><i></i><b></b></span>`;
}

function rulesKingdomMarkup() {
    const cells = [
        ['森林', '森林', '草地', '海洋', '海洋'],
        ['森林', '草地', '草地', '海洋', '沼泽'],
        ['麦田', '草地', '城堡', '沼泽', '沼泽'],
        ['麦田', '麦田', '草地', '矿山', '沼泽'],
        ['麦田', '矿山', '矿山', '矿山', '草地'],
    ];
    const crowns = new Map([['0,0', 1], ['4,0', 1], ['2,1', 1], ['4,2', 1], ['0,3', 1], ['1,4', 2]]);
    return `<div class="kd-rules-board" aria-label="五乘五王国计分示例">${cells.flatMap((row, y) => row.map((terrain, x) => {
        const meta = terrainMeta(terrain);
        const count = crowns.get(`${x},${y}`) || 0;
        const visual = terrain === '城堡'
            ? castleMarkup('is-rule-castle')
            : `<img src="${terrainArt(terrain, `rules:${x}:${y}`)}" alt="" aria-hidden="true"><span class="kd-rule-shade" aria-hidden="true"></span>`;
        return `<span class="kd-rule-cell terrain-${meta.key}" title="${terrain}">${visual}${count ? `<b class="kd-rule-crown">${'♛'.repeat(count)}</b>` : ''}</span>`;
    })).join('')}</div><div class="kd-rules-art-caption"><span>地形相连</span><i></i><span>领地 × 王冠</span><strong>5 × 5</strong></div>`;
}

function adjacentCells(cell) {
    return DIRECTIONS.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }));
}

function analyzeGrid(grid = {}) {
    const visited = new Set();
    const terrains = Object.fromEntries(TERRAIN_ORDER.map(terrain => [terrain, { cells: 0, crowns: 0, points: 0, regions: 0 }]));
    let score = 0;
    let occupied = 0;
    let crowns = 0;

    for (const [key, cell] of Object.entries(grid)) {
        if (cell?.terrain === '城堡') continue;
        occupied += 1;
        crowns += Number(cell?.crowns) || 0;
        if (!cell?.terrain || visited.has(key)) continue;

        const queue = [key];
        visited.add(key);
        let regionSize = 0;
        let regionCrowns = 0;
        while (queue.length) {
            const currentKey = queue.shift();
            const current = grid[currentKey];
            regionSize += 1;
            regionCrowns += Number(current?.crowns) || 0;
            const [x, y] = currentKey.split(',').map(Number);
            for (const next of adjacentCells({ x, y })) {
                const nextKey = cellKey(next);
                if (!visited.has(nextKey) && grid[nextKey]?.terrain === current.terrain) {
                    visited.add(nextKey);
                    queue.push(nextKey);
                }
            }
        }

        const points = regionSize * regionCrowns;
        const summary = terrains[cell.terrain];
        if (summary) {
            summary.cells += regionSize;
            summary.crowns += regionCrowns;
            summary.points += points;
            summary.regions += 1;
        }
        score += points;
    }

    return { terrains, score, occupied, crowns };
}

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/kingdomino/style.css?v=20260826-mobile-shell-1';
    document.head.appendChild(style);
    document.body.classList.add('is-kingdomino-view');

    let state = null;
    let placementCells = [];
    let placementTileId = null;
    let pendingDominoId = null;
    let actionPending = false;
    let rulesTrigger = null;
    let lastPresentationSequence = 0;
    let presentationPlaying = false;
    let presentationQueue = [];
    let presentationToken = 0;
    const presentationWaiters = new Set();
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    mount.innerHTML = `<section class="kd-app">
        <header class="kd-header">
            <div class="kd-brand">
                <span class="kd-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <div><small>王冠领地拼图</small><h1>多米诺王国</h1></div>
            </div>
            <div class="kd-turn" data-role="turn" aria-live="polite"><span class="kd-live-dot"></span>等待王国状态</div>
            <div class="kd-header-stats">
                <span><small>得分</small><strong data-role="headerScore">0</strong><i>分</i></span>
                <span><small>轮次</small><strong data-role="headerRound">—</strong><i data-role="headerRounds">/ —</i></span>
            </div>
            <div class="kd-header-actions">
                <button class="kd-icon-button" data-ui="rules" type="button" title="查看游戏规则" aria-label="查看游戏规则">?</button>

            </div>
            <div class="kd-round-track" aria-hidden="true"><i data-role="roundProgress"></i></div>
        </header>

        <main class="kd-layout">
            <aside class="kd-command-column">
                <section class="kd-command" data-role="command"></section>
                <section class="kd-draft-section">
                    <header class="kd-section-header">
                        <div><small>领地选取</small><h2>本轮领地</h2></div>
                        <div class="kd-supply" data-role="supply" aria-label="未揭示领地牌堆">
                            <span class="kd-back-stack" aria-hidden="true"><i></i><b>♛</b></span>
                            <span><small>未揭示</small><strong><b data-role="deckCount">0</b> 块</strong></span>
                        </div>
                    </header>
                    <div class="kd-draft-note" data-role="draftNote">等待翻牌</div>
                    <div class="kd-draft" data-role="draft"></div>
                    <div class="kd-draft-confirm is-hidden" data-role="draftConfirm"></div>
                </section>
            </aside>

            <section class="kd-kingdom-stage">
                <header class="kd-section-header kd-board-header">
                    <div><small>我的疆域</small><h2>我的王国</h2></div>
                    <div class="kd-board-summary">
                        <span><b data-role="territoryCount">0</b><small>领地格</small></span>
                        <span><b data-role="crownCount">0</b><small>顶王冠</small></span>
                        <span class="is-score"><b data-role="boardScore">0</b><small>当前分</small></span>
                    </div>
                </header>
                <div class="kd-board-copy"><span data-role="boardHint">王国以城堡为中心</span><small data-role="boardSize">5 × 5</small></div>
                <div class="kd-board-frame">
                    <div class="kd-board" data-role="board" aria-label="我的王国棋盘"></div>
                </div>
                <div class="kd-terrain-ledger" data-role="terrainLedger"></div>
            </section>

            <aside class="kd-table-rail">
                <section class="kd-players-panel">
                    <header class="kd-section-header">
                        <div><small>王冠顺序</small><h2>国王席位</h2></div>
                        <span>领地 × 王冠</span>
                    </header>
                    <div class="kd-players" data-role="players"></div>
                </section>
                <section class="kd-log-panel">
                    <header class="kd-section-header">
                        <div><small>行动纪事</small><h2>王国编年史</h2></div>
                        <span>最近行动</span>
                    </header>
                    <div class="kd-log" data-role="log"></div>
                </section>
            </aside>
        </main>

        <div class="kd-presentation-layer" data-role="presentationLayer" aria-hidden="true" hidden>
            <svg class="kd-action-lines" data-role="actionLines" aria-hidden="true">
                <defs>
                    <filter id="kdLineGlow"><feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
                    <marker id="kdLineArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z"></path></marker>
                </defs>
                <path data-role="actionPath"></path>
            </svg>
            <div class="kd-presentation-stage" data-role="presentationStage" role="status" aria-live="assertive"></div>
            <button class="kd-presentation-skip" data-action="skipPresentation" type="button">跳过</button>
        </div>

        <div class="kd-overlay is-hidden" data-role="rules" role="presentation">
            <article class="kd-rules" role="dialog" aria-modal="true" aria-labelledby="kdRulesTitle">
                <button class="kd-close-button" data-ui="closeRules" type="button" title="关闭规则" aria-label="关闭规则">×</button>
                <div class="kd-rules-art">${rulesKingdomMarkup()}</div>
                <div class="kd-rules-copy">
                    <small>玩法说明 · 基础游戏</small>
                    <h2 id="kdRulesTitle">让每一顶王冠统治更大的领地</h2>
                    <ol>
                        <li><b>选择领地</b><span>按王冠顺序选择一块公开多米诺；编号越小，下一阶段越早摆放。</span></li>
                        <li><b>连接王国</b><span>两格必须相邻且都在王国范围内，至少一格与城堡或相同地形正交相邻。</span></li>
                        <li><b>计算分数</b><span>每片连续同类地形的得分等于格子数乘该区域王冠数；没有王冠的区域为零分。</span></li>
                        <li><b>无法摆放</b><span>只有整块多米诺不存在任何合法位置时才可弃置，不能主动放弃可用领地。</span></li>
                        <li><b>赢得王国</b><span>所有轮次结束后总分最高者获胜；同分依次比较最大连续领地和王冠总数。</span></li>
                    </ol>
                    <div class="kd-rules-facts"><span><i>2–4</i>名国王</span><span><i>48</i>块领地</span><span><i>6</i>种地形</span></div>
                    <p>2 人基础局使用 24 块牌、5×5 王国和 6 轮；3/4 人局分别使用 36/48 块牌和 12 轮。7×7 王者决斗仅在房间启用该变体时生效。</p>
                </div>
            </article>
        </div>
    </section>`;

    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    function me() {
        return (state?.players || []).find(player => player.id === state.myId) || null;
    }

    function ownAnalysis() {
        return analyzeGrid(state?.myGrid || {});
    }

    function claimForTile(tile) {
        if (tile?.selectedBy) return tile.selectedBy;
        const ownSelection = (state?.mySelectedTiles || []).find(entry => entry.tile?.id === tile?.id);
        if (!ownSelection) return null;
        const player = me();
        return {
            playerId: state.myId,
            playerName: player?.name || '我',
            color: player?.color,
            token: ownSelection.token,
        };
    }

    function placementOrientation(tile, cells) {
        const size = Number(state?.boardSize) || 5;
        const grid = state?.myGrid || {};
        if (!tile || cells.length !== 2) return null;
        if (Math.abs(cells[0].x - cells[1].x) + Math.abs(cells[0].y - cells[1].y) !== 1) return null;
        if (cells.some(cell => cell.x < 0 || cell.x >= size || cell.y < 0 || cell.y >= size || grid[cellKey(cell)])) return null;

        const orientations = [
            { terrains: [tile.left, tile.right], crowns: [Number(tile.crowns?.[0]) || 0, Number(tile.crowns?.[1]) || 0] },
            { terrains: [tile.right, tile.left], crowns: [Number(tile.crowns?.[1]) || 0, Number(tile.crowns?.[0]) || 0] },
        ];
        return orientations.find(orientation => cells.some((cell, index) => adjacentCells(cell).some(neighbour => {
            const existing = grid[cellKey(neighbour)];
            return existing?.terrain === '城堡' || existing?.terrain === orientation.terrains[index];
        }))) || null;
    }

    function legalPartners(tile, anchor) {
        return adjacentCells(anchor).filter(candidate => placementOrientation(tile, [anchor, candidate]));
    }

    function legalAnchors(tile) {
        const size = Number(state?.boardSize) || 5;
        const grid = state?.myGrid || {};
        const result = new Set();
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const anchor = { x, y };
                if (!grid[cellKey(anchor)] && legalPartners(tile, anchor).length) result.add(cellKey(anchor));
            }
        }
        return result;
    }

    function hasLegalPlacement(tile) {
        return Boolean(tile && legalAnchors(tile).size);
    }

    function crownMarkup(count, className = '') {
        const amount = Number(count) || 0;
        if (!amount) return '';
        return `<span class="kd-crowns ${className}" aria-label="${amount} 顶王冠">${Array.from({ length: amount }, () => '<i>♛</i>').join('')}</span>`;
    }

    function tileHalfMarkup(terrain, crowns = 0, seed = '') {
        const meta = terrainMeta(terrain);
        return `<span class="kd-tile-half terrain-${meta.key}">
            <img src="${terrainArt(terrain, seed)}" alt="" aria-hidden="true">
            <span class="kd-tile-shade" aria-hidden="true"></span>
            <span class="kd-tile-label">${escapeHtml(terrain)}</span>
            ${crownMarkup(crowns)}
        </span>`;
    }

    function dominoFaceMarkup(tile, showNumber = true) {
        return `<span class="kd-domino-face">
            ${showNumber ? `<span class="kd-domino-number"><small>顺序</small><strong>${String(Number(tile.number) || 0).padStart(2, '0')}</strong></span>` : ''}
            <span class="kd-domino-halves">${tileHalfMarkup(tile.left, tile.crowns?.[0], `${tile.id}:0`)}${tileHalfMarkup(tile.right, tile.crowns?.[1], `${tile.id}:1`)}</span>
        </span>`;
    }

    function turnCopy() {
        if (state.status === 'ended') return `${state.winner?.name || '王国'}完成最终疆域`;
        if (state.availableActions?.canSelect) return '你的选择 · 编号决定下轮顺序';
        if (state.availableActions?.canPlace) return '你的摆放 · 连接两格新领地';
        if (state.phase === 'selecting') return `${state.currentTurnName || '下一位国王'}正在选择领地`;
        if (state.phase === 'placing') return `${state.currentTurnName || '下一位国王'}正在扩建王国`;
        return '等待王国建设';
    }

    function render() {
        if (!state) return;
        const currentTileId = state.availableActions?.canPlace ? state.mySelectedTile?.id || null : null;
        if (currentTileId !== placementTileId) {
            placementCells = [];
            placementTileId = currentTileId;
        }

        const analysis = ownAnalysis();
        const app = mount.querySelector('.kd-app');
        app.dataset.phase = state.phase || 'waiting';
        app.classList.toggle('is-my-turn', Boolean(state.availableActions?.canSelect || state.availableActions?.canPlace));
        app.classList.toggle('is-ended', state.status === 'ended');
        app.classList.toggle('is-duel-board', Number(state.boardSize) === 7);
        $('turn').innerHTML = `<span class="kd-live-dot ${state.status === 'ended' ? 'is-ended' : ''}"></span>${escapeHtml(turnCopy())}`;
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

        renderCommand();
        renderDraft();
        renderBoard();
        renderTerrainLedger(analysis);
        renderPlayers();
        renderLog();
    }

    function renderDraft() {
        const draft = state.draft || [];
        if (!draft.some(tile => tile.id === pendingDominoId && !claimForTile(tile))) pendingDominoId = null;
        const selectedCount = draft.filter(tile => claimForTile(tile)).length;
        $('draftNote').textContent = state.availableActions?.canSelect
            ? `轮到你 · ${selectedCount}/${state.draftSize || draft.length} 已选`
            : `${selectedCount}/${state.draftSize || draft.length} 已选`;
        $('draft').innerHTML = draft.length ? draft.map(tile => {
            const claim = claimForTile(tile);
            const canSelect = Boolean(state.availableActions?.canSelect && !claim && !actionPending);
            const isPending = canSelect && pendingDominoId === tile.id;
            const playerColor = safeColor(claim?.color);
            return `<button class="kd-domino-card ${claim ? 'is-claimed' : ''} ${canSelect ? 'is-selectable' : ''} ${isPending ? 'is-pending' : ''}" data-domino-id="${escapeHtml(tile.id)}" type="button" ${canSelect ? '' : 'disabled'} aria-pressed="${isPending}" aria-label="${claim ? `${escapeHtml(claim.playerName)}已选择` : isPending ? '取消选择' : '预选'}第 ${tile.number} 号多米诺">
                ${dominoFaceMarkup(tile)}
                ${claim ? `<span class="kd-domino-claim" style="--player-color:${playerColor}"><i>${escapeHtml(String(claim.playerName || '?').slice(0, 1))}</i><b>${escapeHtml(claim.playerName || '已占用')}</b><small>${Number(claim.token) > 0 ? `王冠 ${Number(claim.token) + 1}` : '已选择'}</small></span>` : `<span class="kd-domino-open">${isPending ? '已预选' : '可选择'}</span>`}
            </button>`;
        }).join('') : '<div class="kd-empty-state"><span>♛</span><strong>本轮领地已结算</strong></div>';
        const pendingTile = draft.find(tile => tile.id === pendingDominoId);
        const confirm = $('draftConfirm');
        confirm.classList.toggle('is-hidden', !pendingTile || !state.availableActions?.canSelect);
        confirm.innerHTML = pendingTile
            ? `<span><small>准备锁定</small><strong>第 ${String(Number(pendingTile.number) || 0).padStart(2, '0')} 号领地</strong></span><button data-action="confirmDomino" type="button" ${actionPending ? 'disabled' : ''}>确认选择</button>`
            : '';
    }

    function renderCommand() {
        const command = $('command');
        const tile = state.mySelectedTile;

        if (state.status === 'ended') {
            const ranking = [...(state.players || [])].filter(player => player.isOnline !== false).sort((a, b) => b.score - a.score);
            const ownRank = ranking.findIndex(player => player.id === state.myId) + 1;
            command.className = 'kd-command is-ended';
            command.innerHTML = `<header><small>最终疆域</small><h2>王国结算</h2></header>
                <div class="kd-result-crown">♛</div>
                <div class="kd-result-score"><strong>${state.winner?.score ?? ranking[0]?.score ?? 0}</strong><span>最终分</span></div>
                <p>${escapeHtml(state.winner?.name || '王国建设完成')}</p>
                <b>${ownRank ? `你的席位 · 第 ${ownRank} 名` : '本局已经结束'}</b>`;
            return;
        }

        if (state.availableActions?.canSelect) {
            const tokenNumber = Number(state.currentToken?.token) + 1;
            command.className = 'kd-command is-selecting';
            command.innerHTML = `<header><small>你的选择</small><h2>选择下一块领地</h2></header>
                <div class="kd-command-mark"><span>01</span><div><strong>从本轮公开牌中选择</strong><small>${tokenNumber > 1 ? `这是你的第 ${tokenNumber} 枚王冠` : '较低编号会优先摆放'}</small></div></div>
                <div class="kd-order-scale"><span>先行动</span><i></i><span>高价值领地</span></div>
                <p>选择后将锁定，等待所有国王完成选牌。</p>`;
            return;
        }

        if (state.availableActions?.canPlace && tile) {
            const orientation = placementOrientation(tile, placementCells);
            const legal = hasLegalPlacement(tile);
            const step = placementCells.length === 0 ? '选择第一格' : placementCells.length === 1 ? '选择高亮的相邻格' : orientation ? '位置有效，可以确认' : '这组位置无法连接';
            command.className = 'kd-command is-placing';
            command.innerHTML = `<header><small>摆放领地</small><h2>扩建你的王国</h2></header>
                <div class="kd-current-domino">${dominoFaceMarkup(tile)}<span>本轮多米诺</span></div>
                <div class="kd-placement-status ${orientation ? 'is-ready' : ''}"><span>${placementCells.length}<small>/2</small></span><div><strong>${step}</strong><small>${orientation ? `${orientation.terrains[0]} · ${orientation.terrains[1]}` : legal ? '棋盘仅显示合法起点与相邻位置' : '王国中已没有合法位置'}</small></div></div>
                <div class="kd-placement-controls">
                    <button class="kd-icon-action" data-action="swap" type="button" title="交换两格方向" aria-label="交换两格方向" ${orientation && !actionPending ? '' : 'disabled'}>↔</button>
                    <button class="kd-icon-action" data-action="clear" type="button" title="清除摆放选择" aria-label="清除摆放选择" ${placementCells.length && !actionPending ? '' : 'disabled'}>×</button>
                    <button class="kd-primary-action" data-action="place" type="button" ${orientation && !actionPending ? '' : 'disabled'}>确认摆放</button>
                </div>
                <button class="kd-discard-action" data-action="discard" type="button" ${!legal && !actionPending ? '' : 'disabled'} title="${legal ? '仍有合法摆放位置，不能弃置' : '弃置无法放入王国的多米诺'}">无法摆放，弃置此牌</button>`;
            return;
        }

        const ownSelections = state.mySelectedTiles || [];
        const waitingFor = state.phase === 'placing' ? '等待摆放顺序' : '等待其他国王选择';
        const selectedTiles = ownSelections.length
            ? ownSelections.map(entry => `<span>#${String(entry.tile?.number || 0).padStart(2, '0')}</span>`).join('')
            : '<span>尚未锁定领地</span>';
        command.className = 'kd-command is-waiting';
        command.innerHTML = `<header><small>牌局状态</small><h2>${waitingFor}</h2></header>
            <div class="kd-waiting-player"><span style="--player-color:${safeColor((state.players || []).find(player => player.id === state.currentTurn)?.color)}">${escapeHtml(String(state.currentTurnName || '王').slice(0, 1))}</span><div><strong>${escapeHtml(state.currentTurnName || '下一位国王')}</strong><small>${state.phase === 'placing' ? '正在扩建王国' : '正在选择领地'}</small></div></div>
            <div class="kd-locked-tiles"><small>我的本轮领地</small><div>${selectedTiles}</div></div>
            <p>${escapeHtml(state.lastAction?.message || '王冠顺序会自动推进。')}</p>`;
    }

    function renderBoard() {
        const board = $('board');
        const grid = state.myGrid || {};
        const size = Number(state.boardSize) || 5;
        const tile = state.mySelectedTile;
        const canPlace = Boolean(state.availableActions?.canPlace && tile && !actionPending);
        const anchors = canPlace ? legalAnchors(tile) : new Set();
        const partners = canPlace && placementCells.length === 1
            ? new Set(legalPartners(tile, placementCells[0]).map(cellKey))
            : new Set();
        const orientation = placementOrientation(tile, placementCells);

        board.style.setProperty('--kd-size', size);
        board.setAttribute('aria-label', `我的 ${size} 乘 ${size} 王国棋盘`);
        $('boardHint').textContent = state.status === 'ended'
            ? '最终疆域'
            : !canPlace
                ? '王国以城堡为中心'
                : placementCells.length === 0
                    ? `${anchors.size} 个合法起点`
                    : placementCells.length === 1
                        ? `${partners.size} 个相邻位置`
                        : orientation ? '摆放预览已就绪' : '重新选择位置';

        board.innerHTML = Array.from({ length: size * size }, (_, index) => {
            const x = index % size;
            const y = Math.floor(index / size);
            const key = `${x},${y}`;
            const existing = grid[key];
            const selectedIndex = placementCells.findIndex(cell => cell.x === x && cell.y === y);
            const preview = selectedIndex >= 0 && orientation
                ? { terrain: orientation.terrains[selectedIndex], crowns: orientation.crowns[selectedIndex] }
                : null;
            const shown = existing || preview;
            const meta = shown ? terrainMeta(shown.terrain) : null;
            const isAnchor = selectedIndex === 0;
            const isSelected = selectedIndex >= 0;
            const isCandidate = partners.has(key);
            const isPlaceable = anchors.has(key);
            const interactive = canPlace && !existing && (isSelected || isCandidate || isPlaceable);
            const classes = [
                'kd-cell',
                shown ? `terrain-${meta.key}` : 'is-empty',
                preview ? 'is-preview' : '',
                isAnchor ? 'is-anchor' : '',
                isSelected ? 'is-selected' : '',
                isCandidate ? 'is-candidate' : '',
                !placementCells.length && isPlaceable ? 'is-placeable' : '',
            ].filter(Boolean).join(' ');
            const label = shown
                ? `${shown.terrain}${shown.crowns ? `，${shown.crowns} 顶王冠` : ''}`
                : isCandidate ? '合法的第二格' : isPlaceable ? '合法起点' : '空格';
            const visual = shown?.terrain === '城堡'
                ? castleMarkup()
                : shown ? `<img src="${terrainArt(shown.terrain, `${shown.dominoId || tile?.id || 'cell'}:${key}`)}" alt="" aria-hidden="true"><span class="kd-cell-shade" aria-hidden="true"></span>` : '';
            return `<button class="${classes}" data-cell="${key}" type="button" ${interactive ? '' : 'disabled'} aria-pressed="${isSelected}" aria-label="第 ${y + 1} 行第 ${x + 1} 列，${label}">
                ${shown ? `${visual}<span class="kd-cell-label">${escapeHtml(shown.terrain)}</span>${crownMarkup(shown.crowns, 'kd-cell-crowns')}` : `<span class="kd-empty-mark">${isCandidate ? '2' : isPlaceable ? '＋' : ''}</span>`}
            </button>`;
        }).join('');
    }

    function renderTerrainLedger(analysis) {
        $('terrainLedger').innerHTML = TERRAIN_ORDER.map(terrain => {
            const meta = terrainMeta(terrain);
            const item = analysis.terrains[terrain];
            return `<article class="terrain-${meta.key} ${item.cells ? 'has-land' : ''}">
                <span><img src="${terrainArt(terrain, `ledger:${terrain}`)}" alt="" aria-hidden="true"></span>
                <div><strong>${terrain}</strong><small>${item.cells} 格 · ${item.crowns} 冠</small></div>
                <b>${item.points}</b>
            </article>`;
        }).join('');
    }

    function renderPlayers() {
        const claims = (state.draft || []).filter(tile => claimForTile(tile));
        $('players').innerHTML = (state.players || []).map((player, index) => {
            const selectedNumbers = claims.filter(tile => claimForTile(tile)?.playerId === player.id).map(tile => tile.number);
            const status = player.isOnline === false
                ? '离线'
                : player.isCurrentTurn
                    ? state.phase === 'placing' ? '正在摆放' : '正在选择'
                    : selectedNumbers.length ? `已选 ${selectedNumbers.map(number => `#${number}`).join(' · ')}` : `${player.placedCount || 0} 块多米诺`;
            return `<article class="kd-player ${player.isCurrentTurn ? 'is-current' : ''} ${player.id === state.myId ? 'is-me' : ''} ${player.isOnline === false ? 'is-offline' : ''}" data-player-id="${escapeHtml(player.id)}" style="--player-color:${safeColor(player.color)}">
                <span class="kd-player-order">${String(index + 1).padStart(2, '0')}</span>
                <span class="kd-avatar">${escapeHtml(String(player.name || '?').slice(0, 1))}</span>
                <span class="kd-player-copy"><strong>${escapeHtml(player.name)}${player.id === state.myId ? '<em>我</em>' : ''}</strong><small>${escapeHtml(status)}</small></span>
                <b>${player.score || 0}<small>分</small></b>
            </article>`;
        }).join('');
    }

    function renderLog() {
        const entries = (state.actionLog || []).slice().reverse();
        $('log').innerHTML = entries.length
            ? entries.map((entry, index) => `<div class="${index === 0 ? 'is-latest' : ''}"><i></i><span>${escapeHtml(entry)}</span></div>`).join('')
            : '<p>王国开始建设后，行动会记录在这里。</p>';
    }

    function presentationDelay(duration, token) {
        const wait = reducedMotion?.matches ? Math.min(170, duration * .22) : duration;
        return new Promise(resolve => {
            const waiter = {
                timer: window.setTimeout(() => {
                    presentationWaiters.delete(waiter);
                    resolve(token === presentationToken);
                }, wait),
                resolve,
            };
            presentationWaiters.add(waiter);
        });
    }

    function showPresentation(kind, html, color = '#d4a83d') {
        const layer = $('presentationLayer');
        layer.hidden = false;
        layer.setAttribute('aria-hidden', 'false');
        layer.className = `kd-presentation-layer is-active is-${kind}`;
        layer.style.setProperty('--kd-action-color', safeColor(color));
        $('presentationStage').innerHTML = html;
        clearActionLine();
    }

    function clearActionLine() {
        const path = $('actionPath');
        path.removeAttribute('d');
        path.setAttribute('class', '');
        path.style.removeProperty('stroke');
    }

    function clearPresentationMarks() {
        mount.querySelectorAll('.is-event-impact').forEach(element => element.classList.remove('is-event-impact'));
    }

    function hidePresentation() {
        const layer = $('presentationLayer');
        clearPresentationMarks();
        clearActionLine();
        layer.className = 'kd-presentation-layer';
        layer.style.removeProperty('--kd-action-color');
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        $('presentationStage').innerHTML = '';
    }

    function playerAnchor(playerId) {
        return [...mount.querySelectorAll('[data-player-id]')]
            .find(element => element.dataset.playerId === String(playerId)) || null;
    }

    function draftAnchor(tileId) {
        return [...mount.querySelectorAll('[data-domino-id]')]
            .find(element => element.dataset.dominoId === String(tileId)) || mount.querySelector('.kd-draft-section');
    }

    function combinedAnchor(elements = []) {
        const available = elements.filter(Boolean);
        if (!available.length) return null;
        return {
            getBoundingClientRect() {
                const rects = available.map(element => element.getBoundingClientRect());
                const left = Math.min(...rects.map(rect => rect.left));
                const right = Math.max(...rects.map(rect => rect.right));
                const top = Math.min(...rects.map(rect => rect.top));
                const bottom = Math.max(...rects.map(rect => rect.bottom));
                return { left, right, top, bottom, width: right - left, height: bottom - top };
            },
        };
    }

    function placementAnchor(event) {
        if (String(event.playerId) !== String(state?.myId)) return playerAnchor(event.playerId);
        const first = event.placement?.first;
        const second = event.placement?.second;
        const elements = [first, second].map(cell => cell && mount.querySelector(`[data-cell="${cell.x},${cell.y}"]`));
        return combinedAnchor(elements) || $('board');
    }

    function drawActionLine(fromElement, toElement, color = '#d4a83d') {
        if (!fromElement || !toElement) return clearActionLine();
        const from = fromElement.getBoundingClientRect();
        const to = toElement.getBoundingClientRect();
        const x1 = from.left + from.width / 2;
        const y1 = from.top + from.height / 2;
        const x2 = to.left + to.width / 2;
        const y2 = to.top + to.height / 2;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(42, Math.min(150, Math.abs(x2 - x1) * .22 + Math.abs(y2 - y1) * .1));
        const path = $('actionPath');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', 'is-visible');
        path.style.stroke = safeColor(color);
    }

    function setMotionOrigin(source, element) {
        if (!source || !element) return;
        const from = source.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--kd-from-x', `${from.left + from.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--kd-from-y', `${from.top + from.height / 2 - (target.top + target.height / 2)}px`);
    }

    function setMotionDestination(destination, element) {
        if (!destination || !element) return;
        const to = destination.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        element.style.setProperty('--kd-to-x', `${to.left + to.width / 2 - (target.left + target.width / 2)}px`);
        element.style.setProperty('--kd-to-y', `${to.top + to.height / 2 - (target.top + target.height / 2)}px`);
    }

    function eventDominoMarkup(tile, extraClass = '') {
        return `<div class="kd-event-domino ${extraClass}">${dominoFaceMarkup(tile)}</div>`;
    }

    async function playClaimPresentation(event, token) {
        const color = safeColor(event.playerColor);
        showPresentation('claim', `<div class="kd-claim-event">
            <span class="kd-event-kicker">${escapeHtml(event.playerName)}认领公开领地</span>
            <div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div>
            <span class="kd-crown-flight" style="--player-color:${color}"><i>♛</i><small>王冠 ${Number(event.tokenNumber) || 1}</small></span>
            <h2>第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地</h2>
            <p>编号越小，摆放顺序越靠前</p>
        </div>`, color);
        const motion = $('presentationStage').querySelector('.kd-domino-motion');
        const source = draftAnchor(event.tile?.id);
        const actor = playerAnchor(event.playerId);
        setMotionOrigin(source, motion);
        drawActionLine(actor, source, color);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(300, token)) return;
        $('presentationLayer').classList.add('is-crowned');
        drawActionLine(actor, motion, color);
        if (!await presentationDelay(430, token)) return;
        setMotionDestination(source, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, source, color);
        source?.classList.add('is-event-impact');
        await presentationDelay(390, token);
    }

    async function playPlacementPhasePresentation(event, token) {
        showPresentation('placement-phase', `<div class="kd-phase-event">
            <span class="kd-event-kicker">第 ${Number(event.round) || 1} 轮领地已经锁定</span>
            <h2>按编号扩建王国</h2>
            <div class="kd-placement-order">${(event.order || []).map(entry => `<article style="--player-color:${safeColor(entry.playerColor)}"><span>${Number(entry.order)}</span>${eventDominoMarkup(entry.tile, 'is-order-domino')}<strong>${escapeHtml(entry.playerName)}</strong><small>王冠 ${Number(entry.tokenNumber) || 1}</small></article>`).join('')}</div>
            <p>低编号的国王先摆放领地</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(850, token);
    }

    async function playPlacePresentation(event, token) {
        const color = safeColor(event.playerColor);
        const gain = Number(event.scoreAfter) - Number(event.scoreBefore);
        showPresentation('place', `<div class="kd-place-event">
            <span class="kd-event-kicker">${escapeHtml(event.playerName)}扩建王国</span>
            <div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div>
            <h2>领地正式落位</h2>
            <p>${gain > 0 ? `王国 ${Number(event.scoreBefore)} → ${Number(event.scoreAfter)} 分 · +${gain}` : `当前 ${Number(event.scoreAfter)} 分 · 新领地尚未形成得分`}</p>
        </div>`, color);
        const motion = $('presentationStage').querySelector('.kd-domino-motion');
        const actor = playerAnchor(event.playerId);
        const destination = placementAnchor(event);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(430, token)) return;
        setMotionDestination(destination, motion);
        $('presentationLayer').classList.add('is-transferred');
        drawActionLine(motion, destination, color);
        if (String(event.playerId) === String(state?.myId)) {
            for (const cell of [event.placement?.first, event.placement?.second]) {
                if (cell) mount.querySelector(`[data-cell="${cell.x},${cell.y}"]`)?.classList.add('is-event-impact');
            }
        } else playerAnchor(event.playerId)?.classList.add('is-event-impact');
        await presentationDelay(590, token);
    }

    async function playDiscardPresentation(event, token) {
        const color = safeColor(event.playerColor);
        showPresentation('discard', `<div class="kd-discard-event">
            <span class="kd-event-kicker">${escapeHtml(event.playerName)}无法连接这块领地</span>
            <div class="kd-domino-motion">${eventDominoMarkup(event.tile)}</div>
            <h2>第 ${String(Number(event.tile?.number) || 0).padStart(2, '0')} 号领地被弃置</h2>
            <p>王国中已经没有合法的相邻位置</p>
        </div>`, color);
        const motion = $('presentationStage').querySelector('.kd-domino-motion');
        const actor = playerAnchor(event.playerId);
        setMotionOrigin(actor, motion);
        drawActionLine(actor, motion, color);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-centered');
        if (!await presentationDelay(380, token)) return;
        $('presentationLayer').classList.add('is-discarded');
        clearActionLine();
        await presentationDelay(560, token);
    }

    async function playRoundRevealPresentation(event, token) {
        const last = Boolean(event.isLastRound);
        showPresentation(last ? 'last-round' : 'round-reveal', `<div class="kd-round-event">
            <span class="kd-event-kicker">${last ? '王国边界即将封闭' : '新的领地已经揭晓'}</span>
            <h2>${last ? '最后一轮' : `第 ${Number(event.round)} 轮`}</h2>
            <div class="kd-round-dominoes">${(event.draft || []).map((tile, index) => `<span style="--kd-reveal-order:${index}">${eventDominoMarkup(tile, 'is-round-domino')}</span>`).join('')}</div>
            <p>${last ? '这是扩建王国的最后机会' : `牌库还剩 ${Number(event.remainingTileCount) || 0} 块领地`}</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(last ? 1350 : 920, token);
    }

    async function playFinalePresentation(batch, token) {
        const standings = batch.standings || [];
        const winnerId = String(batch.winner?.id || '');
        showPresentation('finale', `<div class="kd-finale-scene">
            <span class="kd-event-kicker">所有王国已经完成</span>
            <div class="kd-finale-crown" aria-hidden="true">♛</div>
            <h2>最终疆域</h2>
            <div class="kd-final-standings">${standings.map((player, index) => `<article class="${String(player.id) === winnerId ? 'is-winner' : ''}" style="--player-color:${safeColor(player.color)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(player.name)}</strong><b>${Number(player.score) || 0}<small>分</small></b><em data-crowns="${Number(player.totalCrowns) || 0}">最大领地 ${Number(player.largestTerritory) || 0}</em><i>♛ ${Number(player.totalCrowns) || 0}</i></article>`).join('')}</div>
            <p>同分时依次比较最大连续领地与王冠总数</p>
        </div>`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        $('presentationLayer').classList.add('is-revealed');
        await presentationDelay(2700, token);
    }

    async function runPresentationQueue() {
        if (presentationPlaying) return;
        presentationPlaying = true;
        mount.querySelector('.kd-app')?.classList.add('is-presentation-playing');
        while (presentationQueue.length) {
            const item = presentationQueue.shift();
            const token = ++presentationToken;
            for (const event of item.batch?.events || []) {
                if (event.kind === 'selectDomino') await playClaimPresentation(event, token);
                if (event.kind === 'placementPhase') await playPlacementPhasePresentation(event, token);
                if (event.kind === 'placeDomino') await playPlacePresentation(event, token);
                if (event.kind === 'discardDomino') await playDiscardPresentation(event, token);
                if (event.kind === 'roundReveal') await playRoundRevealPresentation(event, token);
                if (token !== presentationToken) break;
                hidePresentation();
                if (!await presentationDelay(70, token)) break;
            }
            if (token !== presentationToken) continue;
            if (item.batch?.ended) await playFinalePresentation(item.batch, token);
            if (token === presentationToken) hidePresentation();
        }
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.kd-app')?.classList.remove('is-presentation-playing');
    }

    function enqueuePresentation(item) {
        presentationQueue.push(item);
        void runPresentationQueue();
    }

    function stopPresentation() {
        presentationToken += 1;
        presentationQueue = [];
        for (const waiter of presentationWaiters) {
            window.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        presentationWaiters.clear();
        hidePresentation();
        presentationPlaying = false;
        mount.querySelector('.kd-app')?.classList.remove('is-presentation-playing');
    }

    function selectBoardCell(cell) {
        const tile = state?.mySelectedTile;
        if (!state?.availableActions?.canPlace || !tile || actionPending) return;
        const key = cellKey(cell);
        const anchors = legalAnchors(tile);

        if (!placementCells.length) {
            if (anchors.has(key)) placementCells = [cell];
        } else if (placementCells.length === 1) {
            if (cellKey(placementCells[0]) === key) placementCells = [];
            else if (placementOrientation(tile, [placementCells[0], cell])) placementCells.push(cell);
            else if (anchors.has(key)) placementCells = [cell];
        } else {
            const selected = placementCells.find(item => cellKey(item) === key);
            placementCells = selected ? [selected] : anchors.has(key) ? [cell] : placementCells;
        }

        renderCommand();
        renderBoard();
    }

    function sendAction(action) {
        if (actionPending) return;
        actionPending = true;
        send({ type: 'gameAction', action });
        render();
    }

    function openRules(trigger) {
        rulesTrigger = trigger || null;
        $('rules').classList.remove('is-hidden');
        mount.querySelector('[data-ui="closeRules"]')?.focus({ preventScroll: true });
    }

    function closeRules() {
        $('rules').classList.add('is-hidden');
        rulesTrigger?.focus?.({ preventScroll: true });
        rulesTrigger = null;
    }

    function handleClick(event) {
        if (presentationPlaying) {
            if (event.target.closest('[data-action="skipPresentation"]')) stopPresentation();
            return;
        }
        const cellButton = event.target.closest('[data-cell]');
        if (cellButton && !cellButton.disabled) {
            const [x, y] = cellButton.dataset.cell.split(',').map(Number);
            if (Number.isInteger(x) && Number.isInteger(y)) selectBoardCell({ x, y });
            return;
        }

        const domino = event.target.closest('[data-domino-id]');
        if (domino && !domino.disabled) {
            pendingDominoId = pendingDominoId === domino.dataset.dominoId ? null : domino.dataset.dominoId;
            renderDraft();
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton && !actionButton.disabled) {
            const action = actionButton.dataset.action;
            if (action === 'clear') {
                placementCells = [];
                renderCommand();
                renderBoard();
            }
            if (action === 'confirmDomino' && pendingDominoId) {
                sendAction({ kind: 'selectDomino', dominoId: pendingDominoId });
            }
            if (action === 'swap' && placementCells.length === 2) {
                placementCells.reverse();
                renderCommand();
                renderBoard();
            }
            if (action === 'place') {
                const orientation = placementOrientation(state.mySelectedTile, placementCells);
                if (orientation) {
                    const [first, second] = placementCells;
                    sendAction({ kind: 'placeDomino', x1: first.x, y1: first.y, x2: second.x, y2: second.y });
                }
            }
            if (action === 'discard' && !hasLegalPlacement(state.mySelectedTile)) sendAction({ kind: 'discardDomino' });
            return;
        }

        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;

        if (ui === 'rules') openRules(uiButton);
        if (ui === 'closeRules' || event.target === $('rules')) closeRules();
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && presentationPlaying) return stopPresentation();
        if (event.key === 'Escape' && !$('rules').classList.contains('is-hidden')) closeRules();
    }

    mount.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return {
        gameType: 'kingdomino',
        handleMessage(message) {
            if (message.state) {
                const firstState = !state;
                state = message.state;
                pendingDominoId = null;
                actionPending = false;
                render();
                const sequence = Number(state.presentation?.sequence) || 0;
                if (firstState) lastPresentationSequence = sequence;
                else if (sequence > lastPresentationSequence) {
                    lastPresentationSequence = sequence;
                    enqueuePresentation({ batch: JSON.parse(JSON.stringify(state.presentation)) });
                }
            }
            if (message.type === 'error') {
                actionPending = false;
                addLog?.(message.message || '操作失败', 'error');
                if (state) render();
            }
        },
        destroy() {
            stopPresentation();
            mount.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleKeydown);
            document.body.classList.remove('is-kingdomino-view');
            style.remove();
            mount.innerHTML = '';
        },
    };
}
