"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, GraduationCap, Info, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { createBlankPlan, guessSemester } from "@/lib/data/blank-plan";
import { localToday } from "@/lib/finance/dates";
import { buildProjection } from "@/lib/finance/engine";
import type { DraftItems } from "@/lib/finance/plan-draft";
import {
  BILLS,
  buildQuickPlan,
  CHECKING_OPTIONS,
  GOAL_OPTIONS,
  INCOME_SOURCES,
  resolveAmount,
  type AmountChoice,
  type AmountOption,
  type BillId,
  type IncomeSourceId,
  type QuickSetupInput
} from "@/lib/finance/quick-setup";
import type { Expense, FinanceState, Frequency, IncomeEvent } from "@/types/finance";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Step = "money" | "income" | "bills" | "extras" | "review";
const NUMBERED_STEPS: Step[] = ["money", "income", "bills"];

const FREQUENCY_LABELS: Record<Frequency | "one-time", string> = {
  "one-time": "one-time",
  weekly: "every week",
  biweekly: "every 2 weeks",
  monthly: "every month"
};

export function SetupFlow() {
  const { state, status, startPlan } = useFinance();
  const router = useRouter();
  const name = useSearchParams().get("name") ?? "";
  const today = localToday();

  const [step, setStep] = useState<Step>("money");
  const [semester, setSemester] = useState(() => guessSemester(today));
  const [checking, setChecking] = useState<AmountChoice | null>(null);
  const [goal, setGoal] = useState(500);
  const [incomes, setIncomes] = useState<QuickSetupInput["incomes"]>({});
  const [noIncome, setNoIncome] = useState(false);
  const [bills, setBills] = useState<QuickSetupInput["bills"]>({});
  const [extrasText, setExtrasText] = useState("");
  const [extras, setExtras] = useState<{ items: DraftItems; warnings: string[] } | null>(null);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const replacingPlan = status === "ready" && state.mode === "personal";

  const input: QuickSetupInput | null = checking ? { semester, checking, savings: 0, goal, incomes, bills } : null;

  function fillInMyself() {
    startPlan(createBlankPlan(today, name));
    router.push("/semester");
  }

  async function readExtrasAndReview() {
    if (!extrasText.trim()) {
      setExtras(null);
      setStep("review");
      return;
    }
    setReading(true);
    setExtrasError(null);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extrasText, today, semester: { name: semester.name, endDate: semester.endDate } })
      });
      const result = (await response.json()) as { items?: DraftItems; warnings?: string[]; message?: string };
      if (!response.ok || !result.items) {
        setExtrasError(`${result.message ?? "The AI couldn't read that right now."} You can continue without it and add these later on Semester Plan.`);
        return;
      }
      setExtras({ items: result.items, warnings: result.warnings ?? [] });
      setStep("review");
    } catch {
      setExtrasError("Couldn't reach the server. You can continue without these and add them later on Semester Plan.");
    } finally {
      setReading(false);
    }
  }

  const stepNumber = NUMBERED_STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="font-semibold text-ink">Set up your plan</p>
            <p className="text-xs text-muted">About a minute. Rough numbers are fine; we&apos;ll plan on the safe side.</p>
          </div>
        </div>
        <Link href="/" className="text-sm text-muted underline hover:text-ink">
          Exit setup
        </Link>
      </header>

      {replacingPlan ? (
        <p className="mt-4 rounded-md border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-ink">
          You already have a plan. Saving this one will replace it.
        </p>
      ) : null}

      {stepNumber >= 0 ? (
        <div className="mt-6 flex items-center gap-2" aria-label={`Step ${stepNumber + 1} of 3`}>
          {NUMBERED_STEPS.map((item, index) => (
            <div key={item} className={cn("h-1.5 flex-1 rounded-full", index <= stepNumber ? "bg-moss" : "bg-line")} />
          ))}
        </div>
      ) : null}

      {step === "money" ? (
        <StepCard
          eyebrow="Step 1 of 3"
          title="Your money right now"
          onNext={() => setStep("income")}
          nextDisabled={!checking}
          nextHint={!checking ? "Pick your checking balance to continue." : undefined}
        >
          <SemesterLine semester={semester} onChange={setSemester} />
          <Question title="How much is in your checking account?">
            <AmountPicker options={CHECKING_OPTIONS} choice={checking} onChange={setChecking} side="in" />
          </Question>
          <Question title="How much do you want to have left when finals end?" help="Your safety cushion. It's set aside before your weekly budget.">
            <AmountPicker
              options={GOAL_OPTIONS}
              choice={{ kind: "exact", value: goal }}
              onChange={(choice) => setGoal(resolveAmount(choice, GOAL_OPTIONS).value)}
              side="exact"
            />
          </Question>
        </StepCard>
      ) : null}

      {step === "income" ? (
        <StepCard
          eyebrow="Step 2 of 3"
          title="Money coming in for the rest of the semester"
          onBack={() => setStep("money")}
          onNext={() => setStep("bills")}
          nextDisabled={!noIncome && Object.keys(incomes).length === 0}
          nextHint={!noIncome && Object.keys(incomes).length === 0 ? "Pick at least one, or None of these." : undefined}
        >
          <ToggleChips
            items={INCOME_SOURCES.map((source) => ({ id: source.id, label: source.label }))}
            selected={Object.keys(incomes)}
            onToggle={(id) => {
              setNoIncome(false);
              setIncomes((current) => {
                const next = { ...current };
                const source = INCOME_SOURCES.find((item) => item.id === id)!;
                if (next[id as IncomeSourceId]) delete next[id as IncomeSourceId];
                else next[id as IncomeSourceId] = { amount: { kind: "range", index: source.typical }, frequency: source.defaultFrequency };
                return next;
              });
            }}
            none={{ label: "None of these", active: noIncome, onClick: () => { setIncomes({}); setNoIncome(true); } }}
          />
          {INCOME_SOURCES.filter((source) => incomes[source.id]).map((source) => {
            const answer = incomes[source.id]!;
            return (
              <Question key={source.id} title={`${source.label}: ${source.amountQuestion.toLowerCase()}`}>
                <AmountPicker
                  options={source.options}
                  choice={answer.amount}
                  onChange={(amount) => setIncomes((current) => ({ ...current, [source.id]: { ...answer, amount } }))}
                  side="in"
                />
                {source.frequencyChoice ? (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor={`${source.id}-frequency`}>How often</Label>
                    <Select
                      id={`${source.id}-frequency`}
                      value={answer.frequency}
                      onChange={(event) =>
                        setIncomes((current) => ({ ...current, [source.id]: { ...answer, frequency: event.target.value as Frequency } }))
                      }
                    >
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Every month</option>
                    </Select>
                  </div>
                ) : null}
              </Question>
            );
          })}
        </StepCard>
      ) : null}

      {step === "bills" ? (
        <StepCard
          eyebrow="Step 3 of 3"
          title="Your regular bills"
          onBack={() => setStep("income")}
          onNext={() => setStep("extras")}
        >
          <p className="text-sm text-muted">Tap the ones you pay. Don&apos;t count fun money like eating out; that&apos;s what your weekly budget is for.</p>
          <ToggleChips
            items={BILLS.map((bill) => ({ id: bill.id, label: bill.label }))}
            selected={Object.keys(bills)}
            onToggle={(id) =>
              setBills((current) => {
                const next = { ...current };
                const bill = BILLS.find((item) => item.id === id)!;
                if (next[id as BillId]) delete next[id as BillId];
                else next[id as BillId] = { kind: "range", index: bill.typical };
                return next;
              })
            }
          />
          {BILLS.filter((bill) => bills[bill.id]).map((bill) => (
            <Question key={bill.id} title={`${bill.label}: ${bill.amountQuestion.toLowerCase()}`}>
              <AmountPicker
                options={bill.options}
                choice={bills[bill.id]!}
                onChange={(choice) => setBills((current) => ({ ...current, [bill.id]: choice }))}
                side="out"
              />
            </Question>
          ))}
        </StepCard>
      ) : null}

      {step === "extras" ? (
        <StepCard
          eyebrow="Optional"
          title="Anything else coming up?"
          onBack={() => setStep("bills")}
          onNext={readExtrasAndReview}
          nextLabel={extrasText.trim() ? "Add and review" : "Skip and review"}
          nextBusy={reading}
        >
          <p className="text-sm text-muted">
            Trips, big purchases, textbooks, a deposit… Describe them in your own words and the AI will add them to your plan.
          </p>
          <textarea
            aria-label="Anything else coming up"
            value={extrasText}
            onChange={(event) => setExtrasText(event.target.value)}
            maxLength={800}
            rows={3}
            placeholder="e.g. $300 trip home in December, around $150 for textbooks next month"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-moss focus:ring-2 focus:ring-moss/20"
          />
          {extrasError ? (
            <div className="rounded-md border border-gold/50 bg-gold/10 p-3 text-sm text-ink">
              <p>{extrasError}</p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setExtras(null);
                  setStep("review");
                }}
              >
                Continue without these
              </Button>
            </div>
          ) : null}
        </StepCard>
      ) : null}

      {step === "review" && input ? (
        <ReviewStep
          plan={buildQuickPlan(input, today, name, extras?.items)}
          notes={extras?.items.notes ?? []}
          warnings={extras?.warnings ?? []}
          onBack={() => setStep("extras")}
          onSave={(plan) => {
            startPlan(plan);
            router.push("/");
          }}
        />
      ) : null}

      {step !== "review" ? (
        <p className="mt-6 text-center text-sm text-muted">
          Rather type everything into a form?{" "}
          <button type="button" onClick={fillInMyself} className="underline hover:text-ink">
            Fill in a blank plan myself
          </button>
        </p>
      ) : null}
    </div>
  );
}

