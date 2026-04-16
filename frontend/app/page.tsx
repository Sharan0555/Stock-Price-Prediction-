"use client";

import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SkeletonStockCard } from "@/components/skeleton";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001';

const STOCKS = [
  { name: 'Apple',               symbol: 'AAPL',      apiSymbol: 'AAPL',          exchange: 'NYSE', currency: 'USD' },
  { name: 'Microsoft',           symbol: 'MSFT',      apiSymbol: 'MSFT',          exchange: 'NYSE', currency: 'USD' },
  { name: 'Reliance Industries', symbol: 'RELIANCE',  apiSymbol: 'RELIANCE.NSE',  exchange: 'NSE', currency: 'INR' },
  { name: 'TCS',                 symbol: 'TCS',       apiSymbol: 'TCS.NSE',       exchange: 'NSE', currency: 'INR' },
  { name: 'Amazon',              symbol: 'AMZN',      apiSymbol: 'AMZN',          exchange: 'NYSE', currency: 'USD' },
  { name: 'NVIDIA',              symbol: 'NVDA',      apiSymbol: 'NVDA',          exchange: 'NYSE', currency: 'USD' },
  { name: 'ITC',                 symbol: 'ITC',       apiSymbol: 'ITC.NSE',       exchange: 'NSE', currency: 'INR' },
  { name: 'HDFC Bank',           symbol: 'HDFCBANK',  apiSymbol: 'HDFCBANK.NSE',  exchange: 'NSE', currency: 'INR' },
];

type StockData = {
  name: string;
  symbol: string;
  apiSymbol: string;
  exchange: string;
  currency: string;
  price?: number;
  change_pct?: number;
  source?: string;
  signal?: 'BUY' | 'SELL' | 'HOLD';
  predictedPrice?: number;
  confidence?: number;
};

// Format currency helper
function formatCurrency(value: number, currency: string) {
  if (currency === 'INR') {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
}

// Check if market is open
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
    const day = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const total = hour * 60 + minute;
    const isWeekday = !["Sat", "Sun"].includes(day);
    return isWeekday && total >= 9 * 60 + 15 && total <= 15 * 60 + 30;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const total = hour * 60 + minute;
  const isWeekday = !["Sat", "Sun"].includes(day);
  return isWeekday && total >= 9 * 60 + 30 && total <= 16 * 60;
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Fetch all prices with caching
async function fetchAllPrices(): Promise<StockData[]> {
  const results = await Promise.allSettled(
    STOCKS.map(async (s) => {
      let price: number | undefined, change_pct: number | undefined, source: string | undefined;
      
      try {
        const liveRes = await fetchWithTimeout(
          `${API}/api/v1/stocks/live-price/${encodeURIComponent(s.apiSymbol)}`,
          {},
          3000
        );
        if (liveRes.ok) {
          const live = await liveRes.json();
          source = live?.source ?? "live";
          price = typeof live?.price === "number" ? live.price : undefined;
          change_pct = typeof live?.change_pct === "number" ? live.change_pct : undefined;
        }
      } catch {
        // Fall through to quote endpoint.
      }

      if (!price) {
        try {
          const quoteRes = await fetchWithTimeout(
            `${API}/api/v1/stocks/${encodeURIComponent(s.apiSymbol)}/quote`,
            {},
            3000
          );
          const quote = await quoteRes.json();
          source = quote?.source ?? "quote";
          price = quote?.quote?.c ?? undefined;
          change_pct =
            typeof quote?.quote?.dp === "number"
              ? quote.quote.dp
              : quote?.quote?.pc
              ? ((quote.quote.c - quote.quote.pc) / quote.quote.pc) * 100
              : undefined;
        } catch {
          // Use fallback
        }
      }

      // Fetch prediction data
      let signal: 'BUY' | 'SELL' | 'HOLD' | undefined, predictedPrice: number | undefined, confidence: number | undefined;
      try {
        const historyRes = await fetchWithTimeout(
          `${API}/api/v1/stocks/${encodeURIComponent(s.apiSymbol)}/history?days=30`,
          {},
          5000
        );
        if (historyRes.ok) {
          const history = await historyRes.json();
          const closes = (history.series || []).map((point: { c: number }) => point.c);
          if (closes.length >= 2) {
            const predRes = await fetchWithTimeout(
              `${API}/api/v1/predictions`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: s.apiSymbol, closes }),
              },
              5000
            );
            if (predRes.ok) {
              const pred = await predRes.json();
              signal = pred?.risk?.signal;
              predictedPrice = pred?.predictions?.ensemble;
              confidence = pred?.risk?.score ? Math.round(pred.risk.score) : undefined;
            }
          }
        }
      } catch {
        // Fallback to local calculation
        if (change_pct !== undefined) {
          signal = change_pct > 0.3 ? 'BUY' : change_pct < -0.3 ? 'SELL' : 'HOLD';
          confidence = Math.min(95, Math.max(60, Math.round(70 + Math.abs(change_pct) * 10)));
        }
      }

      return {
        ...s,
        price,
        change_pct,
        source,
        signal,
        predictedPrice,
        confidence,
      };
    })
  );
  
  return results.map((r, i) => ({
    ...STOCKS[i],
    ...(r.status === "fulfilled" ? r.value : {}),
  }));
}

