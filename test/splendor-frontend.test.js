const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/splendor/client.js', 'utf8');
const template = fs.readFileSync('public/games/splendor/template.js', 'utf8');
const actions = fs.readFileSync('public/games/splendor/actions.js', 'utf8');
const render = fs.readFileSync('public/games/splendor/render.js', 'utf8');
const scene = fs.readFileSync('public/games/splendor/scene.js', 'utf8');
const style = fs.readFileSync('public/games/splendor/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('璀璨宝石规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(client, /createModalController/);
    assert.match(template, /data-role="rules"[^>]*aria-hidden="true"/);
});

test('璀璨宝石普通交易演出也能跳过', () => {
    assert.match(template, /data-action="skipPresentation"/);
    assert.match(actions, /stopPresentation/);
    assert.match(style, /\.sp-presentation-layer\.is-active \.sp-presentation-skip\s*\{\s*display:\s*block/);
});

test('璀璨宝石非行动回合仍可聚焦阅读市场卡', () => {
    assert.match(render, /aria-disabled="\$\{!canAct\}"/);
    assert.match(render, /data-read-only="true"/);
    assert.match(actions, /data-card-select/);
});

test('璀璨宝石短横屏保留市场和当前交易', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"market command"/);
    assert.match(style, /height:\s*calc\(100svh\s*-\s*var\(--game-shell-offset/);
});

test('璀璨宝石六种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /gameType === 'splendor'/);
    assert.match(fixture, /splendor: \['\.sp-market-stage', '\.sp-command-panel'\]/);
    for (const scenario of ['tokens', 'card', 'return', 'noble', 'presentation', 'ended']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});

test('璀璨宝石终局播报明确宣布单人或并列胜者', () => {
    assert.match(scene, /const winnerNames = \(batch\.winners \|\| \[\]\)\.map/);
    assert.match(scene, /共享商会荣光/);
    assert.match(scene, /赢得宝石商会/);
    assert.match(scene, /<h2>\$\{escapeHtml\(winnerNames\)\}\$\{winners\.size > 1/);
});
