"use client";

import { CalendarClock, TrendingDown, TrendingUp } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SafeSpendingBreakdown } from "@/components/dashboard/safe-spending-breakdown";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { AffordabilityWidget } from "@/components/scenarios/affordability-widget";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { useFinance } from "@/components/providers/finance-provider";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function OverviewPage() {
  const { state, projection } = useFinance();
  const upcomingExpense = projection.upcomingEvents.find((event) => event.kind === "expense" && event.required);
  const firstName = state.student.name.trim().split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const healthTone = projection.semesterHealth === "On Track" ? "good" : projection.semesterHealth === "Tight" ? "warn" : "bad";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{state.semester.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">{greeting}{firstName ? `, ${firstName}` : ""}.</h1>
          <p className="mt-2 max-w-2xl text-muted">
            A semester-first view of what you can afford from now through finals.
          </p>
        </div>
        <Badge tone={healthTone}>{projection.semesterHealth}</Badge>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current Cash"
          value={formatCurrency(state.cash.checking)}
          detail={`${formatCurrency(state.cash.savings)} set aside in savings`}
        />
        <MetricCard
          label="Projected End Cash"
          value={formatCurrency(projection.projectedEndingBalance)}
          detail={`After planned income and expenses through ${formatDate(state.semester.endDate)}`}
          tone={healthTone === "good" ? "good" : "warn"}
        />
        <MetricCard
          label="Safe Weekly Spending"
          value={`${formatCurrency(projection.safeWeekly.safeWeeklySpending)}/wk`}
          detail={`Protects a ${formatCurrency(state.cash.targetEndingBuffer)} ending buffer`}
          tone="good"
        />
        <MetricCard
          label="Next Required Expense"
          value={upcomingExpense ? formatCurrency(upcomingExpense.amount) : "None"}
          detail={upcomingExpense ? `${upcomingExpense.name} · ${formatDate(upcomingExpense.date)}` : "No major required expense found"}
          tone="warn"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <Card>
          <CardHeader title="Semester Cash Flow" eyebrow="Projected balance by week" />
          <CashFlowChart baseline={projection} />
        </Card>

        <Card>
          <CardHeader title="Semester Health" eyebrow="Plain English" />
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 text-sage" size={20} />
              <p className="text-sm leading-6 text-muted">
                At the current spending rate, you&apos;re projected to finish with{" "}
                <strong className="text-ink">{formatCurrency(projection.projectedEndingBalance)}</strong> available.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <TrendingDown className="mt-1 text-coral" size={20} />
              <p className="text-sm leading-6 text-muted">
                The lowest projected balance is{" "}
                <strong className="text-ink">{formatCurrency(projection.lowestProjectedBalance)}</strong>, so big one-time
                purchases still matter.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-1 text-blue" size={20} />
              <p className="text-sm leading-6 text-muted">
                Required remaining expenses total{" "}
                <strong className="text-ink">{formatCurrency(projection.requiredRemainingExpenses)}</strong>.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <AffordabilityWidget />
      <SafeSpendingBreakdown breakdown={projection.safeWeekly} />
      <UpcomingEvents events={projection.upcomingEvents} endDate={state.semester.endDate} />
    </div>
  );
}
