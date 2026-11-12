import { describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { detectIntent, mockCopilot } from "@/lib/ai/copilot";
import { buildSuggestions } from "@/lib/ai/suggestions";
import { buildProjection } from "@/lib/finance/engine";
import type { FinanceState } from "@/types/finance";

function suggestionsFor(state: FinanceState) {
  return buildSuggestions(state, buildProjection(state));
}

describe("copilot suggestions", () => {
  it("uses the student's own months and job instead of fixed demo text", () => {
    const suggestions = suggestionsFor(demoState);
    // Demo "today" is 2026-09-29, so the near month is October and the semester ends in December.
    expect(suggestions).toContain("How much can I spend in December?");
    expect(suggestions.some((text) => /purchase in October\?$/.test(text))).toBe(true);
    expect(suggestions).toContain("What happens if I stop working (Part-time campus job) in October?");
  });

  it("follows the plan when it changes", () => {
    const later: FinanceState = { ...demoState, semester: { ...demoState.semester, currentDate: "2026-11-20" } };
    const suggestions = suggestionsFor(later);
    expect(suggestions.some((text) => /purchase in December\?$/.test(text))).toBe(true);
    // The campus job ends 2026-11-30: stopping in November is the only month left to ask about.
    expect(suggestions).toContain("What happens if I stop working (Part-time campus job) in November?");

    const noJob: FinanceState = { ...demoState, incomes: demoState.incomes.filter((income) => !income.recurring) };
    expect(suggestionsFor(noJob).some((text) => /stop working/.test(text))).toBe(false);
  });

  it("only suggests what an empty plan can answer", () => {
    const suggestions = suggestionsFor(createBlankPlan("2026-11-11"));
    expect(suggestions.some((text) => /stop working|rent|spending the most|invest/.test(text))).toBe(false);
    expect(suggestions).toContain("What is an ETF?");
  });

  it("phrases every suggestion so the offline copilot answers it without a follow-up question", () => {
    for (const state of [demoState, createBlankPlan("2026-09-15")]) {
      for (const suggestion of suggestionsFor(state)) {
        expect(detectIntent(suggestion, state).kind, suggestion).not.toBe("clarify");
        const answer = mockCopilot(suggestion, state);
        expect(answer.toolCalls.every((call) => call.ok), suggestion).toBe(true);
      }
    }
  });

  it("routes plan questions to the matching tools", () => {
    const tools = Object.fromEntries(
      suggestionsFor(demoState).map((text) => {
        const intent = detectIntent(text, demoState);
        return [text, intent.kind === "tool" ? intent.name : intent.kind];
      })
    );
    expect(tools["How much can I safely spend each week?"]).toBe("get_semester_snapshot");
    expect(tools["How much can I spend in December?"]).toBe("find_max_affordable");
    expect(tools["What happens if I stop working (Part-time campus job) in October?"]).toBe("simulate_income_loss");
    expect(tools["What is an ETF?"]).toBe("education");
  });
});
