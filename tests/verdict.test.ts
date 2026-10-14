import { describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { compareScenarioToBaseline, findMaxAffordable, simulateRecurringExpenseChange } from "@/lib/finance/tools";
import { getVerdictSettings, presetSettings } from "@/lib/finance/verdict-settings";
import type { Scenario } from "@/types/finance";

const chicagoTrip: Scenario = { id: "trip", name: "Chicago Trip", description: "", type: "purchase", amount: 500, date: "2026-11-12" };

function purchase(amount: number, date: string): Scenario {
  return { id: "test", name: "Test purchase", description: "", type: "purchase", amount, date };
}

describe("affordability verdicts", () => {
  it("rates a purchase that leaves a large cushion as comfortable", () => {
    const result = compareScenarioToBaseline(demoState, chicagoTrip);

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

describe("spending limits", () => {
  it("finds the largest comfortable and tight purchase amounts", () => {
    const result = findMaxAffordable(demoState, "2026-11-28");

    // Comfortable ends once weekly spending drops 25%; tight ends once you'd finish below the $1,000 goal.
    expect(result.comfortableMax).toBe(653);
    expect(result.tightMax).toBe(2615);
    expect(compareScenarioToBaseline(demoState, purchase(result.comfortableMax, "2026-11-28")).verdict.level).toBe("comfortable");
    expect(compareScenarioToBaseline(demoState, purchase(result.comfortableMax + 1, "2026-11-28")).verdict.level).toBe("tight");
    expect(compareScenarioToBaseline(demoState, purchase(result.tightMax + 1, "2026-11-28")).verdict.level).toBe("not-recommended");
  });

  it("returns zero when the plan is already below the goal", () => {
    const broke = { ...demoState, cash: { ...demoState.cash, checking: 500 } };

    expect(findMaxAffordable(broke, "2026-11-28")).toMatchObject({ comfortableMax: 0, tightMax: 0 });
  });
});

describe("verdict settings", () => {
  it("lets a cautious student flag smaller purchases as tight", () => {
    const cautious = { ...demoState, verdictSettings: presetSettings("cautious") };

    expect(compareScenarioToBaseline(demoState, purchase(500, "2026-11-12")).verdict.level).toBe("comfortable");
    expect(compareScenarioToBaseline(cautious, purchase(500, "2026-11-12")).verdict.level).toBe("tight");
  });

  it("explains which rule produced the verdict", () => {
    const tight = compareScenarioToBaseline(demoState, purchase(700, "2026-10-20")).verdict;

    expect(tight.rule).toContain("your limit is 25%");
  });

  it("never lets settings override the overdraft and goal rules", () => {
    const lenient = { ...demoState, verdictSettings: { preset: "custom" as const, comfortMargin: 0, weeklyDropLimit: 0.75 } };

    expect(compareScenarioToBaseline(lenient, purchase(3000, "2026-12-01")).verdict.level).toBe("not-recommended");
  });

  it("clamps out-of-range custom values and falls back for old saved plans", () => {
    const wild = { ...demoState, verdictSettings: { preset: "custom" as const, comfortMargin: -50, weeklyDropLimit: 5 } };

    expect(getVerdictSettings(wild)).toEqual({ preset: "custom", comfortMargin: 0, weeklyDropLimit: 0.75 });
    expect(getVerdictSettings(demoState).preset).toBe("balanced");
  });

  it("uses the same comfort margin for the semester health badge", () => {
    const strict = { ...demoState, verdictSettings: { preset: "custom" as const, comfortMargin: 3000, weeklyDropLimit: 0.25 } };

    expect(buildProjection(demoState).semesterHealth).toBe("On Track");
    expect(buildProjection(strict).semesterHealth).toBe("Tight");
  });
});
