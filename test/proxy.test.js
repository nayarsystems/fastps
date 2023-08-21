const fastps = require("../src/index.js");
const { MessageChannel } = require('node:worker_threads');
const { MessagePortTransport } = require("../src/transports.js");
const { Proxy } = require("../src/proxy.js");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("test Proxy", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);
    const ps1 = new fastps.PubSub();
    const ps2 = new fastps.PubSub();
    const subscriber1 = new fastps.Subscriber(ps1);
    const subscriber2 = new fastps.Subscriber(ps2);
    let transport1Closed = 0;
    let transport2Closed = 0;

    transport1.onClose(() => { transport1Closed++ })
    transport2.onClose(() => { transport2Closed++ })

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

    await sleep(10)
    expect(transport1Closed).toBe(0);
    expect(transport2Closed).toBe(0);
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



    // test subscriptions after proxy creation
    recOn1 = [];
    recOn2 = [];

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
    await sleep(10)
    ps2.publish({ "to": "on-ps1", "dat": "hello" });
    ps1.publish({ "to": "on-ps2", "dat": "hello" });
    await sleep(10)
    expect(recOn1).toMatchObject([{ "to": "on-ps1", "dat": "hello" }]);
    expect(recOn2).toMatchObject([{ "to": "on-ps2", "dat": "hello" }]);
    expect(ps1.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2"]));
    expect(ps2.getAllPaths()).toEqual(expect.arrayContaining(["on-ps1", "on-ps2"]));

    // call a method on the remote subscriber
    let res = await ps1.call("on-ps2", "hello");
    expect(res).toBe(2);
    res = await ps2.call("on-ps1", "hello");
    expect(res).toBe(1);

    // send a message to local subscriber
    recOn1 = [];
    recOn2 = [];
    res = await ps1.call("on-ps1", "hello");
    expect(res).toBe(1);
    expect(recOn1).toMatchObject([{ "to": "on-ps1", "dat": "hello" }]);
    expect(recOn2).toStrictEqual([]);

    recOn1 = [];
    recOn2 = [];
    res = await ps2.call("on-ps2", "hello");
    expect(res).toBe(2);
    expect(recOn1).toStrictEqual([]);
    expect(recOn2).toMatchObject([{ "to": "on-ps2", "dat": "hello" }]);

    // test unsubscriptions
    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();
    await sleep(10);
    expect(ps1.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2"]));
    expect(ps2.getAllPaths()).toEqual(expect.not.arrayContaining(["on-ps1", "on-ps2"]));

    // test duplicated subscriptions in both proxies 
    recOn1 = [];
    recOn2 = [];
    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();

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

    // test persisted message on remote node before subscription
    subscriber1.unsubscribeAll();
    subscriber2.unsubscribeAll();
    recOn1 = [];
    recOn2 = [];

    ps2.publish({ to: "a", dat: "hello", persist: true })
    await sleep(10);
    expect(recOn1).toStrictEqual([]);
    subscriber1.subscribe(
        {
            "a": (msg) => {
                recOn1.push(msg);
                ps1.answer(msg, 'a');
            },
        });

    await sleep(10);
    expect(recOn1).toMatchObject([{ to: "a", dat: "hello", old: true }]);


    // test close proxies
    proxy1.close();
    proxy2.close();
    await sleep(10)
    expect(proxy1.alive).toBe(false);
    expect(proxy2.alive).toBe(false);
    expect(proxy1.connected).toBe(false);
    expect(proxy2.connected).toBe(false);
    expect(transport1Closed).toBe(1);
    expect(transport2Closed).toBe(1);

    // close again
    proxy1.close();
    proxy2.close();
    await sleep(10)
    expect(transport1Closed).toBe(1);
    expect(transport2Closed).toBe(1);

});