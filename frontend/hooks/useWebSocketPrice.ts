"use client";

import { useEffect, useState, useCallback } from "react";

import { getWebSocketBaseUrl } from "@/lib/api-base";

export type WebSocketPriceState = {
  currentSymbol?: string;
  price?: number;
  changePct?: number;
  ts?: number;
  source?: string;
  loading: boolean;
  connected: boolean;
  error?: string;
};

type PricePayload = {
  symbol: string;
  price: number;
  change_pct?: number | null;
  ts: number;
  source: string;
};

export function useWebSocketPrice(symbol?: string): WebSocketPriceState {
  const [state, setState] = useState<WebSocketPriceState>({
    currentSymbol: symbol,
    loading: Boolean(symbol),
    connected: false,
  });

  useEffect(() => {
    if (!symbol) {
      setState({ loading: false, connected: false });
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const handleOpen = () => {
      if (!active) {
        return;
      }
      setState((previous) => ({
        ...previous,
        currentSymbol: symbol,
        connected: true,
        loading: previous.price === undefined,
        error: undefined,
      }));
    };

    const handleMessage = (event: MessageEvent) => {
      if (!active) {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as PricePayload;
        setState({
          currentSymbol: symbol,
          price: payload.price,
          changePct:
            typeof payload.change_pct === "number"
              ? payload.change_pct
              : undefined,
          ts: payload.ts,
          source: payload.source,
          loading: false,
          connected: true,
          error: undefined,
        });
      } catch {
        setState((previous) => ({
          ...previous,
          currentSymbol: symbol,
          loading: previous.price === undefined,
          connected: false,
          error: "Invalid websocket payload.",
        }));
      }
    };

    const handleError = () => {
      if (!active) {
        return;
      }
      setState((previous) => ({
        ...previous,
        currentSymbol: symbol,
        connected: false,
        loading: previous.price === undefined,
        error: "Live websocket connection failed.",
      }));
    };

    const handleClose = () => {
      if (!active) {
        return;
      }
      setState((previous) => ({
        ...previous,
        currentSymbol: symbol,
        connected: false,
      }));
      reconnectTimer = window.setTimeout(connect, 3000);
    };

    const connect = () => {
      if (!active) {
        return;
      }

      const base = getWebSocketBaseUrl();
      socket = new WebSocket(
        `${base}/api/v1/ws/prices/${encodeURIComponent(symbol)}`,
      );

      socket.onopen = handleOpen;
      socket.onmessage = handleMessage;
      socket.onerror = handleError;
      socket.onclose = handleClose;
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [symbol]);

  return state.currentSymbol === symbol ? state : { loading: true, connected: false };
}
