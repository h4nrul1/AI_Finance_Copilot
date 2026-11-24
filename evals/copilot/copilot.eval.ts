/**
 * Live copilot eval. Run with `npm run eval` (real model, needs OPENAI_API_KEY) or `npm run eval:offline`
 * (the keyword fallback, as a baseline). See evals/README.md.
 *
 * Each case is its own test, so failures show up by name. A JSON report with every answer, check, token count and
 * latency is written to evals/results/.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoState } from "@/lib/data/seed";
import { mockCopilot, runOpenAICopilot, type CopilotAnswer } from "@/lib/ai/copilot";
import { cases } from "./cases";
import { gradeAnswer, type CheckResult, type EvalCase } from "./graders";

const target = process.env.EVAL_TARGET === "offline" ? "offline" : "openai";
const apiKey = process.env.OPENAI_API_KEY ?? "";
const repeat = Math.max(1, Number(process.env.EVAL_REPEAT) || 1);
const only = process.env.EVAL_FILTER?.trim();
if (process.env.EVAL_MODEL) process.env.OPENAI_MODEL = process.env.EVAL_MODEL;
const model = target === "offline" ? "offline" : (process.env.OPENAI_MODEL ?? "gpt-4o-mini");

if (target === "openai" && !apiKey) {
  throw new Error("The live eval needs OPENAI_API_KEY (in .env.local or the environment). Run `npm run eval:offline` to score the offline copilot.");
}

interface Usage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

interface RunRecord {
  id: string;
  run: number;
  tags: string[];
  why: string;
  question: string;
  pass: boolean;
  checks: CheckResult[];
  answer?: CopilotAnswer;
  error?: string;
  latencyMs: number;
  usage: Usage;
}

const records: RunRecord[] = [];
const usageStore = new AsyncLocalStorage<Usage>();
const originalFetch = globalThis.fetch;

// Count model calls and tokens per case. Cases run concurrently, so each one gets its own usage counter.
beforeAll(() => {
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const usage = usageStore.getStore();
    if (usage && String(input).includes("api.openai.com")) {
      const body = (await response.clone().json().catch(() => null)) as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
      usage.calls += 1;
      usage.promptTokens += body?.usage?.prompt_tokens ?? 0;
      usage.completionTokens += body?.usage?.completion_tokens ?? 0;
    }
    return response;
  };
});

async function ask(testCase: EvalCase): Promise<CopilotAnswer> {
  const state = testCase.state ?? demoState;
  if (target === "offline") return mockCopilot(testCase.question, state);
  // Calls the model path directly: askFinancialCopilot would hide model failures behind the offline fallback.
  return runOpenAICopilot(apiKey, testCase.question, state, testCase.history ?? []);
}

const selected = cases.filter((testCase) => !only || testCase.id.includes(only) || testCase.tags.includes(only));

describe(`copilot eval (${model})`, () => {
  for (const testCase of selected) {
    for (let run = 1; run <= repeat; run += 1) {
      it.concurrent(repeat > 1 ? `${testCase.id} #${run}` : testCase.id, async () => {
        const usage: Usage = { calls: 0, promptTokens: 0, completionTokens: 0 };
        const started = Date.now();
        const record: RunRecord = { id: testCase.id, run, tags: testCase.tags, why: testCase.why, question: testCase.question, pass: false, checks: [], latencyMs: 0, usage };
        records.push(record);

        try {
          record.answer = await usageStore.run(usage, () => ask(testCase));
          const grade = gradeAnswer(testCase, testCase.state ?? demoState, record.answer);
          record.pass = grade.pass;
          record.checks = grade.checks;
        } catch (error) {
          record.error = error instanceof Error ? error.message : String(error);
        } finally {
          record.latencyMs = Date.now() - started;
        }

        const failures = record.checks.filter((check) => !check.pass).map((check) => `${check.check}: ${check.detail}`);
        expect(record.error, "the copilot threw").toBeUndefined();
        expect(failures, `${testCase.why}\nAnswer: ${record.answer?.message}`).toEqual([]);
      });
    }
  }
});

function rate(subset: RunRecord[]) {
  const passed = subset.filter((record) => record.pass).length;
  return `${passed}/${subset.length} (${Math.round((passed / Math.max(1, subset.length)) * 100)}%)`;
}

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (!records.length) return;

  const byTag = Object.fromEntries(
    [...new Set(records.flatMap((record) => record.tags))].sort().map((tag) => [tag, rate(records.filter((record) => record.tags.includes(tag)))])
  );
  const byCheck = Object.fromEntries(
    (["routing", "args", "clarify", "verdict", "grounding", "content"] as const).flatMap((name) => {
      const checks = records.flatMap((record) => record.checks.filter((check) => check.check === name));
      return checks.length ? [[name, `${checks.filter((check) => check.pass).length}/${checks.length}`]] : [];
    })
  );
  const latencies = records.map((record) => record.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))];
  const totals = records.reduce(
    (sum, record) => ({
      calls: sum.calls + record.usage.calls,
      promptTokens: sum.promptTokens + record.usage.promptTokens,
      completionTokens: sum.completionTokens + record.usage.completionTokens
    }),
    { calls: 0, promptTokens: 0, completionTokens: 0 }
  );

  const summary = {
    model,
    target,
    repeat,
    finishedAt: new Date().toISOString(),
    overall: rate(records),
    byTag,
    byCheck,
    latencyMs: { p50: percentile(50), p95: percentile(95) },
    modelCalls: totals.calls,
    tokens: { prompt: totals.promptTokens, completion: totals.completionTokens },
    failures: records.filter((record) => !record.pass).map((record) => `${record.id}#${record.run}`)
  };

  console.log(`\nCopilot eval: ${summary.overall} passed on ${model}`);
  console.table(byTag);
  console.table(byCheck);
  console.log(`latency p50 ${summary.latencyMs.p50}ms, p95 ${summary.latencyMs.p95}ms; ${totals.calls} model calls, ${totals.promptTokens}+${totals.completionTokens} tokens`);

  const dir = new URL("../results/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const file = new URL(`${summary.finishedAt.replace(/[:.]/g, "-")}-${model.replace(/[^\w.-]/g, "_")}.json`, dir);
  const ordered = [...records].sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run);
  writeFileSync(file, JSON.stringify({ summary, records: ordered }, null, 2));
  console.log(`Report: ${fileURLToPath(file)}`);
});
