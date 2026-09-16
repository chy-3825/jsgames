/** Bind lobby DOM events without mixing them into the message/state pipeline. */

export function bindLobbyEvents({ elements, state, actions }) {
    const { entryStartBtn, entryJoinBtn, brandLinks, joinLobbyBackBtn, joinLobbyStartBtn, joinLobbyFooterStartBtn, joinLobbyCodeForm, joinLobbyCodeInput, joinLobbyCodeError, reconnectBtn, reconnectPlayerIdInput, joinLobbyGameFilterEl, entryNameInput, leaveRoomBtn, startGameBtn, lobbyStartGameBtn, lobbyLeaveRoomBtn, roomInfoBtn, roomInfoDialog, roomInfoClose, roomInfoCopyRoom, sendChatBtn, setNameBtn, joinCodeBtn, roomCodeInput, roomListEl, chatInput, nameInput, joinLobbyRoomListEl, openMobileRoomsBtn, mobileRoomsDrawer, mobileRoomListEl, gameMount, roomMount, createRoomNextBtn, createRoomBackBtn, createRoomCancelBtn, createRoomDialogClose, createRoomForm, createRoomDialog, currentRoomPanel, gameFilterEl } = elements;
    entryStartBtn?.addEventListener('click', actions.enterGameCatalog);
    entryJoinBtn?.addEventListener('click', () => actions.showJoinLobby());
    brandLinks.forEach(link => link.addEventListener('click', actions.returnHomeFromBrand));
    joinLobbyBackBtn?.addEventListener('click', () => actions.showEntryGateway({ replayAnimation: false, animateReturn: true }));
    joinLobbyStartBtn?.addEventListener('click', actions.enterGameCatalog);
    joinLobbyFooterStartBtn?.addEventListener('click', actions.enterGameCatalog);
    joinLobbyCodeForm?.addEventListener('submit', actions.joinFromJoinLobby);
    joinLobbyCodeInput?.addEventListener('input', () => { joinLobbyCodeInput.value = joinLobbyCodeInput.value.replace(/\D/g, '').slice(0, 6); if (joinLobbyCodeError) joinLobbyCodeError.textContent = ''; });
    reconnectBtn?.addEventListener('click', actions.reconnectRoom);
    reconnectPlayerIdInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); actions.reconnectRoom(); } });
    joinLobbyGameFilterEl?.addEventListener('change', () => { state.selectedJoinRoomFilter = joinLobbyGameFilterEl.value; actions.renderJoinLobbyRooms(); });
    entryNameInput?.addEventListener('input', actions.updateProfileAvatar);
    roomInfoBtn?.addEventListener('click', actions.openRoomInfo);
    roomInfoClose?.addEventListener('click', actions.closeRoomInfo);
    roomInfoDialog?.addEventListener('click', event => { if (event.target === roomInfoDialog) actions.closeRoomInfo(); });
    roomInfoCopyRoom?.addEventListener('click', async () => {
        if (!state.currentRoomId) return actions.addLog('房间号尚未生成', 'error');
        try { await navigator.clipboard.writeText(state.currentRoomId); actions.showRoomFeedback(`房间号 ${state.currentRoomId} 已复制`, 'info'); }
        catch { actions.addLog(`房间号：${state.currentRoomId}`, 'system'); }
    });
    leaveRoomBtn?.addEventListener('click', actions.leaveRoom); startGameBtn?.addEventListener('click', actions.startGame); lobbyStartGameBtn?.addEventListener('click', actions.startGame); lobbyLeaveRoomBtn?.addEventListener('click', actions.leaveRoom); sendChatBtn?.addEventListener('click', actions.sendChat); setNameBtn?.addEventListener('click', actions.setName); joinCodeBtn?.addEventListener('click', actions.joinByCode); roomCodeInput?.addEventListener('keydown', event => { if (event.key === 'Enter') actions.joinByCode(); }); roomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (button) actions.joinRoom(button.dataset.roomId); }); chatInput?.addEventListener('keydown', event => { if (event.key === 'Enter') actions.sendChat(); }); nameInput?.addEventListener('keydown', event => { if (event.key === 'Enter') actions.setName(); }); nameInput?.addEventListener('input', actions.updateProfileAvatar);
    joinLobbyRoomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (button) actions.joinPublicRoom(button.dataset.roomId); });
    openMobileRoomsBtn?.addEventListener('click', actions.openMobileRooms);
    mobileRoomsDrawer?.addEventListener('click', event => { if (event.target.closest('[data-close-mobile-rooms]')) actions.closeMobileRooms(); });
    mobileRoomListEl?.addEventListener('click', event => { const button = event.target.closest('[data-room-id]'); if (!button) return; actions.closeMobileRooms(); actions.joinRoom(button.dataset.roomId); });
    gameMount?.addEventListener('click', event => {
        if (!actions.getStudyControlsElement() || actions.getStudyControlsElement().hidden || !state.currentRoom?.studyMode) return;
        const button = event.target.closest('[data-study-switch]');
        const seatIndex = Number(actions.getStudySeatIndex());
        const seatCount = Number(actions.getStudySeatCount());
        if ((!button && !event.target.closest('[data-study-place-type]') && !event.target.closest('[data-study-reset], [data-study-clear], [data-study-remove], [data-study-confirm]')) || !Number.isInteger(seatIndex) || !seatCount) return;
        const placeType = event.target.closest('[data-study-place-type]')?.dataset.studyPlaceType;
        if (placeType) {
            actions.getStudyControlsElement().dataset.studyPlacementType = placeType;
            actions.getStudyControlsElement().dataset.studyRemoveMode = '';
            actions.getGameClient()?.setStudyPlacement?.({ type: placeType, remove: false });
            actions.refreshStudyControlSelection();
            return;
        }
        const setupAction = event.target.closest('[data-study-reset], [data-study-clear], [data-study-remove], [data-study-confirm]');
        if (setupAction) {
            if (setupAction.hasAttribute('data-study-reset')) { actions.getGameClient()?.setStudyPlacement?.(null); actions.send({ type: 'gameAction', action: { kind: 'studySetup', op: 'reset' } }); }
            else if (setupAction.hasAttribute('data-study-clear')) { actions.getGameClient()?.setStudyPlacement?.(null); actions.send({ type: 'gameAction', action: { kind: 'studySetup', op: 'clear' } }); }
            else if (setupAction.hasAttribute('data-study-remove')) { const remove = actions.getStudyControlsElement().dataset.studyRemoveMode !== 'true'; actions.getStudyControlsElement().dataset.studyRemoveMode = remove ? 'true' : ''; actions.getStudyControlsElement().dataset.studyPlacementType = ''; actions.getGameClient()?.setStudyPlacement?.(remove ? { remove: true } : null); actions.refreshStudyControlSelection(); }
            else { actions.getGameClient()?.setStudyPlacement?.(null); actions.send({ type: 'gameAction', action: { kind: 'studyConfirmSetup' } }); }
            return;
        }
        actions.getGameClient()?.setStudyPlacement?.(null);
        actions.getStudyControlsElement().dataset.studyPlacementType = '';
        actions.getStudyControlsElement().dataset.studyRemoveMode = '';
        actions.refreshStudyControlSelection();
        actions.send({ type: 'gameAction', action: { kind: 'studySwitchSeat', seatIndex: (seatIndex + 1) % seatCount } });
    });
    gameMount?.addEventListener('click', event => {
        if (!actions.getStudyControlsElement() || actions.getStudyControlsElement().hidden || actions.getStudyControlsElement().dataset.studyPhase !== 'setup' || event.target.closest('.study-controls')) return;
        const square = event.target.closest('[data-x][data-y], [data-board-square]');
        if (!square) return;
        const x = Number(square.dataset.x); const y = Number(square.dataset.y);
        if (!Number.isInteger(x) || !Number.isInteger(y)) return;
        const remove = actions.getStudyControlsElement().dataset.studyRemoveMode === 'true';
        const type = actions.getStudyControlsElement().dataset.studyPlacementType;
        if (!remove && !type) return;
        event.preventDefault();
        event.stopPropagation();
        if (remove) actions.send({ type: 'gameAction', action: { kind: 'studySetup', op: 'remove', x, y } });
        else actions.send({ type: 'gameAction', action: { kind: 'studySetup', op: 'place', x, y, pieceType: type, color: gameMount.dataset.studySide } });
        actions.getGameClient()?.setStudyPlacement?.(null);
        actions.getStudyControlsElement().dataset.studyPlacementType = '';
        actions.getStudyControlsElement().dataset.studyRemoveMode = '';
    }, true);
    roomMount?.addEventListener('click', async event => {
        if (event.target.closest('[data-start-game]')) { actions.handleWaitingStartAction(); return; }
        if (event.target.closest('[data-toggle-ready]')) {
            const player = state.currentRoom?.players?.find(item => item.id === state.myId);
            actions.send({ type: 'setReady', ready: player?.ready !== true });
            return;
        }
        const kick = event.target.closest('[data-kick-player]');
        if (kick) {
            const target = state.currentRoom?.players?.find(player => player.id === kick.dataset.kickPlayer);
            if (target && window.confirm(`确定将 ${target.name} 移出房间吗？`)) actions.send({ type: 'kickPlayer', playerId: target.id });
            return;
        }
        if (event.target.closest('[data-confirm-room-configuration]')) {
            const settings = actions.collectRoomSettingValues(roomMount, state.currentRoom);
            state.pendingRoomSettings = { ...state.pendingRoomSettings, ...settings };
            actions.send({ type: 'configureRoom', settings });
            return;
        }
        if (event.target.closest('[data-save-room-settings]')) {
            const settings = actions.collectRoomSettingValues(roomMount, state.currentRoom);
            state.pendingRoomSettings = { ...state.pendingRoomSettings, ...settings };
            actions.send({ type: 'updateRoomSettings', settings });
            return;
        }
        if (event.target.closest('[data-retry-preload]')) { actions.preloadGameClient(state.currentRoom?.gameType, true).catch(error => actions.addLog(`资源预加载失败：${error.message}`, 'error')); return; }
        if (event.target.closest('[data-copy-room-code]')) {
            try { await navigator.clipboard.writeText(state.currentRoomId); actions.addLog(`房间号 ${state.currentRoomId} 已复制`, 'system'); }
            catch { actions.addLog(`房间号：${state.currentRoomId}`, 'system'); }
        }
    });
    roomMount?.addEventListener('change', event => {
        const input = event.target.closest('[data-room-setting-input]');
        if (!input) return;
        const key = input.dataset.roomSettingKey;
        state.pendingRoomSettings[key] = input.type === 'checkbox' ? input.checked : input.value;
        if (key === 'playerCount') state.pendingRoomPlayerCount = Number(input.value);
        if (key === 'encryptorMode') state.pendingEncryptorMode = input.value;
    });
    window.addEventListener('resize', () => {
        actions.scheduleWaitingRoomRender();
    });
    createRoomNextBtn?.addEventListener('click', actions.showCreateRoomSettings);
    createRoomBackBtn?.addEventListener('click', actions.showCreateRoomRules);
    createRoomCancelBtn?.addEventListener('click', () => actions.closeCreateRoomDialog());
    createRoomDialogClose?.addEventListener('click', () => actions.closeCreateRoomDialog());
    createRoomForm?.addEventListener('submit', actions.submitCreateRoom);
    createRoomDialog?.addEventListener('click', event => { if (event.target === createRoomDialog) actions.closeCreateRoomDialog(); });
    document.addEventListener('keydown', event => {
        if (actions.isRoomInfoOpen?.()) {
            if (event.key === 'Escape') { event.preventDefault(); actions.closeRoomInfo(); return; }
            if (actions.trapRoomInfoFocus?.(event)) return;
        }
        if (event.key === 'Escape' && mobileRoomsDrawer && !mobileRoomsDrawer.hidden) { event.preventDefault(); actions.closeMobileRooms(); return; }
        if (!createRoomDialog || createRoomDialog.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            actions.closeCreateRoomDialog();
            return;
        }
        if (event.key !== 'Tab') return;
        const activeStep = createRoomDialog.classList.contains('is-settings') ? createRoomForm : createRoomDialog.querySelector('.game-rules-step');
        const focusable = [createRoomDialogClose, ...activeStep.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && !element.closest('[hidden]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    currentRoomPanel?.addEventListener('click', event => {
        const option = event.target.closest('[data-room-player-count]');
        if (option) { state.pendingRoomPlayerCount = Number(option.dataset.roomPlayerCount); actions.renderWaitingRoomPanel(); return; }
        const mode = event.target.closest('[data-encryptor-mode]');
        if (mode) { state.pendingEncryptorMode = mode.dataset.encryptorMode; actions.renderWaitingRoomPanel(); return; }
        if (event.target.closest('[data-confirm-room-configuration]')) actions.send(state.currentRoom?.gameType === 'decrypto' ? { type: 'configureRoom', encryptorMode: state.pendingEncryptorMode } : { type: 'configureRoom', playerCount: state.pendingRoomPlayerCount });
    });
    gameFilterEl?.addEventListener('change', () => { state.selectedGameFilter = gameFilterEl.value; actions.applyGameFilter(); });
    document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-invite]'); if (!copy) return; const invite = document.getElementById('ipDisplay'); const text = invite?.dataset.inviteUrl || invite?.textContent || ''; if (!text || text.includes('先创建')) return actions.addLog('请先创建或加入房间', 'error'); try { await navigator.clipboard.writeText(text); actions.addLog('邀请链接已复制', 'system'); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制'; }, 1400); } catch { actions.addLog('复制失败，请手动复制邀请链接', 'error'); } });
    document.addEventListener('click', async event => { const copy = event.target.closest('[data-copy-player-id]'); if (!copy) return; if (!state.myId) return actions.addLog('玩家 ID 尚未生成', 'error'); try { await navigator.clipboard.writeText(state.myId); actions.showRoomFeedback(`玩家 ID ${state.myId} 已复制`, 'info'); } catch { actions.addLog(`玩家 ID：${state.myId}`, 'system'); } });
    document.addEventListener('click', event => { if (event.target.closest('[data-dismiss-fatal]')) document.getElementById('fatalErrorBox')?.style.setProperty('display', 'none'); });
}
