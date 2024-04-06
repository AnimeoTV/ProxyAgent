import tls                          from "tls";
import net                          from "net";
import { Duplex }                   from "stream";
import http                         from "http";
import https                        from "https";
import { SocksProxyAgent }          from "socks-proxy-agent";
import { socksDispatcher }          from "fetch-socks";
import { Agent, buildConnector }    from "undici-discord";

import {
    Agent as AgentBase,
    AgentConnectOpts
} from "agent-base";


////////////////////////////////////////////////
//  AGENT
////////////////////////////////////////////////


// const proxyAgent = new SocksProxyAgent("socks://animeoProxy:AnimeoTroJoli2024@38.242.212.177");
// const proxyAgent        = new SocksProxyAgent("socks://pepo:1337pepo@162.55.188.65");

// const undiciProxyAgent = socksDispatcher({
//     type        : 5,
//     host        : "38.242.212.177",
//     port        : 1080,
//     userId      : "animeoProxy",
//     password    : "AnimeoTroJoli2024",
//     // type        : 5,
//     // host        : "162.55.188.65",
//     // port        : 1080,
//     // userId      : "pepo",
//     // password    : "1337pepo",
// });














const server = net.createServer({
    noDelay     : true,
    keepAlive   : true,
});

server.on("connection", (socket) => {
    socket.once("data", (data) => {
        const length = 0
            | (data[0] || 0) << 24
            | (data[1] || 0) << 16
            | (data[2] || 0) <<  8
            | (data[3] || 0) <<  0;

        const payloadString = data.subarray(4, 4 + length).toString("utf8");
        const payload       = JSON.parse(payloadString);
        const extra         = data.subarray(4 + length);

        const proxiedSocket = net.createConnection({
            host    : payload.host,
            port    : payload.port,
            noDelay : true,
            timeout : 10_000
        });

        proxiedSocket.pipe(socket);
        proxiedSocket.write(extra);
        socket.pipe(proxiedSocket);
    });
});

server.listen(3983, "127.0.0.1", () => {
    console.log("[PROXY] Started.")
});







class CustomAnimeoAgent extends AgentBase {
    override connect(req: http.ClientRequest, options: AgentConnectOpts): http.Agent | Duplex | Promise<http.Agent | Duplex> {
        const socket = net.createConnection({
            host    : "127.0.0.1",
            port    : 3983,
            noDelay : true,
            timeout : 10_000
        });

        const data = Buffer.from(
            JSON.stringify({
                host: req.host,
                port: options.secureEndpoint ? (443) : (80),
            }),
        );

        const cleanup = (tlsSocket?: tls.TLSSocket) => {
            req.destroy();
            socket.destroy();
            tlsSocket?.destroy();
        };

        const buffer = new Uint8Array(data.length + 4);

        buffer[0] = (data.length >> 24) & 0xFF;
        buffer[1] = (data.length >> 16) & 0xFF;
        buffer[2] = (data.length >>  8) & 0xFF;
        buffer[3] = (data.length >>  0) & 0xFF;
        data.copy(buffer, 4);
        socket.write(buffer);

        if (options.secureEndpoint) {
            const servername = options.servername || options.host || "";

            const tlsSocket = tls.connect({
                ...options,
                socket,
                servername: net.isIP(servername) ? undefined : servername,
            });

            tlsSocket.once("error", (error) => {
                console.error(error);
                cleanup(tlsSocket);
            });

            return tlsSocket;

        } else {
            return socket;
        }
    }
};

const proxyAgent = new CustomAnimeoAgent();

http.globalAgent    = proxyAgent;
https.globalAgent   = proxyAgent;




















const undiciProxyAgent = new Agent({
    connect(options, callback) {
        const undiciConnect = buildConnector({});

        const socket = net.createConnection({
            host    : "127.0.0.1",
            port    : 3983,
            noDelay : true,
            timeout : 10_000
        });

        const data = Buffer.from(
            JSON.stringify({
                host: options.hostname,
                port: Number(options.port) || ((options.protocol === "https:") ? (443) : (80)),
            }),
        );

        const buffer = new Uint8Array(data.length + 4);

        buffer[0] = (data.length >> 24) & 0xFF;
        buffer[1] = (data.length >> 16) & 0xFF;
        buffer[2] = (data.length >>  8) & 0xFF;
        buffer[3] = (data.length >>  0) & 0xFF;
        data.copy(buffer, 4);
        socket.write(buffer);

        return (options.protocol === "https:")
            ? undiciConnect({ ...options, httpSocket: socket }, callback)
            : callback(null, socket);
    },
});

export default {
    proxyAgent,
    undiciProxyAgent,
};
