const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/manila/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/manila/style.css', 'utf8');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('马尼拉提交后保留确认摘要并锁定全部表单控件', () => {
    assert.match(client, /if \(model\.actionPending \|\| model\.presentationPlaying\) return/);
    assert.match(client, /model\.actionPending = true;\s*renderer\.clearError\(\);[\s\S]*?send\([\s\S]*?renderer\.render\(\)/);
    assert.match(client, /button:not\(\[data-ui="skipPresentation"\]\), input, select/);
    assert.match(client, /aria-busy/);
});

test('马尼拉操作错误使用持续可访问告警并恢复操作', () => {
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"[^>]*aria-live="assertive"/);
    assert.match(client, /function showError\(message\)/);
    assert.match(client, /model\.actionPending = false;\s*renderer\.showError\(message\.message \|\| '操作失败'\)/);
    assert.match(style, /\.mn-error-banner\.is-hidden/);
});

test('马尼拉规则对话框隔离背景、限定焦点并恢复触发点', () => {
    assert.match(client, /function trapRulesFocus\(/);
    assert.match(client, /child\.inert = child !== overlay/);
    assert.match(client, /setAttribute\('aria-hidden', 'false'\)/);
    assert.match(client, /previousFocus\?\.focus\?\.\(\)/);
});

test('马尼拉短横屏保留状态、行情、航线和决策区', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"status status" "market market" "routes command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('马尼拉十一种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'manila'/);
    assert.match(fixture, /manila: \['\.mn-status', '\.mn-routes', '\.mn-command'\]/);
    for (const scenario of ['auction', 'share', 'boats', 'placement', 'sailing', 'pilot', 'pirate-board', 'plunder', 'insurance', 'settlement', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('马尼拉播报覆盖航运季开幕、匿名贷款、终局线与明确冠军', () => {
    assert.match(client, /马尼拉航运季开幕/);
    assert.match(client, /event\.kind === 'loanTaken'/);
    assert.match(client, /event\.kind === 'loanRepaid'/);
    assert.match(client, /具体货物保持私密/);
    assert.match(client, /event\.kind === 'marketThresholdReached'/);
    assert.match(client, /航运季结束，商会开始最终清算/);
    assert.match(client, /赢得马尼拉商会/);
    assert.match(client, /共享马尼拉商会荣光/);
});
