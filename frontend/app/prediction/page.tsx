"use client";
import PriceChart from "@/components/PriceChart";
import SignalBanner from "@/components/SignalBanner";
import StockMetricCards from "@/components/StockMetricCards";
import StrategyCard from "@/components/StrategyCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJsonWithFallback } from "@/lib/api-base";

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
  series: Array<{ t: number; c: number }>;
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

export default function PredictionPage() {
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

  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (activeExchange !== "ALL") {
      items = items.filter((item) =>
        activeExchange === "INR" ? isInrCandidate(item) : !isInrCandidate(item)
      );
    }
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.symbol?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.displaySymbol?.toLowerCase().includes(q)
    );
  }, [catalog, query, activeExchange]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
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
        new Map(
          merged.map((item) => [item.symbol?.toUpperCase() || "", item])
        ).values()
      ).filter((item) => Boolean(item.symbol));
      if (deduped.length) {
        const top = deduped[0];
        setResults([top]);
        await loadStockDetails(top, ++requestIdRef.current);
      } else {
        setError("No stocks found. Try a different symbol.");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFromList = async (item: SearchResult) => {
    setQuery(item.symbol || "");
    setResults([item]);
    await loadStockDetails(item, ++requestIdRef.current);
  };

  const loadStockDetails = async (item: SearchResult, requestId: number) => {
    if (requestId !== requestIdRef.current) return;
    setPredictionError(null);
    setPrediction(null);
    try {
      const normalized = normalizeSymbol(item.symbol);
      const [quoteRes, historyRes] = await Promise.allSettled([
        fetchJsonWithFallback<QuoteResponse>(
          `/api/v1/stocks/${encodeURIComponent(normalized)}/quote`
        ),
        fetchJsonWithFallback<HistoryResponse>(
          `/api/v1/stocks/${encodeURIComponent(normalized)}/history?days=30`
        ),
      ]);

      if (quoteRes.status === "fulfilled") {
        setQuote(quoteRes.value);
      }
      if (historyRes.status === "fulfilled") {
        setHistory(historyRes.value);
        const closes = (historyRes.value.series || []).map((point) => point.c);
        if (closes.length >= 2) {
          try {
            const predictionRes = await fetchJsonWithFallback<PredictionResponse>(
              "/api/v1/predictions",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: normalized, closes }),
              }
            );
            setPrediction(predictionRes);
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
  };

  useEffect(() => {
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [usRes, inrRes] = await Promise.all([
          fetchJsonWithFallback<SymbolsResponse>(
            "/api/v1/stocks/symbols?exchange=US&limit=1000"
          ),
          fetchJsonWithFallback<SymbolsResponse>(
            "/api/v1/stocks/symbols?exchange=INR&limit=1000"
          ),
        ]);
        const merged = [...(usRes?.results || []), ...(inrRes?.results || [])];
        const deduped = Array.from(
          new Map(
            merged.map((item) => [item.symbol?.toUpperCase() || "", item])
          ).values()
        ).filter((item) => Boolean(item.symbol));
        setCatalog(deduped);
      } catch {
        setCatalogError("Failed to load stock list.");
      } finally {
        setCatalogLoading(false);
      }
    };
    loadCatalog();
  }, []);

  const currentSymbol = results[0]?.symbol;
  const currency = results[0]?.currency;
  const displayCurrency: "USD" | "INR" = currency === "INR" ? "INR" : "USD";
  const signal = prediction?.risk?.signal;
  const signalSideValue = signalSide(signal || "HOLD");
  const predictedPrice7 = prediction?.predictions?.ensemble;
  const currentPrice = quote?.quote?.c ?? prediction?.risk?.last_price;

  const reasons = useMemo(() => {
    if (!prediction) return [];
    const { risk } = prediction;
    const change = risk.change_pct;
    const absChange = Math.abs(change);
    const confidenceBand =
      risk.score >= 70 ? "high" : risk.score >= 45 ? "moderate" : "early";

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
        ? `Model confidence is ${confidenceBand} (${risk.score.toFixed(
            0
          )}%), supporting a bullish bias.`
        : risk.signal === "SELL"
        ? `Model confidence is ${confidenceBand} (${risk.score.toFixed(
            0
          )}%), supporting a bearish bias.`
        : `Model confidence is ${confidenceBand} (${risk.score.toFixed(
            0
          )}%), favoring patience over aggressive entries.`;

    const movePoint =
      change >= 0
        ? `Projected move is +${absChange.toFixed(
            2
          )}% from current price in the near-term window.`
        : `Projected move is -${absChange.toFixed(
            2
          )}% from current price in the near-term window.`;

    const executionPoint =
      risk.signal === "BUY"
        ? "Execution preference: look for pullback entries and trail stops below invalidation."
        : risk.signal === "SELL"
        ? "Execution preference: reduce exposure on bounces and protect against sharp reversals."
        : "Execution preference: wait for breakout or breakdown confirmation before acting.";

    return [
      momentumPoint,
      riskPoint,
      confidencePoint,
      movePoint,
      executionPoint,
    ];
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

  return (
    <div className="min-h-screen bg-transparent">
      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-6 group">
            {/* Interactive AI Logo */}
            <div className="relative cursor-pointer">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-300/50 transition-all duration-300 hover:scale-110 hover:rotate-3 hover:shadow-blue-400/60">
                AI
              </div>
              {/* Pulse ring animation */}
              <div className="absolute inset-0 rounded-lg bg-blue-500/30 animate-ping opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl transition-all duration-300 hover:tracking-wide cursor-default">
                AI-driven stock insights built for quick decisions.
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 mt-1">
                Search any stock to get a clean snapshot,{' '}
                <span className="relative inline-block group/tooltip">
                  <span className="text-blue-600 font-medium border-b border-blue-400 cursor-help hover:text-blue-700 transition-colors">
                    AI prediction
                  </span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    Powered by LSTM & Ensemble ML models
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
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
              Stock Search
            </span>
          </div>
          
          {/* Search Bar with Icon and Clear */}
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="relative w-full max-w-3xl group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                className="w-full rounded-full pl-12 pr-12 py-3.5 text-base text-slate-900 bg-white border-2 border-blue-100 shadow-sm outline-none transition-all duration-300 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:ring-4 focus:ring-blue-500/10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stock (Example: TATA MOTORS, RELIANCE, INFY)"
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
              />
              {/* Clear button */}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-all duration-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {/* Focus ring animation */}
              <div className="absolute inset-0 rounded-full bg-blue-500/20 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />
            </div>
            
            <button
              type="button"
              onClick={handleSearch}
              className="btn-primary w-full max-w-xs sm:w-auto group/btn flex items-center gap-2 relative overflow-hidden"
              disabled={searching}
            >
              {searching ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
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
            {/* Exchange Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {["ALL", "US", "INR"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveExchange(tab as "ALL" | "US" | "INR")}
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                    activeExchange === tab
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : "bg-white/80 text-slate-600 border border-blue-100 hover:border-blue-400 hover:bg-white"
                  }`}
                >
                  {tab === "ALL" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      All Stocks
                    </span>
                  )}
                  {tab === "US" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      US Stocks
                    </span>
                  )}
                  {tab === "INR" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      INR Stocks
                    </span>
                  )}
                  {activeExchange === tab && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-blue-400/50 animate-pulse" />
                  )}
                </button>
              ))}
              <div className="ml-auto text-xs text-gray-500">
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
                      <button
                        key={`${item.symbol}-${item.description ?? ""}`}
                        type="button"
                        onClick={() => handleSelectFromList(item)}
                        className="group relative flex flex-col gap-1 rounded-xl border border-blue-100 bg-white px-4 py-3 text-left text-sm text-slate-800 transition-all duration-300 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 overflow-hidden"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-500/10 transition-all duration-300" />
                        
                        <span className="font-semibold relative z-10 group-hover:text-blue-700 transition-colors">
                          {item.description ?? item.symbol}
                        </span>
                        <span className="text-xs text-gray-500 relative z-10 flex items-center gap-1">
                          {normalizeSymbol(item.displaySymbol || item.symbol)}
                          <span className={`w-1.5 h-1.5 rounded-full ${isInrCandidate(item) ? 'bg-orange-400' : 'bg-blue-400'}`} />
                          {isInrCandidate(item) ? "INR" : "US"}
                        </span>
                        
                        {/* Arrow indicator on hover */}
                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  {filteredCatalog.length > 20 && (
                    <div className="text-center mt-4 text-xs text-gray-500">
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
            <PriceChart
              series={history?.series || []}
              predictedPrice={predictedPrice7}
              currency={displayCurrency}
              signal={signalSideValue}
            />

        {predictionError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 glass">
            {predictionError}
          </div>
        )}

        {results.length > 1 && (
          <div className="glass p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">Other matches</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {results.slice(1, 4).map((item) => (
                <button
                  key={`${item.symbol}-${item.description ?? ""}`}
                  type="button"
                  onClick={() => loadStockDetails(item, ++requestIdRef.current)}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-4 py-3 text-left text-sm text-slate-800 transition hover:border-blue-400"
                >
                  <span className="font-semibold">{item.description ?? item.symbol}</span>
                  <span className="text-xs text-gray-500">{normalizeSymbol(item.displaySymbol || item.symbol)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="glass p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Why AI Recommends This
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-800">
              {reasons.length ? (
                reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600"
                      aria-hidden="true"
                    >
                      {signalSideValue === "BUY" ? (
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M2 7l4-4 4 4M6 3v8" />
                        </svg>
                      ) : (
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M2 5l4 4 4-4M6 9V1" />
                        </svg>
                      )}
                    </span>
                    {reason}
                  </li>
                ))
              ) : (
                <li className="text-gray-500">
                  Search a stock to see AI explanation.
                </li>
              )}
            </ul>
          </div>

          <div className="glass p-6">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
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
