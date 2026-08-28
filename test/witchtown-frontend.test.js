const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(`public/games/witchtown/${file}`, 'utf8');
const client = read('client.js');
const source = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js'].map(read).join('\n');

test('猎巫镇入口只负责协议、资源与生命周期，复杂界面按模块拆分', () => {
    assert.match(client, /getGameStyleHrefs\('witchtown'\)/);
    assert.match(client, /loadStyles\(/);
    assert.match(client, /createClientScope\(/);
    assert.match(client, /createModalController\(/);
    assert.match(client, /createWitchTownTemplate\(/);
    assert.match(client, /createWitchTownRenderer\(/);
    assert.match(client, /createWitchTownScene\(/);
    assert.match(client, /createWitchTownActions\(/);
    assert.ok(client.split('\n').length < 120, '入口不应重新堆回审判流程与大段渲染');
});

test('猎巫镇保留密封档案、公开镇议会角色和无主持人场景队列', () => {
    assert.match(source, /data-dossier-hold/);
    assert.match(source, /setDossierIdentityVisible\(true\)/);
    assert.match(source, /镇议会角色从开局起始终公开，不属于密封档案/);
    assert.match(source, /function queueStateScenes\(/);
    assert.match(source, /event\.kind === 'victory' \? 2600/);
    assert.match(source, /event\.kind === 'identityReveal' \? 2000/);
    assert.match(source, /visibilitychange/);
    assert.match(source, /pointercancel/);
});
