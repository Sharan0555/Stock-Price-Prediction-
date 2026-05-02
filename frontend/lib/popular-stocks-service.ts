"use client";

import { fetchJsonWithFallback } from "@/lib/api-base";
import { apiCache } from "@/lib/api-cache";

export type PopularStockSignal = "BUY" | "SELL" | "HOLD";

export type PopularStockDefinition = {
  name: string;
  symbol: string;
  apiSymbol: string;
  exchange: string;
  currency: "USD" | "INR";
};

export type PopularStockCardData = PopularStockDefinition & {
  price: number | null;
  changePct: number | null;
  source: string | null;
  predictedPrice: number | null;
  predictionChangePct: number | null;
  signal: PopularStockSignal | null;
  confidence: number | null;
  predictionLoading: boolean;
  predictionError: string | null;
  lastUpdated: number | null;
};

export type PopularStocksSnapshot = {
  stocks: PopularStockCardData[];
  updatedAt: number;
};

type BulkQuotePayload = {
  c?: number | null;
  dp?: number | null;
  pc?: number | null;
};

type BulkQuoteItem = {
  symbol: string;
  quote: BulkQuotePayload | null;
  source: string;
};

type BulkQuoteResponse = {
  stocks: BulkQuoteItem[];
};

type QuoteResponse = {
  symbol: string;
  quote: BulkQuotePayload | null;
  source: string;
};

type PredictionSnapshotResponse = {
  symbol: string;
  quote?: BulkQuotePayload | null;
  quote_source?: string;
  predictions?: {
    ensemble?: number | null;
  } | null;
  risk?: {
    signal?: PopularStockSignal | null;
    score?: number | null;
    change_pct?: number | null;
  } | null;
};

const CACHE_KEY = "popular-stocks-cache-v2";
export const POPULAR_STOCKS_STALE_MS = 5 * 60 * 1000;
const POPULAR_STOCKS_CACHE_MS = 30 * 60 * 1000;
const PREDICTION_DAYS = 60;

export const POPULAR_STOCKS: PopularStockDefinition[] = [
  { name: "Apple", symbol: "AAPL", apiSymbol: "AAPL", exchange: "NYSE", currency: "USD" },
  { name: "Microsoft", symbol: "MSFT", apiSymbol: "MSFT", exchange: "NYSE", currency: "USD" },
  { name: "Reliance Industries", symbol: "RELIANCE", apiSymbol: "RELIANCE.NS", exchange: "NSE", currency: "INR" },
  { name: "TCS", symbol: "TCS", apiSymbol: "TCS.NS", exchange: "NSE", currency: "INR" },
  { name: "Amazon", symbol: "AMZN", apiSymbol: "AMZN", exchange: "NYSE", currency: "USD" },
  { name: "NVIDIA", symbol: "NVDA", apiSymbol: "NVDA", exchange: "NYSE", currency: "USD" },
  { name: "ITC", symbol: "ITC", apiSymbol: "ITC.NS", exchange: "NSE", currency: "INR" },
  { name: "HDFC Bank", symbol: "HDFCBANK", apiSymbol: "HDFCBANK.NS", exchange: "NSE", currency: "INR" },
];

let memorySnapshot: PopularStocksSnapshot | null = null;
let inflightQuoteRefresh: Promise<PopularStocksSnapshot> | null = null;
let inflightPredictionRefresh: Promise<PopularStocksSnapshot> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function createPlaceholderStock(stock: PopularStockDefinition): PopularStockCardData {
  return {
    ...stock,
    price: null,
    changePct: null,
    source: null,
    predictedPrice: null,
    predictionChangePct: null,
    signal: null,
    confidence: null,
    predictionLoading: true,
    predictionError: null,
    lastUpdated: null,
  };
}

function createPlaceholderSnapshot(): PopularStocksSnapshot {
  return {
    stocks: POPULAR_STOCKS.map(createPlaceholderStock),
    updatedAt: 0,
  };
}

function normalizeSnapshot(snapshot: PopularStocksSnapshot): PopularStocksSnapshot {
  const stockBySymbol = new Map(snapshot.stocks.map((stock) => [stock.symbol, stock]));
  return {
    updatedAt: snapshot.updatedAt,
    stocks: POPULAR_STOCKS.map((definition) => {
      const stock = stockBySymbol.get(definition.symbol);
      return stock
        ? {
            ...createPlaceholderStock(definition),
            ...stock,
            ...definition,
          }
        : createPlaceholderStock(definition);
    }),
  };
}

