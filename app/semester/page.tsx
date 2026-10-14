"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { planItemTotals, type PlanItemTotal } from "@/lib/finance/engine";
import {
  COMFORT_MARGIN_BOUNDS,
  getVerdictSettings,
  presetSettings,
  VERDICT_PRESETS,
  WEEKLY_DROP_BOUNDS
} from "@/lib/finance/verdict-settings";
import type { Category, Expense, Frequency, IncomeEvent, VerdictPreset } from "@/types/finance";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const frequencies: Frequency[] = ["monthly", "weekly", "biweekly"];
const categories: Category[] = ["Housing", "Groceries", "Dining", "Transportation", "Entertainment", "Shopping", "Education", "Subscriptions", "Other"];

export default function SemesterPage() {
  const { state, projection, updateSemester, saveIncome, deleteIncome, saveExpense, deleteExpense } = useFinance();
  const totals = useMemo(() => planItemTotals(state), [state]);
  const { safeWeekly } = projection;

  function addIncome() {
    saveIncome({
      id: `income-${Date.now()}`,
      name: "New income",
      amount: 250,
      startDate: state.semester.currentDate,
      recurring: false,
      category: "Income",
      guaranteed: true
    });
  }

  function addExpense() {
    saveExpense({
      id: `expense-${Date.now()}`,
      name: "New expense",
      category: "Other",
      amount: 100,
      startDate: state.semester.currentDate,
      recurring: false,
      required: false
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Semester Plan</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Edit the assumptions behind the plan.</h1>
        <p className="mt-2 text-sm text-muted">
          Totals cover the rest of the semester: {formatDate(state.semester.currentDate)} to {formatDate(state.semester.endDate)}.
        </p>
      </header>

      <Card>
        <CardHeader title="How your weekly budget is built" eyebrow="Rest of the semester" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Formula label="Checking now" value={formatCurrency(safeWeekly.currentCash)} />
          <Formula label="Income" value={`+${formatCurrency(safeWeekly.expectedRemainingIncome)}`} tone="good" />
          <Formula label="Required expenses" value={`−${formatCurrency(safeWeekly.requiredRemainingExpenses)}`} tone="bad" />
          <Formula label="Flexible expenses" value={`−${formatCurrency(safeWeekly.discretionaryAlreadyPlanned)}`} tone="bad" />
          <Formula label="Your goal" value={`−${formatCurrency(safeWeekly.targetEndingBuffer)}`} tone="bad" />
          <Formula
            label={`÷ ${safeWeekly.weeksRemaining.toFixed(1)} weeks`}
            value={`${formatCurrency(safeWeekly.safeWeeklySpending)}/wk`}
            tone="result"
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          {formatCurrency(safeWeekly.availableForDiscretionary)} is left for extra spending after everything planned and your goal. Savings (
          {formatCurrency(state.cash.savings)}) is not counted.
        </p>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Semester" eyebrow="Planning window" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={state.semester.name} onChange={(value) => updateSemester(value, state.semester.startDate, state.semester.endDate)} />
            <Field label="Start" type="date" value={state.semester.startDate} onChange={(value) => updateSemester(state.semester.name, value, state.semester.endDate)} />
            <Field label="End" type="date" value={state.semester.endDate} onChange={(value) => updateSemester(state.semester.name, state.semester.startDate, value)} />
          </div>
        </Card>

        <CashCard />
      </section>

      <EditableIncomeTable
        incomes={state.incomes}
        totals={totals}
        total={safeWeekly.expectedRemainingIncome}
        onSave={saveIncome}
        onDelete={deleteIncome}
        onAdd={addIncome}
      />
      <EditableExpenseTable
        expenses={state.expenses}
        totals={totals}
        requiredTotal={safeWeekly.requiredRemainingExpenses}
        flexibleTotal={safeWeekly.discretionaryAlreadyPlanned}
        onSave={saveExpense}
        onDelete={deleteExpense}
        onAdd={addExpense}
      />

      <section className="grid gap-5 lg:grid-cols-2">
        <GoalCard />
        <VerdictSettingsCard />
      </section>
    </div>
  );
}

function Formula({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "result" }) {
  return (
    <div className={cn("rounded-md px-3 py-2", tone === "result" ? "bg-moss text-white" : "bg-paper")}>
      <p className={cn("text-xs uppercase tracking-[0.08em]", tone === "result" ? "text-white/80" : "text-muted")}>{label}</p>
      <p className={cn("text-lg font-semibold", tone === "good" && "text-moss", tone === "bad" && "text-coral", !tone && "text-ink")}>{value}</p>
    </div>
  );
}

function CashCard() {
  const { state, updateCash } = useFinance();
  const [checking, setChecking] = useState(state.cash.checking);
  const [savings, setSavings] = useState(state.cash.savings);

  // Keep the form in step with the saved plan (initial load, reset, edits elsewhere).
  useEffect(() => {
    setChecking(state.cash.checking);
    setSavings(state.cash.savings);
  }, [state.cash.checking, state.cash.savings]);

  const dirty = checking !== state.cash.checking || savings !== state.cash.savings;

  return (
    <Card>
      <CardHeader title="Available Money" eyebrow="Cash position" />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id="checking" label="Checking (counted)" value={checking} onChange={setChecking} />
        <NumberField id="savings" label="Savings (not counted)" value={savings} onChange={setSavings} />
      </div>
      <Button className="mt-4" disabled={!dirty} onClick={() => updateCash(checking, savings, state.cash.targetEndingBuffer)}>
        <Save size={16} />
        {dirty ? "Save cash values" : "Saved"}
      </Button>
    </Card>
  );
}

function GoalCard() {
  const { state, projection, updateCash } = useFinance();
  const [goal, setGoal] = useState(state.cash.targetEndingBuffer);

  useEffect(() => setGoal(state.cash.targetEndingBuffer), [state.cash.targetEndingBuffer]);

  const dirty = goal !== state.cash.targetEndingBuffer;
  const onTrack = projection.projectedEndingBalance >= state.cash.targetEndingBuffer;

  return (
    <Card>
      <CardHeader title="Semester Goal" eyebrow="Money to keep when finals end" />
      <div className="flex items-start gap-3">
        <Target className="mt-1 shrink-0 text-moss" size={20} />
        <p className="text-sm leading-6 text-muted">
          The goal is set aside before your weekly budget is calculated. You&apos;re projected to finish with{" "}
          <strong className="text-ink">{formatCurrency(projection.projectedEndingBalance)}</strong>
          {onTrack
            ? `, ${formatCurrency(projection.projectedEndingBalance - state.cash.targetEndingBuffer)} above your goal.`
            : `, ${formatCurrency(state.cash.targetEndingBuffer - projection.projectedEndingBalance)} short of your goal.`}
        </p>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <NumberField id="goal" label="Keep at least" value={goal} onChange={(value) => setGoal(Math.max(0, value))} />
        </div>
        <Button disabled={!dirty} onClick={() => updateCash(state.cash.checking, state.cash.savings, goal)}>
          <Save size={16} />
          {dirty ? "Save goal" : "Saved"}
        </Button>
      </div>
    </Card>
  );
}

function VerdictSettingsCard() {
  const { state, updateVerdictSettings } = useFinance();
  const settings = getVerdictSettings(state);
  const [margin, setMargin] = useState(settings.comfortMargin);
  const [dropPercent, setDropPercent] = useState(Math.round(settings.weeklyDropLimit * 100));

  useEffect(() => {
    setMargin(settings.comfortMargin);
    setDropPercent(Math.round(settings.weeklyDropLimit * 100));
  }, [settings.comfortMargin, settings.weeklyDropLimit]);

  const presets = Object.entries(VERDICT_PRESETS) as Array<[Exclude<VerdictPreset, "custom">, (typeof VERDICT_PRESETS)["balanced"]]>;

  return (
    <Card>
      <CardHeader title="Verdict Strictness" eyebrow="When a purchase counts as tight" />
      <div className="grid gap-2 sm:grid-cols-3">
        {presets.map(([key, preset]) => (
          <button
            key={key}
            type="button"
            onClick={() => updateVerdictSettings(presetSettings(key))}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm transition",
              settings.preset === key ? "border-moss bg-moss text-white" : "border-line bg-paper text-ink hover:border-moss"
            )}
          >
            <span className="font-semibold">{preset.label}</span>
            <span className={cn("mt-1 block text-xs leading-5", settings.preset === key ? "text-white/80" : "text-muted")}>{preset.description}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <NumberField id="comfort-margin" label="Comfortable margin above goal ($)" value={margin} onChange={setMargin} />
        <NumberField id="weekly-drop" label="Tight if weekly budget drops (%)" value={dropPercent} onChange={setDropPercent} />
        <Button
          variant="secondary"
          onClick={() => updateVerdictSettings({ preset: "custom", comfortMargin: margin, weeklyDropLimit: dropPercent / 100 })}
        >
          Use custom
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Custom values are kept between {formatCurrency(COMFORT_MARGIN_BOUNDS.min)}–{formatCurrency(COMFORT_MARGIN_BOUNDS.max)} and{" "}
        {WEEKLY_DROP_BOUNDS.min * 100}–{WEEKLY_DROP_BOUNDS.max * 100}%. Two rules never change: going below $0 or ending below your goal is
        always <strong className="text-ink">Not recommended</strong>.
        {settings.preset === "custom" ? " Currently using custom values." : ""}
      </p>
    </Card>
  );
}

function Field({ id, label, value, onChange, type = "text" }: { id?: string; label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id?: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function ItemTotal({ item, total, sign }: { item: { amount: number; recurring: boolean }; total?: PlanItemTotal; sign: "+" | "−" }) {
  if (!total || total.count === 0) {
    return <span className="text-xs text-muted">Not in the rest of the semester</span>;
  }
  return (
    <span className="text-xs text-muted">
      {item.recurring ? `${formatCurrency(item.amount)} × ${total.count} = ` : ""}
      <strong className={sign === "+" ? "text-moss" : "text-coral"}>
        {sign}
        {formatCurrency(total.total)}
      </strong>
    </span>
  );
}

function TotalBadge({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-md bg-paper px-3 py-1.5 text-right">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={cn("text-lg font-semibold", tone === "good" ? "text-moss" : "text-coral")}>{value}</p>
    </div>
  );
}

function FrequencySelect({ recurring, frequency, onChange }: { recurring: boolean; frequency?: Frequency; onChange: (recurring: boolean, frequency?: Frequency) => void }) {
  return (
    <div>
      <Label>Frequency</Label>
      <Select
        value={recurring ? frequency ?? "monthly" : "one-time"}
        onChange={(event) =>
          onChange(event.target.value !== "one-time", event.target.value === "one-time" ? undefined : (event.target.value as Frequency))
        }
      >
        <option value="one-time">one-time</option>
        {frequencies.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </Select>
    </div>
  );
}

function EditableIncomeTable({
  incomes,
  totals,
  total,
  onSave,
  onDelete,
  onAdd
}: {
  incomes: IncomeEvent[];
  totals: Record<string, PlanItemTotal>;
  total: number;
  onSave: (income: IncomeEvent) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Income"
        eyebrow="Guaranteed sources"
        action={
          <div className="flex items-center gap-3">
            <TotalBadge label="Rest of semester" value={`+${formatCurrency(total)}`} tone="good" />
            <Button variant="secondary" onClick={onAdd}>
              Add
            </Button>
          </div>
        }
      />
      <div className="grid gap-3">
        {incomes.map((income) => (
          <div key={income.id} className="rounded-lg border border-line bg-paper p-3">
            <div className="grid gap-3 md:grid-cols-[1.4fr_120px_150px_130px_44px] md:items-end">
              <Field label="Name" value={income.name} onChange={(name) => onSave({ ...income, name })} />
              <NumberField label="Amount" value={income.amount} onChange={(amount) => onSave({ ...income, amount })} />
              <Field label="Date" type="date" value={income.startDate} onChange={(startDate) => onSave({ ...income, startDate })} />
              <FrequencySelect
                recurring={income.recurring}
                frequency={income.frequency}
                onChange={(recurring, frequency) => onSave({ ...income, recurring, frequency })}
              />
              <Button variant="ghost" size="icon" onClick={() => onDelete(income.id)} aria-label="Delete income">
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="mt-2">
              {income.guaranteed ? (
                <ItemTotal item={income} total={totals[income.id]} sign="+" />
              ) : (
                <span className="text-xs text-muted">Not guaranteed, so not counted</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EditableExpenseTable({
  expenses,
  totals,
  requiredTotal,
  flexibleTotal,
  onSave,
  onDelete,
  onAdd
}: {
  expenses: Expense[];
  totals: Record<string, PlanItemTotal>;
  requiredTotal: number;
  flexibleTotal: number;
  onSave: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Expenses"
        eyebrow="Required and flexible"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <TotalBadge label="Required" value={`−${formatCurrency(requiredTotal)}`} tone="bad" />
            <TotalBadge label="Flexible" value={`−${formatCurrency(flexibleTotal)}`} tone="bad" />
            <Button variant="secondary" onClick={onAdd}>
              Add
            </Button>
          </div>
        }
      />
      <div className="grid gap-3">
        {expenses.map((expense) => (
          <div key={expense.id} className="rounded-lg border border-line bg-paper p-3">
            <div className="grid gap-3 md:grid-cols-[1.2fr_130px_110px_150px_130px_100px_44px] md:items-end">
              <Field label="Name" value={expense.name} onChange={(name) => onSave({ ...expense, name })} />
              <div>
                <Label>Category</Label>
                <Select value={expense.category} onChange={(event) => onSave({ ...expense, category: event.target.value as Category })}>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
              </div>
              <NumberField label="Amount" value={expense.amount} onChange={(amount) => onSave({ ...expense, amount })} />
              <Field label="Date" type="date" value={expense.startDate} onChange={(startDate) => onSave({ ...expense, startDate })} />
              <FrequencySelect
                recurring={expense.recurring}
                frequency={expense.frequency}
                onChange={(recurring, frequency) => onSave({ ...expense, recurring, frequency })}
              />
              <label className="flex h-10 items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={expense.required} onChange={(event) => onSave({ ...expense, required: event.target.checked })} />
                Required
              </label>
              <Button variant="ghost" size="icon" onClick={() => onDelete(expense.id)} aria-label="Delete expense">
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{expense.required ? "Required" : "Flexible"}</span>
              <ItemTotal item={expense} total={totals[expense.id]} sign="−" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
