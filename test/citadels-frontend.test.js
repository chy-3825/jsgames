const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'cards.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/citadels/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/citadels/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('富饶之城所有行动具备提交锁、处理中反馈和错误恢复', () => {
    assert.match(client, /actionPending: false/);
    assert.match(client, /model\.actionPending/);
    assert.match(client, /model\.actionPending \? '处理中…' : label/);
    assert.match(client, /model\.actionPending = false;[\s\S]*showError/);
    assert.match(client, /data-role="errorBanner"[^>]*role="alert"/);
});

test('富饶之城规则弹层隔离背景、限定焦点并归还焦点', () => {
    const modal = fs.readFileSync('public/games/common/modal.js', 'utf8');
    assert.match(client, /createModalController/);
    assert.match(modal, /function trapFocus\(/);
    assert.match(modal, /child\.inert = open && child !== overlay/);
    assert.match(modal, /returnFocus/);
    assert.match(client, /data-role="rulesOverlay"[^>]*aria-hidden="true"/);
});

test('富饶之城短横屏同时保留当前操作、城市和手牌', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"command stage"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('富饶之城九种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'citadels'/);
    assert.match(fixture, /citadels: \['\.citadels-command', '\.citadels-stage'\]/);
    for (const scenario of ['draft', 'resource', 'draw', 'build', 'ability', 'warlord', 'graveyard', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('富饶之城播报覆盖每轮选角开场、无人应答与皇冠转移', () => {
    assert.match(client, /event\.kind === 'roleDraftStart'/);
    assert.match(client, /率先选择角色/);
    assert.match(client, /本轮明置角色/);
    assert.match(client, /event\.kind === 'roleUnanswered'/);
    assert.match(client, /无人应答/);
    assert.match(client, /event\.kind === 'crownAcquired'/);
    assert.match(client, /取得皇冠/);
});
