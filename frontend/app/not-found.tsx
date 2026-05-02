import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--ink-muted)]">
        404
      </p>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)]">
        Page not found
      </h1>
      <p className="max-w-xl text-sm text-[var(--ink-soft)]">
        The page you were looking for is not available. Head back to the dashboard
        to continue browsing market data.
      </p>
      <Link
        href="/"
        className="rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)]"
      >
        Return home
      </Link>
    </main>
  );
}
