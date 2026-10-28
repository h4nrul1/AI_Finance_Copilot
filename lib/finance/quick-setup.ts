import type { Category, Expense, FinanceState, Frequency, IncomeEvent, Semester } from "@/types/finance";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { addDays, asDate, toISODate } from "./dates";
import { draftExpenseToEvent, draftIncomeToEvent, type DraftItems } from "./plan-draft";

/**
 * Quick setup: students tap ranges instead of typing exact numbers. Each range maps to a "safe side" value,
 * so a rough answer still gives a plan that's safe to follow: money in (cash, income) uses the LOW end of the
 * range, money out (bills) uses the HIGH end. Amounts chosen from a range are marked as estimates.
 */

export interface AmountOption {
  label: string;
  /** The amount the plan uses for this range (already on the safe side). */
  value: number;
}

export type IncomeSourceId = "job" | "family" | "aid" | "other";
export type BillId = "rent" | "utilities" | "phone" | "groceries" | "transportation" | "car" | "subscriptions" | "tuition";

export interface IncomeSource {
  id: IncomeSourceId;
  label: string;
  amountQuestion: string;
  options: AmountOption[];
  /** Which option is preselected: the typical answer. */
  typical: number;
  defaultFrequency: Frequency | "one-time";
  /** Students can change how often this arrives. */
  frequencyChoice: boolean;
}

export interface Bill {
  id: BillId;
  label: string;
  category: Category;
  required: boolean;
  frequency: Frequency | "one-time";
  amountQuestion: string;
  options: AmountOption[];
  typical: number;
}

export const CHECKING_OPTIONS: AmountOption[] = [
  { label: "Under $500", value: 200 },
  { label: "$500 – $1,000", value: 500 },
  { label: "$1,000 – $2,500", value: 1000 },
  { label: "$2,500 – $5,000", value: 2500 },
  { label: "Over $5,000", value: 5000 }
];

export const GOAL_OPTIONS: AmountOption[] = [
  { label: "$250", value: 250 },
  { label: "$500", value: 500 },
  { label: "$1,000", value: 1000 },
  { label: "$2,000", value: 2000 }
];

export const INCOME_SOURCES: IncomeSource[] = [
  {
    id: "job",
    label: "Part-time job",
    amountQuestion: "About how much per paycheck?",
    options: [
      { label: "Under $200", value: 100 },
      { label: "$200 – $400", value: 200 },
      { label: "$400 – $700", value: 400 },
      { label: "Over $700", value: 700 }
    ],
    typical: 1,
    defaultFrequency: "biweekly",
    frequencyChoice: true
  },
  {
    id: "family",
    label: "Family support",
    amountQuestion: "About how much per month?",
    options: [
      { label: "Under $150", value: 100 },
      { label: "$150 – $300", value: 150 },
      { label: "$300 – $600", value: 300 },
      { label: "Over $600", value: 600 }
    ],
    typical: 1,
    defaultFrequency: "monthly",
    frequencyChoice: true
  },
  {
    id: "aid",
    label: "Aid or scholarship refund",
    amountQuestion: "About how much is still coming this semester?",
    options: [
      { label: "Under $500", value: 250 },
      { label: "$500 – $1,500", value: 500 },
      { label: "$1,500 – $3,000", value: 1500 },
      { label: "Over $3,000", value: 3000 }
    ],
    typical: 1,
    defaultFrequency: "one-time",
    frequencyChoice: false
  },
  {
    id: "other",
    label: "Other income",
    amountQuestion: "About how much per month?",
    options: [
      { label: "Under $150", value: 100 },
      { label: "$150 – $300", value: 150 },
      { label: "$300 – $600", value: 300 },
      { label: "Over $600", value: 600 }
    ],
    typical: 1,
    defaultFrequency: "monthly",
    frequencyChoice: true
  }
];

export const BILLS: Bill[] = [
  {
    id: "rent",
    label: "Rent",
    category: "Housing",
    required: true,
    frequency: "monthly",
    amountQuestion: "Your share per month",
    options: [
      { label: "Under $500", value: 500 },
      { label: "$500 – $800", value: 800 },
      { label: "$800 – $1,200", value: 1200 },
      { label: "Over $1,200", value: 1500 }
    ],
    typical: 1
  },
  {
    id: "utilities",
    label: "Utilities & internet",
    category: "Housing",
    required: true,
    frequency: "monthly",
    amountQuestion: "Your share per month",
    options: [
      { label: "Under $50", value: 50 },
      { label: "$50 – $100", value: 100 },
      { label: "$100 – $200", value: 200 },
      { label: "Over $200", value: 250 }
    ],
    typical: 1
  },
  {
    id: "phone",
    label: "Phone",
    category: "Subscriptions",
    required: true,
    frequency: "monthly",
    amountQuestion: "Per month",
    options: [
      { label: "Under $30", value: 30 },
      { label: "$30 – $60", value: 60 },
      { label: "$60 – $100", value: 100 },
      { label: "Over $100", value: 120 }
    ],
    typical: 1
  },
  {
    id: "groceries",
    label: "Groceries",
    category: "Groceries",
    required: true,
    frequency: "monthly",
    amountQuestion: "Per month",
    options: [
      { label: "Under $150", value: 150 },
      { label: "$150 – $300", value: 300 },
      { label: "$300 – $500", value: 500 },
      { label: "Over $500", value: 600 }
    ],
    typical: 1
  },
  {
    id: "transportation",
    label: "Gas, transit & rides",
    category: "Transportation",
    required: true,
    frequency: "monthly",
    amountQuestion: "Per month",
    options: [
      { label: "Under $50", value: 50 },
      { label: "$50 – $150", value: 150 },
      { label: "$150 – $300", value: 300 },
      { label: "Over $300", value: 350 }
    ],
    typical: 1
  },
  {
    id: "car",
    label: "Car payment & insurance",
    category: "Transportation",
    required: true,
    frequency: "monthly",
    amountQuestion: "Per month",
    options: [
      { label: "Under $200", value: 200 },
      { label: "$200 – $400", value: 400 },
      { label: "Over $400", value: 500 }
    ],
    typical: 1
  },
  {
    id: "subscriptions",
    label: "Streaming & apps",
    category: "Subscriptions",
    required: false,
    frequency: "monthly",
    amountQuestion: "Per month",
    options: [
      { label: "Under $20", value: 20 },
      { label: "$20 – $50", value: 50 },
      { label: "Over $50", value: 75 }
    ],
    typical: 0
  },
  {
    id: "tuition",
    label: "Tuition or fees still due",
    category: "Education",
    required: true,
    frequency: "one-time",
    amountQuestion: "Total still to pay this semester",
    options: [
      { label: "Under $500", value: 500 },
      { label: "$500 – $2,000", value: 2000 },
      { label: "$2,000 – $5,000", value: 5000 },
      { label: "Over $5,000", value: 6000 }
    ],
    typical: 1
  }
];

