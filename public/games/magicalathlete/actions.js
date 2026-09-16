import { escapeHtml } from './constants.js';
import { athleteById, playerName } from './state.js';

/** Player decisions, keyboard support and rule modal for 胡闹运动会. */
export function createMagicalAthleteActions({ mount, model, renderer, scene, rulesModal = null, send, addLog, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const state = () => model.state;
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const athlete = id => athleteById(state(), id);
    const name = id => playerName(state(), id);
    function clearError() { renderer.clearError(); }
    function presentationLocked() { return Boolean(scene?.isPlaying?.()); }
    function submitAction(action) { if (!action || model.actionPending || presentationLocked()) return false; model.actionPending = true; clearError(); renderer.render(); send({ type: 'gameAction', action }); return true; }
    function chooseAction(payload, title, detail, key) { model.pendingAction = { payload, title, detail, key }; renderer.renderCommand(); }
    function setRulesOpen(open) {
        if (rulesModal) { rulesModal.setOpen(open); return; }
        const overlay = $('rulesOverlay'); overlay.classList.toggle('is-hidden', !open); overlay.setAttribute('aria-hidden', String(!open)); if (open) { model.previousFocus = documentRef.activeElement; [...mount.querySelector('.ma-app').children].forEach(child => { child.inert = child !== overlay; }); windowRef.requestAnimationFrame?.(() => overlay.querySelector('[data-ui="closeRules"]')?.focus()); } else { [...mount.querySelector('.ma-app').children].forEach(child => { child.inert = false; }); model.previousFocus?.focus?.(); model.previousFocus = null; }
    }
    function closeRules() { setRulesOpen(false); }
    function trapRulesFocus(event) { const rules = $('rulesOverlay'); if (event.key !== 'Tab' || rules.classList.contains('is-hidden')) return false; const focusable = [...rules.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.getClientRects().length); if (!focusable.length) return false; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && (documentRef.activeElement === first || !rules.contains(documentRef.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (documentRef.activeElement === last || !rules.contains(documentRef.activeElement))) { event.preventDefault(); first.focus(); } return true; }
    function handleClick(event) {
        const ui = event.target.closest('[data-ui]')?.dataset.ui;
        if (ui === 'skipPresentation') { scene.skipPresentation(); return; }
        if (presentationLocked()) return;
        if (ui === 'rules') { setRulesOpen(true); return; }
        if (ui === 'closeRules' || event.target === $('rulesOverlay')) { setRulesOpen(false); return; }
        if (ui === 'cancelChoice') { model.pendingAction = null; model.actionPending = false; renderer.renderCommand(); return; }
        if (ui === 'acknowledgeElimination') { const acknowledgement = state()?.acknowledgement; if (!acknowledgement || acknowledgement.playerId !== state().myId || model.actionPending || presentationLocked()) return; submitAction({ kind: 'acknowledgeElimination', acknowledgementId: acknowledgement.id }); return; }
        if (ui === 'confirmChoice') { if (model.pendingAction && !model.actionPending) submitAction(model.pendingAction.payload); return; }
        const prompt = state()?.prompt;
        if (prompt) {
            if (prompt.playerId !== state().myId || model.actionPending) return;
            const pick = event.target.closest('[data-prompt-pick]');
            if (pick) { const id = pick.dataset.promptPick; const item = athlete(id); chooseAction({ kind: prompt.kind === 'eggPick' ? 'eggPick' : 'twinPick', athleteId: id }, `复制 ${item?.name || id} 的能力`, '本场比赛中将使用这名运动员的能力，确认后不能更换。', `athlete:${id}`); return; }
            const target = event.target.closest('[data-prompt-target]');
            if (target) { const id = target.dataset.promptTarget; const racer = (state().racers || []).find(item => item.id === id); const targetName = `${name(racer?.playerId)}的${athlete(racer?.athleteId)?.name || racer?.athleteId || '运动员'}`; let payload; let title; if (prompt.kind === 'predict') { payload = { kind: 'predict', targetRacerId: id }; title = `预测 ${targetName} 夺冠`; } else if (prompt.kind === 'copycatPick') { payload = { kind: 'decide', targetRacerId: id }; title = `复制 ${targetName} 的能力`; } else { payload = { kind: 'decide', use: true, targetRacerId: id }; title = prompt.kind === 'flopflop' ? `与 ${targetName} 交换位置` : prompt.kind === 'thirdwheel' ? `传送到 ${targetName} 所在格` : `将 ${targetName} 传送到自己所在格`; } chooseAction(payload, title, '服务端会再次校验目标是否仍然有效，并按正式能力顺序处理停格效果。', `target:${id}`); return; }
            const action = event.target.closest('[data-prompt-action]');
            if (action) { const kind = action.dataset.promptAction; const value = action.dataset.promptValue; if (kind === 'promptUse') { const payload = { kind: 'decide', use: value === '1' }; if (value === '1' && (prompt.kind === 'duel' || prompt.kind === 'suckerfish')) payload.targetRacerId = prompt.targetRacerId; const using = value === '1'; chooseAction(payload, using ? (prompt.kind === 'duel' ? '确认发起决斗' : prompt.kind === 'suckerfish' ? '确认跟随目标' : '确认使用能力') : (prompt.kind === 'flopflop' || prompt.kind === 'legs' ? '放弃能力并正常掷骰' : '本次不使用能力'), using ? '能力会立即进入正式结算流程。' : '跳过后将继续当前运动员的正常流程。', `prompt:${kind}:${value}`); } else if (kind === 'promptReroll') { const reroll = value === '1'; chooseAction({ kind: 'decide', reroll }, reroll ? '放弃当前结果并重新掷骰' : '保留当前骰子结果', reroll ? '旧结果将作废，相关重掷能力按规则继续触发。' : '确认后直接使用当前结果继续移动。', `prompt:${kind}:${value}`); } return; }
            const genius = event.target.closest('[data-genius-guess]'); if (genius) { const guess = Number(genius.dataset.geniusGuess); chooseAction({ kind: 'genius', guess }, `预测骰子结果为 ${guess}`, '猜中后，本回合结束时可以再行动一次。', `genius:${guess}`); } return;
        }
        const athleteButton = event.target.closest('[data-athlete]');
        if (athleteButton && !athleteButton.disabled) { const id = athleteButton.dataset.athlete; const card = athlete(id) || (state().myTeam || []).find(item => item.id === id); const kind = athleteButton.dataset.athleteAction || 'chooseAthlete'; chooseAction({ kind, athleteId: id }, kind === 'chooseAthlete' ? `招募 ${card?.name || id}` : `让 ${card?.name || id} 参加第 ${state().match} 场`, card?.description || '确认后将立即提交本次选择。', `athlete:${id}`); return; }
        const action = event.target.closest('[data-action]');
        if (action && !action.disabled) { const athleteId = action.dataset.racer; const racer = (state().racers || []).find(item => item.playerId === state().myId && item.athleteId === athleteId && item.finishOrder == null && !item.eliminated); const item = athlete(athleteId) || racer?.athlete; chooseAction({ kind: action.dataset.action, athleteId }, racer?.tripped ? `让 ${item?.name || athleteId} 恢复站立` : `让 ${item?.name || athleteId} 开始行动`, racer?.tripped ? '本回合仅恢复站立，但仍会处理允许触发的能力。' : '确认后先处理回合开始能力，再决定或掷出主移动。', `roll:${athleteId}`); }
    }
    function handleKeydown(event) { if (presentationLocked()) { if (event.key === 'Escape') scene.skipPresentation(); event.preventDefault(); return; } if (rulesModal?.trapFocus(event)) return; if (trapRulesFocus(event)) return; if (event.key !== 'Escape') return; if (!$('rulesOverlay').classList.contains('is-hidden')) setRulesOpen(false); else if (model.pendingAction) { model.pendingAction = null; model.actionPending = false; renderer.renderCommand(); } }
    return { handleClick, handleKeydown, submitAction, chooseAction, setRulesOpen, closeRules, trapRulesFocus };
}
