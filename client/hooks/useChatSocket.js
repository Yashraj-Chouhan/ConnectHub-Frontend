/*
 * WebSocket/STOMP hook used by the chat page.
 *
 * It owns connection lifecycle, room/user subscriptions, and a tiny publish API
 * so the UI can send typing/read/message events without dealing with raw STOMP.
 */
import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_BASE_URL } from "@/lib/api";

// Creates one reconnecting STOMP client per signed-in user.
export function useChatSocket(userId) {
  const clientRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
      connectHeaders: {
        userId: String(userId),
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });

    client.onConnect = () => {
      setConnected(true);
    };
    client.onWebSocketClose = () => {
      setConnected(false);
    };
    client.onStompError = () => {
      setConnected(false);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [userId]);

  const publish = (destination, payload) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      throw new Error("Chat connection is not ready yet.");
    }

    client.publish({
      destination,
      body: JSON.stringify(payload),
    });
  };

  return {
    clientRef,
    connected,
    publish,
  };
}
