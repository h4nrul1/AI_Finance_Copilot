import { describe, expect, it } from "vitest";
import { demoState, presetScenarios } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { compareScenarioToBaseline, simulateRecurringExpenseChange } from "@/lib/finance/tools";
import type { Scenario } from "@/types/finance";

function purchase(amount: number, date: string): Scenario {
  return { id: "test", name: "Test purchase", description: "", type: "purchase", amount, date };
}

describe("affordability verdicts", () => {
  it("rates a purchase that leaves a large cushion as comfortable", () => {
    const result = compareScenarioToBaseline(demoState, presetScenarios[0]);

    expect(result.verdict.level).toBe("comfortable");
    expect(result.verdict.suggestion).toBeUndefined();
  });

  it("rates a purchase that cuts weekly spending by a quarter or more as tight", () => {
    const result = compareScenarioToBaseline(demoState, purchase(700, "2026-10-20"));

    expect(result.verdict.level).toBe("tight");
    expect(result.verdict.suggestion).toBeDefined();
  });

  it("does not recommend a purchase that ends the semester below the buffer", () => {
    const result = compareScenarioToBaseline(demoState, purchase(3000, "2026-12-01"));

    expect(result.scenarioProjection.projectedEndingBalance).toBe(615);
    expect(result.verdict.level).toBe("not-recommended");
    expect(result.verdict.suggestion).toContain("$385");
  });

  it("does not recommend a purchase that overdraws checking, even temporarily", () => {
    const result = compareScenarioToBaseline(demoState, purchase(6900, "2026-09-30"));

    expect(result.scenarioProjection.lowestProjectedBalance).toBeLessThan(0);
    expect(result.verdict.level).toBe("not-recommended");
    expect(result.verdict.headline).toContain("negative");
  });

  it("never calls a scenario comfortable when the baseline is already below the buffer", () => {
    const broke = { ...demoState, cash: { ...demoState.cash, checking: 500 } };
    const result = compareScenarioToBaseline(broke, purchase(50, "2026-11-01"));

    expect(result.verdict.level).toBe("not-recommended");
  });
});

describe("recurring expense changes", () => {
  it("keeps the payment schedule when the change starts mid-month", () => {
    const baseline = buildProjection(demoState).projectedEndingBalance;
    const result = buildProjection(simulateRecurringExpenseChange(demoState, "Rent", 100, "2026-10-20"));

    // Oct 1 rent stays $750; Nov 1 and Dec 1 become $850.
    expect(result.projectedEndingBalance).toBe(baseline - 200);
  });

  it("supports decreases", () => {
    const baseline = buildProjection(demoState).projectedEndingBalance;
    const result = buildProjection(simulateRecurringExpenseChange(demoState, "Rent", -50, "2026-10-01"));

    expect(result.projectedEndingBalance).toBe(baseline + 150);
  });
});
