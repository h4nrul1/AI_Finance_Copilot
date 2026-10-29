"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Clock, Info, TrendingUp } from "lucide-react";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { APPROACHES, OPTIONS, RISK_LABELS, RISK_TONES, type InvestingOption } from "@/lib/data/investing";
import { compareScenarioToBaseline, summarizeScenarioResult } from "@/lib/finance/tools";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default function InvestPage() {
  const [approachId, setApproachId] = useState(APPROACHES[0].id);
  const approach = APPROACHES.find((item) => item.id === approachId) ?? APPROACHES[0];
  const options = approach.optionIds.flatMap((id) => OPTIONS.find((option) => option.id === id) ?? []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Investing</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Learn how investing works before you start.</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Pick how long you can leave the money alone, then see the kinds of investments people commonly use for that goal. Then test what it
          would do to your semester.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-blue/30 bg-blue/5 p-4 text-sm leading-6 text-ink">
        <Info className="mt-0.5 shrink-0 text-blue" size={18} />
        <p>
          This page is for learning. It describes types of investments, not specific funds or stocks, and it is not financial, tax, or legal
          advice. Investments can lose value. Money you need for rent, food, or tuition this semester should usually stay in cash.
        </p>
      </div>

      <Card>
        <CardHeader title="1. How long can you leave the money?" eyebrow="Choose an approach" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Investing time horizon">
          {APPROACHES.map((item) => {
            const active = item.id === approach.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setApproachId(item.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  active ? "border-moss bg-moss text-white" : "border-line bg-white text-ink hover:border-moss"
                )}
              >
                <p className="font-semibold">{item.label}</p>
                <p className={cn("mt-1 flex items-center gap-1 text-xs", active ? "text-white/80" : "text-muted")}>
                  <Clock size={12} />
                  {item.horizon}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg bg-paper p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{approach.label}</h3>
            <Badge tone={RISK_TONES[approach.risk]}>{RISK_LABELS[approach.risk]}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink">{approach.summary}</p>
          <dl className="mt-3 grid gap-3 text-sm leading-6 md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.10em] text-muted">Good for</dt>
              <dd className="text-ink">{approach.goodFor}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.10em] text-muted">Watch out</dt>
              <dd className="text-ink">{approach.watchOut}</dd>
            </div>
          </dl>
          <AskCopilot question={approach.question} />
        </div>
      </Card>

      <section>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">2. Common options for this approach</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{approach.label}: where the money often goes</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {options.map((option) => (
            <OptionCard key={option.id} option={option} />
          ))}
        </div>
      </section>

      <PlanImpactCard />

      <details className="rounded-lg border border-line bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-ink">All investment types at a glance</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="text-xs uppercase tracking-[0.10em] text-muted">
              <tr>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2">Getting cash out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {OPTIONS.map((option) => (
                <tr key={option.id}>
                  <td className="py-2 pr-4 font-medium text-ink">{option.name}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={RISK_TONES[option.risk]}>{RISK_LABELS[option.risk]}</Badge>
                  </td>
                  <td className="py-2 text-muted">{option.liquidity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function AskCopilot({ question }: { question: string }) {
  return (
    <Link
      href={`/copilot?question=${encodeURIComponent(question)}`}
      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-moss underline"
    >
      <Bot size={15} />
      Ask the copilot: &ldquo;{question}&rdquo;
    </Link>
  );
}

function OptionCard({ option }: { option: InvestingOption }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{option.name}</h3>
        <Badge tone={RISK_TONES[option.risk]}>{RISK_LABELS[option.risk]}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{option.summary}</p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.10em] text-moss">Upsides</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink">
            {option.pros.map((pro) => (
              <li key={pro}>{pro}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.10em] text-coral">Downsides</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink">
            {option.cons.map((con) => (
              <li key={con}>{con}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        <strong className="text-ink">Getting cash out:</strong> {option.liquidity}
      </p>
      <div className="mt-auto pt-1">
        <AskCopilot question={option.question} />
      </div>
    </Card>
  );
}

/** Runs the same engine as Scenario Lab, so a student sees what moving cash into investing does to their own plan. */
function PlanImpactCard() {
  const { state } = useFinance();
  const [amount, setAmount] = useState(300);
  const [date, setDate] = useState(state.semester.currentDate);

  const result = useMemo(() => {
    if (!(amount > 0) || date < state.semester.currentDate || date > state.semester.endDate) return null;
    return compareScenarioToBaseline(state, {
      id: "invest-check",
      name: "Move money to investing",
      description: "Investing page check",
      type: "investment",
      amount,
      date
    });
  }, [state, amount, date]);

  return (
    <Card>
      <CardHeader title="3. What would investing do to my semester?" eyebrow="Uses your plan" />
      <p className="mb-4 text-sm leading-6 text-muted">
        Money you invest leaves checking, so it can&apos;t cover bills. Enter an amount to see the effect on semester-end cash and your weekly
        budget. Savings is not counted in your plan.
      </p>
      <div className="grid gap-3 sm:grid-cols-[160px_180px] sm:items-end">
        <div>
          <Label htmlFor="invest-amount">Amount</Label>
          <NumberInput id="invest-amount" value={amount} onValueChange={setAmount} />
        </div>
        <div>
          <Label htmlFor="invest-date">Date</Label>
          <Input
            id="invest-date"
            type="date"
            min={state.semester.currentDate}
            max={state.semester.endDate}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>

      {result ? (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <TrendingUp size={16} className="text-moss" />
            Investing {formatCurrency(amount)} lowers semester-end cash from{" "}
            <strong>{formatCurrency(result.baseline.projectedEndingBalance)}</strong> to{" "}
            <strong>{formatCurrency(result.scenarioProjection.projectedEndingBalance)}</strong>.
          </p>
          <VerdictCard verdict={result.verdict} summary={summarizeScenarioResult(state, result)} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-coral">
          Enter a positive amount and a date inside the semester ({formatDate(state.semester.currentDate)} to {formatDate(state.semester.endDate)}).
        </p>
      )}
    </Card>
  );
}
