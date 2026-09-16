#!/usr/bin/env node
'use strict';

// Snapshot the working tree, including untracked runtime files, without
// publishing or changing Git. Never package dependencies or local credentials.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { isDevelopmentPublicPath } = require('../server/public-files');
const root = path.resolve(__dirname, '..');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'jsgames-preview-'));
const files = {};

function copy(relative) {
    if (relative.startsWith('public/') && isDevelopmentPublicPath(relative.slice(7))) return;
    const source = path.join(root, relative);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Release input must not be a symlink: ${relative}`);
    if (stat.isDirectory()) {
        for (const name of fs.readdirSync(source).sort()) copy(`${relative}/${name}`);
        return;
    }
    const bytes = fs.readFileSync(source);
    files[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
    const target = path.join(stage, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { mode: stat.mode & 0o777 });
}

try {
    for (const relative of ['app.js', 'bin', 'server', 'public', 'package.json', 'package-lock.json', 'deploy']) copy(relative);
    const manifest = {
        version: require('../package.json').version,
        createdAt: new Date().toISOString(),
        source: 'working-tree snapshot; includes untracked runtime files',
        limitations: ['single Node process', 'server restart clears active games'],
        sha256: files,
    };
    fs.writeFileSync(path.join(stage, 'RELEASE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
    const digest = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
    const output = path.join(root, 'dist', `jsgames-${manifest.version}-preview-${digest}.tar.gz`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    execFileSync('tar', ['-czf', output, '-C', stage, '.']);
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
    fs.writeFileSync(`${output}.sha256`, `${checksum}  ${path.basename(output)}\n`);
    console.log(`Preview package: ${output}\nRuntime files: ${Object.keys(files).length}\nSHA256: ${checksum}`);
} finally {
    fs.rmSync(stage, { recursive: true, force: true });
}
