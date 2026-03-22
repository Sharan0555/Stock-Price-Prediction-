"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJsonWithFallback } from "@/lib/api-base";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  ts: number;
};

type QuoteResponse = {
  symbol?: string;
  quote?: {
    c?: number;
    pc?: number;
    o?: number;
    h?: number;
    l?: number;
  };
  source?: string;
};

const SUGGESTIONS = [
  "What's the market trend today?",
  "AAPL price",
  "Explain this stock signal",
  "How do I read the prediction?",
];

const US_SNAPSHOT = ["AAPL", "MSFT", "AMZN", "NVDA", "GOOGL"];
const INR_SNAPSHOT = ["RELIANCE.NS", "TCS.NS", "ITC.NS", "HDFCBANK.NS", "INFY.NS"];

const SYMBOL_ALIASES: Record<string, string> = {
  reliance: "RELIANCE.NS",
  tcs: "TCS.NS",
  infy: "INFY.NS",
  hdfc: "HDFCBANK.NS",
  hdfcbank: "HDFCBANK.NS",
  wipro: "WIPRO.NS",
  "tata motors": "TATAMOTORS.NS",
  tcsn: "TCS.NS",
};

const EXCLUDED_TOKENS = new Set([
  "BUY",
  "SELL",
  "HOLD",
  "USD",
  "INR",
  "AI",
  "ETF",
  "IPO",
  "API",
  "GDP",
  "CPI",
]);

const formatPct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatMoney = (value: number, symbol: string) => {
  const isInr = symbol.endsWith(".NS") || symbol.endsWith(".BSE") || symbol.endsWith(".BO");
  const prefix = isInr ? "₹" : "$";
  return `${prefix}${value.toFixed(2)}`;
};

const extractSymbols = (input: string) => {
  const symbols = new Set<string>();
  const lower = input.toLowerCase();
  for (const [alias, symbol] of Object.entries(SYMBOL_ALIASES)) {
    if (lower.includes(alias)) symbols.add(symbol);
  }
  const tokens = input.toUpperCase().match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/g) ?? [];
  for (const token of tokens) {
    if (EXCLUDED_TOKENS.has(token)) continue;
    if (token.length < 2) continue;
    symbols.add(token);
  }
  return Array.from(symbols).slice(0, 3);
};

const fetchQuote = async (symbol: string) => {
  const endpoint = `/api/v1/stocks/${encodeURIComponent(symbol)}/quote?allow_local=false`;
  try {
    return await fetchJsonWithFallback<QuoteResponse>(endpoint);
  } catch {
    try {
      return await fetchJsonWithFallback<QuoteResponse>(
        endpoint.replace("allow_local=false", "allow_local=true"),
      );
    } catch {
      return null;
    }
  }
};

const buildQuoteReply = async (symbols: string[]) => {
  if (!symbols.length) return null;
  const quotes = await Promise.all(symbols.map((symbol) => fetchQuote(symbol)));
  const lines = quotes
    .map((quote, idx) => {
      const symbol = symbols[idx];
      const price = quote?.quote?.c;
      const prev = quote?.quote?.pc;
      if (price === undefined || price === 0) return null;
      const change = prev ? ((price - prev) / prev) * 100 : 0;
      return `${symbol}: ${formatMoney(price, symbol)} (${formatPct(change)})`;
    })
    .filter(Boolean);
  if (!lines.length) return "I couldn't fetch live prices right now. Try again in a minute.";
  return `Here’s the latest snapshot:\n${lines.join("\n")}`;
};

const buildMarketSummary = async () => {
  const [usQuotes, inrQuotes] = await Promise.all([
    Promise.all(US_SNAPSHOT.map((symbol) => fetchQuote(symbol))),
    Promise.all(INR_SNAPSHOT.map((symbol) => fetchQuote(symbol))),
  ]);

  const summarize = (symbols: string[], quotes: (QuoteResponse | null)[]) => {
    const moves = symbols
      .map((symbol, idx) => {
        const quote = quotes[idx];
        const price = quote?.quote?.c;
        const prev = quote?.quote?.pc;
        if (!price || !prev) return null;
        const change = ((price - prev) / prev) * 100;
        return { symbol, change, price };
      })
      .filter(Boolean) as { symbol: string; change: number; price: number }[];
    if (!moves.length) return null;
    const avg = moves.reduce((sum, item) => sum + item.change, 0) / moves.length;
    const adv = moves.filter((item) => item.change >= 0).length;
    const dec = moves.length - adv;
    const leader = [...moves].sort((a, b) => b.change - a.change)[0];
    const laggard = [...moves].sort((a, b) => a.change - b.change)[0];
    return {
      avg,
      adv,
      dec,
      leader,
      laggard,
    };
  };

  const us = summarize(US_SNAPSHOT, usQuotes);
  const inr = summarize(INR_SNAPSHOT, inrQuotes);

  if (!us && !inr) {
    return "Live market data is unavailable right now. Try again in a minute.";
  }

  const lines: string[] = [];
  if (us) {
    lines.push(
      `US pulse: ${us.adv} up / ${us.dec} down · avg ${formatPct(us.avg)} · lead ${us.leader.symbol} ${formatPct(us.leader.change)} · lag ${us.laggard.symbol} ${formatPct(us.laggard.change)}`,
    );
  }
  if (inr) {
    lines.push(
      `India pulse: ${inr.adv} up / ${inr.dec} down · avg ${formatPct(inr.avg)} · lead ${inr.leader.symbol} ${formatPct(inr.leader.change)} · lag ${inr.laggard.symbol} ${formatPct(inr.laggard.change)}`,
    );
  }
  return lines.join("\n");
};

