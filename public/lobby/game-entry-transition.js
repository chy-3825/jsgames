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
    let transitionToken = 0;

    function cancel() {
        transitionToken += 1;
        activeTransition?.remove();
        activeTransition = null;
    }

    function wait(milliseconds) {
        return new Promise(resolve => windowRef.setTimeout(resolve, milliseconds));
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
        Array.from(roomElement.querySelectorAll('.pregame-seat.is-occupied .pregame-seat-fire')).forEach((fire, index) => {
            const rect = fire.getBoundingClientRect();
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height * .72;
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            const stream = documentRef.createElement('i');
            stream.style.setProperty('--stream-x', `${startX}px`);
            stream.style.setProperty('--stream-y', `${startY}px`);
            stream.style.setProperty('--stream-length', `${Math.hypot(deltaX, deltaY)}px`);
            stream.style.setProperty('--stream-angle', `${Math.atan2(deltaY, deltaX)}rad`);
            stream.style.setProperty('--stream-delay', `${(index % 4) * 24}ms`);
            streamMount.appendChild(stream);
        });
    }

    async function play(gameType) {
        const roomIdAtStart = getRoomId();
        const token = ++transitionToken;
        const roomElement = roomMount.querySelector('.pregame-room');
        if (!roomElement || !isCurrent(token, roomIdAtStart)) {
            if (isCurrent(token, roomIdAtStart)) openGameView();
            return;
        }
        const transition = createTransition(gameType);
        const tableRect = roomElement.querySelector('.pregame-table')?.getBoundingClientRect();
        const portalX = tableRect ? tableRect.left + tableRect.width / 2 : windowRef.innerWidth / 2;
        const portalY = tableRect ? tableRect.top + tableRect.height / 2 : windowRef.innerHeight / 2;
        transition.style.setProperty('--entry-core-x', `${portalX}px`);
        transition.style.setProperty('--entry-core-y', `${portalY}px`);
        prepareStreams(transition, roomElement, portalX, portalY);
        activeTransition = transition;
        documentRef.body.appendChild(transition);
        roomElement.classList.add('is-entry-transitioning');
        try {
            const groups = buildGroups(roomElement);
            const flashWaves = groups;
            const lastFlashWaveBySeat = new Map();
            flashWaves.forEach((group, groupIndex) => group.forEach(seat => lastFlashWaveBySeat.set(seat, groupIndex)));
            const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (!reducedMotion) {
                await Promise.all(flashWaves.map(async (group, groupIndex) => {
                    await wait(groupIndex * 420);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    group.forEach(seat => seat.classList.add('is-entry-flash'));
                    await wait(250);
                    if (!isCurrent(token, roomIdAtStart)) return;
                    group.forEach(seat => {
                        seat.classList.remove('is-entry-flash');
                        if (lastFlashWaveBySeat.get(seat) === groupIndex) seat.classList.add('is-entry-fading');
                    });
                }));
            }
            if (!isCurrent(token, roomIdAtStart)) return;
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
            if (!isCurrent(token, roomIdAtStart)) return;
            openGameView();
            await wait(reducedMotion ? 120 : 560);
        } finally {
            roomElement.classList.remove('is-entry-transitioning');
            if (activeTransition === transition) {
                activeTransition = null;
                transition.remove();
            }
        }
    }

    return { cancel, play, buildGroups };
}
