"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken, getUserEmail } from "@/lib/auth";

export default function AuthNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAuthed = useMemo(() => {
    if (!pathname) return false;
    return Boolean(getToken());
  }, [pathname]);
  const userEmail = useMemo(() => {
    if (!pathname) return null;
    return getUserEmail();
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

  // Before mount: render placeholder that matches server output
  if (!isMounted) {
    return (
      <>
        <Link
          className="font-semibold text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
          href="/auth/login"
        >
          Login
        </Link>
        <Link
          className="font-semibold text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
          href="/auth/register"
        >
          Register
        </Link>
      </>
    );
  }

  // After mount: render auth-aware UI
  if (!isAuthed) {
    return (
      <>
        <Link
          className="font-semibold text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
          href="/auth/login"
        >
          Login
        </Link>
        <Link
          className="font-semibold text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
          href="/auth/register"
        >
          Register
        </Link>
      </>
    );
  }

  const displayName = userEmail
    ? userEmail
        .split("@")[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ")
    : "Account";

  return (
    <div className="auth-menu" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="auth-button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="auth-avatar" aria-hidden="true">
          {displayName.charAt(0)}
        </span>
        <span className="auth-button__text">{displayName}</span>
        <span className={`auth-chevron ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {menuOpen && (
        <div className="auth-dropdown" role="menu">
          <div className="auth-dropdown__name">{displayName}</div>
          <div className="auth-email">{userEmail ?? "Signed in"}</div>
          <button
            type="button"
            onClick={() => {
              clearToken();
              setMenuOpen(false);
              router.replace("/auth/login");
            }}
            className="auth-logout"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
