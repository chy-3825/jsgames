const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/loveletter/client.js', 'utf8');
const actions = fs.readFileSync('public/games/loveletter/actions.js', 'utf8');
const render = fs.readFileSync('public/games/loveletter/render.js', 'utf8');
const scene = fs.readFileSync('public/games/loveletter/scene.js', 'utf8');
const state = fs.readFileSync('public/games/loveletter/state.js', 'utf8');
const template = fs.readFileSync('public/games/loveletter/template.js', 'utf8');
const style = fs.readFileSync('public/games/loveletter/style.css', 'utf8');

test('情书入口只负责协议与生命周期，界面和演出按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('loveletter'\)/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /loadStyles\(/);
    assert.match(client, /styleHandle\.release\(\)/);
    assert.match(client, /createLoveLetterTemplate\(/);
    assert.match(client, /createLoveLetterRenderer\(/);
    assert.match(client, /createLoveLetterScene\(/);
    assert.match(client, /createLoveLetterActions\(/);
    assert.ok(client.split('\n').length < 150, '入口不应重新堆回大段渲染与演出代码');
    assert.match(render, /function renderCommand\(/);
    assert.match(scene, /function playSceneQueue\(/);
    assert.match(state, /deriveScenes\(/);
});

test('情书规则与猜牌弹层保留可访问焦点边界', () => {
    assert.match(client, /createModalController\(/);
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(actions, /trapGuessFocus/);
    assert.match(template, /data-role="rulesOverlay"[^>]*aria-hidden="true"/);
    assert.match(template, /data-role="guessOverlay"[^>]*aria-hidden="true"/);
});

test('情书保留私密牌面、行动确认和回合结算演出', () => {
    assert.match(render, /ll-hidden-card/);
    assert.match(render, /data-action="acknowledge-action"/);
    assert.match(scene, /showScene\('showdown'/);
    assert.match(scene, /renderShowdownPlayer/);
    assert.match(style, /orientation:\s*landscape/);
});
