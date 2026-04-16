"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import AuthNav from "./auth-nav";
import ThemeToggle from "@/components/theme-toggle";

const HIDE_HEADER_ROUTES = ["/auth/login", "/auth/register"];

function AppHeader() {
  const pathname = usePathname();
  const shouldHide = HIDE_HEADER_ROUTES.some((route) =>
    pathname?.startsWith(route),
  );

  if (shouldHide) {
    return null;
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href="/" className="app-brand">
          <Image
            src="/logo.svg"
            alt="Stock Price Prediction logo"
            className="app-brand__logo"
            width={34}
            height={34}
            priority
          />
          <span className="app-brand__text">Stock Price Prediction</span>
        </Link>
        <nav className="app-nav">
          <Link className="nav-pill" href="/">
            Home
          </Link>
          <Link className="nav-pill" href="/prediction">
            Stock Prediction
          </Link>
          <Link className="nav-pill" href="/stocks">
            Stocks
          </Link>
          <Link className="nav-pill" href="/market-news">
            Market News
          </Link>
        </nav>
        <div className="app-auth">
          <ThemeToggle size="sm" />
          <AuthNav />
        </div>
      </div>
    </header>
  );
}

export default memo(AppHeader);
