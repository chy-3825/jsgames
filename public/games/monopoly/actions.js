import { BOARD_CENTER_SKINS, PLAYER_TOKEN_ART, PLAYER_TOKEN_NAMES } from './constants.js';
import { storeBoardSkin, storeTokenStyle } from './state.js';

/** User interaction and action submission handlers for 环城大富翁. */
export function createMonopolyActions({ mount, model, renderer, scene, send, rulesModal, documentRef = globalThis.document, windowRef = globalThis.window || globalThis }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const state = () => model.state;
    const animationLocked = () => model.isDiceAnimating || model.isMoveAnimating || model.isRollPending;

    function setSkinMenu(open, returnFocus = false) {
        model.skinMenuOpen = Boolean(open);
        const menu = $('skinMenu');
        const trigger = mount.querySelector('[data-ui="toggleSkinMenu"]');
        menu.hidden = !model.skinMenuOpen;
        menu.setAttribute('aria-hidden', String(!model.skinMenuOpen));
        trigger.setAttribute('aria-expanded', String(model.skinMenuOpen));
        trigger.classList.toggle('is-open', model.skinMenuOpen);
        if (!model.skinMenuOpen && returnFocus) trigger.focus();
    }

    function setTokenMenu(open, returnFocus = false) {
        model.tokenMenuOpen = Boolean(open);
        if (model.tokenMenuOpen) {
            const me = state()?.players?.find(player => player.id === state().myId);
            if (me?.tokenStyle === '2d' || me?.tokenStyle === '3d') model.previewTokenStyle = me.tokenStyle;
        }
        const menu = $('tokenMenu');
        const trigger = mount.querySelector('[data-ui="toggleTokenMenu"]');
        menu.hidden = !model.tokenMenuOpen;
        menu.setAttribute('aria-hidden', String(!model.tokenMenuOpen));
        trigger.setAttribute('aria-expanded', String(model.tokenMenuOpen));
        trigger.classList.toggle('is-open', model.tokenMenuOpen);
        renderer.updateTokenMenu();
        if (!model.tokenMenuOpen && returnFocus) trigger.focus();
    }

    function revokeLocalSkin() {
        if (!model.localSkinObjectUrl) return;
        try {
            (windowRef?.URL || globalThis.URL)?.revokeObjectURL(model.localSkinObjectUrl);
        } catch {
            // Some embedded browsers expose URL without object URL support.
        }
        model.localSkinObjectUrl = null;
    }

    function selectTokenStyle(style) {
        if (!PLAYER_TOKEN_ART[style] || style === model.previewTokenStyle || animationLocked()) return;
        model.previewTokenStyle = style;
        storeTokenStyle(style, windowRef);
        renderer.updateTokenMenu();
        const me = state()?.players?.find(player => player.id === state().myId);
        if (me && Number.isInteger(me.tokenId) && state().status === 'playing') {
            send({ type: 'gameAction', action: { kind: 'selectToken', tokenId: me.tokenId, tokenStyle: style } });
        }
    }

    function selectTokenSkin(tokenId) {
        const nextTokenId = Number(tokenId);
        const current = state();
        const me = current?.players?.find(player => player.id === current.myId);
        const owner = current?.players?.find(player => player.id !== current.myId && !player.isBankrupt && player.isOnline !== false && player.tokenId === nextTokenId);
        if (!me || current.status !== 'playing' || animationLocked() || !Number.isInteger(nextTokenId) || nextTokenId < 0 || nextTokenId >= PLAYER_TOKEN_NAMES.length || owner) return;
        if (me.tokenId === nextTokenId && me.tokenStyle === model.previewTokenStyle) {
            setTokenMenu(false, true);
            return;
        }
        send({ type: 'gameAction', action: { kind: 'selectToken', tokenId: nextTokenId, tokenStyle: model.previewTokenStyle } });
        setTokenMenu(false, true);
    }

    function selectBuiltInSkin(skinId) {
        const skin = BOARD_CENTER_SKINS.find(candidate => candidate.id === skinId);
        if (!skin) return;
        $('centerArt').src = skin.image;
        model.activeSkinId = skin.id;
        revokeLocalSkin();
        storeBoardSkin(skin.id, windowRef);
        renderer.updateSkinControls();
        setSkinMenu(false, true);
    }

    function selectLocalSkin(file) {
        if (!file || (file.type && !String(file.type).startsWith('image/'))) return;
        let nextObjectUrl;
        try {
            nextObjectUrl = (windowRef?.URL || globalThis.URL).createObjectURL(file);
        } catch {
            return;
        }
        const previousObjectUrl = model.localSkinObjectUrl;
        model.localSkinObjectUrl = nextObjectUrl;
        model.activeSkinId = 'local';
        $('centerArt').src = nextObjectUrl;
        if (previousObjectUrl) {
            try {
                (windowRef?.URL || globalThis.URL)?.revokeObjectURL(previousObjectUrl);
            } catch {
                // The replacement is still valid even if revocation is unsupported.
            }
        }
        renderer.updateSkinControls();
        setSkinMenu(false, true);
    }

    function sendAction(action) {
        if (!action || animationLocked()) return;
        if (action.kind === 'rollDice' || action.kind === 'rollForDoubles') {
            model.isRollPending = true;
            scene.beginDiceAnimation();
        }
        send({ type: 'gameAction', action });
    }

    function handleClick(event) {
        const uiButton = event.target.closest('[data-ui]');
        const ui = uiButton?.dataset.ui;
        if (ui === 'selectTokenStyle') {
            selectTokenStyle(uiButton.dataset.tokenStyle);
            return;
        }
        if (ui === 'toggleTokenMenu') {
            if (!model.tokenMenuOpen) setSkinMenu(false);
            setTokenMenu(!model.tokenMenuOpen);
            return;
        }
        if (ui === 'selectToken') {
            selectTokenSkin(uiButton.dataset.tokenId);
            return;
        }
        if (ui === 'toggleSkinMenu') {
            if (!model.skinMenuOpen) setTokenMenu(false);
            setSkinMenu(!model.skinMenuOpen);
            return;
        }
        if (ui === 'selectSkin') {
            selectBuiltInSkin(uiButton.dataset.skinId);
            return;
        }
        if (ui === 'uploadSkin') {
            $('skinUpload').click();
            return;
        }
        if (ui === 'rules') {
            rulesModal.setOpen(true);
            return;
        }
        if (ui === 'closeRules') {
            rulesModal.setOpen(false);
            return;
        }
        if (ui === 'previousTile' || ui === 'nextTile') {
            const direction = ui === 'previousTile' ? -1 : 1;
            const count = state()?.board?.length || 40;
            model.selectedTile = (model.selectedTile + direction + count) % count;
            model.followPlayerPosition = false;
            renderer.render();
            return;
        }
        if (ui === 'followPosition') {
            model.followPlayerPosition = true;
            renderer.render();
            return;
        }

        if (model.skinMenuOpen && !event.target.closest('.mono-skin-switcher')) setSkinMenu(false);
        if (model.tokenMenuOpen && !event.target.closest('.mono-token-switcher')) setTokenMenu(false);

        const tile = event.target.closest('.mono-tile');
        if (tile && !event.target.closest('[data-action]')) {
            model.selectedTile = Number(tile.dataset.index);
            model.followPlayerPosition = false;
            renderer.render();
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            const action = actionButton.dataset.action;
            if (animationLocked() || actionButton.disabled) return;
            const payload = { kind: action };
            if (['buildHouse', 'sellBuilding', 'mortgageProperty', 'unmortgageProperty'].includes(action)) payload.tileIndex = Number(actionButton.dataset.tileIndex);
            if (action === 'bidProperty') payload.amount = Number(mount.querySelector('[data-auction-amount]')?.value || 0);
            sendAction(payload);
            return;
        }

        if (event.target.matches('[data-role="rulesOverlay"]')) rulesModal.setOpen(false);
    }

    function handleChange(event) {
        if (event.target === $('mobileTileSelect')) {
            model.selectedTile = Number(event.target.value);
            model.followPlayerPosition = false;
            renderer.render();
            return;
        }
        if (!event.target.matches('[data-role="skinUpload"]')) return;
        selectLocalSkin(event.target.files?.[0]);
        event.target.value = '';
    }

    function handleKeydown(event) {
        if (rulesModal.trapFocus(event)) return;
        if (event.key === 'Escape' && model.skinMenuOpen) {
            setSkinMenu(false, true);
            return;
        }
        if (event.key === 'Escape' && model.tokenMenuOpen) {
            setTokenMenu(false, true);
            return;
        }
        if (event.key === 'Escape' && rulesModal.isOpen()) {
            rulesModal.setOpen(false);
            return;
        }
        if (event.key === 'Enter' && event.target.matches('[data-auction-amount]')) {
            event.preventDefault();
            mount.querySelector('[data-action="bidProperty"]')?.click();
        }
    }

    function destroy() {
        revokeLocalSkin();
        model.skinMenuOpen = false;
        model.tokenMenuOpen = false;
    }

    return { handleClick, handleChange, handleKeydown, destroy, setSkinMenu, setTokenMenu };
}
