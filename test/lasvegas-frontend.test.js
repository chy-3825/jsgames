const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/lasvegas/${file}`, 'utf8')).join('\n');
const style = ['public/games/lasvegas/style.css', 'public/games/lasvegas/board.css', 'public/games/lasvegas/responsive.css', 'public/games/lasvegas/scenes.css']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');

test('拉斯维加斯掷骰与放置具备提交锁、处理中反馈和错误恢复', () => {
    assert.match(client, /model\.actionPending/);
    assert.match(client, /if \(presentationLocked\(\) \|\| model\.actionPending\) return false/);
    assert.match(client, /model\.actionPending \? '放置中…' : '确认放置'/);
    assert.match(client, /model\.actionPending = false;[\s\S]*showError/);
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"/);
});

test('拉斯维加斯规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(client, /createModalController/);
    assert.match(client, /rulesModal(?:\?\.)?trapFocus/);
    assert.match(client, /rulesModal\.setOpen\(false\)/);
    assert.match(client, /2 人局每人额外控制 4 枚中立骰/);
});

test('拉斯维加斯短横屏保留骰盘、六个选择与赌场概览', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('拉斯维加斯九种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'lasvegas'/);
    assert.match(fixture, /lasvegas: \['\.lv-command', '\.lv-casinos'\]/);
    for (const scenario of ['ready', 'rolled', 'selected', 'tie', 'neutral', 'settlement', 'standings', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('拉斯维加斯播报覆盖第一轮开桌并在终局标题写明胜者', () => {
    assert.match(client, /拉斯维加斯正式开桌/);
    assert.match(client, /本局启用.*枚中立骰/);
    assert.match(client, /const winnerNames = .*filter\(player => winners\.has\(String\(player\.id\)\)\)/);
    assert.match(client, /成为今晚的赌场之王/);
    assert.match(client, /并列称霸拉斯维加斯/);
});
