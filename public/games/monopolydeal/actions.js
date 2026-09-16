import { decisionReady, needsPlayerTarget, ownProperties, selectedCard, targetProperties } from './state.js';

/** User interaction handlers for 大富翁纸牌. */
export function createMonopolyDealActions({ mount, model, scene, renderer, send, rulesModal, archiveModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    function presentationLocked() { return scene?.isPlaying?.() || model.presentationPlaying || Date.now() < Number(model.presentationLockedUntil || 0); }
    function setSubmissionPending(pending) { model.submissionPending = Boolean(pending); const root = mount.querySelector('.deal-game'); root?.classList.toggle('is-submitting', model.submissionPending); root?.classList.toggle('is-presentation-locked', presentationLocked()); root?.setAttribute('aria-busy', (model.submissionPending || presentationLocked()) ? 'true' : 'false'); }
    function handAction(kind, cardIndex, extra = {}) { const card = state()?.myHand?.[cardIndex]; return { kind, cardIndex, cardId: card?.id, ...extra }; }
    function submitAction(action) { if (model.submissionPending) return false; if (presentationLocked()) return false; setSubmissionPending(true); try { send({ type: 'gameAction', action }); return true; } catch (error) { setSubmissionPending(false); throw error; } }
    function clearSelection() { Object.assign(model, { assetPicking: false, assetDraft: null, discardIds: [], selected: null, hoveredCardIndex: null, targetId: null, targetColor: null, targetGroupId: null, targetPropertyId: null, ownColor: null, ownGroupId: null, ownPropertyId: null, paymentIds: [], moveCardId: null, moveFromColor: null, moveFromGroupId: null, moveToColor: null, moveToGroupId: null, choiceMode: null }); }
    function openAssets(target) { model.assetPlayerId = target?.closest('[data-player-id]')?.dataset.playerId || null; model.archiveKind = 'assets'; renderer.renderArchive?.('assets'); archiveModal?.setOpen(true); }
    function beginPropertyMove(control) {
        model.selected = null;
        model.targetId = null;
        model.targetColor = null;
        model.targetGroupId = null;
        model.moveCardId = control.dataset.moveCardId;
        model.moveFromColor = control.dataset.fromColor;
        model.moveFromGroupId = control.dataset.fromGroupId;
        model.moveToColor = null;
        model.moveToGroupId = null;
        model.choiceMode = 'move';
        model.archiveKind = null;
        archiveModal?.setOpen(false);
        renderer.render();
    }

    function hoverAvailable() {
        return globalThis.window?.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false;
    }

    function handlePointerOver(event) {
        if (!hoverAvailable() || presentationLocked() || model.selected !== null) return;
        const card = event.target.closest('.deal-hand [data-card-index]');
        if (!card || card.disabled) return;
        const index = Number(card.dataset.cardIndex);
        if (!Number.isInteger(index) || model.hoveredCardIndex === index) return;
        model.hoveredCardIndex = index;
        renderer.refreshEvent?.();
    }

    function handlePointerOut(event) {
        if (model.hoveredCardIndex === null || model.selected !== null) return;
        const card = event.target.closest('.deal-hand [data-card-index]');
        if (!card || card.contains(event.relatedTarget)) return;
        model.hoveredCardIndex = null;
        renderer.refreshEvent?.();
    }

    function handleChange(event) {
        if (presentationLocked()) return;
        const value = state(); const field = event.target.dataset.field;
        if (field === 'targetId') { model.targetId = event.target.value || null; model.targetColor = null; model.targetGroupId = null; model.targetPropertyId = null; renderer.render(); }
        if (field === 'targetGroupId') { model.targetGroupId = event.target.value || null; model.targetColor = event.target.selectedOptions[0]?.dataset.groupColor || null; renderer.render(); }
        if (field === 'targetPropertyId') { model.targetPropertyId = event.target.value || null; const item = targetProperties(value, model).find(property => property.id === model.targetPropertyId); model.targetColor = item?.color || null; model.targetGroupId = item?.groupId || null; renderer.render(); }
        if (field === 'ownPropertyId') { model.ownPropertyId = event.target.value || null; const item = ownProperties(value).find(property => property.id === model.ownPropertyId); model.ownColor = item?.color || null; model.ownGroupId = item?.groupId || null; renderer.render(); }
    }

    function handleClick(event) {
        if (presentationLocked()) { event.preventDefault(); if (event.target.closest('[data-action="skip-victory"]')) scene.skipPresentation?.(); return; }
        if (model.submissionPending && event.target.closest('[data-action], [data-payment-id], [data-choice-target-id], [data-choice-color], [data-move-card-id], [data-card-index]')) { event.preventDefault(); return; }
        const assetPick = event.target.closest('[data-asset-pick]');
        if (model.assetPicking && assetPick) {
            model.assetDraft = { groupId: assetPick.dataset.groupId, color: assetPick.dataset.color, cardId: assetPick.dataset.cardId || null };
            renderer.renderArchive('assets'); return;
        }
        if (model.assetPicking && event.target.closest('[data-action="confirmAssetPick"]')) {
            if (!model.assetDraft) return;
            model.targetGroupId = model.assetDraft.groupId; model.targetColor = model.assetDraft.color; model.targetPropertyId = model.assetDraft.cardId;
            model.assetPicking = false; model.assetDraft = null; model.archiveKind = null;
            archiveModal?.setOpen(false); renderer.render(); return;
        }
        if (model.assetPicking && (event.target.closest('[data-action="closeArchive"]') || event.target === $('archiveOverlay'))) {
            model.assetPicking = false; model.assetDraft = null; model.targetId = null;
            model.targetGroupId = null; model.targetPropertyId = null; model.targetColor = null;
            model.archiveKind = null; archiveModal?.setOpen(false); renderer.render(); return;
        }
        const denomination = event.target.closest('[data-payment-value], [data-payment-remove]');
        if (denomination && state().pendingDebt?.payerId === state().myId) {
            const removing = denomination.dataset.paymentRemove !== undefined;
            const value = Number(denomination.dataset.paymentRemove ?? denomination.dataset.paymentValue);
            const item = (state().myPaymentOptions || []).find(item => item.zone === 'bank' && item.value === value && model.paymentIds.includes(item.id) === removing);
            if (item) model.paymentIds = removing ? model.paymentIds.filter(id => id !== item.id) : [...model.paymentIds, item.id];
            renderer.renderArchive('payment'); return;
        }
        const payment = event.target.closest('[data-payment-id]');
        if (payment) { const id = payment.dataset.paymentId; model.paymentIds = model.paymentIds.includes(id) ? model.paymentIds.filter(item => item !== id) : [...model.paymentIds, id]; renderer.render(); return; }
        const choiceTarget = event.target.closest('[data-choice-target-id]');
        if (choiceTarget) { model.targetId = choiceTarget.dataset.choiceTargetId; renderer.render(); return; }
        const choiceColor = event.target.closest('[data-choice-color]');
        if (choiceColor) { if (model.choiceMode === 'move') { model.moveToColor = choiceColor.dataset.choiceColor; model.moveToGroupId = choiceColor.dataset.choiceGroupId; } else { model.targetColor = choiceColor.dataset.choiceColor; model.targetGroupId = choiceColor.dataset.choiceGroupId; } renderer.render(); return; }
        const move = event.target.closest('[data-move-card-id]');
        if (move) { beginPropertyMove(move); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && card.closest('.deal-hand') && state().availableActions?.canDiscard) {
            const id = state().myHand[Number(card.dataset.cardIndex)]?.id;
            const selected = model.discardIds || [];
            if (selected.includes(id)) model.discardIds = selected.filter(item => item !== id);
            else if (selected.length < state().myHand.length - 7) model.discardIds = [...selected, id];
            model.selected = null; model.hoveredCardIndex = null; renderer.render(); return;
        }
        if (card && card.closest('.deal-hand') && !event.target.closest('[data-action]')) { model.selected = Number(card.dataset.cardIndex); model.hoveredCardIndex = null; model.targetId = null; model.targetColor = null; model.targetGroupId = null; model.targetPropertyId = null; model.ownColor = null; model.ownGroupId = null; model.ownPropertyId = null; model.paymentIds = []; model.moveCardId = null; model.moveFromColor = null; model.moveFromGroupId = null; model.moveToColor = null; model.moveToGroupId = null; const picked = selectedCard(state(), model); model.choiceMode = picked?.kind === 'rent' ? 'rent' : ['property', 'property_wild'].includes(picked?.kind) ? 'property' : null; renderer.render(); return; }
        const assetArea = event.target.closest('[data-action="openAssets"]');
        const target = event.target.closest('[data-target-id]') || event.target.closest('.deal-opponent.is-selectable[data-player-id]');
        const pickedCard = selectedCard(state(), model);
        if (target && needsPlayerTarget(pickedCard)) {
            model.targetId = target.dataset.targetId || target.dataset.playerId;
            // An any-rent card is selected in two stages: first choose the
            // colour/group, then choose the payer.  Do not erase the first
            // choice when the seat is clicked, otherwise the user is sent
            // back into the colour picker and can never submit the rent.
            if (pickedCard?.kind !== 'rent') {
                model.targetColor = null;
                model.targetGroupId = null;
            }
            model.targetPropertyId = null;
            if (['slyDeal', 'dealBreaker'].includes(pickedCard?.action)) {
                model.assetPicking = true; model.assetDraft = null;
                model.assetPlayerId = model.targetId; model.archiveKind = 'assets';
                renderer.render(); renderer.renderArchive('assets'); archiveModal?.setOpen(true); return;
            }
            renderer.render();
            return;
        }
        if (assetArea) {
            if (!needsPlayerTarget(pickedCard)) openAssets(assetArea);
            return;
        }
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) {
            if (event.target.closest('[data-ui="rules"]')) rulesModal?.setOpen(true);
            if (event.target.closest('[data-ui="closeRules"]') || event.target === $('rulesOverlay')) rulesModal ? rulesModal.setOpen(false) : $('rulesOverlay').classList.add('is-hidden');
            if (event.target === $('choiceOverlay')) { model.choiceMode = null; renderer.render(); }
            if (event.target === $('archiveOverlay')) { model.archiveKind = null; archiveModal?.setOpen(false); }
            return;
        }
        const index = model.selected;
        if (action === 'openPayment' && state().pendingDebt?.payerId === state().myId) { model.archiveKind = 'payment'; renderer.renderArchive('payment'); archiveModal?.setOpen(true); }
        else if (action === 'openPropertyChoice') model.choiceMode = 'property';
        else if (action === 'openRentChoice') model.choiceMode = 'rent';
        else if (action === 'openMoveChoice') model.choiceMode = 'move';
        else if (action === 'closeChoice') model.choiceMode = null;
        else if (action === 'openArchive') { model.archiveKind = event.target.closest('[data-action="openArchive"]')?.dataset.archive || 'history'; renderer.renderArchive?.(model.archiveKind); archiveModal?.setOpen(true); }
        else if (action === 'closeArchive') { model.archiveKind = null; archiveModal?.setOpen(false); }
        else if (action === 'confirmPropertyChoice' && index !== null && model.targetColor && model.targetGroupId) { submitAction(handAction('playCard', index, { color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'confirmRentChoice' && index !== null && model.targetColor && model.targetGroupId) { const card = selectedCard(state(), model); if (Array.isArray(card?.colors) && card.colors.length) { submitAction(handAction('playCard', index, { color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); } else model.choiceMode = null; }
        else if (action === 'confirmMoveChoice' && model.moveCardId && model.moveFromColor && model.moveFromGroupId && model.moveToColor && model.moveToGroupId) { submitAction({ kind: 'moveProperty', cardId: model.moveCardId, fromColor: model.moveFromColor, fromGroupId: model.moveFromGroupId, toColor: model.moveToColor, toGroupId: model.moveToGroupId }); clearSelection(); }
        else if (action === 'drawCards' || action === 'endTurn') submitAction({ kind: action });
        else if (action === 'acceptAction' && decisionReady(model, state())) submitAction({ kind: action });
        else if (action === 'discardCard' && model.discardIds?.length === state().myHand.length - 7) { if (submitAction({ kind: 'discardCard', cardIds: [...model.discardIds] })) clearSelection(); }
        else if (action === 'payDebt') { submitAction({ kind: 'payDebt', cardIds: model.paymentIds }); model.paymentIds = []; }
        else if (action === 'justSayNo' && decisionReady(model, state())) { const responseIndex = Number(event.target.closest('[data-card-index]')?.dataset.cardIndex); submitAction(handAction('justSayNo', responseIndex)); }
        else if (action === 'playBank' && index !== null) { submitAction(handAction('playCard', index, { zone: 'bank' })); clearSelection(); }
        else if (action === 'playRent' && index !== null && model.targetId && model.targetColor && model.targetGroupId) { submitAction(handAction('playCard', index, { targetId: model.targetId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'playDealBreaker' && index !== null && model.targetId && model.targetGroupId) { submitAction(handAction('playCard', index, { targetId: model.targetId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'playAction' && index !== null) { submitAction(handAction('playCard', index, { targetId: model.targetId, targetPropertyId: model.targetPropertyId, targetColor: model.targetColor, targetGroupId: model.targetGroupId, ownPropertyId: model.ownPropertyId, ownColor: model.ownColor, ownGroupId: model.ownGroupId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'clearSelection') clearSelection();
        renderer.render();
    }

    function handleKeydown(event) {
        if (presentationLocked()) { if (event.key === 'Escape') scene.skipPresentation?.(); return; }
        const move = event.target?.closest?.('[data-move-card-id]');
        if (move && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); beginPropertyMove(move); return; }
        if (model.assetPicking && event.target?.closest?.('[data-asset-pick]') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleClick(event); return; }
        if (archiveModal?.trapFocus(event)) return;
        if (rulesModal?.trapFocus(event)) return;
        const assetArea = event.target?.closest?.('[data-action="openAssets"]');
        if (assetArea && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleClick(event); return; }
        if (event.key !== 'Escape') return;
        if (model.assetPicking) { model.assetPicking = false; model.assetDraft = null; model.targetId = null; model.targetGroupId = null; model.targetPropertyId = null; model.targetColor = null; renderer.render(); }
        if (archiveModal?.isOpen()) { model.archiveKind = null; archiveModal.setOpen(false); return; }
        if (!$('choiceOverlay').classList.contains('is-hidden')) { model.choiceMode = null; renderer.render(); }
        else if (rulesModal?.isOpen()) rulesModal.setOpen(false);
        else if (!$('rulesOverlay').classList.contains('is-hidden')) $('rulesOverlay').classList.add('is-hidden');
    }
    return { handleChange, handleClick, handlePointerOver, handlePointerOut, handleKeydown, setSubmissionPending, clearSelection, presentationLocked };
}
