'use strict';

const { networkInterfaces } = require('os');

function isUsableLanIp(name, address) {
    const lowerName = String(name || '').toLowerCase();
    if (
        lowerName.includes('vmware') ||
        lowerName.includes('virtual') ||
        lowerName.includes('loopback') ||
        lowerName.includes('bluetooth') ||
        lowerName.includes('meta')
    ) {
        return false;
    }
    if (address.startsWith('198.18.') || address.startsWith('169.254.')) return false;
    return (
        address.startsWith('192.168.') ||
        address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
}

function getLanIp() {
    const nets = networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) candidates.push({ name, address: net.address });
        }
    }
    const preferred = candidates.find(({ name, address }) => isUsableLanIp(name, address));
    return preferred?.address || candidates[0]?.address || '127.0.0.1';
}

module.exports = { getLanIp, isUsableLanIp };

