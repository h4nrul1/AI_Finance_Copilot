"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ListChecks, Play, PlusCircle } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { addDays, asDate, toISODate } from "@/lib/finance/dates";
import { compareScenarioToBaseline, summarizeScenarioResult } from "@/lib/finance/tools";
import type { FinanceState, Scenario, ScenarioResult, ScenarioType } from "@/types/finance";
import { formatCurrency, formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<ScenarioType, string> = {
  purchase: "One-time purchase",
  "unexpected-expense": "Unexpected expense",
  investment: "Move money to investing",
  "income-loss": "Income stops",
  "expense-change": "Recurring bill changes"
};

const VERDICT_TONES = { comfortable: "good", tight: "warn", "not-recommended": "bad" } as const;

interface Draft {
  type: ScenarioType;
  name: string;
  amount: string;
  date: string;
  incomeName: string;
  expenseName: string;
}

function midSemester(state: FinanceState) {
  const { currentDate, endDate } = state.semester;
  const days = Math.round((asDate(endDate).getTime() - asDate(currentDate).getTime()) / 86_400_000);
  return toISODate(addDays(asDate(currentDate), Math.round(days / 2)));
}

function toScenario(draft: Draft): Scenario | null {
  const amount = Number(draft.amount);
  const base = { id: `lab-${Date.now()}`, description: "Scenario Lab", type: draft.type, date: draft.date };

  switch (draft.type) {
    case "income-loss":
      return draft.incomeName ? { ...base, name: `${draft.incomeName} stops`, incomeName: draft.incomeName, stopDate: draft.date } : null;
    case "expense-change":
      return draft.expenseName && Number.isFinite(amount) && amount !== 0
        ? { ...base, name: `${draft.expenseName} ${amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(amount))}`, expenseName: draft.expenseName, amount }
        : null;
    case "investment":
      return amount > 0 ? { ...base, name: "Move money to investing", amount } : null;
    default:
      return amount > 0 ? { ...base, name: draft.name.trim() || TYPE_LABELS[draft.type], amount } : null;
  }
}

/** Plain-language description of what "Add to my plan" will change. */
function applyDescription(scenario: Scenario) {
  switch (scenario.type) {
    case "income-loss":
      return `Ends "${scenario.incomeName}" after ${formatDate(scenario.stopDate ?? "")}.`;
    case "expense-change":
      return `Changes "${scenario.expenseName}" by ${formatCurrency(scenario.amount ?? 0)} per payment from ${formatDate(scenario.date ?? "")}.`;
    default:
      return `Adds "${scenario.name}" as a ${formatCurrency(scenario.amount ?? 0)} flexible expense on ${formatDate(scenario.date ?? "")}.`;
  }
}

export default function ScenariosPage() {
  const { state, projection, applyScenarioToPlan } = useFinance();
  const recurringIncomes = state.incomes.filter((income) => income.recurring && income.guaranteed);
  const recurringExpenses = state.expenses.filter((expense) => expense.recurring);
  const exampleDate = midSemester(state);

  const [draft, setDraft] = useState<Draft>({
    type: "purchase",
    name: "Weekend trip",
    amount: "500",
    date: exampleDate,
    incomeName: recurringIncomes[0]?.name ?? "",
    expenseName: recurringExpenses[0]?.name ?? ""
  });
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const example = useMemo(
    () =>
      compareScenarioToBaseline(state, {
        id: "example",
        name: "Weekend trip",
        description: "Example",
        type: "purchase",
        amount: 500,
        date: exampleDate
      }),
    [state, exampleDate]
  );

  const scenario = toScenario(draft);
  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setApplied(null);
  };

  function run() {
    if (!scenario) return;
    setResult(compareScenarioToBaseline(state, scenario));
    setApplied(null);
  }

  function apply() {
    if (!result) return;
    applyScenarioToPlan(result.scenario);
    setApplied(applyDescription(result.scenario));
    setResult(null);
  }

  const amountLabel = draft.type === "expense-change" ? "Change per payment (+/−)" : "Amount";
  const dateLabel = draft.type === "income-loss" ? "Last paycheck" : draft.type === "expense-change" ? "Starting" : "Date";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Scenario Lab</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Try decisions before they hit your semester.</h1>
      </header>

      <Card>
        <CardHeader title="How Scenario Lab works" eyebrow="Three steps" />
        <ol className="grid gap-3 md:grid-cols-3">
          <Step number={1} title="Describe a change">
            A purchase, a surprise bill, money moved to investing, a job ending, or a bill going up or down.
          </Step>
          <Step number={2} title="We re-run your semester">
            Your plan is copied and replayed week by week with the change, using the same engine as Overview. Your real plan isn&apos;t touched.
          </Step>
          <Step number={3} title="Get a verdict, then decide">
            Comfortable, Fits but tight, or Not recommended, based on your goal and your verdict thresholds. Add it to your plan only if you go
            ahead.
          </Step>
        </ol>

        <div className="mt-5 rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Example from your current plan</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-6 text-ink">
            <span>
              A {formatCurrency(500)} weekend trip on {formatDate(exampleDate)} moves semester-end cash from{" "}
              <strong>{formatCurrency(example.baseline.projectedEndingBalance)}</strong> to{" "}
              <strong>{formatCurrency(example.scenarioProjection.projectedEndingBalance)}</strong> and safe weekly spending from{" "}
              <strong>{formatCurrency(example.baseline.safeWeekly.safeWeeklySpending)}</strong> to{" "}
              <strong>{formatCurrency(example.scenarioProjection.safeWeekly.safeWeeklySpending)}/wk</strong>.
            </span>
            <Badge tone={VERDICT_TONES[example.verdict.level]}>{example.verdict.label}</Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraft((current) => ({ ...current, type: "purchase", name: "Weekend trip", amount: "500", date: exampleDate }));
                setResult(example);
                setApplied(null);
              }}
            >
              <Play size={14} />
              Open this example
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Build a scenario" eyebrow="Step 1" />
        <div className="grid gap-3 md:grid-cols-[200px_1fr_160px_170px_auto] md:items-end">
          <div>
            <Label htmlFor="scenario-type">Type</Label>
            <Select id="scenario-type" value={draft.type} onChange={(event) => update({ type: event.target.value as ScenarioType })}>
              {(Object.keys(TYPE_LABELS) as ScenarioType[]).map((type) => (
                <option
                  key={type}
                  value={type}
                  disabled={(type === "income-loss" && !recurringIncomes.length) || (type === "expense-change" && !recurringExpenses.length)}
                >
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          {draft.type === "income-loss" ? (
            <div>
              <Label htmlFor="scenario-income">Which income</Label>
              <Select id="scenario-income" value={draft.incomeName} onChange={(event) => update({ incomeName: event.target.value })}>
                {recurringIncomes.map((income) => (
                  <option key={income.id}>{income.name}</option>
                ))}
              </Select>
            </div>
          ) : draft.type === "expense-change" ? (
            <div>
              <Label htmlFor="scenario-expense">Which bill</Label>
              <Select id="scenario-expense" value={draft.expenseName} onChange={(event) => update({ expenseName: event.target.value })}>
                {recurringExpenses.map((expense) => (
                  <option key={expense.id}>{expense.name}</option>
                ))}
              </Select>
            </div>
          ) : draft.type === "investment" ? (
            <div className="hidden md:block" />
          ) : (
            <div>
              <Label htmlFor="scenario-name">What is it</Label>
              <Input id="scenario-name" value={draft.name} onChange={(event) => update({ name: event.target.value })} />
            </div>
          )}

          {draft.type === "income-loss" ? (
            <div className="hidden md:block" />
          ) : (
            <div>
              <Label htmlFor="scenario-amount">{amountLabel}</Label>
              <Input id="scenario-amount" type="number" value={draft.amount} onChange={(event) => update({ amount: event.target.value })} />
            </div>
          )}

          <div>
            <Label htmlFor="scenario-date">{dateLabel}</Label>
            <Input
              id="scenario-date"
              type="date"
              min={state.semester.currentDate}
              max={state.semester.endDate}
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </div>

          <Button onClick={run} disabled={!scenario}>
            <PlusCircle size={16} />
            Run
          </Button>
        </div>
      </Card>

      {applied ? (
        <div className="flex items-start gap-3 rounded-lg border border-sage/50 bg-sage/10 p-4 text-sm text-ink">
          <CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={18} />
          <p>
            Added to your plan: {applied} Overview and Semester Plan now include it. You can edit or delete it on the Semester Plan page.
          </p>
        </div>
      ) : null}

      {result ? (
        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader title="Your plan vs. with this change" eyebrow={`Step 2 · ${result.scenario.name}`} />
            <CashFlowChart baseline={projection} scenario={result.scenarioProjection} />
          </Card>

          <Card>
            <CardHeader title="Verdict" eyebrow="Step 3" />
            <VerdictCard verdict={result.verdict} summary={summarizeScenarioResult(state, result)} />
            <div className="mt-4 rounded-lg border border-line bg-paper p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <ListChecks size={16} />
                Going ahead?
              </p>
              <p className="mt-1 text-muted">{applyDescription(result.scenario)}</p>
              <Button className="mt-3 w-full" variant="secondary" onClick={apply}>
                Add to my plan
              </Button>
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg bg-paper p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moss text-sm font-semibold text-white">{number}</span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{children}</p>
      </div>
    </li>
  );
}
