import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  token: string;
  onMessage?: (data: string) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  sendMessage: (data: string) => void;
  lastMessage: string | null;
  readyState: WebSocket['CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'];
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocket = ({
  url,
  token,
  onMessage,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions): UseWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [readyState, setReadyState] = useState<WebSocket['readyState']>(WebSocket.CLOSED);
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const fullUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(fullUrl);

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN);
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data);
      onMessageRef.current?.(event.data);
    };

    ws.onclose = (event) => {
      setReadyState(WebSocket.CLOSED);

      if (!event.wasClean && retryCountRef.current < reconnectAttempts) {
        retryCountRef.current++;
        setTimeout(() => {
          connect();
        }, reconnectInterval * retryCountRef.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
    setReadyState(WebSocket.CONNECTING);
  }, [url, token, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    retryCountRef.current = reconnectAttempts;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setReadyState(WebSocket.CLOSED);
  }, [reconnectAttempts]);

  const sendMessage = useCallback((data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        retryCountRef.current = reconnectAttempts;
        wsRef.current.close();
      }
    };
  }, [reconnectAttempts]);

  return {
    sendMessage,
    lastMessage,
    readyState,
    connect,
    disconnect,
  };
};