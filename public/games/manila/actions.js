import { GOODS, GOOD_META, LOCATION_INFO } from './constants.js';
import { getActions, getMyPlayer } from './state.js';

/** User interaction and confirmation drafts for 马尼拉. */
export function createManilaActions({ mount, model, renderer, scene, send, addLog }) {
    const state = () => model.state;
    const actions = () => getActions(state());
    const myPlayer = () => getMyPlayer(state());
    const $ = role => mount.querySelector(`[data-role="${role}"]`);

    function gameAction(kind, extra = {}) {
        if (model.actionPending || model.presentationPlaying) return false;
        model.actionPending = true;
        renderer.clearError();
        send({ type: 'gameAction', action: { kind, ...extra } });
        renderer.render();
        return true;
    }
    function confirmChoice() {
        const choice = model.pendingChoice; if (!choice) return;
        if (choice.kind === 'bid') gameAction('bid', { amount: choice.amount });
        else if (choice.kind === 'pass') gameAction('pass');
        else if (choice.kind === 'buyShare') gameAction('buyShare', { good: choice.good });
        else if (choice.kind === 'skipShare') gameAction('skipShare');
        else if (choice.kind === 'placeAccomplice') gameAction('placeAccomplice', { location: choice.location });
        else if (choice.kind === 'passPlacement') gameAction('passPlacement');
        else if (choice.kind === 'sailBoats') gameAction('sailBoats', { order: choice.order });
        else if (choice.kind === 'skipPilot') gameAction('skipPilot');
        else if (choice.kind === 'boardPirate') gameAction('boardPirate', { boatId: choice.boatId });
        else if (choice.kind === 'skipPirate') gameAction('skipPirate');
        else if (choice.kind === 'plunderDestination') gameAction('plunderDestination', { destination: choice.destination });
    }
    function selectChoice(button) {
        const kind = button.dataset.choice; const value = button.dataset.value; const current = state();
        if (kind === 'bid') {
            const input = mount.querySelector('[data-draft="bid"]'); model.bidDraft = Number(input?.value); const minimum = Number(current.auction?.highestBid || 0) + 1; const maximum = Number(myPlayer()?.cash || 0) + ((current.myShares?.length || 0) - (current.myEncumberedShares?.length || 0)) * 12;
            if (!Number.isInteger(model.bidDraft) || model.bidDraft < minimum || model.bidDraft > maximum) { addLog?.(`出价需为 ${minimum}–${maximum} 的整数`, 'error'); return; }
            model.pendingChoice = { kind: 'bid', amount: model.bidDraft };
        } else if (kind === 'pass') model.pendingChoice = { kind: 'pass' };
        else if (kind === 'share') model.pendingChoice = { kind: 'buyShare', good: value, price: Math.max(5, Number(current.market?.[value] || 0)) };
        else if (kind === 'skipShare') model.pendingChoice = { kind: 'skipShare' };
        else if (kind === 'location') { const info = LOCATION_INFO[value]; const occupied = current.locations?.[value]?.length || 0; model.pendingChoice = { kind: 'placeAccomplice', location: value, fee: info.group === 'cargo' ? info.fees[occupied] : info.fee, occupied, capacity: info.capacity }; }
        else if (kind === 'passPlacement') model.pendingChoice = { kind: 'passPlacement' };
        else if (kind === 'skipPilot') model.pendingChoice = { kind: 'skipPilot' };
        else if (kind === 'boardPirate') { const boat = current.boats?.find(candidate => candidate.id === Number(value)); model.pendingChoice = { kind: 'boardPirate', boatId: Number(value), good: boat?.good || '', occupied: Number(boat?.accomplices || 0) + Number(boat?.pirates || 0), capacity: boat?.good === '玉石' ? 4 : 3 }; }
        else if (kind === 'skipPirate') model.pendingChoice = { kind: 'skipPirate' };
        else if (kind === 'plunder') model.pendingChoice = { kind: 'plunderDestination', destination: value };
        renderer.renderCommand();
    }
    function openRules() { model.previousFocus = globalThis.document?.activeElement; const overlay = $('rulesOverlay'); overlay.classList.remove('is-hidden'); overlay.setAttribute('aria-hidden', 'false'); [...mount.querySelector('.manila-app').children].forEach(child => { child.inert = child !== overlay; }); overlay.querySelector('.mn-close')?.focus(); }
    function closeRules() { const overlay = $('rulesOverlay'); overlay.classList.add('is-hidden'); overlay.setAttribute('aria-hidden', 'true'); [...mount.querySelector('.manila-app').children].forEach(child => { child.inert = false; }); model.previousFocus?.focus?.(); model.previousFocus = null; }
    function trapRulesFocus(event) { const rules = $('rulesOverlay'); if (event.key !== 'Tab' || rules.classList.contains('is-hidden')) return false; const focusable = [...rules.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.getClientRects().length); if (!focusable.length) return false; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && (globalThis.document?.activeElement === first || !rules.contains(globalThis.document?.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (globalThis.document?.activeElement === last || !rules.contains(globalThis.document?.activeElement))) { event.preventDefault(); first.focus(); } return true; }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            const ui = uiButton.dataset.ui;
            if (ui === 'skipPresentation') { scene.skipPresentation(); return; }
            if (model.presentationPlaying) return;
            if (ui === 'rules') openRules(); else if (ui === 'closeRules') closeRules(); else if (ui === 'cancelChoice') { if (model.pendingChoice?.kind === 'sailBoats') model.sailOrder = []; model.pendingChoice = null; renderer.renderCommand(); } else if (ui === 'confirmChoice') confirmChoice(); else if (ui === 'resetSail') { model.sailOrder = []; model.pendingChoice = null; renderer.renderCommand(); } else if (ui === 'cancelFinance') { model.financeChoice = null; renderer.renderFinance(); } else if (ui === 'confirmFinance' && model.financeChoice) gameAction(model.financeChoice.kind, { shareIndex: model.financeChoice.index });
            return;
        }
        if (model.presentationPlaying) return;
        if (event.target === $('rulesOverlay')) { closeRules(); return; }
        const finance = event.target.closest('[data-finance-kind]'); if (finance) { model.financeChoice = { kind: finance.dataset.financeKind, index: Number(finance.dataset.index) }; renderer.renderFinance(); return; }
        const sailButton = event.target.closest('[data-sail-boat]'); if (sailButton && !sailButton.disabled) { const boatId = Number(sailButton.dataset.sailBoat); model.sailOrder = model.sailOrder.includes(boatId) ? model.sailOrder.filter(id => id !== boatId) : [...model.sailOrder, boatId]; const required = state().movementPlan?.rolls?.length || 0; model.pendingChoice = required && model.sailOrder.length === required ? { kind: 'sailBoats', order: model.sailOrder.slice() } : null; renderer.renderCommand(); return; }
        const choice = event.target.closest('[data-choice]'); if (choice && !choice.disabled) { selectChoice(choice); return; }
        const draftButton = event.target.closest('[data-draft-button]'); if (draftButton?.dataset.draftButton === 'pilot-mode') { model.pilotDraft.mode = draftButton.dataset.value; renderer.renderCommand(); return; }
        const confirmation = event.target.closest('[data-confirm]');
        if (confirmation?.dataset.confirm === 'boats') gameAction('setBoats', { boats: model.boatDraft.map(boat => ({ good: boat.good, start: Number(boat.start) })) });
        if (confirmation?.dataset.confirm === 'pilot') { const moves = [{ boatId: Number(model.pilotDraft.boat1), delta: Number(model.pilotDraft.delta1) }]; if (model.pilotDraft.mode === 'two') moves.push({ boatId: Number(model.pilotDraft.boat2), delta: Number(model.pilotDraft.delta2) }); gameAction('pilotMove', { moves }); }
    }
    function handleChange(event) {
        if (model.presentationPlaying) return; const field = event.target.closest('[data-draft]'); if (!field) return; const type = field.dataset.draft;
        if (type === 'bid') { model.bidDraft = Number(field.value); return; }
        const index = Number(field.dataset.index); if (type === 'boat-good') model.boatDraft[index].good = field.value; if (type === 'boat-start') model.boatDraft[index].start = Number(field.value); if (type === 'pilot-boat1') { model.pilotDraft.boat1 = field.value; if (model.pilotDraft.boat2 === field.value) model.pilotDraft.boat2 = String((state().boats || []).find(boat => boat.fate === 'sailing' && String(boat.id) !== field.value)?.id ?? ''); } if (type === 'pilot-delta1') model.pilotDraft.delta1 = Number(field.value); if (type === 'pilot-boat2') model.pilotDraft.boat2 = field.value; if (type === 'pilot-delta2') model.pilotDraft.delta2 = Number(field.value); renderer.renderCommand();
    }
    function handleKeydown(event) { if (trapRulesFocus(event)) return; if (event.key === 'Escape' && !$('rulesOverlay').classList.contains('is-hidden')) closeRules(); }

    return { handleClick, handleChange, handleKeydown, gameAction, resetDrafts: () => { model.actionPending = false; model.pendingChoice = null; model.financeChoice = null; }, openRules, closeRules };
}
