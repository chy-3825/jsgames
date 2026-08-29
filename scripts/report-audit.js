#!/usr/bin/env node

/** Check that the tracked report set matches the runtime game registry. */

'use strict';

const fs = require('fs');
const path = require('path');
const { listGames } = require('../server/games/registry');

const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'TEST_REPORTS');
const failures = [];

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(label, condition, detail) {
    if (!condition) failures.push(`${label}${detail ? `：${detail}` : ''}`);
}

function sorted(values) {
    return [...values].sort((a, b) => a.localeCompare(b));
}

function sameSet(actual, expected) {
    const left = sorted(actual);
    const right = sorted(expected);
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function main() {
    const games = listGames();
    const types = games.map(game => game.type);
    const uniqueTypes = new Set(types);
    check('runtime registry', types.length === uniqueTypes.size && types.length === 28, `发现 ${types.length} 款、${uniqueTypes.size} 个唯一 type`);

    const requiredReports = [
        'README.md',
        'lobby.md',
        'lobby-history.md',
        'phase4-runtime.md',
        'artifacts.md',
        'rule-acceptance-matrix.md',
        'security.md',
        'asset-license-clearance.md',
        'release-baseline.md',
    ];
    requiredReports.forEach(file => check(`required report ${file}`, fs.existsSync(path.join(reportDir, file))));

    const expectedGameReports = types.map(type => `${type}.md`);
    const actualGameReports = fs.readdirSync(reportDir)
        .filter(file => file.endsWith('.md'))
        .filter(file => !requiredReports.includes(file));
    check('game report inventory', sameSet(actualGameReports, expectedGameReports),
        `期望 ${expectedGameReports.join(', ')}；实际 ${actualGameReports.join(', ')}`);

    const matrix = read('TEST_REPORTS/rule-acceptance-matrix.md');
    const matrixTypes = [...matrix.matchAll(/^\| `([^`]+)` \|/gm)].map(match => match[1]);
    check('rule matrix', sameSet(matrixTypes, types), `矩阵 ${matrixTypes.length} 行，注册表 ${types.length} 款`);
    check('rule matrix duplicates', new Set(matrixTypes).size === matrixTypes.length, '存在重复 type');

    const reportRootFiles = fs.readdirSync(reportDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
    const rootJson = reportRootFiles.filter(file => file.endsWith('.json'));
    check('generated artifact boundary', rootJson.length === 0, `JSON 不应直接放在 TEST_REPORTS/：${rootJson.join(', ')}`);
    check('artifact ignore policy', read('.gitignore').includes('TEST_REPORTS/artifacts/*.json'));

    if (failures.length) {
        console.error(failures.map(item => `- ${item}`).join('\n'));
        process.exitCode = 1;
        return;
    }
    console.log(`report audit: registry PASS (${types.length} games)`);
    console.log(`report audit: game reports PASS (${expectedGameReports.length})`);
    console.log(`report audit: current report set PASS (${requiredReports.length} entries)`);
    console.log(`report audit: rule matrix PASS (${matrixTypes.length} rows)`);
    console.log('report audit: generated artifact boundary PASS');
    console.log('report audit: PASS');
}

try {
    main();
} catch (error) {
    console.error(`report audit: ERROR · ${error.message}`);
    process.exitCode = 1;
}
