import type { FinanceState, VerdictSettings } from "@/types/finance";

/** Comfortable while the weekly budget drops 25% or less; tight up to 100% (ending exactly at the goal). */
export const DEFAULT_VERDICT_SETTINGS: VerdictSettings = { comfortableDropLimit: 0.25, tightDropLimit: 1 };

/** Thresholds are whole percents: comfortable 1-99, tight above comfortable and at most 100. */
export const THRESHOLD_BOUNDS = { min: 1, max: 100 };

/** Returns a message explaining what's wrong with two typed percentages, or null if they can be saved. */
export function thresholdError(comfortablePercent: number, tightPercent: number): string | null {
  const whole = (value: number) => Number.isInteger(value);
  if (!whole(comfortablePercent) || !whole(tightPercent)) return "Use whole percentages, like 25 and 60.";
  if (comfortablePercent < THRESHOLD_BOUNDS.min || tightPercent > THRESHOLD_BOUNDS.max) {
    return `Use values between ${THRESHOLD_BOUNDS.min}% and ${THRESHOLD_BOUNDS.max}%.`;
  }
  if (comfortablePercent >= tightPercent) return "The Comfortable limit must be lower than the Fits, but tight limit.";
  return null;
}

function isValid(settings: Partial<VerdictSettings>): settings is VerdictSettings {
  const { comfortableDropLimit: comfortable, tightDropLimit: tight } = settings;
  return (
    typeof comfortable === "number" &&
    typeof tight === "number" &&
    thresholdError(Math.round(comfortable * 100), Math.round(tight * 100)) === null
  );
}

/**
 * Reads the plan's thresholds. Plans saved before this setting existed get the defaults; plans saved with the
 * older single "weekly drop limit" keep it as their Comfortable threshold.
 */
export function getVerdictSettings(state: FinanceState): VerdictSettings {
  const saved = state.verdictSettings as (Partial<VerdictSettings> & { weeklyDropLimit?: number }) | undefined;
  if (!saved) return DEFAULT_VERDICT_SETTINGS;
  if (isValid(saved)) return { comfortableDropLimit: saved.comfortableDropLimit, tightDropLimit: saved.tightDropLimit };

  const legacy = { comfortableDropLimit: saved.weeklyDropLimit, tightDropLimit: 1 };
  return isValid(legacy) ? legacy : DEFAULT_VERDICT_SETTINGS;
}
