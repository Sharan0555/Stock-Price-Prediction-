"use client";

import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";

interface TickerCardProps {
  sym: string;
  price: number;
  chg: number;
  up: boolean;
  currency: "USD" | "INR";
  marketOpen: boolean;
}

const CARD_BG = "#fffaf6";
const CARD_BORDER = "#e8ddd0";
const TEXT_PRIMARY = "#1a0f00";
const BULLISH = "#2e7d32";
const BEARISH = "#c62828";

const formatPrice = (value: number, currency: "USD" | "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);

const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const buildSeedSpark = (price: number, up: boolean) =>
  Array.from({ length: 10 }, (_, index) => {
    const slope = up ? index - 4.5 : 4.5 - index;
    return price * (1 + slope * 0.0035);
  });

const TickerCard = memo(function TickerCard({
  sym,
  price,
  chg,
  up,
  currency,
  marketOpen,
}: TickerCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<number[]>(buildSeedSpark(price, up));
  const lastPriceRef = useRef<number>(price);
  const lastSymbolRef = useRef<string>(sym);

  useEffect(() => {
    if (lastSymbolRef.current !== sym) {
      sparkRef.current = buildSeedSpark(price, up);
      lastPriceRef.current = price;
      lastSymbolRef.current = sym;
      return;
    }

    if (!sparkRef.current.length) {
      sparkRef.current = buildSeedSpark(price, up);
      lastPriceRef.current = price;
      return;
    }

    if (marketOpen && Math.abs(lastPriceRef.current - price) >= 0.005) {
      sparkRef.current = [...sparkRef.current.slice(-9), price];
      lastPriceRef.current = price;
      return;
    }

    if (!marketOpen && lastPriceRef.current !== price) {
      // Freeze at the last known market-close value.
      lastPriceRef.current = price;
    }
  }, [sym, price, up, marketOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawSpark = () => {
      const W = canvas.width;
      const H = canvas.height;
      const spark = sparkRef.current.length ? sparkRef.current : buildSeedSpark(price, up);
      const mn = Math.min(...spark);
      const mx = Math.max(...spark);
      const range = Math.max(mx - mn, 1);
      const sx = W / Math.max(spark.length - 1, 1);
      const sy = (value: number) => H - ((value - mn) / range) * H * 0.82 - H * 0.08;
      const color = up ? BULLISH : BEARISH;

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      spark.forEach((value, index) => {
        const x = index * sx;
        const y = sy(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, up ? "rgba(46,125,50,0.14)" : "rgba(198,40,40,0.14)");
      grad.addColorStop(1, "rgba(240,232,220,0)");
      ctx.lineTo((spark.length - 1) * sx, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    };

    drawSpark();
  }, [price, up, marketOpen]);

  const color = up ? BULLISH : BEARISH;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 1px 4px rgba(100,60,20,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: TEXT_PRIMARY,
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          {sym}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: 0.5,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 10,
              color: marketOpen ? BULLISH : "#888",
              background: marketOpen ? "rgba(46,125,50,0.08)" : "rgba(0,0,0,0.04)",
              border: `0.5px solid ${
                marketOpen ? "rgba(46,125,50,0.3)" : "rgba(0,0,0,0.1)"
              }`,
            }}
          >
            {marketOpen ? "● LIVE" : "● CLOSED"}
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color,
              fontFamily: "monospace",
              background: up ? "rgba(46,125,50,0.08)" : "rgba(198,40,40,0.08)",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {formatChange(chg)}
          </span>
        </div>
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 24,
          color: TEXT_PRIMARY,
          fontFamily: "system-ui",
          letterSpacing: -0.5,
        }}
      >
        {formatPrice(price, currency)}
      </div>
      <div
        style={{
          height: 2,
          background: CARD_BORDER,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(88, Math.max(24, 56 + chg * 4))}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={55}
        style={{ width: "100%", height: 55 }}
      />
    </div>
  );
});

export default TickerCard;
