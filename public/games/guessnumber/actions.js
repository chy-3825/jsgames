import { CODE_LENGTH } from './constants.js';

/** Keypad, keyboard and rules interactions for 猜数字. */
export function createGuessNumberActions({ mount, model, renderer, scene, rulesModal, send, addLog, windowRef = globalThis.window || globalThis }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;
    function canGuess() { return Boolean(state()?.availableActions?.canGuess) && state()?.status === 'playing' && !model.actionLock.pending; }
    function addDigit(digit) { if (!canGuess() || model.guess.length >= CODE_LENGTH) return; if (model.guess.includes(digit)) { model.inputNotice = `数字 ${digit} 已经使用，请选择其他数字`; renderer.render(); return; } model.guess += digit; model.inputNotice = `已输入 ${model.guess.length} 位：${model.guess.split('').join('、')}${model.guess.length === CODE_LENGTH ? '，现在可以提交' : ''}`; renderer.render(); }
    function removeDigit() { if (!canGuess()) return; model.guess = model.guess.slice(0, -1); model.inputNotice = model.guess ? `已删除一位，当前 ${model.guess.length} 位：${model.guess.split('').join('、')}` : '已清空当前猜测'; renderer.render(); }
    function submit() { if (!canGuess()) return; if (model.guess.length !== CODE_LENGTH) { addLog?.('请输入四个不重复的数字', 'error'); return; } if (!model.actionLock.lock()) return; const value = model.guess; model.guess = ''; model.inputNotice = `正在提交 ${value.split('').join('、')}`; send({ type: 'gameAction', action: { kind: 'submitGuess', guess: value } }); renderer.render(); }
    function handleKeydown(event) { if (scene.isPlaying()) { if (event.key === 'Escape') scene.skipScene(); event.preventDefault(); return; } if (rulesModal.trapFocus(event)) return; if (event.key === 'Escape' && rulesModal.isOpen()) { rulesModal.setOpen(false); return; } if (rulesModal.isOpen()) return; if (/^\d$/.test(event.key)) { event.preventDefault(); addDigit(event.key); } else if (event.key === 'Backspace') { event.preventDefault(); removeDigit(); } else if (event.key === 'Enter') { event.preventDefault(); submit(); } }
    function handleClick(event) { if (scene.isPlaying()) { event.preventDefault(); if (event.target.closest('[data-ui="skip-scene"]')) scene.skipScene(); return; } const digit = event.target.closest('[data-digit]'); if (digit) { addDigit(digit.dataset.digit); return; } const ui = event.target.closest('[data-ui]')?.dataset.ui; if (ui === 'clear') { model.guess = ''; model.inputNotice = '已清空当前猜测'; renderer.render(); } else if (ui === 'submit') submit(); else if (ui === 'rules') rulesModal.setOpen(true); else if (ui === 'close-rules' || event.target === $('rulesOverlay')) rulesModal.setOpen(false); }
    return { handleKeydown, handleClick, submit, addDigit };
}
