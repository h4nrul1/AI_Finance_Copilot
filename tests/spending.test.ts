import { describe, expect, it } from "vitest";
import type { FinanceState, Transaction } from "@/types/finance";
import { createBlankPlan, withToday } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { buildQuickPlan } from "@/lib/finance/quick-setup";
import { budgetImpact, categoryPace, plannedForMonth, weekAround, withCash } from "@/lib/finance/spending";

const currentCash = (state: FinanceState) => buildProjection(state).safeWeekly.currentCash;

// The demo's "today" is Tuesday, Sep 29, 2026, so this week runs Mon Sep 28 – Sun Oct 4.
const today = demoState.semester.currentDate;

function withPurchases(...transactions: Partial<Transaction>[]): FinanceState {
  return {
    ...demoState,
    transactions: [
      ...demoState.transactions,
      ...transactions.map((transaction, index) => ({
        id: `new-${index}`,
        merchant: "Target",
        date: today,
        amount: 40,
        category: "Shopping" as const,
        pending: true,
        ...transaction
      }))
    ]
  };
}

describe("logged spending", () => {
  const baseline = buildProjection(demoState);

  it("leaves the demo's numbers alone: its purchases are already in the checking balance", () => {
    expect(currentCash(demoState)).toBe(demoState.cash.checking);
    expect(baseline.thisWeek).toMatchObject({ startDate: "2026-09-28", endDate: "2026-10-04", spent: 0 });
    expect(baseline.thisWeek.budget).toBeCloseTo(baseline.safeWeekly.safeWeeklySpending);
  });

  it("takes an extra purchase out of current cash and this week's budget", () => {
    const projection = buildProjection(withPurchases({ amount: 40 }));

    expect(projection.safeWeekly).toMatchObject({ enteredCash: demoState.cash.checking, loggedSpending: 40, currentCash: demoState.cash.checking - 40 });
    expect(projection.projectedEndingBalance).toBe(baseline.projectedEndingBalance - 40);
    // The week's budget stays where it started; what's left goes down.
    expect(projection.thisWeek.budget).toBeCloseTo(baseline.thisWeek.budget);
    expect(projection.thisWeek).toMatchObject({ spent: 40 });
    expect(projection.thisWeek.left).toBeCloseTo(baseline.thisWeek.budget - 40);
    // Future weeks share the cost.
    expect(projection.safeWeekly.safeWeeklySpending).toBeCloseTo(baseline.safeWeekly.safeWeeklySpending - 40 / baseline.safeWeekly.weeksRemaining);
  });

  it("doesn't count a purchase twice when the plan already budgets for its category", () => {
    const groceries = buildProjection(withPurchases({ merchant: "Kroger", category: "Groceries", amount: 60 }));

    expect(groceries.safeWeekly.currentCash).toBe(demoState.cash.checking);
    expect(groceries.thisWeek.spent).toBe(0);
  });

  it("lets the student override which purchases are extra", () => {
    const overridden = buildProjection(
      withPurchases({ merchant: "Kroger", category: "Groceries", amount: 60, extra: true }, { amount: 25, extra: false })
    );

    expect(overridden.safeWeekly.loggedSpending).toBe(60);
    expect(overridden.thisWeek.spent).toBe(60);
  });

  it("waits until a future-dated purchase's day to subtract it", () => {
    const projection = buildProjection(withPurchases({ date: "2026-10-02" }));

    expect(projection.safeWeekly.loggedSpending).toBe(0);
    expect(projection.thisWeek.spent).toBe(0);
  });

  it("shows an overspent week as negative", () => {
    const { thisWeek } = buildProjection(withPurchases({ amount: Math.ceil(baseline.thisWeek.budget) + 50 }));

    expect(thisWeek.left).toBeLessThan(0);
  });
});

describe("entering a new checking balance", () => {
  const state = withPurchases({ amount: 40 }, { id: "later", date: "2026-10-02", amount: 15 });

  it("stops subtracting purchases the new balance already includes", () => {
    const updated = withCash(state, 2300, demoState.cash.savings, demoState.cash.targetEndingBuffer);
    const projection = buildProjection(updated);

    expect(projection.safeWeekly).toMatchObject({ currentCash: 2300, loggedSpending: 0 });
    // Still this week's spending, just already inside the new balance.
    expect(projection.thisWeek.spent).toBe(40);
    // A purchase dated after today isn't in the balance yet.
    expect(updated.transactions.find((transaction) => transaction.id === "later")?.pending).toBe(true);
  });

  it("keeps subtracting when only the goal or savings change", () => {
    const updated = withCash(state, demoState.cash.checking, 999, 800);

    expect(currentCash(updated)).toBe(demoState.cash.checking - 40);
  });
});

describe("weeks", () => {
  it("run Monday to Sunday", () => {
    expect(weekAround("2026-09-28")).toEqual({ startDate: "2026-09-28", endDate: "2026-10-04" });
    expect(weekAround("2026-10-04")).toEqual({ startDate: "2026-09-28", endDate: "2026-10-04" });
    expect(weekAround("2026-11-01")).toEqual({ startDate: "2026-10-26", endDate: "2026-11-01" });
  });
});

