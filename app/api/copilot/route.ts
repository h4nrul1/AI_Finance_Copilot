import { NextResponse } from "next/server";
import type { FinanceState } from "@/types/finance";
import { askFinancialCopilot, type ChatTurn } from "@/lib/ai/copilot";
import { withToday } from "@/lib/data/blank-plan";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { loadAccountPlan } from "@/lib/supabase/plan-store";
import { createServerSupabase } from "@/lib/supabase/server";

// Covers up to MAX_TOOL_ROUNDS model calls.
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;

// Per account when signed in, otherwise per visitor IP. Far above normal use; stops scripts from draining the OpenAI credits.
const checkRateLimit = createRateLimiter([
  { limit: 10, windowMs: 60_000 },
  { limit: 100, windowMs: 24 * 60 * 60_000 }
]);

function sanitizeHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is ChatTurn =>
        !!turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.trim() !== ""
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
}

/**
 * The plan to answer about. For a signed-in student's own plan, the copy saved in their account is used rather than
 * trusting what the browser sent. Guests and the demo plan use the plan from the request.
 */
async function resolvePlan(sentPlan: FinanceState, userId: string | null, supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  if (!userId || !supabase || sentPlan.mode !== "personal") return sentPlan;
  const saved = await loadAccountPlan(supabase, userId).catch(() => null);
  if (!saved) return sentPlan;
  // "Today" comes from the student's browser so it matches their time zone.
  const today = sentPlan.semester?.currentDate;
  return typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today) ? withToday(saved, today) : saved;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const userId = supabase ? ((await supabase.auth.getUser()).data.user?.id ?? null) : null;
  const rateLimit = checkRateLimit(userId ? `user:${userId}` : clientKey(request.headers));
  if (!rateLimit.allowed) {
    const wait = rateLimit.retryAfterSeconds;
    const waitText = wait < 120 ? `${wait} seconds` : wait < 3600 ? `${Math.ceil(wait / 60)} minutes` : `about ${Math.ceil(wait / 3600)} hours`;
    return NextResponse.json(
      {
        message: `You're asking questions quickly. Please try again in ${waitText}.`,
        toolCalls: [],
        rateLimited: true
      },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  try {
    const body = (await request.json()) as { message?: unknown; state?: FinanceState; history?: unknown };
    if (typeof body.message !== "string" || !body.message.trim() || !body.state) {
      return NextResponse.json({ error: "Missing message or state" }, { status: 400 });
    }

    const plan = await resolvePlan(body.state, userId, supabase);
    const answer = await askFinancialCopilot(body.message.slice(0, MAX_MESSAGE_LENGTH), plan, sanitizeHistory(body.history));
    return NextResponse.json(answer);
  } catch {
    return NextResponse.json(
      {
        message:
          "I could not process that request, but the demo is still running. Try asking about weekly spending, a trip, rent, investing, or an ETF.",
        mode: "mock",
        toolCalls: []
      },
      { status: 200 }
    );
  }
}
