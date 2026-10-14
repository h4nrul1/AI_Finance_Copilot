"use client";

import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import type { Category, Expense, Frequency, IncomeEvent } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

const frequencies: Frequency[] = ["monthly", "weekly", "biweekly"];
const categories: Category[] = ["Housing", "Groceries", "Dining", "Transportation", "Entertainment", "Shopping", "Education", "Subscriptions", "Other"];

export default function SemesterPage() {
  const { state, updateCash, updateSemester, saveIncome, deleteIncome, saveExpense, deleteExpense } = useFinance();

  function saveCashValues() {
    const checking = Number((document.getElementById("checking") as HTMLInputElement | null)?.value ?? state.cash.checking);
    const savings = Number((document.getElementById("savings") as HTMLInputElement | null)?.value ?? state.cash.savings);
    const buffer = Number((document.getElementById("ending-buffer") as HTMLInputElement | null)?.value ?? state.cash.targetEndingBuffer);
    updateCash(checking, savings, buffer);
  }

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
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Semester" eyebrow="Planning window" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={state.semester.name} onChange={(value) => updateSemester(value, state.semester.startDate, state.semester.endDate)} />
            <Field label="Start" type="date" value={state.semester.startDate} onChange={(value) => updateSemester(state.semester.name, value, state.semester.endDate)} />
            <Field label="End" type="date" value={state.semester.endDate} onChange={(value) => updateSemester(state.semester.name, state.semester.startDate, value)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Available Money" eyebrow="Cash position" />
          <div className="grid gap-3 sm:grid-cols-3">
            <UncontrolledNumberField id="checking" label="Checking" defaultValue={state.cash.checking} />
            <UncontrolledNumberField id="savings" label="Savings" defaultValue={state.cash.savings} />
            <UncontrolledNumberField id="ending-buffer" label="Ending buffer" defaultValue={state.cash.targetEndingBuffer} />
          </div>
          <Button className="mt-4" onClick={saveCashValues}>
            <Save size={16} />
            Save cash values
          </Button>
        </Card>
      </section>

      <EditableIncomeTable incomes={state.incomes} onSave={saveIncome} onDelete={deleteIncome} onAdd={addIncome} />
      <EditableExpenseTable expenses={state.expenses} onSave={saveExpense} onDelete={deleteExpense} onAdd={addExpense} />

      <Card>
        <CardHeader title="Financial Goal" eyebrow="Used in safe spending" />
        <p className="text-sm text-muted">
          Keep at least <strong className="text-ink">{formatCurrency(state.cash.targetEndingBuffer)}</strong> available at the end of the semester.
          This buffer is subtracted before calculating weekly discretionary capacity.
        </p>
      </Card>
    </div>
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

function UncontrolledNumberField({ id, label, defaultValue }: { id: string; label: string; defaultValue: number }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" defaultValue={defaultValue} />
    </div>
  );
}

function EditableIncomeTable({
  incomes,
  onSave,
  onDelete,
  onAdd
}: {
  incomes: IncomeEvent[];
  onSave: (income: IncomeEvent) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader title="Income" eyebrow="Guaranteed sources" action={<Button variant="secondary" onClick={onAdd}>Add</Button>} />
      <div className="grid gap-3">
        {incomes.map((income) => (
          <div key={income.id} className="grid gap-3 rounded-lg border border-line bg-paper p-3 md:grid-cols-[1.4fr_120px_150px_130px_80px] md:items-end">
            <Field label="Name" value={income.name} onChange={(name) => onSave({ ...income, name })} />
            <NumberField label="Amount" value={income.amount} onChange={(amount) => onSave({ ...income, amount })} />
            <Field label="Date" type="date" value={income.startDate} onChange={(startDate) => onSave({ ...income, startDate })} />
            <div>
              <Label>Frequency</Label>
              <Select value={income.recurring ? income.frequency ?? "monthly" : "one-time"} onChange={(event) => onSave({ ...income, recurring: event.target.value !== "one-time", frequency: event.target.value === "one-time" ? undefined : (event.target.value as Frequency) })}>
                <option value="one-time">one-time</option>
                {frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDelete(income.id)} aria-label="Delete income">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EditableExpenseTable({
  expenses,
  onSave,
  onDelete,
  onAdd
}: {
  expenses: Expense[];
  onSave: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader title="Expenses" eyebrow="Required and flexible" action={<Button variant="secondary" onClick={onAdd}>Add</Button>} />
      <div className="grid gap-3">
        {expenses.map((expense) => (
          <div key={expense.id} className="grid gap-3 rounded-lg border border-line bg-paper p-3 md:grid-cols-[1.2fr_130px_110px_150px_130px_100px_80px] md:items-end">
            <Field label="Name" value={expense.name} onChange={(name) => onSave({ ...expense, name })} />
            <div>
              <Label>Category</Label>
              <Select value={expense.category} onChange={(event) => onSave({ ...expense, category: event.target.value as Category })}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </Select>
            </div>
            <NumberField label="Amount" value={expense.amount} onChange={(amount) => onSave({ ...expense, amount })} />
            <Field label="Date" type="date" value={expense.startDate} onChange={(startDate) => onSave({ ...expense, startDate })} />
            <div>
              <Label>Frequency</Label>
              <Select value={expense.recurring ? expense.frequency ?? "monthly" : "one-time"} onChange={(event) => onSave({ ...expense, recurring: event.target.value !== "one-time", frequency: event.target.value === "one-time" ? undefined : (event.target.value as Frequency) })}>
                <option value="one-time">one-time</option>
                {frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
              </Select>
            </div>
            <label className="flex h-10 items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={expense.required} onChange={(event) => onSave({ ...expense, required: event.target.checked })} />
              Required
            </label>
            <Button variant="ghost" size="icon" onClick={() => onDelete(expense.id)} aria-label="Delete expense">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
