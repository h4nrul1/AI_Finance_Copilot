import { NextResponse } from "next/server";
import type { FinanceState } from "@/types/finance";
import { askFinancialCopilot, type ChatTurn } from "@/lib/ai/copilot";

// Covers up to MAX_TOOL_ROUNDS model calls.
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; state?: FinanceState; history?: unknown };
    if (typeof body.message !== "string" || !body.message.trim() || !body.state) {
      return NextResponse.json({ error: "Missing message or state" }, { status: 400 });
    }

    const answer = await askFinancialCopilot(body.message.slice(0, MAX_MESSAGE_LENGTH), body.state, sanitizeHistory(body.history));
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
