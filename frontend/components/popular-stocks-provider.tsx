"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AUTH_STATE_CHANGE_EVENT } from "@/lib/auth";
import {
  POPULAR_STOCKS_STALE_MS,
  fetchPopularStockPredictionsSnapshot,
  fetchPopularStockQuotesSnapshot,
  getCachedPopularStocksSnapshot,
  getPopularStocksFallbackSnapshot,
  isPopularStocksSnapshotFresh,
  type PopularStockCardData,
  type PopularStocksSnapshot,
} from "@/lib/popular-stocks-service";

type PopularStocksContextValue = {
  stocks: PopularStockCardData[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  retry: () => Promise<void>;
};

const PopularStocksContext = createContext<PopularStocksContextValue | null>(null);

type PopularStocksProviderProps = {
  children: ReactNode;
};

function toMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Failed to refresh popular stocks.";
}

export function PopularStocksProvider({ children }: PopularStocksProviderProps) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<PopularStocksSnapshot>(() =>
    getCachedPopularStocksSnapshot() ?? getPopularStocksFallbackSnapshot(),
  );
  const [loading, setLoading] = useState<boolean>(
    () => !getCachedPopularStocksSnapshot(),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStocks = useCallback(async (force = false) => {
    const cached = getCachedPopularStocksSnapshot();

    if (cached) {
      setSnapshot(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (!force && cached && isPopularStocksSnapshotFresh(cached)) {
      setError(null);
      setRefreshing(true);
    } else {
      setRefreshing(Boolean(cached));
    }
    setError(null);

    try {
      const quoteSnapshot = await fetchPopularStockQuotesSnapshot(cached);
      setSnapshot(quoteSnapshot);
      setLoading(false);

      const finalSnapshot = await fetchPopularStockPredictionsSnapshot(quoteSnapshot);
      setSnapshot(finalSnapshot);
      setError(null);
    } catch (nextError) {
      setError(toMessage(nextError));
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshStocks(false);
  }, [pathname, refreshStocks]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshStocks(false);
    }, POPULAR_STOCKS_STALE_MS);

    const handleAuthChange = () => {
      void refreshStocks(false);
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    };
  }, [refreshStocks]);

  const value = useMemo<PopularStocksContextValue>(
    () => ({
      stocks: snapshot.stocks,
      loading,
      refreshing,
      error,
      retry: async () => {
        await refreshStocks(true);
      },
    }),
    [error, loading, refreshStocks, refreshing, snapshot.stocks],
  );

  return (
    <PopularStocksContext.Provider value={value}>
      {children}
    </PopularStocksContext.Provider>
  );
}

export function usePopularStocks() {
  const context = useContext(PopularStocksContext);
  if (!context) {
    throw new Error("usePopularStocks must be used within PopularStocksProvider");
  }
  return context;
}
