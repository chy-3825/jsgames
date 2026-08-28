import { escapeHtml } from './constants.js';

/** User interaction, private dossier and action submission handlers for 猎巫镇. */
export function createWitchTownActions({ mount, model, renderer, scene, send, rulesModal, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;

    function sendAction(kind, value = '') {
        const current = state();
        const action = { kind };
        if (kind === 'chooseBlackCat' || kind === 'nightKill' || kind === 'nightProtect') action.targetId = renderer.readSelect(kind);
        else if (kind === 'revealConspiracyTrial' || kind === 'passTrial' || kind === 'confess') action.trialId = renderer.readSelect(kind);
        else if (kind === 'playCard') {
            action.cardId = value;
            action.targetId = renderer.readSelect('playCard');
            action.targetId2 = renderer.readSelect('playCard2');
            action.blueCardId = renderer.readSelect('curseBlue');
        } else if (kind === 'reorderDeck') action.order = (model.deckOrderDraft || current?.deckOrder || []).slice();
        send({ type: 'gameAction', action });
    }

    function setDossierIdentityVisible(visible) {
        model.dossierIdentityVisible = Boolean(visible && state()?.myIdentity && state()?.status !== 'ended');
        if (model.dossierIdentityVisible) {
            model.hasViewedDossier = true;
            const confirm = $('private')?.querySelector('[data-action="confirmDossier"]');
            if (confirm) {
                confirm.disabled = false;
                confirm.textContent = '我已核对档案';
            }
        }
        renderer.syncDossierVisibility();
    }

    function hideDossierIdentity() {
        model.dossierRevealPointerId = null;
        model.dossierRevealKey = null;
        setDossierIdentityVisible(false);
    }

    function openRules() {
        model.rulesScrollY = windowRef.scrollY || 0;
        documentRef.body.classList.add('witchtown-rules-open');
        rulesModal.setOpen(true);
    }

    function closeRules() {
        rulesModal.setOpen(false);
        documentRef.body.classList.remove('witchtown-rules-open');
        windowRef.scrollTo?.(0, model.rulesScrollY);
    }

    function onClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            if (uiButton.dataset.ui === 'rules') openRules(uiButton);
            if (uiButton.dataset.ui === 'closeRules') closeRules();
            if (uiButton.dataset.ui === 'sceneContinue') scene.dismissScene(true);
            return;
        }
        if (event.target === $('overlay')) {
            closeRules();
            return;
        }
        const actionElement = event.target.closest('button[data-action]');
        if (!actionElement || actionElement.disabled) return;
        if (actionElement.dataset.action === 'confirmDossier') {
            if (!model.hasViewedDossier) return;
            hideDossierIdentity();
            renderer.renderPrivate();
            renderer.renderCommand();
            sendAction('confirmDossier');
            return;
        }
        if (actionElement.dataset.action === 'selectCard') {
            model.pendingCardId = model.pendingCardId === actionElement.dataset.value ? null : actionElement.dataset.value;
            renderer.renderCommand();
            renderer.renderHand();
            return;
        }
        if (actionElement.dataset.action === 'confirmPlay') {
            if (!renderer.isPlayDraftValid()) return;
            const cardId = model.pendingCardId;
            model.pendingCardId = null;
            renderer.renderCommand();
            renderer.renderHand();
            sendAction('playCard', cardId);
            return;
        }
        if (actionElement.dataset.action === 'toggleDeckOrder') {
            mount.querySelector('.witchtown-deck-order')?.toggleAttribute('open');
            return;
        }
        if (actionElement.dataset.action === 'moveDeckCard') {
            const visualOrder = (model.deckOrderDraft || []).slice().reverse();
            const index = visualOrder.indexOf(actionElement.dataset.value);
            const offset = actionElement.dataset.direction === 'up' ? -1 : 1;
            if (index >= 0 && visualOrder[index + offset]) [visualOrder[index], visualOrder[index + offset]] = [visualOrder[index + offset], visualOrder[index]];
            model.deckOrderDraft = visualOrder.reverse();
            renderer.renderCommand();
            mount.querySelector('.witchtown-deck-order')?.setAttribute('open', '');
            return;
        }
        if (actionElement.dataset.action === 'resetDeckOrder') {
            model.deckOrderDraft = (state()?.deckOrder || []).slice();
            renderer.renderCommand();
            mount.querySelector('.witchtown-deck-order')?.setAttribute('open', '');
            return;
        }
        if (actionElement.dataset.action === 'confirmDeckOrder') {
            sendAction('reorderDeck');
            return;
        }
        sendAction(actionElement.dataset.action, actionElement.dataset.value || '');
    }

    function onChange(event) {
        if (!event.target.matches('select[data-select-for]')) return;
        model.selectDraft.set(event.target.dataset.selectFor, event.target.value);
        const selected = renderer.selectedHandCard();
        if (event.target.dataset.selectFor === 'playCard' && selected && ['curse', 'robbery', 'scapegoat'].includes(selected.kind)) {
            if (selected.kind === 'curse') model.selectDraft.delete('curseBlue');
            renderer.renderCommand();
            renderer.renderHand();
            return;
        }
        renderer.updatePlayConfirmText();
        renderer.renderHand();
    }

    function onKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) {
            closeRules();
            return;
        }
        const hold = event.target.closest?.('[data-dossier-hold]');
        if (!hold || event.repeat || event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        model.dossierRevealPointerId = null;
        model.dossierRevealKey = event.key;
        setDossierIdentityVisible(true);
    }

    function onVisibilityChange() {
        if (documentRef.visibilityState === 'hidden') hideDossierIdentity();
    }

    function onWindowBlur() {
        hideDossierIdentity();
    }

    function onPointerDown(event) {
        const hold = event.target.closest('[data-dossier-hold]');
        if (!hold || event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        model.dossierRevealPointerId = event.pointerId;
        model.dossierRevealKey = null;
        setDossierIdentityVisible(true);
    }

    function onPointerMove(event) {
        if (event.pointerId !== model.dossierRevealPointerId) return;
        const hold = $('private')?.querySelector('[data-dossier-hold]');
        if (!hold) return hideDossierIdentity();
        const bounds = hold.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) hideDossierIdentity();
    }

    function onPointerOut(event) {
        const hold = event.target.closest('[data-dossier-hold]');
        if (hold && event.pointerId === model.dossierRevealPointerId && !hold.contains(event.relatedTarget)) hideDossierIdentity();
    }

    function onPointerEnd(event) {
        if (event.pointerId === model.dossierRevealPointerId) hideDossierIdentity();
    }

    function onKeyup(event) {
        if (event.key === model.dossierRevealKey) hideDossierIdentity();
    }

    function onFocusOut(event) {
        if (event.target.closest('[data-dossier-hold]')) hideDossierIdentity();
    }

    function onContextMenu(event) {
        if (event.target.closest('[data-dossier-hold]')) event.preventDefault();
    }

    return {
        onClick,
        onChange,
        onKeydown,
        onVisibilityChange,
        onWindowBlur,
        onPointerDown,
        onPointerMove,
        onPointerOut,
        onPointerEnd,
        onKeyup,
        onFocusOut,
        onContextMenu,
        hideDossierIdentity,
        openRules,
        closeRules,
    };
}
