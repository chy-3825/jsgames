/**
 * The pregame-to-game transition is isolated from protocol handling. It owns
 * only the transient DOM, seat grouping and reduced-motion timing used while
 * the room changes into a live game.
 */

export function createGameEntryTransition({
    roomMount,
    getRoomId = () => null,
    waitingSeatVisualSlot = (seatIndex, capacity) => seatIndex % capacity,
    getGameArt = () => '',
    openGameView = () => {},
    documentRef = globalThis.document,
    windowRef = globalThis,
} = {}) {
    let activeTransition = null;
    let activeRoomElement = null;
    let releaseActiveGeometry = null;
    let transitionToken = 0;
    const pendingWaiters = new Set();

    function cancel() {
        transitionToken += 1;
        for (const waiter of pendingWaiters) {
            windowRef.clearTimeout(waiter.timer);
            waiter.resolve(false);
        }
        pendingWaiters.clear();
        activeRoomElement?.classList.remove('is-entry-transitioning');
        activeRoomElement = null;
        releaseActiveGeometry?.();
        releaseActiveGeometry = null;
        activeTransition?.remove();
        activeTransition = null;
    }

    function wait(milliseconds) {
        const delay = Math.max(0, Number(milliseconds) || 0);
        return new Promise(resolve => {
            const waiter = { timer: null, resolve };
            waiter.timer = windowRef.setTimeout(() => {
                pendingWaiters.delete(waiter);
                resolve(true);
            }, delay);
            pendingWaiters.add(waiter);
        });
    }

    async function waitUntil(deadline, now) {
        const remaining = Number(deadline) - now();
        if (!Number.isFinite(remaining) || remaining <= 0) return false;
        await wait(remaining);
        return true;
    }

    function isCurrent(token, roomId) {
        return token === transitionToken && getRoomId() === roomId;
    }

    function buildGroups(roomElement) {
        const stage = roomElement?.querySelector('.pregame-stage');
        const capacity = Math.max(1, Number(stage?.dataset.seatCount) || 1);
        const visualSlotForSeat = index => waitingSeatVisualSlot(index, capacity);
        const mySeatIndex = Number(roomElement?.querySelector('.pregame-seat.is-me')?.dataset.seatIndex) || 0;
        const myVisualSlot = visualSlotForSeat(mySeatIndex);
        const occupied = Array.from(roomElement?.querySelectorAll('.pregame-seat.is-occupied') || [])
            .map(seat => ({ seat, index: Number(seat.dataset.seatIndex) }))
            .filter(item => Number.isInteger(item.index));
        const relativeSeat = index => (visualSlotForSeat(index) - myVisualSlot + capacity) % capacity;
        const ordered = occupied.sort((left, right) => relativeSeat(left.index) - relativeSeat(right.index));
        if (ordered.length === 1) return [[ordered[0].seat], [ordered[0].seat]];
        if (ordered.length === 2) return ordered.map(item => [item.seat]);
        const remaining = [...ordered];
        const pairs = [];
        while (remaining.length) {
            const first = remaining.shift();
            if (!remaining.length) { pairs.push([first.seat]); break; }
            let partnerPosition = 0;
            let bestDistance = -1;
            remaining.forEach((candidate, position) => {
                const delta = (visualSlotForSeat(candidate.index) - visualSlotForSeat(first.index) + capacity) % capacity;
                const circularDistance = Math.min(delta, capacity - delta);
                if (circularDistance > bestDistance) { bestDistance = circularDistance; partnerPosition = position; }
            });
            pairs.push([first.seat, remaining.splice(partnerPosition, 1)[0].seat]);
        }
        const groupCount = Math.min(4, pairs.length);
        return Array.from({ length: groupCount }, () => []).map((group, index) => {
            for (let pairIndex = index; pairIndex < pairs.length; pairIndex += groupCount) group.push(...pairs[pairIndex]);
            return group;
        });
    }

    function createTransition(gameType) {
        const transition = documentRef.createElement('div');
        transition.className = 'game-entry-transition';
        transition.setAttribute('aria-hidden', 'true');
        const art = getGameArt(gameType);
        if (art) transition.style.setProperty('--entry-art', `url("${art}")`);
        transition.innerHTML = '<div class="game-entry-burst" aria-hidden="true"><i class="game-entry-burst-ring is-wide"></i><i class="game-entry-burst-ring is-tight"></i></div><div class="game-entry-streams" aria-hidden="true"></div><div class="game-entry-portal" aria-hidden="true"><div class="game-entry-portal-plane"><i class="game-entry-portal-ring is-outer"></i><i class="game-entry-portal-ring is-middle"></i><i class="game-entry-portal-ring is-inner"></i><span class="game-entry-portal-well"></span><b>✦</b></div><span class="game-entry-portal-column"></span></div>';
        return transition;
    }

    function prepareStreams(transition, roomElement, targetX, targetY) {
        const streamMount = transition.querySelector('.game-entry-streams');
        const fires = Array.from(roomElement.querySelectorAll('.pregame-seat.is-occupied .pregame-seat-fire'));
        while (streamMount.children.length > fires.length) streamMount.lastElementChild.remove();
        fires.forEach((fire, index) => {
            const rect = fire.getBoundingClientRect();
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height * .72;
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            const stream = streamMount.children[index] || documentRef.createElement('i');
            stream.style.setProperty('--stream-x', `${startX}px`);
            stream.style.setProperty('--stream-y', `${startY}px`);
            stream.style.setProperty('--stream-length', `${Math.hypot(deltaX, deltaY)}px`);
            stream.style.setProperty('--stream-angle', `${Math.atan2(deltaY, deltaX)}rad`);
            stream.style.setProperty('--stream-delay', `${(index % 4) * 24}ms`);
            if (!stream.isConnected) streamMount.appendChild(stream);
        });
    }

    function trackGeometry(transition, roomElement) {
        let active = true;
        let lastSignature = '';
        const update = () => {
            if (!active || !transition.isConnected || !roomElement.isConnected) return;
            const tableRect = roomElement.querySelector('.pregame-table')?.getBoundingClientRect();
            const portalX = tableRect ? tableRect.left + tableRect.width / 2 : windowRef.innerWidth / 2;
            const portalY = tableRect ? tableRect.top + tableRect.height / 2 : windowRef.innerHeight / 2;
            const signature = `${portalX}:${portalY}:${windowRef.innerWidth}:${windowRef.innerHeight}`;
            if (signature === lastSignature) return;
            lastSignature = signature;
            transition.style.setProperty('--entry-core-x', `${portalX}px`);
            transition.style.setProperty('--entry-core-y', `${portalY}px`);
            prepareStreams(transition, roomElement, portalX, portalY);
        };
        const updateImmediately = () => update();
        update();
        windowRef.addEventListener('scroll', updateImmediately, true);
        documentRef.addEventListener('scroll', updateImmediately, true);
        windowRef.addEventListener('resize', updateImmediately);
        windowRef.visualViewport?.addEventListener('resize', updateImmediately);
        windowRef.visualViewport?.addEventListener('scroll', updateImmediately);
        return () => {
            active = false;
            windowRef.removeEventListener('scroll', updateImmediately, true);
            documentRef.removeEventListener('scroll', updateImmediately, true);
            windowRef.removeEventListener('resize', updateImmediately);
            windowRef.visualViewport?.removeEventListener('resize', updateImmediately);
            windowRef.visualViewport?.removeEventListener('scroll', updateImmediately);
        };
    }

    async function play(gameType, entryTransition = null, { openView = true } = {}) {
        // A repeated starting snapshot must replace the previous overlay;
        // otherwise two fixed layers can briefly retain different geometry.
        cancel();
        const roomIdAtStart = getRoomId();
        const token = ++transitionToken;
        const serverNowAtReceipt = Number(entryTransition?.serverNow);
        const localReceipt = Date.now();
        const clockOffset = Number.isFinite(serverNowAtReceipt) ? localReceipt - serverNowAtReceipt : 0;
        const now = () => Date.now() - clockOffset;
        const visibleAt = Number(entryTransition?.gameVisibleAt);
        const roomElement = roomMount.querySelector('.pregame-room');
        if (!roomElement || !isCurrent(token, roomIdAtStart)) {
            if (openView && isCurrent(token, roomIdAtStart)) openGameView();
            return;
        }
        if (Number.isFinite(visibleAt) && now() >= visibleAt) {
            if (openView) openGameView();
            return;
        }
        const transition = createTransition(gameType);
        activeTransition = transition;
        activeRoomElement = roomElement;
        documentRef.body.appendChild(transition);
        const releaseGeometry = trackGeometry(transition, roomElement);
        releaseActiveGeometry = releaseGeometry;
        roomElement.classList.add('is-entry-transitioning');
        try {
            const groups = buildGroups(roomElement);
            const flashWaves = groups;
            const lastFlashWaveBySeat = new Map();
            flashWaves.forEach((group, groupIndex) => group.forEach(seat => lastFlashWaveBySeat.set(seat, groupIndex)));
            const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (!reducedMotion) {
                await Promise.all(flashWaves.map(async (group, groupIndex) => {
                    const delay = Number.isFinite(visibleAt) ? Math.min(groupIndex * 420, Math.max(0, visibleAt - now())) : groupIndex * 420;
                    await wait(delay);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    if (Number.isFinite(visibleAt) && now() >= visibleAt) return;
                    group.forEach(seat => seat.classList.add('is-entry-flash'));
                    await wait(Number.isFinite(visibleAt) ? Math.min(250, Math.max(0, visibleAt - now())) : 250);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    if (Number.isFinite(visibleAt) && now() >= visibleAt) return;
                    group.forEach(seat => {
                        seat.classList.remove('is-entry-flash');
                        if (lastFlashWaveBySeat.get(seat) === groupIndex) seat.classList.add('is-entry-fading');
                    });
                }));
            }
            if (!isCurrent(token, roomIdAtStart)) return;
            if (Number.isFinite(visibleAt)) {
                if (!reducedMotion) {
                    const gatherAt = visibleAt - 960;
                    await waitUntil(gatherAt, now);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    if (now() < visibleAt) {
                        transition.classList.add('is-gathering');
                        await waitUntil(visibleAt - 280, now);
                        if (!isCurrent(token, roomIdAtStart)) return;
                        transition.classList.remove('is-gathering');
                        transition.classList.add('is-bursting');
                    }
                }
                await waitUntil(visibleAt, now);
            } else {
                await wait(320);
                if (!isCurrent(token, roomIdAtStart)) return;
                if (!reducedMotion) {
                    transition.classList.add('is-gathering');
                    await wait(680);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    transition.classList.remove('is-gathering');
                }
                transition.classList.add('is-bursting');
                if (!reducedMotion) await wait(280);
            }
            if (!isCurrent(token, roomIdAtStart)) return;
            if (openView) openGameView();
            await wait(Number.isFinite(visibleAt) ? 120 : (reducedMotion ? 120 : 560));
        } finally {
            roomElement.classList.remove('is-entry-transitioning');
            if (activeRoomElement === roomElement) activeRoomElement = null;
            releaseGeometry();
            if (releaseActiveGeometry === releaseGeometry) {
                releaseActiveGeometry = null;
            }
            if (activeTransition === transition) {
                activeTransition = null;
                transition.remove();
            }
        }
    }

    return { cancel, play, buildGroups };
}
