"use client";

import { useEffect, useMemo, useRef, useState, useCallback, memo, Suspense } from "react";
import dynamic from "next/dynamic";
import PriceChart from "@/components/PriceChart";
import SignalBanner from "@/components/SignalBanner";
import StockMetricCards from "@/components/StockMetricCards";
import StrategyCard from "@/components/StrategyCard";
import { SkeletonMetricCards, SkeletonChart, SkeletonPrediction } from "@/components/skeleton";
import { fetchJsonWithFallback } from "@/lib/api-base";
import { apiCache } from "@/lib/api-cache";
import { Search, X, Loader2 } from "lucide-react";

// Types
type SearchResult = {
  symbol: string;
  description?: string;
  type?: string;
  currency?: string;
  displaySymbol?: string;
  primaryExchange?: string;
};

type SymbolsResponse = {
  results: SearchResult[];
};

type QuoteResponse = {
  symbol: string;
  quote: {
    c: number;
    h: number;
    l: number;
    o: number;
    pc: number;
  };
};

type HistoryResponse = {
  symbol: string;
  source: string;
  series: Array<{ t: number; c: number; v?: number }>;
};

type PredictionResponse = {
  symbol: string;
  predictions: {
    lstm: number;
    ensemble: number;
  };
  risk: {
    score: number;
    level: "low" | "medium" | "high";
    signal: "BUY" | "HOLD" | "SELL";
    last_price: number;
    change_pct: number;
  };
};

type StrategyPlan =
  | {
      side: "BUY";
      entry: [number, number];
      target: number;
      stop: number;
      horizon: string;
    }
  | {
      side: "SELL";
      zone: [number, number];
      expected: number;
      stop: number;
      horizon: string;
    };

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Helper functions
const normalizeSymbol = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2 && ["NSE", "BSE"].includes(parts[0])) {
      return parts[1] + ".NS";
    }
  }
  return trimmed;
};

const isInrCandidate = (item: SearchResult) =>
  item.currency === "INR" ||
  item.primaryExchange === "NSE" ||
  item.primaryExchange === "BSE" ||
  item.symbol?.includes(".NS") ||
  item.symbol?.includes(".BO");

const signalSide = (signal: "BUY" | "HOLD" | "SELL") => signal;

// Memoized Exchange Badge Component
const ExchangeBadge = memo(function ExchangeBadge({ active, label, count, onClick, color }: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
          : "bg-[var(--paper-strong)] text-[var(--ink)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--paper)]"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        {label}
      </span>
      {active && (
        <span className="absolute inset-0 rounded-full ring-2 ring-blue-400/50 animate-pulse" />
      )}
    </button>
  );
});

// Memoized Stock List Item
const StockListItem = memo(function StockListItem({ item, index, onClick, isInr }: {
  item: SearchResult;
  index: number;
  onClick: () => void;
  isInr: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3 text-left text-sm text-[var(--ink)] transition-all duration-300 hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent-soft)]/20 hover:-translate-y-0.5 overflow-hidden"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/0 to-[var(--accent)]/0 group-hover:from-[var(--accent)]/5 group-hover:to-[var(--accent)]/10 transition-all duration-300" />
      <span className="font-semibold relative z-10 group-hover:text-[var(--accent)] transition-colors">
        {item.description ?? item.symbol}
      </span>
      <span className="text-xs text-[var(--ink-muted)] relative z-10 flex items-center gap-1">
        {normalizeSymbol(item.displaySymbol || item.symbol)}
        <span className={`w-1.5 h-1.5 rounded-full ${isInr ? 'bg-orange-400' : 'bg-blue-400'}`} />
        {isInr ? "INR" : "US"}
      </span>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
});

// Search Input Component with debouncing
const SearchInput = memo(function SearchInput({
  value,
  onChange,
  onSearch,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  }, [onSearch]);

  return (
    <div className="relative w-full max-w-3xl group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-300">
        <Search className="w-5 h-5" />
      </div>
      <input
        className="w-full rounded-full pl-12 pr-12 py-3.5 text-base text-[var(--ink)] bg-[var(--paper-strong)] border-2 border-[var(--border)] shadow-sm outline-none transition-all duration-300 focus:border-[var(--accent)] focus:shadow-lg focus:shadow-[var(--accent)]/20 focus:ring-4 focus:ring-[var(--accent)]/10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search stock (Example: TATA MOTORS, RELIANCE, INFY)"
        onKeyDown={handleKeyDown}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--border)] text-[var(--ink-muted)] hover:bg-[var(--danger)] hover:text-white transition-all duration-200 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />
    </div>
  );
});

