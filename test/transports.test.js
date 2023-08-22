const fastps = require("../src/index.js");
const { MessagePortTransport, SocketIOTransport } = require("../src/transports.js");
const { MessageChannel } = require('node:worker_threads');
const { io } = require("socket.io-client");
const { Server } = require("socket.io");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("test MessagePortTransport", async () => {
    const { port1, port2 } = new MessageChannel();
    const transport1 = new MessagePortTransport(port1);
    const transport2 = new MessagePortTransport(port2);

    let transport1Msgs = [];
    let transport2Msgs = [];

    transport1.onMessage((msg) => {
        transport1Msgs.push(msg);
    });

    transport1.onClose(() => {
        transport1Msgs.push("closed");
    });

    transport2.onMessage((msg) => {
        transport2Msgs.push(msg);
    });

    transport2.onClose(() => {
        transport2Msgs.push("closed");
    });


    transport1.send("hello");
    transport2.send("world");

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(transport2Msgs).toStrictEqual(["hello"]);
    expect(transport1Msgs).toStrictEqual(["world"]);

    transport1.close();
    transport2.close();

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(transport2Msgs).toStrictEqual(["hello", "closed"]);
    expect(transport1Msgs).toStrictEqual(["world", "closed"]);
});

test("test SocketIOTransport", async () => {
    let socket1 = null
    let socket2 = null

    const server = new Server(3468, {
        // options
      });
      
      server.on("connection", (socket) => {
        socket1 = socket;
      });

    socket2 = io("http://localhost:3468");

    while (socket1 == null) {
        await sleep(10);
    }

    const transport1 = new SocketIOTransport(socket1);
    const transport2 = new SocketIOTransport(socket2);

    let transport1Msgs = [];
    let transport2Msgs = [];

    transport1.onMessage((msg) => {
        transport1Msgs.push(msg);
    });

    transport1.onClose(() => {
        transport1Msgs.push("closed");
    });

    transport2.onMessage((msg) => {
        transport2Msgs.push(msg);
    });

    transport2.onClose(() => {
        transport2Msgs.push("closed");
    });

    transport1.send("hello");
    transport2.send("world");

    await sleep(10);

    expect(transport2Msgs).toStrictEqual(["hello"]);
    expect(transport1Msgs).toStrictEqual(["world"]);

    transport1.close();
    transport2.close();

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(transport2Msgs).toStrictEqual(["hello", "closed"]);
    expect(transport1Msgs).toStrictEqual(["world", "closed"]);

    server.close();
});
