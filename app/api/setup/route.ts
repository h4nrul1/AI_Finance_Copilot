import { NextResponse } from "next/server";
import { draftPlanWithOpenAI } from "@/lib/ai/setup";
import { SETUP_QUESTIONS, type SetupAnswer } from "@/lib/finance/plan-draft";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_ANSWER_LENGTH = 600;

// Setup is a one-time step, so the limit is lower than the copilot's.
const checkRateLimit = createRateLimiter([
  { limit: 5, windowMs: 60_000 },
  { limit: 30, windowMs: 24 * 60 * 60_000 }
]);

function sanitizeAnswers(value: unknown): SetupAnswer[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>(SETUP_QUESTIONS.map((question) => question.id));
  return value
    .filter((item): item is SetupAnswer => !!item && ids.has(item.id) && typeof item.answer === "string")
    .map((item) => ({ id: item.id, answer: item.answer.slice(0, MAX_ANSWER_LENGTH) }));
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(clientKey(request.headers));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate-limited", message: `Too many setup attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { answers?: unknown; today?: unknown };
  const answers = sanitizeAnswers(body.answers);
  const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!today || answers.every((item) => !item.answer.trim())) {
    return NextResponse.json({ error: "bad-request", message: "Answer at least one question first." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ai-unavailable", message: "The AI setup isn't available right now." }, { status: 503 });
  }

  try {
    return NextResponse.json(await draftPlanWithOpenAI(apiKey, answers, today));
  } catch (error) {
    console.error("[setup] Drafting failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "ai-unavailable", message: "The AI couldn't draft your plan right now." }, { status: 503 });
  }
}
