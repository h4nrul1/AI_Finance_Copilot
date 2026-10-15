import { describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import type { Scenario } from "@/types/finance";
import { buildProjection, planItemTotals } from "@/lib/finance/engine";
import {
  compareScenarioToBaseline,
  simulateIncomeLoss,
  simulatePurchase,
  simulateRecurringExpenseChange
} from "@/lib/finance/tools";

const chicagoTrip: Scenario = { id: "trip", name: "Chicago Trip", description: "", type: "purchase", amount: 500, date: "2026-11-12" };

describe("semester projection engine", () => {
  it("calculates projected ending balance from current cash and future events", () => {
    const projection = buildProjection(demoState);

    expect(projection.projectedEndingBalance).toBe(3615);
  });

  it("handles recurring income inside the remaining semester window", () => {
    const projection = buildProjection(demoState);

    expect(projection.expectedRemainingIncome).toBe(1800);
  });

  it("handles recurring required expenses", () => {
    const projection = buildProjection(demoState);

    expect(projection.requiredRemainingExpenses).toBe(3885);
  });

  it("calculates safe weekly spending while protecting the ending buffer", () => {
    const projection = buildProjection(demoState);

    expect(Math.round(projection.safeWeekly.safeWeeklySpending)).toBe(235);
  });
});

describe("scenario tools", () => {
  it("simulates a one-time purchase scenario", () => {
    const scenarioState = simulatePurchase(demoState, 500, "2026-11-12", "Trip");
    const result = buildProjection(scenarioState);

    expect(result.projectedEndingBalance).toBe(3115);
  });

  it("simulates income loss after a stop date", () => {
    const scenarioState = simulateIncomeLoss(demoState, "Part-time campus job", "2026-10-01");
    const result = buildProjection(scenarioState);

    expect(result.expectedRemainingIncome).toBe(1150);
  });

  it("simulates a recurring rent increase", () => {
    const scenarioState = simulateRecurringExpenseChange(demoState, "Rent", 100, "2026-10-01");
    const result = buildProjection(scenarioState);

    expect(result.projectedEndingBalance).toBe(3315);
  });

  it("compares a scenario to the baseline", () => {
    const result = compareScenarioToBaseline(demoState, chicagoTrip);

    expect(result.endingDifference).toBe(-500);
    expect(result.scenarioProjection.projectedEndingBalance).toBe(3115);
  });
});

describe("plan item totals", () => {
  it("counts only payments from today to the end of the semester", () => {
    const totals = planItemTotals(demoState);

    // Rent is due Sep 1, Oct 1, Nov 1, Dec 1; today is Sep 29, so Sep 1 was already paid.
    expect(totals["expense-rent"]).toEqual({ count: 3, total: 2250, pastCount: 1, timing: "upcoming" });
  });

  it("explains a one-time payment before today as already paid", () => {
    // Tuition was paid Sep 15, so checking already reflects it and it isn't counted again.
    expect(planItemTotals(demoState)["expense-tuition"]).toEqual({ count: 0, total: 0, pastCount: 1, timing: "past" });
  });

  it("flags items dated after the semester ends", () => {
    const state = {
      ...demoState,
      expenses: [{ id: "spring", name: "Spring deposit", category: "Education" as const, amount: 300, startDate: "2027-01-10", recurring: false, required: true }]
    };

    expect(planItemTotals(state)["spring"].timing).toBe("after-semester");
  });

  it("matches the totals the safe-spending formula uses", () => {
    const totals = planItemTotals(demoState);
    const required = demoState.expenses.filter((expense) => expense.required).reduce((sum, expense) => sum + totals[expense.id].total, 0);

    expect(required).toBe(buildProjection(demoState).requiredRemainingExpenses);
  });
});
