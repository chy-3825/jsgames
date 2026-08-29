'use strict';

// Runtime limits are deliberately kept in one small module so the realtime
// service and its tests use the same policy.  Values can be overridden by the
// factory options or the corresponding JSGAMES_* environment variables.
const DEFAULT_SECURITY_POLICY = Object.freeze({
    maxPayload: 256 * 1024,
    maxMessageDepth: 8,
    maxMessageKeys: 256,
    maxMessageStringLength: 16 * 1024,
    messageRateLimit: 120,
    ipMessageRateLimit: 600,
    roomMessageRateLimit: 1000,
    rateWindowMs: 10_000,
    chatRateLimit: 10,
    chatRateWindowMs: 10_000,
    maxChatLength: 500,
    maxConnectionsPerIp: 100,
    heartbeatIntervalMs: 30_000,
});

function positiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) return fallback;
    return number;
}

function resolveSecurityPolicy(overrides = {}, env = process.env) {
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    const value = (key, envKey, options = {}) => positiveInteger(
        source[key] ?? env[envKey],
        DEFAULT_SECURITY_POLICY[key],
        options,
    );
    return Object.freeze({
        maxPayload: value('maxPayload', 'JSGAMES_WS_MAX_PAYLOAD', { min: 1024, max: 10 * 1024 * 1024 }),
        maxMessageDepth: value('maxMessageDepth', 'JSGAMES_WS_MAX_JSON_DEPTH', { min: 2, max: 32 }),
        maxMessageKeys: value('maxMessageKeys', 'JSGAMES_WS_MAX_JSON_KEYS', { min: 16, max: 10_000 }),
        maxMessageStringLength: value('maxMessageStringLength', 'JSGAMES_WS_MAX_STRING', { min: 256, max: 1 * 1024 * 1024 }),
        messageRateLimit: value('messageRateLimit', 'JSGAMES_WS_MESSAGE_RATE', { min: 10, max: 10_000 }),
        ipMessageRateLimit: value('ipMessageRateLimit', 'JSGAMES_WS_IP_MESSAGE_RATE', { min: 20, max: 100_000 }),
        roomMessageRateLimit: value('roomMessageRateLimit', 'JSGAMES_WS_ROOM_MESSAGE_RATE', { min: 20, max: 100_000 }),
        rateWindowMs: value('rateWindowMs', 'JSGAMES_WS_RATE_WINDOW_MS', { min: 1000, max: 300_000 }),
        chatRateLimit: value('chatRateLimit', 'JSGAMES_CHAT_RATE', { min: 1, max: 1000 }),
        chatRateWindowMs: value('chatRateWindowMs', 'JSGAMES_CHAT_RATE_WINDOW_MS', { min: 1000, max: 300_000 }),
        maxChatLength: value('maxChatLength', 'JSGAMES_CHAT_MAX_LENGTH', { min: 16, max: 4000 }),
        maxConnectionsPerIp: value('maxConnectionsPerIp', 'JSGAMES_WS_MAX_CONNECTIONS_PER_IP', { min: 1, max: 10_000 }),
        heartbeatIntervalMs: value('heartbeatIntervalMs', 'JSGAMES_WS_HEARTBEAT_MS', { min: 5000, max: 300_000 }),
    });
}

function parseAllowedOrigins(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function requestProtocol(request) {
    const forwarded = String(request?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
    if (forwarded === 'http' || forwarded === 'https') return forwarded;
    return request?.socket?.encrypted ? 'https' : 'http';
}

function isOriginAllowed(origin, request, configuredOrigins = []) {
    // Native/non-browser ws clients do not send Origin.  They are still
    // subject to payload and rate limits, while browsers are constrained to
    // the configured list or the request's own origin.
    if (!origin) return true;
    const allowed = parseAllowedOrigins(configuredOrigins);
    if (allowed.includes('*')) return true;
    if (allowed.length) return allowed.includes(origin);
    const host = String(request?.headers?.host || '').trim();
    return Boolean(host && origin === `${requestProtocol(request)}://${host}`);
}

function normalizeIp(value) {
    const text = String(value || '').trim();
    if (!text) return 'unknown';
    if (text.startsWith('::ffff:')) return text.slice(7);
    return text;
}

function getClientIp(request, { trustProxy = false } = {}) {
    if (trustProxy) {
        const forwarded = request?.headers?.['x-real-ip'];
        if (forwarded) return normalizeIp(String(forwarded).split(',')[0]);
    }
    return normalizeIp(request?.socket?.remoteAddress);
}

function inspectJsonValue(value, options = {}) {
    const maxDepth = options.maxDepth ?? options.maxMessageDepth ?? DEFAULT_SECURITY_POLICY.maxMessageDepth;
    const maxKeys = options.maxKeys ?? options.maxMessageKeys ?? DEFAULT_SECURITY_POLICY.maxMessageKeys;
    const maxStringLength = options.maxStringLength ?? options.maxMessageStringLength ?? DEFAULT_SECURITY_POLICY.maxMessageStringLength;
    const seen = new Set();
    let keys = 0;
    function visit(current, depth) {
        if (depth > maxDepth) return false;
        if (typeof current === 'string') return current.length <= maxStringLength;
        if (current == null || typeof current === 'number' || typeof current === 'boolean') return true;
        if (typeof current !== 'object' || seen.has(current)) return false;
        seen.add(current);
        const entries = Array.isArray(current)
            ? current.map((item, index) => [index, item])
            : Object.entries(current);
        keys += entries.length;
        if (keys > maxKeys) return false;
        return entries.every(([, item]) => visit(item, depth + 1));
    }
    return visit(value, 0);
}

function sanitizeChatMessage(value, maxLength = DEFAULT_SECURITY_POLICY.maxChatLength) {
    if (typeof value !== 'string') return { ok: false, message: '聊天内容必须是文本' };
    const clean = value
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return { ok: false, message: '聊天内容不能为空' };
    if ([...clean].length > maxLength) return { ok: false, message: `聊天内容不能超过 ${maxLength} 个字符` };
    return { ok: true, value: clean };
}

function consumeRateLimit(bucket, limit, windowMs, now = Date.now()) {
    if (!bucket || !Number.isInteger(limit) || limit < 1) return false;
    while (bucket.length && now - bucket[0] >= windowMs) bucket.shift();
    if (bucket.length >= limit) return false;
    bucket.push(now);
    return true;
}

module.exports = {
    DEFAULT_SECURITY_POLICY,
    consumeRateLimit,
    getClientIp,
    inspectJsonValue,
    isOriginAllowed,
    normalizeIp,
    parseAllowedOrigins,
    resolveSecurityPolicy,
    sanitizeChatMessage,
};
