"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SpendingChart } from "@/components/charts/spending-chart";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { categorizeMerchant } from "@/lib/finance/categorize";
import { getSpendingByCategory } from "@/lib/finance/tools";
import type { Category } from "@/types/finance";
import { formatCurrency, formatDate } from "@/lib/utils";

const categories: Category[] = [
  "Housing",
  "Groceries",
  "Dining",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Education",
  "Subscriptions",
  "Other"
];

export default function TransactionsPage() {
  const { state } = useFinance();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [merchant, setMerchant] = useState("Chipotle");
  const [amount, setAmount] = useState(14);
  const suggested = categorizeMerchant(merchant);

  const filtered = state.transactions.filter((transaction) => {
    const matchesSearch = transaction.merchant.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || transaction.category === category;
    return matchesSearch && matchesCategory;
  });

  const totals = useMemo(() => getSpendingByCategory(state), [state]);
  const chartData = Object.entries(totals).map(([name, value]) => ({ category: name, amount: value }));
  const total = filtered.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Transactions</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Categorized student spending.</h1>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Spending by Category" eyebrow="September sample data" />
          <SpendingChart data={chartData} />
        </Card>

        <Card>
          <CardHeader title="Auto-Categorize Demo" eyebrow="Deterministic rules" />
          <div className="grid gap-3">
            <div>
              <Label>Merchant</Label>
              <Input value={merchant} onChange={(event) => setMerchant(event.target.value)} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </div>
            <div className="rounded-lg bg-paper p-4 text-sm">
              <p className="text-muted">Suggested category</p>
              <p className="mt-1 text-xl font-semibold text-ink">{suggested}</p>
              <p className="mt-2 text-muted">{merchant || "Merchant"} · {formatCurrency(amount, 2)}</p>
            </div>
            <Button variant="secondary">
              <Plus size={16} />
              Add transaction
            </Button>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Transaction Log"
          eyebrow={`${filtered.length} transactions · ${formatCurrency(total, 2)} shown`}
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <Input placeholder="Search merchant" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-[0.10em] text-muted">
              <tr>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {filtered.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-4 py-3 font-medium text-ink">{transaction.merchant}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(transaction.date)}</td>
                  <td className="px-4 py-3 text-muted">{transaction.category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">{formatCurrency(transaction.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
