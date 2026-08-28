const loadedStylesByDocument = new WeakMap();

function getStyleRegistry(documentRef) {
    let registry = loadedStylesByDocument.get(documentRef);
    if (!registry) {
        registry = new Map();
        loadedStylesByDocument.set(documentRef, registry);
    }
    return registry;
}

function findExistingLink(documentRef, href) {
    const absoluteHref = (() => {
        try {
            return new URL(href, documentRef.baseURI || globalThis.location?.href || 'http://localhost/').href;
        } catch {
            return href;
        }
    })();
    return [...documentRef.head.querySelectorAll('link[rel="stylesheet"]')]
        .find(link => link.getAttribute('href') === href || link.href === absoluteHref) || null;
}

/**
 * Load one or more stylesheets and return a release handle for client teardown.
 * A reference count prevents duplicate links while a room is being replaced.
 */
export function loadStyles(resources, { documentRef = globalThis.document } = {}) {
    if (!documentRef?.head) return { release() {} };
    const loadedStyles = getStyleRegistry(documentRef);
    const hrefs = (Array.isArray(resources) ? resources : [resources]).filter(Boolean);
    const acquired = [];

    for (const href of hrefs) {
        let entry = loadedStyles.get(href);
        if (!entry) {
            const existing = findExistingLink(documentRef, href);
            const link = existing || documentRef.createElement('link');
            let owned = false;
            if (!existing) {
                link.rel = 'stylesheet';
                link.href = href;
                link.setAttribute('data-jsgames-style', href);
                documentRef.head.appendChild(link);
                owned = true;
            }
            entry = { link, count: 0, owned };
            loadedStyles.set(href, entry);
        }
        entry.count += 1;
        acquired.push({ href, entry });
    }

    let released = false;
    return {
        release() {
            if (released) return;
            released = true;
            for (const { href, entry } of acquired) {
                entry.count -= 1;
                if (entry.count > 0) continue;
                loadedStyles.delete(href);
                if (entry.owned) entry.link.remove();
            }
        },
    };
}
