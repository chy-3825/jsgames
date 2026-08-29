#!/usr/bin/env node

/**
 * Local performance and cleanup gate.
 *
 * This is deliberately a bounded smoke test, not a production load test. It
 * catches accidental asset growth, slow local static responses, leaked lobby
 * players and rooms after intentional leave, and the inability to serve a
 * short concurrent request/connection burst.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { once } = require('events');
const { performance } = require('perf_hooks');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const HTTP_LATENCY_BUDGET_MS = Number(process.env.JSGAMES_HTTP_BUDGET_MS || 1500);
const HTTP_BURST_SIZE = Number(process.env.JSGAMES_HTTP_BURST || 40);
const LOBBY_BURST_SIZE = Number(process.env.JSGAMES_LOBBY_BURST || 20);
const ROOM_BURST_SIZE = Number(process.env.JSGAMES_ROOM_BURST || 6);
const ASSET_BUDGETS = new Map([
    ['public/index.html', 24 * 1024],
    ['public/script.js', 140 * 1024],
    ['public/style.css', 160 * 1024],
    ['node_modules/three/build/three.module.js', 700 * 1024],
]);
const SOURCE_EXTENSIONS = new Set(['.html', '.js', '.css']);

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findFreePort() {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    probe.close();
    await once(probe, 'close');
    return port;
}

function collectSourceFiles(entry, files = []) {
    const absolute = path.join(root, entry);
    if (!fs.existsSync(absolute)) return files;
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
        if (SOURCE_EXTENSIONS.has(path.extname(absolute))) files.push(absolute);
        return files;
    }
    for (const child of fs.readdirSync(absolute)) {
        if (new Set(['node_modules', '.git', 'tmp']).has(child)) continue;
        collectSourceFiles(path.join(entry, child), files);
    }
    return files;
}

function readAssetBudgets() {
    const failures = [];
    const measurements = [];
    for (const [relative, limit] of ASSET_BUDGETS) {
        const file = path.join(root, relative);
        const bytes = fs.statSync(file).size;
        measurements.push({ relative, bytes, limit });
        if (bytes > limit) failures.push(`${relative} ${bytes} bytes > ${limit} byte budget`);
    }
    const sourceFiles = [...new Set(collectSourceFiles('public'))];
    const sourceBytes = sourceFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
    const sourceLimit = Math.floor(3.6 * 1024 * 1024);
    measurements.push({ relative: 'public first-party source', bytes: sourceBytes, limit: sourceLimit, count: sourceFiles.length });
    if (sourceBytes > sourceLimit) failures.push(`public first-party source ${sourceBytes} bytes > ${sourceLimit} byte budget`);
    return { failures, measurements };
}

function httpGet(baseUrl, resourcePath) {
    return new Promise((resolve, reject) => {
        const started = performance.now();
        const request = http.get(`${baseUrl}${resourcePath}`, response => {
            let bytes = 0;
            response.on('data', chunk => { bytes += chunk.length; });
            response.on('end', () => resolve({
                path: resourcePath,
                status: response.statusCode,
                bytes,
                elapsedMs: performance.now() - started,
            }));
        });
        request.setTimeout(HTTP_LATENCY_BUDGET_MS, () => request.destroy(new Error(`HTTP ${resourcePath} timeout`)));
        request.on('error', reject);
    });
}

function openClient(url) {
    const socket = new WebSocket(url);
    const messages = [];
    const waiters = [];
    let closed = false;
    socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return; }
        if (message.type === 'session') {
            socket.playerId = message.playerId;
            socket.sessionToken = message.sessionToken;
            socket.playerName = message.playerName;
        }
        const index = waiters.findIndex(waiter => waiter.predicate(message));
        if (index >= 0) {
            const waiter = waiters.splice(index, 1)[0];
            waiter.resolve(message);
        } else messages.push(message);
    });
    socket.on('close', () => {
        closed = true;
        while (waiters.length) waiters.shift().reject(new Error('WebSocket unexpectedly closed'));
    });
    socket.waitFor = (predicate, timeout = 5000) => {
        const queued = messages.findIndex(predicate);
        if (queued >= 0) return Promise.resolve(messages.splice(queued, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = {
                predicate,
                resolve: value => { clearTimeout(timer); resolve(value); },
                reject,
            };
            const timer = setTimeout(() => {
                const index = waiters.indexOf(waiter);
                if (index >= 0) waiters.splice(index, 1);
                reject(new Error('WebSocket message timeout'));
            }, timeout);
            waiters.push(waiter);
        });
    };
    socket.sendJson = payload => socket.send(JSON.stringify(payload));
    socket.closeCleanly = async () => {
        if (closed) return;
        await new Promise(resolve => {
            const timer = setTimeout(() => { socket.terminate(); resolve(); }, 2000);
            socket.once('close', () => { clearTimeout(timer); resolve(); });
            socket.close();
        });
    };
    return new Promise((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

async function closeServer(server, wss) {
    try { await new Promise(resolve => wss?.close(() => resolve())); } catch {}
    if (server.listening) await new Promise(resolve => server.close(() => resolve()));
}

async function runHttpBurst(baseUrl) {
    const paths = [
        '/',
    '/script.js?v=20260829-architecture-1',
        '/style.css?v=20260827-seat-ring-v16',
        '/games/gobang/client.js?v=performance-smoke',
        '/games/junqi/client.js?v=performance-smoke',
        '/vendor/three/build/three.module.js',
    ];
    const requests = Array.from({ length: HTTP_BURST_SIZE }, (_, index) => httpGet(baseUrl, paths[index % paths.length]));
    const results = await Promise.all(requests);
    const failures = results.filter(result => result.status !== 200 || result.elapsedMs > HTTP_LATENCY_BUDGET_MS);
    if (failures.length) {
        throw new Error(`HTTP burst ${failures.length}/${results.length} 超过状态或 ${HTTP_LATENCY_BUDGET_MS}ms 门禁`);
    }
    const maxMs = Math.max(...results.map(result => result.elapsedMs));
    const totalBytes = results.reduce((total, result) => total + result.bytes, 0);
    console.log(`http burst: ${results.length}/${results.length} · max ${maxMs.toFixed(1)}ms · ${totalBytes} bytes`);
}

async function waitForPlayerCount(observer, expected) {
    await observer.waitFor(message => message.type === 'playerCount' && message.count === expected, 8000);
}

async function runLobbyBurst(url) {
    const observer = await openClient(url);
    const clients = [observer];
    try {
        await observer.waitFor(message => message.type === 'session');
        const transient = await Promise.all(Array.from({ length: LOBBY_BURST_SIZE }, () => openClient(url)));
        clients.push(...transient);
        await Promise.all(transient.map(client => client.waitFor(message => message.type === 'session')));
        await waitForPlayerCount(observer, LOBBY_BURST_SIZE + 1);
        await Promise.all(transient.map(client => client.closeCleanly()));
        await waitForPlayerCount(observer, 1);
        console.log(`connection cleanup: ${LOBBY_BURST_SIZE} transient clients removed`);
        return observer;
    } catch (error) {
        await Promise.all(clients.slice(1).map(client => client.closeCleanly().catch(() => {})));
        throw error;
    }
}

async function runRoomBurst(url, observer) {
    const hosts = await Promise.all(Array.from({ length: ROOM_BURST_SIZE }, () => openClient(url)));
    const guests = await Promise.all(Array.from({ length: ROOM_BURST_SIZE }, () => openClient(url)));
    const clients = [...hosts, ...guests];
    try {
        await Promise.all(clients.map(client => client.waitFor(message => message.type === 'session')));
        const rooms = await Promise.all(hosts.map((host, index) => {
            host.sendJson({ type: 'createRoom', gameType: 'gobang', roomName: `性能清理${index + 1}`, isPublic: true });
            return host.waitFor(message => message.type === 'roomCreated');
        }));
        await Promise.all(guests.map((guest, index) => {
            guest.sendJson({ type: 'joinRoom', roomId: rooms[index].roomId });
            return guest.waitFor(message => message.type === 'joinSuccess');
        }));
        await observer.waitFor(message => message.type === 'roomList' && message.rooms.length === ROOM_BURST_SIZE, 8000);
        await Promise.all(guests.map((guest, index) => {
            guest.sendJson({ type: 'leaveRoom' });
            return hosts[index].waitFor(message => message.type === 'playerLeft' && message.playerId === guests[index].playerId);
        }));
        await Promise.all(hosts.map(host => {
            host.sendJson({ type: 'leaveRoom' });
            return Promise.resolve();
        }));
        await observer.waitFor(message => message.type === 'roomList' && message.rooms.length === 0, 8000);
        await Promise.all(clients.map(client => client.closeCleanly()));
        await waitForPlayerCount(observer, 1);
        console.log(`room cleanup: ${ROOM_BURST_SIZE} rooms and ${clients.length} players removed`);
    } catch (error) {
        await Promise.all(clients.map(client => client.closeCleanly().catch(() => {})));
        throw error;
    }
}

async function run() {
    const assetReport = readAssetBudgets();
    for (const measurement of assetReport.measurements) {
        const count = measurement.count ? ` · ${measurement.count} files` : '';
        console.log(`asset budget: ${measurement.relative} ${measurement.bytes}/${measurement.limit} bytes${count}`);
    }
    if (assetReport.failures.length) throw new Error(assetReport.failures.join('; '));

    const app = require(path.join(root, 'app'));
    const server = http.createServer(app);
    const wss = app.startWebSocketServer(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const wsUrl = `ws://127.0.0.1:${server.address().port}`;
    const started = performance.now();
    let observer;
    try {
        await runHttpBurst(baseUrl);
        observer = await runLobbyBurst(wsUrl);
        await runRoomBurst(wsUrl, observer);
        console.log(`performance smoke: PASS · ${(performance.now() - started).toFixed(0)}ms`);
    } finally {
        await observer?.closeCleanly().catch(() => {});
        await closeServer(server, wss);
    }
}

run().catch(error => {
    console.error(`performance smoke: ERROR · ${error.message}`);
    process.exitCode = 1;
});
