"use client";

import { useMemo, useState } from "react";
import { Info, Plus, Sparkles, Trash2 } from "lucide-react";
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

export default function SpendingPage() {
  const { state, saveTransaction, deleteTransaction } = useFinance();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const sorted = useMemo(() => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)), [state.transactions]);
  const filtered = sorted.filter(
    (transaction) =>
      transaction.merchant.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || transaction.category === filter)
  );

  const totals = useMemo(() => getSpendingByCategory(state), [state]);
  const chartData = Object.entries(totals)
    .map(([name, value]) => ({ category: name, amount: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const totalLogged = state.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalShown = filtered.reduce((sum, transaction) => sum + transaction.amount, 0);
  const top = chartData[0];
  const firstDate = sorted[sorted.length - 1]?.date;
  const lastDate = sorted[0]?.date;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Spending</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">What you&apos;ve actually spent.</h1>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-blue/30 bg-blue/5 p-4 text-sm leading-6 text-ink">
        <Info className="mt-0.5 shrink-0 text-blue" size={18} />
        <p>
          This is a record of past purchases. It doesn&apos;t change your semester projection yet: future spending is planned with the
          flexible expenses on the Semester Plan page.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 md:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Total logged</p>
          <p className="mt-2 text-4xl font-semibold text-ink">{formatCurrency(totalLogged, 2)}</p>
          <p className="mt-1 text-sm text-muted">
            {state.transactions.length} purchases{firstDate ? ` · ${formatDate(firstDate)} – ${formatDate(lastDate)}` : ""}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Top category</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{top ? top.category : "None yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {top ? `${formatCurrency(top.amount, 2)} · ${Math.round((top.amount / totalLogged) * 100)}% of spending` : "Log a purchase to start"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Average purchase</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {state.transactions.length ? formatCurrency(totalLogged / state.transactions.length, 2) : "—"}
          </p>
          <p className="mt-1 text-sm text-muted">Across all categories</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Spending by Category" eyebrow="All logged purchases" />
          <SpendingChart data={chartData} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {chartData.map((item) => (
              <div key={item.category} className="flex justify-between rounded-md bg-paper px-3 py-2 text-sm">
                <span className="text-muted">{item.category}</span>
                <span className="font-semibold text-ink">{formatCurrency(item.amount, 2)}</span>
              </div>
            ))}
          </div>
        </Card>

        <AddPurchaseCard
          defaultDate={state.semester.currentDate}
          onAdd={(transaction) => saveTransaction({ id: `t-${Date.now()}`, ...transaction })}
        />
      </section>

      <Card>
        <CardHeader title="Spending Log" eyebrow={`${filtered.length} of ${state.transactions.length} purchases shown`} />
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <Input placeholder="Search merchant" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option>All</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-[0.10em] text-muted">
              <tr>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {filtered.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-4 py-2 font-medium text-ink">{transaction.merchant}</td>
                  <td className="px-4 py-2 text-muted">{formatDate(transaction.date)}</td>
                  <td className="px-4 py-2">
                    <Select
                      aria-label={`Category for ${transaction.merchant}`}
                      className="h-8 w-40"
                      value={transaction.category}
                      onChange={(event) => saveTransaction({ ...transaction, category: event.target.value as Category })}
                    >
                      {categories.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-ink">{formatCurrency(transaction.amount, 2)}</td>
                  <td className="px-2 py-2">
                    <Button variant="ghost" size="icon" onClick={() => deleteTransaction(transaction.id)} aria-label={`Delete ${transaction.merchant}`}>
                      <Trash2 size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-paper">
              <tr>
                <td className="px-4 py-3 font-semibold text-ink" colSpan={3}>
                  Total {filter !== "All" || search ? "shown" : "logged"}
                </td>
                <td className="px-4 py-3 text-right text-lg font-semibold text-ink">{formatCurrency(totalShown, 2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AddPurchaseCard({
  defaultDate,
  onAdd
}: {
  defaultDate: string;
  onAdd: (transaction: { merchant: string; amount: number; date: string; category: Category }) => void;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  // null means "follow the suggestion"; a value means the student picked a category themselves.
  const [chosenCategory, setChosenCategory] = useState<Category | null>(null);
  const suggested = categorizeMerchant(merchant);
  const category = chosenCategory ?? suggested;
  const amountValue = Number(amount);
  const valid = merchant.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0 && date !== "";

  function submit() {
    if (!valid) return;
    onAdd({ merchant: merchant.trim(), amount: Math.round(amountValue * 100) / 100, date, category });
    setMerchant("");
    setAmount("");
    setChosenCategory(null);
  }

  return (
    <Card>
      <CardHeader title="Log a Purchase" eyebrow="Category is suggested from the merchant" />
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <Label htmlFor="merchant">Merchant</Label>
          <Input id="merchant" placeholder="e.g. Chipotle" value={merchant} onChange={(event) => setMerchant(event.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Category</Label>
            {merchant.trim() ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Sparkles size={12} className="text-gold" />
                Suggested: {suggested}
                {chosenCategory && chosenCategory !== suggested ? (
                  <button type="button" className="ml-1 underline hover:text-ink" onClick={() => setChosenCategory(null)}>
                    use it
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
          <Select id="category" value={category} onChange={(event) => setChosenCategory(event.target.value as Category)}>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={!valid}>
          <Plus size={16} />
          Add purchase
        </Button>
      </form>
    </Card>
  );
}