const buildReply = async (input: string) => {
  const lower = input.toLowerCase();
  if (lower === "clear" || lower === "/clear") {
    return "__clear__";
  }
  if (lower.includes("market") && lower.includes("today")) {
    return await buildMarketSummary();
  }
  if (lower.includes("price") || lower.includes("quote") || lower.includes("stock")) {
    const symbols = extractSymbols(input);
    const quoteReply = await buildQuoteReply(symbols);
    if (quoteReply) return quoteReply;
    return "Tell me a ticker (like AAPL or RELIANCE.NS) and I’ll pull a live price.";
  }
  if (lower.includes("signal")) {
    return "Signals blend momentum, trend, and risk. BUY means upward bias, SELL suggests downside risk, and HOLD is neutral.";
  }
  if (lower.includes("prediction")) {
    return "Predictions use recent price history to project a short-term range. Use them with risk management, not as guarantees.";
  }
  if (lower.includes("portfolio")) {
    return "The portfolio tab helps you track positions, risk, and exposure. Add tickers to see a combined risk view.";
  }
  if (lower.includes("help") || lower.includes("what can you do")) {
    return "Ask me for live prices (AAPL, RELIANCE.NS), market pulse, or explanations of signals and predictions.";
  }
  const symbols = extractSymbols(input);
  if (symbols.length) {
    const quoteReply = await buildQuoteReply(symbols);
    if (quoteReply) return quoteReply;
  }
  return "I can help explain signals, predictions, and market data. Ask about any stock or feature.";
};

const formatTime = (ts: number) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));

const getNow = () => new Date().getTime();
const INITIAL_TS = getNow();

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm Pulse, your market assistant. Ask me about signals, prices, or predictions.",
  ts: INITIAL_TS,
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messageIdRef = useRef(0);

  const canSend = input.trim().length > 0 && !typing;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    messageIdRef.current += 1;
    const id = `user-${messageIdRef.current}`;
    setMessages((prev) => [
      ...prev,
      { id, role: "user", text: trimmed, ts: getNow() },
    ]);
    setInput("");
    setTyping(true);
    const reply = await buildReply(trimmed);
    if (reply === "__clear__") {
      setMessages([
        {
          ...WELCOME_MESSAGE,
          text: "Conversation cleared. Ask me about signals, prices, or predictions.",
          ts: getNow(),
        },
      ]);
      setTyping(false);
      return;
    }
    messageIdRef.current += 1;
    setMessages((prev) => [
      ...prev,
      { id: `assistant-${messageIdRef.current}`, role: "assistant", text: reply, ts: getNow() },
    ]);
    setTyping(false);
  };

  const suggestionSet = useMemo(
    () => SUGGESTIONS.filter((s) => s.toLowerCase() !== input.toLowerCase()),
    [input],
  );

  const handleClear = () => {
    setMessages([
      {
        ...WELCOME_MESSAGE,
        text: "Conversation cleared. Ask me about signals, prices, or predictions.",
        ts: getNow(),
      },
    ]);
  };

  return (
    <div className="chatbot">
      {open && (
        <div className="chatbot__panel">
          <div className="chatbot__header">
            <div>
              <div className="chatbot__title">Pulse Assistant</div>
              <div className="chatbot__subtitle">Live insights, warm and human</div>
            </div>
            <div className="chatbot__header-actions">
              <button
                type="button"
                className="chatbot__ghost"
                onClick={handleClear}
              >
                Clear
              </button>
            <button
              type="button"
              className="chatbot__icon"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              X
            </button>
            </div>
          </div>

          <div className="chatbot__messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot__bubble chatbot__bubble--${msg.role}`}
              >
                <div className="chatbot__text">{msg.text}</div>
                <div className="chatbot__time">{formatTime(msg.ts)}</div>
              </div>
            ))}
            {typing && (
              <div className="chatbot__bubble chatbot__bubble--assistant chatbot__bubble--typing">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chatbot__suggestions">
            {suggestionSet.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chatbot__chip"
                onClick={() => sendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="chatbot__composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) sendMessage(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about a stock, signal, or trend..."
              className="chatbot__input"
              rows={1}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) sendMessage(input);
                }
              }}
            />
            <button
              type="submit"
              className="chatbot__send"
              disabled={!canSend}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chatbot__fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Open chat"
      >
        <span className="chatbot__fab-ring" />
        <span className="chatbot__fab-text">{open ? "Close" : "Chat"}</span>
      </button>
    </div>
  );
}
