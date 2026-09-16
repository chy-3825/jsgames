import { adaptedWildFace } from './property-wild-adapted.js';
import { escapeHtml } from '../common/html.js';

// These are crops of the untouched BGG uploads, not generated illustrations.
// Boxes use the source image coordinate system. Only text is localized; same-color street cards share the official rent-table artwork.
const PROPERTIES = {
    '地中海大道': ['brown', [17, 15, 181, 281], [66, 46, 112, 33], '#a35c30'],
    '康涅狄格大道': ['lightblue', [209, 15, 185, 283], [261, 43, 112, 37], '#b4dae7'],
    '圣查尔斯广场': ['pink', [402, 15, 189, 284], [457, 44, 113, 41], '#db5381'],
    '圣詹姆斯广场': ['orange', [598, 16, 189, 285], [655, 46, 107, 39], '#fb9614'],
    '雷丁铁路': ['railroad', [793, 15, 191, 285], [851, 47, 96, 33], '#152c10'],
    '肯塔基大道': ['red', [17, 305, 182, 285], [65, 334, 112, 37], '#e32320'],
    '大西洋大道': ['yellow', [210, 305, 184, 288], [262, 334, 110, 40], '#fee00c'],
    '北卡罗来纳大道': ['green', [403, 307, 189, 285], [435, 344, 135, 35], '#55a149'],
    '木板路': ['blue', [604, 307, 185, 285], [661, 337, 107, 31], '#1075ad'],
    '自来水厂': ['utility', [797, 308, 185, 284], [850, 340, 92, 42], '#d1ddb7'],
};

// Coordinates refer to a 1632×1530 display of the original 2428×2278 scan.
const WILDS = {
    'brown,lightblue': { crop: [48, 36, 453, 695], value: 1, top: [158, 102, 289, 98], bottom: [103, 550, 305, 120], colors: ['#a36323', '#b7dce8'] },
    'orange,pink': { crop: [568, 28, 461, 696], value: 2, top: [676, 97, 291, 98], bottom: [631, 546, 318, 120], colors: ['#db548b', '#f69a17'] },
    'red,yellow': { crop: [1106, 20, 462, 699], value: 3, top: [1220, 91, 283, 102], bottom: [1167, 541, 316, 118], colors: ['#ed1824', '#f3d719'] },
    'blue,green': { crop: [59, 792, 461, 701], value: 4, top: [174, 860, 287, 98], bottom: [114, 1308, 320, 120], colors: ['#60a93d', '#167cab'] },
    'railroad,utility': { crop: [584, 804, 464, 701], value: 2, top: [690, 865, 235, 110], bottom: [695, 1328, 266, 123], colors: ['#142719', '#d0deb4'] },
    all: { crop: [1115, 795, 469, 703], value: 0 },
};

function patch(box, lines, background = '#f8f5ef', size = 10, ink = '#233122', flipped = false) {
    const [x, y, width, height] = box;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const text = lines.map((line, i) => `<text x="${centerX}" y="${centerY + (i - (lines.length - 1) / 2) * size * 1.18}" dominant-baseline="central" text-anchor="middle" fill="${ink}" font-size="${size}" font-weight="650">${escapeHtml(line)}</text>`).join('');
    return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background}"/>${flipped ? `<g transform="rotate(180 ${centerX} ${centerY})">${text}</g>` : text}</g>`;
}

let maskSequence = 0;

