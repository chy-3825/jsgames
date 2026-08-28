/** Privacy controls, overlays and submission actions for 谍报风云. */
export function createDecryptoActions({ mount, model, renderer, scene, rulesModal, send, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;
    const tutorialOverlay = $('tutorialOverlay'); const notebookOverlay = $('notebookOverlay'); const overlay = $('rulesOverlay');
    function updateTextForm(form) {
        const inputs = [...form.querySelectorAll('[data-text-index]')]; const values = inputs.map(input => input.value.trim()); const complete = values.every(Boolean); const unique = new Set(values.map(value => value.toLocaleLowerCase())).size === values.length; const confirm = form.querySelector('.dc-confirm'); const button = form.querySelector('.dc-primary'); button.disabled = !complete || !unique; const title = confirm.querySelector('strong'); const copy = confirm.querySelector('small'); title.textContent = !complete ? `${values.filter(Boolean).length} / ${values.length} 项已填写` : !unique ? '存在重复内容' : '内容已经填写完整'; copy.textContent = !complete ? '填完所有内容后可以提交' : !unique ? '每一项必须使用不同文字' : '确认后将立即发送，不能撤回';
    }
    function openOverlay(target, trigger) {
        if (!target) return;
        if (model.activeOverlay && model.activeOverlay !== target) closeOverlay(model.activeOverlay, false);
        model.overlayTrigger = trigger || documentRef.activeElement; if (!model.activeOverlay) model.bodyOverflow = documentRef.body.style.overflow; model.activeOverlay = target; documentRef.body.style.overflow = 'hidden';
        if (target === overlay) rulesModal.setOpen(true); else { target.classList.remove('is-hidden'); target.setAttribute('aria-hidden', 'false'); target.querySelector('article')?.focus({ preventScroll: true }); }
    }
    function closeOverlay(target = model.activeOverlay, restoreFocus = true) {
        if (!target || target.classList.contains('is-hidden') && target !== overlay) return;
        if (target === overlay) rulesModal.setOpen(false); else { target.classList.add('is-hidden'); target.setAttribute('aria-hidden', 'true'); if (target === tutorialOverlay) { try { windowRef.localStorage?.setItem('jsgames.decrypto.tutorialSeen', 'yes'); } catch {} } }
        if (model.activeOverlay === target) model.activeOverlay = null; if (!model.activeOverlay) documentRef.body.style.overflow = model.bodyOverflow; if (restoreFocus) model.overlayTrigger?.focus?.({ preventScroll: true }); model.overlayTrigger = null;
    }
    function shouldShowTutorial() { if (model.tutorialOpened || state()?.phase !== 'keycheck') return false; try { return windowRef.localStorage?.getItem('jsgames.decrypto.tutorialSeen') !== 'yes'; } catch { return true; } }
    function trapOverlayFocus(event) {
        if (model.activeOverlay === overlay) return rulesModal.trapFocus(event);
        if (event.key !== 'Tab' || !model.activeOverlay || model.activeOverlay.classList.contains('is-hidden')) return false;
        const focusable = [...model.activeOverlay.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.getClientRects().length); if (!focusable.length) return false; const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && (documentRef.activeElement === first || !model.activeOverlay.contains(documentRef.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (documentRef.activeElement === last || !model.activeOverlay.contains(documentRef.activeElement))) { event.preventDefault(); first.focus(); } return true;
    }
    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            if (uiButton.dataset.ui === 'rules') openOverlay(overlay, uiButton); if (uiButton.dataset.ui === 'tutorial') { model.tutorialOpened = true; openOverlay(tutorialOverlay, uiButton); } if (uiButton.dataset.ui === 'notebook') openOverlay(notebookOverlay, uiButton); if (uiButton.dataset.ui === 'privacy') renderer.togglePrivacyProtection(); if (uiButton.dataset.ui === 'closeRules') closeOverlay(overlay); if (uiButton.dataset.ui === 'closeTutorial') closeOverlay(tutorialOverlay); if (uiButton.dataset.ui === 'closeNotebook') closeOverlay(notebookOverlay); return;
        }
        if (event.target.classList.contains('dc-overlay')) { closeOverlay(event.target); return; }
        const notebookButton = event.target.closest('[data-notebook-view]'); if (notebookButton) { model.notebookView = notebookButton.dataset.notebookView === 'rounds' ? 'rounds' : 'matrix'; renderer.renderHistory(); return; }
        if (event.target.closest('[data-secret-toggle="keywords"]')) { renderer.setKeywordsVisible(!model.keywordsVisible); if (state()?.phase === 'keycheck') renderer.renderCommand(); return; }
        const digitButton = event.target.closest('[data-code-digit]'); if (digitButton) { const digit = Number(digitButton.dataset.codeDigit); const existing = model.codeDraft.indexOf(digit); if (existing >= 0) model.codeDraft.splice(existing, 1); else if (model.codeDraft.length < 3) model.codeDraft.push(digit); renderer.renderCommand(); return; }
        const candidate = event.target.closest('[data-encryptor-candidate]'); if (candidate) { model.encryptorCandidateId = candidate.dataset.encryptorCandidate; renderer.renderCommand(); return; }
        if (event.target.closest('[data-code-reset]')) { model.codeDraft = []; renderer.renderCommand(); return; }
        const action = event.target.closest('[data-action]'); if (!action || action.disabled) return;
        if (action.dataset.action === 'confirmKey') { renderer.setKeywordsVisible(false); send({ type: 'gameAction', action: { kind: 'confirmKey' } }); return; }
        if (action.dataset.action === 'confirmEncryptorVote' && model.encryptorCandidateId) { send({ type: 'gameAction', action: { kind: 'voteEncryptor', playerId: model.encryptorCandidateId } }); return; }
        if (action.dataset.action === 'confirmIntercept' && model.codeDraft.length === 3) { send({ type: 'gameAction', action: { kind: 'submitIntercept', code: model.codeDraft.slice() } }); return; }
        if (action.dataset.action === 'confirmOwnGuess' && model.codeDraft.length === 3) send({ type: 'gameAction', action: { kind: 'submitOwnGuess', code: model.codeDraft.slice() } });
    }
    function handleInput(event) { const form = event.target.closest('[data-text-form]'); if (form) updateTextForm(form); }
    function handleSubmit(event) { const form = event.target.closest('[data-text-form]'); if (!form) return; event.preventDefault(); const values = [...form.querySelectorAll('[data-text-index]')].map(input => input.value.trim()); if (!values.every(Boolean) || new Set(values.map(value => value.toLocaleLowerCase())).size !== values.length) return; if (form.dataset.textForm === 'clue') send({ type: 'gameAction', action: { kind: 'submitClue', clues: values } }); if (form.dataset.textForm === 'tiebreak') send({ type: 'gameAction', action: { kind: 'tiebreakGuess', keywords: values } }); }
    function handlePointerDown(event) { const hold = event.target.closest('[data-code-hold]'); if (!hold) return; event.preventDefault(); model.codePointerId = event.pointerId; hold.setPointerCapture?.(event.pointerId); renderer.setCodeVisible(true); if (state()?.phase === 'clue') { renderer.renderKeywords(); renderer.renderCommand(); } }
    function handlePointerEnd(event) { if (model.codePointerId === null || (event.pointerId !== undefined && event.pointerId !== model.codePointerId)) return; model.codePointerId = null; renderer.setCodeVisible(false); }
    function handlePointerOut(event) { if (model.codePointerId === null || event.pointerId !== model.codePointerId) return; const hold = event.target.closest('[data-code-hold]'); if (hold && !hold.contains(event.relatedTarget)) handlePointerEnd(event); }
    function handleKeydown(event) { if (trapOverlayFocus(event)) return; if (event.key === 'Escape' && model.activeOverlay) { closeOverlay(model.activeOverlay); return; } const hold = event.target.closest?.('[data-code-hold]'); if (!hold || (event.key !== ' ' && event.key !== 'Enter') || event.repeat) return; event.preventDefault(); model.codeRevealKey = event.key; renderer.setCodeVisible(true); if (state()?.phase === 'clue') { renderer.renderKeywords(); renderer.renderCommand(); } }
    function handleKeyup(event) { if (model.codeRevealKey && event.key === model.codeRevealKey) { model.codeRevealKey = null; renderer.setCodeVisible(false); } }
    function concealPrivateInformation() { if (model.privacyProtection) renderer.setKeywordsVisible(false); renderer.setCodeVisible(false); model.codePointerId = null; model.codeRevealKey = null; }
    function handleVisibilityChange() { if (documentRef.hidden) concealPrivateInformation(); }
    return { handleClick, handleInput, handleSubmit, handlePointerDown, handlePointerEnd, handlePointerOut, handleKeydown, handleKeyup, handleVisibilityChange, concealPrivateInformation, openOverlay, closeOverlay, shouldShowTutorial };
}
