import type { FinancialProjection, FinanceState } from "@/types/finance";
import { asDate } from "@/lib/finance/dates";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Rounds to a friendly amount ($25 steps under $500, $50 under $2,000, $100 above). */
function niceAmount(value: number) {
  const step = value < 500 ? 25 : value < 2000 ? 50 : 100;
  return Math.max(step, Math.round(value / step) * step);
}

function dollars(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

/**
 * Months from today through `lastDate`, in the current calendar year only: the offline copilot reads a month name
 * as a date in the current year, so a month in next year would be misread.
 */
function upcomingMonths(currentDate: string, lastDate: string) {
  const start = asDate(currentDate);
  const end = asDate(lastDate);
  const months: number[] = [];
  for (let month = start.getMonth(); month <= 11; month += 1) {
    if (new Date(start.getFullYear(), month, 1) > end) break;
    months.push(month);
  }
  return months;
}

/** The month a little ahead of today: next month when the window has one, otherwise this month. */
function nearMonth(months: number[]) {
  return months.length > 1 ? months[1] : months[0];
}

/**
 * Suggested copilot questions built from the student's own plan: their months, their numbers, their job and bills.
 * Every question is phrased so the offline (keyword) copilot routes it to the same tool the AI would pick.
 */
export function buildSuggestions(state: FinanceState, projection: FinancialProjection): string[] {
  const { currentDate, endDate } = state.semester;
  const months = upcomingMonths(currentDate, endDate);
  const suggestions: string[] = [];
  const inMonth = (month: number | undefined) => (month === undefined ? "" : ` in ${MONTH_NAMES[month]}`);

  const weekly = projection.safeWeekly.safeWeeklySpending;
  const nextMonth = nearMonth(months);
  const lastMonth = months[months.length - 1];

  // A purchase sized to the student: about two weeks of safe spending, so the answer is informative either way.
  suggestions.push(`Can I afford a ${dollars(niceAmount(Math.max(weekly, 50) * 2))} purchase${inMonth(nextMonth)}?`);
  suggestions.push("How much can I safely spend each week?");
  suggestions.push(`How much can I spend${inMonth(lastMonth)}?`);
  suggestions.push("Am I on track for the end of the semester?");

  // Same choice the offline copilot makes for "stop working", so both paths simulate the same job.
  const job = state.incomes.find((income) => income.recurring && income.guaranteed);
  if (job) {
    const jobEnd = job.endDate && job.endDate < endDate ? job.endDate : endDate;
    const jobMonths = job.endDate && job.endDate < currentDate ? [] : upcomingMonths(currentDate, jobEnd);
    if (jobMonths.length) {
      suggestions.push(`What happens if I stop working (${job.name})${inMonth(nearMonth(jobMonths))}?`);
    }
  }

  const rent = state.expenses.find((expense) => expense.recurring && /rent/i.test(expense.name));
  if (rent && (!rent.endDate || rent.endDate >= currentDate)) {
    suggestions.push(`What if my rent goes up ${dollars(niceAmount(rent.amount * 0.1))}?`);
  }

  if (state.transactions.length) suggestions.push("Where am I spending the most money?");

  const spare = projection.projectedEndingBalance - state.cash.targetEndingBuffer;
  if (spare >= 100) suggestions.push(`What happens if I invest ${dollars(niceAmount(spare * 0.25))}?`);

  suggestions.push("What is an ETF?");
  suggestions.push("What is APR?");
  return suggestions;
}
