const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/splendor/client.js', 'utf8');
const template = fs.readFileSync('public/games/splendor/template.js', 'utf8');
const actions = fs.readFileSync('public/games/splendor/actions.js', 'utf8');
const render = fs.readFileSync('public/games/splendor/render.js', 'utf8');
const cards = fs.readFileSync('public/games/splendor/cards.js', 'utf8');
const scene = fs.readFileSync('public/games/splendor/scene.js', 'utf8');
const style = fs.readFileSync('public/games/splendor/style.css', 'utf8');
const table = fs.readFileSync('public/games/splendor/table.css', 'utf8');
const responsive = fs.readFileSync('public/games/splendor/responsive.css', 'utf8');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('璀璨宝石规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(client, /createModalController/);
    assert.match(template, /data-role="rules"[^>]*aria-hidden="true"/);
});

test('璀璨宝石普通交易演出也能跳过', () => {
    assert.match(template, /data-action="skipPresentation"/);
    assert.match(actions, /stopPresentation/);
    assert.match(style, /\.sp-presentation-layer\.is-active \.sp-presentation-skip\s*\{\s*display:\s*block/);
});

test('璀璨宝石非行动回合仍可聚焦阅读市场卡', () => {
    assert.match(render, /aria-disabled="\$\{!canAct\}"/);
    assert.match(render, /data-read-only="true"/);
    assert.match(actions, /data-card-select/);
});

test('璀璨宝石牌面统一为可读的纵向信息组件', () => {
    assert.match(cards, /export function cardFaceMarkup/);
    assert.match(cards, /loading="\$\{loading\}"/);
    assert.match(cards, /sp-card-veil/);
    assert.match(cards, /cardAccessibleLabel/);
    assert.match(render, /sp-selected-card/);
});

test('璀璨宝石卡图资源统一为无白边成品并由外框负责裁切', () => {
    for (let index = 1; index <= 8; index += 1) {
        assert.equal(fs.existsSync(`public/assets/bgg/splendor/card-art-${index}.jpg`), true);
    }
    assert.match(cards, /splendor\/card-art-\$\{/);
    assert.match(table, /--sp-card-radius:\s*10px/);
    assert.match(table, /\.sp-card-face\s*\{[\s\S]*border-radius:\s*0/);
});

test('璀璨宝石桌面卡组限制宽度并拉开卡间距，避免两侧留白失衡', () => {
    assert.match(table, /max-width:\s*700px/);
    assert.match(table, /margin-inline:\s*auto/);
    assert.match(table, /column-gap:\s*clamp\(20px, 1\.8vw, 26px\)/);
    assert.match(responsive, /@media \(max-width: 900px\) and \(orientation: landscape\)[\s\S]*?gap:\s*8px/);
});

test('璀璨宝石桌面列宽保持左大右舒展且 1040px 断点不留空轨道', () => {
    assert.match(table, /grid-template-columns:\s*minmax\(0, 1fr\) clamp\(340px, 32vw, 460px\)/);
    assert.match(table, /justify-content:\s*center/);
    assert.match(responsive, /@media \(max-width: 1040px\)/);
    assert.match(responsive, /grid-template-areas:\s*"market" "command" "guild" "rail"/);
});

test('璀璨宝石市场支持等级切换与行动模式切换', () => {
    assert.match(template, /data-role="tierTabs"/);
    assert.match(render, /data-tier-tab/);
    assert.match(render, /data-action="showTokenAction"/);
    assert.match(render, /data-action="showCardAction"/);
    assert.match(actions, /model\.activeTier/);
    assert.match(actions, /clearCard/);
});

test('璀璨宝石短横屏保留市场和当前交易', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"market command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('璀璨宝石六种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'splendor'/);
    assert.match(fixture, /splendor: \['\.sp-market-stage', '\.sp-command-panel'\]/);
    for (const scenario of ['tokens', 'card', 'return', 'noble', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('璀璨宝石终局播报明确宣布单人或并列胜者', () => {
    assert.match(scene, /const winnerNames = \(batch\.winners \|\| \[\]\)\.map/);
    assert.match(scene, /共享商会荣光/);
    assert.match(scene, /赢得宝石商会/);
    assert.match(scene, /<h2>\$\{escapeHtml\(winnerNames\)\}\$\{winners\.size > 1/);
});
