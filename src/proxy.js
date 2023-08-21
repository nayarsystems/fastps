const fastps = require("./index.js");
const makeid = require("./utils/makeId.js");


function filterLocalPaths(paths) {
    let filteredPaths = [];
    paths.forEach(path => {
        if (!path.startsWith("$")) { // filter out internal paths
            filteredPaths.push(path);
        }
    });
    return filteredPaths;
};


class Proxy {
    constructor(transport, ps) {
        this._alive = true;
        this._connected = false;
        this._onClose = null;
        this._transport = transport;
        if (ps === undefined) {
            this._ps = fastps.getDefaultPubSub();
        }
        this._ps = ps;
        this._sub = new fastps.Subscriber(this._ps);
        this._retPath = "$" + makeid(10);
        this._init();
    }

    get connected() {
        return this._connected;
    }

    get alive() {
        return this._alive;
    }

    _close() {
        if (this._alive) {
            this._connected = false;
            this._alive = false;
            this._transport.close();
            this._sub.unsubscribeAll();
            if (this._onClose) {
                this._onClose()
                this._onClose = null;
            }
        }
    }

    onClose(func) {
        this._onClose = func;
        if (!this._alive && this._onClose) { // fire onClose after close for late listeners
            this._onClose();
            this._onClose = null;
        }
    }

    close() {
        this._close();

    }

    _init() {
        this._transport.onClose(() => {
            this._close();
        });
        this._send({ "t": "hello", "d": { "version": 1 } })
        const allSubs = this._ps.getAllPaths();
        this._sub.subscribe(
            {
                "$listenOn": (msg) => {
                    this._processNewLocalSubscription(msg);
                },

                [this._retPath]: (msg) => {
                    this._relayMsg(msg);
                }
            }, { "fetchOld": true }
        );

        this._transport.onMessage((msg) => {
            this._processRemoteMessage(msg);
        });
        this._subscribeOnPeer(allSubs);
    }

    _subscribeOnPeer(paths) {
        const fpaths = filterLocalPaths(paths);
        if (fpaths.length) {
            this._send({ "t": "subscribe", "d": paths });
        }
    }

    _unsubscribeOnPeer(paths) {
        const fpaths = filterLocalPaths(paths);
        if (fpaths.length) {

            this._send({ "t": "unsubscribe", "d": paths });
        }
    }

    _send(msg) {
        this._transport.send(msg);
    }

    _processNewLocalSubscription(msg) {
        let subPaths = msg.to.split(".");
        if (subPaths[0] !== "$listenOn") {
            return;
        }
        subPaths.shift();
        const path = subPaths.join(".");
        if (this._sub.isSubscribed(path) && this._ps.numSubscribers(path) <= 1) { // Avoid subscription loops
            return;
        }
        if (msg.dat) {
            this._subscribeOnPeer([path]);
        } else {
            this._unsubscribeOnPeer([path]);
        }
    }

    _relayMsg(msg) {
        if (msg.hops !== undefined && msg.hops.includes(this._retPath)) {
            return;
        }
        if (msg.to.startsWith(`${this._retPath}.`)) {
            msg = { ...msg };
            msg.to = msg.to.slice(this._retPath.length + 1);
        }
        this._send({ "t": "publish", "d": msg });
    }

    _processRemoteMessage(msg) {
        if (msg.t === "publish") {
            let m = { ...msg.d };
            if (m.res) {
                m.res = `${this._retPath}.${m.res}`;
            }
            if (m.hops === undefined) {
                m.hops = [];
            }
            m.hops.push(this._retPath);
            this._ps.publish(m);
        } else if (msg.t === "subscribe") {
            msg.d.forEach(path => {
                this._sub.subscribe({
                    [path]: (msg) => {
                        this._relayMsg(msg);
                    }
                });
            });
        } else if (msg.t === "unsubscribe") {
            msg.d.forEach(path => {
                this._sub.unsubscribe(path);
            });
        } else if (msg.t === "hello") {
            this._connected = true;
        }
    }
}

module.exports = {
    Proxy
};
