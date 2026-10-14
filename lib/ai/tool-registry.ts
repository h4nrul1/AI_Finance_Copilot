import type { FinanceState, Scenario, ScenarioSummary } from "@/types/finance";
import { buildProjection } from "@/lib/finance/engine";
import { compareScenarioToBaseline, getSpendingByCategory, summarizeScenarioResult } from "@/lib/finance/tools";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolExecution {
  name: string;
  input: Record<string, unknown>;
  ok: boolean;
  /** JSON-serializable payload sent back to the model. */
  output: unknown;
  /** Present when the tool ran a what-if scenario; drives the verdict card in the UI. */
  scenario?: ScenarioSummary;
}

class ToolInputError extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000;

function requireAmount(args: Record<string, unknown>, key = "amount", { allowNegative = false } = {}) {
  const value = Number(args[key]);
  if (!Number.isFinite(value) || value === 0 || (!allowNegative && value < 0) || Math.abs(value) > MAX_AMOUNT) {
    throw new ToolInputError(`"${key}" must be a ${allowNegative ? "non-zero" : "positive"} dollar amount.`);
  }
  return Math.round(value * 100) / 100;
}

function requireDate(state: FinanceState, args: Record<string, unknown>, key = "date") {
  const { currentDate, endDate } = state.semester;
  const value = args[key] ?? currentDate;
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new ToolInputError(`"${key}" must be a YYYY-MM-DD date.`);
  }
  if (value < currentDate || value > endDate) {
    throw new ToolInputError(`"${key}" must be between ${currentDate} and ${endDate} (the rest of the semester).`);
  }
  return value;
}

function requireName(args: Record<string, unknown>, key: string, options: string[]) {
  const value = args[key];
  const match = typeof value === "string" ? options.find((option) => option.toLowerCase() === value.toLowerCase()) : undefined;
  if (!match) throw new ToolInputError(`"${key}" must be one of: ${options.join(", ")}.`);
  return match;
}

function recurringIncomeNames(state: FinanceState) {
  return state.incomes.filter((income) => income.recurring && income.guaranteed).map((income) => income.name);
}

function recurringExpenseNames(state: FinanceState) {
  return state.expenses.filter((expense) => expense.recurring).map((expense) => expense.name);
}

const dateParam = {
  type: "string",
  description: "Date in YYYY-MM-DD format, within the remaining semester. Use today's date if the user gives no timing."
};

/** Tool schemas are built from the student's plan so enums always match real income and expense names. */
export function buildToolDefinitions(state: FinanceState): ToolDefinition[] {
  const incomes = recurringIncomeNames(state);
  const expenses = recurringExpenseNames(state);
  const tools: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "get_semester_snapshot",
        description:
          "Current cash, projected semester-end cash, safe weekly spending (with its full breakdown), lowest projected balance, semester health, and the next upcoming income/expense events. Use for 'how much can I spend each week', 'how much will I have left', or 'how am I doing'.",
        parameters: { type: "object", properties: {}, additionalProperties: false }
      }
    },
    {
      type: "function",
      function: {
        name: "get_spending_by_category",
        description: "Totals of past transactions by category. Use for 'where am I spending the most' questions.",
        parameters: { type: "object", properties: {}, additionalProperties: false }
      }
    },
    {
      type: "function",
      function: {
        name: "check_purchase",
        description:
          "Simulate a one-time purchase or unexpected expense and return its effect on the semester plus a deterministic affordability verdict.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short label, e.g. 'Chicago trip'." },
            amount: { type: "number", description: "Cost in dollars." },
            date: dateParam
          },
          required: ["name", "amount", "date"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "simulate_investment",
        description:
          "Simulate moving cash out of checking into an investment account on a date. Returns the liquidity impact and a verdict. Never recommends specific securities.",
        parameters: {
          type: "object",
          properties: { amount: { type: "number", description: "Dollars moved to investing." }, date: dateParam },
          required: ["amount", "date"],
          additionalProperties: false
        }
      }
    }
  ];

  if (incomes.length) {
    tools.push({
      type: "function",
      function: {
        name: "simulate_income_loss",
        description: "Simulate a recurring income source stopping after a date (e.g. quitting a job).",
        parameters: {
          type: "object",
          properties: {
            income_name: { type: "string", enum: incomes },
            stop_date: { ...dateParam, description: "Last date the income is received, YYYY-MM-DD." }
          },
          required: ["income_name", "stop_date"],
          additionalProperties: false
        }
      }
    });
  }

  if (expenses.length) {
    tools.push({
      type: "function",
      function: {
        name: "simulate_recurring_expense_change",
        description:
          "Simulate a recurring expense (e.g. rent) changing by a dollar amount per payment from a date onward. Use a negative delta for a decrease.",
        parameters: {
          type: "object",
          properties: {
            expense_name: { type: "string", enum: expenses },
            amount_delta: { type: "number", description: "Change per payment in dollars, e.g. 100 for +$100/month." },
            start_date: dateParam
          },
          required: ["expense_name", "amount_delta", "start_date"],
          additionalProperties: false
        }
      }
    });
  }

  return tools;
}

