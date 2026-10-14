"use client";

import type { CopilotDetail } from "@/lib/ai/tool-registry";
import type { MaxAffordableResult } from "@/types/finance";
import { SafeSpendingBreakdown } from "@/components/dashboard/safe-spending-breakdown";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CopilotDetailCard({ detail }: { detail: CopilotDetail }) {
  switch (detail.kind) {
    case "scenario":
      return <VerdictCard verdict={detail.scenario.verdict} summary={detail.scenario} />;
    case "snapshot":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Stat label="Safe weekly" value={`${formatCurrency(detail.breakdown.safeWeeklySpending)}/wk`} />
            <Stat label="Semester-end cash" value={formatCurrency(detail.projectedEndingCash)} />
            <Stat label="Health" value={detail.semesterHealth} />
          </div>
          <SafeSpendingBreakdown breakdown={detail.breakdown} />
        </div>
      );
    case "spending":
      return <SpendingDetail categories={detail.categories} transactionCount={detail.transactionCount} />;
    case "max-affordable":
      return <MaxAffordableDetail result={detail.result} />;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function SpendingDetail({ categories, transactionCount }: { categories: Array<{ category: string; total: number }>; transactionCount: number }) {
  const total = categories.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="rounded-lg border border-line bg-white p-4 text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.10em] text-muted">
        Logged spending · {transactionCount} purchases · {formatCurrency(total, 2)}
      </p>
      <div className="space-y-2">
        {categories.map((item) => (
          <div key={item.category}>
            <div className="flex justify-between">
              <span className="text-ink">{item.category}</span>
              <span className="font-medium text-ink">{formatCurrency(item.total, 2)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-paper">
              <div className="h-1.5 rounded-full bg-blue" style={{ width: `${total > 0 ? (item.total / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaxAffordableDetail({ result }: { result: MaxAffordableResult }) {
  const { comfortableMax, tightMax } = result;
  const tiers = [
    comfortableMax > 0 ? { tone: "good" as const, label: "Comfortable", range: `Up to ${formatCurrency(comfortableMax)}` } : null,
    tightMax > comfortableMax
      ? {
          tone: "warn" as const,
          label: "Fits, but tight",
          range: comfortableMax > 0 ? `${formatCurrency(comfortableMax + 1)} – ${formatCurrency(tightMax)}` : `Up to ${formatCurrency(tightMax)}`
        }
      : null,
    { tone: "bad" as const, label: "Not recommended", range: tightMax > 0 ? `Over ${formatCurrency(tightMax)}` : "Any amount" }
  ].filter((tier) => tier !== null);

  return (
    <div className="rounded-lg border border-line bg-white p-4 text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.10em] text-muted">
        Spending limit for a purchase on {formatDate(result.date)}
      </p>
      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.label} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-2">
            <span className="font-semibold text-ink">{tier.range}</span>
            <Badge tone={tier.tone}>{tier.label}</Badge>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Comfortable means you&apos;d end at least {formatCurrency(result.comfortMargin)} above your {formatCurrency(result.goal)} goal and cut
        weekly spending by less than {Math.round(result.weeklyDropLimit * 100)}%. Change these on the Semester Plan page. Calculated by
        the semester engine, not the AI.
      </p>
    </div>
  );
}
