"use client";

import { useMemo, useState } from "react";
import { Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { SpendingChart } from "@/components/charts/spending-chart";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { categorizeMerchant } from "@/lib/finance/categorize";
import { budgetImpact, categoryPace, plannedCategories, type CategoryPace } from "@/lib/finance/spending";
import { getSpendingByCategory } from "@/lib/finance/tools";
import type { Category } from "@/types/finance";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

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
  const { state, projection, saveTransaction, deleteTransaction } = useFinance();
  const planned = useMemo(() => plannedCategories(state), [state]);
  const impact = useMemo(() => budgetImpact(state), [state]);
  const pace = useMemo(() => categoryPace(state), [state]);
  const week = projection.thisWeek;
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
          <strong>Extra</strong> purchases come out of your weekly budget. Purchases in a category your plan budgets for (like groceries)
          are <strong>Planned</strong> and don&apos;t, so they aren&apos;t counted twice, until that category goes <strong>over plan</strong> for the
          month. Click the label on any purchase to change it.
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
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {week.left >= 0 ? "Left this week" : "Over this week"}
          </p>
          <p className={cn("mt-2 text-2xl font-semibold", week.left >= 0 ? "text-ink" : "text-coral")}>{formatCurrency(Math.abs(week.left))}</p>
          <p className="mt-1 text-sm text-muted">
            {formatCurrency(week.spent, 2)} extra spent of {formatCurrency(week.budget)} · {formatDate(week.startDate)} – {formatDate(week.endDate)}
          </p>
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
          planned={planned}
          pace={pace}
          onAdd={(transaction) => saveTransaction({ id: `t-${Date.now()}`, ...transaction, pending: true })}
        />
      </section>

      <CategoryPaceCard
        pace={pace}
        monthLabel={`${new Date(`${state.semester.currentDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} so far`}
      />

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
                <th className="px-4 py-3">Weekly budget</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
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
                  <td className="px-4 py-2">
                    <BudgetToggle
                      counted={impact.get(transaction.id) ?? 0}
                      amount={transaction.amount}
                      covered={transaction.extra === undefined && planned.has(transaction.category)}
                      merchant={transaction.merchant}
                      onChange={(extra) => saveTransaction({ ...transaction, extra })}
                    />
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
                <td className="px-4 py-3 font-semibold text-ink" colSpan={4}>
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

/**
 * "Extra" comes out of the weekly budget; "Planned" is covered by the plan; "Over plan" is a covered purchase that took
 * its category past this month's plan, so the part over counts. Click to mark it extra or planned yourself.
 */
function BudgetToggle({
  counted,
  amount,
  covered,
  merchant,
  onChange
}: {
  counted: number;
  amount: number;
  covered: boolean;
  merchant: string;
  onChange: (extra: boolean) => void;
}) {
  const counts = counted > 0;
  const label = !counts ? "Planned" : covered ? (counted < amount ? `${formatCurrency(counted, 2)} over plan` : "Over plan") : "Extra";
  const meaning = !counts
    ? "covered by your plan"
    : covered
      ? `${formatCurrency(counted, 2)} of it is past this month's plan for its category, so that part counts against your weekly budget`
      : "counts against your weekly budget";

  return (
    <button
      type="button"
      onClick={() => onChange(!counts)}
      aria-label={`${merchant}: ${meaning}. Click to mark it ${counts ? "planned" : "extra"}.`}
      title={`${meaning[0].toUpperCase()}${meaning.slice(1)}. Click to mark it ${counts ? "planned" : "extra"}.`}
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
        !counts && "border-line bg-paper text-muted hover:border-moss",
        counts && !covered && "border-gold/50 bg-gold/10 text-ink hover:border-gold",
        counts && covered && "border-coral/40 bg-coral/10 text-ink hover:border-coral"
      )}
    >
      {label}
    </button>
  );
}

/** Each budgeted category's spending this month against the plan. */
function CategoryPaceCard({ pace, monthLabel }: { pace: CategoryPace[]; monthLabel: string }) {
  return (
    <Card>
      <CardHeader title="This Month vs. Plan" eyebrow={monthLabel} />
      {pace.length === 0 ? (
        <p className="text-sm text-muted">Nothing in your plan for this month yet. Add expenses on Semester Plan to track them here.</p>
      ) : (
        <>
          <p className="mb-4 text-sm leading-6 text-muted">
            Purchases in these categories are covered by your plan. Anything past the plan comes out of your weekly budget.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {pace.map((item) => {
              const share = Math.min(1, item.spent / item.planned);
              return (
                <div key={item.category} className="rounded-md bg-paper px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{item.category}</span>
                    <span className={item.over > 0 ? "font-semibold text-coral" : "text-muted"}>
                      {formatCurrency(item.spent, 2)} of {formatCurrency(item.planned)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel" aria-hidden>
                    <div className={cn("h-full rounded-full", item.over > 0 ? "bg-coral" : share >= 0.8 ? "bg-gold" : "bg-sage")} style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {item.over > 0
                      ? `${formatCurrency(item.over, 2)} over plan, taken from your weekly budget`
                      : `${formatCurrency(item.planned - item.spent, 2)} left in the plan`}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function AddPurchaseCard({
  defaultDate,
  planned,
  pace,
  onAdd
}: {
  defaultDate: string;
  planned: Set<Category>;
  pace: CategoryPace[];
  onAdd: (transaction: { merchant: string; amount: number; date: string; category: Category; extra?: boolean }) => void;
}) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  // null means "follow the suggestion"; a value means the student picked a category themselves.
  const [chosenCategory, setChosenCategory] = useState<Category | null>(null);
  const suggested = categorizeMerchant(merchant);
  const category = chosenCategory ?? suggested;
  // null means "follow the category"; a value means the student said whether it was extra.
  const [chosenExtra, setChosenExtra] = useState<boolean | null>(null);
  const extraByCategory = !planned.has(category);
  const categoryPlan = pace.find((item) => item.category === category);
  const extra = chosenExtra ?? extraByCategory;
  const amountValue = Number(amount);
  const valid = merchant.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0 && date !== "";

  function submit() {
    if (!valid) return;
    onAdd({
      merchant: merchant.trim(),
      amount: Math.round(amountValue * 100) / 100,
      date,
      category,
      // Only stored when the student overrode the default, so fixing the category later still updates it.
      ...(chosenExtra === null ? {} : { extra: chosenExtra })
    });
    setMerchant("");
    setAmount("");
    setChosenCategory(null);
    setChosenExtra(null);
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
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1 shrink-0" checked={extra} onChange={(event) => setChosenExtra(event.target.checked)} />
          <span>
            Extra: not part of my plan
            <span className="block text-xs text-muted">
              {extraByCategory
                ? `Your plan has nothing for ${category}, so this comes out of your weekly budget.`
                : categoryPlan && categoryPlan.over > 0
                  ? `${category} is already over plan this month, so this comes out of your weekly budget either way.`
                  : categoryPlan
                    ? `Covered by your plan: ${formatCurrency(categoryPlan.spent, 2)} of ${formatCurrency(categoryPlan.planned)} used this month. Anything past that comes out of your weekly budget.`
                    : `Your plan budgets for ${category}, so this is covered. Tick it if this was extra.`}
            </span>
          </span>
        </label>
        <Button type="submit" disabled={!valid}>
          <Plus size={16} />
          Add purchase
        </Button>
      </form>
    </Card>
  );
}
