/**
 * Lazy lobby artwork and card entrance animation.
 *
 * Cover downloads and reveal observers are kept outside the protocol entry
 * point so catalog rendering only needs to request a refresh after markup
 * changes.
 */

export function createLobbyArtwork({
    containers = {},
    lobbyView,
    gameMount,
    bggBackgroundArt = {},
    bggComponentArt = {},
    bggComponentLabels = {},
    selfStyledGameArt = new Set(),
    escapeHtml = value => String(value ?? ''),
    documentRef = globalThis.document,
    windowRef = globalThis,
} = {}) {
    const { gamePickerEl, roomListEl, mobileRoomListEl, joinLobbyRoomListEl } = containers;
    const coverArtPromises = new Map();
    let coverArtObserver = null;
    let gameCardRevealObserver = null;
    let activeGameArtStyle = null;
    let activeBggComponentDialog = null;

    function loadCoverArt(source) {
        if (coverArtPromises.has(source)) return coverArtPromises.get(source);
        const ImageImpl = windowRef.Image || globalThis.Image;
        const promise = new Promise((resolve, reject) => {
            if (!ImageImpl) {
                reject(new Error('当前环境不支持封面加载'));
                return;
            }
            const image = new ImageImpl();
            let settled = false;
            const reveal = async () => {
                if (settled) return;
                settled = true;
                try {
                    if (typeof image.decode === 'function') await image.decode();
                } catch {
                    // 已完成下载，仍允许显示。
                }
                resolve(source);
            };
            image.addEventListener('load', reveal, { once: true });
            image.addEventListener('error', () => {
                if (!settled) {
                    settled = true;
                    reject(new Error('封面加载失败'));
                }
            }, { once: true });
            image.src = source;
            if (image.complete && image.naturalWidth) reveal();
        });
        coverArtPromises.set(source, promise);
        return promise;
    }

    function hydrateCoverArt(element) {
        const source = element?.dataset.cardArt;
        if (!source || element.dataset.cardArtLoaded === 'true' || element.dataset.cardArtLoading === 'true') return;
        const variable = element.dataset.cardArtVariable === 'room' ? '--room-art' : '--card-art';
        element.dataset.cardArtLoading = 'true';
        element.classList.add('is-art-loading');
        const request = loadCoverArt(source);
        request.then(() => {
            if (!element.isConnected) return;
            element.style.setProperty(variable, `url(${JSON.stringify(source)})`);
            element.dataset.cardArtLoaded = 'true';
            element.dataset.cardArtLoading = 'false';
            element.classList.remove('is-art-loading');
            windowRef.requestAnimationFrame(() => element.classList.add('is-art-ready'));
        }).catch(() => {
            // A transient CDN/network failure must not poison the shared
            // promise forever; a later lobby snapshot can retry the asset.
            if (coverArtPromises.get(source) === request) coverArtPromises.delete(source);
            if (!element.isConnected) return;
            element.dataset.cardArtLoading = 'false';
            element.classList.remove('is-art-loading');
            element.dataset.cardArtError = 'true';
            element.classList.add('is-art-error');
        });
    }

    function refreshLazyCoverArt() {
        coverArtObserver?.disconnect();
        const elements = [gamePickerEl, roomListEl, mobileRoomListEl, joinLobbyRoomListEl]
            .filter(Boolean)
            .flatMap(container => Array.from(container.querySelectorAll('[data-card-art]')));
        if (typeof windowRef.IntersectionObserver === 'undefined') {
            elements.forEach(hydrateCoverArt);
            return;
        }
        coverArtObserver = new windowRef.IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            hydrateCoverArt(entry.target);
            coverArtObserver.unobserve(entry.target);
        }), { rootMargin: '560px 0px' });
        elements.forEach(element => coverArtObserver.observe(element));
    }

    function prefersReducedLobbyMotion() {
        return Boolean(windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    }

    function completeGameCardReveal(card) {
        if (!card) return;
        card.classList.remove('is-reveal-pending', 'is-revealing');
        card.style.removeProperty('--card-reveal-delay');
        card.dataset.cardRevealed = 'true';
    }

    function revealGameCard(card, order = 0) {
        if (!card?.classList.contains('is-reveal-pending')) return;
        gameCardRevealObserver?.unobserve(card);
        if (prefersReducedLobbyMotion()) {
            completeGameCardReveal(card);
            return;
        }
        const delay = Math.min(Math.max(0, order) * 55, 110);
        card.style.setProperty('--card-reveal-delay', `${delay}ms`);
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            card.removeEventListener('animationend', handleAnimationEnd);
            completeGameCardReveal(card);
        };
        const handleAnimationEnd = event => {
            if (event.target === card && event.animationName === 'gameCardReveal') finish();
        };
        card.addEventListener('animationend', handleAnimationEnd);
        windowRef.requestAnimationFrame(() => {
            if (!card.isConnected) return finish();
            card.classList.add('is-revealing');
        });
        windowRef.setTimeout(finish, 760 + delay);
    }

    function refreshGameCardReveal() {
        gameCardRevealObserver?.disconnect();
        if (documentRef.body.classList.contains('is-entry-view') || lobbyView?.style.display === 'none') return;
        const cards = Array.from(gamePickerEl?.querySelectorAll('.game-card.is-reveal-pending') || [])
            .filter(card => !card.hidden && !card.closest('[data-game-group]')?.hidden);
        if (!cards.length) return;
        if (typeof windowRef.IntersectionObserver === 'undefined' || prefersReducedLobbyMotion()) {
            cards.forEach(completeGameCardReveal);
            return;
        }
        gameCardRevealObserver = new windowRef.IntersectionObserver(entries => {
            entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
                .forEach((entry, index) => revealGameCard(entry.target, index % 3));
        }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
        cards.forEach(card => gameCardRevealObserver.observe(card));
    }

    function applyGameArtwork(gameType) {
        activeGameArtStyle?.remove();
        activeGameArtStyle = null;
        if (!gameMount) return;
        gameMount.removeAttribute('data-bgg-art');
        gameMount.style.removeProperty('--bgg-background-art');
        gameMount.style.removeProperty('--bgg-detail-art');
        if (selfStyledGameArt.has(gameType)) return;
        const background = bggBackgroundArt[gameType];
        if (!background || !gameMount.firstElementChild) return;
        gameMount.dataset.bggArt = gameType;
        gameMount.style.setProperty('--bgg-background-art', `url("${background}")`);
        activeGameArtStyle = documentRef.createElement('style');
        activeGameArtStyle.textContent = `#gameMount[data-bgg-art="${gameType}"] > :first-child { background-image: linear-gradient(135deg, rgba(13, 24, 30, .88), rgba(13, 24, 30, .76)), var(--bgg-background-art) !important; background-position: center; background-size: cover; }`;
        documentRef.head.appendChild(activeGameArtStyle);
    }

    function openBggComponentDialog(source, label) {
        activeBggComponentDialog?.remove();
        const dialog = documentRef.createElement('div');
        dialog.className = 'bgg-art-dialog';
        dialog.innerHTML = `<div class="bgg-art-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}"><button type="button" class="bgg-art-dialog-close" aria-label="关闭">×</button><span>${escapeHtml(label)}</span><img src="${source}" alt="${escapeHtml(label)}"><small>BGG 组件参考图 · 牌面按游戏类型使用</small></div>`;
        const close = () => { dialog.remove(); if (activeBggComponentDialog === dialog) activeBggComponentDialog = null; };
        dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('.bgg-art-dialog-close')) close(); });
        documentRef.body.appendChild(dialog);
        activeBggComponentDialog = dialog;
    }

    function applyBggComponentArt(gameType) {
        const root = gameMount?.firstElementChild;
        const source = bggComponentArt[gameType];
        if (!root || !source || selfStyledGameArt.has(gameType)) return;
        const label = bggComponentLabels[gameType] || '组件图参考';
        gameMount.dataset.bggComponent = gameType;
        root.classList.add('has-bgg-component-art');
        const strip = documentRef.createElement('button');
        strip.type = 'button';
        strip.className = 'bgg-component-strip';
        strip.setAttribute('aria-label', `打开${label}`);
        strip.innerHTML = `<img src="${source}" alt=""><span>BGG 组件图<small>${escapeHtml(label)}</small></span><b>↗</b>`;
        strip.addEventListener('click', () => openBggComponentDialog(source, label));
        root.appendChild(strip);
    }

    function destroyGameArtwork() {
        activeGameArtStyle?.remove();
        activeGameArtStyle = null;
        activeBggComponentDialog?.remove();
        activeBggComponentDialog = null;
        if (!gameMount) return;
        gameMount.removeAttribute('data-bgg-art');
        gameMount.removeAttribute('data-bgg-component');
        gameMount.style.removeProperty('--bgg-background-art');
        gameMount.style.removeProperty('--bgg-detail-art');
    }

    return {
        loadCoverArt,
        hydrateCoverArt,
        refreshLazyCoverArt,
        prefersReducedLobbyMotion,
        completeGameCardReveal,
        revealGameCard,
        refreshGameCardReveal,
        applyGameArtwork,
        applyBggComponentArt,
        destroyGameArtwork,
    };
}
