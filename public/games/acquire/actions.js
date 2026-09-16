import { escapeHtml } from './constants.js';
import { chainHeadquartersMarkup } from './cards.js';
import { getChain, getMe } from './state.js';

/** User interaction and decision handlers for 并购. */
export function createAcquireActions({ mount, model, renderer, scene, send, rulesModal, decisionModal }) {
    const $ = selector => mount.querySelector(selector.startsWith('[') ? selector : `[data-role="${selector}"]`);
    const state = () => model.state;

    function sendAction(kind, payload = {}) {
        if (model.actionPending) return false;
        model.actionPending = true;
        renderer.clearError();
        send({ type: 'gameAction', action: { kind, ...payload } });
        renderer.render();
        return true;
    }

    function openDecision(config, trigger) {
        model.pendingConfirmation = config?.action ? config : null;
        if (!model.pendingConfirmation) return;
        model.previousFocus = trigger || globalThis.document?.activeElement;
        $('decisionMark').textContent = config.mark || 'A';
        $('decisionKicker').textContent = config.kicker || '确认决策';
        $('decisionTitle').textContent = config.title || '确认操作';
        $('decisionCopy').textContent = config.copy || '';
        $('decisionSummary').innerHTML = config.summary || '';
        const confirm = mount.querySelector('[data-ui="confirmDecision"]');
        confirm.textContent = config.confirmLabel || '确认执行';
        confirm.className = `${config.danger ? 'acquire-end-button' : 'acquire-primary-button'}`;
        decisionModal.setOpen(true);
    }

    function closeDecision(restoreFocus = true) {
        decisionModal.setOpen(false);
        model.pendingConfirmation = null;
        if (restoreFocus && model.previousFocus?.isConnected) model.previousFocus.focus({ preventScroll: true });
        model.previousFocus = null;
    }

    function confirmDecision() {
        const decision = model.pendingConfirmation;
        if (!decision?.action) return;
        closeDecision(false);
        const { kind, ...payload } = decision.action;
        sendAction(kind, payload);
    }

    function handleClick(event) {
        const presentationAction = event.target.closest('[data-action="skipPresentation"]');
        if (presentationAction) { scene.stopPresentation(); return; }
        const uiButton = event.target.closest('[data-ui]');
        if (uiButton) {
            const ui = uiButton.dataset.ui;
            if (ui === 'closeDetails') $('detailDialog').close();
            if (ui === 'playerDetails' || ui === 'chainDetails') {
                model.detailKind = ui === 'playerDetails' ? 'player' : 'chain';
                model.detailId = ui === 'playerDetails' ? uiButton.dataset.playerId : uiButton.dataset.chainId;
                renderer.renderDetails();
                if (!$('detailDialog').open) $('detailDialog').showModal();
            }
            if (ui === 'rules') rulesModal.setOpen(true);
            if (ui === 'closeRules') rulesModal.setOpen(false);
            if (ui === 'cancelDecision') closeDecision();
            if (ui === 'confirmDecision') confirmDecision();
            return;
        }
        if (scene.isPlaying()) return;
        const rulesOverlay = $('rulesOverlay');
        const decisionOverlay = $('decisionOverlay');
        if (event.target === rulesOverlay) { rulesModal.setOpen(false); return; }
        if (event.target === decisionOverlay) { closeDecision(); return; }
        const discard = event.target.closest('[data-discard-tile]');
        if (discard && !discard.disabled) {
            const tileId = discard.dataset.discardTile;
            openDecision({ action: { kind: 'discardTile', tileId }, mark: '×', kicker: '永久不可玩地块', title: `确认弃置 ${tileId}`, copy: '这块地块会连接两个安全集团，已经无法合法铺设；弃置后本回合进入购股阶段。', summary: `<span>弃置地块</span><strong>${escapeHtml(tileId)}</strong>`, confirmLabel: '确认弃置' }, discard);
            return;
        }
        const tile = event.target.closest('[data-tile-id]');
        if (tile && !tile.disabled) { model.pendingTileId = model.pendingTileId === tile.dataset.tileId ? null : tile.dataset.tileId; renderer.renderHand(); return; }
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton || actionButton.disabled || model.actionPending) return;
        const action = actionButton.dataset.action;
        if (action === 'confirmTile' && model.pendingTileId) {
            const tileId = model.pendingTileId;
            const tileElement = [...mount.querySelectorAll('[data-tile-id]')].find(element => element.dataset.tileId === tileId);
            const rect = tileElement?.getBoundingClientRect();
            model.pendingTileOrigin = rect ? { tileId, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
            model.pendingTileId = null;
            renderer.renderHand();
            sendAction('placeTile', { tileId });
        }
        if (action === 'foundChain') {
            const chain = getChain(state(), actionButton.dataset.chainId);
            openDecision({ action: { kind: action, chainId: chain?.id }, mark: chain?.short, kicker: '集团成立决议', title: `成立${chain?.name || '新'}集团`, copy: '确认后，相连的中立建筑会归入该集团；若股票库存充足，你将获得一股创始人股票。', summary: `${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain?.name || '')}</strong><small>创始人股票 ×1</small></span>`, confirmLabel: '确认成立集团' }, actionButton);
        }
        if (action === 'chooseMerger') {
            const current = state(); const chain = getChain(current, actionButton.dataset.chainId); const acquired = (current.pendingMerger?.chains || []).map(id => getChain(current, id)).filter(item => item && item.id !== chain?.id);
            openDecision({ action: { kind: action, chainId: chain?.id }, mark: chain?.short, kicker: '并购存续裁决', title: `让${chain?.name || '该'}集团存续`, copy: '确认后将立即发放被收购集团的多数与少数股东奖金，并依次进入旧股处理。', summary: `${chainHeadquartersMarkup(chain, 'is-option')}<span><strong>${escapeHtml(chain?.name || '')} · ${Number(chain?.size) || 0} 格</strong><small>收购 ${acquired.map(item => `${escapeHtml(item.name)} ${Number(item.size) || 0} 格`).join('、')}</small></span>`, confirmLabel: '确认存续集团', danger: true }, actionButton);
        }
        if (action === 'skipFoundation') openDecision({ action: { kind: action }, mark: '—', kicker: '放弃成立集团', title: '保持为独立建筑？', copy: '确认后不会成立集团，也不会获得创始人股票，本回合将进入购股阶段。', summary: '<span>当前地块</span><strong>保持中立</strong>', confirmLabel: '确认保持独立' }, actionButton);
        if (action === 'skipPlacement') sendAction(action);
        if (action === 'endGame') openDecision({ action: { kind: action }, mark: '$', kicker: '最终收市决议', title: '宣布结束并购？', copy: '宣布后不能撤回；你仍要完成本回合购股，随后立即发放全部股东奖金并清算所有股票。', summary: '<span>清算时点</span><strong>本回合交易结束后</strong>', confirmLabel: '确认宣布结束', danger: true }, actionButton);
        if (action === 'settleMergerShares') { const values = Object.fromEntries([...mount.querySelectorAll('[data-merger-settle]')].map(input => [input.dataset.mergerSettle, Number(input.value) || 0])); sendAction(action, { chainId: state().mergerSettlement.chainId, sell: values.sell || 0, trade: values.trade || 0, keep: values.keep || 0 }); }
        if (action === 'buyShares') { const orders = {}; mount.querySelectorAll('[data-buy-chain]').forEach(input => { const count = Number(input.value) || 0; if (count > 0) orders[input.dataset.buyChain] = count; }); sendAction(action, { orders }); }
    }

    function handleInput(event) {
        if (event.target.matches('[data-merger-settle]')) renderer.updateSettlementPreview();
        if (event.target.matches('[data-buy-chain]')) renderer.updateBuyPreview();
    }

    function handleKeydown(event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.acquire-cell[data-ui="chainDetails"]')) { event.preventDefault(); event.target.click(); return; }

        if (rulesModal.trapFocus(event) || decisionModal.trapFocus(event)) return;
        if (event.key === 'Escape' && rulesModal.isOpen()) rulesModal.setOpen(false);
        else if (event.key === 'Escape' && decisionModal.isOpen()) closeDecision();
        else if (event.key === 'Escape' && scene.isPlaying()) scene.stopPresentation();
    }

    return { handleClick, handleInput, handleKeydown, sendAction, openDecision, closeDecision };
}