function readStoredSnapshot(): PopularStocksSnapshot | null {
  if (!isBrowser()) return memorySnapshot;
  if (memorySnapshot) return memorySnapshot;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PopularStocksSnapshot;
    if (!parsed?.updatedAt || !Array.isArray(parsed.stocks)) {
      return null;
    }
    if (Date.now() - parsed.updatedAt > POPULAR_STOCKS_CACHE_MS) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    memorySnapshot = normalizeSnapshot(parsed);
    return memorySnapshot;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: PopularStocksSnapshot) {
  const normalized = normalizeSnapshot(snapshot);
  memorySnapshot = normalized;
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures.
  }
}

function getPreviousMap(previous?: PopularStocksSnapshot | null) {
  const source = previous ?? readStoredSnapshot() ?? createPlaceholderSnapshot();
  return new Map(source.stocks.map((stock) => [stock.symbol, stock]));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function calculateChangePct(price: number | null, quote?: BulkQuotePayload | null) {
  if (isFiniteNumber(quote?.dp)) {
    return quote?.dp ?? null;
  }
  if (isFiniteNumber(price) && isFiniteNumber(quote?.pc) && quote.pc !== 0) {
    return ((price - quote.pc) / quote.pc) * 100;
  }
  return null;
}

function mergeQuoteIntoStock(
  definition: PopularStockDefinition,
  previous: PopularStockCardData | undefined,
  quote?: BulkQuotePayload | null,
  source?: string | null,
  updatedAt: number = Date.now(),
): PopularStockCardData {
  const price = isFiniteNumber(quote?.c) ? quote.c : previous?.price ?? null;
  const changePct =
    calculateChangePct(isFiniteNumber(quote?.c) ? quote.c : null, quote) ??
    previous?.changePct ??
    null;

  return {
    ...createPlaceholderStock(definition),
    ...previous,
    ...definition,
    price,
    changePct,
    source: source ?? previous?.source ?? null,
    predictionLoading:
      previous?.predictedPrice == null
        ? true
        : (previous?.predictionLoading ?? false),
    lastUpdated: updatedAt,
  };
}

async function fetchBulkQuotes(
  definitions: PopularStockDefinition[],
): Promise<Map<string, BulkQuoteItem>> {
  const response = await fetchJsonWithFallback<BulkQuoteResponse>(
    `/api/v1/stocks/bulk?symbols=${encodeURIComponent(
      definitions.map((stock) => stock.apiSymbol).join(","),
    )}`,
  );

  return new Map(
    (response.stocks ?? []).map((item) => [item.symbol.toUpperCase(), item]),
  );
}

async function fetchMissingQuote(definition: PopularStockDefinition) {
  try {
    const response = await fetchJsonWithFallback<QuoteResponse>(
      `/api/v1/stocks/${encodeURIComponent(definition.apiSymbol)}/quote`,
    );
    return {
      apiSymbol: definition.apiSymbol.toUpperCase(),
      quote: response.quote,
      source: response.source,
    };
  } catch {
    return {
      apiSymbol: definition.apiSymbol.toUpperCase(),
      quote: null,
      source: "unavailable",
    };
  }
}

export function getCachedPopularStocksSnapshot() {
  return readStoredSnapshot();
}

export function isPopularStocksSnapshotFresh(snapshot: PopularStocksSnapshot | null) {
  return Boolean(snapshot && Date.now() - snapshot.updatedAt < POPULAR_STOCKS_STALE_MS);
}

export function clearPopularStocksCache() {
  memorySnapshot = null;
  if (!isBrowser()) return;
  window.localStorage.removeItem(CACHE_KEY);
}

export function getPopularStocksFallbackSnapshot() {
  return readStoredSnapshot() ?? createPlaceholderSnapshot();
}

export async function fetchPopularStockQuotesSnapshot(
  previous?: PopularStocksSnapshot | null,
): Promise<PopularStocksSnapshot> {
  if (inflightQuoteRefresh) {
    return inflightQuoteRefresh;
  }

  inflightQuoteRefresh = (async () => {
    const previousMap = getPreviousMap(previous);
    const updatedAt = Date.now();
    let quoteMap = new Map<string, BulkQuoteItem>();

    try {
      quoteMap = await fetchBulkQuotes(POPULAR_STOCKS);
    } catch {
      quoteMap = new Map();
    }

    const missingStocks = POPULAR_STOCKS.filter(
      (stock) => !quoteMap.has(stock.apiSymbol.toUpperCase()),
    );

    if (missingStocks.length > 0) {
      const missingQuotes = await Promise.all(
        missingStocks.map((stock) => fetchMissingQuote(stock)),
      );
      for (const item of missingQuotes) {
        quoteMap.set(item.apiSymbol, {
          symbol: item.apiSymbol,
          quote: item.quote,
          source: item.source,
        });
      }
    }

    const stocks = POPULAR_STOCKS.map((definition) => {
      const previousStock = previousMap.get(definition.symbol);
      const quoteEntry = quoteMap.get(definition.apiSymbol.toUpperCase());
      return mergeQuoteIntoStock(
        definition,
        previousStock,
        quoteEntry?.quote,
        quoteEntry?.source ?? previousStock?.source,
        updatedAt,
      );
    });

    const hasAtLeastOneLivePrice = stocks.some((stock) => stock.price !== null);
    if (!hasAtLeastOneLivePrice) {
      const fallbackSnapshot = readStoredSnapshot();
      if (fallbackSnapshot) {
        return fallbackSnapshot;
      }
      throw new Error("Unable to load popular stock prices right now.");
    }

    const snapshot = normalizeSnapshot({ stocks, updatedAt });
    persistSnapshot(snapshot);
    return snapshot;
  })().finally(() => {
    inflightQuoteRefresh = null;
  });

  return inflightQuoteRefresh;
}

async function fetchPredictionForStock(
  definition: PopularStockDefinition,
  previous: PopularStockCardData | undefined,
) {
  try {
    const snapshotPath = `/api/v1/predictions/${encodeURIComponent(definition.apiSymbol)}?days=${PREDICTION_DAYS}`;
    let response = apiCache.get<PredictionSnapshotResponse>(snapshotPath);

    if (!response) {
      response = await fetchJsonWithFallback<PredictionSnapshotResponse>(snapshotPath);
      apiCache.set(snapshotPath, response);
    }

    const predictedPrice = isFiniteNumber(response.predictions?.ensemble)
      ? response.predictions?.ensemble ?? null
      : previous?.predictedPrice ?? null;

    return {
      symbol: definition.symbol,
      predictedPrice,
      predictionChangePct: isFiniteNumber(response.risk?.change_pct)
        ? response.risk?.change_pct ?? null
        : previous?.predictionChangePct ?? null,
      signal: response.risk?.signal ?? previous?.signal ?? null,
      confidence: isFiniteNumber(response.risk?.score)
        ? response.risk?.score ?? null
        : previous?.confidence ?? null,
      predictionError:
        predictedPrice === null ? "Prediction is still being calculated." : null,
      quote: response.quote,
      quoteSource: response.quote_source ?? previous?.source ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Prediction is temporarily unavailable.";

    return {
      symbol: definition.symbol,
      predictedPrice: previous?.predictedPrice ?? null,
      predictionChangePct: previous?.predictionChangePct ?? null,
      signal: previous?.signal ?? null,
      confidence: previous?.confidence ?? null,
      predictionError: previous?.predictedPrice != null ? message : "Calculating...",
      quote: null,
      quoteSource: previous?.source ?? null,
    };
  }
}

export async function fetchPopularStockPredictionsSnapshot(
  baseSnapshot?: PopularStocksSnapshot | null,
): Promise<PopularStocksSnapshot> {
  if (inflightPredictionRefresh) {
    return inflightPredictionRefresh;
  }

  inflightPredictionRefresh = (async () => {
    const previousMap = getPreviousMap(baseSnapshot);
    const updatedAt = Date.now();

    const predictions = await Promise.all(
      POPULAR_STOCKS.map((definition) =>
        fetchPredictionForStock(definition, previousMap.get(definition.symbol)),
      ),
    );

    const predictionBySymbol = new Map(
      predictions.map((prediction) => [prediction.symbol, prediction]),
    );

    const stocks = POPULAR_STOCKS.map((definition) => {
      const previousStock = previousMap.get(definition.symbol);
      const prediction = predictionBySymbol.get(definition.symbol);
      const stockWithLatestQuote = mergeQuoteIntoStock(
        definition,
        previousStock,
        prediction?.quote,
        prediction?.quoteSource ?? previousStock?.source ?? null,
        updatedAt,
      );

      return {
        ...stockWithLatestQuote,
        predictedPrice: prediction?.predictedPrice ?? previousStock?.predictedPrice ?? null,
        predictionChangePct:
          prediction?.predictionChangePct ?? previousStock?.predictionChangePct ?? null,
        signal: prediction?.signal ?? previousStock?.signal ?? null,
        confidence: prediction?.confidence ?? previousStock?.confidence ?? null,
        predictionError: prediction?.predictionError ?? null,
        predictionLoading: false,
        lastUpdated: updatedAt,
      };
    });

    const snapshot = normalizeSnapshot({ stocks, updatedAt });
    persistSnapshot(snapshot);
    return snapshot;
  })().finally(() => {
    inflightPredictionRefresh = null;
  });

  return inflightPredictionRefresh;
}

export async function warmPopularStocks(previous?: PopularStocksSnapshot | null) {
  const quoteSnapshot = await fetchPopularStockQuotesSnapshot(previous);
  return fetchPopularStockPredictionsSnapshot(quoteSnapshot);
}

export function primePopularStocksPrefetch(previous?: PopularStocksSnapshot | null) {
  void warmPopularStocks(previous);
}
