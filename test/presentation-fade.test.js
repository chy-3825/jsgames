const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const presentationScenes = [
    'acquire', 'avalon', 'camelup', 'citadels', 'coup', 'decrypto',
    'guessnumber', 'hanabi', 'kingdomino', 'lasvegas', 'loveletter',
    'magicalathlete', 'manila', 'modernart', 'monopolydeal', 'scout',
    'splendor', 'werewolf',
];

test('全屏播报使用统一的淡出契约', () => {
    const helper = read('public/games/common/presentation-fade.js');
    const style = read('public/style.css');
    assert.match(helper, /PRESENTATION_FADE_MS\s*=\s*360/);
    assert.match(helper, /PRESENTATION_FADE_CLASS\s*=\s*['"]is-presentation-fading['"]/);
    assert.match(style, /\.is-presentation-fading\s*\{[\s\S]*opacity:\s*0\s*!important/);
    assert.match(style, /\.is-presentation-fading\s*\{[\s\S]*transition:\s*opacity\s+var\(--ww-fade-out-duration,\s*\.36s\)/);
    assert.match(style, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.is-presentation-fading/);

    for (const game of presentationScenes) {
        const source = read(`public/games/${game}/scene.js`);
        assert.match(source, /presentation-fade\.js/, `${game} 未接入公共淡出辅助`);
        assert.match(source, /beginPresentationFade/, `${game} 缺少开始淡出阶段`);
        assert.match(source, /clearPresentationFade/, `${game} 缺少中断/重播清理`);
        assert.match(source, /PRESENTATION_FADE_MS/, `${game} 未使用统一淡出时长`);
    }
});

test('已有猎巫镇场景继续保留可见的离场阶段', () => {
    const source = read('public/games/witchtown/scene.js');
    assert.match(source, /is-leaving/);
    assert.match(source, /\?\s*1050\s*:\s*720/);
});
