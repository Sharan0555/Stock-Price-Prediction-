import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import AuthGate from "./auth-gate";
import AppHeader from "./app-header";
import PageTransition from "./page-transition";
import "./globals.css";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

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
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
          <AuthGate>
            <AppHeader />
            <PageTransition>{children}</PageTransition>
          </AuthGate>
        </div>
      </body>
    </html>
  );
}
