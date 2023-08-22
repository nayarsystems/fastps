const fastps = require("../src/index.js");
const { MessageChannel } = require('node:worker_threads');
const { MessagePortTransport } = require("../src/transports.js");
const { Proxy } = require("../src/proxy.js");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("proxy pair open / close test", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();

    let proxy1Closed = 0;
    let proxy2Closed = 0;

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);

    proxy1.onClose(() => { proxy1Closed++ })
    proxy2.onClose(() => { proxy2Closed++ })
    await sleep(10);
    expect(proxy1.alive).toBe(true);
    expect(proxy2.alive).toBe(true);
    expect(proxy1.connected).toBe(true);
    expect(proxy2.connected).toBe(true);
    expect(ps1.getAllPaths().includes(ps2.id)).toBe(true);
    expect(ps2.getAllPaths().includes(ps1.id)).toBe(true);
    await sleep(10);

    // test close
    proxy1.close();
    proxy2.close();
    await sleep(10)
    expect(proxy1.alive).toBe(false);
    expect(proxy2.alive).toBe(false);
    expect(proxy1.connected).toBe(false);
    expect(proxy2.connected).toBe(false);
    expect(proxy1Closed).toBe(1);
    expect(proxy2Closed).toBe(1);

    // test double close
    await sleep(10);
    proxy1.close();
    proxy2.close();
    await sleep(10)
    expect(proxy1.alive).toBe(false);
    expect(proxy2.alive).toBe(false);
    expect(proxy1.connected).toBe(false);
    expect(proxy2.connected).toBe(false);
    expect(proxy1Closed).toBe(1);
    expect(proxy2Closed).toBe(1);

    // latter close callbacks are triggered inmediatly
    proxy1.onClose(() => { proxy1Closed++ })
    expect(proxy1Closed).toBe(2);

});

test("test subscriptions before conection are synced", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    let recOn1 = [];
    let recOn2 = [];

    subscriber1.subscribe(
        {
            "on-ps1-pre": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 1);
            }
        });

    subscriber2.subscribe(
        {
            "on-ps2-pre": (msg) => {
                recOn2.push(msg);
                ps2.answer(msg, 2);
            }
        });

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);

    await sleep(10);

    expect(proxy1.alive).toBe(true);
    expect(proxy2.alive).toBe(true);
    expect(proxy1.connected).toBe(true);
    expect(proxy2.connected).toBe(true);
    expect(ps1.numSubscribers("on-ps1-pre")).toBe(1);
    expect(ps1.numSubscribers("on-ps2-pre")).toBe(1);
    expect(ps2.numSubscribers("on-ps1-pre")).toBe(1);
    expect(ps2.numSubscribers("on-ps2-pre")).toBe(1);

    // test subscriptions previous to proxy creation
    ps2.publish({ "to": "on-ps1-pre", "dat": "hello" });
    ps1.publish({ "to": "on-ps2-pre", "dat": "hello" });
    await sleep(10)
    expect(recOn1).toMatchObject([{ "to": "on-ps1-pre", "dat": "hello" }]);
    expect(recOn2).toMatchObject([{ "to": "on-ps2-pre", "dat": "hello" }]);
    expect(ps1.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1-pre", "on-ps2-pre"]));
    expect(ps2.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1-pre", "on-ps2-pre"]));

    // test unsubscriptions
    subscriber1.unsubscribe("on-ps1-pre");
    await sleep(10)
    expect(ps1.numSubscribers("on-ps1-pre")).toBe(0);
    expect(ps2.numSubscribers("on-ps1-pre")).toBe(0);
    expect(ps1.numSubscribers("on-ps2-pre")).toBe(1);
    expect(ps2.numSubscribers("on-ps2-pre")).toBe(1);

    subscriber2.unsubscribe("on-ps2-pre");
    await sleep(10)
    expect(ps1.numSubscribers("on-ps1-pre")).toBe(0);
    expect(ps2.numSubscribers("on-ps1-pre")).toBe(0);
    expect(ps1.numSubscribers("on-ps2-pre")).toBe(0);
    expect(ps2.numSubscribers("on-ps2-pre")).toBe(0);


    proxy1.close();
    proxy2.close();
});

