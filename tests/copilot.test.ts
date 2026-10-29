import { afterEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/lib/data/seed";
import { detectIntent, extractAmount, extractDate, mockCopilot, runOpenAICopilot } from "@/lib/ai/copilot";
import { buildToolDefinitions, executeTool, type CopilotDetail } from "@/lib/ai/tool-registry";
import * as financeTools from "@/lib/finance/tools";

function scenarioOf(detail: CopilotDetail | undefined) {
  if (detail?.kind !== "scenario") throw new Error(`expected a scenario detail, got ${detail?.kind}`);
  return detail.scenario;
}

describe("tool registry", () => {
  it("returns scenario validation messages to the model as tool errors", () => {
    const spy = vi.spyOn(financeTools, "compareScenarioToBaseline").mockImplementationOnce(() => {
      throw new financeTools.ScenarioInputError("No recurring expense matches the selected bill.");
    });
    try {
      const execution = executeTool(demoState, "simulate_recurring_expense_change", { expense_name: "Rent", amount_delta: 100, start_date: "2026-10-01" });
      expect(execution.ok).toBe(false);
      expect(execution.output).toEqual({ error: "No recurring expense matches the selected bill." });
    } finally {
      spy.mockRestore();
    }
  });

  it("exposes the student's real income and expense names as enums", () => {
    const tools = buildToolDefinitions(demoState);
    const incomeTool = tools.find((tool) => tool.function.name === "simulate_income_loss");
    const params = incomeTool?.function.parameters as { properties: { income_name: { enum: string[] } } };

    expect(params.properties.income_name.enum).toEqual(["Part-time campus job"]);
  });

  it("returns a verdict and summary for purchase checks", () => {
    const execution = executeTool(demoState, "check_purchase", { name: "Trip", amount: 500, date: "2026-11-12" });

    expect(execution.ok).toBe(true);
    expect(scenarioOf(execution.detail).withChange.endingCash).toBe(3115);
    expect(scenarioOf(execution.detail).verdict.level).toBe("comfortable");
  });

  it("returns a card for every successful tool, not just scenarios", () => {
    expect(executeTool(demoState, "get_semester_snapshot", {}).detail?.kind).toBe("snapshot");
    expect(executeTool(demoState, "get_spending_by_category", {}).detail?.kind).toBe("spending");
    expect(executeTool(demoState, "find_max_affordable", { date: "2026-11-28" }).detail?.kind).toBe("max-affordable");
  });

  it("rejects dates outside the semester so the model can correct itself", () => {
    const execution = executeTool(demoState, "check_purchase", { name: "Trip", amount: 500, date: "2027-03-01" });

    expect(execution.ok).toBe(false);
    expect(execution.output).toEqual({ error: expect.stringContaining("between 2026-09-29 and 2026-12-16") });
  });

  it("rejects missing amounts and unknown names", () => {
    expect(executeTool(demoState, "check_purchase", { name: "Trip", date: "2026-11-12" }).ok).toBe(false);
    expect(executeTool(demoState, "simulate_income_loss", { income_name: "Lottery", stop_date: "2026-10-01" }).ok).toBe(false);
    expect(executeTool(demoState, "drop_tables", {}).ok).toBe(false);
  });
});

describe("offline copilot routing", () => {
  it.each([
    ["Can I afford a $500 trip in November?", "check_purchase"],
    ["How much can I safely spend each week?", "get_semester_snapshot"],
    ["Where am I spending the most money?", "get_spending_by_category"],
    ["What happens if I stop working in October?", "simulate_income_loss"],
    ["What if rent goes up $100?", "simulate_recurring_expense_change"],
    ["What happens if I invest $300?", "simulate_investment"],
    ["How much can I spend on a laptop in November?", "find_max_affordable"],
    ["How much can I spend without putting my budget tight", "find_max_affordable"]
  ])("routes %j to %s", (question, tool) => {
    const intent = detectIntent(question, demoState);

    expect(intent).toMatchObject({ kind: "tool", name: tool });
  });

  it.each(["What is an ETF?", "What is APR?", "What is Investing Basics?", "What is Interest and APR?"])(
    "treats %j as a concept question",
    (question) => {
      expect(detectIntent(question, demoState).kind).toBe("education");
    }
  );

  it("asks a follow-up instead of guessing a missing amount", () => {
    const answer = mockCopilot("Can I afford a new laptop?", demoState);

    expect(answer.toolCalls).toHaveLength(0);
    expect(answer.message).toMatch(/how much/i);
  });

  it("leads with the verdict label", () => {
    const answer = mockCopilot("Can I afford a $3,000 trip in December?", demoState);

    expect(answer.message.startsWith("Not recommended.")).toBe(true);
    expect(scenarioOf(answer.details[0]).verdict.level).toBe("not-recommended");
  });

  it("parses amounts with commas and ignores day numbers", () => {
    expect(extractAmount("Can I afford $1,500?")).toBe(1500);
    expect(extractAmount("a 2,000 dollar laptop")).toBe(2000);
    expect(extractAmount("What is APR?")).toBeUndefined();
  });

  it("maps months into the semester window and ignores look-alike words", () => {
    expect(extractDate("trip in November", demoState)).toBe("2026-11-15");
    expect(extractDate("I need to decide soon", demoState)).toBe(demoState.semester.currentDate);
    expect(extractDate("in August", demoState)).toBe(demoState.semester.currentDate);
    expect(extractDate("next week", demoState)).toBe("2026-10-06");
  });
});

describe("OpenAI tool-calling loop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("executes the tool the model picks and returns the model's explanation", async () => {
    const replies = [
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "check_purchase", arguments: JSON.stringify({ name: "Trip", amount: 500, date: "2026-11-12" }) }
                }
              ]
            }
          }
        ]
      },
      { choices: [{ message: { content: "Comfortable. You'd still finish with $3,115." } }] }
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(replies.shift())));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await runOpenAICopilot("test-key", "Can I afford a $500 trip in November?", demoState, []);

    expect(answer.mode).toBe("openai");
    expect(answer.toolCalls).toEqual([{ name: "check_purchase", input: { name: "Trip", amount: 500, date: "2026-11-12" }, ok: true }]);
    expect(scenarioOf(answer.details[0]).verdict.level).toBe("comfortable");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRequest = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    const toolMessage = secondRequest.messages.find((message: { role: string }) => message.role === "tool");
    expect(JSON.parse(toolMessage.content).withChange.endingCash).toBe(3115);
  });
});
