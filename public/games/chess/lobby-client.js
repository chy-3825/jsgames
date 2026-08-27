const FRAME_SOURCE = 'jsgames-chess-frame';
const LOBBY_SOURCE = 'jsgames-chess-lobby';

export function createGameClient({ mount, send, addLog }) {
    let destroyed = false;
    let ready = false;
    let pendingMessage = null;
    let pendingStudyPlacement;

    mount.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.className = 'chess3d-room-frame';
    frame.title = '国际象棋 3D 棋盘';
    frame.allow = 'fullscreen';
    frame.src = '/games/chess/room-frame.html?v=20260826-mobile-games-2';
    frame.style.cssText = 'display:block;width:100%;height:calc(100dvh - var(--game-shell-offset, 48px));min-height:0;border:0;background:#071219;color-scheme:dark;';
    mount.appendChild(frame);

    function post(type, payload) {
        if (!frame.contentWindow || destroyed) return;
        frame.contentWindow.postMessage({ source: LOBBY_SOURCE, type, payload }, location.origin);
    }

    function onFrameMessage(event) {
        if (destroyed || event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const message = event.data;
        if (!message || message.source !== FRAME_SOURCE) return;
        if (message.type === 'ready') {
            ready = true;
            if (pendingMessage) {
                post('gameMessage', pendingMessage);
                pendingMessage = null;
            }
            if (pendingStudyPlacement !== undefined) {
                post('studyPlacement', pendingStudyPlacement);
                pendingStudyPlacement = undefined;
            }
        } else if (message.type === 'send' && message.payload) {
            send(message.payload);
        } else if (message.type === 'log') {
            addLog?.(message.payload?.message || '', message.payload?.level || 'info');
        }
    }

    window.addEventListener('message', onFrameMessage);

    return {
        gameType: 'chess',
        handleMessage(message) {
            if (ready) post('gameMessage', message);
            else pendingMessage = message;
        },
        setStudyPlacement(mode) {
            const normalized = mode && (mode.remove || mode.type) ? { ...mode } : null;
            pendingStudyPlacement = normalized;
            if (ready) {
                post('studyPlacement', normalized);
                pendingStudyPlacement = undefined;
            }
        },
        destroy() {
            destroyed = true;
            pendingStudyPlacement = undefined;
            window.removeEventListener('message', onFrameMessage);
            frame.remove();
        },
    };
}
