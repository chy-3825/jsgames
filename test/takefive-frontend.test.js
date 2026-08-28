const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/takefive/client.js', 'utf8');
const actions = fs.readFileSync('public/games/takefive/actions.js', 'utf8');
const render = fs.readFileSync('public/games/takefive/render.js', 'utf8');
const scene = fs.readFileSync('public/games/takefive/scene.js', 'utf8');
const template = fs.readFileSync('public/games/takefive/template.js', 'utf8');
const state = fs.readFileSync('public/games/takefive/state.js', 'utf8');
const style = fs.readFileSync('public/games/takefive/style.css', 'utf8');
const fixture = fs.readFileSync('public/__game_shell_visual_test.html', 'utf8');

test('牛头王选行失败后完整重绘并恢复确认操作', () => {
    assert.match(client, /if \(message\.type === 'error'\)[\s\S]*model\.rowChoiceSubmitting = false;[\s\S]*renderer\.render\(\);/);
});

test('牛头王结算榜保留到玩家主动继续', () => {
    assert.match(template, /data-ui="skipSettlement"[^>]*>继续</);
    assert.match(scene, /function showSettlement\(settlement\)/);
    assert.match(scene, /sceneTimer = 0;/);
    assert.match(template, /data-ui="skipSettlement"/);
    assert.doesNotMatch(scene, /setTimeoutRef\(hideSettlement/);
});

test('牛头王规则弹层隔离背景、限定焦点并归还焦点', () => {
    assert.match(client, /createModalController\(/);
    assert.match(client, /rulesModal/);
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(template, /data-role="rules"[^>]*aria-hidden="true"/);
});

test('牛头王逐牌结算动画可以直接跳到最终牌面', () => {
    assert.match(render, /data-ui="skipResolution"/);
    assert.match(scene, /function skipResolutionPresentation\(/);
    assert.match(scene, /presentationWaiters\.clear\(\)/);
    assert.match(scene, /rowChoiceReady = true/);
});

test('牛头王入口只负责协议与生命周期，动态职责按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('takefive'\)/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /loadStyles\(/);
    assert.match(client, /styleHandle\.release\(\)/);
    assert.match(client, /createTakeFiveTemplate\(/);
    assert.match(client, /createTakeFiveRenderer\(/);
    assert.match(client, /createTakeFiveScene\(/);
    assert.match(client, /createTakeFiveActions\(/);
    assert.ok(client.split('\n').length < 180, '入口不应重新堆回大段渲染与演出代码');
    assert.match(actions, /send\(\{ type: 'gameAction'/);
    assert.match(render, /function renderRows\(/);
    assert.match(scene, /function runResolutionPresentation\(/);
    assert.match(state, /createTakeFiveModel\(/);
});

test('牛头王短横屏和十人关键状态纳入视觉验收', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /grid-template-areas:\s*"board hand"/);
    assert.match(fixture, /takefive: \['\.tf-board', '\.tf-hand-panel'\]/);
    for (const scenario of ['select', 'locked', 'settlement']) assert.match(fixture, new RegExp(`['"]${scenario}['"]`));
});
