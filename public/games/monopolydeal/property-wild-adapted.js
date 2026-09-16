// Two adapted cards: continuous vector edges avoid rectangular scan seams.
// The existing scan supplies the paper perimeter; the interior follows its layout.
const PAPER = '#f8f5ef';
const INK = '#233122';

function label(x, y, text, size, fill = INK) {
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="700" fill="${fill}">${text}</text>`;
}

function seal(x, y) {
    return `<circle cx="${x}" cy="${y}" r="43" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="39" fill="none" stroke="${INK}" stroke-width="1"/>${label(x, y, '₩4M', 28)}`;
}

function header(color, railroad = false) {
    const ink = railroad ? PAPER : INK;
    const train = railroad ? '<path d="M350 60h28v17h-28zM355 50h8v10h-8zM370 55h8v5h-8z" fill="#f8f5ef"/><circle cx="355" cy="81" r="5" fill="#f8f5ef"/><circle cx="374" cy="81" r="5" fill="#f8f5ef"/>' : '';
    return `<rect x="46" y="50" width="372" height="123" fill="${color}" stroke="${INK}" stroke-width="2"/>${label(246, 106, '万能地产', 30, ink)}${label(240, 150, '(Use card either way up.)', 13, ink)}${train}${seal(78, 70)}`;
}

function stack(x, y, count, color) {
    let cards = '';
    for (let i = count - 1; i >= 0; i--) {
        cards += `<g transform="rotate(${-i * 12} ${x + 15} ${y + 30})"><rect x="${x}" y="${y}" width="30" height="40" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><path d="M${x + 2} ${y + 8}h26v-5q0-1-2-1h-22q-2 0-2 1z" fill="${color}"/></g>`;
    }
    return cards + label(x + 15, y + 25, count, 23);
}

function rents(values, color) {
    return label(342, 212, 'RENT', 31) + values.map((value, index) => {
        const y = 253 + index * 58;
        const full = index === values.length - 1;
        return `<g data-rent-count="${index + 1}" data-rent-value="${value}">${stack(245, y, index + 1, color)}<path d="M280 ${y + 24}H368" stroke="${INK}" stroke-width="1.6" stroke-dasharray="2 3"/>${full ? `<rect x="280" y="${y + 12}" width="62" height="23" fill="${PAPER}"/>${label(311, y + 24, 'FULL SET', 11)}` : ''}${label(393, y + 24, `₩${value}M`, 22)}</g>`;
    }).join('');
}

export function adaptedWildFace(key) {
    const light = key === 'lightblue,railroad';
    const color = light ? '#b7dce8' : '#60a93d';
    return `<svg class="deal-source-property" viewBox="0 0 464 701" preserveAspectRatio="none" data-adapted-template="${key}" data-bgg-image="424919" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><svg width="464" height="701" viewBox="584 804 464 701" preserveAspectRatio="none"><image href="/assets/bgg/monopolydeal/property-wild-sheet-rectified.png" width="1632" height="1530"/></svg><rect x="17" y="17" width="430" height="667" rx="14" fill="${PAPER}"/><rect x="27" y="28" width="410" height="645" fill="none" stroke="${INK}" stroke-width="2"/>${header('#142719', true)}${rents([1, 2, 3, 4], '#142719')}<g transform="rotate(180 232 350.5)">${header(color)}${rents(light ? [1, 2, 3] : [2, 4, 7], color)}</g></svg>`;
}
