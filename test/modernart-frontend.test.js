const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/modernart/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/modernart/style.css', 'utf8');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('现代艺术提交后保留报价或作品方案并锁定全部控件', () => {
    assert.match(client, /if \(model\.actionPending \|\| model\.presentationPlaying\) return/);
    assert.match(client, /model\.actionPending = true;\s*renderer\.clearError\(\);\s*send\([\s\S]*?renderer\.render\(\)/);
    assert.match(client, /button:not\(\[data-ui="skipPresentation"\]\), input, select/);
    assert.match(client, /aria-busy/);
});

test('现代艺术操作错误使用持续可访问告警并恢复操作', () => {
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"[^>]*aria-live="assertive"/);
    assert.match(client, /function showError\(message\)/);
    assert.match(client, /model\.actionPending = false;\s*renderer\.showError\(message\.message \|\| '操作失败'\)/);
    assert.match(style, /\.art-error-banner\.is-hidden/);
});

test('现代艺术规则对话框隔离背景、限定焦点并恢复触发点', () => {
    assert.match(client, /function trapRulesFocus\(/);
    assert.match(client, /child\.inert = child !== overlay/);
    assert.match(client, /setAttribute\('aria-hidden', 'false'\)/);
    assert.match(client, /previousFocus\?\.focus\?\.\(\)/);
});

test('现代艺术短横屏保留行情、中央拍卖台和手牌决策', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"status status" "artists artists" "showroom hand"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('现代艺术十二种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'modernart'/);
    assert.match(fixture, /modernart: \['\.art-status', '\.art-auction', '\.art-hand'\]/);
    for (const scenario of ['selection', 'double-offer', 'mystery', 'open', 'once', 'sealed', 'fixed', 'double', 'presentation', 'hammer', 'settlement', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('现代艺术播报覆盖第一季开幕并在终局标题写明冠军', () => {
    assert.match(client, /现代艺术拍卖季开幕/);
    assert.match(client, /本局启用神秘作品席位/);
    assert.match(client, /具体手牌与现金保持私密/);
    assert.match(client, /const winnerNames = .*filter\(player => winners\.has\(player\.id\)\)/);
    assert.match(client, /赢得现代艺术拍卖季/);
    assert.match(client, /共享年度收藏家桂冠/);
    assert.match(style, /\.art-season-hands/);
});
