"use client";

import { useState } from "react";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { parseSampleAidOffer } from "@/lib/finance/aid";
import { formatCurrency } from "@/lib/utils";

export default function AidPage() {
  const [offer, setOffer] = useState<ReturnType<typeof parseSampleAidOffer> | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Financial Aid</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Turn an aid offer into plain language.</h1>
      </header>

      <Card>
        <CardHeader title="Sample Aid Offer Parser" eyebrow="Demo document workflow" />
        <p className="max-w-3xl text-sm leading-6 text-muted">
          For this prototype, the parser loads a deterministic sample offer instead of doing OCR. It still demonstrates the
          key product idea: separate free aid, borrowed money, earnable work-study, and remaining cost.
        </p>
        <Button className="mt-4" onClick={() => setOffer(parseSampleAidOffer())}>
          <FileSearch size={16} />
          Load Sample Financial Aid Offer
        </Button>
      </Card>

      {offer ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AidMetric label="Free Aid" value={formatCurrency(offer.freeAid)} detail="Grants + scholarships" />
            <AidMetric label="Borrowed Aid" value={formatCurrency(offer.borrowedAid)} detail="Federal loans to repay" />
            <AidMetric label="Work-Study" value={formatCurrency(offer.earnableAid)} detail="Potential earned wages" />
            <AidMetric label="Remaining Cost" value={formatCurrency(offer.estimatedRemainingCost)} detail="After listed aid sources" />
          </section>

          <Card>
            <CardHeader title="Simple Summary" eyebrow="Copilot-style explanation" />
            <p className="text-sm leading-6 text-muted">{offer.summary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Row label="Estimated cost of attendance" value={formatCurrency(offer.estimatedCostOfAttendance)} />
              <Row label="Grants" value={formatCurrency(offer.grants)} />
              <Row label="Scholarships" value={formatCurrency(offer.scholarships)} />
              <Row label="Federal loans" value={formatCurrency(offer.federalLoans)} />
              <Row label="Work-study" value={formatCurrency(offer.workStudy)} />
              <Row label="Estimated remaining cost" value={formatCurrency(offer.estimatedRemainingCost)} strong />
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function AidMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-semibold text-moss" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}