test("test subscriptions aftert conection are synced", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    let recOn1 = [];
    let recOn2 = [];

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);

    await sleep(10);

    subscriber1.subscribe(
        {
            "on-ps1": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 1);
            }
        });

    subscriber2.subscribe(
        {
            "on-ps2": (msg) => {
                recOn2.push(msg);
                ps2.answer(msg, 2);
            }
        });


    await sleep(10);

    expect(proxy1.alive).toBe(true);
    expect(proxy2.alive).toBe(true);
    expect(proxy1.connected).toBe(true);
    expect(proxy2.connected).toBe(true);
    expect(ps1.numSubscribers("on-ps1")).toBe(1);
    expect(ps1.numSubscribers("on-ps2")).toBe(1);
    expect(ps2.numSubscribers("on-ps1")).toBe(1);
    expect(ps2.numSubscribers("on-ps2")).toBe(1);

    // test subscriptions after proxy creation
    ps2.publish({ "to": "on-ps1", "dat": "hello" });
    ps1.publish({ "to": "on-ps2", "dat": "hello" });
    await sleep(10)
    expect(recOn1).toMatchObject([{ "to": "on-ps1", "dat": "hello" }]);
    expect(recOn2).toMatchObject([{ "to": "on-ps2", "dat": "hello" }]);
    expect(ps1.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2"]));
    expect(ps2.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2"]));

    // test unsubscriptions
    subscriber1.unsubscribe("on-ps1");
    await sleep(10)
    expect(ps1.numSubscribers("on-ps1")).toBe(0);
    expect(ps2.numSubscribers("on-ps1")).toBe(0);
    expect(ps1.numSubscribers("on-ps2")).toBe(1);
    expect(ps2.numSubscribers("on-ps2")).toBe(1);

    subscriber2.unsubscribe("on-ps2");
    await sleep(10)
    expect(ps1.numSubscribers("on-ps1")).toBe(0);
    expect(ps2.numSubscribers("on-ps1")).toBe(0);
    expect(ps1.numSubscribers("on-ps2")).toBe(0);
    expect(ps2.numSubscribers("on-ps2")).toBe(0);


    proxy1.close();
    proxy2.close();
});

test("test cross call", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);

    await sleep(10);

    subscriber1.subscribe(
        {
            "on-ps1": (msg) => {
                ps1.answer(msg, 1);
            }
        });

    subscriber2.subscribe(
        {
            "on-ps2": (msg) => {
                ps2.answer(msg, 2);
            }
        });

    await sleep(10);

    // cross call
    expect(await ps1.call("on-ps2", 0)).toBe(2);
    expect(await ps2.call("on-ps1", 0)).toBe(1);

    // Same node call
    expect(await ps1.call("on-ps1", 0)).toBe(1);
    expect(await ps2.call("on-ps2", 0)).toBe(2);

    proxy1.close();
    proxy2.close();
});

test("test duplicated subscriptions in both nodes", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    let recOn1 = [];
    let recOn2 = [];

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);

    subscriber1.subscribe(
        {
            "a": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 'a');
            },
            "b": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 'b')
            }
        });

    subscriber2.subscribe(
        {
            "a": (msg) => {
                recOn2.push(msg);
                ps2.answer(msg, 'a');
            },
            "b": (msg) => {
                recOn2.push(msg);
                ps2.answer(msg, 'b')
            }
        });

    await sleep(10);
    expect(ps1.numSubscribers("a")).toBe(2);
    expect(ps1.numSubscribers("b")).toBe(2);
    expect(ps2.numSubscribers("a")).toBe(2);
    expect(ps2.numSubscribers("b")).toBe(2);

    ps1.publish({ to: "a", dat: "hello" })
    await sleep(10);
    expect(recOn1).toMatchObject([{ to: "a", dat: "hello" }]);
    expect(recOn2).toMatchObject([{ to: "a", dat: "hello" }]);

    recOn1 = [];
    recOn2 = [];
    ps1.publish({ to: "b", dat: "hello" })
    await sleep(10);
    expect(recOn1).toMatchObject([{ to: "b", dat: "hello" }]);
    expect(recOn2).toMatchObject([{ to: "b", dat: "hello" }]);

    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();
    await sleep(10);
    expect(ps1.numSubscribers("a")).toBe(0);
    expect(ps1.numSubscribers("b")).toBe(0);
    expect(ps2.numSubscribers("a")).toBe(0);
    expect(ps2.numSubscribers("b")).toBe(0);

    proxy1.close();
    proxy2.close();
});

