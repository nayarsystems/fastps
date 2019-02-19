// @flow

/* :: type Cfg = { [string]: (msg: Msg) => void };  */

/* :: type Msg = { 
  to: string,
  dat: any,
  res?: string, 
  noPropagate?: boolean,
  persist?: boolean,
  err?: any,
 };  */

/**
 * Subscriber that listens for messages on some paths
 */
class Subscriber {
  /* :: cfg: Cfg; */

  constructor(pubsub) {
    this.ps = pubsub;
    this.cfg = {};
  }

  _process(path /* : string */, msg /* : Msg */) {
    if (path in this.cfg) {
      this.cfg[path](msg);
    }
  }

  /**
   * Subscribe to aditional paths
   */
  subscribe(cfg /* : Cfg */) {
    Object.assign(this.cfg, cfg);
    this.ps._subscribe(cfg, this);
  }

  /**
   * Unsubscribe from path
   */
  unsubscribe(...paths /* : Array<string> */) {
    paths.forEach(path => {
      if (path in this.cfg) {
        delete this.cfg[path];
        this.ps._unsubscribe(path, this);
      }
    });
  }

  /**
   * Unsubscribe from all paths on this subscriber
   */
  unsubscribeAll() {
    // TODO: variadic expand
    Object.keys(this.cfg).forEach(path => {
      this.unsubscribe(path);
    });
  }

  /**
   * Get list of paths subscribed to
   */
  subscriptions() /* : Array<string> */ {
    return Object.keys(this.cfg);
  }
}

class PubSub {
  constructor() {
    this.subs /* :  { [string]: Set<Subscriber> } */ = {};
    this.oldMsgs /* :  { [string]: Msg } */ = {};
    this.respCnt /* : number */ = 0;
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
   */
  subscribe(cfg /* : Cfg */) {
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
   */
  publish(msg /* : Msg */) {
    // console.log("publish msg: ", msg, "subs:", subs);
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
   */
  answer(msg /* : Msg */, dat /* : any */, err /* : any */) {
    if (msg.res) {
      this.publish({ to: msg.res, dat, err });
    }
  }

  /**
   * Send message to path and return promise with response
   */
  call(to /* : string */, dat /* : any */, msgOpts /* : ?{[string]: any} */) {
    const promise /* :Promise<any> */ = new Promise((resolve, reject) => {
      this.respCnt += 1;
      const res = `res-${this.respCnt}`;

      let sub;
      const cfg = {};
      cfg[res] = (msg /* : Msg */) => {
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

    return promise;
  }
}

exports.PubSub = PubSub;
