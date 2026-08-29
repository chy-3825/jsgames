#!/usr/bin/env node

/** Keep known orchestration/style hotspots from silently growing again. */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'complexity-baseline.json');
const budgets = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const failures = [];

for (const [relativePath, maxLines] of Object.entries(budgets)) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
        failures.push(`${relativePath}: 文件不存在`);
        continue;
    }
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n').length;
    if (lines > maxLines) failures.push(`${relativePath}: ${lines} 行 > 门禁 ${maxLines} 行`);
    else console.log(`complexity audit: ${relativePath} ${lines}/${maxLines} lines PASS`);
}

if (failures.length) {
    console.error(failures.map(item => `- ${item}`).join('\n'));
    process.exitCode = 1;
} else {
    console.log('complexity audit: PASS');
}
