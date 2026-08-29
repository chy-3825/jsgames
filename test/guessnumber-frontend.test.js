const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const client = ['client.js', 'constants.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js']
    .map(file => fs.readFileSync(`public/games/guessnumber/${file}`, 'utf8')).join('\n');
const style = fs.readFileSync('public/games/guessnumber/style.css', 'utf8');
const fixture = ['public/__game_shell_visual_test.html', 'public/visual-fixtures/fixture-state.js', 'public/visual-fixtures/fixture-scenarios.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');
const actionLock = fs.readFileSync('public/games/common/action-lock.js', 'utf8');
const lifecycle = fs.readFileSync('public/games/common/lifecycle.js', 'utf8');
const modal = fs.readFileSync('public/games/common/modal.js', 'utf8');
const manifest = fs.readFileSync('public/games/common/game-manifest.js', 'utf8');
const styleLoader = fs.readFileSync('public/games/common/style-loader.js', 'utf8');

test('猜数字提交期间锁定键盘和实体键盘输入', () => {
    assert.match(client, /availableActions\?\.canGuess[\s\S]*!model\.actionLock\.pending/);
    assert.match(client, /actionLock\.lock\(\)/);
    assert.match(client, /actionLock\.unlock\(\)/);
    assert.match(actionLock, /get pending\(\)/);
});

test('猜数字输入状态可被读屏器获取', () => {
    assert.match(client, /data-role="inputStatus" aria-live="polite"/);
    assert.match(client, /数字 \$\{digit\} 已经使用/);
    assert.match(client, /inputSlots'\)\.setAttribute\('aria-label'/);
});

test('猜数字规则弹层限定焦点并隔离背景', () => {
    assert.match(client, /createModalController\(/);
    assert.match(client, /rulesModal\.trapFocus/);
    assert.match(modal, /child\.inert = open && child !== overlay/);
    assert.match(modal, /returnFocus/);
});

test('猜数字迁移到统一公共资源与生命周期层', () => {
    assert.match(client, /getGameStyleHrefs\('guessnumber'\)/);
    assert.match(client, /createClientScope\(\{ windowRef \}\)/);
    assert.match(client, /escapeHtml\(/);
    assert.match(client, /styleHandle\.release\(\)/);
    assert.match(lifecycle, /new AbortController\(\)/);
    assert.match(styleLoader, /data-jsgames-style/);
    const gameTypes = fs.readdirSync('public/games', { withFileTypes: true })
        .filter(entry => entry.isDirectory() && fs.existsSync(`public/games/${entry.name}/client.js`))
        .map(entry => entry.name)
        .sort();
    const manifestTypes = [...manifest.matchAll(/^\s{4}([a-z0-9]+):\s*freezeAssets/gm)].map(match => match[1]).sort();
    assert.deepEqual(manifestTypes, gameTypes);
});

test('猜数字短横屏和四种关键状态纳入视觉验收', () => {
    assert.match(style, /orientation:\s*landscape/);
    assert.match(style, /\.gn-input-zone[\s\S]*grid-column:\s*2/);
    assert.match(fixture, /guessnumber: \['\.gn-secret-zone', '\.gn-input-slots', '\.gn-keypad'\]/);
    for (const scenario of ['empty', 'ready', 'feedback', 'ended']) assert.match(fixture, new RegExp(`['\"]${scenario}['\"]`));
});

test('猜数字终局全屏播报公开答案、尝试次数并可跳过', () => {
    assert.match(client, /previousState\?\.status === 'playing' && model\.state\.status === 'ended'/);
    assert.match(client, /FINAL VERDICT/);
    assert.match(client, /本案共尝试 \$\{attempts\} 次/);
    assert.match(client, /调查中止/);
    assert.match(client, /function skipScene\(/);
    assert.match(client, /prefers-reduced-motion/);
    assert.match(style, /\.gn-scene-layer/);
    assert.match(style, /\.gn-scene-layer\.is-code-revealed \.gn-scene-code span/);
});