describe("spending past the plan", () => {
  // Mid-October: the demo plans $300 of groceries for the month.
  const october: FinanceState = { ...demoState, semester: { ...demoState.semester, currentDate: "2026-10-20" } };
  const groceries = (amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
    id: `g-${date}-${amount}`,
    merchant: "Kroger",
    date,
    amount,
    category: "Groceries",
    ...extra
  });

  it("counts only the part of a covered category that goes past the month's plan", () => {
    const state = { ...october, transactions: [groceries(200, "2026-10-05"), groceries(150, "2026-10-20", { pending: true })] };
    const projection = buildProjection(state);

    expect([...budgetImpact(state).values()]).toEqual([0, 50]);
    expect(projection.safeWeekly.loggedSpending).toBe(50);
    expect(projection.thisWeek.spent).toBe(50);
    expect(categoryPace(state).find((pace) => pace.category === "Groceries")).toEqual({ category: "Groceries", planned: 300, spent: 350, over: 50 });
  });

  it("covers the month before a repeating item's first payment", () => {
    // The demo's $300/month groceries start Oct 1, but "today" is Sep 29.
    const state = withPurchases({ merchant: "Kroger", category: "Groceries", amount: 500, id: "big" });

    // September already has $195.01 of groceries logged, so $500 more is $395.01 past the $300 plan.
    expect(budgetImpact(state).get("big")).toBe(395.01);
    expect(categoryPace(state).find((pace) => pace.category === "Groceries")).toEqual({ category: "Groceries", planned: 300, spent: 695.01, over: 395.01 });

    // Quick setup puts monthly bills on the next 1st (Dec 1 here), so November has to count too.
    const quick = buildQuickPlan(
      {
        semester: { name: "Fall 2026", startDate: "2026-08-24", endDate: "2026-12-15" },
        checking: { kind: "exact", value: 2000 },
        savings: 0,
        goal: 500,
        incomes: {},
        bills: { groceries: { kind: "exact", value: 300 } }
      },
      "2026-11-12"
    );
    expect(plannedForMonth(quick.expenses, "Groceries", "2026-11-12")).toBe(300);
  });

  it("uses a monthly rate for weekly items and stops after an item ends", () => {
    // Dining: $95 a week from Oct 2 to Dec 11 in the demo.
    expect(plannedForMonth(demoState.expenses, "Dining", "2026-10-15")).toBeCloseTo((95 * 52) / 12, 1);
    expect(plannedForMonth(demoState.expenses, "Dining", "2027-01-10")).toBe(0);
    // Two months before the first payment isn't covered yet.
    expect(plannedForMonth(demoState.expenses, "Dining", "2026-08-20")).toBe(0);
  });

  it("lets a purchase marked planned use up the plan without counting itself", () => {
    const state = {
      ...october,
      transactions: [groceries(280, "2026-10-05", { extra: false }), groceries(60, "2026-10-20", { pending: true })]
    };

    expect([...budgetImpact(state).values()]).toEqual([0, 40]);
  });
});

describe("planned income and bills since the balance was entered", () => {
  // Entered Oct 1 with $2,000; paid $400 every other Saturday from Oct 3; rent $700 on the 5th.
  const plan: FinanceState = {
    ...createBlankPlan("2026-10-01"),
    cash: { checking: 2000, savings: 0, targetEndingBuffer: 500, asOf: "2026-10-01" },
    incomes: [
      { id: "job", name: "Job", amount: 400, startDate: "2026-10-03", recurring: true, frequency: "biweekly", guaranteed: true, category: "Income" }
    ],
    expenses: [{ id: "rent", name: "Rent", amount: 700, startDate: "2026-10-05", recurring: true, frequency: "monthly", category: "Housing", required: true }]
  };
  const later = { ...plan, semester: { ...plan.semester, currentDate: "2026-10-10" } };

  it("applies them to checking so current cash keeps up", () => {
    expect(buildProjection(later).safeWeekly).toMatchObject({
      enteredCash: 2000,
      balanceDate: "2026-10-01",
      incomeSinceBalance: 400,
      expensesSinceBalance: 700,
      currentCash: 1700
    });
  });

  it("keeps the semester-end projection the same as days pass", () => {
    expect(buildProjection(later).projectedEndingBalance).toBe(buildProjection(plan).projectedEndingBalance);
  });

  it("starts over from a newly entered balance", () => {
    const updated = withCash(later, 1650, 0, 500);

    expect(updated.cash.asOf).toBe("2026-10-10");
    expect(buildProjection(updated).safeWeekly).toMatchObject({ currentCash: 1650, incomeSinceBalance: 0, expensesSinceBalance: 0 });
  });

  it("dates an older plan's balance to the day it was last open", () => {
    const { asOf: _asOf, ...cash } = plan.cash;
    const reopened = withToday({ ...plan, cash, semester: { ...plan.semester, currentDate: "2026-10-04" } }, "2026-10-10");

    expect(reopened.cash.asOf).toBe("2026-10-04");
    expect(reopened.semester.currentDate).toBe("2026-10-10");
    // The paycheck on Oct 3 was before then; rent on Oct 5 is applied.
    expect(buildProjection(reopened).safeWeekly).toMatchObject({ incomeSinceBalance: 0, expensesSinceBalance: 700 });
  });
});
