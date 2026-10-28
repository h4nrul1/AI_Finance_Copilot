"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useFinance } from "@/components/providers/finance-provider";
import { countEstimates } from "@/lib/finance/quick-setup";

/** After quick setup, nudges the student to replace estimates and add anything setup didn't ask about. */
export function AccuracyCard() {
  const { state, dismissAccuracyCard } = useFinance();
  if (state.mode !== "personal" || state.accuracyCardDismissed) return null;

  const estimates = countEstimates(state);
  const hasSchoolCosts = state.expenses.some((expense) => expense.category === "Education");
  const items = [
    estimates > 0
      ? { text: `${estimates} ${estimates === 1 ? "amount is an estimate" : "amounts are estimates"}. Replace them with exact numbers when you can.`, href: "/semester" }
      : null,
    hasSchoolCosts ? null : { text: "Add any tuition, fees, or textbook costs still coming up.", href: "/semester" },
    { text: "Add trips or big purchases you're planning, or try them first in Scenario Lab.", href: "/scenarios" },
    { text: `Check your semester dates (${state.semester.name}).`, href: "/semester" }
  ].filter((item) => item !== null);

  return (
    <section className="rounded-lg border border-moss/30 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Your plan works now</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Make it more accurate</h2>
        </div>
        <button type="button" onClick={dismissAccuracyCard} aria-label="Hide this card" className="rounded-md p-1 text-muted hover:bg-paper hover:text-ink">
          <X size={16} />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.text}>
            <Link href={item.href} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-2 text-sm text-ink hover:bg-line/60">
              {item.text}
              <ArrowRight size={14} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
