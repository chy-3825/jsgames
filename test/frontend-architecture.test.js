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

test('高复杂度游戏样式按职责拆层并由资源清单保持级联顺序', () => {
    const manifest = fs.readFileSync(path.join(root, 'public', 'games', 'common', 'game-manifest.js'), 'utf8');
    const splitStyles = {
        acquire: ['style.css', 'board.css', 'rail.css', 'scenes.css'],
        avalon: ['style.css', 'scenes.css'],
        citadels: ['style.css', 'roles.css', 'interactions.css', 'responsive.css', 'scenes.css'],
        coup: ['style.css', 'private.css', 'scenes.css', 'responsive.css'],
    };
    for (const [game, files] of Object.entries(splitStyles)) {
        const positions = files.map(file => manifest.indexOf(`style('/games/${game}/${file}',`));
        assert.ok(positions.every(position => position >= 0), `${game} 的样式必须全部登记`);
        for (let index = 1; index < positions.length; index += 1) {
            assert.ok(positions[index] > positions[index - 1], `${game} 样式应按基础到后置层顺序登记`);
        }
        for (const file of files) {
            const source = fs.readFileSync(path.join(gamesRoot, game, file), 'utf8');
            assert.ok(source.trim(), `${game}/${file} 不能为空`);
        }
        const client = read(game, 'client.js');
        assert.match(client, /getGameStyleHrefs\(/, `${game} 客户端必须通过统一清单加载样式`);
        assert.doesNotMatch(client, /document\.head\.appendChild/, `${game} 客户端不应自行拼接样式标签`);
    }

    const visualFixtures = {
        acquire: 'public/__remaining_cards_visual_test.html',
        avalon: 'public/__game_shell_visual_test.html',
        citadels: 'public/__cardfaces_visual_test.html',
        coup: 'public/__coup_cards_visual_test.html',
    };
    for (const [game, fixturePath] of Object.entries(visualFixtures)) {
        const fixture = fs.readFileSync(path.join(root, fixturePath), 'utf8');
        for (const file of splitStyles[game].slice(1)) {
            assert.match(fixture, new RegExp(`/games/${game}/${file.replace('.', '\\.')}`), `${fixturePath} 缺少 ${file}`);
        }
    }
});

test('大厅入口与胡闹运动会引擎保持组合根和领域模块边界', () => {
    const lobbyEntry = fs.readFileSync(path.join(root, 'public', 'script.js'), 'utf8');
    assert.ok(lobbyEntry.split('\n').length < 1300, '大厅入口不应重新堆积为单体脚本');
    for (const module of ['catalog-data', 'catalog-view', 'game-loader', 'transport', 'artwork', 'room-dialog', 'waiting-room-scene', 'game-entry-transition', 'study-controls']) {
        assert.match(lobbyEntry, new RegExp(`from ['"]\\./lobby/${module}\\.js['"]`), `大厅入口缺少 ${module} 模块`);
    }

    const engine = fs.readFileSync(path.join(root, 'server', 'games', 'magicalathlete', 'engine.js'), 'utf8');
    for (const module of ['constants', 'turn-resolution', 'movement', 'state']) {
        assert.ok(fs.existsSync(path.join(root, 'server', 'games', 'magicalathlete', `${module}.js`)), `胡闹运动会缺少 ${module}.js`);
        assert.match(engine, new RegExp(`require\\(['"]\\./${module}['"]\\)`), `引擎必须组装 ${module} 模块`);
    }
    assert.ok(engine.split('\n').length < 900, '胡闹运动会引擎应保留编排职责，不应重新膨胀');
    assert.match(engine, /Object\.assign\(MagicalAthleteEngine\.prototype/);
});
