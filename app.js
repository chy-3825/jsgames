'use strict';

const express = require('express');
const path = require('path');
const packageJson = require('./package.json');
const { isDevelopmentPublicPath } = require('./server/public-files');

const { getLanIp } = require('./server/realtime/lan-ip');
const { createRealtimeServer } = require('./server/realtime/create-realtime-server');

const app = express();
app.disable('x-powered-by');
if (process.env.JSGAMES_TRUST_PROXY === 'true') app.set('trust proxy', true);
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws: wss:",
    ].join('; '));
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (req.secure || forwardedProto === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});
const publicStaticOptions = process.env.NODE_ENV === 'production' ? {} : {
    setHeaders(res, filePath) {
        if (/\.(?:css|html?|js|mjs|json)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store');
        }
    },
};
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        let pathname;
        try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
        if (isDevelopmentPublicPath(pathname)) return res.sendStatus(404);
        next();
    });
}
app.use(express.static(path.join(__dirname, 'public'), publicStaticOptions));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));

const realtime = createRealtimeServer();

app.get('/api/ip', (req, res) => {
    res.json({ ip: getLanIp() });
});

app.get('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        status: 'ok',
        service: packageJson.name,
        version: packageJson.version,
        realtime: realtime.getStats(),
    });
});

// Keep the historical app.startWebSocketServer(server) contract for bin/www,
// smoke scripts and integrations, while the actual state lives in an isolated
// factory instance. Consumers that need more than one lobby can use the
// exported factory or app.createRealtimeServer().
app.startWebSocketServer = server => realtime.startWebSocketServer(server);
app.closeWebSocketServer = () => realtime.close();
app.getRealtimeStats = () => realtime.getStats();
app.createRealtimeServer = createRealtimeServer;

module.exports = app;

console.log('Lobby is ready');
