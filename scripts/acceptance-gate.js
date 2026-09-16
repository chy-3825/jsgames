#!/usr/bin/env node

/** Run the reproducible local gates used by the final acceptance checklist. */

'use strict';

const { spawnSync } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gates = [
    ['dependency audit', ['run', 'test:audit']],
    ['syntax', ['run', 'test:syntax']],
    ['lint', ['run', 'test:lint']],
    ['type check', ['run', 'test:type']],
    ['presentation event audit', ['run', 'test:presentation']],
    ['complexity ratchet', ['run', 'test:complexity']],
    ['regression', ['test']],
    ['coverage', ['run', 'test:coverage']],
    ['Firefox browser smoke', ['run', 'test:browser']],
    ['performance and cleanup', ['run', 'test:performance']],
    ['report inventory', ['run', 'test:reports']],
    ['release metadata', ['run', 'test:release']],
    ['production-shaped deployment', ['run', 'test:deploy']],
];

function runGate(label, args) {
    console.log(`\n== ${label} ==`);
    const result = spawnSync(npmCommand, args, { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        const signal = result.signal ? ` (${result.signal})` : '';
        throw new Error(`${label} failed with exit code ${result.status}${signal}`);
    }
}

function runDiffCheck() {
    console.log('\n== diff check ==');
    const result = spawnSync('git', ['diff', '--check'], { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`git diff --check failed with exit code ${result.status}`);
}

try {
    console.log(`acceptance gate: Node ${process.version}`);
    gates.forEach(([label, args]) => runGate(label, args));
    runDiffCheck();
    console.log('\nacceptance gate: PASS · all reproducible local gates passed');
} catch (error) {
    console.error(`\nacceptance gate: ERROR · ${error.message}`);
    process.exitCode = 1;
}
