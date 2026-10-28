import type { FinanceState } from "@/types/finance";
import { addDays, asDate, toISODate } from "@/lib/finance/dates";
import { formatCurrency } from "@/lib/utils";
import { buildStudentContext, FINANCIAL_COPILOT_SYSTEM_PROMPT } from "./prompts";
import { buildToolDefinitions, executeTool, type CopilotDetail, type ToolExecution } from "./tool-registry";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotToolCall {
  name: string;
  input: Record<string, unknown>;
  ok: boolean;
}

export interface CopilotAnswer {
  message: string;
  mode: "mock" | "openai";
  toolCalls: CopilotToolCall[];
  /** Deterministic results from every successful tool call, rendered as cards under the message. */
  details: CopilotDetail[];
}

const MAX_TOOL_ROUNDS = 4;
const OPENAI_TIMEOUT_MS = 20_000;

function toAnswer(message: string, mode: CopilotAnswer["mode"], executions: ToolExecution[]): CopilotAnswer {
  return {
    message,
    mode,
    toolCalls: executions.map(({ name, input, ok }) => ({ name, input, ok })),
    details: executions.flatMap((execution) => (execution.ok && execution.detail ? [execution.detail] : []))
  };
}

// ---------------------------------------------------------------------------
// Offline fallback: keyword intent detection over the same tools the model uses.
// ---------------------------------------------------------------------------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_PATTERNS = MONTHS.map((month) => `(?:${month}|${month.slice(0, 3)}${month === "september" ? "t?" : ""})`);

export function extractAmount(message: string) {
  const match = message.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/) ?? message.match(/\b(\d{1,3}(?:,\d{3})+|\d{2,6})\b(?!-)/);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

export function extractDate(message: string, state: FinanceState) {
  const { currentDate, endDate } = state.semester;
  const lower = message.toLowerCase();
  let date: string | undefined;

  if (/\bnext week\b/.test(lower)) date = toISODate(addDays(asDate(currentDate), 7));
  // "apr" and "may" are also ordinary words in finance questions, so those two need "in"/"on"/"by" before them.
  const monthIndex = MONTH_PATTERNS.findIndex((pattern, index) =>
    new RegExp(index === 3 || index === 4 ? `\\b(?:in|on|by) ${pattern}\\b` : `\\b${pattern}\\b`).test(lower)
  );
  if (monthIndex >= 0) {
    date = `${currentDate.slice(0, 4)}-${String(monthIndex + 1).padStart(2, "0")}-15`;
  }

  if (!date) return currentDate;
  return date < currentDate ? currentDate : date > endDate ? endDate : date;
}

type Intent =
  | { kind: "tool"; name: string; args: Record<string, unknown> }
  | { kind: "clarify"; message: string }
  | { kind: "education" };

