import type { FinanceState, IncomeEvent } from "@/types/finance";

type SavedPlan = Omit<FinanceState, "incomes"> & {
  incomes: (Omit<IncomeEvent, "guaranteed"> & { guaranteed?: boolean })[];
};

/** Older saved plans omitted guaranteed; only an explicit false excludes income. */
export function normalizePlan(state: SavedPlan): FinanceState {
  return {
    ...state,
    incomes: state.incomes.map((income) => ({ ...income, guaranteed: income.guaranteed ?? true }))
  };
}
