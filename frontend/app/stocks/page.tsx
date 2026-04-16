"use client";

import PredictionChart from "@/components/PredictionChart";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type SymbolRow = {
  symbol: string;
  description?: string;
  type?: string;
  currency?: string;
  mic?: string;
};

type SymbolsResp = {
  exchange: string;
  total: number;
  limit: number;
  offset: number;
  results: SymbolRow[];
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

type PredictionSnapshotResponse = {
  symbol: string;
  currency: "USD" | "INR";
  quote_source: string;
  history_source: string;
  quote: QuoteResponse["quote"];
  history: Array<{ t: number; c: number }>;
  predictions: {
    lstm: number;
    ensemble: number;
  };
  risk: {
    score: number;
    level: "low" | "medium" | "high";
    signal: "BUY" | "SELL" | "HOLD";
    last_price: number;
    change_pct: number;
  };
  indicators: Record<string, number | string | null>;
};

export default function StocksPage() {
  const [exchange, setExchange] = useState("US");
  const [query, setQuery] = useState("");
  const pageSize = exchange === "INR" ? 100 : 50;

  const [data, setData] = useState<SymbolsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SymbolRow | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [predictionSnapshot, setPredictionSnapshot] =
    useState<PredictionSnapshotResponse | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const quoteCacheRef = useRef<Record<string, { data: QuoteResponse; ts: number }>>(
    {},
  );
  const requestIdRef = useRef(0);

  const offset = 0;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          exchange,
          limit: String(pageSize),
          offset: String(offset),
        });
        if (query.trim()) params.set("q", query.trim());

        console.log("Fetching stocks from:", `http://localhost:8001/api/v1/stocks/symbols?${params.toString()}`);
        const res = await fetch(`http://localhost:8001/api/v1/stocks/symbols?${params.toString()}`);
        console.log("Response status:", res.status);
        if (!res.ok) throw new Error("Failed to load stocks");
        const json = await res.json() as SymbolsResp;
        console.log("Stocks data received:", json);
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        console.error("Error loading stocks:", e);
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load stocks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [exchange, query, offset, pageSize]);

  useEffect(() => {
    setSelected(null);
    setQuote(null);
    setDetailError(null);
    setPredictionSnapshot(null);
    setPredictionError(null);
  }, [exchange]);

  const fetchWithTimeout = useCallback(
    (path: string, ms: number) =>
      Promise.race<Response>([
        fetch(`http://localhost:8001${path}`),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ms),
        ),
      ]),
    [],
  );

  const extractError = useCallback(async (res: Response) => {
    try {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { detail?: string };
        return json.detail ?? "Unable to load live price.";
      }
      const text = await res.text();
      if (!text) return "Unable to load live price.";
      try {
        const parsed = JSON.parse(text) as { detail?: string };
        return parsed.detail ?? text;
      } catch {
        return text;
      }
    } catch {
      return "Unable to load live price.";
    }
  }, []);

  const loadDetails = useCallback(async (item: SymbolRow) => {
    const requestId = ++requestIdRef.current;
    setSelected(item);
    setDetailError(null);
    const now = Date.now();
    const cachedQuote = quoteCacheRef.current[item.symbol];
    const cacheTtl = 10_000;
    const quoteFresh = cachedQuote && now - cachedQuote.ts < cacheTtl;
    if (quoteFresh) {
      setQuote(cachedQuote.data);
    } else {
      setQuote(null);
    }
    const shouldFetchQuote = !quoteFresh;
    setDetailLoading(shouldFetchQuote);

    const quoteUrl = `/api/v1/stocks/${encodeURIComponent(
      item.symbol,
    )}/quote`;

    if (!shouldFetchQuote) {
      return;
    }

    try {
      const quoteRes = await fetchWithTimeout(quoteUrl, 2000);
      if (quoteRes.ok) {
        const quoteJson = (await quoteRes.json()) as QuoteResponse;
        if (requestId === requestIdRef.current) {
          quoteCacheRef.current[item.symbol] = { data: quoteJson, ts: now };
          setQuote(quoteJson);
        }
      } else {
        const text = await extractError(quoteRes);
        if (requestId === requestIdRef.current) {
          setDetailError(text || "Unable to load live price.");
        }
      }
    } catch (err) {
      if (
        requestId === requestIdRef.current &&
        !(err instanceof Error && err.message === "timeout")
      ) {
        setDetailError("Unable to load live price.");
      }
    }

    if (requestId === requestIdRef.current) {
      setDetailLoading(false);
    }
  }, [extractError, fetchWithTimeout]);

  useEffect(() => {
    if (!selected) return;

    let cancelled = false;
    const selectedSymbol = selected.symbol;

    async function refreshSelectedQuote() {
      try {
        const quoteUrl = `/api/v1/stocks/${encodeURIComponent(
          selectedSymbol,
        )}/quote`;
        const quoteRes = await fetchWithTimeout(quoteUrl, 4000);
        if (!quoteRes.ok) {
          return;
        }
        const quoteJson = (await quoteRes.json()) as QuoteResponse;
        if (cancelled || selectedSymbol !== quoteJson.symbol) {
          return;
        }
        quoteCacheRef.current[selectedSymbol] = { data: quoteJson, ts: Date.now() };
        setQuote(quoteJson);
        setDetailError(null);
      } catch {
        // Keep the last visible quote if refresh fails.
      }
    }

    const interval = window.setInterval(() => {
      void refreshSelectedQuote();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchWithTimeout, selected]);

  useEffect(() => {
    if (!selected) {
      setPredictionSnapshot(null);
      setPredictionError(null);
      return;
    }

    let cancelled = false;
    const selectedSymbol = selected.symbol;
    setPredictionLoading(true);
    setPredictionError(null);

    async function loadPredictionSnapshot() {
      try {
        const res = await fetch(`http://localhost:8001/api/v1/predictions/${encodeURIComponent(selectedSymbol)}?days=60`);
        if (!res.ok) throw new Error("Failed to load prediction");
        const snapshotResult = await res.json() as PredictionSnapshotResponse;
        if (cancelled) return;

        setPredictionSnapshot(snapshotResult);
      } catch (error) {
        if (cancelled) return;
        setPredictionSnapshot(null);
        setPredictionError(
          error instanceof Error
            ? error.message
            : "Unable to load prediction snapshot.",
        );
      } finally {
        if (!cancelled) {
          setPredictionLoading(false);
        }
      }
    }

    void loadPredictionSnapshot();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (data?.results?.length && !selected) {
      loadDetails(data.results[0]);
    }
  }, [data, loadDetails, selected]);

  const showingCount = data ? Math.min(data.total, data.results.length) : 0;
  const exchangeLabel = exchange === "INR" ? "INR" : "US";
  const selectedCurrency: "USD" | "INR" = selected?.currency === "INR" ? "INR" : "USD";

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {exchangeLabel} Stocks
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Curated list for the selected exchange.
              </p>
            </div>
            <nav className="text-sm text-[var(--ink-soft)]">
              <Link className="hover:text-[var(--accent-strong)]" href="/">
                Home
              </Link>
            </nav>
          </div>
        </header>

        <section className="panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Search (symbol or company name)
              </label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                placeholder="Apple, AAPL, Microsoft..."
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Exchange
              </label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                value={exchange}
                onChange={(e) => {
                  setExchange(e.target.value.toUpperCase());
                }}
              >
                <option value="US" className="dark:bg-gray-800 dark:text-gray-100">US</option>
                <option value="INR" className="dark:bg-gray-800 dark:text-gray-100">INR</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--ink-soft)]">
            <div>
              {loading
                ? "Loading…"
                : data
                ? `Showing ${showingCount.toLocaleString()} of ${data.total.toLocaleString()} results`
                : "—"}
            </div>
            <div className="text-xs text-[var(--ink-muted)]">
              Exchange: {exchangeLabel}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="panel space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--ink-muted)]">
                Live Snapshot
              </div>
              <h2 className="font-display text-2xl text-[var(--ink)]">
                {selected
                  ? `${selected.description ?? "Selected Stock"}`
                  : "Select a stock"}
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {selected
                  ? `${selected.symbol} · ${selected.type ?? "Stock"}`
                  : "Click any stock below to load the current price."}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 dark:bg-gray-800 dark:border-gray-600">
              <div className="text-xs text-[var(--ink-muted)] dark:text-gray-400">Current price</div>
              <div className="mt-1 font-display text-2xl text-[var(--ink)] dark:text-gray-100">
                {quote?.quote?.c ? quote.quote.c.toFixed(2) : detailLoading ? "Loading..." : "—"}
              </div>
            </div>
          </div>

          {detailError && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {detailError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
            <div>
              <PredictionChart
                symbol={selected?.symbol}
                series={predictionSnapshot?.history ?? []}
                predictedPrice={predictionSnapshot?.predictions?.ensemble}
                currency={selectedCurrency}
                signal={predictionSnapshot?.risk?.signal}
              />
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-gray-800 dark:border-gray-600">
                <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-muted)] dark:text-gray-400">
                  AI signal
                </div>
                <div className="mt-2 font-display text-2xl text-[var(--ink)] dark:text-gray-100">
                  {predictionSnapshot?.risk?.signal ?? (predictionLoading ? "Loading..." : "—")}
                </div>
                <p className="mt-2 text-sm text-[var(--ink-soft)] dark:text-gray-300">
                  {predictionSnapshot
                    ? `${predictionSnapshot.risk.change_pct >= 0 ? "+" : ""}${predictionSnapshot.risk.change_pct.toFixed(2)}% projected move`
                    : "Fresh prediction data appears here when a symbol is selected."}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4 dark:bg-gray-800 dark:border-gray-600">
                <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-muted)] dark:text-gray-400">
                  Technical view
                </div>
                <div className="mt-2 text-sm text-[var(--ink-soft)] dark:text-gray-300">
                  Trend: {String(predictionSnapshot?.indicators?.trend ?? "—")}
                </div>
                <div className="mt-2 text-sm text-[var(--ink-soft)] dark:text-gray-300">
                  RSI(14): {predictionSnapshot?.indicators?.rsi14 ?? "—"}
                </div>
                <div className="mt-2 text-sm text-[var(--ink-soft)] dark:text-gray-300">
                  Volatility(20): {predictionSnapshot?.indicators?.volatility20 ?? "—"}
                </div>
                <div className="mt-2 text-xs text-[var(--ink-muted)] dark:text-gray-500">
                  Sources: quote {predictionSnapshot?.quote_source ?? "—"} / history{" "}
                  {predictionSnapshot?.history_source ?? "—"}
                </div>
              </div>
              {predictionError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                  {predictionError}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">
            Symbols · {exchangeLabel}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--paper-strong)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.results ?? []).map((r) => (
                  <tr
                    key={`${r.symbol}-${r.mic ?? ""}`}
                    className={`border-t border-[var(--border)] ${
                      selected?.symbol === r.symbol ? "bg-[var(--paper-strong)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[var(--ink)]">
                      {r.symbol}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-muted)]">
                      {r.type ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-muted)]">
                      {r.currency ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => loadDetails(r)}
                        className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && data?.results?.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-[var(--ink-muted)]" colSpan={5}>
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