// Memoized Stock Card Component
const StockCard = memo(function StockCard({ stock }: { stock: StockData }) {
  const router = useRouter();
  
  const { price, change_pct, isLive, isUp, signal, predicted, confidence, signalClass, sparkHeights } = useMemo(() => {
    const p = stock.price || 0;
    const cp = stock.change_pct || 0;
    const live = isMarketOpen(stock.exchange);
    const up = cp >= 0;
    const sig = stock.signal || (cp > 0.3 ? 'BUY' : cp < -0.3 ? 'SELL' : 'HOLD');
    const pred = stock.predictedPrice || (p ? p * (1 + (cp / 100) * 1.5) : null);
    const conf = stock.confidence || Math.min(95, Math.max(60, Math.round(70 + Math.abs(cp) * 10)));
    const sigClass = sig === 'BUY' ? 'buy' : sig === 'SELL' ? 'sell' : 'hold';
    const sparks = Array.from({ length: 8 }, (_, i) => {
      const seed = stock.symbol.length * 31 + i * 17 + Math.round(Math.abs(cp) * 10);
      return 20 + (seed % 60);
    });
    return {
      price: p,
      change_pct: cp,
      isLive: live,
      isUp: up,
      signal: sig,
      predicted: pred,
      confidence: conf,
      signalClass: sigClass,
      sparkHeights: sparks,
    };
  }, [stock]);

  const handleClick = useCallback(() => {
    router.push(`/stocks?q=${stock.symbol}`);
  }, [router, stock.symbol]);

  return (
    <div 
      className={`tilt-card popular-card ${signalClass} h-full rounded-2xl p-3.5 md:p-4 flex flex-col cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={handleClick}
    >
      <div className="popular-sheen" aria-hidden="true" />
      
      <div className="flex items-start justify-between gap-3 min-h-[52px] mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[var(--ink)] mb-1 truncate dark:text-gray-100" title={stock.name}>
            {stock.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] min-w-0 dark:text-gray-400">
            <span className="font-mono font-semibold text-[var(--ink)] dark:text-gray-200">{stock.symbol}</span>
            <span>·</span>
            <span className="dark:text-gray-400">{stock.exchange}</span>
            <span className={`live-indicator ${isLive ? '' : 'closed'} dark:bg-gray-700 dark:text-gray-300`}>
              {isLive ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
        </div>
        <span className={`signal-badge ${signalClass.toLowerCase()} shrink-0`}>
          {signal}
        </span>
      </div>

      <div className="mb-3 min-h-[66px]">
        <div className="price-display text-tabular text-[var(--ink)] dark:text-gray-100">
          {formatCurrency(price, stock.currency)}
        </div>
        <div className={`price-change ${isUp ? 'positive' : 'negative'}`}>
          {isUp ? '↑' : '↓'} {isUp ? '+' : ''}{change_pct.toFixed(2)}%
        </div>
      </div>

      <div className="mb-4 min-h-[76px]">
        <div className="text-xs uppercase tracking-wide text-[var(--ink-muted)] mb-1 dark:text-gray-400">Prediction</div>
        <div className="text-lg font-semibold text-[var(--ink)] mb-1 text-tabular dark:text-gray-200">
          {predicted ? formatCurrency(predicted, stock.currency) : '—'}
        </div>
        <div className={`text-sm ${isUp ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
          {isUp ? '↑' : '↓'} {(change_pct * 1.5).toFixed(2)}%
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex-1 h-8 flex items-end gap-1 min-w-0">
          {sparkHeights.map((height, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm spark-bar ${signalClass}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="text-xs text-[var(--ink-muted)] font-semibold shrink-0 tabular-nums dark:text-gray-400">
          {confidence}%
        </div>
      </div>
    </div>
  );
});

// Skeleton Grid Component
const SkeletonGrid = memo(function SkeletonGrid() {
  return (
    <div className="stock-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonStockCard key={i} />
      ))}
    </div>
  );
});

// Main Home Component
export default function Home() {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockData[]>(STOCKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadPrices = useCallback(async () => {
    if (cancelledRef.current) return;
    
    try {
      const data = await fetchAllPrices();
      if (!cancelledRef.current) {
        setStocks(data);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError("Failed to load stock prices. Please try again.");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    loadPrices();
    const interval = setInterval(loadPrices, 30000); // Poll every 30s instead of 5s for performance
    
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [loadPrices]);

  const handlePredictClick = useCallback(() => {
    router.push('/prediction');
  }, [router]);

  const handleNewsClick = useCallback(() => {
    router.push('/market-news');
  }, [router]);

  return (
    <div className="min-h-screen relative">
      <section className="px-6 py-16 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-900 to-blue-500 bg-clip-text text-transparent reveal dark:from-blue-500 dark:to-blue-400">
            Stock Price Prediction
          </h1>
          <p className="text-xl text-[var(--ink-soft)] mb-8 max-w-3xl mx-auto reveal delay-1 dark:text-gray-300">
            Predict market trends using Machine Learning & Real-Time Data.
            Experience accurate predictions with live signals and actionable insights.
          </p>
          <div className="hero-action-bar reveal delay-2" role="group" aria-label="Primary actions">
            <button
              onClick={handlePredictClick}
              className="btn-primary"
            >
              Predict Now
            </button>
            <button
              onClick={handleNewsClick}
              className="btn-secondary"
            >
              Market News
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] mb-4 dark:text-gray-100">
              Popular Stocks
            </h2>
            <p className="text-lg text-[var(--ink-soft)] dark:text-gray-400">
              Real-time prices and AI-powered predictions for market favorites
            </p>
          </div>
          
          {error && (
            <div className="text-center py-8">
              <div className="text-[var(--danger)] mb-4">{error}</div>
              <button 
                onClick={loadPrices}
                className="btn-secondary"
              >
                Retry
              </button>
            </div>
          )}
          
          {loading ? (
            <SkeletonGrid />
          ) : (
            <div className="stock-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stocks.map((stock, index) => (
                <div key={stock.symbol} className={`reveal delay-${Math.min(index % 3 + 1, 3)}`}>
                  <StockCard stock={stock} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
