"use client";

import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SkeletonStockCard } from "@/components/skeleton";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001';

const STOCKS = [
  { name: 'Apple',               symbol: 'AAPL',      apiSymbol: 'AAPL',          exchange: 'NYSE', currency: 'USD', loading: true },
  { name: 'Microsoft',           symbol: 'MSFT',      apiSymbol: 'MSFT',          exchange: 'NYSE', currency: 'USD', loading: true },
  { name: 'Reliance Industries', symbol: 'RELIANCE',  apiSymbol: 'RELIANCE.NSE',  exchange: 'NSE', currency: 'INR', loading: true },
  { name: 'TCS',                 symbol: 'TCS',       apiSymbol: 'TCS.NSE',       exchange: 'NSE', currency: 'INR', loading: true },
  { name: 'Amazon',              symbol: 'AMZN',      apiSymbol: 'AMZN',          exchange: 'NYSE', currency: 'USD', loading: true },
  { name: 'NVIDIA',              symbol: 'NVDA',      apiSymbol: 'NVDA',          exchange: 'NYSE', currency: 'USD', loading: true },
  { name: 'ITC',                 symbol: 'ITC',       apiSymbol: 'ITC.NSE',       exchange: 'NSE', currency: 'INR', loading: true },
  { name: 'HDFC Bank',           symbol: 'HDFCBANK',  apiSymbol: 'HDFCBANK.NSE',  exchange: 'NSE', currency: 'INR', loading: true },
];

type StockData = {
  name: string;
  symbol: string;
  apiSymbol: string;
  exchange: string;
  currency: string;
  price?: number | null;
  change_pct?: number | null;
  source?: string;
  signal?: 'BUY' | 'SELL' | 'HOLD';
  predictedPrice?: number | null;
  confidence?: number | null;
  loading?: boolean;
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

// Session storage cache key
const CACHE_KEY = "stocks_cache";
const CACHE_TTL_MS = 30000; // 30 seconds

// Check sessionStorage cache
function getCachedStocks(): { data: StockData[]; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed;
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

// Save to sessionStorage cache
function setCachedStocks(data: StockData[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Ignore cache errors
  }
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

// Bulk stock quote response type
type BulkStockItem = {
  symbol: string;
  quote: {
    c: number;
    d?: number;
    dp?: number;
    h?: number;
    l?: number;
    o?: number;
    pc?: number;
    v?: number;
    t?: number;
  } | null;
  source: string;
};

// Fetch all prices using bulk API endpoint
async function fetchAllPrices(): Promise<StockData[]> {
  // Get list of symbols for bulk fetch
  const usSymbols = STOCKS.filter(s => s.currency === 'USD').map(s => s.apiSymbol);
  const inrSymbols = STOCKS.filter(s => s.currency === 'INR').map(s => s.apiSymbol);

  // Create a map to store quote results
  const quoteMap = new Map<string, BulkStockItem>();

  // Fetch US stocks in bulk
  if (usSymbols.length > 0) {
    try {
      const usRes = await fetchWithTimeout(
        `${API}/api/v1/stocks/bulk?symbols=${encodeURIComponent(usSymbols.join(','))}`,
        { next: { revalidate: 30 } },
        5000
      );
      if (usRes.ok) {
        const usData = await usRes.json() as { stocks: BulkStockItem[] };
        usData.stocks?.forEach((item: BulkStockItem) => {
          if (item.quote) quoteMap.set(item.symbol, item);
        });
      }
    } catch {
      // Fall through to individual fetches
    }
  }

  // Fetch INR stocks in bulk
  if (inrSymbols.length > 0) {
    try {
      const inrRes = await fetchWithTimeout(
        `${API}/api/v1/stocks/bulk?symbols=${encodeURIComponent(inrSymbols.join(','))}`,
        { next: { revalidate: 30 } },
        5000
      );
      if (inrRes.ok) {
        const inrData = await inrRes.json() as { stocks: BulkStockItem[] };
        inrData.stocks?.forEach((item: BulkStockItem) => {
          if (item.quote) quoteMap.set(item.symbol, item);
        });
      }
    } catch {
      // Fall through to individual fetches
    }
  }

  // Build result with data from bulk fetch
  const results: StockData[] = STOCKS.map((stock) => {
    const quoteData = quoteMap.get(stock.apiSymbol);
    const quote = quoteData?.quote;

    const price = quote?.c ?? null;
    const change_pct = quote?.dp ?? (quote?.pc && quote?.c
      ? ((quote.c - quote.pc) / quote.pc) * 100
      : null);

    // Calculate signal from change_pct
    const signal = change_pct !== null && change_pct !== undefined
      ? (change_pct > 0.3 ? 'BUY' : change_pct < -0.3 ? 'SELL' : 'HOLD')
      : undefined;

    const confidence = change_pct !== null && change_pct !== undefined
      ? Math.min(95, Math.max(60, Math.round(70 + Math.abs(change_pct) * 10)))
      : undefined;

    const predictedPrice = price !== null && change_pct !== null && change_pct !== undefined
      ? price * (1 + (change_pct / 100) * 1.5)
      : null;

    return {
      ...stock,
      price,
      change_pct,
      source: quoteData?.source ?? 'yfinance',
      signal,
      predictedPrice,
      confidence,
      loading: false,
    };
  });

  return results;
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
  // Initialize with skeleton loading state
  const [stocks, setStocks] = useState<StockData[]>(STOCKS.map(s => ({ ...s, price: null, change_pct: null, loading: true })));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadPrices = useCallback(async (skipCache = false) => {
    if (cancelledRef.current) return;

    // Check sessionStorage cache first (instant load on revisits)
    if (!skipCache) {
      const cached = getCachedStocks();
      if (cached) {
        setStocks(cached.data);
        setLoading(false);
        // Still fetch fresh data in background
      }
    }

    try {
      const data = await fetchAllPrices();
      if (!cancelledRef.current) {
        setStocks(data);
        setLoading(false);
        setError(null);
        // Save to sessionStorage for instant revisits
        setCachedStocks(data);
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
    loadPrices(false); // Check cache first on initial load
    const interval = setInterval(() => loadPrices(true), 30000); // Poll every 30s, skip cache

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
                onClick={() => loadPrices(true)}
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
