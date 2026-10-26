import {
  DRAFT_FREQUENCIES,
  EXPENSE_CATEGORIES,
  SETUP_QUESTIONS,
  validateDraft,
  type PlanDraft,
  type SetupAnswer
} from "@/lib/finance/plan-draft";

const OPENAI_TIMEOUT_MS = 30_000;

const SETUP_SYSTEM_PROMPT = `
You turn a college student's answers about their money into a draft semester budget plan.

Where each field comes from:
- semester: the first answer. Use a tidy name like "Fall 2026". If the start date isn't given, use the usual start of that term (Fall: late August, Spring: mid January, Summer: mid May). If the term or end date isn't given, infer the current term from today's date and add a note.
- cash.checking and cash.savings: the checking/savings answer.
- cash.goal: the LAST answer ("How much would you like to have left when finals end?"). "At least 400" means 400.
- incomes and expenses: all the other answers.
- Use null for checking, savings, or goal only if the student truly didn't give it.

Rules:
- Use only what the student said. Never invent income, expenses, or amounts. Leave a list empty if nothing was mentioned.
- Amounts are US dollars as plain numbers. If the student gives a range, use the middle.
- Keep the frequency the student used: "$40 a week" is a weekly $40 expense, "every two weeks" is biweekly. Never convert between frequencies.
- A monthly total for a category (e.g. "$300 a month on groceries") is one monthly expense.
- Dates are YYYY-MM-DD. Today's date is given; dates without a year are in the semester being planned.
- For recurring items, startDate is the next due date on or after today (e.g. rent "on the 1st" means the next 1st). If no day is given, use today. endDate is null unless the student says when it stops.
- Required expenses are hard to skip: rent, utilities, tuition, fees, textbooks, groceries, phone, transportation, insurance, loan payments. Eating out, entertainment, shopping, streaming, and trips are not required.
- Categories: rent and utilities are Housing; phone, internet, and streaming are Subscriptions; use Other only if nothing fits.
- notes: at most 4 short notes, written to the student, about assumptions you made. Combine similar ones ("I assumed your monthly bills are due on the 1st.").
`.trim();

const itemProperties = {
  name: { type: "string" },
  amount: { type: "number" },
  frequency: { type: "string", enum: [...DRAFT_FREQUENCIES] },
  startDate: { type: "string", description: "YYYY-MM-DD" },
  endDate: { type: ["string", "null"], description: "YYYY-MM-DD, or null if it continues through the semester" }
};

/** JSON schema for OpenAI structured outputs. Strict mode requires every property to be listed as required. */
const PLAN_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["semester", "cash", "incomes", "expenses", "notes"],
  properties: {
    semester: {
      type: "object",
      additionalProperties: false,
      required: ["name", "startDate", "endDate"],
      properties: { name: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }
    },
    cash: {
      type: "object",
      additionalProperties: false,
      required: ["checking", "savings", "goal"],
      properties: { checking: { type: ["number", "null"] }, savings: { type: ["number", "null"] }, goal: { type: ["number", "null"] } }
    },
    incomes: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: Object.keys(itemProperties), properties: itemProperties }
    },
    expenses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [...Object.keys(itemProperties), "category", "required"],
        properties: { ...itemProperties, category: { type: "string", enum: EXPENSE_CATEGORIES }, required: { type: "boolean" } }
      }
    },
    notes: { type: "array", items: { type: "string" } }
  }
};

export function formatAnswers(answers: SetupAnswer[]) {
  return SETUP_QUESTIONS.map((question) => {
    const answer = answers.find((item) => item.id === question.id)?.answer.trim();
    return `Q: ${question.question}\nA: ${answer || "(skipped)"}`;
  }).join("\n\n");
}

/** Asks the model for a draft plan, then validates it. Throws if the model can't be reached. */
export async function draftPlanWithOpenAI(
  apiKey: string,
  answers: SetupAnswer[],
  today: string
): Promise<{ draft: PlanDraft; warnings: string[] }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SETUP_SYSTEM_PROMPT },
        { role: "user", content: `Today is ${today}.\n\n${formatAnswers(answers)}` }
      ],
      response_format: { type: "json_schema", json_schema: { name: "plan_draft", strict: true, schema: PLAN_DRAFT_SCHEMA } }
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no draft");
  return validateDraft(withGoalFallback(JSON.parse(content), answers), today);
}

/**
 * The goal question has a single, dedicated answer, so if the model misses it we can read the amount directly
 * ("at least $400" -> 400) instead of falling back to a default.
 */
export function withGoalFallback(raw: unknown, answers: SetupAnswer[]): unknown {
  const draft = raw as { cash?: { goal?: unknown } } | null;
  if (!draft?.cash || typeof draft.cash.goal === "number") return raw;
  const goalAnswer = answers.find((answer) => answer.id === "goal")?.answer ?? "";
  const match = goalAnswer.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? { ...draft, cash: { ...draft.cash, goal: Number(match[0]) } } : raw;
}
