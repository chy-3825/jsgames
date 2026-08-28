const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = fs.readFileSync('public/games/monopolydeal/client.js', 'utf8');
const scene = fs.readFileSync('public/games/monopolydeal/scene.js', 'utf8');
const state = fs.readFileSync('public/games/monopolydeal/state.js', 'utf8');
const style = fs.readFileSync('public/games/monopolydeal/style.css', 'utf8');

test('大富翁纸牌物业接管与胜利播报按队列顺序播放', () => {
    assert.match(scene, /function enqueueScene\(/);
    assert.match(scene, /model\.sceneQueue\.push\(scene\)/);
    assert.match(scene, /kind: 'takeover'/);
    assert.match(scene, /kind: 'victory'/);
    assert.match(client, /takeoverResolved[\s\S]*scene\.showTakeoverScene\(model\.state\)[\s\S]*scene\.showVictoryScene\(model\.state\)/);
    assert.match(scene, /物业接管生效/);
    assert.match(style, /\.deal-takeover-mark/);
});

test('大富翁纸牌胜利画面说明第三组地产的来源', () => {
    for (const source of ['物业接管', '强制交易', '盗取', '资产支付']) assert.match(state, new RegExp(source));
    assert.match(scene, /致胜行动/);
    assert.match(style, /\.deal-victory-source/);
});
