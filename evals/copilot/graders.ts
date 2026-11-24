/**
 * Scoring for copilot answers. Pure functions, so they are unit-tested in tests/eval-graders.test.ts and shared by
 * the live eval (evals/copilot/copilot.eval.ts).
 *
 * Tool outputs are recomputed with executeTool rather than read from the answer: the tools are deterministic, so
 * the recomputed output is exactly what the model saw, and the production answer shape doesn't have to grow.
 */
import type { FinanceState, ScenarioSummary } from "@/types/finance";
import type { ChatTurn, CopilotAnswer } from "@/lib/ai/copilot";
import { executeTool } from "@/lib/ai/tool-registry";

// ---------------------------------------------------------------------------
// Argument matchers
// ---------------------------------------------------------------------------

export type ArgMatcher =
  | { kind: "eq"; value: string | number }
  | { kind: "oneOf"; values: Array<string | number> }
  | { kind: "number"; min: number; max: number }
  | { kind: "date"; from: string; to: string };

export const eq = (value: string | number): ArgMatcher => ({ kind: "eq", value });
export const oneOf = (...values: Array<string | number>): ArgMatcher => ({ kind: "oneOf", values });
export const between = (min: number, max: number): ArgMatcher => ({ kind: "number", min, max });
export const dateIn = (from: string, to: string): ArgMatcher => ({ kind: "date", from, to });

function same(a: unknown, b: string | number) {
  return typeof a === "string" && typeof b === "string" ? a.trim().toLowerCase() === b.toLowerCase() : Number(a) === b;
}

export function matchArg(value: unknown, matcher: ArgMatcher): boolean {
  switch (matcher.kind) {
    case "eq":
      return same(value, matcher.value);
    case "oneOf":
      return matcher.values.some((option) => same(value, option));
    case "number": {
      const number = Number(value);
      return Number.isFinite(number) && number >= matcher.min && number <= matcher.max;
    }
    case "date":
      return typeof value === "string" && value >= matcher.from && value <= matcher.to;
  }
}

/** A concrete value that satisfies the matcher, used to check that every expectation in the dataset is runnable. */
export function sampleArg(matcher: ArgMatcher): string | number {
  switch (matcher.kind) {
    case "eq":
      return matcher.value;
    case "oneOf":
      return matcher.values[0];
    case "number":
      return matcher.min;
    case "date":
      return matcher.from;
  }
}

