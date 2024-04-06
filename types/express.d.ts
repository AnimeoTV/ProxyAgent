import "http";
import "express";

import {
    ServerOptions,
    WebSocket,
    WebSocketServer
} from "ws";

import { SymbolTinyWs } from "../src/tinyWs.js";

export type TinyWsMiddleware = (ws: WebSocket, req: Express.Request) => void;

declare global {
    namespace Express {
        interface Application {
            ws(path: string, middleware: TinyWsMiddleware): void;
        }
    }
}

declare module "express" {
    interface Router {
        ws(path: string, middleware: TinyWsMiddleware): void;
    }

    interface Request {
        [SymbolTinyWs]?: () => Promise<WebSocket>;
    }
}

declare module "http" {
    interface IncomingMessage {
        [SymbolTinyWs]?: () => Promise<WebSocket>;
    }
}
