# fastps

 [![Coverage Status](https://coveralls.io/repos/github/nayarsystems/fastps/badge.svg?branch=master&service=github)](https://coveralls.io/github/nayarsystems/fastps?branch=master)

Simple pub/sub

## Install

```
npm install @nayar/fastps
```

## Usage

You can subscribe to a path (with dots as separators) and will receive messages published to that path.

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.subscribe({
  "a.b": msg => {
    console.log("received:", msg);
  }
});

ps.publish({ to: "a.b", dat: 123 });
```

A subscriber to a path (e.g. "a") will also receive messages published to paths that have it as a prefix (e.g. "a.b" or "a.c.d")

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.subscribe({
  a: msg => {
    console.log("received in parent path:", msg);
  }
});

ps.publish({ to: "a.b", dat: 123 });
ps.publish({ to: "a.c.d", dat: 456 });
```

### Subscriber object

Calls to `subscribe` return a subscriber object on which you can call the following methods:

- `subscribe(cfg)`: add subscription to subscriber (receives same param as `PubSub.subscribe`).
- `unsubscribe(path1, path2...)`: Unsubscribes from those paths.
- `unsubscribeAll()`: Removes all subscriptions from subscriber.

This code:

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

const sub = ps.subscribe({
  a: msg => {
    console.log("a: msg=", msg);
  },
  b: msg => {
    console.log("b: msg=", msg);
  }
});

sub.unsubscribe("b");

sub.subscribe({
  c: msg => {
    console.log("c: msg=", msg);
  }
});

ps.publish({ to: "a", dat: 1 });
ps.publish({ to: "b", dat: 2 });
ps.publish({ to: "c", dat: 2 });
```

will print:

```
a: msg= { to: 'a', dat: 1 }
c: msg= { to: 'c', dat: 2 }
```

### Message fields

A message can contain the following fields:

- `to` (required): path to publish to.
- `dat` (required): message payload.
- `persist` (optional): message will be stored when published and later subscribers to its path will receive it.
- `noPropagate` (required): subscribers to ancestor paths will not receive this message.
- `res` (optional): path where you will receive the answer for this message.
- `err` (optional): field with error that is sent using answer.

### Persist

Messages with field `persist` == true will be delivered to subscribers that susbcribe after it has been published.

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.publish({ to: "a", dat: "Hi!", persist: true });

ps.subscribe({
  a: msg => {
    console.log("received:", msg);
  }
});
```

When several messages are published to a path with `persist` == true subscribers will receive the most recent one when subscribing.

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.publish({ to: "a", dat: "Hi!", persist: true });
ps.publish({ to: "a", dat: "Hello there!", persist: true });

ps.subscribe({
  a: msg => {
    console.log(msg.dat); // Will print "Hello there!"
  }
});
```

### noPropagate

If you send a message with `noPropagate` == true it will not be received by subscribers of parent paths

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.subscribe({
  a: msg => {
    console.log("this line won't be executed");
  }
});

ps.publish({ to: "a.b", dat: 123, noPropagate: true });
ps.publish({ to: "a.b.c", dat: 123, noPropagate: true });
```

### Answer

You can put a path on the message field `res` so answers to it will be received on that path.

To answer a message just call `PubSub.answer(msg, data, error)`

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.subscribe({
  a: msg => {
    ps.answer(msg, "Hello there!");
  },
  b: msg => {
    console.log("received answer:", msg.dat);
  }
});

ps.publish({ to: "a", dat: "Hi!", res: "b" });
```

You can also send an error when answering a message.

```javascript
const fastps = require("@nayar/fastps");

const ps = new fastps.PubSub();

ps.subscribe({
  a: msg => {
    ps.answer(msg, null, "Oops, something failed :(");
  },
  b: msg => {
    console.log("received error:", msg.err);
  }
});

ps.publish({ to: "a", dat: "Hi!", res: "b" });
```
