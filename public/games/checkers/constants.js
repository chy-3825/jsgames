export const BOARD_MAX_X = 24;
export const BOARD_MAX_Y = 16;
export const BOARD_INSET = 7;
export const BOARD_SPAN = 100 - BOARD_INSET * 2;
export const ROW_COUNTS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];

export function key(x, y) { return String(x) + ',' + String(y); }

export function createCells() {
    const cells = [];
    for (let y = 0; y < ROW_COUNTS.length; y += 1) {
        const count = ROW_COUNTS[y];
        const start = 13 - count;
        for (let index = 0; index < count; index += 1) cells.push({ x: start + index * 2, y });
    }
    return cells;
}

export const CELLS = createCells();
export const CELL_KEYS = new Set(CELLS.map(cell => key(cell.x, cell.y)));
export function inside(x, y) { return CELL_KEYS.has(key(x, y)); }
export function pointStyle(point) { return 'left:' + (BOARD_INSET + point.x * BOARD_SPAN / BOARD_MAX_X) + '%;top:' + (BOARD_INSET + point.y * BOARD_SPAN / BOARD_MAX_Y) + '%'; }
export function boardRotationForCorner(corner) { return Number.isInteger(corner) && corner >= 0 && corner <= 5 ? 180 - corner * 60 : 0; }

export function createLines() {
    const lines = [];
    for (const cell of CELLS) for (const direction of [[2, 0], [1, 1], [1, -1]]) {
        const other = { x: cell.x + direction[0], y: cell.y + direction[1] };
        if (inside(other.x, other.y)) lines.push('<line x1="' + cell.x + '" y1="' + cell.y + '" x2="' + other.x + '" y2="' + other.y + '"></line>');
    }
    return lines.join('');
}
