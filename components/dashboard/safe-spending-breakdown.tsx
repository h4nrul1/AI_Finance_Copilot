"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import type { SafeWeeklyBreakdown } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export function SafeSpendingBreakdown({ breakdown }: { breakdown: SafeWeeklyBreakdown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">How safe weekly spending is calculated</p>
          <p className="text-sm text-muted">Deterministic semester model, no AI math.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
          <Info size={15} />
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Current cash" value={formatCurrency(breakdown.currentCash)} />
          <Row label="Expected remaining income" value={`+${formatCurrency(breakdown.expectedRemainingIncome)}`} />
          <Row label="Required remaining expenses" value={`-${formatCurrency(breakdown.requiredRemainingExpenses)}`} />
          <Row label="Planned discretionary expenses" value={`-${formatCurrency(breakdown.discretionaryAlreadyPlanned)}`} />
          <Row label="Target ending buffer" value={`-${formatCurrency(breakdown.targetEndingBuffer)}`} />
          <Row label="Weeks remaining" value={breakdown.weeksRemaining.toFixed(1)} />
          <Row label="Available discretionary funds" value={formatCurrency(breakdown.availableForDiscretionary)} />
          <Row label="Safe weekly budget" value={`${formatCurrency(breakdown.safeWeeklySpending)}/week`} strong />
        </dl>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-semibold text-moss" : "font-medium text-ink"}>{value}</dd>
    </div>
  );
}
