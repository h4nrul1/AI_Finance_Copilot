import { NextResponse } from "next/server";
import { alpacaKeys, fetchPracticeQuotes } from "@/lib/market/quotes";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

// Prices are shared and cached for 30 seconds, so this only stops scripts from hammering the route.
const checkRateLimit = createRateLimiter([{ limit: 30, windowMs: 60_000 }]);

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(clientKey(request.headers));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate-limited", message: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const keys = alpacaKeys();
  if (!keys) {
    return NextResponse.json({ error: "quotes-unavailable", message: "Live prices aren't set up on this server." }, { status: 503 });
  }

  try {
    return NextResponse.json(await fetchPracticeQuotes(keys));
  } catch (error) {
    console.error("[quotes] Fetching prices failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "quotes-unavailable", message: "Couldn't get prices right now." }, { status: 503 });
  }
}
