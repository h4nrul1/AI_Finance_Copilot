import type { Category, Expense, FinanceState, Frequency, Transaction, WeekProgress } from "@/types/finance";
import { addDays, asDate, toISODate } from "./dates";

/** Categories the plan budgets for, so purchases in them are covered by the plan rather than extra. */
export function plannedCategories(state: FinanceState): Set<Category> {
  return new Set(state.expenses.map((expense) => expense.category));
}

const MONTHLY_RATE: Record<Frequency, number> = { monthly: 1, biweekly: 26 / 12, weekly: 52 / 12 };

/**
 * What the plan sets aside for one category in the calendar month around `date`. A repeating expense counts at its
 * monthly rate ($75 a week is about $325 a month) for every month it covers, including the month before its first
 * payment: setup puts monthly bills on the next 1st, but the student is already buying groceries this month.
 * A one-time expense counts in the month it's due.
 */
export function plannedForMonth(expenses: Expense[], category: Category, date: string) {
  const { startDate, endDate } = monthAround(date);
  const nextMonthEnd = monthAround(toISODate(addDays(asDate(endDate), 1))).endDate;
  return roundCents(
    expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => {
        if (!expense.recurring) return expense.startDate >= startDate && expense.startDate <= endDate ? sum + expense.amount : sum;
        const covers = expense.startDate <= nextMonthEnd && (!expense.endDate || expense.endDate >= startDate);
        return covers ? sum + expense.amount * MONTHLY_RATE[expense.frequency ?? "monthly"] : sum;
      }, 0)
  );
}

/** First to last day of the calendar month a date falls in. */
export function monthAround(date: string) {
  const day = asDate(date);
  const start = new Date(day.getFullYear(), day.getMonth(), 1, 12);
  const end = new Date(day.getFullYear(), day.getMonth() + 1, 0, 12);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

/**
 * How much of each purchase comes out of the weekly budget, by purchase id. Extra purchases count in full. Purchases
 * in a category the plan budgets for count only once that month's spending in the category goes past the plan, so a
 * grocery run is covered until groceries run over. The student can mark any purchase as extra or planned instead.
 */
export function budgetImpact(state: FinanceState): Map<string, number> {
  const planned = plannedCategories(state);
  const impact = new Map<string, number>();
  const byCategoryMonth = new Map<string, Transaction[]>();

  for (const transaction of state.transactions) {
    const covered = transaction.extra !== true && planned.has(transaction.category);
    impact.set(transaction.id, transaction.extra === false || covered ? 0 : transaction.amount);
    if (covered) {
      const key = `${transaction.category}|${transaction.date.slice(0, 7)}`;
      byCategoryMonth.set(key, [...(byCategoryMonth.get(key) ?? []), transaction]);
    }
  }

  for (const group of byCategoryMonth.values()) {
    const budget = plannedForMonth(state.expenses, group[0].category, group[0].date);
    // A month the plan doesn't cover yet (before the item starts) isn't "over"; there's nothing to compare against.
    if (budget <= 0) continue;
    let total = 0;
    for (const transaction of [...group].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
      total += transaction.amount;
      // Purchases the student marked as planned use up the plan but never count against the weekly budget.
      if (transaction.extra === false) continue;
      impact.set(transaction.id, roundCents(Math.min(transaction.amount, Math.max(0, total - budget))));
    }
  }

  return impact;
}

/** Spending that comes out of the weekly budget, logged since checking was entered and dated up to today. */
export function spendingSinceBalance(state: FinanceState, impact = budgetImpact(state)) {
  return roundCents(
    state.transactions
      .filter((transaction) => transaction.pending && transaction.date <= state.semester.currentDate)
      .reduce((sum, transaction) => sum + (impact.get(transaction.id) ?? 0), 0)
  );
}

export interface CategoryPace {
  category: Category;
  planned: number;
  spent: number;
  /** Spending past the plan, which comes out of the weekly budget. */
  over: number;
}

/** This month's spending in each category the plan budgets for, against what the plan sets aside. */
export function categoryPace(state: FinanceState): CategoryPace[] {
  const { currentDate } = state.semester;
  const { startDate } = monthAround(currentDate);

  return [...plannedCategories(state)]
    .map((category) => {
      const planned = plannedForMonth(state.expenses, category, currentDate);
      const spent = roundCents(
        state.transactions
          .filter(
            (transaction) =>
              transaction.category === category &&
              transaction.extra !== true &&
              transaction.date >= startDate &&
              transaction.date <= currentDate
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0)
      );
      return { category, planned, spent, over: roundCents(Math.max(0, spent - planned)) };
    })
    .filter((pace) => pace.planned > 0)
    .sort((a, b) => b.over - a.over || b.spent / b.planned - a.spent / a.planned);
}

/** Monday to Sunday around the given date. */
export function weekAround(date: string) {
  const day = asDate(date);
  const start = addDays(day, -((day.getDay() + 6) % 7));
  return { startDate: toISODate(start), endDate: toISODate(addDays(start, 6)) };
}

/**
 * This week's budget is what the safe weekly amount was before this week's spending, so spending during the week
 * shows up as "left this week" going down rather than the budget itself shrinking.
 */
export function weekProgress(
  state: FinanceState,
  availableForDiscretionary: number,
  weeksRemaining: number,
  impact = budgetImpact(state)
): WeekProgress {
  const { startDate, endDate } = weekAround(state.semester.currentDate);
  const spent = roundCents(
    state.transactions
      .filter((transaction) => transaction.date >= startDate && transaction.date <= state.semester.currentDate)
      .reduce((sum, transaction) => sum + (impact.get(transaction.id) ?? 0), 0)
  );
  const budget = Math.max(0, (availableForDiscretionary + spent) / weeksRemaining);
  return { startDate, endDate, budget, spent, left: budget - spent };
}

/**
 * Saves new cash values. A new checking balance is dated today and already includes purchases made up to today, so
 * those stop being subtracted from it. A setup estimate stays an estimate until the checking amount itself changes.
 */
export function withCash(state: FinanceState, checking: number, savings: number, targetEndingBuffer: number): FinanceState {
  const balanceChanged = checking !== state.cash.checking;
  return {
    ...state,
    cash: {
      checking,
      savings,
      targetEndingBuffer,
      checkingEstimated: state.cash.checkingEstimated && !balanceChanged,
      asOf: balanceChanged ? state.semester.currentDate : state.cash.asOf
    },
    transactions: balanceChanged
      ? state.transactions.map((transaction) =>
          transaction.pending && transaction.date <= state.semester.currentDate ? { ...transaction, pending: false } : transaction
        )
      : state.transactions
  };
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}
