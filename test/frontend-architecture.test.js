const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gamesRoot = path.join(root, 'public', 'games');
const games = fs.readdirSync(gamesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(gamesRoot, entry.name, 'client.js')))
    .map(entry => entry.name)
    .sort();
const read = (game, file) => fs.readFileSync(path.join(gamesRoot, game, file), 'utf8');

test('28 款游戏遵循统一的前端模块骨架', () => {
    assert.equal(games.length, 28);
    const required = ['client.js', 'state.js', 'template.js', 'render.js', 'scene.js', 'actions.js'];
    for (const game of games) {
        for (const file of required) assert.ok(fs.existsSync(path.join(gamesRoot, game, file)), `${game}/${file} 缺失`);
        const client = read(game, 'client.js');
        assert.match(client, /export function createGameClient/);
        assert.match(client, /destroy\(\)/);
        assert.doesNotMatch(client, /new\s+WebSocket\s*\(/, `${game} client 不应直接管理 WebSocket`);
    }
    assert.deepEqual(games.filter(game => !fs.existsSync(path.join(gamesRoot, game, 'constants.js'))), ['takefive']);
});

test('游戏入口保持薄层，协议、状态、模板、渲染、场景和动作职责分离', () => {
    for (const game of games) {
        const client = read(game, 'client.js');
        assert.ok(client.split('\n').length < 140, `${game}/client.js 不应重新堆积界面代码`);
        for (const suffix of ['Model', 'Template', 'Renderer', 'Scene', 'Actions']) {
            assert.match(client, new RegExp(`create[A-Za-z]+${suffix}`), `${game} 未接入 ${suffix} 模块`);
        }
    }
});

test('璀璨宝石卡牌助手显式导入代币集合', () => {
    const cards = read('splendor', 'cards.js');
    assert.match(cards, /import\s*\{[^}]*\bALL_TOKENS\b[^}]*\}\s*from ['"]\.\/constants\.js['"]/);
});

test('3D 棋类的场景和输入模块是真实实现而非占位工厂', () => {
    for (const game of ['chess', 'junqi', 'xiangqi']) {
        const scene = read(game, 'scene.js');
        const actions = read(game, 'actions.js');
        assert.match(scene, /new THREE\.WebGLRenderer/);
        assert.match(scene, /function getActionBindings/);
        assert.match(actions, /addEventListener\('pointerdown'/);
        assert.match(actions, /removeEventListener\('pointerdown'/);
        assert.doesNotMatch(scene, /return renderer;/);
        assert.doesNotMatch(actions, /return renderer;/);
    }
});

test('本地字体清单中的字体资源都存在', () => {
    const fontCss = fs.readFileSync(path.join(root, 'public', 'fonts', 'local-fonts.css'), 'utf8');
    const fontPaths = [...fontCss.matchAll(/url\("(\/fonts\/[^\"]+)"\)/g)].map(match => match[1]);
    assert.ok(fontPaths.length >= 2, '本地字体清单应至少声明两种字体');
    for (const fontPath of fontPaths) assert.ok(fs.existsSync(path.join(root, 'public', fontPath.slice('/'.length))), `${fontPath} 缺失`);
});
