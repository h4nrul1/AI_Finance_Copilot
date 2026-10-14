import { describe, expect, it } from "vitest";
import { demoState, presetScenarios } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import {
  compareScenarioToBaseline,
  simulateIncomeLoss,
  simulatePurchase,
  simulateRecurringExpenseChange
} from "@/lib/finance/tools";

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
    const result = compareScenarioToBaseline(demoState, presetScenarios[0]);

    expect(result.endingDifference).toBe(-500);
    expect(result.scenarioProjection.projectedEndingBalance).toBe(3115);
  });
});
