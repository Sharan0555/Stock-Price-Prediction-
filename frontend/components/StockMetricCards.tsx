"use client";

import { memo, useMemo } from "react";

import { useLivePrice, useLivePricePolled } from "@/hooks/useLivePrice";

interface MetricCardsProps {
  lastClose?: number;
  predictedPrice?: number;
  upsidePct?: number;
  changePct?: number;
  confidence?: number;
  signal?: "BUY" | "SELL" | "HOLD";
  symbol?: string;
  currency?: "USD" | "INR";
  loading?: boolean;
}

function fmt(val: number, currency: string) {
  return currency === "INR" ? `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${val.toFixed(2)}`;
}

function fmtPct(val: number) {
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

const StockMetricCards = memo(function StockMetricCards({
  lastClose,
  predictedPrice,
  upsidePct,
  changePct,
  confidence,
  signal,
  symbol,
  currency = "USD",
  loading = false,
}: MetricCardsProps) {
  const websocketPrice = useLivePrice(symbol);
  const polledPrice = useLivePricePolled(symbol, 5000);

  const liveState = useMemo(() => {
    const price = websocketPrice.price ?? polledPrice.price;
    const prevPrice =
      websocketPrice.price !== undefined
        ? websocketPrice.prevPrice
        : polledPrice.prevPrice;
    const ts = websocketPrice.price !== undefined ? websocketPrice.ts : polledPrice.ts;
    return {
      price,
      prevPrice,
      changePct: websocketPrice.changePct ?? polledPrice.changePct,
      ts,
      loading: Boolean(symbol) && websocketPrice.loading && polledPrice.loading,
      error: websocketPrice.error ?? polledPrice.error,
    };
  }, [polledPrice, symbol, websocketPrice]);

  const flashDirection: "up" | "down" | null =
    liveState.price !== undefined &&
    liveState.prevPrice !== undefined &&
    liveState.price !== liveState.prevPrice
      ? liveState.price > liveState.prevPrice
        ? "up"
        : "down"
      : null;

  const effectiveLastClose = liveState.price ?? lastClose;
  const effectiveChangePct = liveState.changePct ?? changePct;
  const effectiveLoading =
    loading || (Boolean(symbol) && liveState.loading && effectiveLastClose === undefined);
  const isLive = Boolean(symbol) && liveState.price !== undefined;
  const isUp = (upsidePct ?? 0) >= 0;
  const isBuy = signal === "BUY";

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}>
      {/* Current Price */}
      <div style={{
        background:
          flashDirection === "up"
            ? "linear-gradient(135deg, rgba(59, 130, 246, 0.16), var(--color-background-secondary))"
            : flashDirection === "down"
              ? "linear-gradient(135deg, rgba(191, 219, 254, 0.7), var(--color-background-secondary))"
              : "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "background 220ms ease, box-shadow 220ms ease, transform 220ms ease",
        boxShadow:
          flashDirection === "up"
            ? "0 12px 24px rgba(37, 99, 235, 0.14)"
            : flashDirection === "down"
              ? "0 10px 22px rgba(59, 130, 246, 0.1)"
              : "none",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-text-tertiary)",
        }}>
          <span>Current price</span>
          {isLive && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                className="live-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#2563eb",
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#1d4ed8", fontWeight: 700 }}>Live</span>
            </span>
          )}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--color-text-primary)",
          lineHeight: 1.2,
        }}>
          <span>{effectiveLoading ? "—" : effectiveLastClose !== undefined ? fmt(effectiveLastClose, currency) : "—"}</span>
          {isLive && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              padding: "0.2rem 0.55rem",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#1d4ed8",
              background: "rgba(59, 130, 246, 0.14)",
              border: "1px solid rgba(59, 130, 246, 0.22)",
            }}>
              LIVE
            </span>
          )}
        </div>
        {effectiveChangePct !== undefined && (
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: effectiveChangePct >= 0 ? "var(--color-text-success)" : "var(--color-text-danger)",
          }}>
            {fmtPct(effectiveChangePct)} today
          </div>
        )}
        {symbol && liveState.error && !isLive && (
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {liveState.error}
          </div>
        )}
      </div>

      {/* Predicted Price */}
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-tertiary)" }}>
          AI predicted
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
          {effectiveLoading ? "—" : predictedPrice !== undefined ? fmt(predictedPrice, currency) : "—"}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          Next 7 Days
        </div>
      </div>

      {/* Upside */}
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-tertiary)" }}>
          Potential move
        </div>
        <div style={{
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.2,
          color: effectiveLoading || upsidePct === undefined ? "var(--color-text-primary)" : isUp ? "var(--color-text-success)" : "var(--color-text-danger)",
        }}>
          {effectiveLoading ? "—" : upsidePct !== undefined ? fmtPct(upsidePct) : "—"}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          vs current price
        </div>
      </div>

      {/* Confidence */}
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-tertiary)" }}>
          Confidence
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
          {effectiveLoading ? "—" : confidence !== undefined ? `${confidence}%` : "—"}
        </div>
        {confidence !== undefined && (
          <div style={{ background: "var(--color-border-tertiary)", borderRadius: 999, height: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${confidence}%`,
              borderRadius: 999,
              background: isBuy ? "var(--color-background-success)" : "var(--color-background-danger)",
              transition: "width 0.6s ease",
            }}/>
          </div>
        )}
      </div>
      </div>
      <style jsx>{`
        @keyframes livePulse {
          0% {
            transform: scale(0.95);
            opacity: 0.75;
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35);
          }
          70% {
            transform: scale(1.15);
            opacity: 1;
            box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
          }
          100% {
            transform: scale(0.95);
            opacity: 0.75;
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }

        .live-dot {
          animation: livePulse 1.6s ease-in-out infinite;
        }
      `}</style>
    </>
  );
});

export default StockMetricCards;
