import { cardMatchesClue, currentTarget, normalizeClueValue } from './state.js';

/** User input and action dispatch for 花火. */
export function createHanabiActions({ mount, model, scene, renderer, send, rulesModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));

    function handleClick(event) {
        const sceneState = scene.getViewState();
        if (sceneState.presentationPlaying) {
            if (event.target.closest('[data-action="skipPresentation"]')) scene.stopPresentation();
            return;
        }
        const target = event.target.closest('[data-target-id]');
        if (target && !target.disabled) {
            model.targetId = target.dataset.targetId;
            normalizeClueValue(model);
            renderer.renderTeammates();
            renderer.renderCommand();
            return;
        }

        const clueKindButton = event.target.closest('[data-clue-kind]');
        if (clueKindButton) {
            model.clueKind = clueKindButton.dataset.clueKind;
            const targetPlayer = currentTarget(model.state, model.targetId);
            const firstCard = targetPlayer?.hand?.find(card => !card.hidden);
            model.clueValue = model.clueKind === 'color' ? firstCard?.color || 'red' : Number(firstCard?.value) || 1;
            renderer.renderTeammates();
            renderer.renderCommand();
            return;
        }

        const clueValueButton = event.target.closest('[data-clue-value]');
        if (clueValueButton && !clueValueButton.disabled) {
            model.clueValue = model.clueKind === 'value' ? Number(clueValueButton.dataset.clueValue) : clueValueButton.dataset.clueValue;
            renderer.renderTeammates();
            renderer.renderCommand();
            return;
        }

        const handCard = event.target.closest('[data-hand-card-id]');
        if (handCard && model.state.availableActions?.canPlay && !model.submittingCardAction) {
            model.pendingCardId = handCard.dataset.handCardId;
            model.submittingCardAction = null;
            renderer.renderHand();
            return;
        }

        const cardAction = event.target.closest('[data-card-action]');
        if (cardAction && !cardAction.disabled) {
            model.submittingCardAction = cardAction.dataset.cardAction;
            renderer.renderHand();
            send({
                type: 'gameAction',
                action: {
                    kind: cardAction.dataset.cardAction === 'play' ? 'playCard' : 'discardCard',
                    cardIndex: Number(cardAction.dataset.index),
                },
            });
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            if (actionButton.dataset.action === 'clearTarget') {
                model.targetId = null;
                renderer.renderTeammates();
                renderer.renderCommand();
            }
            if (actionButton.dataset.action === 'clue' && model.targetId && !actionButton.disabled) {
                model.submittingClue = true;
                renderer.renderTeammates();
                renderer.renderCommand();
                send({
                    type: 'gameAction',
                    action: {
                        kind: 'giveClue',
                        targetId: model.targetId,
                        clueKind: model.clueKind,
                        value: model.clueKind === 'value' ? Number(model.clueValue) : model.clueValue,
                    },
                });
            }
            return;
        }

        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === $('rules')) rulesModal.setOpen(false);
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && scene.getViewState().presentationPlaying) {
            scene.stopPresentation();
            return;
        }
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return Object.freeze({ handleClick, handleKeydown });
}
