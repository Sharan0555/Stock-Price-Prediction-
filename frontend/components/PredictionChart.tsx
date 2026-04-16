"use client";

import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useWebSocketPrice } from "@/hooks/useWebSocketPrice";

type HistoryPoint = {
  t: number;
  c: number;
};

type PredictionChartProps = {
  symbol?: string;
  series: HistoryPoint[];
  predictedPrice?: number;
  currency?: "USD" | "INR";
  signal?: "BUY" | "SELL" | "HOLD";
};

const formatDate = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatMoney = (value: number, currency: "USD" | "INR") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "INR" ? "INR" : "USD",
    maximumFractionDigits: 2,
  }).format(value);

const PredictionChart = memo(function PredictionChart({
  symbol,
  series,
  predictedPrice,
  currency = "USD",
  signal = "HOLD",
}: PredictionChartProps) {
  const live = useWebSocketPrice(symbol);

  if (!symbol || series.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--ink-muted)]">
        {symbol
          ? "Prediction chart unavailable for this symbol."
          : "Select a stock to load its prediction chart."}
      </div>
    );
  }

  const liveTs =
    typeof live.ts === "number" && live.ts > 10_000_000_000
      ? Math.floor(live.ts / 1000)
      : live.ts;

  const points = [...series];
  const lastPoint = points[points.length - 1];
  if (
    live.price !== undefined &&
    liveTs !== undefined &&
    (!lastPoint || liveTs > lastPoint.t || live.price !== lastPoint.c)
  ) {
    points.push({ t: liveTs, c: live.price });
  }

  const chartData = points.map((point) => ({
    ...point,
    label: formatDate(point.t),
  }));
  const prices = chartData.map((point) => point.c);
  const currentPrice = live.price ?? prices[prices.length - 1];
  const accent =
    signal === "BUY" ? "#0f766e" : signal === "SELL" ? "#dc2626" : "#1d4ed8";
  const maxValue = Math.max(...prices, predictedPrice ?? prices[prices.length - 1]);
  const minValue = Math.min(...prices, predictedPrice ?? prices[prices.length - 1]);
  const padding = (maxValue - minValue) * 0.12 || maxValue * 0.05 || 1;
  const predictedDelta =
    predictedPrice !== undefined && currentPrice
      ? ((predictedPrice - currentPrice) / currentPrice) * 100
      : undefined;

  return (
    <div>
      <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 dark:bg-gray-800 dark:border-gray-600">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-muted)]">
              Prediction View
            </div>
            <h3 className="mt-1 font-display text-xl text-[var(--ink)]">
              {symbol} outlook
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[var(--border)] bg-[var(--paper-strong)] px-3 py-1 text-[var(--ink-soft)]">
              Feed: {live.connected ? "Connected" : live.loading ? "Connecting" : "Retrying"}
            </span>
            {predictedDelta !== undefined && (
              <span
                className="rounded-full px-3 py-1 font-medium"
                style={{
                  backgroundColor:
                    predictedDelta >= 0 ? "rgba(15,118,110,0.12)" : "rgba(220,38,38,0.12)",
                  color: predictedDelta >= 0 ? "#0f766e" : "#b91c1c",
                }}
              >
                {predictedDelta >= 0 ? "+" : ""}
                {predictedDelta.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3 transition-all duration-300 hover:shadow-md">
            <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              Live price
            </div>
            <div className="mt-1 font-display text-2xl text-[var(--ink)] transition-all duration-300">
              {formatMoney(currentPrice, currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3 transition-all duration-300 hover:shadow-md">
            <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              Model target
            </div>
            <div className="mt-1 font-display text-2xl text-[var(--ink)] transition-all duration-300">
              {predictedPrice !== undefined ? formatMoney(predictedPrice, currency) : "—"}
            </div>
          </div>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="prediction-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--color-border-tertiary)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={[minValue - padding, maxValue + padding]}
                tickFormatter={(value) => formatMoney(Number(value), currency)}
                tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
                tickLine={false}
                axisLine={false}
                width={88}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatMoney(value, currency) : "—"
                }
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.t ? formatDate(payload[0].payload.t) : ""
                }
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.96)",
                }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke={accent}
                strokeWidth={2}
                fill="url(#prediction-area)"
                dot={false}
                activeDot={{ r: 4, fill: accent }}
                animationDuration={1000}
                animationEasing="ease-in-out"
                isAnimationActive={true}
              />
              {predictedPrice !== undefined && (
                <ReferenceDot
                  x={chartData[chartData.length - 1]?.label}
                  y={predictedPrice}
                  r={6}
                  fill={accent}
                  stroke="var(--paper-strong)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {live.error && (
          <p className="mt-3 text-xs text-[var(--ink-muted)]">{live.error}</p>
        )}
      </div>
    </div>
  );
});

export default PredictionChart;
