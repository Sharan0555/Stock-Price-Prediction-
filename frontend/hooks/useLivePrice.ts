"use client";

import { useEffect, useState, useCallback } from "react";

import { fetchJsonWithFallback, getApiBaseUrl } from "@/lib/api-base";

export type LivePriceState = {
  currentSymbol?: string;
  price?: number;
  prevPrice?: number;
  changePct?: number;
  ts?: number;
  loading: boolean;
  error?: string;
};

type LivePriceResponse = {
  symbol: string;
  price: number;
  change_pct?: number | null;
  volume?: number | null;
  ts: number;
  source: string;
};

type QuoteResponse = {
  symbol: string;
  quote: {
    c: number;
    pc: number;
  };
  source: string;
};

function toWebSocketBase(baseUrl: string): string {
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}`;
  }
  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  }
  return baseUrl;
}

function toStateUpdate(
  previous: LivePriceState,
  payload: LivePriceResponse,
  currentSymbol: string,
): LivePriceState {
  return {
    currentSymbol,
    price: payload.price,
    prevPrice: previous.price,
    changePct:
      typeof payload.change_pct === "number" ? payload.change_pct : previous.changePct,
    ts: payload.ts,
    loading: false,
    error: undefined,
  };
}

export function useLivePrice(symbol?: string): LivePriceState {
  const [state, setState] = useState<LivePriceState>({
    currentSymbol: symbol,
    loading: Boolean(symbol),
  });

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let active = true;
    let reconnectTimer: number | undefined;
    let socket: WebSocket | null = null;

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as LivePriceResponse;
        setState((previous) => toStateUpdate(previous, payload, symbol));
      } catch {
        setState((previous) => ({
          ...previous,
          currentSymbol: symbol,
          loading: previous.price === undefined,
          error: "Invalid live price payload.",
        }));
      }
    };

    const handleError = () => {
      if (!active) return;
      setState((previous) => ({
        ...previous,
        currentSymbol: symbol,
        loading: previous.price === undefined,
        error: "Live feed connection failed.",
      }));
    };

    const handleClose = () => {
      if (!active) return;
      reconnectTimer = window.setTimeout(connect, 3000);
    };

    const connect = () => {
      if (!active) return;

      const wsBase = toWebSocketBase(getApiBaseUrl());
      socket = new WebSocket(
        `${wsBase}/api/v1/stocks/ws/${encodeURIComponent(symbol)}`,
      );

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
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket) {
        socket.close();
      }
    };
  }, [symbol]);

  if (!symbol) {
    return { loading: false };
  }
  if (state.currentSymbol !== symbol) {
    return { loading: true };
  }
  return state;
}

export function useLivePricePolled(
  symbol?: string,
  intervalMs: number = 5000,
): LivePriceState {
  const [state, setState] = useState<LivePriceState>({
    currentSymbol: symbol,
    loading: Boolean(symbol),
  });

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const payload = await fetchJsonWithFallback<QuoteResponse>(
          `/api/v1/stocks/${encodeURIComponent(symbol)}/quote`,
        );
        if (cancelled) return;
        const current = payload.quote?.c;
        const prevClose = payload.quote?.pc;
        const normalized: LivePriceResponse = {
          symbol: payload.symbol,
          price: current,
          change_pct:
            prevClose && prevClose !== 0
              ? ((current - prevClose) / prevClose) * 100
              : undefined,
          ts: Math.floor(Date.now() / 1000),
          source: payload.source ?? "quote",
        };
        setState((previous) => toStateUpdate(previous, normalized, symbol));
      } catch (error) {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          currentSymbol: symbol,
          loading: previous.price === undefined,
          error:
            error instanceof Error ? error.message : "Unable to load live price.",
        }));
      }
    };

    void fetchPrice();
    const interval = window.setInterval(() => {
      void fetchPrice();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [intervalMs, symbol]);

  if (!symbol) {
    return { loading: false };
  }
  if (state.currentSymbol !== symbol) {
    return { loading: true };
  }
  return state;
}
