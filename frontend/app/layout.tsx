import type { Metadata } from "next";
import AuthGate from "./auth-gate";
import AppHeader from "./app-header";
import PageTransition from "./page-transition";
import { PopularStocksProvider } from "@/components/popular-stocks-provider";
import { ThemeProvider } from "@/lib/theme-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Stock Price Prediction",
  description: "AI stock prediction, risk, portfolio dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <PopularStocksProvider>
            <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
              <AuthGate>
                <AppHeader />
                <PageTransition>{children}</PageTransition>
              </AuthGate>
            </div>
          </PopularStocksProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
