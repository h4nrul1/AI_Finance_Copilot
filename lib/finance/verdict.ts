import type { FinanceState, FinancialProjection, Verdict, VerdictLevel } from "@/types/finance";
import { getVerdictSettings } from "./verdict-settings";
import { formatCurrency, formatDate } from "@/lib/utils";

const LABELS: Record<VerdictLevel, Verdict["label"]> = {
  comfortable: "Comfortable",
  tight: "Fits, but tight",
  "not-recommended": "Not recommended"
};

function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Deterministic, rule-based judgement of a scenario. The copilot must relay this verdict, never invent its own.
 *
 * Fixed safety rules: going below $0 at any point, or ending below the goal, is always "not recommended".
 * Otherwise the verdict depends on how much the change cuts the safe weekly budget, compared with the student's
 * two thresholds: up to the comfortable limit is "comfortable", up to the tight limit is "tight", above it is
 * "not recommended". The weekly budget is spare money divided by weeks left, so the cut is also the share of
 * spare money the decision uses up.
 */
export function assessScenario(state: FinanceState, baseline: FinancialProjection, scenario: FinancialProjection): Verdict {
  const { comfortableDropLimit, tightDropLimit } = getVerdictSettings(state);
  const goal = state.cash.targetEndingBuffer;
  const ending = scenario.projectedEndingBalance;
  const endingDifference = ending - baseline.projectedEndingBalance;
  const weeks = baseline.safeWeekly.weeksRemaining;
  const baseWeekly = baseline.safeWeekly.safeWeeklySpending;
  const newWeekly = scenario.safeWeekly.safeWeeklySpending;
  const drop = baseWeekly > 0 ? (baseWeekly - newWeekly) / baseWeekly : 1;
  const firstNegative = scenario.timeline.find((point) => point.balance < 0);
  const weeklyChange = `Safe weekly spending goes from ${formatCurrency(baseWeekly)}/week to ${formatCurrency(newWeekly)}/week (${percent(drop)} less).`;
  // Dollars that would bring the cut back down to a threshold.
  const overBy = (limit: number) => formatCurrency(Math.ceil((drop - limit) * baseWeekly * weeks));
  const verdict = (level: VerdictLevel, headline: string, reasons: string[], rule: string, suggestion?: string): Verdict => ({
    level,
    label: LABELS[level],
    headline,
    reasons,
    suggestion,
    rule
  });

  if (endingDifference >= 0) {
    return verdict(
      ending >= goal ? "comfortable" : "not-recommended",
      endingDifference === 0
        ? "This doesn't change your projected semester-end cash."
        : `This improves your projected semester-end cash by ${formatCurrency(endingDifference)}.`,
      [`You'd finish the semester with ${formatCurrency(ending)} against a ${formatCurrency(goal)} goal.`],
      ending >= goal
        ? "Changes that add money are Comfortable as long as you still finish at or above your goal."
        : `Always not recommended: you'd still end below your ${formatCurrency(goal)} goal.`
    );
  }

  if (firstNegative) {
    const needed = Math.max(Math.abs(scenario.lowestProjectedBalance), goal - ending);
    return verdict(
      "not-recommended",
      `Your checking balance would go negative around ${formatDate(firstNegative.date)}.`,
      [
        `The lowest projected balance would be ${formatCurrency(scenario.lowestProjectedBalance)}.`,
        "Overdrafts usually mean fees or missed required payments like rent."
      ],
      "Always not recommended: your balance would drop below $0.",
      `Reduce this by at least ${formatCurrency(needed)} to stay above zero and protect your ${formatCurrency(goal)} goal, or move it later in the semester.`
    );
  }

  if (ending < goal) {
    const shortfall = goal - ending;
    return verdict(
      "not-recommended",
      `You'd finish with ${formatCurrency(ending)}, which is ${formatCurrency(shortfall)} below your ${formatCurrency(goal)} goal.`,
      [
        `Projected semester-end cash drops from ${formatCurrency(baseline.projectedEndingBalance)} to ${formatCurrency(ending)}.`,
        `Safe weekly spending would fall to ${formatCurrency(newWeekly)}/week.`
      ],
      `Always not recommended: you'd end the semester below your ${formatCurrency(goal)} goal.`,
      `To make it fit, reduce the cost by ${formatCurrency(shortfall)}, or cut about ${formatCurrency(
        Math.ceil(shortfall / Math.max(1, weeks))
      )}/week from flexible spending for the rest of the semester.`
    );
  }

  if (drop > tightDropLimit) {
    return verdict(
      "not-recommended",
      `This would cut your weekly budget by ${percent(drop)}.`,
      [weeklyChange, `You'd still finish with ${formatCurrency(ending)}, but with very little room for anything else.`],
      `Not recommended because your weekly budget drops ${percent(drop)}, more than your ${percent(tightDropLimit)} limit for Fits, but tight.`,
      `Reduce this by about ${overBy(tightDropLimit)} to bring it within your Fits, but tight limit.`
    );
  }

  if (drop > comfortableDropLimit) {
    return verdict(
      "tight",
      "It fits, but you'd need to spend less for the rest of the semester.",
      [weeklyChange, `You'd finish with ${formatCurrency(ending)}, ${formatCurrency(ending - goal)} above your goal.`],
      `Fits, but tight because your weekly budget drops ${percent(drop)}, more than your ${percent(comfortableDropLimit)} limit for Comfortable.`,
      `Plan on about ${formatCurrency(newWeekly)}/week from now on, or reduce this by about ${overBy(comfortableDropLimit)} to keep it Comfortable.`
    );
  }

  return verdict(
    "comfortable",
    `You'd still finish the semester with ${formatCurrency(ending)}.`,
    [`That's ${formatCurrency(ending - goal)} above your ${formatCurrency(goal)} goal.`, weeklyChange],
    `Comfortable because your weekly budget drops ${percent(drop)}, within your ${percent(comfortableDropLimit)} limit.`
  );
}
