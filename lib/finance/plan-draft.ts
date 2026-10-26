import type { Category, Expense, FinanceState, Frequency, IncomeEvent } from "@/types/finance";
import { createBlankPlan, guessSemester } from "@/lib/data/blank-plan";
import { asDate } from "./dates";
import { formatDate } from "@/lib/utils";

/** The questions asked during setup. The AI turns the answers into a PlanDraft. */
export const SETUP_QUESTIONS = [
  { id: "semester", question: "Which semester are you planning for, and when does it end?", example: "Fall 2026, finals end Dec 16" },
  {
    id: "cash",
    question: "How much is in your checking account right now? Mention savings too if you keep some separate.",
    example: "About $2,400 in checking and $1,000 in savings"
  },
  {
    id: "income",
    question: "What money is coming in for the rest of the semester? Include jobs, family support, and aid or scholarship refunds.",
    example: "$600 a month from my campus job, my parents send $300 on the 1st"
  },
  { id: "housing", question: "What do you pay for housing and utilities, and when is it due?", example: "Rent $750 on the 1st, utilities about $80" },
  {
    id: "school",
    question: "Any tuition, fees, or textbook costs still coming up this semester?",
    example: "$1,200 tuition installment on Nov 15"
  },
  {
    id: "living",
    question: "Roughly how much do you spend each month on groceries, transportation, phone, and subscriptions?",
    example: "$300 groceries, $60 gas, $45 phone, $20 Spotify and Netflix"
  },
  {
    id: "extras",
    question: "Anything else planned, like trips, big purchases, or weekly money for eating out?",
    example: "About $50 a week going out, and a $400 trip home in December"
  },
  { id: "goal", question: "How much would you like to have left when finals end?", example: "At least $500" }
] as const;

export type SetupQuestionId = (typeof SETUP_QUESTIONS)[number]["id"];

export interface SetupAnswer {
  id: SetupQuestionId;
  answer: string;
}

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

/** A proposed plan. Nothing is saved until the student reviews and accepts it. */
export interface PlanDraft {
  semester: { name: string; startDate: string; endDate: string };
  cash: { checking: number; savings: number; goal: number };
  incomes: DraftIncome[];
  expenses: DraftExpense[];
  /** Assumptions the AI made, shown to the student on the review screen. */
  notes: string[];
}

const MAX_ITEMS = 25;
const MAX_AMOUNT = 100_000;
const DEFAULT_GOAL = 500;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(asDate(value).getTime());
}

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT ? Math.round(amount * 100) / 100 : null;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 60) : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Checks and cleans an AI-produced draft. Anything unusable is dropped or replaced with a safe default, and every
 * fix is reported as a warning so the student knows what to double-check. The AI's output is never trusted as-is.
 */
export function validateDraft(raw: unknown, today: string): { draft: PlanDraft; warnings: string[] } {
  const warnings: string[] = [];
  const input = record(raw);

  const semesterInput = record(input.semester);
  const guess = guessSemester(today);
  let semester = {
    name: text(semesterInput.name, guess.name),
    startDate: isIsoDate(semesterInput.startDate) ? semesterInput.startDate : guess.startDate,
    endDate: isIsoDate(semesterInput.endDate) ? semesterInput.endDate : guess.endDate
  };
  if (!isIsoDate(semesterInput.endDate) || semester.startDate >= semester.endDate) {
    semester = { ...guess, name: semester.name };
    warnings.push(`We couldn't read your semester dates, so we used ${formatDate(guess.startDate)} – ${formatDate(guess.endDate)}. Check them on Semester Plan.`);
  } else if (semester.endDate <= today) {
    warnings.push(`Your semester end date (${formatDate(semester.endDate)}) is already past. Update it if that's not right.`);
  }

  const cashInput = record(input.cash);
  const checking = money(cashInput.checking);
  const goal = money(cashInput.goal);
  if (checking === null) warnings.push("We didn't catch your checking balance, so it's set to $0. Enter it on Semester Plan.");
  if (goal === null) warnings.push(`No semester goal was given, so we set it to $${DEFAULT_GOAL}.`);
  const cash = { checking: checking ?? 0, savings: money(cashInput.savings) ?? 0, goal: goal ?? DEFAULT_GOAL };

  function cleanItem(value: unknown, kind: "income" | "expense"): DraftIncome | null {
    const item = record(value);
    const name = text(item.name, "");
    const amount = money(item.amount);
    if (!name || amount === null || amount === 0) {
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

  const list = (value: unknown) => (Array.isArray(value) ? value.slice(0, MAX_ITEMS) : []);
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
    .slice(0, 8);

  return { draft: { semester, cash, incomes, expenses, notes }, warnings };
}

function toFrequency(frequency: DraftFrequency): { recurring: boolean; frequency?: Frequency } {
  return frequency === "one-time" ? { recurring: false } : { recurring: true, frequency };
}

/** Turns an accepted draft into a personal plan. */
export function draftToPlan(draft: PlanDraft, today: string, name = ""): FinanceState {
  const plan = createBlankPlan(today, name);
  const incomes: IncomeEvent[] = draft.incomes.map((income, index) => ({
    id: `income-setup-${index}`,
    name: income.name,
    amount: income.amount,
    startDate: income.startDate,
    endDate: income.endDate ?? undefined,
    ...toFrequency(income.frequency),
    category: "Income",
    guaranteed: true
  }));
  const expenses: Expense[] = draft.expenses.map((expense, index) => ({
    id: `expense-setup-${index}`,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    startDate: expense.startDate,
    endDate: expense.endDate ?? undefined,
    ...toFrequency(expense.frequency),
    required: expense.required
  }));

  return {
    ...plan,
    semester: { ...draft.semester, currentDate: today },
    cash: { checking: draft.cash.checking, savings: draft.cash.savings, targetEndingBuffer: draft.cash.goal },
    incomes,
    expenses
  };
}
