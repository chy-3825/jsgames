const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/acquire/${file}`, 'utf8')).join('\n');
const style = ['style.css', 'board.css', 'rail.css', 'scenes.css']
    .map(file => fs.readFileSync(`public/games/acquire/${file}`, 'utf8')).join('\n');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('并购所有行动具备提交锁和持久错误反馈', () => {
    assert.match(client, /actionPending: false/);
    assert.match(client, /if \(model\.actionPending\) return false/);
    assert.match(client, /model\.actionPending = false;[\s\S]*showError/);
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"/);
});

test('并购规则与决策弹层隔离背景、限定焦点并归还焦点', () => {
    const modal = fs.readFileSync('public/games/common/modal.js', 'utf8');
    assert.match(client, /createModalController/);
    assert.match(modal, /function trapFocus\(/);
    assert.match(modal, /child\.inert = open && child !== overlay/);
    assert.match(modal, /returnFocus/);
    assert.match(client, /aria-hidden="true"/);
});

test('并购全部公共行动演出均可跳过', () => {
    assert.match(client, /data-action="skipPresentation"/);
    assert.match(style, /\.acquire-presentation-layer\.is-active \.acquire-presentation-skip\s*\{\s*display:\s*block/);
});

test('并购短横屏同时保留操作区、版图和手牌', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"command stage" "rail stage"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('并购七种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'acquire'/);
    assert.match(fixture, /acquire: \['\.acquire-command', '\.acquire-stage'\]/);
    for (const scenario of ['place', 'foundation', 'merger', 'settlement', 'buy', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('并购播报覆盖开局、安全集团、逐集团终局清算与明确胜者', () => {
    assert.match(client, /event\.kind === 'startSetup'/);
    assert.match(client, /取得先手/);
    assert.match(client, /event\.kind === 'safeChain'/);
    assert.match(client, /成为安全集团/);
    assert.match(client, /for \(const settlement of event\.chainSettlements \|\| \[\]\)/);
    assert.match(client, /集团封账/);
    assert.match(client, /赢得并购/);
});
