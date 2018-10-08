// @flow

let subs /* :  { [string]: Set<Subscriber> } */ = {};
let oldMsgs /* :  { [string]: Array<Msg> } */ = {};
let respCnt /* : number */ = 0;

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

  constructor() {
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

    Object.keys(cfg).forEach(path => {
      if (!(path in subs)) {
        subs[path] = new Set();
      }

      subs[path].add(this);

      if (path in oldMsgs) {
        oldMsgs[path].forEach(msg => {
          this._process(path, msg);
        });
      }
    });
  }

  /**
   * Unsubscribe from path
   */
  unsubscribe(...paths /* : Array<string> */) {
    paths.forEach(path => {
      if (path in this.cfg) {
        delete this.cfg[path];

        if (path in subs) {
          subs[path].delete(this);
        }
      }
    });
  }

  /**
   * Unsubscribe from all paths on this subscriber
   */
  unsubscribeAll() {
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

/**
 * Remove all subscribed paths
 */
function unsubscribeAll() {
  subs = {};
  oldMsgs = {};
}

/**
 * Susbcribe to paths
 */
function subscribe(cfg /* : Cfg */) {
  const sub = new Subscriber();
  sub.subscribe(cfg);
  return sub;
}

/**
 * Publish message
 */
function publish(msg /* : Msg */) {
  if (msg.noPropagate) {
    if (msg.to in subs) {
      subs[msg.to].forEach(sub => {
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

      if (path in subs) {
        subs[path].forEach(sub => {
          sub._process(path, msg);
        });
      }
    });
  }

  if (msg.persist) {
    if (!(msg.to in oldMsgs)) {
      oldMsgs[msg.to] = [];
    }

    oldMsgs[msg.to].push({ ...msg, old: true });
  }
}

/**
 * Answer to message
 */
function answer(msg /* : Msg */, dat /* : any */, err /* : any */) {
  if (msg.res) {
    publish({ to: msg.res, dat, err });
  }
}

/**
 * Send message to path and return promise with response
 */
function call(
  to /* : string */,
  dat /* : any */,
  msgOpts /* : ?{[string]: any} */
) {
  const promise /* :Promise<any> */ = new Promise((resolve, reject) => {
    respCnt += 1;
    const res = `res-${respCnt}`;

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

    sub = subscribe(cfg);

    publish({
      to,
      dat,
      res,
      ...msgOpts
    });
  });

  return promise;
}

exports.subscribe = subscribe;
exports.publish = publish;
exports.unsubscribeAll = unsubscribeAll;
exports.answer = answer;
exports.call = call;
