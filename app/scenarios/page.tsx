"use client";

import { useMemo, useState } from "react";
import { Play, PlusCircle } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { AffordabilityWidget } from "@/components/scenarios/affordability-widget";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { presetScenarios } from "@/lib/data/seed";
import { compareScenarioToBaseline } from "@/lib/finance/tools";
import type { Scenario, ScenarioResult, ScenarioType } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export default function ScenariosPage() {
  const { state, projection } = useFinance();
  const [result, setResult] = useState<ScenarioResult>(() => compareScenarioToBaseline(state, presetScenarios[0]));
  const [customType, setCustomType] = useState<ScenarioType>("purchase");
  const [customAmount, setCustomAmount] = useState(250);
  const [customDate, setCustomDate] = useState("2026-10-20");

  const rows = useMemo(
    () => [
      ["Baseline end cash", formatCurrency(result.baseline.projectedEndingBalance), formatCurrency(result.scenarioProjection.projectedEndingBalance)],
      ["Safe weekly spend", `${formatCurrency(result.baseline.safeWeekly.safeWeeklySpending)}/wk`, `${formatCurrency(result.scenarioProjection.safeWeekly.safeWeeklySpending)}/wk`],
      ["Target buffer", formatCurrency(state.cash.targetEndingBuffer), formatCurrency(state.cash.targetEndingBuffer)],
      ["Lowest projected balance", formatCurrency(result.baseline.lowestProjectedBalance), formatCurrency(result.scenarioProjection.lowestProjectedBalance)]
    ],
    [result, state.cash.targetEndingBuffer]
  );

  function runCustom() {
    const scenario: Scenario = {
      id: "custom",
      name: customType === "income-loss" ? "Custom income change" : "Custom scenario",
      description: "Custom scenario from the lab",
      type: customType,
      amount: customAmount,
      date: customDate,
      incomeName: "Part-time campus job",
      stopDate: customDate,
      expenseName: "Rent"
    };
    setResult(compareScenarioToBaseline(state, scenario));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Scenario Lab</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Try decisions before they hit your semester.</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {presetScenarios.map((scenario) => (
          <button
            key={scenario.id}
            className="rounded-lg border border-line bg-white p-4 text-left shadow-soft transition hover:border-moss hover:-translate-y-0.5"
            onClick={() => setResult(compareScenarioToBaseline(state, scenario))}
          >
            <p className="font-semibold text-ink">{scenario.name}</p>
            <p className="mt-2 text-sm leading-5 text-muted">{scenario.description}</p>
          </button>
        ))}
      </div>

      <AffordabilityWidget onResult={setResult} />

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader title="Baseline vs Scenario" eyebrow={result.scenario.name} />
          <CashFlowChart baseline={projection} scenario={result.scenarioProjection} />
        </Card>

        <Card>
          <CardHeader title="Scenario Result" eyebrow="Deterministic output" />
          <div className="space-y-3">
            {rows.map(([label, base, scenario]) => (
              <div key={label} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-md bg-paper px-3 py-2 text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-medium text-ink">{base}</span>
                <span className="font-semibold text-coral">{scenario}</span>
              </div>
            ))}
          </div>
          <VerdictCard className="mt-4" verdict={result.verdict} />
          <Button className="mt-4 w-full" variant="secondary">
            <Play size={16} />
            Apply scenario to plan
          </Button>
        </Card>
      </section>

      <Card>
        <CardHeader title="Custom Scenario" eyebrow="Build your own what-if" />
        <div className="grid gap-3 sm:grid-cols-[1fr_150px_170px_auto] sm:items-end">
          <div>
            <Label>Scenario type</Label>
            <Select value={customType} onChange={(event) => setCustomType(event.target.value as ScenarioType)}>
              <option value="purchase">One-time purchase</option>
              <option value="unexpected-expense">Unexpected expense</option>
              <option value="investment">Move money to investing</option>
              <option value="income-loss">Stop part-time work</option>
              <option value="expense-change">Rent increases</option>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" value={customAmount} onChange={(event) => setCustomAmount(Number(event.target.value))} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
          </div>
          <Button onClick={runCustom}>
            <PlusCircle size={16} />
            Run
          </Button>
        </div>
      </Card>
    </div>
  );
}