export function detectIntent(message: string, state: FinanceState): Intent {
  const lower = message.toLowerCase();
  const amount = extractAmount(message);
  const date = extractDate(message, state);
  const isConceptQuestion = /^(what('s| is| are| does)|explain|define|how does|tell me about)\b/.test(lower.trim()) && !/\bif\b/.test(lower);

  if (isConceptQuestion && amount === undefined) return { kind: "education" };

  if (/\b(stop|quit|lose|lost)\b.*\b(work|working|job)\b/.test(lower)) {
    const job = state.incomes.find((income) => income.recurring && income.guaranteed);
    if (job) return { kind: "tool", name: "simulate_income_loss", args: { income_name: job.name, stop_date: date } };
  }

  if (/\brent\b/.test(lower)) {
    const rent = state.expenses.find((expense) => expense.recurring && /rent/i.test(expense.name));
    if (rent) {
      const delta = (amount ?? 100) * (/\b(decrease|drop|lower|cheaper)\b/.test(lower) ? -1 : 1);
      return { kind: "tool", name: "simulate_recurring_expense_change", args: { expense_name: rent.name, amount_delta: delta, start_date: date } };
    }
  }

  if (/\binvest/.test(lower)) {
    if (amount === undefined) return { kind: "clarify", message: "How much are you thinking of moving into investing, and when?" };
    return { kind: "tool", name: "simulate_investment", args: { amount, date } };
  }

  if (/most money|spending the most|by category|categor|where .*spend/.test(lower)) {
    return { kind: "tool", name: "get_spending_by_category", args: {} };
  }

  if (/\b(safe|safely|weekly|each week|per week|a week)\b/.test(lower)) {
    return { kind: "tool", name: "get_semester_snapshot", args: {} };
  }

  if (amount === undefined && /how much (can|could|should) i (spend|afford|budget)|what('s| is) my budget for|most i can (spend|afford)/.test(lower)) {
    return { kind: "tool", name: "find_max_affordable", args: { date } };
  }

  if (/\b(afford|buy|purchase|trip|spend|pay for)\b/.test(lower)) {
    if (amount === undefined) return { kind: "clarify", message: "Happy to check. Roughly how much would it cost, and when would you pay for it?" };
    const name = /\btrip\b/.test(lower) ? "Trip" : "Purchase";
    return { kind: "tool", name: "check_purchase", args: { name, amount, date } };
  }

  if (/\b(left|end of (the )?semester|ending|how am i doing|on track)\b/.test(lower)) {
    return { kind: "tool", name: "get_semester_snapshot", args: {} };
  }

  return { kind: "education" };
}

function educationAnswer(message: string, state: FinanceState) {
  const lower = message.toLowerCase();

  if (lower.includes("etf")) {
    return `An ETF, or exchange-traded fund, is a basket of investments you can buy as one fund. A broad ETF can hold pieces of many companies, which is why people use ETFs to learn about diversification. For you, the key question is liquidity: money invested for the long term should not be money needed for rent or tuition this semester.`;
  }
  if (lower.includes("apr") || lower.includes("interest")) {
    return `APR means annual percentage rate. It is the yearly cost of borrowing money, including interest and some fees. For a credit card, carrying a balance can get expensive quickly because interest may be charged every billing cycle. A good student rule is to pay the full statement balance whenever possible.`;
  }
  if (lower.includes("credit")) {
    return `Credit card interest is what you pay when you do not pay the full statement balance. The card company applies an APR, and the cost can compound over time. Building credit is useful, but carrying a balance for routine spending can shrink the semester cushion fast.`;
  }
  if (lower.includes("loan")) {
    return `A grant or scholarship is generally money you do not repay. A loan is borrowed money that must be repaid later, usually with interest. Loans can help cover school costs, but they are different from income because they create a future obligation.`;
  }
  if (lower.includes("aid")) {
    return `A financial aid offer usually mixes free aid (grants and scholarships), borrowed aid (loans), and work-study, which you only receive by working. Only the free aid actually lowers your cost; loans have to be repaid later, so treat them as borrowed money rather than income.`;
  }
  if (lower.includes("emergency")) {
    return `An emergency fund is money kept available for unexpected expenses, like a medical bill or car repair. Your plan protects a ${formatCurrency(state.cash.targetEndingBuffer)} semester-end buffer, which works like a small emergency cushion.`;
  }
  if (lower.includes("divers")) {
    return `Diversification means not putting all your money into one investment, so one company or sector doing poorly hurts less. For students it also means diversifying across time: keep near-term bill money in cash and treat investing as longer-term money.`;
  }
  if (lower.includes("invest")) {
    return `Investing means accepting risk in exchange for possible long-term growth. Prices can fall right when you need the money, so cash for rent, food, or tuition this semester usually stays in checking or savings. You can ask me "What happens if I invest $300?" to see the effect on your plan.`;
  }

  return `Budgeting in college is mostly about timing. The question is not only what you spent last month, but whether cash, aid, income, and required expenses line up through the end of the semester. Try asking "How much can I safely spend each week?"`;
}

function describeExecution(execution: ToolExecution, state: FinanceState) {
  if (!execution.ok) {
    return `I couldn't run that calculation: ${(execution.output as { error: string }).error}`;
  }

  // Details (breakdowns, before/after numbers) are shown by the card under the message, so keep the text short.
  const detail = execution.detail;
  switch (detail?.kind) {
    case "scenario":
      return `${detail.scenario.verdict.label}. ${detail.scenario.verdict.headline}`;
    case "spending": {
      const [top] = detail.categories;
      return top
        ? `Your largest spending category so far is ${top.category} at ${formatCurrency(top.total, 2)}. Categories with many small purchases, like dining, are usually the easiest place to cut back.`
        : "I don't see any logged spending yet.";
    }
    case "max-affordable":
      return detail.result.comfortableMax > 0
        ? `You can spend up to ${formatCurrency(detail.result.comfortableMax)} and stay comfortable. Up to ${formatCurrency(detail.result.tightMax)} still fits, but it gets tight.`
        : detail.result.tightMax > 0
          ? `Nothing stays fully comfortable right now, but up to ${formatCurrency(detail.result.tightMax)} still fits without going below your goal.`
          : "Any extra purchase would put you below your semester goal right now.";
    case "snapshot":
      return `You can safely spend about ${formatCurrency(detail.breakdown.safeWeeklySpending)}/week on flexible items for the next ${detail.breakdown.weeksRemaining.toFixed(
        1
      )} weeks while protecting a ${formatCurrency(detail.breakdown.targetEndingBuffer)} goal. Projected semester-end cash is ${formatCurrency(detail.projectedEndingCash)} (${detail.semesterHealth}).`;
    default:
      return "Done.";
  }
}

export function mockCopilot(message: string, state: FinanceState): CopilotAnswer {
  const intent = detectIntent(message, state);
  if (intent.kind === "clarify") return toAnswer(intent.message, "mock", []);
  if (intent.kind === "education") return toAnswer(educationAnswer(message, state), "mock", []);

  const execution = executeTool(state, intent.name, intent.args);
  return toAnswer(describeExecution(execution, state), "mock", [execution]);
}

// ---------------------------------------------------------------------------
// OpenAI function calling: the model picks tools, the engine computes, the model explains.
// ---------------------------------------------------------------------------

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAIToolCall[] } }>;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function callOpenAI(apiKey: string, messages: OpenAIMessage[], state: FinanceState): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      tools: buildToolDefinitions(state),
      tool_choice: "auto",
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return (await response.json()) as OpenAIResponse;
}

