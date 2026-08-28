#!/usr/bin/env node

/** Check every first-party JavaScript file without executing it. */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const roots = ['app.js', 'bin/www', 'server', 'public', 'scripts', 'test'];
const excluded = new Set(['node_modules', '.git', 'tmp']);

function collect(entry, files = []) {
    const absolute = path.join(root, entry);
    if (!fs.existsSync(absolute)) return files;
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
        if (absolute.endsWith('.js')) files.push(absolute);
        return files;
    }
    for (const child of fs.readdirSync(absolute)) {
        if (excluded.has(child)) continue;
        collect(path.join(entry, child), files);
    }
    return files;
}

const files = [...new Set(roots.flatMap(entry => collect(entry)))].sort();
const failures = [];
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) failures.push({ file: path.relative(root, file), output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
}

if (failures.length) {
    for (const failure of failures) console.error(`${failure.file}\n${failure.output}`);
    process.exitCode = 1;
} else {
    console.log(`syntax check: ${files.length} files passed`);
}

