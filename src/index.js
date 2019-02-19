/**
 * @typedef {Object} Msg
 * @property {string} to - destination path
 * @property {any} dat - data
 * @property {string} res - reply path
 * @property {boolean} noPropagate - subscribers to parent paths won't get this msg
 * @property {boolean} persist - later subscribers will get this msg
 * @property {any} err - error of this message
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
  /** Create a Susbcriber
   * @param {PubSub} - PubSub object
   */
  constructor(pubsub) {
    this.ps = pubsub;
    this.cfg = {};
  }

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
    // TODO: variadic expand
    Object.keys(this.cfg).forEach(path => {
      this.unsubscribe(path);
    });
  }

  /**
   * Get list of paths subscribed to
   * @returns {Array} list of paths
   */
  subscriptions() {
    return Object.keys(this.cfg);
  }
}

/**
 * Pub/sub class for crearintg subscribers
 */
class PubSub {
  constructor() {
    this.subs = {};
    this.oldMsgs = {};
    this.respCnt = 0;
  }

  /**
   * Remove all subscribed paths
   */
  unsubscribeAll() {
    this.subs = {};
    this.oldMsgs = {};
  }

  /**
   * Susbcribe to paths
   * @param {Cfg} cfg - Subscription config
   * @returns {Subscriber} - Subscriber created
   */
  subscribe(cfg) {
    const sub = new Subscriber(this);
    sub.subscribe(cfg);
    return sub;
  }

  _subscribe(cfg, subscriber) {
    Object.keys(cfg).forEach(path => {
      if (!(path in this.subs)) {
        this.subs[path] = new Set();
      }

      this.subs[path].add(subscriber);

      if (path in this.oldMsgs) {
        const oldMsg = this.oldMsgs[path];
        subscriber._process(path, oldMsg);
      }
    });
  }

  _unsubscribe(path, subscriber) {
    if (path in this.subs) {
      this.subs[path].delete(subscriber);
    }
  }

  /**
   * Publish message
   * @param {Msg} msg - publish message
   */
  publish(msg) {
    if (msg.noPropagate) {
      if (msg.to in this.subs) {
        this.subs[msg.to].forEach(sub => {
          sub._process(msg.to, msg);
        });
      }
    } else {
      let path = "";
      const subPaths = msg.to.split(".");
      subPaths.forEach(subPath => {
        if (path === "") {
          path = subPath;
        } else {
          path = `${path}.${subPath}`;
        }

        if (path in this.subs) {
          this.subs[path].forEach(sub => {
            sub._process(path, msg);
          });
        }
      });
    }

    if (msg.persist) {
      this.oldMsgs[msg.to] = { ...msg, old: true };
    }
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
   * @returns {Promise} - returns promise with response
   */
  call(to, dat, msgOpts) {
    return new Promise((resolve, reject) => {
      this.respCnt += 1;
      const res = `res-${this.respCnt}`;

      let sub;
      const cfg = {};
      cfg[res] = msg => {
        if (msg.err) {
          reject(msg.err);
        } else {
          resolve(msg.dat);
        }
        sub.unsubscribeAll();
      };

      sub = this.subscribe(cfg);

      this.publish({
        to,
        dat,
        res,
        ...msgOpts
      });
    });
  }
}

exports.PubSub = PubSub;
