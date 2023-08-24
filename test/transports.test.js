const fastps = require("../src/index.js");
const { MessagePortTransport, SocketIOTransport } = require("../src/transports.js");
const { MessageChannel } = require('node:worker_threads');
const { io: Client } = require("socket.io-client");
const { Server } = require("socket.io");
const { createServer } = require("node:http");

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

    await sleep(10);

    expect(transport2Msgs).toStrictEqual(["hello"]);
    expect(transport1Msgs).toStrictEqual(["world"]);

    transport1.close();
    transport2.close();

    await sleep(10);

    expect(transport2Msgs).toStrictEqual(["hello", "closed"]);
    expect(transport1Msgs).toStrictEqual(["world", "closed"]);
});

test("test SocketIOTransport", async () => {

    let serverSocket, clientSocket, connectionDone;

    const httpServer = createServer();
    let server = new Server(httpServer);
    httpServer.listen(() => {
        const port = httpServer.address().port;
        clientSocket = new Client(`http://localhost:${port}`);
        server.on("connection", (socket) => {
            serverSocket = socket;
        });
        clientSocket.on("connect", () => {connectionDone = true;});
    });

    while (!connectionDone) {
        await sleep(1);
    }

    const transport1 = new SocketIOTransport(serverSocket);
    const transport2 = new SocketIOTransport(clientSocket);

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

    await sleep(10);

    expect(transport2Msgs).toStrictEqual(["hello", "closed"]);
    expect(transport1Msgs).toStrictEqual(["world", "closed"]);

    server.close();
});
