/** User input handlers for the 牛头王 table. */
export function createTakeFiveActions({ mount, model, scene, renderer, send, rulesModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));

    function handleClick(event) {
        const earlyUi = event.target.closest('[data-ui]')?.dataset.ui;
        const sceneState = scene.getViewState();
        if (sceneState.scenePlaying) {
            event.preventDefault();
            if (earlyUi === 'skipSettlement') scene.hideSettlement();
            return;
        }
        if (sceneState.presentationBusy) {
            event.preventDefault();
            if (earlyUi === 'skipResolution') scene.skipResolutionPresentation();
            return;
        }
        const card = event.target.closest('[data-card-id]');
        if (card && !card.disabled) {
            if (card.dataset.cardAction === 'stageCard') {
                model.pendingCardId = card.dataset.cardId;
                model.confirmingCard = false;
                renderer.renderHand();
                return;
            }
            send({
                type: 'gameAction',
                action: { kind: card.dataset.cardAction, cardId: card.dataset.cardId },
            });
            return;
        }
        const row = event.target.closest('[data-row-index]');
        if (row && sceneState.rowChoiceReady && !model.rowChoiceSubmitting) {
            model.pendingRowIndex = Number(row.dataset.rowIndex);
            renderer.render();
            return;
        }
        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;

        if (ui === 'confirmCard' && model.pendingCardId && !model.confirmingCard) {
            model.confirmingCard = true;
            renderer.renderHand();
            send({ type: 'gameAction', action: { kind: 'selectCard', cardId: model.pendingCardId } });
        }
        if (ui === 'confirmRow' && model.pendingRowIndex !== null && sceneState.rowChoiceReady && !model.rowChoiceSubmitting) {
            model.rowChoiceSubmitting = true;
            renderer.render();
            send({ type: 'gameAction', action: { kind: 'chooseRow', rowIndex: model.pendingRowIndex } });
        }
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === $('rules')) rulesModal.setOpen(false);
    }

    function handleKeydown(event) {
        const sceneState = scene.getViewState();
        if (sceneState.scenePlaying) {
            if (event.key === 'Escape') scene.hideSettlement();
            return;
        }
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return Object.freeze({ handleClick, handleKeydown });
}
