#!/usr/bin/env node

/**
 * Keep presentation protocol kinds and browser scene handlers in sync.
 *
 * The audit deliberately reads the source instead of maintaining a second
 * hand-written event list.  Games using named presentation calls are parsed
 * from their call sites; games using event objects are parsed from the
 * literal `kind` at the presentation boundary.  Avalon, Werewolf and
 * WitchTown use a generic public-event renderer, so those contracts verify
 * that their generic dispatch loop remains present.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const CONTRACTS = [
    { game: 'acquire', mode: 'named' },
    { game: 'citadels', mode: 'named' },
    { game: 'kingdomino', mode: 'named' },
    { game: 'splendor', mode: 'named' },
    { game: 'camelup', mode: 'object' },
    { game: 'lasvegas', mode: 'object' },
    { game: 'magicalathlete', mode: 'object' },
    { game: 'manila', mode: 'object' },
    { game: 'modernart', mode: 'object' },
    { game: 'scout', mode: 'object' },
    { game: 'guessnumber', mode: 'guessnumber' },
    { game: 'hanabi', mode: 'hanabi' },
    { game: 'coup', mode: 'coup' },
    { game: 'decrypto', mode: 'decrypto' },
    { game: 'monopolydeal', mode: 'monopolydeal' },
    {
        game: 'avalon',
        mode: 'generic',
        fallback: /for \(const event of (?:freshEvents|batch\?\.events \|\| \[\])[\s\S]*(?:enqueueScene\(kind|playEvent\(event, token\))/,
    },
    {
        game: 'werewolf',
        mode: 'generic',
        // Werewolf now consumes server-owned timestamped batches instead of
        // rebuilding a local queue from mutable publicEvents snapshots.
        fallback: /enqueuePresentation\(/,
        serverFallback: /_presentationBatches\([\s\S]*startedAt[\s\S]*endsAt/,
    },
    {
        game: 'witchtown',
        mode: 'generic',
        fallback: /(?:queueTimedStateScenes|for \(const event of fresh\))[\s\S]*enqueueScene\(\{/,
        // WitchTown now sends server-owned absolute presentation batches;
        // retain the generic fallback only for older snapshots.
        serverFallback: /this\.presentation\s*=\s*\{[\s\S]*startedAt[\s\S]*endsAt/,
    },
];

function sourceFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    return entries.flatMap(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(target);
        return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
    });
}

function readGameServer(game) {
    return sourceFiles(path.join(root, 'server', 'games', game))
        .map(file => fs.readFileSync(file, 'utf8'))
        .join('\n');
}

function unique(matches) {
    return [...new Set(matches)].sort();
}

function extractNamedKinds(source) {
    const kinds = [];
    for (const match of source.matchAll(/_startPresentation\([^,\n]+,\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    for (const match of source.matchAll(/_appendPresentationEvent\([^,\n]+,\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    return unique(kinds);
}

function extractObjectKinds(source) {
    const kinds = [];
    // Event objects passed directly to the presentation queue.
    for (const match of source.matchAll(/_appendPresentationEvent\(\s*\{\s*kind:\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    // A few engines start a presentation with an event object as the third
    // argument (the action name is not itself a public event kind).
    for (const match of source.matchAll(/_startPresentation\([\s\S]{0,120}?,\s*['"][^'"]+['"],\s*\{\s*kind:\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    // Scout builds its event payload first and passes it through `event`.
    for (const match of source.matchAll(/event:\s*\{\s*kind:\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    // Las Vegas builds each casino result in a local object before appending
    // it.  Keep this explicit so a dynamically assembled public event cannot
    // silently disappear from the contract audit.
    for (const match of source.matchAll(/(?:const|let)\s+\w*Result\s*=\s*\{\s*kind:\s*['"]([A-Za-z][\w]*)['"]/g)) kinds.push(match[1]);
    return unique(kinds);
}

function extractPublishedKinds(source) {
    return unique([...source.matchAll(/_publishEvent\(\s*['"]([A-Za-z][\w]*)['"]/g)].map(match => match[1]));
}

function extractCoupKinds(source) {
    const durationBlock = source.match(/PRESENTATION_CONTENT_DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
    const durationKinds = durationBlock
        ? [...durationBlock[1].matchAll(/^\s*([A-Za-z][\w]*):/gm)].map(match => match[1])
        : [];
    return unique([...durationKinds, ...extractNamedKinds(source)].filter(kind => kind !== 'playerLeave'));
}

function extractDecryptoKinds(source) {
    const durationBlock = source.match(/PRESENTATION_CONTENT_DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
    const durationKinds = durationBlock
        ? [...durationBlock[1].matchAll(/^\s*([A-Za-z][\w]*):/gm)].map(match => match[1])
        : [];
    // Decrypto passes the gameplay action as the second argument to
    // `_startPresentation`; only the duration table names are public event
    // kinds, so do not mistake actions such as `transmission` for events.
    return unique(durationKinds);
}

function extractGuessnumberKinds(source) {
    const durationBlock = source.match(/PRESENTATION_CONTENT_DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
    const durationKinds = durationBlock
        ? [...durationBlock[1].matchAll(/^\s*([A-Za-z][\w]*):/gm)].map(match => match[1])
        : [];
    return unique(durationKinds);
}

function extractHanabiKinds(source) {
    const durationBlock = source.match(/PRESENTATION_CONTENT_DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
    const durationKinds = durationBlock
        ? [...durationBlock[1].matchAll(/^\s*([A-Za-z][\w]*):/gm)].map(match => match[1])
        : [];
    return unique(durationKinds);
}

function extractMonopolydealKinds(source) {
    const durationBlock = source.match(/PRESENTATION_CONTENT_DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
    const durationKinds = durationBlock
        ? [...durationBlock[1].matchAll(/^\s*([A-Za-z][\w]*):/gm)].map(match => match[1])
        : [];
    return unique(durationKinds);
}

function sceneHandles(scene, kind) {
    const escaped = kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const directDispatch = new RegExp(`event\\.kind\\s*===\\s*['"]${escaped}['"]`);
    const localDispatch = new RegExp(`(?:const\\s+)?kind\\s*===\\s*['"]${escaped}['"]`);
    const groupedDispatch = new RegExp(`['"]${escaped}['"][^\\n]{0,180}\\.includes\\(event\\.kind\\)`);
    return directDispatch.test(scene) || localDispatch.test(scene) || groupedDispatch.test(scene);
}

function auditPresentationEvents() {
    return CONTRACTS.map(contract => {
        const server = readGameServer(contract.game);
        const scene = fs.readFileSync(path.join(root, 'public', 'games', contract.game, 'scene.js'), 'utf8');
        const kinds = contract.mode === 'named' ? extractNamedKinds(server)
            : contract.mode === 'object' ? extractObjectKinds(server)
                : contract.mode === 'coup' ? extractCoupKinds(server)
                    : contract.mode === 'decrypto' ? extractDecryptoKinds(server)
                        : contract.mode === 'guessnumber' ? extractGuessnumberKinds(server)
                        : contract.mode === 'hanabi' ? extractHanabiKinds(server)
                            : contract.mode === 'monopolydeal' ? extractMonopolydealKinds(server)
                                : extractPublishedKinds(server);
        const missing = contract.mode === 'generic'
            ? (contract.fallback.test(scene) && (!contract.serverFallback || contract.serverFallback.test(server)) ? [] : ['generic-dispatch-loop'])
            : kinds.filter(kind => !sceneHandles(scene, kind));
        return { ...contract, kinds, missing };
    });
}

function main() {
    const results = auditPresentationEvents();
    const failures = results.filter(result => result.missing.length);
    results.forEach(result => {
        const label = result.mode === 'generic' ? 'generic fallback' : `${result.kinds.length} event kinds`;
        console.log(`presentation audit: ${result.game} ${label}${result.missing.length ? ` · missing ${result.missing.join(', ')}` : ' · PASS'}`);
    });
    if (failures.length) {
        process.exitCode = 1;
        return;
    }
    console.log('presentation audit: PASS');
}

if (require.main === module) main();

module.exports = { CONTRACTS, auditPresentationEvents, extractNamedKinds, extractObjectKinds, extractCoupKinds, extractDecryptoKinds, extractGuessnumberKinds, extractHanabiKinds, extractMonopolydealKinds, extractPublishedKinds };
