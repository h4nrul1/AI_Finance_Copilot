import type { FinanceState, VerdictPreset, VerdictSettings } from "@/types/finance";

export const VERDICT_PRESETS: Record<Exclude<VerdictPreset, "custom">, Omit<VerdictSettings, "preset"> & { label: string; description: string }> = {
  cautious: {
    label: "Cautious",
    description: "Flags anything that leaves less than $1,000 extra or cuts weekly spending by 15%+.",
    comfortMargin: 1000,
    weeklyDropLimit: 0.15
  },
  balanced: {
    label: "Balanced",
    description: "Flags anything that leaves less than $750 extra or cuts weekly spending by 25%+.",
    comfortMargin: 750,
    weeklyDropLimit: 0.25
  },
  flexible: {
    label: "Flexible",
    description: "Flags anything that leaves less than $300 extra or cuts weekly spending by 40%+.",
    comfortMargin: 300,
    weeklyDropLimit: 0.4
  }
};

export const COMFORT_MARGIN_BOUNDS = { min: 0, max: 5000 };
export const WEEKLY_DROP_BOUNDS = { min: 0.05, max: 0.75 };

export const DEFAULT_VERDICT_SETTINGS: VerdictSettings = { preset: "balanced", ...pick(VERDICT_PRESETS.balanced) };

function pick({ comfortMargin, weeklyDropLimit }: Omit<VerdictSettings, "preset">) {
  return { comfortMargin, weeklyDropLimit };
}

function clamp(value: number, { min, max }: { min: number; max: number }, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function presetSettings(preset: Exclude<VerdictPreset, "custom">): VerdictSettings {
  return { preset, ...pick(VERDICT_PRESETS[preset]) };
}

/** Reads the plan's verdict settings, filling defaults for older saved plans and clamping custom values. */
export function getVerdictSettings(state: FinanceState): VerdictSettings {
  const settings = state.verdictSettings;
  if (!settings) return DEFAULT_VERDICT_SETTINGS;
  if (settings.preset !== "custom" && settings.preset in VERDICT_PRESETS) return presetSettings(settings.preset);

  return {
    preset: "custom",
    comfortMargin: Math.round(clamp(Number(settings.comfortMargin), COMFORT_MARGIN_BOUNDS, DEFAULT_VERDICT_SETTINGS.comfortMargin)),
    weeklyDropLimit: clamp(Number(settings.weeklyDropLimit), WEEKLY_DROP_BOUNDS, DEFAULT_VERDICT_SETTINGS.weeklyDropLimit)
  };
}
