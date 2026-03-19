"use client";

interface SignalBannerProps {
  signal?: "BUY" | "SELL" | "HOLD";
  confidence?: number;
  symbol?: string;
  loading?: boolean;
}

export default function SignalBanner({ signal, confidence, symbol, loading }: SignalBannerProps) {
  if (!signal && !loading) return null;

  const isBuy = signal === "BUY";
  const isSell = signal === "SELL";

  const bg = isBuy
    ? "var(--color-background-success)"
    : isSell
    ? "var(--color-background-danger)"
    : "var(--color-background-secondary)";

  const border = isBuy
    ? "var(--color-border-success)"
    : isSell
    ? "var(--color-border-danger)"
    : "var(--color-border-secondary)";

  const textColor = isBuy
    ? "var(--color-text-success)"
    : isSell
    ? "var(--color-text-danger)"
    : "var(--color-text-secondary)";

  return (
    <div style={{
      border: `1px solid ${border}`,
      background: bg,
      borderRadius: "var(--border-radius-lg)",
      padding: "1.25rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Big signal indicator */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "var(--border-radius-md)",
          border: `1px solid ${border}`,
          background: "var(--color-background-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {loading ? (
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--color-border-secondary)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}/>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isBuy
                ? <path d="M12 19V5M5 12l7-7 7 7"/>
                : isSell
                ? <path d="M12 5v14M5 12l7 7 7-7"/>
                : <path d="M5 12h14"/>
              }
            </svg>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.15em", color: textColor, marginBottom: 4 }}>
            AI signal {symbol ? `· ${symbol}` : ""}
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color: textColor, lineHeight: 1 }}>
            {loading ? "Analyzing..." : signal ?? "—"}
          </div>
          {confidence !== undefined && (
            <div style={{ fontSize: 12, color: textColor, marginTop: 4, opacity: 0.8 }}>
              {confidence}% confidence
            </div>
          )}
        </div>
      </div>

      {/* Right side: signal explanation pill */}
      {signal && !loading && (
        <div style={{
          fontSize: 12,
          color: textColor,
          textAlign: "right",
          opacity: 0.85,
          maxWidth: 180,
          lineHeight: 1.5,
        }}>
          {isBuy
            ? "Model detects upward momentum. Consider entry at current price."
            : isSell
            ? "Model detects downward pressure. Consider reducing exposure."
            : "Mixed signals. Hold current position and monitor."}
        </div>
      )}
    </div>
  );
}
