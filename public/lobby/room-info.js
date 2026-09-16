import { createModalController } from '../games/common/modal.js';

function statusText(status) {
    return status === 'playing' ? '游戏中' : status === 'ended' ? '已结束' : '等待中';
}

/** Room metadata stays available without occupying the shared game header. */
export function createRoomInfoController({ root, trigger, overlay, fields, getRoom, getRoomId, getMyId, getMyName, getGamePresentation }) {
    const modal = createModalController({ root, overlay, fallbackFocus: () => trigger });

    function render() {
        const room = getRoom();
        const roomId = getRoomId();
        const myId = getMyId();
        const player = room?.players?.find(item => item.id === myId);
        const onlinePlayers = room?.players?.filter(item => item.isOnline !== false).length || 0;
        const capacity = room?.targetPlayers || room?.maxPlayers || room?.players?.length || 0;
        fields.game.textContent = room?.gameName || getGamePresentation(room?.gameType)?.title || room?.gameType || '—';
        fields.name.textContent = room?.roomName || '未命名房间';
        fields.code.textContent = roomId || room?.id || '—';
        fields.status.textContent = room
            ? `${statusText(room.status)} · ${onlinePlayers}${capacity ? ` / ${capacity}` : ''} 人 · ${room.isPublic === false ? '仅凭邀请' : '公开房间'}`
            : '—';
        fields.player.textContent = player?.name || getMyName() || '访客';
        fields.playerId.textContent = myId || '—';
    }

    function open() {
        if (!getRoom()) return;
        render();
        modal.setOpen(true);
    }

    return Object.freeze({
        render,
        open,
        close: () => modal.setOpen(false),
        isOpen: modal.isOpen,
        trapFocus: modal.trapFocus,
    });
}
