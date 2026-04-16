"use client";

import { memo, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot, CartesianGrid } from "recharts";

type HistoryPoint = { t: number; c: number };

interface PriceChartProps {
  series: HistoryPoint[];
  predictedPrice?: number;
  currency?: "USD" | "INR";
  signal?: "BUY" | "SELL" | "HOLD";
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(val: number, currency: string) {
  return currency === "INR" ? `₹${val.toFixed(2)}` : `$${val.toFixed(2)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  currency: string;
}

const CustomTooltip = memo(function CustomTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 12,
      color: "var(--color-text-primary)",
    }}>
      <div style={{ color: "var(--color-text-tertiary)", marginBottom: 2 }}>
        {label ? formatDate(label) : ""}
      </div>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
        {formatPrice(payload[0].value, currency)}
      </div>
    </div>
  );
});

const PriceChart = memo(function PriceChart({ series, predictedPrice, currency = "USD", signal }: PriceChartProps) {
  if (!series || series.length === 0) return <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-tertiary)", fontSize:13 }}>No chart data available</div>;
  const prices = series.map(p => p.c);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const lastPrice = prices[prices.length - 1];
  const padding = (maxPrice - minPrice) * 0.1 || lastPrice * 0.01;
  const yMin = Math.floor(minPrice - padding);
  const yMax = Math.ceil(Math.max(maxPrice, predictedPrice ?? maxPrice) + padding);
  const chartData = series.map(p => ({ t: p.t, price: p.c }));
  const accentColor = signal === "BUY" ? "#059669" : signal === "SELL" ? "#dc2626" : "#534AB7";
  const lastTs = series[series.length - 1]?.t ?? 0;
  const predTs = lastTs + 86400;
  return (
    <div style={{ width:"100%", height:220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top:8, right:16, left:0, bottom:0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accentColor} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={accentColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
          <XAxis dataKey="t" tickFormatter={formatDate} tick={{ fontSize:11, fill:"var(--color-text-tertiary)" }} tickLine={false} axisLine={false} interval={Math.floor(series.length / 5)}/>
          <YAxis domain={[yMin, yMax]} tickFormatter={(v) => formatPrice(v, currency)} tick={{ fontSize:11, fill:"var(--color-text-tertiary)" }} tickLine={false} axisLine={false} width={currency === "INR" ? 72 : 64}/>
          <Tooltip content={<CustomTooltip currency={currency}/>} cursor={{ stroke:"var(--color-border-secondary)", strokeWidth:1, strokeDasharray:"4 4" }}/>
          <Area type="monotone" dataKey="price" stroke={accentColor} strokeWidth={1.5} fill="url(#priceGrad)" dot={false} activeDot={{ r:4, fill:accentColor, strokeWidth:0 }}/>
          {predictedPrice !== undefined && <>
            <ReferenceLine x={lastTs} stroke="var(--color-border-secondary)" strokeDasharray="4 4" strokeWidth={1}/>
            <ReferenceDot x={predTs} y={predictedPrice} r={6} fill={accentColor} stroke="var(--color-background-primary)" strokeWidth={2} label={{ value:formatPrice(predictedPrice, currency), position: predictedPrice >= lastPrice ? "top" : "bottom", fontSize:11, fill:accentColor, fontWeight:500 }}/>
          </>}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default PriceChart;