function StepCard({
  eyebrow,
  title,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextHint,
  nextLabel = "Next",
  nextBusy
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextHint?: string;
  nextLabel?: string;
  nextBusy?: boolean;
}) {
  return (
    <Card className="mt-4">
      <CardHeader title={title} eyebrow={eyebrow} />
      <div className="space-y-5">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={!onBack}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <div className="flex items-center gap-3">
          {nextHint ? <span className="text-xs text-muted">{nextHint}</span> : null}
          <Button type="button" onClick={onNext} disabled={nextDisabled || nextBusy}>
            {nextBusy ? <Loader2 className="animate-spin" size={16} /> : null}
            {nextBusy ? "Reading..." : nextLabel}
            {nextBusy ? null : <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Question({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="font-medium text-ink">{title}</p>
      {help ? <p className="text-xs text-muted">{help}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Range chips plus an optional exact amount. side="in" (money coming in) and "out" (bills) explain which end of
 * the range the plan uses; side="exact" means the chips are exact values (like the goal).
 */
function AmountPicker({
  options,
  choice,
  onChange,
  side
}: {
  options: AmountOption[];
  choice: AmountChoice | null;
  onChange: (choice: AmountChoice) => void;
  side: "in" | "out" | "exact";
}) {
  const [typing, setTyping] = useState(choice?.kind === "exact" && side !== "exact");
  const [text, setText] = useState(choice?.kind === "exact" ? String(choice.value) : "");
  const selectedIndex =
    choice?.kind === "range" ? choice.index : side === "exact" && choice ? options.findIndex((option) => option.value === choice.value) : -1;
  const showExact = typing || (side === "exact" && choice?.kind === "exact" && selectedIndex === -1);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => {
          const active = !showExact && index === selectedIndex;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setTyping(false);
                onChange(side === "exact" ? { kind: "exact", value: option.value } : { kind: "range", index });
              }}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition",
                active ? "border-moss bg-moss text-white" : "border-line bg-white text-ink hover:border-moss"
              )}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showExact}
          onClick={() => setTyping(true)}
          className={cn(
            "rounded-md border border-dashed px-3 py-2 text-sm transition",
            showExact ? "border-moss text-moss" : "border-line text-muted hover:border-moss hover:text-ink"
          )}
        >
          {side === "exact" ? "Other amount" : "I know the exact amount"}
        </button>
      </div>
      {showExact ? (
        <div className="mt-2 max-w-[200px]">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            autoFocus
            aria-label="Exact amount"
            placeholder="$"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              const value = Number(event.target.value);
              if (event.target.value.trim() !== "" && Number.isFinite(value) && value >= 0) onChange({ kind: "exact", value });
            }}
          />
        </div>
      ) : null}
      {!showExact && choice?.kind === "range" && side !== "exact" ? (
        <p className="mt-2 text-xs text-muted">
          We&apos;ll plan with <strong className="text-ink">{formatCurrency(options[choice.index].value)}</strong>
          {side === "in" ? ", the low end, to be safe." : ", the high end, to be safe."} You can change it later.
        </p>
      ) : null}
    </div>
  );
}

