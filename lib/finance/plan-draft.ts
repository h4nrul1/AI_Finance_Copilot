import type { Category, Expense, Frequency, IncomeEvent } from "@/types/finance";
import { asDate } from "./dates";

/**
 * Items the AI extracts from the optional free-text "Anything else?" step of setup. The AI's output is never
 * trusted as-is: validateItems checks every field before anything reaches the plan.
 */

export const DRAFT_FREQUENCIES = ["one-time", "weekly", "biweekly", "monthly"] as const;
export type DraftFrequency = (typeof DRAFT_FREQUENCIES)[number];

export const EXPENSE_CATEGORIES: Category[] = [
  "Housing",
  "Groceries",
  "Dining",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Education",
  "Subscriptions",
  "Other"
];

export interface DraftIncome {
  name: string;
  amount: number;
  frequency: DraftFrequency;
  startDate: string;
  endDate: string | null;
}

export interface DraftExpense extends DraftIncome {
  category: Category;
  required: boolean;
}

export interface DraftItems {
  incomes: DraftIncome[];
  expenses: DraftExpense[];
  /** Assumptions the AI made, shown to the student on the review screen. */
  notes: string[];
}

const MAX_ITEMS = 15;
const MAX_AMOUNT = 100_000;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(asDate(value).getTime());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Cleans AI-extracted items. Unusable entries are dropped and every fix is reported as a warning. */
export function validateItems(raw: unknown, today: string): { items: DraftItems; warnings: string[] } {
  const warnings: string[] = [];
  const input = record(raw);
  const list = (value: unknown) => (Array.isArray(value) ? value.slice(0, MAX_ITEMS) : []);

  function cleanItem(value: unknown, kind: "income" | "expense"): DraftIncome | null {
    const item = record(value);
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 60) : "";
    const amount = typeof item.amount === "number" && Number.isFinite(item.amount) ? Math.round(item.amount * 100) / 100 : 0;
    if (!name || amount <= 0 || amount > MAX_AMOUNT) {
      warnings.push(`Skipped an ${kind} we couldn't read${name ? ` ("${name}")` : ""}.`);
      return null;
    }
    const frequency = DRAFT_FREQUENCIES.includes(item.frequency as DraftFrequency) ? (item.frequency as DraftFrequency) : "one-time";
    const startDate = isIsoDate(item.startDate) ? item.startDate : today;
    const endDate = frequency !== "one-time" && isIsoDate(item.endDate) && item.endDate > startDate ? item.endDate : null;
    if (frequency === "one-time" && startDate < today) {
      warnings.push(`"${name}" is dated before today, so it won't be counted (your balance already reflects it).`);
    }
    return { name, amount, frequency, startDate, endDate };
  }

  const incomes = list(input.incomes)
    .map((item) => cleanItem(item, "income"))
    .filter((item): item is DraftIncome => item !== null);
  const expenses = list(input.expenses).flatMap((value): DraftExpense[] => {
    const base = cleanItem(value, "expense");
    if (!base) return [];
    const item = record(value);
    const category = EXPENSE_CATEGORIES.includes(item.category as Category) ? (item.category as Category) : "Other";
    return [{ ...base, category, required: item.required === true }];
  });
  const notes = list(input.notes)
    .filter((note): note is string => typeof note === "string" && note.trim() !== "")
    .map((note) => note.trim().slice(0, 200))
    .slice(0, 4);

  return { items: { incomes, expenses, notes }, warnings };
}

function toFrequency(frequency: DraftFrequency): { recurring: boolean; frequency?: Frequency } {
  return frequency === "one-time" ? { recurring: false } : { recurring: true, frequency };
}

export function draftIncomeToEvent(income: DraftIncome, id: string): IncomeEvent {
  return {
    id,
    name: income.name,
    amount: income.amount,
    startDate: income.startDate,
    endDate: income.endDate ?? undefined,
    ...toFrequency(income.frequency),
    category: "Income",
    guaranteed: true
  };
}

export function draftExpenseToEvent(expense: DraftExpense, id: string): Expense {
  return {
    id,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    startDate: expense.startDate,
    endDate: expense.endDate ?? undefined,
    ...toFrequency(expense.frequency),
    required: expense.required
  };
}
