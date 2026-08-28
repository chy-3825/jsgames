import { ROLE } from './constants.js';

/** Private identity reveal, target dialogs and action controls for 狼人杀. */
export function createWerewolfActions({ mount, model, renderer, scene, rulesModal, send, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;
    function sendAction(action) {
        const now = Date.now(); const actionKey = JSON.stringify(action);
        if (actionKey === model.lastActionKey && now - model.lastActionAt < 400) return false;
        model.lastActionAt = now; model.lastActionKey = actionKey; send({ type: 'gameAction', action }); return true;
    }
    function confirmAllRolesForTest() {
        const current = state();
        if (!current?.testMode || current.phase !== 'roleReveal' || model.confirmingAllRoles) return;
        const pendingSeats = (current.seats || []).filter(seat => seat.canControl && !seat.roleConfirmed).map(seat => seat.number);
        if (!pendingSeats.length) return;
        model.confirmingAllRoles = true; renderer.render();
        pendingSeats.forEach(seat => { send({ type: 'gameAction', action: { kind: 'switchSeat', seat } }); send({ type: 'gameAction', action: { kind: 'confirmRole' } }); });
    }
    function openTargetDialog(type) {
        renderer.hideRoleIdentity();
        const current = state();
        const definitions = {
            guard: { title: '第一步 · 选择守护目标', description: '选择今晚要保护的玩家，下一步还可以再次核对。', action: { kind: 'stageNightAction' }, targets: current.legalTargetSeats || [] },
            wolf: { title: `第一步 · 第 ${current.wolfVote?.round || 1} 轮袭击投票`, description: '选择一名袭击目标，下一步确定后便不能更改。', action: { kind: 'stageNightAction' }, targets: current.legalTargetSeats || [] },
            seer: { title: '第一步 · 选择查验目标', description: '选择另一名玩家，最终确定后会揭示对方阵营。', action: { kind: 'stageNightAction' }, targets: current.legalTargetSeats || [] },
            'witch-poison': { title: '第一步 · 选择毒药目标', description: '选择一名玩家，最终确定后将用掉毒药。', action: { kind: 'stageNightAction', choice: 'poison' }, targets: current.legalTargetSeats || [] },
            'hunter-shoot': { title: '选择开枪目标', description: '被选中的存活玩家将立即出局。', action: { kind: 'hunterAction', choice: 'shoot' }, targets: current.hunterAction?.legalTargetSeats || [] },
            'hunter-pass': { title: '确认放弃开枪', description: '确认后不带走任何玩家。', action: { kind: 'hunterAction', choice: 'pass' }, targets: [], noTarget: true },
            'badge-transfer': { title: '选择警徽接收者', description: '警徽会立即移交给选中的存活玩家。', action: { kind: 'sheriffBadgeAction', choice: 'transfer' }, targets: current.sheriffBadgeAction?.legalTargetSeats || [] },
            'sheriff-vote': { title: current.phase === 'sheriffRunoffVote' ? '选择 PK 候选人' : '选择警长候选人', description: '这张票确定后不能修改。', action: { kind: 'sheriffVote' }, targets: current.sheriffAction?.legalTargetSeats || [] },
            vote: { title: '选择放逐目标', description: '请投出你的放逐票，确定后不能修改。', action: { kind: 'vote' }, targets: current.legalTargetSeats || [] },
        };
        const definition = definitions[type]; if (!definition) return;
        model.targetDialog = { ...definition, selected: definition.fixedTarget || null };
        renderTargetDialog(); mount.querySelector('.ww-screen')?.classList.add('is-modal-open'); $('targetModal')?.classList.remove('is-hidden');
    }
    function renderTargetDialog() {
        const dialog = model.targetDialog; const current = state(); if (!dialog) return;
        $('targetTitle').textContent = dialog.title; $('targetDescription').textContent = dialog.description;
        const grid = $('targetGrid'); grid.innerHTML = dialog.targets.length ? dialog.targets.map(number => { const seat = current.seats.find(item => item.number === number); return `<button type="button" data-modal-target="${number}" class="${dialog.selected === number ? 'is-selected' : ''}"><b>${number}</b><span>${seat?.alive ? '存活' : '出局'}</span></button>`; }).join('') : ''; grid.classList.toggle('is-hidden', !dialog.targets.length);
        $('targetSelection').textContent = dialog.noTarget ? '这次不选择任何目标' : dialog.selected ? `你选择了 ${dialog.selected} 号玩家` : '还没有选择';
        const confirm = mount.querySelector('[data-ui="confirmTarget"]'); confirm.disabled = !dialog.noTarget && !dialog.selected; confirm.textContent = dialog.action.kind === 'stageNightAction' ? '下一步：确认' : ['vote', 'sheriffVote'].includes(dialog.action.kind) ? '确定投票' : dialog.action.kind === 'sheriffBadgeAction' ? '确定移交' : '确定选择';
    }
    function closeTargetDialog() { model.targetDialog = null; $('targetModal')?.classList.add('is-hidden'); mount.querySelector('.ww-screen')?.classList.remove('is-modal-open'); }
    function handleClick(event) {
        if (!event.target.closest('[data-role-hold]')) renderer.hideRoleIdentity();
        const ui = event.target.closest('[data-ui]')?.dataset.ui; const rulesOverlay = $('rules');
        if (ui === 'voice') { model.voiceEnabled = !model.voiceEnabled; if (!model.voiceEnabled) windowRef.speechSynthesis?.cancel?.(); renderer.updateVoiceButton(); return; }
        if (ui === 'bulletins') { const bulletin = $('voteResult'); bulletin?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); bulletin?.focus?.({ preventScroll: true }); renderer.pulseBulletin(); return; }
        if (ui === 'confirmAllRoles') return confirmAllRolesForTest();
        if (ui === 'rules') { rulesModal.setOpen(true); return; }
        if (ui === 'closeRules' || event.target === rulesOverlay) { rulesModal.setOpen(false); return; }
        if (ui === 'closeTarget' || ui === 'cancelTarget' || event.target === $('targetModal')) { closeTargetDialog(); return; }
        if (ui === 'confirmTarget' && model.targetDialog) { const action = { ...model.targetDialog.action }; if (model.targetDialog.selected && !model.targetDialog.noTarget) action.targetSeat = model.targetDialog.selected; closeTargetDialog(); return sendAction(action); }
        const modalTarget = event.target.closest('[data-modal-target]'); if (modalTarget && model.targetDialog) { model.targetDialog.selected = Number(modalTarget.dataset.modalTarget); renderTargetDialog(); return; }
        const skill = event.target.closest('[data-open-skill]'); if (skill) { openTargetDialog(skill.dataset.openSkill); return; }
        const stagedNightChoice = event.target.closest('[data-stage-night-choice]'); if (stagedNightChoice) return sendAction({ kind: 'stageNightAction', choice: stagedNightChoice.dataset.stageNightChoice });
        if (event.target.closest('[data-open-vote]')) { openTargetDialog('vote'); return; }
        if (event.target.closest('[data-action="voteAbstain"]')) return sendAction({ kind: 'vote', targetSeat: null });
        if (event.target.closest('[data-action="confirmRole"]')) return sendAction({ kind: 'confirmRole' });
        if (event.target.closest('[data-action="confirmDeadRole"]')) return sendAction({ kind: 'confirmDeadRole' });
        if (event.target.closest('[data-action="confirmNightAction"]')) return sendAction({ kind: 'confirmNightAction' });
        if (event.target.closest('[data-action="cancelNightAction"]')) return sendAction({ kind: 'cancelNightAction' });
        if (event.target.closest('[data-action="confirmSeerResult"]')) return sendAction({ kind: 'confirmSeerResult' });
        if (event.target.closest('[data-action="confirmDeathResolution"]')) return sendAction({ kind: 'confirmDeathResolution' });
        if (event.target.closest('[data-action="confirmDay"]')) return sendAction({ kind: 'confirmDay' });
        if (event.target.closest('[data-action="startSpeech"]')) return sendAction({ kind: 'startSpeech' });
        if (event.target.closest('[data-action="finishSpeech"]')) return sendAction({ kind: 'finishSpeech' });
        if (event.target.closest('[data-action="startLastWords"]')) return sendAction({ kind: 'startLastWords' });
        if (event.target.closest('[data-action="finishLastWords"]')) return sendAction({ kind: 'finishLastWords', text: mount.querySelector('[data-role="lastWordsText"]')?.value?.trim() || '' });
        if (event.target.closest('[data-action="sheriffRun"]')) return sendAction({ kind: 'sheriffSignup', choice: 'run' });
        if (event.target.closest('[data-action="sheriffSkip"]')) return sendAction({ kind: 'sheriffSignup', choice: 'skip' });
        if (event.target.closest('[data-action="sheriffStay"]')) return sendAction({ kind: 'finishSheriffCampaign', choice: 'stay' });
        if (event.target.closest('[data-action="sheriffWithdraw"]')) return sendAction({ kind: 'finishSheriffCampaign', choice: 'withdraw' });
        if (event.target.closest('[data-action="sheriffAbstain"]')) return sendAction({ kind: 'sheriffVote', targetSeat: null });
        if (event.target.closest('[data-action="finishSheriffRunoffSpeech"]')) return sendAction({ kind: 'finishSheriffRunoffSpeech' });
        if (event.target.closest('[data-action="tearBadge"]')) return sendAction({ kind: 'sheriffBadgeAction', choice: 'tear' });
        const seat = event.target.closest('[data-seat]'); if (seat) { closeTargetDialog(); return sendAction({ kind: 'switchSeat', seat: Number(seat.dataset.seat) }); }
    }
    function handlePointerdown(event) {
        if (!event.target.closest('[data-role-hold]') || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault(); model.roleRevealPointerId = event.pointerId; model.roleRevealKey = null; renderer.setRoleIdentityVisible(true);
    }
    function handlePointermove(event) {
        if (event.pointerId !== model.roleRevealPointerId) return;
        const hold = $('role')?.querySelector('[data-role-hold]'); if (!hold) return renderer.hideRoleIdentity(); const bounds = hold.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) renderer.hideRoleIdentity();
    }
    function handlePointerout(event) { const hold = event.target.closest('[data-role-hold]'); if (hold && event.pointerId === model.roleRevealPointerId && !hold.contains(event.relatedTarget)) renderer.hideRoleIdentity(); }
    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) { rulesModal.setOpen(false); return; }
        if (!event.target.closest('[data-role-hold]') || (event.key !== ' ' && event.key !== 'Enter')) return;
        event.preventDefault(); if (!event.repeat) { model.roleRevealPointerId = null; model.roleRevealKey = event.key; renderer.setRoleIdentityVisible(true); }
    }
    function handleFocusout(event) { if (event.target.closest('[data-role-hold]')) renderer.hideRoleIdentity(); }
    function handleContextmenu(event) { if (event.target.closest('[data-role-hold]')) event.preventDefault(); }
    function handlePointerup(event) { if (event.pointerId === model.roleRevealPointerId) renderer.hideRoleIdentity(); }
    function handlePointercancel(event) { if (event.pointerId === model.roleRevealPointerId) renderer.hideRoleIdentity(); }
    function handleKeyup(event) { if (event.key === model.roleRevealKey) renderer.hideRoleIdentity(); }
    function handleBlur() { renderer.hideRoleIdentity(); }
    function handleVisibilitychange() { if (documentRef.hidden) renderer.hideRoleIdentity(); }
    return { handleClick, handlePointerdown, handlePointermove, handlePointerout, handleKeydown, handleFocusout, handleContextmenu, handlePointerup, handlePointercancel, handleKeyup, handleBlur, handleVisibilitychange, closeTargetDialog, sendAction };
}
