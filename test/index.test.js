const fastps = require("../src/index.js");

test("subscribe to path", () => {
  const ps = new fastps.PubSub();
  const received = [];

  ps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  ps.publish({ to: "a", dat: 123 });

  expect(received).toStrictEqual([{ to: "a", dat: 123 }]);
});

test("subscribe to multiple paths", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedB = [];

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  ps.publish({ to: "a", dat: 1 });
  ps.publish({ to: "b", dat: 2 });

  expect(receivedA).toStrictEqual([{ to: "a", dat: 1 }]);
  expect(receivedB).toStrictEqual([{ to: "b", dat: 2 }]);
});

test("publish message to unsubscribed path", () => {
  const ps = new fastps.PubSub();
  const received = [];

  ps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  ps.publish({ to: "b", dat: 123 });

  expect(received).toStrictEqual([]);
});

test("publish message to unsubscribed path with noPropagate", () => {
  const ps = new fastps.PubSub();
  const received = [];

  ps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  ps.publish({ to: "b", dat: 123, noPropagate: true });

  expect(received).toStrictEqual([]);
});

test("unsubscribe from all paths", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedB = [];

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  ps.unsubscribeAll();

  ps.publish({ to: "a", dat: 1 });
  ps.publish({ to: "b", dat: 2 });

  expect(receivedA).toStrictEqual([]);
  expect(receivedB).toStrictEqual([]);
});

test("unsubscribe from all paths on subscriber", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedB = [];

  const sub = ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  sub.unsubscribeAll();

  ps.publish({ to: "a", dat: 1 });
  ps.publish({ to: "b", dat: 2 });

  expect(receivedA).toStrictEqual([]);
  expect(receivedB).toStrictEqual([]);
});

test("unsubscribe from some paths", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedB = [];
  const receivedC = [];

  const sub = ps.subscribe({
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

  ps.publish({ to: "a", dat: 1 });
  ps.publish({ to: "b", dat: 2 });
  ps.publish({ to: "c", dat: 3 });

  expect(receivedA).toStrictEqual([]);
  expect(receivedB).toStrictEqual([]);
  expect(receivedC).toStrictEqual([{ to: "c", dat: 3 }]);
});

test("unsubscribe from non-existing paths", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  const sub = ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  sub.unsubscribe("c");

  ps.publish({ to: "a", dat: 1 });

  expect(receivedA).toStrictEqual([{ to: "a", dat: 1 }]);
});

test("add subscriptions to existing subscriber", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedB = [];
  const receivedC = [];

  const sub = ps.subscribe({
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

  ps.publish({ to: "a", dat: 1 });
  ps.publish({ to: "b", dat: 2 });
  ps.publish({ to: "c", dat: 3 });

  expect(receivedA).toStrictEqual([{ to: "a", dat: 1 }]);
  expect(receivedB).toStrictEqual([{ to: "b", dat: 2 }]);
  expect(receivedC).toStrictEqual([{ to: "c", dat: 3 }]);
});

test("add existing path to subscriber", () => {
  const ps = new fastps.PubSub();
  const received = [];

  const sub = ps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  sub.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  ps.publish({ to: "a", dat: 1 });

  expect(received).toStrictEqual([{ to: "a", dat: 1 }]);
});

test("get subscriptions of subscriber", () => {
  const ps = new fastps.PubSub();
  const sub = ps.subscribe({
    a: () => {},
    b: () => {}
  });

  expect(sub.subscriptions()).toStrictEqual(["a", "b"]);
});

test("when subscribing to parent receive children messages", () => {
  const ps = new fastps.PubSub();
  const received = [];

  ps.subscribe({
    a: msg => {
      received.push(msg);
    }
  });

  ps.publish({ to: "a.b", dat: 1 });

  expect(received).toStrictEqual([{ to: "a.b", dat: 1 }]);
});

test("when subscribing to parent children receives message", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedAB = [];

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    "a.b": msg => {
      receivedAB.push(msg);
    }
  });

  ps.publish({ to: "a.b", dat: 1 });

  expect(receivedA).toStrictEqual([{ to: "a.b", dat: 1 }]);
  expect(receivedAB).toStrictEqual([{ to: "a.b", dat: 1 }]);
});

