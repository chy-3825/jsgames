const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const client = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(path.join(root, 'public/games/coup', file), 'utf8')).join('\n');
const css = ['style.css', 'private.css', 'scenes.css', 'responsive.css']
    .map(file => fs.readFileSync(path.join(root, 'public/games/coup', file), 'utf8')).join('\n');
const visualFixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

test('政变模态弹层具备焦点限定、恢复和背景隔离', () => {
    assert.match(client, /function trapOverlayFocus\(/);
    assert.match(client, /overlayReturnFocus/);
    assert.match(client, /child\.inert = Boolean\(active && child !== active\)/);
    assert.match(client, /if \(open\) focusOverlay\(overlay\)/);
});

test('政变禁用行动原因对触屏和读屏用户可见', () => {
    assert.match(client, /class="cp-action-reason"/);
    assert.match(client, /aria-describedby="cp-action-reason-/);
    assert.match(css, /\.cp-action-reason\s*\{/);
    assert.match(client, /金币不足：需要/);
});

test('政变视觉验收覆盖普通回合、质疑、失去影响力和大使交换', () => {
    for (const scenario of ['turn', 'challenge', 'loss', 'exchange']) {
        assert.match(visualFixture, new RegExp(`['\"]${scenario}['\"]`));
    }
    assert.match(visualFixture, /coupScenarioFits/);
    assert.match(visualFixture, /\.cp-exchange-dialog/);
    assert.match(visualFixture, /\.cp-loss-panel > \.cp-private-choice-row \[data-loss-index\]/);
});

test('政变未公开影响力必须按住查看，必要选择改用独立编号按钮', () => {
    assert.match(client, /data-identity-hold/);
    assert.match(client, /setPrivateIdentityVisible\(true\)/);
    assert.match(client, /handleIdentityPointerEnd/);
    assert.match(client, /handleIdentityVisibilityChange/);
    assert.match(client, /privateIdentity: true/);
    assert.match(client, /class="cp-private-choice-button" data-loss-index/);
    assert.match(client, /data-exchange-index/);
    assert.match(css, /\.cp-private-card-cover/);
    assert.match(css, /\.cp-app\.is-identity-revealed \.cp-private-card-cover/);
    assert.match(css, /\.cp-private-card-cover\s*\{[\s\S]*?transition:\s*none/);
});

test('政变全屏播报覆盖行动、质疑、阻挡、出局和独立终局', () => {
    assert.match(client, /type: 'declaration'/);
    assert.match(client, /type: 'verdict'/);
    assert.match(client, /type: 'block'/);
    assert.match(client, /type: 'victory'/);
    assert.match(client, /interaction\.kind === 'coup' \|\| interaction\.kind === 'assassinate'/);
    assert.match(client, /质疑成立，原行动取消/);
    assert.match(client, /阻挡被推翻，原行动将继续/);
    assert.match(client, /if \(!previous\.gameOver && next\.gameOver\) scenes\.push\(\{ type: 'victory'/);
    assert.doesNotMatch(client, /scene\.winner \? `<div class="cp-scene-victory/);
    assert.match(css, /\.cp-scene-layer\.is-verdict\.is-proved/);
    assert.match(css, /\.cp-scene-verdict-mark/);
});