/** A chosen amount: an exact number the student typed, or a range they tapped (an estimate). */
export type AmountChoice = { kind: "exact"; value: number } | { kind: "range"; index: number };

export interface QuickSetupInput {
  semester: Omit<Semester, "currentDate">;
  checking: AmountChoice;
  savings: number;
  goal: number;
  incomes: Partial<Record<IncomeSourceId, { amount: AmountChoice; frequency: Frequency | "one-time" }>>;
  bills: Partial<Record<BillId, AmountChoice>>;
}

export function resolveAmount(choice: AmountChoice, options: AmountOption[]): { value: number; estimated: boolean } {
  if (choice.kind === "exact") return { value: Math.max(0, Math.round(choice.value * 100) / 100), estimated: false };
  const option = options[Math.min(Math.max(choice.index, 0), options.length - 1)];
  return { value: option.value, estimated: true };
}

/** The next 1st of the month on or after today; a sensible due date for monthly bills. */
export function nextFirstOfMonth(today: string) {
  if (today.endsWith("-01")) return today;
  const date = asDate(today);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 1, 12));
}

function startDateFor(frequency: Frequency | "one-time", today: string) {
  return frequency === "monthly" ? nextFirstOfMonth(today) : today;
}

function cadence(frequency: Frequency | "one-time") {
  return frequency === "one-time" ? { recurring: false } : { recurring: true, frequency };
}

/** Builds a personal plan from quick-setup answers, plus any items the AI extracted from the free-text step. */
export function buildQuickPlan(input: QuickSetupInput, today: string, name = "", extras?: DraftItems): FinanceState {
  const plan = createBlankPlan(today, name);
  const checking = resolveAmount(input.checking, CHECKING_OPTIONS);

  const incomes: IncomeEvent[] = INCOME_SOURCES.flatMap((source) => {
    const answer = input.incomes[source.id];
    if (!answer) return [];
    const amount = resolveAmount(answer.amount, source.options);
    if (amount.value <= 0) return [];
    return [
      {
        id: `income-${source.id}`,
        name: source.label,
        amount: amount.value,
        startDate: startDateFor(answer.frequency, today),
        ...cadence(answer.frequency),
        category: "Income" as const,
        guaranteed: true,
        estimated: amount.estimated
      }
    ];
  });

  const expenses: Expense[] = BILLS.flatMap((bill) => {
    const choice = input.bills[bill.id];
    if (!choice) return [];
    const amount = resolveAmount(choice, bill.options);
    if (amount.value <= 0) return [];
    // Tuition defaults to a month out (but within the semester) so it's counted; students can change the date.
    const startDate =
      bill.id === "tuition"
        ? [toISODate(addDays(asDate(today), 30)), input.semester.endDate].sort()[0]
        : startDateFor(bill.frequency, today);
    return [
      {
        id: `expense-${bill.id}`,
        name: bill.label,
        category: bill.category,
        amount: amount.value,
        startDate,
        ...cadence(bill.frequency),
        required: bill.required,
        estimated: amount.estimated
      }
    ];
  });

  return {
    ...plan,
    semester: { ...input.semester, currentDate: today },
    cash: {
      checking: checking.value,
      savings: Math.max(0, input.savings),
      targetEndingBuffer: Math.max(0, input.goal),
      checkingEstimated: checking.estimated
    },
    incomes: [...incomes, ...(extras?.incomes ?? []).map((income, index) => draftIncomeToEvent(income, `income-extra-${index}`))],
    expenses: [...expenses, ...(extras?.expenses ?? []).map((expense, index) => draftExpenseToEvent(expense, `expense-extra-${index}`))]
  };
}

/** How many amounts in a plan are still setup estimates. */
export function countEstimates(state: FinanceState) {
  return (
    (state.cash.checkingEstimated ? 1 : 0) +
    state.incomes.filter((income) => income.estimated).length +
    state.expenses.filter((expense) => expense.estimated).length
  );
}
