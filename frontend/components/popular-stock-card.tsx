"use client";

import { Component, memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { PopularStockCardData, PopularStockSignal } from "@/lib/popular-stocks-service";

function formatCurrency(value: number, currency: string) {
  if (currency === "INR") {
    return `₹${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

function isMarketOpen(exchange: string): boolean {
  const now = new Date();
  if (exchange === "NSE") {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const day = parts.find((part) => part.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const totalMinutes = hour * 60 + minute;
    const isWeekday = !["Sat", "Sun"].includes(day);
    return isWeekday && totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;
  const isWeekday = !["Sat", "Sun"].includes(day);
  return isWeekday && totalMinutes >= 9 * 60 + 30 && totalMinutes <= 16 * 60;
}

function getSignalClass(signal: PopularStockSignal | null, changePct: number | null) {
  if (signal === "BUY") return "buy";
  if (signal === "SELL") return "sell";
  if (signal === "HOLD") return "hold";
  if ((changePct ?? 0) > 0.3) return "buy";
  if ((changePct ?? 0) < -0.3) return "sell";
  return "hold";
}

function StockCardFallback({ stock }: { stock: PopularStockCardData }) {
  return (
    <div className="popular-card hold h-full rounded-2xl p-3.5 md:p-4">
      <div className="popular-sheen" aria-hidden="true" />
      <div className="mb-3">
        <h3 className="text-base font-bold text-[var(--ink)]">{stock.name}</h3>
        <div className="mt-1 text-xs text-[var(--ink-muted)]">
          {stock.symbol} · {stock.exchange}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 p-3 text-sm text-[var(--ink-muted)]">
        This stock card hit a rendering issue. Refresh to reload it without affecting the rest.
      </div>
    </div>
  );
}

class StockCardErrorBoundary extends Component<
  { stock: PopularStockCardData; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { stock: PopularStockCardData; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { stock: PopularStockCardData }) {
    if (prevProps.stock.symbol !== this.props.stock.symbol && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <StockCardFallback stock={this.props.stock} />;
    }

    return this.props.children;
  }
}

const StockCardBody = memo(function StockCardBody({
  stock,
}: {
  stock: PopularStockCardData;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const derived = useMemo(() => {
    // Defer isMarketOpen to client-side to prevent hydration mismatch
    const isLive = isMounted ? isMarketOpen(stock.exchange) : false;
    const price = stock.price;
    const changePct = stock.changePct;
    const signal = stock.signal ?? null;
    const signalClass = getSignalClass(signal, changePct);
    const sparkHeights = Array.from({ length: 8 }, (_, index) => {
      const seed =
        stock.symbol.length * 31 +
        index * 17 +
        Math.round(Math.abs(stock.predictionChangePct ?? changePct ?? 0) * 10);
      return 20 + (seed % 60);
    });

    return {
      isLive,
      price,
      changePct,
      signal,
      signalClass,
      sparkHeights,
      predictionReady: typeof stock.predictedPrice === "number",
      isUp: (changePct ?? 0) >= 0,
      predictionUp: (stock.predictionChangePct ?? 0) >= 0,
    };
  }, [stock, isMounted]);

  const handleClick = useCallback(() => {
    router.push(`/stocks?q=${stock.symbol}`);
  }, [router, stock.symbol]);

  const predictionValue = derived.predictionReady
    ? formatCurrency(stock.predictedPrice as number, stock.currency)
    : "Calculating...";
  const predictionMeta = derived.predictionReady
    ? `${derived.predictionUp ? "↑" : "↓"} ${derived.predictionUp ? "+" : ""}${(
        stock.predictionChangePct ?? 0
      ).toFixed(2)}%`
    : stock.predictionError && stock.predictionError !== "Calculating..."
      ? "Using the last known prediction"
      : "Model refresh in progress";

  return (
    <div
      className={`tilt-card popular-card ${derived.signalClass} h-full rounded-2xl p-3.5 md:p-4 flex flex-col cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="popular-sheen" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3 min-h-[52px] mb-3">
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-bold text-[var(--ink)] mb-1 truncate dark:text-gray-100"
            title={stock.name}
          >
            {stock.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] min-w-0 dark:text-gray-400">
            <span className="font-mono font-semibold text-[var(--ink)] dark:text-gray-200">
              {stock.symbol}
            </span>
            <span>·</span>
            <span className="dark:text-gray-400">{stock.exchange}</span>
            <span className={`live-indicator ${derived.isLive ? "" : "closed"} dark:bg-gray-700 dark:text-gray-300`}>
              {derived.isLive ? "LIVE" : "CLOSED"}
            </span>
          </div>
        </div>
        <span className={`signal-badge ${derived.signalClass} shrink-0`}>
          {derived.signal ?? "HOLD"}
        </span>
      </div>

      <div className="mb-3 min-h-[66px]">
        <div className="price-display text-tabular text-[var(--ink)] dark:text-gray-100">
          {derived.price !== null ? formatCurrency(derived.price, stock.currency) : "Loading..."}
        </div>
        <div className={`price-change ${derived.isUp ? "positive" : "negative"}`}>
          {derived.changePct !== null ? (
            <>
              {derived.isUp ? "↑" : "↓"} {derived.isUp ? "+" : ""}
              {derived.changePct.toFixed(2)}%
            </>
          ) : (
            "Waiting for live quote"
          )}
        </div>
      </div>

      <div className="mb-4 min-h-[88px]">
        <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)] mb-1 dark:text-gray-400">
          Prediction
        </div>
        <div className="text-lg font-semibold text-[var(--ink)] mb-1 text-tabular dark:text-gray-200">
          {predictionValue}
        </div>
        <div className={`text-sm ${derived.predictionUp ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {predictionMeta}
        </div>
        {stock.predictionError && stock.predictionError !== "Calculating..." && (
          <div className="mt-1 text-xs text-[var(--ink-muted)]">{stock.predictionError}</div>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex-1 h-8 flex items-end gap-1 min-w-0">
          {derived.sparkHeights.map((height, index) => (
            <div
              key={index}
              className={`flex-1 rounded-sm spark-bar ${derived.signalClass}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="text-xs text-[var(--ink-muted)] font-semibold shrink-0 tabular-nums dark:text-gray-400">
          {stock.confidence !== null ? `${Math.round(stock.confidence)}%` : "ML"}
        </div>
      </div>
    </div>
  );
});

export function PopularStockCard({ stock }: { stock: PopularStockCardData }) {
  return (
    <StockCardErrorBoundary stock={stock}>
      <StockCardBody stock={stock} />
    </StockCardErrorBoundary>
  );
}
