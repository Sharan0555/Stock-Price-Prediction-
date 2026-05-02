"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import PopularStocksSection from "@/components/popular-stocks-section";

// Main Home Component
export default function Home() {
  const router = useRouter();

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

      <PopularStocksSection />
    </div>
  );
}
