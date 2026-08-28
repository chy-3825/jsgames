/**
 * Prevent duplicate client actions while a server acknowledgement is pending.
 */
export function createActionLock({ onChange } = {}) {
    let pending = false;
    const notify = () => onChange?.(pending);

    return Object.freeze({
        get pending() { return pending; },
        lock() {
            if (pending) return false;
            pending = true;
            notify();
            return true;
        },
        unlock() {
            if (!pending) return false;
            pending = false;
            notify();
            return true;
        },
    });
}
