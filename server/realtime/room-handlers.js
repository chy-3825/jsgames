'use strict';

/** Room-scoped command handlers for the realtime transport. */
function createRoomHandlers({
    players, rooms, sessions, registry, RoomClass, WebSocketImpl,
    requireReconnectToken, isReconnectTokenValid, RECONNECT_GRACE_MS,
    broadcastToRoom, broadcastToAll, broadcastRoomList, broadcastPlayerCount,
    sendProtocolError, sanitizeChatMessage, policy,
    sendGameStateToRoom, sendGameStateToPlayer, removePlayerFromCurrentRoom,
    generateRoomId,
}) {
    const gameStartTimers = new Map();

    function clearGameStartTimer(roomId) {
        const timer = gameStartTimers.get(roomId);
        if (timer) clearTimeout(timer);
        gameStartTimers.delete(roomId);
    }

    function cancelGameStart(room, message = '开局已取消，请重新确认房间状态') {
        if (!room) return false;
        clearGameStartTimer(room.id);
        const cancelled = room.cancelGameStartTransition?.() || false;
        if (!cancelled) return false;
        broadcastToRoom(room.id, {
            type: 'gameStartCancelled',
            room: room.getInfo(),
            message,
        });
        broadcastRoomList();
        return true;
    }

    function scheduleGameStart(room, entryTransition) {
        clearGameStartTimer(room.id);
        const delay = Math.max(0, Number(entryTransition?.playableAt || Date.now()) - Date.now());
        const timer = setTimeout(() => {
            gameStartTimers.delete(room.id);
            if (room.status !== 'starting' || room.gameStartTransition?.transitionId !== entryTransition.transitionId) return;
            const result = room.startGame();
            if (!result.success) {
                cancelGameStart(room, result.message || '开局条件已变化，请重新确认房间状态');
                return;
            }
            sendGameStateToRoom(room, 'gameStarted', result, { entryTransition });
            broadcastRoomList();
            console.log(`Room ${room.id} game started`);
        }, delay);
        timer.unref?.();
        gameStartTimers.set(room.id, timer);
    }

    function handleCreateRoom(ws, data) {
        const player = players.get(ws);
        if (!player) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: '请先离开当前房间' }));
            return;
        }

        const gameType = data.gameType || 'loveletter';
        if (!registry.getGame(gameType)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown game type' }));
            return;
        }

        const roomId = generateRoomId();
        if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: null });
        ws.intentionalLeave = false;
        let room;
        try {
            room = new RoomClass(roomId, player.id, player.name, gameType, data.gameOptions, {
                roomName: data.roomName,
                isPublic: data.isPublic,
                seatLimit: data.seatLimit,
                readyCheckEnabled: true,
            });
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
            return;
        }

        room.addPlayer({ id: player.id, name: player.name, ws, connected: true });
        rooms.set(roomId, room);
        ws.roomId = roomId;
        player.roomId = roomId;
        const session = sessions.get(player.sessionToken); if (session) session.roomId = roomId;

        ws.send(JSON.stringify({
            type: 'roomCreated',
            playerId: player.id,
            roomId,
            room: room.getInfo(),
        }));

        broadcastRoomList();
        console.log(`Room ${roomId} created by ${player.name}`);
    }

    function handleJoinRoom(ws, data) {
        const player = players.get(ws);
        if (!player) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: '请先离开当前房间' }));
            return;
        }

        const room = rooms.get(String(data.roomId || '').trim());
        if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: '房间不存在，请核对房间号' }));
            return;
        }

        if (typeof room.isInviteTokenValid === 'function' && !room.isInviteTokenValid(data.inviteToken)) {
            ws.send(JSON.stringify({ type: 'error', message: '这是仅邀请房间，请使用有效邀请链接加入' }));
            return;
        }

        if (room.status === 'playing') {
            ws.send(JSON.stringify({
                type: 'reconnectRequired',
                roomId: room.id,
                room: room.getInfo(),
                message: '游戏已开始，请输入断线玩家 ID 进行重连',
            }));
            return;
        }
        if (room.status === 'starting') {
            ws.send(JSON.stringify({ type: 'error', message: '游戏正在进入，暂时无法加入' }));
            return;
        }
        if (room.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: '该房间已结束，无法进入' }));
            return;
        }

        const result = room.addPlayer({ id: player.id, name: player.name, ws, connected: true });
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }

        ws.roomId = room.id;
        player.roomId = room.id;
        ws.intentionalLeave = false;
        if (!sessions.has(player.sessionToken)) sessions.set(player.sessionToken, { player, ws, roomId: room.id });
        const session = sessions.get(player.sessionToken); if (session) session.roomId = room.id;

        broadcastToRoom(room.id, {
            type: 'playerJoined',
            player: { id: player.id, name: player.name, seatIndex: result.seatIndex },
            room: room.getInfo(),
            players: room.getPlayerInfo(),
        });

        ws.send(JSON.stringify({
            type: 'joinSuccess',
            playerId: player.id,
            roomId: room.id,
            room: room.getInfo(),
        }));

        broadcastRoomList();
        console.log(`Player ${player.name} joined room ${room.id}`);
    }

    function findSessionByPlayerId(playerId) {
        for (const session of sessions.values()) {
            if (session.player?.id === playerId) return session;
        }
        return null;
    }

    function handleReconnectRoom(ws, data) {
        const provisionalPlayer = players.get(ws);
        const roomId = String(data.roomId || '').trim();
        const playerId = String(data.playerId || '').trim();
        const reconnectToken = String(data.sessionToken || '').trim();
        if (!provisionalPlayer) return;
        if (ws.roomId) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '请先离开当前房间' }));
            return;
        }

        const room = rooms.get(roomId);
        if (!room) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '房间不存在，请核对房间号' }));
            return;
        }
        if (room.status !== 'playing') {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '该房间尚未开始游戏，请使用普通加入' }));
            return;
        }

        const session = findSessionByPlayerId(playerId);
        if (requireReconnectToken && (!session?.player || !isReconnectTokenValid(session.player.sessionToken, reconnectToken))) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '重连凭证无效或已过期，请在原浏览器中重试' }));
            return;
        }
        const roomPlayer = room.players.find(player => player.id === playerId);
        if (!roomPlayer) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '房间内没有找到这个玩家 ID' }));
            return;
        }
        const activeSocket = session?.ws;
        if (roomPlayer.connected !== false || activeSocket?.readyState === WebSocketImpl.OPEN) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: `玩家 ID ${playerId} 已在房间中使用，${roomPlayer.name} 正在进行游戏，无法重复进入` }));
            return;
        }
        if (!session || !session.player) {
            ws.send(JSON.stringify({ type: 'reconnectFailed', message: '该玩家的重连凭证已失效' }));
            return;
        }

        if (session.player.reconnectTimer) clearTimeout(session.player.reconnectTimer);
        session.player.reconnectTimer = null;
        const player = session.player;
        if (provisionalPlayer.sessionToken && provisionalPlayer.sessionToken !== player.sessionToken) sessions.delete(provisionalPlayer.sessionToken);
        players.delete(ws);
        players.set(ws, player);
        session.ws = ws;
        session.roomId = room.id;
        player.roomId = room.id;
        ws.roomId = room.id;
        ws.intentionalLeave = false;
        roomPlayer.ws = ws;
        room.markPlayerReconnected(player.id);
        room.game?.handlePlayerReconnect?.(player.id);

        const connectionState = room.getConnectionState();
        ws.send(JSON.stringify({
            type: 'reconnectSuccess',
            playerId: player.id,
            playerName: player.name,
            sessionToken: player.sessionToken,
            roomId: room.id,
            room: room.getInfo(),
        }));
        broadcastToRoom(room.id, {
            type: connectionState.paused ? 'playerReconnected' : 'roomResumed',
            player: { id: player.id, name: player.name },
            room: room.getInfo(),
            connectionState,
            message: connectionState.paused ? `${player.name} 已重连` : `${player.name} 已重连，游戏恢复`,
        });
        if (room.game) sendGameStateToPlayer(room, player.id, ws, 'gameState', { success: true, message: '已恢复对局' });
        broadcastPlayerCount();
    }

    function handleConfigureRoom(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.configure(player.id, {
            playerCount: data.playerCount,
            encryptorMode: data.encryptorMode,
            settings: data.settings,
        });
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'roomConfigured',
            roomId: room.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: result.message,
        });
        broadcastRoomList();
        console.log(`Room ${room.id} configuration confirmed`);
    }

    function handleSetReady(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.setPlayerReady(player.id, data.ready !== false);
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'playerReady',
            player: { id: result.player.id, name: result.player.name, ready: result.player.ready },
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: `${result.player.name}${result.player.ready ? ' 已准备' : ' 取消了准备'}`,
        });
    }

    function handleUpdateRoomSettings(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        const result = room.updateSettings(player.id, data.settings || {});
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }
        broadcastToRoom(room.id, {
            type: 'roomSettingsUpdated',
            roomId: room.id,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: result.message,
        });
        broadcastRoomList();
    }

    function handleKickPlayer(ws, data) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: '你尚未进入房间' }));
            return;
        }
        if (room.status !== 'waiting') {
            ws.send(JSON.stringify({ type: 'error', message: '游戏开始后不能移出玩家' }));
            return;
        }
        if (room.hostId !== player.id) {
            ws.send(JSON.stringify({ type: 'error', message: '只有房主可以移出玩家' }));
            return;
        }
        const targetId = String(data.playerId || '').trim();
        const target = room.players.find(item => item.id === targetId);
        if (!target) {
            ws.send(JSON.stringify({ type: 'error', message: '没有找到要移出的玩家' }));
            return;
        }
        if (target.id === room.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: '房主不能移出自己' }));
            return;
        }

        const targetSession = findSessionByPlayerId(target.id);
        if (targetSession?.player?.reconnectTimer) clearTimeout(targetSession.player.reconnectTimer);
        if (targetSession) sessions.delete(targetSession.player.sessionToken);
        target.ws && (target.ws.intentionalLeave = true);
        if (target.ws) target.ws.roomId = null;
        if (targetSession?.player) targetSession.player.roomId = null;
        target.ws?.readyState === WebSocketImpl.OPEN && target.ws.send(JSON.stringify({
            type: 'playerKicked',
            roomId: room.id,
            message: '你已被房主移出房间',
        }));

        room.removePlayer(target.id);
        broadcastToRoom(room.id, {
            type: 'playerLeft',
            playerId: target.id,
            kicked: true,
            room: room.getInfo(),
            players: room.getPlayerInfo(),
            message: `${target.name} 已被房主移出房间`,
        });
        broadcastRoomList();
    }

    function handleLeaveRoom(ws) {
        const player = players.get(ws);
        if (!player || !ws.roomId) return;

        const roomId = ws.roomId;
        const room = rooms.get(roomId);
        if (!room) return;

        const wasStarting = room.status === 'starting';
        if (wasStarting) clearGameStartTimer(room.id);

        ws.intentionalLeave = true;
        const session = sessions.get(player.sessionToken);
        if (session) session.roomId = null;
        const leaveResult = room.game?.handlePlayerLeave?.(player.id);
        if (leaveResult?.ended) room.status = 'ended';
        room.removePlayer(player.id);
        ws.roomId = null;

        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted`);
        } else {
            if (wasStarting) {
                room.cancelGameStartTransition?.();
                broadcastToRoom(roomId, {
                    type: 'gameStartCancelled',
                    room: room.getInfo(),
                    message: '有玩家离开，开局已取消，请重新确认房间状态',
                });
            }
            if (leaveResult?.state) sendGameStateToRoom(room, leaveResult.ended ? 'gameEnded' : 'gameState', leaveResult);
            broadcastToRoom(roomId, {
                type: 'playerLeft',
                playerId: player.id,
                room: room.getInfo(),
                players: room.getPlayerInfo(),
                newHost: room.hostId,
            });
        }

        broadcastRoomList();
        console.log(`Player ${player.name} left room ${roomId}`);
    }

    function handleResumeSession(ws, data) {
        const token = String(data.sessionToken || '');
        const session = sessions.get(token);
        if (!session || !session.player) {
            ws.send(JSON.stringify({ type: 'resumeFailed', message: '会话已过期，请重新进入房间' }));
            return;
        }
        // A duplicated tab can inherit sessionStorage and present the same token
        // while the original socket is still alive.  Never let that tab evict the
        // live player; its provisional connection keeps the fresh identity that
        // was issued during the WebSocket handshake.  Resume remains allowed when
        // the old connection is actually gone (normal refresh/network recovery).
        if (session.ws && session.ws !== ws && session.ws.readyState === WebSocketImpl.OPEN) {
            const provisional = players.get(ws);
            ws.send(JSON.stringify({ type: 'resumeFailed', message: '该会话仍在其他窗口使用，本窗口已创建新的玩家身份' }));
            if (provisional) ws.send(JSON.stringify({ type: 'session', sessionToken: provisional.sessionToken, playerId: provisional.id, playerName: provisional.name }));
            return;
        }
        if (session.player.reconnectTimer) clearTimeout(session.player.reconnectTimer);
        session.player.reconnectTimer = null;
        const oldWs = session.ws;
        const player = session.player;
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (oldWs && oldWs !== ws && oldWs.readyState === WebSocketImpl.OPEN) {
            oldWs.intentionalLeave = true;
            oldWs.close(4001, 'session resumed');
        }
        const provisionalPlayer = players.get(ws);
        if (provisionalPlayer?.sessionToken && provisionalPlayer.sessionToken !== token) sessions.delete(provisionalPlayer.sessionToken);
        players.delete(ws);
        players.set(ws, player);
        session.ws = ws;
        ws.roomId = session.roomId || null;
        if (room) {
            const roomPlayer = room.players.find(item => item.id === player.id);
            if (roomPlayer) roomPlayer.ws = ws;
            room.markPlayerReconnected(player.id);
            const reconnectResult = room.game?.handlePlayerReconnect?.(player.id);
            ws.send(JSON.stringify({ type: 'resumeSuccess', playerId: player.id, roomId: room.id, room: room.getInfo() }));
            const connectionState = room.getConnectionState();
            broadcastToRoom(room.id, { type: connectionState.paused ? 'playerReconnected' : 'roomResumed', player: { id: player.id, name: player.name }, room: room.getInfo(), players: room.getPlayerInfo(), connectionState });
            if (reconnectResult?.state) sendGameStateToRoom(room, 'gameState', reconnectResult);
            else if (room.game) sendGameStateToPlayer(room, player.id, ws, 'gameState', { success: true, message: '已恢复对局' });
        } else {
            session.roomId = null;
            ws.send(JSON.stringify({ type: 'resumeSuccess', playerId: player.id, roomId: null, room: null }));
        }
        broadcastPlayerCount();
    }

    function finalizeDisconnectedSession(token) {
        const session = sessions.get(token);
        if (!session || session.ws) return;
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (room) {
            const fakeWs = { roomId: room.id };
            const player = session.player;
            players.set(fakeWs, player);
            removePlayerFromCurrentRoom(fakeWs);
            players.delete(fakeWs);
        }
        sessions.delete(token);
        broadcastPlayerCount();
        broadcastRoomList();
    }

    function handleChat(ws, data) {
        const player = players.get(ws);
        if (!player) return;

        const message = sanitizeChatMessage(data.message, policy.maxChatLength);
        if (!message.ok) {
            sendProtocolError(ws, message.message);
            return;
        }
        const payload = {
            type: 'chat',
            player: { id: player.id, name: player.name },
            message: message.value,
            timestamp: Date.now(),
        };

        if (ws.roomId) {
            broadcastToRoom(ws.roomId, payload);
        } else {
            broadcastToAll(payload);
        }
    }

    function handleStartGame(ws) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room' }));
            return;
        }
        if (room.hostId !== player.id) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game' }));
            return;
        }

        // The number of flame waves depends on the occupied seat count. Let the
        // room derive that duration instead of forcing every room onto the
        // longest (four-wave) server timeline.
        const result = room.startGame({ defer: true });
        if (!result.success) {
            ws.send(JSON.stringify({ type: 'error', message: result.message }));
            return;
        }

        broadcastToRoom(room.id, {
            type: 'gameStarting',
            gameType: room.gameType,
            room: room.getInfo(),
            entryTransition: result.entryTransition,
        });
        scheduleGameStart(room, result.entryTransition);
        broadcastRoomList();
        console.log(`Room ${room.id} game starting`);
    }

    function handleGameAction(ws, action) {
        const player = players.get(ws);
        const room = ws.roomId ? rooms.get(ws.roomId) : null;
        if (!player || !room) {
            ws.send(JSON.stringify({ type: 'error', message: 'You are not in a room' }));
            return;
        }

        const result = room.handleGameAction(player.id, action);
        if (!result.success) {
            const errorPayload = { type: 'error', message: result.message };
            if (result.state) {
                errorPayload.gameType = room.gameType;
                errorPayload.state = room.getPlayerGameState(player.id);
                errorPayload.action = room.getPlayerGameAction(result, player.id);
            }
            ws.send(JSON.stringify(errorPayload));
            return;
        }

        sendGameStateToRoom(room, 'gameState', result);

        if (result.ended && room.status === 'ended') {
            for (const p of room.players) {
                if (p.ws.readyState === WebSocketImpl.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'gameEnded',
                        winner: room.getWinner(),
                        room: room.getInfo(),
                        action: room.getPlayerGameAction(result, p.id),
                    }));
                }
            }
            broadcastRoomList();
        }
    }
    return {
        findSessionByPlayerId,
        handleCreateRoom,
        handleJoinRoom,
        handleReconnectRoom,
        handleConfigureRoom,
        handleSetReady,
        handleUpdateRoomSettings,
        handleKickPlayer,
        handleLeaveRoom,
        handleResumeSession,
        finalizeDisconnectedSession,
        handleChat,
        handleStartGame,
        handleGameAction,
        clearGameStartTimer,
        clearGameStartTimers: () => {
            for (const timer of gameStartTimers.values()) clearTimeout(timer);
            gameStartTimers.clear();
        },
    };
}

module.exports = { createRoomHandlers };
