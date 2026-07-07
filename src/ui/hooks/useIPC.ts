import { useCallback, useEffect, useRef, useState } from "react";
import { DEV_BRIDGE_READY_EVENT } from "../dev-electron-shim";
import type { ServerEvent, ClientEvent } from "../types";

export function useIPC(onEvent: (event: ServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const subscribeToServerEvents = () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = window.electron.onServerEvent((event: ServerEvent) => {
        onEvent(event);
      });
      setConnected(true);
    };

    subscribeToServerEvents();
    window.addEventListener(DEV_BRIDGE_READY_EVENT, subscribeToServerEvents);

    return () => {
      window.removeEventListener(DEV_BRIDGE_READY_EVENT, subscribeToServerEvents);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setConnected(false);
    };
  }, [onEvent]);

  const sendEvent = useCallback((event: ClientEvent) => {
    window.electron.sendClientEvent(event);
  }, []);

  return { connected, sendEvent };
}