export async function runOpenAICopilot(apiKey: string, message: string, state: FinanceState, history: ChatTurn[]): Promise<CopilotAnswer> {
  const messages: OpenAIMessage[] = [
    { role: "system", content: `${FINANCIAL_COPILOT_SYSTEM_PROMPT}\n\n${buildStudentContext(state)}` },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: message }
  ];
  const executions: ToolExecution[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const reply = (await callOpenAI(apiKey, messages, state)).choices?.[0]?.message;
    if (!reply) throw new Error("OpenAI returned no message");

    if (!reply.tool_calls?.length) {
      if (!reply.content) throw new Error("OpenAI returned an empty message");
      return toAnswer(reply.content, "openai", executions);
    }

    messages.push({ role: "assistant", content: reply.content ?? null, tool_calls: reply.tool_calls });
    for (const call of reply.tool_calls) {
      const execution = executeTool(state, call.function.name, parseArguments(call.function.arguments));
      executions.push(execution);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(execution.output) });
    }
  }

  // The model kept calling tools; fall back to describing the last result deterministically.
  const last = executions[executions.length - 1];
  return toAnswer(last ? describeExecution(last, state) : educationAnswer(message, state), "openai", executions);
}

export async function askFinancialCopilot(message: string, state: FinanceState, history: ChatTurn[] = []): Promise<CopilotAnswer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return mockCopilot(message, state);

  try {
    return await runOpenAICopilot(apiKey, message, state, history);
  } catch (error) {
    console.error("[copilot] OpenAI path failed, using offline fallback:", error instanceof Error ? error.message : error);
    return mockCopilot(message, state);
  }
}
