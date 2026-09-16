const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { buildDeck } = require('../server/games/monopolydeal/engine');

const faces = import('../public/games/monopolydeal/cards.js');

test('整副可玩牌使用当前牌面，地产手牌保持简洁', async () => {
    const { publicCardMarkup, handCardMarkup } = await faces;
    const deck = buildDeck().filter(card => card.kind !== 'rules');
    assert.equal(deck.length, 106);
    for (const card of deck) {
        const full = publicCardMarkup(card);
        const hand = handCardMarkup(card);
        assert.doesNotMatch(full, /deal-card-fallback|deal-card-visual|deal-card-wash/, card.name);
        assert.ok(hand.length > 0, card.name);
        if (['property', 'property_wild'].includes(card.kind)) {
            assert.match(hand, /data-hand-property-panel/, card.name);
            assert.doesNotMatch(hand, /deal-official-deed|deal-deed-row/, card.name);
        }
    }
});

test('做出反对的两个金额角标与服务端面额一致', async () => {
    const { publicCardMarkup, handCardMarkup } = await faces;
    const card = buildDeck().find(card => card.action === 'justSayNo');
    assert.equal(card.value, 4);
    for (const render of [publicCardMarkup, handCardMarkup]) {
        const face = render(card);
        assert.equal((face.match(/deal-action-value-fix/g) || []).length, 2);
        assert.equal((face.match(/>4M<\/span>/g) || []).length, 2);
    }
});

test('未知牌可读且文字和属性转义，不退回旧装饰牌面', async () => {
    const { publicCardMarkup } = await faces;
    const html = publicCardMarkup({ kind: 'future', name: '<img onerror=alert(1)>', value: 2 }, '', '', 'x" onclick="bad');
    assert.match(html, /deal-card-fallback/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img|data-role="x" onclick/);
});

test('全部地产完整版使用可追溯原图及中文文字，手牌保持自绘', async () => {
    const { publicCardMarkup, handCardMarkup } = await faces;
    const properties = buildDeck().filter(card => ['property', 'property_wild'].includes(card.kind));
    let originals = 0;
    let missing = 0;
    for (const card of properties) {
        const full = publicCardMarkup(card);
        assert.doesNotMatch(full, /property-official-zh|property-paper|deal-deed-wild|deal-official-deed/);
        if (full.includes('data-bgg-image=')) {
            originals++;
            assert.match(full, /<image href="\/assets\/bgg\/monopolydeal\/(?:property-(?:wild-)?sheet-rectified\.png|reference\/(?:4906537|4906542)\.jpg)"/);
            assert.match(full, /<text[^>]*>[\s\S]*?<\/text>/);
            assert.doesNotMatch(full, /同组地产|张数|>租金<|成套|可选择任一颜色|可用于任意地产组|没有货币价值/);
        } else {
            missing++;
            assert.match(full, /data-original-missing="true"/);
            assert.match(full, /原图待补/);
        }
        assert.match(handCardMarkup(card), /data-hand-property-panel/);
        assert.match(handCardMarkup(card), /<image/);
        assert.match(handCardMarkup(card), />地产牌<\/text>/);
        assert.doesNotMatch(full, /data-hand-property-panel/);
    }
    assert.equal(originals, 39); // All 28 normal properties and 11 wild cards.
    assert.equal(missing, 0);
    assert.match(publicCardMarkup({ kind: 'property', name: '波罗的海大道', color: 'brown', value: 1 }), /波罗的海/);
    assert.match(publicCardMarkup({ kind: 'property_wild', colors: ['green', 'railroad'], value: 4 }), /data-adapted-template="green,railroad"/);
});

test('地产底图保持 BGG 下载文件原始字节', () => {
    const hashes = {
        'reference/4906537.jpg': 'be9083bfc32a3e25a1d43a9aac4b7937418415ffe5a0ff4a8f3ef98e9f316a9b',
        'reference/4906542.jpg': '7482f297e3ca8f02480ba4f1aa83dd3fdbc3eaa70b97221ea99069b540329a91',

        'property-sheet.jpg': 'e90eb551dcb3e333acfa3395250f40086cf7d3591bfdddbc1150052fb76b9e3f',
        'property-wild-sheet.jpg': '71f3f417aa8ddfb04841672fb58ea709b102aecbe25416d4034291633d859d1e',
    };
    for (const [file, expected] of Object.entries(hashes)) {
        const bytes = fs.readFileSync(`public/assets/bgg/monopolydeal/${file}`);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
    }
});

test('改制万能地产的两侧租金与规则表一致，不再拼接小裁片', async () => {
    const { publicCardMarkup } = await faces;
    const { RENT_TABLE } = require('../server/games/monopolydeal/deck');
    for (const color of ['green', 'lightblue']) {
        const html = publicCardMarkup({ kind: 'property_wild', colors: [color, 'railroad'], value: 4 });
        const rows = [...html.matchAll(/data-rent-count="(\d+)" data-rent-value="(\d+)"/g)].map(match => [Number(match[1]), Number(match[2])]);
        const expected = ['railroad', color].flatMap(side => RENT_TABLE[side].map((value, index) => [index + 1, value]));
        assert.deepEqual(rows, expected);
        assert.doesNotMatch(html, /deal-fragment-|clipPath/);
    }
});
