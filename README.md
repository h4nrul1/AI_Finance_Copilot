# AI Financial Copilot for College Students

An AI-powered financial planning app for college students. It focuses on a semester planning window instead of a generic monthly budget.

## What It Does

The app helps users answer:

> Given everything happening between now and the end of the semester, what can I actually afford?

It ships with realistic seeded data, cash-flow projections, safe weekly spending, transactions, scenario testing, a financial-aid explanation demo, beginner lessons, and a copilot chat.

## Demo Features

- Overview dashboard with current cash, projected semester-end cash, safe weekly spending, upcoming expenses, and semester health.
- Semester cash-flow chart using deterministic projections.
- Scenario Lab with baseline-vs-scenario chart comparison.
- "Can I Afford This?" purchase checker.
- Copilot chat with seeded prompt chips and visible tool usage.
- Transactions page with deterministic category rules.
- Editable semester plan assumptions stored locally.
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
3. The deterministic engine runs the scenario. `lib/finance/verdict.ts` grades it as **Comfortable**, **Fits, but tight**, or **Not recommended** using fixed rules (overdraft, ending below the buffer, weekly spending cut of 25%+).
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

The tests cover projected ending balance, recurring income, recurring expenses, safe weekly spending, purchase scenarios, income-loss scenarios, rent-increase scenarios, and scenario comparison.

## Demo Walkthrough

1. Open Overview.
2. Show current cash, projected ending cash, safe weekly spending, and the semester cash-flow chart.
3. Expand "How safe weekly spending is calculated."
4. Use "Can I Afford This?" for a $500 Chicago trip in November.
5. Open Scenario Lab and compare baseline vs trip scenario.
6. Run "Stop Working" to show income loss after October 1.
7. Open Copilot and ask: "Can I afford a $500 trip in November?"
8. Ask: "What happens if I stop working in October?"
9. Ask: "What is an ETF?"
10. Show categorized transactions.
11. Edit a cash value on Semester Plan and return to Overview to see calculations update.
12. Load the sample Financial Aid offer and explain free aid vs loans vs work-study.

## Disclaimer

Educational financial planning tool. Not professional financial, investment, tax, or legal advice.
