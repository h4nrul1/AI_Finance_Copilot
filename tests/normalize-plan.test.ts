import { describe, expect, it } from "vitest";
import { normalizePlan } from "@/lib/data/normalize-plan";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";

describe("normalizePlan", () => {
  it("defaults missing guaranteed fields and preserves explicit false and true without mutating the save", () => {
    const { guaranteed: _guaranteed, ...legacyIncome } = demoState.incomes[0];
    const saved = {
      ...demoState,
      incomes: [
        { ...legacyIncome, id: "missing" },
        { ...legacyIncome, id: "false", guaranteed: false },
        { ...legacyIncome, id: "true", guaranteed: true }
      ]
    };
    const before = structuredClone(saved);
    const normalized = normalizePlan(saved);

    expect(normalized.incomes.map((income) => income.guaranteed)).toEqual([true, false, true]);
    expect(saved).toEqual(before);
    expect(saved.incomes[0]).not.toHaveProperty("guaranteed");
    expect(normalizePlan(normalized)).toEqual(normalized);
  });

  it("counts legacy income after normalization and still excludes explicitly uncertain income", () => {
    const { guaranteed: _guaranteed, ...legacyIncome } = demoState.incomes[0];
    const plan = normalizePlan({ ...demoState, incomes: [legacyIncome, { ...legacyIncome, id: "uncertain", guaranteed: false }] });
    expect(buildProjection(plan).expectedRemainingIncome).toBe(1300);
  });
});
