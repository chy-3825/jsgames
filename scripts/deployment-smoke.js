#!/usr/bin/env node

/**
 * Production-shaped local deployment smoke test.
 *
 * This starts the real bin/www entry point with production environment
 * variables, checks health/security headers and one WebSocket room action,
 * then verifies SIGTERM closes the process cleanly. It deliberately does not
 * touch systemd, Nginx, DNS, certificates or a remote server.
 */

'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const START_TIMEOUT_MS = Number(process.env.JSGAMES_DEPLOY_START_TIMEOUT_MS || 10_000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.JSGAMES_DEPLOY_SHUTDOWN_TIMEOUT_MS || 7_000);

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

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ response, body }));
        });
        request.setTimeout(2_000, () => request.destroy(new Error('HTTP request timeout')));
        request.on('error', reject);
    });
}

async function waitForHealth(url) {
    const started = Date.now();
    while (Date.now() - started < START_TIMEOUT_MS) {
        try {
            const result = await httpGet(url);
            if (result.response.statusCode === 200) return result;
        } catch {}
        await wait(100);
    }
    throw new Error(`production-shaped process did not expose healthz within ${START_TIMEOUT_MS}ms`);
}

function openClient(url, origin) {
    const socket = new WebSocket(url, { origin });
    const messages = [];
    const waiters = [];
    let closed = false;
    socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return; }
        const index = waiters.findIndex(waiter => waiter.predicate(message));
        if (index < 0) messages.push(message);
        else {
            const waiter = waiters.splice(index, 1)[0];
            clearTimeout(waiter.timer);
            waiter.resolve(message);
        }
    });
    socket.on('close', () => {
        closed = true;
        while (waiters.length) waiters.shift().reject(new Error('WebSocket closed before expected message'));
    });
    socket.waitFor = (predicate, timeout = 3_000) => {
        const queued = messages.findIndex(predicate);
        if (queued >= 0) return Promise.resolve(messages.splice(queued, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = {
                predicate,
                resolve,
                reject,
                timer: setTimeout(() => {
                    const index = waiters.indexOf(waiter);
                    if (index >= 0) waiters.splice(index, 1);
                    reject(new Error('WebSocket message timeout'));
                }, timeout),
            };
            waiters.push(waiter);
        });
    };
    socket.sendJson = payload => socket.send(JSON.stringify(payload));
    socket.closeCleanly = () => new Promise(resolve => {
        if (closed || socket.readyState === WebSocket.CLOSED) return resolve();
        const timer = setTimeout(() => { socket.terminate(); resolve(); }, 2_000);
        socket.once('close', () => { clearTimeout(timer); resolve(); });
        socket.close();
    });
    return new Promise((resolve, reject) => {
        socket.once('open', () => resolve(socket));
        socket.once('error', reject);
    });
}

function waitForExit(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`process did not exit within ${SHUTDOWN_TIMEOUT_MS}ms`)), SHUTDOWN_TIMEOUT_MS);
        child.once('exit', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal });
        });
        child.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

async function run() {
    const port = await findFreePort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['./bin/www'], {
        cwd: root,
        env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: String(port),
            JSGAMES_ALLOWED_ORIGINS: origin,
            JSGAMES_REQUIRE_RECONNECT_TOKEN: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let childOutput = '';
    child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
    child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
    let client;
    try {
        const health = await waitForHealth(`${origin}/healthz`);
        assert.equal(health.response.statusCode, 200);
        assert.equal(health.response.headers['x-powered-by'], undefined);
        assert.equal(health.response.headers['x-content-type-options'], 'nosniff');
        assert.equal(health.response.headers['x-frame-options'], 'SAMEORIGIN');
        assert.equal(health.response.headers['cache-control'], 'no-store');
        assert.match(health.response.headers['content-security-policy'], /default-src 'self'/);
        const healthBody = JSON.parse(health.body);
        assert.equal(healthBody.status, 'ok');
        assert.equal(healthBody.service, 'jsgames');
        assert.equal(healthBody.realtime.players, 0);

        client = await openClient(`ws://127.0.0.1:${port}`, origin);
        await client.waitFor(message => message.type === 'session');
        client.sendJson({ type: 'createRoom', gameType: 'loveletter', roomName: '部署烟测', isPublic: true, seatLimit: 2 });
        const created = await client.waitFor(message => message.type === 'roomCreated');
        assert.match(created.roomId, /^\d{6}$/);
        client.sendJson({ type: 'leaveRoom' });
        await client.closeCleanly();
        client = null;

        const exited = waitForExit(child);
        child.kill('SIGTERM');
        const result = await exited;
        assert.equal(result.signal, null, childOutput);
        assert.equal(result.code, 0, childOutput);
        console.log(`deployment smoke: PASS · production-shaped start, healthz, WebSocket room and SIGTERM (${port})`);
    } catch (error) {
        await client?.closeCleanly().catch(() => {});
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        await waitForExit(child).catch(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        });
        throw new Error(`${error.message}${childOutput ? `\n${childOutput.trim()}` : ''}`);
    }
}

run().catch(error => {
    console.error(`deployment smoke: ERROR · ${error.message}`);
    process.exitCode = 1;
});
