"use client";

import { memo } from "react";

import { SkeletonStockCard } from "@/components/skeleton";
import { usePopularStocks } from "@/components/popular-stocks-provider";
import { PopularStockCard } from "@/components/popular-stock-card";

const SkeletonGrid = memo(function SkeletonGrid() {
  return (
    <div className="stock-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <SkeletonStockCard key={index} />
      ))}
    </div>
  );
});

export default function PopularStocksSection() {
  const { stocks, loading, refreshing, error, retry } = usePopularStocks();
  const showSkeletons = loading && stocks.every((stock) => stock.price === null);

  return (
    <section className="px-6 pb-16 lg:px-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[var(--ink)] mb-4 dark:text-gray-100">
            Popular Stocks
          </h2>
          <p className="text-lg text-[var(--ink-soft)] dark:text-gray-400">
            Real-time prices and AI-powered predictions for market favorites
          </p>
          {refreshing && (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Refreshing prices and predictions in the background.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            <div>{error}</div>
            <button onClick={() => void retry()} className="btn-secondary mt-3">
              Retry
            </button>
          </div>
        )}

        {showSkeletons ? (
          <SkeletonGrid />
        ) : (
          <div className="stock-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stocks.map((stock, index) => (
              <div key={stock.symbol} className={`reveal delay-${Math.min((index % 3) + 1, 3)}`}>
                <PopularStockCard stock={stock} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
