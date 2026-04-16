"use client";

import { memo } from "react";

interface Strategy {
  side: "BUY" | "SELL";
  entry?: [number, number];
  target?: number;
  stop?: number;
  zone?: [number, number];
  expected?: number;
  horizon?: string;
}

interface StrategyCardProps {
  strategy?: Strategy | null;
  currency?: "USD" | "INR";
}

function fmt(val: number, currency: string) {
  return currency === "INR"
    ? `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toFixed(2)}`;
}

const Row = memo(function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "0.5px solid var(--color-border-tertiary)",
    }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: highlight ? "var(--color-text-primary)" : "var(--color-text-primary)",
      }}>
        {value}
      </span>
    </div>
  );
});

const StrategyCard = memo(function StrategyCard({ strategy, currency = "USD" }: StrategyCardProps) {
  if (!strategy) {
    return (
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1.25rem",
        fontSize: 13,
        color: "var(--color-text-tertiary)",
        minHeight: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        Search a stock to generate a strategy.
      </div>
    );
  }

  const isBuy = strategy.side === "BUY";

  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-background-secondary)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-secondary)" }}>
          {isBuy ? "Buy strategy" : "Sell strategy"}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          padding: "3px 10px",
          borderRadius: 999,
          background: isBuy ? "var(--color-background-success)" : "var(--color-background-danger)",
          color: isBuy ? "var(--color-text-success)" : "var(--color-text-danger)",
          border: `0.5px solid ${isBuy ? "var(--color-border-success)" : "var(--color-border-danger)"}`,
        }}>
          {strategy.side}
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: "0 16px" }}>
        {isBuy && strategy.entry && (
          <Row label="Entry zone" value={`${fmt(strategy.entry[0], currency)} – ${fmt(strategy.entry[1], currency)}`} />
        )}
        {!isBuy && strategy.zone && (
          <Row label="Sell zone" value={`${fmt(strategy.zone[0], currency)} – ${fmt(strategy.zone[1], currency)}`} />
        )}
        {isBuy && strategy.target !== undefined && (
          <Row label="Target price" value={fmt(strategy.target, currency)} highlight />
        )}
        {!isBuy && strategy.expected !== undefined && (
          <Row label="Expected drop to" value={fmt(strategy.expected, currency)} highlight />
        )}
        {strategy.stop !== undefined && (
          <Row label="Stop loss" value={fmt(strategy.stop, currency)} />
        )}
        {strategy.horizon && (
          <Row label="Time horizon" value={strategy.horizon} />
        )}
      </div>
    </div>
  );
});

export default StrategyCard;
