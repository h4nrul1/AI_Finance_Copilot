"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Expense, FinanceState, IncomeEvent, Scenario, Transaction, VerdictSettings } from "@/types/finance";
import { withToday } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { localToday } from "@/lib/finance/dates";
import { buildProjection } from "@/lib/finance/engine";
import { applyScenario } from "@/lib/finance/tools";

/** "loading" until the saved plan is read; "needs-setup" when this browser has no plan yet. */
export type PlanStatus = "loading" | "needs-setup" | "ready";

interface FinanceContextValue {
  state: FinanceState;
  status: PlanStatus;
  projection: ReturnType<typeof buildProjection>;
  /** Load the sample student's plan. */
  startDemo: () => void;
  /** Start using a plan the student created (blank or drafted during setup). */
  startPlan: (plan: FinanceState) => void;
  /** Delete this browser's plan and go back to the welcome screen. */
  startOver: () => void;
  updateCash: (checking: number, savings: number, buffer: number) => void;
  updateSemester: (name: string, startDate: string, endDate: string) => void;
  updateVerdictSettings: (settings: VerdictSettings) => void;
  saveIncome: (income: IncomeEvent) => void;
  deleteIncome: (id: string) => void;
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  saveTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  applyScenarioToPlan: (scenario: Scenario) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);
const STORAGE_KEY = "ai-finance-copilot-demo-state";

function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(demoState);
  const [status, setStatus] = useState<PlanStatus>("loading");

  useEffect(() => {
    let saved: FinanceState | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) as FinanceState;
    } catch {
      saved = null;
    }
    if (saved) {
      setState(withToday(saved, localToday()));
      setStatus("ready");
    } else {
      setStatus("needs-setup");
    }
  }, []);

  // Only save once a plan exists, so the first render's placeholder never overwrites a saved plan.
  useEffect(() => {
    if (status !== "ready") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode, full quota); the plan still works for this session.
    }
  }, [status, state]);

  const projection = useMemo(() => buildProjection(state), [state]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      status,
      projection,
      startDemo: () => {
        setState(demoState);
        setStatus("ready");
      },
      startPlan: (plan) => {
        setState(withToday(plan, localToday()));
        setStatus("ready");
      },
      startOver: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing saved to remove.
        }
        setState(demoState);
        setStatus("needs-setup");
      },
      updateCash: (checking, savings, buffer) =>
        setState((current) => ({ ...current, cash: { checking, savings, targetEndingBuffer: buffer } })),
      updateSemester: (name, startDate, endDate) =>
        setState((current) => ({ ...current, semester: { ...current.semester, name, startDate, endDate } })),
      updateVerdictSettings: (verdictSettings) => setState((current) => ({ ...current, verdictSettings })),
      saveIncome: (income) => setState((current) => ({ ...current, incomes: upsert(current.incomes, income) })),
      deleteIncome: (id) => setState((current) => ({ ...current, incomes: current.incomes.filter((income) => income.id !== id) })),
      saveExpense: (expense) => setState((current) => ({ ...current, expenses: upsert(current.expenses, expense) })),
      deleteExpense: (id) => setState((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) })),
      saveTransaction: (transaction) =>
        setState((current) => ({ ...current, transactions: upsert(current.transactions, transaction) })),
      deleteTransaction: (id) =>
        setState((current) => ({ ...current, transactions: current.transactions.filter((transaction) => transaction.id !== id) })),
      applyScenarioToPlan: (scenario) => setState((current) => applyScenario(current, scenario))
    }),
    [projection, state, status]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within FinanceProvider");
  }
  return context;
}
