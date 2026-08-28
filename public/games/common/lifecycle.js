/**
 * Small lifecycle scope shared by game clients.
 *
 * Event listeners can use `signal`, while timers, animation frames and
 * arbitrary teardown callbacks can be registered on the same scope.  A game
 * client only needs to call `destroy()` once when its mount is replaced.
 */
export function createClientScope({ controller = new AbortController(), windowRef = globalThis.window || globalThis } = {}) {
    const cleanups = new Set();
    let destroyed = false;

    function addCleanup(cleanup) {
        if (typeof cleanup !== 'function') return cleanup;
        if (destroyed) {
            cleanup();
            return cleanup;
        }
        cleanups.add(cleanup);
        return cleanup;
    }

    function timeout(callback, delay = 0) {
        const id = windowRef?.setTimeout(() => {
            cleanups.delete(cancel);
            if (!destroyed) callback();
        }, delay);
        const cancel = () => windowRef?.clearTimeout(id);
        addCleanup(cancel);
        return id;
    }

    function animationFrame(callback) {
        const request = windowRef?.requestAnimationFrame || (callbackFn => windowRef?.setTimeout(callbackFn, 0));
        const cancelRequest = windowRef?.cancelAnimationFrame || (id => windowRef?.clearTimeout(id));
        const id = request(callback);
        const cancel = () => cancelRequest(id);
        addCleanup(cancel);
        return id;
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        controller.abort();
        for (const cleanup of cleanups) cleanup();
        cleanups.clear();
    }

    return Object.freeze({
        signal: controller.signal,
        addCleanup,
        timeout,
        animationFrame,
        destroy,
        get destroyed() { return destroyed; },
    });
}
