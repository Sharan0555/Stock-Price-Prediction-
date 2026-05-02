"use client";

export default function PortfolioPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Portfolio</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--paper-strong)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Holdings</h2>
            <p className="text-[var(--ink-muted)]">Your current stock holdings and positions will appear here.</p>
          </div>
          <div className="bg-[var(--paper-strong)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Performance</h2>
            <p className="text-[var(--ink-muted)]">Portfolio performance metrics and returns will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
