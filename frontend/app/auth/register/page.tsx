"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { fetchWithApiFallback } from "@/lib/api-base";
import { setToken, setUserEmail } from "@/lib/auth";
import GoogleAuthButton from "@/app/google-auth-button";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const res = await fetchWithApiFallback("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Register failed (${res.status})`);
      }
      const data = await res.json();
      setToken(data.access_token);
      setUserEmail(email);
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Register failed");
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
            Register
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Create an account to personalize your market experience.
          </p>
        </header>

        <form onSubmit={onSubmit} className="panel p-5">
          <label className="mb-1 block text-sm text-[var(--ink)]">Email</label>
          <input
            className="mb-3 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label className="mb-1 block text-sm text-[var(--ink)]">
            Password
          </label>
          <input
            type="password"
            className="mb-4 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 characters"
          />

          <button
            disabled={loading}
            className="w-full rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)] disabled:bg-[var(--border)]"
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          {error && (
            <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <GoogleAuthButton onError={setError} mode="register" />

          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            Already have an account?{" "}
            <Link
              className="text-[var(--accent-strong)] hover:text-[var(--accent)]"
              href="/auth/login"
            >
              Login
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
