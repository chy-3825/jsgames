/**
 * Runtime assets owned by each game client.
 *
 * Keep cache-busting versions next to the asset path instead of rebuilding
 * stylesheet URLs in the lobby and in every client independently.  This is a
 * deliberately small manifest for the first migration pass: presentation
 * metadata and artwork remain in the lobby until their own migration.
 */

const freezeAssets = assets => Object.freeze({
    clientPath: assets.clientPath,
    styles: Object.freeze((assets.styles || []).map(style => Object.freeze({ ...style }))),
});

const style = (path, version) => ({ path, version });

export const GAME_ASSETS = Object.freeze({
    acquire: freezeAssets({ clientPath: '/games/acquire/client.js', styles: [style('/games/acquire/style.css', '20260827-frontend-hardening-1')] }),
    aeroplane: freezeAssets({ clientPath: '/games/aeroplane/client.js', styles: [style('/games/aeroplane/style.css', '20260826-mobile-games-3')] }),
    avalon: freezeAssets({ clientPath: '/games/avalon/client.js', styles: [style('/games/avalon/style.css', '20260827-hold-identity-2')] }),
    camelup: freezeAssets({ clientPath: '/games/camelup/client.js', styles: [style('/games/camelup/style.css', '20260827-frontend-hardening-1')] }),
    checkers: freezeAssets({ clientPath: '/games/checkers/client.js', styles: [style('/games/checkers/style.css', '20260826-mobile-games-3')] }),
    chess: freezeAssets({ clientPath: '/games/chess/lobby-client.js', styles: [style('/games/chess/chess3d.css', '20260826-mobile-games-2')] }),
    citadels: freezeAssets({ clientPath: '/games/citadels/client.js', styles: [style('/games/citadels/style.css', '20260827-frontend-hardening-1')] }),
    coup: freezeAssets({ clientPath: '/games/coup/client.js', styles: [style('/games/coup/style.css', '20260827-settlement-scenes-1')] }),
    decrypto: freezeAssets({ clientPath: '/games/decrypto/client.js', styles: [style('/games/decrypto/style.css', '20260827-online-notebook-1')] }),
    gobang: freezeAssets({ clientPath: '/games/gobang/client.js', styles: [style('/games/gobang/style.css', '20260826-mobile-games-3')] }),
    guessnumber: freezeAssets({ clientPath: '/games/guessnumber/client.js', styles: [style('/games/guessnumber/style.css', '20260827-settlement-scene-1')] }),
    hanabi: freezeAssets({ clientPath: '/games/hanabi/client.js', styles: [style('/games/hanabi/style.css', '20260827-hanabi-a11y-1')] }),
    jungle: freezeAssets({ clientPath: '/games/jungle/client.js', styles: [style('/games/jungle/style.css', '20260826-mobile-games-3')] }),
    junqi: freezeAssets({ clientPath: '/games/junqi/client.js', styles: [style('/games/junqi/style.css', '20260826-mobile-games-2')] }),
    kingdomino: freezeAssets({ clientPath: '/games/kingdomino/client.js', styles: [style('/games/kingdomino/style.css', '20260827-kingdomino-mobile-1')] }),
    lasvegas: freezeAssets({ clientPath: '/games/lasvegas/client.js', styles: [style('/games/lasvegas/style.css', '20260827-frontend-hardening-1')] }),
    loveletter: freezeAssets({ clientPath: '/games/loveletter/client.js', styles: [style('/games/loveletter/style.css', '20260826-mobile-games-4')] }),
    magicalathlete: freezeAssets({ clientPath: '/games/magicalathlete/client.js', styles: [style('/games/magicalathlete/style.css', '20260827-frontend-hardening-1')] }),
    manila: freezeAssets({ clientPath: '/games/manila/client.js', styles: [style('/games/manila/style.css', '20260827-frontend-hardening-1')] }),
    modernart: freezeAssets({ clientPath: '/games/modernart/client.js', styles: [style('/games/modernart/style.css', '20260827-frontend-hardening-1')] }),
    monopoly: freezeAssets({ clientPath: '/games/monopoly/client.js', styles: [style('/games/monopoly/style.css', '20260826-mobile-games-2')] }),
    monopolydeal: freezeAssets({ clientPath: '/games/monopolydeal/client.js', styles: [
        style('/games/monopolydeal/style.css', '20260827-settlement-scenes-1'),
        style('/games/monopolydeal/choice.css', '20260826-mobile-games-4'),
    ] }),
    scout: freezeAssets({ clientPath: '/games/scout/client.js', styles: [style('/games/scout/style.css', '20260827-frontend-hardening-1')] }),
    splendor: freezeAssets({ clientPath: '/games/splendor/client.js', styles: [style('/games/splendor/style.css', '20260827-splendor-mobile-1')] }),
    takefive: freezeAssets({ clientPath: '/games/takefive/client.js', styles: [style('/games/takefive/style.css', '20260826-mobile-shell-1')] }),
    werewolf: freezeAssets({ clientPath: '/games/werewolf/client.js', styles: [style('/games/werewolf/style.css', '20260827-hold-identity-2')] }),
    witchtown: freezeAssets({ clientPath: '/games/witchtown/client.js', styles: [style('/games/witchtown/style.css', '20260827-hold-identity-2')] }),
    xiangqi: freezeAssets({ clientPath: '/games/xiangqi/client.js', styles: [style('/games/xiangqi/style.css', '20260826-mobile-games-2')] }),
});

function getAssets(gameType) {
    const assets = GAME_ASSETS[gameType];
    if (!assets) throw new Error(`未知游戏资源: ${gameType}`);
    return assets;
}

export function getGameAssets(gameType) {
    return getAssets(gameType);
}

export function getGameClientPath(gameType) {
    return getAssets(gameType).clientPath;
}

export function getGameStylePaths(gameType) {
    return getAssets(gameType).styles.map(({ path }) => path);
}

export function getVersionedAssetHref(asset) {
    if (!asset?.path) throw new Error('资源必须包含 path');
    return asset.version ? `${asset.path}?v=${encodeURIComponent(asset.version)}` : asset.path;
}

export function getGameStyleHrefs(gameType) {
    return getAssets(gameType).styles.map(getVersionedAssetHref);
}
