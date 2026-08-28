import { createActionLock } from '../common/action-lock.js';
import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { createGuessNumberActions } from './actions.js';
import { createGuessNumberModel } from './state.js';
import { createGuessNumberTemplate } from './template.js';
import { createGuessNumberRenderer } from './render.js';
import { createGuessNumberScene } from './scene.js';

/** Thin protocol/lifecycle entry for 猜数字. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('guessnumber'), { documentRef });
    const scope = createClientScope({ windowRef });
    const actionLock = createActionLock();
    const model = createGuessNumberModel({ actionLock, windowRef });
    documentRef.body.classList.add('is-guessnumber-view');
    mount.innerHTML = createGuessNumberTemplate();
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const root = mount.querySelector('.gn-app');
    const rulesModal = createModalController({ root, overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const renderer = createGuessNumberRenderer({ mount, model, getElement });
    const scene = createGuessNumberScene({ mount, model, getElement, rulesModal, windowRef });
    const actions = createGuessNumberActions({ mount, model, renderer, scene, rulesModal, send, addLog, windowRef });
    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    windowRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });
    function handleMessage(message) {
        if (message.state) {
            const previousState = model.state;
            const wasSubmitting = model.actionLock.pending;
            model.state = message.state;
            model.actionLock.unlock();
            if (model.state.status === 'ended') model.guess = '';
            if (wasSubmitting) model.inputNotice = model.state.status === 'ended' ? '猜测正确，答案已解密' : '已收到反馈，可以继续输入下一次猜测';
            renderer.render();
            if (previousState?.status === 'playing' && model.state.status === 'ended') void scene.playEndScene(model.state);
        }
        if (message.type === 'error') {
            model.actionLock.unlock();
            model.inputNotice = message.message || '提交失败，请重新输入';
            addLog?.(message.message || '操作失败', 'error');
            renderer.render();
        } else {
            const text = message.action?.message || (message.type !== 'gameState' ? message.message : '');
            if (text) addLog?.(text, 'info');
        }
    }
    return { gameType: 'guessnumber', handleMessage, destroy() { scope.destroy(); scene.stop(); rulesModal.destroy(); model.actionLock.unlock(); documentRef.body.classList.remove('is-guessnumber-view'); styleHandle.release(); mount.innerHTML = ''; } };
}
