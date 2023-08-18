let defaultPubSub = null;

/**
 * @typedef {Object} Msg
 * @property {string} to - destination path
 * @property {any} dat - data
 * @property {string} [res] - reply path
 * @property {boolean} [noPropagate] - subscribers to parent paths won't get this msg
 * @property {boolean} [persist] - later subscribers will get this msg
 * @property {any} [err] - error of this message
 * @property {boolean} [old] - this is an old message
 * @property {number} [timeOut] - time out for call
 */

/**
 * @callback Handler
 * @param {Msg} msg
 */

/**
 * @typedef {Object.<string, Handler>} Cfg
 */

/**
 * Subscriber that listens for messages on some paths
 */
class Subscriber {
  /** Create a Subscriber
   * @param {PubSub} - PubSub object
   */
  constructor(pubsub) {
    this.ps = pubsub;
    this.cfg = {};
  }

  /**
   * @private
   */
  _process(path, msg) {
    if (path in this.cfg) {
      this.cfg[path](msg);
    }
  }

  /**
   * Subscribe to aditional paths
   * @param {Cfg} cfg
   */
  subscribe(cfg) {
    Object.assign(this.cfg, cfg);
    this.ps._subscribe(cfg, this);
  }

  /**
   * Unsubscribe from paths
   * @param  {...string} paths
   */
  unsubscribe(...paths) {
    paths.forEach(path => {
      if (path in this.cfg) {
        delete this.cfg[path];
        this.ps._unsubscribe(path, this);
      }
    });
  }

  /**
   * Unsubscribe from all paths
   */
  unsubscribeAll() {
    this.unsubscribe(...Object.keys(this.cfg));
  }

  /**
   * Get list of paths subscribed to
   * @returns {string[]} list of paths
   */
  subscriptions() {
    return Object.keys(this.cfg);
  }
}

/**
 * Handles pub/sub
 */
class PubSub {
  constructor() {
    this.subs = {};
    this.oldMsgs = {};
    this.respCnt = 0;
  }

  /**
   * Subscribe to paths
   * @param {Cfg} cfg - Subscription config
   * @returns {Subscriber} Subscriber created
   */
  subscribe(cfg) {
    const sub = new Subscriber(this);
    sub.subscribe(cfg);
    return sub;
  }

  /**
   * Get number of subscriptions for parh
   * @param {string} path - path to get number of subscriptions
   * @returns {number} number of subscriptions to path
   */
  numSubscribers(path) {
    if (!(path in this.subs)) {
      return 0;
    }
    return this.subs[path].size
  }

  /** Get list of all paths subscribed to
   * @returns {string[]} list of paths
   */
  getAllPaths() {
    return Object.keys(this.subs);
  }

  /**
   * @private
   */
  _subscribe(cfg, subscriber) {
    let openPath = false;
    Object.keys(cfg).forEach(path => {
      if (!(path in this.subs)) {
        this.subs[path] = new Set();
        openPath = true;
      }

      this.subs[path].add(subscriber);

      if (openPath && !path.startsWith("$")) {
        this.publish({ to: `$listenOn.${path}`, dat: true });
      }

      if (path in this.oldMsgs) {
        const oldMsg = this.oldMsgs[path];
        subscriber._process(path, oldMsg);
      }
    });
  }

  /**
   * @private
   */
  _unsubscribe(path, subscriber) {
    if (path in this.subs) {
      this.subs[path].delete(subscriber);
      if (this.subs[path].size === 0) {
        delete this.subs[path];
        if (!path.startsWith("$")) {
          this.publish({ to: `$listenOn.${path}`, dat: false });
        }
      }
    }
  }

  /**
   * Publish message
   * @param {Msg} msg - publish message
   * return {number} number of subscribers that got the message
   */
  publish(msg) {
    let count = 0;

    if (msg.noPropagate) {
      if (msg.to in this.subs) {
        this.subs[msg.to].forEach(sub => {
          sub._process(msg.to, msg);
          count++;
        });
      }
    } else {
      let path = "";
      let dups = new Set();
      const subPaths = msg.to.split(".");
      subPaths.forEach(subPath => {
        if (path === "") {
          path = subPath;
        } else {
          path = `${path}.${subPath}`;
        }

        if (path in this.subs) {
          this.subs[path].forEach(sub => {
            if (!dups.has(sub)) {
              sub._process(path, msg);
              count++;
              dups.add(sub);
            }
          });
        }
      });
    }

    if (msg.persist) {
      this.oldMsgs[msg.to] = { ...msg, old: true };
    }
    return count;
  }

  /**
   * Answer to message
   * @param {Msg} msg - message to answer to
   * @param {any} dat - data for the answer
   * @param {any} err - error for the answer
   */
  answer(msg, dat, err) {
    if (msg.res) {
      this.publish({ to: msg.res, dat, err });
    }
  }

  /**
   * @typedef {Object.<string, any>} MsgOpts
   */

  /**
   * Send message to path and return promise with response
   * @param {string} to - path to send msg to
   * @param {any} dat - data to send
   * @param {MsgOpts} msgOpts
   * @returns {Promise} promise with response
   */
  call(to, dat, msgOpts = {}) {
    return new Promise((resolve, reject) => {
      this.respCnt += 1;
      const res = `res-${this.respCnt}`;

      let timeOutId = null;
      let sub;

      let timeOut = msgOpts.timeOut || 5000;

      if (timeOut > 0) {
        timeOutId = setTimeout(() => {
          reject(new Error('Time out'));
          sub.unsubscribeAll();
        }, timeOut);
      }

      const cfg = {};
      cfg[res] = msg => {
        if (msg.err) {
          reject(msg.err);
        } else {
          resolve(msg.dat);
        }
        sub.unsubscribeAll();
        if (timeOutId) {
          clearTimeout(timeOutId);
        }
      };
      sub = this.subscribe(cfg);

      const cnt = this.publish({
        to,
        dat,
        res,
        ...msgOpts
      });
      if (cnt === 0) {
        reject(new Error('No subscribers'));
        sub.unsubscribeAll();
        if (timeOutId) {
          clearTimeout(timeOutId);
        }
      }
    });
  }
}

/**
 * 
 * @returns {PubSub} default app pubsub instance
 */
function getDefaultPubSub() {
  if (!defaultPubSub) {
    defaultPubSub = new PubSub();
  }

  return defaultPubSub;
}

exports.PubSub = PubSub;
exports.Subscriber = Subscriber;
exports.getDefaultPubSub = getDefaultPubSub;
