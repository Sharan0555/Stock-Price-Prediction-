import { fetchJsonWithFallback } from "@/lib/api-base";

type BatchPriceResponse = {
  symbol: string;
  price: number;
  change_pct?: number | null;
  ts: number;
  source: string;
};

export const POPULAR_STOCKS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "TSLA",
  "NVDA",
  "AMZN",
  "META",
  "NFLX",
  "AMD",
  "INTC",
  "RELIANCE.NSE",
  "TCS.NSE",
  "INFY.NSE",
];

export async function fetchBatchPrices(
  symbols: string[],
): Promise<Record<string, { price: number; changePct?: number; ts: number }>> {
  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean)),
  );
  if (!uniqueSymbols.length) {
    return {};
  }

  const params = new URLSearchParams({
    symbols: uniqueSymbols.join(","),
  });
  const response = await fetchJsonWithFallback<BatchPriceResponse[]>(
    `/api/v1/stocks/batch-price?${params.toString()}`,
  );

  return response.reduce<Record<string, { price: number; changePct?: number; ts: number }>>(
    (accumulator, item) => {
      accumulator[item.symbol] = {
        price: item.price,
        changePct:
          typeof item.change_pct === "number" ? item.change_pct : undefined,
        ts: item.ts,
      };
      return accumulator;
    },
    {},
  );
}
