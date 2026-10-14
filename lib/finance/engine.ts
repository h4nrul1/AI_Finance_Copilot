import type {
  Expense,
  FinanceState,
  FinancialProjection,
  IncomeEvent,
  ProjectionPoint,
  SafeWeeklyBreakdown,
  UpcomingEvent
} from "@/types/finance";
import { asDate, eachWeek, expandRecurringDates, toISODate, weeksBetween } from "./dates";
import { getVerdictSettings } from "./verdict-settings";

interface CashEvent {
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: "income" | "expense";
  required: boolean;
  category: UpcomingEvent["category"];
}

function withinWindow(date: string, start: string, end: string) {
  const value = asDate(date).getTime();
  return value >= asDate(start).getTime() && value <= asDate(end).getTime();
}

function incomeEvents(income: IncomeEvent, windowStart: string, windowEnd: string): CashEvent[] {
  if (!income.guaranteed) return [];

  if (!income.recurring) {
    if (!withinWindow(income.startDate, windowStart, windowEnd)) return [];
    return [
      {
        id: income.id,
        date: income.startDate,
        name: income.name,
        amount: income.amount,
        kind: "income",
        required: false,
        category: "Income"
      }
    ];
  }

  const endDate = income.endDate ?? windowEnd;
  return expandRecurringDates(income.startDate, endDate, income.frequency ?? "monthly", windowStart, windowEnd).map(
    (date, index) => ({
      id: `${income.id}-${index}`,
      date,
      name: income.name,
      amount: income.amount,
      kind: "income" as const,
      required: false,
      category: "Income" as const
    })
  );
}

function expenseEvents(expense: Expense, windowStart: string, windowEnd: string): CashEvent[] {
  if (!expense.recurring) {
    if (!withinWindow(expense.startDate, windowStart, windowEnd)) return [];
    return [
      {
        id: expense.id,
        date: expense.startDate,
        name: expense.name,
        amount: -expense.amount,
        kind: "expense",
        required: expense.required,
        category: expense.category
      }
    ];
  }

  const endDate = expense.endDate ?? windowEnd;
  return expandRecurringDates(expense.startDate, endDate, expense.frequency ?? "monthly", windowStart, windowEnd).map(
    (date, index) => ({
      id: `${expense.id}-${index}`,
      date,
      name: expense.name,
      amount: -expense.amount,
      kind: "expense" as const,
      required: expense.required,
      category: expense.category
    })
  );
}

export function listFutureEvents(state: FinanceState): CashEvent[] {
  const { currentDate, endDate } = state.semester;
  const events = [
    ...state.incomes.flatMap((income) => incomeEvents(income, currentDate, endDate)),
    ...state.expenses.flatMap((expense) => expenseEvents(expense, currentDate, endDate))
  ];

  return events.sort((a, b) => asDate(a.date).getTime() - asDate(b.date).getTime());
}

function summarizeSafeWeekly(state: FinanceState, events: CashEvent[]): SafeWeeklyBreakdown {
  const currentCash = state.cash.checking;
  const expectedRemainingIncome = events
    .filter((event) => event.kind === "income")
    .reduce((sum, event) => sum + event.amount, 0);
  const requiredRemainingExpenses = Math.abs(
    events.filter((event) => event.kind === "expense" && event.required).reduce((sum, event) => sum + event.amount, 0)
  );
  const discretionaryAlreadyPlanned = Math.abs(
    events.filter((event) => event.kind === "expense" && !event.required).reduce((sum, event) => sum + event.amount, 0)
  );
  const targetEndingBuffer = state.cash.targetEndingBuffer;
  const weeksRemaining = weeksBetween(state.semester.currentDate, state.semester.endDate);
  const availableForDiscretionary =
    currentCash + expectedRemainingIncome - requiredRemainingExpenses - targetEndingBuffer - discretionaryAlreadyPlanned;

  return {
    currentCash,
    expectedRemainingIncome,
    requiredRemainingExpenses,
    targetEndingBuffer,
    discretionaryAlreadyPlanned,
    availableForDiscretionary,
    weeksRemaining,
    safeWeeklySpending: Math.max(0, availableForDiscretionary / weeksRemaining)
  };
}

function buildTimeline(state: FinanceState, events: CashEvent[]): ProjectionPoint[] {
  const weekDates = eachWeek(state.semester.currentDate, state.semester.endDate);
  let balance = state.cash.checking;
  let eventIndex = 0;
  const sorted = [...events].sort((a, b) => asDate(a.date).getTime() - asDate(b.date).getTime());

  return weekDates.map((date) => {
    const weekEnd = asDate(date).getTime();
    const labels: string[] = [];

    while (eventIndex < sorted.length && asDate(sorted[eventIndex].date).getTime() <= weekEnd) {
      balance += sorted[eventIndex].amount;
      labels.push(sorted[eventIndex].name);
      eventIndex += 1;
    }

    return {
      date,
      label: date.slice(5),
      balance: Math.round(balance),
      events: labels
    };
  });
}

export function buildProjection(state: FinanceState): FinancialProjection {
  const events = listFutureEvents(state);
  const safeWeekly = summarizeSafeWeekly(state, events);
  const timeline = buildTimeline(state, events);
  const projectedEndingBalance = Math.round(state.cash.checking + events.reduce((sum, event) => sum + event.amount, 0));
  const expectedRemainingIncome = safeWeekly.expectedRemainingIncome;
  const requiredRemainingExpenses = safeWeekly.requiredRemainingExpenses;
  const discretionaryRemainingExpenses = safeWeekly.discretionaryAlreadyPlanned;
  const lowestProjectedBalance = Math.min(...timeline.map((point) => point.balance), state.cash.checking);
  const upcomingEvents = events.map((event) => ({
    id: event.id,
    date: event.date,
    name: event.name,
    amount: Math.abs(event.amount),
    kind: event.kind,
    category: event.category,
    required: event.required
  }));

  const buffer = state.cash.targetEndingBuffer;
  const { comfortMargin } = getVerdictSettings(state);
  const semesterHealth =
    projectedEndingBalance >= buffer + comfortMargin ? "On Track" : projectedEndingBalance >= buffer ? "Tight" : "At Risk";

  return {
    timeline,
    projectedEndingBalance,
    safeWeekly,
    expectedRemainingIncome,
    requiredRemainingExpenses,
    discretionaryRemainingExpenses,
    lowestProjectedBalance,
    upcomingEvents,
    semesterHealth
  };
}

export interface PlanItemTotal {
  /** Payments that fall between today and the end of the semester. */
  count: number;
  /** Sum of those payments, always positive. */
  total: number;
}

/** What each income and expense contributes to the rest of the semester, keyed by item id. */
export function planItemTotals(state: FinanceState): Record<string, PlanItemTotal> {
  const { currentDate, endDate } = state.semester;
  const totals: Record<string, PlanItemTotal> = {};
  const add = (id: string, events: CashEvent[]) => {
    totals[id] = { count: events.length, total: events.reduce((sum, event) => sum + Math.abs(event.amount), 0) };
  };

  state.incomes.forEach((income) => add(income.id, incomeEvents(income, currentDate, endDate)));
  state.expenses.forEach((expense) => add(expense.id, expenseEvents(expense, currentDate, endDate)));
  return totals;
}

export function cloneState(state: FinanceState): FinanceState {
  return structuredClone(state);
}

export function todayForState(state: FinanceState) {
  return toISODate(asDate(state.semester.currentDate));
}
