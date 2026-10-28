"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Expense, FinanceState, IncomeEvent, Scenario, Transaction, VerdictSettings } from "@/types/finance";
import { withToday } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { localToday } from "@/lib/finance/dates";
import { buildProjection } from "@/lib/finance/engine";
import { applyScenario } from "@/lib/finance/tools";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { choosePlanOnLogin, deleteAccountPlan, loadAccountPlan, saveAccountPlan, shouldSaveToAccount } from "@/lib/supabase/plan-store";

/**
 * "loading" until the plan is read; "needs-setup" when there's no plan yet; "error" when a signed-in student's
 * plan couldn't be loaded (nothing is saved in that state, so their data is never overwritten).
 */
export type PlanStatus = "loading" | "needs-setup" | "ready" | "error";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AccountUser {
  id: string;
  email: string;
}

interface FinanceContextValue {
  state: FinanceState;
  status: PlanStatus;
  projection: ReturnType<typeof buildProjection>;
  /** True when Supabase is configured; otherwise the app is guest-only. */
  accountsEnabled: boolean;
  /** The signed-in student, or null for guests. */
  user: AccountUser | null;
  /** Whether the latest change has reached the student's account. Always "idle" for guests. */
  saveStatus: SaveStatus;
  signOut: () => Promise<void>;
  /** Load the sample student's plan. */
  startDemo: () => void;
  /** Start using a plan the student created (blank or drafted during setup). */
  startPlan: (plan: FinanceState) => void;
  /** Delete the current plan (from this browser, or from the account) and go back to the welcome screen. */
  startOver: () => Promise<void>;
  updateCash: (checking: number, savings: number, buffer: number) => void;
  updateSemester: (name: string, startDate: string, endDate: string) => void;
  updateVerdictSettings: (settings: VerdictSettings) => void;
  dismissAccuracyCard: () => void;
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
const ACCOUNT_SAVE_DELAY_MS = 800;

function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

function readGuestPlan(): FinanceState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FinanceState) : null;
  } catch {
    return null;
  }
}

function writeGuestPlan(plan: FinanceState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Storage can be unavailable (private mode, full quota); the plan still works for this session.
  }
}

function clearGuestPlan() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved to remove.
  }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase();
  const [state, setState] = useState<FinanceState>(demoState);
  const [status, setStatus] = useState<PlanStatus>("loading");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // The plan as last read from or written to the account, so loading a plan doesn't immediately re-save it.
  const lastSynced = useRef<string | null>(null);
  // Ignores results from an older login when a newer one has started.
  const loadId = useRef(0);

  useEffect(() => {
    function loadGuest() {
      setUser(null);
      setSaveStatus("idle");
      const saved = readGuestPlan();
      if (saved) {
        setState(withToday(saved, localToday()));
        setStatus("ready");
      } else {
        setState(demoState);
        setStatus("needs-setup");
      }
    }

    if (!supabase) {
      loadGuest();
      return;
    }

    async function enterAccount(session: Session) {
      const id = ++loadId.current;
      setStatus("loading");
      setUser({ id: session.user.id, email: session.user.email ?? "" });
      try {
        const { plan, importGuestPlan } = choosePlanOnLogin(await loadAccountPlan(supabase!, session.user.id), readGuestPlan());
        if (id !== loadId.current) return;
        if (importGuestPlan && plan) {
          await saveAccountPlan(supabase!, session.user.id, plan);
          clearGuestPlan();
        }
        if (id !== loadId.current) return;
        if (plan) {
          const current = withToday(plan, localToday());
          lastSynced.current = JSON.stringify(current);
          setState(current);
          setSaveStatus("saved");
          setStatus("ready");
        } else {
          lastSynced.current = null;
          setState(demoState);
          setStatus("needs-setup");
        }
      } catch (error) {
        console.error("[account] Couldn't load the plan:", error);
        if (id === loadId.current) setStatus("error");
      }
    }

    // Supabase recommends not awaiting other Supabase calls inside this callback, so the work is deferred.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        setTimeout(() => (session ? enterAccount(session) : loadGuest()), 0);
      } else if (event === "SIGNED_OUT") {
        loadId.current += 1;
        lastSynced.current = null;
        setTimeout(loadGuest, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  // Save changes: guests to this browser right away; signed-in students to their account after a short pause.
  useEffect(() => {
    if (status !== "ready") return;
    if (!user) {
      writeGuestPlan(state);
      return;
    }
    if (!supabase || !shouldSaveToAccount(state)) return;
    const snapshot = JSON.stringify(state);
    if (snapshot === lastSynced.current) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await saveAccountPlan(supabase, user.id, state);
        lastSynced.current = snapshot;
        setSaveStatus("saved");
      } catch (error) {
        console.error("[account] Couldn't save the plan:", error);
        setSaveStatus("error");
      }
    }, ACCOUNT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, state, user, supabase]);

  const projection = useMemo(() => buildProjection(state), [state]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      status,
      projection,
      accountsEnabled: supabase !== null,
      user,
      saveStatus,
      signOut: async () => {
        await supabase?.auth.signOut();
      },
      startDemo: () => {
        setState(demoState);
        setStatus("ready");
      },
      startPlan: (plan) => {
        setState(withToday(plan, localToday()));
        setStatus("ready");
      },
      startOver: async () => {
        if (user && supabase) {
          await deleteAccountPlan(supabase, user.id);
          lastSynced.current = null;
        } else {
          clearGuestPlan();
        }
        setState(demoState);
        setStatus("needs-setup");
      },
      updateCash: (checking, savings, buffer) =>
        setState((current) => ({
          ...current,
          // A setup estimate stays an estimate until the checking amount itself is changed.
          cash: { checking, savings, targetEndingBuffer: buffer, checkingEstimated: current.cash.checkingEstimated && checking === current.cash.checking }
        })),
      dismissAccuracyCard: () => setState((current) => ({ ...current, accuracyCardDismissed: true })),
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
    [projection, state, status, supabase, user, saveStatus]
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
