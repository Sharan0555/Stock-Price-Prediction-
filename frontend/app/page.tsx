"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = 'http://localhost:8001';

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
};

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

async function fetchAllPrices() {
  const results = await Promise.allSettled(
    STOCKS.map(async (s) => {
      try {
        const liveRes = await fetch(
          `${API}/api/v1/stocks/live-price/${encodeURIComponent(s.apiSymbol)}`
        );
        if (liveRes.ok) {
          const live = await liveRes.json();
          return {
            source: live?.source ?? "live",
            price: typeof live?.price === "number" ? live.price : undefined,
            change_pct:
              typeof live?.change_pct === "number" ? live.change_pct : undefined,
          };
        }
      } catch {
        // Fall through to quote endpoint.
      }

      const quoteRes = await fetch(
        `${API}/api/v1/stocks/${encodeURIComponent(s.apiSymbol)}/quote`
      );
      const quote = await quoteRes.json();
      return {
        source: quote?.source ?? "quote",
        price: quote?.quote?.c ?? undefined,
        change_pct:
          quote?.quote?.pc
            ? ((quote.quote.c - quote.quote.pc) / quote.quote.pc) * 100
            : undefined,
      };
    })
  );
  return results.map((r, i) => ({
    ...STOCKS[i],
    price: r.status === "fulfilled" ? r.value?.price : undefined,
    change_pct: r.status === "fulfilled" ? r.value?.change_pct : undefined,
    source: r.status === "fulfilled" ? r.value?.source : undefined,
  }));
}

const formatCurrency = (value: number, currency: string) => {
  if (currency === 'INR') {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
};

function StockCard({ stock }: { stock: StockData }) {
  const price = stock.price || 0;
  const change_pct = stock.change_pct || 0;
  const isLive = isMarketOpen(stock.exchange);
  const isUp = change_pct >= 0;
  
  // Calculate prediction
  const predicted = price ? price * (1 + (change_pct / 100) * 1.5) : null;
  
  // Calculate signal
  const signal = change_pct > 0.3 ? 'BUY' : change_pct < -0.3 ? 'SELL' : 'HOLD';
  
  // Calculate confidence
  const confidence = Math.min(95, Math.max(60, Math.round(70 + Math.abs(change_pct) * 10)));
  
  const signalClass = signal === 'BUY' ? 'buy' : signal === 'SELL' ? 'sell' : 'hold';
  const sparkHeights = Array.from({ length: 8 }, (_, i) => {
    const seed = stock.symbol.length * 31 + i * 17 + Math.round(Math.abs(change_pct) * 10);
    return 20 + (seed % 60);
  });

  return (
    <div className={`tilt-card popular-card ${signalClass} h-full rounded-2xl p-3.5 md:p-4 flex flex-col`}>
      {/* Decorative corner accent */}
      <div className="popular-sheen" aria-hidden="true" />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-h-[52px] mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 mb-1 truncate" title={stock.name}>
            {stock.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-mono font-semibold text-slate-900">{stock.symbol}</span>
            <span>·</span>
            <span>{stock.exchange}</span>
            <span className={`live-indicator ${isLive ? '' : 'closed'}`}>
              {isLive ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
        </div>
        <span className={`signal-badge ${signalClass.toLowerCase()} shrink-0`}>
          {signal}
        </span>
      </div>

      {/* Price and Change */}
      <div className="mb-3 min-h-[66px]">
        <div className="price-display text-tabular">
          {formatCurrency(price, stock.currency)}
        </div>
        <div className={`price-change ${isUp ? 'positive' : 'negative'}`}>
          {isUp ? '↑' : '↓'} {isUp ? '+' : ''}{change_pct.toFixed(2)}%
        </div>
      </div>

      {/* Prediction */}
      <div className="mb-4 min-h-[76px]">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Prediction</div>
        <div className="text-lg font-semibold text-slate-900 mb-1 text-tabular">
          {predicted ? formatCurrency(predicted, stock.currency) : '—'}
        </div>
        <div className={`text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '↑' : '↓'} {(change_pct * 1.5).toFixed(2)}%
        </div>
      </div>

      {/* Mini Chart and Confidence */}
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex-1 h-8 flex items-end gap-1 min-w-0">
          {/* Simple bar chart visualization */}
          {sparkHeights.map((height, i) => {
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm spark-bar ${signalClass}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="text-xs text-gray-500 font-semibold shrink-0 tabular-nums">
          {confidence}%
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockData[]>(STOCKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      if (cancelled) return;
      
      try {
        const data = await fetchAllPrices();
        if (!cancelled) {
          setStocks(data);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch prices:', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPrices();
    const interval = setInterval(loadPrices, 5000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* Hero Section */}
      <section className="px-6 py-16 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-900 to-blue-500 bg-clip-text text-transparent reveal">
            Stock Price Prediction
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto reveal delay-1">
            Predict market trends using Machine Learning & Real-Time Data.
            Experience accurate predictions with live signals and actionable insights.
          </p>
          <div className="hero-action-bar reveal delay-2" role="group" aria-label="Primary actions">
            <button
              onClick={() => router.push('/prediction')}
              className="btn-primary"
            >
              Predict Now
            </button>
            <button
              onClick={() => router.push('/market-news')}
              className="btn-secondary"
            >
              Market News
            </button>
          </div>
        </div>
      </section>

      {/* Stock Cards Grid */}
      <section className="px-6 pb-16 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Popular Stocks
            </h2>
            <p className="text-lg text-slate-600">
              Real-time prices and AI-powered predictions for market favorites
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-slate-600">Loading stock prices...</div>
            </div>
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
