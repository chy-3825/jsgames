import { localizePresentation } from './state.js';

function cloneSnapshot(value) {
    if (!value) return null;
    try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
}

function isAssetPlay(play) {
    return Boolean(play?.card && (play.zone === 'bank'
        || ['money', 'property', 'property_wild'].includes(play.card.kind)
        || ['house', 'hotel'].includes(play.card.action)));
}

function playKey(play) {
    return String(play?.playId ?? play?.card?.id ?? '');
}

/** Coordinates server presentation replay and asset collection effects. */
export function createMonopolyDealPresentation({ model, renderer, scene }) {
    let destroyed = false;

    function enqueueStatePresentations(next) {
        const sourceBatches = next.presentations?.length
            ? next.presentations
            : next.presentation ? [next.presentation] : [];
        if (!Array.isArray(next.presentations) && !next.presentation) return;
        const localNow = Date.now();
        for (const sourceBatch of sourceBatches.slice().sort((left, right) => Number(left.sequence) - Number(right.sequence))) {
            const sequence = Number(sourceBatch.sequence) || 0;
            if (sequence) model.lastPresentationSequence = Math.max(model.lastPresentationSequence, sequence);
            const localized = localizePresentation({ ...sourceBatch, serverNow: sourceBatch.serverNow ?? next.serverNow }, localNow);
            if (!localized) continue;
            const freshEvents = localized.events.filter((event, index) => {
                if (event.kind !== 'finalSettlement') return false;
                if (Number.isFinite(Number(event.endsAt)) && Number(event.endsAt) <= localNow) return false;
                const sourceEvent = sourceBatch.events?.[index] || event;
                const key = `${sourceBatch.transactionId ?? sourceBatch.sequence ?? ''}:${sourceEvent.eventId ?? sourceEvent.sequence ?? index}:${sourceEvent.kind}`;
                if (model.presentationEventIds.has(key)) return false;
                model.presentationEventIds.add(key);
                return true;
            });
            if (freshEvents.length) scene.enqueuePresentation({ ...localized, events: freshEvents });
        }
    }

    function captureState(previous, next) {
        if (!previous || destroyed) return;
        const nextPlay = next?.lastPlayedCard;
        if (nextPlay?.zone === 'discard' && nextPlay.cards?.length) {
            const key = `discard:${nextPlay.playerId}:${nextPlay.cards.map(card => card.id).join(',')}:${next.turnNumber}`;
            const previousCards = previous.lastPlayedCard;
            if (previousCards?.zone === 'discard' && JSON.stringify(previousCards.cards) === JSON.stringify(nextPlay.cards)) return;
            if (!model.collectedPlayKeys.has(key)) { model.collectedPlayKeys.add(key); model.assetAnimationQueue.push({ play: cloneSnapshot(nextPlay), discard: true }); }
            return;
        }
        const previousPlayId = previous.lastPlayedCard?.playId ?? previous.lastPlayedCard?.card?.id;
        const nextPlayId = nextPlay?.playId ?? nextPlay?.card?.id;
        const key = `${nextPlayId ?? ''}:${next?.turnNumber || 0}`;
        if (!isAssetPlay(nextPlay)
            || String(nextPlayId ?? '') === String(previousPlayId ?? '')
            || model.collectedPlayKeys.has(key)) return;
        model.collectedPlayKeys.add(key);
        model.assetAnimationQueue.push({ play: cloneSnapshot(nextPlay), playId: playKey(nextPlay) });
    }

    async function drainAssetCollections() {
        if (destroyed || model.assetAnimationPlaying || !model.assetAnimationQueue.length) return;
        const item = model.assetAnimationQueue.shift();
        model.assetAnimationPlaying = true;
        try {
            // drainAssetCollections runs after render(), so this rectangle belongs
            // to the card that was just played rather than the previous table card.
            const fromRect = renderer.currentTableCardRect?.();
            await Promise.resolve(item.discard ? renderer.animateDiscard?.(item.play) : renderer.animateAssetCollection?.(item.play, fromRect));
        } finally {
            model.assetAnimationPlaying = false;
            if (!destroyed && model.assetAnimationQueue.length) drainAssetCollections();
        }
    }

    return {
        enqueueStatePresentations,
        captureState,
        drainAssetCollections,
        destroy() {
            destroyed = true;
            model.assetAnimationQueue.length = 0;
            model.assetAnimationPlaying = false;
        },
    };
}
