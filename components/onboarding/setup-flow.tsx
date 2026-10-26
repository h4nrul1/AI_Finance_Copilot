"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Bot, GraduationCap, Info, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { localToday } from "@/lib/finance/dates";
import { buildProjection } from "@/lib/finance/engine";
import { draftToPlan, SETUP_QUESTIONS, type DraftIncome, type PlanDraft, type SetupQuestionId } from "@/lib/finance/plan-draft";
import { formatCurrency, formatDate } from "@/lib/utils";

type Phase = { kind: "asking"; index: number } | { kind: "drafting" } | { kind: "review"; draft: PlanDraft; warnings: string[] } | { kind: "error"; message: string };

const FREQUENCY_LABELS: Record<DraftIncome["frequency"], string> = {
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
  const [phase, setPhase] = useState<Phase>({ kind: "asking", index: 0 });
  const [answers, setAnswers] = useState<Record<SetupQuestionId, string>>(
    () => Object.fromEntries(SETUP_QUESTIONS.map((question) => [question.id, ""])) as Record<SetupQuestionId, string>
  );
  const replacingPlan = status === "ready" && state.mode === "personal";

  function fillInMyself() {
    startPlan(createBlankPlan(today, name));
    router.push("/semester");
  }

  async function draftPlan() {
    setPhase({ kind: "drafting" });
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today, answers: SETUP_QUESTIONS.map((question) => ({ id: question.id, answer: answers[question.id] })) })
      });
      const result = (await response.json()) as { draft?: PlanDraft; warnings?: string[]; message?: string };
      if (!response.ok || !result.draft) {
        setPhase({ kind: "error", message: result.message ?? "The AI couldn't draft your plan right now." });
        return;
      }
      setPhase({ kind: "review", draft: result.draft, warnings: result.warnings ?? [] });
    } catch {
      setPhase({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={20} />
          </div>
          <div>
            <p className="font-semibold text-ink">Set up your plan</p>
            <p className="text-xs text-muted">A few quick questions. You&apos;ll review everything before it&apos;s saved.</p>
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

      {phase.kind === "asking" ? (
        <QuestionStep
          index={phase.index}
          answers={answers}
          onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
          onBack={() => setPhase({ kind: "asking", index: Math.max(0, phase.index - 1) })}
          onNext={() =>
            phase.index === SETUP_QUESTIONS.length - 1 ? draftPlan() : setPhase({ kind: "asking", index: phase.index + 1 })
          }
          onFillInMyself={fillInMyself}
        />
      ) : null}

      {phase.kind === "drafting" ? (
        <Card className="mt-6 flex items-center gap-3">
          <Loader2 className="animate-spin text-moss" size={20} />
          <p className="text-sm text-ink">Drafting your plan from your answers...</p>
        </Card>
      ) : null}

      {phase.kind === "error" ? (
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={20} />
            <div>
              <p className="font-semibold text-ink">{phase.message}</p>
              <p className="mt-1 text-sm text-muted">Your answers are still here. Try again, or fill in your plan yourself instead.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={draftPlan}>Try again</Button>
            <Button variant="secondary" onClick={fillInMyself}>
              Fill it in myself
            </Button>
          </div>
        </Card>
      ) : null}

      {phase.kind === "review" ? (
        <ReviewStep
          draft={phase.draft}
          warnings={phase.warnings}
          today={today}
          name={name}
          onSave={(plan) => {
            startPlan(plan);
            router.push("/");
          }}
          onEditAnswers={() => setPhase({ kind: "asking", index: 0 })}
        />
      ) : null}
    </div>
  );
}

function QuestionStep({
  index,
  answers,
  onChange,
  onBack,
  onNext,
  onFillInMyself
}: {
  index: number;
  answers: Record<SetupQuestionId, string>;
  onChange: (id: SetupQuestionId, value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onFillInMyself: () => void;
}) {
  const question = SETUP_QUESTIONS[index];
  const isLast = index === SETUP_QUESTIONS.length - 1;
  const answered = SETUP_QUESTIONS.slice(0, index).filter((item) => answers[item.id].trim());

  return (
    <div className="mt-6 space-y-4">
      {answered.length ? (
        <div className="space-y-2">
          {answered.map((item) => (
            <div key={item.id} className="rounded-lg bg-paper px-4 py-2 text-sm">
              <p className="text-muted">{item.question}</p>
              <p className="mt-1 font-medium text-ink">{answers[item.id]}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Card>
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.10em] text-muted">
          <span className="flex items-center gap-2">
            <Bot size={14} />
            Question {index + 1} of {SETUP_QUESTIONS.length}
          </span>
          <div className="h-1.5 w-32 rounded-full bg-paper">
            <div className="h-1.5 rounded-full bg-moss" style={{ width: `${((index + 1) / SETUP_QUESTIONS.length) * 100}%` }} />
          </div>
        </div>
        <h2 className="mt-3 text-lg font-semibold text-ink">{question.question}</h2>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onNext();
          }}
        >
          <Input
            key={question.id}
            autoFocus
            aria-label={question.question}
            value={answers[question.id]}
            onChange={(event) => onChange(question.id, event.target.value)}
            placeholder={`e.g. ${question.example}`}
            maxLength={600}
          />
          <p className="mt-2 text-xs text-muted">Rough numbers are fine. Leave it blank to skip.</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={onBack} disabled={index === 0}>
              <ArrowLeft size={16} />
              Back
            </Button>
            <Button type="submit">
              {isLast ? (
                <>
                  <Sparkles size={16} />
                  Draft my plan
                </>
              ) : (
                <>
                  {answers[question.id].trim() ? "Next" : "Skip"}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        Rather use a form?{" "}
        <button type="button" onClick={onFillInMyself} className="underline hover:text-ink">
          Fill in a blank plan myself
        </button>
      </p>
    </div>
  );
}

function ReviewStep({
  draft,
  warnings,
  today,
  name,
  onSave,
  onEditAnswers
}: {
  draft: PlanDraft;
  warnings: string[];
  today: string;
  name: string;
  onSave: (plan: ReturnType<typeof draftToPlan>) => void;
  onEditAnswers: () => void;
}) {
  const plan = useMemo(() => draftToPlan(draft, today, name), [draft, today, name]);
  const projection = useMemo(() => buildProjection(plan), [plan]);

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Here&apos;s your draft plan</h2>
        <p className="mt-1 text-sm text-muted">The AI read your answers and filled this in. Check it before saving; you can edit anything later.</p>
      </div>

      {warnings.length ? (
        <Notice tone="warn" title="Please double-check" items={warnings} />
      ) : null}
      {draft.notes.length ? <Notice tone="info" title="Assumptions the AI made" items={draft.notes} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Safe weekly spending" value={`${formatCurrency(projection.safeWeekly.safeWeeklySpending)}/wk`} />
        <Metric label="Projected end cash" value={formatCurrency(projection.projectedEndingBalance)} />
        <Metric label="Semester health" value={projection.semesterHealth} />
      </div>

      <Card>
        <CardHeader title={draft.semester.name} eyebrow="Semester" />
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Dates" value={`${formatDate(draft.semester.startDate)} – ${formatDate(draft.semester.endDate)}`} />
          <Row label="Checking" value={formatCurrency(draft.cash.checking)} />
          <Row label="Savings (not counted)" value={formatCurrency(draft.cash.savings)} />
          <Row label="Goal to keep at the end" value={formatCurrency(draft.cash.goal)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Income" eyebrow={`${draft.incomes.length} found`} />
        {draft.incomes.length ? (
          <div className="space-y-2 text-sm">
            {draft.incomes.map((income) => (
              <ItemRow key={`${income.name}-${income.startDate}`} item={income} sign="+" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No income found. You can add it on Semester Plan.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Expenses" eyebrow={`${draft.expenses.length} found`} />
        {draft.expenses.length ? (
          <div className="space-y-2 text-sm">
            {draft.expenses.map((expense) => (
              <ItemRow
                key={`${expense.name}-${expense.startDate}`}
                item={expense}
                sign="−"
                badge={<Badge tone={expense.required ? "neutral" : "good"}>{expense.required ? "Required" : "Flexible"}</Badge>}
                detail={expense.category}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No expenses found. You can add them on Semester Plan.</p>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onEditAnswers}>
          <ArrowLeft size={16} />
          Change my answers
        </Button>
        <Button onClick={() => onSave(plan)}>
          Save my plan
          <ArrowRight size={16} />
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

function ItemRow({ item, sign, badge, detail }: { item: DraftIncome; sign: "+" | "−"; badge?: React.ReactNode; detail?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-paper px-3 py-2">
      <div className="min-w-0">
        <p className="font-medium text-ink">{item.name}</p>
        <p className="text-xs text-muted">
          {[detail, item.frequency === "one-time" ? `on ${formatDate(item.startDate)}` : `${FREQUENCY_LABELS[item.frequency]} from ${formatDate(item.startDate)}`]
            .filter(Boolean)
            .join(" · ")}
          {item.endDate ? ` until ${formatDate(item.endDate)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <span className={sign === "+" ? "font-semibold text-moss" : "font-semibold text-ink"}>
          {sign}
          {formatCurrency(item.amount)}
        </span>
      </div>
    </div>
  );
}
