const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/camelup/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/camelup/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('狂野骆驼提交后保留行动摘要并锁定全部控件', () => {
    assert.match(client, /if \(model\.actionPending \|\| !action\) return/);
    assert.match(client, /model\.actionPending = true;\s*renderer\.clearError\(\);\s*renderer\.render\(\);\s*send/);
    assert.match(client, /button:not\(\[data-ui="skipPresentation"\]\), input, select/);
    assert.match(client, /aria-busy/);
});

test('狂野骆驼操作错误使用持续可访问告警并恢复原方案', () => {
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"[^>]*aria-live="assertive"/);
    assert.match(client, /function showError\(message\)/);
    assert.match(client, /model\.actionPending = false;\s*renderer\.showError\(message\.message \|\| '操作失败'\)/);
    assert.match(style, /\.cm-error-banner\.is-hidden/);
});

test('狂野骆驼规则对话框隔离背景、限定焦点并恢复触发点', () => {
    assert.match(client, /function trapRulesFocus\(/);
    assert.match(client, /child\.inert = child !== overlay/);
    assert.match(client, /setAttribute\('aria-hidden', 'false'\)/);
    assert.match(client, /previousFocus\?\.focus\?\.\(\)/);
});

test('狂野骆驼短横屏同时保留状态、十六格赛道和策略帐篷', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"status status" "track command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('狂野骆驼十三种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'camelup'/);
    assert.match(fixture, /camelup: \['\.cm-status', '\.cm-track', '\.cm-command'\]/);
    for (const scenario of ['ready', 'roll', 'leg-bet', 'overall-winner', 'overall-loser', 'tile-oasis', 'tile-mirage', 'die', 'move', 'secret', 'leg-settlement', 'reveal', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('狂野骆驼以全屏开赛赛况和明确的单人或共享冠军完成赛事', () => {
    assert.match(client, /event\.kind === 'raceStarted'/);
    assert.match(client, /沙漠大赛正式开始/);
    assert.match(client, /起跑骰已经揭晓/);
    assert.match(client, /cm-starting-stacks/);
    assert.match(client, /共享沙漠冠军/);
    assert.match(client, /赢得沙漠大赛/);
    assert.match(style, /\.cm-starting-stacks/);
});
