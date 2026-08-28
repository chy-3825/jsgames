const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/magicalathlete/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/magicalathlete/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('胡闹运动会所有发送入口共用提交锁并在权威回包后恢复', () => {
    assert.match(client, /function submitAction\(action\)/);
    assert.match(client, /model\.actionPending = true;\s*clearError\(\);\s*renderer\.render\(\);\s*send/);
    assert.match(client, /model\.state = nextState;|model\.actionPending = false/);
    assert.match(client, /button:not\(\[data-ui="skipPresentation"\]\), input, select/);
    assert.match(client, /aria-busy/);
});

test('胡闹运动会操作错误使用持续可访问告警', () => {
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"[^>]*aria-live="assertive"/);
    assert.match(client, /showError\(message\)/);
    assert.match(client, /model\.actionPending = false;\s*renderer\.showError\(message\.message \|\| '操作失败'\)/);
    assert.match(style, /\.ma-error-banner\.is-hidden/);
});

test('胡闹运动会规则对话框隔离背景、限定焦点并恢复触发点', () => {
    assert.match(client, /function trapRulesFocus\(/);
    assert.match(client, /child\.inert = child !== overlay/);
    assert.match(client, /setAttribute\('aria-hidden', String\(!open\)\)/);
    assert.match(client, /previousFocus\?\.focus\?\.\(\)/);
});

test('胡闹运动会短横屏同时保留积分、三十格赛道和当前决策', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"status status" "race command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('胡闹运动会十六种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'magicalathlete'/);
    assert.match(fixture, /magicalathlete: \['\.ma-status', '\.ma-race', '\.ma-command'\]/);
    for (const scenario of ['draft', 'race-select', 'race', 'tripped', 'acknowledgement', 'private-pick', 'target', 'ability', 'reroll', 'genius', 'lineup', 'roll-presentation', 'ability-presentation', 'elimination', 'settlement', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('胡闹运动会播报覆盖开幕、每轮选角、秘密阵容阶段和明确冠军', () => {
    for (const kind of ['tournamentStarted', 'draftRoundStarted', 'raceSelectionStarted']) assert.match(client, new RegExp(`event\\.kind === '${kind}'`));
    assert.match(client, /胡闹运动会开幕/);
    assert.match(client, /共享总冠军/);
    assert.match(client, /赢得总冠军/);
    assert.doesNotMatch(client, /nextRaceStarted/);
    assert.match(style, /\.ma-draft-pool-preview/);
});
