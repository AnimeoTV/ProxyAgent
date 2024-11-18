import net      from "net";
import http     from "http";
import Express  from "express";

import type {
    TinyWsMiddleware
} from "../types/express.js";

import {
    ServerOptions,
    WebSocket,
    WebSocketServer
} from "ws";


//////////////////////////////////////
//  TYPES
//////////////////////////////////////


type TinyWsOptions = {
    app         : Express.Application;
    wsOptions?  : ServerOptions;
    server?     : http.Server;
    router?     : Express.Router;
};

export const SymbolTinyWs = Symbol("tinyWs");


//////////////////////////////////////
//  WEBSOCKET GLOBAL
//////////////////////////////////////


function attachCustomMethod(router: Express.Router) {
    function handleCustomMethod(path: string, middleware: TinyWsMiddleware) {

        async function handleRequest(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
            const upgradeWebSocket = req[SymbolTinyWs];

            if (upgradeWebSocket) {

                // @TODO: Is there any other way to push "error" to express ?
                // Instead of awaiting ?
                await upgradeWebSocket()
                    .then((ws: WebSocket) => middleware(ws, req));

            } else {
                next();
            }
        }

        router.get(path, handleRequest);
    }

    router.ws = handleCustomMethod;
}


//////////////////////////////////////
//  WEBSOCKET EXPRESS
//////////////////////////////////////


export function tinyWs(options: TinyWsOptions) {
    options.wsOptions ||= {};

    if (options.app) {
        const wss = new WebSocketServer({ ...options.wsOptions, noServer: true });

        // Create a new HTTP server.
        if (!options.server) {
            options.server = http.createServer(options.app);

            options.app.listen = (...args: any[]): http.Server => {
                return options.server!.listen(...args);
            };
        }

        // Handle upgrade requests.
        // "socket" is guaranteed to be a "net.Socket" according to "https://nodejs.org/api/http.html#event-upgrade_1".
        options.server.on("upgrade", async (req: http.IncomingMessage, socket: net.Socket, upgradeHead: Buffer) => {
            const res   = new http.ServerResponse(req);
            const head  = Buffer.alloc(upgradeHead.length);

            // From "express-websocket":
            //    avoid hanging onto upgradeHead as this will keep the entire
            //    slab buffer used by node alive
            upgradeHead.copy(head);

            // Attach response socket.
            res.assignSocket(socket);

            // Destroy socket when finish.
            res.on("finish", () => res.socket?.destroy());

            // Handle upgrade.
            req[SymbolTinyWs] = () => {
                return new Promise((resolve) => {
                    wss.handleUpgrade(req, req.socket, head, (ws) => {

                        // Resolve socket.
                        resolve(ws);
                    });
                });
            };

            // Let express handle the request.
            options.app(req, res);
        });

        // Attach ".ws" method.
        attachCustomMethod(options.app);

    } else if (options.router) {

        // Attach ".ws" method.
        attachCustomMethod(options.router);
    }
}
