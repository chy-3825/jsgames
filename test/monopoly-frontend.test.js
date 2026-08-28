const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/monopoly/client.js', 'utf8');
const template = fs.readFileSync('public/games/monopoly/template.js', 'utf8');
const render = fs.readFileSync('public/games/monopoly/render.js', 'utf8');
const scene = fs.readFileSync('public/games/monopoly/scene.js', 'utf8');
const actions = fs.readFileSync('public/games/monopoly/actions.js', 'utf8');
const state = fs.readFileSync('public/games/monopoly/state.js', 'utf8');

test('环城大富翁入口只负责协议与生命周期，界面职责按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('monopoly'\)/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /createModalController\(/);
    assert.match(client, /createMonopolyTemplate\(/);
    assert.match(client, /createMonopolyRenderer\(/);
    assert.match(client, /createMonopolyScene\(/);
    assert.match(client, /createMonopolyActions\(/);
    assert.ok(client.split('\n').length < 120, '入口不应重新堆回大段渲染与动画代码');
});

test('环城大富翁保留棋盘检查器、移动端导航和统一焦点处理', () => {
    assert.match(template, /class="mono-mobile-navigator"/);
    assert.match(template, /data-role="rulesOverlay"[^>]*aria-hidden="true"/);
    assert.match(render, /function renderMobileNavigator\(/);
    assert.match(template, /data-ui="previousTile"/);
    assert.match(actions, /rulesModal\.trapFocus/);
    assert.match(state, /function movementRequest\(/);
    assert.match(scene, /function startMovementAnimation\(/);
});
