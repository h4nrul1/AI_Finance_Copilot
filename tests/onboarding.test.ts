import { describe, expect, it } from "vitest";
import { createBlankPlan, guessSemester, withToday } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { localToday } from "@/lib/finance/dates";
import { buildProjection } from "@/lib/finance/engine";

describe("new plans", () => {
  it("guesses the current term from today's date", () => {
    expect(guessSemester("2026-10-25")).toEqual({ name: "Fall 2026", startDate: "2026-08-24", endDate: "2026-12-15" });
    expect(guessSemester("2027-02-03")).toEqual({ name: "Spring 2027", startDate: "2027-01-12", endDate: "2027-05-10" });
    expect(guessSemester("2027-06-20")).toEqual({ name: "Summer 2027", startDate: "2027-05-18", endDate: "2027-08-14" });
  });

  it("creates an empty personal plan that starts today", () => {
    const plan = createBlankPlan("2026-10-25", "  Jordan ");

    expect(plan.mode).toBe("personal");
    expect(plan.student.name).toBe("Jordan");
    expect(plan.semester.currentDate).toBe("2026-10-25");
    expect(plan.incomes).toEqual([]);
    expect(plan.expenses).toEqual([]);
    expect(plan.transactions).toEqual([]);
  });

  it("produces a working projection for an empty plan", () => {
    const projection = buildProjection(createBlankPlan("2026-10-25"));

    expect(projection.projectedEndingBalance).toBe(0);
    expect(projection.safeWeekly.safeWeeklySpending).toBe(0);
    expect(projection.upcomingEvents).toEqual([]);
  });
});

describe("today's date", () => {
  it("moves personal plans to the real date", () => {
    const plan = createBlankPlan("2026-10-01");

    expect(withToday(plan, "2026-10-25").semester.currentDate).toBe("2026-10-25");
  });

  it("keeps the demo and older saved plans on their fixed date", () => {
    const olderSave = { ...demoState, mode: undefined };

    expect(withToday(demoState, "2026-10-25").semester.currentDate).toBe("2026-09-29");
    expect(withToday(olderSave, "2026-10-25").semester.currentDate).toBe("2026-09-29");
  });

  it("formats the local date as YYYY-MM-DD", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
