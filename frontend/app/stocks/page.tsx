"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJsonWithFallback, fetchWithApiFallback } from "@/lib/api-base";

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
    c: number | null;
    h: number | null;
    l: number | null;
    o: number | null;
    pc: number | null;
  };
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

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

        const json = await fetchJsonWithFallback<SymbolsResp>(
          `/api/v1/stocks/symbols?${params.toString()}`,
        );
        if (!cancelled) setData(json);
      } catch (e: unknown) {
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
  }, [exchange]);

  const fetchWithTimeout = useCallback(
    (path: string, ms: number) =>
      Promise.race<Response>([
        fetchWithApiFallback(path),
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
    if (data?.results?.length && !selected) {
      loadDetails(data.results[0]);
    }
  }, [data, loadDetails, selected]);

  const showingCount = data ? Math.min(data.total, data.results.length) : 0;
  const exchangeLabel = exchange === "INR" ? "INR" : "US";
  const currentPrice = asFiniteNumber(quote?.quote?.c);

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
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                value={exchange}
                onChange={(e) => {
                  setExchange(e.target.value.toUpperCase());
                }}
              >
                <option value="US">US</option>
                <option value="INR">INR</option>
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
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <div className="text-xs text-[var(--ink-muted)]">Current price</div>
              <div className="mt-1 font-display text-2xl text-[var(--ink)]">
                {currentPrice !== null
                  ? currentPrice.toFixed(2)
                  : detailLoading
                    ? "Loading..."
                    : "—"}
              </div>
            </div>
          </div>

          {detailError && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {detailError}
            </div>
          )}
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
                        className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
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
