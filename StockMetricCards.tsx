"use client";

interface MetricCardsProps {
  lastClose?: number;
  predictedPrice?: number;
  upsidePct?: number;
  changePct?: number;
  confidence?: number;
  signal?: "BUY" | "SELL" | "HOLD";
  currency?: "USD" | "INR";
  loading?: boolean;
}

function fmt(val: number, currency: string) {
  return currency === "INR" ? `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${val.toFixed(2)}`;
}

function fmtPct(val: number) {
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

export default function StockMetricCards({
  lastClose,
  predictedPrice,
  upsidePct,
  changePct,
  confidence,
  signal,
  currency = "USD",
  loading = false,
}: MetricCardsProps) {
  const isUp = (upsidePct ?? 0) >= 0;
  const isBuy = signal === "BUY";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 12,
    }}>
      {/* Current Price */}
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-text-tertiary)" }}>
          Current price
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
          {loading ? "—" : lastClose !== undefined ? fmt(lastClose, currency) : "—"}
        </div>
        {changePct !== undefined && (
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: changePct >= 0 ? "var(--color-text-success)" : "var(--color-text-danger)",
          }}>
            {fmtPct(changePct)} today
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
          {loading ? "—" : predictedPrice !== undefined ? fmt(predictedPrice, currency) : "—"}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          next session
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
          color: loading || upsidePct === undefined ? "var(--color-text-primary)" : isUp ? "var(--color-text-success)" : "var(--color-text-danger)",
        }}>
          {loading ? "—" : upsidePct !== undefined ? fmtPct(upsidePct) : "—"}
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
          {loading ? "—" : confidence !== undefined ? `${confidence}%` : "—"}
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
  );
}