function runScenario(state: FinanceState, scenario: Scenario) {
  const summary = summarizeScenarioResult(state, compareScenarioToBaseline(state, scenario));
  return { output: summary, scenario: summary };
}

function dispatch(state: FinanceState, name: string, args: Record<string, unknown>): Omit<ToolExecution, "name" | "input" | "ok"> {
  switch (name) {
    case "get_semester_snapshot": {
      const projection = buildProjection(state);
      return {
        output: {
          today: state.semester.currentDate,
          semesterEnd: state.semester.endDate,
          currentCash: state.cash.checking,
          savingsNotCounted: state.cash.savings,
          projectedEndingCash: projection.projectedEndingBalance,
          lowestProjectedBalance: projection.lowestProjectedBalance,
          semesterHealth: projection.semesterHealth,
          safeWeekly: { ...projection.safeWeekly, safeWeeklySpending: Math.round(projection.safeWeekly.safeWeeklySpending) },
          upcomingEvents: projection.upcomingEvents
        }
      };
    }
    case "get_spending_by_category": {
      const totals = Object.entries(getSpendingByCategory(state))
        .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total);
      return { output: { categories: totals, transactionCount: state.transactions.length } };
    }
    case "check_purchase":
      return runScenario(state, {
        id: "copilot-purchase",
        name: typeof args.name === "string" && args.name.trim() ? args.name.trim().slice(0, 60) : "Purchase",
        description: "Copilot purchase check",
        type: "purchase",
        amount: requireAmount(args),
        date: requireDate(state, args)
      });
    case "simulate_investment":
      return runScenario(state, {
        id: "copilot-invest",
        name: "Move money to investing",
        description: "Copilot investment check",
        type: "investment",
        amount: requireAmount(args),
        date: requireDate(state, args)
      });
    case "simulate_income_loss": {
      const incomeName = requireName(args, "income_name", recurringIncomeNames(state));
      return runScenario(state, {
        id: "copilot-income-loss",
        name: `Stop ${incomeName}`,
        description: "Copilot income-loss check",
        type: "income-loss",
        incomeName,
        stopDate: requireDate(state, args, "stop_date")
      });
    }
    case "simulate_recurring_expense_change": {
      const expenseName = requireName(args, "expense_name", recurringExpenseNames(state));
      return runScenario(state, {
        id: "copilot-expense-change",
        name: `${expenseName} change`,
        description: "Copilot recurring expense check",
        type: "expense-change",
        expenseName,
        amount: requireAmount(args, "amount_delta", { allowNegative: true }),
        date: requireDate(state, args, "start_date")
      });
    }
    default:
      throw new ToolInputError(`Unknown tool "${name}".`);
  }
}

/** Runs a tool by name. Invalid input is returned to the model as an error so it can correct itself or ask the user. */
export function executeTool(state: FinanceState, name: string, args: Record<string, unknown>): ToolExecution {
  try {
    return { name, input: args, ok: true, ...dispatch(state, name, args) };
  } catch (error) {
    const message = error instanceof ToolInputError ? error.message : "The calculation failed.";
    return { name, input: args, ok: false, output: { error: message } };
  }
}
