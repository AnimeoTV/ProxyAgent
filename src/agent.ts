import * as dns                     from "dns";
import net                          from "net";
import tls                          from "tls";
import http                         from "http";
import https                        from "https";
import { Duplex }                   from "stream";

import {
    SocksClient,
    SocksProxy,
    SocksRemoteHost
} from "socks";

import {
    Agent as UndiciAgent,
    buildConnector
} from "undici-discord";

import {
    Agent as AgentBase,
    AgentConnectOpts
} from "agent-base";


////////////////////////////////////////////////
//  UTILS
////////////////////////////////////////////////


// Gently pasted from https://github.com/TooTallNate/proxy-agents/blob/70023c12abe0d014004af6309ff7d0fdbaa60875/packages/socks-proxy-agent/src/index.ts#L12

type ParsedSocksURL = {
    lookup  : boolean;
    proxy   : SocksProxy;
};

function parseSocksURL(url: URL): ParsedSocksURL {
    let lookup = false;
    let type: SocksProxy['type'] = 5;
    const host = url.hostname;

    // From RFC 1928, Section 3: https://tools.ietf.org/html/rfc1928#section-3
    // "The SOCKS service is conventionally located on TCP port 1080"
    const port = parseInt(url.port, 10) || 1080;

    // figure out if we want socks v4 or v5, based on the "protocol" used.
    // Defaults to 5.
    switch (url.protocol.replace(':', '')) {
        case 'socks4':
            lookup = true;
            type = 4;
            break;
        // pass through
        case 'socks4a':
            type = 4;
            break;
        case 'socks5':
            lookup = true;
            type = 5;
            break;
        // pass through
        case 'socks': // no version specified, default to 5h
            type = 5;
            break;
        case 'socks5h':
            type = 5;
            break;
        default:
            throw new TypeError(
                `A "socks" protocol must be specified! Got: ${String(
                    url.protocol
                )}`
            );
    }

    const proxy: SocksProxy = {
        host,
        port,
        type,
    };

    if (url.username) {
        Object.defineProperty(proxy, 'userId', {
            value: decodeURIComponent(url.username),
            enumerable: false,
        });
    }

    if (url.password != null) {
        Object.defineProperty(proxy, 'password', {
            value: decodeURIComponent(url.password),
            enumerable: false,
        });
    }

    return { lookup, proxy };
}

async function mutateDestination(socksProxyOptions: ParsedSocksURL, destination: SocksRemoteHost): Promise<SocksRemoteHost> {

    function lookup() {
        return new Promise<string>((resolve, reject) => {
            dns.lookup(destination.host, {}, (err, res) => {
                if (err) {
                    reject(err);

                } else {
                    resolve(res);
                }
            });
        });
    }

    if (socksProxyOptions.lookup) {
        return {
            host: await lookup(),
            port: destination.port,
        };

    } else {
        return destination;
    }
}


////////////////////////////////////////////////
//  HTTP AGENT
////////////////////////////////////////////////


class CustomAnimeoAgent extends AgentBase {

    private _agentOpts: net.NetConnectOpts;

    constructor(agentOpts: net.NetConnectOpts) {
        super();
        this._agentOpts = agentOpts;
    }

    override connect(req: http.ClientRequest, options: AgentConnectOpts): http.Agent | Duplex | Promise<http.Agent | Duplex> {
        const socket = net.createConnection(this._agentOpts);

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
}


////////////////////////////////////////////////
//  PROXY AGENTS
////////////////////////////////////////////////


export type CreateProxyServerOptions = {
    proxyConnectionUri?: string;
    listeners: {
        port: number;
        host: string;
    }[];
};

export function createProxyServer(createOptions: CreateProxyServerOptions) {
    const socksProxyOptions = createOptions.proxyConnectionUri && parseSocksURL(new URL(createOptions.proxyConnectionUri));

    const server = net.createServer({
        noDelay     : true,
        keepAlive   : true,
    });

    server.on("connection", (socket) => {
        socket.once("data", async (data) => {
            try {
                const length = 0
                    | (data[0] || 0) << 24
                    | (data[1] || 0) << 16
                    | (data[2] || 0) <<  8
                    | (data[3] || 0) <<  0;

                const payloadString = data.subarray(4, 4 + length).toString("utf8");
                const payload       = JSON.parse(payloadString);
                const extra         = data.subarray(4 + length);

                if (socksProxyOptions) {
                    const { socket: proxiedSocket } = await SocksClient.createConnection({
                        proxy       : socksProxyOptions.proxy,
                        command     : "connect",
                        destination : await mutateDestination(socksProxyOptions, payload),
                    });

                    proxiedSocket.pipe(socket);
                    proxiedSocket.write(extra);
                    socket.pipe(proxiedSocket);

                } else {
                    const proxiedSocket = net.createConnection({
                        host    : payload.host,
                        port    : payload.port,
                        noDelay : true,
                        timeout : 10_000
                    });

                    proxiedSocket.pipe(socket);
                    proxiedSocket.write(extra);
                    socket.pipe(proxiedSocket);
                }

            } catch (err: any) {
                socket.destroy();
                console.error(err);
            }
        });
    });

    for (const listener of createOptions.listeners)
        server.listen(listener.port, listener.host, () => {
            console.log(`[PROXY] Started on ${listener.host}:${listener.port}.`);
        });
}

export function createHttpProxyAgent(agentOpts: net.NetConnectOpts) {
    return new CustomAnimeoAgent(agentOpts);
}

export function createUndiciProxyAgent(agentOpts: net.NetConnectOpts) {
    return new UndiciAgent({

        connect(options, callback) {
            const undiciConnect = buildConnector({});
            const socket        = net.createConnection(agentOpts);

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
}

export function setHttpGlobalAgent(agent: CustomAnimeoAgent) {
    http.globalAgent    = agent;
    https.globalAgent   = agent;
}
