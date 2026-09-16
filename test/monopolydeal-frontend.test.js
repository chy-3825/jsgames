const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/monopolydeal/client.js', 'utf8');
const presentation = fs.readFileSync('public/games/monopolydeal/presentation.js', 'utf8');
const scene = fs.readFileSync('public/games/monopolydeal/scene.js', 'utf8');
const render = fs.readFileSync('public/games/monopolydeal/render.js', 'utf8');
const state = fs.readFileSync('public/games/monopolydeal/state.js', 'utf8');
const template = fs.readFileSync('public/games/monopolydeal/template.js', 'utf8');
const style = ['style.css', 'choice.css', 'assets.css', 'interactions.css', 'scenes.css', 'responsive-scenes.css', 'responsive.css', 'table.css', 'records.css', 'stage.css', 'seats.css']
    .map(file => fs.readFileSync(`public/games/monopolydeal/${file}`, 'utf8')).join('\n');

test('大富翁纸牌由服务端时间轴驱动并按队列顺序播放', () => {
    assert.match(scene, /function enqueuePresentation\(/);
    assert.match(scene, /model\.presentationQueue\.push/);
    assert.match(scene, /function drainPresentations\(/);
    assert.match(scene, /PRESENTATION_FADE_MS/);
    assert.match(client, /createMonopolyDealPresentation/);
    assert.match(presentation, /localizePresentation/);
    assert.match(presentation, /scene\.enqueuePresentation/);
    assert.doesNotMatch(client, /takeoverResolved/);
    assert.match(scene, /物业接管生效/);
    assert.match(style, /\.deal-takeover-mark/);
});

test('双倍租金当前牌不会在中央叠牌中重复渲染', () => {
    assert.match(render, /const currentIsDoubleRent = interaction\.card\?\.action === 'doubleRent'/);
    assert.match(render, /interaction\.doubleRentCount[^;]+- \(currentIsDoubleRent \? 1 : 0\)/);
    assert.match(render, /length: supportDoubleRentCount/);
});

test('大富翁纸牌胜利画面说明第三组地产的来源', () => {
    for (const source of ['物业接管', '强制交易', '盗取', '资产支付']) assert.match(state, new RegExp(source));
    assert.match(scene, /致胜行动/);
    assert.match(style, /\.deal-victory-source/);
    assert.match(scene, /您已获胜/);
});

test('大富翁纸牌使用长桌席位、资产浮窗和退出牌库汇总', () => {
    const actions = fs.readFileSync('public/games/monopolydeal/actions.js', 'utf8');
    assert.match(render, /deal-property-stroke/);
    assert.match(render, /deal-seat-identity/);
    assert.match(render, /deal-seat-bank/);
    assert.match(render, /deal-seat-assets/);
    assert.match(render, /deal-seat-progress/);
    assert.match(render, /is-progress-\$\{progressLevel\}/);
    assert.match(render, /\$\{completed\}\/3/);
    assert.doesNotMatch(render, /<small>完成组<\/small>/);
    assert.doesNotMatch(render, /deal-seat-presence|deal-seat-me|>在线<|>离线</);
    assert.match(render, /data-asset-bank[^>]*aria-label/);
    assert.match(render, /data-asset-properties[^>]*role="list"/);
    assert.match(render, /data-target-id[^>]*aria-label[^>]*aria-pressed/);
    assert.doesNotMatch(render, /deal-seat-summary|deal-opponent-copy|deal-opponent-bank|deal-opponent-sets/);
    assert.doesNotMatch(render, /openPlayerDetails|playerDetails/);
    assert.match(render, /filter\(player => player\.id !== value\.myId\)/);
    assert.match(template, /已退出循环/);
    assert.match(template, /deal-record-header/);
    assert.match(template, /deal-record-retired/);
    assert.match(template, /<div class="deal-record-history" aria-label="最近行动摘要">/);
    assert.equal((template.match(/data-action="openArchive"/g) || []).length, 2);
    assert.equal((template.match(/data-action="openArchive" data-archive="history"/g) || []).length, 1);
    assert.doesNotMatch(style, /\.deal-record-history:hover|\.deal-record-history:focus-visible/);
    assert.match(template, /data-action="openArchive" data-archive="retired"/);
    assert.match(template, /data-role="archiveOverlay"/);
    for (const shellPart of ['deal-table-inner', 'deal-stage', 'deal-intel', 'deal-self-seat']) assert.match(template, new RegExp(shellPart));
    assert.match(template, /class="deal-court-deck"/);
    assert.doesNotMatch(template, /deal-court-deck deal-draw/);
    assert.match(template, /class="deal-deck-stack" data-action="drawCards"/);
    assert.doesNotMatch(template, /deal-draw-button/);
    assert.doesNotMatch(template, /data-role="deck"/);
    assert.doesNotMatch(template, /data-role="deckCount"/);
    assert.doesNotMatch(template, /循环牌库|剩余牌/);
    assert.doesNotMatch(template, /data-ui="discard"/);
    assert.doesNotMatch(template, /deal-treasury/);
    assert.doesNotMatch(template, /deal-command-info/);
    assert.match(style, /\.deal-cards\s*\{[^}]*grid-template-columns:\s*repeat\(10/);
    assert.doesNotMatch(render, /deal-hidden-hand/);
    assert.doesNotMatch(render, /手牌 \$\{player\.handCount/);
    assert.match(render, /function renderArchive\(/);
    assert.match(render, /MONEY_DENOMINATIONS = \[1, 2, 3, 4, 5, 10\]/);
    assert.match(render, /function moneyDenominations\(player\)/);
    assert.match(render, /deal-money-denomination/);
    assert.match(render, /function assetPropertyGroupMarkup\(/);
    assert.match(render, /deal-asset-property-stack/);
    assert.match(render, /data-move-card-id=/);
    assert.match(actions, /function beginPropertyMove\(/);
    assert.doesNotMatch(template, /deal-my-properties|ledgerOverlay/);
    assert.doesNotMatch(render, /function renderProperties\(|function renderLedger\(/);
    assert.match(style, /deal-asset-property-card[\s\S]*margin-left:\s*-43px/);
    assert.match(state, /hoveredCardIndex:\s*null/);
    assert.match(actions, /function handlePointerOver\(/);
    assert.match(actions, /function handlePointerOut\(/);
    assert.match(client, /mount\.addEventListener\('mouseover', actions\.handlePointerOver/);
    assert.match(render, /model\.selected \?\? model\.hoveredCardIndex/);
    assert.match(render, /function renderCardPreview\(/);
    assert.match(render, /function renderRecentPlay\(/);
    assert.match(render, /value\.lastPlayedCard\?\.card/);
    assert.match(render, /最近出牌/);
    assert.match(render, /准备出牌/);
    assert.match(render, /最近出牌/);
    assert.match(render, /deal-hand-card-face/);
    assert.match(render, /animateAssetCollection/);
    assert.match(render, /showTurnToast/);
    assert.match(render, /确认颜色并选择玩家/);
    assert.match(actions, /action === 'playRent'/);
    assert.match(actions, /pickedCard\?\.kind !== 'rent'/, '选择收租目标时不能清掉已选颜色/地产组');
    assert.doesNotMatch(presentation, /stagedAsset|assetStages/, '资产状态不应等到下一次出牌才显示');
    assert.match(presentation, /renderer\.currentTableCardRect\?\.\(\)/, '新资产应在本次渲染后立即播放归位动画');
    assert.match(presentation, /assetAnimationQueue/);
    assert.match(presentation, /drainAssetCollections/);
    assert.match(render, /flatMap\(player => \(player\.bank \|\| \[\]\)\.map/);
    assert.match(render, /actionHistory/);
    assert.match(render, /deal-archive-card-art/);
    assert.match(template, /<small>您的回合<\/small><strong>开始您的交易<\/strong>/);
    assert.match(render, /actionHint\(card\)/);
    assert.match(render, /<strong>\$\{escapeHtml\(copy\.title\)\}<\/strong><p>\$\{escapeHtml\(copy\.detail\)\}/);
    assert.match(render, /资产不足时交出全部资产/);
    assert.match(render, /\$\{cardName\}\$\{actionLives \? '重新生效' : '暂时取消'\}/);
    assert.match(style, /FINAL CENTRAL STAGE[\s\S]*grid-template-columns:\s*minmax\(0, 42fr\) minmax\(0, 58fr\)[\s\S]*gap:\s*4px 0/);
    assert.match(style, /Canonical central-stage placement[\s\S]*\.deal-event\.is-card-preview[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(style, /Canonical central-stage placement[\s\S]*\.deal-event\.is-card-preview[\s\S]*justify-self:\s*stretch[\s\S]*width:\s*100%/);
    assert.match(style, /\.deal-event\s*>\s*\.deal-card-preview[\s\S]*grid-column:\s*1[\s\S]*justify-self:\s*stretch[\s\S]*width:\s*100%/);
    assert.match(style, /\.deal-preview-card-shell,[\s\S]*place-items:\s*center end/);
    assert.match(style, /\.deal-preview-card-shell,[\s\S]*padding-right:\s*12px/);
    assert.match(style, /\.deal-preview-copy,[\s\S]*padding:\s*12px 0 12px 20px/);
    assert.match(style, /\.deal-event > \.deal-event-idle\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(style, /\.deal-event-idle > div\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/);
    assert.match(style, /\.deal-opponent \.deal-seat-layout[\s\S]*grid-template-areas:\s*"identity progress"\s*"assets assets"/);
    assert.match(style, /\.deal-opponent \.deal-seat-layout[\s\S]*grid-template-rows:\s*45px minmax\(0, 1fr\)/);
    assert.match(style, /\.deal-opponent,\s*\.deal-self-seat-card\s*\{[\s\S]*height:\s*104px;[\s\S]*min-height:\s*104px;/);
    assert.match(style, /\.deal-seat-progress > b[\s\S]*font:\s*700 17px/);
    for (const level of [1, 2, 3]) assert.match(style, new RegExp(`\\.deal-seat-progress\\.is-progress-${level} > b`));
    assert.doesNotMatch(render, /<small>银行<\/small>/);
    assert.match(render, /deal-property-slot-fill/);
    assert.match(style, /\.deal-seat-properties \.deal-property-slot[\s\S]*border:\s*1px[\s\S]*var\(--property-color\)/);
    assert.match(style, /\.deal-seat-properties\s*\{[\s\S]*grid-template-columns:\s*repeat\(4/);
    assert.match(style, /\.deal-opponent::after,\s*\.deal-self-seat-card::after\s*\{[\s\S]*inset:\s*-4px/);
    assert.match(style, /\.deal-opponent\.is-current::after,[\s\S]*border-color:\s*rgba\(239, 209, 142, \.82\)/);
    assert.doesNotMatch(style, /deal-seat-name::after[\s\S]*content:\s*"当前"/);
    assert.match(style, /short landscape viewports[\s\S]*\.deal-opponent,\s*\.deal-self-seat-card \{ height:\s*72px; min-height:\s*72px; \}/);
    assert.match(style, /deal-deck-stack img[\s\S]*top:\s*-2\.9%[\s\S]*left:\s*-4\.35%/);
    assert.doesNotMatch(actions, /inspectedPlayerId|openPlayerDetails|playerDetails/);
    assert.match(actions, /archiveModal\?\.trapFocus/);
    assert.match(client, /createModalController\(\{ root: mount\.querySelector\('\.deal-game'\), overlay: getElement\('archiveOverlay'/);
    assert.match(presentation, /event\.kind !== 'finalSettlement'/);
    assert.doesNotMatch(style, /\.deal-(?:layout|center|treasury|timeline|intel-header|retired-column|discard-stack|supply-copy|event-sigil|event-copy|draw-button)\b/);
});

test('大富翁纸牌资源版本保持单一并完整登记样式层', () => {
    const index = fs.readFileSync('public/index.html', 'utf8');
    const script = fs.readFileSync('public/script.js', 'utf8');
    const manifest = fs.readFileSync('public/games/common/game-manifest.js', 'utf8');
    const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');
    const version = script.match(/const ASSET_VERSION = '([^']+)'/)?.[1];
    assert.ok(version);
    assert.match(index, new RegExp(`script\\.js\\?v=${version}`));
    assert.match(script, new RegExp(`game-manifest\\.js\\?v=${version}`));
    assert.match(client, new RegExp(`game-manifest\\.js\\?v=${version}`));
    for (const file of ['style', 'choice', 'assets', 'interactions', 'scenes', 'responsive-scenes', 'responsive', 'table', 'records', 'stage', 'seats']) {
        assert.match(manifest, new RegExp(`monopolydeal/${file}\\.css', '${version}`));
        assert.match(fixture, new RegExp(`monopolydeal/${file}\\.css\\?v=${version}`));
    }
});

test('大富翁纸牌底部手牌栏不会继承旧版操作面板的垂直偏移', () => {
    assert.match(style, /\.deal-command\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;/);
});

test('大富翁纸牌资产弹窗中的每个地产颜色固定占半行', () => {
    assert.match(style, /\.deal-asset-property-groups\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.deal-asset-property-groups\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('角色框资产区仅显示已有地产颜色的半行无字进度条', () => {
    assert.match(render, /COLORS\.filter\(color =>[\s\S]*\.map\(color =>/);
    assert.match(render, /deal-property-slot-fill/);
    assert.match(render, /hasHouse[\s\S]*hasHotel[\s\S]*has-house[\s\S]*has-hotel/);
    assert.match(style, /\.deal-seat-properties\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(style, /\.deal-seat-properties\.is-crowded\s*\{[^}]*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(render, /colorCount > 8 \? 'is-crowded'/);
    assert.match(render, /data-color-count="\$\{colorCount\}"/);
    assert.match(render, /style="width:\$\{Math\.min\(1, count \/ size\) \* 100\}%"/);
    assert.match(style, /\.deal-property-slot-fill[\s\S]*background:\s*var\(--property-color\)/);
    assert.match(style, /\.deal-seat-properties \.deal-property-slot[\s\S]*background:\s*color-mix\(in srgb, var\(--property-color\) 24%/);
    assert.match(style, /\.deal-property-slot-fill[\s\S]*min-width:\s*6px/);
    assert.match(render, /class="deal-property-stroke deal-property-slot/);
    assert.match(style, /\.deal-seat-properties \.deal-property-slot\.has-house\s*\{[^}]*box-shadow:\s*inset 0 0 0 \.5px #fff, 0 0 0 1px #65bd8c, 0 0 0 1\.5px #fff/);
    assert.match(style, /\.deal-seat-properties \.deal-property-slot\.has-hotel\s*\{[^}]*box-shadow:\s*inset 0 0 0 \.5px #fff, 0 0 0 1px #65bd8c, 0 0 0 2px #d85a4f, 0 0 0 2\.5px #fff/);
});