// Main Prediction Page Component
export default function PredictionPage() {
  // State
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [catalog, setCatalog] = useState<SearchResult[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [activeExchange, setActiveExchange] = useState<"ALL" | "US" | "INR">("ALL");

  // Debounced search query
  const debouncedQuery = useDebounce(query, 300);

  // Memoized filtered catalog
  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (activeExchange !== "ALL") {
      items = items.filter((item) =>
        activeExchange === "INR" ? isInrCandidate(item) : !isInrCandidate(item)
      );
    }
    if (!debouncedQuery.trim()) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.symbol?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.displaySymbol?.toLowerCase().includes(q)
    );
  }, [catalog, debouncedQuery, activeExchange]);

  // Handlers
  const loadStockDetails = useCallback(async (item: SearchResult, requestId: number) => {
    if (requestId !== requestIdRef.current) return;
    setPredictionError(null);
    setPrediction(null);

    try {
      const normalized = normalizeSymbol(item.symbol);
      
      // Check cache for quote and history
      const quoteCacheKey = `quote:${normalized}`;
      const historyCacheKey = `history:${normalized}`;
      
      let quoteData = apiCache.get<QuoteResponse>(quoteCacheKey);
      let historyData = apiCache.get<HistoryResponse>(historyCacheKey);

      const promises: Promise<void>[] = [];

      if (!quoteData) {
        promises.push(
          fetchJsonWithFallback<QuoteResponse>(`/api/v1/stocks/${encodeURIComponent(normalized)}/quote`)
            .then(data => {
              quoteData = data;
              apiCache.set(quoteCacheKey, data);
            })
            .catch(() => {})
        );
      }

      if (!historyData) {
        promises.push(
          fetchJsonWithFallback<HistoryResponse>(`/api/v1/stocks/${encodeURIComponent(normalized)}/history?days=30`)
            .then(data => {
              historyData = data;
              apiCache.set(historyCacheKey, data);
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);

      if (requestId !== requestIdRef.current) return;

      if (quoteData) setQuote(quoteData);
      if (historyData) {
        setHistory(historyData);
        const closes = (historyData.series || []).map((point) => point.c);
        const volumes = (historyData.series || []).map((point) => point.v || 0).filter(v => v > 0);
        
        if (closes.length >= 2) {
          // Fetch legacy prediction
          try {
            const predRes = await fetchJsonWithFallback<PredictionResponse>("/api/v1/predictions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ symbol: normalized, closes }),
            });
            setPrediction(predRes);
          } catch {
            setPrediction(null);
            setPredictionError("Prediction model is unavailable right now.");
          }
        } else {
          setPrediction(null);
          setPredictionError("Not enough history to generate prediction.");
        }
      }
    } catch {
      setPredictionError("Failed to load stock details.");
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      // Check cache first
      const cacheKey = `search:${query}`;
      const cached = apiCache.get<SearchResult[]>(cacheKey);
      if (cached) {
        setResults(cached);
        if (cached.length > 0) {
          await loadStockDetails(cached[0], ++requestIdRef.current);
        }
        setSearching(false);
        return;
      }

      const [usRes, inrRes] = await Promise.all([
        fetchJsonWithFallback<SymbolsResponse>(
          `/api/v1/stocks/symbols?exchange=US&limit=1000&q=${encodeURIComponent(query)}`
        ),
        fetchJsonWithFallback<SymbolsResponse>(
          `/api/v1/stocks/symbols?exchange=INR&limit=1000&q=${encodeURIComponent(query)}`
        ),
      ]);
      const merged = [...(usRes?.results || []), ...(inrRes?.results || [])];
      const deduped = Array.from(
        new Map(merged.map((item) => [item.symbol?.toUpperCase() || "", item])).values()
      ).filter((item) => Boolean(item.symbol));
      
      // Cache results
      apiCache.set(cacheKey, deduped);
      
      setResults(deduped);
      if (deduped.length) {
        const top = deduped[0];
        await loadStockDetails(top, ++requestIdRef.current);
      } else {
        setError("No stocks found. Try a different symbol.");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [query, loadStockDetails]);

  const handleSelectFromList = useCallback(async (item: SearchResult) => {
    setQuery(item.symbol || "");
    setResults([item]);
    await loadStockDetails(item, ++requestIdRef.current);
  }, [loadStockDetails]);

  // Load catalog on mount
  useEffect(() => {
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        // Check cache first
        const cached = apiCache.get<SearchResult[]>("catalog:all");
        if (cached) {
          setCatalog(cached);
          setCatalogLoading(false);
          return;
        }

        const [usRes, inrRes] = await Promise.all([
          fetchJsonWithFallback<SymbolsResponse>("/api/v1/stocks/symbols?exchange=US&limit=1000"),
          fetchJsonWithFallback<SymbolsResponse>("/api/v1/stocks/symbols?exchange=INR&limit=1000"),
        ]);
        const merged = [...(usRes?.results || []), ...(inrRes?.results || [])];
        const deduped = Array.from(
          new Map(merged.map((item) => [item.symbol?.toUpperCase() || "", item])).values()
        ).filter((item) => Boolean(item.symbol));
        
        apiCache.set("catalog:all", deduped);
        setCatalog(deduped);
      } catch {
        setCatalogError("Failed to load stock list.");
      } finally {
        setCatalogLoading(false);
      }
    };
    loadCatalog();
  }, []);

  // Memoized derived values
  const currentSymbol = useMemo(() => results[0]?.symbol, [results]);
  const currency = useMemo(() => results[0]?.currency, [results]);
  const displayCurrency = useMemo(() => (currency === "INR" ? "INR" : "USD") as "USD" | "INR", [currency]);
  const signal = useMemo(() => prediction?.risk?.signal, [prediction]);
  const signalSideValue = useMemo(() => signalSide(signal || "HOLD"), [signal]);
  const predictedPrice7 = useMemo(() => prediction?.predictions?.ensemble, [prediction]);
  const currentPrice = useMemo(() => quote?.quote?.c ?? prediction?.risk?.last_price, [quote, prediction]);

  const reasons = useMemo(() => {
    if (!prediction) return [];
    const { risk } = prediction;
    const change = risk.change_pct;
    const absChange = Math.abs(change);
    const confidenceBand = risk.score >= 70 ? "high" : risk.score >= 45 ? "moderate" : "early";

    const momentumPoint =
      risk.signal === "BUY"
        ? absChange >= 2
          ? "Momentum is strongly positive with upside acceleration in recent sessions."
          : "Momentum is positive and favors continuation on the upside."
        : risk.signal === "SELL"
        ? absChange >= 2
          ? "Momentum is strongly negative with sustained downside pressure."
          : "Momentum is weak and currently tilted to the downside."
        : "Momentum is mixed, so directional edge is currently limited.";

    const riskPoint =
      risk.level === "low"
        ? "Volatility regime is low, which supports cleaner short-term price behavior."
        : risk.level === "medium"
        ? "Volatility is moderate, so position sizing should stay balanced."
        : "Volatility is elevated, so tighter risk control is important.";

    const confidencePoint =
      risk.signal === "BUY"
        ? `Model confidence is ${confidenceBand} (${risk.score.toFixed(0)}%), supporting a bullish bias.`
        : risk.signal === "SELL"
        ? `Model confidence is ${confidenceBand} (${risk.score.toFixed(0)}%), supporting a bearish bias.`
        : `Model confidence is ${confidenceBand} (${risk.score.toFixed(0)}%), favoring patience over aggressive entries.`;

    const movePoint =
      change >= 0
        ? `Projected move is +${absChange.toFixed(2)}% from current price in the near-term window.`
        : `Projected move is -${absChange.toFixed(2)}% from current price in the near-term window.`;

    const executionPoint =
      risk.signal === "BUY"
        ? "Execution preference: look for pullback entries and trail stops below invalidation."
        : risk.signal === "SELL"
        ? "Execution preference: reduce exposure on bounces and protect against sharp reversals."
        : "Execution preference: wait for breakout or breakdown confirmation before acting.";

    return [momentumPoint, riskPoint, confidencePoint, movePoint, executionPoint];
  }, [prediction]);

  const strategy = useMemo<StrategyPlan | null>(() => {
    if (!prediction || currentPrice === undefined) return null;
    const movePct = Math.max(Math.abs(prediction.risk.change_pct), 0.8) / 100;
    const horizon = "7 Days";
    if (prediction.risk.signal === "SELL") {
      return {
        side: "SELL",
        zone: [currentPrice * 0.998, currentPrice * 1.01],
        expected: currentPrice * (1 - movePct),
        stop: currentPrice * (1 + movePct * 0.55),
        horizon,
      };
    }
    return {
      side: "BUY",
      entry: [currentPrice * 0.99, currentPrice * 1.002],
      target: currentPrice * (1 + movePct),
      stop: currentPrice * (1 - movePct * 0.55),
      horizon,
    };
  }, [currentPrice, prediction]);

  const exchangeBadgeColors = {
    ALL: "bg-green-400",
    US: "bg-blue-400",
    INR: "bg-orange-400",
  };

  return (
    <div className="min-h-screen bg-transparent">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-6 group">
            <div className="relative cursor-pointer">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-300/50 transition-all duration-300 hover:scale-110 hover:rotate-3 hover:shadow-blue-400/60">
                AI
              </div>
              <div className="absolute inset-0 rounded-lg bg-blue-500/30 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl transition-all duration-300 hover:tracking-wide cursor-default">
                AI-driven stock insights built for quick decisions.
              </h1>
              <p className="max-w-2xl text-sm text-[var(--ink-soft)] mt-1">
                Search any stock to get a clean snapshot,{" "}
                <span className="relative inline-block group/tooltip">
                  <span className="text-blue-600 font-medium border-b border-blue-400 cursor-help hover:text-blue-700 transition-colors">
                    AI prediction
                  </span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    Powered by Claude AI & Ensemble ML models
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </span>
                </span>
                , and an action plan crafted from recent price behavior.
              </p>
            </div>
          </div>
        </header>

        <section className="glass p-6 rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ink-muted)]">
              Stock Search
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="w-full max-w-3xl dark:[&_input]:bg-gray-800 dark:[&_input]:border-gray-600 dark:[&_input]:text-white dark:[&_input]:placeholder-gray-400">
              <SearchInput
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
                loading={searching}
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="btn-primary w-full max-w-xs sm:w-auto group/btn flex items-center gap-2 relative overflow-hidden"
              disabled={searching}
            >
              {searching ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 glass">
              {error}
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <ExchangeBadge
                active={activeExchange === "ALL"}
                label="All Stocks"
                count={filteredCatalog.length}
                onClick={() => setActiveExchange("ALL")}
                color={exchangeBadgeColors.ALL}
              />
              <ExchangeBadge
                active={activeExchange === "US"}
                label="US Stocks"
                count={filteredCatalog.filter((i) => !isInrCandidate(i)).length}
                onClick={() => setActiveExchange("US")}
                color={exchangeBadgeColors.US}
              />
              <ExchangeBadge
                active={activeExchange === "INR"}
                label="INR Stocks"
                count={filteredCatalog.filter(isInrCandidate).length}
                onClick={() => setActiveExchange("INR")}
                color={exchangeBadgeColors.INR}
              />
              <div className="ml-auto text-xs text-[var(--ink-muted)]">
                {filteredCatalog.length} symbols
              </div>
            </div>
            {catalogError && (
              <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 glass">
                {catalogError}
              </div>
            )}
            {!catalogLoading && catalog.length > 0 && (
              <>
                <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredCatalog.slice(0, 20).map((item, index) => (
                      <StockListItem
                        key={`${item.symbol}-${item.description ?? ""}`}
                        item={item}
                        index={index}
                        onClick={() => handleSelectFromList(item)}
                        isInr={isInrCandidate(item)}
                      />
                    ))}
                  </div>
                  {filteredCatalog.length > 20 && (
                    <div className="text-center mt-4 text-xs text-[var(--ink-muted)]">
                      +{filteredCatalog.length - 20} more stocks. Use search to filter.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {results.length > 0 && (
          <>
            <SignalBanner signal={signal} />
            
            {currentPrice === undefined ? (
              <SkeletonMetricCards className="my-6" />
            ) : (
              <StockMetricCards
                lastClose={currentPrice}
                predictedPrice={predictedPrice7}
                upsidePct={prediction?.risk?.change_pct}
                changePct={prediction?.risk?.change_pct}
                confidence={prediction?.risk?.score}
                signal={signal}
                symbol={currentSymbol}
                currency={displayCurrency}
              />
            )}

            {history?.series ? (
              <PriceChart
                series={history.series}
                predictedPrice={predictedPrice7}
                currency={displayCurrency}
                signal={signalSideValue}
              />
            ) : (
              <SkeletonChart className="my-6" />
            )}

            {predictionError && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 glass my-4">
                {predictionError}
              </div>
            )}

            {results.length > 1 && (
              <div className="glass p-4 my-6">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">Other matches</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {results.slice(1, 4).map((item) => (
                    <button
                      key={`${item.symbol}-${item.description ?? ""}`}
                      type="button"
                      onClick={() => handleSelectFromList(item)}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--paper-strong)] px-4 py-3 text-left text-sm text-[var(--ink)] transition hover:border-[var(--accent)]"
                    >
                      <span className="font-semibold">{item.description ?? item.symbol}</span>
                      <span className="text-xs text-[var(--ink-muted)]">{normalizeSymbol(item.displaySymbol || item.symbol)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 my-6">
              <div className="glass p-6">
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink-muted)]">
                  Why AI Recommends This
                </div>
                <ul className="mt-4 space-y-3 text-sm text-[var(--ink)]">
                  {reasons.length ? (
                    reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-3">
                        <span
                          className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          aria-hidden="true"
                        >
                          {signalSideValue === "BUY" ? (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 7l4-4 4 4M6 3v8" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 5l4 4 4-4M6 9V1" />
                            </svg>
                          )}
                        </span>
                        {reason}
                      </li>
                    ))
                  ) : (
                    <li className="text-[var(--ink-muted)]">
                      Search a stock to see AI explanation.
                    </li>
                  )}
                </ul>
              </div>

              <div className="glass p-6">
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink-muted)]">
                  Buy / Sell Strategy
                </div>
                <div className="mt-4">
                  <StrategyCard strategy={strategy} currency={displayCurrency} />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
