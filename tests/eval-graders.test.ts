import { describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import type { CopilotAnswer } from "@/lib/ai/copilot";
import { buildToolDefinitions, executeTool } from "@/lib/ai/tool-registry";
import type { ScenarioSummary } from "@/types/finance";
import { cases } from "@/evals/copilot/cases";
import {
  dateIn,
  eq,
  extractClaims,
  gradeAnswer,
  gradeGrounding,
  gradeRouting,
  gradeVerdict,
  matchArg,
  sampleArg,
  type EvalCase
} from "@/evals/copilot/graders";

const TRIP = { name: "Trip", amount: 500, date: "2026-11-12" };

function answer(message: string, toolCalls: CopilotAnswer["toolCalls"] = []): CopilotAnswer {
  return { message, mode: "openai", toolCalls, details: [] };
}

function tripVerdict() {
  return (executeTool(demoState, "check_purchase", TRIP).output as ScenarioSummary).verdict;
}

describe("eval graders", () => {
  it("matches arguments by exact value, date window, and case-insensitive names", () => {
    expect(matchArg(500, eq(500))).toBe(true);
    expect(matchArg("500", eq(500))).toBe(true);
    expect(matchArg("rent", eq("Rent"))).toBe(true);
    expect(matchArg("2026-11-12", dateIn("2026-11-01", "2026-11-30"))).toBe(true);
    expect(matchArg("2026-12-01", dateIn("2026-11-01", "2026-11-30"))).toBe(false);
  });

  it("fails routing on missing or unexpected tools, and checks arguments", () => {
    const expectation = { tools: [{ name: "check_purchase", args: { amount: eq(500) } }] };

    expect(gradeRouting(answer("ok", [{ name: "check_purchase", input: TRIP, ok: true }]), expectation).every((check) => check.pass)).toBe(true);
    expect(gradeRouting(answer("ok", [{ name: "get_semester_snapshot", input: {}, ok: true }]), expectation)[0].pass).toBe(false);
    const wrongAmount = gradeRouting(answer("ok", [{ name: "check_purchase", input: { ...TRIP, amount: 50 }, ok: true }]), expectation);
    expect(wrongAmount.find((check) => check.check === "args")?.pass).toBe(false);
  });

  it("requires a question and no tools for clarifying cases", () => {
    expect(gradeRouting(answer("How much would it cost?"), { clarify: true }).every((check) => check.pass)).toBe(true);
    expect(gradeRouting(answer("Sure, sounds fine."), { clarify: true }).every((check) => check.pass)).toBe(false);
  });

  it("requires the engine's verdict label in the first sentence", () => {
    const { label } = tripVerdict();
    const call = [{ name: "check_purchase", input: TRIP, ok: true }];

    expect(gradeVerdict(demoState, answer(`${label}. The trip fits.`, call))?.pass).toBe(true);
    expect(gradeVerdict(demoState, answer(`Good news! ${label}.`, call))?.pass).toBe(false);
    expect(gradeVerdict(demoState, answer("Not recommended. Skip it.", call))?.pass).toBe(label === "Not recommended");
    expect(gradeVerdict(demoState, answer("ETFs are funds."))).toBeNull();
  });

  it("finds dollar and percent claims, including k shorthand", () => {
    expect(extractClaims("You'd end with $3,115 (a 12% cut), about $1.5k less.").map((claim) => [claim.kind, claim.value])).toEqual([
      ["dollars", 3115],
      ["dollars", 1500],
      ["percent", 12]
    ]);
  });

  it("accepts numbers from tool results and the question, rejects invented ones", () => {
    const call = [{ name: "check_purchase", input: TRIP, ok: true }];
    const ending = (executeTool(demoState, "check_purchase", TRIP).output as ScenarioSummary).withChange.endingCash;

    expect(gradeGrounding(demoState, answer(`The $500 trip leaves you $${ending.toLocaleString("en-US")}.`, call), "Can I afford a $500 trip?").pass).toBe(true);
    const invented = gradeGrounding(demoState, answer("You'd still have about $4,321.", call), "Can I afford a $500 trip?");
    expect(invented.pass).toBe(false);
    expect(invented.detail).toContain("$4,321");
  });

  it("combines every check into one result", () => {
    const testCase: EvalCase = {
      id: "t",
      why: "t",
      tags: [],
      question: "Can I afford a $500 trip in November?",
      expect: { tools: [{ name: "check_purchase", args: { amount: eq(500) } }], mustNotMatch: [/VOO/] }
    };
    const grade = gradeAnswer(testCase, demoState, answer(`${tripVerdict().label}. Buy VOO.`, [{ name: "check_purchase", input: TRIP, ok: true }]));

    expect(grade.pass).toBe(false);
    expect(grade.checks.find((check) => check.check === "content")?.pass).toBe(false);
  });
});

describe("eval dataset", () => {
  it("has unique ids and well-formed histories", () => {
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
    for (const testCase of cases) {
      testCase.history?.forEach((turn, index) => expect(turn.role, testCase.id).toBe(index % 2 === 0 ? "user" : "assistant"));
      if (testCase.history?.length) expect(testCase.history.at(-1)?.role, testCase.id).toBe("assistant");
    }
  });

  it.each(cases.filter((testCase) => testCase.expect.tools?.length).map((testCase) => [testCase.id, testCase] as const))(
    "%s expects tool calls that are valid for its plan",
    (_id, testCase) => {
      const state = testCase.state ?? demoState;
      const available = buildToolDefinitions(state).map((tool) => tool.function.name);
      for (const tool of testCase.expect.tools ?? []) {
        expect(available).toContain(tool.name);
        const args = Object.fromEntries(Object.entries(tool.args ?? {}).map(([key, matcher]) => [key, sampleArg(matcher)]));
        // Fill required arguments the case leaves free, so the expectation itself is runnable.
        const defaults: Record<string, unknown> = { name: "Purchase", amount: 100, date: state.semester.currentDate, start_date: state.semester.currentDate };
        const execution = executeTool(state, tool.name, { ...defaults, ...args });
        expect(execution.ok, JSON.stringify(execution.output)).toBe(true);
      }
    }
  );
});
