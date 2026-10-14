import type { FinanceState, FinancialProjection, Verdict, VerdictLevel } from "@/types/finance";
import { COMFORT_MARGIN } from "./engine";
import { formatCurrency, formatDate } from "@/lib/utils";

/** A scenario that cuts safe weekly spending by at least this share is "tight" even if the ending cash looks fine. */
export const WEEKLY_DROP_TIGHT_RATIO = 0.25;

const LABELS: Record<VerdictLevel, Verdict["label"]> = {
  comfortable: "Comfortable",
  tight: "Fits, but tight",
  "not-recommended": "Not recommended"
};

function perWeek(total: number, weeks: number) {
  return formatCurrency(Math.ceil(total / Math.max(1, weeks)));
}

/**
 * Deterministic, rule-based judgement of a scenario. The copilot must relay this verdict, never invent its own.
 * Rules, in order: overdraft or ending below the buffer -> not recommended; ending inside the comfort margin
 * or a large cut to weekly spending -> tight; otherwise comfortable.
 */
export function assessScenario(state: FinanceState, baseline: FinancialProjection, scenario: FinancialProjection): Verdict {
  const buffer = state.cash.targetEndingBuffer;
  const ending = scenario.projectedEndingBalance;
  const endingDifference = ending - baseline.projectedEndingBalance;
  const weeks = scenario.safeWeekly.weeksRemaining;
  const baseWeekly = baseline.safeWeekly.safeWeeklySpending;
  const newWeekly = scenario.safeWeekly.safeWeeklySpending;
  const weeklyDropRatio = baseWeekly > 0 ? (baseWeekly - newWeekly) / baseWeekly : 0;
  const firstNegative = scenario.timeline.find((point) => point.balance < 0);
  const verdict = (level: VerdictLevel, headline: string, reasons: string[], suggestion?: string): Verdict => ({
    level,
    label: LABELS[level],
    headline,
    reasons,
    suggestion
  });

  if (endingDifference >= 0) {
    const level: VerdictLevel = ending >= buffer + COMFORT_MARGIN ? "comfortable" : ending >= buffer ? "tight" : "not-recommended";
    return verdict(
      level,
      endingDifference === 0
        ? "This doesn't change your projected semester-end cash."
        : `This improves your projected semester-end cash by ${formatCurrency(endingDifference)}.`,
      [`You'd finish the semester with ${formatCurrency(ending)} against a ${formatCurrency(buffer)} goal.`]
    );
  }

  if (firstNegative) {
    const needed = Math.max(Math.abs(scenario.lowestProjectedBalance), buffer - ending);
    return verdict(
      "not-recommended",
      `Your checking balance would go negative around ${formatDate(firstNegative.date)}.`,
      [
        `The lowest projected balance would be ${formatCurrency(scenario.lowestProjectedBalance)}.`,
        "Overdrafts usually mean fees or missed required payments like rent."
      ],
      `Reduce this by at least ${formatCurrency(needed)} to stay above zero and protect your ${formatCurrency(buffer)} buffer, or move it later in the semester.`
    );
  }

  if (ending < buffer) {
    const shortfall = buffer - ending;
    return verdict(
      "not-recommended",
      `You'd finish with ${formatCurrency(ending)}, which is ${formatCurrency(shortfall)} below your ${formatCurrency(buffer)} safety buffer.`,
      [
        `Projected semester-end cash drops from ${formatCurrency(baseline.projectedEndingBalance)} to ${formatCurrency(ending)}.`,
        `Safe weekly spending would fall to ${formatCurrency(newWeekly)}/week.`
      ],
      `To make it fit, reduce the cost by ${formatCurrency(shortfall)}, or cut about ${perWeek(shortfall, weeks)}/week from flexible spending for the rest of the semester.`
    );
  }

  const cushionGap = buffer + COMFORT_MARGIN - ending;
  if (cushionGap > 0 || weeklyDropRatio >= WEEKLY_DROP_TIGHT_RATIO) {
    const reasons = [
      `Safe weekly spending drops from ${formatCurrency(baseWeekly)}/week to ${formatCurrency(newWeekly)}/week (${Math.round(weeklyDropRatio * 100)}% less).`
    ];
    if (cushionGap > 0) {
      reasons.push(`You'd end only ${formatCurrency(ending - buffer)} above your ${formatCurrency(buffer)} buffer.`);
    }
    return verdict(
      "tight",
      `It fits, but you'd need to spend less for the rest of the semester.`,
      reasons,
      cushionGap > 0
        ? `Trimming about ${perWeek(cushionGap, weeks)}/week from dining or shopping would restore a comfortable cushion.`
        : `Plan on about ${formatCurrency(newWeekly)}/week for flexible spending instead of ${formatCurrency(baseWeekly)}/week.`
    );
  }

  return verdict(
    "comfortable",
    `You'd still finish the semester with ${formatCurrency(ending)}.`,
    [
      `That's ${formatCurrency(ending - buffer)} above your ${formatCurrency(buffer)} buffer.`,
      `Safe weekly spending moves from ${formatCurrency(baseWeekly)}/week to ${formatCurrency(newWeekly)}/week.`
    ]
  );
}
