import { describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { compareScenarioToBaseline, findMaxAffordable, simulateRecurringExpenseChange } from "@/lib/finance/tools";
import { DEFAULT_VERDICT_SETTINGS, getVerdictSettings, thresholdError } from "@/lib/finance/verdict-settings";
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

    // Comfortable ends once weekly spending drops 25%; tight ends once it drops 75%.
    expect(result.comfortableMax).toBe(653);
    expect(result.tightMax).toBe(1961);
    expect(compareScenarioToBaseline(demoState, purchase(result.comfortableMax, "2026-11-28")).verdict.level).toBe("comfortable");
    expect(compareScenarioToBaseline(demoState, purchase(result.comfortableMax + 1, "2026-11-28")).verdict.level).toBe("tight");
    expect(compareScenarioToBaseline(demoState, purchase(result.tightMax + 1, "2026-11-28")).verdict.level).toBe("not-recommended");
  });

  it("returns zero when the plan is already below the goal", () => {
    const broke = { ...demoState, cash: { ...demoState.cash, checking: 500 } };

    expect(findMaxAffordable(broke, "2026-11-28")).toMatchObject({ comfortableMax: 0, tightMax: 0 });
  });
});

describe("verdict thresholds", () => {
  const withThresholds = (comfortable: number, tight: number) => ({
    ...demoState,
    verdictSettings: { comfortableDropLimit: comfortable, tightDropLimit: tight }
  });

  it("defaults to comfortable up to a 25% weekly cut and tight up to 75%", () => {
    expect(getVerdictSettings(demoState)).toEqual(DEFAULT_VERDICT_SETTINGS);
    expect(DEFAULT_VERDICT_SETTINGS).toEqual({ comfortableDropLimit: 0.25, tightDropLimit: 0.75 });
  });

  it("uses the student's two thresholds to split the three verdicts", () => {
    // A $700 repair cuts the $235/week budget by about 27%.
    const repair = purchase(700, "2026-10-20");

    expect(compareScenarioToBaseline(withThresholds(0.3, 0.6), repair).verdict.level).toBe("comfortable");
    expect(compareScenarioToBaseline(withThresholds(0.1, 0.6), repair).verdict.level).toBe("tight");
    expect(compareScenarioToBaseline(withThresholds(0.1, 0.2), repair).verdict.level).toBe("not-recommended");
  });

  it("explains which threshold produced the verdict", () => {
    const tight = compareScenarioToBaseline(demoState, purchase(700, "2026-10-20")).verdict;

    expect(tight.rule).toContain("drops 27%, more than your 25% limit for Comfortable");
  });

  it("moves the spending limits when thresholds change", () => {
    const result = findMaxAffordable(withThresholds(0.1, 0.5), "2026-11-28");

    // 10% and 50% of the $2,615 spare money.
    expect(result.comfortableMax).toBe(261);
    expect(result.tightMax).toBe(1307);
  });

  it("never lets thresholds override the overdraft and goal rules", () => {
    const lenient = withThresholds(0.99, 1);

    expect(compareScenarioToBaseline(lenient, purchase(3000, "2026-12-01")).verdict.level).toBe("not-recommended");
    expect(compareScenarioToBaseline(lenient, purchase(6900, "2026-09-30")).verdict.headline).toContain("negative");
  });

  it("rejects invalid thresholds and keeps older saved plans working", () => {
    expect(thresholdError(25, 100)).toBeNull();
    expect(thresholdError(60, 40)).toMatch(/must be lower/);
    expect(thresholdError(0, 50)).toMatch(/between/);
    expect(thresholdError(25, 120)).toMatch(/between/);
    expect(getVerdictSettings(withThresholds(0.6, 0.4))).toEqual(DEFAULT_VERDICT_SETTINGS);

    const legacy = { ...demoState, verdictSettings: { preset: "cautious", comfortMargin: 1000, weeklyDropLimit: 0.15 } as never };
    expect(getVerdictSettings(legacy)).toEqual({ comfortableDropLimit: 0.15, tightDropLimit: 0.75 });
  });

  it("keeps the semester health badge independent of the thresholds", () => {
    expect(buildProjection(withThresholds(0.05, 0.1)).semesterHealth).toBe(buildProjection(demoState).semesterHealth);
  });
});