export function describeMatcher(matcher: ArgMatcher) {
  switch (matcher.kind) {
    case "eq":
      return JSON.stringify(matcher.value);
    case "oneOf":
      return `one of ${JSON.stringify(matcher.values)}`;
    case "number":
      return `${matcher.min}..${matcher.max}`;
    case "date":
      return `${matcher.from}..${matcher.to}`;
  }
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export interface ToolExpectation {
  name: string;
  /** Only the listed arguments are checked; others (like a purchase's label) are free. */
  args?: Record<string, ArgMatcher>;
}

export interface Expectation {
  /** Each must be called successfully with matching arguments. */
  tools?: ToolExpectation[];
  /** Tools that may also be called without failing the case. Any other tool fails the routing check. */
  allowTools?: string[];
  /** The copilot should ask a follow-up question and call no tools. */
  clarify?: boolean;
  /** The copilot should answer without calling any tool (concept questions). */
  noTools?: boolean;
  mustMatch?: RegExp[];
  mustNotMatch?: RegExp[];
}

export interface EvalCase {
  id: string;
  /** What the case is checking, shown in the report. */
  why: string;
  tags: string[];
  question: string;
  history?: ChatTurn[];
  /** Defaults to the demo plan. */
  state?: FinanceState;
  expect: Expectation;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export interface CheckResult {
  check: "routing" | "args" | "clarify" | "verdict" | "grounding" | "content";
  pass: boolean;
  detail: string;
}

export interface GradeResult {
  pass: boolean;
  checks: CheckResult[];
}

const SCENARIO_TOOLS = new Set(["check_purchase", "simulate_investment", "simulate_income_loss", "simulate_recurring_expense_change"]);
const LABELS = ["Comfortable", "Fits, but tight", "Not recommended"] as const;

function recomputeOutputs(state: FinanceState, answer: CopilotAnswer) {
  return answer.toolCalls.filter((call) => call.ok).map((call) => ({ call, output: executeTool(state, call.name, call.input).output }));
}

export function gradeRouting(answer: CopilotAnswer, expect: Expectation): CheckResult[] {
  const called = answer.toolCalls.map((call) => call.name);
  const results: CheckResult[] = [];

  if (expect.clarify || expect.noTools) {
    results.push({
      check: "routing",
      pass: called.length === 0,
      detail: called.length ? `expected no tool calls, got ${called.join(", ")}` : "no tool calls"
    });
    if (expect.clarify) {
      const asks = /\?/.test(answer.message);
      results.push({ check: "clarify", pass: asks, detail: asks ? "asked a follow-up" : "did not ask a question" });
    }
    return results;
  }

  const allowed = new Set([...(expect.tools ?? []).map((tool) => tool.name), ...(expect.allowTools ?? [])]);
  const unexpected = [...new Set(called.filter((name) => !allowed.has(name)))];
  const missing = (expect.tools ?? []).filter((tool) => !called.includes(tool.name)).map((tool) => tool.name);
  results.push({
    check: "routing",
    pass: unexpected.length === 0 && missing.length === 0,
    detail:
      [missing.length && `missing ${missing.join(", ")}`, unexpected.length && `unexpected ${unexpected.join(", ")}`].filter(Boolean).join("; ") ||
      `called ${called.join(", ") || "nothing"}`
  });

  for (const tool of expect.tools ?? []) {
    if (!tool.args || !called.includes(tool.name)) continue;
    const candidates = answer.toolCalls.filter((call) => call.ok && call.name === tool.name);
    const matched = candidates.some((call) => Object.entries(tool.args!).every(([key, matcher]) => matchArg(call.input[key], matcher)));
    const wanted = Object.entries(tool.args)
      .map(([key, matcher]) => `${key}=${describeMatcher(matcher)}`)
      .join(", ");
    results.push({
      check: "args",
      pass: matched,
      detail: matched
        ? `${tool.name}(${wanted})`
        : `${tool.name}: wanted ${wanted}; got ${candidates.map((call) => JSON.stringify(call.input)).join(" | ") || "no successful call"}`
    });
  }

  return results;
}

function firstSentence(message: string) {
  // Split after sentence punctuation followed by whitespace, so "$1,200.50" and "Fits, but tight" stay whole.
  return message.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
}

/** The answer must open with the engine's verdict label and must not pair it with a different one. */
export function gradeVerdict(state: FinanceState, answer: CopilotAnswer): CheckResult | null {
  const scenarios = recomputeOutputs(state, answer)
    .filter(({ call }) => SCENARIO_TOOLS.has(call.name))
    .map(({ output }) => (output as ScenarioSummary).verdict.label);
  if (!scenarios.length) return null;

  const distinct = [...new Set(scenarios)];
  if (distinct.length > 1) {
    const missing = distinct.filter((label) => !answer.message.toLowerCase().includes(label.toLowerCase()));
    return { check: "verdict", pass: missing.length === 0, detail: missing.length ? `never states ${missing.join(", ")}` : `states ${distinct.join(", ")}` };
  }

  const [label] = distinct;
  const opener = firstSentence(answer.message);
  const states = opener.toLowerCase().includes(label.toLowerCase());
  const contradicts = LABELS.filter((other) => other !== label && opener.includes(other));
  return {
    check: "verdict",
    pass: states && contradicts.length === 0,
    detail: !states ? `first sentence lacks "${label}": ${JSON.stringify(opener)}` : contradicts.length ? `first sentence also says ${contradicts.join(", ")}` : `leads with "${label}"`
  };
}

// ---------------------------------------------------------------------------
// Grounding: every dollar amount and percentage in the reply must come from a tool result or the conversation.
// ---------------------------------------------------------------------------

const NUMBER_IN_TEXT = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

function numbersInText(text: string) {
  return (text.match(NUMBER_IN_TEXT) ?? []).map((raw) => Number(raw.replace(/,/g, ""))).filter(Number.isFinite);
}

function collectNumbers(value: unknown, into: number[]) {
  if (typeof value === "number" && Number.isFinite(value)) into.push(value);
  else if (typeof value === "string") into.push(...numbersInText(value));
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNumbers(item, into));
  return into;
}

export interface Claim {
  kind: "dollars" | "percent";
  value: number;
  text: string;
}

export function extractClaims(message: string): Claim[] {
  const claims: Claim[] = [];
  for (const match of message.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(k\b)?/gi)) {
    const value = Number(`${match[1].replace(/,/g, "")}${match[2] ?? ""}`) * (match[3] ? 1000 : 1);
    claims.push({ kind: "dollars", value, text: match[0].trim() });
  }
  for (const match of message.matchAll(/(\d+(?:\.\d+)?)\s?(%|percent\b)/gi)) {
    claims.push({ kind: "percent", value: Number(match[1]), text: match[0] });
  }
  return claims;
}

/** Whole-dollar rounding (and cents) of a grounded number is fine; anything else counts as a number the model made up. */
const DOLLAR_TOLERANCE = 1;

export function gradeGrounding(state: FinanceState, answer: CopilotAnswer, question: string, history: ChatTurn[] = []): CheckResult {
  const grounded = recomputeOutputs(state, answer).flatMap(({ call, output }) => collectNumbers(output, collectNumbers(call.input, [])));
  grounded.push(...numbersInText(question), ...history.flatMap((turn) => numbersInText(turn.content)));
  const known = grounded.map(Math.abs);

  const ungrounded = extractClaims(answer.message).filter((claim) =>
    claim.kind === "dollars"
      ? !known.some((value) => Math.abs(value - claim.value) <= DOLLAR_TOLERANCE)
      : !known.some((value) => Math.abs(value - claim.value) <= 1 || Math.abs(value * 100 - claim.value) <= 1)
  );
  return {
    check: "grounding",
    pass: ungrounded.length === 0,
    detail: ungrounded.length ? `not in any tool result: ${ungrounded.map((claim) => claim.text).join(", ")}` : "every amount traced to a tool result"
  };
}

export function gradeContent(answer: CopilotAnswer, expect: Expectation): CheckResult | null {
  const missing = (expect.mustMatch ?? []).filter((pattern) => !pattern.test(answer.message));
  const forbidden = (expect.mustNotMatch ?? []).filter((pattern) => pattern.test(answer.message));
  if (!expect.mustMatch?.length && !expect.mustNotMatch?.length) return null;
  return {
    check: "content",
    pass: missing.length === 0 && forbidden.length === 0,
    detail:
      [missing.length && `missing ${missing.join(" ")}`, forbidden.length && `contains ${forbidden.join(" ")}`].filter(Boolean).join("; ") || "ok"
  };
}

export function gradeAnswer(testCase: EvalCase, state: FinanceState, answer: CopilotAnswer): GradeResult {
  const checks = [
    ...gradeRouting(answer, testCase.expect),
    gradeVerdict(state, answer),
    gradeGrounding(state, answer, testCase.question, testCase.history),
    gradeContent(answer, testCase.expect)
  ].filter((check): check is CheckResult => check !== null);
  return { pass: checks.every((check) => check.pass), checks };
}
