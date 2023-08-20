

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

module.exports = {
    MessagePortTransport,
};