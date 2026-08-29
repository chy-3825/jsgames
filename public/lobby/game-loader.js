// Lazy game-module and stylesheet loading for the lobby.
// The loader owns cache/in-flight state; callers only provide the render hook
// so waiting-room UI never needs to know how imports are memoized.

export function createGameLoader({ assetVersion, getClientPath, getStyleHrefs, onStateChange = () => {} }) {
    const modulePromises = new Map();
    const preloadStates = new Map();

    function preloadStyles(gameType) {
        getStyleHrefs(gameType).forEach(href => {
            if (document.head.querySelector(`link[data-game-preload="${gameType}"][href="${href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            link.dataset.gamePreload = gameType;
            document.head.appendChild(link);
        });
    }

    function load(gameType) {
        if (!modulePromises.has(gameType)) {
            modulePromises.set(gameType, import(`${getClientPath(gameType)}?v=${assetVersion}`));
        }
        return modulePromises.get(gameType);
    }

    function getState(gameType) {
        return preloadStates.get(gameType) || { status: 'idle', error: '', promise: null };
    }

    function preload(gameType, force = false) {
        const existing = preloadStates.get(gameType);
        if (!force && (existing?.status === 'ready' || existing?.status === 'loading')) {
            return existing.promise || Promise.resolve();
        }
        if (force) modulePromises.delete(gameType);
        preloadStyles(gameType);
        const state = { status: 'loading', error: '', promise: null };
        preloadStates.set(gameType, state);
        onStateChange();
        state.promise = load(gameType).then(module => {
            if (typeof module.createGameClient !== 'function') throw new Error(`${gameType} 没有导出 createGameClient`);
            state.status = 'ready';
            onStateChange();
            return module;
        }).catch(error => {
            state.status = 'error';
            state.error = error?.message || '加载失败';
            modulePromises.delete(gameType);
            onStateChange();
            throw error;
        });
        return state.promise;
    }

    return { load, preload, preloadStyles, getState };
}
