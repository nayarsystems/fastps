// @flow

const fastps = require("../src/index.js");

afterEach(() => {
  fastps.unsubscribeAll();
});

test("subscribe to path", () => {
  const received = [];

  fastps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  fastps.publish({ to: "a", dat: 123 });

  expect(received).toStrictEqual([{ to: "a", dat: 123 }]);
});

test("subscribe to multiple paths", () => {
  const receivedA = [];
  const receivedB = [];

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  fastps.publish({ to: "a", dat: 1 });
  fastps.publish({ to: "b", dat: 2 });

  expect(receivedA).toStrictEqual([{ to: "a", dat: 1 }]);
  expect(receivedB).toStrictEqual([{ to: "b", dat: 2 }]);
});

test("unsubscribe from all paths", () => {
  const receivedA = [];
  const receivedB = [];

  const sub = fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  sub.unsubscribeAll();

  fastps.publish({ to: "a", dat: 1 });
  fastps.publish({ to: "b", dat: 2 });

  expect(receivedA).toStrictEqual([]);
  expect(receivedB).toStrictEqual([]);
});

test("unsubscribe from some paths", () => {
  const receivedA = [];
  const receivedB = [];
  const receivedC = [];

  const sub = fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    },
    c: msg => {
      receivedC.push(msg);
    }
  });

  sub.unsubscribe("a", "b");

  fastps.publish({ to: "a", dat: 1 });
  fastps.publish({ to: "b", dat: 2 });
  fastps.publish({ to: "c", dat: 3 });

  expect(receivedA).toStrictEqual([]);
  expect(receivedB).toStrictEqual([]);
  expect(receivedC).toStrictEqual([{ to: "c", dat: 3 }]);
});

test("add subscriptions to existing subscriber", () => {
  const receivedA = [];
  const receivedB = [];
  const receivedC = [];

  const sub = fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  sub.subscribe({
    b: msg => {
      receivedB.push(msg);
    },
    c: msg => {
      receivedC.push(msg);
    }
  });

  fastps.publish({ to: "a", dat: 1 });
  fastps.publish({ to: "b", dat: 2 });
  fastps.publish({ to: "c", dat: 3 });

  expect(receivedA).toStrictEqual([{ to: "a", dat: 1 }]);
  expect(receivedB).toStrictEqual([{ to: "b", dat: 2 }]);
  expect(receivedC).toStrictEqual([{ to: "c", dat: 3 }]);
});

test("add existing path to subscriber", () => {
  const received = [];

  const sub = fastps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  sub.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  fastps.publish({ to: "a", dat: 1 });

  expect(received).toStrictEqual([{ to: "a", dat: 1 }]);
});

test("get subscriptions of subscriber", () => {
  const sub = fastps.subscribe({
    a: () => {},
    b: () => {}
  });

  expect(sub.subscriptions()).toStrictEqual(["a", "b"]);
});

test("when subscribing to parent receive children messages", () => {
  const received = [];

  fastps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  fastps.publish({ to: "a.b", dat: 1 });

  expect(received).toStrictEqual([{ to: "a.b", dat: 1 }]);
});

test("when subscribing to parent children receives message", () => {
  const receivedA = [];
  const receivedAB = [];

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    "a.b": msg => {
      receivedAB.push(msg);
    }
  });

  fastps.publish({ to: "a.b", dat: 1 });

  expect(receivedA).toStrictEqual([{ to: "a.b", dat: 1 }]);
  expect(receivedAB).toStrictEqual([{ to: "a.b", dat: 1 }]);
});

test("when using noPropagate parent subscribers don't receive children message", () => {
  const receivedA = [];
  const receivedAB = [];

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    "a.b": msg => {
      receivedAB.push(msg);
    }
  });

  fastps.publish({ to: "a.b", dat: 1, noPropagate: true });

  expect(receivedA).toStrictEqual([]);
  expect(receivedAB).toStrictEqual([{ to: "a.b", dat: 1, noPropagate: true }]);
});

test("messages published with persist==true are available for late subscribers", () => {
  const receivedA = [];

  fastps.publish({ to: "a", dat: 1, persist: true });

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(receivedA).toStrictEqual([
    {
      to: "a",
      dat: 1,
      persist: true,
      old: true
    }
  ]);
});

test("messages published with persist==true are not available parent subscribers", () => {
  const receivedA = [];

  fastps.publish({ to: "a.b", dat: 1, persist: true });

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(receivedA).toStrictEqual([]);
});

test("don't modify original messages sent with persist", () => {
  const receivedA = [];

  const origMsg = { to: "a", dat: 1, persist: true };

  fastps.publish(origMsg);

  fastps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(origMsg).toStrictEqual({ to: "a", dat: 1, persist: true });
});

test("answer message", () => {
  const receivedB = [];

  fastps.subscribe({
    a: msg => {
      fastps.answer(msg, 4, "some error");
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  fastps.publish({ to: "a", dat: 1, res: "b" });

  expect(receivedB).toStrictEqual([{ to: "b", dat: 4, err: "some error" }]);
});

test("answer doesn't modify original message", () => {
  const origMsg = { to: "a", dat: 1, res: "b" };

  fastps.subscribe({
    a: msg => {
      fastps.answer(msg, 4, "some error");
    }
  });

  fastps.publish(origMsg);

  expect(origMsg).toStrictEqual({ to: "a", dat: 1, res: "b" });
});

test("call returns data sent with answer", async () => {
  fastps.subscribe({
    add1: msg => {
      fastps.answer(msg, msg.dat + 1);
    }
  });

  const resp = await fastps.call("add1", 1);

  expect(resp).toStrictEqual(2);
});

test("call throws exception when on error", async () => {
  fastps.subscribe({
    add1: msg => {
      fastps.answer(msg, null, new Error("this is an error"));
    }
  });

  try {
    await fastps.call("add1", 1);
    throw new Error("should have thrown exception");
  } catch (e) {
    expect(e).toEqual(new Error("this is an error"));
  }
});