function scan(crop, file, width, height, sourceId, text, seals = []) {
    // Text masks must never repaint the original denomination seals.
    const id = `deal-source-mask-${sourceId}-${++maskSequence}`;
    const protectedAreas = seals.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="black"/>`).join('');
    return `<svg class="deal-source-property" viewBox="${crop.join(' ')}" preserveAspectRatio="none" data-bgg-image="${sourceId}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${protectedAreas}</mask></defs><g><image href="/assets/bgg/monopolydeal/${file}" width="${width}" height="${height}"/><g mask="url(#${id})">${text}</g></g></svg>`;
}

export function propertyFaceMarkup(card) {
    if (card.kind === 'property') {
        const entry = PROPERTIES[card.name] || Object.values(PROPERTIES).find(property => property[0] === card.color);
        if (card.name === '电力公司' && card.color === 'utility') return electricityFace(card);
        if (!entry || entry[0] !== card.color) return missing(card);
        const [color, crop, title, background] = entry;
        const name = card.name.replace(/(.+)(大道|广场|铁路|水厂)$/, '$1\n$2').split('\n');
        const ink = color === 'railroad' ? '#fff' : '#172b19';
        const text = patch(title, name, background, 11, ink);
        const seals = { brown: [50, 44, 18], lightblue: [244, 45, 18], pink: [444, 46, 18], orange: [638, 47, 18], railroad: [830, 46, 18], red: [50, 336, 18], yellow: [245, 341, 18], green: [444, 342, 18], blue: [639, 342, 18], utility: [833, 342, 18] };
        return scan(crop, 'property-sheet-rectified.png', 1000, 611, 424917, text, [seals[color]]);
    }
    if (card.kind !== 'property_wild') return '';
    const extra = extraWildFace(card);
    if (extra) return extra;
    const entry = WILDS[card.allColor ? 'all' : [...(card.colors || [])].sort().join(',')];
    if (!entry || entry.value !== card.value) return missing(card);
    let text;
    if (card.allColor) {
        text = patch([1167, 892, 341, 42], ['十色万能地产'], '#f3f4df', 30);
    } else {
        const [tx, ty, tw, th] = entry.top;
        const [bx, by, bw, bh] = entry.bottom;
        text = patch([tx, ty, tw, th - 24], ['万能地产'], entry.colors[0], 30, entry.colors[0] === '#142719' ? '#fff' : '#16301d')
            + patch([bx, by + 28, bw, bh - 28], ['万能地产'], entry.colors[1], 30, '#16301d', true);
    }
    const seals = {
        'brown,lightblue': [[128, 108, 47], [427, 646, 48]],
        'orange,pink': [[650, 102, 48], [945, 637, 48]],
        'red,yellow': [[1181, 100, 49], [1477, 629, 49]],
        'blue,green': [[145, 860, 49], [442, 1427, 49]],
        'railroad,utility': [[665, 883, 49], [977, 1431, 49]],
    };
    return scan(entry.crop, 'property-wild-sheet-rectified.png', 1632, 1530, 424919, text, seals[[...(card.colors || [])].sort().join(',')] || []);
}

function missing(card) {
    return `<span class="deal-property-missing" data-original-missing="true"><strong>${escapeHtml(card.name || '地产')}</strong><span>原图待补</span><small>${card.value || 0}M</small></span>`;
}

// Adapt the existing clear scans, rather than mix in photographed editions.
// These three faces are edited templates, not scans of the exact printed cards.
function electricityFace() {
    const bulb = x => `<g transform="translate(${x} 363)" fill="none" stroke="#253921" stroke-width="1.2"><path fill="#e3c856" d="M-4 0C-8-9 8-9 4 0L2 4H-2Z"/><path d="M-2 6H2M-1 8H1M0-10V-13M-8-5H-11M8-5H11"/></g>`;
    const text = patch([849, 340, 94, 41], ['电力公司'], '#d1ddb7', 11)
        + patch([814, 354, 160, 28], [], '#d1ddb7') + bulb(829) + bulb(960)
        + patch([849, 347, 94, 28], ['电力公司'], '#d1ddb7', 11);
    return scan(PROPERTIES['自来水厂'][1], 'property-sheet-rectified.png', 1000, 611, 424917, text, [[833, 342, 18]])
        .replace('data-bgg-image=', 'data-adapted-template="electricity" data-bgg-image=');
}

function extraWildFace(card) {
    if (card.value !== 4 || card.allColor) return '';
    const key = [...(card.colors || [])].sort().join(',');
    if (!['lightblue,railroad', 'green,railroad'].includes(key)) return '';
    return adaptedWildFace(key);
}

/** Reuse the public artwork, simplifying only the hand's information panel. */
export function propertyHandFaceMarkup(card) {
    const face = propertyFaceMarkup(card);
    const bounds = face.match(/viewBox="([\d. ]+)"/);
    if (!bounds) return face;
    const [x, y, width, height] = bounds[1].split(' ').map(Number);
    const dual = card.kind === 'property_wild' && !card.allColor;
    const panel = [x + width * .07, y + height * .285, width * .86, height * (dual ? .445 : .625)];
    const overlay = `<g data-hand-property-panel="true">${patch(panel, ['地产牌'], '#f8f5ef', width * .15)}</g>`;
    const end = face.lastIndexOf('</svg>');
    return face.slice(0, end) + overlay + face.slice(end);
}
