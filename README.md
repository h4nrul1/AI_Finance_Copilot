# AI Financial Copilot for College Students

An AI-powered financial planning app for college students. It focuses on a semester planning window instead of a generic monthly budget.

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

## Running Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## AI Setup

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

If `OPENAI_API_KEY` is missing or the API request fails, the app automatically uses the deterministic mock copilot. The demo remains fully usable without external services.

## Tests and Build

```bash
npm test
npm run build
```

The tests cover the projection engine, scenario tools, verdict rules and strictness settings, spending limits, copilot tool routing and the OpenAI tool-calling loop, and the API rate limiter.

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
