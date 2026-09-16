/** Translate lobby protocol messages into UI/domain actions. */

export function createMessageHandler({ state, elements, actions, storage }) {
    return async function handleMessage(data) {
    switch (data.type) {
        case 'session':
            if (!state.sessionToken && data.sessionToken) state.sessionToken = data.sessionToken;
            if (state.sessionToken) storage.setItem(elements.sessionStorageKey, state.sessionToken);
            if (data.playerId) state.myId = data.playerId;
            break;
        case 'resumeSuccess':
            state.sessionResumePending = false;
            state.sessionToken = state.sessionToken || storage.getItem(elements.sessionStorageKey) || '';
            if (data.room) {
                actions.setCreateRoomRequestPending(false);
                actions.closeCreateRoomDialog(true);
                actions.setRoom(data);
                state.currentRoom = data.room;
                if (data.room.status === 'waiting') actions.enterWaitingRoom();
            } else if (state.currentRoomId) {
                state.currentRoomId = null;
                state.currentRoom = null;
                actions.updateInviteLink();
                actions.returnToLobby();
            }
            actions.addLog(data.room ? `已恢复房间 ${data.roomId}` : '会话已恢复', 'system');
            break;
        case 'resumeFailed':
            state.sessionResumePending = false;
            storage.removeItem(elements.sessionStorageKey);
            state.sessionToken = '';
            actions.addLog(data.message || '会话已过期', 'error');
            break;
        case 'gameList':
            actions.renderGameList(data.games);
            break;
        case 'roomList':
            actions.renderRoomList(data.rooms);
            break;
        case 'playerCount':
            elements.playerCountEl.textContent = `在线 ${data.count}`;
            if (elements.joinLobbyPlayerCountEl) elements.joinLobbyPlayerCountEl.textContent = elements.playerCountEl.textContent;
            break;
        case 'roomCreated':
            actions.setCreateRoomRequestPending(false);
            actions.closeCreateRoomDialog(true);
            actions.setRoom(data);
            actions.addLog(`${data.room?.roomName || '房间'}（${data.roomId}）创建成功`, 'system');
            actions.enterWaitingRoom();
            break;
        case 'reconnectRequired':
            actions.setJoinLobbyPending(false);
            state.reconnectRoomId = data.roomId;
            elements.reconnectForm.hidden = false;
            elements.reconnectError.textContent = '';
            elements.joinLobbyCodeError.textContent = '';
            actions.addLog(data.message || '请输入断线玩家 ID 进行重连', 'info');
            requestAnimationFrame(() => elements.reconnectPlayerIdInput?.focus());
            break;
        case 'reconnectSuccess':
            state.reconnectRequestPending = false;
            state.reconnectRoomId = null;
            if (elements.reconnectBtn) { elements.reconnectBtn.disabled = false; elements.reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
            elements.reconnectForm.hidden = true;
            actions.setRoom(data);
            state.currentRoom = data.room || state.currentRoom;
            actions.setRoomConnectionState(state.currentRoom?.connectionState, '已恢复原来的座位，正在回到对局…');
            actions.addLog(`已恢复 ${data.playerName || data.playerId} 的座位`, 'system');
            break;
        case 'reconnectFailed':
            state.reconnectRequestPending = false;
            if (elements.reconnectBtn) { elements.reconnectBtn.disabled = false; elements.reconnectBtn.innerHTML = '恢复座位 <span>→</span>'; }
            if (elements.reconnectError) elements.reconnectError.textContent = data.message || '重连失败，请检查房间号和玩家 ID。';
            actions.addLog(data.message || '重连失败', 'error');
            break;
        case 'joinSuccess':
            actions.setJoinLobbyPending(false);
            state.pendingUrlRoom = null;
            state.pendingUrlInviteToken = '';
            actions.setRoom(data);
            actions.addLog(`成功加入房间 ${data.roomId}`, 'system');
            actions.enterWaitingRoom();
            break;
        case 'roomConfigured':
            state.currentRoom = data.room || state.currentRoom;
            state.pendingRoomPlayerCount = Number(state.currentRoom?.targetPlayers || state.pendingRoomPlayerCount);
            state.pendingEncryptorMode = state.currentRoom?.gameOptions?.encryptorMode || state.pendingEncryptorMode;
            state.pendingRoomSettings = actions.getRoomSettingValues(state.currentRoom);
            actions.updateInviteLink();
            actions.renderWaitingRoomPanel();
            actions.addLog(data.message || '房间人数已确认，现已公开', 'system');
            break;
        case 'playerJoined':
            state.currentRoom = data.room || state.currentRoom;
            actions.addLog(`${data.player.name} 加入了房间`, 'info');
            actions.renderWaitingRoomPanel();
            break;
        case 'playerLeft':
            state.currentRoom = data.room || state.currentRoom;
            actions.addLog(data.message || '有玩家离开了房间', 'info');
            actions.renderWaitingRoomPanel();
            break;
        case 'playerReady':
            state.currentRoom = data.room || state.currentRoom;
            actions.addLog(data.message || '准备状态已更新', 'info');
            actions.renderWaitingRoomPanel();
            break;
        case 'roomSettingsUpdated':
            state.currentRoom = data.room || state.currentRoom;
            state.pendingRoomSettings = actions.getRoomSettingValues(state.currentRoom);
            state.pendingRoomPlayerCount = Number(state.currentRoom?.targetPlayers || state.pendingRoomPlayerCount);
            state.pendingEncryptorMode = state.currentRoom?.gameOptions?.encryptorMode || state.pendingEncryptorMode;
            actions.addLog(data.message || '房间设置已更新', 'system');
            actions.renderWaitingRoomPanel();
            break;
        case 'playerKicked':
            state.currentRoomId = null;
            state.currentRoom = null;
            state.pendingRoomSettings = {};
            actions.updateInviteLink();
            actions.returnToLobby();
            actions.showRoomFeedback(data.message || '你已被房主移出房间', 'warning');
            actions.addLog(data.message || '你已被房主移出房间', 'error');
            break;
        case 'playerRenamed':
            state.currentRoom = data.room || state.currentRoom;
            actions.renderWaitingRoomPanel();
            break;
        case 'nameChanged':
            actions.applyServerName(data.name, false);
            break;
        case 'nameRejected':
            actions.applyServerName(data.name, true);
            actions.addLog(data.message || '该用户名已存在，请换一个名字', 'error');
            break;
        case 'playerDisconnected':
            state.currentRoom = data.room || state.currentRoom;
            actions.setStartGameRequestPending?.(false);
            actions.setRoomConnectionState(data.room?.connectionState, `${data.player?.name || '玩家'} 已断开连接`);
            actions.addLog(data.message || `${data.player?.name || '玩家'} 已断线`, 'error');
            if (state.currentRoom?.status === 'waiting') actions.cancelGameEntryTransition();
            actions.renderWaitingRoomPanel();
            break;
        case 'playerReconnected':
            state.currentRoom = data.room || state.currentRoom;
            actions.setRoomConnectionState(data.connectionState || state.currentRoom?.connectionState, data.message);
            actions.addLog(data.message || `${data.player?.name || '玩家'} 已重连`, 'system');
            if (state.currentRoom?.status === 'waiting') actions.renderWaitingRoomPanel();
            break;
        case 'roomPaused':
            state.currentRoom = data.room || state.currentRoom;
            actions.setRoomConnectionState(data.connectionState || state.currentRoom?.connectionState, data.message);
            actions.addLog(data.message || '游戏已暂停，等待断线玩家重连', 'error');
            break;
        case 'roomResumed':
            state.currentRoom = data.room || state.currentRoom;
            actions.setRoomConnectionState(data.connectionState || state.currentRoom?.connectionState);
            actions.addLog(data.message || '玩家已重连，游戏恢复', 'system');
            if (state.currentRoom?.status === 'waiting') actions.renderWaitingRoomPanel();
            break;
        case 'gameStarting':
            state.currentRoom = data.room || state.currentRoom;
            if (state.currentRoom) state.currentRoom.status = 'starting';
            actions.setStartGameRequestPending?.(false);
            await actions.showGameStarting(data);
            break;
        case 'gameStartCancelled':
            state.currentRoom = data.room || state.currentRoom;
            if (state.currentRoom) state.currentRoom.status = 'waiting';
            actions.setStartGameRequestPending?.(false);
            actions.cancelGameEntryTransition();
            actions.renderWaitingRoomPanel();
            actions.addLog(data.message || '开局已取消，请重新确认房间状态', 'warning');
            break;
        case 'chat':
            actions.addLog(`${data.player.id === state.myId ? '我' : data.player.name}: ${data.message}`, 'chat');
            break;
        case 'gameStarted':
            if (state.currentRoom) state.currentRoom.status = 'playing';
            actions.setStartGameRequestPending?.(false);
            await actions.showGameMessage(data);
            break;
        case 'gameState':
        case 'gameEnded':
            actions.setRoomConnectionState(data.state?.roomConnection || state.currentRoom?.connectionState);
            await actions.showGameMessage(data);
            if (data.type === 'gameEnded' && data.winner) {
                const winnerNames = data.winner.winners?.map(winner => winner.name).join('、') || data.winner.name;
                actions.addLog(`${winnerNames} 获胜`, 'system');
            }
            break;
        case 'error': {
            const startWasPending = state.startGameRequestPending;
            actions.setStartGameRequestPending?.(false);
            if (startWasPending && state.currentRoom?.status === 'waiting') actions.renderWaitingRoomPanel();
            // Active games receive authoritative rejected-action state so they
            // can clear pending controls and render the server snapshot.
            if (state.joinLobbyJoinPending) {
                actions.setJoinLobbyPending(false, data.message || '无法加入该房间，请核对房间号。');
                actions.addLog(data.message || '加入房间失败', 'error');
            } else if (state.createRoomRequestPending) {
                actions.setCreateRoomRequestPending(false);
                elements.createRoomFormError.textContent = data.message || '房间创建失败，请检查设置后重试';
                elements.createRoomDialog?.classList.add('is-settings');
                actions.addLog(data.message || '房间创建失败', 'error');
            } else if (actions.getGameClient()?.handleMessage) actions.getGameClient().handleMessage(data);
            else actions.addLog(data.message, 'error');
            break;
        }
        default:
            break;
    }
}
}
