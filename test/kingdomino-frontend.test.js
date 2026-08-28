const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/kingdomino/client.js', 'utf8');
const template = fs.readFileSync('public/games/kingdomino/template.js', 'utf8');
const actions = fs.readFileSync('public/games/kingdomino/actions.js', 'utf8');
const render = fs.readFileSync('public/games/kingdomino/render.js', 'utf8');
const scene = fs.readFileSync('public/games/kingdomino/scene.js', 'utf8');
const style = fs.readFileSync('public/games/kingdomino/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('多米诺王国规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(client, /createModalController/);
    assert.match(template, /data-role="rules"[^>]*aria-hidden="true"/);
});

test('多米诺王国普通行动演出也能跳过', () => {
    assert.match(template, /data-action="skipPresentation"/);
    assert.match(actions, /stopPresentation/);
    assert.match(style, /\.kd-presentation-layer\.is-active \.kd-presentation-skip\s*\{\s*display:\s*block/);
});

test('多米诺王国非行动回合仍可聚焦阅读公开领地', () => {
    assert.match(render, /aria-disabled="\$\{!canSelect\}"/);
    assert.match(render, /data-read-only="true"/);
    assert.match(actions, /data-domino-id/);
});

test('多米诺王国短横屏保留操作、公开领地和完整棋盘', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"command board"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('多米诺王国七种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'kingdomino'/);
    assert.match(fixture, /kingdomino: \['\.kd-command-column', '\.kd-kingdom-stage'\]/);
    for (const scenario of ['draft', 'place-start', 'place-preview', 'discard', 'duel', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('多米诺王国播报覆盖开局、无人认领领地与明确胜者', () => {
    assert.match(scene, /event\.kind === 'gameStart'/);
    assert.match(scene, /王国建设开始/);
    assert.match(scene, /event\.kind === 'unclaimedDomino'/);
    assert.match(scene, /号领地无人认领/);
    assert.match(scene, /成为王国霸主/);
});
