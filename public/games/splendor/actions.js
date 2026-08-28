import { ALL_TOKENS, COLORS } from './constants.js';
import { validTakeChoice } from './state.js';

/** User interaction handlers for 璀璨宝石. */
export function createSplendorActions({ mount, model, scene, renderer, send, rulesModal, getElement }) {
    const $ = getElement || (role => mount.querySelector(`[data-role="${role}"]`));
    const state = () => model.state;

    function chooseTakeToken(color) {
        const current = state();
        if (!COLORS.includes(color) || !current?.availableActions?.canAct || model.actionPending) return;
        const amount = Number(current.tokens?.[color]) || 0;
        const selected = model.tokenChoice.filter(item => item === color).length;
        if (!amount || selected >= amount) return;
        if (model.tokenChoice.length >= 3) model.tokenChoice = [];
        const unique = new Set(model.tokenChoice);
        if (selected > 0) {
            if (model.tokenChoice.length === 1 && amount >= 4) model.tokenChoice.push(color);
            else model.tokenChoice = model.tokenChoice.filter(item => item !== color);
        } else if (model.tokenChoice.length === 2 && unique.size === 1) {
            model.tokenChoice = [color];
        } else {
            model.tokenChoice.push(color);
        }
        model.selectedCard = null;
        renderer.renderCommand();
        renderer.renderMarket();
        renderer.renderGuild();
    }

    function adjustReturnToken(color, direction) {
        const current = state();
        if (!ALL_TOKENS.includes(color) || !current?.availableActions?.canReturnTokens || model.actionPending) return;
        const count = model.tokenChoice.filter(item => item === color).length;
        const held = Number(current.myTokens?.[color]) || 0;
        if (direction > 0 && count < held) model.tokenChoice.push(color);
        if (direction < 0 && count > 0) model.tokenChoice.splice(model.tokenChoice.lastIndexOf(color), 1);
        renderer.renderCommand();
    }

    function sendAction(action) {
        if (model.actionPending) return;
        model.actionPending = true;
        send({ type: 'gameAction', action });
        renderer.render();
    }

    function handleClick(event) {
        if (scene.isPlaying()) {
            if (event.target.closest('[data-action="skipPresentation"]')) scene.stopPresentation();
            return;
        }
        const adjust = event.target.closest('[data-token-adjust]');
        if (adjust && !adjust.disabled) {
            adjustReturnToken(adjust.dataset.tokenColor, Number(adjust.dataset.tokenAdjust));
            return;
        }
        const token = event.target.closest('[data-token-color]');
        if (token && !token.disabled) {
            chooseTakeToken(token.dataset.tokenColor);
            return;
        }
        const card = event.target.closest('[data-card-select]');
        if (card && state()?.availableActions?.canAct && !model.actionPending) {
            const next = { id: card.dataset.cardSelect, source: card.dataset.cardSource };
            model.selectedCard = model.selectedCard?.id === next.id && model.selectedCard?.source === next.source ? null : next;
            model.tokenChoice = [];
            renderer.renderMarket();
            renderer.renderGuild();
            renderer.renderCommand();
            return;
        }
        const action = event.target.closest('[data-action]');
        if (action && !action.disabled) {
            if (action.dataset.action === 'clearTokens') {
                model.tokenChoice = [];
                renderer.renderCommand();
            }
            if (action.dataset.action === 'takeTokens' && validTakeChoice(state(), model)) {
                const colors = model.tokenChoice.slice();
                model.tokenChoice = [];
                sendAction({ kind: 'takeTokens', colors });
            }
            if (action.dataset.action === 'returnTokens') {
                const colors = model.tokenChoice.slice();
                model.tokenChoice = [];
                sendAction({ kind: 'returnTokens', colors });
            }
            if (action.dataset.action === 'buy') sendAction({ kind: 'buyCard', cardId: action.dataset.cardId, fromReserve: action.dataset.fromReserve === 'true' });
            if (action.dataset.action === 'reserve') sendAction({ kind: 'reserveCard', cardId: action.dataset.cardId });
            if (action.dataset.action === 'reserveDeck') sendAction({ kind: 'reserveCard', tier: Number(action.dataset.tier) });
            return;
        }
        const noble = event.target.closest('[data-noble-id]');
        if (noble && !noble.disabled) {
            sendAction({ kind: 'chooseNoble', nobleId: noble.dataset.nobleId });
            return;
        }
        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;
        if (ui === 'rules') rulesModal.setOpen(true);
        if (ui === 'closeRules' || event.target === $('rules')) rulesModal.setOpen(false);
    }

    function handleKeydown(event) {
        if (event.key === 'Escape' && scene.isPlaying()) return scene.stopPresentation();
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
    }

    return { handleClick, handleKeydown };
}
