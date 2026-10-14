import type {
  FinanceState,
  FinancialProjection,
  MaxAffordableResult,
  Scenario,
  ScenarioResult,
  ScenarioSummary,
  VerdictLevel
} from "@/types/finance";
import { addDays, asDate, expandRecurringDates, toISODate } from "./dates";
import { buildProjection, cloneState } from "./engine";
import { assessScenario } from "./verdict";
import { getVerdictSettings } from "./verdict-settings";
import { formatDate } from "@/lib/utils";

export function calculateSemesterProjection(state: FinanceState) {
  return buildProjection(state);
}

export function calculateSafeWeeklySpending(state: FinanceState) {
  return buildProjection(state).safeWeekly;
}

export function calculateProjectedEndingBalance(state: FinanceState) {
  return buildProjection(state).projectedEndingBalance;
}

export function simulatePurchase(state: FinanceState, amount: number, date: string, name = "Hypothetical purchase") {
  const next = cloneState(state);
  next.expenses.push({
    id: `scenario-purchase-${Date.now()}`,
    name,
    category: "Other",
    amount,
    startDate: date,
    recurring: false,
    required: false
  });
  return next;
}

export function simulateIncomeLoss(state: FinanceState, incomeName: string, stopDate: string) {
  const next = cloneState(state);
  next.incomes = next.incomes.map((income) =>
    income.name.toLowerCase().includes(incomeName.toLowerCase()) && income.recurring
      ? { ...income, endDate: stopDate }
      : income
  );
  return next;
}

/**
 * Changes a recurring expense by `amountDelta` per payment from `startDate` on. The original expense is split so
 * payments before `startDate` keep the old amount and the payment schedule (day of month) never shifts.
 */
export function simulateRecurringExpenseChange(state: FinanceState, expenseName: string, amountDelta: number, startDate: string) {
  const next = cloneState(state);
  next.expenses = next.expenses.flatMap((expense) => {
    if (!expense.recurring || !expense.name.toLowerCase().includes(expenseName.toLowerCase())) return [expense];

    const frequency = expense.frequency ?? "monthly";
    const scheduleEnd = expense.endDate ?? next.semester.endDate;
    const firstChanged = expandRecurringDates(expense.startDate, scheduleEnd, frequency, startDate, scheduleEnd)[0];
    if (!firstChanged) return [expense];

    // Label the new part so the plan doesn't show two identical names; strip an earlier label to avoid nesting.
    const baseName = expense.name.replace(/ \(from [^)]*\)$/, "");
    const changed = {
      ...expense,
      id: `${expense.id}-changed`,
      name: firstChanged === expense.startDate ? expense.name : `${baseName} (from ${formatDate(firstChanged)})`,
      amount: expense.amount + amountDelta,
      startDate: firstChanged
    };
    if (firstChanged === expense.startDate) return [changed];
    return [{ ...expense, endDate: toISODate(addDays(asDate(firstChanged), -1)) }, changed];
  });
  return next;
}

export function simulateInvestment(state: FinanceState, amount: number, date: string) {
  return simulatePurchase(state, amount, date, "Money moved to investing");
}

export function getSpendingByCategory(state: FinanceState) {
  return state.transactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amount;
    return totals;
  }, {});
}

export function getUpcomingExpenses(state: FinanceState) {
  return buildProjection(state).upcomingEvents.filter((event) => event.kind === "expense");
}

export function applyScenario(state: FinanceState, scenario: Scenario) {
  if (scenario.type === "income-loss") {
    return simulateIncomeLoss(state, scenario.incomeName ?? "Part-time campus job", scenario.stopDate ?? scenario.date ?? state.semester.currentDate);
  }

  if (scenario.type === "expense-change") {
    return simulateRecurringExpenseChange(state, scenario.expenseName ?? "Rent", scenario.amount ?? 0, scenario.date ?? state.semester.currentDate);
  }

  if (scenario.type === "investment") {
    return simulateInvestment(state, scenario.amount ?? 0, scenario.date ?? state.semester.currentDate);
  }

  return simulatePurchase(state, scenario.amount ?? 0, scenario.date ?? state.semester.currentDate, scenario.name);
}

export function compareScenarioToBaseline(state: FinanceState, scenario: Scenario): ScenarioResult {
  const baseline = buildProjection(state);
  const scenarioProjection = buildProjection(applyScenario(state, scenario));
  const endingDifference = scenarioProjection.projectedEndingBalance - baseline.projectedEndingBalance;
  const weeklyDifference = scenarioProjection.safeWeekly.safeWeeklySpending - baseline.safeWeekly.safeWeeklySpending;
  const verdict = assessScenario(state, baseline, scenarioProjection);

  return {
    scenario,
    baseline,
    scenarioProjection,
    endingDifference,
    weeklyDifference,
    verdict,
    explanation: [verdict.headline, ...verdict.reasons, verdict.suggestion].filter(Boolean).join(" ")
  };
}

function snapshot(projection: FinancialProjection) {
  return {
    endingCash: projection.projectedEndingBalance,
    safeWeeklySpending: Math.round(projection.safeWeekly.safeWeeklySpending),
    lowestBalance: projection.lowestProjectedBalance
  };
}

export function summarizeScenarioResult(state: FinanceState, result: ScenarioResult): ScenarioSummary {
  return {
    scenarioName: result.scenario.name,
    baseline: snapshot(result.baseline),
    withChange: snapshot(result.scenarioProjection),
    targetEndingBuffer: state.cash.targetEndingBuffer,
    endingDifference: result.endingDifference,
    weeklyDifference: Math.round(result.weeklyDifference),
    verdict: result.verdict
  };
}

/**
 * Finds the largest one-time purchase on `date` that stays "Comfortable", and the largest that is not
 * "Not recommended". Verdicts only get worse as the amount grows, so a binary search over whole dollars is exact.
 */
export function findMaxAffordable(state: FinanceState, date: string): MaxAffordableResult {
  const baseline = buildProjection(state);
  const levelAt = (amount: number): VerdictLevel =>
    assessScenario(state, baseline, buildProjection(simulatePurchase(state, amount, date))).level;
  const upperBound = Math.max(0, Math.ceil(state.cash.checking + baseline.expectedRemainingIncome));

  const largestWhere = (ok: (level: VerdictLevel) => boolean) => {
    if (!ok(levelAt(0))) return 0;
    let low = 0;
    let high = upperBound;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ok(levelAt(mid))) low = mid;
      else high = mid - 1;
    }
    return low;
  };

  const { comfortMargin, weeklyDropLimit } = getVerdictSettings(state);
  return {
    date,
    comfortableMax: largestWhere((level) => level === "comfortable"),
    tightMax: largestWhere((level) => level !== "not-recommended"),
    goal: state.cash.targetEndingBuffer,
    comfortMargin,
    weeklyDropLimit
  };
}
