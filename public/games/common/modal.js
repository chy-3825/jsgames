function getFocusable(overlay) {
    return [...overlay.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getClientRects().length);
}

/**
 * Accessible modal behavior used by game rules/help overlays.
 */
export function createModalController({ root, overlay, documentRef = globalThis.document, windowRef = globalThis.window || globalThis, initialOpen = false, fallbackFocus = () => null } = {}) {
    if (!root || !overlay) throw new Error('modal 需要 root 和 overlay');
    let open = false;
    let returnFocus = null;

    function setOpen(nextOpen) {
        const next = Boolean(nextOpen);
        if (next === open) return;
        if (next) returnFocus = documentRef?.activeElement || null;
        const wasOpen = open;
        open = next;
        overlay.classList.toggle('is-hidden', !open);
        overlay.setAttribute('aria-hidden', String(!open));
        [...root.children].forEach(child => { child.inert = open && child !== overlay; });
        if (open) {
            windowRef?.requestAnimationFrame?.(() => overlay.querySelector('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')?.focus());
        } else if (wasOpen) {
            windowRef?.requestAnimationFrame?.(() => {
                const target = returnFocus?.isConnected ? returnFocus : fallbackFocus?.();
                target?.focus();
            });
        }
    }

    function trapFocus(event) {
        if (!open || event.key !== 'Tab') return false;
        const focusable = getFocusable(overlay);
        if (!focusable.length) return false;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (documentRef.activeElement === first || !overlay.contains(documentRef.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (documentRef.activeElement === last || !overlay.contains(documentRef.activeElement))) {
            event.preventDefault();
            first.focus();
        }
        return true;
    }

    function destroy() {
        const wasOpen = open;
        open = false;
        overlay.classList.add('is-hidden');
        overlay.setAttribute('aria-hidden', 'true');
        [...root.children].forEach(child => { child.inert = false; });
        if (wasOpen) returnFocus = null;
    }

    if (initialOpen) setOpen(true);

    return Object.freeze({
        setOpen,
        trapFocus,
        destroy,
        isOpen: () => open,
    });
}
