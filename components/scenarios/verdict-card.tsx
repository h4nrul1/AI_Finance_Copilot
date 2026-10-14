"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import type { ScenarioSummary, Verdict } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

const TONES = {
  comfortable: { badge: "good", icon: CheckCircle2, border: "border-sage/50", iconClass: "text-sage" },
  tight: { badge: "warn", icon: AlertTriangle, border: "border-gold/60", iconClass: "text-gold" },
  "not-recommended": { badge: "bad", icon: XCircle, border: "border-coral/60", iconClass: "text-coral" }
} as const;

export function VerdictCard({ verdict, summary, className }: { verdict: Verdict; summary?: ScenarioSummary; className?: string }) {
  const [showMath, setShowMath] = useState(false);
  const tone = TONES[verdict.level];
  const Icon = tone.icon;

  return (
    <div className={cn("rounded-lg border bg-white p-4", tone.border, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 shrink-0", tone.iconClass)} size={20} />
        <div className="min-w-0 flex-1 space-y-2">
          <Badge tone={tone.badge}>{verdict.label}</Badge>
          <p className="text-sm font-semibold leading-6 text-ink">{verdict.headline}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {verdict.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {verdict.rule ? (
            <p className="text-xs leading-5 text-muted">
              <span className="font-semibold text-ink">Why this verdict: </span>
              {verdict.rule}
            </p>
          ) : null}
          {verdict.suggestion ? (
            <p className="rounded-md bg-paper px-3 py-2 text-sm leading-6 text-ink">
              <span className="font-semibold">Suggestion: </span>
              {verdict.suggestion}
            </p>
          ) : null}
        </div>
      </div>

      {summary ? (
        <div className="mt-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setShowMath((value) => !value)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.10em] text-muted hover:text-ink"
          >
            <ChevronDown size={14} className={cn("transition", showMath && "rotate-180")} />
            {showMath ? "Hide calculation" : "Show calculation"}
          </button>
          {showMath ? (
            <div className="mt-3 overflow-hidden rounded-md border border-line text-sm">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                <span />
                <span className="text-right">Now</span>
                <span className="text-right">With change</span>
              </div>
              <MathRow label="Semester-end cash" before={summary.baseline.endingCash} after={summary.withChange.endingCash} />
              <MathRow label="Safe weekly spending" before={summary.baseline.safeWeeklySpending} after={summary.withChange.safeWeeklySpending} suffix="/wk" />
              <MathRow label="Lowest balance" before={summary.baseline.lowestBalance} after={summary.withChange.lowestBalance} />
              <MathRow label="Safety buffer goal" before={summary.targetEndingBuffer} after={summary.targetEndingBuffer} />
              <p className="bg-paper px-3 py-2 text-xs text-muted">Calculated by the deterministic semester engine, not the AI.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MathRow({ label, before, after, suffix = "" }: { label: string; before: number; after: number; suffix?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-line px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">
        {formatCurrency(before)}
        {suffix}
      </span>
      <span className={cn("text-right font-semibold", after < before ? "text-coral" : "text-moss")}>
        {formatCurrency(after)}
        {suffix}
      </span>
    </div>
  );
}
