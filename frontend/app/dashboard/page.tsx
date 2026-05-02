"use client";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[var(--paper-strong)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Portfolio Overview</h2>
            <p className="text-[var(--ink-muted)]">Your portfolio summary and performance metrics will appear here.</p>
          </div>
          <div className="bg-[var(--paper-strong)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <p className="text-[var(--ink-muted)]">Your recent trading activity and predictions will appear here.</p>
          </div>
          <div className="bg-[var(--paper-strong)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Market Insights</h2>
            <p className="text-[var(--ink-muted)]">Market analysis and insights will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
