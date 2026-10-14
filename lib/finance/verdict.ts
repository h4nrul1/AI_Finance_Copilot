import type { FinanceState, FinancialProjection, Verdict, VerdictLevel } from "@/types/finance";
import { getVerdictSettings } from "./verdict-settings";
import { formatCurrency, formatDate } from "@/lib/utils";

const LABELS: Record<VerdictLevel, Verdict["label"]> = {
  comfortable: "Comfortable",
  tight: "Fits, but tight",
  "not-recommended": "Not recommended"
};

function perWeek(total: number, weeks: number) {
  return formatCurrency(Math.ceil(total / Math.max(1, weeks)));
}

function percent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Deterministic, rule-based judgement of a scenario. The copilot must relay this verdict, never invent its own.
 * Fixed rules: an overdraft or ending below the goal is always "not recommended". The student's verdict settings
 * decide the line between "tight" and "comfortable" (comfort margin above the goal, and weekly spending cut limit).
 */
export function assessScenario(state: FinanceState, baseline: FinancialProjection, scenario: FinancialProjection): Verdict {
  const { comfortMargin, weeklyDropLimit } = getVerdictSettings(state);
  const buffer = state.cash.targetEndingBuffer;
  const ending = scenario.projectedEndingBalance;
  const endingDifference = ending - baseline.projectedEndingBalance;
  const weeks = scenario.safeWeekly.weeksRemaining;
  const baseWeekly = baseline.safeWeekly.safeWeeklySpending;
  const newWeekly = scenario.safeWeekly.safeWeeklySpending;
  const weeklyDropRatio = baseWeekly > 0 ? (baseWeekly - newWeekly) / baseWeekly : 0;
  const firstNegative = scenario.timeline.find((point) => point.balance < 0);
  const comfortRule = `Comfortable means ending at least ${formatCurrency(comfortMargin)} above your ${formatCurrency(
    buffer
  )} goal and cutting weekly spending by less than ${percent(weeklyDropLimit)}.`;
  const verdict = (level: VerdictLevel, headline: string, reasons: string[], rule: string, suggestion?: string): Verdict => ({
    level,
    label: LABELS[level],
    headline,
    reasons,
    suggestion,
    rule
  });

  if (endingDifference >= 0) {
    const level: VerdictLevel = ending >= buffer + comfortMargin ? "comfortable" : ending >= buffer ? "tight" : "not-recommended";
    return verdict(
      level,
      endingDifference === 0
        ? "This doesn't change your projected semester-end cash."
        : `This improves your projected semester-end cash by ${formatCurrency(endingDifference)}.`,
      [`You'd finish the semester with ${formatCurrency(ending)} against a ${formatCurrency(buffer)} goal.`],
      "Changes that add cash are rated by where you'd end the semester compared with your goal."
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
      "Always not recommended: your balance would drop below $0.",
      `Reduce this by at least ${formatCurrency(needed)} to stay above zero and protect your ${formatCurrency(buffer)} goal, or move it later in the semester.`
    );
  }

  if (ending < buffer) {
    const shortfall = buffer - ending;
    return verdict(
      "not-recommended",
      `You'd finish with ${formatCurrency(ending)}, which is ${formatCurrency(shortfall)} below your ${formatCurrency(buffer)} goal.`,
      [
        `Projected semester-end cash drops from ${formatCurrency(baseline.projectedEndingBalance)} to ${formatCurrency(ending)}.`,
        `Safe weekly spending would fall to ${formatCurrency(newWeekly)}/week.`
      ],
      `Always not recommended: you'd end the semester below your ${formatCurrency(buffer)} goal.`,
      `To make it fit, reduce the cost by ${formatCurrency(shortfall)}, or cut about ${perWeek(shortfall, weeks)}/week from flexible spending for the rest of the semester.`
    );
  }

  const cushionGap = buffer + comfortMargin - ending;
  const bigWeeklyCut = weeklyDropRatio >= weeklyDropLimit;
  if (cushionGap > 0 || bigWeeklyCut) {
    const reasons = [
      `Safe weekly spending drops from ${formatCurrency(baseWeekly)}/week to ${formatCurrency(newWeekly)}/week (${percent(weeklyDropRatio)} less).`
    ];
    if (cushionGap > 0) {
      reasons.push(`You'd end only ${formatCurrency(ending - buffer)} above your ${formatCurrency(buffer)} goal.`);
    }
    const triggers = [
      cushionGap > 0 ? `you'd end less than ${formatCurrency(comfortMargin)} above your goal` : null,
      bigWeeklyCut ? `weekly spending drops ${percent(weeklyDropRatio)} (your limit is ${percent(weeklyDropLimit)})` : null
    ].filter(Boolean);
    return verdict(
      "tight",
      "It fits, but you'd need to spend less for the rest of the semester.",
      reasons,
      `Fits, but tight because ${triggers.join(" and ")}.`,
      cushionGap > 0
        ? `Trimming about ${perWeek(cushionGap, weeks)}/week from dining or shopping would restore a comfortable cushion.`
        : `Plan on about ${formatCurrency(newWeekly)}/week for flexible spending instead of ${formatCurrency(baseWeekly)}/week.`
    );
  }

  return verdict(
    "comfortable",
    `You'd still finish the semester with ${formatCurrency(ending)}.`,
    [
      `That's ${formatCurrency(ending - buffer)} above your ${formatCurrency(buffer)} goal.`,
      `Safe weekly spending moves from ${formatCurrency(baseWeekly)}/week to ${formatCurrency(newWeekly)}/week.`
    ],
    comfortRule
  );
}
