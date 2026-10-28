import { NextResponse } from "next/server";
import { extractExtrasWithOpenAI } from "@/lib/ai/setup";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_TEXT_LENGTH = 800;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Setup is a one-time step, so the limit is lower than the copilot's.
const checkRateLimit = createRateLimiter([
  { limit: 5, windowMs: 60_000 },
  { limit: 30, windowMs: 24 * 60 * 60_000 }
]);

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(clientKey(request.headers));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate-limited", message: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { text?: unknown; today?: unknown; semester?: { name?: unknown; endDate?: unknown } };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  const today = typeof body.today === "string" && ISO_DATE.test(body.today) ? body.today : null;
  const semesterName = typeof body.semester?.name === "string" ? body.semester.name.slice(0, 40) : "";
  const semesterEnd = typeof body.semester?.endDate === "string" && ISO_DATE.test(body.semester.endDate) ? body.semester.endDate : null;
  if (!text || !today || !semesterEnd) {
    return NextResponse.json({ error: "bad-request", message: "Nothing to add." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ai-unavailable", message: "The AI isn't available right now." }, { status: 503 });
  }

  try {
    return NextResponse.json(await extractExtrasWithOpenAI(apiKey, text, today, { name: semesterName, endDate: semesterEnd }));
  } catch (error) {
    console.error("[setup] Extracting extras failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "ai-unavailable", message: "The AI couldn't read that right now." }, { status: 503 });
  }
}
