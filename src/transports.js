

class MessagePortTransport {
    constructor(port) {
        this._port = port;
        this._port.on("messageerror", () => {
            this._port.close();
        });
    }

    send(message) {
        this._port.postMessage(message);
    }

    onMessage(callback) {
        this._port.on("message", (message) => callback(message));
    }

    onClose(callback) {
        this._port.on("close", () => callback());
    }

    close() {
        this._port.close();
    }
}

class SocketIOTransport {
    constructor(sock) {
        this._sock = sock;
        this._sock.on("connect_error", () => {
            this._sock.close();
        });
    }

    send(message) {
        this._sock.emit('fastps', message);
    }

    onMessage(callback) {
        this._sock.on("fastps", (message) => callback(message));
    }

    onClose(callback) {
        this._sock.on("disconnect", () => callback());
    }

    close() {
        this._sock.disconnect(true);
    }
}


module.exports = {
    MessagePortTransport,
    SocketIOTransport
};