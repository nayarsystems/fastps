# fastps

[![Build Status](https://travis-ci.org/nayarsystems/fastps.svg?branch=master)](https://travis-ci.org/nayarsystems/fastps) [![Coverage Status](https://coveralls.io/repos/github/nayarsystems/fastps/badge.svg?branch=master&service=github)](https://coveralls.io/github/nayarsystems/fastps?branch=master)

Simple pub/sub

## Install

```
npm install fastps
```

or

```
yarn install fastps
```

## Usage

You can subscribe to a path (with dots as separators) and will receive messages published to that path.

```javascript
var fastps = require("fastps");

fastps.subscribe({
  "a.b": msg => {
    console.log("received:", msg);
  }
});

fastps.publish({ to: "a.b", dat: 123 });
```

A subscriber to a path (e.g. "a") will also receive messages published to paths that have it as a prefix (e.g. "a.b" or "a.c.d")

```javascript
var fastps = require("fastps");

fastps.subscribe({
  "a": msg => {
    console.log("received in parent path:", msg);
  }
});

fastps.publish({ to: "a.b", dat: 123 });
fastps.publish({ to: "a.c.d", dat: 456 });
```

### Message fields

A message can contain the following fields:

- `to` (required): path to publish to.
- `dat` (required): message payload.
- `persist` (optional): message will be stored when published and later subscribers to its path will receive it.
- `noPropagate` (required): subscribers to ancestor paths will not receive this message.
- `res` (optional): path where you will receive the answer for this message.
- `err` (option): field with error that is sent using answer.

### Persist

Messages with field `persist` == true will be delivered to subscribers that susbcribe after it has been published.

```javascript
var fastps = require("fastps");

fastps.publish({ to: "a", dat: "Hi!", persist: true });

fastps.subscribe({
  a: msg => {
    console.log("received:", msg);
  }
});
```

When several messages are published to a path with `persist` == true subscribers will receive the most recent one when subscribing.

```javascript
var fastps = require("fastps");

fastps.publish({ to: "a", dat: "Hi!", persist: true });
fastps.publish({ to: "a", dat: "Hello there!", persist: true });

fastps.subscribe({
  a: msg => {
    console.log(msg.dat); // Will print "Hello there!"
  }
});
```

### noPropagate

If you send a message with `noPropagate` == true it will not be received by subscribers of parent paths

```javascript
var fastps = require("fastps");

fastps.subscribe({
  a: msg => {
    console.log("this line won't be executed");
  }
});

fastps.publish({ to: "a.b", dat: 123, noPropagate: true });
fastps.publish({ to: "a.b.c", dat: 123, noPropagate: true });
```

### Answer

You can put a path on the message field `res` so answers to it will be received on that path.

To answer a message just call `msg.answer(data, error)`

```javascript
var fastps = require("fastps");

fastps.subscribe({
  a: msg => {
    fastps.answer(msg, "Hello there!");
  },
  b: msg => {
    console.log("received answer:", msg.dat);
  }
});

fastps.publish({ to: "a", dat: "Hi!", res: "b" });
```

You can also send an error when answering a message.

```javascript
var fastps = require("fastps");

fastps.subscribe({
  a: msg => {
    fastps.answer(msg, null, "Oops, something failed :(");
  },
  b: msg => {
    console.log("received error:", msg.err);
  }
});

fastps.publish({ to: "a", dat: "Hi!", res: "b" });
```
