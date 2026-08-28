const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/hanabi/client.js', 'utf8');
const actions = fs.readFileSync('public/games/hanabi/actions.js', 'utf8');
const render = fs.readFileSync('public/games/hanabi/render.js', 'utf8');
const scene = fs.readFileSync('public/games/hanabi/scene.js', 'utf8');
const state = fs.readFileSync('public/games/hanabi/state.js', 'utf8');
const template = fs.readFileSync('public/games/hanabi/template.js', 'utf8');
const style = fs.readFileSync('public/games/hanabi/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('花火提示提交期间锁定目标和发送按钮并在响应后恢复', () => {
    assert.match(state, /submittingClue: false/);
    assert.match(actions, /model\.submittingClue = true;[\s\S]*renderCommand\(\);[\s\S]*kind: 'giveClue'/);
    assert.match(client, /model\.state = message\.state;[\s\S]*model\.submittingClue = false/);
    assert.match(client, /message\.type === 'error'[\s\S]*model\.submittingClue = false;[\s\S]*renderer\.render\(\)/);
});

test('花火规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(client, /createModalController\(/);
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(template, /data-role="rules"[^>]*aria-hidden="true"/);
});

test('花火非行动回合仍可聚焦阅读自己的提示知识', () => {
    assert.match(render, /aria-disabled="\$\{!selectable\}"/);
    assert.match(render, /data-read-only="true"/);
    assert.match(actions, /handCard && model\.state\.availableActions\?\.canPlay && !model\.submittingCardAction/);
    assert.doesNotMatch(render, /data-hand-card-id[^\n]+\$\{selectable \? '' : 'disabled'\}/);
    assert.match(style, /\.hb-hidden-card\[aria-disabled="true"\]/);
});

test('花火入口只负责协议与生命周期，视图和演出按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('hanabi'\)/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /loadStyles\(/);
    assert.match(client, /styleHandle\.release\(\)/);
    assert.match(client, /createHanabiTemplate\(/);
    assert.match(client, /createHanabiRenderer\(/);
    assert.match(client, /createHanabiScene\(/);
    assert.match(client, /createHanabiActions\(/);
    assert.ok(client.split('\n').length < 150, '入口不应重新堆回大段渲染与演出代码');
    assert.match(render, /function renderHand\(/);
    assert.match(scene, /function runPresentationQueue\(/);
});

test('花火六种关键状态纳入统一视觉验收', () => {
    assert.match(fixture, /params\.get\('hanabiState'\)/);
    for (const scenario of ['hand', 'clue-color', 'clue-value', 'presentation', 'final-round', 'ended']) {
        assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
    }
    assert.match(fixture, /hanabi: \['\.hb-command-panel', '\.hb-teammates-section', '\.hb-my-hand', '\.hb-hand-action-bar'\]/);
});
