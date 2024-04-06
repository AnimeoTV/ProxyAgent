import Agent            from "./agent.js";
import * as Discord     from "discord.js";
import express          from "express";
import { WebSocket }    from "ws";
import APIs             from "apis";
import { tinyWs }       from "./tinyWs.js";

const app = express();

// Disable server tokens.
app.disable("x-powered-by");

// Handle WebSocket connections.
tinyWs({ app });

const Authorizations = new Map([
    [ "Blendship:1225194127126171838", "MTIyNTE5NDEyNzEyNjE3MTgzOA.Ghnlk1.uvJDqW3_kiieINwvuAi0BAAyQDoZ0awKm8alHg" ],
]);

app.ws("/", (ws, req: any) => {

    // @TODO: We need to find a good way to handle this link to prevent bugs.
    const DiscordWebSocket = new WebSocket(`wss://gateway.discord.gg/${req.url.substring(1)}`);

    DiscordWebSocket.on("message", (message, isBinary) => {
        const payload = JSON.parse(message.toString("utf8"));

        if (payload.op === 0 && payload.t === "READY") {
            payload.d.resume_gateway_url = `ws://127.0.0.1:7212`;
            return ws.send(JSON.stringify(payload));
        }

        console.log("[SERVER]", message.toString("utf8"));
        ws.send(message, { binary: isBinary });
    });

    DiscordWebSocket.on("close", (code, reason) => {
        console.log("[SERVER] DISCONNECTED.", code, reason.toString("utf8"));
        ws.close(code, reason);
    });

    ws.on("close", (code, reason) => {
        console.log("[CLIENT] DISCONNECTED.", code, reason.toString("utf8"));
        DiscordWebSocket.close(code, reason);
    })

    ws.on("message", (message, isBinary) => {
        const payload = JSON.parse(message.toString("utf8"));

        console.log(payload);

        if (payload.op === 2 || payload.op === 6) {
            const realAuthorization = Authorizations.get(payload.d.token)

            if (realAuthorization) {
                payload.d.token = realAuthorization;

                return DiscordWebSocket.send(JSON.stringify(payload));

            } else {
                return ws.close(4004);
            }
        }

        DiscordWebSocket.send(message, { binary: isBinary });
    });

    // setInterval(() => {
    //     DiscordWebSocket.close(4000);
    //     ws.send(JSON.stringify({ op: 7 }))
    // }, 5_000);
});

app.use(async (req, res, next) => {

    // Delete host header.
    delete req.headers["host"];

    if (req.headers["authorization"]) {
        const parts             = req.headers["authorization"].split(" ") as [ string, string | undefined ];
        const realAuthorization = Authorizations.get(parts[1] ? parts[1] : parts[0]);

        if (!realAuthorization)
            return res.status(401).json({
                error: {
                    message : "401: Unauthorized",
                    code    : 0,
                },
            });

        req.headers["authorization"] = parts[1]
            ? `${parts[0]} ${realAuthorization}`
            : realAuthorization;
    }

    console.log("[HTTPS]", `https://discord.com/api/${req.path.substring(1)}`, req.headers);

    const response = await APIs.fetch(req.method, `https://discord.com/api/${req.path.substring(1)}`, {
        headers: req.headers,
    })
        .then(async (res) => ({
            statusCode  : res.statusCode as number,
            headers     : res.headers,
            body        : await res.raw(),
        }));

    // Override WebSocket destination.
    if (/^\/v[0-9]+\/gateway\/bot$/.test(req.path)) {
        const data = JSON.parse(response.body.toString("utf8"));

        data.url        = `ws://127.0.0.1:7212`;
        response.body   = Buffer.from(JSON.stringify(data), "utf8");
    }

    if (response.statusCode === 429) {
        console.error(response);
        return;
    }

    res.status(response.statusCode);

    delete response.headers["range"];
    delete response.headers["transfer-encoding"];
    delete response.headers["content-length"];
    delete response.headers["content-range"];
    delete response.headers["location"];

    for (const [ name, value ] of Object.entries(response.headers))
        res.header(name, value);

    return res.send(response.body);
});

app.listen(7212, "127.0.0.1", () => {
    console.log("[EXPRESS] Discord proxy started.");
});

process.on("uncaughtException"  , console.error);
process.on("unhandledRejection" , console.error);

const client = new Discord.Client({
    intents: [ "Guilds" ],
    rest: {
        api     : "http://127.0.0.1:7212",
        agent   : Agent.undiciProxyAgent,
    },
});

client.login("Blendship:1225194127126171838");
