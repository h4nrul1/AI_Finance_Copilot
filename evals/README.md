# Copilot evals

Scores the copilot on fixed questions so prompt, tool, and model changes can be compared with numbers instead of
spot checks.

```bash
npm run eval            # the real model (needs OPENAI_API_KEY in .env.local)
npm run eval:offline    # the keyword fallback, as a baseline (free, no key)
```

Options (environment variables):

| Variable | Effect |
| --- | --- |
| `EVAL_MODEL` | Model to test, e.g. `EVAL_MODEL=gpt-4.1-mini npm run eval`. Defaults to `OPENAI_MODEL`, then `gpt-4o-mini`. |
| `EVAL_REPEAT` | Runs per case. Use 3-5 to see which cases are flaky. |
| `EVAL_FILTER` | Only cases whose id contains this, or that have this tag (`verdict`, `multi-turn`, `safety`, ...). |
| `EVAL_CONCURRENCY` | Cases in flight at once (default 4). |

Each case is its own test, so failures are listed by name with the answer and the failed check. A full JSON report
(every answer, tool call, check, latency, and token count) is written to `evals/results/` (git-ignored).

The eval is not part of CI: it makes paid model calls and the model's answers vary from run to run. Instead, the
**Copilot eval** workflow (`.github/workflows/copilot-eval.yml`) runs it nightly, on demand from the Actions tab,
and on pull requests labeled `run-evals`, and uploads the report as an artifact. It needs the `OPENAI_API_KEY`
repository secret; the optional `OPENAI_MODEL` repository variable picks the model.

## What is checked

| Check | Passes when |
| --- | --- |
| routing | The expected tools were called and no others (or no tools, for concept and clarifying cases). |
| args | The expected tool got matching arguments: exact amounts, real plan names, dates inside the right window. |
| clarify | The copilot asked a follow-up question instead of guessing. |
| verdict | For a scenario, the first sentence states the engine's verdict label and no other label. |
| grounding | Every dollar amount and percentage in the answer appears in a tool result or the conversation. Catches numbers the model computed or invented. |
| content | Required patterns appear (e.g. "annual percentage rate") and forbidden ones don't (e.g. ticker symbols). |

Verdict labels are read from the engine, never hard-coded, so cases stay valid when verdict rules change.

## Adding a case

Add it to [`copilot/cases.ts`](copilot/cases.ts) and run `npm test`: `tests/eval-graders.test.ts` checks that
every expected tool call is valid for the case's plan. Good sources of new cases are answers students rated
poorly and bugs you fix (add the question that exposed it).
