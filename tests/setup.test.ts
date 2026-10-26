import { afterEach, describe, expect, it, vi } from "vitest";
import { draftPlanWithOpenAI, formatAnswers, withGoalFallback } from "@/lib/ai/setup";
import { buildProjection } from "@/lib/finance/engine";
import { draftToPlan, validateDraft, type PlanDraft } from "@/lib/finance/plan-draft";

const today = "2026-10-25";

const goodDraft: PlanDraft = {
  semester: { name: "Fall 2026", startDate: "2026-08-24", endDate: "2026-12-16" },
  cash: { checking: 2400, savings: 1000, goal: 500 },
  incomes: [{ name: "Campus job", amount: 600, frequency: "monthly", startDate: "2026-11-01", endDate: null }],
  expenses: [
    { name: "Rent", amount: 750, frequency: "monthly", startDate: "2026-11-01", endDate: null, category: "Housing", required: true },
    { name: "Going out", amount: 50, frequency: "weekly", startDate: "2026-10-25", endDate: null, category: "Dining", required: false },
    { name: "Trip home", amount: 400, frequency: "one-time", startDate: "2026-12-10", endDate: null, category: "Other", required: false }
  ],
  notes: ["I assumed rent is due on the 1st."]
};

describe("validating an AI draft", () => {
  it("keeps a clean draft unchanged with no warnings", () => {
    expect(validateDraft(goodDraft, today)).toEqual({ draft: goodDraft, warnings: [] });
  });

  it("drops unreadable items and explains why", () => {
    const { draft, warnings } = validateDraft(
      {
        ...goodDraft,
        incomes: [{ name: "", amount: 100 }, { name: "Gift", amount: -5 }, { name: "Huge", amount: 5_000_000 }],
        expenses: [{ name: "Gym", amount: 30, frequency: "fortnightly", category: "Fitness", startDate: "soon", required: "yes" }]
      },
      today
    );

    expect(draft.incomes).toEqual([]);
    expect(warnings.filter((warning) => warning.startsWith("Skipped"))).toHaveLength(3);
    // Unknown frequency, category, date, and required value fall back to safe defaults.
    expect(draft.expenses).toEqual([
      { name: "Gym", amount: 30, frequency: "one-time", startDate: today, endDate: null, category: "Other", required: false }
    ]);
  });

  it("fills in missing cash and semester details with a warning for each", () => {
    const { draft, warnings } = validateDraft({ semester: { name: "Fall", endDate: "nope" }, cash: {}, incomes: [], expenses: [] }, today);

    expect(draft.semester).toEqual({ name: "Fall", startDate: "2026-08-24", endDate: "2026-12-15" });
    expect(draft.cash).toEqual({ checking: 0, savings: 0, goal: 500 });
    expect(warnings.join(" ")).toMatch(/semester dates/);
    expect(warnings.join(" ")).toMatch(/checking balance/);
    expect(warnings.join(" ")).toMatch(/goal/);
  });

  it("survives output that isn't a plan at all", () => {
    const { draft } = validateDraft("not json", today);

    expect(draft.incomes).toEqual([]);
    expect(draft.expenses).toEqual([]);
  });

  it("warns about one-time items dated before today", () => {
    const { warnings } = validateDraft(
      { ...goodDraft, expenses: [{ ...goodDraft.expenses[2], startDate: "2026-09-01" }] },
      today
    );

    expect(warnings.join(" ")).toMatch(/before today/);
  });
});

describe("turning a draft into a plan", () => {
  it("creates a personal plan the engine can project", () => {
    const plan = draftToPlan(goodDraft, today, "Jordan");
    const projection = buildProjection(plan);

    expect(plan.mode).toBe("personal");
    expect(plan.student.name).toBe("Jordan");
    expect(plan.semester.currentDate).toBe(today);
    expect(plan.cash).toEqual({ checking: 2400, savings: 1000, targetEndingBuffer: 500 });
    expect(plan.expenses.find((expense) => expense.name === "Rent")).toMatchObject({ recurring: true, frequency: "monthly", required: true });
    const trip = plan.expenses.find((expense) => expense.name === "Trip home");
    expect(trip?.recurring).toBe(false);
    expect(trip?.frequency).toBeUndefined();
    // Income: Nov 1 + Dec 1 = $1,200. Rent: $1,500. Going out: 8 weeks x $50 = $400 (Oct 25 – Dec 13). Trip: $400.
    expect(projection.expectedRemainingIncome).toBe(1200);
    expect(projection.requiredRemainingExpenses).toBe(1500);
    expect(projection.projectedEndingBalance).toBe(2400 + 1200 - 1500 - 400 - 400);
  });
});

describe("drafting with OpenAI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the answers with a strict schema and validates the reply", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...goodDraft, incomes: [{ name: "", amount: 1 }] }) } }] }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await draftPlanWithOpenAI("test-key", [{ id: "housing", answer: "Rent $750 on the 1st" }], today);
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.messages[1].content).toContain("Today is 2026-10-25");
    expect(request.messages[1].content).toContain("Rent $750 on the 1st");
    expect(result.draft.incomes).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/Skipped/);
  });

  it("reads the goal from its own answer when the model misses it", () => {
    const raw = { ...goodDraft, cash: { checking: 2400, savings: 0, goal: null } };

    expect(withGoalFallback(raw, [{ id: "goal", answer: "at least $1,200 please" }])).toMatchObject({ cash: { goal: 1200 } });
    expect(withGoalFallback(raw, [{ id: "goal", answer: "not sure" }])).toBe(raw);
    expect(withGoalFallback(goodDraft, [{ id: "goal", answer: "900" }])).toBe(goodDraft);
  });

  it("marks skipped questions so the model doesn't guess", () => {
    expect(formatAnswers([{ id: "cash", answer: "  " }])).toContain("A: (skipped)");
  });
});
