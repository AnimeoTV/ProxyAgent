import "http";
import "express";

import {
    ServerOptions,
    WebSocket,
    WebSocketServer
} from "ws";

import { SymbolTinyWs } from "../src/tinyWs.js";

export type TinyWsMiddleware = (ws: WebSocket, req: Express.Request) => void;

declare module "@types/express-serve-static-core" {
    interface IRouter {
        ws(path: string, middleware: TinyWsMiddleware): void;
    }
}

declare module "express" {
    interface Request {
        [SymbolTinyWs]?: () => Promise<WebSocket>;
    }
}

declare module "http" {
    interface IncomingMessage {
        [SymbolTinyWs]?: () => Promise<WebSocket>;
    }
}
