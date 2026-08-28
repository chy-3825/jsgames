import { decisionReady, needsPlayerTarget, ownProperties, selectedCard, targetProperties } from './state.js';

/** User interaction handlers for 大富翁纸牌. */
export function createMonopolyDealActions({ mount, model, scene, renderer, send, rulesModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;
    function setSubmissionPending(pending) { model.submissionPending = Boolean(pending); const root = mount.querySelector('.deal-game'); root?.classList.toggle('is-submitting', model.submissionPending); root?.setAttribute('aria-busy', model.submissionPending ? 'true' : 'false'); }
    function handAction(kind, cardIndex, extra = {}) { const card = state()?.myHand?.[cardIndex]; return { kind, cardIndex, cardId: card?.id, ...extra }; }
    function submitAction(action) { if (model.submissionPending) return false; setSubmissionPending(true); try { send({ type: 'gameAction', action }); return true; } catch (error) { setSubmissionPending(false); throw error; } }
    function clearSelection() { Object.assign(model, { selected: null, targetId: null, targetColor: null, targetGroupId: null, targetPropertyId: null, ownColor: null, ownGroupId: null, ownPropertyId: null, paymentIds: [], moveCardId: null, moveFromColor: null, moveFromGroupId: null, moveToColor: null, moveToGroupId: null, choiceMode: null }); }

    function handleChange(event) {
        const value = state(); const field = event.target.dataset.field;
        if (field === 'targetId') { model.targetId = event.target.value || null; model.targetColor = null; model.targetGroupId = null; model.targetPropertyId = null; renderer.render(); }
        if (field === 'targetGroupId') { model.targetGroupId = event.target.value || null; model.targetColor = event.target.selectedOptions[0]?.dataset.groupColor || null; renderer.render(); }
        if (field === 'targetPropertyId') { model.targetPropertyId = event.target.value || null; const item = targetProperties(value, model).find(property => property.id === model.targetPropertyId); model.targetColor = item?.color || null; model.targetGroupId = item?.groupId || null; renderer.render(); }
        if (field === 'ownPropertyId') { model.ownPropertyId = event.target.value || null; const item = ownProperties(value).find(property => property.id === model.ownPropertyId); model.ownColor = item?.color || null; model.ownGroupId = item?.groupId || null; renderer.render(); }
    }

    function handleClick(event) {
        if (scene.isPlaying()) { event.preventDefault(); if (event.target.closest('[data-action="skip-victory"]')) scene.hideVictoryScene(); return; }
        if (model.submissionPending && event.target.closest('[data-action], [data-payment-id], [data-choice-target-id], [data-choice-color], [data-move-card-id], [data-card-index]')) { event.preventDefault(); return; }
        const payment = event.target.closest('[data-payment-id]');
        if (payment) { const id = payment.dataset.paymentId; model.paymentIds = model.paymentIds.includes(id) ? model.paymentIds.filter(item => item !== id) : [...model.paymentIds, id]; renderer.render(); return; }
        const choiceTarget = event.target.closest('[data-choice-target-id]');
        if (choiceTarget) { model.targetId = choiceTarget.dataset.choiceTargetId; renderer.render(); return; }
        const choiceColor = event.target.closest('[data-choice-color]');
        if (choiceColor) { if (model.choiceMode === 'move') { model.moveToColor = choiceColor.dataset.choiceColor; model.moveToGroupId = choiceColor.dataset.choiceGroupId; } else { model.targetColor = choiceColor.dataset.choiceColor; model.targetGroupId = choiceColor.dataset.choiceGroupId; } renderer.render(); return; }
        const move = event.target.closest('[data-move-card-id]');
        if (move) { model.selected = null; model.targetId = null; model.targetColor = null; model.targetGroupId = null; model.moveCardId = move.dataset.moveCardId; model.moveFromColor = move.dataset.fromColor; model.moveFromGroupId = move.dataset.fromGroupId; model.moveToColor = null; model.moveToGroupId = null; model.choiceMode = 'move'; renderer.render(); return; }
        const card = event.target.closest('[data-card-index]');
        if (card && !event.target.closest('[data-action]')) { model.selected = Number(card.dataset.cardIndex); model.targetId = null; model.targetColor = null; model.targetGroupId = null; model.targetPropertyId = null; model.ownColor = null; model.ownGroupId = null; model.ownPropertyId = null; model.paymentIds = []; model.moveCardId = null; model.moveFromColor = null; model.moveFromGroupId = null; model.moveToColor = null; model.moveToGroupId = null; const picked = selectedCard(state(), model); model.choiceMode = picked?.kind === 'rent' ? 'rent' : ['property', 'property_wild'].includes(picked?.kind) ? 'property' : null; renderer.render(); return; }
        const target = event.target.closest('[data-target-id]');
        if (target && needsPlayerTarget(selectedCard(state(), model))) { model.targetId = target.dataset.targetId; model.targetColor = null; model.targetGroupId = null; model.targetPropertyId = null; renderer.render(); return; }
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) {
            if (event.target.closest('[data-ui="rules"]')) rulesModal?.setOpen(true);
            if (event.target.closest('[data-ui="closeRules"]') || event.target === $('rulesOverlay')) rulesModal ? rulesModal.setOpen(false) : $('rulesOverlay').classList.add('is-hidden');
            if (event.target.closest('[data-ui="bank"]') || event.target.closest('[data-ui="discard"]')) $('ledgerOverlay').classList.remove('is-hidden');
            if (event.target === $('ledgerOverlay')) $('ledgerOverlay').classList.add('is-hidden');
            if (event.target === $('choiceOverlay')) { model.choiceMode = null; renderer.render(); }
            return;
        }
        const index = model.selected;
        if (action === 'openPropertyChoice') model.choiceMode = 'property';
        else if (action === 'openRentChoice') model.choiceMode = 'rent';
        else if (action === 'openMoveChoice') model.choiceMode = 'move';
        else if (action === 'closeChoice') model.choiceMode = null;
        else if (action === 'closeLedger') $('ledgerOverlay').classList.add('is-hidden');
        else if (action === 'confirmPropertyChoice' && index !== null && model.targetColor && model.targetGroupId) { submitAction(handAction('playCard', index, { color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'confirmRentChoice' && index !== null && model.targetColor && model.targetGroupId) { submitAction(handAction('playCard', index, { targetId: model.targetId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'confirmMoveChoice' && model.moveCardId && model.moveFromColor && model.moveFromGroupId && model.moveToColor && model.moveToGroupId) { submitAction({ kind: 'moveProperty', cardId: model.moveCardId, fromColor: model.moveFromColor, fromGroupId: model.moveFromGroupId, toColor: model.moveToColor, toGroupId: model.moveToGroupId }); clearSelection(); }
        else if (action === 'drawCards' || action === 'endTurn') submitAction({ kind: action });
        else if (action === 'acceptAction' && decisionReady(model, state())) submitAction({ kind: action });
        else if (action === 'discardCard' && index !== null) { submitAction(handAction('discardCard', index)); clearSelection(); }
        else if (action === 'payDebt') { submitAction({ kind: 'payDebt', cardIds: model.paymentIds }); model.paymentIds = []; }
        else if (action === 'justSayNo' && decisionReady(model, state())) { const responseIndex = Number(event.target.closest('[data-card-index]')?.dataset.cardIndex); submitAction(handAction('justSayNo', responseIndex)); }
        else if (action === 'playBank' && index !== null) { submitAction(handAction('playCard', index, { zone: 'bank' })); clearSelection(); }
        else if (action === 'playDealBreaker' && index !== null && model.targetId && model.targetGroupId) { submitAction(handAction('playCard', index, { targetId: model.targetId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'playAction' && index !== null) { submitAction(handAction('playCard', index, { targetId: model.targetId, targetPropertyId: model.targetPropertyId, targetColor: model.targetColor, targetGroupId: model.targetGroupId, ownPropertyId: model.ownPropertyId, ownColor: model.ownColor, ownGroupId: model.ownGroupId, color: model.targetColor, groupId: model.targetGroupId })); clearSelection(); }
        else if (action === 'clearSelection') clearSelection();
        renderer.render();
    }

    function handleKeydown(event) {
        if (scene.isPlaying()) { if (event.key === 'Escape') scene.hideVictoryScene(); return; }
        if (rulesModal?.trapFocus(event)) return;
        if (event.key !== 'Escape') return;
        if (!$('choiceOverlay').classList.contains('is-hidden')) { model.choiceMode = null; renderer.render(); }
        else if (!$('ledgerOverlay').classList.contains('is-hidden')) $('ledgerOverlay').classList.add('is-hidden');
        else if (rulesModal?.isOpen()) rulesModal.setOpen(false);
        else if (!$('rulesOverlay').classList.contains('is-hidden')) $('rulesOverlay').classList.add('is-hidden');
    }
    return { handleChange, handleClick, handleKeydown, setSubmissionPending, clearSelection };
}
