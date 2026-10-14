# AI Financial Copilot for College Students

An AI-powered financial planning app for college students. It focuses on a semester planning window instead of a generic monthly budget.

**Live demo: [ai-finance-copilot-xi.vercel.app](https://ai-finance-copilot-xi.vercel.app/)**

No sign-up needed. The demo starts with a sample student plan, and any changes you make are saved only in your own browser (use **Reset Demo Data** in the sidebar to start over). The live site updates automatically whenever `main` changes.

## What It Does

The app helps users answer:

> Given everything happening between now and the end of the semester, what can I actually afford?

It ships with realistic seeded data, cash-flow projections, safe weekly spending, spending tracking, scenario testing, a financial-aid explanation demo, beginner lessons, and a copilot chat.

## Demo Features

- Overview dashboard with current cash, projected semester-end cash, safe weekly spending, semester health, and every planned payment until finals.
- Semester cash-flow chart using deterministic projections.
- Semester Plan with per-item and section totals, the safe-spending formula, an editable semester goal, and verdict strictness presets.
- Scenario Lab: a guided builder for purchases, surprise bills, investing, income loss, and bill changes, with a live example and "Add to my plan".
- "Can I Afford This?" purchase checker.
- Copilot chat with visible tool usage and a calculation card for every answer, including spending limits ("how much can I spend on X").
- Spending page: log purchases, suggested categories you can override, editable categories, and clear totals.
- Financial Aid page with sample offer parsing.
- Learn page for beginner finance topics.

## Architecture

```text
User
↓
AI Interface
↓
Financial Tool Layer
↓
Deterministic Calculation Engine
↓
Student Financial Model
```

The language model interprets and explains. The financial engine calculates.

Core calculation code lives in `lib/finance/engine.ts` and `lib/finance/tools.ts`. The copilot service in `lib/ai/copilot.ts` invokes those tools and never asks the model to calculate financial numbers.

How a copilot question is answered:

1. `lib/ai/tool-registry.ts` describes the finance tools to the model as function definitions (built from the student's own plan, so income and expense names are real enums).
2. The model picks a tool and fills in arguments. The registry validates them (positive amounts, dates inside the semester, known names) and returns errors to the model so it can retry or ask a follow-up question.
3. The deterministic engine runs the scenario. `lib/finance/verdict.ts` grades it as **Comfortable**, **Fits, but tight**, or **Not recommended** and says which rule decided it. Overdrafts and ending below the goal are always "Not recommended"; the line between "tight" and "comfortable" comes from the student's strictness setting (`lib/finance/verdict-settings.ts`: Cautious, Balanced, Flexible, or custom).
4. The model explains the result. The UI shows the engine's verdict card and a "Show calculation" table, so the numbers on screen never come from the model.

Without an API key, a keyword-based fallback calls the same tools, so the demo behaves the same offline.

## Tech Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Recharts
- Vitest
- Optional OpenAI API integration
- Local browser storage for demo persistence

## Getting Started 

### 1. Prerequisites

- **Node.js 20.9 or newer** (check with `node -v`; install from [nodejs.org](https://nodejs.org) if needed)
- **Git**, and access to this GitHub repo (ask the owner to add you as a collaborator)
- *Optional:* an **OpenAI API key** for the real AI copilot. Without one, the app still works using the offline copilot.

### 2. Clone and install

```bash
git clone https://github.com/h4nrul1/AI_Finance_Copilot.git
cd AI_Finance_Copilot
npm install
```

### 3. Add your own API key (optional)

Create a file named `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-your-own-key
# Optional; this is the default:
OPENAI_MODEL=gpt-4o-mini
```

- Use **your own** key from [platform.openai.com](https://platform.openai.com) → API keys. Never share keys in chat or commit them; `.env.local` is already in `.gitignore`.
- The API is prepaid: add credits under **Settings → Billing** (adding a card alone is not enough). $5 lasts a long time with `gpt-4o-mini`. Set a monthly budget and turn off auto-recharge.
- Don't switch `OPENAI_MODEL` to a GPT-5-family model yet: the request sends a custom `temperature`, which those models may reject.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). After editing `.env.local`, stop the server (`Ctrl+C`) and start it again.

**Check the copilot:** on `/copilot`, ask "Can I afford a $500 trip in November?" Replies labeled **Copilot · OpenAI** mean your key works. **Copilot · Mock** means the app fell back to offline mode; the terminal running `npm run dev` shows the reason in a `[copilot] OpenAI path failed…` line (usually a missing key or no credits).

### 5. Before every push

```bash
npm test        # 51 tests: engine, verdicts, copilot routing, rate limiter
npm run lint    # TypeScript type check
npm run build   # optional: the same production build Vercel runs
```

If you change calculations (`lib/finance/*`) or verdict rules, add or update a test in `tests/`.

## How We Work

- **Never commit to `main` directly.** Create a branch, push it, and open a pull request:

  ```bash
  git checkout main && git pull
  git checkout -b your-feature-name
  # ...make changes, run the checks above...
  git add .
  git commit -m "Describe the change"
  git push -u origin your-feature-name
  ```

- If the repo is connected to Vercel, each pushed branch gets its own preview link. Try each other's work there before merging.
- Merging into `main` deploys the live site.
- Divide work by area to avoid merge conflicts:

| Area | Where it lives |
|---|---|
| Calculation engine and verdicts | `lib/finance/` (with tests in `tests/`) |
| AI copilot (tools, prompt, OpenAI loop) | `lib/ai/`, `app/api/copilot/route.ts`, `components/copilot/` |
| Pages | `app/<page>/page.tsx` |
| Shared UI and state | `components/` (state lives in `components/providers/finance-provider.tsx`) |
| Data types and demo data | `types/finance.ts`, `lib/data/seed.ts` |

- This project uses **Next.js 16**, which differs from older versions. If you use an AI coding assistant, it should read `AGENTS.md` first (Claude Code does this automatically via `CLAUDE.md`), and check the docs in `node_modules/next/dist/docs/`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Copilot always says **Mock** | Check `.env.local` exists in the project root, restart `npm run dev`, then read the `[copilot]` line in the terminal. |
| "You're asking questions quickly" | The copilot is rate-limited to 10 questions/minute and 100/day per visitor. Wait, or restart the dev server to clear the counts locally. |
| Odd or outdated numbers in the app | Your plan is saved in the browser. Click **Reset Demo Data** in the sidebar. |
| Build or type errors mentioning `.next/` after renaming or deleting a page | Stop the dev server, delete the generated cache with `rm -rf .next`, and run again. |
| Port 3000 already in use | Stop the other `npm run dev`, or run `npm run dev -- -p 3001`. |

## Demo Walkthrough

1. Open Overview.
2. Show current cash, projected ending cash, safe weekly spending, and the semester cash-flow chart.
3. Expand "How safe weekly spending is calculated."
4. Use "Can I Afford This?" for a $500 Chicago trip in November.
5. Open Scenario Lab, open the example, then build an "Income stops" scenario for the campus job and add it to the plan.
6. Open Copilot and ask: "Can I afford a new laptop?", then "How much can I spend without it getting tight?"
7. Ask: "What happens if I stop working in October?"
8. Ask: "What is an ETF?"
9. On Spending, log a purchase and change a category.
10. On Semester Plan, switch verdict strictness to Cautious and change the goal; watch the weekly budget and verdicts update.
11. Load the sample Financial Aid offer and explain free aid vs loans vs work-study.

## Disclaimer

Educational financial planning tool. Not professional financial, investment, tax, or legal advice.
