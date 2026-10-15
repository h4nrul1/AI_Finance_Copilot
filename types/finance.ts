export type Frequency = "monthly" | "weekly" | "biweekly";

export type Category =
  | "Housing"
  | "Groceries"
  | "Dining"
  | "Transportation"
  | "Entertainment"
  | "Shopping"
  | "Education"
  | "Subscriptions"
  | "Income"
  | "Other";

export interface StudentProfile {
  name: string;
  school: string;
  major: string;
  year: string;
}

export interface Semester {
  name: string;
  startDate: string;
  endDate: string;
  currentDate: string;
}

export interface CashPosition {
  checking: number;
  savings: number;
  targetEndingBuffer: number;
}

export interface IncomeEvent {
  id: string;
  name: string;
  amount: number;
  startDate: string;
  endDate?: string;
  recurring: boolean;
  frequency?: Frequency;
  category: "Income";
  guaranteed: boolean;
}

export interface Expense {
  id: string;
  name: string;
  category: Category;
  amount: number;
  startDate: string;
  endDate?: string;
  recurring: boolean;
  frequency?: Frequency;
  required: boolean;
}

export interface Transaction {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  category: Category;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  description: string;
}

/**
 * The student's verdict thresholds, measured as how much a decision cuts their safe weekly budget (0-1).
 * Comfortable: cut <= comfortableDropLimit. Fits, but tight: up to tightDropLimit. Not recommended: above it.
 * Going below $0 or ending below the goal is always "Not recommended", whatever these are.
 */
export interface VerdictSettings {
  comfortableDropLimit: number;
  tightDropLimit: number;
}

export interface FinanceState {
  student: StudentProfile;
  semester: Semester;
  cash: CashPosition;
  incomes: IncomeEvent[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  /** Optional so plans saved before this setting existed still load. */
  verdictSettings?: VerdictSettings;
}

export type ScenarioType =
  | "purchase"
  | "income-loss"
  | "expense-change"
  | "investment"
  | "unexpected-expense";

export interface Scenario {
  id: string;
  name: string;
  description: string;
  type: ScenarioType;
  amount?: number;
  date?: string;
  incomeName?: string;
  stopDate?: string;
  expenseName?: string;
}

export interface ProjectionPoint {
  date: string;
  label: string;
  balance: number;
  events: string[];
}

export interface UpcomingEvent {
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: "income" | "expense";
  category: Category;
  /** Expenses only: required (rent, tuition) vs flexible. */
  required: boolean;
}

export interface SafeWeeklyBreakdown {
  currentCash: number;
  expectedRemainingIncome: number;
  requiredRemainingExpenses: number;
  targetEndingBuffer: number;
  discretionaryAlreadyPlanned: number;
  availableForDiscretionary: number;
  weeksRemaining: number;
  safeWeeklySpending: number;
}

export interface FinancialProjection {
  timeline: ProjectionPoint[];
  projectedEndingBalance: number;
  safeWeekly: SafeWeeklyBreakdown;
  expectedRemainingIncome: number;
  requiredRemainingExpenses: number;
  discretionaryRemainingExpenses: number;
  lowestProjectedBalance: number;
  upcomingEvents: UpcomingEvent[];
  semesterHealth: "On Track" | "Tight" | "At Risk";
}

export type VerdictLevel = "comfortable" | "tight" | "not-recommended";

export interface Verdict {
  level: VerdictLevel;
  label: "Comfortable" | "Fits, but tight" | "Not recommended";
  headline: string;
  reasons: string[];
  suggestion?: string;
  /** Which rule produced this verdict, in plain language. */
  rule: string;
}

export interface ScenarioResult {
  scenario: Scenario;
  baseline: FinancialProjection;
  scenarioProjection: FinancialProjection;
  endingDifference: number;
  weeklyDifference: number;
  verdict: Verdict;
  explanation: string;
}

export interface ProjectionSnapshot {
  endingCash: number;
  safeWeeklySpending: number;
  lowestBalance: number;
}

/** Compact, serializable view of a ScenarioResult for the copilot and its UI. */
export interface ScenarioSummary {
  scenarioName: string;
  baseline: ProjectionSnapshot;
  withChange: ProjectionSnapshot;
  targetEndingBuffer: number;
  endingDifference: number;
  weeklyDifference: number;
  verdict: Verdict;
}

/** The largest one-time purchase on a date that keeps each verdict level. */
export interface MaxAffordableResult {
  date: string;
  /** Largest amount that is still "Comfortable" (0 if nothing is). */
  comfortableMax: number;
  /** Largest amount that is not "Not recommended" (0 if nothing is). */
  tightMax: number;
  goal: number;
  comfortableDropLimit: number;
  tightDropLimit: number;
}
