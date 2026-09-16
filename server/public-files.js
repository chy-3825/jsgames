'use strict';

// Shared by production HTTP, the asset budget and the release packager.
function isDevelopmentPublicPath(relative) {
    const parts = relative.replace(/\\/g, '/').replace(/^\/+/, '').split('/');
    return parts.some(part => part.startsWith('__'))
        || ['visual-fixtures', 'reviews'].includes(parts[0])
        || /\.(?:md|py|psd|xcf)$/i.test(relative);
}

module.exports = { isDevelopmentPublicPath };
