import { fetchJsonWithFallback } from "@/lib/api-base";

export type StockChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type StockChatPayload = {
  currentTicker?: string | null;
  currentPrice?: number | null;
  predictedPrice?: number | null;
  messages: StockChatMessage[];
};

export async function sendStockChatMessage(payload: StockChatPayload): Promise<string> {
  const res = await fetchJsonWithFallback<{ reply: string }>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.reply;
}

