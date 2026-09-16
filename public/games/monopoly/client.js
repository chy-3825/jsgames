import { getGameStyleHrefs } from '../common/game-manifest.js';
import { createClientScope } from '../common/lifecycle.js';
import { createModalController } from '../common/modal.js';
import { loadStyles } from '../common/style-loader.js';
import { BOARD_CENTER_SKINS, randomSumSevenDice } from './constants.js';
import { createMonopolyActions } from './actions.js';
import { createMonopolyModel, normalizeDice, rollAnimationKey } from './state.js';
import { createMonopolyTemplate } from './template.js';
import { createMonopolyRenderer } from './render.js';
import { createMonopolyScene } from './scene.js';

/** Thin protocol/lifecycle entry for 环城大富翁. */
export function createGameClient({ mount, send, addLog }) {
    const documentRef = globalThis.document;
    const windowRef = globalThis.window || globalThis;
    const styleHandle = loadStyles(getGameStyleHrefs('monopoly'), { documentRef });
    const scope = createClientScope({ windowRef });
    documentRef.body.classList.add('is-monopoly-view');

    const model = createMonopolyModel({ windowRef });
    const initialSkin = BOARD_CENTER_SKINS.find(skin => skin.id === model.activeSkinId) || BOARD_CENTER_SKINS[0];
    mount.innerHTML = createMonopolyTemplate({ initialSkin, activeSkinId: model.activeSkinId });
    const getElement = role => mount.querySelector(`[data-role="${role}"]`);
    const renderer = createMonopolyRenderer({ mount, model, getElement });
    const scene = createMonopolyScene({ model, renderer, windowRef });
    const rulesModal = createModalController({ root: mount.querySelector('.mono-game'), overlay: getElement('rulesOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="rules"]') });
    const tradeModal = createModalController({ root: mount.querySelector('.mono-game'), overlay: getElement('tradeOverlay'), documentRef, windowRef, fallbackFocus: () => mount.querySelector('[data-ui="trade"]') });
    const actions = createMonopolyActions({ mount, model, renderer, scene, send, rulesModal, tradeModal, documentRef, windowRef });

    mount.addEventListener('click', actions.handleClick, { signal: scope.signal });
    mount.addEventListener('change', actions.handleChange, { signal: scope.signal });
    documentRef.addEventListener('keydown', actions.handleKeydown, { signal: scope.signal });

    function handleMessage(message) {
        if (message.type === 'error' && model.isRollPending) scene.cancelDiceAnimation();
        if (message.state) {
            model.isReceivingState = true;
            const previousState = model.state;
            const nextState = message.state;
            if (previousState && normalizeDice(previousState.dice) && !normalizeDice(nextState.dice)) model.idleDice = randomSumSevenDice();
            scene.syncVisualPositions(nextState);
            model.state = nextState;

            const rollAction = ['rollDice', 'rollForDoubles'].includes(model.state.lastAction?.kind) ? model.state.lastAction : null;
            const rollValues = normalizeDice(rollAction?.dice) || (rollAction?.kind === 'rollForDoubles' ? normalizeDice(model.state.dice) : null);
            const rollKey = rollValues
                ? rollAnimationKey(rollAction, rollValues)
                : '';
            if (rollValues && !previousState) {
                model.visibleDice = rollValues;
                model.latestRollKey = rollKey;
            } else if (rollValues && model.isRollPending && model.isDiceAnimating) {
                model.isRollPending = false;
                model.latestRollKey = rollKey;
                model.diceAnimationFinal = rollValues;
            } else if (rollValues) {
                scene.beginDiceAnimation(rollValues, rollKey);
            }

            const movement = scene.movementRequest(previousState, model.state);
            if (movement && movement.key !== model.latestMoveKey) {
                model.latestMoveKey = movement.key;
                if (model.isDiceAnimating) model.pendingMovement = movement;
                else scene.startMovementAnimation(movement);
            }
            model.isReceivingState = false;
            renderer.render();
        }
        if (message.type === 'error') addLog?.(message.message || '操作失败', 'error');
    }

    return {
        gameType: 'monopoly',
        handleMessage,
        destroy() {
            scene.stop();
            actions.destroy();
            rulesModal.destroy();
            tradeModal.destroy();
            scope.destroy();
            documentRef.body.classList.remove('is-monopoly-view');
            styleHandle.release();
            mount.innerHTML = '';
        },
    };
}
