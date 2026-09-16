import { clearSelection, getTargets, normalizeSelection } from './state.js';

/** User input and action dispatch for 情书. */
export function createLoveLetterActions({ mount, model, scene, renderer, send, rulesModal, archiveModal, getElement, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    let guessReturnFocus = null;

    function selectCard(index) {
        const card = model.state?.myHand?.[index];
        if (!card) return;
        model.selectedCardIndex = index;
        model.hoveredCardIndex = null;
        model.selectedTargetId = null;
        if (card.id !== 1) model.selectedGuess = null;
        model.guessOpen = card.id === 1;
        renderer.render();
        if (model.guessOpen) focusDialog('guessOverlay');
    }

    function hoverAvailable() {
        return windowRef?.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false;
    }

    function handlePointerOver(event) {
        if (!hoverAvailable() || model.selectedCardIndex !== null || scene.getViewState().scenePlaying) return;
        const card = event.target.closest('[data-card-index]');
        if (!card || card.disabled) return;
        const index = Number(card.dataset.cardIndex);
        if (model.hoveredCardIndex === index) return;
        model.hoveredCardIndex = index;
        renderer.refreshEvent();
    }

    function handlePointerOut(event) {
        if (model.hoveredCardIndex === null || model.selectedCardIndex !== null) return;
        const card = event.target.closest('[data-card-index]');
        if (!card || card.contains(event.relatedTarget)) return;
        model.hoveredCardIndex = null;
        renderer.refreshEvent();
    }

    function selectTarget(playerId) {
        if (model.pendingAction) return;
        model.selectedTargetId = playerId;
        const card = model.selectedCardIndex === null ? null : model.state?.myHand?.[model.selectedCardIndex];
        if (card?.id === 1 && !model.selectedGuess) model.guessOpen = true;
        renderer.render();
        if (model.guessOpen) focusDialog('guessOverlay');
    }

    function playSelected() {
        const card = model.selectedCardIndex === null ? null : model.state?.myHand?.[model.selectedCardIndex];
        if (!card || model.pendingAction) return;
        model.pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'playCard', cardIndex: model.selectedCardIndex, targetId: model.selectedTargetId, guess: card.id === 1 ? model.selectedGuess : null } });
        renderer.render();
    }

    function startNextRound() {
        if (model.pendingAction) return;
        model.pendingAction = true;
        send({ type: 'gameAction', action: { kind: 'startNextRound' } });
        renderer.render();
    }

    function focusDialog(role) {
        const request = windowRef?.requestAnimationFrame || (callback => windowRef?.setTimeout(callback, 0));
        request(() => $(role)?.querySelector('.ll-dialog-close')?.focus());
    }

    function closeGuessDialog() {
        model.guessOpen = false;
        renderer.render();
        restoreDialogFocus(guessReturnFocus, '[data-action="open-guess"], [data-card-index].is-selected');
        guessReturnFocus = null;
    }

    function restoreDialogFocus(previous, fallbackSelector) {
        const request = windowRef?.requestAnimationFrame || (callback => windowRef?.setTimeout(callback, 0));
        request(() => {
            const target = previous?.isConnected && !previous.disabled ? previous : mount.querySelector(fallbackSelector);
            target?.focus();
        });
    }

    function trapGuessFocus(event) {
        if (!model.guessOpen || event.key !== 'Tab') return false;
        const overlay = $('guessOverlay');
        const focusable = [...overlay.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
            .filter(element => !element.hidden && element.getClientRects().length);
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

    function handleClick(event) {
        const sceneState = scene.getViewState();
        if (sceneState.scenePlaying) {
            const sceneAction = event.target.closest('[data-action="skip-scene"]');
            event.preventDefault();
            return sceneAction ? scene.skipScene() : undefined;
        }
        if (event.target === $('rulesOverlay')) return rulesModal.setOpen(false);
        if (event.target === $('archiveOverlay')) { model.archiveKind = null; return archiveModal.setOpen(false); }
        if (event.target === $('guessOverlay')) { closeGuessDialog(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && !card.disabled) return selectCard(Number(card.dataset.cardIndex));
        const target = event.target.closest('[data-target-id]');
        if (target && !target.disabled) return selectTarget(target.dataset.targetId);
        const guess = event.target.closest('[data-guess]');
        if (guess) { model.selectedGuess = Number(guess.dataset.guess); renderer.render(); return; }
        const action = event.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'skip-scene') return scene.skipScene();
        if (action.dataset.action === 'acknowledge-action') return scene.acknowledgePendingAction(false);
        if (action.dataset.action === 'rules') rulesModal.setOpen(true);
        if (action.dataset.action === 'close-rules') rulesModal.setOpen(false);
        if (action.dataset.action === 'open-archive') { model.archiveKind = action.dataset.archive || 'all'; renderer.renderArchive(model.archiveKind); archiveModal.setOpen(true); }
        if (action.dataset.action === 'close-archive') { model.archiveKind = null; archiveModal.setOpen(false); }
        if (action.dataset.action === 'close-guess') closeGuessDialog();
        if (action.dataset.action === 'confirm-guess' && model.selectedGuess) closeGuessDialog();
        if (action.dataset.action === 'open-guess') { guessReturnFocus = documentRef.activeElement; model.guessOpen = true; renderer.render(); focusDialog('guessOverlay'); }
        if (action.dataset.action === 'clearTarget') { model.selectedTargetId = null; renderer.render(); }
        if (action.dataset.action === 'play') playSelected();
        if (action.dataset.action === 'start-next-round') startNextRound();
        if (action.dataset.action === 'return-lobby' && model.state?.status === 'ended') documentRef.getElementById('leaveRoomBtn')?.click();
    }

    function handleKeydown(event) {
        const sceneState = scene.getViewState();
        if (sceneState.scenePlaying) {
            if (event.key === 'Escape') scene.skipScene();
            return;
        }
        if (trapGuessFocus(event)) return;
        if (archiveModal.trapFocus(event)) return;
        if (rulesModal.trapFocus(event)) return;
        const target = event.target.closest?.('[data-target-id][role="button"]');
        if (target && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            selectTarget(target.dataset.targetId);
            return;
        }
        if (event.key !== 'Escape') return;
        if (rulesModal.isOpen()) rulesModal.setOpen(false);
        if (archiveModal.isOpen()) { model.archiveKind = null; archiveModal.setOpen(false); }
        if (model.guessOpen) closeGuessDialog();
    }

    return Object.freeze({ handleClick, handlePointerOver, handlePointerOut, handleKeydown, clearSelection: () => clearSelection(model), normalizeSelection: () => normalizeSelection(model), getTargets: card => getTargets(model.state, card) });
}
