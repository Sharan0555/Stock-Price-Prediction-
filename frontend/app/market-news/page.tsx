"use client";

import { useState, useEffect } from "react";
import { fetchJsonWithFallback } from "@/lib/api-base";

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  published: string;
  link: string;
}

interface IndexItem {
  label: string;
  price: number;
  chg: number;
  up: boolean;
}

interface Sentiment {
  overall: string;
  summary: string;
  confidence: number;
  notes: string;
}

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export default function MarketNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [indicesData, setIndicesData] = useState<IndexItem[]>([]);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const formatIndexPrice = (item: IndexItem) => {
    const price = asFiniteNumber(item.price);
    if (price === null) return "—";
    return item.label === "USDINR"
      ? price.toFixed(2)
      : price.toLocaleString("en-US", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        });
  };

  const formatIndexChange = (item: IndexItem) => {
    const change = asFiniteNumber(item.chg);
    if (change === null) return "—";
    return `${item.up ? "+" : ""}${change.toFixed(2)}%`;
  };

  // News — refresh every 5 minutes
  useEffect(() => {
    async function loadNews() {
      try {
        setNewsLoading(true);
        const data = await fetchJsonWithFallback<NewsItem[]>("/api/news");
        setNews(Array.isArray(data) ? data : []);
      } catch {
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    }
    loadNews();
    const i = setInterval(loadNews, 300_000);
    return () => clearInterval(i);
  }, []);

  // Indices ticker tape — refresh every 30 seconds
  useEffect(() => {
    async function loadIndices() {
      try {
        const data = await fetchJsonWithFallback<IndexItem[]>("/api/indices");
        setIndicesData(Array.isArray(data) ? data : []);
      } catch {
        setIndicesData([]);
      }
    }
    loadIndices();
    const i = setInterval(loadIndices, 30_000);
    return () => clearInterval(i);
  }, []);

  // AI Sentiment — refresh every 15 minutes
  useEffect(() => {
    async function loadSentiment() {
      try {
        const data = await fetchJsonWithFallback<Sentiment>("/api/sentiment");
        setSentiment(data);
      } catch {
        setSentiment(null);
      }
    }
    loadSentiment();
    const i = setInterval(loadSentiment, 900_000);
    return () => clearInterval(i);
  }, []);



  const gainers = [
    { symbol: "INFY", change: "+2.4%", volume: "12.5M" },
    { symbol: "TATA", change: "+1.9%", volume: "8.2M" },
    { symbol: "HDFCBANK", change: "+1.6%", volume: "5.1M" },
    { symbol: "RELIANCE", change: "+1.3%", volume: "9.8M" },
    { symbol: "BAJAJFINSV", change: "+1.1%", volume: "2.4M" },
    { symbol: "ICICIBANK", change: "+0.9%", volume: "6.7M" },
  ];

  const losers = [
    { symbol: "TCS", change: "-1.4%", volume: "7.3M" },
    { symbol: "BAJFIN", change: "-1.2%", volume: "3.1M" },
    { symbol: "WIPRO", change: "-0.9%", volume: "4.5M" },
    { symbol: "ONGC", change: "-0.7%", volume: "2.8M" },
    { symbol: "COALINDIA", change: "-0.5%", volume: "1.9M" },
    { symbol: "NTPC", change: "-0.4%", volume: "3.2M" },
  ];

  const sectorNews = [
    {
      sector: "Banking",
      title: "PSU lenders extend rally as credit growth accelerates",
      source: "Economic Times",
    },
    {
      sector: "IT",
      title: "Cloud demand shows early recovery signs in Q1",
      source: "Mint",
    },
    {
      sector: "Energy",
      title: "Refinery margins tighten; downstream stocks ease",
      source: "Business Standard",
    },
    {
      sector: "Pharma",
      title: "Export orders pick up for specialty generics",
      source: "Reuters",
    },
    {
      sector: "Banking",
      title: "Private banks see steady retail loan momentum",
      source: "Bloomberg",
    },
    {
      sector: "Auto",
      title: "EV sales momentum continues despite subsidy cuts",
      source: "CNBC",
    },
    {
      sector: "FMCG",
      title: "Rural demand showing early signs of revival",
      source: "Moneycontrol",
    },
  ];

  const indices = [
    { name: "NIFTY 50", value: "22,184.20", change: "+0.62%" },
    { name: "SENSEX", value: "73,182.35", change: "+0.54%" },
    { name: "NASDAQ", value: "16,102.40", change: "+0.31%" },
    { name: "S&P 500", value: "5,182.90", change: "-0.18%" },
    { name: "DOW JONES", value: "38,905.66", change: "+0.42%" },
    { name: "FTSE 100", value: "7,682.50", change: "-0.25%" },
  ];



  return (
    <div className="min-h-screen newsroom-bg">
      <main className="newsroom mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 lg:py-14">
        <header className="flex flex-col gap-3">
          <div className="newsroom-kicker text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)]">
            Market News
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)]">
            Market News
          </h1>
          <p className="max-w-2xl text-sm text-[var(--ink-soft)]">
            Track the latest market headlines and macro signals.
          </p>
        </header>

        <section className="panel ticker ticker--newsroom">
          <div className="ticker-track">
            {[...indicesData, ...indicesData].map((idx, index) => (
              <span key={`${idx.label}-${index}`} style={{ marginRight: 28, whiteSpace: "nowrap" }}>
                <span className="font-semibold text-[var(--ink)]" style={{ marginRight: 6 }}>{idx.label}</span>
                <span className="text-[var(--ink-soft)]" style={{ marginRight: 4 }}>
                  {formatIndexPrice(idx)}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    idx.up ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatIndexChange(idx)}
                </span>
              </span>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:auto-rows-min">
          <section className="panel newsroom-panel lg:col-span-8 lg:row-span-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2 group cursor-default min-w-0">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-[var(--accent)] transition-colors duration-300 truncate">
                  Live Headlines
                </span>
                <svg className="w-4 h-4 text-[var(--ink-muted)] group-hover:text-[var(--accent)] transition-all duration-300 group-hover:scale-110 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] bg-[var(--accent-soft)] px-2 py-1 rounded-full shrink-0">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Updated just now
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden pr-2 min-h-0">
              {newsLoading ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: "#999", fontSize: 13 }}>
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading latest headlines...
                  </div>
                </div>
              ) : news.length === 0 ? (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 bg-white border border-[var(--border)] rounded-lg p-6 flex flex-col justify-center">
                    <div className="text-lg font-semibold text-[var(--ink)] mb-2">No news available</div>
                    <p className="text-sm text-[var(--ink-soft)]">Check back later for market updates.</p>
                  </div>
                  {/* Placeholder articles to fill space */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-1 bg-gray-50 border border-dashed border-[var(--border)] rounded-lg p-6 flex items-center justify-center min-h-[120px]">
                      <span className="text-xs text-[var(--ink-muted)]">More headlines loading...</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {news.map((item, i) => (
                    <a
                      key={i}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block no-underline flex-1"
                    >
                      <article className="newsroom-article h-full border border-[var(--border)] hover:border-[var(--accent)] rounded-lg p-5 hover:bg-[var(--accent-hover)] hover:shadow-sm transition-all cursor-pointer overflow-hidden bg-white flex flex-col">
                        <div className="text-lg font-semibold text-[var(--ink)] line-clamp-2 break-words leading-snug mb-3">
                          {item.title}
                        </div>
                        {item.summary && (
                          <p className="text-sm text-[var(--ink-soft)] line-clamp-3 break-words leading-relaxed flex-1">
                            {item.summary}
                          </p>
                        )}
                        <div className="mt-auto pt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)] border-t border-[var(--border)]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
                            {item.source}
                          </span>
                          <span>·</span>
                          <span>{item.published}</span>
                        </div>
                      </article>
                    </a>
                  ))}
                  {/* Fill remaining space with placeholder cards */}
                  {news.length < 3 && (
                    <>
                      {[...Array(3 - news.length)].map((_, i) => (
                        <div key={`placeholder-${i}`} className="flex-1 bg-gradient-to-br from-gray-50 to-[var(--accent-soft)] border border-dashed border-[var(--border)] rounded-lg p-5 flex items-center justify-center min-h-[100px]">
                          <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            <span className="text-xs text-[var(--ink-muted)]">More headlines coming soon</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-[var(--accent)] transition-colors duration-300">
                Market Sentiment
              </span>
            </div>
            <div className="flex-1">
              {sentiment ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                      sentiment.overall === "Bullish" ? "bg-emerald-100 text-emerald-700" :
                      sentiment.overall === "Bearish" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {sentiment.overall === "Bullish" ? "▲" :
                       sentiment.overall === "Bearish" ? "▼" : "—"}
                    </div>
                    <div>
                      <div className={`font-bold text-lg ${
                        sentiment.overall === "Bullish" ? "text-emerald-700" :
                        sentiment.overall === "Bearish" ? "text-red-700" :
                        "text-yellow-700"
                      }`}>
                        {sentiment.overall}
                      </div>
                      <div className="text-sm text-[var(--ink-soft)]">
                        {sentiment.summary}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-[rgba(160,82,45,0.04)] border border-[var(--border)] rounded-lg p-3 text-sm text-[var(--ink-soft)] leading-relaxed mb-3">
                    {sentiment.notes}
                  </div>
                  <div className="text-xs font-mono text-[var(--ink-muted)]">
                    AI confidence: {sentiment.confidence}%
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400">—</div>
                    <div>
                      <div className="font-bold text-lg text-gray-500">Neutral</div>
                      <div className="text-sm text-[var(--ink-soft)]">Market data temporarily unavailable</div>
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 border border-[var(--border)] rounded-lg p-4 text-sm text-gray-400 leading-relaxed flex flex-col justify-center">
                    <div className="text-center mb-4">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                      </svg>
                      <p className="text-sm text-gray-500">Unable to generate AI sentiment at this time.</p>
                    </div>
                    {/* Placeholder sentiment gauge */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-red-500">Bearish</span>
                        <span className="text-emerald-500">Bullish</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-emerald-400 opacity-30" />
                        <div className="absolute top-0 bottom-0 w-1 bg-gray-400 rounded-full left-1/2 -translate-x-1/2" />
                      </div>
                      {/* Placeholder metrics */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Fear</div>
                          <div className="text-sm font-semibold text-gray-500">--</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Greed</div>
                          <div className="text-sm font-semibold text-gray-500">--</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Momentum</div>
                          <div className="text-sm font-semibold text-gray-500">--</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[var(--ink-muted)] flex items-center justify-between">
                    <span>AI confidence: --%</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      Offline
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-green-50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-emerald-600 transition-colors duration-300">
                Top Gainers
              </span>
              <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                +{gainers.length}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {gainers.map((item) => (
                <div key={item.symbol} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm hover:border-emerald-400 hover:shadow-sm transition-all">
                  <span className="font-semibold text-[var(--ink)]">{item.symbol}</span>
                  <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">{item.change}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-100 to-rose-50 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-red-600 transition-colors duration-300">
                Top Losers
              </span>
              <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                -{losers.length}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {losers.map((item) => (
                <div key={item.symbol} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm hover:border-red-400 hover:shadow-sm transition-all">
                  <span className="font-semibold text-[var(--ink)]">{item.symbol}</span>
                  <span className="text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded">{item.change}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-blue-600 transition-colors duration-300">
                Global Snapshot
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {indices.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm hover:border-[var(--accent)] hover:shadow-sm transition-all">
                  <div>
                    <div className="text-xs text-[var(--ink-muted)]">{item.name}</div>
                    <div className="font-semibold text-[var(--ink)] text-base">{item.value}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    item.change.startsWith("-") ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50"
                  }`}>
                    {item.change}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-7 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-violet-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-purple-600 transition-colors duration-300">
                  Sector News
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {["All", "Banking", "IT", "Energy", "Pharma"].map((tab, i) => (
                  <button
                    key={tab}
                    type="button"
                    className={`relative rounded-full border px-3 py-1.5 transition-all duration-300 overflow-hidden ${
                      tab === "All" 
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md" 
                        : "border-[var(--border)] bg-white/70 text-[var(--ink-muted)] hover:border-purple-400 hover:bg-white hover:text-purple-600"
                    }`}
                  >
                    <span className="relative z-10">{tab}</span>
                    {tab === "All" && (
                      <span className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-purple-600 opacity-100" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {sectorNews.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-[var(--border)] bg-white p-4 overflow-hidden hover:border-[var(--accent)] hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] text-xs font-bold">
                      {item.sector[0]}
                    </span>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      {item.sector}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--ink)] line-clamp-2 break-words leading-snug">
                    {item.title}
                  </div>
                  <div className="mt-2 text-xs text-[var(--ink-muted)] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[var(--ink-muted)]"></span>
                    Source · {item.source}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel newsroom-panel lg:col-span-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4 group cursor-default">
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-hover)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-[var(--accent-strong)] text-lg animate-pulse">✦</span>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-[var(--ink-muted)] font-semibold group-hover:text-[var(--accent)] transition-colors duration-300">
                AI Market Insight
              </span>
              <span className="ml-auto text-xs text-[var(--ink-muted)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                AI Generated
              </span>
            </div>
            <div className="flex-1 flex flex-col">
              <h3 className="font-display text-lg text-[var(--ink)] leading-snug mb-3">
                AI reads: momentum is shifting to quality cyclicals.
              </h3>
              <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-4">
                The model highlights improving breadth in financials and selective
                industrials, while defensive sectors show muted participation.
                Watch for confirmation in global indices before adding size.
              </p>
              
              {/* AI Key Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-[var(--accent-soft)] rounded-lg p-2 text-center">
                  <div className="text-xs text-[var(--ink-muted)] mb-1">Risk Level</div>
                  <div className="text-sm font-semibold text-[var(--accent)]">Moderate</div>
                </div>
                <div className="bg-[var(--accent-soft)] rounded-lg p-2 text-center">
                  <div className="text-xs text-[var(--ink-muted)] mb-1">Volatility</div>
                  <div className="text-sm font-semibold text-emerald-600">Low</div>
                </div>
                <div className="bg-[var(--accent-soft)] rounded-lg p-2 text-center">
                  <div className="text-xs text-[var(--ink-muted)] mb-1">Trend</div>
                  <div className="text-sm font-semibold text-blue-600">Bullish</div>
                </div>
              </div>
              
              {/* Sector Breakdown */}
              <div className="space-y-2 mb-4">
                <div className="text-xs text-[var(--ink-muted)] uppercase tracking-wider">Sector Strength</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">Financials</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-emerald-500 rounded-full" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600">75%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">IT</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-yellow-500 rounded-full" />
                  </div>
                  <span className="text-xs font-medium text-yellow-600">50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">Energy</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-red-400 rounded-full" />
                  </div>
                  <span className="text-xs font-medium text-red-500">33%</span>
                </div>
              </div>
              
              <div className="mt-auto rounded-xl border border-[var(--border)] bg-white/85 p-3 text-xs text-[var(--ink-muted)]">
                AI confidence: 76% · Signal strength: Moderate · Updated 5 min ago
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
