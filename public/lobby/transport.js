// Browser WebSocket transport used by the lobby bootstrap.
// It owns socket lifecycle and JSON decoding while UI policy stays in the
// callbacks supplied by script.js (reconnect messages, logs and rendering).

export function createLobbyTransport({ getUrl, WebSocketImpl = globalThis.WebSocket, onOpen, onMessage, onClose, onError, onMessageError }) {
    let socket = null;

    function connect() {
        socket = new WebSocketImpl(getUrl());
        socket.onopen = () => onOpen?.();
        socket.onmessage = async event => {
            try {
                await onMessage?.(JSON.parse(event.data));
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