function ToggleChips({
  items,
  selected,
  onToggle,
  none
}: {
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  none?: { label: string; active: boolean; onClick: () => void };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition",
              active ? "border-moss bg-moss/10 text-moss" : "border-line bg-white text-ink hover:border-moss"
            )}
          >
            {active ? <Check size={14} /> : null}
            {item.label}
          </button>
        );
      })}
      {none ? (
        <button
          type="button"
          aria-pressed={none.active}
          onClick={none.onClick}
          className={cn(
            "rounded-full border px-3.5 py-2 text-sm transition",
            none.active ? "border-ink bg-paper text-ink" : "border-line text-muted hover:border-ink"
          )}
        >
          {none.label}
        </button>
      ) : null}
    </div>
  );
}

function SemesterLine({
  semester,
  onChange
}: {
  semester: { name: string; startDate: string; endDate: string };
  onChange: (semester: { name: string; startDate: string; endDate: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <p className="rounded-md bg-paper px-3 py-2 text-sm text-ink">
        Planning for <strong>{semester.name}</strong>, {formatDate(semester.startDate)} – {formatDate(semester.endDate)}.{" "}
        <button type="button" onClick={() => setEditing(true)} className="text-moss underline">
          Change
        </button>
      </p>
    );
  }
  return (
    <div className="grid gap-3 rounded-md bg-paper p-3 sm:grid-cols-[1fr_150px_150px_auto] sm:items-end">
      <div>
        <Label htmlFor="setup-semester-name">Semester</Label>
        <Input id="setup-semester-name" value={semester.name} onChange={(event) => onChange({ ...semester, name: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="setup-semester-start">Starts</Label>
        <Input id="setup-semester-start" type="date" value={semester.startDate} onChange={(event) => onChange({ ...semester, startDate: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="setup-semester-end">Finals end</Label>
        <Input id="setup-semester-end" type="date" value={semester.endDate} onChange={(event) => onChange({ ...semester, endDate: event.target.value })} />
      </div>
      <Button variant="secondary" onClick={() => setEditing(false)}>
        Done
      </Button>
    </div>
  );
}

function ReviewStep({
  plan,
  notes,
  warnings,
  onBack,
  onSave
}: {
  plan: FinanceState;
  notes: string[];
  warnings: string[];
  onBack: () => void;
  onSave: (plan: FinanceState) => void;
}) {
  const projection = useMemo(() => buildProjection(plan), [plan]);
  const estimates = (plan.cash.checkingEstimated ? 1 : 0) + [...plan.incomes, ...plan.expenses].filter((item) => item.estimated).length;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Here&apos;s your plan</h2>
        <p className="mt-1 text-sm text-muted">
          {estimates > 0
            ? `${estimates} amounts are estimates (marked ≈), rounded to the safe side. You can make them exact any time on Semester Plan.`
            : "Check it before saving; you can edit anything later on Semester Plan."}
        </p>
        {estimates > 0 && projection.semesterHealth !== "On Track" ? (
          <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm text-ink">
            Looks tight? Estimates assume less income and higher bills than you probably have, so your real numbers are likely
            better. Replacing estimates with exact amounts usually improves this.
          </p>
        ) : null}
      </div>

      {warnings.length ? <Notice tone="warn" title="Please double-check" items={warnings} /> : null}
      {notes.length ? <Notice tone="info" title="Assumptions the AI made" items={notes} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Safe weekly spending" value={`${formatCurrency(projection.safeWeekly.safeWeeklySpending)}/wk`} />
        <Metric label="Projected end cash" value={formatCurrency(projection.projectedEndingBalance)} />
        <Metric label="Semester health" value={projection.semesterHealth} />
      </div>

      <Card>
        <CardHeader title={plan.semester.name} eyebrow="Semester" />
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Dates" value={`${formatDate(plan.semester.startDate)} – ${formatDate(plan.semester.endDate)}`} />
          <Row label="Checking" value={`${plan.cash.checkingEstimated ? "≈ " : ""}${formatCurrency(plan.cash.checking)}`} />
          <Row label="Goal to keep at the end" value={formatCurrency(plan.cash.targetEndingBuffer)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Income" eyebrow={`${plan.incomes.length} items`} />
        {plan.incomes.length ? (
          <div className="space-y-2 text-sm">
            {plan.incomes.map((income) => (
              <ItemRow key={income.id} item={income} sign="+" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No income added. That&apos;s fine if you&apos;re living on savings.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Expenses" eyebrow={`${plan.expenses.length} items`} />
        {plan.expenses.length ? (
          <div className="space-y-2 text-sm">
            {plan.expenses.map((expense) => (
              <ItemRow
                key={expense.id}
                item={expense}
                sign="−"
                badge={<Badge tone={expense.required ? "neutral" : "good"}>{expense.required ? "Required" : "Flexible"}</Badge>}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No expenses added yet.</p>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button onClick={() => onSave(plan)}>
          <Sparkles size={16} />
          Save my plan
        </Button>
      </div>
    </div>
  );
}

function Notice({ tone, title, items }: { tone: "warn" | "info"; title: string; items: string[] }) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <div className={tone === "warn" ? "rounded-lg border border-gold/50 bg-gold/10 p-4" : "rounded-lg border border-blue/30 bg-blue/5 p-4"}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon size={16} className={tone === "warn" ? "text-gold" : "text-blue"} />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-paper px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function ItemRow({ item, sign, badge }: { item: IncomeEvent | Expense; sign: "+" | "−"; badge?: React.ReactNode }) {
  const cadence = item.recurring ? `${FREQUENCY_LABELS[item.frequency ?? "monthly"]} from ${formatDate(item.startDate)}` : `on ${formatDate(item.startDate)}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-paper px-3 py-2">
      <div className="min-w-0">
        <p className="font-medium text-ink">{item.name}</p>
        <p className="text-xs text-muted">
          {cadence}
          {item.endDate ? ` until ${formatDate(item.endDate)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {item.estimated ? <span className="text-xs text-muted">≈ estimate</span> : null}
        {badge}
        <span className={sign === "+" ? "font-semibold text-moss" : "font-semibold text-ink"}>
          {sign}
          {formatCurrency(item.amount)}
        </span>
      </div>
    </div>
  );
}
