"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Expense, FinanceState, IncomeEvent, Scenario, Transaction, VerdictSettings } from "@/types/finance";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { applyScenario } from "@/lib/finance/tools";

interface FinanceContextValue {
  state: FinanceState;
  projection: ReturnType<typeof buildProjection>;
  resetDemoData: () => void;
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
  // Saving waits until the saved plan has been read, so the first render's demo data never overwrites it.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch {
      setState(demoState);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode, full quota); the plan still works for this session.
    }
  }, [loaded, state]);

  const projection = useMemo(() => buildProjection(state), [state]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      projection,
      resetDemoData: () => setState(demoState),
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
    [projection, state]
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
