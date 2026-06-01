import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";

export type WsMessageType =
  | "JOIN"
  | "PING"
  | "PONG"
  | "INVENTORY_UPDATE"
  | "ORDER_STATUS"
  | "ORDER_NEW"
  | "ORDER_UPDATE"
  | "ERROR";

export interface WsMessage {
  type: WsMessageType;
  payload?: unknown;
}

interface ClientMeta {
  ws: WebSocket;
  room: string;
  joinedAt: Date;
}

export class SocketServer {
  private readonly wss: WebSocketServer;
  private readonly clients: Map<WebSocket, ClientMeta> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    console.log("[WS] WebSocket server initialized on /ws");
  }

  private handleConnection(ws: WebSocket): void {
    console.log("[WS] New connection");

    ws.on("message", (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, {
          type: "ERROR",
          payload: { message: "Invalid JSON message" },
        });
      }
    });

    ws.on("close", () => {
      const meta = this.clients.get(ws);
      if (meta) {
        console.log(`[WS] Client disconnected from room: ${meta.room}`);
        this.clients.delete(ws);
      }
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err.message);
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case "JOIN": {
        const { room } = msg.payload as { room: string };
        if (!room) {
          this.send(ws, {
            type: "ERROR",
            payload: { message: "JOIN requires room" },
          });
          return;
        }
        this.clients.set(ws, { ws, room, joinedAt: new Date() });
        console.log(`[WS] Client joined room: ${room}`);
        this.send(ws, { type: "PONG", payload: { room, joined: true } });
        break;
      }
      case "PING":
        this.send(ws, { type: "PONG" });
        break;
      default:
        this.send(ws, {
          type: "ERROR",
          payload: { message: `Unknown message type: ${msg.type}` },
        });
    }
  }

  private send(ws: WebSocket, msg: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  broadcastToRoom(room: string, msg: WsMessage): void {
    let count = 0;
    for (const [ws, meta] of this.clients) {
      if (meta.room === room && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        count++;
      }
    }
    console.log(`[WS] Broadcast to room "${room}" → ${count} client(s)`);
  }

  broadcastToTable(tableId: string, msg: WsMessage): void {
    this.broadcastToRoom(`table:${tableId}`, msg);
  }

  broadcastToAdmin(msg: WsMessage): void {
    this.broadcastToRoom("admin", msg);
  }

  broadcastInventoryUpdate(
    productId: string,
    stock: number,
    isAvailable: boolean,
  ): void {
    const msg: WsMessage = {
      type: "INVENTORY_UPDATE",
      payload: { productId, stock, isAvailable },
    };
    for (const [ws, meta] of this.clients) {
      if (
        ws.readyState === WebSocket.OPEN &&
        (meta.room.startsWith("table:") || meta.room === "admin")
      ) {
        ws.send(JSON.stringify(msg));
      }
    }
  }

  get connectedCount(): number {
    return this.clients.size;
  }
}
