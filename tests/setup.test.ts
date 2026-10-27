import { afterEach, describe, expect, it, vi } from "vitest";
import { extractExtrasWithOpenAI } from "@/lib/ai/setup";
import { buildProjection } from "@/lib/finance/engine";
import { validateItems, type DraftItems } from "@/lib/finance/plan-draft";
import {
  BILLS,
  buildQuickPlan,
  CHECKING_OPTIONS,
  countEstimates,
  INCOME_SOURCES,
  nextFirstOfMonth,
  resolveAmount,
  type QuickSetupInput
} from "@/lib/finance/quick-setup";

const today = "2026-10-25";

const input: QuickSetupInput = {
  semester: { name: "Fall 2026", startDate: "2026-08-24", endDate: "2026-12-15" },
  checking: { kind: "range", index: 1 },
  savings: 0,
  goal: 500,
  incomes: {
    job: { amount: { kind: "range", index: 1 }, frequency: "biweekly" },
    family: { amount: { kind: "exact", value: 250 }, frequency: "monthly" }
  },
  bills: {
    rent: { kind: "range", index: 1 },
    phone: { kind: "exact", value: 45 },
    tuition: { kind: "range", index: 0 }
  }
};

describe("quick setup ranges", () => {
  it("plans money coming in at the low end of each range", () => {
    expect(CHECKING_OPTIONS.map((option) => option.value)).toEqual([200, 500, 1000, 2500, 5000]);
    const job = INCOME_SOURCES.find((source) => source.id === "job")!;
    expect(resolveAmount({ kind: "range", index: 1 }, job.options)).toEqual({ value: 200, estimated: true }); // "$200 – $400"
  });

  it("plans bills at the high end of each range", () => {
    const rent = BILLS.find((bill) => bill.id === "rent")!;
    expect(rent.options[1]).toEqual({ label: "$500 – $800", value: 800 });
  });

  it("treats exact amounts as confirmed, not estimates", () => {
    expect(resolveAmount({ kind: "exact", value: 612.345 }, CHECKING_OPTIONS)).toEqual({ value: 612.35, estimated: false });
  });

  it("puts monthly items on the next 1st", () => {
    expect(nextFirstOfMonth("2026-10-25")).toBe("2026-11-01");
    expect(nextFirstOfMonth("2026-12-01")).toBe("2026-12-01");
    expect(nextFirstOfMonth("2026-12-20")).toBe("2027-01-01");
  });
});

describe("building a plan from quick setup", () => {
  it("turns taps into a plan the engine can project", () => {
    const plan = buildQuickPlan(input, today, "Jordan");
    const projection = buildProjection(plan);

    expect(plan.mode).toBe("personal");
    expect(plan.cash).toMatchObject({ checking: 500, targetEndingBuffer: 500, checkingEstimated: true });
    // Job: $200 every 2 weeks from today (Oct 25, Nov 8, Nov 22, Dec 6) = $800. Family: Nov 1 + Dec 1 = $500.
    expect(projection.expectedRemainingIncome).toBe(1300);
    // Rent $800 x 2 + phone $45 x 2 + tuition $500 (due Nov 24, a month out) = $2,190.
    expect(projection.requiredRemainingExpenses).toBe(2190);
    expect(projection.projectedEndingBalance).toBe(500 + 1300 - 2190);
    expect(plan.expenses.find((expense) => expense.id === "expense-tuition")?.startDate).toBe("2026-11-24");
  });

  it("marks only range answers as estimates", () => {
    const plan = buildQuickPlan(input, today);

    expect(plan.incomes.find((income) => income.id === "income-family")?.estimated).toBe(false);
    expect(plan.expenses.find((expense) => expense.id === "expense-phone")?.estimated).toBe(false);
    expect(countEstimates(plan)).toBe(4); // checking, job, rent, tuition
  });

  it("keeps tuition inside the semester when it ends soon", () => {
    const plan = buildQuickPlan({ ...input, semester: { ...input.semester, endDate: "2026-11-10" } }, today);

    expect(plan.expenses.find((expense) => expense.id === "expense-tuition")?.startDate).toBe("2026-11-10");
  });

  it("adds items the AI extracted from the free-text step", () => {
    const extras: DraftItems = {
      incomes: [],
      expenses: [{ name: "Trip home", amount: 300, frequency: "one-time", startDate: "2026-12-10", endDate: null, category: "Other", required: false }],
      notes: []
    };
    const plan = buildQuickPlan(input, today, "", extras);

    expect(plan.expenses.find((expense) => expense.name === "Trip home")).toMatchObject({ amount: 300, recurring: false, required: false });
  });
});

describe("validating AI-extracted extras", () => {
  it("keeps clean items unchanged", () => {
    const raw = {
      incomes: [],
      expenses: [{ name: "Textbooks", amount: 150, frequency: "one-time", startDate: "2026-11-05", endDate: null, category: "Education", required: true }],
      notes: ["I assumed textbooks are due Nov 5."]
    };

    expect(validateItems(raw, today)).toEqual({ items: raw, warnings: [] });
  });

  it("drops unreadable items and falls back to safe defaults", () => {
    const { items, warnings } = validateItems(
      {
        incomes: [{ name: "", amount: 100 }, { name: "Huge", amount: 5_000_000 }],
        expenses: [{ name: "Gym", amount: 30, frequency: "fortnightly", category: "Fitness", startDate: "soon", required: "yes" }]
      },
      today
    );

    expect(items.incomes).toEqual([]);
    expect(warnings.filter((warning) => warning.startsWith("Skipped"))).toHaveLength(2);
    expect(items.expenses).toEqual([
      { name: "Gym", amount: 30, frequency: "one-time", startDate: today, endDate: null, category: "Other", required: false }
    ]);
  });

  it("survives output that isn't a list of items at all", () => {
    expect(validateItems("not json", today).items).toEqual({ incomes: [], expenses: [], notes: [] });
  });
});

describe("reading extras with OpenAI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the text with a strict schema and validates the reply", async () => {
    const reply = { incomes: [{ name: "", amount: 1 }], expenses: [], notes: [] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractExtrasWithOpenAI("test-key", "$300 trip home in December", today, { name: "Fall 2026", endDate: "2026-12-15" });
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.messages[1].content).toContain("Today is 2026-10-25");
    expect(request.messages[1].content).toContain("$300 trip home in December");
    expect(result.items.incomes).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/Skipped/);
  });
});
