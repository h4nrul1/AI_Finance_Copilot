"use client";

import { useState } from "react";
import type { UpcomingEvent } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const COLLAPSED_COUNT = 8;

export function UpcomingEvents({ events, endDate }: { events: UpcomingEvent[]; endDate: string }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, COLLAPSED_COUNT);
  const income = events.filter((event) => event.kind === "income").reduce((sum, event) => sum + event.amount, 0);
  const spending = events.filter((event) => event.kind === "expense").reduce((sum, event) => sum + event.amount, 0);

  return (
    <Card>
      <CardHeader
        title="Everything Planned Until Finals"
        eyebrow={`${events.length} payments through ${formatDate(endDate)}`}
        action={
          <div className="flex gap-4 text-right text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">In</p>
              <p className="font-semibold text-moss">+{formatCurrency(income)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted">Out</p>
              <p className="font-semibold text-coral">−{formatCurrency(spending)}</p>
            </div>
          </div>
        }
      />
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing planned for the rest of the semester. Add income and expenses on the Semester Plan page.</p>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line">
          {visible.map((event) => (
            <div key={event.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
              <span className="text-muted">{formatDate(event.date)}</span>
              <span className="min-w-0">
                <span className="font-medium text-ink">{event.name}</span>
                <span className="ml-2 text-xs text-muted">
                  {event.kind === "income" ? "Income" : `${event.category} · ${event.required ? "required" : "flexible"}`}
                </span>
              </span>
              <span className={cn("font-semibold", event.kind === "income" ? "text-moss" : "text-ink")}>
                {event.kind === "income" ? "+" : "−"}
                {formatCurrency(event.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      {events.length > COLLAPSED_COUNT ? (
        <Button className="mt-3" variant="secondary" size="sm" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${events.length}`}
        </Button>
      ) : null}
    </Card>
  );
}
