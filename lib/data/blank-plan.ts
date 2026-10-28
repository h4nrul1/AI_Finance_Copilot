import type { FinanceState, Semester } from "@/types/finance";

/** A starting guess at the current term from today's date. Students can change the dates on Semester Plan. */
export function guessSemester(today: string): Omit<Semester, "currentDate"> {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);

  if (monthDay >= "08-01") return { name: `Fall ${year}`, startDate: `${year}-08-24`, endDate: `${year}-12-15` };
  if (monthDay <= "05-10") return { name: `Spring ${year}`, startDate: `${year}-01-12`, endDate: `${year}-05-10` };
  return { name: `Summer ${year}`, startDate: `${year}-05-18`, endDate: `${year}-08-14` };
}

/** An empty personal plan that starts today. */
export function createBlankPlan(today: string, name = ""): FinanceState {
  return {
    student: { name: name.trim(), school: "", major: "", year: "" },
    semester: { ...guessSemester(today), currentDate: today },
    cash: { checking: 0, savings: 0, targetEndingBuffer: 500 },
    incomes: [],
    expenses: [],
    transactions: [],
    goals: [],
    mode: "personal"
  };
}

/** Personal plans always use the real date as "today"; demo plans keep their sample date. */
export function withToday(state: FinanceState, today: string): FinanceState {
  if (state.mode !== "personal" || state.semester.currentDate === today) return state;
  return { ...state, semester: { ...state.semester, currentDate: today } };
}
