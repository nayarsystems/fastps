const makeid = require("./utils/makeId.js");

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
    this._alive = true;
    this._ps = pubsub;
    this._cfg = {};
  }


  /**
   * Kill subscriber, unsubscribe from all paths and release resources
   */
  kill() {
    if (this.alive) {
      this._alive = false;
      this.unsubscribeAll();
      this._ps = null;
      this._cfg = null;
    }
  }

  /**
   * Get alive
   * @returns {boolean} alive status
   */
  get alive() {
    return this._alive;
  }

  /**
   * Get attr
   * @param {string} path - path to get attr
   * @returns {any} attr
   */
  getAttr(path) {
    if (path in this._cfg) {
      return this._cfg[path][1];
    } else {
      return {};
    }
  }

  /**
   * @private
   */
  _process(path, msg) {
    if (this._alive && path in this._cfg) {
      if (msg.old && !(this.getAttr(path).fetchOld ?? true)) {
        return;
      }
      this._cfg[path][0](msg);
    }
  }

  /**
   * Subscribe to aditional paths
   * @param {Cfg} cfg
   */
  subscribe(cfg) {
    if (!this._alive) {
      return;
    }
    Object.entries(cfg).forEach(([rawPath, callback]) => {
      let [path, flags] = rawPath.split("#");
      if (flags == undefined) {
        flags = "{}";
      }
      path = path.trim();
      flags = JSON.parse(flags);
      this._cfg[path] = [callback, flags];
      this._ps._subscribe(path, this);
    });
  }

  /**
   * Unsubscribe from paths
   * @param  {...string} paths
   */
  unsubscribe(...paths) {
    paths.forEach(path => {
      if (path in this._cfg) {
        this._ps._unsubscribe(path, this);
        delete this._cfg[path];
      }
    });
  }

  /**
   * Unsubscribe from all paths
   */
  unsubscribeAll() {
    this.unsubscribe(...Object.keys(this._cfg));
  }

  /**
   * Get list of paths subscribed to
   * @returns {string[]} list of paths
   */
  subscriptions() {
    return Object.keys(this._cfg);
  }

  /**
   * 
   * @param {string} path - path to check 
   * @returns {boolean} true if subscribed to path 
   */
  isSubscribed(path) {
    return path in this._cfg;
  }
}

/**
 * Handles pub/sub
 */
class PubSub {
  constructor() {
    this._subs = {};
    this._oldMsgs = {};
    this._respCnt = 0;
    this._id = `nod::${makeid(10)}`
  }

  /**
   * Get PubSub instance id
   */
  get id() {
    return this._id;
  }

  /**
   * 
   * @param {string} path - path to get old message
   * @returns {Msg} old message
   */
  getOldMsg(path) {
    return this._oldMsgs[path];
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
    if (!(path in this._subs)) {
      return 0;
    }
    let cnt = 0;
    this._subs[path].forEach(sub => {
      if (!(sub.getAttr(path).hidden ?? false)) {
        cnt++;
      }
    });
    return cnt;
  }

  /** Get list of all paths subscribed to
   * @returns {string[]} list of paths
   */
  getAllPaths() {
    let retPAths = [];
    Object.keys(this._subs).forEach(path => {
      if (this.numSubscribers(path) > 0) {
        retPAths.push(path);
      }
    });
    return retPAths;
  }

  /**
   * @private
   */
  _subscribe(path, subscriber) {
    const prevSubs = this.numSubscribers(path);
    if (!(path in this._subs)) {
      this._subs[path] = new Set();
    }

    this._subs[path].add(subscriber);

    const actualSubs = this.numSubscribers(path);
    if (actualSubs != prevSubs) {
      this.publish({ to: `$listenOn.${path}`, dat: actualSubs });
    }

    if (subscriber.getAttr(path).fetchOld ?? true) {
      if (subscriber.getAttr(path).recursiveOld ?? false) {
        Object.keys(this._oldMsgs).forEach(oldPath => {
          if (oldPath.startsWith(`${path}.`) || oldPath === path) {
            const oldMsg = this._oldMsgs[oldPath];
            subscriber._process(path, oldMsg);
          }
        });
      } else {
        if (path in this._oldMsgs) {
          const oldMsg = this._oldMsgs[path];
          subscriber._process(path, oldMsg);
        }
      }
    }
  }

  /**
   * @private
   */
  _unsubscribe(path, subscriber) {
    const prevSubs = this.numSubscribers(path);
    if (path in this._subs) {
      this._subs[path].delete(subscriber);
      if (this._subs[path].size === 0) {
        delete this._subs[path];
      }
    }
    const actualSubs = this.numSubscribers(path);
    if (actualSubs != prevSubs) {
      this.publish({ to: `$listenOn.${path}`, dat: actualSubs });
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
      if (msg.to in this._subs) {
        this._subs[msg.to].forEach(sub => {
          sub._process(msg.to, msg);
          if (!(sub.getAttr(msg.to).hidden ?? false)) {
            count++;
          }
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

        if (path in this._subs) {
          this._subs[path].forEach(sub => {
            if (!dups.has(sub)) {
              sub._process(path, msg);
              if (!(sub.getAttr(path).hidden ?? false)) {
                count++;
              }
              dups.add(sub);
            }
          });
        }
      });
    }

    if (msg.persist) {
      this._oldMsgs[msg.to] = { ...msg, old: true };
    } else {
      delete this._oldMsgs[msg.to];
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
      this._respCnt += 1;
      const res = `$res-${this._respCnt}`;

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
      cfg[`${res}#{"hidden":true, "fetchOld":false}`] = msg => {
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
