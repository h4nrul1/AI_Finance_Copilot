import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

/** Config for `npm run eval`: live model calls, so it is kept out of `npm test`. */
export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    env: {
      // OPENAI_API_KEY and OPENAI_MODEL come from .env.local; values already in the environment (CI secrets) win.
      ...openAIEnv(".env.local"),
      ...openAIEnv(process.env),
      // `npm run eval:offline` passes --mode offline to score the keyword fallback instead of the model.
      ...(mode === "offline" ? { EVAL_TARGET: "offline" } : {})
    },
    testTimeout: 120_000,
    maxConcurrency: Number(process.env.EVAL_CONCURRENCY) || 4
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname
    }
  }
}));

function openAIEnv(source: string | NodeJS.ProcessEnv): Record<string, string> {
  const values = typeof source === "string" ? (existsSync(source) ? parseEnv(readFileSync(source, "utf8")) : {}) : source;
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => entry[0].startsWith("OPENAI_") && !!entry[1]));
}
