import { PRACTICE_SYMBOLS } from "./symbols";

export interface Quote {
  price: number;
  /** Previous trading day's close, when the data source has it. */
  previousClose: number | null;
}

export interface QuoteResult {
  quotes: Record<string, Quote>;
  /** ISO time the prices were fetched. */
  asOf: string;
}

const DATA_URL = "https://data.alpaca.markets/v2/stocks/snapshots";
const CACHE_MS = 30_000;

interface AlpacaSnapshot {
  latestTrade?: { p?: number };
  dailyBar?: { c?: number };
  prevDailyBar?: { c?: number };
}

export function alpacaKeys() {
  const id = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  return id && secret ? { id, secret } : null;
}

/** Pulls usable prices out of an Alpaca snapshots response. Symbols without a positive price are left out. */
export function parseSnapshots(payload: unknown): Record<string, Quote> {
  const quotes: Record<string, Quote> = {};
  if (!payload || typeof payload !== "object") return quotes;
  for (const [symbol, snapshot] of Object.entries(payload as Record<string, AlpacaSnapshot>)) {
    const price = snapshot?.latestTrade?.p ?? snapshot?.dailyBar?.c;
    if (typeof price !== "number" || !(price > 0)) continue;
    const previous = snapshot.prevDailyBar?.c;
    quotes[symbol] = { price, previousClose: typeof previous === "number" && previous > 0 ? previous : null };
  }
  return quotes;
}

let cached: { at: number; result: QuoteResult } | null = null;

/**
 * Latest prices for every practice symbol in one request, cached briefly so many students share one call.
 * Uses Alpaca's free IEX feed. Throws when the request fails.
 */
export async function fetchPracticeQuotes(keys: { id: string; secret: string }, now: () => number = Date.now): Promise<QuoteResult> {
  if (cached && now() - cached.at < CACHE_MS) return cached.result;

  const symbols = PRACTICE_SYMBOLS.map((item) => item.symbol).join(",");
  const response = await fetch(`${DATA_URL}?symbols=${symbols}&feed=iex`, {
    headers: { "APCA-API-KEY-ID": keys.id, "APCA-API-SECRET-KEY": keys.secret },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Alpaca responded ${response.status}`);

  const result: QuoteResult = { quotes: parseSnapshots(await response.json()), asOf: new Date(now()).toISOString() };
  cached = { at: now(), result };
  return result;
}
