"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Expense, FinanceState, IncomeEvent, Scenario } from "@/types/finance";
import { demoState } from "@/lib/data/seed";
import { buildProjection } from "@/lib/finance/engine";
import { compareScenarioToBaseline } from "@/lib/finance/tools";

interface FinanceContextValue {
  state: FinanceState;
  projection: ReturnType<typeof buildProjection>;
  resetDemoData: () => void;
  updateCash: (checking: number, savings: number, buffer: number) => void;
  updateSemester: (name: string, startDate: string, endDate: string) => void;
  saveIncome: (income: IncomeEvent) => void;
  deleteIncome: (id: string) => void;
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  runScenario: (scenario: Scenario) => ReturnType<typeof compareScenarioToBaseline>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);
const STORAGE_KEY = "ai-finance-copilot-demo-state";

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(demoState);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        setState(demoState);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
      saveIncome: (income) =>
        setState((current) => ({
          ...current,
          incomes: current.incomes.some((item) => item.id === income.id)
            ? current.incomes.map((item) => (item.id === income.id ? income : item))
            : [...current.incomes, income]
        })),
      deleteIncome: (id) =>
        setState((current) => ({
          ...current,
          incomes: current.incomes.filter((income) => income.id !== id)
        })),
      saveExpense: (expense) =>
        setState((current) => ({
          ...current,
          expenses: current.expenses.some((item) => item.id === expense.id)
            ? current.expenses.map((item) => (item.id === expense.id ? expense : item))
            : [...current.expenses, expense]
        })),
      deleteExpense: (id) =>
        setState((current) => ({
          ...current,
          expenses: current.expenses.filter((expense) => expense.id !== id)
        })),
      runScenario: (scenario) => compareScenarioToBaseline(state, scenario)
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
