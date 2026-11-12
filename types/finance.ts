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
  /** True when checking came from a range during setup rather than an exact number. */
  checkingEstimated?: boolean;
  /**
   * The day checking was entered. Planned income and expenses dated from then until yesterday are applied to it
   * automatically. Missing on demo plans, whose balance is always as of their fixed date.
   */
  asOf?: string;
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
  /** True when the amount is a setup estimate the student hasn't confirmed yet. */
  estimated?: boolean;
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
  /** True when the amount is a setup estimate the student hasn't confirmed yet. */
  estimated?: boolean;
}

export interface Transaction {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  category: Category;
  /**
   * Whether this purchase comes out of the weekly budget. When unset, it does unless the plan already budgets for
   * its category (a grocery run is covered by a planned groceries expense). Set when the student overrides that.
   */
  extra?: boolean;
  /** Logged after the checking balance was last entered, so the balance doesn't include it yet. */
  pending?: boolean;
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
  /**
   * "demo" plans keep their fixed sample date; "personal" plans move "today" to the real date each time they load.
   * Plans saved before this existed have no mode and are treated as demo plans.
   */
  mode?: "demo" | "personal";
  /** Set when the student hides the "make your plan more accurate" card on Overview. */
  accuracyCardDismissed?: boolean;
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
  /** Checking as the student last entered it, and the day they entered it. */
  enteredCash: number;
  balanceDate: string;
  /** Planned income and expenses dated since then (before today), already applied to currentCash. */
  incomeSinceBalance: number;
  expensesSinceBalance: number;
  /** Spending logged since then that comes out of the weekly budget, already taken out of currentCash. */
  loggedSpending: number;
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
  thisWeek: WeekProgress;
}

/** This week's extra spending against the weekly budget as it stood when the week began (Monday to Sunday). */
export interface WeekProgress {
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  /** Negative when the week is over budget. */
  left: number;
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
