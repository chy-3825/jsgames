import { DIRECTIONS, TERRAIN_ORDER } from './constants.js';
import { terrainMeta } from './cards.js';

export function createKingdominoModel() {
    return {
        state: null,
        placementCells: [],
        placementTileId: null,
        pendingDominoId: null,
        actionPending: false,
        lastPresentationSequence: 0,
        presentationPlaying: false,
        presentationQueue: [],
        presentationToken: 0,
        presentationEventIds: new Set(),
        presentationWaiters: new Set(),
        presentationLockedUntil: 0,
        presentationSkipCurrent: false,
        presentationEvent: null,
    };
}

/** Translate server absolute timestamps to this browser's clock. */
export function localizePresentation(batch, localNow = Date.now()) {
    if (!batch?.events?.length) return null;
    const serverNow = Number(batch.serverNow);
    const batchEnd = Number(batch.endsAt);
    if (!Number.isFinite(serverNow) || !Number.isFinite(batchEnd)) return batch;
    if (batchEnd <= serverNow) return null;
    const toLocalTime = value => Number.isFinite(Number(value))
        ? localNow + (Number(value) - serverNow)
        : value;
    return {
        ...batch,
        startedAt: toLocalTime(batch.startedAt),
        endsAt: toLocalTime(batch.endsAt),
        events: batch.events.map(event => ({
            ...event,
            startedAt: toLocalTime(event.startedAt),
            endsAt: toLocalTime(event.endsAt),
        })),
    };
}

export const cellKey = cell => `${cell.x},${cell.y}`;
export const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#7f8a83';
export const adjacentCells = cell => DIRECTIONS.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }));

export function analyzeGrid(grid = {}) {
    const visited = new Set();
    const terrains = Object.fromEntries(TERRAIN_ORDER.map(terrain => [terrain, { cells: 0, crowns: 0, points: 0, regions: 0 }]));
    let score = 0; let occupied = 0; let crowns = 0;
    for (const [key, cell] of Object.entries(grid)) {
        if (cell?.terrain === '城堡') continue;
        occupied += 1;
        crowns += Number(cell?.crowns) || 0;
        if (!cell?.terrain || visited.has(key)) continue;
        const queue = [key]; visited.add(key); let regionSize = 0; let regionCrowns = 0;
        while (queue.length) {
            const currentKey = queue.shift(); const current = grid[currentKey]; regionSize += 1; regionCrowns += Number(current?.crowns) || 0;
            const [x, y] = currentKey.split(',').map(Number);
            for (const next of adjacentCells({ x, y })) { const nextKey = cellKey(next); if (!visited.has(nextKey) && grid[nextKey]?.terrain === current.terrain) { visited.add(nextKey); queue.push(nextKey); } }
        }
        const points = regionSize * regionCrowns; const summary = terrains[cell.terrain];
        if (summary) { summary.cells += regionSize; summary.crowns += regionCrowns; summary.points += points; summary.regions += 1; }
        score += points;
    }
    return { terrains, score, occupied, crowns };
}

export function me(state) { return (state?.players || []).find(player => player.id === state.myId) || null; }

export function claimForTile(state, tile) {
    if (tile?.selectedBy) return tile.selectedBy;
    const ownSelection = (state?.mySelectedTiles || []).find(entry => entry.tile?.id === tile?.id);
    if (!ownSelection) return null;
    const player = me(state);
    return { playerId: state.myId, playerName: player?.name || '我', color: player?.color, token: ownSelection.token };
}

export function placementOrientation(state, tile, cells) {
    const size = Number(state?.boardSize) || 5; const grid = state?.myGrid || {};
    if (!tile || cells.length !== 2) return null;
    if (Math.abs(cells[0].x - cells[1].x) + Math.abs(cells[0].y - cells[1].y) !== 1) return null;
    if (cells.some(cell => cell.x < 0 || cell.x >= size || cell.y < 0 || cell.y >= size || grid[cellKey(cell)])) return null;
    const orientations = [{ terrains: [tile.left, tile.right], crowns: [Number(tile.crowns?.[0]) || 0, Number(tile.crowns?.[1]) || 0] }, { terrains: [tile.right, tile.left], crowns: [Number(tile.crowns?.[1]) || 0, Number(tile.crowns?.[0]) || 0] }];
    return orientations.find(orientation => cells.some((cell, index) => adjacentCells(cell).some(neighbour => { const existing = grid[cellKey(neighbour)]; return existing?.terrain === '城堡' || existing?.terrain === orientation.terrains[index]; })) ) || null;
}

export function legalPartners(state, tile, anchor) { return adjacentCells(anchor).filter(candidate => placementOrientation(state, tile, [anchor, candidate])); }
export function legalAnchors(state, tile) {
    const size = Number(state?.boardSize) || 5; const grid = state?.myGrid || {}; const result = new Set();
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) { const anchor = { x, y }; if (!grid[cellKey(anchor)] && legalPartners(state, tile, anchor).length) result.add(cellKey(anchor)); }
    return result;
}
export function hasLegalPlacement(state, tile) { return Boolean(tile && legalAnchors(state, tile).size); }

export function turnCopy(state) {
    if (state.status === 'ended') {
        const winnerNames = (state.winners?.length ? state.winners : state.winner ? [state.winner] : [])
            .map(player => player.name)
            .filter(Boolean)
            .join('、');
        return `${winnerNames || '王国'}完成最终疆域`;
    }
    if (state.availableActions?.canSelect) return '你的选择 · 编号决定下轮顺序';
    if (state.availableActions?.canPlace) return '你的摆放 · 连接两格新领地';
    if (state.phase === 'selecting') return `${state.currentTurnName || '下一位国王'}正在选择领地`;
    if (state.phase === 'placing') return `${state.currentTurnName || '下一位国王'}正在扩建王国`;
    return '等待王国建设';
}
