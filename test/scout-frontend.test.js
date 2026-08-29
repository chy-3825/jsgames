const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/scout/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/scout/style.css', 'utf8');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('SCOUT 四类确认行动具备提交锁、处理中反馈和错误恢复', () => {
    assert.match(client, /model\.actionPending/);
    assert.match(client, /if \(model\.actionPending \|\| scene\.isPlaying\(\)\) return false/);
    assert.match(client, /model\.actionPending \? '处理中…' : '确认提交'/);
    assert.match(client, /model\.actionPending = false/);
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"/);
});

test('SCOUT 规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(client, /createModalController\(/);
    assert.match(client, /rulesModal\.trapFocus/);
});

test('SCOUT 非行动阶段仍可用键盘阅读公开节目两端', () => {
    assert.match(client, /class="sc-active-card"[^>]*tabindex="0"[^>]*role="img"/);
    assert.match(client, /aria-label="当前节目第/);
    assert.match(style, /\.sc-active-card:focus-visible/);
});

test('SCOUT 短横屏保留公开节目、私密手牌和操作区', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"status status" "show hand" "show command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('SCOUT 九种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'scout'/);
    assert.match(fixture, /scout: \['\.sc-show-board', '\.sc-hand-panel', '\.sc-command'\]/);
    for (const scenario of ['orientation', 'show', 'beat', 'scout', 'scout-show', 'duel', 'settlement', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('SCOUT 播报覆盖第一轮开场并在终局标题写明冠军', () => {
    assert.match(client, /巡回演出正式开幕/);
    assert.match(client, /起始标记由/);
    assert.match(client, /const winnerNames = .*filter\(player => winners\.has\(player\.id\)\)/);
    assert.match(client, /成为今晚的马戏之星/);
    assert.match(client, /并列摘下马戏桂冠/);
});
