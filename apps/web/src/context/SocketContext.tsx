import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";

const WS_URL = `ws://${globalThis.location.hostname}:3001/ws`;

type WsMessageType =
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

type WsListener = (msg: WsMessage) => void;

interface SocketContextValue {
  isConnected: boolean;
  joinRoom: (room: string) => void;
  addListener: (fn: WsListener) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WsListener>>(new Set());
  const roomRef = useRef<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);

      if (roomRef.current) {
        ws.send(
          JSON.stringify({ type: "JOIN", payload: { room: roomRef.current } }),
        );
      }

      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING" }));
        } else {
          clearInterval(ping);
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        listenersRef.current.forEach((fn) => fn(msg));
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const joinRoom = useCallback((room: string) => {
    roomRef.current = room;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "JOIN", payload: { room } }));
    }
  }, []);

  const addListener = useCallback((fn: WsListener): (() => void) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const value = React.useMemo(
    () => ({ isConnected, joinRoom, addListener }),
    [isConnected, joinRoom, addListener],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
