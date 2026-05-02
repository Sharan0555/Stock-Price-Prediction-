"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken, setUserEmail } from "@/lib/auth";
import { fetchWithApiFallback, readApiErrorMessage } from "@/lib/api-base";
import { primePopularStocksPrefetch } from "@/lib/popular-stocks-service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const res = await fetchWithApiFallback("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError(await readApiErrorMessage(res, "Login failed. Please try again."));
        return;
      }

      const data = await res.json();
      setToken(data.access_token);
      setUserEmail(data.user?.email ?? email.trim().toLowerCase());
      primePopularStocksPrefetch();
      router.replace("/");
    } catch (err: unknown) {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Stock Price Prediction logo"
              className="h-10 w-10"
              width={40}
              height={40}
              priority
            />
            <span className="text-sm font-semibold text-[var(--ink)]">
              Stock Price Prediction
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Login
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Sign in to access your stock insights.
          </p>
        </header>

        <form onSubmit={onSubmit} className="panel p-5" noValidate>
          <label className="mb-1 block text-sm text-[var(--ink)]" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mb-3 w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] caret-[var(--accent-strong)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />

          <label
            className="mb-1 block text-sm text-[var(--ink)]"
            htmlFor="login-password"
          >
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mb-4 w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] caret-[var(--accent-strong)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)] disabled:bg-[var(--border)]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {error && (
            <div
              id="login-error"
              className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            No account?{" "}
            <Link
              className="text-[var(--accent-strong)] hover:text-[var(--accent)]"
              href="/auth/register"
            >
              Register
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