test("when using noPropagate parent subscribers don't receive children message", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];
  const receivedAB = [];

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    "a.b": msg => {
      receivedAB.push(msg);
    }
  });

  ps.publish({ to: "a.b", dat: 1, noPropagate: true });

  expect(receivedA).toStrictEqual([]);
  expect(receivedAB).toStrictEqual([{ to: "a.b", dat: 1, noPropagate: true }]);
});

test("messages published with persist==true are available for late subscribers", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  ps.publish({ to: "a", dat: 1, persist: true });

  ps.subscribe({
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

test("subscribers to messages published with persist==true get the last value", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  ps.publish({ to: "a", dat: 1, persist: true });
  ps.publish({ to: "a", dat: 2, persist: true });

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(receivedA).toStrictEqual([
    {
      to: "a",
      dat: 2,
      persist: true,
      old: true
    }
  ]);
});

test("messages published with persist==true on other paths should not be received by late subscribers", () => {
  const ps = new fastps.PubSub();
  const receivedB = [];

  ps.publish({ to: "a", dat: 1, persist: true });

  ps.subscribe({
    b: msg => {
      receivedB.push(msg);
    }
  });

  expect(receivedB).toStrictEqual([]);
});

test("messages published with persist==true are not available parent subscribers", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  ps.publish({ to: "a.b", dat: 1, persist: true });

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(receivedA).toStrictEqual([]);
});

test("don't modify original messages sent with persist", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  const origMsg = { to: "a", dat: 1, persist: true };

  ps.publish(origMsg);

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    }
  });

  expect(origMsg).toStrictEqual({ to: "a", dat: 1, persist: true });
});

test("answer message", () => {
  const ps = new fastps.PubSub();
  const receivedB = [];

  ps.subscribe({
    a: msg => {
      ps.answer(msg, 4, "some error");
    },
    b: msg => {
      receivedB.push(msg);
    }
  });

  ps.publish({ to: "a", dat: 1, res: "b" });

  expect(receivedB).toStrictEqual([{ to: "b", dat: 4, err: "some error" }]);
});

test("answer to message without res should not publish anything", () => {
  const ps = new fastps.PubSub();
  const receivedA = [];

  ps.subscribe({
    a: msg => {
      receivedA.push(msg);
    },
    "a.b": msg => {
      ps.answer(msg, 4, "some error");
    }
  });

  ps.publish({ to: "a.b", dat: 1 });

  expect(receivedA).toStrictEqual([{ to: "a.b", dat: 1 }]);
});

test("answer doesn't modify original message", () => {
  const ps = new fastps.PubSub();
  const origMsg = { to: "a", dat: 1, res: "b" };

  ps.subscribe({
    a: msg => {
      ps.answer(msg, 4, "some error");
    }
  });

  ps.publish(origMsg);

  expect(origMsg).toStrictEqual({ to: "a", dat: 1, res: "b" });
});

test("call returns data sent with answer", async () => {
  const ps = new fastps.PubSub();
  ps.subscribe({
    add1: msg => {
      ps.answer(msg, msg.dat + 1);
    }
  });

  const resp = await ps.call("add1", 1);

  expect(resp).toStrictEqual(2);
});

test("call throws exception when on error", async () => {
  const ps = new fastps.PubSub();
  ps.subscribe({
    add1: msg => {
      ps.answer(msg, null, new Error("this is an error"));
    }
  });

  try {
    await ps.call("add1", 1);
    throw new Error("should have thrown exception");
  } catch (e) {
    expect(e).toEqual(new Error("this is an error"));
  }
});
