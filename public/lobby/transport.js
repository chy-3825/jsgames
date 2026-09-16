// Browser WebSocket transport used by the lobby bootstrap.
// It owns socket lifecycle and JSON decoding while UI policy stays in the
// callbacks supplied by script.js (reconnect messages, logs and rendering).

export function createLobbyTransport({ getUrl, WebSocketImpl = globalThis.WebSocket, onOpen, onMessage, onClose, onError, onMessageError }) {
    let socket = null;
    // Protocol snapshots that drive a shared presentation are consumed in
    // order.  Chat, room-list and connection notices remain independent so a
    // slow animation never blocks ordinary lobby feedback.
    let presentationChain = Promise.resolve();

    function isPresentationMessage(data) {
        return ['gameStarting', 'gameStarted', 'gameState', 'gameEnded'].includes(data?.type)
            || (data?.type === 'error' && data?.state?.presentation);
    }

    function dispatchMessage(data) {
        return Promise.resolve().then(() => onMessage?.(data));
    }

    function connect() {
        socket = new WebSocketImpl(getUrl());
        presentationChain = Promise.resolve();
        socket.onopen = () => onOpen?.();
        socket.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                if (isPresentationMessage(data)) {
                    presentationChain = presentationChain
                        .then(() => dispatchMessage(data))
                        .catch(error => onMessageError?.(error));
                    return;
                }
                dispatchMessage(data).catch(error => onMessageError?.(error));
            } catch (error) {
                onMessageError?.(error);
            }
        };
        socket.onclose = event => onClose?.(event);
        socket.onerror = event => onError?.(event);
        return socket;
    }

    function send(payload) {
        if (!isOpen()) return false;
        socket.send(JSON.stringify(payload));
        return true;
    }

    function isOpen() {
        return Boolean(socket && socket.readyState === WebSocketImpl.OPEN);
    }

    return {
        connect,
        send,
        isOpen,
        getSocket: () => socket,
    };
}
