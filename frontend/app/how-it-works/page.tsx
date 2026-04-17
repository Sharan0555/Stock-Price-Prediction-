"use client";

import { Search, Database, Brain, BarChart2, Newspaper, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

const steps = [
  {
    number: 1,
    title: "Enter a Stock Symbol",
    description:
      "The user searches for any stock ticker (e.g. AAPL, TSLA) using the search interface on the Stocks page.",
    icon: Search,
  },
  {
    number: 2,
    title: "Fetch Market Data",
    description:
      "The Next.js frontend sends a request to the FastAPI backend, which fetches real-time and historical price data from Finnhub and Alpha Vantage APIs. A local JSON fallback is used for demo mode.",
    icon: Database,
  },
  {
    number: 3,
    title: "LSTM Model Predicts Future Prices",
    description:
      "The backend runs the historical data through a trained LSTM (Long Short-Term Memory) deep learning model. LSTM is specially suited for time-series data like stock prices because it learns patterns across time.",
    icon: Brain,
  },
  {
    number: 4,
    title: "Results Displayed on Dashboard",
    description:
      "Predicted prices, confidence trends, and buy/sell strategy signals are returned via REST API and rendered on an interactive chart in the Next.js dashboard.",
    icon: BarChart2,
  },
  {
    number: 5,
    title: "Stay Updated with Market News",
    description:
      "The platform also aggregates relevant financial news and sentiment for each stock, helping users make more informed decisions alongside the ML predictions.",
    icon: Newspaper,
  },
];

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = "How It Works | Stock Price Prediction";
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lg:py-14">
      {/* Page Header */}
      <header className="mb-12 text-center">
        <div className="mb-3 text-xs uppercase tracking-widest font-semibold text-[var(--ink-muted)]">
          Our Process
        </div>
        <h1 className="text-4xl font-bold text-[var(--ink)] mb-4 dark:text-gray-100">
          How It Works
        </h1>
        <p className="mx-auto max-w-2xl text-[var(--ink-soft)] dark:text-gray-400">
          Discover how our AI-powered stock prediction platform transforms market data into actionable insights.
        </p>
      </header>

      {/* Steps Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {steps.map((step) => (
          <article
            key={step.number}
            className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-md transition-all hover:border-[var(--accent)] hover:shadow-lg dark:bg-gray-800 dark:border-gray-600"
          >
            {/* Icon above the step number badge */}
            <div className="flex justify-center mb-3">
              <step.icon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </div>
            
            {/* Step Number Badge */}
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                {step.number}
              </div>
            </div>
            
            {/* Step Title */}
            <h2 className="mb-3 text-lg font-bold text-center text-[var(--ink)] dark:text-gray-100">
              {step.title}
            </h2>
            
            {/* Step Description */}
            <p className="text-sm leading-relaxed text-center text-[var(--ink-soft)] dark:text-gray-300">
              {step.description}
            </p>
          </article>
        ))}
      </section>

      {/* Disclaimer Card */}
      <section className="mx-auto max-w-3xl">
        <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/50">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Educational Purpose Only</span> — All predictions are for learning and demonstration only. This is not financial advice.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
