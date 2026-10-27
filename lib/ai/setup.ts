import { thanksgivingDate } from "@/lib/finance/dates";
import { DRAFT_FREQUENCIES, EXPENSE_CATEGORIES, validateItems, type DraftItems } from "@/lib/finance/plan-draft";

const OPENAI_TIMEOUT_MS = 30_000;

const EXTRAS_SYSTEM_PROMPT = `
A college student is setting up a semester budget. They already entered their checking balance, regular income, and regular bills.
In one free-text answer they describe anything else coming up. Turn it into plan items.

Rules:
- Use only what the student wrote. Never invent items or amounts. Return empty lists if nothing usable was mentioned.
- Amounts are US dollars as plain numbers. Estimates are fine: for a range, use the higher end for expenses and the lower end for income, and add a note.
- Keep the frequency the student used: "$40 a week" is a weekly $40 expense. Never convert between frequencies.
- Dates are YYYY-MM-DD within the semester given. Dates without a year are in that semester.
- Turn named times into dates. Use the key dates given in the message for holidays (for travel, use the day before the holiday). "Early/mid/late <month>" means the 1st, 15th, or 25th; "next month" means the 1st of next month; "end of semester" means the semester end date.
- Only if no time at all is given, use today and add a note.
- endDate is null unless the student says when a recurring item stops.
- Required expenses are hard to skip (tuition, fees, textbooks, medical, insurance, loan payments). Trips, eating out, entertainment, shopping, and gifts are not required.
- Pick the closest category; use Other only if nothing fits.
- notes: at most 3 short notes to the student about assumptions you made.
`.trim();

const itemProperties = {
  name: { type: "string" },
  amount: { type: "number" },
  frequency: { type: "string", enum: [...DRAFT_FREQUENCIES] },
  startDate: { type: "string", description: "YYYY-MM-DD" },
  endDate: { type: ["string", "null"], description: "YYYY-MM-DD, or null if it continues through the semester" }
};

/** JSON schema for OpenAI structured outputs. Strict mode requires every property to be listed as required. */
const EXTRAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["incomes", "expenses", "notes"],
  properties: {
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

/** Asks the model to turn the student's free-text extras into plan items, then validates them. */
export async function extractExtrasWithOpenAI(
  apiKey: string,
  text: string,
  today: string,
  semester: { name: string; endDate: string }
): Promise<{ items: DraftItems; warnings: string[] }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: EXTRAS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Today is ${today}. The semester is ${semester.name} and ends ${semester.endDate}.\nKey dates: Thanksgiving is ${thanksgivingDate(
            Number(today.slice(0, 4))
          )}.\n\nStudent's answer: ${text}`
        }
      ],
      response_format: { type: "json_schema", json_schema: { name: "extra_items", strict: true, schema: EXTRAS_SCHEMA } }
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no items");
  return validateItems(JSON.parse(content), today);
}