test("test persisted message on remote node before subscription", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    let recOn1 = [];
    let recOn2 = [];

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);
    await sleep(10);

    ps2.publish({ to: "persisted", dat: "hello", persist: true })
    await sleep(10);
    expect(recOn1).toStrictEqual([]);
    subscriber1.subscribe(
        {
            "persisted": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 'persisted');
            },
        });

    await sleep(10);
    expect(recOn1).toMatchObject([{ to: "persisted", dat: "hello", old: true }]);

    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();
    await sleep(10);
    expect(ps1.numSubscribers("persisted")).toBe(0);
    expect(ps2.numSubscribers("persisted")).toBe(0);

    proxy1.close();
    proxy2.close();
});

test("test persisted message on remote node before subscription fetchOld = false", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);

    let recOn1 = [];

    const proxy1 = new Proxy(transport1, ps1);
    const proxy2 = new Proxy(transport2, ps2);
    await sleep(10);

    ps2.publish({ to: "persisted", dat: "hello", persist: true })
    await sleep(10);
    expect(recOn1).toStrictEqual([]);
    subscriber1.fetchOld = false;
    subscriber1.subscribe(
        {
            "persisted": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 'persisted');
            },
        });

    await sleep(10);
    expect(recOn1).toStrictEqual([]);

    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();
    await sleep(10);
    expect(ps1.numSubscribers("persisted")).toBe(0);
    expect(ps2.numSubscribers("persisted")).toBe(0);

    proxy1.close();
    proxy2.close();
});


test("test 3 nodes cross call ([ps1]====[ps2]====[ps3]", async () => {
    const { port1: portA1, port2: portA2 } = new MessageChannel();
    const { port1: portB1, port2: portB2 } = new MessageChannel();
    const transportA1 = new MessagePortTransport(portA1);
    const transportA2 = new MessagePortTransport(portA2);
    const transportB1 = new MessagePortTransport(portB1);
    const transportB2 = new MessagePortTransport(portB2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const ps3 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);
    const subscriber3 = new fastps.Subscriber(ps3);
    const proxy1 = new Proxy(transportA1, ps1);
    const proxy2 = new Proxy(transportA2, ps2);
    const proxy3 = new Proxy(transportB1, ps2);
    const proxy4 = new Proxy(transportB2, ps3);

    await sleep(10);

    subscriber1.subscribe(
        {
            "on-ps1": (msg) => {
                ps1.answer(msg, 1);
            }
        });

    subscriber2.subscribe(
        {
            "on-ps2": (msg) => {
                ps2.answer(msg, 2);
            }
        });

    subscriber3.subscribe(
        {
            "on-ps3": (msg) => {
                ps3.answer(msg, 3);
            }
        });


    await sleep(10);

    // cross call
    expect(await ps1.call("on-ps1", 0)).toBe(1);
    expect(await ps1.call("on-ps2", 0)).toBe(2);
    expect(await ps1.call("on-ps3", 0)).toBe(3);

    expect(await ps2.call("on-ps1", 0)).toBe(1);
    expect(await ps2.call("on-ps2", 0)).toBe(2);
    expect(await ps2.call("on-ps3", 0)).toBe(3);

    expect(await ps3.call("on-ps1", 0)).toBe(1);
    expect(await ps3.call("on-ps2", 0)).toBe(2);
    expect(await ps3.call("on-ps3", 0)).toBe(3);

    expect(ps1.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));
    expect(ps2.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));
    expect(ps3.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));

    subscriber1.unsubscribe("on-ps1");
    await sleep(10);
    expect(ps1.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1"]));
    expect(ps2.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1"]));
    expect(ps3.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1"]));

    subscriber2.unsubscribe("on-ps2");
    await sleep(10);
    expect(ps1.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2"]));
    expect(ps2.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2"]));
    expect(ps3.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2"]));

    subscriber3.unsubscribe("on-ps3");
    await sleep(10);
    expect(ps1.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));
    expect(ps2.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));
    expect(ps3.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2", "on-ps3"]));

    proxy1.close();
    proxy2.close();
    proxy3.close();
    proxy4.close();

});
