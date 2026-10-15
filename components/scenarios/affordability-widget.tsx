"use client";

import { useState } from "react";
import { WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, NumberInput } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { compareScenarioToBaseline, summarizeScenarioResult } from "@/lib/finance/tools";
import type { ScenarioResult } from "@/types/finance";
import { VerdictCard } from "./verdict-card";

export function AffordabilityWidget({ onResult }: { onResult?: (result: ScenarioResult) => void }) {
  const { state } = useFinance();
  const [name, setName] = useState("Chicago trip");
  const [amount, setAmount] = useState(500);
  const [date, setDate] = useState("2026-11-12");
  const [result, setResult] = useState<ScenarioResult | null>(null);

  function checkAffordability() {
    const next = compareScenarioToBaseline(state, {
      id: "custom-affordability",
      name,
      description: `Can I afford ${name}?`,
      type: "purchase",
      amount,
      date
    });
    setResult(next);
    onResult?.(next);
  }

  return (
    <Card>
      <CardHeader title="Can I Afford This?" eyebrow="Quick action" />
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
        <div>
          <Label>Purchase</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label>Amount</Label>
          <NumberInput value={amount} onValueChange={setAmount} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <Button onClick={checkAffordability}>
          <WalletCards size={16} />
          Check
        </Button>
      </div>
      {result ? <VerdictCard className="mt-4" verdict={result.verdict} summary={summarizeScenarioResult(state, result)} /> : null}
    </Card>
  );
}
