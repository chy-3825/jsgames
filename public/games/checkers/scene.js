import { BOARD_MAX_X, BOARD_MAX_Y, BOARD_SPAN } from './constants.js';

export function createCheckersScene({ model, boardEl, holesEl, onAnimationComplete, windowRef = globalThis.window || globalThis }) {
    function animateMovements(movements, findStone) {
        if (!movements.length) return;
        const sequence = ++model.animationSequence;
        const width = boardEl.clientWidth;
        const height = boardEl.clientHeight;
        const animations = movements.map(movement => {
            const stone = findStone(movement.pieceId);
            if (!stone || typeof stone.animate !== 'function') return Promise.resolve();
            const dx = (movement.from.x - movement.to.x) * BOARD_SPAN / BOARD_MAX_X * width / 100;
            const dy = (movement.from.y - movement.to.y) * BOARD_SPAN / BOARD_MAX_Y * height / 100;
            const isJump = Math.abs(movement.from.x - movement.to.x) > 2 || Math.abs(movement.from.y - movement.to.y) > 1;
            const middleX = dx * .46;
            const middleY = dy * .46 - (isJump ? Math.max(12, width * .026) : Math.max(5, width * .011));
            const animation = stone.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px) translateY(-4%) scale(1)', filter: 'brightness(1)' },
                { transform: 'translate(' + middleX + 'px,' + middleY + 'px) translateY(-4%) scale(' + (isJump ? '1.1' : '1.04') + ')', filter: 'brightness(1.12)', offset: .48 },
                { transform: 'translate(0,0) translateY(-4%) scale(1)', filter: 'brightness(1)' },
            ], { duration: isJump ? 380 : 250, easing: 'cubic-bezier(.2,.72,.22,1)', fill: 'both' });
            return animation.finished.catch(() => undefined);
        });
        Promise.all(animations).then(() => {
            if (model.destroyed || sequence !== model.animationSequence) return;
            model.animationPending = false;
            onAnimationComplete?.();
        });
    }

    function stop() {
        model.animationSequence += 1;
        model.animationPending = false;
        model.requestTimer && (windowRef.clearTimeout ? windowRef.clearTimeout(model.requestTimer) : clearTimeout(model.requestTimer));
    }

    return { animateMovements, stop };
}
