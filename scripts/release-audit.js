#!/usr/bin/env node

/** Check release metadata, deployment templates and tracked-file hygiene. */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(label, condition, detail) {
    if (!condition) failures.push(`${label}${detail ? `：${detail}` : ''}`);
}

function hasEvery(text, entries) {
    return entries.every(entry => text.includes(entry));
}

function trackedFiles() {
    try {
        return execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
    } catch (error) {
        failures.push(`无法读取 Git 跟踪文件：${error.message}`);
        return [];
    }
}

function untrackedFiles() {
    try {
        return execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root })
            .toString('utf8').split('\0').filter(Boolean);
    } catch (error) {
        failures.push(`无法读取 Git 未跟踪文件：${error.message}`);
        return [];
    }
}

function main() {
    const packageJson = JSON.parse(read('package.json'));
    const packageLock = JSON.parse(read('package-lock.json'));
    const lockRoot = packageLock.packages?.[''] || {};
    const requiredScripts = [
        'start', 'test', 'test:syntax', 'test:audit', 'test:browser',
        'test:browser:chromium', 'test:performance', 'test:reports', 'test:release', 'test:deploy', 'test:acceptance',
    ];
    const requiredFiles = [
        'app.js', 'bin/www', 'public/index.html', 'public/script.js', 'public/style.css',
        'RELEASE_CHECKLIST.md', 'deploy/README.md', 'deploy/jsgames.service.example',
        'deploy/nginx-jsgames.conf.example', 'server/realtime/security.js', 'scripts/acceptance-gate.js', 'scripts/deployment-smoke.js',
    ];

    check('package metadata', packageJson.name === 'jsgames' && packageJson.private === true, '项目必须保持私有发布包');
    check('package/lock version', packageJson.version === packageLock.version && packageJson.version === lockRoot.version, `${packageJson.version} != ${packageLock.version || 'missing'}`);
    check('lockfile format', packageLock.lockfileVersion === 3, `expected 3, got ${packageLock.lockfileVersion}`);
    check('package scripts', requiredScripts.every(name => Boolean(packageJson.scripts?.[name])), '缺少发布门禁脚本');
    requiredFiles.forEach(file => check(`required file ${file}`, fs.existsSync(path.join(root, file))));

    const appSource = read('app.js');
    check('HTTP security baseline', hasEvery(appSource, [
        "app.disable('x-powered-by')", 'Content-Security-Policy',
        'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
        "app.get('/healthz'",
    ]), '缺少安全响应头或健康检查');
    const realtimeSource = read('server/realtime/create-realtime-server.js');
    check('WebSocket security baseline', hasEvery(realtimeSource, [
        'maxPayload: policy.maxPayload', 'verifyClient:', 'inspectJsonValue',
        'consumeInboundRate', 'heartbeatTick', 'requireReconnectToken',
    ]), '缺少来源、消息边界、限流、心跳或重连令牌门禁');

    const systemd = read('deploy/jsgames.service.example');
    check('systemd template', hasEvery(systemd, [
        'Restart=on-failure', 'Environment=PORT=3000', 'NoNewPrivileges=true',
        'PrivateTmp=true', 'ProtectSystem=full', 'ProtectHome=true', 'ExecStart=',
    ]), '缺少重启、端口或最小权限约束');

    const nginx = read('deploy/nginx-jsgames.conf.example');
    check('nginx websocket template', hasEvery(nginx, [
        'map $http_upgrade $jsgames_connection_upgrade',
        'proxy_pass http://127.0.0.1:3000;', 'proxy_http_version 1.1;',
        'proxy_set_header Upgrade $http_upgrade;',
        'proxy_set_header Connection $jsgames_connection_upgrade;',
        'proxy_read_timeout 86400s;',
    ]), '缺少本机反代或 WebSocket Upgrade 配置');
    check('nginx upstream scope', !nginx.includes('proxy_pass http://0.0.0.0:3000'), '反代不能直接指向公网监听地址');
    const service = read('deploy/jsgames.service.example');
    check('origin configuration guidance', service.includes('JSGAMES_ALLOWED_ORIGINS'), 'systemd 模板未提示配置 HTTPS Origin');

    const ignore = read('.gitignore');
    check('ignore policy', hasEvery(ignore, ['node_modules/', 'tmp/', '.env', '*.log']), '临时目录、依赖、环境变量或日志未全部忽略');
    const files = trackedFiles();
    const untracked = untrackedFiles();
    const hygieneFiles = [...new Set([...files, ...untracked])];
    const forbidden = hygieneFiles.filter(file => {
        const environmentFile = /(^|\/)\.env(?:\.[^/]+)?$/.test(file) && !file.endsWith('.env.example');
        const secretOrLog = /\.(?:log|pem|key|p12|pfx)$/i.test(file);
        return file.startsWith('node_modules/') || file.startsWith('tmp/') || environmentFile || secretOrLog;
    });
    check('tracked file hygiene', forbidden.length === 0, forbidden.join(', '));

    if (failures.length) {
        console.error(failures.map(item => `- ${item}`).join('\n'));
        process.exitCode = 1;
        return;
    }
    console.log(`release audit: package metadata PASS (${packageJson.version})`);
    console.log('release audit: deploy templates PASS');
    console.log('release audit: ignore policy PASS');
    console.log(`release audit: source hygiene PASS (${files.length} tracked + ${untracked.length} untracked, ignored temp excluded)`);
    console.log('release audit: PASS');
}

try {
    main();
} catch (error) {
    console.error(`release audit: ERROR · ${error.message}`);
    process.exitCode = 1;
}
